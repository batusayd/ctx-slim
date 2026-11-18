import * as fs from 'fs';
import * as path from 'path';
import { ModelPricing, StatsOptions } from '../types';
import { IgnoreMatcher } from '../utils/ignore';
import {
  c,
  estimateTokens,
  formatBytes,
  formatNumber,
  formatUsd,
  log,
  printBanner,
  renderTable,
} from '../utils/ui';
import { buildRepoMap } from './map';

const MODEL_PRICING_LIST: ModelPricing[] = [
  {
    name: 'Claude Opus 4.6 / 4.5',
    provider: 'Anthropic',
    inputPerMillionUsd: 5.0,
    cachedInputPerMillionUsd: 0.5,
  },
  {
    name: 'Claude Sonnet 4.6 / 4.5',
    provider: 'Anthropic',
    inputPerMillionUsd: 3.0,
    cachedInputPerMillionUsd: 0.3,
  },
  {
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    inputPerMillionUsd: 1.25,
    cachedInputPerMillionUsd: 0.31,
  },
  {
    name: 'GPT-4.1',
    provider: 'OpenAI',
    inputPerMillionUsd: 2.0,
    cachedInputPerMillionUsd: 0.5,
  },
];

interface IgnoredScanStats {
  ignoredFileCount: number;
  ignoredBytes: number;
  ignoredTokens: number;
  lockAndBuildBytes: number;
  lockAndBuildTokens: number;
}

const LOCK_AND_BUNDLE_NAMES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'Cargo.lock',
  'poetry.lock',
  'Pipfile.lock',
  'uv.lock',
  'go.sum',
  'composer.lock',
  'Gemfile.lock',
]);

function scanIgnoredBloat(cwd: string, matcher: IgnoreMatcher): IgnoredScanStats {
  let ignoredFileCount = 0;
  let ignoredBytes = 0;
  let lockAndBuildBytes = 0;
  const maxFilesToStat = 4000;

  function walk(dir: string, depth: number, insideIgnoredDir: boolean): void {
    if (depth > 5 || ignoredFileCount >= maxFilesToStat) return;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (ignoredFileCount >= maxFilesToStat) break;
      if (entry.name === '.git') continue;

      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(cwd, fullPath).replace(/\\/g, '/');
      const isIgnored = insideIgnoredDir || matcher.isIgnored(relPath, entry.isDirectory());

      if (entry.isDirectory()) {
        walk(fullPath, depth + 1, isIgnored);
      } else if (entry.isFile() && isIgnored) {
        if (entry.name === 'REPO_MAP.md' || entry.name === 'CONTEXT_STATE.md') continue;
        try {
          const st = fs.statSync(fullPath);
          ignoredFileCount++;
          ignoredBytes += st.size;
          if (
            LOCK_AND_BUNDLE_NAMES.has(entry.name) ||
            relPath.startsWith('dist/') ||
            relPath.startsWith('build/') ||
            entry.name.endsWith('.min.js') ||
            entry.name.endsWith('.map')
          ) {
            lockAndBuildBytes += st.size;
          }
        } catch {
          // Ignore stat errors
        }
      }
    }
  }

  walk(cwd, 0, false);

  return {
    ignoredFileCount,
    ignoredBytes,
    ignoredTokens: estimateTokens(ignoredBytes),
    lockAndBuildBytes,
    lockAndBuildTokens: estimateTokens(lockAndBuildBytes),
  };
}

export function runStatsCommand(options: StatsOptions): void {
  const cwd = path.resolve(options.cwd);
  const matcher = new IgnoreMatcher(cwd);
  const mapResult = buildRepoMap({ cwd, output: 'REPO_MAP.md', quiet: true });
  const ignoredStats = scanIgnoredBloat(cwd, matcher);

  const totalFiles = Math.max(1, mapResult.totalFiles);
  const rawSourceTokens = mapResult.rawCodeTokens;
  const avgFileTokens = Math.round(rawSourceTokens / totalFiles);
  const avgTokensPerLine = mapResult.totalLines > 0 ? rawSourceTokens / mapResult.totalLines : 8;

  // Compute empirical average symbol span from actual parsed `[Lstart-Lend]` symbols in this repository
  let totalSymbolSpanLines = 0;
  let symbolCount = 0;
  for (const entry of mapResult.entries) {
    for (const sym of entry.symbols) {
      const span = Math.max(1, sym.lineEnd - sym.lineStart + 1);
      totalSymbolSpanLines += span;
      symbolCount++;
    }
  }
  const avgSymbolLines =
    symbolCount > 0 ? Math.round(totalSymbolSpanLines / symbolCount) : 30;
  // Target read window = symbol span + ±15 lines safety buffer
  const avgTargetedSliceLines = avgSymbolLines + 30;
  const avgTargetedSliceTokens = Math.min(
    avgFileTokens,
    Math.round(avgTargetedSliceLines * avgTokensPerLine)
  );

  // Realistic Task Modeling (Uncapped REPO_MAP.md token cost):
  // Baseline (No ctx-slim): Agent runs grep/glob and reads ~3 candidate files in full (or all files if repo < 3 files)
  const candidateFilesPerTask = Math.min(totalFiles, 3);
  const baselineTaskTokens = Math.min(rawSourceTokens, avgFileTokens * candidateFilesPerTask);

  // With ctx-slim: Compact CLAUDE.md rule block (~155 tok) + full REPO_MAP.md + 2 targeted symbol range reads
  const ruleOverheadTokens = 155;
  const targetedSlicesCount = Math.min(candidateFilesPerTask, 2);
  const slimTaskTokens =
    ruleOverheadTokens +
    mapResult.mapTokens +
    avgTargetedSliceTokens * targetedSlicesCount;

  const savedPerTaskTokens = Math.max(0, baselineTaskTokens - slimTaskTokens);
  const savedPerTaskPct =
    baselineTaskTokens > 0
      ? ((baselineTaskTokens - slimTaskTokens) / baselineTaskTokens) * 100
      : 0;

  const tasksPerSession = 15;

  if (options.json) {
    const jsonOutput = {
      project: path.basename(cwd),
      methodology: 'Lexical BPE-approximation; compares reading 4 candidate files in full vs REPO_MAP + 2 targeted [Lstart-Lend] symbol slices (±15 lines) + 155-token rule overhead.',
      repositoryMetrics: {
        activeSourceFiles: mapResult.totalFiles,
        activeSourceLines: mapResult.totalLines,
        mappedSymbols: mapResult.totalSymbols,
        avgFileTokens,
        avgSymbolLines,
        avgTargetedSliceTokens,
        totalSourceTokens: rawSourceTokens,
        repoMapTokens: mapResult.mapTokens,
        deniedLockAndBuildTokens: ignoredStats.lockAndBuildTokens,
      },
      perTaskComparison: {
        baselineCandidateFilesRead: candidateFilesPerTask,
        baselineTaskTokens,
        slimRuleOverheadTokens: ruleOverheadTokens,
        slimTaskTokens,
        netSavedPerTaskTokens: savedPerTaskTokens,
        netSavedPerTaskPercent: Number(savedPerTaskPct.toFixed(1)),
      },
      costEstimatesUsd: MODEL_PRICING_LIST.map((m) => {
        const beforeSessionUsd =
          ((baselineTaskTokens * tasksPerSession) / 1_000_000) * m.inputPerMillionUsd;
        const afterSessionUsd =
          ((slimTaskTokens * tasksPerSession) / 1_000_000) * m.inputPerMillionUsd;
        const savedSessionUsd = Math.max(0, beforeSessionUsd - afterSessionUsd);
        return {
          model: m.name,
          inputPerMillionUsd: m.inputPerMillionUsd,
          cachedInputPerMillionUsd: m.cachedInputPerMillionUsd,
          before15TaskSessionUsd: Number(beforeSessionUsd.toFixed(4)),
          withCtxSlim15TaskSessionUsd: Number(afterSessionUsd.toFixed(4)),
          savedPer15TaskSessionUsd: Number(savedSessionUsd.toFixed(4)),
        };
      }),
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
    return;
  }

  printBanner();
  log.step('Analyzing repository structure & empirical symbol spans...', cwd);
  console.log('');

  const repoSummaryRows: string[][] = [
    [
      `${c.white('Active Source Codebase')} ${c.gray('(All non-ignored files)')}`,
      `${formatNumber(mapResult.totalFiles)} files`,
      `${formatNumber(mapResult.totalLines)} lines`,
      `${formatNumber(rawSourceTokens)} tok`,
      `Avg file: ~${formatNumber(avgFileTokens)} tok`,
    ],
    [
      `${c.brightCyan('REPO_MAP.md Symbol Index')} ${c.gray(`(${mapResult.totalSymbols} symbols)`)}`,
      '1 file',
      `${formatNumber(mapResult.markdown.split(/\r?\n/).length)} lines`,
      c.brightCyan(`${formatNumber(mapResult.mapTokens)} tok`),
      `Avg symbol span: ${avgSymbolLines}L`,
    ],
    [
      `${c.yellow('Denied Lock/Build Bloat')} ${c.gray('(.claude/settings.json)')}`,
      `${formatNumber(ignoredStats.ignoredFileCount)} files`,
      formatBytes(ignoredStats.lockAndBuildBytes),
      c.yellow(`${formatNumber(ignoredStats.lockAndBuildTokens)} tok`),
      'Blocked via permissions.deny',
    ],
    [
      `${c.gray('Baseline Task Read')} ${c.gray(`(Grep + ${candidateFilesPerTask} full files)`)}`,
      `${candidateFilesPerTask} files`,
      `~${formatNumber(Math.round(( mapResult.totalLines / totalFiles ) * candidateFilesPerTask))} lines`,
      c.yellow(`${formatNumber(baselineTaskTokens)} tok`),
      'Standard agent exploration',
    ],
    [
      `${c.bold(c.brightGreen('ctx-slim Task Read'))} ${c.gray('(Rule + Full Map + 2 slices)')}`,
      `${targetedSlicesCount} slices`,
      `~${formatNumber(avgTargetedSliceLines * targetedSlicesCount)} lines`,
      c.bold(c.brightGreen(`${formatNumber(slimTaskTokens)} tok`)),
      savedPerTaskPct > 0
        ? c.bold(c.brightGreen(`-${savedPerTaskPct.toFixed(1)}% vs ${candidateFilesPerTask}-file read`))
        : c.yellow('Small repo: direct read/grep is cheaper than map'),
    ],
  ];

  console.log(`  ${c.bold('📊 1. Empirical Repository & Task Token Breakdown')}`);
  console.log(
    renderTable(
      ['Layer / Scenario', 'Scope', 'Lines / Size', 'Lexical Tokens', 'Notes'],
      repoSummaryRows,
      ['left', 'right', 'right', 'right', 'left']
    )
  );
  console.log('');

  const costRows: string[][] = MODEL_PRICING_LIST.map((m) => {
    const beforeSessionUsd =
      ((baselineTaskTokens * tasksPerSession) / 1_000_000) * m.inputPerMillionUsd;
    const afterSessionUsd =
      ((slimTaskTokens * tasksPerSession) / 1_000_000) * m.inputPerMillionUsd;
    const savedSessionUsd = Math.max(0, beforeSessionUsd - afterSessionUsd);

    const cachedRate = m.cachedInputPerMillionUsd ?? m.inputPerMillionUsd * 0.1;
    const savedWithCacheUsd =
      (((baselineTaskTokens - slimTaskTokens) * tasksPerSession) / 1_000_000) * cachedRate;

    return [
      `${c.bold(m.name)}`,
      `$${m.inputPerMillionUsd.toFixed(2)} / $${cachedRate.toFixed(2)}`,
      c.yellow(formatUsd(beforeSessionUsd)),
      c.brightCyan(formatUsd(afterSessionUsd)),
      c.brightGreen(formatUsd(savedSessionUsd)),
      c.gray(formatUsd(savedWithCacheUsd)),
    ];
  });

  console.log(
    `  ${c.bold('💰 2. Estimated Input Cost per 15-Task Coding Session')} ${c.gray('(Uncached vs Prompt-Cached)')}`
  );
  console.log(
    renderTable(
      [
        'AI Model',
        'Input (Std / Cached)',
        'Baseline (15 Tasks)',
        'With ctx-slim',
        'Saved (Uncached)',
        'Saved (Cached)',
      ],
      costRows,
      ['left', 'right', 'right', 'right', 'right', 'right']
    )
  );

  console.log('');
  console.log(
    `  ${c.cyan('ℹ')} ${c.bold('Methodology (Heuristic Estimate, Not Live Telemetry)')}: Token counts use lexical BPE approximation. Compares reading ${candidateFilesPerTask} full files (${formatNumber(baselineTaskTokens)} tok) vs ${c.brightCyan('ctx-slim')} rule overhead (${ruleOverheadTokens} tok) + uncapped REPO_MAP.md (${formatNumber(mapResult.mapTokens)} tok) + ${targetedSlicesCount} symbol slices (${avgSymbolLines}L + ±15L buffer = ${formatNumber(avgTargetedSliceTokens)} tok/slice).`
  );
  console.log('');
}

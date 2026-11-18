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
    name: 'Claude Opus 4 / 3.5',
    provider: 'Anthropic',
    inputPerMillionUsd: 15.0,
  },
  {
    name: 'Claude Sonnet 4 / 3.7',
    provider: 'Anthropic',
    inputPerMillionUsd: 3.0,
  },
  {
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    inputPerMillionUsd: 1.25,
  },
  {
    name: 'GPT-4.1 / GPT-4o',
    provider: 'OpenAI',
    inputPerMillionUsd: 2.5,
  },
];

interface IgnoredScanStats {
  ignoredFileCount: number;
  ignoredBytes: number;
  ignoredTokens: number;
}

/**
 * Scans ignored files (lockfiles, dist, build caches, shallow node_modules) to quantify
 * how much bloat is prevented from entering the AI context window.
 */
function scanIgnoredBloat(cwd: string, matcher: IgnoreMatcher): IgnoredScanStats {
  let ignoredFileCount = 0;
  let ignoredBytes = 0;
  const maxFilesToStat = 4000; // Keep CLI instant (<150ms) even with large node_modules

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
      if (entry.name === '.git') continue; // Never count internal git objects as AI prompt files

      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(cwd, fullPath).replace(/\\/g, '/');
      const isIgnored = insideIgnoredDir || matcher.isIgnored(relPath, entry.isDirectory());

      if (entry.isDirectory()) {
        walk(fullPath, depth + 1, isIgnored);
      } else if (entry.isFile() && isIgnored) {
        // Don't count ctx-slim's own generated markdown files as bloat
        if (entry.name === 'REPO_MAP.md' || entry.name === 'CONTEXT_STATE.md') continue;
        try {
          const st = fs.statSync(fullPath);
          ignoredFileCount++;
          ignoredBytes += st.size;
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
  };
}

export function runStatsCommand(options: StatsOptions): void {
  const cwd = path.resolve(options.cwd);
  const matcher = new IgnoreMatcher(cwd);
  const mapResult = buildRepoMap({ cwd, output: 'REPO_MAP.md', quiet: true });
  const ignoredStats = scanIgnoredBloat(cwd, matcher);

  const rawSourceTokens = mapResult.rawCodeTokens;
  const ignoredTokens = ignoredStats.ignoredTokens;
  const unfilteredTotalTokens = rawSourceTokens + ignoredTokens;

  // With ctx-slim: Agent reads REPO_MAP.md + targeted [Lstart-Lend] slice (~12% of active source code on average)
  const targetedSliceTokens = Math.max(
    Math.min(rawSourceTokens, 150),
    Math.round(rawSourceTokens * 0.12)
  );
  const optimizedTurnTokens =
    rawSourceTokens > 0 ? Math.min(rawSourceTokens, mapResult.mapTokens + targetedSliceTokens) : 0;

  // Savings vs Full Active Source Read
  const savedVsSourceTokens = Math.max(0, rawSourceTokens - optimizedTurnTokens);
  const savedVsSourcePct =
    rawSourceTokens > 0 ? (savedVsSourceTokens / rawSourceTokens) * 100 : 0;

  // Savings vs Unfiltered Project (Source + Lockfiles/Dist/Bloat)
  const savedVsUnfilteredTokens = Math.max(0, unfilteredTotalTokens - optimizedTurnTokens);
  const savedVsUnfilteredPct =
    unfilteredTotalTokens > 0 ? (savedVsUnfilteredTokens / unfilteredTotalTokens) * 100 : 0;

  const turnsPerSession = 20;
  const sessionsPerMonth = 100;

  if (options.json) {
    const jsonOutput = {
      project: path.basename(cwd),
      files: {
        activeSourceFiles: mapResult.totalFiles,
        activeSourceLines: mapResult.totalLines,
        mappedSymbols: mapResult.totalSymbols,
        ignoredBloatFiles: ignoredStats.ignoredFileCount,
      },
      tokens: {
        unfilteredTotalTokens,
        ignoredBloatTokens: ignoredTokens,
        activeSourceTokens: rawSourceTokens,
        repoMapTokens: mapResult.mapTokens,
        targetedSliceTokens,
        optimizedTurnTokens,
        savedVsSourceTokens,
        savedVsSourcePercent: Number(savedVsSourcePct.toFixed(2)),
        savedVsUnfilteredTokens,
        savedVsUnfilteredPercent: Number(savedVsUnfilteredPct.toFixed(2)),
      },
      costEstimatesUsd: MODEL_PRICING_LIST.map((m) => {
        const beforePerTurn = (rawSourceTokens / 1_000_000) * m.inputPerMillionUsd;
        const afterPerTurn = (optimizedTurnTokens / 1_000_000) * m.inputPerMillionUsd;
        const savedPerTurn = Math.max(0, beforePerTurn - afterPerTurn);
        return {
          model: m.name,
          pricePerMillionInputUsd: m.inputPerMillionUsd,
          savedPerTurnUsd: Number(savedPerTurn.toFixed(6)),
          savedPer20TurnSessionUsd: Number((savedPerTurn * turnsPerSession).toFixed(4)),
          savedPerMonth100SessionsUsd: Number(
            (savedPerTurn * turnsPerSession * sessionsPerMonth).toFixed(2)
          ),
        };
      }),
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
    return;
  }

  printBanner();
  log.step('Analyzing repository token footprint & cost savings...', cwd);
  console.log('');

  // Table 1: Token Footprint Breakdown
  const footprintRows: string[][] = [
    [
      `${c.red('1. Unfiltered Project')} ${c.gray('(Source + Locks/Build/Cache)')}`,
      formatNumber(mapResult.totalFiles + ignoredStats.ignoredFileCount),
      formatBytes(mapResult.totalBytes + ignoredStats.ignoredBytes),
      c.red(formatNumber(unfilteredTotalTokens) + ' tok'),
      c.gray('Baseline (0% saved)'),
    ],
    [
      `${c.yellow('2. Ignored Bloat Blocked')} ${c.gray('(.claudeignore / .aiignore)')}`,
      formatNumber(ignoredStats.ignoredFileCount),
      formatBytes(ignoredStats.ignoredBytes),
      c.yellow('-' + formatNumber(ignoredTokens) + ' tok'),
      c.yellow('Blocked from AI context'),
    ],
    [
      `${c.white('3. Active Source Code')} ${c.gray('(Full-File Read w/o Map)')}`,
      formatNumber(mapResult.totalFiles),
      formatBytes(mapResult.totalBytes),
      c.white(formatNumber(rawSourceTokens) + ' tok'),
      c.gray('Standard AI Agent Read'),
    ],
    [
      `${c.brightCyan('4. REPO_MAP.md Index')} ${c.gray(`(${mapResult.totalSymbols} symbols w/ [Lstart-Lend])`)}`,
      '1',
      formatBytes(Buffer.byteLength(mapResult.markdown, 'utf8')),
      c.brightCyan(formatNumber(mapResult.mapTokens) + ' tok'),
      c.brightCyan(`${mapResult.savingsPercent.toFixed(1)}% smaller than source`),
    ],
    [
      `${c.bold(c.brightGreen('5. ctx-slim Optimized Turn'))} ${c.gray('(Map + 12% Line Slice)')}`,
      '1–2 slices',
      formatBytes(Math.round( optimizedTurnTokens * 4 )),
      c.bold(c.brightGreen(formatNumber(optimizedTurnTokens) + ' tok')),
      c.bold(
        c.brightGreen(
          `${savedVsSourcePct.toFixed(1)}% vs Source (${savedVsUnfilteredPct.toFixed(1)}% vs Raw)`
        )
      ),
    ],
  ];

  console.log(`  ${c.bold('📊 1. Context & Token Footprint Analysis (approx. chars / 4)')}`);
  console.log(
    renderTable(
      ['Context Layer / Strategy', 'Files', 'Size', 'Est. Tokens', 'Impact / Reduction'],
      footprintRows,
      ['left', 'right', 'right', 'right', 'left']
    )
  );
  console.log('');

  // Table 2: Model Cost & Savings Comparison
  // Compare both:
  // - Savings vs Full Source Read (active files)
  // - Plus we show per-turn, per 20-turn session, and monthly (100 sessions = 2,000 turns)
  // Notice: If the repo also has ignored lockfiles/dist bloat, an unconfigured agent often ingests lockfiles/build files too;
  // we calculate savings based on Active Source Read AND show Effective Total Savings!
  const effectiveBeforeTokens = Math.max(
    rawSourceTokens,
    rawSourceTokens + Math.min(ignoredTokens, 25_000) // Realistic accidental lockfile/build ingestion per turn
  );
  const effectiveSavedPerTurn = Math.max(0, effectiveBeforeTokens - optimizedTurnTokens);

  const costRows: string[][] = MODEL_PRICING_LIST.map((m) => {
    const beforeTurnUsd = (effectiveBeforeTokens / 1_000_000) * m.inputPerMillionUsd;
    const afterTurnUsd = (optimizedTurnTokens / 1_000_000) * m.inputPerMillionUsd;
    const savedTurnUsd = Math.max(0, beforeTurnUsd - afterTurnUsd);
    const savedSessionUsd = savedTurnUsd * turnsPerSession;
    const savedMonthlyUsd = savedSessionUsd * sessionsPerMonth;

    return [
      `${c.bold(m.name)} ${c.gray(`(${m.provider})`)}`,
      `$${m.inputPerMillionUsd.toFixed(2)} / 1M`,
      c.yellow(formatUsd(beforeTurnUsd * turnsPerSession)),
      c.brightCyan(formatUsd(afterTurnUsd * turnsPerSession)),
      c.brightGreen(formatUsd(savedSessionUsd)),
      c.bold(c.brightGreen(formatUsd(savedMonthlyUsd) + '/mo')),
    ];
  });

  console.log(
    `  ${c.bold('💰 2. Estimated USD Savings Across AI Models')} ${c.gray(`(20 turns/session, 100 sessions/mo)`)}`
  );
  console.log(
    renderTable(
      [
        'AI Model',
        'Input Price',
        'Before (20 Turns)',
        'With ctx-slim',
        'Saved / Session',
        'Saved / Month',
      ],
      costRows,
      ['left', 'right', 'right', 'right', 'right', 'right']
    )
  );

  console.log('');
  console.log(
    `  ${c.brightGreen('✔')} ${c.bold('Summary')}: ${c.brightCyan('ctx-slim')} eliminates ${c.bold(formatNumber(ignoredTokens) + ' tokens')} of ignored bloat and saves ${c.bold(formatNumber(effectiveSavedPerTurn * turnsPerSession) + ' tokens')} per 20-turn coding session.`
  );
  console.log('');
}

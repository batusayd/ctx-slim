"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runStatsCommand = runStatsCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ignore_1 = require("../utils/ignore");
const ui_1 = require("../utils/ui");
const map_1 = require("./map");
const MODEL_PRICING_LIST = [
    {
        name: 'Claude Opus 4.5 / 4',
        provider: 'Anthropic',
        inputPerMillionUsd: 15.0,
        cachedInputPerMillionUsd: 1.5,
    },
    {
        name: 'Claude Sonnet 4.5 / 4',
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
function scanIgnoredBloat(cwd, matcher) {
    let ignoredFileCount = 0;
    let ignoredBytes = 0;
    let lockAndBuildBytes = 0;
    const maxFilesToStat = 4000;
    function walk(dir, depth, insideIgnoredDir) {
        if (depth > 5 || ignoredFileCount >= maxFilesToStat)
            return;
        let entries = [];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (ignoredFileCount >= maxFilesToStat)
                break;
            if (entry.name === '.git')
                continue;
            const fullPath = path.join(dir, entry.name);
            const relPath = path.relative(cwd, fullPath).replace(/\\/g, '/');
            const isIgnored = insideIgnoredDir || matcher.isIgnored(relPath, entry.isDirectory());
            if (entry.isDirectory()) {
                walk(fullPath, depth + 1, isIgnored);
            }
            else if (entry.isFile() && isIgnored) {
                if (entry.name === 'REPO_MAP.md' || entry.name === 'CONTEXT_STATE.md')
                    continue;
                try {
                    const st = fs.statSync(fullPath);
                    ignoredFileCount++;
                    ignoredBytes += st.size;
                    if (LOCK_AND_BUNDLE_NAMES.has(entry.name) ||
                        relPath.startsWith('dist/') ||
                        relPath.startsWith('build/') ||
                        entry.name.endsWith('.min.js') ||
                        entry.name.endsWith('.map')) {
                        lockAndBuildBytes += st.size;
                    }
                }
                catch {
                    // Ignore stat errors
                }
            }
        }
    }
    walk(cwd, 0, false);
    return {
        ignoredFileCount,
        ignoredBytes,
        ignoredTokens: (0, ui_1.estimateTokens)(ignoredBytes),
        lockAndBuildBytes,
        lockAndBuildTokens: (0, ui_1.estimateTokens)(lockAndBuildBytes),
    };
}
function runStatsCommand(options) {
    const cwd = path.resolve(options.cwd);
    const matcher = new ignore_1.IgnoreMatcher(cwd);
    const mapResult = (0, map_1.buildRepoMap)({ cwd, output: 'REPO_MAP.md', quiet: true });
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
    const avgSymbolLines = symbolCount > 0 ? Math.round(totalSymbolSpanLines / symbolCount) : 30;
    // Target read window = symbol span + ±15 lines safety buffer
    const avgTargetedSliceLines = avgSymbolLines + 30;
    const avgTargetedSliceTokens = Math.min(avgFileTokens, Math.round(avgTargetedSliceLines * avgTokensPerLine));
    // Realistic Task Modeling:
    // Baseline (No ctx-slim): Agent runs grep/glob and reads ~4 candidate files in full (or all files if repo < 4 files)
    const candidateFilesPerTask = Math.min(totalFiles, 4);
    const baselineTaskTokens = Math.min(rawSourceTokens, avgFileTokens * candidateFilesPerTask);
    // With ctx-slim: Compact CLAUDE.md rule block (~155 tok) + REPO_MAP lookup + 2 targeted symbol range reads
    const ruleOverheadTokens = 155;
    const targetedSlicesCount = Math.min(candidateFilesPerTask, 2);
    const slimTaskTokens = Math.min(baselineTaskTokens, ruleOverheadTokens +
        Math.min(mapResult.mapTokens, 1200) +
        avgTargetedSliceTokens * targetedSlicesCount);
    const savedPerTaskTokens = Math.max(0, baselineTaskTokens - slimTaskTokens);
    const savedPerTaskPct = baselineTaskTokens > 0 ? (savedPerTaskTokens / baselineTaskTokens) * 100 : 0;
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
                const beforeSessionUsd = ((baselineTaskTokens * tasksPerSession) / 1_000_000) * m.inputPerMillionUsd;
                const afterSessionUsd = ((slimTaskTokens * tasksPerSession) / 1_000_000) * m.inputPerMillionUsd;
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
    (0, ui_1.printBanner)();
    ui_1.log.step('Analyzing repository structure & empirical symbol spans...', cwd);
    console.log('');
    const repoSummaryRows = [
        [
            `${ui_1.c.white('Active Source Codebase')} ${ui_1.c.gray('(All non-ignored files)')}`,
            `${(0, ui_1.formatNumber)(mapResult.totalFiles)} files`,
            `${(0, ui_1.formatNumber)(mapResult.totalLines)} lines`,
            `${(0, ui_1.formatNumber)(rawSourceTokens)} tok`,
            `Avg file: ~${(0, ui_1.formatNumber)(avgFileTokens)} tok`,
        ],
        [
            `${ui_1.c.brightCyan('REPO_MAP.md Symbol Index')} ${ui_1.c.gray(`(${mapResult.totalSymbols} symbols)`)}`,
            '1 file',
            `${(0, ui_1.formatNumber)(mapResult.markdown.split(/\r?\n/).length)} lines`,
            ui_1.c.brightCyan(`${(0, ui_1.formatNumber)(mapResult.mapTokens)} tok`),
            `Avg symbol span: ${avgSymbolLines}L`,
        ],
        [
            `${ui_1.c.yellow('Denied Lock/Build Bloat')} ${ui_1.c.gray('(.claude/settings.json)')}`,
            `${(0, ui_1.formatNumber)(ignoredStats.ignoredFileCount)} files`,
            (0, ui_1.formatBytes)(ignoredStats.lockAndBuildBytes),
            ui_1.c.yellow(`${(0, ui_1.formatNumber)(ignoredStats.lockAndBuildTokens)} tok`),
            'Blocked via permissions.deny',
        ],
        [
            `${ui_1.c.gray('Baseline Task Read')} ${ui_1.c.gray(`(Grep + ${candidateFilesPerTask} full files)`)}`,
            `${candidateFilesPerTask} files`,
            `~${(0, ui_1.formatNumber)(Math.round((mapResult.totalLines / totalFiles) * candidateFilesPerTask))} lines`,
            ui_1.c.yellow(`${(0, ui_1.formatNumber)(baselineTaskTokens)} tok`),
            'Standard agent exploration',
        ],
        [
            `${ui_1.c.bold(ui_1.c.brightGreen('ctx-slim Task Read'))} ${ui_1.c.gray('(Rule + Map + 2 symbol slices)')}`,
            `${targetedSlicesCount} slices`,
            `~${(0, ui_1.formatNumber)(avgTargetedSliceLines * targetedSlicesCount)} lines`,
            ui_1.c.bold(ui_1.c.brightGreen(`${(0, ui_1.formatNumber)(slimTaskTokens)} tok`)),
            ui_1.c.bold(ui_1.c.brightGreen(`-${savedPerTaskPct.toFixed(1)}% net input reduction`)),
        ],
    ];
    console.log(`  ${ui_1.c.bold('📊 1. Empirical Repository & Task Token Breakdown')}`);
    console.log((0, ui_1.renderTable)(['Layer / Scenario', 'Scope', 'Lines / Size', 'Lexical Tokens', 'Notes'], repoSummaryRows, ['left', 'right', 'right', 'right', 'left']));
    console.log('');
    const costRows = MODEL_PRICING_LIST.map((m) => {
        const beforeSessionUsd = ((baselineTaskTokens * tasksPerSession) / 1_000_000) * m.inputPerMillionUsd;
        const afterSessionUsd = ((slimTaskTokens * tasksPerSession) / 1_000_000) * m.inputPerMillionUsd;
        const savedSessionUsd = Math.max(0, beforeSessionUsd - afterSessionUsd);
        const cachedRate = m.cachedInputPerMillionUsd ?? m.inputPerMillionUsd * 0.1;
        const savedWithCacheUsd = (((baselineTaskTokens - slimTaskTokens) * tasksPerSession) / 1_000_000) * cachedRate;
        return [
            `${ui_1.c.bold(m.name)}`,
            `$${m.inputPerMillionUsd.toFixed(2)} / $${cachedRate.toFixed(2)}`,
            ui_1.c.yellow((0, ui_1.formatUsd)(beforeSessionUsd)),
            ui_1.c.brightCyan((0, ui_1.formatUsd)(afterSessionUsd)),
            ui_1.c.brightGreen((0, ui_1.formatUsd)(savedSessionUsd)),
            ui_1.c.gray((0, ui_1.formatUsd)(savedWithCacheUsd)),
        ];
    });
    console.log(`  ${ui_1.c.bold('💰 2. Estimated Input Cost per 15-Task Coding Session')} ${ui_1.c.gray('(Uncached vs Prompt-Cached)')}`);
    console.log((0, ui_1.renderTable)([
        'AI Model',
        'Input (Std / Cached)',
        'Baseline (15 Tasks)',
        'With ctx-slim',
        'Saved (Uncached)',
        'Saved (Cached)',
    ], costRows, ['left', 'right', 'right', 'right', 'right', 'right']));
    console.log('');
    console.log(`  ${ui_1.c.cyan('ℹ')} ${ui_1.c.bold('Methodology')}: Token counts use lexical BPE approximation. Task comparison models reading ${candidateFilesPerTask} candidate files in full (${(0, ui_1.formatNumber)(baselineTaskTokens)} tok) vs ${ui_1.c.brightCyan('ctx-slim')} rule overhead (${ruleOverheadTokens} tok) + map lookup + ${targetedSlicesCount} empirical symbol slices (${avgSymbolLines}L + ±15L buffer = ${(0, ui_1.formatNumber)(avgTargetedSliceTokens)} tok/slice).`);
    console.log('');
}

#!/usr/bin/env node
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runStatsCommand = exports.runMapCommand = exports.runInitCommand = exports.runHandoffCommand = exports.runCleanCommand = exports.buildRepoMap = void 0;
const path = __importStar(require("path"));
const clean_1 = require("./commands/clean");
Object.defineProperty(exports, "runCleanCommand", { enumerable: true, get: function () { return clean_1.runCleanCommand; } });
const handoff_1 = require("./commands/handoff");
Object.defineProperty(exports, "runHandoffCommand", { enumerable: true, get: function () { return handoff_1.runHandoffCommand; } });
const init_1 = require("./commands/init");
Object.defineProperty(exports, "runInitCommand", { enumerable: true, get: function () { return init_1.runInitCommand; } });
const map_1 = require("./commands/map");
Object.defineProperty(exports, "buildRepoMap", { enumerable: true, get: function () { return map_1.buildRepoMap; } });
Object.defineProperty(exports, "runMapCommand", { enumerable: true, get: function () { return map_1.runMapCommand; } });
const stats_1 = require("./commands/stats");
Object.defineProperty(exports, "runStatsCommand", { enumerable: true, get: function () { return stats_1.runStatsCommand; } });
const ui_1 = require("./utils/ui");
__exportStar(require("./types"), exports);
const VALUE_FLAGS = new Set(['dir', 'd', 'output', 'o', 'task', 't', 'max-depth']);
function parseCliArgs(argv) {
    const args = argv.slice(2);
    let command = '';
    const flags = {};
    const positionals = [];
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const eqIdx = arg.indexOf('=');
            if (eqIdx !== -1) {
                const key = arg.slice(2, eqIdx);
                const val = arg.slice(eqIdx + 1);
                flags[key] = val;
            }
            else {
                const key = arg.slice(2);
                const next = args[i + 1];
                if (VALUE_FLAGS.has(key) && next && !next.startsWith('-')) {
                    flags[key] = next;
                    i++;
                }
                else {
                    flags[key] = true;
                }
            }
        }
        else if (arg.startsWith('-') && arg.length > 1) {
            const eqIdx = arg.indexOf('=');
            if (eqIdx !== -1) {
                const key = arg.slice(1, eqIdx);
                const val = arg.slice(eqIdx + 1);
                flags[key] = val;
            }
            else {
                const shortKey = arg.slice(1);
                const next = args[i + 1];
                if (VALUE_FLAGS.has(shortKey) && next && !next.startsWith('-')) {
                    flags[shortKey] = next;
                    i++;
                }
                else if (shortKey.length > 1) {
                    for (const ch of shortKey) {
                        flags[ch] = true;
                    }
                }
                else {
                    flags[shortKey] = true;
                }
            }
        }
        else if (!command) {
            command = arg.toLowerCase();
        }
        else {
            positionals.push(arg);
        }
    }
    // If user ran `ctx-slim --global` without specifying `init`, default to `init`
    if (!command && (flags.global || flags.g)) {
        command = 'init';
    }
    return { command, flags, positionals };
}
function printHelp() {
    (0, ui_1.printBanner)();
    console.log(`
  ${ui_1.c.bold('USAGE')}
    ${ui_1.c.brightCyan('npx ctx-slim')} ${ui_1.c.yellow('<command>')} ${ui_1.c.gray('[options]')}

  ${ui_1.c.bold('COMMANDS')}
    ${ui_1.c.brightCyan('init')}       Auto-detect stack, configure ${ui_1.c.white('.claude/settings.json')} (${ui_1.c.cyan('permissions.deny')}),
               non-destructively upsert ${ui_1.c.white('CLAUDE.md')} & ${ui_1.c.white('.antigravity/rules.md')}, and build ${ui_1.c.white('REPO_MAP.md')}
    ${ui_1.c.brightCyan('map')}        Scan codebase & generate ${ui_1.c.white('REPO_MAP.md')} with symbol definitions and ${ui_1.c.cyan('[Lstart-Lend]')} ranges
    ${ui_1.c.brightCyan('watch')}      Live-watch source files and keep ${ui_1.c.white('REPO_MAP.md')} automatically synchronized on save
    ${ui_1.c.brightCyan('handoff')}    Generate/update ${ui_1.c.white('CONTEXT_STATE.md')} (git diff --stat, architecture, active tasks)
    ${ui_1.c.brightCyan('stats')}      Empirical token & cost estimator based on actual repo file & symbol spans
    ${ui_1.c.brightCyan('clean')}      Non-destructively remove ctx-slim blocks, rules & hooks (alias: ${ui_1.c.white('uninstall')})

  ${ui_1.c.bold('OPTIONS')}
    ${ui_1.c.yellow('--global, -g')}        Install/remove rules globally in ${ui_1.c.white('~/.claude/')} & ${ui_1.c.white('~/.antigravity/')} (non-destructive)
    ${ui_1.c.yellow('--with-hooks')}        Install ${ui_1.c.white('.git/hooks/post-commit')} to auto-update REPO_MAP.md (${ui_1.c.cyan('init')})
    ${ui_1.c.yellow('--watch, -w')}         Watch source files for changes and live-update REPO_MAP.md (${ui_1.c.cyan('map')})
    ${ui_1.c.yellow('--force, -f')}         Overwrite existing configuration files (${ui_1.c.cyan('init')})
    ${ui_1.c.yellow('--output, -o <file>')} Custom output path for ${ui_1.c.cyan('map')} or ${ui_1.c.cyan('handoff')}
    ${ui_1.c.yellow('--task <text>')}       Add a priority active task item when running ${ui_1.c.cyan('handoff')}
    ${ui_1.c.yellow('--max-depth <n>')}     Maximum directory traversal depth for ${ui_1.c.cyan('map')} (default: 8)
    ${ui_1.c.yellow('--dir, -d <path>')}    Target project directory (default: current working directory)
    ${ui_1.c.yellow('--json')}              Output raw JSON metrics (${ui_1.c.cyan('stats')})
    ${ui_1.c.yellow('--quiet, -q')}         Suppress terminal banner and progress logs
    ${ui_1.c.yellow('--help, -h')}          Show this help message
    ${ui_1.c.yellow('--version, -v')}       Show CLI version

  ${ui_1.c.bold('EXAMPLES')}
    ${ui_1.c.gray('$')} npx ctx-slim init --with-hooks
    ${ui_1.c.gray('$')} npx ctx-slim map
    ${ui_1.c.gray('$')} npx ctx-slim handoff --task "Refactor JWT middleware"
    ${ui_1.c.gray('$')} npx ctx-slim stats
    ${ui_1.c.gray('$')} npx ctx-slim clean
`);
}
function main() {
    const { command, flags } = parseCliArgs(process.argv);
    if (flags.version || flags.v) {
        console.log('1.0.0');
        return;
    }
    if (!command || command === 'help' || flags.help || flags.h) {
        printHelp();
        return;
    }
    const targetDir = typeof flags.dir === 'string'
        ? path.resolve(flags.dir)
        : typeof flags.d === 'string'
            ? path.resolve(flags.d)
            : process.cwd();
    const quiet = Boolean(flags.quiet || flags.q);
    try {
        switch (command) {
            case 'init': {
                (0, init_1.runInitCommand)({
                    cwd: targetDir,
                    withHooks: Boolean(flags['with-hooks'] || flags.hooks),
                    force: Boolean(flags.force || flags.f),
                    global: Boolean(flags.global || flags.g),
                    quiet,
                });
                break;
            }
            case 'map':
            case 'watch': {
                const output = typeof flags.output === 'string'
                    ? flags.output
                    : typeof flags.o === 'string'
                        ? flags.o
                        : 'REPO_MAP.md';
                const maxDepth = typeof flags['max-depth'] === 'string' ? parseInt(flags['max-depth'], 10) : 8;
                (0, map_1.runMapCommand)({
                    cwd: targetDir,
                    output,
                    maxDepth: Number.isNaN(maxDepth) ? 8 : maxDepth,
                    watch: command === 'watch' || Boolean(flags.watch || flags.w),
                    quiet,
                });
                break;
            }
            case 'handoff': {
                const output = typeof flags.output === 'string'
                    ? flags.output
                    : typeof flags.o === 'string'
                        ? flags.o
                        : 'CONTEXT_STATE.md';
                const task = typeof flags.task === 'string'
                    ? flags.task
                    : typeof flags.t === 'string'
                        ? flags.t
                        : undefined;
                (0, handoff_1.runHandoffCommand)({
                    cwd: targetDir,
                    output,
                    task,
                    quiet,
                });
                break;
            }
            case 'stats': {
                (0, stats_1.runStatsCommand)({
                    cwd: targetDir,
                    json: Boolean(flags.json),
                });
                break;
            }
            case 'clean':
            case 'uninstall':
            case 'remove': {
                (0, clean_1.runCleanCommand)({
                    cwd: targetDir,
                    force: Boolean(flags.force || flags.f),
                    global: Boolean(flags.global || flags.g),
                    quiet,
                });
                break;
            }
            default: {
                (0, ui_1.printBanner)();
                ui_1.log.error(`Unknown command: ${ui_1.c.bold(command)}`);
                console.log(`  Run ${ui_1.c.brightCyan('npx ctx-slim --help')} for available commands.\n`);
                process.exitCode = 1;
            }
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ui_1.log.error(`Execution failed: ${message}`);
        process.exitCode = 1;
    }
}
if (require.main === module) {
    main();
}

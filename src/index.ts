#!/usr/bin/env node

import * as path from 'path';
import { runCleanCommand } from './commands/clean';
import { runHandoffCommand } from './commands/handoff';
import { runInitCommand } from './commands/init';
import { buildRepoMap, runMapCommand } from './commands/map';
import { runStatsCommand } from './commands/stats';
import { c, log, printBanner } from './utils/ui';

export {
  buildRepoMap,
  runCleanCommand,
  runHandoffCommand,
  runInitCommand,
  runMapCommand,
  runStatsCommand,
};
export * from './types';

interface ParsedArgs {
  command: string;
  flags: Record<string, string | boolean>;
  positionals: string[];
}

function parseCliArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  let command = '';
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        const key = arg.slice(2, eqIdx);
        const val = arg.slice(eqIdx + 1);
        flags[key] = val;
      } else {
        const key = arg.slice(2);
        const next = args[i + 1];
        if (next && !next.startsWith('-')) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      const shortKey = arg.slice(1);
      flags[shortKey] = true;
    } else if (!command) {
      command = arg.toLowerCase();
    } else {
      positionals.push(arg);
    }
  }

  return { command, flags, positionals };
}

function printHelp(): void {
  printBanner();
  console.log(`
  ${c.bold('USAGE')}
    ${c.brightCyan('npx ctx-slim')} ${c.yellow('<command>')} ${c.gray('[options]')}

  ${c.bold('COMMANDS')}
    ${c.brightCyan('init')}       Auto-detect stack, generate ${c.white('.claudeignore')}, ${c.white('.antigravityignore')}, ${c.white('.aiignore')},
               ${c.white('CLAUDE.md')}, ${c.white('.antigravity/rules.md')}, slash commands & initial ${c.white('REPO_MAP.md')}
    ${c.brightCyan('map')}        Scan codebase & generate ${c.white('REPO_MAP.md')} with symbol definitions and ${c.cyan('[Lstart-Lend]')} ranges
    ${c.brightCyan('handoff')}    Generate/update ${c.white('CONTEXT_STATE.md')} (git diff --stat, architecture, active tasks)
    ${c.brightCyan('stats')}      Calculate token & USD savings across Claude Opus/Sonnet, Gemini Pro & GPT-4
    ${c.brightCyan('clean')}      Remove all ctx-slim generated files, rules & Git hooks from the project (alias: ${c.white('uninstall')})

  ${c.bold('OPTIONS')}
    ${c.yellow('--global, -g')}        Install/remove rules globally in ${c.white('~/.claude/')} & ${c.white('~/.antigravity/')} for ALL projects
    ${c.yellow('--with-hooks')}        Install ${c.white('.git/hooks/post-commit')} to auto-update REPO_MAP.md (${c.cyan('init')})
    ${c.yellow('--force, -f')}         Overwrite existing configuration files (${c.cyan('init')})
    ${c.yellow('--output, -o <file>')} Custom output path for ${c.cyan('map')} or ${c.cyan('handoff')}
    ${c.yellow('--task <text>')}       Add a priority active task item when running ${c.cyan('handoff')}
    ${c.yellow('--max-depth <n>')}     Maximum directory traversal depth for ${c.cyan('map')} (default: 8)
    ${c.yellow('--dir, -d <path>')}    Target project directory (default: current working directory)
    ${c.yellow('--json')}              Output raw JSON metrics (${c.cyan('stats')})
    ${c.yellow('--quiet, -q')}         Suppress terminal banner and progress logs
    ${c.yellow('--help, -h')}          Show this help message
    ${c.yellow('--version, -v')}       Show CLI version

  ${c.bold('EXAMPLES')}
    ${c.gray('$')} npx ctx-slim init --with-hooks
    ${c.gray('$')} npx ctx-slim map
    ${c.gray('$')} npx ctx-slim handoff --task "Refactor JWT middleware"
    ${c.gray('$')} npx ctx-slim stats
    ${c.gray('$')} npx ctx-slim clean
`);
}

function main(): void {
  const { command, flags } = parseCliArgs(process.argv);

  if (flags.version || flags.v) {
    console.log('1.0.0');
    return;
  }

  if (!command || command === 'help' || flags.help || flags.h) {
    printHelp();
    return;
  }

  const targetDir =
    typeof flags.dir === 'string'
      ? path.resolve(flags.dir)
      : typeof flags.d === 'string'
        ? path.resolve(flags.d)
        : process.cwd();

  const quiet = Boolean(flags.quiet || flags.q);

  try {
    switch (command) {
      case 'init': {
        runInitCommand({
          cwd: targetDir,
          withHooks: Boolean(flags['with-hooks'] || flags.hooks),
          force: Boolean(flags.force || flags.f),
          global: Boolean(flags.global || flags.g),
          quiet,
        });
        break;
      }

      case 'map': {
        const output =
          typeof flags.output === 'string'
            ? flags.output
            : typeof flags.o === 'string'
              ? flags.o
              : 'REPO_MAP.md';
        const maxDepth =
          typeof flags['max-depth'] === 'string' ? parseInt(flags['max-depth'], 10) : 8;
        runMapCommand({
          cwd: targetDir,
          output,
          maxDepth: Number.isNaN(maxDepth) ? 8 : maxDepth,
          quiet,
        });
        break;
      }

      case 'handoff': {
        const output =
          typeof flags.output === 'string'
            ? flags.output
            : typeof flags.o === 'string'
              ? flags.o
              : 'CONTEXT_STATE.md';
        const task = typeof flags.task === 'string' ? flags.task : undefined;
        runHandoffCommand({
          cwd: targetDir,
          output,
          task,
          quiet,
        });
        break;
      }

      case 'stats': {
        runStatsCommand({
          cwd: targetDir,
          json: Boolean(flags.json),
        });
        break;
      }

      case 'clean':
      case 'uninstall':
      case 'remove': {
        runCleanCommand({
          cwd: targetDir,
          force: Boolean(flags.force || flags.f),
          global: Boolean(flags.global || flags.g),
          quiet,
        });
        break;
      }

      default: {
        printBanner();
        log.error(`Unknown command: ${c.bold(command)}`);
        console.log(`  Run ${c.brightCyan('npx ctx-slim --help')} for available commands.\n`);
        process.exitCode = 1;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Execution failed: ${message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

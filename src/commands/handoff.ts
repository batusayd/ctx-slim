import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { HandoffOptions } from '../types';
import { detectStacks } from '../utils/detector';
import { c, estimateTokens, formatNumber, log, printBanner } from '../utils/ui';
import { buildRepoMap } from './map';

function runGitSafe(cwd: string, args: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function extractExistingSection(existingContent: string, headingPrefix: string): string | null {
  const lines = existingContent.split(/\r?\n/);
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith(headingPrefix)) {
      startIdx = i + 1;
      break;
    }
  }
  if (startIdx === -1) return null;

  const sectionLines: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].trim().startsWith('## ')) {
      break;
    }
    sectionLines.push(lines[i]);
  }

  const joined = sectionLines.join('\n').trim();
  return joined.length > 0 ? joined : null;
}

export function runHandoffCommand(options: HandoffOptions): void {
  const cwd = path.resolve(options.cwd);
  const projectName = path.basename(cwd);
  const outPath = path.resolve(cwd, options.output || 'CONTEXT_STATE.md');

  if (!options.quiet) {
    printBanner();
    log.step('Building session handoff state in', outPath);
  }

  const stacks = detectStacks(cwd);
  const stackSummary =
    stacks.length > 0 ? stacks.map((s) => s.name).join(', ') : 'Polyglot / General Software';

  // Ensure REPO_MAP.md is up to date too
  const mapResult = buildRepoMap({ cwd, output: 'REPO_MAP.md', quiet: true });
  const repoMapPath = path.join(cwd, 'REPO_MAP.md');
  if (!fs.existsSync(repoMapPath)) {
    fs.writeFileSync(repoMapPath, mapResult.markdown, 'utf8');
  }

  // Gather Git metadata
  const branch = runGitSafe(cwd, 'rev-parse --abbrev-ref HEAD') || 'N/A (not a git repo or no commits)';
  const lastCommit = runGitSafe(cwd, 'log -1 --oneline') || 'No commits yet';
  const diffStatUnstaged = runGitSafe(cwd, 'diff --stat');
  const diffStatStaged = runGitSafe(cwd, 'diff --cached --stat');
  const lastCommitDiffStat = runGitSafe(cwd, 'show --stat --oneline -1');
  const statusShort = runGitSafe(cwd, 'status --short');

  let gitDiffBlock = '';
  if (diffStatUnstaged || diffStatStaged) {
    gitDiffBlock = [
      diffStatStaged ? `# Staged Changes:\n${diffStatStaged}` : '',
      diffStatUnstaged ? `# Unstaged Working Tree Changes:\n${diffStatUnstaged}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  } else if (lastCommitDiffStat) {
    gitDiffBlock = `# Working tree clean. Latest commit diffstat:\n${lastCommitDiffStat}`;
  } else {
    gitDiffBlock = 'No git diff statistics available (repository not initialized or clean with no commits).';
  }

  const statusBlock = statusShort || 'Working tree clean (or untracked repository).';

  // Top modules summary from RepoMap
  const topFiles = [...mapResult.entries]
    .sort((a, b) => b.symbols.length - a.symbols.length || b.lineCount - a.lineCount)
    .slice(0, 12);

  const archLines =
    topFiles.length > 0
      ? topFiles.map((f) => {
          const symPreview = f.symbols
            .slice(0, 4)
            .map((s) => `\`${s.name}\` [L${s.lineStart}-L${s.lineEnd}]`)
            .join(', ');
          const moreCount = f.symbols.length > 4 ? ` (+${f.symbols.length - 4} more)` : '';
          return `- **\`${f.relativePath}\`** (${f.lineCount}L, ~${f.estimatedTokens} tok): ${symPreview || '_module/config_'}${moreCount}`;
        })
      : ['- _No source files indexed yet._'];

  // Preserve user-edited sections if CONTEXT_STATE.md already exists
  let existingContent = '';
  if (fs.existsSync(outPath)) {
    try {
      existingContent = fs.readFileSync(outPath, 'utf8');
    } catch {
      existingContent = '';
    }
  }

  const defaultDecisions = [
    '- **Zero-Dependency / Minimal Footprint**: Keep external dependencies to a minimum.',
    '- **REPO_MAP-First Protocol**: Always locate `[Lstart-Lend]` in `REPO_MAP.md` before reading source files.',
    '- **Diff-Only Edits**: Apply surgical line-range edits; avoid full-file rewrites.',
  ].join('\n');

  const defaultTasks = [
    options.task ? `- [ ] **Current Priority**: ${options.task}` : '- [ ] _Add current in-progress task here_',
    '- [ ] Verify build and test suite after changes',
    '- [ ] Run `npx ctx-slim map` to keep `REPO_MAP.md` synchronized',
  ].join('\n');

  const preservedDecisions =
    extractExistingSection(existingContent, '## 3. Architectural Decisions') ?? defaultDecisions;

  let preservedTasks =
    extractExistingSection(existingContent, '## 4. Active Tasks') ?? defaultTasks;

  if (options.task && !preservedTasks.includes(options.task)) {
    preservedTasks = `- [ ] **${options.task}**\n` + preservedTasks;
  }

  const nowIso = new Date().toISOString();

  const content = `# CONTEXT_STATE.md — Session Handoff & Architectural State

> **Project**: \`${projectName}\`
> **Stack**: ${stackSummary}
> **Snapshot Time**: \`${nowIso}\`
> **Branch**: \`${branch}\` | **HEAD**: \`${lastCommit}\`

---

## 1. Architecture & Core Module Snapshot

- **Indexed Files**: ${formatNumber(mapResult.totalFiles)} files (${formatNumber(mapResult.totalLines)} lines)
- **Mapped Symbols**: ${formatNumber(mapResult.totalSymbols)} symbols in \`REPO_MAP.md\` (~${formatNumber(mapResult.mapTokens)} tokens vs ~${formatNumber(mapResult.rawCodeTokens)} raw code tokens)

### Key Modules & Symbol Ranges
${archLines.join('\n')}

---

## 2. Recent Changes (\`git status\` & \`git diff --stat\`)

### Working Tree Status
\`\`\`text
${statusBlock}
\`\`\`

### Diff Statistics (\`git diff --stat\`)
\`\`\`text
${gitDiffBlock}
\`\`\`

---

## 3. Architectural Decisions & Constraints

${preservedDecisions}

---

## 4. Active Tasks & Next Steps

${preservedTasks}

---

## 5. Quick Resume Prompt (Copy & Paste into New Chat)

\`\`\`text
Read CONTEXT_STATE.md and REPO_MAP.md first. Follow CLAUDE.md / .antigravity/rules.md (Diff-Only output, Zero-Fluff, and targeted [Lstart-Lend] file reads). Resume from Section 4 (Active Tasks) of CONTEXT_STATE.md.
\`\`\`
`;

  fs.writeFileSync(outPath, content, 'utf8');
  const stateTokens = estimateTokens(content.length);

  if (!options.quiet) {
    console.log('');
    log.success(
      `Generated ${c.bold(c.brightCyan(path.relative(cwd, outPath) || 'CONTEXT_STATE.md'))} ${c.gray(`(~${formatNumber(stateTokens)} tokens)`)}`
    );
    console.log(`    ${c.gray('├─')} Git Branch     : ${c.cyan(branch)}`);
    console.log(`    ${c.gray('├─')} Latest Commit  : ${c.gray(lastCommit)}`);
    console.log(
      `    ${c.gray('└─')} Resume Prompt  : ${c.brightGreen('Ready to paste into a fresh Claude Code / Antigravity chat!')}`
    );
    console.log('');
  }
}

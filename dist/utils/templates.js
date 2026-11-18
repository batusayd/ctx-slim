"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CTX_SLIM_END_MARKER = exports.CTX_SLIM_START_MARKER = void 0;
exports.generateClaudeMd = generateClaudeMd;
exports.generateAntigravityRulesMd = generateAntigravityRulesMd;
exports.generateClaudeSlashCommands = generateClaudeSlashCommands;
exports.getClaudeSettingsDenyRules = getClaudeSettingsDenyRules;
exports.generatePostCommitHook = generatePostCommitHook;
exports.CTX_SLIM_START_MARKER = '<!-- ctx-slim:start -->';
exports.CTX_SLIM_END_MARKER = '<!-- ctx-slim:end -->';
/**
 * Generates an ultra-compact (~150 tokens) rule block wrapped in non-destructive markers.
 * Zero supply-chain risk: never instructs the agent to run `npx --yes` or fetch remote code.
 */
function generateClaudeMd(projectName, stacks) {
    const stackLabel = stacks.length > 0 ? stacks.map((s) => s.name).join(', ') : 'General Software';
    return `${exports.CTX_SLIM_START_MARKER}
## ContextSlim (\`ctx-slim\`) — Context & Token Protocol (${projectName} | ${stackLabel})

1. **Symbol-First Navigation (\`REPO_MAP.md\`)**:
   - Before reading unfamiliar source files, check \`REPO_MAP.md\` (if present) to locate target symbols and \`[Lstart-Lend]\` ranges.
   - Read targeted line ranges (±15 lines buffer) instead of entire large files.
   - *Staleness note*: After editing a file in-session, its line numbers shift below the edit; rely on your edit offset or refresh the map via local \`ctx-slim map --quiet\` (if installed locally).
2. **Surgical Edits & Concise Rationale**:
   - Use targeted edit tools or minimal unified diffs. Never reprint unchanged functions or full files.
   - Skip conversational filler, but **always include a 1–2 line technical rationale** when fixing bugs or making non-obvious trade-offs.
3. **Session Handoff**:
   - If \`CONTEXT_STATE.md\` exists, check it at session start for active tasks and recent changes.
   - Slash shortcuts: \`/diff\` (diff-only output), \`/plan-lite\` (<=10-line file/range plan), \`/handoff\` (update \`CONTEXT_STATE.md\`), \`/slim\` (refresh local \`REPO_MAP.md\`).
${exports.CTX_SLIM_END_MARKER}
`;
}
function generateAntigravityRulesMd(projectName, stacks) {
    const stackLabel = stacks.length > 0 ? stacks.map((s) => s.name).join(', ') : 'General Software';
    return `${exports.CTX_SLIM_START_MARKER}
## ContextSlim (\`ctx-slim\`) — Antigravity Protocol (${projectName} | ${stackLabel})

- **Targeted Line Reads**: Check \`REPO_MAP.md\` (when present) for \`[Lstart-Lend]\` symbol ranges and pass \`StartLine\`/\`EndLine\` (±15 lines buffer) to \`read_file\` instead of reading large files in full. Note that in-session edits shift subsequent line numbers in that file.
- **Minimal Diffs + Brief Root Cause**: Use \`edit_file\` with minimal target blocks. Never paste full unmodified files in chat. Include a brief 1–2 line root-cause note for bugfixes.
- **Session State**: Check \`CONTEXT_STATE.md\` (if present) for session continuity.
- **Shortcuts**: \`/diff\` (surgical diff mode), \`/plan-lite\` (<=10-line \`file#Lstart-Lend\` plan), \`/handoff\` (update \`CONTEXT_STATE.md\`), \`/slim\` (refresh local \`REPO_MAP.md\`).
${exports.CTX_SLIM_END_MARKER}
`;
}
function generateClaudeSlashCommands() {
    return {
        'diff.md': `Apply or output ONLY the minimal unified diff or targeted edit for this task, plus at most a 1-line technical rationale if non-obvious.
1. If \`REPO_MAP.md\` exists, locate the target \`[Lstart-Lend]\` symbol range first.
2. Read only the relevant line range (±15 lines).
3. Do not repeat unchanged code or include conversational filler.

Task: $ARGUMENTS
`,
        'plan-lite.md': `Create a compact (<=10 lines) technical execution plan before modifying any files:
1. Check \`REPO_MAP.md\` (if present) to identify affected files, symbols, and \`[Lstart-Lend]\` ranges.
2. List each target as \`file:Lstart-Lend -> planned change\`.
3. Note any edge cases or risks in 1–2 bullets and wait for confirmation.

Task: $ARGUMENTS
`,
        'handoff.md': `Prepare this session for a clean context reset (\`/clear\`):
1. If \`ctx-slim\` is installed locally (\`command -v ctx-slim\`), run \`ctx-slim handoff\`; otherwise update \`CONTEXT_STATE.md\` directly using \`git status --short\` and \`git diff --stat\`.
2. Record Completed Changes, Key Architectural Decisions, and Next Immediate Steps inside \`CONTEXT_STATE.md\`.
3. Output a 3-line confirmation so the session can be cleared safely.
`,
        'slim.md': `Refresh local repository map and inspect context footprint:
1. If \`ctx-slim\` is installed locally (\`command -v ctx-slim\`), run \`ctx-slim map\` and \`ctx-slim stats\`.
2. Summarize the active file count and symbol map coverage in 2 lines.
`,
    };
}
/**
 * Generates official Claude Code `.claude/settings.json` `permissions.deny` rules
 * so Claude Code is prevented at the tool permission layer from reading lockfiles and build bloat.
 */
function getClaudeSettingsDenyRules(stacks) {
    const rules = new Set([
        'Read(package-lock.json)',
        'Read(pnpm-lock.yaml)',
        'Read(yarn.lock)',
        'Read(bun.lockb)',
        'Read(bun.lock)',
        'Read(Cargo.lock)',
        'Read(poetry.lock)',
        'Read(Pipfile.lock)',
        'Read(uv.lock)',
        'Read(go.sum)',
        'Read(composer.lock)',
        'Read(Gemfile.lock)',
        'Read(dist/**)',
        'Read(build/**)',
        'Read(coverage/**)',
        'Read(*.min.js)',
        'Read(*.min.css)',
        'Read(*.bundle.js)',
        'Read(*.map)',
        'Read(*.tsbuildinfo)',
    ]);
    const stackIds = new Set(stacks.map((s) => s.id));
    if (stackIds.has('node-ts') || stackIds.size === 0) {
        rules.add('Read(node_modules/**)');
        rules.add('Read(.next/**)');
        rules.add('Read(.nuxt/**)');
        rules.add('Read(.turbo/**)');
    }
    if (stackIds.has('python')) {
        rules.add('Read(__pycache__/**)');
        rules.add('Read(.venv/**)');
        rules.add('Read(venv/**)');
        rules.add('Read(.pytest_cache/**)');
    }
    if (stackIds.has('rust') || stackIds.has('java-kotlin')) {
        rules.add('Read(target/**)');
    }
    if (stackIds.has('php') || stackIds.has('go') || stackIds.has('ruby')) {
        rules.add('Read(vendor/**)');
    }
    return Array.from(rules);
}
/**
 * Generates a safe post-commit hook that NEVER executes an arbitrary `./dist/index.js` in the user's repo.
 * It resolves either global `ctx-slim`, local `./node_modules/.bin/ctx-slim`, or the verified CLI installation path.
 */
function generatePostCommitHook(verifiedCliPath) {
    const escapedCliPath = verifiedCliPath ? verifiedCliPath.replace(/\\/g, '/') : '';
    const fallbackClause = escapedCliPath
        ? `elif [ -f "${escapedCliPath}" ]; then\n  node "${escapedCliPath}" map --quiet >/dev/null 2>&1 &`
        : '';
    return `#!/bin/sh
# ============================================================================
# ctx-slim post-commit hook
# Automatically updates REPO_MAP.md after every git commit
# ============================================================================

if command -v ctx-slim >/dev/null 2>&1; then
  ctx-slim map --quiet >/dev/null 2>&1 &
elif [ -x "./node_modules/.bin/ctx-slim" ]; then
  ./node_modules/.bin/ctx-slim map --quiet >/dev/null 2>&1 &
${fallbackClause}
fi

exit 0
`;
}

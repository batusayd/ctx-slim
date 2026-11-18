import { DetectedStack } from '../types';

export function generateClaudeMd(projectName: string, stacks: DetectedStack[]): string {
  const stackLabel =
    stacks.length > 0 ? stacks.map((s) => s.name).join(', ') : 'Polyglot / General Software';

  return `# CLAUDE.md — AI Context & Token Optimization Rules (ctx-slim)

> **Project**: \`${projectName}\`
> **Detected Stack**: ${stackLabel}
> **Optimization Engine**: \`ctx-slim\` (Active)

---

## 1. MANDATORY: REPO_MAP-First Navigation (Never Read Full Files Blindly)

1. **Always check \`REPO_MAP.md\` first** before opening or reading any source file.
2. \`REPO_MAP.md\` contains the complete directory tree and every function, class, interface, struct, and export with **exact line ranges** (\`[Lstart-Lend]\`).
3. **Targeted Line-Range Reads Only**:
   - Once you locate the target symbol in \`REPO_MAP.md\` (e.g., \`parseFileSymbols [L142-L168]\`), read **only** that specific line range (plus ±10 lines of context if needed).
   - **NEVER** read an entire >150-line file when you only need a single function or class method.
4. Respect \`.claudeignore\` and \`.aiignore\` at all times. Never inspect lockfiles, \`node_modules/\`, \`dist/\`, \`target/\`, or build artifacts.

---

## 2. MANDATORY: Diff-Only Output Format

1. **Never output full unmodified files** in chat responses.
2. When proposing or applying code changes, use **only**:
   - Native targeted edit tools (replacing exact target blocks), OR
   - Minimal unified diffs / \`SEARCH / REPLACE\` blocks showing **only** the changed lines and 2–3 lines of surrounding context:
     \`\`\`diff
     @@ -42,4 +42,5 @@
      export function calculateTotal(items: Item[]): number {
     -  return items.reduce((sum, i) => sum + i.price, 0);
     +  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      }
     \`\`\`
3. Do not repeat unchanged functions, imports, or boilerplate code.

---

## 3. MANDATORY: Zero-Fluff Communication Protocol

1. **No conversational filler**: Skip greetings, apologies, praise ("Great question!", "Certainly!"), and closing pleasantries.
2. **No code narration**: Do not explain what the diff you just wrote does unless there is a non-obvious architectural trade-off or edge case.
3. **Direct technical output**: Lead immediately with the file path, line range, and action taken. Keep explanations under 3 bullet points maximum.

---

## 4. Slash Commands (\`/diff\`, \`/plan-lite\`, \`/handoff\`, \`/slim\`)

When the user invokes any of the following slash commands, strictly execute the corresponding protocol:

### \`/diff\`
- **Action**: Switch to strict **100% Diff-Only + Zero-Prose Mode**.
- **Output**: Output ONLY the code diff or tool edit calls. Zero introductory text, zero summary text.

### \`/plan-lite\`
- **Action**: Create an ultra-compact implementation plan using \`REPO_MAP.md\` without modifying files yet.
- **Output Format** (Max 10 lines total):
  - \`[File Path] (Lstart-Lend)\` → Symbol to modify + 1-line technical change description.
  - Estimated token impact & risk level (\`LOW | MED | HIGH\`).

### \`/handoff\`
- **Action**: Prepare the session for a clean context window reset.
- **Steps**:
  1. Run \`npx ctx-slim handoff\` to update \`CONTEXT_STATE.md\` with current git status, diff stats, and architecture state.
  2. Populate the **Active Tasks**, **Completed Changes**, and **Next Immediate Step** sections inside \`CONTEXT_STATE.md\`.
  3. Output a single 3-line summary telling the user they can clear context (\`/clear\`) and resume from \`CONTEXT_STATE.md\`.

### \`/slim\`
- **Action**: Synchronize and audit repository token hygiene.
- **Steps**:
  1. Run \`npx ctx-slim map\` to refresh \`REPO_MAP.md\`.
  2. Run \`npx ctx-slim stats\` to report current token & USD savings.
  3. Confirm active adherence to REPO_MAP-First, Diff-Only, and Zero-Fluff protocols.
`;
}

export function generateAntigravityRulesMd(projectName: string, stacks: DetectedStack[]): string {
  const stackLabel =
    stacks.length > 0 ? stacks.map((s) => s.name).join(', ') : 'Polyglot / General Software';

  return `---
trigger: always_on
description: ctx-slim AI Token Optimization & Context Management Rules for ${projectName}
---

# Antigravity Agent Rules — ctx-slim Optimization Engine

> **Project**: \`${projectName}\` | **Stack**: ${stackLabel}

## 1. REPO_MAP-First File Reading Protocol (Critical Token Saver)

- **Always inspect \`REPO_MAP.md\` first** before calling \`read_file\` on source files.
- \`REPO_MAP.md\` indexes every file, class, interface, and function with **exact \`[Lstart-Lend]\` line numbers**.
- When calling \`read_file\`, **always pass \`StartLine\` and \`EndLine\`** matching the symbol range from \`REPO_MAP.md\` instead of reading entire files from line 1 to EOF.
- If \`CONTEXT_STATE.md\` exists in the workspace root, read it at the start of a new conversation to restore architectural context and active tasks immediately.
- Never read files listed in \`.antigravityignore\` or \`.aiignore\`.

## 2. Mandatory Diff-Only Edits & Output

- Always use \`edit_file\` with minimal, surgical \`Target\` and \`Replacement\` blocks rather than overwriting entire files with \`write_file\`.
- In chat responses, **never paste full unmodified files**. Show only concise diffs or link directly to \`[filename](file:///path#Lstart-Lend)\`.

## 3. Zero-Fluff Technical Output

- Eliminate conversational filler, preambles, and repetitive post-task summaries.
- State only:
  1. Exact files and line ranges modified.
  2. Verification result (build/test status).
  3. Any blocking technical decisions required.

## 4. Built-in Slash Command Protocols

Recognize and execute these user triggers immediately:

- **\`/diff\`**: Respond exclusively with surgical code edits/diffs and zero prose explanation.
- **\`/plan-lite\`**: Consult \`REPO_MAP.md\` and output a <=10-line bulleted execution plan listing exact \`file#Lstart-Lend\` targets before writing code.
- **\`/handoff\`**: Run \`npx ctx-slim handoff\`, update \`CONTEXT_STATE.md\` with completed tasks and next steps, and output a 1-block handoff prompt for the next session.
- **\`/slim\`**: Run \`npx ctx-slim map && npx ctx-slim stats\` to rebuild \`REPO_MAP.md\` and display the token/cost optimization report.
`;
}

export function generateClaudeSlashCommands(): Record<string, string> {
  return {
    'diff.md': `Switch to strict Diff-Only + Zero-Fluff mode for this request.
1. Consult \`REPO_MAP.md\` to find exact symbol line ranges (\`Lstart-Lend\`).
2. Read only those line ranges.
3. Apply or output ONLY the minimal unified diff. Do not include any conversational preamble or post-summary.

Task: $ARGUMENTS
`,
    'plan-lite.md': `Create an ultra-compact (<10 lines) technical execution plan without modifying files yet:
1. Read \`REPO_MAP.md\` to identify the exact files, functions, and \`[Lstart-Lend]\` ranges affected.
2. Output a bulleted list of \`file:Lstart-Lend -> change summary\`.
3. State estimated token impact and wait for confirmation.

Task: $ARGUMENTS
`,
    'handoff.md': `Prepare this session for a zero-loss context handoff:
1. Execute \`npx ctx-slim handoff\` to refresh \`CONTEXT_STATE.md\`.
2. Update the Active Tasks, Key Architectural Decisions, and Next Session Prompt sections in \`CONTEXT_STATE.md\`.
3. Output a 3-line confirmation so I can run \`/clear\` and resume cleanly.
`,
    'slim.md': `Refresh and audit ctx-slim token optimization:
1. Execute \`npx ctx-slim map\` to update \`REPO_MAP.md\` with current symbol line numbers.
2. Execute \`npx ctx-slim stats\` to display token and USD savings.
3. Summarize the current repo map compression ratio in 2 lines.
`,
  };
}

export function generatePostCommitHook(): string {
  return `#!/bin/sh
# ============================================================================
# ctx-slim post-commit hook
# Automatically updates REPO_MAP.md after every git commit
# ============================================================================

if command -v ctx-slim >/dev/null 2>&1; then
  ctx-slim map --quiet >/dev/null 2>&1 &
elif [ -f "./dist/index.js" ]; then
  node ./dist/index.js map --quiet >/dev/null 2>&1 &
elif command -v npx >/dev/null 2>&1; then
  npx --no-install ctx-slim map --quiet >/dev/null 2>&1 &
fi

exit 0
`;
}

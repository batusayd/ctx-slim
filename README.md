<div align="center">

# ⚡ ContextSlim (`ctx-slim`)

### **Zero-Dependency AI Context & Token Optimizer for Claude Code & Antigravity**
*Symbol-Range Repo Mapper • Official `.claude/settings.json` Deny Rules • Session Handoff CLI*

[![Version](https://img.shields.io/badge/version-v1.0.0-00d8ff?style=for-the-badge)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-2ea44f?style=for-the-badge)](package.json)
[![Claude Code](https://img.shields.io/badge/Claude_Code-Ready-d97757?style=for-the-badge)](https://docs.anthropic.com/)
[![Antigravity](https://img.shields.io/badge/Antigravity-Ready-8a2be2?style=for-the-badge)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

<br />

**Reduce redundant full-file reads, prevent accidental lockfile/bundle ingestion, and keep AI coding sessions lean.**  
**ContextSlim (`ctx-slim`)** indexes your repository's symbols with exact `[Lstart-Lend]` line numbers, configures official Claude Code `permissions.deny` rules, and provides structured `/clear` handoffs—typically reducing per-task context reads by **30% to 65%**.

```bash
git clone https://github.com/batusayd/ctx-slim.git
cd ctx-slim && npm install && npm run build && npm link
```

[How It Works](#️-architecture--how-it-works) •
[Security & Safety Guarantees](#-security--non-destructive-design) •
[Methodology & Benchmarks](#-methodology--realistic-token-benchmarks) •
[Installation](#-installation--activation-guide) •
[CLI Commands](#️-cli-commands-reference) •
[Uninstallation](#️-uninstallation--removal-guide)

</div>

---

## 🎯 What Problem Does `ctx-slim` Solve?

AI coding agents (**Claude Code**, **Google Antigravity**, **Cursor**) already use `grep` and `glob` effectively, but still hit avoidable token bottlenecks on medium-to-large repositories:

1. **Full-File Reads vs. Symbol Slices**: When inspecting an unfamiliar 500-line module, agents often read the entire file even when only a 35-line function is relevant.
2. **Accidental Lockfile / Build Artifact Reads**: Note that **Claude Code does not use `.claudeignore`**—its official mechanism is **`permissions.deny` inside `.claude/settings.json`**. Without explicit `Read(...)` deny rules, agents can occasionally inspect `package-lock.json`, `Cargo.lock`, minified bundles, or build outputs during broad searches.
3. **Unmodified Code Reprinting**: In chat responses, models frequently reprint unchanged surrounding functions unless instructed to use minimal diffs plus a brief technical rationale.
4. **Multi-Turn Context Accumulation**: By turn 15–20, conversation history replays every turn. Resetting with `/clear` saves tokens, but loses architectural context unless paired with a structured handoff file (`CONTEXT_STATE.md`).

---

## 🛡️ Security & Non-Destructive Design

`ctx-slim` is built with strict engineering and supply-chain safety guarantees:

- **100% Non-Destructive Rule Merging (`<!-- ctx-slim:start -->` ... `<!-- ctx-slim:end -->`)**:
  - `ctx-slim init` **never overwrites or deletes your existing `CLAUDE.md`, `.antigravity/rules.md`, or `.claude/settings.json`**.
  - If `CLAUDE.md` already exists, `ctx-slim` appends a bounded `<!-- ctx-slim:start --> ... <!-- ctx-slim:end -->` block at the bottom (and updates only that block on subsequent runs).
  - Running `ctx-slim clean` strips **only** the bounded `ctx-slim` block, leaving 100% of your custom rules intact.
- **Official `.claude/settings.json` (`permissions.deny`) Integration**:
  - Non-destructively merges `Read(package-lock.json)`, `Read(dist/**)`, `Read(*.min.js)`, etc. into `.claude/settings.json` so Claude Code blocks bloat at the official tool-permission layer.
- **Zero Supply-Chain Risk in Prompts**:
  - Generated `CLAUDE.md` rules and `.claude/commands/*.md` slash commands **never** instruct the AI agent to run `npx --yes` or fetch unpinned remote code from GitHub or npm.
- **Ultra-Compact Rule Overhead (~150 Tokens)**:
  - The injected rule block is kept under 20 lines (~150 tokens) so it does not bloat every turn's system prompt, and explicitly instructs the agent to include a **1–2 line technical rationale/root-cause note** alongside surgical diffs so debuggability is never lost.
- **Safe Git Hook & Live File Watcher (`ctx-slim watch`)**:
  - The optional `post-commit` hook verifies the exact `ctx-slim` package identity before running and **never** executes an arbitrary `./dist/index.js` in your project.
  - To prevent `REPO_MAP.md` line numbers from drifting during active in-session edits before you commit, run `ctx-slim watch` (or `ctx-slim map --watch`) to live-update `REPO_MAP.md` on file save.

---

## 🏗️ Architecture & How It Works

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                           YOUR PROJECT REPOSITORY                            │
└───────────────┬──────────────────────────────────────────────┬───────────────┘
                │                                              │
      [1. Stack Auto-Detector]                       [2. AST/Regex Symbol Parser]
   (Node/TS, Python, Go, Rust, PHP, Lua)             (Full-file scan, #private safe)
                │                                              │
                ▼                                              ▼
┌───────────────────────────────┐              ┌───────────────────────────────┐
│   Official Permission Layer   │              │         REPO_MAP.md           │
│  • .claude/settings.json      │              │  • ASCII Directory Tree       │
│    (permissions.deny Read())  │              │  • Exact Symbol Line Ranges   │
│  • .antigravityignore         │              │    fn parse [L211-L236]       │
│  • .aiignore                  │              │    class Engine [L18-L139]    │
└───────────────┬───────────────┘              └───────────────┬───────────────┘
                │                                              │
                └──────────────────────┬───────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│          NON-DESTRUCTIVE AGENT PROTOCOL (~150 TOKENS) & SLASH COMMANDS       │
│        (Bounded <!-- ctx-slim:start/end --> in CLAUDE.md & rules.md)         │
│                                                                              │
│  ✔ Check REPO_MAP.md -> Read [Lstart-Lend] (±15L buffer) on initial read     │
│  ✔ Minimal Diffs + 1-2 Line Technical Rationale (preserves debuggability)    │
│  ✔ Live Map Sync via `ctx-slim watch` or verified `post-commit` hook         │
│  ✔ Slash Shortcuts: /diff  |  /plan-lite  |  /handoff  |  /slim              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Methodology & Realistic Token Benchmarks

Unlike tools that assume an AI agent reads 100% of your entire repository on every single prompt, **`ctx-slim stats` uses an empirical, scenario-based model**:

1. **Lexical BPE-Approximation Tokenizer**: Splits identifiers, camelCase/snake_case subwords, numbers, and punctuation operators to approximate `cl100k_base` / Claude token counts on source code.
2. **Empirical Symbol Span Calculation**: Measures the actual average line length of every parsed function/class/method in your repository (`avgSymbolLines`) plus a **±15 line safety buffer** (`+30 lines`).
3. **Realistic Per-Task Comparison**:
   - **Baseline Task (Without `ctx-slim`)**: Agent uses `grep`/`glob` and reads **4 candidate source files** in full.
   - **With `ctx-slim`**: Includes the **155-token rule overhead**, a `REPO_MAP.md` lookup, and reading **2 targeted `[Lstart-Lend]` symbol slices** (±15 lines).

### Typical Savings by Scenario

| Scenario | Baseline Behavior | With `ctx-slim` | Realistic Net Savings |
| :--- | :--- | :--- | :--- |
| **Tiny Single-File Edit** *(1 small file <100L)* | Reads 1 small file (~600 tok) | Rule overhead (~155 tok) + slice | **~0% to 10%** *(Map not needed)* |
| **Multi-File Feature / Bugfix** *(4 files, ~300L each)* | Reads 4 full files (~9,500 tok) | Rule + Map + 2 symbol slices (~3,400 tok) | **~45% to 65% Input Saved** |
| **Avoiding Accidental Lock/Bundle Read** | Reads lockfile/bundle (+25k–100k tok) | Blocked via `.claude/settings.json` `deny` | **75% to 90%+ Spike Prevented** |
| **15-Turn Session Handoff (`/handoff` + `/clear`)** | Replays 15 turns of history every prompt | Resumes from ~850-tok `CONTEXT_STATE.md` | **50% to 70% Session History Saved** |

*(Note: Both standard uncached input pricing and **Prompt-Cached** input pricing are reported by `ctx-slim stats`.)*

---

## 📦 Installation & Activation Guide

**Prerequisites**: [Node.js](https://nodejs.org/) `>= 18.0.0`.

### Option 1: Clone, Inspect & Link Locally (Recommended — Supply-Chain Safe)
Cloning locally ensures you run a pinned, auditable copy on your machine without relying on remote `npx` fetches:

```bash
git clone https://github.com/batusayd/ctx-slim.git
cd ctx-slim
npm install
npm run build
npm link
```

Once linked, you can initialize **`ctx-slim`** in two ways:

#### A) Initialize in a Specific Project (Recommended)
Generates `.claude/settings.json` (`permissions.deny`), non-destructively appends the compact protocol to `CLAUDE.md` & `.antigravity/rules.md`, creates `.antigravityignore` / `.aiignore`, and builds `REPO_MAP.md`:

```bash
cd /path/to/your-project
ctx-slim init --with-hooks
```

#### B) Initialize Globally Across All Projects (`--global`)
Non-destructively merges `permissions.deny` into `~/.claude/settings.json`, appends the compact ~150-token protocol block into `~/.claude/CLAUDE.md` and `~/.antigravity/rules.md`, and installs `/diff`, `/plan-lite`, `/handoff`, `/slim` into `~/.claude/commands/`:

```bash
ctx-slim init --global
```

### Option 2: Run via `npx` (Pin to a Commit SHA for Security)
If running via `npx` directly from GitHub, pin to a specific commit or tag:

```bash
npx github:batusayd/ctx-slim#main init
```

---

## 🛠️ CLI Commands Reference

### `ctx-slim init`
Auto-detects your project's tech stack and configures `.claude/settings.json`, non-destructive rule blocks, slash commands, and `REPO_MAP.md`.

```bash
ctx-slim init [--global | -g] [--with-hooks] [--force] [--dir <path>]
```
- `--global, -g`: Non-destructively configures global `~/.claude/settings.json`, `~/.claude/CLAUDE.md`, `~/.claude/commands/`, and `~/.antigravity/rules.md`.
- `--with-hooks`: Installs a verified `.git/hooks/post-commit` hook to refresh `REPO_MAP.md` after every commit.

---

### `ctx-slim map` & `ctx-slim watch`
Scans your repository and generates `REPO_MAP.md` with an ASCII directory tree and symbol `[Lstart-Lend]` index. Supports TypeScript/JS (including `#private` fields and multi-line comments), Python, Go, Rust (`#[derive]` safe), PHP (`#[Attribute]` safe), Lua, and C#/Java/Kotlin.

```bash
# One-time scan:
ctx-slim map [--output REPO_MAP.md] [--max-depth 8]

# Live file-watcher (keeps REPO_MAP.md updated on every file save during a coding session):
ctx-slim watch
# or
ctx-slim map --watch
```

**Example Output Inside `REPO_MAP.md`:**
```markdown
### `src/utils/parser.ts` _(TypeScript, 535L, ~4,410 tok)_
- `[L49-L52]` **func** `export getLanguageForFile`
- `[L76-L108]` **func** `findBraceBlockEnd`
- `[L246-L271]` **func** `export parseFileSymbols`
- `[L273-L423]` **func** `parseTsJs`
```

---

### `ctx-slim handoff`
Generates or updates `CONTEXT_STATE.md` before you run `/clear` to reset a long AI chat session.

```bash
ctx-slim handoff [--task "Implement Redis caching layer"]
```
- Captures current Git branch, latest commit, `git status --short`, and `git diff --stat`.
- Preserves your custom notes under **Architectural Decisions** and **Active Tasks**.

---

### `ctx-slim stats`
Calculates empirical token metrics and estimated USD costs (both uncached and prompt-cached) based on your repository's actual file and symbol line spans.

```bash
ctx-slim stats [--json]
```

---

### `ctx-slim clean` (Aliases: `uninstall`, `remove`)
Non-destructively removes `ctx-slim` blocks from `CLAUDE.md` / `.antigravity/rules.md`, removes `ctx-slim` deny rules from `.claude/settings.json` (preserving all your custom rules and settings!), and deletes generated map/ignore files and hooks.

```bash
# Clean current project (preserves your custom CLAUDE.md and settings.json content!):
ctx-slim clean

# Clean global configuration (~/.claude/ and ~/.antigravity/):
ctx-slim clean --global
```

---

## 💬 Built-in Agent Slash Commands

| Slash Command | Action Executed by Agent |
| :--- | :--- |
| **`/diff <task>`** | Reads only `[Lstart-Lend]` (±15L) from `REPO_MAP.md` and outputs the minimal diff + a 1-line technical rationale. |
| **`/plan-lite <task>`** | Consults `REPO_MAP.md` and replies with a `<=10 line` execution plan (`file:Lstart-Lend -> change`) before editing files. |
| **`/handoff`** | Updates `CONTEXT_STATE.md` with current `git diff --stat` and active tasks so you can run `/clear` safely. |
| **`/slim`** | Runs local `ctx-slim map` and `ctx-slim stats` (if installed locally) to refresh `REPO_MAP.md`. |

---

## 🗑️ Uninstallation & Removal Guide

### 1. Non-Destructive CLI Cleanup (Recommended)
```bash
# Remove from current project (keeps your custom CLAUDE.md rules intact!):
ctx-slim clean

# Remove from global ~/.claude/ and ~/.antigravity/:
ctx-slim clean --global
```

### 2. Uninstall Global CLI Binary
```bash
npm unlink -g ctx-slim
# or
npm uninstall -g ctx-slim
```

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for full details.

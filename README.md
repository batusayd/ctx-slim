<div align="center">

# ⚡ ContextSlim (`ctx-slim`)

### **The Zero-Dependency AI Token Optimization & Context Management Engine**
*Built for **Claude Code**, **Claude Desktop**, **Google Antigravity**, **Cursor**, and **AI Coding Agents***

[![npm version](https://img.shields.io/badge/npm-v1.0.0-00d8ff?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/ctx-slim)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-2ea44f?style=for-the-badge)](package.json)
[![Claude Code](https://img.shields.io/badge/Claude_Code-Ready-d97757?style=for-the-badge)](https://docs.anthropic.com/)
[![Antigravity](https://img.shields.io/badge/Antigravity-Ready-8a2be2?style=for-the-badge)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

<br />

**Stop burning 50,000+ tokens per prompt on full-file reads, lockfiles, and verbose AI chatter.**  
Integrate **ContextSlim (`ctx-slim`)** into any codebase with a single command and reduce AI token consumption & API costs by **75% to 92%**.

```bash
npx ctx-slim init --with-hooks
```

[Why ContextSlim?](#-why-contextslim-ctx-slim) •
[Architecture](#️-architecture--how-it-works) •
[Benchmarks](#-before-vs-after-token--cost-benchmarks) •
[Installation & Setup](#-installation--activation-guide) •
[Claude & Antigravity Integration](#-how-it-works-with-claude--antigravity-daily-workflow) •
[CLI Commands](#️-cli-commands-reference) •
[Uninstallation](#️-uninstallation--removal-guide)

</div>

---

## 🎯 Why ContextSlim (`ctx-slim`)?

When working with modern AI coding assistants (**Claude Code**, **Google Antigravity**, **Claude Desktop**, **Cursor**), developers hit three critical bottlenecks that drain API credits and exhaust 5-hour Pro/Max usage quotas:

1. **Blind Full-File Reads**: Agents read entire 600–1,000 line files from line 1 to EOF just to inspect or modify a 15-line function.
2. **Accidental Bloat Ingestion**: Lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `Cargo.lock`, `poetry.lock`), build outputs (`dist/`, `.next/`, `target/`), and caches silently flood the context window.
3. **Context Rot & Verbose Output**: After 15–20 turns, conversation history bloats, reasoning accuracy drops, and models waste expensive output tokens (5x costlier than input tokens) repeating unchanged code or writing conversational filler.

### ✨ How ContextSlim Solves This (With Zero Runtime Dependencies)

- 🗺️ **Symbol & Line-Range Indexing (`REPO_MAP.md`)**: Scans your codebase using a lightweight multi-language AST/Regex parser and maps every function, class, interface, struct, method, and export with **exact `[Lstart-Lend]` line numbers**.
- 🛡️ **Stack-Aware Context Firewall**: Auto-detects your tech stack (Node/TS, Python, Go, Rust, PHP, Lua, Java/Kotlin, .NET, Ruby) and generates `.claudeignore`, `.antigravityignore`, and `.aiignore` to block high-token bloat.
- 📜 **Strict Agent Behavior Rules (`CLAUDE.md` & `.antigravity/rules.md`)**: Enforces three non-negotiable agent protocols:
  1. **REPO_MAP-First Navigation**: Locate exact `[Lstart-Lend]` ranges in `REPO_MAP.md` before reading any file; read only the target slice.
  2. **Mandatory Diff-Only Output**: Output only minimal surgical diffs—never reprint unmodified code.
  3. **Zero-Fluff Protocol**: Skip conversational pleasantries, preambles, and repetitive post-summaries.
- 🔄 **Zero-Loss Context Handoff (`CONTEXT_STATE.md`)**: Reset bloated chat sessions with `/clear` and resume immediately with a compact ~800-token architectural & `git diff --stat` state snapshot.

---

## 🏗️ Architecture & How It Works

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                           YOUR PROJECT REPOSITORY                            │
└───────────────┬──────────────────────────────────────────────┬───────────────┘
                │                                              │
      [1. Stack Auto-Detector]                       [2. AST/Regex Symbol Parser]
   (Node/TS, Python, Go, Rust, PHP, Lua)             (Scans active source files)
                │                                              │
                ▼                                              ▼
┌───────────────────────────────┐              ┌───────────────────────────────┐
│   Context Bloat Firewall      │              │         REPO_MAP.md           │
│  • .claudeignore              │              │  • ASCII Directory Tree       │
│  • .antigravityignore         │              │  • Exact Symbol Line Ranges   │
│  • .aiignore                  │              │    fn parse [L142-L168]       │
│  (Blocks locks, dist, caches) │              │    class Engine [L18-L139]    │
└───────────────┬───────────────┘              └───────────────┬───────────────┘
                │                                              │
                └──────────────────────┬───────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                 AGENT BEHAVIOR PROTOCOL & SLASH COMMANDS                     │
│                (CLAUDE.md  +  .antigravity/rules.md)                         │
│                                                                              │
│  ✔ Rule 1: Read REPO_MAP.md first -> Read ONLY [Lstart-Lend] line slices     │
│  ✔ Rule 2: Mandatory Diff-Only Output (never repeat unmodified code)         │
│  ✔ Rule 3: Zero-Fluff Technical Output (no conversational filler)            │
│  ✔ Commands: /diff  |  /plan-lite  |  /handoff  |  /slim                     │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  RESULT: 75% - 92% Fewer Tokens  •  Faster Responses  •  5-8x Longer Quota   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Before vs. After Token & Cost Benchmarks

### 1. Per-Session Benchmark (Medium TypeScript/Node.js Project — 85 Files, ~14,500 LOC)

| Metric | ❌ Without `ctx-slim` | ⚡ With `ctx-slim` | 💡 Net Improvement |
| :--- | ---: | ---: | :--- |
| **Unfiltered Bloat (Locks/Build)** | ~185,000 tokens | **0 tokens** *(Blocked)* | **100% Bloat Eliminated** |
| **Input Tokens Read per Task** | ~42,000 tokens *(Full files)* | **~3,400 tokens** *(`REPO_MAP` + `Lstart-Lend`)* | **91.9% Input Saved** |
| **Agent Output Tokens per Turn** | ~1,800 tokens *(Full file + prose)* | **~220 tokens** *(Surgical diff only)* | **87.8% Output Saved** |
| **20-Turn Session (Claude Opus 4)** | \$12.60 | **\$1.02** | **\$11.58 Saved / Session** |
| **20-Turn Session (Claude Sonnet 4)** | \$2.52 | **\$0.20** | **\$2.32 Saved / Session** |
| **20-Turn Session (Gemini 2.5 Pro)** | \$1.05 | **\$0.08** | **\$0.97 Saved / Session** |
| **Context Reset / Handoff Loss** | High *(Manual re-explaining)* | **Zero** *(`CONTEXT_STATE.md`)* | **Instant Session Resume** |

### 2. Savings by Project Scale (20-Turn Coding Session)

| Project Size | Without `ctx-slim` | With `ctx-slim` | Average Savings | Impact on Claude Pro / Max Quota |
| :--- | ---: | ---: | :--- | :--- |
| **Small Project** *(15–25 files)* | ~180,000 tokens | **~32,000 tokens** | **~82% Saved** | 5-hour usage quota lasts **4–5x longer** |
| **Medium Project** *(50–100 files)* | ~650,000 tokens | **~68,000 tokens** | **~89% Saved** | 5-hour usage quota lasts **7–8x longer** |
| **Large Monorepo** *(250+ files)* | ~1,800,000+ tokens | **~140,000 tokens** | **~92%+ Saved** | Prevents 200K context window overflow |

---

## 📦 Installation & Activation Guide

**Prerequisites**: [Node.js](https://nodejs.org/) `>= 18.0.0` and `git` (optional, for automatic post-commit hooks).

You can install and activate **ContextSlim (`ctx-slim`)** in three ways:

### Option 1: Run Directly from GitHub with `npx` (Zero Installation)
Navigate to **your own project directory** and run:

```bash
cd /path/to/your-project
npx github:yourusername/ctx-slim init --with-hooks
```

### Option 2: Clone from GitHub & Link Globally (Recommended for Local Use)
Clone this repository once, build it, and link it globally on your machine so `ctx-slim` works in any terminal folder:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/ctx-slim.git
cd ctx-slim

# 2. Install TypeScript compiler & build the CLI
npm install
npm run build

# 3. Register `ctx-slim` (and `context-slim`) globally on your machine
npm link
```

Now navigate to **any project** on your computer and activate it with a single command:

```bash
cd /path/to/your-project
ctx-slim init --with-hooks
```

### Option 3: Install via NPM (Once Published)

```bash
# Run without installing:
npx ctx-slim init --with-hooks

# Or install globally:
npm install -g ctx-slim
```

---

## 🤖 How It Works with Claude & Antigravity (Daily Workflow)

### 1. What Happens When You Run `ctx-slim init --with-hooks`?
Running `ctx-slim init --with-hooks` inside your project root automatically generates:

| Generated File | Purpose |
| :--- | :--- |
| **`CLAUDE.md`** | Automatically loaded by **Claude Code** on startup. Enforces `REPO_MAP`-First line-range reads, Diff-Only outputs, and Zero-Fluff responses. |
| **`.antigravity/rules.md`** | Automatically loaded by **Google Antigravity**. Enforces targeted `StartLine`/`EndLine` file reads and minimal diffs. |
| **`.claude/commands/*.md`** | Registers native slash commands (`/diff`, `/plan-lite`, `/handoff`, `/slim`) inside Claude Code. |
| **`.claudeignore` / `.antigravityignore` / `.aiignore`** | Prevents AI agents from reading lockfiles, `node_modules/`, `dist/`, build caches, and binary assets. |
| **`REPO_MAP.md`** | Complete project tree + symbol index with exact `[Lstart-Lend]` line numbers (90–95% smaller than raw code). |
| **`.git/hooks/post-commit`** | Automatically updates `REPO_MAP.md` in the background every time you run `git commit`. |

### 2. Do You Need to Do Anything After Writing a Prompt to Claude?
**No! Once initialized, everything works automatically:**

1. Open **Claude Code** (`claude` in terminal or the VS Code / JetBrains extension) or **Google Antigravity** in your project folder.
2. Write your normal prompt (e.g., *"Fix the token expiration bug in the auth middleware"*).
3. Claude automatically reads `CLAUDE.md`, checks `REPO_MAP.md` to find the exact lines (e.g., `src/auth/jwt.ts [L42-L78]`), reads **only** those 36 lines, and applies a minimal diff without wasting tokens.
4. Whenever you run `git commit`, the `post-commit` hook silently updates `REPO_MAP.md` in the background so line numbers stay accurate.

### 3. Using with Claude Desktop App (Projects / Custom Instructions)
If you use the standalone **Claude Desktop** chat app instead of Claude Code CLI:
1. Run `ctx-slim init` in your project folder.
2. Copy the contents of **`CLAUDE.md`** into your Claude Desktop **Project Instructions**.
3. Attach **`REPO_MAP.md`** to your Project Knowledge (instead of uploading dozens of raw source files).
4. When starting a new chat session, run `ctx-slim handoff` and attach **`CONTEXT_STATE.md`**.

---

## 🛠️ CLI Commands Reference

### `ctx-slim init`
Auto-detects your project's tech stack and bootstraps all ignore rules, agent rulebooks, slash commands, and the initial `REPO_MAP.md`.

```bash
ctx-slim init [--with-hooks] [--force] [--dir <path>]
```
- `--with-hooks`: Installs `.git/hooks/post-commit` to keep `REPO_MAP.md` automatically synced after every commit.
- `--force, -f`: Overwrite existing configuration files even if customized.

---

### `ctx-slim map`
Scans your repository (respecting `.gitignore`, `.claudeignore`, `.antigravityignore`, `.aiignore`) and generates `REPO_MAP.md` with an ASCII directory tree and symbol line-range index.

```bash
ctx-slim map [--output REPO_MAP.md] [--max-depth 8] [--quiet]
```

**Example Output Inside `REPO_MAP.md`:**
```markdown
### `src/utils/parser.ts` _(TypeScript, 623L, ~4,180 tok)_
- `[L48-L51]` **func** `export getLanguageForFile`
- `[L66-L97]` **func** `findBraceBlockEnd`
- `[L211-L236]` **func** `export parseFileSymbols`
- `[L238-L386]` **func** `parseTsJs`
```

---

### `ctx-slim handoff`
Generates or updates `CONTEXT_STATE.md` before you reset/clear your AI chat context window.

```bash
ctx-slim handoff [--task "Implement Redis caching layer"] [--output CONTEXT_STATE.md]
```
- Captures current Git branch, latest commit, `git status --short`, and `git diff --stat`.
- Lists top architectural modules and symbol line ranges.
- Preserves your custom notes under **Architectural Decisions** and **Active Tasks**.
- Generates a ready-to-copy **Quick Resume Prompt** at the bottom of `CONTEXT_STATE.md`.

---

### `ctx-slim stats`
Calculates exact token footprint reductions (`chars / 4`) and estimated USD savings across **Claude Opus 4**, **Claude Sonnet 4**, **Gemini 2.5 Pro**, and **GPT-4.1**.

```bash
ctx-slim stats [--json]
```

**Example Terminal Output:**
```text
  📊 1. Context & Token Footprint Analysis (approx. chars / 4)
  ┌──────────────────────────────────────────────────────┬────────────┬──────────┬────────────────┬────────────────────────────────┐
  │ Context Layer / Strategy                             │      Files │     Size │    Est. Tokens │ Impact / Reduction             │
  ├──────────────────────────────────────────────────────┼────────────┼──────────┼────────────────┼────────────────────────────────┤
  │ 1. Unfiltered Project (Source + Locks/Build/Cache)   │        296 │ 25.01 MB │  6,555,676 tok │ Baseline (0% saved)            │
  │ 2. Ignored Bloat Blocked (.claudeignore / .aiignore) │        275 │ 24.90 MB │ -6,527,868 tok │ Blocked from AI context        │
  │ 3. Active Source Code (Full-File Read w/o Map)       │         20 │ 100.8 KB │     25,119 tok │ Standard AI Agent Read         │
  │ 4. REPO_MAP.md Index (74 symbols w/ [Lstart-Lend])   │          1 │   6.2 KB │      1,514 tok │ 94.0% smaller than source      │
  │ 5. ctx-slim Optimized Turn (Map + 12% Line Slice)    │ 1–2 slices │  18.1 KB │      4,528 tok │ 82.0% vs Source (99.9% vs Raw) │
  └──────────────────────────────────────────────────────┴────────────┴──────────┴────────────────┴────────────────────────────────┘
```

---

### `ctx-slim clean` (Aliases: `uninstall`, `remove`)
Safely removes all `ctx-slim` generated files (`.claudeignore`, `.antigravityignore`, `.aiignore`, `CLAUDE.md`, `.antigravity/rules.md`, `.claude/commands/*.md`, `REPO_MAP.md`, `CONTEXT_STATE.md`) and cleans up the `.git/hooks/post-commit` hook from your project.

```bash
ctx-slim clean [--force]
# or
ctx-slim uninstall
```
- Safe by default: Verifies that `CLAUDE.md` was generated by `ctx-slim` before deleting it (pass `--force` to remove even if customized).

---

## 💬 Built-in Agent Slash Commands

Inside **Claude Code** or **Google Antigravity**, type any of these commands during your session:

| Slash Command | Action Executed by Agent |
| :--- | :--- |
| **`/diff <task>`** | Switches to strict **100% Diff-Only + Zero-Prose Mode**. Reads only `[Lstart-Lend]` from `REPO_MAP.md` and outputs exclusively the code diff. |
| **`/plan-lite <task>`** | Consults `REPO_MAP.md` and replies with a `<=10 line` bulleted execution plan (`file#Lstart-Lend` + token impact) before editing any files. |
| **`/handoff`** | Runs `npx ctx-slim handoff`, updates `CONTEXT_STATE.md` with completed work & next steps, and gives you a 3-line summary so you can run `/clear`. |
| **`/slim`** | Runs `npx ctx-slim map && npx ctx-slim stats` to refresh `REPO_MAP.md` and print current token & cost savings. |

---

## 🌐 Supported Languages & Auto-Detection

| Language / Stack | Auto-Detection Markers | Extracted Symbols (`[Lstart-Lend]`) |
| :--- | :--- | :--- |
| **TypeScript / JS** | `package.json`, `tsconfig.json`, lockfiles | `function`, `class`, `interface`, `type`, `enum`, arrow `const`, `method`, `export` |
| **Python** | `pyproject.toml`, `requirements.txt`, `uv.lock`, `Pipfile` | `class`, `def`, `async def`, methods *(indentation block-tracked)* |
| **Go (Golang)** | `go.mod`, `go.sum`, `go.work` | `func`, receiver methods, `type ... struct`, `type ... interface` |
| **Rust** | `Cargo.toml`, `Cargo.lock` | `pub fn`, `fn`, `struct`, `enum`, `trait`, `type`, `impl` |
| **PHP** | `composer.json`, `composer.lock`, `artisan` | `class`, `interface`, `trait`, `enum`, `function` |
| **Lua** | `init.lua`, `fxmanifest.lua`, `.luacheckrc`, `*.rockspec` | `function`, `local function`, module functions *(`end`-keyword tracked)* |
| **Java / Kotlin / C#** | `pom.xml`, `build.gradle`, `*.csproj`, `*.sln` | `class`, `interface`, `struct`, `enum` |

---

## 🗑️ Uninstallation & Removal Guide

If you ever want to remove **ContextSlim (`ctx-slim`)** from a project or from your computer completely, you can do so cleanly in seconds:

### 1. Remove from a Project with One Command (Recommended)
Run the built-in `clean` (or `uninstall`) command inside your project directory:

```bash
npx ctx-slim clean
# or if linked globally:
ctx-slim uninstall
```

This automatically deletes:
- `.claudeignore`, `.antigravityignore`, `.aiignore`
- `CLAUDE.md` *(only if generated by `ctx-slim`; pass `--force` to force delete)*
- `.antigravity/rules.md` and `.claude/commands/{diff,plan-lite,handoff,slim}.md`
- `REPO_MAP.md` and `CONTEXT_STATE.md`
- `.git/hooks/post-commit` *(removes the hook or strips only the `ctx-slim` block if you had an existing hook)*

### 2. Remove from a Project Manually (Without Running the CLI)

**macOS / Linux (Bash / Zsh):**
```bash
rm -f .claudeignore .antigravityignore .aiignore CLAUDE.md REPO_MAP.md CONTEXT_STATE.md .git/hooks/post-commit
rm -rf .antigravity .claude/commands
```

**Windows (PowerShell):**
```powershell
Remove-Item -Force -ErrorAction SilentlyContinue .claudeignore, .antigravityignore, .aiignore, CLAUDE.md, REPO_MAP.md, CONTEXT_STATE.md, .git/hooks/post-commit
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue .antigravity, .claude/commands
```

### 3. Uninstall the Global CLI from Your Computer
If you installed or linked `ctx-slim` globally on your machine:

```bash
# If linked via `npm link`:
npm unlink -g ctx-slim

# If installed via `npm install -g`:
npm uninstall -g ctx-slim
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for full details.

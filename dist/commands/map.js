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
exports.buildRepoMap = buildRepoMap;
exports.runMapCommand = runMapCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ignore_1 = require("../utils/ignore");
const parser_1 = require("../utils/parser");
const ui_1 = require("../utils/ui");
const MAX_FILE_SIZE_BYTES = 512 * 1024; // 512 KB cap for single source file parsing
function buildRepoMap(options) {
    const cwd = path.resolve(options.cwd);
    const maxDepth = options.maxDepth ?? 8;
    const matcher = new ignore_1.IgnoreMatcher(cwd);
    const entries = [];
    const treePaths = [];
    function walk(currentDir, depth) {
        if (depth > maxDepth)
            return;
        let dirEntries = [];
        try {
            dirEntries = fs.readdirSync(currentDir, { withFileTypes: true });
        }
        catch {
            return;
        }
        // Sort directories first, then files alphabetically
        dirEntries.sort((a, b) => {
            if (a.isDirectory() && !b.isDirectory())
                return -1;
            if (!a.isDirectory() && b.isDirectory())
                return 1;
            return a.name.localeCompare(b.name);
        });
        for (const entry of dirEntries) {
            const fullPath = path.join(currentDir, entry.name);
            const relPath = path.relative(cwd, fullPath).replace(/\\/g, '/');
            if (matcher.isIgnored(relPath, entry.isDirectory())) {
                continue;
            }
            if (entry.isDirectory()) {
                treePaths.push(relPath + '/');
                walk(fullPath, depth + 1);
            }
            else if (entry.isFile()) {
                treePaths.push(relPath);
                processFile(fullPath, relPath);
            }
        }
    }
    function processFile(fullPath, relPath) {
        if (!(0, parser_1.isTextSourceFile)(relPath))
            return;
        let stat;
        try {
            stat = fs.statSync(fullPath);
        }
        catch {
            return;
        }
        if (stat.size > MAX_FILE_SIZE_BYTES)
            return;
        let content = '';
        try {
            content = fs.readFileSync(fullPath, 'utf8');
        }
        catch {
            return;
        }
        // Skip binary-like files containing null bytes
        if (content.includes('\0'))
            return;
        const lineCount = content.split(/\r?\n/).length;
        const estimatedFileTokens = (0, ui_1.estimateTokensFromText)(content);
        const language = (0, parser_1.getLanguageForFile)(relPath);
        const symbols = (0, parser_1.isParsableSourceFile)(relPath) ? (0, parser_1.parseFileSymbols)(relPath, content) : [];
        entries.push({
            relativePath: relPath,
            language,
            sizeBytes: stat.size,
            lineCount,
            estimatedTokens: estimatedFileTokens,
            symbols,
        });
    }
    walk(cwd, 0);
    const totalFiles = entries.length;
    const totalLines = entries.reduce((acc, e) => acc + e.lineCount, 0);
    const totalBytes = entries.reduce((acc, e) => acc + e.sizeBytes, 0);
    const totalSymbols = entries.reduce((acc, e) => acc + e.symbols.length, 0);
    const rawCodeTokens = entries.reduce((acc, e) => acc + e.estimatedTokens, 0);
    const generatedAt = new Date().toISOString();
    const projectName = path.basename(cwd);
    const treeAscii = renderDirectoryTree(projectName, treePaths);
    const symbolSection = renderSymbolIndex(entries);
    const headerLines = [
        `# REPO_MAP.md — ${projectName}`,
        '',
        '> **Auto-generated by `ctx-slim map`**',
        '> **AI Agent Instruction**: Check symbol `[Lstart-Lend]` line ranges below before reading large files in full.',
        '',
    ];
    const preliminaryBody = [
        '## 1. Directory Structure',
        '',
        '```text',
        treeAscii,
        '```',
        '',
        '## 2. Symbol & Line-Range Index',
        '',
        symbolSection,
        '',
    ].join('\n');
    const mapTokens = (0, ui_1.estimateTokensFromText)(headerLines.join('\n') + '\n' + preliminaryBody + ' '.repeat(250));
    const savingsPercent = rawCodeTokens > 0
        ? Math.max(0, Math.min(99.9, ((rawCodeTokens - mapTokens) / rawCodeTokens) * 100))
        : 0;
    const metricsTable = [
        '| Metric | Value |',
        '| :--- | :--- |',
        `| **Indexed Source Files** | ${(0, ui_1.formatNumber)(totalFiles)} files (${(0, ui_1.formatNumber)(totalLines)} lines / ${(0, ui_1.formatBytes)(totalBytes)}) |`,
        `| **Extracted Symbols** | ${(0, ui_1.formatNumber)(totalSymbols)} definitions with exact line ranges |`,
        `| **Full Repo Token Cost** | ~${(0, ui_1.formatNumber)(rawCodeTokens)} tokens |`,
        `| **REPO_MAP Token Cost** | ~${(0, ui_1.formatNumber)(mapTokens)} tokens (**${savingsPercent.toFixed(1)}% smaller**) |`,
        '',
    ].join('\n');
    const markdown = [...headerLines, metricsTable, preliminaryBody].join('\n');
    return {
        rootDir: cwd,
        generatedAt,
        totalFiles,
        totalLines,
        totalBytes,
        totalSymbols,
        rawCodeTokens,
        mapTokens,
        savingsPercent,
        entries,
        markdown,
    };
}
function renderDirectoryTree(rootName, relPaths) {
    const root = { name: rootName, isDir: true, children: new Map() };
    for (const p of relPaths) {
        const isDir = p.endsWith('/');
        const clean = isDir ? p.slice(0, -1) : p;
        const parts = clean.split('/');
        let curr = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const partIsDir = i < parts.length - 1 || isDir;
            let child = curr.children.get(part);
            if (!child) {
                child = { name: part, isDir: partIsDir, children: new Map() };
                curr.children.set(part, child);
            }
            curr = child;
        }
    }
    const lines = [`${rootName}/`];
    function traverse(node, prefix) {
        const items = Array.from(node.children.values()).sort((a, b) => {
            if (a.isDir && !b.isDir)
                return -1;
            if (!a.isDir && b.isDir)
                return 1;
            return a.name.localeCompare(b.name);
        });
        items.forEach((item, idx) => {
            const isLast = idx === items.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const suffix = item.isDir ? '/' : '';
            lines.push(`${prefix}${connector}${item.name}${suffix}`);
            if (item.isDir && item.children.size > 0) {
                traverse(item, prefix + (isLast ? '    ' : '│   '));
            }
        });
    }
    traverse(root, '');
    return lines.join('\n');
}
function formatLineRange(sym) {
    if (sym.lineEnd > sym.lineStart) {
        return `L${sym.lineStart}-L${sym.lineEnd}`;
    }
    return `L${sym.lineStart}`;
}
function renderSymbolIndex(entries) {
    if (entries.length === 0) {
        return '_No source files detected._';
    }
    const blocks = [];
    for (const entry of entries) {
        const header = `### \`${entry.relativePath}\` _(${entry.language}, ${entry.lineCount}L, ~${entry.estimatedTokens} tok)_`;
        if (entry.symbols.length === 0) {
            blocks.push(`${header}\n- _No top-level symbols extracted (config/script/doc)_`);
            continue;
        }
        const symLines = entry.symbols.map((sym) => {
            const expBadge = sym.exported ? 'export ' : '';
            return `- \`[${formatLineRange(sym)}]\` **${sym.kind}** \`${expBadge}${sym.name}\``;
        });
        blocks.push(`${header}\n${symLines.join('\n')}`);
    }
    return blocks.join('\n\n');
}
function runMapCommand(options) {
    if (!options.quiet) {
        (0, ui_1.printBanner)();
        ui_1.log.step('Scanning repository & extracting AST/Regex symbol ranges...', options.cwd);
    }
    const result = buildRepoMap(options);
    const outPath = path.resolve(options.cwd, options.output || 'REPO_MAP.md');
    // Only write to disk if content actually changed (prevents unnecessary dirty working tree / mtime churn)
    let existingContent = '';
    if (fs.existsSync(outPath)) {
        try {
            existingContent = fs.readFileSync(outPath, 'utf8');
        }
        catch {
            existingContent = '';
        }
    }
    if (existingContent !== result.markdown) {
        fs.writeFileSync(outPath, result.markdown, 'utf8');
    }
    if (!options.quiet) {
        console.log('');
        ui_1.log.success(`Generated ${ui_1.c.bold(ui_1.c.brightCyan(path.relative(options.cwd, outPath) || 'REPO_MAP.md'))}`);
        console.log(`    ${ui_1.c.gray('├─')} Indexed Files   : ${ui_1.c.bold((0, ui_1.formatNumber)(result.totalFiles))} (${(0, ui_1.formatNumber)(result.totalLines)} lines)`);
        console.log(`    ${ui_1.c.gray('├─')} Symbols Mapped  : ${ui_1.c.bold((0, ui_1.formatNumber)(result.totalSymbols))} functions/classes/types with ${ui_1.c.cyan('[Lstart-Lend]')}`);
        console.log(`    ${ui_1.c.gray('├─')} Raw Code Tokens : ${ui_1.c.yellow('~' + (0, ui_1.formatNumber)(result.rawCodeTokens))} tokens`);
        console.log(`    ${ui_1.c.gray('└─')} Map Token Size  : ${ui_1.c.brightGreen('~' + (0, ui_1.formatNumber)(result.mapTokens))} tokens (${ui_1.c.bold(ui_1.c.brightGreen(result.savingsPercent.toFixed(1) + '% smaller than full source'))})`);
        console.log('');
    }
    if (options.watch) {
        startMapWatcher(options, outPath);
    }
    return result;
}
function startMapWatcher(options, outPath) {
    const cwd = path.resolve(options.cwd);
    const matcher = new ignore_1.IgnoreMatcher(cwd);
    const outRel = path.relative(cwd, outPath).replace(/\\/g, '/');
    ui_1.log.info(`Watching ${ui_1.c.brightCyan(cwd)} for file edits to keep ${ui_1.c.bold(outRel)} live-updated... ${ui_1.c.gray('(Press Ctrl+C to stop)')}`);
    let timer = null;
    try {
        fs.watch(cwd, { recursive: true }, (_eventType, filename) => {
            if (!filename)
                return;
            const rel = filename.replace(/\\/g, '/');
            if (rel === outRel || rel === 'REPO_MAP.md' || rel === 'CONTEXT_STATE.md')
                return;
            if (matcher.isIgnored(rel, false) || !(0, parser_1.isTextSourceFile)(rel))
                return;
            if (timer)
                clearTimeout(timer);
            timer = setTimeout(() => {
                try {
                    const updated = buildRepoMap(options);
                    fs.writeFileSync(outPath, updated.markdown, 'utf8');
                    if (!options.quiet) {
                        const timeStr = new Date().toLocaleTimeString();
                        ui_1.log.success(`${ui_1.c.gray(`[${timeStr}]`)} Refreshed ${ui_1.c.brightCyan(outRel)} after change in ${ui_1.c.white(rel)} (${updated.totalSymbols} symbols)`);
                    }
                }
                catch {
                    // Ignore transient write errors
                }
            }, 150);
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ui_1.log.warn(`Recursive watch not supported on this platform/directory: ${msg}`);
    }
}

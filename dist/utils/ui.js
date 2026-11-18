"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = exports.c = void 0;
exports.stripAnsi = stripAnsi;
exports.padEndVisible = padEndVisible;
exports.padStartVisible = padStartVisible;
exports.formatNumber = formatNumber;
exports.formatBytes = formatBytes;
exports.formatUsd = formatUsd;
exports.estimateTokens = estimateTokens;
exports.estimateTokensFromText = estimateTokensFromText;
exports.printBanner = printBanner;
exports.renderTable = renderTable;
const isColorSupported = process.env.FORCE_COLOR !== '0' &&
    process.env.NO_COLOR === undefined &&
    (process.stdout.isTTY || process.env.FORCE_COLOR !== undefined);
function wrap(code, resetCode = '\x1b[0m') {
    if (!isColorSupported) {
        return (text) => text;
    }
    return (text) => `${code}${text}${resetCode}`;
}
exports.c = {
    bold: wrap('\x1b[1m', '\x1b[22m'),
    dim: wrap('\x1b[2m', '\x1b[22m'),
    italic: wrap('\x1b[3m', '\x1b[23m'),
    cyan: wrap('\x1b[36m'),
    brightCyan: wrap('\x1b[96m'),
    green: wrap('\x1b[32m'),
    brightGreen: wrap('\x1b[92m'),
    yellow: wrap('\x1b[33m'),
    brightYellow: wrap('\x1b[93m'),
    red: wrap('\x1b[31m'),
    magenta: wrap('\x1b[35m'),
    blue: wrap('\x1b[34m'),
    gray: wrap('\x1b[90m'),
    white: wrap('\x1b[97m'),
    bgCyan: wrap('\x1b[46m\x1b[30m'),
    bgGreen: wrap('\x1b[42m\x1b[30m'),
    bgYellow: wrap('\x1b[43m\x1b[30m'),
    bgMagenta: wrap('\x1b[45m\x1b[97m'),
};
function stripAnsi(str) {
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}
function padEndVisible(str, width) {
    const visibleLen = stripAnsi(str).length;
    if (visibleLen >= width)
        return str;
    return str + ' '.repeat(width - visibleLen);
}
function padStartVisible(str, width) {
    const visibleLen = stripAnsi(str).length;
    if (visibleLen >= width)
        return str;
    return ' '.repeat(width - visibleLen) + str;
}
function formatNumber(num) {
    return Math.round(num).toLocaleString('en-US');
}
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024)
        return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
}
function formatUsd(amount) {
    if (amount < 0.0001 && amount > 0)
        return '<$0.0001';
    if (amount < 0.01)
        return `$${amount.toFixed(4)}`;
    if (amount < 1)
        return `$${amount.toFixed(3)}`;
    return `$${amount.toFixed(2)}`;
}
function estimateTokens(charCount) {
    return Math.ceil(charCount / 3.8);
}
/**
 * Lexical BPE-like token estimator for source code and markdown.
 * Splits identifiers, camelCase/snake_case subwords, numbers, and punctuation operators,
 * closely approximating cl100k_base / Claude tokenizer counts on code.
 */
function estimateTokensFromText(text) {
    if (!text)
        return 0;
    const tokens = text.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+|[^\sA-Za-z0-9]|\r?\n/g);
    if (!tokens)
        return Math.ceil(text.length / 4);
    return Math.max(1, Math.round(tokens.length * 0.85));
}
function printBanner() {
    const title = `${exports.c.bold(exports.c.brightCyan('⚡ ctx-slim'))} ${exports.c.dim('v1.0.0')} ${exports.c.gray('— AI Context & Token Optimizer (Claude Code & Antigravity)')}`;
    console.log('');
    console.log(`  ${title}`);
    console.log(`  ${exports.c.gray('─'.repeat(74))}`);
}
function renderTable(headers, rows, alignments = []) {
    const colCount = headers.length;
    const colWidths = headers.map((h) => stripAnsi(h).length);
    for (const row of rows) {
        for (let i = 0; i < colCount; i++) {
            const cell = row[i] ?? '';
            const len = stripAnsi(cell).length;
            if (len > colWidths[i]) {
                colWidths[i] = len;
            }
        }
    }
    const topBorder = '  ┌─' + colWidths.map((w) => '─'.repeat(w)).join('─┬─') + '─┐';
    const midBorder = '  ├─' + colWidths.map((w) => '─'.repeat(w)).join('─┼─') + '─┤';
    const botBorder = '  └─' + colWidths.map((w) => '─'.repeat(w)).join('─┴─') + '─┘';
    const headerLine = '  │ ' +
        headers
            .map((h, i) => {
            const padded = alignments[i] === 'right'
                ? padStartVisible(h, colWidths[i])
                : padEndVisible(h, colWidths[i]);
            return exports.c.bold(exports.c.brightCyan(padded));
        })
            .join(' │ ') +
        ' │';
    const bodyLines = rows.map((row) => {
        return ('  │ ' +
            row
                .map((cell, i) => alignments[i] === 'right'
                ? padStartVisible(cell ?? '', colWidths[i])
                : padEndVisible(cell ?? '', colWidths[i]))
                .join(' │ ') +
            ' │');
    });
    return [topBorder, headerLine, midBorder, ...bodyLines, botBorder].join('\n');
}
exports.log = {
    info: (msg) => console.log(`  ${exports.c.cyan('ℹ')} ${msg}`),
    success: (msg) => console.log(`  ${exports.c.brightGreen('✔')} ${msg}`),
    warn: (msg) => console.log(`  ${exports.c.yellow('⚠')} ${msg}`),
    error: (msg) => console.error(`  ${exports.c.red('✖')} ${msg}`),
    step: (label, detail) => console.log(`  ${exports.c.brightCyan('▸')} ${exports.c.bold(label)} ${exports.c.gray(detail)}`),
};

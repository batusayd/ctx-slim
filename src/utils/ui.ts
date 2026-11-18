const isColorSupported =
  process.env.FORCE_COLOR !== '0' &&
  process.env.NO_COLOR === undefined &&
  (process.stdout.isTTY || process.env.FORCE_COLOR !== undefined);

function wrap(code: string, resetCode: string = '\x1b[0m'): (text: string) => string {
  if (!isColorSupported) {
    return (text: string) => text;
  }
  return (text: string) => `${code}${text}${resetCode}`;
}

export const c = {
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

export function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

export function padEndVisible(str: string, width: number): string {
  const visibleLen = stripAnsi(str).length;
  if (visibleLen >= width) return str;
  return str + ' '.repeat(width - visibleLen);
}

export function padStartVisible(str: string, width: number): string {
  const visibleLen = stripAnsi(str).length;
  if (visibleLen >= width) return str;
  return ' '.repeat(width - visibleLen) + str;
}

export function formatNumber(num: number): string {
  return Math.round(num).toLocaleString('en-US');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function formatUsd(amount: number): string {
  if (amount < 0.0001 && amount > 0) return '<$0.0001';
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  if (amount < 1) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(2)}`;
}

export function estimateTokens(charCount: number): number {
  return Math.ceil(charCount / 4);
}

export function printBanner(): void {
  const title = `${c.bold(c.brightCyan('⚡ ctx-slim'))} ${c.dim('v1.0.0')} ${c.gray('— AI Context & Token Optimizer (Claude Code & Antigravity)')}`;
  console.log('');
  console.log(`  ${title}`);
  console.log(`  ${c.gray('─'.repeat(74))}`);
}

export function renderTable(
  headers: string[],
  rows: string[][],
  alignments: ('left' | 'right')[] = []
): string {
  const colCount = headers.length;
  const colWidths: number[] = headers.map((h) => stripAnsi(h).length);

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

  const headerLine =
    '  │ ' +
    headers
      .map((h, i) => {
        const padded =
          alignments[i] === 'right'
            ? padStartVisible(h, colWidths[i])
            : padEndVisible(h, colWidths[i]);
        return c.bold(c.brightCyan(padded));
      })
      .join(' │ ') +
    ' │';

  const bodyLines = rows.map((row) => {
    return (
      '  │ ' +
      row
        .map((cell, i) =>
          alignments[i] === 'right'
            ? padStartVisible(cell ?? '', colWidths[i])
            : padEndVisible(cell ?? '', colWidths[i])
        )
        .join(' │ ') +
      ' │'
    );
  });

  return [topBorder, headerLine, midBorder, ...bodyLines, botBorder].join('\n');
}

export const log = {
  info: (msg: string) => console.log(`  ${c.cyan('ℹ')} ${msg}`),
  success: (msg: string) => console.log(`  ${c.brightGreen('✔')} ${msg}`),
  warn: (msg: string) => console.log(`  ${c.yellow('⚠')} ${msg}`),
  error: (msg: string) => console.error(`  ${c.red('✖')} ${msg}`),
  step: (label: string, detail: string) =>
    console.log(`  ${c.brightCyan('▸')} ${c.bold(label)} ${c.gray(detail)}`),
};

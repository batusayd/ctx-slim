export declare const c: {
    bold: (text: string) => string;
    dim: (text: string) => string;
    italic: (text: string) => string;
    cyan: (text: string) => string;
    brightCyan: (text: string) => string;
    green: (text: string) => string;
    brightGreen: (text: string) => string;
    yellow: (text: string) => string;
    brightYellow: (text: string) => string;
    red: (text: string) => string;
    magenta: (text: string) => string;
    blue: (text: string) => string;
    gray: (text: string) => string;
    white: (text: string) => string;
    bgCyan: (text: string) => string;
    bgGreen: (text: string) => string;
    bgYellow: (text: string) => string;
    bgMagenta: (text: string) => string;
};
export declare function stripAnsi(str: string): string;
export declare function padEndVisible(str: string, width: number): string;
export declare function padStartVisible(str: string, width: number): string;
export declare function formatNumber(num: number): string;
export declare function formatBytes(bytes: number): string;
export declare function formatUsd(amount: number): string;
export declare function estimateTokens(charCount: number): number;
/**
 * Lexical BPE-like token estimator for source code and markdown.
 * Splits identifiers, camelCase/snake_case subwords, numbers, and punctuation operators,
 * closely approximating cl100k_base / Claude tokenizer counts on code.
 */
export declare function estimateTokensFromText(text: string): number;
export declare function printBanner(): void;
export declare function renderTable(headers: string[], rows: string[][], alignments?: ('left' | 'right')[]): string;
export declare const log: {
    info: (msg: string) => void;
    success: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    step: (label: string, detail: string) => void;
};

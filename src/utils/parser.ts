import * as path from 'path';
import { CodeSymbol, SymbolKind } from '../types';

const LANGUAGE_BY_EXT: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TSX',
  '.js': 'JavaScript',
  '.jsx': 'JSX',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.php': 'PHP',
  '.lua': 'Lua',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.cs': 'C#',
  '.rb': 'Ruby',
  '.c': 'C',
  '.cpp': 'C++',
  '.h': 'C/C++ Header',
  '.md': 'Markdown',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
};

const PARSABLE_EXTENSIONS = new Set<string>([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.php',
  '.lua',
  '.java',
  '.kt',
  '.cs',
  '.rb',
]);

export function getLanguageForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return LANGUAGE_BY_EXT[ext] ?? (ext ? ext.slice(1).toUpperCase() : 'Text');
}

export function isParsableSourceFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return PARSABLE_EXTENSIONS.has(ext);
}

export function isTextSourceFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return (
    ext in LANGUAGE_BY_EXT ||
    ['.sql', '.graphql', '.prisma', '.sh', '.ps1', '.css', '.scss', '.html', '.vue', '.svelte'].includes(ext)
  );
}

interface ScanState {
  inBacktick: boolean;
  inBlockComment: boolean;
}

/**
 * Finds the closing line (1-based) of a brace-delimited block starting at `startLineIdx` (0-based).
 * Scans the entire file without artificial line limits, tracking strings, regexes, template literals,
 * and multi-line block comments. Does NOT treat `#` as a comment in TS/JS/Go/Rust/C#/Java (preserving `#private` fields and `#[attr]`).
 */
function findBraceBlockEnd(
  lines: string[],
  startLineIdx: number,
  allowHashComment: boolean = false
): number {
  let depth = 0;
  let foundOpenBrace = false;
  let state: ScanState = { inBacktick: false, inBlockComment: false };

  for (let i = startLineIdx; i < lines.length; i++) {
    const stripped = stripCodeNoiseStateful(lines[i], state, allowHashComment);
    const line = stripped.cleanLine;
    state = stripped.state;

    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '{') {
        depth++;
        foundOpenBrace = true;
      } else if (ch === '}') {
        depth--;
        if (foundOpenBrace && depth <= 0) {
          return i + 1;
        }
      }
    }

    // Single-line or interface/type declaration ending with semicolon before any brace block opens
    if (!foundOpenBrace && !state.inBacktick && !state.inBlockComment && line.trim().endsWith(';')) {
      return i + 1;
    }
  }

  return startLineIdx + 1;
}

function stripCodeNoiseStateful(
  line: string,
  prevState: ScanState,
  allowHashComment: boolean = false
): { cleanLine: string; state: ScanState } {
  let result = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = prevState.inBacktick;
  let inBlockComment = prevState.inBlockComment;
  let inRegex = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = i + 1 < line.length ? line[i + 1] : '';
    const prev = i > 0 ? line[i - 1] : '';

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inBacktick) {
      if (ch === '`' && prev !== '\\') {
        inBacktick = false;
      }
      continue;
    }

    if (inRegex) {
      if (ch === '/' && prev !== '\\') {
        inRegex = false;
      }
      continue;
    }

    if (!inSingle && !inDouble) {
      if (ch === '/' && next === '/') break;
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
      // Only treat `#` as a comment in PHP (when not `#[` attribute), never in TS/JS (`#private`) or Rust (`#[derive]`)
      if (allowHashComment && ch === '#' && next !== '[') {
        break;
      }
      if (ch === '/' && next !== '*' && /[=(,:!&|?;\s]/.test(prev || ' ')) {
        inRegex = true;
        continue;
      }
    }

    if (ch === "'" && !inDouble && prev !== '\\') {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle && prev !== '\\') {
      inDouble = !inDouble;
      continue;
    }
    if (ch === '`' && !inSingle && !inDouble && prev !== '\\') {
      inBacktick = true;
      continue;
    }

    if (!inSingle && !inDouble) {
      result += ch;
    }
  }

  return {
    cleanLine: result,
    state: { inBacktick, inBlockComment },
  };
}

/**
 * Finds the closing line (1-based) of a Python indented block starting at `startLineIdx` (0-based).
 */
function findPythonBlockEnd(lines: string[], startLineIdx: number): number {
  const startLine = lines[startLineIdx];
  const baseIndentMatch = startLine.match(/^(\s*)/);
  const baseIndent = baseIndentMatch ? baseIndentMatch[1].length : 0;
  let lastValidLine = startLineIdx + 1;

  for (let i = startLineIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indentMatch = raw.match(/^(\s*)/);
    const currentIndent = indentMatch ? indentMatch[1].length : 0;

    if (currentIndent <= baseIndent) {
      break;
    }
    lastValidLine = i + 1;
  }

  return lastValidLine;
}

/**
 * Finds the closing line (1-based) of a Lua/Ruby `end`-terminated block starting at `startLineIdx` (0-based).
 */
function findKeywordBlockEnd(lines: string[], startLineIdx: number): number {
  let depth = 0;

  for (let i = startLineIdx; i < lines.length; i++) {
    const clean = lines[i].replace(/--.*$/, '').trim();
    if (!clean) continue;

    const openers = clean.match(/\b(function|if|for|while|repeat|do)\b/g);
    const hasLoopAndDo = /\b(for|while)\b.*\bdo\b/.test(clean);
    if (openers) {
      depth += openers.length - (hasLoopAndDo ? 1 : 0);
    }

    const closers = clean.match(/\b(end|until)\b/g);
    if (closers) {
      depth -= closers.length;
      if (depth <= 0) {
        return i + 1;
      }
    }
  }

  return startLineIdx + 1;
}

export function parseFileSymbols(filePath: string, content: string): CodeSymbol[] {
  const ext = path.extname(filePath).toLowerCase();
  const lines = content.split(/\r?\n/);

  switch (ext) {
    case '.ts':
    case '.tsx':
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return parseTsJs(lines);
    case '.py':
      return parsePython(lines);
    case '.go':
      return parseGo(lines);
    case '.rs':
      return parseRust(lines);
    case '.php':
      return parsePhp(lines);
    case '.lua':
      return parseLua(lines);
    default:
      return parseGenericCStyle(lines);
  }
}

function parseTsJs(lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const reservedNames = new Set([
    'if',
    'for',
    'while',
    'switch',
    'catch',
    'return',
    'constructor',
    'super',
  ]);

  let state: ScanState = { inBacktick: false, inBlockComment: false };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const wasInsideLiteralOrComment = state.inBacktick || state.inBlockComment;
    const stripped = stripCodeNoiseStateful(raw, state, false);
    state = stripped.state;

    if (wasInsideLiteralOrComment) {
      continue;
    }

    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    const isExported = /^export\s+/.test(trimmed);

    // 1. Class definition
    const classMatch = trimmed.match(
      /^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/
    );
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        kind: 'class',
        lineStart: i + 1,
        lineEnd: findBraceBlockEnd(lines, i, false),
        exported: isExported,
      });
      continue;
    }

    // 2. Interface definition
    const ifaceMatch = trimmed.match(/^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/);
    if (ifaceMatch) {
      symbols.push({
        name: ifaceMatch[1],
        kind: 'interface',
        lineStart: i + 1,
        lineEnd: findBraceBlockEnd(lines, i, false),
        exported: isExported,
      });
      continue;
    }

    // 3. Type alias
    const typeMatch = trimmed.match(/^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*=/);
    if (typeMatch) {
      symbols.push({
        name: typeMatch[1],
        kind: 'type',
        lineStart: i + 1,
        lineEnd: findBraceBlockEnd(lines, i, false),
        exported: isExported,
      });
      continue;
    }

    // 4. Enum definition
    const enumMatch = trimmed.match(/^(?:export\s+)?(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)/);
    if (enumMatch) {
      symbols.push({
        name: enumMatch[1],
        kind: 'enum',
        lineStart: i + 1,
        lineEnd: findBraceBlockEnd(lines, i, false),
        exported: isExported,
      });
      continue;
    }

    // 5. Standard function declaration
    const fnMatch = trimmed.match(
      /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/
    );
    if (fnMatch) {
      symbols.push({
        name: fnMatch[1],
        kind: 'func',
        lineStart: i + 1,
        lineEnd: findBraceBlockEnd(lines, i, false),
        exported: isExported,
      });
      continue;
    }

    // 6. Arrow function or exported const handler
    const arrowMatch = trimmed.match(
      /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>/
    );
    if (arrowMatch) {
      symbols.push({
        name: arrowMatch[1],
        kind: 'func',
        lineStart: i + 1,
        lineEnd: findBraceBlockEnd(lines, i, false),
        exported: isExported,
      });
      continue;
    }

    // 7. Exported constant
    const exportConstMatch = trimmed.match(/^export\s+const\s+([A-Za-z_$][\w$]*)\b/);
    if (exportConstMatch) {
      symbols.push({
        name: exportConstMatch[1],
        kind: 'const',
        lineStart: i + 1,
        lineEnd: findBraceBlockEnd(lines, i, false),
        exported: true,
      });
      continue;
    }

    // 8. Class method or getter/setter (including private `#method`)
    const indent = raw.length - raw.trimStart().length;
    if (indent >= 2 && indent <= 8) {
      const methodMatch = trimmed.match(
        /^(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?(#?[A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\([^;]*\)\s*(?::\s*[^{]+)?\{/
      );
      if (methodMatch && !reservedNames.has(methodMatch[1])) {
        symbols.push({
          name: methodMatch[1],
          kind: 'method',
          lineStart: i + 1,
          lineEnd: findBraceBlockEnd(lines, i, false),
          exported: false,
        });
      }
    }
  }

  return symbols;
}

function parsePython(lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = raw.length - raw.trimStart().length;

    const classMatch = trimmed.match(/^class\s+([A-Za-z_]\w*)/);
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        kind: 'class',
        lineStart: i + 1,
        lineEnd: findPythonBlockEnd(lines, i),
        exported: !classMatch[1].startsWith('_'),
      });
      continue;
    }

    const fnMatch = trimmed.match(/^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/);
    if (fnMatch) {
      symbols.push({
        name: fnMatch[1],
        kind: indent > 0 ? 'method' : 'func',
        lineStart: i + 1,
        lineEnd: findPythonBlockEnd(lines, i),
        exported: indent === 0 && !fnMatch[1].startsWith('_'),
      });
    }
  }

  return symbols;
}

function parseGo(lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    const fnMatch = trimmed.match(/^func\s+(?:\([^)]+\)\s+)?([A-Za-z_]\w*)\s*\(/);
    if (fnMatch) {
      const name = fnMatch[1];
      const isMethod = /^func\s+\(/.test(trimmed);
      symbols.push({
        name,
        kind: isMethod ? 'method' : 'func',
        lineStart: i + 1,
        lineEnd: findBraceBlockEnd(lines, i, false),
        exported: /^[A-Z]/.test(name),
      });
      continue;
    }

    const typeMatch = trimmed.match(/^type\s+([A-Za-z_]\w*)\s+(struct|interface)\b/);
    if (typeMatch) {
      const name = typeMatch[1];
      const kind = typeMatch[2] === 'interface' ? 'interface' : 'struct';
      symbols.push({
        name,
        kind,
        lineStart: i + 1,
        lineEnd: findBraceBlockEnd(lines, i, false),
        exported: /^[A-Z]/.test(name),
      });
    }
  }

  return symbols;
}

function parseRust(lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#[')) continue;

    const isPub = /^pub(?:\([^)]*\))?\s+/.test(trimmed);

    const fnMatch = trimmed.match(
      /^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?(?:const\s+)?fn\s+([A-Za-z_]\w*)/
    );
    if (fnMatch) {
      symbols.push({
        name: fnMatch[1],
        kind: 'func',
        lineStart: i + 1,
        lineEnd: findBraceBlockEnd(lines, i, false),
        exported: isPub,
      });
      continue;
    }

    const itemMatch = trimmed.match(
      /^(?:pub(?:\([^)]*\))?\s+)?(struct|enum|trait|type)\s+([A-Za-z_]\w*)/
    );
    if (itemMatch) {
      const kindMap: Record<string, SymbolKind> = {
        struct: 'struct',
        enum: 'enum',
        trait: 'trait',
        type: 'type',
      };
      symbols.push({
        name: itemMatch[2],
        kind: kindMap[itemMatch[1]] ?? 'type',
        lineStart: i + 1,
        lineEnd: findBraceBlockEnd(lines, i, false),
        exported: isPub,
      });
      continue;
    }

    const implMatch = trimmed.match(/^impl(?:<[^>]*>)?\s+([A-Za-z_][\w:<>, ]*?)(?:\s+where|\s*\{)/);
    if (implMatch) {
      symbols.push({
        name: `impl ${implMatch[1].trim()}`,
        kind: 'impl',
        lineStart: i + 1,
        lineEnd: findBraceBlockEnd(lines, i, false),
        exported: false,
      });
    }
  }

  return symbols;
}

function parsePhp(lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('//') || (trimmed.startsWith('#') && !trimmed.startsWith('#['))) {
      continue;
    }

    const classMatch = trimmed.match(
      /^(?:abstract\s+|final\s+|readonly\s+)?(class|interface|trait|enum)\s+([A-Za-z_]\w*)/
    );
    if (classMatch) {
      const kindMap: Record<string, SymbolKind> = {
        class: 'class',
        interface: 'interface',
        trait: 'trait',
        enum: 'enum',
      };
      symbols.push({
        name: classMatch[2],
        kind: kindMap[classMatch[1]] ?? 'class',
        lineStart: i + 1,
        lineEnd: findBraceBlockEnd(lines, i, true),
        exported: true,
      });
      continue;
    }

    const fnMatch = trimmed.match(
      /^(?:public\s+|protected\s+|private\s+)?(?:static\s+)?function\s+&?\s*([A-Za-z_]\w*)\s*\(/
    );
    if (fnMatch) {
      const isPrivate = /^private\s+/.test(trimmed);
      symbols.push({
        name: fnMatch[1],
        kind: 'func',
        lineStart: i + 1,
        lineEnd: findBraceBlockEnd(lines, i, true),
        exported: !isPrivate,
      });
    }
  }

  return symbols;
}

function parseLua(lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('--')) continue;

    const isLocal = /^local\s+/.test(trimmed);
    const fnMatch = trimmed.match(/^(?:local\s+)?function\s+([A-Za-z_][\w.:]*)\s*\(/);
    if (fnMatch) {
      symbols.push({
        name: fnMatch[1],
        kind: fnMatch[1].includes(':') || fnMatch[1].includes('.') ? 'method' : 'func',
        lineStart: i + 1,
        lineEnd: findKeywordBlockEnd(lines, i),
        exported: !isLocal,
      });
      continue;
    }

    const assignFnMatch = trimmed.match(/^([A-Za-z_][\w.]*)\s*=\s*function\s*\(/);
    if (assignFnMatch) {
      symbols.push({
        name: assignFnMatch[1],
        kind: 'func',
        lineStart: i + 1,
        lineEnd: findKeywordBlockEnd(lines, i),
        exported: true,
      });
    }
  }

  return symbols;
}

function parseGenericCStyle(lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    const classMatch = trimmed.match(
      /^(?:public\s+|internal\s+|private\s+|abstract\s+|sealed\s+|final\s+)*(class|interface|struct|enum)\s+([A-Za-z_]\w*)/
    );
    if (classMatch) {
      symbols.push({
        name: classMatch[2],
        kind: (classMatch[1] as SymbolKind) || 'class',
        lineStart: i + 1,
        lineEnd: findBraceBlockEnd(lines, i, false),
        exported: !trimmed.startsWith('private'),
      });
    }
  }
  return symbols;
}

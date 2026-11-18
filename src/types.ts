export type StackId =
  | 'node-ts'
  | 'python'
  | 'go'
  | 'rust'
  | 'php'
  | 'lua'
  | 'java-kotlin'
  | 'dotnet'
  | 'ruby';

export interface DetectedStack {
  id: StackId;
  name: string;
  matchedFiles: string[];
}

export type SymbolKind =
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'func'
  | 'method'
  | 'struct'
  | 'trait'
  | 'impl'
  | 'const'
  | 'module';

export interface CodeSymbol {
  name: string;
  kind: SymbolKind;
  lineStart: number;
  lineEnd: number;
  exported: boolean;
  signature?: string;
}

export interface FileMapEntry {
  relativePath: string;
  language: string;
  sizeBytes: number;
  lineCount: number;
  estimatedTokens: number;
  symbols: CodeSymbol[];
}

export interface RepoMapResult {
  rootDir: string;
  generatedAt: string;
  totalFiles: number;
  totalLines: number;
  totalBytes: number;
  totalSymbols: number;
  rawCodeTokens: number;
  mapTokens: number;
  savingsPercent: number;
  entries: FileMapEntry[];
  markdown: string;
}

export interface InitOptions {
  cwd: string;
  withHooks: boolean;
  force: boolean;
  quiet?: boolean;
}

export interface MapOptions {
  cwd: string;
  output: string;
  maxDepth?: number;
  quiet?: boolean;
}

export interface HandoffOptions {
  cwd: string;
  output: string;
  task?: string;
  quiet?: boolean;
}

export interface StatsOptions {
  cwd: string;
  json?: boolean;
}

export interface CleanOptions {
  cwd: string;
  force?: boolean;
  quiet?: boolean;
}

export interface ModelPricing {
  name: string;
  provider: string;
  inputPerMillionUsd: number;
  cachedInputPerMillionUsd?: number;
}

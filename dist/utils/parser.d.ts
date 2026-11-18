import { CodeSymbol } from '../types';
export declare function getLanguageForFile(filePath: string): string;
export declare function isParsableSourceFile(filePath: string): boolean;
export declare function isTextSourceFile(filePath: string): boolean;
export declare function parseFileSymbols(filePath: string, content: string): CodeSymbol[];

import { DetectedStack } from '../types';
export declare function generateIgnoreContent(detectedStacks: DetectedStack[]): string;
export declare class IgnoreMatcher {
    /**
     * Only directories that are universally never user source code (plus ctx-slim's own config folders).
     * Build folders like `dist/`, `build/`, `out/` are loaded from the project's `.gitignore` / `.aiignore`
     * so projects with real source files in `out/` or `build/` are never accidentally hidden.
     */
    private dirNames;
    private exactFileNames;
    private regexRules;
    constructor(cwd: string);
    private addRulesFromContent;
    isIgnored(relativePath: string, isDirectory?: boolean): boolean;
}

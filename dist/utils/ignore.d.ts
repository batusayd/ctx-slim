import { DetectedStack } from '../types';
export declare function generateIgnoreContent(detectedStacks: DetectedStack[]): string;
export declare class IgnoreMatcher {
    private dirNames;
    private exactFileNames;
    private regexRules;
    constructor(cwd: string);
    private addRulesFromContent;
    isIgnored(relativePath: string, isDirectory?: boolean): boolean;
}

import { DetectedStack } from '../types';
export declare const CTX_SLIM_START_MARKER = "<!-- ctx-slim:start -->";
export declare const CTX_SLIM_END_MARKER = "<!-- ctx-slim:end -->";
/**
 * Generates an ultra-compact (~150 tokens) rule block wrapped in non-destructive markers.
 * Zero supply-chain risk: never instructs the agent to run `npx --yes` or fetch remote code.
 */
export declare function generateClaudeMd(projectName: string, stacks: DetectedStack[]): string;
export declare function generateAntigravityRulesMd(projectName: string, stacks: DetectedStack[]): string;
export declare function generateClaudeSlashCommands(): Record<string, string>;
/**
 * Generates official Claude Code `.claude/settings.json` `permissions.deny` rules
 * so Claude Code is prevented at the tool permission layer from reading lockfiles and build bloat.
 */
/**
 * Generates official Claude Code `.claude/settings.json` `permissions.deny` rules.
 * In global mode (`isGlobal = true`), only blocks package manager lockfiles so project-specific
 * `build/`, `dist/`, or `.map` debugging is never globally obstructed.
 */
export declare function getClaudeSettingsDenyRules(stacks: DetectedStack[], isGlobal?: boolean): string[];
/**
 * Generates a safe post-commit hook that NEVER executes an arbitrary `./dist/index.js` in the user's repo.
 * It resolves either global `ctx-slim`, local `./node_modules/.bin/ctx-slim`, or the verified CLI installation path.
 */
export declare function generatePostCommitHook(verifiedCliPath?: string): string;

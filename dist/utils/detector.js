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
exports.detectStacks = detectStacks;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const STACK_DEFINITIONS = [
    {
        id: 'node-ts',
        name: 'Node.js / TypeScript',
        markerFiles: [
            'package.json',
            'tsconfig.json',
            'pnpm-lock.yaml',
            'yarn.lock',
            'bun.lockb',
            'package-lock.json',
            'deno.json',
        ],
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
    },
    {
        id: 'python',
        name: 'Python',
        markerFiles: [
            'pyproject.toml',
            'requirements.txt',
            'Pipfile',
            'setup.py',
            'poetry.lock',
            'uv.lock',
            'manage.py',
        ],
        extensions: ['.py'],
    },
    {
        id: 'go',
        name: 'Go (Golang)',
        markerFiles: ['go.mod', 'go.sum', 'go.work'],
        extensions: ['.go'],
    },
    {
        id: 'rust',
        name: 'Rust',
        markerFiles: ['Cargo.toml', 'Cargo.lock'],
        extensions: ['.rs'],
    },
    {
        id: 'php',
        name: 'PHP',
        markerFiles: ['composer.json', 'composer.lock', 'artisan', 'index.php'],
        extensions: ['.php'],
    },
    {
        id: 'lua',
        name: 'Lua',
        markerFiles: [
            'init.lua',
            '.luacheckrc',
            'fxmanifest.lua',
            '__resource.lua',
            'conf.lua',
            'main.lua',
        ],
        extensions: ['.lua'],
    },
    {
        id: 'java-kotlin',
        name: 'Java / Kotlin',
        markerFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle'],
        extensions: ['.java', '.kt'],
    },
    {
        id: 'dotnet',
        name: '.NET / C#',
        markerFiles: ['global.json', 'Directory.Build.props'],
        extensions: ['.cs', '.csproj', '.sln'],
    },
    {
        id: 'ruby',
        name: 'Ruby',
        markerFiles: ['Gemfile', 'Gemfile.lock', 'Rakefile'],
        extensions: ['.rb'],
    },
];
function detectStacks(cwd) {
    const detected = [];
    let rootEntries = [];
    try {
        rootEntries = fs.readdirSync(cwd, { withFileTypes: true });
    }
    catch {
        return detected;
    }
    const rootFileNames = new Set(rootEntries.filter((e) => e.isFile()).map((e) => e.name));
    // Also collect shallow file extensions up to depth 2 to detect projects without root lockfiles
    const shallowExtensions = new Set();
    const scanShallow = (dir, depth) => {
        if (depth > 2)
            return;
        let entries = [];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'vendor' || entry.name === 'target' || entry.name === 'dist') {
                continue;
            }
            if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (ext)
                    shallowExtensions.add(ext);
                if (entry.name.endsWith('.rockspec'))
                    shallowExtensions.add('.lua');
            }
            else if (entry.isDirectory()) {
                scanShallow(path.join(dir, entry.name), depth + 1);
            }
        }
    };
    scanShallow(cwd, 0);
    for (const def of STACK_DEFINITIONS) {
        const matched = [];
        for (const marker of def.markerFiles) {
            if (rootFileNames.has(marker)) {
                matched.push(marker);
            }
        }
        for (const ext of def.extensions) {
            if (shallowExtensions.has(ext) && !matched.includes(`*${ext}`)) {
                matched.push(`*${ext}`);
            }
        }
        if (matched.length > 0) {
            detected.push({
                id: def.id,
                name: def.name,
                matchedFiles: matched,
            });
        }
    }
    return detected;
}

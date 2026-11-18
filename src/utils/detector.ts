import * as fs from 'fs';
import * as path from 'path';
import { DetectedStack, StackId } from '../types';

interface StackDefinition {
  id: StackId;
  name: string;
  markerFiles: string[];
  extensions: string[];
}

const STACK_DEFINITIONS: StackDefinition[] = [
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

export function detectStacks(cwd: string): DetectedStack[] {
  const detected: DetectedStack[] = [];

  let rootEntries: fs.Dirent[] = [];
  try {
    rootEntries = fs.readdirSync(cwd, { withFileTypes: true });
  } catch {
    return detected;
  }

  const rootFileNames = new Set(rootEntries.filter((e) => e.isFile()).map((e) => e.name));

  // Also collect shallow file extensions up to depth 2 to detect projects without root lockfiles
  const shallowExtensions = new Set<string>();
  const scanShallow = (dir: string, depth: number) => {
    if (depth > 2) return;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'vendor' || entry.name === 'target' || entry.name === 'dist') {
        continue;
      }
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext) shallowExtensions.add(ext);
        if (entry.name.endsWith('.rockspec')) shallowExtensions.add('.lua');
      } else if (entry.isDirectory()) {
        scanShallow(path.join(dir, entry.name), depth + 1);
      }
    }
  };

  scanShallow(cwd, 0);

  for (const def of STACK_DEFINITIONS) {
    const matched: string[] = [];

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

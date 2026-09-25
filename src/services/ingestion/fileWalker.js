const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'bower_components', 'vendor', 'dist', 'build', 'out', 'target', 'bin', 'obj',
  'coverage', '.next', '.nuxt', '.svelte-kit', '.turbo', '.cache', '.parcel-cache', '.vercel', '.idea', '.vscode',
  '__pycache__', '.venv', 'venv', 'env', '.tox', '.mypy_cache', '.pytest_cache', '.gradle', '.terraform'
]);

const SKIP_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'composer.lock', 'Gemfile.lock',
  'Cargo.lock', 'poetry.lock', 'Pipfile.lock', 'go.sum', '.DS_Store'
]);

// extension -> language label stored in chunk metadata
const EXTENSION_LANGUAGES = {
  // code
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.mts': 'typescript', '.cts': 'typescript', '.tsx': 'tsx',
  '.py': 'python', '.java': 'java', '.go': 'go', '.rb': 'ruby', '.rs': 'rust', '.php': 'php',
  '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp',
  '.cs': 'c_sharp', '.kt': 'kotlin', '.kts': 'kotlin', '.swift': 'swift', '.scala': 'scala',
  '.dart': 'dart', '.lua': 'lua', '.ex': 'elixir', '.exs': 'elixir',
  '.vue': 'vue', '.svelte': 'svelte', '.sh': 'bash', '.bash': 'bash', '.sql': 'sql',
  '.html': 'html', '.css': 'css', '.scss': 'scss', '.less': 'less', '.graphql': 'graphql', '.gql': 'graphql',
  '.prisma': 'prisma', '.proto': 'protobuf',
  // docs
  '.md': 'markdown', '.mdx': 'markdown', '.rst': 'rst', '.txt': 'text',
  // config
  '.json': 'json', '.yml': 'yaml', '.yaml': 'yaml', '.toml': 'toml', '.ini': 'ini', '.cfg': 'ini',
  '.xml': 'xml', '.gradle': 'gradle', '.properties': 'properties'
};

// Extension-less / dotfiles worth indexing
const NAMED_FILES = {
  'Dockerfile': 'dockerfile', 'Makefile': 'makefile', 'Procfile': 'text', 'Gemfile': 'ruby',
  '.env.example': 'dotenv', '.gitignore': 'text', '.dockerignore': 'text', '.editorconfig': 'ini',
  '.eslintrc': 'json', '.prettierrc': 'json', '.babelrc': 'json', 'LICENSE': 'text'
};

function detectLanguage(fileName) {
  if (NAMED_FILES[fileName]) return NAMED_FILES[fileName];
  if (/^Dockerfile\./.test(fileName)) return 'dockerfile';
  if (/\.min\.(js|css)$/.test(fileName) || /\.map$/.test(fileName)) return null;
  return EXTENSION_LANGUAGES[path.extname(fileName).toLowerCase()] || null;
}

/** Heuristic binary / generated-content check on the first 8KB. */
function looksBinaryOrMinified(buffer) {
  const sample = buffer.subarray(0, 8192);
  if (sample.includes(0)) return true;
  const text = sample.toString('utf8');
  const lines = text.split('\n');
  // Minified bundles: very long average line length
  return text.length > 2000 && text.length / lines.length > 500;
}

/**
 * Recursively list indexable files.
 * @returns {Array<{ absPath, relPath, language, size }>}
 */
function walkRepository(rootDir, { maxFileBytes }) {
  const results = [];
  const stack = [rootDir];

  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) stack.push(absPath);
        continue;
      }
      if (!entry.isFile() || SKIP_FILES.has(entry.name)) continue;
      const language = detectLanguage(entry.name);
      if (!language) continue;
      const size = fs.statSync(absPath).size;
      if (size === 0 || size > maxFileBytes) continue;
      results.push({
        absPath,
        relPath: path.relative(rootDir, absPath).split(path.sep).join('/'),
        language,
        size
      });
    }
  }

  return results.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

module.exports = { walkRepository, detectLanguage, looksBinaryOrMinified };

const fs = require('fs');
const path = require('path');
const { query: pgQuery } = require('../../db/postgres');

// Directories and files to exclude from the visual tree
const IGNORED_NAMES = new Set([
  'node_modules',
  '.git',
  '.gemini',
  '.idea',
  '.vscode',
  'npm-debug.log',
  'package-lock.json',
  '.DS_Store'
]);

// Curated architectural descriptions for repository elements
const FILE_DESCRIPTIONS = {
  // TRACiE descriptions
  'src': 'Core application source code',
  'server.js': 'Express HTTP & SSE server entrypoint and route mounter',
  'config': 'Environment variables and system configuration loader',
  'contracts': 'JSON Schema definitions and mock UI fixtures',
  'prompts': 'System prompts and intent templates for all subagents',
  'routes': 'API route handlers for query, stream, docs, and audio',
  'scripts': 'Automated verification and test suites',
  'services': 'Business logic, AI agents, RAG pipeline, and integrations',
  'agents': 'IBM BeeAI multi-agent supervisor and subagent runner',
  'public': 'Developer canvas frontend and interactive widget renderers',
  'package.json': 'Project manifest, npm scripts, and dependencies',
  'README.md': 'Project overview and documentation',

  // FastAPI descriptions
  'fastapi': 'Core FastAPI web framework package',
  'applications.py': 'Main FastAPI application class and lifespan context manager',
  'routing.py': 'APIRouter and request dispatch execution pipeline',
  'params.py': 'Path, Query, Header, Cookie, Body, and Form parameter extractors',
  'dependencies': 'Dependency injection container and dependency graph resolver',
  'models.py': 'Dependency and request validation model definitions',
  'utils.py': 'Dependency solver, parameter inspection, and schema helpers',
  'security': 'Authentication, OAuth2 password/bearer, and APIKey security schemes',
  'oauth2.py': 'OAuth2 password bearer and authorization code security schemes',
  'api_key.py': 'API key security schemes (query, header, cookie)',
  'http.py': 'HTTP basic and bearer token authentication handlers',
  'openapi': 'OpenAPI 3.1 schema generator, Swagger UI, and ReDoc routers',
  'docs.py': 'HTML template renderers for Swagger UI and ReDoc',
  'constants.py': 'OpenAPI schema constant definitions and default response codes',
  'exceptions.py': 'HTTPException, RequestValidationError, and WebSocketException',
  'encoders.py': 'jsonable_encoder converting Pydantic models to JSON primitives',
  'responses.py': 'JSONResponse, HTMLResponse, StreamingResponse, and FileResponse',
  'datastructures.py': 'UploadFile, FormData, and Default parameter wrappers',
  'middleware': 'ASGI middleware integrations and exception handlers',
  'asyncexitstack.py': 'AsyncExitStack middleware managing dependency context managers',
  'types.py': 'DecoratedCallable, IncEx, and type definitions',
  'websockets.py': 'WebSocket endpoint abstractions and connection manager',
  'concurrency.py': 'Asyncio run_in_threadpool thread executor utilities',
  'docs': 'Internationalized multi-language documentation and tutorials',
  'docs_src': 'Runnable tutorial code examples and tests',
  'tests': 'Pytest test suite covering routing, dependencies, and OpenAPI',
  'pyproject.toml': 'Project metadata, build system configuration, and dependencies'
};

/**
 * Returns the canonical directory structure of the FastAPI framework.
 */
function getCanonicalFastApiTree() {
  return {
    name: 'fastapi',
    type: 'directory',
    description: 'FastAPI - High performance Python web framework built on Starlette and Pydantic',
    children: [
      {
        name: 'fastapi',
        type: 'directory',
        description: 'Core framework package source code',
        children: [
          { name: '__init__.py', type: 'file', description: 'Public API exports (FastAPI, APIRouter, Depends, HTTPException, Query, Path)' },
          { name: 'applications.py', type: 'file', description: 'Main FastAPI application class and lifespan context manager' },
          { name: 'concurrency.py', type: 'file', description: 'Asyncio threadpool helpers (run_in_threadpool)' },
          { name: 'datastructures.py', type: 'file', description: 'UploadFile, FormData, and Default parameter wrappers' },
          {
            name: 'dependencies',
            type: 'directory',
            description: 'Dependency injection container and dependency graph resolver',
            children: [
              { name: '__init__.py', type: 'file', description: 'Dependency package exports' },
              { name: 'models.py', type: 'file', description: 'SecurityRequirement and Dependant model definitions' },
              { name: 'utils.py', type: 'file', description: 'Dependency solver, parameter inspection, and solve_dependencies' }
            ]
          },
          { name: 'encoders.py', type: 'file', description: 'jsonable_encoder converting Pydantic models to JSON primitives' },
          { name: 'exceptions.py', type: 'file', description: 'HTTPException, RequestValidationError, and WebSocketException' },
          {
            name: 'middleware',
            type: 'directory',
            description: 'ASGI middleware implementations',
            children: [
              { name: '__init__.py', type: 'file', description: 'Middleware exports' },
              { name: 'asyncexitstack.py', type: 'file', description: 'AsyncExitStackMiddleware managing dependency cleanup' }
            ]
          },
          {
            name: 'openapi',
            type: 'directory',
            description: 'OpenAPI 3.1 specification and documentation UI generators',
            children: [
              { name: '__init__.py', type: 'file', description: 'OpenAPI generator exports' },
              { name: 'constants.py', type: 'file', description: 'HTTP status codes and OpenAPI schema constants' },
              { name: 'docs.py', type: 'file', description: 'Swagger UI and ReDoc HTML template router endpoints' },
              { name: 'models.py', type: 'file', description: 'Pydantic models representing the OpenAPI specification' },
              { name: 'utils.py', type: 'file', description: 'get_openapi schema generator resolving routes and models' }
            ]
          },
          { name: 'param_functions.py', type: 'file', description: 'Function declarations for Query, Path, Header, Cookie, Body, Form, Depends' },
          { name: 'params.py', type: 'file', description: 'FieldInfo classes for request parameter metadata' },
          { name: 'responses.py', type: 'file', description: 'JSONResponse, HTMLResponse, StreamingResponse, FileResponse' },
          { name: 'routing.py', type: 'file', description: 'APIRouter, APIRoute, and endpoint execution pipeline' },
          {
            name: 'security',
            type: 'directory',
            description: 'Security and authentication schemes',
            children: [
              { name: '__init__.py', type: 'file', description: 'Security scheme exports' },
              { name: 'api_key.py', type: 'file', description: 'APIKeyQuery, APIKeyHeader, and APIKeyCookie schemes' },
              { name: 'http.py', type: 'file', description: 'HTTPBasic, HTTPBearer, and HTTPDigest schemes' },
              { name: 'oauth2.py', type: 'file', description: 'OAuth2, OAuth2PasswordBearer, and OAuth2AuthorizationCodeBearer' },
              { name: 'open_id_connect_url.py', type: 'file', description: 'OpenIdConnect security scheme' }
            ]
          },
          { name: 'types.py', type: 'file', description: 'DecoratedCallable, IncEx, and type definitions' },
          { name: 'utils.py', type: 'file', description: 'General utility functions and route generator helpers' },
          { name: 'websockets.py', type: 'file', description: 'WebSocket endpoint class and connection wrappers' }
        ]
      },
      {
        name: 'docs',
        type: 'directory',
        description: 'Internationalized multi-language documentation and tutorials',
        children: [
          {
            name: 'en',
            type: 'directory',
            description: 'English documentation source',
            children: [
              { name: 'mkdocs.yml', type: 'file', description: 'MkDocs documentation build configuration' },
              {
                name: 'docs',
                type: 'directory',
                description: 'Tutorials and guides',
                children: [
                  { name: 'index.md', type: 'file', description: 'Documentation landing page and quickstart' },
                  { name: 'tutorial', type: 'directory', description: 'Step-by-step user tutorial chapters' },
                  { name: 'advanced', type: 'directory', description: 'Advanced user guides and patterns' },
                  { name: 'how-to', type: 'directory', description: 'How-to recipes and integration guides' }
                ]
              }
            ]
          }
        ]
      },
      {
        name: 'docs_src',
        type: 'directory',
        description: 'Tested Python runnable code snippets used in documentation'
      },
      {
        name: 'tests',
        type: 'directory',
        description: 'Complete test suite (test_tutorial, test_security, test_routing, test_openapi)'
      },
      { name: 'pyproject.toml', type: 'file', description: 'Poetry/Hatch build configuration and dependencies' },
      { name: 'README.md', type: 'file', description: 'FastAPI overview, feature highlights, and benchmarks' },
      { name: 'LICENSE', type: 'file', description: 'MIT Open Source License' }
    ]
  };
}

function getSmartDescription(name, isDirectory) {
  if (FILE_DESCRIPTIONS[name]) return FILE_DESCRIPTIONS[name];
  const lower = name.toLowerCase();
  if (isDirectory) {
    if (lower.includes('test')) return 'Automated test suite and test fixtures';
    if (lower.includes('doc')) return 'Documentation, guides, and tutorials';
    if (lower.includes('util') || lower === 'helpers') return 'Shared utility functions and helper modules';
    if (lower.includes('service')) return 'Business logic and backend services';
    if (lower.includes('route') || lower === 'controllers') return 'Endpoint definitions and request routers';
    if (lower.includes('model') || lower === 'schemas') return 'Domain data models and schemas';
    if (lower.includes('config')) return 'Configuration settings and environment loaders';
    if (lower === 'src' || lower === 'lib' || lower === 'app') return 'Primary application source code';
    if (lower === 'components' || lower === 'views') return 'UI components and view templates';
    if (lower === 'scripts') return 'Automation, build, and deployment scripts';
    if (lower === 'migrations') return 'Database schema migration scripts';
    return '';
  }
  if (lower.endsWith('.md')) return 'Documentation file';
  if (lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'Configuration manifest';
  if (lower.endsWith('.py') || lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.go') || lower.endsWith('.rs')) return 'Source implementation file';
  return '';
}

/**
 * Builds a hierarchical directory tree from an array of relative file paths.
 */
function buildTreeFromFilePaths(filePaths, rootName = 'repository', maxDepth = 4) {
  const root = {
    name: rootName,
    type: 'directory',
    description: `${rootName} repository layout`,
    children: []
  };

  const dirMap = new Map();
  dirMap.set('', root);

  for (const rawPath of filePaths) {
    const parts = rawPath.replace(/\\/g, '/').split('/').filter(Boolean);
    if (!parts.length) continue;

    let currentPath = '';
    let parent = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = (i === parts.length - 1);
      const nextPath = currentPath ? `${currentPath}/${part}` : part;
      const depth = i + 1;

      if (depth > maxDepth) break;

      if (isFile) {
        if (!parent.children.some(c => c.name === part)) {
          parent.children.push({
            name: part,
            type: 'file',
            description: getSmartDescription(part, false)
          });
        }
      } else {
        let dirNode = dirMap.get(nextPath);
        if (!dirNode) {
          dirNode = {
            name: part,
            type: 'directory',
            description: getSmartDescription(part, true),
            children: []
          };
          dirMap.set(nextPath, dirNode);
          parent.children.push(dirNode);
        }
        parent = dirNode;
      }
      currentPath = nextPath;
    }
  }

  function sortChildren(node) {
    if (!node.children || !node.children.length) return;
    node.children.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
    for (const child of node.children) {
      if (child.type === 'directory') sortChildren(child);
    }
  }

  sortChildren(root);
  return root;
}

/**
 * Recursively scans directory on local disk and builds hierarchical file tree object.
 */
function scanDirectory(dirPath, name = 'TRACiE', depth = 0) {
  if (depth > 5) return null;

  try {
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      return {
        name,
        type: 'file',
        description: FILE_DESCRIPTIONS[name] || ''
      };
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const children = [];

    const sorted = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sorted) {
      if (IGNORED_NAMES.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.env.example' && entry.name !== '.gitignore') continue;
      if (entry.name.endsWith('.mp3')) continue;

      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          const subTree = scanDirectory(fullPath, entry.name, depth + 1);
          if (subTree) children.push(subTree);
        } else {
          children.push({
            name: entry.name,
            type: 'file',
            description: FILE_DESCRIPTIONS[entry.name] || ''
          });
        }
      } catch {
        // Ignore unreadable files
      }
    }

    return {
      name,
      type: 'directory',
      description: FILE_DESCRIPTIONS[name] || (depth === 0 ? 'Full Repository Layout' : ''),
      children
    };
  } catch (err) {
    return { name, type: 'directory', children: [] };
  }
}

/**
 * Returns the complete file tree of the TRACiE repository.
 */
function getCompleteRepositoryTree(workspaceRoot) {
  const root = workspaceRoot || path.resolve(__dirname, '../../../');
  return scanDirectory(root, 'TRACiE');
}

/**
 * Dynamically resolves and builds the repository tree for any target repository.
 * Supports:
 * 1. FastAPI (canonical rich framework tree + indexed files)
 * 2. Any connected GitHub repository with rows in indexed_files
 * 3. Chunks-based tree extraction
 * 4. TRACiE local codebase scan
 */
async function getRepositoryTreeForTarget({ repoId, repoName, query = '', chunks = [] } = {}) {
  const qLower = (query || '').toLowerCase();
  const nameLower = (repoName || '').toLowerCase();

  // If asking about FastAPI specifically
  if (qLower.includes('fastapi') || nameLower.includes('fastapi')) {
    return getCanonicalFastApiTree();
  }

  // If asking specifically about TRACiE
  if (qLower.includes('tracie') || nameLower === 'tracie') {
    return getCompleteRepositoryTree();
  }

  // If a repoId is provided, attempt to fetch indexed files from Postgres
  if (repoId && repoId !== 'TRACiE') {
    try {
      const res = await pgQuery(
        'SELECT file_path FROM indexed_files WHERE repository_id = $1 ORDER BY file_path ASC LIMIT 2000',
        [repoId]
      );
      if (res && res.rows && res.rows.length > 0) {
        const paths = res.rows.map(r => r.file_path);
        const displayName = repoName || 'repository';
        return buildTreeFromFilePaths(paths, displayName);
      }
    } catch {
      // Postgres not available or table missing, continue to fallback
    }
  }

  // If chunks are available with file paths from vector retrieval
  if (chunks && chunks.length > 0) {
    const chunkPaths = Array.from(new Set(chunks.map(c => c.file_path).filter(Boolean)));
    if (chunkPaths.length > 0 && !chunkPaths.every(p => p.startsWith('src/'))) {
      const displayName = repoName || 'repository';
      return buildTreeFromFilePaths(chunkPaths, displayName);
    }
  }

  // Default to TRACiE workspace tree ONLY if repo is explicitly TRACiE
  if (nameLower === 'tracie' || qLower.includes('tracie') || (!repoId && !repoName)) {
    return getCompleteRepositoryTree();
  }

  return {
    name: repoName || 'repository',
    type: 'directory',
    path: '/',
    children: []
  };
}

/**
 * Formats the entire repository file tree into a plain text manifest for LLM prompts.
 */
function formatTreeAsText(node, indent = '') {
  if (!node) return '';
  let line = `${indent}${node.type === 'directory' ? '[DIR]' : '[FILE]'} ${node.name}`;
  if (node.description) line += ` - ${node.description}`;
  line += '\n';

  if (node.children) {
    for (const child of node.children) {
      line += formatTreeAsText(child, indent + '  ');
    }
  }
  return line;
}

module.exports = {
  scanDirectory,
  getCompleteRepositoryTree,
  getCanonicalFastApiTree,
  buildTreeFromFilePaths,
  getRepositoryTreeForTarget,
  formatTreeAsText
};

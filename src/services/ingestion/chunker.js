const path = require('path');
const Parser = require('web-tree-sitter');

/**
 * Semantic code chunking.
 *
 * Strategy:
 *  1. Parse with Tree-sitter (WASM build — no native compilation needed).
 *  2. Walk top-level nodes; any node too large to embed is split at its children
 *     (e.g. a class is split into its methods), recursively.
 *  3. Adjacent small units (imports, small functions) are merged up to the size limit.
 *  4. Anything that still doesn't fit, or any file Tree-sitter can't handle,
 *     falls back to fixed line windows with a small overlap.
 *
 * Line numbers in the output are 1-based and inclusive.
 */

// metadata language label -> tree-sitter-wasms grammar name
const GRAMMARS = {
  javascript: 'javascript', typescript: 'typescript', tsx: 'tsx', python: 'python', java: 'java',
  go: 'go', ruby: 'ruby', rust: 'rust', php: 'php', c: 'c', cpp: 'cpp', c_sharp: 'c_sharp',
  kotlin: 'kotlin', swift: 'swift', scala: 'scala', dart: 'dart', lua: 'lua', elixir: 'elixir', bash: 'bash'
};

const MAX_DEPTH = 4;
const WINDOW_OVERLAP_LINES = 5;

let initPromise = null;
const languageCache = new Map(); // grammar -> Promise<Language|null>

function initParser() {
  if (!initPromise) initPromise = Parser.init();
  return initPromise;
}

function loadLanguage(grammar) {
  if (!languageCache.has(grammar)) {
    const promise = (async () => {
      await initParser();
      try {
        const wasmPath = require.resolve(`tree-sitter-wasms/out/tree-sitter-${grammar}.wasm`);
        return await Parser.Language.load(wasmPath);
      } catch (error) {
        console.warn(`[chunker] grammar '${grammar}' unavailable, using window chunking: ${error.message}`);
        return null;
      }
    })();
    languageCache.set(grammar, promise);
  }
  return languageCache.get(grammar);
}

/** Best-effort symbol name for a declaration node. */
function nodeName(node, depth = 0) {
  const nameNode = node.childForFieldName && node.childForFieldName('name');
  if (nameNode) return nameNode.text;
  if (depth >= 2) return null;
  // export default function x / export const x = ... / const x = () => ...
  const declaration = node.childForFieldName && node.childForFieldName('declaration');
  if (declaration) return nodeName(declaration, depth + 1);
  for (const child of node.namedChildren) {
    if (/declarator|definition|declaration/.test(child.type)) {
      const name = nodeName(child, depth + 1);
      if (name) return name;
    }
  }
  return null;
}

function makeSizer(lines) {
  // prefix[i] = total chars of lines[0..i-1] (+1 per newline)
  const prefix = new Array(lines.length + 1);
  prefix[0] = 0;
  for (let i = 0; i < lines.length; i++) prefix[i + 1] = prefix[i] + lines[i].length + 1;
  return (start, end) => prefix[end] - prefix[start - 1]; // 1-based inclusive
}

const DECLARATION = /function|class|method|interface|enum|struct|impl|trait|module|namespace|type_alias|lexical_declaration|variable_declaration|export_statement|decorated_definition/;
const FUNCTION_LIKE = /function|method|arrow|lambda|closure/;

function collectUnits(node, depth, fits, insideFunction = false) {
  const start = node.startPosition.row + 1;
  const end = Math.max(start, node.endPosition.column === 0 ? node.endPosition.row : node.endPosition.row + 1);
  // Only name real declarations; ignore locals declared inside function bodies.
  const name = depth > 0 && !insideFunction && DECLARATION.test(node.type) ? nodeName(node) : null;
  const unit = { start, end, symbols: name ? [name] : [] };

  const children = node.namedChildren;
  if (fits(start, end) || depth >= MAX_DEPTH || children.length === 0) return [unit];

  const childInsideFunction = insideFunction || FUNCTION_LIKE.test(node.type);
  const sub = children.flatMap(child => collectUnits(child, depth + 1, fits, childInsideFunction));
  if (!sub.length) return [unit];
  // Keep the parent's header/footer lines (e.g. `class Foo {` and `}`) attached.
  sub[0].start = Math.min(sub[0].start, start);
  sub[sub.length - 1].end = Math.max(sub[sub.length - 1].end, end);
  if (name) sub.forEach(s => { s.symbols = s.symbols.map(sym => `${name}.${sym}`); if (!s.symbols.length) s.symbols = [name]; });
  return sub;
}

/** Split [start, end] into windows that respect both line and char limits. */
function windowRange(lines, start, end, limits, symbols = []) {
  const out = [];
  let cursor = start;
  while (cursor <= end) {
    let stop = cursor;
    let chars = lines[cursor - 1].length + 1;
    while (
      stop < end &&
      stop - cursor + 1 < limits.maxChunkLines &&
      chars + lines[stop].length + 1 <= limits.maxChunkChars
    ) {
      stop++;
      chars += lines[stop - 1].length + 1;
    }
    out.push({ start: cursor, end: stop, symbols: [...symbols] });
    if (stop >= end) break;
    cursor = Math.max(cursor + 1, stop + 1 - WINDOW_OVERLAP_LINES);
  }
  return out;
}

/** Markdown: one unit per heading section, so docs chunk along their structure. */
function markdownUnits(lines) {
  const units = [];
  let current = { start: 1, symbols: [] };
  lines.forEach((line, i) => {
    const heading = line.match(/^#{1,6}\s+(.*)/);
    if (heading && i > 0) {
      units.push({ ...current, end: i });
      current = { start: i + 1, symbols: [heading[1].trim()] };
    } else if (heading) {
      current.symbols = [heading[1].trim()];
    }
  });
  units.push({ ...current, end: lines.length });
  return units;
}

/** Merge adjacent units up to the limits; window-split anything oversized. */
function packUnits(lines, units, limits) {
  const sizeOf = makeSizer(lines);
  const fits = (s, e) => e - s + 1 <= limits.maxChunkLines && sizeOf(s, e) <= limits.maxChunkChars;
  const chunks = [];
  let current = null;
  const flush = () => { if (current) chunks.push(current); current = null; };

  for (const unit of units) {
    if (current && unit.end <= current.end) {
      current.symbols.push(...unit.symbols);
      continue;
    }
    const start = current ? Math.max(unit.start, current.end + 1) : unit.start;
    if (!fits(start, unit.end)) {
      flush();
      chunks.push(...windowRange(lines, start, unit.end, limits, unit.symbols));
    } else if (current && fits(current.start, unit.end)) {
      current.end = unit.end;
      current.symbols.push(...unit.symbols);
    } else {
      flush();
      current = { start, end: unit.end, symbols: [...unit.symbols] };
    }
  }
  flush();
  return chunks;
}

/**
 * Chunk a single file.
 * @param {object} params
 * @param {string} params.text - file content
 * @param {string} params.language - language label from fileWalker
 * @param {object} params.limits - { maxChunkChars, maxChunkLines }
 * @returns {Promise<{ chunks: Array<{ startLine, endLine, text, symbols }>, method: 'tree-sitter'|'markdown'|'window' }>}
 */
async function chunkFile({ text, language, limits }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  // Hard-wrap pathological long lines so no single line blows the char limit.
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > limits.maxChunkChars) lines[i] = lines[i].slice(0, limits.maxChunkChars - 1);
  }

  let units = null;
  let method = 'window';

  const grammar = GRAMMARS[language];
  if (grammar) {
    try {
      const lang = await loadLanguage(grammar);
      if (lang) {
        const parser = new Parser();
        parser.setLanguage(lang);
        const tree = parser.parse(lines.join('\n'));
        try {
          const sizeOf = makeSizer(lines);
          const fits = (s, e) => e - s + 1 <= limits.maxChunkLines && sizeOf(s, e) <= limits.maxChunkChars;
          units = collectUnits(tree.rootNode, 0, fits).filter(u => u.start <= lines.length);
          units.forEach(u => { u.end = Math.min(u.end, lines.length); });
          method = 'tree-sitter';
        } finally {
          tree.delete();
          parser.delete();
        }
      }
    } catch (error) {
      console.warn(`[chunker] tree-sitter failed (${language}), falling back: ${error.message}`);
      units = null;
    }
  } else if (language === 'markdown') {
    units = markdownUnits(lines);
    method = 'markdown';
  }

  if (!units || !units.length) {
    units = [{ start: 1, end: lines.length, symbols: [] }];
    method = method === 'tree-sitter' ? 'tree-sitter' : 'window';
  }

  const packed = packUnits(lines, units, limits);
  const chunks = packed
    .map(c => ({
      startLine: c.start,
      endLine: c.end,
      text: lines.slice(c.start - 1, c.end).join('\n'),
      symbols: [...new Set(c.symbols)].slice(0, 20)
    }))
    .filter(c => c.text.trim().length > 0);

  return { chunks, method };
}

/** "src/services/rag/pipeline.js" -> "src/services/rag/pipeline" */
function moduleNameFor(relPath) {
  const ext = path.posix.extname(relPath);
  return ext ? relPath.slice(0, -ext.length) : relPath;
}

module.exports = { chunkFile, moduleNameFor };

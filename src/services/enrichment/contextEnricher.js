/**
 * External Context Enrichment Service (FR-33, FR-34)
 * Automatically detects libraries, frameworks, and technical standards present
 * in retrieved code chunks and augments responses with official documentation.
 */

const KNOWLEDGE_BASE = [
  {
    keywords: ['jwt', 'jsonwebtoken', 'verifytoken', 'bearer'],
    title: 'JSON Web Token (JWT) Specification (RFC 7519)',
    url: 'https://datatracker.ietf.org/doc/html/rfc7519',
    source: 'academic_paper',
    description: 'Official IETF standard for digitally signed claims between parties.'
  },
  {
    keywords: ['express', 'cors', 'router', 'app.use', 'middleware'],
    title: 'Express.js Routing & Middleware Guide',
    url: 'https://expressjs.com/en/guide/routing.html',
    source: 'official_docs',
    description: 'Official Express documentation on application routing and middleware chains.'
  },
  {
    keywords: ['cors', 'cross-origin'],
    title: 'MDN Web Docs: Cross-Origin Resource Sharing (CORS)',
    url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS',
    source: 'MDN',
    description: 'Comprehensive MDN guide on HTTP-header based CORS access mechanisms.'
  },
  {
    keywords: ['eventsource', 'server-sent events', 'text/event-stream', 'sse'],
    title: 'MDN Web Docs: Server-Sent Events API',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events',
    source: 'MDN',
    description: 'Standard specification for persistent, unidirectional server-to-client streaming.'
  },
  {
    keywords: ['chroma', 'chromadb', 'ann', 'embedding', 'vector'],
    title: 'ChromaDB Core Architecture & Similarity Search',
    url: 'https://docs.trychroma.com/getting-started',
    source: 'official_docs',
    description: 'Technical overview of vector embeddings, HNSW graphs, and nearest neighbor search.'
  },
  {
    keywords: ['watsonx', 'granite', 'slate', 'ibm cloud'],
    title: 'IBM watsonx.ai & Granite Model Documentation',
    url: 'https://www.ibm.com/products/watsonx-ai',
    source: 'official_docs',
    description: 'Official IBM platform documentation for enterprise Granite foundation models.'
  },
  {
    keywords: ['tree-sitter', 'ast', 'syntax tree', 'chunking'],
    title: 'Tree-sitter Parser Generator & Incremental Syntax',
    url: 'https://tree-sitter.github.io/tree-sitter/',
    source: 'official_docs',
    description: 'Concrete syntax tree library for multi-language semantic code boundary parsing.'
  },
  {
    keywords: ['postgres', 'pg', 'pool', 'database_url', 'relational'],
    title: 'PostgreSQL 16 Connection Pooling & Concurrency Guide',
    url: 'https://www.postgresql.org/docs/current/server-shutdown.html',
    source: 'official_docs',
    description: 'PostgreSQL architectural standards on pool management and transaction safety.'
  },
  {
    keywords: ['mermaid', 'diagram', 'graph td', 'flowchart'],
    title: 'Mermaid.js Diagram Syntax & Flowchart Standards',
    url: 'https://mermaid.js.org/intro/',
    source: 'official_docs',
    description: 'Mermaid open-source JavaScript-based diagramming and charting tool specification.'
  }
];

/**
 * Inspects code chunks and query text to detect relevant external documentation references.
 *
 * @param {object} params
 * @param {Array<object>} params.chunks - Codebase context chunks.
 * @param {string} params.query - User natural language query.
 * @param {number} [params.maxReferences=3] - Maximum references to return.
 * @returns {Array<object>} - Matched external references.
 */
function detectExternalReferences({ chunks = [], query = '', maxReferences = 3 }) {
  const corpus = (
    query + ' ' +
    chunks.map(c => (c.content || '') + ' ' + (c.file_path || '')).join(' ')
  ).toLowerCase();

  const matched = [];
  const seenUrls = new Set();

  for (const item of KNOWLEDGE_BASE) {
    const hasMatch = item.keywords.some(kw => corpus.includes(kw));
    if (hasMatch && !seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      matched.push({
        title: item.title,
        url: item.url,
        source: item.source,
        description: item.description
      });
      if (matched.length >= maxReferences) break;
    }
  }

  return matched;
}

/**
 * Formats external references into a prompt context section for the LLM.
 * @param {Array<object>} references
 * @returns {string}
 */
function formatExternalReferencesForPrompt(references) {
  if (!references || references.length === 0) return '';

  return (
    `\nEXTERNAL DOCUMENTATION & STANDARDS (ENRICHMENT):\n` +
    references.map((r, i) => `[${i + 1}] ${r.title} (${r.source}): ${r.description} - ${r.url}`).join('\n') +
    `\n`
  );
}

module.exports = {
  detectExternalReferences,
  formatExternalReferencesForPrompt,
  KNOWLEDGE_BASE
};

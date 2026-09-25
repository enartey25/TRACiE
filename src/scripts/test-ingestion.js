/**
 * Ingestion smoke test that does NOT need Postgres:
 *   clone -> walk -> chunk -> embed -> upsert into ChromaDB -> query back.
 *
 * Usage: npm run test:ingest [-- https://github.com/owner/repo]
 * Requires ChromaDB running (npm run chroma).
 */
const crypto = require('crypto');
const fs = require('fs');
const config = require('../config/backend');
const { cloneRepository } = require('../services/ingestion/fetchRepo');
const { walkRepository, looksBinaryOrMinified } = require('../services/ingestion/fileWalker');
const { chunkFile, moduleNameFor } = require('../services/ingestion/chunker');
const { embedTexts, embedText } = require('../services/ingestion/embedder');
const chroma = require('../db/chroma');

async function main() {
  const url = process.argv[2] || 'https://github.com/expressjs/cors';
  const repositoryId = `smoke-test-${crypto.randomBytes(3).toString('hex')}`;
  const started = Date.now();

  console.log(`Cloning ${url} ...`);
  const { dir, commitSha, cleanup } = await cloneRepository({ url, jobId: repositoryId });
  try {
    const files = walkRepository(dir, { maxFileBytes: config.ingestion.maxFileBytes });
    console.log(`Commit ${commitSha}; ${files.length} indexable files`);

    const chunks = [];
    const methods = {};
    for (const file of files) {
      const buffer = fs.readFileSync(file.absPath);
      if (looksBinaryOrMinified(buffer)) continue;
      const result = await chunkFile({ text: buffer.toString('utf8'), language: file.language, limits: config.ingestion });
      methods[result.method] = (methods[result.method] || 0) + 1;
      for (const c of result.chunks) {
        chunks.push({
          chunkId: `${repositoryId}_${file.relPath}_${c.startLine}`, repositoryId, filePath: file.relPath,
          language: file.language, text: c.text, startLine: c.startLine, endLine: c.endLine,
          moduleName: moduleNameFor(file.relPath), symbols: c.symbols.join(', ')
        });
      }
    }
    console.log(`${chunks.length} chunks; files by method: ${JSON.stringify(methods)}`);

    const vectors = await embedTexts(chunks.map(c => c.text));
    chunks.forEach((c, i) => { c.embedding = vectors[i]; });
    await chroma.upsertChunks(chunks);
    console.log(`Upserted into ChromaDB (dim=${vectors[0].length}) in ${((Date.now() - started) / 1000).toFixed(1)}s`);

    // Query with an exact chunk's text: with any embedding (even mock) it must come back first.
    const probe = chunks[Math.floor(chunks.length / 2)];
    const hits = await chroma.queryChunks({ embedding: await embedText(probe.text), repositoryId, topK: 3 });
    console.log('Top hits:', hits.map(h => `${h.file_path}:${h.start_line}-${h.end_line} (d=${h.distance.toFixed(3)})`));
    if (hits[0].chunk_id !== probe.chunkId) throw new Error('Round-trip query did not return the probe chunk first');

    await chroma.deleteRepositoryChunks(repositoryId);
    console.log('PASS — cleaned up test chunks');
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});

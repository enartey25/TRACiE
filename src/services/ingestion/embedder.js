/**
 * ============================================================
 *  EMBEDDING PLUG-IN POINT (Ethan)
 * ============================================================
 * Ingestion only ever calls embedTexts() below. It delegates to Ethan's
 * watsonx embedding module, which falls back to deterministic mock vectors
 * when WATSONX_APIKEY / WATSONX_PROJECT_ID are not set.
 *
 * To swap providers, change only this file. Contract:
 *   embedTexts(texts: string[]) => Promise<number[][]>   (same order, same length)
 *
 * IMPORTANT: queries must be embedded with the same model as ingestion,
 * otherwise retrieval silently returns garbage.
 */
const { generateEmbedding, generateEmbeddings } = require('../watsonx/embedding');

async function embedTexts(texts) {
  return generateEmbeddings(texts);
}

async function embedText(text) {
  return generateEmbedding(text);
}

module.exports = { embedTexts, embedText };

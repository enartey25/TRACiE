const { generateGroqCompletion } = require('../groq/generator');
const { parseAndValidateWidgetJSON } = require('../rag/jsonParser');

/**
 * Emits an agent thought event if the callback is provided.
 * @param {Function|undefined} onThought
 * @param {object} payload
 */
function emit(onThought, payload) {
  if (onThought) onThought(payload);
}

/**
 * Generic subagent runner. Shared by all specialized subagents in TRACiE.
 *
 * @param {object} params
 * @param {string} params.agentName          - Display name of the subagent.
 * @param {string} params.action             - Thought action label emitted before inference.
 * @param {string} params.thought            - Thought text emitted before inference.
 * @param {string} params.systemPrompt       - System-level instruction for the LLM.
 * @param {Function} params.buildPrompt      - Function(query, chunks, ...) => string.
 * @param {string} params.query
 * @param {Array<object>} params.chunks
 * @param {string} [params.conversationHistory] - Formatted prior turns.
 * @param {string} [params.externalContext]     - Enriched documentation context.
 * @param {Function} [params.onThought]
 * @returns {Promise<object>} Validated widget with `_agent` and `_meta` set.
 */
async function runSubagent({
  agentName,
  action,
  thought,
  systemPrompt,
  buildPrompt,
  query,
  chunks,
  conversationHistory = '',
  externalContext = '',
  onThought
}) {
  emit(onThought, { agent: agentName, action, thought });

  const prompt = buildPrompt({
    query,
    chunks,
    conversationHistory,
    externalContext
  });

  const { generatedText, metadata } = await generateGroqCompletion({ prompt, systemPrompt });

  const widget = parseAndValidateWidgetJSON(generatedText);
  widget._agent = agentName;
  widget._meta = metadata;
  return widget;
}

module.exports = { runSubagent };

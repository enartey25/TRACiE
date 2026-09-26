const { generateGroqCompletion } = require('../groq/generator');
const { generateHuggingFaceCompletion } = require('../huggingface/generator');
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

  const provider = (process.env.LLM_PROVIDER || 'groq').toLowerCase();
  let generatedText;
  let metadata;

  if (provider === 'huggingface' || provider === 'granite') {
    const res = await generateHuggingFaceCompletion({ prompt, systemPrompt });
    generatedText = res.generatedText;
    metadata = res.metadata;
  } else if (provider === 'watsonx') {
    const { generateText } = require('../watsonx/generator');
    const res = await generateText({ prompt });
    generatedText = res.generatedText;
    metadata = res.metadata;
  } else {
    const res = await generateGroqCompletion({ prompt, systemPrompt });
    generatedText = res.generatedText;
    metadata = res.metadata;
  }

  const widget = parseAndValidateWidgetJSON(generatedText);
  widget._agent = agentName;
  widget._meta = metadata;

  // If this is an audio briefing subagent, synthesize the actual studio MP3 audio via ElevenLabs
  if (widget.type === 'audio_player' && widget.transcript) {
    emit(onThought, {
      agent: agentName,
      action: 'audio_synthesis',
      thought: 'Synthesizing ultra-realistic audio stream via ElevenLabs Studio Voice API...'
    });
    try {
      const { synthesizeBriefing } = require('../audio/ttsService');
      const audioResult = await synthesizeBriefing({
        title: widget.title || 'Codebase Audio Briefing',
        text: widget.transcript
      });
      if (audioResult && audioResult.audio_url) {
        widget.audio_url = audioResult.audio_url;
        widget.provider = audioResult.provider;
        widget.duration_seconds = audioResult.duration_seconds;
      }
    } catch (audioErr) {
      console.warn('Audio synthesis warning in subagent:', audioErr.message);
    }
  }

  // If this is a repository navigator subagent, guarantee the entire file tree is provided
  if (widget.type === 'file_tree') {
    const { getCompleteRepositoryTree } = require('../navigator/repositoryScanner');
    const fullTree = getCompleteRepositoryTree();
    if (!widget.root || !widget.root.children || widget.root.children.length < fullTree.children.length) {
      widget.root = fullTree;
    }
    widget.title = widget.title || 'Complete TRACiE Repository Layout';
  }

  return widget;
}

module.exports = { runSubagent };

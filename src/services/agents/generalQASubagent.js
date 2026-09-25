const { generateGroqCompletion } = require('../groq/generator');
const { parseAndValidateWidgetJSON } = require('../rag/jsonParser');

/**
 * General QA Subagent: Grounded conversational explanations with source citations.
 */
async function runGeneralQASubagent({ query, chunks, onThought }) {
  if (onThought) {
    onThought({
      agent: 'GeneralQASubagent',
      action: 'ground_synthesis',
      thought: 'Synthesizing verified markdown explanation from retrieved code chunks.'
    });
  }

  const prompt = `You are the General QA Subagent in the TRACiE multi-agent system.
Answer the developer question strictly based on the provided code chunks.

CODE CHUNKS:
${chunks.map(c => `[File: ${c.file_path} (Lines ${c.start_line}-${c.end_line})]\n${c.content}`).join('\n\n')}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "chat_response",
  "content": "Comprehensive markdown explanation",
  "citations": [
    {
      "file_path": "File path",
      "start_line": 1,
      "end_line": 20,
      "snippet": "Relevant code snippet"
    }
  ]
}`;

  const { generatedText, metadata } = await generateGroqCompletion({
    prompt,
    systemPrompt: 'You are an onboarding assistant. Output ONLY valid JSON matching the schema.'
  });

  const widget = parseAndValidateWidgetJSON(generatedText);
  widget._agent = 'GeneralQASubagent';
  widget._meta = metadata;
  return widget;
}

module.exports = { runGeneralQASubagent };

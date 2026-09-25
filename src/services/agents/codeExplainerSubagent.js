const { generateGroqCompletion } = require('../groq/generator');
const { parseAndValidateWidgetJSON } = require('../rag/jsonParser');

/**
 * Code Explainer Subagent: Analyzes functions, AST, and creates syntax-highlighted snippets.
 */
async function runCodeExplainerSubagent({ query, chunks, onThought }) {
  if (onThought) {
    onThought({
      agent: 'CodeExplainerSubagent',
      action: 'inspect_implementation',
      thought: 'Extracting source implementation, parameters, and line boundaries from code chunks.'
    });
  }

  const prompt = `You are the Code Explainer Subagent in the TRACiE multi-agent system.
Inspect the code chunks and present the specific implementation answering the query.

CODE CHUNKS:
${chunks.map(c => `[File: ${c.file_path} (Lines ${c.start_line}-${c.end_line})]\n${c.content}`).join('\n\n')}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "code_snippet",
  "file_path": "Path to primary source file",
  "language": "javascript",
  "start_line": 1,
  "end_line": 35,
  "code": "Exact or cleaned code snippet",
  "explanation": "Clear explanation of how the code works"
}`;

  const { generatedText, metadata } = await generateGroqCompletion({
    prompt,
    systemPrompt: 'You are an expert code analyst. Output ONLY valid JSON matching the schema.'
  });

  const widget = parseAndValidateWidgetJSON(generatedText);
  widget._agent = 'CodeExplainerSubagent';
  widget._meta = metadata;
  return widget;
}

module.exports = { runCodeExplainerSubagent };

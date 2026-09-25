const { generateGroqCompletion } = require('../groq/generator');
const { parseAndValidateWidgetJSON } = require('../rag/jsonParser');

/**
 * Architect Subagent: Analyzes system topology and generates Mermaid DSL diagrams.
 */
async function runArchitectSubagent({ query, chunks, onThought }) {
  if (onThought) {
    onThought({
      agent: 'ArchitectSubagent',
      action: 'analyze_topology',
      thought: 'Extracting module boundaries and data flow from code chunks to synthesize Mermaid diagram.'
    });
  }

  const prompt = `You are the Architect Subagent in the TRACiE multi-agent system.
Based on the code chunks, generate a valid Mermaid.js architecture diagram.

CODE CHUNKS:
${chunks.map(c => `[File: ${c.file_path}]\n${c.content}`).join('\n\n')}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "architecture_diagram",
  "title": "Clear Diagram Title",
  "diagram_source": "Valid Mermaid DSL e.g. graph TD\\n  A-->B",
  "caption": "Explanation of the architecture"
}`;

  const { generatedText, metadata } = await generateGroqCompletion({
    prompt,
    systemPrompt: 'You are an expert software architect. Output ONLY valid JSON matching the schema.'
  });

  const widget = parseAndValidateWidgetJSON(generatedText);
  widget._agent = 'ArchitectSubagent';
  widget._meta = metadata;
  return widget;
}

module.exports = { runArchitectSubagent };

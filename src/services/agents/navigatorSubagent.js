const { generateGroqCompletion } = require('../groq/generator');
const { parseAndValidateWidgetJSON } = require('../rag/jsonParser');

/**
 * Navigator Subagent: Synthesizes repository directory trees and module layouts.
 */
async function runNavigatorSubagent({ query, chunks, onThought }) {
  if (onThought) {
    onThought({
      agent: 'NavigatorSubagent',
      action: 'map_file_hierarchy',
      thought: 'Aggregating file paths and directory trees from retrieved repository chunks.'
    });
  }

  const prompt = `You are the Navigator Subagent in the TRACiE multi-agent system.
Generate a hierarchical file tree representing the project structure.

CODE CHUNKS:
${chunks.map(c => `[File: ${c.file_path}]`).join('\n')}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "file_tree",
  "title": "Repository Structure",
  "root": {
    "name": "TRACiE",
    "type": "directory",
    "children": [
      {
        "name": "src",
        "type": "directory",
        "children": [
          { "name": "server.js", "type": "file" },
          { "name": "routes", "type": "directory", "children": [] }
        ]
      },
      { "name": "package.json", "type": "file" }
    ]
  }
}`;

  const { generatedText, metadata } = await generateGroqCompletion({
    prompt,
    systemPrompt: 'You are a repository navigation specialist. Output ONLY valid JSON matching the schema.'
  });

  const widget = parseAndValidateWidgetJSON(generatedText);
  widget._agent = 'NavigatorSubagent';
  widget._meta = metadata;
  return widget;
}

module.exports = { runNavigatorSubagent };

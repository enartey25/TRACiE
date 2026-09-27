const axios = require('axios');
const config = require('../../config/watsonx');
const { getAuthHeaders, hasValidCredentials } = require('./auth');

/**
 * Fallback generator for local development/testing without live IBM credentials.
 */
function generateMockResponse(prompt) {
  // Extract developer query if prompt has delimiters
  let queryText = prompt;
  const queryMarker = 'DEVELOPER QUERY:';
  if (prompt.includes(queryMarker)) {
    queryText = prompt.substring(prompt.indexOf(queryMarker) + queryMarker.length);
    const reminderMarker = 'REMINDER:';
    if (queryText.includes(reminderMarker)) {
      queryText = queryText.substring(0, queryText.indexOf(reminderMarker));
    }
  }
  const lower = queryText.toLowerCase();

  const repoMatch = prompt.match(/\b(?:MODULE MANIFEST|CODE CHUNKS|repository|codebase)\s*\(([^\)]+)\)/i) || prompt.match(/(?:for|about|visualizing the)\s+([a-zA-Z0-9_\-\/]+)\s+codebase/i);
  const isTracieExplicit = lower.includes('tracie') && !lower.includes('pandas') && !lower.includes('fastapi');
  const targetRepo = isTracieExplicit ? 'TRACiE' : (repoMatch ? repoMatch[1].trim() : (lower.includes('pandas') ? 'pandas-dev/pandas' : (lower.includes('fastapi') ? 'fastapi/fastapi' : 'the target repository')));

  if (lower.includes('architecture') || lower.includes('diagram') || lower.includes('flow')) {
    return JSON.stringify({
      type: "architecture_diagram",
      title: `${targetRepo} Architecture Flow`,
      diagram_source: `graph TD\n    Core[${targetRepo} Core Engine] --> API[Interface & Public APIs]\n    Core --> Storage[Data Structures & Engines]\n    Core --> Utils[Utilities & Internals]`,
      caption: `High-level component interaction of ${targetRepo}.`
    });
  }

  if (lower.includes('code') || lower.includes('snippet') || lower.includes('token') || lower.includes('auth')) {
    const isPandas = targetRepo.includes('pandas');
    return JSON.stringify({
      type: "code_snippet",
      file_path: isPandas ? "pandas/core/dtypes/common.py" : "src/index.js",
      language: isPandas ? "python" : "javascript",
      start_line: 1,
      end_line: 25,
      code: isPandas
        ? "def is_datetime_or_timedelta_dtype(arr_or_dtype):\n    return is_datetime64_any_dtype(arr_or_dtype) or is_timedelta64_dtype(arr_or_dtype)"
        : "module.exports = { init: () => console.log('Initialized') };",
      explanation: `Core implementation logic from ${targetRepo}.`
    });
  }

  if (lower.includes('tree') || lower.includes('structure') || lower.includes('folders')) {
    return JSON.stringify({
      type: "file_tree",
      title: `${targetRepo} Repository Layout`,
      root: {
        name: targetRepo,
        type: "directory",
        path: "/",
        children: [
          { name: "core", type: "directory", path: "/core", children: [] },
          { name: "tests", type: "directory", path: "/tests", children: [] },
          { name: "docs", type: "directory", path: "/docs", children: [] }
        ]
      }
    });
  }

  if (lower.includes('config') || lower.includes('overview') || lower.includes('summary')) {
    return JSON.stringify({
      type: "composite_dashboard",
      title: `${targetRepo} Overview`,
      description: `Auto-generated onboarding briefing based on ${targetRepo} code chunks.`,
      components: [
        {
          type: "chat_response",
          content: `### Welcome to ${targetRepo}\n\nThis codebase provides core engineering mechanisms. All analysis and answers are grounded strictly in the repository source code and citations.`,
          citations: []
        },
        {
          type: "key_value_list",
          title: "Repository Overview",
          items: [
            { key: "Target Repository", value: targetRepo, description: "Active codebase" },
            { key: "Status", value: "Ready", description: "Indexed in vector database" }
          ]
        }
      ]
    });
  }

  // Default: chat_response with citations
  return JSON.stringify({
    type: "chat_response",
    content: "Based on the retrieved code chunks in the repository, this module initializes services and manages the data flow between components. See cited source files below.",
    citations: [
      {
        file_path: "src/services/rag/pipeline.js",
        start_line: 10,
        end_line: 45,
        snippet: "async function executeRAGQuery(...) { ... }"
      }
    ]
  });
}

/**
 * Invokes IBM watsonx.ai Text Generation endpoint.
 * @param {object} params
 * @param {string} params.prompt - Input prompt string.
 * @param {object} [params.parameters] - Generation hyper-parameters.
 * @param {string} [params.modelId] - watsonx model ID.
 * @param {string} [params.projectId] - watsonx project ID.
 * @returns {Promise<{ generatedText: string, metadata: object }>}
 */
async function generateText({ prompt, parameters = {}, modelId, projectId }) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt must be a non-empty string.');
  }

  if (!hasValidCredentials()) {
    const mockText = generateMockResponse(prompt);
    return {
      generatedText: mockText,
      metadata: {
        modelId: 'mock-watsonx-granite',
        tokenCount: mockText.length / 4,
        stopReason: 'mock_complete'
      }
    };
  }

  const headers = await getAuthHeaders();
  const url = `${config.url}/ml/v1/text/generation?version=${config.apiVersion}`;
  const targetModel = modelId || config.generationModelId;
  const targetProject = projectId || config.projectId;

  const defaultParams = {
    decoding_method: 'greedy',
    max_new_tokens: 1500,
    min_new_tokens: 1,
    repetition_penalty: 1.05,
    stop_sequences: []
  };

  const payload = {
    input: prompt,
    parameters: { ...defaultParams, ...parameters },
    model_id: targetModel,
    project_id: targetProject
  };

  try {
    const response = await axios.post(url, payload, { headers, timeout: 30000 });

    if (
      response.data &&
      response.data.results &&
      response.data.results[0] &&
      response.data.results[0].generated_text !== undefined
    ) {
      const result = response.data.results[0];
      return {
        generatedText: result.generated_text,
        metadata: {
          modelId: targetModel,
          inputTokenCount: result.input_token_count,
          generatedTokenCount: result.generated_token_count,
          stopReason: result.stop_reason
        }
      };
    }

    throw new Error('Unexpected response structure from watsonx.ai generation endpoint.');
  } catch (error) {
    const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
    throw new Error(`watsonx.ai text generation failed: ${errorDetails}`);
  }
}

module.exports = {
  generateText,
  generateMockResponse
};

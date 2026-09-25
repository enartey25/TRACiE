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

  if (lower.includes('architecture') || lower.includes('diagram') || lower.includes('flow')) {
    return JSON.stringify({
      type: "architecture_diagram",
      title: "System Architecture Flow",
      diagram_source: "graph TD\n    Client[Web UI] --> API[Node.js Express Server]\n    API --> Watson[watsonx.ai]\n    API --> Chroma[ChromaDB]\n    API --> DB[(PostgreSQL)]",
      caption: "High-level component interaction of TRACiE codebase onboarding platform."
    });
  }

  if (lower.includes('code') || lower.includes('snippet') || lower.includes('token') || lower.includes('auth')) {
    return JSON.stringify({
      type: "code_snippet",
      file_path: "src/services/watsonx/auth.js",
      language: "javascript",
      start_line: 14,
      end_line: 38,
      code: "async function getIamToken() {\n  const params = new URLSearchParams();\n  params.append('grant_type', 'urn:ibm:params:oauth:grant-type:apikey');\n  params.append('apikey', config.apiKey);\n\n  const res = await axios.post('https://iam.cloud.ibm.com/identity/token', params.toString());\n  return res.data.access_token;\n}",
      explanation: "IBM Cloud IAM OAuth token generation function using API key credentials."
    });
  }

  if (lower.includes('tree') || lower.includes('structure') || lower.includes('folders')) {
    return JSON.stringify({
      type: "file_tree",
      title: "Repository File Hierarchy",
      root: {
        name: "TRACiE",
        type: "directory",
        path: "/",
        children: [
          {
            name: "src",
            type: "directory",
            path: "/src",
            children: [
              { name: "config", type: "directory", path: "/src/config", children: [] },
              { name: "services", type: "directory", path: "/src/services", children: [] },
              { name: "routes", type: "directory", path: "/src/routes", children: [] }
            ]
          },
          { name: "package.json", type: "file", path: "/package.json" },
          { name: ".gitignore", type: "file", path: "/.gitignore" }
        ]
      }
    });
  }

  if (lower.includes('config') || lower.includes('overview') || lower.includes('summary')) {
    return JSON.stringify({
      type: "composite_dashboard",
      title: "Project Quick-Start Overview",
      description: "Auto-generated onboarding briefing based on repository code chunks.",
      components: [
        {
          type: "chat_response",
          content: "### Welcome to the TRACiE Repository\n\nThis project provides an AI-powered onboarding assistant for software engineering teams. It connects directly to the repository and provides grounded, verified answers with file/line citations.",
          citations: [
            {
              file_path: "src/server.js",
              start_line: 1,
              end_line: 25,
              snippet: "const express = require('express');"
            }
          ]
        },
        {
          type: "key_value_list",
          title: "System Parameters",
          items: [
            { key: "Runtime", value: "Node.js v24+", description: "Backend runtime environment" },
            { key: "Vector DB", value: "ChromaDB", description: "Storage for semantic code embeddings" },
            { key: "AI Foundation", value: "IBM watsonx.ai", description: "Granite & Slate models" }
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

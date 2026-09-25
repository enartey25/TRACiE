/**
 * Sanitizes and parses raw LLM output into a verified widget JSON object.
 * Implements fallback repair for markdown code fences and malformed tokens.
 *
 * @param {string} rawText - Raw text output from watsonx.ai.
 * @param {object} [fallbackContext] - Optional context for error cards.
 * @returns {object} - Valid widget object containing at minimum a 'type' property.
 */
function parseAndValidateWidgetJSON(rawText, fallbackContext = {}) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      type: 'alert_card',
      severity: 'error',
      title: 'Empty Response',
      message: 'watsonx.ai returned an empty or invalid response.'
    };
  }

  let text = rawText.trim();

  // Strip markdown code fences if present (e.g. ```json ... ```)
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  // Attempt direct JSON parse
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && parsed.type) {
      return parsed;
    }
  } catch (initialErr) {
    // Extraction strategy: find substring between the first { and the last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.substring(firstBrace, lastBrace + 1);
      try {
        const parsedCandidate = JSON.parse(candidate);
        if (parsedCandidate && typeof parsedCandidate === 'object' && parsedCandidate.type) {
          return parsedCandidate;
        }
      } catch (subErr) {
        // Failed substring parse; proceed to graceful fallback
      }
    }
  }

  // Fallback: If LLM output could not be parsed as typed JSON, wrap it as chat_response
  return {
    type: 'chat_response',
    content: text,
    citations: fallbackContext.citations || []
  };
}

module.exports = {
  parseAndValidateWidgetJSON
};

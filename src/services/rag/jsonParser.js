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
      message: 'The LLM returned an empty or invalid response.'
    };
  }

  let text = rawText.trim();

  // Strip markdown code fences if present (e.g. ```json ... ```)
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  function resolveQuizCorrectIndex(q) {
    if (!q || typeof q !== 'object') return 0;
    const opts = Array.isArray(q.options) ? q.options : [];
    const raw = q.correct_index !== undefined ? q.correct_index :
      (q.correctIndex !== undefined ? q.correctIndex :
      (q.correct_option !== undefined ? q.correct_option :
      (q.correctOption !== undefined ? q.correctOption :
      (q.correct_answer !== undefined ? q.correct_answer :
      (q.correctAnswer !== undefined ? q.correctAnswer :
      (q.answer_index !== undefined ? q.answer_index :
      (q.answerIndex !== undefined ? q.answerIndex :
      (q.answer !== undefined ? q.answer :
      (q.correct !== undefined ? q.correct : undefined)))))))));

    if (raw === undefined || raw === null) return 0;

    if (typeof raw === 'number') {
      if (opts.length > 0 && raw === opts.length) return raw - 1;
      if (raw >= 0 && raw < opts.length) return raw;
      if (raw > 0 && raw <= opts.length) return raw - 1;
      return raw;
    }

    const str = String(raw).trim();
    if (/^\d+$/.test(str)) {
      const num = parseInt(str, 10);
      if (opts.length > 0 && num === opts.length) return num - 1;
      if (num >= 0 && num < opts.length) return num;
      if (num > 0 && num <= opts.length) return num - 1;
      return num;
    }

    const letterMatch = str.match(/(?:option\s+|^)([A-E])(?:\b|[\.\:\s\)])/i);
    if (letterMatch) {
      const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
      if (idx >= 0 && (opts.length === 0 || idx < opts.length)) return idx;
    }

    const lowerStr = str.toLowerCase();
    for (let i = 0; i < opts.length; i++) {
      const optText = typeof opts[i] === 'string' ? opts[i] : (opts[i].text || opts[i].label || String(opts[i]));
      const cleanOpt = optText.replace(/^[A-E][\.\)\:\s]\s*/i, '').trim().toLowerCase();
      if (cleanOpt && (cleanOpt === lowerStr || lowerStr.includes(cleanOpt) || cleanOpt.includes(lowerStr))) {
        return i;
      }
    }

    return 0;
  }

  // Some models (observed with Groq's gpt-oss-120b on Mermaid output specifically — plain
  // prose/code fields from the same model come through fine) double-escape control characters
  // inside the DSL string: the JSON value ends up containing literal "\" + "n" / "\" + '"'
  // instead of a real line break / quote. Mermaid requires real newlines between statements and
  // real quotes around labels, and neither literal sequence has a legitimate use in diagram
  // source, so unescaping is always safe once we've detected the pattern.
  function unescapeDiagramSource(s) {
    if (typeof s !== 'string' || !s.includes('\\n') || s.includes('\n')) return s;
    return s.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\t/g, '  ').replace(/\\"/g, '"');
  }

  function normalizeWidget(obj) {
    if (!obj || typeof obj !== 'object') return null;

    // Detect any diagram-like object by checking all known DSL field aliases
    const MERMAID_START = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|journey|C4Context)\b/;
    const dslValue = unescapeDiagramSource(obj.diagram_source || obj.mermaidcode || obj.mermaidCode || obj.mermaid_code ||
      obj.diagramSource || obj.mermaid || obj.diagram || obj.dsl || obj.flowchart || obj.code || '');
    const isDiagram = obj.diagramtype || obj.diagram_type || obj.diagramType ||
      obj.mermaidcode || obj.mermaidCode || obj.mermaid_code ||
      (typeof obj.diagram_source === 'string') ||
      (typeof obj.mermaid === 'string' && MERMAID_START.test(obj.mermaid.trim())) ||
      (typeof obj.diagram === 'string' && MERMAID_START.test(obj.diagram.trim())) ||
      obj.type === 'flowchart' || obj.type === 'diagram' || obj.type === 'architecture_diagram';

    if (isDiagram) {
      obj.type = 'architecture_diagram';
      obj.diagram_source = dslValue;
    }

    // Models sometimes ignore the "type"/"content" field names from the prompt and answer
    // under a plain "answer" or "response" key instead. Rescue that into chat_response
    // rather than falling through to dumping the raw JSON text as the chat message.
    if (!obj.type && typeof (obj.answer || obj.response) === 'string') {
      obj.type = 'chat_response';
      obj.content = obj.answer || obj.response;
    }

    if (obj.type === 'quiz') {
      if (Array.isArray(obj.questions)) {
        obj.questions = obj.questions.map(q => ({
          ...q,
          correct_index: resolveQuizCorrectIndex(q)
        }));
      } else {
        obj.correct_index = resolveQuizCorrectIndex(obj);
      }
    }

    if (obj.type) return obj;
    return null;
  }

  // Attempt direct JSON parse
  try {
    const parsed = JSON.parse(text);
    const normalized = normalizeWidget(parsed);
    if (normalized) return normalized;
  } catch (initialErr) {
    // Extraction strategy: find substring between the first { and the last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.substring(firstBrace, lastBrace + 1);
      try {
        const parsedCandidate = JSON.parse(candidate);
        const normalizedCandidate = normalizeWidget(parsedCandidate);
        if (normalizedCandidate) return normalizedCandidate;
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

/**
 * TRACiE Multi-Turn Session Memory Service
 * Manages active conversation history per session, supporting context-aware follow-up queries.
 * Designed with in-memory caching and clean integration hooks for Gabriel's PostgreSQL database.
 */

const sessionStore = new Map();
const MAX_TURNS_PER_SESSION = 10;

/**
 * Adds a completed turn (user query + resulting widget summary) to session history.
 * @param {string} sessionId - Unique session UUID.
 * @param {object} turnData
 * @param {string} turnData.query - User natural language query.
 * @param {object} turnData.widget - Resulting UI widget object.
 */
function recordTurn(sessionId, { query, widget }) {
  if (!sessionId) return;

  if (!sessionStore.has(sessionId)) {
    sessionStore.set(sessionId, []);
  }

  const history = sessionStore.get(sessionId);

  // Extract concise summary of widget to prevent prompt bloat
  let summary = '';
  if (widget.type === 'chat_response') {
    summary = widget.content?.substring(0, 300) || '';
  } else if (widget.type === 'code_snippet') {
    summary = `Code snippet in ${widget.file_path}: ${widget.explanation || ''}`;
  } else if (widget.type === 'architecture_diagram') {
    summary = `Architecture diagram: ${widget.title || ''} (${widget.caption || ''})`;
  } else if (widget.type === 'quiz') {
    summary = `Quiz question: ${widget.question}`;
  } else {
    summary = `Rendered widget [${widget.type}]: ${widget.title || ''}`;
  }

  history.push({
    turnId: `turn-${Date.now()}`,
    userQuery: query,
    assistantSummary: summary,
    widgetType: widget.type,
    timestamp: new Date().toISOString()
  });

  // Maintain sliding window
  if (history.length > MAX_TURNS_PER_SESSION) {
    history.shift();
  }
}

/**
 * Retrieves the raw conversation history for a session.
 * @param {string} sessionId
 * @param {number} [limit=5]
 * @returns {Array<object>}
 */
function getSessionHistory(sessionId, limit = 5) {
  if (!sessionId || !sessionStore.has(sessionId)) {
    return [];
  }
  const history = sessionStore.get(sessionId);
  return history.slice(-limit);
}

/**
 * Formats prior turns into prompt-ready context string for the LLM.
 * @param {string} sessionId
 * @param {number} [limit=4]
 * @returns {string}
 */
function getFormattedHistoryForPrompt(sessionId, limit = 4) {
  const turns = getSessionHistory(sessionId, limit);
  if (turns.length === 0) return '';

  return turns
    .map((t, idx) => `Turn ${idx + 1}:\nDeveloper: "${t.userQuery}"\nAssistant (${t.widgetType}): ${t.assistantSummary}`)
    .join('\n\n');
}

/**
 * Clears history for a session.
 * @param {string} sessionId
 */
function clearSession(sessionId) {
  if (sessionId) {
    sessionStore.delete(sessionId);
  }
}

module.exports = {
  recordTurn,
  getSessionHistory,
  getFormattedHistoryForPrompt,
  clearSession
};

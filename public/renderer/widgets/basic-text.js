/* Generic text cards for content types with no bespoke design.
 * payload: { body: markdown, points?: string[] }
 * chat_response's schema-defined field is actually `content` (see
 * src/contracts/responseSchema.json), not `body` — accept both so the
 * widget renders regardless of which one the backend/LLM used.        */
(function () {
  const LABELS = {
    chat_response: 'Chat response',
    summary:       'Summary',
    explanation:   'Explanation',
    tip:           'Tip',
    warning:       'Warning',
    best_practice: 'Best practice',
    citation:      'Citation',
  };
  Object.keys(LABELS).forEach((type) => UIRenderer.register(type, {
    category: 'Content and Guidance',
    label: LABELS[type],
    render(p, { h, safeMarkdown }) {
      return h('div', { class: `uir-text uir-text--${type}` },
        safeMarkdown(p.body != null ? p.body : p.content),
        Array.isArray(p.points) && p.points.length
          ? h('ul', { class: 'uir-points' }, p.points.map((x) => h('li', null, x))) : null);
    },
  }));
})();

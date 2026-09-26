/* Generic text cards for content types with no bespoke design.
 * payload: { body: markdown, points?: string[] }                                     */
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
        safeMarkdown(p.body),
        Array.isArray(p.points) && p.points.length
          ? h('ul', { class: 'uir-points' }, p.points.map((x) => h('li', null, x))) : null);
    },
  }));
})();

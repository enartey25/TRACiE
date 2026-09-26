/* Generic text cards for content types with no bespoke design.
 * payload: { body: markdown, points?: string[] }                                     */
(function () {
  const TYPES = ['chat_response', 'summary', 'explanation', 'tip', 'warning', 'best_practice', 'citation'];
  TYPES.forEach((type) => UIRenderer.register(type, {
    category: 'Content and Guidance',
    render(p, { h, safeMarkdown }) {
      return h('div', { class: `uir-text uir-text--${type}` },
        safeMarkdown(p.body),
        Array.isArray(p.points) && p.points.length
          ? h('ul', { class: 'uir-points' }, p.points.map((x) => h('li', null, x))) : null);
    },
  }));
})();

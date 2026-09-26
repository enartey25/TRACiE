/* REFERENCE WIDGET: copy this pattern for every new widget.
 * code_snippet  (design: docs/renderer/design/content-guidance.png, bottom left)
 * payload: { file_name, language, code, start_line? }                              */
(function () {
  UIRenderer.register('code_snippet', {
    category: 'Code and Files',
    label: 'Code snippet',
    render(p, { codePanel, notice }) {
      if (!p || !p.code) return notice('info', 'No code to display.');
      return codePanel(p);
    },
  });
})();

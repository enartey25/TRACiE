/* diff widget — unified diff renderer
 * payload: { file_name, patch }                                                */
(function () {
  UIRenderer.register('diff', {
    category: 'Code and Files',
    label: 'Diff',
    bare: false,
    render(p, { h, notice }) {
      const patch = typeof p.patch === 'string' ? p.patch.trim() : '';
      if (!patch) return notice('info', 'No diff available.');

      const lines = patch.split('\n');

      // Build rows
      const rows = lines.map((raw) => {
        // Skip file header lines (+++, ---)
        if (raw.startsWith('+++') || raw.startsWith('---')) return null;

        let rowMod = 'ctx';
        let prefix = ' ';

        if (raw.startsWith('@@')) {
          rowMod = 'hunk';
          prefix = '@@';
        } else if (raw.startsWith('+')) {
          rowMod = 'add';
          prefix = '+';
        } else if (raw.startsWith('-')) {
          rowMod = 'del';
          prefix = '−'; // minus sign (U+2212) for visual clarity
        }

        // Content: strip the leading +/- sigil for add/del/ctx; keep hunk line intact
        let content = raw;
        if (rowMod === 'add' || rowMod === 'del') {
          content = raw.slice(1);
        }

        return h('div', { class: `uir-diff__row uir-diff__row--${rowMod}` },
          h('span', { class: `uir-diff__prefix uir-diff__prefix--${rowMod}` }, prefix),
          h('span', { class: 'uir-diff__line' }, content)
        );
      }).filter(Boolean);

      const header = h('div', { class: 'uir-codepanel__bar' },
        h('span', { class: 'uir-codepanel__file uir-diff__filename' }, p.file_name || 'diff'),
        h('span', { class: 'uir-codepanel__lang' }, 'diff')
      );

      const body = h('div', { class: 'uir-diff__body' }, ...rows);

      return h('div', { class: 'uir-diff uir-codepanel' }, header, body);
    },
  });
})();

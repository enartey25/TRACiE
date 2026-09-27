(function () {
  /**
   * Shared breadcrumb builder for directory_tree and file_reference.
   * @param {Function} h  - ctx.h DOM helper
   * @param {string[]} pathArr - ordered path segments
   * @returns {HTMLElement}
   */
  function buildBreadcrumb(h, pathArr) {
    const nav = h('nav', { class: 'uir-paths__breadcrumb', 'aria-label': 'File path' });
    (pathArr || []).forEach(function (seg, i) {
      var isLast = i === pathArr.length - 1;
      nav.appendChild(
        h('span', { class: isLast ? 'uir-paths__seg uir-paths__seg--last' : 'uir-paths__seg' }, seg)
      );
      if (!isLast) {
        nav.appendChild(h('span', { class: 'uir-paths__sep', 'aria-hidden': 'true' }, ' / '));
      }
    });
    return nav;
  }

  // ── directory_tree ──────────────────────────────────────────────────────────

  UIRenderer.register('directory_tree', {
    category: 'Code and Files',
    label: 'Directory tree',
    bare: false,
    render: function (p, ctx) {
      var h = ctx.h;
      if (!p || !Array.isArray(p.path) || p.path.length === 0) {
        return ctx.notice('No path provided.');
      }
      var wrap = h('div', { class: 'uir-paths__tree-body' });
      wrap.appendChild(buildBreadcrumb(h, p.path));
      return wrap;
    },
  });

  // ── file_reference ──────────────────────────────────────────────────────────

  UIRenderer.register('file_reference', {
    category: 'Code and Files',
    label: 'File reference',
    bare: false,
    render: function (p, ctx) {
      var h = ctx.h;
      if (!p || !Array.isArray(p.path) || p.path.length === 0) {
        return ctx.notice('No path provided.');
      }
      var frag = document.createDocumentFragment();

      frag.appendChild(buildBreadcrumb(h, p.path));

      if (p.start_line != null && p.end_line != null) {
        frag.appendChild(
          h(
            'span',
            { class: 'uir-paths__lines-pill' },
            'Lines\u00a0' + p.start_line + '\u2013' + p.end_line
          )
        );
      }

      if (p.reason) {
        frag.appendChild(h('p', { class: 'uir-paths__reason' }, p.reason));
      }

      return frag;
    },
  });
})();

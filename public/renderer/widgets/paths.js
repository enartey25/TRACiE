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

  /**
   * Recursive node renderer for the full file_tree shape (schema: src/contracts/responseSchema.json
   * #/definitions/file_tree): { name, type: 'file'|'directory', path?, description?, children? }
   */
  function buildTreeNode(h, icon, node) {
    var isDir = node.type === 'directory';
    var children = Array.isArray(node.children) ? node.children : [];
    var row = h('div', { class: 'uir-tree__row' },
      icon(isDir ? 'folder' : 'file', 'uir-tree__icon'),
      h('span', { class: 'uir-tree__name' }, node.name || ''),
      node.description ? h('span', { class: 'uir-tree__desc' }, node.description) : null);
    var li = h('li', { class: 'uir-tree__item' }, row);
    if (isDir && children.length) {
      li.appendChild(h('ul', { class: 'uir-tree__children' },
        children.map(function (child) { return buildTreeNode(h, icon, child); })));
    }
    return li;
  }

  // ── directory_tree (dual shape: breadcrumb `path`, or full `root` tree) ──────

  UIRenderer.register('directory_tree', {
    category: 'Code and Files',
    label: 'Directory tree',
    bare: false,
    render: function (p, ctx) {
      var h = ctx.h;

      // Full recursive tree (the actual file_tree/NavigatorSubagent schema shape).
      if (p && p.root && typeof p.root === 'object') {
        var root = p.root;
        var wrap = h('div', { class: 'uir-tree' },
          h('div', { class: 'uir-tree__row uir-tree__row--root' },
            ctx.icon('folder-open', 'uir-tree__icon'),
            h('span', { class: 'uir-tree__name' }, root.name || '')),
          Array.isArray(root.children) && root.children.length
            ? h('ul', { class: 'uir-tree__children uir-tree__children--root' },
                root.children.map(function (child) { return buildTreeNode(h, ctx.icon, child); }))
            : ctx.notice('info', 'This directory has no files.'));
        return wrap;
      }

      // Single breadcrumb path (file_reference-style: one specific file's location).
      if (!p || !Array.isArray(p.path) || p.path.length === 0) {
        return ctx.notice('warning', 'No path provided.');
      }
      var bwrap = h('div', { class: 'uir-paths__tree-body' });
      bwrap.appendChild(buildBreadcrumb(h, p.path));
      return bwrap;
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

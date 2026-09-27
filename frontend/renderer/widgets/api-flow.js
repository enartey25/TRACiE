/* api_flow widget
 * design: docs/renderer/design/diagrams.png
 * payload: { groups: [{ prefix, tone, endpoints: [{ method, path, result }] }], common_errors?: string[] } */
(function () {
  var METHOD_TONES = {
    GET:    { cls: 'uir-api-flow__pill--get',    light: true },
    POST:   { cls: 'uir-api-flow__pill--post',   light: false },
    PATCH:  { cls: 'uir-api-flow__pill--patch',  light: true },
    DELETE: { cls: 'uir-api-flow__pill--delete', light: false },
  };

  var GROUP_TONES = {
    dark:  'uir-api-flow__group-header--dark',
    green: 'uir-api-flow__group-header--green',
    light: 'uir-api-flow__group-header--light',
  };

  UIRenderer.register('api_flow', {
    category: 'Diagrams',
    label: 'API flow',
    render: function (p, ctx) {
      var h = ctx.h;
      var frag = document.createDocumentFragment();

      var groups = Array.isArray(p && p.groups) ? p.groups : [];
      if (groups.length === 0) {
        frag.appendChild(ctx.notice('info', 'No API groups to display.'));
        return frag;
      }

      // ── Legend ────────────────────────────────────────────────────────────────
      var legend = h('div', { class: 'uir-api-flow__legend', 'aria-label': 'HTTP method legend' });
      ['GET', 'POST', 'PATCH', 'DELETE'].forEach(function (m) {
        var cfg = METHOD_TONES[m];
        legend.appendChild(h('span', { class: 'uir-api-flow__pill uir-api-flow__pill--sm ' + cfg.cls }, m));
      });
      frag.appendChild(legend);

      // ── Groups ────────────────────────────────────────────────────────────────
      var grid = h('div', { class: 'uir-api-flow__grid' });

      groups.forEach(function (g) {
        var col = h('div', { class: 'uir-api-flow__group' });

        // Header
        var toneCls = GROUP_TONES[g.tone] || GROUP_TONES.light;
        var header = h('div', { class: 'uir-api-flow__group-header ' + toneCls });
        header.appendChild(h('span', { class: 'uir-api-flow__group-prefix' }, g.prefix || ''));
        col.appendChild(header);

        // Endpoints
        var endpointList = Array.isArray(g.endpoints) ? g.endpoints : [];
        endpointList.forEach(function (ep) {
          var row = h('div', { class: 'uir-api-flow__row' });

          var method = (ep.method || '').toUpperCase();
          var cfg = METHOD_TONES[method] || { cls: 'uir-api-flow__pill--get', light: true };
          row.appendChild(h('span', { class: 'uir-api-flow__pill uir-api-flow__pill--sm ' + cfg.cls }, method));

          row.appendChild(h('span', { class: 'uir-api-flow__path' }, ep.path || ''));

          if (ep.result) {
            row.appendChild(h('span', { class: 'uir-api-flow__result' }, '\u2192\u00a0' + ep.result));
          }

          col.appendChild(row);
        });

        grid.appendChild(col);
      });

      frag.appendChild(grid);

      // ── Common errors ─────────────────────────────────────────────────────────
      var errors = Array.isArray(p.common_errors) ? p.common_errors : [];
      if (errors.length > 0) {
        var footer = h('div', { class: 'uir-api-flow__footer' });
        footer.appendChild(h('span', { class: 'uir-api-flow__footer-label' }, 'Common errors:'));
        errors.forEach(function (e) {
          footer.appendChild(h('span', { class: 'uir-api-flow__error-chip' }, e));
        });
        frag.appendChild(footer);
      }

      return frag;
    },
  });
})();

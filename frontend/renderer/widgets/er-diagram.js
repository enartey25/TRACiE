/* er_diagram widget
 * design: docs/renderer/design/diagrams.png
 * payload: {
 *   entities: [{ name, fields: [{ name, key?, note? }] }],
 *   relations?: [{ from, to, cardinality, label }]
 * } */
(function () {
  UIRenderer.register('er_diagram', {
    category: 'Diagrams',
    label: 'ER Diagram',

    render(p, ctx) {
      const { h, icon, notice } = ctx;

      if (!Array.isArray(p.entities) || p.entities.length === 0) {
        return notice('info', 'No entities defined for this ER diagram.');
      }

      const wrap = h('div', { class: 'uir-er-diagram__wrap' });

      /* ── Entity cards ── */
      const grid = h('div', { class: 'uir-er-diagram__grid' });

      for (const entity of p.entities) {
        const card = h('div', { class: 'uir-er-diagram__entity' });

        /* Header */
        const header = h('div', { class: 'uir-er-diagram__entity-header' });
        header.appendChild(h('span', { class: 'uir-er-diagram__entity-name' }, entity.name || ''));
        card.appendChild(header);

        /* Fields */
        const fieldList = h('ul', { class: 'uir-er-diagram__fields' });
        for (const field of (Array.isArray(entity.fields) ? entity.fields : [])) {
          const row = h('li', { class: 'uir-er-diagram__field' });

          /* Icon slot */
          const iconWrap = h('span', { class: 'uir-er-diagram__field-icon' });
          if (field.key === 'PK') {
            iconWrap.appendChild(icon('key'));
          } else if (field.key === 'FK') {
            iconWrap.appendChild(icon('link'));
          }
          row.appendChild(iconWrap);

          /* Name */
          const nameClass = 'uir-er-diagram__field-name' +
            (field.key === 'PK' ? ' uir-er-diagram__field-name--pk' : '');
          row.appendChild(h('span', { class: nameClass }, field.name || ''));

          /* Note */
          if (field.note) {
            row.appendChild(h('span', { class: 'uir-er-diagram__field-note' }, field.note));
          }

          fieldList.appendChild(row);
        }
        card.appendChild(fieldList);
        grid.appendChild(card);
      }

      wrap.appendChild(grid);

      /* ── Relations ── */
      const relations = Array.isArray(p.relations) ? p.relations : [];
      if (relations.length > 0) {
        const relRow = h('div', { class: 'uir-er-diagram__relations' });
        for (const rel of relations) {
          /* Parse cardinality "1..N" → "1 label N" */
          const parts = (rel.cardinality || '').split('..');
          const left  = parts[0] || '';
          const right = parts[1] || '';
          const text  = [left, rel.label || '', right].filter(Boolean).join(' ');
          relRow.appendChild(h('span', { class: 'uir-er-diagram__rel-chip' }, text));
        }
        wrap.appendChild(relRow);
      }

      return wrap;
    },
  });
})();

/* database_schema widget
 * payload: { tables: [{ name, columns: [{ name, type, constraints, key? }] }], indexes?: [{ label, highlight? }] }
 * Design: table grid (3-col auto-fill), PK rows warm-chip, FK rows sage-tint, indexes as chips.
 */
(function () {
  UIRenderer.register('database_schema', {
    category: 'Diagrams',
    label: 'Database schema',

    render(payload, { h, notice }) {
      const tables  = Array.isArray(payload && payload.tables)  ? payload.tables  : [];
      const indexes = Array.isArray(payload && payload.indexes) ? payload.indexes : [];

      if (tables.length === 0) {
        return notice('info', 'No table definitions provided.');
      }

      // ── root container ───────────────────────────────────────────────────
      const root = h('div', { class: 'uir-db-schema' });

      // ── table grid ───────────────────────────────────────────────────────
      const grid = h('div', { class: 'uir-db-schema__grid' });

      for (const table of tables) {
        const cols = Array.isArray(table.columns) ? table.columns : [];

        const card = h('div', { class: 'uir-db-schema__table' });

        // header
        const header = h('div', { class: 'uir-db-schema__table-header' });
        const nameEl = h('span', { class: 'uir-db-schema__table-name' });
        nameEl.textContent = table.name || '(unnamed)';
        const countEl = h('span', { class: 'uir-db-schema__table-count' });
        countEl.textContent = cols.length + ' col' + (cols.length !== 1 ? 's' : '');
        header.appendChild(nameEl);
        header.appendChild(countEl);
        card.appendChild(header);

        // column rows
        const body = h('div', { class: 'uir-db-schema__table-body' });
        for (const col of cols) {
          const rowClass = col.key === 'PK'
            ? 'uir-db-schema__col uir-db-schema__col--pk'
            : col.key === 'FK'
              ? 'uir-db-schema__col uir-db-schema__col--fk'
              : 'uir-db-schema__col';

          const row = h('div', { class: rowClass });

          const colName = h('span', { class: 'uir-db-schema__col-name' });
          colName.textContent = col.name || '';

          const colMeta = h('span', { class: 'uir-db-schema__col-meta' });
          const parts = [col.type, col.constraints].filter(Boolean).join('  ');
          colMeta.textContent = parts;

          row.appendChild(colName);
          row.appendChild(colMeta);
          body.appendChild(row);
        }
        card.appendChild(body);
        grid.appendChild(card);
      }
      root.appendChild(grid);

      // ── indexes section ───────────────────────────────────────────────────
      if (indexes.length > 0) {
        const idxSection = h('div', { class: 'uir-db-schema__indexes' });
        for (const idx of indexes) {
          const chip = h('span', {
            class: idx.highlight
              ? 'uir-db-schema__chip uir-db-schema__chip--highlight'
              : 'uir-db-schema__chip',
          });
          chip.textContent = idx.label || '';
          idxSection.appendChild(chip);
        }
        root.appendChild(idxSection);
      }

      return root;
    },
  });
})();

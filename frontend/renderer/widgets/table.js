/* table widget — comparison + request_response
 * payload: { columns: string[], rows: string[][] }
 * Registered as two types sharing one render function.          */
(function () {
  function renderTable(p, { h, notice }) {
    const cols = Array.isArray(p.columns) ? p.columns : [];
    const rows = Array.isArray(p.rows) ? p.rows : [];

    if (cols.length === 0 || rows.length === 0) {
      return notice('info', 'No table data.');
    }

    const wrapper = h('div', { class: 'uir-table__wrapper' });

    const table = h('table', { class: 'uir-table__table' });
    wrapper.appendChild(table);

    // <thead>
    const thead = h('thead', { class: 'uir-table__thead' });
    const headerRow = h('tr', { class: 'uir-table__tr' });
    cols.forEach(function (col) {
      const th = h('th', { class: 'uir-table__th' });
      th.textContent = col;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // <tbody>
    const tbody = h('tbody', { class: 'uir-table__tbody' });
    rows.forEach(function (row) {
      const tr = h('tr', { class: 'uir-table__tr' });
      const cells = Array.isArray(row) ? row : [];
      cols.forEach(function (_, colIdx) {
        const td = h('td', { class: 'uir-table__td' });
        td.textContent = cells[colIdx] != null ? String(cells[colIdx]) : '';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    return wrapper;
  }

  UIRenderer.register('comparison', {
    category: 'Content and Guidance',
    label: 'Comparison table',
    bare: false,
    render(p, ctx) { return renderTable(p, ctx); },
  });

  UIRenderer.register('request_response', {
    category: 'Code and Files',
    label: 'Request / Response',
    bare: false,
    render(p, ctx) { return renderTable(p, ctx); },
  });
})();

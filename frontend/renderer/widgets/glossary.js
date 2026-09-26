(function () {
  UIRenderer.register('glossary', {
    category: 'Content and Guidance',
    label: 'Glossary',
    bare: false,

    render(p, ctx) {
      const { h, notice } = ctx;
      const terms = p.terms;

      if (!Array.isArray(terms) || terms.length === 0) {
        return notice('No glossary terms provided.');
      }

      const wrap = h('div', { class: 'uir-glossary__body' });

      for (const item of terms) {
        const row = h('div', { class: 'uir-glossary__row' });
        row.appendChild(h('dt', { class: 'uir-glossary__term' }, item.term || ''));
        row.appendChild(h('dd', { class: 'uir-glossary__def' }, item.definition || ''));
        wrap.appendChild(row);
      }

      return wrap;
    },
  });
})();

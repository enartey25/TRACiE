(function () {
  UIRenderer.register('faq', {
    category: 'Content and Guidance',
    label: 'FAQ',
    bare: false,

    render(p, ctx) {
      const { h, icon } = ctx;
      const items = Array.isArray(p.items) ? p.items : [];

      if (items.length === 0) {
        return h('p', { class: 'uir-faq__empty' }, 'No questions available.');
      }

      const wrap = h('div', { class: 'uir-faq__list' });

      for (const item of items) {
        const details = h('details', { class: 'uir-faq__item', open: '' });

        const summary = h('summary', { class: 'uir-faq__question' });
        summary.appendChild(icon('help-circle'));
        summary.appendChild(
          h('span', { class: 'uir-faq__question-text' }, item.question || '')
        );
        details.appendChild(summary);

        details.appendChild(
          h('p', { class: 'uir-faq__answer' }, item.answer || '')
        );

        wrap.appendChild(details);
      }

      return wrap;
    },
  });
})();

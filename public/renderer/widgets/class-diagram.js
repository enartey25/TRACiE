/* class_diagram widget
 * design: docs/renderer/design/diagrams.png
 * payload: { classes: [{ name, stereotype?, tone?, attributes?, methods? }], relations?: [{ from, to, kind, label?, from_card?, to_card? }] } */
(function () {
  const TONE_CLASS = {
    dark:  'uir-class-diagram__header--dark',
    green: 'uir-class-diagram__header--green',
    grey:  'uir-class-diagram__header--grey',
  };

  UIRenderer.register('class_diagram', {
    category: 'Diagrams',
    label: 'Class diagram',
    render(p, ctx) {
      const { h, notice } = ctx;

      if (!Array.isArray(p.classes) || p.classes.length === 0) {
        return notice('info', 'Class diagram requires a `classes` array.');
      }

      const wrap = h('div', { class: 'uir-class-diagram' });

      /* ── class grid ── */
      const grid = h('div', { class: 'uir-class-diagram__grid' });

      for (const cls of p.classes) {
        const box = h('div', { class: 'uir-class-diagram__box' });

        /* header */
        const toneClass = TONE_CLASS[cls.tone] || '';
        const header = h('div', { class: ('uir-class-diagram__header ' + toneClass).trim() });
        if (cls.stereotype) {
          header.appendChild(h('span', { class: 'uir-class-diagram__stereotype' }, '«' + cls.stereotype + '»'));
        }
        header.appendChild(h('span', { class: 'uir-class-diagram__name' }, cls.name || ''));
        box.appendChild(header);

        /* attributes */
        const attrs = Array.isArray(cls.attributes) ? cls.attributes : [];
        const attrSection = h('div', { class: 'uir-class-diagram__section uir-class-diagram__section--attrs' });
        if (attrs.length === 0) {
          attrSection.appendChild(h('span', { class: 'uir-class-diagram__empty-section' }, '—'));
        } else {
          for (const a of attrs) {
            attrSection.appendChild(h('div', { class: 'uir-class-diagram__member' }, a));
          }
        }
        box.appendChild(attrSection);

        /* methods */
        const methods = Array.isArray(cls.methods) ? cls.methods : [];
        const methodSection = h('div', { class: 'uir-class-diagram__section uir-class-diagram__section--methods' });
        if (methods.length === 0) {
          methodSection.appendChild(h('span', { class: 'uir-class-diagram__empty-section' }, '—'));
        } else {
          for (const m of methods) {
            methodSection.appendChild(h('div', { class: 'uir-class-diagram__member' }, m));
          }
        }
        box.appendChild(methodSection);

        grid.appendChild(box);
      }

      wrap.appendChild(grid);

      /* ── relations ── */
      const relations = Array.isArray(p.relations) ? p.relations : [];
      if (relations.length > 0) {
        const relList = h('div', { class: 'uir-class-diagram__relations' });

        for (const rel of relations) {
          const line = h('div', { class: 'uir-class-diagram__relation' });
          let text = '';
          if (rel.kind === 'extends') {
            text = rel.from + ' ↑ extends ' + rel.to;
          } else if (rel.kind === 'association') {
            const fromCard = rel.from_card ? rel.from_card + ' ── ' : '';
            const lbl      = rel.label    ? rel.label + ' ── '      : '';
            const toCard   = rel.to_card  ? rel.to_card + ' ── '    : '';
            text = rel.from + ' ◇── ' + fromCard + lbl + toCard + rel.to;
          } else {
            text = rel.from + ' → ' + rel.to + (rel.kind ? ' (' + rel.kind + ')' : '');
          }
          line.appendChild(h('span', {}, text));
          relList.appendChild(line);
        }

        wrap.appendChild(relList);
      }

      return wrap;
    },
  });
})();

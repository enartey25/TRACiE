/* overview widget
 * design: docs/renderer/design/content-guidance.png
 * payload: { lead, body, layers: [{ icon, tag, title, text, highlight? }] } */
(function () {
  UIRenderer.register('overview', {
    category: 'Content and Guidance',
    label: 'Overview',
    bare: false,
    render(p, ctx) {
      const { h, icon } = ctx;
      const frag = document.createDocumentFragment();

      // Lead paragraph
      if (p.lead) {
        frag.appendChild(h('p', { class: 'uir-overview__lead' }, p.lead));
      }

      // Body paragraph
      if (p.body) {
        frag.appendChild(h('p', { class: 'uir-overview__body' }, p.body));
      }

      // Layer grid
      const grid = h('div', { class: 'uir-overview__grid' });
      for (const layer of (p.layers || [])) {
        const layerClass = 'uir-overview__layer' +
          (layer.highlight ? ' uir-overview__layer--highlight' : '');
        const card = h('div', { class: layerClass });

        // Top row: icon + tag
        const topRow = h('div', { class: 'uir-overview__layer-top' });
        const iconWrap = h('div', { class: 'uir-overview__layer-icon' });
        if (layer.icon) {
          iconWrap.appendChild(icon(layer.icon));
        }
        topRow.appendChild(iconWrap);
        topRow.appendChild(h('span', { class: 'uir-overview__layer-tag' }, layer.tag || ''));
        card.appendChild(topRow);

        // Title and text
        card.appendChild(h('p', { class: 'uir-overview__layer-title' }, layer.title || ''));
        card.appendChild(h('p', { class: 'uir-overview__layer-text' }, layer.text || ''));

        grid.appendChild(card);
      }
      frag.appendChild(grid);

      return frag;
    },
  });
})();

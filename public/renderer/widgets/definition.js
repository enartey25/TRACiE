(function () {
  UIRenderer.register('definition', {
    category: 'Content and Guidance',
    label: 'Definition',
    bare: false,
    render(p, ctx) {
      const { h } = ctx;
      const frag = document.createDocumentFragment();

      // Phonetic — right-aligned, italic, muted; rendered as first line
      if (p.phonetic) {
        frag.appendChild(h('p', { class: 'uir-definition__phonetic' }, p.phonetic));
      }

      // "NOUN · ARCHITECTURE" — part_of_speech + domain, uppercased
      const parts = [p.part_of_speech, p.domain]
        .filter(Boolean)
        .map(function (s) { return s.toUpperCase(); })
        .join(' · ');
      if (parts) {
        frag.appendChild(h('p', { class: 'uir-definition__meta' }, parts));
      }

      // Body text
      if (p.body) {
        frag.appendChild(h('p', { class: 'uir-definition__body' }, p.body));
      }

      return frag;
    },
  });
})();

/*
 * WIDGET MANIFEST + LOADER
 * Every widget is widgets/<name>.js (+ optional widgets/<name>.css when css: true).
 * To add a widget: create the files, then add ONE line below. Nothing else changes.
 * Pages include this file after ui-renderer.js, then wait for:  await window.UIRendererReady
 */
(function () {
  const WIDGETS = [
    { name: 'basic-text' },
    { name: 'mermaid-diagrams' },
    { name: 'code-snippet' },
    // Bob adds new widgets here, e.g. { name: 'quiz', css: true },
  ];

  const me = document.currentScript;
  const base = me ? me.src.replace(/manifest\.js(\?.*)?$/, '') : './widgets/';

  function loadScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve(true);
      s.onerror = () => { console.error(`[UIRenderer] failed to load ${src}`); resolve(false); }; // one bad widget never blocks the rest
      document.head.appendChild(s);
    });
  }

  function loadCss(href) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }

  window.UIRendererReady = (async () => {
    for (const w of WIDGETS) {
      if (w.css) loadCss(`${base}${w.name}.css`);
      await loadScript(`${base}${w.name}.js`); // sequential keeps registration order predictable
    }
    return window.UIRenderer;
  })();
})();

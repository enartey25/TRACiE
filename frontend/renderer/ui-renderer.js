/*
 * UIRenderer v2 — type dispatch rendering engine for TRACiE
 * SRS refs: 7.4, 20.1, 23.2, 23.3, 25, 26.3   Owner: Romel
 *
 * ENVELOPE (what every LLM response is normalised into)
 * {
 *   type:      "quiz" | "overview" | ... | "composite"     (required)
 *   message:   "Short sentence for the chat bubble"        (optional, read by the chat UI via UIRenderer.messageOf)
 *   eyebrow:   "ARCHITECTURE FLOWCHART"                    (optional, defaults to a label from the type)
 *   title:     "Request Lifecycle"                         (optional)
 *   subtitle:  "Compact definitions for recurring concepts" (optional)
 *   badge:     "PostgreSQL 15"                             (optional pill, top right)
 *   payload:   { ...widget specific... }                   (required for most widgets)
 *   citations: [{ file, start, end }] | ["src/a.ts:1-9"]   (optional)
 *   components:[ envelope, ... ]                           (composite only)
 * }
 *
 * ADDING A WIDGET never touches this file (NFR-14). In widgets/<name>.js:
 *   UIRenderer.register('quiz', { category, label, bare: true, render(payload, ctx, env) { return HTMLElement } })
 *   bare: true  => widget draws its own card (quiz, flashcards, code_exercise, audio)
 *   bare: false => core wraps it in the standard card (eyebrow, serif title, badge, citations)
 */
(function (global) {
  'use strict';

  const registry = new Map();
  const state = { canvas: null, badge: null, adapter: null, options: { hideHeader: false } };
  let diagramSeq = 0;
  let mermaidPromise = null;

  // Old names from the task breakdown map to canonical SRS names.
  const ALIASES = {
    file_tree: 'directory_tree',
    flashcard_deck: 'flashcards',
    tutorial_steps: 'tutorial',
    diff_view: 'diff',
    database_diagram: 'database_schema',
    decision_tree: 'flowchart',
  };

  // Any of these may arrive as Mermaid text (payload.diagram_source) instead of structured JSON.
  const DIAGRAM_TYPES = new Set([
    'architecture_diagram', 'flowchart', 'sequence_diagram', 'mindmap', 'state_diagram', 'class_diagram',
    'er_diagram', 'dependency_graph', 'data_flow', 'component_diagram', 'system_diagram', 'api_flow',
  ]);

  // Design tokens for Mermaid (keep in sync with ui-renderer.css)
  const MERMAID_THEME = {
    fontFamily: 'Inter, system-ui, sans-serif',
    primaryColor: '#E8EFE8', primaryBorderColor: '#A3B8A9', primaryTextColor: '#313F46',
    secondaryColor: '#F4F3ED', tertiaryColor: '#FFFFFF',
    lineColor: '#8CA19A', textColor: '#313F46', mainBkg: '#E8EFE8', nodeBorder: '#A3B8A9',
    clusterBkg: '#F4F3ED', clusterBorder: '#C2CCC0', edgeLabelBackground: '#FFFBF8',
    actorBkg: '#E8EFE8', actorBorder: '#516D6A', signalColor: '#516D6A', noteBkgColor: '#F4F3ED',
  };

  /* ---------------- DOM helpers: LLM text only ever goes in via textContent or DOMPurify ---------------- */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  function safeMarkdown(md, cls) {
    const box = h('div', { class: `uir-md${cls ? ` ${cls}` : ''}` });
    if (md == null || md === '') return box;
    if (global.marked && global.DOMPurify) box.innerHTML = global.DOMPurify.sanitize(global.marked.parse(String(md)));
    else box.textContent = String(md);
    return box;
  }

  function notice(tone, text) {
    return h('div', { class: `uir-notice uir-notice--${tone}`, role: tone === 'error' ? 'alert' : 'status' }, text);
  }

  // Lucide icon placeholder; converted to SVG after mount if lucide is loaded
  function icon(name, cls) {
    return h('i', { 'data-lucide': name || 'circle', class: `uir-icon${cls ? ` ${cls}` : ''}`, 'aria-hidden': 'true' });
  }

  function codeBlock(code, language, opts = {}) {
    const lang = String(language || 'plaintext').toLowerCase();
    const codeEl = h('code', { class: `language-${lang}` });
    codeEl.textContent = code == null ? '' : String(code);
    return h('pre', {
      class: `uir-code language-${lang}${opts.lineNumbers === false ? '' : ' line-numbers'}`,
      'data-start': opts.startLine || null,
    }, codeEl);
  }

  // Standard code panel from the design: header (file name, language) + numbered code
  function codePanel({ file_name, language, code, start_line }) {
    return h('div', { class: 'uir-codepanel' },
      h('div', { class: 'uir-codepanel__bar' },
        h('span', { class: 'uir-codepanel__file' }, file_name || 'snippet'),
        h('span', { class: 'uir-codepanel__lang' }, prettyLang(language))),
      codeBlock(code, language, { startLine: start_line }));
  }

  function prettyLang(l) {
    const map = { ts: 'TypeScript', typescript: 'TypeScript', js: 'JavaScript', javascript: 'JavaScript', py: 'Python',
      python: 'Python', json: 'JSON', sql: 'SQL', go: 'Go', java: 'Java', rust: 'Rust', bash: 'Bash', html: 'HTML', css: 'CSS' };
    return map[String(l || '').toLowerCase()] || (l || 'Text');
  }

  function labelFromType(type) { return String(type).replace(/_/g, ' ').toUpperCase(); }

  /* ---------------- normalisation ---------------- */
  const ENVELOPE_KEYS = ['type', 'message', 'eyebrow', 'title', 'subtitle', 'badge', 'payload', 'data', 'citations', 'components'];

  function resolveType(t) {
    if (typeof t !== 'string') return null;
    const key = t.trim().toLowerCase();
    return ALIASES[key] || key;
  }

  function normalise(raw) {
    if (Array.isArray(raw)) return { type: 'composite', components: raw.map(normalise) };
    if (!raw || typeof raw !== 'object') return { type: null, payload: {} };
    const env = { ...raw };
    env.type = resolveType(raw.type) || (Array.isArray(raw.components) ? 'composite' : null);
    // Tolerate { payload }, { data } or flat fields; never assume Ethan's exact shape
    if (raw.payload && typeof raw.payload === 'object') env.payload = raw.payload;
    else if (raw.data && typeof raw.data === 'object') env.payload = raw.data;
    else env.payload = Object.fromEntries(Object.entries(raw).filter(([k]) => !ENVELOPE_KEYS.includes(k)));
    if (Array.isArray(raw.components)) env.components = raw.components.map(normalise);
    return env;
  }

  /* ---------------- card frame for non bare widgets ---------------- */
  function frame(type, env, body) {
    const showHead = !state.options.hideHeader || state.inComposite;
    const head = showHead ? h('header', { class: 'uir-card__head' },
      h('div', { class: 'uir-card__headings' },
        h('div', { class: 'uir-eyebrow' }, env.eyebrow || labelFromType(type)),
        env.title ? h('h3', { class: 'uir-card__title' }, env.title) : null,
        env.subtitle ? h('p', { class: 'uir-card__subtitle' }, env.subtitle) : null),
      env.badge ? h('span', { class: 'uir-badge' }, h('span', { class: 'uir-badge__dot' }), env.badge) : null) : null;
    return h('article', { class: `uir-card uir-card--${type}`, 'data-type': type, tabindex: '0' }, head, body, citations(env));
  }

  function citations(env) {
    const list = Array.isArray(env.citations) ? env.citations : [];
    if (!list.length) return null;
    return h('footer', { class: 'uir-cites' },
      h('span', { class: 'uir-cites__label' }, 'Sources'),
      list.map((c) => h('code', { class: 'uir-cite' },
        typeof c === 'string' ? c : `${c.file}${c.start ? `:${c.start}${c.end ? `-${c.end}` : ''}` : ''}`)));
  }

  function ctxFor(type) {
    return { type, h, safeMarkdown, codeBlock, codePanel, notice, icon, drawMermaid, prettyLang };
  }

  function renderOne(env) {
    const type = env.type;
    // Mermaid text always wins for diagram types: robust when the LLM emits DSL instead of structured JSON
    if (type && DIAGRAM_TYPES.has(type) && typeof env.payload.diagram_source === 'string') {
      return { node: frame(type, env, mermaidFigure(env.payload)), badge: `${type} (mermaid)` };
    }
    const def = type && registry.get(type);
    if (!def) return { node: customFallback(env), badge: 'custom' };
    try {
      const body = def.render(env.payload || {}, ctxFor(type), env);
      const node = def.bare ? h('div', { class: `uir-bare uir-bare--${type}`, 'data-type': type }, body, citations(env)) : frame(type, env, body);
      return { node, badge: type };
    } catch (err) {
      console.warn(`[UIRenderer] ${type} failed`, err);
      return { node: frame(type, env, notice('warning', `This ${type} widget could not be rendered: ${err.message}`)), badge: type };
    }
  }

  function composite(env) {
    state.inComposite = true;
    const wrap = h('section', { class: 'uir-composite' },
      env.title ? h('h2', { class: 'uir-composite__title' }, env.title) : null);
    (env.components || []).forEach((child) => wrap.append(renderOne(child).node)); // one bad child never kills the rest
    state.inComposite = false;
    return { node: wrap, badge: `composite (${(env.components || []).length} widgets)` };
  }

  function customFallback(env) {
    if (env.type) console.warn(`[UIRenderer] unknown type "${env.type}", using custom fallback`);
    const text = env.payload && (env.payload.body || env.payload.text || env.payload.answer);
    const body = h('div', null,
      text ? safeMarkdown(text) : notice('info', env.type ? `No renderer for "${env.type}" yet.` : 'This response had no type.'),
      h('details', { class: 'uir-raw' }, h('summary', null, 'Raw response'), codeBlock(JSON.stringify(env, null, 2), 'json', { lineNumbers: false })));
    return frame('custom', { ...env, eyebrow: 'RESPONSE' }, body);
  }

  function stripFences(s) { return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''); }

  function afterMount(root) {
    if (global.Prism) root.querySelectorAll('pre.uir-code code').forEach((c) => { try { global.Prism.highlightElement(c); } catch (_) { /* plain is fine */ } });
    if (global.lucide && typeof global.lucide.createIcons === 'function') { try { global.lucide.createIcons(); } catch (_) { /* icons optional */ } }
  }

  function mount(canvas, node, badge) {
    canvas.replaceChildren(node);
    state.badge = badge;
    afterMount(canvas);
    canvas.dispatchEvent(new CustomEvent('uir:rendered', { detail: { badge }, bubbles: true }));
    return badge;
  }

  /* ---------------- Mermaid: lazy loaded on first use ---------------- */
  function loadMermaid() {
    if (!mermaidPromise) {
      mermaidPromise = import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs').then((m) => {
        const mm = m.default;
        mm.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: MERMAID_THEME });
        return mm;
      });
    }
    return mermaidPromise;
  }

  function mermaidFigure(p) {
    const host = h('div', { class: 'uir-diagram', role: 'img', 'aria-label': p.caption || 'diagram' });
    drawMermaid(host, p.diagram_source);
    return h('figure', { class: 'uir-figure' }, host, p.caption ? h('figcaption', null, p.caption) : null);
  }

  async function drawMermaid(host, source) {
    host.replaceChildren(h('div', { class: 'uir-skeleton' }));
    const id = `uir-mmd-${++diagramSeq}`;
    try {
      const mm = await loadMermaid();
      const { svg } = await mm.render(id, String(source || ''));
      host.innerHTML = svg; // Mermaid output, securityLevel strict
    } catch (err) {
      document.getElementById(`d${id}`)?.remove();
      host.replaceChildren(
        notice('warning', `Diagram could not be rendered: ${err && err.message ? err.message.split('\n')[0] : err}`),
        codeBlock(source, 'plaintext', { lineNumbers: false }));
    }
  }

  /* ---------------- public API ---------------- */
  const UIRenderer = {
    setCanvas(el) { state.canvas = el; return this; },
    setOptions(opts) { Object.assign(state.options, opts || {}); return this; },

    /** Optional: map the backend's real response shape into the envelope before normalising */
    setAdapter(fn) { state.adapter = typeof fn === 'function' ? fn : null; return this; },

    register(type, def) {
      if (!def || typeof def.render !== 'function') throw new Error(`register(${type}): render fn required`);
      registry.set(type, { category: 'Uncategorised', label: labelFromType(type), bare: false, ...def });
      return this;
    },

    has(type) { return registry.has(resolveType(type)); },

    /** Gallery metadata for Newlove's Component Gallery */
    list() { return [...registry.entries()].map(([type, d]) => ({ type, label: d.label, category: d.category })); },

    /** Text for the chat bubble. Falls back to a sensible sentence if the LLM omitted message. */
    messageOf(input) {
      try {
        const raw = typeof input === 'string' ? JSON.parse(stripFences(input)) : input;
        const env = normalise(state.adapter ? state.adapter(raw) : raw);
        return env.message || (env.title ? `Opened "${env.title}" in the canvas.` : 'Opened the result in the canvas.');
      } catch (_) { return 'The response could not be read.'; }
    },

    render(input, target) {
      const canvas = target || state.canvas;
      if (!canvas) throw new Error('UIRenderer: call setCanvas(el) or pass a target');
      if (input == null || (typeof input === 'string' && !input.trim())) {
        return this.renderEmptyState('Ask a question about the repository to see it here.', canvas);
      }
      let raw = input;
      if (typeof input === 'string') {
        try { raw = JSON.parse(stripFences(input)); } catch (err) {
          const card = frame('error', { eyebrow: 'INVALID RESPONSE', title: 'The response was not valid JSON' },
            h('div', null, notice('error', err.message), codeBlock(input, 'plaintext', { lineNumbers: false })));
          return mount(canvas, card, 'Invalid JSON');
        }
      }
      let env;
      try { env = normalise(state.adapter ? state.adapter(raw) : raw); } catch (err) {
        return mount(canvas, frame('error', { eyebrow: 'ADAPTER ERROR' }, notice('error', err.message)), 'error');
      }
      const out = env.type === 'composite' ? composite(env) : renderOne(env);
      return mount(canvas, out.node, out.badge);
    },

    renderEmptyState(msg, target) {
      const canvas = target || state.canvas;
      return mount(canvas, h('div', { class: 'uir-empty' }, icon('sparkles'), h('p', null, msg)), 'empty');
    },

    get activeBadge() { return state.badge; },
  };

  global.UIRenderer = UIRenderer;
})(window);

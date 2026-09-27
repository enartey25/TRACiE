/* code-exercise.js  –  UIRenderer code_exercise widget (bare: true)
 * Reuses window.UIRPractice.questionFlow from quiz.js.
 * payload: { questions: [{ repo_label, scope, path[], question, hint,
 *              file_name, language, code, options[], answer_index, explanation }] }
 *
 * renderPreface  → repository context box (above question title)
 * renderContext  → ctx.codePanel (between hint and options) + Prism re-highlight
 */
(function () {
  'use strict';

  /* ── small DOM helper (same pattern as quiz.js, self-contained) ── */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    const children = Array.prototype.slice.call(arguments, 2);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    children.flat(Infinity).forEach(function (c) {
      if (c == null || c === false) return;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return el;
  }

  /* ── repository context box ──
     row 1: • repo_label (bold)  …  scope (teal)
     row 2: breadcrumb from path[], last segment bold                    */
  function repoBox(q) {
    const dot   = h('span', { 'class': 'uir-ce__repo-dot',   'aria-hidden': 'true' });
    const label = h('span', { 'class': 'uir-ce__repo-label' }, q.repo_label || 'repository');
    const scope = h('span', { 'class': 'uir-ce__repo-scope' }, q.scope || '');
    const row1  = h('div',  { 'class': 'uir-ce__repo-row1'  }, dot, label, scope);

    // breadcrumb from path array
    const parts   = Array.isArray(q.path) ? q.path : [];
    const crumbEl = h('div', { 'class': 'uir-ce__breadcrumb' });
    parts.forEach(function (seg, i) {
      const isLast = i === parts.length - 1;
      crumbEl.appendChild(
        h('span', { 'class': isLast ? 'uir-ce__crumb-last' : 'uir-ce__crumb-seg' }, seg)
      );
      if (!isLast) crumbEl.appendChild(h('span', { 'class': 'uir-ce__crumb-sep', 'aria-hidden': 'true' }, ' / '));
    });

    return h('div', { 'class': 'uir-ce__repo-box' }, row1, crumbEl);
  }

  /* ── Prism re-highlight: runs after the DOM settles so line-numbers
     plugin and token colouring apply on question 2+ (back-nav too)   ── */
  function rehighlightPanel(contextEl) {
    if (!window.Prism) return;
    requestAnimationFrame(function () {
      var codeEls = contextEl.querySelectorAll('pre code');
      for (var i = 0; i < codeEls.length; i++) {
        window.Prism.highlightElement(codeEls[i]);
      }
    });
  }

  /* ── register ── */
  UIRenderer.register('code_exercise', {
    category: 'Practice',
    label: 'Code exercise',
    bare: true,
    render: function (p, ctx, env) {
      var rawList = [];
      if (p) {
        if (Array.isArray(p.questions) && p.questions.length) rawList = p.questions;
        else if (Array.isArray(p.exercises) && p.exercises.length) rawList = p.exercises;
        else if (Array.isArray(p.items) && p.items.length) rawList = p.items;
        else if (Array.isArray(p) && p.length) rawList = p;
        else if (p.question || p.code || (Array.isArray(p.options) && p.options.length)) rawList = [p];
      }
      if (!rawList.length && env) {
        if (Array.isArray(env.questions) && env.questions.length) rawList = env.questions;
        else if (Array.isArray(env.exercises) && env.exercises.length) rawList = env.exercises;
        else if (Array.isArray(env.items) && env.items.length) rawList = env.items;
        else if (env.question || env.code || (Array.isArray(env.options) && env.options.length)) rawList = [env];
        else if (env.payload) {
          if (Array.isArray(env.payload.questions) && env.payload.questions.length) rawList = env.payload.questions;
          else if (Array.isArray(env.payload.exercises) && env.payload.exercises.length) rawList = env.payload.exercises;
          else if (env.payload.question || env.payload.code) rawList = [env.payload];
        }
      }
      var resolveIdx = (window.UIRPractice && window.UIRPractice.resolveCorrectIndex) || function(item) {
        return item.answer_index !== undefined ? item.answer_index : (item.correct_index !== undefined ? item.correct_index : 0);
      };
      const questions = rawList.map(function(item) {
        if (!item) return null;
        var opts = Array.isArray(item.options) ? item.options : [];
        var cleanOpts = opts.map(function(o) {
          if (typeof o === 'string') return o.replace(/^[A-F][\.\)\:\s]\s*/i, '');
          if (o && (o.text || o.label)) return String(o.text || o.label).replace(/^[A-F][\.\)\:\s]\s*/i, '');
          return String(o);
        });
        return {
          question: item.question || item.text || item.title || item.prompt || '',
          hint: item.hint || '',
          repo: item.repo || item.repository || '',
          file_name: item.file_name || item.filePath || item.file || '',
          language: item.language || item.lang || '',
          code: item.code || '',
          start_line: item.start_line || item.startLine || 1,
          options: cleanOpts,
          answer_index: resolveIdx(item),
          explanation: item.explanation || item.rationale || item.why || ''
        };
      }).filter(function(q) { return q && (q.question || q.code || q.options.length > 0); });

      if (!questions.length) return ctx.notice('warning', 'Code exercise has no questions.');

      // Ensure the shared engine is available (quiz.js must load first)
      if (!window.UIRPractice || typeof window.UIRPractice.questionFlow !== 'function') {
        return ctx.notice('error', 'Code exercise: quiz.js must load before code-exercise.js.');
      }

      // Keep a reference to the renderContext element so Prism can scan it.
      // questionFlow returns the card; we find the slot after construction.
      var renderContextEl = null;

      const card = window.UIRPractice.questionFlow(questions, {
        unitLabel: 'code exercises',
        chipLabel: 'Code review',
        ctx:       ctx,

        /* ── renderPreface: repository box, shown above the question ── */
        renderPreface: function (q) {
          return repoBox(q);
        },

        /* ── renderContext: code panel between hint and options ── */
        renderContext: function (q, fwdCtx) {
          if (!q.file_name || q.code == null) return null;
          var panel;
          try {
            panel = fwdCtx.codePanel({
              file_name:  q.file_name,
              language:   q.language  || '',
              code:       q.code,
              start_line: q.start_line || undefined,
            });
          } catch (err) {
            return fwdCtx.notice('warning',
              'Code panel error: ' + (err && err.message ? err.message : String(err)));
          }

          // Wrap in a div so we can locate it for Prism after mount
          const wrap = h('div', { 'class': 'uir-ce__panel-wrap' });
          wrap.appendChild(panel);

          // Re-highlight asynchronously (covers Q2+, back-nav, retry)
          rehighlightPanel(wrap);

          return wrap;
        },
      });

      return card;
    },
  });
})();

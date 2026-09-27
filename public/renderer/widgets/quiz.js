/* quiz.js  –  UIRenderer quiz widget (bare: true)
 * Exposes window.UIRPractice.questionFlow(questions, opts) for reuse by code_exercise.
 * payload: { questions: [{ question, hint, options[], answer_index, explanation }] }
 */
(function () {
  'use strict';

  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  /* ── small DOM helper (mirrors core h but self-contained) ── */
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

  /* ── SVG check-mark ── */
  function checkSvg() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 12 12');
    svg.setAttribute('aria-hidden', 'true');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', '1.5,6 4.5,9.5 10.5,2.5');
    poly.setAttribute('stroke', '#fff');
    poly.setAttribute('stroke-width', '2');
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke-linecap', 'round');
    poly.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(poly);
    return svg;
  }

  /* ── SVG X-mark ── */
  function xSvg() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 12 12');
    svg.setAttribute('aria-hidden', 'true');
    ['1.5,1.5 10.5,10.5', '10.5,1.5 1.5,10.5'].forEach(function (pts) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      line.setAttribute('points', pts);
      line.setAttribute('stroke', '#fff');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke-linecap', 'round');
      svg.appendChild(line);
    });
    return svg;
  }

  /* ══════════════════════════════════════════════════════════
     questionFlow – the reusable engine
     questions : [{ question, hint, options[], answer_index, explanation }]
     opts      : {
       unitLabel      – counter suffix, e.g. "quizzes"
       chipLabel      – pill text, e.g. "Quiz"
       renderPreface  – function(q, ctx) → Node|null  inserted directly
                        BEFORE the question title; same try/catch and
                        back-nav rules as renderContext
       renderContext  – function(q, ctx) → Node|null  inserted between hint
                        and options; called on every render incl. back-nav;
                        errors are caught and shown as a notice, never thrown
       ctx            – UIRenderer ctx object passed from render(); forwarded
                        to renderPreface and renderContext so they can use
                        ctx.codePanel etc.
     }
     returns   : HTMLElement (the card)
  ══════════════════════════════════════════════════════════ */
  function questionFlow(questions, opts) {
    opts = opts || {};
    const unitLabel  = opts.unitLabel  || 'questions';
    const chipLabel  = opts.chipLabel  || 'Quiz';
    const ctx        = opts.ctx        || null;
    const total      = questions.length;

    // per-question state: { chosenIndex: number|null }
    const answers = questions.map(function () { return { chosenIndex: null }; });
    let current = 0;

    /* ── root card ── */
    const card = h('div', { 'class': 'uir-quiz', role: 'region', 'aria-label': chipLabel });

    /* ── header ── */
    const counterEl = h('span', { 'class': 'uir-quiz__counter' });
    const chip      = h('span', { 'class': 'uir-quiz__chip' }, chipLabel);
    const header    = h('div',  { 'class': 'uir-quiz__header' }, counterEl, chip);

    /* ── progress ── */
    const fill  = h('div', { 'class': 'uir-quiz__progress-fill' });
    const track = h('div', { 'class': 'uir-quiz__progress-track' }, fill);

    /* ── question body ── */
    const renderPrefaceEl = h('div', { 'class': 'uir-quiz__render-preface' });
    const questionEl      = h('p',   { 'class': 'uir-quiz__question' });
    const hintEl          = h('p',   { 'class': 'uir-quiz__hint' });
    const renderContextEl = h('div', { 'class': 'uir-quiz__render-context' });
    const optionsList     = h('ul',  { 'class': 'uir-quiz__options', role: 'listbox' });

    /* ── explanation ── */
    const explanationEl = h('div', { 'class': 'uir-quiz__explanation' });

    /* ── footer ── */
    const prevBtn = h('button', {
      'class': 'uir-quiz__btn uir-quiz__btn--outline',
      type: 'button',
    }, 'Previous Question');

    const nextBtn = h('button', {
      'class': 'uir-quiz__btn uir-quiz__btn--solid',
      type: 'button',
    });

    const footer = h('div', { 'class': 'uir-quiz__footer' }, prevBtn, nextBtn);
    const divider = h('hr', { 'class': 'uir-quiz__divider' });

    /* ── results screen ── */
    const scoreEl      = h('div', { 'class': 'uir-quiz__score' });
    const scoreLabelEl = h('div', { 'class': 'uir-quiz__score-label' }, 'Keep practising!');
    const retryBtn     = h('button', {
      'class': 'uir-quiz__btn uir-quiz__btn--solid',
      type: 'button',
    }, 'Retry');
    const resultsDiv = h('div', { 'class': 'uir-quiz__results' }, scoreEl, scoreLabelEl,
      h('div', { style: 'margin-top:16px' }, retryBtn));

    card.append(header, track, renderPrefaceEl, questionEl, hintEl, renderContextEl, optionsList, explanationEl, divider, footer);

    /* ── build option rows ── */
    function buildOptions(q, qIndex) {
      optionsList.innerHTML = '';
      const state = answers[qIndex];
      const revealed = state.chosenIndex !== null;

      q.options.forEach(function (text, i) {
        const letter  = h('span', { 'class': 'uir-quiz__letter' }, LETTERS[i] || String(i + 1));
        const optString = typeof text === 'string' ? text : (text && (text.text || text.label) ? String(text.text || text.label) : String(text || ''));
        const optText = h('span', { 'class': 'uir-quiz__opt-text' }, optString);
        const radio   = h('span', { 'class': 'uir-quiz__radio', 'aria-hidden': 'true' });

        const isChosen  = revealed && i === state.chosenIndex;
        const isCorrect = revealed && i === q.answer_index;
        const isWrong   = revealed && isChosen && !isCorrect;

        // Right-side icon: X for wrong chosen, green check for correct (chosen or not), empty radio otherwise
        var rightIcon;
        if (isWrong) {
          rightIcon = h('span', { 'class': 'uir-quiz__check uir-quiz__check--err', 'aria-hidden': 'true' }, xSvg());
        } else if (isCorrect) {
          rightIcon = h('span', { 'class': 'uir-quiz__check uir-quiz__check--ok', 'aria-hidden': 'true' }, checkSvg());
        } else {
          rightIcon = radio;
        }

        let cls = 'uir-quiz__option';
        if (isWrong)                               cls += ' is-wrong';
        else if (isChosen && isCorrect)            cls += ' is-selected is-correct';
        else if (!isChosen && isCorrect && revealed) cls += ' is-correct';

        const btn = h('button', {
          'class': cls,
          type: 'button',
          role: 'option',
          'aria-selected': isChosen ? 'true' : 'false',
          'aria-disabled': revealed ? 'true' : null,
        }, letter, optText, rightIcon);

        if (!revealed) {
          btn.addEventListener('click', function () { selectAnswer(qIndex, i); });
          btn.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
              e.preventDefault();
              const next = optionsList.querySelector('[role="option"]:nth-child(' + (i + 2) + ')');
              if (next) next.focus();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
              e.preventDefault();
              const prev = optionsList.querySelector('[role="option"]:nth-child(' + i + ')');
              if (prev) prev.focus();
            }
          });
        }

        optionsList.appendChild(h('li', { style: 'list-style:none;padding:0;margin:0' }, btn));
      });
    }

    /* ── select + reveal ── */
    function selectAnswer(qIndex, optIndex) {
      answers[qIndex].chosenIndex = optIndex;
      render(qIndex);
    }

    /* ── renderPreface slot: goes directly before the question title ── */
    function updateRenderPreface(q) {
      renderPrefaceEl.innerHTML = '';
      if (typeof opts.renderPreface !== 'function') {
        renderPrefaceEl.style.display = 'none';
        return;
      }
      var node;
      try {
        node = opts.renderPreface(q, ctx);
      } catch (err) {
        node = h('div', { 'class': 'uir-notice uir-notice--warning', role: 'alert' },
          'renderPreface error: ' + (err && err.message ? err.message : String(err)));
      }
      if (node instanceof Node) {
        renderPrefaceEl.appendChild(node);
        renderPrefaceEl.style.display = '';
      } else {
        renderPrefaceEl.style.display = 'none';
      }
    }

    /* ── renderContext slot: called on every render, errors caught ── */
    function updateRenderContext(q) {
      renderContextEl.innerHTML = '';
      if (typeof opts.renderContext !== 'function') {
        renderContextEl.style.display = 'none';
        return;
      }
      var node;
      try {
        node = opts.renderContext(q, ctx);
      } catch (err) {
        node = h('div', { 'class': 'uir-notice uir-notice--warning', role: 'alert' },
          'renderContext error: ' + (err && err.message ? err.message : String(err)));
      }
      if (node instanceof Node) {
        renderContextEl.appendChild(node);
        renderContextEl.style.display = '';
      } else {
        renderContextEl.style.display = 'none';
      }
    }

    /* ── render a question ── */
    function render(idx) {
      current = idx;
      const q     = questions[idx];
      const state = answers[idx];
      const revealed = state.chosenIndex !== null;

      // header + progress
      counterEl.textContent = (idx + 1) + ' of ' + total + ' ' + (total === 1 ? 'question' : unitLabel);
      fill.style.width = ((idx + 1) / total * 100) + '%';

      // preface slot (directly before question title)
      updateRenderPreface(q);

      // question
      questionEl.textContent = q.question || '';
      hintEl.textContent     = q.hint     || '';

      // renderContext slot (between hint and options)
      updateRenderContext(q);

      // options
      buildOptions(q, idx);

      // explanation
      if (revealed) {
        explanationEl.innerHTML = '';
        const isCorrectAnswer = state.chosenIndex === q.answer_index;
        const verdictText = isCorrectAnswer
          ? 'Correct.'
          : 'Not quite. The answer is ' + (LETTERS[q.answer_index] || String(q.answer_index + 1)) + '.';
        const verdictEl = h('strong', { 'class': 'uir-quiz__verdict' }, verdictText);
        explanationEl.appendChild(verdictEl);
        if (q.explanation) {
          explanationEl.appendChild(document.createTextNode(' ' + q.explanation));
        }
        explanationEl.style.display = '';
      } else {
        explanationEl.style.display = 'none';
      }

      // footer buttons
      prevBtn.disabled = idx === 0;
      const isLast = idx === total - 1;
      nextBtn.textContent = isLast ? 'See results' : 'Next Question';

      // hide results, show question UI
      if (resultsDiv.parentNode) resultsDiv.remove();
      divider.style.display = '';
      footer.style.display  = '';
      optionsList.style.display = '';
      questionEl.style.display  = '';
      hintEl.style.display      = '';
      track.style.display       = '';
      header.style.display      = '';
    }

    /* ── show results ── */
    function showResults() {
      const correct = answers.filter(function (a, i) {
        return a.chosenIndex === questions[i].answer_index;
      }).length;

      scoreEl.textContent      = correct + ' of ' + total + ' correct';
      scoreLabelEl.textContent = correct === total ? 'Perfect score!' : correct === 0 ? 'Keep practising!' : 'Good effort!';

      // hide question content
      optionsList.style.display      = 'none';
      questionEl.style.display       = 'none';
      hintEl.style.display           = 'none';
      renderPrefaceEl.style.display  = 'none';
      renderContextEl.style.display  = 'none';
      explanationEl.style.display    = 'none';
      divider.style.display          = 'none';
      footer.style.display           = 'none';
      track.style.display            = 'none';

      // update counter in header (still visible)
      counterEl.textContent = 'Quiz results';
      header.style.display  = '';

      if (!resultsDiv.parentNode) card.appendChild(resultsDiv);
    }

    /* ── navigation ── */
    prevBtn.addEventListener('click', function () {
      if (current > 0) render(current - 1);
    });

    nextBtn.addEventListener('click', function () {
      if (current < total - 1) {
        render(current + 1);
      } else {
        showResults();
      }
    });

    retryBtn.addEventListener('click', function () {
      answers.forEach(function (a) { a.chosenIndex = null; });
      render(0);
    });

    /* ── initial render ── */
    explanationEl.style.display = 'none';
    render(0);

    return card;
  }

  /* ── resolve correct index from any standard field ── */
  function resolveCorrectIndex(q) {
    if (!q || typeof q !== 'object') return 0;
    var opts = Array.isArray(q.options) ? q.options : [];
    var raw = q.answer_index !== undefined ? q.answer_index :
      (q.correct_index !== undefined ? q.correct_index :
      (q.correctIndex !== undefined ? q.correctIndex :
      (q.answerIndex !== undefined ? q.answerIndex :
      (q.correct_option !== undefined ? q.correct_option :
      (q.correctOption !== undefined ? q.correctOption :
      (q.correct_answer !== undefined ? q.correct_answer :
      (q.correctAnswer !== undefined ? q.correctAnswer :
      (q.answer !== undefined ? q.answer :
      (q.correct !== undefined ? q.correct : undefined)))))))));

    if (raw === undefined || raw === null) return 0;

    if (typeof raw === 'number') {
      if (opts.length > 0 && raw === opts.length) return raw - 1;
      if (raw >= 0 && raw < opts.length) return raw;
      if (raw > 0 && raw <= opts.length) return raw - 1;
      return raw;
    }

    var str = String(raw).trim();
    if (/^\d+$/.test(str)) {
      var num = parseInt(str, 10);
      if (opts.length > 0 && num === opts.length) return num - 1;
      if (num >= 0 && num < opts.length) return num;
      if (num > 0 && num <= opts.length) return num - 1;
      return num;
    }

    var letterMatch = str.match(/(?:option\s+|^)([A-F])(?:\b|[\.\:\s\)])/i);
    if (letterMatch) {
      var idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
      if (idx >= 0 && (opts.length === 0 || idx < opts.length)) return idx;
    }

    var lowerStr = str.toLowerCase();
    for (var i = 0; i < opts.length; i++) {
      var optText = typeof opts[i] === 'string' ? opts[i] : (opts[i].text || opts[i].label || String(opts[i]));
      var cleanOpt = optText.replace(/^[A-F][\.\)\:\s]\s*/i, '').trim().toLowerCase();
      if (cleanOpt && (cleanOpt === lowerStr || lowerStr.includes(cleanOpt) || cleanOpt.includes(lowerStr))) {
        return i;
      }
    }

    return 0;
  }

  /* ── normalize question items from any envelope/payload structure ── */
  function extractQuestions(p, env) {
    var rawList = [];
    if (p) {
      if (Array.isArray(p.questions) && p.questions.length) rawList = p.questions;
      else if (Array.isArray(p.items) && p.items.length) rawList = p.items;
      else if (Array.isArray(p.quiz) && p.quiz.length) rawList = p.quiz;
      else if (Array.isArray(p) && p.length) rawList = p;
      else if (p.question || (Array.isArray(p.options) && p.options.length)) rawList = [p];
    }
    if (!rawList.length && env) {
      if (Array.isArray(env.questions) && env.questions.length) rawList = env.questions;
      else if (Array.isArray(env.items) && env.items.length) rawList = env.items;
      else if (env.question || (Array.isArray(env.options) && env.options.length)) rawList = [env];
      else if (env.payload) {
        if (Array.isArray(env.payload.questions) && env.payload.questions.length) rawList = env.payload.questions;
        else if (Array.isArray(env.payload.items) && env.payload.items.length) rawList = env.payload.items;
        else if (env.payload.question || (Array.isArray(env.payload.options) && env.payload.options.length)) rawList = [env.payload];
      }
    }
    return rawList.map(function (item) {
      if (!item) return null;
      var opts = Array.isArray(item.options) ? item.options : [];
      var cleanOpts = opts.map(function (o) {
        if (typeof o === 'string') return o.replace(/^[A-F][\.\)\:\s]\s*/i, '');
        if (o && (o.text || o.label)) return String(o.text || o.label).replace(/^[A-F][\.\)\:\s]\s*/i, '');
        return String(o);
      });
      return {
        question: item.question || item.text || item.title || item.prompt || '',
        hint: item.hint || item.code_context || '',
        options: cleanOpts,
        answer_index: resolveCorrectIndex(item),
        explanation: item.explanation || item.rationale || item.why || ''
      };
    }).filter(function (q) {
      return q && (q.question || q.options.length > 0);
    });
  }

  /* ── expose on window for code_exercise reuse ── */
  if (!window.UIRPractice) window.UIRPractice = {};
  window.UIRPractice.questionFlow = questionFlow;
  window.UIRPractice.resolveCorrectIndex = resolveCorrectIndex;

  /* ── register widget ── */
  UIRenderer.register('quiz', {
    category: 'Practice',
    label: 'Quiz',
    bare: true,
    render: function (p, ctx, env) {
      const questions = extractQuestions(p, env);
      if (!questions.length) return ctx.notice('warning', 'Quiz has no questions.');
      return questionFlow(questions, { unitLabel: 'questions', chipLabel: 'Quiz', ctx: ctx });
    },
  });
})();

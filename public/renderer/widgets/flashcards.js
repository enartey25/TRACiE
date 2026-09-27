/* flashcards.js  –  UIRenderer flashcards widget (bare: true)
 * Design: docs/renderer/design/flashcards-audio.png (left half)
 * payload: { cards: [{ front, prompt, back, detail, related?: { term, text } }] }
 */
(function () {
  'use strict';

  /* ── small DOM helper ── */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var children = Array.prototype.slice.call(arguments, 2);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
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

  /* ── detect reduced-motion preference ── */
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ══════════════════════════════════════════════════════════
     flashcardDeck(cards, notice)
     cards : [{ front, prompt, back, detail, related? }]
     notice: the ctx.notice function for error display
     returns: HTMLElement (the bare widget root)
  ══════════════════════════════════════════════════════════ */
  function flashcardDeck(cards, notice) {
    var total = cards.length;

    /* per-card state: 'unseen' | 'learned' | 'review' */
    var states = cards.map(function () { return 'unseen'; });
    /* which subset we are currently iterating */
    var deck = cards.map(function (_, i) { return i; }); // indices into cards[]
    var deckPos = 0;   // position inside deck[]
    var isFlipped = false;

    /* ── counts ── */
    function countLearned() {
      return states.filter(function (s) { return s === 'learned'; }).length;
    }
    function countReview() {
      return states.filter(function (s) { return s === 'review'; }).length;
    }

    /* ════════════════ ROOT ════════════════ */
    var root = h('div', { 'class': 'uir-fc', role: 'region', 'aria-label': 'Flashcards' });

    /* ════════════════ LEFT: card column ════════════════ */
    var cardCol = h('div', { 'class': 'uir-fc__card-col' });

    /* ── card shell ── */
    var cardEl = h('div', { 'class': 'uir-fc__card' });

    /* header */
    var counterEl = h('span', { 'class': 'uir-fc__counter' });
    var chipEl    = h('span', { 'class': 'uir-fc__chip' }, 'Flashcard');
    var headerEl  = h('div',  { 'class': 'uir-fc__header' }, counterEl, chipEl);

    /* progress bar */
    var progFill  = h('div', { 'class': 'uir-fc__progress-fill' });
    var progTrack = h('div', { 'class': 'uir-fc__progress-track' }, progFill);

    /* ── flip container ── */
    var flipWrap  = h('div', { 'class': 'uir-fc__flip-wrap', tabindex: '0',
      role: 'button', 'aria-label': 'Flashcard – press Enter or Space to flip' });
    var flipInner = h('div', { 'class': 'uir-fc__flip-inner' });

    /* ── FRONT face ── */
    var termEl      = h('div', { 'class': 'uir-fc__term' });
    var promptEl    = h('p',   { 'class': 'uir-fc__prompt' });
    var hintTitle   = h('p',   { 'class': 'uir-fc__flip-hint-title' }, 'Click to flip');
    var hintBody    = h('p',   { 'class': 'uir-fc__flip-hint-body' },
      'Use the back side to reinforce the definition, example, and related term.');
    var flipHintEl  = h('div', { 'class': 'uir-fc__flip-hint' }, hintTitle, hintBody);
    var frontFace   = h('div', { 'class': 'uir-fc__face uir-fc__face--front' },
      termEl, promptEl, flipHintEl);

    /* ── BACK face ── */
    var backTitleEl = h('div', { 'class': 'uir-fc__back-title' });
    var detailEl    = h('p',   { 'class': 'uir-fc__detail' });
    /* related term box (optional) */
    var relatedLabelEl = h('p', { 'class': 'uir-fc__related-label' });
    var relatedTextEl  = h('p', { 'class': 'uir-fc__related-text' });
    var relatedBox     = h('div', { 'class': 'uir-fc__related' }, relatedLabelEl, relatedTextEl);
    /* footer */
    var dividerEl    = h('hr', { 'class': 'uir-fc__divider' });
    var reviewBtn    = h('button', { 'class': 'uir-fc__btn uir-fc__btn--outline', type: 'button' }, 'Needs review');
    var gotItBtn     = h('button', { 'class': 'uir-fc__btn uir-fc__btn--solid', type: 'button' }, 'Got it');
    var actionsEl    = h('div', { 'class': 'uir-fc__actions' }, reviewBtn, gotItBtn);
    var backFace     = h('div', { 'class': 'uir-fc__face uir-fc__face--back' },
      backTitleEl, detailEl, relatedBox, dividerEl, actionsEl);

    flipInner.append(frontFace, backFace);
    flipWrap.appendChild(flipInner);
    cardEl.append(headerEl, progTrack, flipWrap);

    /* ── complete screen (replaces cardEl content) ── */
    var completeDiv      = h('div',   { 'class': 'uir-fc__complete' });
    var compTitle        = h('div',   { 'class': 'uir-fc__complete-title' }, 'Deck complete');
    var compSub          = h('div',   { 'class': 'uir-fc__complete-sub' });
    var compLearnedNum   = h('span',  { 'class': 'uir-fc__complete-stat-num' });
    var compLearnedLbl   = h('span',  { 'class': 'uir-fc__complete-stat-label' }, 'Learned');
    var compReviewNum    = h('span',  { 'class': 'uir-fc__complete-stat-num' });
    var compReviewLbl    = h('span',  { 'class': 'uir-fc__complete-stat-label' }, 'Needs review');
    var compStats        = h('div',   { 'class': 'uir-fc__complete-stats' },
      h('div', { 'class': 'uir-fc__complete-stat' }, compLearnedNum, compLearnedLbl),
      h('div', { 'class': 'uir-fc__complete-stat' }, compReviewNum,  compReviewLbl));
    var restartBtn       = h('button', { 'class': 'uir-fc__btn uir-fc__btn--outline', type: 'button' }, 'Restart deck');
    var reviewAgainBtn   = h('button', { 'class': 'uir-fc__btn uir-fc__btn--solid', type: 'button' }, 'Review again');
    var compBtns         = h('div', { 'class': 'uir-fc__complete-btns' }, restartBtn, reviewAgainBtn);
    completeDiv.append(compTitle, compSub, compStats, compBtns);

    cardCol.appendChild(cardEl);

    /* ════════════════ RIGHT: progress panel ════════════════ */
    var panelEl       = h('div', { 'class': 'uir-fc__panel' });
    var panelTitle    = h('div', { 'class': 'uir-fc__panel-title' }, 'Progress summary');
    var panelSubEl    = h('div', { 'class': 'uir-fc__panel-sub' });
    var learnedLabel  = h('span', null, 'Learned');
    var learnedCount  = h('span', { 'class': 'uir-fc__stat-count' }, '0');
    var reviewLabel   = h('span', null, 'Needs review');
    var reviewCount   = h('span', { 'class': 'uir-fc__stat-count' }, '0');
    var statRow1      = h('div', { 'class': 'uir-fc__stat-row' }, learnedLabel, learnedCount);
    var statRow2      = h('div', { 'class': 'uir-fc__stat-row' }, reviewLabel,  reviewCount);
    var panelFill     = h('div', { 'class': 'uir-fc__panel-fill' });
    var panelTrack    = h('div', { 'class': 'uir-fc__panel-track' }, panelFill);
    var rhythmLabel   = h('p', { 'class': 'uir-fc__rhythm-label' }, 'Review rhythm');
    var rhythmText    = h('p', { 'class': 'uir-fc__rhythm-text' },
      'The front shows the prompt, and the back explains the term with a concise summary and a useful example. Use the actions below the card to decide whether it should be marked as learned or scheduled for another review.');
    var rhythmBox     = h('div', { 'class': 'uir-fc__rhythm-box' }, rhythmLabel, rhythmText);

    panelEl.append(panelTitle, panelSubEl, statRow1, statRow2, panelTrack, rhythmBox);

    /* ── assemble root ── */
    root.append(cardCol, panelEl);

    /* ════════════════ helpers ════════════════ */
    function updatePanel() {
      var learned = countLearned();
      var review  = countReview();
      learnedCount.textContent = String(learned);
      reviewCount.textContent  = String(review);
      panelFill.style.width    = total > 0 ? ((learned / total) * 100) + '%' : '0%';
      panelSubEl.textContent   = 'Out of ' + total + ' flashcard' + (total !== 1 ? 's' : '') + ' in this deck';
    }

    function currentCardIndex() {
      return deck[deckPos];
    }

    function setFlipped(val) {
      isFlipped = val;
      if (val) {
        flipWrap.classList.add('is-flipped');
        flipWrap.setAttribute('aria-label', 'Flashcard – back side. Press Enter or Space to flip back.');
      } else {
        flipWrap.classList.remove('is-flipped');
        flipWrap.setAttribute('aria-label', 'Flashcard – press Enter or Space to flip');
      }
    }

    function renderCard() {
      if (deckPos >= deck.length) {
        showComplete();
        return;
      }
      var ci = currentCardIndex();
      var card = cards[ci];

      /* header + progress (progress = position in current deck) */
      counterEl.textContent = (deckPos + 1) + ' of ' + deck.length + ' flashcard' + (deck.length !== 1 ? 's' : '');
      progFill.style.width = ((deckPos + 1) / deck.length * 100) + '%';

      /* FRONT */
      termEl.textContent   = card.front  || '';
      promptEl.textContent = card.prompt || '';

      /* BACK */
      backTitleEl.textContent = card.back   || '';
      detailEl.textContent    = card.detail || '';

      /* related term (optional) */
      if (card.related && (card.related.term || card.related.text)) {
        relatedLabelEl.textContent = card.related.term || '';
        relatedTextEl.textContent  = card.related.text || '';
        relatedBox.style.display = '';
      } else {
        relatedBox.style.display = 'none';
      }

      /* ensure we start on front */
      setFlipped(false);

      /* make sure card content is visible (not complete screen) */
      if (!cardEl.contains(headerEl)) cardEl.append(headerEl, progTrack, flipWrap);
      if (completeDiv.parentNode) completeDiv.remove();

      updatePanel();
    }

    function advanceOrComplete(outcome) {
      var ci = currentCardIndex();
      states[ci] = outcome;
      deckPos++;
      updatePanel();
      renderCard(); // will call showComplete if deckPos >= deck.length
    }

    function showComplete() {
      var learned = countLearned();
      var review  = countReview();

      compLearnedNum.textContent = String(learned);
      compReviewNum.textContent  = String(review);
      compSub.textContent        = learned === total
        ? 'You learned all ' + total + ' cards!'
        : learned > 0
          ? 'Great progress on ' + total + ' cards.'
          : 'Keep going — try again!';

      /* "Review again" only when review cards exist; "Restart deck" always shown */
      reviewAgainBtn.style.display = review > 0 ? '' : 'none';

      /* swap card body */
      headerEl.remove();
      progTrack.remove();
      flipWrap.remove();
      if (!cardEl.contains(completeDiv)) cardEl.appendChild(completeDiv);
    }

    /* ════════════════ event wiring ════════════════ */

    /* flip on click anywhere in flipWrap */
    flipWrap.addEventListener('click', function () {
      setFlipped(!isFlipped);
    });

    /* flip on Enter / Space */
    flipWrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setFlipped(!isFlipped);
      }
    });

    /* "Got it" – mark learned, advance */
    gotItBtn.addEventListener('click', function (e) {
      e.stopPropagation(); // don't also flip
      advanceOrComplete('learned');
    });
    gotItBtn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
    });

    /* "Needs review" – mark review, advance */
    reviewBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      advanceOrComplete('review');
    });
    reviewBtn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
    });

    /* "Restart deck" – full reset, start from card 1 */
    restartBtn.addEventListener('click', function () {
      states = cards.map(function () { return 'unseen'; });
      deck   = cards.map(function (_, i) { return i; });
      deckPos = 0;
      renderCard();
    });

    /* "Review again" – restart with only review-tagged cards */
    reviewAgainBtn.addEventListener('click', function () {
      var reviewIndices = [];
      states.forEach(function (s, i) { if (s === 'review') reviewIndices.push(i); });
      if (reviewIndices.length === 0) return;
      deck    = reviewIndices;
      deckPos = 0;
      /* reset states of review-deck cards so they can be re-tagged */
      reviewIndices.forEach(function (i) { states[i] = 'unseen'; });
      renderCard();
    });

    /* ── initial render ── */
    updatePanel();
    renderCard();

    return root;
  }

  /* ── register widget ── */
  UIRenderer.register('flashcards', {
    category: 'Practice',
    label: 'Flashcards',
    bare: true,
    render: function (p, ctx) {
      var cards = Array.isArray(p && p.cards) ? p.cards : [];
      if (!cards.length) return ctx.notice('warning', 'Flashcards: no cards in payload.');
      return flashcardDeck(cards, ctx.notice);
    },
  });
})();

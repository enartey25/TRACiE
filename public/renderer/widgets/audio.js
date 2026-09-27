/* audio.js  –  UIRenderer audio widget (bare: true)
 * Design: docs/renderer/design/flashcards-audio.png (right half)
 * payload: { src, title, description, transcript?, downloadable? }
 */
(function () {
  'use strict';

  /* ── small DOM helper (same pattern as flashcards.js) ── */
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

  /* ── mm:ss formatter ── */
  function fmt(t) {
    if (!isFinite(t) || isNaN(t)) return '--:--';
    var m = Math.floor(t / 60);
    var s = Math.floor(t % 60);
    return m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
  }

  /* ── Lucide icon SVGs (inline, path-only for size) ── */
  var ICONS = {
    download: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    play:     '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    pause:    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
    rewind:   '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
    forward:  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
  };

  function svgEl(name) {
    var wrap = document.createElement('span');
    wrap.className = 'uir-audio__icon';
    wrap.innerHTML = ICONS[name];
    return wrap;
  }

  /* ── speed cycle values ── */
  var SPEEDS = [1, 1.25, 1.5, 2];

  /* ══════════════════════════════════════════════════════
     render(payload, ctx)
  ══════════════════════════════════════════════════════ */
  function render(payload, ctx) {
    var src = payload && payload.src;

    /* ── security: validate src ── */
    if (!src || (typeof src === 'string' && !src.match(/^(https:|\/)/))) {
      return ctx.notice('Invalid audio source.');
    }

    /* ── hidden <audio> element ── */
    var audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = src;
    audio.setAttribute('data-uir-audio', '');

    /* ── root card ── */
    var root = h('div', { 'class': 'uir-audio uir-audio--loading', role: 'region', 'aria-label': payload.title || 'Audio player' });

    /* ── header row ── */
    var title = h('p', { 'class': 'uir-audio__title' });
    title.textContent = payload.title || '';

    var header = h('div', { 'class': 'uir-audio__header' }, title);

    if (payload.downloadable && src) {
      var dlBtn = h('a', {
        'class': 'uir-audio__download',
        href: src,
        download: true,
        target: '_blank',
        rel: 'noopener',
        'aria-label': 'Download audio',
        title: 'Download',
      });
      dlBtn.innerHTML = ICONS.download;
      header.appendChild(dlBtn);
    }

    /* ── description ── */
    var desc = h('p', { 'class': 'uir-audio__desc' });
    if (payload.description) desc.textContent = payload.description;

    /* ── time row ── */
    var currentEl = h('span', { 'class': 'uir-audio__current' }, '0:00');
    var durationEl = h('span', { 'class': 'uir-audio__duration' }, '--:--');
    var timeRow = h('div', { 'class': 'uir-audio__time-row' }, currentEl, durationEl);

    /* ── progress bar ── */
    var fill = h('div', { 'class': 'uir-audio__progress-fill' });
    var skeleton = h('div', { 'class': 'uir-audio__skeleton' });
    var track = h('div', { 'class': 'uir-audio__progress-track' }, skeleton, fill);

    var seekInput = h('input', {
      'class': 'uir-audio__seek',
      type: 'range',
      min: '0',
      max: '100',
      value: '0',
      step: '0.1',
      disabled: true,
      'aria-label': 'Seek',
    });

    var progressWrap = h('div', { 'class': 'uir-audio__progress' }, track, seekInput);
    var playerLeft = h('div', { 'class': 'uir-audio__player-left' }, timeRow, progressWrap);

    /* ── play/pause pill ── */
    var ppBtn = h('button', { 'class': 'uir-audio__playpause', type: 'button', 'aria-label': 'Play' });
    ppBtn.appendChild(svgEl('play'));
    ppBtn.appendChild(document.createTextNode('Play'));

    var playerRow = h('div', { 'class': 'uir-audio__player' }, playerLeft, ppBtn);

    /* ── bottom controls ── */
    var skipBack = h('button', { 'class': 'uir-audio__skip', type: 'button', 'data-dir': '-10', disabled: true, 'aria-label': 'Skip back 10 seconds' });
    skipBack.appendChild(svgEl('rewind'));
    skipBack.appendChild(document.createTextNode('-10s'));

    var speedBtn = h('button', { 'class': 'uir-audio__speed', type: 'button', 'aria-label': 'Playback speed' }, '1×');

    var skipFwd = h('button', { 'class': 'uir-audio__skip', type: 'button', 'data-dir': '+10', disabled: true, 'aria-label': 'Skip forward 10 seconds' });
    skipFwd.appendChild(svgEl('forward'));
    skipFwd.appendChild(document.createTextNode('+10s'));

    var controls = h('div', { 'class': 'uir-audio__controls' }, skipBack, speedBtn, skipFwd);

    /* ── transcript ── */
    var transcriptEl = null;
    if (payload.transcript) {
      var summary = h('summary', {}, 'Transcript');
      var tBody = h('p', { 'class': 'uir-audio__transcript-body' });
      tBody.textContent = payload.transcript;
      transcriptEl = h('details', { 'class': 'uir-audio__transcript' }, summary, tBody);
    }

    /* ── assemble ── */
    root.appendChild(audio);
    root.appendChild(header);
    if (payload.description) root.appendChild(desc);
    root.appendChild(playerRow);
    root.appendChild(controls);
    if (transcriptEl) root.appendChild(transcriptEl);

    /* ══════════════════════════════════════════════════════
       State machine
    ══════════════════════════════════════════════════════ */
    var speedIdx = 0;
    var ended = false;

    function setPPButton(state) {
      /* state: 'play' | 'pause' | 'replay' */
      ppBtn.innerHTML = '';
      if (state === 'pause') {
        ppBtn.appendChild(svgEl('pause'));
        ppBtn.appendChild(document.createTextNode('Pause'));
        ppBtn.setAttribute('aria-label', 'Pause');
      } else if (state === 'replay') {
        ppBtn.appendChild(svgEl('play'));
        ppBtn.appendChild(document.createTextNode('Replay'));
        ppBtn.setAttribute('aria-label', 'Replay');
      } else {
        ppBtn.appendChild(svgEl('play'));
        ppBtn.appendChild(document.createTextNode('Play'));
        ppBtn.setAttribute('aria-label', 'Play');
      }
    }

    function updateDuration() {
      if (isFinite(audio.duration) && !isNaN(audio.duration)) {
        durationEl.textContent = fmt(audio.duration);
        seekInput.max = String(audio.duration);
        seekInput.disabled = false;
        skipBack.disabled = false;
        skipFwd.disabled = false;
        root.classList.remove('uir-audio--loading');
      } else {
        durationEl.textContent = '--:--';
        seekInput.disabled = true;
        skipBack.disabled = true;
        skipFwd.disabled = true;
      }
    }

    /* ── audio events ── */
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);

    audio.addEventListener('timeupdate', function () {
      currentEl.textContent = fmt(audio.currentTime);
      if (isFinite(audio.duration) && audio.duration > 0) {
        var pct = (audio.currentTime / audio.duration) * 100;
        fill.style.width = pct + '%';
        seekInput.value = String(audio.currentTime);
      }
    });

    audio.addEventListener('play', function () {
      ended = false;
      root.classList.add('uir-audio--playing');
      root.classList.remove('uir-audio--ended');
      setPPButton('pause');
    });

    audio.addEventListener('pause', function () {
      root.classList.remove('uir-audio--playing');
      if (!ended) setPPButton('play');
    });

    audio.addEventListener('ended', function () {
      ended = true;
      root.classList.remove('uir-audio--playing');
      root.classList.add('uir-audio--ended');
      setPPButton('replay');
    });

    audio.addEventListener('error', function () {
      var notice = ctx.notice('Audio failed to load. Please check the source URL.');
      root.insertBefore(notice, playerRow);
    });

    /* ── play/pause button ── */
    ppBtn.addEventListener('click', function () {
      if (ended) {
        ended = false;
        audio.currentTime = 0;
        root.classList.remove('uir-audio--ended');
        audio.play();
      } else if (!audio.paused) {
        audio.pause();
      } else {
        audio.play();
        /* pause all other audio widgets */
        document.querySelectorAll('[data-uir-audio]').forEach(function (a) {
          if (a !== audio && !a.paused) a.pause();
        });
      }
    });

    /* ── seek input ── */
    seekInput.addEventListener('input', function () {
      audio.currentTime = parseFloat(seekInput.value);
    });

    seekInput.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - 5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
      }
    });

    /* ── click-to-seek on visual track ── */
    track.addEventListener('click', function (e) {
      if (!isFinite(audio.duration) || audio.duration <= 0) return;
      var rect = track.getBoundingClientRect();
      var ratio = (e.clientX - rect.left) / rect.width;
      audio.currentTime = ratio * audio.duration;
    });

    /* ── skip buttons ── */
    function handleSkip() {
      var dir = parseInt(this.getAttribute('data-dir'), 10);
      audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + dir));
    }
    skipBack.addEventListener('click', handleSkip);
    skipFwd.addEventListener('click', handleSkip);

    /* ── speed pill ── */
    speedBtn.addEventListener('click', function () {
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      audio.playbackRate = SPEEDS[speedIdx];
      var label = SPEEDS[speedIdx] === 1 ? '1×' : SPEEDS[speedIdx] + '×';
      speedBtn.textContent = label;
    });

    return root;
  }

  /* ── register ── */
  UIRenderer.register('audio', {
    category: 'Media',
    label: 'Audio',
    bare: true,
    render: render,
  });

})();

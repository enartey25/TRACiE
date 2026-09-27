/* steps.js — tutorial, learning_path, workflow widgets
 * payload: { steps: [{ title, body, done? }] }
 * All three types share the same renderer; type controls progress bar / done circles. */
(function () {

  /**
   * Core renderer shared by all three step-based widget types.
   * @param {object}   p    - payload
   * @param {object}   ctx  - UIRenderer context
   * @param {string}   type - 'tutorial' | 'learning_path' | 'workflow'
   * @returns {DocumentFragment}
   */
  function renderSteps(p, ctx, type) {
    var h = ctx.h;
    var safeMarkdown = ctx.safeMarkdown;
    var notice = ctx.notice;

    var steps = Array.isArray(p && p.steps) ? p.steps : [];

    if (steps.length === 0) {
      return notice('info', 'No steps.');
    }

    var frag = document.createDocumentFragment();

    /* ── Progress bar (learning_path only) ──────────────────────────────── */
    if (type === 'learning_path') {
      var total = steps.length;
      var doneCount = steps.filter(function (s) { return s.done === true; }).length;
      var pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

      var progressWrap = h('div', { class: 'uir-steps__progress' });
      progressWrap.appendChild(
        h('p', { class: 'uir-steps__progress-label' }, doneCount + ' of ' + total + ' completed')
      );
      var track = h('div', {
        class: 'uir-steps__progress-track',
        role: 'progressbar',
        'aria-valuenow': String(doneCount),
        'aria-valuemin': '0',
        'aria-valuemax': String(total),
        'aria-label': doneCount + ' of ' + total + ' steps completed',
      });
      var fill = h('div', { class: 'uir-steps__progress-fill' });
      fill.style.width = pct + '%';
      track.appendChild(fill);
      progressWrap.appendChild(track);
      frag.appendChild(progressWrap);
    }

    /* ── Step list ──────────────────────────────────────────────────────── */
    var list = h('ol', { class: 'uir-steps__list' });

    steps.forEach(function (step, i) {
      var isDone = (type === 'learning_path' || type === 'workflow') && step.done === true;
      var num = String(i + 1);

      var item = h('li', { class: 'uir-steps__item' });

      /* Left column */
      var left = h('div', { class: 'uir-steps__left', 'aria-hidden': 'true' });

      /* Circle */
      var circleClass = 'uir-steps__circle' + (isDone ? ' uir-steps__circle--done' : '');
      var circle = h('div', { class: circleClass });
      if (isDone) {
        /* Checkmark — using a plain text character so no external resource needed */
        circle.appendChild(document.createTextNode('\u2713'));
      } else {
        circle.appendChild(document.createTextNode(num));
      }
      left.appendChild(circle);

      /* Vertical connector (shown for all but last step via CSS) */
      left.appendChild(h('div', { class: 'uir-steps__connector' }));

      item.appendChild(left);

      /* Right column */
      var right = h('div', { class: 'uir-steps__right' });

      /* Title */
      right.appendChild(
        h('p', { class: 'uir-steps__title' }, step.title || '')
      );

      /* Body — rendered as markdown */
      if (step.body) {
        var bodyEl = safeMarkdown(step.body, 'uir-steps__body');
        right.appendChild(bodyEl);
      }

      item.appendChild(right);
      list.appendChild(item);
    });

    frag.appendChild(list);
    return frag;
  }

  /* ── Register all three types ─────────────────────────────────────────── */

  UIRenderer.register('tutorial', {
    category: 'Workflows',
    label: 'Tutorial',
    bare: false,
    render: function (p, ctx, env) {
      return renderSteps(p, ctx, 'tutorial');
    },
  });

  UIRenderer.register('learning_path', {
    category: 'Workflows',
    label: 'Learning path',
    bare: false,
    render: function (p, ctx, env) {
      return renderSteps(p, ctx, 'learning_path');
    },
  });

  UIRenderer.register('workflow', {
    category: 'Workflows',
    label: 'Workflow',
    bare: false,
    render: function (p, ctx, env) {
      return renderSteps(p, ctx, 'workflow');
    },
  });

})();

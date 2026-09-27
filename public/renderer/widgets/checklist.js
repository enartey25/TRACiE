/* checklist widget
 * payload: { items: [{ text, done? }] }
 * States: default, checked-item, all-done, empty                         */
(function () {
  UIRenderer.register('checklist', {
    category: 'Workflows',
    label: 'Checklist',
    bare: false,

    render(p, ctx) {
      const { h, notice } = ctx;
      const items = Array.isArray(p.items) ? p.items : [];

      if (items.length === 0) {
        return notice('info', 'No items.');
      }

      /* ── root wrapper ─────────────────────────────────── */
      const wrap = h('div', { class: 'uir-checklist' });

      /* ── header row: title + counter pill ─────────────── */
      const header = h('div', { class: 'uir-checklist__header' });

      const counter = h('span', { class: 'uir-checklist__counter' });

      header.appendChild(counter);
      wrap.appendChild(header);

      /* ── list ─────────────────────────────────────────── */
      const list = h('ul', { class: 'uir-checklist__list' });

      /* Track checkboxes to wire up state updates */
      const checkboxes = [];

      items.forEach((item, idx) => {
        const isDone = !!item.done;
        const li = h('li', { class: 'uir-checklist__item' + (isDone ? ' uir-checklist__item--done' : '') });

        /* Unique id for <label> association */
        const cbId = 'uir-cl-item-' + idx + '-' + Math.random().toString(36).slice(2, 7);

        const cb = h('input', {
          type: 'checkbox',
          id: cbId,
          class: 'uir-checklist__checkbox',
          ...(isDone ? { checked: '' } : {}),
        });

        const label = h('label', { for: cbId, class: 'uir-checklist__label' }, item.text || '');

        li.appendChild(cb);
        li.appendChild(label);
        list.appendChild(li);
        checkboxes.push({ cb, li });
      });

      wrap.appendChild(list);

      /* ── all-done banner (hidden until complete) ──────── */
      const banner = h('div', { class: 'uir-checklist__banner', hidden: true }, '✓ All done!');
      wrap.appendChild(banner);

      /* ── live update function ─────────────────────────── */
      function update() {
        const total = checkboxes.length;
        const done = checkboxes.filter(({ cb }) => cb.checked).length;

        /* counter pill text */
        counter.textContent = done + ' of ' + total + ' done';

        /* per-row styling */
        checkboxes.forEach(({ cb, li }) => {
          if (cb.checked) {
            li.classList.add('uir-checklist__item--done');
          } else {
            li.classList.remove('uir-checklist__item--done');
          }
        });

        /* all-done state */
        if (done === total) {
          wrap.classList.add('uir-checklist--all-done');
          banner.hidden = false;
        } else {
          wrap.classList.remove('uir-checklist--all-done');
          banner.hidden = true;
        }
      }

      /* Wire up change listeners */
      checkboxes.forEach(({ cb }) => cb.addEventListener('change', update));

      /* Initial render */
      update();
      /* Hide banner initially if not all done (update() already sets hidden) */

      return wrap;
    },
  });
})();

/* commit_history + timeline widget
 * payload (commit_history): { commits: [{ sha?, when?, author?, message, detail?, tag? }] }
 * payload (timeline alias):  { events: [{ date?, label, detail? }] }
 * Design: vertical timeline rail, dot per commit, SHA chip, when·author, optional tag pill,
 *         bold message, muted detail.
 */
(function () {

  function normalizePayload(p) {
    // If timeline events present and no commits, map events → commits
    if (Array.isArray(p.events) && !Array.isArray(p.commits)) {
      return {
        commits: p.events.map(function (e) {
          return { when: e.date, message: e.label, detail: e.detail };
        }),
      };
    }
    return p;
  }

  function renderCommitHistory(p, ctx) {
    var h = ctx.h;
    var notice = ctx.notice;

    var payload = normalizePayload(p);
    var commits = Array.isArray(payload.commits) ? payload.commits : [];

    if (commits.length === 0) {
      return notice('info', 'No commits to display.');
    }

    var root = h('div', { class: 'uir-commit-history' });

    // vertical rail
    root.appendChild(h('div', { class: 'uir-commit-history__rail' }));

    var list = h('ul', { class: 'uir-commit-history__list' });

    commits.forEach(function (commit, idx) {
      var row = h('li', { class: 'uir-commit-history__row' });

      // dot
      var dotCol = h('div', { class: 'uir-commit-history__dot-col' });
      var dotClass = 'uir-commit-history__dot' + (idx === 0 ? ' uir-commit-history__dot--first' : '');
      dotCol.appendChild(h('span', { class: dotClass }));
      row.appendChild(dotCol);

      // content
      var content = h('div', { class: 'uir-commit-history__content' });

      // meta line: sha chip + when·author + tag pill
      var meta = h('div', { class: 'uir-commit-history__meta' });

      if (commit.sha) {
        meta.appendChild(h('span', { class: 'uir-commit-history__sha' }, commit.sha));
      }

      var whenParts = [];
      if (commit.when) whenParts.push(commit.when);
      if (commit.author) whenParts.push(commit.author);
      if (whenParts.length > 0) {
        meta.appendChild(h('span', { class: 'uir-commit-history__when' }, whenParts.join(' · ')));
      }

      if (commit.tag) {
        meta.appendChild(h('span', { class: 'uir-commit-history__tag' }, commit.tag));
      }

      content.appendChild(meta);

      // message
      if (commit.message) {
        content.appendChild(h('p', { class: 'uir-commit-history__message' }, commit.message));
      }

      // detail
      if (commit.detail) {
        content.appendChild(h('p', { class: 'uir-commit-history__detail' }, commit.detail));
      }

      row.appendChild(content);
      list.appendChild(row);
    });

    root.appendChild(list);
    return root;
  }

  UIRenderer.register('commit_history', {
    category: 'Code and Files',
    label: 'Commit history',
    render: renderCommitHistory,
  });

  UIRenderer.register('timeline', {
    category: 'Content and Guidance',
    label: 'Timeline',
    render: renderCommitHistory,
  });

})();

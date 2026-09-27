/* ===================================================
   TRACiE app.js  -  clean ASCII-only source
   =================================================== */

const state = {
  collapsed: false,
  view: 'chat',
  sent: false,
  practiceOpen: false,
  practiceTag: '',
  canvasType: null,
  messages: [],
  isQuerying: false,
  connected: [],
  activeRepoId: localStorage.getItem('tracie_active_repo') || null,
  apiWidgets: [],
  apiError: '',
  canvasOpen: true,
  turns: [],
  activeTurnIndex: null,
};
window.state = state;

const shell          = document.getElementById('tracyShell');
const collapseBtn    = document.getElementById('collapseBtn');
const navNewChat     = document.getElementById('navNewChat');
const navSearch      = document.getElementById('navSearch');
const navGallery     = document.getElementById('navGallery');
const repoInput      = document.getElementById('repoInput');
const connectBtn     = document.getElementById('connectBtn');
const connectedRepos = document.getElementById('connectedRepos');
const connectedList  = document.getElementById('connectedList');
const modeChat       = document.getElementById('modeChat');
const modePending    = document.getElementById('modePending');
const heroView       = document.getElementById('heroView');
const splitView      = document.getElementById('splitView');
const pendingView    = document.getElementById('pendingView');
const galleryView    = document.getElementById('galleryView');
const messageList    = document.getElementById('messageList');
const canvasTitle    = document.getElementById('canvasTitle');
const canvasPreview  = document.getElementById('canvasPreview');
const canvasError    = document.getElementById('canvasError');
const closeCanvas    = document.getElementById('closeCanvas');
const openCanvasBtn  = document.getElementById('openCanvasBtn');
const canvasPromptNav = document.getElementById('canvasPromptNav');
const queryInput     = document.getElementById('queryInput');
const sendBtn        = document.getElementById('sendBtn');
const addBtn         = document.getElementById('addBtn');
const practicePopover   = document.getElementById('practicePopover');
const practiceTagEl     = document.getElementById('practiceTag');
const practiceTagLabel  = document.getElementById('practiceTagLabel');
const practiceTypeInput = document.getElementById('practiceTypeInput');
const removePracticeTag = document.getElementById('removePracticeTag');
const searchOverlay  = document.getElementById('searchOverlay');
const searchInput    = document.getElementById('searchInput');
const closeSearch    = document.getElementById('closeSearch');
const pendingList    = document.getElementById('pendingList');

// ---- Sidebar collapse -------------------------------------------
collapseBtn.addEventListener('click', () => {
  state.collapsed = !state.collapsed;
  shell.classList.toggle('sidebar-collapsed', state.collapsed);
  collapseBtn.textContent = state.collapsed ? '\u203A' : '\u2039';
});

// ---- Nav: New Chat -----------------------------------------------
navNewChat.addEventListener('click', newChat);
function newChat() {
  state.sent = false;
  state.messages = [];
  state.turns = [];
  state.activeTurnIndex = null;
  state.canvasType = null;
  state.practiceTag = '';
  state.apiWidgets = [];
  state.apiError = '';
  sessionStorage.removeItem('tracie_session');
  setView('chat');
  updatePracticeTag();
  renderCanvasPromptNav();
  setNavActive(navNewChat);
  modeChat.classList.add('active');
  modePending.classList.remove('active');
  document.querySelectorAll('.history-item').forEach(b => b.classList.remove('selected'));
}

// ---- Nav: Search ------------------------------------------------
navSearch.addEventListener('click', () => {
  searchOverlay.style.display = 'flex';
  setTimeout(() => searchInput.focus(), 50);
  setNavActive(null);
});
closeSearch.addEventListener('click', () => { searchOverlay.style.display = 'none'; });
searchOverlay.addEventListener('click', (e) => {
  if (e.target === searchOverlay) searchOverlay.style.display = 'none';
});

// ---- Nav: Gallery -----------------------------------------------
navGallery.addEventListener('click', () => {
  setView('gallery');
  setNavActive(navGallery);
  modeChat.classList.remove('active');
  modePending.classList.remove('active');
});

function setNavActive(activeItem) {
  [navNewChat, navSearch, navGallery].forEach(el => el.classList.remove('active'));
  if (activeItem) activeItem.classList.add('active');
}

// ---- Topbar tabs ------------------------------------------------
modeChat.addEventListener('click', () => {
  setView('chat');
  modeChat.classList.add('active');
  modePending.classList.remove('active');
  setNavActive(navNewChat);
});
modePending.addEventListener('click', () => {
  setView('pending');
  modePending.classList.add('active');
  modeChat.classList.remove('active');
  setNavActive(null);
  loadPendingDocs();
});

// ---- View switcher ----------------------------------------------
function setView(view) {
  state.view = view;
  heroView.style.display    = (view === 'chat' && !state.sent) ? 'flex' : 'none';
  splitView.style.display   = (view === 'chat' && state.sent)  ? 'flex' : 'none';
  pendingView.style.display = (view === 'pending') ? 'flex' : 'none';
  galleryView.style.display = (view === 'gallery') ? 'block' : 'none';
  if (view === 'chat' && !state.sent) {
    heroView.style.flexDirection = 'column';
    heroView.style.alignItems = 'center';
    heroView.style.justifyContent = 'center';
  }
}

// ---- Connect Repository -----------------------------------------
connectBtn.addEventListener('click', connectRepository);
repoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') connectRepository(); });

async function connectRepository() {
  const value = repoInput.value.trim();
  if (!value) return;
  if (state.connected.some(r => r.url === value)) { repoInput.value = ''; return; }
  connectBtn.textContent = 'Connecting...';
  connectBtn.disabled = true;
  try {
    const url = value.startsWith('http') ? value : 'https://github.com/' + value;
    const res = await fetch('/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    const id = (data.repository && data.repository.id) || data.repositoryId || null;
    const repoName = (data.repository && data.repository.name) || url.replace('https://github.com/', '');
    const userRole = (data.repository && data.repository.userRole) || 'unknown';

    state.connected.push({ url, id, name: repoName, userRole: userRole, status: 'indexing', progress: 0 });
    state.activeRepoId = id;
    localStorage.setItem('tracie_active_repo', id);
    renderConnected();
    // Start polling for indexing progress immediately after connect
    startIndexingPoller(id);
    repoInput.value = '';

    // Check if role confirmation dialog is needed
    if (data.needsRolePrompt && id) {
      openRoleModal(id, repoName);
    } else if (data.permissions && data.permissions.canDetermine) {
      showPendingNotification('GitHub access verified: ' + data.permissions.userRole + ' permissions detected.', 'success');
    }
  } catch (err) {
    console.error('Connect error:', err);
  } finally {
    connectBtn.textContent = 'Connect Codebase';
    connectBtn.disabled = false;
  }
}

// ---- Role & Automation Modal Controls ---------------------------
let currentRoleModalRepoId = null;
const roleModalOverlay     = document.getElementById('roleModalOverlay');
const roleModalRepoName    = document.getElementById('roleModalRepoName');
const closeRoleModal       = document.getElementById('closeRoleModal');
const cancelRoleModal      = document.getElementById('cancelRoleModal');
const saveRoleModal        = document.getElementById('saveRoleModal');
const roleAutoCommitToggle = document.getElementById('roleAutoCommitToggle');
const roleCommitModeSelect = document.getElementById('roleCommitModeSelect');

function openRoleModal(repoId, repoName) {
  currentRoleModalRepoId = repoId;
  if (roleModalRepoName) roleModalRepoName.textContent = repoName || 'Repository Access';
  if (roleModalOverlay) roleModalOverlay.style.display = 'flex';
}

function closeRoleModalDialog() {
  if (roleModalOverlay) roleModalOverlay.style.display = 'none';
  currentRoleModalRepoId = null;
}

if (closeRoleModal) closeRoleModal.addEventListener('click', closeRoleModalDialog);
if (cancelRoleModal) cancelRoleModal.addEventListener('click', closeRoleModalDialog);

if (saveRoleModal) {
  saveRoleModal.addEventListener('click', async function() {
    if (!currentRoleModalRepoId) return closeRoleModalDialog();
    const selectedRadio = document.querySelector('input[name="userRepoRole"]:checked');
    const userRole = selectedRadio ? selectedRadio.value : 'contributor';
    const autoCommit = roleAutoCommitToggle ? roleAutoCommitToggle.checked : false;
    const commitMode = roleCommitModeSelect ? roleCommitModeSelect.value : 'pr';

    try {
      await fetch('/api/repos/' + currentRoleModalRepoId + '/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userRole, autoCommit, commitMode })
      });
      // Update local state
      const target = state.connected.find(r => r.id === currentRoleModalRepoId);
      if (target) target.userRole = userRole;
      renderConnected();
      if (state.view === 'pending') loadPendingDocs();
      showPendingNotification('Repository access configured as ' + userRole + ' (' + commitMode.toUpperCase() + ' mode).', 'success');
    } catch (e) {
      console.warn('Failed to update repo settings:', e);
    } finally {
      closeRoleModalDialog();
    }
  });
}

// ---- Indexing status poller -------------------------------------
const _indexingPollers = {}; // repoId -> intervalId

function startIndexingPoller(repoId) {
  if (_indexingPollers[repoId]) return; // already polling
  _indexingPollers[repoId] = setInterval(async function() {
    try {
      const r = await fetch('/api/repos/' + repoId + '/status');
      if (!r.ok) return;
      const d = await r.json();
      const status = d.indexStatus;
      const progress = typeof d.progress === 'number' ? d.progress : 0;
      const stage = d.stage || '';

      // Update in-memory state
      const repo = state.connected.find(function(x) { return x.id === repoId; });
      if (repo) {
        repo.status = status;
        repo.progress = progress;
        repo.stage = stage;
      }

      // Update the DOM card directly (avoid full re-render flicker)
      const wrap = document.getElementById('repo-wrap-' + repoId);
      if (wrap) {
        const badge = wrap.querySelector('.repo-status-badge');
        const bar   = wrap.querySelector('.repo-progress-bar');
        const card  = wrap.querySelector('.connected-repo');
        if (badge) { badge.className = 'repo-status-badge ' + status; badge.textContent = statusLabel(status, stage); }
        if (bar)   bar.style.width = Math.round(progress * 100) + '%';
        wrap.classList.toggle('is-indexing', status === 'indexing' || status === 'pending');
      }

      if (status === 'ready' || status === 'failed') {
        clearInterval(_indexingPollers[repoId]);
        delete _indexingPollers[repoId];
        // Final re-render to clean up progress bar
        renderConnected();
        if (status === 'ready') {
          console.log('[TRACiE] Indexing complete for ' + (repo ? repo.name : repoId) + '. Ready for queries.');
        } else {
          console.warn('[TRACiE] Indexing failed for ' + (repo ? repo.name : repoId) + '.');
        }
      }
    } catch (e) { /* swallow */ }
  }, 2000);
}

function statusLabel(status, stage) {
  if (status === 'indexing') return stage ? stage : 'Indexing';
  if (status === 'pending')  return 'Queued';
  if (status === 'failed')   return 'Failed';
  return '';
}

function renderConnected() {
  connectedList.innerHTML = '';
  if (state.connected.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'no-repos-msg';
    msg.id = 'noReposMsg';
    msg.textContent = 'No repositories connected.';
    connectedList.appendChild(msg);
    return;
  }
  state.connected.forEach(function(item) {
    const url = item.url;
    const id = item.id;
    const label = item.name || url.replace('https://github.com/', '');
    const isSelected = (state.activeRepoId === id) || (state.connected.length === 1 && !state.activeRepoId);
    if (isSelected && !state.activeRepoId) state.activeRepoId = id;

    const repoStatus = item.status || 'ready';
    const isActive = repoStatus === 'indexing' || repoStatus === 'pending';
    const progressPct = Math.round((item.progress || 0) * 100);
    const stageTxt = statusLabel(repoStatus, item.stage || '');

    // Wrapper (card + progress bar together)
    const wrap = document.createElement('div');
    wrap.className = 'repo-card-wrap' + (isActive ? ' is-indexing' : '');
    wrap.id = 'repo-wrap-' + id;

    const div = document.createElement('div');
    div.className = 'connected-repo' + (isSelected ? ' selected active' : '');
    div.title = 'Active repository for developer queries (click to switch)';
    div.innerHTML =
      '<span class="repo-name" title="' + url + '">' + escapeHtml(label) + '</span>' +
      (stageTxt ? '<span class="repo-status-badge ' + repoStatus + '">' + escapeHtml(stageTxt) + '</span>' : '') +
      '<button class="repo-reindex-btn" aria-label="Re-index ' + escapeHtml(label) + '" title="Re-index repository" data-id="' + id + '">&#x21BB;</button>' +
      '<button aria-label="Disconnect ' + escapeHtml(label) + '" data-url="' + url + '">&#x2715;</button>';

    // Progress bar
    const progressWrap = document.createElement('div');
    progressWrap.className = 'repo-progress-wrap';
    const progressBar = document.createElement('div');
    progressBar.className = 'repo-progress-bar';
    progressBar.style.width = (isActive ? Math.max(progressPct, 6) : 0) + '%';
    progressWrap.appendChild(progressBar);

    div.addEventListener('click', function(e) {
      if (e.target.tagName && e.target.tagName.toLowerCase() === 'button') return;
      state.activeRepoId = id;
      localStorage.setItem('tracie_active_repo', id);
      renderConnected();
    });

    div.querySelector('.repo-reindex-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      var btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = '...';
      // full:true forces every file to be re-chunked and re-embedded. Without it, an incremental
      // reindex compares git blob SHAs and no-ops when nothing changed on GitHub — which made this
      // button look broken (e.g. after switching embedding providers, when the repo itself hasn't changed).
      fetch('/api/repos/' + id + '/reindex', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full: true }) })
        .then(function(r) {
          if (!r.ok) return r.json().then(function(e) { throw new Error(e.error || 'Reindex failed (' + r.status + ')'); });
          return r.json();
        })
        .then(function() {
          btn.innerHTML = '&#x21BB;';
          btn.disabled = false;
          // Update status and start polling
          const repo = state.connected.find(function(x) { return x.id === id; });
          if (repo) { repo.status = 'indexing'; repo.progress = 0; }
          renderConnected();
          startIndexingPoller(id);
        })
        .catch(function(err) {
          btn.innerHTML = '&#x21BB;';
          btn.disabled = false;
          alert('Reindex failed to start: ' + (err.message || 'unknown error'));
        });
    });

    div.querySelector('button[data-url]').addEventListener('click', function(e) {
      e.stopPropagation();
      state.connected = state.connected.filter(function(r) { return r.id !== id && r.url !== url; });
      if (state.activeRepoId === id) {
        state.activeRepoId = state.connected.length > 0 ? state.connected[0].id : null;
        if (state.activeRepoId) localStorage.setItem('tracie_active_repo', state.activeRepoId);
        else localStorage.removeItem('tracie_active_repo');
      }
      // Stop polling if disconnecting
      if (_indexingPollers[id]) { clearInterval(_indexingPollers[id]); delete _indexingPollers[id]; }
      renderConnected();
    });

    wrap.appendChild(div);
    wrap.appendChild(progressWrap);
    connectedList.appendChild(wrap);

    // Auto-start poller for repos still indexing
    if (isActive) startIndexingPoller(id);
  });
}

async function fetchConnectedRepos() {
  try {
    const res = await fetch('/api/repos');
    const data = await res.json();
    const repos = data.repositories || (Array.isArray(data) ? data : []);
    if (Array.isArray(repos) && repos.length > 0) {
      state.connected = repos.map(function(r) {
        return {
          id: r.id,
          url: r.url,
          name: r.name || r.url.replace('https://github.com/', ''),
          status: r.indexStatus || 'ready',
          progress: (r.latestJob && r.latestJob.chunksTotal > 0)
            ? Math.min(1, (r.latestJob.chunksDone || 0) / r.latestJob.chunksTotal)
            : 0,
          stage: (r.latestJob && r.latestJob.stage) || ''
        };
      });
      const saved = localStorage.getItem('tracie_active_repo');
      if (saved && state.connected.some(r => r.id === saved)) {
        state.activeRepoId = saved;
      } else if (!state.activeRepoId && state.connected.length > 0) {
        state.activeRepoId = state.connected[0].id;
        localStorage.setItem('tracie_active_repo', state.activeRepoId);
      }
      renderConnected();
    }
  } catch (err) {
    console.warn('Failed to load connected repositories:', err);
  }
}
fetchConnectedRepos();

// ---- Suggestion cards ------------------------------------------
document.getElementById('suggSchema').addEventListener('click', () => runSuggestion('schema'));
document.getElementById('suggSummary').addEventListener('click', () => runSuggestion('summary'));

function runSuggestion(type) {
  const text = type === 'schema'
    ? 'Get me a database schema of the project'
    : 'Draft a project summary of the project';
  sendMessage(text, type);
}

// ---- Practice tools --------------------------------------------
addBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  state.practiceOpen = !state.practiceOpen;
  practicePopover.style.display = state.practiceOpen ? 'flex' : 'none';
});
document.addEventListener('click', () => {
  if (state.practiceOpen) {
    state.practiceOpen = false;
    practicePopover.style.display = 'none';
  }
});
practicePopover.querySelectorAll('button[data-tool]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.practiceTag = btn.dataset.tool;
    updatePracticeTag();
    state.practiceOpen = false;
    practicePopover.style.display = 'none';
    queryInput.focus();
  });
});
removePracticeTag.addEventListener('click', () => { state.practiceTag = ''; updatePracticeTag(); });

function updatePracticeTag() {
  if (state.practiceTag) {
    if (practiceTagEl) practiceTagEl.style.display = 'inline-flex';
    if (practiceTagLabel) practiceTagLabel.textContent = state.practiceTag;
    const slug = state.practiceTag === 'Flashcards'
      ? 'flashcard'
      : state.practiceTag.toLowerCase().replace(/\s+/g, '-');
    if (practiceTypeInput) practiceTypeInput.value = slug;
  } else {
    if (practiceTagEl) practiceTagEl.style.display = 'none';
    if (practiceTypeInput) practiceTypeInput.value = '';
  }
}

// ---- Send message -----------------------------------------------
sendBtn.addEventListener('click', () => sendMessage());
queryInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) sendMessage();
});

async function sendMessage(text, canvasType) {
  text = text !== undefined ? text : queryInput.value.trim();
  canvasType = canvasType !== undefined ? canvasType : state.canvasType;
  if (!text || state.isQuerying) return;

  const trimmed = text.trim();

  // 1. Direct JSON Widget Parsing (e.g. if user pastes a flowchart/diagram JSON object)
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      let parsedWidget = null;
      if (parsed.diagramtype || parsed.diagram_type || parsed.mermaidcode || parsed.mermaid_code ||
          parsed.diagram_source || parsed.diagram || parsed.dsl ||
          parsed.type === 'flowchart' || parsed.type === 'architecture_diagram' || parsed.type === 'diagram') {
        parsedWidget = {
          type: 'architecture_diagram',
          title: parsed.title || 'System Flowchart',
          diagram_source: parsed.diagram_source || parsed.mermaidcode || parsed.mermaidCode || parsed.mermaid_code || parsed.diagram || parsed.dsl || parsed.code || '',
          caption: parsed.caption || parsed.description || 'Interactive System Flowchart'
        };
      } else if (parsed.type) {
        parsedWidget = parsed;
      }
      if (parsedWidget) {
        const turnId = state.turns.length;
        const turn = {
          id: turnId,
          prompt: parsed.title || 'Interactive Flowchart',
          widget: parsedWidget,
          widgets: [parsedWidget],
          title: parsedWidget.title || 'Flowchart',
          type: parsedWidget.type || 'architecture_diagram',
          answer: 'Rendered interactive diagram in developer canvas.'
        };
        state.turns.push(turn);
        state.activeTurnIndex = turnId;

        state.sent = true;
        state.canvasType = canvasType;
        state.messages.push({ role: 'user', text: turn.prompt, turnId: turnId });
        state.messages.push({ role: 'assistant', text: turn.answer, widget: parsedWidget, turnId: turnId });
        state.apiWidgets = [parsedWidget];
        queryInput.value = '';
        setNavActive(navNewChat);
        setView('chat');
        renderMessages();
        renderCanvasPromptNav();
        renderWidgetIntoCanvas(parsedWidget);
        loadSidebarHistory();
        return;
      }
    } catch (_) {}
  } else if (/^(flowchart|graph|sequenceDiagram|classDiagram|erDiagram)\b/i.test(trimmed)) {
    // 2. Direct Mermaid DSL Code
    const directWidget = {
      type: 'architecture_diagram',
      title: 'Interactive Diagram',
      diagram_source: trimmed,
      caption: 'Direct Mermaid Flowchart Preview'
    };
    const turnId = state.turns.length;
    const turn = {
      id: turnId,
      prompt: 'Render Mermaid Flowchart',
      widget: directWidget,
      widgets: [directWidget],
      title: directWidget.title,
      type: directWidget.type,
      answer: 'Rendered interactive diagram in developer canvas.'
    };
    state.turns.push(turn);
    state.activeTurnIndex = turnId;

    state.sent = true;
    state.canvasType = canvasType;
    state.messages.push({ role: 'user', text: turn.prompt, turnId: turnId });
    state.messages.push({ role: 'assistant', text: turn.answer, widget: directWidget, turnId: turnId });
    state.apiWidgets = [directWidget];
    queryInput.value = '';
    setNavActive(navNewChat);
    setView('chat');
    renderMessages();
    renderCanvasPromptNav();
    renderWidgetIntoCanvas(directWidget);
    loadSidebarHistory();
    return;
  }

  const currentTurnId = state.turns.length;
  state.sent = true;
  state.isQuerying = true;
  state.canvasType = canvasType;
  state.messages.push({ role: 'user', text: text, turnId: currentTurnId });
  state.apiError = '';
  queryInput.value = '';
  sendBtn.textContent = '...';
  sendBtn.disabled = true;
  setNavActive(navNewChat);
  setView('chat');
  renderMessages();
  showCanvasLoading(canvasType);

  if (!state.connected.length) {
    try { await fetchConnectedRepos(); } catch(_) {}
  }
  const repoId = state.activeRepoId
    || (state.connected.length > 0 ? (state.connected[0].id || state.connected[0].url) : null);
  const activeRepoObj = state.connected.find(r => r.id === repoId);
  const repoName = activeRepoObj ? activeRepoObj.name : '';
  const sessionId = await ensureSessionId();

  const requestedWidget = state.practiceTag
    ? state.practiceTag.toLowerCase()
    : (canvasType === 'schema' ? 'architecture_diagram' : (canvasType === 'summary' ? 'overview' : null));

  try {
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: text,
        repoId: repoId,
        repoName: repoName,
        sessionId: sessionId,
        requestedWidget: requestedWidget
      }),
    });
    if (!res.ok) {
      let detail = 'Query failed (' + res.status + ')';
      try {
        const errorJson = await res.json();
        if (errorJson && errorJson.message) detail = errorJson.message;
      } catch (_) {}
      throw new Error(detail);
    }
    const payload = await res.json();
    const widgets = payload.widgets || (payload.widget ? [payload.widget] : (payload.type ? [payload] : []));
    state.apiWidgets = widgets;
    var w0 = widgets && widgets.length > 0 ? widgets[0] : (payload.type ? payload : null);
    let answer = payload.content || payload.answer || payload.message;

    // --- Widget-type-aware chat answer synthesizer ---
    // Produces a meaningful, specific chat summary for every widget type
    // so the chat panel is informative rather than always redirecting to the canvas.
    if (!answer && w0) {
      const wt = w0.type || '';
      const title = w0.title || '';

      if (wt === 'audio_player') {
        const aDesc = w0.description || w0.subtitle || 'Audio walkthrough ready in canvas.';
        const aScript = w0.transcript ? ('\n\n' + w0.transcript) : '';
        answer = '**' + (title || 'Audio Briefing') + '**\n\n' + aDesc + aScript;

      } else if (wt === 'architecture_diagram' || wt === 'flowchart' || wt === 'diagram') {
        const caption = w0.caption || '';
        const hasSrc = (w0.diagram_source || '').trim().length > 0;
        answer = '**' + (title || 'Architecture Diagram') + '**\n\n' +
          (caption ? caption + '\n\n' : '') +
          (hasSrc
            ? 'I\'ve rendered an interactive Mermaid diagram in the canvas — use the toolbar to zoom, copy the DSL, or maximize it. '
            : 'I wasn\'t able to generate a full diagram this time. ') +
          (w0.caption && !caption ? w0.caption : '');

      } else if (wt === 'quiz') {
        const qs = Array.isArray(w0.questions) && w0.questions.length ? w0.questions : (w0.question ? [w0] : []);
        const first = qs[0] || {};
        answer = '**' + (title || 'Codebase Quiz') + '**\n\n' +
          (qs.length > 0
            ? `I\'ve prepared a ${qs.length}-question quiz. Here\'s the first one:\n\n**Q1: ${first.question || first.prompt || ''}**\n\n` +
              (Array.isArray(first.options) ? first.options.map((o, i) => `${String.fromCharCode(65+i)}. ${typeof o === 'string' ? o : (o.text || o.label || o)}`).join('\n') : '') +
              '\n\nOpen the canvas to answer all questions and see your score.'
            : 'I prepared a quiz based on this codebase — open the canvas to get started.');

      } else if (wt === 'flashcard_deck' || wt === 'flashcards') {
        const cards = w0.cards || [];
        const preview = cards.slice(0, 3).map((c, i) => `${i+1}. **${c.front || c.term || c.question || ''}**`).join('\n');
        answer = '**' + (title || 'Flashcard Deck') + '**\n\n' +
          (cards.length > 0
            ? `Here are ${cards.length} flashcards to study. First few concepts:\n\n${preview}\n\nFlip each card in the canvas to reveal the answer.`
            : 'Flashcards are ready in the canvas.');

      } else if (wt === 'tutorial_steps' || wt === 'tutorial') {
        const steps = w0.steps || [];
        const stepList = steps.slice(0, 4).map((s, i) => `${i+1}. ${s.title || s.step || s.heading || s.description || ''}`).join('\n');
        answer = '**' + (title || 'Developer Tutorial') + '**\n\n' +
          (w0.description || w0.overview || '') +
          (steps.length > 0 ? '\n\n**Steps overview:**\n' + stepList + (steps.length > 4 ? `\n…and ${steps.length - 4} more steps in the canvas.` : '') : '');

      } else if (wt === 'learning_path' || wt === 'curriculum') {
        const modules = w0.modules || w0.milestones || w0.phases || [];
        const modList = modules.slice(0, 3).map((m, i) => `${i+1}. **${m.title || m.name || m.module || ''}**`).join('\n');
        answer = '**' + (title || 'Learning Path') + '**\n\n' +
          (w0.description || w0.overview || 'Structured learning curriculum ready in the canvas.') +
          (modules.length > 0 ? '\n\n**Curriculum outline:**\n' + modList + (modules.length > 3 ? `\n…and ${modules.length - 3} more modules.` : '') : '');

      } else if (wt === 'code_snippet' || wt === 'code') {
        const filePath = w0.file_path || w0.filePath || w0.file || '';
        const lang = w0.language || '';
        const explanation = w0.explanation || w0.description || '';
        const lines = w0.start_line && w0.end_line ? ` (lines ${w0.start_line}–${w0.end_line})` : '';
        answer = (filePath ? `**[\`${filePath}${lines}\`]** ${lang ? `· ${lang}` : ''}\n\n` : '') +
          (explanation || 'Code snippet loaded in the canvas.');

      } else if (wt === 'file_tree') {
        const root = w0.root || {};
        const topDirs = (root.children || []).filter(c => c.type === 'directory').slice(0, 6).map(c => `📁 ${c.name}`);
        const topFiles = (root.children || []).filter(c => c.type === 'file').slice(0, 4).map(c => `📄 ${c.name}`);
        const preview = [...topDirs, ...topFiles].join('  ·  ');
        answer = '**' + (title || 'Repository File Tree') + '**\n\n' +
          (w0.summary || '') +
          (preview ? '\n\n' + preview : '') +
          '\n\nNavigate the full tree in the canvas.';

      } else if (wt === 'doc_proposal' || wt === 'documentation') {
        answer = '**' + (title || 'Documentation Proposal') + '**\n\n' +
          (w0.summary || w0.description || w0.rationale || 'Documentation proposal ready in the canvas. Review the proposed diff and PR description.');

      } else if (wt === 'overview' || wt === 'summary') {
        answer = w0.content || w0.summary || w0.description || w0.body ||
          ('**' + (title || 'Summary') + '**\n\nSummary loaded in the canvas.');

      } else if (wt === 'chat_response') {
        answer = w0.content || w0.answer || w0.message || w0.body || w0.explanation || '';

      } else {
        // Generic fallback still pulls the richest field available
        answer = w0.content || w0.answer || w0.message ||
          (w0.question ? (w0.question + (w0.explanation ? ('\n\n' + w0.explanation) : '')) : null) ||
          w0.explanation || w0.rationale || w0.description || w0.summary ||
          (payload.root ? ('Repository structure for ' + (payload.root.name || 'project') + ' loaded in canvas.') : null) ||
          '**' + (title || 'Result') + '**\n\nOpened in the canvas.';
      }
    }

    if (!answer) {
      answer = payload.explanation || payload.rationale || payload.description || payload.summary ||
        (payload.root ? ('Repository structure for ' + (payload.root.name || 'project') + ' loaded in canvas.') : null) ||
        'Response ready in the canvas.';
    }

    const turn = {
      id: currentTurnId,
      prompt: text,
      widget: w0,
      widgets: widgets,
      title: w0 ? (w0.title || w0.label || (w0.type ? w0.type.replace(/_/g, ' ') : 'Referenced output')) : (canvasType || 'Response'),
      type: w0 ? w0.type : (canvasType || 'response'),
      answer: answer
    };
    state.turns.push(turn);
    state.activeTurnIndex = currentTurnId;

    state.messages.push({
      role: 'assistant',
      text: answer,
      widget: w0,
      widgets: widgets,
      turnId: currentTurnId,
      cached: Boolean(payload._cached),
      cacheTier: payload._cacheTier || null,
      elapsedMs: payload._cached ? (payload._cacheAgeMs || 8) : (payload._meta?.executionTimeMs || null)
    });

    renderMessages();
    renderCanvasPromptNav();

    if (w0) {
      if (canvasTitle) {
        canvasTitle.textContent = w0.title || w0.label || (w0.type ? w0.type.replace(/_/g, ' ') : 'Referenced output');
      }
      renderWidgetIntoCanvas(w0);
    } else {
      renderCanvas(canvasType, widgets);
    }
    // Refresh sidebar history to include this query
    loadSidebarHistory();
    // Reset selected tag after turn unless user sets another
    state.practiceTag = '';
    updatePracticeTag();
  } catch (err) {
    const errMsg = err.message || 'Unable to reach the TRACiE API.';
    state.apiError = errMsg;
    const isNetwork = errMsg.toLowerCase().includes('failed to fetch') || errMsg.toLowerCase().includes('network');
    state.messages.push({
      role: 'assistant',
      text: isNetwork
        ? 'The request is ready, but the TRACiE API could not be reached. Check that the API server is running and try again.'
        : `Request could not be completed: ${errMsg}`
    });
    renderMessages();
    renderCanvasError(errMsg);
  } finally {
    state.isQuerying = false;
    sendBtn.innerHTML = '&#x2191;';
    sendBtn.disabled = false;
  }
}

function switchToTurn(turnId) {
  if (typeof turnId !== 'number' || turnId < 0 || turnId >= state.turns.length) return;
  state.activeTurnIndex = turnId;
  const turn = state.turns[turnId];
  if (!turn) return;

  toggleCanvas(true);

  if (canvasTitle) {
    canvasTitle.textContent = turn.title || (turn.widget && turn.widget.title) || 'Referenced output';
  }

  if (turn.widget) {
    renderWidgetIntoCanvas(turn.widget);
  } else if (turn.widgets && turn.widgets.length > 0) {
    renderCanvas(turn.type, turn.widgets);
  } else {
    canvasPreview.innerHTML =
      '<div class="w-card" style="padding:24px;text-align:left;">' +
        '<div class="w-eyebrow">CHAT RESPONSE</div>' +
        '<div class="w-title">' + escapeHtml(turn.title || 'Response') + '</div>' +
        '<p class="w-body" style="white-space:pre-wrap;">' + escapeHtml(turn.answer || 'Response recorded.') + '</p>' +
      '</div>';
  }

  renderMessages();
  renderCanvasPromptNav();

  if (canvasPreview) {
    canvasPreview.scrollTop = 0;
  }
}

function renderCanvasPromptNav() {
  if (!canvasPromptNav) return;

  if (!state.turns || state.turns.length <= 1) {
    canvasPromptNav.style.display = 'none';
    canvasPromptNav.innerHTML = '';
    return;
  }

  canvasPromptNav.style.display = 'flex';
  let html = '<div class="canvas-prompt-pills">';
  state.turns.forEach((turn, idx) => {
    const isActive = turn.id === state.activeTurnIndex;
    const cleanPrompt = (turn.prompt || '').trim();
    const typeLabel = turn.title || (turn.widget && turn.widget.title) || (turn.type ? turn.type.replace(/_/g, ' ') : 'Output');
    const tooltip = 'Prompt #' + (idx + 1) + ': "' + escapeHtml(cleanPrompt) + '"';

    html +=
      '<button class="canvas-turn-pill ' + (isActive ? 'active' : '') + '" data-turn-id="' + turn.id + '" title="' + tooltip + '">' +
        '<span class="turn-num">#' + (idx + 1) + '</span>' +
        '<span class="turn-label">' + escapeHtml(typeLabel) + '</span>' +
        (isActive ? '<span class="turn-dot">&#x25CF;</span>' : '') +
      '</button>';
  });
  html += '</div>';

  canvasPromptNav.innerHTML = html;

  canvasPromptNav.querySelectorAll('.canvas-turn-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const tid = parseInt(btn.getAttribute('data-turn-id'), 10);
      if (!isNaN(tid)) switchToTurn(tid);
    });
  });
}

function renderMessages() {
  messageList.innerHTML = '';
  state.messages.forEach(function(msg) {
    const div = document.createElement('div');
    const turnId = msg.turnId;
    const isActive = typeof turnId === 'number' && turnId === state.activeTurnIndex;
    div.className = 'chat-message ' + msg.role + (isActive ? ' is-active-turn' : '');

    if (msg.role === 'assistant') {
      let badgeHtml = '';
      if (msg.cached) {
        badgeHtml = '<span class="cache-badge cached">&#x26A1; Instant Cache (' + (msg.elapsedMs || 6) + 'ms)</span>';
      } else if (msg.cacheTier === 'session_warm_context') {
        badgeHtml = '<span class="cache-badge warm">&#x26A1; Warm Follow-up Context</span>';
      }

      const widget = msg.widget;
      let widgetLabel = 'output';
      if (widget) {
        widgetLabel = widget.title || (widget.type ? widget.type.replace(/_/g, ' ') : 'output');
      } else if (typeof turnId === 'number' && state.turns[turnId]) {
        widgetLabel = state.turns[turnId].title || 'output';
      }

      div.innerHTML =
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">' +
          '<span class="message-mark">&#x2723;</span>' +
          badgeHtml +
          (isActive ? '<span class="active-turn-pill">&#x25CF; Active in Canvas</span>' : '') +
        '</div>' +
        '<div class="chat-bubble assistant-bubble">' + renderMarkdown(msg.text) + '</div>' +
        (typeof turnId === 'number'
          ? '<button class="reference-button ' + (isActive ? 'active-reference' : '') + '" data-turn-id="' + turnId + '" title="View canvas output for this prompt">' +
              '&#x2197;&nbsp;' + (isActive ? 'Viewing in Canvas: ' : 'Open in Canvas: ') + '<strong>' + escapeHtml(widgetLabel) + '</strong>' +
            '</button>'
          : '');
    } else {
      div.innerHTML =
        '<div class="chat-bubble user-bubble">' + renderMarkdown(msg.text) + '</div>' +
        '<div class="user-meta-row" style="display:flex;align-items:center;gap:8px;margin-top:4px;">' +
          '<small>' + (typeof turnId === 'number' ? ('Prompt #' + (turnId + 1)) : 'Just now') + '</small>' +
          (typeof turnId === 'number' && state.turns && state.turns[turnId]
            ? '<button class="user-view-canvas-btn ' + (isActive ? 'active' : '') + '" data-turn-id="' + turnId + '" title="Switch canvas to this prompt">' +
                (isActive ? '&#x25CF; In Canvas' : '&#x2197; View Output') +
              '</button>'
            : '') +
        '</div>';
    }
    messageList.appendChild(div);
  });

  // Attach click listener to all buttons referencing a turn
  messageList.querySelectorAll('[data-turn-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tid = parseInt(btn.getAttribute('data-turn-id'), 10);
      if (!isNaN(tid)) switchToTurn(tid);
    });
  });

  messageList.scrollTop = messageList.scrollHeight;
}

function showCanvasLoading(type) {
  toggleCanvas(true);
  if (canvasTitle) {
    canvasTitle.textContent = type === 'summary' ? 'Project summary preview' : 'Database schema preview';
  }
  canvasPreview.innerHTML =
    '<div class="canvas-loader-wrap" aria-hidden="true">&#x25A3;</div>' +
    '<strong style="font-size:15px;color:var(--ink);">Loading image preview</strong>' +
    '<span style="font-size:13px;color:var(--muted);">The referenced output is opening in the canvas</span>' +
    '<div class="canvas-progress"><div class="canvas-progress-fill"></div></div>' +
    '<small style="font-size:12px;color:var(--muted);">Fetching referenced output</small>';
  canvasError.style.display = 'none';
}

function renderCanvas(type, widgets) {
  if (widgets && widgets.length > 0) {
    canvasPreview.innerHTML = '';
    if (widgets.length === 1) {
      renderWidgetIntoCanvas(widgets[0]);
    } else {
      // Composite: wrap all widgets
      const composite = { type: 'composite', components: widgets };
      const doComposite = function() {
        if (window.UIRenderer) {
          window.UIRenderer.setCanvas(canvasPreview).render(composite);
        } else {
          widgets.forEach(function(w) { renderWidgetIntoCanvas(w); });
        }
      };
      if (window.UIRendererReady) window.UIRendererReady.then(doComposite);
      else doComposite();
    }
  } else {
    canvasPreview.innerHTML =
      '<div class="schema-card">' +
      '<strong>' + (type === 'summary' ? 'Project summary' : 'Database schema') + '</strong>' +
      '<span>Result ready in canvas</span>' +
      '</div>';
  }
}

function renderCanvasError(msg) {
  canvasError.textContent = msg;
  canvasError.style.display = 'block';
  canvasPreview.innerHTML = '';
}

function toggleCanvas(show) {
  const shouldShow = typeof show === 'boolean' ? show : !state.canvasOpen;
  state.canvasOpen = shouldShow;
  const cPanel = document.getElementById('canvasPanel');
  const oBtn = document.getElementById('openCanvasBtn');
  const sView = document.getElementById('splitView');

  if (shouldShow) {
    if (sView) sView.classList.remove('canvas-collapsed');
    if (cPanel) cPanel.style.display = 'flex';
    if (oBtn) oBtn.style.display = 'none';
  } else {
    if (sView) sView.classList.add('canvas-collapsed');
    if (cPanel) cPanel.style.display = 'none';
    if (oBtn) oBtn.style.display = 'inline-flex';
  }
}

closeCanvas.addEventListener('click', () => {
  toggleCanvas(false);
});

if (openCanvasBtn) {
  openCanvasBtn.addEventListener('click', () => {
    toggleCanvas(true);
  });
}

// ---- Sidebar Chat History (Functional Postgres Integration) ----
async function loadSidebarHistory() {
  const historyPanel = document.getElementById('historyPanel');
  if (!historyPanel) return;

  try {
    const res = await fetch('/api/sessions');
    if (!res.ok) return;
    const data = await res.json();
    const sessions = (data.sessions || []).filter(s => s && s.sessionId);

    if (sessions.length === 0) {
      historyPanel.innerHTML =
        '<div style="padding: 16px 18px; color: var(--muted); font-size: 12px; font-style: italic;">' +
        'No chat history yet.<br>Start a conversation above!' +
        '</div>';
      return;
    }

    const currentSessionId = sessionStorage.getItem('tracie_session');
    const now = Date.now();
    const today = [];
    const last7Days = [];
    const older = [];

    sessions.forEach(s => {
      const date = new Date(s.lastActive || s.startedAt || now).getTime();
      const diffDays = (now - date) / (1000 * 60 * 60 * 24);
      if (diffDays <= 1) {
        today.push(s);
      } else if (diffDays <= 7) {
        last7Days.push(s);
      } else {
        older.push(s);
      }
    });

    let html = '';

    function renderGroup(title, list) {
      if (!list || list.length === 0) return '';
      let groupHtml = '<section class="history-section">';
      groupHtml += '<div class="section-label">' + escapeHtml(title) + '</div>';
      list.forEach(s => {
        const isSelected = s.sessionId === currentSessionId;
        const displayTitle = s.title ? (s.title.length > 28 ? s.title.slice(0, 28) + '...' : s.title) : 'Chat Session';
        groupHtml +=
          '<div class="history-item-row" style="display:flex;align-items:center;position:relative;width:100%;">' +
          '  <button class="history-item ' + (isSelected ? 'selected' : '') + '" data-session-id="' + s.sessionId + '" title="' + escapeHtml(s.title || '') + '" style="padding-right:26px;">' +
          '    <span>' + escapeHtml(displayTitle) + '</span>' +
          '    <span class="more" style="font-size:10px;opacity:0.6;margin-right:8px;">' + (s.queryCount ? (s.queryCount + 'q') : '') + '</span>' +
          '  </button>' +
          '  <button class="history-del-btn" data-delete-id="' + s.sessionId + '" title="Delete chat" ' +
          '          style="position:absolute;right:8px;background:none;border:none;color:var(--muted);cursor:pointer;font-size:15px;line-height:1;padding:2px 4px;opacity:0;transition:opacity .15s;z-index:2;">&times;</button>' +
          '</div>';
      });
      groupHtml += '</section>';
      return groupHtml;
    }

    html += renderGroup('Today', today);
    html += renderGroup('Last 7 days', last7Days);
    html += renderGroup('Older', older);

    historyPanel.innerHTML = html;

    // Attach click events to load sessions
    historyPanel.querySelectorAll('.history-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.getAttribute('data-session-id');
        if (sid) loadSession(sid);
      });
    });

    // Attach delete handlers and hover effects
    historyPanel.querySelectorAll('.history-item-row').forEach(row => {
      const delBtn = row.querySelector('.history-del-btn');
      row.addEventListener('mouseenter', () => { if (delBtn) delBtn.style.opacity = '0.9'; });
      row.addEventListener('mouseleave', () => { if (delBtn) delBtn.style.opacity = '0'; });
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const sid = delBtn.getAttribute('data-delete-id');
          if (sid && confirm('Delete this conversation?')) {
            await deleteSession(sid);
          }
        });
      }
    });

  } catch (err) {
    console.warn('[sessions] Failed to load sidebar history:', err);
  }
}

async function loadSession(sessionId) {
  if (!sessionId) return;
  sessionStorage.setItem('tracie_session', sessionId);

  // Update selection visually
  document.querySelectorAll('.history-item').forEach(b => {
    if (b.getAttribute('data-session-id') === sessionId) {
      b.classList.add('selected');
    } else {
      b.classList.remove('selected');
    }
  });

  try {
    const res = await fetch('/api/sessions/' + sessionId);
    if (!res.ok) throw new Error('Session not found');
    const data = await res.json();
    const queries = data.queries || [];

    if (queries.length === 0) {
      newChat();
      return;
    }

    state.messages = [];
    state.apiWidgets = [];
    state.turns = [];
    state.sent = true;

    queries.forEach((q, idx) => {
      const widget = q.llmResponse;
      if (widget) {
        state.apiWidgets.push(widget);
      }
      let answer = widget?.content || widget?.answer || widget?.message || widget?.explanation || widget?.description || widget?.summary;
      if (!answer && widget && widget.type === 'audio_player') {
        answer = '**' + (widget.title || 'Audio Briefing') + '**\n\n' + (widget.transcript || 'Audio ready in canvas.');
      }
      if (!answer && widget) {
        answer = widget.title || 'Response ready in canvas.';
      }
      if (!answer) {
        answer = 'Response retrieved.';
      }

      const turn = {
        id: idx,
        prompt: q.rawText,
        widget: widget,
        widgets: widget ? [widget] : [],
        title: widget ? (widget.title || widget.label || (widget.type ? widget.type.replace(/_/g, ' ') : 'Output')) : 'Response',
        type: widget ? widget.type : 'response',
        answer: answer
      };
      state.turns.push(turn);

      // User query
      state.messages.push({
        role: 'user',
        text: q.rawText,
        turnId: idx
      });

      // Assistant response
      state.messages.push({
        role: 'assistant',
        text: answer,
        widget: widget,
        widgets: widget ? [widget] : [],
        turnId: idx,
        cached: false
      });
    });

    state.activeTurnIndex = state.turns.length > 0 ? (state.turns.length - 1) : null;
    setView('chat');
    renderMessages();
    renderCanvasPromptNav();

    if (state.activeTurnIndex !== null) {
      const activeTurn = state.turns[state.activeTurnIndex];
      if (activeTurn && activeTurn.widget) {
        if (canvasTitle) {
          canvasTitle.textContent = activeTurn.title || (activeTurn.widget.type ? activeTurn.widget.type.replace(/_/g, ' ') : 'Referenced output');
        }
        renderWidgetIntoCanvas(activeTurn.widget);
      }
    }

  } catch (err) {
    console.error('Failed to load session:', err);
  }
}

async function deleteSession(sessionId) {
  try {
    await fetch('/api/sessions/' + sessionId, { method: 'DELETE' });
    if (sessionStorage.getItem('tracie_session') === sessionId) {
      newChat();
    }
    await loadSidebarHistory();
  } catch (err) {
    console.error('Failed to delete session:', err);
  }
}

// ---- Pending Docs Notification ----------------------------------
function showPendingNotification(message, type = 'info') {
  const notif = document.getElementById('pendingNotification');
  if (!notif) return;
  notif.className = 'pending-notification ' + type;
  notif.innerHTML = '<span>' + escapeHtml(message) + '</span><button style="background:none;border:none;cursor:pointer;font-size:14px;" onclick="this.parentElement.style.display=\'none\'">&#x2715;</button>';
  notif.style.display = 'flex';
  setTimeout(() => { if (notif) notif.style.display = 'none'; }, 8000);
}

// ---- Pending Docs -----------------------------------------------
let pendingToolbarWired = false;

async function loadPendingDocs() {
  if (!pendingList) return;
  pendingList.innerHTML = '<p class="pending-empty">Loading documentation proposals...</p>';

  const repoId = state.activeRepoId || (state.connected.length > 0 ? state.connected[0].id : null);
  const activeRepo = state.connected.find(r => r.id === repoId);

  // Sync toolbar controls
  const repoLabelEl = document.getElementById('pendingRepoLabel');
  const rolePillEl = document.getElementById('pendingRolePill');
  const autoCommitToggle = document.getElementById('pendingAutoCommitToggle');
  const commitModeSelect = document.getElementById('pendingCommitModeSelect');
  const scanBtn = document.getElementById('scanInconsistenciesBtn');

  if (activeRepo && repoLabelEl) {
    repoLabelEl.textContent = 'Active Repo: ' + (activeRepo.name || activeRepo.url);
  } else if (repoLabelEl) {
    repoLabelEl.textContent = 'Active Repo: None (Connect Codebase)';
  }

  // Fetch active repo metadata if available
  if (repoId && UUID_RE.test(repoId)) {
    try {
      const repoRes = await fetch('/api/repos/' + repoId);
      if (repoRes.ok) {
        const repoData = await repoRes.json();
        if (rolePillEl) {
          rolePillEl.textContent = 'Role: ' + (repoData.userRole ? repoData.userRole.toUpperCase() : 'UNKNOWN');
          rolePillEl.style.background = repoData.userRole === 'owner' || repoData.userRole === 'contributor' ? '#047857' : '#475569';
        }
        if (autoCommitToggle) autoCommitToggle.checked = Boolean(repoData.autoCommit);
        if (commitModeSelect) commitModeSelect.value = repoData.commitMode || 'pr';
      }
    } catch (_) {}
  }

  // Wire toolbar events once
  if (!pendingToolbarWired) {
    pendingToolbarWired = true;

    if (scanBtn) {
      scanBtn.addEventListener('click', async function() {
        const currentRepoId = state.activeRepoId || (state.connected.length > 0 ? state.connected[0].id : null);
        if (!currentRepoId || !UUID_RE.test(currentRepoId)) {
          showPendingNotification('Please select or connect an indexed repository first.', 'error');
          return;
        }

        const origText = scanBtn.innerHTML;
        scanBtn.innerHTML = '<span class="btn-icon">&#x21BB;</span> Analyzing Code Chunks...';
        scanBtn.disabled = true;

        try {
          const res = await fetch('/api/repos/' + currentRepoId + '/scan-docs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          const data = await res.json();
          if (res.ok) {
            showPendingNotification(`Inconsistency scan complete! Analyzed ${data.scannedFiles} files, generated ${data.inconsistenciesFound} proposal.`, 'success');
            await loadPendingDocs();
          } else {
            showPendingNotification(data.error || 'Inconsistency scan failed.', 'error');
          }
        } catch (scanErr) {
          showPendingNotification('Scan error: ' + scanErr.message, 'error');
        } finally {
          scanBtn.innerHTML = origText;
          scanBtn.disabled = false;
        }
      });
    }

    if (autoCommitToggle) {
      autoCommitToggle.addEventListener('change', async function() {
        const currentRepoId = state.activeRepoId || (state.connected.length > 0 ? state.connected[0].id : null);
        if (!currentRepoId || !UUID_RE.test(currentRepoId)) return;
        try {
          await fetch('/api/repos/' + currentRepoId + '/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ autoCommit: this.checked })
          });
          showPendingNotification(`Auto-commit is now ${this.checked ? 'ENABLED' : 'DISABLED'}.`, 'info');
        } catch (_) {}
      });
    }

    if (commitModeSelect) {
      commitModeSelect.addEventListener('change', async function() {
        const currentRepoId = state.activeRepoId || (state.connected.length > 0 ? state.connected[0].id : null);
        if (!currentRepoId || !UUID_RE.test(currentRepoId)) return;
        try {
          await fetch('/api/repos/' + currentRepoId + '/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commitMode: this.value })
          });
          showPendingNotification(`Commit strategy updated to ${this.value === 'pr' ? 'Pull Request' : 'Direct Push'}.`, 'info');
        } catch (_) {}
      });
    }
  }

  // Load proposals from database
  try {
    let url = '/api/docs/proposals?status=pending';
    if (repoId && UUID_RE.test(repoId)) {
      url = '/api/repos/' + repoId + '/doc-proposals';
    }

    const res = await fetch(url);
    let proposals = [];
    if (res.ok) {
      const data = await res.json();
      proposals = (data.proposals || []).map(function(p, idx) {
        return {
          id: p.proposal_id || p.id || ('prop-' + idx),
          title: p.pr_title || p.title || ('Documentation Update ' + (idx + 1)),
          filePath: p.target_file || p.filePath || 'README.md',
          summary: p.rationale || p.summary || p.diff_markdown || '',
          diff_markdown: p.diff_markdown || '',
          status: p.status || 'pending',
          commit_status: p.commit_status || 'uncommitted',
          commit_sha: p.commit_sha || null,
          pr_url: p.pr_url || null,
          error_message: p.error_message || null
        };
      });
    }

    renderPendingGrid(proposals);
  } catch (e) {
    console.error('Failed to load proposals:', e);
    renderPendingGrid([]);
  }
}

function renderPendingGrid(proposals) {
  if (!proposals.length) {
    pendingList.innerHTML = '<div class="pending-grid"><p class="pending-empty">No pending documentation proposals. Click <strong>Scan for Inconsistencies</strong> to compare your code chunks against existing documentation.</p></div>';
    return;
  }

  var grid = document.createElement('div');
  grid.className = 'pending-grid';

  proposals.forEach(function(p, i) {
    var card = document.createElement('div');
    card.className = 'pending-card';
    card.id = 'pending-card-' + (p.id || i);

    var num = i + 1;
    var statusBadge = '';
    if (p.commit_status === 'pr_created' && p.pr_url) {
      statusBadge = '<a href="' + escapeHtml(p.pr_url) + '" target="_blank" class="commit-badge pr_created" title="View Pull Request on GitHub">&#x2197; PR Opened</a>';
    } else if (p.commit_status === 'committed') {
      statusBadge = '<span class="commit-badge committed" title="Commit: ' + (p.commit_sha || '') + '">&#x2713; Committed</span>';
    } else if (p.commit_status === 'failed') {
      statusBadge = '<span class="commit-badge failed" title="' + escapeHtml(p.error_message || 'Commit failed') + '">&#x26A0; Commit Failed</span>';
    } else if (p.status === 'approved') {
      statusBadge = '<span class="commit-badge committed">Approved</span>';
    }

    card.innerHTML =
      '<div class="pending-card-header">' +
        '<div class="pending-card-meta">' +
          '<div class="pending-card-title">' + escapeHtml(p.title || ('Update ' + num)) + '</div>' +
          '<div class="pending-card-doc">Document: <strong>' + escapeHtml(p.filePath || 'Untitled') + '</strong></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          statusBadge +
          '<div class="pending-card-icon">&#x1F4C4;</div>' +
        '</div>' +
      '</div>' +
      '<div class="pending-update-box">' +
        '<div class="pending-update-label">Inconsistency &amp; Update Rationale</div>' +
        '<div class="pending-update-text">' + escapeHtml(p.summary || '') + '</div>' +
      '</div>' +
      '<div class="pending-actions">' +
        '<button class="pending-view-btn" data-id="' + (p.id || '') + '">&#x1F50D; View Unified Diff</button>' +
        '<div class="pending-commit-row">' +
          (p.status === 'approved' && p.commit_status !== 'failed'
            ? '<button class="pending-accept-btn" disabled style="opacity:0.7;">&#x2713; ' + (p.commit_status === 'pr_created' ? 'PR Created' : 'Committed') + '</button>'
            : '<button class="pending-accept-btn" data-id="' + (p.id || '') + '">&#x2714; Accept &amp; Commit</button>'
          ) +
          (p.status !== 'approved'
            ? '<button class="pending-reject-btn" data-id="' + (p.id || '') + '">Reject</button>'
            : ''
          ) +
        '</div>' +
      '</div>';

    // Wire up buttons
    card.querySelector('.pending-view-btn').addEventListener('click', function() {
      state.sent = true;
      state.canvasType = 'schema';
      setView('chat');
      modeChat.classList.add('active');
      modePending.classList.remove('active');
      setNavActive(navNewChat);
      canvasTitle.textContent = escapeHtml(p.title || 'Documentation Diff');
      renderWidgetIntoCanvas({
        type: 'diff',
        title: p.title || 'Documentation Proposal Diff',
        subtitle: p.summary || 'Proposed changes to keep documentation synchronized with codebase.',
        badge: p.filePath || 'README.md',
        payload: {
          file_name: p.filePath || 'README.md',
          patch: p.diff_markdown || ''
        }
      });
      state.messages = [{ role: 'assistant', text: 'Showing proposed documentation diff in the canvas.' }];
      renderMessages();
    });

    const acceptBtn = card.querySelector('.pending-accept-btn');
    if (acceptBtn && !acceptBtn.disabled) {
      acceptBtn.addEventListener('click', async function() {
        var btn = this;
        btn.textContent = 'Committing & Pushing...';
        btn.disabled = true;

        try {
          const res = await fetch('/api/doc-proposals/' + p.id + '/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          const resData = await res.json();

          if (res.ok) {
            const commitRes = resData.commitResult || {};
            if (commitRes.prUrl) {
              btn.innerHTML = '<a href="' + commitRes.prUrl + '" target="_blank" style="color:#fff;text-decoration:underline;">&#x2197; PR Opened!</a>';
              showPendingNotification('Success! Pull Request created on GitHub: ' + commitRes.prUrl, 'success');
            } else if (commitRes.commitSha) {
              btn.textContent = 'Committed (' + commitRes.commitSha.slice(0, 7) + ')';
              showPendingNotification('Success! Documentation changes committed to ' + (commitRes.branch || 'main'), 'success');
            } else if (commitRes.error) {
              btn.textContent = 'Approved (Push Failed)';
              showPendingNotification('Approved, but git push encountered: ' + commitRes.error, 'error');
            } else {
              btn.textContent = 'Approved & Committed';
              showPendingNotification('Proposal approved successfully.', 'success');
            }
            card.style.opacity = '0.75';
            setTimeout(loadPendingDocs, 2500);
          } else {
            btn.textContent = 'Accept & Commit';
            btn.disabled = false;
            showPendingNotification(resData.error || 'Failed to approve proposal.', 'error');
          }
        } catch (err) {
          btn.textContent = 'Accept & Commit';
          btn.disabled = false;
          showPendingNotification('Error: ' + err.message, 'error');
        }
      });
    }

    const rejectBtn = card.querySelector('.pending-reject-btn');
    if (rejectBtn) {
      rejectBtn.addEventListener('click', function() {
        fetch('/api/doc-proposals/' + p.id + '/reject', { method: 'POST' })
          .then(function() {
            card.style.opacity = '0.35';
            card.style.pointerEvents = 'none';
            showPendingNotification('Proposal rejected.', 'info');
          })
          .catch(function() {});
      });
    }

    grid.appendChild(card);
  });

  pendingList.innerHTML = '';
  pendingList.appendChild(grid);
}

// ---- Session Helpers --------------------------------------------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ensureSessionId() {
  let id = sessionStorage.getItem('tracie_session');
  if (id && UUID_RE.test(id)) {
    return id;
  }

  // Create real persistent session in PostgreSQL
  try {
    const repoId = state.activeRepoId || (state.connected.length > 0 ? state.connected[0].id : null);
    const body = repoId && UUID_RE.test(repoId) ? { repositoryId: repoId } : {};
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.sessionId) {
        id = data.sessionId;
        sessionStorage.setItem('tracie_session', id);
        return id;
      }
    }
  } catch (err) {
    console.warn('[sessions] Failed to create backend session, generating local fallback:', err);
  }

  // Fallback random UUID
  id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  sessionStorage.setItem('tracie_session', id);
  return id;
}

function getOrCreateSession() {
  var id = sessionStorage.getItem('tracie_session');
  if (!id) {
    id = 'sess-' + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem('tracie_session', id);
  }
  return id;
}

// ---- Utility ----------------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Global Copy Helper for Markdown Code Blocks ---------------
window.copyMdCode = function(btn) {
  var block = btn.closest('.md-code-block');
  if (!block) return;
  var codeEl = block.querySelector('pre code');
  if (!codeEl) return;
  var text = codeEl.innerText || codeEl.textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      var orig = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(function() {
        btn.textContent = orig;
        btn.classList.remove('copied');
      }, 1600);
    }).catch(function() {
      btn.textContent = 'Copied';
    });
  }
};

// ---- Markdown Parser (Clean ASCII, Safe, High-Contrast) --------
function renderMarkdown(md) {
  if (!md || typeof md !== 'string') return '';

  // 1. Extract fenced code blocks with safe placeholders (no underscores/asterisks)
  var codeBlocks = [];
  var text = md.replace(/```([a-zA-Z0-9_\-\.]*)\r?\n([\s\S]*?)```/g, function(match, lang, code) {
    var placeholder = ':::CODEBLOCK' + codeBlocks.length + ':::';
    codeBlocks.push({
      lang: lang ? lang.trim() : 'code',
      code: code
    });
    return placeholder;
  });

  // 2. Extract inline code with safe placeholders
  var inlineCodes = [];
  text = text.replace(/`([^`\n]+)`/g, function(match, code) {
    var placeholder = ':::INLINECODE' + inlineCodes.length + ':::';
    inlineCodes.push(code);
    return placeholder;
  });

  // 3. Escape HTML on text outside code blocks
  text = escapeHtml(text);

  // 4. Headers: #, ##, ###, ####
  text = text.replace(/^####[ \t]+(.*$)/gim, '<h5 class="md-h5">$1</h5>');
  text = text.replace(/^###[ \t]+(.*$)/gim, '<h4 class="md-h4">$1</h4>');
  text = text.replace(/^##[ \t]+(.*$)/gim, '<h3 class="md-h3">$1</h3>');
  text = text.replace(/^#[ \t]+(.*$)/gim, '<h2 class="md-h2">$1</h2>');

  // 5. Blockquotes: > line
  text = text.replace(/^&gt;[ \t]+(.*$)/gim, '<blockquote class="md-quote">$1</blockquote>');

  // 6. Markdown tables
  text = text.replace(/((?:^\|[^\n]+\|\r?\n?)+)/gm, function(tableBlock) {
    var rows = tableBlock.trim().split(/\r?\n/);
    if (rows.length < 2) return tableBlock;
    var html = '<div class="md-table-wrap"><table class="md-table">';
    var isHeader = true;
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r].trim();
      if (/^\|[-:\s|]+\|$/.test(row)) {
        isHeader = false;
        continue;
      }
      var cells = row.split('|').slice(1, -1);
      html += '<tr>';
      for (var c = 0; c < cells.length; c++) {
        var cellContent = cells[c].trim();
        var tag = isHeader ? 'th' : 'td';
        html += '<' + tag + '>' + cellContent + '</' + tag + '>';
      }
      html += '</tr>';
    }
    html += '</table></div>';
    return html;
  });

  // 7. Process lists before bold/italic to avoid list-bullet asterisks colliding with italic
  var lines = text.split(/\r?\n/);
  var out = [];
  var inUl = false;
  var inOl = false;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var ulMatch = line.match(/^[\*\-][ \t]+(.*)/);
    var olMatch = line.match(/^(\d+)\.[ \t]+(.*)/);

    if (ulMatch) {
      if (!inUl) {
        if (inOl) { out.push('</ol>'); inOl = false; }
        out.push('<ul class="md-ul">');
        inUl = true;
      }
      out.push('<li>' + ulMatch[1] + '</li>');
    } else if (olMatch) {
      if (!inOl) {
        if (inUl) { out.push('</ul>'); inUl = false; }
        out.push('<ol class="md-ol">');
        inOl = true;
      }
      out.push('<li>' + olMatch[2] + '</li>');
    } else {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      out.push(line);
    }
  }
  if (inUl) out.push('</ul>');
  if (inOl) out.push('</ol>');
  text = out.join('\n');

  // 8. Bold: **text** or __text__
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // 9. Italic: *text* or _text_ (non-empty, non-space bounded)
  text = text.replace(/(^|[^\*])\*([^\*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  text = text.replace(/(^|[^_])_([^_]+)_(?!_)/g, '$1<em>$2</em>');

  // 10. Links: [text](url)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>');

  // 11. Horizontal rules
  text = text.replace(/^(?:---|\*\*\*|___)\s*$/gim, '<hr class="md-hr">');

  // 12. Paragraphs & blocks
  var blocks = text.split(/\n\s*\n/);
  var formattedBlocks = blocks.map(function(b) {
    b = b.trim();
    if (!b) return '';
    if (b.startsWith('<h2') || b.startsWith('<h3') || b.startsWith('<h4') || b.startsWith('<h5') ||
        b.startsWith('<ul') || b.startsWith('<ol') || b.startsWith('<blockquote') ||
        b.startsWith('<hr') || b.startsWith('<div class="md-table-wrap"') ||
        b.startsWith(':::CODEBLOCK')) {
      return b;
    }
    return '<p class="md-p">' + b.replace(/\n/g, '<br>') + '</p>';
  });
  text = formattedBlocks.filter(Boolean).join('\n');

  // 13. Restore inline code
  for (var j = 0; j < inlineCodes.length; j++) {
    var rawInline = escapeHtml(inlineCodes[j]);
    text = text.split(':::INLINECODE' + j + ':::').join('<code class="md-inline-code">' + rawInline + '</code>');
  }

  // 14. Restore code blocks
  for (var k = 0; k < codeBlocks.length; k++) {
    var block = codeBlocks[k];
    var rawCode = escapeHtml(block.code.trim());
    var langDisplay = escapeHtml(block.lang || 'code');
    var codeHtml =
      '<div class="md-code-block">' +
        '<div class="md-code-header">' +
          '<span class="md-code-lang">' + langDisplay + '</span>' +
          '<button class="md-copy-btn" onclick="copyMdCode(this)">Copy</button>' +
        '</div>' +
        '<pre><code class="language-' + langDisplay + '">' + rawCode + '</code></pre>' +
      '</div>';
    text = text.split(':::CODEBLOCK' + k + ':::').join(codeHtml);
  }

  return text;
}

// ---- Mermaid Initialization -------------------------------------
if (typeof mermaid !== 'undefined') {
  try {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis'
      },
      themeVariables: {
        primaryColor: '#eef5f0',
        primaryTextColor: '#1b4332',
        primaryBorderColor: '#84b89b',
        lineColor: '#3d6355',
        secondaryColor: '#f5f7f6',
        tertiaryColor: '#ffffff',
        textColor: '#1a252c',
        mainBkg: '#f8faf9',
        nodeBorder: '#84b89b',
        fontSize: '12px'
      }
    });
  } catch (e) {
    console.warn('Mermaid init warning:', e);
  }
}



// ---- Load repos from backend on startup --------------------------
async function loadReposFromBackend() {
  try {
    const res = await fetch('/api/repos');
    if (!res.ok) return;
    const data = await res.json();
    const repos = data.repositories || [];
    repos.forEach(function(repo) {
      const url = repo.url || ('https://github.com/' + repo.name);
      if (!state.connected.some(function(r) { return r.url === url; })) {
        state.connected.push({ url: url, id: repo.id, status: repo.indexStatus });
      }
    });
    renderConnected();
  } catch (e) {
    // silently ignore - server may not be ready yet
  }
}

// ---- Init -------------------------------------------------------
setView('chat');
loadReposFromBackend();


/* ================================================================
   WIDGET RENDERER SYSTEM
   Renders structured API widget responses into the canvas panel
   ================================================================ */

function renderWidgetIntoCanvas(widget) {
  canvasPreview.innerHTML = '';
  canvasError.style.display = 'none';
  if (!widget || !widget.type) {
    canvasPreview.innerHTML = '<p class="w-body">No widget data.</p>';
    return;
  }
  // Ensure quiz widget has questions array if passed as a flat single-question object
  if (widget.type === 'quiz' && !widget.questions && (widget.question || widget.options)) {
    widget.questions = [{
      question: widget.question || widget.title || '',
      options: widget.options || [],
      correct_index: resolveQuizCorrectIndex(widget),
      explanation: widget.explanation || ''
    }];
  }
  // Delegate to UIRenderer once widgets are loaded; fall back to legacy createWidget
  const doRender = function() {
    if (window.UIRenderer && window.UIRenderer.has(normaliseWidgetType(widget.type))) {
      window.UIRenderer.setCanvas(canvasPreview).render(widget);
    } else {
      const el = createWidget(widget);
      if (el) canvasPreview.appendChild(el);
    }
  };
  if (window.UIRendererReady) {
    window.UIRendererReady.then(doRender);
  } else {
    doRender();
  }
}

/** Map legacy/alias type names to UIRenderer canonical names */
function normaliseWidgetType(type) {
  const aliases = {
    flashcard_deck: 'flashcards',
    tutorial_steps: 'tutorial',
    learning_path:  'learning_path',
    diff_view:      'diff',
    file_tree:      'directory_tree',
    diagram:        'flowchart',
    mermaid:        'flowchart',
    architecture_diagram: 'flowchart',
    database_diagram: 'database_schema',
  };
  return aliases[type] || type;
}

function createWidget(w) {
  switch (w.type) {
    case 'audio_player':       return createAudioWidget(w);
    case 'overview':           return createOverviewWidget(w);
    case 'glossary':           return createGlossaryWidget(w);
    case 'definition':         return createDefinitionWidget(w);
    case 'faq':                return createFAQWidget(w);
    case 'file_tree':          return createDirectoryTreeWidget(w);
    case 'directory_tree':     return createDirectoryTreeWidget(w);
    case 'code_snippet':       return createCodeSnippetWidget(w);
    case 'chat_response':      return createChatResponseWidget(w);
    case 'architecture_diagram':
    case 'diagram':
    case 'flowchart':
    case 'mermaid':
      return createArchitectureDiagramWidget(w);
    case 'quiz':                 return createQuizWidget(w);
    case 'flashcard_deck':       return createFlashcardDeckWidget(w);
    case 'tutorial_steps':       return createTutorialStepsWidget(w);
    case 'learning_path':        return createTutorialStepsWidget(w);
    case 'doc_proposal':         return createDocProposalWidget(w);
    case 'alert_card':           return createAlertCardWidget(w);
    case 'composite_dashboard':  return createCompositeDashboardWidget(w);
    default: {
      // Smart fallback: if the widget has a diagram_source or mermaid DSL field, treat it as a diagram
      var hasDsl = (w.diagram_source || w.mermaidcode || w.mermaidCode || w.mermaid_code || w.diagramSource || w.flowchart || '').trim();
      if (hasDsl) return createArchitectureDiagramWidget(w);
      // Otherwise render as a chat response
      return createChatResponseWidget(w);
    }
  }
}

// ---- Audio player -----------------------------------------------
function createAudioWidget(w) {
  var title     = w.title || 'Audio overview';
  var subtitle  = w.subtitle || w.description || '';
  var duration  = w.duration_seconds || 270;
  var elapsed   = 0;
  var speed     = w.speed || 1.25;
  var audioUrl  = w.audio_url || null;
  var provider  = w.provider || (audioUrl ? 'ElevenLabs Studio Voice' : 'Web Speech API');
  var pct       = 0;
  var playing   = false;
  var timer     = null;
  var audioEl   = audioUrl ? new Audio(audioUrl) : null;

  // Web Speech API state (used when no audio_url is available)
  var utterance = null;
  var ttsSupported = !audioUrl && w.transcript && typeof window !== 'undefined' && 'speechSynthesis' in window;

  if (audioEl) {
    audioEl.playbackRate = speed;
    audioEl.addEventListener('loadedmetadata', function() {
      if (audioEl.duration && !isNaN(audioEl.duration)) {
        duration = Math.round(audioEl.duration);
        updateProgress();
      }
    });
    audioEl.addEventListener('timeupdate', function() {
      elapsed = audioEl.currentTime;
      pct = Math.min(100, Math.round((elapsed / duration) * 100));
      updateProgress();
    });
    audioEl.addEventListener('ended', function() {
      playing = false;
      elapsed = 0;
      pct = 0;
      updatePlayBtn();
      updateProgress();
    });
  }

  function buildUtterance() {
    var u = new SpeechSynthesisUtterance(w.transcript);
    u.rate = speed;
    u.onstart = function() {
      playing = true;
      updatePlayBtn();
      // Drive the progress bar with a timer since Web Speech has no timeupdate
      timer = setInterval(function() {
        if (elapsed < duration) {
          elapsed += 0.5;
        } else {
          elapsed = duration;
        }
        pct = Math.min(100, Math.round((elapsed / duration) * 100));
        updateProgress();
      }, 500);
    };
    u.onend = function() {
      playing = false;
      elapsed = 0;
      pct = 0;
      clearInterval(timer);
      updatePlayBtn();
      updateProgress();
    };
    u.onerror = function() {
      playing = false;
      clearInterval(timer);
      updatePlayBtn();
    };
    return u;
  }

  function fmtTime(s) {
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  var div = document.createElement('div');
  div.className = 'w-card w-audio';

  function updatePlayBtn() {
    var btn = div.querySelector('#audioPlayBtn');
    if (!btn) return;
    btn.innerHTML = playing
      ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="2" width="4" height="10"/><rect x="8" y="2" width="4" height="10"/></svg> Pause'
      : '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><polygon points="3,1 13,7 3,13"/></svg> Play';
  }

  function updateProgress() {
    var elTime = div.querySelector('#audioElapsed');
    var elEnd  = div.querySelector('#audioEndTime');
    var elFill = div.querySelector('#audioFill');
    if (elTime) elTime.textContent = fmtTime(elapsed);
    if (elEnd)  elEnd.textContent = fmtTime(duration);
    if (elFill) elFill.style.width = pct + '%';
  }

  function render() {
    var providerBadge = provider.includes('ElevenLabs')
      ? '<span style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--sage);background:#eef5f0;border-radius:12px;padding:2px 8px;margin-left:8px;">ElevenLabs</span>'
      : (ttsSupported
          ? '<span style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;background:#f3f4f6;border-radius:12px;padding:2px 8px;margin-left:8px;">Web Speech</span>'
          : '');

    div.innerHTML =
      '<div class="w-audio-header">' +
        '<div class="w-audio-meta">' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">' +
            '<h3 style="margin:0;">' + escapeHtml(title) + '</h3>' +
            providerBadge +
          '</div>' +
          (subtitle ? '<p>' + escapeHtml(subtitle) + '</p>' : '') +
        '</div>' +
        '<button class="w-audio-dl" title="Download audio" id="audioDlBtn">&#x21E9;</button>' +
      '</div>' +

      '<div class="w-audio-controls">' +
        '<span class="w-audio-time" id="audioElapsed">' + fmtTime(elapsed) + '</span>' +
        '<div class="w-audio-track" id="audioTrack">' +
          '<div class="w-audio-fill" id="audioFill" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<span class="w-audio-time end" id="audioEndTime">' + fmtTime(duration) + '</span>' +
        '<button class="w-audio-play-btn" id="audioPlayBtn"></button>' +
      '</div>' +

      '<div class="w-audio-bottom">' +
        '<button class="w-audio-skip" id="audioMinus">&#x21BA; -10s</button>' +
        '<button class="w-audio-speed" id="audioSpeed">' + speed + ' x</button>' +
        '<button class="w-audio-skip" id="audioPlus">&#x21BB; +10s</button>' +
      '</div>' +
      (w.transcript ? '<div style="margin-top:14px;padding:12px 14px;background:var(--soft);border-radius:8px;border:1px solid var(--line);font-size:13px;line-height:1.6;color:var(--ink);"><div style="font-size:10.5px;font-weight:700;text-transform:uppercase;color:var(--sage);letter-spacing:0.06em;margin-bottom:6px;">Spoken Transcript</div>' + renderMarkdown(w.transcript) + '</div>' : '');

    updatePlayBtn();

    div.querySelector('#audioPlayBtn').addEventListener('click', function() {
      if (audioEl) {
        // <audio> element path
        playing = !playing;
        updatePlayBtn();
        if (playing) {
          audioEl.play().catch(function(e) { console.warn('Audio play prevented:', e); });
        } else {
          audioEl.pause();
        }
      } else if (ttsSupported) {
        // Web Speech API path
        if (playing) {
          // Pause
          window.speechSynthesis.pause();
          playing = false;
          clearInterval(timer);
          updatePlayBtn();
        } else {
          if (window.speechSynthesis.paused && utterance) {
            // Resume a paused utterance
            window.speechSynthesis.resume();
            playing = true;
            updatePlayBtn();
            timer = setInterval(function() {
              if (elapsed < duration) { elapsed += 0.5; } else { elapsed = duration; }
              pct = Math.min(100, Math.round((elapsed / duration) * 100));
              updateProgress();
            }, 500);
          } else {
            // Start fresh
            window.speechSynthesis.cancel();
            utterance = buildUtterance();
            window.speechSynthesis.speak(utterance);
          }
        }
      }
    });

    div.querySelector('#audioMinus').addEventListener('click', function() {
      elapsed = Math.max(0, elapsed - 10);
      if (audioEl) audioEl.currentTime = elapsed;
      pct = Math.round((elapsed / duration) * 100);
      updateProgress();
    });

    div.querySelector('#audioPlus').addEventListener('click', function() {
      elapsed = Math.min(duration, elapsed + 10);
      if (audioEl) audioEl.currentTime = elapsed;
      pct = Math.round((elapsed / duration) * 100);
      updateProgress();
    });

    var speeds = [0.75, 1, 1.25, 1.5, 2];
    div.querySelector('#audioSpeed').addEventListener('click', function() {
      var idx = speeds.indexOf(speed);
      speed = speeds[(idx + 1) % speeds.length];
      this.textContent = speed + ' x';
      if (audioEl) {
        audioEl.playbackRate = speed;
      } else if (ttsSupported && playing) {
        // Restart with new rate — Web Speech has no live rate change
        var charPos = utterance ? utterance.charIndex : 0;
        window.speechSynthesis.cancel();
        clearInterval(timer);
        utterance = buildUtterance();
        // Trim already-spoken text if possible to resume mid-transcript
        if (charPos > 0 && w.transcript.length > charPos) {
          utterance.text = w.transcript.slice(charPos);
        }
        window.speechSynthesis.speak(utterance);
      }
    });

    div.querySelector('#audioTrack').addEventListener('click', function(e) {
      var rect = e.currentTarget.getBoundingClientRect();
      pct = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
      elapsed = Math.round((pct / 100) * duration);
      if (audioEl) audioEl.currentTime = elapsed;
      updateProgress();
    });

    if (audioUrl) {
      div.querySelector('#audioDlBtn').addEventListener('click', function() {
        var a = document.createElement('a');
        a.href = audioUrl; a.download = (title.replace(/[^a-zA-Z0-9_-]/g, '_')) + '.mp3'; a.click();
      });
    }
  }

  render();
  return div;
}

// ---- Overview / Platform architecture --------------------------
function createOverviewWidget(w) {
  var div = document.createElement('div');
  div.className = 'w-card';
  var layers = w.layers || w.components || [];
  var icons = ['&#x1F5A5;', '&#x26A1;', '&#x1F4BE;'];
  var tags  = ['INTERFACE', 'LOGIC', 'FOUNDATION'];
  var layersHtml = layers.map(function(l, i) {
    return '<div class="w-layer' + (i === 1 ? ' active' : '') + '">' +
      '<div class="w-layer-header">' +
        '<span class="w-layer-icon">' + (icons[i] || '&#x25A1;') + '</span>' +
        '<span class="w-layer-tag">' + (l.tag || tags[i] || '') + '</span>' +
      '</div>' +
      '<h4>' + escapeHtml(l.name || l.title || '') + '</h4>' +
      '<p>' + escapeHtml(l.description || '') + '</p>' +
    '</div>';
  }).join('');

  div.innerHTML =
    '<div class="w-overview-header">' +
      '<div><div class="w-eyebrow">' + escapeHtml(w.label || 'OVERVIEW') + '</div></div>' +
      (w.reviewed_at ? '<div class="w-reviewed"><div class="w-reviewed-dot"></div><span>Last reviewed ' + escapeHtml(w.reviewed_at) + '</span></div>' : '') +
    '</div>' +
    '<div class="w-title">' + escapeHtml(w.title || '') + '</div>' +
    (w.subtitle ? '<div class="w-subtitle">' + escapeHtml(w.subtitle) + '</div>' : '') +
    (w.body || w.description ? '<div class="w-body" style="margin-bottom:14px;">' + escapeHtml(w.body || w.description) + '</div>' : '') +
    (layers.length ? '<div class="w-layer-grid">' + layersHtml + '</div>' : '');
  return div;
}

// ---- Glossary --------------------------------------------------
function createGlossaryWidget(w) {
  var terms = w.terms || w.items || [];
  var rowsHtml = terms.map(function(t) {
    return '<div class="w-glossary-row">' +
      '<span class="w-glossary-term">' + escapeHtml(t.term || t.key || '') + '</span>' +
      '<span class="w-glossary-def">' + escapeHtml(t.definition || t.value || '') + '</span>' +
    '</div>';
  }).join('');

  var div = document.createElement('div');
  div.className = 'w-card';
  div.innerHTML =
    '<div class="w-eyebrow">' + escapeHtml(w.label || 'GLOSSARY') + '</div>' +
    '<div class="w-title">' + escapeHtml(w.title || 'Terms') + '</div>' +
    (w.subtitle ? '<div class="w-body" style="margin-bottom:12px;">' + escapeHtml(w.subtitle) + '</div>' : '') +
    rowsHtml;
  return div;
}

// ---- Definition ------------------------------------------------
function createDefinitionWidget(w) {
  var div = document.createElement('div');
  div.className = 'w-card';
  div.innerHTML =
    '<div class="w-eyebrow">' + escapeHtml(w.label || 'DEFINITION') + '</div>' +
    (w.path ? '<div class="w-def-path">' + escapeHtml(w.path) + '</div>' : '') +
    '<div class="w-title">' + escapeHtml(w.term || w.title || '') + '</div>' +
    (w.part_of_speech || w.category ? '<div class="w-def-tag">' + escapeHtml(((w.part_of_speech || '') + (w.category ? ' &#xB7; ' + w.category : '')).toUpperCase()) + '</div>' : '') +
    '<div class="w-body">' + escapeHtml(w.definition || w.body || '') + '</div>';
  return div;
}

// ---- FAQ -------------------------------------------------------
function createFAQWidget(w) {
  var items = w.items || w.questions || [];
  var itemsHtml = items.map(function(item) {
    return '<div class="w-faq-item">' +
      '<div class="w-faq-q">' +
        '<div class="w-faq-icon">?</div>' +
        '<span>' + escapeHtml(item.question || item.q || '') + '</span>' +
      '</div>' +
      '<div class="w-faq-a">' + escapeHtml(item.answer || item.a || '') + '</div>' +
    '</div>';
  }).join('');

  var div = document.createElement('div');
  div.className = 'w-card';
  div.innerHTML =
    '<div class="w-eyebrow">' + escapeHtml(w.label || 'FREQUENTLY ASKED QUESTIONS') + '</div>' +
    '<div class="w-title">' + escapeHtml(w.title || 'Questions teams ask') + '</div>' +
    (w.subtitle ? '<div class="w-body" style="margin-bottom:12px;">' + escapeHtml(w.subtitle) + '</div>' : '') +
    itemsHtml;
  return div;
}

// ---- Directory tree / file_tree (Interactive Explorer) ----------
function createDirectoryTreeWidget(w) {
  var div = document.createElement('div');
  div.className = 'w-card w-dir-tree';

  var rootNode = w.root || null;
  if (!rootNode && w.path) {
    rootNode = { name: w.path, type: 'file', description: w.description || '' };
  }

  // Calculate statistics across the tree
  var totalDirs = 0;
  var totalFiles = 0;
  var pyCount = 0;
  var mdCount = 0;
  var cfgCount = 0;

  function countStats(node) {
    if (!node) return;
    if (node.type === 'directory') {
      totalDirs++;
      if (node.children) node.children.forEach(countStats);
    } else {
      totalFiles++;
      var name = (node.name || '').toLowerCase();
      if (name.endsWith('.py')) pyCount++;
      else if (name.endsWith('.md') || name.endsWith('.txt')) mdCount++;
      else if (name.endsWith('.json') || name.endsWith('.yml') || name.endsWith('.yaml') || name.endsWith('.toml')) cfgCount++;
    }
  }
  if (rootNode) countStats(rootNode);

  // File icon and badge helper
  function getFileMeta(name) {
    var lower = (name || '').toLowerCase();
    if (lower.endsWith('.py')) return { icon: '🐍', badge: 'py', label: 'Python' };
    if (lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.mjs')) return { icon: '📜', badge: 'js', label: 'JavaScript' };
    if (lower.endsWith('.json') || lower.endsWith('.yml') || lower.endsWith('.yaml') || lower.endsWith('.toml')) return { icon: '⚙️', badge: 'cfg', label: 'Config' };
    if (lower.endsWith('.md') || lower.endsWith('.rst') || lower.endsWith('.txt')) return { icon: '📝', badge: 'doc', label: 'Doc' };
    if (lower.endsWith('.sh') || lower.endsWith('.bat') || lower.endsWith('.ps1')) return { icon: '💻', badge: 'sh', label: 'Script' };
    if (lower.endsWith('.html') || lower.endsWith('.css')) return { icon: '🌐', badge: 'web', label: 'Web' };
    return { icon: '📄', badge: '', label: 'File' };
  }

  // Active path and breadcrumb tracking
  var activePath = rootNode ? rootNode.name : (w.path || 'root');

  // Breadcrumbs builder
  function buildBreadcrumbHtml(pathStr) {
    var segs = (pathStr || '').split('/').filter(Boolean);
    if (segs.length === 0) segs = ['root'];
    return segs.map(function(seg, i) {
      var isLast = i === segs.length - 1;
      return '<span class="w-dir-seg' + (isLast ? ' active' : '') + '">' + escapeHtml(seg) + '</span>' +
        (!isLast ? '<span class="w-dir-sep">/</span>' : '');
    }).join('');
  }

  // Header HTML
  var title = w.title || (rootNode ? (rootNode.name + ' Repository Layout') : 'Directory Explorer');
  var desc = (rootNode && rootNode.description) || w.description || w.subtitle || 'Explore repository structure, view file descriptions, and ask TRACiE about any file.';

  var statsHtml =
    '<div class="w-dir-stats">' +
      '<span class="w-dir-stat-chip">📁 ' + totalDirs + ' directories</span>' +
      '<span class="w-dir-stat-chip">📄 ' + totalFiles + ' files</span>' +
      (pyCount > 0 ? '<span class="w-dir-stat-chip py">🐍 ' + pyCount + ' Python</span>' : '') +
      (mdCount > 0 ? '<span class="w-dir-stat-chip md">📝 ' + mdCount + ' Docs</span>' : '') +
      (cfgCount > 0 ? '<span class="w-dir-stat-chip cfg">⚙️ ' + cfgCount + ' Configs</span>' : '') +
    '</div>';

  var headerHtml =
    '<div class="w-dir-header">' +
      '<div class="w-dir-header-top">' +
        '<div class="w-eyebrow" style="margin-bottom:0;">🧭 DIRECTORY EXPLORER</div>' +
      '</div>' +
      '<div class="w-dir-title">' + escapeHtml(title) + '</div>' +
      '<div class="w-dir-desc">' + escapeHtml(desc) + '</div>' +
      '<div class="w-dir-breadcrumb" id="treeBreadcrumb">' + buildBreadcrumbHtml(activePath) + '</div>' +
      statsHtml +
    '</div>';

  // Toolbar HTML
  var toolbarHtml =
    '<div class="w-dir-toolbar">' +
      '<div class="w-dir-search-wrap">' +
        '<span class="w-dir-search-icon">&#x2315;</span>' +
        '<input type="text" class="w-dir-search-input" placeholder="Filter files or folders... (e.g. routing, .py, auth)" aria-label="Filter tree">' +
        '<span class="w-dir-search-clear" style="display:none;" title="Clear search">&times;</span>' +
      '</div>' +
      '<div class="w-dir-actions">' +
        '<button class="w-dir-btn" id="btnExpandAll" title="Expand all folders">&#x229E; Expand All</button>' +
        '<button class="w-dir-btn" id="btnCollapseAll" title="Collapse all folders">&#x229F; Collapse All</button>' +
      '</div>' +
    '</div>';

  // Tree HTML Generator
  var nodeIdCounter = 0;
  function renderTreeNode(node, depth, currentPath) {
    if (!node) return '';
    var nodeId = 'node_' + (++nodeIdCounter);
    var isDir = node.type === 'directory';
    var fullPath = currentPath ? (currentPath + '/' + node.name) : node.name;
    var meta = isDir ? null : getFileMeta(node.name);

    var chevronHtml = isDir
      ? '<span class="w-dir-chevron open">&#x25B6;</span>'
      : '<span class="w-dir-chevron leaf">&bull;</span>';

    var iconHtml = isDir
      ? '<span class="w-dir-icon" style="color:#d97706;">📂</span>'
      : '<span class="w-dir-icon">' + meta.icon + '</span>';

    var badgeHtml = (!isDir && meta.badge)
      ? '<span class="w-dir-badge ' + meta.badge + '">' + meta.badge + '</span>'
      : '';

    var childCount = (isDir && node.children) ? node.children.length : 0;
    var countHtml = isDir ? ('<span class="w-dir-count-pill">' + childCount + '</span>') : '';

    var descHtml = node.description
      ? ('<span class="w-dir-desc-snippet" title="' + escapeHtml(node.description) + '">' + escapeHtml(node.description) + '</span>')
      : '';

    var askBtnHtml = !isDir
      ? ('<button class="w-dir-ask-btn" data-path="' + escapeHtml(fullPath) + '">Ask AI &#x2197;</button>')
      : '';

    var rowHtml =
      '<div class="w-dir-row ' + (isDir ? 'directory' : 'file') + '" data-id="' + nodeId + '" data-type="' + node.type + '" data-path="' + escapeHtml(fullPath) + '" data-name="' + escapeHtml(node.name) + '" data-desc="' + escapeHtml(node.description || '') + '">' +
        chevronHtml +
        iconHtml +
        '<span class="w-dir-name">' + escapeHtml(node.name) + '</span>' +
        badgeHtml +
        countHtml +
        descHtml +
        askBtnHtml +
      '</div>';

    var childrenHtml = '';
    if (isDir && node.children && node.children.length > 0) {
      var childNodes = node.children.map(function(child) {
        return renderTreeNode(child, depth + 1, fullPath);
      }).join('');
      // Default: collapse nodes deeper than depth 2 so tree remains tidy
      var isCollapsed = depth >= 2;
      childrenHtml = '<div class="w-dir-children' + (isCollapsed ? ' collapsed' : '') + '" id="children_' + nodeId + '">' + childNodes + '</div>';
    }

    return '<div class="w-dir-node" id="' + nodeId + '">' + rowHtml + childrenHtml + '</div>';
  }

  var treeBodyHtml = rootNode ? renderTreeNode(rootNode, 0, '') : '<div style="padding:16px;color:var(--muted);text-align:center;">No directory tree data available.</div>';

  var containerHtml = '<div class="w-dir-tree-container" id="treeContainer">' + treeBodyHtml + '</div>';

  // Inspector Drawer HTML (hidden by default)
  var inspectorHtml =
    '<div class="w-dir-inspector" id="treeInspector" style="display:none;">' +
      '<div class="w-dir-inspector-header">' +
        '<span class="w-dir-inspector-path" id="inspectPath"></span>' +
        '<button class="w-dir-search-clear" id="closeInspector" title="Close inspector">&times;</button>' +
      '</div>' +
      '<div class="w-dir-inspector-desc" id="inspectDesc"></div>' +
      '<div class="w-dir-inspector-actions">' +
        '<button class="w-dir-inspect-btn" id="inspectAskBtn">&#x1F4AC; Ask TRACiE to explain this file</button>' +
        '<button class="w-dir-copy-btn" id="inspectCopyBtn">&#x1F4CB; Copy Path</button>' +
      '</div>' +
    '</div>';

  div.innerHTML = headerHtml + toolbarHtml + containerHtml + inspectorHtml;

  // Interactivity Wiring
  setTimeout(function() {
    var container = div.querySelector('#treeContainer');
    var breadcrumbEl = div.querySelector('#treeBreadcrumb');
    var searchInput = div.querySelector('.w-dir-search-input');
    var searchClear = div.querySelector('.w-dir-search-clear');
    var btnExpandAll = div.querySelector('#btnExpandAll');
    var btnCollapseAll = div.querySelector('#btnCollapseAll');
    var inspector = div.querySelector('#treeInspector');
    var inspectPath = div.querySelector('#inspectPath');
    var inspectDesc = div.querySelector('#inspectDesc');
    var inspectAskBtn = div.querySelector('#inspectAskBtn');
    var inspectCopyBtn = div.querySelector('#inspectCopyBtn');
    var closeInspector = div.querySelector('#closeInspector');

    var selectedFilePath = '';
    var selectedFileDesc = '';

    // Folder Toggle and Row Selection
    div.querySelectorAll('.w-dir-row').forEach(function(row) {
      row.addEventListener('click', function(e) {
        // If clicked Ask AI button, let its handler handle it
        if (e.target.classList.contains('w-dir-ask-btn')) return;

        var isDir = row.getAttribute('data-type') === 'directory';
        var nodeId = row.getAttribute('data-id');
        var path = row.getAttribute('data-path') || '';
        var desc = row.getAttribute('data-desc') || '';

        // Update breadcrumb
        if (breadcrumbEl) breadcrumbEl.innerHTML = buildBreadcrumbHtml(path);

        // Selection highlight
        div.querySelectorAll('.w-dir-row').forEach(function(r) { r.classList.remove('selected'); });
        row.classList.add('selected');

        if (isDir) {
          // Toggle directory collapse/expand
          var childrenEl = div.querySelector('#children_' + nodeId);
          var chevron = row.querySelector('.w-dir-chevron');
          var icon = row.querySelector('.w-dir-icon');
          if (childrenEl) {
            var isClosed = childrenEl.classList.contains('collapsed');
            if (isClosed) {
              childrenEl.classList.remove('collapsed');
              if (chevron) chevron.classList.add('open');
              if (icon) icon.textContent = '📂';
            } else {
              childrenEl.classList.add('collapsed');
              if (chevron) chevron.classList.remove('open');
              if (icon) icon.textContent = '📁';
            }
          }
        } else {
          // File selected: show Inspector
          selectedFilePath = path;
          selectedFileDesc = desc;
          if (inspector) {
            inspector.style.display = 'flex';
            if (inspectPath) inspectPath.textContent = '📄 ' + path;
            if (inspectDesc) inspectDesc.textContent = desc || 'No architectural description documented for this file.';
          }
        }
      });
    });

    // Ask AI Buttons (row & inspector)
    function triggerAskFile(path) {
      if (!path) return;
      var prompt = 'Explain the architecture and purpose of `' + path + '` in the project.';
      var input = document.getElementById('queryInput');
      if (input) {
        input.value = prompt;
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    div.querySelectorAll('.w-dir-ask-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var path = btn.getAttribute('data-path');
        triggerAskFile(path);
      });
    });

    if (inspectAskBtn) {
      inspectAskBtn.addEventListener('click', function() {
        triggerAskFile(selectedFilePath);
      });
    }

    // Copy Path Button
    if (inspectCopyBtn) {
      inspectCopyBtn.addEventListener('click', function() {
        if (!selectedFilePath) return;
        navigator.clipboard.writeText(selectedFilePath).then(function() {
          var orig = inspectCopyBtn.innerHTML;
          inspectCopyBtn.innerHTML = '&#x2713; Copied!';
          setTimeout(function() { inspectCopyBtn.innerHTML = orig; }, 1500);
        });
      });
    }

    if (closeInspector && inspector) {
      closeInspector.addEventListener('click', function() {
        inspector.style.display = 'none';
      });
    }

    // Expand All / Collapse All
    if (btnExpandAll) {
      btnExpandAll.addEventListener('click', function() {
        div.querySelectorAll('.w-dir-children').forEach(function(c) { c.classList.remove('collapsed'); });
        div.querySelectorAll('.w-dir-chevron:not(.leaf)').forEach(function(ch) { ch.classList.add('open'); });
        div.querySelectorAll('.w-dir-row.directory .w-dir-icon').forEach(function(ic) { ic.textContent = '📂'; });
      });
    }

    if (btnCollapseAll) {
      btnCollapseAll.addEventListener('click', function() {
        div.querySelectorAll('.w-dir-children').forEach(function(c) { c.classList.add('collapsed'); });
        div.querySelectorAll('.w-dir-chevron:not(.leaf)').forEach(function(ch) { ch.classList.remove('open'); });
        div.querySelectorAll('.w-dir-row.directory .w-dir-icon').forEach(function(ic) { ic.textContent = '📁'; });
      });
    }

    // Live Search Filter
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        var query = searchInput.value.trim().toLowerCase();
        if (searchClear) searchClear.style.display = query ? 'block' : 'none';

        if (!query) {
          // Restore default visibility
          div.querySelectorAll('.w-dir-node').forEach(function(n) { n.style.display = ''; });
          div.querySelectorAll('.w-dir-name').forEach(function(el) {
            var raw = el.getAttribute('data-raw') || el.textContent;
            el.innerHTML = escapeHtml(raw);
          });
          return;
        }

        // Expand all folders during search so matches are visible
        div.querySelectorAll('.w-dir-children').forEach(function(c) { c.classList.remove('collapsed'); });
        div.querySelectorAll('.w-dir-chevron:not(.leaf)').forEach(function(ch) { ch.classList.add('open'); });
        div.querySelectorAll('.w-dir-row.directory .w-dir-icon').forEach(function(ic) { ic.textContent = '📂'; });

        var matchCount = 0;
        div.querySelectorAll('.w-dir-row').forEach(function(row) {
          var name = (row.getAttribute('data-name') || '').toLowerCase();
          var desc = (row.getAttribute('data-desc') || '').toLowerCase();
          var path = (row.getAttribute('data-path') || '').toLowerCase();
          var isMatch = name.includes(query) || desc.includes(query) || path.includes(query);

          var nodeEl = row.closest('.w-dir-node');
          var nameSpan = row.querySelector('.w-dir-name');

          if (isMatch) {
            matchCount++;
            if (nodeEl) nodeEl.style.display = '';
            // Highlight matching letters in name
            if (nameSpan) {
              if (!nameSpan.hasAttribute('data-raw')) nameSpan.setAttribute('data-raw', nameSpan.textContent);
              var rawName = nameSpan.getAttribute('data-raw');
              var regex = new RegExp('(' + query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + ')', 'gi');
              nameSpan.innerHTML = rawName.replace(regex, '<mark class="w-dir-highlight">$1</mark>');
            }
            // Ensure all parent nodes of a match are visible
            var parent = nodeEl ? nodeEl.parentElement : null;
            while (parent && parent.classList.contains('w-dir-children')) {
              var parentNode = parent.closest('.w-dir-node');
              if (parentNode) parentNode.style.display = '';
              parent = parentNode ? parentNode.parentElement : null;
            }
          } else {
            var isDir = row.getAttribute('data-type') === 'directory';
            if (!isDir && nodeEl) {
              nodeEl.style.display = 'none';
            }
          }
        });
      });

      if (searchClear) {
        searchClear.addEventListener('click', function() {
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input'));
        });
      }
    }

  }, 10);

  return div;
}

// ---- Code snippet ----------------------------------------------
function createCodeSnippetWidget(w) {
  var div = document.createElement('div');
  div.className = 'w-card';
  var code = w.code || '';
  var lines = code.split(/\r?\n/);
  var startLine = w.start_line || 1;
  var rowsHtml = lines.map(function(line, i) {
    return '<tr>' +
      '<td class="w-code-ln">' + (startLine + i) + '</td>' +
      '<td class="w-code-text">' + escapeHtml(line) + '</td>' +
    '</tr>';
  }).join('');

  div.innerHTML =
    '<div class="w-eyebrow">CODE SNIPPET</div>' +
    '<div class="w-code-header">' +
      '<span class="w-code-filename">' + escapeHtml(w.file_path || w.filename || '') + '</span>' +
      '<div style="display:flex;align-items:center;gap:6px;">' +
        '<span class="w-code-lang">' + escapeHtml(w.language || '') + '</span>' +
        '<button class="w-code-copy-btn" style="padding:2px 8px;font-size:11px;border:1px solid var(--line);border-radius:4px;background:var(--white);cursor:pointer;color:var(--ink);">Copy</button>' +
      '</div>' +
    '</div>' +
    '<div class="w-code-block"><table>' + rowsHtml + '</table></div>' +
    (w.explanation ? '<div class="w-code-explanation">' + renderMarkdown(w.explanation) + '</div>' : '');
  var copyBtn = div.querySelector('.w-code-copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      navigator.clipboard.writeText(code).then(function() {
        copyBtn.textContent = 'Copied!';
        setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1500);
      });
    });
  }
  return div;
}

// ---- Chat response ---------------------------------------------
function createChatResponseWidget(w) {
  var div = document.createElement('div');
  div.className = 'w-card';
  // Never dump raw JSON — if all content fields are missing, show a friendly fallback
  var content = w.content || w.message || w.answer || w.explanation || w.description || w.summary || w.body ||
    (w.title ? ('**' + w.title + '**\n\n' + (w.rationale || w.overview || '')) : null) ||
    null;

  var citations = w.citations || [];
  var citeHtml = '';
  if (citations.length) {
    citeHtml = '<div class="w-citation-list"><div class="w-citation-label">Sources &amp; Citations</div>' +
      citations.map(function(c) {
        var lineStr = c.start_line ? ('L' + c.start_line + (c.end_line && c.end_line !== c.start_line ? '-' + c.end_line : '')) : '';
        return '<div class="w-citation">' +
          '<span class="w-citation-file">' + escapeHtml(c.file_path || '') + '</span>' +
          (lineStr ? '<span class="w-citation-lines">' + escapeHtml(lineStr) + '</span>' : '') +
          (c.snippet ? '<div style="font-size:11px;color:var(--muted);font-family:monospace;width:100%;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(c.snippet) + '</div>' : '') +
        '</div>';
      }).join('') + '</div>';
  }

  var externalRefs = w.external_references || [];
  var refHtml = '';
  if (externalRefs.length) {
    refHtml = '<div class="w-citation-list" style="margin-top:10px;"><div class="w-citation-label">Documentation Standards &amp; RFCs</div>' +
      externalRefs.map(function(r) {
        return '<div class="w-citation">' +
          '<a href="' + escapeHtml(r.url || '#') + '" target="_blank" rel="noopener noreferrer" style="color:var(--sage);font-weight:600;text-decoration:underline;">' + escapeHtml(r.title || r.url || 'Reference') + '</a>' +
          (r.snippet ? '<span style="font-size:11.5px;color:var(--muted);margin-left:6px;">' + escapeHtml(r.snippet) + '</span>' : '') +
        '</div>';
      }).join('') + '</div>';
  }

  div.innerHTML =
    '<div class="w-eyebrow">ASSISTANT RESPONSE</div>' +
    '<div class="w-chat-content">' + (content ? renderMarkdown(content) : '<p style="color:var(--muted);font-size:13px;">No response text was returned for this query. Try asking again.</p>') + '</div>' +
    citeHtml +
    refHtml;
  return div;
}

// ---- Key-value list --------------------------------------------
function createKeyValueWidget(w) {
  var items = w.items || [];
  var rowsHtml = items.map(function(item) {
    return '<div class="w-kv-row">' +
      '<span class="w-kv-key">' + escapeHtml(item.key || '') + '</span>' +
      '<span class="w-kv-val">' + escapeHtml(item.value || '') + '</span>' +
      (item.description ? '<span class="w-kv-desc">' + escapeHtml(item.description) + '</span>' : '') +
    '</div>';
  }).join('');

  var div = document.createElement('div');
  div.className = 'w-card';
  div.innerHTML =
    '<div class="w-eyebrow">KEY / VALUE</div>' +
    '<div class="w-title">' + escapeHtml(w.title || '') + '</div>' +
    rowsHtml;
  return div;
}

// ---- Mermaid Helpers & Initialization --------------------------
function sanitizeMermaidSource(src) {
  if (!src || typeof src !== 'string') return '';
  var s = src.trim();
  if (s.includes('\\n')) {
    s = s.replace(/\\n/g, '\n');
  }
  s = s.replace(/^```(?:mermaid|flowchart|graph)?\s*/i, '');
  s = s.replace(/\s*```$/i, '');
  s = s.trim();

  if (!/^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|journey|C4Context)\b/m.test(s)) {
    s = 'flowchart TD\n' + s;
  }
  return s;
}

function ensureMermaid() {
  if (typeof mermaid !== 'undefined') {
    try {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'base',
        flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis' },
        themeVariables: {
          primaryColor: '#eef5f0',
          primaryTextColor: '#1b4332',
          primaryBorderColor: '#84b89b',
          lineColor: '#3d6355',
          secondaryColor: '#f5f7f6',
          tertiaryColor: '#ffffff',
          textColor: '#1a252c',
          mainBkg: '#f8faf9',
          nodeBorder: '#84b89b',
          fontSize: '12px'
        }
      });
    } catch (_) {}
    return Promise.resolve(mermaid);
  }

  return new Promise(function(resolve, reject) {
    var count = 0;
    var timer = setInterval(function() {
      count++;
      if (typeof mermaid !== 'undefined') {
        clearInterval(timer);
        try {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'loose',
            theme: 'base',
            flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis' }
          });
        } catch (_) {}
        resolve(mermaid);
      } else if (count > 25) {
        clearInterval(timer);
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
        s.onload = function() {
          if (typeof mermaid !== 'undefined') {
            try {
              mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'base' });
            } catch (_) {}
            resolve(mermaid);
          } else {
            reject(new Error('Mermaid failed to load'));
          }
        };
        s.onerror = function() { reject(new Error('Could not load Mermaid library from CDN')); };
        document.head.appendChild(s);
      }
    }, 100);
  });
}

// ---- Architecture diagram & Flowchart (Mermaid) -----------------
function createArchitectureDiagramWidget(w) {
  var div = document.createElement('div');
  div.className = 'w-card';
  var diagramId = 'mermaid-' + Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 8);
  var rawSrc = (w.diagram_source || w.mermaidcode || w.mermaidCode || w.mermaid_code || w.diagramSource || w.diagram || w.code || w.source || w.flowchart || '').trim();
  var src = sanitizeMermaidSource(rawSrc);
  var zoomLevel = 1.0;

  div.innerHTML =
    '<div class="w-diagram-container">' +
      '<div class="w-diagram-header">' +
        '<div>' +
          '<div class="w-eyebrow">' + (w.type === 'flowchart' ? 'SYSTEM FLOWCHART' : 'ARCHITECTURE DIAGRAM') + '</div>' +
          '<div class="w-title" style="margin:0;">' + escapeHtml(w.title || 'System Diagram') + '</div>' +
        '</div>' +
        '<div class="w-diagram-toolbar">' +
          '<button class="w-diagram-tool-btn" data-act="zoom-in" title="Zoom In">&#x2B; Zoom In</button>' +
          '<button class="w-diagram-tool-btn" data-act="zoom-out" title="Zoom Out">&#x2212; Zoom Out</button>' +
          '<button class="w-diagram-tool-btn" data-act="reset" title="Reset Zoom">Fit</button>' +
          '<button class="w-diagram-tool-btn" data-act="copy" title="Copy Mermaid Source">&#x2398; Copy</button>' +
          '<button class="w-diagram-tool-btn w-diagram-fullscreen-btn" data-act="fullscreen" title="Toggle Fullscreen (Esc)">&#x26F6; Maximize</button>' +
        '</div>' +
      '</div>' +
      '<button class="w-floating-exit-btn" data-act="fullscreen" title="Exit Fullscreen (Esc)" style="display:none;">&#x2715; Exit Fullscreen</button>' +
      '<div class="w-mermaid-wrap" id="' + diagramId + '">' +
        '<div style="color:var(--muted);font-size:12px;padding:24px 0;display:flex;align-items:center;justify-content:center;gap:8px;">' +
          '<span style="display:inline-block;animation:spin 1s linear infinite;">&#x21BB;</span> Rendering diagram...' +
        '</div>' +
      '</div>' +
      (w.caption ? '<div class="w-diagram-caption">' + escapeHtml(w.caption) + '</div>' : '') +
    '</div>';

  var wrap = div.querySelector('#' + diagramId);
  var floatExitBtn = div.querySelector('.w-floating-exit-btn');
  var fsBtn = div.querySelector('.w-diagram-fullscreen-btn');

  function applyZoom() {
    var svgEl = wrap ? wrap.querySelector('svg') : null;
    if (!svgEl) return;
    if (zoomLevel === 1.0) {
      svgEl.style.width = '100%';
      svgEl.style.maxWidth = '100%';
      wrap.style.overflowX = 'hidden';
      wrap.style.overflowY = 'auto';
    } else {
      svgEl.style.width = Math.round(zoomLevel * 100) + '%';
      svgEl.style.maxWidth = 'none';
      wrap.style.overflowX = 'auto';
      wrap.style.overflowY = 'auto';
    }
  }

  function toggleFullscreen(forceState) {
    var isFs = typeof forceState === 'boolean' ? forceState : !div.classList.contains('is-fullscreen');
    div.classList.toggle('is-fullscreen', isFs);
    document.body.classList.toggle('diagram-fullscreen-open', isFs);

    if (fsBtn) {
      fsBtn.innerHTML = isFs ? '&#x2715; Exit' : '&#x26F6; Maximize';
      fsBtn.classList.toggle('is-active', isFs);
    }
    if (floatExitBtn) {
      floatExitBtn.style.display = isFs ? 'inline-flex' : 'none';
    }

    if (isFs) {
      zoomLevel = 1.35;
    } else {
      zoomLevel = 1.0;
    }
    applyZoom();
  }

  // Keyboard shortcut: Esc to exit fullscreen
  var onKeydown = function(e) {
    if (e.key === 'Escape' && div.classList.contains('is-fullscreen')) {
      toggleFullscreen(false);
    }
  };
  window.addEventListener('keydown', onKeydown);

  // Click on dark backdrop outside modal to exit fullscreen
  div.addEventListener('click', function(e) {
    if (div.classList.contains('is-fullscreen') && e.target === div) {
      toggleFullscreen(false);
    }
  });

  // Floating exit button click
  if (floatExitBtn) {
    floatExitBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleFullscreen(false);
    });
  }

  // Setup toolbar interactions
  div.querySelectorAll('.w-diagram-tool-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var act = btn.dataset.act;
      if (act === 'zoom-in') {
        zoomLevel = Math.min(3.0, Math.round((zoomLevel + 0.25) * 100) / 100);
        applyZoom();
      } else if (act === 'zoom-out') {
        zoomLevel = Math.max(0.5, Math.round((zoomLevel - 0.25) * 100) / 100);
        applyZoom();
      } else if (act === 'reset') {
        zoomLevel = 1.0;
        applyZoom();
      } else if (act === 'fullscreen') {
        toggleFullscreen();
      } else if (act === 'copy') {
        navigator.clipboard.writeText(src).then(function() {
          btn.textContent = 'Copied!';
          setTimeout(function() { btn.innerHTML = '&#x2398; Copy'; }, 1500);
        });
      }
    });
  });

  if (src) {
    (async function renderDiagram() {
      try {
        const m = await ensureMermaid();
        if (!wrap) return;
        var renderId = 'm_' + Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 8);
        const res = await m.render(renderId, src);
        wrap.innerHTML = res.svg;
        var svgEl = wrap.querySelector('svg');
        if (svgEl) {
          svgEl.removeAttribute('height');
          svgEl.style.display = 'block';
          svgEl.style.margin = '0 auto';
        }
        applyZoom();
      } catch (err) {
        console.warn('Mermaid render error:', err);
        if (wrap) {
          wrap.innerHTML =
            '<div style="padding:14px;background:#fdf2f2;border:1px solid #f8d7da;border-radius:8px;text-align:left;width:100%;box-sizing:border-box;">' +
              '<div style="font-weight:600;font-size:12px;color:#721c24;margin-bottom:6px;">Flowchart Render Notice</div>' +
              '<p style="font-size:11px;color:#721c24;margin:0 0 8px 0;">' + escapeHtml(err.message || 'Syntax could not be rendered as SVG') + '</p>' +
              '<pre style="font-size:11px;background:#ffffff;padding:10px;border-radius:6px;border:1px solid #e2e8f0;overflow:auto;max-height:220px;white-space:pre-wrap;color:#2d3748;margin:0;">' + escapeHtml(src) + '</pre>' +
            '</div>';
        }
      }
    })();
  } else {
    // No diagram source returned — clear spinner immediately with an informative message
    if (wrap) {
      wrap.innerHTML =
        '<div style="padding:20px 16px;text-align:center;color:var(--muted,#888);">' +
          '<div style="font-size:28px;margin-bottom:10px;">&#x25A1;</div>' +
          '<div style="font-weight:600;font-size:13px;margin-bottom:6px;color:var(--ink,#222);">No diagram source returned</div>' +
          '<p style="font-size:12px;margin:0;line-height:1.5;">The AI didn\u2019t produce Mermaid DSL this time. Try rephrasing, e.g. <em>\u201cDraw a flowchart of the data pipeline\u201d</em>.</p>' +
        '</div>';
    }
  }
  return div;
}

// ---- Flashcard Deck Widget ---------------------------------------
function createFlashcardDeckWidget(w) {
  var cards = w.cards || [];
  var div = document.createElement('div');
  div.className = 'w-card';
  if (!cards.length) {
    div.innerHTML = '<div class="w-title">' + escapeHtml(w.title || 'Flashcards') + '</div><p class="w-body">No cards in deck.</p>';
    return div;
  }
  var currentCard = 0;
  var isFlipped = false;

  function renderCard() {
    var c = cards[currentCard] || {};
    div.innerHTML =
      '<div class="quiz-top-bar"></div>' +
      '<div class="quiz-counter-row">' +
        '<span class="quiz-counter">Card ' + (currentCard + 1) + ' of ' + cards.length + '</span>' +
        '<span class="quiz-badge">' + escapeHtml(c.tag || 'Flashcard') + '</span>' +
      '</div>' +
      '<div class="w-title" style="margin-bottom:12px;">' + escapeHtml(w.title || 'Concept Flashcards') + '</div>' +
      '<div class="flashcard-box" style="cursor:pointer;padding:24px 18px;border:1.5px solid var(--line);border-radius:12px;background:' + (isFlipped ? '#f0f5f2' : 'var(--soft)') + ';min-height:140px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;margin-bottom:16px;transition:background .15s;">' +
        '<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">' + (isFlipped ? 'Answer / Explanation (Click to flip back)' : 'Prompt / Concept (Click to reveal answer)') + '</div>' +
        '<div style="font-size:15px;font-weight:600;color:var(--ink);line-height:1.5;">' + escapeHtml(isFlipped ? c.back : c.front) + '</div>' +
        (isFlipped && c.citation ? '<div style="font-size:11px;color:var(--sage);font-family:monospace;margin-top:10px;">Source: ' + escapeHtml(c.citation) + '</div>' : '') +
      '</div>' +
      '<div class="quiz-nav">' +
        '<button class="quiz-prev-btn" id="fcPrev" ' + (currentCard === 0 ? 'disabled style="opacity:.4;"' : '') + '>Previous Card</button>' +
        '<button class="quiz-next-btn" id="fcNext">' + (currentCard === cards.length - 1 ? 'Finish' : 'Next Card') + '</button>' +
      '</div>';

    div.querySelector('.flashcard-box').addEventListener('click', function() {
      isFlipped = !isFlipped;
      renderCard();
    });
    div.querySelector('#fcPrev').addEventListener('click', function() {
      if (currentCard > 0) { currentCard--; isFlipped = false; renderCard(); }
    });
    div.querySelector('#fcNext').addEventListener('click', function() {
      if (currentCard < cards.length - 1) { currentCard++; isFlipped = false; renderCard(); }
      else {
        div.innerHTML =
          '<div class="quiz-top-bar"></div>' +
          '<div style="text-align:center;padding:24px;">' +
            '<div style="font-size:32px;margin-bottom:8px;">&#x2714;</div>' +
            '<div class="w-title">Deck Completed!</div>' +
            '<p class="w-body" style="margin-top:6px;">You reviewed all ' + cards.length + ' cards in this deck.</p>' +
            '<button class="quiz-next-btn" style="margin:14px auto 0;display:block;" id="fcRestart">Review Again</button>' +
          '</div>';
        div.querySelector('#fcRestart').addEventListener('click', function() {
          currentCard = 0; isFlipped = false; renderCard();
        });
      }
    });
  }

  renderCard();
  return div;
}

// ---- Tutorial Steps Widget ---------------------------------------
function createTutorialStepsWidget(w) {
  var steps = w.steps || w.modules || [];
  var div = document.createElement('div');
  div.className = 'w-card';
  var stepsHtml = steps.map(function(s, idx) {
    return '<div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--line);">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
        '<span style="width:22px;height:22px;border-radius:50%;background:var(--dark);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">' + (s.step_number || idx + 1) + '</span>' +
        '<strong style="font-size:14px;color:var(--ink);">' + escapeHtml(s.title || s.module_title || ('Step ' + (idx + 1))) + '</strong>' +
      '</div>' +
      '<p style="font-size:13px;color:var(--muted);line-height:1.5;margin-left:30px;">' + escapeHtml(s.instructions || s.description || '') + '</p>' +
      (s.code ? '<div class="w-code-block" style="margin-top:8px;margin-left:30px;"><pre style="padding:10px;font-size:12px;font-family:monospace;overflow:auto;margin:0;">' + escapeHtml(s.code) + '</pre></div>' : '') +
    '</div>';
  }).join('');

  div.innerHTML =
    '<div class="w-eyebrow">TUTORIAL WALKTHROUGH</div>' +
    '<div class="w-title">' + escapeHtml(w.title || 'Developer Walkthrough') + '</div>' +
    (w.prerequisites && w.prerequisites.length ? '<div style="font-size:12px;color:var(--muted);margin:8px 0 14px;padding:8px 12px;background:var(--soft);border-radius:6px;"><strong>Prerequisites:</strong> ' + escapeHtml(w.prerequisites.join(', ')) + '</div>' : '') +
    '<div style="margin-top:14px;">' + stepsHtml + '</div>';
  return div;
}


// ---- Documentation proposal widget -------------------------------
function createDocProposalWidget(w) {
  var div = document.createElement('div');
  div.className = 'w-card';
  var propId = w.proposal_id || w.id || ('prop-' + Math.random().toString(36).slice(2, 8));
  var title = w.pr_title || w.title || 'Documentation Proposal';
  var target = w.target_file || w.filePath || 'README.md';
  var rationale = w.rationale || w.summary || '';
  var diff = w.diff_markdown || '';

  var diffLines = diff.split(/\r?\n/).map(function(line) {
    var cls = '';
    if (line.startsWith('+')) cls = 'color:#1a7f37;background:#dafbe1;';
    else if (line.startsWith('-')) cls = 'color:#cf222e;background:#ffebe9;';
    else if (line.startsWith('@')) cls = 'color:#8250df;background:#f6f8fa;font-weight:600;';
    return '<div style="font-family:monospace;font-size:11.5px;padding:1px 6px;' + cls + '">' + escapeHtml(line) + '</div>';
  }).join('');

  div.innerHTML =
    '<div class="w-eyebrow">DOCUMENTATION PROPOSAL</div>' +
    '<div class="w-title" style="margin-bottom:6px;">' + escapeHtml(title) + '</div>' +
    '<div style="font-size:12px;color:var(--sage);font-family:monospace;margin-bottom:12px;">Target file: ' + escapeHtml(target) + '</div>' +
    (rationale ? '<div class="w-body" style="margin-bottom:14px;background:var(--soft);padding:10px 14px;border-radius:8px;border:1px solid var(--line);">' + renderMarkdown(rationale) + '</div>' : '') +
    (diff ? '<div style="background:#f6f8fa;border:1px solid var(--line);border-radius:8px;padding:10px;overflow:auto;max-height:240px;margin-bottom:16px;">' + diffLines + '</div>' : '') +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
      '<button class="pending-accept-btn" id="propAccept-' + propId + '">Accept &amp; Commit</button>' +
      '<button class="pending-reject-btn" id="propReject-' + propId + '">Reject</button>' +
    '</div>';

  var acceptBtn = div.querySelector('#propAccept-' + propId);
  var rejectBtn = div.querySelector('#propReject-' + propId);

  acceptBtn.addEventListener('click', function() {
    acceptBtn.textContent = 'Committing...';
    acceptBtn.disabled = true;
    fetch('/api/docs/proposals/' + propId + '/approve', { method: 'POST' })
      .then(function() {
        acceptBtn.textContent = 'Committed';
        div.style.opacity = '0.7';
      })
      .catch(function() {
        acceptBtn.textContent = 'Accept & Commit';
        acceptBtn.disabled = false;
      });
  });

  rejectBtn.addEventListener('click', function() {
    rejectBtn.textContent = 'Rejected';
    rejectBtn.disabled = true;
    fetch('/api/docs/proposals/' + propId + '/reject', { method: 'POST' })
      .then(function() { div.style.opacity = '0.5'; });
  });

  return div;
}

// ---- Alert card widget -------------------------------------------
function createAlertCardWidget(w) {
  var div = document.createElement('div');
  div.className = 'w-card';
  var severity = (w.severity || 'info').toLowerCase();
  var bg = '#f0f5f2';
  var border = 'var(--sage)';
  var icon = '&#x2139;';

  if (severity === 'error') {
    bg = '#fdf0ee'; border = '#c0392b'; icon = '&#x26A0;';
  } else if (severity === 'warning') {
    bg = '#fef9e7'; border = '#d4ac0d'; icon = '&#x26A0;';
  } else if (severity === 'success') {
    bg = '#e8f4ee'; border = 'var(--sage)'; icon = '&#x2714;';
  }

  div.style.background = bg;
  div.style.borderColor = border;
  div.innerHTML =
    '<div style="display:flex;align-items:flex-start;gap:10px;">' +
      '<div style="font-size:18px;line-height:1;margin-top:2px;">' + icon + '</div>' +
      '<div>' +
        '<strong style="font-size:14px;color:var(--ink);display:block;margin-bottom:4px;">' + escapeHtml(w.title || 'Notice') + '</strong>' +
        '<p style="font-size:13px;color:var(--ink);margin:0;line-height:1.5;">' + escapeHtml(w.message || w.text || '') + '</p>' +
      '</div>' +
    '</div>';
  return div;
}

// ---- Composite dashboard ---------------------------------------
function createCompositeDashboardWidget(w) {
  var div = document.createElement('div');
  div.className = 'w-composite';
  var components = w.components || [];
  if (w.title || w.description) {
    var header = document.createElement('div');
    header.className = 'w-card';
    header.innerHTML =
      '<div class="w-title">' + escapeHtml(w.title || '') + '</div>' +
      (w.description ? '<div class="w-body">' + escapeHtml(w.description) + '</div>' : '');
    div.appendChild(header);
  }
  components.forEach(function(c) {
    var el = createWidget(c);
    if (el) div.appendChild(el);
  });
  return div;
}



// ---- Canvas scroll helper ----------------------------------------
function scrollCanvasToTop() {
  toggleCanvas(true);
  var preview = document.getElementById('canvasPreview');
  if (preview) {
    preview.scrollTop = 0;
    var panel = document.getElementById('canvasPanel');
    if (panel) {
      panel.style.transition = 'box-shadow 0.3s ease';
      panel.style.boxShadow = 'inset 0 0 0 2px var(--sage)';
      setTimeout(function() { panel.style.boxShadow = 'none'; }, 1000);
    }
  }
}

// ---- Quiz widget renderer ----------------------------------------
function resolveQuizCorrectIndex(q) {
  if (!q || typeof q !== 'object') return 0;
  var opts = q.options || [];
  var raw = q.correct_index !== undefined ? q.correct_index :
    (q.correctIndex !== undefined ? q.correctIndex :
    (q.correct_option !== undefined ? q.correct_option :
    (q.correctOption !== undefined ? q.correctOption :
    (q.correct_answer !== undefined ? q.correct_answer :
    (q.correctAnswer !== undefined ? q.correctAnswer :
    (q.answer_index !== undefined ? q.answer_index :
    (q.answerIndex !== undefined ? q.answerIndex :
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

  var letterMatch = str.match(/(?:option\s+|^)([A-E])(?:\b|[\.\:\s\)])/i);
  if (letterMatch) {
    var idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && (opts.length === 0 || idx < opts.length)) return idx;
  }

  var lowerStr = str.toLowerCase();
  for (var i = 0; i < opts.length; i++) {
    var optText = typeof opts[i] === 'string' ? opts[i] : (opts[i].text || opts[i].label || String(opts[i]));
    var cleanOpt = optText.replace(/^[A-E][\.\)\:\s]\s*/i, '').trim().toLowerCase();
    if (cleanOpt && (cleanOpt === lowerStr || lowerStr.includes(cleanOpt) || cleanOpt.includes(lowerStr))) {
      return i;
    }
  }

  return 0;
}

function createQuizWidget(w) {
  var rawQuestions = Array.isArray(w.questions) && w.questions.length ? w.questions : [w];
  var questions = rawQuestions.map(function(item) {
    var opts = Array.isArray(item.options) ? item.options : [];
    return {
      question: item.question || item.text || item.title || '',
      options: opts,
      correct_index: resolveQuizCorrectIndex(item),
      explanation: item.explanation || item.rationale || ''
    };
  });
  var total = questions.length || 1;
  var currentQ = 0;
  var selections = {};  // questionIndex -> selectedOptionIndex
  var LETTERS = ['A', 'B', 'C', 'D', 'E'];

  var wrap = document.createElement('div');
  wrap.className = 'w-quiz';

  function renderQuestion() {
    var q = questions[currentQ] || {};
    var opts = q.options || [];
    var selected = selections[currentQ];
    var revealed = selected !== undefined;
    var correctIdx = q.correct_index;

    var optionsHtml = opts.map(function(opt, i) {
      var letter = LETTERS[i] || String(i + 1);
      var rawText = typeof opt === 'string' ? opt : (opt.text || opt.label || String(opt));
      var text = rawText.replace(/^[A-E][\.\)\:\s]\s*/, '');
      var cls = 'quiz-option';
      if (revealed) {
        if (i === selected && i === correctIdx) cls += ' correct selected';
        else if (i === selected) cls += ' wrong selected';
        else if (i === correctIdx) cls += ' correct';
      }
      return '<button class="' + cls + '" data-idx="' + i + '">' +
        '<span class="quiz-opt-letter">' + letter + '</span>' +
        '<span class="quiz-opt-text">' + escapeHtml(text) + '</span>' +
        '<span class="quiz-radio">' + (revealed ? (i === correctIdx ? '&#x2714;' : (i === selected ? '&#x2715;' : '')) : '') + '</span>' +
      '</button>';
    }).join('');

    var feedbackHtml = '';
    if (revealed && q.explanation) {
      var isCorrect = selected === correctIdx;
      feedbackHtml = '<div class="quiz-feedback show ' + (isCorrect ? 'correct-fb' : 'wrong-fb') + '">' +
        (isCorrect ? '<strong>Correct!</strong> ' : '<strong>Not quite.</strong> ') +
        escapeHtml(q.explanation) + '</div>';
    }

    wrap.innerHTML =
      '<div class="quiz-card">' +
        '<div class="quiz-top-bar"></div>' +
        '<div class="quiz-counter-row">' +
          '<span class="quiz-counter">' + (currentQ + 1) + ' of ' + total + ' quizzes</span>' +
          '<span class="quiz-badge">Quiz</span>' +
        '</div>' +
        '<div class="quiz-question">' + escapeHtml(q.question || '') + '</div>' +
        '<div class="quiz-instruction">Choose one answer</div>' +
        '<div class="quiz-options">' + optionsHtml + '</div>' +
        feedbackHtml +
        '<div class="quiz-nav">' +
          '<button class="quiz-prev-btn" id="quizPrev" ' + (currentQ === 0 ? 'disabled style="opacity:.4;"' : '') + '>Previous Question</button>' +
          '<button class="quiz-next-btn" id="quizNext">' + (currentQ === total - 1 ? 'Finish' : 'Next Question') + '</button>' +
        '</div>' +
      '</div>';

    // Option click handlers
    wrap.querySelectorAll('.quiz-option').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (selections[currentQ] !== undefined) return; // already answered
        selections[currentQ] = parseInt(btn.dataset.idx, 10);
        renderQuestion();
      });
    });

    wrap.querySelector('#quizPrev').addEventListener('click', function() {
      if (currentQ > 0) { currentQ--; renderQuestion(); }
    });

    wrap.querySelector('#quizNext').addEventListener('click', function() {
      if (currentQ < total - 1) { currentQ++; renderQuestion(); }
      else {
        // Show score summary
        var correctCount = Object.entries(selections).filter(function(e) {
          var qObj = questions[e[0]];
          return qObj && parseInt(e[1], 10) === qObj.correct_index;
        }).length;
        wrap.innerHTML = '<div class="quiz-card" style="text-align:center;padding:32px 20px;">' +
          '<div class="quiz-top-bar" style="margin:0 auto 16px;"></div>' +
          '<div style="font-size:32px;margin-bottom:8px;">&#x1F3C6;</div>' +
          '<div class="quiz-question" style="font-size:20px;">Quiz complete!</div>' +
          '<div class="quiz-instruction" style="margin-bottom:16px;">You got ' + correctCount + ' of ' + total + ' correct.</div>' +
          '<button class="quiz-next-btn" style="margin:0 auto;display:block;" id="quizRestart">Restart Quiz</button>' +
        '</div>';
        wrap.querySelector('#quizRestart').addEventListener('click', function() {
          currentQ = 0; selections = {}; renderQuestion();
        });
      }
    });
  }

  renderQuestion();
  return wrap;
}
/* ================================================================
   PATCH renderCanvas to use widget renderer
   ================================================================ */

// Override the old renderCanvas function
renderCanvas = function(type, widgets) {
  canvasPreview.innerHTML = '';
  if (!widgets || widgets.length === 0) {
    // Show a plain card
    var card = document.createElement('div');
    card.className = 'w-card';
    card.innerHTML = '<strong class="w-title">' + (type === 'summary' ? 'Project summary' : 'Database schema') + '</strong><p class="w-body" style="margin-top:6px;">No structured widget data returned.</p>';
    canvasPreview.appendChild(card);
    return;
  }
  widgets.forEach(function(w) {
    var el = createWidget(w);
    if (el) canvasPreview.appendChild(el);
  });
};

/* ================================================================
   COMPONENT GALLERY -- demo fixtures
   ================================================================ */

var DEMO_FIXTURES = {
  audio: {
    type: 'audio_player',
    title: 'DataFlow Audio overview',
    subtitle: 'A concise summary of how data flows through the system',
    duration_seconds: 270,
    elapsed_seconds: 102
  },
  overview: {
    type: 'overview',
    label: 'OVERVIEW',
    title: 'Platform architecture',
    subtitle: 'A modular service architecture built for reliable project intelligence',
    reviewed_at: '18 Sep 2026',
    body: 'TRACiE turns connected code repositories into searchable technical knowledge. Client applications call a stateless service layer, while asynchronous workers index source files and keep documentation current without interrupting the core experience.',
    layers: [
      { tag: 'INTERFACE',   name: 'Client applications',        description: 'React web app and native mobile clients' },
      { tag: 'LOGIC',       name: 'Application services',       description: 'REST API, authentication, and background workers' },
      { tag: 'FOUNDATION',  name: 'Data & infrastructure',      description: 'PostgreSQL, Redis cache, and object storage' }
    ]
  },
  glossary: {
    type: 'glossary',
    label: 'GLOSSARY',
    title: 'Architecture terms',
    subtitle: 'Compact definitions for recurring concepts.',
    terms: [
      { term: 'API gateway',   definition: 'The single entry point that routes client requests to internal services.' },
      { term: 'Event bus',     definition: 'A channel that lets services publish and consume asynchronous events.' },
      { term: 'Idempotency',   definition: 'The guarantee that retrying an operation produces no extra side effects.' },
      { term: 'Read replica',  definition: 'A database copy optimised for queries without burdening the primary.' }
    ]
  },
  definition: {
    type: 'definition',
    label: 'DEFINITION',
    path: '/service boundary/',
    term: 'Service boundary',
    part_of_speech: 'NOUN',
    category: 'ARCHITECTURE',
    definition: 'A deliberate division of responsibility where a component owns its data and behavior, exposing only a stable contract to the rest of the system.'
  },
  faq: {
    type: 'faq',
    label: 'FREQUENTLY ASKED QUESTIONS',
    title: 'Questions teams ask',
    subtitle: 'Short answers for architecture reviews and onboarding.',
    items: [
      { question: 'Why separate the API from workers?',      answer: 'User requests remain fast while indexing and analysis run safely in the background.' },
      { question: 'Where is access enforced?',              answer: 'The gateway validates identity; each service still checks repository-level authorisation.' },
      { question: 'How does the platform recover?',         answer: 'Durable queues retry transient failures and move exhausted jobs to a review queue.' }
    ]
  },
  directory_tree: {
    type: 'directory_tree',
    label: 'DIRECTORY TREE',
    path: 'repository/backend/auth/session.ts'
  },
  quiz: {
    type: 'quiz',
    questions: [
      {
        question: 'Which database type organizes data into tables with rows and columns?',
        options: ['Relational database', 'Document database', 'Graph database', 'Key-value store'],
        correct_index: 0,
        explanation: 'Relational databases organize data in tables with rows and columns and use SQL for queries.'
      },
      {
        question: 'Which HTTP method is typically used to update an existing resource?',
        options: ['GET', 'POST', 'PUT', 'DELETE'],
        correct_index: 2,
        explanation: 'PUT replaces an existing resource entirely. PATCH is used for partial updates.'
      },
      {
        question: 'What does REST stand for?',
        options: ['Remote Execution State Transfer', 'Representational State Transfer', 'Resource Endpoint State Transfer', 'Relational Event State Transport'],
        correct_index: 1,
        explanation: 'REST stands for Representational State Transfer, an architectural style for distributed hypermedia systems.'
      }
    ]
  },
  code_snippet: {
    type: 'code_snippet',
    file_path: 'session.ts',
    language: 'TypeScript',
    start_line: 1,
    code: 'interface Session {\n  id: string;\n  userId: string;\n  expiresAt: Date;\n}\n\nfunction createSession(userId: string): Session {\n  return {\n    id: crypto.randomUUID(),\n    userId,\n    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)\n  };\n}'
  },
  flashcards: {
    type: 'flashcard_deck',
    title: 'TRACiE Core Concepts Flashcards',
    description: 'Key architectural mechanisms in the TRACiE platform',
    cards: [
      {
        id: 'fc-1',
        tag: 'Architecture',
        front: 'What role does the Supervisor Agent play in TRACiE?',
        back: 'The Supervisor Agent analyzes incoming user intent and autonomously delegates tasks to specialized subagents using the IBM BeeAI pattern.',
        citation: 'src/services/agents/supervisor.js'
      },
      {
        id: 'fc-2',
        tag: 'Vector DB',
        front: 'How are code chunks stored and retrieved in TRACiE?',
        back: 'Source files are chunked via Tree-sitter and stored with dense embeddings in ChromaDB for ANN semantic similarity search.',
        citation: 'src/services/rag/retriever.js'
      },
      {
        id: 'fc-3',
        tag: 'Audio TTS',
        front: 'Which engine powers the hyper-realistic studio audio briefings?',
        back: 'ElevenLabs Turbo v2.5 powers studio-grade text-to-speech, returning playable MP3 data streams directly into the audio player widget.',
        citation: 'src/services/audio/ttsService.js'
      }
    ]
  },
  tutorial: {
    type: 'tutorial_steps',
    title: 'Connecting a Codebase to TRACiE',
    prerequisites: ['Node.js v24', 'PostgreSQL running', 'ChromaDB running on port 8000'],
    steps: [
      {
        step_number: 1,
        title: 'Enter Repository URL',
        instructions: 'Paste your public or authenticated GitHub repository URL into the Connect Repository card in the sidebar.'
      },
      {
        step_number: 2,
        title: 'Trigger Automated Ingestion',
        instructions: 'Click Connect Codebase. The worker will clone the repository, generate AST chunks via Tree-sitter, and store embeddings in ChromaDB.'
      },
      {
        step_number: 3,
        title: 'Ask Questions in Natural Language',
        instructions: 'Query the assistant for architecture diagrams, interactive quizzes, or code walkthroughs grounded in your codebase.',
        code: "curl -X POST http://localhost:3000/api/query -H \"Content-Type: application/json\" -d '{\"query\": \"Explain the architecture\"}'"
      }
    ]
  }
};

// Expose to the gallery view - attach demo buttons
function attachGalleryDemos() {
  var gallery = document.getElementById('galleryView');
  if (!gallery) return;
  var grid = gallery.querySelector('.widget-grid');
  if (!grid) return;

  // Replace static gallery with live demos
  grid.innerHTML = '';

  var demos = [
    { key: 'audio',          label: 'Audio overview',          icon: '&#x25C9;' },
    { key: 'overview',       label: 'Platform architecture',   icon: '&#x1F5FA;' },
    { key: 'glossary',       label: 'Architecture terms',      icon: '&#x1F4D6;' },
    { key: 'definition',     label: 'Service boundary',        icon: '&#x25A1;' },
    { key: 'faq',            label: 'Questions teams ask',     icon: '?' },
    { key: 'directory_tree', label: 'Directory tree',          icon: '&#x1F4C1;' },
    { key: 'code_snippet',   label: 'Code snippet',            icon: '&lt;/&gt;' },
    { key: 'quiz',            label: 'Quiz widget',             icon: '&#x270E;' },
    { key: 'flashcards',      label: 'Flashcard deck',          icon: '&#x25A4;' },
    { key: 'tutorial',        label: 'Tutorial walkthrough',    icon: '&#x1F4D6;' }
  ];

  demos.forEach(function(d) {
    var card = document.createElement('div');
    card.className = 'widget-spec';
    card.style.cursor = 'pointer';
    card.innerHTML =
      '<div class="widget-label">' + d.label + '</div>' +
      '<div class="preview-icon" style="font-size:28px;margin:12px 0;color:var(--sage);">' + d.icon + '</div>' +
      '<p style="font-size:12px;color:var(--muted);">Click to preview this widget in the canvas</p>' +
      '<button style="margin-top:10px;padding:6px 14px;background:var(--dark);color:#fff;border-radius:6px;font-size:12px;">Open in Canvas</button>';
    card.addEventListener('click', function() {
      // Switch to chat/canvas mode and render the demo widget
      state.sent = true;
      state.canvasType = d.key;
      setView('chat');
      modeChat.classList.add('active');
      modePending.classList.remove('active');
      setNavActive(navNewChat);
      canvasTitle.textContent = d.label + ' (demo)';
      renderWidgetIntoCanvas(DEMO_FIXTURES[d.key]);
      // Add a message
      state.messages = [{ role: 'assistant', text: 'Previewing the ' + d.label + ' widget.' }];
      renderMessages();
    });
    grid.appendChild(card);
  });
}

// Attach gallery demos when gallery is opened
var origNavGallery = navGallery.onclick;
navGallery.addEventListener('click', function() {
  setTimeout(attachGalleryDemos, 0);
});

// Load persistent sidebar chat history on startup
loadSidebarHistory();

// ── GitHub OAuth Session ──────────────────────────────────────────────────
(function initGithubAuth() {
  var notify = typeof showPendingNotification === 'function' ? showPendingNotification : function(msg, tone) { console.log('[Auth ' + (tone || 'info') + ']', msg); };
  var loginBtn     = document.getElementById('githubLoginBtn');
  var profileRow   = document.getElementById('githubProfileRow');
  var avatarImg    = document.getElementById('githubAvatar');
  var usernameEl   = document.getElementById('githubUsername');
  var logoutBtn    = document.getElementById('githubLogoutBtn');

  function showLoggedIn(user) {
    if (loginBtn)   loginBtn.style.display   = 'none';
    if (profileRow) profileRow.style.display = 'flex';
    if (avatarImg)  { avatarImg.src = user.avatarUrl || ''; avatarImg.alt = user.login + ' avatar'; }
    if (usernameEl) usernameEl.textContent = user.name || user.login;
    // Store in state so other parts of the app can read it
    state.githubUser = user;
  }

  function showLoggedOut() {
    if (loginBtn)   loginBtn.style.display   = 'flex';
    if (profileRow) profileRow.style.display = 'none';
    state.githubUser = null;
  }

  // Check existing session
  fetch('/auth/me', { credentials: 'include' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.authenticated) {
        showLoggedIn(data);
      } else {
        showLoggedOut();
      }
    })
    .catch(function() { showLoggedOut(); });

  // Logout handler
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      fetch('/auth/logout', { method: 'POST', credentials: 'include' })
        .then(function() { showLoggedOut(); notify('Signed out from GitHub.', 'info'); })
        .catch(function() {});
    });
  }

  // Show welcome toast if redirected back after OAuth login
  var urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('gh_login') === '1') {
    // Clean up the URL without reloading
    var cleanUrl = window.location.pathname + window.location.search.replace(/[?&]gh_login=1/, '').replace(/^&/, '?');
    history.replaceState(null, '', cleanUrl || '/');
    // Wait for /auth/me to resolve, then show notification
    setTimeout(function() {
      if (state.githubUser) {
        notify('Signed in as @' + (state.githubUser.login || state.githubUser.name) + '. You can now commit doc proposals directly!', 'success');
      }
    }, 800);
  }
})();

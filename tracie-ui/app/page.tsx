'use client'

import { useState } from 'react'

const history = [
  { group: 'Today', items: ['Auth workflow guide', 'Compare index.html to SRS', 'Outline system data flow'] },
  { group: 'Last 7 days', items: ['Code notation in consistencies', 'Outline system architecture', 'Explain API references', 'Up-to-date project summary'] },
]

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>
}

export default function Page() {
  const [dark, setDark] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [query, setQuery] = useState('')
  const [connected, setConnected] = useState<string[]>([])
  const [repoInput, setRepoInput] = useState('')
  const [sent, setSent] = useState(false)
  const [practiceOpen, setPracticeOpen] = useState(false)
  const [practiceTag, setPracticeTag] = useState('')
  const [pendingDocs, setPendingDocs] = useState(false)
  const [canvasType, setCanvasType] = useState<'schema' | 'summary' | null>(null)
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null)
  const [isQuerying, setIsQuerying] = useState(false)
  const [apiError, setApiError] = useState('')
  const [apiWidgets, setApiWidgets] = useState<unknown[]>([])

  function newChat() {
    setQuery('')
    setSent(false)
    setCanvasType(null)
    setMessages([])
    setPracticeTag('')
    setGalleryOpen(false)
    setSelectedWidget(null)
    setApiWidgets([])
    setApiError('')
  }

  async function sendMessage(nextQuery = query, nextCanvasType: 'schema' | 'summary' | null = canvasType) {
    const text = nextQuery.trim()
    if (!text || isQuerying) return
    setQuery(text)
    setSent(true)
    setCanvasType(nextCanvasType)
    setApiError('')
    setIsQuerying(true)
    setMessages([{ role: 'user', text }])
    try {
      const response = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: text, repoId: connected[0] || 'TRACiE', sessionId: 'tracie-session' }) })
      if (!response.ok) throw new Error(`Query failed (${response.status})`)
      const payload = await response.json() as { widgets?: unknown[]; widget?: unknown; answer?: string; message?: string }
      const widgets = payload.widgets || (payload.widget ? [payload.widget] : [])
      setApiWidgets(widgets)
      setMessages((current) => [...current, { role: 'assistant', text: payload.answer || payload.message || 'I found the relevant project information and opened it in the canvas. Review the referenced output on the right.' }])
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Unable to reach the Tracy API.')
      setMessages((current) => [...current, { role: 'assistant', text: 'The request is ready, but the Tracy API could not be reached. Check that the API server is running and try again.' }])
    } finally {
      setIsQuerying(false)
    }
  }

  function runSuggestion(type: 'schema' | 'summary') {
    const text = type === 'schema' ? 'Get me a database schema of the project' : 'Draft a project summary of the project'
    sendMessage(text, type)
  }

  function connectRepository() {
    const value = repoInput.trim()
    if (value && !connected.includes(value)) setConnected([...connected, value])
    setRepoInput('')
  }

  return (
    <main className={`tracy-shell ${dark ? 'theme-dark' : ''} ${collapsed ? 'sidebar-collapsed' : ''} ${pendingDocs ? 'pending-view' : ''}`}>
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">✣</div>
          <div className="brand-name">TRACiE</div>
          <button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? '›' : '‹'}</button>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          <button className={`nav-item ${!galleryOpen && !pendingDocs ? 'active' : ''}`} onClick={newChat} aria-label="New chat"><Icon>✎</Icon><span>New chat</span></button>
          <button className="nav-item" onClick={() => { setSearchOpen(true); setProfileOpen(false) }} aria-label="Search"><Icon>⌕</Icon><span>Search</span></button>
          <button className={`nav-item ${galleryOpen ? 'active' : ''}`} onClick={() => { setGalleryOpen(true); setPendingDocs(false); setCollapsed(false); setSelectedWidget(null) }} aria-label="Component Gallery"><Icon>▥</Icon><span>Component Gallery</span></button>
        </nav>

        <section className="repository-card" aria-label="Connect repository">
          <h2>Connect Repository</h2>
          <div className="repo-input"><span>♣</span><input value={repoInput} onChange={(event) => setRepoInput(event.target.value)} placeholder="https://github.com/example" aria-label="Repository URL or name" /></div>
          <button className="dark-button" onClick={connectRepository}>Connect Codebase</button>
          {connected.length > 0 && <div className="connected-repositories"><span className="connected-label">Connected repositories</span>{connected.map((repo) => <div className="connected-repo" key={repo}><span>{repo}</span><button onClick={() => setConnected(connected.filter((item) => item !== repo))} aria-label={`Disconnect ${repo}`}>×</button></div>)}</div>}
        </section>

        <div className="history">
          {history.map((section, sectionIndex) => (
            <section key={section.group} className="history-section">
              <div className="section-label">{section.group}</div>
              {section.items.map((item, index) => (
                <button key={item} className={`history-item ${sectionIndex === 0 && index === 0 ? 'selected' : ''}`}>
                  <span>{item}</span>{sectionIndex === 0 && index === 0 && <span className="more">•••</span>}
                </button>
              ))}
            </section>
          ))}
        </div>

        <div className="sidebar-bottom">
          <button className="settings-link" onClick={() => setSettingsOpen(!settingsOpen)}><Icon>⚙</Icon><span>Settings</span></button>
          {settingsOpen && <div className="settings-panel"><span>Appearance</span><label className="toggle-row"><span>Dark mode</span><input type="checkbox" checked={dark} onChange={(event) => setDark(event.target.checked)} /><span className="toggle" /></label></div>}
          <button className="profile" onClick={() => { setProfileOpen(!profileOpen); setSearchOpen(false) }} aria-expanded={profileOpen} aria-label="Open profile details"><div className="avatar" /><div><strong>Alex Morgan</strong><span>Free Workspace</span></div><span className="profile-more">•••</span></button>
          {profileOpen && <div className="profile-popover" role="dialog" aria-label="Profile details"><div className="popover-heading"><div className="avatar large" /><div><strong>Alex Morgan</strong><span>Free Workspace</span></div></div><dl><div><dt>Email</dt><dd>alex.morgan@example.com</dd></div><div><dt>Plan</dt><dd>Free workspace</dd></div><div><dt>Member since</dt><dd>September 2026</dd></div></dl></div>}
        </div>
      </aside>

      {searchOpen && <div className="search-popover" role="dialog" aria-label="Search recent chats"><div className="search-heading"><div><strong>Search</strong><span>Find chats and recent activity</span></div><button onClick={() => setSearchOpen(false)} aria-label="Close search">×</button></div><label className="search-field"><Icon>⌕</Icon><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search recent chats..." /></label><div className="search-results">{history.flatMap((section) => section.items.map((item) => ({ item, group: section.group }))).filter(({ item }) => item.toLowerCase().includes(searchQuery.toLowerCase())).map(({ item, group }) => <button className="search-result" key={item}><span>{item}</span><small>{group}</small></button>)}{history.flatMap((section) => section.items).filter((item) => item.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && <p className="empty-search">No matching activity found.</p>}</div></div>}

      <section className="workspace">
        <header className="topbar"><div className="mode-switch"><button className={`mode-button ${!pendingDocs && !galleryOpen ? 'active' : ''}`} onClick={() => { setPendingDocs(false); setCollapsed(false); setGalleryOpen(false) }}>Chat and Canvas</button><button className={`mode-button ${pendingDocs ? 'active' : ''}`} onClick={() => { setPendingDocs(true); setCollapsed(true); setGalleryOpen(false) }}>Pending Docs</button></div></header>
        {galleryOpen ? <div className="gallery-page"><div className="gallery-intro"><span className="eyebrow">TRACiE COMPONENT LIBRARY</span><h1>Component Gallery</h1><p>Default widget forms rendered from the project intelligence system.</p></div><div className="widget-grid"><button className="widget-spec audio-spec" onClick={() => setSelectedWidget('Audio overview')}><span className="widget-label">AUDIO OVERVIEW</span><h2>DataFlow Audio overview</h2><p>A concise summary of how data flows through the system</p><div className="audio-bar"><i /></div><div className="widget-meta"><span>01:42 / 04:30</span><strong>▶ Play</strong></div></button><button className="widget-spec quiz-spec" onClick={() => setSelectedWidget('Quiz')}><span className="widget-label">QUIZ</span><h2>Which database type organizes data into tables?</h2><p>Choose one answer</p><div className="option-row"><b>A</b><span>Relational database</span><i /></div><div className="option-row"><b>B</b><span>Document database</span><i /></div></button><button className="widget-spec flashcard-spec" onClick={() => setSelectedWidget('Flashcard')}><span className="widget-label">FLASHCARD</span><small>1 of 20 flashcards</small><h2>NFR</h2><p>What does this abbreviation mean in SRS?</p><div className="flashcard-prompt">Click to flip</div></button><button className="widget-spec code-spec" onClick={() => setSelectedWidget('Code exercise')}><span className="widget-label">CODE EXERCISE</span><small>1 of 10 code exercises</small><h2>What is the essence of this file?</h2><div className="code-block"><span>session.ts</span><code>interface Session {'{'}<br />  id: string;<br />  userId: string;<br />{'}'}</code></div><strong className="code-cta">Code review</strong></button><button className="widget-spec architecture-spec" onClick={() => setSelectedWidget('Architecture overview')}><span className="widget-label">OVERVIEW</span><h2>Platform architecture</h2><p>A modular service architecture built for reliable project intelligence</p><div className="architecture-row"><span>Client applications</span><span>Application services</span><span>Data &amp; infrastructure</span></div></button><button className="widget-spec diagram-spec" onClick={() => setSelectedWidget('Architecture diagrams')}><span className="widget-label">ARCHITECTURE FLOWCHART</span><h2>Request Lifecycle</h2><div className="flow-row"><span>Browser</span><b>→</b><span>API Gateway</span><b>→</b><span>App Service</span><b>→</b><span>PostgreSQL</span></div></button><button className="widget-spec content-spec" onClick={() => setSelectedWidget('Content and guidance')}><span className="widget-label">GLOSSARY</span><h2>Architecture terms</h2><p>Compact definitions for recurring concepts.</p><hr /><strong>API gateway</strong><span>The single entry point that routes client requests.</span><hr /><strong>Event bus</strong><span>A channel that lets services publish and consume events.</span></button><button className="widget-spec schema-spec" onClick={() => setSelectedWidget('Database schema')}><span className="widget-label">DATABASE SCHEMA</span><h2>atlas_db - Table Definitions</h2><div className="table-row"><span>users</span><span>repositories</span><span>commits</span></div><div className="table-lines" /></button></div>{selectedWidget && <div className="widget-modal-backdrop" onClick={() => setSelectedWidget(null)}><section className="widget-modal" role="dialog" aria-modal="true" aria-label={`${selectedWidget} explanation`} onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedWidget(null)} aria-label="Close widget explanation">×</button><span className="eyebrow">WIDGET EXPLANATION</span><h2>{selectedWidget}</h2><p>{selectedWidget === 'Audio overview' ? 'A compact playback widget for listening to an AI-generated overview of project data flow.' : selectedWidget === 'Quiz' ? 'A multiple-choice learning widget for checking understanding of project concepts.' : selectedWidget === 'Flashcard' ? 'A study widget that presents a prompt and its related definition for review.' : selectedWidget === 'Code exercise' ? 'A focused review widget for answering questions about a source file.' : 'A structured project intelligence widget for exploring architecture, content, diagrams, or schema details.'}</p><button className="dark-button" onClick={() => setSelectedWidget(null)}>Close</button></section></div>} </div> : pendingDocs ? <div className="docs-content"><article className="doc-card"><div className="doc-title"><div><h2>Update 1</h2><span>Document: Q3 Planning Deck</span></div><span className="doc-icon">▤</span></div><div className="doc-preview"><small>Update</small><p>Added new launch milestones, updated the pricing table, and refined the executive summary for the next review cycle.</p></div><button className="view-update">View update</button><div className="doc-actions"><button className="dark-button">Accept &amp; Commit</button><button className="reject-button">Reject</button></div></article><article className="doc-card"><div className="doc-title"><div><h2>Update 2</h2><span>Document: Customer Onboarding Guide</span></div><span className="doc-icon">▤</span></div><div className="doc-preview"><small>Update</small><p>Revised the setup checklist, added a new section for access permissions, and clarified the handoff steps for the support team.</p></div><button className="view-update">View update</button><div className="doc-actions"><button className="dark-button">Accept &amp; Commit</button><button className="reject-button">Reject</button></div></article></div> : <div className="content">
          {!sent ? <><div className="hero"><div className="hero-mark">✣<sup>+</sup></div><h1>What can I help you find?</h1><p>Ask a question about the project, or request a guide to understanding its functionality</p></div><div className="suggestions"><button className="suggestion-card" onClick={() => runSuggestion('schema')}><span className="suggestion-icon">⌕</span><span className="suggestion-arrow">↗</span><strong>Get database schema</strong><small>View the schema of the project</small></button><button className="suggestion-card" onClick={() => runSuggestion('summary')}><span className="suggestion-icon">▤</span><span className="suggestion-arrow">↗</span><strong>Draft a project summary</strong><small>Obtain a documentation-based summary</small></button></div></> : <div className="split-view"><section className="chat-panel"><div className="message-list">{messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>{message.role === 'assistant' && <span className="message-mark">✣</span>}<p>{message.text}</p>{message.role === 'user' && <small>2:14 PM</small>}{message.role === 'assistant' && <button className="reference-button">↗ &nbsp;Open referenced output</button>}</div>)}</div></section><aside className="canvas-panel"><header><div><strong>{canvasType === 'summary' ? 'Project summary preview' : 'Database schema preview'}</strong><span>Loading referenced output</span></div><button onClick={() => setCanvasType(null)} aria-label="Close canvas">×</button></header><div className="canvas-preview">{isQuerying ? <><div className="canvas-loader">▣</div><strong>Loading referenced output</strong><span>TRACiE is analyzing the codebase</span><div className="progress"><i /></div><small>Waiting for /api/query</small></> : apiWidgets.length > 0 ? <div className="api-widget-list">{apiWidgets.map((widget, index) => <pre key={index}>{JSON.stringify(widget, null, 2)}</pre>)}</div> : canvasType ? <><div className="canvas-loader">▣</div><strong>Loading image preview</strong><span>The referenced output is opening in the canvas</span><div className="progress"><i /></div><small>Fetching referenced output</small></> : <><div className="schema-card"><strong>{canvasType === 'summary' ? 'Project summary' : 'Database schema'}</strong><span>JSON widget ready for API response</span></div></>}</div>{apiError && <p className="api-error" role="alert">{apiError}</p>}</aside></div>}
          {practiceOpen && <div className="practice-popover"><strong>Practice tools</strong><span>Use these features to help you learn or practice things with the codebase.</span>{['Quiz', 'Flashcards', 'Audio overview', 'Code exercise'].map((tool) => <button key={tool} onClick={() => { setPracticeTag(tool); setPracticeOpen(false) }}><span>{tool === 'Quiz' ? '✎' : tool === 'Flashcards' ? '▤' : tool === 'Audio overview' ? '◉' : '<>'}</span>{tool}</button>)}</div>}
          <div className="composer"><button className="add-button" onClick={() => setPracticeOpen(!practiceOpen)} aria-label="Open practice tools">+</button>{practiceTag && <span className="practice-tag" data-type={practiceTag === 'Flashcards' ? 'flashcard' : practiceTag.toLowerCase().replace(' ', '-')}>{practiceTag}<input type="hidden" name="practice_type" value={practiceTag === 'Flashcards' ? 'flashcard' : practiceTag.toLowerCase().replace(' ', '-')} /><button onClick={() => setPracticeTag('')} aria-label="Remove practice tool">×</button></span>}<input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) sendMessage() }} placeholder="Ask anything..." aria-label="Ask anything" /><button className="send-button" onClick={() => sendMessage()} disabled={isQuerying} aria-label="Send message">{isQuerying ? '…' : '↑'}</button></div>
          <p className="disclaimer">AI can make mistakes. Check important information and review cited sources.</p>
        </div>}
      </section>
    </main>
  )
}

// The provided image depicts Tracy's light desktop chat workspace: a narrow left navigation rail, pale blush canvas, centered welcome prompt, two suggestion cards, and a bottom composer.

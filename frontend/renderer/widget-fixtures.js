/*
 * WIDGET CONTRACT + FIXTURES (SRS 26.3)
 * This file is the single source of truth for payload shapes.
 * Ethan's system prompt must produce exactly these shapes. Change a shape HERE first, then tell Ethan.
 * Envelope fields: type, message, eyebrow, title, subtitle, badge, payload, citations, components
 */
window.WIDGET_FIXTURES = {

  /* ================= CONTENT AND GUIDANCE ================= */

  overview: {
    type: 'overview',
    message: 'Here is the high level architecture. I opened it in the canvas.',
    eyebrow: 'OVERVIEW',
    title: 'Platform architecture',
    badge: 'Last reviewed 18 Sep 2026',
    payload: {
      lead: 'A modular service architecture built for reliable project intelligence',
      body: 'Atlas turns connected code repositories into searchable technical knowledge. Client applications call a stateless service layer, while asynchronous workers index source files and keep documentation current.',
      layers: [
        { icon: 'monitor', tag: 'INTERFACE', title: 'Client applications', text: 'React web app and native mobile clients' },
        { icon: 'workflow', tag: 'LOGIC', title: 'Application services', text: 'REST API, authentication, and background workers', highlight: true },
        { icon: 'database', tag: 'FOUNDATION', title: 'Data & infrastructure', text: 'PostgreSQL, Redis cache, and object storage' },
      ],
    },
    citations: [{ file: 'README.md', start: 1, end: 40 }],
  },

  glossary: {
    type: 'glossary',
    title: 'Architecture terms',
    subtitle: 'Compact definitions for recurring concepts.',
    payload: {
      terms: [
        { term: 'API gateway', definition: 'The single entry point that routes client requests to internal services.' },
        { term: 'Event bus', definition: 'A channel that lets services publish and consume asynchronous events.' },
        { term: 'Idempotency', definition: 'The guarantee that retrying an operation produces no extra side effects.' },
        { term: 'Read replica', definition: 'A database copy optimized for queries without burdening the primary.' },
      ],
    },
  },

  definition: {
    type: 'definition',
    title: 'Service boundary',
    payload: {
      phonetic: "/ˈsɜːrvɪs ˈbaʊndri/",
      part_of_speech: 'noun',
      domain: 'architecture',
      body: 'A deliberate division of responsibility where a component owns its data and behavior, exposing only a stable contract to the rest of the system.',
    },
  },

  faq: {
    type: 'faq',
    eyebrow: 'FREQUENTLY ASKED QUESTIONS',
    title: 'Questions teams ask',
    subtitle: 'Short answers for architecture reviews and onboarding.',
    payload: {
      items: [
        { question: 'Why separate the API from workers?', answer: 'User requests remain fast while indexing and analysis run safely in the background.' },
        { question: 'Where is access enforced?', answer: 'The gateway validates identity; each service still checks repository level authorization.' },
        { question: 'How does the platform recover?', answer: 'Durable queues retry transient failures and move exhausted jobs to a review queue.' },
      ],
    },
  },

  /* ================= CODE AND FILES ================= */

  directory_tree: {
    type: 'directory_tree',
    payload: { path: ['repository', 'backend', 'auth', 'session.ts'] },
  },

  code_snippet: {
    type: 'code_snippet',
    payload: {
      file_name: 'session.ts',
      language: 'typescript',
      start_line: 1,
      code: 'interface Session {\n  id: string;\n  userId: string;\n  expiresAt: Date;\n}\n\nfunction createSession(userId: string): Session {\n  return {\n    id: crypto.randomUUID(),\n    userId,\n    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),\n  };\n}',
    },
    citations: [{ file: 'backend/auth/session.ts', start: 1, end: 13 }],
  },

  file_reference: {
    type: 'file_reference',
    title: 'Rate limiting logic',
    payload: {
      path: ['repository', 'backend', 'middleware', 'rateLimit.ts'],
      start_line: 8,
      end_line: 22,
      reason: 'Requests are counted per API key in Redis and rejected with 429 after 100 per minute.',
    },
  },

  diff: {
    type: 'diff',
    payload: { file_name: 'app.ts', patch: '@@ -1,3 +1,3 @@\n-app.use(cors())\n+app.use(cors({ origin: ALLOWED_ORIGINS }))\n app.listen(PORT)' },
  },

  /* ================= DIAGRAMS (structured HTML) ================= */

  flowchart: {
    type: 'flowchart',
    eyebrow: 'ARCHITECTURE FLOWCHART',
    title: 'Request Lifecycle',
    badge: 'Client → Server → DB',
    payload: {
      nodes: [
        { id: 'browser', label: 'Browser', sub: 'Client' },
        { id: 'gateway', label: 'API Gateway', sub: 'Auth + Route', emphasis: true },
        { id: 'service', label: 'App Service', sub: 'Business Logic' },
        { id: 'pg', label: 'PostgreSQL', sub: 'Primary DB', tone: 'sand' },
        { id: 'redis', label: 'Redis', sub: 'Read Cache', tone: 'sand' },
        { id: 'worker', label: 'Worker', sub: 'Async Queue' },
      ],
      edges: [
        { from: 'browser', to: 'gateway', label: 'HTTPS' },
        { from: 'gateway', to: 'service', label: 'gRPC' },
        { from: 'service', to: 'pg', label: 'SQL' },
        { from: 'pg', to: 'redis', label: 'Cache' },
        { from: 'redis', to: 'worker', label: 'Events' },
      ],
    },
  },

  class_diagram: {
    type: 'class_diagram',
    title: 'Domain classes',
    payload: {
      classes: [
        { name: 'BaseEntity', stereotype: 'abstract', tone: 'dark', attributes: ['# id: UUID', '# createdAt: DateTime', '# updatedAt: DateTime'], methods: ['+ save(): Promise<void>', '+ delete(): Promise<void>'] },
        { name: 'Repository', tone: 'green', attributes: ['- name: string', '- slug: string', '- visibility: Enum'], methods: ['+ getCommits(): Commit[]', '+ addCollaborator(u)'] },
        { name: 'User', tone: 'grey', attributes: ['- email: string', '- passwordHash: string', '- role: Role'], methods: ['+ hasAccess(repo): bool', '+ generateToken(): JWT'] },
      ],
      relations: [
        { from: 'Repository', to: 'BaseEntity', kind: 'extends' },
        { from: 'User', to: 'BaseEntity', kind: 'extends' },
        { from: 'Repository', to: 'User', kind: 'association', label: 'Collaborator', from_card: '0..*', to_card: '1' },
      ],
    },
  },

  er_diagram: {
    type: 'er_diagram',
    title: 'Core Data Model',
    payload: {
      entities: [
        { name: 'users', fields: [{ name: 'id', key: 'PK' }, { name: 'email', note: 'UNIQUE' }, { name: 'name' }, { name: 'created_at' }] },
        { name: 'repositories', fields: [{ name: 'id', key: 'PK' }, { name: 'owner_id', key: 'FK' }, { name: 'slug', note: 'UNIQUE' }, { name: 'visibility' }] },
        { name: 'commits', fields: [{ name: 'sha', key: 'PK' }, { name: 'repo_id', key: 'FK' }, { name: 'author_id', key: 'FK' }, { name: 'message' }, { name: 'committed_at' }] },
      ],
      relations: [
        { from: 'users', to: 'repositories', cardinality: '1..N', label: 'owns' },
        { from: 'repositories', to: 'commits', cardinality: '1..N', label: 'has' },
      ],
    },
  },

  database_schema: {
    type: 'database_schema',
    title: 'atlas_db - Table Definitions',
    badge: 'PostgreSQL 15',
    payload: {
      tables: [
        { name: 'users', columns: [
          { name: 'id', type: 'uuid', constraints: 'PK DEFAULT gen_random_uuid()', key: 'PK' },
          { name: 'email', type: 'text', constraints: 'NOT NULL UNIQUE' },
          { name: 'password_hash', type: 'text', constraints: 'NOT NULL' },
          { name: 'created_at', type: 'timestamptz', constraints: 'DEFAULT now()' } ] },
        { name: 'repositories', columns: [
          { name: 'id', type: 'uuid', constraints: 'PK', key: 'PK' },
          { name: 'owner_id', type: 'uuid', constraints: 'FK → users.id', key: 'FK' },
          { name: 'slug', type: 'text', constraints: 'NOT NULL UNIQUE' },
          { name: 'visibility', type: 'enum(public,private)', constraints: '' } ] },
      ],
      indexes: [
        { label: 'IDX users(email)' },
        { label: 'IDX repositories(owner_id, slug)' },
        { label: 'GIN commits(message) - full-text', highlight: true },
      ],
    },
  },

  api_flow: {
    type: 'api_flow',
    eyebrow: 'API FLOW DIAGRAM',
    title: 'REST API Surface - /api/v1',
    payload: {
      groups: [
        { prefix: '/auth', tone: 'dark', endpoints: [
          { method: 'POST', path: '/login', result: '200 JWT + session cookie' },
          { method: 'POST', path: '/logout', result: '204 clears cookie' },
          { method: 'GET', path: '/me', result: '200 current user' } ] },
        { prefix: '/repositories', tone: 'green', endpoints: [
          { method: 'GET', path: '/', result: 'paginated list' },
          { method: 'POST', path: '/', result: '201 created' },
          { method: 'PATCH', path: '/:slug', result: '200 updated' },
          { method: 'DELETE', path: '/:slug', result: '204 removed' } ] },
        { prefix: '/search', tone: 'light', endpoints: [
          { method: 'GET', path: '/commits?q=', result: 'full-text' } ] },
      ],
      common_errors: ['400 Bad request', '401 Unauthenticated', '403 Forbidden', '404 Not found', '429 Rate limited', '500 Server error'],
    },
  },

  commit_history: {
    type: 'commit_history',
    eyebrow: 'TIMELINE - COMMIT HISTORY',
    title: 'atlas / main branch',
    payload: {
      commits: [
        { sha: 'a4f7c29', when: '2 h ago', author: 'sarah.k', message: 'feat: add repository search with full-text index', detail: 'Adds GIN index on commits.message; exposes GET /search endpoint' },
        { sha: '88d12e0', when: '6 h ago', author: 'james.r', message: 'chore: release v1.4.0', detail: 'Bump version, update changelog, tag release', tag: 'v1.4.0' },
        { sha: '3c90fa1', when: '1 d ago', author: 'alex.m', message: 'fix: correct session expiry calculation', detail: 'expiresAt was using minutes instead of seconds multiplier' },
      ],
    },
  },

  sequence_diagram: {
    type: 'sequence_diagram',
    title: 'Login flow',
    payload: { diagram_source: 'sequenceDiagram\n  participant U as User\n  participant G as API Gateway\n  participant DB as PostgreSQL\n  U->>G: POST /auth/login\n  G->>DB: find user by email\n  DB-->>G: user row\n  G-->>U: 200 JWT + cookie' },
  },

  mermaid_route_test: {
    type: 'flowchart',
    title: 'Flowchart sent as Mermaid text (tests the core route)',
    payload: { diagram_source: 'flowchart LR\n  A[Upload] --> B{Valid?}\n  B -->|yes| C[Index]\n  B -->|no| D[Reject]' },
  },

  broken_mermaid_test: {
    type: 'state_diagram',
    title: 'Deliberately broken Mermaid (tests the fallback)',
    payload: { diagram_source: 'stateDiagram-v2\n  [*] --> ' },
  },

  /* ================= PRACTICE (bare widgets: they draw their own card) ================= */

  quiz: {
    type: 'quiz',
    message: 'Here is a 2 question quiz on the data layer.',
    payload: {
      questions: [
        {
          question: 'Which database type organizes data into tables with rows and columns?',
          hint: 'Choose one answer',
          options: ['Relational database', 'Document database', 'Graph database', 'Key-value store'],
          answer_index: 0,
          explanation: 'Atlas stores users and repositories in PostgreSQL, a relational database.',
        },
        {
          question: 'Where are search results cached?',
          hint: 'Choose one answer',
          options: ['PostgreSQL', 'Redis', 'Object storage', 'The worker queue'],
          answer_index: 1,
          explanation: 'Redis is the read cache in front of PostgreSQL.',
        },
      ],
    },
  },

  code_exercise: {
    type: 'code_exercise',
    payload: {
      questions: [{
        repo_label: 'repository',
        scope: 'backend / auth',
        path: ['repository', 'backend', 'auth', 'session.ts'],
        question: 'What is the essence of this file in this folder?',
        hint: 'Choose the answer that best summarizes the purpose of this code.',
        file_name: 'session.ts',
        language: 'typescript',
        code: 'interface Session {\n  id: string;\n  userId: string;\n  expiresAt: Date;\n}\nfunction createSession(userId: string): Session {\n  return {\n    id: crypto.randomUUID(),\n    userId,\n    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),\n  };\n}',
        options: [
          'Defines a database migration for the sessions table',
          'Creates a new session object with a generated ID and expiration',
          'Handles session revocation and token cleanup',
          'Validates incoming session tokens against a secret key',
        ],
        answer_index: 1,
        explanation: 'createSession builds a Session with a random UUID and a 30 day expiry. Nothing is stored or validated here.',
      }],
    },
  },

  flashcards: {
    type: 'flashcards',
    payload: {
      cards: [
        {
          front: 'NFR', prompt: 'What does this abbreviation mean in SRS?',
          back: 'NFR means Non-functional requirement',
          detail: 'A non-functional requirement describes how a system should behave, perform.',
          related: { term: 'Related term', text: 'FR means Functional requirement. It describes what the system must do.' },
        },
        {
          front: 'RAG', prompt: 'What does this pattern do in TRACiE?',
          back: 'RAG means Retrieval Augmented Generation',
          detail: 'Relevant code chunks are retrieved first, then passed to the LLM as context.',
        },
      ],
    },
  },

  audio: {
    type: 'audio',
    title: 'DataFlow Audio overview',
    payload: {
      // Replace with a real IBM TTS URL from Ethan. This public MDN sample only proves the player works.
      src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
      description: 'A concise summary of how data flows through the system',
      transcript: 'Requests enter through the API gateway, are handled by the app service and stored in PostgreSQL.',
      downloadable: true,
    },
  },

  /* ================= WORKFLOWS (no bespoke design yet: same visual language) ================= */

  checklist: {
    type: 'checklist',
    title: 'Day one setup',
    payload: { items: [{ text: 'Copy .env.example to .env' }, { text: 'Run docker compose up', done: true }, { text: 'Open http://localhost:3000' }] },
  },

  tutorial: {
    type: 'tutorial',
    title: 'Add a new API route',
    payload: { steps: [{ title: 'Create the handler', body: 'Add a file in `backend/routes`.' }, { title: 'Register it', body: 'Import it in `backend/index.ts`.' }] },
  },

  /* ================= COMPOSITE (the demo opener) ================= */

  composite: {
    type: 'composite',
    message: 'Here is a full overview of the project: architecture, request flow, key file and a setup checklist.',
    title: 'Project overview',
    components: [
      { type: 'overview', title: 'Platform architecture', payload: { lead: 'Modular services', body: 'Clients call a stateless API; workers index code.', layers: [{ icon: 'monitor', tag: 'INTERFACE', title: 'Clients', text: 'Web app' }] } },
      { type: 'flowchart', title: 'Request Lifecycle', payload: { nodes: [{ id: 'a', label: 'Browser' }, { id: 'b', label: 'API Gateway', emphasis: true }, { id: 'c', label: 'PostgreSQL' }], edges: [{ from: 'a', to: 'b', label: 'HTTPS' }, { from: 'b', to: 'c', label: 'SQL' }] } },
      { type: 'this_type_does_not_exist', payload: { body: 'Unknown types must degrade to a readable card.' } },
      { type: 'checklist', title: 'Day one setup', payload: { items: [{ text: 'Clone the repo' }] } },
    ],
  },

  /* Envelope edge cases: must never crash */
  flat_shape_test: { type: 'chat_response', body: 'No payload key at all. The core should still read body.' },
  data_key_test: { type: 'chat_response', data: { body: 'Uses data instead of payload.' } },
};

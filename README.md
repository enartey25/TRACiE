# TRACiE — Codebase-Aware AI Developer Onboarding Assistant

**IBM Bob 2.0 Hackathon Project**

TRACiE connects to any GitHub repository, indexes its code semantically, and lets developers ask natural-language questions about the codebase. Answers come back as structured UI widgets — architecture diagrams, code snippets, quizzes, doc proposals, and more — rendered in real time via Server-Sent Events.

---

## Table of Contents

- [Architecture](#architecture)
- [Team ownership](#team-ownership)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Running services](#running-services)
- [API overview](#api-overview)
- [Testing](#testing)
- [Project structure](#project-structure)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                   Developer UI  /  Chat Panel                        │
│                      (Newlove — frontend)                            │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  POST /api/query  ·  GET /api/stream
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│              Express API Gateway  (src/server.js, port 3000)         │
├────────────────┬─────────────────────────────┬───────────────────────┤
│ Gabriel routes │      Ethan routes            │  Shared middleware    │
│  /api/repos    │  /api/query                 │  CORS, JSON, health  │
│  /api/webhooks │  /api/stream                │                      │
│  /api/sessions │  /api/docs                  │                      │
│  /api/doc-     │  /api/audio                 │                      │
│  proposals     │  /api/fixtures              │                      │
└────────────────┴──────────┬──────────────────┴───────────────────────┘
                             │
          ┌──────────────────┼──────────────────────────┐
          ▼                  ▼                          ▼
  ┌───────────────┐  ┌──────────────────┐   ┌──────────────────────┐
  │ RAG Pipeline  │  │  Multi-Agent     │   │  Ingestion Pipeline  │
  │ (Ethan)       │  │  Supervisor      │   │  (Gabriel)           │
  │               │  │  (Ethan)         │   │  clone → walk →      │
  │ embedding +   │  │  ArchitectAgent  │   │  Tree-sitter →       │
  │ retrieval +   │  │  CodeExplainer   │   │  embed → store       │
  │ generation    │  │  Navigator       │   └──────────┬───────────┘
  └───────┬───────┘  │  Curriculum      │              │
          │          │  DocWriter       │              │
          │          └──────────────────┘              │
          │                                            │
          ▼                                            ▼
  ┌──────────────────┐                    ┌────────────────────────┐
  │  ChromaDB        │◄───────────────────│  ChromaDB              │
  │  code_chunks     │  vector search     │  upsertChunks()        │
  │  collection      │                    └────────────────────────┘
  └──────────────────┘
  ┌──────────────────────────────────────────────────────────────────┐
  │  PostgreSQL (Supabase)                                           │
  │  repositories · sessions · queries · indexing_jobs · doc_proposals│
  └──────────────────────────────────────────────────────────────────┘
```

### Agent types

| Agent | Widget produced |
|---|---|
| `ArchitectSubagent` | `architecture_diagram` — Mermaid.js diagram |
| `CodeExplainerSubagent` | `code_snippet` — file + line citations |
| `NavigatorSubagent` | `file_tree` — interactive directory layout |
| `CurriculumSubagent` | `quiz`, `flashcard_deck`, `tutorial_steps`, `learning_path` |
| `DocWriterSubagent` | `doc_proposal` — unified git diff |
| `AudioSubagent` | `audio_player` — spoken briefing |
| `GeneralQASubagent` | `chat_response` — markdown with citations |

---

## Team ownership

| Area | Owner | Key files |
|---|---|---|
| Backend infrastructure, repository ingestion | **Gabriel** | `src/services/ingestion/`, `src/routes/repos.js`, `src/routes/webhooks.js`, `src/routes/sessions.js`, `src/routes/docProposals.js`, `src/db/`, `migrations/` |
| watsonx.ai embedding, RAG query pipeline, LLM integration | **Ethan** | `src/services/rag/`, `src/services/watsonx/`, `src/services/agents/`, `src/routes/query.js`, `src/routes/stream.js` |
| Frontend chat UI | **Newlove** | `public/` |
| Dynamic UI widget rendering | **Romel** | `public/` — widget renderer |

Full route reference: **[API.md](API.md)**. Handoff notes per teammate: **[HANDOFF.md](HANDOFF.md)**.

---

## Quick start

### Prerequisites

- **Node.js 20+** (tested on v24) and **npm**
- **git** — used by the ingestion pipeline to clone repositories
- Access to **PostgreSQL** (Supabase) and **ChromaDB** (Chroma Cloud or local)

No Docker is required when using the hosted services. See [Running services](#running-services) for local alternatives.

### 1. Clone and install

```bash
git clone https://github.com/enartey25/TRACiE.git
cd TRACiE
git checkout Gabriel          # the integration branch
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in the required values. At minimum you need:

| Variable | Required for |
|---|---|
| `DATABASE_URL` | Postgres — all routes |
| `CHROMA_API_KEY` + `CHROMA_TENANT` + `CHROMA_DATABASE` | Chroma Cloud (or leave blank and run local Chroma) |
| `GROQ_API_KEY` | LLM answers (`LLM_PROVIDER=groq`, the default) |
| `TOKEN_ENCRYPTION_KEY` | Storing per-repo GitHub tokens; generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

See [Environment variables](#environment-variables) for a complete list.

### 3. Run database migrations

```bash
npm run db:migrate
```

This is idempotent — safe to re-run at any time. It prints `up to date` if nothing changed.

### 4. Start the server

```bash
npm start
```

Verify it's up:

```
GET http://localhost:3000/api/health
```

Expected when both services are reachable:

```json
{
  "status": "ok",
  "service": "TRACiE AI Assistant Backend",
  "timestamp": "...",
  "dependencies": {
    "postgres":  { "ok": true, "latencyMs": 45 },
    "chromadb":  { "ok": true, "mode": "cloud", "latencyMs": 120, "chunkCount": 0 }
  }
}
```

### 5. Connect a repository

```bash
curl -X POST http://localhost:3000/api/repos \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/expressjs/cors"}'
```

Poll until indexing is complete:

```bash
# use the repositoryId returned above
curl http://localhost:3000/api/repos/<repositoryId>/status
```

When `status` is `"complete"`, the repository is searchable.

---

## Environment variables

See **[.env.example](.env.example)** for the full list with one-line descriptions. Key groups:

| Group | Variables |
|---|---|
| Server | `PORT` |
| LLM provider | `LLM_PROVIDER`, `GROQ_API_KEY`, `GROQ_MODEL`, `HF_TOKEN`, `HF_GRANITE_MODEL` |
| IBM watsonx.ai | `WATSONX_APIKEY`, `WATSONX_PROJECT_ID`, `WATSONX_URL`, `WATSONX_EMBEDDING_MODEL_ID`, `WATSONX_GENERATION_MODEL_ID` |
| Audio | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` |
| PostgreSQL | `DATABASE_URL`, `DATABASE_SSL` |
| ChromaDB | `CHROMA_API_KEY`, `CHROMA_TENANT`, `CHROMA_DATABASE`, `CHROMADB_URL`, `CHROMA_COLLECTION_NAME` |
| GitHub | `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET`, `TOKEN_ENCRYPTION_KEY` |
| Ingestion tuning | `INGEST_MAX_CHUNK_CHARS`, `INGEST_MAX_CHUNK_LINES`, `INGEST_MAX_FILE_BYTES`, `INGEST_EMBED_BATCH_SIZE`, `INGEST_WORK_DIR`, `INGEST_HISTORY`, `HISTORY_MAX_COMMITS`, `HISTORY_MAX_PRS` |

**Embeddings note:** Without `WATSONX_APIKEY` + `WATSONX_PROJECT_ID`, a deterministic hash-based mock vector is used instead. Ingestion and retrieval work, but search results are not semantically meaningful. After adding real keys, run `POST /api/repos/:id/reindex` with `{ "full": true }` on every connected repository to re-embed with the real model.

---

## Running services

### Hosted (recommended for development)

Postgres (Supabase) and ChromaDB (Chroma Cloud) are configured through environment variables — nothing to install locally beyond Node and git.

### Local ChromaDB (offline / no Chroma Cloud key)

```bash
# Install the Python package once
pip install chromadb

# Start the server (leave running in a separate terminal)
npm run chroma          # runs on port 8000, data stored in ./chroma_data
```

Leave `CHROMA_API_KEY` empty in `.env`. The local index starts empty; connect a repository to populate it.

### Local PostgreSQL (alternative to Supabase)

```bash
# Using Docker
docker run -d \
  --name tracie-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16

# Set in .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
```

### Port conflict

If port 3000 is in use:

```powershell
# PowerShell
$env:PORT = 3001; npm start
```

```bash
# bash / zsh
PORT=3001 npm start
```

---

## API overview

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Service status and dependency health |
| `POST` | `/api/repos` | Connect a GitHub repo and start indexing |
| `GET` | `/api/repos` | List connected repositories |
| `GET` | `/api/repos/:id` | Get one repository |
| `GET` | `/api/repos/:id/status` | Poll indexing progress |
| `POST` | `/api/repos/:id/reindex` | Trigger a manual re-index |
| `POST` | `/api/webhooks/github` | Push-triggered re-index (called by GitHub) |
| `POST` | `/api/sessions` | Start a persistent chat session |
| `GET` | `/api/sessions/:id` | Get a session with its query log |
| `POST` | `/api/sessions/:id/queries` | Log a question and answer |
| `PATCH` | `/api/queries/:id` | Attach an answer after streaming completes |
| `GET` | `/api/repos/:id/sessions` | List sessions for a repository |
| `POST` | `/api/repos/:id/doc-proposals` | Store a generated doc proposal |
| `GET` | `/api/repos/:id/doc-proposals` | List proposals (filterable by status) |
| `GET` | `/api/doc-proposals/:id` | Get one proposal |
| `POST` | `/api/doc-proposals/:id/approve` | Approve a pending proposal |
| `POST` | `/api/doc-proposals/:id/reject` | Reject a pending proposal |
| `POST` | `/api/query` | RAG query — returns a UI widget JSON |
| `GET` | `/api/stream` | SSE stream of agent thoughts + complete widget |
| `GET` | `/api/fixtures` | Mock widgets for offline UI development |
| `GET` | `/api/auth/status` | watsonx.ai credential check |

Full request/response shapes: **[API.md](API.md)**

---

## Testing

| Script | Purpose |
|---|---|
| `npm run test:ingest` | Smoke-test the ingestion pipeline end-to-end (no Postgres needed) |
| `npm run test:webhook` | Send a signed push webhook to the running server |
| `npm run test:rag` | Run a full RAG query through the pipeline |
| `npm run test:auth` | Verify watsonx.ai credentials |
| `npm run test:learning` | Exercise the Curriculum agent |
| `npm run test:docgen` | Exercise the DocWriter agent |

**Ingestion smoke test:**

```bash
npm run test:ingest
# or against a specific repo:
npm run test:ingest -- https://github.com/expressjs/express
```

**Webhook test (server must be running):**

```bash
npm run test:webhook -- expressjs/cors master
```

---

## Project structure

```
├── migrations/               SQL migration files (run with npm run db:migrate)
│   ├── 001_initial_schema.sql
│   └── 002_phase2.sql
├── src/
│   ├── server.js             Express entry point
│   ├── config/
│   │   ├── backend.js        Gabriel's env config (Postgres, ChromaDB, ingestion)
│   │   └── watsonx.js        Ethan's env config (LLM, watsonx, port)
│   ├── db/
│   │   ├── postgres.js       pg Pool wrapper + ping
│   │   ├── chroma.js         ChromaDB client — upsertChunks, queryChunks, ping
│   │   └── migrate.js        Migration runner
│   ├── routes/
│   │   ├── repos.js          POST/GET /api/repos, status, reindex
│   │   ├── webhooks.js       POST /api/webhooks/github
│   │   ├── sessions.js       POST/GET /api/sessions, queries, PATCH /api/queries
│   │   ├── docProposals.js   POST/GET /api/doc-proposals
│   │   ├── query.js          POST /api/query
│   │   ├── stream.js         GET  /api/stream (SSE)
│   │   ├── docs.js           POST /api/docs/generate (Ethan)
│   │   ├── session.js        GET/DELETE /api/sessions/:id/history (Ethan, in-memory)
│   │   └── audio.js          POST /api/audio
│   ├── services/
│   │   ├── ingestion/        fetchRepo · fileWalker · chunker · embedder · history · pipeline
│   │   ├── repos/            repoStore — repositories + indexing_jobs + indexed_files
│   │   ├── sessions/         sessionStore — sessions + queries + logTurn()
│   │   ├── docs/             proposalStore — doc_proposals
│   │   ├── rag/              pipeline · retriever · jsonParser
│   │   ├── agents/           supervisor · runSubagent
│   │   ├── watsonx/          auth · embedding · generator
│   │   ├── groq/             generator
│   │   ├── huggingface/      generator
│   │   ├── memory/           sessionMemory (in-memory multi-turn)
│   │   ├── enrichment/       contextEnricher
│   │   ├── audio/            ttsService
│   │   └── navigator/        repositoryScanner
│   ├── prompts/              promptTemplates · systemPrompt
│   ├── contracts/            responseSchema.json · fixtures/
│   ├── utils/
│   │   └── crypto.js         AES-256-GCM token encryption
│   └── scripts/              test-ingestion · test-webhook · test-rag-pipeline · …
├── .env.example              All environment variables documented
├── API.md                    Complete route reference
└── HANDOFF.md                Teammate notes and known limitations
```

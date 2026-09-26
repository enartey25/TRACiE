# Backend Handoff — Gabriel

**I am offline all Sunday.** This document covers what is built, how to run it, what each of you needs to do, and what is rough around the edges. Read it before asking questions that may not get answered for 24 hours.

Full route reference with request/response shapes: **[API.md](API.md)**
How to run the project: **[README.md](README.md)**

---

## What is built and tested

| Area | Status |
|---|---|
| Express server, CORS, JSON parsing, `/api/health` with Postgres + ChromaDB checks | ✅ |
| Postgres schema on Supabase (`migrations/001_initial_schema.sql`, `002_phase2.sql`) | ✅ |
| ChromaDB `code_chunks` collection on Chroma Cloud | ✅ |
| `POST /api/repos`, `GET /api/repos`, `GET /api/repos/:id/status`, `POST /api/repos/:id/reindex` | ✅ |
| Repository ingestion: shallow clone → file walk → Tree-sitter chunking → embed → Chroma upsert | ✅ |
| Incremental re-index: blob SHA comparison skips unchanged files; deleted files are removed | ✅ |
| Indexing job progress tracking (`indexing_jobs` table, polled via `/status`) | ✅ |
| GitHub webhook: HMAC-verified push events trigger re-index; push arriving mid-job queues a follow-up | ✅ |
| Git commit and PR history ingestion (`chunk_type: "commit"` / `"pull_request"`) | ✅ |
| Persistent session and query logging (`POST /api/sessions`, `POST /api/sessions/:id/queries`, `PATCH /api/queries/:id`) | ✅ |
| `logTurn()` helper for Ethan's pipeline — one line, never throws | ✅ |
| Doc proposal storage with approve/reject (`POST/GET /api/repos/:id/doc-proposals`, `/approve`, `/reject`) | ✅ |
| `queryChunks()` in `src/db/chroma.js` wired into the retriever | ✅ |

**Benchmark on `expressjs/express`** (178 files, with fake embeddings): 703 code chunks + 517 history chunks, full index in ~31 seconds. Re-indexing an unchanged repo: 0 chunks re-embedded, <5 seconds.

---

## Run from a clean clone

```bash
git clone https://github.com/enartey25/TRACiE.git && cd TRACiE
git checkout Gabriel
npm install
cp .env.example .env        # fill in DATABASE_URL, CHROMA_*, GITHUB_WEBHOOK_SECRET, TOKEN_ENCRYPTION_KEY
npm run db:migrate           # idempotent; prints "up to date" if nothing changed
npm start                    # http://localhost:3000
```

**Verify it works:**
- `GET http://localhost:3000/api/health` → `"status":"ok"` with both dependencies green
- `GET http://localhost:3000/api/repos` → JSON list of connected repositories

**Port conflict:** `$env:PORT=3001; npm start` (PowerShell) or `PORT=3001 npm start` (bash)

**Local ChromaDB (if no Chroma Cloud key):** `pip install chromadb`, then `npm run chroma` in a second terminal. Leave `CHROMA_API_KEY` empty.

---

## Known limitations and TODOs

1. **Embeddings are fake until watsonx keys are configured.** Without `WATSONX_APIKEY` + `WATSONX_PROJECT_ID`, ingestion uses deterministic hash vectors. Indexing completes and routes work, but semantic search results are meaningless. After adding real credentials, re-index every connected repository with `POST /api/repos/:id/reindex` and `{ "full": true }` — mock and real vectors cannot be mixed in the same index.

2. **Changing the embedding model or chunk settings requires a full re-index.** Incremental re-index only looks at git blob SHAs. It will not notice a change to `WATSONX_EMBEDDING_MODEL_ID`, `INGEST_MAX_CHUNK_CHARS`, or `INGEST_MAX_CHUNK_LINES`. Use `{ "full": true }` when changing those settings.

3. **Every re-index clones the repository again.** The clone is shallow (`--depth 1`) so it is fast, but unchanged files are cloned even when they won't be re-embedded. This takes a few seconds on small repos and up to ~30 seconds on larger ones.

4. **Git history is capped.** The ingestion pipeline fetches the 200 most recent commits and 100 most recently updated PRs (configurable via `HISTORY_MAX_COMMITS` and `HISTORY_MAX_PRS`). PR review comments and commit diffs are not ingested — only commit messages and PR titles/bodies.

5. **GitHub API rate limit.** Without a `GITHUB_TOKEN`, the API allows 60 requests per hour. Each history ingestion run uses 3–5 requests. Set `GITHUB_TOKEN` in `.env` to raise the limit to 5,000 per hour. When rate-limited, `history.status` becomes `"failed"` with a message, and the code index is not affected.

6. **Webhooks require a public URL.** GitHub cannot reach `localhost`. Use `ngrok http 3000` for a demo tunnel. There is one shared `GITHUB_WEBHOOK_SECRET` for all repositories. Only pushes to the default branch are re-indexed.

7. **Approving a doc proposal only records the decision.** No PR is opened and no diff is applied. That integration is deferred to after the hackathon.

8. **No authentication on any route.** CORS is open to all origins. Acceptable for a hackathon demo; not for production.

9. **Chroma Cloud free tier caps reads at 300 records per request.** The backend reads in batches of 200 (`getExisting()`) so it stays within limits. If you write a custom `collection.get()` call, keep `limit` at 300 or below, or you will get a "Quota exceeded" error. Deletes are not capped.

10. **Jobs run inside the server process.** If the server restarts while a job is running, the job is marked `"failed"` at startup with the message `"Server restarted during indexing"`. Run a re-index to recover.

11. **Repositories are keyed by URL.** If a GitHub repo is renamed or transferred, a new `repositories` row is created and the old one is not updated.

12. **Only GitHub is supported.** GitLab and Bitbucket are not implemented.

---

## Notes per teammate

### Ethan

**Retriever is patched.** The `retrieveCodeChunks` function in `src/services/rag/retriever.js` has a `[Gabriel]` block at the top. It calls `queryChunks()` from `src/db/chroma.js` (code chunks only, by default). If Chroma returns results, the old REST API fallback below it is never reached. The fallback is unchanged.

**To include git history in answers**, call `queryChunks` a second time with `chunkTypes: ['commit', 'pull_request']`. History chunks have no `file_path` or line numbers — cite them using `metadata.url`.

**`repoId`** should be the `repositoryId` UUID from `POST /api/repos`. A non-UUID value like `"TRACiE"` searches all indexed repositories.

**Logging chat turns to Postgres** is one line, added after the widget is produced in `pipeline.js`:

```js
const { logTurn } = require('../sessions/sessionStore');
await logTurn({ sessionId, query, chunks, widget });
// - sessionId: UUID from POST /api/sessions; non-UUID values like "session-1" are silently ignored
// - chunks: the retrieved chunk array (their chunk_ids are stored as retrieved_chunk_ids)
// - never throws, so it cannot break a chat response
```

For SSE, you can either call `logTurn` after the `complete` event is assembled, or call it twice: once with just `{ sessionId, query }` to record the question, and once with `PATCH /api/queries/:id` to attach the answer when the stream closes.

**Doc proposals.** In `routes/docs.js`, replace the in-memory `proposalStore` Map with `createProposal` / `listProposals` / `reviewProposal` from `src/services/docs/proposalStore.js`. These functions accept and return the same widget shape your `DocWriterSubagent` already produces. The only requirement is that `repositoryId` is a valid UUID from the `repositories` table — so the `repoId` from the incoming query request needs to be a UUID.

**Your `GET /api/sessions/:id/history` and `DELETE /api/sessions/:id` routes are untouched.** Gabriel's session routes use different paths (`POST /api/sessions`, `GET /api/sessions/:id`, `POST /api/sessions/:id/queries`) so there is no conflict.

**Embedding input limit.** Chunks are capped at 1,500 characters (`INGEST_MAX_CHUNK_CHARS`), which is well under the 512-token Granite embedding limit. If you are batching embedding requests to watsonx directly, consider adding `parameters: { truncate_input_tokens: 512 }` to the request body as a safety net.

---

### Newlove

**Connecting a repository:**

1. `POST /api/repos` with `{ "url": "https://github.com/owner/repo" }`.
2. Store the `repositoryId` from the response.
3. Poll `GET /api/repos/:id/status` every 1–2 seconds.
4. Use `progress` (0.0–1.0) for the progress bar and `stage` for the label (`"cloning"`, `"parsing"`, `"embedding"`, `"history"`, `"done"`).
5. Stop polling when `status` is `"complete"` or `"failed"`.

**Starting a chat:**

1. `POST /api/sessions` with `{ "repositoryId": "<uuid>" }`.
2. Store the returned `sessionId`.
3. Send `sessionId` and `repoId` (same UUID) on every `POST /api/query` and `GET /api/stream` request.

**Doc proposal review panel:**

- `GET /api/repos/:id/doc-proposals?status=pending` for the list.
- `POST /api/doc-proposals/:id/approve` or `/reject` with an optional `{ "note": "…" }` body.
- The proposal objects have the same shape as the `doc_proposal` widget — Romel's renderer can display them directly.

---

### Romel

Doc proposals retrieved from `GET /api/repos/:id/doc-proposals` come back in the same `doc_proposal` widget shape (`type: "doc_proposal"`, snake_case fields). Your renderer should be able to render them without any transformation.

---

## Where things live

```
migrations/                    SQL migration files — run with npm run db:migrate
src/config/backend.js          All of Gabriel's env config (Postgres, ChromaDB, ingestion tuning)
src/db/postgres.js             pg Pool wrapper with ping()
src/db/chroma.js               ChromaDB client — upsertChunks(), queryChunks(), ping()
src/db/migrate.js              Migration runner
src/services/ingestion/
  fetchRepo.js                 parseGitHubUrl, cloneRepository, listBlobShas (SHA diffing)
  fileWalker.js                Recursive file tree walk with language detection
  chunker.js                   Tree-sitter semantic chunking + fixed-window fallback
  embedder.js                  embedTexts() / embedText() — plug-in point for the embedding model
  history.js                   GitHub commit + PR ingestion
  pipeline.js                  startIngestion() — the main ingestion entry point
src/services/repos/repoStore.js    repositories + indexing_jobs + indexed_files queries
src/services/sessions/sessionStore.js  sessions + queries + logTurn() helper
src/services/docs/proposalStore.js     doc_proposals persistence
src/routes/
  repos.js                     POST/GET /api/repos, /status, /reindex
  webhooks.js                  POST /api/webhooks/github
  sessions.js                  POST/GET /api/sessions, queries, PATCH /api/queries
  docProposals.js              POST/GET /api/doc-proposals, /approve, /reject
```

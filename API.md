# TRACiE Backend API Reference

Base URL: `http://localhost:3000` (or whatever `PORT` is). Request and response bodies are JSON.
Errors: `{ "error": "message" }` with a 4xx/5xx status, unless a section says otherwise.
IDs (`repositoryId`, `jobId`, `sessionId`, `queryId`, `proposal_id`) are UUIDs. A malformed ID gets a `400`, and an unknown one gets a `404`.

**Owners:** Gabriel owns everything in this file. Ethan owns `/api/query`, `/api/stream`, `/api/fixtures`, `/api/auth/status`, `/api/docs/*` and `/api/sessions/:id/history`, listed at the end.

- [System](#system)
- [Repositories & indexing](#repositories--indexing)
- [GitHub webhook](#github-webhook)
- [Sessions & query logging](#sessions--query-logging)
- [Documentation proposals](#documentation-proposals)
- [In-process functions (for Ethan)](#in-process-functions-for-ethan)
- [Ethan's routes (summary)](#ethans-routes-summary)

---

## System

### `GET /api/health`
Always returns `200`. `status` is `ok` only when both Postgres and ChromaDB are reachable.
```json
{
  "status": "ok | degraded",
  "service": "TRACiE AI Assistant Backend",
  "timestamp": "2026-09-26T00:28:30.936Z",
  "dependencies": {
    "postgres": { "ok": true, "latencyMs": 132 },
    "chromadb": { "ok": true, "mode": "cloud | local", "latencyMs": 416, "chunkCount": 1362 }
  }
}
```
When a dependency is down it shows `{ "ok": false, "error": "..." }` instead.

---

## Repositories & indexing

### `POST /api/repos`: connect a repository and start indexing
```json
{ "url": "https://github.com/owner/repo", "token": "ghp_... (optional, needed for private repos)" }
```
`url` also accepts `owner/repo` and `git@github.com:owner/repo.git`. Connecting a URL that's already connected triggers an incremental re-index.

**202**
```json
{
  "repositoryId": "uuid",
  "jobId": "uuid",
  "alreadyIndexing": false,
  "repository": { "...": "Repository object" },
  "job": { "...": "Job object" }
}
```
`alreadyIndexing: true` means a job was already running for this repository, and that existing job is returned instead of a new one.

### `GET /api/repos`: list connected repositories (newest first)
```json
{
  "repositories": [
    {
      "id": "uuid", "url": "https://github.com/expressjs/express", "name": "expressjs/express",
      "platform": "github", "indexStatus": "ready", "hasToken": false,
      "lastCommitSha": "9a34acf…", "lastIndexed": "timestamp", "historyIndexedAt": "timestamp | null",
      "createdAt": "timestamp",
      "latestJob": { "jobId": "uuid", "status": "complete", "stage": "done", "chunksDone": 703, "chunksTotal": 703 }
    }
  ]
}
```

### `GET /api/repos/:id`: one repository
**Repository object:**
```json
{
  "id": "uuid", "url": "https://github.com/owner/repo", "name": "owner/repo", "platform": "github",
  "indexStatus": "pending | indexing | ready | failed",
  "hasToken": false, "lastCommitSha": "sha | null", "lastIndexed": "timestamp | null",
  "historyIndexedAt": "timestamp | null", "createdAt": "timestamp"
}
```
`indexStatus: "ready"` means code chunks are searchable. A repository that is already `ready` stays `ready` during a re-index, so chat keeps working while it runs.

### `GET /api/repos/:id/status`: indexing progress (poll every 1–2 s)
Returns the latest job for the repository. **Job object:**
```json
{
  "repositoryId": "uuid",
  "indexStatus": "ready",
  "jobId": "uuid",
  "trigger": "connect | reindex | webhook",
  "fullReindex": false,
  "status": "pending | running | complete | failed",
  "stage": "queued | cloning | parsing | embedding | history | done",
  "filesTotal": 178, "filesUnchanged": 170, "filesRemoved": 1,
  "chunksTotal": 32, "chunksDone": 16, "chunksFailed": 0,
  "progress": 0.5,
  "history": { "status": "skipped | running | complete | failed | null", "chunks": 66, "error": null },
  "error": null,
  "startedAt": "timestamp", "completedAt": "timestamp | null"
}
```
- `progress` (0–1) covers code chunks only, and is `1` once `status` is `complete`. Stop polling when `status` is `complete` or `failed`.
- On a re-index, `chunksTotal` counts only the chunks from new or changed files. When nothing changed it is `0`.
- Commit and PR ingestion runs after the code, as stage `history`. If it fails, the error goes in `history.error` and the job still completes.

### `POST /api/repos/:id/reindex`: re-index now
Optional body: `{ "full": true }`. This wipes every chunk for the repository and rebuilds it. Use it after changing the embedding model or the chunking settings. Without it, the re-index is incremental.
**202** `{ "repositoryId", "jobId", "alreadyIndexing", "job" }`

---

## GitHub webhook

### `POST /api/webhooks/github`
This is called by GitHub, not by the frontend. A push to the default branch re-indexes the matching connected repository, using the same pipeline and job tracking as a manual re-index. The resulting job shows `trigger: "webhook"` in `/status`.

**GitHub setup:** in the repository, go to Settings → Webhooks → Add webhook and set:

| Field | Value |
|---|---|
| Payload URL | `https://<public-host>/api/webhooks/github`. For a local server, use a tunnel such as `ngrok http 3000`. |
| Content type | `application/json` (required) |
| Secret | the value of `GITHUB_WEBHOOK_SECRET` |
| Events | "Just the push event" |

| Situation | Response |
|---|---|
| `GITHUB_WEBHOOK_SECRET` not set on the server | `503` |
| Missing or invalid `X-Hub-Signature-256` | `401` |
| `ping` event (sent when the hook is created) | `200 { ok: true, message: "pong" }` |
| Other events, pushes to non-default branches, branch deletions, repositories not connected to TRACiE | `202 { ok: true, ignored: "reason" }` |
| Push to the default branch | `202 { ok: true, repositoryId, jobId, queued: false }` |
| Push while a job is already running | `202 { ok: true, repositoryId, jobId: <running job>, queued: true }`. A follow-up re-index starts automatically when the running job finishes. |

Testing locally without GitHub or ngrok: `npm run test:webhook -- owner/repo master` sends a correctly signed push to your local server. Pass the repository's real default branch, or the push is ignored.

---

## Sessions & query logging

These routes persist chat sessions and question/answer pairs in Postgres. The chat logic itself stays in Ethan's pipeline. The paths are chosen so they don't clash with Ethan's in-memory `GET /api/sessions/:id/history` and `DELETE /api/sessions/:id`.

Intended flow: the frontend calls `POST /api/sessions` when a chat opens, then passes the returned `sessionId` as `sessionId` on every `/api/query` call. The pipeline then logs each turn, either by calling `logTurn()` in-process (see below) or through `POST /api/sessions/:id/queries`.

### `POST /api/sessions`: start a session
```json
{ "repositoryId": "uuid" }
```
**201 Session:**
```json
{ "sessionId": "uuid", "repositoryId": "uuid", "userAgent": "Mozilla/5.0 …", "startedAt": "timestamp", "lastActive": "timestamp" }
```

### `GET /api/sessions/:id`: a session with all its queries (oldest first)
```json
{
  "sessionId": "uuid", "repositoryId": "uuid", "userAgent": "…", "startedAt": "…", "lastActive": "…",
  "queries": [ { "...": "Query object" } ]
}
```

### `POST /api/sessions/:id/queries`: log a question (and optionally its answer)
```json
{
  "rawText": "What does cors() do?",
  "retrievedChunkIds": ["<repoId>_lib/index.js_12", "…"],
  "llmResponse": { "type": "chat_response", "content": "…" }
}
```
Only `rawText` is required. Logging a query also updates the session's `lastActive`.
**201 Query object:**
```json
{
  "queryId": "uuid", "sessionId": "uuid", "rawText": "…",
  "retrievedChunkIds": ["…"], "llmResponse": { } , "createdAt": "timestamp"
}
```

### `PATCH /api/queries/:id`: attach or replace the answer
Use this when the answer arrives later, for example after an SSE stream finishes.
```json
{ "llmResponse": { "type": "chat_response", "content": "…" } }
```
**200** Query object.

### `GET /api/repos/:id/sessions`: sessions for a repository (most recent first)
```json
{ "sessions": [ { "sessionId": "uuid", "repositoryId": "uuid", "userAgent": "…", "startedAt": "…", "lastActive": "…", "queryCount": 4 } ] }
```

---

## Documentation proposals

These are stored in Postgres. Request and response bodies use the same snake_case shape as the `doc_proposal` widget that Ethan's `POST /api/docs/generate` produces, so a widget can be saved as-is and rendered as-is.

**Proposal object:**
```json
{
  "type": "doc_proposal",
  "proposal_id": "uuid",
  "repository_id": "uuid",
  "status": "pending | approved | rejected",
  "target_file": "README.md",
  "diff_markdown": "--- a/README.md\n+++ b/README.md\n@@ …",
  "rationale": "Why this change is proposed",
  "pr_title": "docs: …",
  "pr_body": "…",
  "affected_components": ["src/routes/docs.js"],
  "review_note": "LGTM | null",
  "created_at": "timestamp",
  "reviewed_at": "timestamp | null"
}
```
Any extra fields sent at creation are stored and returned unchanged.

### `POST /api/repos/:id/doc-proposals`: store a generated proposal
Body: a `doc_proposal` widget. `diff_markdown` is required; `diffMarkdown` in camelCase is also accepted. All other fields are optional.
**201** Proposal object with `status: "pending"`.

### `GET /api/repos/:id/doc-proposals[?status=pending|approved|rejected]`
**200** `{ "total": 2, "proposals": [Proposal, …] }`, newest first.

### `GET /api/doc-proposals/:id`
**200** Proposal object.

### `POST /api/doc-proposals/:id/approve` and `POST /api/doc-proposals/:id/reject`
Optional body: `{ "note": "reason" }`. Sets `status`, `reviewed_at` and `review_note`.
**200** the updated Proposal. **409** `{ error, proposal }` if the proposal has already been approved or rejected.
Approving only records the decision. It does not open a PR or apply the diff (see HANDOFF.md).

---

## In-process functions (for Ethan)

Plain functions to call from the RAG pipeline, without going through HTTP:

| Function | Where | What it does |
|---|---|---|
| `queryChunks({ embedding, repositoryId?, chunkTypes?, topK? })` | `src/db/chroma.js` | Vector search. `chunkTypes` is `['code']`, `['commit','pull_request']`, or omitted for all types. Returns `{ chunk_id, chunk_type, content, file_path, language, start_line, end_line, module_name, distance, metadata }[]`. |
| `retrieveCodeChunks(...)` | `src/services/rag/retriever.js` | Ethan's function, patched to call `queryChunks` first (code chunks only), with his fallback unchanged. |
| `logTurn({ sessionId, query, chunks, widget })` | `src/services/sessions/sessionStore.js` | Logs one chat turn. Does nothing unless `sessionId` is a real session UUID, and never throws. |
| `createProposal({ repositoryId, widget })`, `listProposals`, `reviewProposal` | `src/services/docs/proposalStore.js` | Replacement for the in-memory `proposalStore` Map in `routes/docs.js`. |
| `embedTexts(texts)` / `embedText(text)` | `src/services/ingestion/embedder.js` | The single point where ingestion calls the embedding model. |
| `startIngestion(repository, { trigger, full })` | `src/services/ingestion/pipeline.js` | Starts an indexing job in the background. |

**ChromaDB metadata** stored with each chunk in the `code_chunks` collection:

| `chunk_type` | Fields |
|---|---|
| all types | `chunk_id`, `repository_id` (plus a `repo_id` alias), `file_path`, `language`, `start_line`, `end_line`, `module_name`, `symbols` |
| `code` | Chunk ID format: `{repositoryId}_{filePath}_{startLine}` |
| `commit` | `commit_sha`, `author`, `committed_at`, `url`. `file_path` is `""` and the line fields are `0`. |
| `pull_request` | `pr_number`, `pr_state` (`open`, `closed` or `merged`), `pr_merged`, `author`, `updated_at`, `url`. Long PR descriptions are split into `_pr_{n}_{part}` chunks. |

---

## Ethan's routes (summary)

On the `Gabriel` branch these are the Phase 1 versions. Ethan's `rag-api-connections` branch has newer ones, which are documented in his README.

| Route | Purpose |
|---|---|
| `POST /api/query` `{ query, repoId?, sessionId?, conversationHistory? }` | Returns one UI widget JSON. |
| `GET /api/stream?query=…` | SSE stream of agent thoughts and tokens, then `complete` with the widget. |
| `GET /api/fixtures`, `GET /api/fixtures/:type` | Mock widgets for UI work. |
| `GET /api/auth/status` | watsonx credential check. |
| `POST /api/docs/generate`, `GET /api/docs/proposals`, `POST /api/docs/proposals/:id/approve|reject` | Doc generation, stored in memory (only on his branch). |
| `GET /api/sessions/:id/history`, `DELETE /api/sessions/:id` | In-memory multi-turn memory (only on his branch). |

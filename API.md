# TRACiE Backend — API Reference

Base URL: `http://localhost:3000` (or the value of `PORT`).

All request and response bodies are JSON unless stated otherwise.

**Error format:** every error response is `{ "error": "message" }` with a 4xx or 5xx status, except where this document notes a different shape.

**IDs** (`repositoryId`, `jobId`, `sessionId`, `queryId`, `proposal_id`) are UUIDs. A malformed ID returns `400`; an unknown ID returns `404`.

---

## Contents

- [System](#system)
- [Repositories & indexing](#repositories--indexing)
- [GitHub webhook](#github-webhook)
- [Sessions & query logging](#sessions--query-logging)
- [Documentation proposals](#documentation-proposals)
- [Query pipeline (Ethan)](#query-pipeline-ethan)
- [In-process functions for Ethan](#in-process-functions-for-ethan)
- [ChromaDB chunk metadata reference](#chromadb-chunk-metadata-reference)

---

## System

### `GET /api/health`

Always returns `200`. The `status` field is `"ok"` only when both Postgres and ChromaDB are reachable.

```json
{
  "status": "ok",
  "service": "TRACiE AI Assistant Backend",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "dependencies": {
    "postgres":  { "ok": true, "latencyMs": 45 },
    "chromadb":  { "ok": true, "mode": "cloud", "latencyMs": 120, "chunkCount": 1420 }
  }
}
```

When a dependency is down: `{ "ok": false, "error": "connection refused" }`.

### `GET /api/auth/status`

Returns the watsonx.ai credential check result (owner: Ethan).

### `GET /api/fixtures`

Returns all mock widget fixtures for offline frontend/renderer development (owner: Ethan).

### `GET /api/fixtures/:type`

Returns one fixture by widget type key (e.g. `chat_response`, `architecture_diagram`, `quiz`). `404` if the key doesn't exist.

---

## Repositories & indexing

### Repository object

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://github.com/expressjs/cors",
  "name": "expressjs/cors",
  "platform": "github",
  "indexStatus": "pending | indexing | ready | failed",
  "hasToken": false,
  "lastCommitSha": "abc1234 | null",
  "lastIndexed": "2025-01-15T10:00:00.000Z | null",
  "historyIndexedAt": "2025-01-15T10:01:00.000Z | null",
  "createdAt": "2025-01-15T09:58:00.000Z"
}
```

`indexStatus: "ready"` means code chunks are searchable. A repository that is already `"ready"` stays `"ready"` during a re-index so chat keeps working while it runs.

### Job object

```json
{
  "jobId": "uuid",
  "trigger": "connect | reindex | webhook",
  "fullReindex": false,
  "status": "pending | running | complete | failed",
  "stage": "queued | cloning | parsing | embedding | history | done",
  "filesTotal": 178,
  "filesUnchanged": 170,
  "filesRemoved": 1,
  "chunksTotal": 32,
  "chunksDone": 16,
  "chunksFailed": 0,
  "progress": 0.5,
  "history": {
    "status": "skipped | running | complete | failed | null",
    "chunks": 66,
    "error": null
  },
  "error": null,
  "startedAt": "2025-01-15T10:00:00.000Z",
  "completedAt": null
}
```

- `progress` (0–1) covers code chunks only. It is `1` once `status` is `"complete"`.
- Stop polling when `status` is `"complete"` or `"failed"`.
- On an incremental re-index, `chunksTotal` is the count of chunks from changed files only. If nothing changed it is `0`.
- Commit and PR ingestion runs as stage `"history"` after the code stage. A history failure sets `history.error` but does not fail the overall job.

---

### `POST /api/repos` — connect a repository and start indexing

**Request body:**

```json
{
  "url": "https://github.com/owner/repo",
  "token": "ghp_…"
}
```

- `url` (required): also accepts `owner/repo` and `git@github.com:owner/repo.git`.
- `token` (optional): a GitHub personal access token or fine-grained token. Required for private repositories; also raises the GitHub API rate limit from 60 to 5,000 requests per hour for history ingestion. Stored AES-256-GCM encrypted at rest.

Connecting a URL that is already connected triggers an incremental re-index (or returns the in-flight job if one is already running).

**202:**

```json
{
  "repositoryId": "uuid",
  "jobId": "uuid",
  "alreadyIndexing": false,
  "repository": { "...": "Repository object" },
  "job": { "...": "Job object" }
}
```

`alreadyIndexing: true` means a job was already running; the existing job is returned, not a new one.

---

### `GET /api/repos` — list connected repositories

**200:**

```json
{
  "repositories": [
    {
      "id": "uuid",
      "url": "https://github.com/expressjs/express",
      "name": "expressjs/express",
      "platform": "github",
      "indexStatus": "ready",
      "hasToken": false,
      "lastCommitSha": "9a34acf",
      "lastIndexed": "2025-01-15T10:00:00.000Z",
      "historyIndexedAt": "2025-01-15T10:01:00.000Z",
      "createdAt": "2025-01-15T09:58:00.000Z",
      "latestJob": {
        "jobId": "uuid",
        "status": "complete",
        "stage": "done",
        "chunksDone": 703,
        "chunksTotal": 703
      }
    }
  ]
}
```

---

### `GET /api/repos/:id` — get one repository

**200:** Repository object (see above).

---

### `GET /api/repos/:id/status` — poll indexing progress

**200:**

```json
{
  "repositoryId": "uuid",
  "indexStatus": "ready",
  "jobId": "uuid",
  "trigger": "connect",
  "fullReindex": false,
  "status": "complete",
  "stage": "done",
  "filesTotal": 178,
  "filesUnchanged": 170,
  "filesRemoved": 1,
  "chunksTotal": 32,
  "chunksDone": 32,
  "chunksFailed": 0,
  "progress": 1,
  "history": { "status": "complete", "chunks": 66, "error": null },
  "error": null,
  "startedAt": "2025-01-15T10:00:00.000Z",
  "completedAt": "2025-01-15T10:00:31.000Z"
}
```

---

### `POST /api/repos/:id/reindex` — trigger a manual re-index

**Request body (optional):**

```json
{ "full": true }
```

Without `full: true`, only files whose git blob SHA changed since the last index are re-embedded. With `full: true`, all chunks are deleted and the repository is reindexed from scratch. Use `full: true` after changing the embedding model or chunk size settings.

**202:**

```json
{
  "repositoryId": "uuid",
  "jobId": "uuid",
  "alreadyIndexing": false,
  "job": { "...": "Job object" }
}
```

---

## GitHub webhook

### `POST /api/webhooks/github`

This endpoint is called by GitHub, not by the frontend. A push to the default branch triggers an incremental re-index of the matching connected repository, using the same pipeline and job tracking as a manual re-index. The resulting job has `trigger: "webhook"` in `/api/repos/:id/status`.

**GitHub webhook setup** (repository → Settings → Webhooks → Add webhook):

| Field | Value |
|---|---|
| Payload URL | `https://<public-host>/api/webhooks/github`. For a local server, use `ngrok http 3000`. |
| Content type | `application/json` (required) |
| Secret | the value of `GITHUB_WEBHOOK_SECRET` in `.env` |
| Events | "Just the push event" |

**Response matrix:**

| Situation | HTTP | Body |
|---|---|---|
| `GITHUB_WEBHOOK_SECRET` not configured on the server | `503` | `{ "error": "..." }` |
| Missing or invalid `X-Hub-Signature-256` | `401` | `{ "error": "Invalid webhook signature." }` |
| `ping` event (sent when the hook is first created) | `200` | `{ "ok": true, "message": "pong", "hookId": null }` |
| Events other than `push`, non-default branch pushes, branch deletions, repos not connected to TRACiE | `202` | `{ "ok": true, "ignored": "reason" }` |
| Push to the default branch, repository ready | `202` | `{ "ok": true, "repositoryId": "uuid", "jobId": "uuid", "queued": false }` |
| Push while another job is running | `202` | `{ "ok": true, "repositoryId": "uuid", "jobId": "<running-job-uuid>", "queued": true }` — a follow-up re-index starts automatically when the running job finishes |

**Local testing without GitHub or ngrok:**

```bash
npm run test:webhook -- owner/repo <default-branch>
# Example:
npm run test:webhook -- expressjs/cors master
```

This sends a correctly HMAC-signed push payload to `http://localhost:3000/api/webhooks/github`.

---

## Sessions & query logging

These routes persist chat sessions and question/answer pairs in Postgres. The chat logic stays in Ethan's RAG pipeline. The route paths are chosen so they do not conflict with Ethan's in-memory `GET /api/sessions/:id/history` and `DELETE /api/sessions/:id`.

**Intended flow:**

1. The frontend calls `POST /api/sessions` when a chat opens and stores the returned `sessionId`.
2. The `sessionId` is passed as the `sessionId` field on every `POST /api/query` call.
3. After the pipeline produces a widget, call `POST /api/sessions/:sessionId/queries` to log the turn, or use `logTurn()` in-process (see [In-process functions for Ethan](#in-process-functions-for-ethan)).

---

### `POST /api/sessions` — start a session

**Request body:**

```json
{ "repositoryId": "uuid" }
```

**201 Session object:**

```json
{
  "sessionId": "uuid",
  "repositoryId": "uuid",
  "userAgent": "Mozilla/5.0 …",
  "startedAt": "2025-01-15T10:00:00.000Z",
  "lastActive": "2025-01-15T10:00:00.000Z"
}
```

---

### `GET /api/sessions/:id` — get a session with its full query log

**200:**

```json
{
  "sessionId": "uuid",
  "repositoryId": "uuid",
  "userAgent": "Mozilla/5.0 …",
  "startedAt": "2025-01-15T10:00:00.000Z",
  "lastActive": "2025-01-15T10:05:00.000Z",
  "queries": [
    {
      "queryId": "uuid",
      "sessionId": "uuid",
      "rawText": "What does cors() do?",
      "retrievedChunkIds": ["repo-uuid_lib/index.js_12", "…"],
      "llmResponse": { "type": "chat_response", "content": "…" },
      "createdAt": "2025-01-15T10:02:00.000Z"
    }
  ]
}
```

Queries are returned oldest first.

---

### `POST /api/sessions/:id/queries` — log a question (and optionally its answer)

**Request body:**

```json
{
  "rawText": "What does cors() do?",
  "retrievedChunkIds": ["<repoId>_lib/index.js_12", "…"],
  "llmResponse": { "type": "chat_response", "content": "…" }
}
```

Only `rawText` is required. Logging a query also updates the session's `lastActive` timestamp.

**201 Query object:**

```json
{
  "queryId": "uuid",
  "sessionId": "uuid",
  "rawText": "What does cors() do?",
  "retrievedChunkIds": ["…"],
  "llmResponse": { "type": "chat_response", "content": "…" },
  "createdAt": "2025-01-15T10:02:00.000Z"
}
```

---

### `PATCH /api/queries/:id` — attach or replace the answer

Use this when the answer arrives asynchronously — for example, after an SSE stream finishes.

**Request body:**

```json
{ "llmResponse": { "type": "chat_response", "content": "…" } }
```

**200:** Updated Query object.

---

### `GET /api/repos/:id/sessions` — list sessions for a repository

**200:**

```json
{
  "sessions": [
    {
      "sessionId": "uuid",
      "repositoryId": "uuid",
      "userAgent": "Mozilla/5.0 …",
      "startedAt": "2025-01-15T10:00:00.000Z",
      "lastActive": "2025-01-15T10:05:00.000Z",
      "queryCount": 4
    }
  ]
}
```

Most recent session first.

---

## Documentation proposals

Proposals are stored in Postgres. The request and response body uses the same snake_case shape as the `doc_proposal` widget that the `DocWriterSubagent` produces, so a widget can be saved and rendered without transformation.

### Proposal object

```json
{
  "type": "doc_proposal",
  "proposal_id": "uuid",
  "repository_id": "uuid",
  "status": "pending | approved | rejected",
  "target_file": "README.md",
  "diff_markdown": "--- a/README.md\n+++ b/README.md\n@@ …",
  "rationale": "Recent changes were not documented.",
  "pr_title": "docs: update README with streaming API details",
  "pr_body": "Automated proposal from the doc generation pipeline.",
  "affected_components": ["src/routes/stream.js"],
  "review_note": null,
  "created_at": "2025-01-15T10:00:00.000Z",
  "reviewed_at": null
}
```

Any extra fields sent at creation time are stored and returned unchanged.

---

### `POST /api/repos/:id/doc-proposals` — store a generated proposal

**Request body:** a `doc_proposal` widget object.

- `diff_markdown` is required. The camelCase alias `diffMarkdown` is also accepted.
- All other fields are optional.

**201:** Proposal object with `status: "pending"`.

---

### `GET /api/repos/:id/doc-proposals` — list proposals for a repository

Optional query parameter: `?status=pending|approved|rejected`

**200:**

```json
{ "total": 2, "proposals": [ "…Proposal object…" ] }
```

Newest first.

---

### `GET /api/doc-proposals/:id` — get one proposal

**200:** Proposal object.

---

### `POST /api/doc-proposals/:id/approve` — approve a pending proposal

Optional body: `{ "note": "LGTM" }`. Sets `status` to `"approved"`, records `reviewed_at`, and stores the note in `review_note`.

**200:** Updated Proposal object.

**409:** `{ "error": "Proposal is already approved.", "proposal": { … } }` if the proposal has already been reviewed.

**Note:** Approving only records the decision. It does not open a PR or apply the diff — that integration is a known future work item.

---

### `POST /api/doc-proposals/:id/reject` — reject a pending proposal

Same as approve but sets `status` to `"rejected"`.

**200:** Updated Proposal object. **409:** same conflict shape.

---

## Query pipeline (Ethan)

These routes are owned and maintained by Ethan. They are listed here for frontend/renderer reference.

### `POST /api/query` — RAG query

**Request body:**

```json
{
  "query": "How does authentication work in this repo?",
  "repoId": "uuid-of-connected-repo",
  "sessionId": "uuid",
  "conversationHistory": []
}
```

All fields except `query` are optional. Use the `repositoryId` UUID from `POST /api/repos` as `repoId` to restrict retrieval to one repository. A non-UUID `repoId` (e.g. `"TRACiE"`) searches all indexed repositories.

**200:** A validated widget JSON object. `type` is one of: `chat_response`, `code_snippet`, `file_tree`, `architecture_diagram`, `key_value_list`, `composite_dashboard`, `alert_card`, `quiz`, `flashcard_deck`, `tutorial_steps`, `learning_path`, `doc_proposal`, `audio_player`.

**400:** `{ "type": "alert_card", "severity": "error", "title": "Bad Request", "message": "…" }` — returned as a widget so the renderer can display it inline.

---

### `GET /api/stream` — SSE query stream

**Query parameters:** `query` (required), `repoId` (optional), `sessionId` (optional).

Also accepts `POST /api/stream` with a JSON body of the same shape.

**Response:** `Content-Type: text/event-stream`. Events emitted in order:

| Event | Data |
|---|---|
| `status` | `{ "stage": "retrieving", "message": "Analyzing codebase…" }` |
| `agent_thought` | `{ "agent": "Supervisor", "thought": "Analyzing intent…", … }` |
| `agent_handoff` | `{ "agent": "Supervisor", "target": "ArchitectSubagent" }` |
| `status` | `{ "stage": "delivering", "message": "Rendering dynamic widget…" }` |
| `complete` | The complete validated widget JSON object |
| `done` | `{ "status": "success" }` |
| `error` | `{ "type": "alert_card", "severity": "error", "title": "…", "message": "…" }` |

---

### `POST /api/docs/generate` — generate a doc proposal (Ethan)

See Ethan's route documentation. The proposal shape matches the `doc_proposal` widget. To persist a proposal from this endpoint to Postgres, call `POST /api/repos/:id/doc-proposals` with the widget body, or use `createProposal()` in-process.

---

## In-process functions for Ethan

These are plain Node.js functions that can be called directly from Ethan's pipeline without going through HTTP. Import paths are relative to the workspace root.

### Vector retrieval

**File:** `src/db/chroma.js`

```js
const { queryChunks } = require('./src/db/chroma');

const results = await queryChunks({
  embedding: queryEmbeddingVector,   // number[]  — same model as ingestion
  repositoryId: 'uuid',             // optional  — restrict to one repo
  chunkTypes: ['code'],             // optional  — 'code' | 'commit' | 'pull_request'
  topK: 5                           // optional, default 5
});
```

Each result:

```js
{
  chunk_id: 'uuid_src/routes/repos.js_12',
  chunk_type: 'code',
  content: '// the raw chunk text',
  file_path: 'src/routes/repos.js',
  language: 'javascript',
  start_line: 12,
  end_line: 48,
  module_name: 'src/routes/repos',
  distance: 0.17,
  metadata: { /* all stored metadata fields */ }
}
```

To include commit and PR context in an answer, call a second time:

```js
const historyChunks = await queryChunks({
  embedding: queryEmbeddingVector,
  repositoryId: 'uuid',
  chunkTypes: ['commit', 'pull_request'],
  topK: 3
});
// History chunks have no file/line. Cite them using metadata.url.
```

---

### Session persistence

**File:** `src/services/sessions/sessionStore.js`

```js
const { logTurn } = require('./src/services/sessions/sessionStore');

// Call after the widget is produced. No-op for non-UUID sessionIds. Never throws.
await logTurn({
  sessionId,          // string — UUID from POST /api/sessions, or a non-UUID like "session-1" (ignored)
  query: rawText,     // string — the user's question
  chunks,             // Array<{ chunk_id }>  — retrieved chunks
  widget              // object — the final widget JSON
});
```

For SSE streams, either call `logTurn` after the `complete` event, or log the question first (without `widget`) and then attach the answer later with `updateQueryResponse(queryId, widget)`.

---

### Doc proposal persistence

**File:** `src/services/docs/proposalStore.js`

```js
const { createProposal, listProposals, reviewProposal } = require('./src/services/docs/proposalStore');

// Store a generated proposal (requires a valid repository UUID)
const proposal = await createProposal({ repositoryId: 'uuid', widget });

// List pending proposals for a repo
const proposals = await listProposals('uuid', { status: 'pending' });

// Approve or reject
const { proposal: updated, conflict } = await reviewProposal(proposalId, 'approved', 'optional note');
```

The widget shape these functions accept and return is the same as the `doc_proposal` widget the `DocWriterSubagent` produces — no transformation needed.

---

### Embedding

**File:** `src/services/ingestion/embedder.js`

```js
const { embedText, embedTexts } = require('./src/services/ingestion/embedder');

const vector   = await embedText('single text string');    // Promise<number[]>
const vectors  = await embedTexts(['text1', 'text2']);     // Promise<number[][]>
```

Both functions delegate to `src/services/watsonx/embedding.js` and fall back to deterministic mock vectors when watsonx credentials are not set.

---

## ChromaDB chunk metadata reference

All chunks in the `code_chunks` collection share a base set of metadata fields. Additional fields are present for non-code chunk types.

### Shared fields (all chunk types)

| Field | Type | Description |
|---|---|---|
| `chunk_id` | string | Primary key. Format varies by type (see below). |
| `chunk_type` | string | `"code"` · `"commit"` · `"pull_request"` |
| `repository_id` | string | UUID from the `repositories` table. |
| `repo_id` | string | Alias for `repository_id` (backwards compatibility). |
| `file_path` | string | Repo-relative path, or `""` for history chunks. |
| `language` | string | Language label, e.g. `"javascript"`, `"git"`, `"markdown"`. |
| `start_line` | int | 1-based start line, or `0` for history chunks. |
| `end_line` | int | 1-based end line (inclusive), or `0` for history chunks. |
| `module_name` | string | Path without extension, e.g. `"src/routes/repos"`. |
| `symbols` | string | Comma-separated top-level symbol names, e.g. `"createSession, logQuery"`. |

### `chunk_type: "code"`

Chunk ID format: `{repositoryId}_{filePath}_{startLine}` (suffix `_2`, `_3`, … on rare same-line collisions).

### `chunk_type: "commit"`

Chunk ID format: `{repositoryId}_commit_{sha}`

| Extra field | Description |
|---|---|
| `commit_sha` | Full commit SHA |
| `author` | GitHub login or git author name |
| `committed_at` | ISO 8601 date string |
| `url` | GitHub HTML URL for the commit |

### `chunk_type: "pull_request"`

Chunk ID format: `{repositoryId}_pr_{number}_{partIndex}` (long PR bodies are split into multiple parts)

| Extra field | Description |
|---|---|
| `pr_number` | PR number (integer) |
| `pr_state` | `"open"` · `"closed"` · `"merged"` |
| `pr_merged` | boolean |
| `author` | GitHub login |
| `updated_at` | ISO 8601 timestamp of last update |
| `url` | GitHub HTML URL for the PR |

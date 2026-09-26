# Backend Handoff (Gabriel: infrastructure and ingestion)

I'm offline all Sunday. This file covers what exists, how to run it, what's rough, and what each of you needs to know.
The full route reference is in **[API.md](API.md)**.

## What's built and tested

| Area | Status |
|---|---|
| Express server, `/api/health` with Postgres and Chroma checks | ✅ |
| Postgres schema on Supabase (`migrations/001`, `002`) | ✅ |
| ChromaDB `code_chunks` collection on Chroma Cloud | ✅ |
| Ingestion: clone → Tree-sitter chunking → embed → Chroma, with job progress | ✅ |
| Incremental re-index: only files whose git blob SHA changed are re-embedded, and deleted files are removed | ✅ |
| GitHub webhook: HMAC-verified, push to the default branch triggers a re-index, a push arriving mid-job queues a follow-up | ✅ |
| Commit and PR history ingestion (`chunk_type: commit / pull_request`) | ✅ |
| Session and query persistence (routes plus a `logTurn()` helper) | ✅ (not yet called by the chat pipeline, see Ethan's notes) |
| Doc proposal storage with approve/reject | ✅ (Ethan's `/api/docs/*` still uses its in-memory store, see Ethan's notes) |
| Retriever reads real indexed chunks | ✅ (small patch to Ethan's `retriever.js`, see Ethan's notes) |

Reference numbers: `expressjs/express` (178 files) produces 703 code chunks plus 517 history chunks, a full index in about 31 s with fake embeddings. Re-indexing an unchanged repo re-embeds 0 chunks.

## Run it from a clean clone

Prerequisites: Node 20+ (tested on 24) and git. Docker and a local Postgres are not needed, because Postgres (Supabase) and ChromaDB (Chroma Cloud) are both hosted.

```bash
git clone https://github.com/enartey25/TRACiE.git && cd TRACiE
git checkout Gabriel
npm install
cp .env.example .env        # then paste the shared values from Gabriel (DATABASE_URL, CHROMA_*, GITHUB_WEBHOOK_SECRET, TOKEN_ENCRYPTION_KEY)
npm run db:migrate          # safe to re-run; prints "up to date" if nothing to do
npm start                   # http://localhost:3000
```
Check that it works:
- **http://localhost:3000/api/health** shows `"status":"ok"` and `"mode":"cloud"`.
- **http://localhost:3000/api/repos** lists `expressjs/express` and `expressjs/cors`, both `ready`.

Smoke test that doesn't need the server: `npm run test:ingest`. It clones a small repo, chunks it, stores it in Chroma, runs a query, cleans up, and prints `PASS`.
Webhook test with the server running: `npm run test:webhook -- expressjs/cors master` sends a signed push, which triggers an incremental re-index.

**If port 3000 is taken:** in PowerShell, `$env:PORT=3001; npm start`. In bash, `PORT=3001 npm start`.

**Running fully offline (optional):** if you have no Chroma Cloud access, `pip install chromadb`, run `npm run chroma` in a second terminal, and leave `CHROMA_API_KEY` empty in `.env`. That local index starts empty, so connect a repo to fill it.

## Known limitations and TODOs

1. **Embeddings are fake until watsonx keys are set.** With no `WATSONX_APIKEY`/`WATSONX_PROJECT_ID`, Ethan's embedding module returns hash-based vectors. Indexing works, but search results are close to random. After adding the keys, run `POST /api/repos/:id/reindex` with `{ "full": true }` on every repository, because vectors from different models can't be mixed.
2. **Changing the embedding model or chunk settings requires `{ "full": true }`.** An incremental re-index only looks at file SHAs, so it won't notice a model or setting change.
3. **Every re-index clones the repository again (shallow).** Unchanged files are skipped for embedding, but not for the clone. That takes a few seconds on small repos.
4. **History is capped.** It covers the latest 200 commits and 100 most recently updated PRs (`HISTORY_MAX_*`). PR review comments and commit diffs are not ingested.
5. **The GitHub API allows 60 requests per hour without a token.** Each history run makes about 3–5 requests. Set `GITHUB_TOKEN` to raise the limit to 5,000 per hour. When rate-limited, `history.status` becomes `failed` with a message, and the code index is unaffected.
6. **Webhooks need a public URL.** GitHub can't reach `localhost`, so use `ngrok http 3000` for a demo. Only the default branch is indexed, and there is one global `GITHUB_WEBHOOK_SECRET` shared by all repositories.
7. **Approving a doc proposal only records the decision.** It doesn't open a PR or apply the diff.
8. **There is no authentication on any route.** CORS is open to all origins. That's fine for a hackathon, not for production.
9. **Chroma Cloud free tier caps reads at 300 records per request.** The backend already reads in batches of 200. If you write your own `collection.get()`, paginate with `limit`/`offset` of 300 or less, or you'll get a "Quota exceeded" error. Deletes aren't capped.
10. **Jobs run inside the server process.** If the server restarts mid-job, the job is marked `failed` at startup ("Server restarted during indexing"). Run a re-index to recover.
11. **Repos are identified by URL.** GitHub renames or transfers create a new repository entry.
12. **Only GitHub is supported,** not GitLab or Bitbucket.

## Notes per teammate

### Ethan
- **I patched `src/services/rag/retriever.js` on the `Gabriel` branch.** The old version called Chroma's removed `/api/v1` API on localhost, so it always fell back to sample chunks. The patch adds a block at the top of `retrieveCodeChunks` that calls `queryChunks()` from `src/db/chroma.js`, which works with both Chroma Cloud and a local server. It returns **code chunks only**, and your fallback below it is unchanged. Your branch has a newer `retriever.js`, so when merging, keep the block marked `[Gabriel]` and your new fallback.
  - To bring git history into answers, call `queryChunks({ ..., chunkTypes: ['commit', 'pull_request'] })`. History chunks have no file or line numbers, so cite them using `metadata.url`.
  - `repoId` should be the `repositoryId` UUID from `/api/repos`. A non-UUID such as `"TRACiE"` searches all indexed repos.
- **Logging chat turns to Postgres is one line in `pipeline.js`,** after the widget is built:
  ```js
  const { logTurn } = require('../sessions/sessionStore');
  await logTurn({ sessionId, query, chunks, widget });   // no-op for non-UUID ids like "session-1"; never throws
  ```
  `chunks` must be the retrieved chunks, since their `chunk_id`s are stored as `retrieved_chunk_ids`. For SSE, either log after `complete`, or log the question first and attach the answer later with `PATCH /api/queries/:id`.
- **Doc proposals:** in `routes/docs.js`, replace the in-memory `proposalStore` Map with `createProposal`/`listProposals`/`reviewProposal` from `src/services/docs/proposalStore.js`. They take and return your widget shape unchanged. The database needs a real repository UUID, so pass `repoId` through.
- **Your `/api/sessions/:id/history` and `DELETE /api/sessions/:id` are untouched.** My session routes use different paths.
- **Embedding input limit:** chunks are at most 1,500 characters, but consider adding `parameters: { truncate_input_tokens: 512 }` to the watsonx embedding request anyway.

### Newlove (frontend)
- Connecting a repo: call `POST /api/repos` with `{ url }`, then poll `GET /api/repos/:id/status` every 1–2 s until `status` is `complete` or `failed`. Use `progress` (0–1) for the bar and `stage` for the label.
- Starting a chat: call `POST /api/sessions` with `{ repositoryId }` and send the returned `sessionId` with every `/api/query` call. Use the `repositoryId` UUID as `repoId`.
- The doc review panel can use `GET /api/repos/:id/doc-proposals?status=pending` with `POST /api/doc-proposals/:id/approve|reject`. The objects have the same shape as the `doc_proposal` widget.

### Romel (rendering)
- Doc proposals from the database come back in the same `doc_proposal` widget shape, with `type: "doc_proposal"`, so your renderer can use them directly.

## Where things live
```
migrations/                    SQL migrations (npm run db:migrate)
src/config/backend.js          all of Gabriel's env config
src/db/postgres.js, chroma.js  database clients; chroma.js has queryChunks()
src/db/migrate.js              migration runner
src/services/ingestion/        fetchRepo, fileWalker, chunker, embedder, history, pipeline
src/services/repos/            repositories / indexing_jobs / indexed_files queries
src/services/sessions/         sessions + queries persistence (logTurn)
src/services/docs/             doc_proposals persistence
src/routes/                    repos.js, webhooks.js, sessions.js, docProposals.js (+ Ethan's)
```

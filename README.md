# TRACiE: Codebase-Aware AI Developer Onboarding Assistant
**IBM Bob 2.0 Hackathon Project**

TRACiE is an intelligent codebase onboarding assistant built with an **IBM Bee-Style Multi-Agent Architecture** running on **Groq LPU Acceleration** and **IBM watsonx.ai Hybrid Governance**.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |       Developer UI / Chat Panel       |
                      +---------------------------------------+
                                          |
                              POST /api/query / SSE /api/stream
                                          v
                      +---------------------------------------+
                      |   TRACiE Supervisor (BeeAI Pattern)   |
                      +---------------------------------------+
                                          |
                 +------------------------+------------------------+
                 |                        |                        |
                 v                        v                        v
        +------------------+    +--------------------+   +-------------------+
        | ArchitectSubagent|    |CodeExplainerAgent  |   |CurriculumSubagent |
        | (Mermaid Diagram)|    | (Syntax + Citations|   | (Quizzes / Paths) |
        +------------------+    +--------------------+   +-------------------+
                 \                        |                        /
                  +-----------------------+-----------------------+
                                          |
                                          v
                      +---------------------------------------+
                      | Dynamic UI Widgets (Romel UIRenderer) |
                      +---------------------------------------+
```

### Agentic Features:
1. **TRACiE Supervisor (Lead Orchestrator):** Analyzes incoming developer queries, classifies intent, and delegates to specialized subagents.
2. **Subagents:**
   - **`ArchitectSubagent`**: Generates Mermaid.js system topologies (`architecture_diagram`).
   - **`CodeExplainerSubagent`**: Extracts code implementations with line citations (`code_snippet`).
   - **`NavigatorSubagent`**: Generates interactive directory hierarchies (`file_tree`).
   - **`CurriculumSubagent`**: Generates interactive codebase quizzes (`quiz`) and onboarding tutorials.
   - **`GeneralQASubagent`**: Synthesizes verified markdown answers with citations (`chat_response`).
3. **Real-Time Agent Thought Streaming:** Emits `agent_thought` and `agent_handoff` events over Server-Sent Events (`/api/stream`) for UI observability.
4. **Bobcoin Metric:** Tracks and reports computation token efficiency and estimated Bobcoins per interaction.

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and set your preferred provider:
```bash
cp .env.example .env
```
Key settings in `.env`:
```ini
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=openai/gpt-oss-120b
```

### 3. Run Pipeline Tests
```bash
npm run test:rag
```

### 4. Start the Server
```bash
npm start
```
Default server port is `3000`.

---

## API Endpoints (For Newlove & Romel)

### 1. `POST /api/query`
Standard REST endpoint returning structured JSON widgets.
```json
{
  "query": "How is authentication handled in TRACiE?",
  "repoId": "TRACiE",
  "sessionId": "session-1"
}
```

### 2. `GET /api/stream?query=...` (Server-Sent Events)
Streams real-time agent thoughts and token deltas:
- `event: status` — Pipeline status (`"Analyzing codebase..."`).
- `event: agent_thought` — Reasoning from the supervisor or subagent.
- `event: agent_handoff` — Subagent delegation (`"Supervisor -> ArchitectSubagent"`).
- `event: token` — Token delta chunk.
- `event: complete` — Complete validated UI widget JSON object.
- `event: done` — Stream completion.

### 3. `GET /api/fixtures`
Returns mock fixtures for all Phase 1 widgets for offline UI testing.

---

## Backend Infrastructure & Repository Ingestion (Gabriel)

### Setup
```bash
cp .env.example .env            # fill DATABASE_URL (Supabase "Session pooler" string)
                                # + CHROMA_API_KEY/TENANT/DATABASE for the shared Chroma Cloud index
# Only if running ChromaDB locally instead of Chroma Cloud:
#   pip install chromadb && npm run chroma     # http://localhost:8000
npm run db:migrate              # creates tables (safe to re-run)
npm start                       # terminal 2
npm run test:ingest             # optional: clone->chunk->embed->Chroma smoke test (no Postgres needed)
```
`GET /api/health` reports `postgres` and `chromadb` reachability.

### Repository API
| Method | Route | Body / Response |
|---|---|---|
| `POST` | `/api/repos` | `{ url, token? }` → `202 { repositoryId, jobId, repository, job }` |
| `GET` | `/api/repos` | `{ repositories: [{ id, name, url, indexStatus, latestJob }] }` |
| `GET` | `/api/repos/:id` | repository details |
| `GET` | `/api/repos/:id/status` | `{ status, stage, chunksDone, chunksTotal, progress (0-1), error }` — poll every 1-2s |
| `POST` | `/api/repos/:id/reindex` | `202 { repositoryId, jobId }` |

`status`: `pending → running → complete | failed`. `stage`: `queued → cloning → parsing → embedding → done`.

### Where things plug in
- **Embeddings (Ethan):** `src/services/ingestion/embedder.js` is the only place ingestion calls the embedding model.
- **Retrieval (Ethan):** `queryChunks({ embedding, repositoryId, topK })` in `src/db/chroma.js`.
- **Chunk metadata** in the `code_chunks` collection: `chunk_id, repository_id, file_path, language, start_line, end_line, module_name, symbols`.
- **Phase 2 stubs** (return 501): `src/routes/phase2.js`.

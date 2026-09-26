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

- **[API.md](API.md)**: every backend route with its request and response shapes
- **[HANDOFF.md](HANDOFF.md)**: what's built, known limitations, and notes for each teammate

### Run from a clean clone
Postgres (Supabase) and ChromaDB (Chroma Cloud) are hosted, so there's nothing to install locally besides Node and git.
```bash
npm install
cp .env.example .env    # paste the shared DATABASE_URL, CHROMA_*, GITHUB_WEBHOOK_SECRET, TOKEN_ENCRYPTION_KEY
npm run db:migrate      # create/update tables (idempotent)
npm start               # http://localhost:3000  (PowerShell: $env:PORT=3001; npm start  if 3000 is taken)
```
Check it at `GET /api/health`, which should show `"status":"ok"`. For a pipeline smoke test without the server, run `npm run test:ingest`.

Offline alternative for ChromaDB: `pip install chromadb`, run `npm run chroma` in a second terminal, and leave `CHROMA_API_KEY` empty.

### Main routes
| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/repos` | Connect a GitHub repo `{ url, token? }` and start indexing |
| `GET` | `/api/repos`, `/api/repos/:id` | List repos / get one repo |
| `GET` | `/api/repos/:id/status` | Poll indexing progress |
| `POST` | `/api/repos/:id/reindex` | Re-index (incremental; `{ full: true }` rebuilds) |
| `POST` | `/api/webhooks/github` | Push-triggered re-index (called by GitHub) |
| `POST`/`GET` | `/api/sessions`, `/api/sessions/:id` | Persistent chat sessions and their logged queries |
| `POST`/`GET` | `/api/repos/:id/doc-proposals` | Store / list documentation proposals |
| `POST` | `/api/doc-proposals/:id/approve` \| `reject` | Review a proposal |

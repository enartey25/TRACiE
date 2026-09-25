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

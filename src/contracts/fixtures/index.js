const { getCompleteRepositoryTree } = require('../../services/navigator/repositoryScanner');

const fixtures = {
  chat_response: {
    type: "chat_response",
    content: "### Authentication Middleware Overview\n\nThe project uses JWT-based authentication implemented in `src/middleware/auth.js`. Requests pass through `verifyToken` which validates the bearer token against `process.env.JWT_SECRET`.\n\nKey features:\n- Extracts authorization header\n- Verifies cryptographic signature\n- Injects decoded user object into `req.user`",
    citations: [
      {
        file_path: "src/middleware/auth.js",
        start_line: 14,
        end_line: 38,
        snippet: "const jwt = require('jsonwebtoken');\nfunction verifyToken(req, res, next) { ... }"
      }
    ],
    external_references: [
      {
        title: "JSON Web Token (JWT) Standard (RFC 7519)",
        url: "https://datatracker.ietf.org/doc/html/rfc7519",
        source: "academic_paper",
        description: "Official IETF specification for compact claim tokens."
      },
      {
        title: "jsonwebtoken on npm",
        url: "https://www.npmjs.com/package/jsonwebtoken",
        source: "npm",
        description: "Node.js JWT implementation reference and verify options."
      }
    ]
  },

  code_snippet: {
    type: "code_snippet",
    file_path: "src/services/db.js",
    language: "javascript",
    start_line: 25,
    end_line: 39,
    code: "const { Pool } = require('pg');\n\nconst pool = new Pool({\n  connectionString: process.env.DATABASE_URL,\n  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false\n});\n\nmodule.exports = {\n  query: (text, params) => pool.query(text, params)\n};",
    explanation: "PostgreSQL connection pool setup with dynamic SSL handling for production environments."
  },

  file_tree: {
    type: "file_tree",
    title: "Complete TRACiE Repository Layout",
    root: getCompleteRepositoryTree()
  },

  architecture_diagram: {
    type: "architecture_diagram",
    title: "TRACiE Multi-Agent RAG Pipeline & System Architecture",
    diagram_source: `flowchart TD
 %% User Interface
 subgraph UI["Frontend & Interaction"]
 direction TB
 Browser["Browser / Developer Canvas"]
 HTML["public/index.html"]
 CSS["public/index.css"]
 JS["public/app.js"]
 Browser --> HTML
 HTML --> CSS
 HTML --> JS
 end

 %% API Layer
 subgraph API["API Gateway & Routes"]
 direction TB
 Server["src/server.js<br/>(Express HTTP & SSE)"]
 
 subgraph Routes["Route Handlers"]
 direction TB
 RQuery["routes/query.js"]
 RStream["routes/stream.js"]
 RDocs["routes/docs.js"]
 RAudio["routes/audio.js"]
 RSess["routes/session.js"]
 RRepos["routes/repos.js"]
 RWebhooks["routes/webhooks.js"]
 end
 
 Server --> Routes
 end

 %% Core Orchestration
 subgraph Core["Core Orchestration & Agents"]
 direction TB
 Supervisor["services/agents/supervisor.js<br/>(BeeAI Multi-Agent Supervisor)"]
 Subagent["services/agents/runSubagent.js"]
 Prompts["src/prompts/<br/>systemPrompt.js<br/>promptTemplates.js"]
 
 Supervisor --> Subagent
 Subagent --> Prompts
 end

 %% RAG Pipeline
 subgraph RAG["RAG Pipeline & Retrieval"]
 direction TB
 RAGPipeline["services/rag/pipeline.js"]
 Retriever["services/rag/retriever.js"]
 Cache["services/rag/ragCache.js"]
 Parser["services/rag/jsonParser.js"]
 Enricher["services/enrichment/contextEnricher.js"]
 
 RAGPipeline --> Retriever
 RAGPipeline --> Enricher
 Retriever --> Cache
 Retriever --> Parser
 end

 %% Ingestion Pipeline
 subgraph Ingestion["Data Ingestion & Indexing"]
 direction TB
 IngestPipeline["services/ingestion/pipeline.js"]
 Fetcher["services/ingestion/fetchRepo.js"]
 Walker["services/ingestion/fileWalker.js"]
 Chunker["services/ingestion/chunker.js"]
 Embedder["services/ingestion/embedder.js"]
 History["services/ingestion/history.js"]
 
 IngestPipeline --> Fetcher
 Fetcher --> Walker
 Walker --> Chunker
 Chunker --> Embedder
 Embedder --> History
 end

 %% AI Providers
 subgraph AI["AI Providers & Generators"]
 direction TB
 subgraph WatsonX["IBM WatsonX"]
 WAuth["services/watsonx/auth.js"]
 WEmbed["services/watsonx/embedding.js"]
 WGen["services/watsonx/generator.js"]
 end
 
 subgraph Groq["Groq"]
 GGen["services/groq/generator.js"]
 end
 
 subgraph HF["HuggingFace"]
 HGen["services/huggingface/generator.js"]
 end
 
 TTS["services/audio/ttsService.js"]
 end

 %% Data Stores
 subgraph Data["Data Persistence & Memory"]
 direction TB
 subgraph VectorDB["Vector Database (Chroma)"]
 Chroma["src/db/chroma.js"]
 ChromaData["chroma_data/<br/>(.bin, .sqlite3)"]
 Chroma --> ChromaData
 end
 
 subgraph RelationalDB["Relational Database (Postgres)"]
 Postgres["src/db/postgres.js"]
 Migrate["src/db/migrate.js"]
 Migrations["migrations/<br/>(.sql)"]
 Postgres --> Migrate
 Migrate --> Migrations
 end
 
 SessionMem["services/memory/sessionMemory.js"]
 RepoStore["services/repos/repoStore.js"]
 SessionStore["services/sessions/sessionStore.js"]
 DocStore["services/docs/proposalStore.js"]
 end

 %% Config & Utils
 subgraph Config["Configuration & Utilities"]
 direction TB
 EnvConfig["src/config/backend.js"]
 WConfig["src/config/watsonx.js"]
 Crypto["src/utils/crypto.js"]
 Contracts["src/contracts/<br/>(responseSchema.json)"]
 end

 %% Connections: UI to API
 JS -->|"HTTP / SSE"| Server

 %% Connections: API to Core
 RQuery --> Supervisor
 RStream --> Supervisor
 RDocs --> DocStore
 RAudio --> TTS
 RSess --> SessionStore
 RRepos --> RepoStore
 RWebhooks --> IngestPipeline

 %% Connections: Core to RAG & AI
 Supervisor --> RAGPipeline
 Supervisor --> WGen
 Supervisor --> GGen
 Supervisor --> HGen
 
 %% Connections: RAG to Data
 Retriever --> Chroma
 Enricher --> SessionMem
 
 %% Connections: Ingestion to Data & AI
 Embedder --> WEmbed
 Embedder --> Chroma
 IngestPipeline --> RepoStore
 
 %% Connections: AI to Config
 WAuth --> WConfig
 WEmbed --> WConfig
 WGen --> WConfig
 
 %% Connections: Data to Config
 Postgres --> EnvConfig
 Chroma --> EnvConfig
 
 %% Styling
 classDef ui fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
 classDef api fill:#fff9c4,stroke:#fbc02d,stroke-width:2px;
 classDef core fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
 classDef rag fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px;
 classDef ingest fill:#ffebee,stroke:#c62828,stroke-width:2px;
 classDef ai fill:#e0f2f1,stroke:#00695c,stroke-width:2px;
 classDef data fill:#eceff1,stroke:#455a64,stroke-width:2px;
 classDef config fill:#fff3e0,stroke:#ef6c00,stroke-width:2px;

 class Browser,HTML,CSS,JS ui;
 class Server,RQuery,RStream,RDocs,RAudio,RSess,RRepos,RWebhooks api;
 class Supervisor,Subagent,Prompts core;
 class RAGPipeline,Retriever,Cache,Parser,Enricher rag;
 class IngestPipeline,Fetcher,Walker,Chunker,Embedder,History ingest;
 class WAuth,WEmbed,WGen,GGen,HGen,TTS ai;
 class Chroma,ChromaData,Postgres,Migrate,Migrations,SessionMem,RepoStore,SessionStore,DocStore data;
 class EnvConfig,WConfig,Crypto,Contracts config;`,
    caption: "Complete end-to-end component topology showing interconnected paths and communication protocols across TRACiE."
  },

  sequence_diagram: {
    type: "architecture_diagram",
    title: "Real-Time Query & SSE Thought Streaming Sequence",
    diagram_source: `sequenceDiagram
    autonumber
    actor Dev as Developer
    participant Canvas as Browser Canvas
    participant API as Express Server
    participant Sup as BeeAI Supervisor
    participant Chroma as ChromaDB
    participant Groq as Groq LPU (120B)
    participant TTS as ElevenLabs API

    Dev->>Canvas: Submits query ("Show architecture")
    Canvas->>API: GET /api/stream?query=...
    activate API
    API-->>Canvas: event: status (Analyzing codebase...)

    API->>Sup: orchestrateAgents(query)
    activate Sup
    Sup-->>API: onThought("Intent analysis...")
    API-->>Canvas: event: agent_thought

    Sup->>Chroma: ANN Vector Search
    Chroma-->>Sup: Top-k Relevant Chunks

    Sup-->>API: onThought("Delegating to ArchitectSubagent")
    API-->>Canvas: event: agent_handoff

    Sup->>Groq: Generate Structured JSON Widget
    activate Groq
    Groq-->>Sup: Valid Widget JSON (architecture_diagram)
    deactivate Groq

    opt If Audio Briefing Requested
      Sup->>TTS: POST /v1/text-to-speech
      TTS-->>Sup: Studio MP3 Base64 Data URI
    end

    Sup-->>API: Complete Validated Widget
    deactivate Sup

    API-->>Canvas: event: complete (widget payload)
    API-->>Canvas: event: done
    deactivate API

    Canvas->>Dev: Renders interactive Mermaid diagram`,
    caption: "Detailed step-by-step lifeline sequence from query submission to live diagram rendering."
  },

  er_diagram: {
    type: "architecture_diagram",
    title: "PostgreSQL Database Schema & Entity Relationships",
    diagram_source: `erDiagram
    USERS ||--o{ SESSIONS : "creates"
    USERS {
      uuid id PK
      string username
      string email
      string role
      timestamp created_at
    }

    SESSIONS ||--o{ QUERIES : "contains"
    SESSIONS ||--o{ DOC_PROPOSALS : "generates"
    SESSIONS {
      uuid id PK
      uuid user_id FK
      string session_title
      float bobcoins_consumed
      timestamp started_at
      timestamp last_active
    }

    QUERIES ||--o{ CITATIONS : "references"
    QUERIES {
      uuid id PK
      uuid session_id FK
      text query_text
      string routed_agent
      string widget_type
      jsonb response_payload
      timestamp created_at
    }

    CITATIONS {
      uuid id PK
      uuid query_id FK
      string file_path
      int start_line
      int end_line
      text snippet
    }

    DOC_PROPOSALS {
      uuid id PK
      uuid session_id FK
      string target_file
      text diff_markdown
      text rationale
      string pr_title
      string status
      timestamp created_at
    }`,
    caption: "Supabase-style Entity Relationship Diagram representing TRACiE's relational PostgreSQL models."
  },

  uml_diagram: {
    type: "architecture_diagram",
    title: "Multi-Agent System UML Class Architecture",
    diagram_source: `classDiagram
    class TRACiESupervisor {
      +Array AGENT_ROUTES
      +orchestrateAgents(params) Promise~Widget~
      +selectAgent(query) AgentRoute
    }

    class SubagentRunner {
      +runSubagent(params) Promise~Widget~
      +emit(onThought, payload) void
    }

    class RAGPipeline {
      +executeRAGQuery(params) Promise~Widget~
    }

    class ChromaRetriever {
      +retrieveRelevantChunks(query, topK) Promise~Array~
    }

    class SessionMemory {
      -Map sessions
      +getHistory(sessionId) Array
      +addTurn(sessionId, role, text) void
      +clearSession(sessionId) void
    }

    class ContextEnricher {
      +enrichQuery(query) Promise~string~
      +fetchMDNDoc(term) Promise~string~
    }

    class TTSService {
      +synthesizeBriefing(params) Promise~Widget~
      +synthesizeWithElevenLabs(text) Promise~string~
    }

    TRACiESupervisor --> SubagentRunner : delegates
    RAGPipeline --> TRACiESupervisor : orchestrates
    RAGPipeline --> ChromaRetriever : retrieves
    RAGPipeline --> SessionMemory : tracks turns
    RAGPipeline --> ContextEnricher : enriches
    SubagentRunner --> TTSService : calls on audio`,
    caption: "UML Class Diagram illustrating object structures, methods, and coupling across core services."
  },

  key_value_list: {
    type: "key_value_list",
    title: "Repository Metadata & Health",
    items: [
      { key: "Repository Name", value: "TRACiE", description: "Codebase-Aware Developer Assistant" },
      { key: "Language", value: "Node.js / Express / Vanilla JS", description: "Full-stack JavaScript environment" },
      { key: "Vector Dimensions", value: "768 float32", description: "IBM Granite embedding standard" },
      { key: "Indexed Chunks", value: "1,420 chunks", description: "Functions, classes and module boundaries" },
      { key: "Sync Status", value: "Continuous (Webhook Active)", description: "Auto-indexes push events" }
    ]
  },

  composite_dashboard: {
    type: "composite_dashboard",
    title: "Repository Onboarding Briefing",
    description: "Overview dashboard generated for new developers joining the TRACiE repository.",
    components: [
      {
        type: "chat_response",
        content: "Welcome to **TRACiE**! Below is an architectural overview and quick-start configuration.",
        citations: []
      },
      {
        type: "architecture_diagram",
        title: "System High-Level Diagram",
        diagram_source: `graph LR
        Client["Browser UI"] --> Server["Node.js Express"]
        Server --> Watson["watsonx.ai"]
        Server --> Chroma["ChromaDB"]`,
        caption: "Core components diagram"
      },
      {
        type: "key_value_list",
        title: "Key Configuration Variables",
        items: [
          { key: "PORT", value: "3000", description: "Default backend port" },
          { key: "WATSONX_URL", value: "https://us-south.ml.cloud.ibm.com", description: "IBM Cloud endpoint" }
        ]
      }
    ]
  },

  alert_card: {
    type: "alert_card",
    severity: "warning",
    title: "Partial Context Available",
    message: "Some code chunks could not be retrieved from ChromaDB; answering with available context."
  },

  // ==========================================
  // Phase 2 Widgets
  // ==========================================

  quiz: {
    type: "quiz",
    title: "TRACiE Pipeline Quiz",
    questions: [
      {
        question: "How does the TRACiE RAG pipeline ensure LLM output conforms to widget schemas?",
        options: [
          "Using client-side regex search after rendering",
          "Using system prompt schema enforcement and jsonParser fallback repair",
          "By disallowing any text longer than 100 characters",
          "By manually approving every response in PostgreSQL"
        ],
        correct_index: 1,
        explanation: "TRACiE pairs a strict system prompt prohibiting free text with jsonParser.js, which sanitizes code fences and extracts the valid JSON object.",
        code_context: "src/services/rag/jsonParser.js"
      },
      {
        question: "Where does TRACiE keep the conversation history used for follow-up questions?",
        options: [
          "In an in-memory store keyed by chat session id",
          "In the browser's localStorage",
          "Inside the ChromaDB vector collection",
          "In the GitHub repository being analysed"
        ],
        correct_index: 0,
        explanation: "sessionMemory.js records each turn per session id and formats the last few turns into the prompt.",
        code_context: "src/services/memory/sessionMemory.js"
      },
      {
        question: "What happens when ElevenLabs cannot synthesize an audio briefing?",
        options: [
          "The request fails with a 500 error",
          "The briefing is queued and retried later",
          "The widget falls back to the browser's built-in speech synthesis",
          "The transcript is hidden from the user"
        ],
        correct_index: 2,
        explanation: "ttsService.js returns the transcript without an audio URL, and the frontend reads it aloud with the Web Speech API.",
        code_context: "src/services/audio/ttsService.js"
      }
    ]
  },

  flashcard_deck: {
    type: "flashcard_deck",
    title: "TRACiE Core Concepts Flashcards",
    description: "Essential architectural concepts for new developers contributing to TRACiE.",
    cards: [
      {
        id: "fc-1",
        front: "What is the primary role of the TRACiE Supervisor Agent?",
        back: "The Supervisor analyzes incoming developer intent and delegates to specialized subagents (Architect, CodeExplainer, Navigator, Curriculum) following the IBM BeeAI pattern.",
        tag: "Architecture",
        citation: "src/services/agents/supervisor.js"
      },
      {
        id: "fc-2",
        front: "How are code chunks stored and retrieved in the vector database?",
        back: "Source files are semantically chunked with Tree-sitter, embedded as 768-dimensional dense vectors via watsonx/Granite, and indexed in ChromaDB for ANN similarity search.",
        tag: "Vector DB",
        citation: "src/services/rag/retriever.js"
      },
      {
        id: "fc-3",
        front: "What is the contract between Ethan's backend and Romel's UIRenderer?",
        back: "Every response must be a valid JSON object with a mandatory 'type' discriminator property (e.g., 'architecture_diagram', 'code_snippet', 'quiz').",
        tag: "Contract",
        citation: "src/contracts/responseSchema.json"
      }
    ]
  },

  tutorial_steps: {
    type: "tutorial_steps",
    title: "How to Add a New Subagent to TRACiE",
    description: "Step-by-step developer tutorial for extending the IBM Bee-style multi-agent system.",
    prerequisites: ["Node.js v24 installed", "Basic knowledge of Groq or watsonx completions"],
    steps: [
      {
        step_number: 1,
        title: "Create the Subagent Module",
        instructions: "Create a new file in `src/services/agents/` exporting an asynchronous runner function.",
        code: "async function runMyNewSubagent({ query, chunks, onThought }) { ... }\nmodule.exports = { runMyNewSubagent };",
        file_path: "src/services/agents/myNewSubagent.js"
      },
      {
        step_number: 2,
        title: "Register Intent in Supervisor",
        instructions: "Import your new subagent into `src/services/agents/supervisor.js` and add routing condition in `orchestrateAgents()`.",
        code: "if (q.includes('security')) { selectedAgent = 'SecuritySubagent'; }",
        file_path: "src/services/agents/supervisor.js"
      },
      {
        step_number: 3,
        title: "Define the Widget Schema",
        instructions: "Add your new widget type to `src/contracts/responseSchema.json` so Romel's UIRenderer dispatches correctly.",
        file_path: "src/contracts/responseSchema.json"
      }
    ]
  },

  learning_path: {
    type: "learning_path",
    title: "Backend Engineer Onboarding Curriculum",
    description: "Structured learning roadmap to master the TRACiE codebase in 3 days.",
    target_role: "Junior / Mid-Level Backend Developer",
    estimated_hours: 6.5,
    modules: [
      {
        module_id: "mod-1",
        title: "1. Core Pipeline & Watsonx Architecture",
        description: "Understand authentication, IAM token caching, and vector embedding generation.",
        topics: ["IBM Cloud IAM OAuth", "Granite & Slate Embeddings", "ChromaDB ANN Retrieval"],
        milestones: ["Run `npm run test:auth`", "Execute sample query via `npm run test:rag`"]
      },
      {
        module_id: "mod-2",
        title: "2. The BeeAI Multi-Agent System",
        description: "Learn how the Supervisor orchestrates Architect, CodeExplainer, and Curriculum subagents.",
        topics: ["Supervisor Intent Analysis", "Agent Thought Streaming", "Subagent Handoff Events"],
        milestones: ["Inspect `supervisor.js`", "Trigger each subagent via quick prompt chips"]
      },
      {
        module_id: "mod-3",
        title: "3. UI Contracts & SSE Real-Time Streaming",
        description: "Connect frontend SSE clients to `/api/stream` and assemble dynamic widgets.",
        topics: ["Server-Sent Events", "Mermaid.js Integration", "Prism.js Syntax Highlighting"],
        milestones: ["Review `responseSchema.json`", "Mount a custom widget in `app.js`"]
      }
    ]
  },

  doc_proposal: {
    type: "doc_proposal",
    proposal_id: "prop-882",
    target_file: "README.md",
    diff_markdown: `--- a/README.md
+++ b/README.md
@@ -12,3 +12,8 @@
 ### Supported Engines
 - **Groq LPU Acceleration:** Sub-second 120B inference
 - **IBM watsonx.ai Hybrid Governance:** Enterprise Granite models
+
+### Multi-Agent Streaming
+- \`event: agent_thought\` streams reasoning in real-time
+- \`event: agent_handoff\` shows subagent delegation`,
    rationale: "Recent updates added agent thought streaming and multi-engine support, which were not documented in the main README overview.",
    pr_title: "docs: update README with multi-agent streaming and engine details",
    pr_body: "Automated documentation proposal generated by TRACiE DocWriterAgent based on recent code commits.",
    affected_components: ["src/routes/stream.js", "src/services/agents/supervisor.js"]
  },

  audio_player: {
    type: "audio_player",
    title: "Architecture Briefing (Spoken Summary)",
    transcript: "Welcome to TRACiE. The application is built on an Express backend powered by IBM's BeeAI multi-agent framework. Queries enter the supervisor, which retrieves relevant codebase chunks from ChromaDB and dispatches tasks to specialized subagents for architecture diagramming, code walkthroughs, and interactive quizzes.",
    audio_url: "https://actions.google.com/sounds/v1/science_fiction/scifi_hum.ogg",
    duration_seconds: 14.5
  }
};

module.exports = fixtures;

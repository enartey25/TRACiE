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
    title: "TRACiE Connected Subsystem Topology (Supabase-Style)",
    diagram_source: `flowchart TD
    subgraph Presentation ["🖥️ Presentation Layer (Developer Canvas)"]
      UI["public/index.html & app.js"]
      SSEListener["EventSource SSE Client"]
    end

    subgraph APILayer ["⚡ Express API Gateway (port 3000)"]
      Server["src/server.js"]
      StreamEndpoint["/api/stream (SSE)"]
      QueryEndpoint["/api/query (REST)"]
      DocsEndpoint["/api/docs (Proposals)"]
      AudioEndpoint["/api/audio (TTS)"]
    end

    subgraph AgentCore ["🧠 IBM BeeAI Multi-Agent Core"]
      Supervisor["Supervisor (supervisor.js)"]
      RunSubagent["Subagent Runner (runSubagent.js)"]
      ArchitectAgent["ArchitectSubagent (Diagrams)"]
      ExplainerAgent["CodeExplainerSubagent"]
      NavAgent["NavigatorSubagent (Layout)"]
      CurriculumAgent["CurriculumSubagent (Quiz/Deck)"]
      DocAgent["DocWriterSubagent (Diffs)"]
      AudioAgent["AudioSubagent (Voice)"]
    end

    subgraph Intelligence ["⚙️ RAG & Knowledge Services"]
      RAG["src/services/rag/pipeline.js"]
      Retriever["src/services/rag/retriever.js"]
      Parser["src/services/rag/jsonParser.js"]
      Memory["src/services/memory/sessionMemory.js"]
      Enricher["src/services/enrichment/contextEnricher.js"]
    end

    subgraph External ["🌐 External Engines & Storage"]
      Chroma["ChromaDB Vector Store (port 8000)"]
      Groq["Groq LPU (gpt-oss-120b)"]
      WatsonX["IBM watsonx.ai (Granite 3.0)"]
      ElevenLabs["ElevenLabs Studio (Turbo v2.5)"]
    end

    UI -->|User Question| StreamEndpoint
    StreamEndpoint --> Server
    Server --> RAG
    RAG --> Memory
    RAG --> Enricher
    RAG --> Retriever
    Retriever -->|Cosine Similarity ANN| Chroma
    RAG --> Supervisor
    Supervisor -->|Intent Routing| AgentCore
    AgentCore --> RunSubagent
    RunSubagent -->|Ultra-Fast Inference| Groq
    RunSubagent -.->|Enterprise Model| WatsonX
    AudioAgent -->|Studio Audio MP3| ElevenLabs
    RunSubagent --> Parser
    Parser -->|Validated JSON Widget| Server
    Server -->|SSE agent_thought & complete| SSEListener
    SSEListener --> UI`,
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

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
    title: "Project Architecture Tree",
    root: {
      name: "TRACiE",
      type: "directory",
      path: "/",
      description: "Root repository folder",
      children: [
        {
          name: "src",
          type: "directory",
          path: "/src",
          children: [
            { name: "config", type: "directory", path: "/src/config", children: [] },
            { name: "services", type: "directory", path: "/src/services", children: [] },
            { name: "routes", type: "directory", path: "/src/routes", children: [] },
            { name: "server.js", type: "file", path: "/src/server.js", description: "Express app entry point" }
          ]
        },
        { name: "package.json", type: "file", path: "/package.json", description: "Node.js dependencies & scripts" }
      ]
    }
  },

  architecture_diagram: {
    type: "architecture_diagram",
    title: "RAG Query Pipeline Architecture",
    diagram_source: `graph TD
    User["Developer UI / Chat Panel"] -->|POST /api/query| API["Express Query Route"]
    API -->|Generate Query Vector| WatsonEmbed["watsonx.ai Embeddings API"]
    WatsonEmbed -->|Dense Vector| Chroma["ChromaDB Vector Store"]
    Chroma -->|Top-k Code Chunks| PromptEngine["Prompt Assembler"]
    PromptEngine -->|System Prompt + Chunks + Query| WatsonGen["watsonx.ai Text Generation"]
    WatsonGen -->|Structured JSON| UIRenderer["Dynamic UIRenderer (Browser)"]`,
    caption: "Data flow for developer queries entering TRACiE and returning rich widgets."
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
  }
};

module.exports = fixtures;

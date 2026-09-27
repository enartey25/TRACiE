const { runSubagent } = require('./runSubagent');
const { getRepositoryTreeForTarget } = require('../navigator/repositoryScanner');
const {
  buildArchitectPrompt,
  buildCodeExplainerPrompt,
  buildNavigatorPrompt,
  buildQuizPrompt,
  buildFlashcardDeckPrompt,
  buildTutorialStepsPrompt,
  buildLearningPathPrompt,
  buildDocProposalPrompt,
  buildAudioBriefingPrompt,
  buildGeneralQAPrompt,
} = require('../../prompts/promptTemplates');

/**
 * Declarative routing table for the TRACiE Supervisor (IBM BeeAI Pattern).
 * Maps developer intents to specialized autonomous subagents.
 */
const AGENT_ROUTES = [
  {
    name: 'FlashcardSubagent',
    keywords: ['flashcard', 'flash card', 'cards', 'deck'],
    reason: 'Query requests interactive concept study flashcards',
    action: 'generate_flashcards',
    thought: 'Designing interactive Q&A concept flashcards grounded in repository architecture.',
    systemPrompt: 'You are an expert developer educator. Output ONLY valid JSON matching the schema.',
    buildPrompt: buildFlashcardDeckPrompt,
  },
  {
    name: 'TutorialSubagent',
    keywords: ['tutorial', 'step by step', 'walkthrough', 'guide me', 'how to add', 'how to build'],
    reason: 'Query requests numbered step-by-step developer walkthrough',
    action: 'generate_tutorial',
    thought: 'Constructing sequential developer instructions and prerequisites from source code.',
    systemPrompt: 'You are an expert developer educator. Output ONLY valid JSON matching the schema.',
    buildPrompt: buildTutorialStepsPrompt,
  },
  {
    name: 'LearningPathSubagent',
    keywords: ['learning path', 'curriculum', 'roadmap', 'onboarding path', 'syllabus'],
    reason: 'Query requests structured multi-module developer onboarding curriculum',
    action: 'generate_curriculum',
    thought: 'Synthesizing tiered onboarding milestones and competencies from repository components.',
    systemPrompt: 'You are an expert developer educator. Output ONLY valid JSON matching the schema.',
    buildPrompt: buildLearningPathPrompt,
  },
  {
    name: 'QuizSubagent',
    keywords: ['quiz', 'test my knowledge', 'challenge', 'exam', 'multiple choice'],
    reason: 'Query requests interactive codebase comprehension quiz',
    action: 'generate_quiz',
    thought: 'Designing codebase comprehension quiz with distractor options and verified explanation.',
    systemPrompt: 'You are an expert developer educator. Output ONLY valid JSON matching the schema.',
    buildPrompt: buildQuizPrompt,
  },
  {
    name: 'DocWriterSubagent',
    keywords: ['doc proposal', 'update docs', 'readme diff', 'documentation proposal', 'propose doc'],
    reason: 'Query requests automated documentation change proposal and pull request draft',
    action: 'generate_doc_proposal',
    thought: 'Analyzing code modifications to generate unified documentation diff and PR draft.',
    systemPrompt: 'You are an expert technical writer and Git analyst. Output ONLY valid JSON matching the schema.',
    buildPrompt: buildDocProposalPrompt,
  },
  {
    name: 'AudioSubagent',
    keywords: ['audio', 'voice', 'speech', 'listen', 'spoken', 'briefing', 'podcast'],
    reason: 'Query requests natural spoken audio explanation or briefing',
    action: 'generate_audio_briefing',
    thought: 'Composing conversational spoken transcript for text-to-speech audio synthesis.',
    systemPrompt: 'You are a technical narrator. Output ONLY valid JSON matching the schema.',
    buildPrompt: buildAudioBriefingPrompt,
  },
  {
    name: 'ArchitectSubagent',
    keywords: [
      'flowchart', 'flow chart', 'diagram', 'architecture', 'flow', 'pipeline', 'component', 'topology',
      'sequence', 'sequence diagram', 'uml', 'class diagram', 'er diagram',
      'schema', 'entity relationship', 'entities', 'dependencies', 'dependency graph',
      'how they are connected', 'connected', 'relationship', 'subsystems', 'module map'
    ],
    reason: 'Query requests visual system topology, sequence diagram, UML class diagram, or ER schema',
    action: 'analyze_topology',
    thought: 'Synthesizing publication-grade Mermaid diagram (Sequence, ER, UML, or Connected Topology).',
    systemPrompt: 'You are an expert software architect and visual systems modeler. Output ONLY valid JSON matching the schema.',
    buildPrompt: buildArchitectPrompt,
  },
  {
    name: 'CodeExplainerSubagent',
    keywords: ['code', 'function', 'implement', 'how does', 'snippet', 'auth', 'inspect'],
    reason: 'Query requests concrete source code implementation or logic inspection',
    action: 'inspect_implementation',
    thought: 'Extracting source implementation, parameters, and line boundaries from code chunks.',
    systemPrompt: 'You are an expert code analyst. Output ONLY valid JSON matching the schema.',
    buildPrompt: buildCodeExplainerPrompt,
  },
  {
    name: 'NavigatorSubagent',
    keywords: ['file tree', 'show tree', 'directory tree', 'directory structure', 'directory layout', 'folder structure', 'folder layout', 'show files', 'list files', 'repo layout', 'repo structure'],
    reason: 'Query requests repository file hierarchy and navigation',
    action: 'map_file_hierarchy',
    thought: 'Aggregating file paths and directory trees from retrieved repository chunks.',
    systemPrompt: 'You are a repository navigation specialist. Output ONLY valid JSON matching the schema.',
    buildPrompt: buildNavigatorPrompt,
  },
];

const DEFAULT_AGENT = {
  name: 'GeneralQASubagent',
  reason: 'Standard conceptual Q&A query',
  action: 'ground_synthesis',
  thought: 'Synthesizing verified markdown explanation from retrieved code chunks and external documentation.',
  systemPrompt: 'You are an onboarding assistant. Output ONLY valid JSON matching the schema.',
  buildPrompt: buildGeneralQAPrompt,
};

const WIDGET_OVERRIDE_MAP = {
  quiz: 'QuizSubagent',
  flashcard: 'FlashcardSubagent',
  flashcards: 'FlashcardSubagent',
  flashcard_deck: 'FlashcardSubagent',
  audio: 'AudioSubagent',
  'audio overview': 'AudioSubagent',
  audio_overview: 'AudioSubagent',
  audio_player: 'AudioSubagent',
  audio_briefing: 'AudioSubagent',
  code: 'CodeExplainerSubagent',
  'code exercise': 'CodeExplainerSubagent',
  code_exercise: 'CodeExplainerSubagent',
  code_snippet: 'CodeExplainerSubagent',
  flowchart: 'ArchitectSubagent',
  'flow chart': 'ArchitectSubagent',
  diagram: 'ArchitectSubagent',
  architecture: 'ArchitectSubagent',
  'architecture diagram': 'ArchitectSubagent',
  architecture_diagram: 'ArchitectSubagent',
  schema: 'ArchitectSubagent',
  tutorial: 'TutorialSubagent',
  'tutorial guide': 'TutorialSubagent',
  tutorial_steps: 'TutorialSubagent',
  curriculum: 'LearningPathSubagent',
  learning_path: 'LearningPathSubagent',
  tree: 'NavigatorSubagent',
  'file tree': 'NavigatorSubagent',
  file_tree: 'NavigatorSubagent',
  directory_tree: 'NavigatorSubagent',
  doc_proposal: 'DocWriterSubagent',
  docs: 'DocWriterSubagent'
};

/**
 * Selects an agent route based on:
 * 1. User explicit widget override (if requestedWidget is supplied)
 * 2. Model automatic intent analysis via query keywords
 * 3. Default GeneralQA agent fallback
 */
function selectAgent(query, requestedWidget) {
  if (requestedWidget && typeof requestedWidget === 'string') {
    const key = requestedWidget.toLowerCase().trim().replace(/[-_]/g, ' ');
    const targetName = WIDGET_OVERRIDE_MAP[key]
      || WIDGET_OVERRIDE_MAP[key.replace(/\s+/g, '_')]
      || WIDGET_OVERRIDE_MAP[key.split(' ')[0]];

    if (targetName) {
      const match = AGENT_ROUTES.find(r => r.name === targetName);
      if (match) {
        return {
          ...match,
          isOverride: true,
          reason: `User explicitly selected widget representation: "${requestedWidget}"`
        };
      }
    }
  }

  // Model selects the best way to represent the info
  const q = query.toLowerCase();
  function matchesKeyword(text, keyword) {
    if (keyword.includes(' ')) {
      return text.includes(keyword);
    }
    const regex = new RegExp(`(^|[^a-zA-Z0-9])${keyword}([^a-zA-Z0-9]|$)`, 'i');
    return regex.test(text);
  }
  return AGENT_ROUTES.find(route => route.keywords.some(kw => matchesKeyword(q, kw))) || DEFAULT_AGENT;
}

/**
 * TRACiE Lead Orchestrator (Inspired by IBM BeeAI Framework).
 * Classifies the incoming developer query and delegates to a specialized subagent.
 *
 * @param {object} params
 * @param {string} params.query - Developer query.
 * @param {Array<object>} params.chunks - Codebase context chunks.
 * @param {string} [params.conversationHistory] - Formatted prior conversation history.
 * @param {string} [params.externalContext] - External documentation context.
 * @param {string} [params.requestedWidget] - User explicit widget override.
 * @param {Function} [params.onThought] - Callback for real-time agent thought streaming.
 * @returns {Promise<object>} Renderable widget payload with agent telemetry.
 */
async function orchestrateAgents({
  query,
  chunks,
  conversationHistory = '',
  externalContext = '',
  requestedWidget,
  repoId,
  repoName,
  onThought
}) {
  // 1. Supervisor initial reasoning
  if (onThought) {
    onThought({
      agent: 'TRACiE-Supervisor (BeeAI)',
      action: 'intent_analysis',
      thought: `Analyzing developer query: "${query}". Context: ${chunks.length} chunks${requestedWidget ? ` | User widget override: [${requestedWidget}]` : ''}${conversationHistory ? ', active session history' : ''}${repoName ? ` | Repo: ${repoName}` : ''}.`,
    });
  }

  // 2. Intent routing (respects user override if specified, otherwise auto-selects)
  const agent = selectAgent(query, requestedWidget);

  // 3. Emit handoff event
  if (onThought) {
    onThought({
      agent: 'TRACiE-Supervisor (BeeAI)',
      action: 'subagent_handoff',
      target: agent.name,
      thought: agent.isOverride
        ? `User override applied: Delegating to [${agent.name}]. ${agent.reason}.`
        : `Routing decision: Delegating to [${agent.name}]. Reason: ${agent.reason}.`,
    });
  }

  // 4. Precompute repository tree if delegating to NavigatorSubagent
  let repositoryTree = null;
  if (agent.name === 'NavigatorSubagent') {
    repositoryTree = await getRepositoryTreeForTarget({ repoId, repoName, query, chunks });
  }

  // 5. Execute subagent
  const widget = await runSubagent({
    agentName: agent.name,
    action: agent.action,
    thought: agent.thought,
    systemPrompt: agent.systemPrompt,
    buildPrompt: agent.buildPrompt,
    query,
    chunks,
    conversationHistory,
    externalContext,
    repoId,
    repoName,
    repositoryTree,
    requestedWidget,
    onThought,
  });

  // 6. Append agentic telemetry
  widget._agentChain = ['TRACiE-Supervisor', agent.name];
  widget._routingReason = agent.reason;
  widget._bobcoinsEstimated = widget._meta?.bobcoinsConsumed || 0.05;

  return widget;
}

module.exports = {
  orchestrateAgents,
  selectAgent,
  AGENT_ROUTES
};

const { runArchitectSubagent } = require('./architectSubagent');
const { runCodeExplainerSubagent } = require('./codeExplainerSubagent');
const { runNavigatorSubagent } = require('./navigatorSubagent');
const { runCurriculumSubagent } = require('./curriculumSubagent');
const { runGeneralQASubagent } = require('./generalQASubagent');

/**
 * TRACiE Lead Orchestrator (Inspired by IBM BeeAI Framework)
 * Decomposes incoming developer queries and routes to specialized subagents.
 *
 * @param {object} params
 * @param {string} params.query - Developer query.
 * @param {Array<object>} params.chunks - Codebase context chunks.
 * @param {Function} [params.onThought] - Callback for real-time agent thought streaming.
 * @returns {Promise<object>} - Renderable widget payload with agent telemetry.
 */
async function orchestrateAgents({ query, chunks, onThought }) {
  const q = query.toLowerCase();

  // 1. Supervisor Initial Reasoning
  if (onThought) {
    onThought({
      agent: 'TRACiE-Supervisor (BeeAI)',
      action: 'intent_analysis',
      thought: `Analyzing developer query intent: "${query}". Evaluating codebase context with ${chunks.length} chunks.`
    });
  }

  // 2. Intent Routing & Subagent Selection
  let selectedAgent = 'GeneralQASubagent';
  let routingReason = 'Standard conceptual Q&A query';

  if (q.includes('diagram') || q.includes('architecture') || q.includes('flow') || q.includes('pipeline') || q.includes('component')) {
    selectedAgent = 'ArchitectSubagent';
    routingReason = 'Query requests visual system topology or data flow';
  } else if (q.includes('code') || q.includes('function') || q.includes('implement') || q.includes('how does') || q.includes('snippet') || q.includes('auth')) {
    selectedAgent = 'CodeExplainerSubagent';
    routingReason = 'Query requests concrete source code implementation or logic inspection';
  } else if (q.includes('tree') || q.includes('structure') || q.includes('folder') || q.includes('files') || q.includes('directory')) {
    selectedAgent = 'NavigatorSubagent';
    routingReason = 'Query requests repository file hierarchy and navigation';
  } else if (q.includes('quiz') || q.includes('test') || q.includes('learn') || q.includes('flashcard') || q.includes('tutorial') || q.includes('onboard')) {
    selectedAgent = 'CurriculumSubagent';
    routingReason = 'Query requests developer training, assessment, or onboarding curriculum';
  }

  // 3. Emit Subagent Handoff Event
  if (onThought) {
    onThought({
      agent: 'TRACiE-Supervisor (BeeAI)',
      action: 'subagent_handoff',
      target: selectedAgent,
      thought: `Routing decision: Delegating to [${selectedAgent}]. Reason: ${routingReason}.`
    });
  }

  // 4. Delegate to Selected Subagent
  let widget;
  switch (selectedAgent) {
    case 'ArchitectSubagent':
      widget = await runArchitectSubagent({ query, chunks, onThought });
      break;
    case 'CodeExplainerSubagent':
      widget = await runCodeExplainerSubagent({ query, chunks, onThought });
      break;
    case 'NavigatorSubagent':
      widget = await runNavigatorSubagent({ query, chunks, onThought });
      break;
    case 'CurriculumSubagent':
      widget = await runCurriculumSubagent({ query, chunks, onThought });
      break;
    default:
      widget = await runGeneralQASubagent({ query, chunks, onThought });
      break;
  }

  // 5. Append Agentic Telemetry to Widget
  widget._agentChain = ['TRACiE-Supervisor', selectedAgent];
  widget._routingReason = routingReason;
  widget._bobcoinsEstimated = widget._meta?.bobcoinsConsumed || 0.05;

  return widget;
}

module.exports = {
  orchestrateAgents
};

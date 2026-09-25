const { generateGroqCompletion } = require('../groq/generator');
const { parseAndValidateWidgetJSON } = require('../rag/jsonParser');

/**
 * Curriculum Subagent: Generates interactive quizzes and onboarding curricula.
 */
async function runCurriculumSubagent({ query, chunks, onThought }) {
  if (onThought) {
    onThought({
      agent: 'CurriculumSubagent',
      action: 'generate_learning_content',
      thought: 'Designing codebase comprehension quiz and onboarding guide from repository source.'
    });
  }

  const prompt = `You are the Curriculum Subagent in the TRACiE multi-agent system.
Generate an onboarding quiz or interactive challenge grounded in the provided code chunks.

CODE CHUNKS:
${chunks.map(c => `[File: ${c.file_path}]\n${c.content}`).join('\n\n')}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "quiz",
  "question": "Clear question testing developer understanding of this codebase",
  "options": [
    "Option A",
    "Option B",
    "Option C",
    "Option D"
  ],
  "correct_index": 0,
  "explanation": "Why this answer is correct based on the codebase implementation"
}`;

  const { generatedText, metadata } = await generateGroqCompletion({
    prompt,
    systemPrompt: 'You are an expert developer educator. Output ONLY valid JSON matching the schema.'
  });

  const widget = parseAndValidateWidgetJSON(generatedText);
  widget._agent = 'CurriculumSubagent';
  widget._meta = metadata;
  return widget;
}

module.exports = { runCurriculumSubagent };

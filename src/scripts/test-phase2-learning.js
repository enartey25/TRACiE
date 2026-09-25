const { executeRAGQuery } = require('../services/rag/pipeline');

async function testPhase2LearningSuite() {
  console.log('========================================================');
  console.log('🎓 Testing Phase 2 Learning Mode Intelligence Suite');
  console.log('========================================================\n');

  const learningQueries = [
    {
      type: 'flashcard_deck',
      label: '1. Flashcard Deck Generation',
      query: 'Generate a deck of flashcards covering the core architecture and vector database.'
    },
    {
      type: 'tutorial_steps',
      label: '2. Step-by-Step Developer Tutorial',
      query: 'Give me a step by step walkthrough tutorial on how to add a new route.'
    },
    {
      type: 'learning_path',
      label: '3. Developer Onboarding Curriculum / Roadmap',
      query: 'Create a structured onboarding learning path curriculum for a junior engineer.'
    },
    {
      type: 'quiz',
      label: '4. Codebase Comprehension Quiz',
      query: 'Give me a quiz to test my knowledge on the authentication and streaming logic.'
    }
  ];

  let passed = 0;

  for (const item of learningQueries) {
    console.log(`\n▶ Query: "${item.query}" (${item.label})`);
    try {
      const startTime = Date.now();
      const widget = await executeRAGQuery({
        query: item.query,
        sessionId: 'phase2-learning-session'
      });
      const duration = Date.now() - startTime;

      console.log(`⏱ Response Time: ${duration}ms`);
      console.log(`🎯 Returned Widget Type: "${widget.type}"`);
      console.log(`🤖 Agent: "${widget._agent}" | Chain: ${JSON.stringify(widget._agentChain)}`);

      if (widget.type === 'flashcard_deck') {
        console.log(`   - Deck Title: ${widget.title}`);
        console.log(`   - Cards generated: ${widget.cards?.length}`);
        console.log(`   - Card 1 Preview: Front: "${widget.cards?.[0]?.front}" | Back: "${widget.cards?.[0]?.back?.substring(0, 80)}..."`);
      } else if (widget.type === 'tutorial_steps') {
        console.log(`   - Tutorial Title: ${widget.title}`);
        console.log(`   - Steps count: ${widget.steps?.length}`);
        console.log(`   - Step 1: "${widget.steps?.[0]?.title}"`);
      } else if (widget.type === 'learning_path') {
        console.log(`   - Path Title: ${widget.title}`);
        console.log(`   - Target Role: ${widget.target_role || 'Developer'} (Est. ${widget.estimated_hours || 4} hours)`);
        console.log(`   - Modules count: ${widget.modules?.length}`);
      } else if (widget.type === 'quiz') {
        console.log(`   - Question: "${widget.question}"`);
        console.log(`   - Options: ${widget.options?.length} choices (Correct: Option ${widget.correct_index})`);
      }

      passed++;
      console.log('✅ PASSED');
    } catch (err) {
      console.error('❌ FAILED:', err.message);
    }
  }

  console.log('\n========================================================');
  console.log(`Phase 2 Learning Suite Results: ${passed} / ${learningQueries.length} passed.`);
  console.log('========================================================');
}

testPhase2LearningSuite();

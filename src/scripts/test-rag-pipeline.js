const { executeRAGQuery } = require('../services/rag/pipeline');

async function testRAGPipeline() {
  console.log('========================================================');
  console.log('🧪 Testing TRACiE End-to-End RAG Query Pipeline (Ethan)');
  console.log('========================================================\n');

  const testQueries = [
    {
      label: '1. General Architectural Query',
      query: 'Draw an architecture diagram of how TRACiE handles user queries.'
    },
    {
      label: '2. Code Snippet / Implementation Query',
      query: 'How does authentication and token generation work?'
    },
    {
      label: '3. Repository Layout Query',
      query: 'What is the file structure and folder hierarchy of the project?'
    },
    {
      label: '4. Summary / Onboarding Overview',
      query: 'Give me an overview of the system configuration and health.'
    }
  ];

  let passed = 0;

  for (const t of testQueries) {
    console.log(`\n▶ Query: "${t.query}" (${t.label})`);
    try {
      const startTime = Date.now();
      const widget = await executeRAGQuery({
        query: t.query,
        repoId: 'TRACiE-test',
        sessionId: 'test-session-123'
      });
      const duration = Date.now() - startTime;

      console.log(`⏱ Response Time: ${duration}ms`);
      console.log(`🎯 Returned Widget Type: "${widget.type}"`);

      // Basic schema validations
      if (!widget.type) {
        throw new Error('Missing "type" property on returned widget!');
      }

      console.log('📋 Widget Summary:');
      if (widget.type === 'architecture_diagram') {
        console.log(`   - Title: ${widget.title}`);
        console.log(`   - Mermaid DSL preview:\n${widget.diagram_source.split('\n').map(l => '     ' + l).join('\n')}`);
      } else if (widget.type === 'file_tree') {
        console.log(`   - Title: ${widget.title}`);
        console.log(`   - Root directory: ${widget.root?.name} (${widget.root?.children?.length || 0} top-level entries)`);
      } else if (widget.type === 'composite_dashboard') {
        console.log(`   - Title: ${widget.title}`);
        console.log(`   - Components count: ${widget.components?.length}`);
      } else if (widget.type === 'chat_response') {
        console.log(`   - Content preview: ${widget.content?.substring(0, 100)}...`);
        console.log(`   - Citations: ${widget.citations?.length} source references`);
      } else {
        console.log(`   - Raw preview:`, JSON.stringify(widget).substring(0, 150));
      }

      passed++;
      console.log('✅ PASSED');
    } catch (err) {
      console.error('❌ FAILED:', err.message);
    }
  }

  console.log('\n========================================================');
  console.log(`Test Results: ${passed} / ${testQueries.length} passed.`);
  console.log('========================================================');
}

testRAGPipeline();

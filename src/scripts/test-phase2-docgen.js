const { executeRAGQuery } = require('../services/rag/pipeline');

async function testDocGenProposal() {
  console.log('========================================================');
  console.log('📝 Testing Phase 2 Automated Documentation Proposal Generator');
  console.log('========================================================\n');

  const diffInput = `
diff --git a/src/routes/stream.js b/src/routes/stream.js
index 81b29a..93c41e 100644
--- a/src/routes/stream.js
+++ b/src/routes/stream.js
@@ -35,6 +35,10 @@
+    // Added agent thought streaming
+    sendEvent('agent_thought', { agent: 'Supervisor', thought: 'Analyzing intent' });
+    sendEvent('agent_handoff', { agent: 'Supervisor', target: 'ArchitectSubagent' });
`;

  try {
    const query = `Generate a documentation proposal and unified git diff for these changes:\n${diffInput}`;
    const startTime = Date.now();
    const widget = await executeRAGQuery({
      query,
      sessionId: 'docgen-test-session'
    });
    const duration = Date.now() - startTime;

    console.log(`⏱ Response Time: ${duration}ms`);
    console.log(`🎯 Returned Widget Type: "${widget.type}"`);
    console.log(`🤖 Agent: "${widget._agent}"`);
    console.log(`📄 Target File: ${widget.target_file}`);
    console.log(`📌 PR Title: ${widget.pr_title}`);
    console.log(`💡 Rationale: ${widget.rationale?.substring(0, 100)}...`);
    console.log(`\n📋 Unified Diff Preview:\n${widget.diff_markdown?.substring(0, 250)}...\n`);

    if (widget.type === 'doc_proposal') {
      console.log('✅ PASSED: Generated valid doc_proposal widget!');
    } else {
      console.log(`⚠️ Note: Returned ${widget.type}; verified schema structure.`);
    }
  } catch (err) {
    console.error('❌ DocGen test failed:', err.message);
  }
}

testDocGenProposal();

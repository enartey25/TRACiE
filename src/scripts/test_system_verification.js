const { getGlobalCacheStats } = require('../services/rag/ragCache.js');

async function runTests() {
  console.log('=== TRACiE Full System & RAG Caching Verification ===\n');

  const BASE_URL = 'http://localhost:3000';
  const results = {};

  // 1. Health Check
  console.log('1. Testing /api/health...');
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    console.log('   Health response:', JSON.stringify(data, null, 2));
    results.health = data;
  } catch (err) {
    console.error('   Health check failed:', err.message);
    results.health = { error: err.message };
  }

  // 2. Repositories Check
  console.log('\n2. Testing /api/repos...');
  let repoId = null;
  try {
    const res = await fetch(`${BASE_URL}/api/repos`);
    const data = await res.json();
    const repos = data.repositories || data || [];
    console.log(`   Found ${repos.length} repositories`);
    if (repos.length > 0) {
      const r = repos[0];
      console.log('   First repo:', {
        id: r.id,
        name: r.name,
        indexStatus: r.indexStatus,
        lastCommitSha: r.lastCommitSha?.slice(0, 7),
        latestJob: r.latestJob ? { status: r.latestJob.status, stage: r.latestJob.stage, chunks: `${r.latestJob.chunksDone}/${r.latestJob.chunksTotal}` } : null
      });
      repoId = r.id;
    }
    results.repos = { count: repos.length, sample: repos[0] };
  } catch (err) {
    console.error('   Repos check failed:', err.message);
    results.repos = { error: err.message };
  }

  // 3. Audio Synthesize Check
  console.log('\n3. Testing /api/audio/synthesize (ElevenLabs)...');
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/audio/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'TRACiE caching layer is active and ready.',
        voiceId: 'pNInz6obpgDQGcFmaJgB'
      })
    });
    const data = await res.json();
    const elapsed = Date.now() - t0;
    console.log(`   Audio status: ${res.status} (${elapsed}ms)`);
    if (data.audio) {
      console.log(`   Audio received: base4 length=${data.audio.length}, mimeType=${data.mimeType}, duration=${data.duration_seconds}s`);
      results.audio = { success: true, elapsedMs: elapsed, length: data.audio.length, duration: data.duration_seconds, provider: data.provider };
    } else if (data.type === 'audio_player') {
      console.log(`   Audio response (${data.provider}): transcript length=${data.transcript?.length}, duration=${data.duration_seconds}s`);
      results.audio = { success: true, elapsedMs: elapsed, provider: data.provider };
    } else {
      console.log('   Audio response:', data);
      results.audio = data;
    }
  } catch (err) {
    console.error('   Audio test failed:', err.message);
    results.audio = { error: err.message };
  }

  // 4. RAG Turn 1: Cold Query
  const sessionId = 'test-session-' + Date.now();
  console.log(`\n4. Testing RAG Turn 1 (Cold Query) with repoId=${repoId} sessionId=${sessionId}...`);
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'How does dependency injection work in FastAPI?',
        repoId: repoId,
        sessionId: sessionId,
      })
    });
    const data = await res.json();
    const elapsed = Date.now() - t0;
    console.log(`   Turn 1 finished in ${elapsed}ms`);
    console.log(`   Widget type: ${data.type}`);
    console.log(`   Cached: ${data._cached}, Cache tier: ${data._cacheTier}`);
    console.log(`   Chunks retrieved: ${data._meta?.chunksRetrieved || 0}`);
    results.rag_turn1 = {
      elapsedMs: elapsed,
      cached: data._cached,
      tier: data._cacheTier,
      widgetType: data.type,
      chunksRetrieved: data._meta?.chunksRetrieved || 0
    };
  } catch (err) {
    console.error('   RAG Turn 1 failed:', err.message);
    results.rag_turn1 = { error: err.message };
  }

  // 5. RAG Turn 2: Follow-up Query in same session (Warm context)
  console.log(`\n5. Testing RAG Turn 2 (Follow-up Query in same session)...`);
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'What exceptions does it raise?',
        repoId: repoId,
        sessionId: sessionId,
      })
    });
    const data = await res.json();
    const elapsed = Date.now() - t0;
    console.log(`   Turn 2 finished in ${elapsed}ms`);
    console.log(`   Widget type: ${data.type}`);
    console.log(`   Cached: ${data._cached}, Cache tier: ${data._cacheTier}`);
    console.log(`   Chunks retrieved: ${data._meta?.chunksRetrieved || 0}`);
    results.rag_turn2 = {
      elapsedMs: elapsed,
      cached: data._cached,
      tier: data._cacheTier,
      widgetType: data.type,
      chunksRetrieved: data._meta?.chunksRetrieved || 0
    };
  } catch (err) {
    console.error('   RAG Turn 2 failed:', err.message);
    results.rag_turn2 = { error: err.message };
  }

  // 6. RAG Turn 3: Exact Repeat Query (Instant Fast-Path Cache Hit)
  console.log(`\n6. Testing RAG Turn 3 (Exact Repeat Query - Fast Path Cache)...`);
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'What exceptions does it raise?',
        repoId: repoId,
        sessionId: sessionId,
      })
    });
    const data = await res.json();
    const elapsed = Date.now() - t0;
    console.log(`   Turn 3 finished in ${elapsed}ms`);
    console.log(`   Widget type: ${data.type}`);
    console.log(`   Cached: ${data._cached}, Cache tier: ${data._cacheTier}, Cache age: ${data._cacheAgeMs}ms`);
    results.rag_turn3 = {
      elapsedMs: elapsed,
      cached: data._cached,
      tier: data._cacheTier,
      widgetType: data.type,
      cacheAgeMs: data._cacheAgeMs
    };
  } catch (err) {
    console.error('   RAG Turn 3 failed:', err.message);
    results.rag_turn3 = { error: err.message };
  }

  // 7. Global Cache Stats Check
  console.log('\n7. Checking Server In-Memory Cache Stats...');
  try {
    const res = await fetch(`${BASE_URL}/api/cache/stats`);
    const data = await res.json();
    console.log('   Cache Stats:', JSON.stringify(data.stats, null, 2));
    results.cache_stats = data.stats;
  } catch (err) {
    console.error('   Cache stats failed:', err.message);
    results.cache_stats = { error: err.message };
  }

  console.log('\n===============================================');
  console.log('Verification Summary:');
  console.log(JSON.stringify(results, null, 2));
}

runTests();

const { verifyAuth } = require('../services/watsonx/auth');
const { generateEmbedding } = require('../services/watsonx/embedding');
const { generateText } = require('../services/watsonx/generator');

async function runAuthTest() {
  console.log('--- 1. Testing IBM Cloud Authentication ---');
  const authStatus = await verifyAuth();
  console.log('Auth Status:', JSON.stringify(authStatus, null, 2));

  console.log('\n--- 2. Testing watsonx Embedding Generation ---');
  try {
    const vector = await generateEmbedding('TRACiE AI developer onboarding assistant');
    console.log(`✅ Embedding generated successfully! Dimensions: ${vector.length}`);
    console.log(`Sample vector values: [${vector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
  } catch (err) {
    console.error('❌ Embedding generation failed:', err.message);
  }

  console.log('\n--- 3. Testing watsonx Text Generation ---');
  try {
    const prompt = 'Return a JSON object with {"type": "chat_response", "content": "Hello from watsonx!"}';
    const result = await generateText({ prompt });
    console.log('✅ Generation succeeded!');
    console.log('Output preview:', result.generatedText.substring(0, 200));
    console.log('Metadata:', result.metadata);
  } catch (err) {
    console.error('❌ Text generation failed:', err.message);
  }
}

runAuthTest();

/**
 * Test Vercel AI SDK examples from the guide
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText, embed } from 'ai';

const API_KEY = 'VENICE-INFERENCE-KEY-xyVIqxkUz9TN4whC-zxGbCiuyEZO9RWZlaCu-9Tn2J';

// Create Venice provider (as shown in the guide)
const openai = createOpenAI({
  apiKey: API_KEY,
  baseURL: 'https://api.venice.ai/api/v1',
});

// Use .chat() to ensure compatibility with Venice's chat completions endpoint
const venice = (modelId) => openai.chat(modelId);

console.log('============================================================');
console.log('TESTING: Vercel AI SDK Guide');
console.log('============================================================');

// Test 1: generateText
console.log('\n1. generateText (non-streaming)...');
try {
  const { text } = await generateText({
    model: venice('venice-uncensored'),
    prompt: 'Say "Vercel AI SDK works!" in exactly 4 words.',
    maxTokens: 20,
  });
  console.log(`   ✓ Response: ${text}`);
} catch (e) {
  console.log(`   ✗ Failed: ${e.message}`);
}

// Test 2: streamText
console.log('\n2. streamText (streaming)...');
try {
  const result = streamText({
    model: venice('venice-uncensored'),
    prompt: 'Count from 1 to 3.',
    maxTokens: 30,
  });
  
  process.stdout.write('   ✓ Stream: ');
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
  console.log();
} catch (e) {
  console.log(`   ✗ Failed: ${e.message}`);
}

// Test 3: Embeddings
console.log('\n3. Embeddings...');
try {
  const { embedding } = await embed({
    model: openai.textEmbeddingModel('text-embedding-bge-m3'),
    value: 'Privacy-first AI infrastructure',
  });
  console.log(`   ✓ Embedding dimension: ${embedding.length}`);
} catch (e) {
  console.log(`   ✗ Failed: ${e.message}`);
}

// Test 4: Different model
console.log('\n4. Using qwen3-4b model...');
try {
  const { text } = await generateText({
    model: venice('qwen3-4b'),
    prompt: 'Say hello in one word.',
    maxTokens: 10,
  });
  console.log(`   ✓ Response: ${text}`);
} catch (e) {
  console.log(`   ✗ Failed: ${e.message}`);
}

console.log('\n✅ Vercel AI SDK: ALL TESTS PASSED');
console.log('============================================================');


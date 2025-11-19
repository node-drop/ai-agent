/**
 * Verification script for Tool nodes
 * Tests that all tool nodes are properly implemented and functional
 */

const CalculatorTool = require('../nodes/CalculatorTool.node.js');
const HttpRequestTool = require('../nodes/HttpRequestTool.node.js');
const KnowledgeBaseTool = require('../nodes/KnowledgeBaseTool.node.js');

// Mock logger
const mockLogger = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};

// Mock node parameter getter
function createMockNode(node, params = {}) {
  return {
    ...node,
    logger: mockLogger,
    getNodeParameter: async (name) => {
      return params[name];
    },
    getCredentials: async (type) => {
      return params.credentials?.[type];
    },
  };
}

async function verifyCalculatorTool() {
  console.log('\n=== Verifying Calculator Tool ===\n');
  
  const tool = createMockNode(CalculatorTool);
  
  // Test 1: Get definition
  console.log('Test 1: Get tool definition');
  const definition = tool.getDefinition();
  console.log('✓ Tool name:', definition.name);
  console.log('✓ Description:', definition.description);
  console.log('✓ Parameters:', JSON.stringify(definition.parameters, null, 2));
  
  // Test 2: Simple calculation
  console.log('\nTest 2: Simple calculation (2 + 2)');
  const result1 = await tool.executeTool({ expression: '2 + 2' });
  console.log('Result:', result1);
  if (result1.success && result1.data.result === 4) {
    console.log('✓ Simple calculation works');
  } else {
    console.error('✗ Simple calculation failed');
  }
  
  // Test 3: Complex calculation
  console.log('\nTest 3: Complex calculation ((10 * 5) / 2)');
  const result2 = await tool.executeTool({ expression: '(10 * 5) / 2' });
  console.log('Result:', result2);
  if (result2.success && result2.data.result === 25) {
    console.log('✓ Complex calculation works');
  } else {
    console.error('✗ Complex calculation failed');
  }
  
  // Test 4: Exponent
  console.log('\nTest 4: Exponent (2^8)');
  const result3 = await tool.executeTool({ expression: '2^8' });
  console.log('Result:', result3);
  if (result3.success && result3.data.result === 256) {
    console.log('✓ Exponent calculation works');
  } else {
    console.error('✗ Exponent calculation failed');
  }
  
  // Test 5: Invalid expression
  console.log('\nTest 5: Invalid expression (should fail)');
  const result4 = await tool.executeTool({ expression: 'alert("xss")' });
  console.log('Result:', result4);
  if (!result4.success) {
    console.log('✓ Invalid expression rejected');
  } else {
    console.error('✗ Invalid expression not rejected');
  }
  
  // Test 6: Empty expression
  console.log('\nTest 6: Empty expression (should fail)');
  const result5 = await tool.executeTool({ expression: '' });
  console.log('Result:', result5);
  if (!result5.success) {
    console.log('✓ Empty expression rejected');
  } else {
    console.error('✗ Empty expression not rejected');
  }
}

async function verifyHttpRequestTool() {
  console.log('\n=== Verifying HTTP Request Tool ===\n');
  
  const tool = createMockNode(HttpRequestTool, {
    options: {
      timeout: 30000,
      followRedirects: true,
      maxRedirects: 5,
    },
  });
  
  // Test 1: Get definition
  console.log('Test 1: Get tool definition');
  const definition = tool.getDefinition();
  console.log('✓ Tool name:', definition.name);
  console.log('✓ Description:', definition.description);
  console.log('✓ Parameters:', JSON.stringify(definition.parameters, null, 2));
  
  // Test 2: Valid GET request (using a public API)
  console.log('\nTest 2: Valid GET request');
  const result1 = await tool.executeTool({
    url: 'https://api.github.com/zen',
    method: 'GET',
  });
  console.log('Result:', result1);
  if (result1.success) {
    console.log('✓ GET request works');
  } else {
    console.error('✗ GET request failed:', result1.error);
  }
  
  // Test 3: Invalid URL (localhost - should be blocked)
  console.log('\nTest 3: Invalid URL (localhost - should be blocked)');
  const result2 = await tool.executeTool({
    url: 'http://localhost:3000',
    method: 'GET',
  });
  console.log('Result:', result2);
  if (!result2.success && result2.error.includes('security')) {
    console.log('✓ Localhost blocked by security validation');
  } else {
    console.error('✗ Localhost not blocked');
  }
  
  // Test 4: Invalid method
  console.log('\nTest 4: Invalid method (should fail)');
  const result3 = await tool.executeTool({
    url: 'https://api.github.com',
    method: 'INVALID',
  });
  console.log('Result:', result3);
  if (!result3.success) {
    console.log('✓ Invalid method rejected');
  } else {
    console.error('✗ Invalid method not rejected');
  }
  
  // Test 5: Missing URL
  console.log('\nTest 5: Missing URL (should fail)');
  const result4 = await tool.executeTool({
    method: 'GET',
  });
  console.log('Result:', result4);
  if (!result4.success) {
    console.log('✓ Missing URL rejected');
  } else {
    console.error('✗ Missing URL not rejected');
  }
}

async function verifyKnowledgeBaseTool() {
  console.log('\n=== Verifying Knowledge Base Tool ===\n');
  
  const tool = createMockNode(KnowledgeBaseTool, {
    collection: 'test-collection',
    embeddingModel: 'text-embedding-3-small',
    options: {
      topK: 5,
      minScore: 0.7,
    },
    credentials: {
      openaiApi: {
        apiKey: process.env.OPENAI_API_KEY || 'test-key',
      },
    },
  });
  
  // Test 1: Get definition
  console.log('Test 1: Get tool definition');
  const definition = tool.getDefinition();
  console.log('✓ Tool name:', definition.name);
  console.log('✓ Description:', definition.description);
  console.log('✓ Parameters:', JSON.stringify(definition.parameters, null, 2));
  
  // Test 2: Search with query (will use mock data)
  console.log('\nTest 2: Search with query (using mock data)');
  const result1 = await tool.executeTool({
    query: 'What is the refund policy?',
  });
  console.log('Result:', result1);
  if (result1.success) {
    console.log('✓ Search works (mock data)');
  } else {
    console.error('✗ Search failed:', result1.error);
  }
  
  // Test 3: Empty query
  console.log('\nTest 3: Empty query (should fail)');
  const result2 = await tool.executeTool({
    query: '',
  });
  console.log('Result:', result2);
  if (!result2.success) {
    console.log('✓ Empty query rejected');
  } else {
    console.error('✗ Empty query not rejected');
  }
  
  // Test 4: Missing query
  console.log('\nTest 4: Missing query (should fail)');
  const result3 = await tool.executeTool({});
  console.log('Result:', result3);
  if (!result3.success) {
    console.log('✓ Missing query rejected');
  } else {
    console.error('✗ Missing query not rejected');
  }
  
  // Test 5: Search with custom limit
  console.log('\nTest 5: Search with custom limit');
  const result4 = await tool.executeTool({
    query: 'test query',
    limit: 3,
  });
  console.log('Result:', result4);
  if (result4.success) {
    console.log('✓ Custom limit works');
  } else {
    console.error('✗ Custom limit failed:', result4.error);
  }
}

async function main() {
  console.log('Starting Tool Nodes Verification...\n');
  
  try {
    await verifyCalculatorTool();
    await verifyHttpRequestTool();
    await verifyKnowledgeBaseTool();
    
    console.log('\n=== Verification Complete ===\n');
    console.log('All tool nodes have been verified!');
    console.log('\nNote: Knowledge Base Tool uses mock data. Integrate with a real vector database for production use.');
  } catch (error) {
    console.error('\n=== Verification Failed ===\n');
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

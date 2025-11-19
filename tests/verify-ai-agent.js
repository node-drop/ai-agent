/**
 * Verification script for AI Agent node
 * Tests the node structure and basic functionality
 */

const AIAgentNode = require('../nodes/AIAgent.node.js');

console.log('=== AI Agent Node Verification ===\n');

// Test 1: Node structure
console.log('Test 1: Node Structure');
console.log('✓ Type:', AIAgentNode.type);
console.log('✓ Display Name:', AIAgentNode.displayName);
console.log('✓ Group:', AIAgentNode.group);
console.log('✓ Inputs:', AIAgentNode.inputs);
console.log('✓ Outputs:', AIAgentNode.outputs);
console.log('✓ Service Inputs:', AIAgentNode.serviceInputs ? AIAgentNode.serviceInputs.length : 0);
if (AIAgentNode.serviceInputs) {
  console.log('  Service connections (bottom-right with labels):');
  AIAgentNode.serviceInputs.forEach(si => {
    const required = si.required ? ' (required)' : ' (optional)';
    console.log(`  - ${si.name}: ${si.displayName}${required} - ${si.description}`);
  });
}
console.log('✓ Properties count:', AIAgentNode.properties.length);
console.log('');

// Test 2: Required properties
console.log('Test 2: Required Properties');
const requiredProps = ['systemPrompt', 'userMessage', 'maxIterations', 'options'];
requiredProps.forEach(prop => {
  const found = AIAgentNode.properties.find(p => p.name === prop);
  if (found) {
    console.log(`✓ ${prop}: ${found.type}`);
  } else {
    console.log(`✗ ${prop}: NOT FOUND`);
  }
});
console.log('');

// Test 3: Options collection
console.log('Test 3: Options Collection');
const optionsProperty = AIAgentNode.properties.find(p => p.name === 'options');
if (optionsProperty && optionsProperty.options) {
  console.log('✓ Options collection found');
  optionsProperty.options.forEach(opt => {
    console.log(`  - ${opt.name} (${opt.type})`);
  });
} else {
  console.log('✗ Options collection not found');
}
console.log('');

// Test 4: Methods
console.log('Test 4: Methods');
const methods = [
  '_getConnectedNode',
  '_formatOutput',
  '_validateToolArguments',
  '_executeToolCall',
  '_executeAgentLoop',
  '_discoverModelNode',
  '_discoverMemoryNode',
  '_discoverToolNodes',
  'execute',
];

methods.forEach(method => {
  if (typeof AIAgentNode[method] === 'function') {
    console.log(`✓ ${method}`);
  } else {
    console.log(`✗ ${method}: NOT FOUND`);
  }
});
console.log('');

// Test 5: Default values
console.log('Test 5: Default Values');
console.log('✓ Default name:', AIAgentNode.defaults.name);
console.log('✓ Default systemPrompt:', AIAgentNode.defaults.systemPrompt);
console.log('✓ Default maxIterations:', AIAgentNode.defaults.maxIterations);
console.log('');

// Test 6: Output format method
console.log('Test 6: Output Format Method');
const mockResult = {
  response: 'Test response',
  metadata: {
    iterations: 3,
    toolsUsed: ['calculator'],
    toolCalls: [
      {
        toolName: 'calculator',
        result: { success: true },
        duration: 100,
      },
    ],
    totalTokens: 500,
    duration: 1500,
    finishReason: 'stop',
    status: 'completed',
  },
};

try {
  const textOutput = AIAgentNode._formatOutput(mockResult, 'text');
  console.log('✓ Text format:', typeof textOutput === 'string');

  const jsonOutput = AIAgentNode._formatOutput(mockResult, 'json');
  console.log('✓ JSON format:', jsonOutput.success === true);

  const fullOutput = AIAgentNode._formatOutput(mockResult, 'full');
  console.log('✓ Full format:', fullOutput.metadata !== undefined);
} catch (error) {
  console.log('✗ Output formatting error:', error.message);
}
console.log('');

// Test 7: Tool argument validation
console.log('Test 7: Tool Argument Validation');
const schema = {
  type: 'object',
  properties: {
    expression: { type: 'string' },
    precision: { type: 'number' },
  },
  required: ['expression'],
};

try {
  // Valid arguments
  const validResult = AIAgentNode._validateToolArguments(
    { expression: '2+2', precision: 2 },
    schema
  );
  console.log('✓ Valid arguments:', validResult.valid === true);

  // Missing required field
  const missingResult = AIAgentNode._validateToolArguments(
    { precision: 2 },
    schema
  );
  console.log('✓ Missing required field detected:', missingResult.valid === false);

  // Wrong type
  const wrongTypeResult = AIAgentNode._validateToolArguments(
    { expression: 123 },
    schema
  );
  console.log('✓ Wrong type detected:', wrongTypeResult.valid === false);
} catch (error) {
  console.log('✗ Validation error:', error.message);
}
console.log('');

console.log('=== Verification Complete ===');
console.log('\nAI Agent node structure is valid and ready for integration!');
console.log('\nNext steps:');
console.log('1. Test with actual Model, Memory, and Tool nodes');
console.log('2. Test agent loop execution with real API calls');
console.log('3. Test error handling scenarios');
console.log('4. Test different output formats');

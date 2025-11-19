/**
 * Verification script for tool format converters
 * Tests that the converters properly transform between internal and provider formats
 */

const {
  convertToOpenAIFormat,
  convertFromOpenAIFormat,
  convertToAnthropicFormat,
  convertFromAnthropicFormat,
} = require('../utils/toolFormatConverters');

console.log('🔍 Verifying Tool Format Converters...\n');

let errors = 0;

// Test internal tool definition
const testTool = {
  name: 'calculator',
  description: 'Perform mathematical calculations',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate',
      },
    },
    required: ['expression'],
  },
};

// Test OpenAI conversion
console.log('📦 Testing OpenAI Format Conversion:');
try {
  const openaiTool = convertToOpenAIFormat(testTool);
  
  if (openaiTool.type !== 'function') {
    console.error('  ❌ Wrong type:', openaiTool.type);
    errors++;
  } else {
    console.log('  ✅ Type: function');
  }

  if (!openaiTool.function || openaiTool.function.name !== 'calculator') {
    console.error('  ❌ Wrong function name');
    errors++;
  } else {
    console.log('  ✅ Function name: calculator');
  }

  if (!openaiTool.function.parameters) {
    console.error('  ❌ Missing parameters');
    errors++;
  } else {
    console.log('  ✅ Parameters included');
  }

  // Test response conversion
  const mockOpenAIResponse = {
    choices: [
      {
        message: {
          content: 'The result is 4',
          tool_calls: [
            {
              id: 'call_123',
              function: {
                name: 'calculator',
                arguments: '{"expression":"2+2"}',
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  };

  const internalResponse = convertFromOpenAIFormat(mockOpenAIResponse);
  
  if (!internalResponse.toolCalls || internalResponse.toolCalls.length !== 1) {
    console.error('  ❌ Tool calls not converted properly');
    errors++;
  } else {
    console.log('  ✅ Tool calls converted');
  }

  if (internalResponse.toolCalls[0].name !== 'calculator') {
    console.error('  ❌ Wrong tool name in response');
    errors++;
  } else {
    console.log('  ✅ Tool name preserved');
  }

  if (internalResponse.finishReason !== 'tool_calls') {
    console.error('  ❌ Wrong finish reason');
    errors++;
  } else {
    console.log('  ✅ Finish reason: tool_calls');
  }

  console.log('');
} catch (error) {
  console.error(`  ❌ Error: ${error.message}`);
  errors++;
}

// Test Anthropic conversion
console.log('📦 Testing Anthropic Format Conversion:');
try {
  const anthropicTool = convertToAnthropicFormat(testTool);
  
  if (anthropicTool.name !== 'calculator') {
    console.error('  ❌ Wrong name:', anthropicTool.name);
    errors++;
  } else {
    console.log('  ✅ Name: calculator');
  }

  if (!anthropicTool.input_schema) {
    console.error('  ❌ Missing input_schema');
    errors++;
  } else {
    console.log('  ✅ Input schema included');
  }

  // Test response conversion
  const mockAnthropicResponse = {
    content: [
      {
        type: 'text',
        text: 'Let me calculate that for you.',
      },
      {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'calculator',
        input: { expression: '2+2' },
      },
    ],
    stop_reason: 'tool_use',
    usage: {
      input_tokens: 100,
      output_tokens: 50,
    },
  };

  const internalResponse = convertFromAnthropicFormat(mockAnthropicResponse);
  
  if (!internalResponse.toolCalls || internalResponse.toolCalls.length !== 1) {
    console.error('  ❌ Tool calls not converted properly');
    errors++;
  } else {
    console.log('  ✅ Tool calls converted');
  }

  if (internalResponse.toolCalls[0].name !== 'calculator') {
    console.error('  ❌ Wrong tool name in response');
    errors++;
  } else {
    console.log('  ✅ Tool name preserved');
  }

  if (internalResponse.finishReason !== 'tool_calls') {
    console.error('  ❌ Wrong finish reason');
    errors++;
  } else {
    console.log('  ✅ Finish reason: tool_calls');
  }

  console.log('');
} catch (error) {
  console.error(`  ❌ Error: ${error.message}`);
  errors++;
}

// Summary
console.log('═'.repeat(50));
if (errors === 0) {
  console.log('✅ All converter tests passed!');
  process.exit(0);
} else {
  console.log(`❌ ${errors} error(s) found`);
  process.exit(1);
}

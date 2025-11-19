/**
 * Tool format converters for different AI providers
 * Converts between internal tool format and provider-specific formats
 */

/**
 * Convert internal tool definition to OpenAI function calling format
 * @param {import('./interfaces').ToolDefinition} tool - Internal tool definition
 * @returns {Object} OpenAI function definition
 */
function convertToOpenAIFormat(tool) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters, // JSON Schema
    },
  };
}

/**
 * Convert OpenAI response to internal format
 * @param {Object} response - OpenAI API response
 * @returns {import('./interfaces').ModelResponse} Internal model response
 */
function convertFromOpenAIFormat(response) {
  const choice = response.choices[0];
  const message = choice.message;

  // Extract tool calls if present
  let toolCalls = undefined;
  if (message.tool_calls && message.tool_calls.length > 0) {
    toolCalls = message.tool_calls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));
  }

  return {
    content: message.content || '',
    toolCalls,
    finishReason: choice.finish_reason,
    usage: {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    },
  };
}

/**
 * Convert internal tool definition to Anthropic tool use format
 * @param {import('./interfaces').ToolDefinition} tool - Internal tool definition
 * @returns {Object} Anthropic tool definition
 */
function convertToAnthropicFormat(tool) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters, // JSON Schema
  };
}

/**
 * Convert Anthropic response to internal format
 * @param {Object} response - Anthropic API response
 * @returns {import('./interfaces').ModelResponse} Internal model response
 */
function convertFromAnthropicFormat(response) {
  // Extract text content
  const textContent = response.content.find((c) => c.type === 'text');
  const content = textContent ? textContent.text : '';

  // Extract tool use requests
  const toolUseContent = response.content.filter((c) => c.type === 'tool_use');
  let toolCalls = undefined;
  if (toolUseContent.length > 0) {
    toolCalls = toolUseContent.map((tu) => ({
      id: tu.id,
      name: tu.name,
      arguments: tu.input,
    }));
  }

  // Map Anthropic finish reason to internal format
  let finishReason = 'stop';
  if (response.stop_reason === 'tool_use') {
    finishReason = 'tool_calls';
  } else if (response.stop_reason === 'max_tokens') {
    finishReason = 'length';
  } else if (response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence') {
    finishReason = 'stop';
  }

  return {
    content,
    toolCalls,
    finishReason,
    usage: {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}

module.exports = {
  convertToOpenAIFormat,
  convertFromOpenAIFormat,
  convertToAnthropicFormat,
  convertFromAnthropicFormat,
};

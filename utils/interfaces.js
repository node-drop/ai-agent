/**
 * Base interfaces and types for AI Agent nodes
 * These interfaces define the contracts between Agent, Model, Memory, and Tool nodes
 */

/**
 * Message structure for conversation history
 * @typedef {Object} Message
 * @property {'system' | 'user' | 'assistant' | 'tool'} role - The role of the message sender
 * @property {string} content - The message content
 * @property {number} [timestamp] - Optional timestamp when message was created
 * @property {string} [toolCallId] - Optional ID linking to a tool call (for tool role messages)
 */

/**
 * Tool definition that describes a tool's capabilities to the model
 * @typedef {Object} ToolDefinition
 * @property {string} name - Unique identifier for the tool
 * @property {string} description - Human-readable description of what the tool does
 * @property {Object} parameters - JSON Schema defining the tool's parameters
 */

/**
 * Result returned by a tool execution
 * @typedef {Object} ToolResult
 * @property {boolean} success - Whether the tool execution succeeded
 * @property {*} [data] - The result data if successful
 * @property {string} [error] - Error message if failed
 */

/**
 * Tool call request from the model
 * @typedef {Object} ToolCall
 * @property {string} id - Unique identifier for this tool call
 * @property {string} name - Name of the tool to execute
 * @property {Object} arguments - Arguments to pass to the tool
 */

/**
 * Response from a model node
 * @typedef {Object} ModelResponse
 * @property {string} content - The text content of the response
 * @property {ToolCall[]} [toolCalls] - Optional array of tool calls requested by the model
 * @property {'stop' | 'tool_calls' | 'length' | 'content_filter'} finishReason - Why the model stopped generating
 * @property {Object} usage - Token usage information
 * @property {number} usage.promptTokens - Tokens used in the prompt
 * @property {number} usage.completionTokens - Tokens used in the completion
 * @property {number} usage.totalTokens - Total tokens used
 */

/**
 * Model information
 * @typedef {Object} ModelInfo
 * @property {string} provider - The model provider (e.g., 'openai', 'anthropic')
 * @property {string} model - The specific model name
 * @property {string} version - Model version or date
 */

/**
 * Model Node Interface
 * Provides a unified interface for different AI providers
 */
class ModelNodeInterface {
  /**
   * Send a chat request to the model
   * @param {Message[]} messages - Array of conversation messages
   * @param {ToolDefinition[]} [tools] - Optional array of available tools
   * @param {'auto' | 'required' | 'none'} [toolChoice] - How the model should use tools
   * @returns {Promise<ModelResponse>} The model's response
   */
  async chat(messages, tools, toolChoice) {
    throw new Error('chat() must be implemented by subclass');
  }

  /**
   * Check if this model supports tool/function calling
   * @returns {boolean} True if tools are supported
   */
  supportsTools() {
    throw new Error('supportsTools() must be implemented by subclass');
  }

  /**
   * Check if this model supports vision/image inputs
   * @returns {boolean} True if vision is supported
   */
  supportsVision() {
    throw new Error('supportsVision() must be implemented by subclass');
  }

  /**
   * Check if this model supports streaming responses
   * @returns {boolean} True if streaming is supported
   */
  supportsStreaming() {
    throw new Error('supportsStreaming() must be implemented by subclass');
  }

  /**
   * Get information about this model
   * @returns {ModelInfo} Model information
   */
  getModelInfo() {
    throw new Error('getModelInfo() must be implemented by subclass');
  }
}

/**
 * Memory Node Interface
 * Manages conversation history with different storage strategies
 */
class MemoryNodeInterface {
  /**
   * Retrieve messages for a given session
   * @param {string} sessionId - Unique identifier for the conversation session
   * @returns {Promise<Message[]>} Array of messages in chronological order
   */
  async getMessages(sessionId) {
    throw new Error('getMessages() must be implemented by subclass');
  }

  /**
   * Add a message to the conversation history
   * @param {string} sessionId - Unique identifier for the conversation session
   * @param {Message} message - The message to add
   * @returns {Promise<void>}
   */
  async addMessage(sessionId, message) {
    throw new Error('addMessage() must be implemented by subclass');
  }

  /**
   * Clear all messages for a given session
   * @param {string} sessionId - Unique identifier for the conversation session
   * @returns {Promise<void>}
   */
  async clear(sessionId) {
    throw new Error('clear() must be implemented by subclass');
  }
}

/**
 * Tool Node Interface
 * Represents an executable function that the agent can invoke
 */
class ToolNodeInterface {
  /**
   * Get the tool definition for the model
   * @returns {ToolDefinition} The tool's definition including name, description, and parameters
   */
  getDefinition() {
    throw new Error('getDefinition() must be implemented by subclass');
  }

  /**
   * Execute the tool with given arguments
   * @param {Object} args - Arguments to pass to the tool (validated against JSON Schema)
   * @returns {Promise<ToolResult>} The result of the tool execution
   */
  async executeTool(args) {
    throw new Error('executeTool() must be implemented by subclass');
  }
}

module.exports = {
  ModelNodeInterface,
  MemoryNodeInterface,
  ToolNodeInterface,
};

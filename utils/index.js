/**
 * Utilities for AI Agent nodes
 * Exports all shared utilities, interfaces, and helpers
 */

const {
  ModelNodeInterface,
  MemoryNodeInterface,
  ToolNodeInterface,
} = require('./interfaces');

const {
  convertToOpenAIFormat,
  convertFromOpenAIFormat,
  convertToAnthropicFormat,
  convertFromAnthropicFormat,
} = require('./toolFormatConverters');

const {
  AgentStateManager,
  ToolCallTracker,
  AgentErrorHandler,
} = require('./agentLoopUtilities');

const {
  validateUrl,
} = require('./urlSecurityValidator');

module.exports = {
  // Interfaces
  ModelNodeInterface,
  MemoryNodeInterface,
  ToolNodeInterface,
  
  // Tool format converters
  convertToOpenAIFormat,
  convertFromOpenAIFormat,
  convertToAnthropicFormat,
  convertFromAnthropicFormat,
  
  // Agent loop utilities
  AgentStateManager,
  ToolCallTracker,
  AgentErrorHandler,
  
  // Security utilities
  validateUrl,
};

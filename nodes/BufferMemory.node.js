/**
 * Buffer Memory Node
 * 
 * Stores all conversation messages without limit for a given session.
 * This is a service node (no visual inputs/outputs) that is called by the AI Agent node.
 * 
 * Features:
 * - Unlimited message storage per session
 * - In-memory storage (messages persist during workflow execution)
 * - Session isolation (each session has independent message history)
 * - Chronological message ordering
 * - Support for dynamic session IDs via expressions
 * 
 * Use Cases:
 * - Short conversations where full context is needed
 * - Development and testing
 * - Workflows where cost is not a concern
 * 
 * Note: Messages are stored in memory and will be lost when the workflow restarts.
 * For persistent storage, use Redis Memory node.
 */

const { MemoryNodeInterface } = require('../utils/interfaces');

// Global storage for all Buffer Memory instances
// Key: sessionId, Value: array of messages
const globalStorage = new Map();

const BufferMemoryNode = {
  identifier: 'buffer-memory',
  nodeCategory: 'service', // Indicates this is a service node (not directly executable)
  displayName: 'Buffer Memory',
  name: 'buffer-memory',
  group: ['ai', 'memory'],
  version: 1,
  description: 'Store all conversation messages without limit (service node)',
  icon: 'fa:database',
  color: '#4A90E2',
  defaults: {
    name: 'Buffer Memory',
    sessionId: 'default',
  },
  inputs: [],
  outputs: ['memoryService'], // Output to connect to AI Agent's memory input
  properties: [
    {
      displayName: 'Session ID',
      name: 'sessionId',
      type: 'string',
      required: false,
      default: 'default',
      description: 'Unique identifier for conversation context. Supports {{json.field}} expressions (optional - can be provided by AI Agent)',
      placeholder: '{{json.userId}} or static-session-id',
    },
  ],

  /**
   * Retrieve all messages for a given session
   * Implements MemoryNodeInterface.getMessages()
   * 
   * @param {string} sessionId - Unique identifier for the conversation session
   * @returns {Promise<Array>} Array of messages in chronological order
   */
  async getMessages(sessionId) {
    try {
      // Use provided sessionId or fall back to node parameter
      let resolvedSessionId = sessionId;
      
      // If sessionId is a string that might contain expressions, try to resolve it
      if (typeof sessionId === 'string' && sessionId.includes('{{')) {
        try {
          resolvedSessionId = await this.resolveValue(sessionId);
        } catch (error) {
          // If resolution fails, use the sessionId as-is
          this.logger?.warn('[Buffer Memory] Failed to resolve sessionId expression, using as-is', {
            sessionId,
            error: error.message,
          });
        }
      }
      
      // Use default if no sessionId provided
      if (!resolvedSessionId) {
        resolvedSessionId = 'default';
      }
      
      this.logger?.debug('[Buffer Memory] Getting messages', {
        sessionId: resolvedSessionId,
      });

      // Return messages or empty array if session doesn't exist
      const messages = globalStorage.get(resolvedSessionId) || [];
      
      this.logger?.info('[Buffer Memory] Retrieved messages', {
        sessionId: resolvedSessionId,
        messageCount: messages.length,
      });

      return messages;
    } catch (error) {
      this.logger?.error('[Buffer Memory] Failed to get messages', {
        sessionId,
        error: error.message,
      });
      throw new Error(`Buffer Memory get failed: ${error.message}`);
    }
  },

  /**
   * Add a message to the conversation history
   * Implements MemoryNodeInterface.addMessage()
   * 
   * @param {string} sessionId - Unique identifier for the conversation session
   * @param {Object} message - The message to add
   * @returns {Promise<void>}
   */
  async addMessage(sessionId, message) {
    try {
      // Use provided sessionId or fall back to node parameter
      let resolvedSessionId = sessionId;
      
      // If sessionId is a string that might contain expressions, try to resolve it
      if (typeof sessionId === 'string' && sessionId.includes('{{')) {
        try {
          resolvedSessionId = await this.resolveValue(sessionId);
        } catch (error) {
          // If resolution fails, use the sessionId as-is
          this.logger?.warn('[Buffer Memory] Failed to resolve sessionId expression, using as-is', {
            sessionId,
            error: error.message,
          });
        }
      }
      
      // Use default if no sessionId provided
      if (!resolvedSessionId) {
        resolvedSessionId = 'default';
      }
      
      this.logger?.debug('[Buffer Memory] Adding message', {
        sessionId: resolvedSessionId,
        role: message.role,
      });

      // Get existing messages or create new array
      const messages = globalStorage.get(resolvedSessionId) || [];
      
      // Add timestamp if not present
      const messageWithTimestamp = {
        ...message,
        timestamp: message.timestamp || Date.now(),
      };
      
      // Append message
      messages.push(messageWithTimestamp);
      
      // Store back
      globalStorage.set(resolvedSessionId, messages);
      
      this.logger?.info('[Buffer Memory] Message added', {
        sessionId: resolvedSessionId,
        totalMessages: messages.length,
      });
    } catch (error) {
      this.logger?.error('[Buffer Memory] Failed to add message', {
        sessionId,
        error: error.message,
      });
      throw new Error(`Buffer Memory add failed: ${error.message}`);
    }
  },

  /**
   * Clear all messages for a given session
   * Implements MemoryNodeInterface.clear()
   * 
   * @param {string} sessionId - Unique identifier for the conversation session
   * @returns {Promise<void>}
   */
  async clear(sessionId) {
    try {
      // Use provided sessionId or fall back to node parameter
      let resolvedSessionId = sessionId;
      
      // If sessionId is a string that might contain expressions, try to resolve it
      if (typeof sessionId === 'string' && sessionId.includes('{{')) {
        try {
          resolvedSessionId = await this.resolveValue(sessionId);
        } catch (error) {
          // If resolution fails, use the sessionId as-is
          this.logger?.warn('[Buffer Memory] Failed to resolve sessionId expression, using as-is', {
            sessionId,
            error: error.message,
          });
        }
      }
      
      // Use default if no sessionId provided
      if (!resolvedSessionId) {
        resolvedSessionId = 'default';
      }
      
      this.logger?.debug('[Buffer Memory] Clearing session', {
        sessionId: resolvedSessionId,
      });

      // Delete session from storage
      const existed = globalStorage.has(resolvedSessionId);
      globalStorage.delete(resolvedSessionId);
      
      this.logger?.info('[Buffer Memory] Session cleared', {
        sessionId: resolvedSessionId,
        existed,
      });
    } catch (error) {
      this.logger?.error('[Buffer Memory] Failed to clear session', {
        sessionId,
        error: error.message,
      });
      throw new Error(`Buffer Memory clear failed: ${error.message}`);
    }
  },

  /**
   * Execute method (required for node interface)
   * Service nodes don't execute directly - they're called by the AI Agent
   */
  execute: async function (inputData) {
    throw new Error(
      'Buffer Memory is a service node and should not be executed directly. ' +
        'Connect it to an AI Agent node instead.'
    );
  },
};

module.exports = BufferMemoryNode;

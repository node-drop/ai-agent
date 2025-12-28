/**
 * Window Memory Node
 * 
 * Stores only the N most recent conversation messages for a given session.
 * This is a service node (no visual inputs/outputs) that is called by the AI Agent node.
 * 
 * Features:
 * - Configurable window size (max messages to keep)
 * - Automatic trimming of old messages
 * - In-memory storage (messages persist during workflow execution)
 * - Session isolation (each session has independent message history)
 * - Chronological message ordering
 * - Support for dynamic session IDs via expressions
 * 
 * Use Cases:
 * - Long conversations where only recent context is needed
 * - Cost optimization (fewer tokens sent to model)
 * - Memory-constrained environments
 * - Conversations with clear context boundaries
 * 
 * Note: Messages are stored in memory and will be lost when the workflow restarts.
 * For persistent storage, use Redis Memory node.
 */

const { MemoryNodeInterface } = require('../utils/interfaces');

// Global storage for all Window Memory instances
// Key: sessionId, Value: array of messages
const globalStorage = new Map();

const WindowMemoryNode = {
  identifier: 'window-memory',
  nodeCategory: 'service', // Indicates this is a service node (not directly executable)
  displayName: 'Window Memory',
  name: 'window-memory',
  group: ['ai', 'memory'],
  version: 1,
  description: 'Store only the N most recent messages (service node)',
  icon: 'file:window-memory.svg',
  color: '#5CB85C',
  defaults: {
    name: 'Window Memory',
    sessionId: 'default',
    maxMessages: 10,
  },
  inputs: [],
  outputs: ['memoryService'], // Output to connect to AI Agent's memory input
  properties: [
    {
      displayName: 'Session ID',
      name: 'sessionId',
      type: 'string',
      required: true,
      default: 'default',
      description: 'Unique identifier for conversation context. Supports {{json.field}} expressions',
      placeholder: '{{json.userId}} or static-session-id',
    },
    {
      displayName: 'Max Messages',
      name: 'maxMessages',
      type: 'number',
      required: false,
      default: 10,
      description: 'Number of recent messages to keep in the window',
      placeholder: '10',
      typeOptions: {
        minValue: 1,
        maxValue: 100,
      },
    },
  ],

  /**
   * Retrieve messages for a given session (returns last N messages)
   * Implements MemoryNodeInterface.getMessages()
   * 
   * @param {string} sessionId - Unique identifier for the conversation session
   * @returns {Promise<Array>} Array of last N messages in chronological order
   */
  async getMessages(sessionId) {
    try {
      // Resolve session ID (supports expressions like {{json.userId}})
      const resolvedSessionId = await this.resolveValue(sessionId);
      const maxMessages = await this.getNodeParameter('maxMessages');
      
      this.logger.debug('[Window Memory] Getting messages', {
        sessionId: resolvedSessionId,
        maxMessages,
      });

      // Get all messages for session
      const allMessages = globalStorage.get(resolvedSessionId) || [];
      
      // Return only the last N messages
      const windowMessages = allMessages.slice(-maxMessages);
      
      this.logger.info('[Window Memory] Retrieved messages', {
        sessionId: resolvedSessionId,
        totalMessages: allMessages.length,
        returnedMessages: windowMessages.length,
        maxMessages,
      });

      return windowMessages;
    } catch (error) {
      this.logger.error('[Window Memory] Failed to get messages', {
        sessionId,
        error: error.message,
      });
      throw new Error(`Window Memory get failed: ${error.message}`);
    }
  },

  /**
   * Add a message to the conversation history with automatic window trimming
   * Implements MemoryNodeInterface.addMessage()
   * 
   * @param {string} sessionId - Unique identifier for the conversation session
   * @param {Object} message - The message to add
   * @returns {Promise<void>}
   */
  async addMessage(sessionId, message) {
    try {
      // Resolve session ID (supports expressions like {{json.userId}})
      const resolvedSessionId = await this.resolveValue(sessionId);
      const maxMessages = await this.getNodeParameter('maxMessages');
      
      this.logger.debug('[Window Memory] Adding message', {
        sessionId: resolvedSessionId,
        role: message.role,
        maxMessages,
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
      
      // Trim to window size if exceeded
      let trimmed = false;
      if (messages.length > maxMessages) {
        const removed = messages.length - maxMessages;
        messages.splice(0, removed);
        trimmed = true;
      }
      
      // Store back
      globalStorage.set(resolvedSessionId, messages);
      
      this.logger.info('[Window Memory] Message added', {
        sessionId: resolvedSessionId,
        totalMessages: messages.length,
        maxMessages,
        trimmed,
      });
    } catch (error) {
      this.logger.error('[Window Memory] Failed to add message', {
        sessionId,
        error: error.message,
      });
      throw new Error(`Window Memory add failed: ${error.message}`);
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
      // Resolve session ID (supports expressions like {{json.userId}})
      const resolvedSessionId = await this.resolveValue(sessionId);
      
      this.logger.debug('[Window Memory] Clearing session', {
        sessionId: resolvedSessionId,
      });

      // Delete session from storage
      const existed = globalStorage.has(resolvedSessionId);
      globalStorage.delete(resolvedSessionId);
      
      this.logger.info('[Window Memory] Session cleared', {
        sessionId: resolvedSessionId,
        existed,
      });
    } catch (error) {
      this.logger.error('[Window Memory] Failed to clear session', {
        sessionId,
        error: error.message,
      });
      throw new Error(`Window Memory clear failed: ${error.message}`);
    }
  },

  /**
   * Execute method (required for node interface)
   * Service nodes don't execute directly - they're called by the AI Agent
   */
  execute: async function (inputData) {
    throw new Error(
      'Window Memory is a service node and should not be executed directly. ' +
        'Connect it to an AI Agent node instead.'
    );
  },
};

module.exports = WindowMemoryNode;

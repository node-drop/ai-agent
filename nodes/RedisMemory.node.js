/**
 * Redis Memory Node
 * 
 * Stores conversation messages persistently in Redis with optional TTL.
 * This is a service node (no visual inputs/outputs) that is called by the AI Agent node.
 * 
 * Features:
 * - Persistent storage (survives workflow restarts)
 * - Configurable TTL (time-to-live) for automatic expiration
 * - Customizable key prefix for namespace isolation
 * - Session isolation (each session has independent message history)
 * - Chronological message ordering
 * - Support for dynamic session IDs via expressions
 * - Connection pooling and error handling
 * 
 * Use Cases:
 * - Production deployments requiring persistence
 * - Multi-instance workflow deployments
 * - Long-running conversations
 * - Conversations that need to survive restarts
 * - Shared memory across multiple workflows
 * 
 * Requirements:
 * - Redis server must be accessible
 * - Redis credentials must be configured
 */

const { createClient } = require('redis');
const { MemoryNodeInterface } = require('../utils/interfaces');

// Global Redis client cache (one client per unique connection)
// Key: connection string, Value: Redis client
const clientCache = new Map();

const RedisMemoryNode = {
  identifier: 'redis-memory',
  nodeCategory: 'service', // Indicates this is a service node (not directly executable)
  displayName: 'Redis Memory',
  name: 'redis-memory',
  group: ['ai', 'memory'],
  version: 1,
  description: 'Store conversation messages persistently in Redis (service node)',
  icon: 'file:redis.svg',
  color: '#DC382D',
  defaults: {
    name: 'Redis Memory',
    sessionId: 'default',
  },
  inputs: [],
  outputs: ['memoryService'], // Output to connect to AI Agent's memory input
  properties: [
    {
      displayName: 'Authentication',
      name: 'authentication',
      type: 'credential',
      required: true,
      default: '',
      description: 'Redis connection credentials',
      placeholder: 'Select credentials...',
      allowedTypes: ['redisConnection'],
    },
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
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      description: 'Additional Redis memory configuration',
      options: [
        {
          name: 'ttl',
          displayName: 'TTL (seconds)',
          type: 'number',
          default: 0,
          description: 'Time-to-live for messages (0 = no expiration)',
          placeholder: '3600',
          typeOptions: {
            minValue: 0,
          },
        },
        {
          name: 'keyPrefix',
          displayName: 'Key Prefix',
          type: 'string',
          default: 'agent:memory:',
          description: 'Prefix for Redis keys (useful for namespace isolation)',
          placeholder: 'agent:memory:',
        },
      ],
    },
  ],

  /**
   * Get or create a Redis client for this connection
   * @private
   */
  _getClient: async function() {
    try {
      const credentials = await this.getCredentials('redisConnection');
      if (!credentials) {
        throw new Error('Redis credentials are required. Please configure credentials.');
      }

      // Build connection string for cache key
      const connectionKey = `${credentials.host}:${credentials.port}:${credentials.database || 0}`;

      // Check if we already have a client for this connection
      if (clientCache.has(connectionKey)) {
        const cachedClient = clientCache.get(connectionKey);
        
        // Verify client is still connected
        if (cachedClient.isOpen) {
          return cachedClient;
        } else {
          // Remove stale client
          clientCache.delete(connectionKey);
        }
      }

      // Create new client
      const clientOptions = {
        socket: {
          host: credentials.host || 'localhost',
          port: credentials.port || 6379,
        },
      };

      // Add password if provided
      if (credentials.password) {
        clientOptions.password = credentials.password;
      }

      // Add database if provided
      if (credentials.database !== undefined) {
        clientOptions.database = credentials.database;
      }

      const client = createClient(clientOptions);

      // Set up error handler
      client.on('error', (err) => {
        this.logger.error('[Redis Memory] Client error', {
          error: err.message,
          connectionKey,
        });
      });

      // Connect
      await client.connect();

      this.logger.info('[Redis Memory] Connected to Redis', {
        host: credentials.host,
        port: credentials.port,
        database: credentials.database || 0,
      });

      // Cache the client
      clientCache.set(connectionKey, client);

      return client;
    } catch (error) {
      this.logger.error('[Redis Memory] Failed to connect', {
        error: error.message,
      });
      throw new Error(`Redis connection failed: ${error.message}`);
    }
  },

  /**
   * Build the Redis key for a session
   * @private
   */
  _buildKey: async function(sessionId) {
    const options = (await this.getNodeParameter('options')) || {};
    const keyPrefix = options.keyPrefix || 'agent:memory:';
    return `${keyPrefix}${sessionId}`;
  },

  /**
   * Retrieve messages for a given session from Redis
   * Implements MemoryNodeInterface.getMessages()
   * 
   * @param {string} sessionId - Unique identifier for the conversation session
   * @returns {Promise<Array>} Array of messages in chronological order
   */
  async getMessages(sessionId) {
    try {
      // Resolve session ID (supports expressions like {{json.userId}})
      const resolvedSessionId = await this.resolveValue(sessionId);
      const key = await this._buildKey(resolvedSessionId);
      
      this.logger.debug('[Redis Memory] Getting messages', {
        sessionId: resolvedSessionId,
        key,
      });

      const client = await this._getClient();
      
      // Get data from Redis
      const data = await client.get(key);
      
      // Parse messages or return empty array
      const messages = data ? JSON.parse(data) : [];
      
      this.logger.info('[Redis Memory] Retrieved messages', {
        sessionId: resolvedSessionId,
        messageCount: messages.length,
      });

      return messages;
    } catch (error) {
      this.logger.error('[Redis Memory] Failed to get messages', {
        sessionId,
        error: error.message,
      });
      
      // Graceful degradation - return empty array instead of failing
      this.logger.warn('[Redis Memory] Returning empty array due to error');
      return [];
    }
  },

  /**
   * Add a message to the conversation history in Redis
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
      const key = await this._buildKey(resolvedSessionId);
      const options = (await this.getNodeParameter('options')) || {};
      const ttl = options.ttl || 0;
      
      this.logger.debug('[Redis Memory] Adding message', {
        sessionId: resolvedSessionId,
        role: message.role,
        key,
        ttl,
      });

      const client = await this._getClient();
      
      // Get existing messages
      const messages = await this.getMessages(sessionId);
      
      // Add timestamp if not present
      const messageWithTimestamp = {
        ...message,
        timestamp: message.timestamp || Date.now(),
      };
      
      // Append message
      messages.push(messageWithTimestamp);
      
      // Store back to Redis
      await client.set(key, JSON.stringify(messages));
      
      // Set TTL if configured
      if (ttl > 0) {
        await client.expire(key, ttl);
      }
      
      this.logger.info('[Redis Memory] Message added', {
        sessionId: resolvedSessionId,
        totalMessages: messages.length,
        ttl: ttl > 0 ? ttl : 'none',
      });
    } catch (error) {
      this.logger.error('[Redis Memory] Failed to add message', {
        sessionId,
        error: error.message,
      });
      
      // Don't throw - graceful degradation
      this.logger.warn('[Redis Memory] Continuing without storing message');
    }
  },

  /**
   * Clear all messages for a given session from Redis
   * Implements MemoryNodeInterface.clear()
   * 
   * @param {string} sessionId - Unique identifier for the conversation session
   * @returns {Promise<void>}
   */
  async clear(sessionId) {
    try {
      // Resolve session ID (supports expressions like {{json.userId}})
      const resolvedSessionId = await this.resolveValue(sessionId);
      const key = await this._buildKey(resolvedSessionId);
      
      this.logger.debug('[Redis Memory] Clearing session', {
        sessionId: resolvedSessionId,
        key,
      });

      const client = await this._getClient();
      
      // Delete key from Redis
      const deleted = await client.del(key);
      
      this.logger.info('[Redis Memory] Session cleared', {
        sessionId: resolvedSessionId,
        existed: deleted > 0,
      });
    } catch (error) {
      this.logger.error('[Redis Memory] Failed to clear session', {
        sessionId,
        error: error.message,
      });
      
      // Don't throw - graceful degradation
      this.logger.warn('[Redis Memory] Continuing without clearing session');
    }
  },

  /**
   * Execute method (required for node interface)
   * Service nodes don't execute directly - they're called by the AI Agent
   */
  execute: async function (inputData) {
    throw new Error(
      'Redis Memory is a service node and should not be executed directly. ' +
        'Connect it to an AI Agent node instead.'
    );
  },
};

module.exports = RedisMemoryNode;

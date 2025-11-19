/**
 * Knowledge Base Tool Node
 * 
 * Searches a vector database for relevant information using semantic search.
 * Connect this node to the AI Agent's 'tools' input to enable knowledge base search capabilities.
 * 
 * Features:
 * - Semantic search using embeddings
 * - Configurable collection/index
 * - Top-K results with similarity scoring
 * - Minimum score threshold filtering
 * - Support for multiple embedding models
 * 
 * Note: This is a simplified implementation that uses OpenAI embeddings.
 * In a production environment, you would integrate with a vector database
 * like Pinecone, Weaviate, Qdrant, or Chroma.
 */

const OpenAI = require('openai');
const { ToolNodeInterface } = require('../utils/interfaces');

const KnowledgeBaseToolNode = {
  identifier: 'knowledge-base-tool',
  nodeCategory: 'tool', // Indicates this is a tool node (not directly executable)
  displayName: 'Knowledge Base Tool',
  name: 'knowledge-base-tool',
  group: ['ai', 'tool'],
  version: 1,
  description: 'Search a knowledge base using semantic search (service node for AI Agent)',
  icon: 'fa:book',
  color: '#9C27B0',
  defaults: {
    name: 'Knowledge Base Tool',
    embeddingModel: 'text-embedding-3-small',
  },
  inputs: [],
  outputs: ['tool'], // Output to connect to AI Agent's tools input
  properties: [
    {
      displayName: 'Authentication',
      name: 'authentication',
      type: 'credential',
      required: true,
      default: '',
      description: 'OpenAI API credentials for generating embeddings',
      placeholder: 'Select credentials...',
      allowedTypes: ['openaiApi'],
    },
    {
      displayName: 'Collection',
      name: 'collection',
      type: 'string',
      required: true,
      default: '',
      description: 'Vector collection/index name to search',
      placeholder: 'my-knowledge-base',
    },
    {
      displayName: 'Embedding Model',
      name: 'embeddingModel',
      type: 'options',
      required: false,
      default: 'text-embedding-3-small',
      description: 'Model to use for generating embeddings',
      options: [
        {
          name: 'Text Embedding 3 Small',
          value: 'text-embedding-3-small',
          description: 'Fast and efficient, good for most use cases',
        },
        {
          name: 'Text Embedding 3 Large',
          value: 'text-embedding-3-large',
          description: 'Higher quality embeddings, more expensive',
        },
        {
          name: 'Text Embedding Ada 002',
          value: 'text-embedding-ada-002',
          description: 'Legacy model, still reliable',
        },
      ],
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      description: 'Knowledge base search configuration',
      options: [
        {
          name: 'topK',
          displayName: 'Top K Results',
          type: 'number',
          default: 5,
          description: 'Number of results to return',
          placeholder: '5',
          typeOptions: {
            minValue: 1,
            maxValue: 50,
          },
        },
        {
          name: 'minScore',
          displayName: 'Minimum Score',
          type: 'number',
          default: 0.7,
          description: 'Minimum similarity score (0-1) to include results',
          placeholder: '0.7',
          typeOptions: {
            minValue: 0,
            maxValue: 1,
            numberPrecision: 2,
          },
        },
      ],
    },
  ],

  /**
   * Initialize the OpenAI client for embeddings
   * @private
   */
  _getClient: async function() {
    const credentials = await this.getCredentials('openaiApi');
    if (!credentials || !credentials.apiKey) {
      throw new Error('OpenAI API key is required for embeddings. Please configure credentials.');
    }

    return new OpenAI({
      apiKey: credentials.apiKey,
    });
  },

  /**
   * Generate embedding for a text query
   * @private
   * @param {string} text - The text to embed
   * @returns {Promise<number[]>} The embedding vector
   */
  _generateEmbedding: async function(text) {
    const client = await this._getClient();
    const embeddingModel = await this.getNodeParameter('embeddingModel');

    const response = await client.embeddings.create({
      model: embeddingModel,
      input: text,
    });

    return response.data[0].embedding;
  },

  /**
   * Calculate cosine similarity between two vectors
   * @private
   * @param {number[]} a - First vector
   * @param {number[]} b - Second vector
   * @returns {number} Similarity score (0-1)
   */
  _cosineSimilarity: function(a, b) {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  },

  /**
   * Search the vector database
   * @private
   * @param {number[]} queryEmbedding - The query embedding vector
   * @param {number} limit - Maximum number of results
   * @param {number} minScore - Minimum similarity score
   * @returns {Promise<Array>} Search results
   */
  _searchVectorDB: async function(queryEmbedding, limit, minScore) {
    // NOTE: This is a placeholder implementation
    // In a real implementation, you would:
    // 1. Connect to your vector database (Pinecone, Weaviate, Qdrant, Chroma, etc.)
    // 2. Perform the similarity search
    // 3. Return the results
    
    // For now, we'll return a mock result to demonstrate the structure
    // In production, replace this with actual vector DB integration
    
    this.logger?.warn('[Knowledge Base Tool] Using mock vector database. Integrate with a real vector DB for production use.');
    
    // Mock results - in production, this would come from your vector DB
    const mockResults = [
      {
        content: 'This is a placeholder result from the knowledge base. Please integrate with a real vector database.',
        score: 0.85,
        metadata: {
          source: 'mock',
          timestamp: new Date().toISOString(),
        },
      },
    ];

    // Filter by minimum score and limit
    return mockResults
      .filter(result => result.score >= minScore)
      .slice(0, limit);
  },

  /**
   * Get the tool definition for the AI model
   * Implements ToolNodeInterface.getDefinition()
   * 
   * @returns {Object} Tool definition with name, description, and parameters
   */
  getDefinition() {
    return {
      name: 'knowledge_base_search',
      description: 'Search the knowledge base for relevant information using semantic search. Returns documents with similarity scores.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find relevant information',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default 5, max 50)',
          },
        },
        required: ['query'],
      },
    };
  },

  /**
   * Execute the knowledge base search tool
   * Implements ToolNodeInterface.execute()
   * 
   * @param {Object} args - Tool arguments
   * @param {string} args.query - Search query
   * @param {number} [args.limit] - Maximum number of results
   * @returns {Promise<Object>} Tool result with success status and data/error
   */
  async executeTool(args) {
    try {
      // Validate required parameters
      if (!args.query || typeof args.query !== 'string') {
        return {
          success: false,
          error: 'Query parameter is required and must be a string',
        };
      }

      if (args.query.trim().length === 0) {
        return {
          success: false,
          error: 'Query cannot be empty',
        };
      }

      // Get options
      const options = (await this.getNodeParameter('options')) || {};
      const topK = options.topK || 5;
      const minScore = options.minScore !== undefined ? options.minScore : 0.7;
      
      // Use limit from args or default to topK
      const limit = args.limit ? Math.min(Math.max(1, args.limit), 50) : topK;

      this.logger?.info('[Knowledge Base Tool] Searching knowledge base', {
        query: args.query,
        limit,
        minScore,
      });

      // Generate embedding for the query
      const queryEmbedding = await this._generateEmbedding(args.query);

      // Search the vector database
      const results = await this._searchVectorDB(queryEmbedding, limit, minScore);

      this.logger?.info('[Knowledge Base Tool] Search completed', {
        query: args.query,
        resultsFound: results.length,
      });

      return {
        success: true,
        data: {
          query: args.query,
          results: results.map(r => ({
            content: r.content,
            score: r.score,
            metadata: r.metadata || {},
          })),
          count: results.length,
        },
      };
    } catch (error) {
      this.logger?.error('[Knowledge Base Tool] Search failed', {
        query: args.query,
        error: error.message,
      });

      // Provide user-friendly error messages
      if (error.status === 401) {
        return {
          success: false,
          error: 'Invalid OpenAI API key for embeddings. Please check your credentials.',
        };
      } else if (error.status === 429) {
        return {
          success: false,
          error: 'OpenAI rate limit exceeded. Please try again later.',
        };
      } else {
        return {
          success: false,
          error: `Knowledge base search failed: ${error.message}`,
        };
      }
    }
  },

  /**
   * Execute method (required for node interface)
   * Service nodes don't execute directly - they're called by the AI Agent
   */
  execute: async function () {
    throw new Error(
      'Knowledge Base Tool is a service node and should not be executed directly. ' +
        'Connect it to an AI Agent node instead.'
    );
  },
};

module.exports = KnowledgeBaseToolNode;

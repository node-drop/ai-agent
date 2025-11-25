/**
 * Anthropic Model Node
 * 
 * Provides a unified interface to Anthropic's Claude models for the AI Agent system.
 * This is a service node (no visual inputs/outputs) that is called by the AI Agent node.
 * 
 * Features:
 * - Multiple Claude models (Claude 3.5 Sonnet, Haiku, Opus)
 * - Tool use support
 * - Advanced parameters (temperature, top_p, top_k)
 * - System prompt handling according to Anthropic's requirements
 * - Automatic retry logic
 * - Error handling with user-friendly messages
 */

const Anthropic = require('@anthropic-ai/sdk');
const { ModelNodeInterface } = require('../utils/interfaces');
const {
  convertToAnthropicFormat,
  convertFromAnthropicFormat,
} = require('../utils/toolFormatConverters');

const AnthropicModelNode = {
  identifier: 'anthropic-model',
  nodeCategory: 'service', // Indicates this is a service node (not directly executable)
  displayName: 'Anthropic Model',
  name: 'anthropic-model',
  group: ['ai', 'model'],
  version: 1,
  description: 'Anthropic Claude model provider for AI Agent (service node)',
  icon: 'svg:anthropic',
  color: '#D97757',
  defaults: {
    name: 'Anthropic Model',
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 1000,
  },
  inputs: [],
  outputs: ['modelService'], // Output to connect to AI Agent's model input
  properties: [
    {
      displayName: 'Authentication',
      name: 'authentication',
      type: 'credential',
      required: true,
      default: '',
      description: 'Anthropic API credentials',
      placeholder: 'Select credentials...',
      allowedTypes: ['anthropicApi'],
    },
    {
      displayName: 'Model',
      name: 'model',
      type: 'options',
      required: true,
      default: 'claude-3-5-sonnet-20241022',
      description: 'The Claude model to use',
      options: [
        {
          name: 'Claude 3.5 Sonnet',
          value: 'claude-3-5-sonnet-20241022',
          description: 'Most capable model, best for complex tasks',
        },
        {
          name: 'Claude 3.5 Haiku',
          value: 'claude-3-5-haiku-20241022',
          description: 'Fast and affordable, good for most tasks',
        },
        {
          name: 'Claude 3 Opus',
          value: 'claude-3-opus-20240229',
          description: 'Previous generation flagship model',
        },
      ],
    },
    {
      displayName: 'Temperature',
      name: 'temperature',
      type: 'number',
      required: false,
      default: 0.7,
      description: 'Controls randomness (0-1). Higher = more random',
      placeholder: '0.7',
      typeOptions: {
        minValue: 0,
        maxValue: 1,
        numberPrecision: 1,
      },
    },
    {
      displayName: 'Max Tokens',
      name: 'maxTokens',
      type: 'number',
      required: false,
      default: 1000,
      description: 'Maximum tokens in response',
      placeholder: '1000',
      typeOptions: {
        minValue: 1,
        maxValue: 8192,
      },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      description: 'Advanced Anthropic configuration',
      options: [
        {
          name: 'topP',
          displayName: 'Top P',
          type: 'number',
          default: 1,
          description: 'Nucleus sampling (0-1)',
          typeOptions: {
            minValue: 0,
            maxValue: 1,
            numberPrecision: 2,
          },
        },
        {
          name: 'topK',
          displayName: 'Top K',
          type: 'number',
          default: 0,
          description: 'Sample from top K tokens (0 = disabled)',
          typeOptions: {
            minValue: 0,
            maxValue: 500,
          },
        },
        {
          name: 'stop',
          displayName: 'Stop Sequences',
          type: 'string',
          default: '',
          placeholder: '\\n\\n, END',
          description: 'Comma-separated stop sequences',
        },
      ],
    },
  ],

  /**
   * Initialize the Anthropic client
   * @private
   */
  _getClient: async function() {
    const credentials = await this.getCredentials('anthropicApi');
    if (!credentials || !credentials.apiKey) {
      throw new Error('Anthropic API key is required. Please configure credentials.');
    }

    return new Anthropic({
      apiKey: credentials.apiKey,
    });
  },

  /**
   * Convert messages to Anthropic format
   * Anthropic requires system prompts to be separate from messages
   * @private
   */
  _prepareMessages: function(messages) {
    let systemPrompt = '';
    const conversationMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Extract system prompt (Anthropic handles it separately)
        systemPrompt = msg.content;
      } else if (msg.role === 'tool') {
        // Convert tool result to Anthropic format
        conversationMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.toolCallId,
              content: msg.content,
            },
          ],
        });
      } else {
        // Regular user/assistant message
        conversationMessages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    return { systemPrompt, conversationMessages };
  },

  /**
   * Send a chat request to Anthropic
   * Implements ModelNodeInterface.chat()
   * 
   * @param {Array} messages - Array of conversation messages
   * @param {Array} tools - Optional array of available tools
   * @param {string} toolChoice - How the model should use tools ('auto', 'required', 'none')
   * @returns {Promise<Object>} The model's response in standardized format
   */
  async chat(messages, tools, toolChoice) {
    try {
      const client = await this._getClient();
      const model = await this.getNodeParameter('model');
      const temperature = await this.getNodeParameter('temperature');
      const maxTokens = await this.getNodeParameter('maxTokens');
      const options = (await this.getNodeParameter('options')) || {};

      // Prepare messages (extract system prompt)
      const { systemPrompt, conversationMessages } = this._prepareMessages(messages);

      // Build request options
      const requestOptions = {
        model,
        messages: conversationMessages,
        max_tokens: maxTokens,
        temperature,
      };

      // Add system prompt if present
      if (systemPrompt) {
        requestOptions.system = systemPrompt;
      }

      // Add tools if provided
      if (tools && tools.length > 0 && toolChoice !== 'none') {
        requestOptions.tools = tools.map(convertToAnthropicFormat);
        
        // Set tool choice
        if (toolChoice === 'required') {
          requestOptions.tool_choice = { type: 'any' };
        } else if (toolChoice === 'auto') {
          requestOptions.tool_choice = { type: 'auto' };
        }
      }

      // Add advanced options
      if (options.topP !== undefined && options.topP !== 1) {
        requestOptions.top_p = options.topP;
      }
      if (options.topK !== undefined && options.topK !== 0) {
        requestOptions.top_k = options.topK;
      }
      if (options.stop) {
        const stopSequences = options.stop
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s);
        if (stopSequences.length > 0) {
          requestOptions.stop_sequences = stopSequences;
        }
      }

      this.logger.info('[Anthropic Model] Sending request', {
        model,
        messageCount: conversationMessages.length,
        hasSystemPrompt: !!systemPrompt,
        hasTools: !!tools && tools.length > 0,
        toolChoice,
      });

      // Make API call with retry logic
      const response = await client.messages.create(requestOptions, {
        timeout: 60000,
        maxRetries: 2,
      });

      this.logger.info('[Anthropic Model] Request completed', {
        model,
        stopReason: response.stop_reason,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      });

      // Convert to standardized format
      return convertFromAnthropicFormat(response);
    } catch (error) {
      this.logger.error('[Anthropic Model] Request failed', {
        error: error.message,
        status: error.status,
      });

      // Provide user-friendly error messages
      if (error.status === 401) {
        throw new Error('Invalid Anthropic API key. Please check your credentials.');
      } else if (error.status === 429) {
        throw new Error('Anthropic rate limit exceeded. Please try again later.');
      } else if (error.status === 500 || error.status === 503) {
        throw new Error('Anthropic service error. Please try again later.');
      } else if (error.status === 400) {
        throw new Error(`Anthropic request error: ${error.message}`);
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error('Cannot connect to Anthropic API. Please check your internet connection.');
      } else {
        throw new Error(`Anthropic error: ${error.message}`);
      }
    }
  },

  /**
   * Check if this model supports tool/function calling
   * Implements ModelNodeInterface.supportsTools()
   */
  supportsTools() {
    return true; // All Claude 3+ models support tool use
  },

  /**
   * Check if this model supports vision/image inputs
   * Implements ModelNodeInterface.supportsVision()
   */
  supportsVision() {
    return true; // All Claude 3+ models support vision
  },

  /**
   * Check if this model supports streaming responses
   * Implements ModelNodeInterface.supportsStreaming()
   */
  supportsStreaming() {
    return true; // All Claude models support streaming
  },

  /**
   * Get information about this model
   * Implements ModelNodeInterface.getModelInfo()
   */
  getModelInfo() {
    const model = this.getNodeParameter('model');
    return {
      provider: 'anthropic',
      model: model || 'claude-3-5-sonnet-20241022',
      version: '2024-10',
    };
  },

  /**
   * Execute method (required for node interface)
   * Service nodes don't execute directly - they're called by the AI Agent
   */
  execute: async function (inputData) {
    throw new Error(
      'Anthropic Model is a service node and should not be executed directly. ' +
        'Connect it to an AI Agent node instead.'
    );
  },
};

module.exports = AnthropicModelNode;

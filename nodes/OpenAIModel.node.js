/**
 * OpenAI Model Node
 * 
 * Provides a unified interface to OpenAI's GPT models for the AI Agent system.
 * This is a service node (no visual inputs/outputs) that is called by the AI Agent node.
 * 
 * Features:
 * - Multiple GPT models (GPT-4o, GPT-4 Turbo, GPT-3.5, etc.)
 * - Tool/function calling support
 * - Advanced parameters (temperature, top_p, penalties, etc.)
 * - JSON mode for structured outputs
 * - Automatic retry logic with exponential backoff
 * - Error handling with user-friendly messages
 */

const OpenAI = require('openai');
const { ModelNodeInterface } = require('../utils/interfaces');
const {
  convertToOpenAIFormat,
  convertFromOpenAIFormat,
} = require('../utils/toolFormatConverters');

const OpenAIModelNode = {
  identifier: 'openai-model',
  nodeCategory: 'service', // Indicates this is a service node (not directly executable)
  displayName: 'OpenAI Model',
  name: 'openai-model',
  group: ['ai', 'model'],
  version: 1,
  description: 'OpenAI GPT model provider for AI Agent (service node)',
  icon: 'svg:openai',
  color: '#000',
  defaults: {
    name: 'OpenAI Model',
    model: 'gpt-4o-mini',
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
      description: 'OpenAI API credentials',
      placeholder: 'Select credentials...',
      allowedTypes: ["apiKey"],
    },
    {
      displayName: 'Model',
      name: 'model',
      type: 'options',
      required: true,
      default: 'gpt-4o-mini',
      description: 'The OpenAI model to use',
      options: [
        {
          name: 'GPT-4o',
          value: 'gpt-4o',
          description: 'Most capable model, best for complex tasks',
        },
        {
          name: 'GPT-4o Mini',
          value: 'gpt-4o-mini',
          description: 'Fast and affordable, good for most tasks',
        },
        {
          name: 'GPT-4 Turbo',
          value: 'gpt-4-turbo',
          description: 'Previous generation flagship model',
        },
        {
          name: 'GPT-3.5 Turbo',
          value: 'gpt-3.5-turbo',
          description: 'Fast and economical for simple tasks',
        },
      ],
    },
    {
      displayName: 'Temperature',
      name: 'temperature',
      type: 'number',
      required: false,
      default: 0.7,
      description: 'Controls randomness (0-2). Higher = more random',
      placeholder: '0.7',
      typeOptions: {
        minValue: 0,
        maxValue: 2,
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
        maxValue: 16000,
      },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      description: 'Advanced OpenAI configuration',
      options: [
        {
          name: 'jsonMode',
          displayName: 'JSON Mode',
          type: 'boolean',
          default: false,
          description: 'Force JSON response format (GPT-4 Turbo and newer)',
        },
        {
          name: 'topP',
          displayName: 'Top P',
          type: 'number',
          default: 1,
          description: 'Nucleus sampling (0-1). Alternative to temperature',
          typeOptions: {
            minValue: 0,
            maxValue: 1,
            numberPrecision: 2,
          },
        },
        {
          name: 'frequencyPenalty',
          displayName: 'Frequency Penalty',
          type: 'number',
          default: 0,
          description: 'Reduce repetition (-2 to 2)',
          typeOptions: {
            minValue: -2,
            maxValue: 2,
            numberPrecision: 1,
          },
        },
        {
          name: 'presencePenalty',
          displayName: 'Presence Penalty',
          type: 'number',
          default: 0,
          description: 'Encourage new topics (-2 to 2)',
          typeOptions: {
            minValue: -2,
            maxValue: 2,
            numberPrecision: 1,
          },
        },
        {
          name: 'seed',
          displayName: 'Seed',
          type: 'number',
          default: undefined,
          description: 'Random seed for deterministic outputs',
          placeholder: '12345',
        },
        {
          name: 'stop',
          displayName: 'Stop Sequences',
          type: 'string',
          default: '',
          placeholder: '\\n\\n, END',
          description: 'Comma-separated stop sequences (max 4)',
        },
      ],
    },
  ],

  /**
   * Initialize the OpenAI client
   * @private
   */
  _getClient: async function() {
    const credentials = await this.getCredentials('apiKey');
    if (!credentials || !credentials.apiKey) {
      throw new Error('OpenAI API key is required. Please configure credentials.');
    }

    return new OpenAI({
      apiKey: credentials.apiKey,
    });
  },

  /**
   * Send a chat request to OpenAI
   * Implements ModelNodeInterface.chat()
   * 
   * @param {Array} messages - Array of conversation messages
   * @param {Array} tools - Optional array of available tools
   * @param {string} toolChoice - How the model should use tools ('auto', 'required', 'none')
   * @returns {Promise<Object>} The model's response in standardized format
   */
  async chat(messages, tools, toolChoice) {
    let requestOptions; // Declare outside try block so it's accessible in catch
    
    try {
      const client = await this._getClient();
      const model = await this.getNodeParameter('model');
      const temperature = await this.getNodeParameter('temperature');
      const maxTokens = await this.getNodeParameter('maxTokens');
      const options = (await this.getNodeParameter('options')) || {};

      // Build request options
      requestOptions = {
        model,
        messages: messages.map((m) => {
          const message = {
            role: m.role,
          };
          
          // Handle content - OpenAI doesn't accept null, only string or omit
          if (m.content !== null && m.content !== undefined) {
            message.content = m.content;
          } else if (!m.tool_calls) {
            // If no tool_calls, content is required (use empty string)
            message.content = '';
          }
          // If tool_calls exist and content is null, omit content entirely
          
          // Add tool_calls if present (for assistant messages)
          if (m.tool_calls) {
            message.tool_calls = m.tool_calls;
          }
          
          // Add tool_call_id if present (for tool response messages)
          if (m.toolCallId) {
            message.tool_call_id = m.toolCallId;
          }
          
          return message;
        }),
        temperature,
        max_tokens: maxTokens,
      };

      // Add tools if provided
      if (tools && tools.length > 0 && toolChoice !== 'none') {
        requestOptions.tools = tools.map(convertToOpenAIFormat);
        
        this.logger.info('[OpenAI Model] Tools configured', {
          toolCount: tools.length,
          toolNames: tools.map(t => t.name),
          formattedTools: requestOptions.tools,
        });
        
        // Set tool choice
        if (toolChoice === 'required') {
          requestOptions.tool_choice = 'required';
        } else if (toolChoice === 'auto') {
          requestOptions.tool_choice = 'auto';
        }
      }

      // Add JSON mode if enabled (for compatible models)
      if (options.jsonMode && (model.includes('gpt-4') || model.includes('gpt-3.5'))) {
        requestOptions.response_format = { type: 'json_object' };
      }

      // Add advanced options
      if (options.topP !== undefined && options.topP !== 1) {
        requestOptions.top_p = options.topP;
      }
      if (options.frequencyPenalty !== undefined && options.frequencyPenalty !== 0) {
        requestOptions.frequency_penalty = options.frequencyPenalty;
      }
      if (options.presencePenalty !== undefined && options.presencePenalty !== 0) {
        requestOptions.presence_penalty = options.presencePenalty;
      }
      if (options.stop) {
        const stopSequences = options.stop
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s);
        if (stopSequences.length > 0) {
          requestOptions.stop = stopSequences.slice(0, 4); // Max 4 sequences
        }
      }
      if (options.seed !== undefined) {
        requestOptions.seed = options.seed;
      }

      this.logger.info('[OpenAI Model] Sending request', {
        model,
        messageCount: messages.length,
        hasTools: !!tools && tools.length > 0,
        toolChoice,
        // Log full request for debugging
        fullRequest: {
          model: requestOptions.model,
          messageCount: requestOptions.messages.length,
          messages: requestOptions.messages.map(m => ({
            role: m.role,
            hasContent: m.content !== undefined && m.content !== null,
            contentLength: m.content?.length || 0,
            contentPreview: m.content ? String(m.content).substring(0, 100) : null,
            hasToolCalls: !!m.tool_calls,
            toolCallCount: m.tool_calls?.length || 0,
            hasToolCallId: !!m.tool_call_id,
          })),
          temperature: requestOptions.temperature,
          maxTokens: requestOptions.max_tokens,
          hasTools: !!requestOptions.tools,
          toolCount: requestOptions.tools?.length || 0,
          toolChoice: requestOptions.tool_choice,
        },
      });

      // Make API call with retry logic (default 2 retries)
      const response = await client.chat.completions.create(requestOptions, {
        timeout: 60000,
        maxRetries: 2,
      });

      this.logger.info('[OpenAI Model] Request completed', {
        model,
        finishReason: response.choices[0].finish_reason,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
      });

      // Convert to standardized format
      return convertFromOpenAIFormat(response);
    } catch (error) {
      this.logger.error('[OpenAI Model] Request failed', {
        error: error.message,
        errorStack: error.stack,
        status: error.status,
        statusText: error.statusText,
        code: error.code,
        type: error.type,
        // Log the parameters that were sent to OpenAI
        requestParameters: {
          model: requestOptions?.model,
          messageCount: requestOptions?.messages?.length,
          messages: requestOptions?.messages?.map(m => ({
            role: m.role,
            hasContent: m.content !== undefined && m.content !== null,
            contentLength: m.content?.length || 0,
            contentPreview: m.content ? String(m.content).substring(0, 200) : null,
            hasToolCalls: !!m.tool_calls,
            toolCallCount: m.tool_calls?.length || 0,
            hasToolCallId: !!m.tool_call_id,
          })),
          temperature: requestOptions?.temperature,
          maxTokens: requestOptions?.max_tokens,
          hasTools: !!requestOptions?.tools,
          toolCount: requestOptions?.tools?.length || 0,
          toolChoice: requestOptions?.tool_choice,
          responseFormat: requestOptions?.response_format,
          topP: requestOptions?.top_p,
          frequencyPenalty: requestOptions?.frequency_penalty,
          presencePenalty: requestOptions?.presence_penalty,
          stop: requestOptions?.stop,
          seed: requestOptions?.seed,
        },
        // Log the raw error response if available
        errorResponse: error.response?.data,
      });

      // Provide user-friendly error messages with context
      let errorMessage = '';
      let includeDetails = false;
      
      if (error.status === 401) {
        errorMessage = 'Invalid OpenAI API key. Please check your credentials.';
      } else if (error.status === 429) {
        errorMessage = 'OpenAI rate limit exceeded. Please try again later.';
      } else if (error.status === 500 || error.status === 503) {
        errorMessage = 'OpenAI service error. Please try again later.';
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        errorMessage = 'Cannot connect to OpenAI API. Please check your internet connection.';
      } else if (error.status === 400) {
        // For 400 errors, include more context to help debugging
        errorMessage = `OpenAI API error: ${error.message}`;
        includeDetails = true;
      } else {
        errorMessage = `OpenAI error: ${error.message}`;
      }
      
      // For certain errors, append request details to help with debugging
      if (includeDetails && requestOptions) {
        const details = [
          `Model: ${requestOptions.model}`,
          `Messages: ${requestOptions.messages?.length || 0}`,
          `Tools: ${requestOptions.tools?.length || 0}`,
        ];
        
        // Add info about the last few messages
        if (requestOptions.messages && requestOptions.messages.length > 0) {
          const lastMessages = requestOptions.messages.slice(-3).map((m, i) => {
            const parts = [`${m.role}`];
            if (m.tool_calls) parts.push(`(${m.tool_calls.length} tool_calls)`);
            if (m.tool_call_id) parts.push(`(tool response)`);
            return parts.join(' ');
          });
          details.push(`Last messages: ${lastMessages.join(' → ')}`);
        }
        
        errorMessage += ` | ${details.join(', ')}`;
      }
      
      throw new Error(errorMessage);
    }
  },

  /**
   * Check if this model supports tool/function calling
   * Implements ModelNodeInterface.supportsTools()
   */
  supportsTools() {
    return true; // All modern OpenAI models support function calling
  },

  /**
   * Check if this model supports vision/image inputs
   * Implements ModelNodeInterface.supportsVision()
   */
  supportsVision() {
    const model = this.getNodeParameter('model');
    return model && (model.includes('gpt-4o') || model.includes('gpt-4-turbo'));
  },

  /**
   * Check if this model supports streaming responses
   * Implements ModelNodeInterface.supportsStreaming()
   */
  supportsStreaming() {
    return true; // All OpenAI models support streaming
  },

  /**
   * Get information about this model
   * Implements ModelNodeInterface.getModelInfo()
   */
  getModelInfo() {
    const model = this.getNodeParameter('model');
    return {
      provider: 'openai',
      model: model || 'gpt-4o-mini',
      version: '2024-11',
    };
  },

  /**
   * Execute method (required for node interface)
   * Service nodes don't execute directly - they're called by the AI Agent
   */
  execute: async function (inputData) {
    throw new Error(
      'OpenAI Model is a service node and should not be executed directly. ' +
        'Connect it to an AI Agent node instead.'
    );
  },
};

module.exports = OpenAIModelNode;

/**
 * AI Agent Node
 * 
 * The orchestrator node that manages the agent execution loop.
 * Coordinates between Model, Memory, and Tool nodes to create intelligent agents.
 * 
 * Features:
 * - Agent loop execution (reason → act → observe)
 * - Model, Memory, and Tool node discovery
 * - Tool execution routing
 * - Conversation memory management
 * - Max iterations enforcement
 * - Multiple output formats (text, json, structured, full)
 * - Structured JSON output with schema validation
 * - Comprehensive error handling
 * - Execution metadata tracking
 * 
 * Architecture:
 * - Main input: Receives trigger data or user messages
 * - Model connection: Required - provides AI reasoning
 * - Memory connection: Optional - manages conversation history
 * - Tool connections: Optional - extends agent capabilities
 * - Main output: Returns agent response with optional metadata
 */

const {
  AgentStateManager,
  ToolCallTracker,
  AgentErrorHandler,
} = require('../utils/agentLoopUtilities');

const { z } = require('zod');

const AIAgentNode = {
  identifier: 'ai-agent',
  displayName: 'AI Agent',
  name: 'ai-agent',
  group: ['ai', 'agent'],
  version: 1,
  description: 'AI Agent orchestrator that coordinates model, memory, and tools',
  icon: 'lucide:bot',
  color: '#9B59B6',
  defaults: {
    name: 'AI Agent',
    systemPrompt: 'You are a helpful AI assistant.',
    userMessage: '',
    maxIterations: 10,
  },
  inputs: ['main', 'model', 'memory', 'tools'],
  outputs: ['main'],
  // Service inputs positioned at bottom (n8n style)
  inputsConfig: {
    main: { position: 'left' },
    model: { position: 'bottom', displayName: 'Model', required: true },
    memory: { position: 'bottom', displayName: 'Memory', required: false },
    tools: { position: 'bottom', displayName: 'Tools', required: false, multiple: true },
  },
  properties: [
    {
      displayName: 'System Prompt',
      name: 'systemPrompt',
      type: 'string',
      required: false,
      default: 'You are a helpful AI assistant.',
      description: 'Instructions that define the agent\'s behavior and personality',
      placeholder: 'You are a helpful assistant that...',
      typeOptions: {
        rows: 4,
      },
    },
    {
      displayName: 'User Message',
      name: 'userMessage',
      type: 'string',
      required: true,
      default: '',
      description: 'The message to send to the agent. Supports {{json.field}} expressions',
      placeholder: 'Enter your message or use {{json.field}}',
      typeOptions: {
        rows: 3,
      },
    },
    {
      displayName: 'Max Iterations',
      name: 'maxIterations',
      type: 'number',
      required: false,
      default: 10,
      description: 'Maximum number of agent loop iterations to prevent infinite loops',
      placeholder: '10',
      typeOptions: {
        minValue: 1,
        maxValue: 50,
      },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      description: 'Additional agent configuration options',
      options: [
        {
          name: 'toolChoice',
          displayName: 'Tool Choice',
          type: 'options',
          default: 'auto',
          description: 'Control when the agent can use tools',
          options: [
            {
              name: 'Auto (Model Decides)',
              value: 'auto',
              description: 'Let the model decide when to use tools',
            },
            {
              name: 'Required (Must Use Tool)',
              value: 'required',
              description: 'Force the model to use at least one tool',
            },
            {
              name: 'None (Disable Tools)',
              value: 'none',
              description: 'Disable tool usage completely',
            },
          ],
        },
        {
          name: 'outputFormat',
          displayName: 'Output Format',
          type: 'options',
          default: 'text',
          description: 'Format of the agent response',
          options: [
            {
              name: 'Text Only',
              value: 'text',
              description: 'Return only the response text',
            },
            {
              name: 'JSON',
              value: 'json',
              description: 'Return structured JSON response',
            },
            {
              name: 'Structured JSON (with Schema)',
              value: 'structured',
              description: 'Return JSON matching a defined schema',
            },
            {
              name: 'Full (with metadata)',
              value: 'full',
              description: 'Return response with execution metadata',
            },
          ],
        },
        {
          name: 'outputSchema',
          displayName: 'Output Schema',
          type: 'json',
          displayOptions: {
            show: {
              outputFormat: ['structured'],
            },
          },
          default: '{\n  "type": "object",\n  "properties": {\n    "answer": {\n      "type": "string",\n      "description": "The main answer"\n    }\n  },\n  "required": ["answer"]\n}',
          description: 'JSON Schema defining the expected output structure. The LLM will be forced to return data matching this schema.',
          placeholder: 'Enter JSON Schema...',
          typeOptions: {
            rows: 10,
          },
        },
        {
          name: 'schemaName',
          displayName: 'Schema Name',
          type: 'string',
          displayOptions: {
            show: {
              outputFormat: ['structured'],
            },
          },
          default: 'response',
          description: 'Name for the structured output schema (used by the LLM)',
          placeholder: 'response',
        },
        {
          name: 'schemaDescription',
          displayName: 'Schema Description',
          type: 'string',
          displayOptions: {
            show: {
              outputFormat: ['structured'],
            },
          },
          default: 'Structured response from the agent',
          description: 'Description of what the structured output represents',
          placeholder: 'Structured response from the agent',
          typeOptions: {
            rows: 2,
          },
        },
        {
          name: 'sessionId',
          displayName: 'Session ID',
          type: 'string',
          default: '',
          placeholder: '{{json.userId}}',
          description: 'Unique identifier for conversation context (supports expressions)',
        },
        {
          name: 'timeout',
          displayName: 'Timeout (ms)',
          type: 'number',
          default: 300000,
          description: 'Maximum execution time in milliseconds (5 minutes default)',
          placeholder: '300000',
          typeOptions: {
            minValue: 1000,
            maxValue: 600000,
          },
        },
      ],
    },
  ],

  /**
   * Emit a node event for real-time UI updates
   * @private
   * @param {string} eventType - Event type (node-started, node-completed, node-failed)
   * @param {Object} nodeConfig - Node configuration with _serviceNodeId
   * @param {Object} additionalData - Additional event data
   */
  _emitNodeEvent: function(eventType, nodeConfig, additionalData = {}) {
    if (!global.realtimeExecutionEngine || !nodeConfig._serviceNodeId) {
      return;
    }

    const eventData = {
      executionId: this._executionId,
      nodeId: nodeConfig._serviceNodeId,
      nodeName: additionalData.nodeName || nodeConfig.displayName || nodeConfig.type,
      identifier: nodeConfig.type,
      timestamp: new Date(),
      ...additionalData,
    };

    this.logger?.debug(`[AI Agent] Emitting ${eventType} event`, {
      nodeId: nodeConfig._serviceNodeId,
      eventType,
    });

    global.realtimeExecutionEngine.emit(eventType, eventData);
  },

  /**
   * Get credential ID from service node configuration
   * @private
   * @param {Object} serviceNodeConfig - Service node configuration
   * @param {string} credentialType - Type of credential to find
   * @returns {string|null} Credential ID or null
   */
  _getCredentialId: function(serviceNodeConfig, credentialType) {
    // Strategy 1: Direct type mapping in credentials object
    if (serviceNodeConfig.credentials?.[credentialType]) {
      return serviceNodeConfig.credentials[credentialType];
    }

    // Strategy 2: Find any credential ID in credentials object
    if (serviceNodeConfig.credentials) {
      for (const value of Object.values(serviceNodeConfig.credentials)) {
        if (typeof value === 'string' && value.startsWith('cred_')) {
          return value;
        }
      }
    }

    // Strategy 3: Find credential ID in parameters (fallback)
    if (serviceNodeConfig.parameters) {
      for (const value of Object.values(serviceNodeConfig.parameters)) {
        if (typeof value === 'string' && value.startsWith('cred_')) {
          return value;
        }
      }
    }

    return null;
  },

  /**
   * Filter messages for storage (remove tool-related messages)
   * @private
   * @param {Array} messages - Messages to filter
   * @returns {Array} Filtered messages
   */
  _filterMessagesForStorage: function(messages) {
    return messages.filter(msg => {
      // Remove tool response messages
      if (msg.role === 'tool') return false;
      // Remove assistant messages with tool_calls (incomplete without responses)
      if (msg.role === 'assistant' && msg.tool_calls?.length > 0) return false;
      return true;
    });
  },

  /**
   * Get connected node from input
   * @private
   * @param {string} inputName - Name of the input connection
   * @returns {Object|null} The connected node instance or null
   */
  _getConnectedNode: async function(inputName) {
    // Get the input data for this connection
    const inputData = await this.getInputData?.(inputName);
    
    if (!inputData || !inputData[inputName]) {
      this.logger?.debug('[AI Agent] No input data found', { inputName });
      return null;
    }

    // Service inputs contain an array of node references
    const serviceNodes = inputData[inputName];
    if (!Array.isArray(serviceNodes) || serviceNodes.length === 0) {
      this.logger?.debug('[AI Agent] Service nodes not found or empty', { inputName });
      return null;
    }

    // Get the first connected service node
    const serviceNodeRef = serviceNodes[0];
    
    this.logger?.debug('[AI Agent] Found service node', {
      inputName,
      nodeId: serviceNodeRef.nodeId,
      type: serviceNodeRef.type,
    });
    
    // Get the node definition from the node registry
    if (global.nodeService) {
      try {
        const nodeDefinition = await global.nodeService.getNodeDefinition(serviceNodeRef.type);
        
        // Service nodes are passed with their configuration in the inputData
        // The serviceNodeRef contains the node configuration
        const serviceNodeConfig = serviceNodeRef;
        
        // Create a bound instance with a custom context that includes:
        // 1. The service node's own parameters and credentials
        // 2. Access to helper methods from the current execution context
        const boundNode = Object.create(nodeDefinition);
        
        // Store service node ID, execution ID, and user ID for event emission and credential access
        boundNode._serviceNodeId = serviceNodeConfig.nodeId;
        boundNode._executionId = this._executionId;
        boundNode._userId = this.userId; // userId is exposed in the execution context
        
        // Copy helper methods and logger from current context
        boundNode.logger = this.logger;
        boundNode.helpers = this.helpers;
        boundNode.resolveValue = this.resolveValue;
        boundNode.resolvePath = this.resolvePath;
        boundNode.extractJsonData = this.extractJsonData;
        
        // Create a getNodeParameter function that reads from the service node's parameters
        boundNode.getNodeParameter = (paramName) => {
          return serviceNodeConfig.parameters?.[paramName];
        };
        
        // Create a getCredentials function that reads from the service node's credentials
        boundNode.getCredentials = async (credentialType) => {
          this.logger?.debug('[AI Agent] Service node requesting credentials', {
            credentialType,
            serviceNodeId: serviceNodeConfig.nodeId,
          });
          
          // Handle legacy array format
          let credentialId;
          if (Array.isArray(serviceNodeConfig.credentials)) {
            credentialId = serviceNodeConfig.credentials[0];
          } else {
            credentialId = this._getCredentialId(serviceNodeConfig, credentialType);
          }
          
          if (!credentialId) {
            throw new Error(`No credential of type '${credentialType}' available`);
          }
          
          this.logger?.debug('[AI Agent] Found credential ID', {
            credentialType,
            credentialId,
          });
          
          // Use the global credential service to fetch the actual credential data
          if (!global.credentialService) {
            this.logger?.error('[AI Agent] global.credentialService not available');
            throw new Error('Credential service not available');
          }
          
          try {
            const userId = this._userId || this.userId || 'unknown';
            const credentialData = await global.credentialService.getCredentialForExecution(
              credentialId,
              userId
            );
            
            this.logger?.debug('[AI Agent] Successfully fetched credential', {
              credentialType,
              hasData: !!credentialData,
            });
            
            return credentialData;
          } catch (error) {
            this.logger?.error('[AI Agent] Failed to fetch credential', {
              credentialType,
              error: error.message,
            });
            throw new Error(`Failed to fetch credential: ${error.message}`);
          }
        };
        
        return boundNode;
      } catch (error) {
        this.logger?.error('[AI Agent] Failed to get node definition', {
          identifier: serviceNodeRef.type,
          error: error.message,
        });
        return null;
      }
    }
    
    this.logger?.error('[AI Agent] global.nodeService not available');
    return null;
  },

  /**
   * Discover connected Model node (required)
   * @private
   * @returns {Object} The connected Model node instance
   */
  _discoverModelNode: async function() {
    // Get the Model node from the 'model' input connection
    const modelNode = await this._getConnectedNode('model');

    if (!modelNode) {
      throw new Error('AI Agent requires a connected Model node. Please connect a Model node to the "model" input.');
    }

    // Validate it's a Model node by checking if it has the required methods
    // Model nodes must implement the ModelNodeInterface (chat, supportsTools, etc.)
    if (!modelNode.chat || typeof modelNode.chat !== 'function') {
      throw new Error(`Invalid Model node: ${modelNode.type} does not implement the required 'chat' method`);
    }

    return modelNode;
  },

  /**
   * Discover connected Memory node (optional)
   * @private
   * @returns {Object|null} The connected Memory node instance or null
   */
  _discoverMemoryNode: async function() {
    // Get the Memory node from the 'memory' input connection
    const memoryNode = await this._getConnectedNode('memory');

    if (!memoryNode) {
      this.logger?.info('[AI Agent] No Memory node connected - agent will not persist conversation history');
      return null;
    }

    // Validate it's a Memory node by checking if it has the required methods
    // Memory nodes must implement the MemoryNodeInterface (getMessages, addMessage, clear)
    if (!memoryNode.getMessages || typeof memoryNode.getMessages !== 'function') {
      this.logger?.warn('[AI Agent] Invalid Memory node - missing required methods', {
        type: memoryNode.type,
      });
      return null;
    }

    return memoryNode;
  },

  /**
   * Discover connected Tool nodes (optional, multiple)
   * @private
   * @returns {Array} Array of connected Tool node instances
   */
  _discoverToolNodes: async function() {
    const toolNodes = [];
    const connectedTools = await this._getConnectedNode('tools');
    
    if (connectedTools) {
      const toolsArray = Array.isArray(connectedTools) ? connectedTools : [connectedTools];
      
      for (const toolNode of toolsArray) {
        // Validate it's a Tool node by checking if it has the required methods
        if (toolNode && toolNode.getDefinition && typeof toolNode.getDefinition === 'function' &&
            toolNode.executeTool && typeof toolNode.executeTool === 'function') {
          toolNodes.push(toolNode);
        } else {
          this.logger?.warn('[AI Agent] Invalid Tool node - missing required methods', {
            type: toolNode?.type,
          });
        }
      }
    }

    if (toolNodes.length > 0) {
      this.logger?.info('[AI Agent] Discovered Tool nodes', {
        count: toolNodes.length,
        types: toolNodes.map(n => n.type),
      });
    }

    return toolNodes;
  },

  /**
   * Format the agent output based on the specified format
   * @private
   * @param {Object} result - Agent execution result
   * @param {string} format - Output format ('text', 'json', 'structured', 'full')
   * @returns {Object|string} Formatted output
   */
  _formatOutput: function(result, format) {
    switch (format) {
      case 'text':
        // Return only the response text
        return result.response;

      case 'json':
        // Return structured JSON response
        return {
          response: result.response,
          success: true,
        };

      case 'structured':
        // Return the structured data directly (already validated against schema)
        // The response should be a JSON object matching the schema
        return result.structuredData || result.response;

      case 'full':
        // Return response with full metadata
        return {
          response: result.response,
          success: true,
          metadata: {
            iterations: result.metadata.iterations,
            toolsUsed: result.metadata.toolsUsed,
            toolCalls: result.metadata.toolCalls.map(tc => ({
              toolName: tc.toolName,
              success: tc.result?.success,
              duration: tc.duration,
            })),
            totalTokens: result.metadata.totalTokens,
            duration: result.metadata.duration,
            finishReason: result.metadata.finishReason,
            status: result.metadata.status,
          },
        };

      default:
        // Default to text format
        return result.response;
    }
  },

  /**
   * Convert JSON Schema to Zod schema
   * @private
   * @param {Object} schema - JSON Schema definition
   * @returns {Object} Zod schema
   */
  _jsonSchemaToZod: function(schema) {
    if (!schema.properties) {
      return z.object({});
    }

    const zodShape = {};
    
    for (const [key, prop] of Object.entries(schema.properties)) {
      let zodType;
      
      switch (prop.type) {
        case 'string':
          zodType = z.string();
          break;
        case 'number':
          zodType = z.number();
          break;
        case 'boolean':
          zodType = z.boolean();
          break;
        case 'array':
          zodType = z.array(z.any());
          break;
        case 'object':
          zodType = z.object({}).passthrough();
          break;
        default:
          zodType = z.any();
      }
      
      // Make optional if not in required array
      if (!schema.required || !schema.required.includes(key)) {
        zodType = zodType.optional();
      }
      
      zodShape[key] = zodType;
    }
    
    return z.object(zodShape);
  },

  /**
   * Validate tool arguments against JSON Schema
   * @private
   * @param {Object} args - Tool arguments to validate
   * @param {Object} schema - JSON Schema definition
   * @returns {Object} Validation result
   */
  _validateToolArguments: function(args, schema) {
    try {
      const zodSchema = this._jsonSchemaToZod(schema);
      zodSchema.parse(args);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => {
          const field = err.path.join('.') || 'root';
          return `${field}: ${err.message}`;
        }).join(', ');

        return {
          valid: false,
          error: `Validation failed: ${errors}`,
        };
      }

      // Fallback to basic validation if Zod conversion fails
      this.logger?.warn('[AI Agent] Zod validation failed, using basic validation', {
        error: error.message,
      });

      // Basic validation - check required fields
      if (schema.required && Array.isArray(schema.required)) {
        for (const requiredField of schema.required) {
          if (!(requiredField in args)) {
            return {
              valid: false,
              error: `Missing required parameter: ${requiredField}`,
            };
          }
        }
      }

      return { valid: true };
    }
  },

  /**
   * Execute a tool call
   * @private
   * @param {Object} toolCall - Tool call from model
   * @param {Array} toolNodes - Available tool nodes
   * @param {Object} stateManager - Agent state manager
   * @returns {Promise<Object>} Tool result
   */
  _executeToolCall: async function(toolCall, toolNodes, stateManager) {
    // Find matching Tool node by name
    const toolNode = toolNodes.find(node => {
      const definition = node.getDefinition();
      return definition.name === toolCall.name;
    });

    if (!toolNode) {
      return {
        success: false,
        error: `Tool '${toolCall.name}' not found. Available tools: ${toolNodes.map(n => n.getDefinition().name).join(', ')}`,
      };
    }

    // Get tool definition for validation
    const toolDefinition = toolNode.getDefinition();

    // Validate tool arguments against JSON Schema
    const validation = this._validateToolArguments(
      toolCall.arguments,
      toolDefinition.parameters
    );

    if (!validation.valid) {
      return {
        success: false,
        error: `Tool argument validation failed: ${validation.error}`,
      };
    }

    // Record tool usage
    stateManager.recordToolUsage(toolCall.name);

    // Emit node-started event when tool is actually executed
    this._emitNodeEvent('node-started', toolNode, {
      nodeName: toolDefinition.name,
    });

    // Execute the tool
    try {
      const result = await toolNode.executeTool(toolCall.arguments);
      
      // Emit node-completed event after successful execution
      this._emitNodeEvent('node-completed', toolNode, {
        nodeName: toolDefinition.name,
      });
      
      return result;
    } catch (error) {
      // Emit node-failed event when tool execution fails
      this._emitNodeEvent('node-failed', toolNode, {
        nodeName: toolDefinition.name,
        error: { message: error.message },
      });
      
      return {
        success: false,
        error: `Tool execution error: ${error.message}`,
      };
    }
  },

  /**
   * Call model with retry logic
   * @private
   * @param {Object} modelNode - Model node instance
   * @param {Object} stateManager - Agent state manager
   * @param {Array} tools - Available tools
   * @param {string} toolChoice - Tool choice setting
   * @param {Object} outputSchema - Output schema for structured responses
   * @param {string} schemaName - Schema name
   * @param {string} schemaDescription - Schema description
   * @returns {Promise<Object>} Model response
   */
  _callModelWithRetry: async function(
    modelNode,
    stateManager,
    tools,
    toolChoice,
    outputSchema,
    schemaName,
    schemaDescription
  ) {
    const maxRetries = 2;
    let retryCount = 0;

    this._emitNodeEvent('node-started', modelNode, { nodeName: 'Model' });

    while (retryCount <= maxRetries) {
      try {
        const messages = stateManager.getMessages();
        const shouldUseTools = tools.length > 0 && toolChoice !== 'none';

        // Prepare chat options
        const chatOptions = {
          tools: shouldUseTools ? tools : [],
          toolChoice: shouldUseTools ? toolChoice : undefined,
        };

        // Add structured output schema if provided
        if (outputSchema) {
          chatOptions.responseFormat = {
            type: 'json_schema',
            json_schema: {
              name: schemaName || 'response',
              description: schemaDescription || 'Structured response from the agent',
              schema: outputSchema,
              strict: true,
            },
          };
        }

        this.logger?.debug('[AI Agent] Calling model', {
          messageCount: messages.length,
          toolCount: tools.length,
          toolChoice,
        });

        const modelResponse = await modelNode.chat(
          messages,
          chatOptions.tools,
          chatOptions.toolChoice,
          chatOptions.responseFormat
        );

        this._emitNodeEvent('node-completed', modelNode, { nodeName: 'Model' });

        return modelResponse;
      } catch (error) {
        const errorInfo = AgentErrorHandler.handleModelError(error);

        // Check if error is recoverable and we have retries left
        if (AgentErrorHandler.isRecoverable(errorInfo) && retryCount < maxRetries) {
          retryCount++;
          const delay = AgentErrorHandler.getRetryDelay(errorInfo, retryCount);

          this.logger?.warn('[AI Agent] Model call failed, retrying', {
            error: errorInfo.message,
            retryCount,
            delayMs: delay,
          });

          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Error is not recoverable or out of retries
        this._emitNodeEvent('node-failed', modelNode, {
          nodeName: 'Model',
          error: {
            message: errorInfo.message,
            type: errorInfo.type,
            recoverable: errorInfo.recoverable,
          },
        });

        this.logger?.error('[AI Agent] Model call failed', errorInfo);
        throw new Error(errorInfo.message);
      }
    }
  },

  /**
   * Execute the agent loop
   * @private
   * @param {Object} params - Agent loop parameters
   * @returns {Promise<Object>} Agent response with metadata
   */
  _executeAgentLoop: async function({
    modelNode,
    memoryNode,
    toolNodes,
    systemPrompt,
    userMessage,
    maxIterations,
    toolChoice,
    sessionId,
    outputSchema,
    schemaName,
    schemaDescription,
  }) {
    // Initialize agent state
    const stateManager = new AgentStateManager(sessionId, maxIterations);
    const toolTracker = new ToolCallTracker();

    try {
      // Step 1: Load conversation history from Memory node if present
      if (memoryNode && sessionId) {
        try {
          this._emitNodeEvent('node-started', memoryNode, { nodeName: 'Memory' });
          
          const history = await memoryNode.getMessages(sessionId);
          
          this._emitNodeEvent('node-completed', memoryNode, { nodeName: 'Memory' });
          
          if (history && history.length > 0) {
            const filteredHistory = this._filterMessagesForStorage(history);
            
            if (filteredHistory.length !== history.length) {
              this.logger?.debug('[AI Agent] Filtered tool messages from history', {
                originalCount: history.length,
                filteredCount: filteredHistory.length,
              });
            }
            
            stateManager.setMessages(filteredHistory);
            this.logger?.info('[AI Agent] Loaded conversation history', {
              messageCount: filteredHistory.length,
              sessionId,
            });
          }
        } catch (error) {
          this._emitNodeEvent('node-failed', memoryNode, {
            nodeName: 'Memory',
            error: { message: error.message },
          });
          
          const errorInfo = AgentErrorHandler.handleMemoryError(error);
          this.logger?.warn('[AI Agent] Memory load failed', errorInfo);
        }
      }

      // Step 2: Add system prompt if first message
      const messages = stateManager.getMessages();
      if (messages.length === 0 && systemPrompt) {
        stateManager.addMessage({
          role: 'system',
          content: systemPrompt,
          timestamp: Date.now(),
        });
      }

      // Step 3: Add user message
      stateManager.addMessage({
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
      });

      this.logger?.info('[AI Agent] Starting agent loop', {
        maxIterations,
        toolChoice,
        toolCount: toolNodes.length,
      });

      // Step 4: Main agent loop
      while (!stateManager.hasReachedMaxIterations()) {
        const iteration = stateManager.incrementIteration();
        
        // Get available tools - only if toolChoice is not 'none'
        const tools = toolChoice === 'none' ? [] : toolNodes.map(toolNode => toolNode.getDefinition());

        // Call model with retry logic
        let modelResponse;
        try {
          modelResponse = await this._callModelWithRetry(
            modelNode,
            stateManager,
            tools,
            toolChoice,
            outputSchema,
            schemaName,
            schemaDescription
          );
        } catch (error) {
          throw error; // Re-throw to be handled by outer try-catch
        }

        // Log model response
        this.logger?.debug('[AI Agent] Model response received', {
          hasContent: !!modelResponse.content,
          hasToolCalls: !!(modelResponse.toolCalls && modelResponse.toolCalls.length > 0),
          toolCallCount: modelResponse.toolCalls?.length || 0,
        });
        
        // Add assistant message to history
        // If there are tool calls, we need to include them in the message for OpenAI format
        if (modelResponse.toolCalls && modelResponse.toolCalls.length > 0) {
          stateManager.addMessage({
            role: 'assistant',
            content: modelResponse.content || null,
            tool_calls: modelResponse.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
            timestamp: Date.now(),
          });
        } else if (modelResponse.content) {
          stateManager.addMessage({
            role: 'assistant',
            content: modelResponse.content,
            timestamp: Date.now(),
          });
        }

        // Check if model wants to use tools
        if (modelResponse.toolCalls && modelResponse.toolCalls.length > 0) {
          this.logger?.info('[AI Agent] Executing tool calls', {
            toolCallCount: modelResponse.toolCalls.length,
            tools: modelResponse.toolCalls.map(tc => tc.name),
          });

          // Execute each tool call
          for (const toolCall of modelResponse.toolCalls) {
            // Ensure tool call has an ID
            const toolCallId = toolCall.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            toolCall.id = toolCallId;
            
            const trackingId = toolTracker.startTracking(toolCall.name, toolCall.arguments);
            
            try {
              // Execute tool and capture result
              const toolResult = await this._executeToolCall(
                toolCall,
                toolNodes,
                stateManager
              );

              // Complete tracking
              toolTracker.completeTracking(trackingId, toolResult);

              // Add tool result to message history
              stateManager.addMessage({
                role: 'tool',
                content: JSON.stringify(toolResult),
                timestamp: Date.now(),
                toolCallId: toolCall.id,
              });

              this.logger?.debug('[AI Agent] Tool execution completed', {
                toolName: toolCall.name,
                success: toolResult.success,
              });
            } catch (error) {
              // Handle tool execution error
              const toolResult = AgentErrorHandler.handleToolError(toolCall.name, error);
              toolTracker.completeTracking(trackingId, toolResult);

              // Add error result to message history so model can handle it
              stateManager.addMessage({
                role: 'tool',
                content: JSON.stringify(toolResult),
                timestamp: Date.now(),
                toolCallId: toolCall.id,
              });

              this.logger?.warn('[AI Agent] Tool execution failed', {
                toolName: toolCall.name,
                error: error.message,
              });
            }
          }

          // Continue loop to send tool results back to model
          continue;
        }

        // No tool calls - we have final answer
        this.logger?.info('[AI Agent] Agent loop completed', {
          iterations: iteration,
          finishReason: modelResponse.finishReason,
        });

        stateManager.markCompleted();

        // Step 5: Save conversation to Memory node if present
        if (memoryNode && sessionId) {
          try {
            this._emitNodeEvent('node-started', memoryNode, { nodeName: 'Memory' });
            
            const messages = stateManager.getMessages();
            const messagesToSave = this._filterMessagesForStorage(messages);
            
            for (const message of messagesToSave) {
              await memoryNode.addMessage(sessionId, message);
            }
            
            this.logger?.info('[AI Agent] Saved conversation to memory', {
              totalMessages: messages.length,
              savedMessages: messagesToSave.length,
              sessionId,
            });
            
            this._emitNodeEvent('node-completed', memoryNode, { nodeName: 'Memory' });
          } catch (error) {
            this._emitNodeEvent('node-failed', memoryNode, {
              nodeName: 'Memory',
              error: { message: error.message },
            });
            
            const errorInfo = AgentErrorHandler.handleMemoryError(error);
            this.logger?.warn('[AI Agent] Memory save failed', errorInfo);
          }
        }

        // Parse structured data if schema was provided
        let structuredData = null;
        if (outputSchema && modelResponse.content) {
          try {
            structuredData = JSON.parse(modelResponse.content);
            this.logger?.debug('[AI Agent] Parsed structured output', {
              hasStructuredData: !!structuredData,
            });
          } catch (error) {
            this.logger?.warn('[AI Agent] Failed to parse structured output', {
              error: error.message,
            });
          }
        }
        
        // Return final response
        return {
          response: modelResponse.content,
          structuredData,
          metadata: {
            ...stateManager.getMetadata(),
            toolCalls: toolTracker.getRecords(),
            totalTokens: modelResponse.usage?.totalTokens || 0,
            finishReason: modelResponse.finishReason,
          },
        };
      }

      // Max iterations reached
      stateManager.markMaxIterations();
      const errorInfo = AgentErrorHandler.handleMaxIterations(maxIterations);
      
      this.logger?.warn('[AI Agent] Max iterations reached', {
        maxIterations,
        toolsUsed: stateManager.getToolsUsed(),
      });

      throw new Error(errorInfo.message);
    } catch (error) {
      stateManager.markFailed();
      throw error;
    }
  },

  /**
   * Execute the AI Agent
   * Main entry point for agent execution
   */
  execute: async function (inputData) {
    const startTime = Date.now();
    
    // Store execution ID for service node event emission
    // The execution ID is available in the logger context
    this._executionId = this.logger?.executionId || 'unknown';
    
    // userId is available in the execution context (added by SecureExecutionService)
    // No need to set it here, just use this.userId when needed
    
    this.logger?.debug('[AI Agent] Execute called', {
      hasModel: !!inputData.model,
      hasMemory: !!inputData.memory,
      hasTools: !!inputData.tools,
    });
    
    try {
      // Get parameters - getNodeParameter automatically resolves expressions like {{json.field}}
      const systemPrompt = await this.getNodeParameter('systemPrompt');
      const userMessage = await this.getNodeParameter('userMessage');
      const maxIterations = await this.getNodeParameter('maxIterations');
      const options = (await this.getNodeParameter('options')) || {};

      // Validate required parameters
      if (!userMessage) {
        throw new Error('User message is required');
      }

      // Validate maxIterations
      if (maxIterations < 1 || maxIterations > 50) {
        throw new Error('Max iterations must be between 1 and 50');
      }

      // Get options
      const toolChoice = options.toolChoice || 'auto';
      const outputFormat = options.outputFormat || 'text';
      const sessionId = options.sessionId || 'default';
      const timeout = options.timeout || 300000;

      // Validate timeout
      if (timeout < 1000 || timeout > 600000) {
        throw new Error('Timeout must be between 1000ms (1s) and 600000ms (10min)');
      }
      
      // Get structured output options if format is 'structured'
      let outputSchema = null;
      let schemaName = null;
      let schemaDescription = null;
      
      if (outputFormat === 'structured') {
        const rawSchema = options.outputSchema;
        schemaName = options.schemaName || 'response';
        schemaDescription = options.schemaDescription || 'Structured response from the agent';
        
        // Parse and validate the schema
        if (rawSchema) {
          try {
            outputSchema = typeof rawSchema === 'string' ? JSON.parse(rawSchema) : rawSchema;
            
            // Basic schema validation
            if (!outputSchema.type || outputSchema.type !== 'object') {
              throw new Error('Schema must be an object type');
            }
            
            this.logger?.info('[AI Agent] Parsed output schema', {
              schemaName,
              hasProperties: !!outputSchema.properties,
              propertyCount: outputSchema.properties ? Object.keys(outputSchema.properties).length : 0,
            });
          } catch (error) {
            throw new Error(`Invalid output schema: ${error.message}. Please provide a valid JSON Schema.`);
          }
        } else {
          throw new Error('Output schema is required when using "Structured JSON" output format');
        }
      }

      this.logger?.info('[AI Agent] Starting execution', {
        userMessage: userMessage.substring(0, 100),
        maxIterations,
        toolChoice,
        outputFormat,
        sessionId,
      });

      // Discover connected nodes with error handling
      let modelNode, memoryNode, toolNodes;
      
      try {
        modelNode = await this._discoverModelNode();
      } catch (error) {
        throw new Error(`Node discovery failed: ${error.message}`);
      }

      try {
        memoryNode = await this._discoverMemoryNode();
      } catch (error) {
        // Memory is optional - log warning but continue
        this.logger?.warn('[AI Agent] Memory node discovery failed', {
          error: error.message,
        });
        memoryNode = null;
      }

      try {
        toolNodes = await this._discoverToolNodes();
      } catch (error) {
        // Tools are optional - log warning but continue
        this.logger?.warn('[AI Agent] Tool node discovery failed', {
          error: error.message,
        });
        toolNodes = [];
      }

      // Execute agent loop with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          const errorInfo = AgentErrorHandler.handleTimeout(timeout);
          reject(new Error(errorInfo.message));
        }, timeout);
      });

      const agentPromise = this._executeAgentLoop({
        modelNode,
        memoryNode,
        toolNodes,
        systemPrompt,
        userMessage,
        maxIterations,
        toolChoice,
        sessionId,
        outputSchema,
        schemaName,
        schemaDescription,
      });

      const result = await Promise.race([agentPromise, timeoutPromise]);

      // Format output based on outputFormat option
      const formattedOutput = this._formatOutput(result, outputFormat);

      const duration = Date.now() - startTime;
      this.logger?.info('[AI Agent] Execution completed successfully', {
        iterations: result.metadata.iterations,
        toolsUsed: result.metadata.toolsUsed,
        duration,
      });

      return [{ main: [{ json: formattedOutput }] }];
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger?.error('[AI Agent] Execution failed', {
        error: error.message,
        duration,
      });

      // Return user-friendly error message
      const errorMessage = error.message || 'Unknown error occurred';
      
      // Check if this is a known error type
      if (errorMessage.includes('Max iterations')) {
        throw new Error(`Agent execution failed: ${errorMessage}. Try increasing the max iterations or simplifying the task.`);
      } else if (errorMessage.includes('timeout')) {
        throw new Error(`Agent execution failed: ${errorMessage}. Try increasing the timeout or simplifying the task.`);
      } else if (errorMessage.includes('authentication') || errorMessage.includes('credentials')) {
        throw new Error(`Agent execution failed: ${errorMessage}. Please check your API credentials.`);
      } else if (errorMessage.includes('rate limit')) {
        throw new Error(`Agent execution failed: ${errorMessage}. Please wait and try again.`);
      } else if (errorMessage.includes('Model node')) {
        throw new Error(`Agent execution failed: ${errorMessage}. Please connect a Model node (OpenAI or Anthropic) to the AI Agent.`);
      } else {
        throw new Error(`Agent execution failed: ${errorMessage}`);
      }
    }
  },
};

module.exports = AIAgentNode;

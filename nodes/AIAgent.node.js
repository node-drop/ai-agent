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
 */

const { executeStandalone } = require('./modes/standalone');
const { z } = require('zod');

const AIAgentNode = {
  identifier: 'ai-agent',
  displayName: 'AI Agent',
  name: 'ai-agent',
  group: ['ai', 'agent'],
  version: 2,
  description: 'AI Agent orchestrator that coordinates model, memory, and tools',
  ai: {
    description: "An autonomous agent that can reason, plan, and execute tasks using connected tools. Connect a Model (required) and Tools (optional). Best for complex tasks requiring multi-step reasoning.",
    useCases: [
      "Complex workflow automation requiring decision making",
      "Research assistance with web browsing capabilities",
      "Data analysis with dynamic query generation",
      "Customer support with access to knowledge bases"
    ],
    tags: ["agent", "autonomous", "reasoning", "tools", "planning"],
    complexityScore: 8,
    recommendations: {
      inputs: {
        modelService: ["openai", "anthropic"],
        memoryService: ["redis-memory", "postgres-memory"],
        toolService: ["google-search", "calculator", "http-request"]
      }
    }
  },
  icon: 'lucide:bot',
  color: '#9B59B6',
  defaults: {
    name: 'AI Agent',
    systemPrompt: 'You are a helpful AI assistant.',
    userMessage: '',
    maxIterations: 10,
  },
  inputs: ['main', 'modelService', 'memoryService', 'toolService'],
  outputs: ['main'],
  inputsConfig: {
    main: { position: 'left' },
    modelService: { position: 'bottom', displayName: 'Model', required: true },
    memoryService: { position: 'bottom', displayName: 'Memory', required: false },
    toolService: { position: 'bottom', displayName: 'Tools', required: false, multiple: true },
  },
  properties: [
    {
      displayName: 'System Prompt',
      name: 'systemPrompt',
      type: 'expression',
      required: false,
      default: 'You are a helpful AI assistant.',
      description: 'Instructions that define the agent\'s behavior and personality',
      placeholder: 'You are a helpful assistant that...',
      typeOptions: { rows: 4 },
    },
    {
      displayName: 'User Message',
      name: 'userMessage',
      type: 'expression',
      required: true,
      default: '',
      description: 'The message to send to the agent. Supports {{json.field}} expressions',
      placeholder: 'Enter your message or use {{json.field}}',
      typeOptions: { rows: 3 },
    },
    {
      displayName: 'Max Iterations',
      name: 'maxIterations',
      type: 'number',
      required: false,
      default: 10,
      description: 'Maximum number of agent loop iterations to prevent infinite loops',
      placeholder: '10',
      typeOptions: { minValue: 1, maxValue: 50 },
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
            { name: 'Auto (Model Decides)', value: 'auto' },
            { name: 'Required (Must Use Tool)', value: 'required' },
            { name: 'None (Disable Tools)', value: 'none' },
          ],
        },
        {
          name: 'outputFormat',
          displayName: 'Output Format',
          type: 'options',
          default: 'json',
          description: 'Format of the agent response',
          options: [
            { name: 'Text Only', value: 'text' },
            { name: 'JSON', value: 'json' },
            { name: 'Structured JSON (with Schema)', value: 'structured' },
            { name: 'Full (with metadata)', value: 'full' },
          ],
        },
        {
          name: 'outputSchema',
          displayName: 'Output Schema',
          type: 'json',
          displayOptions: { show: { outputFormat: ['structured'] } },
          default: '{\n  "type": "object",\n  "properties": {\n    "answer": { "type": "string" }\n  },\n  "required": ["answer"]\n}',
          description: 'JSON Schema for structured output',
          typeOptions: { rows: 10 },
        },
        {
          name: 'sessionId',
          displayName: 'Session ID',
          type: 'string',
          default: '',
          placeholder: '{{json.userId}}',
          description: 'Unique identifier for conversation context',
        },
        {
          name: 'timeout',
          displayName: 'Timeout (ms)',
          type: 'number',
          default: 300000,
          description: 'Maximum execution time in milliseconds',
          typeOptions: { minValue: 1000, maxValue: 600000 },
        },
      ],
    },
  ],

  // Helper methods
  _emitNodeEvent: function(eventType, nodeConfig, additionalData = {}) {
    if (!global.realtimeExecutionEngine || !nodeConfig?._serviceNodeId) return;
    global.realtimeExecutionEngine.emit(eventType, {
      executionId: this._executionId,
      nodeId: nodeConfig._serviceNodeId,
      nodeName: additionalData.nodeName || nodeConfig.displayName || nodeConfig.type,
      identifier: nodeConfig.type,
      timestamp: new Date(),
      ...additionalData,
    });
  },

  _getCredentialId: function(serviceNodeConfig, credentialType) {
    if (serviceNodeConfig.credentials?.[credentialType]) return serviceNodeConfig.credentials[credentialType];
    if (serviceNodeConfig.credentials) {
      for (const value of Object.values(serviceNodeConfig.credentials)) {
        if (typeof value === 'string' && value.startsWith('cred_')) return value;
      }
    }
    return null;
  },

  _filterMessagesForStorage: function(messages) {
    return messages.filter(msg => {
      if (msg.role === 'tool') return false;
      if (msg.role === 'assistant' && msg.tool_calls?.length > 0) return false;
      return true;
    });
  },

  _validateToolArguments: function(args, schema) {
    try {
      const zodSchema = this._jsonSchemaToZod(schema);
      zodSchema.parse(args);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => `${err.path.join('.') || 'root'}: ${err.message}`).join(', ');
        return { valid: false, error: `Validation failed: ${errors}` };
      }
      if (schema.required && Array.isArray(schema.required)) {
        for (const requiredField of schema.required) {
          if (!(requiredField in args)) return { valid: false, error: `Missing required parameter: ${requiredField}` };
        }
      }
      return { valid: true };
    }
  },

  _jsonSchemaToZod: function(schema) {
    if (!schema.properties) return z.object({});
    const zodShape = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      let zodType;
      switch (prop.type) {
        case 'string': zodType = z.string(); break;
        case 'number': zodType = z.number(); break;
        case 'boolean': zodType = z.boolean(); break;
        case 'array': zodType = z.array(z.any()); break;
        case 'object': zodType = z.object({}).passthrough(); break;
        default: zodType = z.any();
      }
      if (!schema.required || !schema.required.includes(key)) zodType = zodType.optional();
      zodShape[key] = zodType;
    }
    return z.object(zodShape);
  },

  _formatOutput: function(result, format) {
    switch (format) {
      case 'text': return result.response;
      case 'json': return { response: result.response, success: true };
      case 'structured': return result.structuredData || result.response;
      case 'full': return {
        response: result.response,
        success: true,
        metadata: {
          iterations: result.metadata?.iterations,
          toolsUsed: result.metadata?.toolsUsed,
          duration: result.metadata?.duration,
          finishReason: result.metadata?.finishReason,
        },
      };
      default: return result.response;
    }
  },

  // Service node discovery
  _bindServiceNode: async function(serviceNodeRef, nodeType) {
    if (!global.nodeService) throw new Error('Node service not available');
    const nodeDefinition = await global.nodeService.getNodeDefinition(serviceNodeRef.type);
    const boundNode = Object.create(nodeDefinition);
    boundNode._serviceNodeId = serviceNodeRef.nodeId;
    boundNode._executionId = this._executionId;
    boundNode._userId = this.userId;
    boundNode.logger = this.logger;
    boundNode.helpers = this.helpers;
    boundNode.resolveValue = this.resolveValue;
    boundNode.getNodeParameter = (paramName) => serviceNodeRef.parameters?.[paramName];
    boundNode.getCredentials = async (credentialType) => {
      let credentialId = Array.isArray(serviceNodeRef.credentials) 
        ? serviceNodeRef.credentials[0] 
        : this._getCredentialId(serviceNodeRef, credentialType);
      if (!credentialId) throw new Error(`No credential of type '${credentialType}' available`);
      if (!global.credentialService) throw new Error('Credential service not available');
      return await global.credentialService.getCredentialForExecution(credentialId, this.userId || 'unknown');
    };
    if (nodeType === 'model' && (!boundNode.chat || typeof boundNode.chat !== 'function')) {
      throw new Error('Invalid Model node: missing chat method');
    }
    if (nodeType === 'tool' && (!boundNode.getDefinition || !boundNode.executeTool)) {
      throw new Error('Invalid Tool node: missing required methods');
    }
    return boundNode;
  },

  _discoverModelNode: async function() {
    const inputData = await this.getInputData?.('modelService');
    if (!inputData?.modelService || !Array.isArray(inputData.modelService) || inputData.modelService.length === 0) {
      throw new Error('AI Agent requires a connected Model node');
    }
    return await this._bindServiceNode(inputData.modelService[0], 'model');
  },

  _discoverMemoryNode: async function() {
    const inputData = await this.getInputData?.('memoryService');
    if (!inputData?.memoryService || !Array.isArray(inputData.memoryService) || inputData.memoryService.length === 0) {
      return null;
    }
    try {
      const boundNode = await this._bindServiceNode(inputData.memoryService[0], 'memory');
      if (!boundNode.getMessages || typeof boundNode.getMessages !== 'function') return null;
      return boundNode;
    } catch (error) {
      this.logger?.warn('[AI Agent] Failed to discover memory node', { error: error.message });
      return null;
    }
  },

  _discoverToolNodes: async function() {
    const toolNodes = [];
    const inputData = await this.getInputData?.('toolService');
    if (!inputData?.toolService || !Array.isArray(inputData.toolService)) return toolNodes;
    for (const serviceNodeRef of inputData.toolService) {
      try {
        const boundNode = await this._bindServiceNode(serviceNodeRef, 'tool');
        if (boundNode.getDefinition && boundNode.executeTool) toolNodes.push(boundNode);
      } catch (error) {
        this.logger?.error('[AI Agent] Failed to bind tool node', { type: serviceNodeRef.type, error: error.message });
      }
    }
    return toolNodes;
  },

  // Main execute method
  execute: async function(_inputData) {
    const startTime = Date.now();
    this._executionId = this.logger?.executionId || 'unknown';

    try {
      const systemPrompt = await this.getNodeParameter('systemPrompt');
      const userMessage = await this.getNodeParameter('userMessage');
      const maxIterations = await this.getNodeParameter('maxIterations') || 10;
      const options = (await this.getNodeParameter('options')) || {};

      if (!userMessage) throw new Error('User message is required');

      const modelNode = await this._discoverModelNode();
      let memoryNode = null;
      try { memoryNode = await this._discoverMemoryNode(); } catch (e) { /* optional */ }
      let toolNodes = [];
      try { toolNodes = await this._discoverToolNodes(); } catch (e) { /* optional */ }

      const outputFormat = options.outputFormat || 'json';
      let outputSchema = null, schemaName = null, schemaDescription = null;
      if (outputFormat === 'structured' && options.outputSchema) {
        try {
          outputSchema = typeof options.outputSchema === 'string' ? JSON.parse(options.outputSchema) : options.outputSchema;
          schemaName = options.schemaName || 'response';
          schemaDescription = options.schemaDescription || 'Structured response';
        } catch (error) {
          throw new Error(`Invalid output schema: ${error.message}`);
        }
      }

      const context = {
        modelNode,
        memoryNode,
        toolNodes,
        systemPrompt,
        userMessage,
        maxIterations,
        toolChoice: options.toolChoice || 'auto',
        sessionId: (options.sessionId && options.sessionId.trim()) || 'default',
        outputSchema,
        schemaName,
        schemaDescription,
        outputFormat,
        timeout: options.timeout || 300000,
        logger: this.logger,
        logCall: this.logCall,
        emitNodeEvent: this._emitNodeEvent.bind(this),
        filterMessagesForStorage: this._filterMessagesForStorage,
        validateToolArguments: this._validateToolArguments.bind(this),
        getNodeParameter: this.getNodeParameter,
      };

      const result = await executeStandalone(context);
      const formattedOutput = this._formatOutput(result, outputFormat);

      return [{ main: [{ json: formattedOutput }] }];
    } catch (error) {
      this.logger?.error('[AI Agent] Execution failed', { error: error.message, duration: Date.now() - startTime });
      throw new Error(`AI Agent failed: ${error.message}`);
    }
  },
};

module.exports = AIAgentNode;

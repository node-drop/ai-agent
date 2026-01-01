/**
 * Worker Agent Node
 * 
 * A specialized agent designed to be called by a Supervisor Agent.
 * Unlike the regular AI Agent, this node doesn't have a main input -
 * it receives tasks programmatically from the Supervisor.
 * 
 * Features:
 * - Designed for multi-agent orchestration
 * - Receives tasks from Supervisor Agent
 * - Has its own Model, Memory, and Tool connections
 * - Supports context sharing between agents
 * - Returns structured results to Supervisor
 * 
 * Architecture:
 * - No main input (tasks come from Supervisor)
 * - Model connection: Required - provides AI reasoning
 * - Memory connection: Optional - manages conversation history
 * - Tool connections: Optional - extends agent capabilities
 */

const {
  AgentStateManager,
  ToolCallTracker,
  AgentErrorHandler,
} = require('../utils/agentLoopUtilities');

const WorkerAgentNode = {
  identifier: 'worker-agent',
  nodeCategory: 'service',  // Indicates this is a service node for Supervisor
  displayName: 'Worker Agent',
  name: 'worker-agent',
  group: ['ai', 'agent', 'orchestration'],
  version: 1,
  description: 'Specialized agent for multi-agent orchestration - receives tasks from Supervisor',
  ai: {
    description: "A worker agent designed to be orchestrated by a Supervisor Agent. Configure its specialty via system prompt and connect appropriate tools. Does NOT receive workflow input directly.",
    useCases: [
      "Research specialist in a multi-agent team",
      "Code writer in a development pipeline",
      "Data analyst in a processing workflow",
      "Content editor in a creation pipeline",
      "Customer support specialist for routing"
    ],
    tags: ["worker", "agent", "multi-agent", "specialist", "delegation"],
    rules: [
      "MUST be connected to a Supervisor Agent's agentService input",
      "MUST connect a model node (openai-model or anthropic-model) to modelService input",
      "Configure system prompt to define the agent's specialty",
      "Does NOT receive input from workflow flow - only from Supervisor"
    ],
    recommendations: {
      connectsTo: ["supervisor-agent"],
      inputs: {
        modelService: ["openai-model", "anthropic-model"],
        memoryService: ["buffer-memory", "window-memory"],
        toolService: ["http-request-tool", "calculator-tool", "knowledge-base-tool"]
      }
    },
    complexityScore: 6
  },
  icon: 'lucide:user-cog',
  color: '#3498DB',
  defaults: {
    name: 'Worker Agent',
    specialty: 'General Assistant',
    systemPrompt: 'You are a helpful AI assistant.',
    maxIterations: 10,
  },
  // No 'main' input - this node is called by Supervisor
  inputs: ['modelService', 'memoryService', 'toolService'],
  outputs: ['agentService'],  // Output to connect to Supervisor's agent input
  outputsConfig: {
    agentService: { position: 'top', displayName: 'To Supervisor' },
  },
  inputsConfig: {
    modelService: { position: 'bottom', displayName: 'Model', required: true },
    memoryService: { position: 'bottom', displayName: 'Memory', required: false },
    toolService: { position: 'bottom', displayName: 'Tools', required: false, multiple: true },
  },
  properties: [
    {
      displayName: 'Agent Name',
      name: 'name',
      type: 'string',
      required: true,
      default: 'Worker Agent',
      description: 'Name of this agent (shown in Supervisor logs)',
      placeholder: 'Research Agent',
    },
    {
      displayName: 'Specialty',
      name: 'specialty',
      type: 'string',
      required: true,
      default: 'General Assistant',
      description: 'Brief description of what this agent specializes in',
      placeholder: 'Research and data gathering',
    },
    {
      displayName: 'System Prompt',
      name: 'systemPrompt',
      type: 'expression',
      required: false,
      default: 'You are a helpful AI assistant.',
      description: 'Instructions that define the agent\'s behavior and expertise',
      placeholder: 'You are a research specialist who excels at...',
      typeOptions: {
        rows: 4,
      },
    },
    {
      displayName: 'Max Iterations',
      name: 'maxIterations',
      type: 'number',
      required: false,
      default: 10,
      description: 'Maximum number of agent loop iterations',
      placeholder: '10',
      typeOptions: {
        minValue: 1,
        maxValue: 30,
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
            { name: 'Auto (Model Decides)', value: 'auto' },
            { name: 'Required (Must Use Tool)', value: 'required' },
            { name: 'None (Disable Tools)', value: 'none' },
          ],
        },
        {
          name: 'includeSharedContext',
          displayName: 'Include Shared Context',
          type: 'boolean',
          default: true,
          description: 'Include context from other agents in the team',
        },
        {
          name: 'timeout',
          displayName: 'Timeout (ms)',
          type: 'number',
          default: 120000,
          description: 'Maximum execution time in milliseconds',
          placeholder: '120000',
          typeOptions: {
            minValue: 5000,
            maxValue: 300000,
          },
        },
      ],
    },
  ],

  /**
   * Emit a node event for real-time UI updates
   * 
   * IMPORTANT FOR DEEP NESTED NODES:
   * When building nodes that orchestrate other service nodes (like this Worker Agent),
   * you MUST emit node events for visual indicators to work in the UI:
   * 
   * 1. Every service node (Model, Tool, Memory, etc.) needs _serviceNodeId set when bound
   * 2. Before calling a service: emit 'node-started'
   * 3. After successful call: emit 'node-completed'  
   * 4. On error: emit 'node-failed' with error details
   * 
   * Without these events, nested service nodes will show no Running/Success/Failed states.
   * 
   * Also remember:
   * - Use this.logCall() for frontend Logs tab entries
   * - Ensure _executionId is passed through to nested nodes
   * - Service nodes must have _serviceNodeId from their original nodeId
   * 
   * @private
   * @param {string} eventType - Event type (node-started, node-completed, node-failed)
   * @param {Object} nodeConfig - Node configuration with _serviceNodeId
   * @param {Object} additionalData - Additional event data
   */
  _emitNodeEvent: function(eventType, nodeConfig, additionalData = {}) {
    if (!global.realtimeExecutionEngine || !nodeConfig?._serviceNodeId) {
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

    this.logger?.debug(`[Worker Agent] Emitting ${eventType} event`, {
      nodeId: nodeConfig._serviceNodeId,
      eventType,
    });

    global.realtimeExecutionEngine.emit(eventType, eventData);
  },

  /**
   * Get credential ID from service node configuration
   * @private
   */
  _getCredentialId: function(serviceNodeConfig, credentialType) {
    if (serviceNodeConfig.credentials?.[credentialType]) {
      return serviceNodeConfig.credentials[credentialType];
    }
    
    if (serviceNodeConfig.credentials) {
      for (const value of Object.values(serviceNodeConfig.credentials)) {
        if (typeof value === 'string' && value.startsWith('cred_')) {
          return value;
        }
      }
    }
    
    return null;
  },

  /**
   * Discover connected Model node
   * @private
   */
  _discoverModelNode: async function() {
    this.logger?.info('[Worker Agent] _discoverModelNode called', {
      hasGetInputData: typeof this.getInputData === 'function',
      has_inputData: !!this._inputData,
      _inputDataKeys: this._inputData ? Object.keys(this._inputData) : [],
    });
    
    // First try to get from injected getInputData (when called normally)
    const inputData = await this.getInputData?.('modelService');
    
    this.logger?.info('[Worker Agent] getInputData result for modelService', {
      hasInputData: !!inputData,
      inputDataKeys: inputData ? Object.keys(inputData) : [],
      modelServiceExists: !!(inputData && inputData.modelService),
      modelServiceLength: inputData?.modelService?.length || 0,
    });
    
    if (inputData && inputData.modelService) {
      const serviceNodes = inputData.modelService;
      if (Array.isArray(serviceNodes) && serviceNodes.length > 0) {
        this.logger?.info('[Worker Agent] Found model via getInputData', {
          modelType: serviceNodes[0].type,
        });
        return await this._bindServiceNode(serviceNodes[0], 'model');
      }
    }
    
    // Fallback: Check if inputData was passed via _inputData (from Supervisor)
    this.logger?.info('[Worker Agent] Checking _inputData fallback', {
      has_inputData: !!this._inputData,
      hasModelService: !!(this._inputData?.modelService),
      modelServiceLength: this._inputData?.modelService?.length || 0,
    });
    
    if (this._inputData?.modelService) {
      const serviceNodes = this._inputData.modelService;
      if (Array.isArray(serviceNodes) && serviceNodes.length > 0) {
        this.logger?.info('[Worker Agent] Found model via _inputData', {
          modelType: serviceNodes[0].type,
        });
        return await this._bindServiceNode(serviceNodes[0], 'model');
      }
    }
    
    this.logger?.error('[Worker Agent] No model found');
    throw new Error('Worker Agent requires a connected Model node');
  },

  /**
   * Bind a service node reference to a usable node instance
   * @private
   */
  _bindServiceNode: async function(serviceNodeRef, nodeType) {
    this.logger?.info('[Worker Agent] _bindServiceNode called', {
      nodeType,
      serviceNodeType: serviceNodeRef.type,
      serviceNodeId: serviceNodeRef.nodeId,
    });
    
    if (!global.nodeService) {
      throw new Error('Node service not available');
    }
    
    const nodeDefinition = await global.nodeService.getNodeDefinition(serviceNodeRef.type);
    const serviceNodeConfig = serviceNodeRef;
    
    const boundNode = Object.create(nodeDefinition);
    boundNode._serviceNodeId = serviceNodeConfig.nodeId;
    boundNode._executionId = this._executionId;
    boundNode._userId = this._userId;
    boundNode.logger = this.logger;
    
    boundNode.getNodeParameter = (paramName) => {
      return serviceNodeConfig.parameters?.[paramName];
    };
    
    boundNode.getCredentials = async (credentialType) => {
      let credentialId;
      if (Array.isArray(serviceNodeConfig.credentials)) {
        credentialId = serviceNodeConfig.credentials[0];
      } else {
        credentialId = this._getCredentialId(serviceNodeConfig, credentialType);
      }
      
      this.logger?.debug('[Worker Agent] getCredentials called', {
        credentialType,
        credentialId,
        hasCredentials: !!serviceNodeConfig.credentials,
      });
      
      if (!credentialId) {
        throw new Error(`No credential of type '${credentialType}' available`);
      }
      
      if (!global.credentialService) {
        throw new Error('Credential service not available');
      }
      
      return await global.credentialService.getCredentialForExecution(
        credentialId,
        this._userId || 'unknown'
      );
    };
    
    // Validate based on node type
    if (nodeType === 'model' && (!boundNode.chat || typeof boundNode.chat !== 'function')) {
      throw new Error('Invalid Model node: missing chat method');
    }
    
    if (nodeType === 'tool' && (!boundNode.getDefinition || !boundNode.executeTool)) {
      throw new Error('Invalid Tool node: missing required methods');
    }
    
    this.logger?.info('[Worker Agent] Service node bound successfully', {
      nodeType,
      serviceNodeType: serviceNodeRef.type,
    });
    
    return boundNode;
  },

  /**
   * Discover connected Memory node
   * @private
   */
  _discoverMemoryNode: async function() {
    const inputData = await this.getInputData?.('memoryService');
    
    if (!inputData || !inputData.memoryService) {
      return null;
    }
    
    const serviceNodes = inputData.memoryService;
    if (!Array.isArray(serviceNodes) || serviceNodes.length === 0) {
      return null;
    }
    
    try {
      const serviceNodeRef = serviceNodes[0];
      const nodeDefinition = await global.nodeService.getNodeDefinition(serviceNodeRef.type);
      const serviceNodeConfig = serviceNodeRef;
      
      const boundNode = Object.create(nodeDefinition);
      boundNode._serviceNodeId = serviceNodeConfig.nodeId;
      boundNode.logger = this.logger;
      
      boundNode.getNodeParameter = (paramName) => {
        return serviceNodeConfig.parameters?.[paramName];
      };
      
      if (!boundNode.getMessages || typeof boundNode.getMessages !== 'function') {
        return null;
      }
      
      return boundNode;
    } catch (error) {
      this.logger?.warn('[Worker Agent] Failed to discover memory node', {
        error: error.message,
      });
      return null;
    }
  },

  /**
   * Discover connected Tool nodes
   * @private
   */
  _discoverToolNodes: async function() {
    const toolNodes = [];
    
    // First try to get from injected getInputData (when called normally)
    let inputData = await this.getInputData?.('toolService');
    
    // Fallback: Check if inputData was passed via _inputData (from Supervisor)
    if ((!inputData || !inputData.toolService) && this._inputData?.toolService) {
      inputData = { toolService: this._inputData.toolService };
    }
    
    if (!inputData || !inputData.toolService) {
      return toolNodes;
    }
    
    const serviceNodes = inputData.toolService;
    if (!Array.isArray(serviceNodes) || serviceNodes.length === 0) {
      return toolNodes;
    }
    
    for (const serviceNodeRef of serviceNodes) {
      try {
        const boundNode = await this._bindServiceNode(serviceNodeRef, 'tool');
        if (boundNode.getDefinition && boundNode.executeTool) {
          toolNodes.push(boundNode);
        }
      } catch (error) {
        this.logger?.error('[Worker Agent] Failed to bind tool node', {
          type: serviceNodeRef.type,
          error: error.message,
        });
      }
    }
    
    return toolNodes;
  },


  /**
   * Execute a tool call
   * @private
   */
  _executeToolCall: async function(toolCall, toolNodes) {
    const toolNode = toolNodes.find(node => {
      const definition = node.getDefinition();
      return definition.name === toolCall.name;
    });

    if (!toolNode) {
      return {
        success: false,
        error: `Tool '${toolCall.name}' not found`,
      };
    }

    const startTime = Date.now();
    
    // Emit node-started for the tool
    this._emitNodeEvent('node-started', toolNode, { nodeName: toolCall.name });
    
    try {
      const result = await toolNode.executeTool(toolCall.arguments);
      const duration = Date.now() - startTime;
      
      // Emit node-completed for the tool
      this._emitNodeEvent('node-completed', toolNode, { nodeName: toolCall.name });
      
      // Log tool call for frontend Logs tab
      if (this.logCall) {
        this.logCall(toolCall.name, toolCall.arguments, result, duration, { type: 'tool-call' });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Emit node-failed for the tool
      this._emitNodeEvent('node-failed', toolNode, { 
        nodeName: toolCall.name,
        error: { message: error.message },
      });
      
      // Log failed tool call for frontend Logs tab
      if (this.logCall) {
        this.logCall(toolCall.name, toolCall.arguments, null, duration, { error: error.message, type: 'tool-call' });
      }
      
      return {
        success: false,
        error: `Tool execution error: ${error.message}`,
      };
    }
  },

  /**
   * Get agent definition for Supervisor
   * Returns metadata about this agent's capabilities
   */
  getAgentDefinition: function() {
    return {
      name: this.getNodeParameter?.('name') || 'Worker Agent',
      specialty: this.getNodeParameter?.('specialty') || 'General Assistant',
      description: this.getNodeParameter?.('systemPrompt')?.substring(0, 200) || '',
      identifier: this.identifier,
    };
  },

  /**
   * Execute task from Supervisor
   * This is the main method called by the Supervisor Agent
   * 
   * @param {string} task - The task/message to process
   * @param {Object} options - Execution options from Supervisor
   * @param {string} options.context - Additional context for the task
   * @param {Object} options.sharedContext - Results from other agents
   * @param {string} options.sessionId - Session ID for memory
   * @param {Object} options.fallbackModel - Supervisor's model to use if worker has none (legacy)
   * @returns {Promise<Object>} Execution result
   */
  executeTask: async function(task, options = {}) {
    const startTime = Date.now();
    
    this.logger?.info('[Worker Agent] Executing task', {
      agentName: this.getNodeParameter?.('name') || 'Worker',
      task: task.substring(0, 100),
      hasContext: !!options.context,
      hasSharedContext: !!options.sharedContext,
      hasNestedInputData: !!this._inputData && Object.keys(this._inputData).length > 0,
    });
    
    try {
      // Get configuration
      const systemPrompt = this.getNodeParameter?.('systemPrompt') || 'You are a helpful AI assistant.';
      const maxIterations = this.getNodeParameter?.('maxIterations') || 10;
      const nodeOptions = this.getNodeParameter?.('options') || {};
      
      const toolChoice = nodeOptions.toolChoice || 'auto';
      const includeSharedContext = nodeOptions.includeSharedContext !== false;
      const timeout = nodeOptions.timeout || 120000;
      
      // Build user message with context
      let userMessage = task;
      
      if (options.context) {
        userMessage = `Context: ${options.context}\n\nTask: ${task}`;
      }
      
      // Add shared context from other agents
      if (includeSharedContext && options.sharedContext?.previousResults?.length > 0) {
        const relevantResults = options.sharedContext.previousResults
          .slice(-3)
          .filter(r => r.result != null)
          .map(r => `[${r.agentName}]: ${String(r.result).substring(0, 300)}`)
          .join('\n\n');
        if (relevantResults) {
          userMessage += `\n\n---\nRelevant findings from team members:\n${relevantResults}`;
        }
      }
      
      // Discover model from nested service connections
      let modelNode = null;
      try {
        modelNode = await this._discoverModelNode();
        this.logger?.debug('[Worker Agent] Discovered own model node');
      } catch (error) {
        this.logger?.warn('[Worker Agent] Failed to discover model', { error: error.message });
        
        // Fallback to supervisor's model if provided
        if (options.fallbackModel) {
          modelNode = options.fallbackModel;
          this.logger?.info('[Worker Agent] Using supervisor model as fallback');
        }
      }
      
      if (!modelNode) {
        throw new Error('No model available. Connect a Model node to the Worker Agent.');
      }
      
      // Discover tools from nested service connections
      let toolNodes = [];
      try {
        toolNodes = await this._discoverToolNodes();
        this.logger?.debug('[Worker Agent] Discovered tools', { count: toolNodes.length });
      } catch (error) {
        this.logger?.debug('[Worker Agent] No tools available', { error: error.message });
      }
      
      // Build messages
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ];
      
      // Get tool definitions
      const tools = toolNodes.map(node => node.getDefinition());
      
      // Execute agent loop with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Worker agent timed out')), timeout);
      });
      
      const executionPromise = this._executeAgentLoop(
        modelNode,
        messages,
        tools,
        toolNodes,
        toolChoice,
        maxIterations
      );
      
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      const duration = Date.now() - startTime;
      
      this.logger?.info('[Worker Agent] Task completed', {
        agentName: this.getNodeParameter?.('name') || 'Worker',
        duration,
        iterations: result.iterations,
        toolsUsed: result.toolsUsed,
      });
      
      return {
        success: true,
        response: result.response,
        agentName: this.getNodeParameter?.('name') || 'Worker Agent',
        metadata: {
          iterations: result.iterations,
          toolsUsed: result.toolsUsed,
          duration,
        },
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger?.error('[Worker Agent] Task failed', {
        agentName: this.getNodeParameter?.('name') || 'Worker',
        error: error.message,
        duration,
      });
      
      return {
        success: false,
        error: error.message,
        agentName: this.getNodeParameter?.('name') || 'Worker Agent',
        metadata: { duration },
      };
    }
  },

  /**
   * Execute the agent loop
   * @private
   */
  _executeAgentLoop: async function(modelNode, messages, tools, toolNodes, toolChoice, maxIterations) {
    let iteration = 0;
    const toolsUsed = [];
    
    while (iteration < maxIterations) {
      iteration++;
      
      // Emit node-started for the model
      this._emitNodeEvent('node-started', modelNode, { nodeName: 'Model' });
      
      // Call model
      const modelCallStart = Date.now();
      let response;
      try {
        response = await modelNode.chat(
          messages,
          toolChoice === 'none' ? [] : tools,
          toolChoice === 'none' ? undefined : toolChoice
        );
      } catch (error) {
        // Emit node-failed for the model
        this._emitNodeEvent('node-failed', modelNode, { 
          nodeName: 'Model',
          error: { message: error.message },
        });
        throw error;
      }
      const modelCallDuration = Date.now() - modelCallStart;
      
      // Emit node-completed for the model
      this._emitNodeEvent('node-completed', modelNode, { nodeName: 'Model' });
      
      // Log model call for frontend Logs tab
      if (this.logCall) {
        this.logCall('Model', {
          messageCount: messages.length,
          toolCount: tools.length,
          iteration,
        }, {
          hasToolCalls: !!(response.toolCalls && response.toolCalls.length > 0),
          contentLength: response.content?.length || 0,
        }, modelCallDuration);
      }
      
      // No tool calls - we have final answer
      if (!response.toolCalls || response.toolCalls.length === 0) {
        return {
          response: response.content,
          iterations: iteration,
          toolsUsed,
        };
      }
      
      // Process tool calls
      for (const toolCall of response.toolCalls) {
        const toolCallId = toolCall.id || `call_${Date.now()}`;
        
        // Add assistant message with tool call
        messages.push({
          role: 'assistant',
          content: response.content || null,
          tool_calls: [{
            id: toolCallId,
            type: 'function',
            function: {
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.arguments),
            },
          }],
        });
        
        // Execute tool
        const toolResult = await this._executeToolCall(toolCall, toolNodes);
        
        if (!toolsUsed.includes(toolCall.name)) {
          toolsUsed.push(toolCall.name);
        }
        
        // Add tool result
        messages.push({
          role: 'tool',
          content: JSON.stringify(toolResult),
          tool_call_id: toolCallId,
        });
      }
    }
    
    // Max iterations reached
    const lastAssistant = messages.filter(m => m.role === 'assistant').pop();
    return {
      response: lastAssistant?.content || 'Reached max iterations without final answer',
      iterations: iteration,
      toolsUsed,
      maxIterationsReached: true,
    };
  },

  /**
   * Standard execute method (not used for Worker Agent)
   * Worker agents are called via executeTask() by Supervisor
   */
  execute: async function(inputData) {
    // This node doesn't execute in normal workflow flow
    // It's called by Supervisor via executeTask()
    this.logger?.warn('[Worker Agent] execute() called directly - this node should be called by Supervisor Agent');
    
    return [{
      main: [{
        json: {
          error: 'Worker Agent should be connected to a Supervisor Agent, not used directly in workflow',
          hint: 'Connect this node to a Supervisor Agent\'s "Agents" input',
        }
      }]
    }];
  },
};

module.exports = WorkerAgentNode;

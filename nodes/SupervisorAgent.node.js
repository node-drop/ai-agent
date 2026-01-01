/**
 * Supervisor Agent Node
 * 
 * Orchestrates multiple AI agents to accomplish complex tasks.
 * Acts as a "manager" that delegates work to specialized worker agents.
 * 
 * Features:
 * - Multi-agent orchestration with supervisor pattern
 * - Dynamic task routing to specialized agents
 * - Parallel and sequential agent execution
 * - Result aggregation from multiple agents
 * - Conversation context sharing between agents
 * - Configurable routing strategies (auto, round-robin, capability-based)
 * - Max delegation depth to prevent infinite loops
 * 
 * Architecture:
 * - Main input: Receives trigger data or user messages
 * - Model connection: Required - provides supervisor reasoning
 * - Agent connections: Required - worker agents to delegate to
 * - Memory connection: Optional - shared conversation context
 * - Main output: Returns aggregated response with delegation metadata
 */

const {
  AgentStateManager,
  ToolCallTracker,
  AgentErrorHandler,
} = require('../utils/agentLoopUtilities');

const { z } = require('zod');

/**
 * Supervisor State Manager
 * Extended state manager for tracking multi-agent delegations
 */
class SupervisorStateManager extends AgentStateManager {
  constructor(sessionId, maxIterations, maxDelegations) {
    super(sessionId, maxIterations);
    this.maxDelegations = maxDelegations;
    this.delegationCount = 0;
    this.delegationHistory = [];
    this.agentResults = new Map();
  }

  /**
   * Record a delegation to a worker agent
   * @param {string} agentId - ID of the agent delegated to
   * @param {string} agentName - Name of the agent
   * @param {string} task - Task description
   * @returns {string} Delegation tracking ID
   */
  recordDelegation(agentId, agentName, task) {
    this.delegationCount++;
    const delegationId = `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.delegationHistory.push({
      delegationId,
      agentId,
      agentName,
      task,
      timestamp: Date.now(),
      status: 'pending',
      result: null,
      duration: null,
    });
    
    return delegationId;
  }

  /**
   * Complete a delegation with result
   * @param {string} delegationId - Delegation tracking ID
   * @param {Object} result - Result from the worker agent
   */
  completeDelegation(delegationId, result) {
    const delegation = this.delegationHistory.find(d => d.delegationId === delegationId);
    if (delegation) {
      delegation.status = result.success !== false ? 'completed' : 'failed';
      delegation.result = result;
      delegation.duration = Date.now() - delegation.timestamp;
      this.agentResults.set(delegation.agentId, result);
    }
  }

  /**
   * Check if max delegations reached
   * @returns {boolean}
   */
  hasReachedMaxDelegations() {
    return this.delegationCount >= this.maxDelegations;
  }

  /**
   * Get delegation metadata
   * @returns {Object}
   */
  getDelegationMetadata() {
    return {
      totalDelegations: this.delegationCount,
      delegationHistory: this.delegationHistory.map(d => ({
        agentName: d.agentName,
        task: d.task.substring(0, 100),
        status: d.status,
        duration: d.duration,
      })),
      agentResults: Object.fromEntries(this.agentResults),
    };
  }
}

const SupervisorAgentNode = {
  identifier: 'supervisor-agent',
  displayName: 'Supervisor Agent',
  name: 'supervisor-agent',
  group: ['ai', 'agent', 'orchestration'],
  version: 1,
  description: 'Orchestrates multiple AI agents to accomplish complex tasks through delegation',
  ai: {
    description: "A supervisor agent that coordinates multiple worker agents. Analyzes tasks, delegates to specialists, and aggregates results. Best for complex multi-step tasks requiring different expertise.",
    useCases: [
      "Complex research requiring multiple data sources",
      "Content creation with research, writing, and editing phases",
      "Customer support routing to specialized agents",
      "Data processing pipelines with analysis and reporting",
      "Code review with security, performance, and style checks"
    ],
    tags: ["supervisor", "multi-agent", "orchestration", "delegation", "coordinator", "manager"],
    rules: [
      "MUST connect a model node (openai-model or anthropic-model) to modelService input",
      "MUST connect at least one agent node to agentService input",
      "MAY connect a memory node for shared conversation context",
      "Each connected agent should have a clear specialty/role",
      "Supervisor decides which agent(s) to delegate to based on task"
    ],
    recommendations: {
      connectsAfter: ["chat", "webhook", "manual-trigger", "form-trigger"],
      inputs: {
        modelService: ["openai-model", "anthropic-model"],
        agentService: ["ai-agent"],
        memoryService: ["buffer-memory", "window-memory", "redis-memory"]
      }
    },
    complexityScore: 9
  },
  icon: 'lucide:users',
  color: '#8E44AD',
  defaults: {
    name: 'Supervisor Agent',
    systemPrompt: '',
    userMessage: '',
    maxIterations: 5,
    maxDelegations: 10,
  },
  inputs: ['main', 'modelService', 'agentService', 'memoryService'],
  outputs: ['main'],
  inputsConfig: {
    main: { position: 'left' },
    modelService: { position: 'bottom', displayName: 'Model', required: true },
    agentService: { position: 'bottom', displayName: 'Agents', required: true, multiple: true },
    memoryService: { position: 'bottom', displayName: 'Memory', required: false },
  },
  properties: [
    {
      displayName: 'System Prompt',
      name: 'systemPrompt',
      type: 'expression',
      required: false,
      default: `You are a Supervisor Agent that coordinates a team of specialized worker agents.

Your role is to:
1. Analyze the user's request and break it down into subtasks
2. Delegate subtasks to the most appropriate worker agent(s)
3. Review results from workers and synthesize a final response
4. Ask follow-up questions to workers if their responses are incomplete

When delegating, consider each agent's specialty and capabilities.
You can delegate to multiple agents in parallel for independent tasks.
Always provide clear, specific instructions when delegating.`,
      description: 'Instructions that define how the supervisor coordinates agents',
      placeholder: 'You are a supervisor that coordinates...',
      typeOptions: {
        rows: 6,
      },
    },
    {
      displayName: 'User Message',
      name: 'userMessage',
      type: 'expression',
      required: true,
      default: '',
      description: 'The task or message to process. Supports {{json.field}} expressions',
      placeholder: 'Enter the task or use {{json.field}}',
      typeOptions: {
        rows: 3,
      },
    },
    {
      displayName: 'Routing Strategy',
      name: 'routingStrategy',
      type: 'options',
      required: false,
      default: 'auto',
      description: 'How the supervisor decides which agent(s) to use',
      options: [
        {
          name: 'Auto (Supervisor Decides)',
          value: 'auto',
          description: 'Supervisor analyzes task and picks best agent(s)',
        },
        {
          name: 'Broadcast (All Agents)',
          value: 'broadcast',
          description: 'Send task to all agents and aggregate results',
        },
        {
          name: 'Sequential (Chain)',
          value: 'sequential',
          description: 'Pass task through agents in order, each building on previous',
        },
      ],
    },
    {
      displayName: 'Max Iterations',
      name: 'maxIterations',
      type: 'number',
      required: false,
      default: 5,
      description: 'Maximum supervisor reasoning iterations',
      placeholder: '5',
      typeOptions: {
        minValue: 1,
        maxValue: 20,
      },
    },
    {
      displayName: 'Max Delegations',
      name: 'maxDelegations',
      type: 'number',
      required: false,
      default: 10,
      description: 'Maximum total delegations to worker agents',
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
      description: 'Additional supervisor configuration options',
      options: [
        {
          name: 'aggregationMode',
          displayName: 'Result Aggregation',
          type: 'options',
          default: 'synthesize',
          description: 'How to combine results from multiple agents',
          options: [
            {
              name: 'Synthesize (AI Summary)',
              value: 'synthesize',
              description: 'Supervisor creates unified response from all results',
            },
            {
              name: 'Concatenate',
              value: 'concatenate',
              description: 'Combine all agent responses sequentially',
            },
            {
              name: 'Best Result',
              value: 'best',
              description: 'Supervisor picks the best single response',
            },
            {
              name: 'Structured',
              value: 'structured',
              description: 'Return results as structured object by agent',
            },
          ],
        },
        {
          name: 'parallelExecution',
          displayName: 'Parallel Execution',
          type: 'boolean',
          default: true,
          description: 'Execute independent agent tasks in parallel',
        },
        {
          name: 'shareContext',
          displayName: 'Share Context Between Agents',
          type: 'boolean',
          default: true,
          description: 'Share conversation context and previous results with agents',
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
          default: 600000,
          description: 'Maximum execution time in milliseconds (10 minutes default)',
          placeholder: '600000',
          typeOptions: {
            minValue: 10000,
            maxValue: 1800000,
          },
        },
      ],
    },
  ],

  /**
   * Emit a node event for real-time UI updates
   * 
   * IMPORTANT FOR DEEP NESTED NODES:
   * When building nodes that orchestrate other service nodes (like this Supervisor Agent),
   * you MUST emit node events for visual indicators to work in the UI:
   * 
   * 1. Every service node (Model, Tool, Agent, etc.) needs _serviceNodeId set when bound
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
   * - For worker agents, pass inputData so they can discover their own nested services
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

    this.logger?.debug(`[Supervisor] Emitting ${eventType} event`, {
      nodeId: nodeConfig._serviceNodeId,
      eventType,
    });

    global.realtimeExecutionEngine.emit(eventType, eventData);
  },

  /**
   * Build the delegation tools for the supervisor
   * Each connected agent becomes a "tool" the supervisor can call
   * @private
   * @param {Array} agentNodes - Connected agent nodes
   * @returns {Array} Tool definitions for delegation
   */
  _buildDelegationTools: function(agentNodes) {
    const tools = [];
    
    for (const agent of agentNodes) {
      const agentConfig = agent._config || {};
      // Get agent name - strip expression prefix if present
      let agentName = agentConfig.name || agent.displayName || 'Worker Agent';
      if (typeof agentName === 'string' && agentName.startsWith('=')) {
        // This is an unresolved expression, use a fallback
        agentName = agentConfig.specialty || agent.displayName || 'Worker Agent';
      }
      
      // Get description - prefer specialty over system prompt
      let agentDescription = agentConfig.specialty || agentConfig.description;
      if (!agentDescription && agentConfig.systemPrompt) {
        // Use first 200 chars of system prompt, but strip expression prefix
        let prompt = agentConfig.systemPrompt;
        if (typeof prompt === 'string' && prompt.startsWith('=')) {
          prompt = prompt.substring(1).trim();
        }
        agentDescription = prompt.substring(0, 200);
      }
      agentDescription = agentDescription || 'A worker agent';
      
      tools.push({
        name: `delegate_to_${this._sanitizeToolName(agentName)}`,
        description: `Delegate a task to ${agentName}. ${agentDescription}`,
        parameters: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'The specific task or question to delegate to this agent',
            },
            context: {
              type: 'string',
              description: 'Additional context or background information for the agent (optional)',
            },
            expectedOutput: {
              type: 'string',
              description: 'Description of what kind of response you expect (optional)',
            },
          },
          required: ['task'],
        },
        _agentRef: agent,
        _agentName: agentName,
      });
    }
    
    // Add a "final_answer" tool for when supervisor is done
    tools.push({
      name: 'final_answer',
      description: 'Provide the final synthesized answer to the user. Use this when you have gathered enough information from worker agents.',
      parameters: {
        type: 'object',
        properties: {
          answer: {
            type: 'string',
            description: 'The final comprehensive answer to the user',
          },
          summary: {
            type: 'string',
            description: 'Brief summary of what was accomplished (optional)',
          },
        },
        required: ['answer'],
      },
      _isFinalAnswer: true,
    });
    
    return tools;
  },

  /**
   * Sanitize agent name for use as tool name
   * @private
   * @param {string} name - Agent name
   * @returns {string} Sanitized name
   */
  _sanitizeToolName: function(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 50);
  },

  /**
   * Build system prompt with agent roster
   * @private
   * @param {string} basePrompt - Base system prompt
   * @param {Array} agentNodes - Connected agent nodes
   * @returns {string} Enhanced system prompt
   */
  _buildSupervisorPrompt: function(basePrompt, agentNodes) {
    const agentRoster = agentNodes.map((agent, index) => {
      const config = agent._config || {};
      const name = config.name || agent.displayName || `Agent ${index + 1}`;
      const specialty = config.systemPrompt?.substring(0, 150) || 'General purpose agent';
      return `- ${name}: ${specialty}`;
    }).join('\n');
    
    return `${basePrompt}

## Your Team
You have access to the following worker agents:
${agentRoster}

## Delegation Guidelines
- Analyze the user's request to identify what expertise is needed
- Delegate specific, well-defined tasks to appropriate agents
- You can delegate to multiple agents for complex tasks
- Review agent responses and ask follow-up questions if needed
- When you have enough information, use the final_answer tool to respond

## Available Actions
- delegate_to_[agent_name]: Send a task to a specific worker agent
- final_answer: Provide your final response to the user`;
  },

  /**
   * Execute a delegation to a worker agent
   * @private
   * @param {Object} tool - The delegation tool
   * @param {Object} args - Delegation arguments
   * @param {Object} stateManager - Supervisor state manager
   * @param {Object} sharedContext - Shared context for agents
   * @returns {Promise<Object>} Agent result
   */
  _executeDelegation: async function(tool, args, stateManager, sharedContext) {
    const startTime = Date.now();
    const agent = tool._agentRef;
    const agentName = tool._agentName;
    
    // Check delegation limit
    if (stateManager.hasReachedMaxDelegations()) {
      return {
        success: false,
        error: `Maximum delegations (${stateManager.maxDelegations}) reached`,
      };
    }
    
    const delegationId = stateManager.recordDelegation(
      agent._serviceNodeId || 'unknown',
      agentName,
      args.task
    );
    
    // Emit node-started for the worker agent
    this._emitNodeEvent('node-started', agent, { nodeName: agentName });
    
    this.logger?.info('[Supervisor] Delegating to agent', {
      agentName,
      task: args.task.substring(0, 100),
      delegationId,
    });
    
    try {
      // Build the message for the worker agent
      let workerMessage = args.task;
      
      if (args.context) {
        workerMessage = `Context: ${args.context}\n\nTask: ${args.task}`;
      }
      
      if (args.expectedOutput) {
        workerMessage += `\n\nExpected output: ${args.expectedOutput}`;
      }
      
      // Add shared context if enabled
      if (sharedContext && sharedContext.previousResults?.length > 0) {
        const relevantResults = sharedContext.previousResults
          .slice(-3)
          .filter(r => r.result != null)
          .map(r => `[${r.agentName}]: ${String(r.result).substring(0, 200)}`)
          .join('\n');
        if (relevantResults) {
          workerMessage += `\n\nPrevious findings from other agents:\n${relevantResults}`;
        }
      }
      
      // Execute the worker agent
      // The agent node should have an execute method we can call
      const agentResult = await this._executeWorkerAgent(agent, workerMessage, sharedContext, this._supervisorModel);
      
      const duration = Date.now() - startTime;
      
      stateManager.completeDelegation(delegationId, {
        success: true,
        response: agentResult.response,
        agentName,
        duration,
      });
      
      // Emit node-completed for the worker agent
      this._emitNodeEvent('node-completed', agent, { nodeName: agentName });
      
      // Log agent delegation for frontend Logs tab
      if (this.logCall) {
        this.logCall(`Agent: ${agentName}`, {
          task: args.task.substring(0, 200),
          context: args.context?.substring(0, 100),
        }, {
          response: agentResult.response?.substring(0, 500),
          success: true,
        }, duration, { type: 'service-call' });
      }
      
      this.logger?.info('[Supervisor] Delegation completed', {
        agentName,
        duration,
        responseLength: agentResult.response?.length || 0,
      });
      
      return {
        success: true,
        agentName,
        response: agentResult.response,
        metadata: agentResult.metadata,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Emit node-failed for the worker agent
      this._emitNodeEvent('node-failed', agent, { 
        nodeName: agentName,
        error: { message: error.message },
      });
      
      // Log failed delegation for frontend Logs tab
      if (this.logCall) {
        this.logCall(`Agent: ${agentName}`, {
          task: args.task.substring(0, 200),
        }, null, duration, { error: error.message, type: 'service-call' });
      }
      
      stateManager.completeDelegation(delegationId, {
        success: false,
        error: error.message,
        agentName,
        duration,
      });
      
      this.logger?.error('[Supervisor] Delegation failed', {
        agentName,
        error: error.message,
        duration,
      });
      
      return {
        success: false,
        agentName,
        error: `Agent ${agentName} failed: ${error.message}`,
      };
    }
  },

  /**
   * Execute a worker agent with the given message
   * @private
   * @param {Object} agent - The agent node (Worker Agent)
   * @param {string} message - Message to send to the agent
   * @param {Object} sharedContext - Shared context from other agents
   * @param {Object} supervisorModel - Supervisor's model node (fallback for workers)
   * @returns {Promise<Object>} Agent response
   */
  _executeWorkerAgent: async function(agent, message, sharedContext = {}, supervisorModel = null) {
    // Check if this is a Worker Agent with executeTask method
    if (agent.executeTask && typeof agent.executeTask === 'function') {
      this.logger?.debug('[Supervisor] Calling Worker Agent executeTask');
      
      // Pass supervisor's model as fallback if worker doesn't have its own
      return await agent.executeTask(message, {
        sharedContext,
        sessionId: `supervisor_${this._executionId}_${Date.now()}`,
        fallbackModel: supervisorModel,
      });
    }
    
    // Fallback: Use supervisor's model directly
    this.logger?.warn('[Supervisor] Agent does not have executeTask method, using supervisor model');
    
    if (!supervisorModel) {
      throw new Error('No model available for worker agent execution');
    }
    
    const agentConfig = agent._config || {};
    
    // Build messages
    const messages = [];
    
    if (agentConfig.systemPrompt) {
      messages.push({ role: 'system', content: agentConfig.systemPrompt });
    }
    
    messages.push({ role: 'user', content: message });
    
    // Execute with supervisor's model
    const response = await supervisorModel.chat(messages, [], undefined);
    
    return {
      success: true,
      response: response.content,
      agentName: agentConfig.name || 'Agent',
      metadata: { iterations: 1, usedSupervisorModel: true },
    };
  },


  /**
   * Discover connected agent nodes
   * @private
   * @returns {Promise<Array>} Array of connected agent nodes with their configs
   */
  _discoverAgentNodes: async function() {
    const agentNodes = [];
    
    this.logger?.info('[Supervisor] _discoverAgentNodes called');
    
    const inputData = await this.getInputData?.('agentService');
    
    this.logger?.info('[Supervisor] getInputData result for agentService', {
      hasInputData: !!inputData,
      inputDataKeys: inputData ? Object.keys(inputData) : [],
      agentServiceExists: !!(inputData && inputData.agentService),
      agentServiceLength: inputData?.agentService?.length || 0,
    });
    
    if (!inputData || !inputData.agentService) {
      throw new Error('Supervisor Agent requires at least one connected worker agent');
    }
    
    const serviceNodes = inputData.agentService;
    if (!Array.isArray(serviceNodes) || serviceNodes.length === 0) {
      throw new Error('Supervisor Agent requires at least one connected worker agent');
    }
    
    this.logger?.info('[Supervisor] Discovering agent nodes', {
      count: serviceNodes.length,
      types: serviceNodes.map(n => n.type),
    });
    
    for (const serviceNodeRef of serviceNodes) {
      this.logger?.info('[Supervisor] Processing agent service node', {
        type: serviceNodeRef.type,
        nodeId: serviceNodeRef.nodeId,
        hasInputData: !!serviceNodeRef.inputData,
        inputDataKeys: serviceNodeRef.inputData ? Object.keys(serviceNodeRef.inputData) : [],
        parameters: serviceNodeRef.parameters,
      });
      
      try {
        if (!global.nodeService) {
          this.logger?.error('[Supervisor] global.nodeService not available');
          continue;
        }
        
        const nodeDefinition = await global.nodeService.getNodeDefinition(serviceNodeRef.type);
        const serviceNodeConfig = serviceNodeRef;
        
        // Create bound instance
        const boundNode = Object.create(nodeDefinition);
        boundNode._serviceNodeId = serviceNodeConfig.nodeId;
        boundNode._executionId = this._executionId;
        boundNode._userId = this.userId;
        boundNode._config = serviceNodeConfig.parameters || {};
        
        // IMPORTANT: Pass the worker's nested service connections
        // This comes from the execution engine's getNestedServiceConnections
        boundNode._inputData = serviceNodeConfig.inputData || {};
        
        this.logger?.info('[Supervisor] Setting _inputData on worker', {
          workerNodeId: serviceNodeConfig.nodeId,
          inputDataKeys: Object.keys(boundNode._inputData),
          modelServiceCount: boundNode._inputData.modelService?.length || 0,
          toolServiceCount: boundNode._inputData.toolService?.length || 0,
        });
        
        // Copy helper methods from Supervisor context
        boundNode.logger = this.logger;
        boundNode.helpers = this.helpers;
        boundNode.resolveValue = this.resolveValue;
        
        // Create getNodeParameter for the worker
        boundNode.getNodeParameter = (paramName) => {
          return serviceNodeConfig.parameters?.[paramName];
        };
        
        // Create getInputData for the worker to discover its own services
        // This uses the nested inputData from the execution engine
        boundNode.getInputData = async (inputName) => {
          this.logger?.debug('[Supervisor] Worker getInputData called', {
            inputName,
            hasData: !!(serviceNodeConfig.inputData && serviceNodeConfig.inputData[inputName]),
          });
          if (serviceNodeConfig.inputData && serviceNodeConfig.inputData[inputName]) {
            return { [inputName]: serviceNodeConfig.inputData[inputName] };
          }
          return null;
        };
        
        // Create getCredentials for the worker
        boundNode.getCredentials = async (credentialType) => {
          const credentialId = this._getCredentialId(serviceNodeConfig, credentialType);
          if (!credentialId) {
            throw new Error(`No credential of type '${credentialType}' available`);
          }
          if (!global.credentialService) {
            throw new Error('Credential service not available');
          }
          return await global.credentialService.getCredentialForExecution(
            credentialId,
            this.userId || 'unknown'
          );
        };
        
        agentNodes.push(boundNode);
        
        const nestedServices = Object.keys(serviceNodeConfig.inputData || {});
        this.logger?.info('[Supervisor] Discovered agent', {
          type: serviceNodeRef.type,
          name: serviceNodeConfig.parameters?.name || 'Unnamed Agent',
          hasNestedServices: nestedServices.length > 0,
          nestedServices: nestedServices,
          modelServiceDetails: serviceNodeConfig.inputData?.modelService?.map(m => m.type) || [],
          toolServiceDetails: serviceNodeConfig.inputData?.toolService?.map(t => t.type) || [],
        });
      } catch (error) {
        this.logger?.error('[Supervisor] Failed to discover agent', {
          type: serviceNodeRef.type,
          error: error.message,
        });
      }
    }
    
    if (agentNodes.length === 0) {
      throw new Error('No valid worker agents found. Please connect Worker Agent nodes.');
    }
    
    this.logger?.info('[Supervisor] Agent discovery complete', {
      totalAgents: agentNodes.length,
    });
    
    return agentNodes;
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
   * Discover connected model node (required)
   * @private
   * @returns {Promise<Object>} Model node
   */
  _discoverModelNode: async function() {
    const inputData = await this.getInputData?.('modelService');
    
    if (!inputData || !inputData.modelService) {
      throw new Error('Supervisor Agent requires a connected Model node');
    }
    
    const serviceNodes = inputData.modelService;
    if (!Array.isArray(serviceNodes) || serviceNodes.length === 0) {
      throw new Error('Supervisor Agent requires a connected Model node');
    }
    
    const serviceNodeRef = serviceNodes[0];
    
    if (!global.nodeService) {
      throw new Error('Node service not available');
    }
    
    const nodeDefinition = await global.nodeService.getNodeDefinition(serviceNodeRef.type);
    const serviceNodeConfig = serviceNodeRef;
    
    const boundNode = Object.create(nodeDefinition);
    boundNode._serviceNodeId = serviceNodeConfig.nodeId;
    boundNode._executionId = this._executionId;
    boundNode._userId = this.userId;
    boundNode.logger = this.logger;
    boundNode.helpers = this.helpers;
    
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
      
      if (!credentialId) {
        throw new Error(`No credential of type '${credentialType}' available`);
      }
      
      if (!global.credentialService) {
        throw new Error('Credential service not available');
      }
      
      const userId = this._userId || this.userId || 'unknown';
      return await global.credentialService.getCredentialForExecution(credentialId, userId);
    };
    
    if (!boundNode.chat || typeof boundNode.chat !== 'function') {
      throw new Error('Invalid Model node: missing chat method');
    }
    
    return boundNode;
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
   * Discover connected memory node (optional)
   * @private
   * @returns {Promise<Object|null>} Memory node or null
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
    
    const serviceNodeRef = serviceNodes[0];
    
    try {
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
      this.logger?.warn('[Supervisor] Failed to discover memory node', {
        error: error.message,
      });
      return null;
    }
  },

  /**
   * Execute broadcast strategy - send to all agents
   * @private
   */
  _executeBroadcast: async function(agentNodes, message, stateManager, options) {
    const results = [];
    const sharedContext = { previousResults: [] };
    
    // Build delegation tools
    const tools = this._buildDelegationTools(agentNodes);
    const delegationTools = tools.filter(t => !t._isFinalAnswer);
    
    if (options.parallelExecution) {
      // Execute all agents in parallel
      const promises = delegationTools.map(tool => 
        this._executeDelegation(tool, { task: message }, stateManager, sharedContext)
      );
      
      const parallelResults = await Promise.allSettled(promises);
      
      for (const result of parallelResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          if (result.value.success) {
            sharedContext.previousResults.push({
              agentName: result.value.agentName,
              result: result.value.response,
            });
          }
        } else {
          results.push({
            success: false,
            error: result.reason?.message || 'Unknown error',
          });
        }
      }
    } else {
      // Execute sequentially
      for (const tool of delegationTools) {
        const result = await this._executeDelegation(tool, { task: message }, stateManager, sharedContext);
        results.push(result);
        
        if (result.success) {
          sharedContext.previousResults.push({
            agentName: result.agentName,
            result: result.response,
          });
        }
      }
    }
    
    return results;
  },

  /**
   * Execute sequential strategy - chain agents
   * @private
   */
  _executeSequential: async function(agentNodes, message, stateManager, options) {
    const results = [];
    let currentMessage = message;
    
    const tools = this._buildDelegationTools(agentNodes);
    const delegationTools = tools.filter(t => !t._isFinalAnswer);
    
    for (const tool of delegationTools) {
      const result = await this._executeDelegation(
        tool, 
        { 
          task: currentMessage,
          context: results.length > 0 
            ? `Previous agent output: ${results[results.length - 1].response}` 
            : undefined,
        }, 
        stateManager, 
        { previousResults: results.map(r => ({ agentName: r.agentName, result: r.response })) }
      );
      
      results.push(result);
      
      if (result.success) {
        // Next agent receives previous agent's output
        currentMessage = `Based on this input: "${result.response}"\n\nContinue the task: ${message}`;
      }
    }
    
    return results;
  },


  /**
   * Execute auto strategy - supervisor decides
   * @private
   */
  _executeAuto: async function(modelNode, agentNodes, message, stateManager, options) {
    const tools = this._buildDelegationTools(agentNodes);
    const sharedContext = { previousResults: [] };
    
    // Build supervisor prompt
    const systemPrompt = this._buildSupervisorPrompt(
      await this.getNodeParameter('systemPrompt') || '',
      agentNodes
    );
    
    // Initialize messages
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];
    
    let iteration = 0;
    const maxIterations = stateManager.maxIterations;
    
    while (iteration < maxIterations) {
      iteration++;
      stateManager.incrementIteration();
      
      this.logger?.debug('[Supervisor] Iteration', { iteration, maxIterations });
      
      // Call model with delegation tools
      const toolDefinitions = tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }));
      
      // Emit node-started for the model
      this._emitNodeEvent('node-started', modelNode, { nodeName: 'Model' });
      
      const modelCallStart = Date.now();
      let response;
      try {
        response = await modelNode.chat(messages, toolDefinitions, 'auto');
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
          toolCount: toolDefinitions.length,
        }, {
          hasToolCalls: !!(response.toolCalls && response.toolCalls.length > 0),
          contentLength: response.content?.length || 0,
        }, modelCallDuration);
      }
      
      // Check for final answer
      if (!response.toolCalls || response.toolCalls.length === 0) {
        // Model gave direct response without using tools
        return {
          response: response.content,
          delegations: stateManager.getDelegationMetadata(),
          iterations: iteration,
        };
      }
      
      // Process tool calls
      for (const toolCall of response.toolCalls) {
        const tool = tools.find(t => t.name === toolCall.name);
        
        // Ensure we have a tool_call_id (generate one if missing)
        const toolCallId = toolCall.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        if (!tool) {
          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: toolCallId,
              type: 'function',
              function: { name: toolCall.name, arguments: JSON.stringify(toolCall.arguments) },
            }],
          });
          messages.push({
            role: 'tool',
            content: JSON.stringify({ error: `Unknown tool: ${toolCall.name}` }),
            tool_call_id: toolCallId,
          });
          continue;
        }
        
        // Check if this is the final answer tool
        if (tool._isFinalAnswer) {
          return {
            response: toolCall.arguments.answer,
            summary: toolCall.arguments.summary,
            delegations: stateManager.getDelegationMetadata(),
            iterations: iteration,
          };
        }
        
        // Execute delegation
        const result = await this._executeDelegation(tool, toolCall.arguments, stateManager, sharedContext);
        
        // Add to shared context
        if (result.success) {
          sharedContext.previousResults.push({
            agentName: result.agentName,
            result: result.response,
          });
        }
        
        // Add tool call and result to messages
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: toolCallId,
            type: 'function',
            function: { name: toolCall.name, arguments: JSON.stringify(toolCall.arguments) },
          }],
        });
        
        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          tool_call_id: toolCallId,
        });
      }
    }
    
    // Max iterations reached - synthesize from what we have
    return {
      response: 'Supervisor reached maximum iterations. Partial results collected.',
      delegations: stateManager.getDelegationMetadata(),
      iterations: iteration,
      maxIterationsReached: true,
    };
  },

  /**
   * Aggregate results based on aggregation mode
   * @private
   */
  _aggregateResults: async function(modelNode, results, aggregationMode, originalMessage) {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      return {
        response: 'No successful responses from worker agents',
        success: false,
      };
    }
    
    switch (aggregationMode) {
      case 'concatenate':
        return {
          response: successfulResults
            .map(r => `**${r.agentName}:**\n${r.response}`)
            .join('\n\n---\n\n'),
          success: true,
        };
        
      case 'best':
        // Use model to pick best response
        const pickBestPrompt = `Given these responses to the question "${originalMessage}", pick the best one and explain why:

${successfulResults.map((r, i) => `Response ${i + 1} (${r.agentName}):\n${r.response}`).join('\n\n')}

Return only the best response content.`;
        
        const bestResponse = await modelNode.chat([
          { role: 'user', content: pickBestPrompt }
        ], [], undefined);
        
        return {
          response: bestResponse.content,
          success: true,
        };
        
      case 'structured':
        return {
          response: JSON.stringify(
            Object.fromEntries(successfulResults.map(r => [r.agentName, r.response])),
            null,
            2
          ),
          success: true,
          structured: true,
        };
        
      case 'synthesize':
      default:
        // Use model to synthesize responses
        const synthesizePrompt = `You are synthesizing responses from multiple AI agents to answer: "${originalMessage}"

Agent responses:
${successfulResults.map(r => `**${r.agentName}:**\n${r.response}`).join('\n\n')}

Create a comprehensive, unified response that combines the best insights from all agents. Be concise but thorough.`;
        
        const synthesizedResponse = await modelNode.chat([
          { role: 'user', content: synthesizePrompt }
        ], [], undefined);
        
        return {
          response: synthesizedResponse.content,
          success: true,
        };
    }
  },

  /**
   * Main execute method
   */
  execute: async function(inputData) {
    const startTime = Date.now();
    this._executionId = this.logger?.executionId || 'unknown';
    
    // Log immediately to confirm execute is called
    console.log('[Supervisor] ========== EXECUTE CALLED ==========');
    console.log('[Supervisor] inputData:', JSON.stringify(inputData, null, 2).substring(0, 500));
    
    this.logger?.info('[Supervisor] Starting execution', {
      hasInputData: !!inputData,
      inputDataKeys: inputData ? Object.keys(inputData) : [],
      hasLogger: !!this.logger,
      executionId: this._executionId,
    });
    
    try {
      // Get parameters
      console.log('[Supervisor] Getting parameters...');
      const systemPrompt = await this.getNodeParameter('systemPrompt');
      const userMessage = await this.getNodeParameter('userMessage');
      const routingStrategy = await this.getNodeParameter('routingStrategy') || 'auto';
      const maxIterations = await this.getNodeParameter('maxIterations') || 5;
      const maxDelegations = await this.getNodeParameter('maxDelegations') || 10;
      const options = (await this.getNodeParameter('options')) || {};
      
      console.log('[Supervisor] Parameters:', { userMessage: userMessage?.substring(0, 50), routingStrategy });
      
      if (!userMessage) {
        throw new Error('User message is required');
      }
      
      const aggregationMode = options.aggregationMode || 'synthesize';
      const parallelExecution = options.parallelExecution !== false;
      const shareContext = options.shareContext !== false;
      const sessionId = options.sessionId || 'default';
      const timeout = options.timeout || 600000;
      
      this.logger?.info('[Supervisor] Configuration', {
        routingStrategy,
        maxIterations,
        maxDelegations,
        aggregationMode,
        parallelExecution,
      });
      
      // Discover nodes
      console.log('[Supervisor] Discovering nodes...');
      const modelNode = await this._discoverModelNode();
      console.log('[Supervisor] Model node discovered:', !!modelNode);
      
      const agentNodes = await this._discoverAgentNodes();
      console.log('[Supervisor] Agent nodes discovered:', agentNodes.length);
      
      const memoryNode = await this._discoverMemoryNode();
      console.log('[Supervisor] Memory node discovered:', !!memoryNode);
      
      // Store supervisor's model for worker agents to use as fallback
      this._supervisorModel = modelNode;
      
      this.logger?.info('[Supervisor] Discovered nodes', {
        hasModel: !!modelNode,
        agentCount: agentNodes.length,
        hasMemory: !!memoryNode,
      });
      
      // Initialize state manager
      const stateManager = new SupervisorStateManager(sessionId, maxIterations, maxDelegations);
      
      // Execute based on routing strategy
      let result;
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Supervisor execution timed out after ${timeout}ms`)), timeout);
      });
      
      const executionPromise = (async () => {
        switch (routingStrategy) {
          case 'broadcast':
            const broadcastResults = await this._executeBroadcast(
              agentNodes, 
              userMessage, 
              stateManager, 
              { parallelExecution, shareContext }
            );
            return await this._aggregateResults(modelNode, broadcastResults, aggregationMode, userMessage);
            
          case 'sequential':
            const sequentialResults = await this._executeSequential(
              agentNodes, 
              userMessage, 
              stateManager, 
              { shareContext }
            );
            return await this._aggregateResults(modelNode, sequentialResults, aggregationMode, userMessage);
            
          case 'auto':
          default:
            return await this._executeAuto(
              modelNode, 
              agentNodes, 
              userMessage, 
              stateManager, 
              { parallelExecution, shareContext }
            );
        }
      })();
      
      result = await Promise.race([executionPromise, timeoutPromise]);
      
      const duration = Date.now() - startTime;
      
      this.logger?.info('[Supervisor] Execution completed', {
        duration,
        delegations: stateManager.delegationCount,
        iterations: stateManager.currentIteration,
      });
      
      // Format output
      const output = {
        response: result.response,
        success: true,
        metadata: {
          routingStrategy,
          aggregationMode,
          duration,
          ...stateManager.getDelegationMetadata(),
          iterations: result.iterations || stateManager.currentIteration,
        },
      };
      
      if (result.summary) {
        output.summary = result.summary;
      }
      
      return [{ main: [{ json: output }] }];
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger?.error('[Supervisor] Execution failed', {
        error: error.message,
        duration,
      });
      
      throw new Error(`Supervisor Agent failed: ${error.message}`);
    }
  },
};

module.exports = SupervisorAgentNode;

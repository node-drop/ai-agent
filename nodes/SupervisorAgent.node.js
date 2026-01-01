/**
 * Supervisor Agent Node
 * 
 * Orchestrates multiple AI agents to accomplish complex tasks.
 * Acts as a "manager" that delegates work to specialized worker agents.
 */

const { executeSupervisor } = require('./modes/supervisor');

const SupervisorAgentNode = {
  identifier: 'supervisor-agent',
  displayName: 'Supervisor Agent',
  name: 'supervisor-agent',
  group: ['ai', 'agent', 'orchestration'],
  version: 1,
  description: 'Orchestrates multiple AI agents to accomplish complex tasks through delegation',
  ai: {
    description: "A supervisor agent that coordinates multiple worker agents. Analyzes tasks, delegates to specialists, and aggregates results.",
    useCases: [
      "Complex research requiring multiple data sources",
      "Content creation with research, writing, and editing phases",
      "Customer support routing to specialized agents",
      "Code review with security, performance, and style checks"
    ],
    tags: ["supervisor", "multi-agent", "orchestration", "delegation", "coordinator"],
    rules: [
      "MUST connect a model node to modelService input",
      "MUST connect at least one worker agent to agentService input",
      "MAY connect a memory node for shared conversation context"
    ],
    recommendations: {
      connectsAfter: ["chat", "webhook", "manual-trigger"],
      inputs: {
        modelService: ["openai-model", "anthropic-model"],
        agentService: ["worker-agent"],
        memoryService: ["buffer-memory", "window-memory"]
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
4. Ask follow-up questions to workers if their responses are incomplete`,
      description: 'Instructions that define how the supervisor coordinates agents',
      typeOptions: { rows: 6 },
    },
    {
      displayName: 'User Message',
      name: 'userMessage',
      type: 'expression',
      required: true,
      default: '',
      description: 'The task or message to process',
      placeholder: 'Enter the task or use {{json.field}}',
      typeOptions: { rows: 3 },
    },
    {
      displayName: 'Routing Strategy',
      name: 'routingStrategy',
      type: 'options',
      required: false,
      default: 'auto',
      description: 'How the supervisor decides which agent(s) to use',
      options: [
        { name: 'Auto (Supervisor Decides)', value: 'auto' },
        { name: 'Broadcast (All Agents)', value: 'broadcast' },
        { name: 'Sequential (Chain)', value: 'sequential' },
      ],
    },
    {
      displayName: 'Max Iterations',
      name: 'maxIterations',
      type: 'number',
      required: false,
      default: 5,
      description: 'Maximum supervisor reasoning iterations',
      typeOptions: { minValue: 1, maxValue: 20 },
    },
    {
      displayName: 'Max Delegations',
      name: 'maxDelegations',
      type: 'number',
      required: false,
      default: 10,
      description: 'Maximum total delegations to worker agents',
      typeOptions: { minValue: 1, maxValue: 50 },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          name: 'aggregationMode',
          displayName: 'Result Aggregation',
          type: 'options',
          default: 'synthesize',
          options: [
            { name: 'Synthesize (AI Summary)', value: 'synthesize' },
            { name: 'Concatenate', value: 'concatenate' },
            { name: 'Best Result', value: 'best' },
            { name: 'Structured', value: 'structured' },
          ],
        },
        {
          name: 'parallelExecution',
          displayName: 'Parallel Execution',
          type: 'boolean',
          default: true,
        },
        {
          name: 'shareContext',
          displayName: 'Share Context Between Agents',
          type: 'boolean',
          default: true,
        },
        {
          name: 'sessionId',
          displayName: 'Session ID',
          type: 'string',
          default: '',
          placeholder: '{{json.userId}}',
        },
        {
          name: 'timeout',
          displayName: 'Timeout (ms)',
          type: 'number',
          default: 600000,
          typeOptions: { minValue: 10000, maxValue: 1800000 },
        },
      ],
    },
  ],

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

  _discoverModelNode: async function() {
    const inputData = await this.getInputData?.('modelService');
    if (!inputData?.modelService || !Array.isArray(inputData.modelService) || inputData.modelService.length === 0) {
      throw new Error('Supervisor Agent requires a connected Model node');
    }
    const serviceNodeRef = inputData.modelService[0];
    const nodeDefinition = await global.nodeService.getNodeDefinition(serviceNodeRef.type);
    const boundNode = Object.create(nodeDefinition);
    boundNode._serviceNodeId = serviceNodeRef.nodeId;
    boundNode._executionId = this._executionId;
    boundNode._userId = this.userId;
    boundNode.logger = this.logger;
    boundNode.getNodeParameter = (paramName) => serviceNodeRef.parameters?.[paramName];
    boundNode.getCredentials = async (credentialType) => {
      let credentialId = Array.isArray(serviceNodeRef.credentials) ? serviceNodeRef.credentials[0] : this._getCredentialId(serviceNodeRef, credentialType);
      if (!credentialId) throw new Error(`No credential of type '${credentialType}' available`);
      return await global.credentialService.getCredentialForExecution(credentialId, this.userId || 'unknown');
    };
    if (!boundNode.chat || typeof boundNode.chat !== 'function') throw new Error('Invalid Model node: missing chat method');
    return boundNode;
  },

  _discoverAgentNodes: async function() {
    const agentNodes = [];
    const inputData = await this.getInputData?.('agentService');
    if (!inputData?.agentService || !Array.isArray(inputData.agentService) || inputData.agentService.length === 0) {
      throw new Error('Supervisor Agent requires at least one connected worker agent');
    }
    for (const serviceNodeRef of inputData.agentService) {
      try {
        const nodeDefinition = await global.nodeService.getNodeDefinition(serviceNodeRef.type);
        const boundNode = Object.create(nodeDefinition);
        boundNode._serviceNodeId = serviceNodeRef.nodeId;
        boundNode._executionId = this._executionId;
        boundNode._userId = this.userId;
        boundNode._config = serviceNodeRef.parameters || {};
        boundNode._inputData = serviceNodeRef.inputData || {};
        boundNode.logger = this.logger;
        boundNode.getNodeParameter = (paramName) => serviceNodeRef.parameters?.[paramName];
        boundNode.getInputData = async (inputName) => {
          if (serviceNodeRef.inputData?.[inputName]) return { [inputName]: serviceNodeRef.inputData[inputName] };
          return null;
        };
        boundNode.getCredentials = async (credentialType) => {
          const credentialId = this._getCredentialId(serviceNodeRef, credentialType);
          if (!credentialId) throw new Error(`No credential of type '${credentialType}' available`);
          return await global.credentialService.getCredentialForExecution(credentialId, this.userId || 'unknown');
        };
        agentNodes.push(boundNode);
      } catch (error) {
        this.logger?.error('[Supervisor] Failed to discover agent', { type: serviceNodeRef.type, error: error.message });
      }
    }
    if (agentNodes.length === 0) throw new Error('No valid worker agents found');
    return agentNodes;
  },

  _discoverMemoryNode: async function() {
    const inputData = await this.getInputData?.('memoryService');
    if (!inputData?.memoryService || !Array.isArray(inputData.memoryService) || inputData.memoryService.length === 0) return null;
    try {
      const serviceNodeRef = inputData.memoryService[0];
      const nodeDefinition = await global.nodeService.getNodeDefinition(serviceNodeRef.type);
      const boundNode = Object.create(nodeDefinition);
      boundNode._serviceNodeId = serviceNodeRef.nodeId;
      boundNode.logger = this.logger;
      boundNode.getNodeParameter = (paramName) => serviceNodeRef.parameters?.[paramName];
      if (!boundNode.getMessages || typeof boundNode.getMessages !== 'function') return null;
      return boundNode;
    } catch (error) {
      this.logger?.warn('[Supervisor] Failed to discover memory node', { error: error.message });
      return null;
    }
  },

  execute: async function(_inputData) {
    const startTime = Date.now();
    this._executionId = this.logger?.executionId || 'unknown';

    try {
      const systemPrompt = await this.getNodeParameter('systemPrompt');
      const userMessage = await this.getNodeParameter('userMessage');
      const routingStrategy = await this.getNodeParameter('routingStrategy') || 'auto';
      const maxIterations = await this.getNodeParameter('maxIterations') || 5;
      const maxDelegations = await this.getNodeParameter('maxDelegations') || 10;
      const options = (await this.getNodeParameter('options')) || {};

      if (!userMessage) throw new Error('User message is required');

      const modelNode = await this._discoverModelNode();
      const agentNodes = await this._discoverAgentNodes();
      const memoryNode = await this._discoverMemoryNode();

      const context = {
        modelNode,
        agentNodes,
        memoryNode,
        systemPrompt,
        userMessage,
        maxIterations,
        maxDelegations,
        routingStrategy,
        aggregationMode: options.aggregationMode || 'synthesize',
        parallelExecution: options.parallelExecution !== false,
        shareContext: options.shareContext !== false,
        sessionId: (options.sessionId && options.sessionId.trim()) || 'default',
        timeout: options.timeout || 600000,
        logger: this.logger,
        logCall: this.logCall,
        emitNodeEvent: this._emitNodeEvent.bind(this),
        executionId: this._executionId,
        supervisorModel: modelNode,
      };

      const result = await executeSupervisor(context);
      return [{ main: [{ json: result }] }];
    } catch (error) {
      this.logger?.error('[Supervisor] Execution failed', { error: error.message, duration: Date.now() - startTime });
      throw new Error(`Supervisor Agent failed: ${error.message}`);
    }
  },
};

module.exports = SupervisorAgentNode;

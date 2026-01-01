/**
 * Worker Agent Node
 * 
 * A specialized agent designed to be called by a Supervisor Agent.
 * Unlike the regular AI Agent, this node doesn't have a main input -
 * it receives tasks programmatically from the Supervisor.
 */

const { executeWorkerTask, getWorkerAgentDefinition } = require('./modes/worker');

const WorkerAgentNode = {
  identifier: 'worker-agent',
  nodeCategory: 'service',
  displayName: 'Worker Agent',
  name: 'worker-agent',
  group: ['ai', 'agent', 'orchestration'],
  version: 1,
  description: 'Specialized agent for multi-agent orchestration - receives tasks from Supervisor',
  ai: {
    description: "A worker agent designed to be orchestrated by a Supervisor Agent. Configure its specialty via system prompt and connect appropriate tools.",
    useCases: [
      "Research specialist in a multi-agent team",
      "Code writer in a development pipeline",
      "Data analyst in a processing workflow",
      "Content editor in a creation pipeline"
    ],
    tags: ["worker", "agent", "multi-agent", "specialist", "delegation"],
    rules: [
      "MUST be connected to a Supervisor Agent's agentService input",
      "MUST connect a model node to modelService input",
      "Configure system prompt to define the agent's specialty"
    ],
    recommendations: {
      connectsTo: ["supervisor-agent"],
      inputs: {
        modelService: ["openai-model", "anthropic-model"],
        memoryService: ["buffer-memory", "window-memory"],
        toolService: ["http-request-tool", "calculator-tool"]
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
  inputs: ['modelService', 'memoryService', 'toolService'],
  outputs: ['agentService'],
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
      typeOptions: { rows: 4 },
    },
    {
      displayName: 'Max Iterations',
      name: 'maxIterations',
      type: 'number',
      required: false,
      default: 10,
      description: 'Maximum number of agent loop iterations',
      typeOptions: { minValue: 1, maxValue: 30 },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          name: 'toolChoice',
          displayName: 'Tool Choice',
          type: 'options',
          default: 'auto',
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
        },
        {
          name: 'timeout',
          displayName: 'Timeout (ms)',
          type: 'number',
          default: 120000,
          typeOptions: { minValue: 5000, maxValue: 300000 },
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

  _bindServiceNode: async function(serviceNodeRef, nodeType) {
    if (!global.nodeService) throw new Error('Node service not available');
    const nodeDefinition = await global.nodeService.getNodeDefinition(serviceNodeRef.type);
    const boundNode = Object.create(nodeDefinition);
    boundNode._serviceNodeId = serviceNodeRef.nodeId;
    boundNode._executionId = this._executionId;
    boundNode._userId = this._userId;
    boundNode.logger = this.logger;
    boundNode.getNodeParameter = (paramName) => serviceNodeRef.parameters?.[paramName];
    boundNode.getCredentials = async (credentialType) => {
      let credentialId = Array.isArray(serviceNodeRef.credentials) ? serviceNodeRef.credentials[0] : this._getCredentialId(serviceNodeRef, credentialType);
      if (!credentialId) throw new Error(`No credential of type '${credentialType}' available`);
      return await global.credentialService.getCredentialForExecution(credentialId, this._userId || 'unknown');
    };
    if (nodeType === 'model' && (!boundNode.chat || typeof boundNode.chat !== 'function')) throw new Error('Invalid Model node');
    if (nodeType === 'tool' && (!boundNode.getDefinition || !boundNode.executeTool)) throw new Error('Invalid Tool node');
    return boundNode;
  },

  _discoverModelNode: async function() {
    let inputData = await this.getInputData?.('modelService');
    if ((!inputData || !inputData.modelService) && this._inputData?.modelService) {
      inputData = { modelService: this._inputData.modelService };
    }
    if (!inputData?.modelService || !Array.isArray(inputData.modelService) || inputData.modelService.length === 0) {
      throw new Error('Worker Agent requires a connected Model node');
    }
    return await this._bindServiceNode(inputData.modelService[0], 'model');
  },

  _discoverToolNodes: async function() {
    const toolNodes = [];
    let inputData = await this.getInputData?.('toolService');
    if ((!inputData || !inputData.toolService) && this._inputData?.toolService) {
      inputData = { toolService: this._inputData.toolService };
    }
    if (!inputData?.toolService || !Array.isArray(inputData.toolService)) return toolNodes;
    for (const serviceNodeRef of inputData.toolService) {
      try {
        const boundNode = await this._bindServiceNode(serviceNodeRef, 'tool');
        if (boundNode.getDefinition && boundNode.executeTool) toolNodes.push(boundNode);
      } catch (error) {
        this.logger?.error('[Worker Agent] Failed to bind tool', { error: error.message });
      }
    }
    return toolNodes;
  },

  getAgentDefinition: function() {
    return getWorkerAgentDefinition({
      agentName: this.getNodeParameter?.('name') || 'Worker Agent',
      specialty: this.getNodeParameter?.('specialty') || 'General Assistant',
      systemPrompt: this.getNodeParameter?.('systemPrompt'),
    });
  },

  executeTask: async function(task, options = {}) {
    let modelNode = null;
    try {
      modelNode = await this._discoverModelNode();
    } catch (error) {
      if (options.fallbackModel) {
        modelNode = options.fallbackModel;
        this.logger?.info('[Worker Agent] Using supervisor model as fallback');
      }
    }

    let toolNodes = [];
    try {
      toolNodes = await this._discoverToolNodes();
    } catch (error) {
      this.logger?.debug('[Worker Agent] No tools available');
    }

    const nodeOptions = this.getNodeParameter?.('options') || {};

    const context = {
      modelNode,
      toolNodes,
      systemPrompt: this.getNodeParameter?.('systemPrompt') || 'You are a helpful AI assistant.',
      maxIterations: this.getNodeParameter?.('maxIterations') || 10,
      toolChoice: nodeOptions.toolChoice || 'auto',
      timeout: nodeOptions.timeout || 120000,
      agentName: this.getNodeParameter?.('name') || 'Worker Agent',
      includeSharedContext: nodeOptions.includeSharedContext !== false,
      logger: this.logger,
      logCall: this.logCall,
      emitNodeEvent: this._emitNodeEvent.bind(this),
      executionId: this._executionId,
    };

    return await executeWorkerTask(context, task, options);
  },

  execute: async function(_inputData) {
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

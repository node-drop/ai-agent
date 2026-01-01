/**
 * Supervisor Mode Execution
 * 
 * Orchestrates multiple AI agents to accomplish complex tasks.
 * Acts as a "manager" that delegates work to specialized worker agents.
 */

const { AgentStateManager } = require('../../utils/agentLoopUtilities');

/**
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

  completeDelegation(delegationId, result) {
    const delegation = this.delegationHistory.find(d => d.delegationId === delegationId);
    if (delegation) {
      delegation.status = result.success !== false ? 'completed' : 'failed';
      delegation.result = result;
      delegation.duration = Date.now() - delegation.timestamp;
      this.agentResults.set(delegation.agentId, result);
    }
  }

  hasReachedMaxDelegations() {
    return this.delegationCount >= this.maxDelegations;
  }

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

/**
 * Execute supervisor mode
 */
async function executeSupervisor(context) {
  const {
    modelNode,
    agentNodes,
    memoryNode,
    systemPrompt,
    userMessage,
    maxIterations,
    maxDelegations,
    routingStrategy,
    aggregationMode,
    parallelExecution,
    shareContext,
    sessionId,
    timeout,
    logger,
    logCall,
    emitNodeEvent,
    executionId,
  } = context;

  const startTime = Date.now();

  logger?.info('[Supervisor] Starting execution', {
    agentCount: agentNodes.length,
    routingStrategy,
    maxDelegations,
  });

  // Initialize state manager
  const stateManager = new SupervisorStateManager(sessionId, maxIterations, maxDelegations);

  // Store model for worker agents
  const supervisorModel = modelNode;

  // Execute based on routing strategy
  let result;

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Supervisor execution timed out after ${timeout}ms`)), timeout);
  });

  const executionPromise = (async () => {
    switch (routingStrategy) {
      case 'broadcast':
        const broadcastResults = await executeBroadcast(context, agentNodes, userMessage, stateManager, { parallelExecution, shareContext });
        return await aggregateResults(context, broadcastResults, aggregationMode, userMessage);

      case 'sequential':
        const sequentialResults = await executeSequential(context, agentNodes, userMessage, stateManager, { shareContext });
        return await aggregateResults(context, sequentialResults, aggregationMode, userMessage);

      case 'auto':
      default:
        return await executeAuto(context, agentNodes, userMessage, stateManager, { parallelExecution, shareContext });
    }
  })();

  result = await Promise.race([executionPromise, timeoutPromise]);

  const duration = Date.now() - startTime;

  logger?.info('[Supervisor] Execution completed', {
    duration,
    delegations: stateManager.delegationCount,
  });

  return {
    response: result.response,
    success: true,
    metadata: {
      routingStrategy,
      aggregationMode,
      duration,
      ...stateManager.getDelegationMetadata(),
      iterations: result.iterations || stateManager.currentIteration,
    },
    summary: result.summary,
  };
}

/**
 * Build delegation tools for the supervisor
 */
function buildDelegationTools(agentNodes, sanitizeToolName) {
  const tools = [];

  for (const agent of agentNodes) {
    const agentConfig = agent._config || {};
    let agentName = agentConfig.name || agent.displayName || 'Worker Agent';
    if (typeof agentName === 'string' && agentName.startsWith('=')) {
      agentName = agentConfig.specialty || agent.displayName || 'Worker Agent';
    }

    let agentDescription = agentConfig.specialty || agentConfig.description;
    if (!agentDescription && agentConfig.systemPrompt) {
      let prompt = agentConfig.systemPrompt;
      if (typeof prompt === 'string' && prompt.startsWith('=')) {
        prompt = prompt.substring(1).trim();
      }
      agentDescription = prompt.substring(0, 200);
    }
    agentDescription = agentDescription || 'A worker agent';

    tools.push({
      name: `delegate_to_${sanitizeToolName(agentName)}`,
      description: `Delegate a task to ${agentName}. ${agentDescription}`,
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'The specific task or question to delegate' },
          context: { type: 'string', description: 'Additional context (optional)' },
          expectedOutput: { type: 'string', description: 'Expected response type (optional)' },
        },
        required: ['task'],
      },
      _agentRef: agent,
      _agentName: agentName,
    });
  }

  // Add final_answer tool
  tools.push({
    name: 'final_answer',
    description: 'Provide the final synthesized answer. Use when you have gathered enough information.',
    parameters: {
      type: 'object',
      properties: {
        answer: { type: 'string', description: 'The final comprehensive answer' },
        summary: { type: 'string', description: 'Brief summary (optional)' },
      },
      required: ['answer'],
    },
    _isFinalAnswer: true,
  });

  return tools;
}

/**
 * Build supervisor system prompt with agent roster
 */
function buildSupervisorPrompt(basePrompt, agentNodes) {
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
}

/**
 * Execute delegation to a worker agent
 */
async function executeDelegation(context, tool, args, stateManager, sharedContext) {
  const { logger, logCall, emitNodeEvent, supervisorModel } = context;
  const startTime = Date.now();
  const agent = tool._agentRef;
  const agentName = tool._agentName;

  if (stateManager.hasReachedMaxDelegations()) {
    return { success: false, error: `Maximum delegations (${stateManager.maxDelegations}) reached` };
  }

  const delegationId = stateManager.recordDelegation(
    agent._serviceNodeId || 'unknown',
    agentName,
    args.task
  );

  emitNodeEvent('node-started', agent, { nodeName: agentName });

  logger?.info('[Supervisor] Delegating to agent', {
    agentName,
    task: args.task.substring(0, 100),
  });

  try {
    let workerMessage = args.task;
    if (args.context) {
      workerMessage = `Context: ${args.context}\n\nTask: ${args.task}`;
    }
    if (args.expectedOutput) {
      workerMessage += `\n\nExpected output: ${args.expectedOutput}`;
    }

    // Add shared context
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

    // Execute worker agent
    const agentResult = await executeWorkerAgent(context, agent, workerMessage, sharedContext, supervisorModel);
    const duration = Date.now() - startTime;

    stateManager.completeDelegation(delegationId, {
      success: true,
      response: agentResult.response,
      agentName,
      duration,
    });

    emitNodeEvent('node-completed', agent, { nodeName: agentName });

    if (logCall) {
      logCall(`Agent: ${agentName}`, { task: args.task.substring(0, 200) }, { response: agentResult.response?.substring(0, 500) }, duration, { type: 'service-call' });
    }

    return {
      success: true,
      agentName,
      response: agentResult.response,
      metadata: agentResult.metadata,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    emitNodeEvent('node-failed', agent, { nodeName: agentName, error: { message: error.message } });

    if (logCall) {
      logCall(`Agent: ${agentName}`, { task: args.task.substring(0, 200) }, null, duration, { error: error.message, type: 'service-call' });
    }

    stateManager.completeDelegation(delegationId, {
      success: false,
      error: error.message,
      agentName,
      duration,
    });

    return {
      success: false,
      agentName,
      error: `Agent ${agentName} failed: ${error.message}`,
    };
  }
}

/**
 * Execute a worker agent
 */
async function executeWorkerAgent(context, agent, message, sharedContext, supervisorModel) {
  const { logger, executionId } = context;

  // Check if agent has executeTask method (Worker Agent)
  if (agent.executeTask && typeof agent.executeTask === 'function') {
    logger?.debug('[Supervisor] Calling Worker Agent executeTask');
    return await agent.executeTask(message, {
      sharedContext,
      sessionId: `supervisor_${executionId}_${Date.now()}`,
      fallbackModel: supervisorModel,
    });
  }

  // Fallback: Use supervisor's model directly
  logger?.warn('[Supervisor] Agent does not have executeTask method, using supervisor model');

  if (!supervisorModel) {
    throw new Error('No model available for worker agent execution');
  }

  const agentConfig = agent._config || {};
  const messages = [];

  if (agentConfig.systemPrompt) {
    messages.push({ role: 'system', content: agentConfig.systemPrompt });
  }
  messages.push({ role: 'user', content: message });

  const response = await supervisorModel.chat(messages, [], undefined);

  return {
    success: true,
    response: response.content,
    agentName: agentConfig.name || 'Agent',
    metadata: { iterations: 1, usedSupervisorModel: true },
  };
}

/**
 * Execute broadcast strategy - send to all agents
 */
async function executeBroadcast(context, agentNodes, message, stateManager, options) {
  const results = [];
  const sharedContext = { previousResults: [] };
  const tools = buildDelegationTools(agentNodes, sanitizeToolName);
  const delegationTools = tools.filter(t => !t._isFinalAnswer);

  if (options.parallelExecution) {
    const promises = delegationTools.map(tool =>
      executeDelegation(context, tool, { task: message }, stateManager, sharedContext)
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
        results.push({ success: false, error: result.reason?.message || 'Unknown error' });
      }
    }
  } else {
    for (const tool of delegationTools) {
      const result = await executeDelegation(context, tool, { task: message }, stateManager, sharedContext);
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
}

/**
 * Execute sequential strategy - chain agents
 */
async function executeSequential(context, agentNodes, message, stateManager, options) {
  const results = [];
  let currentMessage = message;
  const tools = buildDelegationTools(agentNodes, sanitizeToolName);
  const delegationTools = tools.filter(t => !t._isFinalAnswer);

  for (const tool of delegationTools) {
    const result = await executeDelegation(
      context,
      tool,
      {
        task: currentMessage,
        context: results.length > 0 ? `Previous agent output: ${results[results.length - 1].response}` : undefined,
      },
      stateManager,
      { previousResults: results.map(r => ({ agentName: r.agentName, result: r.response })) }
    );

    results.push(result);

    if (result.success) {
      currentMessage = `Based on this input: "${result.response}"\n\nContinue the task: ${message}`;
    }
  }

  return results;
}

/**
 * Execute auto strategy - supervisor decides
 */
async function executeAuto(context, agentNodes, message, stateManager, options) {
  const { modelNode, systemPrompt, logger, logCall, emitNodeEvent } = context;
  const tools = buildDelegationTools(agentNodes, sanitizeToolName);
  const sharedContext = { previousResults: [] };

  const supervisorPrompt = buildSupervisorPrompt(systemPrompt || '', agentNodes);

  const messages = [
    { role: 'system', content: supervisorPrompt },
    { role: 'user', content: message },
  ];

  let iteration = 0;
  const maxIterations = stateManager.maxIterations;

  while (iteration < maxIterations) {
    iteration++;
    stateManager.incrementIteration();

    const toolDefinitions = tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    emitNodeEvent('node-started', modelNode, { nodeName: 'Model' });

    const modelCallStart = Date.now();
    let response;
    try {
      response = await modelNode.chat(messages, toolDefinitions, 'auto');
    } catch (error) {
      emitNodeEvent('node-failed', modelNode, { nodeName: 'Model', error: { message: error.message } });
      throw error;
    }
    const modelCallDuration = Date.now() - modelCallStart;

    emitNodeEvent('node-completed', modelNode, { nodeName: 'Model' });

    if (logCall) {
      logCall('Model', { messageCount: messages.length, toolCount: toolDefinitions.length }, { hasToolCalls: !!(response.toolCalls?.length) }, modelCallDuration);
    }

    // No tool calls - direct response
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return {
        response: response.content,
        delegations: stateManager.getDelegationMetadata(),
        iterations: iteration,
      };
    }

    // Process tool calls
    for (const toolCall of response.toolCalls) {
      const tool = tools.find(t => t.name === toolCall.name);
      const toolCallId = toolCall.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      if (!tool) {
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [{ id: toolCallId, type: 'function', function: { name: toolCall.name, arguments: JSON.stringify(toolCall.arguments) } }],
        });
        messages.push({
          role: 'tool',
          content: JSON.stringify({ error: `Unknown tool: ${toolCall.name}` }),
          tool_call_id: toolCallId,
        });
        continue;
      }

      // Final answer tool
      if (tool._isFinalAnswer) {
        return {
          response: toolCall.arguments.answer,
          summary: toolCall.arguments.summary,
          delegations: stateManager.getDelegationMetadata(),
          iterations: iteration,
        };
      }

      // Execute delegation
      const result = await executeDelegation(context, tool, toolCall.arguments, stateManager, sharedContext);

      if (result.success) {
        sharedContext.previousResults.push({
          agentName: result.agentName,
          result: result.response,
        });
      }

      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: [{ id: toolCallId, type: 'function', function: { name: toolCall.name, arguments: JSON.stringify(toolCall.arguments) } }],
      });
      messages.push({
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: toolCallId,
      });
    }
  }

  return {
    response: 'Supervisor reached maximum iterations. Partial results collected.',
    delegations: stateManager.getDelegationMetadata(),
    iterations: iteration,
    maxIterationsReached: true,
  };
}

/**
 * Aggregate results from multiple agents
 */
async function aggregateResults(context, results, aggregationMode, originalMessage) {
  const { modelNode } = context;
  const successfulResults = results.filter(r => r.success);

  if (successfulResults.length === 0) {
    return { response: 'No successful responses from worker agents', success: false };
  }

  switch (aggregationMode) {
    case 'concatenate':
      return {
        response: successfulResults.map(r => `**${r.agentName}:**\n${r.response}`).join('\n\n---\n\n'),
        success: true,
      };

    case 'best':
      const pickBestPrompt = `Given these responses to "${originalMessage}", pick the best one:\n\n${successfulResults.map((r, i) => `Response ${i + 1} (${r.agentName}):\n${r.response}`).join('\n\n')}\n\nReturn only the best response content.`;
      const bestResponse = await modelNode.chat([{ role: 'user', content: pickBestPrompt }], [], undefined);
      return { response: bestResponse.content, success: true };

    case 'structured':
      return {
        response: JSON.stringify(Object.fromEntries(successfulResults.map(r => [r.agentName, r.response])), null, 2),
        success: true,
        structured: true,
      };

    case 'synthesize':
    default:
      const synthesizePrompt = `Synthesize responses from multiple AI agents to answer: "${originalMessage}"\n\nAgent responses:\n${successfulResults.map(r => `**${r.agentName}:**\n${r.response}`).join('\n\n')}\n\nCreate a comprehensive, unified response.`;
      const synthesizedResponse = await modelNode.chat([{ role: 'user', content: synthesizePrompt }], [], undefined);
      return { response: synthesizedResponse.content, success: true };
  }
}

/**
 * Sanitize agent name for tool name
 */
function sanitizeToolName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);
}

module.exports = {
  executeSupervisor,
  SupervisorStateManager,
};

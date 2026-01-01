/**
 * Worker Mode Execution
 * 
 * A specialized agent designed to be called by a Supervisor Agent.
 * Receives tasks programmatically from the Supervisor, not from workflow input.
 */

const { AgentStateManager, AgentErrorHandler } = require('../../utils/agentLoopUtilities');

/**
 * Execute task from Supervisor (called programmatically)
 * This is the main method called by the Supervisor Agent
 * 
 * @param {Object} context - Execution context
 * @param {string} task - The task/message to process
 * @param {Object} options - Execution options from Supervisor
 * @returns {Promise<Object>} Execution result
 */
async function executeWorkerTask(context, task, options = {}) {
  const {
    modelNode,
    toolNodes,
    systemPrompt,
    maxIterations,
    toolChoice,
    timeout,
    agentName,
    logger,
    logCall,
    emitNodeEvent,
    executionId,
  } = context;

  const startTime = Date.now();

  logger?.info('[Worker Agent] Executing task', {
    agentName,
    task: task.substring(0, 100),
    hasContext: !!options.context,
    hasSharedContext: !!options.sharedContext,
  });

  try {
    const includeSharedContext = context.includeSharedContext !== false;

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

    // Use provided model or fallback
    let activeModel = modelNode;
    if (!activeModel && options.fallbackModel) {
      activeModel = options.fallbackModel;
      logger?.info('[Worker Agent] Using supervisor model as fallback');
    }

    if (!activeModel) {
      throw new Error('No model available. Connect a Model node to the Worker Agent.');
    }

    // Build messages
    const messages = [
      { role: 'system', content: systemPrompt || 'You are a helpful AI assistant.' },
      { role: 'user', content: userMessage },
    ];

    // Get tool definitions
    const tools = (toolNodes || []).map(node => node.getDefinition());

    // Execute agent loop with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Worker agent timed out')), timeout || 120000);
    });

    const executionPromise = executeWorkerLoop(
      context,
      activeModel,
      messages,
      tools,
      toolNodes || [],
      toolChoice || 'auto',
      maxIterations || 10
    );

    const result = await Promise.race([executionPromise, timeoutPromise]);
    const duration = Date.now() - startTime;

    logger?.info('[Worker Agent] Task completed', {
      agentName,
      duration,
      iterations: result.iterations,
      toolsUsed: result.toolsUsed,
    });

    return {
      success: true,
      response: result.response,
      agentName,
      metadata: {
        iterations: result.iterations,
        toolsUsed: result.toolsUsed,
        duration,
      },
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    logger?.error('[Worker Agent] Task failed', {
      agentName,
      error: error.message,
      duration,
    });

    return {
      success: false,
      error: error.message,
      agentName,
      metadata: { duration },
    };
  }
}

/**
 * Execute the worker agent loop
 */
async function executeWorkerLoop(context, modelNode, messages, tools, toolNodes, toolChoice, maxIterations) {
  const { logger, logCall, emitNodeEvent } = context;
  let iteration = 0;
  const toolsUsed = [];

  while (iteration < maxIterations) {
    iteration++;

    // Emit node-started for the model
    emitNodeEvent('node-started', modelNode, { nodeName: 'Model' });

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
      emitNodeEvent('node-failed', modelNode, { nodeName: 'Model', error: { message: error.message } });
      throw error;
    }
    const modelCallDuration = Date.now() - modelCallStart;

    emitNodeEvent('node-completed', modelNode, { nodeName: 'Model' });

    if (logCall) {
      logCall('Model', {
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
      const toolResult = await executeWorkerToolCall(context, toolCall, toolNodes);

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
}

/**
 * Execute a tool call in worker mode
 */
async function executeWorkerToolCall(context, toolCall, toolNodes) {
  const { logger, logCall, emitNodeEvent } = context;

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
  emitNodeEvent('node-started', toolNode, { nodeName: toolCall.name });

  try {
    const result = await toolNode.executeTool(toolCall.arguments);
    const duration = Date.now() - startTime;

    emitNodeEvent('node-completed', toolNode, { nodeName: toolCall.name });

    if (logCall) {
      logCall(toolCall.name, toolCall.arguments, result, duration, { type: 'tool-call' });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    emitNodeEvent('node-failed', toolNode, { nodeName: toolCall.name, error: { message: error.message } });

    if (logCall) {
      logCall(toolCall.name, toolCall.arguments, null, duration, { error: error.message, type: 'tool-call' });
    }

    return {
      success: false,
      error: `Tool execution error: ${error.message}`,
    };
  }
}

/**
 * Get agent definition for Supervisor
 * Returns metadata about this agent's capabilities
 */
function getWorkerAgentDefinition(context) {
  const { agentName, specialty, systemPrompt } = context;
  return {
    name: agentName || 'Worker Agent',
    specialty: specialty || 'General Assistant',
    description: systemPrompt?.substring(0, 200) || '',
    identifier: 'ai-agent',
  };
}

module.exports = {
  executeWorkerTask,
  getWorkerAgentDefinition,
};

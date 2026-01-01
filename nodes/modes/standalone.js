/**
 * Standalone Mode Execution
 * 
 * Standard AI Agent behavior - receives input, processes with model and tools,
 * returns response. This is the default mode.
 */

const {
  AgentStateManager,
  ToolCallTracker,
  AgentErrorHandler,
} = require('../../utils/agentLoopUtilities');

/**
 * Execute standalone agent mode
 * @param {Object} context - Execution context with helpers and parameters
 * @returns {Promise<Object>} Execution result
 */
async function executeStandalone(context) {
  const {
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
    outputFormat,
    timeout,
    // Helper functions from node context
    logger,
    logCall,
    emitNodeEvent,
    filterMessagesForStorage,
    getNodeParameter,
  } = context;

  const startTime = Date.now();

  // Initialize agent state
  const stateManager = new AgentStateManager(sessionId, maxIterations);
  const toolTracker = new ToolCallTracker();

  try {
    // Step 1: Clear memory if requested
    if (memoryNode && sessionId) {
      const shouldClearMemory = await getNodeParameter?.('options.clearMemory');
      if (shouldClearMemory) {
        logger?.info('[AI Agent] Clearing memory for session', { sessionId });
        try {
          await memoryNode.clear(sessionId);
        } catch (error) {
          logger?.warn('[AI Agent] Failed to clear memory', { error: error.message });
        }
      }
    }

    // Step 2: Load conversation history from Memory node
    if (memoryNode && sessionId) {
      const memoryStartTime = Date.now();
      try {
        emitNodeEvent('node-started', memoryNode, { nodeName: 'Memory' });
        const history = await memoryNode.getMessages(sessionId);
        const memoryDuration = Date.now() - memoryStartTime;
        emitNodeEvent('node-completed', memoryNode, { nodeName: 'Memory' });

        if (logCall) {
          logCall('Memory (Load)', 
            { sessionId, operation: 'getMessages' },
            { messageCount: history?.length || 0, hasHistory: !!(history && history.length > 0) },
            memoryDuration
          );
        }

        if (history && history.length > 0) {
          const filteredHistory = filterMessagesForStorage(history);
          stateManager.setMessages(filteredHistory);
          logger?.info('[AI Agent] Loaded conversation history', {
            messageCount: filteredHistory.length,
            sessionId,
          });
        }
      } catch (error) {
        const memoryDuration = Date.now() - memoryStartTime;
        emitNodeEvent('node-failed', memoryNode, { nodeName: 'Memory', error: { message: error.message } });
        if (logCall) {
          logCall('Memory (Load)', { sessionId }, null, memoryDuration, { error: error.message });
        }
        logger?.warn('[AI Agent] Memory load failed', { error: error.message });
      }
    }

    // Step 3: Add system prompt if first message
    const messages = stateManager.getMessages();
    if (messages.length === 0 && systemPrompt) {
      stateManager.addMessage({
        role: 'system',
        content: systemPrompt,
        timestamp: Date.now(),
      });
    }

    // Step 4: Add user message
    stateManager.addMessage({
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    });

    logger?.info('[AI Agent] Starting agent loop', {
      maxIterations,
      toolChoice,
      toolCount: toolNodes.length,
    });

    // Step 5: Main agent loop
    while (!stateManager.hasReachedMaxIterations()) {
      const iteration = stateManager.incrementIteration();

      // Get available tools
      const tools = toolChoice === 'none' ? [] : toolNodes.map(toolNode => toolNode.getDefinition());

      // Call model
      const modelResponse = await callModelWithRetry(context, stateManager, tools, toolChoice, outputSchema, schemaName, schemaDescription);

      // Add assistant message to history
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
        logger?.info('[AI Agent] Executing tool calls', {
          toolCallCount: modelResponse.toolCalls.length,
          tools: modelResponse.toolCalls.map(tc => tc.name),
        });

        // Execute each tool call
        for (const toolCall of modelResponse.toolCalls) {
          const toolCallId = toolCall.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          toolCall.id = toolCallId;

          const trackingId = toolTracker.startTracking(toolCall.name, toolCall.arguments);

          try {
            const toolResult = await executeToolCall(context, toolCall, toolNodes, stateManager);

            // Check if tool requires human input
            if (toolResult.requiresHumanInput && toolResult._pauseExecution) {
              return handleHumanInputPause(context, stateManager, toolTracker, toolResult, toolCall, memoryNode, sessionId);
            }

            toolTracker.completeTracking(trackingId, toolResult);

            stateManager.addMessage({
              role: 'tool',
              content: JSON.stringify(toolResult),
              timestamp: Date.now(),
              toolCallId: toolCall.id,
            });
          } catch (error) {
            const toolResult = AgentErrorHandler.handleToolError(toolCall.name, error);
            toolTracker.completeTracking(trackingId, toolResult);

            stateManager.addMessage({
              role: 'tool',
              content: JSON.stringify(toolResult),
              timestamp: Date.now(),
              toolCallId: toolCall.id,
            });

            logger?.warn('[AI Agent] Tool execution failed', {
              toolName: toolCall.name,
              error: error.message,
            });
          }
        }

        continue;
      }

      // No tool calls - we have final answer
      logger?.info('[AI Agent] Agent loop completed', {
        iterations: iteration,
        finishReason: modelResponse.finishReason,
      });

      stateManager.markCompleted();

      // Save conversation to Memory node
      if (memoryNode && sessionId) {
        await saveToMemory(context, stateManager, memoryNode, sessionId);
      }

      // Parse structured data if schema was provided
      let structuredData = null;
      if (outputSchema && modelResponse.content) {
        try {
          structuredData = JSON.parse(modelResponse.content);
        } catch (error) {
          logger?.warn('[AI Agent] Failed to parse structured output', { error: error.message });
        }
      }

      return {
        response: modelResponse.content,
        structuredData,
        metadata: {
          ...stateManager.getMetadata(),
          toolCalls: toolTracker.getRecords(),
          totalTokens: modelResponse.usage?.totalTokens || 0,
          finishReason: modelResponse.finishReason,
          duration: Date.now() - startTime,
        },
      };
    }

    // Max iterations reached
    stateManager.markMaxIterations();
    const errorInfo = AgentErrorHandler.handleMaxIterations(maxIterations);
    throw new Error(errorInfo.message);

  } catch (error) {
    stateManager.markFailed();
    throw error;
  }
}

/**
 * Call model with retry logic
 */
async function callModelWithRetry(context, stateManager, tools, toolChoice, outputSchema, schemaName, schemaDescription) {
  const { modelNode, logger, logCall, emitNodeEvent } = context;
  const maxRetries = 2;
  let retryCount = 0;
  const startTime = Date.now();

  emitNodeEvent('node-started', modelNode, { nodeName: 'Model' });

  while (retryCount <= maxRetries) {
    try {
      const messages = stateManager.getMessages();
      const shouldUseTools = tools.length > 0 && toolChoice !== 'none';

      const chatOptions = {
        tools: shouldUseTools ? tools : [],
        toolChoice: shouldUseTools ? toolChoice : undefined,
      };

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

      const callStartTime = Date.now();
      const modelResponse = await modelNode.chat(
        messages,
        chatOptions.tools,
        chatOptions.toolChoice,
        chatOptions.responseFormat
      );
      const callDuration = Date.now() - callStartTime;

      if (logCall) {
        logCall('Model', {
          messageCount: messages.length,
          toolCount: tools.length,
        }, {
          hasContent: !!modelResponse.content,
          hasToolCalls: !!(modelResponse.toolCalls && modelResponse.toolCalls.length > 0),
        }, callDuration);
      }

      emitNodeEvent('node-completed', modelNode, { nodeName: 'Model' });
      return modelResponse;

    } catch (error) {
      const errorInfo = AgentErrorHandler.handleModelError(error);
      const duration = Date.now() - startTime;

      if (AgentErrorHandler.isRecoverable(errorInfo) && retryCount < maxRetries) {
        retryCount++;
        const delay = AgentErrorHandler.getRetryDelay(errorInfo, retryCount);
        logger?.warn('[AI Agent] Model call failed, retrying', { error: errorInfo.message, retryCount, delayMs: delay });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (logCall) {
        logCall('Model', { messageCount: stateManager.getMessages().length }, null, duration, { error: errorInfo.message });
      }

      emitNodeEvent('node-failed', modelNode, {
        nodeName: 'Model',
        error: { message: errorInfo.message, type: errorInfo.type },
      });

      throw new Error(errorInfo.message);
    }
  }
}

/**
 * Execute a tool call
 */
async function executeToolCall(context, toolCall, toolNodes, stateManager) {
  const { logger, logCall, emitNodeEvent, validateToolArguments } = context;
  const startTime = Date.now();

  const toolNode = toolNodes.find(node => {
    const definition = node.getDefinition();
    return definition.name === toolCall.name;
  });

  if (!toolNode) {
    const error = `Tool '${toolCall.name}' not found`;
    const duration = Date.now() - startTime;
    if (logCall) logCall(toolCall.name, toolCall.arguments, null, duration, { error, type: 'tool-call' });
    return { success: false, error };
  }

  const toolDefinition = toolNode.getDefinition();

  // Validate arguments
  if (validateToolArguments) {
    const validation = validateToolArguments(toolCall.arguments, toolDefinition.parameters);
    if (!validation.valid) {
      const error = `Tool argument validation failed: ${validation.error}`;
      const duration = Date.now() - startTime;
      if (logCall) logCall(toolCall.name, toolCall.arguments, null, duration, { error, type: 'tool-call' });
      return { success: false, error };
    }
  }

  stateManager.recordToolUsage(toolCall.name);
  emitNodeEvent('node-started', toolNode, { nodeName: toolDefinition.name });

  try {
    const result = await toolNode.executeTool(toolCall.arguments);
    const duration = Date.now() - startTime;

    if (logCall) logCall(toolCall.name, toolCall.arguments, result, duration, { type: 'tool-call' });
    emitNodeEvent('node-completed', toolNode, { nodeName: toolDefinition.name });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    if (logCall) logCall(toolCall.name, toolCall.arguments, null, duration, { error: error.message, type: 'tool-call' });
    emitNodeEvent('node-failed', toolNode, { nodeName: toolDefinition.name, error: { message: error.message } });
    throw error;
  }
}

/**
 * Handle human input pause
 */
async function handleHumanInputPause(context, stateManager, toolTracker, toolResult, toolCall, memoryNode, sessionId) {
  const { logger, filterMessagesForStorage } = context;

  stateManager.addMessage({
    role: 'assistant',
    content: toolResult.question,
    timestamp: Date.now(),
    requiresHumanInput: true,
  });

  if (memoryNode && sessionId) {
    try {
      const messages = stateManager.getMessages();
      const messagesToSave = filterMessagesForStorage(messages);
      for (const message of messagesToSave) {
        await memoryNode.addMessage(sessionId, message);
      }
    } catch (error) {
      logger?.warn('[AI Agent] Failed to save to memory', { error: error.message });
    }
  }

  stateManager.markCompleted();

  return {
    response: toolResult.question,
    waitingForHumanInput: true,
    metadata: {
      ...stateManager.getMetadata(),
      toolCalls: toolTracker.getRecords(),
      status: 'waiting_for_human_input',
      pendingToolCall: {
        toolName: toolCall.name,
        toolCallId: toolCall.id,
        question: toolResult.originalQuestion,
      },
    },
  };
}

/**
 * Save conversation to memory
 */
async function saveToMemory(context, stateManager, memoryNode, sessionId) {
  const { logger, logCall, emitNodeEvent, filterMessagesForStorage } = context;
  const memorySaveStartTime = Date.now();

  try {
    emitNodeEvent('node-started', memoryNode, { nodeName: 'Memory' });

    const messages = stateManager.getMessages();
    const messagesToSave = filterMessagesForStorage(messages);

    for (const message of messagesToSave) {
      await memoryNode.addMessage(sessionId, message);
    }

    const memorySaveDuration = Date.now() - memorySaveStartTime;

    if (logCall) {
      logCall('Memory (Save)', 
        { sessionId, messageCount: messagesToSave.length },
        { saved: true },
        memorySaveDuration
      );
    }

    emitNodeEvent('node-completed', memoryNode, { nodeName: 'Memory' });
  } catch (error) {
    const memorySaveDuration = Date.now() - memorySaveStartTime;
    emitNodeEvent('node-failed', memoryNode, { nodeName: 'Memory', error: { message: error.message } });
    if (logCall) {
      logCall('Memory (Save)', { sessionId }, null, memorySaveDuration, { error: error.message });
    }
    logger?.warn('[AI Agent] Memory save failed', { error: error.message });
  }
}

module.exports = {
  executeStandalone,
};

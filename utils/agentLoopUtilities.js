/**
 * Agent loop utilities for managing execution state, tracking tool usage, and handling errors
 */

/**
 * Agent State Manager
 * Tracks the execution state of an agent during its loop
 */
class AgentStateManager {
  constructor(sessionId, maxIterations) {
    this.sessionId = sessionId;
    this.maxIterations = maxIterations;
    this.currentIteration = 0;
    this.messages = [];
    this.toolsUsed = [];
    this.startTime = Date.now();
    this.status = 'running';
  }

  /**
   * Increment the iteration counter
   * @returns {number} The new iteration count
   */
  incrementIteration() {
    this.currentIteration++;
    return this.currentIteration;
  }

  /**
   * Check if max iterations has been reached
   * @returns {boolean} True if max iterations reached
   */
  hasReachedMaxIterations() {
    return this.currentIteration >= this.maxIterations;
  }

  /**
   * Add a message to the state
   * @param {import('./interfaces').Message} message - Message to add
   */
  addMessage(message) {
    this.messages.push(message);
  }

  /**
   * Get all messages
   * @returns {import('./interfaces').Message[]} Array of messages
   */
  getMessages() {
    return this.messages;
  }

  /**
   * Set messages (e.g., when loading from memory)
   * @param {import('./interfaces').Message[]} messages - Messages to set
   */
  setMessages(messages) {
    this.messages = messages;
  }

  /**
   * Record that a tool was used
   * @param {string} toolName - Name of the tool
   */
  recordToolUsage(toolName) {
    if (!this.toolsUsed.includes(toolName)) {
      this.toolsUsed.push(toolName);
    }
  }

  /**
   * Get list of tools used
   * @returns {string[]} Array of tool names
   */
  getToolsUsed() {
    return this.toolsUsed;
  }

  /**
   * Mark the agent as completed
   */
  markCompleted() {
    this.status = 'completed';
  }

  /**
   * Mark the agent as failed
   */
  markFailed() {
    this.status = 'failed';
  }

  /**
   * Mark the agent as reaching max iterations
   */
  markMaxIterations() {
    this.status = 'max_iterations';
  }

  /**
   * Get the current status
   * @returns {'running' | 'completed' | 'failed' | 'max_iterations'} Current status
   */
  getStatus() {
    return this.status;
  }

  /**
   * Get execution duration in milliseconds
   * @returns {number} Duration in ms
   */
  getDuration() {
    return Date.now() - this.startTime;
  }

  /**
   * Get execution metadata
   * @returns {Object} Execution metadata
   */
  getMetadata() {
    return {
      sessionId: this.sessionId,
      iterations: this.currentIteration,
      toolsUsed: this.toolsUsed,
      duration: this.getDuration(),
      status: this.status,
    };
  }
}

/**
 * Tool Call Tracker
 * Records detailed information about tool executions
 */
class ToolCallTracker {
  constructor() {
    this.records = [];
  }

  /**
   * Start tracking a tool call
   * @param {string} toolName - Name of the tool
   * @param {Object} args - Arguments passed to the tool
   * @returns {string} Tracking ID for this call
   */
  startTracking(toolName, args) {
    const trackingId = `${toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.records.push({
      trackingId,
      toolName,
      arguments: args,
      result: null,
      timestamp: Date.now(),
      duration: null,
      status: 'pending',
    });

    return trackingId;
  }

  /**
   * Complete tracking for a tool call
   * @param {string} trackingId - The tracking ID
   * @param {import('./interfaces').ToolResult} result - The tool result
   */
  completeTracking(trackingId, result) {
    const record = this.records.find((r) => r.trackingId === trackingId);
    if (record) {
      record.result = result;
      record.duration = Date.now() - record.timestamp;
      record.status = result.success ? 'success' : 'failed';
    }
  }

  /**
   * Get all tool call records
   * @returns {Array} Array of tool call records
   */
  getRecords() {
    return this.records;
  }

  /**
   * Get summary statistics
   * @returns {Object} Summary statistics
   */
  getSummary() {
    const totalCalls = this.records.length;
    const successfulCalls = this.records.filter((r) => r.status === 'success').length;
    const failedCalls = this.records.filter((r) => r.status === 'failed').length;
    const totalDuration = this.records.reduce((sum, r) => sum + (r.duration || 0), 0);

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      averageDuration: totalCalls > 0 ? totalDuration / totalCalls : 0,
    };
  }
}

/**
 * Agent Error Handler
 * Classifies and handles different types of errors
 */
class AgentErrorHandler {
  /**
   * Handle model-related errors
   * @param {Error} error - The error object
   * @returns {Object} Structured error information
   */
  static handleModelError(error) {
    const errorMessage = error.message || String(error);

    // Authentication errors
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      return {
        type: 'INVALID_CREDENTIALS',
        message: 'Model authentication failed. Please check your API credentials.',
        recoverable: false,
        originalError: errorMessage,
      };
    }

    // Rate limit errors
    if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      return {
        type: 'RATE_LIMIT',
        message: 'Model rate limit exceeded. Please try again later.',
        recoverable: true,
        retryAfter: 60, // seconds
        originalError: errorMessage,
      };
    }

    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return {
        type: 'TIMEOUT',
        message: 'Model request timed out. Please try again.',
        recoverable: true,
        originalError: errorMessage,
      };
    }

    // Invalid request errors
    if (errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
      return {
        type: 'INVALID_REQUEST',
        message: 'Invalid request to model. Please check your parameters.',
        recoverable: false,
        originalError: errorMessage,
      };
    }

    // Generic model error
    return {
      type: 'MODEL_ERROR',
      message: `Model error: ${errorMessage}`,
      recoverable: true,
      originalError: errorMessage,
    };
  }

  /**
   * Handle tool execution errors
   * @param {string} toolName - Name of the tool that failed
   * @param {Error} error - The error object
   * @returns {import('./interfaces').ToolResult} Tool result with error
   */
  static handleToolError(toolName, error) {
    const errorMessage = error.message || String(error);

    return {
      success: false,
      error: `Tool '${toolName}' failed: ${errorMessage}`,
    };
  }

  /**
   * Handle memory operation errors
   * @param {Error} error - The error object
   * @returns {Object} Structured error information
   */
  static handleMemoryError(error) {
    const errorMessage = error.message || String(error);

    // Connection errors
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connection')) {
      return {
        type: 'MEMORY_CONNECTION_ERROR',
        message: 'Failed to connect to memory storage. Continuing without memory.',
        recoverable: true,
        originalError: errorMessage,
      };
    }

    // Generic memory error
    return {
      type: 'MEMORY_ERROR',
      message: `Memory operation failed: ${errorMessage}. Continuing without memory.`,
      recoverable: true,
      originalError: errorMessage,
    };
  }

  /**
   * Handle timeout errors
   * @param {number} timeout - The timeout value in milliseconds
   * @returns {Object} Structured error information
   */
  static handleTimeout(timeout) {
    return {
      type: 'EXECUTION_TIMEOUT',
      message: `Agent execution exceeded timeout of ${timeout}ms`,
      recoverable: false,
    };
  }

  /**
   * Handle max iterations reached
   * @param {number} maxIterations - The max iterations value
   * @returns {Object} Structured error information
   */
  static handleMaxIterations(maxIterations) {
    return {
      type: 'MAX_ITERATIONS',
      message: `Agent reached maximum iterations (${maxIterations}) without completing`,
      recoverable: false,
    };
  }

  /**
   * Determine if an error is recoverable with retry
   * @param {Object} errorInfo - Structured error information
   * @returns {boolean} True if error is recoverable
   */
  static isRecoverable(errorInfo) {
    return errorInfo.recoverable === true;
  }

  /**
   * Get retry delay for recoverable errors
   * @param {Object} errorInfo - Structured error information
   * @param {number} attemptNumber - Current retry attempt number
   * @returns {number} Delay in milliseconds
   */
  static getRetryDelay(errorInfo, attemptNumber) {
    // Use retryAfter if specified (e.g., for rate limits)
    if (errorInfo.retryAfter) {
      return errorInfo.retryAfter * 1000;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, etc.
    return Math.min(1000 * Math.pow(2, attemptNumber - 1), 30000);
  }
}

module.exports = {
  AgentStateManager,
  ToolCallTracker,
  AgentErrorHandler,
};

/**
 * Execution Pause Manager
 * 
 * Handles pausing and resuming agent executions for human-in-the-loop functionality.
 * Stores execution state in database and manages resume callbacks.
 */

class ExecutionPauseManager {
  constructor() {
    // In-memory store for pending human responses
    // Key: executionId, Value: { resolve, reject, timeout, timestamp }
    this.pendingResponses = new Map();
  }

  /**
   * Pause execution and wait for human response
   * @param {string} executionId - Execution ID
   * @param {Object} state - Current execution state to save
   * @param {number} timeoutSeconds - Timeout in seconds (0 = no timeout)
   * @returns {Promise<string>} User's response
   */
  async pauseForHumanInput(executionId, state, timeoutSeconds = 300) {
    return new Promise((resolve, reject) => {
      // Set up timeout if specified
      let timeoutHandle = null;
      if (timeoutSeconds > 0) {
        timeoutHandle = setTimeout(() => {
          this.pendingResponses.delete(executionId);
          reject(new Error(`Human response timeout after ${timeoutSeconds} seconds`));
        }, timeoutSeconds * 1000);
      }

      // Store the promise handlers
      this.pendingResponses.set(executionId, {
        resolve,
        reject,
        timeout: timeoutHandle,
        timestamp: Date.now(),
        state,
      });

      // Update execution status in database
      this._updateExecutionStatus(executionId, 'PAUSED', state).catch(error => {
        console.error('[ExecutionPauseManager] Failed to update execution status:', error);
      });
    });
  }

  /**
   * Resume execution with user's response
   * @param {string} executionId - Execution ID
   * @param {string} userResponse - User's response text
   * @returns {boolean} True if execution was resumed, false if not found
   */
  resumeWithResponse(executionId, userResponse) {
    const pending = this.pendingResponses.get(executionId);
    
    if (!pending) {
      console.warn('[ExecutionPauseManager] No pending execution found:', executionId);
      return false;
    }

    // Clear timeout
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }

    // Remove from pending
    this.pendingResponses.delete(executionId);

    // Update execution status in database
    this._updateExecutionStatus(executionId, 'RUNNING').catch(error => {
      console.error('[ExecutionPauseManager] Failed to update execution status:', error);
    });

    // Resolve the promise with user's response
    pending.resolve(userResponse);

    return true;
  }

  /**
   * Cancel a paused execution
   * @param {string} executionId - Execution ID
   * @param {string} reason - Cancellation reason
   * @returns {boolean} True if execution was cancelled, false if not found
   */
  cancelExecution(executionId, reason = 'Cancelled by user') {
    const pending = this.pendingResponses.get(executionId);
    
    if (!pending) {
      return false;
    }

    // Clear timeout
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }

    // Remove from pending
    this.pendingResponses.delete(executionId);

    // Update execution status in database
    this._updateExecutionStatus(executionId, 'CANCELLED').catch(error => {
      console.error('[ExecutionPauseManager] Failed to update execution status:', error);
    });

    // Reject the promise
    pending.reject(new Error(reason));

    return true;
  }

  /**
   * Check if execution is paused and waiting for response
   * @param {string} executionId - Execution ID
   * @returns {boolean} True if paused
   */
  isPaused(executionId) {
    return this.pendingResponses.has(executionId);
  }

  /**
   * Get paused execution info
   * @param {string} executionId - Execution ID
   * @returns {Object|null} Execution info or null
   */
  getPausedExecution(executionId) {
    const pending = this.pendingResponses.get(executionId);
    if (!pending) return null;

    return {
      executionId,
      timestamp: pending.timestamp,
      waitingTime: Date.now() - pending.timestamp,
      hasTimeout: !!pending.timeout,
    };
  }

  /**
   * Get all paused executions
   * @returns {Array} Array of paused execution info
   */
  getAllPausedExecutions() {
    const paused = [];
    for (const [executionId, pending] of this.pendingResponses.entries()) {
      paused.push({
        executionId,
        timestamp: pending.timestamp,
        waitingTime: Date.now() - pending.timestamp,
        hasTimeout: !!pending.timeout,
      });
    }
    return paused;
  }

  /**
   * Update execution status in database
   * @private
   */
  async _updateExecutionStatus(executionId, status, state = null) {
    try {
      // Access Prisma client from global
      if (!global.prisma) {
        console.warn('[ExecutionPauseManager] Prisma client not available');
        return;
      }

      const updateData = {
        status,
        updatedAt: new Date(),
      };

      if (status === 'PAUSED') {
        updateData.pausedAt = new Date();
        // Store state in flowProgressData
        if (state) {
          updateData.flowProgressData = state;
        }
      } else if (status === 'RUNNING') {
        updateData.resumedAt = new Date();
      }

      await global.prisma.execution.update({
        where: { id: executionId },
        data: updateData,
      });

      console.log('[ExecutionPauseManager] Updated execution status:', {
        executionId,
        status,
      });
    } catch (error) {
      console.error('[ExecutionPauseManager] Failed to update execution:', error);
      throw error;
    }
  }

  /**
   * Clean up old paused executions (called periodically)
   * @param {number} maxAgeMs - Maximum age in milliseconds
   */
  cleanupOldExecutions(maxAgeMs = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const toRemove = [];

    for (const [executionId, pending] of this.pendingResponses.entries()) {
      if (now - pending.timestamp > maxAgeMs) {
        toRemove.push(executionId);
      }
    }

    for (const executionId of toRemove) {
      this.cancelExecution(executionId, 'Execution expired');
    }

    if (toRemove.length > 0) {
      console.log('[ExecutionPauseManager] Cleaned up old executions:', toRemove.length);
    }
  }
}

// Create singleton instance
const executionPauseManager = new ExecutionPauseManager();

// Clean up old executions every hour
setInterval(() => {
  executionPauseManager.cleanupOldExecutions();
}, 60 * 60 * 1000);

module.exports = executionPauseManager;

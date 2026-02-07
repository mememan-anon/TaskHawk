/**
 * Execution Logger Module
 *
 * Tracks execution traces and state changes throughout task execution.
 * Supports persistent storage to Walrus.
 */

import { WalrusClient } from '../walrus/client.js';

/**
 * Execution state enumeration.
 * @readonly
 * @enum {string}
 */
export const ExecutionState = {
  PLANNING: 'planning',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * ExecutionLogger class for tracking task execution traces.
 * Stores execution state and step results in memory.
 */
export class ExecutionLogger {
  /**
   * Create a new ExecutionLogger instance.
   * @param {Object} options - Logger configuration options
   * @param {string} [options.sessionId] - Optional session identifier
   */
  constructor(options = {}) {
    this.sessionId = options.sessionId || this.generateSessionId();
    this.state = ExecutionState.PLANNING;
    this.trace = {
      sessionId: this.sessionId,
      goal: null,
      startTime: new Date().toISOString(),
      endTime: null,
      steps: [],
      finalResult: null,
      error: null
    };
  }

  /**
   * Generate a unique session ID.
   * @private
   * @returns {string} Unique session identifier
   */
  generateSessionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set the initial goal for this execution.
   * @param {string} goal - The natural language goal
   */
  setGoal(goal) {
    this.trace.goal = goal;
  }

  /**
   * Update the execution state.
   * @param {ExecutionState} newState - The new execution state
   * @throws {Error} If invalid state is provided
   */
  setState(newState) {
    if (!Object.values(ExecutionState).includes(newState)) {
      throw new Error(`Invalid state: ${newState}`);
    }
    this.state = newState;

    // Auto-set endTime on completion/failure
    if (newState === ExecutionState.COMPLETED || newState === ExecutionState.FAILED) {
      this.trace.endTime = new Date().toISOString();
    }
  }

  /**
   * Get the current execution state.
   * @returns {ExecutionState} Current state
   */
  getState() {
    return this.state;
  }

  /**
   * Log a single step execution.
   * @param {Object} step - The step that was executed
   * @param {Object} result - The result of step execution
   * @param {string} status - Status of the step ('success', 'error', 'skipped')
   * @param {string} [output] - Optional output text or data
   */
  logStep(step, result, status, output = null) {
    const stepLog = {
      stepIndex: this.trace.steps.length,
      stepName: step.name || step.id || `step_${this.trace.steps.length}`,
      stepType: step.type || 'unknown',
      status,
      timestamp: new Date().toISOString(),
      result,
      output,
      duration: step.duration || null
    };

    this.trace.steps.push(stepLog);
  }

  /**
   * Log an error during execution.
   * @param {Error|string} error - The error that occurred
   * @param {Object} [context] - Additional context about where the error occurred
   */
  logError(error, context = {}) {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : null;

    this.trace.error = {
      message: errorMessage,
      stack: errorStack,
      context,
      timestamp: new Date().toISOString()
    };

    this.setState(ExecutionState.FAILED);
  }

  /**
   * Set the final result of the entire execution.
   * @param {any} result - The final result
   */
  setFinalResult(result) {
    this.trace.finalResult = result;
  }

  /**
   * Get the complete execution trace.
   * @returns {Object} Full execution trace object
   */
  getTrace() {
    return { ...this.trace };
  }

  /**
   * Get a summary of the execution.
   * @returns {Object} Summary object with key metrics
   */
  getSummary() {
    const totalSteps = this.trace.steps.length;
    const successfulSteps = this.trace.steps.filter(s => s.status === 'success').length;
    const failedSteps = this.trace.steps.filter(s => s.status === 'error').length;

    return {
      sessionId: this.trace.sessionId,
      goal: this.trace.goal,
      state: this.state,
      startTime: this.trace.startTime,
      endTime: this.trace.endTime,
      totalSteps,
      successfulSteps,
      failedSteps,
      completed: this.state === ExecutionState.COMPLETED,
      failed: this.state === ExecutionState.FAILED
    };
  }

  /**
   * Export the trace as a formatted string for display.
   * @returns {string} Formatted trace output
   */
  formatTrace() {
    const lines = [];
    const summary = this.getSummary();

    lines.push(`\n╔═══════════════════════════════════════════════════════════════════╗`);
    lines.push(`║  MAD SNIPER EXECUTION TRACE                                        ║`);
    lines.push(`╠═══════════════════════════════════════════════════════════════════╣`);
    lines.push(`║ Session ID: ${summary.sessionId.padEnd(52)}║`);
    lines.push(`║ Goal: ${summary.goal?.padEnd(57)}║`);
    lines.push(`║ State: ${summary.state.padEnd(56)}║`);
    lines.push(`║ Start: ${summary.startTime.padEnd(55)}║`);
    lines.push(`║ End: ${summary.endTime || 'Running...'.padEnd(57)}║`);
    lines.push(`╠═══════════════════════════════════════════════════════════════════╣`);
    lines.push(`║  STEPS (${summary.totalSteps} total, ${summary.successfulSteps} success, ${summary.failedSteps} failed)${' '.repeat(20)}║`);
    lines.push(`╠═══════════════════════════════════════════════════════════════════╣`);

    this.trace.steps.forEach((step, idx) => {
      const statusIcon = step.status === 'success' ? '✓' : step.status === 'error' ? '✗' : '○';
      const stepLine = `║ [${idx}] ${statusIcon} ${step.stepName}: ${step.status}`.padEnd(70) + '║';
      lines.push(stepLine);
    });

    lines.push(`╚═══════════════════════════════════════════════════════════════════╝\n`);

    return lines.join('\n');
  }

  /**
   * Reset the logger for a new execution.
   * Preserves the session ID but clears all trace data.
   */
  reset() {
    this.state = ExecutionState.PLANNING;
    this.trace = {
      sessionId: this.sessionId,
      goal: null,
      startTime: new Date().toISOString(),
      endTime: null,
      steps: [],
      finalResult: null,
      error: null
    };
  }
}

/**
 * Create a new logger instance with optional configuration.
 * @param {Object} options - Logger options
 * @returns {ExecutionLogger} New logger instance
 */
export function createLogger(options = {}) {
  return new ExecutionLogger(options);
}

/**
 * PersistentLogger class extends ExecutionLogger with Walrus storage.
 * Stores task definitions and execution traces to decentralized storage.
 */
export class PersistentLogger extends ExecutionLogger {
  /**
   * Create a new PersistentLogger instance.
   * @param {Object} options - Logger configuration options
   * @param {string} [options.sessionId] - Optional session identifier
   * @param {WalrusClient} [options.walrusClient] - Custom Walrus client instance
   * @param {Object} [options.walrusConfig] - Walrus client configuration
   * @param {boolean} [options.autoStore=true] - Automatically store on completion
   * @param {boolean} [options.gracefulDegradation=true] - Continue if Walrus fails
   * @param {boolean} [options.verbose=false] - Enable verbose logging
   */
  constructor(options = {}) {
    super(options);

    // Initialize Walrus client
    this.walrus = options.walrusClient || new WalrusClient({
      verbose: options.verbose || false,
      ...options.walrusConfig
    });

    this.autoStore = options.autoStore !== false;
    this.gracefulDegradation = options.gracefulDegradation !== false;
    this.verbose = options.verbose || false;

    // Storage metadata
    this.storage = {
      taskId: null,
      taskBlobId: null,
      traceBlobId: null,
      storedAt: null,
      errors: []
    };
  }

  /**
   * Log debug information if verbose mode is enabled.
   * @private
   * @param {string} message - Message to log
   * @param {any} [data] - Optional data to log
   */
  debug(message, data = null) {
    if (this.verbose) {
      if (data !== null) {
        console.log(`[PersistentLogger] ${message}`, data);
      } else {
        console.log(`[PersistentLogger] ${message}`);
      }
    }
  }

  /**
   * Store task definition to Walrus.
   * @async
   * @param {string} taskId - Unique task identifier
   * @param {string} goal - Task goal/description
   * @param {Object} [metadata] - Additional metadata to store
   * @returns {Promise<Object>} Storage result
   */
  async storeTask(taskId, goal, metadata = {}) {
    this.debug(`Storing task: ${taskId}`);

    try {
      const result = await this.walrus.storeTask(taskId, goal, {
        sessionId: this.sessionId,
        createdAt: this.trace.startTime,
        ...metadata
      });

      this.storage.taskId = taskId;
      this.storage.taskBlobId = result.blobId;

      this.debug(`Task stored successfully: ${result.blobId}`);
      return result;

    } catch (error) {
      this.storage.errors.push({
        type: 'storeTask',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      this.debug(`Task storage failed: ${error.message}`);

      if (!this.gracefulDegradation) {
        throw new Error(`Failed to store task to Walrus: ${error.message}`);
      }

      // Graceful degradation - continue despite failure
      console.warn(`⚠️  Failed to store task to Walrus (continuing): ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Store execution trace to Walrus.
   * @async
   * @param {Object} [metadata] - Additional metadata to store
   * @returns {Promise<Object>} Storage result
   */
  async storeTrace(metadata = {}) {
    this.debug(`Storing trace for session: ${this.sessionId}`);

    // Ensure trace is complete
    const traceData = {
      ...this.trace,
      metadata: {
        storageTime: new Date().toISOString(),
        ...metadata
      }
    };

    try {
      const taskId = this.storage.taskId || this.sessionId;
      const result = await this.walrus.storeTrace(taskId, traceData, metadata);

      this.storage.traceBlobId = result.blobId;
      this.storage.storedAt = new Date().toISOString();

      this.debug(`Trace stored successfully: ${result.blobId}`);
      return result;

    } catch (error) {
      this.storage.errors.push({
        type: 'storeTrace',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      this.debug(`Trace storage failed: ${error.message}`);

      if (!this.gracefulDegradation) {
        throw new Error(`Failed to store trace to Walrus: ${error.message}`);
      }

      // Graceful degradation - continue despite failure
      console.warn(`⚠️  Failed to store trace to Walrus (continuing): ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Set the final result and optionally store to Walrus.
   * @async
   * @param {any} result - The final result
   * @param {Object} [options] - Storage options
   * @param {boolean} [options.store=true] - Whether to store to Walrus
   * @returns {Promise<Object>} Storage result if stored, null otherwise
   */
  async setFinalResult(result, options = {}) {
    // Set the result in the parent class
    super.setFinalResult(result);

    // Auto-store if enabled
    if (this.autoStore && options.store !== false) {
      const shouldStore = this.state === ExecutionState.COMPLETED ||
                          this.state === ExecutionState.FAILED;

      if (shouldStore) {
        return await this.storeTrace({
          state: this.state,
          resultSummary: typeof result === 'object' ? JSON.stringify(result).substring(0, 200) : String(result)
        });
      }
    }

    return null;
  }

  /**
   * Update the execution state and optionally store if completed.
   * @async
   * @param {ExecutionState} newState - The new execution state
   * @param {Object} [options] - Storage options
   * @param {boolean} [options.store=true] - Whether to auto-store on completion
   * @throws {Error} If invalid state is provided
   */
  async setState(newState, options = {}) {
    super.setState(newState);

    // Auto-store on completion/failure
    if (this.autoStore && options.store !== false) {
      if (newState === ExecutionState.COMPLETED || newState === ExecutionState.FAILED) {
        await this.storeTrace({
          state: newState
        });
      }
    }
  }

  /**
   * Log an error during execution (with optional storage).
   * @async
   * @param {Error|string} error - The error that occurred
   * @param {Object} [context] - Additional context
   * @returns {Promise<Object|null>} Storage result if auto-stored
   */
  async logError(error, context = {}) {
    super.logError(error, context);

    // Store trace on failure
    if (this.autoStore) {
      return await this.storeTrace({
        errorType: 'execution_error'
      });
    }

    return null;
  }

  /**
   * Get storage information for this session.
   * @returns {Object} Storage metadata
   */
  getStorageInfo() {
    return { ...this.storage };
  }

  /**
   * Check if the trace has been persisted to Walrus.
   * @returns {boolean} True if stored, false otherwise
   */
  isPersisted() {
    return this.storage.traceBlobId !== null;
  }

  /**
   * Retrieve a previously stored trace from Walrus.
   * @async
   * @param {string} blobId - The blob ID to retrieve
   * @returns {Promise<Object>} Retrieved trace data
   * @throws {Error} If retrieval fails
   */
  async retrieveTrace(blobId) {
    this.debug(`Retrieving trace: ${blobId}`);

    try {
      const result = await this.walrus.retrieve(blobId);

      if (result.data && result.data.trace) {
        return result.data.trace;
      }

      throw new Error('Invalid trace data retrieved');
    } catch (error) {
      this.debug(`Trace retrieval failed: ${error.message}`);
      throw new Error(`Failed to retrieve trace from Walrus: ${error.message}`);
    }
  }

  /**
   * Get the complete execution trace with storage information.
   * @returns {Object} Full execution trace with storage metadata
   */
  getTrace() {
    const trace = super.getTrace();
    return {
      ...trace,
      storage: this.getStorageInfo()
    };
  }

  /**
   * Export the trace as a formatted string for display.
   * @returns {string} Formatted trace output
   */
  formatTrace() {
    const baseOutput = super.formatTrace();
    const storageInfo = this.getStorageInfo();

    if (storageInfo.traceBlobId) {
      const storageLines = [];
      storageLines.push(`\n╠═══════════════════════════════════════════════════════════════════╣`);
      storageLines.push(`║  PERSISTENCE                                                        ║`);
      storageLines.push(`╠═══════════════════════════════════════════════════════════════════╣`);
      storageLines.push(`║ Task Blob ID: ${storageInfo.taskBlobId || 'N/A'.padEnd(48)}║`);
      storageLines.push(`║ Trace Blob ID: ${storageInfo.traceBlobId || 'N/A'.padEnd(47)}║`);
      storageLines.push(`║ Stored At: ${storageInfo.storedAt || 'N/A'.padEnd(52)}║`);

      if (storageInfo.errors.length > 0) {
        storageLines.push(`╠═══════════════════════════════════════════════════════════════════╣`);
        storageLines.push(`║  Storage Errors (${storageInfo.errors.length})${' '.repeat(41)}║`);
        storageLines.push(`╠═══════════════════════════════════════════════════════════════════╣`);

        storageInfo.errors.forEach((err, idx) => {
          const errorLine = `║ [${idx}] ${err.type}: ${err.error.substring(0, 50)}`.padEnd(70) + '║';
          storageLines.push(errorLine);
        });
      }

      storageLines.push(`╚═══════════════════════════════════════════════════════════════════╝`);

      return baseOutput + storageLines.join('\n');
    }

    return baseOutput;
  }

  /**
   * Test connectivity to Walrus storage.
   * @async
   * @returns {Promise<Object>} Test result
   */
  async testStorageConnectivity() {
    this.debug('Testing Walrus storage connectivity...');

    try {
      const result = await this.walrus.testConnectivity();

      if (result.success) {
        console.log(`✅ Walrus storage is accessible`);
        console.log(`   Blob ID: ${result.blobId}`);
        console.log(`   Duration: ${result.duration}ms`);
        console.log(`   Data Integrity: ${result.dataIntegrity ? '✓' : '✗'}`);
      } else {
        console.log(`⚠️  Walrus storage test failed: ${result.message}`);
      }

      return result;
    } catch (error) {
      this.debug(`Storage connectivity test failed: ${error.message}`);
      console.log(`⚠️  Storage connectivity test failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reset the logger for a new execution.
   * Preserves the session ID but clears all trace and storage data.
   */
  reset() {
    super.reset();

    this.storage = {
      taskId: null,
      taskBlobId: null,
      traceBlobId: null,
      storedAt: null,
      errors: []
    };
  }
}

/**
 * Create a new persistent logger instance with optional configuration.
 * @param {Object} options - Logger options
 * @returns {PersistentLogger} New logger instance
 */
export function createPersistentLogger(options = {}) {
  return new PersistentLogger(options);
}

/**
 * ActionExecutor Module
 *
 * Executes individual steps from the execution plan.
 * Dispatches actions to the BrowserController and handles data extraction.
 */

import { BrowserController } from './browser.js';

/**
 * ActionExecutor class for executing plan steps.
 * Manages the execution flow and handles various action types.
 */
export class ActionExecutor {
  /**
   * Create a new ActionExecutor instance.
   * @param {Object} options - Configuration options
   * @param {BrowserController} [options.browserController] - Custom browser controller
   * @param {Object} [options.logger] - Logger instance for tracking execution
   * @param {boolean} [options.verbose=false] - Enable verbose logging
   */
  constructor(options = {}) {
    this.browser = options.browserController || new BrowserController({
      verbose: options.verbose || false
    });
    this.logger = options.logger || null;
    this.verbose = options.verbose || false;
    this.context = {};
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
        console.log(`[ActionExecutor] ${message}`, data);
      } else {
        console.log(`[ActionExecutor] ${message}`);
      }
    }
  }

  /**
   * Execute a single step from the execution plan.
   * @async
   * @param {Object} step - Step to execute
   * @param {string} step.type - Action type (navigate, click, type, wait, extract)
   * @param {Object} step.params - Step parameters
   * @param {string} step.name - Step name for logging
   * @returns {Promise<Object>} Execution result
   * @throws {Error} If step execution fails
   */
  async executeStep(step) {
    if (!step || !step.type) {
      throw new Error('Invalid step: missing type');
    }

    this.debug(`Executing step: ${step.name || step.id}`, step);

    const startTime = Date.now();
    let result;
    let status = 'success';
    let error = null;

    try {
      switch (step.type) {
        case 'navigate':
          result = await this.navigate(step.params);
          break;

        case 'click':
          result = await this.click(step.params);
          break;

        case 'type':
          result = await this.type(step.params);
          break;

        case 'fill_form':
          result = await this.fillForm(step.params);
          break;

        case 'wait':
          result = await this.wait(step.params);
          break;

        case 'extract':
          result = await this.extractData(step);
          break;

        case 'snapshot':
          result = await this.snapshot(step.params);
          break;

        case 'submit':
          result = await this.submit(step.params);
          break;

        case 'select':
          result = await this.select(step.params);
          break;

        default:
          throw new Error(`Unknown action type: ${step.type}`);
      }

      const duration = Date.now() - startTime;
      this.debug(`Step completed in ${duration}ms`);

      // Log to logger if provided
      if (this.logger) {
        this.logger.logStep(step, result, status, result.output);
      }

      return {
        success: true,
        status,
        result,
        duration,
        step
      };

    } catch (err) {
      error = err;
      status = 'error';
      const duration = Date.now() - startTime;

      this.debug(`Step failed after ${duration}ms: ${err.message}`);

      // Log error to logger if provided
      if (this.logger) {
        this.logger.logStep(step, null, status, null);
        this.logger.logError(err, { step });
      }

      return {
        success: false,
        status,
        error: error.message,
        duration,
        step
      };
    }
  }

  /**
   * Execute multiple steps in sequence.
   * @async
   * @param {Array<Object>} steps - Steps to execute
   * @returns {Promise<Array<Object>>} Array of execution results
   */
  async executeSteps(steps) {
    const results = [];
    let failed = false;

    for (const step of steps) {
      const result = await this.executeStep(step);
      results.push(result);

      if (!result.success && !step.continueOnError) {
        failed = true;
        break;
      }
    }

    return {
      totalSteps: steps.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      completed: !failed,
      results
    };
  }

  /**
   * Navigate to a URL.
   * @async
   * @private
   * @param {Object} params - Navigation parameters
   * @param {string} params.url - URL to navigate to
   * @returns {Promise<Object>} Navigation result
   */
  async navigate(params) {
    const { url } = params;

    if (!url) {
      throw new Error('Navigate: missing url parameter');
    }

    this.debug(`Navigating to: ${url}`);

    const result = await this.browser.navigate(url);

    // Update context with current URL
    this.context.currentUrl = url;

    return {
      action: 'navigate',
      url,
      success: true,
      output: `Navigated to ${url}`
    };
  }

  /**
   * Click on an element.
   * @async
   * @private
   * @param {Object} params - Click parameters
   * @param {string} params.selector - Element selector or description
   * @param {boolean} [params.doubleClick] - Double click instead of single
   * @returns {Promise<Object>} Click result
   */
  async click(params) {
    const { selector, doubleClick } = params;

    if (!selector) {
      throw new Error('Click: missing selector parameter');
    }

    this.debug(`Clicking: ${selector}`);

    const result = await this.browser.click(selector, { doubleClick });

    return {
      action: 'click',
      selector,
      success: true,
      output: `Clicked on ${selector}`
    };
  }

  /**
   * Type text into an input field.
   * @async
   * @private
   * @param {Object} params - Type parameters
   * @param {string} params.selector - Element selector or description
   * @param {string} params.text - Text to type
   * @param {boolean} [params.slowly] - Type slowly (human-like)
   * @returns {Promise<Object>} Type result
   */
  async type(params) {
    const { selector, text, slowly } = params;

    if (!selector) {
      throw new Error('Type: missing selector parameter');
    }
    if (text === undefined || text === null) {
      throw new Error('Type: missing text parameter');
    }

    this.debug(`Typing into ${selector}: "${text}"`);

    const result = await this.browser.type(selector, text, { slowly });

    return {
      action: 'type',
      selector,
      text,
      success: true,
      output: `Typed "${text}" into ${selector}`
    };
  }

  /**
   * Fill multiple form fields.
   * @async
   * @private
   * @param {Object} params - Fill form parameters
   * @param {Object} params.fields - Object mapping selectors to values
   * @returns {Promise<Object>} Fill result
   */
  async fillForm(params) {
    const { fields } = params;

    if (!fields || typeof fields !== 'object') {
      throw new Error('Fill form: missing or invalid fields parameter');
    }

    this.debug(`Filling form with ${Object.keys(fields).length} fields`);

    const result = await this.browser.fillForm(fields);

    if (result.failed > 0) {
      throw new Error(`Failed to fill ${result.failed} fields: ${result.errors.map(e => e.selector).join(', ')}`);
    }

    return {
      action: 'fill_form',
      fields,
      success: true,
      output: `Filled ${result.successful} form fields`
    };
  }

  /**
   * Wait for a specified duration.
   * @async
   * @private
   * @param {Object} params - Wait parameters
   * @param {number} params.duration - Duration to wait in ms
   * @returns {Promise<Object>} Wait result
   */
  async wait(params) {
    const { duration = 1000 } = params;

    this.debug(`Waiting ${duration}ms`);

    await this.browser.wait(duration);

    return {
      action: 'wait',
      duration,
      success: true,
      output: `Waited ${duration}ms`
    };
  }

  /**
   * Take a snapshot of the current page.
   * @async
   * @private
   * @param {Object} [params] - Snapshot parameters
   * @returns {Promise<Object>} Snapshot result
   */
  async snapshot(params = {}) {
    this.debug('Taking snapshot');

    const result = await this.browser.snapshot(params);

    return {
      action: 'snapshot',
      success: true,
      output: 'Snapshot captured',
      data: result
    };
  }

  /**
   * Extract data from the current page.
   * @async
   * @param {Object} step - Step with extraction configuration
   * @param {Object} step.params - Extraction parameters
   * @param {string} step.params.selector - Element to extract from
   * @param {string} [step.params.attribute] - Attribute to extract (default: text)
   * @param {Array<string>} [step.params.selectors] - Multiple selectors for bulk extraction
   * @returns {Promise<Object>} Extraction result
   */
  async extractData(step) {
    const { params } = step;

    if (!params) {
      throw new Error('Extract: missing params');
    }

    this.debug('Extracting data from page');

    // Get snapshot
    const snapshot = await this.browser.snapshot({ refs: 'aria' });

    const extracted = {};
    const elements = snapshot.elements || {};

    // Single selector extraction
    if (params.selector) {
      const element = this.browser.findElement(params.selector, snapshot);

      if (element && elements[element.ref]) {
        const elemData = elements[element.ref];
        extracted[params.selector] = params.attribute
          ? elemData[params.attribute] || elemData.value || elemData.text
          : elemData.text || elemData.value || elemData.name;
      } else {
        extracted[params.selector] = null;
      }
    }

    // Multiple selectors extraction
    if (params.selectors && Array.isArray(params.selectors)) {
      for (const selector of params.selectors) {
        const element = this.browser.findElement(selector, snapshot);

        if (element && elements[element.ref]) {
          const elemData = elements[element.ref];
          extracted[selector] = params.attribute
            ? elemData[params.attribute] || elemData.value || elemData.text
            : elemData.text || elemData.value || elemData.name;
        } else {
          extracted[selector] = null;
        }
      }
    }

    // Store in context
    Object.assign(this.context, extracted);

    return {
      action: 'extract',
      extracted,
      success: true,
      output: `Extracted ${Object.keys(extracted).length} data points`,
      data: extracted
    };
  }

  /**
   * Submit a form (usually by clicking a submit button or pressing Enter).
   * @async
   * @private
   * @param {Object} params - Submit parameters
   * @param {string} [params.selector] - Submit button selector
   * @param {boolean} [params.pressEnter=false] - Use Enter key instead
   * @returns {Promise<Object>} Submit result
   */
  async submit(params) {
    const { selector, pressEnter } = params;

    if (pressEnter) {
      this.debug('Submitting with Enter key');
      // This would need to be implemented in BrowserController
      // For now, use click as fallback
    }

    if (selector) {
      return await this.click(params);
    }

    throw new Error('Submit: missing selector parameter');
  }

  /**
   * Select an option from a dropdown.
   * @async
   * @private
   * @param {Object} params - Select parameters
   * @param {string} params.selector - Dropdown selector
   * @param {string} params.value - Value to select
   * @returns {Promise<Object>} Select result
   */
  async select(params) {
    const { selector, value } = params;

    if (!selector) {
      throw new Error('Select: missing selector parameter');
    }
    if (!value) {
      throw new Error('Select: missing value parameter');
    }

    this.debug(`Selecting "${value}" from ${selector}`);

    // For simplicity, we click the selector then type the value
    // A real implementation would use proper dropdown selection
    await this.browser.click(selector);
    await this.browser.wait(200);
    await this.browser.type(selector, value);
    await this.browser.wait(200);

    return {
      action: 'select',
      selector,
      value,
      success: true,
      output: `Selected "${value}" from ${selector}`
    };
  }

  /**
   * Get the current execution context.
   * @returns {Object} Current context object
   */
  getContext() {
    return { ...this.context };
  }

  /**
   * Set a value in the execution context.
   * @param {string} key - Context key
   * @param {any} value - Context value
   */
  setContext(key, value) {
    this.context[key] = value;
    this.debug(`Set context: ${key} = ${value}`);
  }

  /**
   * Clear the execution context.
   */
  clearContext() {
    this.context = {};
    this.debug('Context cleared');
  }

  /**
   * Close the browser and cleanup resources.
   * @async
   * @returns {Promise<void>}
   */
  async close() {
    this.debug('Closing executor');
    await this.browser.close();
    this.clearContext();
  }
}

/**
 * Create a new ActionExecutor instance with default options.
 * @param {Object} options - Configuration options
 * @returns {ActionExecutor} New executor instance
 */
export function createActionExecutor(options = {}) {
  return new ActionExecutor(options);
}

/**
 * BrowserController Module
 *
 * Wraps OpenClaw's browser tool for automated web interactions.
 * Provides multi-strategy element finding and robust error handling.
 */

import { browser } from '../../browser-tool.js';

/**
 * BrowserController class for web automation.
 * Manages browser sessions and executes actions with retry logic.
 */
export class BrowserController {
  /**
   * Create a new BrowserController instance.
   * @param {Object} options - Configuration options
   * @param {string} [options.profile='openclaw'] - Browser profile to use
   * @param {number} [options.defaultTimeout=30000] - Default timeout in ms
   * @param {number} [options.maxRetries=3] - Maximum retry attempts for actions
   * @param {boolean} [options.verbose=false] - Enable verbose logging
   */
  constructor(options = {}) {
    this.profile = options.profile || 'openclaw';
    this.defaultTimeout = options.defaultTimeout || 30000;
    this.maxRetries = options.maxRetries || 3;
    this.verbose = options.verbose || false;
    this.currentTab = null;
    this.isStarted = false;
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
        console.log(`[BrowserController] ${message}`, data);
      } else {
        console.log(`[BrowserController] ${message}`);
      }
    }
  }

  /**
   * Start the browser session.
   * @async
   * @returns {Promise<Object>} Browser status
   * @throws {Error} If browser fails to start
   */
  async start() {
    if (this.isStarted) {
      this.debug('Browser already started');
      return { status: 'already_started' };
    }

    this.debug('Starting browser...');

    try {
      const result = await browser({
        action: 'start',
        profile: this.profile
      });

      if (result && result.status === 'ok') {
        this.isStarted = true;
        this.debug('Browser started successfully');
        return result;
      } else {
        throw new Error(`Failed to start browser: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      throw new Error(`Browser start failed: ${error.message}`);
    }
  }

  /**
   * Navigate to a URL.
   * @async
   * @param {string} url - The URL to navigate to
   * @param {Object} [options] - Navigation options
   * @param {number} [options.timeout] - Timeout in ms
   * @returns {Promise<Object>} Navigation result
   * @throws {Error} If navigation fails
   */
  async navigate(url, options = {}) {
    const timeout = options.timeout || this.defaultTimeout;

    if (!this.isStarted) {
      await this.start();
    }

    this.debug(`Navigating to: ${url}`);

    try {
      const result = await browser({
        action: 'navigate',
        targetUrl: url,
        profile: this.profile,
        timeoutMs: timeout
      });

      if (result && result.status === 'ok') {
        this.currentTab = result.targetId || result.tabId;
        this.debug(`Navigation successful, tab: ${this.currentTab}`);
        return result;
      } else {
        throw new Error(`Navigation failed: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      throw new Error(`Navigation error for ${url}: ${error.message}`);
    }
  }

  /**
   * Take a snapshot of the current page.
   * @async
   * @param {Object} [options] - Snapshot options
   * @param {string} [options.refs='role'] - Reference strategy ('role' or 'aria')
   * @param {number} [options.depth=3] - Traversal depth
   * @returns {Promise<Object>} Page snapshot
   * @throws {Error} If snapshot fails
   */
  async snapshot(options = {}) {
    const refs = options.refs || 'role';
    const depth = options.depth || 3;

    if (!this.isStarted) {
      throw new Error('Browser not started. Call start() or navigate() first.');
    }

    this.debug(`Taking snapshot (refs=${refs}, depth=${depth})`);

    try {
      const result = await browser({
        action: 'snapshot',
        profile: this.profile,
        targetId: this.currentTab,
        refs,
        depth
      });

      if (result && result.status === 'ok') {
        this.debug('Snapshot captured successfully');
        return result;
      } else {
        throw new Error(`Snapshot failed: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      throw new Error(`Snapshot error: ${error.message}`);
    }
  }

  /**
   * Find an element using multi-strategy approach.
   * @private
   * @param {string} selector - Element selector or description
   * @param {Object} snapshot - Page snapshot to search
   * @returns {Object|null} Element reference if found, null otherwise
   */
  findElement(selector, snapshot) {
    // Strategy 1: Check if selector is an aria reference
    if (selector.startsWith('aria-') || snapshot.elements?.[selector]) {
      this.debug(`Found element by aria ref: ${selector}`);
      return { ref: selector };
    }

    // Strategy 2: Search by role + name
    const elements = snapshot.elements || {};
    for (const [key, elem] of Object.entries(elements)) {
      if (elem.name?.toLowerCase().includes(selector.toLowerCase()) ||
          elem.label?.toLowerCase().includes(selector.toLowerCase()) ||
          elem.value?.toLowerCase().includes(selector.toLowerCase())) {
        this.debug(`Found element by role/name match: ${key}`);
        return { ref: key };
      }
    }

    // Strategy 3: Search by text content
    for (const [key, elem] of Object.entries(elements)) {
      if (elem.text?.toLowerCase().includes(selector.toLowerCase())) {
        this.debug(`Found element by text: ${key}`);
        return { ref: key };
      }
    }

    this.debug(`Element not found: ${selector}`);
    return null;
  }

  /**
   * Click on an element.
   * @async
   * @param {string} selector - Element selector or description
   * @param {Object} [options] - Click options
   * @param {boolean} [options.doubleClick=false] - Double click instead of single
   * @returns {Promise<Object>} Click result
   * @throws {Error} If click fails
   */
  async click(selector, options = {}) {
    if (!this.isStarted) {
      throw new Error('Browser not started. Call start() or navigate() first.');
    }

    this.debug(`Clicking: ${selector}`);

    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Get snapshot to find element
        const snapshot = await this.snapshot({ refs: 'aria' });
        const element = this.findElement(selector, snapshot);

        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }

        // Perform click
        const result = await browser({
          action: 'act',
          profile: this.profile,
          targetId: this.currentTab,
          request: {
            kind: 'click',
            ref: element.ref,
            doubleClick: options.doubleClick
          }
        });

        if (result && result.status === 'ok') {
          this.debug(`Click successful (attempt ${attempt})`);
          return result;
        } else {
          throw new Error(`Click failed: ${JSON.stringify(result)}`);
        }
      } catch (error) {
        lastError = error;
        this.debug(`Click attempt ${attempt} failed: ${error.message}`);

        if (attempt < this.maxRetries) {
          // Wait before retrying
          await this.wait(500 * attempt);
        }
      }
    }

    throw new Error(`Click failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Type text into an input field.
   * @async
   * @param {string} selector - Element selector or description
   * @param {string} text - Text to type
   * @param {Object} [options] - Type options
   * @param {boolean} [options.clearFirst=true] - Clear field before typing
   * @param {boolean} [options.slowly=false] - Type slowly (human-like)
   * @returns {Promise<Object>} Type result
   * @throws {Error} If typing fails
   */
  async type(selector, text, options = {}) {
    if (!this.isStarted) {
      throw new Error('Browser not started. Call start() or navigate() first.');
    }

    this.debug(`Typing "${text}" into: ${selector}`);

    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Get snapshot to find element
        const snapshot = await this.snapshot({ refs: 'aria' });
        const element = this.findElement(selector, snapshot);

        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }

        // Perform type action
        const result = await browser({
          action: 'act',
          profile: this.profile,
          targetId: this.currentTab,
          request: {
            kind: 'type',
            ref: element.ref,
            text,
            slowly: options.slowly || false
          }
        });

        if (result && result.status === 'ok') {
          this.debug(`Type successful (attempt ${attempt})`);
          return result;
        } else {
          throw new Error(`Type failed: ${JSON.stringify(result)}`);
        }
      } catch (error) {
        lastError = error;
        this.debug(`Type attempt ${attempt} failed: ${error.message}`);

        if (attempt < this.maxRetries) {
          await this.wait(500 * attempt);
        }
      }
    }

    throw new Error(`Type failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Fill multiple form fields at once.
   * @async
   * @param {Object} fields - Object mapping selectors to values
   * @returns {Promise<Object>} Result with filled field count
   * @throws {Error} If any field fill fails
   * @example
   * await fillForm({
   *   'Name': 'John Doe',
   *   'Email': 'john@example.com',
   *   'Message': 'Hello world'
   * });
   */
  async fillForm(fields) {
    if (!this.isStarted) {
      throw new Error('Browser not started. Call start() or navigate() first.');
    }

    this.debug(`Filling form with ${Object.keys(fields).length} fields`);

    const results = [];
    const errors = [];

    for (const [selector, value] of Object.entries(fields)) {
      try {
        const result = await this.type(selector, String(value));
        results.push({ selector, success: true });
        this.debug(`Filled field: ${selector}`);
      } catch (error) {
        errors.push({ selector, error: error.message });
        this.debug(`Failed to fill field: ${selector} - ${error.message}`);
      }
    }

    return {
      totalFields: Object.keys(fields).length,
      successful: results.length,
      failed: errors.length,
      results,
      errors
    };
  }

  /**
   * Wait for a specified duration.
   * @async
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise<void>}
   */
  async wait(ms) {
    this.debug(`Waiting ${ms}ms`);
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait for an element to appear on the page.
   * @async
   * @param {string} selector - Element to wait for
   * @param {Object} [options] - Wait options
   * @param {number} [options.timeout=10000] - Timeout in ms
   * @param {number} [options.interval=500] - Check interval in ms
   * @returns {Promise<Object>} Element when found
   * @throws {Error} If timeout is reached
   */
  async waitForElement(selector, options = {}) {
    const timeout = options.timeout || 10000;
    const interval = options.interval || 500;
    const startTime = Date.now();

    this.debug(`Waiting for element: ${selector}`);

    while (Date.now() - startTime < timeout) {
      const snapshot = await this.snapshot({ refs: 'aria' });
      const element = this.findElement(selector, snapshot);

      if (element) {
        this.debug(`Element found: ${selector}`);
        return element;
      }

      await this.wait(interval);
    }

    throw new Error(`Element not found within ${timeout}ms: ${selector}`);
  }

  /**
   * Close the browser session.
   * @async
   * @returns {Promise<Object>} Close result
   */
  async close() {
    if (!this.isStarted) {
      return { status: 'not_started' };
    }

    this.debug('Closing browser...');

    try {
      const result = await browser({
        action: 'stop',
        profile: this.profile
      });

      this.isStarted = false;
      this.currentTab = null;
      this.debug('Browser closed');

      return result;
    } catch (error) {
      throw new Error(`Browser close failed: ${error.message}`);
    }
  }
}

/**
 * Create a new BrowserController instance with default options.
 * @param {Object} options - Configuration options
 * @returns {BrowserController} New controller instance
 */
export function createBrowserController(options = {}) {
  return new BrowserController(options);
}

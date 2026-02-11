/**
 * OpenClaw Browser Tool Bridge
 *
 * This module provides a bridge between TaskHawk's BrowserController
 * and OpenClaw's browser automation tool.
 *
 * In the OpenClaw agent environment, the browser tool is available as
 * a function that can be called via the agent's tool system. This module
 * provides a wrapper that makes it accessible to the Node.js application.
 */

/**
 * Browser tool function - to be injected by OpenClaw environment.
 * This will be set to the actual browser function when running in OpenClaw.
 */
let browserTool = null;

/**
 * Flag to track if we're in an OpenClaw environment with browser tool access.
 */
let isOpenClawEnvironment = false;

/**
 * Mock browser responses for testing/demo when browser tool is unavailable.
 */
const mockResponses = {
  start: {
    status: 'ok',
    message: 'Browser started',
    timestamp: new Date().toISOString()
  },
  stop: {
    status: 'ok',
    message: 'Browser stopped',
    timestamp: new Date().toISOString()
  },
  navigate: {
    status: 'ok',
    message: 'Navigation successful',
    timestamp: new Date().toISOString()
  },
  snapshot: {
    status: 'ok',
    url: 'https://example.com',
    timestamp: new Date().toISOString(),
    elements: {}
  },
  act: {
    status: 'ok',
    timestamp: new Date().toISOString()
  }
};

/**
 * Initialize the browser tool bridge.
 * Call this with the actual browser function from OpenClaw.
 *
 * @param {Function} browserFn - The OpenClaw browser function
 */
export function initBrowserTool(browserFn) {
  if (typeof browserFn !== 'function') {
    throw new Error('Browser tool must be a function');
  }

  browserTool = browserFn;
  isOpenClawEnvironment = true;

  if (typeof globalThis !== 'undefined') {
    globalThis._openclawBrowserTool = browserFn;
  }

  console.log('[Browser Tool Bridge] Initialized with OpenClaw browser tool');
}

/**
 * Check if the browser tool is available.
 * @returns {boolean} True if browser tool is available
 */
export function isBrowserToolAvailable() {
  return isOpenClawEnvironment || browserTool !== null;
}

/**
 * Browser function wrapper.
 * Calls the OpenClaw browser tool if available, otherwise returns mock responses.
 *
 * @param {Object} params - Browser parameters
 * @param {string} params.action - Browser action (start, stop, navigate, snapshot, act, etc.)
 * @returns {Promise<Object>} Browser response
 */
export async function browser(params) {
  // Try to use OpenClaw browser tool first
  if (browserTool) {
    try {
      return await browserTool(params);
    } catch (error) {
      console.error('[Browser Tool Bridge] Browser tool error:', error.message);
      // Fall through to mock response
    }
  }

  // Check if browser function is available in global scope (OpenClaw agent)
  if (typeof globalThis !== 'undefined' && globalThis._openclawBrowserTool) {
    try {
      return await globalThis._openclawBrowserTool(params);
    } catch (error) {
      console.error('[Browser Tool Bridge] Global browser tool error:', error.message);
    }
  }

  // Fall back to mock responses for testing/demo
  console.warn(`[Browser Tool Bridge] Using mock response for action: ${params.action}`);

  const action = params.action || 'unknown';

  switch (action) {
    case 'start':
      return {
        ...mockResponses.start,
        profile: params.profile || 'openclaw'
      };

    case 'stop':
      return mockResponses.stop;

    case 'navigate':
      return {
        ...mockResponses.navigate,
        url: params.targetUrl,
        targetId: 'mock_tab_' + Date.now()
      };

    case 'snapshot':
      return {
        ...mockResponses.snapshot,
        elements: generateMockElements(),
        refs: params.refs || 'role',
        depth: params.depth || 3
      };

    case 'act':
      return {
        ...mockResponses.act,
        action: params.request?.kind || 'unknown',
        ref: params.request?.ref || 'unknown'
      };

    default:
      return {
        status: 'error',
        error: `Unknown action: ${action}`,
        action
      };
  }
}

/**
 * Generate mock page elements for snapshot.
 * @private
 * @returns {Object} Mock elements object
 */
function generateMockElements() {
  return {
    'aria-button-submit': {
      role: 'button',
      name: 'Submit',
      type: 'click',
      text: 'Submit'
    },
    'aria-button-search': {
      role: 'button',
      name: 'Search',
      type: 'click',
      text: 'Search'
    },
    'aria-input-email': {
      role: 'textbox',
      name: 'Email',
      type: 'type',
      placeholder: 'Enter email'
    },
    'aria-input-password': {
      role: 'textbox',
      name: 'Password',
      type: 'type',
      placeholder: 'Enter password'
    },
    'aria-input-search': {
      role: 'searchbox',
      name: 'Search',
      type: 'type',
      placeholder: 'Search...'
    },
    'aria-link-home': {
      role: 'link',
      name: 'Home',
      type: 'click',
      text: 'Home',
      url: '/'
    },
    'aria-select-country': {
      role: 'combobox',
      name: 'Country',
      type: 'select',
      value: ''
    },
    'aria-text-1': {
      role: 'text',
      name: '',
      type: 'text',
      text: 'Welcome to the demo page'
    },
    'aria-heading-1': {
      role: 'heading',
      name: 'Main Heading',
      type: 'text',
      level: 1,
      text: 'TaskHawk Demo'
    }
  };
}

/**
 * Get browser tool status.
 * @returns {Object} Status information
 */
export function getBrowserToolStatus() {
  return {
    available: isBrowserToolAvailable(),
    openClawEnvironment: isOpenClawEnvironment,
    hasBrowserFunction: browserTool !== null,
    hasGlobalBrowser: typeof globalThis !== 'undefined' && globalThis._openclawBrowserTool !== undefined
  };
}

/**
 * Reset the browser tool bridge (useful for testing).
 */
export function resetBrowserTool() {
  browserTool = null;
  isOpenClawEnvironment = false;

  if (typeof globalThis !== 'undefined') {
    delete globalThis._openclawBrowserTool;
  }

  console.log('[Browser Tool Bridge] Reset to default state');
}

// Export browser function as default for compatibility
export default browser;

/**
 * Browser Tool Stub
 *
 * This is a stub for the OpenClaw browser tool.
 * In a real OpenClaw environment, this is provided by the system.
 * This stub allows the code to run for testing purposes.
 */

/**
 * Mock browser function that simulates OpenClaw's browser tool.
 * @param {Object} params - Browser action parameters
 * @returns {Promise<Object>} Mock response
 */
export async function browser(params) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));

  const mockSnapshot = {
    status: 'ok',
    url: 'https://example.com',
    elements: {
      'aria-button-submit': {
        role: 'button',
        name: 'Submit',
        type: 'click'
      },
      'aria-input-email': {
        role: 'textbox',
        name: 'Email',
        type: 'type'
      },
      'aria-input-password': {
        role: 'textbox',
        name: 'Password',
        type: 'type'
      },
      'aria-link-home': {
        role: 'link',
        name: 'Home',
        text: 'Home',
        type: 'click'
      },
      'aria-select-country': {
        role: 'combobox',
        name: 'Country',
        type: 'select'
      }
    }
  };

  switch (params.action) {
    case 'start':
      return {
        status: 'ok',
        profile: params.profile || 'openclaw',
        message: 'Browser started'
      };

    case 'stop':
      return {
        status: 'ok',
        message: 'Browser stopped'
      };

    case 'navigate':
      return {
        status: 'ok',
        targetId: 'tab_' + Math.random().toString(36).substr(2, 9),
        url: params.targetUrl,
        message: `Navigated to ${params.targetUrl}`
      };

    case 'snapshot':
      return {
        ...mockSnapshot,
        refs: params.refs || 'role',
        depth: params.depth || 3
      };

    case 'act':
      return {
        status: 'ok',
        action: params.request.kind,
        ref: params.request.ref,
        message: `Action ${params.request.kind} executed on ${params.request.ref}`
      };

    default:
      return {
        status: 'error',
        message: `Unknown action: ${params.action}`
      };
  }
}

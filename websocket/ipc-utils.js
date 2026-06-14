/**
 * IPC Utilities Module
 * Handles IPC communication with timeouts and recovery suggestions
 */

const { ipcMain } = require('electron');
const { isRetryableError } = require('./error-recovery');

// ==========================================
// IPC Configuration
// ==========================================

/**
 * Default timeout for IPC responses (30 seconds)
 */
const IPC_DEFAULT_TIMEOUT = 30000;

// ==========================================
// IPC Communication
// ==========================================

/**
 * Execute an IPC request with timeout to prevent hanging promises
 * @param {Electron.WebContents} webContents - The webContents to send to
 * @param {string} sendChannel - The channel to send the request on
 * @param {string} responseChannel - The channel to listen for response on
 * @param {any} data - Data to send (optional)
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 * @returns {Promise<any>} The response from the renderer
 */
function ipcWithTimeout(webContents, sendChannel, responseChannel, data = null, timeout = IPC_DEFAULT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    let timeoutId;
    let resolved = false;

    const handler = (event, result) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      resolve(result);
    };

    ipcMain.once(responseChannel, handler);

    timeoutId = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      ipcMain.removeListener(responseChannel, handler);
      reject(new Error(`IPC timeout: No response from '${responseChannel}' within ${timeout}ms`));
    }, timeout);

    if (data !== null) {
      webContents.send(sendChannel, data);
    } else {
      webContents.send(sendChannel);
    }
  });
}

/**
 * Generate a recovery suggestion based on error type
 * @param {string} command - The failed command
 * @param {Error|string} error - The error that occurred
 * @param {string} managerName - The name of the manager that's unavailable
 * @returns {Object} Recovery suggestion object
 */
function generateRecoverySuggestion(command, error, managerName = null) {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  const suggestion = {
    error: errorMessage,
    recoverable: false,
    suggestion: '',
    alternativeCommands: []
  };

  // Manager unavailable errors
  if (managerName) {
    suggestion.recoverable = true;
    suggestion.suggestion = `The ${managerName} is not initialized. This may happen if the browser is still starting up. ` +
      `Try waiting a few seconds and retry the command. If the issue persists, the manager may have failed to initialize.`;
    suggestion.alternativeCommands = ['status', 'ping'];
    return suggestion;
  }

  // Network/connection errors
  if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('ECONNRESET')) {
    suggestion.recoverable = true;
    suggestion.suggestion = 'Network timeout or connection reset. Check your network connection and retry. ' +
      'For proxy-related issues, verify your proxy settings with get_proxy_status.';
    suggestion.alternativeCommands = ['get_proxy_status', 'status'];
  }
  // Element not found
  else if (errorMessage.includes('not found') || errorMessage.includes('no such element')) {
    suggestion.suggestion = 'Element not found on the page. Verify the selector is correct and the page has fully loaded. ' +
      'Use wait_for_element before interacting with dynamic content.';
    suggestion.alternativeCommands = ['wait_for_element', 'get_page_state', 'get_content'];
  }
  // Timeout waiting for element
  else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    suggestion.recoverable = true;
    suggestion.suggestion = 'Operation timed out. The page may be slow to load or the element may not exist. ' +
      'Increase the timeout parameter or check if the element exists.';
    suggestion.alternativeCommands = ['get_page_state', 'screenshot_viewport'];
  }
  // Navigation errors
  else if (errorMessage.includes('navigation') || errorMessage.includes('ERR_')) {
    suggestion.suggestion = 'Navigation failed. The URL may be invalid, blocked, or the server is unavailable. ' +
      'Check the URL and your network/proxy settings.';
    suggestion.alternativeCommands = ['get_url', 'get_proxy_status', 'status'];
  }
  // Permission/access errors
  else if (errorMessage.includes('permission') || errorMessage.includes('access denied')) {
    suggestion.suggestion = 'Permission denied. The operation may require authentication or the resource may be restricted.';
    suggestion.alternativeCommands = ['get_cookies', 'status'];
  }
  // Script execution errors
  else if (errorMessage.includes('script') || errorMessage.includes('JavaScript')) {
    suggestion.suggestion = 'Script execution failed. Check the script syntax and ensure the page context is correct.';
    suggestion.alternativeCommands = ['get_console_logs', 'get_page_state'];
  }
  // Generic recoverable errors
  else if (isRetryableError(error)) {
    suggestion.recoverable = true;
    suggestion.suggestion = 'A transient error occurred. The command may succeed if retried.';
  }
  // Unknown errors
  else {
    suggestion.suggestion = 'An unexpected error occurred. Check the browser console and logs for more details. ' +
      'Use the status command to verify the browser state.';
    suggestion.alternativeCommands = ['status', 'get_console_logs'];
  }

  return suggestion;
}

// ==========================================
// Exports
// ==========================================

module.exports = {
  IPC_DEFAULT_TIMEOUT,
  ipcWithTimeout,
  generateRecoverySuggestion
};

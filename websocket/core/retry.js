const ERROR_RECOVERY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // Base delay in ms (exponential backoff applied)
  retryableErrors: [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'EPIPE',
    'ENOTFOUND',
    'ENETUNREACH',
    'EAI_AGAIN',
    'TIMEOUT',
    'temporarily unavailable'
  ],
  // Commands that are safe to retry (idempotent operations)
  retryableCommands: [
    'get_url', 'get_content', 'get_page_state', 'screenshot', 'screenshot_viewport',
    'screenshot_full_page', 'screenshot_element', 'get_cookies', 'get_all_cookies',
    'list_sessions', 'list_tabs', 'get_tab_info', 'get_active_tab', 'get_history',
    'get_downloads', 'get_proxy_status', 'get_user_agent_status', 'status', 'ping',
    'get_network_logs', 'get_console_logs', 'list_profiles', 'get_profile',
    'get_storage_stats', 'get_local_storage', 'get_session_storage', 'list_scripts',
    'get_script', 'get_blocking_stats', 'get_devtools_status', 'get_console_status'
  ]
};

/**
 * Check if an error is transient/retryable
 * @param {Error|string} error - The error to check
 * @returns {boolean}
 */
function isRetryableError(error) {
  const errorMessage = error?.message || error?.toString() || '';
  return ERROR_RECOVERY_CONFIG.retryableErrors.some(
    retryableError => errorMessage.toLowerCase().includes(retryableError.toLowerCase())
  );
}

/**
 * Check if a command is safe to retry (idempotent)
 * @param {string} command - The command name
 * @returns {boolean}
 */
function isRetryableCommand(command) {
  return ERROR_RECOVERY_CONFIG.retryableCommands.includes(command);
}

/**
 * Calculate delay for retry with exponential backoff
 * @param {number} attempt - Current attempt number (0-based)
 * @returns {number} Delay in milliseconds
 */
function calculateRetryDelay(attempt) {
  return ERROR_RECOVERY_CONFIG.retryDelay * Math.pow(2, attempt);
}

/**
 * Sleep for specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

module.exports = {
  ERROR_RECOVERY_CONFIG,
  isRetryableError,
  isRetryableCommand,
  calculateRetryDelay,
  sleep,
  generateRecoverySuggestion
};

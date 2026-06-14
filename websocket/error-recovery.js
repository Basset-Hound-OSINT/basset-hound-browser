/**
 * Error Recovery Module
 * Handles retry logic, error classification, and recovery suggestions
 */

// ==========================================
// Error Recovery Configuration
// ==========================================

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

// ==========================================
// Exports
// ==========================================

module.exports = {
  ERROR_RECOVERY_CONFIG,
  isRetryableError,
  isRetryableCommand,
  calculateRetryDelay,
  sleep
};

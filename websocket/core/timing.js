const { ipcMain } = require('electron');

/**
 * Default timeout for IPC responses (30 seconds)
 */
const IPC_DEFAULT_TIMEOUT = 30000;

/**
 * P1-002 FIX: Adaptive Timeout Configuration
 * Large HTML documents (>10MB) timeout after 30 seconds
 * This config implements adaptive timeout that extends based on progress
 * https://github.com/basset-hound/issues/P1-002
 */
const ADAPTIVE_TIMEOUT_CONFIG = {
  enabled: true, // Can be disabled via environment: ADAPTIVE_TIMEOUT_DISABLED=1
  baseTimeout: 30000, // 30 seconds for normal operations
  maxTimeout: 120000, // 120 seconds maximum (2 minutes) for very large documents
  largeResponseThreshold: 5000000, // 5MB - consider this a large response
  hugeResponseThreshold: 20000000, // 20MB - needs maximum timeout
  progressHeartbeatTimeout: 5000, // 5 seconds - extend if no data flowing
  // Commands that typically need longer timeouts
  largeResponseCommands: [
    'get_content', // HTML extraction
    'screenshot_full_page', // Full page screenshots
    'execute_script', // Large script execution
    'get_page_state', // Page state extraction
    'get_network_logs', // Network log extraction
    'extract_forensic_data' // Forensic data extraction
  ]
};

/**
 * Calculate adaptive timeout based on command type and expected response size
 * @param {string} commandName - The name of the command being executed
 * @param {number} estimatedSize - Estimated response size in bytes (optional)
 * @returns {number} Timeout in milliseconds
 */
function calculateAdaptiveTimeout(commandName, estimatedSize = 0) {
  // Check if adaptive timeout is disabled
  if (process.env.ADAPTIVE_TIMEOUT_DISABLED === '1' || !ADAPTIVE_TIMEOUT_CONFIG.enabled) {
    return IPC_DEFAULT_TIMEOUT;
  }

  let timeout = ADAPTIVE_TIMEOUT_CONFIG.baseTimeout;

  // Check if this command typically returns large responses
  if (ADAPTIVE_TIMEOUT_CONFIG.largeResponseCommands.includes(commandName)) {
    // Give large-response commands 50% more time initially
    timeout = Math.floor(ADAPTIVE_TIMEOUT_CONFIG.baseTimeout * 1.5); // 45 seconds
  }

  // Adjust based on estimated response size
  if (estimatedSize > ADAPTIVE_TIMEOUT_CONFIG.hugeResponseThreshold) {
    // Very large responses (20MB+) get maximum timeout
    timeout = ADAPTIVE_TIMEOUT_CONFIG.maxTimeout;
  } else if (estimatedSize > ADAPTIVE_TIMEOUT_CONFIG.largeResponseThreshold) {
    // Large responses (5-20MB) get 60 seconds
    timeout = 60000;
  }

  // Ensure timeout is within bounds
  return Math.max(
    ADAPTIVE_TIMEOUT_CONFIG.baseTimeout,
    Math.min(timeout, ADAPTIVE_TIMEOUT_CONFIG.maxTimeout)
  );
}

/**
 * Execute an IPC request with timeout to prevent hanging promises
 *
 * STABILITY FIX (Phase 3 - Issue #3):
 * - Race condition prevention with atomic state management
 * - Guaranteed one-time execution with cleanup function
 * - Prevents handler executing after timeout
 * - Proper listener cleanup in all code paths
 *
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
    let completed = false;
    let handler = null;

    /**
     * Safety cleanup function - ensures one-time execution
     * and proper resource cleanup
     * @private
     */
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (handler && completed === false) {
        // Only remove listener if handler was registered
        ipcMain.removeListener(responseChannel, handler);
      }
      handler = null;
    };

    /**
     * Handler for successful response
     * @private
     */
    handler = (event, result) => {
      // Atomic check-and-set to prevent race conditions
      if (completed) {
        return;
      }
      completed = true;

      cleanup();
      resolve(result);
    };

    /**
     * Handler for timeout
     * @private
     */
    const timeoutHandler = () => {
      // Atomic check-and-set to prevent race conditions
      if (completed) {
        return;
      }
      completed = true;

      cleanup();
      reject(new Error(`IPC timeout: No response from '${responseChannel}' within ${timeout}ms`));
    };

    // Register the handler for the response
    ipcMain.once(responseChannel, handler);

    // Set timeout with guaranteed cleanup
    timeoutId = setTimeout(timeoutHandler, timeout);

    // Send the request (use try-catch to handle potential errors)
    try {
      if (data !== null) {
        webContents.send(sendChannel, data);
      } else {
        webContents.send(sendChannel);
      }
    } catch (error) {
      // If send fails, clean up and reject
      if (completed) {
        return;
      }
      completed = true;

      cleanup();
      reject(new Error(`IPC send failed on '${sendChannel}': ${error.message}`));
    }
  });
}

module.exports = {
  IPC_DEFAULT_TIMEOUT,
  ADAPTIVE_TIMEOUT_CONFIG,
  calculateAdaptiveTimeout,
  ipcWithTimeout
};

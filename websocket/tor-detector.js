/**
 * Tor Detection Module
 * Handles .onion domain detection and Tor mode validation
 */

// ==========================================
// .onion Domain Detection
// ==========================================

/**
 * Check if a URL is a .onion domain
 * @param {string} url - The URL to check
 * @returns {boolean} True if the URL is a .onion domain
 */
function isOnionUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.onion');
  } catch {
    // Fallback for malformed URLs - check if .onion appears in the string
    return url.includes('.onion');
  }
}

/**
 * Check if Tor mode is enabled at startup
 * @returns {boolean} True if Tor mode is enabled
 */
function isTorModeEnabled() {
  const args = process.argv;
  return (
    process.env.TOR_MODE === '1' ||
    process.env.TOR_MODE === 'true' ||
    args.includes('--tor-mode')
  );
}

/**
 * Check URL and return error if .onion without Tor mode
 * @param {string} url - The URL to check
 * @returns {Object|null} Error object if .onion without Tor mode, null otherwise
 */
function checkOnionWithoutTor(url) {
  if (isOnionUrl(url) && !isTorModeEnabled()) {
    return {
      success: false,
      error: '.onion domains require TOR_MODE=1 at startup.',
      suggestion: 'Restart with TOR_MODE=1 or --tor-mode flag.',
      url
    };
  }
  return null;
}

// ==========================================
// Exports
// ==========================================

module.exports = {
  isOnionUrl,
  isTorModeEnabled,
  checkOnionWithoutTor
};

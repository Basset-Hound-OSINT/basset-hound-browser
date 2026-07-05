/**
 * TLS/WSS Enforcement Middleware
 *
 * Enforces WebSocket Secure (WSS) for credential-related commands in production.
 * Plain WebSocket (WS) is allowed in development mode (NODE_ENV !== 'production').
 *
 * Version: 1.0.0
 * Created: June 15, 2026
 */

/**
 * Check if a WebSocket connection requires TLS/WSS
 *
 * Credential commands must use WSS (encrypted) in production:
 * - generate_totp, validate_totp
 * - generate_hotp, validate_hotp, resync_hotp
 * - parse_base32_secret (if added in future)
 *
 * @param {Object} req - HTTP upgrade request object with socket property
 * @returns {Object|null} Error object if TLS not available, null if allowed
 */
function requireWSS(req) {
  // Only enforce in production
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  // Check if socket is encrypted (TLS)
  const isEncrypted = req.socket && req.socket.encrypted;

  if (!isEncrypted) {
    return {
      error: 'WSS_REQUIRED',
      message: 'Credential commands require WebSocket Secure (WSS). Use wss:// instead of ws://',
      doc: 'See docs/guides/SECURITY-GUIDE.md',
      severity: 'CRITICAL'
    };
  }

  return null;
}

/**
 * Get TLS information from a request
 *
 * @param {Object} req - HTTP upgrade request object
 * @returns {Object} TLS information { isEncrypted, cipher, protocol, version }
 */
function getTLSInfo(req) {
  if (!req.socket) {
    return {
      isEncrypted: false,
      cipher: null,
      protocol: null,
      version: null
    };
  }

  const tlsSession = req.socket.getSession ? req.socket.getSession() : null;

  return {
    isEncrypted: Boolean(req.socket.encrypted),
    cipher: req.socket.getCipher ? req.socket.getCipher().name : null,
    protocol: req.socket.getProtocol ? req.socket.getProtocol() : null,
    version: req.socket.getProtocolVersion ? req.socket.getProtocolVersion() : null
  };
}

module.exports = {
  requireWSS,
  getTLSInfo
};

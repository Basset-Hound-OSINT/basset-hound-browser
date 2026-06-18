/**
 * Monitoring Consent Middleware
 *
 * Manages user consent for monitoring and data collection.
 * Tracks consent state per client and enforces consent-based monitoring.
 *
 * @module websocket/middleware/monitoring-consent
 * @version 1.0.0
 */

class MonitoringConsentManager {
  constructor() {
    // clientId -> { monitoring: bool, timestamp, grantedBy }
    this.clientConsent = new Map();
    this.consentChanges = [];
  }

  /**
   * Initialize consent for a client connection
   * @param {string} clientId - Unique client identifier
   * @param {Object} params - Connection parameters
   * @param {boolean} params.consent - Consent for monitoring (default: false)
   * @param {string} params.userId - User identifier (optional)
   * @returns {Object} Consent state
   */
  initializeConsent(clientId, params = {}) {
    const consent = {
      monitoring: params.consent?.monitoring || false,
      timestamp: Date.now(),
      grantedBy: params.userId || 'anonymous',
      version: '1.0',
      origin: params.origin || 'unknown'
    };

    this.clientConsent.set(clientId, consent);

    // Log the initialization
    this.logConsentChange(clientId, null, consent.monitoring, 'init');

    return {
      success: true,
      monitoring: consent.monitoring,
      clientId
    };
  }

  /**
   * Check if client has given monitoring consent
   * @param {string} clientId - Client identifier
   * @returns {boolean}
   */
  hasConsent(clientId) {
    const consent = this.clientConsent.get(clientId);
    return consent ? consent.monitoring === true : false;
  }

  /**
   * Set monitoring consent for a client
   * @param {string} clientId - Client identifier
   * @param {boolean} enabled - Enable/disable monitoring
   * @param {string} reason - Reason for change (optional)
   * @returns {Object} Updated consent state
   */
  setConsent(clientId, enabled, reason = 'user_request') {
    const current = this.clientConsent.get(clientId);
    if (!current) {
      return {
        success: false,
        error: 'Client not found',
        clientId
      };
    }

    const previous = current.monitoring;
    current.monitoring = enabled;
    current.timestamp = Date.now();

    this.logConsentChange(clientId, previous, enabled, reason);

    return {
      success: true,
      clientId,
      consentBefore: previous,
      consentAfter: enabled,
      timestamp: Date.now(),
      reason
    };
  }

  /**
   * Get current consent state for a client
   * @param {string} clientId - Client identifier
   * @returns {Object} Consent state
   */
  getConsent(clientId) {
    const consent = this.clientConsent.get(clientId);
    return {
      success: !!consent,
      clientId,
      consent: consent || {
        monitoring: false,
        timestamp: null,
        grantedBy: null
      }
    };
  }

  /**
   * Revoke monitoring consent for a client
   * @param {string} clientId - Client identifier
   * @returns {Object} Result of revocation
   */
  revokeConsent(clientId) {
    return this.setConsent(clientId, false, 'user_revoke');
  }

  /**
   * Grant monitoring consent for a client
   * @param {string} clientId - Client identifier
   * @returns {Object} Result of grant
   */
  grantConsent(clientId) {
    return this.setConsent(clientId, true, 'user_grant');
  }

  /**
   * Log a consent change for audit trail
   * @param {string} clientId - Client identifier
   * @param {boolean} consentBefore - Previous consent state
   * @param {boolean} consentAfter - New consent state
   * @param {string} reason - Reason for change
   */
  logConsentChange(clientId, consentBefore, consentAfter, reason) {
    const change = {
      timestamp: Date.now(),
      clientId,
      consentBefore,
      consentAfter,
      reason,
      ipAddress: this.getClientIp(clientId)
    };

    this.consentChanges.push(change);

    // Keep only last 1000 changes in memory
    if (this.consentChanges.length > 1000) {
      this.consentChanges.shift();
    }

    // Log to console in debug mode
    if (process.env.DEBUG_CONSENT === '1') {
      console.log('[Consent Audit]', change);
    }
  }

  /**
   * Get audit trail of consent changes
   * @param {string} clientId - Optional: filter by client
   * @param {number} limit - Maximum records to return (default: 50)
   * @returns {Array} Consent change history
   */
  getAuditTrail(clientId = null, limit = 50) {
    let trail = this.consentChanges;

    if (clientId) {
      trail = trail.filter(c => c.clientId === clientId);
    }

    // Return most recent first
    return trail.slice(-limit).reverse();
  }

  /**
   * Get stored client IP (stub - would be populated from request)
   * @param {string} clientId - Client identifier
   * @returns {string}
   */
  getClientIp(clientId) {
    // Extract IP from clientId if it's an IP-based format
    if (clientId.includes(':')) {
      return clientId.split(':')[0];
    }
    return clientId;
  }

  /**
   * Clean up consent for disconnected client
   * @param {string} clientId - Client identifier
   */
  removeClient(clientId) {
    this.clientConsent.delete(clientId);
  }

  /**
   * Get summary statistics about consent
   * @returns {Object} Consent statistics
   */
  getConsentStats() {
    let consentedClients = 0;
    let totalClients = 0;

    this.clientConsent.forEach(consent => {
      totalClients++;
      if (consent.monitoring) {
        consentedClients++;
      }
    });

    return {
      totalClients,
      consentedClients,
      deniedClients: totalClients - consentedClients,
      consentRate: totalClients > 0 ? (consentedClients / totalClients * 100).toFixed(2) : 0,
      recentChanges: this.consentChanges.slice(-10)
    };
  }

  /**
   * Validate consent status (used before metrics collection)
   * @param {string} clientId - Client identifier
   * @param {string} operation - Operation being performed
   * @returns {Object} Validation result
   */
  validateConsent(clientId, operation = 'metrics_collection') {
    const consent = this.clientConsent.get(clientId);

    if (!consent) {
      return {
        valid: false,
        error: 'Client not found',
        clientId
      };
    }

    if (!consent.monitoring) {
      return {
        valid: false,
        error: 'Monitoring consent not granted',
        clientId,
        operation
      };
    }

    return {
      valid: true,
      clientId,
      consentTime: consent.timestamp,
      grantedBy: consent.grantedBy
    };
  }
}

// Global singleton instance
let consentManager = null;

/**
 * Get or create the consent manager instance
 * @returns {MonitoringConsentManager}
 */
function getConsentManager() {
  if (!consentManager) {
    consentManager = new MonitoringConsentManager();
  }
  return consentManager;
}

module.exports = {
  MonitoringConsentManager,
  getConsentManager
};

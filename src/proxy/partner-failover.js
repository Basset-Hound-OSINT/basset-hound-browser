/**
 * Partner Failover & Recovery System
 * Monitors partner health and automatically failover on degradation
 *
 * Features:
 * - Detection of failing partners
 * - Mid-request failover
 * - Circuit breaker pattern
 * - Periodic recovery checks
 */

class PartnerFailover {
  constructor(partnerManager, partnerSelector, options = {}) {
    this.partnerManager = partnerManager;
    this.partnerSelector = partnerSelector;

    this.config = {
      failureThreshold: options.failureThreshold || 0.3, // 30% failure rate
      consecutiveFailureLimit: options.consecutiveFailureLimit || 5,
      circuitBreakerTimeout: options.circuitBreakerTimeout || 60000, // 1 minute
      recoveryCheckInterval: options.recoveryCheckInterval || 30000, // 30 seconds
      recoveryCheckTimeout: options.recoveryCheckTimeout || 5000
    };

    this.circuitBreakers = new Map();
    this.failureTracking = new Map();
    this.recoveryAttempts = new Map();

    this._startRecoveryChecks();
  }

  /**
   * Execute request with automatic failover
   */
  async executeWithFailover(primaryPartnerId, requestFn, options = {}) {
    try {
      // Try primary partner
      const primaryResult = await this._executeWithPartner(primaryPartnerId, requestFn);

      if (primaryResult.success) {
        this._recordSuccess(primaryPartnerId);
        return primaryResult;
      }

      // Primary failed, try failover chain
      const failoverChain = this.partnerManager.getFailoverChain(primaryPartnerId);
      if (!failoverChain || failoverChain.fallbacks.length === 0) {
        return {
          success: false,
          error: `Request failed and no failover available`,
          primaryPartnerId,
          failoverUsed: false
        };
      }

      // Try each fallback in order
      for (const fallback of failoverChain.fallbacks) {
        const fallbackPartnerId = fallback.partnerId;

        // Check if fallback is in circuit breaker
        if (this._isCircuitBreakerOpen(fallbackPartnerId)) {
          continue;
        }

        const fallbackResult = await this._executeWithPartner(fallbackPartnerId, requestFn);

        if (fallbackResult.success) {
          this._recordSuccess(fallbackPartnerId);
          return {
            ...fallbackResult,
            failoverUsed: true,
            failoverPartnerId: fallbackPartnerId,
            primaryPartnerId
          };
        }

        this._recordFailure(fallbackPartnerId);
      }

      return {
        success: false,
        error: 'All partners failed (primary + failovers)',
        primaryPartnerId,
        failoverAttempted: true,
        failoverUsed: false
      };
    } catch (error) {
      this._recordFailure(primaryPartnerId);
      return {
        success: false,
        error: error.message,
        primaryPartnerId,
        failoverUsed: false
      };
    }
  }

  /**
   * Handle partner failure
   */
  handlePartnerFailure(partnerId, error) {
    this._recordFailure(partnerId);

    const failureRate = this._getFailureRate(partnerId);
    const consecutiveFailures = this._getConsecutiveFailures(partnerId);

    const action = {
      partnerId,
      error: error.message || error,
      failureRate: Math.round(failureRate * 10000) / 10000,
      consecutiveFailures,
      action: null
    };

    // Check failure threshold
    if (failureRate >= this.config.failureThreshold) {
      action.action = 'disable';
      this._openCircuitBreaker(partnerId);
    } else if (consecutiveFailures >= this.config.consecutiveFailureLimit) {
      action.action = 'circuit_breaker';
      this._openCircuitBreaker(partnerId);
    } else {
      action.action = 'monitor';
    }

    return action;
  }

  /**
   * Get partner failure status
   */
  getPartnerFailureStatus(partnerId) {
    const tracking = this.failureTracking.get(partnerId);
    if (!tracking) {
      return null;
    }

    return {
      partnerId,
      totalRequests: tracking.totalRequests,
      failedRequests: tracking.failedRequests,
      successfulRequests: tracking.successfulRequests,
      failureRate: tracking.totalRequests > 0
        ? Math.round((tracking.failedRequests / tracking.totalRequests) * 10000) / 10000
        : 0,
      consecutiveFailures: tracking.consecutiveFailures,
      lastFailure: tracking.lastFailure,
      circuitBreakerStatus: this._getCircuitBreakerStatus(partnerId)
    };
  }

  /**
   * Get all failure statuses
   */
  getAllFailureStatuses() {
    const statuses = [];
    this.failureTracking.forEach((tracking, partnerId) => {
      statuses.push(this.getPartnerFailureStatus(partnerId));
    });
    return statuses;
  }

  /**
   * Reset failure tracking for partner
   */
  resetPartnerTracking(partnerId) {
    this.failureTracking.delete(partnerId);
    this.recoveryAttempts.delete(partnerId);
    this._closeCircuitBreaker(partnerId);

    return {
      success: true,
      partnerId,
      message: 'Failure tracking reset'
    };
  }

  /**
   * Manually disable partner
   */
  disablePartner(partnerId) {
    this.partnerManager.setPartnerEnabled(partnerId, false);
    this._openCircuitBreaker(partnerId);

    return {
      success: true,
      partnerId,
      enabled: false
    };
  }

  /**
   * Manually enable partner
   */
  enablePartner(partnerId) {
    this.partnerManager.setPartnerEnabled(partnerId, true);
    this._closeCircuitBreaker(partnerId);
    this.resetPartnerTracking(partnerId);

    return {
      success: true,
      partnerId,
      enabled: true
    };
  }

  /**
   * Get recovery status
   */
  getRecoveryStatus(partnerId) {
    const circuitBreaker = this.circuitBreakers.get(partnerId);
    if (!circuitBreaker) {
      return {
        partnerId,
        status: 'healthy',
        circuitBreakerOpen: false
      };
    }

    const timeSinceFail = Date.now() - circuitBreaker.openedAt;
    const timeUntilRecovery = circuitBreaker.openedAt + this.config.circuitBreakerTimeout - Date.now();

    return {
      partnerId,
      status: 'degraded',
      circuitBreakerOpen: true,
      openedAt: circuitBreaker.openedAt,
      recoveryAttempts: this.recoveryAttempts.get(partnerId) || 0,
      timeUntilRecovery: Math.max(0, timeUntilRecovery),
      canAttemptRecovery: timeUntilRecovery <= 0
    };
  }

  /**
   * Get failover statistics
   */
  getFailoverStats() {
    const stats = {
      totalPartnersTracked: this.failureTracking.size,
      circuitBreakerOpen: 0,
      degradedPartners: 0,
      healthyPartners: 0,
      partners: []
    };

    this.failureTracking.forEach((tracking, partnerId) => {
      const status = this.getPartnerFailureStatus(partnerId);
      stats.partners.push(status);

      if (this._isCircuitBreakerOpen(partnerId)) {
        stats.circuitBreakerOpen++;
      } else if (status.failureRate > 0.1) {
        stats.degradedPartners++;
      } else {
        stats.healthyPartners++;
      }
    });

    return stats;
  }

  // Private helper methods

  /**
   * Execute request with specific partner
   */
  async _executeWithPartner(partnerId, requestFn) {
    try {
      // Check if partner is enabled
      const partner = this.partnerManager.getPartner(partnerId);
      if (!partner || !partner.enabled) {
        throw new Error(`Partner ${partnerId} is disabled`);
      }

      // Check circuit breaker
      if (this._isCircuitBreakerOpen(partnerId)) {
        throw new Error(`Circuit breaker open for ${partnerId}`);
      }

      // Execute request
      const result = await requestFn(partnerId);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Record successful request
   */
  _recordSuccess(partnerId) {
    if (!this.failureTracking.has(partnerId)) {
      this.failureTracking.set(partnerId, this._initializeTracking());
    }

    const tracking = this.failureTracking.get(partnerId);
    tracking.totalRequests++;
    tracking.successfulRequests++;
    tracking.consecutiveFailures = 0;
    tracking.lastSuccess = Date.now();
  }

  /**
   * Record failed request
   */
  _recordFailure(partnerId) {
    if (!this.failureTracking.has(partnerId)) {
      this.failureTracking.set(partnerId, this._initializeTracking());
    }

    const tracking = this.failureTracking.get(partnerId);
    tracking.totalRequests++;
    tracking.failedRequests++;
    tracking.consecutiveFailures++;
    tracking.lastFailure = Date.now();
  }

  /**
   * Get failure rate for partner
   */
  _getFailureRate(partnerId) {
    const tracking = this.failureTracking.get(partnerId);
    if (!tracking || tracking.totalRequests === 0) {
      return 0;
    }

    return tracking.failedRequests / tracking.totalRequests;
  }

  /**
   * Get consecutive failures for partner
   */
  _getConsecutiveFailures(partnerId) {
    const tracking = this.failureTracking.get(partnerId);
    return tracking ? tracking.consecutiveFailures : 0;
  }

  /**
   * Check if circuit breaker is open
   */
  _isCircuitBreakerOpen(partnerId) {
    const cb = this.circuitBreakers.get(partnerId);
    if (!cb) {
      return false;
    }

    const timeSinceFail = Date.now() - cb.openedAt;
    return timeSinceFail < this.config.circuitBreakerTimeout;
  }

  /**
   * Get circuit breaker status
   */
  _getCircuitBreakerStatus(partnerId) {
    const cb = this.circuitBreakers.get(partnerId);
    if (!cb) {
      return 'closed';
    }

    return this._isCircuitBreakerOpen(partnerId) ? 'open' : 'recovering';
  }

  /**
   * Open circuit breaker for partner
   */
  _openCircuitBreaker(partnerId) {
    this.circuitBreakers.set(partnerId, {
      openedAt: Date.now()
    });
  }

  /**
   * Close circuit breaker for partner
   */
  _closeCircuitBreaker(partnerId) {
    this.circuitBreakers.delete(partnerId);
  }

  /**
   * Initialize failure tracking object
   */
  _initializeTracking() {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      consecutiveFailures: 0,
      lastSuccess: null,
      lastFailure: null
    };
  }

  /**
   * Start periodic recovery checks
   */
  _startRecoveryChecks() {
    this.recoveryCheckTimer = setInterval(() => {
      this.circuitBreakers.forEach((cb, partnerId) => {
        if (!this._isCircuitBreakerOpen(partnerId)) {
          // Circuit breaker timed out, try recovery
          this._attemptRecovery(partnerId);
        }
      });
    }, this.config.recoveryCheckInterval);
  }

  /**
   * Attempt recovery for failed partner
   */
  async _attemptRecovery(partnerId) {
    try {
      const attempts = this.recoveryAttempts.get(partnerId) || 0;
      this.recoveryAttempts.set(partnerId, attempts + 1);

      // Perform health check
      const healthResult = await this.partnerManager.performHealthCheck(partnerId);

      if (healthResult.success) {
        this._closeCircuitBreaker(partnerId);
        this.failureTracking.delete(partnerId);
        this.recoveryAttempts.delete(partnerId);

        return {
          recovered: true,
          partnerId,
          message: 'Partner recovered'
        };
      }
    } catch (error) {
      // Recovery failed, keep circuit breaker open
    }

    return { recovered: false };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.recoveryCheckTimer) {
      clearInterval(this.recoveryCheckTimer);
    }
  }
}

module.exports = { PartnerFailover };

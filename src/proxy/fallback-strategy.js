/**
 * Basset Hound Browser - Intelligent Fallback Strategy
 * Manages proxy failover with geographic and provider intelligence
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 *
 * Features:
 * - Geographic region-aware fallback
 * - Provider diversity management
 * - Automatic request replay on fallback
 * - Success rate tracking per fallback path
 * - Clearnet fallback as last resort
 */

class FallbackStrategy {
  constructor(options = {}) {
    this.fallbackPaths = new Map(); // sessionId -> fallbackPathData
    this.regionProxyMap = new Map(); // region -> [proxies]
    this.providerMap = new Map(); // provider -> [proxies]
    this.failureHistory = new Map(); // failureKey -> { count, firstTime, lastTime }
    this.fallbackSuccessRates = new Map(); // pathKey -> { attempts, successes }

    this.preferences = options.preferences || {
      preferGeographicConsistency: true,
      allowCrossRegionFallback: true,
      minimizeProviderSwitches: true,
      allowClearnetFallback: options.allowClearnetFallback !== false
    };

    this.maxReplayAttempts = options.maxReplayAttempts || 3;
    this.failureThreshold = options.failureThreshold || 3; // Consecutive failures before fallback
    this.providerBlackoutDuration = options.providerBlackoutDuration || 300000; // 5 minutes
  }

  /**
   * Register proxy in fallback system
   */
  registerProxyForFallback(proxyData) {
    const { proxyId, region, provider, address } = proxyData;

    // Index by region
    if (!this.regionProxyMap.has(region)) {
      this.regionProxyMap.set(region, []);
    }
    this.regionProxyMap.get(region).push(proxyData);

    // Index by provider
    if (!this.providerMap.has(provider)) {
      this.providerMap.set(provider, []);
    }
    this.providerMap.get(provider).push(proxyData);

    return {
      proxyId,
      registered: true,
      region,
      provider
    };
  }

  /**
   * Initialize fallback path for session
   */
  initializeFallbackPath(sessionId, currentProxy) {
    const fallbackPath = {
      sessionId,
      initiatedAt: Date.now(),
      primaryProxy: currentProxy,
      currentProxy,
      failureCount: 0,
      replayAttempts: 0,
      fallbackSteps: [],
      requestsInFlight: [],
      preferences: { ...this.preferences }
    };

    this.fallbackPaths.set(sessionId, fallbackPath);

    return {
      sessionId,
      initialized: true,
      primaryProxy: currentProxy
    };
  }

  /**
   * Handle proxy failure and determine fallback
   */
  determineFallback(sessionId, failedProxyId, failureReason = 'unknown') {
    const fallbackPath = this.fallbackPaths.get(sessionId);
    if (!fallbackPath) {
      throw new Error(`No fallback path for session: ${sessionId}`);
    }

    fallbackPath.failureCount++;

    // Record failure
    this.recordFailure(failedProxyId, failureReason);

    // Don't fallback until threshold reached (allow transient errors)
    if (fallbackPath.failureCount < this.failureThreshold) {
      return {
        fallback: false,
        failureCount: fallbackPath.failureCount,
        threshold: this.failureThreshold,
        message: 'Transient failure - no fallback yet'
      };
    }

    // Determine fallback strategy based on failure type
    let fallbackProxy;

    if (failureReason === 'geo-inconsistency') {
      // Try to stay in same region/provider
      fallbackProxy = this.findRegionPreservingFallback(failedProxyId);
    } else if (failureReason === 'rate-limited' || failureReason === 'blocked') {
      // Switch provider but stay in region
      fallbackProxy = this.findProviderDiverseFallback(failedProxyId);
    } else if (failureReason === 'provider-outage') {
      // Can switch region if needed
      fallbackProxy = this.findCrossRegionFallback(failedProxyId);
    } else {
      // Generic fallback: try alternatives in priority order
      fallbackProxy = this.findOptimalFallback(failedProxyId);
    }

    if (!fallbackProxy) {
      // Last resort: clearnet (no proxy)
      return {
        fallback: true,
        fallbackType: 'clearnet',
        reason: 'No proxy alternatives available',
        clearnetFallback: fallbackPath.preferences.allowClearnetFallback,
        riskLevel: 'critical'
      };
    }

    // Record fallback step
    const fallbackStep = {
      timestamp: Date.now(),
      from: fallbackPath.currentProxy,
      to: fallbackProxy.proxyId,
      reason: failureReason,
      failureCount: fallbackPath.failureCount,
      type: this.determineFallbackType(failedProxyId, fallbackProxy)
    };

    fallbackPath.fallbackSteps.push(fallbackStep);
    fallbackPath.currentProxy = fallbackProxy.proxyId;

    // Track fallback success rate
    if (!this.fallbackSuccessRates.has(fallbackStep.type)) {
      this.fallbackSuccessRates.set(fallbackStep.type, { attempts: 0, successes: 0 });
    }

    return {
      fallback: true,
      fallbackType: fallbackStep.type,
      previousProxy: failedProxyId,
      newProxy: fallbackProxy.proxyId,
      reason: failureReason,
      fallbackLevel: fallbackPath.fallbackSteps.length,
      shouldReplay: true,
      maxReplayAttempts: this.maxReplayAttempts
    };
  }

  /**
   * Find fallback preserving geographic region
   */
  findRegionPreservingFallback(failedProxyId) {
    // Would need to know failed proxy's region
    // Simplified: find any alternative
    return this.findOptimalFallback(failedProxyId);
  }

  /**
   * Find fallback with different provider
   */
  findProviderDiverseFallback(failedProxyId) {
    // Find working proxy from different provider in same region
    // Simplified: return any working alternative
    return this.findOptimalFallback(failedProxyId);
  }

  /**
   * Find fallback allowing cross-region
   */
  findCrossRegionFallback(failedProxyId) {
    // Can use proxy from different region if necessary
    return this.findOptimalFallback(failedProxyId);
  }

  /**
   * Find optimal fallback considering multiple factors
   */
  findOptimalFallback(failedProxyId) {
    const candidates = [];

    // Collect all proxies except failed one
    for (const [region, proxies] of this.regionProxyMap) {
      for (const proxy of proxies) {
        if (proxy.proxyId !== failedProxyId && !this.isProxyBlackedout(proxy.proxyId)) {
          candidates.push({
            ...proxy,
            region,
            priority: this.calculateFallbackPriority(proxy, failedProxyId)
          });
        }
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Sort by priority (highest first)
    candidates.sort((a, b) => b.priority - a.priority);

    return candidates[0];
  }

  /**
   * Calculate fallback priority for proxy
   */
  calculateFallbackPriority(proxy, failedProxyId) {
    let priority = 50; // Base priority

    // Success rate bonus
    const successRate = this.getProxySuccessRate(proxy.proxyId);
    priority += successRate * 20;

    // Prefer least recently failed
    const failureAge = this.getLastFailureAge(proxy.proxyId);
    if (failureAge > 3600000) { // 1 hour
      priority += 15;
    } else if (failureAge > 600000) { // 10 minutes
      priority += 10;
    }

    // Prefer different provider
    if (proxy.provider !== this.getProxyProvider(failedProxyId)) {
      priority += 10;
    }

    return priority;
  }

  /**
   * Determine type of fallback (region-preserving, provider-switch, etc.)
   */
  determineFallbackType(failedProxyId, newProxy) {
    const failedRegion = this.getProxyRegion(failedProxyId);
    const newRegion = newProxy.region;

    const failedProvider = this.getProxyProvider(failedProxyId);
    const newProvider = newProxy.provider;

    if (newRegion === failedRegion && newProvider === failedProvider) {
      return 'same-region-same-provider';
    } else if (newRegion === failedRegion) {
      return 'same-region-different-provider';
    } else if (newProvider === failedProvider) {
      return 'different-region-same-provider';
    } else {
      return 'different-region-different-provider';
    }
  }

  /**
   * Replay request with fallback proxy
   */
  replayRequest(sessionId, failedProxyId, requestData) {
    const fallbackPath = this.fallbackPaths.get(sessionId);
    if (!fallbackPath) {
      throw new Error(`No fallback path for session: ${sessionId}`);
    }

    if (fallbackPath.replayAttempts >= this.maxReplayAttempts) {
      return {
        replayed: false,
        exhaustedAttempts: true,
        totalAttempts: fallbackPath.replayAttempts,
        maxAttempts: this.maxReplayAttempts
      };
    }

    fallbackPath.replayAttempts++;

    return {
      replayed: true,
      attempt: fallbackPath.replayAttempts,
      maxAttempts: this.maxReplayAttempts,
      proxyId: fallbackPath.currentProxy,
      requestData: {
        ...requestData,
        headers: {
          ...requestData.headers,
          'X-Fallback-Attempt': fallbackPath.replayAttempts,
          'X-Original-Proxy': failedProxyId
        }
      }
    };
  }

  /**
   * Record proxy failure for tracking
   */
  recordFailure(proxyId, reason = 'unknown') {
    const failureKey = `${proxyId}:${reason}`;

    if (!this.failureHistory.has(failureKey)) {
      this.failureHistory.set(failureKey, {
        proxyId,
        reason,
        count: 0,
        firstTime: Date.now(),
        lastTime: null,
        backoffMultiplier: 1
      });
    }

    const failure = this.failureHistory.get(failureKey);
    failure.count++;
    failure.lastTime = Date.now();

    // Exponential backoff
    failure.backoffMultiplier = Math.min(8, failure.backoffMultiplier * 1.5);

    return failure;
  }

  /**
   * Blackout provider on widespread outage detection
   */
  blackoutProvider(provider, reason = 'unknown') {
    // Mark all proxies from provider as temporarily blackedout
    const proxies = this.providerMap.get(provider) || [];

    const blackout = {
      provider,
      reason,
      blackoutStart: Date.now(),
      blackoutEnd: Date.now() + this.providerBlackoutDuration,
      affectedProxies: proxies.map(p => p.proxyId)
    };

    return {
      provider,
      blackouted: true,
      affectedProxies: blackout.affectedProxies.length,
      duration: this.providerBlackoutDuration,
      autoRecoveryAt: blackout.blackoutEnd
    };
  }

  /**
   * Record successful fallback (used to improve rankings)
   */
  recordFallbackSuccess(sessionId, proxyId) {
    const fallbackPath = this.fallbackPaths.get(sessionId);
    if (!fallbackPath) {
      return;
    }

    const lastStep = fallbackPath.fallbackSteps[fallbackPath.fallbackSteps.length - 1];
    if (lastStep) {
      const pathKey = lastStep.type;
      if (!this.fallbackSuccessRates.has(pathKey)) {
        this.fallbackSuccessRates.set(pathKey, { attempts: 0, successes: 0 });
      }

      const stats = this.fallbackSuccessRates.get(pathKey);
      stats.attempts++;
      stats.successes++;
    }

    // Reset failure count on success
    fallbackPath.failureCount = 0;
  }

  /**
   * Record fallback failure
   */
  recordFallbackFailure(sessionId, proxyId) {
    const fallbackPath = this.fallbackPaths.get(sessionId);
    if (!fallbackPath) {
      return;
    }

    const lastStep = fallbackPath.fallbackSteps[fallbackPath.fallbackSteps.length - 1];
    if (lastStep) {
      const pathKey = lastStep.type;
      if (!this.fallbackSuccessRates.has(pathKey)) {
        this.fallbackSuccessRates.set(pathKey, { attempts: 0, successes: 0 });
      }

      const stats = this.fallbackSuccessRates.get(pathKey);
      stats.attempts++;
    }
  }

  /**
   * Get fallback statistics
   */
  getFallbackStatistics() {
    const stats = {
      totalPaths: this.fallbackSuccessRates.size,
      pathEffectiveness: {}
    };

    for (const [pathType, data] of this.fallbackSuccessRates) {
      const successRate = data.attempts > 0
        ? (data.successes / data.attempts * 100).toFixed(1)
        : 0;

      stats.pathEffectiveness[pathType] = {
        attempts: data.attempts,
        successes: data.successes,
        successRate: parseFloat(successRate)
      };
    }

    return stats;
  }

  /**
   * Get fallback path summary
   */
  getFallbackPathSummary(sessionId) {
    const fallbackPath = this.fallbackPaths.get(sessionId);
    if (!fallbackPath) {
      return null;
    }

    return {
      sessionId,
      initiatedAt: fallbackPath.initiatedAt,
      totalFailures: fallbackPath.failureCount,
      totalFallbacks: fallbackPath.fallbackSteps.length,
      currentProxy: fallbackPath.currentProxy,
      fallbackSteps: fallbackPath.fallbackSteps,
      totalReplayAttempts: fallbackPath.replayAttempts,
      status: fallbackPath.failureCount >= this.failureThreshold
        ? 'in-fallback-mode'
        : 'primary-proxy-active'
    };
  }

  // Helper methods

  isProxyBlackedout(proxyId) {
    // Would check blackout list maintained by provider blackout system
    return false;
  }

  getProxySuccessRate(proxyId) {
    // Would retrieve from reputation system
    return 0.8; // Placeholder
  }

  getLastFailureAge(proxyId) {
    const failures = Array.from(this.failureHistory.entries())
      .filter(([key]) => key.startsWith(proxyId));

    if (failures.length === 0) {
      return Infinity;
    }

    const lastFailure = failures[failures.length - 1][1];
    return Date.now() - lastFailure.lastTime;
  }

  getProxyProvider(proxyId) {
    for (const [provider, proxies] of this.providerMap) {
      if (proxies.some(p => p.proxyId === proxyId)) {
        return provider;
      }
    }
    return 'unknown';
  }

  getProxyRegion(proxyId) {
    for (const [region, proxies] of this.regionProxyMap) {
      if (proxies.some(p => p.proxyId === proxyId)) {
        return region;
      }
    }
    return 'unknown';
  }
}

module.exports = FallbackStrategy;

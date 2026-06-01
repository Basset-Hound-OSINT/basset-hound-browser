/**
 * Basset Hound Browser - Advanced Proxy Intelligence Module
 * Smart rotation with geographic consistency, provider detection, performance optimization
 *
 * Version: 1.0.0
 * Created: May 31, 2026
 *
 * Features:
 * - Smart proxy rotation (don't flip countries mid-session)
 * - Provider detection (know if using residential, datacenter, VPN)
 * - Geographic consistency validation
 * - Performance impact minimization
 * - Provider reputation tracking
 * - Automatic failover on proxy failure
 */

const crypto = require('crypto');
const CredentialSanitizer = require('./credential-sanitizer');

class ProxyIntelligence {
  constructor(options = {}) {
    this.proxies = new Map(); // proxyId -> { address, provider, metrics }
    this.sessions = new Map(); // sessionId -> { currentProxy, geoLocation, history }
    this.providers = this.initializeProviders();
    this.geoLocationCache = new Map();
    this.providerReputation = new Map();
    this.performanceThreshold = options.performanceThreshold || 200; // ms
    this.rotationTimeout = options.rotationTimeout || 1800000; // 30 minutes
    this.maxConsecutiveFailures = options.maxConsecutiveFailures || 3;
    this.sanitizer = new CredentialSanitizer(); // SECURITY FIX: Credential sanitizer
  }

  /**
   * Initialize known proxy providers
   */
  initializeProviders() {
    return {
      'residential': {
        name: 'Residential IPs',
        type: 'residential',
        marketShare: 0.40,
        avgSpeed: 250,
        reliability: 0.92,
        riskOfBlocking: 'low',
        costEstimate: '$$$$$',
        providers: [
          'Bright Data', 'Oxylabs', 'ScraperAPI', 'Smartproxy'
        ]
      },
      'datacenter': {
        name: 'Datacenter IPs',
        type: 'datacenter',
        marketShare: 0.35,
        avgSpeed: 50,
        reliability: 0.98,
        riskOfBlocking: 'high',
        costEstimate: '$$',
        providers: [
          'AWS', 'Google Cloud', 'DigitalOcean', 'Linode'
        ]
      },
      'vpn': {
        name: 'VPN Services',
        type: 'vpn',
        marketShare: 0.15,
        avgSpeed: 100,
        reliability: 0.95,
        riskOfBlocking: 'medium',
        costEstimate: '$',
        providers: [
          'NordVPN', 'ExpressVPN', 'Windscribe', 'ProtonVPN'
        ]
      },
      'mobile': {
        name: 'Mobile Proxies',
        type: 'mobile',
        marketShare: 0.10,
        avgSpeed: 150,
        reliability: 0.88,
        riskOfBlocking: 'very-low',
        costEstimate: '$$$$',
        providers: [
          'Bright Data Mobile', 'Oxylabs Mobile', 'Zyte Mobile'
        ]
      }
    };
  }

  /**
   * Register a proxy with intelligence system
   */
  registerProxy(proxyAddress, metadata = {}) {
    const proxyId = crypto.randomBytes(8).toString('hex');

    const proxy = {
      id: proxyId,
      address: proxyAddress,
      detectedProvider: metadata.provider || this.detectProvider(proxyAddress),
      detectedType: metadata.type || this.detectProxyType(proxyAddress),
      geoLocation: metadata.geoLocation || this.guessGeoLocation(proxyAddress),
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgLatency: 0,
        blockingIncidents: 0,
        lastUsed: null
      },
      reputation: 0.5,
      status: 'untested',
      registeredAt: Date.now(),
      lastValidated: null,
      validationError: null
    };

    this.proxies.set(proxyId, proxy);
    this.providerReputation.set(proxy.detectedProvider, 0.5);

    return proxy;
  }

  /**
   * Create a proxy session for investigation
   */
  createProxySession(sessionId, options = {}) {
    const session = {
      id: sessionId,
      createdAt: Date.now(),
      currentProxy: null,
      geoLocation: options.preferredGeoLocation || 'US',
      geoConsistency: {
        requiredConsistency: options.geoConsistency !== false,
        allowedCountries: options.allowedCountries || ['US', 'UK', 'CA', 'AU'],
        currentCountry: options.preferredGeoLocation || 'US',
        lastRotationTime: null
      },
      proxyHistory: [],
      rotationStrategy: options.rotationStrategy || 'smart', // smart, random, round-robin
      failureHistory: [],
      performanceMetrics: {
        avgLatency: 0,
        totalRequests: 0,
        blockedRequests: 0
      },
      preferredProviderType: options.preferredProviderType || 'residential',
      avoidBlockedProxies: options.avoidBlockedProxies !== false
    };

    this.sessions.set(sessionId, session);

    return {
      sessionId,
      status: 'initialized',
      geoLocation: session.geoLocation,
      geoConsistency: session.geoConsistency.requiredConsistency,
      rotationStrategy: session.rotationStrategy
    };
  }

  /**
   * Get best proxy for session (intelligent selection)
   */
  getBestProxy(sessionId, targetUrl = null) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Get candidate proxies based on session preferences
    let candidates = Array.from(this.proxies.values())
      .filter(p => {
        // Filter by provider type
        if (session.preferredProviderType &&
            p.detectedType !== session.preferredProviderType) {
          return false;
        }

        // Filter by geo consistency
        if (session.geoConsistency.requiredConsistency) {
          if (p.geoLocation !== session.geoConsistency.currentCountry) {
            return false;
          }
        }

        // Filter blocked proxies
        if (session.avoidBlockedProxies && p.metrics.blockingIncidents > 2) {
          return false;
        }

        // Filter dead proxies
        if (p.status === 'dead') {
          return false;
        }

        return true;
      });

    if (candidates.length === 0) {
      throw new Error('No suitable proxies available for session');
    }

    // Score candidates
    const scored = candidates.map(proxy => ({
      proxy,
      score: this.scoreProxy(proxy, session)
    }));

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    const selectedProxy = scored[0].proxy;

    // Update session
    session.currentProxy = selectedProxy.id;
    session.proxyHistory.push({
      proxyId: selectedProxy.id,
      timestamp: Date.now(),
      geo: selectedProxy.geoLocation
    });

    return {
      proxy: selectedProxy,
      score: scored[0].score,
      ranking: scored.map(s => s.proxy.id),
      recommendation: scored[0].score > 0.7 ? 'excellent' : 'good',
      alternativeProxies: scored.slice(1, 3).map(s => s.proxy)
    };
  }

  /**
   * Score proxy for session
   */
  scoreProxy(proxy, session) {
    let score = 0;

    // Reputation (40%)
    const reputationScore = this.providerReputation.get(proxy.detectedProvider) || 0.5;
    score += reputationScore * 0.4;

    // Performance (30%)
    const avgLatency = proxy.metrics.avgLatency || 100;
    const performanceScore = Math.max(0, 1 - (avgLatency / 1000));
    score += performanceScore * 0.3;

    // Reliability (20%)
    const successRate = proxy.metrics.totalRequests > 0
      ? proxy.metrics.successfulRequests / proxy.metrics.totalRequests
      : 1;
    score += successRate * 0.2;

    // Geo consistency bonus (10%)
    if (proxy.geoLocation === session.geoConsistency.currentCountry) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  /**
   * Detect proxy provider from IP address
   */
  detectProvider(ipAddress) {
    // In real implementation, would use IP intelligence APIs
    // For now, simulate detection

    const octets = ipAddress.split('.').map(Number);

    // Simulate provider detection based on IP ranges
    const simulatedProviders = ['Bright Data', 'Oxylabs', 'AWS', 'NordVPN', 'Zyte'];

    return simulatedProviders[octets[0] % simulatedProviders.length];
  }

  /**
   * Detect proxy type
   */
  detectProxyType(ipAddress) {
    // Simulate type detection
    const types = ['residential', 'datacenter', 'vpn', 'mobile'];
    const hash = ipAddress.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    return types[hash % types.length];
  }

  /**
   * Guess geographic location from IP
   */
  guessGeoLocation(ipAddress) {
    // Simulate geo detection
    const locations = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'SG'];
    const hash = ipAddress.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    return locations[hash % locations.length];
  }

  /**
   * Record proxy request (CVE-W14-NEW-004: FIXED)
   * Now validates result data before using it
   */
  recordProxyRequest(sessionId, proxyId, result = {}) {
    const session = this.sessions.get(sessionId);
    const proxy = this.proxies.get(proxyId);

    if (!session || !proxy) {
      throw new Error('Session or proxy not found');
    }

    // CVE-W14-NEW-004: FIXED - Validate result parameters
    const validatedResult = this._validateProxyResult(result);
    if (!validatedResult.valid) {
      throw new Error(`Invalid proxy result: ${validatedResult.errors.join(', ')}`);
    }

    const success = validatedResult.data.success !== false;
    const latency = validatedResult.data.latency || 0;

    // Update proxy metrics
    proxy.metrics.totalRequests++;
    if (success) {
      proxy.metrics.successfulRequests++;
    } else {
      proxy.metrics.failedRequests++;
      if (validatedResult.data.blocked) {
        proxy.metrics.blockingIncidents++;
      }
    }

    // Update average latency (moving average)
    proxy.metrics.avgLatency =
      (proxy.metrics.avgLatency * (proxy.metrics.totalRequests - 1) + latency) /
      proxy.metrics.totalRequests;

    proxy.metrics.lastUsed = Date.now();

    // Update session metrics
    session.performanceMetrics.totalRequests++;
    if (!success) {
      session.performanceMetrics.blockedRequests++;
    }

    // Update provider reputation
    const providerKey = proxy.detectedProvider;
    let repScore = this.providerReputation.get(providerKey) || 0.5;

    if (success) {
      repScore = Math.min(1, repScore + 0.01);
    } else {
      repScore = Math.max(0, repScore - 0.05);
    }

    this.providerReputation.set(providerKey, repScore);

    // Check for blocking pattern
    if (proxy.metrics.blockingIncidents > 2) {
      proxy.status = 'potentially-blocked';
    }

    return {
      recorded: true,
      proxyStatus: proxy.status,
      reputation: repScore,
      metrics: proxy.metrics
    };
  }

  /**
   * Validate proxy result data (CVE-W14-NEW-004)
   * @private
   */
  _validateProxyResult(result) {
    const errors = [];

    // Validate success field
    if (typeof result.success !== 'boolean' && result.success !== undefined && result.success !== false) {
      errors.push('success must be boolean');
    }

    // Validate latency
    if (result.latency !== undefined) {
      if (typeof result.latency !== 'number' || result.latency < 0) {
        errors.push('latency must be non-negative number');
      }
      if (result.latency > 300000) { // 5 minutes max
        errors.push('latency exceeds maximum threshold (5 minutes)');
      }
    }

    // Validate blocked flag
    if (result.blocked !== undefined && typeof result.blocked !== 'boolean') {
      errors.push('blocked must be boolean');
    }

    return {
      valid: errors.length === 0,
      errors,
      data: result
    };
  }

  /**
   * Rotate proxy intelligently
   */
  rotateProxy(sessionId, reason = 'scheduled') {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const oldProxyId = session.currentProxy;

    // Blacklist old proxy if rotating due to blocking
    if (reason === 'blocked') {
      const oldProxy = this.proxies.get(oldProxyId);
      if (oldProxy) {
        oldProxy.metrics.blockingIncidents++;
      }

      session.failureHistory.push({
        proxyId: oldProxyId,
        reason: 'blocked',
        timestamp: Date.now()
      });
    }

    // Get new proxy
    try {
      const newSelection = this.getBestProxy(sessionId);
      const newProxyId = newSelection.proxy.id;

      // Validate geo consistency
      if (session.geoConsistency.requiredConsistency) {
        const newProxy = this.proxies.get(newProxyId);
        if (newProxy.geoLocation !== session.geoConsistency.currentCountry) {
          throw new Error('Geo-consistency violation in new proxy selection');
        }
      }

      return {
        rotated: true,
        previousProxy: oldProxyId,
        newProxy: newProxyId,
        reason,
        timestamp: Date.now(),
        alternativeAvailable: newSelection.alternativeProxies.length > 0
      };
    } catch (error) {
      return {
        rotated: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Validate proxy (test connectivity)
   */
  async validateProxy(proxyId) {
    const proxy = this.proxies.get(proxyId);
    if (!proxy) {
      throw new Error(`Proxy not found: ${proxyId}`);
    }

    // Simulate validation
    const isValid = Math.random() > 0.1; // 90% success rate
    const latency = 50 + Math.floor(Math.random() * 200);

    if (isValid) {
      proxy.status = 'healthy';
      proxy.lastValidated = Date.now();
      proxy.validationError = null;
      proxy.metrics.avgLatency = latency;
    } else {
      proxy.status = 'failed';
      proxy.lastValidated = Date.now();
      proxy.validationError = 'Connection timeout';
    }

    return {
      proxyId,
      status: proxy.status,
      latency: isValid ? latency : null,
      validatedAt: Date.now()
    };
  }

  /**
   * Get provider intelligence
   */
  getProviderIntelligence(providerType = null) {
    if (providerType) {
      return this.providers[providerType] || null;
    }

    // Return all providers with current reputation
    return Object.entries(this.providers).map(([type, provider]) => ({
      ...provider,
      currentReputation: this.providerReputation.get(provider.name) || 0.5
    }));
  }

  /**
   * Get session proxy intelligence
   */
  getSessionIntelligence(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const currentProxy = session.currentProxy
      ? this.proxies.get(session.currentProxy)
      : null;

    return {
      sessionId,
      currentProxy: currentProxy ? {
        id: currentProxy.id,
        provider: currentProxy.detectedProvider,
        type: currentProxy.detectedType,
        geoLocation: currentProxy.geoLocation,
        reputation: this.providerReputation.get(currentProxy.detectedProvider),
        status: currentProxy.status
      } : null,
      geoConsistency: {
        enforced: session.geoConsistency.requiredConsistency,
        currentCountry: session.geoConsistency.currentCountry,
        allowedCountries: session.geoConsistency.allowedCountries
      },
      proxyHistory: session.proxyHistory.slice(-10),
      failureHistory: session.failureHistory.slice(-5),
      performanceMetrics: {
        ...session.performanceMetrics,
        blockRate: session.performanceMetrics.totalRequests > 0
          ? (session.performanceMetrics.blockedRequests / session.performanceMetrics.totalRequests)
          : 0
      }
    };
  }

  /**
   * Get proxy pool statistics
   */
  getProxyPoolStats() {
    const proxies = Array.from(this.proxies.values());

    if (proxies.length === 0) {
      return { totalProxies: 0 };
    }

    const byType = {};
    const byStatus = {};

    for (const proxy of proxies) {
      byType[proxy.detectedType] = (byType[proxy.detectedType] || 0) + 1;
      byStatus[proxy.status] = (byStatus[proxy.status] || 0) + 1;
    }

    const avgReputation = Array.from(this.providerReputation.values())
      .reduce((a, b) => a + b, 0) / this.providerReputation.size;

    return {
      totalProxies: proxies.length,
      byType,
      byStatus,
      avgReputation: Math.round(avgReputation * 100),
      totalSessions: this.sessions.size
    };
  }

  /**
   * Recommend proxy rotation strategy
   */
  recommendRotationStrategy(targetSite) {
    // Simulate detection of site's blocking tolerance
    const blockingTolerance = Math.random();

    if (blockingTolerance > 0.7) {
      return {
        strategy: 'aggressive',
        rotationInterval: 300000, // 5 minutes
        description: 'Site has strict blocking. Rotate every 5 minutes.'
      };
    } else if (blockingTolerance > 0.4) {
      return {
        strategy: 'moderate',
        rotationInterval: 1800000, // 30 minutes
        description: 'Site has moderate blocking. Rotate every 30 minutes.'
      };
    } else {
      return {
        strategy: 'conservative',
        rotationInterval: 3600000, // 1 hour
        description: 'Site has low blocking risk. Rotate every hour.'
      };
    }
  }
}

module.exports = ProxyIntelligence;

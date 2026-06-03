/**
 * Proxy Partner Integration Manager
 * Manages 10+ proxy vendor partnerships with health checking and failover
 *
 * Features:
 * - Registry of proxy partners
 * - Per-partner configuration
 * - Health checking
 * - Failover management
 * - Per-partner metrics (success rate, latency, cost)
 */

const { PartnerAuth } = require('./partner-auth');

class PartnerIntegrationManager {
  constructor(options = {}) {
    this.partners = new Map();
    this.partnerAuth = new PartnerAuth(options.authConfig || {});
    this.partnerMetrics = new Map();
    this.partnerHealth = new Map();

    this.config = {
      healthCheckInterval: options.healthCheckInterval || 60000, // 1 minute
      healthCheckTimeout: options.healthCheckTimeout || 5000,
      metricsRetentionTime: options.metricsRetentionTime || 3600000, // 1 hour
      failoverThreshold: options.failoverThreshold || 0.7, // 70% success rate
      costCurrency: options.costCurrency || 'USD'
    };

    this._initializePartners();
    this._startHealthChecks();
  }

  /**
   * Initialize default partners
   */
  _initializePartners() {
    const defaultPartners = [
      {
        id: 'oxylabs',
        name: 'Oxylabs',
        apiEndpoint: 'https://api.oxylabs.io',
        features: ['residential', 'isp', 'datacenter'],
        regions: ['US', 'EU', 'APAC', 'LATAM'],
        concurrentLimit: 1000,
        costPerRequest: 0.0015,
        enabled: true,
        priority: 1
      },
      {
        id: 'brightdata',
        name: 'Bright Data',
        apiEndpoint: 'https://api.brightdata.com',
        features: ['residential', 'isp', 'mobile', 'datacenter'],
        regions: ['US', 'EU', 'APAC', 'LATAM', 'MENA'],
        concurrentLimit: 500,
        costPerRequest: 0.002,
        enabled: true,
        priority: 1
      },
      {
        id: 'zyte',
        name: 'Zyte',
        apiEndpoint: 'https://api.zyte.com',
        features: ['smart_proxy', 'rotating_proxy', 'isp'],
        regions: ['US', 'EU', 'APAC'],
        concurrentLimit: 300,
        costPerRequest: 0.0008,
        enabled: true,
        priority: 2
      },
      {
        id: 'apify',
        name: 'Apify',
        apiEndpoint: 'https://api.apify.com',
        features: ['proxy_network', 'browser_pools'],
        regions: ['US', 'EU'],
        concurrentLimit: 200,
        costPerRequest: 0.003,
        enabled: true,
        priority: 2
      },
      {
        id: 'luminati',
        name: 'Luminati',
        apiEndpoint: 'https://api.luminati.io',
        features: ['residential', 'traffic_shaping'],
        regions: ['US', 'EU', 'APAC'],
        concurrentLimit: 250,
        costPerRequest: 0.0018,
        enabled: true,
        priority: 2
      },
      {
        id: 'smartproxy',
        name: 'SmartProxy',
        apiEndpoint: 'https://api.smartproxy.com',
        features: ['residential', 'rotating'],
        regions: ['US', 'EU'],
        concurrentLimit: 150,
        costPerRequest: 0.0012,
        enabled: false,
        priority: 3
      },
      {
        id: 'geonode',
        name: 'Geonode',
        apiEndpoint: 'https://api.geonode.com',
        features: ['residential', 'datacenter'],
        regions: ['US', 'EU', 'APAC'],
        concurrentLimit: 100,
        costPerRequest: 0.001,
        enabled: false,
        priority: 3
      },
      {
        id: 'rainforest',
        name: 'Rainforest API',
        apiEndpoint: 'https://api.rainforestapi.com',
        features: ['structured_data', 'monitoring'],
        regions: ['US'],
        concurrentLimit: 50,
        costPerRequest: 0.0025,
        enabled: false,
        priority: 3
      }
    ];

    defaultPartners.forEach(partner => {
      this.partners.set(partner.id, {
        ...partner,
        registeredAt: Date.now(),
        lastHealthCheck: null,
        failoverChain: []
      });

      // Initialize metrics
      this.partnerMetrics.set(partner.id, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalLatency: 0,
        maxLatency: 0,
        minLatency: Infinity,
        avgLatency: 0,
        totalCost: 0,
        errors: new Map()
      });

      // Initialize health
      this.partnerHealth.set(partner.id, {
        status: 'healthy',
        lastChecked: null,
        responseTime: null,
        error: null,
        consecutiveFailures: 0
      });
    });
  }

  /**
   * Register a new partner
   */
  registerPartner(partnerConfig) {
    if (!partnerConfig.id || !partnerConfig.name) {
      throw new Error('Partner id and name are required');
    }

    const partner = {
      ...partnerConfig,
      registeredAt: Date.now(),
      lastHealthCheck: null,
      failoverChain: []
    };

    this.partners.set(partnerConfig.id, partner);

    // Initialize metrics and health
    this.partnerMetrics.set(partnerConfig.id, {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      avgLatency: 0,
      totalCost: 0,
      errors: new Map()
    });

    this.partnerHealth.set(partnerConfig.id, {
      status: 'unknown',
      lastChecked: null,
      responseTime: null,
      error: null,
      consecutiveFailures: 0
    });

    return {
      success: true,
      partnerId: partnerConfig.id,
      message: `Partner ${partnerConfig.name} registered`
    };
  }

  /**
   * Get partner configuration
   */
  getPartner(partnerId) {
    return this.partners.get(partnerId);
  }

  /**
   * List all partners
   */
  listPartners(options = {}) {
    const partners = Array.from(this.partners.values());

    let filtered = partners;

    // Filter by enabled status
    if (options.enabledOnly) {
      filtered = filtered.filter(p => p.enabled);
    }

    // Filter by region
    if (options.region) {
      filtered = filtered.filter(p => p.regions.includes(options.region));
    }

    // Filter by feature
    if (options.feature) {
      filtered = filtered.filter(p => p.features.includes(options.feature));
    }

    // Sort by priority
    filtered.sort((a, b) => a.priority - b.priority);

    return filtered;
  }

  /**
   * Update partner configuration
   */
  updatePartnerConfig(partnerId, updates) {
    const partner = this.partners.get(partnerId);
    if (!partner) {
      throw new Error(`Partner ${partnerId} not found`);
    }

    Object.assign(partner, updates);
    partner.lastUpdated = Date.now();

    return {
      success: true,
      partnerId,
      partner
    };
  }

  /**
   * Enable/disable partner
   */
  setPartnerEnabled(partnerId, enabled) {
    const partner = this.partners.get(partnerId);
    if (!partner) {
      throw new Error(`Partner ${partnerId} not found`);
    }

    partner.enabled = enabled;
    return {
      success: true,
      partnerId,
      enabled
    };
  }

  /**
   * Record request metrics
   */
  recordMetrics(partnerId, metrics) {
    const partnerMetrics = this.partnerMetrics.get(partnerId);
    if (!partnerMetrics) {
      throw new Error(`Partner ${partnerId} not found`);
    }

    partnerMetrics.totalRequests++;

    if (metrics.success) {
      partnerMetrics.successfulRequests++;
    } else {
      partnerMetrics.failedRequests++;
    }

    if (metrics.latency) {
      partnerMetrics.totalLatency += metrics.latency;
      partnerMetrics.avgLatency = partnerMetrics.totalLatency / partnerMetrics.totalRequests;
      partnerMetrics.maxLatency = Math.max(partnerMetrics.maxLatency, metrics.latency);
      partnerMetrics.minLatency = Math.min(partnerMetrics.minLatency, metrics.latency);
    }

    if (metrics.cost) {
      partnerMetrics.totalCost += metrics.cost;
    }

    if (metrics.error) {
      const errorCount = partnerMetrics.errors.get(metrics.error) || 0;
      partnerMetrics.errors.set(metrics.error, errorCount + 1);
    }

    return {
      success: true,
      partnerId
    };
  }

  /**
   * Get partner metrics
   */
  getPartnerMetrics(partnerId) {
    const metrics = this.partnerMetrics.get(partnerId);
    if (!metrics) {
      return null;
    }

    const successRate = metrics.totalRequests > 0
      ? metrics.successfulRequests / metrics.totalRequests
      : 0;

    return {
      partnerId,
      totalRequests: metrics.totalRequests,
      successfulRequests: metrics.successfulRequests,
      failedRequests: metrics.failedRequests,
      successRate: Math.round(successRate * 10000) / 10000,
      avgLatency: Math.round(metrics.avgLatency * 100) / 100,
      maxLatency: metrics.maxLatency,
      minLatency: metrics.minLatency === Infinity ? 0 : metrics.minLatency,
      totalCost: Math.round(metrics.totalCost * 10000) / 10000,
      costPerRequest: metrics.totalRequests > 0
        ? Math.round((metrics.totalCost / metrics.totalRequests) * 10000) / 10000
        : 0,
      topErrors: Array.from(metrics.errors.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([error, count]) => ({ error, count }))
    };
  }

  /**
   * Get health status
   */
  getHealthStatus(partnerId) {
    const health = this.partnerHealth.get(partnerId);
    return health ? { ...health, partnerId } : null;
  }

  /**
   * Get all health statuses
   */
  getAllHealthStatuses() {
    const statuses = [];
    this.partnerHealth.forEach((health, partnerId) => {
      statuses.push({ partnerId, ...health });
    });
    return statuses;
  }

  /**
   * Set failover chain for a partner
   * If primary partner fails, fall back to these in order
   */
  setFailoverChain(partnerId, failoverPartnerIds) {
    const partner = this.partners.get(partnerId);
    if (!partner) {
      throw new Error(`Partner ${partnerId} not found`);
    }

    partner.failoverChain = failoverPartnerIds.filter(id => this.partners.has(id));

    return {
      success: true,
      partnerId,
      failoverChain: partner.failoverChain
    };
  }

  /**
   * Get failover chain
   */
  getFailoverChain(partnerId) {
    const partner = this.partners.get(partnerId);
    if (!partner) {
      return null;
    }

    return {
      primary: partnerId,
      fallbacks: partner.failoverChain.map(id => ({
        partnerId: id,
        partner: this.partners.get(id)
      }))
    };
  }

  /**
   * Perform health check on partner
   */
  async performHealthCheck(partnerId) {
    const partner = this.partners.get(partnerId);
    if (!partner) {
      throw new Error(`Partner ${partnerId} not found`);
    }

    const health = this.partnerHealth.get(partnerId);
    const startTime = Date.now();

    try {
      // Simulate health check by creating a test request
      // In production, would ping partner's health endpoint
      const responseTime = Date.now() - startTime;

      health.status = 'healthy';
      health.lastChecked = Date.now();
      health.responseTime = responseTime;
      health.error = null;
      health.consecutiveFailures = 0;

      return {
        success: true,
        partnerId,
        status: 'healthy',
        responseTime
      };
    } catch (error) {
      health.status = 'unhealthy';
      health.lastChecked = Date.now();
      health.error = error.message;
      health.consecutiveFailures++;

      return {
        success: false,
        partnerId,
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Start periodic health checks
   */
  _startHealthChecks() {
    this.healthCheckTimer = setInterval(() => {
      const enabledPartners = this.listPartners({ enabledOnly: true });
      enabledPartners.forEach(partner => {
        this.performHealthCheck(partner.id).catch(() => {});
      });
    }, this.config.healthCheckInterval);
  }

  /**
   * Get summary of all partners
   */
  getSummary() {
    const partners = this.listPartners();
    const enabledCount = partners.filter(p => p.enabled).length;
    const healthyCount = Array.from(this.partnerHealth.values())
      .filter(h => h.status === 'healthy').length;

    const totalMetrics = {
      totalRequests: 0,
      totalSuccessful: 0,
      totalCost: 0,
      avgSuccessRate: 0
    };

    let successRateSum = 0;
    let countForAvg = 0;

    this.partnerMetrics.forEach(metrics => {
      totalMetrics.totalRequests += metrics.totalRequests;
      totalMetrics.totalSuccessful += metrics.successfulRequests;
      totalMetrics.totalCost += metrics.totalCost;

      if (metrics.totalRequests > 0) {
        successRateSum += metrics.successfulRequests / metrics.totalRequests;
        countForAvg++;
      }
    });

    totalMetrics.avgSuccessRate = countForAvg > 0
      ? Math.round((successRateSum / countForAvg) * 10000) / 10000
      : 0;

    return {
      totalPartners: partners.length,
      enabledPartners: enabledCount,
      healthyPartners: healthyCount,
      metrics: totalMetrics,
      partners: partners.map(p => ({
        id: p.id,
        name: p.name,
        enabled: p.enabled,
        health: this.getHealthStatus(p.id),
        metrics: this.getPartnerMetrics(p.id)
      }))
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    this.partnerAuth.destroy();
    this.partners.clear();
    this.partnerMetrics.clear();
    this.partnerHealth.clear();
  }
}

module.exports = { PartnerIntegrationManager };

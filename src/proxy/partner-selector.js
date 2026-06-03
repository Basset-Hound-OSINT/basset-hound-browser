/**
 * Intelligent Partner Selector
 * Select best proxy partner based on:
 * - Region availability
 * - Cost optimization
 * - Performance (latency)
 * - Reliability (success rate)
 * - Concurrency (available capacity)
 */

class PartnerSelector {
  constructor(partnerManager, options = {}) {
    this.partnerManager = partnerManager;

    this.config = {
      cacheTTL: options.cacheTTL || 5 * 60 * 1000, // 5 minutes
      weightings: {
        region: options.regionWeight || 0.25,
        cost: options.costWeight || 0.20,
        performance: options.performanceWeight || 0.30,
        reliability: options.reliabilityWeight || 0.15,
        concurrency: options.concurrencyWeight || 0.10
      },
      defaultPreference: options.defaultPreference || 'balanced' // balanced, cost, performance
    };

    this.selectionCache = new Map();
    this.selectionHistory = new Map();
  }

  /**
   * Select best partner for request
   */
  selectPartner(options = {}) {
    try {
      // Generate cache key
      const cacheKey = this._generateCacheKey(options);

      // Check cache
      const cached = this.selectionCache.get(cacheKey);
      if (cached && Date.now() - cached.selectedAt < this.config.cacheTTL) {
        return {
          success: true,
          partnerId: cached.partnerId,
          partner: this.partnerManager.getPartner(cached.partnerId),
          reason: 'cached',
          selectedAt: cached.selectedAt,
          score: cached.score
        };
      }

      // Get available partners
      const candidates = this._getAvailablePartners(options);
      if (candidates.length === 0) {
        throw new Error('No available partners for selection criteria');
      }

      // Score each partner
      const scored = candidates.map(partner => {
        const score = this._scorePartner(partner, options);
        return { partner, score };
      });

      // Sort by score (highest first)
      scored.sort((a, b) => b.score - a.score);

      const selected = scored[0];

      // Cache result
      this.selectionCache.set(cacheKey, {
        partnerId: selected.partner.id,
        score: selected.score,
        selectedAt: Date.now()
      });

      // Record in history
      this._recordSelection(selected.partner.id, options);

      return {
        success: true,
        partnerId: selected.partner.id,
        partner: selected.partner,
        reason: 'selected',
        score: Math.round(selected.score * 10000) / 10000,
        ranking: scored.slice(0, 3).map((s, idx) => ({
          rank: idx + 1,
          partnerId: s.partner.id,
          name: s.partner.name,
          score: Math.round(s.score * 10000) / 10000
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Select partner with fallback chain
   */
  selectWithFailover(options = {}) {
    try {
      const selection = this.selectPartner(options);
      if (!selection.success) {
        throw new Error(selection.error);
      }

      const primaryPartnerId = selection.partnerId;
      const failoverChain = this.partnerManager.getFailoverChain(primaryPartnerId);

      return {
        success: true,
        primary: {
          partnerId: primaryPartnerId,
          partner: selection.partner,
          score: selection.score
        },
        failover: failoverChain ? failoverChain.fallbacks : [],
        reason: selection.reason
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get selection statistics
   */
  getSelectionStats() {
    const stats = {
      totalSelections: 0,
      partnerStats: new Map()
    };

    this.selectionHistory.forEach((selections, partnerId) => {
      stats.totalSelections += selections.length;
      stats.partnerStats.set(partnerId, {
        selections: selections.length,
        percentage: 0,
        lastSelected: Math.max(...selections)
      });
    });

    // Calculate percentages
    if (stats.totalSelections > 0) {
      stats.partnerStats.forEach((stat, partnerId) => {
        stat.percentage = Math.round((stat.selections / stats.totalSelections) * 10000) / 10000;
      });
    }

    return {
      totalSelections: stats.totalSelections,
      partnerStats: Array.from(stats.partnerStats.entries()).map(([partnerId, stat]) => ({
        partnerId,
        ...stat
      }))
    };
  }

  /**
   * Clear selection cache
   */
  clearCache() {
    this.selectionCache.clear();
    return { success: true, message: 'Selection cache cleared' };
  }

  /**
   * Get selection recommendations for region
   */
  getRecommendationsForRegion(region) {
    const partners = this.partnerManager.listPartners({
      enabledOnly: true,
      region
    });

    if (partners.length === 0) {
      return {
        region,
        recommendations: [],
        message: `No partners available for region ${region}`
      };
    }

    const scored = partners.map(partner => {
      const metrics = this.partnerManager.getPartnerMetrics(partner.id);
      const health = this.partnerManager.getHealthStatus(partner.id);

      return {
        partnerId: partner.id,
        name: partner.name,
        successRate: metrics.successRate,
        avgLatency: metrics.avgLatency,
        costPerRequest: metrics.costPerRequest,
        health: health.status,
        score: this._scorePartner(partner, { region })
      };
    });

    scored.sort((a, b) => b.score - a.score);

    return {
      region,
      recommendations: scored.map((s, idx) => ({
        rank: idx + 1,
        ...s
      }))
    };
  }

  // Private helper methods

  /**
   * Generate cache key from selection options
   */
  _generateCacheKey(options) {
    const parts = [
      options.region || 'any',
      options.proxyType || 'any',
      options.preference || this.config.defaultPreference
    ];
    return parts.join(':');
  }

  /**
   * Get available partners for selection criteria
   */
  _getAvailablePartners(options) {
    let partners = this.partnerManager.listPartners({
      enabledOnly: true
    });

    // Filter by region
    if (options.region) {
      partners = partners.filter(p => p.regions.includes(options.region));
    }

    // Filter by feature/proxy type
    if (options.proxyType) {
      partners = partners.filter(p => p.features.includes(options.proxyType));
    }

    // Filter by health status
    partners = partners.filter(p => {
      const health = this.partnerManager.getHealthStatus(p.id);
      return health && health.status === 'healthy';
    });

    return partners;
  }

  /**
   * Score partner based on multiple criteria
   */
  _scorePartner(partner, options) {
    let score = 0;

    // Region availability (0-1)
    const regionScore = options.region && partner.regions.includes(options.region) ? 1 : 0.5;
    score += regionScore * this.config.weightings.region;

    // Cost optimization (0-1, higher is cheaper)
    const costScore = 1 - (partner.costPerRequest / 0.003); // Normalize to max 0.003
    score += Math.max(0, Math.min(1, costScore)) * this.config.weightings.cost;

    // Performance/Latency (0-1, lower latency is better)
    const metrics = this.partnerManager.getPartnerMetrics(partner.id);
    const performanceScore = Math.max(0, 1 - (metrics.avgLatency / 1000)); // Normalize to 1s max
    score += performanceScore * this.config.weightings.performance;

    // Reliability (success rate)
    const reliabilityScore = metrics.successRate;
    score += reliabilityScore * this.config.weightings.reliability;

    // Concurrency (available capacity)
    const concurrencyScore = Math.min(1, partner.concurrentLimit / 500);
    score += concurrencyScore * this.config.weightings.concurrency;

    // Apply preference weighting
    if (options.preference === 'cost') {
      score *= (1 + (costScore * 0.5)); // Boost cost-effective partners
    } else if (options.preference === 'performance') {
      score *= (1 + (performanceScore * 0.5)); // Boost fast partners
    }

    return score;
  }

  /**
   * Record selection in history
   */
  _recordSelection(partnerId, options) {
    if (!this.selectionHistory.has(partnerId)) {
      this.selectionHistory.set(partnerId, []);
    }

    this.selectionHistory.get(partnerId).push({
      timestamp: Date.now(),
      options
    });

    // Keep only last 1000 selections per partner
    const history = this.selectionHistory.get(partnerId);
    if (history.length > 1000) {
      history.shift();
    }
  }
}

module.exports = { PartnerSelector };

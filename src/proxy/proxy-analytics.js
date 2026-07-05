/**
 * Basset Hound Browser - Proxy Analytics & Reporting
 * Comprehensive metrics collection and analysis for proxy operations
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 *
 * Features:
 * - Success rate tracking (proxy, provider, region)
 * - Block rate analysis
 * - Response time metrics
 * - User agent acceptance rates
 * - Geographic accuracy reporting
 * - CSV/JSON export for external analysis
 */

class ProxyAnalytics {
  constructor(options = {}) {
    this.metrics = new Map(); // metricsKey -> metricData
    this.timeSeriesData = new Map(); // sessionId -> timeSeries
    this.aggregationWindow = options.aggregationWindow || 300000; // 5 minutes
    this.retentionPeriod = options.retentionPeriod || 86400000; // 24 hours
    this.reportGenerationInterval = options.reportGenerationInterval || 3600000; // 1 hour
    this.historicalReports = [];
  }

  /**
   * Record proxy request metrics
   */
  recordProxyRequest(proxyMetrics = {}) {
    const {
      proxyId,
      region,
      provider,
      country,
      success,
      latency,
      blocked,
      captcha,
      ratelimited,
      userAgent,
      userAgentAccepted,
      timestamp = Date.now()
    } = proxyMetrics;

    // Record by proxy
    this.updateMetrics(`proxy:${proxyId}`, {
      proxyId,
      region,
      provider,
      country,
      success,
      latency,
      blocked,
      captcha,
      ratelimited,
      userAgentAccepted,
      timestamp
    });

    // Record by provider
    if (provider) {
      this.updateMetrics(`provider:${provider}`, {
        provider,
        success,
        latency,
        blocked,
        captcha,
        ratelimited,
        timestamp
      });
    }

    // Record by region
    if (region) {
      this.updateMetrics(`region:${region}`, {
        region,
        success,
        latency,
        blocked,
        captcha,
        ratelimited,
        timestamp
      });
    }

    // Record by country
    if (country) {
      this.updateMetrics(`country:${country}`, {
        country,
        success,
        latency,
        blocked,
        captcha,
        ratelimited,
        timestamp
      });
    }

    return {
      recorded: true,
      metricsUpdated: [
        `proxy:${proxyId}`,
        provider ? `provider:${provider}` : null,
        region ? `region:${region}` : null,
        country ? `country:${country}` : null
      ].filter(Boolean)
    };
  }

  /**
   * Update metrics aggregation
   */
  updateMetrics(metricsKey, data) {
    if (!this.metrics.has(metricsKey)) {
      this.metrics.set(metricsKey, {
        key: metricsKey,
        createdAt: Date.now(),
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        blockedRequests: 0,
        captchaRequests: 0,
        ratelimitedRequests: 0,
        totalLatency: 0,
        requestsWithLatency: 0,
        userAgentAccepted: 0,
        userAgentRejected: 0,
        detections: {
          byCountry: new Map(),
          byUserAgent: new Map()
        },
        timeSeriesSnapshots: []
      });
    }

    const metrics = this.metrics.get(metricsKey);

    metrics.totalRequests++;
    metrics.lastUpdated = Date.now();

    if (data.success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
      if (data.blocked) {
        metrics.blockedRequests++;
      }
      if (data.captcha) {
        metrics.captchaRequests++;
      }
      if (data.ratelimited) {
        metrics.ratelimitedRequests++;
      }
    }

    if (data.latency !== undefined) {
      metrics.totalLatency += data.latency;
      metrics.requestsWithLatency++;
    }

    if (data.userAgentAccepted) {
      metrics.userAgentAccepted++;
    } else if (data.userAgentAccepted === false) {
      metrics.userAgentRejected++;
    }

    // Track country detection
    if (data.country) {
      const countryCount = metrics.detections.byCountry.get(data.country) || 0;
      metrics.detections.byCountry.set(data.country, countryCount + 1);
    }

    // Track user agent usage
    if (data.userAgent) {
      const uaCount = metrics.detections.byUserAgent.get(data.userAgent) || 0;
      metrics.detections.byUserAgent.set(data.userAgent, uaCount + 1);
    }
  }

  /**
   * Record session time series data
   */
  recordSessionTimeSeries(sessionId, timeSeriesPoint) {
    if (!this.timeSeriesData.has(sessionId)) {
      this.timeSeriesData.set(sessionId, []);
    }

    this.timeSeriesData.get(sessionId).push({
      ...timeSeriesPoint,
      recordedAt: Date.now()
    });
  }

  /**
   * Get metrics for specific proxy
   */
  getProxyMetrics(proxyId) {
    const metricsKey = `proxy:${proxyId}`;
    return this.formatMetricsReport(metricsKey);
  }

  /**
   * Get metrics for provider
   */
  getProviderMetrics(provider) {
    const metricsKey = `provider:${provider}`;
    return this.formatMetricsReport(metricsKey);
  }

  /**
   * Get metrics for region
   */
  getRegionMetrics(region) {
    const metricsKey = `region:${region}`;
    return this.formatMetricsReport(metricsKey);
  }

  /**
   * Get metrics for country
   */
  getCountryMetrics(country) {
    const metricsKey = `country:${country}`;
    return this.formatMetricsReport(metricsKey);
  }

  /**
   * Format metrics report
   */
  formatMetricsReport(metricsKey) {
    const metrics = this.metrics.get(metricsKey);

    if (!metrics) {
      return null;
    }

    const totalRequests = metrics.totalRequests;
    const successRate = totalRequests > 0
      ? (metrics.successfulRequests / totalRequests * 100).toFixed(1)
      : 0;

    const blockRate = totalRequests > 0
      ? (metrics.blockedRequests / totalRequests * 100).toFixed(1)
      : 0;

    const captchaRate = totalRequests > 0
      ? (metrics.captchaRequests / totalRequests * 100).toFixed(1)
      : 0;

    const ratelimitRate = totalRequests > 0
      ? (metrics.ratelimitedRequests / totalRequests * 100).toFixed(1)
      : 0;

    const avgLatency = metrics.requestsWithLatency > 0
      ? Math.round(metrics.totalLatency / metrics.requestsWithLatency)
      : 0;

    const userAgentTotal = metrics.userAgentAccepted + metrics.userAgentRejected;
    const userAgentAcceptanceRate = userAgentTotal > 0
      ? (metrics.userAgentAccepted / userAgentTotal * 100).toFixed(1)
      : 100;

    return {
      key: metricsKey,
      totalRequests,
      successRate: parseFloat(successRate),
      blockRate: parseFloat(blockRate),
      captchaRate: parseFloat(captchaRate),
      ratelimitRate: parseFloat(ratelimitRate),
      averageLatency: avgLatency,
      userAgentAcceptanceRate: parseFloat(userAgentAcceptanceRate),
      createdAt: metrics.createdAt,
      lastUpdated: metrics.lastUpdated,
      detections: {
        primaryCountry: this.getMostCommonCountry(metrics.detections.byCountry),
        countryDistribution: this.formatCountryDistribution(metrics.detections.byCountry),
        primaryUserAgent: this.getMostCommonUserAgent(metrics.detections.byUserAgent)
      }
    };
  }

  /**
   * Compare metrics across proxies
   */
  compareProxies(proxyIds = []) {
    const comparison = {
      proxies: [],
      bestPerformer: null,
      worstPerformer: null,
      averageSuccessRate: 0,
      averageLatency: 0
    };

    const reports = [];
    for (const proxyId of proxyIds) {
      const report = this.getProxyMetrics(proxyId);
      if (report) {
        reports.push(report);
      }
    }

    if (reports.length === 0) {
      return null;
    }

    comparison.proxies = reports;

    // Calculate averages
    let totalSuccessRate = 0;
    let totalLatency = 0;

    for (const report of reports) {
      totalSuccessRate += report.successRate;
      totalLatency += report.averageLatency;
    }

    comparison.averageSuccessRate = (totalSuccessRate / reports.length).toFixed(1);
    comparison.averageLatency = Math.round(totalLatency / reports.length);

    // Find best and worst
    reports.sort((a, b) => b.successRate - a.successRate);
    comparison.bestPerformer = reports[0];
    comparison.worstPerformer = reports[reports.length - 1];

    return comparison;
  }

  /**
   * Get recommendations based on metrics
   */
  getRecommendations() {
    const recommendations = {
      highPerformers: [],
      needsAttention: [],
      shouldExclude: []
    };

    for (const [metricsKey, metrics] of this.metrics) {
      if (!metricsKey.startsWith('proxy:')) {
        continue;
      }

      const report = this.formatMetricsReport(metricsKey);
      if (!report) {
        continue;
      }

      if (report.successRate > 95 && report.blockRate < 2) {
        recommendations.highPerformers.push({
          proxy: metricsKey,
          successRate: report.successRate,
          blockRate: report.blockRate,
          recommendation: 'Excellent - Use for sensitive operations'
        });
      } else if (report.successRate < 70 || report.blockRate > 15) {
        recommendations.needsAttention.push({
          proxy: metricsKey,
          successRate: report.successRate,
          blockRate: report.blockRate,
          recommendation: 'Monitor for potential issues'
        });
      }

      if (report.successRate < 50 && report.totalRequests > 50) {
        recommendations.shouldExclude.push({
          proxy: metricsKey,
          successRate: report.successRate,
          totalRequests: report.totalRequests,
          recommendation: 'Consider excluding from rotation'
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate comprehensive report
   */
  generateReport(reportId = null) {
    const timestamp = Date.now();
    const reportIdActual = reportId || `report-${timestamp}`;

    const report = {
      reportId: reportIdActual,
      generatedAt: timestamp,
      metrics: {
        total: this.metrics.size,
        proxies: 0,
        providers: 0,
        regions: 0,
        countries: 0
      },
      summary: {
        totalRequests: 0,
        totalSuccessful: 0,
        totalBlocked: 0,
        averageSuccessRate: 0,
        averageLatency: 0,
        averageBlockRate: 0
      },
      topPerformers: [],
      poorPerformers: [],
      recommendations: this.getRecommendations()
    };

    let totalSuccessRate = 0;
    let totalLatency = 0;
    let totalBlockRate = 0;
    let metricsCount = 0;

    const allMetricsReports = [];

    for (const [metricsKey, metrics] of this.metrics) {
      const formattedReport = this.formatMetricsReport(metricsKey);
      if (!formattedReport) {
        continue;
      }

      allMetricsReports.push(formattedReport);

      // Count types
      if (metricsKey.startsWith('proxy:')) {
        report.metrics.proxies++;
      } else if (metricsKey.startsWith('provider:')) {
        report.metrics.providers++;
      } else if (metricsKey.startsWith('region:')) {
        report.metrics.regions++;
      } else if (metricsKey.startsWith('country:')) {
        report.metrics.countries++;
      }

      report.summary.totalRequests += formattedReport.totalRequests;
      report.summary.totalSuccessful += Math.round(formattedReport.totalRequests * formattedReport.successRate / 100);
      report.summary.totalBlocked += Math.round(formattedReport.totalRequests * formattedReport.blockRate / 100);
      totalSuccessRate += formattedReport.successRate;
      totalLatency += formattedReport.averageLatency;
      totalBlockRate += formattedReport.blockRate;
      metricsCount++;
    }

    if (metricsCount > 0) {
      report.summary.averageSuccessRate = (totalSuccessRate / metricsCount).toFixed(1);
      report.summary.averageLatency = Math.round(totalLatency / metricsCount);
      report.summary.averageBlockRate = (totalBlockRate / metricsCount).toFixed(1);
    }

    // Get top performers
    allMetricsReports.sort((a, b) => b.successRate - a.successRate);
    report.topPerformers = allMetricsReports.slice(0, 5);
    report.poorPerformers = allMetricsReports.slice(-5).reverse();

    this.historicalReports.push(report);

    return report;
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(metricsKeys = null) {
    const data = {
      exportedAt: Date.now(),
      metrics: []
    };

    if (metricsKeys === null) {
      // Export all
      for (const [metricsKey] of this.metrics) {
        const report = this.formatMetricsReport(metricsKey);
        if (report) {
          data.metrics.push(report);
        }
      }
    } else if (Array.isArray(metricsKeys)) {
      // Export specific
      for (const metricsKey of metricsKeys) {
        const report = this.formatMetricsReport(metricsKey);
        if (report) {
          data.metrics.push(report);
        }
      }
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Export metrics as CSV
   */
  exportCSV(metricsKeys = null) {
    const headers = [
      'Key',
      'Total Requests',
      'Success Rate (%)',
      'Block Rate (%)',
      'CAPTCHA Rate (%)',
      'Rate Limit Rate (%)',
      'Average Latency (ms)',
      'User Agent Acceptance (%)'
    ];

    const rows = [headers];

    if (metricsKeys === null) {
      // Export all
      for (const [metricsKey] of this.metrics) {
        const report = this.formatMetricsReport(metricsKey);
        if (report) {
          rows.push(this.formatMetricsAsCSVRow(report));
        }
      }
    } else if (Array.isArray(metricsKeys)) {
      // Export specific
      for (const metricsKey of metricsKeys) {
        const report = this.formatMetricsReport(metricsKey);
        if (report) {
          rows.push(this.formatMetricsAsCSVRow(report));
        }
      }
    }

    return rows.map(row => row.join(',')).join('\n');
  }

  /**
   * Get geographic accuracy report
   */
  getGeographicAccuracyReport() {
    const report = {
      totalDetections: 0,
      countryDetections: {},
      accuracy: 0,
      consistency: 0
    };

    for (const [metricsKey, metrics] of this.metrics) {
      if (metricsKey.startsWith('country:')) {
        const country = metricsKey.replace('country:', '');
        report.countryDetections[country] = {
          detections: metrics.totalRequests,
          successRate: metrics.totalRequests > 0
            ? (metrics.successfulRequests / metrics.totalRequests * 100).toFixed(1)
            : 0
        };
        report.totalDetections += metrics.totalRequests;
      }
    }

    return report;
  }

  // Helper methods

  getMostCommonCountry(countryMap) {
    let maxCountry = null;
    let maxCount = 0;

    for (const [country, count] of countryMap) {
      if (count > maxCount) {
        maxCount = count;
        maxCountry = country;
      }
    }

    return maxCountry;
  }

  getMostCommonUserAgent(userAgentMap) {
    let maxUA = null;
    let maxCount = 0;

    for (const [ua, count] of userAgentMap) {
      if (count > maxCount) {
        maxCount = count;
        maxUA = ua;
      }
    }

    return maxUA;
  }

  formatCountryDistribution(countryMap) {
    const distribution = {};
    const total = Array.from(countryMap.values()).reduce((a, b) => a + b, 0);

    for (const [country, count] of countryMap) {
      distribution[country] = {
        count,
        percentage: total > 0 ? (count / total * 100).toFixed(1) : 0
      };
    }

    return distribution;
  }

  formatMetricsAsCSVRow(report) {
    return [
      report.key,
      report.totalRequests,
      report.successRate.toFixed(1),
      report.blockRate.toFixed(1),
      report.captchaRate.toFixed(1),
      report.ratelimitRate.toFixed(1),
      report.averageLatency,
      report.userAgentAcceptanceRate.toFixed(1)
    ];
  }
}

module.exports = ProxyAnalytics;

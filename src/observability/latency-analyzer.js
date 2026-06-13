/**
 * Latency Analysis for Basset Hound Browser
 *
 * Provides:
 * - Component-level latency breakdown
 * - Bottleneck identification
 * - Performance trend tracking
 * - SLA monitoring
 *
 * Features:
 * - Hierarchical latency analysis
 * - Percentile-based metrics
 * - Performance attribution
 * - Latency patterns detection
 * - Historical trend analysis
 */

const EventEmitter = require('events');

class LatencyAnalyzer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      enableHistogram: options.enableHistogram !== false,
      enablePercentiles: options.enablePercentiles !== false,
      enableTrendAnalysis: options.enableTrendAnalysis !== false,
      bucketSize: options.bucketSize || 1, // ms
      historySize: options.historySize || 1000,
      percentiles: options.percentiles || [50, 90, 95, 99, 99.9],
      slaThresholds: options.slaThresholds || { critical: 100, high: 500, medium: 1000, low: 5000 },
      ...options
    };

    this.spanLatencies = new Map();
    this.componentLatencies = new Map();
    this.latencyHistograms = new Map();
    this.latencyTrends = new Map();
    this.bottlenecks = new Map();
    this.slaViolations = new Map();
    this.performanceHistory = [];
  }

  /**
   * Record latency for span
   */
  recordSpanLatency(spanId, spanData) {
    const latency = {
      spanId,
      spanName: spanData.spanName || 'unknown',
      startTime: spanData.startTime || Date.now(),
      endTime: spanData.endTime || Date.now(),
      duration: spanData.duration || (spanData.endTime - spanData.startTime || 0),
      component: spanData.component || null,
      operation: spanData.operation || null,
      serviceName: spanData.serviceName || null,
      status: spanData.status || 'ok', // ok, slow, timeout, error
      statusCode: spanData.statusCode || null,
      parentSpanId: spanData.parentSpanId || null,
      childSpans: new Set(),
      childLatencySum: 0,
      ownLatency: spanData.duration || 0,
      recordedAt: Date.now(),
      attributes: spanData.attributes || {}
    };

    this.spanLatencies.set(spanId, latency);
    this._updateComponentLatency(latency.component, latency.duration);
    this._updateHistogram(spanId, latency.duration);
    this._updateTrend(spanId, latency);
    this._checkSLAViolation(latency);

    this.emit('latency:recorded', {
      spanId,
      component: latency.component,
      duration: latency.duration,
      status: latency.status
    });

    return latency;
  }

  /**
   * Record component latency breakdown
   */
  recordComponentLatency(componentName, componentData) {
    const componentLatency = {
      componentName,
      measurements: [],
      totalDuration: 0,
      count: 0,
      minDuration: Infinity,
      maxDuration: 0,
      avgDuration: 0,
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      stdDev: 0,
      subcomponents: new Map(),
      recordedAt: Date.now()
    };

    if (!this.componentLatencies.has(componentName)) {
      this.componentLatencies.set(componentName, componentLatency);
    }

    const existing = this.componentLatencies.get(componentName);
    existing.measurements.push(componentData);
    existing.totalDuration += componentData.duration || 0;
    existing.count++;
    existing.minDuration = Math.min(existing.minDuration, componentData.duration || 0);
    existing.maxDuration = Math.max(existing.maxDuration, componentData.duration || 0);
    existing.avgDuration = existing.totalDuration / existing.count;

    // Update percentiles
    this._calculatePercentiles(existing);

    this.emit('componentLatency:recorded', {
      componentName,
      duration: componentData.duration,
      avgDuration: existing.avgDuration,
      count: existing.count
    });

    return existing;
  }

  /**
   * Analyze latency breakdown hierarchy
   */
  analyzeLatencyHierarchy(rootSpanId) {
    const rootSpan = this.spanLatencies.get(rootSpanId);
    if (!rootSpan) {
      return null;
    }

    const hierarchy = {
      rootSpanId,
      rootSpanName: rootSpan.spanName,
      rootLatency: rootSpan.duration,
      levels: [],
      totalChildLatency: 0,
      ownLatency: 0,
      components: {}
    };

    const visited = new Set();
    const processSpan = (spanId, level = 0) => {
      if (visited.has(spanId)) return;
      visited.add(spanId);

      const span = this.spanLatencies.get(spanId);
      if (!span) return;

      if (!hierarchy.levels[level]) {
        hierarchy.levels[level] = [];
      }

      const levelItem = {
        spanId,
        spanName: span.spanName,
        latency: span.duration,
        percentage: ((span.duration / hierarchy.rootLatency) * 100).toFixed(2),
        component: span.component,
        children: []
      };

      hierarchy.levels[level].push(levelItem);
      hierarchy.totalChildLatency += span.duration;

      if (span.component) {
        if (!hierarchy.components[span.component]) {
          hierarchy.components[span.component] = { latency: 0, count: 0 };
        }
        hierarchy.components[span.component].latency += span.duration;
        hierarchy.components[span.component].count++;
      }

      // Find child spans
      for (const [otherSpanId, otherSpan] of this.spanLatencies) {
        if (otherSpan.parentSpanId === spanId) {
          processSpan(otherSpanId, level + 1);
        }
      }
    };

    processSpan(rootSpanId);
    hierarchy.ownLatency = hierarchy.rootLatency - (hierarchy.totalChildLatency - hierarchy.rootLatency);

    return hierarchy;
  }

  /**
   * Identify performance bottlenecks
   */
  identifyBottlenecks(threshold = 0.2) {
    const bottlenecks = [];
    const allSpans = Array.from(this.spanLatencies.values());

    // Calculate average latency
    const avgLatency = allSpans.length > 0
      ? allSpans.reduce((sum, s) => sum + s.duration, 0) / allSpans.length
      : 0;

    // Find spans exceeding threshold
    allSpans.forEach(span => {
      if (span.duration > (avgLatency * (1 + threshold))) {
        bottlenecks.push({
          spanId: span.spanId,
          spanName: span.spanName,
          component: span.component,
          latency: span.duration,
          excessLatency: span.duration - avgLatency,
          percentageAboveAvg: (((span.duration - avgLatency) / avgLatency) * 100).toFixed(2),
          severity: this._calculateBottleneckSeverity(span.duration, avgLatency)
        });
      }
    });

    // Sort by severity
    bottlenecks.sort((a, b) => b.latency - a.latency);

    this.bottlenecks.set(Date.now(), bottlenecks);

    this.emit('bottlenecks:identified', {
      count: bottlenecks.length,
      threshold,
      topBottleneck: bottlenecks.length > 0 ? bottlenecks[0] : null
    });

    return bottlenecks;
  }

  /**
   * Get performance trends
   */
  getPerformanceTrend(componentName, timeWindowMs = 300000) {
    const now = Date.now();
    const startTime = now - timeWindowMs;

    const componentSpans = Array.from(this.spanLatencies.values())
      .filter(s => s.component === componentName && s.recordedAt >= startTime);

    if (componentSpans.length === 0) {
      return null;
    }

    const durations = componentSpans.map(s => s.duration).sort((a, b) => a - b);
    const trend = {
      componentName,
      timeWindowMs,
      sampleCount: componentSpans.length,
      avgLatency: durations.reduce((a, b) => a + b, 0) / durations.length,
      minLatency: durations[0],
      maxLatency: durations[durations.length - 1],
      p50: this._percentile(durations, 50),
      p90: this._percentile(durations, 90),
      p99: this._percentile(durations, 99),
      standardDeviation: this._calculateStdDev(durations),
      trend: this._analyzeTrend(durations)
    };

    return trend;
  }

  /**
   * Get SLA compliance
   */
  getSLACompliance(componentName = null) {
    const spans = componentName
      ? Array.from(this.spanLatencies.values()).filter(s => s.component === componentName)
      : Array.from(this.spanLatencies.values());

    const slaThresholds = this.options.slaThresholds;
    const compliance = {
      componentName,
      totalSpans: spans.length,
      slaLevels: {}
    };

    for (const [level, threshold] of Object.entries(slaThresholds)) {
      const compliant = spans.filter(s => s.duration <= threshold).length;
      const percentage = spans.length > 0 ? ((compliant / spans.length) * 100).toFixed(2) : 0;
      compliance.slaLevels[level] = {
        threshold,
        compliant,
        total: spans.length,
        percentage: parseFloat(percentage),
        status: percentage >= 95 ? 'green' : percentage >= 85 ? 'yellow' : 'red'
      };
    }

    return compliance;
  }

  /**
   * Get detailed latency report
   */
  getLatencyReport(spanId) {
    const span = this.spanLatencies.get(spanId);
    if (!span) {
      return null;
    }

    const histogram = this.latencyHistograms.get(spanId) || {};
    const trend = this.latencyTrends.get(spanId) || {};

    return {
      spanId,
      spanName: span.spanName,
      component: span.component,
      duration: span.duration,
      status: span.status,
      statusCode: span.statusCode,
      recordedAt: span.recordedAt,
      histogram: histogram.buckets || [],
      histogramStats: {
        min: histogram.min,
        max: histogram.max,
        avg: histogram.avg,
        p50: histogram.p50,
        p90: histogram.p90,
        p99: histogram.p99
      },
      trend: {
        direction: trend.direction,
        changePercent: trend.changePercent,
        samples: trend.sampleCount
      },
      attributes: span.attributes
    };
  }

  /**
   * Get component comparison
   */
  getComponentComparison() {
    const components = Array.from(this.componentLatencies.entries());
    const comparison = {
      componentCount: components.length,
      components: []
    };

    components.forEach(([name, latency]) => {
      comparison.components.push({
        name,
        avgLatency: latency.avgDuration,
        minLatency: latency.minDuration,
        maxLatency: latency.maxDuration,
        p99: latency.p99,
        sampleCount: latency.count,
        slowestComponent: latency.maxDuration === Math.max(...Array.from(this.componentLatencies.values()).map(l => l.maxDuration))
      });
    });

    comparison.components.sort((a, b) => b.avgLatency - a.avgLatency);

    return comparison;
  }

  /**
   * Update histogram
   */
  _updateHistogram(spanId, duration) {
    if (!this.latencyHistograms.has(spanId)) {
      this.latencyHistograms.set(spanId, {
        buckets: [],
        min: duration,
        max: duration,
        sum: 0,
        count: 0,
        avg: 0,
        p50: 0,
        p90: 0,
        p99: 0
      });
    }

    const histogram = this.latencyHistograms.get(spanId);
    histogram.buckets.push(duration);
    histogram.min = Math.min(histogram.min, duration);
    histogram.max = Math.max(histogram.max, duration);
    histogram.sum += duration;
    histogram.count++;
    histogram.avg = histogram.sum / histogram.count;

    // Keep only recent history
    if (histogram.buckets.length > this.options.historySize) {
      histogram.buckets.shift();
    }

    this._calculatePercentiles(histogram);
  }

  /**
   * Update trend
   */
  _updateTrend(spanId, latency) {
    if (!this.latencyTrends.has(spanId)) {
      this.latencyTrends.set(spanId, {
        measurements: [],
        direction: 'stable',
        changePercent: 0,
        sampleCount: 0
      });
    }

    const trend = this.latencyTrends.get(spanId);
    trend.measurements.push(latency.duration);
    trend.sampleCount++;

    // Keep only recent measurements
    if (trend.measurements.length > 100) {
      trend.measurements.shift();
    }

    if (trend.measurements.length >= 2) {
      const recent = trend.measurements.slice(-10);
      const older = trend.measurements.slice(-20, -10);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

      trend.changePercent = (((recentAvg - olderAvg) / olderAvg) * 100).toFixed(2);
      if (trend.changePercent > 10) {
        trend.direction = 'increasing';
      } else if (trend.changePercent < -10) {
        trend.direction = 'decreasing';
      } else {
        trend.direction = 'stable';
      }
    }
  }

  /**
   * Update component latency
   */
  _updateComponentLatency(component, duration) {
    if (!component) return;

    if (!this.componentLatencies.has(component)) {
      this.recordComponentLatency(component, { duration });
    } else {
      const comp = this.componentLatencies.get(component);
      comp.measurements.push({ duration });
      comp.totalDuration += duration;
      comp.count++;
      comp.avgDuration = comp.totalDuration / comp.count;
      comp.minDuration = Math.min(comp.minDuration, duration);
      comp.maxDuration = Math.max(comp.maxDuration, duration);
      this._calculatePercentiles(comp);
    }
  }

  /**
   * Check SLA violation
   */
  _checkSLAViolation(latency) {
    const slaThresholds = this.options.slaThresholds;
    for (const [level, threshold] of Object.entries(slaThresholds)) {
      if (latency.duration > threshold) {
        if (!this.slaViolations.has(level)) {
          this.slaViolations.set(level, []);
        }
        this.slaViolations.get(level).push({
          spanId: latency.spanId,
          duration: latency.duration,
          threshold,
          excess: latency.duration - threshold,
          timestamp: latency.recordedAt
        });

        this.emit('sla:violated', {
          level,
          spanId: latency.spanId,
          threshold,
          actual: latency.duration
        });
      }
    }
  }

  /**
   * Calculate percentiles
   */
  _calculatePercentiles(data) {
    if (!data.measurements || data.measurements.length === 0) {
      return;
    }

    const values = data.measurements.map(m => m.duration || m).sort((a, b) => a - b);
    data.p50 = this._percentile(values, 50);
    data.p90 = this._percentile(values, 90);
    data.p95 = this._percentile(values, 95);
    data.p99 = this._percentile(values, 99);
    data.stdDev = this._calculateStdDev(values);
  }

  /**
   * Calculate percentile value
   */
  _percentile(arr, p) {
    if (arr.length === 0) return 0;
    const index = (p / 100) * (arr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (lower === upper) return arr[lower];
    return arr[lower] * (1 - weight) + arr[upper] * weight;
  }

  /**
   * Calculate standard deviation
   */
  _calculateStdDev(arr) {
    if (arr.length === 0) return 0;
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const squareDiffs = arr.map(v => Math.pow(v - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Calculate bottleneck severity
   */
  _calculateBottleneckSeverity(latency, avg) {
    const ratio = latency / avg;
    if (ratio > 5) return 'critical';
    if (ratio > 3) return 'high';
    if (ratio > 2) return 'medium';
    return 'low';
  }

  /**
   * Analyze trend direction
   */
  _analyzeTrend(values) {
    if (values.length < 2) return 'insufficient_data';
    const recent = values.slice(-10);
    const older = values.slice(0, Math.max(1, Math.floor(values.length / 2)));
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  /**
   * Close system
   */
  close() {
    this.spanLatencies.clear();
    this.componentLatencies.clear();
    this.latencyHistograms.clear();
    this.latencyTrends.clear();
    this.bottlenecks.clear();
    this.slaViolations.clear();
    this.emit('system:closed');
  }
}

module.exports = LatencyAnalyzer;

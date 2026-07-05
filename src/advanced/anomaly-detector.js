/**
 * Anomaly Detection Engine - Detect unusual patterns in website monitoring data
 * Uses statistical analysis to identify anomalies in change frequency and patterns
 * @module src/advanced/anomaly-detector
 */

const EventEmitter = require('events');

/**
 * Anomaly Detection Strategies
 */
const DETECTION_STRATEGIES = {
  Z_SCORE: 'z-score', // Standard deviation-based detection
  IQR: 'iqr', // Interquartile range method
  MOVING_AVERAGE: 'moving-average', // Moving average deviation
  EXPONENTIAL: 'exponential', // Exponential smoothing
  PERCENTILE: 'percentile' // Percentile-based thresholds
};

/**
 * Anomaly Detector Class
 */
class AnomalyDetector extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      strategy: options.strategy || DETECTION_STRATEGIES.Z_SCORE,
      zScoreThreshold: options.zScoreThreshold || 2.5, // 2.5 standard deviations
      iqrMultiplier: options.iqrMultiplier || 1.5, // IQR * 1.5 for outliers
      movingAverageWindow: options.movingAverageWindow || 7, // 7-day window
      percentileThreshold: options.percentileThreshold || 95, // 95th percentile
      minDataPoints: options.minDataPoints || 5,
      seasonalPeriod: options.seasonalPeriod || 7, // 7 days for weekly seasonality
      adaptiveThreshold: options.adaptiveThreshold !== false, // Learn thresholds
      enableAlerts: options.enableAlerts !== false,
      ...options
    };

    // State management
    this.monitors = new Map(); // monitorId -> { baseline, history, stats }
    this.anomalies = new Map(); // monitorId -> [anomalies]
    this.learningPhase = new Map(); // monitorId -> { active, iterations }
    this.seasonalPatterns = new Map(); // monitorId -> { dayOfWeekPattern, timeOfDayPattern }
  }

  /**
   * Add monitor baseline from historical data
   * @param {string} monitorId - Monitor ID
   * @param {Array} changeHistory - Historical change data
   * @returns {Object} Baseline statistics
   */
  addMonitor(monitorId, changeHistory = []) {
    const baseline = this.calculateBaseline(changeHistory);

    this.monitors.set(monitorId, {
      baseline,
      history: changeHistory.slice(),
      stats: this.calculateStatistics(changeHistory),
      changeFrequency: [],
      anomalyCount: 0,
      lastUpdate: Date.now()
    });

    // Detect seasonal patterns from history
    if (changeHistory.length > this.options.seasonalPeriod * 2) {
      this.detectSeasonalPatterns(monitorId, changeHistory);
      this.learningPhase.set(monitorId, { active: false, iterations: 0 });
    } else {
      this.learningPhase.set(monitorId, { active: true, iterations: 0 });
    }

    this.emit('monitor-added', { monitorId, baseline });
    return baseline;
  }

  /**
   * Analyze a change event for anomalies
   * @param {string} monitorId - Monitor ID
   * @param {Object} change - Change event data
   * @returns {Object} Anomaly analysis result
   */
  analyzeChange(monitorId, change) {
    if (!this.monitors.has(monitorId)) {
      this.addMonitor(monitorId, []);
    }

    const monitor = this.monitors.get(monitorId);
    const analysis = {
      monitorId,
      timestamp: change.timestamp || Date.now(),
      isAnomaly: false,
      anomalyScore: 0,
      severity: 'normal',
      reasons: [],
      detectionMethod: this.options.strategy,
      baselineStats: monitor.stats,
      changeData: change
    };

    // Update history
    monitor.history.push(change);
    if (monitor.history.length > 1000) {
      monitor.history = monitor.history.slice(-1000);
    }

    // Skip anomaly detection during learning phase
    if (this.learningPhase.get(monitorId)?.active) {
      const learning = this.learningPhase.get(monitorId);
      learning.iterations++;

      // Exit learning phase after 50 observations
      if (learning.iterations >= 50) {
        this.learningPhase.set(monitorId, { active: false, iterations: 50 });
        monitor.stats = this.calculateStatistics(monitor.history);
        this.detectSeasonalPatterns(monitorId, monitor.history);
      }

      return analysis;
    }

    // Detect anomalies based on strategy
    const detectionResult = this.detectAnomalyByStrategy(monitorId, change);

    analysis.isAnomaly = detectionResult.isAnomaly;
    analysis.anomalyScore = detectionResult.score;
    analysis.severity = detectionResult.severity;
    analysis.reasons = detectionResult.reasons;

    // Track anomalies
    if (analysis.isAnomaly) {
      if (!this.anomalies.has(monitorId)) {
        this.anomalies.set(monitorId, []);
      }
      this.anomalies.get(monitorId).push(analysis);
      monitor.anomalyCount++;

      if (this.options.enableAlerts) {
        this.emit('anomaly-detected', analysis);
      }
    }

    // Update moving metrics
    monitor.changeFrequency.push({
      timestamp: change.timestamp || Date.now(),
      magnitude: change.magnitude || 1
    });
    if (monitor.changeFrequency.length > 100) {
      monitor.changeFrequency = monitor.changeFrequency.slice(-100);
    }

    monitor.lastUpdate = Date.now();

    return analysis;
  }

  /**
   * Detect anomalies using selected strategy
   * @private
   */
  detectAnomalyByStrategy(monitorId, change) {
    const monitor = this.monitors.get(monitorId);
    const strategy = this.options.strategy;

    switch (strategy) {
    case DETECTION_STRATEGIES.Z_SCORE:
      return this.detectByZScore(monitor, change);
    case DETECTION_STRATEGIES.IQR:
      return this.detectByIQR(monitor, change);
    case DETECTION_STRATEGIES.MOVING_AVERAGE:
      return this.detectByMovingAverage(monitor, change);
    case DETECTION_STRATEGIES.EXPONENTIAL:
      return this.detectByExponentialSmoothing(monitor, change);
    case DETECTION_STRATEGIES.PERCENTILE:
      return this.detectByPercentile(monitor, change);
    default:
      return { isAnomaly: false, score: 0, severity: 'normal', reasons: [] };
    }
  }

  /**
   * Z-Score based anomaly detection
   * @private
   */
  detectByZScore(monitor, change) {
    const magnitude = change.magnitude || 1;
    const mean = monitor.stats.mean || 0;
    const stdDev = monitor.stats.stdDev || 1;

    const zScore = stdDev === 0 ? 0 : Math.abs((magnitude - mean) / stdDev);
    const isAnomaly = zScore > this.options.zScoreThreshold;
    const severity = this.calculateSeverity(zScore, this.options.zScoreThreshold);

    return {
      isAnomaly,
      score: Math.min(zScore / this.options.zScoreThreshold, 1.0),
      severity,
      reasons: isAnomaly ? [`Z-score ${zScore.toFixed(2)} exceeds threshold ${this.options.zScoreThreshold}`] : []
    };
  }

  /**
   * Interquartile Range based detection
   * @private
   */
  detectByIQR(monitor, change) {
    const magnitude = change.magnitude || 1;
    const q1 = monitor.stats.q1 || 0;
    const q3 = monitor.stats.q3 || 0;
    const iqr = q3 - q1;

    const lowerBound = q1 - (iqr * this.options.iqrMultiplier);
    const upperBound = q3 + (iqr * this.options.iqrMultiplier);

    const isAnomaly = magnitude < lowerBound || magnitude > upperBound;
    const distance = Math.min(
      Math.abs(magnitude - lowerBound),
      Math.abs(magnitude - upperBound)
    );
    const severity = this.calculateSeverity(distance, iqr || 1);

    return {
      isAnomaly,
      score: Math.min(distance / (iqr || 1), 1.0),
      severity,
      reasons: isAnomaly ? [`Value ${magnitude} outside IQR bounds [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`] : []
    };
  }

  /**
   * Moving Average based detection
   * @private
   */
  detectByMovingAverage(monitor, change) {
    const magnitude = change.magnitude || 1;
    const window = this.options.movingAverageWindow;
    const recent = monitor.changeFrequency.slice(-window).map(c => c.magnitude || 1);

    if (recent.length === 0) {
      return { isAnomaly: false, score: 0, severity: 'normal', reasons: [] };
    }

    const movingAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const movingStdDev = Math.sqrt(
      recent.reduce((sum, val) => sum + Math.pow(val - movingAvg, 2), 0) / recent.length
    );

    const deviation = Math.abs(magnitude - movingAvg);
    const threshold = movingStdDev * 2;
    const isAnomaly = deviation > threshold && recent.length >= window;

    const severity = this.calculateSeverity(deviation, threshold || 1);

    return {
      isAnomaly,
      score: Math.min(deviation / (threshold || 1), 1.0),
      severity,
      reasons: isAnomaly ? [`Change ${magnitude} deviates ${deviation.toFixed(2)} from ${window}-item moving average ${movingAvg.toFixed(2)}`] : []
    };
  }

  /**
   * Exponential Smoothing based detection
   * @private
   */
  detectByExponentialSmoothing(monitor, change) {
    const magnitude = change.magnitude || 1;
    const alpha = 0.3; // Smoothing factor

    let smoothed = monitor.stats.lastSmoothed || magnitude;
    const deviation = Math.abs(magnitude - smoothed);

    // Update smoothed value
    smoothed = alpha * magnitude + (1 - alpha) * smoothed;
    monitor.stats.lastSmoothed = smoothed;

    const threshold = (monitor.stats.stdDev || 1) * 2;
    const isAnomaly = deviation > threshold;
    const severity = this.calculateSeverity(deviation, threshold || 1);

    return {
      isAnomaly,
      score: Math.min(deviation / (threshold || 1), 1.0),
      severity,
      reasons: isAnomaly ? [`Smoothed change ${smoothed.toFixed(2)} deviates ${deviation.toFixed(2)} from value ${magnitude}`] : []
    };
  }

  /**
   * Percentile based detection
   * @private
   */
  detectByPercentile(monitor, change) {
    const magnitude = change.magnitude || 1;
    const percentile = this.options.percentileThreshold;
    const threshold = this.calculatePercentile(monitor.history.map(c => c.magnitude || 1), percentile);

    const isAnomaly = magnitude > threshold;
    const excess = magnitude - threshold;
    const severity = this.calculateSeverity(excess, threshold || 1);

    return {
      isAnomaly,
      score: Math.min(excess / (threshold || 1), 1.0),
      severity,
      reasons: isAnomaly ? [`Value ${magnitude} exceeds ${percentile}th percentile threshold ${threshold.toFixed(2)}`] : []
    };
  }

  /**
   * Calculate baseline statistics from historical data
   * @private
   */
  calculateBaseline(changeHistory) {
    if (changeHistory.length === 0) {
      return {
        mean: 0,
        stdDev: 0,
        q1: 0,
        median: 0,
        q3: 0,
        min: 0,
        max: 0
      };
    }

    const values = changeHistory.map(c => c.magnitude || 1).sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      stdDev,
      q1: this.calculatePercentile(values, 25),
      median: this.calculatePercentile(values, 50),
      q3: this.calculatePercentile(values, 75),
      min: values[0],
      max: values[values.length - 1]
    };
  }

  /**
   * Calculate comprehensive statistics
   * @private
   */
  calculateStatistics(changeHistory) {
    const baseline = this.calculateBaseline(changeHistory);

    return {
      ...baseline,
      count: changeHistory.length,
      frequency: changeHistory.length / (Math.max(...changeHistory.map(c => c.timestamp || 0)) - Math.min(...changeHistory.map(c => c.timestamp || 0)) || 1),
      skewness: this.calculateSkewness(changeHistory.map(c => c.magnitude || 1), baseline.mean, baseline.stdDev),
      kurtosis: this.calculateKurtosis(changeHistory.map(c => c.magnitude || 1), baseline.mean, baseline.stdDev)
    };
  }

  /**
   * Detect seasonal patterns in change data
   * @private
   */
  detectSeasonalPatterns(monitorId, changeHistory) {
    if (changeHistory.length < this.options.seasonalPeriod * 2) {
      return;
    }

    const patterns = {
      dayOfWeekPattern: {},
      hourOfDayPattern: {}
    };

    changeHistory.forEach(change => {
      const timestamp = change.timestamp || Date.now();
      const date = new Date(timestamp);
      const dayOfWeek = date.getDay();
      const hour = date.getHours();

      patterns.dayOfWeekPattern[dayOfWeek] = (patterns.dayOfWeekPattern[dayOfWeek] || 0) + 1;
      patterns.hourOfDayPattern[hour] = (patterns.hourOfDayPattern[hour] || 0) + 1;
    });

    this.seasonalPatterns.set(monitorId, patterns);
  }

  /**
   * Get anomalies for a monitor
   * @param {string} monitorId - Monitor ID
   * @param {Object} options - Query options
   * @returns {Array} Anomalies
   */
  getAnomalies(monitorId, options = {}) {
    let anomalies = this.anomalies.get(monitorId) || [];

    if (options.since) {
      anomalies = anomalies.filter(a => a.timestamp >= options.since);
    }

    if (options.severity) {
      anomalies = anomalies.filter(a => a.severity === options.severity);
    }

    if (options.limit) {
      anomalies = anomalies.slice(-options.limit);
    }

    return anomalies;
  }

  /**
   * Get monitor baseline and statistics
   * @param {string} monitorId - Monitor ID
   * @returns {Object} Monitor statistics
   */
  getMonitorStats(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      return null;
    }

    return {
      monitorId,
      baseline: monitor.baseline,
      stats: monitor.stats,
      anomalyCount: monitor.anomalyCount,
      dataPoints: monitor.history.length,
      lastUpdate: new Date(monitor.lastUpdate).toISOString(),
      inLearningPhase: this.learningPhase.get(monitorId)?.active || false,
      seasonalPatterns: this.seasonalPatterns.get(monitorId)
    };
  }

  /**
   * Recalibrate monitor baseline
   * @param {string} monitorId - Monitor ID
   */
  recalibrateMonitor(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      return;
    }

    monitor.stats = this.calculateStatistics(monitor.history);
    monitor.baseline = this.calculateBaseline(monitor.history);
    this.detectSeasonalPatterns(monitorId, monitor.history);
    monitor.anomalyCount = 0;

    if (this.anomalies.has(monitorId)) {
      this.anomalies.delete(monitorId);
    }

    this.emit('monitor-recalibrated', { monitorId, stats: monitor.stats });
  }

  /**
   * Calculate percentile value
   * @private
   */
  calculatePercentile(values, percentile) {
    if (values.length === 0) {
      return 0;
    }
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate skewness
   * @private
   */
  calculateSkewness(values, mean, stdDev) {
    if (values.length < 3 || stdDev === 0) {
      return 0;
    }
    const cubed = values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0);
    return cubed / values.length;
  }

  /**
   * Calculate kurtosis
   * @private
   */
  calculateKurtosis(values, mean, stdDev) {
    if (values.length < 4 || stdDev === 0) {
      return 0;
    }
    const fourth = values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 4), 0);
    return (fourth / values.length) - 3;
  }

  /**
   * Calculate severity based on deviation
   * @private
   */
  calculateSeverity(deviation, threshold) {
    const ratio = deviation / (threshold || 1);
    if (ratio < 1) {
      return 'normal';
    }
    if (ratio < 1.5) {
      return 'low';
    }
    if (ratio < 2.5) {
      return 'medium';
    }
    if (ratio < 4) {
      return 'high';
    }
    return 'critical';
  }

  /**
   * Get summary statistics for all monitors
   * @returns {Object} Summary statistics
   */
  getSummary() {
    const summary = {
      monitorCount: this.monitors.size,
      totalAnomalies: Array.from(this.anomalies.values()).reduce((sum, arr) => sum + arr.length, 0),
      monitors: []
    };

    this.monitors.forEach((monitor, monitorId) => {
      summary.monitors.push({
        monitorId,
        anomalyCount: monitor.anomalyCount,
        dataPoints: monitor.history.length,
        inLearningPhase: this.learningPhase.get(monitorId)?.active || false
      });
    });

    return summary;
  }
}

module.exports = {
  AnomalyDetector,
  DETECTION_STRATEGIES
};

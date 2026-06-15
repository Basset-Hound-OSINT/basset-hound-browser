/**
 * Basset Hound Browser - Anomaly Detector Module
 *
 * Statistical analysis and outlier detection for bot detection.
 * Identifies statistical anomalies in fingerprints and behaviors.
 *
 * Features:
 * - Statistical baseline learning
 * - Outlier detection (Z-score, IQR methods)
 * - Temporal anomaly detection
 * - Pattern-based anomaly detection
 * - Adaptive thresholding
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

/**
 * Anomaly detection methods
 */
const DETECTION_METHODS = {
  Z_SCORE: 'z-score',
  IQR: 'iqr',
  ISOLATION_FOREST: 'isolation-forest',
  MAHALANOBIS: 'mahalanobis',
  TEMPORAL: 'temporal'
};

/**
 * Anomaly severity levels
 */
const ANOMALY_SEVERITY = {
  NORMAL: 'normal',
  MINOR: 'minor',
  MODERATE: 'moderate',
  SEVERE: 'severe',
  CRITICAL: 'critical'
};

/**
 * Anomaly Detector
 * Performs statistical analysis and outlier detection
 */
class AnomalyDetector {
  constructor(options = {}) {
    this.options = {
      enableLearning: options.enableLearning !== false,
      minSamplesForBaseline: options.minSamplesForBaseline || 30,
      zScoreThreshold: options.zScoreThreshold || 2.5,
      iqrMultiplier: options.iqrMultiplier || 1.5,
      learningRate: options.learningRate || 0.1,
      ...options
    };

    // Statistical baselines
    this.baselines = {
      fingerprints: {},
      behaviors: {},
      timings: {}
    };

    this.samples = {
      fingerprints: [],
      behaviors: [],
      timings: []
    };
  }

  /**
   * Add a sample for baseline learning
   * @param {string} sampleType - Type of sample (fingerprints, behaviors, timings)
   * @param {Object} sample - Sample data
   * @returns {void}
   */
  addSample(sampleType, sample) {
    if (!this.samples[sampleType]) {
      this.samples[sampleType] = [];
    }

    this.samples[sampleType].push({
      data: sample,
      timestamp: Date.now()
    });

    // Trigger baseline update if enough samples
    if (this.samples[sampleType].length >= this.options.minSamplesForBaseline) {
      this._updateBaseline(sampleType);
    }
  }

  /**
   * Update baseline statistics from samples
   * @private
   * @param {string} sampleType - Type of sample
   * @returns {void}
   */
  _updateBaseline(sampleType) {
    const samples = this.samples[sampleType];
    if (samples.length === 0) return;

    const values = samples.map(s => s.data);

    // Calculate statistics
    const stats = this._calculateStatistics(values);
    this.baselines[sampleType] = {
      mean: stats.mean,
      stdDev: stats.stdDev,
      min: stats.min,
      max: stats.max,
      q1: stats.q1,
      q2: stats.q2,
      q3: stats.q3,
      iqr: stats.iqr,
      sampleCount: samples.length,
      lastUpdated: Date.now()
    };
  }

  /**
   * Calculate statistical measures
   * @private
   * @param {Array} values - Array of values
   * @returns {Object}
   */
  _calculateStatistics(values) {
    if (values.length === 0) {
      return {
        mean: 0,
        stdDev: 0,
        min: 0,
        max: 0,
        q1: 0,
        q2: 0,
        q3: 0,
        iqr: 0
      };
    }

    // Flatten values if they're objects
    let flatValues = [];
    for (const v of values) {
      if (typeof v === 'number') {
        flatValues.push(v);
      } else if (typeof v === 'object' && v.value !== undefined) {
        flatValues.push(v.value);
      }
    }

    if (flatValues.length === 0) {
      return {
        mean: 0,
        stdDev: 0,
        min: 0,
        max: 0,
        q1: 0,
        q2: 0,
        q3: 0,
        iqr: 0
      };
    }

    flatValues.sort((a, b) => a - b);

    const mean = flatValues.reduce((a, b) => a + b, 0) / flatValues.length;
    const variance = flatValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / flatValues.length;
    const stdDev = Math.sqrt(variance);

    const getQuartile = (q) => {
      const index = (q / 100) * (flatValues.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index % 1;

      if (lower === upper) {
        return flatValues[lower];
      }

      return flatValues[lower] * (1 - weight) + flatValues[upper] * weight;
    };

    const q1 = getQuartile(25);
    const q2 = getQuartile(50);
    const q3 = getQuartile(75);
    const iqr = q3 - q1;

    return {
      mean,
      stdDev,
      min: flatValues[0],
      max: flatValues[flatValues.length - 1],
      q1,
      q2,
      q3,
      iqr
    };
  }

  /**
   * Detect anomalies in fingerprint data
   * @param {Object} fingerprintData - Fingerprint data to analyze
   * @param {string} method - Detection method (z-score, iqr, etc.)
   * @returns {Object} Anomaly detection results
   */
  detectFingerprintAnomalies(fingerprintData, method = DETECTION_METHODS.Z_SCORE) {
    const anomalies = [];
    let totalScore = 0;

    // Check each fingerprint component
    for (const [key, value] of Object.entries(fingerprintData)) {
      const anomaly = this._detectValueAnomaly(value, method, `fingerprint.${key}`);
      if (anomaly) {
        anomalies.push(anomaly);
        totalScore += anomaly.score;
      }
    }

    const severity = this._scoreToSeverity(totalScore);

    return {
      timestamp: Date.now(),
      dataType: 'fingerprints',
      method,
      anomalies,
      totalAnomalyScore: totalScore,
      severity,
      anomalyCount: anomalies.length,
      isAnomaly: anomalies.length > 0,
      confidence: this._calculateConfidence(anomalies)
    };
  }

  /**
   * Detect anomalies in behavioral data
   * @param {Object} behaviorData - Behavior data to analyze
   * @param {string} method - Detection method
   * @returns {Object} Anomaly detection results
   */
  detectBehaviorAnomalies(behaviorData, method = DETECTION_METHODS.Z_SCORE) {
    const anomalies = [];
    let totalScore = 0;

    // Analyze timing patterns
    if (behaviorData.timings && Array.isArray(behaviorData.timings)) {
      const timingAnomalies = this._detectTimingAnomalies(behaviorData.timings, method);
      anomalies.push(...timingAnomalies);
      totalScore += timingAnomalies.reduce((sum, a) => sum + a.score, 0);
    }

    // Analyze event sequences
    if (behaviorData.events && Array.isArray(behaviorData.events)) {
      const sequenceAnomalies = this._detectSequenceAnomalies(behaviorData.events);
      anomalies.push(...sequenceAnomalies);
      totalScore += sequenceAnomalies.reduce((sum, a) => sum + a.score, 0);
    }

    const severity = this._scoreToSeverity(totalScore);

    return {
      timestamp: Date.now(),
      dataType: 'behaviors',
      method,
      anomalies,
      totalAnomalyScore: totalScore,
      severity,
      anomalyCount: anomalies.length,
      isAnomaly: anomalies.length > 0,
      confidence: this._calculateConfidence(anomalies)
    };
  }

  /**
   * Detect anomalies in a single value
   * @private
   * @param {*} value - Value to analyze
   * @param {string} method - Detection method
   * @param {string} fieldName - Field name
   * @returns {Object|null}
   */
  _detectValueAnomaly(value, method, fieldName) {
    const baseline = this.baselines.fingerprints;

    if (!baseline.mean || baseline.sampleCount === 0) {
      return null; // No baseline yet
    }

    let score = 0;
    let isAnomaly = false;

    if (typeof value === 'number') {
      if (method === DETECTION_METHODS.Z_SCORE) {
        const zScore = Math.abs((value - baseline.mean) / (baseline.stdDev || 1));
        if (zScore > this.options.zScoreThreshold) {
          isAnomaly = true;
          score = Math.min(1.0, zScore / 5);
        }
      } else if (method === DETECTION_METHODS.IQR) {
        const lowerBound = baseline.q1 - (this.options.iqrMultiplier * baseline.iqr);
        const upperBound = baseline.q3 + (this.options.iqrMultiplier * baseline.iqr);

        if (value < lowerBound || value > upperBound) {
          isAnomaly = true;
          const distance = Math.abs(value - baseline.q2);
          score = Math.min(1.0, distance / (baseline.iqr || 1));
        }
      }
    }

    if (!isAnomaly) {
      return null;
    }

    return {
      fieldName,
      value,
      method,
      score,
      baseline: {
        mean: baseline.mean,
        stdDev: baseline.stdDev,
        range: [baseline.min, baseline.max]
      },
      severity: this._scoreToSeverity(score)
    };
  }

  /**
   * Detect timing anomalies
   * @private
   * @param {Array} timings - Timing values
   * @param {string} method - Detection method
   * @returns {Array}
   */
  _detectTimingAnomalies(timings, method) {
    const anomalies = [];

    if (timings.length < 2) {
      return anomalies;
    }

    // Calculate timing statistics
    const stats = this._calculateStatistics(timings);

    // Find outliers
    for (let i = 0; i < timings.length; i++) {
      const timing = timings[i];
      const zScore = Math.abs((timing - stats.mean) / (stats.stdDev || 1));

      if (zScore > this.options.zScoreThreshold) {
        anomalies.push({
          type: 'timing',
          index: i,
          value: timing,
          method,
          score: Math.min(1.0, zScore / 5),
          deviation: timing - stats.mean,
          baseline: stats.mean,
          severity: this._scoreToSeverity(Math.min(1.0, zScore / 5))
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect sequence anomalies
   * @private
   * @param {Array} events - Events
   * @returns {Array}
   */
  _detectSequenceAnomalies(events) {
    const anomalies = [];

    if (events.length < 3) {
      return anomalies;
    }

    // Detect rapid fire events
    const eventTypes = {};
    for (const event of events) {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    }

    // Check for unusual event frequencies
    const avgFrequency = events.length / Object.keys(eventTypes).length;
    for (const [type, count] of Object.entries(eventTypes)) {
      const deviation = Math.abs(count - avgFrequency) / avgFrequency;
      if (deviation > 0.8) {
        anomalies.push({
          type: 'event-frequency',
          eventType: type,
          count,
          expectedAverage: avgFrequency,
          score: Math.min(1.0, deviation * 0.5),
          severity: this._scoreToSeverity(Math.min(1.0, deviation * 0.5))
        });
      }
    }

    return anomalies;
  }

  /**
   * Convert score to severity level
   * @private
   * @param {number} score - Score (0-1)
   * @returns {string}
   */
  _scoreToSeverity(score) {
    if (score < 0.2) return ANOMALY_SEVERITY.NORMAL;
    if (score < 0.4) return ANOMALY_SEVERITY.MINOR;
    if (score < 0.6) return ANOMALY_SEVERITY.MODERATE;
    if (score < 0.8) return ANOMALY_SEVERITY.SEVERE;
    return ANOMALY_SEVERITY.CRITICAL;
  }

  /**
   * Calculate confidence in detection
   * @private
   * @param {Array} anomalies - Detected anomalies
   * @returns {number}
   */
  _calculateConfidence(anomalies) {
    if (anomalies.length === 0) return 0;

    // Confidence based on consistency of anomaly severity
    const severities = anomalies.map(a => a.score);
    const variance = severities.reduce((sum, s) => sum + Math.pow(s - 0.5, 2), 0) / severities.length;
    const consistency = 1 - Math.min(1, variance);

    return Math.min(1.0, (anomalies.length / 5) * consistency);
  }

  /**
   * Get all detection methods
   * @returns {Object}
   */
  static getDetectionMethods() {
    return { ...DETECTION_METHODS };
  }

  /**
   * Get all severity levels
   * @returns {Object}
   */
  static getSeverityLevels() {
    return { ...ANOMALY_SEVERITY };
  }

  /**
   * Get baseline statistics
   * @param {string} sampleType - Sample type
   * @returns {Object}
   */
  getBaseline(sampleType) {
    return this.baselines[sampleType] || null;
  }

  /**
   * Get sample count
   * @param {string} sampleType - Sample type
   * @returns {number}
   */
  getSampleCount(sampleType) {
    return this.samples[sampleType]?.length || 0;
  }

  /**
   * Clear all baselines and samples
   * @returns {void}
   */
  reset() {
    this.baselines = {
      fingerprints: {},
      behaviors: {},
      timings: {}
    };

    this.samples = {
      fingerprints: [],
      behaviors: [],
      timings: []
    };
  }

  /**
   * Get detector statistics
   * @returns {Object}
   */
  getStatistics() {
    return {
      fingerprints: {
        sampleCount: this.samples.fingerprints.length,
        baselineReady: this.samples.fingerprints.length >= this.options.minSamplesForBaseline,
        baseline: this.baselines.fingerprints
      },
      behaviors: {
        sampleCount: this.samples.behaviors.length,
        baselineReady: this.samples.behaviors.length >= this.options.minSamplesForBaseline,
        baseline: this.baselines.behaviors
      },
      timings: {
        sampleCount: this.samples.timings.length,
        baselineReady: this.samples.timings.length >= this.options.minSamplesForBaseline,
        baseline: this.baselines.timings
      }
    };
  }
}

module.exports = {
  AnomalyDetector,
  DETECTION_METHODS,
  ANOMALY_SEVERITY
};

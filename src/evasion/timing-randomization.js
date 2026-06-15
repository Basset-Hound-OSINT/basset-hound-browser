/**
 * Basset Hound Browser - Timing Randomization Module
 * Request timing randomization and response delay injection for bot evasion
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 *
 * Key Features:
 * - Human-like request delay patterns
 * - Response delay injection based on size
 * - Connection reuse pattern variation
 * - Thinking time simulation
 * - Burst pattern detection and response
 * - Detection Methods Evaded:
 *   - Timing attack detection
 *   - Automated bot pattern recognition
 *   - Request frequency analysis
 *   - Human behavior deviation detection
 */

class TimingRandomization {
  constructor(options = {}) {
    this.lastRequestTime = 0;
    this.minDelay = options.minDelay || 10; // ms
    this.maxDelay = options.maxDelay || 150; // ms
    this.burstThreshold = options.burstThreshold || 5;
    this.requestCount = 0;
    this.requestHistory = [];
    this.maxHistoryLength = options.maxHistoryLength || 50;
  }

  /**
   * Get delay before sending next request
   */
  getRequestDelay(requestType = 'normal') {
    // Human behavior: varying delays between requests
    // 10-50ms: same-page resources (fast)
    // 50-150ms: user navigation (normal)
    // 200-500ms: user-triggered action (deliberate)

    let baseDelay = this._getBaseDelay(requestType);
    let variance = this._addVariance(baseDelay);

    // Every 5-7 requests, add longer pause (thinking time)
    if (this.requestCount > this.burstThreshold) {
      variance += this._addThinkingTime();
      this.requestCount = 0;
    } else {
      this.requestCount++;
    }

    const finalDelay = Math.max(this.minDelay, variance);

    // Record timing
    this.requestHistory.push({
      requestType,
      delay: finalDelay,
      timestamp: Date.now()
    });

    // Trim history
    if (this.requestHistory.length > this.maxHistoryLength) {
      this.requestHistory.shift();
    }

    this.lastRequestTime = Date.now();
    return finalDelay;
  }

  /**
   * Get base delay for request type
   */
  _getBaseDelay(requestType) {
    const delays = {
      'resource': 15,      // Image/CSS/JS
      'xhr': 60,           // XMLHttpRequest
      'fetch': 70,         // Fetch API
      'navigation': 100,   // Page navigation
      'form': 150,         // Form submission
      'normal': 50         // Default
    };

    return delays[requestType] || 50;
  }

  /**
   * Add realistic variance to delay
   */
  _addVariance(baseDelay) {
    // ±20% variance on base delay
    const variance = baseDelay * 0.2 * (Math.random() - 0.5);

    // Normal distribution approximation (triangular sum)
    const sum = Math.random() + Math.random() + Math.random();
    const normalized = (sum - 1.5) / 1.5; // Range: -1 to 1

    return baseDelay + normalized * variance;
  }

  /**
   * Add thinking time (occasional longer pauses)
   */
  _addThinkingTime() {
    // Occasional longer pauses (100-500ms) to simulate thinking
    return 100 + Math.random() * 400;
  }

  /**
   * Get processing delay based on response size
   */
  getProcessingDelay(responseSize, isUserInteractive = false) {
    // Larger responses take slightly longer to process
    // User-interactive responses have more variable timing

    const baseDelay = this._calculateProcessingTime(responseSize);
    const variance = this._addHumanVariance(isUserInteractive);

    return baseDelay + variance;
  }

  /**
   * Calculate processing time based on response size
   */
  _calculateProcessingTime(responseSize) {
    // ~1ms per 100KB (rough approximation of JavaScript execution time)
    return Math.max(1, Math.ceil(responseSize / 100000));
  }

  /**
   * Add human variance to processing
   */
  _addHumanVariance(isUserInteractive) {
    if (isUserInteractive) {
      // 5-50ms variance for user-interactive content
      return 5 + Math.random() * 45;
    } else {
      // 1-15ms variance for background requests
      return 1 + Math.random() * 14;
    }
  }

  /**
   * Decide whether to reuse connection
   */
  shouldReuseConnection(domain, isSecure = true) {
    // Humans usually reuse connections for same-origin resources
    // Occasional new connections (network errors, timeouts)

    // 85% chance to reuse connections
    return Math.random() < 0.85;
  }

  /**
   * Get timing statistics
   */
  getTimingStatistics() {
    if (this.requestHistory.length === 0) {
      return {
        totalRequests: 0,
        averageDelay: 0,
        minDelay: 0,
        maxDelay: 0,
        delayVariance: 0,
        recentPattern: []
      };
    }

    const delays = this.requestHistory.map(r => r.delay);
    const average = delays.reduce((a, b) => a + b, 0) / delays.length;
    const variance = this._calculateVariance(delays);

    return {
      totalRequests: this.requestHistory.length,
      averageDelay: Math.round(average * 10) / 10,
      minDelay: Math.min(...delays),
      maxDelay: Math.max(...delays),
      delayVariance: Math.round(variance * 10) / 10,
      recentPattern: this.requestHistory.slice(-10).map(r => ({
        type: r.requestType,
        delay: Math.round(r.delay * 10) / 10
      }))
    };
  }

  /**
   * Calculate variance
   */
  _calculateVariance(values) {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.requestHistory = [];
    this.requestCount = 0;
  }

  /**
   * Detect if current pattern is suspicious (too consistent)
   */
  detectSuspiciousPattern() {
    if (this.requestHistory.length < 10) {
      return { suspicious: false, reason: 'insufficient_data' };
    }

    // Check if delays are too consistent (low variance = suspicious)
    const recentDelays = this.requestHistory.slice(-10).map(r => r.delay);
    const variance = this._calculateVariance(recentDelays);
    const mean = recentDelays.reduce((a, b) => a + b) / recentDelays.length;

    // Coefficient of variation (CV = std_dev / mean)
    const cv = variance / mean;

    // Natural variance is 0.3-0.8; < 0.2 is suspicious
    if (cv < 0.2) {
      return {
        suspicious: true,
        reason: 'too_consistent',
        coefficientOfVariation: Math.round(cv * 100) / 100
      };
    }

    // Check if all delays are identical
    const uniqueDelays = new Set(recentDelays.map(d => Math.round(d)));
    if (uniqueDelays.size === 1) {
      return {
        suspicious: true,
        reason: 'identical_delays',
        delayValue: recentDelays[0]
      };
    }

    return { suspicious: false, reason: 'pattern_normal' };
  }
}

module.exports = TimingRandomization;

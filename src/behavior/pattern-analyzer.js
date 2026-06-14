/**
 * Behavioral Pattern Analyzer
 *
 * Real-time analysis of behavioral patterns to support coherence scoring
 *
 * Tracks:
 * - Mouse movement (velocity, acceleration, trajectories)
 * - Typing patterns (speed, rhythm, pauses)
 * - Scroll behavior (speed, patterns, pauses)
 * - Click patterns (frequency, timing, targets)
 * - Dwell time (duration on elements)
 * - Navigation patterns (back/forward, refresh)
 * - Form interaction (field focus order, pause times)
 *
 * Performance: <100ms for 100 interactions
 */

const crypto = require('crypto');

class PatternAnalyzer {
  constructor(options = {}) {
    this.windowSize = options.windowSize || 100; // Track last 100 interactions
    this.patterns = {
      mouse: [],
      typing: [],
      scroll: [],
      click: [],
      dwell: [],
      navigation: [],
      formInteraction: [],
    };

    this.metrics = {
      mouseHistogram: new Map(),
      typingDistribution: { iki: [], errors: [], wpm: [] },
      scrollDistribution: { speed: [], distance: [], pauses: [] },
      clickDistribution: { timing: [], duration: [], targets: [] },
      dwellDistribution: { duration: [] },
      navigationSequence: [],
      formSequence: [],
    };

    this.currentSession = {
      startTime: Date.now(),
      actionCount: 0,
      anomalies: [],
    };

    this.baselineStatistics = null;
  }

  /**
   * Record mouse movement pattern
   *
   * @param {Object} movement - {from: {x, y}, to: {x, y}, duration: ms}
   */
  recordMouseMovement(movement) {
    const { from, to, duration } = movement;

    // Calculate metrics
    const distance = Math.sqrt(
      Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2)
    );
    const velocity = distance / duration;
    const acceleration = velocity / duration;

    // Calculate trajectory angle
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const trajectory = {
      angle,
      distance,
      duration,
      velocity,
      acceleration,
      timestamp: Date.now(),
    };

    this.patterns.mouse.push(trajectory);
    if (this.patterns.mouse.length > this.windowSize) {
      this.patterns.mouse.shift();
    }

    // Update histogram
    const velocityBucket = Math.floor(velocity / 50) * 50; // 50px/ms buckets
    this.metrics.mouseHistogram.set(
      velocityBucket,
      (this.metrics.mouseHistogram.get(velocityBucket) || 0) + 1
    );

    this.currentSession.actionCount++;

    return {
      distance,
      velocity,
      acceleration,
      angle,
    };
  }

  /**
   * Record typing pattern
   *
   * @param {Object} typing - {char: string, ikiBefore: ms, holdDuration: ms, error: boolean}
   */
  recordTypingEvent(typing) {
    const { char, ikiBefore, holdDuration, error } = typing;

    const event = {
      char,
      iki: ikiBefore,
      holdDuration,
      error: error || false,
      timestamp: Date.now(),
    };

    this.patterns.typing.push(event);
    if (this.patterns.typing.length > this.windowSize) {
      this.patterns.typing.shift();
    }

    // Update distributions
    if (ikiBefore) this.metrics.typingDistribution.iki.push(ikiBefore);
    if (error) this.metrics.typingDistribution.errors.push(char);

    this.currentSession.actionCount++;

    return event;
  }

  /**
   * Record scroll behavior
   *
   * @param {Object} scroll - {direction: 'up'|'down', distance: px, duration: ms, paused: boolean}
   */
  recordScroll(scroll) {
    const { direction, distance, duration, paused } = scroll;

    const velocity = distance / Math.max(duration, 1);
    const event = {
      direction,
      distance,
      velocity,
      duration,
      paused,
      timestamp: Date.now(),
    };

    this.patterns.scroll.push(event);
    if (this.patterns.scroll.length > this.windowSize) {
      this.patterns.scroll.shift();
    }

    this.metrics.scrollDistribution.speed.push(velocity);
    this.metrics.scrollDistribution.distance.push(distance);
    if (paused) this.metrics.scrollDistribution.pauses.push(1);

    this.currentSession.actionCount++;

    return event;
  }

  /**
   * Record click pattern
   *
   * @param {Object} click - {x: px, y: px, target: selector, duration: ms}
   */
  recordClick(click) {
    const { x, y, target, duration } = click;

    const event = {
      x,
      y,
      target,
      duration: duration || 0,
      timestamp: Date.now(),
    };

    this.patterns.click.push(event);
    if (this.patterns.click.length > this.windowSize) {
      this.patterns.click.shift();
    }

    this.metrics.clickDistribution.targets.push(target || 'unknown');
    this.metrics.clickDistribution.duration.push(duration || 0);

    // Calculate inter-click interval
    if (this.patterns.click.length > 1) {
      const prevClick = this.patterns.click[this.patterns.click.length - 2];
      const interval = event.timestamp - prevClick.timestamp;
      this.metrics.clickDistribution.timing.push(interval);
    }

    this.currentSession.actionCount++;

    return event;
  }

  /**
   * Record dwell time (time spent on element)
   *
   * @param {Object} dwell - {target: selector, duration: ms}
   */
  recordDwell(dwell) {
    const { target, duration } = dwell;

    const event = {
      target,
      duration,
      timestamp: Date.now(),
    };

    this.patterns.dwell.push(event);
    if (this.patterns.dwell.length > this.windowSize) {
      this.patterns.dwell.shift();
    }

    this.metrics.dwellDistribution.duration.push(duration);

    this.currentSession.actionCount++;

    return event;
  }

  /**
   * Record navigation action
   *
   * @param {Object} nav - {action: 'back'|'forward'|'refresh', timestamp: ms}
   */
  recordNavigation(nav) {
    const { action } = nav;

    const event = {
      action,
      timestamp: Date.now(),
    };

    this.patterns.navigation.push(event);
    if (this.patterns.navigation.length > this.windowSize) {
      this.patterns.navigation.shift();
    }

    this.metrics.navigationSequence.push(action);

    this.currentSession.actionCount++;

    return event;
  }

  /**
   * Record form interaction
   *
   * @param {Object} interaction - {field: id, action: 'focus'|'fill'|'blur', duration: ms}
   */
  recordFormInteraction(interaction) {
    const { field, action, duration } = interaction;

    const event = {
      field,
      action,
      duration: duration || 0,
      timestamp: Date.now(),
    };

    this.patterns.formInteraction.push(event);
    if (this.patterns.formInteraction.length > this.windowSize) {
      this.patterns.formInteraction.shift();
    }

    this.metrics.formSequence.push(action);

    this.currentSession.actionCount++;

    return event;
  }

  /**
   * Calculate statistics for a pattern array
   *
   * @param {Array} values - Array of numeric values
   * @returns {Object} Statistics
   */
  calculateStats(values) {
    if (values.length === 0) {
      return {
        mean: 0,
        median: 0,
        stdDev: 0,
        min: 0,
        max: 0,
        count: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];

    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      median,
      stdDev,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      count: values.length,
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  /**
   * Get current metrics summary
   *
   * @returns {Object} Summary of all metrics
   */
  getMetricsSummary() {
    const startTime = performance.now();

    return {
      mouse: this.getMouseMetrics(),
      typing: this.getTypingMetrics(),
      scroll: this.getScrollMetrics(),
      click: this.getClickMetrics(),
      dwell: this.getDwellMetrics(),
      navigation: this.getNavigationMetrics(),
      formInteraction: this.getFormMetrics(),
      sessionMetrics: {
        duration: Date.now() - this.currentSession.startTime,
        actionCount: this.currentSession.actionCount,
        actionsPerSecond: this.currentSession.actionCount /
          ((Date.now() - this.currentSession.startTime) / 1000),
      },
      computationTime: performance.now() - startTime,
    };
  }

  /**
   * Get mouse movement metrics
   */
  getMouseMetrics() {
    const velocities = this.patterns.mouse.map(m => m.velocity);
    const accelerations = this.patterns.mouse.map(m => m.acceleration);
    const distances = this.patterns.mouse.map(m => m.distance);

    return {
      count: this.patterns.mouse.length,
      velocity: this.calculateStats(velocities),
      acceleration: this.calculateStats(accelerations),
      distance: this.calculateStats(distances),
      directionChanges: this.calculateDirectionChanges(),
    };
  }

  /**
   * Get typing metrics
   */
  getTypingMetrics() {
    const iki = this.metrics.typingDistribution.iki;
    const events = this.patterns.typing.length;
    const errors = this.metrics.typingDistribution.errors.length;
    const errorRate = events > 0 ? errors / events : 0;

    // Calculate WPM (average IKI to WPM conversion)
    const avgIKI = iki.length > 0
      ? iki.reduce((a, b) => a + b, 0) / iki.length
      : 0;
    const wpm = avgIKI > 0 ? (60000 / avgIKI) / 5 : 0; // 5 chars per word

    return {
      count: events,
      errorRate,
      errors: errors,
      interKeystrokeInterval: this.calculateStats(iki),
      estimatedWPM: wpm,
    };
  }

  /**
   * Get scroll metrics
   */
  getScrollMetrics() {
    const speeds = this.metrics.scrollDistribution.speed;
    const distances = this.metrics.scrollDistribution.distance;
    const pauses = this.metrics.scrollDistribution.pauses.length;

    return {
      count: this.patterns.scroll.length,
      speed: this.calculateStats(speeds),
      distance: this.calculateStats(distances),
      pauseFrequency: this.patterns.scroll.length > 0
        ? pauses / this.patterns.scroll.length
        : 0,
    };
  }

  /**
   * Get click metrics
   */
  getClickMetrics() {
    const timings = this.metrics.clickDistribution.timing;
    const durations = this.metrics.clickDistribution.duration;

    // Count target frequency
    const targetFreq = new Map();
    for (const target of this.metrics.clickDistribution.targets) {
      targetFreq.set(target, (targetFreq.get(target) || 0) + 1);
    }

    return {
      count: this.patterns.click.length,
      interClickInterval: this.calculateStats(timings),
      duration: this.calculateStats(durations),
      targetFrequency: Array.from(targetFreq.entries()).map(([target, freq]) => ({
        target,
        frequency: freq,
        percentage: (freq / this.patterns.click.length * 100).toFixed(2),
      })),
    };
  }

  /**
   * Get dwell metrics
   */
  getDwellMetrics() {
    const durations = this.metrics.dwellDistribution.duration;

    return {
      count: this.patterns.dwell.length,
      duration: this.calculateStats(durations),
    };
  }

  /**
   * Get navigation metrics
   */
  getNavigationMetrics() {
    const navFreq = new Map();
    for (const action of this.metrics.navigationSequence) {
      navFreq.set(action, (navFreq.get(action) || 0) + 1);
    }

    return {
      count: this.patterns.navigation.length,
      actions: Array.from(navFreq.entries()).map(([action, count]) => ({
        action,
        count,
        percentage: (count / this.patterns.navigation.length * 100).toFixed(2),
      })),
    };
  }

  /**
   * Get form interaction metrics
   */
  getFormMetrics() {
    const actionFreq = new Map();
    const fieldFreq = new Map();

    for (const event of this.patterns.formInteraction) {
      actionFreq.set(event.action, (actionFreq.get(event.action) || 0) + 1);
      fieldFreq.set(event.field, (fieldFreq.get(event.field) || 0) + 1);
    }

    return {
      count: this.patterns.formInteraction.length,
      actions: Array.from(actionFreq.entries()).map(([action, count]) => ({
        action,
        count,
      })),
      frequentFields: Array.from(fieldFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([field, count]) => ({ field, count })),
    };
  }

  /**
   * Calculate direction changes in mouse movement
   *
   * @returns {number} Number of direction changes
   */
  calculateDirectionChanges() {
    if (this.patterns.mouse.length < 2) return 0;

    let changes = 0;
    for (let i = 1; i < this.patterns.mouse.length; i++) {
      const prevAngle = this.patterns.mouse[i - 1].angle;
      const currAngle = this.patterns.mouse[i].angle;

      // Angle difference > 45 degrees (0.785 radians)
      const diff = Math.abs(currAngle - prevAngle);
      if (diff > 0.785) {
        changes++;
      }
    }

    return changes;
  }

  /**
   * Detect anomalies in current patterns
   *
   * @returns {Array} Array of detected anomalies
   */
  detectAnomalies() {
    const anomalies = [];

    // Mouse movement anomalies
    if (this.patterns.mouse.length > 10) {
      const mouseMetrics = this.getMouseMetrics();
      const avgVelocity = mouseMetrics.velocity.mean;
      const velocityStdDev = mouseMetrics.velocity.stdDev;

      // Check for sudden velocity spikes
      const lastMouse = this.patterns.mouse[this.patterns.mouse.length - 1];
      if (lastMouse.velocity > avgVelocity + (velocityStdDev * 3)) {
        anomalies.push({
          type: 'mouse_velocity_spike',
          severity: 'WARNING',
          value: lastMouse.velocity,
          expectedRange: [avgVelocity - velocityStdDev, avgVelocity + velocityStdDev],
          timestamp: lastMouse.timestamp,
        });
      }
    }

    // Typing anomalies
    if (this.patterns.typing.length > 10) {
      const typingMetrics = this.getTypingMetrics();
      if (typingMetrics.errorRate > 0.1) {
        anomalies.push({
          type: 'typing_error_rate_high',
          severity: 'WARNING',
          value: typingMetrics.errorRate,
          threshold: 0.1,
          timestamp: Date.now(),
        });
      }

      // Check typing speed anomaly
      const lastTyping = this.patterns.typing[this.patterns.typing.length - 1];
      if (lastTyping && lastTyping.iki < 50) {
        anomalies.push({
          type: 'typing_speed_spike',
          severity: 'INFO',
          value: lastTyping.iki,
          expectedMinimum: 80,
          timestamp: lastTyping.timestamp,
        });
      }
    }

    // Scroll anomalies
    if (this.patterns.scroll.length > 5) {
      const scrollMetrics = this.getScrollMetrics();
      const lastScroll = this.patterns.scroll[this.patterns.scroll.length - 1];

      if (lastScroll.velocity > scrollMetrics.speed.mean + (scrollMetrics.speed.stdDev * 2)) {
        anomalies.push({
          type: 'scroll_speed_anomaly',
          severity: 'INFO',
          value: lastScroll.velocity,
          expectedRange: [
            scrollMetrics.speed.mean - scrollMetrics.speed.stdDev,
            scrollMetrics.speed.mean + scrollMetrics.speed.stdDev,
          ],
          timestamp: lastScroll.timestamp,
        });
      }
    }

    return anomalies;
  }

  /**
   * Calculate entropy of behavior patterns
   *
   * Measures randomness/predictability of behavior
   * Higher entropy = more random = less human-like
   *
   * @returns {number} Entropy value (0-1)
   */
  calculateBehaviorEntropy() {
    let totalEntropy = 0;
    let dimensionCount = 0;

    // Mouse movement entropy
    if (this.patterns.mouse.length > 5) {
      const velocities = this.patterns.mouse.map(m => Math.floor(m.velocity / 10) * 10);
      const entropy = this.calculateEntropy(velocities);
      totalEntropy += entropy;
      dimensionCount++;
    }

    // Typing rhythm entropy
    if (this.patterns.typing.length > 5) {
      const ikis = this.patterns.typing.map(t => Math.floor(t.iki / 10) * 10);
      const entropy = this.calculateEntropy(ikis);
      totalEntropy += entropy;
      dimensionCount++;
    }

    // Click timing entropy
    if (this.patterns.click.length > 3) {
      const intervals = [];
      for (let i = 1; i < this.patterns.click.length; i++) {
        const interval = this.patterns.click[i].timestamp - this.patterns.click[i - 1].timestamp;
        intervals.push(Math.floor(interval / 100) * 100);
      }
      const entropy = this.calculateEntropy(intervals);
      totalEntropy += entropy;
      dimensionCount++;
    }

    return dimensionCount > 0 ? totalEntropy / dimensionCount : 0;
  }

  /**
   * Calculate entropy of an array using Shannon entropy
   *
   * @param {Array} values - Array of values
   * @returns {number} Entropy (0-1, normalized)
   */
  calculateEntropy(values) {
    if (values.length === 0) return 0;

    const frequency = new Map();
    for (const val of values) {
      frequency.set(val, (frequency.get(val) || 0) + 1);
    }

    let entropy = 0;
    const len = values.length;

    for (const count of frequency.values()) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    // Normalize to 0-1 range
    const maxEntropy = Math.log2(frequency.size);
    return maxEntropy > 0 ? entropy / maxEntropy : 0;
  }

  /**
   * Compare current patterns to baseline
   *
   * @param {Object} baseline - Baseline statistics
   * @returns {Object} Comparison results with deviations
   */
  compareToBaseline(baseline) {
    const current = this.getMetricsSummary();
    const deviations = {};

    // Compare mouse metrics
    if (baseline.mouse && current.mouse) {
      const mouseDeviation = this.calculateDeviation(
        baseline.mouse.velocity,
        current.mouse.velocity
      );
      deviations.mouseVelocity = mouseDeviation;
    }

    // Compare typing metrics
    if (baseline.typing && current.typing) {
      const typingWPMDeviation = Math.abs(
        (baseline.typing.estimatedWPM - current.typing.estimatedWPM) /
        baseline.typing.estimatedWPM
      );
      deviations.typingWPM = typingWPMDeviation;
    }

    // Compare scroll metrics
    if (baseline.scroll && current.scroll) {
      const scrollDeviation = this.calculateDeviation(
        baseline.scroll.speed,
        current.scroll.speed
      );
      deviations.scrollSpeed = scrollDeviation;
    }

    return {
      deviations,
      isConsistent: Object.values(deviations).every(dev => dev < 0.3), // <30% deviation
    };
  }

  /**
   * Calculate deviation between two statistics objects
   *
   * @param {Object} baseline - Baseline stats
   * @param {Object} current - Current stats
   * @returns {number} Deviation ratio (0-1)
   */
  calculateDeviation(baseline, current) {
    if (!baseline || !current || !baseline.mean) return 0;

    const meanDiff = Math.abs(baseline.mean - current.mean);
    const deviation = meanDiff / (baseline.mean || 1);

    return Math.min(1, deviation); // Cap at 1.0
  }

  /**
   * Reset session tracking
   */
  resetSession() {
    this.currentSession = {
      startTime: Date.now(),
      actionCount: 0,
      anomalies: [],
    };
  }

  /**
   * Get pattern hashes for change detection
   *
   * Useful for detecting if user behavior has fundamentally changed
   *
   * @returns {Object} Hash of each pattern type
   */
  getPatternHashes() {
    const hashes = {};

    for (const [patternType, patterns] of Object.entries(this.patterns)) {
      const hash = crypto
        .createHash('sha256')
        .update(JSON.stringify(patterns.slice(-20))) // Last 20 events
        .digest('hex')
        .slice(0, 16);

      hashes[patternType] = hash;
    }

    return hashes;
  }
}

module.exports = PatternAnalyzer;

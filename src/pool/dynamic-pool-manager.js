/**
 * Dynamic Connection Pool Manager
 * OPT-11: Auto-scale worker pool based on load
 *
 * Features:
 * - Monitor queue depth and latency
 * - Auto-scale pool: add workers if latency > threshold
 * - Scale down: remove workers if idle time > threshold
 * - Limits: min 4, max 32 workers
 * - Track scaling events and metrics
 *
 * Expected gain: 8-12% throughput (better resource utilization)
 */

class DynamicPoolManager {
  constructor(options = {}) {
    this.minPoolSize = options.minPoolSize || 4;
    this.maxPoolSize = options.maxPoolSize || 32;
    this.initialPoolSize = options.initialPoolSize || 16;

    // Scaling thresholds
    this.latencyThreshold = options.latencyThreshold || 50; // ms, trigger scale-up
    this.queueDepthThreshold = options.queueDepthThreshold || 10; // max queue depth
    this.idleTimeThreshold = options.idleTimeThreshold || 30000; // ms, trigger scale-down
    this.scaleUpCooldown = options.scaleUpCooldown || 5000; // ms between scale-ups
    this.scaleDownCooldown = options.scaleDownCooldown || 60000; // ms between scale-downs

    // Pool state
    this.currentPoolSize = this.initialPoolSize;
    this.activeWorkers = 0;
    this.workerIdleMap = new Map(); // workerId -> lastActiveTime

    // Metrics
    this.metrics = {
      totalScaleUps: 0,
      totalScaleDowns: 0,
      lastScaleUpTime: null,
      lastScaleDownTime: null,
      peakPoolSize: this.initialPoolSize,
      minPoolSizeReached: false,
      maxPoolSizeReached: false,
      scalingEvents: []
    };

    // Latency tracking (circular buffer for moving average)
    this.latencyWindow = [];
    this.maxLatencySamples = options.maxLatencySamples || 50;
  }

  /**
   * Record request latency and evaluate scaling need
   */
  recordLatency(latencyMs, queueDepth = 0) {
    // Add to latency window
    this.latencyWindow.push(latencyMs);
    if (this.latencyWindow.length > this.maxLatencySamples) {
      this.latencyWindow.shift();
    }

    // Calculate average latency
    const avgLatency = this._getAverageLatency();

    // Decide scaling action
    return this._evaluateScaling(avgLatency, queueDepth);
  }

  /**
   * Record worker activity (for idle tracking)
   */
  recordWorkerActivity(workerId) {
    this.workerIdleMap.set(workerId, Date.now());
  }

  /**
   * Record worker completion (track idle time)
   */
  recordWorkerIdle(workerId) {
    this.workerIdleMap.set(workerId, Date.now());
  }

  /**
   * Evaluate if scaling is needed
   * @private
   */
  _evaluateScaling(avgLatency, queueDepth) {
    const now = Date.now();
    const timeSinceLastScaleUp = this.metrics.lastScaleUpTime
      ? now - this.metrics.lastScaleUpTime
      : Infinity;
    const timeSinceLastScaleDown = this.metrics.lastScaleDownTime
      ? now - this.metrics.lastScaleDownTime
      : Infinity;

    // Check scale-up conditions
    if (avgLatency > this.latencyThreshold &&
        queueDepth > this.queueDepthThreshold &&
        this.currentPoolSize < this.maxPoolSize &&
        timeSinceLastScaleUp > this.scaleUpCooldown) {

      return this._scaleUp();
    }

    // Check scale-down conditions (all workers idle for threshold)
    if (this.currentPoolSize > this.minPoolSize &&
        this._getAllWorkersIdle(this.idleTimeThreshold) &&
        timeSinceLastScaleDown > this.scaleDownCooldown) {

      return this._scaleDown();
    }

    return {
      action: 'none',
      currentSize: this.currentPoolSize,
      avgLatency: Math.round(avgLatency),
      queueDepth
    };
  }

  /**
   * Scale up pool size
   * @private
   */
  _scaleUp() {
    const oldSize = this.currentPoolSize;
    const increment = Math.max(1, Math.floor(this.currentPoolSize * 0.25)); // 25% increase
    const newSize = Math.min(this.maxPoolSize, oldSize + increment);

    this.currentPoolSize = newSize;
    this.metrics.totalScaleUps++;
    this.metrics.lastScaleUpTime = Date.now();

    if (newSize > this.metrics.peakPoolSize) {
      this.metrics.peakPoolSize = newSize;
    }

    if (newSize === this.maxPoolSize) {
      this.metrics.maxPoolSizeReached = true;
    }

    const event = {
      type: 'scale-up',
      timestamp: Date.now(),
      from: oldSize,
      to: newSize,
      workersAdded: newSize - oldSize
    };

    this.metrics.scalingEvents.push(event);
    if (this.metrics.scalingEvents.length > 100) {
      this.metrics.scalingEvents.shift(); // Keep last 100 events
    }

    return {
      action: 'scaled-up',
      from: oldSize,
      to: newSize,
      workersAdded: newSize - oldSize
    };
  }

  /**
   * Scale down pool size
   * @private
   */
  _scaleDown() {
    const oldSize = this.currentPoolSize;
    const decrement = Math.max(1, Math.floor(this.currentPoolSize * 0.20)); // 20% decrease
    const newSize = Math.max(this.minPoolSize, oldSize - decrement);

    this.currentPoolSize = newSize;
    this.metrics.totalScaleDowns++;
    this.metrics.lastScaleDownTime = Date.now();

    if (newSize === this.minPoolSize) {
      this.metrics.minPoolSizeReached = true;
    }

    const event = {
      type: 'scale-down',
      timestamp: Date.now(),
      from: oldSize,
      to: newSize,
      workersRemoved: oldSize - newSize
    };

    this.metrics.scalingEvents.push(event);
    if (this.metrics.scalingEvents.length > 100) {
      this.metrics.scalingEvents.shift();
    }

    return {
      action: 'scaled-down',
      from: oldSize,
      to: newSize,
      workersRemoved: oldSize - newSize
    };
  }

  /**
   * Get average latency from window
   * @private
   */
  _getAverageLatency() {
    if (this.latencyWindow.length === 0) {
      return 0;
    }
    const sum = this.latencyWindow.reduce((a, b) => a + b, 0);
    return sum / this.latencyWindow.length;
  }

  /**
   * Check if all workers are idle
   * @private
   */
  _getAllWorkersIdle(idleThreshold) {
    if (this.workerIdleMap.size === 0) {
      return true;
    }

    const now = Date.now();
    for (const lastActiveTime of this.workerIdleMap.values()) {
      if (now - lastActiveTime < idleThreshold) {
        return false; // At least one worker is active
      }
    }

    return true; // All workers idle
  }

  /**
   * Get current pool size
   */
  getCurrentPoolSize() {
    return this.currentPoolSize;
  }

  /**
   * Get target pool size based on current load
   */
  getTargetPoolSize(currentLoad) {
    // currentLoad: 0-1 (0=idle, 1=saturated)
    if (currentLoad < 0.3) {
      return this.minPoolSize;
    }
    if (currentLoad < 0.5) {
      return Math.floor(this.initialPoolSize * 0.75);
    }
    if (currentLoad < 0.7) {
      return this.initialPoolSize;
    }
    if (currentLoad < 0.9) {
      return Math.floor(this.maxPoolSize * 0.75);
    }
    return this.maxPoolSize;
  }

  /**
   * Get recommended scaling action
   */
  getScalingRecommendation(avgLatency, queueDepth, activeWorkers) {
    const load = activeWorkers / this.currentPoolSize;

    if (load > 0.8 && avgLatency > this.latencyThreshold) {
      return {
        recommendation: 'scale-up',
        reason: `High load (${(load * 100).toFixed(1)}%) with high latency (${avgLatency.toFixed(1)}ms)`,
        targetSize: Math.min(this.maxPoolSize, this.currentPoolSize + 4)
      };
    }

    if (load < 0.2 && avgLatency < this.latencyThreshold / 2) {
      return {
        recommendation: 'scale-down',
        reason: `Low load (${(load * 100).toFixed(1)}%) with low latency`,
        targetSize: Math.max(this.minPoolSize, this.currentPoolSize - 2)
      };
    }

    return {
      recommendation: 'maintain',
      reason: `Current load (${(load * 100).toFixed(1)}%) and latency (${avgLatency.toFixed(1)}ms) are balanced`,
      targetSize: this.currentPoolSize
    };
  }

  /**
   * Force resize pool to specific size
   */
  forceResize(newSize) {
    if (newSize < this.minPoolSize || newSize > this.maxPoolSize) {
      throw new Error(
        `Invalid pool size: ${newSize} (min: ${this.minPoolSize}, max: ${this.maxPoolSize})`
      );
    }

    const oldSize = this.currentPoolSize;
    this.currentPoolSize = newSize;

    return {
      action: 'forced-resize',
      from: oldSize,
      to: newSize,
      delta: newSize - oldSize
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.latencyWindow = [];
    this.metrics = {
      totalScaleUps: 0,
      totalScaleDowns: 0,
      lastScaleUpTime: null,
      lastScaleDownTime: null,
      peakPoolSize: this.currentPoolSize,
      minPoolSizeReached: false,
      maxPoolSizeReached: false,
      scalingEvents: []
    };
  }

  /**
   * Get full metrics report
   */
  getMetrics() {
    const avgLatency = this._getAverageLatency();

    return {
      currentPoolSize: this.currentPoolSize,
      minPoolSize: this.minPoolSize,
      maxPoolSize: this.maxPoolSize,
      avgLatency: Math.round(avgLatency),
      latencySamples: this.latencyWindow.length,
      ...this.metrics,
      efficiency: this._calculateEfficiency(),
      healthScore: this._calculateHealthScore()
    };
  }

  /**
   * Calculate pool efficiency (how well we're using resources)
   * @private
   */
  _calculateEfficiency() {
    if (this.latencyWindow.length < 10) {
      return 0;
    }

    const avgLatency = this._getAverageLatency();
    const targetLatency = this.latencyThreshold / 2;

    // 100% efficiency when at target latency
    const efficiency = Math.max(0, 1 - (avgLatency / (targetLatency * 2)));
    return Math.round(efficiency * 100);
  }

  /**
   * Calculate health score (0-100)
   * @private
   */
  _calculateHealthScore() {
    if (this.latencyWindow.length === 0) {
      return 50;
    }

    const avgLatency = this._getAverageLatency();
    const latencyScore = Math.max(0, 100 - (avgLatency / 2));
    const scalingStability = 100 - Math.min(100, this.metrics.totalScaleUps * 10);

    return Math.round((latencyScore * 0.6 + scalingStability * 0.4));
  }

  /**
   * Get recent scaling events
   */
  getRecentScalingEvents(count = 10) {
    return this.metrics.scalingEvents.slice(-count);
  }
}

module.exports = DynamicPoolManager;

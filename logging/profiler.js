/**
 * Basset Hound Browser - Performance Profiler
 * Provides timing, metrics collection, and performance measurement
 */

const { EventEmitter } = require('events');

/**
 * Timer class for individual timing measurements
 */
class Timer {
  /**
   * Create a new Timer
   * @param {string} name - Timer name
   * @param {Object} metadata - Additional metadata
   */
  constructor(name, metadata = {}) {
    this.name = name;
    this.metadata = metadata;
    this.startTime = process.hrtime.bigint();
    this.endTime = null;
    this.marks = [];
  }

  /**
   * Add a mark/checkpoint
   * @param {string} label - Mark label
   */
  mark(label) {
    this.marks.push({
      label,
      time: process.hrtime.bigint(),
      elapsed: this.getElapsed()
    });
  }

  /**
   * End the timer
   * @returns {number} Duration in milliseconds
   */
  end() {
    this.endTime = process.hrtime.bigint();
    return this.getDuration();
  }

  /**
   * Get elapsed time since start (in ms)
   * @returns {number}
   */
  getElapsed() {
    const now = process.hrtime.bigint();
    return Number(now - this.startTime) / 1e6;
  }

  /**
   * Get total duration (in ms)
   * @returns {number|null}
   */
  getDuration() {
    if (!this.endTime) return null;
    return Number(this.endTime - this.startTime) / 1e6;
  }

  /**
   * Get timer data as object
   * @returns {Object}
   */
  toJSON() {
    return {
      name: this.name,
      startTime: Number(this.startTime),
      endTime: this.endTime ? Number(this.endTime) : null,
      duration: this.getDuration(),
      marks: this.marks,
      metadata: this.metadata
    };
  }
}

/**
 * Metric types
 */
const METRIC_TYPES = {
  COUNTER: 'counter',
  GAUGE: 'gauge',
  HISTOGRAM: 'histogram',
  TIMER: 'timer'
};

/**
 * Metric class for tracking values
 */
class Metric {
  /**
   * Create a new Metric
   * @param {string} name - Metric name
   * @param {string} type - Metric type
   * @param {Object} options - Metric options
   */
  constructor(name, type = METRIC_TYPES.COUNTER, options = {}) {
    this.name = name;
    this.type = type;
    this.value = 0;
    this.count = 0;
    this.min = null;
    this.max = null;
    this.sum = 0;
    this.samples = [];
    this.maxSamples = options.maxSamples || 1000;
    this.labels = options.labels || {};
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
  }

  /**
   * Increment counter
   * @param {number} value - Value to add
   */
  increment(value = 1) {
    this.value += value;
    this.count++;
    this.updatedAt = Date.now();
  }

  /**
   * Decrement counter
   * @param {number} value - Value to subtract
   */
  decrement(value = 1) {
    this.value -= value;
    this.updatedAt = Date.now();
  }

  /**
   * Set gauge value
   * @param {number} value - New value
   */
  set(value) {
    this.value = value;
    this.updatedAt = Date.now();
  }

  /**
   * Record a sample value (for histograms)
   * @param {number} value - Sample value
   */
  record(value) {
    this.samples.push(value);
    this.count++;
    this.sum += value;

    if (this.min === null || value < this.min) {
      this.min = value;
    }
    if (this.max === null || value > this.max) {
      this.max = value;
    }

    // Trim samples if needed
    if (this.samples.length > this.maxSamples) {
      this.samples = this.samples.slice(-this.maxSamples);
    }

    this.updatedAt = Date.now();
  }

  /**
   * Get average value
   * @returns {number}
   */
  getAverage() {
    return this.count > 0 ? this.sum / this.count : 0;
  }

  /**
   * Get percentile value
   * @param {number} p - Percentile (0-100)
   * @returns {number}
   */
  getPercentile(p) {
    if (this.samples.length === 0) return 0;

    const sorted = [...this.samples].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get metric data as object
   * @returns {Object}
   */
  toJSON() {
    const data = {
      name: this.name,
      type: this.type,
      value: this.value,
      count: this.count,
      labels: this.labels,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };

    if (this.type === METRIC_TYPES.HISTOGRAM || this.type === METRIC_TYPES.TIMER) {
      data.min = this.min;
      data.max = this.max;
      data.sum = this.sum;
      data.average = this.getAverage();
      data.p50 = this.getPercentile(50);
      data.p90 = this.getPercentile(90);
      data.p99 = this.getPercentile(99);
    }

    return data;
  }

  /**
   * Reset metric
   */
  reset() {
    this.value = 0;
    this.count = 0;
    this.min = null;
    this.max = null;
    this.sum = 0;
    this.samples = [];
    this.updatedAt = Date.now();
  }
}

/**
 * Profiler class - Main performance profiling implementation
 */
class Profiler extends EventEmitter {
  constructor(options = {}) {
    super();

    this.name = options.name || 'profiler';
    this.enabled = options.enabled !== false;

    // Active timers
    this.timers = new Map();

    // Completed timer history
    this.timerHistory = [];
    this.maxHistory = options.maxHistory || 1000;

    // Metrics
    this.metrics = new Map();

    // Logger integration
    this.logger = options.logger || null;

    // Statistics
    this.stats = {
      timersStarted: 0,
      timersCompleted: 0,
      metricsRecorded: 0,
      startTime: Date.now()
    };
  }

  /**
   * Set logger for output
   * @param {Logger} logger - Logger instance
   */
  setLogger(logger) {
    this.logger = logger;
  }

  /**
   * Start a named timer
   * @param {string} name - Timer name
   * @param {Object} metadata - Optional metadata
   * @returns {Timer} Timer instance
   */
  startTimer(name, metadata = {}) {
    if (!this.enabled) return null;

    const timer = new Timer(name, metadata);
    this.timers.set(name, timer);
    this.stats.timersStarted++;

    if (this.logger) {
      this.logger.trace(`Timer started: ${name}`, metadata);
    }

    return timer;
  }

  /**
   * End a named timer
   * @param {string} name - Timer name
   * @returns {Object|null} Timer result with duration
   */
  endTimer(name) {
    if (!this.enabled) return null;

    const timer = this.timers.get(name);
    if (!timer) {
      if (this.logger) {
        this.logger.warn(`Timer not found: ${name}`);
      }
      return null;
    }

    const duration = timer.end();
    this.timers.delete(name);

    // Add to history
    this.timerHistory.push(timer);
    if (this.timerHistory.length > this.maxHistory) {
      this.timerHistory = this.timerHistory.slice(-this.maxHistory);
    }

    this.stats.timersCompleted++;

    // Record as metric
    this.recordMetric(`timer.${name}`, duration, METRIC_TYPES.TIMER);

    if (this.logger) {
      this.logger.debug(`Timer completed: ${name}`, { duration: `${duration.toFixed(2)}ms` });
    }

    this.emit('timer', { name, duration, timer: timer.toJSON() });

    return {
      name,
      duration,
      marks: timer.marks,
      metadata: timer.metadata
    };
  }

  /**
   * Add a mark to an active timer
   * @param {string} name - Timer name
   * @param {string} label - Mark label
   */
  markTimer(name, label) {
    const timer = this.timers.get(name);
    if (timer) {
      timer.mark(label);
    }
  }

  /**
   * Measure an async function's execution time
   * @param {string} name - Measurement name
   * @param {Function} fn - Async function to measure
   * @param {Object} metadata - Optional metadata
   * @returns {Promise<*>} Function result
   */
  async measure(name, fn, metadata = {}) {
    if (!this.enabled) return await fn();

    const timer = this.startTimer(name, metadata);

    try {
      const result = await fn();
      this.endTimer(name);
      return result;
    } catch (error) {
      this.endTimer(name);
      throw error;
    }
  }

  /**
   * Measure a sync function's execution time
   * @param {string} name - Measurement name
   * @param {Function} fn - Sync function to measure
   * @param {Object} metadata - Optional metadata
   * @returns {*} Function result
   */
  measureSync(name, fn, metadata = {}) {
    if (!this.enabled) return fn();

    const timer = this.startTimer(name, metadata);

    try {
      const result = fn();
      this.endTimer(name);
      return result;
    } catch (error) {
      this.endTimer(name);
      throw error;
    }
  }

  /**
   * Create or get a metric
   * @param {string} name - Metric name
   * @param {string} type - Metric type
   * @param {Object} options - Metric options
   * @returns {Metric}
   */
  getOrCreateMetric(name, type = METRIC_TYPES.COUNTER, options = {}) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, new Metric(name, type, options));
    }
    return this.metrics.get(name);
  }

  /**
   * Record a metric value
   * @param {string} name - Metric name
   * @param {number} value - Value to record
   * @param {string} type - Metric type
   */
  recordMetric(name, value, type = METRIC_TYPES.HISTOGRAM) {
    if (!this.enabled) return;

    const metric = this.getOrCreateMetric(name, type);
    metric.record(value);
    this.stats.metricsRecorded++;
  }

  /**
   * Increment a counter metric
   * @param {string} name - Metric name
   * @param {number} value - Value to add
   */
  incrementCounter(name, value = 1) {
    if (!this.enabled) return;

    const metric = this.getOrCreateMetric(name, METRIC_TYPES.COUNTER);
    metric.increment(value);
    this.stats.metricsRecorded++;
  }

  /**
   * Set a gauge metric value
   * @param {string} name - Metric name
   * @param {number} value - New value
   */
  setGauge(name, value) {
    if (!this.enabled) return;

    const metric = this.getOrCreateMetric(name, METRIC_TYPES.GAUGE);
    metric.set(value);
    this.stats.metricsRecorded++;
  }

  /**
   * Get all metrics
   * @returns {Object} All metrics as object
   */
  getMetrics() {
    const result = {};

    for (const [name, metric] of this.metrics) {
      result[name] = metric.toJSON();
    }

    return result;
  }

  /**
   * Get a specific metric
   * @param {string} name - Metric name
   * @returns {Object|null}
   */
  getMetric(name) {
    const metric = this.metrics.get(name);
    return metric ? metric.toJSON() : null;
  }

  /**
   * Get timer history
   * @param {Object} filter - Optional filter
   * @returns {Array}
   */
  getTimerHistory(filter = {}) {
    let history = this.timerHistory.map(t => t.toJSON());

    if (filter.name) {
      history = history.filter(t => t.name === filter.name);
    }

    if (filter.since) {
      const since = new Date(filter.since).getTime();
      history = history.filter(t => t.startTime >= since);
    }

    if (filter.limit) {
      history = history.slice(-filter.limit);
    }

    return history;
  }

  /**
   * Get active timers
   * @returns {Object}
   */
  getActiveTimers() {
    const result = {};

    for (const [name, timer] of this.timers) {
      result[name] = {
        name,
        elapsed: timer.getElapsed(),
        marks: timer.marks,
        metadata: timer.metadata
      };
    }

    return result;
  }

  /**
   * Get profiler statistics
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime,
      activeTimers: this.timers.size,
      metricsCount: this.metrics.size,
      historySize: this.timerHistory.length,
      enabled: this.enabled
    };
  }

  /**
   * Get summary of all profiling data
   * @returns {Object}
   */
  getSummary() {
    return {
      stats: this.getStats(),
      activeTimers: this.getActiveTimers(),
      metrics: this.getMetrics()
    };
  }

  /**
   * Reset all profiling data
   */
  reset() {
    this.timers.clear();
    this.timerHistory = [];
    this.metrics.clear();
    this.stats = {
      timersStarted: 0,
      timersCompleted: 0,
      metricsRecorded: 0,
      startTime: Date.now()
    };
  }

  /**
   * Enable profiling
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable profiling
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Clean up
   */
  cleanup() {
    this.reset();
    this.removeAllListeners();
  }
}

// Create default profiler instance
const defaultProfiler = new Profiler();

module.exports = {
  Profiler,
  Timer,
  Metric,
  METRIC_TYPES,
  defaultProfiler
};

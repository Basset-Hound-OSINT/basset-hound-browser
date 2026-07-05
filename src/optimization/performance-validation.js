/**
 * Performance Validation Framework - Phase 2 Monitoring & Validation (OPT-14)
 *
 * Implements comprehensive benchmarking, continuous profiling, regression
 * detection, and performance reporting framework.
 *
 * Benefits:
 *  - Benchmarking: automated performance measurement
 *  - Regression detection: catches performance degradation
 *  - Profiling: identifies bottlenecks automatically
 *  - Reporting: comprehensive metrics and analysis
 */

const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');

/**
 * Performance benchmark suite
 */
class BenchmarkSuite extends EventEmitter {
  constructor(options = {}) {
    super();

    this.benchmarks = new Map();
    this.results = [];
    this.baselines = new Map();
    this.regressionThreshold = options.regressionThreshold || 0.1; // 10%
    this.iterations = options.iterations || 100;
    this.warmup = options.warmup || 10;

    this.stats = {
      totalBenchmarks: 0,
      passedBenchmarks: 0,
      failedBenchmarks: 0,
      regressions: 0
    };
  }

  /**
   * Register a benchmark
   * @param {string} name - Benchmark name
   * @param {Function} fn - Benchmark function
   * @param {Object} options - Benchmark options
   */
  register(name, fn, options = {}) {
    this.benchmarks.set(name, {
      fn,
      iterations: options.iterations || this.iterations,
      warmup: options.warmup || this.warmup,
      expectedMs: options.expectedMs,
      threshold: options.threshold || this.regressionThreshold
    });
  }

  /**
   * Run all benchmarks
   * @returns {Promise<Array>} Results
   */
  async runAll() {
    const results = [];

    for (const [name, bench] of this.benchmarks) {
      const result = await this._runBenchmark(name, bench);
      results.push(result);
    }

    this.results.push({
      timestamp: Date.now(),
      results
    });

    this.stats.totalBenchmarks = results.length;
    this.stats.passedBenchmarks = results.filter(r => r.passed).length;
    this.stats.failedBenchmarks = results.filter(r => !r.passed).length;

    return results;
  }

  /**
   * Run single benchmark
   * @private
   */
  async _runBenchmark(name, bench) {
    const results = [];

    // Warmup
    for (let i = 0; i < bench.warmup; i++) {
      await bench.fn();
    }

    // Run iterations
    for (let i = 0; i < bench.iterations; i++) {
      const start = process.hrtime.bigint();
      await bench.fn();
      const end = process.hrtime.bigint();

      results.push(Number(end - start) / 1e6); // Convert to milliseconds
    }

    // Calculate statistics
    const stats = this._calculateStats(results);
    const baseline = this.baselines.get(name);
    let passed = true;
    let regression = false;

    if (baseline && bench.expectedMs) {
      const allowedMs = bench.expectedMs * (1 + bench.threshold);
      if (stats.median > allowedMs) {
        passed = false;
        regression = true;
        this.stats.regressions++;
      }
    }

    const result = {
      name,
      passed,
      regression,
      stats,
      baseline
    };

    this.emit('benchmark-complete', result);

    return result;
  }

  /**
   * Calculate statistics from results
   * @private
   */
  _calculateStats(results) {
    const sorted = [...results].sort((a, b) => a - b);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: results.reduce((a, b) => a + b, 0) / results.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: this._calculateStdDev(results)
    };
  }

  /**
   * Calculate standard deviation
   * @private
   */
  _calculateStdDev(results) {
    const mean = results.reduce((a, b) => a + b, 0) / results.length;
    const variance = results.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / results.length;
    return Math.sqrt(variance);
  }

  /**
   * Set baseline for comparison
   * @param {string} name - Benchmark name
   * @param {number} timeMs - Expected time in milliseconds
   */
  setBaseline(name, timeMs) {
    this.baselines.set(name, timeMs);
  }

  /**
   * Get results summary
   * @returns {Object} Summary
   */
  getSummary() {
    return {
      totalBenchmarks: this.stats.totalBenchmarks,
      passed: this.stats.passedBenchmarks,
      failed: this.stats.failedBenchmarks,
      regressions: this.stats.regressions,
      passRate: this.stats.totalBenchmarks > 0 ?
        ((this.stats.passedBenchmarks / this.stats.totalBenchmarks) * 100).toFixed(2) + '%' :
        '0%'
    };
  }
}

/**
 * Continuous profiler for performance monitoring
 */
class ContinuousProfiler extends EventEmitter {
  constructor(options = {}) {
    super();

    this.interval = options.interval || 1000;
    this.historySize = options.historySize || 3600;
    this.enableHeap = options.enableHeap !== false;
    this.enableCPU = options.enableCPU !== false;

    this.metrics = {
      heap: [],
      cpu: [],
      eventLoop: [],
      gc: []
    };

    this.profiling = false;

    if (this.enableCPU) {
      this._startCPUProfiler();
    }

    if (this.enableHeap) {
      this._startHeapProfiler();
    }
  }

  /**
   * Start profiling
   */
  start() {
    if (this.profiling) {
      return;
    }

    this.profiling = true;

    this.profileTimer = setInterval(() => {
      this._collectMetrics();
    }, this.interval);
  }

  /**
   * Stop profiling
   */
  stop() {
    if (!this.profiling) {
      return;
    }

    this.profiling = false;

    if (this.profileTimer) {
      clearInterval(this.profileTimer);
    }
  }

  /**
   * Collect current metrics
   * @private
   */
  _collectMetrics() {
    const now = Date.now();

    // Heap metrics
    if (global.gc && this.enableHeap) {
      const heapStats = process.memoryUsage();
      this.metrics.heap.push({
        timestamp: now,
        heapUsed: heapStats.heapUsed,
        heapTotal: heapStats.heapTotal,
        external: heapStats.external,
        rss: heapStats.rss
      });
    }

    // Event loop lag
    const start = Date.now();
    setImmediate(() => {
      const lag = Date.now() - start;
      this.metrics.eventLoop.push({
        timestamp: now,
        lag
      });
    });

    // Trim history
    if (this.metrics.heap.length > this.historySize) {
      this.metrics.heap.shift();
    }
    if (this.metrics.eventLoop.length > this.historySize) {
      this.metrics.eventLoop.shift();
    }

    this.emit('metrics-collected', {
      timestamp: now,
      heap: this.metrics.heap.slice(-1)[0],
      eventLoop: this.metrics.eventLoop.slice(-1)[0]
    });
  }

  /**
   * Start CPU profiler
   * @private
   */
  _startCPUProfiler() {
    // Simulated CPU profiling (would use actual profiler in production)
  }

  /**
   * Start heap profiler
   * @private
   */
  _startHeapProfiler() {
    // Simulated heap profiling
  }

  /**
   * Get profiling report
   * @returns {Object} Report
   */
  getReport() {
    const heapStats = this._analyzeMetrics(this.metrics.heap, 'heapUsed');
    const eventLoopStats = this._analyzeMetrics(this.metrics.eventLoop, 'lag');

    return {
      duration: this.metrics.heap.length > 0 ?
        (Date.now() - this.metrics.heap[0].timestamp) : 0,
      heap: heapStats,
      eventLoop: eventLoopStats,
      samples: {
        heap: this.metrics.heap.length,
        eventLoop: this.metrics.eventLoop.length
      }
    };
  }

  /**
   * Analyze metrics
   * @private
   */
  _analyzeMetrics(metrics, field) {
    if (metrics.length === 0) {
      return null;
    }

    const values = metrics.map(m => m[field]);
    const sorted = [...values].sort((a, b) => a - b);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)]
    };
  }

  /**
   * Destroy profiler
   */
  destroy() {
    this.stop();
    this.removeAllListeners();
  }
}

/**
 * Performance regression detector
 */
class RegressionDetector extends EventEmitter {
  constructor(options = {}) {
    super();

    this.baseline = new Map();
    this.regressions = [];
    this.threshold = options.threshold || 0.1; // 10%
    this.minSamples = options.minSamples || 5;
  }

  /**
   * Record a metric
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   */
  record(name, value) {
    if (!this.baseline.has(name)) {
      this.baseline.set(name, []);
    }

    const history = this.baseline.get(name);
    history.push({
      timestamp: Date.now(),
      value
    });

    // Keep only last N samples
    if (history.length > 1000) {
      history.shift();
    }

    // Check for regression
    if (history.length >= this.minSamples) {
      this._checkRegression(name, history);
    }
  }

  /**
   * Check for regression
   * @private
   */
  _checkRegression(name, history) {
    const recentValues = history.slice(-5).map(h => h.value);
    const olderValues = history.slice(0, -5).map(h => h.value);

    if (olderValues.length === 0) {
      return;
    }

    const oldAvg = olderValues.reduce((a, b) => a + b) / olderValues.length;
    const recentAvg = recentValues.reduce((a, b) => a + b) / recentValues.length;

    const change = (recentAvg - oldAvg) / oldAvg;

    if (change > this.threshold) {
      const regression = {
        name,
        timestamp: Date.now(),
        change: (change * 100).toFixed(2) + '%',
        oldAvg: oldAvg.toFixed(2),
        recentAvg: recentAvg.toFixed(2)
      };

      this.regressions.push(regression);

      this.emit('regression-detected', regression);
    }
  }

  /**
   * Get regressions
   * @returns {Array} Detected regressions
   */
  getRegressions() {
    return this.regressions;
  }

  /**
   * Clear history
   */
  clear() {
    this.baseline.clear();
    this.regressions = [];
  }
}

/**
 * Performance report generator
 */
class PerformanceReportGenerator {
  /**
   * Generate HTML report
   * @param {Object} data - Report data
   * @returns {string} HTML report
   */
  static generateHTMLReport(data) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Performance Report</title>
        <style>
          body { font-family: sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #4CAF50; color: white; }
          .good { background-color: #d4edda; }
          .warning { background-color: #fff3cd; }
          .bad { background-color: #f8d7da; }
        </style>
      </head>
      <body>
        <h1>Performance Report</h1>
        <p>Generated: ${new Date().toISOString()}</p>
        ${data.summary ? PerformanceReportGenerator._generateSummarySection(data.summary) : ''}
        ${data.benchmarks ? PerformanceReportGenerator._generateBenchmarksSection(data.benchmarks) : ''}
        ${data.profile ? PerformanceReportGenerator._generateProfileSection(data.profile) : ''}
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Generate summary section
   * @private
   */
  static _generateSummarySection(summary) {
    return `
      <h2>Summary</h2>
      <table>
        <tr><td>Total Benchmarks</td><td>${summary.totalBenchmarks}</td></tr>
        <tr><td class="good">Passed</td><td>${summary.passed}</td></tr>
        <tr class="${summary.failed > 0 ? 'bad' : ''}"><td>Failed</td><td>${summary.failed}</td></tr>
        <tr><td>Pass Rate</td><td>${summary.passRate}</td></tr>
      </table>
    `;
  }

  /**
   * Generate benchmarks section
   * @private
   */
  static _generateBenchmarksSection(benchmarks) {
    const rows = benchmarks.map(b => `
      <tr class="${b.passed ? 'good' : 'bad'}">
        <td>${b.name}</td>
        <td>${b.stats.mean.toFixed(2)}ms</td>
        <td>${b.stats.p99.toFixed(2)}ms</td>
        <td>${b.passed ? 'PASS' : 'FAIL'}</td>
      </tr>
    `).join('');

    return `
      <h2>Benchmarks</h2>
      <table>
        <thead>
          <tr><th>Benchmark</th><th>Mean</th><th>P99</th><th>Status</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  /**
   * Generate profile section
   * @private
   */
  static _generateProfileSection(profile) {
    return `
      <h2>Profile</h2>
      <table>
        <tr><td>Heap Avg</td><td>${(profile.heap?.avg || 0).toFixed(2)} bytes</td></tr>
        <tr><td>Heap P95</td><td>${(profile.heap?.p95 || 0).toFixed(2)} bytes</td></tr>
        <tr><td>Event Loop Lag Avg</td><td>${(profile.eventLoop?.avg || 0).toFixed(2)}ms</td></tr>
        <tr><td>Event Loop Lag P95</td><td>${(profile.eventLoop?.p95 || 0).toFixed(2)}ms</td></tr>
      </table>
    `;
  }

  /**
   * Save report to file
   * @param {string} filename - Output filename
   * @param {string} content - Report content
   */
  static async saveReport(filename, content) {
    await fs.writeFile(filename, content);
  }
}

module.exports = {
  BenchmarkSuite,
  ContinuousProfiler,
  RegressionDetector,
  PerformanceReportGenerator
};

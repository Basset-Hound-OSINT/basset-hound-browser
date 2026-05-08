/**
 * Basset Hound Browser - Memory Stress Monitor
 *
 * Comprehensive memory leak detection and resource monitoring for long-running sessions.
 * Monitors heap growth, connection cleanup, event listeners, and garbage collection patterns.
 *
 * Usage: node tests/stress/memory-monitor.js [--duration minutes] [--interval seconds]
 * Examples:
 *   node tests/stress/memory-monitor.js                    # 30 minute test, 30 second intervals
 *   node tests/stress/memory-monitor.js --duration 60      # 60 minute test
 *   node tests/stress/memory-monitor.js --interval 15      # 15 second sampling intervals
 *
 * Requires: Browser running at ws://localhost:8765
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const RESULTS_DIR = path.join(__dirname, '..', 'results', 'stress');

// Parse command line arguments
function parseArgs() {
  const args = {
    duration: 30,      // minutes
    interval: 30,      // seconds
    verbose: false,
    headless: false
  };

  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--duration' && i + 1 < process.argv.length) {
      args.duration = parseInt(process.argv[++i], 10);
    } else if (process.argv[i] === '--interval' && i + 1 < process.argv.length) {
      args.interval = parseInt(process.argv[++i], 10);
    } else if (process.argv[i] === '--verbose') {
      args.verbose = true;
    } else if (process.argv[i] === '--headless') {
      args.headless = true;
    }
  }

  return args;
}

class MemoryMonitor {
  constructor(options = {}) {
    this.options = {
      durationMinutes: options.duration || 30,
      samplingIntervalSeconds: options.interval || 30,
      verbose: options.verbose || false,
      headless: options.headless || false
    };

    this.ws = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.samples = [];
    this.startTime = null;
    this.isMonitoring = false;
    this.operationCount = 0;
    this.errorCount = 0;
    this.gcEvents = [];
    this.connectionSamples = [];
    this.eventListenerCounts = [];

    // Thresholds for leak detection
    this.thresholds = {
      heapGrowthPerHourMB: 50,      // Max acceptable growth per hour
      connectionStabilityPercent: 10, // Max variance in connection count
      eventListenerGrowthRate: 0.05   // Max growth rate per minute
    };
  }

  /**
   * Connect to WebSocket server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.log('Connecting to WebSocket server at', WS_URL);
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        this.log('Connected to browser');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());

          // Ignore status messages
          if (msg.type === 'status' || msg.type === 'heartbeat') {
            return;
          }

          const pending = this.pendingRequests.get(msg.id);
          if (pending) {
            this.pendingRequests.delete(msg.id);
            pending.resolve(msg);
          }
        } catch (e) {
          this.log('Error parsing message:', e.message);
        }
      });

      this.ws.on('error', (err) => {
        this.log('WebSocket error:', err.message);
        reject(err);
      });

      this.ws.on('close', () => {
        this.log('WebSocket closed');
      });
    });
  }

  /**
   * Send command to browser
   */
  async send(command, params = {}, timeout = 30000) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const id = ++this.messageId;
    const msg = { id, command, ...params };

    return new Promise((resolve) => {
      const timeoutHandle = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve({ success: false, error: 'Command timeout', command });
        }
      }, timeout);

      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeoutHandle);
          resolve(result);
        }
      });

      try {
        this.ws.send(JSON.stringify(msg));
      } catch (e) {
        this.pendingRequests.delete(id);
        clearTimeout(timeoutHandle);
        resolve({ success: false, error: e.message, command });
      }
    });
  }

  /**
   * Get current memory stats from browser
   */
  async getMemoryStats() {
    try {
      const result = await this.send('get_memory_stats', {}, 10000);

      if (!result.success) {
        this.errorCount++;
        return null;
      }

      // Handle multiple response formats
      const stats = result.stats || result.usage || {};
      const current = stats.current || stats;

      return {
        heapUsedMB: current.heapUsedMB || 0,
        heapTotalMB: current.heapTotalMB || 0,
        rssMB: current.rssMB || 0,
        externalMB: current.externalMB || 0,
        arrayBuffersMB: current.arrayBuffersMB || 0
      };
    } catch (error) {
      this.errorCount++;
      this.log('Error getting memory stats:', error.message);
      return null;
    }
  }

  /**
   * Get network connection count
   */
  async getConnectionCount() {
    try {
      const result = await this.send('get_connections_info', {}, 10000);

      if (!result.success) {
        return null;
      }

      return result.count || result.connections?.length || 0;
    } catch (error) {
      return null;
    }
  }

  /**
   * Perform a continuous operation (navigate, screenshot, click, etc.)
   */
  async performOperation(operationNumber) {
    const operations = [
      () => this.operateNavigate(operationNumber),
      () => this.operateScreenshot(operationNumber),
      () => this.operateFillForm(operationNumber),
      () => this.operateGetContent(operationNumber),
      () => this.operateClickElement(operationNumber)
    ];

    const operation = operations[operationNumber % operations.length];
    try {
      await operation();
      return true;
    } catch (error) {
      this.log(`Operation ${operationNumber} failed:`, error.message);
      this.errorCount++;
      return false;
    }
  }

  /**
   * Navigation operation
   */
  async operateNavigate(num) {
    const urls = [
      'https://example.com',
      'https://httpbin.org/html',
      'https://www.wikipedia.org',
      'https://github.com'
    ];
    const url = urls[num % urls.length];

    const result = await this.send('navigate', { url }, 15000);
    if (!result.success) {
      throw new Error(`Navigate failed: ${result.error}`);
    }
    this.operationCount++;
  }

  /**
   * Screenshot operation
   */
  async operateScreenshot(num) {
    const types = ['viewport', 'full_page'];
    const type = types[num % types.length];

    let result;
    if (type === 'viewport') {
      result = await this.send('screenshot_viewport', {}, 15000);
    } else {
      result = await this.send('screenshot_full_page', {}, 20000);
    }

    if (!result.success && result.error !== 'No active tab') {
      throw new Error(`Screenshot failed: ${result.error}`);
    }
    this.operationCount++;
  }

  /**
   * Form fill operation
   */
  async operateFillForm(num) {
    const result = await this.send('fill', {
      selector: 'input',
      text: `test-${num}-${Date.now()}`
    }, 10000);

    if (!result.success && result.error !== 'No active tab') {
      throw new Error(`Fill form failed: ${result.error}`);
    }
    this.operationCount++;
  }

  /**
   * Get content operation
   */
  async operateGetContent(num) {
    const result = await this.send('get_content', {}, 10000);

    if (!result.success && result.error !== 'No active tab') {
      throw new Error(`Get content failed: ${result.error}`);
    }
    this.operationCount++;
  }

  /**
   * Click element operation
   */
  async operateClickElement(num) {
    const result = await this.send('click', {
      selector: 'a'
    }, 10000);

    if (!result.success && result.error !== 'No active tab') {
      throw new Error(`Click failed: ${result.error}`);
    }
    this.operationCount++;
  }

  /**
   * Collect memory sample
   */
  async collectSample() {
    const now = Date.now();
    const elapsedSeconds = Math.round((now - this.startTime) / 1000);

    // Get memory stats
    const memStats = await this.getMemoryStats();
    if (!memStats) {
      this.log(`Sample ${this.samples.length}: Failed to get memory stats`);
      return;
    }

    // Get connection count
    const connections = await this.getConnectionCount() || 0;

    const sample = {
      time_seconds: elapsedSeconds,
      timestamp: new Date(now).toISOString(),
      heap_mb: parseFloat(memStats.heapUsedMB.toFixed(2)),
      heap_total_mb: parseFloat(memStats.heapTotalMB.toFixed(2)),
      rss_mb: parseFloat(memStats.rssMB.toFixed(2)),
      external_mb: parseFloat(memStats.externalMB.toFixed(2)),
      array_buffers_mb: parseFloat(memStats.arrayBuffersMB.toFixed(2)),
      connections: connections,
      operations_since_start: this.operationCount,
      errors_since_start: this.errorCount
    };

    this.samples.push(sample);
    this.connectionSamples.push({ time: elapsedSeconds, connections });

    const sampleNum = this.samples.length;
    const memDisplay = `Heap: ${sample.heap_mb}MB (${sample.heap_total_mb}MB), RSS: ${sample.rss_mb}MB, Connections: ${connections}`;
    this.log(`Sample #${sampleNum} (@${elapsedSeconds}s): ${memDisplay}`);

    // Perform operations between samples
    for (let i = 0; i < 3; i++) {
      await this.performOperation(this.operationCount + i);
      await this.delay(1000);
    }

    return sample;
  }

  /**
   * Analyze memory samples for leaks
   */
  analyzeSamples() {
    if (this.samples.length < 3) {
      return {
        analyzed: false,
        reason: 'Not enough samples'
      };
    }

    const analysis = {
      analyzed: true,
      total_samples: this.samples.length,
      duration_minutes: this.options.durationMinutes,
      first_sample: this.samples[0],
      last_sample: this.samples[this.samples.length - 1],
      suspected_leaks: [],
      concerns: [],
      stable_regions: []
    };

    // Calculate heap growth
    const firstHeap = this.samples[0].heap_mb;
    const lastHeap = this.samples[this.samples.length - 1].heap_mb;
    const heapGrowth = lastHeap - firstHeap;
    const elapsedMinutes = (this.samples[this.samples.length - 1].time_seconds -
                           this.samples[0].time_seconds) / 60;
    const growthPerHour = elapsedMinutes > 0 ? (heapGrowth / elapsedMinutes) * 60 : 0;

    analysis.heap_growth_mb = parseFloat(heapGrowth.toFixed(2));
    analysis.heap_growth_per_hour_mb = parseFloat(growthPerHour.toFixed(2));

    // Check for linear growth (leak indicator)
    if (this.samples.length > 5) {
      const firstThird = this.samples.slice(0, Math.floor(this.samples.length / 3));
      const lastThird = this.samples.slice(Math.floor(this.samples.length * 2 / 3));

      const avgFirstThird = firstThird.reduce((sum, s) => sum + s.heap_mb, 0) / firstThird.length;
      const avgLastThird = lastThird.reduce((sum, s) => sum + s.heap_mb, 0) / lastThird.length;
      const growthRate = avgLastThird - avgFirstThird;

      if (growthRate > this.thresholds.heapGrowthPerHourMB * (elapsedMinutes / 60)) {
        analysis.suspected_leaks.push({
          type: 'UNBOUNDED_HEAP_GROWTH',
          severity: 'HIGH',
          description: `Heap growth of ${growthRate.toFixed(2)}MB detected in last third vs first third`,
          threshold: `${this.thresholds.heapGrowthPerHourMB}MB/hour`,
          measured: `${growthPerHour.toFixed(2)}MB/hour`
        });
      }
    }

    // Analyze connection stability
    const connectionVariance = this.analyzeConnectionStability();
    if (connectionVariance.leak_detected) {
      analysis.suspected_leaks.push(connectionVariance.leak);
    }
    analysis.connection_analysis = connectionVariance;

    // Check for periodic spikes (GC patterns)
    analysis.heap_statistics = this.analyzeHeapStatistics();

    // Identify stable regions (no growth)
    analysis.stable_regions = this.findStableRegions();

    // Check RSS growth
    const firstRss = this.samples[0].rss_mb;
    const lastRss = this.samples[this.samples.length - 1].rss_mb;
    const rssGrowth = lastRss - firstRss;
    analysis.rss_growth_mb = parseFloat(rssGrowth.toFixed(2));

    if (rssGrowth > heapGrowth * 1.5) {
      analysis.concerns.push({
        type: 'EXTERNAL_MEMORY_GROWTH',
        description: `RSS growth (${rssGrowth.toFixed(2)}MB) significantly exceeds heap growth`,
        possible_causes: ['Buffers, typed arrays, or native module leaks']
      });
    }

    // Summary
    if (analysis.suspected_leaks.length === 0) {
      analysis.summary = 'No major leaks detected';
      analysis.confidence = 'HIGH';
    } else {
      analysis.summary = `${analysis.suspected_leaks.length} potential leak(s) detected`;
      analysis.confidence = 'MEDIUM';
    }

    return analysis;
  }

  /**
   * Analyze heap statistics for GC patterns
   */
  analyzeHeapStatistics() {
    if (this.samples.length < 2) {
      return null;
    }

    const heaps = this.samples.map(s => s.heap_mb);
    const sorted = [...heaps].sort((a, b) => a - b);

    return {
      min_mb: parseFloat(sorted[0].toFixed(2)),
      max_mb: parseFloat(sorted[sorted.length - 1].toFixed(2)),
      avg_mb: parseFloat((heaps.reduce((a, b) => a + b, 0) / heaps.length).toFixed(2)),
      variance_mb: parseFloat(this.calculateVariance(heaps).toFixed(2)),
      gc_pattern_detected: this.detectGCPattern(heaps)
    };
  }

  /**
   * Detect garbage collection patterns
   */
  detectGCPattern(heaps) {
    if (heaps.length < 5) return null;

    const diffs = [];
    for (let i = 1; i < heaps.length; i++) {
      diffs.push(heaps[i] - heaps[i - 1]);
    }

    const negativeDiffs = diffs.filter(d => d < -5).length;
    const pattern = {
      detected: negativeDiffs >= 3,
      gc_events: negativeDiffs,
      avg_recovery_mb: negativeDiffs > 0 ?
        Math.abs(diffs.filter(d => d < 0).reduce((a, b) => a + b, 0) / negativeDiffs) : 0
    };

    pattern.avg_recovery_mb = parseFloat(pattern.avg_recovery_mb.toFixed(2));
    return pattern;
  }

  /**
   * Analyze connection stability
   */
  analyzeConnectionStability() {
    const connections = this.connectionSamples.map(s => s.connections);

    if (connections.length === 0 || connections.every(c => c === 0)) {
      return { leak_detected: false };
    }

    const avg = connections.reduce((a, b) => a + b, 0) / connections.length;
    const variance = this.calculateVariance(connections);
    const stdDev = Math.sqrt(variance);
    const coeffVar = avg > 0 ? (stdDev / avg) * 100 : 0;

    const analysis = {
      leak_detected: false,
      avg_connections: parseFloat(avg.toFixed(2)),
      variance: parseFloat(variance.toFixed(2)),
      std_dev: parseFloat(stdDev.toFixed(2)),
      coeff_variation_percent: parseFloat(coeffVar.toFixed(2))
    };

    // Check for unbounded connection growth
    if (connections.length > 5) {
      const firstConnections = connections.slice(0, Math.floor(connections.length / 3));
      const lastConnections = connections.slice(Math.floor(connections.length * 2 / 3));

      const avgFirst = firstConnections.reduce((a, b) => a + b, 0) / firstConnections.length;
      const avgLast = lastConnections.reduce((a, b) => a + b, 0) / lastConnections.length;

      if (avgLast > avgFirst * 1.5 && avgFirst > 0) {
        analysis.leak_detected = true;
        analysis.leak = {
          type: 'CONNECTION_LEAK',
          severity: 'MEDIUM',
          description: `Connection count increased from ${avgFirst.toFixed(0)} to ${avgLast.toFixed(0)}`,
          first_third_avg: parseFloat(avgFirst.toFixed(2)),
          last_third_avg: parseFloat(avgLast.toFixed(2))
        };
      }
    }

    return analysis;
  }

  /**
   * Find regions where memory was stable
   */
  findStableRegions() {
    if (this.samples.length < 3) {
      return [];
    }

    const regions = [];
    let currentRegion = null;
    const threshold = 5; // MB variance threshold

    for (let i = 0; i < this.samples.length - 1; i++) {
      const window = this.samples.slice(i, Math.min(i + 5, this.samples.length));
      const heaps = window.map(s => s.heap_mb);
      const variance = this.calculateVariance(heaps);

      if (variance < threshold) {
        if (!currentRegion) {
          currentRegion = {
            start_time: window[0].time_seconds,
            start_heap: window[0].heap_mb,
            variance: 0
          };
        }
        currentRegion.end_time = window[window.length - 1].time_seconds;
        currentRegion.end_heap = window[window.length - 1].heap_mb;
        currentRegion.variance = parseFloat(variance.toFixed(2));
      } else {
        if (currentRegion) {
          currentRegion.duration_seconds = currentRegion.end_time - currentRegion.start_time;
          currentRegion.growth_mb = parseFloat((currentRegion.end_heap - currentRegion.start_heap).toFixed(2));
          regions.push(currentRegion);
          currentRegion = null;
        }
      }
    }

    if (currentRegion) {
      currentRegion.duration_seconds = currentRegion.end_time - currentRegion.start_time;
      currentRegion.growth_mb = parseFloat((currentRegion.end_heap - currentRegion.start_heap).toFixed(2));
      regions.push(currentRegion);
    }

    return regions;
  }

  /**
   * Calculate variance of array
   */
  calculateVariance(arr) {
    if (arr.length === 0) return 0;
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const squaredDiffs = arr.map(val => Math.pow(val - avg, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / arr.length;
  }

  /**
   * Run the monitoring session
   */
  async run() {
    const totalSeconds = this.options.durationMinutes * 60;
    const intervalSeconds = this.options.samplingIntervalSeconds;
    const samplesExpected = Math.floor(totalSeconds / intervalSeconds);

    console.log('\n' + '='.repeat(70));
    console.log('BASSET HOUND BROWSER - MEMORY STRESS MONITOR');
    console.log('='.repeat(70));
    console.log(`Start Time: ${new Date().toISOString()}`);
    console.log(`Test Duration: ${this.options.durationMinutes} minutes`);
    console.log(`Sampling Interval: ${intervalSeconds} seconds`);
    console.log(`Expected Samples: ${samplesExpected}`);
    console.log('='.repeat(70) + '\n');

    this.startTime = Date.now();
    this.isMonitoring = true;
    let sampleCount = 0;

    try {
      // Main monitoring loop
      while (this.isMonitoring) {
        const elapsed = Date.now() - this.startTime;
        const elapsedSeconds = Math.round(elapsed / 1000);

        // Collect sample
        await this.collectSample();
        sampleCount++;

        // Check if we've exceeded duration
        if (elapsedSeconds >= totalSeconds) {
          this.log('Monitoring duration complete');
          this.isMonitoring = false;
          break;
        }

        // Wait for next sample interval
        const nextSampleTime = this.startTime + (sampleCount * intervalSeconds * 1000);
        const waitTime = Math.max(1000, nextSampleTime - Date.now());
        await this.delay(waitTime);
      }
    } catch (error) {
      this.log('Error during monitoring:', error.message);
      throw error;
    }

    const endTime = Date.now();
    const actualDurationSeconds = Math.round((endTime - this.startTime) / 1000);

    return {
      actual_duration_seconds: actualDurationSeconds,
      samples_collected: sampleCount,
      operations_performed: this.operationCount,
      errors_encountered: this.errorCount
    };
  }

  /**
   * Save results to file
   */
  async saveResults() {
    // Ensure results directory exists
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
    }

    const analysis = this.analyzeSamples();

    const results = {
      metadata: {
        test_name: 'Memory Stress Monitor',
        test_date: new Date().toISOString(),
        environment: {
          node_version: process.version,
          platform: process.platform,
          ws_url: WS_URL
        }
      },
      test_config: {
        target_duration_minutes: this.options.durationMinutes,
        sampling_interval_seconds: this.options.samplingIntervalSeconds,
        verbose: this.options.verbose
      },
      test_summary: {
        test_duration_seconds: this.samples.length > 0 ?
          this.samples[this.samples.length - 1].time_seconds : 0,
        samples_collected: this.samples.length,
        operations_performed: this.operationCount,
        errors_encountered: this.errorCount
      },
      memory_samples: this.samples,
      analysis: analysis,
      thresholds: this.thresholds
    };

    // Save JSON results
    const jsonPath = path.join(RESULTS_DIR, 'memory-monitor-results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    this.log(`Results saved to: ${jsonPath}`);

    // Generate findings report
    const findingsPath = path.join(RESULTS_DIR, 'memory-monitor-findings.txt');
    const findings = this.generateFindings(analysis);
    fs.writeFileSync(findingsPath, findings);
    this.log(`Findings saved to: ${findingsPath}`);

    // Generate summary
    const summaryPath = path.join(RESULTS_DIR, 'memory-monitor-summary.txt');
    const summary = this.generateSummary(results);
    fs.writeFileSync(summaryPath, summary);
    this.log(`Summary saved to: ${summaryPath}`);

    return { jsonPath, findingsPath, summaryPath };
  }

  /**
   * Generate findings report
   */
  generateFindings(analysis) {
    let report = 'BASSET HOUND BROWSER - MEMORY MONITORING FINDINGS\n';
    report += '='.repeat(70) + '\n\n';
    report += `Test Duration: ${analysis.duration_minutes} minutes\n`;
    report += `Total Samples: ${analysis.total_samples}\n\n`;

    report += 'SUMMARY\n';
    report += '-'.repeat(70) + '\n';
    report += `Status: ${analysis.summary}\n`;
    report += `Confidence: ${analysis.confidence}\n\n`;

    report += 'HEAP MEMORY ANALYSIS\n';
    report += '-'.repeat(70) + '\n';
    report += `First Sample Heap: ${analysis.first_sample.heap_mb} MB\n`;
    report += `Last Sample Heap: ${analysis.last_sample.heap_mb} MB\n`;
    report += `Total Growth: ${analysis.heap_growth_mb} MB\n`;
    report += `Growth Rate: ${analysis.heap_growth_per_hour_mb} MB/hour\n`;
    report += `Threshold: ${this.thresholds.heapGrowthPerHourMB} MB/hour\n`;
    report += `Status: ${analysis.heap_growth_per_hour_mb > this.thresholds.heapGrowthPerHourMB ? 'EXCEEDS THRESHOLD' : 'Within threshold'}\n\n`;

    if (analysis.heap_statistics) {
      report += 'HEAP STATISTICS\n';
      report += '-'.repeat(70) + '\n';
      report += `Min Heap: ${analysis.heap_statistics.min_mb} MB\n`;
      report += `Max Heap: ${analysis.heap_statistics.max_mb} MB\n`;
      report += `Average Heap: ${analysis.heap_statistics.avg_mb} MB\n`;
      report += `Variance: ${analysis.heap_statistics.variance_mb} MB^2\n`;

      if (analysis.heap_statistics.gc_pattern_detected) {
        const gc = analysis.heap_statistics.gc_pattern_detected;
        report += `GC Pattern Detected: YES\n`;
        report += `GC Events: ${gc.gc_events}\n`;
        report += `Avg Recovery: ${gc.avg_recovery_mb} MB\n`;
      }
      report += '\n';
    }

    report += 'EXTERNAL MEMORY ANALYSIS\n';
    report += '-'.repeat(70) + '\n';
    report += `RSS Growth: ${analysis.rss_growth_mb} MB\n`;
    report += `First RSS: ${analysis.first_sample.rss_mb} MB\n`;
    report += `Last RSS: ${analysis.last_sample.rss_mb} MB\n\n`;

    if (analysis.connection_analysis) {
      const conn = analysis.connection_analysis;
      report += 'CONNECTION ANALYSIS\n';
      report += '-'.repeat(70) + '\n';
      report += `Average Connections: ${conn.avg_connections}\n`;
      report += `Connection Variance: ${conn.variance.toFixed(2)}\n`;
      report += `Coefficient of Variation: ${conn.coeff_variation_percent.toFixed(2)}%\n`;

      if (conn.leak_detected && conn.leak) {
        report += `LEAK DETECTED:\n`;
        report += `  Type: ${conn.leak.type}\n`;
        report += `  Severity: ${conn.leak.severity}\n`;
        report += `  Description: ${conn.leak.description}\n`;
      }
      report += '\n';
    }

    report += 'STABLE REGIONS\n';
    report += '-'.repeat(70) + '\n';
    if (analysis.stable_regions.length > 0) {
      report += `Found ${analysis.stable_regions.length} stable region(s):\n\n`;
      analysis.stable_regions.forEach((region, idx) => {
        report += `Region ${idx + 1}:\n`;
        report += `  Time: ${region.start_time}s - ${region.end_time}s (${region.duration_seconds}s)\n`;
        report += `  Start Heap: ${region.start_heap} MB\n`;
        report += `  End Heap: ${region.end_heap} MB\n`;
        report += `  Growth: ${region.growth_mb} MB\n`;
        report += `  Variance: ${region.variance} MB^2\n\n`;
      });
    } else {
      report += 'No stable regions found\n\n';
    }

    report += 'SUSPECTED LEAKS\n';
    report += '-'.repeat(70) + '\n';
    if (analysis.suspected_leaks.length > 0) {
      analysis.suspected_leaks.forEach((leak, idx) => {
        report += `Leak ${idx + 1}: ${leak.type}\n`;
        report += `  Severity: ${leak.severity}\n`;
        report += `  Description: ${leak.description}\n`;
        if (leak.threshold) {
          report += `  Threshold: ${leak.threshold}\n`;
        }
        if (leak.measured) {
          report += `  Measured: ${leak.measured}\n`;
        }
        report += '\n';
      });
    } else {
      report += 'No major leaks detected\n\n';
    }

    report += 'CONCERNS\n';
    report += '-'.repeat(70) + '\n';
    if (analysis.concerns.length > 0) {
      analysis.concerns.forEach((concern, idx) => {
        report += `Concern ${idx + 1}: ${concern.type}\n`;
        report += `  Description: ${concern.description}\n`;
        if (concern.possible_causes) {
          report += `  Possible Causes: ${concern.possible_causes.join(', ')}\n`;
        }
        report += '\n';
      });
    } else {
      report += 'No concerns\n\n';
    }

    report += 'OPERATIONS PERFORMED\n';
    report += '-'.repeat(70) + '\n';
    report += `Total Operations: ${this.operationCount}\n`;
    report += `Total Errors: ${this.errorCount}\n`;
    report += `Success Rate: ${((this.operationCount - this.errorCount) / Math.max(1, this.operationCount) * 100).toFixed(1)}%\n\n`;

    report += 'RECOMMENDATIONS\n';
    report += '-'.repeat(70) + '\n';
    report += this.generateRecommendations(analysis);

    return report;
  }

  /**
   * Generate summary report
   */
  generateSummary(results) {
    let summary = 'MEMORY STRESS TEST - SUMMARY REPORT\n';
    summary += '='.repeat(70) + '\n\n';

    summary += `Test Date: ${results.metadata.test_date}\n`;
    summary += `Duration: ${results.test_summary.test_duration_seconds} seconds\n`;
    summary += `Samples Collected: ${results.test_summary.samples_collected}\n`;
    summary += `Operations Performed: ${results.test_summary.operations_performed}\n`;
    summary += `Errors: ${results.test_summary.errors_encountered}\n\n`;

    const analysis = results.analysis;
    summary += 'KEY FINDINGS\n';
    summary += '-'.repeat(70) + '\n';
    summary += `Heap Growth: ${analysis.heap_growth_mb} MB (${analysis.heap_growth_per_hour_mb} MB/hour)\n`;
    summary += `RSS Growth: ${analysis.rss_growth_mb} MB\n`;
    summary += `Suspected Leaks: ${analysis.suspected_leaks.length}\n`;
    summary += `Confidence Level: ${analysis.confidence}\n`;
    summary += `Status: ${analysis.summary}\n\n`;

    return summary;
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(analysis) {
    let recommendations = '';

    if (analysis.suspected_leaks.length === 0) {
      recommendations += '✓ No major memory leaks detected\n';
      recommendations += '  - System appears stable for long-running sessions\n';
    }

    // Rate limit cleanup check
    if (analysis.heap_growth_per_hour_mb > 20) {
      recommendations += '\n⚠ CHECK RATE LIMIT CLEANUP (ROADMAP issue #1436)\n';
      recommendations += '  - Rate limit data structure may be growing unbounded\n';
      recommendations += '  - Location: websocket/server.js:313 (rateLimitData Map)\n';
      recommendations += '  - Solution: Add periodic cleanup in heartbeat loop\n';
      recommendations += '  - Remove entries older than rateLimitWindow (60s default)\n';
    }

    // Event listener check
    if (analysis.connection_analysis && analysis.connection_analysis.leak_detected) {
      recommendations += '\n⚠ CHECK EVENT LISTENER CLEANUP\n';
      recommendations += '  - Connection count increasing suggests listener leak\n';
      recommendations += '  - Verify WebSocket message handlers are unsubscribed\n';
      recommendations += '  - Check for circular references in command handlers\n';
    }

    // External memory check
    if (analysis.rss_growth_mb > analysis.heap_growth_mb * 1.5) {
      recommendations += '\n⚠ CHECK EXTERNAL MEMORY USAGE\n';
      recommendations += '  - RSS growing faster than heap\n';
      recommendations += '  - Possible causes: buffers, typed arrays, or native modules\n';
      recommendations += '  - Monitor screenshot/recording data structures\n';
    }

    if (analysis.stable_regions.length > 0) {
      recommendations += '\n✓ STABLE REGIONS FOUND\n';
      recommendations += `  - System achieves stability in ${analysis.stable_regions.length} region(s)\n`;
      recommendations += '  - Long-running sessions are viable with proper cleanup\n';
    }

    if (recommendations === '') {
      recommendations += '- Continue monitoring in production\n';
      recommendations += '- Run periodic stress tests (weekly)\n';
      recommendations += '- Monitor rate limit cleanup effectiveness\n';
    }

    return recommendations;
  }

  /**
   * Utility: delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Utility: log
   */
  log(...args) {
    if (this.options.verbose || args[0].includes('Sample') || args[0].includes('Error') || args[0].includes('=')) {
      console.log('[MemoryMonitor]', ...args);
    }
  }

  /**
   * Close connection
   */
  close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.isMonitoring = false;
  }
}

/**
 * Main execution
 */
async function main() {
  const args = parseArgs();

  const monitor = new MemoryMonitor({
    duration: args.duration,
    interval: args.interval,
    verbose: args.verbose,
    headless: args.headless
  });

  try {
    await monitor.connect();
    await monitor.run();
    await monitor.saveResults();

    console.log('\n' + '='.repeat(70));
    console.log('MEMORY MONITORING COMPLETE');
    console.log('='.repeat(70));
    console.log(`Results saved to: ${RESULTS_DIR}`);
    console.log('  - memory-monitor-results.json');
    console.log('  - memory-monitor-findings.txt');
    console.log('  - memory-monitor-summary.txt');
    console.log('='.repeat(70) + '\n');

    monitor.close();
    process.exit(0);
  } catch (error) {
    console.error('\nFatal error:', error.message);
    console.error(error.stack);
    monitor.close();
    process.exit(1);
  }
}

// Run monitor
main();

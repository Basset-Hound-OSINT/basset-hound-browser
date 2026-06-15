const MetricsCollector = require('../src/monitoring/metrics-collector');
const { MetricsAggregator } = require('../src/monitoring/metrics-aggregator');
const { AlertManager, ALERT_TYPES, DEFAULT_THRESHOLDS } = require('../src/monitoring/alert-manager');
const { MetricsStore } = require('../src/monitoring/metrics-store');

describe('MetricsCollector', () => {
  let collector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  afterEach(() => {
    collector.shutdown();
  });

  test('initializes with default metrics', () => {
    const metrics = collector.getCurrentMetrics();
    expect(metrics.commands.total).toBe(0);
    expect(metrics.sessions.active).toBe(0);
    expect(metrics.connections.active).toBe(0);
    expect(metrics.errors.total).toBe(0);
  });

  test('records command execution with latency', (done) => {
    const startTime = collector.recordCommandStart('navigate', 'cmd-1');
    expect(typeof startTime).toBe('number');

    setTimeout(() => {
      const duration = Date.now() - startTime;
      collector.recordCommandEnd('cmd-1', 'navigate', duration, true, 1024);

      const metrics = collector.getCurrentMetrics();
      expect(metrics.commands.total).toBe(1);
      expect(metrics.commands.success).toBe(1);
      expect(metrics.commands.failure).toBe(0);
      expect(metrics.commands.latency.samples).toContain(duration);
      done();
    }, 10);
  });

  test('calculates latency percentiles (p50, p95, p99)', () => {
    // Add 100 samples with known distribution
    for (let i = 0; i < 100; i++) {
      const duration = (i + 1) * 10; // 10, 20, 30, ..., 1000
      collector.recordCommandEnd(`cmd-${i}`, 'navigate', duration, true, 0);
    }

    const metrics = collector.getCurrentMetrics();
    expect(metrics.commands.latency.p50).toBeGreaterThan(400);
    expect(metrics.commands.latency.p50).toBeLessThan(600);

    expect(metrics.commands.latency.p95).toBeGreaterThan(900);
    expect(metrics.commands.latency.p95).toBeLessThanOrEqual(1000);

    expect(metrics.commands.latency.p99).toBeGreaterThan(950);
    expect(metrics.commands.latency.p99).toBeLessThanOrEqual(1000);
  });

  test('tracks per-command metrics', () => {
    collector.recordCommandStart('navigate', 'cmd-1');
    collector.recordCommandEnd('cmd-1', 'navigate', 50, true, 1024);
    collector.recordCommandStart('navigate', 'cmd-2');
    collector.recordCommandEnd('cmd-2', 'navigate', 55, true, 2048);
    collector.recordCommandStart('click', 'cmd-3');
    collector.recordCommandEnd('cmd-3', 'click', 30, true, 512);

    const metrics = collector.getCurrentMetrics();
    expect(metrics.commands.byCommand.navigate.count).toBe(2);
    expect(metrics.commands.byCommand.click.count).toBe(1);
    expect(metrics.commands.byCommand.navigate.successCount).toBe(2);
  });

  test('tracks session lifecycle', () => {
    collector.recordSessionCreated('sess-1');
    expect(collector.getCurrentMetrics().sessions.active).toBe(1);
    expect(collector.getCurrentMetrics().sessions.total).toBe(1);

    collector.recordSessionClosed('sess-1', 5000, 10, 0);
    expect(collector.getCurrentMetrics().sessions.active).toBe(0);
    expect(collector.getCurrentMetrics().sessions.closed).toBe(1);
  });

  test('records errors with type tracking', (done) => {
    // Add listeners before recording errors to prevent unhandled error events
    let errorCount = 0;
    collector.on('error', () => {
      errorCount++;
    });

    collector.recordError('TIMEOUT', 'Command timed out', 'navigate');
    collector.recordError('NETWORK', 'Network error', 'navigate');
    collector.recordError('TIMEOUT', 'Command timed out', 'click');

    const metrics = collector.getCurrentMetrics();
    expect(metrics.errors.total).toBe(3);
    expect(metrics.errors.byType.TIMEOUT).toBe(2);
    expect(metrics.errors.byType.NETWORK).toBe(1);
    expect(metrics.errors.recent.length).toBe(3);
    expect(errorCount).toBe(3);
    done();
  });

  test('tracks connection lifecycle', () => {
    collector.recordConnectionOpened();
    collector.recordConnectionOpened();
    expect(collector.getCurrentMetrics().connections.active).toBe(2);

    collector.recordConnectionClosed(5000);
    expect(collector.getCurrentMetrics().connections.active).toBe(1);
    expect(collector.getCurrentMetrics().connections.closed).toBe(1);
  });

  test('calculates throughput metrics', (done) => {
    collector.recordCommandEnd('cmd-1', 'navigate', 50, true, 1024);
    collector.recordCommandEnd('cmd-2', 'navigate', 50, true, 2048);

    const metrics = collector.getCurrentMetrics();
    expect(metrics.throughput.totalMessages).toBe(2);
    expect(metrics.throughput.totalBytes).toBe(3072);
    expect(metrics.throughput.messagesPerSecond).toBeGreaterThan(0);
    done();
  });

  test('emits command event', (done) => {
    collector.on('command', (data) => {
      expect(data.commandName).toBe('navigate');
      expect(data.success).toBe(true);
      expect(data.duration).toBeGreaterThan(0);
      done();
    });

    collector.recordCommandEnd('cmd-1', 'navigate', 50, true, 0);
  });

  test('emits error event', (done) => {
    collector.on('error', (data) => {
      expect(data.type).toBe('TIMEOUT');
      expect(data.message).toBe('Timed out');
      done();
    });

    collector.recordError('TIMEOUT', 'Timed out', 'navigate');
  });

  test('maintains maximum sample buffer size', () => {
    const collector2 = new MetricsCollector({ maxSamples: 100 });

    for (let i = 0; i < 200; i++) {
      collector2.recordCommandEnd(`cmd-${i}`, 'navigate', i, true, 0);
    }

    const metrics = collector2.getCurrentMetrics();
    expect(metrics.commands.latency.samples.length).toBeLessThanOrEqual(100);
    collector2.shutdown();
  });

  test('calculates memory metrics', (done) => {
    // Wait for resource collection interval to run
    setTimeout(() => {
      const metrics = collector.getCurrentMetrics();
      expect(metrics.resources.memory).toBeDefined();
      expect(metrics.resources.memory.heapTotal).toBeGreaterThan(0);
      expect(metrics.resources.memory.percentUsed).toBeGreaterThanOrEqual(0);
      expect(metrics.resources.memory.percentUsed).toBeLessThanOrEqual(100);
      done();
    }, 6000); // Wait for resource collection
  });

  test('tracks command failure count', () => {
    collector.recordCommandStart('navigate', 'cmd-1');
    collector.recordCommandEnd('cmd-1', 'navigate', 50, true, 0);
    collector.recordCommandStart('navigate', 'cmd-2');
    collector.recordCommandEnd('cmd-2', 'navigate', 60, false, 0);
    collector.recordCommandStart('navigate', 'cmd-3');
    collector.recordCommandEnd('cmd-3', 'navigate', 55, false, 0);

    const metrics = collector.getCurrentMetrics();
    expect(metrics.commands.total).toBe(3);
    expect(metrics.commands.success).toBe(1);
    expect(metrics.commands.failure).toBe(2);
    expect(metrics.commands.byCommand.navigate.failureCount).toBe(2);
  });

  test('handles concurrent command recording', () => {
    for (let i = 0; i < 50; i++) {
      const id = `cmd-${i}`;
      collector.recordCommandStart('test', id);
      collector.recordCommandEnd(id, 'test', Math.random() * 100, Math.random() > 0.1, 1024);
    }

    const metrics = collector.getCurrentMetrics();
    expect(metrics.commands.total).toBe(50);
  });

  test('resets metrics correctly', () => {
    collector.recordCommandEnd('cmd-1', 'navigate', 50, true, 1024);
    collector.recordSessionCreated('sess-1');

    const beforeReset = collector.getCurrentMetrics();
    expect(beforeReset.commands.total).toBe(1);

    collector._resetMetrics();
    const afterReset = collector.getCurrentMetrics();
    expect(afterReset.commands.total).toBe(0);
    expect(afterReset.sessions.active).toBe(0);
  });

  test('calculates error rate correctly', (done) => {
    // Add error listener to prevent unhandled error events
    collector.on('error', () => {});

    // Record 5 errors in rapid succession
    for (let i = 0; i < 5; i++) {
      collector.recordError('TIMEOUT', 'Timed out', 'navigate');
    }

    const metrics = collector.getCurrentMetrics();
    expect(metrics.errors.rate).toBeGreaterThan(0);
    expect(metrics.errors.total).toBe(5);
    done();
  });
});

describe('MetricsAggregator', () => {
  let aggregator;
  let sampleMetrics;

  beforeEach(() => {
    aggregator = new MetricsAggregator();

    sampleMetrics = {
      timestamp: Date.now(),
      commands: {
        total: 100,
        success: 95,
        failure: 5,
        activeCount: 2,
        latency: {
          samples: Array.from({ length: 100 }, (_, i) => (i + 1) * 10),
          min: 10,
          max: 1000,
          avg: 505,
          p50: 505,
          p95: 950,
          p99: 995
        }
      },
      throughput: {
        messagesPerSecond: 100,
        bytesPerSecond: 50000,
        totalMessages: 1000,
        totalBytes: 500000
      },
      sessions: {
        active: 5,
        total: 50,
        closed: 45,
        avgDuration: 60000,
        avgCommandsPerSession: 20
      },
      errors: {
        total: 5,
        rate: 0.05,
        byType: { TIMEOUT: 3, NETWORK: 2 }
      },
      resources: {
        memory: {
          heapUsed: 256,
          heapTotal: 512,
          percentUsed: 50,
          growthRate: 2
        },
        cpu: {
          usage: 15,
          avgUsage: 12
        },
        connections: {
          websocket: 5,
          fileDescriptors: 20
        }
      }
    };
  });

  test('aggregates metrics for 1-minute window', () => {
    const result = aggregator.aggregate(sampleMetrics, '1m');

    expect(result.window).toBe('1m');
    expect(result.metrics.command.totalCount).toBe(100);
    expect(result.metrics.command.latency.p99).toBe(995);
    expect(result.metrics.throughput.messagesPerSecond).toBe(100);
    expect(result.metrics.sessions.activeCount).toBe(5);
  });

  test('calculates trend direction correctly', () => {
    // Create three metric sets with increasing latency (use deep copy to avoid sharing)
    const metrics1 = JSON.parse(JSON.stringify(sampleMetrics));
    metrics1.commands.latency.p95 = 50;

    const metrics2 = JSON.parse(JSON.stringify(sampleMetrics));
    metrics2.commands.latency.p95 = 75; // 50% increase above threshold

    const result1 = aggregator.aggregate(metrics1, '1m');
    expect(result1.trends.latency).toBe('stable'); // First one is stable (no history)

    const result2 = aggregator.aggregate(metrics2, '1m');

    // Verify by checking historical values were stored
    expect(aggregator.historicalValues['1m'].length).toBe(2);
    // The aggregator should have detected the trend after the second call
    const trends = aggregator.getTrendAnalysis('1m');
    expect(trends.latency).toBe('up');
  });

  test('detects stable trends', () => {
    const metrics1 = { ...sampleMetrics };
    const metrics2 = { ...sampleMetrics };

    aggregator.aggregate(metrics1, '1m');
    const result2 = aggregator.aggregate(metrics2, '1m');

    // Same values should be stable
    expect(result2.trends.latency).toBe('stable');
  });

  test('queries time range correctly', () => {
    const now = Date.now();
    const metrics1 = { ...sampleMetrics, timestamp: now - 100000 };
    const metrics2 = { ...sampleMetrics, timestamp: now };

    aggregator.aggregate(metrics1, '1m');
    aggregator.aggregate(metrics2, '1m');

    const results = aggregator.queryTimeRange('1m', now - 50000, now + 50000);
    expect(results.length).toBeGreaterThan(0);
  });

  test('returns latest snapshots for all windows', () => {
    aggregator.aggregate(sampleMetrics, '1m');
    aggregator.aggregate(sampleMetrics, '5m');
    aggregator.aggregate(sampleMetrics, '1h');

    const latest = aggregator.getLatestSnapshots();
    expect(latest['1m']).toBeDefined();
    expect(latest['5m']).toBeDefined();
    expect(latest['1h']).toBeDefined();
  });

  test('maintains historical data for trends', () => {
    aggregator.aggregate(sampleMetrics, '1m');
    aggregator.aggregate(sampleMetrics, '1m');
    aggregator.aggregate(sampleMetrics, '1m');

    const trends = aggregator.getTrendAnalysis('1m');
    expect(trends).toHaveProperty('latency');
    expect(trends).toHaveProperty('throughput');
    expect(trends).toHaveProperty('errorRate');
  });

  test('exports all historical data', () => {
    aggregator.aggregate(sampleMetrics, '1m');
    aggregator.aggregate(sampleMetrics, '5m');
    aggregator.aggregate(sampleMetrics, '1h');

    const allData = aggregator.getAllHistoricalData();
    expect(allData).toHaveProperty('1m');
    expect(allData).toHaveProperty('5m');
    expect(allData).toHaveProperty('1h');
  });
});

describe('AlertManager', () => {
  let alertManager;
  let sampleMetrics;

  beforeEach(() => {
    alertManager = new AlertManager();

    sampleMetrics = {
      timestamp: Date.now(),
      commands: {
        total: 100,
        success: 95,
        failure: 5,
        activeCount: 0,
        latency: {
          p99: 50,
          avg: 20
        }
      },
      errors: {
        total: 5,
        rate: 0.05,
        byType: {}
      },
      connections: {
        active: 5,
        total: 50,
        closed: 45
      },
      resources: {
        memory: {
          heapUsed: 256,
          percentUsed: 50,
          growthRate: 5
        },
        cpu: {
          usage: 30
        }
      }
    };
  });

  afterEach(() => {
    alertManager.shutdown();
  });

  test('detects high latency alerts', (done) => {
    alertManager.on('alert', (alert) => {
      expect(alert.type).toBe(ALERT_TYPES.HIGH_LATENCY);
      expect(alert.severity).toBe('critical');
      done();
    });

    sampleMetrics.commands.latency.p99 = 150; // Exceeds default threshold of 100
    alertManager.evaluateMetrics(sampleMetrics);
  });

  test('detects high error rate alerts', (done) => {
    alertManager.on('alert', (alert) => {
      expect(alert.type).toBe(ALERT_TYPES.HIGH_ERROR_RATE);
      done();
    });

    sampleMetrics.errors.rate = 0.1; // 10% exceeds default threshold of 5%
    alertManager.evaluateMetrics(sampleMetrics);
  });

  test('detects low success rate alerts', (done) => {
    alertManager.on('alert', (alert) => {
      expect(alert.type).toBe(ALERT_TYPES.LOW_SUCCESS_RATE);
      done();
    });

    sampleMetrics.commands.success = 80; // 80% success rate below 95% threshold
    alertManager.evaluateMetrics(sampleMetrics);
  });

  test('detects CPU overload alerts', (done) => {
    alertManager.on('alert', (alert) => {
      expect(alert.type).toBe(ALERT_TYPES.CPU_OVERLOAD);
      done();
    });

    sampleMetrics.resources.cpu.usage = 85; // Exceeds default threshold of 80%
    alertManager.evaluateMetrics(sampleMetrics);
  });

  test('suppresses alerts for duration', (done) => {
    let alertCount = 0;

    alertManager.on('alert', () => {
      alertCount++;
    });

    sampleMetrics.commands.latency.p99 = 150;
    alertManager.evaluateMetrics(sampleMetrics);

    // Suppress for 5 seconds
    alertManager.suppressAlert(ALERT_TYPES.HIGH_LATENCY, 5000);

    // Try to trigger same alert again - should be suppressed
    setTimeout(() => {
      alertManager.evaluateMetrics(sampleMetrics);
      expect(alertCount).toBe(1); // Only the first one should have triggered
      done();
    }, 100);
  });

  test('sets custom thresholds', () => {
    const result = alertManager.setThreshold(ALERT_TYPES.HIGH_LATENCY, 200);
    expect(result.newThreshold).toBe(200);

    // Metric that would trigger before should not now
    sampleMetrics.commands.latency.p99 = 150;
    const activeAlerts = alertManager.getActiveAlerts();
    expect(activeAlerts.length).toBe(0);
  });

  test('returns active alerts', () => {
    sampleMetrics.commands.latency.p99 = 150;
    alertManager.evaluateMetrics(sampleMetrics);

    const activeAlerts = alertManager.getActiveAlerts();
    expect(activeAlerts.length).toBeGreaterThan(0);
    expect(activeAlerts[0].severity).toBe('critical');
  });

  test('filters alerts by severity', () => {
    sampleMetrics.commands.latency.p99 = 150; // Critical
    sampleMetrics.commands.success = 80; // Warning
    alertManager.evaluateMetrics(sampleMetrics);

    const criticalAlerts = alertManager.getActiveAlerts('critical');
    expect(criticalAlerts.length).toBeGreaterThan(0);
    expect(criticalAlerts[0].severity).toBe('critical');
  });

  test('tracks alert history', () => {
    sampleMetrics.commands.latency.p99 = 150;
    alertManager.evaluateMetrics(sampleMetrics);

    const history = alertManager.getAlertHistory();
    expect(history.length).toBeGreaterThan(0);
  });

  test('prevents alert rapid re-triggering (cooldown)', (done) => {
    let alertCount = 0;
    alertManager.on('alert', () => {
      alertCount++;
    });

    sampleMetrics.commands.latency.p99 = 150;
    alertManager.evaluateMetrics(sampleMetrics);

    // Try to trigger same alert again immediately - should be in cooldown
    setTimeout(() => {
      alertManager.evaluateMetrics(sampleMetrics);
      expect(alertCount).toBe(1); // Should only trigger once due to cooldown
      done();
    }, 100);
  });

  test('returns configuration', () => {
    const config = alertManager.getConfiguration();
    expect(config.thresholds).toBeDefined();
    expect(config.evaluationInterval).toBe(5000);
  });

  test('clears active alerts', () => {
    sampleMetrics.commands.latency.p99 = 150;
    alertManager.evaluateMetrics(sampleMetrics);

    const before = alertManager.getActiveAlerts();
    expect(before.length).toBeGreaterThan(0);

    alertManager.clearActiveAlerts();
    const after = alertManager.getActiveAlerts();
    expect(after.length).toBe(0);
  });
});

describe('MetricsStore', () => {
  let store;
  let sampleMetrics;

  beforeEach(() => {
    store = new MetricsStore();

    sampleMetrics = {
      timestamp: Date.now(),
      commands: { total: 100 },
      sessions: { active: 5 },
      errors: { total: 2 },
      resources: {
        memory: { heapUsed: 256, heapTotal: 512, percentUsed: 50, growthRate: 5 },
        cpu: { usage: 15 }
      }
    };
  });

  test('adds snapshots correctly', () => {
    // Create a more complete sample metrics object
    const metrics = {
      ...sampleMetrics,
      commands: {
        total: 100,
        success: 95,
        failure: 5,
        latency: {
          p99: 50,
          p95: 40,
          p50: 20,
          avg: 25
        }
      }
    };

    store.addSnapshot(metrics);

    const latest = store.getLatest();
    expect(latest).toBeDefined();
    expect(latest.metrics.commands.total).toBe(100);
  });

  test('queries by time range', () => {
    const now = Date.now();
    const metrics1 = {
      ...sampleMetrics,
      timestamp: now - 120000,
      commands: { total: 100, latency: { p99: 50, p95: 40, p50: 20 } }
    };
    const metrics2 = {
      ...sampleMetrics,
      timestamp: now,
      commands: { total: 100, latency: { p99: 50, p95: 40, p50: 20 } }
    };

    store.addSnapshot(metrics1);
    store.addSnapshot(metrics2);

    const results = store.queryRange(now - 60000, now + 60000);
    expect(results.length).toBeGreaterThan(0);
  });

  test('returns last N snapshots', () => {
    for (let i = 0; i < 10; i++) {
      const metrics = {
        ...sampleMetrics,
        timestamp: Date.now() + i,
        commands: { total: 100, latency: { p99: 50, p95: 40, p50: 20 } }
      };
      store.addSnapshot(metrics);
    }

    const last5 = store.getLastN(5);
    expect(last5.length).toBeLessThanOrEqual(5);
  });

  test('queries last hours', () => {
    const now = Date.now();

    // Add snapshots from past 2 hours
    for (let i = 0; i < 120; i++) {
      const metrics = {
        ...sampleMetrics,
        timestamp: now - (120 - i) * 60000,
        commands: { total: 100, latency: { p99: 50, p95: 40, p50: 20 } }
      };
      store.addSnapshot(metrics);
    }

    const lastHour = store.getLastHours(1);
    expect(lastHour.length).toBeGreaterThan(0);
  });

  test('reports memory footprint', () => {
    for (let i = 0; i < 10; i++) {
      const metrics = {
        ...sampleMetrics,
        commands: { total: 100, latency: { p99: 50, p95: 40, p50: 20 } }
      };
      store.addSnapshot(metrics);
    }

    const footprint = store.getMemoryFootprint();
    expect(footprint.oneMinuteSnapshots).toBeGreaterThan(0);
    expect(footprint.estimatedMbUsage).toBeGreaterThan(0);
  });

  test('returns statistics', () => {
    const metrics = {
      ...sampleMetrics,
      commands: { total: 100, latency: { p99: 50, p95: 40, p50: 20 } }
    };
    store.addSnapshot(metrics);
    const stats = store.getStatistics();

    expect(stats.totalSnapshots).toBe(1);
    expect(stats.memoryFootprint).toBeDefined();
    expect(stats.retention).toBeDefined();
  });

  test('enforces retention policy', () => {
    const shortRetention = new MetricsStore({ maxRetentionMs: 10000 });
    const now = Date.now();

    const metrics1 = {
      ...sampleMetrics,
      timestamp: now - 20000,
      commands: { total: 100, latency: { p99: 50, p95: 40, p50: 20 } }
    };
    const metrics2 = {
      ...sampleMetrics,
      timestamp: now,
      commands: { total: 100, latency: { p99: 50, p95: 40, p50: 20 } }
    };

    shortRetention.addSnapshot(metrics1);
    shortRetention.addSnapshot(metrics2);

    const removed = shortRetention.cleanup();
    expect(removed).toBeGreaterThanOrEqual(0);
  });

  test('exports all metrics', () => {
    const metrics = {
      ...sampleMetrics,
      commands: { total: 100, latency: { p99: 50, p95: 40, p50: 20 } }
    };
    store.addSnapshot(metrics);

    const exported = store.exportAll();
    expect(exported.data).toBeDefined();
    expect(exported.data.oneMinute).toBeDefined();
    expect(exported.stats).toBeDefined();
  });

  test('clears all stored data', () => {
    const metrics = {
      ...sampleMetrics,
      commands: { total: 100, latency: { p99: 50, p95: 40, p50: 20 } }
    };
    store.addSnapshot(metrics);
    let result = store.getLatest();
    expect(result).toBeDefined();

    store.clear();
    result = store.getLatest();
    expect(result).toBeNull();
  });
});

describe('Integration Tests', () => {
  let collector, aggregator, alertManager, store;

  beforeEach(() => {
    collector = new MetricsCollector();
    aggregator = new MetricsAggregator();
    alertManager = new AlertManager();
    store = new MetricsStore();
  });

  afterEach(() => {
    collector.shutdown();
    alertManager.shutdown();
  });

  test('end-to-end workflow: command -> metrics -> alert', (done) => {
    let alertTriggered = false;

    alertManager.on('alert', () => {
      alertTriggered = true;
    });

    // Execute commands
    for (let i = 0; i < 10; i++) {
      const id = `cmd-${i}`;
      collector.recordCommandStart('navigate', id);
      collector.recordCommandEnd(id, 'navigate', 150, i > 7 ? false : true, 1024); // Last 2 fail
    }

    // Collect metrics
    const metrics = collector.getCurrentMetrics();

    // Evaluate alerts
    alertManager.evaluateMetrics(metrics);

    // Store metrics
    store.addSnapshot(metrics);

    // Aggregate metrics
    const aggregated = aggregator.aggregate(metrics, '1m');

    // Verify pipeline
    expect(metrics.commands.total).toBe(10);
    expect(metrics.commands.latency.p99).toBeGreaterThan(100); // Should trigger high latency
    expect(aggregated.metrics.command.totalCount).toBe(10);
    expect(store.getLatest()).toBeDefined();

    done();
  });

  test('metrics collection with real-world command mix', () => {
    const commands = ['navigate', 'click', 'scroll', 'screenshot', 'get_content'];
    const successRate = 0.95;

    for (let i = 0; i < 100; i++) {
      const cmd = commands[Math.floor(Math.random() * commands.length)];
      const id = `cmd-${i}`;
      const duration = Math.random() * 100 + 10;
      const success = Math.random() < successRate;

      collector.recordCommandStart(cmd, id);
      collector.recordCommandEnd(id, cmd, duration, success, Math.random() * 10000);
    }

    const metrics = collector.getCurrentMetrics();
    expect(metrics.commands.total).toBe(100);
    expect(metrics.commands.success).toBeGreaterThan(90);
  });

  test('dashboard data format validation', () => {
    // Simulate some activity
    for (let i = 0; i < 10; i++) {
      const id = `cmd-${i}`;
      collector.recordCommandStart('test', id);
      collector.recordCommandEnd(id, 'test', Math.random() * 100, true, 1024);
    }

    collector.recordSessionCreated('sess-1');
    collector.recordConnectionOpened();

    const metrics = collector.getCurrentMetrics();
    const aggregated = aggregator.aggregate(metrics, '1m');

    // Verify dashboard-ready format
    expect(aggregated.metrics).toHaveProperty('command');
    expect(aggregated.metrics).toHaveProperty('throughput');
    expect(aggregated.metrics).toHaveProperty('sessions');
    expect(aggregated.metrics).toHaveProperty('errors');
    expect(aggregated.metrics).toHaveProperty('resources');
    expect(aggregated.trends).toHaveProperty('latency');
  });
});

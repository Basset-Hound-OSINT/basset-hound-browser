/**
 * Metrics and Logging Tests
 * Tests for metrics aggregation and log collection
 */

const MetricsAggregator = require('../../src/observability/metrics');
const LogAggregator = require('../../src/observability/logging');

describe('MetricsAggregator', () => {
  let metrics;

  beforeEach(() => {
    metrics = new MetricsAggregator({
      retentionPeriod: 60000,
      aggregationInterval: 1000
    });
  });

  afterEach(() => {
    metrics.close();
  });

  describe('Counter Metrics', () => {
    test('should register a counter', () => {
      const counter = metrics.registerCounter('requests_total', {
        help: 'Total requests'
      });

      expect(counter.inc).toBeDefined();
      expect(counter.get).toBeDefined();
    });

    test('should increment counter', () => {
      const counter = metrics.registerCounter('requests_total');

      counter.inc();
      counter.inc(5);

      const value = counter.get();
      expect(value.value).toBe(6);
    });

    test('should track counter with labels', () => {
      const counter = metrics.registerCounter('requests_total');

      counter.inc(1, { method: 'GET' });
      counter.inc(2, { method: 'POST' });

      expect(metrics.timeSeries.size).toBeGreaterThan(0);
    });
  });

  describe('Gauge Metrics', () => {
    test('should register a gauge', () => {
      const gauge = metrics.registerGauge('cpu_usage', {
        initialValue: 50
      });

      expect(gauge.set).toBeDefined();
      expect(gauge.inc).toBeDefined();
      expect(gauge.dec).toBeDefined();
    });

    test('should set gauge value', () => {
      const gauge = metrics.registerGauge('cpu_usage');

      gauge.set(75);
      const value = gauge.get();

      expect(value.value).toBe(75);
    });

    test('should increment gauge', () => {
      const gauge = metrics.registerGauge('memory_usage');

      gauge.set(100);
      gauge.inc(10);

      const value = gauge.get();
      expect(value.value).toBe(110);
    });

    test('should decrement gauge', () => {
      const gauge = metrics.registerGauge('active_connections');

      gauge.set(50);
      gauge.dec(5);

      const value = gauge.get();
      expect(value.value).toBe(45);
    });
  });

  describe('Histogram Metrics', () => {
    test('should register a histogram', () => {
      const histogram = metrics.registerHistogram('request_latency', {
        buckets: [0.1, 0.5, 1, 5, 10]
      });

      expect(histogram.observe).toBeDefined();
      expect(histogram.get).toBeDefined();
    });

    test('should observe histogram values', () => {
      const histogram = metrics.registerHistogram('request_latency');

      histogram.observe(0.3);
      histogram.observe(0.7);
      histogram.observe(1.2);

      const metric = metrics.metrics.get('request_latency');
      expect(metric.count).toBe(3);
      expect(metric.sum).toBeCloseTo(2.2, 1);
    });

    test('should update bucket counts', () => {
      const histogram = metrics.registerHistogram('request_latency', {
        buckets: [1, 5, 10]
      });

      histogram.observe(0.5);
      histogram.observe(3);
      histogram.observe(12);

      const metric = metrics.metrics.get('request_latency');
      expect(metric.values[1]).toBe(1);
      expect(metric.values[5]).toBe(2);
      expect(metric.values[10]).toBe(2);
    });
  });

  describe('Summary Metrics', () => {
    test('should register a summary', () => {
      const summary = metrics.registerSummary('response_time', {
        quantiles: [0.5, 0.9, 0.99]
      });

      expect(summary.observe).toBeDefined();
      expect(summary.get).toBeDefined();
    });

    test('should observe summary values', () => {
      const summary = metrics.registerSummary('response_time');

      summary.observe(10);
      summary.observe(20);
      summary.observe(30);

      const metric = metrics.metrics.get('response_time');
      expect(metric.count).toBe(3);
      expect(metric.sum).toBe(60);
    });
  });

  describe('Prometheus Export', () => {
    test('should export metrics in Prometheus format', () => {
      const counter = metrics.registerCounter('requests_total');
      counter.inc(5);

      const output = metrics.getPrometheusMetrics();

      expect(output).toContain('requests_total');
      expect(output).toContain('# TYPE');
    });

    test('should include histogram buckets', () => {
      const histogram = metrics.registerHistogram('latency');
      histogram.observe(0.5);

      const output = metrics.getPrometheusMetrics();

      expect(output).toContain('latency_bucket');
      expect(output).toContain('latency_sum');
      expect(output).toContain('latency_count');
    });
  });

  describe('Time-Series Data', () => {
    test('should record time-series values', () => {
      const counter = metrics.registerCounter('requests');

      counter.inc(1);
      counter.inc(2);

      expect(metrics.timeSeries.size).toBeGreaterThan(0);
    });

    test('should get time-series data', () => {
      const counter = metrics.registerCounter('requests');

      counter.inc(1);
      counter.inc(2);

      const series = metrics.getTimeSeries('requests', { limit: 10 });

      expect(series.length).toBeGreaterThan(0);
    });

    test('should enforce retention period', () => {
      const counter = metrics.registerCounter('requests');

      counter.inc(1);
      metrics.cleanupOldData();

      const series = metrics.getTimeSeries('requests');
      expect(series.length).toBeGreaterThan(0);
    });
  });

  describe('Aggregation', () => {
    test('should aggregate metrics over time window', () => {
      const counter = metrics.registerCounter('requests');

      counter.inc(1);
      counter.inc(2);
      counter.inc(3);

      const agg = metrics.aggregateMetrics('requests', 60000);

      expect(agg.count).toBe(3);
      // Time-series records absolute counter values: [1, 3, 6]
      expect(agg.sum).toBe(10);
      expect(agg.avg).toBe(10 / 3);
    });

    test('should calculate percentiles', () => {
      const histogram = metrics.registerHistogram('latency');

      for (let i = 1; i <= 100; i++) {
        histogram.observe(i);
      }

      const agg = metrics.aggregateMetrics('latency');

      expect(agg.percentile95).toBeDefined();
      expect(agg.percentile99).toBeDefined();
    });
  });

  describe('Service Metrics', () => {
    test('should get metrics for a service', () => {
      metrics.registerCounter('user-service:requests_total');
      metrics.registerGauge('user-service:active_connections');

      const serviceMetrics = metrics.getServiceMetrics('user-service');

      expect(Object.keys(serviceMetrics).length).toBe(2);
    });
  });

  describe('SLO Compliance', () => {
    test('should check SLO compliance', () => {
      const gauge = metrics.registerGauge('error_rate');
      gauge.set(0.5);

      const compliance = metrics.calculateSLOCompliance('error_rate', 1.0, '<=');

      expect(compliance.compliant).toBe(true);
      expect(compliance.threshold).toBe(1.0);
    });

    test('should detect SLO violation', () => {
      const gauge = metrics.registerGauge('latency_p99');
      gauge.set(150);

      const compliance = metrics.calculateSLOCompliance('latency_p99', 100, '<');

      expect(compliance.compliant).toBe(false);
    });
  });

  describe('Export Formats', () => {
    test('should export metrics as JSON', () => {
      const counter = metrics.registerCounter('requests');
      counter.inc(5);

      const json = metrics.exportMetrics('json');
      const parsed = JSON.parse(json);

      expect(parsed).toBeDefined();
      expect(Object.keys(parsed).length).toBeGreaterThan(0);
    });

    test('should support multiple export formats', () => {
      const counter = metrics.registerCounter('requests');

      const prometheus = metrics.exportMetrics('prometheus');
      const json = metrics.exportMetrics('json');

      expect(prometheus).toBeDefined();
      expect(json).toBeDefined();
    });
  });

  describe('Statistics', () => {
    test('should get metrics statistics', () => {
      metrics.registerCounter('counter1');
      metrics.registerGauge('gauge1');
      metrics.registerHistogram('histogram1');

      const stats = metrics.getStats();

      expect(stats.totalMetrics).toBe(3);
      expect(stats.metricsByType.counter).toBe(1);
      expect(stats.metricsByType.gauge).toBe(1);
      expect(stats.metricsByType.histogram).toBe(1);
    });
  });

  describe('Cleanup', () => {
    test('should reset metrics', () => {
      const counter = metrics.registerCounter('requests');
      counter.inc(5);

      metrics.resetMetrics();

      expect(metrics.metrics.size).toBe(0);
      expect(metrics.timeSeries.size).toBe(0);
    });
  });
});

describe('LogAggregator', () => {
  let logger;

  beforeEach(() => {
    logger = new LogAggregator({
      serviceName: 'test-service',
      environment: 'test',
      logLevel: 'debug',
      maxLogSize: 1000,
      enableConsole: false,
      enableELK: false
    });
  });

  afterEach(() => {
    logger.close();
  });

  describe('Logger Creation', () => {
    test('should create logger for service', () => {
      const serviceLogger = logger.createLogger('user-service');

      expect(serviceLogger.debug).toBeDefined();
      expect(serviceLogger.info).toBeDefined();
      expect(serviceLogger.warn).toBeDefined();
      expect(serviceLogger.error).toBeDefined();
      expect(serviceLogger.fatal).toBeDefined();
    });
  });

  describe('Logging', () => {
    test('should log debug message', () => {
      const serviceLogger = logger.createLogger('user-service');

      serviceLogger.debug('Debug message', { detail: 'test' });

      expect(logger.logs.length).toBe(1);
      expect(logger.logs[0].level).toBe('debug');
      expect(logger.logs[0].message).toBe('Debug message');
    });

    test('should log info message', () => {
      const serviceLogger = logger.createLogger('user-service');

      serviceLogger.info('Info message');

      expect(logger.logs[0].level).toBe('info');
    });

    test('should log warn message', () => {
      const serviceLogger = logger.createLogger('user-service');

      serviceLogger.warn('Warning message');

      expect(logger.logs[0].level).toBe('warn');
    });

    test('should log error message', () => {
      const serviceLogger = logger.createLogger('user-service');

      serviceLogger.error('Error message');

      expect(logger.logs[0].level).toBe('error');
    });

    test('should log fatal message', () => {
      const serviceLogger = logger.createLogger('user-service');

      serviceLogger.fatal('Fatal message');

      expect(logger.logs[0].level).toBe('fatal');
    });

    test('should include metadata with logs', () => {
      const serviceLogger = logger.createLogger('user-service');

      serviceLogger.info('Message', { userId: 123, action: 'login' });

      const log = logger.logs[0];
      expect(log.metadata.userId).toBe(123);
      expect(log.metadata.action).toBe('login');
    });

    test('should include trace ID in logs', () => {
      const serviceLogger = logger.createLogger('user-service');

      serviceLogger.info('Message', { traceId: 'trace-123' });

      expect(logger.logs[0].traceId).toBe('trace-123');
    });
  });

  describe('Log Filtering', () => {
    test('should respect log level', () => {
      logger.setLogLevel('warn');

      const serviceLogger = logger.createLogger('user-service');
      serviceLogger.debug('Debug');
      serviceLogger.info('Info');
      serviceLogger.warn('Warning');

      // Only warn and above should be logged
      expect(logger.logs.length).toBe(1);
      expect(logger.logs[0].level).toBe('warn');
    });
  });

  describe('Log Search', () => {
    test('should search logs by service', () => {
      const userLogger = logger.createLogger('user-service');
      const postLogger = logger.createLogger('post-service');

      userLogger.info('User log');
      postLogger.info('Post log');

      const results = logger.searchLogs({ service: 'user-service' });

      expect(results.length).toBe(1);
      expect(results[0].service).toBe('user-service');
    });

    test('should search logs by level', () => {
      const serviceLogger = logger.createLogger('user-service');

      serviceLogger.info('Info');
      serviceLogger.warn('Warning');
      serviceLogger.error('Error');

      const results = logger.searchLogs({ level: 'error' });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].level).toBe('error');
    });

    test('should search logs by message', () => {
      const serviceLogger = logger.createLogger('user-service');

      serviceLogger.info('User created');
      serviceLogger.info('User deleted');

      const results = logger.searchLogs({ message: 'created' });

      expect(results.length).toBe(1);
      expect(results[0].message).toContain('created');
    });

    test('should search logs by trace ID', () => {
      const serviceLogger = logger.createLogger('user-service');

      serviceLogger.info('Log 1', { traceId: 'trace-1' });
      serviceLogger.info('Log 2', { traceId: 'trace-2' });

      const results = logger.searchLogs({ traceId: 'trace-1' });

      expect(results.length).toBe(1);
      expect(results[0].traceId).toBe('trace-1');
    });

    test('should search logs by request ID', () => {
      const serviceLogger = logger.createLogger('user-service');

      serviceLogger.info('Log 1', { requestId: 'req-1' });
      serviceLogger.info('Log 2', { requestId: 'req-2' });

      const results = logger.searchLogs({ requestId: 'req-1' });

      expect(results.length).toBe(1);
      expect(results[0].requestId).toBe('req-1');
    });
  });

  describe('Service Logs', () => {
    test('should get service logs', () => {
      const serviceLogger = logger.createLogger('user-service');

      serviceLogger.info('Log 1');
      serviceLogger.info('Log 2');

      const logs = logger.getServiceLogs('user-service');

      expect(logs.length).toBe(2);
      expect(logs[0].service).toBe('user-service');
    });

    test('should get service logs with limit', () => {
      const serviceLogger = logger.createLogger('user-service');

      for (let i = 0; i < 20; i++) {
        serviceLogger.info(`Log ${i}`);
      }

      const logs = logger.getServiceLogs('user-service', { limit: 10 });

      expect(logs.length).toEqual(10);
    });
  });

  describe('Statistics', () => {
    test('should get logging statistics', () => {
      const userLogger = logger.createLogger('user-service');
      const postLogger = logger.createLogger('post-service');

      userLogger.info('User log');
      postLogger.error('Post error');

      const stats = logger.getStats();

      expect(stats.totalLogs).toBe(2);
      expect(stats.logsByService['user-service']).toBe(1);
      expect(stats.logsByService['post-service']).toBe(1);
      expect(stats.logsByLevel.info).toBe(1);
      expect(stats.logsByLevel.error).toBe(1);
    });

    test('should get error logs', () => {
      const serviceLogger = logger.createLogger('user-service');

      serviceLogger.info('Info');
      serviceLogger.error('Error 1');
      serviceLogger.fatal('Fatal');
      serviceLogger.error('Error 2');

      const errors = logger.getErrorLogs();

      expect(errors.length).toBe(3);
    });

    test('should get recent logs', () => {
      const serviceLogger = logger.createLogger('user-service');

      for (let i = 0; i < 50; i++) {
        serviceLogger.info(`Log ${i}`);
      }

      const recent = logger.getRecentLogs(10);

      expect(recent.length).toBe(10);
    });
  });

  describe('Export Formats', () => {
    test('should export logs as JSON', () => {
      const serviceLogger = logger.createLogger('user-service');
      serviceLogger.info('Test log');

      const json = logger.exportLogsJSON({ service: 'user-service' });
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    });

    test('should export logs as CSV', () => {
      const serviceLogger = logger.createLogger('user-service');
      serviceLogger.info('Test log');

      const csv = logger.exportLogsCSV({ service: 'user-service' });

      expect(csv).toContain('timestamp');
      expect(csv).toContain('level');
      expect(csv).toContain('service');
    });
  });

  describe('Log Level Management', () => {
    test('should set log level', () => {
      logger.setLogLevel('error');
      expect(logger.getLogLevel()).toBe('error');
    });

    test('should throw error for invalid log level', () => {
      expect(() => {
        logger.setLogLevel('invalid');
      }).toThrow();
    });
  });

  describe('Events', () => {
    test('should emit log event', (done) => {
      logger.on('log', (log) => {
        expect(log.message).toBe('Test log');
        done();
      });

      const serviceLogger = logger.createLogger('user-service');
      serviceLogger.info('Test log');
    });

    test('should emit level-specific events', (done) => {
      logger.on('log:error', (log) => {
        expect(log.level).toBe('error');
        done();
      });

      const serviceLogger = logger.createLogger('user-service');
      serviceLogger.error('Error log');
    });
  });

  describe('Cleanup', () => {
    test('should clear all logs', () => {
      const serviceLogger = logger.createLogger('user-service');
      serviceLogger.info('Log');

      expect(logger.logs.length).toBe(1);

      logger.clearLogs();

      expect(logger.logs.length).toBe(0);
      expect(logger.logsByService.size).toBe(0);
    });
  });
});

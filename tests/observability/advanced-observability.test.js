/**
 * Advanced Observability Tests
 * Tests for Latency, Resources, Errors, Recovery, Visualization, and Dashboard
 */

const LatencyAnalyzer = require('../../src/observability/latency-analyzer');
const ResourceTracker = require('../../src/observability/resource-tracker');
const ErrorTracer = require('../../src/observability/error-tracer');
const RecoveryTracker = require('../../src/observability/recovery-tracker');
const TraceVisualizer = require('../../src/observability/trace-visualizer');
const ObservabilityDashboard = require('../../src/observability/observability-dashboard');

describe('LatencyAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new LatencyAnalyzer();
  });

  afterEach(() => {
    analyzer.close();
  });

  test('should record span latency', () => {
    analyzer.recordSpanLatency('span-1', {
      spanName: 'get_user',
      duration: 150,
      component: 'database'
    });

    const latency = analyzer.spanLatencies.get('span-1');
    expect(latency.spanName).toBe('get_user');
    expect(latency.duration).toBe(150);
  });

  test('should record component latency', () => {
    analyzer.recordComponentLatency('api-server', {
      duration: 100
    });

    const component = analyzer.componentLatencies.get('api-server');
    expect(component.componentName).toBe('api-server');
    expect(component.count).toBe(1);
    expect(component.avgDuration).toBe(100);
  });

  test('should analyze latency hierarchy', () => {
    analyzer.recordSpanLatency('root', {
      spanName: 'root_op',
      duration: 300
    });
    analyzer.recordSpanLatency('child', {
      spanName: 'child_op',
      duration: 200,
      parentSpanId: 'root'
    });

    const hierarchy = analyzer.analyzeLatencyHierarchy('root');
    expect(hierarchy.rootLatency).toBe(300);
    expect(hierarchy.levels[0]).toBeDefined();
  });

  test('should identify bottlenecks', () => {
    analyzer.recordSpanLatency('span-1', { spanName: 'op1', duration: 50 });
    analyzer.recordSpanLatency('span-2', { spanName: 'op2', duration: 500 });
    analyzer.recordSpanLatency('span-3', { spanName: 'op3', duration: 600 });

    const bottlenecks = analyzer.identifyBottlenecks();
    expect(bottlenecks.length).toBeGreaterThan(0);
    expect(bottlenecks[0].latency).toBeGreaterThan(50);
  });

  test('should get performance trend', () => {
    analyzer.recordSpanLatency('span-1', { spanName: 'op', component: 'api', duration: 100 });
    analyzer.recordSpanLatency('span-2', { spanName: 'op', component: 'api', duration: 120 });
    analyzer.recordSpanLatency('span-3', { spanName: 'op', component: 'api', duration: 110 });

    const trend = analyzer.getPerformanceTrend('api');
    expect(trend.sampleCount).toBe(3);
    expect(trend.avgLatency).toBeGreaterThan(0);
  });

  test('should get SLA compliance', () => {
    analyzer.recordSpanLatency('span-1', { spanName: 'op', component: 'db', duration: 50 });
    analyzer.recordSpanLatency('span-2', { spanName: 'op', component: 'db', duration: 150 });

    const compliance = analyzer.getSLACompliance('db');
    expect(compliance.slaLevels.critical).toBeDefined();
  });

  test('should emit SLA violation events', (done) => {
    let called = false;
    analyzer.on('sla:violated', (data) => {
      if (!called) {
        called = true;
        expect(data.spanId).toBeDefined();
        expect(data.actual).toBeGreaterThan(data.threshold);
        done();
      }
    });

    analyzer.recordSpanLatency('span-1', {
      spanName: 'op',
      component: 'api',
      duration: 6000
    });
  });
});

describe('ResourceTracker', () => {
  let tracker;

  beforeEach(() => {
    tracker = new ResourceTracker();
  });

  afterEach(() => {
    tracker.close();
  });

  test('should track memory usage', () => {
    tracker.trackMemory('span-1', {
      heapUsedBefore: 100,
      heapUsedAfter: 120,
      heapTotalBefore: 500,
      heapTotalAfter: 500,
      allocations: 10,
      deallocations: 5
    });

    const memory = tracker.spanResources.get('span-1').memory;
    expect(memory.memoryDelta).toBe(20);
    expect(memory.netAllocations).toBe(5);
  });

  test('should track CPU usage', () => {
    tracker.trackCPU('span-1', {
      userCpuTime: 100,
      systemCpuTime: 50,
      wallClockTime: 200,
      threadCount: 4
    });

    const cpu = tracker.spanResources.get('span-1').cpu;
    expect(cpu.totalCpuTime).toBe(150);
    expect(cpu.cpuEfficiency).toBeGreaterThan(0);
  });

  test('should track disk I/O', () => {
    tracker.trackDiskIO('span-1', {
      bytesRead: 1024,
      bytesWritten: 2048,
      readOperations: 2,
      writeOperations: 4,
      duration: 100,
      cacheHitRate: 0.8
    });

    const io = tracker.spanResources.get('span-1').diskIO;
    expect(io.totalBytesIO).toBe(3072);
    expect(io.totalOperations).toBe(6);
  });

  test('should get resource profile', () => {
    tracker.trackMemory('span-1', { heapUsedBefore: 100, heapUsedAfter: 110 });
    tracker.trackCPU('span-1', { userCpuTime: 50, systemCpuTime: 25, wallClockTime: 100 });

    const profile = tracker.getResourceProfile('span-1');
    expect(profile.spanId).toBe('span-1');
    expect(profile.memory).toBeDefined();
    expect(profile.cpu).toBeDefined();
  });

  test('should detect memory leaks', () => {
    tracker.trackMemory('span-1', { heapUsedBefore: 100, heapUsedAfter: 150, netAllocations: 200 });
    tracker.trackMemory('span-2', { heapUsedBefore: 150, heapUsedAfter: 200, netAllocations: 200 });

    const leaks = tracker.detectMemoryLeaks();
    expect(Array.isArray(leaks)).toBe(true);
  });

  test('should emit memory alerts', (done) => {
    tracker.on('alert:memory_warning', (data) => {
      expect(data.spanId).toBeDefined();
      done();
    });

    tracker.trackMemory('span-1', {
      heapUsedAfter: 150 // Above warning threshold
    });
  });
});

describe('ErrorTracer', () => {
  let tracer;

  beforeEach(() => {
    tracer = new ErrorTracer();
  });

  afterEach(() => {
    tracer.close();
  });

  test('should trace error with context', () => {
    const error = tracer.traceError('span-1', {
      errorType: 'DatabaseError',
      errorMessage: 'Connection timeout',
      errorCode: 'DB_TIMEOUT',
      severity: 'error',
      component: 'database'
    });

    expect(error.errorId).toBeDefined();
    expect(error.errorType).toBe('DatabaseError');
    expect(error.severity).toBe('error');
  });

  test('should record recovery attempt', () => {
    const error = tracer.traceError('span-1', { errorType: 'NetworkError' });

    const result = tracer.recordRecoveryAttempt(error.errorId, {
      strategy: 'retry',
      successful: true,
      timeTaken: 100
    });

    expect(result.error.recovered).toBe(true);
    expect(result.error.status).toBe('resolved');
  });

  test('should get error details', () => {
    const error = tracer.traceError('span-1', {
      errorType: 'ValidationError',
      errorMessage: 'Invalid input'
    });

    const details = tracer.getErrorDetails(error.errorId);
    expect(details.errorType).toBe('ValidationError');
    expect(details.errorMessage).toBe('Invalid input');
  });

  test('should find related errors', () => {
    tracer.traceError('span-1', { errorType: 'TimeoutError', component: 'api' });
    tracer.traceError('span-2', { errorType: 'TimeoutError', component: 'api' });

    const related = tracer.findRelatedErrors({
      errorType: 'TimeoutError',
      component: 'api'
    });

    expect(related.length).toBeGreaterThan(0);
  });

  test('should get error metrics', () => {
    tracer.traceError('span-1', { errorType: 'Error1', severity: 'error' });
    tracer.traceError('span-2', { errorType: 'Error2', severity: 'critical' });

    const metrics = tracer.getErrorMetrics();
    expect(metrics.totalErrors).toBe(2);
    const typeCount = Object.keys(metrics.errorsByType).length;
    expect(typeCount).toBeGreaterThan(0);
  });
});

describe('RecoveryTracker', () => {
  let tracker;

  beforeEach(() => {
    tracker = new RecoveryTracker();
  });

  afterEach(() => {
    tracker.close();
  });

  test('should start recovery attempt', () => {
    const attempt = tracker.startRecoveryAttempt('error-1', {
      strategy: 'retry',
      attemptNumber: 1
    });

    expect(attempt.recoveryId).toBeDefined();
    expect(attempt.status).toBe('in_progress');
    expect(attempt.strategy).toBe('retry');
  });

  test('should complete recovery attempt', () => {
    const attempt = tracker.startRecoveryAttempt('error-1', { strategy: 'retry' });

    const result = tracker.completeRecoveryAttempt(attempt.recoveryId, {
      successful: true
    });

    expect(result.status).toBe('succeeded');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  test('should get strategy metrics', () => {
    const attempt1 = tracker.startRecoveryAttempt('error-1', { strategy: 'retry' });
    tracker.completeRecoveryAttempt(attempt1.recoveryId, { successful: true });

    const metrics = tracker.getStrategyMetrics('retry');
    expect(metrics.strategy).toBe('retry');
    expect(metrics.successfulAttempts).toBe(1);
  });

  test('should track time to recovery', () => {
    const attempt = tracker.startRecoveryAttempt('error-1', { strategy: 'fallback' });
    tracker.completeRecoveryAttempt(attempt.recoveryId, { successful: true });

    const stats = tracker.getTimeToRecoveryStats('fallback');
    expect(stats.sampleCount).toBe(1);
    expect(parseFloat(stats.avgDuration)).toBeGreaterThanOrEqual(0);
  });

  test('should recommend recovery strategy', () => {
    const attempt = tracker.startRecoveryAttempt('error-1', { strategy: 'retry' });
    tracker.completeRecoveryAttempt(attempt.recoveryId, { successful: true });

    const recommendation = tracker.recommendRecoveryStrategy({
      errorType: 'NetworkError'
    });

    expect(recommendation.recommendedStrategies).toBeDefined();
    expect(recommendation.topRecommendation).toBeDefined();
  });
});

describe('TraceVisualizer', () => {
  let visualizer;

  beforeEach(() => {
    visualizer = new TraceVisualizer();
  });

  afterEach(() => {
    visualizer.close();
  });

  test('should generate trace tree', () => {
    const traceData = {
      spans: [
        { spanId: 's1', spanName: 'root', duration: 300, startTime: 0, service: 'api' },
        { spanId: 's2', spanName: 'db', duration: 200, startTime: 50, parentSpanId: 's1', service: 'db' }
      ]
    };

    visualizer.generateTraceTree('trace-1', traceData);
    const tree = visualizer.visualizations.get('trace-1');

    expect(tree.spanCount).toBe(2);
    expect(tree.totalDuration).toBe(300);
  });

  test('should generate flamegraph', () => {
    const traceData = {
      spans: [
        { spanId: 's1', spanName: 'root', duration: 300, startTime: 0 },
        { spanId: 's2', spanName: 'op1', duration: 200, startTime: 50, parentSpanId: 's1' }
      ]
    };

    visualizer.generateTraceTree('trace-1', traceData);
    visualizer.generateFlameGraph('trace-1', traceData);

    const graph = visualizer.flamegraphs.get('trace-1');
    expect(graph.stacks.length).toBeGreaterThan(0);
  });

  test('should generate waterfall', () => {
    const traceData = {
      spans: [
        { spanId: 's1', spanName: 'op1', duration: 100, startTime: 0 },
        { spanId: 's2', spanName: 'op2', duration: 150, startTime: 100 }
      ]
    };

    visualizer.generateTraceTree('trace-1', traceData);
    visualizer.generateWaterfall('trace-1', traceData);

    const waterfall = visualizer.waterfalls.get('trace-1');
    expect(waterfall.spanBars.length).toBe(2);
  });

  test('should analyze critical path', () => {
    const traceData = {
      spans: [
        { spanId: 's1', spanName: 'root', duration: 300, startTime: 0 },
        { spanId: 's2', spanName: 'serial1', duration: 200, startTime: 0, parentSpanId: 's1' }
      ]
    };

    visualizer.generateTraceTree('trace-1', traceData);
    visualizer.analyzeCriticalPath('trace-1', traceData);

    const path = visualizer.criticalPaths.get('trace-1');
    expect(path.spanCount).toBeGreaterThan(0);
  });

  test('should export visualization', () => {
    const traceData = {
      spans: [
        { spanId: 's1', spanName: 'op1', duration: 100, startTime: 0 }
      ]
    };

    visualizer.generateTraceTree('trace-1', traceData);
    const exported = visualizer.exportVisualization('trace-1');

    expect(exported.traceId).toBe('trace-1');
    expect(exported.metadata).toBeDefined();
    expect(exported.tree).toBeDefined();
  });
});

describe('ObservabilityDashboard', () => {
  let dashboard;

  beforeEach(() => {
    dashboard = new ObservabilityDashboard();
  });

  afterEach(() => {
    dashboard.close();
  });

  test('should register service', () => {
    dashboard.registerService('auth-service', {
      dependencies: ['db-service']
    });

    const service = dashboard.dashboard.services.get('auth-service');
    expect(service.name).toBe('auth-service');
    expect(service.dependencies.has('db-service')).toBe(true);
  });

  test('should update service metrics', () => {
    dashboard.registerService('api-service', {});

    dashboard.updateServiceMetrics('api-service', {
      requests: 100,
      errors: 5,
      latency: 150,
      throughput: 1000
    });

    const service = dashboard.dashboard.services.get('api-service');
    expect(service.metrics.requests).toBe(100);
    expect(service.errorRate).toBeGreaterThan(0);
  });

  test('should record health check', () => {
    dashboard.registerService('db-service', {});

    const check = dashboard.recordHealthCheck('db-service', {
      checkType: 'liveness',
      passed: true,
      latency: 10
    });

    expect(check.passed).toBe(true);
    const service = dashboard.dashboard.services.get('db-service');
    expect(service.uptime).toBe(100);
  });

  test('should detect anomalies', () => {
    dashboard.registerService('web-service', {});
    dashboard.updateServiceMetrics('web-service', {
      requests: 1000,
      errors: 100, // 10% error rate
      latency: 5000
    });

    const anomalies = dashboard.detectAnomalies();
    expect(anomalies.length).toBeGreaterThan(0);
  });

  test('should create incident from anomaly', () => {
    dashboard.registerService('api-service', {});

    const incident = dashboard.createIncident({
      anomalyType: 'high_latency',
      serviceName: 'api-service',
      severity: 'critical'
    });

    expect(incident.incidentId).toBeDefined();
    expect(incident.status).toBe('open');
  });

  test('should get dashboard summary', () => {
    dashboard.registerService('service-1', {});
    dashboard.registerService('service-2', {});
    dashboard.updateServiceMetrics('service-1', { requests: 100, errors: 0 });

    const summary = dashboard.getDashboardSummary();
    expect(summary.serviceStats.total).toBe(2);
    expect(summary.metrics.avgErrorRate).toBeGreaterThanOrEqual(0);
  });

  test('should get service dependency graph', () => {
    dashboard.registerService('api-service', { dependencies: ['db-service'] });
    dashboard.registerService('db-service', {});

    const graph = dashboard.getServiceDependencyGraph();
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  test('should generate observability report', () => {
    dashboard.registerService('api-service', {});
    dashboard.updateServiceMetrics('api-service', { requests: 100, errors: 5 });

    const report = dashboard.generateReport(60000);
    expect(report.summary).toBeDefined();
    expect(report.services.length).toBeGreaterThan(0);
  });
});

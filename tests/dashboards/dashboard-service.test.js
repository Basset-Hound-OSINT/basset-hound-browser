/**
 * Dashboard Service Tests
 */

const DashboardService = require('../../src/dashboards/dashboard-service');
const MetricsAggregator = require('../../src/observability/metrics');

describe('DashboardService', () => {
  let metricsAggregator;
  let dashboardService;

  beforeEach(() => {
    metricsAggregator = new MetricsAggregator();
    dashboardService = new DashboardService(metricsAggregator, {
      persistDashboards: false
    });
  });

  afterEach(() => {
    dashboardService.close();
    metricsAggregator.close();
  });

  describe('Dashboard Management', () => {
    test('should create dashboard', () => {
      const dashboard = dashboardService.createDashboard('test', {
        title: 'Test Dashboard',
        description: 'A test dashboard',
        widgets: []
      });

      expect(dashboard.id).toBe('test');
      expect(dashboard.title).toBe('Test Dashboard');
      expect(dashboard.createdAt).toBeGreaterThan(0);
    });

    test('should retrieve dashboard', () => {
      dashboardService.createDashboard('test', { title: 'Test' });
      const dashboard = dashboardService.getDashboard('test');

      expect(dashboard).toBeDefined();
      expect(dashboard.title).toBe('Test');
    });

    test('should get all dashboards', () => {
      dashboardService.createDashboard('test1', { title: 'Test 1' });
      dashboardService.createDashboard('test2', { title: 'Test 2' });

      const dashboards = dashboardService.getAllDashboards();
      expect(dashboards.length).toBeGreaterThanOrEqual(2);
    });

    test('should update dashboard', () => {
      dashboardService.createDashboard('test', { title: 'Test' });
      const updated = dashboardService.updateDashboard('test', {
        title: 'Updated Test'
      });

      expect(updated.title).toBe('Updated Test');
      expect(updated.updatedAt).toBeGreaterThan(updated.createdAt);
    });

    test('should delete custom dashboard', () => {
      dashboardService.createDashboard('custom', { title: 'Custom', custom: true });
      dashboardService.deleteDashboard('custom');

      const dashboard = dashboardService.getDashboard('custom');
      expect(dashboard).toBeUndefined();
    });

    test('should not delete predefined dashboard', () => {
      expect(() => {
        dashboardService.deleteDashboard('system-performance');
      }).toThrow();
    });
  });

  describe('Metric Computation', () => {
    test('should compute trend analysis', () => {
      // Register a metric
      metricsAggregator.registerCounter('test_metric');

      // Add some data
      for (let i = 0; i < 10; i++) {
        metricsAggregator.incrementCounter('test_metric', i);
      }

      const trend = dashboardService.computeTrend('test_metric', 60000);

      expect(trend).toBeDefined();
      expect(trend.direction).toBeTruthy();
      expect(trend.percentChange).toBeDefined();
    });

    test('should compute chart data for pie chart', () => {
      metricsAggregator.registerGauge('test_gauge', { initialValue: 50 });

      for (let i = 0; i < 5; i++) {
        metricsAggregator.setGauge('test_gauge', Math.random() * 100);
      }

      const chartData = dashboardService.computeChartData(
        'test_gauge',
        'pie',
        60000
      );

      expect(chartData).toBeDefined();
      expect(chartData.type).toBe('pie');
    });

    test('should compute chart data for bar chart', () => {
      metricsAggregator.registerCounter('bar_metric');

      for (let i = 0; i < 10; i++) {
        metricsAggregator.incrementCounter('bar_metric', 1);
      }

      const chartData = dashboardService.computeChartData(
        'bar_metric',
        'bar',
        60000
      );

      expect(chartData).toBeDefined();
      expect(chartData.type).toBe('bar');
      expect(Array.isArray(chartData.labels)).toBe(true);
    });

    test('should compute heatmap data', () => {
      metricsAggregator.registerHistogram('latency_histogram');

      for (let i = 0; i < 20; i++) {
        metricsAggregator.observeHistogram('latency_histogram', Math.random() * 100);
      }

      const heatmapData = dashboardService.computeChartData(
        'latency_histogram',
        'heatmap',
        60000
      );

      expect(heatmapData).toBeDefined();
      expect(heatmapData.type).toBe('heatmap');
      expect(heatmapData.percentiles).toBeDefined();
    });
  });

  describe('Custom Metrics', () => {
    test('should define custom metric', () => {
      const metric = dashboardService.defineCustomMetric('custom_metric', {
        type: 'composite',
        sources: [
          { metric: 'metric1', alias: 'm1' },
          { metric: 'metric2', alias: 'm2' }
        ],
        formula: '$m1 + $m2'
      });

      expect(metric.name).toBe('custom_metric');
      expect(metric.custom).toBe(true);
    });

    test('should compute composite metric', () => {
      metricsAggregator.registerGauge('m1', { initialValue: 10 });
      metricsAggregator.registerGauge('m2', { initialValue: 20 });

      dashboardService.defineCustomMetric('sum_metric', {
        type: 'composite',
        sources: [
          { metric: 'm1', alias: 'm1' },
          { metric: 'm2', alias: 'm2' }
        ],
        formula: '$m1 + $m2'
      });

      const result = dashboardService.computeCustomMetric('sum_metric');
      expect(result).toBe(30);
    });

    test('should compute aggregate metric', () => {
      metricsAggregator.registerGauge('agg_test', { initialValue: 0 });

      for (let i = 0; i < 10; i++) {
        metricsAggregator.setGauge('agg_test', i * 10);
      }

      dashboardService.defineCustomMetric('avg_metric', {
        type: 'aggregate',
        source: 'agg_test',
        aggregationType: 'avg'
      });

      const result = dashboardService.computeCustomMetric('avg_metric');
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('Dashboard Computations', () => {
    test('should compute dashboard metrics', async () => {
      metricsAggregator.registerGauge('cpu_usage', { initialValue: 45 });
      metricsAggregator.registerGauge('memory_usage', { initialValue: 60 });

      const dashboard = dashboardService.createDashboard('perf', {
        title: 'Performance',
        widgets: [
          { type: 'metric', metric: 'cpu_usage' },
          { type: 'metric', metric: 'memory_usage' }
        ]
      });

      const metrics = await dashboardService.computeDashboardMetrics(dashboard.id);

      expect(metrics).toBeDefined();
      expect(metrics.cpu_usage).toBe(45);
      expect(metrics.memory_usage).toBe(60);
    });

    test('should get computed dashboard metrics', async () => {
      metricsAggregator.registerGauge('test_metric', { initialValue: 75 });

      dashboardService.createDashboard('test', {
        title: 'Test',
        widgets: [{ type: 'metric', metric: 'test_metric' }]
      });

      await dashboardService.computeDashboardMetrics('test');
      const computed = dashboardService.getDashboardMetrics('test');

      expect(computed).toBeDefined();
      expect(computed.metrics.test_metric).toBe(75);
    });
  });

  describe('Predefined Dashboards', () => {
    test('should have system performance dashboard', () => {
      const dashboard = dashboardService.getDashboard('system-performance');
      expect(dashboard).toBeDefined();
      expect(dashboard.title).toBe('System Performance');
    });

    test('should have websocket performance dashboard', () => {
      const dashboard = dashboardService.getDashboard('websocket-performance');
      expect(dashboard).toBeDefined();
      expect(dashboard.widgets.length).toBeGreaterThan(0);
    });

    test('should have browser operations dashboard', () => {
      const dashboard = dashboardService.getDashboard('browser-operations');
      expect(dashboard).toBeDefined();
    });

    test('should have error alerts dashboard', () => {
      const dashboard = dashboardService.getDashboard('errors-alerts');
      expect(dashboard).toBeDefined();
    });
  });

  describe('Statistics', () => {
    test('should get service stats', () => {
      dashboardService.createDashboard('custom1', { title: 'Custom 1', custom: true });

      const stats = dashboardService.getStats();

      expect(stats.totalDashboards).toBeGreaterThan(0);
      expect(stats.predefinedDashboards).toBeGreaterThan(0);
      expect(stats.customDashboards).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Percentile Calculations', () => {
    test('should calculate percentiles', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);

      const p50 = dashboardService.percentile(values, 0.5);
      const p95 = dashboardService.percentile(values, 0.95);
      const p99 = dashboardService.percentile(values, 0.99);

      expect(p50).toBeGreaterThan(40);
      expect(p95).toBeGreaterThan(p50);
      expect(p99).toBeGreaterThan(p95);
    });
  });
});

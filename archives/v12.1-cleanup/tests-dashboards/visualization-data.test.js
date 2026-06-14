/**
 * Visualization Data Processor Tests
 */

const VisualizationDataProcessor = require('../../src/dashboards/visualization-data');

describe('VisualizationDataProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new VisualizationDataProcessor();
  });

  describe('Time Series Formatting', () => {
    test('should format time series for line chart', () => {
      const data = [
        { timestamp: Date.now() - 60000, value: 10 },
        { timestamp: Date.now() - 30000, value: 20 },
        { timestamp: Date.now(), value: 30 }
      ];

      const chartData = processor.formatTimeSeriesForChart(data);

      expect(chartData.labels).toBeDefined();
      expect(chartData.datasets).toBeDefined();
      expect(chartData.datasets.length).toBe(1);
      expect(chartData.datasets[0].data).toBeDefined();
    });

    test('should handle empty data', () => {
      const chartData = processor.formatTimeSeriesForChart([]);

      expect(chartData.labels).toEqual([]);
      expect(chartData.datasets).toEqual([]);
    });

    test('should aggregate with moving average', () => {
      const data = Array.from({ length: 50 }, (_, i) => ({
        timestamp: Date.now() - (50 - i) * 1000,
        value: Math.sin(i / 5) * 50 + 50
      }));

      const chartData = processor.formatTimeSeriesForChart(data, {
        aggregationType: 'avg'
      });

      expect(chartData.datasets[0].data.length).toBeGreaterThan(0);
      expect(chartData.datasets[0].data[0]).toBeGreaterThan(0);
    });
  });

  describe('Multi-Series Charts', () => {
    test('should format multi-series chart', () => {
      const data = [
        { timestamp: Date.now() - 60000, value: 10, series: 'api1' },
        { timestamp: Date.now() - 30000, value: 20, series: 'api1' },
        { timestamp: Date.now() - 60000, value: 15, series: 'api2' },
        { timestamp: Date.now() - 30000, value: 25, series: 'api2' }
      ];

      const chartData = processor.formatMultiSeriesChart(data);

      expect(chartData.labels).toBeDefined();
      expect(chartData.datasets).toBeDefined();
      expect(chartData.datasets.length).toBe(2);
    });
  });

  describe('Bar and Pie Charts', () => {
    test('should format bar chart', () => {
      const data = [
        { category: 'A', value: 10 },
        { category: 'B', value: 20 },
        { category: 'C', value: 30 }
      ];

      const chartData = processor.formatBarChart(data);

      expect(chartData.labels).toEqual(['A', 'B', 'C']);
      expect(chartData.datasets[0].data).toEqual([10, 20, 30]);
    });

    test('should format pie chart', () => {
      const data = [
        { label: 'Errors', value: 45 },
        { label: 'Warnings', value: 30 },
        { label: 'Info', value: 25 }
      ];

      const chartData = processor.formatPieChart(data, {
        labelField: 'label',
        valueField: 'value'
      });

      expect(chartData.labels).toEqual(['Errors', 'Warnings', 'Info']);
      expect(chartData.datasets[0].data).toEqual([45, 30, 25]);
    });
  });

  describe('Heatmap Generation', () => {
    test('should generate heatmap data', () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        timestamp: Date.now() - (100 - i) * 1000,
        category: `cat${i % 5}`,
        value: Math.random() * 100
      }));

      const heatmap = processor.generateHeatmap(data);

      expect(heatmap.xLabels).toBeDefined();
      expect(heatmap.yLabels).toBeDefined();
      expect(heatmap.data).toBeDefined();
      expect(heatmap.min).toBeLessThanOrEqual(heatmap.max);
    });

    test('should handle empty heatmap data', () => {
      const heatmap = processor.generateHeatmap([]);

      expect(heatmap.xLabels).toEqual([]);
      expect(heatmap.yLabels).toEqual([]);
      expect(heatmap.data).toEqual([]);
    });
  });

  describe('Percentile Calculations', () => {
    test('should calculate percentile distribution', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);

      const distribution = processor.calculatePercentileDistribution(values);

      expect(distribution.p0).toBe(1);
      expect(distribution.p50).toBeGreaterThan(40);
      expect(distribution.p100).toBe(100);
    });

    test('should handle empty values', () => {
      const distribution = processor.calculatePercentileDistribution([]);

      expect(Object.keys(distribution).length).toBe(0);
    });

    test('should generate latency distribution', () => {
      const latencies = Array.from({ length: 200 }, () =>
        Math.random() * 100 + 10
      );

      const dist = processor.generateLatencyDistribution(latencies);

      expect(dist.labels).toBeDefined();
      expect(dist.data).toBeDefined();
      expect(dist.bucketSize).toBeGreaterThan(0);
    });
  });

  describe('Data Normalization', () => {
    test('should normalize data to 0-100 range', () => {
      const values = [10, 20, 30, 40, 50];

      const normalized = processor.normalizeData(values);

      expect(Math.min(...normalized)).toBe(0);
      expect(Math.max(...normalized)).toBe(100);
    });

    test('should handle single value normalization', () => {
      const values = [50];

      const normalized = processor.normalizeData(values);

      expect(normalized[0]).toBe(0); // min == max, so result is 0
    });
  });

  describe('Data Downsampling', () => {
    test('should downsample data', () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({
        value: Math.random() * 100
      }));

      const downsampled = processor.downsampleData(data, 100);

      expect(downsampled.length).toBeLessThanOrEqual(100);
      expect(downsampled.length).toBeGreaterThan(0);
    });

    test('should not downsample if not needed', () => {
      const data = Array.from({ length: 50 }, (_, i) => ({
        value: Math.random() * 100
      }));

      const downsampled = processor.downsampleData(data, 100);

      expect(downsampled.length).toBe(50);
    });
  });

  describe('Moving Average', () => {
    test('should calculate moving average', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const moving = processor.calculateMovingAverage(values, 3);

      expect(moving.length).toBe(values.length);
      expect(moving[0]).toBeGreaterThan(0);
    });

    test('should handle window larger than data', () => {
      const values = [1, 2, 3];

      const moving = processor.calculateMovingAverage(values, 10);

      expect(moving).toEqual(values);
    });
  });

  describe('Anomaly Detection', () => {
    test('should detect anomalies', () => {
      const values = [10, 12, 11, 13, 500, 11, 12, 10]; // 500 is anomaly

      const anomalies = processor.detectAnomalies(values, 2);

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.some(a => a.value === 500)).toBe(true);
    });

    test('should not detect anomalies in normal data', () => {
      const values = Array.from({ length: 50 }, () =>
        50 + (Math.random() - 0.5) * 2
      );

      const anomalies = processor.detectAnomalies(values, 3);

      expect(anomalies.length).toBeLessThan(5);
    });
  });

  describe('Utility Functions', () => {
    test('should format large numbers', () => {
      expect(processor.formatNumber(1500000)).toBe('1.50M');
      expect(processor.formatNumber(1500)).toBe('1.50K');
      expect(processor.formatNumber(100)).toBe('100.00');
    });

    test('should format percentage', () => {
      expect(processor.formatPercentage(0.85, 1)).toBe('85.0%');
      expect(processor.formatPercentage(0.333, 2)).toBe('33.30%');
    });

    test('should format duration', () => {
      expect(processor.formatDuration(500)).toBe('500ms');
      expect(processor.formatDuration(5000)).toBe('5.0s');
      expect(processor.formatDuration(300000)).toBe('5.0m');
    });

    test('should convert hex to rgba', () => {
      const rgba = processor.hexToRgba('#3b82f6', 0.5);

      expect(rgba).toContain('rgba');
      expect(rgba).toContain('0.5');
    });

    test('should get category color', () => {
      const color1 = processor.getCategoryColor('A', 0);
      const color2 = processor.getCategoryColor('B', 1);

      expect(color1).toBeDefined();
      expect(color2).toBeDefined();
      expect(color1).not.toBe(color2);
    });
  });

  describe('Bucketization', () => {
    test('should bucketize data correctly', () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        timestamp: Date.now() - (100 - i) * 1000,
        value: i
      }));

      const buckets = processor.bucketizeData(data, 10000, 'timestamp', 'value');

      expect(buckets.length).toBeGreaterThan(0);
      expect(buckets[0].values).toBeDefined();
    });
  });

  describe('Aggregation', () => {
    test('should aggregate buckets with average', () => {
      const buckets = [
        { time: 0, values: [10, 20, 30] },
        { time: 1000, values: [40, 50, 60] }
      ];

      const aggregated = processor.aggregateBuckets(buckets, 'avg');

      expect(aggregated[0].value).toBe(20);
      expect(aggregated[1].value).toBe(50);
    });

    test('should aggregate buckets with max', () => {
      const buckets = [
        { time: 0, values: [10, 20, 30] },
        { time: 1000, values: [40, 50, 60] }
      ];

      const aggregated = processor.aggregateBuckets(buckets, 'max');

      expect(aggregated[0].value).toBe(30);
      expect(aggregated[1].value).toBe(60);
    });

    test('should aggregate buckets with sum', () => {
      const buckets = [
        { time: 0, values: [10, 20, 30] },
        { time: 1000, values: [40, 50, 60] }
      ];

      const aggregated = processor.aggregateBuckets(buckets, 'sum');

      expect(aggregated[0].value).toBe(60);
      expect(aggregated[1].value).toBe(150);
    });
  });
});

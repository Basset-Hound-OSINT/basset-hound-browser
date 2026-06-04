/**
 * Anomaly Detection Engine Tests
 * Tests for change anomaly detection, baseline establishment, and alert generation
 */

const { AnomalyDetector, DETECTION_STRATEGIES } = require('../../src/advanced/anomaly-detector');

describe('Anomaly Detector', () => {
  let detector;

  beforeEach(() => {
    detector = new AnomalyDetector({
      strategy: DETECTION_STRATEGIES.Z_SCORE,
      zScoreThreshold: 2.5,
      minDataPoints: 5
    });
  });

  describe('Monitor Management', () => {
    test('should add monitor with baseline', () => {
      const history = [
        { timestamp: 1000, magnitude: 1 },
        { timestamp: 2000, magnitude: 1.2 },
        { timestamp: 3000, magnitude: 0.9 },
        { timestamp: 4000, magnitude: 1.1 },
        { timestamp: 5000, magnitude: 1.0 }
      ];

      const baseline = detector.addMonitor('monitor1', history);

      expect(baseline).toHaveProperty('mean');
      expect(baseline).toHaveProperty('stdDev');
      expect(detector.monitors.has('monitor1')).toBe(true);
    });

    test('should get monitor statistics', () => {
      const history = Array.from({ length: 20 }, (_, i) => ({
        timestamp: i * 1000,
        magnitude: 1 + (Math.sin(i / 5) * 0.2)
      }));

      detector.addMonitor('monitor1', history);
      const stats = detector.getMonitorStats('monitor1');

      expect(stats.monitorId).toBe('monitor1');
      expect(stats.baseline).toBeDefined();
      expect(stats.stats).toBeDefined();
      expect(stats.dataPoints).toBe(20);
    });

    test('should recalibrate monitor', () => {
      const history = Array.from({ length: 30 }, (_, i) => ({
        timestamp: i * 1000,
        magnitude: 1 + (Math.random() * 0.5)
      }));

      detector.addMonitor('monitor1', history);
      const before = detector.getMonitorStats('monitor1');

      detector.recordChange('monitor1', { magnitude: 100 }); // Add anomaly
      detector.recalibrateMonitor('monitor1');

      const after = detector.getMonitorStats('monitor1');
      expect(after.anomalyCount).toBe(0);
    });
  });

  describe('Z-Score Detection', () => {
    test('should detect outliers using Z-score', () => {
      const history = Array.from({ length: 15 }, (_, i) => ({
        timestamp: i * 1000,
        magnitude: 10 + (Math.random() * 2)
      }));

      detector.addMonitor('monitor1', history);

      const normal = detector.analyzeChange('monitor1', { magnitude: 11 });
      expect(normal.isAnomaly).toBe(false);

      const outlier = detector.analyzeChange('monitor1', { magnitude: 50 });
      expect(outlier.isAnomaly).toBe(true);
      expect(outlier.severity).toMatch(/high|critical/);
    });

    test('should calculate severity levels', () => {
      const history = Array.from({ length: 10 }, (_, i) => ({
        timestamp: i * 1000,
        magnitude: 1
      }));

      detector.addMonitor('monitor1', history);

      const result = detector.analyzeChange('monitor1', { magnitude: 1 });
      expect(result.severity).toBe('normal');

      const result2 = detector.analyzeChange('monitor1', { magnitude: 100 });
      expect(result2.severity).not.toBe('normal');
    });
  });

  describe('IQR Detection', () => {
    beforeEach(() => {
      detector = new AnomalyDetector({
        strategy: DETECTION_STRATEGIES.IQR
      });
    });

    test('should detect outliers using IQR method', () => {
      const history = Array.from({ length: 20 }, (_, i) => ({
        timestamp: i * 1000,
        magnitude: 5 + (i % 5)
      }));

      detector.addMonitor('monitor1', history);

      const normal = detector.analyzeChange('monitor1', { magnitude: 5 });
      expect(normal.isAnomaly).toBe(false);

      const outlier = detector.analyzeChange('monitor1', { magnitude: 100 });
      expect(outlier.isAnomaly).toBe(true);
    });
  });

  describe('Moving Average Detection', () => {
    beforeEach(() => {
      detector = new AnomalyDetector({
        strategy: DETECTION_STRATEGIES.MOVING_AVERAGE,
        movingAverageWindow: 5
      });
    });

    test('should detect deviations from moving average', () => {
      const history = Array.from({ length: 20 }, (_, i) => ({
        timestamp: i * 1000,
        magnitude: 10
      }));

      detector.addMonitor('monitor1', history);

      const normal = detector.analyzeChange('monitor1', { magnitude: 10 });
      expect(normal.isAnomaly).toBe(false);

      const abnormal = detector.analyzeChange('monitor1', { magnitude: 50 });
      expect(abnormal.isAnomaly).toBe(true);
    });
  });

  describe('Percentile Detection', () => {
    beforeEach(() => {
      detector = new AnomalyDetector({
        strategy: DETECTION_STRATEGIES.PERCENTILE,
        percentileThreshold: 95
      });
    });

    test('should detect values beyond percentile threshold', () => {
      const history = Array.from({ length: 100 }, (_, i) => ({
        timestamp: i * 1000,
        magnitude: (i % 10) + 1
      }));

      detector.addMonitor('monitor1', history);

      const normal = detector.analyzeChange('monitor1', { magnitude: 5 });
      expect(normal.isAnomaly).toBe(false);

      const outlier = detector.analyzeChange('monitor1', { magnitude: 1000 });
      expect(outlier.isAnomaly).toBe(true);
    });
  });

  describe('Learning Phase', () => {
    test('should skip anomaly detection during learning phase', () => {
      const monitor = detector.addMonitor('monitor1', []);

      // Record changes during learning phase
      for (let i = 0; i < 20; i++) {
        const result = detector.analyzeChange('monitor1', { magnitude: 1 + (Math.random() * 0.5) });
        expect(result.isAnomaly).toBe(false); // All normal during learning
      }

      const stats = detector.getMonitorStats('monitor1');
      expect(stats.inLearningPhase).toBe(false);
    });

    test('should transition out of learning phase', () => {
      detector.addMonitor('monitor1', []);

      // Simulate 50 changes
      for (let i = 0; i < 50; i++) {
        detector.analyzeChange('monitor1', { magnitude: 10 + (Math.random() * 1) });
      }

      const stats = detector.getMonitorStats('monitor1');
      expect(stats.inLearningPhase).toBe(false);
      expect(stats.dataPoints).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Seasonal Pattern Detection', () => {
    test('should detect daily patterns', () => {
      const history = [];
      // Create pattern: changes around 9am
      for (let day = 0; day < 30; day++) {
        const timestamp = new Date(2024, 0, 1 + day, 9, 0, 0).getTime();
        history.push({ timestamp, magnitude: 1 });
      }

      detector.addMonitor('monitor1', history);

      const patterns = detector.seasonalPatterns.get('monitor1');
      expect(patterns).toBeDefined();
      expect(patterns.hourOfDayPattern[9]).toBeGreaterThan(0);
    });

    test('should detect weekly patterns', () => {
      const history = [];
      // Create pattern: changes on Mondays
      for (let week = 0; week < 8; week++) {
        const date = new Date(2024, 0, 1 + week * 7, 10, 0, 0); // Always Monday
        history.push({ timestamp: date.getTime(), magnitude: 1 });
      }

      detector.addMonitor('monitor1', history);

      const patterns = detector.seasonalPatterns.get('monitor1');
      expect(patterns).toBeDefined();
    });
  });

  describe('Anomaly Alerts', () => {
    test('should emit anomaly detected event', (done) => {
      const history = Array.from({ length: 15 }, (_, i) => ({
        timestamp: i * 1000,
        magnitude: 10
      }));

      detector.addMonitor('monitor1', history);

      detector.on('anomaly-detected', (analysis) => {
        expect(analysis.isAnomaly).toBe(true);
        expect(analysis.monitorId).toBe('monitor1');
        done();
      });

      detector.analyzeChange('monitor1', { magnitude: 100 });
    });

    test('should track anomalies per monitor', () => {
      const history = Array.from({ length: 10 }, (_, i) => ({
        timestamp: i * 1000,
        magnitude: 5
      }));

      detector.addMonitor('monitor1', history);

      detector.analyzeChange('monitor1', { magnitude: 50 });
      detector.analyzeChange('monitor1', { magnitude: 60 });

      const anomalies = detector.getAnomalies('monitor1');
      expect(anomalies.length).toBeGreaterThan(0);
    });
  });

  describe('Summary Statistics', () => {
    test('should provide overall summary', () => {
      detector.addMonitor('monitor1', [{ magnitude: 1 }]);
      detector.addMonitor('monitor2', [{ magnitude: 2 }]);

      detector.analyzeChange('monitor1', { magnitude: 100 });

      const summary = detector.getSummary();
      expect(summary.monitorCount).toBe(2);
      expect(summary.totalAnomalies).toBeGreaterThan(0);
      expect(summary.monitors).toBeInstanceOf(Array);
    });
  });

  describe('Multiple Detection Strategies', () => {
    test('should support multiple strategies', () => {
      const strategies = [
        DETECTION_STRATEGIES.Z_SCORE,
        DETECTION_STRATEGIES.IQR,
        DETECTION_STRATEGIES.MOVING_AVERAGE,
        DETECTION_STRATEGIES.EXPONENTIAL,
        DETECTION_STRATEGIES.PERCENTILE
      ];

      strategies.forEach(strategy => {
        const det = new AnomalyDetector({ strategy });
        expect(det.options.strategy).toBe(strategy);
      });
    });
  });

  describe('Baseline Calculations', () => {
    test('should calculate baseline statistics correctly', () => {
      const history = [1, 2, 3, 4, 5].map((m, i) => ({
        timestamp: i * 1000,
        magnitude: m
      }));

      const baseline = detector.calculateBaseline(history);

      expect(baseline.mean).toBe(3); // (1+2+3+4+5)/5
      expect(baseline.median).toBeDefined();
      expect(baseline.q1).toBeDefined();
      expect(baseline.q3).toBeDefined();
      expect(baseline.min).toBe(1);
      expect(baseline.max).toBe(5);
    });

    test('should handle empty history', () => {
      const baseline = detector.calculateBaseline([]);

      expect(baseline.mean).toBe(0);
      expect(baseline.stdDev).toBe(0);
    });
  });

  describe('Data Filtering and Querying', () => {
    test('should filter anomalies by severity', () => {
      const history = Array.from({ length: 15 }, (_, i) => ({
        timestamp: i * 1000,
        magnitude: 10
      }));

      detector.addMonitor('monitor1', history);

      detector.analyzeChange('monitor1', { magnitude: 50 });
      detector.analyzeChange('monitor1', { magnitude: 100 });

      const highSeverity = detector.getAnomalies('monitor1', { severity: 'high' });
      expect(highSeverity.length).toBeGreaterThan(0);
    });

    test('should limit anomaly results', () => {
      const history = Array.from({ length: 15 }, (_, i) => ({
        timestamp: i * 1000,
        magnitude: 10 + (Math.random() * 1)
      }));

      detector.addMonitor('monitor1', history);

      // Generate multiple anomalies
      for (let i = 0; i < 10; i++) {
        detector.analyzeChange('monitor1', { magnitude: 100 });
      }

      const limited = detector.getAnomalies('monitor1', { limit: 3 });
      expect(limited.length).toBeLessThanOrEqual(3);
    });
  });
});

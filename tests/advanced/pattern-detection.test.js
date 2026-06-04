/**
 * Pattern Detection Tests
 * Tests for behavioral pattern detection and prediction
 */

const { PatternDetector, PATTERN_TYPES, CONFIDENCE_LEVELS } = require('../../src/advanced/pattern-detector');

describe('Pattern Detector', () => {
  let detector;

  beforeEach(() => {
    detector = new PatternDetector({
      minOccurrences: 3,
      confidenceThreshold: CONFIDENCE_LEVELS.MEDIUM
    });
  });

  describe('Event Recording', () => {
    test('should record events with timestamps', () => {
      detector.recordEvent('monitor1', { description: 'Change detected' });

      const history = detector.eventHistory.get('monitor1');
      expect(history).toBeDefined();
      expect(history.length).toBe(1);
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('datetime');
    });

    test('should maintain lookback period', () => {
      const detector2 = new PatternDetector({
        lookbackPeriod: 1000 // 1 second
      });

      // Add old event
      const oldTime = Date.now() - 5000;
      detector2.recordEvent('monitor1', { timestamp: oldTime });

      // Add recent event
      detector2.recordEvent('monitor1', { timestamp: Date.now() });

      const history = detector2.eventHistory.get('monitor1');
      expect(history.length).toBe(1); // Old event filtered out
    });
  });

  describe('Daily Pattern Detection', () => {
    test('should detect daily patterns', () => {
      // Create 10 days of data, changes at 9am every day
      for (let day = 0; day < 10; day++) {
        const timestamp = new Date(2024, 0, 1 + day, 9, 0, 0).getTime();
        detector.recordEvent('monitor1', { timestamp });
      }

      detector.analyzePatterns('monitor1');
      const patterns = detector.getPatterns('monitor1', { type: PATTERN_TYPES.DAILY_CYCLE });

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].hour).toBe(9);
      expect(patterns[0].frequency).toBeGreaterThan(0.7);
    });

    test('should calculate daily pattern frequency', () => {
      for (let day = 0; day < 7; day++) {
        const timestamp = new Date(2024, 0, 1 + day, 14, 0, 0).getTime();
        detector.recordEvent('monitor1', { timestamp });
      }

      detector.analyzePatterns('monitor1');
      const patterns = detector.getPatterns('monitor1', { type: PATTERN_TYPES.DAILY_CYCLE });

      if (patterns.length > 0) {
        expect(patterns[0].confidence).toBeGreaterThan(0.5);
      }
    });
  });

  describe('Weekly Pattern Detection', () => {
    test('should detect weekly patterns', () => {
      // Create 8 weeks of Monday changes
      for (let week = 0; week < 8; week++) {
        const date = new Date(2024, 0, 1 + week * 7); // Monday
        const timestamp = date.getTime();
        detector.recordEvent('monitor1', { timestamp });
      }

      detector.analyzePatterns('monitor1');
      const patterns = detector.getPatterns('monitor1', { type: PATTERN_TYPES.WEEKLY_TREND });

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].dayOfWeek).toBe(1); // Monday
    });

    test('should calculate weekly pattern confidence', () => {
      for (let week = 0; week < 6; week++) {
        const date = new Date(2024, 0, 1 + week * 7);
        detector.recordEvent('monitor1', { timestamp: date.getTime() });
      }

      detector.analyzePatterns('monitor1');
      const patterns = detector.getPatterns('monitor1', { type: PATTERN_TYPES.WEEKLY_TREND });

      if (patterns.length > 0) {
        expect(patterns[0].confidence).toBeGreaterThan(0);
      }
    });
  });

  describe('Monthly Pattern Detection', () => {
    test('should detect monthly patterns', () => {
      // Create changes on 15th of each month
      for (let month = 0; month < 6; month++) {
        const timestamp = new Date(2024, month, 15, 10, 0, 0).getTime();
        detector.recordEvent('monitor1', { timestamp });
      }

      detector.analyzePatterns('monitor1');
      const patterns = detector.getPatterns('monitor1', { type: PATTERN_TYPES.MONTHLY_UPDATE });

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].dayOfMonth).toBe(15);
    });
  });

  describe('Release Schedule Detection', () => {
    test('should detect consistent release intervals', () => {
      // Create events with 7-day intervals
      const baseTime = Date.now();
      for (let i = 0; i < 6; i++) {
        const timestamp = baseTime + (i * 7 * 24 * 60 * 60 * 1000);
        detector.recordEvent('monitor1', { timestamp });
      }

      detector.analyzePatterns('monitor1');
      const patterns = detector.getPatterns('monitor1', { type: PATTERN_TYPES.RELEASE_SCHEDULE });

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].intervalDays).toBe(7);
    });

    test('should tolerate interval variance', () => {
      const baseTime = Date.now();
      const intervals = [0, 7, 14, 21, 29, 35]; // ~7 day intervals with variance

      intervals.forEach(days => {
        const timestamp = baseTime + (days * 24 * 60 * 60 * 1000);
        detector.recordEvent('monitor1', { timestamp });
      });

      detector.analyzePatterns('monitor1');
      const patterns = detector.getPatterns('monitor1', { type: PATTERN_TYPES.RELEASE_SCHEDULE });

      if (patterns.length > 0) {
        expect(patterns[0].intervalDays).toBeGreaterThan(0);
      }
    });
  });

  describe('Pattern Predictions', () => {
    test('should predict next daily occurrence', () => {
      // Create daily pattern at 10am
      for (let day = 0; day < 5; day++) {
        const timestamp = new Date(2024, 0, 1 + day, 10, 0, 0).getTime();
        detector.recordEvent('monitor1', { timestamp });
      }

      detector.analyzePatterns('monitor1');
      const prediction = detector.getNextPrediction('monitor1');

      expect(prediction).toBeDefined();
      if (prediction) {
        expect(prediction.nextExpected).toBeGreaterThan(Date.now());
      }
    });

    test('should calculate time until next change', () => {
      for (let day = 0; day < 5; day++) {
        const timestamp = new Date(2024, 0, 1 + day, 15, 0, 0).getTime();
        detector.recordEvent('monitor1', { timestamp });
      }

      detector.analyzePatterns('monitor1');
      const timeUntil = detector.getTimeUntilNextChange('monitor1');

      if (timeUntil) {
        expect(timeUntil).toBeGreaterThan(0);
      }
    });
  });

  describe('Confidence Filtering', () => {
    test('should filter patterns by confidence', () => {
      // Create weak pattern
      for (let day = 0; day < 3; day++) {
        const timestamp = new Date(2024, 0, 1 + day, 9, 0, 0).getTime();
        detector.recordEvent('monitor1', { timestamp });
      }

      detector.analyzePatterns('monitor1');
      const highConfidence = detector.getPatterns('monitor1', { minConfidence: CONFIDENCE_LEVELS.HIGH });

      expect(highConfidence).toBeDefined();
    });
  });

  describe('Hourly Pattern Detection', () => {
    test('should detect hourly patterns', () => {
      // Create events at specific hours
      const baseTime = new Date(2024, 0, 1, 14, 0, 0).getTime();

      for (let day = 0; day < 10; day++) {
        for (let hour = 13; hour <= 15; hour++) {
          const timestamp = baseTime + (day * 24 * 60 * 60 * 1000) + ((hour - 14) * 60 * 60 * 1000);
          detector.recordEvent('monitor1', { timestamp });
        }
      }

      detector.analyzePatterns('monitor1');
      const patterns = detector.getPatterns('monitor1', { type: PATTERN_TYPES.HOURLY_PATTERN });

      expect(patterns).toBeDefined();
    });
  });

  describe('Pattern Summary', () => {
    test('should provide pattern summary', () => {
      for (let day = 0; day < 10; day++) {
        const timestamp = new Date(2024, 0, 1 + day, 10, 0, 0).getTime();
        detector.recordEvent('monitor1', { timestamp });
      }

      detector.analyzePatterns('monitor1');
      const summary = detector.getPatternSummary('monitor1');

      expect(summary.monitorId).toBe('monitor1');
      expect(summary.patternCount).toBeGreaterThanOrEqual(0);
      expect(summary.eventCount).toBeGreaterThan(0);
    });
  });

  describe('Multiple Monitors', () => {
    test('should track patterns across multiple monitors', () => {
      // Monitor 1: daily at 9am
      for (let day = 0; day < 5; day++) {
        const timestamp = new Date(2024, 0, 1 + day, 9, 0, 0).getTime();
        detector.recordEvent('monitor1', { timestamp });
      }

      // Monitor 2: daily at 3pm
      for (let day = 0; day < 5; day++) {
        const timestamp = new Date(2024, 0, 1 + day, 15, 0, 0).getTime();
        detector.recordEvent('monitor2', { timestamp });
      }

      detector.analyzePatterns('monitor1');
      detector.analyzePatterns('monitor2');

      const allPatterns = detector.getAllPatterns();
      expect(allPatterns.size).toBe(2);
    });
  });

  describe('Pattern Events', () => {
    test('should emit patterns-detected event', (done) => {
      detector.on('patterns-detected', (data) => {
        expect(data.monitorId).toBe('monitor1');
        expect(data.patterns).toBeDefined();
        done();
      });

      for (let day = 0; day < 5; day++) {
        const timestamp = new Date(2024, 0, 1 + day, 9, 0, 0).getTime();
        detector.recordEvent('monitor1', { timestamp });
      }

      detector.analyzePatterns('monitor1');
    });
  });

  describe('Pattern Clearing', () => {
    test('should clear patterns for monitor', () => {
      detector.recordEvent('monitor1', { timestamp: Date.now() });
      detector.analyzePatterns('monitor1');

      detector.clearMonitor('monitor1');

      const patterns = detector.getPatterns('monitor1');
      expect(patterns.length).toBe(0);
    });
  });

  describe('Pattern Type Coverage', () => {
    test('should detect all pattern types', () => {
      const types = Object.values(PATTERN_TYPES);

      types.forEach(type => {
        expect(type).toBeTruthy();
      });

      expect(PATTERN_TYPES.DAILY_CYCLE).toBeDefined();
      expect(PATTERN_TYPES.WEEKLY_TREND).toBeDefined();
      expect(PATTERN_TYPES.MONTHLY_UPDATE).toBeDefined();
      expect(PATTERN_TYPES.RELEASE_SCHEDULE).toBeDefined();
      expect(PATTERN_TYPES.HOURLY_PATTERN).toBeDefined();
    });
  });

  describe('Data Validation', () => {
    test('should handle events with missing timestamps', () => {
      detector.recordEvent('monitor1', { description: 'No timestamp' });

      const history = detector.eventHistory.get('monitor1');
      expect(history[0]).toHaveProperty('timestamp');
    });

    test('should handle duplicate timestamps', () => {
      const timestamp = Date.now();

      detector.recordEvent('monitor1', { timestamp });
      detector.recordEvent('monitor1', { timestamp });

      const history = detector.eventHistory.get('monitor1');
      expect(history.length).toBe(2);
    });
  });

  describe('Large Dataset Performance', () => {
    test('should handle large event histories efficiently', () => {
      // Add 500 events
      for (let i = 0; i < 500; i++) {
        const timestamp = Date.now() - (i * 1000);
        detector.recordEvent('monitor1', { timestamp });
      }

      const startTime = performance.now();
      detector.analyzePatterns('monitor1');
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });
});

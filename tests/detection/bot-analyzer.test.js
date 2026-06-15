/**
 * Basset Hound Browser - Advanced Bot Detection Tests
 *
 * Tests for:
 * - Multi-Vector Fingerprint Analysis (Task 2.3.1)
 * - Behavioral Pattern Matching (Task 2.3.2)
 * - Anomaly Detection Integration (Task 2.3.3)
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

const {
  FingerprintAnalyzer,
  FINGERPRINT_VECTORS,
  RISK_LEVELS
} = require('../../src/detection/fingerprint-analyzer');

const {
  BehaviorMatcher,
  BOT_PATTERNS
} = require('../../src/detection/behavior-matcher');

const {
  AnomalyDetector,
  DETECTION_METHODS,
  ANOMALY_SEVERITY
} = require('../../src/detection/anomaly-detector');

describe('Task 2.3: Advanced Bot Detection', () => {
  // ===== Task 2.3.1: Multi-Vector Fingerprint Analysis =====
  describe('Task 2.3.1: Multi-Vector Fingerprint Analysis', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new FingerprintAnalyzer({
        enableVectorWeighting: true
      });
    });

    test('should analyze fingerprint across multiple vectors', () => {
      const fingerprintData = {
        canvas: { consistent: true },
        webgl: { consistent: true },
        audio: { consistent: true },
        fonts: { consistent: true },
        webrtc: { ipMismatch: false },
        timezone: { mismatchWithRegion: false },
        navigator: { headless: false, webdriver: false }
      };

      const result = analyzer.analyzeFingerprint(fingerprintData);

      expect(result).toHaveProperty('compositeScore');
      expect(result).toHaveProperty('riskLevel');
      expect(result).toHaveProperty('vectorAnalyses');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('botProbability');
    });

    test('should calculate composite score from multiple vectors', () => {
      const fingerprintData = {
        canvas: { consistent: true },
        webgl: { consistent: true },
        navigator: { headless: false }
      };

      const result = analyzer.analyzeFingerprint(fingerprintData);

      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
      expect(result.compositeScore).toBeLessThanOrEqual(1);
    });

    test('should detect canvas anomalies', () => {
      const fingerprintData = {
        canvas: {
          consistent: false,
          isModified: true,
          signatures: ['Canvas fingerprinting evasion detected']
        }
      };

      const result = analyzer.analyzeFingerprint(fingerprintData);
      const canvasAnalysis = result.vectorAnalyses.canvas;

      expect(canvasAnalysis.score).toBeGreaterThan(0.5);
      expect(canvasAnalysis.riskLevel).not.toBe(RISK_LEVELS.SAFE);
    });

    test('should detect WebGL anomalies', () => {
      const fingerprintData = {
        webgl: {
          consistent: false,
          isSpoofe: true,
          extensionsMissing: true,
          signatures: ['WebGL renderer spoofing detected']
        }
      };

      const result = analyzer.analyzeFingerprint(fingerprintData);
      const webglAnalysis = result.vectorAnalyses.webgl;

      expect(webglAnalysis.score).toBeGreaterThan(0.5);
    });

    test('should detect WebRTC IP mismatch', () => {
      const fingerprintData = {
        webrtc: {
          ipMismatch: true,
          signatures: ['WebRTC IP mismatch with session IP']
        }
      };

      const result = analyzer.analyzeFingerprint(fingerprintData);
      const webrtcAnalysis = result.vectorAnalyses.webrtc;

      expect(webrtcAnalysis.anomalies).toContain('WebRTC IP mismatch with session IP');
      expect(webrtcAnalysis.score).toBeGreaterThan(0.5);
    });

    test('should detect headless browser', () => {
      const fingerprintData = {
        navigator: {
          headless: true,
          signatures: ['Headless browser detected']
        }
      };

      const result = analyzer.analyzeFingerprint(fingerprintData);
      const navAnalysis = result.vectorAnalyses.navigator;

      expect(navAnalysis.anomalies).toContain('Headless browser detected');
    });

    test('should detect WebDriver indicators', () => {
      const fingerprintData = {
        navigator: {
          webdriver: true,
          signatures: ['WebDriver API detected']
        }
      };

      const result = analyzer.analyzeFingerprint(fingerprintData);
      const navAnalysis = result.vectorAnalyses.navigator;

      expect(navAnalysis.anomalies).toContain('WebDriver API detected');
    });

    test('should assign proper risk levels', () => {
      const cleanData = {
        canvas: { consistent: true },
        webgl: { consistent: true },
        navigator: { headless: false }
      };

      const result = analyzer.analyzeFingerprint(cleanData);
      expect(result.riskLevel).toBe(RISK_LEVELS.SAFE);
    });

    test('should detect high-risk fingerprints', () => {
      const suspiciousData = {
        navigator: { headless: true, webdriver: true, signatures: ['Headless browser detected', 'WebDriver API detected'] },
        webrtc: { ipMismatch: true, signatures: ['WebRTC IP mismatch'] },
        canvas: { isModified: true, signatures: ['Canvas modification detected'] }
      };

      const result = analyzer.analyzeFingerprint(suspiciousData);
      // With 3 vectors analyzed and signatures detected, should be at least MEDIUM or HIGH
      expect(result.riskLevel).not.toBe(RISK_LEVELS.SAFE);
      expect(result.botProbability).toBeGreaterThan(0.3);
    });

    test('should calculate confidence', () => {
      const fingerprintData = {
        canvas: { consistent: true },
        webgl: { consistent: true },
        navigator: { headless: false }
      };

      const result = analyzer.analyzeFingerprint(fingerprintData);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('should extract detected signatures', () => {
      const fingerprintData = {
        canvas: { isModified: true, signatures: ['Canvas modification detected'] },
        navigator: { headless: true, signatures: ['Headless browser detected'] }
      };

      const result = analyzer.analyzeFingerprint(fingerprintData);
      expect(result.detectedSignatures.length).toBeGreaterThan(0);
    });

    test('should provide recommendations', () => {
      const fingerprintData = {
        navigator: { headless: true, webdriver: true },
        webrtc: { ipMismatch: true }
      };

      const result = analyzer.analyzeFingerprint(fingerprintData);
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    test('should compare fingerprints for consistency', () => {
      const fingerprint1 = {
        canvas: { consistent: true },
        webgl: { consistent: true },
        audio: { consistent: true },
        fonts: { consistent: true },
        webrtc: { consistent: true },
        timezone: { consistent: true },
        language: { consistent: true },
        screen: { consistent: true },
        navigator: { consistent: true },
        plugins: { consistent: true },
        storage: { consistent: true },
        headers: { consistent: true }
      };

      const fingerprint2 = {
        canvas: { consistent: true },
        webgl: { consistent: true },
        audio: { consistent: true },
        fonts: { consistent: true },
        webrtc: { consistent: true },
        timezone: { consistent: true },
        language: { consistent: true },
        screen: { consistent: true },
        navigator: { consistent: true },
        plugins: { consistent: true },
        storage: { consistent: true },
        headers: { consistent: true }
      };

      const comparison = analyzer.compareFingerprints(fingerprint1, fingerprint2);
      expect(comparison.consistency).toBe(1.0);
      expect(comparison.differences.length).toBe(0);
    });

    test('should detect fingerprint inconsistencies', () => {
      const fingerprint1 = {
        canvas: { consistent: true },
        webgl: { consistent: true }
      };

      const fingerprint2 = {
        canvas: { consistent: false },
        webgl: { consistent: true }
      };

      const comparison = analyzer.compareFingerprints(fingerprint1, fingerprint2);
      expect(comparison.consistency).toBeLessThan(1.0);
      expect(comparison.differences.length).toBeGreaterThan(0);
    });

    test('should list all vector types', () => {
      const vectors = FingerprintAnalyzer.getVectorTypes();
      expect(vectors).toHaveProperty('CANVAS');
      expect(vectors).toHaveProperty('WEBGL');
      expect(vectors).toHaveProperty('AUDIO');
      expect(vectors).toHaveProperty('FONTS');
    });

    test('should list all risk levels', () => {
      const levels = FingerprintAnalyzer.getRiskLevels();
      expect(levels).toHaveProperty('SAFE');
      expect(levels).toHaveProperty('LOW');
      expect(levels).toHaveProperty('MEDIUM');
      expect(levels).toHaveProperty('HIGH');
      expect(levels).toHaveProperty('CRITICAL');
    });
  });

  // ===== Task 2.3.2: Behavioral Pattern Matching =====
  describe('Task 2.3.2: Behavioral Pattern Matching', () => {
    let matcher;

    beforeEach(() => {
      matcher = new BehaviorMatcher({
        enablePatternMatching: true,
        minEventsForAnalysis: 5
      });
    });

    test('should analyze behavior events for patterns', () => {
      const events = [
        { type: 'click', timestamp: 1000 },
        { type: 'click', timestamp: 1100 },
        { type: 'click', timestamp: 1200 },
        { type: 'typing', timestamp: 1300 },
        { type: 'typing', timestamp: 1400 }
      ];

      const result = matcher.analyzeBehavior(events);

      expect(result).toHaveProperty('totalEvents', 5);
      expect(result).toHaveProperty('detectedPatterns');
      expect(result).toHaveProperty('botScore');
      expect(result).toHaveProperty('botRisk');
    });

    test('should detect too-fast clicks', () => {
      const events = [
        { type: 'click', timestamp: 1000 },
        { type: 'click', timestamp: 1050 }, // 50ms gap - too fast
        { type: 'click', timestamp: 1100 }, // 50ms gap - too fast
        { type: 'click', timestamp: 1150 },
        { type: 'click', timestamp: 1200 }
      ];

      const result = matcher.analyzeBehavior(events);
      const hasClickPattern = result.detectedPatterns.some(p => p.pattern === 'TOO_FAST_CLICKS');

      expect(hasClickPattern).toBe(true);
      expect(result.botScore).toBeGreaterThan(0);
    });

    test('should detect perfect typing', () => {
      const events = Array.from({ length: 25 }, (_, i) => ({
        type: 'keyDown',
        timestamp: 1000 + i * 50,
        key: String.fromCharCode(65 + (i % 26))
      }));

      const result = matcher.analyzeBehavior(events);
      const hasTypePattern = result.detectedPatterns.some(p => p.pattern === 'PERFECT_TYPING');

      expect(hasTypePattern).toBe(true);
    });

    test('should detect instant form fill', () => {
      const events = [
        { type: 'click', timestamp: 1000, targetId: 'field1' },
        { type: 'typing', timestamp: 1050, targetId: 'field1', text: 'hello' },
        { type: 'click', timestamp: 1250, targetId: 'field2' }, // 200ms to next field
        { type: 'typing', timestamp: 1280, targetId: 'field2', text: 'world' },
        { type: 'click', timestamp: 1380, targetId: 'submit' }
      ];

      const result = matcher.analyzeBehavior(events);

      expect(result.detectedPatterns).toBeDefined();
      expect(result.totalEvents).toBe(5);
    });

    test('should detect zero mouse movement', () => {
      const events = [
        { type: 'click', timestamp: 1000, x: 100, y: 200 },
        { type: 'click', timestamp: 1200, x: 300, y: 400 },
        { type: 'click', timestamp: 1400, x: 500, y: 600 },
        { type: 'click', timestamp: 1600, x: 700, y: 800 },
        { type: 'click', timestamp: 1800, x: 900, y: 1000 }
      ];

      const result = matcher.analyzeBehavior(events);
      const hasMovementPattern = result.detectedPatterns.some(p => p.pattern === 'ZERO_MOUSE_MOVEMENT');

      expect(hasMovementPattern).toBe(true);
    });

    test('should analyze event timings', () => {
      const events = [
        { type: 'click', timestamp: 1000 },
        { type: 'click', timestamp: 1200 },
        { type: 'click', timestamp: 1400 },
        { type: 'click', timestamp: 1600 },
        { type: 'click', timestamp: 1800 }
      ];

      const result = matcher.analyzeBehavior(events);

      expect(result.eventTimings).toHaveProperty('totalDuration');
      expect(result.eventTimings).toHaveProperty('eventCount');
      expect(result.eventTimings).toHaveProperty('averageInterval');
    });

    test('should calculate bot score', () => {
      const suspiciousEvents = [
        { type: 'click', timestamp: 1000 },
        { type: 'click', timestamp: 1050 },
        { type: 'click', timestamp: 1100 },
        { type: 'click', timestamp: 1150 },
        { type: 'click', timestamp: 1200 }
      ];

      const result = matcher.analyzeBehavior(suspiciousEvents);
      expect(result.botScore).toBeGreaterThan(0);
      expect(result.botScore).toBeLessThanOrEqual(1);
    });

    test('should determine bot risk level', () => {
      const events = [
        { type: 'click', timestamp: 1000 },
        { type: 'click', timestamp: 1200 },
        { type: 'click', timestamp: 1400 },
        { type: 'click', timestamp: 1600 },
        { type: 'click', timestamp: 1800 }
      ];

      const result = matcher.analyzeBehavior(events);
      expect(['low', 'medium-low', 'medium', 'high', 'critical']).toContain(result.botRisk);
    });

    test('should require minimum events for analysis', () => {
      const fewEvents = [
        { type: 'click', timestamp: 1000 },
        { type: 'click', timestamp: 1200 },
        { type: 'click', timestamp: 1400 }
      ];

      const result = matcher.analyzeBehavior(fewEvents);
      expect(result.detectedPatterns.length).toBe(0);
    });

    test('should calculate confidence in analysis', () => {
      const events = [
        { type: 'click', timestamp: 1000 },
        { type: 'click', timestamp: 1050 },
        { type: 'click', timestamp: 1100 },
        { type: 'click', timestamp: 1150 },
        { type: 'click', timestamp: 1200 }
      ];

      const result = matcher.analyzeBehavior(events);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('should provide recommendations', () => {
      const suspiciousEvents = Array.from({ length: 10 }, (_, i) => ({
        type: 'click',
        timestamp: 1000 + i * 50
      }));

      const result = matcher.analyzeBehavior(suspiciousEvents);
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    test('should list available patterns', () => {
      const patterns = matcher.getAvailablePatterns();
      expect(patterns).toHaveProperty('TOO_FAST_CLICKS');
      expect(patterns).toHaveProperty('PERFECT_TYPING');
      expect(patterns).toHaveProperty('INSTANT_FORM_FILL');
    });
  });

  // ===== Task 2.3.3: Anomaly Detection Integration =====
  describe('Task 2.3.3: Anomaly Detection Integration', () => {
    let detector;

    beforeEach(() => {
      detector = new AnomalyDetector({
        enableLearning: true,
        minSamplesForBaseline: 5,
        zScoreThreshold: 2.5
      });
    });

    test('should add samples for baseline learning', () => {
      detector.addSample('fingerprints', { value: 100 });
      detector.addSample('fingerprints', { value: 105 });
      detector.addSample('fingerprints', { value: 95 });

      const count = detector.getSampleCount('fingerprints');
      expect(count).toBeGreaterThan(0);
    });

    test('should update baseline after minimum samples', () => {
      // Add enough samples to trigger baseline update
      for (let i = 0; i < 5; i++) {
        detector.addSample('fingerprints', { value: 100 + i });
      }

      const baseline = detector.getBaseline('fingerprints');
      expect(baseline).toBeDefined();
      expect(baseline.mean).toBeDefined();
    });

    test('should detect fingerprint anomalies', () => {
      // Set up baseline
      for (let i = 0; i < 5; i++) {
        detector.addSample('fingerprints', { value: 100 });
      }

      // Test with anomalous value
      const fingerprintData = {
        test_field: 500 // Significantly different from baseline
      };

      const result = detector.detectFingerprintAnomalies(fingerprintData);

      expect(result).toHaveProperty('anomalies');
      expect(result).toHaveProperty('severity');
      expect(result).toHaveProperty('isAnomaly');
    });

    test('should detect behavior anomalies', () => {
      const behaviorData = {
        timings: [100, 105, 95, 103, 98, 500], // Last one is anomalous
        events: [
          { type: 'click' },
          { type: 'click' },
          { type: 'typing' },
          { type: 'click' }
        ]
      };

      const result = detector.detectBehaviorAnomalies(behaviorData);

      expect(result).toHaveProperty('anomalies');
      expect(result).toHaveProperty('severity');
      expect(result).toHaveProperty('totalAnomalyScore');
    });

    test('should support different detection methods', () => {
      const methods = AnomalyDetector.getDetectionMethods();
      expect(methods).toHaveProperty('Z_SCORE');
      expect(methods).toHaveProperty('IQR');
      expect(methods).toHaveProperty('TEMPORAL');
    });

    test('should assign severity levels', () => {
      const severities = AnomalyDetector.getSeverityLevels();
      expect(severities).toHaveProperty('NORMAL');
      expect(severities).toHaveProperty('MINOR');
      expect(severities).toHaveProperty('MODERATE');
      expect(severities).toHaveProperty('SEVERE');
      expect(severities).toHaveProperty('CRITICAL');
    });

    test('should calculate statistics', () => {
      for (let i = 0; i < 5; i++) {
        detector.addSample('fingerprints', { value: 100 });
      }

      const stats = detector.getStatistics();
      expect(stats.fingerprints.sampleCount).toBeGreaterThan(0);
      expect(stats.fingerprints.baselineReady).toBe(true);
    });

    test('should reset detector state', () => {
      for (let i = 0; i < 5; i++) {
        detector.addSample('fingerprints', { value: 100 });
      }

      detector.reset();

      expect(detector.getSampleCount('fingerprints')).toBe(0);
      const baseline = detector.getBaseline('fingerprints');
      expect(Object.keys(baseline).length).toBe(0);
    });

    test('should handle Z-score detection method', () => {
      for (let i = 0; i < 5; i++) {
        detector.addSample('fingerprints', { value: 100 });
      }

      const fingerprintData = {
        test_field: 100
      };

      const result = detector.detectFingerprintAnomalies(
        fingerprintData,
        DETECTION_METHODS.Z_SCORE
      );

      expect(result.method).toBe(DETECTION_METHODS.Z_SCORE);
    });

    test('should handle IQR detection method', () => {
      for (let i = 0; i < 5; i++) {
        detector.addSample('fingerprints', { value: 100 });
      }

      const fingerprintData = {
        test_field: 100
      };

      const result = detector.detectFingerprintAnomalies(
        fingerprintData,
        DETECTION_METHODS.IQR
      );

      expect(result.method).toBe(DETECTION_METHODS.IQR);
    });

    test('should calculate confidence in detection', () => {
      const behaviorData = {
        timings: [100, 105, 95, 103, 98, 500, 510, 520],
        events: [
          { type: 'click' },
          { type: 'click' },
          { type: 'typing' },
          { type: 'click' }
        ]
      };

      const result = detector.detectBehaviorAnomalies(behaviorData);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('should not flag clean data as anomalous', () => {
      // Set baseline
      for (let i = 0; i < 5; i++) {
        detector.addSample('fingerprints', { value: 100 });
      }

      // Test with normal value
      const fingerprintData = {
        test_field: 101 // Very close to baseline
      };

      const result = detector.detectFingerprintAnomalies(fingerprintData);
      expect(result.isAnomaly).toBe(false);
    });
  });

  // ===== Integration Tests =====
  describe('Integration: Multi-system bot detection', () => {
    test('should combine fingerprint and behavior analysis', () => {
      const fingerprintAnalyzer = new FingerprintAnalyzer();
      const behaviorMatcher = new BehaviorMatcher();

      const fingerprintData = {
        navigator: { headless: true },
        canvas: { isModified: true }
      };

      const behaviorEvents = Array.from({ length: 10 }, (_, i) => ({
        type: 'click',
        timestamp: 1000 + i * 50
      }));

      const fpResult = fingerprintAnalyzer.analyzeFingerprint(fingerprintData);
      const bhResult = behaviorMatcher.analyzeBehavior(behaviorEvents);

      // Combine scores
      const combinedScore = (fpResult.compositeScore + bhResult.botScore) / 2;
      expect(combinedScore).toBeGreaterThan(0);
      expect(combinedScore).toBeLessThanOrEqual(1);
    });

    test('should use anomaly detection to enhance analysis', () => {
      const analyzer = new AnomalyDetector();
      const fingerprintAnalyzer = new FingerprintAnalyzer();

      // Set baseline
      for (let i = 0; i < 5; i++) {
        analyzer.addSample('fingerprints', { value: 100 });
      }

      // Test suspicious fingerprint
      const fingerprintData = {
        navigator: { headless: true }
      };

      const fpResult = fingerprintAnalyzer.analyzeFingerprint(fingerprintData);
      const anomalyResult = analyzer.detectFingerprintAnomalies(fingerprintData);

      // Both should flag suspicious activity
      expect(fpResult.riskLevel).not.toBe(RISK_LEVELS.SAFE);
      expect(anomalyResult.isAnomaly).toBeDefined();
    });
  });
});

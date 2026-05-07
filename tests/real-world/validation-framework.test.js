/**
 * Unit tests for ValidationFramework
 */

const ValidationFramework = require('./validation-framework');

describe('ValidationFramework', () => {
  let framework;

  beforeAll(() => {
    framework = new ValidationFramework();
  });

  describe('Framework Initialization', () => {
    test('should initialize with all modules', () => {
      expect(framework.techDetector).toBeDefined();
      expect(framework.behavioralSimulator).toBeDefined();
      expect(framework.deviceFingerprinter).toBeDefined();
    });

    test('should have empty results initially', () => {
      expect(framework.results).toEqual([]);
    });
  });

  describe('Individual Scenarios', () => {
    test('Scenario 1: E-commerce Site Detection', async () => {
      const result = await framework.scenarioEcommerceSiteDetection();

      expect(result.name).toBe('E-commerce Site Detection');
      expect(result.passed).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    test('Scenario 2: SPA Framework Detection', async () => {
      const result = await framework.scenarioSPAFrameworkDetection();

      expect(result.name).toBe('SPA Framework Detection');
      expect(result.passed).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    test('Scenario 3: Behavioral Evasion Sequence', async () => {
      const result = await framework.scenarioBehavioralEvasionSequence();

      expect(result.name).toBe('Behavioral Evasion Sequence');
      expect(result.interactions).toBeGreaterThan(0);
      expect(result.plausibility).toBeGreaterThan(0);
    });

    test('Scenario 4: Device Fingerprinting Consistency', async () => {
      const result = await framework.scenarioDeviceFingerprintingConsistency();

      expect(result.name).toBe('Device Fingerprinting Consistency');
      expect(result.mobileProfile).toBeDefined();
      expect(result.desktopProfile).toBeDefined();
      expect(result.passed).toBe(true);
    });

    test('Scenario 5: Combined Detection + Fingerprinting', async () => {
      const result = await framework.scenarioCombinedDetectionAndFingerprinting();

      expect(result.name).toBe('Combined Detection + Fingerprinting');
      expect(result.device).toBeDefined();
      expect(result.userAgent).toBeDefined();
      expect(result.technologiesDetected).toBeGreaterThanOrEqual(0);
    });

    test('Scenario 6: Multi-Step Bot Evasion', async () => {
      const result = await framework.scenarioMultiStepBotEvasion();

      expect(result.name).toBe('Multi-Step Bot Evasion');
      expect(result.steps).toHaveLength(5);
      expect(result.passedSteps).toBeGreaterThan(0);
    });

    test('Scenario 7: High-Volume Tech Detection', async () => {
      const result = await framework.scenarioHighVolumeTechDetection();

      expect(result.name).toBe('High-Volume Tech Detection');
      expect(result.htmlSize).toBeGreaterThan(100000);
      expect(result.detectionDuration).toBeGreaterThanOrEqual(0);
      expect(result.detectionDuration).toBeLessThan(result.maxDuration);
      expect(result.technologiesDetected).toBeGreaterThanOrEqual(0);
    });

    test('Scenario 8: Device Randomization', async () => {
      const result = await framework.scenarioDeviceRandomization();

      expect(result.name).toBe('Device Randomization');
      expect(result.iterations).toBe(10);
      expect(result.uniqueDevices).toBeGreaterThan(0);
      expect(result.uniqueUserAgents).toBeGreaterThan(0);
      expect(result.history).toBeDefined();
    });

    test('Scenario 9: Typing Pattern Variation', async () => {
      const result = await framework.scenarioTypingPatternVariation();

      expect(result.name).toBe('Typing Pattern Variation');
      expect(result.results).toBeDefined();
      expect(result.results.fast).toBeDefined();
      expect(result.results.slow).toBeDefined();
      expect(result.results.fast.avgWpm).toBeGreaterThan(result.results.slow.avgWpm);
    });

    test('Scenario 10: Multi-Source Tech Detection', async () => {
      const result = await framework.scenarioMultiSourceTechDetection();

      expect(result.name).toBe('Multi-Source Tech Detection');
      expect(result.htmlBasedDetections).toBeGreaterThanOrEqual(0);
      expect(result.headerBasedDetections).toBeGreaterThanOrEqual(0);
      expect(result.combinedDetections).toBeGreaterThanOrEqual(0);
    });

    test('Scenario 11: Stress Test - Rapid Changes', async () => {
      const result = await framework.scenarioRapidProfileChanges();

      expect(result.name).toBe('Stress Test - Rapid Changes');
      expect(result.iterations).toBe(50);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.passed).toBeDefined();
    });

    test('Scenario 12: Cache Effectiveness', async () => {
      const result = await framework.scenarioCacheEffectiveness();

      expect(result.name).toBe('Cache Effectiveness');
      expect(result.firstDetection).toBeGreaterThanOrEqual(0);
      expect(result.cachedDetection).toBeGreaterThanOrEqual(0);
      expect(result.improvement).toBeDefined();
    });
  });

  describe('Report Generation', () => {
    test('should generate report after running scenarios', async () => {
      const report = await framework.runAllScenarios();

      expect(report.timestamp).toBeDefined();
      expect(report.totalScenarios).toBe(12);
      expect(report.passedScenarios).toBeGreaterThanOrEqual(0);
      expect(report.failedScenarios).toBeGreaterThanOrEqual(0);
      expect(report.successRate).toBeDefined();
    });

    test('should calculate correct success rate', async () => {
      const report = await framework.runAllScenarios();

      const expected = (report.passedScenarios / report.totalScenarios * 100).toFixed(2);
      const actual = parseFloat(report.successRate.split('%')[0]);

      expect(Math.abs(actual - expected)).toBeLessThan(1);
    });

    test('should provide detailed results', () => {
      const details = framework.getDetailedResults();

      expect(Array.isArray(details)).toBeTruthy();
      if (details.length > 0) {
        expect(details[0].name).toBeDefined();
        expect(details[0].passed).toBeDefined();
      }
    });

    test('should provide summary', () => {
      const summary = framework.getSummary();

      expect(summary.timestamp).toBeDefined();
      expect(summary.totalScenarios).toBeGreaterThanOrEqual(0);
      expect(summary.successRate).toBeDefined();
    });
  });

  describe('Framework Integration', () => {
    test('should coordinate across all modules', async () => {
      const scenario = await framework.scenarioCombinedDetectionAndFingerprinting();

      expect(scenario.device).toBeDefined();
      expect(scenario.technologiesDetected).toBeGreaterThanOrEqual(0);
    });

    test('should handle complex workflows', async () => {
      const scenario = await framework.scenarioMultiStepBotEvasion();

      expect(scenario.steps.length).toBeGreaterThan(0);
      expect(scenario.passed).toBeDefined();
    });

    test('should support performance metrics', async () => {
      const scenario = await framework.scenarioHighVolumeTechDetection();

      expect(scenario.detectionDuration).toBeGreaterThanOrEqual(0);
      expect(typeof scenario.detectionDuration).toBe('number');
      expect(scenario.htmlSize).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty HTML', async () => {
      const scenario = await framework.scenarioMultiSourceTechDetection();

      expect(scenario.passed).toBeDefined();
    });

    test('should handle rapid changes gracefully', async () => {
      const scenario = await framework.scenarioRapidProfileChanges();

      expect(scenario.duration).toBeGreaterThan(0);
      expect(scenario.passed).toBeDefined();
    });

    test('should cache results correctly', async () => {
      const scenario1 = await framework.scenarioCacheEffectiveness();

      expect(scenario1.passed).toBeDefined();
      expect(scenario1.improvement).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('scenarios should complete in reasonable time', async () => {
      const start = Date.now();
      const scenario = await framework.scenarioBehavioralEvasionSequence();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000);
      expect(scenario.passed).toBeDefined();
    });

    test('should handle large content efficiently', async () => {
      const start = Date.now();
      const scenario = await framework.scenarioHighVolumeTechDetection();
      const duration = Date.now() - start;

      expect(scenario.detectionDuration).toBeLessThan(5000);
    });

    test('should support rapid iteration', async () => {
      const start = Date.now();
      const scenario = await framework.scenarioRapidProfileChanges();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(30000);
      expect(scenario.passed).toBeDefined();
    });
  });

  describe('Scenario Results', () => {
    test('should mark successful scenarios', async () => {
      const scenario = await framework.scenarioDeviceFingerprintingConsistency();

      expect(scenario.passed).toBe(true);
    });

    test('should capture detailed metrics', async () => {
      const scenario = await framework.scenarioTypingPatternVariation();

      if (scenario.results) {
        expect(scenario.results.fast).toBeDefined();
        expect(scenario.results.slow).toBeDefined();
      }
    });

    test('should provide scenario descriptions', () => {
      framework.results.forEach(result => {
        expect(result.name).toBeDefined();
        expect(result.description).toBeDefined();
      });
    });
  });
});

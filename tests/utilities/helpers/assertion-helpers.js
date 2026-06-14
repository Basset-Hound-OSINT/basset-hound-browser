/**
 * Custom Assertion Helpers for Technology Fingerprinting & Coherence Tests
 * Extends Jest with domain-specific assertions
 */

class AssertionHelpers {
  /**
   * Assert technology detection accuracy
   */
  static assertTechnologyDetected(result, expectedTech) {
    expect(result).toBeDefined();
    expect(result.technologies).toBeDefined();
    expect(Array.isArray(result.technologies)).toBe(true);

    const found = result.technologies.find(t => t.id === expectedTech.id);
    expect(found).toBeDefined();
    expect(found.name).toBe(expectedTech.name);
    expect(found.confidence).toBeGreaterThan(0.7);
    return found;
  }

  /**
   * Assert multiple technologies detected
   */
  static assertTechnologiesDetected(result, expectedTechs) {
    expect(result.technologies).toBeDefined();
    expect(result.technologies.length).toBeGreaterThanOrEqual(expectedTechs.length);

    expectedTechs.forEach(expectedTech => {
      const found = result.technologies.find(t => t.id === expectedTech.id);
      expect(found).toBeDefined();
      expect(found.confidence).toBeGreaterThan(0.7);
    });
  }

  /**
   * Assert confidence score within bounds
   */
  static assertConfidenceScore(result, minConfidence = 0.7, maxConfidence = 1.0) {
    expect(result).toBeDefined();
    if (result.confidence) {
      expect(result.confidence).toBeGreaterThanOrEqual(minConfidence);
      expect(result.confidence).toBeLessThanOrEqual(maxConfidence);
    } else if (result.technologies) {
      result.technologies.forEach(tech => {
        expect(tech.confidence).toBeGreaterThanOrEqual(minConfidence);
        expect(tech.confidence).toBeLessThanOrEqual(maxConfidence);
      });
    }
  }

  /**
   * Assert detection evidence provided
   */
  static assertEvidenceProvided(result) {
    expect(result).toBeDefined();
    expect(result.technologies).toBeDefined();

    result.technologies.forEach(tech => {
      expect(tech.evidence).toBeDefined();
      expect(typeof tech.evidence).toBe('object');
    });
  }

  /**
   * Assert session coherence valid
   */
  static assertCoherenceValid(coherenceResult, minScore = 90) {
    expect(coherenceResult).toBeDefined();
    expect(coherenceResult.overallCoherence).toBeDefined();
    expect(coherenceResult.overallCoherence).toBeGreaterThanOrEqual(minScore);
    expect(coherenceResult.isCoherent).toBe(true);
  }

  /**
   * Assert all coherence layers valid
   */
  static assertAllLayersCoherent(coherenceResult) {
    expect(coherenceResult.layers).toBeDefined();

    const requiredLayers = ['temporal', 'behavioral', 'network', 'device', 'timeline'];
    requiredLayers.forEach(layer => {
      expect(coherenceResult.layers[layer]).toBeDefined();
      expect(coherenceResult.layers[layer].status).toBe('COHERENT');
      expect(coherenceResult.layers[layer].score).toBeGreaterThan(80);
    });
  }

  /**
   * Assert coherence layer specific
   */
  static assertLayerCoherent(coherenceResult, layerName, minScore = 80) {
    expect(coherenceResult.layers[layerName]).toBeDefined();
    expect(coherenceResult.layers[layerName].score).toBeGreaterThanOrEqual(minScore);
    expect(coherenceResult.layers[layerName].status).toBe('COHERENT');
    expect(coherenceResult.layers[layerName].violations).toEqual([]);
  }

  /**
   * Assert coherence layer has violations
   */
  static assertLayerHasViolations(coherenceResult, layerName) {
    expect(coherenceResult.layers[layerName]).toBeDefined();
    expect(coherenceResult.layers[layerName].violations).toBeDefined();
    expect(Array.isArray(coherenceResult.layers[layerName].violations)).toBe(true);
    expect(coherenceResult.layers[layerName].violations.length).toBeGreaterThan(0);
  }

  /**
   * Assert fingerprint drift within acceptable range
   */
  static assertFingerprintDriftAcceptable(coherenceResult, maxDrift = 0.02) {
    expect(coherenceResult.layers.temporal).toBeDefined();
    expect(coherenceResult.layers.temporal.fingerprintDrift).toBeDefined();
    expect(coherenceResult.layers.temporal.fingerprintDrift).toBeLessThanOrEqual(maxDrift);
  }

  /**
   * Assert behavioral pattern consistency
   */
  static assertBehavioralConsistency(coherenceResult, minConsistency = 0.85) {
    expect(coherenceResult.layers.behavioral).toBeDefined();
    expect(coherenceResult.layers.behavioral.patternConsistency).toBeDefined();
    expect(coherenceResult.layers.behavioral.patternConsistency).toBeGreaterThanOrEqual(minConsistency);
  }

  /**
   * Assert no device contradictions
   */
  static assertNoDeviceContradictions(coherenceResult) {
    expect(coherenceResult.layers.device).toBeDefined();
    expect(coherenceResult.layers.device.contradictions).toBe(0);
  }

  /**
   * Assert timeline has no gaps or impossibilities
   */
  static assertTimelineValid(coherenceResult) {
    expect(coherenceResult.layers.timeline).toBeDefined();
    expect(coherenceResult.layers.timeline.gaps).toEqual([]);
    expect(coherenceResult.layers.timeline.impossibilities).toEqual([]);
  }

  /**
   * Assert detection performance
   */
  static assertDetectionPerformance(result, maxTimeMs = 100) {
    expect(result).toBeDefined();
    expect(result.detectionTime).toBeDefined();
    expect(result.detectionTime).toBeLessThan(maxTimeMs);
  }

  /**
   * Assert coherence check performance
   */
  static assertCoherenceCheckPerformance(result, maxTimeMs = 1) {
    expect(result).toBeDefined();
    expect(result.checkTime).toBeDefined();
    expect(result.checkTime).toBeLessThan(maxTimeMs);
  }

  /**
   * Assert correct response structure
   */
  static assertResponseStructure(response, requiredFields = []) {
    expect(response).toBeDefined();
    expect(response.success).toBeDefined();
    expect(response.data).toBeDefined();

    requiredFields.forEach(field => {
      expect(response.data[field]).toBeDefined();
    });
  }

  /**
   * Assert no false positives (undetected technologies should not be in results)
   */
  static assertNoFalsePositives(result, unexpectedTechs) {
    expect(result.technologies).toBeDefined();

    unexpectedTechs.forEach(unexpectedTech => {
      const found = result.technologies.find(t => t.id === unexpectedTech.id);
      expect(found).toBeUndefined();
    });
  }

  /**
   * Assert category breakdown correct
   */
  static assertCategoryBreakdown(result, expectedCategories) {
    expect(result.summary).toBeDefined();
    expect(result.summary.categories).toBeDefined();

    Object.entries(expectedCategories).forEach(([category, count]) => {
      expect(result.summary.categories[category]).toBeGreaterThanOrEqual(count - 1);
    });
  }

  /**
   * Assert detection history tracking
   */
  static assertDetectionHistory(coherenceResult, minHistoryLength = 2) {
    expect(coherenceResult.history).toBeDefined();
    expect(Array.isArray(coherenceResult.history)).toBe(true);
    expect(coherenceResult.history.length).toBeGreaterThanOrEqual(minHistoryLength);
  }

  /**
   * Assert coherence score trend
   */
  static assertCoherenceTrend(coherenceSeries, expectedTrend = 'stable') {
    expect(coherenceSeries).toBeDefined();
    expect(coherenceSeries.length).toBeGreaterThan(1);

    const scores = coherenceSeries.map(c => c.overallCoherence);
    const differences = [];
    for (let i = 1; i < scores.length; i++) {
      differences.push(scores[i] - scores[i - 1]);
    }

    if (expectedTrend === 'stable') {
      const avgDiff = differences.reduce((a, b) => a + Math.abs(b), 0) / differences.length;
      expect(avgDiff).toBeLessThan(5); // Less than 5 point variation
    }
  }

  /**
   * Assert recovery suggestion provided for violation
   */
  static assertRecoverySuggestion(coherenceResult) {
    expect(coherenceResult.recoveryStrategies).toBeDefined();
    expect(Array.isArray(coherenceResult.recoveryStrategies)).toBe(true);

    if (coherenceResult.isCoherent === false) {
      expect(coherenceResult.recoveryStrategies.length).toBeGreaterThan(0);
      coherenceResult.recoveryStrategies.forEach(strategy => {
        expect(strategy.violation).toBeDefined();
        expect(strategy.severity).toBeDefined();
        expect(strategy.suggestion).toBeDefined();
      });
    }
  }

  /**
   * Assert error handling
   */
  static assertErrorHandling(response, expectedError) {
    expect(response).toBeDefined();
    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    if (expectedError) {
      expect(response.error).toContain(expectedError);
    }
  }

  /**
   * Assert concurrent operations handled
   */
  static assertConcurrentHandling(results, expectedCount) {
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(expectedCount);
    results.forEach(result => {
      expect(result.success).toBe(true);
    });
  }
}

module.exports = AssertionHelpers;

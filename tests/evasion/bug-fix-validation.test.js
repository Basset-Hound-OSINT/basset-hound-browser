/**
 * Bug Fix Validation Test Suite
 * Tests for critical fix to _identifyDetectedLayer() method
 * Verifies handling of null, undefined, and empty string inputs
 *
 * Issue: TypeError when vector is null/undefined/empty
 * Fix: Added early null check before processing
 *
 * Created: May 11, 2026
 */

const MultiLayerEvasionCoordinator = require('../../src/evasion/multi-layer-coordinator');

describe('Bug Fix Validation - _identifyDetectedLayer()', () => {
  let coordinator;

  beforeEach(() => {
    coordinator = new MultiLayerEvasionCoordinator();
  });

  // ============================================================================
  // SECTION 1: NULL & UNDEFINED HANDLING
  // ============================================================================

  describe('Null and Undefined Input Handling', () => {
    test('should return null for null vector without TypeError', () => {
      expect(() => {
        const result = coordinator._identifyDetectedLayer(null);
        expect(result).toBeNull();
      }).not.toThrow();
    });

    test('should return null for undefined vector without TypeError', () => {
      expect(() => {
        const result = coordinator._identifyDetectedLayer(undefined);
        expect(result).toBeNull();
      }).not.toThrow();
    });

    test('should return null for empty string without error', () => {
      expect(() => {
        const result = coordinator._identifyDetectedLayer('');
        expect(result).toBeNull();
      }).not.toThrow();
    });
  });

  // ============================================================================
  // SECTION 2: VALID VECTOR DETECTION
  // ============================================================================

  describe('Valid Vector Detection', () => {
    test('should detect TLS layer from ja3 vector', () => {
      const result = coordinator._identifyDetectedLayer('ja3-fingerprint-mismatch');
      expect(result).toBe('tls');
    });

    test('should detect TLS layer from ja4 vector', () => {
      const result = coordinator._identifyDetectedLayer('ja4-profile-detected');
      expect(result).toBe('tls');
    });

    test('should detect TLS layer from http2 vector', () => {
      const result = coordinator._identifyDetectedLayer('http2-settings-anomaly');
      expect(result).toBe('tls');
    });

    test('should detect Browser API layer from canvas vector', () => {
      const result = coordinator._identifyDetectedLayer('canvas-fingerprint-detected');
      expect(result).toBe('browserApi');
    });

    test('should detect Browser API layer from webgl vector', () => {
      const result = coordinator._identifyDetectedLayer('webgl-gpu-profile-mismatch');
      expect(result).toBe('browserApi');
    });

    test('should detect Browser API layer from audio vector', () => {
      const result = coordinator._identifyDetectedLayer('audio-context-oscillator-detected');
      expect(result).toBe('browserApi');
    });

    test('should detect Browser API layer from fonts vector', () => {
      const result = coordinator._identifyDetectedLayer('fonts-enumeration-detected');
      expect(result).toBe('browserApi');
    });

    test('should detect Behavioral layer from mouse vector', () => {
      const result = coordinator._identifyDetectedLayer('mouse-movement-pattern');
      expect(result).toBe('behavioral');
    });

    test('should detect Behavioral layer from typing vector', () => {
      const result = coordinator._identifyDetectedLayer('typing-pattern-detected');
      expect(result).toBe('behavioral');
    });

    test('should detect Behavioral layer from scroll vector', () => {
      const result = coordinator._identifyDetectedLayer('scroll-behavior-anomaly');
      expect(result).toBe('behavioral');
    });

    test('should detect Behavioral layer from timing vector', () => {
      const result = coordinator._identifyDetectedLayer('timing-pattern-mismatch');
      expect(result).toBe('behavioral');
    });

    test('should detect Session layer from cookies vector', () => {
      const result = coordinator._identifyDetectedLayer('cookies-inconsistency');
      expect(result).toBe('session');
    });

    test('should detect Session layer from headers vector', () => {
      const result = coordinator._identifyDetectedLayer('headers-order-mismatch');
      expect(result).toBe('session');
    });

    test('should detect Device layer from storage vector', () => {
      const result = coordinator._identifyDetectedLayer('storage-quota-anomaly');
      expect(result).toBe('device');
    });
  });

  // ============================================================================
  // SECTION 3: CASE INSENSITIVITY
  // ============================================================================

  describe('Case Insensitivity', () => {
    test('should detect uppercase JA4', () => {
      const result = coordinator._identifyDetectedLayer('JA4-FINGERPRINT');
      expect(result).toBe('tls');
    });

    test('should detect mixed case canvas', () => {
      const result = coordinator._identifyDetectedLayer('Canvas-FingerprintJS');
      expect(result).toBe('browserApi');
    });

    test('should detect mixed case mouse', () => {
      const result = coordinator._identifyDetectedLayer('Mouse-Movement-Detected');
      expect(result).toBe('behavioral');
    });
  });

  // ============================================================================
  // SECTION 4: EDGE CASES
  // ============================================================================

  describe('Edge Cases and Boundary Conditions', () => {
    test('should return null for vector with no matching keywords', () => {
      const result = coordinator._identifyDetectedLayer('unknown-detection-vector');
      expect(result).toBeNull();
    });

    test('should return null for whitespace-only vector', () => {
      const result = coordinator._identifyDetectedLayer('   ');
      expect(result).toBeNull();
    });

    test('should handle vector with multiple keywords (returns first match)', () => {
      const result = coordinator._identifyDetectedLayer('canvas-and-webgl-detected');
      expect(result).toBe('browserApi'); // Both are browserApi, so order doesn't matter
    });

    test('should handle very long vector string', () => {
      const longVector = 'ja4-' + 'x'.repeat(1000) + '-fingerprint';
      expect(() => {
        const result = coordinator._identifyDetectedLayer(longVector);
        expect(result).toBe('tls');
      }).not.toThrow();
    });

    test('should handle special characters in vector', () => {
      const result = coordinator._identifyDetectedLayer('ja4!@#$%^&*()-fingerprint');
      expect(result).toBe('tls');
    });
  });

  // ============================================================================
  // SECTION 5: INTEGRATION WITH handleDetectionAttempt
  // ============================================================================

  describe('Integration with Detection Handling', () => {
    test('should safely handle detection with null vector', () => {
      expect(() => {
        coordinator.handleDetectionAttempt({
          source: 'test-service',
          vector: null
        });
      }).not.toThrow();
    });

    test('should safely handle detection with undefined vector', () => {
      expect(() => {
        coordinator.handleDetectionAttempt({
          source: 'test-service',
          vector: undefined
        });
      }).not.toThrow();
    });

    test('should properly handle detection with valid vector', () => {
      expect(() => {
        const result = coordinator.handleDetectionAttempt({
          source: 'test-service',
          vector: 'ja4-fingerprint-detected'
        });
        expect(coordinator.detectionAttempts).toBe(1);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // SECTION 6: PERFORMANCE VALIDATION
  // ============================================================================

  describe('Performance Under Load', () => {
    test('should handle 1000 rapid queries with mixed inputs', () => {
      const testVectors = [
        null, undefined, '', 'ja4-test', 'canvas-test', 'mouse-test',
        'cookies-test', 'storage-test', 'unknown'
      ];

      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        const vector = testVectors[i % testVectors.length];
        coordinator._identifyDetectedLayer(vector);
      }
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be under 100ms
    });

    test('should maintain coherence through rapid detection cycles', () => {
      const vectors = ['ja4-test', 'canvas-test', 'mouse-test'];
      
      for (let i = 0; i < 100; i++) {
        const vector = vectors[i % vectors.length];
        const layer = coordinator._identifyDetectedLayer(vector);
        expect(layer).not.toBeNull();
      }
    });
  });
});

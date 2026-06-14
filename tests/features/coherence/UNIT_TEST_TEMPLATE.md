# Session Coherence Validation - Unit Test Template

Unit tests for 5-layer coherence validation framework.

## Test File Structure

```javascript
const MockDataGenerator = require('../../utilities/helpers/mock-data-generator');
const AssertionHelpers = require('../../utilities/helpers/assertion-helpers');
const CoherenceValidator = require('../../../src/evasion/session-coherence');

describe('Session Coherence - [Layer Name]', () => {
  beforeEach(() => {
    // Setup validator
  });

  afterEach(() => {
    // Cleanup
  });

  // Test Group 1: Temporal Layer (Fingerprint Consistency)
  describe('Temporal Layer - Fingerprint Consistency', () => {
    test('detects stable fingerprints as coherent', () => {
      // Arrange
      const session = {
        sessionId: 'sess_123',
        fingerprints: [
          MockDataGenerator.generateFingerprint(),
          MockDataGenerator.generateFingerprint({ timestamp: Date.now() + 1000 })
        ]
      };

      // Act
      const result = CoherenceValidator.validateTemporalLayer(session);

      // Assert
      AssertionHelpers.assertLayerCoherent(result, 'temporal', 95);
      AssertionHelpers.assertFingerprintDriftAcceptable(result, 0.02);
    });

    test('detects fingerprint drift violations', () => {
      // Arrange
      const session = {
        sessionId: 'sess_123',
        fingerprints: [
          MockDataGenerator.generateFingerprint(),
          MockDataGenerator.generateFingerprint({
            canvas: 'sha256:completely_different_hash',
            webgl: 'sha256:completely_different_hash'
          })
        ]
      };

      // Act
      const result = CoherenceValidator.validateTemporalLayer(session);

      // Assert
      AssertionHelpers.assertLayerHasViolations(result, 'temporal');
      expect(result.layers.temporal.status).toBe('VIOLATION');
    });

    test('accepts minor fingerprint variations within tolerance', () => {
      // Arrange
      const base = MockDataGenerator.generateFingerprint();
      const session = {
        sessionId: 'sess_123',
        fingerprints: [
          base,
          { ...base, timezone: 'UTC-6' } // Minor variation
        ]
      };

      // Act
      const result = CoherenceValidator.validateTemporalLayer(session);

      // Assert
      AssertionHelpers.assertLayerCoherent(result, 'temporal', 90);
    });
  });

  // Test Group 2: Behavioral Layer (Pattern Consistency)
  describe('Behavioral Layer - Pattern Consistency', () => {
    test('validates consistent typing patterns', () => {
      // Arrange
      const behaviors = [
        MockDataGenerator.generateBehavioralMetrics({ typingWPM: 68 }),
        MockDataGenerator.generateBehavioralMetrics({ typingWPM: 70 }),
        MockDataGenerator.generateBehavioralMetrics({ typingWPM: 67 })
      ];

      const session = { sessionId: 'sess_123', behaviors };

      // Act
      const result = CoherenceValidator.validateBehavioralLayer(session);

      // Assert
      AssertionHelpers.assertLayerCoherent(result, 'behavioral', 85);
      AssertionHelpers.assertBehavioralConsistency(result, 0.90);
    });

    test('detects sudden behavioral changes', () => {
      // Arrange
      const behaviors = [
        MockDataGenerator.generateBehavioralMetrics({ typingWPM: 68 }),
        MockDataGenerator.generateBehavioralMetrics({ typingWPM: 150 }) // Sudden increase
      ];

      const session = { sessionId: 'sess_123', behaviors };

      // Act
      const result = CoherenceValidator.validateBehavioralLayer(session);

      // Assert
      AssertionHelpers.assertLayerHasViolations(result, 'behavioral');
    });

    test('tracks mouse movement consistency', () => {
      // Arrange
      const behaviors = [
        MockDataGenerator.generateBehavioralMetrics({ mouseVelocity: 245 }),
        MockDataGenerator.generateBehavioralMetrics({ mouseVelocity: 248 }),
        MockDataGenerator.generateBehavioralMetrics({ mouseVelocity: 242 })
      ];

      const session = { sessionId: 'sess_123', behaviors };

      // Act
      const result = CoherenceValidator.validateBehavioralLayer(session);

      // Assert
      AssertionHelpers.assertLayerCoherent(result, 'behavioral', 80);
    });
  });

  // Test Group 3: Network Layer (Request Pattern Matching)
  describe('Network Layer - Request Pattern Consistency', () => {
    test('validates consistent request headers', () => {
      // Arrange
      const requests = MockDataGenerator.generateRequestSequence(5);
      const session = { sessionId: 'sess_123', requests };

      // Act
      const result = CoherenceValidator.validateNetworkLayer(session);

      // Assert
      AssertionHelpers.assertLayerCoherent(result, 'network', 85);
    });

    test('detects header inconsistencies', () => {
      // Arrange
      const requests = MockDataGenerator.generateRequestSequence(2);
      requests[1].headers['User-Agent'] = 'Different/User/Agent';

      const session = { sessionId: 'sess_123', requests };

      // Act
      const result = CoherenceValidator.validateNetworkLayer(session);

      // Assert
      AssertionHelpers.assertLayerHasViolations(result, 'network');
    });

    test('detects request timing anomalies', () => {
      // Arrange
      const requests = MockDataGenerator.generateRequestSequence(3);
      requests[2].responseTime = 5000; // Sudden spike

      const session = { sessionId: 'sess_123', requests };

      // Act
      const result = CoherenceValidator.validateNetworkLayer(session);

      // Assert
      // May flag as warning but not hard violation
      expect(result.layers.network.score).toBeLessThan(90);
    });
  });

  // Test Group 4: Device Layer (No Contradictions)
  describe('Device Layer - Device Consistency', () => {
    test('detects consistent device claims', () => {
      // Arrange
      const requests = MockDataGenerator.generateRequestSequence(5);
      // All requests claim same device

      const session = { sessionId: 'sess_123', requests };

      // Act
      const result = CoherenceValidator.validateDeviceLayer(session);

      // Assert
      AssertionHelpers.assertLayerCoherent(result, 'device', 90);
      AssertionHelpers.assertNoDeviceContradictions(result);
    });

    test('detects screen resolution contradictions', () => {
      // Arrange
      const requests = MockDataGenerator.generateRequestSequence(2);
      requests[0].fingerprint.screenResolution = '1920x1080';
      requests[1].fingerprint.screenResolution = '1280x720';

      const session = { sessionId: 'sess_123', requests };

      // Act
      const result = CoherenceValidator.validateDeviceLayer(session);

      // Assert
      AssertionHelpers.assertLayerHasViolations(result, 'device');
      expect(result.layers.device.contradictions).toBeGreaterThan(0);
    });

    test('detects browser version contradictions', () => {
      // Arrange
      const requests = MockDataGenerator.generateRequestSequence(2);
      requests[0].fingerprint.userAgent = 'Chrome/114.0';
      requests[1].fingerprint.userAgent = 'Chrome/115.0';

      const session = { sessionId: 'sess_123', requests };

      // Act
      const result = CoherenceValidator.validateDeviceLayer(session);

      // Assert
      AssertionHelpers.assertLayerHasViolations(result, 'device');
    });
  });

  // Test Group 5: Timeline Layer (No Impossibilities)
  describe('Timeline Layer - Event Sequence Validity', () => {
    test('validates normal chronological sequence', () => {
      // Arrange
      const requests = MockDataGenerator.generateRequestSequence(5);
      const session = { sessionId: 'sess_123', requests };

      // Act
      const result = CoherenceValidator.validateTimelineLayer(session);

      // Assert
      AssertionHelpers.assertLayerCoherent(result, 'timeline', 90);
      AssertionHelpers.assertTimelineValid(result);
    });

    test('detects time-travel violations', () => {
      // Arrange
      const requests = MockDataGenerator.generateRequestSequence(3);
      requests[2].timestamp = requests[1].timestamp - 1000; // Earlier timestamp

      const session = { sessionId: 'sess_123', requests };

      // Act
      const result = CoherenceValidator.validateTimelineLayer(session);

      // Assert
      AssertionHelpers.assertLayerHasViolations(result, 'timeline');
    });

    test('detects impossible gaps', () => {
      // Arrange
      const requests = MockDataGenerator.generateRequestSequence(2);
      // Create gap that's impossible for human response
      requests[1].timestamp = new Date(Date.now() + 100000).toISOString();

      const session = { sessionId: 'sess_123', requests };

      // Act
      const result = CoherenceValidator.validateTimelineLayer(session);

      // Assert
      // May flag as warning
      expect(result.layers.timeline.score).toBeLessThan(85);
    });
  });

  // Test Group 6: Overall Coherence Scoring
  describe('Overall Coherence Score', () => {
    test('calculates coherence from all layers', () => {
      // Arrange
      const coherence = MockDataGenerator.generateCoherenceValidation();

      // Act
      const score = CoherenceValidator.calculateOverallScore(coherence);

      // Assert
      expect(score).toBeDefined();
      expect(score).toBeGreaterThan(80);
    });

    test('weights violation severity correctly', () => {
      // Arrange
      const coherence = MockDataGenerator.generateCoherenceValidation();
      coherence.layers.temporal.score = 50; // Critical violation

      // Act
      const score = CoherenceValidator.calculateOverallScore(coherence);

      // Assert
      expect(score).toBeLessThan(85);
    });
  });

  // Test Group 7: Recovery Strategies
  describe('Recovery Strategies', () => {
    test('suggests recovery for fingerprint drift', () => {
      // Arrange
      const violation = MockDataGenerator.generateCoherenceViolation('temporal');

      // Act
      const suggestions = CoherenceValidator.getRecoverySuggestions(violation);

      // Assert
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
    });

    test('suggests recovery for behavioral anomalies', () => {
      // Arrange
      const violation = MockDataGenerator.generateCoherenceViolation('behavioral');

      // Act
      const suggestions = CoherenceValidator.getRecoverySuggestions(violation);

      // Assert
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });
});
```

## Key Test Areas

### 1. Temporal Layer
- Fingerprint stability
- Canvas/WebGL consistency
- User agent changes
- Acceptable drift bounds

### 2. Behavioral Layer
- Typing pattern consistency (WPM, pauses)
- Mouse movement patterns
- Click timing consistency
- Scroll behavior patterns

### 3. Network Layer
- Header consistency
- Request timing patterns
- Bandwidth expectations
- User-Agent consistency

### 4. Device Layer
- Screen resolution consistency
- Browser version consistency
- OS consistency
- No contradictory claims

### 5. Timeline Layer
- Chronological order
- No time-travel events
- No impossible gaps
- Event sequence validity

## Running Unit Tests

```bash
# Run all coherence unit tests
jest tests/features/coherence/unit

# Run specific test file
jest tests/features/coherence/unit/temporal-layer.test.js

# Run with coverage
jest tests/features/coherence/unit --coverage

# Run specific test suite
jest tests/features/coherence/unit -t "Temporal Layer"
```

## Best Practices

1. **Test each layer independently** - Unit tests for single layer
2. **Test layer interactions** - Integration tests for cross-layer
3. **Use realistic sessions** - Generate authentic request sequences
4. **Test boundary conditions** - Just above/below thresholds
5. **Test recovery paths** - Verify suggestions work
6. **Validate scoring** - Ensure scores reflect violations

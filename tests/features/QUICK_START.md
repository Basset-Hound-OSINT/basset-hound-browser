# Quick Start Guide - Feature Testing

Get up and running with the testing infrastructure in 5 minutes.

## 1. Understand Your Test Type (1 min)

Choose based on what you're testing:

| Test Type | Purpose | File | Timeout |
|-----------|---------|------|---------|
| **Unit** | Isolated component testing | `UNIT_TEST_TEMPLATE.md` | <30s |
| **Integration** | WebSocket API + browser | `INTEGRATION_TEST_TEMPLATE.md` | 5-30s |
| **Performance** | Latency, throughput, scalability | `PERFORMANCE_TEST_TEMPLATE.md` | 3-10min |

## 2. Copy the Template (1 min)

```bash
# For unit tests
cp tests/features/fingerprinting/UNIT_TEST_TEMPLATE.md \
   tests/features/fingerprinting/unit/my-test.test.js

# For integration tests
cp tests/features/fingerprinting/INTEGRATION_TEST_TEMPLATE.md \
   tests/features/fingerprinting/integration/my-test.test.js

# For performance tests
cp tests/features/fingerprinting/PERFORMANCE_TEST_TEMPLATE.md \
   tests/features/fingerprinting/performance/my-test.test.js
```

## 3. Customize for Your Feature (2 min)

Open the file and:

```javascript
// 1. Change the describe block to match your feature
describe('Technology Fingerprinting - [Your Feature Name]', () => {

  // 2. Update test group names
  describe('[Your Test Group]', () => {
    test('should do something specific', () => {
      // 3. Arrange: Use MockDataGenerator
      const data = MockDataGenerator.generatePageState();
      
      // 4. Act: Call your code
      const result = MyFeature.process(data);
      
      // 5. Assert: Use AssertionHelpers
      AssertionHelpers.assertTechnologyDetected(result, {
        id: 'wordpress',
        name: 'WordPress'
      });
    });
  });
});
```

## 4. Use Utilities (1 min)

### MockDataGenerator

```javascript
const MockDataGenerator = require('../../utilities/helpers/mock-data-generator');

// Generate test data
const tech = MockDataGenerator.generateTechnologyDetection();
const techs = MockDataGenerator.generateTechnologyStack(5);
const page = MockDataGenerator.generatePageState();
const fingerprint = MockDataGenerator.generateFingerprint();
```

### AssertionHelpers

```javascript
const AssertionHelpers = require('../../utilities/helpers/assertion-helpers');

// Use domain-specific assertions
AssertionHelpers.assertTechnologyDetected(result, tech);
AssertionHelpers.assertCoherenceValid(result, 90);
AssertionHelpers.assertDetectionPerformance(result, 100);
```

## 5. Run Your Test (1 min)

```bash
# Run all unit tests
npm run test:batch:unit

# Run specific file
jest tests/features/fingerprinting/unit/my-test.test.js

# Run with watch mode (auto-rerun on changes)
jest tests/features --watch

# Run with coverage
jest tests/features --coverage
```

---

## Common Test Patterns

### Pattern 1: Testing Tech Detection

```javascript
test('detects WordPress technology', () => {
  // Arrange
  const html = MockDataGenerator.generateSampleHTML('wordpress');
  
  // Act
  const result = TechDetector.detectFromHTML(html);
  
  // Assert
  AssertionHelpers.assertTechnologyDetected(result, {
    id: 'wordpress',
    name: 'WordPress'
  });
});
```

### Pattern 2: Testing Coherence Validation

```javascript
test('validates coherent session', () => {
  // Arrange
  const session = {
    fingerprints: [
      MockDataGenerator.generateFingerprint(),
      MockDataGenerator.generateFingerprint()
    ]
  };
  
  // Act
  const result = CoherenceValidator.validate(session);
  
  // Assert
  AssertionHelpers.assertCoherenceValid(result, 90);
});
```

### Pattern 3: Testing API Integration

```javascript
test('detect_technologies API returns results', (done) => {
  // Arrange
  const command = {
    command: 'detect_technologies',
    params: { tabId: 'tab_123' }
  };

  // Act & Assert
  ws.on('message', (data) => {
    const response = JSON.parse(data);
    AssertionHelpers.assertResponseStructure(response, ['technologies']);
    done();
  });

  ws.send(JSON.stringify(command));
});
```

### Pattern 4: Testing Performance

```javascript
test('detects within 100ms', () => {
  // Arrange
  const data = MockDataGenerator.generatePageState();
  
  // Act
  const start = Date.now();
  const result = TechDetector.detect(data);
  const duration = Date.now() - start;
  
  // Assert
  AssertionHelpers.assertDetectionPerformance(
    { ...result, detectionTime: duration },
    100
  );
});
```

---

## Available Utilities Reference

### MockDataGenerator Methods

```javascript
// Technology detection
.generateTechnologyDetection()         // Single tech
.generateTechnologyStack(count)         // Multiple techs
.generateTechnologySignature()          // Signature entry
.generatePageState(url)                 // Full page
.generateSampleHTML(type)              // HTML sample

// Session data
.generateFingerprint()                 // Device fingerprint
.generateBehavioralMetrics()           // Behavior patterns
.generateRequestSequence(count)         // HTTP requests
.generateHTTPHeaders()                 // HTTP headers

// Coherence data
.generateCoherenceValidation()         // Valid coherence
.generateCoherenceViolation(layer)    // Detected violation
.generateCoherenceTimeSeries(count)   // Time series

// Test scenarios
.generateTestScenario(type)            // Predefined scenario
```

### AssertionHelpers Methods

```javascript
// Technology assertions
.assertTechnologyDetected()            // Single tech found
.assertTechnologiesDetected()          // Multiple techs found
.assertConfidenceScore()               // Confidence bounds
.assertEvidenceProvided()              // Evidence exists
.assertNoFalsePositives()              // No unexpected techs

// Coherence assertions
.assertCoherenceValid()                // Overall valid
.assertAllLayersCoherent()             // All 5 layers valid
.assertLayerCoherent()                 // Specific layer
.assertLayerHasViolations()            // Violations detected
.assertFingerprintDriftAcceptable()   // Drift within bounds
.assertBehavioralConsistency()        // Pattern consistency
.assertNoDeviceContradictions()       // No contradictions
.assertTimelineValid()                 // Timeline OK

// Performance assertions
.assertDetectionPerformance()          // Latency check
.assertCoherenceCheckPerformance()    // Check overhead
.assertResponseStructure()             // Response format
.assertErrorHandling()                 // Error response
.assertConcurrentHandling()            // Concurrent ops
```

---

## Tips & Tricks

### Tip 1: Use Descriptive Test Names
```javascript
// Good
test('detects WordPress from X-Powered-By header', () => {...});

// Avoid
test('detection works', () => {...});
```

### Tip 2: One Assertion Per Test (When Possible)
```javascript
// Good: Single focused assertion
test('detects WordPress', () => {
  AssertionHelpers.assertTechnologyDetected(result, wordpress);
});

// Avoid: Multiple unrelated assertions
test('detects WordPress and has confidence', () => {
  AssertionHelpers.assertTechnologyDetected(result, wordpress);
  AssertionHelpers.assertConfidenceScore(result, 0.85);
});
```

### Tip 3: Use Arrange-Act-Assert Structure
```javascript
test('should do X', () => {
  // Arrange: Set up test data
  const input = MockDataGenerator.generatePageState();
  
  // Act: Execute code
  const result = Feature.process(input);
  
  // Assert: Verify result
  AssertionHelpers.assertFeatureWorked(result);
});
```

### Tip 4: Group Related Tests
```javascript
describe('Technology Fingerprinting', () => {
  describe('Basic Detection', () => {
    test('detects WordPress', () => {...});
    test('detects React', () => {...});
  });
  
  describe('Error Handling', () => {
    test('handles null input', () => {...});
    test('handles empty HTML', () => {...});
  });
});
```

### Tip 5: Use Watch Mode During Development
```bash
# Auto-rerun tests as you edit
jest tests/features --watch

# Runs only changed test files, much faster
```

---

## Common Errors & Fixes

### Error: `Cannot find module 'MockDataGenerator'`
**Fix:** Check import path is relative:
```javascript
const MockDataGenerator = require('../../utilities/helpers/mock-data-generator');
```

### Error: Test timeout
**Fix:** Increase timeout for slow tests:
```javascript
test('slow operation', (done) => {
  // test code
}, 30000); // 30 second timeout
```

Or globally in Jest config:
```bash
jest tests/features --testTimeout=30000
```

### Error: WebSocket connection refused
**Fix:** Ensure server is running in another terminal:
```bash
npm run start
```

### Error: `ReferenceError: process is not defined`
**Fix:** Jest defaults to Node environment. Make sure Jest config has:
```json
"testEnvironment": "node"
```

---

## Running Different Test Suites

```bash
# All tests
npm run test:batch:all

# Just unit tests (fast)
npm run test:batch:unit

# Just integration tests
npm run test:batch:integration

# Just performance tests
npm run test:batch:performance

# Critical path (unit + core integration)
npm run test:batch:critical

# With coverage report
npm run test:batch:all:coverage

# List available suites
npm run test:batch:list
```

---

## Next Steps

1. **Pick a feature** to test (e.g., basic tech detection)
2. **Choose test type** (unit/integration/performance)
3. **Copy template** to appropriate directory
4. **Customize** for your feature
5. **Run test** to verify it works
6. **Iterate** adding more test cases

---

## Need More Details?

- **Full README:** `tests/features/README.md`
- **Unit Test Guide:** `tests/features/fingerprinting/UNIT_TEST_TEMPLATE.md`
- **Integration Guide:** `tests/features/fingerprinting/INTEGRATION_TEST_TEMPLATE.md`
- **Performance Guide:** `tests/features/fingerprinting/PERFORMANCE_TEST_TEMPLATE.md`
- **MockDataGenerator:** `tests/utilities/helpers/mock-data-generator.js`
- **AssertionHelpers:** `tests/utilities/helpers/assertion-helpers.js`

---

**You're ready to write tests!** 🚀

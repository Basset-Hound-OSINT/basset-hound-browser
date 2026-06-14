# Feature Testing Infrastructure

Complete testing framework for Technology Fingerprinting and Session Coherence validation features.

## Overview

This directory contains the testing infrastructure for two major feature sets:

1. **Technology Fingerprinting** (`./fingerprinting/`)
   - Multi-layer technology detection (headers, HTML, JavaScript, etc.)
   - 500+ technology signatures
   - Confidence scoring with evidence
   - WebSocket API integration

2. **Session Coherence Validation** (`./coherence/`)
   - 5-layer coherence validation
   - Temporal consistency (fingerprints)
   - Behavioral pattern matching
   - Device claim validation
   - Timeline impossibility detection

## Directory Structure

```
tests/features/
├── README.md (this file)
├── fingerprinting/
│   ├── UNIT_TEST_TEMPLATE.md
│   ├── INTEGRATION_TEST_TEMPLATE.md
│   ├── PERFORMANCE_TEST_TEMPLATE.md
│   ├── unit/                        # Unit tests (created by developers)
│   │   ├── basic-detection.test.js
│   │   ├── accuracy-validation.test.js
│   │   └── ... (more tests)
│   ├── integration/                # Integration tests (WebSocket API)
│   │   ├── websocket-api.test.js
│   │   ├── browser-session.test.js
│   │   └── ... (more tests)
│   └── performance/               # Performance & load tests
│       ├── latency-benchmarks.test.js
│       ├── throughput-testing.test.js
│       └── ... (more tests)
├── coherence/
│   ├── UNIT_TEST_TEMPLATE.md
│   ├── INTEGRATION_TEST_TEMPLATE.md (same structure)
│   ├── unit/
│   │   ├── temporal-layer.test.js
│   │   ├── behavioral-layer.test.js
│   │   ├── network-layer.test.js
│   │   ├── device-layer.test.js
│   │   ├── timeline-layer.test.js
│   │   └── ... (more tests)
│   ├── integration/
│   │   ├── coherence-validation.test.js
│   │   └── ... (more tests)
│   └── performance/
│       ├── validation-latency.test.js
│       └── ... (more tests)
└── ../utilities/
    ├── helpers/
    │   ├── mock-data-generator.js  # Realistic test data
    │   └── assertion-helpers.js     # Domain-specific assertions
    └── fixtures/
        ├── sample-pages/
        ├── technology-signatures/
        └── mock-responses/
```

## Getting Started

### For Unit Tests

1. **Read the template**: `fingerprinting/UNIT_TEST_TEMPLATE.md`
2. **Create test file**: `tests/features/fingerprinting/unit/my-feature.test.js`
3. **Copy template structure** into your file
4. **Customize for your feature**:
   - Import relevant modules
   - Adapt test scenarios
   - Use `MockDataGenerator` for test data
5. **Run tests**: `npm run test:batch:unit`

### For Integration Tests

1. **Read the template**: `fingerprinting/INTEGRATION_TEST_TEMPLATE.md`
2. **Create test file**: `tests/features/fingerprinting/integration/my-feature.test.js`
3. **Set up WebSocket connection** to test server
4. **Write command sequences** that test real API behavior
5. **Validate responses** using `AssertionHelpers`
6. **Run tests**: `npm run test:batch:integration`

### For Performance Tests

1. **Read the template**: `fingerprinting/PERFORMANCE_TEST_TEMPLATE.md`
2. **Create test file**: `tests/features/fingerprinting/performance/my-benchmark.test.js`
3. **Define performance targets** (latency, throughput)
4. **Measure operations** using provided utilities
5. **Collect and analyze metrics** (avg, P50, P95, P99)
6. **Run tests**: `npm run test:batch:performance`

## Test Utilities

### MockDataGenerator

Generate realistic test data for consistent, repeatable tests.

```javascript
const MockDataGenerator = require('../../utilities/helpers/mock-data-generator');

// Technology detection
MockDataGenerator.generateTechnologyDetection(); // Single tech
MockDataGenerator.generateTechnologyStack(5);     // Multiple techs
MockDataGenerator.generateTechnologySignature();  // Signature DB entry

// Session data
MockDataGenerator.generateFingerprint();          // Device fingerprint
MockDataGenerator.generateBehavioralMetrics();    // Behavioral data
MockDataGenerator.generateRequestSequence(10);    // Request sequence

// Coherence validation
MockDataGenerator.generateCoherenceValidation();  // Valid coherence result
MockDataGenerator.generateCoherenceViolation();   // Coherence violation
MockDataGenerator.generateCoherenceTimeSeries();  // Time series

// Page/HTTP data
MockDataGenerator.generatePageState();            // Full page state
MockDataGenerator.generateSampleHTML('wordpress'); // Sample HTML
MockDataGenerator.generateHTTPHeaders();          // HTTP headers

// Test scenarios
MockDataGenerator.generateTestScenario('basic');  // Predefined scenario
```

### AssertionHelpers

Domain-specific assertions for clean, readable tests.

```javascript
const AssertionHelpers = require('../../utilities/helpers/assertion-helpers');

// Technology detection assertions
AssertionHelpers.assertTechnologyDetected(result, tech);
AssertionHelpers.assertTechnologiesDetected(result, [tech1, tech2]);
AssertionHelpers.assertConfidenceScore(result, 0.85, 1.0);
AssertionHelpers.assertEvidenceProvided(result);
AssertionHelpers.assertNoFalsePositives(result, unexpected);
AssertionHelpers.assertCategoryBreakdown(result, { cms: 1 });

// Coherence assertions
AssertionHelpers.assertCoherenceValid(result, 90);
AssertionHelpers.assertAllLayersCoherent(result);
AssertionHelpers.assertLayerCoherent(result, 'temporal');
AssertionHelpers.assertLayerHasViolations(result, 'temporal');
AssertionHelpers.assertFingerprintDriftAcceptable(result);
AssertionHelpers.assertBehavioralConsistency(result);
AssertionHelpers.assertNoDeviceContradictions(result);
AssertionHelpers.assertTimelineValid(result);

// Performance/response assertions
AssertionHelpers.assertDetectionPerformance(result, 100); // <100ms
AssertionHelpers.assertCoherenceCheckPerformance(result, 1); // <1ms
AssertionHelpers.assertResponseStructure(response, ['data']);
AssertionHelpers.assertErrorHandling(response, 'expected error');
AssertionHelpers.assertConcurrentHandling(results, 10);
```

## Running Tests

### Quick Reference

```bash
# Unit tests only (fast feedback)
npm run test:batch:unit                    # ~45 seconds

# Integration tests (WebSocket API)
npm run test:batch:integration             # ~2 minutes

# Performance benchmarks
npm run test:batch:performance             # ~5 minutes

# Critical path (unit + core integration)
npm run test:batch:critical                # ~2 minutes

# All feature tests
npm run test:batch:all                     # ~20 minutes

# With coverage report
npm run test:batch:all:coverage            # ~22 minutes
```

### Specific Test Selection

```bash
# Run specific directory
jest tests/features/fingerprinting/unit

# Run specific test file
jest tests/features/fingerprinting/unit/basic-detection.test.js

# Run tests matching pattern
jest tests/features -t "Technology.*detection"

# Run with verbose output
jest tests/features --verbose

# Run in watch mode (for development)
jest tests/features --watch

# Run with extended timeout (for slow tests)
jest tests/features --testTimeout=30000
```

## Test Organization

### Unit Tests
- **Location**: `tests/features/[feature]/unit/`
- **Purpose**: Isolated component testing
- **Dependencies**: Mocked or stubbed
- **Runtime**: <30 seconds total
- **Example**: `basic-detection.test.js`

### Integration Tests
- **Location**: `tests/features/[feature]/integration/`
- **Purpose**: WebSocket API and browser session testing
- **Dependencies**: Real server, actual API
- **Runtime**: 1-5 minutes per test
- **Example**: `websocket-api.test.js`

### Performance Tests
- **Location**: `tests/features/[feature]/performance/`
- **Purpose**: Latency, throughput, scalability
- **Dependencies**: Performance baseline
- **Runtime**: 3-10 minutes
- **Example**: `latency-benchmarks.test.js`

## Feature-Specific Test Guides

### Technology Fingerprinting Tests

Test modules:
- `basic-detection.test.js` - Core detection functionality
- `accuracy-validation.test.js` - Confidence scoring, false positives
- `signature-expansion.test.js` - New signature validation
- `edge-cases.test.js` - Empty HTML, malformed input
- `websocket-integration.test.js` - API integration
- `performance-benchmarks.test.js` - Latency/throughput
- `load-testing.test.js` - Concurrent requests

Key test scenarios:
- Detect WordPress from headers, HTML, patterns
- Detect framework stacks (5+ technologies)
- Validate confidence scores (0.85+ for definitive)
- Avoid false positives
- <100ms detection time
- Concurrent detection requests
- Various tech categories (CMS, frameworks, servers, CDN, analytics)

### Session Coherence Tests

Test modules:
- `temporal-layer.test.js` - Fingerprint consistency
- `behavioral-layer.test.js` - Pattern consistency
- `network-layer.test.js` - Request patterns
- `device-layer.test.js` - Device contradictions
- `timeline-layer.test.js` - Event sequence
- `overall-scoring.test.js` - Coherence aggregation
- `violation-detection.test.js` - Detecting violations
- `recovery-strategies.test.js` - Recovery suggestions

Key test scenarios:
- Stable fingerprints (drift <2%)
- Consistent behaviors (WPM, mouse patterns)
- Matching network patterns
- No device contradictions
- Valid event timeline
- Overall coherence score (0-100)
- Violation detection and reporting
- Recovery suggestions

## Best Practices

### Writing Tests

1. **Use Arrange-Act-Assert pattern**
   ```javascript
   test('should do something', () => {
     // Arrange: Set up test data
     const input = MockDataGenerator.generateTechnologyDetection();
     
     // Act: Execute
     const result = detector.process(input);
     
     // Assert: Verify
     AssertionHelpers.assertTechnologyDetected(result, input);
   });
   ```

2. **One assertion per test** (when possible)
   ```javascript
   // Good: Single assertion
   test('should detect WordPress', () => {
     const result = detect(wordpress_page);
     AssertionHelpers.assertTechnologyDetected(result, { id: 'wordpress' });
   });
   
   // Avoid: Multiple unrelated assertions
   test('should do many things', () => {
     expect(a).toBe(b);
     expect(c).toBe(d);
     expect(e).toBe(f);
   });
   ```

3. **Use descriptive test names**
   ```javascript
   // Good
   test('detects WordPress from X-Powered-By header', () => {...});
   
   // Avoid
   test('detection works', () => {...});
   ```

4. **Test success AND failure cases**
   ```javascript
   describe('Feature', () => {
     test('succeeds with valid input', () => {...});
     test('fails gracefully with invalid input', () => {...});
     test('fails gracefully with edge case', () => {...});
   });
   ```

5. **Use mock data for consistency**
   ```javascript
   // Good: Same data each run
   const data = MockDataGenerator.generatePageState();
   
   // Avoid: Random data that's hard to debug
   const data = { /* random values */ };
   ```

### Performance Testing

1. **Establish baselines** before optimizing
2. **Measure multiple iterations** for statistical validity
3. **Report percentiles** (P50, P95, P99) not just average
4. **Test with realistic data** volumes
5. **Monitor memory** for leaks
6. **Detect regressions** against baselines

### Maintenance

1. **Keep templates updated** as API changes
2. **Update baselines** when performance targets change
3. **Review failing tests** before fixing the code
4. **Maintain mock data** realism
5. **Document new assertions** in AssertionHelpers

## Coverage Goals

| Category | Target | Minimum |
|----------|--------|---------|
| Lines | >90% | >85% |
| Branches | >85% | >80% |
| Functions | >90% | >85% |
| Statements | >90% | >85% |

## Troubleshooting

### Tests timeout
```bash
# Increase timeout for slow operations
jest tests/features --testTimeout=30000
```

### WebSocket connection fails
- Verify server is running on `ws://localhost:8765`
- Check firewall/port availability
- Run integration tests with `--verbose` for diagnostics

### Performance tests fail
- Check system load (close other apps)
- Run in isolation: `jest [specific test file]`
- Compare against baseline to detect regressions

### Mock data doesn't match reality
- Review generated data vs actual API responses
- Update MockDataGenerator with realistic values
- Add new mock data type for edge cases

## Continuous Integration

Tests are designed for CI/CD pipelines:

```bash
# Fast feedback (5 minutes)
npm run test:batch:critical

# Full validation (20 minutes)
npm run test:batch:all:coverage

# With JUnit reporter for CI
jest --reporters=default --reporters=jest-junit
```

## Adding New Features

When adding new detection or coherence features:

1. **Create unit test file** in appropriate `/unit/` directory
2. **Use the template** as starting point
3. **Follow naming convention**: `feature-name.test.js`
4. **Add integration tests** in `/integration/` directory
5. **Add performance tests** if performance-critical
6. **Update this README** with new test modules
7. **Extend MockDataGenerator** if new data types needed
8. **Extend AssertionHelpers** if new assertions needed

## Resources

- **Jest Documentation**: https://jestjs.io/docs/getting-started
- **Testing Best Practices**: See individual TEMPLATE files
- **Mock Data Guide**: See `utilities/helpers/mock-data-generator.js`
- **Assertion Guide**: See `utilities/helpers/assertion-helpers.js`

## Support

For issues or questions:
1. Review the appropriate TEMPLATE file for your test type
2. Check MockDataGenerator and AssertionHelpers documentation
3. Look for similar tests in the same directory
4. Run tests with `--verbose` flag for diagnostics

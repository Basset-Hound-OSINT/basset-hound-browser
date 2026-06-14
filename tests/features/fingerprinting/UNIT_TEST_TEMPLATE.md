# Technology Fingerprinting - Unit Test Template

This template provides a structure for writing unit tests for technology detection features.

## Test File Structure

```javascript
const MockDataGenerator = require('../../utilities/helpers/mock-data-generator');
const AssertionHelpers = require('../../utilities/helpers/assertion-helpers');
const TechDetector = require('../../../src/analysis/tech-detector');

describe('Technology Fingerprinting - [Feature Name]', () => {
  // Setup & Teardown
  beforeEach(() => {
    // Initialize any mocks or state
  });

  afterEach(() => {
    // Cleanup after each test
  });

  // Test Group 1: Basic Detection
  describe('Basic Detection', () => {
    test('detects single technology from headers', () => {
      // Arrange
      const headers = MockDataGenerator.generateHTTPHeaders(true);
      
      // Act
      const result = TechDetector.detectFromHeaders(headers);
      
      // Assert
      AssertionHelpers.assertTechnologyDetected(result, {
        id: 'wordpress',
        name: 'WordPress'
      });
    });

    test('detects multiple technologies from HTML', () => {
      // Arrange
      const html = MockDataGenerator.generateSampleHTML('wordpress');
      
      // Act
      const result = TechDetector.detectFromHTML(html);
      
      // Assert
      AssertionHelpers.assertTechnologiesDetected(result, [
        { id: 'wordpress', name: 'WordPress' }
      ]);
    });
  });

  // Test Group 2: Accuracy & Confidence
  describe('Detection Accuracy', () => {
    test('reports high confidence for definitive detection', () => {
      // Arrange
      const data = MockDataGenerator.generatePageState();
      
      // Act
      const result = TechDetector.detect(data);
      
      // Assert
      AssertionHelpers.assertConfidenceScore(result, 0.85);
    });

    test('avoids false positives', () => {
      // Arrange
      const data = MockDataGenerator.generatePageState();
      const unexpectedTechs = [
        { id: 'drupal', name: 'Drupal' }
      ];
      
      // Act
      const result = TechDetector.detect(data);
      
      // Assert
      AssertionHelpers.assertNoFalsePositives(result, unexpectedTechs);
    });
  });

  // Test Group 3: Performance
  describe('Detection Performance', () => {
    test('detects technology within 100ms', () => {
      // Arrange
      const data = MockDataGenerator.generatePageState();
      const startTime = Date.now();
      
      // Act
      const result = TechDetector.detect(data);
      const duration = Date.now() - startTime;
      
      // Assert
      AssertionHelpers.assertDetectionPerformance(
        { ...result, detectionTime: duration },
        100
      );
    });
  });

  // Test Group 4: Edge Cases
  describe('Edge Cases', () => {
    test('handles empty HTML gracefully', () => {
      // Arrange
      const emptyHtml = '<html></html>';
      
      // Act
      const result = TechDetector.detectFromHTML(emptyHtml);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.technologies).toBeDefined();
    });

    test('handles malformed HTML', () => {
      // Arrange
      const malformedHtml = '<html><body><incomplete tag';
      
      // Act
      const result = TechDetector.detectFromHTML(malformedHtml);
      
      // Assert
      expect(result).toBeDefined();
    });
  });
});
```

## Key Components

### 1. Setup & Teardown
- **beforeEach**: Initialize test fixtures, reset mocks
- **afterEach**: Clean up resources, verify expectations

### 2. Test Groups (describe blocks)
Organize tests by feature area:
- **Basic Detection**: Core functionality tests
- **Accuracy & Confidence**: Validation and scoring
- **Performance**: Timing and resource usage
- **Edge Cases**: Boundary conditions and error handling

### 3. Test Pattern (Arrange-Act-Assert)
```javascript
test('should do something', () => {
  // Arrange: Set up test data
  const input = MockDataGenerator.generateTechnologyDetection();
  
  // Act: Execute the code being tested
  const result = detector.process(input);
  
  // Assert: Verify the results
  AssertionHelpers.assertTechnologyDetected(result, input);
});
```

### 4. Assertions
Use `AssertionHelpers` for domain-specific assertions:
- `assertTechnologyDetected(result, tech)` - Single tech found
- `assertTechnologiesDetected(result, techs)` - Multiple techs found
- `assertConfidenceScore(result, min, max)` - Confidence bounds
- `assertDetectionPerformance(result, maxMs)` - Performance check
- `assertNoFalsePositives(result, techs)` - Avoid false positives

## Running Unit Tests

```bash
# Run all unit tests for fingerprinting
npm run test:batch:unit

# Run specific test file
jest tests/features/fingerprinting/unit/my-test.test.js

# Run with coverage
jest tests/features/fingerprinting/unit --coverage

# Run with verbose output
jest tests/features/fingerprinting/unit --verbose
```

## Best Practices

1. **One assertion per test** where possible
2. **Descriptive test names** that explain what is being tested
3. **Use mock data** from MockDataGenerator for consistency
4. **Clean up resources** in afterEach
5. **Test both success and failure cases**
6. **Keep tests fast** - unit tests should run in milliseconds
7. **Avoid external dependencies** - mock or stub them
8. **Test edge cases** - empty input, malformed data, etc.

## Common Test Patterns

### Testing Technology Detection
```javascript
test('should detect React framework', () => {
  const html = MockDataGenerator.generateSampleHTML('react');
  const result = TechDetector.detectFromHTML(html);
  AssertionHelpers.assertTechnologyDetected(result, {
    id: 'react',
    name: 'React'
  });
});
```

### Testing Confidence Scoring
```javascript
test('should report high confidence for definitive match', () => {
  const data = MockDataGenerator.generatePageState();
  const result = TechDetector.detect(data);
  AssertionHelpers.assertConfidenceScore(result, 0.85, 1.0);
});
```

### Testing Error Handling
```javascript
test('should handle null input gracefully', () => {
  const result = TechDetector.detectFromHTML(null);
  AssertionHelpers.assertErrorHandling(result, 'Invalid input');
});
```

## Coverage Goals

- **Lines:** >90% for detection engine
- **Branches:** >85% for conditional logic
- **Functions:** >90% for exported APIs
- **Statements:** >90% for production code

## Adding New Tests

1. Create new file: `tests/features/fingerprinting/unit/my-feature.test.js`
2. Import helpers: `MockDataGenerator`, `AssertionHelpers`
3. Follow template structure above
4. Run tests: `npm run test:batch:unit`
5. Check coverage: `jest --coverage`

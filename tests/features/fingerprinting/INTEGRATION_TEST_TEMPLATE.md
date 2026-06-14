# Technology Fingerprinting - Integration Test Template

Integration tests validate technology detection across real browser sessions and WebSocket API.

## Test File Structure

```javascript
const WebSocket = require('ws');
const MockDataGenerator = require('../../utilities/helpers/mock-data-generator');
const AssertionHelpers = require('../../utilities/helpers/assertion-helpers');

describe('Technology Fingerprinting - WebSocket Integration', () => {
  let ws;
  const WS_URL = 'ws://localhost:8765';

  beforeEach((done) => {
    // Connect to WebSocket server
    ws = new WebSocket(WS_URL);
    ws.on('open', () => done());
    ws.on('error', (err) => done(err));
  });

  afterEach((done) => {
    // Close WebSocket connection
    if (ws) {
      ws.close();
      ws.on('close', () => done());
    } else {
      done();
    }
  });

  // Test Group 1: WebSocket API
  describe('WebSocket API Integration', () => {
    test('detect_technologies command returns results', (done) => {
      // Arrange
      const command = {
        command: 'detect_technologies',
        params: {
          tabId: 'tab_123',
          includeRawEvidence: true
        }
      };

      // Act & Assert
      ws.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.requestId === command.requestId) {
          // Assert
          AssertionHelpers.assertResponseStructure(response, [
            'technologies',
            'summary',
            'detectionTime'
          ]);
          AssertionHelpers.assertDetectionPerformance(response.data, 100);
          done();
        }
      });

      ws.send(JSON.stringify(command));
    }, 10000); // 10 second timeout

    test('detect_technologies_from_html works with static data', (done) => {
      // Arrange
      const html = MockDataGenerator.generateSampleHTML('wordpress');
      const command = {
        command: 'detect_technologies_from_html',
        params: {
          html: html,
          url: 'https://example.com'
        }
      };

      // Act & Assert
      ws.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.requestId === command.requestId) {
          AssertionHelpers.assertResponseStructure(response, ['technologies']);
          AssertionHelpers.assertTechnologyDetected(response.data, {
            id: 'wordpress',
            name: 'WordPress'
          });
          done();
        }
      });

      ws.send(JSON.stringify(command));
    });
  });

  // Test Group 2: Real Browser Sessions
  describe('Real Browser Integration', () => {
    test('detects technologies in live navigation', (done) => {
      // Arrange
      const sequence = [
        {
          command: 'open_tab',
          params: { url: 'https://wordpress.org' }
        },
        {
          command: 'wait',
          params: { duration: 2000 }
        },
        {
          command: 'detect_technologies',
          params: { tabId: 'tab_123' }
        }
      ];

      let stepIndex = 0;

      // Act & Assert
      ws.on('message', (data) => {
        const response = JSON.parse(data);

        if (stepIndex === 2) {
          // Last step - check detection results
          AssertionHelpers.assertResponseStructure(response, ['technologies']);
          AssertionHelpers.assertTechnologiesDetected(response.data, [
            { id: 'wordpress', name: 'WordPress' }
          ]);
          done();
        }

        // Send next command
        if (stepIndex < sequence.length - 1) {
          stepIndex++;
          ws.send(JSON.stringify({
            ...sequence[stepIndex],
            requestId: `req_${stepIndex}`
          }));
        }
      });

      // Start sequence
      ws.send(JSON.stringify({
        ...sequence[0],
        requestId: 'req_0'
      }));
    }, 15000);

    test('maintains detection consistency across multiple page loads', (done) => {
      // Arrange
      const pages = [
        'https://wordpress.org',
        'https://wordpress.com',
        'https://wordpress.org/plugins/'
      ];
      const results = [];

      // Act & Assert
      const detectNext = (index) => {
        if (index >= pages.length) {
          // Verify consistency
          expect(results.length).toBe(pages.length);
          results.forEach(result => {
            AssertionHelpers.assertTechnologyDetected(result, {
              id: 'wordpress',
              name: 'WordPress'
            });
          });
          done();
          return;
        }

        const command = {
          command: 'navigate',
          params: { url: pages[index] }
        };

        ws.on('message', (data) => {
          const response = JSON.parse(data);
          if (response.command === 'detect_technologies') {
            results.push(response.data);
            detectNext(index + 1);
          }
        });

        ws.send(JSON.stringify(command));
      };

      detectNext(0);
    }, 20000);
  });

  // Test Group 3: Accuracy Validation
  describe('Detection Accuracy', () => {
    test('accurately detects technology stack', (done) => {
      // Arrange
      const expectedStack = MockDataGenerator.generateTechnologyStack(5);
      const command = {
        command: 'detect_technologies',
        params: {
          tabId: 'tab_123',
          confidenceThreshold: 0.70
        }
      };

      // Act & Assert
      ws.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.requestId === command.requestId) {
          AssertionHelpers.assertTechnologiesDetected(response.data, expectedStack);
          AssertionHelpers.assertCategoryBreakdown(response.data.summary, {
            frameworks: 1,
            cms: 1,
            servers: 1
          });
          done();
        }
      });

      ws.send(JSON.stringify(command));
    });
  });

  // Test Group 4: Performance
  describe('Performance Under Load', () => {
    test('handles rapid detection requests', (done) => {
      // Arrange
      const requestCount = 10;
      let responseCount = 0;

      // Act & Assert
      ws.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.command === 'detect_technologies') {
          responseCount++;
          AssertionHelpers.assertDetectionPerformance(response.data, 100);

          if (responseCount === requestCount) {
            done();
          }
        }
      });

      // Send multiple requests rapidly
      for (let i = 0; i < requestCount; i++) {
        ws.send(JSON.stringify({
          command: 'detect_technologies',
          params: { tabId: `tab_${i}` },
          requestId: `req_${i}`
        }));
      }
    });

    test('handles concurrent technology detection', (done) => {
      // Arrange
      const concurrentCount = 5;
      const results = [];

      // Act & Assert
      ws.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.command === 'detect_technologies') {
          results.push(response);

          if (results.length === concurrentCount) {
            AssertionHelpers.assertConcurrentHandling(results, concurrentCount);
            done();
          }
        }
      });

      // Send concurrent requests
      for (let i = 0; i < concurrentCount; i++) {
        ws.send(JSON.stringify({
          command: 'detect_technologies',
          params: { tabId: `tab_${i}` },
          requestId: `req_${i}`
        }));
      }
    });
  });

  // Test Group 5: Error Handling
  describe('Error Handling', () => {
    test('handles invalid tab ID gracefully', (done) => {
      // Arrange
      const command = {
        command: 'detect_technologies',
        params: { tabId: 'invalid_tab_id' }
      };

      // Act & Assert
      ws.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.requestId === command.requestId) {
          expect(response.success).toBe(false);
          done();
        }
      });

      ws.send(JSON.stringify(command));
    });

    test('handles missing parameters', (done) => {
      // Arrange
      const command = {
        command: 'detect_technologies',
        params: {}
      };

      // Act & Assert
      ws.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.requestId === command.requestId) {
          AssertionHelpers.assertErrorHandling(response);
          done();
        }
      });

      ws.send(JSON.stringify(command));
    });
  });
});
```

## Key Integration Points

### 1. WebSocket Communication
- Use actual WebSocket connection to test server
- Send commands as JSON
- Parse responses and validate structure

### 2. Browser Session Lifecycle
- Open tab, navigate, detect technologies
- Verify consistency across multiple pages
- Clean up sessions after tests

### 3. Real Data
- Use real URLs for validation (with timeouts)
- Test against known technology sites
- Verify results match expected stack

## Running Integration Tests

```bash
# Run all integration tests for fingerprinting
npm run test:batch:integration

# Run specific test file
jest tests/features/fingerprinting/integration/my-test.test.js

# Run with extended timeout for real pages
jest tests/features/fingerprinting/integration --testTimeout=30000

# Run with verbose output
jest tests/features/fingerprinting/integration --verbose
```

## Best Practices

1. **Use proper timeouts** - Real browser operations take time
2. **Clean up resources** - Close WebSocket connections
3. **Test realistic scenarios** - Navigate pages, detect techs
4. **Validate full API contract** - Request/response structure
5. **Handle timing issues** - Use callbacks/promises
6. **Test error paths** - Invalid input, missing data
7. **Concurrent testing** - Multiple simultaneous requests

## Common Integration Patterns

### Testing WebSocket Command
```javascript
test('command returns expected response', (done) => {
  ws.on('message', (data) => {
    const response = JSON.parse(data);
    expect(response.success).toBe(true);
    done();
  });

  ws.send(JSON.stringify({
    command: 'detect_technologies',
    params: { tabId: 'tab_123' }
  }));
});
```

### Testing Browser Navigation Sequence
```javascript
test('sequence of operations succeeds', (done) => {
  const operations = [
    { command: 'open_tab', params: { url: 'https://example.com' } },
    { command: 'wait', params: { duration: 2000 } },
    { command: 'detect_technologies', params: { tabId: 'tab_1' } }
  ];

  // Execute sequentially and verify
});
```

### Testing Concurrent Operations
```javascript
test('handles concurrent requests', (done) => {
  const count = 10;
  let received = 0;

  ws.on('message', (data) => {
    received++;
    if (received === count) done();
  });

  for (let i = 0; i < count; i++) {
    ws.send(JSON.stringify({ command: '...', params: {...} }));
  }
});
```

## Test Timeouts

- **Quick operations:** 5,000ms (navigate, detect)
- **Real pages:** 15,000ms (actual network)
- **Performance tests:** 20,000ms (multiple operations)
- **Load tests:** 30,000ms+ (high concurrency)

Adjust with: `test('name', (done) => {...}, TIMEOUT_MS)`

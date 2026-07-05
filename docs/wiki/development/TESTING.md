# Testing Guide

Test organization and running tests.

## Test Structure

```
tests/
├── unit/                # Unit tests
│   ├── evasion/
│   ├── proxy/
│   └── ...
├── integration/         # Integration tests
│   ├── websocket/
│   └── ...
└── results/             # Test output
```

## Run Tests

Run all tests:

```bash
npm test
```

Run specific suite:

```bash
npm run test:unit
npm run test:integration
npm run test:evasion
```

Run with coverage:

```bash
npm run test:coverage
```

## Unit Tests

Test individual modules:

```bash
# Run unit tests
npm run test:unit

# Run specific test file
npm test -- tests/unit/evasion.test.js
```

Example unit test:

```javascript
describe('Fingerprint Spoofing', () => {
  it('should randomize navigator properties', () => {
    const fingerprint = generateFingerprint();
    expect(fingerprint.webdriver).toBe(undefined);
    expect(fingerprint.plugins).toBeDefined();
  });
});
```

## Integration Tests

Test WebSocket commands end-to-end:

```bash
npm run test:integration
```

Example integration test:

```javascript
describe('WebSocket API', () => {
  it('should navigate to URL', async () => {
    const ws = await connect();
    await ws.send(JSON.stringify({
      id: '1',
      command: 'navigate',
      url: 'https://example.com'
    }));
    const response = JSON.parse(await ws.recv());
    expect(response.success).toBe(true);
  });
});
```

## Performance Tests

Benchmark latency and throughput:

```bash
npm run test:performance
```

## Writing Tests

### Unit Test Template

```javascript
const { describe, it, expect, beforeEach } = require('@jest/globals');
const { MyModule } = require('../../src/module');

describe('MyModule', () => {
  let module;
  
  beforeEach(() => {
    module = new MyModule();
  });
  
  it('should do something', () => {
    const result = module.doSomething();
    expect(result).toBe(expectedValue);
  });
});
```

### Integration Test Template

```javascript
const WebSocket = require('ws');

describe('WebSocket Command', () => {
  let ws;
  
  beforeEach(async () => {
    ws = await new Promise((resolve) => {
      const socket = new WebSocket('ws://localhost:8765');
      socket.on('open', () => resolve(socket));
    });
  });
  
  afterEach(() => {
    ws.close();
  });
  
  it('should execute command', async () => {
    ws.send(JSON.stringify({
      id: '1',
      command: 'navigate',
      url: 'https://example.com'
    }));
    
    const response = await new Promise((resolve) => {
      ws.on('message', (data) => {
        resolve(JSON.parse(data));
      });
    });
    
    expect(response.success).toBe(true);
  });
});
```

## Test Coverage Goals

- **Unit Tests:** 80%+ coverage
- **Integration Tests:** Critical paths covered
- **Performance Tests:** Baseline established
- **Manual Tests:** Before production release

## CI/CD Integration

Tests run automatically on:
- Push to pull request
- Merge to main branch
- Release build

See `.github/workflows/` for CI configuration.

## See Also

- **[Development Setup](DEV-SETUP.md)** - Environment setup
- **[Contributing](CONTRIBUTING.md)** - Contribution process

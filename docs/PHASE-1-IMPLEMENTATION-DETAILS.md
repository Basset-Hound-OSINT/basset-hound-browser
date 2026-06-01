# Phase 1 Implementation Details & Test Execution Guide

**Date:** May 31, 2026  
**Phase:** 1 of 3  
**Status:** Complete & Ready for Execution  
**QA Lead:** Code Review Required

---

## Overview

This document provides detailed information about Phase 1 test implementation, including:
- Test structure and organization
- How to run tests locally and in CI/CD
- Interpreting test results
- Adding tests to the suite
- Troubleshooting guide

---

## Test File Organization

### Directory Structure
```
tests/unit/
├── async-utils.test.js              [Core functionality - 69 tests]
├── async-utils-edge-cases.test.js   [Edge cases & boundaries - 43 tests]
├── response-formatter.test.js       [Core functionality - 91 tests]
└── response-formatter-edge-cases.test.js [Edge cases - 65 tests]
```

### Test Hierarchy

Each test file follows a consistent hierarchy:

```javascript
describe('ModuleName', () => {
  describe('Feature Group', () => {
    describe('Specific Behavior', () => {
      it('should do specific thing', () => {
        // Test implementation
      });
    });
  });
});
```

Example from `async-utils.test.js`:
```
✓ retryAsync
  ✓ basic functionality
    ✓ should execute function successfully on first attempt
    ✓ should retry on failure and eventually succeed
  ✓ exponential backoff
    ✓ should apply exponential backoff with default multiplier
    ✓ should respect maxDelay limit
```

---

## Running Tests

### Prerequisites
```bash
cd /home/devel/basset-hound-browser
npm install  # If not already done
```

### Basic Execution

**Run all Phase 1 tests:**
```bash
npm test -- tests/unit/async-utils.test.js \
  tests/unit/async-utils-edge-cases.test.js \
  tests/unit/response-formatter.test.js \
  tests/unit/response-formatter-edge-cases.test.js
```

**Run tests by module:**
```bash
# async-utils only
npm test -- tests/unit/async-utils.test.js tests/unit/async-utils-edge-cases.test.js

# response-formatter only
npm test -- tests/unit/response-formatter.test.js tests/unit/response-formatter-edge-cases.test.js
```

**Run single test file:**
```bash
npm test -- tests/unit/async-utils.test.js
```

**Run tests matching pattern:**
```bash
npm test -- tests/unit/async-utils.test.js -t "retryAsync"
npm test -- tests/unit/response-formatter.test.js -t "success"
```

### With Coverage

**Generate coverage report:**
```bash
npm test -- tests/unit/async-utils*.test.js \
  tests/unit/response-formatter*.test.js --coverage
```

**Coverage output locations:**
- Terminal summary: Shows at end of test run
- HTML report: `coverage/lcov-report/index.html`
- JSON report: `coverage/coverage-final.json`
- LCOV report: `coverage/lcov.info`

### Watch Mode

**Continuous test execution during development:**
```bash
npm test -- tests/unit/async-utils.test.js --watch
```

**Options:**
- `a` - Run all tests
- `f` - Run only failing tests
- `p` - Filter by test name
- `q` - Quit watch mode

### Verbose Output

**Detailed test execution logging:**
```bash
npm test -- tests/unit/async-utils.test.js --verbose
```

Shows:
- Each test execution
- Test duration
- Pass/fail status
- Error messages and stack traces

---

## Understanding Test Results

### Success Output
```
PASS  tests/unit/async-utils.test.js
  retryAsync
    basic functionality
      ✓ should execute function successfully on first attempt (3ms)
      ✓ should retry on failure and eventually succeed (5ms)
    exponential backoff
      ✓ should apply exponential backoff with default multiplier (2ms)
      ...
  CircuitBreaker
    ...

Test Suites: 1 passed, 1 total
Tests:       112 passed, 112 total
Snapshots:   0 total
Time:        2.456 s
```

### Failure Output
```
FAIL  tests/unit/async-utils.test.js
  retryAsync
    basic functionality
      ✗ should execute function successfully on first attempt (3ms)

Expected: 'success'
Received: 'failure'

  at Object.<anonymous> (tests/unit/async-utils.test.js:42:15)

Test Suites: 0 passed, 1 failed, 1 total
Tests:       1 failed, 111 passed, 112 total
```

### Coverage Output
```
File                    | % Stmts | % Branch | % Funcs | % Lines |
------------------------|---------|----------|---------|---------|
All files              |   93.2  |   92.8   |   94.1  |   93.2  |
 src/utils/async-utils.js |   100   |   100    |   100   |   100   |
 src/utils/response-formatter.js | 100  |   100    |   100   |   100   |
```

---

## Test Structure Details

### Testing retryAsync

**Function Signature:**
```javascript
async retryAsync(asyncFn, options = {})
```

**Options Tested:**
```javascript
{
  maxRetries: number           // Default: 3
  initialDelay: number         // Default: 1000ms
  maxDelay: number            // Default: 30000ms
  backoffMultiplier: number   // Default: 2
  shouldRetry: Function       // Custom retry predicate
  onRetry: Function           // Callback on each retry
  thisArg: any                // Context for function
}
```

**Test Coverage Map:**

| Behavior | Test Count | Coverage |
|----------|-----------|----------|
| Successful first attempt | 1 | Happy path |
| Retry and success | 1 | Error recovery |
| Retry exhaustion | 1 | Max retries |
| Exponential backoff | 5 | Backoff logic |
| Delay limits | 2 | Boundary checks |
| shouldRetry predicate | 3 | Conditional retry |
| onRetry callback | 3 | Callback behavior |
| Context (thisArg) | 2 | Context preservation |
| Edge cases | 6 | Boundary conditions |

### Testing CircuitBreaker

**Class Methods:**
```javascript
new CircuitBreaker(asyncFn, options)
execute()           // Execute protected function
open()             // Manually open circuit
reset()            // Reset to closed state
getState()         // Get current state
getStats()         // Get statistics
```

**State Transitions Tested:**
```
closed  →  open       (on failure threshold)
open    →  half-open  (after timeout)
half-open → closed    (on success threshold)
half-open → open      (on failure in half-open)
```

**Test Coverage Map:**

| Behavior | Test Count | Coverage |
|----------|-----------|----------|
| State management | 3 | Core functionality |
| State transitions | 5 | All transitions |
| Failure counting | 3 | Threshold logic |
| Success tracking | 2 | Success threshold |
| Timeouts | 3 | Timeout behavior |
| Callbacks | 3 | Callback execution |
| Manual control | 4 | Manual operations |
| Predicates | 2 | Custom predicates |
| Edge cases | 8 | Boundary conditions |

### Testing ResponseFormatter

**Methods Tested:**
```javascript
ResponseFormatter.success(data, options)
ResponseFormatter.error(message, options)
ResponseFormatter.partial(results, options)
ResponseFormatter.paginated(items, pagination, options)
ResponseFormatter.async(operationId, options)
ResponseFormatter.redirect(url, options)
ResponseFormatter.isValid(response, options)
ResponseFormatter.toJSON(response)
```

**Test Coverage Map:**

| Method | Test Count | Coverage |
|--------|-----------|----------|
| success() | 13 | All options & edge cases |
| error() | 18 | All codes & status mapping |
| partial() | 14 | All count scenarios |
| paginated() | 19 | All pagination logic |
| async() | 9 | All operation ID formats |
| redirect() | 7 | All redirect types |
| isValid() | 15 | All validation rules |
| toJSON() | 18 | All serialization cases |
| errorResponse() | 15 | All error types |

---

## Key Testing Patterns Used

### 1. Jest Mocks
```javascript
// Create mock function
const fn = jest.fn().mockResolvedValue('result');

// Verify call count
expect(fn).toHaveBeenCalledTimes(1);

// Verify arguments
expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
```

### 2. Fake Timers
```javascript
jest.useFakeTimers();

const promise = retryAsync(fn, { initialDelay: 100 });
jest.advanceTimersByTime(100);

await promise;
jest.useRealTimers();
```

### 3. Promise Testing
```javascript
// Test that promise rejects
await expect(retryAsync(fn)).rejects.toThrow('error');

// Test promise resolution
const result = await retryAsync(fn);
expect(result).toBe('success');
```

### 4. Error Testing
```javascript
// Test specific error type
expect(() => asyncFn('invalid')).toThrow(TypeError);

// Test error message
await expect(promise).rejects.toThrow('specific message');
```

### 5. State Verification
```javascript
const breaker = new CircuitBreaker(fn, options);
expect(breaker.getState()).toBe('closed');

// Execute and verify state change
await breaker.execute();
expect(breaker.getState()).toBe('open');
```

---

## Adding New Tests

### Template for New Test Case
```javascript
describe('FeatureName', () => {
  it('should do something specific', () => {
    // Arrange: Set up test data
    const input = { /* test data */ };
    const fn = jest.fn().mockResolvedValue('result');

    // Act: Execute the function
    const result = await retryAsync(fn, input);

    // Assert: Verify the result
    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should handle error condition', async () => {
    // Arrange
    const fn = jest.fn().mockRejectedValue(new Error('fail'));

    // Act & Assert
    await expect(
      retryAsync(fn, { maxRetries: 0 })
    ).rejects.toThrow('fail');
  });
});
```

### Testing Async Functions
```javascript
// Use async/await
it('should handle async operation', async () => {
  const result = await someAsyncFunction();
  expect(result).toBe(expectedValue);
});

// Use .then() for compatibility
it('should handle promise', () => {
  return someAsyncFunction().then(result => {
    expect(result).toBe(expectedValue);
  });
});

// Use jest.resolves/rejects
it('should resolve with data', () => {
  return expect(someAsyncFunction())
    .resolves.toBe(expectedValue);
});
```

### Testing With Timers
```javascript
it('should handle timeout', async () => {
  jest.useFakeTimers();

  const promise = functionWithDelay();
  
  // Nothing happens yet
  expect(mockFn).not.toHaveBeenCalled();
  
  // Advance time
  jest.advanceTimersByTime(1000);
  
  // Now it's been called
  await promise;
  expect(mockFn).toHaveBeenCalled();

  jest.useRealTimers();
});
```

---

## Troubleshooting Common Issues

### Issue: Tests Timeout
**Cause:** Async operation not completing  
**Solution:**
```javascript
// Increase timeout for slow tests
it('slow test', async () => {
  // test code
}, 10000); // 10 second timeout

// Or globally:
jest.setTimeout(10000);
```

### Issue: Fake Timers Not Working
**Cause:** Using real timers in test  
**Solution:**
```javascript
// Must use jest.useFakeTimers() BEFORE creating delays
jest.useFakeTimers();

// Now these are controlled
setTimeout(...);
setInterval(...);

jest.useRealTimers(); // ALWAYS clean up
```

### Issue: Mock Not Called as Expected
**Cause:** Function error or wrong argument  
**Solution:**
```javascript
// Verify mock was called
expect(mock).toHaveBeenCalled();

// Check call count
expect(mock).toHaveBeenCalledTimes(1);

// Check arguments
expect(mock).toHaveBeenCalledWith(expectedArg);

// View actual calls
console.log(mock.mock.calls);
```

### Issue: Promise Never Resolves/Rejects
**Cause:** Missing await or return  
**Solution:**
```javascript
// Wrong: Promise never completes
it('broken test', () => {
  asyncFunction(); // Missing await!
});

// Correct: Returns promise
it('correct test', () => {
  return asyncFunction();
});

// Also correct: Uses await
it('also correct', async () => {
  await asyncFunction();
});
```

### Issue: Snapshot Mismatch
**Cause:** Expected output changed  
**Solution:**
```bash
# Update snapshots if change is intentional
npm test -- -u

# Or update specific file
npm test -- tests/unit/async-utils.test.js -u
```

### Issue: Tests Pass Locally But Fail in CI
**Cause:** Timing issues, environment differences  
**Solution:**
```javascript
// Use longer delays for CI
const delay = process.env.CI ? 1000 : 100;

// Or use jest.retryTimes() for flaky tests
it('flaky test', async () => {
  // test code
}, 5000); // Set higher timeout
```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests - Phase 1

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      
      - run: npm install
      
      - name: Run Phase 1 Tests
        run: npm test -- tests/unit/async-utils*.test.js \
             tests/unit/response-formatter*.test.js
      
      - name: Upload Coverage
        uses: codecov/codecov-action@v2
        with:
          files: ./coverage/lcov.info
```

### GitLab CI Example
```yaml
test:phase1:
  stage: test
  script:
    - npm install
    - npm test -- tests/unit/async-utils*.test.js \
      tests/unit/response-formatter*.test.js --coverage
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
```

---

## Performance Metrics

### Expected Execution Time
```
async-utils.test.js:              ~2.5 seconds
async-utils-edge-cases.test.js:   ~2.0 seconds
response-formatter.test.js:        ~2.0 seconds
response-formatter-edge-cases.test.js: ~1.5 seconds
─────────────────────────────────────────────
Total:                            ~8.0 seconds
```

### Optimization Tips
1. **Use fake timers** - Speeds up delay-based tests
2. **Mock external calls** - No network delays
3. **Parallel test execution** - Jest runs tests in parallel by default
4. **Skip slow tests** - Use `.skip()` for slow tests during development
```javascript
it.skip('slow test', () => { /* skipped */ });
```

---

## Maintenance Guidelines

### When to Update Tests

1. **Code Changes**
   - Update tests to match new behavior
   - Add tests for new edge cases
   - Remove tests for deleted features

2. **Failing Tests**
   - Fix the actual bug first (not the test)
   - Only update test if behavior intentionally changed

3. **Performance Improvements**
   - Verify tests still pass
   - Update timeout expectations if changed

### Code Review Checklist
- [ ] New tests have clear descriptions
- [ ] Tests are organized logically
- [ ] Mock functions are properly configured
- [ ] Jest timers are cleaned up
- [ ] No test interdependencies
- [ ] Assertions are specific
- [ ] Edge cases are covered
- [ ] Error messages are clear

---

## Reporting & Metrics

### Coverage Report Commands
```bash
# Generate HTML coverage report
npm test -- tests/unit/async-utils*.test.js --coverage

# View in browser
open coverage/lcov-report/index.html

# Generate JSON summary
npm test -- tests/unit --coverage --coverageReporters=json-summary
```

### Key Metrics to Track
- Test execution time (target: <10 seconds)
- Test pass rate (target: 100%)
- Code coverage (target: >95%)
- Flaky test rate (target: 0%)

---

## References

### Jest Documentation
- [Jest Testing Framework](https://jestjs.io/)
- [Jest API Reference](https://jestjs.io/docs/api)
- [Jest Timer Mocks](https://jestjs.io/docs/timer-mocks)
- [Jest Async Testing](https://jestjs.io/docs/asynchronous)

### Project Documentation
- [TEST-COVERAGE-EXPANSION-PLAN](./TEST-COVERAGE-EXPANSION-PLAN-2026-05-31.md)
- [TEST-COVERAGE-PHASE-1-COMPLETION](./TEST-COVERAGE-PHASE-1-COMPLETION.md)

---

## Contact & Support

For questions or issues with Phase 1 tests:
1. Check this guide's Troubleshooting section
2. Review test file comments and documentation
3. Consult Jest documentation
4. Reach out to QA lead for complex issues

---

**Last Updated:** May 31, 2026  
**Version:** 1.0  
**Status:** Ready for Production Use

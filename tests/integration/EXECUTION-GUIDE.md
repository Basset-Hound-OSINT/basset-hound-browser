# Critical Fixes Integration Test - Execution Guide

**Version:** 1.0.0  
**Created:** June 21, 2026  
**Purpose:** Step-by-step guide for executing and validating critical fixes tests

---

## Quick Start

### Prerequisites Check
```bash
# Verify Node.js installed
node --version  # Should be v16+ (v18+ recommended)

# Verify npm installed
npm --version   # Should be v7+

# Verify ws module available
npm ls ws       # Should show ws module

# Verify jest available
npm ls jest     # Should show jest installed
```

### Basic Execution

```bash
# Run all 80 tests
npm test -- tests/integration/critical-fixes-integration.test.js

# Run with verbose output
npm test -- tests/integration/critical-fixes-integration.test.js --verbose

# Run with coverage
npm test -- tests/integration/critical-fixes-integration.test.js --coverage
```

---

## Detailed Execution Steps

### Step 1: Pre-Test Validation

**Ensure WebSocket Server is Running**
```bash
# Check if server running on default port
curl -i ws://localhost:8765

# If not running, start it
npm start                          # If configured as start script
# OR
node websocket/server.js          # If direct execution
```

**Verify Server Health**
```bash
# Should respond to ping/pong or similar health check
# Check server logs for "listening on port 8765"
```

**Verify Test Directory Structure**
```bash
ls -la tests/integration/
# Should show:
# - critical-fixes-integration.test.js
# - CRITICAL-FIXES-INTEGRATION-TESTS.md
# - TEST-RESULTS-TEMPLATE.md
# - COVERAGE-ANALYSIS.md
# - EXECUTION-GUIDE.md (this file)
```

### Step 2: Configure Test Environment

**Set Environment Variables (Optional)**
```bash
# For custom WebSocket server location
export WS_SERVER=ws://localhost:8765

# For extended timeout
export TEST_TIMEOUT=60000

# For custom rate limits
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_UNAUTHENTICATED=100
export RATE_LIMIT_AUTHENTICATED=1000

# For verbose logging
export DEBUG=true
export LOG_LEVEL=debug
```

**Verify Configuration**
```bash
echo "WebSocket server: $WS_SERVER"
echo "Test timeout: $TEST_TIMEOUT"
echo "Rate limit enabled: $RATE_LIMIT_ENABLED"
```

### Step 3: Run Test Suites Individually

**Option A: Run All Tests**
```bash
npm test -- tests/integration/critical-fixes-integration.test.js
```

**Option B: Run by Category**

REQUEST SIZE LIMITS (15 tests):
```bash
npm test -- tests/integration/critical-fixes-integration.test.js -t "REQUEST SIZE LIMITS"
```

CONNECTION CLEANUP (12 tests):
```bash
npm test -- tests/integration/critical-fixes-integration.test.js -t "CONNECTION CLEANUP"
```

RATE LIMITING (18 tests):
```bash
npm test -- tests/integration/critical-fixes-integration.test.js -t "RATE LIMITING"
```

PATH VALIDATION (20 tests):
```bash
npm test -- tests/integration/critical-fixes-integration.test.js -t "PATH VALIDATION"
```

STABILITY (15 tests):
```bash
npm test -- tests/integration/critical-fixes-integration.test.js -t "STABILITY"
```

**Option C: Run Single Test**
```bash
npm test -- tests/integration/critical-fixes-integration.test.js -t "Accept normal 1KB payload"
npm test -- tests/integration/critical-fixes-integration.test.js -t "Rate limit enforced"
npm test -- tests/integration/critical-fixes-integration.test.js -t "Path traversal blocked"
```

### Step 4: Interpret Results

**Success Output** (all tests pass):
```
PASS  tests/integration/critical-fixes-integration.test.js (18.4 s)
  1. REQUEST SIZE LIMITS (15 tests)
    ✓ 1.1: Accept normal 1KB payload (45 ms)
    ✓ 1.2: Accept medium 10MB payload (320 ms)
    ...
  2. CONNECTION CLEANUP (12 tests)
    ✓ 2.1: Normal connection cleanup (120 ms)
    ...
  3. RATE LIMITING (18 tests)
    ✓ 3.1: Single request allowed (80 ms)
    ...
  4. PATH VALIDATION (20 tests)
    ✓ 4.1: Absolute paths rejected (15 ms)
    ...
  5. STABILITY (15 tests)
    ✓ 5.1: Single connection stable (2000 ms)
    ...

Test Suites: 1 passed, 1 total
Tests:       80 passed, 80 total
```

**Failure Output** (some tests fail):
```
FAIL  tests/integration/critical-fixes-integration.test.js (18.4 s)
  3. RATE LIMITING (18 tests)
    ✓ 3.1: Single request allowed (80 ms)
    ✗ 3.3: Rate limit enforced (100 req/min) (1250 ms)
      Error: Expected 429 status code, got 200
      at /tests/integration/critical-fixes-integration.test.js:456:20
    ...

Test Suites: 1 failed, 1 total
Tests:       77 passed, 3 failed, 80 total
Snapshots:  0 total
Time:       18.4 s
```

---

## Troubleshooting

### Issue: "Cannot connect to WebSocket server"

**Symptom:** Tests fail immediately with connection errors

**Solutions:**
```bash
# 1. Check if server is running
netstat -an | grep 8765
lsof -i :8765

# 2. Start server if not running
cd /home/devel/basset-hound-browser
npm start

# 3. Wait for server to be ready
sleep 5
npm test -- tests/integration/critical-fixes-integration.test.js

# 4. If still failing, check server logs
tail -f logs/websocket-server.log
```

### Issue: "Tests timeout after 30 seconds"

**Symptom:** Tests hit timeout during execution

**Solutions:**
```bash
# 1. Increase Jest timeout
npm test -- tests/integration/critical-fixes-integration.test.js --timeout=60000

# 2. Check server responsiveness
curl -i ws://localhost:8765

# 3. Check system resources
free -h
top -n 1

# 4. If memory low, close other applications
# Then retry tests
```

### Issue: "Rate limiting tests fail (unexpected 429 responses)"

**Symptom:** Rate limit tests fail when hitting limits too early

**Solutions:**
```bash
# 1. Verify rate limit config
grep -r "RATE_LIMIT" websocket/rate-limiter.js

# 2. Check current rate limit settings
echo "Configured limits:"
grep "unauthenticatedLimit\|authenticatedLimit" websocket/rate-limiter.js

# 3. Run rate limiting tests with verbose output
npm test -- tests/integration/critical-fixes-integration.test.js -t "RATE LIMITING" --verbose

# 4. If limits are stricter than expected:
# - Modify TEST_CONFIG in test file, OR
# - Adjust rate limiter configuration in server
```

### Issue: "Path validation tests skip on Windows"

**Symptom:** Symlink tests skip or fail on Windows

**Solutions:**
```bash
# 1. For Windows systems, symlink tests may be skipped (expected)
# This is normal - path validation still works for main tests

# 2. Enable Developer Mode on Windows (for symlink support)
# Settings > Update & Security > For developers > Developer Mode

# 3. Re-run tests after enabling Developer Mode
npm test -- tests/integration/critical-fixes-integration.test.js -t "SYMLINK"
```

### Issue: "Memory tests fail (memory not released)"

**Symptom:** Test 5.3 (Memory usage stable) fails

**Solutions:**
```bash
# 1. Run with garbage collection exposed
node --expose-gc ./node_modules/.bin/jest tests/integration/critical-fixes-integration.test.js

# 2. Check available system memory
free -h

# 3. Close other applications to free memory
# Then retry tests

# 4. Review memory growth pattern
npm test -- tests/integration/critical-fixes-integration.test.js -t "Memory usage stable" --verbose
```

### Issue: "Test file not found"

**Symptom:** Jest says "Test file not found"

**Solutions:**
```bash
# 1. Verify file exists
ls -la tests/integration/critical-fixes-integration.test.js

# 2. Verify path is correct
pwd  # Check current directory

# 3. Use absolute path
npm test -- /home/devel/basset-hound-browser/tests/integration/critical-fixes-integration.test.js
```

---

## Performance Tuning

### Optimize for Speed
```bash
# Run tests in parallel (default)
npm test -- tests/integration/critical-fixes-integration.test.js --maxWorkers=4

# Run tests serially (slower but less resource intensive)
npm test -- tests/integration/critical-fixes-integration.test.js --runInBand
```

### Optimize for Stability
```bash
# Run with extended timeout
npm test -- tests/integration/critical-fixes-integration.test.js --testTimeout=60000

# Run with reduced concurrency
npm test -- tests/integration/critical-fixes-integration.test.js --maxWorkers=1

# Run with verbose output for debugging
npm test -- tests/integration/critical-fixes-integration.test.js --verbose --detectOpenHandles
```

### Optimize for Coverage
```bash
# Generate coverage report
npm test -- tests/integration/critical-fixes-integration.test.js --coverage

# View coverage in browser
open coverage/lcov-report/index.html  # macOS
xdg-open coverage/lcov-report/index.html  # Linux
```

---

## Continuous Integration

### CI/CD Pipeline Integration

**GitHub Actions Example:**
```yaml
name: Critical Fixes Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm start &
      - run: sleep 5
      - run: npm test -- tests/integration/critical-fixes-integration.test.js
```

**GitLab CI Example:**
```yaml
critical-fixes-tests:
  image: node:18
  script:
    - npm install
    - npm start &
    - sleep 5
    - npm test -- tests/integration/critical-fixes-integration.test.js
  artifacts:
    paths:
      - test-results.json
```

### Pre-commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running critical fixes tests..."
npm test -- tests/integration/critical-fixes-integration.test.js

if [ $? -ne 0 ]; then
  echo "Tests failed! Commit aborted."
  exit 1
fi
```

---

## Results Documentation

### Auto-Generate Report
```bash
# Run tests and save results to file
npm test -- tests/integration/critical-fixes-integration.test.js > test-results.txt 2>&1

# Parse results
cat test-results.txt | grep "Tests:"
cat test-results.txt | grep "Test Suites:"

# Extract metrics
grep -o "[0-9]* passed" test-results.txt
```

### Create Results File
```bash
# Copy template
cp tests/integration/TEST-RESULTS-TEMPLATE.md test-results-$(date +%Y-%m-%d).md

# Edit with actual results
vim test-results-$(date +%Y-%m-%d).md
```

### Track Metrics Over Time
```bash
# Create metrics tracking file
cat > test-metrics.csv << EOF
Date,Total,Passed,Failed,PassRate,Duration
$(date +%Y-%m-%d),80,XX,0,XX.XX%,XXs
EOF

# Append to historical data
tail -n +2 test-results.txt >> test-metrics.csv
```

---

## Post-Test Actions

### If All Tests Pass ✓

1. **Document Results**
   ```bash
   cp tests/integration/TEST-RESULTS-TEMPLATE.md test-results-2026-06-21.md
   # Fill in actual results
   git add test-results-2026-06-21.md
   ```

2. **Update Status**
   ```bash
   # In README or status file
   echo "Critical Fixes: VALIDATED (80/80 tests passing)"
   ```

3. **Proceed to Next Phase**
   ```bash
   # Run stress/load testing
   npm test -- tests/stress/
   ```

### If Some Tests Fail ✗

1. **Identify Root Cause**
   ```bash
   # Run failed test with verbose output
   npm test -- tests/integration/critical-fixes-integration.test.js -t "FAILING_TEST" --verbose
   ```

2. **Review Implementation**
   ```bash
   # Check the fix implementation
   vim websocket/rate-limiter.js  # for rate limit failures
   vim websocket/request-validator.js  # for size limit failures
   vim websocket/connection-manager.js  # for cleanup failures
   vim src/security/path-validator.js  # for path validation failures
   ```

3. **Fix and Re-test**
   ```bash
   # Apply fix
   vim [implementation-file]

   # Re-run specific test
   npm test -- tests/integration/critical-fixes-integration.test.js -t "FAILING_TEST"
   ```

4. **Commit Fix**
   ```bash
   git add -A
   git commit -m "fix: Resolve [test name] failure"
   npm test -- tests/integration/critical-fixes-integration.test.js
   ```

---

## Advanced Options

### Test Filtering
```bash
# Run only slow tests (>1 second)
npm test -- tests/integration/critical-fixes-integration.test.js --testNamePattern="stable|concurrent"

# Run only fast tests (<100ms)
npm test -- tests/integration/critical-fixes-integration.test.js --testNamePattern="Accept|rejected"
```

### Debug Mode
```bash
# Run with Node debugger
node --inspect-brk ./node_modules/.bin/jest tests/integration/critical-fixes-integration.test.js

# Then open chrome://inspect in Chrome DevTools
```

### Watch Mode
```bash
# Re-run tests on file changes
npm test -- tests/integration/critical-fixes-integration.test.js --watch

# Press 'a' to run all tests
# Press 'p' to filter by filename
# Press 't' to filter by test name
```

---

## Success Checklist

Before considering testing complete:

- [ ] All 80 tests execute without errors
- [ ] Pass rate ≥ 95% (76+ tests passing)
- [ ] No security-critical tests failing
- [ ] Path validation 20/20 passing
- [ ] Rate limiting consistently enforced
- [ ] Connection cleanup verified
- [ ] Memory usage remains stable
- [ ] Results documented in test-results-*.md
- [ ] No timeout issues
- [ ] No flaky tests detected
- [ ] Ready for production deployment

---

## Support and Escalation

### If tests continue to fail:

1. **Review Logs**
   ```bash
   tail -n 100 logs/websocket-server.log
   tail -n 100 logs/test-execution.log
   ```

2. **Check Dependencies**
   ```bash
   npm audit
   npm ls
   ```

3. **Report Issue**
   - Include: Full test output, environment info, server logs
   - Location: /docs/issues/
   - Format: Use template in /docs/ISSUE-TEMPLATE.md

---

**Status:** Execution Guide Ready  
**Next Step:** Execute tests and document results  

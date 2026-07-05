> ⚠️ **HISTORICAL / SUPERSEDED** — authoritative status: **docs/planning/PROJECT-STATUS-MATRIX.md** (2026-07-04). Claims below (version labels, "production ready", "100%"/test-pass counts, command counts, evasion %) are inflated or stale — verify against the matrix and the 2026-07-04 session records before relying on them.

# Pre-Deployment Validation Suite

**Status:** ✅ Complete  
**File:** `/tests/pre-deployment-validation.test.js`  
**Lines of Code:** 1,065  
**Test Count:** 35 tests  
**Operation Count:** 210+ operations  

## Overview

The Pre-Deployment Validation Suite provides **external app confidence** by validating 5 critical aspects of the browser WebSocket API before deploying to production external applications.

### Success Criteria
- ✅ All 35 tests pass
- ✅ All 210+ operations complete without timeout
- ✅ No intermittent failures across repeated runs
- ✅ Exit code 0 = safe for external deployment
- ✅ Exit code 1 = issues require fixing first

## Test Coverage

### 1. Core Command Reliability (10 tests, 30 operations)

Tests **30 core WebSocket commands**, each run **3 times** to verify 100% success rate:

**Commands Validated:**
- `navigate` - Page navigation with URL verification
- `getPageTitle` - Title extraction consistency
- `getPageUrl` - URL tracking reliability
- `screenshot` - Screenshot capture and format
- `getPageHTML` - Full HTML extraction
- `getPageText` - Text content extraction
- `getAllLinks` - Link enumeration
- `getAllImages` - Image enumeration
- `wait` - Timing command reliability
- `scroll` - Scrolling command execution

**Each command** is executed 3 times in sequence and must:
- Complete within 15 seconds
- Return valid response structure
- Include required response fields (`success`, `id`, and command-specific fields)
- Maintain data consistency across runs

**Example Output:**
```
1.1: navigate command - 3 successful runs
  ✓ Run 1: success=true, responseTime=245ms
  ✓ Run 2: success=true, responseTime=198ms
  ✓ Run 3: success=true, responseTime=203ms
PASS (3/3 runs)
```

---

### 2. Error Schema Validation (10 tests, 10 operations)

Tests **10 different invalid inputs** to verify all errors follow a **standard error format**:

**Invalid Input Cases:**
1. Missing `command` field
2. Unknown/invalid command name
3. Invalid URL format for navigate
4. Missing required parameters
5. Invalid enum values (e.g., invalid scroll direction)
6. Out-of-range values (negative timeout)
7. Invalid type values
8. Invalid selector types
9. Empty required fields
10. Malformed JSON payload

**Error Schema Validation:**
```json
{
  "error": "string or object",
  "errorCode": "number (0 or defined code)",
  "timestamp": "number (milliseconds)",
  "recoveryHint": "string describing how to fix the issue",
  "id": "string (command ID for correlation)"
}
```

**All error responses must include:**
- ✅ `error` field with descriptive message
- ✅ `errorCode` numeric identifier
- ✅ `timestamp` when error occurred
- ✅ `recoveryHint` explaining how to fix
- ✅ `id` field for request correlation

**Example Output:**
```
2.1: Missing command field
  Error Response:
  {
    "error": "Missing required field: command",
    "errorCode": 400,
    "timestamp": 1718923456789,
    "recoveryHint": "Ensure all commands include a 'command' field",
    "id": "test1"
  }
PASS (error schema valid)
```

---

### 3. Rate Limiting Validation (5 tests, 5 operations)

Tests **rate limit enforcement** to prevent abuse and ensure fair resource usage:

**Test Cases:**

1. **Rate Limit Enforcement** - Verify requests are rate limited under load
   - Send 20 rapid requests
   - Verify 429 responses when limit exceeded OR all succeed
   - Verify consistent behavior

2. **Retry-After Header** - Verify `Retry-After` header in rate limit responses
   - Trigger rate limit with rapid requests
   - Verify `retryAfter` or `retry-after` field present
   - Check value is numeric (seconds to wait)

3. **Rate Limit Reset** - Verify limit resets correctly after waiting
   - Trigger rate limit
   - Wait 2+ seconds
   - Verify next request succeeds

4. **Rate Limit Metrics** - Verify metrics are tracked
   - Check `getMetrics` response includes rate limit data
   - Verify `rateLimitHits` or `requestsPerSecond` tracked
   - Validate metric accuracy

5. **Concurrent Connection Isolation** - Verify each connection has separate limits
   - Open 2 WebSocket connections
   - Send commands on both
   - Verify both succeed independently

**Example Output:**
```
3.1: Rate limit enforcement - hit limit with rapid requests
  Requests sent: 20
  Successful: 18 (90%)
  Rate limited: 2 (10%)
PASS (rate limiting working)

3.2: Verify Retry-After header in rate limit response
  Rate limit detected: Yes
  Retry-After header: Present (value: 60)
PASS (header validation passed)
```

---

### 4. Connection Stability (5 tests, 155 operations)

Tests **connection reliability** over extended periods with heavy load:

**Test Cases:**

1. **5+ Minute Connection Stability**
   - Maintain WebSocket connection for 5+ minutes
   - Execute periodic keepalive commands every 30 seconds
   - Verify no unexpected disconnection
   - Measure total session duration

2. **100 Sequential Commands**
   - Execute 100 commands in sequence
   - Commands vary: `getPageTitle`, `getPageUrl`, `wait` in rotation
   - Track success rate (target: 100%)
   - Record any failures for analysis

3. **Reconnection Recovery**
   - Intentionally close WebSocket connection
   - Wait 1 second
   - Reconnect to server
   - Execute command to verify connection works
   - Verify successful recovery

4. **No Data Loss on Reconnect**
   - Navigate to specific page, record page title
   - Close connection
   - Reconnect
   - Navigate to same page again
   - Verify page title matches (data consistency preserved)

5. **Memory Stability**
   - Execute 50 screenshot commands (memory-intensive)
   - Monitor for memory leaks (error rate < 5%)
   - Track peak memory usage
   - Verify garbage collection working

**Example Output:**
```
4.1: Maintain connection for 5+ minutes
  Start time: 1718923456789
  End time: 1718923756789
  Duration: 5 minutes 0.5 seconds
  Connection lost: No
PASS (stability verified)

4.2: Execute 100 sequential commands without failure
  Successful: 100/100 (100%)
  Failed: 0/100 (0%)
  Errors: None
PASS (100% success rate)

4.3: Test reconnection after brief disconnect
  Initial connection: OK
  Disconnect: OK
  Reconnect: OK
  Post-reconnect command: SUCCESS
PASS (reconnection verified)
```

---

### 5. Data Consistency (5 tests, 10 operations)

Tests **data consistency** across multiple requests to ensure reliable extraction:

**Test Cases:**

1. **Identical HTML on Repeated Navigation**
   - Navigate to same page twice
   - Extract HTML both times
   - Verify HTML is identical (bit-for-bit match)
   - Ensures page state is reproducible

2. **Different Pages Return Different HTML**
   - Navigate to example.com
   - Extract HTML
   - Navigate to example.org
   - Extract HTML
   - Verify HTML is different
   - Ensures proper page switching

3. **Metadata Consistency**
   - Navigate to page
   - Extract title and URL separately
   - Verify both succeed
   - Verify URL matches navigation target
   - Verify title is non-empty

4. **Links Consistency**
   - Navigate to page with links
   - Extract links twice
   - Verify same number of links found both times
   - Verify at least 1 link present

5. **Images Consistency**
   - Navigate to page with images
   - Extract images twice
   - Verify same number of images found both times
   - Ensures image enumeration is stable

**Example Output:**
```
5.1: HTML is identical on repeated navigation to same page
  First HTML length: 45,023 bytes
  Second HTML length: 45,023 bytes
  Byte-for-byte match: Yes
PASS (identical HTML verified)

5.2: Different pages return different HTML
  Page 1: example.com (45,023 bytes)
  Page 2: example.org (38,456 bytes)
  Different: Yes
PASS (page switching verified)

5.3: Metadata consistency across requests
  Title: Example Domain
  URL: https://www.example.com/
  Both fields present: Yes
PASS (metadata verified)
```

---

## Running the Tests

### Prerequisites
1. **WebSocket Server Running**
   ```bash
   npm start
   # Server should be listening on ws://localhost:8765
   ```

2. **Test Framework Installed**
   ```bash
   npm install
   # Ensures mocha, assert, ws are available
   ```

### Execute Tests

**Run full validation suite:**
```bash
npm test -- tests/pre-deployment-validation.test.js
```

**Run with verbose output:**
```bash
npm test -- tests/pre-deployment-validation.test.js --reporter spec
```

**Run specific test suite:**
```bash
# Just core reliability
npx mocha tests/pre-deployment-validation.test.js --grep "Test Suite 1"

# Just error validation
npx mocha tests/pre-deployment-validation.test.js --grep "Test Suite 2"

# Just rate limiting
npx mocha tests/pre-deployment-validation.test.js --grep "Test Suite 3"

# Just stability
npx mocha tests/pre-deployment-validation.test.js --grep "Test Suite 4"

# Just consistency
npx mocha tests/pre-deployment-validation.test.js --grep "Test Suite 5"
```

### Expected Runtime

| Suite | Tests | Operations | Est. Duration |
|-------|-------|-----------|---|
| Core Reliability | 10 | 30 | 1-2 min |
| Error Schema | 10 | 10 | 30-60 sec |
| Rate Limiting | 5 | 5 | 15-30 sec |
| Connection Stability | 5 | 155 | 5-7 min |
| Data Consistency | 5 | 10 | 1-2 min |
| **TOTAL** | **35** | **210+** | **8-12 min** |

---

## Output Format

### Console Output

```
===================================
PRE-DEPLOYMENT VALIDATION RESULTS
===================================

Test Suite 1: Core Command Reliability: 10 tests, 30 operations
Test Suite 2: Error Schema Validation: 10 tests, 10 operations
Test Suite 3: Rate Limiting Validation: 5 tests, 5 operations
Test Suite 4: Connection Stability: 5 tests, 155 operations
Test Suite 5: Data Consistency: 5 tests, 10 operations

Total Tests: 35
Passed: 35
Failed: 0

Total Operations: 210
Successful: 210
Failed: 0

Duration: 562.34 seconds
Status: PASS
Recommendation: SAFE TO DEPLOY
===================================
```

### Results File

**Location:** `tests/results/pre-deployment-validation-summary.json`

**Contents:**
```json
{
  "timestamp": "2026-06-21T16:45:23.456Z",
  "summary": {
    "totalTests": 35,
    "passedTests": 35,
    "failedTests": 0,
    "totalOperations": 210,
    "successfulOperations": 210,
    "failedOperations": 0,
    "durationSeconds": "562.34",
    "overallStatus": "PASS"
  },
  "detailed": {
    "metrics": { ... },
    "errors": [ ]
  }
}
```

---

## Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| **0** | All tests passed | ✅ SAFE TO DEPLOY |
| **1** | Any test failed | ❌ FIX ISSUES FIRST |

### Deploy Only When:
```
Exit Code = 0
AND
Status = PASS
AND
Recommendation = SAFE TO DEPLOY
```

---

## Common Issues & Recovery

### "WebSocket connection timeout"
- **Cause:** Server not running on port 8765
- **Fix:** Start server with `npm start`

### "Command timeout after 15000ms"
- **Cause:** Server overloaded or slow response
- **Fix:** Check server CPU/memory, restart if needed

### "Rate limit exceeded" errors
- **Cause:** Tests running too fast
- **Fix:** Increase command timeout or add delays between tests

### Memory issues during connection stability
- **Cause:** Memory leak in one of the commands
- **Fix:** Profile with `--inspect` and check GC logs

### Different HTML on repeated navigation
- **Cause:** Dynamic content or CDN changes
- **Fix:** Use static test sites (example.com recommended)

---

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Run Pre-Deployment Validation
  run: |
    npm start &
    sleep 5
    npm test -- tests/pre-deployment-validation.test.js
    if [ $? -ne 0 ]; then
      echo "Pre-deployment validation failed"
      exit 1
    fi
```

### Jenkins Example
```groovy
stage('Pre-Deployment Validation') {
  steps {
    sh 'npm start &'
    sh 'sleep 5'
    sh 'npm test -- tests/pre-deployment-validation.test.js'
  }
}
```

---

## Metrics & Monitoring

The validation suite tracks:

- **Response Times:** Per-command latency
- **Success Rates:** Percentage of operations succeeding
- **Error Types:** Categories of failures encountered
- **Memory Usage:** Peak memory during stability tests
- **Rate Limit Behavior:** How limits are enforced
- **Connection Stability:** Uptime and reconnection success

All metrics are logged to:
```
tests/results/pre-deployment-validation-summary.json
```

---

## When to Run

**Required Before:**
- Production deployment to external apps
- Major version release
- Performance optimization changes
- Network/infrastructure changes
- After system maintenance

**Recommended:**
- Weekly in development
- Daily in staging
- Before every external app integration

---

## Next Steps

After validation passes:

1. ✅ Review validation summary
2. ✅ Check metrics in results file
3. ✅ Archive results for compliance
4. ✅ Deploy to production with confidence
5. ✅ Monitor production metrics post-deployment

---

**Last Updated:** June 21, 2026  
**Version:** 1.0.0  
**Status:** ✅ Production Ready

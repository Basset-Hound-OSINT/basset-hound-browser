# External App Reliability Validation Suite

This validation suite tests whether the Basset Hound Browser can be reliably used by external applications. It focuses on **actual operational requirements** rather than edge cases.

## What Gets Validated

### 1. Core Workflow Reliability
- **Test:** `core-workflow.test.js`
- **What:** The essential sequence that external apps depend on:
  1. Navigate to URL
  2. Wait for page load
  3. Extract full HTML
  4. Get network logs
  5. Verify data consistency
- **Why:** This is the #1 use case. If it fails, external apps cannot function.
- **Duration:** ~60 seconds

### 2. Response Schema Consistency
- **Test:** `schema-validation.test.js`
- **What:** Validates that actual server responses match documented OpenAPI schema
- **Why:** External apps parse JSON. If response structure changes silently, apps break. No test = no confidence.
- **Checks:**
  - Response field presence (required vs optional)
  - Field types match documentation
  - Error responses have consistent structure
- **Duration:** ~30 seconds

### 3. Connection Stability (5+ Minutes)
- **Test:** `connection-stability.test.js`
- **What:** Holds WebSocket connection for 5+ minutes, sending periodic commands
- **Why:** Production apps need to know: "Can I maintain this connection for hours?" Current tests don't prove this.
- **Validates:**
  - No unexpected disconnections
  - Command success rate stays high (≥95%)
  - Message ordering maintained throughout
  - Latency remains reasonable
- **Duration:** ~5-6 minutes (longest test)

### 4. Rate Limiting Enforcement
- **Test:** `rate-limiting.test.js`
- **What:** Validates rate limits work as documented
- **Why:** Documentation promises rate limiting. No test proves it works.
- **Checks:**
  - Rate limits trigger at the right threshold
  - Different commands have different limits
  - Sliding window resets correctly
  - Error response includes retry timing
- **Duration:** ~2 minutes

### 5. Error Recovery & Reconnection
- **Test:** `error-recovery.test.js`
- **What:** Validates graceful error recovery and reconnection
- **Why:** Real systems encounter network issues. Apps need to know recovery works.
- **Checks:**
  - Graceful reconnection after disconnect
  - Session state persists across reconnects
  - Exponential backoff is applied
  - Retryable vs non-retryable commands are handled correctly
- **Duration:** ~60 seconds

## Running the Validation Suite

### Quick Start
```bash
# Run all validations (default, skips long-duration tests)
./tests/external-app-validation/run-all-validations.js

# Run all validations including connection stability test
SKIP_LONG_TESTS=false ./tests/external-app-validation/run-all-validations.js

# Run a specific test
node ./tests/external-app-validation/core-workflow.test.js

# Run with custom server URL
WS_URL=ws://other-server:8765 ./tests/external-app-validation/run-all-validations.js
```

### Prerequisites
- Node.js 14+
- WebSocket server running on default port 8765 (or custom `WS_URL`)
- Optional: Electron app running (for browser commands to work)

### Environment Variables
```bash
WS_URL=ws://localhost:8765              # Server URL (default)
SKIP_LONG_TESTS=true|false              # Skip 5+ min tests (default: true)
```

## Interpreting Results

### All Tests Pass ✓
```
✓ VALIDATION COMPLETE - ALL TESTS PASSED

External apps can reliably use this system.
All critical reliability checks passed.
```
**Decision:** Safe to integrate external applications.

### Critical Tests Fail ✗
```
✗ VALIDATION FAILED - CRITICAL ISSUES DETECTED

External apps cannot reliably use this system.
Fix the critical issues before using in production.
```
**Decision:** Do not release to external integration. Fix issues first.

### Non-Critical Tests Fail ⚠
```
⚠ VALIDATION PASSED - CRITICAL TESTS OK

Some optional validations failed.
External apps should be able to use this system.
```
**Decision:** Can integrate, but some optimizations are missing. File tickets for improvements.

## Critical vs Optional Tests

### Critical Tests
These must pass for external apps to function:
- Core Workflow (navigate → extract → logs)
- Response Schema Consistency
- Error Recovery & Reconnection

### Optional Tests (Long-Duration)
These are skipped by default to speed up CI:
- Connection Stability (5+ minutes)
- Rate Limiting Enforcement

Run with `SKIP_LONG_TESTS=false` for complete validation.

## Troubleshooting

### "Connection refused" / "Connection timeout"
```
Check:
1. Is the WebSocket server running? (ps aux | grep node)
2. Is it listening on the expected port? (netstat -tlnp)
3. Try setting WS_URL explicitly: WS_URL=ws://localhost:8765
```

### Core workflow test fails at "navigate"
```
Check:
1. Can Electron app be started?
2. Are all dependencies installed? (npm install)
3. Is there a GPU available (if using headless=false)?
```

### Connection stability test hangs
```
This test takes 5+ minutes. It's working, not hanging.
Use Ctrl+C to interrupt if needed.
```

### Rate limiting test doesn't hit the limit
```
This can happen due to timing/network delays.
The test validates that the limit mechanism exists,
even if it doesn't trigger during the test.
Not a failure.
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Run External App Validation
  run: |
    npm install
    ./tests/external-app-validation/run-all-validations.js
  timeout-minutes: 15
  env:
    WS_URL: ws://localhost:8765
    SKIP_LONG_TESTS: true  # Skip 5-min test in CI
```

### Suggested CI Strategy
1. Run quick validations (Core, Schema, Recovery) in every PR - ~3 minutes
2. Run full validation (including stability) once per day - ~7 minutes
3. Generate report and notify maintainers on failure

## Test Output

Each test produces:
1. Real-time progress output (sent to stdout)
2. Detailed results table at end
3. Exit code: 0 (pass) or 1 (fail)

For CI integration, check exit code:
```bash
./tests/external-app-validation/run-all-validations.js
if [ $? -eq 0 ]; then
  echo "✓ Ready for external integration"
else
  echo "✗ Issues found"
fi
```

## What's NOT Tested

These are intentionally excluded:
- Edge cases and unusual input combinations
- Performance optimization (throughput, latency targets)
- Obscure error conditions
- Browser-specific features
- Single command reliability (covered by other test suites)

This suite tests **operational reliability**, not feature completeness.

## Adding Custom Validations

To add your own validation test:

1. Create `your-test.test.js` in this directory
2. Follow the same structure as existing tests:
   ```javascript
   const WebSocket = require('ws');
   const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
   
   // Your test code...
   
   process.exit(0);  // Success
   process.exit(1);  // Failure
   ```
3. Add to `TEST_SUITE` in `run-all-validations.js`
4. Run via master script

## Support

For validation failures, check:
1. Server logs: `./logs/websocket-server.log`
2. Browser output: Look for error messages in Electron window
3. Network: Can you reach the server? (`curl ws://localhost:8765`)

## Version History

- **v1.0** (2026-06-21): Initial external app validation suite
  - 5 core validation tests
  - ~10 minutes total execution time (quick run)
  - ~7 hours total (with stability test)

---

**Last Updated:** June 21, 2026  
**Validation Suite Status:** ✓ Ready for use  
**Target External Apps:** Any that use Basset Hound Browser WebSocket API

# Edge Case Test Suite - Execution Guide

**Version:** 1.0  
**Date:** May 11, 2026  
**Status:** Ready for execution  
**Expected Duration:** 45-60 minutes

---

## Overview

The Edge Case Test Suite comprehensively tests Basset Hound v11.3.0 against unusual scenarios, extreme conditions, and error states to identify remaining issues before production deployment.

### Test Categories
1. **Extreme Scenarios** (7 tests) - Memory, speed, scale limits
2. **Unusual Content** (9 tests) - Frameworks, WebGL, WebRTC, media
3. **Error Conditions** (9 tests) - Timeouts, failures, recovery
4. **Platform-Specific** (6 tests) - OS-specific edge cases
5. **Security Boundary** (8 tests) - Isolation, injection prevention
6. **Additional Stress** (8 tests) - Binary data, RTL text, Unicode

**Total: 47 tests across 6 categories**

---

## Pre-Execution Checklist

### Environment Requirements
- [ ] Node.js 18+ installed
- [ ] WebSocket module installed: `npm install ws`
- [ ] Basset Hound v11.3.0 running on port 8765
- [ ] Network connectivity (tests use external URLs)
- [ ] At least 500MB free disk space for results
- [ ] 30 minutes uninterrupted time

### System State
- [ ] No other tests running
- [ ] System load normal (< 50% CPU)
- [ ] Memory available (> 1GB free)
- [ ] No blocking firewalls/proxies
- [ ] No rate limiting on target hosts

### Basset Hound Status
- [ ] Server running: `ws://localhost:8765`
- [ ] WebSocket server responding to ping
- [ ] All 14 core commands working
- [ ] No errors in server logs
- [ ] Profiles ready for testing

### Network Status
- [ ] Able to reach httpbin.org
- [ ] Able to reach example.com
- [ ] Able to reach react.dev, vuejs.org, angular.io
- [ ] Able to reach threejs.org
- [ ] Able to reach youtube.com (optional)
- [ ] No VPN/proxy interfering

---

## Running the Test Suite

### Quick Start
```bash
cd /home/devel/basset-hound-browser
node tests/EDGE-CASE-TEST-SUITE-2026-05-11.js
```

### With Logging
```bash
node tests/EDGE-CASE-TEST-SUITE-2026-05-11.js 2>&1 | tee tests/results/edge-case-run-$(date +%s).log
```

### Expected Output
```
[0s] Starting Edge Case Test Suite v11.3.0...
[1s] Connected to WebSocket server
[3s] === EXTREME SCENARIOS ===
[5s] [extreme_scenarios] ✓ Large HTML page (10MB+) handling
[8s] [extreme_scenarios] ✓ Rapid clicking (50 clicks, 25.5 clicks/sec)
...
[3400s] === TEST SUMMARY ===
Total Tests: 47
Passed: 39
Failed: 8
Pass Rate: 83.0%
Duration: 3400s
```

---

## Test Execution Timeline

| Phase | Duration | Tests | Purpose |
|-------|----------|-------|---------|
| Setup & Connection | 5-10s | 1 | Verify server connectivity |
| Extreme Scenarios | 8-12 min | 7 | Performance/memory/scale |
| Unusual Content | 12-18 min | 9 | Framework/media/WebGL sites |
| Error Conditions | 5-8 min | 9 | Error handling/recovery |
| Platform Specific | 3-5 min | 6 | OS-specific behavior |
| Security Boundary | 5-10 min | 8 | Isolation/injection tests |
| Additional Stress | 3-5 min | 8 | Unicode/binary/RTL text |
| Cleanup & Results | 2-3 min | - | Save results, summary |
| **Total** | **40-65 min** | **47** | **Comprehensive validation** |

---

## Output Files

### Results Directory
All results saved to: `/home/devel/basset-hound-browser/tests/results/`

### Generated Files

1. **EDGE-CASE-FINDINGS-2026-05-11.json**
   - Complete test results in JSON format
   - Pass/fail status per test
   - Issues discovered with severity
   - Limits found during testing
   - Recommendations for remediation

2. **STRESS-LIMIT-ANALYSIS-2026-05-11.md** (already provided)
   - Pre-execution limit projections
   - Expected thresholds
   - Comparison to v11.2.0

3. **EDGE-CASE-REMEDIATION-PLAN.md** (already provided)
   - Fix strategy for each issue
   - Implementation roadmap
   - Success criteria

### Analyzing Results
```bash
# View JSON results
cat tests/results/EDGE-CASE-FINDINGS-2026-05-11.json | jq .

# Extract issues only
cat tests/results/EDGE-CASE-FINDINGS-2026-05-11.json | jq '.categories[].issues'

# Count by severity
cat tests/results/EDGE-CASE-FINDINGS-2026-05-11.json | jq '[.. | objects | select(.severity) | .severity] | group_by(.) | map({severity: .[0], count: length})'
```

---

## Test Descriptions

### 1. Extreme Scenarios (7 tests)

#### 1.1 Large HTML Page (10MB+)
- Creates very large DOM tree
- Tests memory handling
- **Expected:** ⚠️ May timeout or show memory pressure

#### 1.2 Rapid Clicking (50 clicks)
- Sends 50 click commands in sequence
- Measures click throughput
- **Expected:** 10-50 clicks/sec, no errors

#### 1.3 Rapid Profile Switching (10 profiles)
- Creates and switches between profiles quickly
- Tests profile state management
- **Expected:** All profiles created and switched without corruption

#### 1.4 Slow Network Simulation (3G)
- Navigates to httpbin.org/delay/3 (3-second delay)
- Tests timeout behavior with slow networks
- **Expected:** 5-10 second response, success

#### 1.5 Concurrent Operations (20 simultaneous)
- Sends 20 getContent commands concurrently
- Tests backpressure handling
- **Expected:** < 5 second completion, no ordering issues

#### 1.6 Memory Pressure (5 consecutive screenshots)
- Takes 5 screenshots in rapid succession
- Tests screenshot buffer management
- **Expected:** All complete without memory errors

#### 1.7 Deep JavaScript Nesting (1000 levels)
- Executes deeply nested recursive function
- Tests JavaScript stack depth
- **Expected:** Success, results returned

### 2. Unusual Content Types (9 tests)

#### 2.1 React Framework Site
- Navigates to react.dev
- Tests React-heavy site compatibility
- **Expected:** Navigation succeeds, detects React framework

#### 2.2 Vue.js Framework Site
- Navigates to vuejs.org
- Tests Vue compatibility
- **Expected:** Navigation succeeds

#### 2.3 Angular Framework Site
- Navigates to angular.io
- Tests Angular compatibility
- **Expected:** Navigation succeeds

#### 2.4 WebGL/3D Content
- Navigates to threejs.org (Three.js library site)
- Tests WebGL canvas handling
- **Expected:** Renders successfully, canvas accessible

#### 2.5 Service Worker Site
- Navigates to service worker demo site
- Tests Service Worker compatibility
- **Expected:** Offline-first features work

#### 2.6 WebRTC Site
- Navigates to webrtc.org
- Tests WebRTC peer connection handling
- **Expected:** Navigation succeeds

#### 2.7 Shadow DOM Content
- Creates and accesses Shadow DOM elements
- Tests CSS selector piercing
- **Expected:** Shadow DOM accessible via JavaScript

#### 2.8 Iframe Handling
- Creates iframe with content
- Tests iframe isolation and content access
- **Expected:** Iframe created, content accessible

#### 2.9 Heavy Media Site
- Navigates to youtube.com
- Tests heavy media site handling
- **Expected:** Navigation succeeds (may be slow)

### 3. Error Conditions (9 tests)

#### 3.1 Invalid URL Handling
- Attempts navigate with invalid URL
- Tests URL validation
- **Expected:** Error response, not crash

#### 3.2 Non-existent Selector
- Clicks non-existent element
- Tests selector validation
- **Expected:** Error response with timeout

#### 3.3 Invalid Command
- Sends completely invalid command name
- Tests command validation
- **Expected:** Error response

#### 3.4 Timeout on Slow Operation
- Sets 3-second timeout on 10-second operation
- Tests timeout handling
- **Expected:** Timeout error, cleanup

#### 3.5 Connection Recovery
- Sends 3 commands, checks recovery from errors
- Tests error resilience
- **Expected:** 2+ successful responses

#### 3.6 Memory Exhaustion
- Creates 50 large arrays in sequence
- Tests memory pressure recovery
- **Expected:** At least 30 succeed

#### 3.7 Malformed JSON Recovery
- Sends invalid JSON, then valid command
- Tests protocol error recovery
- **Expected:** Server recovers, valid command succeeds

#### 3.8 Missing Required Parameters
- Sends navigate without URL
- Tests parameter validation
- **Expected:** Error response

#### 3.9 Rapid Error Recovery
- Triggers 10 errors in succession
- Tests error recovery loop
- **Expected:** System continues working

### 4. Platform-Specific (6 tests)

#### 4.1 Platform Detection
- Reads navigator.platform and userAgent
- Tests platform detection
- **Expected:** Returns platform info

#### 4.2 File Path Handling
- Tests path separator handling
- Platform-specific path handling
- **Expected:** Paths processed correctly

#### 4.3 Line Ending Handling
- Tests CRLF vs LF handling
- Platform-specific line endings
- **Expected:** Correct line endings processed

#### 4.4 Headless Mode Detection
- Detects if running in headless mode
- Tests headless-specific flags
- **Expected:** Returns headless status

#### 4.5 Window Size Detection
- Reads window.innerWidth/Height
- Tests viewport size
- **Expected:** Returns correct dimensions

#### 4.6 Color Space Detection
- Detects color gamut and dynamic range
- Tests color space awareness
- **Expected:** Returns color space info

### 5. Security Boundary (8 tests)

#### 5.1 XSS Payload Handling
- Injects XSS payload
- Tests XSS isolation
- **Expected:** Payload runs in sandbox, doesn't escape

#### 5.2 Command Injection Prevention
- Attempts OS command injection
- Tests command validation
- **Expected:** Injection prevented, error response

#### 5.3 Profile Data Isolation
- Creates 2 profiles, sets data, checks isolation
- Tests profile separation
- **Expected:** No data leakage between profiles

#### 5.4 Local Storage Isolation
- Sets and retrieves localStorage
- Tests storage access control
- **Expected:** Storage works, properly isolated

#### 5.5 Cookie Handling
- Sets and reads cookies
- Tests cookie access control
- **Expected:** Cookies work, properly managed

#### 5.6 CORS Compliance
- Tests cross-origin resource sharing
- Tests origin security
- **Expected:** CORS policies respected

#### 5.7 Password Field Handling
- Attempts to fill password input
- Tests credential field access
- **Expected:** Password field accessible

#### 5.8 Cache Control
- Navigates twice to same URL
- Tests cache management
- **Expected:** Caching works, no stale data

### 6. Additional Stress (8 tests)

#### 6.1 Zero Timeout
- Attempts command with 0ms timeout
- Tests parameter validation
- **Expected:** Error response

#### 6.2 Negative Timeout
- Attempts command with -1000ms timeout
- Tests parameter validation
- **Expected:** Error response

#### 6.3 Large Number Handling
- Tests Number.MAX_SAFE_INTEGER
- Tests JavaScript number limits
- **Expected:** Returns large number

#### 6.4 Empty Command
- Sends empty command string
- Tests command validation
- **Expected:** Error response

#### 6.5 Very Long Selector
- Attempts selector with 10k character name
- Tests selector length limits
- **Expected:** Error or not found

#### 6.6 Binary Data Handling
- Fills input with binary data
- Tests binary data processing
- **Expected:** Binary data processed

#### 6.7 Unicode Emoji Handling
- Fills input with emojis
- Tests emoji/Unicode support
- **Expected:** Emojis processed correctly

#### 6.8 RTL Text Handling
- Fills input with Arabic text
- Tests right-to-left text support
- **Expected:** RTL text processed

---

## Interpreting Results

### Pass Criteria by Category

| Category | Pass Criteria | Weight |
|----------|--------------|--------|
| Extreme Scenarios | ≥5/7 (71%) | Critical |
| Unusual Content | ≥6/9 (67%) | High |
| Error Conditions | ≥8/9 (89%) | Critical |
| Platform-Specific | ≥5/6 (83%) | Medium |
| Security Boundary | ≥7/8 (88%) | Critical |
| Additional Stress | ≥6/8 (75%) | Low |

### Overall Success Metrics

| Pass Rate | Status | Action |
|-----------|--------|--------|
| ≥ 90% | Production Ready | Deploy as-is |
| 80-89% | Good, Minor Issues | Fix HIGH issues, redeploy |
| 70-79% | Acceptable | Fix HIGH + CRITICAL issues |
| < 70% | Not Ready | Major remediation needed |

### Severity Classification

- **CRITICAL**: Blocks core functionality or security boundary
- **HIGH**: Major feature broken or performance degraded
- **MEDIUM**: Feature partially broken or workaround exists
- **LOW**: Cosmetic issue or minor limitation

---

## Common Issues & Solutions

### Issue: Connection Timeout
**Cause:** Server not running on port 8765  
**Solution:** Start Basset Hound server:
```bash
npm start  # or your startup command
```

### Issue: Tests Hang
**Cause:** Waiting for external URL that's unreachable  
**Solution:** Check network connectivity:
```bash
curl -I https://httpbin.org/delay/3
```

### Issue: Memory Errors
**Cause:** System running low on RAM  
**Solution:** Close other applications, ensure 1GB+ free

### Issue: All Tests Timeout
**Cause:** Server crashed or unresponsive  
**Solution:** Check server logs and restart:
```bash
pkill -f "basset-hound\|electron"
npm start
```

### Issue: Some Tests Fail Intermittently
**Cause:** Network or timing-dependent failures  
**Solution:** Re-run the suite, check network stability

---

## Monitoring During Execution

### Real-Time Monitoring
Open another terminal to monitor server health:

```bash
# Monitor server logs
tail -f server.log

# Monitor process stats
watch -n 1 'ps aux | grep basset'

# Monitor memory usage
watch -n 1 'free -h'
```

### Expected Behavior
- [0-30s] Tests connect and start
- [30s-5min] Extreme scenarios run (may see high CPU/memory)
- [5-20min] Unusual content tests (network delays expected)
- [20-30min] Error condition tests (some errors expected)
- [30-40min] Platform and security tests
- [40-45min] Results saved, summary printed

---

## Aborting the Test Suite

### Graceful Abort
```bash
# Press Ctrl+C once
# Suite will attempt to cleanly close WebSocket and save partial results
```

### Force Abort
```bash
# Press Ctrl+C twice (force kill)
# Or: pkill -9 node
```

**Note:** Partial results will still be saved if abort occurs after 5+ tests.

---

## Post-Test Analysis

### Quick Analysis
```bash
# View summary
tail -20 tests/results/EDGE-CASE-FINDINGS-2026-05-11.json

# Extract issues
jq '.categories[].issues' tests/results/EDGE-CASE-FINDINGS-2026-05-11.json

# Count failures by category
jq '.categories | to_entries | map({category: .key, failed: .value.failed})' tests/results/EDGE-CASE-FINDINGS-2026-05-11.json
```

### Detailed Analysis
```bash
# View full results with pretty printing
jq '.' tests/results/EDGE-CASE-FINDINGS-2026-05-11.json

# Export to HTML report (if needed)
jq -r 'to_entries | .[] | "\(.key): \(.value.total) tests, \(.value.passed) passed"' tests/results/EDGE-CASE-FINDINGS-2026-05-11.json
```

---

## Next Steps After Testing

1. **Review Results**
   - Check pass rates against success criteria
   - Identify CRITICAL and HIGH severity issues
   - Record actual limits vs. projections

2. **Remediation (if needed)**
   - Follow EDGE-CASE-REMEDIATION-PLAN.md
   - Fix HIGH priority issues first
   - Re-run affected test subset

3. **Re-validation**
   - Run full edge case suite again
   - Verify no regressions in existing tests
   - Performance comparison to baseline

4. **Documentation**
   - Update API documentation with limits
   - Record known limitations
   - Update troubleshooting guide

5. **Release**
   - Create release notes with edge case findings
   - Tag version (e.g., v11.3.1)
   - Deploy to production

---

## Support & Questions

### Test Suite Issues
- Check test logic in: `tests/EDGE-CASE-TEST-SUITE-2026-05-11.js`
- Review remediation plan: `docs/EDGE-CASE-REMEDIATION-PLAN.md`
- Compare to projections: `tests/results/STRESS-LIMIT-ANALYSIS-2026-05-11.md`

### Server Issues
- Check server logs in: `logs/` directory
- Verify WebSocket connectivity: `curl ws://localhost:8765`
- Review WebSocket API: `docs/API-REFERENCE.md`

### General Questions
- See memory: `/home/devel/.claude/projects/.../MEMORY.md`
- See roadmap: `docs/ROADMAP.md`
- See deployment: `docs/DEPLOYMENT.md`

---

**Last Updated:** May 11, 2026  
**Next Review:** After test execution  
**Prepared by:** Claude Code

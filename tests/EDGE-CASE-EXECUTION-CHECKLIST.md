# Edge Case Test Suite - Execution Checklist

**Version:** 1.0  
**Date:** May 11, 2026  
**Test Suite:** EDGE-CASE-TEST-SUITE-2026-05-11.js  
**Expected Duration:** 45-60 minutes  
**Difficulty:** Intermediate

---

## Pre-Execution Setup (10 minutes)

### Environment Check
- [ ] Working directory: `/home/devel/basset-hound-browser`
- [ ] Node.js version: `node --version` (expect v18+)
- [ ] npm modules available: `npm list ws` (expect installed)
- [ ] Disk space: `df -h` (expect > 500MB free)
- [ ] Memory available: `free -h` (expect > 1GB free)
- [ ] CPU load: `uptime` (expect < 50% utilized)

### Server Startup
- [ ] Basset Hound server started
- [ ] Server listening on port 8765: `netstat -tlnp | grep 8765`
- [ ] WebSocket responding: Quick manual test
- [ ] Server logs clean: No ERROR messages
- [ ] All core features working: Test basic navigate + click

### Network Verification
```bash
# Run these checks before starting tests
curl -I https://httpbin.org/delay/1       # Should respond
curl -I https://example.com               # Should respond
curl -I https://react.dev                 # Should respond
curl -I https://vuejs.org                 # Should respond
curl -I https://angular.io                # Should respond
```
- [ ] All external URLs reachable
- [ ] No firewall/proxy blocking
- [ ] Network latency normal (< 100ms to google.com)
- [ ] No VPN/proxy interfering

### Test Preparation
- [ ] Results directory exists: `mkdir -p tests/results`
- [ ] Previous results backed up (if any)
- [ ] Test file permissions: `chmod +x tests/EDGE-CASE-TEST-SUITE-2026-05-11.js`
- [ ] Supporting docs reviewed
- [ ] Execution plan understood

---

## Execution Phase (45-60 minutes)

### Start Test Suite
```bash
cd /home/devel/basset-hound-browser
node tests/EDGE-CASE-TEST-SUITE-2026-05-11.js
```

- [ ] Tests start successfully
- [ ] WebSocket connection established
- [ ] First test begins within 5 seconds

### Monitor Execution
```bash
# In a separate terminal, monitor:
tail -f server.log
watch -n 2 'ps aux | grep node | grep -v grep'
watch -n 2 'free -h'
```

- [ ] Server remains responsive
- [ ] No ERROR messages in logs
- [ ] Memory usage stable (± 50MB)
- [ ] CPU usage reasonable (< 80%)
- [ ] No process crashes

### Expected Timeline
- **0-2 min:** Initial connection, setup
- **2-12 min:** Extreme scenarios (7 tests)
- **12-30 min:** Unusual content (9 tests, network delays)
- **30-40 min:** Error conditions (9 tests)
- **40-48 min:** Platform-specific (6 tests)
- **48-62 min:** Security boundary (8 tests)
- **62-70 min:** Additional stress (8 tests)
- **70-75 min:** Results saved, summary printed

### Observation Points
```
Timestamp    Expected Output                              What to Watch
-----------  -----------------------------------------    ----------------
0s           Starting Edge Case Test Suite v11.3.0...    Connection ready
1s           Connected to WebSocket server               Server responding
5s           === EXTREME SCENARIOS ===                   Tests beginning
12min        === UNUSUAL CONTENT TYPES ===               Network tests start
25min        === ERROR CONDITIONS ===                    Error recovery tests
35min        === PLATFORM-SPECIFIC EDGE CASES ===        OS detection
50min        === SECURITY BOUNDARY TESTS ===             Isolation verified
65min        === ADDITIONAL STRESS SCENARIOS ===         Final tests
75min        === TEST SUMMARY ===                        Results complete
```

### Intervention Points

#### If Tests Hang (> 5 min on single test)
1. Check server logs for errors
2. Verify network connectivity to external URL
3. Increase timeout in test file (line ~TIMEOUT)
4. Restart server if necessary
5. Resume tests from that point

#### If Server Crashes
1. Check error logs
2. Review recent changes
3. Restart server
4. Resume tests (partial results saved)
5. Document crash in results

#### If Memory Spikes
1. Monitor with `watch -n 1 'free -h'`
2. Expected: 100-300MB during heavy tests
3. If > 500MB, may indicate leak
4. Note specific test causing spike
5. Continue testing

#### If Network Fails
1. Check external URL availability
2. Verify no local firewall blocking
3. Test with curl
4. Skip external URL tests if needed
5. Note in results

---

## Test Execution Log Template

```
=== EDGE CASE TEST EXECUTION LOG ===
Date: [Today's Date]
Start Time: [Start Time]
Tester: [Your Name]
Environment: [Linux/macOS/Windows]

EXTREME SCENARIOS
[ ] Large HTML page (10MB+)           - Pass/Fail/Skip
[ ] Rapid clicking (50 clicks)        - Pass/Fail/Skip
[ ] Rapid profile switching           - Pass/Fail/Skip
[ ] Slow network (3G)                 - Pass/Fail/Skip
[ ] Concurrent operations (20x)       - Pass/Fail/Skip
[ ] Memory pressure (5 screenshots)   - Pass/Fail/Skip
[ ] Deep JavaScript nesting           - Pass/Fail/Skip

UNUSUAL CONTENT
[ ] React framework site              - Pass/Fail/Skip
[ ] Vue.js framework site             - Pass/Fail/Skip
[ ] Angular framework site            - Pass/Fail/Skip
[ ] WebGL/3D content site             - Pass/Fail/Skip
[ ] Service Worker site               - Pass/Fail/Skip
[ ] WebRTC site                       - Pass/Fail/Skip
[ ] Shadow DOM content                - Pass/Fail/Skip
[ ] Iframe handling                   - Pass/Fail/Skip
[ ] Heavy media site (YouTube)        - Pass/Fail/Skip

ERROR CONDITIONS
[ ] Invalid URL handling              - Pass/Fail/Skip
[ ] Non-existent selector             - Pass/Fail/Skip
[ ] Invalid command rejection         - Pass/Fail/Skip
[ ] Timeout handling                  - Pass/Fail/Skip
[ ] Connection recovery               - Pass/Fail/Skip
[ ] Memory exhaustion handling        - Pass/Fail/Skip
[ ] Malformed JSON recovery          - Pass/Fail/Skip
[ ] Missing parameters detection     - Pass/Fail/Skip
[ ] Rapid error recovery             - Pass/Fail/Skip

PLATFORM-SPECIFIC
[ ] Platform detection                - Pass/Fail/Skip
[ ] File path handling                - Pass/Fail/Skip
[ ] Line ending handling              - Pass/Fail/Skip
[ ] Headless mode detection          - Pass/Fail/Skip
[ ] Window size detection             - Pass/Fail/Skip
[ ] Color space detection             - Pass/Fail/Skip

SECURITY BOUNDARY
[ ] XSS payload handling              - Pass/Fail/Skip
[ ] Command injection prevention      - Pass/Fail/Skip
[ ] Profile data isolation            - Pass/Fail/Skip
[ ] Local storage isolation           - Pass/Fail/Skip
[ ] Cookie handling                   - Pass/Fail/Skip
[ ] CORS compliance                   - Pass/Fail/Skip
[ ] Password field handling           - Pass/Fail/Skip
[ ] Cache control                     - Pass/Fail/Skip

ADDITIONAL STRESS
[ ] Zero timeout handling             - Pass/Fail/Skip
[ ] Negative timeout handling         - Pass/Fail/Skip
[ ] Large number handling             - Pass/Fail/Skip
[ ] Empty command rejection           - Pass/Fail/Skip
[ ] Very long selector handling       - Pass/Fail/Skip
[ ] Binary data handling              - Pass/Fail/Skip
[ ] Unicode emoji handling            - Pass/Fail/Skip
[ ] RTL text handling                 - Pass/Fail/Skip

End Time: [End Time]
Total Duration: [Duration]
Issues Found: [Count]
Critical Issues: [Count]
Notes: [Any issues encountered]
```

---

## Post-Execution Analysis (15 minutes)

### Collect Results
- [ ] Results JSON saved: `tests/results/EDGE-CASE-FINDINGS-2026-05-11.json`
- [ ] Test completed or aborted cleanly
- [ ] No corrupted output files
- [ ] Execution log captured

### Review Results
```bash
# Quick review
cat tests/results/EDGE-CASE-FINDINGS-2026-05-11.json | jq '.'

# Count passes/failures
cat tests/results/EDGE-CASE-FINDINGS-2026-05-11.json | jq '.categories | map({category: .key, passed: .value.passed, failed: .value.failed})'

# Extract all issues
cat tests/results/EDGE-CASE-FINDINGS-2026-05-11.json | jq '.categories[].issues'
```

- [ ] Results file valid JSON
- [ ] All categories included
- [ ] Test counts match (47 total)
- [ ] Pass rate calculated
- [ ] Issues documented

### Analyze Pass Rate
| Actual Pass Rate | Assessment | Action |
|-----------------|-----------|--------|
| ≥ 90% | ✅ Excellent | Production ready |
| 80-89% | ✅ Good | Minor fixes needed |
| 70-79% | ⚠️ Acceptable | Moderate fixes needed |
| < 70% | ❌ Poor | Major remediation needed |

- [ ] Pass rate ≥ 70% (minimum acceptable)
- [ ] Critical issues < 2
- [ ] High issues < 5
- [ ] Limits documented

### Issue Triage
- [ ] All issues categorized by severity
- [ ] Root causes identified
- [ ] Impact assessed
- [ ] Remediation plan reviewed (docs/EDGE-CASE-REMEDIATION-PLAN.md)

### Create Summary Report
```bash
# Generate summary
cat tests/results/EDGE-CASE-FINDINGS-2026-05-11.json | jq '{
  test_date: .test_date,
  total_tests: .total_tests,
  total_passed: .total_passed,
  total_failed: .total_failed,
  pass_rate: .pass_rate,
  duration_seconds: .test_duration_seconds,
  critical_issues: [.categories[].issues[] | select(.severity == "CRITICAL")],
  high_issues: [.categories[].issues[] | select(.severity == "HIGH")]
}' > tests/results/EDGE-CASE-SUMMARY-2026-05-11.json
```

- [ ] Summary created
- [ ] Key findings documented
- [ ] Critical/High issues listed
- [ ] Recommendations generated

---

## Decision Criteria

### Go/No-Go Decision

#### GO - Production Ready (≥ 90% pass rate)
- [ ] No CRITICAL issues
- [ ] ≤ 2 HIGH issues (documented workarounds)
- [ ] Pass rate ≥ 90%
- [ ] All security tests pass
- [ ] All error handling tests pass

**Action:** Deploy v11.3.0 to production

#### CONDITIONAL - Fix and Re-test (80-89% pass rate)
- [ ] < 3 CRITICAL issues
- [ ] Fix all CRITICAL issues
- [ ] Fix top 3 HIGH priority issues
- [ ] Re-run affected test subsets

**Action:** Apply fixes, run edge case subset, then deploy

#### NO-GO - Major Remediation Needed (< 80% pass rate)
- [ ] ≥ 3 CRITICAL issues OR
- [ ] > 5 HIGH issues OR
- [ ] Core functionality broken

**Action:** Hold for release, major remediation required

---

## Sign-Off

### Execution Record
- **Date Executed:** _______________
- **Tester Name:** _______________
- **Start Time:** _______________
- **End Time:** _______________
- **Total Duration:** _______________
- **Pass Rate:** _______________%
- **Issues Found:** _______________
- **Status:** ☐ PASS ☐ CONDITIONAL ☐ FAIL

### Issues Summary
- **CRITICAL:** _____ (must fix before deploy)
- **HIGH:** _____ (fix before deploy)
- **MEDIUM:** _____ (fix for next release)
- **LOW:** _____ (cosmetic, document)

### Reviewer Sign-Off
- **Reviewed By:** _______________
- **Date Reviewed:** _______________
- **Approved For Deploy:** ☐ Yes ☐ No ☐ With Fixes
- **Comments:** _________________________________________________

### Next Steps
- [ ] Results documented
- [ ] Issues assigned
- [ ] Remediation planned
- [ ] Timeline scheduled
- [ ] Stakeholders notified

---

## Quick Reference Commands

### Before Test
```bash
# Prepare environment
cd /home/devel/basset-hound-browser
mkdir -p tests/results
npm list ws                                    # Verify ws installed
which node                                     # Verify node available
netstat -tlnp | grep 8765                     # Verify server running
```

### During Test
```bash
# In separate terminals
tail -f server.log                             # Watch server logs
watch -n 2 'ps aux | grep basset'             # Watch process
watch -n 2 'free -h'                          # Watch memory
curl -I https://httpbin.org/delay/1           # Verify network
```

### After Test
```bash
# Analyze results
cat tests/results/EDGE-CASE-FINDINGS-2026-05-11.json | jq .
jq '.categories | map({category: .key, pass: .value.passed, fail: .value.failed})' tests/results/EDGE-CASE-FINDINGS-2026-05-11.json
jq '[.categories[].issues[] | select(.severity == "CRITICAL")]' tests/results/EDGE-CASE-FINDINGS-2026-05-11.json
```

### Troubleshooting
```bash
# Test server connectivity
curl -X GET ws://localhost:8765                # May fail but shows server
node -e "const ws = require('ws'); const c = new ws.Server({port: 8765}); console.log('Server OK'); process.exit();"

# Check recent server errors
tail -100 server.log | grep ERROR

# View test file
head -100 tests/EDGE-CASE-TEST-SUITE-2026-05-11.js
```

---

## Support Contacts

### If Issues Arise

**Test Suite Bugs:**
- Review test file: `tests/EDGE-CASE-TEST-SUITE-2026-05-11.js`
- Check expectations: `tests/EDGE-CASE-TEST-README.md`

**Server Issues:**
- Check logs: `server.log` or similar
- Restart server
- Review deployment: `docs/DEPLOYMENT.md`

**System Issues:**
- Free up memory: `free -h`, close applications
- Restart system if needed
- Check disk space: `df -h`

**Network Issues:**
- Test connectivity: `curl -I https://httpbin.org`
- Check DNS: `nslookup httpbin.org`
- Verify no firewall blocking

---

## Document Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | May 11, 2026 | Initial creation for v11.3.0 edge case testing |

---

**Prepared by:** Claude Code  
**Date:** May 11, 2026  
**Status:** Ready for execution  
**Expected Completion:** May 11, 2026 (after running tests)

**Next Review:** Immediately after test execution completes

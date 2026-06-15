# Phase 2 Bug Prioritization & Fix Roadmap
**Generated from Phase 1 Validation Analysis**  
**Date:** June 14, 2026  
**For:** Phase 2 Development Team  
**Scope:** 13 identified bugs, prioritized for v12.6.0 release

---

## Overview

Phase 1 validation identified 13 bugs across 4 severity categories. This document provides:
- Prioritized fix sequence
- Estimated effort for each bug
- Dependencies between fixes
- Phase 2 sprint allocation

---

## Critical Priority (MUST FIX - Blocks Release)

### P1-001: Electron Headless Mode Support
**Bug ID:** BUG-002  
**File:** `src/main/main.js` (lines 6-11)  
**Severity:** CRITICAL  
**Current Code:**
```javascript
if (!app) {
  console.error('[main.js] FATAL: Electron app not available...');
  process.exit(1);
}
```

**Problem:** 
- Docker container cannot start because Electron requires GUI
- Validation fails with: "Electron app not available"
- Blocks v12.6.0 Docker deployment

**Root Cause:**
- Electron.app requires display server (X11/Wayland)
- Headless environments don't have display

**Solution Options:**
1. **Option A: Use Xvfb (6-8 hours)**
   - Install virtual display server in Docker
   - Modify Dockerfile to launch Xvfb before Electron
   - Add `DISPLAY=:99` to environment
   - Pros: Minimal code changes
   - Cons: Additional Docker layer

2. **Option B: Detach Electron GUI (3-4 hours)**
   - Create headless Electron wrapper
   - Use `offscreen` rendering mode
   - Decouple browser from GUI thread
   - Pros: Native headless support
   - Cons: Refactor required

**Recommendation:** Option A (faster to release)

**Implementation Steps:**
1. [ ] Modify `config/docker/Dockerfile` to add Xvfb
2. [ ] Add `DISPLAY` environment variable setup
3. [ ] Test Docker container startup
4. [ ] Verify WebSocket server responds on port 8765
5. [ ] Update deployment documentation

**Estimated Effort:** 6 hours  
**Assigned To:** Senior Backend Engineer  
**Target Completion:** Day 1 of Phase 2 (June 24)  
**Blocker for:** Docker deployment, production release

---

### P1-002: WebSocket Timeout for Large HTML
**Bug ID:** BUG-001  
**File:** `websocket/server.js` (line ~580)  
**Severity:** CRITICAL  
**Current Code:**
```javascript
const timeout = setTimeout(() => {
  reject(new Error(`Command timeout: ${command.command}`));
}, 30000); // 30-second hardcoded timeout
```

**Problem:**
- Large page HTML captures (>10MB) timeout and fail
- No streaming support for large responses
- Real websites (Wikipedia articles, documentation) fail

**Expected Impact:**
- Tier 1 test: Wikipedia article capture fails
- Tier 1 test: Large documentation sites fail
- Success rate drops 10-15% with large pages

**Root Cause:**
- Fixed 30-second timeout is too short for large captures
- No response streaming (sends entire response at once)
- WebSocket frame size limits (64KB frames)

**Solution:**
1. [ ] Implement response streaming for `get_content`
2. [ ] Add chunked transfer protocol
3. [ ] Increase timeout to 60 seconds for large operations
4. [ ] Add progress indicators
5. [ ] Test with 10MB+ HTML documents

**Implementation Steps:**
```javascript
// Before
const content = await extractFullHTML(page); // Fails if >10MB
ws.send(JSON.stringify({ content }));

// After
const stream = await extractHTMLStream(page);
while (hasData = stream.read()) {
  ws.send(Buffer.concat([CHUNK_HEADER, data]));
}
ws.send(JSON.stringify({ status: 'complete' }));
```

**Estimated Effort:** 4 hours  
**Assigned To:** Full-stack Engineer  
**Target Completion:** Day 2 of Phase 2 (June 25)  
**Depends On:** P1-001 (need working Docker first)

---

## High Priority (Should Fix - Impacts Reliability)

### P2-001: Async Test Pattern Migration
**Bug ID:** BUG-003  
**File:** Multiple integration test files (45+ files)  
**Severity:** HIGH (test infrastructure)  
**Current Pattern:**
```javascript
// ANTI-PATTERN: Mix of async and callback
test('should work', async (done) => {
  await someAsync();
  done(); // Jest rejects this
});
```

**Correct Pattern:**
```javascript
// GOOD: Pure async
test('should work', async () => {
  await someAsync();
});
```

**Impact:**
- 250+ test failures that don't reflect product issues
- Hard to distinguish real failures from test framework problems
- Blocks CI/CD automation

**Root Cause:**
- Legacy test code mixed patterns
- Jest doesn't support mixing `done()` and async/await

**Solution:**
1. [ ] Find all test files with mixed patterns
2. [ ] Remove `done` callback parameter
3. [ ] Replace `done()` calls with `return`
4. [ ] Test suite should rerun and show real failures

**Affected Files (Sample):**
- `tests/integration/full-forensic-workflow.test.js` (15 tests)
- `tests/integration/extension-communication/*.test.js` (6 files)
- `tests/stability/rate-limiter.test.js`
- `tests/stability/circuit-breaker.test.js`

**Implementation:**
```bash
# Find all test files with 'done' parameter
grep -r "test.*async.*done" tests/ --include="*.js" | wc -l
# Should show ~45 files

# Find-replace pattern
sed -i 's/async (done)/async ()/g' tests/**/*.test.js
sed -i 's/done();/return;/g' tests/**/*.test.js
```

**Estimated Effort:** 2-3 hours  
**Assigned To:** QA Engineer  
**Target Completion:** Day 1 of Phase 2 (June 24)  
**Blocker for:** Clean test results

---

### P2-002: Regex Pattern Validation
**Bug ID:** BUG-004  
**File:** `src/detection/tech-detector.js`  
**Severity:** HIGH (logging noise)  
**Current Error Messages:**
```
RegExp error: unterminated character class [ng-
RegExp error: unterminated character class [data-drupal-
```

**Problem:**
- External tech signatures contain invalid regex patterns
- Detection engine logs errors continuously
- Makes debugging harder, fills log files

**Root Cause:**
- External signature database contains malformed patterns
- No validation on pattern loading

**Solution:**
1. [ ] Add regex validation on load
2. [ ] Log and skip invalid patterns
3. [ ] Create fallback for skipped patterns
4. [ ] Reduce error noise significantly

**Implementation:**
```javascript
function validateRegex(pattern) {
  try {
    new RegExp(pattern);
    return true;
  } catch (e) {
    console.warn(`Invalid regex pattern: ${pattern}`, e.message);
    return false;
  }
}

// Load only valid patterns
const validPatterns = externalSignatures.filter(validateRegex);
```

**Estimated Effort:** 30 minutes - 1 hour  
**Assigned To:** Frontend/Detection Engineer  
**Target Completion:** Day 1 of Phase 2 (June 24)  

---

### P2-003: WebSocket Port Conflict Resolution
**Bug ID:** BUG-005  
**File:** `tests/integration/protocol.test.js`  
**Severity:** HIGH (CI/CD blocker)  
**Current Error:**
```
EADDRINUSE: address already in use :::8773
```

**Problem:**
- Tests fail when run in parallel
- Hard-coded port 8773 conflicts
- CI pipeline cannot run concurrent tests

**Root Cause:**
- Fixed port allocation in test
- No proper cleanup between test suites
- Port remains bound after test failure

**Solution:**
1. [ ] Implement dynamic port allocation
2. [ ] Use port 0 for OS-assigned ports
3. [ ] Add cleanup handlers
4. [ ] Implement retry logic with backoff

**Implementation:**
```javascript
// Before
const server = http.createServer();
server.listen(8773);

// After
const server = http.createServer();
server.listen(0); // OS assigns available port
const port = server.address().port;

// Cleanup
afterAll(() => {
  server.close();
  return new Promise(r => setTimeout(r, 100)); // Wait for release
});
```

**Estimated Effort:** 1-2 hours  
**Assigned To:** QA Engineer  
**Target Completion:** Day 2 of Phase 2 (June 25)  

---

### P2-004: Cloudflare Detection & Response
**Bug ID:** BUG-006  
**File:** `websocket/server.js` - content extraction  
**Severity:** HIGH  
**Current Behavior:**
- Sites with Cloudflare protection fail silently
- No clear indication of CF challenge vs network error

**Problem:**
- Tier 2 tests will fail unexpectedly
- Cannot distinguish bot detection from connection errors

**Solution:**
1. [ ] Add Cloudflare challenge detection
2. [ ] Return explicit status for challenges
3. [ ] Document evasion options
4. [ ] Add retry with evasion enabled

**Expected Challenge Markers:**
- "Just a moment"
- "Checking your browser"
- "Challenge page"
- HTTP 403/429 with CF headers

**Estimated Effort:** 2-3 hours  
**Assigned To:** Evasion Framework Engineer  
**Target Completion:** Day 3 of Phase 2 (June 26)  

---

## Medium Priority (Nice to Fix - Improves Reliability)

### P3-001: CircuitBreaker Edge Cases
**Bug ID:** BUG-007  
**File:** `src/resilience/circuit-breaker.js`  
**Severity:** MEDIUM  
**Estimated Effort:** 1 hour  
**Target Completion:** Day 4 of Phase 2 (June 27)  

### P3-002: Memory Pool Cleanup
**Bug ID:** BUG-008  
**File:** `src/optimization/memory-pool-v2.js`  
**Severity:** MEDIUM  
**Estimated Effort:** 2-3 hours  
**Target Completion:** Day 4-5 of Phase 2  

### P3-003: Screenshot Compression Timeout
**Bug ID:** BUG-009  
**File:** `screenshots/compression-pipeline.js`  
**Severity:** MEDIUM  
**Estimated Effort:** 1-2 hours  
**Target Completion:** Day 5 of Phase 2  

### P3-004: Session Manager Race Condition
**Bug ID:** BUG-010  
**File:** `src/sessions/manager.js`  
**Severity:** MEDIUM  
**Estimated Effort:** 2 hours  
**Target Completion:** Day 5 of Phase 2  

---

## Low Priority (Defer - Quality of Life Improvements)

### P4-001: User Agent Entropy (BUG-011)
- Estimated Effort: 1 hour
- Target: v12.7.0 or later

### P4-002: Cookie Parsing Edge Cases (BUG-012)
- Estimated Effort: 1-2 hours
- Target: v12.7.0 or later

### P4-003: Geolocation Accuracy (BUG-013)
- Estimated Effort: 2 hours
- Target: v12.7.0 or later

---

## Phase 2 Sprint Plan

### Week 1 (June 24-28)
**Focus:** Critical blocking issues

**Day 1 (June 24):**
- [ ] P1-001: Electron headless mode (6h)
- [ ] P2-001: Async test patterns (2h)
- [ ] P2-002: Regex validation (1h)

**Day 2 (June 25):**
- [ ] P1-002: WebSocket timeout (4h)
- [ ] P2-003: Port conflicts (2h)
- [ ] Testing & validation (2h)

**Day 3 (June 26):**
- [ ] P2-004: Cloudflare detection (3h)
- [ ] Full regression testing (3h)
- [ ] Documentation update (2h)

**Day 4-5 (June 27-28):**
- [ ] P3-001 through P3-004 (8-10h total)
- [ ] Final validation (2h)
- [ ] Release candidate build (2h)

### Estimated Phase 2 Duration
**Total Effort:** 30-35 hours  
**Sprint Duration:** 5 working days  
**Completion Date:** June 28, 2026  
**Release Target:** June 29, 2026 (v12.6.0)

---

## Success Criteria for Phase 2

Phase 2 is complete when:
- [ ] All P1 bugs fixed and tested
- [ ] All P2 bugs fixed and tested  
- [ ] Regression test suite passes >95%
- [ ] Docker deployment successful
- [ ] Real-world site testing passes >80%
- [ ] No critical issues remain
- [ ] Release notes prepared
- [ ] v12.6.0 tagged in git

---

## Dependency Graph

```
P1-001 (Headless Mode)
  ↓ BLOCKS
P1-002 (Timeout Fix)
  ↓ DEPENDS ON
P1-001
  ↓ BLOCKS
P2-003 (Port Conflicts)
P2-004 (CF Detection)
  ↓ DEPENDS ON
P2-002 (Regex Validation)

P2-001 (Test Patterns) - INDEPENDENT
P3-* (Medium Priority) - INDEPENDENT
```

---

## Risk Assessment

### High Risk
- **P1-001 (Headless Mode):** If not fixed, cannot deploy to Docker
- **P1-002 (Timeout):** If not fixed, real sites with large pages fail

### Medium Risk
- **P2-001 (Test Patterns):** Hides real issues in test output
- **P2-003 (Port Conflicts):** Blocks CI/CD automation

### Low Risk
- **P3/P4 Bugs:** Can be deferred to v12.7.0 if needed

---

## Handoff Notes for Phase 2 Team

1. **Start with P1-001 first** - blocks everything else
2. **Verify Docker builds and runs** after P1-001
3. **Run full regression suite** before declaring each bug fixed
4. **Use test framework in /tests/phase1-real-world-validation.js** for final validation
5. **Document all fixes** in commit messages for traceability
6. **Update Phase 1 results** with actual fixes applied

---

**Document Owner:** Phase 1 QA Coordinator  
**Prepared For:** Phase 2 Development Lead  
**Date:** June 14, 2026  
**Status:** READY FOR PHASE 2 EXECUTION

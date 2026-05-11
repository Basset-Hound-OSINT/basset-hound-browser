# v11.3.0 Fixed - Redeploy & Re-test Plan
**Date:** May 8, 2026  
**Status:** Fixes committed, Docker rebuild in progress  
**Next Steps:** Deploy fixed image, re-run all validation tests

---

## What Was Fixed

### 1. ✅ WebSocket Parameter Nesting Bug (CRITICAL)
- **File:** websocket/server.js line 8284
- **Change:** `const { command, ...params }` → `const { command, params = {} }`
- **Impact:** Fixes 4/5 failing evasion tests
- **Risk:** LOW
- **Commit:** c2d965c

### 2. ✅ Scroll Behavior Implementation (HIGH)
- **File:** evasion/behavioral-ai.js lines 357-456
- **Change:** Enhanced from 41 to 100+ lines with realistic patterns
- **Impact:** Complete behavioral simulation for bot evasion
- **Risk:** LOW
- **Tests:** 9/9 passing
- **Commit:** c2d965c

### 3. ✅ Platform Type Detection (MEDIUM)
- **File:** evasion/fingerprint-profile.js
- **Change:** Added platform detection + enhanced forRegion()
- **Impact:** Proper platform diversity (no more Windows-only)
- **Risk:** LOW
- **Tests:** 14/14 passing
- **Commit:** c2d965c

---

## Deployment Steps (In Progress)

### Step 1: Docker Build (Currently Running)
```bash
docker build -t basset-hound:v11.3.0-fixed .
```
**Status:** Building with all 3 fixes integrated  
**ETA:** ~5-10 minutes

### Step 2: Stop Old Container & Deploy New
```bash
docker stop basset-hound-v11.3.0
docker rm basset-hound-v11.3.0
docker run -d --name basset-hound-fixed -p 8765:8765 --network basset-hound-browser basset-hound:v11.3.0-fixed
```
**Expected:** Container healthy within 30 seconds

### Step 3: Verify WebSocket Health
```bash
curl -s -i http://localhost:8765 | grep -q "426" && echo "✅ WebSocket Healthy"
```
**Expected:** HTTP 426 response (Upgrade Required)

---

## Re-testing Plan

Once deployment completes, re-run all 4 parallel test agents:

### Test Agent 1: Live Functionality
- Navigation (3+ sites)
- Screenshots (2+ captures)
- Tab management (7+ operations)
- Content extraction
- Memory stability
- **Expected:** 100% pass (previously 93.8%)

### Test Agent 2: Bot Evasion (Should now pass)
- Fingerprint validation
- Canvas/WebGL evasion
- Platform type checking
- Detection service tests
- Behavioral simulation
- **Expected:** 100% pass (was 66.7% due to bugs)

### Test Agent 3: Tor Integration
- Tor mode toggle
- Exit node verification
- Circuit rotation
- Performance impact
- **Expected:** 100% pass (was already 67%)

### Test Agent 4: Stress & Performance
- Memory monitoring (P0 fix verification)
- Throughput testing
- Latency validation
- Tab stability cycles
- Connection stress
- **Expected:** 100% pass (was already 100%)

---

## Success Criteria

All re-tests must show:
- ✅ Live Functionality: 100% pass (up from 93.8%)
- ✅ Bot Evasion: 100% pass (up from 66.7%)
- ✅ Tor Integration: 100% pass (was 67%)
- ✅ Stress & Performance: 100% pass (was 100%)

**Overall:** 100% pass rate across all 4 test suites (759+ operations)

---

## If Issues Found

Any remaining failures will trigger:
1. Root cause analysis
2. Targeted fix agents
3. Code changes
4. Rebuild
5. Redeploy
6. Re-test cycle repeats

Iteration continues until 100% pass rate achieved.

---

## Final Deliverables

Upon successful completion:
1. ✅ All 3 bugs fixed and verified
2. ✅ Docker image v11.3.0-fixed deployed
3. ✅ All 4 test suites passing 100%
4. ✅ Final validation report generated
5. ✅ Git commits documenting all changes
6. ✅ v11.3.0 PRODUCTION READY tag

---

**Target Timeline:** 
- Docker build: 5-10 minutes
- Container deploy: 1-2 minutes
- Health check: 1 minute
- Re-testing: 20-30 minutes
- **Total:** ~30-45 minutes to completion

---

*Continuous deployment and validation cycle in progress...*

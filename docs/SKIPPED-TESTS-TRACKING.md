# Skipped Tests Tracking & Enablement Plan

**Date Created:** June 21, 2026  
**Plan Version:** v12.1.0 Quality Improvement Initiative (Priority #3)  
**Status:** In Progress - Phase 1 Audit Complete

---

## Executive Summary

This document tracks all skipped, disabled, and conditional tests in the Basset Hound Browser test suite. The project has **37 test files with 99+ skip/todo instances** across integration, e2e, and unit tests.

**Categorization:**
- **Category A (Config-Based):** 4 files - Environment variable conditional skips
- **Category B (Dependency-Based):** 1 file - System dependency conditionals
- **Category C (Runtime Skips):** 5-10 files - Programmatic this.skip() calls
- **Category D (Mixed/Validation Needed):** ~20 files - False positives or need analysis

**Total Effort to Enable:** 9-14 hours (phased over 4 weeks)

---

## Category A: Configuration-Based Skips ✅ EASY FIX

These tests skip based on environment configuration variables. Enabling requires setting environment flags.

### A1: tests/wave13/feature-perf-integration.test.js
**Status:** describe.skip (entire suite disabled)  
**Reason:** "V8 memory allocation failures during Jest collection"  
**Root Cause:** Unknown - possibly Jest parser issue with mock objects  
**Lines:** 347  
**Effort:** 2-3 hours (investigate root cause, refactor if needed)  
**Recommendation:** MEDIUM PRIORITY - Investigate root cause, refactor mock classes or split file  
**Action Plan:**
- [ ] Check Jest version compatibility
- [ ] Review mock object initialization
- [ ] Consider splitting into smaller test files
- [ ] If fixable: implement fix and enable
- [ ] If not: move to Category C (defer)

### A2: tests/e2e/browser-automation.test.js
**Status:** CONFIG.SKIP_E2E conditional skip  
**Reason:** Environment variable SKIP_E2E or RUN_E2E not set  
**Lines:** 21, 448  
**Effort:** 0.5 hours (set environment variable)  
**Recommendation:** LOW PRIORITY - Works in CI/CD with proper env config  
**Action Plan:**
- [ ] Check if test infrastructure sets SKIP_E2E/RUN_E2E
- [ ] Enable tests by setting RUN_E2E=true in test config
- [ ] Verify Basset Hound Browser is running before test

### A3: tests/e2e/full-workflow.test.js
**Status:** CONFIG.SKIP_E2E conditional skip  
**Reason:** Same as A2  
**Lines:** 22  
**Effort:** 0.5 hours  
**Recommendation:** LOW PRIORITY  
**Action Plan:**
- [ ] Set RUN_E2E=true in CI configuration
- [ ] Ensure browser is available for E2E tests

### A4: tests/integration/evasion.test.js
**Status:** shouldSkip variable conditional  
**Reason:** Missing prerequisite (evasion module or WebSocket server)  
**Lines:** 26  
**Effort:** 1-2 hours (verify dependencies)  
**Recommendation:** MEDIUM PRIORITY - Check if dependencies are available  
**Action Plan:**
- [ ] Inspect shouldSkip condition
- [ ] Verify evasion module dependencies
- [ ] Enable if dependencies satisfied

---

## Category B: Dependency-Based Skips ✅ EASY FIX

These tests skip when system dependencies aren't available (e.g., OpenSSL not installed).

### B1: tests/unit/cert-generator.test.js
**Status:** Conditional on openSSLAvailable  
**Lines:** 56, 67, 78, 89, 100  
**Reason:** OpenSSL not available on test system  
**Effort:** 0.5 hours (check if OpenSSL is installed, or mock it)  
**Recommendation:** LOW PRIORITY - Tests appropriately conditional  
**Action Plan:**
- [ ] Verify OpenSSL is installed: `which openssl`
- [ ] If installed, tests auto-enable (no code change needed)
- [ ] If not installed, skip is appropriate (no action needed)
- [ ] Consider adding mock fallback for CI/CD

---

## Category C: Programmatic Runtime Skips 🔄 MEDIUM EFFORT

These tests use `this.skip()` inside test blocks, typically because prerequisites aren't met at runtime.

### C1: tests/integration/export-formats-api.test.js
**Status:** Multiple this.skip() calls (20+ instances)  
**Reason:** Likely checking for Basset Hound Browser availability  
**Effort:** 2-3 hours (analyze skip conditions, enable if prerequisites met)  
**Lines:** ~50+ scattered  
**Recommendation:** MEDIUM PRIORITY - Analyze skip reasons  
**Action Plan:**
- [ ] Review each this.skip() context
- [ ] Identify root cause (server down? feature unavailable?)
- [ ] If server dependency: ensure server running in tests
- [ ] If feature missing: remove skip or move to Feature branch
- [ ] Verify export format tests work with running server

### C2: tests/integration/critical-fixes-integration.test.js
**Status:** this.skip() calls  
**Reason:** Unknown - need to review  
**Effort:** 1-2 hours  
**Recommendation:** MEDIUM PRIORITY  
**Action Plan:**
- [ ] Review skip conditions
- [ ] Determine if critical or deferrable
- [ ] Enable if prerequisites can be satisfied

### C3: tests/integration/html-capture-websocket.test.js
**Status:** this.skip() calls  
**Reason:** Unknown - need to review  
**Effort:** 1-2 hours  
**Recommendation:** MEDIUM PRIORITY  
**Action Plan:**
- [ ] Review skip conditions
- [ ] Fix or defer accordingly

### C4-C5: tests/integration/extension-communication/* (5 files)
**Status:** Various this.skip() and shouldSkip conditions  
**Reason:** Extension communication tests likely need extension/browser setup  
**Effort:** 3-5 hours (verify extension framework)  
**Recommendation:** LOW-MEDIUM PRIORITY - Defer until extension framework ready  
**Action Plan:**
- [ ] Verify if extension framework is complete
- [ ] If complete: fix skip conditions, enable tests
- [ ] If incomplete: document dependency, defer to Phase 2

---

## Category D: Mixed / Needs Validation 🔍 VARIABLE EFFORT

These files appeared in grep results but skips may be false positives or unclear without deeper analysis.

### D1-D20: Various Files (validation needed)
**Files Include:**
- tests/unit/smart-form-filler.test.js (mentions 'skip' in test output, not actual skip)
- tests/unit/cookie-manager.test.js
- tests/unit/p2-002-regex-validation.test.js
- tests/security/path-validator.test.js
- tests/integration/automation.test.js
- tests/integration/browser-launch.test.js
- tests/integration/navigation.test.js
- tests/integration/protocol.test.js
- tests/integration/ssl-connection.test.js
- tests/integration/v12.2-comprehensive-integration.test.js
- tests/integration/phase6-features.test.js
- tests/integration/scenarios/* (4 files)
- tests/onboarding/onboarding-flow.test.js
- tests/performance/* (2 files)
- tests/archives/* (various)

**Action:** Need manual review to determine actual skip status  
**Effort:** 1-2 hours (review each file)  
**Recommendation:** LOW PRIORITY - Batch review after A/B/C

---

## Execution Plan by Phase

### Phase 1: Quick Wins (2-3 hours) ✅ NOW

Focus on Category A & B tests (config and dependency-based skips):

```
TIME: 2-3 hours
FILES: 6 (A1-A4, B1)
TESTS ENABLED: 0-10 (depends on root cause fixes)

1. Check E2E config (A2, A3)
   - Set RUN_E2E=true in CI
   - Verify browser running
   Time: 30 mins

2. Verify OpenSSL (B1)
   - Check if installed or mock
   Time: 15 mins

3. Investigate Wave 13 (A1)
   - Reproduce Jest memory issue
   - Refactor mock classes if needed
   Time: 1.5-2 hours

4. Verify evasion dependencies (A4)
   - Check module imports
   - Enable if deps satisfied
   Time: 30 mins
```

### Phase 2: Runtime Skip Analysis (4-6 hours) - NEXT

Focus on Category C tests (programmatic skips):

```
TIME: 4-6 hours
FILES: 5-10 (C1-C5)
TESTS ENABLED: 20-50 (depends on fixes)

1. Export formats API (C1)
   - Analyze skip conditions
   - Fix or document
   Time: 2 hours

2. Critical fixes integration (C2)
   - Review and fix
   Time: 1-2 hours

3. HTML capture WebSocket (C3)
   - Review and fix
   Time: 1 hour

4. Extension communication (C4-C5)
   - Defer if framework incomplete
   Time: 1-2 hours
```

### Phase 3: Category D Validation (1-2 hours)

```
TIME: 1-2 hours
FILES: ~20 (D1-D20)
ACTION: Batch review, categorize findings

1. Review each file for actual skips
2. Move Category D files to A/B/C
3. Remove false positives from tracking
```

---

## Success Criteria

✅ **Phase 1 Complete When:**
- E2E tests enabled with proper environment config
- OpenSSL dependency verified or mocked
- Wave 13 root cause investigated (fixed or deferred)
- Evasion test dependencies verified

✅ **Phase 2 Complete When:**
- Runtime skip conditions analyzed and documented
- Fixable skips have PRs in progress
- Non-fixable skips moved to Technical Debt doc
- 20-50 new tests enabled

✅ **Overall Success When:**
- 40+ tests newly enabled
- 30+ tests documented as blocked (Category B)
- 20+ tests deferred to v12.2.0 (Technical Debt)
- Test coverage increased by ~40 tests
- Zero regressions in enabled tests

---

## Technical Debt Tracking

### Category D: Deferred Tests (v12.2.0)

When Category D analysis reveals tests that require:
- Major refactoring
- Architectural changes
- Missing features

**Action:** Create GitHub issue and track in v12.2.0 roadmap

**Template:**
```
Title: [v12.2.0 Tech Debt] Enable <test_name> - requires <reason>

Body:
- File: <file path>
- Reason: <why it's skipped>
- Effort: <estimated hours>
- Blocker: <what needs to be fixed first>
- Priority: <high/medium/low>
```

---

## Appendix A: Current Skip Count by File Type

| Type | Files | Skips | Priority |
|------|-------|-------|----------|
| Configuration | 4 | 4 | HIGH |
| Dependency | 1 | 5 | MEDIUM |
| Runtime | 5-10 | 20-40 | MEDIUM-HIGH |
| Mixed | ~20 | 30-40 | LOW |
| **TOTAL** | **37** | **99+** | - |

---

## Appendix B: File-by-File Status

### Tests with Confirmed Skips

```
✅ CONFIRMED SKIP:
- tests/wave13/feature-perf-integration.test.js (describe.skip)
- tests/unit/cert-generator.test.js (conditional skip)
- tests/e2e/browser-automation.test.js (CONFIG.SKIP_E2E)
- tests/e2e/full-workflow.test.js (CONFIG.SKIP_E2E)
- tests/integration/evasion.test.js (shouldSkip variable)
- tests/integration/export-formats-api.test.js (20+ this.skip)
- tests/integration/critical-fixes-integration.test.js (this.skip)
- tests/integration/html-capture-websocket.test.js (this.skip)
- tests/integration/extension-communication/*.test.js (5 files, various)

⚠️ NEEDS VALIDATION:
- tests/unit/smart-form-filler.test.js
- tests/unit/cookie-manager.test.js
- tests/unit/p2-002-regex-validation.test.js
- tests/security/path-validator.test.js
- ~20 other files (see Category D)
```

---

## Next Steps

1. **Week 1:** Execute Phase 1 (Quick Wins)
   - [ ] Set CI/CD environment variables
   - [ ] Investigate Wave 13 memory issue
   - [ ] Verify dependencies

2. **Week 2:** Execute Phase 2 (Runtime Analysis)
   - [ ] Analyze Category C skips
   - [ ] Create PRs for fixable skips
   - [ ] Document non-fixable skips

3. **Week 3:** Execute Phase 3 (Category D Validation)
   - [ ] Review mixed/unclear files
   - [ ] Reclassify findings
   - [ ] Clean up tracking doc

4. **Week 4:** Review & Release
   - [ ] Verify all enabled tests pass
   - [ ] Run regression suite
   - [ ] Prepare v12.1.0 release notes

---

**Document Status:** ACTIVE - In Progress  
**Last Updated:** June 21, 2026  
**Owner:** Code Quality Agent  
**Related:** CODE-QUALITY-IMPROVEMENT-PLAN-2026-06-15.md

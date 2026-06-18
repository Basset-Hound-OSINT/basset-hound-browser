# Code Quality Improvement Plan - Executive Summary
**Project:** Basset Hound Browser v12.0.0 → v12.1.0  
**Date:** June 15, 2026  
**Status:** APPROVED FOR IMPLEMENTATION  

---

## Quick Facts

| Metric | Value |
|--------|-------|
| **Total Effort** | 30-50 dev-hours |
| **Timeline** | 4 weeks (June 15 - July 12) |
| **Priority Items** | 4 (WebSocket, Extraction, Tests, Validation) |
| **Quick Wins** | 3 (JSDoc, Architecture docs, TODO cleanup) |
| **Risk Level** | MEDIUM (refactoring + regression testing) |
| **Success Rate** | Very High (all low-risk improvements) |

---

## Priority 1: WebSocket Server Monolith Split ⭐⭐⭐⭐⭐

**Current State:**
- File: `/websocket/server.js`
- Size: 10,470 LOC (TOO LARGE)
- Complexity: 22 (TOO COMPLEX)
- Handles: HTTP setup, routing, all 164 commands, errors, middleware

**After Refactoring:**
- Split into 12 focused modules (<500 LOC each)
- New structure: handlers/ + middleware/ + utils/
- Complexity reduced to 8 per module
- Server.js becomes readable "index" file

**Files to Create:**
```
websocket/
├── server.js (refactored, 2K LOC)
├── handlers/
│   ├── connection-handler.js (400 LOC)
│   ├── command-handler.js (500 LOC)
│   └── error-handler.js (300 LOC)
├── middleware/
│   ├── authentication.js (150 LOC)
│   ├── rate-limiter.js (200 LOC)
│   └── logging.js (150 LOC)
└── utils/
    ├── command-registry.js (250 LOC)
    ├── response-formatter.js (200 LOC)
    └── command-constants.js (100 LOC)
```

**Effort:** 12-16 hours  
**Impact:** ⭐⭐⭐⭐⭐ Very High (foundation for v12.8.0)  
**Risk:** MEDIUM (refactoring + regression testing)  
**Timeline:** Week 1-2 (June 15-28)

---

## Priority 2: Extraction Manager Complexity Reduction ⭐⭐⭐⭐

**Current State:**
- File: `/extraction/manager.js`
- Size: 1,487 LOC
- Complexity: 73 (EXTREMELY HIGH)
- Does: Metadata extraction, content analysis, image processing, form detection, all mixed together

**After Refactoring:**
- Split into 4 focused modules
- ExtractionManager reduced to 600 LOC (orchestration only)
- Each processor <400 LOC, complexity <20

**Files to Create:**
```
extraction/
├── manager.js (refactored, 600 LOC)
├── image-processor.js (350 LOC)
├── form-detector.js (400 LOC)
└── content-analyzer.js (450 LOC)
```

**Effort:** 8-12 hours  
**Impact:** ⭐⭐⭐⭐ High (clearer, more testable)  
**Risk:** LOW (backward compatible)  
**Timeline:** Week 2-3 (June 22-July 5)

---

## Priority 3: Enable Skipped Tests ⭐⭐⭐⭐

**Current State:**
- 34 test files with skipped tests
- ~123 tests marked `.skip` or `.todo`
- Regression risk unknown

**After Refactoring:**
- 40 Category A tests enabled (simple fixes)
- 30 Category B tests documented (pending features)
- 20 Category C tests deferred (complex, tracked)
- 5 unused tests deleted

**Effort:** 4-6 hours  
**Impact:** ⭐⭐⭐⭐ High (+40 regression tests)  
**Risk:** LOW (testing only, no code changes)  
**Timeline:** Week 3-4 (June 29-July 12)

---

## Priority 4: Input Validation Hardening ⭐⭐⭐

**Current State:**
- No input validation on WebSocket commands
- Risk: injection attacks, DOS, type confusion
- All 164 commands accept raw input

**After Refactoring:**
- Validation schemas for all 164 commands
- Validation middleware integrated
- 15+ validation tests
- Secure defaults

**Files to Create/Modify:**
```
websocket/
├── utils/validation-schemas.js (new, ~250 LOC)
├── middleware/input-validation.js (new, ~150 LOC)
└── handlers/command-handler.js (modified, add validation step)
```

**Effort:** 6-8 hours  
**Impact:** ⭐⭐⭐ Medium (security hardening)  
**Risk:** LOW (additive, no logic changes)  
**Timeline:** Week 4 (July 6-12)

---

## Quick Wins ⭐⭐⭐

### 1. JSDoc Documentation (1-2 hours)
Add JSDoc to all public APIs in:
- `/websocket/server.js`
- `/extraction/manager.js`
- `/src/managers/`
- `/websocket/handlers/`
- `/websocket/middleware/`

**Benefit:** Improved code clarity, auto-generated docs

### 2. ARCHITECTURE.md (1-2 hours)
Create comprehensive architecture document:
- System overview with diagrams
- Request/response flow
- Command categories
- Performance characteristics
- Testing strategy
- Key decisions

**Benefit:** Onboarding, team alignment

### 3. TODO Cleanup (30 mins - 1 hour)
Convert loose TODOs into tracked issues:
- Find all TODO/FIXME comments
- Delete if fixed, promote to GitHub issues
- Convert limitations to JSDoc

**Benefit:** Reduced technical debt, clear priorities

---

## Timeline Overview

```
WEEK 1 (Jun 15-21): WebSocket Analysis & Planning
  └─ Create handlers/, establish split architecture

WEEK 2 (Jun 22-28): WebSocket Implementation & Testing
  └─ Implement all new modules, full regression testing

WEEK 3 (Jun 29-Jul 5): Extraction Refactoring + Skipped Tests
  └─ Split extraction manager, enable 40+ tests

WEEK 4 (Jul 6-12): Validation + Documentation
  └─ Input validation + JSDoc + ARCHITECTURE.md
```

**Total:** 30-50 dev-hours (7.5-10 hours/week)

---

## Success Criteria

✅ **All files <500 LOC** (except server.js entry point)  
✅ **Complexity reduced 50%+** (from 22-73 to <15)  
✅ **40+ tests enabled** (from skipped)  
✅ **100% of public APIs documented** (JSDoc)  
✅ **Zero regressions** (all 164 WebSocket commands work)  
✅ **ARCHITECTURE.md created** (comprehensive)  

---

## File References

**Full Plan:** `/home/devel/basset-hound-browser/docs/findings/CODE-QUALITY-IMPROVEMENT-PLAN-2026-06-15.md`

**Sections:**
- Part 1: Priority Matrix & Timeline
- Part 2: P1 - WebSocket Monolith Split (detailed)
- Part 3: P2 - Extraction Manager (detailed)
- Part 4: P3 - Skipped Tests (detailed)
- Part 5: P4 - Input Validation (detailed)
- Part 6: Quick Wins & Documentation
- Part 7: Success Criteria & Rollout
- Part 8: Implementation Timeline (daily breakdown)
- Appendices: File sizes, risk assessment, dependencies, performance

---

## Next Steps

1. ✅ Review this plan with architecture team
2. ✅ Approve prioritization and timeline
3. ⏳ Create GitHub issues for each priority
4. ⏳ Assign developers
5. ⏳ Start P1 in Week 1 (June 15)

---

**Document Status:** APPROVED  
**Review Date:** June 15, 2026  
**Version:** 1.0 Final  
**Prepared By:** Code Architecture Agent

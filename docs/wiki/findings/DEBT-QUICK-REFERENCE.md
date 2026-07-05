# Technical Debt - Quick Reference Guide

**For:** Basset Hound Browser v12.8.0  
**Updated:** July 3, 2026  
**Status:** 23 debt items identified, 7.8/10 overall health

---

## 🔴 Critical Priority (FIX FIRST)

### 1. God Object: websocket/server.js (11,809 LOC)
- **Fix:** Decompose into CommandProcessor, ResponseFormatter, ErrorRecovery, MetricsCollector
- **Effort:** 3-4 weeks
- **ROI:** Maintainability++, Testability+++

### 2. God Object: src/main/main.js (3,056 LOC)
- **Fix:** Create BootstrapManager with DI container
- **Effort:** 2-3 weeks
- **ROI:** Initialization clarity, Better testing

### 3. Memory Leaks: Event Listeners (5+ files)
- **Fix:** Create ManagedEmitter wrapper class, add cleanup() calls
- **Effort:** 1-2 weeks
- **ROI:** Stability+++, Memory usage -10%

### 4. Unhandled Promise Chains (4 files)
- **Fix:** Add .catch() handlers to all promise chains
- **Effort:** 1 week
- **ROI:** Reliability++, Debugging+++

### 5. Hardcoded Config (224 instances)
- **Fix:** Migrate to config/defaults.js with env vars
- **Effort:** 1-2 weeks
- **ROI:** Testability+++, Deployment flexibility++

---

## 🟡 Medium Priority (DO NEXT)

### 6. Service Locator Anti-Pattern (192 singleton exports)
- **Fix:** Switch to factory functions + DI container
- **Effort:** 2-3 weeks
- **ROI:** Testability+++

### 7. Scattered Console Logging (2,469 statements)
- **Fix:** Migrate all to structured logger
- **Effort:** 1 week
- **ROI:** Debugging+++, Consistency++

### 8. Missing Input Validation (~6 functions)
- **Fix:** Add Joi schema validation for all commands
- **Effort:** 1-2 weeks
- **ROI:** Security++, Reliability++

### 9. Duplicate Manager Patterns (81 files)
- **Fix:** Use lazy-manager-registry consistently
- **Effort:** 1 week
- **ROI:** Maintenance+, Consistency++

### 10. Missing JSDoc Types (32 files)
- **Fix:** Add @param/@returns to websocket module
- **Effort:** 2 weeks
- **ROI:** IDE support++, Refactoring safety++

---

## 🟢 Low Priority (NICE-TO-HAVE)

### 11-15. Code Organization
- Large files > 1000 LOC (8 files)
- Deprecated `var` keyword (1 file)
- Mixed serialization concerns (34 files)
- Missing integration docs
- File naming consistency

**Effort:** 1-2 weeks cumulative  
**ROI:** Code cleanliness, onboarding

---

## ⚡ Quick Wins (Do Today)

| Item | Effort | Value | Status |
|------|--------|-------|--------|
| Migrate console.log → logger | 1 day | High | Ready |
| Fix `var` keyword file | 1 hr | Low | Ready |
| Add unhandled rejection handler | 1 day | High | Ready |
| Create config/defaults.js | 2 days | High | Ready |
| Add .catch() to 4 key files | 2 days | High | Ready |

---

## 📊 Implementation Timeline

```
WEEK 1-2 (v12.8.1):
├── ⚡ Quick wins (5 items)
└── 🔴 Start memory leak fixes

WEEK 3-4 (v12.9.0):
├── 🔴 Complete memory leak fixes
├── 🔴 Extract hardcoded config
├── 🟡 Add input validation
└── 🟡 Migrate to factory patterns

WEEK 5-8 (v12.9.0 continued):
├── 🔴 Decompose server.js (MAJOR)
├── 🔴 Refactor main.js bootstrap
└── 🟡 Add JSDoc type definitions

MONTH 2+ (v13.0.0):
├── Full testing & regression
├── Performance validation
└── Update integration docs
```

---

## 🎯 Success Metrics

**Before Refactor:**
- Largest file: 11,809 LOC (server.js)
- Console statements: 2,469
- Memory leaks: 5 identified
- Test coverage: 92.3%
- Cyclomatic complexity: HIGH

**After Refactor (Target):**
- Largest file: <2000 LOC
- Console statements: 0 (all structured logs)
- Memory leaks: 0
- Test coverage: >95%
- Cyclomatic complexity: MEDIUM
- Functions per file: <30
- Dependency depth: <4 levels

---

## 🚀 Getting Started

### Phase 1: Today (2-3 hours)
```bash
# 1. Review this assessment
# 2. Create GitHub issues for each debt item
# 3. Estimate effort with team
# 4. Pick one quick win to implement
```

### Phase 2: This Week (5 days)
```bash
# 1. Complete all quick wins
# 2. Start memory leak fixes
# 3. Create test suite for monitoring
# 4. Set up performance baseline
```

### Phase 3: Next 4 Weeks
```bash
# Follow the implementation timeline above
# Each phase should have:
# - Code review PR
# - Full test suite run
# - Performance benchmarking
# - Team validation
```

---

## 📚 Supporting Resources

- Full assessment: `/docs/wiki/findings/TECHNICAL-DEBT-ASSESSMENT.md`
- Memory profiling: Use `clinic.js` for leak detection
- Code metrics: Run `npm run lint:check` + SonarQube
- Type definitions: Start with `@types/ws`, `@types/node`
- Testing strategy: Jest unit + integration tests

---

## ❓ FAQ

**Q: Can we ship v12.9.0 before fixing this?**  
A: Yes. Current code is production-ready. Debt is manageable, not blocking.

**Q: What's the biggest bang for buck?**  
A: Event listener fixes (1-2 weeks effort, 15% stability gain) + promise handlers (1 week, 10% reliability).

**Q: Should we use TypeScript?**  
A: Not necessary. JSDoc + factory patterns get 80% of TypeScript benefits.

**Q: How do we prevent new debt?**  
A: Code review standards, lint rules, metric monitoring, architecture guidelines.

**Q: Can we parallelize the work?**  
A: Partially. Decomposing server.js blocks other changes. Do quick wins first.

---

## 📞 Questions?

Review the full assessment document for detailed remediation strategies, code examples, and risk analysis.

**File:** `/docs/wiki/findings/TECHNICAL-DEBT-ASSESSMENT.md`  
**Created:** July 3, 2026

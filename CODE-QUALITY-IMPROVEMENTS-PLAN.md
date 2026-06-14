# Code Quality Improvements - Action Plan
**Generated:** June 13, 2026  
**Duration:** 10-12 hours  
**Target Release:** v12.1.0

## Phase 1: Duplication Elimination (3.5 hours)

### 1.1 Merge Forensic Report Generators
**Files:** 
- `/src/analysis/forensic-report-generator.js` (607 lines)
- `/src/export/forensic-report-generator.js` (713 lines)
**Status:** DUPLICATE - 70% overlap
**Action:** 
- Create unified module `/src/reporting/forensic-generator.js`
- Extract strategy pattern for different output formats
- Remove both originals
**Impact:** -400-500 lines saved, single source of truth

### 1.2 Consolidate Technology Detection
**Files:**
- `/src/analysis/tech-detector.js` (538 lines)
- `/src/analysis/technology-detector.js` (482 lines)
- `/src/detection/detector.js` (312 lines)
**Status:** 3-way partial duplication
**Action:**
- Standardize on `/src/detection/unified-detector.js` (exists)
- Migrate analysis module to use detection layer
- Remove legacy detectors
**Impact:** -400 lines, improved maintainability

### 1.3 Extract Report Generation Base Class
**Files:**
- `/src/data/report-generator.js`
- `/src/features/report-generator.js`
**Status:** Similar but different implementations
**Action:**
- Create abstract base class `/src/core/base-report-generator.js`
- Implement strategy pattern for formats
**Impact:** -200 lines, reusable foundation

## Phase 2: Complexity Reduction (2.5 hours)

### 2.1 Refactor WebSocket Server Command Routing
**File:** `/websocket/server.js` (9,842 lines)
**Issues:**
- Hardcoded command handlers scattered throughout
- No command registry pattern
- Cyclomatic complexity: 15+
**Action:**
- Extract command registry system
- Create command handler base class
- Split handlers into separate files
**Impact:** Better testability, -800-1000 lines core logic

### 2.2 Simplify Detection Engine
**File:** `/src/detection/detector.js`
**Issues:**
- `_processDetections()` has cyclomatic complexity of 18
- Nested conditionals 6+ levels deep
**Action:**
- Extract detection processors into classes
- Use strategy pattern for detection types
- Reduce max complexity to <10
**Impact:** Better testability, improved readability

### 2.3 Break Down Large Signature Files
**File:** `/src/detection/tech-signatures.js` (29,263 lines)
**Issues:**
- Monolithic file
- Difficult to navigate and maintain
**Action:**
- Split by category: frameworks, CMS, servers, analytics, CDN, libraries, etc.
- Create index for dynamic loading
**Impact:** -8,000 lines per file, modular organization

## Phase 3: Error Handling Standardization (2 hours)

### 3.1 Implement Error Hierarchy
**Action:**
- Create `/src/core/errors.js` with custom error classes
- Implement: BrowserError, DetectionError, ExtractionError, etc.
- Add error codes and structured logging
**Impact:** Consistent error handling, easier debugging

### 3.2 Add Missing Try/Catch Blocks
**Coverage:** 40% → 95%
**Priority Areas:**
- Detection modules (45% coverage)
- Evasion coordinator (50% coverage)
- Extraction pipeline (55% coverage)
**Action:**
- Add try/catch blocks with proper error logging
- Implement error recovery strategies
**Impact:** +2,000 lines, better reliability

## Phase 4: Documentation Improvements (1.5 hours)

### 4.1 Add JSDoc to All Public Functions
**Current:** 80% coverage
**Target:** 100% coverage
**Action:**
- Add JSDoc comments to all public functions
- Add parameter types and return types
- Add usage examples for complex functions
**Impact:** +500 lines documentation

### 4.2 Create Module READMEs
**Action:**
- Create README.md for each major module
- Add architecture diagrams
- Document module boundaries
- Add usage examples
**Impact:** Improved discoverability

## Phase 5: Testing Improvements (1.5 hours)

### 5.1 Identify and Fill Coverage Gaps
**Current:** ~70% overall, 45-50% for critical modules
**Target:** 80%+ on critical paths
**Action:**
- Identify untested code paths in:
  - Detection modules (45% → 80%)
  - Evasion coordinator (50% → 85%)
  - Error paths (5% → 50%)
- Add edge case tests
- Add integration tests
**Impact:** +100 test cases, better reliability

### 5.2 Improve Test Quality
**Action:**
- Add test documentation
- Improve test readability
- Add performance tests for hot paths
- Standardize test setup/teardown
**Impact:** Better test maintainability

## Phase 6: Performance Optimization (1 hour)

### 6.1 Optimize Hot Paths
**Targets:**
- Regex pattern compilation (cache compiled patterns)
- Detection algorithms (use memoization)
- Iteration patterns (batch operations)
**Action:**
- Profile existing implementation
- Identify 10+ optimization opportunities
- Implement caching strategies
**Impact:** +5-10% throughput

## Phase 7: Security Hardening (0.5 hours)

### 7.1 Security Code Review
**Areas:**
- Input validation (40% of functions)
- Command injection prevention
- Credential handling
**Action:**
- Review for injection vulnerabilities
- Add input validation layer
- Implement allowlist for user input
**Impact:** Improved security posture

## Success Metrics

| Metric | Baseline | Target | Status |
|--------|----------|--------|--------|
| Code duplication | 6% | 2% | - |
| Complex functions | 18 | <5 | - |
| Error handling coverage | 40% | 95% | - |
| JSDoc coverage | 80% | 100% | - |
| Test coverage | 70% | 85%+ | - |
| Lines of code | 92,935 | 88,000-90,000 | - |
| Cyclomatic complexity (avg) | 8.5 | <6 | - |

## Deliverables

1. Unified forensic report generator
2. Consolidated technology detection module
3. Refactored WebSocket command routing
4. Extracted error hierarchy
5. 100+ new test cases
6. Complete JSDoc documentation
7. Module-level READMEs
8. Final report: `/docs/findings/CODE-QUALITY-IMPROVEMENTS-COMPLETE.md`

## Timeline

- **Phase 1**: 0-3.5h
- **Phase 2**: 3.5-6h
- **Phase 3**: 6-8h
- **Phase 4**: 8-9.5h
- **Phase 5**: 9.5-11h
- **Phase 6**: 11-12h
- **Phase 7**: 12-12.5h

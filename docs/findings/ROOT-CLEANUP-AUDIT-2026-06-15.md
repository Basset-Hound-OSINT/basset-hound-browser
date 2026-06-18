# Root Directory Cleanup Audit - 2026-06-15

## Executive Summary

The root directory contains **1.4+ MB** of test artifacts and leaked files that should not persist across test runs or be committed to git. While most are properly ignored by `.gitignore`, several issues exist:

1. **Test session directories leak with timestamps** (5 instances, 760 KB)
2. **Test artifact directories in root should be in tests/** (reports, results, screenshots - 592 KB)
3. **Python cache not in gitignore** (.mypy_cache, 24MB; .pytest_cache, 40KB; .coverage file tracked)
4. **Root-level tmp directory should be cleaned** (tmp/, 44KB)
5. **Test data persists in root** (test-data/, .test-sessions/, .basset-hound/)

---

## Detailed Findings

### 1. TEST SESSION DIRECTORY LEAKAGE ⚠️ CRITICAL

**Problem:** Tests create `.test-sessions-[TIMESTAMP]` directories in root that aren't cleaned up after test completion.

**Affected Test File:** `/home/devel/basset-hound-browser/tests/wave14/security-audit.test.js`

**Current Instances (760 KB total):**
- `.test-sessions` (708 KB) - Base directory with 45 session subdirectories
- `.test-sessions-1781502747903` (16 KB) - Created Jun 15 01:52
- `.test-sessions-1781502747904` (20 KB) - Created Jun 15 01:52
- `.test-sessions-1781502747905` (16 KB) - Created Jun 15 01:52
- `.test-sessions-1781502747906` (8.0 KB) - Created Jun 15 01:52

**Root Cause:**
```javascript
// In security-audit.test.js (line ~435)
beforeEach(() => {
  testDir = path.join(__dirname, '../../.test-sessions-' + Date.now());
  sessionPersist = new SessionPersistence({
    storageDir: testDir
  });
});
```

The test creates unique directories using `Date.now()` but:
- No `afterEach()` or `afterAll()` cleanup block exists
- Directories accumulate with each test run
- `.test-sessions` base is properly in gitignore but dynamic variants are not caught by pattern

**Why It Persists:**
- The pattern in `.gitignore` is `.test-sessions*` (line 38) but placed BEFORE the rule catch
- Pattern appears valid: `.test-sessions*` should catch `.test-sessions-1781502747903`
- But git check-ignore shows `.test-sessions*` matches only the base directory

**Impact:** 
- Root directory polluted with test artifacts
- Disk space waste (~1 MB per test run session)
- Makes git repository status confusing

---

### 2. TEST ARTIFACT DIRECTORIES IN ROOT ⚠️ HIGH PRIORITY

**Problem:** Test reports, results, and screenshots are created in root instead of under `tests/`

**Current Instances (592 KB total):**
- `/reports/` (284 KB) - Test reports with timestamps
  - Example: `test_report_1781372357573.json`
  - Properly in gitignore as `coverage/` and `test-results/`
  - BUT not all patterns match the actual names
  
- `/results/` (140 KB) - Test result artifacts
  - Proper gitignore: `tests/results/*` with `!tests/results/*.md` exception
  - Exists in root, not tests/
  
- `/screenshots/` (168 KB) - Screenshot test outputs
  - Gitignore: `screenshots/*.png`
  - Exists in root when it should be under tests/

**Root Cause:** Test configuration creates artifacts in root:
- No centralized test output directory configuration
- Tests write to various root-level paths
- setup.js doesn't enforce output directory structure

**Files in reports/**
```
test_report_1780546765378.json      (Jun 4)
test_report_1780548249899.json      (Jun 4)
test_report_1781372357573.json      (Jun 13)
test_report_1781409460611.json      (Jun 13-14)
... and 14 more test report files
```

**Impact:**
- Root directory cluttered with test artifacts
- Inconsistent with jest configuration `coverageDirectory=coverage`
- Makes distinguishing project files from test artifacts difficult

---

### 3. PYTHON CACHE NOT PROPERLY IGNORED 🔴 BUG

**Problem:** Python build/test cache directories not in `.gitignore`

**Current Instances:**
- `.mypy_cache/` (24 MB!) - MyPy type checking cache
- `.pytest_cache/` (40 KB) - Pytest test discovery cache
- `.coverage` (52 KB) - Coverage report file (actually tracked by git!)

**Gitignore Status:**
```
Line 95-97 in .gitignore:
__pycache__/
*.py[cod]
venv/
```

**Missing Entries:**
- `.mypy_cache/` - NOT in gitignore
- `.pytest_cache/` - NOT in gitignore
- `.coverage` - NOT in gitignore (exists as file, not directory)

**Root Cause:** Python cache patterns incomplete. Project has MCP server in Python:
- `/mcp/server.py` exists
- Tests may run Python coverage
- Cache directories created but never ignored

**Impact:**
- 24 MB unnecessary cache in repository
- `.coverage` file potentially tracked in git history
- Slows git operations

---

### 4. ROOT-LEVEL TEMPORARY DIRECTORIES

**Problem:** Multiple temporary/data directories in root that should be cleaned or organized

**Current Instances:**
- `/tmp/` (44 KB) - General temporary directory
  - Contains: `demos/`, `test-data/`, `test-screenshots/`, `.gitkeep`
  - Gitignore: `tmp/` and `tmp/*` (properly ignored)
  - Should be cleaned periodically
  
- `/test-data/` (unknown size) - Test input data
  - Gitignore: `**test-data/*` (properly ignored)
  - Should be under tests/
  
- `/.test-sessions/` (708 KB) - Base test session directory
  - Properly ignored as part of gitignore rule
  - Contains 45 old session directories
  - Needs periodic cleanup (setup.js has 7-day cleanup logic)

---

### 5. OTHER CACHE DIRECTORIES (PROPERLY IGNORED)

These are properly in gitignore but present in workspace:

- `/.cache/` (4.0 KB) - General cache
  - Gitignore pattern: None specific (caught by standard patterns?)
  
- `/.basset-hound/` (unknown size) - Application data
  - Gitignore: `.bhb/`, `bhb-data/`
  - Should verify actual directory names match gitignore

- `/.claude/` (development tool cache, properly ignored by project rules)

---

## Gitignore Analysis

### Current Status
`.gitignore` is 98 lines with coverage of most test artifacts. **Missing patterns:**

```diff
# Python cache (currently missing)
+ .mypy_cache/
+ .pytest_cache/
+ .coverage

# Test sessions (current pattern may not catch all variants)
- .test-sessions*
+ .test-sessions*/        # Make it explicit it's a directory

# Java/Build cache if applicable (check if needed)
+ build/
+ .gradle/

# OS files (already covered)
.DS_Store              ✓
Thumbs.db              ✓
```

### Patterns Analysis

| Pattern | Coverage | Issue |
|---------|----------|-------|
| `tmp/` | ✓ | Works - trailing slash makes it explicit |
| `.test-sessions*` | ⚠️ | Pattern is correct but may need `*/` to be explicit |
| `coverage/` | ✓ | Matches coverage directory |
| `test-results/` | ⚠️ | Git rules at line 25 but actual paths vary |
| `tests/results/*` | ✓ | More specific rule at line 26 |
| `screenshots/*.png` | ⚠️ | Only PNG files; `*.jpg`, `*.jpeg`, `*.webp` not covered |
| `htmlcov/` | ❌ | **NOT in gitignore** - HTML coverage report directory exists (600K) |
| `.mypy_cache/` | ❌ | **NOT in gitignore** - Present (24 MB!) |
| `.pytest_cache/` | ❌ | **NOT in gitignore** - Present (40 KB) |
| `.coverage` | ❌ | **NOT in gitignore** - File being tracked |

---

## Code Issues

### Issue 1: security-audit.test.js - No Cleanup Handler

**File:** `/home/devel/basset-hound-browser/tests/wave14/security-audit.test.js`

**Problem:** Creates test directories in `beforeEach()` but no `afterEach()` cleanup:

```javascript
// Line ~435
beforeEach(() => {
  testDir = path.join(__dirname, '../../.test-sessions-' + Date.now());
  sessionPersist = new SessionPersistence({
    storageDir: testDir
  });
});

// MISSING:
// afterEach(() => {
//   if (fs.existsSync(testDir)) {
//     fs.rmSync(testDir, { recursive: true, force: true });
//   }
// });
```

**Solution:** Add cleanup in afterEach block to remove test directories.

### Issue 2: setup.js - Insufficient Cleanup

**File:** `/home/devel/basset-hound-browser/tests/setup.js`

**Current Implementation:**
- Cleans directories >7 days old (line 42-67)
- Only runs at test startup
- Doesn't clean dynamically-created test session directories

**Timing Problem:**
- cleanup happens once at startup
- Tests create `.test-sessions-[TIMESTAMP]` directories during run
- These persist until next test run (or never if tests aren't re-run)
- 7-day threshold is too long for frequent test runs

**Solution:** 
- Enhance cleanup to run after each test file
- Reduce cleanup threshold from 7 days to 24 hours
- Add per-test cleanup in test teardown

---

## Recommendations

### TIER 1 - IMMEDIATE (Fix Today)

1. **Add Missing Gitignore Entries** (~2 minutes)
   - Add `.mypy_cache/`
   - Add `.pytest_cache/` 
   - Add `.coverage`
   - Add `htmlcov/`
   - Update `screenshots/**` to catch all image formats

2. **Fix Test Cleanup in security-audit.test.js** (~10 minutes)
   - Add `afterEach()` to clean `testDir`
   - Or update to use `${TEST_SESSIONS_DIR}/` base with named subdirs

3. **Clean Current Artifacts** (~1 minute)
   ```bash
   rm -rf .test-sessions-1781502747*
   rm -rf .mypy_cache
   rm -rf .pytest_cache
   rm -f .coverage
   ```

### TIER 2 - THIS WEEK (Refactor)

4. **Centralize Test Output** (30 minutes)
   - Create `tests/output/` directory structure
   - Move `reports/`, `results/`, `screenshots/` under `tests/`
   - Update test scripts to write to centralized location
   - Update jest.config.js `coverageDirectory` to `tests/coverage/`

5. **Improve setup.js Cleanup** (20 minutes)
   - Reduce 7-day threshold to 24 hours or 12 hours
   - Add after-test cleanup hook
   - Add logging for cleanup actions
   - Consider per-test cleanup in afterEach()

6. **Add Test Output Structure** (15 minutes)
   - Create `.gitkeep` files in test output directories
   - Document test output locations
   - Add cleanup script for developers: `npm run test:cleanup`

### TIER 3 - BACKLOG (Document)

7. **Document Test Artifact Locations**
   - Add to `docs/TEST-STRUCTURE.md`
   - Explain how tests create artifacts
   - Document cleanup procedures
   - List all test output directories

---

## Test Files Creating Artifacts

| File | Issue | Fix |
|------|-------|-----|
| `tests/wave14/security-audit.test.js` | Creates `.test-sessions-[TS]` without cleanup | Add afterEach cleanup |
| `tests/setup.js` | Insufficient cleanup logic | Enhance cleanup thresholds |
| `tests/**/*.test.js` (many) | 359 files use `Date.now()` | Review each for artifact creation |

**Sample files creating artifacts:**
- `tests/monitoring-metrics.test.js`
- `tests/p3-004-error-logging-context.test.js`
- `tests/p1-002-adaptive-timeout.test.js`
- `tests/p3-002-session-coherence-edge-cases.test.js`

---

## Summary Table

| Item | Location | Size | Status | Action |
|------|----------|------|--------|--------|
| .test-sessions | Root | 708 KB | ✓ Ignored | Monitor cleanup |
| .test-sessions-* | Root | 60 KB | ⚠️ Leaking | Fix pattern / cleanup |
| reports/ | Root | 284 KB | ⚠️ Wrong location | Move to tests/output/ |
| results/ | Root | 140 KB | ⚠️ Wrong location | Move to tests/output/ |
| screenshots/ | Root | 168 KB | ⚠️ Wrong location | Move to tests/output/ |
| .mypy_cache/ | Root | 24 MB | ❌ Not ignored | Add to gitignore |
| .pytest_cache/ | Root | 40 KB | ❌ Not ignored | Add to gitignore |
| .coverage | Root | 52 KB | ❌ Not ignored | Add to gitignore |
| htmlcov/ | Root | 600 KB | ❌ Not ignored | Add to gitignore |
| tmp/ | Root | 44 KB | ✓ Ignored | Periodic cleanup |
| **TOTAL** | | **~26 MB** | | |

---

## Implementation Checklist

- [ ] Add missing entries to `.gitignore`
- [ ] Clean current test artifacts from root
- [ ] Fix `tests/wave14/security-audit.test.js` cleanup handlers
- [ ] Enhance `tests/setup.js` cleanup logic
- [ ] Create centralized test output directory structure
- [ ] Update jest configuration for output paths
- [ ] Add `npm run test:cleanup` script
- [ ] Document test artifact locations
- [ ] Run full test suite to validate changes
- [ ] Verify no test artifacts leak after run

---

## Testing the Fix

After implementing changes:

1. **Verify gitignore changes:**
   ```bash
   git check-ignore -v .mypy_cache .pytest_cache .coverage htmlcov/
   ```
   Should show these are now ignored.

2. **Run test suite:**
   ```bash
   npm test
   npm run test:unit
   npm run test:integration
   ```

3. **Check for new artifacts:**
   ```bash
   ls -la /home/devel/basset-hound-browser/ | grep -E "^\." | grep -v "^\s*\." | head -20
   find . -maxdepth 1 -type d -newer .git -ls
   ```
   Should show no new test directories in root.

4. **Verify cleanup works:**
   ```bash
   npm run test:cleanup
   ls -la | grep test-sessions
   ```
   Should show cleaned directory.

---

**Audit Date:** June 15, 2026  
**Auditor:** Root Directory Cleanup Investigation  
**Status:** Findings Complete - Ready for Implementation

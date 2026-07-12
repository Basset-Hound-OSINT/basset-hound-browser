# Root Directory Cleanup Plan - Basset Hound Browser
**Date:** June 15, 2026  
**Status:** Ready for Execution  
**Priority:** HIGH  
**Estimated Duration:** 2-3 hours (all phases)  
**Risk Level:** LOW (with mitigation strategies)

---

## Executive Summary

The Basset Hound Browser root directory contains approximately **26 MB of leaked test artifacts** that should be excluded from version control. These artifacts stem from incomplete cleanup logic in test files and missing `.gitignore` patterns. This plan provides a phased approach to:

1. **Immediately** fix `.gitignore` and test cleanup logic
2. **Prevent future** artifact leakage through centralized test outputs
3. **Document** artifact management policy for all developers

---

## Current State Analysis

### Identified Problem Areas

#### 1. Root Directory Artifacts (~25.6 MB total)

| Artifact | Size | Count | Source | Gitignored |
|----------|------|-------|--------|-----------|
| `.test-sessions/` | 708 KB | 1 | test setup | ✅ Yes |
| `.test-sessions-*` | 60 KB | 4 | dated artifacts | ✅ Yes |
| `.mypy_cache/` | 24 MB | ~12K files | pytest runs | ❌ **NO** |
| `.pytest_cache/` | 40 KB | ~100 files | pytest runs | ❌ **NO** |
| `htmlcov/` | 816 KB | ~500 files | coverage reports | ❌ **NO** |
| `.coverage` | 52 KB | 1 | coverage data | ❌ **NO** |

**Total Leaked:** ~25.6 MB (89.5% is `.mypy_cache/`)

#### 2. Missing `.gitignore` Patterns

Current `.gitignore` at `/home/devel/basset-hound-browser/.gitignore` (line 94-98):

```
# Python (for any scripts)
__pycache__/
*.py[cod]
venv/
**/.claude/
```

**Missing patterns:**
- `.mypy_cache/` - Type checking cache (24 MB)
- `.pytest_cache/` - Pytest cache (40 KB)
- `.coverage` - Coverage data file (52 KB)
- `htmlcov/` - HTML coverage reports (816 KB)

#### 3. Test Cleanup Issues

**File:** `/home/devel/basset-hound-browser/tests/wave14/security-audit.test.js` (lines 428-440)

```javascript
beforeEach(() => {
  testDir = path.join(__dirname, '../../.test-sessions-' + Date.now());
  sessionPersist = new SessionPersistence({
    storageDir: testDir
  });
});

afterEach(() => {
  // Cleanup
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
});
```

**Issues:**
- ✅ `afterEach()` cleanup IS implemented (good)
- ❌ Cleanup only runs per test, not globally
- ❌ No cleanup for pytest artifacts
- ❌ Test results go to root instead of `tests/results/`

**File:** `/home/devel/basset-hound-browser/tests/setup.js` (lines 42-67)

```javascript
function cleanOldSessions() {
  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  // ... cleans sessions older than 7 days
}
```

**Issues:**
- ✅ Cleanup logic exists
- ❌ Only runs on startup (not after tests complete)
- ❌ Only targets `.test-sessions/`, ignores Python caches
- ❌ 7-day threshold is too long (leaves stale artifacts)

---

## Cleanup Execution Plan

### PHASE A: IMMEDIATE FIXES (30 minutes)

#### Task A1: Update `.gitignore` with Missing Patterns

**File:** `/home/devel/basset-hound-browser/.gitignore`

**Action:** Add 4 missing Python/testing cache patterns at line 98 (after existing Python section)

**Current (lines 94-98):**
```
# Python (for any scripts)
__pycache__/
*.py[cod]
venv/
**/.claude/
```

**Update to:**
```
# Python (for any scripts)
__pycache__/
*.py[cod]
venv/
.mypy_cache/
.pytest_cache/
.coverage
htmlcov/
**/.claude/
```

**Rationale:**
- `.mypy_cache/` - Type checking temporary files (24 MB)
- `.pytest_cache/` - Pytest configuration cache (40 KB)
- `.coverage` - Coverage instrumentation data (52 KB)
- `htmlcov/` - Generated HTML coverage reports (816 KB)

**Verification:** After update, these files will be ignored by git
```bash
git check-ignore -v .mypy_cache/
git check-ignore -v .pytest_cache/
git check-ignore -v .coverage
git check-ignore -v htmlcov/
```

---

#### Task A2: Fix Test Cleanup in `setup.js`

**File:** `/home/devel/basset-hound-browser/tests/setup.js`

**Current Issue:** Cleanup only runs at startup, not after test completion

**Update (add to existing `cleanOldSessions()` function):**

Modify line 42-67 to also handle Python caches:

**Action:** Replace the entire `cleanOldSessions()` function with:

```javascript
/**
 * Clean old test sessions (older than 7 days)
 * Also cleans Python caches and coverage artifacts
 */
function cleanOldSessions() {
  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  // 1. Clean test sessions in .test-sessions directory
  try {
    const files = fs.readdirSync(TEST_SESSIONS_DIR);

    files.forEach(file => {
      if (file === '.gitkeep') return;

      const filePath = path.join(TEST_SESSIONS_DIR, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > SEVEN_DAYS) {
        if (stats.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
      }
    });
  } catch (err) {
    console.warn(`Warning: Could not clean old test sessions: ${err.message}`);
  }

  // 2. Clean Python caches (if present)
  const pythonCaches = [
    path.resolve(__dirname, '..', '.mypy_cache'),
    path.resolve(__dirname, '..', '.pytest_cache'),
    path.resolve(__dirname, '..', '.coverage'),
    path.resolve(__dirname, '..', 'htmlcov')
  ];

  pythonCaches.forEach(cachePath => {
    try {
      if (fs.existsSync(cachePath)) {
        if (fs.statSync(cachePath).isDirectory()) {
          fs.rmSync(cachePath, { recursive: true, force: true });
          console.log(`✓ Cleaned ${cachePath}`);
        } else {
          fs.unlinkSync(cachePath);
          console.log(`✓ Removed ${cachePath}`);
        }
      }
    } catch (err) {
      console.warn(`Warning: Could not clean ${cachePath}: ${err.message}`);
    }
  });
}
```

**Rationale:**
- Adds cleanup for Python caches that may accumulate
- Runs on test suite startup (helps prevent leakage)
- Safe: Only removes known cache directories
- Backwards compatible: Checks existence before deleting

**Testing:** Run the test setup
```bash
node tests/setup.js
# Should output cleanup messages if artifacts exist
```

---

#### Task A3: Remove Current Root Artifacts

**File Locations:** Root directory

**Action:** Remove these directories/files from root (they're now gitignored and can be regenerated)

```bash
# Verify before deletion
git status --porcelain | grep -E '\.test-sessions|\.mypy_cache|\.pytest_cache|htmlcov|\.coverage'

# Remove test artifacts (safe - gitignored)
rm -rf .test-sessions .test-sessions-* .mypy_cache .pytest_cache .coverage htmlcov/

# Verify removal
ls -la | grep -E '\.test-sessions|\.mypy_cache|\.pytest_cache|htmlcov|\.coverage'
# Should show nothing
```

**Impact:** Reduces root directory by ~25.6 MB

**Verification:**
```bash
git status
# Should show as deleted/untracked removals that are now gitignored
git add .gitignore
git status
# Should be clean or only show intentional changes
```

---

### PHASE B: PREVENT FUTURE LEAKAGE (1-2 hours)

#### Task B1: Centralize Test Output Directory Structure

**Current State:** Test results scattered across root and `tests/results/`

**Action:** Create centralized `tests/output/` structure

```bash
# Create centralized output directory
mkdir -p tests/output/reports
mkdir -p tests/output/results
mkdir -p tests/output/screenshots
mkdir -p tests/output/coverage

# Create .gitkeep files to preserve structure
touch tests/output/.gitkeep
touch tests/output/reports/.gitkeep
touch tests/output/results/.gitkeep
touch tests/output/screenshots/.gitkeep
touch tests/output/coverage/.gitkeep
```

**Consolidation Plan:**
- `tests/results/` → `tests/output/results/` (existing test results)
- Coverage reports → `tests/output/coverage/`
- Screenshots → `tests/output/screenshots/`
- Test reports → `tests/output/reports/`

**Backward Compatibility:**
- Keep existing paths for now
- Update new tests to use `tests/output/`
- Phase migration over next release cycle

---

#### Task B2: Update `.gitignore` for Centralized Test Outputs

**File:** `/home/devel/basset-hound-browser/.gitignore`

**Add (at end of test artifacts section, around line 41):**

```
# Centralized test output directory (all temporary test artifacts)
tests/output/*
!tests/output/.gitkeep
!tests/output/*/.gitkeep
```

**Current section (lines 23-40):**
```
# Test artifacts
coverage/
test-results/
tests/results/*
!tests/results/.gitkeep
!tests/results/*.md
tests/screenshots/
tests/reports/
test-user-data*/
*.log
**/test-certs*/

# Test session & temporary test data (consolidated)
test-sessions/
tmp_tests/
.test-sessions*
.test-scratch*
tests/tmp/
```

**Update to add:**
```
# Centralized test output directory (all temporary test artifacts)
tests/output/*
!tests/output/.gitkeep
!tests/output/*/.gitkeep
```

**Rationale:**
- Single location for all test artifacts
- Cleaner repo structure
- Easier to manage exclusions
- `.gitkeep` files maintain directory structure

---

#### Task B3: Add Cleanup Handler to Global Test Setup

**File:** `/home/devel/basset-hound-browser/tests/setup.js`

**Add new function after `cleanOldSessions()` (after line 67):**

```javascript
/**
 * Register cleanup on test suite completion
 * Ensures test artifacts are cleaned up even on abnormal termination
 */
function registerTestCleanup() {
  // Clean on normal exit
  process.on('exit', (code) => {
    cleanOldSessions();
    cleanTestArtifacts();
  });

  // Clean on SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    console.log('\n✓ Cleaning up test artifacts before exit...');
    cleanOldSessions();
    cleanTestArtifacts();
    process.exit(0);
  });

  // Clean on uncaught exception
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception, cleaning up...');
    cleanOldSessions();
    cleanTestArtifacts();
    process.exit(1);
  });
}

/**
 * Clean all test artifacts from tests/output/ directory
 * Preserves .gitkeep files
 */
function cleanTestArtifacts() {
  const outputDir = path.resolve(__dirname, 'output');
  
  if (!fs.existsSync(outputDir)) return;

  try {
    const items = fs.readdirSync(outputDir);
    
    items.forEach(item => {
      if (item === '.gitkeep') return;
      
      const itemPath = path.join(outputDir, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        fs.rmSync(itemPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(itemPath);
      }
    });
    
    console.log(`✓ Cleaned test artifacts from ${outputDir}`);
  } catch (err) {
    console.warn(`Warning: Could not clean test artifacts: ${err.message}`);
  }
}
```

**Add to module exports (around line 86):**

```javascript
module.exports = {
  TEST_SESSIONS_DIR,
  ensureTestDirectories,
  cleanOldSessions,
  getTestSessionDir,
  registerTestCleanup,  // ADD THIS
  cleanTestArtifacts    // ADD THIS
};
```

**Add registration call at end of setup (after line 84):**

```javascript
// Run setup
ensureTestDirectories();
cleanOldSessions();
registerTestCleanup(); // ADD THIS LINE
```

**Rationale:**
- Cleanup runs on all exit conditions
- Prevents orphaned artifacts
- Handles both normal and abnormal exits
- Preserves `.gitkeep` for directory structure

---

#### Task B4: Add Pre-commit Hook (Optional but Recommended)

**File:** `.git/hooks/pre-commit` (create if not exists)

**Action:** Create a pre-commit hook to prevent artifact commits

**Content:**

```bash
#!/bin/bash
# Pre-commit hook: Prevent committing test artifacts

# List of patterns that should never be committed
FORBIDDEN_PATTERNS=(
  ".mypy_cache"
  ".pytest_cache"
  ".coverage"
  "htmlcov"
  ".test-sessions"
)

# Check for forbidden patterns in staged files
for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  if git diff --cached --name-only | grep -q "$pattern"; then
    echo "ERROR: Attempting to commit test artifacts matching: $pattern"
    echo "These files are automatically ignored. Please unstage them:"
    echo ""
    echo "  git reset HEAD <file>"
    echo ""
    exit 1
  fi
done

exit 0
```

**Make executable:**
```bash
chmod +x .git/hooks/pre-commit
```

**Rationale:**
- Prevents accidental artifact commits
- Fails fast with clear error message
- Catches issues before they reach git
- Optional: Can be skipped with `--no-verify` if needed

---

### PHASE C: DOCUMENTATION (30 minutes)

#### Task C1: Create Test Artifact Management Guide

**File:** `/home/devel/basset-hound-browser/docs/guides/TEST-ARTIFACT-MANAGEMENT.md`

**Content:**

```markdown
# Test Artifact Management Guide

## Overview
Test artifacts (screenshots, reports, coverage data, caches) should be managed carefully to keep the repository clean and maintainable.

## Artifact Categories

### 1. Test Output Artifacts (Temporary)
- **Location:** `tests/output/`
- **Gitignored:** Yes
- **Lifespan:** Cleaned after test run completion
- **Examples:**
  - Screenshots: `tests/output/screenshots/`
  - Test reports: `tests/output/reports/`
  - Coverage data: `tests/output/coverage/`
  - Test results: `tests/output/results/`

### 2. Python Cache Artifacts (Automatic)
- **Location:** Root directory (automatic creation)
- **Gitignored:** Yes
- **Lifespan:** Cleaned on test startup
- **Examples:**
  - `.mypy_cache/` - Type checking cache
  - `.pytest_cache/` - Pytest configuration cache
  - `.coverage` - Coverage instrumentation
  - `htmlcov/` - HTML coverage reports

### 3. Node Test Sessions (Controlled)
- **Location:** `.test-sessions/` and `.test-sessions-*`
- **Gitignored:** Yes
- **Lifespan:** Cleaned when older than 7 days
- **Examples:**
  - Session metadata
  - Browser profile backups
  - WebSocket logs

## Guidelines for Test Writers

### DO
✅ Write test output to `tests/output/` or temporary directories  
✅ Use cleanup handlers in `afterEach()` blocks  
✅ Let the test framework handle artifact cleanup  
✅ Reference artifacts in test reports, not in version control  

### DON'T
❌ Write test artifacts to root directory  
❌ Commit coverage reports or cache files  
❌ Create persistent test data in tracked directories  
❌ Rely on manual cleanup of test artifacts  

## Example: Adding a Test with Artifacts

```javascript
const path = require('path');
const fs = require('fs');

describe('My Feature Tests', () => {
  let testDir;

  beforeEach(() => {
    // Use tests/output/ or OS temp directory
    testDir = path.join(__dirname, '../../tests/output/my-test');
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Always cleanup after test completes
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('should do something', () => {
    const screenshotPath = path.join(testDir, 'screenshot.png');
    // ... test code ...
    // File is automatically cleaned up after test
  });
});
```

## Automatic Cleanup

The test suite automatically:
- Cleans Python caches (`.mypy_cache/`, `.pytest_cache/`, etc.) on startup
- Removes test sessions older than 7 days
- Cleans `tests/output/` on suite completion
- Handles cleanup on process exit (normal or abnormal)

## If Artifacts Accumulate

If you notice test artifacts accumulating in root:

1. **Verify** the patterns are gitignored:
   ```bash
   git check-ignore -v .mypy_cache/
   ```

2. **Clean** manually if needed:
   ```bash
   rm -rf .mypy_cache/ .pytest_cache/ .coverage htmlcov/ .test-sessions*
   ```

3. **Report** if cleanup isn't working (likely test that doesn't use afterEach)

## Related Configuration

- `.gitignore` - Prevents artifact commits
- `tests/setup.js` - Handles automatic cleanup
- `.git/hooks/pre-commit` - Prevents artifact commits (if enabled)
```

---

#### Task C2: Update Contributing Guide

**File:** `/home/devel/basset-hound-browser/docs/CONTRIBUTING.md`

If file exists, add section. If not, reference test-artifact-management.md in README.

**Add (if file exists, around "Test Guidelines" section):**

```markdown
### Test Artifacts

All test artifacts (screenshots, reports, logs) must be written to `tests/output/` or system temp directory, not the repository root.

**Key Rules:**
- Write output to `tests/output/` directory (auto-gitignored)
- Implement cleanup in `afterEach()` blocks
- Never commit `.mypy_cache/`, `.pytest_cache/`, `.coverage`, or `htmlcov/`

See [Test Artifact Management Guide](../guides/TEST-ARTIFACT-MANAGEMENT.md) for details.
```

---

## Implementation Sequence

### Week 1: Foundation (Day 1-2)

1. ✓ **Phase A1:** Update `.gitignore` with missing patterns
2. ✓ **Phase A2:** Update `tests/setup.js` with Python cache cleanup
3. ✓ **Phase A3:** Remove current root artifacts (`git add -A` cleanup)
4. ✓ **Create commit:** "fix: Add missing .gitignore patterns and test cleanup"

### Week 1: Prevention (Day 2-3)

5. ✓ **Phase B1:** Create `tests/output/` directory structure
6. ✓ **Phase B2:** Update `.gitignore` for `tests/output/*`
7. ✓ **Phase B3:** Add cleanup handlers to `tests/setup.js`
8. ✓ **Optional B4:** Add pre-commit hook
9. ✓ **Create commit:** "refactor: Centralize test output directory + add cleanup handlers"

### Week 1: Documentation (Day 3)

10. ✓ **Phase C1:** Create `docs/guides/TEST-ARTIFACT-MANAGEMENT.md`
11. ✓ **Phase C2:** Update `docs/CONTRIBUTING.md` (if exists)
12. ✓ **Create commit:** "docs: Add test artifact management guidelines"

---

## Risk Assessment

### Risk 1: Deleting Artifacts Loses Important Data

**Probability:** Low (artifacts are regeneratable)  
**Impact:** Medium (if data needed for debugging)

**Mitigation:**
- Artifacts are automatically regenerated by tests
- Test results are archived in `tests/results/` (not cleaned)
- Coverage reports can be regenerated with `npm run coverage`
- Use `--debug` flag to preserve artifacts if needed

**Recovery:** Run tests again to regenerate artifacts

---

### Risk 2: Moving Artifact Directories Breaks Test Paths

**Probability:** Medium (if tests hardcode paths)  
**Impact:** Medium (tests fail until fixed)

**Mitigation:**
- Use `path.join()` for all artifact paths
- Reference `tests/output/` directory via setup.js exports
- Update test paths during Phase B1
- Verify no hardcoded root paths in test code

**Verification:** Run full test suite after changes

---

### Risk 3: Cleanup Handlers Remove Needed Test Data

**Probability:** Low (only removes known cache types)  
**Impact:** Low (data is temporary)

**Mitigation:**
- Only remove specific known directories (`.mypy_cache/`, etc.)
- Preserve `.gitkeep` files (directory structure)
- Add `--preserve-artifacts` flag for debugging if needed
- Cleanup only runs on exit, not mid-test

**Configuration:** Edit `tests/setup.js` to add debug flag if needed:
```javascript
if (process.env.PRESERVE_ARTIFACTS !== 'true') {
  registerTestCleanup();
}
```

---

## Success Criteria

- ✅ **Root directory:** Clean after test runs (< 100 KB of test files)
- ✅ **All tests:** Pass with new cleanup logic in place
- ✅ **Git status:** Clean after test runs (`git status` shows nothing)
- ✅ **No leakage:** No new test artifacts in root within 2 weeks
- ✅ **Documentation:** Clear guidelines for all developers
- ✅ **Backward compatibility:** Existing tests work with new structure

---

## Verification Procedures

### Pre-Cleanup Verification
```bash
# Check current artifact size
du -sh /home/devel/basset-hound-browser/.mypy_cache/
du -sh /home/devel/basset-hound-browser/.pytest_cache/
du -sh /home/devel/basset-hound-browser/htmlcov/

# Check .gitignore current state
git check-ignore -v .mypy_cache/ .pytest_cache/ .coverage htmlcov/
```

### Post-Cleanup Verification
```bash
# Verify artifacts are gone
ls -la | grep -E '\.mypy_cache|\.pytest_cache|htmlcov'
# Should show nothing

# Verify .gitignore patterns work
git check-ignore -v .mypy_cache/ .pytest_cache/ .coverage htmlcov/
# Should show all patterns matched

# Run test suite
npm test
# All tests should pass with cleanup active

# Verify cleanup works
ls -la tests/output/
# Should only contain .gitkeep files after tests complete
```

### Post-Documentation Verification
```bash
# Verify documentation exists
ls -la docs/guides/TEST-ARTIFACT-MANAGEMENT.md
# Should exist

# Verify CONTRIBUTING.md mentions artifacts
grep -n "artifact" docs/CONTRIBUTING.md
# Should reference artifact management
```

---

## Dependencies & Prerequisites

### Required
- ✅ Git repository initialized
- ✅ Node.js 14+ (for test scripts)
- ✅ Read/write access to root directory

### Optional
- Git hooks support (for pre-commit)
- Coverage reporting tools (pytest, mypy)

### Conflicts
- None identified (all changes are additive or cleanup)

---

## Rollback Procedure

If issues arise, revert to previous state:

```bash
# Revert .gitignore changes
git checkout .gitignore

# Remove cleanup code from tests/setup.js (undo Phase A2, B3)
git checkout tests/setup.js

# Regenerate artifacts (if needed for debugging)
npm test  # Recreates test results
npm run coverage  # Recreates coverage reports
```

---

## Future Enhancements

### Phase D: Monitoring (Post-Cleanup)
- Add GitHub Actions check to prevent artifact commits
- Monitor root directory size (alert if > 50 MB)
- Track cleanup effectiveness metrics

### Phase E: Optimization (2-3 weeks post-cleanup)
- Implement artifact compression for archival
- Add artifact expiration policy (delete after N days)
- Create artifact dashboard for test reports

---

## Summary

This plan addresses root directory pollution through:

1. **Immediate fixes** - Update `.gitignore` and add cleanup logic (30 min)
2. **Structural improvements** - Centralize test outputs (1 hour)
3. **Prevention** - Add cleanup handlers and pre-commit hooks (1 hour)
4. **Documentation** - Clear guidelines for all developers (30 min)

**Total Time:** 2-3 hours  
**Artifact Reduction:** ~25.6 MB (89.5% of leaked content)  
**Future Prevention:** Automatic cleanup + developer guidelines

---

**Plan Status:** Ready for Execution  
**Next Step:** Execute Phase A (immediate fixes)

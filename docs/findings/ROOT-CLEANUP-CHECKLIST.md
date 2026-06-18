# Root Directory Cleanup - Quick Reference Checklist

**Date:** June 15, 2026  
**Estimated Time:** 2-3 hours  
**Status:** Ready for Execution

---

## Pre-Cleanup Snapshot

| Metric | Current | Target |
|--------|---------|--------|
| Root directory size | ~26 MB | < 100 KB (test artifacts) |
| .gitignore patterns | 69 lines | 73 lines |
| Missing patterns | 4 | 0 |
| Test output locations | Root + scattered | Centralized |

---

## Phase A: Immediate Fixes (30 minutes)

### A1. Update `.gitignore`
- [ ] Open: `/home/devel/basset-hound-browser/.gitignore`
- [ ] Find: `# Python (for any scripts)` section (line 94-98)
- [ ] Add 4 lines after `venv/`:
  ```
  .mypy_cache/
  .pytest_cache/
  .coverage
  htmlcov/
  ```
- [ ] Verify with: `git check-ignore -v .mypy_cache/`
- [ ] **Commit:** `git add .gitignore && git commit -m "fix: Add missing cache/coverage patterns to .gitignore"`

---

### A2. Update `tests/setup.js`
- [ ] Open: `/home/devel/basset-hound-browser/tests/setup.js`
- [ ] Replace: `cleanOldSessions()` function (lines 42-67)
- [ ] Add: Python cache cleanup logic (see plan Section B3)
- [ ] Verify: `node tests/setup.js` outputs cleanup messages
- [ ] **Commit:** `git add tests/setup.js && git commit -m "fix: Add Python cache cleanup to test setup"`

---

### A3. Remove Current Artifacts
- [ ] Backup (optional): `tar czf /tmp/cleanup-backup.tar.gz .mypy_cache .pytest_cache htmlcov`
- [ ] Delete:
  ```bash
  rm -rf .test-sessions .test-sessions-* .mypy_cache .pytest_cache .coverage htmlcov/
  ```
- [ ] Verify: `git status` shows only .gitignore changes
- [ ] **Commit:** `git add .gitignore && git commit -m "chore: Remove test artifacts from root directory"`

---

## Phase B: Prevent Future Leakage (1-2 hours)

### B1. Create Test Output Directory Structure
- [ ] Create directories:
  ```bash
  mkdir -p tests/output/{reports,results,screenshots,coverage}
  ```
- [ ] Add .gitkeep files:
  ```bash
  touch tests/output/.gitkeep
  touch tests/output/{reports,results,screenshots,coverage}/.gitkeep
  ```
- [ ] Verify structure: `find tests/output -type f -name .gitkeep`
- [ ] **Commit:** `git add tests/output && git commit -m "feat: Create centralized test output directory structure"`

---

### B2. Update `.gitignore` for `tests/output/`
- [ ] Open: `/home/devel/basset-hound-browser/.gitignore`
- [ ] Find: Test artifacts section (after line 40)
- [ ] Add before `test-sessions/`:
  ```
  # Centralized test output directory (all temporary test artifacts)
  tests/output/*
  !tests/output/.gitkeep
  !tests/output/*/.gitkeep
  ```
- [ ] Verify: `git check-ignore -v tests/output/reports/test.txt`
- [ ] **Commit:** `git add .gitignore && git commit -m "fix: Add tests/output directory to .gitignore"`

---

### B3. Add Cleanup Handlers to `tests/setup.js`
- [ ] Open: `/home/devel/basset-hound-browser/tests/setup.js`
- [ ] After `cleanOldSessions()` function (line 67), add:
  - `registerTestCleanup()` function
  - `cleanTestArtifacts()` function
- [ ] Update module.exports to include new functions
- [ ] Add to end: `registerTestCleanup();`
- [ ] Verify: `node tests/setup.js` doesn't error
- [ ] Test: Run test suite and check cleanup
- [ ] **Commit:** `git add tests/setup.js && git commit -m "feat: Add cleanup handlers for test artifacts"`

---

### B4. (Optional) Add Pre-commit Hook
- [ ] Create: `.git/hooks/pre-commit`
- [ ] Add: Forbidden patterns check
- [ ] Make executable: `chmod +x .git/hooks/pre-commit`
- [ ] Test: Try to stage `.mypy_cache/`, should fail
- [ ] **Commit:** `git add .git/hooks/pre-commit && git commit -m "fix: Add pre-commit hook to prevent artifact commits"`

---

## Phase C: Documentation (30 minutes)

### C1. Create Test Artifact Management Guide
- [ ] Create: `/home/devel/basset-hound-browser/docs/guides/TEST-ARTIFACT-MANAGEMENT.md`
- [ ] Sections to include:
  - Overview
  - Artifact categories
  - Guidelines for test writers
  - Automatic cleanup explanation
  - Troubleshooting
  - Related configuration
- [ ] Verify: File exists and renders correctly
- [ ] **Commit:** `git add docs/guides/TEST-ARTIFACT-MANAGEMENT.md && git commit -m "docs: Add test artifact management guidelines"`

---

### C2. Update Contributing Guide
- [ ] Check: Does `docs/CONTRIBUTING.md` exist?
- [ ] If yes:
  - [ ] Open file
  - [ ] Find: "Test Guidelines" section
  - [ ] Add: Test artifacts subsection (3-5 lines)
  - [ ] Reference: `docs/guides/TEST-ARTIFACT-MANAGEMENT.md`
  - [ ] **Commit:** `git add docs/CONTRIBUTING.md && git commit -m "docs: Add test artifact requirements to contributing guide"`
- [ ] If no:
  - [ ] Update: `README.md` with link to artifact management guide
  - [ ] **Commit:** `git add README.md && git commit -m "docs: Reference test artifact management in README"`

---

## Verification Steps

### After Each Phase

**After Phase A:**
```bash
git status
# Should be clean or show only intended commits

du -sh .mypy_cache .pytest_cache htmlcov 2>/dev/null
# Should all show "cannot access" or be gone
```

**After Phase B:**
```bash
ls -la tests/output/
# Should show .gitkeep files

git check-ignore -v tests/output/test.txt
# Should match tests/output/* pattern
```

**After Phase C:**
```bash
ls docs/guides/TEST-ARTIFACT-MANAGEMENT.md
# Should exist

wc -l docs/CONTRIBUTING.md | grep artifact
# Should have reference to artifacts
```

---

## Full Test Verification

### Before Cleanup
```bash
du -sh /home/devel/basset-hound-browser/
# Note current size
```

### After All Phases
```bash
# 1. Run full test suite
npm test

# 2. Check cleanup worked
du -sh /home/devel/basset-hound-browser/
# Should be significantly smaller

# 3. Verify no artifacts leaked
ls -la | grep -E '\.test-sessions|\.mypy_cache|\.pytest_cache|htmlcov'
# Should show nothing

# 4. Verify git is clean
git status
# Should be clean or only show doc changes
```

---

## Rollback Instructions

If issues occur:

```bash
# Revert all changes
git reset --hard HEAD~5  # Adjust based on commits made

# Regenerate artifacts if needed
npm test
npm run coverage

# Or restore from backup
tar xzf /tmp/cleanup-backup.tar.gz
```

---

## Post-Cleanup Monitoring

### Monitor These Files
- [ ] `.gitignore` - Verify patterns stay in place
- [ ] `tests/setup.js` - Monitor cleanup logic
- [ ] `tests/output/` - Should stay mostly clean
- [ ] Root directory - Should stay < 100 MB

### Watch For Issues
- ❌ Test artifacts appearing in root (check Phase A3)
- ❌ Tests failing from cleanup (check Phase B3)
- ❌ Developers ignoring guidelines (check Phase C)

---

## Notes for Execution

### Important
- Always backup before deletion
- Run tests after each phase
- Don't skip Phase C (documentation is critical)
- Test in feature branch first if possible

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "rm: cannot remove" | Check permissions: `ls -la` |
| Tests fail after cleanup | Verify Phase B3 handlers added correctly |
| `.mypy_cache/` comes back | Run: `python -m mypy` which recreates it, then cleanup |
| `.gitignore` not working | Verify git index: `git check-ignore -v <file>` |

---

## Success Indicators

After cleanup, you should see:

1. **Root directory:** Clean (only code + config files)
2. **Git status:** No test artifacts showing
3. **Tests:** All passing with cleanup handlers
4. **Documentation:** Clear artifact management policy
5. **Future state:** No new artifacts accumulating

---

## Estimated Time Breakdown

| Phase | Task | Time |
|-------|------|------|
| A | Update .gitignore | 5 min |
| A | Update tests/setup.js | 10 min |
| A | Remove artifacts | 5 min |
| A | **Subtotal** | **20 min** |
| B | Create test output dirs | 5 min |
| B | Update .gitignore (B2) | 5 min |
| B | Add cleanup handlers | 20 min |
| B | Add pre-commit hook (opt) | 10 min |
| B | **Subtotal** | **40 min** |
| C | Create artifact guide | 20 min |
| C | Update contributing guide | 10 min |
| C | **Subtotal** | **30 min** |
| **Total** | **All Phases** | **90 min** |

---

**Status:** Ready for Execution  
**Next:** Execute Phase A (immediate fixes)  
**Questions:** See ROOT-CLEANUP-PLAN-2026-06-15.md for detailed guidance

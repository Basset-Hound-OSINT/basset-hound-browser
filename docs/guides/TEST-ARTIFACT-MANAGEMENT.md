# Test Artifact Management Guide

**Version:** 1.0  
**Date:** June 15, 2026  
**Phase:** Phase B Root Cleanup  
**Status:** Complete

## Overview

This guide defines how test artifacts are managed in the Basset Hound Browser project to prevent root directory pollution and maintain clean git history.

## Centralized Test Output Structure

All test outputs must be stored in the centralized `tests/output/` directory:

```
tests/output/
├── reports/        Test result reports and summaries
├── results/        Raw test results (JSON, XML)
├── screenshots/    Test screenshots and visual captures
├── logs/           Test execution logs
└── .gitkeep        Preserves directory in git
```

### Directory Purposes

| Directory | Purpose | Example Contents |
|-----------|---------|------------------|
| `tests/output/reports/` | Test summaries and reports | `jest-results.json`, `coverage-report.html` |
| `tests/output/results/` | Raw test result data | `unit-tests.json`, `integration-tests.xml` |
| `tests/output/screenshots/` | Visual test captures | `screenshot-1234.png`, `full-page.png` |
| `tests/output/logs/` | Test execution logs | `test-run.log`, `debug.log` |

## What Gets Cleaned

The following artifacts are automatically removed before tests run or before commits:

### Test Session Directories
- `.test-sessions*` - Any timestamped test session directories
- `.test-scratch*` - Temporary scratch directories for tests
- `test-sessions/` - Legacy test session directory
- `tmp_tests/` - Temporary test data

### Python Cache Files
- `.mypy_cache/` - MyPy type checking cache
- `.pytest_cache/` - Pytest cache
- `__pycache__/` - Python bytecode cache

### Coverage Reports
- `htmlcov/` - HTML coverage reports
- `.coverage` - Coverage data file

### Other Test Outputs
- `tests/tmp/` - Any temporary test files
- `tests/output/*` - All test outputs (preserved by `.gitkeep`)

## Automatic Cleanup

### Before Tests Run

When you run:
```bash
npm test
```

The cleanup script automatically runs first:
```bash
npm run test:cleanup && jest
```

This ensures:
1. Old test artifacts don't interfere with new test runs
2. No stale data corrupts test results
3. Clean output directory for fresh test results

### Before Commit (Pre-commit Hook)

If you have pre-commit hooks configured, cleanup runs automatically before commits:

```bash
git commit -m "My changes"
# Pre-commit hook triggers: npm run test:cleanup
# Artifacts removed, commit proceeds
```

## Manual Cleanup

To manually clean test artifacts:

```bash
# Using npm script
npm run test:cleanup

# Using Node.js directly
node scripts/clean-test-artifacts.js

# Using bash script (if npm not available)
bash scripts/clean-test-artifacts.sh
```

## Configuration Files

### .gitignore

The following patterns prevent test artifacts from being committed:

```gitignore
# Test session & temporary test data
test-sessions/
tmp_tests/
.test-sessions*
.test-scratch*
tests/tmp/

# Python cache and coverage
.mypy_cache/
.pytest_cache/
.coverage
htmlcov/

# Centralized test outputs
tests/output/*
!tests/output/.gitkeep
```

### package.json

The test script configuration:

```json
{
  "scripts": {
    "test:cleanup": "node scripts/clean-test-artifacts.js",
    "test": "npm run test:cleanup && jest"
  }
}
```

## Developer Guidelines

### When Running Tests

1. **Always use `npm test`** instead of running jest directly
   ```bash
   # ✅ Correct - includes cleanup
   npm test

   # ❌ Avoid - skips cleanup
   jest
   ```

2. **Old artifacts won't interfere** - cleanup runs automatically
   ```bash
   npm test
   # Cleanup removes: .test-sessions*, coverage/, etc.
   # Fresh test run with clean state
   ```

### Before Committing

1. **Ensure cleanup runs**
   ```bash
   npm run test:cleanup
   git status
   # No artifacts should appear
   ```

2. **Verify no test artifacts in git**
   ```bash
   git status | grep -E "(tests/|\.test|coverage)"
   # Should show no untracked test artifacts
   ```

### When Adding New Test Types

If you create a new test type that generates artifacts:

1. **Update cleanup script** to handle new artifact patterns
   - Edit `scripts/clean-test-artifacts.js`
   - Add pattern to the `cleanPatterns` array

2. **Update .gitignore** if needed
   - Add pattern for new artifact type
   - Use `!` negation for files to keep

3. **Document the new pattern**
   - Add row to "What Gets Cleaned" table above
   - Explain artifact purpose in related test documentation

### Example: Adding a New Report Type

If tests start generating `coverage-v12.7.0-report.html`:

**1. Update cleanup script:**
```javascript
// In scripts/clean-test-artifacts.js
const cleanPatterns = [
  'coverage-v*.html',  // New pattern for versioned coverage reports
  // ... other patterns
];
```

**2. Update .gitignore:**
```gitignore
# Coverage reports
coverage-v*.html
htmlcov/
.coverage
```

**3. Document in test file:**
```javascript
// Output to centralized location
const reportPath = 'tests/output/reports/coverage-v12.7.0-report.html';
```

## Troubleshooting

### Q: Test artifacts still appearing in root after npm test

**A:** 
1. Verify cleanup script ran: `npm run test:cleanup` (should show removed files)
2. Check that test code writes to `tests/output/` not root
3. Verify .gitignore includes the pattern: `git check-ignore <filename>`

### Q: Getting "Permission denied" on cleanup scripts

**A:**
```bash
# Fix permissions
chmod +x scripts/clean-test-artifacts.js
chmod +x scripts/clean-test-artifacts.sh
npm run test:cleanup
```

### Q: Node.js cleanup script fails with "glob not found"

**A:**
The script uses Node.js built-in modules. If glob is missing:
```bash
# Use bash version instead
bash scripts/clean-test-artifacts.sh

# Or install glob package
npm install glob --save-dev
```

### Q: Disk space usage still high after cleanup

**A:**
1. Check `tests/output/` directory size:
   ```bash
   du -sh tests/output/
   ```

2. Look for large files that should be cleaned:
   ```bash
   find tests/output/ -type f -size +100M
   ```

3. Add new patterns to cleanup script for those files

## Integration with CI/CD

### Before Test Runs

Most CI/CD systems should run cleanup:

```yaml
# GitHub Actions example
- name: Clean test artifacts
  run: npm run test:cleanup

- name: Run tests
  run: npm test
```

### Before Pushing

If deploying directly from CI:

```yaml
- name: Clean artifacts before deployment
  run: npm run test:cleanup

- name: Deploy
  run: ./scripts/deploy.sh
```

## Related Documentation

- [Testing Guide](../TESTING.md) - How to write and run tests
- [CI/CD Pipeline](../CI-CD.md) - Continuous integration setup
- [Deployment Guide](../DEPLOYMENT.md) - Production deployment procedures

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-15 | Initial implementation - Phase B cleanup |

## Questions?

If you have questions about test artifact management:

1. Check the **Troubleshooting** section above
2. Review the [Testing Guide](../TESTING.md)
3. Search the codebase for similar patterns
4. Ask the team in project discussions

## Summary

Test artifacts are now centrally managed to keep the repository clean. The key points:

✅ All test outputs → `tests/output/`  
✅ Cleanup runs automatically before tests  
✅ Cleanup prevents committing artifacts  
✅ Manual cleanup available via `npm run test:cleanup`  
✅ Clear documentation for adding new artifact types  

**Result:** Clean repository, no root directory pollution, predictable test execution.

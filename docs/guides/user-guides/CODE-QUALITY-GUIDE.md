# Code Quality Guide - Basset Hound Browser

## Overview

This project uses **ESLint** to maintain code quality and consistency across the codebase. The ESLint configuration enforces modern JavaScript best practices, helps catch common errors early, and ensures a consistent coding style.

**Target Impact:** Catch 20% of bugs early through automated code analysis.

---

## Quick Start

### 1. Setup Git Hooks (One-time)

After cloning the repository, run:

```bash
bash scripts/setup-git-hooks.sh
```

This installs a pre-commit hook that runs ESLint before every commit.

### 2. Run ESLint Manually

**Check for issues:**
```bash
npm run lint
```

**Fix issues automatically:**
```bash
npm run lint:fix
```

**Check staged files only:**
```bash
npm run lint:staged
```

**Generate detailed JSON report:**
```bash
npm run lint:check
```

---

## ESLint Configuration

### Config File
- **Location:** `.eslintrc.json` (root directory)
- **Extends:** `eslint:recommended` (ESLint's built-in recommended rules)
- **Environment:** Node.js, ES2021, Jest

### Key Rules

#### Error Level (Blocks Commits)
- ✗ `no-var` - Enforce `const`/`let` instead of `var`
- ✗ `prefer-const` - Use `const` for variables that never change
- ✗ `eqeqeq: 'always'` - Enforce `===` and `!==` (except null checks)
- ✗ `curly: 'all'` - Require braces for control structures
- ✗ `semi: 'always'` - Require semicolons
- ✗ `linebreak-style: 'unix'` - Enforce Unix line endings

#### Warning Level (Alerts but allows commits)
- ⚠ `no-unused-vars` - Warn about unused variables (allow `_` prefix)
- ⚠ `no-console` - Warn about `console.log` (allow `warn`, `error`, `info`)
- ⚠ `no-shadow` - Warn about variable shadowing
- ⚠ `prefer-arrow-callback` - Suggest arrow functions for callbacks
- ⚠ Indentation, spacing, and formatting rules

#### Suspicious Patterns (Pre-commit Hook)
The pre-commit hook also detects:
- `console.log()` statements (should use logging framework)
- `TODO` / `FIXME` / `HACK` comments
- `debugger` statements
- Large files (>500KB)

---

## Pre-Commit Hook Behavior

The pre-commit hook runs automatically when you try to commit code. It performs:

1. **ESLint validation** on staged JavaScript files
2. **Suspicious pattern detection** (console.log, TODO, etc.)
3. **Package.json validation**

### Success Criteria
- All files pass ESLint validation
- No `debugger` statements
- No critical ESLint errors

### Failure Behavior
```bash
✗ Pre-commit checks failed with X critical issue(s)

To fix ESLint issues automatically:
  npx eslint --fix <files>

To bypass checks (NOT RECOMMENDED):
  git commit --no-verify
```

### Bypassing the Hook (Discouraged)
```bash
git commit --no-verify
```

> ⚠ **Warning:** Bypassing checks should only be done as a last resort for urgent commits. Always review and fix issues before pushing to main.

---

## CI/CD Integration

### GitHub Actions Workflow
The ESLint gate is integrated into the test workflow (`.github/workflows/test.yml`):

**Job:** `lint`
- Runs on every push to `main` or `develop`
- Runs on every pull request
- Runs before unit/integration tests
- Generates ESLint report as artifact

**Failure Handling:**
- Pull requests with ESLint failures cannot be merged
- Developers must fix issues locally and push corrections

---

## Common Issues & Fixes

### Issue 1: "no-unused-vars" Warning
**Problem:** Variable declared but not used

**Solutions:**
```javascript
// Option A: Remove unused variable
const result = getValue(); // WARN

// Option B: Prefix with underscore to ignore
const _unused = getValue(); // OK

// Option C: Use the variable
const value = getValue();
console.log(value); // OK
```

### Issue 2: "no-console" Warning
**Problem:** Using `console.log()` in production code

**Solutions:**
```javascript
// Option A: Use proper logging framework (recommended)
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');

// Option B: eslint-disable comment (use sparingly)
// eslint-disable-next-line no-console
console.log('Special debugging');

// Option C: Use only in allowed contexts
console.warn('This is allowed');
console.error('This is allowed');
```

### Issue 3: "prefer-const" Error
**Problem:** Using `let` for constant values

**Solutions:**
```javascript
// WRONG
let counter = 0;

// RIGHT
const counter = 0;

// Exception: Use let only when reassignment needed
let count = 0;
count = 1; // reassignment
```

### Issue 4: "eqeqeq" Error
**Problem:** Using `==` instead of `===`

**Solutions:**
```javascript
// WRONG
if (value == 5) {}

// RIGHT (for most cases)
if (value === 5) {}

// Exception: Null checks (explicitly allowed)
if (value == null) {} // OK for both null and undefined
if (value === null) {} // Also OK
```

### Issue 5: Missing Semicolons
**Problem:** Statements without trailing semicolons

**Solutions:**
```javascript
// WRONG
const result = getValue()

// RIGHT
const result = getValue();
```

**Auto-Fix:**
```bash
npm run lint:fix
```

---

## Best Practices

### 1. Run Lint Before Committing
```bash
npm run lint:staged
# or
npm run lint
```

### 2. Fix Issues Automatically When Possible
```bash
npm run lint:fix
```

### 3. Review Auto-Fixed Code
After running `--fix`, always review the changes:
```bash
git diff
```

### 4. Use ESLint Comments Sparingly
```javascript
// eslint-disable-next-line rule-name
const value = dangerousCode();

// eslint-disable rule-name
// ... code that needs to disable rule ...
// eslint-enable rule-name
```

### 5. Configure IDE Integration
Most IDEs support ESLint integration for real-time feedback:
- **VS Code:** Install "ESLint" extension by Dirk Baeumer
- **WebStorm:** Built-in ESLint support
- **Vim:** Use ALE or Syntastic plugins

---

## Extending ESLint Configuration

### Adding New Rules
Edit `.eslintrc.json` and modify the `rules` section:

```json
{
  "rules": {
    "rule-name": ["error|warn", options]
  }
}
```

### Common Rule Additions

**Enforce naming conventions:**
```json
"camelcase": ["warn", { "properties": "never" }]
```

**Enforce code complexity limits:**
```json
"max-depth": ["warn", 3],
"max-lines": ["warn", { "max": 300 }]
```

**Enforce comment requirements:**
```json
"require-jsdoc": ["warn", {
  "require": {
    "FunctionDeclaration": true,
    "MethodDefinition": true
  }
}]
```

### Adding New Plugins
1. Install plugin: `npm install --save-dev eslint-plugin-<name>`
2. Update `.eslintrc.json`:
```json
{
  "plugins": ["<name>"],
  "rules": {
    "<name>/<rule>": "error"
  }
}
```

---

## Monitoring & Reporting

### View Lint Status
```bash
# Current lint status
npm run lint

# With detailed statistics
npm run lint:check
```

### ESLint Report Format
The lint report (generated by `npm run lint:check`) includes:
- File paths with violations
- Line and column numbers
- Rule names and violation descriptions
- Suggestions for fixes

### Integration with CI/CD
- ESLint report is uploaded as GitHub Actions artifact
- Pull requests cannot merge with lint failures
- Lint failures trigger notifications to developers

---

## Troubleshooting

### ESLint Not Running
**Symptom:** `Command 'eslint' not found`

**Solution:**
```bash
npm install
npm run lint
```

### Pre-commit Hook Not Triggering
**Symptom:** Can commit code with errors

**Solution:**
```bash
# Re-install git hooks
bash scripts/setup-git-hooks.sh
```

### False Positives
**Symptom:** ESLint reports issues that seem incorrect

**Solutions:**
1. Check rule documentation: https://eslint.org/docs/rules/
2. Use eslint-disable comments if necessary
3. Report as project issue if it's a genuine bug

### Performance Issues
**Symptom:** Linting is very slow

**Solutions:**
1. Check `.eslintignore` for large directories
2. Exclude node_modules, dist, coverage
3. Run `npm run lint:staged` instead of full lint

---

## References

- **ESLint Documentation:** https://eslint.org/docs/
- **ESLint Rules:** https://eslint.org/docs/rules/
- **JavaScript Best Practices:** https://github.com/airbnb/javascript
- **Basset Hound Browser Contributing Guide:** See CONTRIBUTING.md

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | June 20, 2026 | Initial ESLint configuration with pre-commit hooks |

---

## Support

For questions or issues related to code quality:
1. Check this guide for common solutions
2. Review ESLint documentation
3. Create an issue in the project repository

---

**Last Updated:** June 20, 2026  
**Maintained By:** Basset Hound Team

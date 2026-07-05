# Code Quality Fixes - Implementation Guide
**Basset Hound Browser v12.8.0**  
**Date:** 2026-07-03

---

## Quick Start: Auto-Fix Most Issues

```bash
# Run automatic fixes (fixes ~1,170 issues)
npm run lint:fix

# Verify results
npm run lint

# Expected: Remove all formatting-related violations
```

---

## Issue #1: Console Statements (7,451 violations)

### Problem
Excessive use of `console.log/warn/error` throughout production code.

### Root Cause Analysis
```bash
# Find where console is used
grep -r "console\." src/ --include="*.js" | wc -l
# Output: 7,451 occurrences

# Most violations in:
grep -r "console\." websocket/ --include="*.js" | wc -l
# Output: 200+ in websocket/server.js alone
```

### Fix Strategy

#### Step 1: Update ESLint Configuration
**File:** `.eslintrc.json`

```json
{
  "rules": {
    "no-console": [
      "warn",
      {
        "allow": ["warn", "error"]
      }
    ]
  },
  "overrides": [
    {
      "files": ["tests/**/*.js"],
      "rules": {
        "no-console": "off"
      }
    },
    {
      "files": ["examples/**/*.js"],
      "rules": {
        "no-console": "off"
      }
    }
  ]
}
```

**Result:** Allows console.warn/error (important for production), disables in tests

#### Step 2: Replace Production Logs

**Example: websocket/server.js**

```javascript
// BEFORE: Line 65
const WebSocket = require('ws');
// ...
console.log(`User agent rotated: ${newUA}`);

// AFTER: Use structured logger
const { defaultLogger } = require('../logging');
// ...
defaultLogger.info('User agent rotated', { userAgent: newUA });
```

#### Step 3: Identify Critical vs Debug Logs

**Critical (Keep):**
- Server startup/shutdown
- Connection events
- Errors and warnings
- Performance metrics

**Debug (Remove):**
- Variable inspection
- Flow tracing
- Intermediate calculations
- Status updates

**Script to categorize:**
```bash
# Find all console statements
grep -n "console\." websocket/server.js | head -20

# Review each line manually:
# - If critical to operation → Keep as console.error/warn
# - If debug info → Remove or move to logger.debug
# - If info log → Move to logger.info
```

**Automated Replacement Template:**
```bash
# For info logs
sed -i "s/console\.log('\(.*\)')/defaultLogger.info('\1')/g" file.js

# For warnings
sed -i "s/console\.warn('\(.*\)')/defaultLogger.warn('\1')/g" file.js

# For errors
sed -i "s/console\.error('\(.*\)')/defaultLogger.error('\1')/g" file.js
```

#### Step 4: Verify Testing
```bash
npm run test:unit
npm run test:integration
```

**Expected Result:** 7,451 → 500-1000 violations (90% reduction)

---

## Issue #2: Unused Variables (2,388 violations)

### Problem
Declared but unreferenced variables waste memory and indicate incomplete refactoring.

### Detection Examples

#### Pattern 1: Unused Imports
```javascript
// VIOLATION: Unused require
const path = require('path');  // Never used
const crypto = require('crypto');  // Declared but not referenced
const fs = require('fs');
// ...
fs.readFileSync(file);  // Only fs is used

// FIX: Remove unused import
const fs = require('fs');
fs.readFileSync(file);
```

#### Pattern 2: Unused Function Parameters
```javascript
// VIOLATION
function formatData(data, locale, timezone) {
  // locale and timezone never referenced
  return data.toUpperCase();
}

// FIX: Use underscore prefix for intentionally unused
function formatData(data, _locale, _timezone) {
  return data.toUpperCase();
}

// OR: Remove unused parameters
function formatData(data) {
  return data.toUpperCase();
}
```

#### Pattern 3: Unused Variables in Destructuring
```javascript
// VIOLATION
const { name, age, ssn, unused1, unused2 } = userData;
console.log(name, age);  // ssn, unused1, unused2 not used

// FIX
const { name, age } = userData;
console.log(name, age);
```

### Auto-Fix Approach

```bash
# ESLint can suggest fixes
npm run lint -- --fix-type suggestion

# This handles many patterns automatically
```

### Manual Review Checklist

For remaining violations after auto-fix:

```bash
# Get detailed report of unused variables
npm run lint -- --format json > unused-vars.json

# Parse and review
node << 'EOF'
const report = JSON.parse(require('fs').readFileSync('unused-vars.json', 'utf8'));
const unused = report.filter(f => f.messages.some(m => m.ruleId === 'no-unused-vars'));
unused.forEach(file => {
  console.log(`\n${file.filePath}:`);
  file.messages
    .filter(m => m.ruleId === 'no-unused-vars')
    .slice(0, 5)
    .forEach(m => console.log(`  Line ${m.line}: ${m.message}`));
});
EOF
```

### File-Specific Fixes

#### websocket/server.js (31 unused variables)
```bash
# Review and fix
npm run lint -- websocket/server.js --format json | jq '.[] | .messages[] | select(.ruleId == "no-unused-vars")'
```

#### src/main/main.js (18 unused variables)
```bash
# Review and fix
npm run lint -- src/main/main.js --format json | jq '.[] | .messages[] | select(.ruleId == "no-unused-vars")'
```

---

## Issue #3: Variable Shadowing (206 violations)

### Problem
Declaring a variable with same name as outer scope variable causes confusion and bugs.

### Example: Real Violation in Code

```javascript
// src/advanced/anomaly-detector.js - Pattern Example
class AnomalyDetector {
  constructor() {
    this.regex = /statistical_pattern/;  // Outer scope
  }

  detectAnomalies(data) {
    const results = data.map(item => {
      // VIOLATION: Shadows outer 'regex'
      const regex = /item_pattern/;  // Line 531
      return this.analyzePattern(item, regex);
    });
    
    return results.filter(r => this.regex.test(r.type));  // Uses outer regex
  }
}
```

### Fix Approaches

#### Approach 1: Rename Inner Variable
```javascript
class AnomalyDetector {
  constructor() {
    this.anomalyRegex = /statistical_pattern/;
  }

  detectAnomalies(data) {
    const results = data.map(item => {
      const itemRegex = /item_pattern/;  // Clear name, no shadow
      return this.analyzePattern(item, itemRegex);
    });
    
    return results.filter(r => this.anomalyRegex.test(r.type));
  }
}
```

#### Approach 2: Extract Method
```javascript
class AnomalyDetector {
  constructor() {
    this.regex = /statistical_pattern/;
    this.itemAnalyzer = this.createItemAnalyzer();
  }

  createItemAnalyzer() {
    return (item) => {
      const localRegex = /item_pattern/;  // Clear scope
      return this.analyzePattern(item, localRegex);
    };
  }

  detectAnomalies(data) {
    const results = data.map(this.itemAnalyzer);
    return results.filter(r => this.regex.test(r.type));
  }
}
```

### ESLint Rule Update

Current configuration (`.eslintrc.json`):
```json
{
  "no-shadow": [
    "warn",
    {
      "builtinGlobals": false,
      "hoist": "all",
      "allow": []
    ]
  ]
}
```

This rule will flag 206 issues. Recommended approach:
1. Fix systematically (rename variables)
2. Don't add exceptions to "allow" array
3. Enables future prevention

---

## Issue #4: Curly Braces (247 violations)

### Problem
Inconsistent curly brace placement breaks the 1TBS (One True Brace Style) convention.

### Violations

#### Pattern 1: Missing Braces (Most Common)
```javascript
// VIOLATION
if (condition)
  doSomething();

// FIX
if (condition) {
  doSomething();
}
```

#### Pattern 2: Brace on Wrong Line
```javascript
// VIOLATION
if (condition)
{
  doSomething();
}

// FIX
if (condition) {
  doSomething();
}
```

### Auto-Fix
```bash
# ESLint can fix all curly brace violations
npm run lint:fix -- --rule curly

# Verify
npm run lint -- --rule curly
# Expected: All 247 violations resolved
```

### Manual Verification
```javascript
// BEFORE: 247 violations
npm run lint | grep "curly"

// AFTER: 0 violations
npm run lint:fix
npm run lint | grep "curly"
```

---

## Issue #5: Indentation (264 violations)

### Problem
Mixed indentation (1, 2, 3, 4, 6 spaces) instead of consistent 2-space indentation.

### Analysis
```bash
# Files with indentation issues
npm run lint -- --rule indent | grep "indent"

# Example from: src/advanced/anomaly-detector.js
# Lines with wrong indentation: 15, 23, 45, 67, 89, 112, etc.
```

### Expected Patterns

**Correct 2-space indentation:**
```javascript
class Example {
  constructor() {  // 2 spaces
    this.value = 1;  // 4 spaces
    this.nested = {
      level2: 'value'  // 6 spaces
    };
  }

  method() {  // 2 spaces
    if (condition) {  // 4 spaces
      doSomething();  // 6 spaces
    }
  }
}
```

### Auto-Fix
```bash
# ESLint can fix indentation
npm run lint:fix -- --rule indent

# Verify (should show 0)
npm run lint -- --rule indent
```

### Manual Review (If Needed)
```bash
# Find files with inconsistent indentation
npm run lint -- --format json | jq '.[] | select(.messages[] | select(.ruleId == "indent")) | .filePath' | sort | uniq

# Review specific file
npm run lint -- --rule indent src/advanced/anomaly-detector.js
```

---

## Issue #6: Spacing Issues (~500 violations)

### Common Patterns

#### space-before-function-paren (247)
```javascript
// VIOLATION
function getData() {  // No space before parenthesis (except arrow functions)
  return data;
}

// FIX
function getData() {
  return data;
}

// Arrow functions SHOULD have space
const getData = async () => {
  return data;
};
```

**Auto-Fix:**
```bash
npm run lint:fix -- --rule space-before-function-paren
```

#### space-before-blocks (implicit in formatting)
```javascript
// VIOLATION
if (condition){  // No space before brace
  doSomething();
}

// FIX
if (condition) {
  doSomething();
}
```

#### no-trailing-spaces (19)
```javascript
// VIOLATION
function example() {
  const x = 1;          // Trailing spaces at end
  return x;             // Trailing spaces
}

// FIX: Auto-fix removes all
npm run lint:fix -- --rule no-trailing-spaces
```

#### no-multi-spaces (70)
```javascript
// VIOLATION
const x  =  1;  // Multiple spaces around =
const y    = 2;  // Multiple spaces

// FIX
const x = 1;
const y = 2;
```

**Auto-Fix All:**
```bash
npm run lint:fix -- --type problem
# Fixes all formatting issues automatically
```

---

## Issue #7: Undefined References (312 errors)

### Critical Issues - Requires Manual Review

#### Pattern 1: Missing Imports
```javascript
// VIOLATION
const result = crypto.randomBytes(32);  // crypto not imported!

// FIX
const crypto = require('crypto');
const result = crypto.randomBytes(32);
```

#### Pattern 2: Typos in Variable Names
```javascript
// VIOLATION
const userName = 'John';
console.log(usrName);  // Typo: usrName instead of userName

// FIX
const userName = 'John';
console.log(userName);
```

#### Pattern 3: Missing Global Context
```javascript
// VIOLATION (in certain environments)
console.log(process.env.PORT);  // process not available?

// Solution: Check if process is declared
// Usually available in Node.js environment
```

### Finding Undefined References

```bash
# Get all undefined reference violations
npm run lint -- --rule no-undef --format json | jq '.[] | .messages[] | select(.ruleId == "no-undef")'

# Get file list
npm run lint -- --rule no-undef --format json | jq '.[] | select(.messages[] | select(.ruleId == "no-undef")) | .filePath' | sort | uniq
```

### Fix Process

1. **List all undefined references:**
   ```bash
   npm run lint -- --rule no-undef --format compact
   ```

2. **For each violation:**
   - Check if it's a missing import → Add import
   - Check if it's a typo → Fix typo
   - Check if it's a global → Verify availability

3. **Verify fix:**
   ```bash
   npm run lint -- --rule no-undef
   # Should show 0 remaining
   ```

### Common Fixes

**Missing imports in src/websocket/server.js:**
```javascript
// BEFORE
const result = await someUtility.process();

// AFTER
const { someUtility } = require('../utils/some-utility');
const result = await someUtility.process();
```

---

## Phase 1: Automated Fixes Checklist

```bash
# Step 1: Backup current state
git add -A && git commit -m "Before lint:fix"

# Step 2: Run auto-fix
npm run lint:fix

# Step 3: Check results
npm run lint

# Step 4: Test suite
npm run test:unit
npm run test:integration

# Step 5: Review changes
git diff

# Step 6: Commit
git add -A && git commit -m "lint: Auto-fix formatting and spacing violations"
```

**Expected Results:**
- 1,170 violations fixed automatically
- ~10-15 minutes runtime
- No breaking changes
- All tests should pass

---

## Phase 2: Manual Code Quality Improvements

### Task 1: Console Statement Audit

**Time Estimate:** 4-6 hours

```bash
# 1. Identify all console statements
grep -rn "console\." src/ --include="*.js" | grep -v "console.warn\|console.error" > console-statements.txt

# 2. For each log in console-statements.txt:
#    - Is it critical? (startup, error, performance)
#    - Is it debug? (variable inspection, flow tracing)
#    - Replace debug with defaultLogger.debug
#    - Keep error/warn, but may change to logger

# 3. Use structured logger
const { defaultLogger } = require('../logging');
defaultLogger.info('User agent rotated', { userAgent: newUA });

# 4. Test
npm run test:unit
```

### Task 2: Unused Variables Cleanup

**Time Estimate:** 3-4 hours

```bash
# 1. Auto-suggestion
npm run lint -- --fix-type suggestion

# 2. Manual review remaining violations
npm run lint -- --rule no-unused-vars --format json > unused.json

# 3. For each unused var:
#    - If imported but unused: Remove import
#    - If parameter: Prefix with _ (e.g., _unused)
#    - If in destructure: Remove from destructure

# 4. Test
npm run test:unit
```

### Task 3: Undefined References Fix

**Time Estimate:** 2-3 hours

```bash
# 1. Get all undefined references
npm run lint -- --rule no-undef --format compact | tee undefined.txt

# 2. For each in undefined.txt:
#    - Identify missing import or typo
#    - Fix accordingly

# 3. Verify
npm run lint -- --rule no-undef
```

---

## Phase 3: Complexity Refactoring

### High-Priority Files

#### 1. src/advanced/anomaly-detector.js

**Current Metrics:**
- Cyclomatic: 89
- Cognitive: 51
- Lines: 541

**Refactoring Strategy:** Extract detection methods

**Before:**
```javascript
class AnomalyDetector {
  detect(data, options) {
    if (options.type === 'statistical') {
      if (options.method === 'zscore') {
        // 30 lines of logic
      } else if (options.method === 'iqr') {
        // 25 lines of logic
      } else if (options.method === 'mad') {
        // 20 lines of logic
      }
    } else if (options.type === 'behavioral') {
      // 40 lines of logic
    } else if (options.type === 'contextual') {
      // 35 lines of logic
    }
  }
}
```

**After:**
```javascript
class ZScoreDetector {
  detect(data, threshold) { /* 30 lines */ }
}

class IQRDetector {
  detect(data, threshold) { /* 25 lines */ }
}

class AnomalyDetector {
  constructor() {
    this.detectors = {
      zscore: new ZScoreDetector(),
      iqr: new IQRDetector(),
      // ...
    };
  }

  detect(data, options) {
    const detector = this.detectors[options.method];
    return detector.detect(data, options);
  }
}
```

**Result:**
- Cyclomatic: 89 → 12 (87% reduction)
- Cognitive: 51 → 8 (84% reduction)
- Better testability and reusability

---

## Testing & Validation

### Test Before Commit
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Coverage report
npm run test:coverage

# Linting
npm run lint
```

### CI/CD Integration
```bash
# Simulate CI checks locally
npm run quality

# Expected output: All checks pass
# - ESLint: 0 errors
# - Tests: 100% pass
# - Coverage: Above threshold
```

---

## Summary: Expected Outcomes

### After Phase 1 (Auto-Fix)
```
Before: 11,776 violations
After:  10,606 violations
Reduction: 1,170 (-9.9%)
Time: 1-2 hours
Effort: Minimal
Risk: Very Low
```

### After Phase 2 (Code Quality)
```
Before: 10,606 violations
After:  8,000 violations
Reduction: 2,606 (-24.5%)
Time: 3-5 days
Effort: Moderate
Risk: Low (manual review)
```

### After Phase 3 (Refactoring)
```
Before: 8,000 violations
After:  4,000-5,000 violations
Reduction: 3,000-4,000 (-37%)
Time: 1-2 weeks
Effort: High
Risk: Medium (structural changes)
Benefit: 85%+ complexity reduction
```

---

## References

- ESLint Rules: https://eslint.org/docs/rules/
- Code Complexity: https://en.wikipedia.org/wiki/Cyclomatic_complexity
- JavaScript Best Practices: https://google.github.io/styleguide/javascriptguide.html

---

*Last Updated: 2026-07-03*

# Tests Archives Index

This directory contains archived test files and exploration scripts from development phases.

## Directory Structure

### `/exploration-tests/`
**Purpose:** Ad-hoc test files, validation scripts, and one-off exploration tests from development

**Contents:** 74 test files including:
- Comprehensive integration tests (comprehensive-*.js)
- Performance analysis tests (performance-*.js, load-test*.js)
- Evasion validation tests (evasion-*.js, direct-evasion-*.js)
- Bot detection validation (bot-detection-*.js)
- State consistency tests (state-*.js)
- WebSocket API tests (websocket-*.js, test-ws-api.js)
- Tor integration tests (tor-*.js)
- Edge case tests (edge-case-*.js)
- Screenshot validation (screenshot-*.js)
- Optimization tests (opt-*.js)

**Use Case:** Historical reference, regression testing, validation patterns

### `/legacy-tests/`
**Purpose:** Tests from earlier development phases (v11.x era)

**Note:** Currently empty, reserved for older test artifacts

### `/validation-scripts/`
**Purpose:** Standalone validation and verification scripts

**Note:** Currently empty, reserved for validation utilities

---

## When to Use Archive Tests

✅ **Use for:**
- Understanding previous validation approaches
- Regression testing against historical bugs
- Performance baseline comparisons
- Finding test patterns for similar issues

❌ **Don't use for:**
- Current test suite execution (use organized test directories instead)
- Production validation (use validated tests in `/tests/{api,data,mesh,etc.}/`)

---

## Related Directories

**Active Test Suites:**
- `/tests/api/` - API gateway and service tests
- `/tests/data/` - Data layer and database tests
- `/tests/mesh/` - Service mesh tests
- `/tests/integration/` - Integration tests
- `/tests/deployment/` - Deployment validation
- `/tests/advanced/` - Advanced features

**Test Infrastructure:**
- `/tests/fixtures/` - Test data and fixtures
- `/tests/helpers/` - Test utilities and helpers

---

## Maintenance

These files are archived for historical reference and should not be modified. To run tests:

```bash
# Run active test suite
npm test

# Run specific test directory
npm test -- tests/api/

# Run specific test file
npm test -- tests/api/gateway.test.js
```

For historical validation patterns, reference specific files in this archive but don't rely on them for current testing.

---

**Last Updated:** June 4, 2026  
**Status:** Cleaned - 74 exploration tests archived, repository root clean

# Test Batching - Quick Reference

**One-line summary:** Use `npm run test:batch:*` commands instead of multiple separate test invocations to save 70% command overhead.

---

## Quick Start

```bash
# Most common: Fast development feedback
npm run test:batch:critical

# Full validation before merge
npm run test:batch:all:coverage

# Feature-specific testing
npm run test:batch:integration        # Integration tests only
npm run test:batch:security           # Security tests only
npm run test:batch:api                # API/WebSocket tests only
npm run test:batch:evasion            # Bot evasion tests only

# See all available suites
npm run test:batch:list
```

---

## All Batch Commands

| Command | Purpose | Runtime | Use When |
|---------|---------|---------|----------|
| `test:batch:unit` | Unit tests only | ~45s | Isolated testing, fast feedback |
| `test:batch:critical` | Unit + core integration | ~2min | Before committing code |
| `test:batch:api` | API/WebSocket tests | ~1min | Testing API changes |
| `test:batch:integration` | All integration tests | ~2min | Testing system interactions |
| `test:batch:evasion` | Bot evasion framework | ~2-4min | Testing evasion features |
| `test:batch:forensics` | Evidence extraction tests | ~2-3min | Testing forensic features |
| `test:batch:security` | Security tests | ~2min | Testing security features |
| `test:batch:compliance` | Compliance tests | ~1min | Regulatory validation |
| `test:batch:performance` | Load/stress tests | ~3-5min | Performance validation |
| `test:batch:validation` | E2E validation | ~2-3min | Feature integration testing |
| `test:batch:wave14` | Latest wave features | ~1-2min | Validating Wave14 features |
| `test:batch:e2e` | End-to-end tests | ~5-10min | Full workflow validation |
| `test:batch:all` | All 338 tests | ~15-25min | Comprehensive pre-release |
| `test:batch:all:coverage` | All tests with coverage | ~22min | Coverage reporting |

---

## Common Workflows

### Local Development
```bash
# Quick feedback loop (run frequently)
npm run test:batch:critical                         # ~2 min

# After significant changes
npm run test:batch:integration                      # ~2 min
npm run test:batch:security                         # ~2 min
```

### Feature Branches
```bash
# API/WebSocket changes
npm run test:batch:api                              # ~1 min
npm run test:batch:integration                      # ~2 min

# Evasion changes
npm run test:batch:evasion                          # ~2-4 min

# Security/compliance changes
npm run test:batch:security && npm run test:batch:compliance

# Performance-critical changes
npm run test:batch:performance                      # ~3-5 min
```

### Before Pull Request
```bash
# Comprehensive but fast
npm run test:batch:critical                         # ~2 min
npm run test:batch:integration                      # ~2 min
npm run test:batch:security                         # ~2 min

# Or full suite
npm run test:batch:all                              # ~20 min
```

### Before Release
```bash
# Full validation with coverage
npm run test:batch:all:coverage                     # ~22 min
```

---

## Advanced Usage

### Direct Orchestrator Invocation
```bash
# More explicit control
node tests/orchestrator.js unit                     # Run unit tests
node tests/orchestrator.js critical --coverage      # With coverage
node tests/orchestrator.js all --verbose            # Verbose output
node tests/orchestrator.js all --json               # CI output format
```

### Custom Test Selection
```bash
# Run specific test files
node tests/orchestrator.js custom --paths "tests/unit/foo.test.js,tests/unit/bar.test.js"
```

### Help & Information
```bash
npm run test:batch:list                             # List all suites
node tests/orchestrator.js --help                   # Show all options
```

---

## Performance Improvements

**Before batching:** 8-15 seconds overhead for comprehensive testing (10-15 npm invocations)

**After batching:** 1-2 seconds overhead (single invocation)

**Improvement: 70% reduction in command overhead**

---

## Old vs New Commands

### Old Way (Multiple npm invocations)
```bash
npm run test:unit
npm run test:integration
npm run test:security
npm run test:bot-detection
# ... repeat 10+ times
# Total overhead: ~8-15 seconds
```

### New Way (Batched)
```bash
npm run test:batch:all
# Total overhead: ~1-2 seconds
```

---

## Backward Compatibility

All existing test commands still work:
- `npm run test` - Default Jest
- `npm run test:unit` - Legacy unit command
- `npm run test:integration` - Legacy integration command
- `npm run test:coverage` - Legacy coverage command

The batching system is **purely additive** and doesn't break existing workflows.

---

## Recommended Command Chain

For comprehensive local testing (5-6 minutes):
```bash
npm run test:batch:critical && \
npm run test:batch:integration && \
npm run test:batch:security && \
npm run test:batch:performance
```

For pre-release validation (20+ minutes):
```bash
npm run test:batch:all:coverage
```

---

## Notes

- All batch commands use Jest (standardized runner)
- Tests within a suite run sequentially but in single invocation
- Parallel execution supported but currently sequential (can be enabled)
- Each suite has preset timeout per test file
- Coverage reports available with `--coverage` flag

---

For detailed information, see: `/docs/findings/TEST-BATCHING-STRATEGY-2026-06-13.md`

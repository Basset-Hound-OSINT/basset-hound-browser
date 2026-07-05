# Basset Hound Browser - Testing Standards

**Last Updated:** June 20, 2026  
**Version:** 12.7.0+

---

## Test Reporting Policy

### Minimal Reporting Standard

Test reports should be **minimal and actionable**. 

**Default Reporting Format:**
- **Pass/Fail Status**: Summary line with count of passed/failed tests
- **Result Location**: Path to full test output (stdout/logs) if detailed analysis needed
- **Failures Only**: List only failing tests with error messages (success cases omitted)
- **Duration**: Total execution time

**Example:**
```
✅ WebSocket API Tests: 164/164 passed in 24.3s
Results: tests/results/websocket-api-test-2026-06-20.log
```

### When to Report Detailed Results

Detailed test reports are requested **on-demand only**, in these scenarios:

1. **Test Failures** - When tests fail, provide:
   - Specific error message and stack trace
   - Reproduction steps if applicable
   - Environment details (OS, Node version, etc.)

2. **Performance Regressions** - When metrics exceed thresholds:
   - Baseline vs. current metrics
   - Affected operations
   - Potential root causes

3. **Release Gates** - For production deployments:
   - Critical test pass rate (must be 100%)
   - Load testing results
   - Security scan results

4. **Specific Investigation** - When explicitly requested:
   - Full test output
   - Code coverage analysis
   - Detailed performance breakdown

### Test Output Storage

- **Default**: Store test artifacts in `tests/results/` directory (git-ignored)
- **Retention**: Results can be purged after verification; not committed to repository
- **Archive**: Archive significant test runs (releases, major bugs) in `docs/archives/` with context

### Test Result Lifecycle

1. **Generate**: Run tests, output to `tests/results/`
2. **Review**: Check pass/fail status
3. **Report**: Share summary (pass/fail + location)
4. **Archive**: Commit to archive if release-critical
5. **Cleanup**: Purge old results from `tests/results/` as needed

---

## Test Categories

### Unit Tests
- **Location**: `tests/unit/`
- **Files**: `*.test.js`
- **Reporting**: Pass/fail count only unless failures present

### Integration Tests
- **Location**: `tests/integration/`
- **Files**: `*.test.js`
- **Reporting**: Pass/fail count + any failures with stack traces

### Real-World Testing
- **Location**: `tests/real-world/` or inline scripts
- **Reporting**: Website + success/failure; detailed output on-demand
- **Storage**: Screenshots/artifacts in `tests/results/` (git-ignored)

### Load Testing
- **Location**: `tests/load/`
- **Metrics**: Throughput, latency, memory, CPU
- **Reporting**: Summary metrics; detailed breakdown only for regressions

---

## CI/CD Integration

### Test Execution in CI

Tests should run with minimal output by default:

```bash
npm test -- --reporter=minimal
```

### Conditional Verbose Output

Enable detailed output only when:
- Tests fail (`--reporter=tap` or `--reporter=json`)
- Performance gates triggered
- Manual `--verbose` flag passed

### Artifact Handling

- Store test artifacts in job artifacts (not git)
- Archive release-critical results to `docs/archives/`
- Clean up temporary results after job completion

---

## Quality Gates

### Required for Merge

- **Unit Tests**: ≥95% pass rate
- **Integration Tests**: 100% pass rate for critical paths
- **No New Regressions**: All previously passing tests still pass

### Required for Release

- **All Tests**: 100% pass rate on critical systems
- **Load Testing**: ≥500 concurrent connections at <100ms P99 latency
- **Security**: All critical/high severity findings resolved

---

## Test Documentation

### Test Files Should Include

1. **Description** (top comment)
   - What system/feature is being tested
   - Key test scenarios

2. **Setup/Teardown**
   - Clear before/after state
   - Resource cleanup

3. **Assertions**
   - Clear error messages
   - Specific expectations

### Minimal Comments

- Code should be self-documenting
- Comments for non-obvious logic only
- Use descriptive test names instead of comments

---

## Related Documentation

- `/docs/00-TESTING-STRATEGY-README.md` - Comprehensive testing strategy
- `/docs/LOAD-TESTING-DESIGN.md` - Load testing procedures
- `tests/unit/` - Unit test examples
- `tests/integration/` - Integration test examples


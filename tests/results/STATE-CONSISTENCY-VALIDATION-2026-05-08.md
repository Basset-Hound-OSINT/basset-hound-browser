# State Consistency Validation Report
**Date:** 2026-05-08T23:02:02.072Z
**WebSocket:** localhost:8765

## Executive Summary
- **Tests Passed:** 2/5
- **Tests Failed:** 3/5

## Test Results

### State Consistency
**Score:** 100.0% (8/8 passed)

| Iter | Passed | URL |
|------|--------|-----|
| 1 | ✓ | https://example.com |
| 2 | ✓ | https://example.org |
| 3 | ✓ | https://httpbin.org/html |
| 4 | ✓ | https://httpbin.org/status/200 |
| 5 | ✓ | https://example.com |
| 6 | ✓ | https://example.org |
| 7 | ✓ | https://httpbin.org/html |
| 8 | ✓ | https://httpbin.org/status/200 |

### Rapid State Changes
**Passed:** 2/4

| # | Status | Details |
|---|--------|----------|
| 1 | ✗ | https://example.com |
| 2 | ✗ | https://example.org |
| 3 | ✓ | https://httpbin.org/html |
| 4 | ✓ | https://httpbin.org/status/200 |

### Concurrent Operations
**Passed:** 4/4

| # | Status | Details |
|---|--------|----------|
| 1 | ✓ | https://example.com |
| 2 | ✓ | https://example.org |
| 3 | ✓ | https://httpbin.org/html |
| 4 | ✓ | https://httpbin.org/status/200 |

### State After Errors
**Passed:** 1/3

| # | Status | Details |
|---|--------|----------|
| 1 | ✗ | navigate |
| 2 | ✗ | click |
| 3 | ✓ | get_url |

### Session Consistency
**Passed:** 1/3

| # | Status | Details |
|---|--------|----------|
| 1 | ✗ | https://example.com |
| 2 | ✗ | https://example.org |
| 3 | ✓ | https://httpbin.org/html |

## Analysis
- **State Management:** ISSUES FOUND
- **Concurrency:** Stable
- **Error Handling:** State corruption on errors

---
**Generated:** 2026-05-08T23:02:33.586Z

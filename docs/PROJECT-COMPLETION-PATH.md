> ⚠️ **HISTORICAL / SUPERSEDED** — authoritative status: **docs/planning/PROJECT-STATUS-MATRIX.md** (2026-07-04). Claims below (version labels, "production ready", "100%"/test-pass counts, command counts, evasion %) are inflated or stale — verify against the matrix and the 2026-07-04 session records before relying on them.

# Basset Hound Browser — Path to Project Completion

**Last Updated:** June 21, 2026  
**Current Status:** 60% ready for external app integration  
**Target Completion:** July 1, 2026  
**Effort Remaining:** 38-49 hours (includes new onboard diagnostics API)

---

## Executive Summary

Basset Hound Browser is a **forensic data extraction tool** that captures all information from websites via WebSocket API. The project goal is simple: **extract all possible data and expose it over the API, then optionally add data conditioning operations on top.**

We are 60% done. The remaining work is focused, specific, and unblocked. No edge cases, no over-engineering—just fixing known issues and validating reliability.

---

## Current State (60% Complete)

### What Works ✅
- Core navigation (load URLs, click, fill forms, scroll, hover)
- Page extraction (HTML, text, links, images, metadata)
- Screenshots (full page, element, viewport)
- Network monitoring (HAR format)
- Session management (5-layer isolation)
- WebSocket API (164 commands)
- Docker deployment
- Auto-generated API documentation
- Security controls (request validation, rate limiting, path validation)
- Performance analysis (bottleneck identification)

### What Doesn't Work ❌
- **Bot detection evasion** — 67% of websites block requests (CRITICAL feature gap)
- **Error schema inconsistency** — External apps can't reliably parse errors
- **Command parameter validation** — No per-command schema validation
- **Test flakiness** — Race conditions in manager tests
- **API documentation fragmentation** — 28 docs, no single source of truth
- **Command reliability** — Only ~95% reliable, no retries or SLA metrics

---

## Path to Completion

### Phase 1: Critical Blockers (11-14 hours) — Week 1, Days 1-3
Fix the 5 issues blocking external app integration.

#### 1.1 Standardize WebSocket Error Response Schema (2 hours)
**What:** Enforce consistent error response format across all commands  
**Why:** External clients can't reliably parse errors; they resort to fragile pattern matching  
**Current:** Some errors have `errorCode`, some don't; format varies  
**Fix:**
```json
{
  "success": false,
  "error": "Command failed",
  "errorCode": "INVALID_PARAMETERS",
  "command": "navigateTo",
  "id": "msg-123",
  "recoveryHint": "Check URL format and try again",
  "details": { "field": "url", "reason": "Invalid URL format" }
}
```
**Files:** `/websocket/server.js` (enforce in `_sendResponse()`)  
**Validation:** External client parses errors reliably; no pattern matching needed

#### 1.2 Fix Timing-Dependent Test Flakiness (4-6 hours)
**What:** Eliminate race conditions in manager test suites  
**Why:** Flaky tests indicate real concurrency bugs; external apps get unpredictable behavior  
**Current:** 7 manager test suites marked "may pass intermittently"  
**Fix:** Replace `setTimeout` with `jest.useFakeTimers()`; add promise flush helpers  
**Files:** `/tests/managers/*-manager.test.js`  
**Validation:** All tests pass consistently (100+ runs without failures)

#### 1.3 Add Per-Command Parameter Validation (3-4 hours)
**What:** Validate all 140+ command parameters against JSON Schema  
**Why:** Invalid commands silently ignored; external apps waste time debugging  
**Current:** No command-level validation; bad requests accepted  
**Fix:**
- Create schema registry for all commands
- Validate request against schema before execution
- Return `INVALID_PARAMETERS` error with field-level details
**Files:** `/websocket/command-validator.js` (new), update all handlers  
**Validation:** Invalid parameters rejected with helpful error messages

#### 1.4 Consolidate API Documentation (2 hours)
**What:** Single authoritative API reference + version changelog  
**Why:** Developers can't know which docs are current; integrations break on API changes  
**Current:** 28 different API docs; outdated copies in multiple locations  
**Fix:**
- Keep: `/docs/API-DOCUMENTATION-SUMMARY.md` (auto-generated, canonical)
- Keep: `/docs/openapi.yaml` (machine-readable spec)
- Keep: `/docs/EXAMPLES.md`, `/docs/INTEGRATION-GUIDE.md`, `/docs/QUICK-START-GUIDE.md`
- Archive: All other docs in `/docs/archive/`
- Create: `/docs/API-VERSIONS.md` (version history + breaking changes)
**Files:** Update MEMORY.md, root README.md with links  
**Validation:** Single clear path to current docs; no confusion

#### 1.5 Implement Command Reliability Guarantees (5-7 hours)
**What:** Ensure commands reliably succeed or fail predictably  
**Why:** Production systems need >99% reliability; external teams won't integrate without SLA  
**Current:** ~95% reliable; no retry mechanism; no metrics  
**Fix:**
- Add automatic retries with exponential backoff (max 3 attempts)
- Implement `/health` endpoint returning per-command reliability metrics
- Document SLA: "Core commands (navigate, click, fill, screenshot) 99%+ reliable"
- Add timeout guarantees: "All commands complete within 30s or fail with clear error"
**Files:** `/websocket/reliability-manager.js` (new), update server.js  
**Validation:** Health endpoint reports 99%+ for core commands; external apps monitor it

---

### Phase 2: Integration & Validation (9-11 hours) — Week 1-2, Days 4-5

#### 2.1 Request/Response Logging Middleware (2-3 hours)
**What:** Log all WebSocket requests and responses for debugging  
**Why:** External developers need clear logs for troubleshooting  
**Files:** `/websocket/logging-middleware.js`  
**Validation:** All requests logged with timestamp, command, parameters, response time

#### 2.2 Error Recovery Strategies Guide (2 hours)
**What:** Document how external apps should handle errors  
**Why:** Helps developers build robust integrations  
**Content:**
- Transient vs. permanent errors
- Retry strategies per error type
- Graceful degradation patterns
- Connection recovery
**Files:** `/docs/ERROR-RECOVERY-GUIDE.md`

#### 2.3 Connection Pool Management (3-4 hours)
**What:** Optimize connection lifecycle for production use  
**Why:** External apps may maintain 100+ concurrent connections  
**Fix:**
- Implement connection pooling with configurable limits
- Add connection reuse for repeated requests
- Clean up idle connections after 5 minutes
- Document max concurrent connections
**Files:** `/websocket/connection-pool.js`

#### 2.4 Pre-Deployment Validation Suite (4 hours)
**What:** Automated tests that external apps can run before integration  
**Why:** Gives external teams confidence the browser is production-ready  
**Tests:**
- Core command reliability (navigate → extract → success)
- Error schema validation (all errors follow standard format)
- Rate limiting (request limits enforced as documented)
- Connection stability (5+ min sessions without drops)
- Data consistency (same page navigated twice = same data)
**Files:** `/tests/pre-deployment-validation.test.js`  
**Validation:** Test suite passes; external teams can run it in their CI/CD

---

### Phase 3: Polish, Diagnostics & Documentation (18-24 hours) — Week 2, Days 6-10

#### 3.1 Rate Limit Retry-After Header (1-2 hours)
**What:** Add HTTP `Retry-After` header to rate limit responses  
**Why:** Helps external apps implement backoff correctly  
**Files:** `/websocket/rate-limiter.js`

#### 3.2 Integration Test Examples (3 hours)
**What:** Real working examples for common external app scenarios  
**Why:** Developers learn by example  
**Examples:**
- Web scraping with screenshots
- Multi-step form submission
- Session-based authentication
- Batch processing with rate limiting
**Files:** `/docs/INTEGRATION-EXAMPLES.md` (already exists)

#### 3.3 WebSocket Protocol Guarantees Doc (1 hour)
**What:** Document protocol behavior and guarantees  
**Why:** External apps need to understand reliability model  
**Content:**
- Connection establishment & cleanup
- Message ordering guarantees
- Retry semantics
- Error recovery
**Files:** `/docs/WEBSOCKET-PROTOCOL.md`

#### 3.4 TLS/HTTPS Support (4-5 hours)
**What:** Enable `wss://` (WebSocket Secure) in addition to `ws://`  
**Why:** Production systems require encrypted connections  
**Fix:**
- Add TLS certificate support
- Update server to accept both ws:// and wss://
- Document certificate installation
**Files:** `/websocket/server.js` (add TLS)

#### 3.5 Documentation Polish (3-4 hours)
**What:** Final review of all external-facing docs  
**Why:** First impression matters for adoption  
**Review:**
- Consistency in terminology
- No broken links
- Clear getting-started path
- Complete error code reference
**Files:** All docs in `/docs/`, `/QUICK-START-GUIDE.md`, `/EXAMPLES.md`

#### 3.6 Versioning & Release Notes (2-3 hours)
**What:** Publish v12.8.0 with clear release notes  
**Why:** External teams need to know what's new and what changed  
**Files:** Create `/docs/RELEASE-NOTES-v12.8.0.md`, update version in code

#### 3.7 Onboard Diagnostics API (3-4 hours) ⭐ SMART FEATURE
**What:** Self-documenting API—users query the browser for help, not external docs  
**Why:** External docs get out of sync. API should be self-documenting + git-ignored  
**Architecture:**
- Auto-generate OpenAPI spec from command registry (gitignore openapi.yaml)
- New endpoints:
  - `GET /api/help` — List all available commands
  - `GET /api/help?command=navigateTo` — Details + schema + examples for one command
  - `GET /api/help?error=INVALID_PARAMETERS` — Error recovery hints
  - `GET /api/health` — Per-command reliability metrics + rate limit status
  - `GET /api/diagnostics` — Browser health, version, capabilities
- Response format: Command name, schema, parameters, examples, error codes, recovery hints
- No external docs needed—API itself is the reference

**Example Response:**
```json
{
  "command": "navigateTo",
  "description": "Navigate to a URL",
  "parameters": {
    "url": {"type": "string", "required": true, "example": "https://example.com"},
    "timeout": {"type": "number", "default": 30000}
  },
  "examples": [
    {"url": "https://example.com"},
    {"url": "https://example.com", "timeout": 60000}
  ],
  "reliability": "99.2%",
  "errorCodes": ["INVALID_URL", "TIMEOUT", "NAVIGATION_FAILED"],
  "recoveryHints": {
    "TIMEOUT": "Increase timeout parameter or check network"
  }
}
```

**Files:** 
- `/websocket/help-server.js` (new) — handles `/api/help`, `/api/health`, `/api/diagnostics`
- `/websocket/command-registry.js` (new) — single source of truth for command metadata
- Update `/websocket/server.js` to include new endpoints
- Auto-generate (but gitignore) `/docs/openapi.yaml` on startup

**Validation:** External developers run `curl http://localhost:8765/api/help` and get full API reference

**Bonus:** Generated docs automatically stay in sync with code. No manual updates needed.

---

## Success Criteria

✅ **External App Readiness = All of:**
1. Error schema standard and validated
2. All tests pass consistently (no flakiness)
3. All commands validate parameters and reject invalid requests
4. Single authoritative API documentation
5. Command reliability metrics show 99%+ for core commands
6. Pre-deployment validation suite passes
7. TLS/HTTPS working
8. External team can integrate in 1-2 hours using docs + examples

---

## Why This Plan Works

- **Focused:** Only operational readiness (not edge cases or feature creep)
- **Specific:** Each item has concrete code locations and fixes
- **Ordered:** Dependencies first (error schema before validation, validation before reliability)
- **Measurable:** Clear success criteria per item
- **Unblocking:** CRITICAL items enable all others
- **Realistic:** 35-45 hours ≈ 5-7 days of focused development

---

## Execution Strategy

**Planning-First Approach:**
1. ✅ Identify exact work (THIS DOCUMENT)
2. → Execute Phase 1 (CRITICAL blockers) — 11-14 hours
3. → Execute Phase 2 (validation) — 9-11 hours
4. → Execute Phase 3 (polish) — 15-20 hours
5. → Release v12.8.0 for external GA

**No over-testing. No edge cases. No reactive spawning.** Just execute the plan.

---

## Related Documents

- **Workplan Details:** `/EXTERNAL-APP-READINESS-WORKPLAN.md` (comprehensive breakdown)
- **API Documentation:** `/docs/API-DOCUMENTATION-SUMMARY.md` (auto-generated)
- **Quick Start:** `/docs/QUICK-START-GUIDE.md` (for external developers)
- **Scope:** `/docs/architecture/SCOPE.md` (what the browser does)
- **Roadmap:** `/docs/roadmap/ROADMAP.md` (full project history)

---

## Timeline & Milestones

| Date | Milestone | Status |
|------|-----------|--------|
| June 21 | Planning complete (THIS DOCUMENT) | ✅ Complete |
| June 24 | Phase 1 blockers fixed | → In Progress |
| June 26 | Phase 2 validation complete | → Pending |
| June 28 | Phase 3 polish & release notes | → Pending |
| July 1 | v12.8.0 External GA Release | 🎯 Target |

---

## Next Steps

1. **Read this document** — understand the path
2. **Execute Phase 1** — fix CRITICAL blockers (development agents)
3. **Run validation suite** — ensure fixes work
4. **Execute Phase 2** — integration & validation
5. **Execute Phase 3** — polish & release
6. **Release v12.8.0** — external apps can now use this browser

**Status:** Ready for execution. No blockers. Proceeding.

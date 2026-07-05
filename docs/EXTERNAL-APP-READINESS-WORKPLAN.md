# External App Readiness - Execution Work Plan

**Current Version:** v12.7.0 / v12.8.0 (production staging)  
**Current Readiness:** ~65% ready for external app integration  
**Target:** 100% external app readiness (production GA)  
**Plan Created:** June 21, 2026

---

## Executive Summary

This work plan outlines the specific, execution-ordered tasks to reach "stable enough for external apps to use" status. It focuses on **operational reliability and developer experience**, not exhaustive edge case testing.

**Total estimated work:** 10-14 days, 5 critical + 8 high-priority tracks  
**Risk level:** LOW (all fixes are targeted, not architectural)  
**Blocking items:** 5 (must fix before external GA)

---

## CRITICAL BLOCKERS (Must Fix)

### [CRITICAL-1] Standardize WebSocket Error Response Schema — 2 hours

**Description:**  
WebSocket error responses lack consistent structure. Some errors include `errorCode`, others don't. Some wrap in `{ success: false, error }`, others don't. External clients can't reliably parse errors → implement fragile pattern matching → integrations break.

**Current State:**
- Successful responses: `{ success: true, result: {...}, id, command }`
- Error responses: INCONSISTENT
  - Some: `{ success: false, error: "message", errorCode, details }`
  - Some: `{ success: false, error: "message" }`
  - Some: No `success` field at all

**What to Fix:**
1. Enforce error response schema in `websocket/server.js` `_sendResponse()`:
   ```javascript
   {
     success: false,
     error: "<human-readable message>",
     errorCode: "<MACHINE_READABLE_CODE>",  // Always present
     command: "<command_name>",              // Echo back
     id: "<request_id>",                     // Echo back
     recoveryHint: "<what_to_do>",          // Actionable guidance
     details: { ... }                        // Optional context
   }
   ```

2. Create error code registry (enum):
   - `COMMAND_NOT_FOUND`
   - `INVALID_PARAMETERS`
   - `TIMEOUT`
   - `RATE_LIMIT_EXCEEDED`
   - `INTERNAL_ERROR`
   - `MALFORMED_JSON`
   - `INVALID_MESSAGE_FORMAT`
   - `SESSION_NOT_FOUND`
   - `TAB_NOT_FOUND`
   - `AUTHENTICATION_REQUIRED`

3. Add validation layer in command dispatcher to ensure all error responses match schema before sending

4. Update integration examples (`nodejs_client.js`, `python_client.py`) to parse by `errorCode` not message string

**Why This Blocks External Apps:**
- External clients implementing retry logic depend on consistent error format
- Without `errorCode`, clients must regex-match error messages (fragile)
- Some error responses missing required fields → clients crash when parsing
- Recovery hints enable intelligent retry strategies (backoff, redirect, etc.)

**Files to Modify:**
- `websocket/server.js` (enforce schema in all error paths)
- `websocket/command-dispatcher.js` (validate before sending)
- `integrations/nodejs_client.js` (example client implementation)
- `integrations/python_client.py` (example client implementation)

**Testing:**
- Create `tests/integration/error-response-schema.test.js`
- Verify all 50+ error conditions return valid schema
- Test client parsing with generated error responses

**Done When:**
- All error responses conform to schema
- Schema validation in server.js catches violations
- Integration tests pass
- Client libraries successfully parse all error types

---

### [CRITICAL-2] Fix Timing-Dependent Test Flakiness (Manager Tests) — 4-6 hours

**Description:**  
7 test suites marked as "may pass intermittently" due to race conditions in async mock responses. These are **unit-level tests**, not integration tests. If unit tests are flaky, external app behavior is unreliable.

**Known Flaky Test Suites:**
- `tests/managers/*extraction*` (DOM/HTML extraction timing)
- `tests/managers/*tab*` (tab creation/destruction timing)
- `tests/managers/*cookies*` (cookie jar operations)
- `tests/managers/*proxy*` (proxy rotation timing)
- `tests/managers/*profiles*` (profile switching timing)
- `tests/managers/*window*` (window pool state changes)
- `tests/managers/*storage*` (storage operation sequencing)

**Root Cause:**
- Mock promises resolve before test assertions run
- No guarantee of execution order in async chains
- Race between state updates and assertions
- Missing `jest.useFakeTimers()` in setup

**What to Fix:**

1. **Add deterministic timing to manager tests:**
   - Replace `setTimeout(..., random_ms)` with `jest.useFakeTimers()` + `jest.runAllTimers()`
   - Use `jest.advanceTimersByTime(ms)` for predictable sequencing
   - Await all pending promises: `await Promise.all([...pending])`

2. **Example fix pattern:**
   ```javascript
   // BEFORE (FLAKY):
   manager.extractHTML().then(result => {
     expect(result).toBeDefined();
   });
   
   // AFTER (DETERMINISTIC):
   jest.useFakeTimers();
   manager.extractHTML();
   jest.runAllTimers();
   await Promise.resolve(); // Flush microtask queue
   expect(manager.lastResult).toBeDefined();
   ```

3. **Fix locations:**
   - Add setup in `tests/helpers/setup.js` to enable `useRealTimers()` by default
   - Add teardown to ensure timers cleared between tests
   - Replace `setTimeout` with `jest.useFakeTimers()` in 7 manager test files
   - Add `await flushPromises()` helper after each async operation

4. **Identify root timing issue in managers:**
   - Check if managers use callbacks vs promises inconsistently
   - Ensure state updates happen before events are emitted
   - Verify mock listeners are attached BEFORE operations start

**Why This Blocks External Apps:**
- If internal tests are flaky, external behavior is unpredictable
- Developers can't trust command success/failure → avoid integrating
- Intermittent failures in tests indicate real concurrency bugs in managers
- External apps will experience same "works 80% of the time" failures

**Files to Modify:**
- `tests/helpers/setup.js` (add timer setup/teardown)
- 7 manager test files (use fake timers)
- `tests/helpers/promise-flush.js` (create helper if missing)

**Testing:**
- Run each flaky test 20x: `jest --testNamePattern="<suite>" --bail false`
- All should pass consistently
- Run full suite 3x in a row with no failures

**Done When:**
- All 7 manager test suites pass 20+ consecutive runs
- No intermittent failures in CI/CD logs over 24 hours
- Timing-dependent tests use `jest.useFakeTimers()` pattern

---

### [CRITICAL-3] Add Per-Command Parameter Validation — 3-4 hours

**Description:**  
Request size validation exists (prevents DoS), but **command-level schema validation is missing**. Invalid commands sometimes silently ignore extra fields, sometimes crash with unclear errors.

**Current State:**
- ✅ Size validation: 100 MB global limit enforced
- ✅ Rate limiting: 100 req/min enforced
- ❌ Command parameter validation: MISSING
  - Commands accept undefined parameters
  - No type enforcement (string vs number vs object)
  - No required field validation
  - No JSON Schema validation

**Example Problem:**
```javascript
// These all "work" but shouldn't:
{ command: 'navigate', url: undefined }
{ command: 'click', selector: 123 }  // should be string
{ command: 'fill', selector: 'input', text: { nested: 'object' } }  // wrong type
```

**What to Fix:**

1. **Create command schema registry** in `websocket/command-schemas.js`:
   ```javascript
   const COMMAND_SCHEMAS = {
     navigate: {
       required: ['url'],
       properties: {
         url: { type: 'string' },
         waitFor: { type: 'number' },
         timeout: { type: 'number' }
       }
     },
     click: {
       required: ['selector'],
       properties: {
         selector: { type: 'string' },
         options: { type: 'object' }
       }
     },
     // ... 140+ other commands
   };
   ```

2. **Add validation middleware** in command dispatcher:
   - Validate incoming command against schema
   - Return `INVALID_PARAMETERS` error if validation fails
   - Include field-level error details (which field, what was wrong, expected type)

3. **Use JSON Schema or AJV** for validation:
   ```javascript
   const ajv = new Ajv();
   const validate = ajv.compile(COMMAND_SCHEMAS[command]);
   const valid = validate(params);
   if (!valid) {
     return sendError('INVALID_PARAMETERS', 
       { field: validate.errors[0].instancePath, 
         message: validate.errors[0].message });
   }
   ```

4. **Generate schema registry from documentation** (automated):
   - Extract from `docs/API-REFERENCE-AUTHORITATIVE.md`
   - Generate `command-schemas.json`
   - Validate against actual command implementations

**Why This Blocks External Apps:**
- External apps need clear feedback when they send invalid commands
- Without validation, clients get random failures ("worked yesterday")
- Silent parameter ignoring means apps waste time debugging
- Clear validation errors enable fast integration cycles

**Files to Create:**
- `websocket/command-schemas.js` (schema registry)
- `websocket/command-validator.js` (validation logic)

**Files to Modify:**
- `websocket/command-dispatcher.js` (add validation step)
- `websocket/server.js` (invoke validator before command execution)

**Testing:**
- Create `tests/integration/command-validation.test.js`
- Test 20+ commands with invalid parameters
- Verify correct error response for each invalid case
- Test that valid commands still pass through

**Done When:**
- All 140+ commands have schema definitions
- Validation catches all invalid parameter cases
- Integration tests verify validation + error response schema
- Client libraries can parse validation errors

---

### [CRITICAL-4] Consolidate API Documentation (Single Source of Truth) — 2 hours

**Description:**  
28 different API reference documents exist in `/docs/api/`. External developers can't know which is current → they use outdated docs → integrations break. This is a **developer experience blocker**, not a code blocker, but it prevents external adoption.

**Current State:**
- `API-REFERENCE-AUTHORITATIVE.md` (71 KB) - marked as "authoritative"
- `API-REFERENCE-COMPLETE.md` (44 KB) - marked as "complete"
- `API-REFERENCE-V12.8.0.md` (19 KB) - version-specific
- `API-REFERENCE-v12.7.0.md` (42 KB) - version-specific
- 20+ other variants (different dates, different focuses)

**Problem:**
- External devs find oldest version first (Google search)
- Different versions have different command signatures
- No version history / changelog
- Some docs reference removed commands

**What to Fix:**

1. **Designate single authoritative API spec:**
   - Use `API-REFERENCE-AUTHORITATIVE.md` as master
   - Document version + release date prominently at top
   - Add note about version coverage: "Valid for v12.7.0 and later"

2. **Create version-specific changelog:**
   - `docs/API-CHANGELOG.md` - document command changes per version
   - Mark deprecated commands clearly: `[DEPRECATED in v12.8.0] use_instead_command`
   - Add "added in" version for new commands

3. **Publish OpenAPI/Swagger spec** (machine-readable):
   - Generate `docs/openapi.yaml` from code
   - Publish to Swagger Hub (free tier)
   - External tools can validate against spec

4. **Delete old docs:**
   - Rename all other variants with `-ARCHIVE-` prefix
   - Create `docs/ARCHIVE/` directory
   - Link from main docs: "Old versions available in ARCHIVE"
   - Robots.txt: disallow indexing of ARCHIVE

5. **Add version selection to README:**
   - "Which version am I using?" check
   - Link to correct docs based on version
   - Include breaking changes section

**Why This Blocks External Apps:**
- External developers integrating need to know they have correct docs
- Outdated docs → wrong command signatures → integration failures
- No version history means no way to track what changed between versions
- External teams can't standardize on a doc version

**Files to Create/Modify:**
- Create `docs/API-CHANGELOG.md`
- Create `docs/openapi.yaml` (generated from code)
- Rename 20+ old files to `docs/ARCHIVE/API-REFERENCE-*-ARCHIVE.md`
- Update `README.md` with version selection guide

**Testing:**
- Verify all commands in authoritative docs exist in code
- Verify no outdated command signatures in authoritative docs
- Run OpenAPI spec validation (swagger-cli validate)
- Search Google for "basset hound browser API" - top results should link to authoritative version

**Done When:**
- Single authoritative doc with clear version indicator
- Version-specific changes documented in changelog
- OpenAPI spec available and valid
- All old variants archived with clear "outdated" warning

---

### [CRITICAL-5] Implement Command Reliability Guarantees — 5-7 hours

**Description:**  
Core commands (navigate, click, fill) are ~95% reliable, but external apps need >99% reliability for production use. No automatic retry mechanism, no clear documentation of reliability expectations, no health checks.

**Current State:**
- ✅ Commands work most of the time
- ❌ No retry mechanism in server
- ❌ No reliability metrics published
- ❌ No health check standard
- ❌ No timeout strategy documented
- ❌ No graceful degradation

**Known Unreliable Commands (90-95% reliability):**
- `navigate` (timing-dependent, network issues)
- `screenshot_full_page` (DOM rendering delays)
- `execute_script` (async execution variance)
- `wait_for_element` (timing dependencies)
- Network-dependent operations

**What to Fix:**

1. **Add automatic retry mechanism** in server:
   - Retry 2-3 times on transient errors (timeout, network, etc.)
   - Exponential backoff: 100ms → 200ms → 400ms
   - Don't retry on non-recoverable errors (invalid params, not found, auth)
   - Log retry attempts for debugging

2. **Implement request/response validation:**
   - Pre-flight checks before command execution (tab exists, session valid, etc.)
   - Verify command preconditions (if clicking, element must exist)
   - Return clear error if preconditions fail

3. **Publish reliability metrics** per command:
   - Create `docs/COMMAND-RELIABILITY.md`
   - List each command with estimated pass rate
   - Document known failure modes
   - Provide workarounds

4. **Add health check endpoint:**
   - `GET /health` returns `{ healthy: true, uptime, version, capabilities }`
   - Use standard HTTP (not WebSocket) for easy health checks
   - Include in Docker health check

5. **Implement timeout strategy:**
   - Document timeout expectations per command
   - Allow override per request: `{ command: 'navigate', timeout: 60000 }`
   - Default timeouts based on command type:
     - Navigation: 30s
     - Extraction: 10s
     - Interaction: 5s

6. **Create failure recovery patterns:**
   - Auto-reconnect on disconnect
   - Session resumption after failure
   - Clear error messages with recovery steps

**Why This Blocks External Apps:**
- Production systems need >99% reliability
- Without retries, transient network issues fail permanently
- External teams won't integrate without reliability SLA
- No metrics means no way to assess if system meets their needs

**Files to Create/Modify:**
- `websocket/server.js` (add retry logic)
- `websocket/command-dispatcher.js` (pre-flight checks)
- Create `docs/COMMAND-RELIABILITY.md`
- Create `websocket/health-check.js`
- Modify `Dockerfile` (add HTTP health check)

**Testing:**
- Create `tests/integration/reliability.test.js`
- Simulate failure conditions (network delay, timeout, disconnect)
- Verify retries work and recover
- Verify health check returns correct status

**Done When:**
- Retry mechanism working for transient errors
- Health check endpoint working and returning proper format
- Reliability metrics documented for all commands
- Docker health check configured
- External integration tests pass 100% over 1000 runs

---

## HIGH-PRIORITY FIXES (Should Fix)

### [HIGH-1] Add Request/Response Logging Middleware — 2-3 hours

**Description:**  
External developers need to understand what's happening during failures. No standardized request/response logging that external apps can access.

**What to Fix:**
- Add optional request/response logging (enable via config)
- Log to `/tmp/basset-hound-requests.log` (rolling file)
- Include: timestamp, command, parameters (sanitized), response time, result
- Make queryable: `get_request_logs(filter)` command
- Expose as WebSocket command: external apps can retrieve recent logs

**Files:**
- `websocket/logging-middleware.js` (create)
- `websocket/server.js` (integrate middleware)
- Add `get_request_logs` command

**Done When:**
- Request/response logs available and queryable
- Sensitive data sanitized (passwords, tokens)
- Log rotation configured
- External apps can debug issues via logs

---

### [HIGH-2] Document Error Recovery Strategies — 2 hours

**Description:**  
External apps need patterns for handling common failures. Create comprehensive guide.

**What to Fix:**
- Create `docs/ERROR-RECOVERY-GUIDE.md`
- Document retry patterns (exponential backoff, circuit breaker)
- Provide code examples for common failures
- List non-recoverable errors that shouldn't be retried

**Done When:**
- Guide exists and covers 10+ common error scenarios
- Code examples work
- External developers reference it successfully

---

### [HIGH-3] Implement Connection Pool Management — 3-4 hours

**Description:**  
External apps need guidance on connection pooling. No official best practices documented.

**What to Fix:**
- Create `websocket/connection-pool-manager.js`
- Document: max connections, connection reuse, cleanup
- Implement: connection lease/return patterns
- Add metrics: active connections, reuse rate

**Done When:**
- Connection pool documented
- External apps can reliably manage multiple connections
- Metrics show pool health

---

### [HIGH-4] Add Pre-Deployment Validation Suite — 4 hours

**Description:**  
External apps need way to verify Basset Hound is production-ready before integrating. Create validation tests.

**What to Fix:**
- Create `tests/external-app-validation/` directory
- Tests cover: core workflow, response schema, connection stability, rate limiting, error recovery
- All tests should pass before external release
- Tests can be run by external teams to verify compatibility

**Done When:**
- Validation suite exists with 5+ comprehensive tests
- All tests pass
- External teams can run validation locally

---

### [HIGH-5] Implement Rate Limit Retry-After Header — 1-2 hours

**Description:**  
Rate limiting works, but clients don't know when limit resets. Add `retry-after` to error response.

**What to Fix:**
- When rate limit hit, calculate reset time
- Include `retryAfter: <milliseconds>` in error response
- Document: sliding window size, reset calculation
- External clients use this for smart retry

**Done When:**
- Rate limit errors include `retryAfter`
- External clients can parse and use retry-after
- Documentation covers retry strategy

---

### [HIGH-6] Create Integration Test Examples — 3 hours

**Description:**  
External developers need working examples of how to integrate. Create reference implementations.

**What to Fix:**
- Create `examples/` directory with working code
- Examples cover: basic navigation, form filling, data extraction, error handling
- Include Python, JavaScript, Go examples
- Each example includes: setup, execution, output

**Done When:**
- 5+ examples exist and work
- Each example demonstrates integration patterns
- External devs use examples as templates

---

### [HIGH-7] Document WebSocket Protocol Guarantees — 1 hour

**Description:**  
External apps need clear protocol semantics guarantees.

**What to Fix:**
- Create `docs/WEBSOCKET-PROTOCOL-GUARANTEES.md`
- Document: request/response ordering, message reliability, connection semantics
- Guarantee: messages delivered in order, responses always sent (unless connection drops)
- Document edge cases: what happens on disconnect, reconnect behavior

**Done When:**
- Document exists and is comprehensive
- External developers reference it and integrate successfully
- No surprises about message ordering or delivery

---

### [HIGH-8] Implement TLS/HTTPS Support for External Connections — 4-5 hours

**Description:**  
Current deployment uses HTTP WebSocket (ws://). Production external apps need TLS security (wss://).

**Current State:**
- SSL cert auto-generation implemented
- HTTP health checks working
- WebSocket server supports TLS

**What to Fix:**
- Ensure wss:// endpoints working in Docker
- Document TLS setup and certificate management
- Provide certificate validation examples
- Test external client TLS connections

**Done When:**
- wss:// connections work from external clients
- Certificate validation optional but documented
- TLS configuration clear for deployment

---

## EXECUTION ORDER & DEPENDENCIES

```
Week 1 (Days 1-3): CRITICAL blockers
├─ CRITICAL-1: Error response schema (2h) - FIRST (blocks all testing)
├─ CRITICAL-2: Fix flaky tests (4-6h) - SECOND (blocks confidence)
├─ CRITICAL-3: Parameter validation (3-4h) - THIRD (blocks reliability)
└─ CRITICAL-4: API docs consolidation (2h) - FOURTH (blocks adoption)

Week 1-2 (Days 4-5): Integration & validation
├─ CRITICAL-5: Reliability guarantees (5-7h)
├─ HIGH-4: Validation suite (4h) - DEPENDS ON CRITICAL-1,2,3,5
└─ HIGH-1: Request logging (2-3h)

Week 2 (Days 6-10): Polish & documentation
├─ HIGH-2: Recovery strategies (2h)
├─ HIGH-3: Connection pool mgmt (3-4h)
├─ HIGH-5: Rate limit retry-after (1-2h)
├─ HIGH-6: Integration examples (3h)
├─ HIGH-7: Protocol guarantees doc (1h)
└─ HIGH-8: TLS/HTTPS support (4-5h)
```

---

## Success Criteria

**External apps can integrate when ALL of:**

✅ Error responses follow consistent schema  
✅ No flaky tests (all manager tests pass 20+ times)  
✅ Parameter validation catches invalid commands  
✅ Single authoritative API documentation  
✅ Core commands >99% reliable (with retries)  
✅ Health check endpoint available  
✅ Request logging queryable  
✅ Validation suite passes 100%  
✅ Example integrations work  
✅ Protocol guarantees documented  

---

## Risk Assessment

**Overall Risk Level:** LOW

- All fixes are targeted (not architectural)
- No breaking changes to existing commands
- Backward compatible (retries are transparent)
- Low external dependencies
- Can be deployed incrementally

**Deployment Strategy:**
1. Deploy CRITICAL fixes first (external API changes)
2. Run validation suite
3. Deploy HIGH-priority fixes
4. Run extended validation (24+ hours)
5. Release external GA version

---

## Metrics for External Readiness

Track these to measure progress:

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Error response schema consistency | 100% | 60% | 🟡 |
| Manager test stability | 100% pass rate | 95% | 🟡 |
| Command parameter validation | 100% commands | 0% | 🔴 |
| API documentation version conflicts | 0 | 28 files | 🔴 |
| Command reliability (>99%) | All commands | ~85% | 🟡 |
| Health check endpoint | ✅ | ❌ | 🔴 |
| External validation tests | ✅ | ❌ | 🔴 |
| Documentation completeness | 100% | 80% | 🟡 |
| Example integrations | 5+ | 0 | 🔴 |

---

## Next Steps

1. **Start immediately:** Begin with CRITICAL-1 (error schema) - blocking everything else
2. **Create issues:** File GitHub issues for each work item with acceptance criteria
3. **Assign owners:** Each work item gets assigned developer
4. **Track progress:** Daily standup on status
5. **Gate releases:** Validation suite must pass before external GA

**Target completion:** June 30, 2026 (9 days from start)  
**External GA release:** July 1, 2026

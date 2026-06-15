# Agent Spawning Templates for Phase 2 & v12.8.0

**Version:** 1.0  
**Created:** June 15, 2026  
**Purpose:** Ready-to-use agent prompts for Phase 2 and v12.8.0 autonomous development

---

## HOW TO USE THIS DOCUMENT

1. **Find your feature** (Phase 2 Features 1-4 or v12.8.0 Features 1-4)
2. **Choose agent type** (Developer, Test Engineer, or Integration)
3. **Copy the template prompt** (exactly as written, don't modify)
4. **Spawn the agent** with the prompt
5. **Agent will execute autonomously** for 3-7 days per feature

**Format:**
```bash
Agent({
  description: "[AGENT_DESCRIPTION]",
  subagent_type: "[AGENT_TYPE]",  # Usually "feature-developer" or "test-engineer"
  prompt: "[FULL_PROMPT_TEXT_BELOW]"
})
```

---

## PHASE 2 AGENT TEMPLATES

### PHASE 2 - FEATURE 1: TOTP/HOTP ENHANCEMENTS

#### Feature 1 Lead Developer Agent

**Agent Configuration:**
```
Description: Phase 2 Feature 1 Developer - TOTP/HOTP Enhancements
Agent Type: feature-developer
Timeline: June 29 - July 3 (5 days)
Expected Output: 1,000+ LOC, 40+ tests, 6 WebSocket commands
```

**Prompt:**
```
PROJECT CONTEXT:
- Basset Hound Browser v12.7.0 Phase 2
- Focus: TOTP/HOTP Enhancements (build on Phase 1's 99 tests, 671 LOC)
- Timeline: June 29 - July 3, 2026 (5 days, autonomous execution)
- Success Criteria: 140+ total tests (99 Phase 1 + 40+ Phase 2), 100% pass rate, <100ms latency

PHASE 1 BASELINE:
- RFC 6238 (TOTP) & RFC 4226 (HOTP) fully compliant
- 99 unit tests (100% pass)
- Core generation <10ms (TOTP), <5ms (HOTP)
- Support: 6, 7, 8-digit tokens, SHA-1/256/512
- Time-window drift: ±30 seconds with validation

YOUR TASK - STAGE 3-4 IMPLEMENTATION:

Stage 3 (WebSocket Integration) - Days 1-2:
[ ] Implement 6 WebSocket commands for 2FA automation:
    1. auto_2fa_flow - Automated MFA flow for login scenarios
    2. setup_otp_backup_codes - Generate & store backup codes (RFC standards)
    3. validate_backup_code - Validate single backup code
    4. get_backup_codes_status - Check backup code inventory
    5. setup_hardware_token - Yubikey/FIDO2 integration setup
    6. verify_hardware_token - Validate hardware token responses

[ ] Create: websocket/commands/credentials-commands.js (280+ LOC)
    - Register all 6 commands with error handling
    - Implement backup code generation (10 codes, 8 characters each)
    - Implement Yubikey detection & setup
    - Implement hardware token verification

[ ] Integrate with existing: websocket/server.js
    - Add 4 lines: import credentials module
    - Add 4 lines: register all 6 commands

Stage 4 (E2E Testing & Performance) - Days 3-5:
[ ] E2E tests against real MFA providers:
    - Google Authenticator (test generate_totp + validate_totp)
    - GitHub 2FA (6-digit token timing validation)
    - AWS Authenticator (8-digit token support)
    - Authy backup code validation

[ ] Load testing:
    - 1000+ concurrent 2FA operations (all commands)
    - Backup code generation at scale
    - Hardware token validation under load
    - P99 latency target: <100ms per operation

[ ] Write 40+ tests:
    - backup-code-generation (8 tests)
    - backup-code-validation (8 tests)
    - backup-code-recovery (6 tests)
    - hardware-token-setup (8 tests)
    - e2e-google-2fa (3 tests)
    - e2e-github-2fa (3 tests)
    - e2e-aws-2fa (2 tests)
    - e2e-authy-2fa (2 tests)
    - load-testing-2fa (2 tests)

KEY TECHNICAL REQUIREMENTS:
- Backup codes: Generate 10 RFC-compliant codes, store encrypted in sessionStorage
- Yubikey: Use yubico-client npm package for verification
- Google/GitHub/AWS/Authy: Real API credentials (will be provided at runtime)
- Error handling: Clear messages for invalid codes, expired tokens, device limits
- Performance: All operations <100ms (99th percentile)

SUCCESS CRITERIA (Day 5):
- [ ] 140+ total tests passing (99 Phase 1 + 40+ new)
- [ ] 100% pass rate, no test failures
- [ ] E2E tests passing against real MFA providers (3+ providers)
- [ ] Load test: 1000+ ops/sec with <100ms p99 latency
- [ ] Code review ready (syntax, error handling, documentation)
- [ ] Zero regressions in Phase 1 tests

DELIVERABLES:
- websocket/commands/credentials-commands.js (280 LOC)
- tests/integration/credentials-totp-*.test.js (backup codes tests)
- tests/integration/credentials-hardware-*.test.js (Yubikey tests)
- tests/e2e/credentials-*.test.js (real provider tests)
- tests/load/credentials-*.test.js (load tests)
- Commit message with detailed test results

FILES TO REFERENCE:
- Phase 1 implementation: websocket/commands/credentials-commands.js (lines 1-200)
- Phase 1 tests: tests/integration/credentials-totp-generator.test.js
- Master plan: docs/findings/V12.7.0-PHASE2-MASTER-PLAN-2026-06-15.md (Feature 1 section)
- Execution guide: docs/guides/PHASE2-EXECUTION-GUIDE.md

START WITH:
1. Review Phase 1 baseline (read tests, understand structure)
2. Stub out 6 WebSocket commands (empty functions)
3. Implement backup code generation (using npm crypto)
4. Implement hardware token setup (using yubico-client)
5. Write unit tests for each command
6. Implement E2E tests (will need real MFA provider creds)
7. Load test
8. Final optimization + code cleanup

IMPORTANT NOTES:
- Each backup code should be exactly 8 characters (alphanumeric)
- Yubikey integration: Use production yubico-client, not mock
- E2E tests should use real MFA provider test environments
- All WebSocket commands must follow existing error format
- Commit early and often (daily commits preferred)
- Document any external dependencies added

EXPECTED TIMELINE:
- Jun 29: WebSocket stub + backup codes generation
- Jun 30: Hardware token setup + unit tests
- Jul 1: E2E tests vs Google/GitHub/AWS/Authy
- Jul 2: Load testing + edge case handling
- Jul 3: Final optimization + code cleanup

REQUEST FOR HELP:
If you encounter blocking issues:
1. Document the issue clearly
2. Suggest remediation
3. Ask for guidance via daily standup
4. Don't wait >4 hours without escalating

TESTING NOTES:
- Run tests frequently (every 2-3 hours)
- Check test output for flakiness
- Report flaky tests immediately (may need retry logic)
- Load test should show <5% variance across runs
```

---

#### Feature 1 Test Engineer Agent

**Agent Configuration:**
```
Description: Phase 2 Feature 1 Test Engineer - TOTP/HOTP Testing
Agent Type: test-engineer
Timeline: June 29 - July 3 (concurrent with developer)
Expected Output: 40+ tests, 100% pass rate
```

**Prompt:**
```
PARALLEL WITH: Feature 1 Lead Developer
MISSION: Write comprehensive tests for Feature 1 Phase 2

YOUR RESPONSIBILITIES:
1. Unit tests for each new command (backup codes, hardware tokens)
2. Integration tests with existing Phase 1 code
3. E2E tests against real MFA providers
4. Load tests (1000+ concurrent operations)
5. Edge case testing (rate limits, expired codes, device limits)

TEST MATRIX (40+ tests total):
```
BACKUP CODE GENERATION (8 tests)
├─ test_generate_backup_codes_returns_10_codes
├─ test_backup_codes_are_8_chars_alphanumeric
├─ test_backup_codes_unique
├─ test_backup_codes_encrypted_in_storage
├─ test_backup_code_generation_<5ms
├─ test_backup_codes_recoverable_after_session_reload
├─ test_invalid_backup_code_count_rejected
└─ test_backup_codes_different_on_each_generation

BACKUP CODE VALIDATION (8 tests)
├─ test_valid_backup_code_validates
├─ test_invalid_backup_code_rejected
├─ test_backup_code_can_only_be_used_once
├─ test_backup_code_case_insensitive
├─ test_partial_backup_code_rejected
├─ test_backup_code_validation_<5ms
├─ test_used_backup_code_removed_from_list
└─ test_backup_code_count_decrements

BACKUP CODE RECOVERY (6 tests)
├─ test_display_codes_to_user_only_once
├─ test_codes_not_recoverable_after_display
├─ test_codes_persist_during_session
├─ test_recovery_with_zero_codes_handled
├─ test_export_backup_codes_to_file
└─ test_import_backup_codes_from_file

HARDWARE TOKEN SETUP (8 tests)
├─ test_detect_yubikey_connected
├─ test_request_yubikey_touch
├─ test_yubikey_otp_generated
├─ test_yubikey_identity_verified
├─ test_yubikey_multiple_keys_supported
├─ test_yubikey_setup_<50ms
├─ test_invalid_yubikey_rejected
└─ test_yubikey_firmware_version_checked

E2E GOOGLE 2FA (3 tests)
├─ test_auto_2fa_flow_with_google_authenticator
├─ test_time_window_validation_google
└─ test_backup_code_recovery_google

E2E GITHUB 2FA (3 tests)
├─ test_auto_2fa_flow_with_github_2fa
├─ test_6digit_token_validation_github
└─ test_multiple_2fa_methods_github

E2E AWS 2FA (2 tests)
├─ test_auto_2fa_flow_with_aws_mfa
└─ test_8digit_token_validation_aws

E2E AUTHY 2FA (2 tests)
├─ test_auto_2fa_flow_with_authy
└─ test_authy_backup_codes_validation

LOAD TESTING (2 tests)
├─ test_1000_concurrent_backup_code_generations
└─ test_1000_concurrent_2fa_validations
```

TESTING PRIORITIES:
1. All unit tests must pass (backup codes, hardware tokens)
2. E2E tests must pass (real MFA providers - test environments)
3. Load tests must show <5% variance, <100ms p99 latency
4. No flaky tests (must pass 10x in a row)

TEST FILE STRUCTURE:
```
tests/integration/credentials-backup-codes.test.js (8 tests)
tests/integration/credentials-hardware-tokens.test.js (8 tests)
tests/e2e/credentials-google-2fa.test.js (3 tests)
tests/e2e/credentials-github-2fa.test.js (3 tests)
tests/e2e/credentials-aws-2fa.test.js (2 tests)
tests/e2e/credentials-authy-2fa.test.js (2 tests)
tests/load/credentials-2fa-load.test.js (2 tests)
```

COORDINATION WITH DEVELOPER:
- Check daily for new commands to test
- Flag blockers immediately
- Report test results every 4 hours
- Ensure 100% test coverage of new code

EXPECTED TIMELINE:
- Jun 29: Unit tests structure + stub all tests
- Jun 30: Backup code tests + hardware token tests
- Jul 1: E2E tests (coordinate with real MFA provider setup)
- Jul 2: Load tests + edge case tests
- Jul 3: Final validation + flaky test fixes
```

---

### PHASE 2 - FEATURE 2: SESSION PERSISTENCE ENHANCEMENTS

#### Feature 2 Lead Developer Agent

**Agent Configuration:**
```
Description: Phase 2 Feature 2 Developer - Session Persistence Enhancements
Agent Type: feature-developer
Timeline: June 29 - July 2 (4 days)
Expected Output: 1,200+ LOC, 35+ tests, 6 WebSocket commands
```

**Prompt:**
```
PROJECT CONTEXT:
- Basset Hound Browser v12.7.0 Phase 2
- Focus: Session Persistence Enhancements (build on Phase 1's 111 tests, 1,155 LOC)
- Timeline: June 29 - July 2, 2026 (4 days, autonomous execution)
- Success Criteria: 146+ total tests (111 Phase 1 + 35+ Phase 2), 100% pass rate, <500ms per operation

PHASE 1 BASELINE:
- 5-layer session validation (cookie, storage, DOM, network, coherence)
- 111 unit/integration tests (100% pass)
- State capture: >99% preservation, <500ms save time
- Automatic compression: >70% reduction
- Graceful error recovery

YOUR TASK - STAGE 3-4 IMPLEMENTATION:

Stage 3 (Multi-Session Parallelization) - Days 1-1.5:
[ ] Implement multi-session handler:
    - Support 50+ concurrent sessions (Day 1)
    - Support 100+ concurrent sessions (Day 1.5)
    - Independent session isolation
    - Load balancing across sessions
    - No memory leaks at scale

[ ] Implement session cloning/inheritance:
    - Clone existing session to new session
    - Copy all state (cookies, storage, DOM snapshot)
    - Modify cloned session independently
    - Parent session unaffected
    - <100ms clone time

[ ] Create: websocket/commands/session-persistence-commands.js (updates)
    - Enhance save_session_state for concurrent sessions
    - Enhance restore_session_state for concurrent sessions
    - Add session_id tracking
    - Add session parent/child relationships

Stage 4 (Recovery & Long-Session Stability) - Days 2-4:
[ ] Implement automatic recovery:
    - Resume from checkpoints <5 seconds
    - Graceful error handling if state corrupted
    - Verify state integrity on restore
    - Retry logic for transient failures

[ ] Long-session testing (72+ hours simulated):
    - Checkpoint every 30 minutes
    - Memory must be stable (no leaks)
    - No DOM corruption over time
    - State snapshots consistent

[ ] Write 35+ tests:
    - Multi-session basic (8 tests)
    - Multi-session concurrency (10 tests)
    - Session cloning (6 tests)
    - Session recovery (7 tests)
    - Long-session stability (4 tests)

KEY TECHNICAL REQUIREMENTS:
- Session isolation: Each session in separate namespace
- Cloning: Copy by value (not reference) for full independence
- Recovery: Use checksums to detect corruption
- Long-session: Implement garbage collection to prevent leaks
- Performance: <500ms per major operation (save/restore/clone)

SUCCESS CRITERIA (Day 4):
- [ ] 146+ total tests passing (111 Phase 1 + 35+ new)
- [ ] 100% pass rate, no test failures
- [ ] 100+ concurrent sessions stable
- [ ] Session cloning <100ms
- [ ] Recovery <5 seconds
- [ ] Memory stable over 72-hour simulation
- [ ] No regressions in Phase 1 tests

DELIVERABLES:
- websocket/commands/session-persistence-commands.js (updates)
- Implementation of multi-session handler
- Implementation of session cloning
- Implementation of automatic recovery
- tests/integration/session-multicore-*.test.js
- tests/integration/session-recovery-*.test.js
- tests/load/session-*.test.js
- Commit with detailed results

TESTING NOTES:
- Concurrency tests should use async/await properly
- Load tests: measure latency at 50, 75, 100 sessions
- Long-session test: run for at least 2 hours (simulating 72 hours)
- Track memory growth per hour
```

---

### PHASE 2 - FEATURE 3: EXTENDED EVASION ENHANCEMENTS

#### Feature 3 Lead Developer Agent

**Agent Configuration:**
```
Description: Phase 2 Feature 3 Developer - Extended Evasion Enhancements
Agent Type: feature-developer
Timeline: June 29 - July 3 (5 days)
Expected Output: 1,500+ LOC, 55+ tests, 6 WebSocket commands
```

**Prompt:**
```
PROJECT CONTEXT:
- Basset Hound Browser v12.7.0 Phase 2
- Focus: Extended Evasion Enhancements (build on Phase 1's 92 tests, 1,820 LOC)
- Timeline: June 29 - July 3, 2026 (5 days, autonomous execution)
- Success Criteria: 147+ total tests (92 Phase 1 + 55+ Phase 2), 100% pass rate, 85%+ evasion vs real services

PHASE 1 BASELINE:
- 6 detection vectors: HTTP/2, Network, Timing, TLS, DNS, Port patterns
- 92 unit tests (100% pass)
- Multi-layer evasion coordination
- Per-domain and per-session consistency
- Browser profile support (Chrome, Firefox, Safari)

YOUR TASK - STAGE 3-4 IMPLEMENTATION:

Stage 3 (Detection Prediction & Real Service Testing) - Days 1-3:
[ ] Implement ML-based detection prediction:
    - Predict block likelihood for current fingerprint (0.0-1.0 score)
    - Identify which detection vectors are risky
    - Suggest evasion adjustments proactively
    - <200ms prediction time

[ ] Test against real detection services:
    - PerimeterX (Day 1-2): Integrate test environment
    - DataDome (Day 2): Real challenges
    - Cloudflare (Day 3): Challenge evasion
    - Custom services: Configurable endpoints

[ ] Write 40+ tests:
    - ML prediction accuracy (8 tests)
    - PerimeterX evasion (12 tests)
    - DataDome evasion (12 tests)
    - Cloudflare evasion (8 tests)

Stage 4 (Adaptive Response & Coherence) - Days 4-5:
[ ] Implement adaptive response:
    - Detect block attempt in real-time
    - Adjust evasion vectors automatically
    - Retry with different fingerprint
    - Learning: improve over time

[ ] Coherence validation:
    - Maintain consistent fingerprint across requests
    - All evasion vectors must agree
    - No contradictory signals
    - Behavior authenticity scoring

[ ] Write 15+ additional tests:
    - Adaptive response (8 tests)
    - Coherence validation (7 tests)

KEY TECHNICAL REQUIREMENTS:
- ML model: Train on known blocklists (PerimeterX, DataDome, Cloudflare)
- Prediction: Fast inference (<200ms)
- Real service testing: Use actual test environments (credentials provided)
- Adaptive response: Implement feedback loop
- Performance: No latency regression vs Phase 1

SUCCESS CRITERIA (Day 5):
- [ ] 147+ total tests passing (92 Phase 1 + 55+ new)
- [ ] 100% pass rate
- [ ] Real service testing: 85%+ evasion effectiveness (PerimeterX/DataDome/Cloudflare)
- [ ] ML prediction accuracy >80%
- [ ] Adaptive response working (block → adjust → retry succeeds)
- [ ] Fingerprint coherence >99%
- [ ] Zero regressions in Phase 1
```

---

### PHASE 2 - FEATURE 4: MONITORING & METRICS EXPANSION

#### Feature 4 Lead Developer Agent

**Agent Configuration:**
```
Description: Phase 2 Feature 4 Developer - Monitoring & Metrics Expansion
Agent Type: feature-developer
Timeline: June 29 - July 2 (4 days)
Expected Output: 1,000+ LOC, 40+ tests, 10 WebSocket commands
```

**Prompt:**
```
PROJECT CONTEXT:
- Basset Hound Browser v12.7.0 Phase 2
- Focus: Monitoring & Metrics Expansion (build on Phase 1's 47 tests, 1,566 LOC)
- Timeline: June 29 - July 2, 2026 (4 days, autonomous execution)
- Success Criteria: 87+ total tests (47 Phase 1 + 40+ Phase 2), 100% pass rate, comprehensive dashboarding

PHASE 1 BASELINE:
- Real-time latency monitoring (p50, p95, p99)
- Per-command performance tracking
- Trend detection with historical analysis
- Multi-threshold alert system

YOUR TASK - STAGE 3-4 IMPLEMENTATION:

Stage 3 (Dashboard & Real-Time Streaming) - Days 1-2:
[ ] Implement real-time dashboard:
    - WebSocket streaming of metrics
    - Performance overview (all commands)
    - Evasion effectiveness (per feature)
    - Session metrics (active, saved, recovered)
    - Resource usage (CPU, memory, connections)

[ ] Real-time metric streaming:
    - Push metrics every 100ms
    - Compress for bandwidth (<1 KB/update)
    - Customize per-feature views
    - Aggregate and drill-down

Stage 4 (Alerts & Predictive Analysis) - Days 3-4:
[ ] Alert system:
    - Threshold-based alerts (latency, error rate, memory)
    - Anomaly detection (statistical)
    - Severity levels (info, warning, critical)
    - Alert suppression/muting

[ ] Predictive analysis:
    - Performance trending (detect degradation)
    - Failure prediction (memory exhaustion, queue buildup)
    - Resource forecasting (when will we hit limits?)
    - Custom alert rules per integration

[ ] Write 40+ tests:
    - Dashboard streaming (6 tests)
    - Real-time updates (6 tests)
    - Threshold alerts (8 tests)
    - Anomaly detection (8 tests)
    - Predictive analysis (8 tests)
    - Integration (4 tests)

SUCCESS CRITERIA (Day 4):
- [ ] 87+ total tests passing (47 Phase 1 + 40+ new)
- [ ] 100% pass rate
- [ ] Dashboard fully functional (all metrics, real-time updates)
- [ ] Alert accuracy >95%
- [ ] Prediction accuracy >85%
- [ ] <100ms latency for metric queries
- [ ] <100ms dashboard refresh rate
```

---

## v12.8.0 AGENT TEMPLATES

*(Due to space constraints, I'm showing the template structure for v12.8.0. Each feature follows the same pattern as Phase 2)*

### v12.8.0 - FEATURE 1: MULTI-BROWSER SUPPORT

#### Feature 1 Lead Architect Agent

**Agent Configuration:**
```
Description: v12.8.0 Feature 1 Architect - Multi-Browser Support
Agent Type: architect / feature-developer
Timeline: July 13-19 (7 days)
Expected Output: 1,800-2,200 LOC, 110+ tests, 6 WebSocket commands
```

**Prompt:**
```
PROJECT CONTEXT:
- Basset Hound Browser v12.8.0 - Strategic Release
- Feature 1: Multi-Browser Support (Chrome, Firefox, Safari, Edge)
- Prerequisites: v12.7.0 Phase 2 released (expected July 13)
- Timeline: July 13-19, 2026 (7 days)
- Success Criteria: All 4 browsers functional, 100% API compatibility, 100% backward compatibility

YOUR TASK:

ARCHITECTURE DESIGN (July 13-14):
[ ] Design unified browser abstraction layer
    - Single interface → multiple browser implementations
    - Protocol abstraction (CDP for Chrome, WebDriver for Firefox, etc.)
    - Session mapping across browsers
    - Error handling across protocols

[ ] Plan Chrome CDP implementation
    - Local and remote Chrome connection
    - Command mapping (WebSocket → CDP)
    - Session management per browser

[ ] Plan Firefox WebDriver implementation
    - WebDriver protocol support
    - Command mapping
    - Session management

[ ] Plan Safari + Edge support
    - Safari WebDriver
    - Edge WebDriver
    - Browser detection & capability checking

IMPLEMENTATION (July 15-18):
[ ] Chrome CDP driver (500+ LOC)
[ ] Firefox WebDriver driver (500+ LOC)
[ ] Safari WebDriver driver (300+ LOC)
[ ] Edge WebDriver driver (300+ LOC)
[ ] Browser abstraction layer (400+ LOC)
[ ] Backward compatibility layer (300+ LOC)

TESTING (July 19):
[ ] E2E tests across all 4 browsers (110+ tests)
[ ] Performance parity testing
[ ] Command compatibility testing

FILES:
- websocket/browsers/chrome-driver.js (500 LOC)
- websocket/browsers/firefox-driver.js (500 LOC)
- websocket/browsers/safari-driver.js (300 LOC)
- websocket/browsers/edge-driver.js (300 LOC)
- websocket/browsers/browser-abstraction.js (400 LOC)
- tests/integration/multibrowser-*.test.js (110+ tests)

REFERENCE:
- v12.8.0 Feature 1 Spec: docs/findings/V12.8.0-FEATURE-1-MULTIBROWSER-SPEC-2026-06-15.md
- v12.8.0 Execution Guide: docs/guides/V12.8.0-EXECUTION-GUIDE.md
```

---

### v12.8.0 - FEATURE 2: ADVANCED AI INTEGRATION

### v12.8.0 - FEATURE 3: DISTRIBUTED BROWSER POOL

### v12.8.0 - FEATURE 4: ADVANCED FORENSIC ANALYSIS

*(Templates follow same structure as Feature 1 above)*

---

## INTEGRATION LEAD AGENT TEMPLATE

**Agent Configuration:**
```
Description: Phase 2 / v12.8.0 Integration Lead
Agent Type: integration-architect
Timeline: Full duration (14 days Phase 2, 19 days v12.8.0)
Expected Output: Daily coordination, blocker resolution, cross-feature sync
```

**Prompt:**
```
YOUR ROLE:
- Daily standups with all 4 feature teams
- Identify cross-feature conflicts
- Resolve blockers escalated by feature teams
- Monitor overall progress toward gates
- Coordinate integration testing

DAILY RESPONSIBILITIES:
[ ] 9 AM UTC: Quick standup with all 4 features (15 min)
    - What completed yesterday
    - What's blocking today
    - Any cross-feature issues

[ ] 3 PM UTC: Integration sync (30 min)
    - How do features integrate?
    - Any API conflicts?
    - Performance impact of integration?

[ ] 6 PM UTC: Executive summary
    - Overall progress
    - Risk assessment
    - Recommended next actions

GATE PREPARATION (Days before each gate):
- Coordinate test results across teams
- Verify no regressions from previous phases
- Prepare gate review documentation
- Identify any last-minute issues

ESCALATION PATH:
1. Try to resolve within teams (24 hours)
2. Escalate to feature leads (if >1 team affected)
3. Escalate to project lead (if blocking gate)
```

---

## CUSTOMIZATION GUIDE

### When to Modify a Template

**DO customize if:**
- Your timeline shifts by 1-2 days (adjust specific dates in prompt)
- You have different resources (adjust team size in description)
- You've found a better approach (update specifics, keep structure)

**DON'T customize:**
- Core success criteria (tests, performance targets)
- Deliverables (files, features)
- Overall timeline (if major shift needed, contact project lead)

### Example Customization

**Before (Phase 2 Feature 1):**
```
Timeline: June 29 - July 3 (5 days)
Resources: 1 developer + 1 test engineer
```

**After (if shifted 2 days):**
```
Timeline: July 1 - July 5 (5 days, shifted 2 days)
Resources: 1 developer + 1 test engineer
(Update all dates in prompt similarly)
```

---

## RESOURCE CONSUMPTION GUIDANCE

### Agent Capacity Per Feature

| Phase | Feature | Team Size | Daily Effort | Total Effort |
|-------|---------|-----------|--------------|--------------|
| **Phase 2** | Feature 1 (2FA) | 2 agents | 16 hours | 80 hours |
| **Phase 2** | Feature 2 (Sessions) | 2 agents | 14 hours | 56 hours |
| **Phase 2** | Feature 3 (Evasion) | 2 agents | 16 hours | 80 hours |
| **Phase 2** | Feature 4 (Monitoring) | 2 agents | 14 hours | 56 hours |
| **Phase 2** | Integration | 1 agent | 8 hours | 56 hours |
| **v12.8.0** | Feature 1 (Multi-Browser) | 3 agents | 21 hours | 147 hours |
| **v12.8.0** | Feature 2 (AI Integration) | 3 agents | 19 hours | 133 hours |
| **v12.8.0** | Feature 3 (Browser Pool) | 3 agents | 19 hours | 133 hours |
| **v12.8.0** | Feature 4 (Forensics) | 2 agents | 14 hours | 84 hours |
| **v12.8.0** | Integration | 2 agents | 14 hours | 140 hours |

---

## WHEN TO SPAWN WHICH AGENT TYPE

| Agent Type | When to Use | Duration | Typical Tasks |
|------------|------------|----------|---------------|
| **feature-developer** | Feature lead implementation | 3-7 days | Core code, WebSocket commands, main features |
| **test-engineer** | Parallel with developer | 3-7 days | Unit tests, E2E tests, load tests |
| **architect** | Complex features (v12.8.0) | 7-10 days | Design, API definition, integration planning |
| **integration-lead** | Across all features | Full duration | Coordination, blocker resolution, cross-feature sync |
| **qa-lead** | Pre-gate validation | 2-3 days | Comprehensive testing, performance validation |

---

## AGENT SPAWNING BEST PRACTICES

1. **Spawn in waves, not all at once**
   - Wave 1 (Day 1): Feature leads (complex features first)
   - Wave 2 (Day 1): Test engineers (parallel with developers)
   - Wave 3 (Day 2-3): Integration lead

2. **Daily syncs are critical**
   - 15-minute quick standup (9 AM)
   - 30-minute integration sync (3 PM)
   - Async updates via Slack/email

3. **Escalate blockers early**
   - Document issue clearly
   - Suggest remediation
   - Don't wait >4 hours without escalating

4. **Monitor progress daily**
   - Check test results
   - Verify no regressions
   - Look for early warning signs

---

## TROUBLESHOOTING AGENT FAILURES

### If an agent stops responding:
1. Check last message timestamp
2. Review current task description
3. Contact agent lead for status
4. Plan remediation (may need to restart agent)

### If tests start failing en masse:
1. Identify which feature is causing failures
2. Check if this is expected (new tests, feature interactions)
3. Determine if blocking (gate decision) or non-blocking (polish)
4. Escalate if blocking gate

### If timeline slips:
1. Identify which activities are behind schedule
2. Assess impact on gates
3. Consider parallel acceleration
4. Escalate if gate will be missed

---

**Status:** ✅ READY FOR AGENT SPAWNING  
**Next Action:** Use appropriate template for your feature  
**Support:** Contact integration lead or project lead if unsure

---

*Document created by: Planning Agent*  
*Last updated: June 15, 2026*  
*Version: 1.0*

# Basset Hound Browser - Master Implementation Plan
**Date:** May 6, 2026  
**Status:** ACTIVE EXECUTION  
**Version:** 11.0.0 → 11.1.0

---

## Executive Summary

This plan covers all remaining work for Basset Hound Browser v11.1.0 release:

1. **Integration Testing** - Comprehensive WebSocket API validation
2. **MCP Server Refactoring** - Remove out-of-scope intelligence tools
3. **Agent-Based MCP Testing** - Systematic testing with AI agents at multiple capability levels
4. **Documentation & Findings** - Capture methodology, prompts, model performance
5. **Scope Updates** - Document MCP testing methodology in SCOPE.md
6. **Performance Recommendations** - Create integration guide for secondary projects

---

## Phase 1: Integration Testing (High Priority)

### 1.1 WebSocket API Comprehensive Testing
**Goal:** Validate all 164 commands work correctly in Docker deployment  
**Acceptance:** 100% command success rate with proper timing documentation

#### Tasks
- [ ] 1.1.1 Start Docker container with updated network configuration
- [ ] 1.1.2 Create test suite for all 164 WebSocket commands (batch into 10 tests)
- [ ] 1.1.3 Run tests against live deployment, capture results to `tests/results/`
- [ ] 1.1.4 Document timing requirements for page-dependent commands
- [ ] 1.1.5 Verify bot evasion (test against sannysoft.com, browserleaks.com, fingerprintjs.com)
- [ ] 1.1.6 Test Tor integration (.onion site access)
- [ ] 1.1.7 Test proxy rotation and user agent rotation
- [ ] 1.1.8 Document any failures with recovery steps

**Files to Create/Update:**
- `tests/results/websocket-api-validation-2026-05-06.json` (test results)
- `docs/findings/websocket-api-validation-2026-05-06.md` (findings)
- Update `docs/TODO.md` with status

---

### 1.2 Docker Network Validation
**Goal:** Verify Docker deployment works with basset-hound-browser network

#### Tasks
- [ ] 1.2.1 Verify docker-compose.yml network configuration
- [ ] 1.2.2 Test port 8765 exposure and WebSocket connectivity
- [ ] 1.2.3 Test inter-container communication (for future frontend/API)
- [ ] 1.2.4 Document deployment checklist

---

## Phase 2: MCP Server Refactoring (High Priority)

### 2.1 Remove Out-of-Scope Intelligence Tools
**Goal:** Reduce MCP tools from 166 to ~160 by removing intelligence analysis functions

#### Tools to Remove
1. `browser_detect_data_types` - Pattern detection (OUT OF SCOPE)
2. `browser_configure_ingestion` - Data processing decisions (OUT OF SCOPE)
3. `browser_ingest_selected` - Intelligence workflow (OUT OF SCOPE)
4. `browser_ingest_all` - Intelligence workflow (OUT OF SCOPE)
5. `browser_fill_form_with_entity` - External system integration (OUT OF SCOPE)
6. `browser_fill_form_with_sock_puppet` - External system integration (OUT OF SCOPE)

#### Tasks
- [ ] 2.1.1 Locate tool definitions in MCP server code
- [ ] 2.1.2 Remove each tool with proper cleanup
- [ ] 2.1.3 Verify remaining tools are all browser automation focused
- [ ] 2.1.4 Update MCP server documentation
- [ ] 2.1.5 Run tests to ensure no regressions
- [ ] 2.1.6 Document removed tools in archive

**Files to Update:**
- `mcp/server.py` - Remove out-of-scope tools
- `docs/findings/mcp-refactoring-2026-05-06.md` - Document removed tools

---

## Phase 3: Agent-Based MCP Testing (High Priority)

### 3.1 Test Harness Setup
**Goal:** Create framework for testing MCP with AI agents

#### Tasks
- [ ] 3.1.1 Create test scenarios (navigation, interaction, content extraction, evasion)
- [ ] 3.1.2 Document each test scenario with expected outcomes
- [ ] 3.1.3 Create test execution script that spawns agents
- [ ] 3.1.4 Set up results collection to `docs/archive/experimentation/`

**Test Scenarios (10 total):**
1. Simple navigation (visit 3 URLs)
2. Form interaction (fill and submit form)
3. Content extraction (get page HTML, text, links)
4. Screenshot capture (full page)
5. Cookie management (get, set, clear)
6. Multiple tabs (create, switch, close)
7. JavaScript execution (custom script)
8. Proxy configuration (set, test, rotate)
9. User agent rotation (set, get, rotate)
10. Tor integration (enable, disable, get status)

---

### 3.2 Multi-Model Testing
**Goal:** Test MCP effectiveness with different AI model capabilities

#### Task 3.2.1: Claude Opus 4.7 (Full Capability)
- [ ] 3.2.1.1 Spawn agent with Opus 4.7 to execute all 10 test scenarios
- [ ] 3.2.1.2 Capture prompt used to control browser
- [ ] 3.2.1.3 Record success rate, time taken, observations
- [ ] 3.2.1.4 Document any issues or unexpected behaviors

**Recording:**
```
docs/archive/experimentation/mcp-testing-opus-4-7-2026-05-06/
├── test-prompts.md (the exact prompts used)
├── test-results.json (success rates, timings)
├── findings.md (observations, recommendations)
└── screenshots/ (any captures for analysis)
```

#### Task 3.2.2: Claude Sonnet 4.6 (Balanced)
- [ ] 3.2.2.1 Spawn agent with Sonnet 4.6 to execute same 10 test scenarios
- [ ] 3.2.2.2 Capture identical metrics
- [ ] 3.2.2.3 Compare against Opus baseline

**Recording:**
```
docs/archive/experimentation/mcp-testing-sonnet-4-6-2026-05-06/
├── test-prompts.md
├── test-results.json
├── findings.md
├── comparison-vs-opus.md
└── screenshots/
```

#### Task 3.2.3: Claude Haiku 4.5 (Fast/Lightweight)
- [ ] 3.2.3.1 Spawn agent with Haiku 4.5 to execute same 10 test scenarios
- [ ] 3.2.3.2 Capture metrics with focus on speed/cost
- [ ] 3.2.3.3 Compare cost-effectiveness against full models

**Recording:**
```
docs/archive/experimentation/mcp-testing-haiku-4-5-2026-05-06/
├── test-prompts.md
├── test-results.json
├── findings.md
├── cost-analysis.md
├── comparison-vs-opus-vs-sonnet.md
└── screenshots/
```

---

### 3.3 Integration Scenario Testing
**Goal:** Test realistic integration patterns with secondary projects

#### Task 3.3.1: Sequential Task Execution
- [ ] 3.3.1.1 Test agent performing multi-step workflow (e.g., login → navigate → extract data)
- [ ] 3.3.1.2 Test error recovery (network timeout, element not found, etc.)
- [ ] 3.3.1.3 Document recovery mechanisms

#### Task 3.3.2: Concurrent Operations
- [ ] 3.3.2.1 Test multiple agents using MCP simultaneously
- [ ] 3.3.2.2 Test tab management under concurrent load
- [ ] 3.3.2.3 Document concurrency limits

#### Task 3.3.3: Long-Running Sessions
- [ ] 3.3.3.1 Test 1-hour continuous browser session
- [ ] 3.3.3.2 Monitor memory usage, performance degradation
- [ ] 3.3.3.3 Document stability findings

---

## Phase 4: Documentation & Findings

### 4.1 Experimentation Documentation
**Goal:** Create comprehensive record of MCP testing methodology and results

#### Task 4.1.1: Master Testing Report
- [ ] 4.1.1.1 Create `docs/archive/experimentation/MCP-TESTING-MASTER-REPORT-2026-05-06.md`
- [ ] 4.1.1.2 Include all test scenarios, prompts, results
- [ ] 4.1.1.3 Include model comparison table
- [ ] 4.1.1.4 Include recommendations for integrators

**Structure:**
```
MCP-TESTING-MASTER-REPORT-2026-05-06.md
├── Executive Summary
├── Test Methodology
├── Test Scenarios (10 scenarios, prompts, results)
├── Model Comparison
│   ├── Opus 4.7 (full capability)
│   ├── Sonnet 4.6 (balanced)
│   ├── Haiku 4.5 (fast/lightweight)
│   └── Comparison Table
├── Integration Scenarios
├── Findings & Recommendations
├── Appendix: All Prompts Used
└── Appendix: Raw Results Data
```

### 4.2 Performance Analysis
**Goal:** Create performance recommendation document for integrators

#### Task 4.2.1: Create Integration Performance Guide
- [ ] 4.2.1.1 Create `docs/integration-performance-recommendations.md`
- [ ] 4.2.1.2 Document best model choice for different use cases
- [ ] 4.2.1.3 Include cost-benefit analysis
- [ ] 4.2.1.4 Include prompt engineering best practices

**Structure:**
```
integration-performance-recommendations.md
├── Quick Reference (model choice by use case)
├── Opus 4.7: When to Use
├── Sonnet 4.6: When to Use
├── Haiku 4.5: When to Use
├── Cost Analysis
├── Prompt Engineering Tips
├── Error Handling Patterns
└── Optimization Strategies
```

---

## Phase 5: Scope Documentation Updates

### 5.1 Update SCOPE.md with MCP Testing Methodology
**Goal:** Document MCP testing as a key integration validation pattern

#### Task 5.1.1: Add MCP Testing Section
- [ ] 5.1.1.1 Add section "9. AI Agent Integration Testing"
- [ ] 5.1.1.2 Document systematic approach to MCP validation
- [ ] 5.1.1.3 Document multi-model testing strategy
- [ ] 5.1.1.4 Reference experimentation documentation

**New Section Content:**
```
## 9. AI Agent Integration Testing (IN SCOPE)

### MCP Testing Methodology
- Multi-model validation (Opus, Sonnet, Haiku)
- 10 core test scenarios for browser automation
- Integration scenario validation
- Performance profiling and recommendations
- Prompt engineering best practices documentation

### Testing Artifacts
All MCP testing is systematically documented in:
- docs/archive/experimentation/ - Experimental findings by model
- docs/archive/experimentation/MCP-TESTING-MASTER-REPORT-*.md - Master report
- docs/integration-performance-recommendations.md - Integrator guide

This ensures secondary projects can make informed decisions about:
- Which model to use for their integration
- Expected performance and cost tradeoffs
- Prompt engineering patterns that work well
- Error recovery strategies
```

---

## Phase 6: Release Readiness

### 6.1 Final Validation
**Goal:** Ensure all work is complete and documented

#### Tasks
- [ ] 6.1.1 All integration tests passing (100%)
- [ ] 6.1.2 MCP server refactored (6 tools removed)
- [ ] 6.1.3 All findings documented in `docs/archive/experimentation/`
- [ ] 6.1.4 SCOPE.md updated with MCP testing section
- [ ] 6.1.5 Integration performance guide completed
- [ ] 6.1.6 README.md updated if needed
- [ ] 6.1.7 No critical bugs blocking deployment
- [ ] 6.1.8 All tests passing

### 6.2 Commit & Documentation
**Goal:** Record completion for v11.1.0 release

#### Tasks
- [ ] 6.2.1 Commit all changes with appropriate messages
- [ ] 6.2.1 Create release notes for v11.1.0
- [ ] 6.2.2 Update version numbers (package.json, etc.)
- [ ] 6.2.3 Archive this plan with completion date

---

## Execution Strategy

### Timeline
- **Phase 1 (Integration Testing):** 2-3 hours
- **Phase 2 (MCP Refactoring):** 1-2 hours
- **Phase 3 (Agent Testing):** 4-6 hours (parallel agent spawning)
- **Phase 4 (Documentation):** 2-3 hours
- **Phase 5 (Scope Updates):** 1 hour
- **Phase 6 (Release):** 1 hour

**Total Estimated:** 11-16 hours (can be parallelized)

### Parallel Execution
- Phase 1 and 2 can run in parallel (different systems)
- Phase 3 agent tests can spawn up to 10 agents in parallel
- Phase 4 can begin during Phase 3 testing
- Phase 5 can start once Phase 3 findings are ready

### Success Criteria
1. ✅ 100% WebSocket API tests passing
2. ✅ 6 out-of-scope MCP tools removed
3. ✅ 30 agent tests completed (3 models × 10 scenarios)
4. ✅ Comprehensive experimentation documentation created
5. ✅ Integration performance guide published
6. ✅ SCOPE.md updated with MCP testing methodology
7. ✅ All findings archived
8. ✅ Ready for v11.1.0 release

---

## Deliverables Checklist

### Code
- [ ] MCP server refactored (6 tools removed)
- [ ] WebSocket API tests completed
- [ ] Integration test scripts created

### Documentation
- [ ] `docs/archive/experimentation/mcp-testing-opus-4-7-2026-05-06/` (folder with findings)
- [ ] `docs/archive/experimentation/mcp-testing-sonnet-4-6-2026-05-06/` (folder with findings)
- [ ] `docs/archive/experimentation/mcp-testing-haiku-4-5-2026-05-06/` (folder with findings)
- [ ] `docs/archive/experimentation/MCP-TESTING-MASTER-REPORT-2026-05-06.md`
- [ ] `docs/integration-performance-recommendations.md`
- [ ] Updated `docs/SCOPE.md` with MCP testing section
- [ ] Updated `docs/TODO.md` with completion status

### Testing
- [ ] WebSocket API test results in `tests/results/`
- [ ] Bot evasion validation results
- [ ] Docker deployment validation
- [ ] 30 agent-based MCP test results

---

## Next Steps

1. Execute Phase 1: Integration Testing (start immediately)
2. Execute Phase 2: MCP Refactoring (parallel with Phase 1)
3. Spawn agents for Phase 3 testing (up to 10 parallel)
4. Compile findings from Phase 3 (2-4 hours after Phase 3 starts)
5. Complete Phases 5-6 (final documentation)

---

**Status:** Ready for execution  
**Last Updated:** May 6, 2026 22:58 UTC  
**Executed By:** Claude (claude-haiku-4-5-20251001)

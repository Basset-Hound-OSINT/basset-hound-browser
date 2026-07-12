# Basset Hound Browser - TODO

**Last Updated:** July 4, 2026
**Status:** ✅ **MVP COMPLETE (2026-07-04)** — see the [2026-07-04 session record](archives/session_records/2026-07-04_MVP-COMPLETION-ORCHESTRATED.md) and the authoritative [PROJECT-STATUS-MATRIX](planning/PROJECT-STATUS-MATRIX.md). The June "v12.5–12.8 production" entries below are **historical/superseded** — those "production" claims were inflated.
**Open work (next tier):** [FEATURE-COMPLETION-ROADMAP.md](planning/FEATURE-COMPLETION-ROADMAP.md) — evasion/CAPTCHA (deferred research), Collaboration API (broken → fix + wire), live proxy routing (verify), `server.js` modularization.

### ✅ Done 2026-07-03 → 07-04 (detail in the session records)
- [x] Browser boots + drives headless; `npm run smoke:mvp` = 14/14 (was: did not boot at all)
- [x] 17-tool MCP server (`mcp/server.py`) built + verified
- [x] Fixed: response serializer, shell-vs-webview bug class, extract_*, get_cookies, HAR/WARC, session restore, ~7 require paths
- [x] Forensic + compression commands registered (SHA-256 / chain-of-custody live)
- [x] Security hardening: loopback bind, SSRF guard, PathValidator (CRITICAL + 4 HIGH closed)
- [x] Pruned 78 dead files (evasion simulators, orphans, mock tests); docs made honest (13 bannered)
- [x] Docs RAG deployed + working (localhost:10080); scope blacklist enforced (no agents/models)
- [x] **One-shot `forensic_capture` command** (navigate → 13-file evidence bundle + SHA-256 manifest; smoke:mvp **15/15**) + 19-line Python client `tmp/real_world_test/capture_client.py` — see 2026-07-04_CAPTURE-CMD-GUI-RAG-AND-FILE-SIZE.md
- [x] Local docs-RAG migrated to rag-bootstrap image-mode (single-KB) (localhost:10080)

### 🟡 In progress / ⏭️ next (2026-07-04 cont.)
- [x] **Opt-in GUI** `--gui`/`BASSET_GUI=1` (or `npm run start:gui`) — DONE + live-verified: toggle + BOTH layout fixes (webview fills space, tabs horizontal); headless stays 15/15, unit 16/16
- [x] **FILE-SIZE POLICE — no code file >1200 lines** — DONE: all 13 modularized (server.js 12,096→1,110 w/ 904 commands preserved; main.js 3,112→1,178; renderer 1,527→587; +proxy/extraction/config/fingerprint/image-metadata/interaction-recorder/network-forensics/page-monitor); smoke:mvp stayed 15/15
- [x] Doc-INDEX coverage; differentiators proven live (Tor/proxy anonymity, coherent-UA fix, forensic_capture=MCP tool #18, GUI+headless capture); final verify **smoke 15/15 + mcp exit 0**
- [ ] **NEXT — Phase 1: command-surface verification & repair** — inventory all 904 registered commands → auto-test → classify works/broken/stub/dead → fix → true "all tools working" map (only ~70 of 904 are PROVEN today). Then Phase 2 onboarding self-test, Phase 3 wire-capture/evasion-timing, Phase 4 palletai MCP integration.

**➡️ Full detail:** [2026-07-04 Modularization & Differentiators session record](archives/session_records/2026-07-04_MODULARIZATION-AND-DIFFERENTIATORS.md)

## Current Status Summary

| Item | Status | Details |
|------|--------|---------|
| **v12.5.0** | ✅ Production | Running at ws://localhost:8765, stable |
| **v12.7.0 Phase 1** | ✅ COMPLETE | 288+ tests (100%), 6,212 LOC, production-ready |
| **v12.7.0 Phase 2** | 📋 Planned | June 29-July 12, 85+ items, ready to start |
| **v12.8.0** | 📋 Planned | July 13-31, 4 features, 7,245+ LOC specs |
| **Deployment** | ✅ Automated | 5 production scripts, zero-downtime ready |

---

## COMPLETED (This Session, June 14-15, 2026) ✅

- [x] Root directory cleanup (25+ files → 10 essential)
- [x] v12.7.0 Phase 1 implementation (TOTP, Sessions, Evasion, Monitoring)
- [x] v12.7.0 Phase 1 integration (28 WebSocket commands)
- [x] v12.7.0 Phase 1 validation (288+ tests, 100% pass)
- [x] v12.7.0 Release preparation (documentation, API reference)
- [x] v12.7.0 Phase 2 comprehensive planning (85+ items)
- [x] v12.8.0 complete planning (4 features, 7,245+ LOC)
- [x] Deployment automation (5 scripts, 2,905 LOC)
- [x] Execution guides (8 comprehensive docs)
- [x] Documentation organization (proper archives, indexes)

---

## IN PROGRESS (Upcoming) 📋

### v12.7.0 Phase 2 (June 29 - July 12)
- Feature 1: TOTP/HOTP enhancements
- Feature 2: Session management improvements
- Feature 3: Advanced evasion vectors
- Feature 4: Monitoring metrics expansion
- Status: Ready for execution (See PHASE2-EXECUTION-GUIDE.md)
- See: /docs/findings/V12.7.0-PHASE2-MASTER-PLAN-2026-06-15.md

### v12.8.0 (July 13 - July 31)
- Feature 1: Multi-Browser Support
- Feature 2: Advanced AI Integration
- Feature 3: Distributed Browser Pool
- Feature 4: Advanced Forensic Analysis
- Status: Ready for execution (See V12.8.0-EXECUTION-GUIDE.md)
- See: /docs/findings/V12.8.0-*.md

## GATE DECISIONS

| Date | Gate | Criteria | Path |
|------|------|----------|------|
| July 5 | Phase 2 Mid-Point | Features 1-4 code-complete | Continue → Stage 4, or Hold |
| July 12 | Phase 2 Complete | All 4 features + 170+ tests | Release v12.7.0 or Hold |
| July 19 | v12.8.0 Gate 1 | Multi-Browser foundation | Continue → Features 2-4, or Hold |
| July 26 | v12.8.0 Gate 2 | All features code-complete | Continue → Stage 4, or Hold |
| July 31 | v12.8.0 Gate 3 | All features + 345+ tests | Release v12.8.0 or Hold |

See: /docs/releases/GATE-DECISIONS-MATRIX.md

## KEY REFERENCES

**Execution Guides:**
- PHASE2-EXECUTION-GUIDE.md - How to run Phase 2 June 29
- V12.8.0-EXECUTION-GUIDE.md - How to run v12.8.0 July 13
- QUICK-START-NEXT-SESSION.md - Orientation for next session

**Planning Documents:**
- /docs/findings/V12.7.0-*.md - Phase 1 complete, Phase 2 planned
- /docs/findings/V12.8.0-*.md - All 4 features fully specified

**Agent Support:**
- AGENT-SPAWNING-TEMPLATES.md - Ready-to-use prompts (copy-paste)

**Project Status:**
- PROJECT-STATUS-2026.md - Current dashboard
- docs/ROADMAP.md - Full roadmap

## ARCHITECTURAL DECISION (June 20, 2026)

**API-First Architecture Adopted**
- ✅ SDK development discontinued (Python, JavaScript, Go, Java, etc.)
- ✅ Focus shifted to auto-generated API documentation
- ✅ Multi-language example scripts replace maintained SDKs
- ✅ Docker deployment is standardized deployment method

See: `/docs/DEVELOPMENT-BLACKLIST.md` for details
See: `/docs/PROJECT-SCOPE.md` (updated Architecture section)
See: `/docs/FORENSIC-FEATURES-ROADMAP.md` (new document with architectural decisions)

**What Changed for Development:**
- No SDK maintenance work in Phase 2 or v12.8.0
- All development focuses on API quality and documentation
- Example scripts (not SDKs) added to demonstrate integration patterns
- OpenAPI/Swagger documentation is auto-generated

## WHAT'S NEXT

**Immediate (June 25-28):**
- Pre-flight checks for Phase 2 (See PHASE2-EXECUTION-CHECKLIST.md)
- Environment verification
- Final spec review
- **NEW:** Verify Phase 2 plan excludes SDK development (API-first only)

**June 29:**
- Spawn Phase 2 Feature 1-4 Development Agents
- Begin 4 parallel feature development
- Daily standups/monitoring

**July 5:**
- Gate 1 decision point
- Review mid-point progress
- Decide: continue → Stage 4 or hold

**July 12:**
- Gate 2 decision point
- Phase 2 completion decision
- Decide: release v12.7.0 or hold for Phase 3

**July 13:**
- Spawn v12.8.0 Feature 1-4 Development Agents
- Begin 4 parallel feature development

---

## SUCCESS CRITERIA:
✅ All Phase 2 execution guides created
✅ All v12.8.0 execution guides created
✅ Agent spawning templates ready
✅ Gate decision frameworks defined
✅ Project documentation up-to-date
✅ Next session has clear entry points

---

*See [ROADMAP.md](roadmap/ROADMAP.md) for full project history and architecture.*

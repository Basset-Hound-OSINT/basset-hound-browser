# RAG Doc-Quality Pass + Re-Ingest — 2026-07-04

**Agent:** doc-writer@basset-hound-browser:rag-quality-reingest
**Instance:** basset-hound-docs-rag (localhost:10021) — OUR instance only; palletai's stack (10020) untouched.
**Goal:** make the docs RAG return the TRUE current state (per `docs/planning/PROJECT-STATUS-MATRIX.md`, 2026-07-04) instead of stale/inflated legacy claims.

---

## 1. Truth-in-labeling: correction banners added (19 docs)

Prepended a one-line correction banner (idempotent; skipped any doc already carrying `HISTORICAL / SUPERSEDED` or `OUTDATED`). Content was NOT rewritten — labeling only. Banner text:

> ⚠️ **HISTORICAL / SUPERSEDED** — authoritative status: **docs/planning/PROJECT-STATUS-MATRIX.md** (2026-07-04). Claims below (version labels, "production ready", "100%"/test-pass counts, command counts, evasion %) are inflated or stale — verify against the matrix and the 2026-07-04 session records before relying on them.

Bannered (all were un-bannered and confirmed carrying inflated "production ready / 100% / v12.x complete / GA-ready / 164-192 command" claims):

| # | Doc | Worst stale claim |
|---|-----|-------------------|
| 1 | `docs/PROJECT-STATUS-2026.md` | "v12.7.0 Complete & Production Ready, 288/288 100%, 192 commands" |
| 2 | `docs/DEVELOPMENT-STATUS.md` | "v8.1.4 (Dec 2024), feature-complete/production-ready, 100% Complete, OSINT platform" |
| 3 | `docs/technical/DEVELOPMENT-STATUS.md` | duplicate of #2 |
| 4 | `docs/PROJECT-COMPLETION-PATH.md` | "60% ready, target July 1" |
| 5 | `docs/EXTERNAL-GA-READINESS-REPORT.md` | "✅ PRODUCTION-READY FOR EXTERNAL GA RELEASE" |
| 6 | `docs/V12.1.0-PRODUCTION-READINESS-PACKAGE-2026-05-31.md` | "READY FOR PRODUCTION DEPLOYMENT, 90%+ confidence" |
| 7 | `docs/V12.7.0-INTEGRATION-COMPLETE.md` | "✅ COMPLETE, VERY HIGH (95%+)" |
| 8 | `docs/IMPLEMENTATION-COMPLETE.md` | "v12.10.0, READY FOR DEPLOYMENT" |
| 9 | `docs/ADVANCED-FEATURES-COMPLETION.md` | "ML-based features COMPLETE" (also a SCOPE violation — no AI/ML in browser) |
| 10 | `docs/DEMO-COMPLETION-REPORT.md` | "✅ COMPLETE, based on v12.0.0 production validation" |
| 11 | `docs/STRATEGIC-VISION-BASSET-HOUND.md` | forward-looking vision presented as roadmap fact |
| 12 | `docs/QUICK-START-GUIDE.md` | "v12.8.0, Status: Production Ready" |
| 13 | `docs/GETTING-STARTED.md` | "v12.8.0" |
| 14 | `docs/EXTERNAL-DEVELOPERS-START-HERE.md` | "Coverage: 164 WebSocket commands" |
| 15 | `docs/VALIDATION-IMPLEMENTATION-COMPLETE.md` | "✅ COMPLETE, 4,600+ lines production code" |
| 16 | `docs/PRE-DEPLOYMENT-VALIDATION.md` | "✅ Complete, 210+ operations" |
| 17 | `docs/DEPLOYMENT-CHECKLIST.md` | "v12.8.0, production readiness" |
| 18 | `docs/FEATURE-GAP-ANALYSIS-2026-05-31.md` | "Complete - Ready for Feature Prioritization" |
| 19 | `docs/architecture/core/FORENSIC-QUICK-START.md` | special banner — points to the CURRENT one-shot `forensic_capture` command + `handoffs/MCP-FORENSIC-CAPTURE-TOOL-2026-07-04.md` |

No docs were moved to `docs/archives/` — note that `archives/` is **still ingested** by the RAG (exclude list is only `.git/ node_modules/ data/ *.pdf`), so moving would NOT remove a doc from retrieval. The in-place banner is what actually reaches the RAG. Bannering-in-place was therefore the correct lever.

Many high-visibility docs were **already** bannered by prior agents (README.md, TODO.md, roadmap/ROADMAP.md, INDEX.md, API-REFERENCE-AUTHORITATIVE.md, releases/RELEASE-NOTES-v12.5.0.md, features/PROXY-INTELLIGENCE.md, etc.) — left as-is.

---

## 2. Authoritative-doc consistency check — ONE contradiction found

`docs/planning/PROJECT-STATUS-MATRIX.md` and the three `archives/session_records/2026-07-04_*` records are internally consistent on the core facts (boots+drives headless, smoke:mvp, 17-tool MCP, security hardening, evasion deferred, 78-file prune).

**Contradiction to fix (I could NOT edit — `docs/planning/` is another agent's live work zone):**

- The matrix (written **2026-07-04 03:10**) says under *Cross-cutting truths*: **"Monolith reality (still true). `websocket/server.js` ≈ 12,090 lines, `src/main/main.js` ≈ 3,059 lines. 'Modularized' refactor claims remain aspirational."**
- This is now **STALE**. The modularization landed **later the same day (~17:42)**: `findings/MODULARIZE-server-js-2026-07-04.md` + `findings/MODULARIZE-main-js-2026-07-04.md` and `archives/session_records/2026-07-04_MODULARIZATION-AND-DIFFERENTIATORS.md` (17:52) document it, and I verified on disk: **`websocket/server.js` = 1,110 lines, `src/main/main.js` = 1,178 lines** (904 commands preserved). `TODO.md` (this session's) already reflects the modularized numbers.
- **Recommendation for the planning agent:** update the matrix's "Monolith reality (still true)" bullet (and any other ~12,090/~3,059-line references) to reflect the post-modularization state, or the matrix will itself feed the RAG a stale claim.

Everything else in the matrix/session records checked out.

---

## 3. RAG re-ingest — plus a real quality bug found & fixed

Ran `./deploy.sh ingest` on the `basset-hound-docs-rag` instance (localhost:10021) only.

**Bug discovered:** the ingest is **additive, not upsert-with-prune** — re-ingesting a changed file creates a NEW document row and leaves the OLD chunks in the index. After the delta ingest, **35 filepaths had duplicate rows (39 stale copies)** — every doc edited today (my 19 banners + earlier TODO/ROADMAP/INDEX/README edits) existed as both a stale pre-edit copy AND the current copy, and the stale copies still poisoned retrieval (I observed the LLM pulling the un-bannered chunk#0 alongside the bannered one).

**Fix:** deleted the 39 older duplicate rows via `DELETE /api/documents/{id}` (kept the newest = bannered version per filepath). Verified 0 duplicate filepaths remain. This only removed superseded index rows on our instance — no source files, no other stacks touched.

**Final index state (`/api/status`):**
- documents: **2111** (was 2054 pre-session; 0 duplicates)
- chunks: **18230**
- embedding_model: `nomic-embed-text`, dim 768
- indexed_at: **2026-07-04T22:12 UTC** (fresh; includes today's ~40 new findings/session-records/handoffs and all 19 banners)

---

## 4. Verification queries (post-ingest, post-dedup)

**Q2 — "How do I run a forensic capture with the browser?" → ✅ CURRENT TRUTH.**
Answer returned the correct 2026-07-04 one-shot command:
`forensic_capture <url> <operator>` → navigate + capture all layers + export forensic package (with the Python client example).
Sources: `FORENSIC-QUICK-START.md` (now bannered → points to current command), `FORENSIC-CAPTURE-COMMAND-2026-07-04.md`, `FORENSIC-CAPTURE-DESIGN-SPECIFICATION.md`.

**Q3 — "Is the Basset Hound Browser just a Chrome clone?" → ✅ CURRENT TRUTH.**
Answer: *"No — but only because of the layers on top. The engine is not the differentiator … Selenium, Puppeteer, ChromeDriver, Playwright, and Basset Hound all drive the same Chromium/Blink/V8 engine … embedded via Electron with additional layers."*
Sources: `planning/DIFFERENTIATION-VS-SELENIUM-2026-07-04.md`, `architecture/.../SCOPE.md` — the correct current framing (a control/capture tool over Chromium, not a clone).

**Q1 — "What is the current project status?" → ⚠️ PARTIAL — still degraded, honest finding.**
The synthesized answer still returns a stale line ("Active Development - Phase 10" from `DEVELOPMENT-STATUS.md`, or "60% ready" from `PROJECT-COMPLETION-PATH.md`). Root cause is **not** the banners (they are present in chunk#0 and appear in the retrieved sources) — it is two structural issues that a 19-doc banner pass cannot fix:
1. **A deep un-curated stale-status tail.** Dozens of legacy status/release/roadmap docs (`EXECUTIVE_SUMMARY.md`, `RELEASE-NOTES-v12.1.0.md`, `V12.2-ROADMAP-*`, `DEVELOPMENT-SUMMARY-V10.0.0-*`, `FINAL-RELEASE-NOTES-*`, …) all score ~0.011 (near-flat) for this query, so ranking is nearly arbitrary and there is always another stale doc behind the one you banner. I confirmed this by test-deindexing the top-2 offenders — the answer simply fell through to the next stale doc (whack-a-mole), so I restored them (index == disk).
2. **The authoritative matrix does not rank for the NL phrase "current status."** Its chunks are dense tables/headers, which embed poorly against a conversational status question, so it never enters the top-8.
3. **LLM behavior:** even when the bannered chunk is retrieved, the model tends to extract a confident `Status:` field verbatim and under-weight the adjacent ⚠️ banner.

**Recommendation (out of this task's 10–20-doc scope, needs a follow-up):** to make the *status* query "excellent," curate the corpus — exclude the pure stale status/release/roadmap snapshots from ingestion (RAG `exclude` list + a one-time reindex, since the additive ingest won't prune them on its own), and/or add a short prose "CURRENT STATUS (2026-07-04): …" lead paragraph to the matrix so it embeds close to natural status questions. Also worth fixing at the platform level: the additive-ingest duplicate-row behavior (an upsert-with-prune on re-ingest) so stale chunks don't accumulate every edit.

---

## Summary
- 19 high-visibility stale docs bannered (truth-in-labeling, no content rewrite); many others already bannered.
- 1 authoritative-doc contradiction flagged for the planning agent: matrix's "monolith (still true) / ~12,090-line" claim is stale — code was modularized to 1,110/1,178 lines today.
- RAG re-ingested (our instance only); found & fixed a 39-row stale-duplicate accumulation bug; final index = 2111 docs / 18230 chunks, 0 duplicates, fresh @ 22:12 UTC.
- 2 of 3 verification queries (forensic capture, chrome-clone) now return current 2026-07-04 truth. The "current project status" query is improved but still degraded by a deep un-curated stale-status tail + a matrix that doesn't rank for the NL phrasing — flagged with a concrete curation recommendation.
- No git commits. No infra/other-stack changes.

# rag-bootstrap/docs/ Cleanup & Reorg — Findings

Scope: `/home/devel/exudeai/rag-bootstrap/docs/` only. READ-ONLY phase — no moves executed.

## 1. Inventory

### Top-level LOOSE files (25 docs) — need homes
API_V3_CHAT_STREAMING.md, ARCHITECTURE.md, COMPLETE_PROJECT_STATUS.md,
EMBEDDINGS_RESEARCH_INTEGRATION.md, ENHANCEMENT_RELEASE_2026_05_11.md,
INFRASTRUCTURE_DIAGNOSTICS.md, integration-guide.md, INTEGRATION_TESTING_GUIDE.md,
Integration_Testing_Results_2026_05_06.md, MASTER_EXECUTION_PLAN_2026_05_06.md,
MODULARITY_DESIGN.md, PHASE1_IMPLEMENTATION_SUMMARY.md, PHASE2_IMPLEMENTATION_SUMMARY.md,
PHASE3_IMPLEMENTATION_SUMMARY.md, PHASE4_IMPLEMENTATION_SUMMARY.md,
PHASE_5_1_EXECUTION_REPORT.md, PHASE_A_DELIVERABLES_2026_05_06.md,
PRODUCTION_DEPLOYMENT_RUNBOOK.md, PRODUCTION_READINESS_CHECKLIST.md,
RAG_INTEGRATION_NOTES.md, RAG_INTEGRATION_TESTING_GUIDE.md, RAG_PRODUCTION_API.md,
RESEARCHHUB_INTEGRATION_GUIDE.md, SESSION_SUMMARY_2026_05_06.md

### Top-level KEEP (lean nav — do NOT move)
INDEX.md (regenerate), scope.md, roadmap.md, todo.md

### Existing subfolders (leave in place)
- archive/ — AGENT5_DELIVERABLES_INDEX.md, session-2026-01-30.md
- benchmarking/ — BENCHMARK_10K_README.md, BENCHMARK_EXECUTION_PLAN.md, BENCHMARK_IMPLEMENTATION_SUMMARY.md, streaming_client_example.py, watcher_example.py
- deployment/ — DEPLOYMENT_CHECKLIST.md
- features/ — ingestion-tooling.md
- findings/ — 12 files (atc-document-categories, caching_optimization_guide, data-directory-pattern, embedding-model-selection-2026, embedding-performance, faa-document-sources, known-issues, performance_analysis_report, rag_bootstrap_phase5_summary, rag-quality-improvements, rag-streaming-implementation-2026-05-06, RAG_VALIDATION_REPORT_2026_05_07)

## 2. Proposed taxonomy (git-mv-style move map — DO NOT execute this phase)

Create two new subfolders: `docs/integration/` and `docs/reference/`; plus `docs/archive/session_records/`.

### -> docs/archive/session_records/  (point-in-time / dated / superseded)
```
git mv docs/PHASE1_IMPLEMENTATION_SUMMARY.md        docs/archive/session_records/
git mv docs/PHASE2_IMPLEMENTATION_SUMMARY.md        docs/archive/session_records/
git mv docs/PHASE3_IMPLEMENTATION_SUMMARY.md        docs/archive/session_records/
git mv docs/PHASE4_IMPLEMENTATION_SUMMARY.md        docs/archive/session_records/
git mv docs/PHASE_5_1_EXECUTION_REPORT.md           docs/archive/session_records/
git mv docs/PHASE_A_DELIVERABLES_2026_05_06.md      docs/archive/session_records/
git mv docs/SESSION_SUMMARY_2026_05_06.md           docs/archive/session_records/
git mv docs/Integration_Testing_Results_2026_05_06.md docs/archive/session_records/
git mv docs/MASTER_EXECUTION_PLAN_2026_05_06.md     docs/archive/session_records/
git mv docs/ENHANCEMENT_RELEASE_2026_05_11.md       docs/archive/session_records/
git mv docs/COMPLETE_PROJECT_STATUS.md              docs/archive/session_records/   # status snapshot, superseded by scope/roadmap
git mv docs/INTEGRATION_TESTING_GUIDE.md            docs/archive/session_records/   # Phase-5 05-06, SUPERSEDED by RAG_INTEGRATION_TESTING_GUIDE (05-31)
```

### -> docs/integration/  (durable integration + API reference)
```
git mv docs/RAG_PRODUCTION_API.md            docs/integration/
git mv docs/API_V3_CHAT_STREAMING.md         docs/integration/
git mv docs/integration-guide.md             docs/integration/
git mv docs/RAG_INTEGRATION_NOTES.md         docs/integration/
git mv docs/RAG_INTEGRATION_TESTING_GUIDE.md docs/integration/
git mv docs/RESEARCHHUB_INTEGRATION_GUIDE.md docs/integration/
git mv docs/EMBEDDINGS_RESEARCH_INTEGRATION.md docs/integration/
```

### -> docs/reference/  (durable architecture / design)
```
git mv docs/ARCHITECTURE.md      docs/reference/
git mv docs/MODULARITY_DESIGN.md docs/reference/
```

### -> docs/deployment/  (durable ops — folder already exists)
```
git mv docs/INFRASTRUCTURE_DIAGNOSTICS.md      docs/deployment/
git mv docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md   docs/deployment/
git mv docs/PRODUCTION_READINESS_CHECKLIST.md  docs/deployment/
```

## 3. Duplicates / stale / superseded
- **INTEGRATION_TESTING_GUIDE.md** (2026-05-06, "Phase 5, Ready for implementation") is SUPERSEDED by **RAG_INTEGRATION_TESTING_GUIDE.md** (2026-05-31, "Production Ready"). Archive the older; keep the newer in integration/.
- **COMPLETE_PROJECT_STATUS.md** — dated status snapshot; role now owned by scope.md/roadmap.md. Archive (do not delete — has historical cross-links).
- **INDEX.md** — STALE. Dated 2026-05-11; its body is a generic template (references non-existent DIRECTORY_STRUCTURE.md, README.md, and lists no actual docs/ files). MUST be regenerated to reflect the new folder layout.
- No true byte-duplicates found; overlaps are topical (three integration-testing docs, several phase/status snapshots) resolved by the archive moves above.
- Recommend NO deletions this pass — archive instead (docs are cross-linked; deletion would orphan references).

## 4. Cross-link impact (flag before moving)

Distinguished real markdown `](path)` links from plain-text filename mentions. Only TWO real links break on move; the rest are plain-text mentions (cosmetic, optional to update):

REAL link breaks (MUST fix when moving):
- `README.md:296` — `[Integration Guide](docs/integration-guide.md)` -> update to `docs/integration/integration-guide.md`.
- `docs/ARCHITECTURE.md:628` — `[Streaming Endpoints](./API_V3_CHAT_STREAMING.md)` -> ARCHITECTURE goes to reference/, API_V3 goes to integration/, so update to `../integration/API_V3_CHAT_STREAMING.md`.

Real link that STAYS valid (co-located move, no fix needed):
- `docs/ARCHITECTURE.md:622` — `[Design Document](./MODULARITY_DESIGN.md)` — both move to reference/, so `./MODULARITY_DESIGN.md` still resolves.

Plain-text mentions (NOT clickable links — no path break; update only for tidiness):
- docs/todo.md:42 backtick mention of `RAG_PRODUCTION_API.md`; roadmap.md:119 "Full documentation in ARCHITECTURE.md"; and filename mentions inside the phase/status/integration docs (COMPLETE_PROJECT_STATUS, SESSION_SUMMARY, PHASE*, RAG_INTEGRATION_*, PRODUCTION_*, archive/AGENT5_DELIVERABLES_INDEX, findings/rag_bootstrap_phase5_summary). Because the co-moving archive docs keep their relative positions to each other, most intra-archive mentions remain accurate as prose.

Same-folder links UNAFFECTED (no move): findings/data-directory-pattern.md:180, findings/known-issues.md (26/102/126/132), archive/session-2026-01-30.md (../findings/*). benchmarking/BENCHMARK_10K_README.md links (./README.md, ./docs/*) are pre-existing placeholders, unaffected.

## 5. Lean nav confirmation
scope.md, roadmap.md, todo.md contain no outbound markdown links into the loose docs (only a backtick mention in todo.md:42 and prose in roadmap.md:119) — they stay as lean top-level nav untouched. INDEX.md is the one nav file that must be regenerated post-move.

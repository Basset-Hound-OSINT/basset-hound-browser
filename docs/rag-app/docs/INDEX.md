# RAG Bootstrap — Documentation Index

**Last Updated**: 2026-07-03
**Layout**: durable docs grouped by concern; point-in-time records under `archive/`.

Top-level nav (this folder): [scope.md](scope.md) · [roadmap.md](roadmap.md) · [todo.md](todo.md)

## Operator guides (top-level)

| Doc | Description |
|-----|-------------|
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Ollama connectivity, port collisions, dimension-mismatch guard/reset, ghost containers, network isolation, multi-stack runbook |
| [PERFORMANCE.md](PERFORMANCE.md) | Embedding concurrency/retry knobs, chunking parameters, ingest throughput, monitoring stack pointers |

---

## integration/ — API reference & integration guides (durable)

| Doc | Description |
|-----|-------------|
| [CONSUMING_AGENTS_CONTRACT.md](integration/CONSUMING_AGENTS_CONTRACT.md) | One-page contract for agent/consumer workflows — endpoint discovery, query/response schema, health, fallback policy, citations (moved from project root 2026-07-03) |
| [RAG_PRODUCTION_API.md](integration/RAG_PRODUCTION_API.md) | Production API reference (v1.0.0) — all REST endpoints, streaming, watcher, WebSocket appendix |
| [API_V3_CHAT_STREAMING.md](integration/API_V3_CHAT_STREAMING.md) | v3 chat & streaming API (session-based chat, SSE endpoints) |
| [integration-guide.md](integration/integration-guide.md) | How to copy rag-bootstrap into another project as a self-contained RAG layer |
| [RAG_INTEGRATION_NOTES.md](integration/RAG_INTEGRATION_NOTES.md) | Phase 4 model integration notes — production planning for the distilled model |
| [RAG_INTEGRATION_TESTING_GUIDE.md](integration/RAG_INTEGRATION_TESTING_GUIDE.md) | Primary integration testing guide (30+ tests, accuracy benchmark, CI recipe) |
| [RESEARCHHUB_INTEGRATION_GUIDE.md](integration/RESEARCHHUB_INTEGRATION_GUIDE.md) | Consuming the RAG API from ResearchHub (HTTP contract, env-driven base URL) |
| [EMBEDDINGS_RESEARCH_INTEGRATION.md](integration/EMBEDDINGS_RESEARCH_INTEGRATION.md) | Wave 1-2 embeddings research folded into the embedding pipeline |

## reference/ — architecture & design (durable)

| Doc | Description |
|-----|-------------|
| [ARCHITECTURE.md](reference/ARCHITECTURE.md) | System architecture guide — components, data flow, KB abstraction, watcher |
| [MODULARITY_DESIGN.md](reference/MODULARITY_DESIGN.md) | Modularity design — pluggable KB backends and router layer |
| [MODEL_SELECTION.md](reference/MODEL_SELECTION.md) | Choosing Ollama models — shared 6GB-GPU constraint, canonical picks (nomic-embed-text + llama3.2:3b), decision criteria, upgrade path, how to switch |

## deployment/ — ops runbooks & checklists (durable)

| Doc | Description |
|-----|-------------|
| [UPGRADE_2026-07-03.md](deployment/UPGRADE_2026-07-03.md) | **Migration guide for pre-2026-07-03 copies** — port 8100→10000, Ollama-only embeddings (768-dim re-ingest), async ingest contract, new endpoints/knobs, moved files, step-by-step procedure + rollback |
| [PRODUCTION_DEPLOYMENT_RUNBOOK.md](deployment/PRODUCTION_DEPLOYMENT_RUNBOOK.md) | Step-by-step production deployment runbook |
| [PRODUCTION_READINESS_CHECKLIST.md](deployment/PRODUCTION_READINESS_CHECKLIST.md) | Production readiness assessment with known limitations |
| [DEPLOYMENT_CHECKLIST.md](deployment/DEPLOYMENT_CHECKLIST.md) | Fill-in deployment checklist template for each deploy |
| [INFRASTRUCTURE_DIAGNOSTICS.md](deployment/INFRASTRUCTURE_DIAGNOSTICS.md) | Phase 5.1 infrastructure diagnostics — root causes and remediation procedures |

## features/ — feature-specific guides

| Doc | Description |
|-----|-------------|
| [ingestion-tooling.md](features/ingestion-tooling.md) | Ingestion & monitoring scripts (config.yaml-driven) |

## benchmarking/ — performance benchmarks

| Doc | Description |
|-----|-------------|
| [BENCHMARK_10K_README.md](benchmarking/BENCHMARK_10K_README.md) | 10K-chunk pipeline benchmark — what it measures and how to run it |
| [BENCHMARK_EXECUTION_PLAN.md](benchmarking/BENCHMARK_EXECUTION_PLAN.md) | Execution plan for the 10K benchmark run |
| [BENCHMARK_IMPLEMENTATION_SUMMARY.md](benchmarking/BENCHMARK_IMPLEMENTATION_SUMMARY.md) | Implementation summary of the benchmark harness |
| [streaming_client_example.py](benchmarking/streaming_client_example.py) | Example SSE streaming client |
| [watcher_example.py](benchmarking/watcher_example.py) | Example auto-ingest watcher client |

## findings/ — research & analysis (durable)

| Doc | Description |
|-----|-------------|
| [embedding-model-selection-2026.md](findings/embedding-model-selection-2026.md) | Decision record: switch to Ollama nomic-embed-text v1.5 |
| [embedding-performance.md](findings/embedding-performance.md) | Embedding performance & ingestion optimization analysis |
| [caching_optimization_guide.md](findings/caching_optimization_guide.md) | Redis caching optimization guide |
| [data-directory-pattern.md](findings/data-directory-pattern.md) | Data-directory pattern adopted from ResearchHub/BluePlan |
| [rag-quality-improvements.md](findings/rag-quality-improvements.md) | Search-quality investigation and fixes for FAA docs |
| [performance_analysis_report.md](findings/performance_analysis_report.md) | Performance analysis report (Phase 5) |
| [rag_bootstrap_phase5_summary.md](findings/rag_bootstrap_phase5_summary.md) | Phase 5 production-readiness validation summary |
| [rag-streaming-implementation-2026-05-06.md](findings/rag-streaming-implementation-2026-05-06.md) | Streaming + auto-ingest watcher implementation notes (Phase A) |
| [RAG_VALIDATION_REPORT_2026_05_07.md](findings/RAG_VALIDATION_REPORT_2026_05_07.md) | Phase B validation of streaming & auto-ingest features |
| [atc-document-categories.md](findings/atc-document-categories.md) | ATC document category research (manuals/ folder structure) |
| [faa-document-sources.md](findings/faa-document-sources.md) | FAA document download sources |
| [known-issues.md](findings/known-issues.md) | Known issues log |
| [2026-07-03_rag_bootstrap_execution_plan.md](findings/2026-07-03_rag_bootstrap_execution_plan.md) | Unified execution plan for the 2026-07-03 stabilization sweep (Ollama embeddings, port scheme, path portability, suggestions triage, docs cleanup) |
| [2026-07-03_multikb_query_semantics_verdict.md](findings/2026-07-03_multikb_query_semantics_verdict.md) | Verdict: multi-KB query surface is unmounted dead code — docker-compose.multi-kb.yml is scaffolding, not a working router |
| [2026-07-03_multikb_design_groundwork.md](findings/2026-07-03_multikb_design_groundwork.md) | Multi-KB Option B gateway blueprint (design only, deferred) — per-KB engines, kb selection, cross-KB merge, zone assignments for a future fleet |

### findings/audits/ — audit reports (2026-07-03 sweep)

| Doc | Description |
|-----|-------------|
| [2026-07-03_ollama_embeddings_audit.md](findings/audits/2026-07-03_ollama_embeddings_audit.md) | Verify Ollama embedding model is used (not sentence-transformers) |
| [2026-07-03_port_base_10000_audit.md](findings/audits/2026-07-03_port_base_10000_audit.md) | Port configuration audit — BASE-at-10000 scheme for downstream apps |
| [2026-07-03_path_references_audit.md](findings/audits/2026-07-03_path_references_audit.md) | Path-reference integrity after root→docs/ and root→tests/ moves |
| [2026-07-03_root_suggestions_triage_audit.md](findings/audits/2026-07-03_root_suggestions_triage_audit.md) | Triage of the four root-level SUGGESTIONS/ISSUES files against current code |
| [2026-07-03_docs_cleanup_audit.md](findings/audits/2026-07-03_docs_cleanup_audit.md) | Docs inventory, taxonomy, and move plan that produced this layout |
| [2026-07-03_devfleet_app_verify.md](findings/audits/2026-07-03_devfleet_app_verify.md) | App-layer verification of the dev-fleet edits (WS-APPCONFIG/DB/EMBED/INGEST/API/CONSUMER) |
| [2026-07-03_devfleet_config_verify.md](findings/audits/2026-07-03_devfleet_config_verify.md) | Config/compose/deploy/scripts-layer verification (WS-ENV/COMPOSE/CONFIGYAML/DEPLOY/SCRIPTS) |
| [2026-07-03_fixbatch_reverify.md](findings/audits/2026-07-03_fixbatch_reverify.md) | Adversarial re-verification of the fix batch — ALL PASS, 0 new defects |
| [2026-07-03_security_audit_pass.md](findings/audits/2026-07-03_security_audit_pass.md) | Security audit of the pass — HIGH=0 / MED=0 / 6 LOW (dispositions in handoffs/2026-07-03_sec_lows_report.md) |
| [2026-07-03_live_smoke_report.md](findings/audits/2026-07-03_live_smoke_report.md) | Live deployment smoke GATE — doctor 8/8, ingest + idempotent re-ingest, search, single-port, teardown: PASS |

## archive/ — superseded & historical

| Doc | Description |
|-----|-------------|
| [INTEGRATION_TESTING_GUIDE.md](archive/INTEGRATION_TESTING_GUIDE.md) | Phase 5 multi-KB testing guide — superseded by integration/RAG_INTEGRATION_TESTING_GUIDE.md; retains unique multi-KB setup content |
| [AGENT5_DELIVERABLES_INDEX.md](archive/AGENT5_DELIVERABLES_INDEX.md) | Agent 5 production-readiness deliverables index (2026-05-06) |
| [session-2026-01-30.md](archive/session-2026-01-30.md) | Session summary 2026-01-30 |

### archive/session_records/ — point-in-time session records

| Doc | Description |
|-----|-------------|
| [PHASE1_IMPLEMENTATION_SUMMARY.md](archive/session_records/PHASE1_IMPLEMENTATION_SUMMARY.md) | Phase 1: knowledge-base abstraction (2026-05-06) |
| [PHASE2_IMPLEMENTATION_SUMMARY.md](archive/session_records/PHASE2_IMPLEMENTATION_SUMMARY.md) | Phase 2: router layer & multi-KB orchestration (2026-05-06) |
| [PHASE3_IMPLEMENTATION_SUMMARY.md](archive/session_records/PHASE3_IMPLEMENTATION_SUMMARY.md) | Phase 3: chat mode & configuration management (2026-05-06) |
| [PHASE4_IMPLEMENTATION_SUMMARY.md](archive/session_records/PHASE4_IMPLEMENTATION_SUMMARY.md) | Phase 4: Docker deployment & WebSocket streaming API (2026-05-06) |
| [PHASE_5_1_EXECUTION_REPORT.md](archive/session_records/PHASE_5_1_EXECUTION_REPORT.md) | Phase 5.1: integration testing — infrastructure assessment (2026-05-06) |
| [PHASE_A_DELIVERABLES_2026_05_06.md](archive/session_records/PHASE_A_DELIVERABLES_2026_05_06.md) | Phase A: streaming & auto-ingest deliverables (2026-05-06) |
| [Integration_Testing_Results_2026_05_06.md](archive/session_records/Integration_Testing_Results_2026_05_06.md) | Phase 5.1 integration testing results (2026-05-06) |
| [SESSION_SUMMARY_2026_05_06.md](archive/session_records/SESSION_SUMMARY_2026_05_06.md) | Comprehensive modernization session summary (2026-05-06) |
| [MASTER_EXECUTION_PLAN_2026_05_06.md](archive/session_records/MASTER_EXECUTION_PLAN_2026_05_06.md) | Multi-project master execution plan snapshot (2026-05-06) |
| [ENHANCEMENT_RELEASE_2026_05_11.md](archive/session_records/ENHANCEMENT_RELEASE_2026_05_11.md) | Enhancement release notes: streaming + auto-ingest watcher (2026-05-11) |
| [COMPLETE_PROJECT_STATUS.md](archive/session_records/COMPLETE_PROJECT_STATUS.md) | Project status snapshot (2026-05-06) — role now owned by scope.md/roadmap.md |
| [RAG_BOOTSTRAP_ISSUES_AND_SUGGESTIONS.md](archive/session_records/RAG_BOOTSTRAP_ISSUES_AND_SUGGESTIONS.md) | Large-corpus (2k+ file) field-test feedback — dispositioned 2026-07-03 (see header) |
| [SUGGESTIONS.md](archive/session_records/SUGGESTIONS.md) | Multi-instance + no-root-Ollama stand-up feedback — dispositioned 2026-07-03 (see header) |
| [SUGGESTIONS_FROM_DOCS_RAG_DEPLOYMENT_2026-07-03.md](archive/session_records/SUGGESTIONS_FROM_DOCS_RAG_DEPLOYMENT_2026-07-03.md) | Second-instance deployment feedback (config/ingest bugs) — dispositioned 2026-07-03 (see header) |
| [SUGGESTIONS_FROM_RESEARCHHUB_2026-06-23.md](archive/session_records/SUGGESTIONS_FROM_RESEARCHHUB_2026-06-23.md) | Consumer-side (query-time) feedback from ResearchHub agents — dispositioned 2026-07-03 (see header) |

## handoffs/ — agent handoff reports (transient)

Working reports from orchestrated agent sessions; not part of the durable doc set.

---

**Conventions**: durable docs live in a concern folder (`integration/`, `reference/`, `deployment/`, `features/`, `benchmarking/`, `findings/`); dated point-in-time records go to `archive/session_records/`; audits go to `findings/audits/` with a `YYYY-MM-DD_` prefix. Only the nav files (`INDEX.md`, `scope.md`, `roadmap.md`, `todo.md`) and the two operator guides (`TROUBLESHOOTING.md`, `PERFORMANCE.md`) stay at docs/ top level.

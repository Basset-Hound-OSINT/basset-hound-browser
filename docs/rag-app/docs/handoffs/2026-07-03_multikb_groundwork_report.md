# MULTIKB-GROUNDWORK — Handoff Report (2026-07-03)

**Agent**: architect@exudeai:rag-bootstrap:MULTIKB-GROUNDWORK (design-only)
**Deliverable**: `docs/findings/2026-07-03_multikb_design_groundwork.md` — implementation-ready
Option B (gateway) blueprint. Zero implementation performed, per user direction (core
single-corpus bootstrap first; multi-KB later).

## What the blueprint contains

- **Decision summary**: Option B gateway; semantic-first cross-KB merge for MVP (shared
  nomic-embed-text/768 space makes cosine directly comparable), global RRF as phase 2 for
  hybrid/keyword; ID namespacing via an additive `kb` field + citation grammar
  `[[RAG:{kb}:{path}#{chunk}@{score}]]` (per-DB autoincrement ids collide otherwise).
- **Exact anchors** (all verified in current tree): mount point `app/main.py:166` + lifespan
  86-163; the core blocker `app/registry.py:147-160` (shared-engine reuse → per-KB engines);
  unsound merge `app/search_pipeline.py:273-295`; config surface `app/config_manager.py:147-157`
  (already parses `knowledge_bases:`); client `client/fallback_policy.py:43,154-223` /
  `client/ragq.py:57-106`; compose `docker-compose.multi-kb.yml:154-227`.
- **Two latent bugs found during design**: `app/Dockerfile.multi-kb` runs `uvicorn main:app`
  from `/app` which breaks the package-relative imports (main Dockerfile uses `/src` +
  `app.main:app`); `PostgresKB.ingest` has no content_hash dedupe (blocks any future gateway
  write path, not the query-only MVP).
- **researchhub mapping** (authorized out-of-tree survey): workspace == KB; READ all / WRITE
  own (B78); default query = own KB, opt-in `kb=[subset]` / `kb="all"`; mandatory result
  attribution; RAG-first escalation as a client-side pattern. Their global-RRF +
  priority-boost spec is the pinned phase-2 design.
- **6 disjoint edit zones** (Z1 config+registry, Z2 search core, Z3 gateway, Z4 deploy,
  Z5 client, Z6 tests+contract) with a 7-point interface freeze enabling full parallelism,
  ~570 LOC total estimate, plus 10 acceptance criteria and an explicit MVP-vs-deferred cut.
- **Roadmap-bound text** staged in the doc's §10 for the roadmap owner (docs/roadmap.md:102
  replacement) — roadmap NOT touched, per work-zone rules.

## Client story (headline)

`ragq --kb atc "query"` → `POST /api/v2/search {"kb":"atc"}`; `--kb all` / `--kb a,b` for
collaboration; no `--kb` = byte-identical v1 behavior; explicit error (no silent fallthrough)
against servers without the gateway.

## Incident note

Host root filesystem hit **100% full** mid-task (446G/456G, 0 available; writes failed
repo-wide for ~20 min until ~57G was freed externally). Deliverables written after recovery.
Disk was at 90% (44G free) at completion — above the 80% ceiling; flagging for operator
attention before any docker-based integration work.

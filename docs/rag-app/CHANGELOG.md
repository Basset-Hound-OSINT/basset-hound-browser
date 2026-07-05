# Changelog

All notable changes to the rag-bootstrap base template are recorded here.

## [Unreleased]

### 2026-07-03 — Stabilization overhaul pass

Full-repo overhaul making the template deployable as-is for downstream
consumers. **Upgrading a pre-2026-07-03 copy? Read
[docs/deployment/UPGRADE_2026-07-03.md](docs/deployment/UPGRADE_2026-07-03.md)**
— two of these changes are breaking (port default, embedding dimension) and
one changes an API contract (async ingest).

- **Port scheme**: default web port 8100 → **10000**; single source of truth
  `RAG_PORT_BASE=10000` with derived `RAG_<svc>_PORT = base + offset`
  (band 10000-10019 reserved; downstream apps take 10020+); port preflight +
  in-band auto-increment in `deploy.sh`.
- **Embeddings Ollama-only by default**: canonical triple
  `nomic-embed-text` / **768** / `ollama` in every fallback layer
  (`app/config.py`, compose, `config/config.yaml`, `.env.example`,
  `deploy.sh`); `ollama pull nomic-embed-text` is a hard prerequisite;
  sentence-transformers demoted to an optional, not-installed backend.
  Dimension change 384 → 768 requires re-ingest — dual dimension guards
  (deploy-side + app-side `rag_meta`) refuse mismatches.
- **Async directory ingest**: `POST /api/ingest/directory` now returns
  `202` + `job_id`; poll `GET /api/ingest/status/{job_id}`. All in-repo
  callers (deploy.sh, bootstrap.sh, frontend) poll.
- **New endpoints**: `GET /api/status` (corpus whoami), `GET /health/index`
  (freshness/staleness), additive `/api/v1/*` aliases (search/ask/status/
  health; search POST-only), `/api/health?deep=1`, `X-Chunk-Bytes` header,
  `corpus` prefix filter on search.
- **Corpus honesty knobs**: `DOCS_PATH` same-path `:ro` mount default-on
  (host-openable citations), `RAG_INGEST_ROOT_GUARD=on` by default,
  `WATCHER_ARCHIVE_MODE=off` by default (watcher no longer moves files).
- **deploy.sh**: `doctor` (full preflight incl. Ollama + model + dims) and
  `reset` (wipes root-owned data via throwaway container) subcommands;
  `generate_env` preserves customized `.env` (append-only merge, .env wins);
  no-eval config parsing; `ollama-forwarder` helper.
- **Consumer surface**: `docs/integration/CONSUMING_AGENTS_CONTRACT.md`,
  `agent_hints/HOW_TO_QUERY.md`, `client/ragq.py` + `client/fallback_policy.py`.
- **Hardening**: embedding concurrency semaphore + retry/backoff; idempotent
  re-ingest (`ON CONFLICT` dedupe); stale-chunk expiry; watcher gating;
  ingestion extension/exclude filters; instance isolation via
  `COMPOSE_PROJECT_NAME` (no `container_name` collisions).
- **Repo layout**: docs re-taxonomized under
  `docs/{integration,reference,deployment,archive/session_records}/` with a
  regenerated [docs/INDEX.md](docs/INDEX.md); root decluttered (monitoring
  configs → `config/monitoring/`, extras → `config/requirements/`, test
  scripts → `tests/`); root discipline codified in `docs/scope.md`.
- **Monitoring stack (grafana/prometheus/loki/alertmanager/exporters)
  declared out of scope / unsupported for now** — files retained, not part of
  the supported surface (see README + `docs/scope.md`).
- **Verification**: dev-fleet verify + fix-batch adversarial re-verify (all
  PASS), security audit **HIGH=0 / MED=0** with all 6 LOWs dispositioned
  (4 code fixes — see `docs/handoffs/2026-07-03_sec_lows_report.md`), and a
  full live smoke **PASS**
  (`docs/findings/audits/2026-07-03_live_smoke_report.md`).
- **Multi-KB**: still scaffolding-only; `docker-compose.multi-kb.yml` is NOT
  a functional multi-KB deployment. Design groundwork for the future
  gateway workstream: `docs/findings/2026-07-03_multikb_design_groundwork.md`.

### Added — upstreamed from the PalletAI real-world application (2026-06-21)

The following four generic, reusable RAG improvements were developed and
production-verified in the PalletAI docs-RAG deployment, then upstreamed back
into this base template so every project built on the template benefits. They
are generic by construction — no PalletAI/box-specific paths, scripts, env, or
project names were brought across. Future upgrades proven downstream should feed
back here the same way.

1. **Path-reference in search results.** `SearchResult` now carries a
   `document_filepath` field, populated from `Document.filepath` (already a
   column on the model — no DB migration) through the whole search layer
   (`app/search.py` semantic/keyword/hybrid, `app/keyword_only_kb.py`), and
   surfaced in every response/result shape: `app/main.py`
   (`SearchResultSchema`, `/api/search`, `/api/ask`, the SSE `sources` event,
   chat sources & history), `app/api_v2.py` (`SearchResponse`), and the
   `app/mcp_server.py` search tool result dict. Every hit now returns its source
   file path.

2. **Score clarity.** `SearchResult` / `SearchResultSchema` gained `cosine` and
   `normalized` (both default `None`, fully backward-compatible): `cosine` is the
   raw vector cosine similarity from the semantic leg; `normalized` is a clamped
   0-1 confidence proxy. They are populated in `semantic_search` and carried
   through `_rrf` / `hybrid_search`, then surfaced on `/api/search` and
   `/api/ask`. The existing RRF `score` is left untouched.

3. **Opt-in cross-encoder reranker.** New `app/reranker.py` (lazy, process-wide,
   fail-soft cross-encoder second-stage reranker) plus wiring in `app/main.py`
   (`?rerank=true` per-request param or the `RAG_RERANK_ENABLED` env flag —
   **DEFAULT-OFF**). The heavy `sentence-transformers` / `torch` import is LAZY
   (first rerank call only), so the default code path and default image pull NO
   torch. New optional `requirements-rerank.txt` at the repo root carries the
   `sentence-transformers` extra; the default `app/requirements.txt` is
   deliberately left torch-free. A `rerank_score` field (cross-encoder logit) is
   surfaced when reranking runs.

4. **Watcher-gate robustness.** The inotify auto-ingest watcher is now gated on a
   `WATCHER_ENABLED` setting (`app/config.py`, default `True`). When false the
   lifespan (`app/main.py`) skips creating the watcher task, whose blocking
   `read()` loop could otherwise stall the event loop and prevent uvicorn from
   binding its socket on explicit-ingest deploys.

All four are additive and backward-compatible: existing callers, schemas, and
tests are unaffected by the new default-`None` fields, and reranking stays off
unless explicitly enabled.

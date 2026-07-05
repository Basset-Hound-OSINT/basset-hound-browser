# WS-DOCS-3 — Wave-3 documentation finisher — Report

**Agent**: py-dev@exudeai:rag-bootstrap:WS-DOCS-3
**Date**: 2026-07-03
**Status**: COMPLETE

## What was done

### 1. README.md (rewritten sections, ~8 stale port refs fixed)
- All literal `8100` → `10000` (8 occurrences); post-edit grep for `8100` in README = **0**.
- Added the `RAG_PORT_BASE=10000` offset table (web +0 … cadvisor +16, reserved
  band 10000-10019, downstream 10020+), matching `.env.example` and the compose
  fallback literals exactly; documented start-time auto-increment behavior.
- Documented new endpoints: async `POST /api/ingest/directory` (202 + job_id) with
  poll flow example, `GET /api/ingest/status/{job_id}`, `GET /api/status`,
  `GET /health/index`, and the ADDITIVE `/api/v1/{search,ask,status,health}` aliases.
- Documented the Ollama-only embedding default (nomic-embed-text/768/ollama) as a
  HARD prerequisite (`ollama pull nomic-embed-text`) with a top-of-file callout,
  plus `./deploy.sh doctor` in Quick Start, Setup, and the commands list
  (also added `reset`, `ollama-forwarder`, `--defaults`, `--skip-preflight`).
- Documented the new knobs: `DOCS_PATH` (same-path :ro mount), `RAG_INGEST_ROOT_GUARD`
  (default on when DOCS_PATH set), `WATCHER_ARCHIVE_MODE` (off|copy|move, default off)
  — in both a dedicated knob table and the env-var table (which also gained
  `RAG_PORT_BASE`, `COMPOSE_PROJECT_NAME`, `RAG_NETWORK_NAME`, `OLLAMA_BASE_URL`).
- Fixed the moved integration-guide link → `docs/integration/integration-guide.md`;
  fixed all `[config.yaml](config.yaml)` links → `config/config.yaml` (file only
  exists there; deploy.sh reads it there); Documentation section now links INDEX,
  TROUBLESHOOTING, PERFORMANCE, CONSUMING_AGENTS_CONTRACT, agent_hints/HOW_TO_QUERY.
- Config snippet synced to shipped `config/config.yaml` (port 10000, chunk_size 256,
  `exclude` globs, `concurrent_files`, `retry_backoff`).

### 2. New guides
- **docs/TROUBLESHOOTING.md**: Ollama unreachable/model missing (3 connectivity
  modes + rootless socat forwarder / systemd --user unit via
  `./deploy.sh ollama-forwarder`); port collisions + band auto-increment;
  dim-mismatch (deploy `dim_guard` + app-side `rag_meta` startup refusal) + reset
  path; ghost containers / root-owned data (start-path trap, throwaway-root-container
  wipe in `reset`/`clean`); network isolation ("why can't I reach postgres");
  multi-stack runbook (isolation keys, `/api/status` provenance, ingest-root guard).
- **docs/PERFORMANCE.md**: `ingestion.concurrent_files` / `ingestion.retry_backoff`
  knobs + the fixed constants (3 attempts, 0.5s base, 64-text `/api/embed` batches);
  chunking params with use-case guidance; ingest throughput (async jobs, exclude
  globs, idempotent dedup, X-Chunk-Bytes token telemetry); monitoring overlay
  (compose command + 10010-10016 port map). Every claim verified against
  `app/embeddings.py`, `app/main.py`, `deploy.sh`, and the compose files.

### 3. Root suggestions files — dispositioned + archived
Each of the 4 files got a DISPOSITION header (date, per-item
done-in-this-pass / deferred-to-roadmap; no blacklisted items — only a contextual
k8s mention in issue #9 of the large-corpus file), then moved (plain `mv`, all
untracked) into `docs/archive/session_records/`:
- `RAG_BOOTSTRAP_ISSUES_AND_SUGGESTIONS.md` (15 issues + A-F: 12 done, wizard/backup/multi-model/memory/quickstarts deferred)
- `SUGGESTIONS.md` (I1-I11 + R1-R7 all done; instance registry + symbol chunking deferred)
- `SUGGESTIONS_FROM_DOCS_RAG_DEPLOYMENT_2026-07-03.md` (§1.1-1.7, §2.1-2.6, §3, §4.1-4.8 ALL done)
- `SUGGESTIONS_FROM_RESEARCHHUB_2026-06-23.md` (§1.1-1.7, §3.3-3.6, §5 done; install-for-project/orchestra-snippet/§4 futures deferred)

Disposition claims were spot-verified against shipped code: `/api/health?deep=1`
(main.py:564,592), `scripts/post_commit_rag_ingest.py`, `expire_stale_chunks`
(ingestion.py:327), citation format (CONSUMING_AGENTS_CONTRACT.md §5),
`fastmcp==2.1.2` pin, `corpus` path-prefix filter (main.py search handler).

### 4. docs/roadmap.md
Added **"Deferred backlog (2026-07-03 pass)"** (16 items): symbol-aware chunking,
setup wizard, backup/restore, `/stats` dashboard, multi-embedding-model stanza,
streaming-ingest memory bounds, parallel watcher workers, quickstart examples,
DB-size estimation, instance registry, install-for-project.sh, orchestra snippet,
diff-context lookups, CLAUDE.md-aware ranking, federation, full_doc_url.
FROZEN-POLICY block left untouched.

### 5. docs/INDEX.md + docs/todo.md
- INDEX: new "Operator guides (top-level)" section for the two guides; 4 archived
  suggestions files added to the archive/session_records table; conventions line
  updated to name the two top-level guides.
- todo.md: new dated completed section for this pass; stale live-state note
  "only port 8100 exposed" → 10000 (dated history entries left as history).

## Self-verification
- Link check (all relative md links in README, TROUBLESHOOTING, PERFORMANCE,
  INDEX, roadmap, todo): **0 broken** (one found-and-fixed: `config.yaml` → `config/config.yaml`).
- `grep -c 8100 README.md` → **0**. Remaining `8100` matches repo-wide in my zone
  are dated history entries only (todo.md 2026-01-30 completed list).
- 4 root files gone from repo root; present in `docs/archive/session_records/`.

## Deviations
- `docs/findings/audits/2026-07-03_root_suggestions_triage_audit.md` ends with
  stray tool-call artifact text (`</content>`, `</invoke>` at its tail) — file is
  READ_ONLY for this instance; left as-is, flagging for the owner.
- README example port for "change the port" step uses 10020 (per the plan's
  "downstream apps take +20 and up") instead of the old 8200-style example.
- todo.md line 6 wording mentions "8100" descriptively ("zero stale 8100 refs") —
  intentional, changelog-style.

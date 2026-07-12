# Documentation prune — cite-not-copy consolidation (2026-07-06)

Executed the 4-phase documentation-pruning directive (MAP → MANIFEST → approval →
additive EXECUTE). Goal: single-source-of-truth, kill the ~3,077 near-dup pairs
the docs-RAG surfaced, reclaim stale bloat. **Additive — nothing bulk-deleted;
everything moved to `docs/archives/prune-2026-07-06/` (MOVE-LOG.md there).**

## What was done
- **MAP** via a 4-agent read-only workflow (wiki-mirror, dup-clusters,
  superseded-dated, stale/ghost+INDEX), cross-checked against the live RAG.
- **Archived 348 files** to `docs/archives/prune-2026-07-06/` (subpath preserved):
  - `docs/wiki/` (193-file redundant GitHub-wiki mirror added in one 2026-07-05
    commit) collapsed — dups/obsolete/`V12.9.0-*` archived; **20 genuinely-unique
    analyses relocated to `docs/findings/`** (MINIMAL-GUI-STRATEGY,
    WEBSOCKET-SERVER-MODULARIZATION, BUILD/DEPENDENCY-RISK-ANALYSIS,
    FEATURE-PARITY-MATRIX, HEADLESS-REQUIREMENTS, OBSCURA-DECISION-FRAMEWORK, …).
  - ~135 superseded status / production-readiness / version reports (v12.0.0 launch
    saga, root status snapshots, PHASE-N-COMPLETE handoffs, V12.x planning) — all
    superseded by `docs/planning/PROJECT-STATUS-MATRIX.md`.
  - `docs/wave16/` (out-of-scope 1000+-user k8s scaling) + root stray dups.
  - **Canonicals protected** (never archived); immutable `docs/archive/`+`archives/`
    + session records untouched. **Zero-content-lost verified: 361/361 at destination.**
- **Link-rot: 526 broken links auto-repointed** (371 to moved LIVE targets — the
  flat→subdir reorg, e.g. `docs/ROADMAP.md`→`docs/roadmap/ROADMAP.md`; 155 to
  archived targets). **328 truly-missing** links (`DEPLOYMENT.md`, `API.md`,
  `HARDENING-GUIDE.md`, …) left as-is and listed — follow-up.
- **Added 9 INDEX.md** (`docs/research/*` subdirs).
- **RAG updated**: reconcile + `./rag prune --apply` purged 472 orphaned rows →
  index **1,618 → 1,283 docs** (moved docs dropped; archive tree excluded). Live
  `docs/*.md` **1,580 → 1,241**.

## Deferred
- **Full `rag rechunk` line-spans backfill** — single-KB rechunk skips (reads a
  relative `./data/docs`; `CONFIG_INGEST_DIRS` env didn't override — a template
  limitation, flag to rag-bootstrap devs). Line-spans backfill **automatically**
  as docs are edited/reconciled (`with_span` already 0→601 from the link edits);
  full backfill deferred until the single-KB source-config is sorted + GPU headroom.
- **328 truly-missing doc links** — repoint/stub in a follow-up.

## Commits
- `263367e` — archive 348 + collapse wiki + 9 INDEX.md.
- `c63f70d` — auto-repoint 526 links.

Move log: `docs/archives/prune-2026-07-06/MOVE-LOG.md`.

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

## Follow-up completed (2026-07-12)
- **Remaining broken links resolved** (`f11ecd4`): the 328 truly-missing links
  re-counted to 84 distinct targets / 141 occurrences → **34 RAG-repointed to live
  docs** (HARDENING-GUIDE→security index, INPUT-VALIDATION→VALIDATION-INTEGRATION,
  etc.), **107 dead/placeholder links cleaned** (text kept; `[related-feature]`
  boilerplate + the pruned `evasion-framework-guide` refs). Zero broken links left.
- **Line-spans backfill done** — a clean `./rag reset --yes && ./rag up` + forced
  reconcile fresh-re-embedded the pruned corpus (the reliable single-KB path, since
  `rag rechunk` skips a relative-source KB). Citations now carry line numbers +
  a pristine post-prune index (no residual orphan rows).

## Commits
- `263367e` — archive 348 + collapse wiki + 9 INDEX.md.
- `c63f70d` — auto-repoint 526 links.
- `f11ecd4` — resolve remaining broken links (34 repoint + 107 cleaned).

Move log: `docs/archives/prune-2026-07-06/MOVE-LOG.md`.

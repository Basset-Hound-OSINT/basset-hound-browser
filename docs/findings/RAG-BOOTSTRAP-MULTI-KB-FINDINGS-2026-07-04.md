# rag-bootstrap Multi-KB Update — Findings & Reference (2026-07-04)

**Purpose:** A tight reference on what changed in the upstream `rag-bootstrap`
template (multi-KB + fleet hardening), how developers pull those changes, and
how it relates to our local RAG instance. Grounded in the authoritative
upstream notice; claims are cited and anything unverified is flagged.

**Authoritative source (read this for full detail):**
`/home/devel/exudeai/rag-bootstrap/docs/deployment/DEV_NOTE_2026-07-04.md`
(cross-checked against `/home/devel/exudeai/rag-bootstrap/CHANGELOG.md`).

**Context:** The 2026-07-03 template was first production-deployed by **us**
(basset-hound-browser, 2014-doc corpus). That audit produced three fixes
(B1/B2/B3) and the template is now "production-verified by an independent
deployment." Our findings fed directly back upstream.

---

## 1. What's NEW in the rag-bootstrap template

All of the below landed **2026-07-04** and, except one default flip, are
**non-breaking** (no API/schema/port change, no re-ingest required).

### Multi-KB support (now functional)
- One stack can serve **many knowledge bases** — one KB per project/corpus,
  one port. The live exudeai instance serves **14 KBs from a single stack**
  (per DEV_NOTE "Update 2").
- Reached via the api_v2 `SearchPipeline` path; `POST /api/v2/search` accepts a
  KB selector and returns a `{results, mode_used, total}` envelope.
- Note on lineage: as of **2026-07-03** multi-KB was still *scaffolding-only*
  (`docker-compose.multi-kb.yml` was not a working deployment). The
  **2026-07-04** entries (multi-KB gate fix, client v2-envelope unwrap,
  postgres init fix) are what make it functional — so "multi-KB works" is a
  same-day-fresh capability, not the 07-03 state.

### MCP `kb` selection parameter
- MCP tool `search_documents` gains an **optional `kb` parameter**: a KB name,
  a comma-separated list (`"a,b"`), or `"all"`. Absent → v1 single-corpus
  behavior (backward-compatible). Mirrors `POST /api/v2/search`.
- kb-routed results carry `kb` + a kb-namespaced citation
  (`[[RAG:{kb}:{path}#{chunk}@{score}]]`) plus a `mode_used` advisory.
- Relevant only if you use the MCP surface against a multi-KB configuration.

### Fleet-resource hardening (the "Update 2" addendum)
Driven by a real incident: a host running 5+ template stacks exhausted the
per-user `fs.inotify.max_user_instances` cap (129 > 128) and bottomed out at
439 MB free RAM with unbounded redis containers.

- **Watcher now defaults OFF** (`WATCHER_ENABLED=false`) — **the one default
  flip to know about.** Each enabled watcher costs one inotify instance (cap
  commonly 128, host-wide), and watcher-ingested files store *container* paths
  (citations not host-openable). Explicit ingest (`./deploy.sh ingest` /
  `POST /api/ingest/...`) is now the primary flow. **If you rely on
  drop-a-file auto-ingest, set `WATCHER_ENABLED=true` in `.env`** (fine on
  single-instance hosts; `doctor` warns if it would tip the inotify budget).
  The watcher is also now crash-proof (the blocking `inotify.read` that starved
  the event loop and wedged api startup — "logs stop after Started inotify
  watcher", 502 — is fixed; exhausted inotify budget degrades loudly to polling
  instead of taking the stack down).
- **Per-service memory caps by default**: api 512m / postgres 1g / redis 256m /
  frontend 128m (override via `RAG_API_MEM_LIMIT`, `RAG_PG_MEM_LIMIT`,
  `RAG_REDIS_MEM_LIMIT`, `RAG_FRONTEND_MEM_LIMIT`). Redis is dataset-bounded
  (`--maxmemory 192mb --maxmemory-policy allkeys-lru`, `RAG_REDIS_MAXMEMORY`);
  it's a cache, eviction is safe. **Stack hard ceiling ≈ 1.9 GB** (previously
  unbounded).
- **`./deploy.sh doctor` fleet-headroom checks** (warnings only): inotify
  usage vs cap, host `MemAvailable` vs this stack's summed memory caps, and how
  many template-derived stacks are running; the config echo now prints the
  resolved `Watcher:` value.
- **New consolidation guide:**
  `/home/devel/exudeai/rag-bootstrap/docs/deployment/CONSOLIDATION.md` —
  measured per-stack costs, multi-KB as the primary consolidation lever
  (N stacks → one stack with one KB per corpus), the bounding knobs above, and
  an N-stacks→1 migration sketch. **Running several template copies on one box?
  One multi-KB instance replaces them.**

### Postgres fresh-DB fix
- `PostgresKB.initialize` now runs `CREATE EXTENSION IF NOT EXISTS vector`
  **before** `create_all` (matching v1 `init_db()`), so registry-auto-created
  multi-KB databases initialize on hosts **without a template1 initdb hook**.
  This is what unblocks multi-KB DB creation on a clean host.

### Also from our 07-04 downstream audit (B1/B2/B3, non-breaking)
- **B1** — multi-instance port race closed: concurrent `deploy.sh start`s
  coordinate through a flock'd port registry + bind-retry, so two instances
  can't claim the same port.
- **B2** — `./deploy.sh start --reindex` (one prompt drives
  wipe → restart → re-ingest on a dimension mismatch) and
  `./deploy.sh reset --yes` (non-interactive reset for scripts/CI).
- **B3** — startup guard: selecting an embedding backend that isn't installed
  now aborts boot with an actionable message; reason surfaced in `/api/health`
  (`embedding_reason` field).

---

## 2. Updates are NOT automatic — by design

There is **no sync daemon and no auto-pull.** Applying template changes is a
deliberate, manual action. (Grounded: the update mechanism is a manual bash
script — `scripts/update_from_upstream.sh`, dry-run by default — and the
inotify watcher is for *document* ingest, not template updates. The DEV_NOTE's
own procedure is a manual "pull → doctor → start".)

**The one-command updater (shipped in the template):**

```bash
./scripts/update_from_upstream.sh --apply && docker compose up -d
```

- `scripts/update_from_upstream.sh` **reads** the upstream template
  (`UPSTREAM_PATH`, default `/home/devel/exudeai/rag-bootstrap`) and syncs its
  **code surface** into your fork: `app/`, `frontend/`, `client/`,
  `agent_hints/`, `deploy.sh`, `docker-compose.yml`, select `scripts/` +
  requirements. **Default is dry-run**; `--apply` performs the sync. It never
  writes to upstream.
- It **never touches local state**: `.env`, `config/config.yaml`,
  `.env.example`, `docs/`, `VERSION`, `README.md`, `tests/`, data volumes.
- ⚠️ The script overwrites `deploy.sh` / `docker-compose.yml` / app files that
  may carry **fork adaptations** (instance identity, port band, volume paths).
  Re-apply your adaptations after a sync; use the optional
  `STALE_IDENTITY_PATTERNS` grep guard to catch regressions.

**DEV_NOTE's documented procedure (equivalent, recommended):**
pull the latest template → run `./deploy.sh doctor` and fix anything red →
start. For a pre-2026-07-03 copy, also read `docs/deployment/UPGRADE_2026-07-03.md`
(two of *those* changes are breaking: port default 8100→10000, embedding
dimension 384→768). Nothing after 2026-07-03 is breaking.

> ⚠️ **Flag (not verbatim in DEV_NOTE):** the exact one-liner above is the
> task-provided form. `scripts/update_from_upstream.sh --apply` is confirmed
> from the script header; the `docker compose up -d` restart clause is the
> standard restart step, but the DEV_NOTE specifically recommends running
> `./deploy.sh doctor` before starting. Prefer `doctor` first.

---

## 3. For developers — how to get the updates

Two paths, differing in *when* you get the changes:

- **Pull by PATH → gets everything now.** Running
  `scripts/update_from_upstream.sh --apply` against the local upstream path
  (`/home/devel/exudeai/rag-bootstrap`) reflects the template's *current
  working tree* — including changes still under `[Unreleased]` in the
  CHANGELOG. This is the fast path.
- **Pull via GIT → waits on the maintainer's commit batch.** All 2026-07-04
  changes are staged under **`[Unreleased]`** in the upstream CHANGELOG, so a
  git-remote consumer only receives them once the maintainer commits/pushes
  the batch. If you clone/pull via git, you wait.

**Point developers at the authoritative note:**
`/home/devel/exudeai/rag-bootstrap/docs/deployment/DEV_NOTE_2026-07-04.md`
(covers both the 07-03 upgrade and the 07-04 addendum).

Found a problem downstream? Drop a dated
`SUGGESTIONS_FROM_<project>_<YYYY-MM-DD>.md` at the template root — that is
exactly how our B1/B2/B3 fixes landed; every such file gets triaged.

---

## 4. Our local instance

- **Name / URL:** `basset-hound-docs-rag` on **http://localhost:10021**
  (verified running: frontend, api, postgres+redis all up).
- **Embeddings:** `nomic-embed-text` @ **768 dims** (Ollama) — the current
  canonical triple. Generation LLM: `llama3.2:3b`.
- **Corpus:** our `docs/` tree — 2014 documents / 17738 chunks (last ingest).
- **Being updated to this template in a parallel task** →
  `docs/findings/RAG-LOCAL-UPDATE-2026-07-04.md`.
  > Flag: as of writing, that file does not yet exist (the parallel agent is
  > still producing it). This is a forward reference.
- **How to query it:** see `docs/rag-app/USAGE-BASSET-HOUND.md` — `POST
  /api/search`, `POST /api/ask`, the `client/ragq.py` CLI, and `deploy.sh`
  operations, all pinned to port 10021.

> ⚠️ **Stale doc warning:** `docs/rag-app/RAG-STATUS.md` still describes the
> **pre-update** instance (port 8100, `all-MiniLM-L6-v2` @ 384-dim, 2827 docs).
> That is outdated — trust `USAGE-BASSET-HOUND.md` (10021 / 768-dim / 2014
> docs) and the parallel `RAG-LOCAL-UPDATE-2026-07-04.md` for current state.

---

## 5. Verification notes

- Multi-KB, MCP `kb` param, watcher default-off, memory caps, doctor checks,
  consolidation guide, and the postgres init fix: **confirmed** in the DEV_NOTE
  and CHANGELOG.
- Updater command shape: `scripts/update_from_upstream.sh --apply` **confirmed**
  from the script header; `&& docker compose up -d` is a plausible restart step
  but the DEV_NOTE prefers `./deploy.sh doctor` first (flagged in §2).
- "No sync daemon / not automatic": **inferred** (well-grounded) from the manual
  updater script + the watcher being document-ingest only — not stated as those
  words in the DEV_NOTE.
- `RAG-LOCAL-UPDATE-2026-07-04.md`: **not yet present** at write time (parallel
  task); linked as a forward reference.

_Doc author: doc-writer agent. Source-of-truth: DEV_NOTE_2026-07-04.md +
CHANGELOG.md under `/home/devel/exudeai/rag-bootstrap`._

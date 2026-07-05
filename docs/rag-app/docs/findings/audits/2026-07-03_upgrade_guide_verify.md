# Adversarial verification: docs/deployment/UPGRADE_2026-07-03.md

**Date**: 2026-07-03
**Scope**: every factual claim in the upgrade guide vs the actual tree
(`.env.example`, `docker-compose.yml`, `deploy.sh`, `app/config.py`,
`app/embeddings.py`, `app/main.py`, `app/watcher.py`, `app/requirements.txt`,
`config/config.yaml`, `CHANGELOG.md`, moved-file locations), plus the
"old copy" claims vs the committed HEAD versions of the same files
(`git show HEAD:rag-bootstrap/...`), plus a mental walk of the step-by-step
procedure as a dev holding an 8100-era copy.

**Verdict**: the guide's *claims* are accurate — every port number, env var,
default, field name, endpoint, guard behavior, and moved-file path checked out
against the code, and the "old copy" characterizations were confirmed against
HEAD. The *procedure*, however, has **2 real failure points** (F1, F2) and
2 lesser gaps (F3, F4). CHANGELOG.md is consistent with the guide.

---

## FAILURES (procedure walk)

### F1 — MEDIUM: Step 8 `./deploy.sh ingest` (no args) fails for both default and legacy configs; the guide never says to align `config.yaml ingestion.directories` with `DOCS_PATH`

`do_ingest` with no paths reads `config.yaml ingestion.directories`
(`deploy.sh:609-611`) and converts relative entries to
`${SCRIPT_DIR}/<path>` host-absolute paths (`deploy.sh:619-621`) before
POSTing. Two burn scenarios:

1. **Canonical default config**: `directories: [./docs]`
   (`config/config.yaml:54-55`) resolves to `<repo>/docs` — the repo's *docs
   folder*, which is **not mounted in the api container** (mounts are
   `./data/docs → /data/docs` and the `DOCS_PATH` same-path `:ro` mount,
   `docker-compose.yml:193,204`). `Path(body.path).is_dir()` is false in the
   container → `400 Directory not found` (`app/main.py:671-676`) → deploy.sh
   prints `Failed to ingest` and reports `Total: 0 documents ingested`.
2. **Upgrader's kept old config** (step 2 says keep your config.yaml
   customizations): old copies conventionally pointed ingest at the container
   path `/data/docs`. That path *exists* in the container, but the now
   default-on ingest-root guard compares it against
   `DOCS_PATH=<host-absolute>` → `400 ... outside the configured docs root`
   (`app/main.py:484-497`). Same failure if the user sets `DOCS_PATH` to a
   real docs root in step 4 but leaves `directories:` pointing anywhere else.

Step 4 tells the user to set `DOCS_PATH` but never to update
`ingestion.directories` to host-absolute path(s) under it. The cited live
smoke does not cover this: it ingested via an explicit host-path POST
(`{"path": "/home/devel/exudeai/rag-bootstrap/data/docs"}`), never via
no-arg `./deploy.sh ingest` (live_smoke_report.md §4).

**Fix for the guide**: add to step 4 — "set `config.yaml
ingestion.directories` to host-absolute path(s) under `DOCS_PATH` (container
paths like `/data/docs` and the `./docs` default will both be rejected)"; or
change step 8's primary command to `./deploy.sh ingest <host-abs-docs-path>`.

### F2 — MEDIUM-LOW: Step 4's "Alternatively: delete `.env` entirely" regenerates the stale port from the kept old `config.yaml`

`generate_env` derives `RAG_PORT` from `config.yaml network.port`
(`deploy.sh:273` `web_port="${CONFIG_PORT:-$DEFAULT_PORT}"`, written at
`deploy.sh:291`). Old-copy `config.yaml` carries `network.port: 8100`
(confirmed: `git show HEAD:rag-bootstrap/config/config.yaml` line 32). A dev
who follows step 2 (keep config.yaml), then takes the step-4 alternative
(delete `.env`), gets a fresh `.env` with `RAG_PORT=8100` and
`RAG_PORT_BASE=10000` — a mixed state. Steps 5-8 succeed (nothing checks
port-vs-base coherence), then every step-9 verify curl against
`localhost:10000` fails with connection refused. The guide's own breaking
change 1 text ("stale old values survive until YOU edit **or delete** them")
actively implies deletion cures the port — it does not when the old
config.yaml survives.

**Fix for the guide**: the alternative must be conditioned on first updating
`config.yaml network.port` to 10000 (or removing the key).

### F3 — LOW: Step 6's unconditional "Wipe the 384-dim index (required)" destroys valid 768-dim indexes for a class of old copies

Not every pre-2026-07-03 copy stored 384-dim vectors. The committed HEAD-era
copy already had `nomic-embed-text / 768 / ollama` in `config.yaml`
(lines 106/112/117) and `.env.example` (lines 27-29); only the *fallback
layers* (`app/config.py` 384, compose 384, `deploy.sh` 384) were stale — and
`generate_env` writes config.yaml values into `.env`, so any old deployment
driven by `deploy.sh` was already indexing at 768. For those teams,
`./deploy.sh reset` at step 6 wipes a perfectly compatible index for nothing
(no data loss — corpus files untouched — but a full re-embed of a large
corpus costs hours). Doctor (step 5) already prints the stored-vs-configured
dimension (`dim_guard report`, `deploy.sh:1021`), so the check is free.

**Fix for the guide**: make step 6 conditional — "required only if step 5's
dimension guard reports a stored dim ≠ 768; skip if it reports a match".

### F4 — LOW: DOCS_PATH row overstates "stored `document_filepath` citations open directly on the host" — the default-on watcher undermines it

With `WATCHER_ENABLED=true` (default, compose line 169) the watcher ingests
new files under the `/data/docs` *container* mount, so their stored
citations are `/data/docs/...` container paths, not host-openable ones. Only
documents first ingested via a host-path POST/`deploy.sh ingest` get same-path
citations. The guide's own cited live-smoke report flags exactly this (issue
3: "Citation filepaths are container paths when the watcher ingests first").
The knob table states the benefit unconditionally.

**Fix for the guide**: one-line caveat, or advise `WATCHER_ENABLED=false` for
deployments that rely on host-openable citations.

### Nits (no action required)

- `./deploy.sh reset` is interactive (`read -p "Are you sure? (y/N)"`,
  `deploy.sh:1037`) — a scripted/CI upgrade following the guide verbatim
  hangs at step 6. Guide never claims non-interactive, so not a failure.
- "Above 500 in-flight jobs" → the 429 actually trips at ≥500 entries in the
  whole job table *after* pruning finished jobs beyond the 100 soft cap
  (`app/main.py:437-442,681-690`) — effectively in-flight; close enough.
- Guide says jobs poll "until `status` is `completed` ... or `failed`" —
  exact state strings confirmed (`IngestJobState`, `app/main.py:415-419`).

---

## VERIFIED CLAIMS (all PASS)

### Ports (guide §breaking-1)
- `RAG_PORT_BASE=10000` single source: `.env.example:43`, `deploy.sh:65`
  (`DEFAULT_PORT_BASE=10000`), compose header.
- Offset table (+0 web/80, +10 prometheus/9090, +11 grafana/3000, +12
  loki/3100, +13 alertmanager/9093, +14 pg-exporter/9187, +15
  redis-exporter/9121, +16 cadvisor/8080): matches `.env.example:34-42` and
  `deploy.sh PORT_OFFSETS` (lines 85-93) exactly. (Monitoring overlay itself
  not evaluated — out of audit scope, and the guide marks it unsupported.)
- Web default `127.0.0.1:${RAG_PORT:-10000}:80` — compose line 229; container
  port 80 ✓; localhost-only bind ✓.
- Internal-only 5432/6379/8000 never published — compose has no `ports:` on
  postgres/redis/api ✓. Ollama 11434 not remapped ✓.
- Busy-port auto-select: `port_preflight` scans `port+1..port+19` and writes
  the pick into `.env` via `env_set RAG_PORT` (`deploy.sh:453-463`) ✓.
- Old default **8100** confirmed: `git show HEAD` `.env.example:11`
  (`RAG_PORT=8100`), `app/config.py:49`, compose `${RAG_PORT:-8100}`,
  `deploy.sh DEFAULT_PORT=8100`.
- ".env wins / stale 8100 survives" — `generate_env` merge mode is
  append-only (`env_ensure`, never overwrites; drift warned via
  `report_drift`, `deploy.sh:324-358`) ✓.

### Embeddings (guide §breaking-2)
- Canonical triple `nomic-embed-text / 768 / ollama` in every fallback layer:
  `app/config.py:28-36`, compose lines 143-145, `deploy.sh:69-71`,
  `config/config.yaml:142-155`, `.env.example:84-86` ✓.
- Old triple `all-MiniLM-L6-v2 / 384 / sentence-transformers` confirmed at
  HEAD in exactly the three places the guide names: `app/config.py:18-26`,
  compose lines 126-128, `deploy.sh generate_env` lines 163-164 ✓.
- sentence-transformers NOT installed (commented out,
  `app/requirements.txt:20`); selecting it raises the actionable
  `_ST_GUARD_MESSAGE` ImportError on lazy load (`app/embeddings.py:32-40,
  126-135`) ✓.
- `ollama pull nomic-embed-text` hard prerequisite; doctor verifies
  reachability (`/api/tags`) + model presence (`ollama_check`,
  `deploy.sh:471-514`) ✓; no Ollama container in compose ✓.
- Dual dim guards: deploy-side `dim_guard fatal` on start (`deploy.sh:898`),
  `dim_guard report` in doctor (`deploy.sh:1021`), reads pgvector
  `atttypmod`; app-side `_check_embedding_dimension` reads `rag_meta` and
  raises RuntimeError on mismatch before serving (`app/main.py:52-83`,
  called in lifespan line 93) ✓. Re-ingest path (`reset` → `start` →
  `ingest`) matches the guards' own error text ✓.
- `reset` handles root-owned postgres files via throwaway `alpine:3.20` root
  container, no sudo (`wipe_data_dirs`, `deploy.sh:762-767`) ✓.

### Async ingest (guide §breaking-3) — exact field names verified
- `POST /api/ingest/directory` → `202 Accepted` (`app/main.py:655-659`);
  old HEAD version returned `201` + `list[DocumentSchema]` (HEAD main.py
  381-383) ✓.
- `IngestJobSchema` fields exactly as implied by the guide's example:
  `job_id`, `status` (`queued|running|completed|failed`), `path`,
  `created_at`, `started_at`, `finished_at`, `documents_ingested`,
  `documents`, `error`, `status_url` (`app/main.py:270-282`) ✓;
  `status_url=/api/ingest/status/{job_id}` ✓; poll route
  `GET /api/ingest/status/{job_id}` ✓ (404 with "pruned" note when unknown).
- `completed` carries `documents` list; `failed` carries `error`
  (`_run_ingest_job`, `app/main.py:545-556`) ✓.
- Optional `extensions`/`exclude` per-run overrides
  (`DirectoryIngestRequest`, `app/main.py:262-267`) ✓.
- 429 + `Retry-After: 30` at the 500 hard cap (`app/main.py:679-690`) ✓.
- Jobs in-process, forgotten on restart (module-level dict) ✓; re-ingest
  idempotent (ON CONFLICT dedupe; live smoke §4 shows identical doc ids) ✓.
- In-repo consumers poll: `deploy.sh do_ingest` (lines 630-680),
  `scripts/bootstrap.sh` (lines 146-170), `frontend/js/api.js`
  `ingestDirectory` (lines 164-182) ✓.

### New endpoints & knobs
- `GET /api/status` fields exactly `project_name, docs_root, documents,
  chunks, embedding_model, dimension, indexed_at` (`StatusResponse`,
  `app/main.py:285-294`) ✓.
- `GET /health/index` fields exactly `indexed_at, indexed_commit_sha,
  corpus_bytes, chunks, documents, source_root, staleness_class` with classes
  `unindexed|fresh|aging|stale` (`app/main.py:297-306, 1048-1058`) ✓.
- `/api/v1/{search,ask,status,health}` aliases share handlers/schemas
  (stacked decorators, lines 567-568, 733-734, 797-798, 1024-1025) ✓;
  search is POST-only, GET → 405 (no GET route; observed 405 +
  `allow: POST` in the live smoke) ✓; `/api/search` unchanged ✓.
- `GET /api/health?deep=1` embed + 1-NN round-trip (`app/main.py:597-612`) ✓.
- `X-Chunk-Bytes` response header (`app/main.py:762`) ✓; optional `corpus`
  literal filepath-prefix filter (`SearchRequest.corpus` → `path_prefix`) ✓.
- `DOCS_PATH` default `${PWD}/data/docs`, same-path, `:ro`, default-on
  (compose lines 187, 204) ✓ (but see F4).
- `RAG_INGEST_ROOT_GUARD` default `on` (compose line 188; app default "on",
  `app/main.py:481`), rejects outside paths with 400, `off` opt-out ✓.
- `WATCHER_ARCHIVE_MODE` default `off`, modes `off|copy|move`
  (compose line 177; `app/watcher.py:118-159`) ✓.

### Moved files & root discipline
All verified present at the new locations: SUGGESTIONS*/ISSUES →
`docs/archive/session_records/` (all 4, each with a DISPOSITION header);
`prometheus.yml`/`loki-config.yml`/`promtail-config.yml` →
`config/monitoring/` with `alertmanager.yml`/`alert_rules.yml` still at
`config/`; `CONSUMING_AGENTS_CONTRACT.md` → `docs/integration/`;
`requirements-{benchmark,rerank}.txt` → `config/requirements/`; both test
scripts → `tests/` and genuinely repo-root-anchored (`SCRIPT_DIR/..` + `cd
"$REPO_ROOT"`); `docs/INDEX.md`, `docs/scope.md` "Root Discipline" section,
and `agent_hints/HOW_TO_QUERY.md` all exist. Repo root contains only the
allowed files. Old root strays are gone from the working tree.

### deploy.sh doctor / reset / generate_env
- Doctor performs exactly the 8 checks the guide lists (config resolution,
  .env presence, effective-config echo, Docker daemon, RAG_PORT free, Ollama
  reachable + models, disk space, stored-vs-configured dim) — matches the
  smoke's "doctor 8/8" ✓.
- `generate_env`: no `.env` → full generation from config.yaml; existing
  `.env` → append-only merge preserving every customized key, drift warned,
  `.env` wins ✓ (exactly as documented in the guide, incl. the consequence
  that stale values survive — see F2 for the alternative-path caveat).

### Referenced documents
`docs/findings/audits/2026-07-03_live_smoke_report.md`,
`docs/findings/2026-07-03_rag_bootstrap_execution_plan.md`,
`docs/TROUBLESHOOTING.md` (covers port collisions, dimension guard, Ollama
modes), `docs/integration/CONSUMING_AGENTS_CONTRACT.md`, and the README
monitoring note all exist and say what the guide says they say.

### CHANGELOG.md spot-check
The 2026-07-03 entry is fully consistent with the guide: same port scheme,
same canonical triple + dual guards + re-ingest requirement, same 202/poll
contract with all in-repo callers polling, same endpoint/knob list, same
moved-file taxonomy, same doctor/reset/generate_env description, monitoring
declared out of scope, and it links to the upgrade guide for the breaking
changes. No contradictions found.

---

## Bottom line

No false technical claims were found — an unusual result for an adversarial
pass; the guide's facts are solid. The four findings are all in the
*procedure*: F1 (step 8's primary command fails without a config.yaml
`directories` ↔ `DOCS_PATH` alignment the guide never mentions) and F2 (the
delete-.env alternative resurrects port 8100 from the kept old config.yaml)
will each burn real teams; F3 wastes hours for teams already on 768; F4 is an
overstated benefit. All four are fixable with a few added sentences in steps
4, 6, 8 and the DOCS_PATH knob row.

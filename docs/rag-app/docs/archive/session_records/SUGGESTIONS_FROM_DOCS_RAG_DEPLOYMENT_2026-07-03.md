> **DISPOSITION — 2026-07-03 stabilization pass** (triage:
> `docs/findings/audits/2026-07-03_root_suggestions_triage_audit.md`; archived here as a
> point-in-time record, all items dispositioned):
>
> - §1.1 config path mismatch → **done-in-this-pass** (deploy.sh reads `config/config.yaml`)
> - §1.2 silent default fallback → **done-in-this-pass** (abort without config unless `--defaults`; effective config echoed before `up`)
> - §1.3 hardcoded container_name → **done** (pre-pass: removed everywhere)
> - §1.4 late port conflict → **done-in-this-pass** (port preflight before `up`; auto-increment in band, writes .env)
> - §1.5 orphaned containers on failed start → **done-in-this-pass** (failure trap + down orphans)
> - §1.6 root-owned ./data → **done-in-this-pass** (`reset`/`clean` wipe via throwaway root container)
> - §1.7 silent dim drift → **done-in-this-pass** (`rag_meta` row + deploy `dim_guard` + API startup refusal)
> - §2.1 extensions ignored → **done-in-this-pass** (config `extensions`/`exclude` threaded through route + `ingest_directory`; per-request overrides)
> - §2.2 duplicate-hash cascade → **done-in-this-pass** (ON CONFLICT DO NOTHING dedup + rollback in except; idempotent re-ingest)
> - §2.3 sync ingest vs 300s nginx cliff → **done-in-this-pass** (async ingest: 202 + `GET /api/ingest/status/{job_id}`)
> - §2.4 watcher moves sources → **done-in-this-pass** (`WATCHER_ARCHIVE_MODE` off|copy|move, default off)
> - §2.5 container-relative paths → **done-in-this-pass** (`DOCS_PATH` same-path :ro mount, default-on)
> - §2.6 MissingGreenlet 500 → **done** (pre-pass: `expire_on_commit=False`)
> - §3 concurrency/backoff/batch embeddings → **done-in-this-pass** (`concurrent_files`, `retry_backoff`, batch `/api/embed`; contention model documented in docs/PERFORMANCE.md)
> - §4.1 MCP promote/pin → **done-in-this-pass** (fastmcp pinned; HTTP primary seam; agent docs in CONSUMING_AGENTS_CONTRACT.md)
> - §4.2 `/health/index` → **done-in-this-pass**; §4.3 idempotent resumable ingest → **done-in-this-pass**
> - §4.4 config single-source + validation → **done-in-this-pass**; §4.5 instance isolation → **done**
> - §4.6 preflight doctor → **done-in-this-pass** (`./deploy.sh doctor`); §4.7 ingest scope guards → **done-in-this-pass**
> - §4.8 deep health → **done-in-this-pass** (`/api/health?deep=1` embed + 1-NN)
>
> No blacklisted items in this file (no k8s/Terraform/CI-CD asks).

# Suggestions from a docs-rag deployment (2026-07-03)

**Author context:** Written by a Claude Code agent that deployed a SECOND
instance of this template (`rag-bootstrap`) into a different repo
(`/home/devel/llm-project-bootstrap`) as `docs-rag`, on port `8181`, to
give agents token-cheap retrieval over that repo's docs. These are
**operator/setup-side** observations (contrast with the consumer-side
`SUGGESTIONS_FROM_RESEARCHHUB_2026-06-23.md`). Source app was copied from
`/home/devel/exudeai/rag-bootstrap` @ 2026-06-21.

**Purpose:** Concrete friction + bugs hit while standing up a second
isolated instance, plus fixes, so the core template can absorb them.
Compact; delete anything you disagree with. File/line refs are against the
copy, but line numbers match the source at time of writing.

**TL;DR of severities:**
- 🔴 Blocking: config.yaml path mismatch (§1.1), hardcoded container names (§1.3), port conflict handled too late (§1.4)
- 🟠 Data/correctness: `ingestion.extensions` is ignored by the API (§2.1), duplicate-hash poisons the whole ingest (§2.2)
- 🟡 Ops/UX: silent default fallback (§1.2), partial-failure litter (§1.5), root-owned data can't be cleaned (§1.6), embedding-dim mismatch after reconfig (§1.7), 300s sync-ingest timeout (§2.3), watcher MOVES source files (§2.4), file paths are container-relative (§2.5)

---

## 1. Setup / deployment issues

### 1.1 🔴 `deploy.sh` reads `./config.yaml` but the template ships `config/config.yaml`

`deploy.sh:41` sets `CONFIG_FILE="${SCRIPT_DIR}/config.yaml"` (repo root),
but the only config the template ships is `config/config.yaml`. So editing
the file you are guided to edit has **zero effect**. `deploy.sh:53-54`
then prints `WARN config.yaml not found, using defaults` and proceeds with
ALL defaults — wrong port, wrong network, and (worst) wrong embedding
backend. This cost the most time of anything.

**Suggestion:** pick ONE canonical location and make it authoritative.
Either move the shipped template to `./config.yaml`, or have `deploy.sh`
fall back to `config/config.yaml`, or symlink. Whatever you choose, the
"edit this file" docs and the path `deploy.sh` reads must be the same.

### 1.2 🟡 Missing config falls back to defaults SILENTLY (WARN, not ERROR)

Because §1.1 wasn't obvious, `deploy.sh` happily built and started a full
stack on the **default port 8100 with the sentence-transformers/384
embedding backend** instead of the intended ollama/nomic-embed-text/768.
A misconfigured stack that comes up "healthy" is worse than a hard failure.

**Suggestion:** if `config.yaml` is not found, either abort with a clear
error or require an explicit `--defaults` flag. Regardless, **echo the
effective resolved config** (port, network, embedding model+dim+backend,
llm) right before `docker compose up` so the operator can catch drift.

### 1.3 🔴 `container_name` is hardcoded `rag-bootstrap-*` → breaks multi-instance

The header of `docker-compose.yml` advertises multi-instance support ("run
multiple RAG instances simultaneously" via `RAG_NETWORK_NAME`/`RAG_PORT`),
but every service pins `container_name: rag-bootstrap-{init,postgres,redis,api,frontend}`.
A second instance therefore **collides on container names** with the first
running instance. I had to hand-edit all five.

**Suggestion:** template the names from `PROJECT_NAME`, e.g.
`container_name: ${PROJECT_NAME:-rag-bootstrap}-api`, or drop
`container_name:` entirely and rely on the compose project name. Then
`project_name:` in config.yaml genuinely isolates an instance.

### 1.4 🔴 Port conflict is detected too late and isn't auto-resolved

`deploy.sh` auto-increments the **network** name on conflict, which gives a
false sense that conflicts are handled. But the **port** is not checked:
with 8100 already taken, images built, init/postgres/redis/api all started,
and only then `frontend` failed with `Bind for 127.0.0.1:8100 failed: port
is already allocated` — aborting the whole `start` after most of the work.

**Suggestion:** preflight `ss -ltn`/`lsof` on the resolved `RAG_PORT`
before `docker compose up`; either auto-increment (like the network) or
fail fast with `port 8100 in use — set network.port in config.yaml`.

### 1.5 🟡 Failed `start` leaves orphaned containers + networks (no rollback)

After the §1.4 failure, `docs-rag-{postgres,redis,api}` were left running
and TWO networks were created (`rag-bootstrap-3` and `docs-rag_default`).
Nothing rolled back; I had to `docker compose down` + `docker network rm`.

**Suggestion:** trap failures in the `start` path and `docker compose down`
(or at least print the exact cleanup command + the orphaned resource names).

### 1.6 🟡 `./data` is root/999-owned → operator can't `rm -rf data`

The postgres bind-mount `./data/docker/postgres` is written as the postgres
container UID, so a normal-user `rm -rf data` fails with `Permission
denied`. I had to nuke it via a throwaway root container
(`docker run --rm -v $PWD:/w busybox rm -rf /w/data`).

**Suggestion:** have `deploy.sh clean` remove data via a root container so
it actually works; document the gotcha. (A `deploy.sh reset` that wipes
data + re-inits would also have saved a step here.)

### 1.7 🟠 Changing the embedding model/dim after first run silently breaks

My first (misconfigured) run created the schema with `vector(384)`. After
fixing config to nomic/768, inserts would mismatch the existing column. No
guard or migration — I only avoided it because I wiped `./data`.

**Suggestion:** store the active `{embedding_model, dimension}` in a DB meta
table; on startup, if config differs from what's stored, refuse to start
with a clear message (or offer `--migrate`/`--reset`). Silent dimension
drift is a data-corruption footgun.

---

## 2. Ingestion issues (the ones that actually lost data)

### 2.1 🟠 `ingestion.extensions` in config.yaml is NOT honored by the API

`ingest_directory` (`app/ingestion.py:201`) uses
`HandlerRegistry.supported_extensions()` unconditionally — it never
receives the `ingestion.extensions` list from config, and neither the
`/api/ingest/directory` route nor `deploy.sh ingest` passes one. So a
config of `extensions: [md, txt]` is ignored and the walker ingests every
supported type, including a large `**/sources/pdfs/*.pdf` arxiv corpus I
explicitly meant to exclude. The knob is documented but inert.

**Suggestion:** thread `extensions` (and ideally exclude globs — `.git/`,
`node_modules/`, `data/`, `*.pdf`) from config → the route → `ingest_directory`.
Add an optional `extensions`/`exclude` field to `DirectoryIngestRequest`.

### 2.2 🟠 One duplicate `content_hash` poisons the whole ingest (cascade)

Dedup is enforced as a UNIQUE constraint (`documents_content_hash_key`) that
THROWS. The many duplicated arxiv PDFs hit
`asyncpg.exceptions.UniqueViolationError`; the per-file `except Exception:`
at `app/ingestion.py:209` logs but never `await session.rollback()`, so the
async SQLAlchemy session enters `PendingRollbackError` and **every
subsequent file in the same request fails** ("This Session's transaction has
been rolled back due to a previous exception"). Ingest stalled at 48 of
~752 docs.

**Suggestion:** make dedup non-throwing and the loop self-healing:
- pre-check `SELECT 1 FROM documents WHERE content_hash=:h` and skip, or
- `INSERT ... ON CONFLICT (content_hash) DO NOTHING`, and
- `await session.rollback()` in the `except` before continuing (so one bad
  file can't take down the batch).

This also makes re-ingestion cleanly idempotent (the intended behavior).

### 2.3 🟡 Directory ingest is synchronous; nginx caps it at 300s

`frontend/nginx.conf:29` sets `proxy_read_timeout 300s`, but
`/api/ingest/directory` processes the whole tree in one blocking request.
752 files far exceeds 300s → the UI / `deploy.sh ingest` gets a 504 while
the API keeps working. I had to bypass nginx and call `api:8000` directly
inside the container.

**Suggestion:** make directory ingest ASYNC — return a `job_id` immediately
and expose `GET /api/ingest/status/{job_id}` (you already have the watcher
queue infra to build on). Then large ingests work through the normal UI
and `deploy.sh` path.

### 2.4 🟡 The auto-ingest watcher MOVES source files into `/data/docs/archive`

The watcher archives (moves) processed files out of the watch dir. That's
fine for a drop/staging dir but **destructive if pointed at a live source
tree** — it would relocate the user's actual docs. I disabled the watcher
and used an explicit read-only mount instead.

**Suggestion:** make archiving opt-in (default off), or copy instead of
move, or refuse to archive when the watch dir is mounted read-only. Document
loudly: "the watch dir must be a staging dir, never live source."

### 2.5 🟡 `document_filepath` is the ingester's path, not necessarily an openable one

`filepath` is stored as `str(filepath.resolve())` — the path AS SEEN INSIDE
the container. If you ingest a container-only path (e.g. `/data/docs/x.md`),
consumers get a path they can't open on the host. The whole value of
file-path references (for agents) depends on this being real.

**Workaround that worked:** mount the source repo READ-ONLY at the SAME
absolute path in the api container (`- /host/repo:/host/repo:ro`) and ingest
that path, so `document_filepath` == the real host path.

**Suggestion:** either document this same-path-mount pattern as the
recommended setup, or store an ingest-root-relative path plus a configurable
`host_path_prefix` so results can render an openable absolute path
regardless of mount layout. Consider returning both `abs_path` and
`repo_relative_path`.

### 2.6 🟠 `/api/ingest/directory` returns HTTP 500 on any sizable ingest (MissingGreenlet)

The route ends with `return [_doc_to_schema(d) for d in docs]`
(`app/main.py:394`). The per-file commits (and, after the §2.2 fix,
rollbacks) EXPIRE the ORM `Document` objects, so `_doc_to_schema`
(`app/main.py:1096`) triggers a lazy attribute reload that fails outside the
async greenlet: `sqlalchemy.exc.MissingGreenlet: greenlet_spawn has not been
called`. The client gets a **500 even though every row committed fine** — I
confirmed 672 documents landed despite the 500. Any multi-file ingest trips
this, so the endpoint effectively "errors on success."

**Suggestion:** set `expire_on_commit=False` on the async session, or build
the response dicts before the objects expire (or `await session.refresh`
each), or just return `{ingested: N, skipped: M}` instead of the full ORM
list. As-is, callers must ignore a 500 and re-query `/api/documents` to see
what actually happened.

---

## 3. Rate limiting / throughput

- **No Ollama 429s / rate-limiting observed.** During ingest, embedding
  calls logged `POST http://host.docker.internal:11434/api/embeddings
  "HTTP/1.1 200 OK"` consistently. The stalls in §2.2 were DB-session bugs,
  not throttling.
- **Shared-Ollama contention is the real risk, not HTTP rate limits.** This
  box runs one Ollama serving: this instance, the pre-existing
  `rag-bootstrap` instance, and researchhub (incl. a 70B model). All
  embedding + generation funnels through one endpoint. There is no
  client-side concurrency cap, batching, or backoff visible in the
  embedding path, and `config.yaml` already carries a telling comment
  ("If you experience Ollama timeouts during ingestion, try reducing
  chunk_size... BluePlan found 150/30 worked reliably") — i.e. Ollama
  saturation during ingest is a known, recurring pain.

**Suggestions:**
- Add configurable embedding **concurrency** + **retry with backoff** on
  timeouts/5xx, so a busy shared Ollama degrades gracefully instead of
  failing chunks.
- Use Ollama's **batch embeddings** where possible to cut request count.
- Document the shared-Ollama contention model and recommend a dedicated
  embedding model/endpoint (or a queue) when multiple instances coexist.

---

## 4. Broader improvement ideas / future-useful

1. **Ship an MCP server for agent access.** `app/mcp_server.py` already
   exists — promote it. Agents querying via MCP (rather than hand-rolled
   `curl` to `/api/search`) is cleaner, and it lines up with where
   agent-orchestration is heading (MCP as the standard tool seam). Pair with
   the consumer-side asks in the researchhub file (a shipped query-hint
   header, an index-freshness endpoint, a cite-back schema).
2. **`GET /health/index` freshness endpoint** (echoing the researchhub
   file): `{indexed_at, chunks, documents, corpus_bytes, source_root,
   staleness_class}` so agents know whether to trust the index vs grep.
3. **Idempotent, resumable ingest** (from §2.2): skip-by-hash + rollback +
   async job status = re-runnable ingest that survives partial failure. This
   single change would have removed most of my pain.
4. **Config single-source-of-truth + validation** (§1.1/1.2): one file,
   echoed effective config, hard error on missing/invalid.
5. **True instance isolation out of the box** (§1.3): `project_name` should
   fully namespace containers, network, and volumes with no hand-editing.
6. **Preflight doctor**: `deploy.sh doctor` that checks port free, Ollama
   reachable + required models pulled (`nomic-embed-text` present?), disk
   space, and prints the resolved config — before building anything. I
   manually did every one of these checks; bundling them would be a great DX.
7. **Scope guards for ingestion**: default-exclude `.git/`, `node_modules/`,
   `data/`, and `*.pdf`, and honor include/exclude globs, so pointing at a
   whole repo "just works" without dragging in binaries/corpora.
8. **Health check should assert retrieval**, not just liveness: a
   `/api/health?deep=1` that embeds a fixed string and does a 1-NN lookup,
   proving the embedding + vector path end-to-end.

---

## Appendix: minimal changes I had to make to run a 2nd instance

For reference, the manual edits the template forced (each maps to a
suggestion above):
- Copy `config/config.yaml` → `./config.yaml` (§1.1) and set
  `project_name/network.name=docs-rag`, `port=8181`, `llm.model=llama3.2:3b`,
  `embedding=nomic-embed-text/768/ollama`.
- Rename all five `container_name: rag-bootstrap-*` → `docs-rag-*` (§1.3).
- Add a read-only same-path repo mount to the `api` service (§2.5):
  `- /home/devel/llm-project-bootstrap:/home/devel/llm-project-bootstrap:ro`.
- Bypass nginx and call `api:8000` directly for the large ingest (§2.3).
- Wipe root-owned `./data` via a root container between the bad and good
  runs (§1.6/§1.7).

# Multi-KB Design Groundwork — Option B Gateway Blueprint (2026-07-03)

**Status: DESIGN ONLY — nothing here is implemented.** User direction (2026-07-03): core
single-corpus bootstrap first; multi-KB is a later workstream. This doc exists so the future
planning wave can skip straight to zone assignment.

Companion (current-state facts): `docs/findings/2026-07-03_multikb_query_semantics_verdict.md`.
Architecture vision: `docs/reference/MODULARITY_DESIGN.md` (Phases 2-4 unchecked).

---

## 1. Decision summary

| Decision | Choice | Why |
|---|---|---|
| Approach | **Option B — gateway** (mount `api_v2`, per-KB engines, one deployment serves N KBs) | Realizes the existing `docker-compose.multi-kb.yml` intent; ~70% of plumbing already exists as dead code |
| Cross-KB ranking (MVP) | **Semantic-first**: merge on raw cosine | All KBs share ONE embedding space (nomic-embed-text/768, enforced by the rag_meta dim guard) → cosine is directly comparable across KBs; zero calibration needed |
| Cross-KB ranking (phase 2) | **Global RRF across per-KB ranked lists** | Rank-based, calibration-free; handles hybrid/keyword whose per-KB scores (RRF, ts_rank) are not cross-comparable. Same pattern researchhub specs for its global RAG |
| ID namespacing | **Additive `kb` field** on results; citation `[[RAG:{kb}:{path}#{chunk}@{score}]]` | chunk/document ids autoincrement per-DB and WILL collide; `api_v2` has zero consumers today so the field is free to add; v1 single-corpus responses unchanged |
| Collaboration model | **workspace == KB** (researchhub mapping) | A project queries its own KB by default; opts into `kb=[subset]` / `kb="all"` for cross-project answers. READ all / WRITE own |
| Ingest (MVP) | **Per-KB env-scoped ingest runs** (no gateway write path) | Zero new code; gateway is query-only in MVP |
| Backward compat | Single-corpus deploys unaffected | `/api/search` + `/api/v1/search` untouched; `/api/v2/*` returns 503 "multi-KB not configured" when no `knowledge_bases` config |

---

## 2. Current-state anchors (verified 2026-07-03)

- `app/api_v2.py:114` — `router = APIRouter(prefix="/api/v2")`; `POST /api/v2/search` at 117-183
  already implements `kb="all"|"name"|["a","b"]|None`; `initialize_api()` at 320-341. **Never
  mounted** — no `include_router` anywhere in `app/`.
- `app/registry.py:147-160` — `_create_postgres_kb` imports and reuses the ONE shared
  `app.database.engine` for every KB. This is the core blocker: no per-KB connection path.
- `app/search_pipeline.py:273-295` — `_merge_results` = dedupe by content hash + sort on
  `.score` (unsound for hybrid/keyword cross-KB).
- `app/config.py:18-22` — single `POSTGRES_*` settings only; `extra: "ignore"` (line 70) silently
  drops the `PRIMARY_DB_*`/`ATC_DB_*`/`RESEARCH_DB_*` vars the multi-kb compose injects.
- `app/config_manager.py:147-157` — `get_knowledge_bases()` / `get_router_config()` already parse
  a `knowledge_bases:`/`router:` YAML section (live `config/config.yaml` has neither). The
  ConfigManager is already instantiated in the lifespan (`app/main.py:114`).
- `app/main.py:86-163` — lifespan (wiring point); `app = FastAPI(...)` at 166; single-corpus
  `/api/search` at 715.
- `app/postgres_kb.py:35-53` — `PostgresKB.__init__` already accepts an injected engine +
  session maker; `search()` at 128-185 delegates to `app.search` functions (engine-agnostic,
  session passed in) so per-KB sessions Just Work.
- `app/search.py:12-35` — `SearchResult` dataclass (no KB attribution today).
- `client/fallback_policy.py:43` — `SEARCH_PATHS = ("/api/v1/search", "/api/search")`; `search()`
  at 154-212; `format_citation()` at 215-223. `client/ragq.py:57-106` — argparse surface.
- `docker-compose.multi-kb.yml:154-227` — api service; per-KB env at 167-212; healthcheck at 222
  targets the unmounted `/api/v2/health`; stale config mount at 216 (`./config.yaml` — moved to
  `config/config.yaml` in the 2026-07-03 overhaul).
- `app/Dockerfile.multi-kb` — **latent bug**: `WORKDIR /app; COPY . .; CMD uvicorn main:app`
  breaks the package-relative imports (`from .config import ...`). The main `app/Dockerfile`
  copies into `/src/app/` and runs `uvicorn app.main:app`. Must be aligned.
- Existing tests to extend: `tests/test_api_v2_2026_06_14.py`, `tests/test_search_pipeline_2026_06_14.py`,
  `tests/test_kb.py`, `tests/test_router.py`, `tests/test_postgres_kb_2026_06_14.py`.

---

## 3. Target architecture (Option B)

```
                 ┌────────────────────────────────────────────────┐
 ragq --kb atc → │ nginx :${RAG_PORT} → uvicorn app.main:app      │
                 │  ├─ /api/search, /api/v1/* (v1, UNCHANGED —    │
                 │  │    single-corpus contract, primary engine)  │
                 │  └─ /api/v2/*  (multi-KB gateway, NEW-mounted) │
                 │      SearchPipeline ── KnowledgeRegistry       │
                 │        │                 ├─ PostgresKB "primary" ──> postgres-primary
                 │        │ (shared         ├─ PostgresKB "atc"     ──> postgres-atc
                 │        │  EmbeddingService)└ PostgresKB "research"─> postgres-research
                 │        └ Router (kb=None → StaticRouter default)   (per-KB engines)
                 └────────────────────────────────────────────────┘
```

One query embedding is computed once (shared Ollama/nomic space) and fanned out; per-KB results
are stamped with `kb=<name>` and merged.

---

## 4. Design details

### 4.1 KB declaration (config surface)

Source of truth: `knowledge_bases:` section in `config/config.yaml` (multi-KB variant), which
`ConfigManager` already parses. Connection details resolve per-KB with env override, matching
what the compose file ALREADY injects:

```yaml
mode: multi-rag
knowledge_bases:
  primary:  { type: postgres, env_prefix: PRIMARY_DB }   # PRIMARY_DB_HOST/PORT/NAME/USER/PASSWORD
  atc:      { type: postgres, env_prefix: ATC_DB }
  research: { type: postgres, env_prefix: RESEARCH_DB }
router:
  type: static
  static: { default: primary }
```

New method `ConfigManager.get_kb_connection(name) -> dict` (in `app/config_manager.py`, after
`get_knowledge_bases` at 147-153): merges the YAML entry with `<ENV_PREFIX>_HOST/PORT/NAME/USER/
PASSWORD` env vars and returns `{"dsn": "postgresql+asyncpg://..."}`. `app/config.py` stays
untouched (its `extra: "ignore"` is then harmless — per-KB vars are read via `os.environ`, not
pydantic). Multi-KB mode is ON iff `get_knowledge_bases()` is non-empty.

### 4.2 Per-KB engines (`app/registry.py:147-160`)

`_create_postgres_kb` changes: when `config` carries a `dsn`, build a DEDICATED
`create_async_engine(dsn, pool_size=5, max_overflow=5)` + `async_sessionmaker` for that KB;
fall back to the shared `app.database.engine` only when no dsn given (preserves current test
behavior). Rules:

- **Every configured KB gets its OWN engine — including "primary"** (even though its DSN may
  equal the legacy one). Rationale: `PostgresKB.shutdown()` (`app/postgres_kb.py:239-242`)
  disposes its engine; `registry.shutdown_all()` must never dispose the shared v1 engine.
- `PostgresKB.initialize()` (`postgres_kb.py:55-67`) already does `create_all` + pgvector
  extension per engine — creation-time schema per KB is free.
- Wire the shared `EmbeddingService` into each KB's config (`embedding_service` key, already
  read at `registry.py:157`). Needed because `PostgresKB.search` (`postgres_kb.py:147-151`)
  refuses SEMANTIC when `self.embedding_service` is falsy even if the vector is passed in.
- Per-KB dim guard (mirror of `app/main.py:52-83`): at registry init, read `rag_meta` per KB and
  hard-fail on dimension mismatch — the cross-KB cosine merge is only sound in one space.
  (Cheap: reuse `get_meta` with the KB's session.)

### 4.3 Gateway mount + lifespan wiring (`app/main.py`, `app/api_v2.py`)

- `app/main.py` module level (after line 166): `app.include_router(api_v2.router)` —
  **unconditional mount** (routes are cheap; behavior gated on initialization).
- `app/main.py` lifespan (insert after embedding service, ~line 100): if
  `config_manager.get_config().get_knowledge_bases()` is non-empty → build `KnowledgeRegistry`,
  `await registry.create(name, type, {"dsn": ..., "embedding_service": embedding_service})` per
  KB, then `await initialize_api(registry, embedding_service)` (`api_v2.py:320-341`). Store on
  `app.state.kb_registry`. Shutdown: `await registry.shutdown_all()` before `engine.dispose()`
  (main.py:161-162). NOTE: ConfigManager is created at main.py:114, AFTER the embedding
  service — the insert point is after 115, or hoist the ConfigManager creation.
- `app/api_v2.py:93-104` — `get_registry`/`get_pipeline` change 500 → **503
  "multi-KB not configured"** so single-corpus deploys give a truthful, probe-friendly signal.
- `initialize_api` router selection: honor `router:` config — `static` with `default:` for
  `kb=None` (MVP default = route to `primary`); `broadcast` remains available; `LLMRouter`
  deferred.

### 4.4 Score normalization for cross-KB merge (`app/search_pipeline.py`)

**MVP — semantic-first.** For any multi-KB request (`kb="all"` / `kb=[list]` / routed to >1 KB):

- Execute per-KB search in **semantic** mode (regardless of requested mode; respond with an
  advisory `mode_used` field, or reject `mode!=semantic` for multi-KB with 400 — pick at impl
  time; recommendation: **force semantic + advisory field**, simplest honest behavior).
- Merge on raw `cosine` (== `score` in semantic mode, `app/search.py:106-118`) descending;
  existing content-hash dedupe kept. Single-KB requests (`kb="name"`) keep all three modes —
  no merge needed.
- Change lives in `_merge_results` (`search_pipeline.py:273-295`) + a mode-coercion guard at the
  top of `search_all`/`search`/the `kb=[list]` branch in `api_v2.py:149-160`.

**Phase 2 — hybrid via global RRF.** Treat each KB's own ranked list (any mode) as one leg of a
cross-KB Reciprocal Rank Fusion (`1/(k+rank)`, k=60 — same constants as `app/search.py:169-214`).
Rank-based fusion needs no score calibration, which is exactly why per-KB RRF/ts_rank scores
being incomparable stops mattering. This mirrors researchhub's spec (per-workspace hybrid →
global RRF merge; `~/researchhub/docs/features/CROSS_WORKSPACE_RAG.md` §"Complete Ranking
Pipeline"). Optional later: workspace priority boosting (researchhub uses 1.3x current /
1.2x own / 1.0 baseline) — deferred, needs a "current KB" request field.

### 4.5 Chunk/document ID namespacing

- `app/search.py:12-35` — add `kb: str | None = None` to `SearchResult` (additive; v1 callers
  and tests unaffected — dataclass default).
- `app/search_pipeline.py` — stamp `r.kb = kb.name` in `_search_kb` (single point, lines
  215-271) right after retrieval.
- `app/api_v2.py:46-56` — add `kb: str` to `SearchResponse`; keep numeric `chunk_id`/
  `document_id` AS-IS (they stay meaningful within their KB; uniqueness across KBs comes from
  the `(kb, chunk_id)` pair). No consumers exist for v2, so this is free.
- Citation format: `[[RAG:{kb}:{path}#{chunk_index}@{score}]]` when `kb` is present, else the
  existing `[[RAG:{path}#{chunk_index}@{score}]]` (`client/fallback_policy.py:215-223`).
  Namespacing at the citation layer is what prevents cross-KB collisions from ever reaching a
  consumer.
- v1 responses (`app/main.py:234-249` `SearchResultSchema`): untouched in MVP.

### 4.6 Ingest path (MVP: no gateway writes)

The gateway is **query-only** in MVP. Populating `atc`/`research` DBs = run the existing ingest
flow env-pointed at that KB's postgres (e.g. `RAG_ENV_FILE`/`POSTGRES_HOST=postgres-atc` +
existing `/api/ingest` or scripts) — zero new code. Known gap for later:
`PostgresKB.ingest` (`postgres_kb.py:79-126`) does a plain insert with no
`ON CONFLICT (content_hash)` dedupe (unlike `app/database.py:184-224`) — must be fixed before
any gateway write path ships. `POST /api/v2/knowledge-bases/{name}/{kb_type}` runtime creation
stays but is honest only for `keyword-only`; dynamic postgres provisioning deferred.

---

## 5. researchhub collaboration mapping (concepts, surveyed 2026-07-03)

Source (authorized read-only survey): `/home/devel/researchhub/` — workspace model +
cross-workspace RAG design. Concepts extracted, not code:

**Their entities.** A *workspace* == one research project == one notebook
(`docs/scope.md` §"Workspace-Centric Organization"): folder `workspaces/{name}/` + metadata
(uuid `id`, `display_name`, `topic`, `tags`, lifecycle `active|paused|completed|archived` —
`research_operations/workspace_models.py`, `workspace_api/models.py`). Papers/notes/questions
live in per-workspace SQLite; workspace RAG embeddings live in ONE shared Postgres with a
`workspace_id` column (`database_schema.py:696-720`, `workspace_embeddings` table) — i.e.
logical namespacing in a shared store, where rag-bootstrap Option B namespaces by physical DB.

**Their sharing semantics** (B78, `docs/findings/cross-workspace-rag.md` + spec
`docs/features/CROSS_WORKSPACE_RAG.md`):

- **READ all, WRITE own** — each workspace writes only its own embedding scope; every workspace
  can read all others via a global endpoint. No cross-write, ever.
- Two query surfaces: `/api/rag/query` (own workspace, default) and `/api/rag/query/global`
  (all accessible workspaces, with `include_workspaces` / `exclude_workspaces` lists).
- **Result attribution is mandatory** — every cross-workspace hit carries workspace id/name.
- **RAG-first research**: before an external (web/academic) search, query the global RAG; if
  ≥N chunks over a similarity threshold exist in ANY workspace, skip the external search —
  cross-project knowledge answering another project's question is the headline use-case.
- Duplication is *minimized, not forbidden* — the same doc may live in several workspaces.
- Merging: per-workspace hybrid → global RRF; optional priority boost for the asking workspace.

**Mapping onto rag-bootstrap Option B:**

| researchhub concept | rag-bootstrap realization |
|---|---|
| workspace (project) | **KB** (named entry in `knowledge_bases:`, own postgres) |
| workspace-scoped query (default) | project's client config sets `kb=<own>` (or keeps using its v1 single-corpus stack) |
| global query, include/exclude lists | `POST /api/v2/search` `kb="all"` / `kb=["a","b"]` |
| READ all / WRITE own | gateway is query-only; ingest is per-KB env-scoped (§4.6). Enforced by deployment shape, not authn (auth is BLOCKED for this project and unnecessary: single-user, multi-project) |
| result attribution (workspace_id) | `kb` field on every v2 hit + `[[RAG:{kb}:{path}#...]]` citation |
| RRF cross-workspace merge | phase-2 global RRF (§4.4); MVP semantic-cosine merge is strictly simpler because rag-bootstrap guarantees ONE embedding space (researchhub couldn't assume that) |
| priority boosting (1.3x current ws) | deferred; would ride on a `current_kb` request field |
| RAG-first escalation | client-side pattern: query `kb=<own>` → if thin, retry `kb="all"`; document in the consuming-agents contract; optional `ragq --kb-escalate` later |
| workspace lifecycle (archive etc.) | out of scope; nearest analog = removing the KB from config (registry has create/delete already) |

---

## 6. Client story (`ragq --kb`)

- `client/fallback_policy.py`: add `kb: str | list[str] | None = None` kwarg to `search()`
  (154-212). `kb=None` → today's exact behavior (v1 paths, no change). `kb` set → POST
  `/api/v2/search` with `{"query","mode","limit","kb"}`; on 404/405 raise `RagRequestError`
  with "server has no multi-KB gateway (kb= requires a multi-KB deployment)" — **no silent
  fallthrough** to v1 (wrong-scope results are worse than an error). Same retry policy object.
- `format_citation()` (215-223): prefix `{kb}:` when the hit has a non-empty `kb` field.
- `client/ragq.py`: `--kb NAME[,NAME...]` flag (`all` accepted) in `_build_parser()` (57-106),
  threaded through `main()` → `search()` (150-157). Help text mirrors `--corpus` style.
  `--corpus` continues to mean filepath-prefix WITHIN a corpus; the two compose
  (server-side `corpus` filter applies per-KB — note: v2 SearchRequest at `api_v2.py:27-43`
  lacks the `corpus` field today; adding it is a small, optional MVP extra).
- MCP (`app/mcp_server.py`, `rag_search` tool ~85-100) and frontend KB selector: **deferred**.
- `CONSUMING_AGENTS_CONTRACT.md` §8 currently states "One stack instance = one corpus" — the
  ship PR must amend §8 with the kb-selection semantics + extended citation grammar.

---

## 7. Work packages — disjoint edit zones for a future dev fleet

Zones are disjoint by file. Interface freeze (agree BEFORE spawning, enables full parallelism):
1. `SearchResult.kb: str | None = None` (field name `kb`), 2. `SearchResponse.kb: str`,
3. registry KB config dict keys `{dsn, embedding_service}`, 4.
`ConfigManager.get_kb_connection(name) -> {"dsn": str}`, 5. v2 request/response JSON as in
`api_v2.py` today + `kb` response field, 6. 503 for uninitialized, 7. citation grammar
`[[RAG:{kb}:{path}#{chunk}@{score}]]`.

| Zone | Files (edit) | Anchors | Work | Est |
|---|---|---|---|---|
| **Z1 config+registry** | `app/config_manager.py`, `app/registry.py` | cm.py:147-153 (add `get_kb_connection` after), reg.py:147-160 | env_prefix→DSN resolution; per-KB engine/sessionmaker; per-KB dim guard (§4.2) | ~120 LOC |
| **Z2 search core** | `app/search.py`, `app/search_pipeline.py` | search.py:12-35; pipeline 215-271 (stamp kb), 273-295 (merge) | `SearchResult.kb`; semantic-first merge + mode coercion; (phase-2 RRF later, same file) | ~80 LOC |
| **Z3 gateway** | `app/main.py`, `app/api_v2.py` | main.py:~115 (lifespan), 161-162 (shutdown), after 166 (mount); api_v2.py:46-56, 93-104, 149-160, 320-341 | mount; conditional init from config; 503s; `kb` in response; router-config honor | ~90 LOC |
| **Z4 deploy** | `docker-compose.multi-kb.yml`, `app/Dockerfile.multi-kb`, `config/config.multi-kb.yaml.example` (new), `.env.example` | compose 216 (config mount + `RAG_CONFIG_FILE`), 222 (healthcheck now real); Dockerfile CMD/`WORKDIR` fix (§2 latent bug — align to `app/Dockerfile` `/src` + `app.main:app`) | compose/env plumbing; example multi-KB config | ~60 LOC |
| **Z5 client** | `client/fallback_policy.py`, `client/ragq.py` | fp.py:43, 154-212, 215-223; ragq.py:57-106, 150-157 | `kb=` kwarg, v2 path, no-fallthrough error, citation prefix, `--kb` flag | ~70 LOC |
| **Z6 tests+contract** | `tests/test_api_v2_2026_06_14.py`, `tests/test_search_pipeline_2026_06_14.py`, `tests/test_kb.py`, `tests/test_router.py`, `CONSUMING_AGENTS_CONTRACT.md`, `docs/reference/MODULARITY_DESIGN.md` | — | extend EXISTING suites (mock engines; no docker needed); contract §8 amendment; tick MODULARITY phases | ~150 LOC |

Dependencies: Z1..Z5 fully parallel under the interface freeze; Z6 last (or parallel with
frozen interfaces, verified last). One integration smoke at the end (single agent): bring up
`docker-compose.multi-kb.yml`, ingest 1 doc per KB env-scoped, run the acceptance list below.
Fleet size: 6 zone agents + 1 integrator ≈ one small wave.

---

## 8. Acceptance criteria

MVP is DONE when, on a `docker-compose.multi-kb.yml` deployment:

1. `docker compose -f docker-compose.multi-kb.yml config` is valid; the api container starts
   (Dockerfile import-mode bug fixed) and its compose healthcheck (`/api/v2/health`) goes
   healthy, reporting all 3 KBs.
2. `GET /api/v2/knowledge-bases` lists `primary`, `atc`, `research` with `type=postgres`.
3. After ingesting a distinct marker doc into each KB (env-scoped ingest): `POST /api/v2/search
   {"kb":"atc", ...}` returns ONLY the atc marker; same for the other two (per-KB engine
   isolation proven).
4. `kb=["primary","research"]` returns hits from both, each hit carrying its `kb`, ordered by
   cosine descending; `kb="all"` covers all three; `kb=null` routes to the configured default.
5. Multi-KB requests are semantic-scored (coerced or 400 per §4.4 choice); single-KB requests
   support all three modes.
6. No cross-KB citation ambiguity: every v2 hit formats to `[[RAG:{kb}:{path}#{chunk}@{score}]]`.
7. `ragq --kb atc "q"` works against the gateway; `ragq --kb atc` against a plain single-corpus
   stack exits 1 with the "no multi-KB gateway" message; `ragq` WITHOUT `--kb` is byte-identical
   in behavior to today against both stack types.
8. Regression: on the ordinary `docker-compose.yml` stack, `/api/search` / `/api/v1/search`
   responses are unchanged and `/api/v2/search` returns 503 with a clear detail.
9. A KB whose `rag_meta.dimension` mismatches the configured dimension fails registry init with
   an actionable error (per-KB dim guard).
10. Existing test suites (`test_api_v2*`, `test_search_pipeline*`, `test_kb`, `test_router`)
    pass with the new behavior covered.

---

## 9. Minimum-viable cut vs deferred

**MVP (the 6 zones above):** gateway mounted + per-KB engines + `kb=name|list|all|null(routed
to default)` + semantic-first merge + `kb` attribution/citations + real compose healthcheck +
`ragq --kb`. Query-only; ingest per-KB env-scoped.

**Deferred (explicitly out of MVP):**
- Phase-2 global RRF for hybrid/keyword cross-KB merge (design pinned in §4.4; same files as Z2).
- LLM/hybrid routing (`LLMRouter` exists at `app/router.py:175`; static default suffices).
- Gateway write path (`/api/v2/ingest?kb=` — blocked on `PostgresKB.ingest` dedupe gap, §4.6).
- Dynamic postgres KB provisioning at runtime; KB lifecycle (archive) semantics.
- Priority boosting (researchhub 1.3x current-workspace pattern) + `current_kb` request field.
- RAG-first client escalation policy / `--kb-escalate`; MCP `kb` param; frontend KB selector.
- `corpus` filepath filter on v2 (small; do opportunistically if Z3 has slack).
- Option A (client-side fan-out over N single stacks) — superseded by Option B unless a
  cross-HOST federation need appears; keep the verdict doc's sketch on file.

**Known gaps/risks to carry into planning:** Dockerfile.multi-kb import bug (Z4, must-fix);
`PostgresKB.ingest` no-dedupe (blocks the deferred write path only); the multi-kb compose nginx
frontend proxies `/api/*` — verify `/api/v2/*` passes through (frontend/ is Z4-adjacent,
read-check only); resource footprint — 3 postgres containers + api is modest, but probe against
the 80% resource ceiling before the integration smoke (host disk hit 100% on 2026-07-03).

---

## 10. Roadmap-bound text (for merge by the roadmap owner — do NOT edit docs/roadmap.md here)

Replace the unchecked `docs/roadmap.md:102` line "Multi-corpus federation (tagged corpora,
interleaved results, per-corpus citation)" with:

```markdown
- [ ] Multi-KB federation (Option B gateway): mount api_v2, per-KB engines, kb=name|list|all,
      semantic-first cross-KB merge, kb-namespaced citations. Blueprint with zone assignments:
      docs/findings/2026-07-03_multikb_design_groundwork.md (workspace==KB collaboration model;
      DEFERRED until core single-corpus bootstrap is solid per 2026-07-03 user direction)
```

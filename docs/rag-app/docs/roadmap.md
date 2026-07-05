# RAG Bootstrap — Roadmap

## FROZEN-PROJECT POLICY (load-bearing — do not delete)

> Adopted: W67 (2026-06-04). Reaffirmed: 2026-06-14.
> Source authority: MEMORY.md (`feedback_frozen_projects`) + user instructions across W67-W74 mega-arc.
> 2026-07-03: user-authorized overhaul pass (Ollama default, port base 10000, path
> portability, async ingest, docs taxonomy) supersedes the freeze for this scope;
> see `docs/findings/2026-07-03_rag_bootstrap_execution_plan.md`.

Two sub-projects in this monorepo are **FROZEN** and must NOT be touched by any agent or session for any reason short of an explicit, in-conversation user override that names the project by name:

- `rag-bootstrap/`  — STABLE, the only sub-project the user wants "perfectly stable and left alone"
- `production-atc-app/`  — STABLE, "just does not need to be touched at all"

What "frozen" means in practice:

- No edits to source files, tests, configs, scripts, or pyproject
- No edits to docs/, README.md, DEPLOY.md, or any other docs file EXCEPT this frozen-policy block itself
- No new files created inside these directories
- No deletions, renames, or moves involving these directories
- No commits that include any file under these paths
- No `pip install` / venv mutation inside these projects
- No HPC jobs that read or write files under these paths
- No test runs that import code from these projects
- Workflow agents must list both paths in their READ_ONLY / BLOCKED zone every time they are spawned

How to know you are about to violate this rule:

- A file path you are about to Edit/Write/Bash-touch starts with `/home/devel/exudeai/rag-bootstrap/` or `/home/devel/exudeai/production-atc-app/` → STOP
- A planning doc instructs you to "refresh docs across all projects" → frozen projects are excluded by default
- A grep / find / sweep returns matches inside these paths → filter them out before acting
- A workflow spec omits the frozen list from RULES → reject the spec, ask for confirmation

How to override (rare):

- User must explicitly name the project (`rag-bootstrap` or `production-atc-app`) in the same message that authorizes the touch
- A general "do everything" or "update all projects" does NOT override this rule
- This block itself is the ONLY exception that may be edited without an override (because keeping it accurate strengthens the rule)

Why the rule exists:

- `rag-bootstrap` is the user-facing RAG system; stability is more valuable than any improvement we might land
- `production-atc-app` is launch-gated by a security cluster (WP-K); any drift complicates the security review
- W67 retrospective documents the original adoption decision: see `docs/archives/session_records/2026-06-14_w47_to_w74_mega_arc_retrospective.md`

> No time estimates. Items are ordered by priority within each tier.

### Short-term (Current)

- [x] Docker Compose (PostgreSQL+pgvector, Redis, FastAPI)
- [x] Document ingestion pipeline (PDF, MD, TXT, LOG, JSON, YAML)
- [x] Search API (semantic, keyword, hybrid)
- [x] MCP server (search, ingest, list, get)
- [x] bootstrap.sh
- [x] Integration guide
- [x] LLM model config (llama3.2:3b default)
- [x] Web dashboard for Q&A (ChatGPT-inspired UI)
- [x] Document sidebar with scrollable file tree
- [x] Comprehensive deploy.sh script (start/stop/ingest)
- [x] YAML-based configuration (config.yaml)
- [x] Docker network with auto-naming
- [ ] Comprehensive test suite
- [ ] Test with live Docker deployment

### Midterm

- [x] Streaming responses (SSE-based, with latency metrics)
- [x] Auto-ingest watcher (inotify + polling fallback, archive system)
- [ ] Document update/re-ingestion (detect changes via content_hash)
- [ ] Batch ingestion progress tracking (WebSocket or SSE)
- [ ] Health dashboard

### Long-term

- [ ] Multiple embedding model hot-swap
- [ ] Document versioning
- [ ] Advanced chunking strategies (semantic, document-structure-aware)
- [ ] Reranking (cross-encoder)
- [ ] Graph RAG support
- [ ] Export/import knowledge base

### Deferred backlog (2026-07-03 pass)

Items triaged from the four archived suggestions files
(`archive/session_records/{RAG_BOOTSTRAP_ISSUES_AND_SUGGESTIONS,SUGGESTIONS,SUGGESTIONS_FROM_DOCS_RAG_DEPLOYMENT_2026-07-03,SUGGESTIONS_FROM_RESEARCHHUB_2026-06-23}.md`;
triage: `findings/audits/2026-07-03_root_suggestions_triage_audit.md`) and
explicitly deferred — everything else in those files shipped in the
2026-07-03 stabilization pass (see each file's DISPOSITION header):

- [ ] Symbol-aware chunking for code files (`.py`/`.js`/`.go` — chunk at function/class boundaries, opt-in; prose path unchanged)
- [ ] Setup wizard (`./deploy.sh init`-style prompts: port validation, model check, docs path → writes config.yaml)
- [ ] Backup/restore (`./deploy.sh backup` / `restore <tar.gz>` for the ingested corpus + vectors)
- [ ] `/stats` operator dashboard endpoint (index size, last-ingest, query rate, top queries)
- [ ] Multi-embedding-model support (primary + fallback stanza; hot-swap ties into the Long-term item above)
- [ ] Streaming/batched ingestion memory bounds for very large corpora (100k+ chunks)
- [ ] Parallel watcher ingest workers (watcher queue is single-worker; directory ingest already concurrent)
- [ ] Quickstart config examples (pre-baked `quickstart-*.yaml` variants)
- [ ] Estimated vector-DB size warning at ingest time (doctor already checks free disk)
- [ ] Instance registry / `ls` command (which instance serves which project on which port)
- [ ] `install-for-project.sh <name>` (corpus dir + registry + printed env vars + CLAUDE.md snippet)
- [ ] Orchestra context snippet for palletai (`orchestra/context_snippet.md` — out-of-tree coupling)
- [ ] Diff-context lookups (path-match-first retrieval before similarity fallthrough)
- [ ] CLAUDE.md-aware ranking boosts for consumer-canonical paths
- [ ] Multi-KB federation (Option B gateway): mount api_v2, per-KB engines, kb=name|list|all,
      semantic-first cross-KB merge, kb-namespaced citations. Blueprint with zone assignments:
      docs/findings/2026-07-03_multikb_design_groundwork.md (workspace==KB collaboration model;
      DEFERRED until core single-corpus bootstrap is solid per 2026-07-03 user direction)
- [ ] `full_doc_url` convenience field on chunk hits
- [ ] Watcher-first ingests store container-path citations (defeats same-path DOCS_PATH citation design; live-smoke finding 3, acceptance F4) — fix by watching the DOCS_PATH same-path mount or normalizing stored paths to host form; mitigations documented in UPGRADE guide + TROUBLESHOOTING

### Completed

Completed on 2026-01-27:
- [x] Docker Compose infrastructure
- [x] Document ingestion pipeline (6 file types)
- [x] Search API (3 modes: semantic, keyword, hybrid)
- [x] MCP server (4 tools)
- [x] bootstrap.sh (one-command deploy)
- [x] Integration guide
- [x] LLM model config (llama3.1:70b default)

Completed on 2026-01-28:
- [x] Web dashboard (ChatGPT-inspired chat UI)
- [x] Document sidebar with scrollable VS Code-styled file tree
- [x] Copy buttons (per-message and copy-all)
- [x] Search mode toggles (hybrid/semantic/keyword)
- [x] Comprehensive deploy.sh (start/stop/ingest/status/logs/health)
- [x] config.yaml for configuration
- [x] Docker network with auto-increment naming
- [x] Nginx reverse proxy (single port exposure)

Completed on 2026-05-11 (Enhancement Release):
- [x] **Enhancement #1: Streaming Responses for LLM Generation**
  - Server-Sent Events (SSE) streaming endpoints
  - Latency metrics (time to first token, total latency, search latency)
  - Streaming endpoint: `POST /api/ask/stream` (RAG-augmented)
  - Streaming endpoint: `POST /api/v3/chat/{session_id}/stream` (session-based)
  - Example client: `docs/benchmarking/streaming_client_example.py`
  - Performance benchmarks included

- [x] **Enhancement #2: Auto-Ingest Watcher**
  - Linux inotify-based file monitoring
  - Polling fallback for other systems
  - Automatic document detection and ingestion
  - Archive system for processed files
  - Exponential backoff retry logic (3 attempts)
  - REST API status: `GET /api/watcher/status`
  - Docker Compose configuration with environment variables
  - Example client: `docs/benchmarking/watcher_example.py`
  - Full documentation in docs/reference/ARCHITECTURE.md

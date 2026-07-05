# RAG Bootstrap — TODO

## Completed Phases

### 2026-07-03: Stabilization pass — docs workstream (WS-DOCS) — COMPLETE
- [x] README updated to the RAG_PORT_BASE=10000 port scheme (offset table; zero stale 8100 refs)
- [x] README documents new endpoints: async ingest (202 + `GET /api/ingest/status/{job_id}`), `GET /api/status`, `GET /health/index`, additive `/api/v1/*` aliases
- [x] README documents Ollama-only embedding default (nomic-embed-text/768) as a hard prerequisite + `./deploy.sh doctor`
- [x] README documents new knobs: `DOCS_PATH`, `RAG_INGEST_ROOT_GUARD`, `WATCHER_ARCHIVE_MODE`
- [x] Created `TROUBLESHOOTING.md` (Ollama, ports, dim guard/reset, ghost containers, isolation, multi-stack)
- [x] Created `PERFORMANCE.md` (embedding concurrency/retry, chunking, ingest throughput, monitoring)
- [x] Four root suggestions files dispositioned (DISPOSITION headers) and archived to `archive/session_records/`
- [x] Deferred items rolled into roadmap.md "Deferred backlog (2026-07-03 pass)"

### Phase B: RAG Streaming & Auto-Ingest Validation — COMPLETE
- [x] Comprehensive unit tests for streaming (7 tests)
- [x] Comprehensive unit tests for watcher (22 tests)
- [x] All 40 tests passing (100% success rate)
- [x] Performance validation completed
- [x] Docker integration verified
- [x] Production readiness checklist passed
- [x] Validation report generated (RAG_VALIDATION_REPORT_2026_05_07.md)

### Phase A: RAG Streaming & Auto-Ingest — COMPLETE
- [x] SSE Streaming endpoint `/api/ask/stream`
- [x] LLM streaming methods (`generate_stream`, `ask_with_context_stream`)
- [x] Frontend SSE client with event parsing
- [x] Real-time token display with counter
- [x] DocumentWatcher with inotify support
- [x] Auto-ingest queue and retry logic
- [x] File archival to `/data/docs/archive/`
- [x] Watcher status endpoint
- [x] Integration documentation

### Phase 1: Knowledge Base Abstraction — COMPLETE
- [x] Design KB abstraction layer (kb.py)
- [x] Implement PostgreSQL KB backend (postgres_kb.py)
- [x] Implement Keyword-Only KB backend (keyword_only_kb.py)
- [x] Create Knowledge Base Registry (registry.py)
- [x] Update search functions to accept embedding vectors
- [x] Write comprehensive test suite (40+ tests in test_kb.py)
- [x] Document architecture and extension points

## Current Work (May 8-31, 2026)

### Extraction Archive & RAG Integration
- [x] Archive Phase C extraction results (304 QA pairs from PCG)
- [x] Document extraction metrics and quality reports
- [x] Create `EXTRACTION_SUMMARY_2026_05_31.md` (comprehensive archive)
- [x] Prepare Phase 4A curriculum learning inputs
- [x] Update RAG documentation with latest status
- [x] Create `integration/RAG_PRODUCTION_API.md` (complete API documentation)
- [ ] Phase 4A: Execute 4 curriculum variants (May 20-22)
- [ ] Phase 4C: Distill best 7B model to 3B
- [ ] Integrate distilled 3B into RAG system
- [ ] Create RAG integration test suite
- [ ] Test streaming with new model
- [ ] Final production validation (May 31)

## Up Next (Post-Production)

- WebSocket broadcast of watcher events to frontend
- Batch processing mode for auto-ingest (parallel workers)
- Persistent queue recovery on restart

## Backlog

- Document re-ingestion on change detection
- Batch progress tracking with WebSocket updates
- Reranking support (cross-encoder)
- Graph RAG mode
- Advanced chunking strategies (semantic, AST-aware for code)
- Configurable system prompts per project
- PDF OCR support (for scanned PDFs)
- Conversation history persistence

## Recently Completed

### 2026-01-30

**Session 2: Data Directory Pattern & Embedding Migration**
- [x] Implemented standardized data/ directory pattern (from ResearchHub)
- [x] Switched from Docker named volumes to bind mounts
- [x] Added init service to docker-compose.yml for directory creation
- [x] Created comprehensive .gitignore (data/, .env, Python, IDE, OS files)
- [x] Updated deploy.sh with ensure_data_directories() function
- [x] Enhanced cmd_clean to remove data directory contents
- [x] Reduced default chunk_size from 512 to 256 (based on BluePlan findings)
- [x] Documented data directory pattern (docs/findings/data-directory-pattern.md)
- [x] Reviewed BluePlan PDF ingestion approach (via parallel agent)
- [x] Reviewed ResearchHub data structure (via parallel agent)

**Session 1: Security & Embedding Model**
- [x] Migrated to Ollama embeddings (nomic-embed-text v1.5)
- [x] Added task prefix support for nomic-embed-text optimization
- [x] Made sentence-transformers optional in requirements.txt
- [x] Enhanced docker-compose.yml with security documentation
- [x] Implemented single-port architecture (127.0.0.1:8100 only)
- [x] Added port exposure validation in deploy.sh
- [x] Updated config.yaml with 3-step developer setup guide
- [x] Enhanced README with security benefits and architecture diagram
- [x] Documented embedding model selection research (docs/findings/)

### 2026-01-28

- [x] Web dashboard (ChatGPT-inspired chat UI)
- [x] Document sidebar with scrollable VS Code-styled file tree
- [x] Copy buttons (per-message and copy-all conversation)
- [x] Search mode toggles (hybrid/semantic/keyword)
- [x] Comprehensive deploy.sh script (start/stop/restart/ingest/status/logs/health/clean)
- [x] config.yaml for YAML-based configuration
- [x] Docker network with auto-increment naming (rag-bootstrap, rag-bootstrap-1, etc.)
- [x] Nginx reverse proxy (single port exposure, /api/ proxied to backend)
- [x] Frontend Dockerfile with nginx
- [x] Updated docker-compose.yml with frontend service

### 2026-01-27

- [x] Docker Compose infrastructure
- [x] Document ingestion pipeline — 6 file types
- [x] Search API — semantic, keyword, hybrid with RRF
- [x] MCP server — 4 tools
- [x] bootstrap.sh one-command setup
- [x] Integration documentation
- [x] LLM model config — default llama3.1:70b
- [x] Code quality fixes — type consistency, imports, missing fields
- [x] Comprehensive test suite — 47 unit tests, 8 integration tests
- [x] Scope, roadmap, todo docs created
- [x] LLM Q&A endpoint — POST /api/ask with RAG context injection
- [x] Multi-folder ingestion — POST /api/ingest/directories
- [x] Ollama LLM client module with health check and model listing
- [x] RAG retrieval config — top_k, min_similarity settings
- [x] LLM test suite — 11 additional unit tests

## Notes

- Ollama is SSH-forwarded to localhost:11434, not locally installed
- Default LLM: llama3.2:3b, default embedding: nomic-embed-text (768 dim, Ollama)
- This is a sub-project of Exude AI (parent docs in `../docs/`)
- Pattern reference: cv_resume_cover-letter project (RAG guidance injection)
- Frontend uses vanilla JavaScript (no framework) inspired by ResearchHub
- All services communicate via Docker network; only port 10000 exposed to localhost (127.0.0.1; RAG_PORT_BASE=10000 scheme)
- Single-port architecture with automatic security validation
- Data directory pattern adopted from ResearchHub (data/ excluded from git)
- Bind mounts used instead of Docker named volumes (visible, inspectable, portable)

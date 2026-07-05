# WS-ENV Handoff Report — Env templates: port base + embedding defaults + isolation keys

- **Instance**: py-dev@exudeai:rag-bootstrap:WS-ENV
- **Date**: 2026-07-03
- **Status**: COMPLETE
- **Edit zone**: `.env`, `.env.example` (only files touched)

## Context: partial-state recovery

A prior attempt was killed mid-edit. On arrival, `.env.example` already carried a
consistent draft of the port scheme (RAG_PORT_BASE table, isolation-key block,
canonical embedding triple) — verified against the plan's PORT TABLE (exact match:
var names, offsets, defaults 10000/10010–10016). That draft was kept and completed.
`.env` was untouched by the prior attempt (still 8100, no COMPOSE_PROJECT_NAME,
no RAG_PORT_BASE); it was merged fresh.

## Files changed

### `.env.example`
| Lines | Change |
|-------|--------|
| 4 | Header: `config.yaml` → `config/config.yaml` (matches WS-DEPLOY resolution contract) |
| 10–21 | (prior draft, kept) INSTANCE ISOLATION block + `COMPOSE_PROJECT_NAME=rag-bootstrap` |
| 23–43 | (prior draft, kept) PORT SCHEME block, offset table, `RAG_PORT_BASE=10000` |
| 45–57 | (prior draft, kept) `RAG_PORT=10000`, `RAG_NETWORK_NAME=rag-bootstrap-net`, commented derived `RAG_<svc>_PORT` defaults |
| 69–86 | NEW: EMBEDDINGS — HARD PREREQUISITE block (external host Ollama, `ollama pull nomic-embed-text`, `./deploy.sh doctor` verification, dimension-lock warning, sentence-transformers-not-bundled note) around the canonical triple `nomic-embed-text/768/ollama` |
| 92–95 | Ollama endpoint comment: serves embeddings + LLM, host-gateway/remote modes |
| 106–113 | Document mounts: documented `DOCS_PATH` same-path ro mount knob (commented default, per design decision 4); legacy `RAG_DOCS_VOLUME` kept |

### `.env` (LIVE file — merged, never clobbered)
| Lines | Change |
|-------|--------|
| 9–13 | ADDED `COMPOSE_PROJECT_NAME=rag-bootstrap` — matches the previous *implicit* directory-name default, so existing container/volume/network names are preserved |
| 15–18 | ADDED `RAG_PORT_BASE=10000` with pointer to the `.env.example` table |
| 20–21 | `RAG_PORT` 8100 → 10000 (8100 was the stale pre-scheme *template default*, not a deliberate pin; migration noted in comment) |
| 32–34 | Embedding comment elevated to HARD PREREQUISITE one-liner (values already canonical, unchanged) |

**Preserved custom values (untouched)**: `PROJECT_NAME=rag-bootstrap-multi-kb`,
`RAG_NETWORK_NAME=rag-multi-kb-network`, `POSTGRES_HOST=postgres-primary`,
`ROUTER_TYPE=broadcast`, all LLM/chunking/retrieval settings.

## Acceptance-criteria evidence

| Criterion | Evidence | Result |
|-----------|----------|--------|
| `RAG_PORT_BASE=10000` and `RAG_PORT` default 10000 in both files | `grep`: `.env.example:43,46` and `.env:18,21` | PASS |
| Embedding triple resolves to nomic-embed-text/768/ollama in both files | `grep`: `.env.example:84-86` and `.env:35-37` | PASS |
| `COMPOSE_PROJECT_NAME` and `RAG_NETWORK_NAME` present in both files | `grep`: `.env.example:21,47` and `.env:13,22` | PASS |
| (Task 4) pull note elevated to hard prerequisite | `.env.example:70-78` HARD PREREQUISITE block; `.env:32-34` | PASS |

Static checks:
- dotenv KEY=VALUE syntax check (python regex over non-comment lines): **OK** both files.
- `docker compose -f docker-compose.yml config` with merged `.env`: resolves —
  project `rag-bootstrap`, `EMBEDDING_BACKEND: ollama` / `768` / `nomic-embed-text`,
  web `published: "10000"`, network `rag-multi-kb-network` (custom value intact). Exit 0.

## Deviations / notes for sibling workstreams (no out-of-zone edits made)

1. **WS-COMPOSE partial state**: `docker-compose.yml:138-140` still has stale
   fallbacks `all-MiniLM-L6-v2/384/sentence-transformers` and `:184` still
   `${RAG_PORT:-8100}` — WS-COMPOSE's zone, still pending there. My `.env`
   values mask them at runtime, but the fallback fix must still land.
2. **`DOCS_PATH`** is documented (commented) in `.env.example`; WS-COMPOSE owns
   wiring `- ${DOCS_PATH}:${DOCS_PATH}:ro` with an unset-safe default.
3. **`./deploy.sh doctor`** is referenced by the new prerequisite text; the
   subcommand itself is WS-DEPLOY's deliverable.
4. **Deferred per design decision 5**: symbol-aware chunking, setup wizard,
   backup/restore, /stats dashboard — none touched (not WS-ENV scope anyway).
5. No git commits made (per standing rule).

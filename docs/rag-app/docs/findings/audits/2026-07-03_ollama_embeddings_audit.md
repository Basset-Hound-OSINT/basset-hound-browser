# Findings: Ensure rag-bootstrap uses an Ollama embedding model, not sentence-transformers

## Summary
The RAG code ALREADY has a working Ollama embedding path (`app/embeddings.py::_embed_ollama`,
lines 175-181, POSTing to `{OLLAMA_BASE_URL}/api/embeddings`). The intended/documented default
IS Ollama + `nomic-embed-text` — this is what `config/config.yaml` (lines 99-117), `.env.example`
(lines 40-42), and `docker-compose.multi-kb.yml` (lines 197-199) all say.

BUT three code-level fallback layers still default to **sentence-transformers / all-MiniLM-L6-v2 /
384-dim**, which is (a) inconsistent with the intended default and (b) actively broken, because
`sentence-transformers` is commented OUT of `app/requirements.txt` (lines 17-20) and is therefore
NOT installed in the image (`app/Dockerfile` installs only `requirements.txt`). If any of these
fallback defaults is hit, `EmbeddingService._get_local_model()` (embeddings.py:69-75) raises
`ImportError` at runtime.

## Config flow (verified)
- `./deploy.sh start` → `generate_env()` (deploy.sh:148-182) reads config.yaml (ollama) → writes
  `.env` with `EMBEDDING_BACKEND=ollama` → docker-compose passes it to the api container. WORKS.
- Bare `docker-compose up` with NO generated `.env` → docker-compose fallback defaults
  (docker-compose.yml:130-132) = **sentence-transformers** → container ImportError. BROKEN.
- Direct Python / tests / scripts with no env → `app/config.py` defaults = **sentence-transformers**.
  Note `settings.EMBEDDING_DIMENSION` (default 384) drives the pgvector column width at
  `app/database.py:63` (`Vector(settings.EMBEDDING_DIMENSION)`), so a stale default also creates a
  384-vs-768 dimension mismatch against nomic-embed-text's 768-dim vectors.

## Sentence-transformers references inventory
- `app/config.py:18,19,26` — hard Python defaults (all-MiniLM-L6-v2 / 384 / sentence-transformers). PRIMARY.
- `docker-compose.yml:130-132` — env fallback defaults (all-MiniLM-L6-v2 / 384 / sentence-transformers). PRIMARY.
- `deploy.sh:96-98` — Python YAML-parse fallback defaults; `deploy.sh:163-165` — generate_env heredoc
  fallback defaults. Both still sentence-transformers. SECONDARY.
- `app/embeddings.py:14,22,40,69-75,166-173` — the local sentence-transformers backend path; keep as
  OPTIONAL non-default fallback. No change strictly required beyond it not being the default.
- `app/requirements.txt:17-20` — sentence-transformers already commented out (correct; keep optional).
- `tests/test_embeddings.py:21-99` — tests exercise the sentence-transformers backend explicitly with
  mocks; not a runtime default, no change required.
- `requirements-rerank.txt:22`, `requirements-benchmark.txt:14` — sentence-transformers pulled for the
  RERANKER (cross-encoder) and benchmark tooling. These are a SEPARATE feature (reranking), not the
  embedding path. Out of scope for this concern; left as-is.

## Ollama service / model pull
- NO `ollama` service is defined in ANY compose file (docker-compose.yml, .multi-kb.yml, .monitoring.yml).
  The stack relies on an EXTERNAL Ollama reached via `host.docker.internal:11434`
  (docker-compose.yml:135, `extra_hosts` at :148-149).
- The `nomic-embed-text` model is NEVER auto-pulled. `.env.example:37` documents the manual step
  ("requires: ollama pull nomic-embed-text") but nothing enforces it. This is a deployment prerequisite
  gap to flag, not necessarily to wire in for minimum-viable.

## Minimum-viable edits to make Ollama the default
1. `app/config.py` lines 18/19/26: `EMBEDDING_MODEL="nomic-embed-text"`, `EMBEDDING_DIMENSION=768`,
   `EMBEDDING_BACKEND="ollama"`.
2. `docker-compose.yml` lines 130-132: fallbacks →
   `${EMBEDDING_MODEL:-nomic-embed-text}`, `${EMBEDDING_DIMENSION:-768}`, `${EMBEDDING_BACKEND:-ollama}`
   (mirror docker-compose.multi-kb.yml:197-199).
3. `deploy.sh` lines 96-98 and 163-165: default embedding model→nomic-embed-text, dim→768, backend→ollama.
4. (Flag) Ensure `nomic-embed-text` is pulled on the host Ollama; optionally document/add a pull step.
Already correct, no edit: config/config.yaml, .env.example, docker-compose.multi-kb.yml, requirements.txt.

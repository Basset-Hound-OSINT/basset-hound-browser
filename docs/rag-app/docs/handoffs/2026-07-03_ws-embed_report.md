# WS-EMBED Handoff Report — Embedding concurrency/retry + dependency pins

- **Instance**: py-dev@exudeai:rag-bootstrap:WS-EMBED
- **Date**: 2026-07-03
- **Status**: complete
- **Zone**: `app/embeddings.py`, `app/requirements.txt`

## Partial-state check (required first step)

`git diff -- app/embeddings.py app/requirements.txt` was **empty** at start — the
prior rate-limited attempt never reached this zone. Fresh, complete implementation.

## Files changed

### `app/embeddings.py` (+156/-10)

| Lines (new) | Change |
|---|---|
| 3, 13 | Added `import asyncio`; import `Config`/`default_config_path` from `.config_manager` |
| 22-40 | Module knob constants: `_DEFAULT_CONCURRENCY=5`, `_DEFAULT_RETRY_BACKOFF="exponential"`, `_RETRY_ATTEMPTS=3`, `_RETRY_BASE_DELAY=0.5`, `_OLLAMA_BATCH_SIZE=64`; `_ST_GUARD_MESSAGE` actionable guard text |
| 43-60 | `_ingestion_knobs()` — reads `ingestion.concurrent_files` / `ingestion.retry_backoff` from `config/config.yaml` (CWD-independent via `default_config_path()`), validates, falls back to defaults |
| 75-101 | `__init__` gains optional `concurrency` / `retry_backoff` params; builds `asyncio.Semaphore`; `_ollama_batch_supported` lazy-probe flag; updated class docstring (Ollama is default) |
| 127-131 | `_get_local_model()` hard guard: missing `sentence_transformers` now raises `ImportError(_ST_GUARD_MESSAGE)` ("use EMBEDDING_BACKEND=ollama ... or pip install sentence-transformers") instead of a bare ImportError |
| 216 | `embed_batch` ollama path: serial `[await self._embed_ollama(t) for t in ...]` (old :154) replaced with `await self._embed_ollama_batch(uncached_texts)` |
| 228-272 | `_retry_delay()` (exponential/linear) + `_post_ollama()` — every Ollama POST runs under the semaphore and retries timeouts/connect errors (`httpx.TransportError`) and 5xx up to 3 attempts with backoff; 4xx raised immediately; warning log per retry, error log on exhaustion |
| 274-278 | `_embed_ollama()` now delegates to `_post_ollama("/api/embeddings", ...)` (same URL/payload contract as before) |
| 280-325 | `_embed_ollama_batch()` — prefers Ollama batch `/api/embed` (`input: [...]`, 64-text slices, semaphore-bounded gather); on 404/unexpected shape marks unsupported (remembered) and falls back to per-text `/api/embeddings` under the same semaphore; exhausted 5xx propagates (real outage, endpoint NOT marked unsupported) |

### `app/requirements.txt` (+3/-1)

- Line 32: `fastmcp` → `fastmcp==2.1.2` with pin rationale comment (sugg-F16 / SUGGESTIONS.md I9 host-vs-container skew). 2.1.2 is the version installed on this host, and it was verified to accept the existing `FastMCP(name=..., description=...)` call in `app/mcp_server.py:21-24` — host+container now converge on one known-good version (recommendation R4).
- Lines 17-20: sentence-transformers stays **commented** per resolved decision 1 (Ollama-only default; no bundle). Unchanged.

## Acceptance-criteria evidence

Smoke harness: `scratchpad/ws_embed_smoke.py` (temporary, per testing-discipline; lives in scratchpad, not the repo). Result: **11 passed, 0 failed**. Existing suite `tests/test_embeddings.py`: **9 passed** (unchanged, still compatible — it patches `app.embeddings.httpx.AsyncClient`, which the refactor still uses).

| Criterion | Evidence |
|---|---|
| Batch runs with bounded concurrency and survives transient Ollama 5xx via retry (observed in logs) | Smoke: 17-text batch on fallback path → `max_in_flight=5` (== `ingestion.concurrent_files`); flaky-5xx stub → success on 3rd try with log lines `WARNING app.embeddings: Ollama embed request to /api/embeddings failed (attempt 1/3 ...); retrying in ...` / `(attempt 2/3 ...)`; exhausted retries raise `httpx.HTTPStatusError` after `ERROR ... failed after 3 attempts` |
| `EMBEDDING_BACKEND=sentence-transformers` without the dep raises the actionable guard, not bare ImportError | Smoke (module blocked in `sys.modules` to mirror the container image, which installs only `app/requirements.txt`): `ImportError` whose message names the misconfiguration and both fixes ("EMBEDDING_BACKEND=ollama ... or ... pip install sentence-transformers") |
| fastmcp pinned to a single version | `app/requirements.txt:32` `fastmcp==2.1.2`; constructor compatibility verified live (`FastMCP(name=..., description=...)` OK on 2.1.2) |
| (plan extra) Ollama batch embeddings used where available | Smoke: 70 texts → two `/api/embed` requests (64+6), order-preserving; 404 → per-text fallback, and the fallback decision is remembered (no re-probe on the next batch) |
| Static checks | `python3 -m py_compile app/embeddings.py` OK; requirements.txt is plain text (visual check) |

## Contract notes for dependent workstreams (WS-API)

- `EmbeddingService.__init__` signature is backward-compatible (new params optional, keyword use in `main.py:57` / `mcp_server.py:36` unaffected).
- Knobs come from `config/config.yaml` `ingestion.concurrent_files` / `ingestion.retry_backoff` exactly as the comments WS-CONFIGYAML wrote there promise ("attempt count and base delay are fixed in app/embeddings.py" — they are: 3 attempts / 0.5s base).
- Single-text `/api/embeddings` request contract (URL + `{"model", "prompt"}` payload) unchanged.

## Deviations

- None. No edits outside the zone. `config/config.yaml`, `config_manager.py`, tests: read-only consumption only.

## Deferred (per resolved decision 5)

- Symbol-aware chunking, setup wizard, backup/restore, /stats dashboard — out of scope for this workstream, not implemented, no stubs added.

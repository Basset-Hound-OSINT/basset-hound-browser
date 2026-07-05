# Embedding Performance & Ingestion Optimization

## Problem

When ingesting large FAA PDFs (916-930 pages, 1200-2000+ chunks each), the remote
Ollama embedding endpoint returns HTTP 500 errors. The Ollama server runs on a remote
HPC (gpu02), accessed via SSH port forward. The internal model runner subprocess crashes
under sustained load, especially with dense ATC reference notation.

## Root Cause Analysis (Session 7)

The Ollama model runner (an internal subprocess) crashes with:
```
{"error":"do embedding request: Post \"http://127.0.0.1:PORT/embedding\": EOF"}
```

Key findings:
- The runner port changes with each restart, confirming subprocess crash/respawn
- **Dense text crashes the runner**: ATC page checklists (e.g., "1-1-18 2/20/25 1-1-19 2/20/25...")
  have extremely high token-to-character ratios that exceed the runner's capacity
- **Length threshold**: ~1000+ chars of dense notation crashes the runner reliably
  - 800 chars: 96%+ success rate across all document types
  - 600 chars: 100% success rate
  - 1200+ chars: frequent crashes with page-listing content
- **Sustained load**: Even with delays, the runner enters persistent crash state if
  previous crash recovery didn't complete before the next request
- **Not a connection issue**: SSH tunnel is stable; the runner crashes locally on gpu02
- **Not Unicode-specific**: ASCII-only versions of problematic text also crash the runner

## Solutions Implemented

### 1. Text Normalization & Length Cap (`app/embeddings.py`)

`_normalize_text()` preprocesses all text before embedding:
- Replaces Unicode chars (minus sign, dashes, smart quotes, NBSP) with ASCII equivalents
- Caps text at 800 characters (truncates at word boundary)
- Strips null bytes (common PDF artifact that breaks PostgreSQL)

### 2. Progressive Truncation Fallback

`_embed_ollama_safe()` tries increasingly shorter text on failure:
1. Normal embedding at 800 chars
2. Wait 10s, retry at 600 chars (last resort)
3. Return zero vector (prevents pipeline halt)

### 3. Sequential Embedding with Cooldown

Changed from concurrent semaphore-based embedding to sequential processing with
1.5s inter-request delay. The model runner is too fragile for concurrent requests
over SSH tunnel.

### 4. Retry with Exponential Backoff

`_embed_ollama()` retries up to 8 times with exponential backoff (3s base, 20s cap).
On EOF crashes, waits 15s for runner recovery instead of forcing model unload
(which was found to destabilize the runner further).

### 5. Shared HTTP Client

Replaced per-request `httpx.AsyncClient` creation with a shared instance.
Client is recreated on connection errors or after 2+ consecutive failures.

### 6. Batch Ingestion with Resume (`app/ingestion.py`)

Chunks processed in batches of 25, committed after each batch. On failure:
- Partial progress is committed (no data loss)
- Resume detection: counts actual chunks in DB vs expected total
- Resumes from last committed batch (skips already-embedded chunks)

### 7. Document Deduplication

SHA-256 content hash check skips already-ingested documents.
`force: true` API parameter bypasses dedup for re-ingestion.

### 8. Redis Embedding Cache

All embeddings cached in Redis with 30-day TTL. Re-ingestion serves cached
chunks instantly.

### 9. Standalone Ingestion Script

`scripts/ingest_aim_standalone.py` bypasses the container API entirely:
- Runs embedding from host (proven more stable than container→host→SSH→Ollama path)
- Inserts directly into container Postgres via `docker exec psql`
- Dollar-quoting for safe SQL of complex ATC text
- Resume-aware: detects partial ingestion and continues
- `--force` flag to delete existing and re-ingest from scratch

### 10. Junk Chunk Filtering (Session 8)

`is_junk_chunk()` in `app/ingestion.py` detects and skips non-content chunks:
- **Page checklists**: Dense page-number/date listings (>25% digit characters)
- **TOC dot leaders**: Table of contents pages (>10% dot-leader sequences)
- **Empty chunks**: Zero-length text after normalization

These chunks have zero semantic value for RAG (nobody searches for "what page is
section 4-1-14 on?") and their dense digit patterns are exactly what crashes the
Ollama model runner. Filtering them **both eliminates the runner crash problem and
improves search quality**.

Impact per document:

| Document | Total Chunks | Content Chunks | Junk Filtered | Junk % |
|----------|-------------|----------------|---------------|--------|
| PCG_consolidated.pdf | 312 | 312 | 0 | 0% |
| JO_7110.65BB_consolidated.pdf | 1,689 | 1,523 | 166 | 9.8% |
| JO_7210.3EE_consolidated.pdf | 1,255 | 1,054 | 201 | 16.0% |
| AIM_consolidated.pdf | 2,073 | 1,888 | 185 | 8.9% |
| **Total** | **5,329** | **4,777** | **552** | **10.4%** |

Detection heuristic (empirically validated on all 4 FAA documents):
```python
digit_ratio = sum(ch.isdigit() for ch in text) / len(text)
dots_ratio = text.count(". .") / len(text)
is_junk = digit_ratio > 0.25 or dots_ratio > 0.10
```

Unit tests: 9 test cases in `tests/test_chunking.py::TestIsJunkChunk`.

## Performance Data

| Document | Pages | Raw Chunks | Content Chunks | Status | Notes |
|----------|-------|-----------|----------------|--------|-------|
| PCG_consolidated.pdf | 150 | 312 | 312 | Complete | Clean ingestion, no junk |
| JO_7110.65BB_consolidated.pdf | 916 | 1,689 | 1,523 | Complete (with junk) | 166 junk in DB, 30 truncations |
| JO_7210.3EE_consolidated.pdf | 664 | 1,255 | 1,054 | Complete (with junk) | 201 junk in DB |
| AIM_consolidated.pdf | 930 | 2,073 | 1,888 | 25 partial (pre-filter) | Re-ingest with filtering next |
| **Total** | **2,660** | **5,329** | **4,777** | **3,281 in DB** | |

## Recommendations

1. **For AIM ingestion**: Use standalone script with `--force` to re-ingest with junk filtering
2. **For JO re-ingestion**: Re-ingest JO 7110.65 and JO 7210.3 with filtering to remove 367 junk chunks
3. **For dense documents**: Reduce `max_chars` below 800 if runner continues crashing
4. **For flaky connections**: Sequential embedding with 1.5s+ delay between requests
5. **Re-run failed ingestions**: Resume logic + Redis cache make re-runs efficient
6. **Monitor progress**: API logs show `Embedding progress: X/Y chunks` every 10 chunks
7. **Alternative**: Consider running sentence-transformers locally if Ollama remains unstable
   - Would require installing `sentence-transformers` in container (uncomment in requirements.txt)
   - Existing Ollama-embedded vectors may not be compatible with ST-embedded vectors

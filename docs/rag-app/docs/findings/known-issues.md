# Known Issues

> Last updated: 2026-02-18 (Session 9)

## Active Issues

### 6. Multi-Document Search Quality Regression

Adding JO documents (2,577 chunks) to the index dropped search quality from 95% (PCG-only)
to **62% (13/21)**. JO operational text that *discusses* terms outranks PCG glossary
*definitions* of those terms.

**Impact**: 8 test cases fail — ARTCC, PIREP, SID, trajectory altering clearance, GPS
unreliable, and all 3 TAC mode-compare tests. PIREP and GPS results are at ranks 5-6
(borderline); ARTCC, SID, trajectory are NOT in top 15.

**Root cause**: JO has ~8x more chunks than PCG. Semantic similarity between "what is X?"
and JO text about X operations is high. Keyword matching finds many JO chunks too.

**Required improvements** (midterm roadmap):
- Structure-aware chunking for PCG glossary entries
- Cross-encoder reranking
- Document-type boosting (glossary sources weighted higher)
- Contextual chunk headers

See [rag-quality-improvements.md](rag-quality-improvements.md) "Multi-Document Regression" section.

## Infrastructure Dependencies

### 1. Ollama Not Local — Requires SSH Tunnel + VPN

Ollama does not run on the local machine. It runs on HPC gpu02 (VEGA cluster) and is
accessed via SSH port forward through the login node.

**Impact**: All embedding and LLM operations fail when the tunnel is down.

**Tunnel command**:
```bash
ssh -f -N -L 0.0.0.0:11434:localhost:11435 -J nelsg10@vegaln1.erau.edu nelsg10@gpu02
```

**Prerequisites**:
- ERAU VPN must be connected (vegaln1.erau.edu is not reachable without it)
- Ollama must be running on gpu02 (user xings manages it on GPU 0)
- Port 11435 on gpu02 is Ollama's listen port (non-standard)

**How to verify**:
```bash
curl -s http://localhost:11434/api/tags | head -1
```
If this returns nothing or times out, the tunnel is down or Ollama is not running.

**Container access**: The Docker stack uses `host.docker.internal:11434` (via `extra_hosts`
in docker-compose.yml) to reach the tunneled Ollama from inside containers.

### 2. AIM Ingestion Paused at 780/1,888 (Session 9-10)

AIM re-ingestion with junk chunk filtering. Standalone script deleted 25 stale pre-filter
chunks and is re-ingesting 1,888 content chunks with batch embedding (10 chunks/request).

**Status**: Paused at 780/1,888 (41%). Zero zero-vector fallbacks.

**Root cause of instability**: `llama3.3:70b-instruct-q5_K_M` (57GB VRAM) is loaded in the
shared Ollama GPU memory, destabilizing the nomic-embed-text runner. The 70B model gets
reloaded by another service/user even after manual unload. Stability is ~20-30% without the
70B model being unloaded, ~80%+ when only nomic-embed-text is loaded.

**Resume**: Script auto-detects partial at 780 and resumes:
```bash
cd rag-atc-testing && PYTHONUNBUFFERED=1 python3 scripts/ingest_aim_standalone.py >> /tmp/aim_ingest.log 2>&1 &
```

## Intermittent Issues

### 3. GPU Memory Contention — llama3.3:70b Destabilizes Embed Runner

The Ollama instance on gpu02 is shared. When `llama3.3:70b-instruct-q5_K_M` (57GB VRAM) is
loaded, it destabilizes the nomic-embed-text embedding runner, causing "connection refused"
errors on ~70-80% of embed requests. The 70B model is repeatedly reloaded by another
service/user even after manual unload via `keep_alive: 0`.

**Impact**: AIM ingestion rate drops from ~40 chunks/min to ~5-10 chunks/min with constant retries.

**Workaround**: Unload the 70B model before embedding-heavy operations:
```bash
curl http://localhost:11434/api/generate -d '{"model":"llama3.3:70b-instruct-q5_K_M","keep_alive":"0"}'
```

### 4. Ollama Model Runner Crashes on Dense Text

The Ollama embedding model runner (internal subprocess) crashes with EOF errors when
processing text with high token-to-character ratios (page checklists, dense digit
sequences). This is an upstream Ollama bug, not a network issue.

**Mitigations in place**:
- Junk chunk filtering removes 10.4% of chunks that trigger crashes (primary fix)
- Text capped at 800 chars before embedding
- Progressive truncation fallback (800 → 600 → zero vector)
- Batch embedding (10 chunks/request) to reduce crash exposure
- 7 retries with 10-60s delays tuned for runner respawn cycle

See [embedding-performance.md](embedding-performance.md) for full analysis.

### 5. Ollama Runner Port Rotation

When the Ollama model runner crashes and respawns, it binds to a new random port
internally. This is normal Ollama behavior but means:
- Requests in flight during a crash get EOF errors
- There is no way to predict or pre-warm the runner after a crash
- The 15s recovery wait in retry logic accounts for this

## Resolved Issues (For Reference)

### PostgreSQL Null Byte Errors (Fixed Session 7)
PDF text sometimes contains null bytes (`\x00`), which PostgreSQL rejects.
**Fix**: `_normalize_text()` strips null bytes before embedding and storage.

### Unicode Character Embedding Failures (Fixed Session 7)
Unicode minus signs (U+2212), em-dashes, smart quotes crash the embedding runner.
**Fix**: `_normalize_text()` replaces common Unicode chars with ASCII equivalents.

### AND-based Keyword Search Failures (Fixed Session 5)
Natural language queries with stop words failed because `plainto_tsquery` required
ALL tokens to match. "What happens when GPS is unreliable?" found nothing.
**Fix**: OR-based keyword search with stop word filtering for `simple` config.
See [rag-quality-improvements.md](rag-quality-improvements.md).

### Acronym Search Failures (Fixed Session 4)
Short uppercase acronyms (TAC, ATIS) were stemmed by PostgreSQL `english` config
and poorly embedded by nomic-embed-text.
**Fix**: Dual keyword search (english + simple configs), adaptive semantic weighting,
acronym expansion table (304 entries). See [rag-quality-improvements.md](rag-quality-improvements.md).

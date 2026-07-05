# RAG Bootstrap — Performance & Tuning

**Last Updated**: 2026-07-03

The knobs below are the shipped, wired-through surface — everything here maps
to a real flag in `config/config.yaml`, `.env`, or `app/embeddings.py`.

---

## 1. Embedding concurrency & retry

The embedding path (Ollama backend) runs with **bounded concurrency** and
**retry-with-backoff**; both knobs live under `ingestion:` in
`config/config.yaml`:

| Knob | Default | Effect |
|------|---------|--------|
| `ingestion.concurrent_files` | `5` | Max files processed in parallel during directory ingest; also caps in-flight embedding requests to Ollama (asyncio semaphore). |
| `ingestion.retry_backoff` | `exponential` | Retry delay strategy for transient failures (timeout / 5xx): `exponential` (0.5s, 1s, 2s) or `linear` (0.5s, 1s, 1.5s). |

Fixed by design in `app/embeddings.py` (not config): **3 total attempts** per
request, **0.5s base delay**, and **64 texts per batch** — batch embedding
prefers Ollama's `/api/embed` batch endpoint where the server supports it
(probed lazily, falls back to per-text requests), which cuts request count by
up to 64x on bulk ingest.

Guidance:

- **Dedicated Ollama host**: raise `concurrent_files` (8-10).
- **Busy shared Ollama** (several stacks + a large LLM on one endpoint): lower
  to 1-2. Contention for VRAM/compute — not HTTP rate limiting — is the real
  bottleneck; the retry/backoff path absorbs transient timeouts, but sustained
  saturation calls for lower concurrency or a dedicated embedding endpoint.
- Embeddings are cached in Redis (30-day TTL), so re-ingesting unchanged
  content is cheap.

---

## 2. Chunking parameters

Under `ingestion:` in `config/config.yaml`:

| Knob | Default | Notes |
|------|---------|-------|
| `chunk_size` | `256` | Tokens per chunk (whitespace approximation). nomic-embed-text accepts up to 8192, but smaller chunks retrieve better and embed faster. |
| `chunk_overlap` | `50` | Overlapping tokens between consecutive chunks (context continuity). |

By use case:

- **Technical docs / code**: 256-384 (preserve procedure context)
- **General text**: 256-512
- **Conversational**: 128-256
- **Ollama timeouts during ingest**: reduce `chunk_size` — the BluePlan
  project found 150/30 reliable on a saturated shared host.

Changing chunk parameters only affects newly ingested documents; re-ingest to
apply them corpus-wide.

---

## 3. Ingest throughput

- **Async directory ingest**: `POST /api/ingest/directory` returns `202` with
  a `job_id` immediately and runs in the background — large corpora no longer
  die at the proxy's read timeout. Poll `GET /api/ingest/status/{job_id}`.
- **Keep the corpus lean**: `ingestion.exclude` (defaults: `.git/`,
  `node_modules/`, `data/`, `*.pdf`) wins over `extensions`, so pointing an
  ingest at a whole repo doesn't drag in binaries or bulk PDF corpora. Both
  lists can be overridden per-request in the ingest body.
- **Idempotent re-ingest**: duplicates are skipped by `content_hash`
  (ON CONFLICT DO NOTHING) — a re-run only pays for new/changed files, and one
  bad file no longer poisons the batch.
- **Rough budget**: ingest cost ≈ files × chunks-per-file × embed latency ÷
  `concurrent_files`. Watch the API logs for the per-file progress and the
  `search_access` lines for query-side telemetry.
- **Token-savings telemetry**: search responses carry an `X-Chunk-Bytes`
  header (payload size of returned chunk text) and a structured
  `search_access` log line — orchestrators can post-process these into a real
  tokens-saved number and budget agent fanout accordingly.

---

## 4. Model selection

Which Ollama models to run — and why the answer is governed by the shared
6GB-VRAM GPU, not by benchmarks — lives in
[reference/MODEL_SELECTION.md](reference/MODEL_SELECTION.md). Short version:
the canonical picks are `nomic-embed-text` (0.3GB) + `llama3.2:3b` (2.0GB) =
~2.3GB resident, leaving headroom for other tenants on the same GPU; all
instances share ONE loaded copy via the external Ollama server, and ingest
bursts (embedding) — not chat — are the real contention source, so tune
`ingestion.concurrent_files` (section 1) before considering a model change.
Do not raise the resident footprint without a GPU-budget decision.

---

## 5. Monitoring stack

An optional Prometheus/Grafana/Loki overlay ships in
`docker-compose.monitoring.yml`:

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

Host ports derive from `RAG_PORT_BASE=10000` (all bound to `127.0.0.1`):

| Service | Port | Use for |
|---------|------|---------|
| Prometheus | 10010 | Raw metrics, alert rules (`prometheus.yml`, `alert_rules.yml`) |
| Grafana | 10011 | Dashboards (provisioned from `grafana/`) |
| Loki | 10012 | Log aggregation (`loki-config.yml`, promtail ships container logs) |
| Alertmanager | 10013 | Alert routing |
| postgres-exporter | 10014 | DB metrics (connections, query rates) |
| redis-exporter | 10015 | Cache hit rates (embedding cache effectiveness) |
| cAdvisor | 10016 | Per-container CPU/memory — spot ingest pressure |

Lighter-weight checks without the overlay: `./deploy.sh health` (component
health), `GET /api/status` (corpus size), `GET /health/index` (freshness,
corpus bytes).

---

## Related docs

- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — when tuning turns into debugging
- [findings/embedding-performance.md](findings/embedding-performance.md) — embedding/ingestion analysis behind these defaults
- [findings/caching_optimization_guide.md](findings/caching_optimization_guide.md) — Redis caching deep-dive
- [benchmarking/BENCHMARK_10K_README.md](benchmarking/BENCHMARK_10K_README.md) — 10K-chunk pipeline benchmark

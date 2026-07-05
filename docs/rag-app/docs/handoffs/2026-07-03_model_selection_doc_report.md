# Handoff — MODEL_SELECTION.md doc delivery

- **Date**: 2026-07-03
- **Agent**: doc-writer@exudeai:rag-bootstrap:MODEL-DOC
- **Verdict**: COMPLETE — all three work-zone files delivered, links verified, no model defaults touched, no commits.

## Deliverables

1. **`docs/reference/MODEL_SELECTION.md`** (created) — durable guide for choosing Ollama models:
   - Section 1: governing constraint — one SHARED host Ollama on a 6GB-VRAM multi-tenant GPU serving a dozen+ rag-bootstrap instances (all pointing `OLLAMA_BASE_URL` at the same server) plus other projects' models (researchhub); one loaded copy serves all instances via Ollama's queue; ingest bursts (embedding), not chat, are the contention source.
   - Section 2: canonical picks table — nomic-embed-text (0.3GB, 768-dim, locked triple) + llama3.2:3b (2.0GB, 128K) = ~2.3GB resident, ~3.7GB headroom; "do not raise without a GPU-budget decision" stated twice.
   - Section 3: six decision criteria in gate order — (1) ≤~2.5GB Q4 footprint, 7-8B explicitly NOT recommended on shared 6GB VRAM; (2) instruction-following + faithfulness to retrieved chunks, hallucination resistance when the answer is absent (mistral-7b-class trait) over benchmarks; (3) 128K+ context; (4) toggleable thinking mode ideal — qwen3.5:4b (~2.5GB, 256K, thinking mode, Mar 2026) named as designated upgrade candidate gated on +0.5GB GPU-budget decision; (5) concurrency — OLLAMA_NUM_PARALLEL / OLLAMA_MAX_LOADED_MODELS / keep_alive server knobs + shipped per-instance `ingestion.concurrent_files` / `retry_backoff` knobs, cross-linked to PERFORMANCE.md; (6) license.
   - Section 4: upgrade path (documented, not actioned) — llama3.1:8b Q4 (~5GB, 128K) quality step-up if GPU dedicated/larger; deepseek-r1-distill caveat (over-reasons past retrieved evidence; prefer toggleable-thinking).
   - Section 5: how-to-switch snippet — `ollama pull` → `config/config.yaml llm.model` (or `LLM_MODEL` in .env) → `./deploy.sh doctor` → `./deploy.sh restart`; verified against the actual deploy.sh flow (generate_env at deploy.sh:316/351, doctor pull-check at deploy.sh:532-535, compose passthrough at docker-compose.yml:162, app default at app/config.py:42). Consistent with UPGRADE_2026-07-03.md; notes LLM swap is index-safe vs embedding swap (wipe + re-embed).
   - Section 6: the four requested 2026 ranking sources cited.
2. **`docs/PERFORMANCE.md`** — new "## 4. Model selection" summary section linking to the new doc (monitoring stack renumbered 4→5; no anchors or section-number references existed elsewhere — grepped).
3. **`docs/INDEX.md`** — MODEL_SELECTION.md row added to the reference/ table.

## Verification

- Link check: all relative links in the three touched files resolve (scripted check, 0 broken).
- No references to `PERFORMANCE.md#` anchors or "section 4" elsewhere in docs/ — renumbering is safe.
- Facts sourced from: `config/config.yaml`, `.env.example`, `docs/findings/audits/2026-07-03_live_smoke_report.md`, `docs/deployment/UPGRADE_2026-07-03.md`, `deploy.sh`, `app/config.py`, `docker-compose.yml` (all read-only).
- No model defaults changed anywhere; llama3.2:3b remains default in all four config surfaces. No commits, no docker, no pulls.

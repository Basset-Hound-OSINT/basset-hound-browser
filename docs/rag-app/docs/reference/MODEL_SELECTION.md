# Model Selection — Choosing Ollama Models for This System

**Last Updated**: 2026-07-03
**Status**: durable reference — encodes the GPU topology constraint, the current
canonical picks, the decision criteria for future candidates, and the upgrade
path. For the embedding-model decision record see
[findings/embedding-model-selection-2026.md](../findings/embedding-model-selection-2026.md).

---

## 1. The governing constraint: one shared Ollama on a 6GB GPU

Every model decision in this project flows from the deployment topology, not
from benchmark leaderboards:

- **One SHARED host Ollama server** (at `OLLAMA_BASE_URL`, default
  `http://host.docker.internal:11434`) serves **all** rag-bootstrap instances.
  Each project runs its own stack (postgres/redis/api/frontend), but a dozen or
  more instances can point at the **same** Ollama endpoint simultaneously.
- The GPU behind that server has **6GB VRAM** and is **multi-tenant**: other
  projects (e.g. researchhub) run their own models on the same GPU.
- Ollama loads a model **once** and queues requests against that single
  resident copy — N instances do **not** mean N copies. What N instances *do*
  mean is contention, and the real contention source is **ingest bursts**
  (embedding traffic), not chat.

Consequences:

1. **Total resident footprint must stay small.** Embedding model + LLM
   together should leave real headroom for the other tenants.
2. **One small model shared by everyone beats a big model owned by one.**
   A 7-8B model at Q4 (~4.5-5GB) would evict other tenants' models or spill to
   CPU — both are fleet-wide regressions.
3. **Model choices are a shared-infrastructure decision**, not a per-instance
   one. Do not raise the resident footprint without a GPU-budget decision.

## 2. Current canonical picks (2026-07-03)

| Role | Model | VRAM (resident) | Notes |
|------|-------|-----------------|-------|
| Embeddings | `nomic-embed-text` | ~0.3GB | 768-dim, 8192-token context; locked triple `nomic-embed-text / 768 / ollama` (dimension change = index wipe + re-embed) |
| LLM (generation/Q&A) | `llama3.2:3b` | ~2.0GB | Q4, 128K context; small, instruct-tuned, proven in the [2026-07-03 live smoke](../findings/audits/2026-07-03_live_smoke_report.md) |
| **Total** | | **~2.3GB** | **~3.7GB left for other tenants on the 6GB GPU** |

Do not raise this footprint without a GPU-budget decision. `llama3.2:3b` stays
the default until then.

## 3. Decision criteria for future LLM candidates

When evaluating a replacement or upgrade, check these in order. A model that
fails criterion 1 is out regardless of how well it scores on the rest —
*while the GPU is multi-tenant*.

1. **Quantized footprint ≤ ~2.5GB (Q4).** This is the hard gate on shared
   6GB VRAM. **7-8B models are explicitly NOT recommended** here: at Q4 they
   run ~4.5-5GB resident, which either evicts other tenants' models or forces
   CPU offload (10x+ latency for everyone).
2. **Instruction-following and faithfulness to retrieved context.** RAG
   answering is *instruct* work — synthesize an answer from supplied chunks —
   not open-ended generation. Hallucination resistance when the answer is
   **absent** from the retrieved chunks (a mistral-7b-class trait: saying "the
   context doesn't cover this" instead of inventing) matters more than raw
   benchmark scores.
3. **Long context window.** All retrieved chunks plus the prompt must fit;
   128K+ preferred (llama3.2:3b already provides 128K).
4. **Toggleable reasoning/thinking mode is the ideal shape.** Reason on hard
   multi-hop questions, take the fast path otherwise — rather than paying
   reasoning latency on every query. `qwen3.5:4b` (~2.5GB Q4, 256K context,
   toggleable thinking mode, released Mar 2026) is the **designated upgrade
   candidate** WHEN GPU budget allows: it costs +0.5GB over the current
   resident total, so it needs an explicit GPU-budget decision first.
5. **Concurrency behavior.** All instances share ONE loaded copy; throughput
   is governed by:
   - **Ollama server knobs** (set on the shared host, affect all tenants):
     `OLLAMA_NUM_PARALLEL` (concurrent requests per model),
     `OLLAMA_MAX_LOADED_MODELS` (resident-model cap), and per-request
     `keep_alive` (how long a model stays resident after use).
   - **Per-instance knobs** (already shipped in this repo):
     `ingestion.concurrent_files` in `config/config.yaml` caps concurrent
     embedding requests per instance, and `ingestion.retry_backoff` absorbs
     transient timeouts — see [PERFORMANCE.md](../PERFORMANCE.md) section 1.
   Remember: **ingest bursts (embedding) are the real contention source, not
   chat.** When many instances ingest at once, lower each instance's
   `concurrent_files` to 1-2 rather than reaching for a different model.
6. **License compatible with internal use.** Check the model's license
   (Llama community license, Apache 2.0, etc.) before adopting.

## 4. Upgrade path (documented, not actioned)

If the GPU ever becomes **dedicated** to this fleet or is replaced with a
larger one:

- **Quality step-up**: `llama3.1:8b` Q4 (~5GB resident, 128K context) — the
  standard-quality 8B instruct pick. Only viable when nothing else needs the
  GPU; on today's shared 6GB card it would consume nearly everything.
- **Reasoning-heavy alternatives** (e.g. deepseek-r1 distills): trade latency
  for multi-hop synthesis. Caveat for RAG specifically: always-on reasoners
  can **over-reason past the retrieved evidence** — reinterpreting or
  second-guessing chunks instead of staying faithful to them. Prefer
  **toggleable-thinking** models (criterion 4) so reasoning is spent only
  where it pays.
- Any upgrade still passes through the section 3 criteria; only the footprint
  ceiling in criterion 1 moves.

## 5. How to switch models

Consistent with the [UPGRADE_2026-07-03.md](../deployment/UPGRADE_2026-07-03.md)
procedure. Switching the **LLM** is cheap (no index impact); switching the
**embedding model** is not (dimension change = wipe + full re-embed — see the
canonical-triple warning in `config/config.yaml`).

```bash
# 1. Pull the new model on the HOST Ollama (the stack runs no Ollama of its own)
ollama pull qwen3.5:4b

# 2. Point the stack at it — canonical source is config/config.yaml:
#      llm:
#        model: qwen3.5:4b
#    (deploy.sh writes it into .env as LLM_MODEL; setting LLM_MODEL directly
#     in .env also works if you bypass config.yaml)

# 3. Re-check: doctor verifies Ollama reachability + that the model is pulled
./deploy.sh doctor
#    -> "[OK] LLM model 'qwen3.5:4b' is pulled"
#    A WARN here is non-fatal by design: search still works, Q&A/chat will fail.

# 4. Restart so the api container picks up the new env
./deploy.sh restart
```

Rollback is the same procedure with the previous model name; no data
migration is involved for LLM swaps.

## 6. Sources

Rankings and footprint/context data cross-checked against 2026 surveys:

- [morphllm.com/best-ollama-models](https://morphllm.com/best-ollama-models)
- [localaimaster.com/blog/best-local-ai-models-8gb-ram](https://localaimaster.com/blog/best-local-ai-models-8gb-ram)
- [serverman.co.uk/ai/ollama/best-ollama-models-for-rag](https://serverman.co.uk/ai/ollama/best-ollama-models-for-rag)
- [sitepoint.com/best-local-llm-models-2026](https://sitepoint.com/best-local-llm-models-2026)

---

## Related docs

- [PERFORMANCE.md](../PERFORMANCE.md) — concurrency/retry/chunking knobs referenced above
- [findings/embedding-model-selection-2026.md](../findings/embedding-model-selection-2026.md) — embedding-model decision record (nomic-embed-text)
- [deployment/UPGRADE_2026-07-03.md](../deployment/UPGRADE_2026-07-03.md) — migration guide incl. the doctor workflow
- [findings/audits/2026-07-03_live_smoke_report.md](../findings/audits/2026-07-03_live_smoke_report.md) — live smoke validating the canonical picks end-to-end

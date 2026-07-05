# LLM Default Alignment Report — llama3.1:70b → llama3.2:3b

**Date**: 2026-07-03
**Agent**: py-dev@exudeai:rag-bootstrap:LLM-DEFAULT
**Decision**: canonical LLM default is now `llama3.2:3b` (already pulled locally, proven by the 2026-07-03 live smoke). `llama3.1:70b` is no longer the default anywhere in the config surface. EMBEDDING_MODEL untouched (`nomic-embed-text`).

## Files changed (6 edits, 5 files)

| File | Change |
|------|--------|
| `.env` (line 47) | `LLM_MODEL=llama3.2:3b` |
| `.env.example` (line 101-102) | `LLM_MODEL=llama3.2:3b` + one-line comment: default is small/pulled-by-smoke; larger models optional, set `LLM_MODEL` and `ollama pull` accordingly |
| `config/config.yaml` (llm section, line 185) | `model: llama3.2:3b` |
| `app/config.py` (line 42) | `LLM_MODEL: str = "llama3.2:3b"` |
| `README.md` (lines 214, 401) | config example + env-var table updated to `llama3.2:3b` |

All other `.env` values preserved. Only the `llm:` section of `config.yaml` touched.

## Self-verification

- `python3 -c "import yaml; yaml.safe_load(open('config/config.yaml'))"` → **yaml OK**
- `grep llama3.1:70b` across all work-zone files (`.env`, `.env.example`, `config/config.yaml`, `app/config.py`, `README.md`, `docs/deployment/UPGRADE_2026-07-03.md`, `docs/TROUBLESHOOTING.md`, `docs/PERFORMANCE.md`) → **zero matches**
- `EMBEDDING_MODEL=nomic-embed-text` confirmed unchanged in `.env`, `.env.example`, `app/config.py`
- `docs/deployment/UPGRADE_2026-07-03.md`, `docs/TROUBLESHOOTING.md`, `docs/PERFORMANCE.md` contained no 70b mentions — no edits needed there
- `docs/archive/` and `docs/findings/audits/` left untouched per instructions

## Out-of-zone remnants (NOT edited — read-only per work zone)

Functional fallbacks that still say `llama3.1:70b` (inert in normal operation because `.env` now sets the value, but they would resurface 70b if `.env`/`config.yaml` were absent):

1. **`docker-compose.yml:162`** and **`docker-compose.multi-kb.yml:205`** — `LLM_MODEL: ${LLM_MODEL:-llama3.1:70b}` compose fallback
2. **`deploy.sh:188,316,351,501`** — four `CONFIG_LLM_MODEL`/`LLM_MODEL` fallbacks
3. **`app/config_manager.py:330`** — 70b inside the embedded default multi-KB config template string
4. **`tests/test_config.py:24`** — asserts `s.LLM_MODEL == "llama3.1:70b"`; **this assertion now mismatches the new `app/config.py` default and will fail** unless the test injects the value. (Note: the same test also asserts `EMBEDDING_MODEL == "all-MiniLM-L6-v2"` vs the current `nomic-embed-text` default, so it may already have been stale before this change.)
5. **`tests/test_llm.py`** — uses mocked settings pinned to 70b; self-consistent mocks, should still pass
6. **`tests/run_integration_tests.sh:49-52`** — checks Ollama for 70b presence
7. **Docs outside zone**: `docs/scope.md`, `docs/roadmap.md`, `docs/todo.md`, `docs/deployment/PRODUCTION_DEPLOYMENT_RUNBOOK.md:92`, `docs/deployment/INFRASTRUCTURE_DIAGNOSTICS.md`, `docs/integration/*` (4 files), `docs/benchmarking/*` (3 files) — still describe 70b as the default

**Recommendation for a follow-up (separate authorization)**: align items 1-4 and the runbook line 92; the rest are historical/illustrative.

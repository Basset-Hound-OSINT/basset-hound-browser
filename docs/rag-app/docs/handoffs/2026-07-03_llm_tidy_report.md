# LLM Tidy Report — final residuals (llama3.1:70b → llama3.2:3b)

**Agent**: py-dev@exudeai:rag-bootstrap:LLM-TIDY
**Date**: 2026-07-03
**Status**: COMPLETE — all in-zone residuals fixed; out-of-zone stale docs flagged below

## Changes

| File | Change |
|---|---|
| `tests/test_config.py:18-22` | Stale assertions fixed: `EMBEDDING_MODEL "all-MiniLM-L6-v2"` → `"nomic-embed-text"`, `EMBEDDING_DIMENSION 384` → `768`, `EMBEDDING_BACKEND "sentence-transformers"` → `"ollama"` (all three were stale vs `app/config.py`) |
| `tests/test_config.py:10-18` (`_make_settings`) | Added `_env_file=None` — required to make the test pass hermetically. Once the stale line-18 assertion stopped failing first, the previously-masked local `.env` leaked in (`PROJECT_NAME=researchhub-docs-rag` != default `rag-bootstrap`). Test now asserts code defaults, not machine state. `monkeypatch.setenv` override test unaffected (env vars still read; only the .env file is skipped). |
| `tests/run_integration_tests.sh:49-54` | Ollama preflight now env-driven: `LLM_MODEL="${LLM_MODEL:-llama3.2:3b}"` and greps for `$LLM_MODEL` instead of hardcoded `llama3.1:70b` (matches repo idiom / compose fallback) |
| `docs/scope.md:58` | Objectives: `default: llama3.1:70b` → `llama3.2:3b` |
| `docs/scope.md:95` | Stack table: LLM row → `llama3.2:3b via Ollama` |
| `docs/roadmap.md:57` | Short-term (Current) checklist: `(llama3.1:70b default)` → `(llama3.2:3b default)` |
| `docs/todo.md:138` | Notes: `Default LLM: llama3.1:70b` → `llama3.2:3b` |

## Intentionally NOT changed (per instruction: leave historical mentions alone)

- `docs/roadmap.md:121` — under "### Completed / Completed on 2026-01-27" (dated completion log)
- `docs/todo.md:125` — under "## Recently Completed / ### 2026-01-27" (dated completion log)

These are the only two `llama3.1:70b` hits left in the work-zone files.

## Verification

- `python3 -m pytest tests/test_config.py -q` → **4 passed** (was 1 failed before fix)
- `bash -n tests/run_integration_tests.sh` → OK
- Grep with specified exclusions (docs/archive/, docs/findings/audits/, docs/handoffs/, tests/test_llm.py):
  - `tests/test_config.py`, `tests/run_integration_tests.sh`, `docs/scope.md` → **zero hits**
  - `docs/roadmap.md` / `docs/todo.md` → only the two dated-historical lines above

## Out-of-zone residuals (READ_ONLY for this agent — flagged, not edited)

14 doc files still reference `llama3.1:70b` outside the specified exclusions and outside this work zone. Most notable (present-tense / copy-pasteable):

1. `docs/deployment/PRODUCTION_DEPLOYMENT_RUNBOOK.md:92` — `LLM_MODEL=llama3.1:70b` in an env example (highest priority: runbook users will copy it)
2. `docs/integration/RAG_INTEGRATION_NOTES.md:44,112,444,451` — "Current LLM Model: llama3.1:70b" + config/rollback snippets
3. `docs/deployment/INFRASTRUCTURE_DIAGNOSTICS.md` — ~12 refs incl. pull instructions
4. `docs/integration/RAG_PRODUCTION_API.md`, `docs/integration/API_V3_CHAT_STREAMING.md`, `docs/integration/RAG_INTEGRATION_TESTING_GUIDE.md` — sample payloads/pulls
5. `docs/benchmarking/BENCHMARK_10K_README.md`, `BENCHMARK_EXECUTION_PLAN.md`, `BENCHMARK_IMPLEMENTATION_SUMMARY.md` — benchmark configs (arguably historical: results were measured on 70b)
6. `docs/findings/` (non-audit): 5 files — dated findings/reports, likely historical

Recommend a follow-up docs-zone agent decide per-file (runbook/integration = update; benchmarking/findings = probably historical, leave).

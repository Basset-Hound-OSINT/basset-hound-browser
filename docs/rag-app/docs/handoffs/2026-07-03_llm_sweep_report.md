# LLM Default Sweep Report — remaining llama3.1:70b → llama3.2:3b fallbacks

**Date**: 2026-07-03
**Agent**: py-dev@exudeai:rag-bootstrap:LLM-SWEEP
**Scope**: finish the canonical-default sweep started in `docs/handoffs/2026-07-03_llm_default_report.md`

## Changes (8 edits, 5 files, all in work zone)

| File | Line(s) | Change |
|---|---|---|
| `docker-compose.yml` | 162 | `${LLM_MODEL:-llama3.1:70b}` → `${LLM_MODEL:-llama3.2:3b}` |
| `docker-compose.multi-kb.yml` | 205 | `${LLM_MODEL:-llama3.1:70b}` → `${LLM_MODEL:-llama3.2:3b}` |
| `deploy.sh` | 188 | python-parser default `llm.get('model', 'llama3.2:3b')` |
| `deploy.sh` | 316 | `LLM_MODEL=${CONFIG_LLM_MODEL:-llama3.2:3b}` |
| `deploy.sh` | 351 | `env_ensure LLM_MODEL "${CONFIG_LLM_MODEL:-llama3.2:3b}"` |
| `deploy.sh` | 501 | preflight `llm_model` fallback → `llama3.2:3b` |
| `app/config_manager.py` | 330 | generated config template `model: llama3.2:3b` |
| `tests/test_config.py` | 24 | assertion → `s.LLM_MODEL == "llama3.2:3b"` |

## Verification

- `bash -n deploy.sh` — PASS
- `docker compose -f docker-compose.yml config` — PASS
- `docker compose -f docker-compose.multi-kb.yml config` — PASS
- `python3 -m py_compile app/config_manager.py tests/test_config.py` — PASS
- Direct default check: `Settings(_env_file=None).LLM_MODEL == "llama3.2:3b"` — **PASS** (line-24 assertion is now correct against `app/config.py`)
- Grep sweep (excluding `docs/archive/`, `docs/findings/audits/`): **zero hits in the functional code/config surface** (compose files, deploy.sh, app/, .env*, config/, README)

## Known limitation: full test run

`pytest tests/test_config.py::TestSettings::test_default_values` still FAILS — but at **line 18**, a PRE-EXISTING stale assertion `EMBEDDING_MODEL == "all-MiniLM-L6-v2"` vs the current `nomic-embed-text` default (out of zone; already flagged in the 2026-07-03 llm_default_report). The failure is before line 24 is reached; the line-24 change itself was verified correct by the direct check above.

## Out-of-zone flags (NOT edited — remaining llama3.1:70b hits outside docs)

1. **`tests/test_config.py:18`** — stale `EMBEDDING_MODEL` assertion (see above); one-line fix to `"nomic-embed-text"` would make the whole default test green.
2. **`tests/run_integration_tests.sh:49-52`** — Ollama preflight still greps for `llama3.1:70b` pulled; will report "NOT found" against the new default env. Should become `llama3.2:3b` (or read `$LLM_MODEL`).
3. **`tests/test_llm.py`** (7 refs) — all are explicit mock injections (`mock_settings.LLM_MODEL = "llama3.1:70b"` + matching asserts); **self-consistent, does not break** from the default change. Cosmetic-only if someone wants to modernize.
4. **docs/** — many descriptive/historical references (`docs/scope.md:58,95`, `docs/roadmap.md:57,121`, `docs/todo.md:125,138`, integration/deployment/benchmarking guides). scope/roadmap/todo describe the default and are now stale prose; the rest are historical records.

No commits made. No docker containers started (`docker compose config` only renders).

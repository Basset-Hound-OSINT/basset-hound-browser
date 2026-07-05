# WS-APPCONFIG Handoff Report — App config defaults + path anchoring

**Date**: 2026-07-03
**Instance**: py-dev@exudeai:rag-bootstrap:WS-APPCONFIG
**Status**: COMPLETE (all 3 tasks; all acceptance criteria verified at runtime)

## Context

A prior attempt at this workstream was killed mid-edit by a rate limit. Both zone
files already contained a near-complete draft. This pass reviewed every task
against actual file content, kept the good partial work, fixed one edge case,
and ran the full self-verify.

## Files changed

### `app/config.py`
| Lines | Change |
|---|---|
| 1-2 | Added `import os`, `from pathlib import Path` (prior draft, kept) |
| 6-7 | `PACKAGE_ROOT = Path(__file__).resolve().parent.parent` — anchors to `rag-bootstrap/` (prior draft, kept) |
| 9-11 | `ENV_FILE = os.getenv("RAG_ENV_FILE") or str(PACKAGE_ROOT / ".env")` — **fixed this pass**: prior draft used `os.getenv(k, default)`, which let an *empty* `RAG_ENV_FILE` produce `env_file=""`; `or` treats empty-as-unset, matching the walrus idiom in config_manager.py |
| 26-28 | `EMBEDDING_MODEL="nomic-embed-text"`, `EMBEDDING_DIMENSION=768` (canonical triple; also drives `Vector(settings.EMBEDDING_DIMENSION)` in database.py) (prior draft, kept) |
| 34-35 | `EMBEDDING_BACKEND="ollama"` default (prior draft, kept) |
| 58 | `RAG_PORT: int = 10000` (prior draft, kept) |
| 69 | `model_config` `env_file` uses anchored `ENV_FILE` instead of CWD-relative `".env"` (prior draft, kept) |

### `app/config_manager.py`
| Lines | Change |
|---|---|
| 21-22 | `PACKAGE_ROOT` anchor (prior draft, kept) |
| 25-48 | `default_config_path()`: `RAG_CONFIG_FILE` override → `<root>/config/config.yaml` canonical → `<root>/config.yaml` legacy fallback → canonical path for downstream warnings (prior draft, kept) |
| 209-216 | `ConfigManager.__init__` default changed from CWD-relative `Path(config_path or "config.yaml")` to `Path(config_path) if config_path else default_config_path()`; docstring updated (prior draft, kept) |

Note: `EXAMPLE_CONFIG` embedding block in config_manager.py was already canonical
(nomic-embed-text / 768 / ollama) at HEAD; no change needed.

## Acceptance-criteria evidence

Verify script: `scratchpad/verify_ws_appconfig.py`, run with CWD=`/` (arbitrary,
outside repo), env sanitized of `EMBEDDING_*` / `RAG_*` leakage. 13/13 PASS.

| Criterion | Evidence |
|---|---|
| Importing app.config from arbitrary CWD yields nomic-embed-text/768/ollama and RAG_PORT 10000 without a .env present | PASS — CWD=`/`, `RAG_ENV_FILE=/nonexistent/no.env`: model=nomic-embed-text, dim=768, backend=ollama, RAG_PORT=10000 |
| RAG_ENV_FILE override honored | PASS — temp env file with `EMBEDDING_MODEL=override-model` / `RAG_PORT=12345` loaded exactly; empty `RAG_ENV_FILE` falls back to `<root>/.env` |
| RAG_CONFIG_FILE override honored | PASS — `ConfigManager()` with `RAG_CONFIG_FILE=<temp yaml>` resolves that path and reads `embedding.model=cfg-override` from it |
| Default resolution no longer depends on CWD | PASS — from CWD=`/`: `ENV_FILE=/home/devel/exudeai/rag-bootstrap/.env`; `default_config_path()=/home/devel/exudeai/rag-bootstrap/config/config.yaml`; `ConfigManager()` loads canonical yaml (embedding.model=nomic-embed-text) |
| Backward compat | PASS — explicit `ConfigManager(config_path=...)` arg still wins; sole call site `app/main.py:72` (`ConfigManager()`, no args) now CWD-independent |
| Static checks | `python3 -m py_compile` clean on both files |

Verify script is temporary (testing-discipline rule); lives in scratchpad, not repo.

## Deviations

None. No edits outside the two zone files. No commits, no docker.

## Deferred (per binding design decisions)

Large items (symbol-aware chunking, setup wizard, backup/restore, /stats dashboard)
are DEFERRED per the resolved design decisions — none touch this zone anyway.
No sentence-transformers bundling; guard lives in WS-EMBED's zone, not here.

## Coverage of audit findings

- emb-F1 (config.py:18/19/26 sentence-transformers defaults) — CLOSED
- ports-F3 (config.py:49 RAG_PORT 8100) — CLOSED
- paths-F6/F7 (config.py:60 CWD-relative env_file; config_manager.py:186 CWD-relative config.yaml) — CLOSED
- sugg-F3 (config side) — CLOSED

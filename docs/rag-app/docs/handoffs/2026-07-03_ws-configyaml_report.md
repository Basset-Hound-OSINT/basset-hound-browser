# WS-CONFIGYAML Handoff Report — 2026-07-03

**Instance**: py-dev@exudeai:rag-bootstrap:WS-CONFIGYAML
**Zone**: `config/config.yaml` (only file edited)
**Status**: complete

## Context: partial-state recovery

A prior attempt at this workstream was killed mid-edit. `git diff` showed it had
already landed: port 10000 + band comment, the exclude glob block, and the
concurrent_files/retry_backoff knobs. All of that was reviewed against the plan
spec and kept as-is (values matched the plan exactly, including the 10000-10019
band / "+20 and up" wording from the port table). This session completed the two
missing pieces: the embedding-block canonical lock note and the documented
future multi-embedding-model stanza.

## Files changed

`config/config.yaml` (sole zone file):

| Lines | Change | Origin |
|-------|--------|--------|
| 10 | Quick-start comment: default port 8100 → 10000 | prior attempt, verified |
| 28-36 | Port scheme comment (RAG_PORT_BASE=10000, 10000-10019 band, +20 for second instance) + `port: 10000` | prior attempt, verified |
| 70-81 | `ingestion.exclude` globs: `.git/`, `node_modules/`, `data/`, `*.pdf` (exclude wins over extensions; PDF opt-back-in documented) | prior attempt, verified |
| 102-113 | `ingestion.concurrent_files: 5` + `ingestion.retry_backoff: exponential` (semaphore cap / retry strategy consumed by WS-EMBED and WS-INGEST) | prior attempt, verified |
| 126-134 | CANONICAL DEFAULT (locked) note on embedding block: triple must stay in sync with .env.example / docker-compose.yml / app/config.py; dimension change ⇒ wipe + re-embed; references deploy.sh dim-guard | this session |
| 152-153 | Backend comment: sentence-transformers NOT bundled, actionable guard error (per resolved design decision 1) | this session |
| 157-171 | Documented FUTURE per-corpus multi-embedding-model stanza — fully commented out, schema-reserving only, explicitly marked "ignored if uncommented / not yet implemented" | this session |

`ingestion.extensions` (lines 61-68) already existed upstream — task 3's
"add extensions" was already satisfied; only `exclude` needed adding.

## Acceptance-criteria evidence

Verified via `python3` + `yaml.safe_load` (parse OK, no errors):

| Criterion | Evidence | Result |
|-----------|----------|--------|
| `port: 10000` present | `cfg["network"]["port"] == 10000` (line 36) | PASS |
| Embedding block is canonical triple | model=nomic-embed-text (142), dimension=768 (148), backend=ollama (155) | PASS |
| `ingestion.extensions` present | list incl. pdf/md/txt/log/json/yaml/yml (61-68) | PASS |
| `ingestion.exclude` present | exactly `[".git/", "node_modules/", "data/", "*.pdf"]` (77-81) | PASS |
| `concurrent_files` / `retry_backoff` present | 5 / exponential (107, 113) | PASS |
| Valid YAML | `yaml.safe_load` succeeds; future `models:` stanza stays commented (no live key) | PASS |

## Deferred (per binding decisions)

- Symbol-aware chunking, setup wizard, backup/restore, /stats dashboard: DEFERRED per resolved design decision 5 — no config keys added for them.
- Multi-embedding-model support: documented as a commented, schema-reserving stanza only (per task wording "documented (future)"); no implementation.

## Deviations

None. No files outside the zone were edited. Cross-file consumers of the new
knobs (app/embeddings.py semaphore/retry, app/ingestion.py exclude threading,
deploy.sh dim-guard) are owned by WS-EMBED / WS-INGEST / WS-DEPLOY per the plan
and are referenced in comments only.

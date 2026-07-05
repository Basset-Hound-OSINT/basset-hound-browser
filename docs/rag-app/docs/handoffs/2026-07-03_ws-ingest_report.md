# WS-INGEST Handoff Report — Ingestion + Watcher Hardening

- **Instance**: py-dev@exudeai:rag-bootstrap:WS-INGEST
- **Date**: 2026-07-03
- **Status**: COMPLETE (1 item explicitly deferred by design decision)
- **Zone files**: `app/ingestion.py`, `app/watcher.py`
- **Partial-state check**: `git diff` on both zone files was EMPTY at start (the prior rate-limit-killed attempt never touched them) — implemented fresh.

## Files changed

### `app/ingestion.py`

| Lines | Change |
|---|---|
| 1-24 | New imports: `datetime`, `fnmatch`, `Sequence`, sqlalchemy `select`, `Config`/`default_config_path` from `config_manager`, WS-DB helpers `get_document_by_hash` / `insert_document_dedup`. `app/database.py` NOT edited — consumed via imports per the DB meta contract. |
| 138-190 | New config-threading helpers: `_load_ingestion_config()` (reads `ingestion:` block from config.yaml via CWD-independent `default_config_path()`), `_normalize_extensions()` (accepts `md` or `.md`, intersects with handler-supported set, warns on unsupported), `_is_excluded()` (dir patterns `name/` match path components; other patterns fnmatch against filename + relative POSIX path; exclude wins over extensions — matches config.yaml documented semantics). |
| 214-221 | `ingest_file`: dedup **pre-check** via `get_document_by_hash` BEFORE the embedding call — duplicate content returns the existing `Document` (and un-expires its chunks) without wasting an embed round-trip and without `IntegrityError`. |
| 231-253 | Store path now uses WS-DB `insert_document_dedup` (`INSERT ... ON CONFLICT (content_hash) DO NOTHING`); the `None` (concurrent-race) branch fetches the winner row and returns it. `str(filepath.resolve())` kept and documented as host-openable under the `DOCS_PATH` same-path `:ro` mount (container path == host path). |
| 269-316 | `ingest_directory`: new optional `extensions`/`exclude` params (defaults `None` → loaded from config.yaml `ingestion.extensions`/`ingestion.exclude`; API can override — WS-API consumes this signature). Exclusion applied to path relative to ingest root. `except` block now does `await session.rollback()` before continuing so one bad file cannot cascade `PendingRollbackError` (audit sugg-F9, old :209). Ends with a stale-chunk expiry pass. |
| 319-375 | New `expire_stale_chunks(session, root)`: documents stored under `root` whose filepath no longer exists get their chunks marked `metadata.expired=true` + `expired_at` (scoped to `root` so unmounted-but-live corpora are never touched); `_unexpire_chunks()` clears the marker when identical content is re-seen. |
| 378-379 | Deferred note for symbol-aware chunking (sugg-F22). |

### `app/watcher.py`

| Lines | Change |
|---|---|
| 1-20 | Docstring updated: archival is opt-in via `WATCHER_ARCHIVE_MODE` (off/copy/move); `os` imported. |
| 115-175 | `DocumentWatcher.__init__`: new `archive_mode` param → param > `$WATCHER_ARCHIVE_MODE` > **default `"off"`** (invalid values warn + disable). Compose-passed env knobs now actually honored: `WATCHER_WATCH_DIR`, `WATCHER_MAX_RETRIES`, `WATCHER_RETRY_DELAY`, `WATCHER_POLL_INTERVAL` (docker-compose.yml:170-173 previously dead). New `archive_enabled` property. |
| 195-215 | `start()`: watch-dir mkdir wrapped (warns on read-only mount instead of crashing); archive-dir mkdir only attempted when archiving enabled, and failure downgrades mode to `off` with a warning. |
| 345-350 | `_process_queue`: `_archive_file` called only when `archive_enabled`. |
| 353-412 | `_ingest_with_retry` uses instance `max_retries`/`retry_delay` (env-tunable). |
| 414-478 | `_archive_file`: no-op guard when off; **refuses politely (warn, no raise) on read-only mounts** — `move` requires a writable source dir, both modes require a creatable+writable archive dir; `copy` mode uses `shutil.copy2` (source untouched), `move` keeps legacy behavior. Event payload includes `archive_mode`. |
| 495-509 | `get_stats()` reports `archive_mode`. |
| 511-541 | `run_watcher()` passes `archive_mode` through. |

## Acceptance-criteria evidence

| Criterion | Evidence |
|---|---|
| Re-ingesting same directory twice is idempotent (no PendingRollbackError, duplicates skipped) | Static + code-path proof: `ingest_file` pre-checks `get_document_by_hash` and returns the existing row before embedding (ingestion.py:218-224); race window covered by `insert_document_dedup` ON CONFLICT DO NOTHING (ingestion.py:233-253) which never raises IntegrityError (WS-DB contract); residual failures in the walk now `await session.rollback()` (ingestion.py:310) so the session is never left poisoned. Live double-ingest smoke deliberately not run (no docker per instance discipline); flagged for the orchestrator's wave-2 live check. |
| Config extensions/excludes are honored (excluded paths not ingested) | Functional smoke (run, PASSED): `_load_ingestion_config()` returns config.yaml's 7 extensions + 4 exclude globs; `_is_excluded` excludes `.git/config.yaml`, `sub/node_modules/pkg/readme.md`, `manual.pdf`, `data/dump.json` and admits `docs/guide.md`, `mydata/notes.md`; `_normalize_extensions(["md",".TXT","docx"])` → `{".md",".txt"}` with warning. `ingest_directory` threads these at :287-299. |
| Watcher does not move source files unless archiving is explicitly enabled | Functional smoke (run, PASSED): default `archive_mode == "off"`, `_archive_file` is a guarded no-op; `copy` mode leaves the source in place; `move` on a `chmod 555` source dir refuses with a warning and the source survives. Invalid mode falls back to `off`. |
| (spec task) host-openable abs filepath | `str(filepath.resolve())` retained + documented against the `DOCS_PATH:${DOCS_PATH}:ro` same-path mount (docker-compose.yml:189); under that mount stored paths are identical on host and container. |
| (spec task) stale chunks expired each pass | `expire_stale_chunks` invoked at end of every `ingest_directory` (ingestion.py:312), scoped to the ingested root, marker in chunk `metadata` JSON, cleared on re-ingest. |
| Self-verify | `python3 -m py_compile app/ingestion.py app/watcher.py` → OK; two inline (non-persisted) functional smokes PASSED; `ingest_directory` signature verified backward-compatible with `main.py:391/636` call sites (new params optional, at end). |

## Interface notes for WS-API
- `ingest_directory(dirpath, session, embedding_service, extensions=None, exclude=None)` — pass `DirectoryIngestRequest.extensions` / `.exclude` straight through; `None` means "use config.yaml".
- `ingest_file` may return an **existing** `Document` on duplicate content (idempotent), never raises on dup.
- Expired chunks carry `metadata.expired == true` — search may want to filter/downrank (WS-API's call).
- Watcher stats now include `archive_mode` (surfaces via existing `/api/watcher/status`).

## Deferred (by binding design decision #5)
- **Symbol-aware chunking for .py/.js/.go (sugg-F22)**: NOT implemented; noted at ingestion.py:378-379. Recommend a future `ingestion.chunking: symbol|sentence` config knob when picked up.

## Deviations (edits needed OUTSIDE my zone — not made)
1. `.env.example` (WS-ENV zone): `WATCHER_ARCHIVE_MODE` (off|copy|move, default off) is a new env knob and should be documented next to the other watcher vars.
2. `docker-compose.yml` (WS-COMPOSE zone): consider adding `WATCHER_ARCHIVE_MODE: ${WATCHER_ARCHIVE_MODE:-off}` to the api service env block (works without it — watcher reads the process env — but compose passthrough makes it operator-settable).
3. Live end-to-end double-ingest idempotency smoke requires the stack up (docker) — out of instance discipline; left to the orchestrator's wave-2 verification.

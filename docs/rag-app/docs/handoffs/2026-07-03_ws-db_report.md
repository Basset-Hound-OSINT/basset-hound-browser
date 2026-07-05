# WS-DB Handoff Report — DB meta table + dedup helper

- **Instance**: py-dev@exudeai:rag-bootstrap:WS-DB
- **Date**: 2026-07-03
- **Zone**: `app/database.py` (only file edited)
- **Status**: COMPLETE

## Partial-state recovery

A prior attempt at this workstream was killed mid-edit by a rate limit. On arrival,
`git diff -- app/database.py` showed a substantial draft already in the working tree.
The draft was reviewed line-by-line against the WS-DB spec (`plan_workstreams.json`,
workstream id `WS-DB`) and the unified plan's DB-meta-contract section, then validated
statically. It proved **complete and correct** — no corrections or reverts were needed.
No re-edits were made; verification confirmed the existing state.

## Changes in `app/database.py` (line refs = current file)

| Lines | Change |
|---|---|
| 13 | `select` added to sqlalchemy imports |
| 16 | `from sqlalchemy.dialects.postgresql import insert as pg_insert` |
| 77-78 | `META_ROW_ID = 1` single-row PK constant |
| 81-105 | `RagMeta` model, table `rag_meta`: `id`, `embedding_model`, `dimension`, `project_name`, `docs_root`, `indexed_at`, `indexed_commit_sha` |
| 125-127 | `get_meta(session)` — read helper, returns row or `None` pre-first-ingest |
| 130-176 | `upsert_meta(session, ...)` — idempotent `INSERT ... ON CONFLICT (id) DO UPDATE`; defaults model/dim/project from `settings`, `indexed_at` to now; preserves stored `docs_root`/`indexed_commit_sha` when not passed; `commit=False` joins caller transaction |
| 184-224 | `insert_document_dedup(session, ...)` — `INSERT ... ON CONFLICT (content_hash) DO NOTHING RETURNING id`; returns new `Document` or `None` on duplicate; never raises `IntegrityError`, never poisons the session; does not commit (caller owns txn so chunks can join) |
| 227-232 | `get_document_by_hash(session, content_hash)` — fetch existing row on dedup skip |

Contract anchors deliberately UNCHANGED:
- `Vector(settings.EMBEDDING_DIMENSION)` (now line 65) — dim driven by canonical 768 default.
- `expire_on_commit=False` (now line 23).
- `Document.content_hash` `unique=True` (now line 37) — the constraint the dedup helper targets.
- `init_db()` untouched; `Base.metadata.create_all` auto-creates `rag_meta` (no migration needed).

## Acceptance-criteria evidence

| Criterion | Evidence (static — no containers started, per discipline) |
|---|---|
| Meta row created at first ingest and readable via helper (proven by WS-API `/api/status`) | WS-DB side proven: `python3 -c "import app.database"` succeeds (SQLAlchemy 2.0.45); `Base.metadata.tables` contains `rag_meta` with all 7 contract columns; `upsert_meta` statement compiles to `INSERT INTO rag_meta ... ON CONFLICT (id) DO UPDATE` under the postgresql dialect; `get_meta` exported. End-to-end proof lands with WS-INGEST (calls `upsert_meta` at ingest) + WS-API (`/api/status` reads `get_meta`) — both list `database.py` read-only and consume via imports per the plan. |
| Dedup helper inserts-or-skips without raising on duplicate `content_hash` | `insert_document_dedup` statement compiles to `INSERT INTO documents ... ON CONFLICT (content_hash) DO NOTHING RETURNING documents.id`; duplicate path returns `None` via `scalar_one_or_none()` — no exception, no pending rollback. `python3 -m py_compile app/database.py` OK. |
| Keep `Vector(settings.EMBEDDING_DIMENSION)` and `expire_on_commit=False` unchanged | Both asserted present verbatim in the file (lines 65 / 23); `git diff` shows no hunk touching them. |

Verification transcript highlights (all PASS):
- `py_compile` OK
- module import OK; tables: `chunks`, `documents`, `rag_meta`
- `rag_meta` cols: `dimension, docs_root, embedding_model, id, indexed_at, indexed_commit_sha, project_name`
- dedup SQL contains `ON CONFLICT (content_hash) DO NOTHING`
- meta upsert SQL contains `ON CONFLICT (id) DO UPDATE`
- exports present: `get_meta`, `upsert_meta`, `insert_document_dedup`, `get_document_by_hash`, `RagMeta`, `META_ROW_ID`
- `settings.EMBEDDING_MODEL` / `EMBEDDING_DIMENSION` / `PROJECT_NAME` confirmed present in `app/config.py` (768 / nomic-embed-text / rag-bootstrap)

## Import contract for WS-INGEST / WS-API (consume, do not edit)

```python
from .database import (
    RagMeta, META_ROW_ID,
    get_meta, upsert_meta,
    insert_document_dedup, get_document_by_hash,
)
```

- WS-INGEST: call `insert_document_dedup(...)` (returns `None` on duplicate — skip or fetch
  via `get_document_by_hash`), and `upsert_meta(...)` at end of each ingest pass (pass
  `docs_root=`/`indexed_commit_sha=` when known). Still add `await session.rollback()` in the
  ingest except-block per its own spec (sugg-F9 ingest side).
- WS-API: `/api/status`, `/health/index`, and the dim-mismatch startup guard read via
  `get_meta(session)` (returns `None` before first ingest — handle that case).

## Deferred (per resolved decision #5)

None of the five deferred large items (symbol-aware chunking, setup wizard, backup/restore,
`/stats` dashboard) touch `app/database.py`; nothing deferred within WS-DB itself. No schema
was added for chunk-expiry marking — WS-INGEST's stale-chunk expiry can use existing columns
(`chunks.metadata` JSON) or request a follow-up if a dedicated column proves necessary.

## Deviations

None. No files outside the zone were edited; no commits made; no containers started.

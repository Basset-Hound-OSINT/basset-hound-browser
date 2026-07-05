# FIX-TESTS Report — 2026-07-03

**Agent**: py-dev@exudeai:rag-bootstrap:FIX-TESTS
**Status**: complete

## Changes

### 1. `tests/test_main_2026_06_14.py` — async ingest contract sync

- **`test_ingest_directory_400_when_path_not_found`** (kept, updated): the endpoint
  now validates `Path(body.path).is_dir()` synchronously before queueing a job, so
  the old `ingest_directory`-raises-FileNotFoundError monkeypatch is dead code —
  removed it. Assertion updated from `"no such dir" in detail` to
  `"Directory not found" in detail` + path echo, matching `app/main.py:667-671`.
- **`test_ingest_directory_201_and_returns_schemas_on_success`** → renamed
  **`test_ingest_directory_202_returns_pollable_job`**: asserts the new contract
  per `app/main.py` (`response_model=IngestJobSchema`, `status_code=202`):
  - POST with a real `tmp_path` dir (is_dir gate) returns **202** with `job_id`,
    `status == "queued"` (snapshot taken before the background task runs),
    `path`, `created_at`, and `status_url == /api/ingest/status/{job_id}`.
  - Follow-up **GET** on the advertised `status_url` returns 200 with matching
    `job_id`/`path` and a legal job state (`queued|running|completed|failed`).
    Completion is deliberately NOT asserted: the file's Pattern-D style uses a
    bare `TestClient` (no lifespan context manager), which gives no scheduling
    guarantee for `asyncio.create_task` background jobs across requests.
  - Hermeticity monkeypatches added for the background runner's module globals:
    `upsert_meta` (AsyncMock), `_git_head_sha` (AsyncMock → None), `async_session`
    (fake asynccontextmanager), fake `ingest_directory` accepts the new
    `extensions=`/`exclude=` kwargs. `DOCS_PATH` is delenv'd so the
    `RAG_INGEST_ROOT_GUARD` path stays out of scope. Job popped from
    `_INGEST_JOBS` at test end for cross-test independence.
- `/api/ingest/directories` test untouched — that route is still synchronous
  201 + doc-list in `app/main.py` (kept for backward compat), so its test remains valid.

### 2. `tests/test-streaming-and-watcher.sh`

- Line 20: `API_URL="http://localhost:${RAG_PORT:-8100}"` → `${RAG_PORT:-10000}`
  (port scheme rebase; env override still wins).

### 3. `tests/run_integration_tests.sh`

- **No edit needed**: it contains no `${RAG_PORT:-8100}` default. Its only
  `RAG_PORT` reference is a `grep` displaying `.env` contents (line 145) and
  its curl targets are Ollama (11434) and PostgreSQL — no stale 8100 anywhere.

## Self-verification

- `python3 -m py_compile tests/test_main_2026_06_14.py` — OK
- `bash -n tests/run_integration_tests.sh` — OK
- `bash -n tests/test-streaming-and-watcher.sh` — OK
- Grep sweep: no remaining `201`/`8100` references tied to the old
  `/api/ingest/directory` contract in the test file; no `8100` left in either script.
- Suite NOT run, docker NOT touched (per task constraints).

## Deviations

- Task said "Both tests/*.sh scripts" need the 8100→10000 default change;
  `run_integration_tests.sh` has no such default, so only
  `test-streaming-and-watcher.sh` was edited (premise correction, not a skip).
- Follow-up status poll asserts retrievability + legal state instead of
  `completed` — deterministic under the file's bare-TestClient Pattern-D
  style (documented inline in the test).

Per testing-discipline (2026-07-03): existing diagnostics updated, not expanded —
net test count unchanged (2 ingest-directory tests before, 2 after).

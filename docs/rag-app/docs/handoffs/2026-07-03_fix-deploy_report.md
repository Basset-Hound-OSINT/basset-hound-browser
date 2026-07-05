# FIX-DEPLOY Report — deploy.sh do_ingest async-job rewrite

**Date**: 2026-07-03
**Agent**: py-dev@exudeai:rag-bootstrap:FIX-DEPLOY
**Finding**: F3 (MEDIUM) — deploy.sh `do_ingest` parsed the OLD synchronous
`/api/ingest/directory` response; `len(json.load())` on the new 202
`IngestJobSchema` dict counted dict keys as "documents ingested" and the
function returned before the background job finished.

## Change

File: `/home/devel/exudeai/rag-bootstrap/deploy.sh` (only file touched)

`do_ingest` (now ~lines 609-662) rewritten to match the async contract
verified against `app/main.py`:

1. **POST** `/api/ingest/directory` → 202 `IngestJobSchema`; extract `job_id`
   from the JSON body. Missing/unparseable `job_id` → `error` + `continue`
   (per-path fail-soft, matching prior behavior).
2. **Poll** `GET /api/ingest/status/{job_id}` using the script's existing
   wait/retry idiom (`max_wait` / `interval` / `elapsed` loop with `sleep` +
   `printf "."`, same shape as `wait_for_api`). Bounds: `max_wait=1800`s
   (large-corpus ingests), `interval=3`s. Transient curl failures during
   polling are tolerated (empty `job_json`, loop continues until timeout).
3. **Terminal states** (from `IngestJobState` in `app/main.py`:
   `queued | running | completed | failed`):
   - `completed` → count from `documents_ingested` field (int, `or 0`
     null-guard), accumulated into `total_docs`, `success` line per path.
   - `failed` → `error` line with job's `error` field.
   - timeout/unreachable → `error` line with last observed status.

Everything else in deploy.sh untouched.

## Self-verification

- `bash -n deploy.sh` → SYNTAX OK.
- Field names/states grep-verified against `app/main.py` (`IngestJobSchema`:
  `job_id`, `status`, `documents_ingested`, `error`, `status_url`;
  `IngestJobState`: queued/running/completed/failed; endpoints at
  `app/main.py` ~650-690).
- Grepped deploy.sh for `json.load` / `ingest/directory` / `ingest/status`:
  the only remaining `json.load` consumers are the Ollama tags check (~:473)
  and the two `/api/health` pretty-printers (~:693, ~:933) — none consume the
  old ingest response shape.

## Deviations

- None in code. Note: this report file lives in `docs/handoffs/` (outside the
  single-file WORK_ZONE) as explicitly directed by the task instruction.

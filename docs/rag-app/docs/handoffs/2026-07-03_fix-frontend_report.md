# FIX-FRONTEND Report — 2026-07-03

**Instance**: py-dev@exudeai:rag-bootstrap:FIX-FRONTEND
**Status**: complete
**Findings fixed**: F2 (HIGH), F5-frontend

## F2 — /health/index unreachable through nginx (HIGH)

**File**: `frontend/nginx.conf`

`app/main.py` serves `GET /health/index` (route at main.py:1044, `IndexHealthResponse`),
but nginx only proxied `location /api/`, so requests to `/health/index` through the
published port (RAG_PORT 10000) fell into the SPA `try_files` block and were answered
with `index.html` + 200 — silently lying to `client/fallback_policy.py` and
CONSUMING_AGENTS_CONTRACT.md consumers.

**Fix**: added a `location /health/` block proxying to `http://api:8000`, same
header/style pattern as the existing `/api/` block (no long timeouts / buffering
knobs — health checks are short GETs).

Bare `/health` check: grepped all `@app.get/post/...` decorators in `app/main.py` —
the app serves only `/api/health`, `/api/v1/health`, and `/health/index`. There is no
bare `/health` route, so per task instructions no bare-`/health` location was added
(`location /health/` covers everything the app actually serves under that prefix).

## F5-frontend — ingestDirectory still used old synchronous contract

**File**: `frontend/js/api.js`

`ingestDirectory()` did a single POST and returned the raw response, which under the
old contract was a 201 + document list. The backend is now ASYNC:
`POST /api/ingest/directory` → 202 + `IngestJobSchema`
(`{job_id, status, path, created_at, started_at, finished_at, documents_ingested,
documents, error, status_url}`; status one of `queued|running|completed|failed` —
verified against `IngestJobSchema` / `_job_to_schema` / `IngestJobState` in
app/main.py:270-282, 415-465).

**Fix**: `ingestDirectory(path, onProgress = null, pollIntervalMs = 2000)` now:
1. POSTs `/api/ingest/directory` and gets the 202 job back.
2. Polls the job's `status_url` (fallback: `/api/ingest/status/{job_id}`) every
   `pollIntervalMs` while status is `queued` or `running`.
3. Invokes optional `onProgress(job)` with the initial job and every polled update
   (surfaces progress: `status`, `documents_ingested`, timestamps).
4. Rejects with `job.error` if the terminal status is `failed`; resolves with the
   terminal job (including final `documents` list) on `completed`.

Callers: grepped `frontend/` — no in-tree caller of `ingestDirectory` besides the
definition (app.js/chat.js don't use it), so the widened signature breaks nothing;
the resolved value still carries the ingested-documents payload (`job.documents`)
that the old 201 contract exposed.

## Self-verification

- `node --check frontend/js/api.js` → PASS
- No local `nginx` binary; validated via the already-cached `rag-app-frontend:latest`
  image (FROM nginx:alpine, the real deploy image — no new image pulled):
  `docker run --rm --add-host api:127.0.0.1 -v .../nginx.conf:/etc/nginx/conf.d/default.conf:ro rag-app-frontend:latest nginx -t`
  → "syntax is ok / test is successful" (`--add-host` needed only because nginx
  resolves `proxy_pass` upstream hosts at config-load time; in compose, docker DNS
  provides `api`).

## Deviations

None. No files outside the work zone touched; no commits made.

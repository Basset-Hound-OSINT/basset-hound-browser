# FIX-SCRIPTS Report — health-check.sh + bootstrap.sh verifier fixes

**Agent**: py-dev@exudeai:rag-bootstrap:FIX-SCRIPTS
**Date**: 2026-07-03
**Findings addressed**: F4 (MEDIUM, health-check.sh) + F5-bootstrap (bootstrap.sh)

## Files changed

- `/home/devel/exudeai/rag-bootstrap/scripts/health-check.sh`
- `/home/devel/exudeai/rag-bootstrap/scripts/bootstrap.sh`

## F4 — health-check.sh

1. **False-positive health check (line 89)**: `/health` hits the nginx SPA
   fallback and always returns 200. Switched to `/api/health`, verified to
   exist in `app/main.py:562` (`@app.get("/api/health")`, plus an
   `/api/v1/health` alias). Stable regardless of whether FIX-FRONTEND
   proxies `/health/`.
2. **Legacy `docker-compose` v1 CLI**: all 8 occurrences (lines ~77, 79, 98,
   102, 117, 121, 151, 157) replaced with `docker compose` v2. Added `-T` to
   the two bare `exec` calls (postgres pg_isready, redis ping) so the script
   works without a TTY (cron / CI). Container-status grep widened to
   `grep -qE "running|Up"` since v2 `ps` prints `Up ...` in the STATUS column.
3. **CONN_COUNT abort guard (line ~105)**: `psql -t` output is now piped
   through `tr -d '[:space:]'` (v1 output was whitespace-padded), defaulted to
   `?` when empty, and the `-gt 80` comparison is guarded with
   `[[ "$CONN_COUNT" =~ ^[0-9]+$ ]]` so a non-numeric value can never trip the
   integer test under `set -e`. Note the old `|| echo "?"` fallback was dead
   anyway (no `pipefail`, so the pipe's exit code was `tr`'s); the new
   `${CONN_COUNT:-?}` default handles the psql-failure path correctly.
4. **Adjacent latent bug fixed (in-zone, line ~117)**: the Redis check was
   `redis-cli ping &>/dev/null | grep -q "PONG"` — output discarded before
   grep, so the check was ALWAYS false (permanent false-negative "Redis not
   responding"). Now `docker compose exec -T redis redis-cli ping 2>/dev/null |
   grep -q "PONG"`.

## F5 — bootstrap.sh async ingest (old lines 146-160)

The old code parsed `document_count`/`count` from the pre-async synchronous
response and printed "Ingested ? document(s)" immediately. Rewritten to the
async contract (field names verified against `IngestJobSchema` in
`app/main.py:270-282` and the endpoint at `app/main.py:650-689`):

1. **POST** `/api/ingest/directory` → 202 with `IngestJobSchema`; extract
   `job_id`. Unparseable/missing `job_id` → `error` (RESPONSE also reset to
   empty on curl failure so the poll phase is skipped).
2. **Poll** `GET /api/ingest/status/{job_id}` every 3s, up to 600s.
   Transient curl failures tolerated (empty body → keep polling).
3. Terminal states: `completed` → read `documents_ingested`, print
   `success "Ingested N document(s)"` and surface N in the final summary
   block (existing `DOC_COUNT` plumbing unchanged); `failed` → read `error`
   (null-safe: `.get('error') or 'unknown error'`) and print it.
4. **Timeout** is non-fatal (bootstrap posture: setup completes, ingest may
   trail): warns with the exact `curl .../api/ingest/status/{job_id}` command
   to check progress manually.

Consistent with FIX-DEPLOY's `do_ingest` rewrite in `deploy.sh` (same
contract, same parse idioms); bootstrap uses a 600s cap vs deploy's 1800s
since bootstrap ingest is a single optional folder at first setup.

## Self-verification

- `bash -n` clean on both scripts.
- `grep -n "docker-compose "` over both scripts: 0 matches.
- `grep -n 'RAG_PORT}/health'` over both scripts: 0 matches (no bare /health).
- Simulated all four python3 JSON-parse snippets against sample 202/completed/
  failed payloads (job_id=abc123, status=completed, documents_ingested=42,
  null error → "unknown error"): all correct.
- Simulated the CONN_COUNT guard under `set -e` with `?`, empty, `"  85  "`,
  `12`: no aborts; 85 → WARN branch, 12/?/empty → ok branch.

## Deviations

- None outside the work zone. In-zone extras beyond the verifier findings:
  the Redis ping false-negative fix, `-T` on exec calls, and the
  `running|Up` grep widening (all in health-check.sh, documented above).
- Observation only: an early read of `deploy.sh` showed the old sync
  `do_ingest` — it raced FIX-DEPLOY's concurrent write; re-read confirms
  deploy.sh is already on the async contract. No action needed.

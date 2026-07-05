# Security LOW-Findings Fix Report — 2026-07-03

**Agent**: sec-lows fixer (original report lost to the host disk-full incident;
re-materialized by doc-writer@exudeai:rag-bootstrap:CLOSER by reading the
landed code — every claim below was re-verified against the working tree on
2026-07-03).
**Input**: `docs/findings/audits/2026-07-03_security_audit_pass.md`
(HIGH=0 / MED=0 / **6 LOW**).
**Disposition**: 4 LOWs fixed in code (LOW-1, LOW-2, LOW-3, LOW-6);
2 LOWs accepted for the localhost/no-auth posture (LOW-4, LOW-5).
Standing bar **HIGH=0 / MED=0 HELD**.

---

## LOW-1 — FIXED: `eval` of config-derived text removed from `deploy.sh`

**Was**: `parse_config` ran `eval "$(python3 … )"` over lines printed straight
from `config.yaml` string fields — shell metacharacters in a YAML value (e.g.
`project_name: "x; touch /tmp/pwned"`) would execute.

**Landed** (`deploy.sh:131-212`, verified):

- The Python heredoc now only **prints raw `KEY=VALUE` lines** to stdout,
  captured into `raw_kv` (`deploy.sh:142-197`) — nothing is evaluated.
- Bash filters each line against a **whitelist shape**
  `[[ "$line" =~ ^CONFIG_[A-Z0-9_]+= ]]` (`deploy.sh:204`) — only
  `CONFIG_<UPPER_SNAKE>=` keys pass; anything else is dropped.
- Passing pairs are re-emitted into a `mktemp` file as
  `printf '%s=%q\n' "$key" "$value"` (`deploy.sh:207`) — `%q` shell-quotes the
  value so metacharacters become inert literals.
- The generated file (plain `%q`-quoted assignments only) is `source`d and
  removed (`deploy.sh:210-211`).
- Intent documented in-file: "SECURITY (no code-from-data)" comment block at
  `deploy.sh:138-141`.

Config values are now always data; `$(cmd)`, backticks, and `;` in
`config.yaml` cannot execute. This matches the audit's recommended fix
(temp-file `%q` + `source`) exactly.

## LOW-2 — FIXED: ingest-root guard now active out of the box

**Was**: `_check_ingest_root` returned early when `DOCS_PATH` was empty, and
the shipped compose left `DOCS_PATH` unset (`${DOCS_PATH:-}`) — so the default
deployment would ingest ANY container-readable absolute directory.

**Landed** (`docker-compose.yml`, api service, verified):

- `DOCS_PATH: ${DOCS_PATH:-${PWD}/data/docs}` (`docker-compose.yml:187`) —
  the guard root now **defaults to the bundled docs mount** instead of empty,
  exactly the audit's proposed fix.
- `RAG_INGEST_ROOT_GUARD: ${RAG_INGEST_ROOT_GUARD:-on}`
  (`docker-compose.yml:188`) — explicit opt-out surface.
- The same-path `:ro` mount uses the identical fallback:
  `- ${DOCS_PATH:-${PWD}/data/docs}:${DOCS_PATH:-${PWD}/data/docs}:ro`
  (`docker-compose.yml:204`), so guard root == mount root by construction.
- "DEFAULT-ON" rationale documented in-file at `docker-compose.yml:178-186`
  (env comment) and `:194-203` (mount comment).

Guard logic itself unchanged and still correct (`app/main.py:473-497`):
resolves the requested path (`:487-488`), rejects anything not equal
to / under the resolved root with `400` + actionable detail (`:489-497`);
`RAG_INGEST_ROOT_GUARD` defaults `"on"` app-side too (`:481`). Behavior
confirmed live: the 2026-07-03 smoke ran with the guard active and the
in-root ingest was accepted
(`docs/findings/audits/2026-07-03_live_smoke_report.md` §4). Docs updated
accordingly (`.env.example` Document-mounts block; README knob table).

## LOW-3 — FIXED: LIKE metacharacters escaped in `corpus`/`path_prefix`

**Was**: `Document.filepath.like(f"{path_prefix}%")` let `%`/`_` in a
caller-supplied `corpus` act as wildcards (substring match instead of literal
prefix). Bound parameter all along — never SQL injection; correctness footgun.

**Landed** (`app/search.py`, verified):

- New `_escape_like()` (`app/search.py:58-66`): escapes backslash FIRST, then
  `%` and `_` —
  `value.replace("\\","\\\\").replace("%","\\%").replace("_","\\_")`
  (`:66`) — correct ordering so pre-existing backslashes cannot un-escape the
  wildcard escapes.
- `_path_prefix_filter` applies it with an explicit escape char:
  `Document.filepath.like(f"{_escape_like(path_prefix)}%", escape="\\")`
  (`app/search.py:79`).
- Threaded through both retrieval legs: semantic (`app/search.py:114`) and
  keyword (`:160`); hybrid composes the two, so all three modes are covered.
- Docstrings state the literal-prefix guarantee (`:61-64`, `:74-75`).

A corpus like `%secret%` now matches only files whose path literally starts
with `%secret%` — prefix semantics restored.

## LOW-6 — FIXED: hard ceiling on the async ingest-job table

**Was**: the 100-entry cap pruned only FINISHED jobs; a pathological pile-up
of never-finishing ingests (each retaining a full `documents` list) could grow
`_INGEST_JOBS` without bound.

**Landed** (`app/main.py`, verified):

- `_INGEST_JOBS_MAX = 100` retained as the soft prune-finished cap
  (`app/main.py:437`, `_prune_ingest_jobs` at `:445-455` — oldest finished
  evicted first, sorted by `finished_at`/`created_at`).
- New `_INGEST_JOBS_HARD_CAP = 500` over the WHOLE table, queued/running
  included (`app/main.py:438-442`, rationale in the comment).
- Admission control in the `POST /api/ingest/directory` handler
  (`app/main.py:679-690`): prune first (`:681`), then refuse new jobs at the
  hard cap with **`429 Too Many Requests`** + `Retry-After: 30` header
  (`:682-690`) — the audit's recommended "reject with 429 above ~500 live
  jobs" verbatim.
- Job IDs remain non-enumerable `uuid4().hex` (`:692`); unknown IDs still 404
  (`:698-706`) — no enumeration surface added.

## LOW-4 — ACCEPTED (no change): host-path / commit-SHA disclosure

`/api/status` and `/health/index` intentionally return `docs_root` /
`source_root` (absolute host paths), `project_name`, and `indexed_commit_sha`
— that corpus-identity honesty is the feature (consumers verify they are
talking to the right corpus). Accepted for the localhost-only, no-auth,
single-operator posture per the audit. Standing caveat: if the port is ever
forwarded beyond localhost, treat these fields as sensitive.

## LOW-5 — ACCEPTED (no change): weak default credentials in compose

`POSTGRES_PASSWORD: ragpass` (`docker-compose.yml:81`, `:136`;
`.env.example:64`) and `GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}`
(`docker-compose.monitoring.yml:68`) remain. Accepted because neither
postgres, redis, nor the API publish any host port (internal network only;
re-verified in the fix-batch sweep: published-port set of the resolved main
compose = {10000} on 127.0.0.1 only), and the monitoring overlay is now
out of scope / unsupported (files retained; see `docs/scope.md` Out of Scope).
Operators deploying on a shared host should still set their own
`POSTGRES_PASSWORD` in `.env`.

---

## Re-verification notes (this reconstruction)

- All four fixes read directly from the working tree on 2026-07-03; line
  numbers cited are current as of this report.
- Syntax sanity: the fix-batch re-verify sweep
  (`docs/findings/audits/2026-07-03_fixbatch_reverify.md`) ran
  `bash -n deploy.sh` and `py_compile` over `app/*.py` clean; the later live
  smoke exercised parse_config/doctor, the guard, search, and async ingest
  end-to-end (all PASS). Note the reverify predates the LOW-2 default change
  (it recorded `DOCS_PATH: ${DOCS_PATH:-}`); the live smoke postdates it and
  ran with the guard ON.
- Net security posture: HIGH=0 / MED=0 / LOW open = 2 (both accepted-by-design
  for the internal posture, documented above).

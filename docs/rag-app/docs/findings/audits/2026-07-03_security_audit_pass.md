# Security Audit — 2026-07-03 Refactor Pass

**Auditor:** security-reviewer@exudeai:rag-bootstrap:pass-audit
**Scope:** deploy.sh, app/{main,ingestion,watcher,embeddings,search}.py, frontend/nginx.conf,
client/{ragq,fallback_policy}.py, scripts/post_commit_rag_ingest.py, docker-compose*.yml
**Posture:** local-network internal tool, no auth by project policy (single trusted operator).
Standing bar: **HIGH=0 / MED=0**.

## Result

| Severity | Count |
|----------|-------|
| HIGH     | 0     |
| MED      | 0     |
| LOW      | 6     |

**Standing bar HELD: HIGH=0 / MED=0.** All findings are LOW / informational, defense-in-depth,
or explicitly-designed behavior for the localhost/no-auth posture. No shell-injection reachable
from an untrusted source, no SQL injection, no path-traversal escape, no non-localhost exposure,
no unbounded retry amplification.

### File mtimes at audit time (other agents were still editing)

```
2026-07-03 19:24:56  deploy.sh
2026-07-03 19:11:49  app/main.py
2026-07-03 19:01:42  app/ingestion.py
2026-07-03 19:03:15  app/watcher.py
2026-07-03 18:59:47  app/embeddings.py
2026-07-03 19:25:04  frontend/nginx.conf
2026-07-03 19:26:22  client/ragq.py
2026-07-03 19:26:14  client/fallback_policy.py
2026-07-03 18:58:37  scripts/post_commit_rag_ingest.py
2026-07-03 19:26:xx  docker-compose.multi-kb.yml
2026-07-03 19:25:xx  docker-compose.yml / .monitoring.yml
```
ragq.py, fallback_policy.py, nginx.conf, and the compose files were touched within ~2 min of the
audit; re-run if they changed materially after this pass.

---

## LOW findings

### LOW-1 — `eval "$(python3 …)"` of config-derived values in `parse_config`
**deploy.sh:138 / :192** (also the `eval` consuming it in `generate_env`).
`parse_config` runs `eval "$(RAG_DEPLOY_CONFIG_FILE=… python3 <<PYEOF …)"`; the heredoc prints
`CONFIG_KEY=<value>` lines straight from `config.yaml` string fields (`project_name`, `network.name`,
`llm.base_url`, ingestion dirs, …). A YAML value containing shell metacharacters — e.g.
`project_name: "x; touch /tmp/pwned"` or `$(cmd)` — is executed by `eval`.
Not reachable from any network input: `config.yaml` is authored by the same operator who runs
`deploy.sh`, so no trust boundary is crossed (hence LOW, not MED). Still a code-from-data-file
pattern worth removing.
**Fix:** stop `eval`-ing generated text — have the Python emit into a temp file as
`printf "%q"`-quoted assignments and `source` it, or read the `KEY=VALUE` pairs into a bash
associative array without `eval` (e.g. `while IFS='=' read -r k v; do cfg[$k]=$v; done < <(python3 …)`).

### LOW-2 — Ingest-root guard is inactive by default (arbitrary container-path ingest)
**app/main.py:468-492 `_check_ingest_root`** + **docker-compose.yml:183 `DOCS_PATH: ${DOCS_PATH:-}`**.
The traversal guard is correct *when active* — it uses `dirpath.resolve()` and rejects anything not
equal to / under `DOCS_PATH.resolve()`, so `../` and symlink escapes are caught. But it returns early
when `DOCS_PATH` is empty, and the shipped compose default leaves `DOCS_PATH` unset. In that default
state `POST /api/ingest/directory` will ingest ANY absolute directory readable by the api container
(e.g. `/etc`, other mounted volumes) and make its contents retrievable via `/api/search`.
Impact is bounded by the localhost-only, no-auth-by-design posture: the only reachable caller is the
same operator, who can already read those files — no privilege escalation. Documented behavior
(guard "inactive while DOCS_PATH is unset").
**Fix:** default `DOCS_PATH` to the docs-mount root (`${PWD}/data/docs`) in compose so the guard is
on out of the box, or have `_check_ingest_root` fall back to the watcher's `WATCHER_WATCH_DIR`
when `DOCS_PATH` is unset.

### LOW-3 — `corpus` / `path_prefix` LIKE wildcards not escaped
**app/search.py:65-67 `_path_prefix_filter`** (`Document.filepath.like(f"{path_prefix}%")`), fed by
`SearchRequest.corpus` (app/main.py:231). The value is a bound SQLAlchemy parameter — **no SQL
injection**. But `%` and `_` in a caller-supplied `corpus` act as LIKE wildcards, so a "prefix" like
`%secret%` matches by substring instead of prefix. No security impact (corpus only ever *narrows*
the already-searchable corpus; it cannot widen it), purely a correctness footgun.
**Fix:** escape LIKE metacharacters — `.like(prefix.replace("\\","\\\\").replace("%","\\%").replace("_","\\_") + "%", escape="\\")`.

### LOW-4 — Host-path / commit-SHA disclosure in `/api/status` and `/health/index`
**app/main.py:1006-1027, :1044-1066.** Both endpoints return `docs_root` / `source_root`
(absolute host paths), `project_name`, and `indexed_commit_sha`. Called out in the task as
acceptable for an internal tool; recording it. These are unauthenticated by policy and reachable
via the published localhost port. No fix required for the internal posture; if the port is ever
forwarded beyond localhost, treat these as sensitive (host filesystem layout + VCS state leak).

### LOW-5 — Weak default credentials in compose env defaults
**docker-compose.yml:81 / .env:27 (`POSTGRES_PASSWORD=ragpass`)**,
**docker-compose.monitoring.yml:68 (`GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}`)**,
**docker-compose.multi-kb.yml:66/90/114/173/180/187 (`${POSTGRES_PASSWORD:-ragpass}`)**.
Postgres/Redis expose no host ports (internal `rag-net` only) and Grafana binds `127.0.0.1` only,
so these are not remotely reachable — LOW under the localhost posture. Flagging because the values
are static, well-known defaults committed in-tree.
**Fix:** leave the compose fallbacks but document that operators should set `POSTGRES_PASSWORD` /
`GRAFANA_PASSWORD` in `.env` for any shared host; keep DB/redis unpublished (already the case).

### LOW-6 — Async ingest-job map only prunes *finished* jobs
**app/main.py:436-450 `_INGEST_JOBS` / `_prune_ingest_jobs`.** The cap (100) is enforced only over
jobs in `completed`/`failed` state; queued/running jobs are never pruned, and each retained job
holds a full `documents` list. In normal use jobs finish quickly and the cap holds, so memory is
bounded — LOW. A pathological burst of never-finishing ingests (e.g. a huge tree that stalls) could
grow the map. Job IDs are `uuid4().hex` (128-bit, non-enumerable) and unknown IDs 404, so **no job
enumeration** and no cross-job leakage.
**Fix (optional):** add a hard ceiling on total jobs (reject new ingests with 429 above e.g. 500
live jobs) and/or drop the retained `documents` list once a job is read.

---

## Verified clean (explicitly checked, no finding)

- **deploy.sh `reset` destructive scope** (`wipe_data_dirs`, :730-751): globs are quoted to
  `${SCRIPT_DIR}/data/...`; `SCRIPT_DIR` comes from `BASH_SOURCE`+`pwd` (not injectable). The
  throwaway root container mounts only `${SCRIPT_DIR}/data:/wipe` and `rm -rf /wipe/.../*` — cannot
  escape the project `data/` dir. `rm -rf` on a symlink entry removes the *link*, not the target,
  so a planted symlink under `data/docker/` can't wipe an out-of-tree directory.
- **`_git_head_sha`** (main.py:495-513): uses `asyncio.create_subprocess_exec` with an argv list
  (no shell), so the user-controlled `root`/`body.path` cannot inject a command.
- **`ollama_check` / `stored_embedding_dimension` psql** (deploy.sh:452-526): the URL is quoted,
  `curl -sf` (no `-L`, no redirect-follow); the psql query is a static string; the Python helpers
  read inputs via env vars (`RAG_EMB`/`RAG_LLM`), not string interpolation.
- **Path traversal** in `ingest_upload` (only `Path(filename).suffix` used, tempfile random name),
  `watcher._handle_file_event` (inotify `event.name` is a bare filename), and `_archive_file`
  (archive name = `isoformat()_{filepath.name}`, no dir components).
- **frontend/nginx.conf**: proxies ONLY `/api/` and `/health/` to `api:8000`; no broad/open proxy,
  no `proxy_pass` to a variable/user-controlled upstream; standard `X-Forwarded-*` headers, none of
  which the app trusts for a security decision. Security headers set. `api:8000` has no host port.
- **client/ragq.py, fallback_policy.py, post_commit_rag_ingest.py**: stdlib `urllib` only; endpoint
  URL is operator-set env/config (self-directed, not attacker SSRF). `post_commit` uses
  `subprocess.check_output(["git", …])` (argv list, no `shell=True`); `RAG_PORT`/`RAG_INGEST_PATHS`
  are only string/`os.path.join` composed, never shell-evaluated.
- **docker-compose*.yml port exposure**: every published port binds `127.0.0.1` (frontend + the
  monitoring stack 10010-10016); postgres/redis/api publish no host ports. multi-kb publishes only
  the frontend on `127.0.0.1`. uvicorn's `--host 0.0.0.0` (app/Dockerfile) is container-internal,
  reachable only through nginx. `validate_port_exposure` (deploy.sh:756) actively warns on drift.
- **app/embeddings.py retry/concurrency**: 3 attempts/request, exponential/linear backoff off a
  0.5s base, all POSTs gated by a shared `asyncio.Semaphore` (default 5). Batch path fans out slices
  through the same semaphore and only falls back to per-text calls on a genuine
  unsupported-endpoint signal. Retry fan-out is bounded — no unbounded amplification against the
  local Ollama.

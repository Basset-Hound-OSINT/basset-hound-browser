# Closer Docs Verification — 2026-07-03

**Auditor**: verifier (read-only pass; this report is the only write)
**Scope**: the closer's remaining deliverables — multi-kb SCAFFOLDING header,
scope/README monitoring blacklist wording, .env.example guard docs, runbook +
TROUBLESHOOTING fixes, sec_lows report re-materialization, roadmap multi-KB
merge, INDEX/link integrity, session record accuracy.
**Verdict**: **7/7 PASS** — no broken deliverables. One minor cosmetic
discrepancy noted (handoff count 22 vs 23 in the session record).

---

## 1. docker-compose.multi-kb.yml SCAFFOLDING header — PASS

- Header present at lines 1-6: "SCAFFOLDING — NOT functional multi-KB: runs the
  single-corpus app against postgres-primary only; the atc/research DBs start
  but are never used", pointing at the two findings docs (both exist:
  `docs/findings/2026-07-03_multikb_query_semantics_verdict.md`,
  `docs/findings/2026-07-03_multikb_design_groundwork.md`).
- The git diff contains additional hunks, but every non-header hunk is
  attributable to earlier zone agents, so the closer's delta is header-only:
  - 8100→10000 diagram/port/usage-comment changes — documented in
    `docs/handoffs/2026-07-03_ws-compose_report.md` (§ multi-kb, lines 56-63).
  - `version: '3.9'` removal, 7 `container_name` removals + auto-naming
    comment, `RAG_NETWORK_NAME` parameterization, `OLLAMA_BASE_URL`
    parameterization — documented in
    `docs/handoffs/2026-07-03_fix-compose_report.md` (§3-4, lines 52-64).
- Header content is accurate per the query-semantics verdict doc (api_v2
  router never mounted; single-corpus app against postgres-primary).

## 2. scope.md blacklist + README wording + POST search — PASS

- `docs/scope.md` Out of Scope (lines 79-85): "**Monitoring stacks —
  BLACKLISTED (2026-07-03)**: Grafana, Prometheus, Loki, Promtail,
  Alertmanager, and the exporters are completely out of scope. The files … are
  KEPT in-tree but are unsupported and must not be worked on." Files-kept
  paths all exist (`docker-compose.monitoring.yml`, `config/monitoring/`,
  `config/alertmanager.yml`, `config/alert_rules.yml`, `grafana/`).
- `README.md` §"Monitoring (out of scope / unsupported for now)" (lines
  245-262): "**out of scope / unsupported for now (files retained)** … kept
  in-tree but NOT supported; they do not run unless you explicitly add the
  overlay file at your own risk." No "optional" framing remains for the
  monitoring stack (remaining "optional" hits are unrelated:
  sentence-transformers backend, request-body fields, preflight tip).
- README search documentation is POST-only: endpoint table line 274
  (`POST /api/search`), versioned-alias paragraph lines 281-284 pins
  `/api/v1/search` to the same handlers. No GET search example anywhere in
  the README (all curl examples are ingest/status). Matches code:
  `app/main.py:733-734` — `@app.post("/api/search")` +
  `@app.post("/api/v1/search")`.

## 3. .env.example guard docs, runbook path, TROUBLESHOOTING note — PASS

- `.env.example` Document-mounts block matches shipped default-on behavior:
  - "DOCS_PATH … DEFAULT-ON: docker-compose.yml falls back to
    ${PWD}/data/docs" == `docker-compose.yml:187`
    (`DOCS_PATH: ${DOCS_PATH:-${PWD}/data/docs}`) and the same-path `:ro`
    mount at `:204`.
  - "RAG_INGEST_ROOT_GUARD … ON BY DEFAULT (guard root = DOCS_PATH …) opt out
    with =off" == `docker-compose.yml:188` (`:-on`) and `app/main.py:481`
    (`os.environ.get("RAG_INGEST_ROOT_GUARD", "on")`), off/0/false/no/disabled
    all disable (`:482`).
  - "WATCHER_ARCHIVE_MODE: off (default) | copy | move" ==
    `docker-compose.yml:177` (`:-off`) and `app/watcher.py:151`
    (default "off").
- `docs/deployment/PRODUCTION_DEPLOYMENT_RUNBOOK.md:178` prometheus volume now
  `./config/monitoring/prometheus.yml` (diff confirms the single-line fix from
  the stale root `./prometheus.yml`); target file exists at
  `config/monitoring/prometheus.yml`.
- `docs/TROUBLESHOOTING.md:187-195` carries the watcher/container-path
  citation note (watcher races the host-path POST → `/data/docs/…` stored
  filepaths; workaround: host-path POST first or `WATCHER_ENABLED=false`),
  citing "2026-07-03 live smoke, Finding 3" — which exists verbatim at
  `docs/findings/audits/2026-07-03_live_smoke_report.md:117`.
  `WATCHER_ENABLED` is a real knob (`docker-compose.yml:169`,
  `app/main.py:120`).

## 4. sec_lows report claims vs code — PASS (all four fixed-LOW claims verified)

`docs/handoffs/2026-07-03_sec_lows_report.md` exists; spot-checked every cited
line against the working tree:

- **LOW-1** (deploy.sh no-eval): PASS — Python heredoc prints raw KEY=VALUE
  into `raw_kv` (region 131-212 as cited), whitelist regex
  `^CONFIG_[A-Z0-9_]+=` at exactly `deploy.sh:204`, `printf '%s=%q\n'` at
  exactly `:207`, `source`+`rm` of the mktemp file at `:210-211`, "SECURITY
  (no code-from-data)" comment at `:138-141`. No `eval` in the parse path.
- **LOW-2** (guard default-on): PASS — `docker-compose.yml:187` (DOCS_PATH
  fallback), `:188` (guard `:-on`), `:204` (same-path `:ro` mount, identical
  fallback → guard root == mount root). Guard logic at `app/main.py:473-497`
  with app-side default "on" at `:481`, 400-with-detail rejection at
  `:489-497`. Cited smoke evidence real: live_smoke_report §4 (line 80) ran
  with guard ON and accepted the in-root ingest.
- **LOW-3** (LIKE escaping): PASS — `_escape_like` at `app/search.py:58-66`
  with backslash-first ordering at `:66`; `escape="\\"` LIKE at `:79`; applied
  in both legs at exactly `:114` (semantic) and `:160` (keyword); docstrings
  state the literal-prefix guarantee.
- **LOW-6** (hard cap + 429): PASS — `_INGEST_JOBS_MAX = 100` at exactly
  `app/main.py:437`, `_INGEST_JOBS_HARD_CAP = 500` + rationale comment at
  `:438-442`, `_prune_ingest_jobs` at `:445-455` (oldest finished first),
  admission control in the handler at `:681-690` (prune → 429
  `Too Many Requests` + `Retry-After: 30`), `uuid4().hex` job ids at `:692`,
  unknown-id 404 at `:698-706`.
- LOW-4/LOW-5 accepted-by-design entries are consistent with
  `docker-compose.yml` (`POSTGRES_PASSWORD: ragpass`, no published DB/API host
  ports) and the scope.md monitoring blacklist they cite.

## 5. roadmap.md multi-KB merge + FROZEN annotation — PASS

- Deferred-backlog bullet "Multi-KB federation (Option B gateway)" carries the
  blueprint's decisions verbatim (mount api_v2, per-KB engines,
  kb=name|list|all, semantic-first cross-KB merge, kb-namespaced citations,
  workspace==KB, DEFERRED per 2026-07-03 user direction) and points at
  `docs/findings/2026-07-03_multikb_design_groundwork.md` — all match the
  blueprint's §1 decision table and status header.
- FROZEN-PROJECT POLICY block intact at the top of roadmap.md, with the
  2026-07-03 user-authorized-override note added to the preamble and the rest
  of the block unmodified.

## 6. INDEX.md listings + link integrity — PASS

- `docs/INDEX.md` lists the upgrade guide
  (`deployment/UPGRADE_2026-07-03.md`, line 41, with breaking-changes blurb)
  and all new docs: TROUBLESHOOTING.md, PERFORMANCE.md,
  integration/CONSUMING_AGENTS_CONTRACT.md, the three 2026-07-03 findings, the
  ten findings/audits reports, the four dispositioned suggestions files under
  archive/session_records/, and the moved integration/reference/deployment
  docs.
- Automated relative-link check over closer-touched files (INDEX.md, scope.md,
  roadmap.md, README.md, TROUBLESHOOTING.md, PRODUCTION_DEPLOYMENT_RUNBOOK.md,
  sec_lows report, CHANGELOG.md, UPGRADE_2026-07-03.md, PERFORMANCE.md, and
  the session record): **0 broken links**. Backtick path citations in the
  multi-kb header and scope.md blacklist also all resolve.

## 7. Session record accuracy — PASS (one minor count discrepancy)

`/home/devel/exudeai/docs/archives/session_records/2026-07-03_rag_bootstrap_overhaul_pass.md`
exists. Outcome claims cross-checked against the audit reports it cites:

- "adversarial re-verify: ALL PASS, 0 new defects" == fixbatch_reverify.md
  header verdict ("**ALL PASS** … No new defects found").
- "Security: HIGH=0 / MED=0 held; all 6 LOWs dispositioned (4 fixed, 2
  accepted)" == security_audit_pass.md result table (HIGH 0 / MED 0 / LOW 6)
  + sec_lows_report.md disposition line.
- "Live smoke GATE: PASS … doctor 8/8, stack up in 12s, ingest + idempotent
  re-ingest, exactly one published port (127.0.0.1:10000), teardown verified"
  == live_smoke_report.md verdict line and body (8 `[OK]` doctor checks,
  idempotency evidence at line 80, single-port and teardown sections).
- Closer-deliverables paragraph (lines 90-96) matches everything verified in
  §§1-6 above; "additive `/api/v1/*` aliases (search POST-only)" matches
  `app/main.py:733-734`.
- **Minor (cosmetic)**: the record says "22 handoff reports" (lines 66, 168)
  but `docs/handoffs/2026-07-03_*.md` contains **23** files — the sec_lows
  report the closer re-materialized landed at 20:32, two minutes before the
  record (20:34), and was evidently not added to the count. No factual claim
  depends on it.

---

## Summary

| # | Deliverable | Result |
|---|-------------|--------|
| 1 | multi-kb SCAFFOLDING header, closer delta header-only | PASS |
| 2 | scope.md blacklist; README out-of-scope wording; POST-only search docs | PASS |
| 3 | .env.example guard docs == shipped defaults; runbook path; TROUBLESHOOTING note | PASS |
| 4 | sec_lows report — all four fixed-LOW claims match cited code lines | PASS |
| 5 | roadmap multi-KB merge; FROZEN block intact | PASS |
| 6 | INDEX listings complete; 0 broken links in touched files | PASS |
| 7 | Session record exists; outcome claims match cited audits | PASS (22-vs-23 handoff count, cosmetic) |

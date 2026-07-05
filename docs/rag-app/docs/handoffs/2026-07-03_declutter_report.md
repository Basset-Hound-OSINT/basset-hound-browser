# Root Declutter Report — 2026-07-03

**Agent**: py-dev@exudeai:rag-bootstrap:DECLUTTER
**Status**: complete (all 10 tasks; 3 deviations recorded)

## Task outcomes

### 1. `**/archive/` gitignore fix — DONE
The blanket rule lived in the TOP-LEVEL `/home/devel/exudeai/.gitignore` (line 72),
NOT in `rag-bootstrap/.gitignore` (the "~line 72" in the tasking matched the
top-level file; the rag-bootstrap one never had the rule). `git log -S` traces it
to commit `63eb305` (2026-05-19, "Disable pre-commit hook for development
flexibility") under the comment "Archived/cleanup (remove these)" — a temporary
hide for dirs slated for deletion that was never cleaned up.

Survey of every `archive/` dir in the repo: all 9 are **documentation** archives
(`*/docs/archive/`, `docs/handoffs/archive/`); none hold runtime data. Runtime
data is covered by per-project `data/` rules, and `docs/handoffs/` (the 6MB one)
stays ignored by its own top-level rule. The line was therefore removed and
replaced with an explanatory comment.

Verified:
- `git check-ignore docs/archive/session_records/SUGGESTIONS.md` → no output (exit 1)
- `git status` now shows the 18 rag-bootstrap `docs/archive/` files as trackable (untracked/added)
- Side effect (repo-wide, intended): 5 other projects' `docs/archive/` dirs became
  visible as untracked (code-world-models-research, dataset-extraction-research,
  embeddings-research, fine-tuning-research, top-level docs/archive) — all docs,
  ~1.7MB total.

### 2. CONSUMING_AGENTS_CONTRACT.md → docs/integration/ — DONE
Plain `mv` (file was untracked). References updated:
- `README.md:401` link → `docs/integration/CONSUMING_AGENTS_CONTRACT.md`
- `agent_hints/HOW_TO_QUERY.md:12` → `rag-bootstrap/docs/integration/CONSUMING_AGENTS_CONTRACT.md`
- `client/ragq.py` (module docstring + argparse description) → new path
- `client/fallback_policy.py` (module docstring) → new path; both files pass `py_compile`
- `docs/TROUBLESHOOTING.md:193` → `integration/CONSUMING_AGENTS_CONTRACT.md`
- `docs/INDEX.md` → new entry in the integration/ table

Left as-is (historical point-in-time records, not live pointers):
`docs/findings/2026-07-03_rag_bootstrap_execution_plan.md`,
`docs/findings/2026-07-03_multikb_query_semantics_verdict.md`, audit reports,
handoff reports, `docs/archive/` suggestions files.

### 3. Monitoring configs → config/monitoring/ — DONE
Moved `loki-config.yml`, `prometheus.yml`, `promtail-config.yml` →
`config/monitoring/`. Updated the four volume mounts in
`docker-compose.monitoring.yml`. Also fixed two ALREADY-BROKEN mounts found
during the edit: `./alertmanager.yml` and `./alert_rules.yml` pointed at the
project root but those files live (and are git-tracked) at `config/` — mounts
now point to `./config/alertmanager.yml` / `./config/alert_rules.yml`
(volume-paths-only change, per zone).

Verified: `docker compose -f docker-compose.yml -f docker-compose.monitoring.yml config`
resolves (COMPOSE_OK) and the rendered config shows all five mounts at the new
paths. Nothing in `deploy.sh`, `scripts/`, or `grafana/` references the old paths.

### 4. requirements-benchmark.txt / requirements-rerank.txt → config/requirements/ — DONE
Repo grep found NO runtime references (no Dockerfile, no script installs them) —
only self-referencing install comments and historical docs. Moved both to
`config/requirements/` (task default; `app/` holds only the prod
`app/requirements.txt`, and rerank is deliberately kept out of the image per its
own header). Updated the `pip install -r` self-comments in both files.
Historical mentions left alone: `CHANGELOG.md:38` ("at the repo root" — release
note), `docs/benchmarking/BENCHMARK_IMPLEMENTATION_SUMMARY.md`, audit records.

### 5. results/ — ASSESSED, gitignored
Contains one file: `performance_benchmarks.json` (2026-05-06) — generated
benchmark output from the scripts/ benchmark harness. Added `results/` to
`rag-bootstrap/.gitignore` with a comment. NOTE: the existing JSON was committed
before the rule and **stays tracked** until someone runs `git rm --cached`
(deliberately not done — no-commit discipline). Nothing deleted.

### 6. README.md — DONE
Added a "Monitoring (optional)" subsection after the port-scheme table stating:
core deploy = ONE docker network (`rag-net`) + ONE external port
`127.0.0.1:RAG_PORT` (10000-range); grafana/prometheus/loki/alertmanager/
exporters are an optional overlay via `docker-compose.monitoring.yml`, NOT
required; monitoring configs live in `config/monitoring/` + `config/`.
Contract link fixed (see task 2). No other rewrites.

### 6b. .env.example CHUNK_SIZE (zone-granted line) — ALIGNED
`.env.example` said `CHUNK_SIZE=512` but `deploy.sh:170-171,344` derives
CHUNK_SIZE from `config/config.yaml` `ingestion.chunk_size` (canonical, 256) and
writes it into `.env` — so 512 was misleading. Set to 256 with a comment
explaining the derivation chain.

### 7. docs/scope.md — DONE
Embedded a "Root Discipline (load-bearing — do not delete)" section: allowed
root residents = README/CHANGELOG/CONTRIBUTING/deploy.sh/docker-compose*.yml/
pytest.ini/.env*/.gitignore; everything else has a subdir home (docs taxonomy,
config/, handoffs/findings, results/). Also added the same 2026-07-03
freeze-supersession annotation as roadmap.md to scope.md's own FROZEN block
(it instructs agents to STOP on any rag-bootstrap path — leaving it
unannotated would contradict the authorized overhaul).

### 8. docs/roadmap.md — DONE
W67 FROZEN-PROJECT block kept intact; annotated:
"2026-07-03: user-authorized overhaul pass (Ollama default, port base 10000,
path portability, async ingest, docs taxonomy) supersedes the freeze for this
scope; see docs/findings/2026-07-03_rag_bootstrap_execution_plan.md".

### 9. Audit artifact tail — DONE
Trimmed the stray `</content>` / `</invoke>` lines from
`docs/findings/audits/2026-07-03_root_suggestions_triage_audit.md` (40 → 38 lines;
now ends at the F20-F28 finding).

### 10. docs/INDEX.md — DONE
Added CONSUMING_AGENTS_CONTRACT.md to the integration/ table. (Monitoring/
requirements moves are config/, outside the docs tree INDEX covers.)

## Final root inventory (verified)
Files: `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `deploy.sh`,
`docker-compose.yml`, `docker-compose.monitoring.yml`,
`docker-compose.multi-kb.yml`, `pytest.ini`, `.env`, `.env.example`, `.gitignore`
Dirs: `agent_hints/ app/ client/ config/ data/ docs/ frontend/ grafana/
results/ scripts/ tests/`
→ only allowed residents remain.

## Deviations
1. **Top-level `.gitignore` edited** (`/home/devel/exudeai/.gitignore`, outside
   PROJECT_ROOT): the `**/archive/` rule the tasking targeted lives there, not in
   rag-bootstrap's .gitignore. Edit limited to that one rule (replaced with a
   dated comment).
2. **Out-of-zone stale refs left un-edited** (recorded, not touched):
   `docs/deployment/PRODUCTION_DEPLOYMENT_RUNBOOK.md:178` compose snippet still
   shows `./prometheus.yml` (should be `./config/monitoring/prometheus.yml`);
   `app/main.py:1031` and `app/mcp_server.py:9` mention the contract by bare
   filename (still resolvable by name); `CHANGELOG.md:38` says rerank extra is
   "at the repo root" (historical release note).
3. **Host disk-full incident mid-run**: the root filesystem
   (`/dev/mapper/vgubuntu-root`, 456G) hit 100% (0 bytes free) partway through,
   blocking ALL writes (~15 min). Diagnosis via allocation-free probes: docker
   ~36G (5.1G build cache + 8.5G images reclaimable), /home/devel 249G (exudeai
   only 13G), /var/log 3.1G — the bulk consumer was external and released ~66G
   on its own; disk recovered to 90% used (44G free) and work resumed. NO
   out-of-zone deletions performed (only rag-bootstrap `__pycache__`/
   `.pytest_cache`, ~512K regenerable; note `.pytest_cache/v/cache/nodeids` was
   sacrificed as an I/O buffer during the outage and then removed — pytest
   regenerates it). **90% remains above the 80% resource ceiling — flagging for
   operator attention.**

## Verification summary
- `git check-ignore docs/archive/session_records/SUGGESTIONS.md` → nothing (exit 1)
- `git check-ignore results/newfile.json` → matched (exit 0)
- `docker compose -f docker-compose.yml -f docker-compose.monitoring.yml config` → OK, mounts at new paths
- `py_compile` on `client/ragq.py`, `client/fallback_policy.py` → OK
- Stale-ref sweep over live docs/code → only the out-of-zone runbook line remains
- Root `ls -A` → allowed residents only

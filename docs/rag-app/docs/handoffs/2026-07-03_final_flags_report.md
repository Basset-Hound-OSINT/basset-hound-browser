# Final acceptance flags — code-level fixes (2026-07-03)

- **Agent**: py-dev@exudeai:rag-bootstrap:FINAL-FLAGS
- **Scope**: `deploy.sh` + one `docs/roadmap.md` entry; no commits; no docker; no new root files
- **Context**: closes the 3 code-level flags left by
  `docs/handoffs/2026-07-03_acceptance_fixes_report.md` ("Code-level flags — NOT fixed")
  and `docs/findings/audits/2026-07-03_upgrade_guide_verify.md` (F1/F2/F4 root causes)

## Item 1 — stale `./docs` fallbacks — FIXED

- `deploy.sh:163` (parse_config Python heredoc):
  `dirs = ingestion.get('directories', ['./docs'])` → `['./data/docs']`
- `deploy.sh:634` (do_ingest, was :611 pre-edit):
  `${CONFIG_INGEST_DIRS:-./docs}` → `${CONFIG_INGEST_DIRS:-./data/docs}`
- With no `ingestion.directories` in config.yaml, no-arg `./deploy.sh ingest`
  now POSTs `<repo>/data/docs` — the mounted default `DOCS_PATH`, inside the
  default ingest-root guard — instead of the unmounted `<repo>/docs` (400).
- Verified no other `./docs` fallback remains:
  `grep -n "'\./docs'\|:-\./docs}" deploy.sh` → no matches.

## Item 2 — legacy port 8100 silently re-pinned — WARNED (not blocked)

New shared helper `legacy_port_warning()` (deploy.sh:376, defined after
`report_drift`) prints a loud banner to **stderr** naming the legacy
pre-2026-07-03 default, the likely cause (old `config.yaml network.port: 8100`
carried into `.env`), and pointing at
`docs/deployment/UPGRADE_2026-07-03.md` (breaking change 1). Two call sites:

1. `generate_env` (deploy.sh:276): fires when the config-derived port
   (`web_port="${CONFIG_PORT:-$DEFAULT_PORT}"`) is 8100 — covers both fresh
   generation (would write `RAG_PORT=8100`) and merge mode (legacy config
   still present).
2. `cmd_doctor` check 5 (deploy.sh:1027): fires when `resolved_port()`
   (i.e. effective `RAG_PORT`) is 8100.

Neither path blocks, exits, or increments doctor `failures` — warn only,
as specified.

Behavioral check (helper extracted to scratchpad, run in isolation):
0 bytes on stdout, banner on stderr with 8100 + UPGRADE_2026-07-03 references.

## Item 3 — roadmap deferred entry — ADDED

`docs/roadmap.md:110`, under "Deferred backlog (2026-07-03 pass)":

> Watcher-first ingests store container-path citations (defeats same-path
> DOCS_PATH citation design; live-smoke finding 3, acceptance F4) — fix by
> watching the DOCS_PATH same-path mount or normalizing stored paths to host
> form; mitigations documented in UPGRADE guide + TROUBLESHOOTING

## Self-verification

- `bash -n deploy.sh` → clean
- old `./docs` fallback strings: gone (grep exit 1)
- `./data/docs` fallbacks present at deploy.sh:163 and :634
- `legacy_port_warning` present in both code paths (:276 generate_env,
  :1027 doctor) + helper definition (:376) with the UPGRADE guide pointer
- roadmap entry present at docs/roadmap.md:110
- No files touched outside `deploy.sh`, `docs/roadmap.md`, this report

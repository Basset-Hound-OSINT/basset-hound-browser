# Acceptance-failure fixes — upgrade guide + ingest config text (2026-07-03)

- **Agent**: acceptance-fixer (workflow subagent)
- **Scope**: docs/config TEXT only; no code changes; no commits; no new root files
- **Files edited**: `docs/deployment/UPGRADE_2026-07-03.md`, `config/config.yaml`, `README.md`

## F1 (MEDIUM) — no-arg `./deploy.sh ingest` fails out of the box — FIXED

Root causes confirmed: `deploy.sh do_ingest` (deploy.sh:602-615) POSTs
`config.yaml ingestion.directories` resolved against the repo root; the old
canonical default `./docs` → `<repo>/docs` is not mounted in the api container
(only `DOCS_PATH`, default `${PWD}/data/docs`, is — docker-compose.yml:204),
and container-path entries (`/data/docs`) fail the default-on ingest-root
guard (`_check_ingest_root`, app/main.py:473-497, which resolves against the
host-form `DOCS_PATH`).

Fixes applied:
- `config/config.yaml`: canonical default `- ./docs` → `- ./data/docs`
  (equals the default `DOCS_PATH`, so no-arg ingest now works out of the box);
  comment block rewritten — host paths only, every entry must be equal to or
  under `DOCS_PATH`, container paths like `/data/docs` explicitly forbidden,
  relative entries resolve against the repo root (not the config file).
  Mechanically verified: parsed via deploy.sh's own logic, entry resolves to
  an existing host dir that passes the guard predicate (`resolved == root`).
- `UPGRADE_2026-07-03.md` step 4: retitled "Edit `.env` AND `config/config.yaml`";
  new bullet instructs aligning `ingestion.directories` with `DOCS_PATH` and
  names both 400 failure modes (unmounted `./docs`, guard-rejected `/data/docs`).
- `UPGRADE_2026-07-03.md` step 8: states no-arg ingest POSTs the step-4-aligned
  entries; explicit-path and API alternatives noted with the under-`DOCS_PATH`
  constraint.
- `UPGRADE_2026-07-03.md` header "Verification" line: no longer implies the
  live smoke covered no-arg ingest (it exercised an explicit host-path POST only).
- `README.md`: both `ingestion.directories` examples updated (`./docs` →
  `./data/docs`) with the DOCS_PATH/host-path constraint noted.

## F2 (MEDIUM-LOW) — "delete `.env` and regenerate" resurrects port 8100 — FIXED

Confirmed: HEAD-era `config/config.yaml` carries `network.port: 8100`;
`generate_env` writes `RAG_PORT` from `CONFIG_PORT` (deploy.sh:155, 273).

Fixes applied in `UPGRADE_2026-07-03.md`:
- Step 4 "Alternatively" now says delete-and-regenerate is valid ONLY after
  updating `config.yaml` itself (port 10000, embedding triple, ingestion
  directories), names the silent `RAG_PORT=8100` re-pin and the resulting
  step-9 verify failure, and tells the reader to check the regenerated `.env`
  / doctor effective-config echo.
- Breaking change 1 "Action": added "deleting `.env` does NOT cure this by
  itself — regenerated from `config/config.yaml`".
- generate_env section: "edit or delete" consequence now notes deletion only
  helps when config.yaml carries the new values.

## F3 (LOW) — unconditional step-6 wipe destroys valid 768 indexes — FIXED

Fixes applied in `UPGRADE_2026-07-03.md`:
- Step 6 is now conditional on step 5's doctor reporting a stored-dimension
  mismatch (`database stores 384, config wants 768`); explicit skip
  instruction when stored dim already matches 768 or no embeddings are stored,
  with a "reset is destructive" warning.
- Breaking change 2: "RE-INGEST is REQUIRED" qualified to indexes stored at
  384 dims; notes recent pre-upgrade copies already ran nomic/768 via
  config.yaml/.env.example (only code fallback layers were 384) and that
  doctor reports the stored dimension.
- Step 1 backup note ("step 6 destroys it") qualified to "when the wipe applies".
- Step 8 marked skippable only when a valid 768 index was kept (still required
  after a wipe or on an empty index).

## F4 (LOW) — DOCS_PATH row overclaims host-openable citations — FIXED

Confirmed against docker-compose.yml:169 (`WATCHER_ENABLED:-true`),
docker-compose.yml:193 (watch mount `→ /data/docs`) and live-smoke finding 3
(watcher-first ingest stored `/data/docs/...` citations).

Fix applied in `UPGRADE_2026-07-03.md` "New knobs" `DOCS_PATH` row: the
host-openable claim is now scoped to host-path ingests; caveat added that the
default-on watcher ingests via the `/data/docs` container mount first and
stores container-path citations (live-smoke finding 3 cited), with the two
mitigations (host-path POST first, or `WATCHER_ENABLED=false`).

## Re-check

- `config/config.yaml` re-parsed clean (`directories = ['./data/docs']`,
  `port = 10000`); simulated deploy.sh no-arg resolution passes host-exists +
  ingest-root-guard checks.
- No tests/scripts assert the old `./docs` default; `.env.example` and
  `docs/TROUBLESHOOTING.md` contain no contradicting text.
- Guide re-read end-to-end for step cross-references (1↔6, 4↔8, 5↔6) — consistent.

## Code-level flags (NOT fixed — out of docs/config-text scope)

1. **deploy.sh:163 and deploy.sh:611 — stale `./docs` code fallbacks.**
   `dirs = ingestion.get('directories', ['./docs'])` and
   `${CONFIG_INGEST_DIRS:-./docs}`: when `config.yaml` omits
   `ingestion.directories`, no-arg ingest still POSTs `<repo>/docs`
   (unmounted + outside the default guard root → 400). Should become
   `./data/docs` to match the new canonical default.
2. **Watcher stores container-path citations (F4 root cause).**
   `WATCHER_WATCH_DIR` defaults to the `/data/docs` mount
   (docker-compose.yml:170), so watcher-ingested documents permanently carry
   container-path `document_filepath` values, defeating the same-path
   citation design for those docs. Consider defaulting the watch dir to the
   `DOCS_PATH` same-path mount (or rewriting stored paths to host form).
3. **`generate_env` silently migrates a legacy port (F2 root cause).**
   Regenerating from an old `config.yaml` copies `network.port: 8100` into
   `RAG_PORT` with no warning; a legacy-default detection warning in
   `generate_env`/`doctor` would close this trap at the tool level.

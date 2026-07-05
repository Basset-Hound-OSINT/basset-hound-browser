# WS-DEPLOY Handoff Report — deploy.sh orchestration
**Date**: 2026-07-03
**Instance**: py-dev@exudeai:rag-bootstrap:WS-DEPLOY
**Zone**: `/home/devel/exudeai/rag-bootstrap/deploy.sh` (only file edited)
**Status**: COMPLETE

## Context: partial-state recovery
A prior attempt at this workstream was killed mid-edit. On arrival, `deploy.sh` already
contained a substantially complete draft (git diff ~37KB vs HEAD). Per instructions, I
reviewed every task against actual file content instead of reverting: all 6 tasks were
implemented and functionally correct. I completed the draft with three fixes (below),
then ran full static + sandboxed functional verification.

## Fixes applied on top of the prior draft
1. **Color rendering bug (pre-existing, in-zone)** — `deploy.sh:25-34`: color vars were
   literal `'\033[...m'` strings; they render via `printf` format interpretation but print
   as raw `\033[1m...` text inside the `cmd_help` heredoc. Switched to ANSI-C quoting
   (`$'\033[...m'`) so escapes are real ESC bytes in both contexts. Verified: `help`
   output now contains 0 literal `\033` sequences.
2. **`(base: )` empty display** — `echo_effective_config` (deploy.sh:380): when .env lacks
   `RAG_PORT_BASE`, the base printed empty. Now falls back to `$DEFAULT_PORT_BASE`.
3. **Literal `${HOME}` in forwarder footer** — `cmd_ollama_forwarder` (deploy.sh:1017):
   `unit_dir` was `"\${HOME}/..."` printing the unexpanded string; now expands.

## Task-by-task implementation map (final line numbers)
| Task | Implementation | Lines |
|------|----------------|-------|
| 1. Config resolution to `config/config.yaml`; abort/`--defaults`; echo effective config | `resolve_config_file` (RAG_CONFIG_FILE > config/config.yaml > legacy ./config.yaml), `require_config`, `echo_effective_config` called in `cmd_start` right before `docker compose up` | 51-59, 195-207, 380-397, 833-838 |
| 2. `generate_env` preserve/merge; canonical embedding triple | Fresh-write vs merge modes; `env_ensure` append-only never clobbers; drift reporting (`report_drift`, .env wins); emits `nomic-embed-text`/768/`ollama` | 250-348, 101-126 |
| 3. Parse-defaults canonical triple; web default 10000; derived `RAG_<svc>_PORT` | `parse_config` python defaults (`nomic-embed-text`/768/`ollama`, port 10000); `DEFAULT_PORT=10000`, `DEFAULT_PORT_BASE=10000`; `PORT_OFFSETS` +10..+16 written to .env, exactly matching plan PORT TABLE | 62-93, 129-193, 274-277, 316-320 |
| 4. Port preflight | `port_in_use` (ss > lsof > /dev/tcp), restart-safe via `port_held_by_this_stack` (frontend service check), auto-increment within +1..+19 band writing `RAG_PORT` back to .env, fail-fast when band exhausted | 402-447 |
| 5. Ollama doctor preflight; modes doc; rootless forwarder | `ollama_check` (curl `/api/tags` 5s timeout, embedding model = hard fail with `ollama pull` fix, LLM model = warn-only), `disk_space_check` (<2GB warn), `--skip-preflight` escape hatch; `cmd_ollama_forwarder` prints 3 connectivity modes + socat one-liner + systemd `--user` unit template | 452-513, 1017-1073 |
| 6. `doctor` + `reset` subcommands; failure trap; dim-guard | `cmd_doctor` (8 checks, exit 1 on failures); `cmd_reset` wipes root-owned bind mounts via throwaway `alpine:3.20` root container (`wipe_data_dirs`); `start_failure_cleanup` EXIT trap does `compose down --remove-orphans` (KEEP_ON_FAILURE=1 override); `dim_guard` compares pgvector `atttypmod` vs `EMBEDDING_DIMENSION`, fatal on start / report in doctor, directs to reset+re-ingest path | 910-1015, 692-713, 785-798, 518-551 |

## Acceptance-criteria evidence
| Criterion | Evidence | Result |
|-----------|----------|--------|
| Only `config/config.yaml` present → no 384/sentence-transformers or 8100 fallback | TEST 1: `parse_config` against real config → `PORT=10000 EMB=nomic-embed-text/768/ollama`. TEST 2: config MISSING → same canonical fallbacks. TEST 8: fresh `.env` gets `RAG_PORT=10000`, triple canonical, derived ports 10010-10016 | PASS |
| Re-run does not overwrite `.env` with `COMPOSE_PROJECT_NAME` set | TEST 9: customized `COMPOSE_PROJECT_NAME=custom-name` + `RAG_PORT=10555` survive a second `generate_env`; drift warned, values preserved | PASS |
| `doctor` reports ollama reachability, model-pulled, resolved config, port free/occupied | TEST 12 live run: config file OK, effective-config block, Ollama reachable at localhost:11434, `nomic-embed-text` pulled, LLM warn-only, `RAG_PORT 10000 is free`, disk 117GB, dim-guard no-op, rc=0 | PASS |
| Busy RAG_PORT detected before compose up | TEST 6: live listener detected by `port_in_use`; free port correctly reported free. `port_preflight` runs in `cmd_start` before `docker compose up` (line 826 vs 837); auto-increments +1..+19 or fatal | PASS |

Additional verification: `bash -n` PASS; `require_config` aborts rc=1 without `--defaults`,
proceeds with it (TEST 10); `env_set` replaces in place without duplication (TEST 4);
unknown command exits 1. No containers were started during verification (doctor/help/
forwarder are read-only; function tests ran against sandboxed ENV_FILE in scratchpad).

## Deferred (per binding decisions — not implemented)
Backup/restore subcommands and setup wizard (deploy.sh-adjacent large items), plus
symbol-aware chunking and /stats dashboard (other zones). Short stubs intentionally
NOT added to keep the script lean.

## Deviations / out-of-zone observations (no edits made)
1. `docker-compose.yml:184` still has `${RAG_PORT:-8100}` fallback and a "default: 8100"
   comment (line 183) — WS-COMPOSE zone. Harmless at runtime because deploy.sh writes a
   concrete `RAG_PORT` into `.env`, but the compose literal should become 10000.
2. Live `.env` has `RAG_NETWORK_NAME=rag-multi-kb-network` (differs from config network
   `rag-bootstrap`) — WS-ENV zone; deploy.sh preserves it by design (merge, .env wins).
   Note: `.env` was modified concurrently (mtime 18:58) by another workstream; my run
   never wrote to it.
3. `stored_embedding_dimension` assumes `raguser`/`ragdb` and a `chunks.embedding`
   column — matches docker-compose.yml (lines 79-80); if WS-DB renames the table, the
   psql query at deploy.sh:522-524 needs the same rename.

#!/usr/bin/env bash
# =============================================================================
# rag-bootstrap - Standard Upstream Sync (canonical template copy)
# =============================================================================
# Pulls the CODE surface of the canonical rag-bootstrap template
#   ${UPSTREAM_PATH:-/home/devel/exudeai/rag-bootstrap}
# into the fork this script lives in. READS the upstream only — never writes
# to it. Ships with the template: every team's fork gets this script and can
# point it at wherever their upstream copy lives via UPSTREAM_PATH.
#
# Synced (code surface):
#   app/                       (excl. __pycache__/, Dockerfile.multi-kb)
#   frontend/
#   client/                    (fallback_policy.py, ragq.py — consumer contract)
#   agent_hints/               (HOW_TO_QUERY.md — agent-facing usage)
#   scripts/bootstrap.sh, scripts/health-check.sh
#   deploy.sh
#   docker-compose.yml
#   config/requirements/requirements-rerank.txt
#
# NEVER touched (local state):
#   .env                       (instance identity + runtime values)
#   config/config.yaml         (local corpus list / port / name)
#   .env.example               (fork-rewritten identity template)
#   docs/, VERSION, README.md, .gitignore, tests/
#   scripts/update_from_upstream.sh (this script) and any fork-only scripts
#   data volumes (wherever your fork's compose points them)
#
# Usage:
#   scripts/update_from_upstream.sh            # DRY-RUN (default): show changes
#   scripts/update_from_upstream.sh --apply    # actually sync
#   UPSTREAM_PATH=/path/to/rag-bootstrap scripts/update_from_upstream.sh --apply
#
# Optional stale-identity check: set STALE_IDENTITY_PATTERNS to a grep -E
# pattern of legacy strings your fork must NOT regress to (e.g. your old port
# or the upstream network name your fork renamed):
#   STALE_IDENTITY_PATTERNS='10000|rag-bootstrap-net' scripts/update_from_upstream.sh --apply
#
# WARNING: deploy.sh / docker-compose.yml / app|frontend files may carry FORK
# ADAPTATIONS (instance identity, port band, volume indirection). A sync
# overwrites them with upstream content — re-apply your adaptations before
# deploying (the optional stale-identity check above helps flag regressions).
# =============================================================================

set -euo pipefail

UPSTREAM="${UPSTREAM_PATH:-/home/devel/exudeai/rag-bootstrap}"
FORK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_FILE="${FORK}/VERSION"

MODE="dry-run"
case "${1:-}" in
    --apply) MODE="apply" ;;
    --dry-run|"") MODE="dry-run" ;;
    -h|--help)
        sed -n '2,45p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
        exit 0
        ;;
    *)
        echo "Unknown option: $1 (use --dry-run [default], --apply, or --help)" >&2
        exit 1
        ;;
esac

[[ -d "$UPSTREAM" ]] || { echo "ERROR: upstream not found: $UPSTREAM (set UPSTREAM_PATH)" >&2; exit 1; }
UPSTREAM="$(cd "$UPSTREAM" && pwd)"
if [[ "$UPSTREAM" == "$FORK" ]]; then
    echo "This copy IS the upstream (${FORK}) — nothing to sync." >&2
    echo "Run the fork's copy of this script, or set UPSTREAM_PATH to the canonical tree." >&2
    exit 0
fi

RSYNC=(rsync -ai --checksum)
[[ "$MODE" == "dry-run" ]] && RSYNC+=(--dry-run)

echo "== $(basename "$FORK") upstream sync (${MODE}) =="
echo "   upstream: ${UPSTREAM}"
echo "   fork:     ${FORK}"
echo

echo "-- app/ (excl. __pycache__/, Dockerfile.multi-kb) --"
"${RSYNC[@]}" --exclude='__pycache__/' --exclude='Dockerfile.multi-kb' \
    "${UPSTREAM}/app/" "${FORK}/app/"

echo "-- frontend/ --"
"${RSYNC[@]}" "${UPSTREAM}/frontend/" "${FORK}/frontend/"

echo "-- client/ (excl. __pycache__/) --"
"${RSYNC[@]}" --exclude='__pycache__/' "${UPSTREAM}/client/" "${FORK}/client/"

echo "-- agent_hints/ --"
"${RSYNC[@]}" "${UPSTREAM}/agent_hints/" "${FORK}/agent_hints/"

echo "-- scripts (bootstrap.sh, health-check.sh) --"
"${RSYNC[@]}" "${UPSTREAM}/scripts/bootstrap.sh" "${UPSTREAM}/scripts/health-check.sh" \
    "${FORK}/scripts/"

echo "-- deploy.sh, docker-compose.yml --"
"${RSYNC[@]}" "${UPSTREAM}/deploy.sh" "${FORK}/deploy.sh"
"${RSYNC[@]}" "${UPSTREAM}/docker-compose.yml" "${FORK}/docker-compose.yml"

echo "-- config/requirements/ --"
"${RSYNC[@]}" "${UPSTREAM}/config/requirements/requirements-rerank.txt" \
    "${FORK}/config/requirements/"

# This script is never auto-synced (rewriting a running bash script is unsafe);
# surface drift so forks know when the standard itself changed upstream.
if [[ -f "${UPSTREAM}/scripts/update_from_upstream.sh" ]] && \
   ! cmp -s "${UPSTREAM}/scripts/update_from_upstream.sh" "${BASH_SOURCE[0]}"; then
    echo
    echo "NOTE: upstream ships a newer/different update_from_upstream.sh —"
    echo "      review and copy it manually after this run:"
    echo "      diff ${BASH_SOURCE[0]} ${UPSTREAM}/scripts/update_from_upstream.sh"
fi

echo
if [[ "$MODE" == "dry-run" ]]; then
    echo "DRY-RUN complete — nothing was changed."
    echo "Lines above prefixed with '>f' are files that WOULD be updated."
    echo "Re-run with --apply to execute the sync."
    exit 0
fi

# --- post-apply bookkeeping + checks -----------------------------------------

# Record sync date + upstream commit in VERSION (best-effort)
upstream_commit="$(git -C "$UPSTREAM" log -1 --format=%H 2>/dev/null || echo 'unknown')"
upstream_dirty=""
if [[ -n "$(git -C "$UPSTREAM" status --porcelain -- . 2>/dev/null | head -1)" ]]; then
    upstream_dirty=" + uncommitted working-tree changes"
fi
if [[ -f "$VERSION_FILE" ]] && grep -q '^last-upstream-sync:' "$VERSION_FILE"; then
    sed -i "s|^last-upstream-sync:.*|last-upstream-sync: $(date +%F) (commit ${upstream_commit}${upstream_dirty})|" "$VERSION_FILE"
else
    echo "last-upstream-sync: $(date +%F) (commit ${upstream_commit}${upstream_dirty})" >> "$VERSION_FILE"
fi
echo "VERSION updated: last-upstream-sync -> $(date +%F)"

# Stale-identity regression check (fork adaptations clobbered by upstream?)
# Opt-in: forks set STALE_IDENTITY_PATTERNS to a grep -E pattern of legacy
# strings (old port, upstream network name, ...) that must not reappear.
echo
echo "-- post-sync identity check --"
if [[ -n "${STALE_IDENTITY_PATTERNS:-}" ]]; then
    if stale=$(grep -rlnE "${STALE_IDENTITY_PATTERNS}" \
            "${FORK}/app" "${FORK}/frontend" "${FORK}/client" "${FORK}/agent_hints" \
            "${FORK}/scripts/bootstrap.sh" "${FORK}/scripts/health-check.sh" \
            "${FORK}/deploy.sh" "${FORK}/docker-compose.yml" 2>/dev/null); then
        echo "WARNING: upstream sync re-introduced STALE IDENTITY strings"
        echo "(pattern: ${STALE_IDENTITY_PATTERNS}) in the files below — re-apply"
        echo "your fork adaptations (identity, port band, volume indirection)"
        echo "before deploying:"
        echo "$stale" | sed 's/^/  - /'
    else
        echo "OK: no stale-identity strings in the synced surface."
    fi
else
    echo "SKIPPED (set STALE_IDENTITY_PATTERNS='old-port|old-net-name' to enable)."
fi

cat << EOF

== POST-UPDATE CHECKLIST ==
 1. Review the WARNING above (if any) and re-apply fork adaptations:
    identity/port/volume indirection in deploy.sh + docker-compose.yml,
    and any fork-local changes upstream does not carry.
 2. Read upstream UPGRADE notes for breaking changes:
      ls ${UPSTREAM}/docs/deployment/UPGRADE_*.md
 3. Validate compose resolution:   docker compose config -q
 4. Preflight:                     ./deploy.sh doctor
 5. Rebuild + restart when ready:  ./deploy.sh restart --build
 6. Re-run your kept diagnostics:  pytest tests/ (mocked suites, no docker)
EOF

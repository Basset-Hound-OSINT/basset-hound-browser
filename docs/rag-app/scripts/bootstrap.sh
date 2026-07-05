#!/usr/bin/env bash
# Usage: ./bootstrap.sh <project-name> [docs-folder]
#
# One-command setup for the RAG bootstrap project.
# Builds containers, waits for services, and optionally ingests documents.

set -euo pipefail

# ---------------------------------------------------------------------------
# Colored output helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()    { printf "${BLUE}[INFO]${NC}  %s\n" "$*"; }
success() { printf "${GREEN}[OK]${NC}    %s\n" "$*"; }
warn()    { printf "${YELLOW}[WARN]${NC}  %s\n" "$*"; }
error()   { printf "${RED}[ERROR]${NC} %s\n" "$*" >&2; }
fatal()   { error "$@"; exit 1; }

# ---------------------------------------------------------------------------
# Argument validation
# ---------------------------------------------------------------------------
PROJECT_NAME="${1:-}"
DOCS_FOLDER="${2:-}"

if [[ -z "$PROJECT_NAME" ]]; then
    echo ""
    printf "${BOLD}Usage:${NC} ./bootstrap.sh <project-name> [docs-folder]\n"
    echo ""
    echo "  project-name   Required. Name for this RAG project."
    echo "  docs-folder    Optional. Path to a folder of documents to ingest."
    echo ""
    fatal "project-name is required."
fi

if [[ -n "$DOCS_FOLDER" && ! -d "$DOCS_FOLDER" ]]; then
    fatal "Docs folder does not exist: $DOCS_FOLDER"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Read web/API port from .env (RAG_PORT, base + 0 in the RAG_PORT_BASE=10000
# scheme) or default to 10000.
RAG_PORT=$(grep "^RAG_PORT=" .env 2>/dev/null | tail -n 1 | cut -d= -f2 | tr -d '[:space:]' || echo "10000")
RAG_PORT="${RAG_PORT:-10000}"
API_URL="http://localhost:${RAG_PORT}"

info "Bootstrapping project: ${BOLD}${PROJECT_NAME}${NC}"

# ---------------------------------------------------------------------------
# Environment file
# ---------------------------------------------------------------------------
if [[ ! -f .env ]]; then
    if [[ -f .env.example ]]; then
        cp .env.example .env
        info "Created .env from .env.example"
    else
        warn ".env.example not found — creating minimal .env"
        touch .env
    fi
fi

# Set PROJECT_NAME in .env (replace if exists, append if not)
if grep -q "^PROJECT_NAME=" .env 2>/dev/null; then
    sed -i "s/^PROJECT_NAME=.*/PROJECT_NAME=${PROJECT_NAME}/" .env
else
    echo "PROJECT_NAME=${PROJECT_NAME}" >> .env
fi
success "PROJECT_NAME set to ${PROJECT_NAME}"

# ---------------------------------------------------------------------------
# Docker Compose build & start
# ---------------------------------------------------------------------------
info "Starting services with docker compose..."
docker compose up -d --build

# ---------------------------------------------------------------------------
# Wait for health checks
# ---------------------------------------------------------------------------
MAX_WAIT=120  # seconds
INTERVAL=3

wait_for_service() {
    local service_name="$1"
    local elapsed=0

    info "Waiting for ${service_name} to become healthy..."
    while (( elapsed < MAX_WAIT )); do
        local status
        status=$(docker compose ps --format json 2>/dev/null \
            | python3 -c "
import sys, json
for line in sys.stdin:
    svc = json.loads(line)
    if '${service_name}' in svc.get('Service', '') or '${service_name}' in svc.get('Name', ''):
        print(svc.get('Health', svc.get('State', 'unknown')))
        break
" 2>/dev/null || echo "unknown")

        if [[ "$status" == "healthy" ]]; then
            success "${service_name} is healthy"
            return 0
        fi

        sleep "$INTERVAL"
        elapsed=$((elapsed + INTERVAL))
    done

    fatal "${service_name} did not become healthy within ${MAX_WAIT}s"
}

wait_for_service "postgres"
wait_for_service "redis"

# Give the API server a moment to finish startup
info "Waiting for API server..."
API_READY=false
for _ in $(seq 1 40); do
    if curl -sf "${API_URL}/api/health" >/dev/null 2>&1; then
        API_READY=true
        break
    fi
    sleep 2
done

if $API_READY; then
    success "API server is ready at ${API_URL}"
else
    fatal "API server did not respond within timeout"
fi

# ---------------------------------------------------------------------------
# Ingest documents (optional)
# ---------------------------------------------------------------------------
DOC_COUNT=""
if [[ -n "$DOCS_FOLDER" ]]; then
    ABS_DOCS="$(cd "$DOCS_FOLDER" && pwd)"
    info "Ingesting documents from: ${ABS_DOCS}"

    # POST /api/ingest/directory is ASYNC: it returns 202 immediately with a
    # pollable job ({job_id, status, status_url, ...}); poll
    # GET /api/ingest/status/{job_id} until completed/failed.
    RESPONSE=$(curl -sf -X POST "${API_URL}/api/ingest/directory" \
        -H "Content-Type: application/json" \
        -d "{\"path\": \"${ABS_DOCS}\"}" 2>&1) || {
        error "Document ingestion request failed."
        error "Response: ${RESPONSE:-<empty>}"
        warn "You can retry manually:  curl -X POST ${API_URL}/api/ingest/directory -H 'Content-Type: application/json' -d '{\"path\": \"${ABS_DOCS}\"}'"
        RESPONSE=""
    }

    JOB_ID=""
    if [[ -n "$RESPONSE" ]]; then
        JOB_ID=$(echo "$RESPONSE" | python3 -c "
import sys, json
print(json.load(sys.stdin).get('job_id', ''))
" 2>/dev/null || echo "")
        if [[ -z "$JOB_ID" ]]; then
            error "Could not parse job_id from ingest response: ${RESPONSE}"
        fi
    fi

    if [[ -n "$JOB_ID" ]]; then
        info "Ingest job ${JOB_ID} accepted — polling ${API_URL}/api/ingest/status/${JOB_ID}"
        INGEST_MAX_WAIT=600  # seconds
        INGEST_INTERVAL=3
        INGEST_ELAPSED=0
        JOB_STATUS="queued"
        while (( INGEST_ELAPSED < INGEST_MAX_WAIT )); do
            STATUS_JSON=$(curl -sf "${API_URL}/api/ingest/status/${JOB_ID}" 2>/dev/null || echo "")
            if [[ -n "$STATUS_JSON" ]]; then
                JOB_STATUS=$(echo "$STATUS_JSON" | python3 -c "
import sys, json
print(json.load(sys.stdin).get('status', 'unknown'))
" 2>/dev/null || echo "unknown")

                if [[ "$JOB_STATUS" == "completed" ]]; then
                    DOC_COUNT=$(echo "$STATUS_JSON" | python3 -c "
import sys, json
print(json.load(sys.stdin).get('documents_ingested', '?'))
" 2>/dev/null || echo "?")
                    success "Ingested ${DOC_COUNT} document(s)"
                    break
                elif [[ "$JOB_STATUS" == "failed" ]]; then
                    JOB_ERROR=$(echo "$STATUS_JSON" | python3 -c "
import sys, json
print(json.load(sys.stdin).get('error') or 'unknown error')
" 2>/dev/null || echo "unknown error")
                    error "Ingest job ${JOB_ID} failed: ${JOB_ERROR}"
                    break
                fi
            fi

            sleep "$INGEST_INTERVAL"
            INGEST_ELAPSED=$((INGEST_ELAPSED + INGEST_INTERVAL))
        done

        if [[ "$JOB_STATUS" != "completed" && "$JOB_STATUS" != "failed" ]]; then
            warn "Ingest job ${JOB_ID} still '${JOB_STATUS}' after ${INGEST_MAX_WAIT}s — continuing."
            warn "Check progress manually:  curl ${API_URL}/api/ingest/status/${JOB_ID}"
        fi
    fi
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
printf "${GREEN}${BOLD}============================================${NC}\n"
printf "${GREEN}${BOLD}  RAG Bootstrap - Setup Complete${NC}\n"
printf "${GREEN}${BOLD}============================================${NC}\n"
echo ""
printf "  ${BOLD}Project:${NC}    %s\n" "$PROJECT_NAME"
printf "  ${BOLD}API:${NC}        %s\n" "$API_URL"
printf "  ${BOLD}API Docs:${NC}   %s/docs\n" "$API_URL"
if [[ -n "$DOC_COUNT" ]]; then
    printf "  ${BOLD}Documents:${NC}  %s ingested\n" "$DOC_COUNT"
fi
echo ""
printf "  ${BOLD}Services:${NC}\n"
docker compose ps --format "table {{.Service}}\t{{.Status}}" 2>/dev/null | sed 's/^/    /'
echo ""
info "To stop:   docker compose down"
info "To logs:   docker compose logs -f"
echo ""

#!/usr/bin/env bash
# =============================================================================
# RAG Bootstrap - Deployment Script
# =============================================================================
# Usage:
#   ./deploy.sh start [--build] [--defaults] [--skip-preflight] [--reindex]
#                                - Start all services
#   ./deploy.sh stop             - Stop all services
#   ./deploy.sh restart          - Restart all services
#   ./deploy.sh ingest [path]    - Ingest documents from config or specified path
#   ./deploy.sh status           - Show service status
#   ./deploy.sh logs [service]   - Show logs (optional: specify service)
#   ./deploy.sh health           - Check system health
#   ./deploy.sh doctor           - Preflight diagnostics (ollama, ports, config, dims)
#   ./deploy.sh reset [--yes]    - Wipe all data (handles root-owned bind mounts)
#   ./deploy.sh clean            - Stop and remove all data (volumes)
#   ./deploy.sh ollama-forwarder - Print rootless Ollama TCP-forwarder setup
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Color output helpers
# ---------------------------------------------------------------------------
# ANSI-C quoting ($'...') so the escapes are real ESC bytes: they render
# correctly both in printf format strings AND inside heredocs (cmd_help).
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
CYAN=$'\033[0;36m'
BOLD=$'\033[1m'
NC=$'\033[0m'

info()    { printf "${BLUE}[INFO]${NC}  %s\n" "$*"; }
success() { printf "${GREEN}[OK]${NC}    %s\n" "$*"; }
warn()    { printf "${YELLOW}[WARN]${NC}  %s\n" "$*"; }
error()   { printf "${RED}[ERROR]${NC} %s\n" "$*" >&2; }
fatal()   { error "$@"; exit 1; }

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Config resolution order:
#   1. RAG_CONFIG_FILE env override (mirrors app/config_manager.py)
#   2. config/config.yaml  (canonical location)
#   3. ./config.yaml       (legacy root location, still honored)
resolve_config_file() {
    if [[ -n "${RAG_CONFIG_FILE:-}" ]]; then
        echo "$RAG_CONFIG_FILE"
    elif [[ -f "${SCRIPT_DIR}/config/config.yaml" ]]; then
        echo "${SCRIPT_DIR}/config/config.yaml"
    else
        echo "${SCRIPT_DIR}/config.yaml"
    fi
}

CONFIG_FILE="$(resolve_config_file)"
ENV_FILE="${SCRIPT_DIR}/.env"

# Default values (canonical contracts: port base 10000, nomic-embed-text/768/ollama)
DEFAULT_PORT_BASE=10000
DEFAULT_PORT=10000
DEFAULT_NETWORK="rag-bootstrap"
DEFAULT_PROJECT="rag-bootstrap"
DEFAULT_EMBEDDING_MODEL="nomic-embed-text"
DEFAULT_EMBEDDING_DIM=768
DEFAULT_EMBEDDING_BACKEND="ollama"
DEFAULT_OLLAMA_URL="http://host.docker.internal:11434"

# Derived host ports: RAG_<svc>_PORT = RAG_PORT_BASE + offset (band 10000-10019).
# Container-side ports are unchanged; compose consumes ${RAG_<svc>_PORT:-<literal>}.
PORT_OFFSET_KEYS=(
    RAG_PROMETHEUS_PORT
    RAG_GRAFANA_PORT
    RAG_LOKI_PORT
    RAG_ALERTMANAGER_PORT
    RAG_PG_EXPORTER_PORT
    RAG_REDIS_EXPORTER_PORT
    RAG_CADVISOR_PORT
)
declare -A PORT_OFFSETS=(
    [RAG_PROMETHEUS_PORT]=10
    [RAG_GRAFANA_PORT]=11
    [RAG_LOKI_PORT]=12
    [RAG_ALERTMANAGER_PORT]=13
    [RAG_PG_EXPORTER_PORT]=14
    [RAG_REDIS_EXPORTER_PORT]=15
    [RAG_CADVISOR_PORT]=16
)

# Set by port_preflight when it auto-selects a different port
RESOLVED_RAG_PORT=""

# ---------------------------------------------------------------------------
# .env merge helpers (never clobber existing customized values)
# ---------------------------------------------------------------------------
env_get() {
    # Print the value of KEY from .env (empty if missing)
    grep -m1 "^${1}=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true
}

env_has() {
    grep -q "^${1}=" "$ENV_FILE" 2>/dev/null
}

env_set() {
    # Replace KEY=... in place, or append if missing
    local key="$1" value="$2"
    if env_has "$key"; then
        local tmp
        tmp=$(mktemp)
        awk -v k="$key" -v v="$value" -F= '$1 == k { print k "=" v; next } { print }' \
            "$ENV_FILE" > "$tmp" && mv "$tmp" "$ENV_FILE"
    else
        printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
    fi
}

env_ensure() {
    # Append KEY=VALUE only if KEY is not already present (preserve customizations)
    env_has "$1" || printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"
}

# ---------------------------------------------------------------------------
# Parse config.yaml (basic YAML parsing with Python)
# ---------------------------------------------------------------------------
parse_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        warn "Config not found at ${CONFIG_FILE}, using built-in defaults"
        return
    fi

    # Parse config values using Python (more reliable than bash parsing).
    # SECURITY (no code-from-data): Python prints raw KEY=VALUE lines; bash
    # re-emits ONLY whitelisted CONFIG_* keys into a temp file as printf %q
    # quoted assignments and sources that. Config values are always data —
    # shell metacharacters in config.yaml (e.g. `$(cmd)`, `;`) cannot execute.
    local raw_kv
    raw_kv="$(RAG_DEPLOY_CONFIG_FILE="$CONFIG_FILE" python3 << 'PYEOF' 2>/dev/null
import os
import sys

import yaml

try:
    with open(os.environ["RAG_DEPLOY_CONFIG_FILE"], "r") as f:
        config = yaml.safe_load(f)

    # Network settings
    network = config.get('network', {})
    print(f"CONFIG_PORT={network.get('port', 10000)}")
    print(f"CONFIG_NETWORK={network.get('name', 'rag-bootstrap')}")

    # Project name
    print(f"CONFIG_PROJECT={config.get('project_name', 'rag-bootstrap')}")

    # Ingestion directories (as colon-separated string)
    ingestion = config.get('ingestion', {})
    dirs = ingestion.get('directories', ['./data/docs'])
    print(f"CONFIG_INGEST_DIRS={':'.join(dirs)}")

    # Extensions
    exts = ingestion.get('extensions', ['pdf', 'md', 'txt'])
    print(f"CONFIG_EXTENSIONS={','.join(exts)}")

    # Chunk settings
    print(f"CONFIG_CHUNK_SIZE={ingestion.get('chunk_size', 512)}")
    print(f"CONFIG_CHUNK_OVERLAP={ingestion.get('chunk_overlap', 50)}")

    # Search settings
    search = config.get('search', {})
    print(f"CONFIG_SEARCH_MODE={search.get('default_mode', 'hybrid')}")
    print(f"CONFIG_TOP_K={search.get('top_k', 5)}")
    print(f"CONFIG_MIN_SIMILARITY={search.get('min_similarity', 0.7)}")

    # Embedding settings (canonical triple: nomic-embed-text / 768 / ollama)
    embedding = config.get('embedding', {})
    print(f"CONFIG_EMBEDDING_MODEL={embedding.get('model', 'nomic-embed-text')}")
    print(f"CONFIG_EMBEDDING_DIM={embedding.get('dimension', 768)}")
    print(f"CONFIG_EMBEDDING_BACKEND={embedding.get('backend', 'ollama')}")

    # LLM settings
    llm = config.get('llm', {})
    print(f"CONFIG_LLM_MODEL={llm.get('model', 'llama3.2:3b')}")
    print(f"CONFIG_LLM_TEMP={llm.get('temperature', 0.3)}")
    print(f"CONFIG_LLM_TIMEOUT={llm.get('timeout', 300)}")
    print(f"CONFIG_OLLAMA_URL={llm.get('base_url', 'http://host.docker.internal:11434')}")

except Exception as e:
    print(f"# Config parse error: {e}", file=sys.stderr)
    sys.exit(0)  # Don't fail, just use defaults
PYEOF
)" || true
    [[ -z "$raw_kv" ]] && return 0

    local assign_file line key value
    assign_file="$(mktemp)"
    while IFS= read -r line; do
        # Whitelist shape: CONFIG_<UPPER_SNAKE>=<value>; first '=' splits.
        [[ "$line" =~ ^CONFIG_[A-Z0-9_]+= ]] || continue
        key="${line%%=*}"
        value="${line#*=}"
        printf '%s=%q\n' "$key" "$value" >> "$assign_file"
    done <<< "$raw_kv"
    # shellcheck disable=SC1090  # generated file: %q-quoted plain assignments only
    source "$assign_file"
    rm -f "$assign_file"
}

require_config() {
    # start requires an explicit config (or --defaults acknowledgment)
    local allow_defaults="${1:-0}"
    if [[ ! -f "$CONFIG_FILE" ]]; then
        if [[ "$allow_defaults" == "1" ]]; then
            warn "No config file found; proceeding with built-in defaults (--defaults)"
        else
            fatal "Config file not found: ${CONFIG_FILE}
       Expected at config/config.yaml (canonical) or ./config.yaml (legacy).
       Create one, set RAG_CONFIG_FILE, or re-run with: ./deploy.sh start --defaults"
        fi
    fi
}

# ---------------------------------------------------------------------------
# Find available network name
# ---------------------------------------------------------------------------
find_network_name() {
    local base_name="${1:-$DEFAULT_NETWORK}"
    local network_name="$base_name"
    local counter=0

    while docker network ls --format '{{.Name}}' | grep -q "^${network_name}$"; do
        # Check if it's our network (created by this compose file)
        local network_project
        network_project=$(docker network inspect "$network_name" --format '{{index .Labels "com.docker.compose.project"}}' 2>/dev/null || echo "")

        # If it's our project's network, reuse it
        if [[ "$network_project" == "rag-bootstrap" || "$network_project" == "" ]]; then
            # Check if any containers are using this network
            local containers
            containers=$(docker network inspect "$network_name" --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null || echo "")

            if [[ -z "$containers" ]] || echo "$containers" | grep -q "rag-bootstrap"; then
                # Empty or our containers - safe to use
                break
            fi
        fi

        counter=$((counter + 1))
        network_name="${base_name}-${counter}"
    done

    echo "$network_name"
}

# ---------------------------------------------------------------------------
# Generate/merge .env file from config
# ---------------------------------------------------------------------------
# Behavior:
#   - No .env      -> write a full canonical file from config.yaml + defaults.
#   - .env exists  -> MERGE: only append missing keys; NEVER overwrite existing
#                     values (COMPOSE_PROJECT_NAME / RAG_NETWORK_NAME / RAG_PORT /
#                     RAG_PORT_BASE and every other customized key are preserved).
#                     Drift between config.yaml and .env is reported, .env wins.
generate_env() {
    parse_config

    local port_base="${RAG_PORT_BASE:-$DEFAULT_PORT_BASE}"
    local web_port="${CONFIG_PORT:-$DEFAULT_PORT}"

    if [[ "$web_port" == "8100" ]]; then
        legacy_port_warning "config.yaml network.port -> .env RAG_PORT"
    fi

    if [[ ! -f "$ENV_FILE" ]]; then
        local network_name
        network_name=$(find_network_name "${CONFIG_NETWORK:-$DEFAULT_NETWORK}")

        cat > "$ENV_FILE" << EOF
# Generated from ${CONFIG_FILE#"$SCRIPT_DIR"/} - $(date)
# Safe to customize: deploy.sh only APPENDS missing keys on re-runs,
# it never overwrites values you set here.

# Project identification / instance isolation
PROJECT_NAME=${CONFIG_PROJECT:-$DEFAULT_PROJECT}
COMPOSE_PROJECT_NAME=${CONFIG_PROJECT:-$DEFAULT_PROJECT}
RAG_NETWORK_NAME=${network_name}

# Port scheme: RAG_PORT_BASE + offset (band \${RAG_PORT_BASE}-\${RAG_PORT_BASE}+19)
RAG_PORT_BASE=${port_base}
RAG_PORT=${web_port}
EOF
        local key
        for key in "${PORT_OFFSET_KEYS[@]}"; do
            printf '%s=%s\n' "$key" "$((port_base + PORT_OFFSETS[$key]))" >> "$ENV_FILE"
        done
        cat >> "$ENV_FILE" << EOF

# Embedding settings (canonical: nomic-embed-text / 768 / ollama)
EMBEDDING_MODEL=${CONFIG_EMBEDDING_MODEL:-$DEFAULT_EMBEDDING_MODEL}
EMBEDDING_DIMENSION=${CONFIG_EMBEDDING_DIM:-$DEFAULT_EMBEDDING_DIM}
EMBEDDING_BACKEND=${CONFIG_EMBEDDING_BACKEND:-$DEFAULT_EMBEDDING_BACKEND}

# Chunking settings
CHUNK_SIZE=${CONFIG_CHUNK_SIZE:-512}
CHUNK_OVERLAP=${CONFIG_CHUNK_OVERLAP:-50}

# Ollama (external host Ollama; see: ./deploy.sh ollama-forwarder)
OLLAMA_BASE_URL=${CONFIG_OLLAMA_URL:-$DEFAULT_OLLAMA_URL}

# LLM settings
LLM_MODEL=${CONFIG_LLM_MODEL:-llama3.2:3b}
LLM_TEMPERATURE=${CONFIG_LLM_TEMP:-0.3}
LLM_TIMEOUT=${CONFIG_LLM_TIMEOUT:-300}

# RAG settings
RAG_TOP_K=${CONFIG_TOP_K:-5}
RAG_MIN_SIMILARITY=${CONFIG_MIN_SIMILARITY:-0.7}
EOF
        info "Generated .env (network: ${network_name}, port: ${web_port}, base: ${port_base})"
        return
    fi

    # --- Merge mode: existing .env is preserved, only missing keys appended ---
    info "Existing .env found — merging (append-only, customized values preserved)"

    env_ensure PROJECT_NAME "${CONFIG_PROJECT:-$DEFAULT_PROJECT}"
    env_ensure COMPOSE_PROJECT_NAME "${CONFIG_PROJECT:-$DEFAULT_PROJECT}"
    if ! env_has RAG_NETWORK_NAME; then
        env_ensure RAG_NETWORK_NAME "$(find_network_name "${CONFIG_NETWORK:-$DEFAULT_NETWORK}")"
    fi

    env_ensure RAG_PORT_BASE "$port_base"
    port_base="$(env_get RAG_PORT_BASE)"
    env_ensure RAG_PORT "$web_port"
    local key
    for key in "${PORT_OFFSET_KEYS[@]}"; do
        env_ensure "$key" "$((port_base + PORT_OFFSETS[$key]))"
    done

    env_ensure EMBEDDING_MODEL "${CONFIG_EMBEDDING_MODEL:-$DEFAULT_EMBEDDING_MODEL}"
    env_ensure EMBEDDING_DIMENSION "${CONFIG_EMBEDDING_DIM:-$DEFAULT_EMBEDDING_DIM}"
    env_ensure EMBEDDING_BACKEND "${CONFIG_EMBEDDING_BACKEND:-$DEFAULT_EMBEDDING_BACKEND}"
    env_ensure CHUNK_SIZE "${CONFIG_CHUNK_SIZE:-512}"
    env_ensure CHUNK_OVERLAP "${CONFIG_CHUNK_OVERLAP:-50}"
    env_ensure OLLAMA_BASE_URL "${CONFIG_OLLAMA_URL:-$DEFAULT_OLLAMA_URL}"
    env_ensure LLM_MODEL "${CONFIG_LLM_MODEL:-llama3.2:3b}"
    env_ensure LLM_TEMPERATURE "${CONFIG_LLM_TEMP:-0.3}"
    env_ensure LLM_TIMEOUT "${CONFIG_LLM_TIMEOUT:-300}"
    env_ensure RAG_TOP_K "${CONFIG_TOP_K:-5}"
    env_ensure RAG_MIN_SIMILARITY "${CONFIG_MIN_SIMILARITY:-0.7}"

    # Report config.yaml <-> .env drift (informational; .env wins at runtime)
    report_drift RAG_PORT "${CONFIG_PORT:-}"
    report_drift EMBEDDING_MODEL "${CONFIG_EMBEDDING_MODEL:-}"
    report_drift EMBEDDING_DIMENSION "${CONFIG_EMBEDDING_DIM:-}"
    report_drift EMBEDDING_BACKEND "${CONFIG_EMBEDDING_BACKEND:-}"
}

report_drift() {
    local key="$1" config_value="$2" env_value
    [[ -z "$config_value" ]] && return 0
    env_value="$(env_get "$key")"
    if [[ -n "$env_value" && "$env_value" != "$config_value" ]]; then
        warn "Drift: ${key}=${env_value} (.env, wins) vs ${config_value} (config.yaml)"
    fi
}

# Loud stderr warning when the legacy pre-2026-07-03 default port (8100)
# shows up — usually a stale `network.port: 8100` in an old config/config.yaml
# being carried forward. Warn only; never block.
legacy_port_warning() {
    local source="$1"
    {
        echo ""
        echo "##############################################################"
        echo "# WARNING: legacy port 8100 detected (${source})"
        echo "# 8100 was the pre-2026-07-03 default web port; the canonical"
        echo "# scheme is now RAG_PORT_BASE=10000 (web on 10000)."
        echo "# Likely cause: an old config/config.yaml still sets"
        echo "# 'network.port: 8100' and it is being carried into .env."
        echo "# See: docs/deployment/UPGRADE_2026-07-03.md (breaking change 1)"
        echo "##############################################################"
        echo ""
    } >&2
}

# ---------------------------------------------------------------------------
# Runtime value resolution (.env after merge > config.yaml > defaults)
# ---------------------------------------------------------------------------
resolved_port() {
    if [[ -n "$RESOLVED_RAG_PORT" ]]; then
        echo "$RESOLVED_RAG_PORT"
        return
    fi
    local port
    port="$(env_get RAG_PORT)"
    echo "${port:-${CONFIG_PORT:-$DEFAULT_PORT}}"
}

resolved_ollama_url() {
    local url
    url="$(env_get OLLAMA_BASE_URL)"
    echo "${url:-${CONFIG_OLLAMA_URL:-$DEFAULT_OLLAMA_URL}}"
}

host_ollama_url() {
    # host.docker.internal is only resolvable inside containers; from the host
    # side the same endpoint is localhost.
    local url
    url="$(resolved_ollama_url)"
    echo "${url/host.docker.internal/localhost}"
}

# ---------------------------------------------------------------------------
# Effective configuration echo (printed before docker compose up + by doctor)
# ---------------------------------------------------------------------------
echo_effective_config() {
    local network project
    network="$(env_get RAG_NETWORK_NAME)"
    project="$(env_get COMPOSE_PROJECT_NAME)"
    echo ""
    printf "${BOLD}Effective configuration${NC}\n"
    echo "======================="
    echo "  Config file:      ${CONFIG_FILE}$( [[ -f "$CONFIG_FILE" ]] || echo ' (MISSING - defaults)')"
    echo "  Compose project:  ${project:-${CONFIG_PROJECT:-$DEFAULT_PROJECT}}"
    echo "  Network:          ${network:-${CONFIG_NETWORK:-$DEFAULT_NETWORK}}"
    local port_base
    port_base="$(env_get RAG_PORT_BASE)"
    echo "  Web port:         $(resolved_port)  (base: ${port_base:-$DEFAULT_PORT_BASE})"
    echo "  Embedding:        $(env_get EMBEDDING_MODEL) / $(env_get EMBEDDING_DIMENSION) / $(env_get EMBEDDING_BACKEND)"
    echo "  LLM:              $(env_get LLM_MODEL)"
    echo "  Ollama URL:       $(resolved_ollama_url)"
    local watcher
    watcher="$(env_get WATCHER_ENABLED)"
    echo "  Watcher:          ${watcher:-false (default OFF)}  (auto-ingest; opt-in — see .env.example)"
    echo ""
}

# ---------------------------------------------------------------------------
# Port preflight: verify RAG_PORT is free before docker compose up
# ---------------------------------------------------------------------------
port_in_use() {
    local port="$1"
    if command -v ss >/dev/null 2>&1; then
        ss -ltnH 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]${port}\$"
    elif command -v lsof >/dev/null 2>&1; then
        lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    else
        # Last resort: try connecting
        (exec 3<>"/dev/tcp/127.0.0.1/${port}") 2>/dev/null && { exec 3>&- 3<&- || true; return 0; }
        return 1
    fi
}

port_held_by_this_stack() {
    # A busy port is fine if it's our own frontend (restart / already-up case)
    docker compose ps --status running --services 2>/dev/null | grep -q '^frontend$'
}

# ---------------------------------------------------------------------------
# Host-level port registry (B1)
# ---------------------------------------------------------------------------
# Coordinates concurrent rag-bootstrap instances on one host. `ss`/`lsof` only
# see LISTENING sockets, so a sibling that has claimed a port in its .env but
# is still building/pulling images is invisible — both instances would pick
# the same "free" port. The registry makes claimed-but-not-yet-bound ports
# visible: port_preflight scans AND claims atomically under an flock, and the
# claim is released on stop/reset (or reaped as stale once the project's
# containers are gone).
#
# File format, one claim per line:  <port> <compose_project> <claimed_epoch>
# The third field gives fresh claims a grace window so a sibling that is
# between claim and bind (no containers yet) is not reaped as stale.
PORT_REGISTRY="${XDG_RUNTIME_DIR:-/tmp}/rag-bootstrap-ports"
PORT_REGISTRY_LOCK="${PORT_REGISTRY}.lock"
PORT_REGISTRY_GRACE=900   # seconds a claim survives with no containers yet
PORT_BAND_SIZE=20         # ports per instance band (base .. base+19)

registry_project_name() {
    local p
    p="$(env_get COMPOSE_PROJECT_NAME)"
    echo "${p:-${CONFIG_PROJECT:-$DEFAULT_PROJECT}}"
}

registry_project_alive() {
    # "Alive" = the compose project still has containers (any state).
    docker ps -aq --filter "label=com.docker.compose.project=${1}" 2>/dev/null | grep -q .
}

registry_prune_stale_locked() {
    # Caller must hold the registry lock. Stale = registered but the project's
    # containers are gone (reclaimable) — except claims still inside the grace
    # window, which may legitimately have no containers yet (pre-bind sibling).
    [[ -s "$PORT_REGISTRY" ]] || return 0
    local now tmp port proj ts _rest
    now=$(date +%s)
    tmp=$(mktemp)
    while read -r port proj ts _rest; do
        [[ -z "$port" || -z "$proj" ]] && continue
        if [[ "${ts:-}" =~ ^[0-9]+$ ]] && (( now - ts < PORT_REGISTRY_GRACE )); then
            printf '%s %s %s\n' "$port" "$proj" "$ts" >> "$tmp"
        elif registry_project_alive "$proj"; then
            printf '%s %s %s\n' "$port" "$proj" "${ts:-$now}" >> "$tmp"
        fi
        # else: stale entry (registered but containers gone) -> reclaimed
    done < "$PORT_REGISTRY"
    mv "$tmp" "$PORT_REGISTRY"
}

registry_remove_project_locked() {
    # Caller must hold the registry lock. Drop all claims held by <project>.
    [[ -f "$PORT_REGISTRY" ]] || return 0
    local tmp
    tmp=$(mktemp)
    awk -v proj="$1" '$2 != proj' "$PORT_REGISTRY" > "$tmp" && mv "$tmp" "$PORT_REGISTRY"
}

registry_port_taken_locked() {
    # Caller must hold the registry lock. Is <port> claimed by another project?
    local port="$1" project="$2"
    [[ -f "$PORT_REGISTRY" ]] || return 1
    awk -v port="$port" -v proj="$project" \
        '$1 == port && $2 != proj { found = 1 } END { exit found ? 0 : 1 }' \
        "$PORT_REGISTRY"
}

registry_scan_and_claim() {
    # Usage: registry_scan_and_claim <start_port> <count> <project>
    # Under the registry flock: prune stale entries, drop this project's old
    # claim, then pick the first port in [start, start+count) that is neither
    # listening nor claimed by a live sibling; record and echo it.
    # Returns 1 (empty output) when the range is exhausted or the lock times out.
    local start="$1" count="$2" project="$3"
    (
        flock -w 15 9 || {
            error "Could not acquire port-registry lock: ${PORT_REGISTRY_LOCK}"
            exit 1
        }
        touch "$PORT_REGISTRY"
        registry_prune_stale_locked
        registry_remove_project_locked "$project"
        local i candidate
        for (( i = 0; i < count; i++ )); do
            candidate=$((start + i))
            if port_in_use "$candidate"; then
                continue
            fi
            if registry_port_taken_locked "$candidate" "$project"; then
                continue
            fi
            printf '%s %s %s\n' "$candidate" "$project" "$(date +%s)" >> "$PORT_REGISTRY"
            echo "$candidate"
            exit 0
        done
        exit 1
    ) 9>>"$PORT_REGISTRY_LOCK"
}

registry_record() {
    # Unconditionally (re)record <port> for <project> (own-stack/restart path).
    local port="$1" project="$2"
    (
        flock -w 15 9 || exit 0
        touch "$PORT_REGISTRY"
        registry_remove_project_locked "$project"
        printf '%s %s %s\n' "$port" "$project" "$(date +%s)" >> "$PORT_REGISTRY"
    ) 9>>"$PORT_REGISTRY_LOCK"
}

registry_release() {
    # Free this instance's registry claim (called from stop / reset / clean).
    local project
    project="$(registry_project_name)"
    [[ -f "$PORT_REGISTRY" ]] || return 0
    (
        flock -w 15 9 || exit 0
        registry_remove_project_locked "$project"
    ) 9>>"$PORT_REGISTRY_LOCK"
}

port_preflight() {
    local port project chosen
    port="$(resolved_port)"
    project="$(registry_project_name)"

    if port_in_use "$port" && port_held_by_this_stack; then
        info "Port ${port} is held by this stack's frontend (restart-safe)"
        registry_record "$port" "$project"
        return 0
    fi

    # Scan + claim atomically under the host registry lock: a candidate must be
    # neither listening nor claimed by a sibling instance that has not bound
    # yet. The final race (bind-time conflict) is handled by the retry loop in
    # compose_up_with_port_retry — the kernel bind is the atomic claim.
    chosen="$(registry_scan_and_claim "$port" "$PORT_BAND_SIZE" "$project")" \
        || fatal "No free port found in band ${port}-$((port + PORT_BAND_SIZE - 1)).
       Free the port or set RAG_PORT/RAG_PORT_BASE in .env, then retry."

    if [[ "$chosen" == "$port" ]]; then
        success "Port ${port} is free (claimed in host registry)"
        return 0
    fi

    warn "Port ${port} is unavailable; auto-selected free port ${chosen} (updating RAG_PORT in .env)"
    # NOTE (known drift): only RAG_PORT is bumped here; the derived
    # RAG_<svc>_PORT monitoring ports stay on RAG_PORT_BASE+offset. Harmless
    # for the supported single-port stack (the monitoring compose is opt-in),
    # but after an auto-increment the web port sits off base+0 while the
    # derived ports keep the old base. Bump RAG_PORT_BASE in .env instead if
    # you run the monitoring stack and want the whole band moved coherently.
    env_set RAG_PORT "$chosen"
    RESOLVED_RAG_PORT="$chosen"
}

# ---------------------------------------------------------------------------
# Ollama preflight: reachability + embedding model pulled + disk space
# ---------------------------------------------------------------------------
ollama_check() {
    # Prints machine-readable result lines; returns 1 on hard failure.
    local url tags emb_model llm_model
    url="$(host_ollama_url)"
    emb_model="$(env_get EMBEDDING_MODEL)"
    emb_model="${emb_model:-${CONFIG_EMBEDDING_MODEL:-$DEFAULT_EMBEDDING_MODEL}}"
    llm_model="$(env_get LLM_MODEL)"
    llm_model="${llm_model:-${CONFIG_LLM_MODEL:-llama3.2:3b}}"

    if ! tags=$(curl -sf --max-time 5 "${url}/api/tags" 2>/dev/null); then
        error "Ollama is NOT reachable at ${url}"
        error "  - Local install:  systemctl status ollama  (or: ollama serve)"
        error "  - Remote/SSH:     ssh -N -L 11434:localhost:11434 <host>"
        error "  - Container mode: ./deploy.sh ollama-forwarder  (rootless bridge forwarder)"
        return 1
    fi
    success "Ollama reachable at ${url}"

    local model_status
    model_status=$(echo "$tags" | RAG_EMB="$emb_model" RAG_LLM="$llm_model" python3 -c '
import json, os, sys
names = [m.get("name", "") for m in json.load(sys.stdin).get("models", [])]
bases = {n.split(":")[0] for n in names} | set(names)
def have(model):
    return model in bases or model.split(":")[0] in bases
print("EMB_OK" if have(os.environ["RAG_EMB"]) else "EMB_MISSING")
print("LLM_OK" if have(os.environ["RAG_LLM"]) else "LLM_MISSING")
' 2>/dev/null) || model_status=""

    if echo "$model_status" | grep -q "EMB_OK"; then
        success "Embedding model '${emb_model}' is pulled"
    else
        error "Embedding model '${emb_model}' is NOT pulled on the Ollama host"
        error "  Fix: ollama pull ${emb_model}"
        return 1
    fi

    if echo "$model_status" | grep -q "LLM_OK"; then
        success "LLM model '${llm_model}' is pulled"
    else
        warn "LLM model '${llm_model}' is not pulled (search works; Q&A/chat will fail)"
        warn "  Fix: ollama pull ${llm_model}"
    fi
    return 0
}

disk_space_check() {
    local avail_kb
    avail_kb=$(df -Pk "$SCRIPT_DIR" 2>/dev/null | awk 'NR==2 {print $4}') || avail_kb=""
    if [[ -n "$avail_kb" && "$avail_kb" -lt 2097152 ]]; then
        warn "Low disk space: $((avail_kb / 1024)) MB available under ${SCRIPT_DIR} (< 2 GB)"
        return 1
    fi
    [[ -n "$avail_kb" ]] && success "Disk space OK ($((avail_kb / 1024 / 1024)) GB available)"
    return 0
}

ollama_preflight() {
    info "Ollama preflight (skip with --skip-preflight)..."
    ollama_check || fatal "Ollama preflight failed. Fix the above or re-run with --skip-preflight."
    disk_space_check || true
}

# ---------------------------------------------------------------------------
# Fleet-resource headroom checks (doctor) — 2026-07-04 incident hardening.
# A host running 5+ template-derived stacks exhausted the per-user
# fs.inotify.max_user_instances cap (129 > 128) and wedged a stack at startup,
# and unbounded containers drove the host to 439MB free RAM. These checks
# WARN (never fail doctor) before that happens again.
# ---------------------------------------------------------------------------
inotify_headroom_check() {
    local max used pct watcher_enabled
    max=$(cat /proc/sys/fs/inotify/max_user_instances 2>/dev/null || true)
    if [[ -z "$max" || ! "$max" =~ ^[0-9]+$ || "$max" -eq 0 ]]; then
        warn "inotify: cannot read fs.inotify.max_user_instances (non-Linux?); skipping check"
        return 0
    fi
    # Count inotify instances visible to this user (anon_inode:inotify fds).
    # Other users' /proc entries are unreadable without root, so this is a
    # per-user FLOOR — which matches the kernel cap (it is per-uid). Note:
    # containerized watchers count against the uid dockerd runs them as.
    # (find exits nonzero on unreadable /proc entries — harmless; the || true
    # keeps set -euo pipefail from killing doctor.)
    used=$({ find /proc/[0-9]*/fd -lname 'anon_inode:inotify' 2>/dev/null || true; } | wc -l)
    pct=$(( used * 100 / max ))
    watcher_enabled="$(env_get WATCHER_ENABLED)"
    watcher_enabled="${watcher_enabled,,}"
    if (( pct > 85 )); then
        warn "inotify: ${used}/${max} instances in use (${pct}% > 85%). Each stack's enabled watcher consumes one instance; at the cap a stack WEDGES at startup. Fix: WATCHER_ENABLED=false everywhere (explicit ingest is the primary flow), or raise fs.inotify.max_user_instances."
    elif [[ "$watcher_enabled" == "true" ]] && (( (used + 1) * 100 / max > 85 )); then
        warn "inotify: WATCHER_ENABLED=true would tip usage to $(( used + 1 ))/${max} (>85%). Prefer explicit ingest (WATCHER_ENABLED=false, the default)."
    else
        success "inotify headroom OK (${used}/${max} instances in use; watcher=${watcher_enabled:-false})"
    fi
    return 0
}

mem_to_mb() {
    # Parse a docker-style memory size (512m, 1g, 192mb, 64M, plain bytes) → MB
    local v num unit
    v="${1,,}"; v="${v//[[:space:]]/}"
    num="${v%%[a-z]*}"
    unit="${v#"$num"}"
    [[ -z "$num" || ! "$num" =~ ^[0-9]+$ ]] && { echo 0; return; }
    case "$unit" in
        g|gb) echo $(( num * 1024 )) ;;
        m|mb) echo "$num" ;;
        k|kb) echo $(( num / 1024 )) ;;
        ""|b) echo $(( num / 1024 / 1024 )) ;;
        *)    echo 0 ;;
    esac
}

stack_mem_limit_sum_mb() {
    # Sum of this stack's compose memory caps (env override or compose default),
    # + 64MB for the one-shot init service.
    local api pg redis frontend
    api="$(env_get RAG_API_MEM_LIMIT)";           api="${api:-512m}"
    pg="$(env_get RAG_PG_MEM_LIMIT)";             pg="${pg:-1g}"
    redis="$(env_get RAG_REDIS_MEM_LIMIT)";       redis="${redis:-256m}"
    frontend="$(env_get RAG_FRONTEND_MEM_LIMIT)"; frontend="${frontend:-128m}"
    echo $(( $(mem_to_mb "$api") + $(mem_to_mb "$pg") + $(mem_to_mb "$redis") + $(mem_to_mb "$frontend") + 64 ))
}

ram_headroom_check() {
    local avail_kb avail_mb sum_mb
    avail_kb=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null)
    if [[ -z "$avail_kb" || ! "$avail_kb" =~ ^[0-9]+$ ]]; then
        warn "RAM: cannot read MemAvailable from /proc/meminfo; skipping check"
        return 0
    fi
    avail_mb=$(( avail_kb / 1024 ))
    sum_mb=$(stack_mem_limit_sum_mb)
    if (( avail_mb < sum_mb )); then
        warn "RAM headroom: ${avail_mb}MB available < this stack's summed memory caps (${sum_mb}MB). Under load the host will swap/OOM. Fix: lower RAG_*_MEM_LIMIT knobs, stop other stacks, or consolidate into ONE multi-KB instance."
    else
        success "RAM headroom OK (${avail_mb}MB available >= ${sum_mb}MB stack cap sum)"
    fi
    return 0
}

stack_count_check() {
    command -v docker >/dev/null 2>&1 || return 0
    local count
    # Heuristic: template-derived stacks are compose projects running an "api"
    # service (docker ps label/name pattern <project>-api-N).
    count=$(docker ps --filter label=com.docker.compose.service=api \
        --format '{{.Label "com.docker.compose.project"}}' 2>/dev/null \
        | sort -u | grep -c . || true)
    if (( count > 1 )); then
        warn "Fleet: ${count} template-derived RAG stacks running on this host — each costs RAM (~1.9GB cap), an inotify instance (if watcher on), and a port band. Consolidate into ONE multi-KB instance (knowledge_bases stanza in config/config.yaml serves many KBs from a single stack)."
    elif (( count == 1 )); then
        success "Fleet: 1 template-derived RAG stack running on this host"
    else
        success "Fleet: no template-derived RAG stacks currently running"
    fi
    return 0
}

# ---------------------------------------------------------------------------
# Dimension guard: stored pgvector dim must match configured dimension
# ---------------------------------------------------------------------------
stored_embedding_dimension() {
    # Best-effort: empty output when postgres/table/column not available yet.
    local pg_service
    pg_service=$(docker compose ps -q postgres 2>/dev/null || true)
    [[ -z "$pg_service" ]] && return 0
    docker compose exec -T postgres psql -U raguser -d ragdb -tAc \
        "SELECT atttypmod FROM pg_attribute WHERE attrelid = 'chunks'::regclass AND attname = 'embedding'" \
        2>/dev/null | tr -d '[:space:]' || true
}

dim_guard() {
    # Called after compose up. On mismatch, direct the user to the reset path.
    local mode="${1:-fatal}"   # fatal | report
    local want stored
    want="$(env_get EMBEDDING_DIMENSION)"
    want="${want:-${CONFIG_EMBEDDING_DIM:-$DEFAULT_EMBEDDING_DIM}}"
    stored="$(stored_embedding_dimension)"

    if [[ -z "$stored" || "$stored" == "-1" ]]; then
        [[ "$mode" == "report" ]] && info "Dimension guard: no stored embeddings yet (nothing to check)"
        return 0
    fi
    if [[ "$stored" == "$want" ]]; then
        success "Dimension guard: stored dim ${stored} matches configured ${want}"
        return 0
    fi

    error "Embedding dimension mismatch: database stores ${stored}, config wants ${want}"
    error "  Existing vectors are incompatible with the configured model."
    error "  Either restore EMBEDDING_DIMENSION=${stored} (and its matching model),"
    error "  or wipe and re-ingest: ./deploy.sh reset && ./deploy.sh start && ./deploy.sh ingest"
    [[ "$mode" == "fatal" ]] && exit 1
    return 1
}

# ---------------------------------------------------------------------------
# Wait for API to be ready
# ---------------------------------------------------------------------------
wait_for_api() {
    local port
    port="$(resolved_port)"
    local url="http://localhost:${port}/api/health"
    local max_wait=120
    local interval=3
    local elapsed=0

    info "Waiting for API to be ready..."

    while (( elapsed < max_wait )); do
        if curl -sf "$url" >/dev/null 2>&1; then
            success "API is ready at http://localhost:${port}"
            return 0
        fi
        sleep "$interval"
        elapsed=$((elapsed + interval))
        printf "."
    done

    echo ""
    fatal "API did not respond within ${max_wait}s"
}

# ---------------------------------------------------------------------------
# Ingest documents
# ---------------------------------------------------------------------------
do_ingest() {
    local port
    port="$(resolved_port)"
    local api_url="http://localhost:${port}"
    local paths=("$@")

    # If no paths provided, use config directories
    if [[ ${#paths[@]} -eq 0 ]]; then
        parse_config
        IFS=':' read -ra paths <<< "${CONFIG_INGEST_DIRS:-./data/docs}"
    fi

    info "Ingesting documents..."

    local total_docs=0
    for path in "${paths[@]}"; do
        # Convert to absolute path
        if [[ ! "$path" = /* ]]; then
            path="${SCRIPT_DIR}/${path}"
        fi

        if [[ ! -d "$path" ]]; then
            warn "Directory not found: $path"
            continue
        fi

        info "Processing: $path"

        # POST is async: returns 202 with an ingest job (job_id + status_url).
        local response
        response=$(curl -sf -X POST "${api_url}/api/ingest/directory" \
            -H "Content-Type: application/json" \
            -d "{\"path\": \"${path}\"}" 2>&1) || {
            error "Failed to ingest: $path"
            continue
        }

        local job_id
        job_id=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])" 2>/dev/null || echo "")
        if [[ -z "$job_id" ]]; then
            error "Unexpected ingest response for $path (no job_id): $response"
            continue
        fi

        # Poll the job until it reaches a terminal state (completed | failed)
        local max_wait=1800
        local interval=3
        local elapsed=0
        local job_status=""
        local job_json=""

        while (( elapsed < max_wait )); do
            job_json=$(curl -sf "${api_url}/api/ingest/status/${job_id}" 2>/dev/null) || job_json=""
            job_status=$(echo "$job_json" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "")
            if [[ "$job_status" == "completed" || "$job_status" == "failed" ]]; then
                break
            fi
            sleep "$interval"
            elapsed=$((elapsed + interval))
            printf "."
        done
        echo ""

        case "$job_status" in
            completed)
                local count
                count=$(echo "$job_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('documents_ingested') or 0)" 2>/dev/null || echo "0")
                total_docs=$((total_docs + count))
                success "Ingested $count documents from $path"
                ;;
            failed)
                local job_error
                job_error=$(echo "$job_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error') or 'unknown error')" 2>/dev/null || echo "unknown error")
                error "Ingest job ${job_id} failed for $path: $job_error"
                ;;
            *)
                error "Ingest job ${job_id} for $path did not finish within ${max_wait}s (last status: ${job_status:-unreachable})"
                ;;
        esac
    done

    success "Total: $total_docs documents ingested"
}

# ---------------------------------------------------------------------------
# Show status
# ---------------------------------------------------------------------------
show_status() {
    echo ""
    printf "${BOLD}RAG Bootstrap Status${NC}\n"
    echo "===================="
    echo ""

    docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || {
        warn "Services not running"
        return 1
    }

    echo ""

    # Show health if running
    local port
    port="$(resolved_port)"
    if curl -sf "http://localhost:${port}/api/health" >/dev/null 2>&1; then
        local health
        health=$(curl -sf "http://localhost:${port}/api/health")

        echo "Health Status:"
        echo "$health" | python3 -c "
import sys, json
h = json.load(sys.stdin)
print(f\"  Overall:    {h['status'].upper()}\")
print(f\"  Database:   {'OK' if h['database'] else 'FAIL'}\")
print(f\"  Redis:      {'OK' if h['redis'] else 'FAIL'}\")
print(f\"  Embedding:  {'OK' if h['embedding_service'] else 'FAIL'}\")
print(f\"  LLM:        {'OK' if h['llm'] else 'FAIL'}\")
" 2>/dev/null || echo "  (Could not parse health response)"

        echo ""
        echo "Access the UI at: http://localhost:${port}"
    fi
}

# ---------------------------------------------------------------------------
# Ensure data directories exist (bind mount targets)
# ---------------------------------------------------------------------------
ensure_data_directories() {
    info "Ensuring data directories exist..."

    # Create the standardized data directory structure
    # These are bind mount targets used by docker-compose.yml
    mkdir -p "${SCRIPT_DIR}/data/docker/postgres"
    mkdir -p "${SCRIPT_DIR}/data/docker/redis"
    mkdir -p "${SCRIPT_DIR}/data/cache/embeddings"
    mkdir -p "${SCRIPT_DIR}/data/logs"
    mkdir -p "${SCRIPT_DIR}/data/exports"
    mkdir -p "${SCRIPT_DIR}/data/registry"

    # Ensure proper permissions for Docker containers
    chmod -R 755 "${SCRIPT_DIR}/data" 2>/dev/null || true

    success "Data directories ready at: ${SCRIPT_DIR}/data/"
}

# ---------------------------------------------------------------------------
# Wipe data directories (handles root-owned bind-mount files)
# ---------------------------------------------------------------------------
wipe_data_dirs() {
    info "Removing data directories..."

    rm -rf "${SCRIPT_DIR}/data/docker/postgres"/* 2>/dev/null || true
    rm -rf "${SCRIPT_DIR}/data/docker/redis"/* 2>/dev/null || true
    rm -rf "${SCRIPT_DIR}/data/cache"/* 2>/dev/null || true
    rm -rf "${SCRIPT_DIR}/data/logs"/* 2>/dev/null || true
    rm -rf "${SCRIPT_DIR}/data/exports"/* 2>/dev/null || true
    rm -rf "${SCRIPT_DIR}/data/registry"/* 2>/dev/null || true

    # Postgres/redis bind mounts are typically root-owned; a plain rm -rf as a
    # normal user leaves them behind. Finish the job with a throwaway root
    # container that only mounts ./data.
    if find "${SCRIPT_DIR}/data/docker" -mindepth 2 -print -quit 2>/dev/null | grep -q .; then
        warn "Root-owned files remain under data/docker; wiping via throwaway root container..."
        docker run --rm -v "${SCRIPT_DIR}/data:/wipe" alpine:3.20 \
            sh -c 'rm -rf /wipe/docker/postgres/* /wipe/docker/redis/* /wipe/cache/* /wipe/logs/* /wipe/exports/* /wipe/registry/*' \
            || fatal "Container-assisted wipe failed. Manual fix: sudo rm -rf ${SCRIPT_DIR}/data/docker/{postgres,redis}/*"
    fi

    success "Data directories wiped"
}

# ---------------------------------------------------------------------------
# Validate docker-compose.yml security configuration
# ---------------------------------------------------------------------------
validate_port_exposure() {
    local compose_file="${SCRIPT_DIR}/docker-compose.yml"

    if [[ ! -f "$compose_file" ]]; then
        return 0
    fi

    # Check if postgres, redis, or api services have port mappings
    # Using Python for reliable YAML parsing
    local validation_result
    validation_result=$(python3 << 'PYEOF'
import yaml
import sys

try:
    with open('docker-compose.yml', 'r') as f:
        compose = yaml.safe_load(f)

    services = compose.get('services', {})
    issues = []

    # Services that should NOT have ports exposed
    protected_services = ['postgres', 'redis', 'api']

    for service_name in protected_services:
        service = services.get(service_name, {})
        if 'ports' in service and service['ports']:
            issues.append(f"  - {service_name}: Has port mapping (should be internal only)")

    if issues:
        print("SECURITY_WARNING")
        for issue in issues:
            print(issue)
    else:
        print("OK")

except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
PYEOF
    )

    if echo "$validation_result" | grep -q "^SECURITY_WARNING"; then
        echo ""
        warn "═══════════════════════════════════════════════════════════════"
        warn "SECURITY WARNING: Unexpected port exposure detected!"
        warn "═══════════════════════════════════════════════════════════════"
        echo "$validation_result" | tail -n +2
        warn ""
        warn "This RAG system is designed with a single-port architecture."
        warn "Only the 'frontend' service should expose ports (default: 10000)."
        warn ""
        warn "Internal services (postgres, redis, api) should communicate"
        warn "via Docker network only to prevent security issues."
        warn ""
        warn "Review docker-compose.yml and remove unnecessary port mappings."
        warn "═══════════════════════════════════════════════════════════════"
        echo ""

        # Give user a chance to abort
        sleep 2
    fi
}

# ---------------------------------------------------------------------------
# Start-path failure trap: diagnose + down orphans on partial starts
# ---------------------------------------------------------------------------
start_failure_cleanup() {
    local rc=$?
    [[ $rc -eq 0 ]] && return 0
    echo ""
    error "Start failed (exit ${rc}). Container state:"
    docker compose ps 2>/dev/null || true
    if [[ "${KEEP_ON_FAILURE:-0}" == "1" ]]; then
        warn "KEEP_ON_FAILURE=1 set — leaving containers up for debugging"
        warn "Inspect with: ./deploy.sh logs   |   tear down: docker compose down --remove-orphans"
    else
        warn "Bringing partial stack down (set KEEP_ON_FAILURE=1 to keep it for debugging)..."
        docker compose down --remove-orphans 2>/dev/null || true
    fi
}

# ---------------------------------------------------------------------------
# Compose up with bind-retry (B1): the kernel bind is the atomic port claim
# ---------------------------------------------------------------------------
compose_up_with_port_retry() {
    # port_preflight closes the reservation race via the registry, but a
    # non-cooperating process can still grab the port between preflight and
    # bind (the TOCTOU window). The authoritative claim is the kernel bind
    # itself, so when `docker compose up` fails on a port-allocation conflict
    # we bump RAG_PORT to the next registry-claimed free port and retry,
    # bounded by the 20-port band.
    local build_flag="${1:-}" project band_anchor band_end port rc up_output remaining chosen
    project="$(registry_project_name)"
    band_anchor="$(resolved_port)"
    band_end=$((band_anchor + PORT_BAND_SIZE - 1))

    while :; do
        port="$(resolved_port)"
        set +e
        up_output=$(docker compose up -d $build_flag 2>&1)
        rc=$?
        set -e
        [[ -n "$up_output" ]] && printf '%s\n' "$up_output"
        [[ $rc -eq 0 ]] && return 0

        # Only retry on a port-allocation conflict; anything else follows the
        # normal failure path (start_failure_cleanup trap).
        if ! printf '%s\n' "$up_output" | grep -qiE \
            'port is already allocated|address already in use|bind for .* failed'; then
            return "$rc"
        fi

        warn "Port ${port} was taken between preflight and bind (compose bind failure)"
        docker compose down --remove-orphans 2>/dev/null || true

        remaining=$((band_end - port))
        if (( remaining <= 0 )); then
            fatal "Port band ${band_anchor}-${band_end} exhausted while retrying binds.
       Free a port or set RAG_PORT/RAG_PORT_BASE in .env, then retry."
        fi
        chosen="$(registry_scan_and_claim "$((port + 1))" "$remaining" "$project")" \
            || fatal "No free port left in band ${band_anchor}-${band_end}.
       Free a port or set RAG_PORT/RAG_PORT_BASE in .env, then retry."
        warn "Retrying with RAG_PORT=${chosen} (updating .env)"
        env_set RAG_PORT "$chosen"
        RESOLVED_RAG_PORT="$chosen"
    done
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------
cmd_start() {
    local build_flag=""
    local allow_defaults=0
    local skip_preflight=0
    local reindex=0
    local passthrough=()

    for arg in "$@"; do
        case "$arg" in
            --build|-b)       build_flag="--build"; passthrough+=("$arg") ;;
            --defaults)       allow_defaults=1;     passthrough+=("$arg") ;;
            --skip-preflight) skip_preflight=1;     passthrough+=("$arg") ;;
            --reindex)        reindex=1 ;;
        esac
    done

    info "Starting RAG Bootstrap..."
    require_config "$allow_defaults"
    generate_env

    # Ensure data directories exist (bind mount targets)
    ensure_data_directories

    # Validate security configuration
    validate_port_exposure

    # Preflights: free port + reachable Ollama with the embedding model pulled
    port_preflight
    if [[ "$skip_preflight" == "1" ]]; then
        warn "Skipping Ollama preflight (--skip-preflight)"
    else
        ollama_preflight
    fi

    # Echo effective resolved config right before bringing the stack up
    echo_effective_config

    trap start_failure_cleanup EXIT
    compose_up_with_port_retry "$build_flag"

    # Stored-vs-configured embedding dimension guard.
    # Default: fatal on mismatch. With --reindex (B2): offer to wipe and
    # re-embed in one flow instead of aborting with manual instructions.
    if [[ "$reindex" == "1" ]]; then
        if ! dim_guard report; then
            local stored want
            stored="$(stored_embedding_dimension)"
            want="$(env_get EMBEDDING_DIMENSION)"
            want="${want:-${CONFIG_EMBEDDING_DIM:-$DEFAULT_EMBEDDING_DIM}}"
            warn "Stale index detected (stored=${stored}, config=${want})."
            read -p "Wipe and re-embed? [y/N] " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                trap - EXIT
                cmd_reset --yes
                cmd_start ${passthrough[@]+"${passthrough[@]}"}
                cmd_ingest
                return 0
            fi
            fatal "Reindex declined — stale index left in place.
       Manual path: ./deploy.sh reset && ./deploy.sh start && ./deploy.sh ingest"
        fi
    else
        dim_guard fatal
    fi

    wait_for_api
    trap - EXIT
    show_status
}

cmd_stop() {
    info "Stopping RAG Bootstrap..."
    docker compose down
    registry_release
    success "Services stopped"
}

cmd_restart() {
    cmd_stop
    cmd_start "$@"
}

cmd_ingest() {
    parse_config

    # Check if API is running
    local port
    port="$(resolved_port)"
    if ! curl -sf "http://localhost:${port}/api/health" >/dev/null 2>&1; then
        fatal "API is not running. Start services first with: ./deploy.sh start"
    fi

    do_ingest "$@"
}

cmd_logs() {
    local service="${1:-}"

    if [[ -n "$service" ]]; then
        docker compose logs -f "$service"
    else
        docker compose logs -f
    fi
}

cmd_health() {
    parse_config
    local port
    port="$(resolved_port)"
    local url="http://localhost:${port}/api/health"

    info "Checking health at $url"

    local health
    health=$(curl -sf "$url") || fatal "Could not reach API"

    echo "$health" | python3 -c "
import sys, json
h = json.load(sys.stdin)
print()
print('RAG Bootstrap Health')
print('=' * 40)
print(f\"Overall Status: {h['status'].upper()}\")
print()
print('Components:')
print(f\"  Database (PostgreSQL): {'✓ Connected' if h['database'] else '✗ Disconnected'}\")
print(f\"  Cache (Redis):         {'✓ Connected' if h['redis'] else '✗ Disconnected'}\")
print(f\"  Embedding Service:     {'✓ Ready' if h['embedding_service'] else '✗ Unavailable'}\")
print(f\"  LLM (Ollama):          {'✓ Connected' if h['llm'] else '✗ Unavailable'}\")
print()
"
}

cmd_doctor() {
    local failures=0
    parse_config

    echo ""
    printf "${BOLD}RAG Bootstrap Doctor${NC}\n"
    echo "===================="

    # 1. Config resolution
    if [[ -f "$CONFIG_FILE" ]]; then
        success "Config file: ${CONFIG_FILE}"
    else
        warn "Config file MISSING: ${CONFIG_FILE} (built-in defaults would be used)"
    fi

    # 2. .env presence
    if [[ -f "$ENV_FILE" ]]; then
        success ".env present: ${ENV_FILE}"
    else
        warn ".env missing (deploy.sh start will generate it)"
    fi

    # 3. Effective resolved config
    echo_effective_config

    # 4. Docker availability
    if docker info >/dev/null 2>&1; then
        success "Docker daemon reachable"
    else
        error "Docker daemon NOT reachable"
        failures=$((failures + 1))
    fi

    # 5. RAG_PORT free/occupied
    local port
    port="$(resolved_port)"
    if [[ "$port" == "8100" ]]; then
        legacy_port_warning "doctor: RAG_PORT resolves to 8100"
    fi
    if ! port_in_use "$port"; then
        success "RAG_PORT ${port} is free"
    elif port_held_by_this_stack; then
        success "RAG_PORT ${port} is occupied by THIS stack (running)"
    else
        error "RAG_PORT ${port} is occupied by ANOTHER process (start would auto-increment)"
        failures=$((failures + 1))
    fi

    # 6. Ollama reachability + models pulled
    if ! ollama_check; then
        failures=$((failures + 1))
    fi

    # 7. Disk space
    disk_space_check || true

    # 8. Fleet-resource headroom: inotify instances, host RAM vs this stack's
    #    summed memory caps, template-derived stack count (warnings only)
    inotify_headroom_check
    ram_headroom_check
    stack_count_check

    # 9. Stored-vs-configured embedding dimension (best-effort, needs postgres up)
    dim_guard report || failures=$((failures + 1))

    echo ""
    if [[ $failures -eq 0 ]]; then
        success "Doctor: all checks passed"
    else
        error "Doctor: ${failures} check(s) failed"
        exit 1
    fi
}

cmd_reset() {
    # --yes / -y / --force (B2): non-interactive wipe for CI/automation and
    # the `start --reindex` flow (no TTY prompt).
    local assume_yes=0
    for arg in "$@"; do
        case "$arg" in
            --yes|-y|--force) assume_yes=1 ;;
        esac
    done

    warn "This will stop all services and WIPE ALL DATA for a fresh re-init:"
    warn "  - Docker containers, networks, volumes"
    warn "  - Database files (data/docker/postgres/) — even if root-owned"
    warn "  - Redis cache, cached embeddings, logs, exports, registry"
    if [[ "$assume_yes" == "1" ]]; then
        info "Proceeding without prompt (--yes)"
        REPLY=y
    else
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
    fi

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Stopping services..."
        docker compose down -v --remove-orphans 2>/dev/null || true
        registry_release

        wipe_data_dirs
        ensure_data_directories

        success "Reset complete. Run './deploy.sh start --build' then './deploy.sh ingest' to re-index."
    else
        info "Cancelled"
    fi
}

cmd_clean() {
    warn "This will stop all services and DELETE ALL DATA!"
    warn "  - Docker containers and networks"
    warn "  - Database files (data/docker/postgres/)"
    warn "  - Redis cache (data/docker/redis/)"
    warn "  - All cached embeddings (data/cache/)"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Stopping services..."
        docker compose down -v
        registry_release

        wipe_data_dirs

        success "All data removed. Run './deploy.sh start --build' to start fresh."
    else
        info "Cancelled"
    fi
}

cmd_ollama_forwarder() {
    local unit_dir="${HOME}/.config/systemd/user"
    cat << 'EOF'

Ollama connectivity modes
=========================
The stack reaches Ollama through OLLAMA_BASE_URL (.env). Three supported modes:

  1. LOCAL (default): Ollama runs on this host, containers reach it via
     host.docker.internal (host-gateway). If Ollama only listens on 127.0.0.1,
     containers CANNOT reach it — use the rootless forwarder below, or set
     OLLAMA_HOST=0.0.0.0 for the Ollama service (wider exposure).

  2. REMOTE: point OLLAMA_BASE_URL at the remote host directly, e.g.
     OLLAMA_BASE_URL=http://gpu-box.example:11434

  3. SSH BRIDGE: forward a remote Ollama to this host, then use mode 1:
     ssh -N -L 11434:localhost:11434 user@gpu-box

Rootless TCP forwarder (mode 1 fix; no root, no OLLAMA_HOST change)
-------------------------------------------------------------------
Forwards the Docker bridge address (host-gateway target, default 172.17.0.1)
port 11434 to Ollama on 127.0.0.1:11434. Requires: socat.

One-off (foreground):

  socat TCP-LISTEN:11434,bind=172.17.0.1,fork,reuseaddr TCP:127.0.0.1:11434

Persistent systemd --user unit — save the block below to
~/.config/systemd/user/rag-ollama-forward.service :

  [Unit]
  Description=RAG Bootstrap - forward Ollama 11434 to Docker bridge (rootless)
  After=network.target

  [Service]
  ExecStart=/usr/bin/socat TCP-LISTEN:11434,bind=172.17.0.1,fork,reuseaddr TCP:127.0.0.1:11434
  Restart=on-failure
  RestartSec=3

  [Install]
  WantedBy=default.target

Then enable it:

  mkdir -p ~/.config/systemd/user
  systemctl --user daemon-reload
  systemctl --user enable --now rag-ollama-forward.service
  # survive logout: loginctl enable-linger $USER

Verify from a container's perspective:

  curl -s http://172.17.0.1:11434/api/tags | head -c 200

EOF
    info "Template printed above; unit path: ${unit_dir}/rag-ollama-forward.service"
}

cmd_help() {
    cat << EOF

${BOLD}RAG Bootstrap - Deployment Script${NC}
===================================

${CYAN}Usage:${NC}
  ./deploy.sh <command> [options]

${CYAN}Commands:${NC}
  ${GREEN}start${NC} [--build]   Start all services (--build to rebuild containers)
        [--defaults]       Allow start without a config file (built-in defaults)
        [--skip-preflight] Skip the Ollama reachability/model preflight
        [--reindex]        On stale-dimension index: prompt once, then wipe,
                           restart and re-ingest automatically
  ${GREEN}stop${NC}              Stop all services
  ${GREEN}restart${NC}           Restart all services
  ${GREEN}ingest${NC} [path...]  Ingest documents from config or specified paths
  ${GREEN}status${NC}            Show service status and health
  ${GREEN}logs${NC} [service]    Show logs (optionally for specific service)
  ${GREEN}health${NC}            Check detailed system health
  ${GREEN}doctor${NC}            Preflight diagnostics: config, ports, Ollama, disk, dims
  ${GREEN}reset${NC} [--yes]     Wipe ALL data for fresh re-init (handles root-owned files)
                    (--yes skips the confirmation prompt, for CI/automation)
  ${GREEN}clean${NC}             Stop and remove all data (dangerous!)
  ${GREEN}ollama-forwarder${NC}  Print rootless Ollama TCP-forwarder + systemd --user unit

${CYAN}Examples:${NC}
  ./deploy.sh doctor                   # Check everything before starting
  ./deploy.sh start                    # Start with existing images
  ./deploy.sh start --build            # Rebuild and start
  ./deploy.sh ingest                   # Ingest from config.yaml directories
  ./deploy.sh ingest /path/to/docs     # Ingest from specific path
  ./deploy.sh logs api                 # Show API logs only

${CYAN}Configuration:${NC}
  Edit ${BOLD}config/config.yaml${NC} to configure:
  - Ingestion directories
  - Search settings
  - LLM model
  - Network port (RAG_PORT_BASE scheme: web=base+0, monitoring=base+10..+16)
  A generated ${BOLD}.env${NC} holds runtime values; deploy.sh merges (append-only)
  and never overwrites values you customize there.

${CYAN}Prerequisite:${NC}
  An Ollama host with the embedding model pulled:  ${BOLD}ollama pull nomic-embed-text${NC}

${CYAN}Access:${NC}
  Once started, access the UI at: ${BOLD}http://localhost:10000${NC} (or configured port)

EOF
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    local cmd="${1:-help}"
    shift || true

    case "$cmd" in
        start)   cmd_start "$@" ;;
        stop)    cmd_stop ;;
        restart) cmd_restart "$@" ;;
        ingest)  cmd_ingest "$@" ;;
        status)  show_status ;;
        logs)    cmd_logs "$@" ;;
        health)  cmd_health ;;
        doctor)  cmd_doctor ;;
        reset)   cmd_reset "$@" ;;
        clean)   cmd_clean ;;
        ollama-forwarder) cmd_ollama_forwarder ;;
        help|-h|--help) cmd_help ;;
        *)
            error "Unknown command: $cmd"
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"

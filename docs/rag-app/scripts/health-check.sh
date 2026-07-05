#!/bin/bash
# RAG Bootstrap - Daily Health Check Script
# Run this every morning to verify all systems are operational

set -e

SCRIPTDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECTDIR="$(dirname "$SCRIPTDIR")"
cd "$PROJECTDIR"

# ── Ports (RAG_PORT_BASE=10000 scheme) ──────────────────────────────
# Source RAG_PORT + RAG_<svc>_PORT from .env; fall back to exported env,
# then to the documented port-table defaults (base + offset). No literals
# below this block.
env_port() {
    local var="$1" def="$2" val=""
    if [ -f .env ]; then
        val=$(grep -E "^${var}=" .env | tail -n 1 | cut -d= -f2- | tr -d '[:space:]')
    fi
    [ -n "$val" ] || val="${!var:-$def}"
    echo "$val"
}

RAG_PORT="$(env_port RAG_PORT 10000)"                            # web / API   (base + 0)
RAG_PROMETHEUS_PORT="$(env_port RAG_PROMETHEUS_PORT 10010)"      # prometheus  (base + 10)
RAG_GRAFANA_PORT="$(env_port RAG_GRAFANA_PORT 10011)"            # grafana     (base + 11)
RAG_ALERTMANAGER_PORT="$(env_port RAG_ALERTMANAGER_PORT 10013)"  # alertmanager (base + 13)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
check_service() {
    local name=$1
    local endpoint=$2
    local expected_status=${3:-200}

    local status=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" 2>/dev/null || echo "000")

    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} $name ($status)"
        return 0
    else
        echo -e "${RED}✗${NC} $name ($status - expected $expected_status)"
        return 1
    fi
}

log_header() {
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "  $1"
    echo "════════════════════════════════════════════════════════════════"
}

log_subheader() {
    echo ""
    echo "▶ $1"
    echo "────────────────────────────────────────────────────────────────"
}

# Main health check

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   RAG Bootstrap - Daily Health Check                           ║"
echo "║   $(date '+%Y-%m-%d %H:%M:%S')                                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"

ISSUES=0

# 1. Container Status
log_header "1. CONTAINER STATUS"
if docker compose ps | grep -qE "running|Up"; then
    echo -e "${GREEN}✓${NC} Docker daemon running"
    docker compose ps
else
    echo -e "${RED}✗${NC} Docker daemon not responding"
    ISSUES=$((ISSUES + 1))
fi

# 2. Service Availability
log_header "2. SERVICE AVAILABILITY"

check_service "Frontend" "http://localhost:${RAG_PORT}" || ISSUES=$((ISSUES + 1))
check_service "API Health" "http://localhost:${RAG_PORT}/api/health" || ISSUES=$((ISSUES + 1))
check_service "API Status" "http://localhost:${RAG_PORT}/api/status" || ISSUES=$((ISSUES + 1))
check_service "Prometheus" "http://localhost:${RAG_PROMETHEUS_PORT}/-/healthy" || ISSUES=$((ISSUES + 1))
check_service "Grafana" "http://localhost:${RAG_GRAFANA_PORT}/api/health" || ISSUES=$((ISSUES + 1))
check_service "Alertmanager" "http://localhost:${RAG_ALERTMANAGER_PORT}/-/healthy" || ISSUES=$((ISSUES + 1))

# 3. Database Health
log_header "3. DATABASE HEALTH"

if docker compose exec -T postgres pg_isready -U raguser -d ragdb &>/dev/null; then
    echo -e "${GREEN}✓${NC} PostgreSQL responding"

    # Check connection count (psql -t pads with whitespace; strip it, and fall
    # back to "?" so the numeric comparison below can be safely guarded)
    CONN_COUNT=$(docker compose exec -T postgres psql -U raguser -d ragdb -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | tr -d '[:space:]')
    CONN_COUNT="${CONN_COUNT:-?}"
    echo "  Active connections: $CONN_COUNT"

    if [[ "$CONN_COUNT" =~ ^[0-9]+$ ]] && [ "$CONN_COUNT" -gt 80 ]; then
        echo -e "  ${YELLOW}⚠${NC}  Warning: High connection count ($CONN_COUNT/100)"
        ISSUES=$((ISSUES + 1))
    fi
else
    echo -e "${RED}✗${NC} PostgreSQL not responding"
    ISSUES=$((ISSUES + 1))
fi

# 4. Cache Health
log_header "4. CACHE HEALTH"

if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo -e "${GREEN}✓${NC} Redis responding"

    # Check memory
    MEM=$(docker compose exec -T redis redis-cli INFO memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
    echo "  Memory usage: $MEM"
else
    echo -e "${RED}✗${NC} Redis not responding"
    ISSUES=$((ISSUES + 1))
fi

# 5. Resource Usage
log_header "5. RESOURCE USAGE"

echo ""
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# 6. Disk Space
log_header "6. DISK SPACE"

DATA_USAGE=$(du -sh data/ 2>/dev/null | cut -f1)
AVAILABLE=$(df -h . | awk 'NR==2 {print $4}')

echo "Data directory size: $DATA_USAGE"
echo "Available disk space: $AVAILABLE"

if [ $(df . | awk 'NR==2 {print int($4/1024)}') -lt 1024 ]; then
    echo -e "${YELLOW}⚠${NC}  Warning: Less than 1GB disk space available"
    ISSUES=$((ISSUES + 1))
fi

# 7. Recent Errors
log_header "7. RECENT ERRORS (Last 50 Lines)"

ERROR_COUNT=$(docker compose logs --tail=200 api 2>/dev/null | grep -i "ERROR\|WARN" | wc -l)

if [ "$ERROR_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No errors in recent logs"
else
    echo -e "${YELLOW}⚠${NC}  Found $ERROR_COUNT error/warning lines:"
    docker compose logs --tail=200 api 2>/dev/null | grep -i "ERROR\|WARN" | head -5
fi

# 8. Metrics Health
log_header "8. PROMETHEUS METRICS"

if curl -s "http://localhost:${RAG_PROMETHEUS_PORT}/api/v1/targets" 2>/dev/null | grep -q "\"state\":\"up\""; then
    UP_TARGETS=$(curl -s "http://localhost:${RAG_PROMETHEUS_PORT}/api/v1/targets" 2>/dev/null | grep -o '"state":"up"' | wc -l)
    DOWN_TARGETS=$(curl -s "http://localhost:${RAG_PROMETHEUS_PORT}/api/v1/targets" 2>/dev/null | grep -o '"state":"down"' | wc -l)

    echo -e "${GREEN}✓${NC} Prometheus healthy"
    echo "  Scrape targets: $UP_TARGETS up, $DOWN_TARGETS down"

    if [ "$DOWN_TARGETS" -gt 0 ]; then
        echo -e "  ${YELLOW}⚠${NC}  Some targets are down"
        ISSUES=$((ISSUES + 1))
    fi
else
    echo -e "${RED}✗${NC} Prometheus not responding"
    ISSUES=$((ISSUES + 1))
fi

# 9. Alert Status
log_header "9. ALERT STATUS"

if curl -s "http://localhost:${RAG_ALERTMANAGER_PORT}/api/v1/alerts" 2>/dev/null | grep -q "\"status\":\"firing\""; then
    FIRING=$(curl -s "http://localhost:${RAG_ALERTMANAGER_PORT}/api/v1/alerts" 2>/dev/null | grep -o '"status":"firing"' | wc -l)
    echo -e "${YELLOW}⚠${NC}  $FIRING alerts currently firing"
    ISSUES=$((ISSUES + 1))

    # Show which alerts
    curl -s "http://localhost:${RAG_ALERTMANAGER_PORT}/api/v1/alerts" 2>/dev/null | grep -o '"alertname":"[^"]*"' | head -5
else
    echo -e "${GREEN}✓${NC} No active alerts"
fi

# 10. Summary
log_header "SUMMARY"

if [ "$ISSUES" -eq 0 ]; then
    echo -e "${GREEN}✓ All systems operational${NC}"
    echo ""
    echo "No issues detected. System is healthy."
    exit 0
else
    echo -e "${RED}✗ $ISSUES issue(s) detected${NC}"
    echo ""
    echo "Please review the warnings above and take appropriate action."
    exit 1
fi

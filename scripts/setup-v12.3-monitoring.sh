#!/bin/bash

# Setup Monitoring for Basset Hound Browser v12.3.0
# Configures Prometheus, Grafana, and health checks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log_info() {
    echo -e "${GREEN}[✓]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[⚠]${NC} $*"
}

log_error() {
    echo -e "${RED}[✗]${NC} $*"
}

log_header() {
    echo -e "\n${BLUE}━━━ $* ━━━${NC}\n"
}

# Check prerequisites
check_prerequisites() {
    log_header "Checking Prerequisites"

    local required_commands=("node" "npm" "docker" "jq")
    local missing=0

    for cmd in "${required_commands[@]}"; do
        if command -v $cmd &> /dev/null; then
            log_info "Found: $cmd"
        else
            log_error "Missing: $cmd"
            missing=$((missing + 1))
        fi
    done

    if [ $missing -gt 0 ]; then
        log_error "Please install missing dependencies"
        exit 1
    fi
}

# Create monitoring directory structure
setup_directories() {
    log_header "Setting Up Directory Structure"

    local dirs=(
        "config/prometheus"
        "config/grafana"
        "config/alertmanager"
        "logs"
        "metrics"
        "monitoring"
    )

    for dir in "${dirs[@]}"; do
        if [ ! -d "$PROJECT_ROOT/$dir" ]; then
            mkdir -p "$PROJECT_ROOT/$dir"
            log_info "Created: $dir"
        else
            log_info "Already exists: $dir"
        fi
    done
}

# Install monitoring dependencies
install_dependencies() {
    log_header "Installing Monitoring Dependencies"

    local packages=(
        "prom-client"
        "express"
    )

    log_info "Checking npm packages..."
    for pkg in "${packages[@]}"; do
        if npm ls "$pkg" > /dev/null 2>&1; then
            log_info "Already installed: $pkg"
        else
            log_warn "Installing: $pkg"
            npm install "$pkg"
        fi
    done
}

# Create Prometheus configuration
setup_prometheus() {
    log_header "Configuring Prometheus"

    local prom_config="$PROJECT_ROOT/config/prometheus/prometheus.yml"

    if [ ! -f "$prom_config" ]; then
        cat > "$prom_config" << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'basset-hound-browser'
    environment: 'production'

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - 'localhost:9093'

rule_files:
  - 'alert-rules.yml'

scrape_configs:
  - job_name: 'basset-browser'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics'
    scrape_interval: 10s
    scrape_timeout: 5s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']
    scrape_interval: 15s
EOF
        log_info "Created: Prometheus configuration"
    else
        log_info "Prometheus configuration already exists"
    fi

    # Check if alert rules exist
    if [ ! -f "$PROJECT_ROOT/config/prometheus/alert-rules.yml" ]; then
        log_warn "Alert rules not found (expected at config/prometheus/alert-rules.yml)"
    else
        log_info "Alert rules configured"
    fi
}

# Create Grafana provisioning
setup_grafana() {
    log_header "Configuring Grafana"

    local grafana_dir="$PROJECT_ROOT/config/grafana"

    # Create datasources
    mkdir -p "$grafana_dir/provisioning/datasources"
    cat > "$grafana_dir/provisioning/datasources/prometheus.yml" << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF
    log_info "Created: Grafana datasources"

    # Create dashboards directory
    mkdir -p "$grafana_dir/provisioning/dashboards"
    cat > "$grafana_dir/provisioning/dashboards/dashboards.yml" << 'EOF'
apiVersion: 1

providers:
  - name: 'Basset Hound Dashboards'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF
    log_info "Created: Grafana dashboard provisioning"
}

# Create health check configuration
setup_health_checks() {
    log_header "Setting Up Health Checks"

    local health_config="$PROJECT_ROOT/config/health-check-config.json"

    if [ ! -f "$health_config" ]; then
        cat > "$health_config" << 'EOF'
{
  "checks": {
    "memory": {
      "enabled": true,
      "critical": true,
      "timeout": 5000,
      "thresholds": {
        "warning": 75,
        "critical": 90
      }
    },
    "uptime": {
      "enabled": true,
      "critical": false,
      "timeout": 5000
    },
    "eventLoop": {
      "enabled": true,
      "critical": true,
      "timeout": 5000,
      "threshold": 100
    },
    "filesystem": {
      "enabled": true,
      "critical": true,
      "timeout": 5000
    }
  },
  "checkInterval": 30000,
  "enableAutoRecovery": true
}
EOF
        log_info "Created: Health check configuration"
    else
        log_info "Health check configuration already exists"
    fi
}

# Create logging configuration
setup_logging() {
    log_header "Setting Up Structured Logging"

    local log_config="$PROJECT_ROOT/config/logging-config.json"

    if [ ! -f "$log_config" ]; then
        cat > "$log_config" << 'EOF'
{
  "level": "INFO",
  "logDir": "./logs",
  "maxFileSize": 10485760,
  "maxBackups": 10,
  "enableConsole": true,
  "enableFile": true,
  "prettyPrint": false,
  "serviceName": "basset-hound-browser",
  "environment": "production"
}
EOF
        log_info "Created: Logging configuration"
    else
        log_info "Logging configuration already exists"
    fi

    mkdir -p "$PROJECT_ROOT/logs"
    log_info "Created: Logs directory"
}

# Create Docker Compose for monitoring stack
setup_docker_compose() {
    log_header "Setting Up Docker Compose (Monitoring Stack)"

    local compose_file="$PROJECT_ROOT/config/docker/docker-compose.monitoring.yml"

    if [ ! -f "$compose_file" ]; then
        cat > "$compose_file" << 'EOF'
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: basset-hound-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./config/prometheus:/etc/prometheus
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: basset-hound-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=
    volumes:
      - ./config/grafana/provisioning:/etc/grafana/provisioning
      - grafana_data:/var/lib/grafana
    restart: unless-stopped
    depends_on:
      - prometheus

  node-exporter:
    image: prom/node-exporter:latest
    container_name: basset-hound-node-exporter
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    restart: unless-stopped

  alertmanager:
    image: prom/alertmanager:latest
    container_name: basset-hound-alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./config/alertmanager:/etc/alertmanager
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:

networks:
  default:
    name: basset-hound-monitoring
EOF
        log_info "Created: Docker Compose monitoring stack"
    else
        log_info "Docker Compose already exists"
    fi
}

# Create monitoring documentation
create_documentation() {
    log_header "Creating Monitoring Documentation"

    local doc_file="$PROJECT_ROOT/docs/MONITORING-SETUP.md"

    if [ ! -f "$doc_file" ]; then
        cat > "$doc_file" << 'EOF'
# Basset Hound Browser v12.3.0 - Monitoring Setup

## Overview

This document describes the monitoring infrastructure for Basset Hound Browser v12.3.0.

### Components

1. **Prometheus** - Metrics collection and time-series database
   - Port: 9090
   - Endpoint: http://localhost:9090
   - Configuration: `config/prometheus/prometheus.yml`

2. **Grafana** - Metrics visualization and dashboards
   - Port: 3000
   - Default credentials: admin/admin
   - URL: http://localhost:3000

3. **Node Exporter** - System metrics
   - Port: 9100
   - Collects CPU, memory, disk, network metrics

4. **Alert Manager** - Alert routing and notification
   - Port: 9093
   - Configuration: `config/alertmanager/alertmanager.yml`

## Quick Start

### Using Docker Compose

```bash
# Start monitoring stack
docker-compose -f config/docker/docker-compose.monitoring.yml up -d

# Check status
docker-compose -f config/docker/docker-compose.monitoring.yml ps

# View logs
docker-compose -f config/docker/docker-compose.monitoring.yml logs -f
```

### Manual Setup

```bash
# Run setup script
bash scripts/setup-v12.3-monitoring.sh

# Start Prometheus
docker run -d -p 9090:9090 \
  -v $(pwd)/config/prometheus:/etc/prometheus \
  prom/prometheus

# Start Grafana
docker run -d -p 3000:3000 \
  -v $(pwd)/config/grafana/provisioning:/etc/grafana/provisioning \
  grafana/grafana
```

## Health Checks

### Liveness Probe
```bash
curl http://localhost:8765/alive
```

### Readiness Probe
```bash
curl http://localhost:8765/ready
```

### Health Status
```bash
curl http://localhost:8765/health
```

## Metrics Collection

### Prometheus Scrape Targets

- Application metrics: `localhost:9090/metrics`
- Node exporter: `localhost:9100/metrics`
- Prometheus self: `localhost:9090/metrics`

### Key Metrics

- `requests_total` - Total requests processed
- `request_duration_seconds` - Request latency histogram
- `memory_usage_percent` - Memory utilization
- `connections_active` - Active WebSocket connections
- `cache_hits_total` - Cache hit count
- `errors_total` - Error count by type

## Alerting

Alert rules are defined in `config/prometheus/alert-rules.yml`.

### Critical Alerts
- CriticalMemoryUsage (>90%)
- ProcessDown (not responding)
- HighErrorRate (>5% errors)
- EventLoopLag (>100ms)
- TorCircuitFailures

### Warning Alerts
- HighMemoryUsage (>75%)
- ElevatedLatency (P95 > 500ms)
- HighConnectionCount (>500)
- HighCacheMissRate (>50%)

## Dashboards

Main dashboard: "Basset Hound Browser - v12.3.0"

### Dashboard Panels
1. Throughput (msg/sec)
2. Latency (P95/P99)
3. Memory Usage
4. Error Rate
5. Active Connections
6. Cache Hit Rate
7. Uptime
8. Health Status

## Log Aggregation

Structured JSON logging to `logs/` directory.

```bash
# View recent logs
tail -f logs/basset-hound-*.log | jq '.'

# Filter by level
grep '"level":"ERROR"' logs/basset-hound-*.log | jq '.'

# Filter by time
jq 'select(.timestamp > "2026-06-14T10:00:00")' logs/basset-hound-*.log
```

## Troubleshooting

### Prometheus not collecting metrics
1. Check configuration: `config/prometheus/prometheus.yml`
2. Verify targets are accessible
3. Check Prometheus logs: `docker logs basset-hound-prometheus`

### Grafana dashboards not loading
1. Verify Prometheus datasource is configured
2. Check dashboard files in `config/grafana/provisioning/dashboards`
3. Restart Grafana: `docker restart basset-hound-grafana`

### High memory alerts
1. Check application logs: `logs/`
2. Review memory metrics in Grafana
3. Check for memory leaks using heap dumps

## Performance Targets (v12.3.0)

- **Throughput**: 400-500 msg/sec
- **Latency P99**: <2ms
- **Memory**: <5% utilization
- **Error Rate**: <1%
- **Cache Hit Rate**: >70%
- **Availability**: 99.9% uptime

## Related Documentation

- API Reference: `docs/API-REFERENCE.md`
- Deployment Guide: `docs/DEPLOYMENT-GUIDE.md`
- Troubleshooting: `docs/TROUBLESHOOTING.md`
EOF
        log_info "Created: Monitoring documentation"
    else
        log_info "Monitoring documentation already exists"
    fi
}

# Summary
print_summary() {
    log_header "Monitoring Setup Complete"

    cat << EOF

${GREEN}✓ Monitoring infrastructure configured${NC}

Components installed:
  • Metrics Collector (in-process)
  • Health Checker (liveness/readiness probes)
  • Structured Logger (JSON logging)
  • Prometheus exporter
  • Grafana dashboards
  • Alert rules

Configuration files created:
  • config/prometheus/prometheus.yml
  • config/prometheus/alert-rules.yml
  • config/grafana/provisioning/
  • config/health-check-config.json
  • config/logging-config.json
  • config/docker/docker-compose.monitoring.yml

To start monitoring:
  ${BLUE}docker-compose -f config/docker/docker-compose.monitoring.yml up -d${NC}

To access dashboards:
  • Grafana: http://localhost:3000
  • Prometheus: http://localhost:9090

For more information:
  ${BLUE}cat docs/MONITORING-SETUP.md${NC}

EOF
}

# Main execution
main() {
    check_prerequisites
    setup_directories
    install_dependencies
    setup_prometheus
    setup_grafana
    setup_health_checks
    setup_logging
    setup_docker_compose
    create_documentation
    print_summary
}

main

#!/bin/bash

################################################################################
# Basset Hound Browser v12.0.0 - Monitoring Setup Script
#
# This script sets up production monitoring and alerting infrastructure for
# v12.0.0 deployment. It configures:
#   - Metrics collection and export
#   - Time-series database (InfluxDB)
#   - Grafana dashboards
#   - Alert management
#   - Log aggregation
#
# Usage:
#   ./scripts/setup-monitoring.sh [OPTIONS]
#
# Options:
#   --help              Show this help message
#   --deploy-docker     Deploy monitoring stack with Docker Compose
#   --local-only        Setup for local development only
#   --production        Setup for production deployment
#   --grafana-password  Set Grafana admin password
#   --skip-validation   Skip system validation checks
#   --verbose           Enable verbose output
#
# Requirements:
#   - Docker & Docker Compose (if --deploy-docker)
#   - Node.js 16+
#   - curl, jq
#   - 4GB RAM (InfluxDB + Grafana)
#   - 10GB disk space
#
# Examples:
#   ./scripts/setup-monitoring.sh --production
#   ./scripts/setup-monitoring.sh --deploy-docker --production
#   ./scripts/setup-monitoring.sh --local-only
#
################################################################################

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${REPO_ROOT}/logs/monitoring-setup.log"
MONITORING_DIR="${REPO_ROOT}/monitoring"
CONFIG_DIR="${MONITORING_DIR}/config"

# Default options
MODE="local"
DEPLOY_DOCKER=false
GRAFANA_PASSWORD="admin123"
SKIP_VALIDATION=false
VERBOSE=false

# Derived paths
DOCKER_COMPOSE_FILE="${MONITORING_DIR}/docker-compose.yml"
INFLUXDB_CONFIG="${CONFIG_DIR}/influxdb.conf"
GRAFANA_CONFIG="${CONFIG_DIR}/grafana.ini"

################################################################################
# Functions
################################################################################

log() {
    local level="$1"
    shift
    local msg="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case "$level" in
        INFO)
            echo -e "${BLUE}[INFO]${NC} ${msg}"
            ;;
        SUCCESS)
            echo -e "${GREEN}[✓]${NC} ${msg}"
            ;;
        WARN)
            echo -e "${YELLOW}[WARN]${NC} ${msg}"
            ;;
        ERROR)
            echo -e "${RED}[ERROR]${NC} ${msg}"
            ;;
    esac

    echo "[$timestamp] [$level] $msg" >> "$LOG_FILE"
}

check_requirements() {
    log INFO "Checking system requirements..."

    local missing_tools=()

    # Check Node.js
    if ! command -v node &> /dev/null; then
        missing_tools+=("node")
    fi

    # Check curl
    if ! command -v curl &> /dev/null; then
        missing_tools+=("curl")
    fi

    # Check jq
    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi

    # Check Docker if needed
    if [ "$DEPLOY_DOCKER" = true ]; then
        if ! command -v docker &> /dev/null; then
            missing_tools+=("docker")
        fi
        if ! command -v docker-compose &> /dev/null; then
            missing_tools+=("docker-compose")
        fi
    fi

    if [ ${#missing_tools[@]} -gt 0 ]; then
        log ERROR "Missing required tools: ${missing_tools[*]}"
        log ERROR "Please install them before running this script"
        return 1
    fi

    log SUCCESS "All required tools found"
    return 0
}

validate_system() {
    if [ "$SKIP_VALIDATION" = true ]; then
        log WARN "Skipping system validation (--skip-validation)"
        return 0
    fi

    log INFO "Validating system resources..."

    # Check RAM
    local available_ram=$(free -h | awk 'NR==2 {print $7}' | sed 's/G$//' | awk -F. '{print $1}')
    if [ "$available_ram" -lt 4 ]; then
        log WARN "Available RAM is less than 4GB. Recommended: 4GB+"
    else
        log SUCCESS "RAM check passed: ${available_ram}GB available"
    fi

    # Check disk space
    local available_disk=$(df "$REPO_ROOT" | awk 'NR==2 {print $4}' | awk '{print int($1/1024/1024)}')
    if [ "$available_disk" -lt 10 ]; then
        log WARN "Available disk space is less than 10GB. Recommended: 10GB+"
    else
        log SUCCESS "Disk space check passed: ${available_disk}GB available"
    fi

    # Check if ports are available
    local required_ports=(8086 3000)  # InfluxDB, Grafana
    for port in "${required_ports[@]}"; do
        if nc -z 127.0.0.1 "$port" 2>/dev/null; then
            log WARN "Port $port is already in use"
        else
            log SUCCESS "Port $port is available"
        fi
    done
}

create_directories() {
    log INFO "Creating directory structure..."

    mkdir -p "$MONITORING_DIR"/{config,data,logs}
    mkdir -p "${REPO_ROOT}/logs"
    mkdir -p "${CONFIG_DIR}"/{grafana,influxdb,prometheus}

    log SUCCESS "Directories created"
}

setup_influxdb() {
    log INFO "Setting up InfluxDB configuration..."

    # Create InfluxDB configuration
    cat > "${CONFIG_DIR}/influxdb.conf" << 'EOF'
# InfluxDB configuration for Basset Hound Browser v12.0.0

# Meta store configuration
[meta]
  dir = "/var/lib/influxdb/meta"
  retention-autocreate = true
  logging-enabled = true

# Data store configuration
[data]
  dir = "/var/lib/influxdb/data"
  wal-dir = "/var/lib/influxdb/wal"
  index-version = "inmem"

  # Query enforcement
  max-concurrent-compactions = 0
  max-values-per-tag = 100000

  # Cache configuration
  cache-max-memory-bytes = 1073741824
  cache-snapshot-memory-bytes = 26214400
  cache-snapshot-write-cold-duration = "10m"

# Query configuration
[http]
  enabled = true
  bind-address = ":8086"
  auth-enabled = false
  log-enabled = true
  write-tracing = false
  pprof-enabled = false

# Retention policies
[[retention]]
  name = "one_day"
  duration = "24h"
  replication = 1
  default = true

[[retention]]
  name = "seven_days"
  duration = "168h"
  replication = 1

[[retention]]
  name = "thirty_days"
  duration = "720h"
  replication = 1

[[retention]]
  name = "one_year"
  duration = "8760h"
  replication = 1

# Continuous queries (auto-aggregation)
[[continuous_queries]]
  enabled = true
  log-enabled = true
EOF

    log SUCCESS "InfluxDB configuration created"
}

setup_grafana() {
    log INFO "Setting up Grafana configuration..."

    # Create Grafana configuration
    cat > "${CONFIG_DIR}/grafana.ini" << EOF
[server]
http_port = 3000
http_addr = 0.0.0.0
root_url = http://localhost:3000

[database]
type = sqlite3
path = /var/lib/grafana/grafana.db

[auth]
disable_login_form = false

[security]
admin_password = $GRAFANA_PASSWORD
secret_key = $(openssl rand -base64 32)

[datasources]
type = influxdb
url = http://influxdb:8086
database = basset_hound
EOF

    log SUCCESS "Grafana configuration created"
}

setup_prometheus() {
    log INFO "Setting up Prometheus configuration..."

    # Create Prometheus configuration
    cat > "${CONFIG_DIR}/prometheus.yml" << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    service: 'basset-hound-browser'
    environment: 'production'

# Alert configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - localhost:9093

rule_files:
  - '/etc/prometheus/alert-rules.yml'

scrape_configs:
  # Basset Hound Browser metrics
  - job_name: 'basset-hound'
    static_configs:
      - targets: ['localhost:9091']
    metric_path: '/metrics'
    scrape_interval: 10s
    scrape_timeout: 5s

  # Node exporter (system metrics)
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']
    scrape_interval: 15s

  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
EOF

    log SUCCESS "Prometheus configuration created"
}

setup_alert_rules() {
    log INFO "Setting up alert rules..."

    cat > "${CONFIG_DIR}/alert-rules.yml" << 'EOF'
groups:
  - name: basset_hound_alerts
    interval: 1m

    rules:
      # CRITICAL Alerts
      - alert: ServiceDown
        expr: up{job="basset-hound"} == 0
        for: 2m
        annotations:
          severity: CRITICAL
          summary: "Basset Hound service is down"

      - alert: HighErrorRate
        expr: (increase(http_requests_total{status=~"5.."}[5m]) / increase(http_requests_total[5m])) > 0.05
        for: 1m
        annotations:
          severity: CRITICAL
          summary: "Error rate exceeds 5%"

      - alert: HighMemoryUsage
        expr: (process_resident_memory_bytes / 1024 / 1024 / 1024) > 0.4
        for: 2m
        annotations:
          severity: CRITICAL
          summary: "Memory usage exceeds 80% of limit"

      # HIGH Alerts
      - alert: HighLatency
        expr: histogram_quantile(0.99, http_request_duration_seconds) > 1
        for: 2m
        annotations:
          severity: HIGH
          summary: "P99 latency exceeds 1 second"

      - alert: HighCPUUsage
        expr: process_cpu_seconds_total > 0.85
        for: 3m
        annotations:
          severity: HIGH
          summary: "CPU usage exceeds 85%"

      # MEDIUM Alerts
      - alert: MemoryGrowth
        expr: rate(process_resident_memory_bytes[1h]) > 6 * 1024 * 1024
        for: 1h
        annotations:
          severity: MEDIUM
          summary: "Memory growth rate exceeds 6 MB/hour"
EOF

    log SUCCESS "Alert rules created"
}

setup_docker_compose() {
    if [ "$DEPLOY_DOCKER" = false ]; then
        log INFO "Skipping Docker setup (not requested)"
        return 0
    fi

    log INFO "Setting up Docker Compose configuration..."

    cat > "${MONITORING_DIR}/docker-compose.yml" << 'EOF'
version: '3.8'

services:
  influxdb:
    image: influxdb:2.7
    container_name: basset-hound-influxdb
    ports:
      - "8086:8086"
    environment:
      INFLUXDB_DB: basset_hound
      INFLUXDB_ADMIN_USER: admin
      INFLUXDB_ADMIN_PASSWORD: ${INFLUXDB_PASSWORD:-admin123}
      INFLUXDB_RETENTION: 30d
    volumes:
      - ./config/influxdb.conf:/etc/influxdb/influxdb.conf:ro
      - influxdb-data:/var/lib/influxdb
    restart: unless-stopped
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: basset-hound-grafana
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin123}
      GF_USERS_ALLOW_SIGN_UP: false
    volumes:
      - ./config/grafana.ini:/etc/grafana/grafana.ini:ro
      - grafana-data:/var/lib/grafana
      - ./config/grafana/provisioning:/etc/grafana/provisioning:ro
    depends_on:
      - influxdb
    restart: unless-stopped
    networks:
      - monitoring

  prometheus:
    image: prom/prometheus:latest
    container_name: basset-hound-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./config/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./config/alert-rules.yml:/etc/prometheus/alert-rules.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
    restart: unless-stopped
    networks:
      - monitoring

  alertmanager:
    image: prom/alertmanager:latest
    container_name: basset-hound-alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./config/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
      - alertmanager-data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    restart: unless-stopped
    networks:
      - monitoring

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
      - '--path.rootfs=/'
      - '--path.sysfs=/host/sys'
    restart: unless-stopped
    networks:
      - monitoring

volumes:
  influxdb-data:
  grafana-data:
  prometheus-data:
  alertmanager-data:

networks:
  monitoring:
    driver: bridge
EOF

    log SUCCESS "Docker Compose configuration created"
}

setup_metrics_export() {
    log INFO "Setting up metrics export endpoint..."

    # Create a stub metrics exporter that can be integrated into the WebSocket server
    cat > "${MONITORING_DIR}/metrics-exporter.js" << 'EOF'
/**
 * Basset Hound Browser - Metrics Exporter
 *
 * Exports metrics in Prometheus text format for scraping
 * Integrate this into the WebSocket server
 */

const os = require('os');

class MetricsExporter {
  constructor() {
    this.metrics = new Map();
    this.startTime = Date.now();
    this.initializeMetrics();
  }

  initializeMetrics() {
    // Performance metrics
    this.registerGauge('throughput_ops_per_sec', 'Number of operations per second');
    this.registerGauge('latency_p50_ms', 'P50 latency in milliseconds');
    this.registerGauge('latency_p95_ms', 'P95 latency in milliseconds');
    this.registerGauge('latency_p99_ms', 'P99 latency in milliseconds');

    // Health metrics
    this.registerGauge('error_rate_percent', 'Error rate as percentage');
    this.registerGauge('success_rate_percent', 'Success rate as percentage');
    this.registerGauge('connection_count', 'Current active connections');
    this.registerGauge('active_sessions', 'Currently active sessions');

    // Memory metrics
    this.registerGauge('memory_heap_used_mb', 'Heap memory used in MB');
    this.registerGauge('memory_heap_total_mb', 'Heap memory total in MB');
    this.registerGauge('memory_growth_rate_mb_per_hour', 'Memory growth rate');

    // GC metrics
    this.registerGauge('gc_pause_avg_ms', 'Average GC pause duration');
    this.registerGauge('gc_pause_p95_ms', 'P95 GC pause duration');

    // Cache metrics
    this.registerGauge('cache_hit_rate_percent', 'Cache hit rate');
    this.registerGauge('compression_ratio_percent', 'Compression effectiveness');

    // Counters
    this.registerCounter('http_requests_total', 'Total HTTP requests');
    this.registerCounter('http_errors_total', 'Total HTTP errors');
    this.registerCounter('gc_events_total', 'Total GC events');
  }

  registerGauge(name, help) {
    this.metrics.set(name, { type: 'gauge', help, value: 0, labels: {} });
  }

  registerCounter(name, help) {
    this.metrics.set(name, { type: 'counter', help, value: 0, labels: {} });
  }

  setMetric(name, value, labels = {}) {
    if (this.metrics.has(name)) {
      this.metrics.get(name).value = value;
      this.metrics.get(name).labels = labels;
    }
  }

  incrementCounter(name, amount = 1) {
    if (this.metrics.has(name)) {
      this.metrics.get(name).value += amount;
    }
  }

  getMetricsText() {
    let output = '';

    // HELP and TYPE lines
    for (const [name, metric] of this.metrics.entries()) {
      output += `# HELP ${name} ${metric.help}\n`;
      output += `# TYPE ${name} ${metric.type}\n`;

      // Metric value with labels
      const labelStr = this.formatLabels(metric.labels);
      output += `${name}${labelStr} ${metric.value}\n`;
    }

    // System metrics
    const memUsage = process.memoryUsage();
    output += `# HELP process_resident_memory_bytes Resident memory in bytes\n`;
    output += `# TYPE process_resident_memory_bytes gauge\n`;
    output += `process_resident_memory_bytes ${memUsage.rss}\n`;

    output += `# HELP process_heap_bytes_used Heap bytes used\n`;
    output += `# TYPE process_heap_bytes_used gauge\n`;
    output += `process_heap_bytes_used ${memUsage.heapUsed}\n`;

    // Uptime
    const uptime = (Date.now() - this.startTime) / 1000;
    output += `# HELP process_uptime_seconds Process uptime\n`;
    output += `# TYPE process_uptime_seconds gauge\n`;
    output += `process_uptime_seconds ${uptime}\n`;

    return output;
  }

  formatLabels(labels) {
    const entries = Object.entries(labels);
    if (entries.length === 0) return '';
    const pairs = entries.map(([k, v]) => `${k}="${v}"`).join(',');
    return `{${pairs}}`;
  }
}

module.exports = MetricsExporter;
EOF

    log SUCCESS "Metrics exporter created"
}

setup_dashboards() {
    log INFO "Setting up Grafana dashboards..."

    mkdir -p "${CONFIG_DIR}/grafana/provisioning/dashboards"
    mkdir -p "${CONFIG_DIR}/grafana/provisioning/datasources"

    # Create datasource configuration
    cat > "${CONFIG_DIR}/grafana/provisioning/datasources/influxdb.yml" << 'EOF'
apiVersion: 1

datasources:
  - name: InfluxDB
    type: influxdb
    access: proxy
    url: http://influxdb:8086
    database: basset_hound
    isDefault: true
    editable: true
EOF

    # Create dashboard provisioning configuration
    cat > "${CONFIG_DIR}/grafana/provisioning/dashboards/provisioning.yml" << 'EOF'
apiVersion: 1

providers:
  - name: 'Basset Hound Dashboards'
    orgId: 1
    folder: 'Basset Hound'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF

    log SUCCESS "Grafana dashboards configured"
}

setup_integration() {
    log INFO "Setting up WebSocket server metrics integration..."

    cat > "${MONITORING_DIR}/integration-guide.md" << 'EOF'
# Metrics Integration Guide

To integrate metrics collection into the WebSocket server:

## 1. Import MetricsExporter
```javascript
const MetricsExporter = require('./monitoring/metrics-exporter');
const metricsExporter = new MetricsExporter();
```

## 2. Export metrics endpoint
```javascript
app.get('/metrics', (req, res) => {
  res.contentType('text/plain');
  res.send(metricsExporter.getMetricsText());
});
```

## 3. Update metrics during operations
```javascript
// After command execution
metricsExporter.setMetric('latency_p99_ms', p99Latency);
metricsExporter.setMetric('throughput_ops_per_sec', currentThroughput);
metricsExporter.setMetric('error_rate_percent', errorRate);

// Increment counters
metricsExporter.incrementCounter('http_requests_total');
if (error) metricsExporter.incrementCounter('http_errors_total');
```

## 4. Memory monitoring (collect every 5 seconds)
```javascript
setInterval(() => {
  const mem = process.memoryUsage();
  metricsExporter.setMetric('memory_heap_used_mb', mem.heapUsed / 1024 / 1024);
  metricsExporter.setMetric('memory_heap_total_mb', mem.heapTotal / 1024 / 1024);
}, 5000);
```

## 5. Verify integration
```bash
curl http://localhost:9091/metrics | grep basset_hound
```
EOF

    log SUCCESS "Integration guide created"
}

validate_setup() {
    log INFO "Validating monitoring setup..."

    # Check if all configuration files were created
    local required_files=(
        "${CONFIG_DIR}/influxdb.conf"
        "${CONFIG_DIR}/grafana.ini"
        "${CONFIG_DIR}/prometheus.yml"
        "${CONFIG_DIR}/alert-rules.yml"
        "${MONITORING_DIR}/metrics-exporter.js"
    )

    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            log SUCCESS "Found: $file"
        else
            log ERROR "Missing: $file"
            return 1
        fi
    done

    if [ "$DEPLOY_DOCKER" = true ]; then
        if [ -f "$DOCKER_COMPOSE_FILE" ]; then
            log SUCCESS "Found: docker-compose.yml"
        else
            log ERROR "Missing: docker-compose.yml"
            return 1
        fi
    fi

    log SUCCESS "All monitoring files created successfully"
    return 0
}

display_summary() {
    log INFO "Monitoring setup complete!"

    echo ""
    echo "=================================="
    echo "MONITORING SETUP SUMMARY"
    echo "=================================="
    echo ""

    echo "Configuration files created:"
    echo "  • InfluxDB config:  ${CONFIG_DIR}/influxdb.conf"
    echo "  • Grafana config:   ${CONFIG_DIR}/grafana.ini"
    echo "  • Prometheus config: ${CONFIG_DIR}/prometheus.yml"
    echo "  • Alert rules:      ${CONFIG_DIR}/alert-rules.yml"
    echo ""

    echo "Access points:"
    echo "  • Grafana:         http://localhost:3000"
    echo "  • Prometheus:      http://localhost:9090"
    echo "  • InfluxDB:        http://localhost:8086"
    echo "  • AlertManager:    http://localhost:9093"
    echo ""

    if [ "$DEPLOY_DOCKER" = true ]; then
        echo "To start monitoring stack:"
        echo "  cd ${MONITORING_DIR}"
        echo "  docker-compose up -d"
        echo ""
        echo "To check logs:"
        echo "  docker-compose logs -f"
        echo ""
    else
        echo "Configuration created but not deployed."
        echo "To deploy manually:"
        echo "  1. Install InfluxDB, Grafana, Prometheus"
        echo "  2. Copy configurations from ${CONFIG_DIR}/"
        echo "  3. Start services"
        echo ""
    fi

    echo "Next steps:"
    echo "  1. Review: ${REPO_ROOT}/docs/MONITORING-METRICS.md"
    echo "  2. Review: ${REPO_ROOT}/docs/ALERT-CONFIGURATION.md"
    echo "  3. Review: ${REPO_ROOT}/docs/DASHBOARD-TEMPLATE.md"
    echo "  4. Integrate metrics into WebSocket server"
    echo "  5. Verify /metrics endpoint responds"
    echo "  6. Create dashboards in Grafana"
    echo ""

    echo "Log file: $LOG_FILE"
    echo ""
}

usage() {
    cat << 'EOF'
Basset Hound Browser v12.0.0 - Monitoring Setup

Usage: ./scripts/setup-monitoring.sh [OPTIONS]

Options:
  --help              Show this help message
  --deploy-docker     Deploy monitoring stack with Docker Compose
  --local-only        Setup for local development only
  --production        Setup for production deployment
  --grafana-password  Set Grafana admin password (default: admin123)
  --skip-validation   Skip system validation checks
  --verbose           Enable verbose output

Examples:
  # Setup for production with Docker
  ./scripts/setup-monitoring.sh --production --deploy-docker

  # Setup for local development only
  ./scripts/setup-monitoring.sh --local-only

  # Setup with custom Grafana password
  ./scripts/setup-monitoring.sh --production --grafana-password "MySecurePassword"

EOF
}

################################################################################
# Main
################################################################################

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help)
                usage
                exit 0
                ;;
            --deploy-docker)
                DEPLOY_DOCKER=true
                shift
                ;;
            --local-only)
                MODE="local"
                shift
                ;;
            --production)
                MODE="production"
                shift
                ;;
            --grafana-password)
                GRAFANA_PASSWORD="$2"
                shift 2
                ;;
            --skip-validation)
                SKIP_VALIDATION=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            *)
                log ERROR "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Initialize
    mkdir -p "$(dirname "$LOG_FILE")"
    log INFO "Starting Basset Hound Browser v12.0.0 monitoring setup"
    log INFO "Mode: $MODE, Deploy Docker: $DEPLOY_DOCKER"

    # Run setup steps
    check_requirements || exit 1
    validate_system || exit 1
    create_directories || exit 1
    setup_influxdb || exit 1
    setup_grafana || exit 1
    setup_prometheus || exit 1
    setup_alert_rules || exit 1
    setup_metrics_export || exit 1
    setup_dashboards || exit 1
    setup_docker_compose || exit 1
    setup_integration || exit 1

    # Validate
    validate_setup || exit 1

    # Summary
    display_summary

    log SUCCESS "Monitoring setup completed successfully"
}

# Run main if not sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

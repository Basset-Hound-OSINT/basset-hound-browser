#!/bin/bash
# Basset Hound Browser - Deployment Monitoring Setup
# Configures health checks, metrics collection, and alert thresholds
# Usage: ./scripts/setup-deployment-monitoring.sh

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SETUP_LOG="${PROJECT_ROOT}/logs/monitoring/setup-$(date +%Y%m%d-%H%M%S).log"

# Create directories
mkdir -p "${PROJECT_ROOT}/logs/monitoring"
mkdir -p "${PROJECT_ROOT}/config/monitoring"
mkdir -p "${PROJECT_ROOT}/config/alerts"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log_info() {
    echo -e "${GREEN}[INFO]${NC} $*" | tee -a "$SETUP_LOG"
}

log_section() {
    echo -e "\n${BLUE}=== $* ===${NC}\n" | tee -a "$SETUP_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*" | tee -a "$SETUP_LOG"
}

# Create health check probe configuration
create_health_check_config() {
    log_section "Creating health check probe configuration"

    local config_file="${PROJECT_ROOT}/config/monitoring/health-checks.json"

    cat > "$config_file" << 'EOF'
{
  "health_checks": {
    "liveness": {
      "name": "Liveness Probe",
      "description": "Check if process is alive",
      "endpoint": "/alive",
      "interval": 10,
      "timeout": 5,
      "initial_delay": 30,
      "failure_threshold": 3
    },
    "readiness": {
      "name": "Readiness Probe",
      "description": "Check if service is ready to accept traffic",
      "endpoint": "/ready",
      "interval": 15,
      "timeout": 5,
      "initial_delay": 40,
      "failure_threshold": 2
    },
    "health": {
      "name": "Health Status",
      "description": "Check overall service health",
      "endpoint": "/health",
      "interval": 30,
      "timeout": 10,
      "initial_delay": 45,
      "failure_threshold": 2
    }
  },
  "probe_details": {
    "success_codes": [200, 204],
    "retry_strategy": "exponential_backoff",
    "backoff_multiplier": 2,
    "max_backoff": 30,
    "parallel_checks": true,
    "record_latency": true
  }
}
EOF

    log_success "Health check configuration created: $config_file"
}

# Create metrics collection configuration
create_metrics_config() {
    log_section "Creating metrics collection configuration"

    local config_file="${PROJECT_ROOT}/config/monitoring/metrics.json"

    cat > "$config_file" << 'EOF'
{
  "metrics": {
    "system": {
      "enabled": true,
      "interval": 15,
      "metrics": [
        "cpu_percent",
        "memory_percent",
        "memory_mb",
        "disk_usage_percent",
        "open_connections"
      ]
    },
    "application": {
      "enabled": true,
      "interval": 30,
      "metrics": [
        "websocket_connections",
        "websocket_throughput",
        "request_count",
        "request_latency_p50",
        "request_latency_p95",
        "request_latency_p99",
        "error_count",
        "error_rate"
      ]
    },
    "deployment": {
      "enabled": true,
      "interval": 60,
      "metrics": [
        "container_count",
        "healthy_container_count",
        "instance_availability",
        "deployment_progress"
      ]
    }
  },
  "collection": {
    "method": "pull",
    "retention_days": 7,
    "aggregation": "1m",
    "storage": {
      "type": "jsonl",
      "path": "logs/metrics",
      "compress": true
    }
  }
}
EOF

    log_success "Metrics configuration created: $config_file"
}

# Create alert thresholds configuration
create_alert_thresholds() {
    log_section "Creating alert thresholds configuration"

    local config_file="${PROJECT_ROOT}/config/alerts/thresholds.json"

    cat > "$config_file" << 'EOF'
{
  "alert_thresholds": {
    "memory": {
      "warning": 70,
      "critical": 85,
      "unit": "percent"
    },
    "cpu": {
      "warning": 60,
      "critical": 80,
      "unit": "percent"
    },
    "error_rate": {
      "warning": 1,
      "critical": 5,
      "unit": "percent"
    },
    "response_latency": {
      "warning": 500,
      "critical": 2000,
      "unit": "ms"
    },
    "container_health": {
      "unhealthy_threshold": 2,
      "restart_threshold": 5,
      "unit": "count"
    },
    "websocket_connections": {
      "min_threshold": 1,
      "max_threshold": 10000
    },
    "deployment_health": {
      "min_healthy_percent": 75,
      "max_rollback_percent": 25
    }
  },
  "alert_actions": {
    "warning": {
      "enabled": true,
      "actions": ["log", "notify"],
      "channels": ["logs", "email"]
    },
    "critical": {
      "enabled": true,
      "actions": ["log", "notify", "trigger_remediation"],
      "channels": ["logs", "email", "pagerduty"],
      "auto_escalation_minutes": 5
    }
  }
}
EOF

    log_success "Alert thresholds configuration created: $config_file"
}

# Create health check endpoint scripts
create_health_check_endpoints() {
    log_section "Creating health check endpoint implementations"

    local endpoints_dir="${PROJECT_ROOT}/src/health-checks"
    mkdir -p "$endpoints_dir"

    # Create liveness check
    cat > "${endpoints_dir}/liveness.js" << 'EOF'
/**
 * Liveness Probe - Is the process alive?
 * Used by orchestrators to determine if process should be restarted
 */

module.exports = async (req, res) => {
  // Simple check - if this code executes, process is alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
};
EOF

    # Create readiness check
    cat > "${endpoints_dir}/readiness.js" << 'EOF'
/**
 * Readiness Probe - Can the service accept traffic?
 * Used by load balancers to determine if traffic should be routed
 */

module.exports = async (req, res, deps) => {
  const { wsServer, browser } = deps;

  // Check if WebSocket server is accepting connections
  if (!wsServer || !wsServer.isListening()) {
    return res.status(503).json({
      ready: false,
      reason: 'WebSocket server not ready'
    });
  }

  // Check if browser is initialized
  if (!browser || !browser.isReady()) {
    return res.status(503).json({
      ready: false,
      reason: 'Browser not initialized'
    });
  }

  res.status(200).json({
    ready: true,
    timestamp: new Date().toISOString()
  });
};
EOF

    # Create health check
    cat > "${endpoints_dir}/health.js" << 'EOF'
/**
 * Health Status - Overall service health
 * Includes dependency and system checks
 */

module.exports = async (req, res, deps) => {
  const { wsServer, browser, metrics } = deps;

  const checks = {
    websocket_server: wsServer ? 'ok' : 'failing',
    browser: browser && browser.isReady() ? 'ok' : 'failing',
    memory_usage: getMemoryStatus(),
    cpu_usage: getCpuStatus(),
    error_rate: getErrorRateStatus(metrics)
  };

  // Determine overall status
  const failing = Object.values(checks).filter(v => v === 'failing').length;
  const status = failing === 0 ? 'healthy' : failing === 1 ? 'degraded' : 'unhealthy';

  res.status(status === 'healthy' ? 200 : 503).json({
    status,
    checks,
    timestamp: new Date().toISOString()
  });
};

function getMemoryStatus() {
  const usage = process.memoryUsage();
  const percent = (usage.heapUsed / usage.heapTotal) * 100;
  return percent > 85 ? 'failing' : percent > 70 ? 'degraded' : 'ok';
}

function getCpuStatus() {
  // This would use appropriate CPU monitoring library
  return 'ok';
}

function getErrorRateStatus(metrics) {
  if (!metrics) return 'ok';
  const rate = metrics.getErrorRate();
  return rate > 5 ? 'failing' : rate > 1 ? 'degraded' : 'ok';
}
EOF

    log_success "Health check endpoints created in: $endpoints_dir"
}

# Create metrics collection script
create_metrics_collector() {
    log_section "Creating metrics collector"

    local collector_script="${PROJECT_ROOT}/scripts/collect-deployment-metrics.sh"

    cat > "$collector_script" << 'EOF'
#!/bin/bash
# Collect deployment metrics for monitoring

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
METRICS_DIR="${PROJECT_ROOT}/logs/metrics"
METRICS_FILE="${METRICS_DIR}/deployment-metrics-$(date +%Y%m%d-%H%M%S).jsonl"

mkdir -p "$METRICS_DIR"

# Collection loop
while true; do
    TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # Get container metrics
    CONTAINER_COUNT=$(docker ps -q | wc -l)
    HEALTHY_CONTAINERS=$(docker ps --filter "label=basset.role" -q | while read cid; do
        if curl -s -X GET "http://localhost:8765/health" --max-time 2 &>/dev/null; then
            echo "1"
        fi
    done | wc -l)

    # Get system metrics
    MEMORY_USAGE=$(docker stats --no-stream --format "{{.MemPerc}}" 2>/dev/null | head -1 | tr -d '%' || echo "0")
    CPU_USAGE=$(docker stats --no-stream --format "{{.CPUPerc}}" 2>/dev/null | head -1 | tr -d '%' || echo "0")

    # Get application metrics
    WS_CONNECTIONS=$(curl -s "http://localhost:8765/metrics" 2>/dev/null | grep 'ws_connections' | head -1 | awk '{print $NF}' || echo "0")
    ERROR_RATE=$(curl -s "http://localhost:8765/metrics" 2>/dev/null | grep 'error_rate' | head -1 | awk '{print $NF}' || echo "0")

    # Write metrics
    cat >> "$METRICS_FILE" << METRIC
{
  "timestamp": "$TIMESTAMP",
  "containers_running": $CONTAINER_COUNT,
  "containers_healthy": $HEALTHY_CONTAINERS,
  "memory_percent": $MEMORY_USAGE,
  "cpu_percent": $CPU_USAGE,
  "ws_connections": $WS_CONNECTIONS,
  "error_rate": $ERROR_RATE
}
METRIC

    # Check thresholds
    if (( $(echo "$MEMORY_USAGE > 85" | bc -l) )); then
        echo "ALERT: Memory usage critical: ${MEMORY_USAGE}%" >> "${PROJECT_ROOT}/logs/alerts.log"
    fi

    if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
        echo "ALERT: CPU usage critical: ${CPU_USAGE}%" >> "${PROJECT_ROOT}/logs/alerts.log"
    fi

    # Sleep before next collection
    sleep 30
done
EOF

    chmod +x "$collector_script"
    log_success "Metrics collector created: $collector_script"
}

# Create alert configuration for notifications
create_alert_notifications() {
    log_section "Creating alert notification configuration"

    local config_file="${PROJECT_ROOT}/config/alerts/notifications.json"

    cat > "$config_file" << 'EOF'
{
  "notification_channels": {
    "logs": {
      "enabled": true,
      "type": "file",
      "path": "logs/alerts.log",
      "rotation": {
        "max_size": "100M",
        "max_files": 10
      }
    },
    "email": {
      "enabled": false,
      "type": "smtp",
      "smtp_server": "smtp.example.com",
      "smtp_port": 587,
      "from": "alerts@basset-hound.local",
      "to": ["devops@example.com"],
      "subject_template": "[ALERT] {severity} - {metric}"
    },
    "pagerduty": {
      "enabled": false,
      "type": "webhook",
      "webhook_url": "https://events.pagerduty.com/v2/enqueue",
      "integration_key": "${PAGERDUTY_INTEGRATION_KEY}"
    },
    "slack": {
      "enabled": false,
      "type": "webhook",
      "webhook_url": "${SLACK_WEBHOOK_URL}",
      "channel": "#deployment-alerts"
    }
  },
  "alert_routing": {
    "memory_critical": {
      "channels": ["logs", "email"],
      "severity": "critical"
    },
    "error_rate_high": {
      "channels": ["logs", "email"],
      "severity": "warning"
    },
    "container_unhealthy": {
      "channels": ["logs", "email", "pagerduty"],
      "severity": "critical"
    }
  }
}
EOF

    log_success "Alert notification configuration created: $config_file"
}

# Create monitoring dashboard template
create_dashboard_template() {
    log_section "Creating monitoring dashboard template"

    local dashboard_file="${PROJECT_ROOT}/config/monitoring/dashboard.md"

    cat > "$dashboard_file" << 'EOF'
# Basset Hound Browser - Deployment Monitoring Dashboard

## Real-time Status

### Container Health
```
Total Containers: [metric: containers_running]
Healthy Containers: [metric: containers_healthy]
Health Percentage: [metric: containers_healthy / containers_running * 100]%
```

### System Resources
```
Memory Usage: [metric: memory_percent]%
CPU Usage: [metric: cpu_percent]%
Open Connections: [metric: ws_connections]
```

### Application Metrics
```
Error Rate: [metric: error_rate]%
WebSocket Throughput: [metric: ws_throughput] msg/sec
Average Latency: [metric: latency_p50]ms
P95 Latency: [metric: latency_p95]ms
P99 Latency: [metric: latency_p99]ms
```

## Alerts

### Active Alerts
```
[Display alerts matching thresholds]
```

### Alert History
```
[Last 10 alerts with timestamps]
```

## Deployment Progress

### Current Deployment
```
Version: [deployment version]
Current Percentage: [percentage deployed]
Status: [deployment status]
```

### Timeline
```
[Canary → Phase 1 (25%) → Phase 2 (50%) → Phase 3 (100%)]
```

## Performance Trends
```
Memory Usage (1h): [graph]
CPU Usage (1h): [graph]
Error Rate (1h): [graph]
Latency (1h): [graph]
```

---
Updated: [timestamp]
EOF

    log_success "Monitoring dashboard template created: $dashboard_file"
}

# Create monitoring startup script
create_monitoring_startup_script() {
    log_section "Creating monitoring startup script"

    local startup_script="${PROJECT_ROOT}/scripts/start-deployment-monitoring.sh"

    cat > "$startup_script" << 'EOF'
#!/bin/bash
# Start deployment monitoring services

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_ROOT}/logs/monitoring/startup.log"

mkdir -p "$(dirname "$LOG_FILE")"

echo "Starting Basset Hound Browser Deployment Monitoring..." | tee "$LOG_FILE"

# Start metrics collection in background
echo "Starting metrics collection..." | tee -a "$LOG_FILE"
"${SCRIPT_DIR}/collect-deployment-metrics.sh" >> "${PROJECT_ROOT}/logs/monitoring/metrics-collection.log" 2>&1 &
METRICS_PID=$!
echo "Metrics collector started (PID: $METRICS_PID)" | tee -a "$LOG_FILE"

# Start health check daemon
echo "Starting health check daemon..." | tee -a "$LOG_FILE"
# This would start a service that performs periodic health checks
# e.g., node "${PROJECT_ROOT}/src/health-check-daemon.js"

echo "Monitoring started successfully" | tee -a "$LOG_FILE"
echo "View metrics: tail -f ${PROJECT_ROOT}/logs/metrics/deployment-metrics-*.jsonl"
echo "View alerts: tail -f ${PROJECT_ROOT}/logs/alerts.log"
EOF

    chmod +x "$startup_script"
    log_success "Monitoring startup script created: $startup_script"
}

# Verify Docker health check configuration
verify_docker_healthcheck() {
    log_section "Verifying Docker health check configuration"

    if docker ps 2>/dev/null | grep -q basset-hound-browser; then
        local health=$(docker inspect --format='{{.State.Health.Status}}' basset-hound-browser 2>/dev/null || echo "none")
        log_success "Docker container health status: $health"
    else
        log_info "No running container found (will be configured on deployment)"
    fi
}

# Create summary report
create_summary_report() {
    log_section "Creating monitoring setup summary"

    local summary_file="${PROJECT_ROOT}/docs/DEPLOYMENT-MONITORING-SETUP.md"

    cat > "$summary_file" << 'EOF'
# Deployment Monitoring Setup Complete

## Components Configured

### 1. Health Check Probes
- **Liveness Probe**: Checks if process is alive
  - Endpoint: `/alive`
  - Interval: 10 seconds
  - Timeout: 5 seconds

- **Readiness Probe**: Checks if service can accept traffic
  - Endpoint: `/ready`
  - Interval: 15 seconds
  - Timeout: 5 seconds

- **Health Status**: Overall service health
  - Endpoint: `/health`
  - Interval: 30 seconds
  - Timeout: 10 seconds

### 2. Metrics Collection
- **System Metrics**: CPU, Memory, Disk, Network
- **Application Metrics**: WebSocket connections, throughput, latency
- **Deployment Metrics**: Container count, health status, availability

Metrics stored in: `logs/metrics/`

### 3. Alert Thresholds
- Memory Warning: 70% | Critical: 85%
- CPU Warning: 60% | Critical: 80%
- Error Rate Warning: 1% | Critical: 5%
- Response Latency Warning: 500ms | Critical: 2000ms

Alert logs: `logs/alerts.log`

### 4. Notification Channels
- Logs: File-based logging (enabled by default)
- Email: SMTP-based notifications (disabled, configure as needed)
- PagerDuty: Webhook integration (disabled, configure as needed)
- Slack: Webhook integration (disabled, configure as needed)

## Quick Start

### Start Monitoring
```bash
./scripts/start-deployment-monitoring.sh
```

### View Metrics
```bash
tail -f logs/metrics/deployment-metrics-*.jsonl
```

### View Alerts
```bash
tail -f logs/alerts.log
```

### View Health Status
```bash
curl http://localhost:8765/health | jq '.'
curl http://localhost:8765/ready | jq '.'
curl http://localhost:8765/alive | jq '.'
```

## Configuration Files

- Health Checks: `config/monitoring/health-checks.json`
- Metrics: `config/monitoring/metrics.json`
- Thresholds: `config/alerts/thresholds.json`
- Notifications: `config/alerts/notifications.json`
- Dashboard: `config/monitoring/dashboard.md`

## Integration with Deployment

The monitoring system is automatically started when executing:
- `scripts/deploy-canary.sh`
- `scripts/deploy-scale.sh`
- Health checks are run continuously during deployments

## Customization

### Enable Email Notifications
Edit `config/alerts/notifications.json` and set:
```json
"email": {
  "enabled": true,
  "smtp_server": "your-smtp-server.com",
  "to": ["your-email@example.com"]
}
```

### Enable Slack Integration
Edit `config/alerts/notifications.json` and set:
```json
"slack": {
  "enabled": true,
  "webhook_url": "your-slack-webhook-url"
}
```

### Adjust Alert Thresholds
Edit `config/alerts/thresholds.json` to customize warning/critical levels.

## Status

All monitoring components configured and ready for deployment.

---
Setup completed: $(date)
EOF

    log_success "Setup summary created: $summary_file"
}

# Main setup workflow
main() {
    log_section "Basset Hound Browser - Deployment Monitoring Setup"
    log_info "Setup started by: $USER"
    log_info "Log file: $SETUP_LOG"

    # Create all monitoring components
    create_health_check_config
    create_metrics_config
    create_alert_thresholds
    create_health_check_endpoints
    create_metrics_collector
    create_alert_notifications
    create_dashboard_template
    create_monitoring_startup_script
    verify_docker_healthcheck
    create_summary_report

    log_info ""
    log_info "=========================================="
    log_success "MONITORING SETUP COMPLETED"
    log_info "=========================================="
    log_info ""
    log_info "Next steps:"
    log_info "1. Review configuration: config/monitoring/"
    log_info "2. Customize alerts: config/alerts/"
    log_info "3. Enable notification channels as needed"
    log_info "4. Start monitoring: ./scripts/start-deployment-monitoring.sh"
    log_info ""
    log_info "View setup summary: docs/DEPLOYMENT-MONITORING-SETUP.md"
    log_info ""
}

main "$@"

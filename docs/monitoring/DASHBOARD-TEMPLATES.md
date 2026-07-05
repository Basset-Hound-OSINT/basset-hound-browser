# Basset Hound Browser - Grafana Dashboard Templates

**Version:** 1.0.0  
**Date:** June 21, 2026  
**Format:** Grafana JSON Dashboard Templates

---

## Table of Contents

1. [Overview](#overview)
2. [System Health Dashboard](#system-health-dashboard)
3. [Application Performance Dashboard](#application-performance-dashboard)
4. [Security Monitoring Dashboard](#security-monitoring-dashboard)
5. [Real-Time Operations Dashboard](#real-time-operations-dashboard)
6. [Installation Instructions](#installation-instructions)

---

## Overview

This document provides ready-to-use Grafana dashboard templates for monitoring the Basset Hound Browser.

**Prerequisites:**
- Grafana 8.0+
- Prometheus data source configured
- Metrics export endpoint running at `/metrics`

---

## System Health Dashboard

**Purpose:** Monitor system-level metrics (CPU, memory, disk, network)

**Panels:**
1. CPU Usage (Gauge + Time Series)
2. Memory Usage (Gauge + Time Series + Growth Rate)
3. Disk I/O (Bar chart)
4. Network Throughput (Time Series)
5. Load Average (Time Series)
6. Disk Usage (Pie chart)

### Installation

1. Open Grafana UI (http://localhost:3000)
2. Navigate to Dashboards → Import
3. Paste the following JSON or upload as file:

```json
{
  "dashboard": {
    "title": "Basset Hound - System Health",
    "tags": ["basset-hound", "system"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "CPU Usage",
        "type": "stat",
        "targets": [
          {
            "expr": "system_cpu_usage{job=\"basset-hound\"}",
            "legendFormat": "{{ instance }}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "min": 0,
            "max": 100,
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "color": "green", "value": 0 },
                { "color": "yellow", "value": 70 },
                { "color": "red", "value": 85 }
              ]
            }
          }
        },
        "gridPos": { "h": 8, "w": 6, "x": 0, "y": 0 }
      },
      {
        "id": 2,
        "title": "Memory Usage",
        "type": "stat",
        "targets": [
          {
            "expr": "system_memory_heap_used_percent{job=\"basset-hound\"}",
            "legendFormat": "Heap Used %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "min": 0,
            "max": 100,
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "color": "green", "value": 0 },
                { "color": "yellow", "value": 70 },
                { "color": "red", "value": 85 }
              ]
            }
          }
        },
        "gridPos": { "h": 8, "w": 6, "x": 6, "y": 0 }
      },
      {
        "id": 3,
        "title": "System Memory",
        "type": "stat",
        "targets": [
          {
            "expr": "system_memory_system_used_percent{job=\"basset-hound\"}",
            "legendFormat": "System Memory %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "min": 0,
            "max": 100,
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "color": "green", "value": 0 },
                { "color": "yellow", "value": 75 },
                { "color": "red", "value": 90 }
              ]
            }
          }
        },
        "gridPos": { "h": 8, "w": 6, "x": 12, "y": 0 }
      },
      {
        "id": 4,
        "title": "Load Average",
        "type": "timeseries",
        "targets": [
          {
            "expr": "system_cpu_load_one{job=\"basset-hound\"}",
            "legendFormat": "1-min"
          },
          {
            "expr": "system_cpu_load_five{job=\"basset-hound\"}",
            "legendFormat": "5-min"
          },
          {
            "expr": "system_cpu_load_fifteen{job=\"basset-hound\"}",
            "legendFormat": "15-min"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "custom": {
              "lineWidth": 2,
              "fillOpacity": 10
            }
          }
        },
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 }
      },
      {
        "id": 5,
        "title": "Disk Read/Write",
        "type": "timeseries",
        "targets": [
          {
            "expr": "rate(system_disk_io_read_bytes[1m]){job=\"basset-hound\"}",
            "legendFormat": "Read {{ device }}"
          },
          {
            "expr": "rate(system_disk_io_write_bytes[1m]){job=\"basset-hound\"}",
            "legendFormat": "Write {{ device }}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "Bps",
            "custom": {
              "lineWidth": 2,
              "fillOpacity": 10
            }
          }
        },
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 }
      },
      {
        "id": 6,
        "title": "Network Throughput",
        "type": "timeseries",
        "targets": [
          {
            "expr": "rate(system_network_io_in_bytes[1m]){job=\"basset-hound\"}",
            "legendFormat": "In {{ interface }}"
          },
          {
            "expr": "rate(system_network_io_out_bytes[1m]){job=\"basset-hound\"}",
            "legendFormat": "Out {{ interface }}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "Bps",
            "custom": {
              "lineWidth": 2,
              "fillOpacity": 10
            }
          }
        },
        "gridPos": { "h": 8, "w": 24, "x": 0, "y": 16 }
      }
    ],
    "refresh": "10s",
    "schemaVersion": 27,
    "style": "dark",
    "templating": {
      "list": [
        {
          "name": "instance",
          "type": "query",
          "query": "label_values(system_cpu_usage, instance)",
          "current": { "value": "localhost:9090" }
        }
      ]
    }
  }
}
```

---

## Application Performance Dashboard

**Purpose:** Monitor application metrics (throughput, latency, errors)

**Panels:**
1. Request Throughput (Time Series + Stat)
2. Latency Percentiles (Heatmap)
3. Error Rate (Stat + Time Series)
4. Active Connections (Time Series)
5. Top Commands by Count (Bar Chart)
6. Error Distribution (Pie Chart)

### Installation

```json
{
  "dashboard": {
    "title": "Basset Hound - Application Performance",
    "tags": ["basset-hound", "application"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Throughput (Commands/sec)",
        "type": "timeseries",
        "targets": [
          {
            "expr": "rate(app_requests_total[1m]){job=\"basset-hound\"}",
            "legendFormat": "Commands/sec"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "custom": {
              "lineWidth": 2,
              "fillOpacity": 10
            }
          }
        },
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 }
      },
      {
        "id": 2,
        "title": "Current Throughput",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(app_requests_total[1m]){job=\"basset-hound\"}",
            "legendFormat": "Commands/sec"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short"
          }
        },
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 }
      },
      {
        "id": 3,
        "title": "Latency (p50, p95, p99)",
        "type": "timeseries",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, rate(app_latency_bucket[1m]))",
            "legendFormat": "p50"
          },
          {
            "expr": "histogram_quantile(0.95, rate(app_latency_bucket[1m]))",
            "legendFormat": "p95"
          },
          {
            "expr": "histogram_quantile(0.99, rate(app_latency_bucket[1m]))",
            "legendFormat": "p99"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "ms",
            "custom": {
              "lineWidth": 2,
              "fillOpacity": 10
            }
          }
        },
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 }
      },
      {
        "id": 4,
        "title": "Error Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(app_errors_total[5m]) / rate(app_requests_total[5m])",
            "legendFormat": "Error Rate"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percentunit",
            "min": 0,
            "max": 1,
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "color": "green", "value": 0 },
                { "color": "yellow", "value": 0.01 },
                { "color": "red", "value": 0.05 }
              ]
            }
          }
        },
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 }
      },
      {
        "id": 5,
        "title": "Active Connections",
        "type": "timeseries",
        "targets": [
          {
            "expr": "app_connections_active{job=\"basset-hound\"}",
            "legendFormat": "{{ state }}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "custom": {
              "lineWidth": 2,
              "fillOpacity": 10
            }
          }
        },
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 16 }
      },
      {
        "id": 6,
        "title": "Top Commands",
        "type": "barcauge",
        "targets": [
          {
            "expr": "topk(10, rate(app_requests_total[5m]) by (command))",
            "legendFormat": "{{ command }}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short"
          }
        },
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 16 }
      }
    ],
    "refresh": "10s",
    "schemaVersion": 27,
    "style": "dark"
  }
}
```

---

## Security Monitoring Dashboard

**Purpose:** Monitor security-related metrics (rate limiting, validation, auth)

**Panels:**
1. Rate Limit Violations (Stat + Time Series)
2. Validation Failures (Bar Chart)
3. Authentication Attempts (Time Series)
4. Input Validation Errors (Pie Chart)
5. Security Status (Multi-stat)
6. Threats Timeline (Table)

### Installation

```json
{
  "dashboard": {
    "title": "Basset Hound - Security Monitoring",
    "tags": ["basset-hound", "security"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Rate Limit Violations",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(security_ratelimit_violations_total[5m])",
            "legendFormat": "Violations/sec"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "color": "green", "value": 0 },
                { "color": "yellow", "value": 1 },
                { "color": "red", "value": 5 }
              ]
            }
          }
        },
        "gridPos": { "h": 8, "w": 6, "x": 0, "y": 0 }
      },
      {
        "id": 2,
        "title": "Size Validation Rejections",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(security_validation_size_rejections_total[5m])",
            "legendFormat": "Rejections/sec"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "color": "green", "value": 0 },
                { "color": "yellow", "value": 0.5 },
                { "color": "red", "value": 2 }
              ]
            }
          }
        },
        "gridPos": { "h": 8, "w": 6, "x": 6, "y": 0 }
      },
      {
        "id": 3,
        "title": "Path Validation Failures",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(security_validation_path_failures_total[5m])",
            "legendFormat": "Failures/sec"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "color": "green", "value": 0 },
                { "color": "yellow", "value": 0.1 },
                { "color": "red", "value": 1 }
              ]
            }
          }
        },
        "gridPos": { "h": 8, "w": 6, "x": 12, "y": 0 }
      },
      {
        "id": 4,
        "title": "Input Validation Errors",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(security_validation_input_failures_total[5m])",
            "legendFormat": "Errors/sec"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "color": "green", "value": 0 },
                { "color": "yellow", "value": 2 },
                { "color": "red", "value": 10 }
              ]
            }
          }
        },
        "gridPos": { "h": 8, "w": 6, "x": 18, "y": 0 }
      },
      {
        "id": 5,
        "title": "Rate Limit Violations Timeline",
        "type": "timeseries",
        "targets": [
          {
            "expr": "rate(security_ratelimit_violations_total[1m])",
            "legendFormat": "Violations"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "custom": {
              "lineWidth": 2,
              "fillOpacity": 10
            }
          }
        },
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 }
      },
      {
        "id": 6,
        "title": "Validation Failures by Type",
        "type": "piechart",
        "targets": [
          {
            "expr": "sum by (type) (rate(security_validation_failures_total[5m]))",
            "legendFormat": "{{ type }}"
          }
        ],
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 }
      }
    ],
    "refresh": "10s",
    "schemaVersion": 27,
    "style": "dark"
  }
}
```

---

## Real-Time Operations Dashboard

**Purpose:** Single-screen operational overview for on-call engineers

**Panels:**
1. Service Status (Status panel)
2. Key Metrics Summary (Multi-stat)
3. Alerts (Table)
4. Recent Errors (Table)
5. Incident Timeline (Graph)
6. Quick Actions (Text panel)

### Installation

```json
{
  "dashboard": {
    "title": "Basset Hound - Real-Time Operations",
    "tags": ["basset-hound", "operations"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Service Status",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"basset-hound\"}",
            "legendFormat": "{{ instance }}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "custom": {
              "hideFrom": {
                "tooltip": false,
                "viz": false,
                "legend": false
              }
            },
            "mappings": [
              {
                "options": {
                  "0": { "text": "DOWN", "color": "red" },
                  "1": { "text": "UP", "color": "green" }
                },
                "type": "value"
              }
            ]
          }
        },
        "gridPos": { "h": 4, "w": 4, "x": 0, "y": 0 }
      },
      {
        "id": 2,
        "title": "Active Connections",
        "type": "stat",
        "targets": [
          {
            "expr": "app_connections_active{job=\"basset-hound\"}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "color": "blue", "value": 0 },
                { "color": "green", "value": 10 }
              ]
            }
          }
        },
        "gridPos": { "h": 4, "w": 4, "x": 4, "y": 0 }
      },
      {
        "id": 3,
        "title": "Throughput (cmds/sec)",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(app_requests_total[1m]){job=\"basset-hound\"}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short"
          }
        },
        "gridPos": { "h": 4, "w": 4, "x": 8, "y": 0 }
      },
      {
        "id": 4,
        "title": "Error Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "(rate(app_errors_total[5m]) / rate(app_requests_total[5m])) * 100"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "color": "green", "value": 0 },
                { "color": "yellow", "value": 1 },
                { "color": "red", "value": 5 }
              ]
            }
          }
        },
        "gridPos": { "h": 4, "w": 4, "x": 12, "y": 0 }
      },
      {
        "id": 5,
        "title": "p99 Latency (ms)",
        "type": "stat",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(app_latency_bucket[5m]))"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "ms",
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "color": "green", "value": 0 },
                { "color": "yellow", "value": 100 },
                { "color": "red", "value": 500 }
              ]
            }
          }
        },
        "gridPos": { "h": 4, "w": 4, "x": 16, "y": 0 }
      },
      {
        "id": 6,
        "title": "CPU Usage",
        "type": "stat",
        "targets": [
          {
            "expr": "system_cpu_usage{job=\"basset-hound\"}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "color": "green", "value": 0 },
                { "color": "yellow", "value": 70 },
                { "color": "red", "value": 85 }
              ]
            }
          }
        },
        "gridPos": { "h": 4, "w": 4, "x": 20, "y": 0 }
      },
      {
        "id": 7,
        "title": "Recent Alerts",
        "type": "table",
        "targets": [
          {
            "expr": "ALERTS{job=\"basset-hound\", severity=\"critical\" or severity=\"warning\"}"
          }
        ],
        "gridPos": { "h": 8, "w": 24, "x": 0, "y": 4 }
      },
      {
        "id": 8,
        "title": "System Overview Timeline",
        "type": "timeseries",
        "targets": [
          {
            "expr": "system_cpu_usage{job=\"basset-hound\"}",
            "legendFormat": "CPU %"
          },
          {
            "expr": "system_memory_heap_used_percent{job=\"basset-hound\"}",
            "legendFormat": "Memory %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "custom": {
              "lineWidth": 1,
              "fillOpacity": 5
            }
          }
        },
        "gridPos": { "h": 8, "w": 24, "x": 0, "y": 12 }
      }
    ],
    "refresh": "5s",
    "schemaVersion": 27,
    "style": "dark"
  }
}
```

---

## Installation Instructions

### Prerequisites

1. **Grafana Installation**
   ```bash
   docker run -d -p 3000:3000 grafana/grafana
   ```

2. **Add Prometheus Data Source**
   - Navigate to Configuration → Data Sources
   - Click "Add data source"
   - Select Prometheus
   - Set URL to `http://prometheus:9090`
   - Click Save & Test

3. **Prometheus Configuration**
   ```yaml
   # prometheus.yml
   scrape_configs:
     - job_name: 'basset-hound'
       static_configs:
         - targets: ['localhost:9090']
       metrics_path: '/metrics'
       scrape_interval: 10s
   ```

### Import Dashboards

**Method 1: Via UI**
1. Open Grafana (http://localhost:3000)
2. Navigate to Dashboards → Import
3. Copy entire JSON from each dashboard template above
4. Paste into import dialog
5. Click "Load"

**Method 2: Via API**
```bash
curl -X POST http://localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @dashboard.json
```

**Method 3: Via provisioning**
```yaml
# grafana/provisioning/dashboards/basset-hound.yml
apiVersion: 1

providers:
  - name: 'Basset Hound'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    options:
      path: /var/lib/grafana/dashboards
```

### Alerting Setup

1. **Create Notification Channel**
   - Configuration → Notification Channels
   - New channel
   - Select type (Slack, Email, PagerDuty, etc.)
   - Configure as needed

2. **Create Alert Rules**
   - Edit dashboard
   - Click on panel
   - "Alert" tab
   - "Create Alert"
   - Set conditions and notification channel

3. **Example Alert Rule**
   ```
   Alert name: High CPU Usage
   Condition: system_cpu_usage > 85 for 5 minutes
   Notification: ops-team
   ```

---

## Dashboard Refresh Strategy

### Recommended Refresh Intervals

| Dashboard | Interval | Use Case |
|---|---|---|
| Real-Time Operations | 5 seconds | On-call monitoring |
| Application Performance | 10 seconds | Development/debugging |
| System Health | 10 seconds | Capacity planning |
| Security Monitoring | 30 seconds | Security review |

### Auto-Refresh Configuration

```javascript
// In each dashboard JSON
"refresh": "10s",  // Valid values: "1s", "5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h"
```

---

## Best Practices

1. **Time Range Selection**
   - Development: 1-6 hours
   - On-call: Current
   - Analysis: 24+ hours

2. **Panel Configuration**
   - Use consistent color schemes (green=good, yellow=warning, red=critical)
   - Include thresholds for visual alerts
   - Add legends with descriptions

3. **Data Aggregation**
   - Use 1-min aggregation for real-time dashboards
   - Use 5-min aggregation for trend analysis
   - Use hourly aggregation for long-term storage

4. **Dashboard Organization**
   - Create separate dashboards for different audiences
   - Use tags for easy discovery
   - Document custom queries

---

**End of Dashboard Templates**

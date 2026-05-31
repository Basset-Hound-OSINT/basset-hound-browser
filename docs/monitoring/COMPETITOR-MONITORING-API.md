# Competitor Monitoring API Reference

**Version:** v12.2.0  
**Base Protocol:** WebSocket  
**Default Port:** 8765

## API Overview

The Competitor Monitoring API provides 30+ commands for managing competitor website monitoring, detecting changes, and configuring alerts.

### Response Format

All responses follow this standard format:

```javascript
{
  "id": "unique-request-id",
  "command": "command-name",
  "success": true,
  "result": {
    // Command-specific results
  },
  "error": null  // Only present if success is false
}
```

### Error Response

```javascript
{
  "id": "unique-request-id",
  "command": "command-name",
  "success": false,
  "error": "Error message description",
  "recovery": {
    "suggestion": "Try this...",
    "availableCommands": [...]
  }
}
```

---

## Monitor Management Commands

### add_competitor_monitor

Add a new competitor website to monitor.

**Request:**
```javascript
{
  "command": "add_competitor_monitor",
  "url": "https://competitor.com",
  "name": "Competitor Name",
  "frequency": "daily",  // hourly, daily, weekly, monthly
  "alerts": {
    "enableEmail": true,
    "emailAddresses": ["alerts@company.com"],
    "enableWebhook": true,
    "webhookUrl": "https://api.company.com/hooks",
    "enableSlack": true,
    "slackWebhookUrl": "https://hooks.slack.com/...",
    "contentChangePercent": 5,
    "performanceThresholdMs": 1000
  },
  "tags": ["ecommerce", "competitor"],
  "metadata": {"region": "US", "industry": "tech"}
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "monitor": {
      "id": "monitor_abc123",
      "url": "https://competitor.com",
      "name": "Competitor Name",
      "status": "idle",
      "createdAt": 1715000000000,
      "nextCheckAt": 1715086400000,
      // ... full monitor object
    }
  }
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| url | string | Yes | Full website URL (must be valid) |
| name | string | Yes | Display name for the competitor |
| frequency | string | No | Monitoring frequency (default: daily) |
| alerts | object | No | Alert configuration object |
| tags | array | No | Organizational tags for filtering |
| metadata | object | No | Custom metadata for tracking |

**Errors:**
- `"URL and name are required"` - Missing required fields
- `"Invalid URL format"` - URL not properly formatted
- `"Monitor for this URL already exists"` - Duplicate prevention
- `"Maximum monitors (100) reached"` - Capacity limit

---

### list_competitor_monitors

List all monitored competitors with optional filtering.

**Request:**
```javascript
{
  "command": "list_competitor_monitors",
  "status": "active",  // Optional: active, paused, error, idle
  "tag": "ecommerce",  // Optional: filter by tag
  "limit": 50,
  "offset": 0
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "monitors": [
      {
        "id": "monitor_abc123",
        "name": "Competitor A",
        "url": "https://competitor-a.com",
        "status": "active",
        "frequency": "daily",
        "checkCount": 45,
        "successCount": 43,
        "failureCount": 2
      }
    ],
    "total": 15,
    "limit": 50,
    "offset": 0
  }
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by monitor status |
| tag | string | No | Filter by organizational tag |
| limit | number | No | Results per page (default: 100) |
| offset | number | No | Pagination offset (default: 0) |

---

### get_competitor_monitor

Get detailed information about a specific monitor.

**Request:**
```javascript
{
  "command": "get_competitor_monitor",
  "monitor_id": "monitor_abc123"
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "monitor": {
      "id": "monitor_abc123",
      "url": "https://competitor.com",
      "name": "Competitor A",
      "status": "active",
      "frequency": "daily",
      "tags": ["ecommerce"],
      "createdAt": 1715000000000,
      "lastCheckAt": 1715100000000,
      "nextCheckAt": 1715200000000,
      "checkCount": 45,
      "successCount": 43,
      "failureCount": 2,
      "stats": {
        "totalChecks": 45,
        "successRate": 95.56,
        "uptime": true
      },
      "snapshots": 23,
      "changes": 12,
      "isCurrentlyChecking": false,
      "alerts": {
        "enableEmail": true,
        "emailAddresses": ["alerts@company.com"],
        // ... alert config
      }
    }
  }
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| monitor_id | string | Yes | Unique monitor ID |

---

### update_competitor_monitor

Update monitor configuration.

**Request:**
```javascript
{
  "command": "update_competitor_monitor",
  "monitor_id": "monitor_abc123",
  "updates": {
    "name": "New Name",
    "frequency": "hourly",
    "tags": ["updated", "tag"],
    "metadata": {"key": "value"}
  }
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "monitor": {
      // Updated monitor object
    }
  }
}
```

---

### pause_competitor_monitor

Pause monitoring for a competitor.

**Request:**
```javascript
{
  "command": "pause_competitor_monitor",
  "monitor_id": "monitor_abc123"
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "monitor": {
      // Monitor with status: "paused"
    }
  }
}
```

---

### resume_competitor_monitor

Resume monitoring for a paused competitor.

**Request:**
```javascript
{
  "command": "resume_competitor_monitor",
  "monitor_id": "monitor_abc123"
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "monitor": {
      // Monitor with status: "active"
    }
  }
}
```

---

### remove_competitor_monitor

Remove a competitor from monitoring.

**Request:**
```javascript
{
  "command": "remove_competitor_monitor",
  "monitor_id": "monitor_abc123"
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "message": "Monitor monitor_abc123 removed successfully"
  }
}
```

---

## Check and Detection Commands

### check_competitor_monitor

Manually trigger a check for a competitor website.

**Request:**
```javascript
{
  "command": "check_competitor_monitor",
  "monitor_id": "monitor_abc123",
  "capture_data": {
    "url": "https://competitor.com",
    "text": "Page text content...",
    "html": "<html>...</html>",
    "headers": {"server": "Nginx/1.21"},
    "statusCode": 200,
    "loadTime": 1500,
    "domSize": 45000,
    "resourceCount": 120
  }
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "changeDetected": true,
    "changeResult": {
      "timestamp": 1715100000000,
      "changeDetected": true,
      "changeSummary": ["content", "technology"],
      "severity": "medium",
      "details": {
        "content": {
          "changed": true,
          "changePercent": 7.5,
          "lengthChange": 250
        },
        "technology": {
          "changed": true,
          "added": {"frameworks": ["React"]},
          "removed": {}
        }
      }
    }
  }
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| monitor_id | string | Yes | Monitor to check |
| capture_data | object | No | Website data from browser |

---

### get_competitor_changes

Get change history for a monitor.

**Request:**
```javascript
{
  "command": "get_competitor_changes",
  "monitor_id": "monitor_abc123",
  "limit": 20,
  "offset": 0,
  "change_type": "technology"  // Optional: content, structure, technology, performance
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "changes": [
      {
        "timestamp": 1715100000000,
        "changeDetected": true,
        "changeSummary": ["technology"],
        "severity": "medium",
        "details": {
          "technology": {
            "changed": true,
            "added": {"frameworks": ["React"]},
            "removed": {},
            "updated": {}
          }
        }
      }
    ],
    "total": 12,
    "limit": 20,
    "offset": 0
  }
}
```

---

### get_competitor_snapshots

Get snapshot history showing website versions over time.

**Request:**
```javascript
{
  "command": "get_competitor_snapshots",
  "monitor_id": "monitor_abc123",
  "limit": 10,
  "offset": 0
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "snapshots": [
      {
        "timestamp": 1715100000000,
        "url": "https://competitor.com",
        "statusCode": 200,
        "contentLength": 45678,
        "domSize": 450,
        "loadTime": 1500
      }
    ],
    "total": 23,
    "limit": 10,
    "offset": 0
  }
}
```

---

### get_competitor_stats

Get detailed statistics for a monitor.

**Request:**
```javascript
{
  "command": "get_competitor_stats",
  "monitor_id": "monitor_abc123"
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "stats": {
      "id": "monitor_abc123",
      "name": "Competitor A",
      "totalChecks": 45,
      "successfulChecks": 43,
      "failedChecks": 2,
      "successRate": 95.56,
      "status": "active",
      "lastCheckAt": 1715100000000,
      "nextCheckAt": 1715200000000,
      "frequency": "daily",
      "createdAt": 1715000000000,
      "uptime": true
    }
  }
}
```

---

## Service Control Commands

### start_competitor_monitoring

Start the monitoring service.

**Request:**
```javascript
{
  "command": "start_competitor_monitoring"
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "status": "running",
    "message": "Competitor monitoring started"
  }
}
```

---

### stop_competitor_monitoring

Stop the monitoring service.

**Request:**
```javascript
{
  "command": "stop_competitor_monitoring"
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "status": "idle",
    "message": "Competitor monitoring stopped"
  }
}
```

---

### pause_competitor_monitoring

Pause the monitoring service (keeps configuration).

**Request:**
```javascript
{
  "command": "pause_competitor_monitoring"
}
```

---

### resume_competitor_monitoring

Resume the paused monitoring service.

**Request:**
```javascript
{
  "command": "resume_competitor_monitoring"
}
```

---

### get_competitor_monitoring_status

Get service status and statistics.

**Request:**
```javascript
{
  "command": "get_competitor_monitoring_status"
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "status": "running",
    "stats": {
      "serviceStatus": "running",
      "startTime": 1715000000000,
      "uptime": 100000000,
      "monitors": {
        "total": 15,
        "active": 12,
        "paused": 3
      },
      "performance": {
        "checksRun": 150,
        "changesDetected": 23,
        "alertsSent": 45,
        "errors": 2,
        "currentlyChecking": 2
      }
    }
  }
}
```

---

### get_competitor_monitoring_stats

Get global statistics across all monitors.

**Request:**
```javascript
{
  "command": "get_competitor_monitoring_stats"
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "globalStats": {
      "totalMonitors": 15,
      "activeMonitors": 12,
      "pausedMonitors": 3,
      "errorMonitors": 0,
      "totalChecks": 150,
      "totalSuccesses": 148,
      "totalFailures": 2,
      "globalSuccessRate": 98.67,
      "capacity": "15/100"
    },
    "serviceStats": {
      "serviceStatus": "running",
      "checksRun": 150,
      "changesDetected": 23,
      "alertsSent": 45
    }
  }
}
```

---

### run_competitor_monitoring_checks

Run immediate checks on monitors due for checking.

**Request:**
```javascript
{
  "command": "run_competitor_monitoring_checks"
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "checksRun": 5,
    "successCount": 5,
    "failureCount": 0
  }
}
```

---

## Alert Configuration Commands

### configure_competitor_alerts

Configure alerts for a monitor.

**Request:**
```javascript
{
  "command": "configure_competitor_alerts",
  "monitor_id": "monitor_abc123",
  "alert_config": {
    "contentChange": true,
    "structureChange": true,
    "technologyChange": true,
    "performanceChange": true,
    "statusCodeChange": true,
    "enableEmail": true,
    "emailAddresses": ["alerts@company.com"],
    "enableWebhook": true,
    "webhookUrl": "https://api.company.com/hooks",
    "enableSlack": true,
    "slackWebhookUrl": "https://hooks.slack.com/...",
    "enableTeams": true,
    "teamsWebhookUrl": "https://outlook.webhook.office.com/...",
    "thresholds": {
      "contentChangePercent": 5,
      "performanceThresholdMs": 1000,
      "structureChangePercent": 10
    }
  }
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "monitor": {
      // Updated monitor with new alert config
    }
  }
}
```

---

## Data Management Commands

### export_competitor_monitoring_data

Export all monitoring configuration and history data.

**Request:**
```javascript
{
  "command": "export_competitor_monitoring_data"
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "data": {
      "version": "1.0",
      "exportedAt": 1715100000000,
      "monitors": [...],
      "snapshots": {...},
      "changes": {...},
      "stats": {...}
    }
  }
}
```

---

### import_competitor_monitoring_config

Import monitoring configuration.

**Request:**
```javascript
{
  "command": "import_competitor_monitoring_config",
  "monitors": [
    {
      "url": "https://competitor1.com",
      "name": "Competitor 1",
      // ... monitor config
    }
  ],
  "merge": false  // false = replace, true = merge with existing
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "imported": 5,
    "errors": 0,
    "errorDetails": []
  }
}
```

---

### cleanup_competitor_monitoring_data

Cleanup old monitoring data.

**Request:**
```javascript
{
  "command": "cleanup_competitor_monitoring_data",
  "older_than_days": 30,
  "keep_min_snapshots": 5
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "snapshotsRemoved": 123,
    "changesRemoved": 45,
    "timestamp": 1715100000000
  }
}
```

---

### clear_all_competitor_monitors

Clear all monitors from the system.

**Request:**
```javascript
{
  "command": "clear_all_competitor_monitors"
}
```

**Response:**
```javascript
{
  "success": true,
  "result": {
    "clearedCount": 15
  }
}
```

---

## Constants and Enumerations

### Monitor Status Values

```javascript
"active"   // Currently monitoring
"paused"   // Temporarily paused
"error"    // Error state (too many failures)
"idle"     // Initialized but not monitoring
```

### Frequencies

```javascript
"hourly"       // Every hour
"daily"        // Every 24 hours
"twice-daily"  // Every 12 hours
"weekly"       // Every 7 days
"monthly"      // Every 30 days
```

### Change Types

```javascript
"content"     // Text content changes
"structure"   // DOM structure changes
"technology"  // Framework/server/library changes
"performance" // Load time or resource changes
"status"      // HTTP status code changes
```

### Alert Severity

```javascript
"low"        // Minor changes
"medium"     // Moderate changes
"high"       // Significant changes
"critical"   // Breaking changes
```

---

## Error Codes and Handling

### Common Errors

| Code | Message | Resolution |
|------|---------|-----------|
| INVALID_URL | Invalid URL format | Provide a valid URL with http:// or https:// |
| DUPLICATE | Monitor for this URL already exists | Use different URL or remove existing |
| NOT_FOUND | Monitor not found | Check monitor_id, use list_competitor_monitors |
| CAPACITY | Maximum monitors reached | Remove monitors or increase limit |
| AUTH_REQUIRED | Authentication required | Provide authentication token |
| RATE_LIMIT | Rate limit exceeded | Wait before retrying |

### Recovery Suggestions

All error responses include recovery suggestions:

```javascript
{
  "success": false,
  "error": "Invalid URL format",
  "recovery": {
    "suggestion": "Use format: https://example.com",
    "availableCommands": ["add_competitor_monitor", "list_competitor_monitors"]
  }
}
```

---

## Rate Limits and Quotas

| Limit | Default | Configurable |
|-------|---------|--------------|
| Max Monitors | 100 | Yes |
| Max Alerts/Hour | 100 per monitor | Yes |
| Alert Dedup Window | 1 hour | Yes |
| Max Concurrent Checks | 10 | Yes |
| Snapshot History | 50 per monitor | Yes |

---

## Webhook Format

When sending webhook alerts, the payload format is:

```javascript
{
  "alert": {
    "monitorId": "monitor_abc123",
    "monitorName": "Competitor A",
    "url": "https://competitor.com",
    "changeType": "technology",
    "severity": "medium",
    "timestamp": 1715100000000,
    "details": {
      "technology": {
        "changed": true,
        "added": {"frameworks": ["React"]},
        "removed": {}
      }
    },
    "summary": "Change detected on Competitor A..."
  },
  "timestamp": 1715100000000,
  "source": "basset-hound-monitoring"
}
```

---

## WebSocket Connection Example

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.onopen = () => {
  // Add a monitor
  ws.send(JSON.stringify({
    command: 'add_competitor_monitor',
    url: 'https://competitor.com',
    name: 'Competitor A',
    frequency: 'daily'
  }));
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log('Response:', response);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

---

**For more information, see:** COMPETITOR-MONITORING-IMPLEMENTATION.md

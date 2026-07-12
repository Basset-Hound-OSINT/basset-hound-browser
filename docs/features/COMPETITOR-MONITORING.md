# Competitor Monitoring Guide

**Version**: 12.2.0  
**Last Updated**: June 1, 2026  
**Status**: Production Ready  
**Estimated Read Time**: 45 minutes

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [Change Detection Types](#change-detection-types)
5. [Alert Configuration](#alert-configuration)
6. [Monitoring Strategies](#monitoring-strategies)
7. [API Reference](#api-reference)
8. [Integration Examples](#integration-examples)
9. [Performance & Scaling](#performance--scaling)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Competitor Monitoring?

Competitor Monitoring is an automated intelligence gathering system that tracks competitor websites for meaningful changes. It detects modifications to content, structure, technology, performance, and pricing—delivering actionable insights without manual review.

**Key Capabilities**:
- **Automated Change Detection**: Tracks 5+ types of changes (content, CSS, technology, performance, pricing)
- **Multi-Channel Alerts**: Email, Slack, Teams, webhooks, SMS
- **Change History**: Complete audit trail with snapshots and diffs
- **Performance Benchmarking**: Track page load times, resource usage, uptime
- **Technology Tracking**: Monitor tech stack changes, updates, CVE detection
- **Scheduling**: Hourly, daily, weekly, custom schedules
- **Deduplication**: Smart alert grouping to prevent alert fatigue
- **Reporting**: Custom dashboards, CSV/JSON exports, analytics

### Typical Use Cases

1. **E-commerce Competitors**: Monitor pricing changes, product launches, promotional campaigns
2. **SaaS Competitors**: Track feature releases, pricing tiers, UI changes
3. **News Sites**: Monitor article updates, breaking news, content changes
4. **Regulatory Monitoring**: Track compliance pages, policy changes
5. **Market Intelligence**: Identify strategic moves, partnerships, rebranding

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Competitor Monitoring System               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Client Layer (API/WebSocket)                           │
│  │                                                      │
│  ├─ Add/Update/Remove Monitors                          │
│  ├─ Configure Alerts                                    │
│  ├─ Query Changes & History                             │
│  └─ Manage Snapshots                                    │
│                                                         │
│  Monitoring Engine                                      │
│  │                                                      │
│  ├─ Scheduler (hourly/daily/weekly)                     │
│  ├─ Fetch Coordinator                                   │
│  ├─ Change Detectors (5 engines)                        │
│  └─ History Manager                                     │
│                                                         │
│  Detection Engines                                      │
│  │                                                      │
│  ├─ Content Differ (HTML/text)                          │
│  ├─ CSS Analyzer (stylesheet changes)                   │
│  ├─ Technology Detector (tech stack)                    │
│  ├─ Performance Analyzer (timing/resources)             │
│  └─ Pricing Parser (e-commerce detection)               │
│                                                         │
│  Alert System                                           │
│  │                                                      │
│  ├─ Deduplication Engine                                │
│  ├─ Channel Routers (email/Slack/webhook)               │
│  ├─ Rate Limiter                                        │
│  └─ Retry Queue                                         │
│                                                         │
│  Storage Layer                                          │
│  │                                                      │
│  ├─ Monitor Database                                    │
│  ├─ Change History                                      │
│  ├─ Snapshots (page HTML/images)                        │
│  └─ Metrics Database                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Step 1: Start Monitoring a Competitor

```javascript
// WebSocket API
{
  "id": "req-1",
  "command": "add_competitor_monitor",
  "url": "https://competitor.example.com",
  "name": "Competitor ABC",
  "frequency": "daily"
}
```

**Response**:
```json
{
  "id": "req-1",
  "success": true,
  "monitor": {
    "id": "mon-abc123",
    "url": "https://competitor.example.com",
    "name": "Competitor ABC",
    "frequency": "daily",
    "status": "active",
    "createdAt": "2026-06-01T12:00:00Z",
    "lastCheck": null,
    "nextCheck": "2026-06-02T12:00:00Z"
  }
}
```

### Step 2: Configure Alerts

```javascript
{
  "id": "req-2",
  "command": "configure_competitor_alerts",
  "monitor_id": "mon-abc123",
  "alerts": {
    "email": {
      "enabled": true,
      "recipients": ["alerts@mycompany.com"],
      "events": ["content_change", "price_change", "tech_change"]
    },
    "slack": {
      "enabled": true,
      "webhook": "https://hooks.slack.com/services/...",
      "channel": "#competitor-alerts",
      "events": ["price_change", "major_change"]
    }
  }
}
```

### Step 3: Run Your First Check

```javascript
{
  "id": "req-3",
  "command": "check_competitor_monitor",
  "monitor_id": "mon-abc123"
}
```

**Response**:
```json
{
  "id": "req-3",
  "success": true,
  "check": {
    "monitorId": "mon-abc123",
    "timestamp": "2026-06-01T13:45:00Z",
    "changes": {
      "content": [
        {
          "type": "text_added",
          "location": "hero_section",
          "before": "Limited time offer",
          "after": "Limited time offer - 50% off"
        }
      ],
      "technology": [],
      "performance": {
        "loadTime": {
          "previous": 1250,
          "current": 1180,
          "change": -70
        }
      }
    },
    "snapshotId": "snap-xyz789"
  }
}
```

### Step 4: View Changes & History

```javascript
{
  "id": "req-4",
  "command": "get_competitor_changes",
  "monitor_id": "mon-abc123",
  "limit": 10
}
```

---

## Core Concepts

### Monitor States

A competitor monitor can be in one of these states:

```
ACTIVE ──→ Running scheduled checks
PAUSED ──→ Temporarily stopped (no automatic checks)
DISABLED ─→ Monitor removed (no checks or alerts)
ERROR ───→ Configuration issue (requires fix)
```

**Transitions**:
- `ACTIVE` ↔ `PAUSED`: Use `pause_competitor_monitor` / `resume_competitor_monitor`
- `ACTIVE` → `DISABLED`: Use `remove_competitor_monitor` (cannot revert)
- Any state → `ERROR`: Automatic on validation failure

### Change Types

Each check compares the current page state against the baseline and detects 5 change types:

#### 1. Content Changes
- Text additions/removals/modifications
- Link changes (href updates)
- Image source/alt text changes
- Form field additions/removals
- Section visibility changes

#### 2. Structure Changes
- DOM tree modifications
- Layout changes (CSS class additions)
- Element reordering
- New sections added

#### 3. Technology Changes
- Library/framework updates (React, Vue, etc.)
- CMS version changes (WordPress 5.9 → 6.0)
- CDN changes
- Analytics tool changes
- Security certificate updates

#### 4. Performance Changes
- Page load time (>10% change triggers alert)
- Time to First Contentful Paint (FCP)
- Time to Interactive (TTI)
- Resource count/size
- API response times

#### 5. Pricing Changes
- Price modifications
- Discount applications
- Currency changes
- Shipping cost updates
- Subscription tier changes

### Snapshot System

Each check generates a snapshot containing:

```
Snapshot {
  id: "snap-xyz789"
  monitorId: "mon-abc123"
  timestamp: "2026-06-01T13:45:00Z"
  
  // Content
  html: "<!DOCTYPE html>..." (full HTML)
  text: "Visible text content"
  
  // Media
  screenshot: Buffer (PNG)
  images: [{ src, alt, position }]
  
  // Metadata
  title: "Page Title"
  url: "https://example.com"
  statusCode: 200
  headers: { ... }
  
  // Analysis
  technologies: ["React 18.0", "Webpack 5.0", ...]
  performance: { loadTime, fcp, tti, ... }
  structureHash: "abc123" (for comparison)
  contentHash: "def456"
}
```

Snapshots are stored permanently, enabling:
- Historical change review
- Visual diffs (screenshot comparison)
- Timeline analysis
- Forensic investigation

### Alert Deduplication

Deduplication prevents alert fatigue by intelligently grouping related changes:

```
Without Deduplication:
├─ Alert: Price changed $99 → $95
├─ Alert: Price changed $95 → $89  (1 hour later)
├─ Alert: Price changed $89 → $99  (2 hours later)
└─ Alert: Price changed $99 → $95  (3 hours later)
→ 4 separate alerts (confusing)

With Deduplication (configured):
└─ Alert: Price fluctuation detected
   - $99 → $95 → $89 → $99 → $95
   - Summary: High volatility, 5 changes in 3 hours
→ 1 grouped alert (actionable)
```

Configuration:
```javascript
{
  "deduplication": {
    "enabled": true,
    "window": 3600000, // 1 hour
    "threshold": 3,    // Group 3+ similar changes
    "types": ["price_change", "content_change"]
  }
}
```

---

## Change Detection Types

### Content Detection Engine

Detects meaningful text and element changes:

```javascript
// API: get_competitor_changes
{
  "command": "get_competitor_changes",
  "monitor_id": "mon-abc123",
  "types": ["content"],
  "limit": 20
}
```

**Response Example**:
```json
{
  "success": true,
  "changes": [
    {
      "id": "ch-1",
      "type": "content_change",
      "severity": "high",
      "timestamp": "2026-06-01T13:45:00Z",
      "details": {
        "category": "text_modification",
        "location": "header > nav",
        "before": "Free Shipping on Orders Over $50",
        "after": "Free Shipping on Orders Over $75",
        "context": "Shipping policy update"
      },
      "confidence": 0.98,
      "affectedElements": 1
    }
  ]
}
```

**Severity Levels**:
- `critical`: Revenue impact (pricing, major offers)
- `high`: Product/feature changes
- `medium`: Content updates, minor text changes
- `low`: Formatting, typo corrections

### Technology Detection Engine

Monitors software stack updates and security implications:

```javascript
{
  "command": "get_competitor_changes",
  "monitor_id": "mon-abc123",
  "types": ["technology"]
}
```

**Response Example**:
```json
{
  "changes": [
    {
      "type": "technology_change",
      "severity": "high",
      "details": {
        "library": "WordPress",
        "previousVersion": "5.9.0",
        "currentVersion": "6.2.0",
        "changeType": "major_version_upgrade"
      },
      "securityImplications": {
        "vulnerabilitiesClosed": 12,
        "newVulnerabilities": 0,
        "cveReferences": ["CVE-2024-1234", "CVE-2024-1235"]
      }
    }
  ]
}
```

### Performance Tracking

Monitors page speed and resource metrics:

```javascript
{
  "command": "get_competitor_changes",
  "monitor_id": "mon-abc123",
  "types": ["performance"]
}
```

**Metrics Tracked**:
- Load Time (full page)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)
- Cumulative Layout Shift (CLS)
- Total Resources (images, scripts, styles)
- Total Size (HTML, JS, CSS, images)

---

## Alert Configuration

### Alert Channels

#### Email Alerts

```javascript
{
  "command": "configure_competitor_alerts",
  "monitor_id": "mon-abc123",
  "alerts": {
    "email": {
      "enabled": true,
      "recipients": ["team@company.com", "ceo@company.com"],
      "events": ["content_change", "price_change", "tech_change"],
      "frequency": "immediate",  // or "daily_digest", "weekly_digest"
      "severity": "high"          // Only alert on high+ severity
    }
  }
}
```

#### Slack Integration

```javascript
{
  "alerts": {
    "slack": {
      "enabled": true,
      "webhook": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
      "channel": "#competitor-alerts",
      "mentions": ["@security-team"],
      "threadReplies": true,      // Group updates in thread
      "events": ["price_change", "major_change"]
    }
  }
}
```

**Slack Message Example**:
```
🚨 Competitor Monitor: Competitor ABC
Price Change Detected

Previous: $99.99
Current: $89.99
Change: -10%

View Details: [Link to dashboard]
```

#### Microsoft Teams Integration

```javascript
{
  "alerts": {
    "teams": {
      "enabled": true,
      "webhook": "https://outlook.webhook.office.com/webhookb2/...",
      "channel": "Competitor Alerts",
      "events": ["price_change", "major_change"]
    }
  }
}
```

#### Webhook Integration

For custom integrations (Zapier, Make, custom systems):

```javascript
{
  "alerts": {
    "webhook": {
      "enabled": true,
      "url": "https://your-api.example.com/webhooks/competitor-changes",
      "method": "POST",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN",
        "Content-Type": "application/json"
      },
      "events": ["content_change", "price_change", "tech_change"],
      "retryPolicy": {
        "maxRetries": 3,
        "backoffMultiplier": 2,
        "timeout": 30000
      }
    }
  }
}
```

**Webhook Payload**:
```json
{
  "event": "competitor_change_detected",
  "monitorId": "mon-abc123",
  "timestamp": "2026-06-01T13:45:00Z",
  "change": {
    "type": "price_change",
    "severity": "high",
    "details": {
      "before": "$99.99",
      "after": "$89.99"
    }
  },
  "snapshot": {
    "id": "snap-xyz789",
    "url": "https://api.example.com/snapshots/snap-xyz789"
  }
}
```

### Alert Filtering

Configure which changes trigger alerts:

```javascript
{
  "command": "configure_competitor_alerts",
  "monitor_id": "mon-abc123",
  "filters": {
    "severity": ["high", "critical"],     // Ignore low/medium
    "changeTypes": ["price_change", "product_launch"],
    "confidence": 0.85,                    // Minimum confidence
    "excludePatterns": [                   // Regex patterns to ignore
      ".*tracking.com.*",                  // Ignore tracker URLs
      ".*analytics.*"
    ]
  }
}
```

---

## Monitoring Strategies

### Strategy 1: Price-Sensitive Monitoring

For e-commerce competitors, monitor price changes in real-time:

```javascript
// Setup hourly checks on product pages
{
  "command": "add_competitor_monitor",
  "url": "https://competitor.com/products",
  "name": "Competitor Products",
  "frequency": "hourly",
  "alerts": {
    "email": {
      "enabled": true,
      "recipients": ["pricing@company.com"],
      "events": ["price_change"],
      "severity": "all"
    },
    "slack": {
      "enabled": true,
      "webhook": "...",
      "events": ["price_change"]
    }
  }
}

// Optional: Monitor specific product pages individually
{
  "command": "add_competitor_monitor",
  "url": "https://competitor.com/products/widget-pro",
  "name": "Competitor Widget Pro",
  "frequency": "hourly",
  "metadata": {
    "category": "flagship_product",
    "trackingId": "prod-widget-pro"
  }
}
```

### Strategy 2: Technology & Security Monitoring

Track tech stack changes and security updates:

```javascript
{
  "command": "add_competitor_monitor",
  "url": "https://competitor.com",
  "name": "Competitor Tech Stack",
  "frequency": "daily",
  "alerts": {
    "email": {
      "enabled": true,
      "recipients": ["security@company.com", "devops@company.com"],
      "events": ["tech_change"],
      "filters": {
        "severity": "high"  // Only major updates/vulnerabilities
      }
    }
  }
}
```

### Strategy 3: Campaign & Content Monitoring

Monitor marketing campaigns and content updates:

```javascript
{
  "command": "add_competitor_monitor",
  "url": "https://competitor.com",
  "name": "Competitor Marketing",
  "frequency": "daily",
  "alerts": {
    "slack": {
      "enabled": true,
      "webhook": "...",
      "channel": "#marketing-intel",
      "events": ["content_change"],
      "filters": {
        "locations": ["hero_section", "promotions"]
      }
    }
  }
}
```

### Strategy 4: Bulk Monitoring (10+ Competitors)

Monitor multiple competitors with consistent rules:

```javascript
const competitors = [
  { url: "https://comp1.com", name: "Competitor 1" },
  { url: "https://comp2.com", name: "Competitor 2" },
  // ... more competitors
];

for (const comp of competitors) {
  send({
    "command": "add_competitor_monitor",
    "url": comp.url,
    "name": comp.name,
    "frequency": "daily",
    "alerts": {
      "webhook": {
        "enabled": true,
        "url": "https://api.company.com/webhooks/competitor-changes"
      }
    },
    "tags": ["bulk_monitoring", "market_intelligence"]
  });
}
```

---

## API Reference

### Monitor Management Commands

#### add_competitor_monitor

Add a new competitor website to monitoring system.

**Command**: `add_competitor_monitor`

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| url | string | Yes | - | Website URL to monitor (must be valid HTTP/HTTPS) |
| name | string | Yes | - | Display name for monitoring dashboard |
| frequency | string | No | daily | Check frequency: `hourly`, `daily`, `weekly`, `custom` |
| alerts | object | No | {} | Alert configuration (see Alert Configuration section) |
| tags | array | No | [] | Organizational tags (e.g., ["e-commerce", "priority"]) |
| metadata | object | No | {} | Custom metadata for tracking/grouping |
| enabled | boolean | No | true | Start monitoring immediately |

**Example**:
```javascript
{
  "id": "req-1",
  "command": "add_competitor_monitor",
  "url": "https://example.com",
  "name": "Example Corp",
  "frequency": "daily",
  "tags": ["e-commerce", "priority"],
  "metadata": {
    "region": "US",
    "industry": "retail"
  }
}
```

**Success Response**:
```json
{
  "success": true,
  "monitor": {
    "id": "mon-abc123",
    "url": "https://example.com",
    "name": "Example Corp",
    "frequency": "daily",
    "status": "active",
    "createdAt": "2026-06-01T12:00:00Z",
    "lastCheck": null,
    "nextCheck": "2026-06-02T12:00:00Z",
    "changeCount": 0
  }
}
```

**Error Cases**:
- Invalid URL: `{ "success": false, "error": "Invalid URL format" }`
- Duplicate monitor: `{ "success": false, "error": "Monitor for this URL already exists" }`
- Rate limit: `{ "success": false, "error": "Monitor limit reached (100 monitors per account)" }`

---

#### update_competitor_monitor

Update monitor configuration.

**Command**: `update_competitor_monitor`

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| monitor_id | string | Yes | - | Monitor ID to update |
| frequency | string | No | - | New check frequency |
| name | string | No | - | New display name |
| alerts | object | No | - | New alert configuration |
| metadata | object | No | - | Updated metadata |

**Example**:
```javascript
{
  "command": "update_competitor_monitor",
  "monitor_id": "mon-abc123",
  "frequency": "hourly",
  "alerts": {
    "email": {
      "enabled": true,
      "recipients": ["new-email@company.com"],
      "events": ["price_change"]
    }
  }
}
```

---

#### remove_competitor_monitor

Remove a monitor (cannot be reverted).

**Command**: `remove_competitor_monitor`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| monitor_id | string | Yes | Monitor ID to remove |
| archive | boolean | No | Archive snapshots before deletion (default: true) |

---

#### pause_competitor_monitor & resume_competitor_monitor

Temporarily stop/resume monitoring.

**Commands**: `pause_competitor_monitor`, `resume_competitor_monitor`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| monitor_id | string | Yes | Monitor ID |

---

#### get_competitor_monitor

Get detailed monitor configuration and status.

**Command**: `get_competitor_monitor`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| monitor_id | string | Yes | Monitor ID |

**Response**:
```json
{
  "success": true,
  "monitor": {
    "id": "mon-abc123",
    "url": "https://example.com",
    "name": "Example Corp",
    "frequency": "daily",
    "status": "active",
    "createdAt": "2026-06-01T12:00:00Z",
    "lastCheck": "2026-06-01T13:45:00Z",
    "nextCheck": "2026-06-02T12:00:00Z",
    "totalChecks": 5,
    "totalChanges": 12,
    "changesByType": {
      "content": 8,
      "technology": 2,
      "performance": 2
    },
    "alerts": {
      "email": { "enabled": true, "recipients": [...] },
      "slack": { "enabled": true, "webhook": "..." }
    }
  }
}
```

---

#### list_competitor_monitors

List all monitors with pagination.

**Command**: `list_competitor_monitors`

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| status | string | No | all | Filter by status: active, paused, disabled |
| tags | array | No | [] | Filter by tags (AND operation) |
| limit | number | No | 50 | Results per page |
| offset | number | No | 0 | Pagination offset |
| sort | string | No | lastCheck | Sort by: createdAt, lastCheck, changeCount, name |

**Example**:
```javascript
{
  "command": "list_competitor_monitors",
  "status": "active",
  "tags": ["priority"],
  "limit": 20,
  "sort": "lastCheck"
}
```

**Response**:
```json
{
  "success": true,
  "monitors": [
    { "id": "mon-1", "name": "...", "status": "active", ... },
    { "id": "mon-2", "name": "...", "status": "active", ... }
  ],
  "total": 15,
  "page": 0,
  "pageSize": 20
}
```

---

### Change & History Commands

#### check_competitor_monitor

Run an immediate check (don't wait for scheduled time).

**Command**: `check_competitor_monitor`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| monitor_id | string | Yes | Monitor ID |
| force | boolean | No | Ignore rate limits (admin only) |

**Response**:
```json
{
  "success": true,
  "check": {
    "monitorId": "mon-abc123",
    "timestamp": "2026-06-01T13:45:00Z",
    "status": "completed",
    "httpStatus": 200,
    "changes": {
      "content": [
        {
          "type": "text_modified",
          "severity": "high",
          "location": "pricing_section",
          "before": "$99",
          "after": "$89"
        }
      ],
      "technology": [],
      "performance": {
        "loadTime": { "previous": 1250, "current": 1180 }
      }
    },
    "snapshotId": "snap-xyz789",
    "changeCount": 1,
    "alertsSent": 1
  }
}
```

---

#### get_competitor_changes

Retrieve change history for a monitor.

**Command**: `get_competitor_changes`

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| monitor_id | string | Yes | - | Monitor ID |
| types | array | No | all | Filter by change type: content, technology, performance, structure, pricing |
| severity | string | No | all | Filter by severity: critical, high, medium, low |
| limit | number | No | 20 | Max results |
| offset | number | No | 0 | Pagination |
| from | datetime | No | 7 days ago | Start date (ISO 8601) |
| to | datetime | No | now | End date (ISO 8601) |
| includeSnapshots | boolean | No | false | Include snapshot metadata |

**Example**:
```javascript
{
  "command": "get_competitor_changes",
  "monitor_id": "mon-abc123",
  "types": ["price_change", "content_change"],
  "severity": "high",
  "limit": 10,
  "includeSnapshots": true
}
```

---

#### get_competitor_snapshots

Retrieve snapshots (page state at specific times).

**Command**: `get_competitor_snapshots`

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| monitor_id | string | Yes | - | Monitor ID |
| limit | number | No | 20 | Max results |
| includeScreenshots | boolean | No | false | Include PNG screenshots |
| compareWithPrevious | boolean | No | false | Generate visual diffs |

**Response**:
```json
{
  "success": true,
  "snapshots": [
    {
      "id": "snap-xyz789",
      "timestamp": "2026-06-01T13:45:00Z",
      "status": 200,
      "title": "Example Corp - Products",
      "technologies": ["React 18.0", "Webpack 5.0"],
      "performance": {
        "loadTime": 1180,
        "fcp": 450,
        "tti": 1050
      },
      "screenshotUrl": "https://api.../snapshots/snap-xyz789/screenshot.png",
      "htmlUrl": "https://api.../snapshots/snap-xyz789/content.html"
    }
  ]
}
```

---

#### get_competitor_stats

Get monitoring statistics and metrics.

**Command**: `get_competitor_stats`

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| monitor_id | string | Yes | - | Monitor ID |
| period | string | No | 7d | Time period: 24h, 7d, 30d, 90d, all |

**Response**:
```json
{
  "success": true,
  "stats": {
    "monitorId": "mon-abc123",
    "period": "7d",
    "checks": {
      "total": 7,
      "successful": 7,
      "failed": 0,
      "averageDuration": 2450
    },
    "changes": {
      "total": 12,
      "byType": {
        "content": 8,
        "technology": 2,
        "performance": 2
      },
      "bySeverity": {
        "critical": 0,
        "high": 3,
        "medium": 6,
        "low": 3
      }
    },
    "alerts": {
      "total": 5,
      "byChannel": {
        "email": 3,
        "slack": 2
      },
      "failedDelivery": 0
    },
    "performance": {
      "averageLoadTime": 1215,
      "averageFcp": 465,
      "averageResources": 42
    }
  }
}
```

---

### Alert Configuration Commands

#### configure_competitor_alerts

Configure how and when alerts are sent.

**Command**: `configure_competitor_alerts`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| monitor_id | string | Yes | Monitor ID |
| alerts | object | Yes | Alert channel configuration |

**Example** (comprehensive):
```javascript
{
  "command": "configure_competitor_alerts",
  "monitor_id": "mon-abc123",
  "alerts": {
    "email": {
      "enabled": true,
      "recipients": ["team@company.com"],
      "events": ["price_change", "content_change"],
      "frequency": "immediate",
      "digest": {
        "enabled": true,
        "time": "09:00",
        "timezone": "America/New_York",
        "minChanges": 3
      }
    },
    "slack": {
      "enabled": true,
      "webhook": "https://hooks.slack.com/...",
      "channel": "#alerts",
      "mentions": ["@ceo"],
      "threadReplies": true,
      "events": ["price_change"]
    },
    "webhook": {
      "enabled": true,
      "url": "https://api.company.com/webhooks/competitor",
      "method": "POST",
      "headers": {
        "Authorization": "Bearer token"
      },
      "events": ["price_change", "content_change", "tech_change"]
    }
  }
}
```

---

### Reporting Commands

#### get_competitor_monitoring_stats

Get account-wide monitoring statistics.

**Command**: `get_competitor_monitoring_stats`

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| period | string | No | 7d | Time period: 24h, 7d, 30d, 90d |
| groupBy | string | No | monitor | Group by: monitor, tag, type |

**Response**:
```json
{
  "success": true,
  "stats": {
    "period": "7d",
    "monitors": {
      "total": 15,
      "active": 14,
      "paused": 1,
      "error": 0
    },
    "checks": {
      "total": 98,
      "successful": 96,
      "failed": 2,
      "averageDuration": 2400
    },
    "changes": {
      "total": 87,
      "byType": {
        "content": 45,
        "technology": 18,
        "performance": 24
      }
    },
    "alerts": {
      "total": 42,
      "byChannel": {
        "email": 20,
        "slack": 15,
        "webhook": 7
      }
    }
  }
}
```

---

#### export_competitor_monitoring_data

Export data for external analysis.

**Command**: `export_competitor_monitoring_data`

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| monitor_id | string | No | - | Specific monitor (all if omitted) |
| format | string | No | json | Export format: json, csv, xlsx |
| from | datetime | No | 90 days ago | Start date |
| to | datetime | No | now | End date |
| includeSnapshots | boolean | No | false | Include snapshot content |
| includeScreenshots | boolean | No | false | Include PNG images |

**Response**:
```json
{
  "success": true,
  "export": {
    "id": "exp-123",
    "format": "csv",
    "downloadUrl": "https://api.../exports/exp-123/data.csv",
    "expiresAt": "2026-06-08T13:45:00Z",
    "size": "2.4 MB",
    "recordCount": 147
  }
}
```

---

## Integration Examples

### Python SDK Integration

```python
from basset_hound import CompetitorMonitoring

# Initialize
monitoring = CompetitorMonitoring(
    api_url="ws://localhost:8765",
    api_key="your-api-key"
)

# Add monitor
monitor = await monitoring.add_monitor(
    url="https://competitor.example.com",
    name="Competitor ABC",
    frequency="daily",
    alerts={
        "email": {
            "enabled": True,
            "recipients": ["alerts@company.com"],
            "events": ["price_change"]
        }
    }
)

# Run immediate check
check_result = await monitoring.check_monitor(monitor.id)

# Get recent changes
changes = await monitoring.get_changes(
    monitor_id=monitor.id,
    types=["price_change"],
    limit=10
)

# Configure alerts
await monitoring.configure_alerts(
    monitor_id=monitor.id,
    alerts={
        "slack": {
            "enabled": True,
            "webhook": "https://hooks.slack.com/...",
            "events": ["price_change"]
        }
    }
)

# Get statistics
stats = await monitoring.get_stats(monitor_id=monitor.id)
print(f"Total changes: {stats.changeCount}")
print(f"Last check: {stats.lastCheck}")

# List monitors
monitors = await monitoring.list_monitors(status="active")
```

---

## Performance & Scaling

### Performance Characteristics

**Check Duration**: 2-5 seconds per website
- Network fetch: 1-2 seconds
- Change detection: 0.5-1 second
- Alert dispatch: 0.5-2 seconds

**Storage Requirements**:
- Per monitor: 50 KB baseline
- Per snapshot: 500 KB - 5 MB
- Per month: 50 GB (100 monitors, daily checks)

**Concurrent Limits**:
- Single account: 100 monitors
- Concurrent checks: 20 (upgradeable)
- API rate limit: 1,000 requests/minute

### Optimization Tips

1. **Appropriate Frequency**: Don't monitor faster than needed
   - Hourly: Critical/high-frequency changes (pricing, news)
   - Daily: Standard monitoring (product launches, updates)
   - Weekly: Long-term trends, low-change sites

2. **Smart Alerts**: Reduce alert fatigue
   - Enable deduplication for high-volume monitors
   - Filter by severity/change type
   - Use digests instead of immediate alerts

3. **Snapshot Management**: Control storage growth
   - Rotate out old snapshots (retention: 90 days)
   - Archive infrequently accessed monitors
   - Use `export_competitor_monitoring_data` for analysis

---

## Troubleshooting

### Monitor Stuck in ERROR State

**Symptoms**: Monitor shows status `ERROR`, no checks running

**Causes & Solutions**:
1. Invalid URL
   - Fix: Update monitor with valid URL
   ```javascript
   {
     "command": "update_competitor_monitor",
     "monitor_id": "mon-abc123",
     "url": "https://corrected-url.com"
   }
   ```

2. Website requires authentication
   - Fix: Configure authentication in monitor
   ```javascript
   {
     "command": "update_competitor_monitor",
     "monitor_id": "mon-abc123",
     "auth": {
       "type": "basic",
       "username": "...",
       "password": "..."
     }
   }
   ```

3. Rate limiting / IP blocked
   - Fix: Increase check interval, enable proxy rotation

---

### Alerts Not Being Sent

**Symptoms**: Changes detected but no alerts received

**Diagnosis**:
1. Check alert configuration
   ```javascript
   {
     "command": "get_competitor_monitor",
     "monitor_id": "mon-abc123"
   }
   ```
   Verify `alerts.email.enabled` is true

2. Check change severity/type filters
   - Detected change may not match alert filters
   - Use `get_competitor_changes` to verify changes exist

3. Check webhook delivery
   - Enable webhook retry logging
   - Verify your endpoint returns HTTP 200

---

### High False Positive Rate

**Symptoms**: Too many alerts for unimportant changes

**Solutions**:
1. Enable deduplication
2. Increase severity threshold
3. Add exclude patterns for irrelevant content
4. Use content-specific detectors instead of full-page

---

## Best Practices

1. **Monitor Management**:
   - Use descriptive names and tags for organization
   - Set frequency appropriate to change rate
   - Archive monitors no longer needed

2. **Alert Configuration**:
   - Start with email/Slack digest alerts
   - Transition to immediate alerts only for critical competitors
   - Regularly review alert rules to reduce noise

3. **Data Management**:
   - Export data monthly for analysis
   - Maintain 90-day snapshot retention
   - Clean up old monitor data

4. **Integration**:
   - Use webhooks for automated workflows
   - Integrate with ticketing systems for critical changes
   - Create dashboards from exported data

---

## Related Documentation

- [API Reference](/docs/API-REFERENCE.md) - All 164 WebSocket commands
- [Session Persistence](/docs/features/SESSION-PERSISTENCE.md) - Snapshot management
- Alerting Best Practices
- [Python SDK Guide](/docs/integration/PYTHON-SDK-GUIDE.md)

---

**Document Version**: 12.2.0  
**Last Updated**: June 1, 2026

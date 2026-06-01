# Session Persistence Guide

**Version**: 12.2.0  
**Last Updated**: June 1, 2026  
**Status**: Production Ready  
**Estimated Read Time**: 40 minutes

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [Checkpointing](#checkpointing)
5. [Session Branching](#session-branching)
6. [Failure Recovery](#failure-recovery)
7. [Campaign Management](#campaign-management)
8. [API Reference](#api-reference)
9. [Integration Examples](#integration-examples)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Session Persistence?

Session Persistence allows you to:

- **Checkpoint**: Save the state of a browser session (cookies, storage, history, position)
- **Rollback**: Revert to a previous checkpoint if something goes wrong
- **Branch**: Explore multiple paths from a checkpoint (A/B testing)
- **Recover**: Automatically detect failures and retry/recover from checkpoints
- **Campaign**: Orchestrate multi-session investigations with dependencies

### Typical Use Cases

1. **Long-Running Investigations**: Multi-hour OSINT campaigns spanning 10+ pages
2. **A/B Testing**: Test different navigation paths from a checkpoint
3. **Failure Recovery**: Automatically recover from temporary errors (timeouts, connection resets)
4. **Parallel Exploration**: Spawn multiple sessions from one checkpoint to explore different leads
5. **Complex Workflows**: Campaign management for coordinated multi-agent work

---

## Quick Start

### Step 1: Create a Checkpoint

```javascript
// Navigate and interact with a page
{
  "command": "navigate",
  "url": "https://example.com/login"
}

// Log in
{
  "command": "fill",
  "selector": "input[name='username']",
  "text": "user@example.com"
}

{
  "command": "fill",
  "selector": "input[name='password']",
  "text": "password123"
}

{
  "command": "click",
  "selector": "button[type='submit']"
}

// Wait for navigation
{
  "command": "wait_for_navigation",
  "timeout": 5000
}

// Create checkpoint after successful login
{
  "id": "req-ckpt-1",
  "command": "create_session_checkpoint",
  "name": "post_login",
  "description": "Session after successful login"
}
```

**Response**:
```json
{
  "success": true,
  "checkpoint": {
    "id": "ckpt-abc123",
    "name": "post_login",
    "timestamp": "2026-06-01T12:00:00Z",
    "sessionState": {
      "cookies": 12,
      "localStorage": 5,
      "sessionStorage": 3,
      "history": 3
    }
  }
}
```

### Step 2: Continue from Checkpoint

```javascript
// Navigate to another page
{
  "command": "navigate",
  "url": "https://example.com/settings"
}

// Some action
{
  "command": "click",
  "selector": ".edit-profile-btn"
}

// Encounter an error - need to recover
{
  "command": "navigate",
  "url": "https://example.com/api/data"
  // Returns 500 error
}

// Rollback to checkpoint
{
  "id": "req-rollback-1",
  "command": "rollback_to_checkpoint",
  "checkpoint_id": "ckpt-abc123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Rolled back to checkpoint post_login",
  "sessionState": {
    "currentUrl": "https://example.com/login",
    "cookies": 12,
    "localStorage": 5
  }
}
```

### Step 3: Branch from Checkpoint

```javascript
// Create a branch (separate session path)
{
  "id": "req-branch-1",
  "command": "create_session_branch",
  "checkpoint_id": "ckpt-abc123",
  "name": "explore_path_a"
}

// Explore path A
{
  "command": "navigate",
  "url": "https://example.com/products/category-a"
}

// Meanwhile, create another branch from same checkpoint
{
  "id": "req-branch-2",
  "command": "create_session_branch",
  "checkpoint_id": "ckpt-abc123",
  "name": "explore_path_b"
}

// Explore path B (in parallel session)
{
  "command": "navigate",
  "url": "https://example.com/products/category-b"
}
```

---

## Core Concepts

### Session State

A session state includes:

```
Session State {
  // Authentication & Storage
  cookies: Map<name, Cookie>,
  localStorage: Map<key, value>,
  sessionStorage: Map<key, value>,
  
  // Navigation History
  history: Array<HistoryEntry>,
  currentUrl: string,
  
  // Page Content
  dom: DOMSnapshot,
  screenshots: Array<Screenshot>,
  
  // Browser State
  viewport: { width, height },
  timezone: string,
  geolocation: { lat, lng },
  
  // Metadata
  userAgent: string,
  acceptLanguage: string,
  timestamp: DateTime
}
```

### Checkpoints

A checkpoint is a saved session state at a specific moment in time.

```
Checkpoint {
  id: "ckpt-abc123",
  name: "post_login",           // User-defined name
  timestamp: DateTime,
  state: SessionState,
  
  // For tracking
  description: "Optional notes",
  tags: ["important", "auth"],
  
  // Statistics
  size: 2500000,                // bytes
  sessionCount: 1,              // how many branches from this
  createdAt: DateTime,
  expiresAt: DateTime           // 30 days by default
}
```

**Checkpoint Uses**:
- Recovery point if something goes wrong
- Starting point for branching/parallel exploration
- Milestone in long-running campaigns
- Documentation of progress

### Branches

A branch is a copy of a checkpoint that can be explored independently.

```
Checkpoint A ──→ Branch A.1 ──→ (explore path 1)
              ├─→ Branch A.2 ──→ (explore path 2)
              └─→ Branch A.3 ──→ (explore path 3)
```

**Branch Uses**:
- A/B testing different navigation paths
- Parallel exploration of multiple leads
- Risk-free experimentation
- Concurrent workflows

### Failure Recovery

Automatic failure detection and recovery.

```
Active Session
    ↓
[Page fails to load]
    ↓
Failure Detected (type, severity, cause)
    ↓
Recovery Strategy Applied
    ├─ Light: Retry (wait & retry)
    ├─ Medium: Backoff (exponential retry)
    ├─ Heavy: Rollback (to last checkpoint)
    └─ Critical: Escalate (alert operator)
    ↓
Session Resumed
```

**Failure Types**:
- `TIMEOUT`: Page load exceeded timeout
- `CONNECTION`: Network error (reset, refused, timeout)
- `HTTP_ERROR`: 4xx/5xx response code
- `ELEMENT_NOT_FOUND`: Required element missing
- `AUTHENTICATION`: Lost authentication
- `RATE_LIMITED`: 429 Too Many Requests
- `BLOCKED`: IP/bot detection triggered

### Campaign Management

Campaigns orchestrate multiple sessions with dependencies.

```
Campaign: "Market Research Investigation"
├─ Session 1: Competitor A Analysis (no deps)
│  ├─ Task 1.1: Collect pricing data
│  ├─ Task 1.2: Check technology stack
│  └─ Task 1.3: Get contact info
│
├─ Session 2: Competitor B Analysis (no deps)
│  └─ Task 2.1-2.3: Same as Session 1
│
└─ Session 3: Comparative Analysis (depends on 1,2)
   ├─ Task 3.1: Compare pricing
   ├─ Task 3.2: Compare features
   └─ Task 3.3: Generate report
```

---

## Checkpointing

### Creating Checkpoints

#### After Critical Steps

```javascript
// After successful authentication
{
  "command": "create_session_checkpoint",
  "name": "authenticated",
  "description": "Successfully logged in to admin panel"
}

// After navigating to complex page
{
  "command": "create_session_checkpoint",
  "name": "dashboard_loaded",
  "description": "Dashboard fully loaded and interactive"
}

// Before risky operations
{
  "command": "create_session_checkpoint",
  "name": "before_form_submission",
  "description": "Before submitting contact form"
}
```

#### With Metadata

```javascript
{
  "command": "create_session_checkpoint",
  "name": "investigation_milestone",
  "description": "Completed first phase of investigation",
  "tags": ["investigation", "phase-1", "important"],
  "metadata": {
    "campaign_id": "cam-123",
    "phase": 1,
    "next_steps": "Extract pricing data"
  }
}
```

### Listing Checkpoints

```javascript
{
  "command": "list_session_checkpoints",
  "limit": 20,
  "offset": 0
}
```

**Response**:
```json
{
  "success": true,
  "checkpoints": [
    {
      "id": "ckpt-abc123",
      "name": "authenticated",
      "timestamp": "2026-06-01T12:00:00Z",
      "size": 2500000,
      "tags": ["auth"],
      "branchCount": 2
    }
  ],
  "total": 5
}
```

### Getting Checkpoint Details

```javascript
{
  "command": "get_session_checkpoint",
  "checkpoint_id": "ckpt-abc123"
}
```

**Response**:
```json
{
  "success": true,
  "checkpoint": {
    "id": "ckpt-abc123",
    "name": "authenticated",
    "description": "After login",
    "timestamp": "2026-06-01T12:00:00Z",
    "currentUrl": "https://example.com/dashboard",
    "state": {
      "cookies": [
        { "name": "session", "value": "...", "domain": ".example.com" }
      ],
      "localStorage": {
        "user_id": "123",
        "theme": "dark"
      },
      "history": [
        "https://example.com",
        "https://example.com/login",
        "https://example.com/dashboard"
      ]
    },
    "tags": ["auth"],
    "metadata": { ... }
  }
}
```

### Cleanup

```javascript
// Delete old checkpoint (cleanup)
{
  "command": "delete_session_checkpoint",
  "checkpoint_id": "ckpt-old-123"
}

// Or bulk cleanup
{
  "command": "cleanup_session_checkpoints",
  "olderThan": "2026-03-01T00:00:00Z"
}
```

---

## Session Branching

### Creating Branches

```javascript
// Simple branch
{
  "command": "create_session_branch",
  "checkpoint_id": "ckpt-abc123",
  "name": "explore_option_a"
}

// With metadata
{
  "command": "create_session_branch",
  "checkpoint_id": "ckpt-abc123",
  "name": "explore_option_b",
  "description": "Follow alternative navigation path",
  "tags": ["exploration"]
}
```

**Response**:
```json
{
  "success": true,
  "branch": {
    "id": "branch-xyz789",
    "checkpointId": "ckpt-abc123",
    "name": "explore_option_a",
    "createdAt": "2026-06-01T12:05:00Z",
    "currentUrl": "https://example.com/login"
  }
}
```

### Working with Branches

```javascript
// Navigate in branch A
{
  "sessionId": "branch-xyz789",
  "command": "navigate",
  "url": "https://example.com/products/option-a"
}

// Extract data from branch A
{
  "sessionId": "branch-xyz789",
  "command": "get_content",
  "selector": ".product-list"
}

// Meanwhile, use branch B (separate session)
{
  "sessionId": "branch-abc456",
  "command": "navigate",
  "url": "https://example.com/products/option-b"
}

{
  "sessionId": "branch-abc456",
  "command": "get_content",
  "selector": ".product-list"
}
```

### Merging/Exporting Branch Data

```javascript
// Export data from branch
{
  "command": "export_session_branch",
  "branch_id": "branch-xyz789",
  "includeScreenshots": true,
  "format": "json"
}

// Response includes all captured data from branch
{
  "success": true,
  "export": {
    "branch_id": "branch-xyz789",
    "duration": 300000,  // 5 minutes
    "pages_visited": 3,
    "data": {
      "screenshots": [...],
      "content": {...},
      "navigation_history": [...]
    }
  }
}
```

---

## Failure Recovery

### Automatic Failure Detection

When a command fails, the system automatically:

1. **Detects failure type** (network, HTTP, element, timeout)
2. **Evaluates recovery options** (retry, backoff, rollback)
3. **Applies recovery strategy** (light, medium, heavy, critical)
4. **Logs recovery action** for audit trail

### Recovery Strategies

#### Light Recovery (Transient Errors)

Used for temporary failures expected to self-resolve.

```
Error: TIMEOUT on page load
Strategy:
  1. Wait 1 second
  2. Retry page load
  If still fails → Medium recovery
```

Configuration:
```javascript
{
  "command": "configure_recovery",
  "strategy": "light",
  "maxRetries": 3,
  "retryDelay": 1000  // 1 second
}
```

#### Medium Recovery (Persistent Errors)

Used for errors that may need time to resolve.

```
Error: CONNECTION_RESET
Strategy:
  1. Wait 2 seconds
  2. Retry (exponential backoff)
  3. Try again with 4 second wait
  4. Try again with 8 second wait
  If all fail → Heavy recovery
```

Configuration:
```javascript
{
  "command": "configure_recovery",
  "strategy": "medium",
  "maxRetries": 3,
  "backoffMultiplier": 2,
  "initialDelay": 2000
}
```

#### Heavy Recovery (Severe Errors)

Used for serious failures requiring full rollback.

```
Error: AUTHENTICATION_LOST (session timeout)
Strategy:
  1. Detect loss of authentication
  2. Rollback to last authenticated checkpoint
  3. Re-authenticate if possible
  4. Resume from checkpoint
```

Configuration:
```javascript
{
  "command": "configure_recovery",
  "strategy": "heavy",
  "rollbackOnErrors": ["AUTHENTICATION_LOST", "RATE_LIMITED"],
  "checkpointId": "ckpt-authenticated"
}
```

#### Critical Recovery (Unrecoverable)

Used when recovery fails and manual intervention needed.

```
Error: IP_BLOCKED
Strategy:
  1. All recovery attempts failed
  2. Log critical error
  3. Alert operator
  4. Pause session
  5. Wait for manual action
```

### Manual Recovery Example

```javascript
// Session fails
{
  "command": "navigate",
  "url": "https://example.com/data"
  // Returns: Connection timeout after 30s
}

// System detected failure, logs it
{
  "id": "req-recovery-1",
  "command": "get_recovery_log",
  "session_id": "sess-123"
}

// Response shows what happened
{
  "success": true,
  "log": {
    "failures": [
      {
        "timestamp": "2026-06-01T12:05:30Z",
        "type": "TIMEOUT",
        "command": "navigate",
        "recovery_applied": "medium",
        "recovery_result": "failed"
      }
    ],
    "recommendations": [
      "Session may need to rollback to checkpoint",
      "Try different route or retry with proxy"
    ]
  }
}

// Manual recovery: rollback to checkpoint
{
  "command": "rollback_to_checkpoint",
  "checkpoint_id": "ckpt-abc123"
}

// Or try with proxy
{
  "command": "set_proxy",
  "proxy": "http://proxy.example.com:8080"
}

{
  "command": "navigate",
  "url": "https://example.com/data"
}
```

---

## Campaign Management

### Creating a Campaign

```javascript
{
  "command": "create_campaign",
  "name": "Q2 Market Research",
  "description": "Competitive intelligence gathering for Q2",
  "metadata": {
    "team": "market-research",
    "priority": "high",
    "budget_code": "MR-2026-Q2"
  }
}
```

**Response**:
```json
{
  "success": true,
  "campaign": {
    "id": "cam-abc123",
    "name": "Q2 Market Research",
    "status": "active",
    "createdAt": "2026-06-01T12:00:00Z",
    "sessions": []
  }
}
```

### Adding Sessions to Campaign

```javascript
// Session 1: Research Competitor A
{
  "command": "add_campaign_session",
  "campaign_id": "cam-abc123",
  "name": "Competitor A Analysis",
  "description": "Gather pricing and feature data",
  "dependencies": []  // No dependencies
}

// Session 2: Research Competitor B (can run in parallel)
{
  "command": "add_campaign_session",
  "campaign_id": "cam-abc123",
  "name": "Competitor B Analysis",
  "description": "Gather pricing and feature data",
  "dependencies": []
}

// Session 3: Comparative Analysis (depends on 1 & 2)
{
  "command": "add_campaign_session",
  "campaign_id": "cam-abc123",
  "name": "Comparative Report",
  "description": "Generate comparative analysis",
  "dependencies": ["session-1", "session-2"]
}
```

### Campaign Execution

```javascript
// Get campaign status
{
  "command": "get_campaign_status",
  "campaign_id": "cam-abc123"
}

// Response shows execution progress
{
  "success": true,
  "campaign": {
    "id": "cam-abc123",
    "status": "running",
    "progress": {
      "completed": 1,
      "running": 1,
      "pending": 1,
      "failed": 0
    },
    "sessions": [
      {
        "id": "sess-1",
        "name": "Competitor A Analysis",
        "status": "completed",
        "completedAt": "2026-06-01T12:30:00Z"
      },
      {
        "id": "sess-2",
        "name": "Competitor B Analysis",
        "status": "running",
        "startedAt": "2026-06-01T12:00:00Z"
      },
      {
        "id": "sess-3",
        "name": "Comparative Report",
        "status": "pending",
        "waitingFor": ["sess-2"]
      }
    ]
  }
}
```

### Campaign Reporting

```javascript
// Get campaign statistics
{
  "command": "get_campaign_statistics",
  "campaign_id": "cam-abc123"
}

// Export campaign results
{
  "command": "export_campaign_results",
  "campaign_id": "cam-abc123",
  "format": "json",
  "includeData": true
}
```

---

## API Reference

### Checkpoint Commands

#### create_session_checkpoint

Save current session state as a checkpoint.

**Command**: `create_session_checkpoint`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | Checkpoint name (e.g., "post_login") |
| description | string | No | Detailed description |
| tags | array | No | Organizational tags |
| metadata | object | No | Custom metadata |

**Example**:
```javascript
{
  "command": "create_session_checkpoint",
  "name": "authenticated",
  "tags": ["important", "auth"],
  "metadata": { "user_id": "123" }
}
```

---

#### rollback_to_checkpoint

Restore session to previous checkpoint state.

**Command**: `rollback_to_checkpoint`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| checkpoint_id | string | Yes | Checkpoint ID |
| confirm | boolean | No | Confirm rollback (overwrites current state) |

**Example**:
```javascript
{
  "command": "rollback_to_checkpoint",
  "checkpoint_id": "ckpt-abc123",
  "confirm": true
}
```

---

#### list_session_checkpoints

List all checkpoints in current account.

**Command**: `list_session_checkpoints`

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| limit | number | No | 50 | Results per page |
| offset | number | No | 0 | Pagination offset |
| tags | array | No | [] | Filter by tags |

---

#### get_session_checkpoint

Get detailed checkpoint information.

**Command**: `get_session_checkpoint`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| checkpoint_id | string | Yes | Checkpoint ID |

---

### Branching Commands

#### create_session_branch

Create a new branch from checkpoint.

**Command**: `create_session_branch`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| checkpoint_id | string | Yes | Source checkpoint |
| name | string | Yes | Branch name |
| description | string | No | Branch description |

---

#### export_session_branch

Export branch data and history.

**Command**: `export_session_branch`

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| branch_id | string | Yes | - | Branch ID |
| includeScreenshots | boolean | No | false | Include screenshots |
| format | string | No | json | Export format (json, csv) |

---

### Failure Recovery Commands

#### detect_failure_type

Identify what type of failure occurred.

**Command**: `detect_failure_type`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| sessionId | string | Yes | Session ID |
| statusCode | number | Yes | HTTP status code |
| headers | object | No | Response headers |
| body | string | No | Response body |

**Example**:
```javascript
{
  "command": "detect_failure_type",
  "sessionId": "sess-123",
  "statusCode": 500,
  "headers": { "retry-after": "60" },
  "body": "Internal Server Error"
}
```

**Response**:
```json
{
  "success": true,
  "detection": {
    "type": "HTTP_ERROR",
    "severity": "high",
    "retryable": true,
    "recommended_strategy": "medium_recovery",
    "details": {
      "statusCode": 500,
      "serverError": true,
      "retryAfter": 60
    }
  }
}
```

---

#### handle_failure

Get recovery strategy for failure.

**Command**: `handle_failure`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| sessionId | string | Yes | Session ID |
| failureType | string | Yes | Failure type |
| details | object | No | Additional details |
| lastCheckpoint | string | No | Last checkpoint ID |

**Response**:
```json
{
  "success": true,
  "recovery": {
    "strategy": "medium",
    "actions": [
      "wait 2000ms",
      "retry with exponential backoff",
      "max 3 attempts"
    ],
    "checkpoint": "ckpt-abc123"
  }
}
```

---

#### can_retry_session

Check if retry is allowed (respects backoff).

**Command**: `can_retry_session`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| sessionId | string | Yes | Session ID |

---

#### get_recovery_log

Get failure and recovery history.

**Command**: `get_recovery_log`

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| sessionId | string | Yes | - | Session ID |
| limit | number | No | 50 | Max entries |

---

### Campaign Commands

#### create_campaign

Create a new campaign.

**Command**: `create_campaign`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | Campaign name |
| description | string | No | Campaign description |
| metadata | object | No | Custom metadata |

---

#### add_campaign_session

Add a session to campaign.

**Command**: `add_campaign_session`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| campaign_id | string | Yes | Campaign ID |
| name | string | Yes | Session name |
| description | string | No | Session description |
| dependencies | array | No | Session IDs this depends on |

---

#### get_campaign_status

Get campaign execution status.

**Command**: `get_campaign_status`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| campaign_id | string | Yes | Campaign ID |

---

#### get_campaign_statistics

Get campaign statistics and metrics.

**Command**: `get_campaign_statistics`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| campaign_id | string | Yes | Campaign ID |

---

## Integration Examples

### Python SDK

```python
from basset_hound import SessionPersistence

persistence = SessionPersistence(
    api_url="ws://localhost:8765"
)

# Create checkpoint after login
await persistence.create_checkpoint(
    name="authenticated",
    tags=["auth"]
)

# Later: rollback if needed
await persistence.rollback_to_checkpoint(
    checkpoint_id="ckpt-abc123"
)

# Branch for exploration
branch = await persistence.create_branch(
    checkpoint_id="ckpt-abc123",
    name="explore_option_a"
)

# Configure recovery
await persistence.configure_recovery(
    strategy="medium",
    maxRetries=3,
    backoffMultiplier=2
)

# Campaign management
campaign = await persistence.create_campaign(
    name="Q2 Market Research"
)

await persistence.add_session(
    campaign_id=campaign.id,
    name="Competitor A Analysis"
)
```

---

## Troubleshooting

### Checkpoint Not Saving

**Symptoms**: Checkpoint creation fails or doesn't persist

**Solutions**:
1. Check disk space
2. Verify checkpoint not too large (100 MB limit)
3. Ensure session is active

---

### Rollback Losing Data

**Symptoms**: Data after checkpoint lost

**Solutions**:
- This is expected behavior
- Create more frequent checkpoints if needed
- Export branch data before discarding

---

## Best Practices

1. **Checkpoint Frequency**:
   - After critical steps (login, complex forms)
   - Before risky operations
   - Every 15-30 minutes in long investigations

2. **Branching Strategy**:
   - Use for A/B testing different paths
   - Explore alternatives in parallel
   - Export branch results

3. **Recovery Configuration**:
   - Light: Transient errors (timeouts)
   - Medium: Persistent errors (connection resets)
   - Heavy: Severe errors (auth loss)

4. **Campaign Management**:
   - Use for coordinated multi-session work
   - Define dependencies between sessions
   - Monitor progress and aggregate results

---

**Document Version**: 12.2.0  
**Last Updated**: June 1, 2026

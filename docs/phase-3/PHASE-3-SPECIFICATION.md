# Basset Hound Browser Phase 3 - Technical Specification
**Status:** Detailed Specification  
**Target Version:** 12.0.0  
**Baseline:** v11.3.0 (164 WebSocket commands, 166 MCP tools)

---

## 1. WORKFLOW ENGINE SPECIFICATION

### 1.1 Workflow Data Model

```json
{
  "name": "investigation_workflow",
  "description": "Multi-step social media investigation",
  "version": "1.0",
  "variables": {
    "search_query": "john doe linkedin",
    "max_pages": 5,
    "timeout_ms": 30000
  },
  "steps": [
    {
      "id": "step_1",
      "action": "navigate",
      "url": "https://linkedin.com/search",
      "wait_for": { "type": "selector", "value": ".search-input" }
    },
    {
      "id": "step_2",
      "action": "fill",
      "selector": ".search-input",
      "value": "${search_query}",
      "humanize": true
    },
    {
      "id": "step_3",
      "action": "click",
      "selector": ".search-button",
      "humanize": true
    },
    {
      "id": "step_4",
      "action": "wait_for_condition",
      "condition": {
        "type": "any_selector",
        "selectors": [".results", ".error-message", ".no-results"],
        "timeout": "${timeout_ms}"
      }
    },
    {
      "id": "step_5",
      "action": "if_element_exists",
      "selector": ".error-message",
      "then": [
        { "id": "error_1", "action": "pause", "reason": "Search failed" }
      ],
      "else": [
        { "id": "success_1", "action": "extract", "template": "linkedin_profiles" }
      ]
    },
    {
      "id": "step_6",
      "action": "loop",
      "condition": { "type": "count", "value": "${max_pages}" },
      "body": [
        { "action": "wait_for_element", "selector": ".next-button", "timeout": 5000 },
        { "action": "click", "selector": ".next-button" },
        { "action": "wait_for_element", "selector": ".results", "timeout": 10000 },
        { "action": "extract", "template": "linkedin_profiles" }
      ]
    },
    {
      "id": "step_7",
      "action": "parallel",
      "steps": [
        { "action": "screenshot", "name": "final_page" },
        { "action": "get_content" },
        { "action": "extract_metadata" }
      ]
    }
  ],
  "error_handling": {
    "default": "stop",
    "handlers": [
      {
        "error_type": "TimeoutError",
        "action": "retry",
        "max_retries": 3,
        "backoff": "exponential"
      },
      {
        "error_type": "NetworkError",
        "action": "fallback",
        "alternative_step": "step_1"
      }
    ]
  }
}
```

### 1.2 Action Types

| Action | Parameters | Description |
|--------|-----------|-------------|
| `navigate` | `url`, `wait_for?`, `timeout?` | Navigate to URL |
| `click` | `selector`, `humanize?` | Click element |
| `fill` | `selector`, `value`, `humanize?` | Fill form field |
| `type` | `text`, `selector?`, `humanize?` | Type text |
| `press_key` | `key`, `selector?` | Press keyboard key |
| `scroll` | `direction`, `amount`, `selector?` | Scroll page |
| `wait_for_element` | `selector`, `timeout?` | Wait for element |
| `wait_for_condition` | `condition`, `timeout?` | Wait for custom condition |
| `extract` | `template`, `selector?` | Extract data |
| `screenshot` | `name?`, `full_page?`, `quality?` | Capture screenshot |
| `if_element_exists` | `selector`, `then`, `else` | Conditional branch |
| `loop` | `condition`, `body` | Loop execution |
| `parallel` | `steps` | Execute steps concurrently |
| `pause` | `reason?` | Pause execution (manual resume) |
| `call_script` | `script`, `args?` | Execute JavaScript |
| `switch_tab` | `tab_index` | Switch active tab |
| `close_tab` | `tab_index?` | Close tab |
| `get_content` | - | Get page content |
| `get_page_state` | - | Get page state |
| `extract_metadata` | - | Extract page metadata |

### 1.3 Condition Types

```javascript
// Selector-based
{ "type": "selector_exists", "selector": ".element" }
{ "type": "any_selector", "selectors": [".a", ".b", ".c"] }
{ "type": "all_selectors", "selectors": [".a", ".b"] }

// DOM-based
{ "type": "dom_stable", "quiet_duration_ms": 500 }
{ "type": "text_contains", "text": "Error" }
{ "type": "attribute_matches", "selector": ".btn", "attribute": "disabled", "value": "false" }

// Network-based
{ "type": "network_idle", "idle_duration_ms": 1000 }

// Performance-based
{ "type": "performance_metric", "metric": "LCP", "target_ms": 2500 }

// Custom
{ "type": "custom", "script": "() => document.querySelectorAll('.item').length > 10" }

// Count-based (for loops)
{ "type": "count", "value": 5 }
{ "type": "count", "value": "${max_pages}" }
```

### 1.4 WebSocket Commands

#### Create Workflow
```json
{
  "command": "create_workflow",
  "name": "my_workflow",
  "workflow": { /* workflow object */ },
  "description": "Brief description",
  "tags": ["investigation", "linkedin"]
}

// Response
{
  "success": true,
  "workflow_id": "wf_abc123",
  "name": "my_workflow",
  "steps": 7,
  "created_at": "2026-05-15T10:30:00Z"
}
```

#### Execute Workflow
```json
{
  "command": "execute_workflow",
  "name": "my_workflow",
  "variables": { "search_query": "john doe" },
  "report_progress": true
}

// Response (starts execution)
{
  "success": true,
  "execution_id": "exec_def456",
  "status": "running",
  "current_step": 0
}

// Progress updates (if report_progress: true)
{
  "execution_id": "exec_def456",
  "event": "step_completed",
  "step_id": "step_1",
  "duration_ms": 2345,
  "result": { /* step result */ }
}
```

#### Get Workflow Status
```json
{
  "command": "get_workflow_status",
  "execution_id": "exec_def456"
}

// Response
{
  "success": true,
  "execution_id": "exec_def456",
  "status": "running",
  "current_step": 3,
  "progress": "3/7",
  "steps_completed": [
    { "step_id": "step_1", "status": "success", "duration_ms": 2345 },
    { "step_id": "step_2", "status": "success", "duration_ms": 1234 },
    { "step_id": "step_3", "status": "success", "duration_ms": 5678 }
  ],
  "elapsed_time_ms": 9257,
  "estimated_remaining_ms": 15000
}
```

#### List Workflows
```json
{
  "command": "list_workflows",
  "filter": { "tags": ["linkedin"] }
}

// Response
{
  "success": true,
  "workflows": [
    {
      "workflow_id": "wf_abc123",
      "name": "my_workflow",
      "steps": 7,
      "tags": ["investigation", "linkedin"],
      "created_at": "2026-05-15T10:30:00Z",
      "last_executed": "2026-05-15T12:00:00Z"
    }
  ],
  "total": 1
}
```

---

## 2. INTELLIGENT WAIT STRATEGIES SPECIFICATION

### 2.1 Wait for Any Selector

```json
{
  "command": "wait_for_condition",
  "condition": {
    "type": "any_selector",
    "selectors": [".success-message", ".error-message", ".timeout-message"],
    "timeout": 15000,
    "poll_interval": 100
  }
}

// Response
{
  "success": true,
  "matched": ".error-message",
  "element": {
    "tag": "div",
    "classes": ["error-message"],
    "text": "Invalid credentials"
  },
  "wait_time_ms": 3456
}
```

### 2.2 Network Idle Detection

```json
{
  "command": "wait_for_condition",
  "condition": {
    "type": "network_idle",
    "idle_duration_ms": 1000,
    "timeout": 30000
  }
}

// Response
{
  "success": true,
  "network_idle": true,
  "request_count": 47,
  "failed_request_count": 0,
  "wait_time_ms": 5678
}
```

### 2.3 DOM Stable Detection

```json
{
  "command": "wait_for_condition",
  "condition": {
    "type": "dom_stable",
    "quiet_duration_ms": 500,
    "timeout": 20000
  }
}

// Response
{
  "success": true,
  "dom_stable": true,
  "mutations_detected": 342,
  "wait_time_ms": 4567
}
```

### 2.4 Performance Metric Wait

```json
{
  "command": "wait_for_condition",
  "condition": {
    "type": "performance_metric",
    "metric": "LCP",
    "target_ms": 2500,
    "timeout": 30000
  }
}

// Response
{
  "success": true,
  "metric": "LCP",
  "value_ms": 2345,
  "target_ms": 2500,
  "met": true,
  "wait_time_ms": 6789
}
```

---

## 3. DYNAMIC FINGERPRINTING SPECIFICATION

### 3.1 Fingerprint Evolution

```json
{
  "command": "enable_dynamic_fingerprints",
  "profile": "base_fingerprint_id",
  "options": {
    "profile_lifetime_interactions": 100,
    "drift_range": [0.01, 0.02],
    "upgrade_frequency_interactions": 50,
    "ensemble_detection_prevention": true
  }
}

// Response
{
  "success": true,
  "dynamic_fingerprinting": "enabled",
  "current_profile_age": 0,
  "next_rotation_at": 100,
  "config": {
    "profile_lifetime": 100,
    "drift_per_interaction": "1-2%",
    "upgrades_enabled": true
  }
}
```

### 3.2 Get Fingerprint Age

```json
{
  "command": "get_fingerprint_age"
}

// Response
{
  "success": true,
  "age_interactions": 23,
  "lifetime_interactions": 100,
  "age_percentage": 23,
  "next_upgrade_at": 50,
  "next_rotation_at": 100,
  "status": "healthy"
}
```

### 3.3 Trigger Hardware Upgrade

```json
{
  "command": "trigger_hardware_upgrade",
  "force": false
}

// Response
{
  "success": true,
  "upgrade": {
    "from": {
      "gpu": "ANGLE (Intel HD Graphics 630)",
      "cpu": "Intel Core i7-8550U"
    },
    "to": {
      "gpu": "ANGLE (Intel Iris Graphics 650)",
      "cpu": "Intel Core i7-9550U"
    }
  },
  "applied": true
}
```

### 3.4 Analyze Fingerprint Drift

```json
{
  "command": "analyze_fingerprint_drift",
  "sample_size": 10
}

// Response
{
  "success": true,
  "analysis": {
    "canvas_drift": "1.8%",
    "webgl_drift": "1.2%",
    "audio_drift": "0.5%",
    "font_drift": "2.1%",
    "average_drift": "1.4%",
    "target_drift": "1-2%",
    "coherence_score": 0.92,
    "status": "healthy"
  }
}
```

---

## 4. BEHAVIORAL CONSISTENCY SPECIFICATION

### 4.1 Set Behavioral Profile

```json
{
  "command": "set_behavioral_profile",
  "profile": {
    "typing_speed_wpm": 45,
    "mouse_speed": "medium",
    "error_rate": 0.03,
    "decision_time_factor": 1.0,
    "fatigue_rate": 0.02
  },
  "enforce_coherence": true
}

// Response
{
  "success": true,
  "profile": {
    "typing_speed_wpm": 45,
    "mouse_speed": "medium",
    "error_rate": 0.03
  },
  "coherence_enforced": true,
  "coherence_violations": [],
  "coherence_score": 0.95
}
```

### 4.2 Validate Behavioral Coherence

```json
{
  "command": "validate_behavioral_coherence",
  "profile": { /* profile object */ }
}

// Response
{
  "success": true,
  "valid": true,
  "coherence_score": 0.92,
  "violations": [],
  "recommendations": []
}
```

### 4.3 Get Behavioral Metrics

```json
{
  "command": "get_behavioral_metrics"
}

// Response
{
  "success": true,
  "metrics": {
    "typing_speed_wpm": 45.3,
    "typing_error_rate": 0.031,
    "mouse_speed_px_per_sec": 120,
    "mouse_acceleration": 1.2,
    "decision_time_ms": 2345,
    "fatigue_level": 0.15,
    "session_duration_ms": 15234,
    "coherence_score": 0.93
  }
}
```

---

## 5. MEMORY OPTIMIZATION SPECIFICATION

### 5.1 Baseline Memory

**v11.3.0:** 200MB baseline  
**v12.0.0 Target:** 80MB baseline (-60%)

### 5.2 Per-Component Memory Allocation

| Component | v11.3.0 | v12.0.0 Target | Reduction |
|-----------|---------|----------------|-----------|
| Electron main | 80MB | 30MB | 62.5% |
| Modules (loaded) | 60MB | 20MB | 67% |
| Caches | 40MB | 15MB | 62.5% |
| Page contexts | 15MB/page | 5MB/page | 67% |
| Buffers | 5MB | 2MB | 60% |

### 5.3 Memory Monitoring

```json
{
  "command": "get_memory_stats"
}

// Response
{
  "success": true,
  "memory": {
    "heap_used_mb": 85,
    "heap_total_mb": 200,
    "external_mb": 5,
    "rss_mb": 290,
    "per_page": {
      "page_1": { "heap_mb": 8, "external_mb": 2 },
      "page_2": { "heap_mb": 7, "external_mb": 1 }
    },
    "modules_loaded": ["recording", "forensics", "proxy"],
    "modules_not_loaded": ["ml-extractor", "gradient-optimizer"],
    "cache_stats": {
      "dom_cache_mb": 5,
      "selector_cache_mb": 2,
      "fingerprint_cache_mb": 1
    }
  }
}
```

---

## 6. CONTENT EXTRACTION PERFORMANCE SPECIFICATION

**v11.3.0:** 2-5s for large pages  
**v12.0.0 Target:** <500ms (-75%)

### 6.1 Extraction with DOM Cache

```json
{
  "command": "extract_with_caching",
  "template": "linkedin_profile",
  "cache_mode": "enabled",
  "parallel": true
}

// Response
{
  "success": true,
  "extraction": {
    "items_count": 42,
    "data": [ /* extracted items */ ]
  },
  "performance": {
    "extraction_time_ms": 345,
    "cache_hit": true,
    "cache_savings_ms": 1200,
    "parallel_workers": 4,
    "dom_tree_size": 5432
  }
}
```

---

## 7. SCREENSHOT OPTIMIZATION SPECIFICATION

**v11.3.0:** 50-200ms, 1-2MB  
**v12.0.0 Target:** <100ms, 200-400KB average

### 7.1 Format Negotiation

```json
{
  "command": "screenshot",
  "format": "auto",
  "quality": "balanced"
}

// Options:
// format: "auto" (WebP if supported, else PNG) | "webp" | "png" | "jpeg"
// quality: "low" (50%) | "balanced" (75%) | "high" (95%)

// Response
{
  "success": true,
  "screenshot": {
    "data": "base64_encoded",
    "format": "webp",
    "size_bytes": 34567,
    "dimensions": { "width": 1920, "height": 1080 },
    "compression_ratio": 0.18
  },
  "performance": {
    "encode_time_ms": 45,
    "size_reduction": "78% vs PNG"
  }
}
```

---

## 8. CONCURRENT OPERATIONS SPECIFICATION

**v11.3.0:** 10 pages max  
**v12.0.0 Target:** 50-100 pages with <500MB memory

### 8.1 Adaptive Concurrency

```json
{
  "command": "get_concurrency_status"
}

// Response
{
  "success": true,
  "concurrency": {
    "active_pages": 23,
    "max_pages": 87,
    "utilization": "26%",
    "memory_available_mb": 512,
    "cpu_available_percent": 45,
    "resource_health": "excellent"
  },
  "queue": {
    "pending_operations": 12,
    "estimated_wait_time_ms": 3456
  }
}
```

---

## 9. MCP SERVER ENHANCEMENTS

### 9.1 Tool Versioning

```python
@server.tool()
def browser_navigate(url: str) -> dict:
    """Navigate to URL
    
    Version: 12.0.0
    Stability: stable
    Deprecations: None
    """
```

### 9.2 Progress Reporting

For long-running operations, tools report progress via server callbacks:

```python
@server.tool()
async def browser_extract_bulk(
    selector: str,
    batch_size: int = 100
) -> dict:
    """Extract elements with progress reporting"""
    
    all_elements = await browser.query_selector_all(selector)
    total = len(all_elements)
    
    for i in range(0, total, batch_size):
        batch = all_elements[i:i+batch_size]
        
        # Report progress
        await server.report_progress(
            f"Extracted {i}/{total}",
            progress=i/total
        )
        
        yield batch
```

---

## 10. SUCCESS METRICS & VALIDATION

### 10.1 Evasion Effectiveness

| Detection Service | v11.3.0 | v12.0.0 Target | Improvement |
|-------------------|---------|----------------|-------------|
| DataDome | 84% | 92% | +8% |
| PerimeterX | 85% | 93% | +8% |
| Cloudflare | 86% | 94% | +8% |
| bot.sannysoft | 87% | 95% | +8% |
| CreepJS | 81% | 90% | +9% |
| **Average** | **84.6%** | **92.8%** | **+8.2%** |

### 10.2 Performance Metrics

| Metric | v11.3.0 | v12.0.0 Target | Success Criteria |
|--------|---------|----------------|------------------|
| Baseline Memory | 200MB | 80MB | -60% ✓ |
| Large Page Extraction | 2-5s | <500ms | -75% ✓ |
| Screenshot Time | 50-200ms | <100ms | 50% reduction ✓ |
| Screenshot Size | 1-2MB | 200-400KB | 75% reduction ✓ |
| Concurrent Pages | 10 | 50-100 | 5-10x ✓ |
| Workflow Step Overhead | N/A | <50ms | Per spec ✓ |

### 10.3 API Coverage

| Aspect | Requirement | v12.0.0 |
|--------|-------------|---------|
| WebSocket Commands | 164 + 36 new | 200 ✓ |
| MCP Tools | 166 | 166+ ✓ |
| Backward Compatibility | 100% | Yes ✓ |
| Test Coverage | >85% | Target ✓ |

### 10.4 Integration Validation

- ✅ palletai agents can leverage predictions
- ✅ External connectors available for DB, webhooks, API
- ✅ MCP context persists across calls
- ✅ All new features documented with examples

---

## 11. BREAKING CHANGES & DEPRECATIONS

### 11.1 None for v12.0.0
Phase 3 is fully backward compatible with v11.3.0. All existing WebSocket commands and MCP tools remain unchanged and functional.

### 11.2 Deprecation Warnings (For v13.0.0)
- Deprecated APIs will show warnings but continue working
- Migration guide provided for each deprecated item
- Full removal in next major version

---

## 12. DEPLOYMENT & ROLLOUT

### 12.1 Release Schedule

| Phase | Duration | Activities |
|-------|----------|-----------|
| Alpha | 1 week | Internal testing, performance profiling |
| Beta | 2 weeks | Beta users, feedback collection, bug fixes |
| RC | 1 week | Release candidate, final validation |
| Stable | Ongoing | Production release, monitoring |

### 12.2 Rollback Plan
- v11.3.0 remains available as fallback
- <5 minute rollback window
- Automated rollback on critical metrics exceeding thresholds

---

*This specification defines the complete v12.0.0 (Phase 3) feature set and success criteria.*

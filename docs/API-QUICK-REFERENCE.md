# API Quick Reference - All 164 WebSocket Commands

**Version**: 12.3.0  
**Last Updated**: June 14, 2026  
**Total Commands**: 164  

This is a quick reference guide to all available commands. For detailed documentation, see [API-REFERENCE.md](API-REFERENCE.md).

---

## Command Organization

Commands are grouped into 12 categories:

1. [Utility & Connection](#utility--connection) (3 commands)
2. [Navigation & URL](#navigation--url) (6 commands)
3. [Page Interaction](#page-interaction) (9 commands)
4. [Content Extraction](#content-extraction) (8 commands)
5. [Screenshots](#screenshots) (7 commands)
6. [Cookies & Storage](#cookies--storage) (11 commands)
7. [Sessions & Tabs](#sessions--tabs) (15 commands)
8. [Evidence & Forensics](#evidence--forensics) (13 commands)
9. [Bot Evasion](#bot-evasion) (32 commands)
10. [Memory & Monitoring](#memory--monitoring) (10 commands)
11. [Technology Detection](#technology-detection) (5 commands)
12. [Platform Integration](#platform-integration) (18 commands)

**Other**: 26 additional specialized commands

---

## 1. Utility & Connection (3)

| Command | Parameters | Returns |
|---------|------------|---------|
| `ping` | - | `{success: true}` |
| `status` | - | Browser status, memory, uptime |
| `authenticate` | `token` | Authentication result |

**Example**:
```json
{"id": 1, "command": "ping"}
```

---

## 2. Navigation & URL (6)

| Command | Parameters | Returns |
|---------|------------|---------|
| `navigate` | `url` (required) | Success, load time |
| `get_url` | - | Current URL |
| `get_page_state` | - | Title, URL, forms, links |
| `wait_for_element` | `selector`, `timeout` (10000ms default) | Element found |
| `execute_script` | `script` (required) | Script result |
| `reload_tab` | `tabId` (optional) | Reload result |

**Example - Navigate with Wait**:
```json
{"id": 1, "command": "navigate", "url": "https://example.com"}
{"id": 2, "command": "wait_for_element", "selector": "#content", "timeout": 5000}
```

---

## 3. Page Interaction (9)

| Command | Parameters | Returns |
|---------|------------|---------|
| `click` | `selector`, `humanize` (true) | Click result |
| `fill` | `selector`, `value`, `humanize` (true) | Fill result |
| `scroll` | `x`, `y` or `selector`, `humanize` (true) | Scroll position |
| `type_text` | `text`, `selector`, `humanize` (true) | Text typed |
| `key_press` | `key`, `modifiers`, `humanize` (true) | Key pressed |
| `key_combination` | `keys` array, `humanize` (true) | Combination result |
| `mouse_move` | `x`, `y`, `humanize` (true) | New position |
| `mouse_click` | `x`, `y`, `button`, `humanize` (true) | Click result |
| `mouse_drag` | `startX`, `startY`, `endX`, `endY` | Drag result |

**Example - Click and Fill Form**:
```json
{"id": 1, "command": "click", "selector": "#email-input"}
{"id": 2, "command": "fill", "selector": "#email-input", "value": "user@example.com"}
{"id": 3, "command": "click", "selector": "#submit-btn"}
```

---

## 4. Content Extraction (8)

| Command | Parameters | Returns |
|---------|------------|---------|
| `extract_metadata` | - | Meta tags, OG tags, Twitter cards |
| `extract_links` | `includeExternal` (false) | All links, targets, text |
| `extract_forms` | - | Forms, fields, actions |
| `extract_images` | `includeLazy` (true) | Images, src, alt, lazy status |
| `extract_scripts` | - | Script tags, src, content |
| `extract_stylesheets` | - | CSS files, media, scope |
| `extract_structured_data` | - | JSON-LD, microdata, schema |
| `extract_all` | - | All content (consolidated) |

**Example - Extract All**:
```json
{"id": 1, "command": "extract_all"}
```

---

## 5. Screenshots (7)

| Command | Parameters | Returns |
|---------|------------|---------|
| `screenshot` | `format` (png) | Full page screenshot (base64) |
| `screenshot_viewport` | `format` (png) | Visible viewport only |
| `screenshot_full_page` | `format` (png) | Entire scrollable page |
| `screenshot_element` | `selector`, `format` (png) | Single element |
| `screenshot_area` | `x`, `y`, `width`, `height`, `format` | Rectangular region |
| `screenshot_formats` | - | Supported formats (png, jpeg, webp) |
| `screenshot_parallel` | `count`, `delay_ms` | Multiple captures |

**Example - Capture and Download**:
```json
{"id": 1, "command": "screenshot_full_page", "format": "png"}
```

**Returns**:
```json
{
  "data": {
    "image": "iVBORw0KGgoAAAANS...",
    "dimensions": {"width": 1920, "height": 3000},
    "format": "png",
    "size_bytes": 45000
  }
}
```

---

## 6. Cookies & Storage (11)

| Command | Parameters | Returns |
|---------|------------|---------|
| `get_cookies` | `url` (required) | Cookies for URL |
| `get_all_cookies` | `filter` (optional) | All cookies |
| `set_cookie` | `cookie` object | Set result |
| `set_cookies` | `cookies` array | Batch set result |
| `delete_cookie` | `url`, `name` | Delete result |
| `clear_all_cookies` | `domain` (optional) | Clear result |
| `export_cookies` | `format` (json), `filter` | Exported cookies |
| `import_cookies` | `data`, `format` (json) | Import result |
| `get_cookies_for_domain` | `domain` (required) | Domain cookies |
| `get_cookie_stats` | - | Cookie statistics |
| `flush_cookies` | - | Flush to storage |

**Example - Cookie Management**:
```json
{"id": 1, "command": "get_cookies", "url": "https://example.com"}
{"id": 2, "command": "set_cookie", "cookie": {"url": "https://example.com", "name": "session", "value": "abc123"}}
```

---

## 7. Sessions & Tabs (15)

### Sessions

| Command | Parameters | Returns |
|---------|------------|---------|
| `create_session` | `name`, `userAgent`, `fingerprint` | Session ID |
| `switch_session` | `sessionId` | Switch result |
| `delete_session` | `sessionId` | Delete result |
| `list_sessions` | - | All sessions |
| `get_session_info` | `sessionId` | Session details |
| `clear_session_data` | `sessionId` | Clear result |
| `export_session` | `sessionId` | Export data |
| `import_session` | `data` | Import result |

### Tabs

| Command | Parameters | Returns |
|---------|------------|---------|
| `new_tab` | `url` (optional) | Tab ID |
| `close_tab` | `tabId` | Close result |
| `switch_tab` | `tabId` | Switch result |
| `list_tabs` | - | All tabs |
| `get_tab_info` | `tabId` | Tab details |
| `get_active_tab` | - | Active tab info |
| `navigate_tab` | `tabId`, `url` | Navigate result |

**Example - Multi-Session**:
```json
{"id": 1, "command": "create_session", "name": "Session A"}
{"id": 2, "command": "switch_session", "sessionId": "sess_123"}
```

---

## 8. Evidence & Forensics (13)

| Command | Parameters | Returns |
|---------|------------|---------|
| `init_evidence_chain` | `basePath`, `autoVerify`, `autoSeal` | Chain initialized |
| `create_investigation` | `name`, `description`, `investigator` | Investigation ID |
| `collect_evidence_chain` | `type`, `data`, `metadata`, `actor` | Evidence ID |
| `verify_evidence_chain` | `evidenceId` | Verification result |
| `seal_evidence_chain` | `evidenceId`, `actor` | Sealed result |
| `get_evidence_chain` | `evidenceId` | Evidence data |
| `list_evidence_chain` | `type`, `investigationId`, `sealed` | Evidence list |
| `create_evidence_package` | `name`, `description`, `caseId` | Package ID |
| `add_to_evidence_package` | `packageId`, `evidenceId` | Add result |
| `seal_evidence_package` | `packageId`, `actor` | Sealed result |
| `export_evidence_package` | `packageId`, `format` (json\|zip) | Export data |
| `get_chain_audit_log` | `investigationId`, `actor` | Audit log |
| `collect_screenshot_chain` | `investigationId`, `actor`, `tags` | Screenshot with chain |

**Example - Evidence Collection**:
```json
{"id": 1, "command": "init_evidence_chain", "basePath": "/evidence"}
{"id": 2, "command": "create_investigation", "name": "Case 2026-001"}
{"id": 3, "command": "collect_screenshot_chain", "investigationId": "inv_123", "actor": "analyst"}
```

---

## 9. Bot Evasion (32 Commands)

### Fingerprinting (9)

| Command | Parameters | Returns |
|---------|------------|---------|
| `create_fingerprint_profile` | `id`, `platform`, `timezone`, `tier` | Profile ID |
| `create_regional_fingerprint` | `region` (US\|UK\|EU\|RU\|JP\|CN\|AU) | Profile ID |
| `get_fingerprint_profile` | `profileId` | Profile data |
| `list_fingerprint_profiles` | - | All profiles |
| `set_active_fingerprint` | `profileId` | Set result |
| `get_active_fingerprint` | - | Active profile |
| `apply_fingerprint` | `profileId` | Apply result |
| `delete_fingerprint_profile` | `profileId` | Delete result |
| `get_fingerprint_options` | - | Available platforms, timezones |

### Behavioral AI (6)

| Command | Parameters | Returns |
|---------|------------|---------|
| `create_behavioral_profile` | `sessionId`, `speedMultiplier`, `accuracyLevel` | Profile ID |
| `generate_mouse_path` | `sessionId`, `start`, `end`, `targetWidth` | Mouse events |
| `generate_scroll_behavior` | `sessionId`, `distance`, `direction` | Scroll events |
| `generate_typing_events` | `sessionId`, `text` | Key events |
| `get_behavioral_profile` | `sessionId` | Profile data |
| `list_behavioral_sessions` | - | All sessions |

### Honeypot Detection (2)

| Command | Parameters | Returns |
|---------|------------|---------|
| `check_honeypot` | `element` object | Is honeypot (true\|false) |
| `filter_honeypots` | `fields` array | Filtered fields |

### Rate Limit Adaptation (6)

| Command | Parameters | Returns |
|---------|------------|---------|
| `get_rate_limit_state` | `domain` | Rate limit status |
| `record_request_success` | `domain` | Record result |
| `record_rate_limit` | `domain`, `retryAfter` | Record result |
| `is_rate_limited` | `statusCode` | Is limited (true\|false) |
| `reset_rate_limit` | `domain` | Reset result |
| `list_rate_limit_adapters` | - | All adapters |

### Proxy & Tor (9)

| Command | Parameters | Returns |
|---------|------------|---------|
| `set_proxy` | `protocol`, `host`, `port`, `auth` | Proxy set |
| `rotate_proxy` | `mode` (auto\|manual) | New proxy |
| `get_proxy_status` | - | Current proxy |
| `clear_proxy` | - | Clear result |
| `enable_tor` | - | Tor enabled |
| `disable_tor` | - | Tor disabled |
| `get_tor_status` | - | Tor status |
| `rotate_tor_circuit` | - | New circuit |
| `list_tor_circuits` | - | Circuit history |

**Example - Evasion Setup**:
```json
{"id": 1, "command": "create_regional_fingerprint", "region": "US"}
{"id": 2, "command": "create_behavioral_profile", "sessionId": "s1", "speedMultiplier": 0.9}
{"id": 3, "command": "apply_fingerprint", "profileId": "fp_123"}
```

---

## 10. Memory & Monitoring (10)

| Command | Parameters | Returns |
|---------|------------|---------|
| `get_memory_usage` | - | Memory stats |
| `get_memory_stats` | - | Detailed stats |
| `force_gc` | - | GC result |
| `clear_caches` | - | Clear result |
| `start_memory_monitoring` | `interval` (ms) | Monitoring started |
| `stop_memory_monitoring` | - | Monitoring stopped |
| `set_memory_thresholds` | `warning` (MB), `critical` (MB), `action` (MB) | Thresholds set |
| `get_memory_history` | `limit` (100) | History data |
| `check_memory` | - | Memory status |
| `detect_memory_leaks` | - | Leak analysis |

**Example - Memory Monitoring**:
```json
{"id": 1, "command": "start_memory_monitoring", "interval": 5000}
{"id": 2, "command": "set_memory_thresholds", "warning": 500, "critical": 750}
```

---

## 11. Technology Detection (5)

| Command | Parameters | Returns |
|---------|------------|---------|
| `detect_technologies` | `analyze_scripts`, `analyze_headers`, `analyze_meta` (all true) | Detected tech list |
| `detect_technology_by_method` | `method` (wappalyzer\|headers\|meta\|scripts), `technology` | Detection result |
| `get_technology_confidence` | `technology`, `method` | Confidence score |
| `analyze_javascript_frameworks` | - | JS frameworks |
| `analyze_cms_detection` | - | CMS systems |

**Example - Tech Detection**:
```json
{"id": 1, "command": "detect_technologies"}
```

---

## 12. Platform Integration (18)

### SIEM & Logging

| Command | Parameters | Returns |
|---------|------------|---------|
| `send_to_splunk` | `sourcetype`, `source`, `host` | Send result |
| `send_to_elk` | `index_name`, `doc_type` | Send result |
| `send_to_webhook` | `url`, `headers`, `format` | Send result |
| `send_to_syslog` | `host`, `port`, `facility` | Send result |
| `send_to_kafka` | `topic`, `partition` | Send result |

### Queue & Priority

| Command | Parameters | Returns |
|---------|------------|---------|
| `set_command_priority` | `command_name`, `priority` (0-100) | Priority set |
| `get_priority_queue_stats` | - | Queue stats |
| `clear_priority_queue` | - | Clear result |

### Export & Format

| Command | Parameters | Returns |
|---------|------------|---------|
| `export_evidence` | `include_metadata`, `include_screenshots`, `format` | Export data |
| `get_chain_of_custody` | `evidence_id` | CoC data |
| `validate_evidence_integrity` | `evidence_id`, `hash` | Validation result |
| `analyze_server_headers` | - | Header analysis |
| `screenshot_batch` | `batches`, `batch_size` | Batch results |
| `get_screenshot_quality` | - | Quality metrics |

**Example - Export to Splunk**:
```json
{"id": 1, "command": "send_to_splunk", "sourcetype": "browser_automation", "source": "session_1"}
```

---

## Other Specialized Commands (26)

These commands handle advanced use cases:

### Profile Management
- `list_proxy_profiles` - List saved proxy profiles
- `create_profile_template` - Create reusable profile
- `apply_profile_template` - Apply saved profile

### Location & Device
- `set_location` - Set geolocation
- `get_location` - Get current location
- `set_device_properties` - Set device info

### Competitive Intelligence
- `monitor_competitor` - Track competitor site
- `get_competitor_changes` - Get change history
- `set_monitoring_interval` - Update monitor timing

### Forensic Data
- `collect_dns_data` - Collect DNS records
- `collect_http_headers` - Get HTTP headers
- `get_forensic_metadata` - Get all metadata

### Request Interception
- `set_request_intercept_rules` - Block/modify requests
- `get_intercepted_requests` - Get intercepted data
- `clear_intercept_rules` - Clear rules

### Additional
- `get_manager_status` - Manager component status
- `is_command_retryable` - Check if retryable
- `get_recovery_config` - Get error recovery config

---

## Common Workflows

### 1. Basic Web Scraping

```
1. navigate → URL
2. wait_for_element → selector
3. extract_all → get content
4. screenshot → capture page
```

### 2. Form Automation

```
1. navigate → form URL
2. wait_for_element → form selector
3. fill → field 1
4. fill → field 2
5. click → submit button
6. wait_for_element → success message
```

### 3. Bot Detection Evasion

```
1. create_regional_fingerprint → region
2. create_behavioral_profile → session
3. apply_fingerprint → profile
4. navigate → protected URL
5. [interact with page]
```

### 4. Evidence Collection

```
1. init_evidence_chain → path
2. create_investigation → name
3. navigate → URL
4. collect_screenshot_chain → investigation
5. extract_all → content
6. seal_evidence_chain → evidence
7. export_evidence_package → package
```

### 5. Session Management

```
1. create_session → name
2. switch_session → session ID
3. [operate in session]
4. list_sessions → view all
5. delete_session → cleanup
```

---

## Parameter Types

### Common Parameters

- **selector** (string): CSS selector or XPath
- **url** (string): Full URL including protocol
- **timeout** (number): Milliseconds
- **format** (string): File format (png, jpeg, json, csv, zip)
- **humanize** (boolean): Simulate human behavior
- **filter** (object): Filter criteria
- **data** (string/object): Payload data
- **metadata** (object): Additional information

### Boolean Parameters

Most boolean parameters default to `true` for humanized behavior:
- `humanize: true` - Simulate human timing/randomness
- `secure: true` - Secure cookies
- `httpOnly: true` - HTTP-only cookies

---

## Response Structure

All responses follow this format:

```json
{
  "id": "request-id",
  "command": "command_name",
  "success": true/false,
  "data": { /* command-specific data */ },
  "error": "error message if failed",
  "recovery": { /* recovery suggestions */ },
  "timestamp": "2026-06-14T12:34:56.789Z"
}
```

---

## Rate Limits & Performance

- **Batch Size**: Up to 100 concurrent commands
- **Per-Minute**: 1,000 commands/minute
- **Latency**: <2ms P99 response time
- **Compression**: 70-93% reduction on large payloads
- **Timeout**: 5 minutes of inactivity

---

## Getting Help

- **[Full API Reference](API-REFERENCE.md)** - Complete documentation
- **[User Access Guide](USER-ACCESS-GUIDE.md)** - Getting started
- **[Integration Checklist](INTEGRATION-CHECKLIST.md)** - Production setup
- **[Troubleshooting](TROUBLESHOOTING.md)** - Problem solving
- **[Examples](examples/)** - Working code samples

---

**Version**: 12.3.0 | **Updated**: June 14, 2026 | **Commands**: 164 | **Status**: Production Ready

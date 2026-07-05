# Forensic/Non-Forensic Separation Plan

## Executive Summary

This document outlines a comprehensive strategy to separate forensic features (legal compliance, chain-of-custody, evidence capture) from non-forensic features (evasion, monitoring, general browser capabilities) in the Basset Hound Browser codebase.

**Status:** Analysis Complete  
**Scope:** 56 command files, ~622 total commands  
**Timeline:** Phase implementation (low-risk refactoring)

---

## Part 1: Command Classification

### Forensic Commands (14 files, ~140 commands)
Legal compliance, evidence capture, chain-of-custody, audit trail functionality

**Files:**
1. `evidence-commands.js` (8 commands)
   - capture_screenshot_evidence
   - capture_page_archive_evidence
   - capture_har_evidence
   - capture_dom_evidence
   - capture_console_evidence
   - capture_cookies_evidence
   - capture_storage_evidence
   - get_evidence_types

2. `evidence-packaging.js` (18 commands)
   - create_evidence_package
   - add_evidence_to_package
   - remove_evidence_from_package
   - list_evidence_in_package
   - export_evidence_package
   - import_evidence_package
   - seal_evidence_package
   - verify_package_integrity
   - generate_chain_of_custody
   - get_package_metadata
   - And more...

3. `evidence-correlation-commands.js` (5 commands)
   - correlate_evidence
   - detect_correlation_patterns
   - generate_correlation_report
   - list_correlations
   - get_correlation_metadata

4. `legal-compliance-commands.js` (6 commands)
   - record_legal_notice
   - document_consent
   - create_audit_trail
   - verify_chain_of_custody
   - export_for_court
   - get_compliance_status

5. `phase2-p0-legal-compliance-commands.js` (0 commands - phase placeholder)

6. `network-forensics-commands.js` (26 commands)
   - capture_network_trace
   - analyze_http_requests
   - extract_header_metadata
   - detect_request_anomalies
   - capture_dns_queries
   - extract_tls_certificate_info
   - capture_redirect_chain
   - And more...

7. `session-tracking-commands.js` (3 commands)
   - track_session_footprint
   - correlate_session_markers
   - generate_session_chain_of_custody

8. `screenshot-commands.js` (15 commands)
   - capture_full_page_screenshot
   - capture_element_screenshot
   - capture_viewport_screenshot
   - annotate_screenshot
   - timestamp_screenshot
   - verify_screenshot_hash
   - And more...

9. `dom-snapshot-commands.js` (7 commands)
   - snapshot_dom
   - extract_dom_metadata
   - validate_dom_integrity
   - compare_dom_snapshots
   - And more...

10. `javascript-console-extraction.js` (10 commands)
    - extract_console_logs
    - capture_console_state
    - extract_errors
    - extract_warnings
    - correlate_console_errors
    - And more...

11. `html-capture-commands.js` (6 commands)
    - capture_html_content
    - capture_html_with_metadata
    - extract_inner_html
    - export_as_mhtml
    - And more...

12. `video-recording-commands.js` (14 commands)
    - start_video_recording
    - stop_video_recording
    - get_recording_metadata
    - export_video_evidence
    - And more...

13. `recording-commands.js` (20 commands)
    - record_user_interactions
    - playback_recording
    - export_interaction_log
    - verify_recording_integrity
    - And more...

14. `report-generation.js` (0 commands - utility module)
    - Forensic report generation
    - Evidence summary reports
    - Chain of custody documentation

**Total: ~140 commands**

**Key Characteristics:**
- Legal compliance-focused
- Chain-of-custody documentation
- Evidence integrity verification
- Timestamping and hashing
- Audit trail generation
- Court admissibility features
- Tamper detection

---

### Non-Forensic Commands: Evasion & Anonymization (10 files, ~100 commands)
Bot detection evasion, fingerprinting circumvention, behavioral anonymization

**Files:**
1. `evasion-commands.js` (29 commands)
   - Fingerprint spoofing (Canvas, WebGL, AudioContext)
   - Behavior injection (human-like movements, timing)
   - Detection service evasion
   - Honeypot detection

2. `extended-evasion-commands.js` (6 commands)
   - WebRTC leak prevention
   - Font enumeration evasion
   - Plugin detection evasion
   - Advanced fingerprinting vectors

3. `behavioral-anonymization-commands.js` (0 commands)
   - Behavioral pattern obscuration
   - Click/scroll randomization
   - Timing randomization

4. `anonymity-commands.js` (11 commands)
   - Anonymity mode activation
   - Identity isolation
   - Cross-site tracking prevention

5. `fake-data-commands.js` (8 commands)
   - Generate fake user profiles
   - Fake geolocation data
   - Fake device identifiers
   - Fake network signatures

6. `location-commands.js` (11 commands)
   - Spoof geolocation
   - Fake timezone
   - Fake IP location
   - Fake GPS coordinates

7. `coherence-check.js` (11 commands)
   - Validate fingerprint consistency
   - Check behavioral coherence
   - Detect inconsistencies

8. `coherence-validation-commands.js` (8 commands)
   - Validate session coherence across detection services
   - Detect detection service fingerprinting
   - Check behavioral consistency

9. `behavior-scoring.js` (10 commands)
   - Score behavioral patterns
   - Calculate suspicion metrics
   - Optimize evasion parameters

10. `tech-detection.js` (8 commands)
    - Detect anti-bot services
    - Identify defense mechanisms
    - Recommend evasion vectors

**Total: ~100 commands**

**Key Characteristics:**
- Bot evasion purpose
- Fingerprinting circumvention
- Detection service avoidance
- Behavioral anonymization
- Privacy enhancement (secondary)
- NOT legal compliance related

---

### Non-Forensic Commands: Monitoring & Tracking (8 files, ~120 commands)
Competitor monitoring, website tracking, change detection, analytics

**Files:**
1. `competitor-monitoring-commands.js` (23 commands)
   - Add/remove competitor monitors
   - Automated change detection
   - Price monitoring
   - Feature tracking

2. `monitoring-commands.js` (16 commands)
   - Page change monitoring
   - Content analysis
   - Alert configuration

3. `monitoring-advanced.js` (17 commands)
   - Advanced pattern detection
   - Anomaly detection
   - Predictive monitoring

4. `monitoring-continuous.js` (9 commands)
   - Background monitoring
   - Scheduled checks
   - State tracking

5. `monitoring-metrics-commands.js` (16 commands)
   - Metrics collection
   - Performance tracking
   - KPI monitoring

6. `change-detection.js` (9 commands)
   - Detect content changes
   - Track DOM mutations
   - Generate change reports

7. `analytics-advanced.js` (11 commands)
   - Advanced analytics
   - Behavioral analysis
   - Trend prediction

8. `performance-metrics.js` (12 commands)
   - Performance monitoring
   - Resource tracking
   - Optimization recommendations

**Total: ~120 commands**

**Key Characteristics:**
- Competitive intelligence
- Website tracking (non-forensic)
- Market monitoring
- Change detection
- Performance analytics
- NOT legal/forensic purpose

---

### Core Browser Commands (15 files, ~175 commands)
Basic browser automation, session management, profile handling

**Files:**
1. `screenshot-commands.js` (15 commands) - General screenshots
2. `image-commands.js` (12 commands) - Image metadata
3. `extraction-commands.js` (11 commands) - Data extraction
4. `form-commands.js` (10 commands) - Form automation
5. `multi-page-commands.js` (15 commands) - Multi-page handling
6. `session-management.js` (19 commands) - Session lifecycle
7. `session-persistence-commands.js` (6 commands) - v1 persistence
8. `session-persistence-v2.js` (15 commands) - v2 persistence
9. `session-persistence-v3.js` (0 commands) - v3 persistence placeholder
10. `session-persistence-week2-commands.js` (24 commands) - Legacy persistence
11. `profile-template-commands.js` (13 commands) - Browser profiles
12. `cookie-commands.js` (16 commands) - Cookie management
13. `credentials-commands.js` (6 commands) - TOTP/password handling
14. `proxy-partner-commands.js` (14 commands) - Proxy integration
15. `extended-features-commands.js` (22 commands) - Extended features

**Total: ~175 commands**

**Key Characteristics:**
- Core browser functionality
- Session/profile management
- Data persistence
- General automation
- Not specialized for forensics OR evasion

---

### Export/Import & Data Commands (5 files, ~50 commands)
Data export/import, formatting, batch operations

**Files:**
1. `export-formats.js` (8 commands)
2. `export-templates-commands.js` (13 commands)
3. `encrypted-export-commands.js` (8 commands)
4. `batch-operations-commands.js` (11 commands)
5. `correlation-commands.js` (10 commands)

**Total: ~50 commands**

---

### Admin & Integration Commands (4 files, ~35 commands)
System administration, integrations, updates

**Files:**
1. `dashboard-commands.js` (18 commands)
2. `slack-commands.js` (8 commands)
3. `slack-routing-commands.js` (10 commands)
4. `updater.js` (10 commands)

**Total: ~35 commands**

---

## Part 2: Directory Reorganization Plan

### Current Structure
```
websocket/commands/
├── evidence-commands.js
├── evasion-commands.js
├── monitoring-commands.js
├── [56 files mixed together]
└── ...
```

### Target Structure
```
websocket/commands/
├── forensic/                    # NEW: Forensic-only (legal compliance)
│   ├── evidence.js
│   ├── legal-compliance.js
│   ├── network-forensics.js
│   ├── session-tracking.js
│   ├── screenshots.js
│   ├── recordings.js
│   ├── reports.js
│   ├── index.js
│   └── README.md
│
├── evasion/                     # NEW: Bot evasion & anonymization
│   ├── fingerprinting.js
│   ├── behavioral.js
│   ├── anonymity.js
│   ├── coherence.js
│   ├── detection-bypass.js
│   ├── index.js
│   └── README.md
│
├── monitoring/                  # NEW: Competitive monitoring/tracking
│   ├── competitor.js
│   ├── change-detection.js
│   ├── analytics.js
│   ├── metrics.js
│   ├── index.js
│   └── README.md
│
├── browser/                     # NEW: Core browser operations
│   ├── screenshots.js
│   ├── extraction.js
│   ├── form-automation.js
│   ├── session-management.js
│   ├── profiles.js
│   ├── cookies.js
│   ├── index.js
│   └── README.md
│
├── export/                      # NEW: Data export/import
│   ├── formats.js
│   ├── templates.js
│   ├── encryption.js
│   ├── batch.js
│   ├── index.js
│   └── README.md
│
├── admin/                       # NEW: Admin & integrations
│   ├── dashboard.js
│   ├── notifications.js
│   ├── updates.js
│   ├── index.js
│   └── README.md
│
└── index.js                     # Unified entry point
```

---

## Part 3: File Mapping & Migration Strategy

### Phase 1: Forensic Module (14 files → 7 consolidated files)

| Current File | Target File | Status | Notes |
|---|---|---|---|
| `evidence-commands.js` | `forensic/evidence.js` | Move | Core evidence capture |
| `evidence-packaging.js` | `forensic/evidence.js` | Merge | Same module |
| `evidence-correlation-commands.js` | `forensic/evidence.js` | Merge | Same module |
| `legal-compliance-commands.js` | `forensic/legal-compliance.js` | Move | Direct move |
| `phase2-p0-legal-compliance-commands.js` | `forensic/legal-compliance.js` | Merge | Same module |
| `network-forensics-commands.js` | `forensic/network-forensics.js` | Move | Network evidence |
| `session-tracking-commands.js` | `forensic/session-tracking.js` | Move | Session evidence |
| `screenshot-commands.js` | `forensic/screenshots.js` | Copy | Also in browser/ (dual) |
| `dom-snapshot-commands.js` | `forensic/screenshots.js` | Merge | Related to screenshots |
| `javascript-console-extraction.js` | `forensic/extraction.js` | Move | Evidence extraction |
| `html-capture-commands.js` | `forensic/extraction.js` | Merge | Same module |
| `video-recording-commands.js` | `forensic/recordings.js` | Move | Video evidence |
| `recording-commands.js` | `forensic/recordings.js` | Merge | Same module |
| `report-generation.js` | `forensic/reports.js` | Move | Report generation |

**Rationale:**
- Group by evidence type (screenshot, network, session, recording, extraction)
- Consolidate legal/compliance into single module
- Create unified export point with forensic-specific metadata
- No code duplication (single implementation)
- Selective dual-export for screenshot functionality (needed by both forensic and browser)

---

### Phase 2: Evasion & Anonymization Module (10 files → 5 consolidated files)

| Current File | Target File | Status | Notes |
|---|---|---|---|
| `evasion-commands.js` | `evasion/fingerprinting.js` | Move | Core fingerprinting evasion |
| `extended-evasion-commands.js` | `evasion/fingerprinting.js` | Merge | Additional vectors |
| `fake-data-commands.js` | `evasion/detection-bypass.js` | Move | Detection service bypass |
| `location-commands.js` | `evasion/detection-bypass.js` | Merge | Location spoofing |
| `behavioral-anonymization-commands.js` | `evasion/behavioral.js` | Move | Behavioral evasion |
| `anonymity-commands.js` | `evasion/anonymity.js` | Move | General anonymity |
| `coherence-check.js` | `evasion/coherence.js` | Move | Coherence validation |
| `coherence-validation-commands.js` | `evasion/coherence.js` | Merge | Same purpose |
| `behavior-scoring.js` | `evasion/behavioral.js` | Merge | Same module |
| `tech-detection.js` | `evasion/detection-bypass.js` | Merge | Detection integration |

**Rationale:**
- Group by evasion mechanism (fingerprinting, behavioral, coherence)
- Consolidate detection-bypass related commands
- Clear separation from forensic capabilities

---

### Phase 3: Monitoring & Tracking Module (8 files → 4 consolidated files)

| Current File | Target File | Status | Notes |
|---|---|---|---|
| `competitor-monitoring-commands.js` | `monitoring/competitor.js` | Move | Competitor intelligence |
| `monitoring-commands.js` | `monitoring/metrics.js` | Move | General monitoring |
| `monitoring-advanced.js` | `monitoring/metrics.js` | Merge | Advanced metrics |
| `monitoring-continuous.js` | `monitoring/metrics.js` | Merge | Continuous monitoring |
| `monitoring-metrics-commands.js` | `monitoring/metrics.js` | Merge | Metrics collection |
| `change-detection.js` | `monitoring/change-detection.js` | Move | Change tracking |
| `analytics-advanced.js` | `monitoring/analytics.js` | Move | Analytics |
| `performance-metrics.js` | `monitoring/metrics.js` | Merge | Performance metrics |

**Rationale:**
- Group by monitoring type (competitor, change, analytics, metrics)
- Consolidate overlapping monitoring/metrics files
- Clear competitive intelligence vs. forensics distinction

---

### Phase 4: Core Browser Module (15 files → 6 consolidated files)

| Current File | Target File | Status | Notes |
|---|---|---|---|
| `screenshot-commands.js` | `browser/screenshots.js` | Copy | Also forensic/screenshots.js |
| `image-commands.js` | `browser/screenshots.js` | Merge | Image handling |
| `extraction-commands.js` | `browser/extraction.js` | Move | Data extraction |
| `form-commands.js` | `browser/form-automation.js` | Move | Form operations |
| `multi-page-commands.js` | `browser/session-management.js` | Merge | Multi-page sessions |
| `session-management.js` | `browser/session-management.js` | Merge | Session handling |
| `session-persistence-commands.js` | `browser/session-management.js` | Merge | v1 persistence |
| `session-persistence-v2.js` | `browser/session-management.js` | Merge | v2 persistence |
| `session-persistence-v3.js` | `browser/session-management.js` | Merge | v3 persistence |
| `session-persistence-week2-commands.js` | `browser/session-management.js` | Merge | Legacy persistence |
| `profile-template-commands.js` | `browser/profiles.js` | Move | Profile management |
| `cookie-commands.js` | `browser/cookies.js` | Move | Cookie handling |
| `credentials-commands.js` | `browser/cookies.js` | Merge | Credential handling |
| `proxy-partner-commands.js` | `browser/profiles.js` | Merge | Profile-related |
| `extended-features-commands.js` | `browser/extraction.js` | Merge | Extended features |

**Rationale:**
- Core browser automation capabilities
- Session/profile management consolidated
- Screenshot shared with forensic module (no duplication)
- Persistence versions merged into single interface

---

### Phase 5: Export/Import Module (5 files → 4 consolidated files)

| Current File | Target File | Status | Notes |
|---|---|---|---|
| `export-formats.js` | `export/formats.js` | Move | Export formats |
| `export-templates-commands.js` | `export/templates.js` | Move | Export templates |
| `encrypted-export-commands.js` | `export/encryption.js` | Move | Encryption |
| `batch-operations-commands.js` | `export/batch.js` | Move | Batch ops |
| `correlation-commands.js` | `export/batch.js` | Merge | Data correlation |

**Rationale:**
- Data transformation/export pipeline
- Encryption separated from content formats
- Batch operations with correlation

---

### Phase 6: Admin & Integration Module (4 files → 3 consolidated files)

| Current File | Target File | Status | Notes |
|---|---|---|---|
| `dashboard-commands.js` | `admin/dashboard.js` | Move | Dashboard |
| `slack-commands.js` | `admin/notifications.js` | Move | Notifications |
| `slack-routing-commands.js` | `admin/notifications.js` | Merge | Same module |
| `updater.js` | `admin/updates.js` | Move | System updates |

**Rationale:**
- Administrative operations
- Notifications centralized
- Updates management

---

## Part 4: Implementation Strategy (Low-Risk Refactoring)

### Phase A: Preparation (Week 1)
1. Create new directory structure
   ```bash
   mkdir -p websocket/commands/{forensic,evasion,monitoring,browser,export,admin}
   ```

2. Create `index.js` files for each module (re-export pattern)

3. Update `.gitignore` if needed

4. Create module-specific README.md files

### Phase B: Migration (Week 2)
1. **Forensic Module**
   - Move evidence-related files
   - Merge evidence packaging, correlation, legal compliance
   - Create forensic/index.js with unified exports

2. **Evasion Module**
   - Move evasion files
   - Merge behavioral, coherence, fake-data
   - Create evasion/index.js

3. **Monitoring Module**
   - Move monitoring files
   - Merge competitor, change-detection, analytics
   - Create monitoring/index.js

4. **Browser Module**
   - Move browser-related files
   - Merge session persistence versions
   - Create browser/index.js

5. **Export Module**
   - Move export files
   - Create export/index.js

6. **Admin Module**
   - Move admin files
   - Create admin/index.js

### Phase C: Integration Updates (Week 3)
1. Update `websocket/server.js` import statements
   ```javascript
   // OLD
   const { registerEvidenceCommands } = require('./commands/evidence-commands');
   
   // NEW
   const { registerEvidenceCommands } = require('./commands/forensic');
   ```

2. Update `websocket/command-dispatcher.js` if needed

3. Create unified `websocket/commands/index.js` for convenience
   ```javascript
   module.exports = {
     forensic: require('./forensic'),
     evasion: require('./evasion'),
     monitoring: require('./monitoring'),
     browser: require('./browser'),
     export: require('./export'),
     admin: require('./admin')
   };
   ```

### Phase D: Testing (Week 4)
1. Unit tests for each module
2. Integration tests for command registration
3. WebSocket command execution tests
4. Update test files in `tests/` directory

5. Verify no command conflicts
6. Performance validation

### Phase E: Documentation (Week 4)
1. Create README.md for each module explaining:
   - Purpose and scope
   - Commands provided
   - Legal/ethical considerations (forensic module)
   - Usage examples

2. Update main API documentation
3. Update MCP server documentation
4. Create migration guide for API consumers

---

## Part 5: Detailed Module Descriptions

### Forensic Module (`websocket/commands/forensic/`)

**Purpose:** Legal compliance, evidence capture, chain-of-custody, audit trails

**Files:**
- `evidence.js` - Evidence capture and packaging
- `legal-compliance.js` - Legal compliance and chain-of-custody
- `network-forensics.js` - Network traffic evidence
- `session-tracking.js` - Session evidence tracking
- `screenshots.js` - Screenshot evidence (shared with browser/)
- `extraction.js` - Console/DOM evidence extraction
- `recordings.js` - Video and interaction recordings
- `reports.js` - Forensic report generation
- `index.js` - Module exports

**Key Constraints:**
- All evidence must be timestamped
- Chain-of-custody must be documented
- Evidence integrity verified with hashes
- No modification/tampering allowed
- Compatible with legal systems
- Audit trails maintained

**API Example:**
```javascript
const forensic = require('./commands/forensic');

// Register all forensic commands
forensic.registerAll(commandHandlers);

// Specific command
const result = await commandHandlers.capture_screenshot_evidence({
  imageData: base64String,
  url: 'https://example.com',
  capturedBy: 'user@company.com'
});
```

---

### Evasion Module (`websocket/commands/evasion/`)

**Purpose:** Bot detection evasion, fingerprinting circumvention, anonymization

**Files:**
- `fingerprinting.js` - Fingerprint spoofing (Canvas, WebGL, Audio, etc.)
- `detection-bypass.js` - Detection service evasion
- `behavioral.js` - Behavioral anonymization
- `anonymity.js` - General anonymity features
- `coherence.js` - Session coherence validation
- `index.js` - Module exports

**Key Characteristics:**
- NOT for forensic purposes
- Designed to evade bot detection services
- Can conflict with forensic/legal use cases
- Behavioral mimicry
- Service-specific evasion vectors

**Ethical Note:**
```javascript
/**
 * IMPORTANT: This module provides bot evasion capabilities
 * intended for legitimate automation testing and research.
 * 
 * Users are responsible for ensuring all use complies with:
 * - Website Terms of Service
 * - Local laws and regulations
 * - Robots.txt and automation policies
 * 
 * This module should NOT be used for:
 * - Unauthorized access
 * - Data scraping against ToS
 * - Malicious automation
 * - Account takeover
 */
```

**API Example:**
```javascript
const evasion = require('./commands/evasion');

// Register all evasion commands
evasion.registerAll(commandHandlers);

// Enable fingerprinting evasion
const result = await commandHandlers.enable_canvas_evasion({
  mode: 'realistic',
  noiseFactor: 0.1
});
```

---

### Monitoring Module (`websocket/commands/monitoring/`)

**Purpose:** Competitor monitoring, website tracking, change detection, analytics

**Files:**
- `competitor.js` - Competitor website monitoring
- `change-detection.js` - Content change detection
- `analytics.js` - Website analytics
- `metrics.js` - Performance and monitoring metrics
- `index.js` - Module exports

**Key Characteristics:**
- Competitive intelligence
- NOT for forensic evidence
- Change tracking without legal compliance requirements
- Performance analytics
- Market intelligence

**API Example:**
```javascript
const monitoring = require('./commands/monitoring');

// Register all monitoring commands
monitoring.registerAll(commandHandlers);

// Add competitor monitor
const result = await commandHandlers.add_competitor_monitor({
  url: 'https://competitor.com',
  name: 'Main Competitor',
  frequency: 'daily'
});
```

---

### Browser Module (`websocket/commands/browser/`)

**Purpose:** Core browser automation, session management, form filling

**Files:**
- `screenshots.js` - Screenshot capture (general, non-forensic)
- `extraction.js` - Data extraction from pages
- `form-automation.js` - Smart form filling
- `session-management.js` - Session lifecycle and persistence
- `profiles.js` - Browser profile management
- `cookies.js` - Cookie and credential handling
- `index.js` - Module exports

**Key Characteristics:**
- Core browser functionality
- Not specialized for forensics or evasion
- General-purpose automation
- Session persistence
- Form automation

**API Example:**
```javascript
const browser = require('./commands/browser');

// Register all browser commands
browser.registerAll(commandHandlers);

// Take a screenshot
const result = await commandHandlers.capture_screenshot({
  fullPage: true
});

// Save session
const session = await commandHandlers.save_session_state({
  sessionName: 'my-session'
});
```

---

### Export Module (`websocket/commands/export/`)

**Purpose:** Data export/import, formatting, batch operations

**Files:**
- `formats.js` - Export format definitions
- `templates.js` - Export templates
- `encryption.js` - Encrypted export
- `batch.js` - Batch operations and data correlation
- `index.js` - Module exports

**Key Characteristics:**
- Data transformation pipeline
- Format conversion
- Encryption support
- Batch processing

---

### Admin Module (`websocket/commands/admin/`)

**Purpose:** Dashboard, notifications, system updates

**Files:**
- `dashboard.js` - Dashboard management
- `notifications.js` - Slack and other integrations
- `updates.js` - System updates
- `index.js` - Module exports

---

## Part 6: Code Consolidation Strategy

### Example: Evidence Module Consolidation

**Current State:**
```
evidence-commands.js (8 commands)
evidence-packaging.js (18 commands)
evidence-correlation-commands.js (5 commands)
```

**Target State:**
```
forensic/evidence.js (31 commands)
```

**Implementation:**
```javascript
// forensic/evidence.js

/**
 * Evidence Management Module
 * 
 * Consolidated from:
 * - evidence-commands.js (8 commands)
 * - evidence-packaging.js (18 commands)
 * - evidence-correlation-commands.js (5 commands)
 */

const { Evidence, EvidenceCollector } = require('../../evidence/evidence-collector');

let evidenceCollector = null;

function registerEvidenceCommands(commandHandlers) {
  // Initialize
  if (!evidenceCollector) {
    evidenceCollector = new EvidenceCollector();
  }

  // ===== Evidence Capture Commands (from evidence-commands.js) =====
  commandHandlers.capture_screenshot_evidence = async (params) => { ... };
  commandHandlers.capture_page_archive_evidence = async (params) => { ... };
  // ... more capture commands

  // ===== Evidence Packaging Commands (from evidence-packaging.js) =====
  commandHandlers.create_evidence_package = async (params) => { ... };
  commandHandlers.add_evidence_to_package = async (params) => { ... };
  // ... more packaging commands

  // ===== Evidence Correlation Commands (from evidence-correlation-commands.js) =====
  commandHandlers.correlate_evidence = async (params) => { ... };
  commandHandlers.detect_correlation_patterns = async (params) => { ... };
  // ... more correlation commands

  console.log('[Forensic] 31 evidence commands registered');
}

module.exports = {
  registerEvidenceCommands
};
```

**Benefits:**
- Single source of truth
- Related functionality grouped
- Easier to maintain consistency
- Clear evidence handling pipeline
- No code duplication

---

## Part 7: Breaking Changes & Migration Path

### API Changes

**Old API:**
```javascript
const { registerEvidenceCommands } = require('./commands/evidence-commands');
const { registerEvidenceCorrelationCommands } = require('./commands/evidence-correlation-commands');
const { registerLegalComplianceCommands } = require('./commands/legal-compliance-commands');
const { registerNetworkForensicsCommands } = require('./commands/network-forensics-commands');

registerEvidenceCommands(commandHandlers);
registerEvidenceCorrelationCommands(commandHandlers);
registerLegalComplianceCommands(commandHandlers);
registerNetworkForensicsCommands(commandHandlers);
```

**New API (Option 1: Unified):**
```javascript
const forensic = require('./commands/forensic');
forensic.registerAll(commandHandlers);
```

**New API (Option 2: Individual modules):**
```javascript
const { registerEvidenceCommands } = require('./commands/forensic/evidence');
const { registerLegalComplianceCommands } = require('./commands/forensic/legal-compliance');

registerEvidenceCommands(commandHandlers);
registerLegalComplianceCommands(commandHandlers);
```

**New API (Option 3: Backward compatible):**
```javascript
// Old imports still work (re-exported from new location)
const { registerEvidenceCommands } = require('./commands/evidence-commands');
registerEvidenceCommands(commandHandlers);
```

**Recommendation:** Use Option 2 or 3 for backward compatibility during transition.

---

## Part 8: Testing Strategy

### Unit Tests

1. **Forensic Module Tests** (`tests/unit/forensic-commands.test.js`)
   - Evidence capture and integrity
   - Chain-of-custody logging
   - Legal compliance requirements
   - Hash verification

2. **Evasion Module Tests** (`tests/unit/evasion-commands.test.js`)
   - Fingerprinting accuracy
   - Detection evasion effectiveness
   - Behavioral coherence

3. **Monitoring Module Tests** (`tests/unit/monitoring-commands.test.js`)
   - Change detection accuracy
   - Performance tracking
   - Alert triggering

4. **Browser Module Tests** (`tests/unit/browser-commands.test.js`)
   - Session persistence
   - Form filling accuracy
   - Profile management

### Integration Tests

1. **Forensic Integration** (`tests/integration/forensic-integration.test.js`)
   - End-to-end evidence capture workflow
   - Multi-evidence correlation
   - Report generation

2. **WebSocket API Tests** (`tests/integration/websocket-commands.test.js`)
   - Command registration
   - Error handling
   - Response format validation

3. **Module Independence Tests**
   - Forensic module works without evasion
   - Evasion module works without forensic
   - No command conflicts

### Regression Tests

1. All existing tests should pass without modification
2. Command names unchanged
3. Response formats identical

---

## Part 9: Documentation Updates

### Module README.md Files

Each module should include:

1. **Purpose Statement**
   ```markdown
   # Forensic Commands Module
   
   Legal compliance, evidence capture, and chain-of-custody documentation
   for legal/investigative use cases.
   ```

2. **Command List**
   ```markdown
   ## Commands
   - capture_screenshot_evidence
   - capture_page_archive_evidence
   - ... (complete list)
   ```

3. **Usage Examples**
   ```javascript
   const forensic = require('./commands/forensic');
   forensic.registerAll(commandHandlers);
   ```

4. **Legal Considerations** (forensic module only)
   ```markdown
   ## Legal Considerations
   
   All evidence captured by this module:
   - Is timestamped and hashed
   - Maintains chain-of-custody
   - Is designed for legal admissibility
   - Must not be modified or tampered with
   ```

5. **Ethical Considerations** (evasion module only)
   ```markdown
   ## Ethical Use
   
   This module should only be used for:
   - Legitimate automation testing
   - Security research with permission
   - Compliance testing
   
   NOT for:
   - Unauthorized access
   - ToS violations
   - Malicious automation
   ```

### API Documentation Updates

Update `docs/API-REFERENCE.md`:

```markdown
# WebSocket API Reference

## Command Categories

### Forensic Commands
Legal compliance and evidence capture

- [Evidence Commands](#evidence-commands)
- [Legal Compliance](#legal-compliance)
- [Network Forensics](#network-forensics)

### Evasion Commands
Bot detection circumvention

- [Fingerprinting Evasion](#fingerprinting)
- [Behavioral Evasion](#behavioral)

### Monitoring Commands
...
```

---

## Part 10: Execution Roadmap

### Week 1: Preparation
- [ ] Create directory structure
- [ ] Create module index.js files
- [ ] Create module README.md files
- [ ] Document consolidation mappings

### Week 2: Code Migration
- [ ] Migrate forensic module
- [ ] Migrate evasion module
- [ ] Migrate monitoring module
- [ ] Migrate browser module
- [ ] Migrate export module
- [ ] Migrate admin module

### Week 3: Integration
- [ ] Update websocket/server.js imports
- [ ] Update command-dispatcher.js if needed
- [ ] Create unified index.js
- [ ] Remove old command files
- [ ] Test all registrations

### Week 4: Testing & Docs
- [ ] Unit tests for each module
- [ ] Integration tests
- [ ] Regression tests
- [ ] Update API documentation
- [ ] Create migration guide

### Week 5: Release
- [ ] Code review
- [ ] Documentation review
- [ ] Release notes
- [ ] Version bump (minor version)

---

## Part 11: Risk Assessment & Mitigation

### Risk: Command Name Conflicts
**Mitigation:** Audit all command names before migration, ensure uniqueness

### Risk: Broken Imports in Server.js
**Mitigation:** Automated import testing, backward-compatible re-exports

### Risk: MCP Server Integration
**Mitigation:** Test MCP server tool registration with new structure

### Risk: Existing Client Code
**Mitigation:** Provide backward-compatible exports, deprecation warnings

### Mitigation: Code Duplication
**Mitigation:** Single source of truth, no duplication between modules

---

## Part 12: Success Criteria

- [ ] All 56 command files reorganized into 6 modules
- [ ] No code duplication (except deliberate screenshot re-export)
- [ ] All ~622 commands still functional
- [ ] Unit test pass rate > 95%
- [ ] Integration tests passing
- [ ] Backward compatibility maintained (re-exports)
- [ ] Documentation complete and accurate
- [ ] Zero functionality lost
- [ ] Clear separation of concerns
- [ ] Reduced cognitive load for developers

---

## Conclusion

This reorganization plan provides a clear, low-risk path to separate forensic from non-forensic features while maintaining all functionality and backward compatibility. The phased approach allows for iterative testing and validation.

**Key Benefits:**
1. Clear separation of forensic (legal) from non-forensic (monitoring/evasion)
2. Improved code organization and maintainability
3. Easier to understand project scope and constraints
4. Better documentation of ethical/legal considerations
5. Reduced complexity for new developers
6. Clear API boundaries between concerns

**Next Steps:**
1. Review this plan with stakeholders
2. Identify any missing commands or files
3. Finalize consolidation mappings
4. Begin Week 1 preparation tasks

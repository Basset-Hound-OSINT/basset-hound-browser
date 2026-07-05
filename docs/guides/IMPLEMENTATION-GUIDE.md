# Forensic/Non-Forensic Separation: Implementation Guide

**Status:** Phase Implementation Instructions  
**Target Timeline:** 4-5 weeks  
**Complexity:** Medium (high volume, low risk)

---

## Quick Start

This guide provides step-by-step instructions for separating forensic from non-forensic features without losing functionality.

---

## Part 1: Directory Structure Setup

### Step 1.1: Create Directory Structure

```bash
# Navigate to websocket/commands
cd websocket/commands

# Create new module directories
mkdir -p forensic
mkdir -p evasion
mkdir -p monitoring
mkdir -p browser
mkdir -p export
mkdir -p admin

# Verify structure
ls -la
```

**Expected Output:**
```
drwxr-xr-x  forensic/
drwxr-xr-x  evasion/
drwxr-xr-x  monitoring/
drwxr-xr-x  browser/
drwxr-xr-x  export/
drwxr-xr-x  admin/
```

---

### Step 1.2: Create Module Entry Points

Create `websocket/commands/forensic/index.js`:

```javascript
/**
 * Forensic Commands Module
 * 
 * Exports all forensic-related WebSocket commands
 * Legal compliance, evidence capture, chain-of-custody
 */

const { registerEvidenceCommands } = require('./evidence');
const { registerLegalComplianceCommands } = require('./legal-compliance');
const { registerNetworkForensicsCommands } = require('./network-forensics');
const { registerSessionTrackingCommands } = require('./session-tracking');
const { registerScreenshotCommands } = require('./screenshots');
const { registerExtractionCommands } = require('./extraction');
const { registerRecordingCommands } = require('./recordings');
const { registerReportGenerationCommands } = require('./reports');

/**
 * Register all forensic commands with a command handler
 * 
 * @param {Object} commandHandlers - Command handlers map
 * @param {Object} context - Optional context (mainWindow, etc.)
 */
function registerAll(commandHandlers, context = {}) {
  const handlers = {
    registerEvidenceCommands,
    registerLegalComplianceCommands,
    registerNetworkForensicsCommands,
    registerSessionTrackingCommands,
    registerScreenshotCommands,
    registerExtractionCommands,
    registerRecordingCommands,
    registerReportGenerationCommands
  };

  // Register each sub-module
  Object.entries(handlers).forEach(([name, fn]) => {
    try {
      fn(commandHandlers, context);
      console.log(`[Forensic] ${name} registered`);
    } catch (error) {
      console.error(`[Forensic] Failed to register ${name}:`, error.message);
    }
  });
}

/**
 * Get list of all forensic commands
 * 
 * @returns {Array<string>} Command names
 */
function getCommandNames() {
  return [
    // Evidence commands
    'capture_screenshot_evidence',
    'capture_page_archive_evidence',
    'capture_har_evidence',
    'capture_dom_evidence',
    'capture_console_evidence',
    'capture_cookies_evidence',
    'capture_storage_evidence',
    'create_evidence_package',
    'add_evidence_to_package',
    'correlate_evidence',
    'verify_chain_of_custody',
    // ... add all forensic commands
  ];
}

module.exports = {
  registerAll,
  registerEvidenceCommands,
  registerLegalComplianceCommands,
  registerNetworkForensicsCommands,
  registerSessionTrackingCommands,
  registerScreenshotCommands,
  registerExtractionCommands,
  registerRecordingCommands,
  registerReportGenerationCommands,
  getCommandNames
};
```

Create similar index.js files for:
- `websocket/commands/evasion/index.js`
- `websocket/commands/monitoring/index.js`
- `websocket/commands/browser/index.js`
- `websocket/commands/export/index.js`
- `websocket/commands/admin/index.js`

---

## Part 2: File Migration (Forensic Module Example)

### Step 2.1: Consolidate Evidence Commands

Copy `evidence-commands.js`:

```bash
cp websocket/commands/evidence-commands.js websocket/commands/forensic/evidence.js.new
```

Edit `websocket/commands/forensic/evidence.js` to merge with `evidence-packaging.js` and `evidence-correlation-commands.js`:

```javascript
/**
 * Evidence Management Module (Forensic)
 * 
 * Consolidated from:
 * - evidence-commands.js (8 commands)
 * - evidence-packaging.js (18 commands)
 * - evidence-correlation-commands.js (5 commands)
 * 
 * Total: 31 forensic evidence commands
 */

const {
  Evidence,
  EvidenceCollector,
  EVIDENCE_TYPES,
  ARCHIVE_FORMATS
} = require('../../evidence/evidence-collector');

let evidenceCollector = null;

function initializeEvidenceCollector(config = {}) {
  evidenceCollector = new EvidenceCollector(config);
  evidenceCollector.on('evidenceCaptured', (summary) => {
    console.log(`[Evidence] Captured: ${summary.id} (${summary.type})`);
  });
  return evidenceCollector;
}

function getEvidenceCollector() {
  if (!evidenceCollector) {
    initializeEvidenceCollector();
  }
  return evidenceCollector;
}

function registerEvidenceCommands(commandHandlers, captureFunction) {
  if (!evidenceCollector) {
    initializeEvidenceCollector();
  }

  // ===== Section 1: Evidence Capture (from evidence-commands.js) =====
  
  /**
   * Capture screenshot evidence
   * @command capture_screenshot_evidence
   */
  commandHandlers.capture_screenshot_evidence = async (params) => {
    try {
      const collector = getEvidenceCollector();
      const evidence = collector.captureScreenshot(params.imageData, {
        url: params.url,
        title: params.title,
        viewport: params.viewport,
        fullPage: params.fullPage,
        annotations: params.annotations,
        capturedBy: params.capturedBy
      });

      return {
        success: true,
        evidenceId: evidence.id,
        evidence: evidence.getSummary()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // [Insert other capture commands from evidence-commands.js]

  // ===== Section 2: Evidence Packaging (from evidence-packaging.js) =====

  /**
   * Create an evidence package for organizing related evidence
   * @command create_evidence_package
   */
  commandHandlers.create_evidence_package = async (params) => {
    try {
      // Implementation from evidence-packaging.js
      const { name, description = '' } = params;
      
      // Create package...
      
      return {
        success: true,
        packageId: 'pkg-xxx',
        message: `Evidence package "${name}" created`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // [Insert other packaging commands from evidence-packaging.js]

  // ===== Section 3: Evidence Correlation (from evidence-correlation-commands.js) =====

  /**
   * Correlate multiple evidence items
   * @command correlate_evidence
   */
  commandHandlers.correlate_evidence = async (params) => {
    try {
      // Implementation from evidence-correlation-commands.js
      const { evidenceIds = [] } = params;
      
      // Correlate evidence...
      
      return {
        success: true,
        correlations: []
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  // [Insert other correlation commands]

  console.log('[Forensic] 31 evidence commands registered');
}

module.exports = {
  registerEvidenceCommands,
  initializeEvidenceCollector,
  getEvidenceCollector
};
```

---

### Step 2.2: Consolidate Legal Compliance Commands

Create `websocket/commands/forensic/legal-compliance.js`:

```javascript
/**
 * Legal Compliance Module (Forensic)
 * 
 * Consolidated from:
 * - legal-compliance-commands.js (6 commands)
 * - phase2-p0-legal-compliance-commands.js (phase placeholder)
 * 
 * Total: 6 legal compliance commands
 */

function registerLegalComplianceCommands(commandHandlers, mainWindow) {
  // ===== From legal-compliance-commands.js =====

  /**
   * Record legal notice/disclaimer
   * @command record_legal_notice
   */
  commandHandlers.record_legal_notice = async (params) => {
    try {
      const { notice, timestamp = new Date() } = params;
      
      // Record notice...
      
      return {
        success: true,
        noticeId: 'notice-xxx',
        recordedAt: timestamp
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Document consent for evidence collection
   * @command document_consent
   */
  commandHandlers.document_consent = async (params) => {
    try {
      const { userId, consentType, timestamp = new Date() } = params;
      
      // Document consent...
      
      return {
        success: true,
        consentId: 'consent-xxx',
        documentedAt: timestamp
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // [Insert other legal compliance commands]

  console.log('[Forensic] 6 legal compliance commands registered');
}

module.exports = {
  registerLegalComplianceCommands
};
```

**Repeat this pattern for:**
- `websocket/commands/forensic/network-forensics.js`
- `websocket/commands/forensic/session-tracking.js`
- `websocket/commands/forensic/screenshots.js`
- `websocket/commands/forensic/extraction.js`
- `websocket/commands/forensic/recordings.js`
- `websocket/commands/forensic/reports.js`

---

## Part 3: Update Server.js Imports

### Step 3.1: Old Import Pattern

Current `websocket/server.js` (lines 59-91):

```javascript
const { registerCredentialsCommands } = require('./commands/credentials-commands');
const { registerSessionPersistenceCommands } = require('./commands/session-persistence-commands');
const { registerExtendedEvasionCommands } = require('./commands/extended-evasion-commands');
const { registerMonitoringMetricsCommands, registerConsentCommands } = require('./commands/monitoring-metrics-commands');
const { registerJavaScriptConsoleExtractionCommands } = require('./commands/javascript-console-extraction');
const { registerDOMSnapshotCommands } = require('./commands/dom-snapshot-commands');
const { registerHtmlCaptureCommands } = require('./commands/html-capture-commands');
const { registerExportFormatCommands } = require('./commands/export-formats');
const { registerExportTemplateCommands } = require('./commands/export-templates-commands');
const { registerBatchOperationsCommands } = require('./commands/batch-operations-commands');
const { registerCorrelationCommands } = require('./commands/correlation-commands');
const { registerLegalComplianceCommands } = require('./commands/legal-compliance-commands');
const { registerEvidenceCorrelationCommands } = require('./commands/evidence-correlation-commands');
const { registerSessionTrackingCommands } = require('./commands/session-tracking-commands');
```

### Step 3.2: New Import Pattern (Option 1: Unified Module)

```javascript
// Import all modules
const forensic = require('./commands/forensic');
const evasion = require('./commands/evasion');
const monitoring = require('./commands/monitoring');
const browser = require('./commands/browser');
const exportModule = require('./commands/export');
const admin = require('./commands/admin');
```

### Step 3.3: Update Initialization

In `initializeCommandHandlers()` method, replace individual registrations:

**Old:**
```javascript
// Around line 10100+
registerImageCommands(this, this.mainWindow);
registerScreenshotCommands(this, this.mainWindow);
registerNetworkForensicsCommands(this.commandHandlers);
registerMonitoringCommands(this, this.mainWindow);
// ... 20+ more individual calls
```

**New:**
```javascript
// Initialize all command modules
try {
  forensic.registerAll(this.commandHandlers, { mainWindow: this.mainWindow });
  evasion.registerAll(this.commandHandlers, { mainWindow: this.mainWindow });
  monitoring.registerAll(this.commandHandlers, { mainWindow: this.mainWindow });
  browser.registerAll(this.commandHandlers, { mainWindow: this.mainWindow });
  exportModule.registerAll(this.commandHandlers, { mainWindow: this.mainWindow });
  admin.registerAll(this.commandHandlers, { mainWindow: this.mainWindow });
  
  console.log('[WebSocket] All command modules initialized');
} catch (error) {
  console.error('[WebSocket] Failed to initialize command modules:', error.message);
  throw error;
}
```

---

## Part 4: Create Module README Files

### Step 4.1: Forensic Module README

Create `websocket/commands/forensic/README.md`:

```markdown
# Forensic Commands Module

Legal compliance, evidence capture, and chain-of-custody documentation for legal/investigative use cases.

## Purpose

This module provides commands specifically designed for:
- Legal evidence collection
- Chain-of-custody documentation
- Audit trail generation
- Tamper detection and verification
- Court-admissible evidence handling

## Commands

### Evidence Capture (31 commands)
- `capture_screenshot_evidence` - Capture timestamped screenshots
- `capture_page_archive_evidence` - Capture full page archives
- `capture_har_evidence` - Capture network traffic (HAR format)
- `capture_dom_evidence` - Capture DOM snapshots
- `capture_console_evidence` - Capture console logs
- `capture_cookies_evidence` - Capture cookies
- `capture_storage_evidence` - Capture local storage
- [and more...]

### Evidence Packaging (18 commands)
- `create_evidence_package` - Create evidence container
- `add_evidence_to_package` - Add evidence items
- `seal_evidence_package` - Finalize package
- [and more...]

### Legal Compliance (6 commands)
- `record_legal_notice` - Document legal notice
- `document_consent` - Record consent
- `verify_chain_of_custody` - Verify integrity
- [and more...]

### Network Forensics (26 commands)
- `capture_network_trace` - Capture network traffic
- `analyze_http_requests` - Analyze HTTP requests
- [and more...]

### Other Forensic Commands
- Session tracking (3 commands)
- Screenshots (15 commands)
- DOM snapshots (7 commands)
- Console extraction (10 commands)
- HTML capture (6 commands)
- Video recording (14 commands)
- Interaction recording (20 commands)
- Report generation

## Usage

```javascript
const forensic = require('./commands/forensic');

// Register all forensic commands
forensic.registerAll(commandHandlers, { mainWindow });

// Use a forensic command
const result = await commandHandlers.capture_screenshot_evidence({
  imageData: base64String,
  url: 'https://example.com',
  capturedBy: 'investigator@agency.gov'
});
```

## Legal Considerations

All evidence captured using this module:
- ✓ Is automatically timestamped
- ✓ Maintains chain-of-custody records
- ✓ Includes integrity verification (SHA-256)
- ✓ Cannot be modified after capture
- ✓ Is designed for legal admissibility
- ✓ Generates audit trails

## Important Notes

This module should **ONLY** be used for:
- Legitimate legal investigations
- Law enforcement activities
- Court-ordered evidence collection
- Compliance auditing
- Licensed investigative work

DO NOT use for:
- Unauthorized surveillance
- Privacy violations
- Illegal investigations
- Tampering with evidence

## Ethical & Legal Compliance

Users are solely responsible for ensuring all use of this module complies with:
- Applicable federal and state laws
- International privacy regulations (GDPR, CCPA, etc.)
- Court orders and warrants
- Investigative protocols
- Chain-of-custody requirements

## Example Workflow

```javascript
// 1. Create evidence package
const pkg = await commandHandlers.create_evidence_package({
  name: 'Investigation #2026-05-001',
  description: 'Website forensic evidence'
});

// 2. Capture evidence items
const screenshot = await commandHandlers.capture_screenshot_evidence({
  imageData: screenCapture,
  url: currentUrl,
  capturedBy: 'agent@agency.gov'
});

// 3. Add to package
await commandHandlers.add_evidence_to_package({
  packageId: pkg.packageId,
  evidenceId: screenshot.evidenceId
});

// 4. Verify integrity
const verification = await commandHandlers.verify_chain_of_custody({
  packageId: pkg.packageId
});

// 5. Export for court
const report = await commandHandlers.export_for_court({
  packageId: pkg.packageId,
  format: 'legal_document'
});
```
```

---

### Step 4.2: Evasion Module README

Create `websocket/commands/evasion/README.md`:

```markdown
# Evasion & Anonymization Module

Bot detection evasion, fingerprinting circumvention, and behavioral anonymization.

## Purpose

This module provides commands for:
- Circumventing bot detection services
- Fingerprinting spoofing
- Behavioral anonymization
- Detection service evasion
- Privacy enhancement through anonymity

## Commands

### Fingerprinting Evasion (35 commands)
- Canvas fingerprinting evasion
- WebGL fingerprinting evasion
- AudioContext evasion
- Font enumeration evasion
- Plugin detection evasion
- And more...

### Detection Bypass (27 commands)
- Fake user profiles
- Fake device identifiers
- Location spoofing
- Timezone spoofing
- Technology detection evasion

### Behavioral Anonymization (10 commands)
- Click pattern randomization
- Scroll behavior randomization
- Timing randomization
- Mouse movement patterns

### Coherence Validation (19 commands)
- Fingerprint consistency validation
- Behavioral coherence checking
- Cross-detection-service validation

## Usage

```javascript
const evasion = require('./commands/evasion');

// Register all evasion commands
evasion.registerAll(commandHandlers);

// Enable canvas fingerprinting evasion
const result = await commandHandlers.enable_canvas_evasion({
  mode: 'realistic',
  noiseFactor: 0.1
});
```

## Ethical & Legal Notice

**IMPORTANT:** This module provides bot evasion capabilities for legitimate purposes only.

### Permitted Uses
- ✓ Security testing with permission
- ✓ Automation research
- ✓ Compliance testing
- ✓ Personal browsing privacy
- ✓ Authorized penetration testing

### Prohibited Uses
- ✗ Unauthorized website access
- ✗ Scraping against Terms of Service
- ✗ Account takeover
- ✗ Malicious automation
- ✗ Bypassing legal access controls

## Legal Disclaimer

Users are **solely responsible** for ensuring all use complies with:
- Website Terms of Service
- robots.txt and automation policies
- Local laws and regulations
- Applicable copyright/CFAA provisions
- Computer Fraud and Abuse Act (CFAA)

Unauthorized access to computer systems is illegal under the Computer Fraud and Abuse Act (18 U.S.C. § 1030).

## Conflict Note

**IMPORTANT:** Do not use both forensic and evasion modules together on the same target.

- **Forensic Module**: Evidence for legal/courtroom use (requires unmodified data)
- **Evasion Module**: Circumvents detection (modifies fingerprints/behavior)

These are mutually exclusive for legal compliance purposes.
```

---

### Step 4.3: Monitoring Module README

Create `websocket/commands/monitoring/README.md`:

```markdown
# Monitoring & Tracking Module

Competitive intelligence, website tracking, change detection, and performance analytics.

## Purpose

This module provides commands for:
- Competitive website monitoring
- Content change detection
- Performance tracking
- Website analytics
- Market intelligence gathering

## Commands

### Competitor Monitoring (23 commands)
- Add/remove/update monitors
- Change detection
- Price monitoring
- Feature tracking
- Alert configuration

### Change Detection (9 commands)
- Content change detection
- DOM mutation tracking
- Change timeline generation

### Analytics (11 commands)
- Website analytics
- Behavioral analysis
- Trend prediction

### Metrics Collection (70 commands)
- Performance metrics
- Monitoring metrics
- KPI tracking
- Continuous monitoring

## Usage

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

## Notes

This module is **NOT** for forensic evidence collection.

- Use for competitive intelligence
- Use for market analysis
- Use for internal benchmarking
- NOT for legal/court purposes
```

---

## Part 5: Testing Strategy

### Step 5.1: Create Module Tests

Create `tests/unit/forensic-module.test.js`:

```javascript
const assert = require('assert');
const forensic = require('../../websocket/commands/forensic');

describe('Forensic Module', () => {
  let commandHandlers = {};

  beforeEach(() => {
    commandHandlers = {};
  });

  describe('Registration', () => {
    it('should register all forensic commands', () => {
      forensic.registerAll(commandHandlers);
      
      // Check that commands are registered
      assert(commandHandlers.capture_screenshot_evidence, 'Missing capture_screenshot_evidence');
      assert(commandHandlers.create_evidence_package, 'Missing create_evidence_package');
      assert(commandHandlers.verify_chain_of_custody, 'Missing verify_chain_of_custody');
    });

    it('should return list of forensic commands', () => {
      const commands = forensic.getCommandNames();
      
      assert(Array.isArray(commands), 'Commands should be array');
      assert(commands.length > 0, 'Should have commands');
      assert(commands.includes('capture_screenshot_evidence'), 'Should include screenshot command');
    });
  });

  describe('Evidence Commands', () => {
    beforeEach(() => {
      forensic.registerAll(commandHandlers);
    });

    it('should capture screenshot evidence', async () => {
      const result = await commandHandlers.capture_screenshot_evidence({
        imageData: Buffer.from('test'),
        url: 'https://example.com',
        capturedBy: 'test@example.com'
      });

      assert(result.success === true, 'Should succeed');
      assert(result.evidenceId, 'Should return evidenceId');
      assert(result.evidence, 'Should return evidence data');
    });
  });
});
```

Create similar tests for each module:
- `tests/unit/evasion-module.test.js`
- `tests/unit/monitoring-module.test.js`
- `tests/unit/browser-module.test.js`
- `tests/unit/export-module.test.js`
- `tests/unit/admin-module.test.js`

---

### Step 5.2: Create Integration Tests

Create `tests/integration/modules-integration.test.js`:

```javascript
const assert = require('assert');
const WebSocketServer = require('ws').Server;
const forensic = require('../../websocket/commands/forensic');
const evasion = require('../../websocket/commands/evasion');
const monitoring = require('../../websocket/commands/monitoring');

describe('Command Module Integration', () => {
  let commandHandlers = {};

  beforeEach(() => {
    commandHandlers = {};
    
    // Register all modules
    forensic.registerAll(commandHandlers);
    evasion.registerAll(commandHandlers);
    monitoring.registerAll(commandHandlers);
  });

  describe('Module Independence', () => {
    it('forensic should work independently', () => {
      const handlers = {};
      forensic.registerAll(handlers);
      
      assert(handlers.capture_screenshot_evidence, 'Forensic should have commands');
    });

    it('evasion should work independently', () => {
      const handlers = {};
      evasion.registerAll(handlers);
      
      assert(handlers.enable_canvas_evasion, 'Evasion should have commands');
    });

    it('should have no command conflicts', () => {
      const handlers = {};
      
      // Register all modules
      forensic.registerAll(handlers);
      evasion.registerAll(handlers);
      monitoring.registerAll(handlers);
      
      // Get all command names
      const commands = Object.keys(handlers);
      
      // Check for duplicates
      const duplicates = commands.filter((cmd, idx) => commands.indexOf(cmd) !== idx);
      assert(duplicates.length === 0, `Command conflicts: ${duplicates.join(', ')}`);
    });
  });

  describe('Command Count', () => {
    it('should register expected number of commands', () => {
      const count = Object.keys(commandHandlers).length;
      
      // Should have ~600+ commands
      assert(count >= 500, `Expected 500+ commands, got ${count}`);
    });
  });
});
```

---

## Part 6: Backward Compatibility

### Step 6.1: Create Compatibility Layer

Create `websocket/commands/compatibility-exports.js`:

```javascript
/**
 * Backward Compatibility Layer
 * 
 * This module re-exports old command locations from new module locations
 * Allows existing code to work without modification during transition period
 */

const forensic = require('./forensic');
const evasion = require('./evasion');
const monitoring = require('./monitoring');
const browser = require('./browser');
const exportModule = require('./export');
const admin = require('./admin');

// Re-export from forensic module
const evidenceCommands = forensic;
const legalComplianceCommands = forensic;
const networkForensicsCommands = forensic;

// Re-export from evasion module
const evasionCommands = evasion;
const anonymityCommands = evasion;

// Re-export from monitoring module
const competitorMonitoringCommands = monitoring;
const changeDetectionCommands = monitoring;

// Re-export from browser module
const screenshotCommands = browser;
const sessionManagementCommands = browser;

// Re-export from export module
const exportFormatsCommands = exportModule;

// Re-export from admin module
const dashboardCommands = admin;

module.exports = {
  // Forensic (old paths)
  evidenceCommands,
  legalComplianceCommands,
  networkForensicsCommands,
  
  // Evasion (old paths)
  evasionCommands,
  anonymityCommands,
  
  // Monitoring (old paths)
  competitorMonitoringCommands,
  changeDetectionCommands,
  
  // Browser (old paths)
  screenshotCommands,
  sessionManagementCommands,
  
  // Export (old paths)
  exportFormatsCommands,
  
  // Admin (old paths)
  dashboardCommands,
  
  // New module exports
  forensic,
  evasion,
  monitoring,
  browser,
  export: exportModule,
  admin
};
```

---

## Part 7: Documentation Updates

### Step 7.1: Update API Reference

Update `docs/API-REFERENCE.md`:

```markdown
# WebSocket API Reference

## Command Categories

### Forensic Module
Legal compliance and evidence capture (140+ commands)

[Link to forensic/README.md]

- Evidence Capture (31 commands)
- Evidence Packaging (18 commands)
- Legal Compliance (6 commands)
- Network Forensics (26 commands)
- Session Tracking (3 commands)
- Screenshots (15 commands)
- And more...

### Evasion Module
Bot detection evasion (100+ commands)

[Link to evasion/README.md]

- Fingerprinting Evasion (35 commands)
- Detection Bypass (27 commands)
- Behavioral Anonymization (10 commands)
- Coherence Validation (19 commands)
- And more...

### Monitoring Module
Competitive intelligence (120+ commands)

[Link to monitoring/README.md]

- Competitor Monitoring (23 commands)
- Change Detection (9 commands)
- Analytics (11 commands)
- Metrics Collection (70 commands)

### Browser Module
Core browser automation (175+ commands)

[Link to browser/README.md]

- Screenshots (27 commands)
- Extraction (33 commands)
- Form Automation (10 commands)
- Session Management (79 commands)
- And more...

### Export Module
Data export/import (50+ commands)

- Formats (8 commands)
- Templates (13 commands)
- Encryption (8 commands)
- Batch Operations (21 commands)

### Admin Module
System administration (35+ commands)

- Dashboard (18 commands)
- Notifications (18 commands)
- Updates (10 commands)
```

---

## Part 8: Verification Checklist

### Pre-Migration
- [ ] All 56 command files reviewed and classified
- [ ] No commands identified as missing
- [ ] File mapping verified
- [ ] Consolidation plan approved

### During Migration
- [ ] Directory structure created
- [ ] Module index.js files created
- [ ] Command files moved/consolidated
- [ ] websocket/server.js imports updated
- [ ] Module README.md files created
- [ ] Backward compatibility layer created

### Post-Migration
- [ ] Unit tests passing (>95%)
- [ ] Integration tests passing
- [ ] No command conflicts detected
- [ ] Total command count verified (600+)
- [ ] WebSocket server starts without errors
- [ ] All forensic commands functional
- [ ] All evasion commands functional
- [ ] All monitoring commands functional
- [ ] All browser commands functional
- [ ] Backward compatibility verified
- [ ] Documentation updated

### Final Verification
- [ ] No code duplication (except intentional screenshot)
- [ ] Clear separation of concerns
- [ ] API contracts maintained
- [ ] Performance baseline established
- [ ] Load test passed (50-100 concurrent)
- [ ] Memory usage stable

---

## Part 9: Rollback Plan

If issues arise, rollback is simple:

```bash
# Restore old command files from git
git checkout websocket/commands/*.js

# Remove new directories
rm -rf websocket/commands/{forensic,evasion,monitoring,browser,export,admin}

# Restore original server.js imports
git checkout websocket/server.js

# Verify functionality
npm test
```

---

## Part 10: Timeline

| Week | Tasks | Status |
|---|---|---|
| 1 | Directory setup, module structure | Preparation |
| 2 | Forensic module migration | In Progress |
| 2 | Evasion module migration | In Progress |
| 2 | Monitoring/Browser/Export/Admin migration | In Progress |
| 3 | server.js integration, testing | Testing |
| 4 | Documentation, verification, optimization | Final |

---

## Conclusion

This guide provides all necessary steps to separate forensic from non-forensic features while maintaining backward compatibility and zero functionality loss.

**Key Success Metrics:**
- ✓ 56 files organized into 6 modules
- ✓ No code duplication (except screenshot)
- ✓ 600+ commands preserved
- ✓ Unit test pass rate > 95%
- ✓ Zero breaking changes for API consumers
- ✓ Clear documentation of each module's purpose

For questions or issues, refer to the companion documents:
- `FORENSIC-SEPARATION-PLAN.md` - Overall strategy
- `COMMAND-INVENTORY.md` - Complete command listing


# Basset Hound Browser - Cleanup Plan

**Version:** 1.0
**Date:** January 9, 2026
**Purpose:** Remove out-of-scope intelligence and investigation management features

---

## Executive Summary

This document outlines the removal of **8,296 lines** of out-of-scope code across **13 files**, transitioning basset-hound-browser from an intelligent OSINT platform to a **capability-focused browser automation tool**.

**Scope Reference:** `/home/devel/basset-hound-browser/docs/SCOPE.md`

**Key Changes:**
- Remove intelligence analysis (pattern detection, classification)
- Remove investigation management (workflow orchestration)
- Remove external system integration (basset-hound API)
- Keep forensic data capture (screenshots, metadata, OCR)
- Keep browser automation (navigation, interaction, extraction)
- Keep evasion capabilities (fingerprinting, behavioral AI)

---

## 1. Files to Delete Completely

### 1.1 Data Type Detection & Pattern Matching

**File:** `/home/devel/basset-hound-browser/extraction/data-type-detector.js`
**Lines:** ~800 lines
**Reason:** Pattern detection for emails, phones, crypto addresses is intelligence analysis (out of scope)

**What it does:**
- Detects OSINT-relevant data types (emails, phones, crypto addresses, social handles)
- Assigns confidence scores to detected patterns
- Classifies data by type and importance
- All of this is intelligence work, not browser capability

**Impact:**
- Breaks: `detect_data_types` WebSocket command
- Breaks: MCP tools `browser_detect_data_types`, `browser_get_osint_data_types`
- Breaks: Ingestion commands that depend on detection

**Migration:**
- AI agents should implement pattern detection in their own layer
- Use `browser_get_content()` to get raw page text
- Run pattern matching in agent code (not browser)

---

### 1.2 Data Ingestion & Queue Management

**File:** `/home/devel/basset-hound-browser/extraction/ingestion-processor.js`
**Lines:** ~600 lines
**Reason:** Deciding what data to ingest and transforming it for external systems is out of scope

**What it does:**
- Ingestion modes (automatic, selective, filtered)
- Deduplication tracking across sessions
- Queue management for detected items
- Transformation to basset-hound orphan format
- All decision-making about what data matters

**Impact:**
- Breaks: All ingestion WebSocket commands (14 commands)
- Breaks: MCP tools `browser_ingest_selected`, `browser_get_ingestion_stats`
- Breaks: Integration with basset-hound platform

**Migration:**
- Agents receive raw extracted data
- Agents decide what to keep/store
- Agents manage their own queues and deduplication
- Agents transform data for their storage systems

---

### 1.3 Sock Puppet External Integration

**File:** `/home/devel/basset-hound-browser/profiles/sock-puppet-integration.js`
**Lines:** ~1,200 lines
**Reason:** Fetching identities from external systems and managing fake personas is out of scope

**What it does:**
- Fetches sock puppet entities from basset-hound API
- Syncs activity logs to external database
- Manages credential storage in external system
- Tracks which investigation a sock puppet is used for
- Integration with external identity management

**Impact:**
- Breaks: All sock puppet WebSocket commands (16 commands)
- Breaks: MCP tools for sock puppet management
- Breaks: Session tracking and activity logging

**Migration:**
- Agents store sock puppet data in their own systems
- Use `browser_create_profile()` with explicit credentials
- Use `browser_fill()` with provided credentials (no fetching)
- Agents manage activity tracking separately

**What to Keep:**
- Browser profile management (profiles/manager.js)
- Profile switching and fingerprint application
- Credential filling (when credentials are provided by agent)

---

### 1.4 Investigation Workflow Management

**File:** `/home/devel/basset-hound-browser/websocket/commands/osint-commands.js`
**Lines:** ~1,095 lines
**Reason:** Managing investigation lifecycle, deciding where to navigate next, and tracking cases is out of scope

**What it does:**
- Creates investigations with depth limits and URL patterns
- Queues URLs for future investigation
- Decides which links to follow based on patterns
- Tracks visited pages across investigation
- Manages investigation state and lifecycle
- All workflow orchestration

**Impact:**
- Breaks: 18 OSINT investigation commands
- Breaks: Investigation queue management
- Breaks: Link following automation
- Breaks: MCP investigation tools

**Migration:**
- Agents create their own investigation structures
- Agents decide what pages to visit next
- Use `browser_navigate()` for each page agent decides to visit
- Use `browser_extract_links()` to get raw links, agent decides which to follow
- Agents maintain their own visited URL tracking

**What to Keep:**
- Raw link extraction (`browser_extract_links()`)
- Raw data extraction without classification
- Navigation commands (agent-directed)

---

### 1.5 Evidence Package Management

**File:** `/home/devel/basset-hound-browser/evidence/evidence-collector.js`
**Lines:** ~900 lines (PARTIAL - keep forensic capture, remove package management)
**Reason:** Organizing evidence into investigations and creating case packages is out of scope

**What to Remove:**
- Evidence package creation and management
- Investigation ID tracking
- Case number association
- Package sealing and verification
- Court export bundling
- All investigation organization

**What to Keep:**
- Screenshot capture with SHA-256 hash
- MHTML/HTML/PDF archive creation
- HAR network capture
- Image EXIF/GPS metadata extraction
- OCR text extraction from images
- Timestamp and hash for chain of custody

**Impact:**
- Breaks: Evidence package management commands (10 commands)
- Breaks: Court export functionality
- Breaks: Investigation-evidence linking

**Migration:**
- Agents capture individual pieces of evidence
- Each screenshot/archive returns with hash and timestamp
- Agents organize evidence in their own systems
- Agents create investigation packages in their layer

---

### 1.6 WebSocket Command Files (Complete Removal)

**File:** `/home/devel/basset-hound-browser/websocket/commands/ingestion-commands.js`
**Lines:** ~624 lines
**Reason:** All ingestion commands are out of scope

**Commands to Remove (14):**
- `detect_data_types`
- `configure_ingestion`
- `get_ingestion_config`
- `process_page_for_ingestion`
- `ingest_selected`
- `ingest_all`
- `get_ingestion_queue`
- `clear_ingestion_queue`
- `remove_from_ingestion_queue`
- `get_ingestion_history`
- `get_ingestion_stats`
- `get_detection_types`
- `export_detections`
- `set_ingestion_mode`
- `reset_ingestion_stats`
- `add_detection_pattern`
- `remove_detection_pattern`

---

**File:** `/home/devel/basset-hound-browser/websocket/commands/sock-puppet-commands.js`
**Lines:** ~621 lines
**Reason:** External system integration is out of scope

**Commands to Remove (16):**
- `list_sock_puppets`
- `get_sock_puppet`
- `link_profile_to_sock_puppet`
- `unlink_profile_from_sock_puppet`
- `create_profile_from_sock_puppet`
- `get_linked_sock_puppet`
- `get_sock_puppet_credentials`
- `fill_form_with_sock_puppet`
- `start_sock_puppet_session`
- `end_sock_puppet_session`
- `log_sock_puppet_activity`
- `get_sock_puppet_activity_log`
- `sync_fingerprint_from_sock_puppet`
- `validate_sock_puppet_fingerprint`
- `get_sock_puppet_stats`
- `get_sock_puppet_credential_fields`
- `get_sock_puppet_activity_types`

---

**File:** `/home/devel/basset-hound-browser/websocket/commands/osint-commands.js`
**Lines:** ~1,095 lines
**Reason:** Investigation management and pattern detection are out of scope

**Commands to Remove (18):**
- `create_investigation`
- `get_investigation`
- `list_investigations`
- `set_active_investigation`
- `complete_investigation`
- `export_investigation`
- `extract_osint_data`
- `get_osint_data_types`
- `queue_investigation_url`
- `get_investigation_queue`
- `get_next_investigation_url`
- `investigate_links`
- `get_investigation_findings`
- `get_findings_summary`
- `prepare_for_basset_hound`
- `investigate_page`

---

## 2. Files to Refactor (Keep Parts)

### 2.1 Evidence Collection (Partial Removal)

**File:** `/home/devel/basset-hound-browser/websocket/commands/evidence-commands.js`
**Current Lines:** ~784 lines
**After Cleanup:** ~400 lines

**Remove:**
- Package management commands (10 commands):
  - `create_evidence_package`
  - `get_evidence_package`
  - `list_evidence_packages`
  - `set_active_evidence_package`
  - `add_package_annotation`
  - `seal_evidence_package`
  - `verify_evidence_package`
  - `get_evidence`
  - `get_evidence_summary`
  - `verify_evidence`
  - `export_for_court`
  - `export_evidence_package`
  - `get_evidence_stats`

**Keep:**
- Forensic capture commands (9 commands):
  - `capture_screenshot_evidence` → rename to `screenshot_with_hash`
  - `capture_page_archive_evidence` → rename to `save_page_archive`
  - `capture_har_evidence` → rename to `export_har`
  - `capture_dom_evidence` → rename to `save_dom_snapshot`
  - `capture_console_evidence` → rename to `save_console_logs`
  - `capture_cookies_evidence` → rename to `export_cookies`
  - `capture_storage_evidence` → rename to `export_local_storage`

**Refactor Strategy:**
1. Remove EvidencePackage class and package management
2. Keep Evidence class for individual captures
3. Each capture returns: `{ hash, timestamp, data, type }`
4. Remove investigation ID and case number tracking
5. Simplify to pure forensic capture without organization

---

### 2.2 Image Metadata Extraction (Keep)

**File:** `/home/devel/basset-hound-browser/extraction/image-metadata-extractor.js`
**Action:** KEEP AS-IS
**Reason:** Raw forensic metadata extraction is in scope

**What it does (all in scope):**
- EXIF data extraction
- IPTC metadata extraction
- XMP metadata extraction
- GPS coordinate extraction
- Camera information extraction
- All raw, unprocessed data

**WebSocket Commands to Keep:**
- `extract_image_metadata`
- `extract_image_text` (OCR)
- `extract_page_images`

**MCP Tools to Keep:**
- `browser_extract_image_metadata`
- `browser_extract_image_text`
- `browser_get_page_images_with_metadata`

---

### 2.3 Extraction Index (Simplify)

**File:** `/home/devel/basset-hound-browser/extraction/index.js`
**Current:** Exports all extraction modules
**After Cleanup:** Export only in-scope modules

**Remove Exports:**
- `DataTypeDetector`
- `IngestionProcessor`
- `INGESTION_MODES`
- `DETECTION_PATTERNS`

**Keep Exports:**
- `ImageMetadataExtractor`
- `ExtractionManager` (for basic page extraction)

---

### 2.4 MCP Server (Major Refactor)

**File:** `/home/devel/basset-hound-browser/mcp/server.py`
**Current Tools:** 88 tools
**After Cleanup:** 58 tools
**Lines:** 1,922 lines → ~1,200 lines

**Remove Tool Categories:**

**A. Data Detection & Ingestion (3 tools):**
- `browser_detect_data_types`
- `browser_ingest_selected`
- `browser_get_ingestion_stats`

**B. Sock Puppet Tools (10 tools):**
- `browser_list_sock_puppets`
- `browser_get_sock_puppet`
- `browser_link_profile_to_sock_puppet`
- `browser_create_profile_from_sock_puppet`
- `browser_fill_form_with_sock_puppet`
- `browser_start_sock_puppet_session`
- `browser_end_sock_puppet_session`
- `browser_get_sock_puppet_activity_log`
- `browser_validate_sock_puppet_fingerprint`
- `browser_get_sock_puppet_stats`

**C. Investigation Tools (17 tools):**
- `browser_create_investigation`
- `browser_extract_osint_data`
- `browser_investigate_page`
- `browser_investigate_links`
- `browser_get_next_investigation_url`
- `browser_get_investigation_findings`
- `browser_get_findings_summary`
- `browser_prepare_for_basset_hound`
- `browser_complete_investigation`
- `browser_export_investigation`
- `browser_list_investigations`
- `browser_get_osint_data_types`

**D. Evidence Package Tools (Partial - 5 tools):**
- `browser_create_evidence_package`
- `browser_seal_evidence_package`
- `browser_verify_evidence_package`
- `browser_export_evidence_for_court`
- `browser_list_evidence_packages`
- `browser_add_evidence_annotation`

**Keep Tool Categories:**

**Navigation (8 tools):** All kept
**Interaction (6 tools):** All kept
**Content Extraction (6 tools):** All kept
**Screenshots (1 tool):** Keep
**Wait Tools (2 tools):** All kept
**JavaScript (1 tool):** Keep
**Cookies (3 tools):** All kept
**Profiles (3 tools):** All kept
**Proxy/Tor (3 tools):** All kept
**Image Forensics (3 tools):** All kept
**Network Capture (3 tools):** All kept
**Tech Detection (1 tool):** Keep
**Fingerprints (4 tools):** All kept
**Behavioral AI (5 tools):** All kept

**Refactor Evidence Tools (Keep simplified versions - 3 tools):**
- `browser_screenshot` (returns hash + timestamp)
- `browser_save_page_archive` (returns hash + timestamp)
- `browser_export_har` (returns hash + timestamp)

---

## 3. MCP Server Cleanup Summary

### Before Cleanup
```python
# 88 total tools across categories:
# - 8 Navigation
# - 6 Interaction
# - 6 Content Extraction
# - 1 Screenshots
# - 2 Wait
# - 1 JavaScript
# - 3 Cookies
# - 3 Profiles
# - 3 Proxy/Tor
# - 3 Data Detection ❌
# - 3 Image Analysis ✓
# - 1 Tech Detection
# - 3 Network
# - 10 Sock Puppets ❌
# - 4 Fingerprints
# - 5 Behavioral AI
# - 9 Evidence (partial) ❌
# - 17 OSINT/Investigation ❌
```

### After Cleanup
```python
# 58 total tools (30 removed):
# - 8 Navigation ✓
# - 6 Interaction ✓
# - 6 Content Extraction ✓
# - 1 Screenshots ✓
# - 2 Wait ✓
# - 1 JavaScript ✓
# - 3 Cookies ✓
# - 3 Profiles ✓
# - 3 Proxy/Tor ✓
# - 3 Image Forensics ✓
# - 1 Tech Detection ✓
# - 3 Network ✓
# - 4 Fingerprints ✓
# - 5 Behavioral AI ✓
# - 3 Evidence Capture (simplified) ✓
# - 6 Form/Page State ✓
```

**Removed:** 30 out-of-scope tools
**Kept:** 58 capability-focused tools

---

## 4. WebSocket Command Cleanup

### Command File Summary

| File | Commands | Action |
|------|----------|--------|
| `ingestion-commands.js` | 14 | **DELETE** |
| `sock-puppet-commands.js` | 16 | **DELETE** |
| `osint-commands.js` | 18 | **DELETE** |
| `evidence-commands.js` | 22 → 9 | **REFACTOR** |
| `image-commands.js` | 8 | **KEEP** |
| `evasion-commands.js` | ~20 | **KEEP** |

### Total Command Impact
- **Before:** ~98 WebSocket commands
- **After:** ~57 WebSocket commands
- **Removed:** 41 commands (42% reduction)

---

## 5. Test Cleanup

### 5.1 Test Files to Delete

**Files:**
```
tests/unit/extraction/data-type-detector.test.js
tests/unit/extraction/ingestion-processor.test.js
tests/unit/profiles/sock-puppet-integration.test.js
tests/integration/osint/investigation-workflow.test.js
tests/integration/osint/data-extraction.test.js
tests/integration/evidence/package-management.test.js
```

### 5.2 Test Files to Update

**File:** `tests/integration/evidence/evidence-collection.test.js`
**Changes:**
- Remove package management tests
- Keep individual capture tests (screenshot, HAR, etc.)
- Update to test simplified API

**File:** `tests/e2e/full-workflow.test.js`
**Changes:**
- Remove investigation workflow tests
- Remove sock puppet integration tests
- Keep browser automation tests
- Keep forensic capture tests

### 5.3 Test Coverage After Cleanup

Keep tests for:
- Browser navigation and interaction
- Form filling with provided credentials
- Screenshot capture with hashing
- Network capture (HAR)
- Image metadata extraction
- OCR text extraction
- Cookie/storage extraction
- Profile management
- Fingerprint application
- Behavioral AI (mouse paths, typing)
- Proxy and Tor management

---

## 6. Migration Guide

### 6.1 For AI Agents (palletai)

**Investigation Management:**

**Before (browser-managed):**
```javascript
// Browser managed investigation state
await browser.create_investigation({
  name: "Target Investigation",
  maxDepth: 3,
  patterns: [".*target\\.com.*"]
});

await browser.investigate_page();
let next = await browser.get_next_investigation_url();
await browser.navigate(next.url);
```

**After (agent-managed):**
```javascript
// Agent manages investigation state
const investigation = {
  id: "inv_123",
  visited: new Set(),
  queue: [],
  findings: []
};

// Agent decides where to navigate
await browser.navigate("https://target.com");

// Agent extracts raw data
const content = await browser.get_content();
const links = await browser.extract_links();

// Agent does pattern matching
const emails = findEmails(content.text);
investigation.findings.push(...emails);

// Agent decides which links to follow
const nextUrl = chooseNextLink(links, investigation);
await browser.navigate(nextUrl);
```

---

**Pattern Detection:**

**Before (browser-detected):**
```javascript
// Browser detected patterns
const detected = await browser.detect_data_types({
  types: ["email", "phone", "crypto_btc"],
  confidence_threshold: 0.7
});

await browser.ingest_selected(detected.items.map(i => i.id));
```

**After (agent-detected):**
```javascript
// Agent does pattern detection
const content = await browser.get_content();

const emails = content.text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/g);
const phones = content.text.match(/\d{3}-\d{3}-\d{4}/g);

// Agent decides what to store
for (const email of emails) {
  await storage.saveEntity({
    type: "email",
    value: email,
    source: content.url
  });
}
```

---

**Sock Puppet Management:**

**Before (browser fetched credentials):**
```javascript
// Browser fetched from basset-hound
const sockPuppet = await browser.get_sock_puppet("sp_123");
await browser.link_profile_to_sock_puppet("profile_1", "sp_123");
await browser.fill_form_with_sock_puppet({
  "#email": "email",
  "#password": "password"
});
```

**After (agent provides credentials):**
```javascript
// Agent fetches from its own storage
const sockPuppet = await myStorage.getSockPuppet("sp_123");

// Create browser profile with explicit config
await browser.create_profile({
  profile_name: sockPuppet.name,
  fingerprint_config: sockPuppet.fingerprint
});

// Fill form with explicit credentials
await browser.fill("#email", sockPuppet.credentials.email);
await browser.fill("#password", sockPuppet.credentials.password);
```

---

**Evidence Collection:**

**Before (browser organized evidence):**
```javascript
// Browser managed evidence packages
await browser.create_evidence_package({
  name: "Investigation Evidence",
  investigationId: "inv_123",
  caseNumber: "CASE-2026-001"
});

await browser.capture_screenshot_evidence({ url, title });
await browser.capture_har_evidence({ url });

await browser.seal_evidence_package("inv_123");
const courtExport = await browser.export_evidence_for_court("inv_123");
```

**After (agent organizes evidence):**
```javascript
// Agent creates its own evidence structure
const evidencePackage = {
  id: "pkg_123",
  investigationId: "inv_123",
  items: []
};

// Browser returns raw forensic captures
const screenshot = await browser.screenshot({ full_page: true });
evidencePackage.items.push({
  type: "screenshot",
  hash: screenshot.sha256,
  timestamp: screenshot.timestamp,
  data: screenshot.data
});

const har = await browser.export_har();
evidencePackage.items.push({
  type: "har",
  hash: computeHash(har.data),
  timestamp: har.timestamp,
  data: har.data
});

// Agent seals and exports in its format
await myStorage.saveEvidencePackage(evidencePackage);
```

---

### 6.2 For Browser Extension Users

**Impact:** Minimal - extensions primarily use basic automation commands

**Changes:**
- Can no longer use investigation commands
- Can no longer use sock puppet integration
- Still have all automation capabilities
- Still have all forensic capture capabilities

**Migration:**
- Implement investigation tracking in extension
- Store sock puppet data in extension storage
- Use browser for automation + capture only

---

### 6.3 For Python Client Users

**File:** `clients/python/basset_hound/ingestion.py`
**Action:** **DELETE** (entire file is out of scope)

**Migration:**
```python
# Before
from basset_hound import BrowserClient
client = BrowserClient()

# Out of scope - remove
detected = client.detect_data_types()
client.ingest_selected(["item1", "item2"])

# After - implement in your code
content = client.get_content()
emails = re.findall(r'[^\s@]+@[^\s@]+\.[^\s@]+', content['text'])

for email in emails:
    your_storage.save({"type": "email", "value": email})
```

---

## 7. Breaking Changes

### 7.1 Version Bump Recommendation

**Current Version:** 8.2.4
**Proposed Version:** 10.0.0

**Reasoning:**
- Major breaking changes to API
- Removal of 42% of commands
- Fundamental architectural shift
- Incompatible with previous workflows

**Semantic Versioning:**
- Major version bump (8 → 10) for breaking changes
- Skip version 9 to signal major transition
- Clean slate for capability-focused architecture

---

### 7.2 API Compatibility

**Removed Capabilities:**
- ❌ Pattern detection and classification
- ❌ Investigation workflow management
- ❌ Evidence package organization
- ❌ Sock puppet external integration
- ❌ Data ingestion and transformation
- ❌ basset-hound API integration

**Retained Capabilities:**
- ✅ Browser automation (navigation, interaction)
- ✅ Raw data extraction (content, links, forms)
- ✅ Forensic capture (screenshots, archives, HAR)
- ✅ Image metadata extraction (EXIF, GPS, OCR)
- ✅ Bot detection evasion (fingerprinting, behavioral AI)
- ✅ Network capabilities (Tor, proxies)
- ✅ Profile management (isolated sessions)

---

### 7.3 Configuration Changes

**Remove from config files:**
```yaml
# Remove these sections from config
ingestion:
  mode: automatic
  enabled_types: [...]

basset_hound:
  api_url: "http://localhost:3000"
  api_key: "..."

investigations:
  default_depth: 2
  default_delay_ms: 1000
```

**Keep in config:**
```yaml
# Keep these sections
browser:
  headless: false
  user_data_dir: "./profiles"

evasion:
  fingerprint_profiles: true
  behavioral_ai: true

network:
  tor_enabled: false
  proxy_rotation: false
```

---

## 8. Refactoring Steps

### Phase 1: Preparation (Day 1)
1. Create feature branch: `feature/scope-cleanup-v10`
2. Back up current codebase
3. Create deprecation notices for removed commands
4. Document all breaking changes

### Phase 2: File Deletion (Day 1-2)
1. Delete complete files:
   - `extraction/data-type-detector.js`
   - `extraction/ingestion-processor.js`
   - `profiles/sock-puppet-integration.js`
   - `websocket/commands/ingestion-commands.js`
   - `websocket/commands/sock-puppet-commands.js`
   - `websocket/commands/osint-commands.js`
   - `clients/python/basset_hound/ingestion.py`

2. Delete test files:
   - All corresponding test files for deleted modules

### Phase 3: Refactoring (Day 2-3)
1. Refactor `evidence/evidence-collector.js`:
   - Remove EvidencePackage class
   - Remove package management
   - Keep forensic capture methods
   - Simplify to return individual captures

2. Refactor `websocket/commands/evidence-commands.js`:
   - Remove package commands
   - Simplify capture commands
   - Rename for clarity

3. Refactor `extraction/index.js`:
   - Remove out-of-scope exports
   - Update module documentation

4. Refactor `mcp/server.py`:
   - Remove 30 out-of-scope tools
   - Update tool count in main()
   - Update documentation

### Phase 4: Integration Cleanup (Day 3-4)
1. Update `websocket/server.js`:
   - Remove command file registrations
   - Update command count

2. Update `main.js`:
   - Remove module initializations
   - Clean up event handlers

3. Update package.json:
   - Remove unused dependencies
   - Update version to 10.0.0

### Phase 5: Documentation (Day 4-5)
1. Update README.md:
   - New feature list
   - Remove out-of-scope examples
   - Add migration guide link

2. Update ROADMAP.md:
   - Mark removed phases as deprecated
   - Update future plans

3. Create MIGRATION.md:
   - Detailed migration examples
   - Agent implementation patterns
   - Code comparison examples

### Phase 6: Testing (Day 5-6)
1. Update test suite:
   - Remove out-of-scope tests
   - Update integration tests
   - Verify all kept features work

2. Manual testing:
   - Test all remaining MCP tools
   - Test all remaining WebSocket commands
   - Verify forensic capture integrity

### Phase 7: Release (Day 6-7)
1. Create changelog for v10.0.0
2. Update version numbers
3. Create GitHub release
4. Notify users of breaking changes

---

## 9. Impact Analysis

### 9.1 Code Reduction

| Category | Before | After | Reduction |
|----------|--------|-------|-----------|
| Lines of Code | ~45,000 | ~36,700 | 18% |
| WebSocket Commands | 98 | 57 | 42% |
| MCP Tools | 88 | 58 | 34% |
| Modules | 85+ | 72 | 15% |
| Out-of-Scope Code | 8,296 | 0 | 100% |

### 9.2 Maintenance Impact

**Benefits:**
- Smaller, more focused codebase
- Clearer architectural boundaries
- Easier to test and debug
- Reduced dependencies on external systems
- Better separation of concerns

**Costs:**
- Breaking changes for existing users
- Migration effort for agents
- Documentation updates required
- User communication needed

---

## 10. Risk Assessment

### 10.1 High Risk Areas

**1. MCP Server Compatibility**
- Risk: Agents using removed tools will break
- Mitigation: Clear deprecation notices, migration guide
- Timeline: Give 30-day notice before removal

**2. Python Client Users**
- Risk: Ingestion module users will break
- Mitigation: Update Python client with migration examples
- Timeline: Release updated client with v10.0.0

**3. Integration Testing**
- Risk: Missed dependencies on removed code
- Mitigation: Comprehensive test suite run before release
- Timeline: Full test pass before merging

### 10.2 Medium Risk Areas

**1. Evidence Collection**
- Risk: Users relying on package management
- Mitigation: Provide agent-side package management examples
- Timeline: Include in migration guide

**2. Configuration Files**
- Risk: Old config files with removed sections
- Mitigation: Config validation with warnings
- Timeline: Add validation in v10.0.0

### 10.3 Low Risk Areas

**1. Image Metadata Extraction**
- Risk: Minimal - staying as-is
- Mitigation: None needed

**2. Browser Automation**
- Risk: Minimal - core features unchanged
- Mitigation: None needed

---

## 11. Success Criteria

### 11.1 Technical Goals

- [ ] All identified files deleted or refactored
- [ ] No references to removed modules in codebase
- [ ] All tests pass after cleanup
- [ ] MCP server starts successfully
- [ ] WebSocket server registers remaining commands
- [ ] Zero out-of-scope code in codebase

### 11.2 Quality Goals

- [ ] Test coverage maintained at 50%+
- [ ] All remaining features fully functional
- [ ] Documentation updated and accurate
- [ ] Migration guide complete with examples
- [ ] Performance maintained or improved

### 11.3 User Experience Goals

- [ ] Clear error messages for removed commands
- [ ] Migration examples for all removed features
- [ ] Deprecation notices in v9.x releases
- [ ] Updated API documentation
- [ ] Example code for agent implementations

---

## 12. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Preparation | 1 day | Branch, backup, deprecation notices |
| File Deletion | 1-2 days | Remove 6 complete files |
| Refactoring | 2-3 days | Update 4 files |
| Integration | 1-2 days | Update main.js, websocket/server.js |
| Documentation | 1-2 days | README, MIGRATION, CHANGELOG |
| Testing | 1-2 days | Full test suite, manual testing |
| Release | 1 day | Version bump, GitHub release |
| **Total** | **7-12 days** | Version 10.0.0 release |

---

## 13. Post-Cleanup Validation

### 13.1 Verification Checklist

**Code Cleanup:**
- [ ] No imports of deleted modules
- [ ] No references to removed functions
- [ ] No dead code from removed features
- [ ] All command registrations updated
- [ ] All tool registrations updated

**Functionality:**
- [ ] Browser launches successfully
- [ ] WebSocket server accepts connections
- [ ] MCP server lists correct tool count
- [ ] Screenshot capture works with hash
- [ ] Image metadata extraction works
- [ ] OCR extraction works
- [ ] Tor/proxy functionality works
- [ ] Profile management works
- [ ] Fingerprint application works
- [ ] Behavioral AI works

**Documentation:**
- [ ] README reflects new scope
- [ ] SCOPE.md is accurate
- [ ] API docs match implementation
- [ ] Migration guide is complete
- [ ] Examples work as documented

---

## 14. Rollback Plan

### 14.1 If Critical Issues Arise

**Option 1: Revert to v8.2.4**
- Keep current version available on `stable-v8` branch
- Users can downgrade if needed
- Maintain for 90 days after v10 release

**Option 2: Hotfix in v10.x**
- If minor issues, create v10.0.1 hotfix
- Fix broken functionality
- Release within 48 hours

**Option 3: Feature Flag System**
- Add `--legacy-mode` flag to re-enable removed features
- Allow gradual migration
- Remove in v11.0.0

### 14.2 Communication Plan

**Before Release (30 days):**
- Blog post announcing v10.0.0 changes
- Email to known users
- GitHub discussion thread
- Deprecation warnings in v9.x

**At Release:**
- Detailed changelog
- Migration guide
- Video tutorial (optional)
- Discord/Slack announcements

**After Release (90 days):**
- Support for migration questions
- Example code updates
- Community feedback incorporation

---

## 15. Next Steps

### Immediate Actions
1. **Review this plan** with development team
2. **Get approval** for version 10.0.0 breaking changes
3. **Create feature branch** `feature/scope-cleanup-v10`
4. **Start Phase 1** (Preparation)

### Future Considerations
1. **Version 10.1.0:** Add new in-scope features based on user feedback
2. **Version 10.2.0:** Performance optimizations
3. **Version 11.0.0:** Consider removing deprecated compatibility layers

---

## Appendix A: Complete File Deletion List

```
/home/devel/basset-hound-browser/extraction/data-type-detector.js
/home/devel/basset-hound-browser/extraction/ingestion-processor.js
/home/devel/basset-hound-browser/profiles/sock-puppet-integration.js
/home/devel/basset-hound-browser/websocket/commands/ingestion-commands.js
/home/devel/basset-hound-browser/websocket/commands/sock-puppet-commands.js
/home/devel/basset-hound-browser/websocket/commands/osint-commands.js
/home/devel/basset-hound-browser/clients/python/basset_hound/ingestion.py
/home/devel/basset-hound-browser/tests/unit/extraction/data-type-detector.test.js
/home/devel/basset-hound-browser/tests/unit/extraction/ingestion-processor.test.js
/home/devel/basset-hound-browser/tests/unit/profiles/sock-puppet-integration.test.js
/home/devel/basset-hound-browser/tests/integration/osint/investigation-workflow.test.js
/home/devel/basset-hound-browser/tests/integration/osint/data-extraction.test.js
/home/devel/basset-hound-browser/tests/integration/evidence/package-management.test.js
```

**Total Files to Delete:** 13
**Total Lines to Delete:** ~8,296

---

## Appendix B: Command Removal Summary

### WebSocket Commands Removed: 48

**Ingestion (14):**
- detect_data_types, configure_ingestion, get_ingestion_config, process_page_for_ingestion, ingest_selected, ingest_all, get_ingestion_queue, clear_ingestion_queue, remove_from_ingestion_queue, get_ingestion_history, get_ingestion_stats, get_detection_types, export_detections, set_ingestion_mode

**Sock Puppet (16):**
- list_sock_puppets, get_sock_puppet, link_profile_to_sock_puppet, unlink_profile_from_sock_puppet, create_profile_from_sock_puppet, get_linked_sock_puppet, get_sock_puppet_credentials, fill_form_with_sock_puppet, start_sock_puppet_session, end_sock_puppet_session, log_sock_puppet_activity, get_sock_puppet_activity_log, sync_fingerprint_from_sock_puppet, validate_sock_puppet_fingerprint, get_sock_puppet_stats, get_sock_puppet_credential_fields

**OSINT Investigation (18):**
- create_investigation, get_investigation, list_investigations, set_active_investigation, complete_investigation, export_investigation, extract_osint_data, get_osint_data_types, queue_investigation_url, get_investigation_queue, get_next_investigation_url, investigate_links, get_investigation_findings, get_findings_summary, prepare_for_basset_hound, investigate_page

### MCP Tools Removed: 30

(Same categories as WebSocket commands above)

---

## Appendix C: Retained Capabilities Reference

### Core Browser Automation ✓
- Navigation (navigate, go_back, go_forward, reload)
- Clicking (click, hover)
- Form filling (fill, type, select)
- Scrolling (scroll)
- Waiting (wait_for_element, wait_for_navigation)
- JavaScript execution (execute_script)

### Data Extraction ✓
- Page content (get_content, get_text, get_attribute)
- Page state (get_page_state, get_url, get_title)
- Links (extract_links)
- Forms (extract_forms)
- Images (extract_images)
- Metadata (extract_metadata)

### Forensic Capture ✓
- Screenshots with SHA-256 hash
- Page archives (MHTML, HTML, PDF)
- Network HAR capture
- Image EXIF/GPS metadata
- OCR text extraction
- Console logs
- Cookies and storage

### Evasion & Privacy ✓
- Fingerprint profiles (create, apply, validate)
- Behavioral AI (mouse paths, typing patterns)
- Honeypot detection
- Rate limiting
- User-Agent rotation
- Canvas/WebGL spoofing

### Network ✓
- Tor integration (circuits, exit nodes)
- Proxy support (HTTP, SOCKS)
- Network capture (HAR)
- Request/response inspection

### Profile Management ✓
- Create/switch profiles
- Isolated sessions
- Fingerprint application
- Cookie management per profile

---

*End of Cleanup Plan*

# basset-hound Integration Requirements for basset-hound-browser

**Date:** 2026-01-08
**Source:** basset-hound Phase 41 Research
**Status:** Integration Planning

---

## Overview

This document outlines integration requirements between basset-hound-browser (Electron) and basset-hound MCP server. It was generated during basset-hound Phase 41 development to bridge the gap between repositories.

**Key Principle:** basset-hound-browser captures evidence and provides browser automation. basset-hound stores evidence with chain of custody, manages investigations, and provides entity data.

---

## 1. Current basset-hound-browser Capabilities

### Evidence Collection (Phase 18 - Complete)
- **EvidenceCollector class** with chain of custody
- Multiple evidence types: screenshot, page_archive, network_har, dom_snapshot, console_log
- Archive formats: MHTML, HTML, WARC
- SHA-256 hashing and integrity verification
- Package sealing for court export

### MCP Server (Phase 15 - Complete)
- **40 MCP tools** exposed via FastMCP
- WebSocket connection to browser on port 8765
- Navigation, interaction, content extraction, screenshots

### Screenshot Capabilities
- Viewport capture
- Full-page scroll-and-stitch (max 32KB)
- Element-specific capture
- Area-based coordinate capture
- PNG/JPEG/WebP formats

### Metadata Extraction
- Open Graph, Twitter Cards
- JSON-LD structured data
- Microdata, RDFa
- Technology stack fingerprinting

---

## 2. Available basset-hound MCP Tools

### Evidence Storage Tools (Phase 41 - Coming)

| Tool | Description |
|------|-------------|
| `capture_evidence` | Store browser-captured evidence |
| `create_warc_record` | Store WARC archives |
| `get_evidence` | Retrieve stored evidence |
| `list_evidence` | List evidence for investigation |
| `verify_evidence_integrity` | Check SHA-256 hashes |
| `export_evidence_package` | Generate court-ready package |

### Investigation Context Tools (Phase 40.6 - Available)

| Tool | Description |
|------|-------------|
| `get_investigation` | Get investigation details |
| `get_investigation_context` | Context for browser decisions |
| `list_investigation_subjects` | Known subjects to highlight |
| `log_investigation_activity` | Log browser activity |

### Entity Tools (99 tools - Available)

| Tool | Description |
|------|-------------|
| `get_entity` | Get entity by ID |
| `query_entities` | Query entities with filters |
| `create_orphan` | Store unlinked identifier |
| `verify_identifier` | Validate identifier format |

---

## 3. Integration Tasks for basset-hound-browser

### HIGH PRIORITY

#### Task 1: Direct Evidence Submission

**Goal:** Submit evidence packages directly to basset-hound

**Implementation:**
```javascript
// In evidence/evidence-collector.js

async function submitToBassetHound(evidencePackage, bastsetUrl, investigationId) {
    const mcpClient = new BassetHoundMCPClient(bastsetUrl);

    // For each evidence in package
    for (const evidence of evidencePackage.evidence) {
        const result = await mcpClient.executeTool('capture_evidence', {
            project_id: evidencePackage.projectId,
            investigation_id: investigationId,
            evidence_type: evidence.type,
            content_base64: Buffer.from(evidence.content).toString('base64'),
            url: evidence.metadata.url,
            metadata: evidence.metadata,
            captured_by: 'basset-hound-browser'
        });

        // Store returned evidence_id for tracking
        evidence.bassetHoundId = result.evidence_id;
        evidence.sha256Verified = (result.sha256 === evidence.hash);
    }

    return evidencePackage;
}
```

**WebSocket Command:**
```javascript
// Add to websocket/commands/evidence-commands.js

async function handleSubmitToBasset(params) {
    const {packageId, bastsetUrl, investigationId} = params;
    const package = evidenceCollector.getPackage(packageId);

    const result = await submitToBassetHound(package, bastsetUrl, investigationId);

    return {
        success: true,
        evidenceIds: package.evidence.map(e => e.bassetHoundId),
        verified: package.evidence.every(e => e.sha256Verified)
    };
}
```

**Add to Roadmap:** Phase 19 - Direct Evidence Submission

#### Task 2: WARC Archive Submission

**Goal:** Store WARC archives in basset-hound

**Implementation:**
```javascript
// In evidence/evidence-collector.js

async function submitWARCToBassetHound(warcPath, url, bastsetUrl, investigationId) {
    const warcContent = fs.readFileSync(warcPath);
    const warcBase64 = warcContent.toString('base64');

    const mcpClient = new BassetHoundMCPClient(bastsetUrl);
    const result = await mcpClient.executeTool('create_warc_record', {
        project_id: currentProjectId,
        investigation_id: investigationId,
        warc_content: warcBase64,
        url: url,
        warc_type: 'response'
    });

    return result;
}
```

**Add to Roadmap:** Phase 19

### MEDIUM PRIORITY

#### Task 3: Investigation Context Resource

**Goal:** Expose investigation context as MCP resource

**Implementation:**
```python
# In mcp/server.py

@mcp.resource
async def investigation_context(investigation_id: str) -> str:
    """
    Get current investigation context from basset-hound.

    This resource provides context for LLM decision-making:
    - Known subjects and their roles
    - Recent activity
    - Target URLs to investigate
    - Known entities to highlight
    """
    # Call basset-hound MCP
    bh_client = BassetHoundMCPClient()
    context = await bh_client.get_investigation_context(
        investigation_id=investigation_id,
        include_subjects=True,
        include_recent_activity=True
    )

    return json.dumps(context, indent=2)
```

**Add to Roadmap:** Phase 20 - Investigation Context Resource

#### Task 4: Real-Time Entity Highlighting

**Goal:** Highlight known entities on page as browser navigates

**Implementation:**
```javascript
// In preload.js or content script

async function highlightKnownEntities(investigationId) {
    const mcpClient = new BassetHoundMCPClient();

    // Get subjects from investigation
    const subjects = await mcpClient.executeTool('list_investigation_subjects', {
        project_id: currentProjectId,
        investigation_id: investigationId,
        status_filter: 'active'
    });

    // Get all identifiers for subjects
    const identifiers = [];
    for (const subject of subjects.subjects) {
        const entityIds = await mcpClient.executeTool('get_entity_identifiers', {
            project_id: currentProjectId,
            entity_id: subject.entity_id
        });
        identifiers.push(...entityIds.identifiers);
    }

    // Highlight on page
    highlightIdentifiersOnPage(identifiers);
}
```

**Add to Roadmap:** Phase 20

#### Task 5: Session Persistence

**Goal:** Save/restore browser sessions to basset-hound

**Implementation:**
```javascript
// In session/manager.js

async function saveSessionToBassetHound(sessionData, bastsetUrl, tags) {
    const mcpClient = new BassetHoundMCPClient(bastsetUrl);

    const result = await mcpClient.executeTool('register_browser_session', {
        project_id: currentProjectId,
        session_id: sessionData.id,
        browser_type: 'electron',
        user_agent: sessionData.userAgent,
        fingerprint_hash: sessionData.fingerprintHash
    });

    // Store session data as evidence
    const sessionJson = JSON.stringify(sessionData);
    await mcpClient.executeTool('capture_evidence', {
        project_id: currentProjectId,
        evidence_type: 'session_data',
        content_base64: Buffer.from(sessionJson).toString('base64'),
        metadata: {
            session_id: sessionData.id,
            tags: tags
        }
    });

    return result;
}
```

**Add to Roadmap:** Phase 21 - Session Persistence

---

## 4. Data Flow Patterns

### Evidence Submission Flow

```
basset-hound-browser          basset-hound MCP
       │                              │
       │ Capture screenshot           │
       │ Compute SHA-256              │
       │ Create evidence package      │
       │                              │
       │ capture_evidence(            │
       │   type="screenshot",         │
       │   content_base64="...",      │
       │   sha256="...",              │
       │   metadata={...}             │
       │ )                            │
       │ ────────────────────────►    │
       │                              │ Verify hash
       │                              │ Store with provenance
       │                              │ Start custody chain
       │ ◄───────────────────────────│
       │ {evidence_id,                │
       │  chain_of_custody_started}   │
       ▼                              │
```

### Investigation-Driven Navigation

```
basset-hound-browser          basset-hound MCP
       │                              │
       │ get_investigation_context()  │
       │ ────────────────────────►    │
       │                              │ Query investigation
       │ ◄───────────────────────────│ Return subjects, targets
       │ {subjects: [...],            │
       │  target_urls: [...]}         │
       │                              │
       │ Navigate to targets          │
       │ Highlight known entities     │
       │ Capture relevant evidence    │
       ▼                              │
```

---

## 5. Authentication Pattern

**Headers for basset-hound API:**
```javascript
{
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json',
    'X-Browser-Type': 'electron',
    'X-Browser-Version': app.getVersion(),
    'X-Session-ID': sessionId
}
```

---

## 6. Testing Integration

### Manual Testing Steps

1. Start basset-hound: `python -m basset_mcp.server`
2. Start basset-hound-browser: `npm start`
3. Create investigation in basset-hound
4. Capture evidence in browser
5. Submit evidence to basset-hound
6. Verify in basset-hound UI

### Automated Tests

Add to `tests/integration/basset-hound-integration.test.js`:
```javascript
describe('basset-hound Integration', () => {
    it('should submit evidence package', async () => {
        const evidence = await captureScreenshot();
        const result = await submitToBassetHound(evidence);
        expect(result.success).toBe(true);
        expect(result.evidence_id).toBeDefined();
    });

    it('should get investigation context', async () => {
        const context = await getInvestigationContext('inv_123');
        expect(context.subjects).toBeDefined();
    });
});
```

---

## 7. Roadmap Updates Required

Add these phases to `/docs/ROADMAP.md`:

### Phase 19: Direct Evidence Submission

**Goal:** Submit evidence directly to basset-hound

**Tasks:**
- [ ] Create BassetHoundMCPClient class
- [ ] Implement submitToBassetHound() in evidence-collector
- [ ] Add WebSocket command: submit_to_basset
- [ ] Add WebSocket command: submit_warc_to_basset
- [ ] Add authentication handling
- [ ] Add evidence verification

### Phase 20: Investigation Context Integration

**Goal:** Use investigation context for intelligent navigation

**Tasks:**
- [ ] Add investigation_context MCP resource
- [ ] Implement entity highlighting on page
- [ ] Add get_target_urls integration
- [ ] Add known entity detection
- [ ] Add context-aware evidence capture

### Phase 21: Session Persistence

**Goal:** Save/restore sessions via basset-hound

**Tasks:**
- [ ] Implement saveSessionToBassetHound()
- [ ] Implement restoreSessionFromBassetHound()
- [ ] Add session metadata tracking
- [ ] Add session verification

---

## 8. Dependencies to Add

```json
{
    "dependencies": {
        "@modelcontextprotocol/client": "^1.0.0"
    }
}
```

---

## 9. Summary

The basset-hound-browser has excellent evidence collection capabilities. The main integration work is:

1. **Submit evidence to basset-hound** (capture_evidence, create_warc_record)
2. **Use investigation context** (get_investigation_context, list_subjects)
3. **Track browser sessions** (register_browser_session)
4. **Highlight known entities** (detect_known_entities)

The browser's WebSocket API and MCP server remain unchanged - they serve AI agents. basset-hound integration adds persistent storage and investigation management without changing browser automation.

**Reference:** `/home/devel/basset-hound/docs/findings/INTEGRATION-BROWSER-APIS-2026-01-08.md`

# Evidence Collection Simplification Plan

**Date:** 2026-01-21
**Phase:** 18 (Evidence Collection)
**Status:** Research Complete - Pending Refactoring

## Executive Summary

The current evidence collection system in Basset Hound Browser has two overlapping implementations:

1. **Phase 18** (`evidence-commands.js` / `evidence-collector.js`) - Simplified capture API
2. **Phase 29** (`evidence-chain-commands.js` / `evidence-manager.js`) - Full forensic chain of custody

According to the ROADMAP.md scope boundaries, investigation management features should be removed from the browser and handled by external systems. This document identifies what should be kept vs. removed.

---

## Current Evidence System Architecture

### Files Involved

| File | Purpose | Lines |
|------|---------|-------|
| `/home/devel/basset-hound-browser/evidence/evidence-collector.js` | Phase 18 - Simple capture API | ~379 |
| `/home/devel/basset-hound-browser/evidence/evidence-manager.js` | Phase 29 - Full forensic manager | ~780 |
| `/home/devel/basset-hound-browser/websocket/commands/evidence-commands.js` | Phase 18 WebSocket commands | ~324 |
| `/home/devel/basset-hound-browser/websocket/commands/evidence-chain-commands.js` | Phase 29 WebSocket commands | ~606 |
| `/home/devel/basset-hound-browser/mcp/server.py` | MCP tools for both systems | ~200+ lines (evidence section) |

---

## Current WebSocket Commands

### Phase 18: evidence-commands.js (8 commands)

| Command | Status | Description |
|---------|--------|-------------|
| `capture_screenshot_evidence` | **IN SCOPE** | Capture screenshot with SHA-256 hash |
| `capture_page_archive_evidence` | **IN SCOPE** | Capture page archive (MHTML/HTML/WARC/PDF) with hash |
| `capture_har_evidence` | **IN SCOPE** | Capture network HAR with hash |
| `capture_dom_evidence` | **IN SCOPE** | Capture DOM snapshot with hash |
| `capture_console_evidence` | **IN SCOPE** | Capture console logs with hash |
| `capture_cookies_evidence` | **IN SCOPE** | Capture cookies with hash |
| `capture_storage_evidence` | **IN SCOPE** | Capture localStorage with hash |
| `get_evidence_types` | **IN SCOPE** | Get available evidence types |

**Assessment:** Phase 18 commands are already simplified and aligned with scope. All 8 commands should be KEPT.

### Phase 29: evidence-chain-commands.js (15 commands)

| Command | Status | Reason |
|---------|--------|--------|
| `init_evidence_chain` | **OUT OF SCOPE** | Initializes investigation manager infrastructure |
| `create_investigation` | **OUT OF SCOPE** | Creates investigation with case IDs - belongs in external system |
| `collect_evidence_chain` | **PARTIAL** | Core capture is IN SCOPE, but caseId/investigationId params are OUT OF SCOPE |
| `verify_evidence_chain` | **IN SCOPE** | Hash verification is browser-appropriate |
| `seal_evidence_chain` | **OUT OF SCOPE** | Sealing for court belongs in investigation management |
| `create_evidence_package` | **OUT OF SCOPE** | Package management belongs in external system |
| `add_to_evidence_package` | **OUT OF SCOPE** | Package management belongs in external system |
| `seal_evidence_package` | **OUT OF SCOPE** | Package sealing belongs in investigation management |
| `export_evidence_package` | **OUT OF SCOPE** | Court export belongs in investigation management |
| `get_evidence_chain` | **IN SCOPE** | Retrieve captured evidence by ID |
| `list_evidence_chain` | **PARTIAL** | Basic listing IN SCOPE, but investigationId/caseId filters are OUT OF SCOPE |
| `get_evidence_chain_stats` | **IN SCOPE** | Statistics about captured evidence |
| `get_chain_audit_log` | **OUT OF SCOPE** | Audit logs for investigations belong in external system |
| `export_chain_audit_log` | **OUT OF SCOPE** | Export belongs in investigation management |
| `collect_screenshot_chain` | **IN SCOPE** | Screenshot capture with hash (duplicate of Phase 18 functionality) |

---

## Scope Classification

### IN SCOPE (Browser-Appropriate) - KEEP

Features that align with "browser as a tool" principle:

1. **Individual Evidence Capture**
   - Screenshot capture with SHA-256 hash
   - Page archive capture (MHTML, HTML, WARC, PDF)
   - Network HAR capture
   - DOM snapshot capture
   - Console log capture
   - Cookie capture
   - localStorage capture

2. **Hash and Integrity**
   - SHA-256 hash generation for all captured content
   - Hash verification (recalculate and compare)
   - Timestamp metadata (capturedAt)
   - Capture attribution (capturedBy)

3. **Simple Bundle Capture**
   - `captureBundle()` method - capture multiple items at once
   - Returns array of individual evidence items with hashes

### OUT OF SCOPE (Investigation Management) - REMOVE

Features that belong in external systems (palletai, basset-hound):

1. **Investigation Organization**
   - Investigation IDs and case numbers
   - `create_investigation` command
   - Investigation metadata management
   - `investigationId` and `caseId` parameters

2. **Package Management**
   - `create_evidence_package`
   - `add_to_evidence_package`
   - `seal_evidence_package`
   - Package sealing (making immutable)
   - Package hash calculation

3. **Court/Legal Features**
   - `export_evidence_package` (especially SWGDE format)
   - `export_for_court` functionality
   - SWGDE-compliant forensic reports
   - Legal chain of custody documentation

4. **Audit Trail Management**
   - `get_chain_audit_log`
   - `export_chain_audit_log`
   - Detailed audit log with actor tracking
   - Investigation-filtered audit logs

---

## Proposed Simplification

### Keep: Simplified Evidence API

The Phase 18 implementation (`evidence-collector.js` and `evidence-commands.js`) is already aligned with scope. It should become the primary evidence API.

**Retained Commands (8):**
```
capture_screenshot_evidence
capture_page_archive_evidence
capture_har_evidence
capture_dom_evidence
capture_console_evidence
capture_cookies_evidence
capture_storage_evidence
get_evidence_types
```

**Retained Features:**
- SHA-256 hash generation
- `capturedAt` timestamp
- `capturedBy` attribution
- Basic custody chain (created event only)
- `captureBundle()` for batch capture
- `verifyIntegrity()` for hash verification

### Remove: Investigation Management

The Phase 29 implementation (`evidence-manager.js` and `evidence-chain-commands.js`) should be removed or migrated to an external package.

**Commands to Remove (15):**
```
init_evidence_chain
create_investigation
collect_evidence_chain
verify_evidence_chain
seal_evidence_chain
create_evidence_package
add_to_evidence_package
seal_evidence_package
export_evidence_package
get_evidence_chain
list_evidence_chain
get_evidence_chain_stats
get_chain_audit_log
export_chain_audit_log
collect_screenshot_chain
```

**Features to Remove:**
- `EvidenceManager` class
- `EvidenceItem` class (Phase 29 version)
- `EvidencePackage` class
- Investigation management
- Package sealing
- SWGDE report generation
- Detailed audit logging
- `evidence-vault` directory creation

---

## MCP Server Impact

The MCP server (`mcp/server.py`) has evidence tools that need updating:

### Remove These MCP Tools

From Phase 18 section (lines 1350-1559):
- `browser_create_evidence_package` (duplicate, out of scope)
- `browser_seal_evidence_package` (out of scope)
- `browser_verify_evidence_package` (out of scope)
- `browser_export_evidence_for_court` (out of scope)
- `browser_list_evidence_packages` (out of scope)
- `browser_get_evidence_stats` (duplicate)
- `browser_add_evidence_annotation` (out of scope)

From Phase 29 section (lines 3500-3880):
- `browser_init_evidence_chain`
- `browser_create_investigation`
- `browser_collect_evidence_chain`
- `browser_verify_evidence_chain`
- `browser_seal_evidence_chain`
- `browser_create_evidence_package` (duplicate)
- `browser_add_to_evidence_package`
- `browser_seal_evidence_package` (duplicate)
- `browser_export_evidence_package`
- `browser_list_evidence_chain`
- `browser_get_evidence_chain_stats`
- `browser_export_chain_audit_log`

### Keep These MCP Tools

- `browser_capture_screenshot_evidence`
- `browser_capture_page_archive_evidence`
- `browser_capture_har_evidence`

---

## Dependencies to Consider

### External Systems That May Use Removed Features

1. **palletai agents** - May use `create_investigation`, `create_evidence_package`, `seal_evidence_package`
2. **Test files** - `tests/evidence-chain-test.js` and `tests/unit/evidence-chain.test.js` will need updates

### Migration Path

The removed features should be available in:
- **basset-hound** - Entity storage system (for investigations, cases)
- **palletai** - AI agent framework (for investigation workflow)

These external systems should:
1. Call the browser's simplified capture commands
2. Receive evidence items with hashes
3. Manage their own investigation state, packages, and audit trails

---

## Files to Modify/Remove

### Files to REMOVE

| File | Reason |
|------|--------|
| `/home/devel/basset-hound-browser/evidence/evidence-manager.js` | Phase 29 investigation management |
| `/home/devel/basset-hound-browser/websocket/commands/evidence-chain-commands.js` | Phase 29 commands |
| `/home/devel/basset-hound-browser/tests/unit/evidence-chain.test.js` | Tests for removed code |
| `/home/devel/basset-hound-browser/tests/evidence-chain-test.js` | Integration test for removed code |

### Files to MODIFY

| File | Changes Needed |
|------|----------------|
| `/home/devel/basset-hound-browser/mcp/server.py` | Remove ~20 evidence-related MCP tools |
| `/home/devel/basset-hound-browser/docs/ROADMAP.md` | Update Phase 18/29 documentation |
| `/home/devel/basset-hound-browser/websocket/server.js` | Remove evidence-chain-commands registration (if present) |

### Files to KEEP (No Changes)

| File | Reason |
|------|--------|
| `/home/devel/basset-hound-browser/evidence/evidence-collector.js` | Already simplified and in scope |
| `/home/devel/basset-hound-browser/websocket/commands/evidence-commands.js` | Already simplified and in scope |
| `/home/devel/basset-hound-browser/tests/unit/evidence-collector.test.js` | Tests for retained code |

---

## Summary

### By the Numbers

| Category | Count |
|----------|-------|
| Phase 18 Commands (KEEP) | 8 |
| Phase 29 Commands (REMOVE) | 15 |
| MCP Tools to REMOVE | ~20 |
| Files to DELETE | 4 |
| Files to MODIFY | 3 |

### Key Principle

> **The browser captures and provides raw evidence with hashes. External systems organize evidence into investigations, packages, and court-ready exports.**

This aligns with the architectural principle stated in ROADMAP.md:
- **Browser:** Technical capabilities (capture, hash, timestamp)
- **Agent:** Intelligence decisions (organize, analyze, present)
- **Storage:** Entity management (investigations, cases)

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Update external systems** (palletai, basset-hound) to handle investigation management
3. **Remove Phase 29 code** from basset-hound-browser
4. **Update MCP server** to remove out-of-scope tools
5. **Update documentation** (ROADMAP.md, API docs)
6. **Run test suite** to verify retained functionality

---

*Document generated: 2026-01-21*
*Author: Claude Code (research task)*

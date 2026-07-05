# API Documentation Architecture

**Updated:** June 22, 2026  
**Model:** Hub-and-Spoke Single Source of Truth

---

## Overview

The Basset Hound Browser API documentation uses a **hub-and-spoke model** to maintain a single source of truth while providing organized reference material.

```
                   CANONICAL HUB
                   /docs/ root
                        |
        ┌───────────────┼───────────────┐
        |               |               |
    OVERVIEW      SPECIFICATION    VERSIONING
        |               |               |
  API-DOCS-       openapi.yaml    API-VERSIONS.md
  SUMMARY.md             |               |
        |               |               |
  Quick Start       Machine-        Changelog
  Examples         Readable Spec    History
  Integration       (164 cmds)      Policy
        |               |               |
        └───────────────┼───────────────┘
                        |
                  DETAILED REFERENCE
                  /docs/wiki/api/
                        |
        ┌───────────────┼───────────────┐
        |               |               |
    ORGANIZATION   PROTOCOL        ERRORS
        |               |               |
  COMPLETE-REF  WEBSOCKET-PROTOCOL ERROR-CODES.md
  COMMAND-CATS  (connection, msgs) (status, codes)
  OVERVIEW.md           |               |
        |               |               |
        └───────────────┼───────────────┘
                        |
                   ARCHIVE
                /docs/archive/
                 deprecated/
                (43 files)
```

---

## Hub: Canonical Documentation (Single Source of Truth)

**Location:** `/docs/` root directory  
**Purpose:** Authoritative documentation for all API features  
**Audience:** All developers, integrators, DevOps teams

### 1. API-DOCUMENTATION-SUMMARY.md
**Type:** Entry point & overview  
**When to use:** Start here for API overview, feature comparison, audience routing

**Contains:**
- Feature overview by version (v12.8.0, v12.7.0, etc.)
- Audience routing (dev/integrator/DevOps)
- Integration patterns
- SDK links
- Quick links to other resources

**Update frequency:** When features change or versions update

---

### 2. openapi.yaml
**Type:** Machine-readable specification  
**Format:** OpenAPI 3.0.3  
**When to use:** SDK generation, API testing, validation, tool integration

**Contains:**
- Complete definition of all 164 commands
- Request/response schemas
- Error code definitions
- Security schemes
- Rate limiting specifications
- Parameter validation rules

**Update frequency:** When API changes (adds/removes/modifies commands)  
**Tools that consume this:**
- Swagger UI (interactive documentation)
- ReDoc (documentation portal)
- OpenAPI generators (generate SDKs)
- Postman (API testing)
- API gateways

---

### 3. API-VERSIONS.md
**Type:** Version history & deprecation policy  
**When to use:** Check supported versions, migration paths, breaking changes

**Contains:**
- Version timeline (v12.8.0 → v12.0.0)
- Feature matrix by version
- Breaking changes per version
- Deprecation policy (N, N-1, unsupported)
- Support timeline
- Migration guides

**Update frequency:** When releasing new versions

---

### 4. QUICK-START-GUIDE.md
**Type:** Onboarding guide  
**When to use:** First-time developers getting up and running

**Contains:**
- Installation steps (Node.js, Python, Docker)
- Connection setup
- First commands (ping, navigate, screenshot)
- Common workflows
- Troubleshooting tips

**Update frequency:** When setup process changes  
**Time to complete:** 5-10 minutes

---

### 5. EXAMPLES.md
**Type:** Working code samples  
**When to use:** See how to accomplish specific tasks

**Contains:**
- 8+ example categories
- 30+ complete, runnable examples
- Languages: Node.js, Python, cURL
- Best practices
- Error handling patterns
- Advanced techniques

**Update frequency:** When adding new features  
**Languages:** Node.js, Python, cURL

---

### 6. INTEGRATION-GUIDE.md
**Type:** Deployment & integration guide  
**When to use:** Production deployment, DevOps setup, integration patterns

**Contains:**
- SDK installation and setup
- Authentication configuration
- Deployment options (Docker, systemd, etc.)
- Monitoring and metrics
- Performance tuning
- Security hardening
- Troubleshooting

**Update frequency:** When deployment changes  
**Audience:** DevOps, infrastructure engineers

---

## Spokes: Detailed Reference (Organized Content)

**Location:** `/docs/wiki/api/` directory  
**Purpose:** Organized, detailed reference material  
**Audience:** Developers deep-diving into specific topics

### When to use wiki/api/ directory:
- Looking for specific command documentation
- Understanding protocol details
- Learning about error codes
- Reviewing architecture decisions

### The 6 Reference Files:

#### INDEX.md
Navigation hub for wiki API directory. Points to canonical docs and local reference files.

#### OVERVIEW.md
Core API concepts, architecture overview, basic principles.

#### COMPLETE-REFERENCE.md
Comprehensive command listing with quick lookup table and command details organized by category.

#### COMMAND-CATEGORIES.md
Commands grouped by functional area (navigation, interaction, extraction, etc.)

#### WEBSOCKET-PROTOCOL.md
Protocol details:
- Connection types (ws://, wss://)
- Message format (JSON structure)
- Response types (success, error)
- Connection lifecycle
- Reconnection handling

#### ERROR-CODES.md
Error reference:
- Error code listing
- Meaning and resolution
- HTTP status mapping
- Common error scenarios
- Recovery patterns

#### CHANGELOG.md
Extended version history with detailed change descriptions. Secondary reference to canonical API-VERSIONS.md.

---

## Archive: Historical Reference Only

**Location:** `/docs/archive/deprecated/`  
**Contents:** 43 archived API documentation files

### What's archived:
- Multiple versions of same documentation
- Deprecated API references
- Outdated integration guides
- Old versioning documentation

### Why archived:
- Consolidation eliminated duplication
- Clear separation between active & historical
- Preserved for reference/research

### Use for:
- Researching version history
- Understanding past architecture decisions
- Migration from very old versions

---

## Relationship Between Layers

### Hub is authoritative
- Canonical hub documents are the source of truth
- All spokes reference the hub
- Updates to API flow through hub first

### Spokes provide organization
- Detailed subject organization
- Long-form explanations
- Examples and walkthroughs
- Always reference back to hub

### Archive preserves history
- No active use
- Available for research
- All marked as deprecated

---

## Information Flow: A Developer's Journey

### Getting Started (5-10 minutes)
```
README.md
    ↓
API-DOCUMENTATION-SUMMARY.md (overview)
    ↓
QUICK-START-GUIDE.md (install & first command)
    ✓ Understand what API does, install, run ping
```

### Learning (15-30 minutes)
```
EXAMPLES.md (working code)
    ↓
wiki/api/COMMAND-CATEGORIES.md (commands by type)
    ↓
openapi.yaml (specific command details)
    ✓ Can write working code, understand patterns
```

### Deep Dive (30+ minutes)
```
wiki/api/COMPLETE-REFERENCE.md (all commands)
    ↓
wiki/api/WEBSOCKET-PROTOCOL.md (how protocol works)
    ↓
wiki/api/ERROR-CODES.md (error handling)
    ↓
INTEGRATION-GUIDE.md (production patterns)
    ✓ Understand every aspect, can deploy & troubleshoot
```

### Deploying to Production
```
INTEGRATION-GUIDE.md (setup, auth, monitoring)
    ↓
openapi.yaml (validate requests)
    ↓
EXAMPLES.md (reference patterns)
    ↓
SECURITY.md (hardening)
    ✓ Production-ready deployment
```

### Version Migration
```
API-VERSIONS.md (breaking changes)
    ↓
EXAMPLES.md (updated code)
    ↓
QUICK-START-GUIDE.md (reinstall if needed)
    ✓ Understand migration path
```

---

## Maintaining Single Source of Truth

### Update Process

**When API changes:**
1. Update `openapi.yaml` (machine source)
2. Update `API-DOCUMENTATION-SUMMARY.md` if feature-level
3. Update relevant spoke file (wiki/api/*.md)
4. Add entry to `API-VERSIONS.md`
5. Update `EXAMPLES.md` if needed
6. Update `version.json` with release date

**When process changes:**
1. Update `INTEGRATION-GUIDE.md`
2. Update `EXAMPLES.md` if relevant
3. Update `QUICK-START-GUIDE.md` if installation changes

**When documenting issues:**
1. Update `ERROR-CODES.md` in wiki/api/
2. Update troubleshooting in INTEGRATION-GUIDE.md

### Validation
- Run `/scripts/validate-docs.sh` before each release
- Verify all cross-references work
- Check openapi.yaml is valid
- Confirm version.json is updated

---

## Key Principles

### ✅ DO
- Document in canonical hub first
- Keep spokes as secondary/detailed organization
- Reference between layers
- Archive outdated documentation
- Validate links before release
- Update version.json with releases

### ❌ DON'T
- Create conflicting documentation
- Document the same feature in multiple places
- Add hub docs to wiki
- Update archive files
- Create new root-level API docs without consolidation
- Skip validation before release

---

## File Locations Quick Reference

| Purpose | File | Location | Update Frequency |
|---------|------|----------|-----------------|
| **Entry Point** | API-DOCUMENTATION-SUMMARY.md | `/docs/` | When features change |
| **Specification** | openapi.yaml | `/docs/` | When API changes |
| **Getting Started** | QUICK-START-GUIDE.md | `/docs/` | When setup changes |
| **Examples** | EXAMPLES.md | `/docs/` | When adding features |
| **Deployment** | INTEGRATION-GUIDE.md | `/docs/` | When deploy changes |
| **Versioning** | API-VERSIONS.md | `/docs/` | Each release |
| **Commands** | COMPLETE-REFERENCE.md | `/docs/wiki/api/` | From openapi.yaml |
| **Categories** | COMMAND-CATEGORIES.md | `/docs/wiki/api/` | From openapi.yaml |
| **Protocol** | WEBSOCKET-PROTOCOL.md | `/docs/wiki/api/` | When protocol changes |
| **Errors** | ERROR-CODES.md | `/docs/wiki/api/` | When codes change |
| **Changelog** | CHANGELOG.md | `/docs/wiki/api/` | Each release |
| **History** | Version files | `/docs/archive/deprecated/` | Never updated |

---

## Questions Answered

**Q: Where do I look for API commands?**  
A: Start with `openapi.yaml` for definitive spec, or `wiki/api/COMPLETE-REFERENCE.md` for organized reference.

**Q: Which file should I update first?**  
A: Always update canonical hub documents first (`openapi.yaml`, then `API-DOCUMENTATION-SUMMARY.md`), then propagate to spokes.

**Q: Can I modify archive files?**  
A: No, archive is read-only historical reference. Create new files in canonical hub if needed.

**Q: How do I know if documentation is current?**  
A: Check `API-DOCUMENTATION-SUMMARY.md` for current version (top of file), or `version.json` for machine-readable info.

**Q: Should the wiki/api/ duplicate the canonical docs?**  
A: No. Wiki provides organized reference and detailed explanations. It references canonical hub, not duplicates.

**Q: What if I find inconsistent documentation?**  
A: Report it. The canonical hub is source of truth; spokes should reference/link to hub, not contradict it.

---

**Last Updated:** June 22, 2026  
**Architecture:** Hub-and-spoke single source of truth  
**Consolidation Status:** Complete  
**Files Involved:** 11 files (6 hub + 5 spokes in wiki)

# Basset Hound Browser - Complete API Documentation Index

**Last Updated:** June 21, 2026  
**Status:** Consolidated & Current

---

## Canonical API Documentation (Current)

These are the **ONLY** documents developers should reference for current API information:

### 1. API Documentation Summary
**File:** `/docs/API-DOCUMENTATION-SUMMARY.md`  
**Purpose:** Entry point and overview of all API documentation  
**Audience:** All developers  
**Content:**
- Navigation to all API docs
- Feature overview by version
- SDK links
- Integration patterns

**Use when:** You need to understand what documentation exists or get oriented

---

### 2. OpenAPI/Swagger Specification
**File:** `/docs/openapi.yaml`  
**Format:** OpenAPI 3.0.3  
**Purpose:** Machine-readable API contract  
**Audience:** Tool integrators, SDK generators, API testing frameworks  
**Content:**
- Complete API schema
- Request/response definitions
- Error codes and messages
- Rate limiting specs
- Security definitions
- 140+ command definitions organized by category

**Use when:**
- Generating SDKs
- Setting up API testing
- Validating requests
- Integrating with API gateways

**Tools that consume this:**
- Swagger UI / ReDoc (interactive documentation)
- OpenAPI generators (Generate client code)
- Postman (API testing)
- API monitoring tools

---

### 3. Quick Start Guide
**File:** `/docs/QUICK-START-GUIDE.md`  
**Purpose:** Get developers productive in 5-10 minutes  
**Audience:** First-time users, new integrators  
**Content:**
- Installation instructions (Node.js, Python, Docker)
- Connection setup
- First simple commands
- Common workflows
- Troubleshooting quick fixes
- Next steps

**Use when:** You're new to Basset Hound and want to get started immediately

---

### 4. Working Examples
**File:** `/docs/EXAMPLES.md`  
**Purpose:** Real, working code examples  
**Audience:** All developers  
**Languages:** Node.js, Python, cURL  
**Content:**
- Basic operations (navigate, screenshot)
- Web scraping patterns
- Forensic evidence capture
- Network forensics
- Session management
- Advanced evasion
- Batch processing
- Error handling & recovery

**Use when:** You want to see how to accomplish a specific task

**Example categories:**
1. Basic Operations (5 examples)
2. Web Scraping (6 examples)
3. Forensic Evidence Capture (4 examples)
4. Network Forensics (3 examples)
5. Session Management (3 examples)
6. Advanced Evasion (4 examples)
7. Batch Processing (2 examples)
8. Error Handling & Recovery (4 examples)

---

### 5. Integration Guide
**File:** `/docs/INTEGRATION-GUIDE.md`  
**Purpose:** Production deployment and integration patterns  
**Audience:** DevOps, integration engineers, production deployment  
**Content:**
- SDK setup for all languages
- Authentication & authorization
- API patterns and best practices
- Deployment (Docker, Kubernetes, Cloud)
- Monitoring & observability
- Support resources
- Troubleshooting

**Use when:** You need to deploy Basset Hound to production or integrate with external systems

**Deployment options covered:**
- Docker containers
- Kubernetes clusters
- Cloud platforms (AWS, Azure, GCP)
- Docker Compose
- Standalone deployment

---

### 6. API Version History
**File:** `/docs/API-VERSIONS.md`  
**Purpose:** Track API evolution, deprecations, and breaking changes  
**Audience:** Integration maintainers, version planners  
**Content:**
- Current version (12.8.0) with all features
- Previous versions and support timeline
- Breaking changes (none current)
- Deprecation policy
- Migration path for upgrades
- Support matrix

**Use when:**
- Planning API version upgrades
- Checking if a feature is available in your version
- Understanding what changed between versions
- Looking up support timeline

---

## Archived Documentation (Deprecated - June 21, 2026)

All other API documentation files have been archived to `/docs/archive/deprecated/` and are **NOT FOR NEW DEVELOPMENT**.

**Total files archived:** 43  
**Reason:** Consolidation to single canonical source  
**Archive directory:** `/docs/archive/deprecated/`

### Archived Files by Category

#### Former API Reference Files (27 files)
```
API-COMMAND-INDEX.md
API-ENHANCEMENTS-QUICK-REFERENCE.md
API-ENHANCEMENTS-SUMMARY.md
API-EXTENDED-FEATURES.md
API-QUICK-REFERENCE.md
API-REFERENCE.md
API-REFERENCE-AUTHORITATIVE.md
API-REFERENCE-COMPLETE.md
API-REFERENCE-v12.7.0.md
API-REFERENCE-V12.8.0.md
API-SPECIFICATION-MANIFEST.md
API-SPECIFICATION-SUMMARY.md
BEHAVIORAL-COHERENCE-SCORING-API-REFERENCE.md
COMMAND-INVENTORY.md
EVIDENCE-PACKAGING-API-REFERENCE.md
FORENSIC-EXPORTS-API-REFERENCE.md
FUTURE-API-ROADMAP.md
HTML-CAPTURE-API.md
INDEX.md
PYTHON-SDK-API-REFERENCE.md
REST-API-REFERENCE.md
SCREENSHOT-API-REFERENCE-PHASE4.md
SDK-API-REFERENCE.md
SESSION-COHERENCE-VALIDATION-API-REFERENCE.md
TECHNOLOGY-FINGERPRINTING-API-REFERENCE.md
VIDEO-API-REFERENCE.md
VIDEO-RECORDING-API-REFERENCE.md
```

#### Former Integration/Guide Files (10 files)
```
CONNECTION-MONITORING-COMMANDS.md
DEMO-QUICK-REFERENCE.md
EXTERNAL-APP-VALIDATION-GUIDE.md
NEW-COMMANDS-INDEX.md
PHASE1-FORENSIC-COMMANDS-COMPLETION.md
PHASE-2-COMMAND-SPECIFICATIONS.md
TOR-CIRCUIT-INTEGRATION-EXAMPLES.md
VALIDATION-INTEGRATION-GUIDE.md
V12.7.0-QUICK-REFERENCE.md
optimizations-integration-guide.md
```

#### Former Interactive/SDK Files (6 files)
```
AGENT-COORDINATION-CODE-EXAMPLES.md
PYTHON-SDK-EXAMPLES.md
SDK-EXAMPLES.md
api-interactive-reference.html
index.html
openapi.yaml (duplicate in /docs/api/)
README.md (from /docs/api/)
```

---

## Finding What You Need

### By Use Case

#### I want to...

| Need | Document | Section |
|------|----------|---------|
| Get started immediately | QUICK-START-GUIDE.md | Installation + Basic Usage |
| See code examples | EXAMPLES.md | Choose your language |
| Deploy to production | INTEGRATION-GUIDE.md | Deployment section |
| Understand all features | API-DOCUMENTATION-SUMMARY.md | Feature overview |
| Check API contract | openapi.yaml | Use with Swagger UI or ReDoc |
| Know about versions | API-VERSIONS.md | Version timeline |
| Use with my tool | openapi.yaml | Generate client code |
| Understand breaking changes | API-VERSIONS.md | Breaking Changes section |

### By Audience

#### Developers
1. Start: [QUICK-START-GUIDE.md](QUICK-START-GUIDE.md)
2. Learn: [EXAMPLES.md](EXAMPLES.md)
3. Reference: [openapi.yaml](openapi.yaml) or [API-DOCUMENTATION-SUMMARY.md](API-DOCUMENTATION-SUMMARY.md)

#### DevOps / Integration Engineers
1. Start: [INTEGRATION-GUIDE.md](INTEGRATION-GUIDE.md)
2. Reference: [openapi.yaml](openapi.yaml)
3. Troubleshoot: [API-VERSIONS.md](API-VERSIONS.md) for known issues

#### Tool/SDK Developers
1. Use: [openapi.yaml](openapi.yaml)
2. Generate clients
3. Reference: [API-DOCUMENTATION-SUMMARY.md](API-DOCUMENTATION-SUMMARY.md) for feature overview

#### Security/Architecture Review
1. Reference: [API-DOCUMENTATION-SUMMARY.md](API-DOCUMENTATION-SUMMARY.md)
2. Details: [openapi.yaml](openapi.yaml) (security schemes)
3. Versions: [API-VERSIONS.md](API-VERSIONS.md) (stability guarantees)

---

## Documentation Structure

```
/docs/
├── API-DOCUMENTATION-SUMMARY.md          ← START HERE (overview)
├── API-DOCUMENTATION-INDEX.md            ← This file
├── API-VERSIONS.md                       ← Version history & breaking changes
├── openapi.yaml                          ← Machine-readable spec (OpenAPI 3.0.3)
├── QUICK-START-GUIDE.md                  ← Getting started (5-10 min)
├── EXAMPLES.md                           ← Working code examples
├── INTEGRATION-GUIDE.md                  ← Deployment & production
│
├── archive/
│   └── deprecated/
│       ├── README.md                     ← Why files are archived
│       └── [43 deprecated API docs]      ← Historical reference only
│
├── api/
│   ├── examples/                         ← Code samples
│   └── extensions/                       ← Extension patterns
│
└── [other documentation]
```

---

## Migration Guide: From Old to Canonical Docs

If you've been using deprecated documentation, here's how to migrate:

### From API-REFERENCE-*.md files
→ Use `openapi.yaml` for specifications  
→ Use `EXAMPLES.md` for code samples  
→ Use `API-DOCUMENTATION-SUMMARY.md` for overview  

### From SDK-API-REFERENCE.md
→ Use `EXAMPLES.md` (SDK examples for all languages)  
→ Use `INTEGRATION-GUIDE.md` (SDK setup section)  

### From various QUICK-REFERENCE files
→ Use `QUICK-START-GUIDE.md`  

### From Integration guides in other directories
→ Use `INTEGRATION-GUIDE.md`  

### From COMMAND-INVENTORY.md
→ Use `openapi.yaml` (all commands defined there)  
→ Use `API-DOCUMENTATION-SUMMARY.md` (command overview by category)  

---

## FAQ

### Q: Why were docs consolidated?
A: Having 40+ overlapping API docs caused confusion:
- Developers didn't know which was current
- Files contained contradictory information
- Links broke when docs were moved
- Integration broke when specs changed without coordinated updates

**Solution:** Single source of truth with 5 canonical documents covering all needs.

### Q: Are the old docs still available?
A: Yes, in `/docs/archive/deprecated/` for historical reference. But don't use them for new work.

### Q: Will my bookmarks still work?
A: No. Update bookmarks to use canonical docs:
- `/docs/API-DOCUMENTATION-SUMMARY.md` - Overview
- `/docs/openapi.yaml` - Spec
- `/docs/QUICK-START-GUIDE.md` - Getting started
- `/docs/EXAMPLES.md` - Code samples
- `/docs/INTEGRATION-GUIDE.md` - Deployment

### Q: How do I report docs issues?
A: GitHub issues or feedback@basset-hound.io

### Q: When will old docs be deleted?
A: They're archived indefinitely for reference. Developers should not use them going forward.

### Q: What if I can't find something?
A: Check these in order:
1. [EXAMPLES.md](EXAMPLES.md) - Most common use cases
2. [API-DOCUMENTATION-SUMMARY.md](API-DOCUMENTATION-SUMMARY.md) - Feature overview
3. [openapi.yaml](openapi.yaml) - Complete spec
4. [INTEGRATION-GUIDE.md](INTEGRATION-GUIDE.md) - Deployment
5. [API-VERSIONS.md](API-VERSIONS.md) - Version-specific info

---

## Version Information

| Aspect | Details |
|--------|---------|
| Current API Version | 12.8.0 |
| Current Version Release Date | June 21, 2026 |
| Documentation Last Updated | June 21, 2026 |
| Canonical Docs Created | June 21, 2026 |
| Total API Commands | 164 |
| Backward Compatibility | 100% with v12.7.0 |
| Breaking Changes (v12.8.0) | None |

---

## Quick Links

- **API Summary:** [API-DOCUMENTATION-SUMMARY.md](API-DOCUMENTATION-SUMMARY.md)
- **Getting Started:** [QUICK-START-GUIDE.md](QUICK-START-GUIDE.md)
- **Code Examples:** [EXAMPLES.md](EXAMPLES.md)
- **Deploy to Production:** [INTEGRATION-GUIDE.md](INTEGRATION-GUIDE.md)
- **API Spec:** [openapi.yaml](openapi.yaml)
- **Version History:** [API-VERSIONS.md](API-VERSIONS.md)
- **Archived Docs:** [archive/deprecated/](archive/deprecated/)
- **Main README:** [../README.md](../README.md)

---

**Questions?** See [API-DOCUMENTATION-SUMMARY.md](API-DOCUMENTATION-SUMMARY.md) or submit an issue on GitHub.

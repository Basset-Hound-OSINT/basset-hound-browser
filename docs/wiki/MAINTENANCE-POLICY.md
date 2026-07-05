# API Documentation Maintenance Policy

**Effective Date:** June 22, 2026  
**Status:** Active  
**Last Updated:** June 22, 2026

---

## Overview

This policy defines how the Basset Hound Browser API documentation is maintained to ensure accuracy, consistency, and single source of truth across all 11 documentation files.

---

## Responsibilities

### Documentation Owner
- **Primary:** Project lead / Technical writer
- **Approval:** Release manager
- **Reviewers:** 1+ senior developer

### Update Responsibility
- **API changes:** Implementer who made the change
- **Documentation updates:** Technical writer / Project lead
- **Validation:** CI/CD pipeline (pre-release)

---

## Change Categories

### Category 1: API Feature Changes

**Triggers:** Add, modify, or remove WebSocket command

**Update Process:**
1. Implementer updates OpenAPI spec (`openapi.yaml`)
   - Add command definition
   - Define parameters, responses, errors
   - Update version number in spec
2. Implementer adds code examples (`EXAMPLES.md`)
3. Technical writer updates feature overview (`API-DOCUMENTATION-SUMMARY.md`)
4. Project lead updates version history (`API-VERSIONS.md`)
5. Validate with `/scripts/validate-docs.sh`
6. Merge with approval from 1+ senior developer

**Files Modified:**
- `/docs/openapi.yaml` (required)
- `/docs/EXAMPLES.md` (if new feature)
- `/docs/API-DOCUMENTATION-SUMMARY.md` (if feature category added)
- `/docs/API-VERSIONS.md` (required)
- `/docs/wiki/api/COMPLETE-REFERENCE.md` (regenerate or manually update)
- `/docs/wiki/api/COMMAND-CATEGORIES.md` (if new category)
- `/docs/version.json` (update version number)

**Timeline:** Within 1 sprint of implementation

---

### Category 2: Documentation Accuracy Fixes

**Triggers:** Incorrect information, broken link, typo, outdated example

**Update Process:**
1. Identify canonical source (usually hub)
2. Update canonical document
3. Update related spoke documents
4. Validate cross-references
5. No release cycle needed (can be immediate)

**Files Modified:**
- Varies by issue (check canonical first)

**Timeline:** As soon as discovered, max 48 hours

---

### Category 3: Deployment/Integration Changes

**Triggers:** Change to deployment process, security update, performance tuning

**Update Process:**
1. Implementer updates `INTEGRATION-GUIDE.md`
2. Update `EXAMPLES.md` if code examples affected
3. Update `QUICK-START-GUIDE.md` if installation changes
4. Validate with `/scripts/validate-docs.sh`
5. Update `API-VERSIONS.md` if breaking change

**Files Modified:**
- `/docs/INTEGRATION-GUIDE.md` (required)
- `/docs/EXAMPLES.md` (if code examples affected)
- `/docs/QUICK-START-GUIDE.md` (if installation affected)
- `/docs/API-VERSIONS.md` (if breaking change)

**Timeline:** Same sprint as implementation

---

### Category 4: Architecture/Scope Changes

**Triggers:** Change to API philosophy, protocol redesign, security model update

**Update Process:**
1. Technical writer updates `API-DOCUMENTATION-SUMMARY.md`
2. Update `wiki/api/OVERVIEW.md` (concepts)
3. Update `wiki/api/WEBSOCKET-PROTOCOL.md` if protocol changes
4. Update `INTEGRATION-GUIDE.md` (deployment impact)
5. Update `API-VERSIONS.md` (breaking change entry)
6. Comprehensive review required

**Files Modified:**
- Multiple (see above)

**Timeline:** 2-3 sprint planning cycles; broad team review

---

## Single Source of Truth Principle

### Canonical Hub (Source of Truth)

Located in `/docs/` root:
- **openapi.yaml** — Definitive API specification
- **API-DOCUMENTATION-SUMMARY.md** — Feature overview
- **API-VERSIONS.md** — Version history
- **QUICK-START-GUIDE.md** — Getting started
- **EXAMPLES.md** — Code samples
- **INTEGRATION-GUIDE.md** — Deployment
- **API-DOCUMENTATION-INDEX.md** — Navigation

### Verification Process

Before each release:
1. Run `/scripts/validate-docs.sh`
2. Manually review cross-references
3. Check openapi.yaml is valid YAML/JSON
4. Verify version numbers match across files
5. Confirm wiki files reference canonical docs

### Conflict Resolution

If canonical hub and wiki documentation conflict:
1. Canonical hub is ALWAYS correct
2. Update wiki to reference hub
3. Remove conflicting content from wiki
4. Add cross-reference to canonical source

---

## Version Management

### Version Numbers

**Rule:** API version and documentation version are synchronized

Example:
- When releasing API v12.9.0
- Update documentation to v12.9.0
- Update version in: openapi.yaml, API-DOCUMENTATION-SUMMARY.md, version.json

### Version File (`version.json`)

**Location:** `/docs/version.json`  
**Update frequency:** Each release  
**Purpose:** Machine-readable version info

**Must contain:**
```json
{
  "current_version": "12.8.0",
  "api_version": "12.8.0",
  "release_date": "2026-06-21",
  "status": "production"
}
```

### Deprecation Policy

**Active Support (Current Release):** v12.8.0
- Full bug fixes
- New feature support
- Breaking changes allowed with migration guide

**Maintenance Mode (N-1):** v12.7.0
- Security updates only
- No new features
- Deprecation warnings

**End of Life (N-2 and earlier):** v12.6.0 and below
- No support
- Users encouraged to upgrade
- Documentation in archive only

### Breaking Changes

**Rule:** All breaking changes must be documented

**When making breaking change:**
1. Add to API-VERSIONS.md under "Breaking Changes"
2. Provide migration guide in API-VERSIONS.md
3. Update EXAMPLES.md with new code
4. Update QUICK-START-GUIDE.md if needed
5. Add deprecation notice to old documentation

---

## Archive Process

### When to Archive

Archive documentation when:
- Feature is removed from API
- Documentation is superseded by new version
- Protocol/approach fundamentally changes
- Support for version ends

### Archive Steps

1. Add deprecation header to file:
   ```markdown
   > **⚠️ ARCHIVED:** This documentation was superseded by [New Document](link).
   > Last supported in version X.Y.Z.
   > See [CURRENT DOCS](link) for current information.
   ```

2. Move file to `/docs/archive/deprecated/`

3. Update cross-references in active docs

4. Create entry in `/docs/archive/deprecated/README.md`

5. Keep old version in archive for reference

### Archive Structure

```
/docs/archive/deprecated/
├── README.md                          (index of archive)
├── v12.6.0/                          (version-based)
│   ├── API-REFERENCE-v12.6.0.md
│   └── QUICK-START-v12.6.0.md
├── API-REFERENCE-AUTHORITATIVE.md    (obsoleted by openapi.yaml)
└── ... (other archived docs)
```

---

## Review & Approval

### Pre-Release Review Checklist

- [ ] All files in `/docs/` are readable and accessible
- [ ] `openapi.yaml` is valid YAML/JSON
- [ ] `version.json` is valid JSON and updated
- [ ] Cross-references between files work
- [ ] No broken links to external resources
- [ ] Wiki files (wiki/api/) reference canonical docs
- [ ] Archive files are marked as deprecated
- [ ] Examples code is tested and current
- [ ] No conflicting information between files
- [ ] Version numbers match across all files
- [ ] `/scripts/validate-docs.sh` passes
- [ ] Team review completed (1+ senior dev)

### Approval Sign-off

**Required for release:**
1. Technical lead: Documentation accuracy ✓
2. DevOps/Integration engineer: Deployment guide current ✓
3. Release manager: All updates completed ✓

---

## Quality Standards

### Documentation Quality

**Completeness:**
- All 164 commands documented in openapi.yaml
- All major features have examples
- All deployment scenarios covered in INTEGRATION-GUIDE.md
- All error codes documented in ERROR-CODES.md

**Accuracy:**
- Documentation matches actual API behavior
- Examples are tested and working
- No contradictions between files
- Version information is current

**Clarity:**
- Clear target audience for each document
- Plain language, no jargon without explanation
- Examples show best practices
- Troubleshooting section for common issues

**Accessibility:**
- All files are readable and accessible
- All links work
- All code samples are copy-paste ready
- Navigation is clear

### Metrics

Track these metrics to maintain quality:

- **Broken links:** 0 (validated pre-release)
- **Outdated content:** <5% (measured per release)
- **User confusion:** Collect from support tickets
- **Example success rate:** >95% (code samples work)
- **Coverage:** 100% of public API commands

---

## Automation & Tooling

### Validation Script

**File:** `/scripts/validate-docs.sh`  
**Run:** Before each release, automatically in CI/CD

**Checks:**
- All canonical files exist
- All wiki files exist
- Archive README is present
- openapi.yaml is valid
- version.json is valid
- Cross-references work
- No broken links

### CI/CD Integration

**Pre-merge checks:**
- Validate documentation structure
- Check for broken links
- Verify JSON/YAML syntax
- Confirm version consistency

**Pre-release checks:**
- Full validation suite
- Team sign-off
- Archive process completed

### Continuous Monitoring

- Monitor documentation engagement (page views, downloads)
- Track support tickets related to documentation
- Collect user feedback on clarity
- Identify frequently updated sections

---

## Process Examples

### Example 1: Adding New Command

**Step 1:** Implementer adds to `openapi.yaml`
```yaml
/commands/newCommand:
  parameters: [...]
  responses: [...]
```

**Step 2:** Implementer adds to `EXAMPLES.md`
```python
# Example code
```

**Step 3:** Technical writer updates `API-DOCUMENTATION-SUMMARY.md`
- Add to feature list
- Update command count

**Step 4:** Project lead updates `API-VERSIONS.md`
```markdown
### What's New in v12.9.0
- New command: newCommand
```

**Step 5:** Validate and release
```bash
./scripts/validate-docs.sh
# Fix any issues
git commit -m "docs: Add newCommand to API v12.9.0"
```

---

### Example 2: Fixing Documentation Error

**Step 1:** Identify issue (e.g., broken link in API-DOCUMENTATION-SUMMARY.md)

**Step 2:** Fix canonical document
```bash
# Edit /docs/API-DOCUMENTATION-SUMMARY.md
# Fix the broken link
```

**Step 3:** Check for related issues
```bash
grep "old-link" /docs/wiki/api/*.md
# Update any references in wiki
```

**Step 4:** Validate and commit
```bash
./scripts/validate-docs.sh
git commit -m "docs: Fix broken link in API-DOCUMENTATION-SUMMARY.md"
```

---

### Example 3: Breaking Change Migration

**Step 1:** Implement breaking change to API

**Step 2:** Update openapi.yaml with new spec

**Step 3:** Add migration guide to API-VERSIONS.md
```markdown
### Breaking Changes in v12.9.0
- Command `oldCmd` renamed to `newCmd`
- Migration: Change all calls from `oldCmd` to `newCmd`
- See EXAMPLES.md for updated code
```

**Step 4:** Update EXAMPLES.md with new code

**Step 5:** Mark old documentation for archive
```markdown
> **⚠️ DEPRECATED in v12.9.0:** Use newCmd instead
```

**Step 6:** Validate and release
```bash
./scripts/validate-docs.sh
git commit -m "docs: Breaking change - oldCmd -> newCmd (v12.9.0)"
```

---

## Communication

### Release Notes Template

When releasing new documentation:

```markdown
## Documentation Updates - v12.9.0

**New Features Documented:**
- [x] Feature A with examples
- [x] Feature B with deployment guide

**Breaking Changes:**
- Command X renamed to Y (migration guide in API-VERSIONS.md)

**Fixes:**
- Fixed broken link in QUICK-START-GUIDE.md
- Updated deployment examples for new Docker image

**Updated Files:**
- openapi.yaml (new command definitions)
- API-DOCUMENTATION-SUMMARY.md (feature overview)
- EXAMPLES.md (new code examples)
- version.json (version bump)

See API-VERSIONS.md for complete changelog.
```

### Internal Communication

- Notify team of documentation changes
- Point to API-VERSIONS.md for change details
- Direct users to canonical docs
- Archive old documentation with explanation

---

## References

- **Canonical Documentation:** `/docs/API-DOCUMENTATION-SUMMARY.md`
- **API Specification:** `/docs/openapi.yaml`
- **Version History:** `/docs/API-VERSIONS.md`
- **Documentation Structure:** `/docs/wiki/api/RELATIONSHIP.md`
- **Validation Tool:** `/scripts/validate-docs.sh`
- **Current Version:** `/docs/version.json`

---

**Policy Version:** 1.0  
**Effective Date:** June 22, 2026  
**Last Updated:** June 22, 2026  
**Owner:** Technical Lead / Documentation Team

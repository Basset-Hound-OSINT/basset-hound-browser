# API Release Checklist

**Version:** 1.0  
**Last Updated:** June 22, 2026  
**Purpose:** Ensure all documentation is current and validated before release

---

## Pre-Release Documentation Checklist

Use this checklist for **EVERY** release to verify documentation completeness and accuracy.

---

## Phase 1: API Changes (1-2 hours)

### Version Updates
- [ ] Update API version in `openapi.yaml` (top of spec)
- [ ] Update version in `API-DOCUMENTATION-SUMMARY.md` (line 2)
- [ ] Update version in `version.json` (current_version field)
- [ ] Update release date in `version.json` (today's date)
- [ ] All version numbers match across files

### Specification Files
- [ ] `openapi.yaml` is valid YAML/JSON
- [ ] `openapi.yaml` contains all 164 commands (verify count)
- [ ] All new commands have definitions
- [ ] All removed commands are gone
- [ ] Parameter definitions are complete
- [ ] Response schemas are defined
- [ ] Error codes are included

### Examples & Code
- [ ] `EXAMPLES.md` has working code examples
- [ ] Examples use current API (not deprecated commands)
- [ ] Examples are tested (can run successfully)
- [ ] All languages covered (Node.js, Python, cURL)
- [ ] New features have examples
- [ ] Deprecated features have migration examples

### Breaking Changes
- [ ] All breaking changes documented in `API-VERSIONS.md`
- [ ] Migration guides provided
- [ ] Deprecation notices added to old docs
- [ ] Examples show new approach
- [ ] Support matrix updated (if applicable)

---

## Phase 2: Feature Documentation (1-2 hours)

### Feature Overview
- [ ] `API-DOCUMENTATION-SUMMARY.md` is current
- [ ] Feature descriptions match implementation
- [ ] Command count matches openapi.yaml (164+)
- [ ] All new features listed
- [ ] All removed features noted
- [ ] Audience routing is clear

### Quick Start Guide
- [ ] `QUICK-START-GUIDE.md` installation steps work
- [ ] First command (ping) works as documented
- [ ] Connection setup is correct
- [ ] Docker instructions are current
- [ ] Node.js and Python versions are supported

### Integration Guide
- [ ] `INTEGRATION-GUIDE.md` deployment instructions work
- [ ] SDK setup steps are accurate
- [ ] Authentication configuration is current
- [ ] Monitoring examples are valid
- [ ] Performance tuning advice is current
- [ ] Troubleshooting covers common issues

### Version History
- [ ] `API-VERSIONS.md` has new version entry
- [ ] Breaking changes are documented
- [ ] Features are listed
- [ ] Deprecation policy is clear
- [ ] Support timeline is accurate

---

## Phase 3: Wiki Organization (30 minutes)

### Wiki API Directory (`/docs/wiki/api/`)
- [ ] `INDEX.md` references canonical docs
- [ ] `OVERVIEW.md` is current with core concepts
- [ ] `COMPLETE-REFERENCE.md` references canonical source
- [ ] `COMMAND-CATEGORIES.md` is organized by function
- [ ] `WEBSOCKET-PROTOCOL.md` is current
- [ ] `ERROR-CODES.md` matches openapi.yaml
- [ ] `CHANGELOG.md` references API-VERSIONS.md
- [ ] `RELATIONSHIP.md` explains hub-and-spoke model

### Cross-References
- [ ] All canonical docs are linked from wiki/api/INDEX.md
- [ ] Wiki files reference canonical documents
- [ ] No conflicting information between layers
- [ ] All links are relative and working

---

## Phase 4: Infrastructure & Validation (30 minutes)

### Validation
- [ ] Run `/scripts/validate-docs.sh` — **MUST PASS**
  ```bash
  cd /path/to/project
  ./scripts/validate-docs.sh
  ```
- [ ] Fix any issues reported by validation script
- [ ] Re-run validation until all checks pass

### File Validation
- [ ] All files in `/docs/` are readable
- [ ] `openapi.yaml` is valid YAML/JSON
  ```bash
  python3 -c "import yaml; yaml.safe_load(open('docs/openapi.yaml'))"
  ```
- [ ] `version.json` is valid JSON
  ```bash
  python3 -c "import json; json.load(open('docs/version.json'))"
  ```
- [ ] No broken symlinks

### Archive
- [ ] No current docs in `/docs/archive/deprecated/`
- [ ] Archive README is present
- [ ] Archived files have deprecation headers
- [ ] Archive is read-only (git history only)

---

## Phase 5: Cross-Reference Validation (20 minutes)

### Link Verification
- [ ] All links in README.md point to correct files
- [ ] All links in API-DOCUMENTATION-SUMMARY.md work
- [ ] All links in QUICK-START-GUIDE.md work
- [ ] All links in EXAMPLES.md work
- [ ] All wiki links reference canonical docs
- [ ] No references to archived files outside archive/

### Content Consistency
- [ ] Version numbers consistent across all files
- [ ] Command counts match (164 in openapi.yaml)
- [ ] Feature lists are complete
- [ ] No contradictions between documents
- [ ] Examples match API documentation
- [ ] Error codes in ERROR-CODES.md match openapi.yaml

---

## Phase 6: Team Review (15 minutes)

### Sign-offs Required

#### Technical Lead
- [ ] Verify documentation accuracy
- [ ] Check for missing documentation
- [ ] Review examples
- Signature: ________________ Date: __________

#### DevOps/Integration Engineer
- [ ] Verify deployment guide is current
- [ ] Check monitoring examples
- [ ] Review integration patterns
- Signature: ________________ Date: __________

#### Release Manager
- [ ] All checklist items completed
- [ ] Validation script passed
- [ ] Team sign-offs obtained
- Signature: ________________ Date: __________

---

## Phase 7: Final Preparation (10 minutes)

### Git Preparation
- [ ] All changes staged: `git add docs/`
- [ ] Commit message is clear and descriptive
  ```bash
  git commit -m "docs: Update documentation for v12.9.0 release
  
  - Update openapi.yaml with new commands
  - Update API-DOCUMENTATION-SUMMARY.md
  - Add migration guide for breaking changes
  - Update EXAMPLES.md with new features
  - Update version.json (12.9.0)
  
  Changes validated with scripts/validate-docs.sh
  "
  ```

### Pre-Push Review
- [ ] Run validation script one final time
- [ ] Verify git history is clean
- [ ] All sign-offs obtained
- [ ] Ready to push to main branch

---

## Phase 8: Release (2 minutes)

### Push & Tag
- [ ] Create git tag for release
  ```bash
  git tag -a v12.9.0 -m "Release v12.9.0 - Documentation updates"
  ```
- [ ] Push to main branch
  ```bash
  git push origin main
  git push origin v12.9.0
  ```
- [ ] Verify tags are created
  ```bash
  git tag -l | grep v12.9.0
  ```

### Post-Release
- [ ] Release notes include documentation updates
- [ ] Team notified of new documentation
- [ ] Archive previous version docs if needed
- [ ] Update project board/tracking

---

## Validation Command Reference

### Quick Validation
```bash
# Run full validation suite
./scripts/validate-docs.sh

# Check YAML syntax
python3 -c "import yaml; yaml.safe_load(open('docs/openapi.yaml'))"

# Check JSON syntax
python3 -c "import json; json.load(open('docs/version.json'))"
```

### Manual Checks
```bash
# Find broken links
grep -r "\.md)" docs/ | grep -v "archive" | grep -v ".git"

# Check for references to archived files
grep -r "API-REFERENCE-AUTHORITATIVE" docs/ --exclude-dir=archive

# Verify file counts
find docs/wiki/api -name "*.md" | wc -l  # Should be 7+
find docs/archive/deprecated -type f | wc -l  # Should be ~43+
```

---

## Common Issues & Fixes

### Issue: openapi.yaml validation fails
**Solution:**
1. Check indentation (YAML is whitespace-sensitive)
2. Verify all colons have spaces after them
3. Use YAML linter: `yamllint docs/openapi.yaml`

### Issue: Broken links reported
**Solution:**
1. Check file path is relative and correct
2. Verify file exists at target location
3. Update link in source document

### Issue: Version numbers don't match
**Solution:**
1. Update openapi.yaml version
2. Update API-DOCUMENTATION-SUMMARY.md version
3. Update version.json version
4. Verify they all match

### Issue: Validation script fails
**Solution:**
1. Run script with verbose output: `./scripts/validate-docs.sh`
2. Fix reported issues one by one
3. Re-run until all tests pass

---

## Quick Reference

### Files That MUST Be Updated for Every Release

| File | Update | Frequency |
|------|--------|-----------|
| openapi.yaml | Version number | Every release |
| API-DOCUMENTATION-SUMMARY.md | Version number | Every release |
| version.json | Version & date | Every release |
| API-VERSIONS.md | Add version entry | Every release |
| EXAMPLES.md | Update code examples | When features change |
| QUICK-START-GUIDE.md | Update installation | When setup changes |
| INTEGRATION-GUIDE.md | Update deployment | When deploy changes |

### Files That Should Be Reviewed

| File | Review For | Frequency |
|------|-----------|-----------|
| wiki/api/COMPLETE-REFERENCE.md | Command accuracy | Every major release |
| wiki/api/COMMAND-CATEGORIES.md | Category organization | When commands change |
| wiki/api/ERROR-CODES.md | Error code accuracy | When codes change |
| SECURITY.md | Security guidance | When auth/TLS changes |

---

## Time Estimates

| Phase | Duration | Notes |
|-------|----------|-------|
| Phase 1: API Changes | 1-2 hours | Depends on feature scope |
| Phase 2: Feature Docs | 1-2 hours | Update examples and guides |
| Phase 3: Wiki Organization | 30 min | Link verification |
| Phase 4: Infrastructure | 30 min | Run validation scripts |
| Phase 5: Cross-References | 20 min | Verify all links work |
| Phase 6: Team Review | 15 min | Get sign-offs |
| Phase 7: Final Prep | 10 min | Git preparation |
| Phase 8: Release | 2 min | Push to main |
| **TOTAL** | **4-5 hours** | For typical release |

---

## Success Criteria

✅ Release is ready when:

1. All checklist items completed
2. Validation script passes with 0 failures
3. All team sign-offs obtained
4. No broken links
5. Version numbers match across files
6. Examples are tested and working
7. Archive is clean and marked as deprecated
8. Git history is clean

---

## Questions?

Refer to:
- **Maintenance Policy:** `/docs/wiki/MAINTENANCE-POLICY.md`
- **Documentation Architecture:** `/docs/wiki/api/RELATIONSHIP.md`
- **API Index:** `/docs/API-DOCUMENTATION-INDEX.md`

---

**Document Version:** 1.0  
**Last Updated:** June 22, 2026  
**Owner:** Release Manager

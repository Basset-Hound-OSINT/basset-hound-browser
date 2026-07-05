# Repository Governance Checklist

**Last Updated:** June 20, 2026  
**Status:** Active Enforcement  
**Review Frequency:** Before each major commit or release

## Root Directory Audit Checklist

Run this checklist before committing to ensure the root directory remains clean.

### Quick Verification (Before Each Commit)

```bash
# Check for unauthorized .md files at root
find . -maxdepth 1 -type f -name "*.md" ! -name "README.md"
# Expected: No output

# Check for unauthorized .txt files at root  
find . -maxdepth 1 -type f -name "*.txt"
# Expected: No output

# Check for report files at root
find . -maxdepth 1 -type f \( -name "*REPORT*" -o -name "*SUMMARY*" -o -name "*PLAN*" \)
# Expected: No output

# Verify essential files present
ls -1 package.json README.md .gitignore 2>/dev/null && echo "✅ Essential files present"
```

### Root Directory Contents - ALLOWED ONLY

- [ ] `package.json` - NPM configuration
- [ ] `package-lock.json` - NPM lock file
- [ ] `README.md` - Project overview
- [ ] `.gitignore` - Git configuration
- [ ] `.dockerignore` - Docker configuration
- [ ] `REPOSITORY-STANDARDS.md` - Standards enforcement document
- [ ] `Makefile` (optional) - Build automation
- [ ] `docker-compose.yml` (optional) - Docker orchestration
- [ ] `.env.example` (optional) - Environment template
- [ ] `LICENSE` (optional) - Project license

### Files That Should NOT Be at Root - VERIFY ABSENCE

- [ ] ❌ No `*.md` files except README.md
- [ ] ❌ No `SECURITY-*.md` files
- [ ] ❌ No `DEPLOYMENT-*.md` files
- [ ] ❌ No `IMPLEMENTATION-*.md` files
- [ ] ❌ No `*-REPORT*.md` files
- [ ] ❌ No `*-SUMMARY*.md` files
- [ ] ❌ No `REAL-WORLD-TEST-*.md` files
- [ ] ❌ No `FORENSIC-*` files
- [ ] ❌ No `ENCRYPTED-*` files
- [ ] ❌ No `SENSITIVE-DATA-*` files
- [ ] ❌ No `.txt` report files
- [ ] ❌ No build logs or artifacts at root
- [ ] ❌ No deployment scripts at root (should be in scripts/)
- [ ] ❌ No configuration files at root (should be in config/)

## Documentation Organization Checklist

### Verify docs/ Subdirectories

- [ ] `docs/api/` - WebSocket API documentation exists
- [ ] `docs/guides/` - User and deployment guides exist
- [ ] `docs/security/` - Security documentation exists and is current
- [ ] `docs/testing/` - Testing documentation and results exist
- [ ] `docs/research/` - Research and analysis documents exist
- [ ] `docs/archive/` - Historical records properly organized
- [ ] `docs/deployment/` - Deployment procedures documented
- [ ] `docs/compliance/` - Compliance documentation exists
- [ ] `docs/advanced/` - Advanced features documented
- [ ] `docs/customer-success/` - Customer documentation exists
- [ ] `docs/core/` - Core architecture documented
- [ ] `docs/analysis/` - Code and performance analysis exists

### Documentation Audit

- [ ] No orphaned documentation files (check last modified dates)
- [ ] All recent documentation properly categorized
- [ ] INDEX.md files exist in major directories
- [ ] Cross-references between docs are correct
- [ ] No duplicate documentation across directories

## File Organization Audit

### Configuration Files

- [ ] All `.config.*` files in `config/` directory
- [ ] All environment templates in `config/` directory
- [ ] No configuration files at root
- [ ] No configuration files scattered in subdirectories

### Automation Scripts

- [ ] All `.sh` files in `scripts/` directory
- [ ] All deployment scripts in `scripts/`
- [ ] No scripts at root level
- [ ] Scripts directory is organized (sub-folders if needed)

### Source Code

- [ ] All production code in `src/` directory
- [ ] All modules properly organized within `src/`
- [ ] No loose `.js` files at root
- [ ] Main entry points documented

### Tests

- [ ] All test files in `tests/` directory
- [ ] Test results in `tests/results/`
- [ ] Test configuration in `tests/` root
- [ ] No test files at root level

## Standards Compliance Checklist

### Documentation Standards

- [ ] `REPOSITORY-STANDARDS.md` is current and complete
- [ ] `AGENT-WORKFLOW-STANDARDS.md` is referenced in agent prompts
- [ ] All standards documented with examples
- [ ] Directory structure guidelines clear
- [ ] File placement rules unambiguous

### Enforcement Mechanisms

- [ ] Pre-commit hooks configured (if applicable)
- [ ] CI/CD pipeline checks repository structure
- [ ] Code review checklist includes file placement
- [ ] Deploy scripts verify root directory cleanliness

### Agent Integration

- [ ] All active agent prompts include repository organization instruction
- [ ] Agents verify file placement before completing tasks
- [ ] Agent prompts reference AGENT-WORKFLOW-STANDARDS.md
- [ ] New agents briefed on standards before deployment

## Migration Status - June 20, 2026

### Files Migrated

- [x] `SECURITY-IMPLEMENTATION-SUMMARY.md` → `docs/security/`
- [x] `SECURITY-QUICK-REFERENCE.md` → `docs/security/`

### Standards Documents Created

- [x] `/REPOSITORY-STANDARDS.md` (root level, 8,024 bytes)
- [x] `/docs/AGENT-WORKFLOW-STANDARDS.md` (7,226 bytes)
- [x] `/docs/GOVERNANCE-CHECKLIST.md` (this document)

## Quarterly Governance Review

Schedule: Last week of each quarter

### Q3 2026 Review (Due: September 24, 2026)

- [ ] Root directory contains ONLY essential files
- [ ] No new documentation files created at root
- [ ] docs/ subdirectories remain organized
- [ ] All agents following repository standards
- [ ] Standards documents are current
- [ ] New subdirectories (if any) properly documented
- [ ] Agent prompts still include organization instruction
- [ ] No orphaned files or directories found

### Q4 2026 Review (Due: December 24, 2026)

- [ ] (Will be populated in next review cycle)

## Verification Command Reference

### Quick Audit (5 seconds)
```bash
# Check for root .md files (except README.md)
find . -maxdepth 1 -name "*.md" ! -name "README.md" && echo "FAIL: Found .md files at root" || echo "PASS: No .md files at root"
```

### Full Audit (1 minute)
```bash
# Run this script for comprehensive verification
#!/bin/bash
echo "=== Repository Governance Audit ==="
echo ""
echo "1. Root directory files:"
ls -1 ./*.{md,txt,json,yml} 2>/dev/null | sed 's|./||' || echo "  (none found - good)"
echo ""
echo "2. Unauthorized files at root:"
find . -maxdepth 1 -type f \( -name "SECURITY-*" -o -name "DEPLOYMENT-*" -o -name "*REPORT*" -o -name "*SUMMARY*" \) ! -name "README.md" && echo "  FAIL" || echo "  PASS"
echo ""
echo "3. Docs directory structure:"
for dir in api guides security testing research archive deployment; do
  [ -d "docs/$dir" ] && echo "  ✓ docs/$dir" || echo "  ✗ docs/$dir (missing)"
done
echo ""
echo "4. Root directory MUST contain:"
for file in package.json README.md .gitignore; do
  [ -f "$file" ] && echo "  ✓ $file" || echo "  ✗ $file (missing)"
done
```

### Detailed Documentation Audit
```bash
# Find all .md files and their locations
echo "=== Documentation Files Audit ==="
find docs -name "*.md" | wc -l
echo "documentation files found in docs/"

# Check for orphaned .md files
find . -maxdepth 2 -name "*.md" ! -path "./docs/*" ! -name "README.md" ! -path "./.git/*"
```

## Sign-Off Template

Use this template when completing governance audits:

```markdown
## Governance Audit Sign-Off

**Date:** [DATE]  
**Auditor:** [NAME/AGENT]  
**Status:** ✅ PASS / ⚠️ NEEDS ATTENTION

### Results
- Root directory cleanliness: ✅ PASS
- Documentation organization: ✅ PASS  
- File placement compliance: ✅ PASS
- Standards adherence: ✅ PASS

### Findings
[List any issues found, if any]

### Actions Taken
[List remediation actions, if any]

### Next Review
[Date of next scheduled review]
```

## Questions and Escalation

For questions about repository governance:

1. **File Placement** - See `REPOSITORY-STANDARDS.md` section "Directory Structure"
2. **Agent Standards** - See `AGENT-WORKFLOW-STANDARDS.md`
3. **Standards Updates** - Contact repository governance lead
4. **Exceptions** - Must be documented in this checklist and approved

## Related Documents

- `/REPOSITORY-STANDARDS.md` - Global standards and enforcement
- `/docs/AGENT-WORKFLOW-STANDARDS.md` - Agent-specific implementation
- `/README.md` - Project overview (should reference standards)

---

**Maintainer:** Repository Governance Team  
**Last Reviewed:** June 20, 2026  
**Next Review:** September 24, 2026 (Q3 2026)

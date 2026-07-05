# Repository Organization Standards

**Version:** 1.0  
**Last Updated:** June 20, 2026  
**Status:** Active - Enforced across all development workflows

## Purpose

This document enforces strict organizational standards to prevent file leakage into the root directory and maintain a clean, navigable repository structure. All developers, agents, and automated workflows MUST follow these standards.

## Root Directory - Essential Files Only

The project root directory contains ONLY essential configuration and entry point files:

### Allowed at Root (10 files maximum):
- `package.json` - NPM package configuration
- `package-lock.json` - NPM dependency lock file
- `README.md` - Project overview and setup instructions
- `.gitignore` - Git ignore rules
- `.dockerignore` - Docker ignore rules
- `Makefile` - Build automation (if applicable)
- `docker-compose.yml` - Docker orchestration (if applicable)
- `.env.example` - Environment template (NO actual .env files)
- `LICENSE` - Project license
- `.editorconfig` - Editor configuration (if applicable)

### PROHIBITED at Root:
- ❌ Any documentation files except README.md
- ❌ FORENSIC-*, ENCRYPTED-*, SENSITIVE-DATA-*, ROOT-NAVIGATION.md files
- ❌ REAL-WORLD-TEST-RESULTS-*.md or similar report files
- ❌ SECURITY-HARDENING-*, IMPLEMENTATION-SUMMARY files
- ❌ BUILD-*, DEPLOYMENT-*, RELEASE-* files
- ❌ Session records, analysis reports, or planning documents
- ❌ Any .md files created during development (use docs/ instead)
- ❌ Any .txt report files
- ❌ Archives, backups, or temporary files

## Directory Structure and File Placement

### `/docs/` - All Documentation
Primary location for ALL project documentation, guides, and reports.

**Subdirectories:**
- `api/` - WebSocket API documentation, command reference, integration examples
- `guides/` - User guides, deployment guides, integration guides
- `security/` - Security documentation, hardening guides, vulnerability reports
- `testing/` - Testing strategies, test results, real-world testing reports
- `archive/` - Historical records, completed phases, previous versions
- `research/` - Research documents, analysis reports, design documents
- `compliance/` - Compliance documentation, standards, policies
- `deployment/` - Deployment procedures, runbooks, checklists
- `advanced/` - Advanced features, custom integration guides
- `customer-success/` - Customer documentation, FAQs, examples
- `core/` - Core architecture documentation
- `analysis/` - Code analysis, performance analysis reports

**File Placement Rules:**
- API docs → `docs/api/`
- Real-world test results → `docs/testing/`
- Security reports → `docs/security/`
- Implementation summaries → `docs/archive/` or specific subdirectory
- Planning documents → `docs/research/` or `docs/archive/`
- Deployment reports → `docs/deployment/`
- Performance analysis → `docs/analysis/`

### `/config/` - Configuration Files
All configuration files and examples:
- Database configurations
- Service configurations
- Environment templates
- Deployment configurations

### `/scripts/` - Automation Scripts
All shell scripts, automation tools, and operational scripts:
- Deployment scripts
- Build scripts
- Maintenance scripts
- CI/CD helpers

### `/src/` - Application Source Code
All production source code:
- Electron main process (`src/main/`)
- WebSocket API (`src/websocket/`)
- Evasion modules (`src/evasion/`)
- Extraction modules (`src/extraction/`)
- All other production code

### `/tests/` - Test Suite
All test files and test results:
- Unit tests
- Integration tests
- E2E tests
- Test reports (in `tests/results/`)

### `/assets/` - Static Assets
Images, icons, and other static resources

### Supporting Directories
- `.claude/` - Claude Code configuration
- `.github/` - GitHub Actions and templates
- `.git/` - Git repository metadata
- `node_modules/` - NPM dependencies
- `dist/` - Build output
- `coverage/` - Test coverage reports

## Critical Rules for All Developers and Agents

### RULE 1: Never Create Files in Root
**NEVER create any files in the project root directory.**

Always use the appropriate subdirectory:
```
❌ DON'T:   ./IMPLEMENTATION-SUMMARY.md
✅ DO:      ./docs/archive/IMPLEMENTATION-SUMMARY.md

❌ DON'T:   ./REAL-WORLD-TEST-RESULTS.md
✅ DO:      ./docs/testing/REAL-WORLD-TEST-RESULTS.md

❌ DON'T:   ./deploy-script.sh
✅ DO:      ./scripts/deploy.sh

❌ DON'T:   ./app.config.json
✅ DO:      ./config/app.json
```

### RULE 2: Proper Naming and Organization
- Use descriptive filenames with dates when appropriate
- Keep related files in the same subdirectory
- Don't scatter documentation across multiple locations
- Use subdirectory indices (INDEX.md) to navigate large directories

### RULE 3: Cleanup Before Committing
Before creating a commit:
1. Run: `find . -maxdepth 1 -type f -name "*.md" ! -name "README.md"`
2. If any results appear, move them to the appropriate `docs/` subdirectory
3. Verify no reports or session records exist at root level

### RULE 4: AI Agent Enforcement
All Claude agents and automation must include this instruction in their prompts:

```
IMPORTANT: Never create files in the project root directory. Use proper subdirectories:
- Documentation → docs/ (with subdirectories: api/, guides/, security/, testing/, archive/, research/)
- Configuration → config/
- Scripts → scripts/
- Code → src/
- Tests → tests/

VERIFY: Before finalizing work, confirm no files were created in the root directory.
Only essential root files: package.json, README.md, .gitignore, .dockerignore, Makefile
```

## Enforcement Mechanism

### Automated Checks
- Pre-commit hooks scan for documentation files in root
- CI/CD pipeline fails if .md files found at root (except README.md)
- Deployment blocks if repository structure violations detected

### Manual Review
- Code reviews check for root directory violations
- Repository governance audits performed quarterly

## When to Create New Subdirectories

Only create new subdirectories in `/docs/` if:
1. You have 10+ related files that don't fit existing categories
2. The category is fundamentally different from existing ones
3. You document the new category in this file
4. You create an INDEX.md in the new subdirectory

## Examples of Correct Placement

### Scenario: Creating a new testing report
```
Report title:     REAL-WORLD-TEST-RESULTS-2026-06-20.md
Correct location: docs/testing/REAL-WORLD-TEST-RESULTS-2026-06-20.md
```

### Scenario: Writing deployment documentation
```
File:             DEPLOYMENT-GUIDE.md
Correct location: docs/deployment/DEPLOYMENT-GUIDE.md
                  (or docs/guides/DEPLOYMENT-GUIDE.md)
```

### Scenario: Storing security analysis
```
File:             SECURITY-IMPLEMENTATION-SUMMARY.md
Correct location: docs/security/SECURITY-IMPLEMENTATION-SUMMARY.md
```

### Scenario: Adding build automation
```
File:             build-and-deploy.sh
Correct location: scripts/build-and-deploy.sh
```

### Scenario: Environment configuration
```
File:             database.config.json
Correct location: config/database.config.json
```

## Migration Status

**Last Migration Date:** June 20, 2026

### Files Migrated:
- `SECURITY-IMPLEMENTATION-SUMMARY.md` → `docs/security/`
- `SECURITY-QUICK-REFERENCE.md` → `docs/security/`

### Root Directory Status:
✅ **CLEAN** - Only essential files remain
- `package.json`
- `package-lock.json`
- `README.md`
- `.gitignore`
- `.dockerignore`

## Questions and Clarifications

For questions about proper file placement:
1. Check the directory structure section above
2. Look for similar files in `docs/` subdirectories
3. If unclear, place in `docs/archive/` temporarily
4. Document the decision for future reference

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-20 | Initial version - Migrated 2 security files to docs/, established standards |

---

**Approved by:** Repository Governance  
**Effective Date:** June 20, 2026  
**Review Cycle:** Quarterly

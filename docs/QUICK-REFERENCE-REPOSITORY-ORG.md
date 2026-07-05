# Repository Organization - Quick Reference

**Print this and post on your desk!**

## The Golden Rule

✅ **DO THIS:**
```
Documentation → docs/
Configuration → config/  
Scripts → scripts/
Code → src/
Tests → tests/
```

❌ **NEVER DO THIS:**
```
Documentation at root like ./DEPLOYMENT-GUIDE.md
Configuration at root like ./app.config.json
Scripts at root like ./build.sh
Report files at root like ./IMPLEMENTATION-SUMMARY.md
```

---

## Quick File Placement Guide

### API & Documentation Files
| File Type | Goes To |
|-----------|---------|
| API documentation | `docs/api/` |
| User guides | `docs/guides/` |
| Deployment guides | `docs/guides/` or `docs/deployment/` |
| Integration guides | `docs/guides/integration/` |
| Security docs | `docs/security/` |
| Testing strategies | `docs/testing/` |
| Test results | `docs/testing/` or `tests/results/` |
| Research/Analysis | `docs/research/` |
| Historical records | `docs/archive/` |
| Compliance docs | `docs/compliance/` |

### Configuration & Scripts
| File Type | Goes To |
|-----------|---------|
| `.config.json` | `config/` |
| `.env.example` | `config/` |
| Database config | `config/` |
| `*.sh` scripts | `scripts/` |
| Build scripts | `scripts/` |
| Deploy scripts | `scripts/` |

### Application Files
| File Type | Goes To |
|-----------|---------|
| Application code | `src/` |
| Tests | `tests/` |
| Static assets | `assets/` |
| Build output | `dist/` |

---

## One-Minute Verification

Before committing, run this:

```bash
# Should return NOTHING (clean)
find . -maxdepth 1 -name "*.md" ! -name "README.md"

# Should return NOTHING (clean)
find . -maxdepth 1 -name "*.txt"

# Should show only package.json, README.md, .gitignore, .dockerignore
ls -1 ./*.{json,md,ignore} 2>/dev/null
```

If anything appears, move it to the appropriate directory!

---

## Common Mistakes → Corrections

### WRONG → RIGHT

```
./DEPLOYMENT-GUIDE.md 
→ docs/guides/DEPLOYMENT-GUIDE.md

./my-build-script.sh
→ scripts/my-build-script.sh

./app.config.json
→ config/app.json

./REAL-WORLD-TEST-RESULTS.md
→ docs/testing/REAL-WORLD-TEST-RESULTS.md

./SECURITY-ANALYSIS.md
→ docs/security/SECURITY-ANALYSIS.md

./IMPLEMENTATION-SUMMARY.md
→ docs/archive/IMPLEMENTATION-SUMMARY.md
```

---

## Root Directory - What's Allowed

✅ ALLOWED (Only these):
- `package.json`
- `package-lock.json`
- `README.md`
- `.gitignore`
- `.dockerignore`
- `Makefile` (if needed)
- `docker-compose.yml` (if needed)
- `LICENSE` (if needed)
- `REPOSITORY-STANDARDS.md` (standards only)

❌ NEVER AT ROOT:
- Any other `.md` files
- `.txt` files
- Report files
- Configuration files
- Script files
- Archive files

---

## When You're Not Sure

**Rule of thumb:** If it's documentation, analysis, or a report → goes in `docs/`

Ask yourself:
1. Is this documentation? → `docs/[category]/`
2. Is this a script? → `scripts/`
3. Is this config? → `config/`
4. Is this code? → `src/`
5. Is this a test? → `tests/`

If still unsure → `docs/archive/` temporarily, then ask for clarification

---

## Docs Subdirectories

```
docs/
├── api/                  - API reference, command docs
├── guides/              - How-to guides, deployment, integration
├── security/            - Security hardening, vulns, compliance
├── testing/             - Testing strategies, results
├── research/            - Design docs, analysis, research
├── archive/             - Historical, completed phases
├── deployment/          - Deployment procedures, runbooks
├── compliance/          - Standards, policies
├── advanced/            - Advanced features, custom integration
├── customer-success/    - Customer docs, FAQs
├── core/                - Core architecture
├── analysis/            - Code & performance analysis
└── [standards]          - AGENT-WORKFLOW-STANDARDS.md, etc.
```

---

## Agent Instruction

Every agent should include this instruction:

```
IMPORTANT: Never create files in the project root directory.
Use proper subdirectories:
- Documentation → docs/
- Configuration → config/
- Scripts → scripts/
- Code → src/
- Tests → tests/

VERIFY before finishing: No files created at root except allowed ones.
```

---

## For More Details

See:
- **Global Rules:** `/REPOSITORY-STANDARDS.md`
- **Agent Guidelines:** `/docs/AGENT-WORKFLOW-STANDARDS.md`
- **Audit Checklist:** `/docs/GOVERNANCE-CHECKLIST.md`

---

**Last Updated:** June 20, 2026  
**Status:** Active - All files must follow this guide

# File Placement Rules - Basset Hound Browser

**Version:** 1.0  
**Created:** June 21, 2026  
**Audience:** All Agents & Developers  
**Purpose:** Enforce clean repository organization with designated directories for all file types

---

## CRITICAL: Root Directory is Sacred

The project root (`/home/devel/basset-hound-browser/`) must contain **ONLY**:
- `package.json`
- `package-lock.json`
- `README.md`
- `.gitignore`
- `.dockerignore`
- `Makefile` (if applicable)

**ALL OTHER FILES MUST BE IN SUBDIRECTORIES.**

---

## Complete Directory Mapping

### Documentation Files (.md)

| File Type | Directory | Purpose | Example |
|-----------|-----------|---------|---------|
| API Documentation | `docs/api/` | WebSocket commands, API reference | `docs/api/websocket-commands.md` |
| Integration Guides | `docs/guides/` | Deployment, setup, user guides | `docs/guides/deployment-guide.md` |
| Security Documentation | `docs/security/` | Vulnerability reports, hardening | `docs/security/hardening-guide.md` |
| Testing & Results | `docs/testing/` | Test strategies, real-world results | `docs/testing/real-world-results.md` |
| Research & Analysis | `docs/research/` | Technical research, design docs | `docs/research/evasion-techniques.md` |
| Historical Records | `docs/archive/` | Completed phases, old versions | `docs/archive/v11-implementation/` |
| Generated Reports | `docs/archive/generated/` | Completion reports, summaries | `docs/archive/generated/PHASE1-COMPLETION.md` |
| Handoff Documentation | `docs/handoffs/` | Sprint summaries, agent templates | `docs/handoffs/AGENT-SPAWNING-TEMPLATES.md` |
| Compliance & Standards | `docs/compliance/` | Regulatory, standards compliance | `docs/compliance/privacy-policy.md` |
| Advanced Features | `docs/advanced/` | Advanced feature docs | `docs/advanced/fingerprinting.md` |
| Core Architecture | `docs/core/` | Core system architecture | `docs/core/architecture.md` |
| Customer Success | `docs/customer-success/` | FAQs, customer guides | `docs/customer-success/faq.md` |
| Performance & Optimization | `docs/performance/` | Optimization docs, benchmarks | `docs/performance/optimization.md` |

### Generated/Output Files

| File Type | Directory | Purpose |
|-----------|-----------|---------|
| Test Results | `tests/results/` | Jest output, test reports |
| Test Artifacts | `tests/output/` | Screenshots, logs, detailed outputs |
| Test Certificates | `tests/certs/` | SSL/TLS certs for testing |
| Temporary Files | `tmp/` | Temporary debug files, scratch space |
| Coverage Reports | `coverage/` | Jest coverage reports |

### Configuration Files

| File Type | Directory |
|-----------|-----------|
| Application Config | `config/` |
| Environment Templates | `config/` |
| Docker Config | Root or `infrastructure/` |

### Source Code & Scripts

| File Type | Directory | Purpose |
|-----------|-----------|---------|
| Main Source | `src/` | Application source code |
| Deployment Scripts | `scripts/` | Deploy, build, maintenance scripts |
| Example Scripts | `examples/[category]/` | Usage examples in multiple languages |
| Test Files | `tests/` | Test suites |

---

## Common Scenarios & Correct Placement

### Scenario: You Complete Phase 1 and Write a Completion Report

❌ **WRONG:**
```
./PHASE1-COMPLETION.md
./PHASE1-TEST-RESULTS.txt
```

✅ **RIGHT:**
```
./docs/archive/generated/PHASE1-COMPLETION.md
./docs/archive/generated/PHASE1-TEST-RESULTS.txt
```

### Scenario: You Create a New Integration Guide

❌ **WRONG:**
```
./PYTHON-INTEGRATION.md
```

✅ **RIGHT:**
```
./docs/guides/python-integration.md
```

### Scenario: You Write Security Documentation

❌ **WRONG:**
```
./SECURITY-FINDINGS.md
./VULNERABILITY-REPORT.md
```

✅ **RIGHT:**
```
./docs/security/security-findings.md
./docs/security/vulnerability-report.md
```

### Scenario: You Create Performance Analysis

❌ **WRONG:**
```
./PERFORMANCE-ANALYSIS.md
./OPTIMIZATION-OPPORTUNITIES.md
```

✅ **RIGHT:**
```
./docs/performance/performance-analysis.md
./docs/performance/optimization-opportunities.md
```

### Scenario: You Generate Test Screenshots

❌ **WRONG:**
```
./screenshot-0.png
./screenshot-1.png
```

✅ **RIGHT:**
```
./tests/output/screenshots/screenshot-0.png
./tests/output/screenshots/screenshot-1.png
```

### Scenario: You Create Example Code

❌ **WRONG:**
```
./python-websocket-client.py
./nodejs-example.js
```

✅ **RIGHT:**
```
./examples/api-usage/python-websocket-client.py
./examples/api-usage/nodejs-example.js
```

---

## Verification Command

Before finalizing your work, run this command to verify NO files were created in root:

```bash
# Check for .md files (except README.md)
find . -maxdepth 1 -type f -name "*.md" ! -name "README.md"

# Check for .txt files
find . -maxdepth 1 -type f -name "*.txt"

# Check for .json files (except package.json/package-lock.json)
find . -maxdepth 1 -type f -name "*.json" ! -name "package.json" ! -name "package-lock.json"

# If any files appear, MOVE THEM IMMEDIATELY
```

**Expected result:** Empty (no output)

---

## Why This Matters

1. **Clean Git History** - No accidental root-level files committed
2. **Maintainability** - Developers know where to find documentation
3. **Automation** - Scripts can reliably clean test artifacts
4. **CI/CD** - Deployment pipelines expect specific directory structures
5. **Scalability** - As project grows, organization prevents chaos

---

## Quick Reference Card

Print or bookmark this:

```
📁 Documentation          → docs/[category]/
📁 Generated Reports      → docs/archive/generated/
📁 API Docs              → docs/api/
📁 Guides                → docs/guides/
📁 Security              → docs/security/
📁 Testing Results       → docs/testing/
📁 Research              → docs/research/
📁 Archived Content      → docs/archive/
📁 Test Certs            → tests/certs/
📁 Test Results          → tests/results/
📁 Test Artifacts        → tests/output/
📁 Temporary             → tmp/
📁 Configuration         → config/
📁 Scripts               → scripts/
📁 Examples              → examples/[category]/
📁 Source Code           → src/
```

---

## Enforcement

**All agents spawned with AGENT-SPAWNING-TEMPLATES.md include this instruction.**

**Final report must include:**
- ✅ Files created and their locations
- ✅ Verification that root directory is clean
- ✅ Directory structure compliance check

If root directory violation is detected, the task is **INCOMPLETE** until corrected.

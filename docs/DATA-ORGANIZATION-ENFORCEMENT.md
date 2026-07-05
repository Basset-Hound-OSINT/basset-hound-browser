# Data Organization Enforcement Guide

**Version:** 1.0  
**Created:** June 21, 2026  
**Purpose:** Prevent root directory clutter and enforce clean repository structure

---

## The Rule (Simple & Absolute)

**Generated data → `./tmp/`**  
**Source code & docs → Appropriate `./src/`, `./docs/`, `./tests/`, `./scripts/` directories**  
**Nothing else in root.**

---

## What Is "Generated Data"?

Generated data is anything created **during development that is NOT part of the source code**:

### Examples of GENERATED DATA (goes to tmp/)
- ✅ Test output files (`test-results.json`, `coverage.json`)
- ✅ Performance reports (`load-test-results.txt`)
- ✅ Screenshots from test runs (`test-screenshot-0.png`)
- ✅ Temporary logs (`debug.log`, `build.log`)
- ✅ Build artifacts (`dist/`, compiled output)
- ✅ Session files, databases, caches
- ✅ Execution traces, metrics, analytics
- ✅ Any `.txt`, `.json`, `.log` created by tests or scripts

### Examples of SOURCE CODE (keep in src/, tests/)
- ❌ NOT `.js` files in `src/` (these are source)
- ❌ NOT `.test.js` files in `tests/` (these are source)
- ❌ NOT configuration in `config/` (these are config)
- ❌ NOT automation scripts in `scripts/` (these are infrastructure)

### Examples of DOCUMENTATION (keep in docs/)
- ❌ NOT API documentation (goes to `docs/api/`)
- ❌ NOT user guides (goes to `docs/guides/`)
- ❌ NOT security docs (goes to `docs/security/`)
- ❌ NOT README.md (keep in root, it's the entry point)

---

## Directory Structure

```
basset-hound-browser/
├── package.json                    ✅ KEEP (source config)
├── package-lock.json              ✅ KEEP (dependency lock)
├── README.md                       ✅ KEEP (entry point)
├── .gitignore                      ✅ KEEP (git config)
├── .dockerignore                   ✅ KEEP (docker config)
│
├── src/                            ✅ Source code
│   ├── main/
│   ├── websocket/
│   ├── evasion/
│   └── extraction/
│
├── tests/                          ✅ Test source code
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── results/                    Generated test output
│   └── output/                     Generated test output
│
├── docs/                           ✅ Documentation
│   ├── api/                        API reference docs
│   ├── guides/                     User & integration guides
│   ├── security/                   Security documentation
│   ├── testing/                    Testing strategies & results
│   ├── research/                   Research & analysis docs
│   ├── handoffs/                   Handoff docs for future devs
│   ├── archive/                    Historical records
│   │   └── generated/              Generated reports & summaries
│   ├── core/                       Core architecture docs
│   └── ...
│
├── scripts/                        ✅ Infrastructure scripts
│   ├── deploy.sh
│   ├── build.sh
│   └── test-runner.sh
│
├── config/                         ✅ Configuration files
│   ├── app.config.json
│   └── ...
│
├── examples/                       ✅ Example code
│   ├── api-usage/
│   ├── integration/
│   └── forensic-export/
│
├── tmp/                            TEMPORARY DATA (not committed)
│   ├── test-results/               Test output files
│   ├── reports/                    Generated reports
│   ├── screenshots/                Test screenshots
│   ├── logs/                       Debug & runtime logs
│   ├── build/                      Build artifacts
│   ├── data/                       Temporary data files
│   └── .gitkeep                    Ensure directory exists
│
└── [NOTHING ELSE IN ROOT]         ❌ VIOLATION
```

---

## MANDATORY AGENT INSTRUCTION TEMPLATE

**Use this exact template when spawning ANY agent that will generate files or output.**

### Minimum Required Instruction

```
CRITICAL: Data Organization Rule (MANDATORY)

ALL GENERATED DATA GOES TO ./tmp/ OR docs/ (NEVER root)

Root contains ONLY:
- package.json
- package-lock.json
- README.md
- .gitignore
- .dockerignore
- .eslintrc.json
- .eslintignore
- SECURITY.md

Generated files MUST be placed in:
- Test outputs → tmp/test-results/
- Reports → tmp/reports/
- Screenshots → tmp/screenshots/
- Logs → tmp/logs/
- Build artifacts → tmp/build/
- Temporary data → tmp/data/
- Handoff docs → docs/handoffs/ (if needed for knowledge transfer)
- Archive docs → docs/archive/generated/ (if needed for historical records)

BEFORE COMPLETING YOUR WORK:
1. Run: find . -maxdepth 1 \( -name "*.md" ! -name "README.md" -o -name "*.txt" -o -name "*.json" ! -name "package.json" ! -name "package-lock.json" ! -name ".eslintrc.json" \)
2. If this returns ANY files → MOVE THEM IMMEDIATELY to appropriate directory
3. Report in your summary: "All generated files organized: [list paths moved]"

The root directory must be clean before finalizing.
```

### When to Use This Template

**ALWAYS include this instruction when:**
- Spawning an agent that will create test outputs
- Spawning an agent that will create reports or summaries
- Spawning an agent that will create documentation
- Spawning an agent that will generate screenshots, logs, or metrics
- Instructing a developer to create output files
- Setting up any automation or CI/CD process

**Reference point:** Include link to this document: `/docs/DATA-ORGANIZATION-ENFORCEMENT.md`

---

## How to Enforce This

### Before Finalizing Your Work

Run these verification commands:

```bash
# Check for markdown files in root (except README.md)
find . -maxdepth 1 -type f -name "*.md" ! -name "README.md"

# Check for text files in root
find . -maxdepth 1 -type f -name "*.txt"

# Check for json files in root (except package.json, package-lock.json, .eslintrc.json)
find . -maxdepth 1 -type f -name "*.json" ! -name "package.json" ! -name "package-lock.json" ! -name ".eslintrc.json"

# Combined check (should return EMPTY)
find . -maxdepth 1 \( -name "*.md" ! -name "README.md" -o -name "*.txt" -o -name "*.json" ! -name "package.json" ! -name "package-lock.json" ! -name ".eslintrc.json" \)
```

**If any files appear → MOVE THEM IMMEDIATELY to appropriate directory.**

### Before Committing

```bash
git status | grep "^?? " | grep -E "\.(md|txt|json)$"
```

If this shows files, **STOP** and move them before committing.

---

## File Placement Examples

### Test Output

```
WRONG:  ./test-results.json
RIGHT:  ./tmp/test-results/test-results.json

WRONG:  ./coverage-report.html
RIGHT:  ./tmp/test-results/coverage-report.html
```

### Performance Reports

```
WRONG:  ./load-test-results.txt
RIGHT:  ./tmp/reports/load-test-results.txt

WRONG:  ./PERFORMANCE-METRICS-2026-06-21.md
RIGHT:  ./docs/archive/generated/PERFORMANCE-METRICS-2026-06-21.md
```

### Screenshots

```
WRONG:  ./screenshot-0.png
RIGHT:  ./tmp/screenshots/screenshot-0.png

WRONG:  ./test-screenshots/
RIGHT:  ./tmp/screenshots/
```

### Logs

```
WRONG:  ./debug.log
RIGHT:  ./tmp/logs/debug.log

WRONG:  ./build.log
RIGHT:  ./tmp/logs/build.log
```

### Handoff Documentation

```
WRONG:  ./PHASE-COMPLETION-SUMMARY.md
RIGHT:  ./docs/handoffs/PHASE-COMPLETION-SUMMARY.md
        (for historical value to future developers)

WRONG:  ./REAL-WORLD-TEST-RESULTS.md
RIGHT:  ./docs/testing/REAL-WORLD-TEST-RESULTS.md
        (for ongoing reference)
```

---

## When Writing Code

### For Developers

1. **Imports/requires:** Store in `src/`, `tests/`, `scripts/`
2. **Output files:** Write to `tmp/[category]/` or `tests/results/`
3. **Configuration:** Store in `config/` or as environment variables
4. **Documentation:** Write to `docs/[category]/`

### For Test Writers

1. **Test code:** Write to `tests/[unit|integration|e2e]/`
2. **Test output:** Write to `tests/results/` or `tmp/test-results/`
3. **Fixtures:** Store in `tests/fixtures/` or `tests/certs/`
4. **Test screenshots:** Write to `tmp/screenshots/`

### For Script Writers

1. **Automation scripts:** Write to `scripts/`
2. **Script output:** Write to `tmp/logs/` or `tmp/reports/`
3. **Script configuration:** Store in `config/` or as parameters

---

## How to Tell Agents

When spawning agents or instructing developers, use this language:

```
CRITICAL INSTRUCTION - Data Organization:

All generated data goes to ./tmp/ or designated docs/ subdirectories.
The root directory contains ONLY:
- package.json, package-lock.json
- README.md
- .gitignore, .dockerignore
- Makefile (if applicable)

Generated files:
- Test results → tmp/test-results/
- Reports → tmp/reports/
- Screenshots → tmp/screenshots/
- Logs → tmp/logs/
- Build artifacts → tmp/build/
- Temporary data → tmp/data/

Before finalizing:
1. Run: find . -maxdepth 1 \( -name "*.md" ! -name "README.md" -o -name "*.txt" \)
2. If any files appear, move them immediately
3. Report file placements in your summary
```

---

## Why This Matters

### 1. Repository Signal
Developers looking at the root see the project structure, not generated noise.

### 2. Git Cleanliness
Prevents accidentally committing test artifacts, build outputs, or temporary data.

### 3. Integration Safety
External systems (CI/CD, deployments) aren't confused by temp files in root.

### 4. .gitignore Effectiveness
Clear patterns in `.gitignore` protect against accidents:
```
/tmp/**/*
!/tmp/
!/tmp/.gitkeep
```

### 5. Maintenance Burden
A clean root = easier navigation = faster development.

---

## What Gets Tracked in Git

### YES - Track These in Git
- ✅ Source code (`src/`)
- ✅ Tests (`tests/`)
- ✅ Documentation (`docs/`)
- ✅ Configuration (`config/`, `.gitignore`, etc.)
- ✅ Scripts (`scripts/`)
- ✅ Examples (`examples/`)
- ✅ Handoff docs (`docs/handoffs/`) - for future developers

### NO - Never Track These
- ❌ Generated test output
- ❌ Performance reports (unless archived in `docs/archive/generated/`)
- ❌ Screenshots from test runs
- ❌ Build artifacts
- ❌ Logs
- ❌ Temporary files

---

## Quick Reference

| Question | Answer | Action |
|----------|--------|--------|
| I created a test output file | Generated data | Move to `tmp/test-results/` |
| I need to document a completed phase | Documentation | Put in `docs/handoffs/` or `docs/archive/generated/` |
| I wrote a deployment script | Source code | Keep in `scripts/` |
| I generated performance metrics | Generated data | Move to `tmp/reports/` |
| I took a screenshot for testing | Generated data | Move to `tmp/screenshots/` |
| I need to update the README | Source doc | Edit `README.md` in root |
| I wrote API documentation | Source doc | Put in `docs/api/` |

---

**Key Takeaway:** 

If you created it during development and it's not part of the actual codebase, **it goes to `./tmp/` or an archive location**. Root directory stays clean.

---

**Version:** 1.0  
**Created:** June 21, 2026  
**Status:** Active Enforcement Policy

# Data Organization Escalation Plan & Recurrence Prevention

**Version:** 1.0  
**Created:** June 21, 2026  
**Purpose:** Prevent future root directory clutter through enforcement, detection, and escalation  
**Status:** Active Enforcement

---

## Executive Summary

**Problem Identified (June 21, 2026):**
- 10 generated markdown files (.md) in root directory
- 1 text file (.txt) in root directory
- Files were deployment reports, checklists, and planning summaries
- All non-source documentation should have been in `docs/archive/generated/`

**Solution Applied:**
- ✅ All 10 files moved to `docs/archive/generated/`
- ✅ Root directory is now clean (8 files only: package.json, README.md, .gitignore, etc.)
- ✅ DATA-ORGANIZATION-ENFORCEMENT.md updated with mandatory agent instruction template
- ✅ AGENT-SPAWNING-TEMPLATES.md enhanced with non-negotiable data organization rule

**Prevention Mechanisms:**
- Mandatory instruction template for all agents
- Verification command in every agent checklist
- Git hooks (if applicable)
- Escalation plan for violations

---

## Root Directory - ALLOWED FILES ONLY

### Whitelist (8 files, NO more)
```
/home/devel/basset-hound-browser/
├── package.json                    ✅ Dependency manifest
├── package-lock.json              ✅ Dependency lock file
├── README.md                       ✅ Project entry point
├── .gitignore                      ✅ Git configuration
├── .dockerignore                   ✅ Docker configuration
├── .eslintrc.json                  ✅ ESLint configuration
├── .eslintignore                   ✅ ESLint ignore configuration
└── SECURITY.md                     ✅ Security documentation
```

### Nothing Else in Root
- ❌ NO other .md files (except README.md, SECURITY.md)
- ❌ NO .txt files
- ❌ NO .json files (except package.json, package-lock.json, .eslintrc.json)
- ❌ NO .log files
- ❌ NO .csv files
- ❌ NO reports, checklists, or planning documents
- ❌ NO screenshots, test outputs, or metrics

---

## Violation Detection

### Level 1: Quick Check (Everyone, Every Day)
```bash
# Should return EMPTY (no output)
find . -maxdepth 1 \( -name "*.md" ! -name "README.md" ! -name "SECURITY.md" -o -name "*.txt" -o -name "*.json" ! -name "package.json" ! -name "package-lock.json" ! -name ".eslintrc.json" \)
```

### Level 2: Pre-Commit Hook (Automated)
```bash
# Add to .git/hooks/pre-commit to prevent commits with root files
files=$(find . -maxdepth 1 \( -name "*.md" ! -name "README.md" ! -name "SECURITY.md" -o -name "*.txt" -o -name "*.json" ! -name "package.json" ! -name "package-lock.json" ! -name ".eslintrc.json" \))
if [ -n "$files" ]; then
  echo "ERROR: Found files in root directory (should be in subdirectories)"
  echo "$files"
  exit 1
fi
```

### Level 3: Git Status Check
```bash
# Before pushing: check for new files in root
git status | grep "^??" | grep -E "\.(md|txt|json)$"
```

---

## File Placement Guide (Reminder)

### If You Create This File → Put It Here

| File Type | Example | Location | Rationale |
|-----------|---------|----------|-----------|
| Generated reports | `DEPLOYMENT-COMPLETE.md` | `docs/archive/generated/` | Historical records |
| Handoff docs | `PHASE-COMPLETION.md` | `docs/handoffs/` | Knowledge transfer |
| Test results | `test-results.json` | `tmp/test-results/` | Temporary, not committed |
| Performance metrics | `load-test-results.txt` | `tmp/reports/` | Temporary reports |
| Screenshots | `test-screenshot-0.png` | `tmp/screenshots/` | Temporary artifacts |
| Debug logs | `debug.log` | `tmp/logs/` | Temporary logs |
| API documentation | `websocket-api.md` | `docs/api/` | Permanent reference |
| Deployment guide | `DEPLOYMENT.md` | `docs/guides/` | Permanent reference |

---

## Prevention Rules (Mandatory for All Agents)

### Rule 1: Every Agent Gets This Instruction
```
CRITICAL: Data Organization Rule (MANDATORY)

ALL GENERATED DATA GOES TO ./tmp/ OR docs/ (NEVER root)

Root contains ONLY: package.json, package-lock.json, README.md, 
.gitignore, .dockerignore, .eslintrc.json, .eslintignore, SECURITY.md

BEFORE COMPLETING:
1. Run: find . -maxdepth 1 \( -name "*.md" ! -name "README.md" -o -name "*.txt" \)
2. If any files appear → MOVE THEM IMMEDIATELY
3. Report in summary: "All files organized: [list what moved where]"
```

### Rule 2: No Exceptions
- Even if "it's just a quick summary"
- Even if "it's temporary"
- Even if "nobody will see it"
- → Goes to `tmp/` or `docs/archive/generated/`

### Rule 3: Verification Before Finalizing
Every agent and developer must run verification command before claiming "done":
```bash
find . -maxdepth 1 \( -name "*.md" ! -name "README.md" ! -name "SECURITY.md" -o -name "*.txt" \)
# Expected: no output
# If output appears: STOP, move files, then continue
```

---

## Escalation Path

### Level 1: Violation Detected (Non-Critical)
**Trigger:** 1-3 generated files in root, recent (within last 2 hours)

**Response:**
1. Identify who created the files (from git log or file timestamps)
2. Send message: "Please move [files] to proper locations per DATA-ORGANIZATION-ENFORCEMENT.md"
3. Expected resolution: <30 minutes
4. Document in escalation log

**Example:**
```
Violation detected: PERFORMANCE-METRICS.md in root
Created by: agent-name at 2026-06-21 15:30 UTC
Action: Requested file move to docs/archive/generated/
Status: Resolved (moved in 15 minutes)
```

### Level 2: Repeated Violation (Moderate)
**Trigger:** Same person/agent violates 2+ times in 1 week

**Response:**
1. Flag violation in escalation log
2. Add explicit instruction in next agent prompt: "Your predecessor put files in root. Don't do this."
3. Require verification step with screenshot/output
4. Daily check-ins for next 3 days
5. Expected resolution: <24 hours

**Example:**
```
Repeated violation by: test-agent-3
Count: 3 violations in 5 days
Files: DEPLOYMENT-CHECKLIST.md, MONITORING-ALERTS.md, PRE-DEPLOYMENT-CHECKLIST.md
Action: Explicit instruction added to next spawn, daily verification required
```

### Level 3: Systemic Issue (Critical)
**Trigger:** >5 violations in 1 day OR >10 violations in 1 week

**Response:**
1. STOP all agent spawning
2. Root cause analysis:
   - Are agents receiving the instruction?
   - Is instruction clear enough?
   - Are verification steps being skipped?
3. Update enforcement mechanisms
4. Add pre-commit hook to .git/hooks/
5. Resume agent spawning with enhanced instruction

**Example:**
```
Systemic issue detected: 8 violations in 3 hours
Root cause: Instruction was in middle of template, agents missed it
Action: 
- Moved instruction to TOP of all templates
- Added pre-commit hook
- All agents re-trained on new procedure
- Full audit of existing root directory
```

---

## Prevention Checklist (For Integration Lead / Project Lead)

### Daily (5 minutes)
```
□ Run: find . -maxdepth 1 \( -name "*.md" ! -name "README.md" ! -name "SECURITY.md" -o -name "*.txt" \)
□ If output appears: Escalate immediately (Level 1 or 2)
□ Document in escalation log
```

### Weekly (15 minutes)
```
□ Review all Level 1 escalations (were they resolved?)
□ Check for patterns (same person, same file type, same time of day)
□ If patterns found: Escalate to Level 2
□ Update prevention rules if needed
```

### Before Each Agent Spawn (2 minutes)
```
□ Copy mandatory instruction from DATA-ORGANIZATION-ENFORCEMENT.md
□ Add to agent prompt (first thing, before everything else)
□ Include verification command in agent checklist
□ Include "file placement" requirement in completion criteria
```

---

## Files Already Moved (Audit Trail)

### June 21, 2026 - Root Directory Cleanup

**Files Moved to `docs/archive/generated/`:**
1. ✅ DEPLOYMENT-CHECKLIST.md (12.6 KB)
2. ✅ DEPLOYMENT-DELIVERABLES.txt (21.2 KB)
3. ✅ DEPLOYMENT-INDEX.md (14.5 KB)
4. ✅ DEPLOYMENT-PLAN-SUMMARY.md (13.5 KB)
5. ✅ DEPLOYMENT-RUNBOOK.md (32.5 KB)
6. ✅ ISSUE-FIXES-QUICK-REFERENCE.md (10.0 KB)
7. ✅ MONITORING-ALERTS.md (24.5 KB)
8. ✅ POST-STABILITY-PLANNING-INDEX.md (11.1 KB)
9. ✅ POST-STABILITY-PLANNING-SUMMARY-2026-06-21.md (11.3 KB)
10. ✅ PRE-DEPLOYMENT-CHECKLIST.md (18.1 KB)

**Total Size Moved:** ~169 KB  
**Root Directory Status Before:** 18 files (8 source + 10 generated)  
**Root Directory Status After:** 8 files (8 source, 0 generated)  

---

## Long-Term Prevention Strategy

### 1. Git Hooks (Recommended)
Add pre-commit hook to prevent commits with root files:
```bash
# File: .git/hooks/pre-commit
#!/bin/bash
files=$(find . -maxdepth 1 \( -name "*.md" ! -name "README.md" ! -name "SECURITY.md" -o -name "*.txt" -o -name "*.json" ! -name "package.json" ! -name "package-lock.json" ! -name ".eslintrc.json" \))
if [ -n "$files" ]; then
  echo "ERROR: Cannot commit files in root directory:"
  echo "$files"
  echo ""
  echo "Move these files to:"
  echo "  - Generated docs → docs/archive/generated/"
  echo "  - Test results → tmp/test-results/"
  echo "  - Reports → tmp/reports/"
  exit 1
fi
```

### 2. CI/CD Pipeline Check
Add to pre-merge checks in GitHub Actions:
```yaml
- name: Check for root directory violations
  run: |
    files=$(find . -maxdepth 1 \( -name "*.md" ! -name "README.md" ! -name "SECURITY.md" -o -name "*.txt" \))
    if [ -n "$files" ]; then
      echo "ERROR: Found files in root directory:"
      echo "$files"
      exit 1
    fi
```

### 3. Agent Template Update
- Keep mandatory instruction at TOP of AGENT-SPAWNING-TEMPLATES.md
- Link to DATA-ORGANIZATION-ENFORCEMENT.md in every agent prompt
- Include verification step in every agent completion checklist
- Require "file placement" reporting in final summary

### 4. Documentation Updates
- Update README.md to reference data organization rules
- Add .gitignore exclusion rules for tmp/
- Document "where files go" in DEVELOPER-GUIDE.md (if created)

### 5. Monitoring
- Weekly escalation log review
- Monthly violation pattern analysis
- Quarterly process improvement

---

## Quick Reference: Where Does This Go?

```
QUICK DECISION TREE:

Did you CREATE it (not write it as part of source code)?
├─ YES: Is it documentation about a completed phase/feature?
│   ├─ YES → docs/archive/generated/ (historical record)
│   └─ NO: Is it documentation for knowledge transfer?
│       ├─ YES → docs/handoffs/
│       └─ NO: Is it a test output/report?
│           ├─ YES → tmp/test-results/ or tmp/reports/
│           └─ NO: Is it a log or temporary file?
│               ├─ YES → tmp/logs/ or tmp/data/
│               └─ NO: Is it a screenshot?
│                   ├─ YES → tmp/screenshots/
│                   └─ NO: Where does it belong?
│                       → Ask project lead
└─ NO: Keep it where it is (it's source code)
```

---

## Status

**Current Status:** ✅ ENFORCED  
**Root Directory:** ✅ CLEAN (8 allowed files only)  
**Prevention Mechanism:** ✅ ACTIVE (mandatory instruction in templates)  
**Escalation Plan:** ✅ READY (3-level escalation defined)  
**Long-Term Strategy:** ✅ DOCUMENTED (git hooks, CI/CD, monitoring)  

**Next Steps:**
1. Implement git pre-commit hook (optional but recommended)
2. Add CI/CD pipeline check (optional but recommended)
3. Monitor violations daily for next 2 weeks
4. Review escalation log weekly

---

**Document Owner:** Repository Governance  
**Last Updated:** June 21, 2026  
**Version:** 1.0  
**Status:** Active Enforcement

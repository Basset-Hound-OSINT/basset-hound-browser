# Documentation Structure & Organization Guide

**Last Updated:** July 3, 2026  
**Version:** 1.1  
**Purpose:** Define and enforce consistent documentation organization across all projects
**Key Addition:** RAG system integration + research/obscura directory structure

---

## Overview

This guide establishes the canonical documentation structure for the Basset Hound Browser project. All documentation must follow this hierarchy to maintain clarity, discoverability, and consistency as the project scales.

---

## Directory Hierarchy

### Root Level (Minimal - Only Essential Files)

The root directory contains **only** these files:

| File | Purpose | Status |
|------|---------|--------|
| `README.md` | Project entry point, setup, and overview | Required |
| `ROOT-NAVIGATION.md` | Navigation guide for root and key documentation | Required |
| `package.json` | Node.js dependencies and build scripts | Required (do not modify) |
| `.gitignore` | Git ignore patterns | Required (do not modify) |
| `.dockerignore` | Docker ignore patterns | Optional |

**All other documentation moves to docs/ subdirectories.**

---

### docs/ - Primary Documentation Directory

```
docs/
├── DOCUMENTATION-STRUCTURE.md    # This file - directory standards
├── AGENT-DOCUMENTATION-STANDARDS.md  # Standards for agent handoffs
├── API-REFERENCE.md              # WebSocket API documentation
├── ROADMAP.md                    # Project roadmap
├── SCOPE.md                      # Architectural scope definitions
├── DASHBOARDS-INDEX.md           # Dashboard documentation index
│
├── guides/                       # User guides and tutorials
│   ├── QUICKSTART.md
│   ├── INSTALLATION.md
│   ├── CONFIGURATION.md
│   ├── INTEGRATION-PATTERNS.md
│   └── [user-facing guides]
│
├── deployment/                   # Deployment procedures
│   ├── DEPLOYMENT-GUIDE.md
│   ├── DEPLOYMENT-CHECKLIST.md
│   ├── RUNBOOK-DEPLOY.md
│   ├── RUNBOOK-REDEPLOY.md
│   └── [deployment procedures]
│
├── api-reference/                # API documentation
│   ├── WEBSOCKET-API.md
│   ├── MCP-API.md
│   └── [API docs by module]
│
├── releases/                     # Release notes by version
│   ├── RELEASE-NOTES-v12.5.0.md
│   ├── RELEASE-NOTES-v12.4.0.md
│   └── [version release notes]
│
├── findings/                     # Analysis, reports, and findings
│   ├── CODE-QUALITY-FINAL-REPORT.txt
│   ├── FINAL-PRODUCTION-VALIDATION-REPORT-2026-06-13.md
│   ├── [analysis reports]
│   ├── [test result summaries]
│   └── [audit findings]
│
├── handoffs/                     # Agent deliverables and handoff docs
│   ├── V12.5.0-PHASE-1-COMPLETE-2026-06-14.md
│   ├── V12.4.0-PHASE-2-COMPLETE-2026-06-10.md
│   └── [agent completion reports]
│
├── archives/                     # Historical and archived content
│   ├── build-artifacts/          # Phase reports, temporary builds
│   │   ├── PHASE-5-COMPLETION-SUMMARY.md
│   │   ├── PHASE-4-FINAL-REPORT.txt
│   │   ├── QUICKSTART-TOR-CIRCUITS.md
│   │   └── [all phase delivery files]
│   ├── session_records/          # Session documentation
│   │   ├── 2026-05-11_V12.0.0-PRODUCTION-DEPLOYMENT-COMPLETE.md
│   │   └── [session records]
│   ├── release-notes/            # Historical release notes
│   └── [other archives]
│
├── research/                     # Research documents
│   ├── obscura/                  # Obscura reverse-engineering findings
│   │   ├── README.md
│   │   ├── OBSCURA-EVALUATION.md
│   │   └── [topic-specific findings]
│   ├── evasion-canvas-webgl/
│   ├── session-coherence-analysis/
│   ├── detection-systems/
│   ├── fingerprinting-deep-dives/
│   └── [research topics]
│
├── rag-app/                      # LOCAL RAG System (Doc Indexing)
│   ├── README-BASSET-HOUND.md   # Setup instructions
│   ├── deploy.sh                 # Start/stop RAG stack
│   ├── docker-compose.yml
│   ├── config/
│   │   └── config.yaml           # Configured for docs/ indexing
│   └── .gitignore                # Ignores data/ folder
│
├── runbooks/                     # Operational runbooks
│   ├── RUNBOOK-DEPLOY.md
│   ├── RUNBOOK-TROUBLESHOOT.md
│   └── [operational procedures]
│
├── monitoring/                   # Monitoring and observability
│   ├── METRICS.md
│   ├── ALERTING.md
│   └── [monitoring configs]
│
├── advanced/                     # Advanced topics
├── integration/                  # Integration documentation
├── specifications/               # Technical specifications
├── security/                     # Security documentation
├── testing/                      # Testing documentation
├── tutorials/                    # Step-by-step tutorials
│
└── [other specialized directories as needed]
```

---

## File Organization Rules

### 1. **Root Documentation Files**
Keep only these at root:
- `README.md` - Main entry point
- `ROOT-NAVIGATION.md` - Navigation guide
- Configuration files (package.json, .gitignore, .dockerignore)

### 2. **Release Notes**
**Location:** `docs/releases/`  
**Format:** `RELEASE-NOTES-v{VERSION}.md`  
**Example:** `docs/releases/RELEASE-NOTES-v12.5.0.md`

❌ **BAD:** `RELEASE-NOTES-v12.5.0.md` (at root)  
✅ **GOOD:** `docs/releases/RELEASE-NOTES-v12.5.0.md`

### 3. **Deployment Documentation**
**Location:** `docs/deployment/`  
**Files:**
- `DEPLOYMENT-GUIDE.md` - Full guide
- `DEPLOYMENT-CHECKLIST.md` - Pre-deployment checklist
- `RUNBOOK-*.md` - Specific runbooks

❌ **BAD:** `DEPLOYMENT-GUIDE.md` (at root)  
✅ **GOOD:** `docs/deployment/DEPLOYMENT-GUIDE.md`

### 4. **User Guides & Quick-starts**
**Location:** `docs/guides/`  
**Files:**
- `QUICKSTART.md` - Get started quickly
- `INSTALLATION.md` - Installation instructions
- `CONFIGURATION.md` - Configuration guide
- `INTEGRATION-PATTERNS.md` - Integration examples

❌ **BAD:** `QUICKSTART-TOR-CIRCUITS.md` (at root)  
✅ **GOOD:** `docs/guides/QUICKSTART-TOR-CIRCUITS.md`

### 5. **Agent Handoffs & Deliverables**
**Location:** `docs/handoffs/`  
**Format:** `{VERSION}-{PHASE}-COMPLETE-{DATE}.md`  
**Examples:**
- `docs/handoffs/V12.5.0-PHASE-1-COMPLETE-2026-06-14.md`
- `docs/handoffs/V12.4.0-PHASE-2-COMPLETE-2026-06-10.md`

❌ **BAD:** `PHASE-5-COMPLETION-SUMMARY.md` (at root)  
✅ **GOOD:** `docs/handoffs/V12.5.0-PHASE-5-COMPLETE-2026-06-14.md`

### 6. **Analysis & Findings**
**Location:** `docs/findings/`  
**Files:**
- Code quality reports
- Test result summaries
- Validation reports
- Audit findings
- Analysis documents

❌ **BAD:** `CODE-QUALITY-FINAL-REPORT.txt` (at root)  
✅ **GOOD:** `docs/findings/CODE-QUALITY-FINAL-REPORT.txt`

### 7. **Phase Documentation (Temporary)**
**Location:** `docs/archives/build-artifacts/`  
**Files:**
- Phase delivery reports
- Phase completion summaries
- Temporary quick-start guides
- Phase-specific status files

❌ **BAD:** `PHASE-5-COMPLETION-SUMMARY.md` (at root)  
✅ **GOOD:** `docs/archives/build-artifacts/PHASE-5-COMPLETION-SUMMARY.md`

### 8. **Historical Records**
**Location:** `docs/archives/session_records/`  
**Format:** `{DATE}_V{VERSION}-{DESCRIPTION}.md`  
**Example:** `docs/archives/session_records/2026-05-11_V12.0.0-PRODUCTION-DEPLOYMENT-COMPLETE.md`

---

## Naming Conventions

### Release Notes
```
RELEASE-NOTES-v{MAJOR}.{MINOR}.{PATCH}.md
RELEASE-NOTES-v12.5.0.md
RELEASE-NOTES-v12.4.0.md
```

### Handoff Documents
```
V{VERSION}-{PHASE}-COMPLETE-{DATE}.md
V12.5.0-PHASE-1-COMPLETE-2026-06-14.md
V12.4.0-PHASE-2-COMPLETE-2026-06-10.md
```

### Session Records
```
{DATE}_V{VERSION}-{DESCRIPTION}.md
2026-06-14_V12.5.0-PHASE-1-COMPLETION.md
2026-05-11_V12.0.0-PRODUCTION-DEPLOYMENT-COMPLETE.md
```

### Analysis Reports
```
{SUBJECT}-{REPORT-TYPE}.{ext}
CODE-QUALITY-FINAL-REPORT.txt
FINAL-PRODUCTION-VALIDATION-REPORT-2026-06-13.md
INFRASTRUCTURE-SUMMARY.md
```

---

## Directory-by-Directory Guidelines

### `docs/guides/`
- **Purpose:** User-facing documentation
- **Audience:** End users, developers integrating the system
- **Examples:** Installation, configuration, quick-start guides
- **Format:** Markdown with clear steps and examples

### `docs/deployment/`
- **Purpose:** Deployment and operational procedures
- **Audience:** DevOps, system administrators
- **Examples:** Deployment guides, checklists, runbooks
- **Format:** Markdown with commands and verification steps

### `docs/releases/`
- **Purpose:** Version release documentation
- **Audience:** All stakeholders
- **Examples:** Feature releases, bug fixes, breaking changes
- **Format:** Markdown with version number in filename

### `docs/handoffs/`
- **Purpose:** Agent task completion and deliverable handoff
- **Audience:** Project managers, next agents in chain
- **Examples:** Phase completion reports, feature handoffs
- **Format:** Markdown with clear accomplishments and next steps
- **Ownership:** Agents create these when completing work

### `docs/findings/`
- **Purpose:** Analysis, reports, and validation results
- **Audience:** Technical team, stakeholders
- **Examples:** Code quality reports, test summaries, audit findings
- **Format:** Markdown or text with detailed analysis

### `docs/archives/build-artifacts/`
- **Purpose:** Temporary and historical phase documentation
- **Audience:** Historical reference
- **Examples:** Phase reports, completion summaries, temporary builds
- **Format:** Any (typically markdown or text)
- **Retention:** Keep for historical reference, mark outdated content

### `docs/archives/session_records/`
- **Purpose:** Session documentation for complex operations
- **Audience:** Historical reference, learning
- **Examples:** Deployment sessions, complex feature implementations
- **Format:** Markdown with timestamps and progression

### `docs/research/` (Including `docs/research/obscura/`)
- **Purpose:** Deep technical research and reverse-engineering findings
- **Audience:** Technical team, architects, future investigators
- **Examples:** Obscura evaluation, architectural analysis, detection vector studies
- **Format:** Markdown with frontmatter (title, date, researcher, status, category)
- **RAG Integration:** Auto-indexed by RAG system at http://localhost:8100

### `docs/rag-app/`
- **Purpose:** Local RAG system for documentation indexing
- **Audience:** Developers, agents needing documentation context
- **How to Start:** `cd docs/rag-app && ./deploy.sh start --build`
- **Web UI:** http://localhost:8100
- **API Endpoints:** `/api/search`, `/api/rag` (hybrid + semantic retrieval)
- **Indexed Folders:** `/docs/` (all subdirectories scanned recursively)
- **File Types:** .md, .txt, .json, .yaml, .pdf, .log

---

## Migration Checklist

When moving to this structure:

- [ ] Move all `RELEASE-NOTES-v*.md` files to `docs/releases/`
- [ ] Move all `DEPLOYMENT-*.md` files to `docs/deployment/`
- [ ] Move user guides to `docs/guides/`
- [ ] Move analysis reports to `docs/findings/`
- [ ] Archive all PHASE-*.md files to `docs/archives/build-artifacts/`
- [ ] Create session records in `docs/archives/session_records/`
- [ ] Update ROOT-NAVIGATION.md with new structure
- [ ] Verify all links still work after migration
- [ ] Delete any duplicates or outdated files from root

---

## Best Practices

1. **Keep root clean** - Only README, ROOT-NAVIGATION, and config files
2. **Use clear filenames** - Name should indicate content clearly
3. **Organize by type** - Group similar documents together
4. **Date important files** - Use YYYY-MM-DD format for time-sensitive docs
5. **Link between docs** - Use relative links for easy navigation
6. **Archive old content** - Move completed phases to archives
7. **Update ROOT-NAVIGATION.md** - Keep main navigation guide current
8. **Use version numbers** - Always include version in release/handoff docs
9. **Maintain index files** - Use index markdown files to link related docs
10. **Review quarterly** - Verify organization still meets project needs

---

## Agent Workflow: Using RAG + Writing Findings

### Step 1: Query Documentation with RAG
When agents need to understand existing architecture/findings:

```bash
# Start RAG if not running
cd docs/rag-app && ./deploy.sh start --build

# Query via REST API
curl -X POST http://localhost:8100/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Obscura WebGL evasion", "mode": "hybrid", "top_k": 5}'
```

### Step 2: Research & Document Findings
When documenting new research:

1. **Create file:** `docs/research/[topic]/[finding-name].md`
2. **Add frontmatter:**
   ```markdown
   ---
   title: "Your Research Title"
   date: 2026-07-03
   researcher: "Agent Name"
   status: "Complete|In Progress|Pending Review"
   category: "Technical Analysis|Integration|Deployment"
   ---
   ```
3. **Cross-reference:** Use `[[filename]]` links to related docs
4. **Auto-indexed:** RAG system picks up new docs automatically (rescan on deploy)

### Step 3: Link from Core Files
Update `ROADMAP.md`, `SCOPE.md`, or `TODO.md` with links to new research:

```markdown
- **Obscura Evaluation:** See [research/obscura/OBSCURA-EVALUATION.md](./research/obscura/OBSCURA-EVALUATION.md)
```

## Special: Obscura Research Directory

**Location:** `docs/research/obscura/`  
**Purpose:** Comprehensive Obscura reverse-engineering and comparison analysis  
**RAG Indexed:** Yes (auto-scanned when RAG starts)

### Adding Obscura Findings:
```
docs/research/obscura/
├── README.md                              # Research guidelines
├── OBSCURA-EVALUATION.md                  # Strategic evaluation
├── architecture-deep-dive.md              # Technical analysis
├── performance-comparison.md              # Benchmarking
├── evasion-vector-analysis.md             # Detection evasion
├── integration-feasibility.md             # Hybrid approach analysis
└── [topic-specific-findings].md
```

**Key Rule:** All Obscura findings stay here, NOT in `/docs/wiki/`. Use RAG to query them as context for future research.

## Preventing Documentation Clutter

### ❌ AVOID
- Creating files in root directory (exception: README.md, config files only)
- Adding to `/docs/wiki/` (deprecated, migrate to `/docs/research/`)
- Creating multiple TODO files (use single `docs/TODO.md`)
- Dumping content without organization

### ✅ DO
- Use `/docs/research/[topic]/` for investigation findings
- Keep `/docs/ROADMAP.md`, `/docs/SCOPE.md` lean with links
- Use RAG system to query old findings instead of re-reading
- Archive old session records to `/docs/archives/session_records/`

---

## Related Documents

- **[AGENT-DOCUMENTATION-STANDARDS.md](./AGENT-DOCUMENTATION-STANDARDS.md)** - Standards for agent handoffs
- **[ROOT-NAVIGATION.md](ROOT-NAVIGATION.md)** - Main project navigation
- **[ROADMAP.md](roadmap/ROADMAP.md)** - Project roadmap
- **[rag-app/README-BASSET-HOUND.md](./rag-app/README-BASSET-HOUND.md)** - RAG system setup
- **[research/obscura/README.md](./research/obscura/README.md)** - Obscura research guidelines

---

**Last Reviewed:** July 3, 2026  
**Status:** ✅ Active - All documentation must follow this structure
**RAG Integration:** ✅ Enabled - Auto-indexes docs/ folder recursively
**Research Discipline:** ✅ Enforced - Findings go to research/[topic]/, not wiki/

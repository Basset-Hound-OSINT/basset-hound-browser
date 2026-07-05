# Basset Hound Browser - Roadmap Archive

**Purpose:** Historical roadmap documentation consolidated from root directory  
**Last Cleanup:** June 20, 2026  
**Current Roadmap:** `/docs/FORENSIC-FEATURES-ROADMAP.md` (PRIMARY REFERENCE)

---

## Current Roadmap (Active Reference)

The active roadmap for ongoing development is located at:
- **File:** `/docs/FORENSIC-FEATURES-ROADMAP.md`
- **Coverage:** v12.7.0 Phase 2 through v13.0.0
- **Last Updated:** June 20, 2026

---

## Archived Roadmaps (Historical Reference)

All previous roadmap documents have been consolidated here with date prefixes for easy identification.

### June 20, 2026 Cleanup Archive

**Files moved from root directory:**

| Archive File | Original Name | Purpose |
|--------------|---------------|---------|
| `2026-06-20-summary.md` | `ROADMAP-SUMMARY-2026.md` | Executive overview and quick reference (14 pages) |
| `2026-06-20-index.md` | `ROADMAP-INDEX.md` | Complete documentation index and navigation guide |

**Related Implementation Documents:**

| Archive File | Original Name | Purpose |
|--------------|---------------|---------|
| `../2026-06-20-dependency-security-audit.md` | `DEPENDENCY-SECURITY-AUDIT-2026-06-20.md` | Security vulnerability analysis and upgrade planning |
| `../2026-06-20-quick-win-3-implementation.md` | `QUICK-WIN-3-IMPLEMENTATION-SUMMARY.md` | Error logging framework implementation |

---

## How to Use This Archive

### For Project Managers
1. Start with `/docs/FORENSIC-FEATURES-ROADMAP.md` for current planning
2. Reference `2026-06-20-summary.md` for historical context
3. Use `2026-06-20-index.md` to locate specific detailed planning documents

### For Developers
1. Review `/docs/FORENSIC-FEATURES-ROADMAP.md` for upcoming features
2. Check archived versions if you need to understand historical decisions
3. All detailed technical roadmaps are linked in `2026-06-20-index.md`

### For Team Leads
1. Current timeline and phase planning: `/docs/FORENSIC-FEATURES-ROADMAP.md`
2. Executive summary: `2026-06-20-summary.md`
3. Team allocations and sprint structure: Both documents above

---

## Root Directory Cleanup

**Status:** ✅ COMPLETE (June 20, 2026)

All roadmap files have been moved from the root directory to maintain a clean repository structure. The root directory now contains only:
- `README.md` (project root)
- `.gitignore`
- `.dockerignore`
- Essential configuration files (package.json, etc.)

**Verification Command:**
```bash
find . -maxdepth 1 -type f -name "*.md" ! -name "README.md" | wc -l
# Expected output: 0
```

---

## Documentation Structure After Cleanup

```
basset-hound-browser/
├── README.md (root level)
├── docs/
│   ├── README.md (updated with roadmap pointers)
│   ├── FORENSIC-FEATURES-ROADMAP.md (CURRENT ROADMAP)
│   ├── archive/
│   │   ├── README.md
│   │   ├── roadmaps/ (this directory)
│   │   │   ├── README.md (this file)
│   │   │   ├── 2026-06-20-summary.md
│   │   │   └── 2026-06-20-index.md
│   │   ├── 2026-06-20-dependency-security-audit.md
│   │   ├── 2026-06-20-quick-win-3-implementation.md
│   │   └── [other archived documents]
│   └── [other documentation subdirectories]
└── [source code, tests, etc.]
```

---

## Future Cleanup Sessions

When consolidating future roadmaps:

1. Move files to this directory with date prefix: `YYYY-MM-DD-<description>.md`
2. Update `/docs/README.md` to reference new archive
3. Update the file list above in this README
4. Verify root directory contains no `.md` files except `README.md`

**Command to verify:**
```bash
find . -maxdepth 1 -type f -name "*.md" ! -name "README.md" | wc -l
# Should return: 0
```

---

## Index of All Archived Content

For a complete index of all documentation and planning documents, see:
- `2026-06-20-index.md` - Complete roadmap documentation navigation
- `/docs/README.md` - Main documentation index (updated)

---

**Archive Maintained By:** Repository Maintenance Agent  
**Last Updated:** June 20, 2026  
**Cleanup Status:** ✅ COMPLETE

# Main.js Refactoring - Complete Documentation Index

**Project**: Basset Hound Browser v12.7.0  
**Date**: 2026-06-22  
**Objective**: Split `/src/main/main.js` (3,056 lines) into 4 modular files (<800 lines each)

---

## Documents Summary

### 1. **main-js-refactor-plan.md** (486 lines, 15 KB)
**PRIMARY PLANNING DOCUMENT** - Start here for complete understanding

**Contents**:
- Executive summary (why split, what split, how to split)
- Detailed breakdown of 4 target files (purpose, contents, line ranges)
- File-by-file functional mapping
- Implementation strategy (5-phase approach)
- Verification checklist
- Dependencies map
- Risk mitigation plan
- Future refactoring opportunities

**Key Sections**:
- Files: initialization.js, window-mgmt.js, websocket-integration.js, lifecycle.js
- Total: ~2,610 lines refactored (preserving all 3,056 original lines)
- Each file: <800 lines, feature-complete, zero functionality loss

**Use Case**: Planning, architecture review, team communication

---

### 2. **main-js-line-mapping.txt** (390 lines, 26 KB)
**REFERENCE GUIDE** - Detailed line-by-line mapping of original to target files

**Contents**:
- Original file: 3,056 lines total
- 4 target files with exact line ranges from original
- Section-by-section breakdown showing what moves where
- Summary table of all 4 files
- Critical line ranges (must preserve)
- Key function blocks
- Dependency graph

**Structure**:
```
FILE 1: initialization.js (~680 lines)
  - Module Resolution Setup (lines 1-29)
  - Electron Import & Validation (20-29)
  - Manager Imports (38-75)
  - GC Tuning (78-95)
  - Lazy Manager Registry (98-114)
  - Response Serialization (117-123)
  - ... [40+ sections]

FILE 2: window-mgmt.js (~720 lines)
  - Window Command Line Setup (756-759)
  - Window Configuration (761-781)
  - Header Manager Initialization (795-823)
  - ... [25+ sections]

FILE 3: websocket-integration.js (~580 lines)
  - SSL Certificate Generation (1035-1060)
  - WebSocket Server Instantiation (1062-1099)
  - ... [3+ sections]

FILE 4: lifecycle.js (~630 lines)
  - IPC Handlers Setup (1252-1355)
  - Cookie Management Handlers (1357-1470)
  - ... [18+ handler categories]
```

**Use Case**: Implementation guide, copy-paste reference, validation

---

### 3. **main-js-implementation-notes.md** (380 lines, 12 KB)
**DEVELOPER GUIDE** - Step-by-step implementation with checklists

**Contents**:
- Quick reference (files, status)
- Module structure diagram
- Critical checklist (before/during/after)
- 6-phase implementation guide
- Export/import strategy with code examples
- Known issues & solutions (4 common problems)
- Testing strategy (unit, integration, regression, manual)
- Performance checklist
- Common pitfalls to avoid
- Rollback plan
- Code review checklist
- Next steps

**Key Sections**:
- **Before Starting**: Backup, branching, test verification
- **Phase 1-5**: initialization.js → window-mgmt.js → websocket → lifecycle.js → new main.js
- **Phase 6**: Testing & verification
- **Troubleshooting**: Manager references, global variables, circular deps, cleanup

**Use Case**: Implementation execution, troubleshooting, testing

---

## Quick Navigation

### For Project Managers
1. Read: **main-js-refactor-plan.md** → "Executive Summary" section
2. Check: **main-js-refactor-plan.md** → "Verification Checklist"
3. Reference: **main-js-refactor-plan.md** → "Files Summary" table

### For Architects
1. Read: **main-js-refactor-plan.md** → Full document
2. Study: **main-js-line-mapping.txt** → Dependency graph
3. Review: **main-js-implementation-notes.md** → Module structure

### For Developers
1. Start: **main-js-implementation-notes.md** → "Phase 1-6"
2. Reference: **main-js-line-mapping.txt** → Exact line ranges
3. Verify: **main-js-implementation-notes.md** → Testing strategy

### For QA/Testing
1. Review: **main-js-implementation-notes.md** → Testing strategy
2. Check: **main-js-refactor-plan.md** → Verification checklist
3. Execute: **main-js-implementation-notes.md** → Manual tests

---

## File Specifications

### Target Files Overview

| File | Lines | Purpose | Components |
|------|-------|---------|-----------|
| **initialization.js** | ~680 | Config, GC, recovery setup | 6 imports, 18 functions, recovery system, headless/Tor setup |
| **window-mgmt.js** | ~720 | Window creation, manager init | 1 main function, 18 manager inits, cleanup, IPC helper |
| **websocket-integration.js** | ~580 | WebSocket server setup | SSL certs, server creation, manager references |
| **lifecycle.js** | ~630 | IPC handlers + lifecycle | 150+ IPC handlers, 3 helper functions, app events, error handlers |
| **New main.js** | ~50 | Orchestrator | Initialization, window creation, lifecycle setup |

### Document File Sizes
- **main-js-refactor-plan.md**: 486 lines (comprehensive plan)
- **main-js-line-mapping.txt**: 390 lines (line-by-line reference)
- **main-js-implementation-notes.md**: 380 lines (developer guide)

---

## Key Statistics

### Original File Analysis
- **Total lines**: 3,056
- **Managers initialized**: 18
- **IPC handlers**: 150+
- **Recovery functions**: 8
- **Error handlers**: 2 global + multiple per manager
- **Config integrations**: 5 (headless, Tor, network, browser, updater)

### Target Split
- **Files**: 4 modular + 1 orchestrator
- **Max file size**: 720 lines (window-mgmt.js)
- **Min file size**: ~50 lines (new main.js)
- **Code preserved**: 100% (all 3,056 lines)
- **Functionality loss**: 0%

### Implementation Effort
- **Planning**: 2 hours (this documentation)
- **Coding**: 4-6 hours (actual file creation)
- **Testing**: 4-8 hours (unit, integration, e2e)
- **Verification**: 2-4 hours (regression, performance)
- **Total**: ~12-20 hours

---

## Critical Dependencies

### Module Dependencies
```
initialization.js
  └─ (no dependencies, loads all manager modules)

window-mgmt.js
  ├─ requires: initialization.js
  └─ requires: all manager modules

websocket-integration.js
  ├─ requires: initialization.js
  └─ requires: utils/cert-generator.js

lifecycle.js
  ├─ requires: initialization.js
  └─ requires: context from window-mgmt.js

new main.js
  ├─ requires: initialization.js
  ├─ requires: window-mgmt.js
  └─ requires: lifecycle.js
```

### External Dependencies
- `electron` - BrowserWindow, ipcMain, session, dialog, app
- `path`, `fs` - File system access
- 20+ manager modules - Already imported
- `CertificateGenerator` - SSL cert generation
- `LazyManagerRegistry` - Lazy initialization
- `getSerializer` - Response optimization

---

## Implementation Timeline

### Week 1: Preparation
- Day 1: Read all 3 documents
- Day 2: Create feature branch, backup original
- Day 3: Create empty files, set up module structure

### Week 2: Implementation
- Day 1-2: Create initialization.js
- Day 3: Create window-mgmt.js
- Day 4: Create websocket-integration.js (or merge into window-mgmt)
- Day 5: Create lifecycle.js

### Week 3: Testing & Verification
- Day 1: Syntax checks, import verification
- Day 2: Unit tests, integration tests
- Day 3: Full e2e test, performance baseline
- Day 4: Regression testing, stress testing
- Day 5: Code review, documentation

### Week 4: Deployment
- Day 1: Final verification
- Day 2: Merge to main branch
- Day 3: Tag release, deploy

---

## Success Criteria

✅ **Must Have**:
- All 3,056 lines of code preserved
- Each file <800 lines
- All 150+ IPC handlers functional
- All 18 managers initialized
- Zero functionality loss
- Tests pass 100%

⭐ **Should Have**:
- Clear module responsibilities
- Easy to extend individual modules
- Reduced cognitive load
- Better file maintainability

🚀 **Nice to Have**:
- Performance improvement (faster startup)
- Lazy loading opportunities
- Type safety (TypeScript interfaces)
- Further modularization (handlers by manager)

---

## Risk Assessment

### High Risk
- **Circular dependencies** → Mitigate: explicit initialization order
- **Manager reference timing** → Mitigate: pass managers through context
- **Global variable collisions** → Mitigate: namespace all globals

### Medium Risk
- **IPC handler distribution** → Mitigate: keep all in one file
- **Headless mode early init** → Mitigate: test in Docker
- **Recovery system interaction** → Mitigate: thorough testing

### Low Risk
- **Manager imports** → All modules already exist
- **WebSocket setup** → Proven code, only reorganized
- **Electron APIs** → No changes to API usage

---

## Troubleshooting Guide

### Issue: "Cannot find module 'initialization'"
**Solution**: Check import paths use relative paths: `require('./initialization')`

### Issue: Manager undefined in IPC handler
**Solution**: Pass managers context to lifecycle module before setupIPCHandlers()

### Issue: Circular dependency error
**Solution**: Verify initialization.js doesn't require window-mgmt.js

### Issue: mainWindow is null
**Solution**: Ensure createWindow() called before setupIPCHandlers()

### Issue: WebSocket server not starting
**Solution**: Check port 8765 not already in use, or configure different port

### Issue: Tests failing with "manager not available"
**Solution**: Ensure all managers initialized before test execution

---

## Related Documentation

### Within This Directory
- `WEBSOCKET-SERVER-MODULARIZATION-PLAN.md` - Similar refactoring for websocket/server.js
- `HEAP-EXHAUSTION-SOLUTION-SUMMARY.md` - Memory management context
- `COMPRESSION_OPTIMIZATION_SUMMARY.md` - Performance optimization context

### In Project Root
- `src/main/main.js` - Original file (to be split)
- `package.json` - Entry point configuration
- `test/` - Test files validating all functionality

---

## Contact & Questions

**Documentation Created**: Claude Code Analysis  
**Date**: 2026-06-22  
**Target Project**: Basset Hound Browser v12.7.0  
**Status**: Ready for Implementation

---

## Checklist Before Starting Implementation

- [ ] Read main-js-refactor-plan.md completely
- [ ] Review main-js-line-mapping.txt for all line ranges
- [ ] Understand main-js-implementation-notes.md testing strategy
- [ ] Backup original main.js
- [ ] Create feature branch
- [ ] Run existing tests (should all pass)
- [ ] Have 20+ hours allocated for implementation + testing
- [ ] Team agreed on timeline
- [ ] Code review process defined
- [ ] Deployment plan approved

---

**Generated**: 2026-06-22  
**Total Documentation**: 3 files, 1,256 lines, 51 KB  
**Ready for**: Implementation, Review, Planning

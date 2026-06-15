# Agent Documentation Standards

**Last Updated:** June 14, 2026  
**Version:** 1.0  
**Audience:** All agents working on the Basset Hound Browser project

---

## Purpose

This document establishes standards for how agents should document their work, create deliverables, and hand off progress to subsequent agents. Following these standards ensures consistency, clarity, and maintainability across all project work.

---

## When an Agent Completes Work

When an agent completes a task, it **must** create a handoff document. This document:

1. **Summarizes what was accomplished**
2. **Lists deliverables clearly**
3. **Documents any decisions made**
4. **Provides clear next steps for the next agent**
5. **Lives in `docs/handoffs/` for easy discovery**

---

## Handoff Document Format

### Location
**Always create handoff documents here:** `docs/handoffs/`

### Filename Format
```
V{VERSION}-{PHASE}-COMPLETE-{DATE}.md
```

### Examples
✅ `docs/handoffs/V12.5.0-PHASE-1-COMPLETE-2026-06-14.md`  
✅ `docs/handoffs/V12.4.0-PHASE-2-COMPLETE-2026-06-10.md`  
✅ `docs/handoffs/V12.3.0-SECURITY-REVIEW-COMPLETE-2026-06-05.md`  

### Template

```markdown
# {PROJECT} - {PHASE/TASK} Completion Report

**Version:** {VERSION}  
**Phase:** {PHASE NAME}  
**Date Completed:** {DATE}  
**Status:** ✅ COMPLETE  
**Next Agent:** [To be assigned]

---

## Summary

[1-2 paragraph executive summary of what was accomplished]

---

## Deliverables

### Primary Deliverables
- [ ] Item 1 with file path: `path/to/file.md`
- [ ] Item 2 with file path: `path/to/file.py`
- [ ] Item 3 with description
- [x] Completed items marked with [x]

### Secondary Deliverables
- Documentation: `docs/path/file.md`
- Tests: `tests/path/test.js`
- Implementation: `src/path/module.js`

### Test Results
- **Total Tests:** XXX
- **Passing:** XXX (XX.X%)
- **Failing:** X
- **Coverage:** XX.X%

---

## Key Decisions & Rationale

### Decision 1: [Title]
**Context:** [Why this decision was needed]  
**Decision:** [What was decided]  
**Rationale:** [Why this choice]  
**Impact:** [How this affects future work]

### Decision 2: [Title]
[Same format as above]

---

## Technical Details

### Architecture Changes
- [Description of any architectural changes]
- [Impact on other modules]
- [Dependencies affected]

### Performance Metrics
- [Before]: [metric]
- [After]: [metric]
- [Improvement]: [percentage]

### Known Issues & Workarounds
- **Issue 1:** [Description]
  - **Workaround:** [How to work around it]
  - **Root Cause:** [Why it occurs]
  - **Long-term Fix:** [Plan for permanent fix]

---

## Files Modified

### New Files Created
| File | Purpose |
|------|---------|
| `path/file1.js` | Module implementation |
| `path/file2.md` | Documentation |

### Files Modified
| File | Changes |
|------|---------|
| `src/path/module.js` | Added feature X, updated function Y |
| `tests/path/test.js` | Added 15 new test cases |

### Files Archived
- `docs/old-file.md` → `docs/archives/build-artifacts/old-file.md`

---

## Integration Points

### Dependencies
- **Module X**: Used for [purpose]
- **Module Y**: Updated to support [feature]
- **External Service**: [Description]

### Breaking Changes
- None (or list any breaking changes)

### Backward Compatibility
- [Assessment of compatibility]

---

## Testing & Validation

### Test Execution
```
npm test
npm run test:unit
npm run test:integration
```

### Test Results
- Unit Tests: XXX/XXX passing
- Integration Tests: XXX/XXX passing
- E2E Tests: XXX/XXX passing
- Bot Detection Tests: XXX/XXX passing

### Manual Testing
- [Scenario 1]: ✅ Verified
- [Scenario 2]: ✅ Verified
- [Scenario 3]: ✅ Verified

### Known Test Failures
- [Test name]: [Status and reason]
- [Test name]: [Status and reason]

---

## Next Steps for Incoming Agent

### Immediate (0-1 days)
1. [ ] Review this handoff document completely
2. [ ] Verify all deliverables exist and are correct
3. [ ] Run test suite and verify results match reported numbers
4. [ ] Update ROOT-NAVIGATION.md if directory structure changed

### Short-term (1-3 days)
1. [ ] [Task 1]
2. [ ] [Task 2]
3. [ ] [Task 3]

### Medium-term (1-2 weeks)
1. [ ] [Task 1]
2. [ ] [Task 2]

### Optional Improvements
- [ ] [Enhancement 1]
- [ ] [Enhancement 2]
- [ ] [Performance optimization]

---

## Questions for the Incoming Agent

If you have questions about any of this work, check:
1. **Architecture Questions:** See `/docs/SCOPE.md`
2. **API Questions:** See `/docs/API-REFERENCE.md`
3. **Deployment Questions:** See `/docs/deployment/`
4. **Previous Work:** Check `/docs/handoffs/` for related phases
5. **Research:** Check `/docs/research/` for deep dives

---

## How to Continue This Work

### To resume in the same phase:
```bash
git log --oneline | head -20  # See recent commits
git diff main                  # See what changed
```

### To move to the next phase:
1. Ensure all tests pass
2. Update version number (if needed)
3. Create new handoff document for your phase
4. Follow the same standards for your deliverables

---

## Appendix: Additional Resources

### Documentation Files to Update
- `/ROOT-NAVIGATION.md` - If directory structure changed
- `/docs/ROADMAP.md` - If timeline affected
- `/docs/SCOPE.md` - If scope clarified or changed

### Key Project Files
- `package.json` - Dependencies and scripts
- `CLAUDE.md` - Project-specific Claude Code settings
- `tests/` - Test suite location

### Important Contacts
- **Project Owner:** [Name/email if applicable]
- **Previous Agent:** [Name if transitioning]
- **Next Agent:** [To be assigned]

---

**Document Created:** [DATE]  
**Agent:** [Agent name/type]  
**Revision:** 1.0  

**For questions about this standard, see:** `/docs/AGENT-DOCUMENTATION-STANDARDS.md`
```

---

## Expected Deliverable Locations

When completing work, create documents in these locations:

| Document Type | Location | Format |
|---|---|---|
| Phase Completion | `docs/handoffs/V{VERSION}-{PHASE}-COMPLETE-{DATE}.md` | Markdown |
| Findings/Analysis | `docs/findings/{SUBJECT}-REPORT.md` | Markdown/Text |
| Release Notes | `docs/releases/RELEASE-NOTES-v{VERSION}.md` | Markdown |
| Deployment Procedure | `docs/deployment/DEPLOYMENT-{NAME}.md` | Markdown |
| User Guide | `docs/guides/{GUIDE-NAME}.md` | Markdown |
| Research | `docs/research/{TOPIC}/` | Markdown |
| Session Record | `docs/archives/session_records/{DATE}_V{VERSION}-{DESC}.md` | Markdown |
| Archived Phases | `docs/archives/build-artifacts/{PHASE-FILE}.md` | Markdown |

---

## Key Rules

### ❌ DO NOT
- Create documentation files at the root directory (except README and ROOT-NAVIGATION)
- Name files `PHASE-X-SUMMARY.md` at root (use docs/archives/build-artifacts/)
- Name files `RELEASE-NOTES-v*.md` at root (use docs/releases/)
- Name files `DEPLOYMENT-*.md` at root (use docs/deployment/)
- Create generic temporary files that clutter root

### ✅ DO
- Organize by type in subdirectories
- Use clear, descriptive filenames
- Include version numbers in release/handoff documents
- Include dates in handoff documents
- Create handoff documents when completing major work
- Update ROOT-NAVIGATION.md if directory structure changes
- Link between related documents
- Archive old phase files to build-artifacts

---

## Examples of Correct Structure

### ✅ Good Examples
```
docs/handoffs/V12.5.0-PHASE-1-COMPLETE-2026-06-14.md          ← Handoff
docs/releases/RELEASE-NOTES-v12.5.0.md                         ← Release notes
docs/deployment/DEPLOYMENT-CHECKLIST.md                        ← Deployment doc
docs/guides/QUICKSTART-TOR-CIRCUITS.md                         ← User guide
docs/findings/CODE-QUALITY-FINAL-REPORT.txt                    ← Analysis
docs/archives/build-artifacts/PHASE-5-COMPLETION-SUMMARY.md    ← Old phase doc
docs/archives/session_records/2026-06-14_V12.5.0-PHASE-1-COMPLETION.md ← Session
```

### ❌ Bad Examples
```
PHASE-5-COMPLETION-SUMMARY.md                    ← At root (move to archives)
RELEASE-NOTES-v12.5.0.md                         ← At root (move to releases)
DEPLOYMENT-GUIDE.md                              ← At root (move to deployment)
CODE-QUALITY-FINAL-REPORT.txt                    ← At root (move to findings)
V12.5.0-PHASE-1-COMPLETE-2026-06-14.md          ← At root (move to handoffs)
```

---

## Transition Checklist

When handing off to the next agent:

- [ ] All deliverables documented in handoff file
- [ ] Handoff file saved to `docs/handoffs/`
- [ ] All code changes committed to git
- [ ] Tests pass (or known failures documented)
- [ ] ROOT-NAVIGATION.md updated (if directory structure changed)
- [ ] ROADMAP.md updated (if timeline changed)
- [ ] No temporary files left at root
- [ ] Previous agent's work properly archived
- [ ] All relative links work correctly
- [ ] Next steps clearly documented

---

## Questions?

If you have questions about:
- **Documentation standards:** Read this file
- **Project structure:** See `/docs/DOCUMENTATION-STRUCTURE.md`
- **File organization:** See `/ROOT-NAVIGATION.md`
- **Project roadmap:** See `/docs/ROADMAP.md`
- **Previous work:** Check `/docs/handoffs/` for earlier phases

---

**Version:** 1.0  
**Status:** ✅ Active - All agents must follow these standards  
**Last Updated:** June 14, 2026  
**Maintained By:** Project Documentation Team

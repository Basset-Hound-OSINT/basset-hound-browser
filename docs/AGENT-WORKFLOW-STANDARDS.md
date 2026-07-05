# Agent and Workflow Standards for Basset Hound Browser

**Version:** 1.0  
**Last Updated:** June 20, 2026  
**Applies To:** All Claude agents, automated workflows, and development scripts

## Standard Repository Organization Instruction

This instruction MUST be included in every agent prompt that creates files, documentation, or reports:

```
CRITICAL INSTRUCTION - Repository Organization:

NEVER create files in the project root directory. The root should contain ONLY:
- package.json
- package-lock.json  
- README.md
- .gitignore
- .dockerignore
- Makefile (if applicable)

For all other files, use proper subdirectories:

📁 Documentation (ALL .md files except README.md) → docs/ with subdirectories:
   ├── docs/api/               - WebSocket API docs, command reference
   ├── docs/guides/            - Deployment, integration, user guides
   ├── docs/security/          - Security docs, hardening, vulnerability reports
   ├── docs/testing/           - Testing strategies, test results, real-world results
   ├── docs/research/          - Research documents, analysis, design docs
   ├── docs/archive/           - Historical records, completed phases
   ├── docs/compliance/        - Compliance and standards
   ├── docs/deployment/        - Deployment procedures and runbooks
   ├── docs/advanced/          - Advanced features documentation
   ├── docs/customer-success/  - Customer docs, FAQs, examples
   ├── docs/core/              - Core architecture documentation
   └── docs/analysis/          - Code and performance analysis

📁 Configuration Files → config/
   Examples: app.config.json, database.config.json, env templates

📁 Automation Scripts → scripts/
   Examples: deploy.sh, build.sh, test-runner.sh

📁 Application Code → src/
   Examples: main.js, websocket server, evasion modules

📁 Tests → tests/
   Examples: unit tests, integration tests, test results in tests/results/

ENFORCE THIS:
1. Before finalizing your work, VERIFY no files were created in the root directory
   Command: find . -maxdepth 1 -type f -name "*.md" ! -name "README.md"
2. If you created any files, move them to the appropriate directory IMMEDIATELY
3. Report the file placements in your summary

EXAMPLES:
❌ WRONG: ./DEPLOYMENT-GUIDE.md
✅ RIGHT: ./docs/guides/DEPLOYMENT-GUIDE.md

❌ WRONG: ./REAL-WORLD-TEST-RESULTS.md
✅ RIGHT: ./docs/testing/REAL-WORLD-TEST-RESULTS.md

❌ WRONG: ./deploy-automation.sh
✅ RIGHT: ./scripts/deploy-automation.sh

❌ WRONG: ./IMPLEMENTATION-SUMMARY.md
✅ RIGHT: ./docs/archive/IMPLEMENTATION-SUMMARY.md or ./docs/research/IMPLEMENTATION-SUMMARY.md
```

## Standard Git Commit Enforcement Instruction

This instruction MUST be included in every agent prompt:

```
⚠️ CRITICAL INSTRUCTION - NO GIT COMMITS

Your role is to write code and documentation, NOT to manage git operations.

NEVER run any of these commands:
- git commit
- git push
- git reset
- git rebase
- git checkout
- Any other git state-altering commands

NEVER create commits, even if asked. Respond with: "I don't manage git commits. 
That's the user's responsibility. I've completed the code/docs; the user will 
handle git operations."

WHY: Agents cannot reliably handle hooks, signing, conflict resolution, or 
authorization. These tasks require human judgment and accountability.

YOUR JOB:
1. Write code files (src/, tests/, etc.)
2. Write documentation (docs/)
3. Run tests locally
4. Report findings and status
5. Wait for user to run 'git add' and 'git commit'

USER'S JOB:
1. Review your changes
2. Create git commits
3. Push to remote
4. Handle PR reviews
```

## Project Scope Alignment

All agents MUST align work with the project's actual scope and mission. Before planning any feature:

1. **Read:** `/docs/PROJECT-SCOPE.md` - Understand the forensic research mission
2. **Align:** Ensure the feature supports research, forensics, or data extraction
3. **Verify:** Check that security constraints are NOT being added (this is a research tool)
4. **Challenge:** Question any feature that restricts user capabilities or data access

**Key Points:**
- This is a forensic/research browser, NOT a production app
- Raw data access and user control are features, not bugs
- Users are responsible for lawful use; browser is neutral
- Evasion, fingerprint spoofing, and deep inspection are core capabilities
- No safety guardrails should be added without explicit project direction

---

## Specific Guidelines by Agent Type

### Research and Analysis Agents
- **Reports** → `docs/research/` or `docs/analysis/`
- **Findings** → `docs/research/[topic-name]/`
- **Performance analysis** → `docs/analysis/performance-reports/`
- **Archive historical research** → `docs/archive/research/`

### Deployment and DevOps Agents
- **Deployment guides** → `docs/deployment/` or `docs/guides/`
- **Deployment scripts** → `scripts/deploy*.sh`
- **Infrastructure docs** → `docs/deployment/infrastructure/`
- **Checklists** → `docs/deployment/checklists/`
- **Deployment reports** → `docs/archive/deployment-reports/` (for historical records)

### Security Agents
- **Security reports** → `docs/security/`
- **Vulnerability analysis** → `docs/security/vulnerabilities/`
- **Hardening guides** → `docs/security/hardening/`
- **Security standards** → `docs/security/standards/`
- **Compliance docs** → `docs/compliance/`

### Testing and QA Agents
- **Test strategies** → `docs/testing/`
- **Test results** → `docs/testing/results/` or `tests/results/`
- **Real-world testing reports** → `docs/testing/real-world-results/`
- **Test coverage analysis** → `docs/analysis/coverage/`
- **Test documentation** → `docs/guides/testing/`

### API and Integration Agents
- **API documentation** → `docs/api/`
- **Integration guides** → `docs/guides/integration/`
- **API examples** → `docs/api/examples/`
- **Integration specifications** → `docs/research/integration-specs/`

### Code Generation and Development Agents
- **Implementation guides** → `docs/guides/` or `docs/research/`
- **Architecture documentation** → `docs/core/` or `docs/research/architecture/`
- **Code examples** → `docs/api/examples/` or `examples/` directory
- **Technical documentation** → `docs/research/technical/`

## Verification Checklist for All Agents

Before completing your task, verify:

- [ ] No .md files created in root directory (except README.md)
- [ ] No report files (.txt, .csv) created in root
- [ ] No FORENSIC-*, ENCRYPTED-*, SENSITIVE-* files in root
- [ ] All documentation placed in appropriate docs/ subdirectory
- [ ] All scripts placed in scripts/ directory
- [ ] All configuration placed in config/ directory
- [ ] Index files created for new directories (if applicable)

Use this command to verify:
```bash
find . -maxdepth 1 -type f \( -name "*.md" -o -name "*.txt" -o -name "FORENSIC*" \) ! -name "README.md"
```

If the command returns nothing, verification is PASSED.

## Reporting File Placements

In your summary, report file placements like this:

```
## File Organization
✅ Files properly placed:
- docs/testing/REAL-WORLD-TEST-RESULTS-2026-06-20.md
- docs/security/SECURITY-ANALYSIS.md
- scripts/automation-deploy.sh
- config/deployment.config.json

✅ Root directory clean - no spurious files created
```

## When to Create New Subdirectories

You MAY create a new subdirectory in docs/ if:
1. You have 10+ files that don't fit existing categories
2. The category is fundamentally different
3. You create an INDEX.md in that subdirectory
4. You document it in REPOSITORY-STANDARDS.md

Example:
```
New subdirectory: docs/performance-optimization/
- docs/performance-optimization/INDEX.md
- docs/performance-optimization/benchmarks/
- docs/performance-optimization/reports/
```

## Enforcement

### Pre-Commit Checks
All commits are checked for root directory violations. Commits with spurious files at root will be rejected.

### CI/CD Pipeline
Deployment pipelines verify repository structure before proceeding. Any root directory violations block deployment.

### Code Reviews
All pull requests are reviewed for compliance with these standards.

## Questions and Escalation

If an agent cannot determine proper file placement:
1. Place the file in `docs/archive/` temporarily
2. Document the uncertainty in the file or git commit
3. Escalate to repository governance for clarification
4. Update this document with the decision

## Integration with REPOSITORY-STANDARDS.md

This document is a companion to `/REPOSITORY-STANDARDS.md`. 

- **REPOSITORY-STANDARDS.md** - Global rules and enforcement for the entire repository
- **AGENT-WORKFLOW-STANDARDS.md** - Specific implementation for agents and automated workflows

Both documents must be kept in sync. Changes to one should be reflected in the other.

---

**Last Reviewed:** June 20, 2026  
**Status:** Active - All agents MUST follow this standard  
**Review Cycle:** Quarterly or when directory structure changes

# Findings Index — /docs/findings/

Navigation index for research findings, audits, fix reports, and per-phase
discovery notes. Authoritative project status lives in
`../planning/PROJECT-STATUS-MATRIX.md`.

This folder is a large historical archive (300+ files). Recent work is listed
first; older material is grouped and pointed at its own sub-indexes below.

---

## 2026-07-04 — MVP Completion Session

Fixes and audits from the MVP-completion session (browser boots + drives,
17-tool MCP, ~70 commands proven live).

Security:
- SECURITY-AUDIT-CONTROL-SURFACE-2026-07-04.md — control-surface security audit (1 CRIT, 4 HIGH)
- SECURITY-HARDENING-2026-07-04.md — loopback bind, SSRF guard, PathValidator applied
- PRIVACY-ANONYMITY-VERIFICATION-2026-07-04.md — privacy/anonymity behaviour verification
- UA-LEAK-COHERENT-IDENTITY-FIX-2026-07-04.md — user-agent leak / coherent-identity fix

Command + capture fixes:
- BROKEN-COMMANDS-FIX-2026-07-04.md — extract_* + get_cookies commands fixed
- SHELL-VS-WEBVIEW-FIX-2026-07-04.md — storage/session/throttle/export/tech command routing fixed
- EXPORT-HAR-FIX-2026-07-04.md — HAR/WARC network export fixed
- FORENSIC-REGISTRATION-2026-07-04.md — forensic + compression commands wired in
- FORENSIC-CAPTURE-COMMAND-2026-07-04.md — forensic-capture command implementation
- WATCH-AUTOMATION-SCREENSHOT-2026-07-04.md — watch/automation + screenshot behaviour
- GUI-TOGGLE-2026-07-04.md — headless/GUI toggle handling

Modularization (extracting monolith code into modules):
- MODULARIZE-config-schema-2026-07-04.md — config-schema module extraction
- MODULARIZE-extraction-manager-2026-07-04.md — extraction-manager module extraction
- MODULARIZE-fingerprint-profile-2026-07-04.md — fingerprint-profile module extraction
- MODULARIZE-image-metadata-2026-07-04.md — image-metadata module extraction
- MODULARIZE-interaction-recorder-2026-07-04.md — interaction-recorder module extraction
- MODULARIZE-network-forensics-2026-07-04.md — network-forensics module extraction
- MODULARIZE-page-monitor-2026-07-04.md — page-monitor module extraction
- MODULARIZE-proxy-2026-07-04.md — proxy module extraction
- MODULARIZE-renderer-2026-07-04.md — renderer module extraction

Cleanup + consolidation:
- PRUNE-EXECUTION-2026-07-04.md — 78 dead files removed (boot-safe)
- FINAL-CONSOLIDATION-2026-07-04.md — error-formatter fix + status matrix refresh
- RAG-BOOTSTRAP-MULTI-KB-FINDINGS-2026-07-04.md — RAG bootstrap multi-KB findings

---

## Historical material (grouped)

The bulk of this folder predates the MVP-completion session. Trust the current
status matrix over older "complete / production ready" claims. Detailed
sub-indexes already exist for the major work streams:

- 00-INDEX-V12.8.0-2026-06-15.md — v12.8.0 planning index
- 00-INDEX-V12.7.0-2026-06-14.md — v12.7.0 planning index
- 00-INDEX-V12.7.0-EVASION-FEATURE-2026-06-14.md — v12.7.0 evasion feature index
- 00-INDEX-MASTER-PLAN-V12.2.0-2026-06-14.md — v12.2.0 master-plan index
- 00-INDEX-CODE-QUALITY-2026-06-15.md — code-quality work index
- AUDIT-INDEX.md — audit reports index
- SECURITY-VALIDATION-INDEX.md — security validation index
- STABILITY-TESTING-INDEX.md — stability testing index
- FINAL-VALIDATION-INDEX.md — final validation index
- ROOT-CLEANUP-INDEX.md — root-cleanup work index
- FREE-TOOLS-RESEARCH-INDEX.md — free-tools research index
- WAVE-14-*-INDEX.md / WAVE-15-*-INDEX.md — wave 14/15 planning + audit indexes
- V12.x-*-INDEX.md — per-release planning indexes

Broad topic clusters in this folder: security audits/hardening, performance
analysis/optimization, documentation audits, Docker/Tor deployment, Wave 13-16
planning, per-phase (Phase 1-30) implementation notes, TOTP/sessions/evasion/
monitoring feature planning, and test-coverage reports.

---

**Purpose:** findings navigation index | **Last Updated:** 2026-07-04

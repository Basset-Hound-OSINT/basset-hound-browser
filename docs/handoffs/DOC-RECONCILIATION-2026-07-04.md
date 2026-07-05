---
title: Documentation Reconciliation — Correction Banners Applied
agent: doc-writer
date: 2026-07-04
authority: docs/planning/PROJECT-STATUS-MATRIX.md + docs/planning/OUTDATED-DOCS.md
scope: Truth-in-labeling only (no rewrites, no code, no commits)
---

# Doc Reconciliation Report — 2026-07-04

## Objective
Stop the inflated "v12.8.0 PRODUCTION COMPLETE / 100% tests / 85-90% evasion / 164 commands"
narrative from deceiving planning agents at first contact. For the highest-signal top-level docs
flagged in `docs/planning/OUTDATED-DOCS.md`, apply a clear correction banner pointing at the
authoritative `docs/planning/PROJECT-STATUS-MATRIX.md`.

## Method / decision
- **Chose BANNER over ARCHIVE for every target.** Rationale: these are all *living reference / index*
  documents (READMEs, API reference, feature indexes, release notes, integration guides) that are
  heavily cross-linked from the ~250-file docs tree and from many INDEX-*.md files. Physically moving
  them would break those cross-links and is more invasive than warranted for a "conservative,
  truth-in-labeling" pass. A banner keeps each doc discoverable while flagging it as inflated and
  redirecting the reader to ground truth. **No files were moved or deleted; nothing was archived.**
- Banner placed as the very first line (a Markdown blockquote so it renders prominently above the
  original H1), using the mandated wording plus one doc-specific correction line.
- Work-zone respected: did **not** touch `docs/planning/`, `docs/findings/`, `docs/research/`,
  `docs/rag-app/`, existing `docs/handoffs/` files, or any code. Several flagged offenders live in
  those blocked dirs (see "Not touched" below) and were intentionally left for an in-scope agent.

## Banner wording (applied verbatim + per-doc note)
> ⚠️ **OUTDATED** — see `docs/planning/PROJECT-STATUS-MATRIX.md` for the authoritative status
> (2026-07-04). Claims below are inflated/unverified. _[doc-specific correction]_

## Files BANNERED (13) — corrected in place, none archived

| # | File | OUTDATED-DOCS entry | Core correction in banner |
|---|------|--------------------|---------------------------|
| 1 | `README.md` | Tier 3 #11 (+ narrative) | "164+ cmds / v12.8.0 Production Ready / 100% tests" inflated; proven surface is small deterministic core set; evasion ~0%; no MCP server |
| 2 | `docs/README.md` | index repeating claims | version/status + feature-complete claims unverified |
| 3 | `docs/INDEX.md` | Tier 3 #11 | "v12.0.0 Production Live / 164 commands" stale (~888 handlers, small proven subset) |
| 4 | `docs/API-REFERENCE-AUTHORITATIVE.md` | Tier 2 #8 | schemas not verified; `extract_links` returns categorized keys not `{links,total}`; "300+" conflates written vs working |
| 5 | `docs/integration_readiness.md` | Tier 1 #1 / Tier 3 #12 | no MCP server / `browser_mcp/server.py` on disk; headless IS supported |
| 6 | `docs/guides/integration_readiness.md` | Tier 1 #1 / Tier 3 #12 | (same as #5 — duplicate file) |
| 7 | `docs/features/NEW-FEATURES-INDEX.md` | Tier 1 #3 | "All Features Production Ready" false; evidence/coherence/storage unregistered/unwired |
| 8 | `docs/features/PROXY-INTELLIGENCE.md` | Tier 1 #2 | proxy-pool/intelligence cmds NOT registered (migrated out); only single-proxy + Tor real |
| 9 | `docs/FEATURES-IMPLEMENTATION-2026-05-31.md` | Tier 1 #2 | "✅ COMPLETE" = file written, not wired/verified |
| 10 | `docs/technical/EVIDENCE-PACKAGING-ARCHITECTURE.md` | Tier 1 #3 / #5 | evidence cmds don't exist/unregistered; Phase 29 REMOVED; export_format_* broken (getLogs bug) |
| 11 | `docs/releases/RELEASE-NOTES-v12.5.0.md` | Tier 1 #4 | evasion % are simulator/hardcoded vs fake endpoints; treat as ~0%; ~37 evasion modules dead code |
| 12 | `docs/wiki/improvements/V12.9.0-VALIDATION.md` | Tier 2 #7 | orchestration REMOVED; real green = 50 tests; collaboration fails 11+/85; 0 of 23 cmds registered |
| 13 | `examples/integration/claude-mcp-examples.md` | Tier 1 #1 | setup steps FAIL — MCP server absent; use WS API directly |

## Files ARCHIVED (0)
None. See "Method / decision" — banners chosen for all targets to preserve cross-links.

## Notable in-scope offenders NOT bannered (deliberate scoping)
Left to avoid sprawl / low first-contact risk; can be handled in a follow-up if desired:
- `docs/guides/IMPLEMENTATION-GUIDE.md` (Tier 1 #4 evasion) — secondary guide, not first-contact.
- `docs/wiki/guides/V12.9.0-USER-GUIDES.md` (Tier 1 #5 warc/har) — covered upstream by #10/#12 banners.
- `docs/wiki/improvements/COLLABORATION-API-IMPLEMENTATION.md` (Tier 2 #7) — covered by #12.
- `docs/EXTRACTION-REFACTORING-P2-COMPLETION.md` (Tier 2 #8) — dated completion artifact; #4 banner
  already corrects the authoritative extraction schema a planner would rely on.
- `docs/releases/v12.7.0-RELEASE-NOTES.md` (Tier 2 #9), `docs/core/api-reference.md` (Tier 3 #13),
  `docs/architecture/core/FORENSIC-FEATURE-ARCHITECTURE-COMPREHENSIVE.md` (Tier 3 #11) — lower risk.

## Flagged files that could NOT be touched (blocked by work zone)
These remain uncorrected and belong to another agent's zone:
- `docs/findings/*` — PHASE-15-17-MCP-EVASION, FINAL-SESSION-SUMMARY-2026-01-09, PHASE-24-SUMMARY,
  V12.8.0-FEATURE-4-FORENSICS-DETAILED-PLAN, FINAL-VALIDATION-COMPREHENSIVE-REPORT,
  PRODUCTION-READINESS-AUDIT-2026-06-14, PHASE-27-COOKIE-MANAGEMENT, REALWORLD-TESTING-AUDIT.
- `docs/research/*` — evasion-canvas-webgl/README, obscura/OBSCURA-EVASION-ANALYSIS,
  competitor-analysis/kameleo/ARCHITECTURE-AND-FEATURES.
- `MEMORY.md` — the inflated auto-memory lives at `/home/devel/.claude/.../MEMORY.md` (outside
  PROJECT_ROOT) and no repo-root copy exists; it still says "v12.8.0 PRODUCTION COMPLETE / 164 cmds /
  85-90% evasion" and should be corrected by whoever owns memory.
- Pre-existing `docs/archive/` and `docs/archives/` completion reports (e.g. deployment-logs,
  MCP-TESTING-COMPLETE-MASTER-REPORT) were left as-is; they are already under archive/ but are NOT
  banner'd — a follow-up could add stale banners there per OUTDATED-DOCS handling guidance.

## Verification
- All 13 edits reported success; each banner sits above the original H1 as a blockquote.
- No commits made. No code touched. No files moved or deleted.
- Some referenced targets did not exist and were skipped: `DEPLOYMENT-COMPLETE-2026-05-11.md` (root),
  root `MEMORY.md`, `docs/HTML-CAPTURE-API.md` — all absent on disk.

## Suggested follow-ups (out of this agent's zone)
1. Correct the out-of-repo `MEMORY.md` (single biggest source of the inflated narrative).
2. An in-scope agent should banner the `docs/findings/` and `docs/research/` offenders in Tier 1 #4
   (evasion effectiveness) — those are the most technically deceptive.
3. Add stale banners to already-archived completion reports so they are never re-cited as evidence.

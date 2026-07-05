# Modularization: `network-forensics/forensics.js`

**Date:** 2026-07-04
**Agent:** js-dev @ modularize-network-forensics
**Work zone:** `network-forensics/forensics.js` + new `network-forensics/forensics/` subdir (nothing else touched)
**Plan ref:** `docs/planning/MODULARIZATION-PLAN-2026-07-04.md` §3.8

## Goal
Split the 1270-line monolith into modules each `< 1200` lines. `forensics.js`
becomes a thin barrel whose `module.exports` is byte-for-byte identical to the
original.

## Result — PASS

Every new/changed file passes `node -c`, export keys are unchanged, and all
files are under the 1200-line cap.

### Module map

| File | Lines | Role |
|------|------:|------|
| `network-forensics/forensics.js` | 12 | Barrel — `module.exports = require('./forensics/collector')` |
| `network-forensics/forensics/collector.js` | 1072 | `NetworkForensicsCollector` class (capture/query/analyze/export orchestration). Exporter privates now delegate to `./exporters`. |
| `network-forensics/forensics/exporters.js` | 244 | Pure export functions: `exportJson`, `exportCsv`, `exportHtml`, `exportTimeline`, `summarizeTimelineEvent` — of `(report, options)` |
| `network-forensics/forensics/constants.js` | 32 | `FORENSICS_TYPES`, `EXPORT_FORMATS` (shared; separate file avoids a collector↔exporters require cycle) |

Original: `network-forensics/forensics.js` = 1270 lines (one class + 2 const objects).

### Dependency graph (no cycles)
```
forensics.js (barrel)
  └─ forensics/collector.js
       ├─ forensics/constants.js
       └─ forensics/exporters.js
            └─ forensics/constants.js
```

### What moved (code moved, logic NOT rewritten)
- The 5 private methods `_exportJson`, `_exportCsv`, `_exportHtml`,
  `_exportTimeline`, `_summarizeTimelineEvent` (lines 1005–1229 of the original,
  ~225 lines incl. the large HTML template literal) were **byte-sliced** out of
  the class and converted to standalone pure functions in `exporters.js`. Only
  the method signatures were turned into `function` declarations and the one
  intra-block call `this._summarizeTimelineEvent(event)` became
  `summarizeTimelineEvent(event)`. **All body text — including every whitespace
  character of the HTML template literal — is preserved verbatim** (no dedent
  applied, precisely to avoid altering template-string content).
- The class retains thin delegator methods of the same names, so
  `exportForensicReport()` and its `switch` are **untouched** and the class's
  internal method surface is preserved.
- `FORENSICS_TYPES` / `EXPORT_FORMATS` moved verbatim into `constants.js`;
  `collector.js` and the barrel re-import them.

## Verification (lightweight, no smoke:mvp)

1. **Syntax** — `node -c` OK on all 4 files (`forensics.js`, `collector.js`,
   `exporters.js`, `constants.js`).

2. **Export keys — UNCHANGED**
   `node -e "console.log(Object.keys(require('./network-forensics/forensics.js')).sort().join(','))"`
   - Baseline (before): `EXPORT_FORMATS,FORENSICS_TYPES,NetworkForensicsCollector`
   - After:              `EXPORT_FORMATS,FORENSICS_TYPES,NetworkForensicsCollector` ✅

3. **Byte-fidelity equivalence vs original (`git show HEAD:…`)** — with a fixed
   `report` object (so timestamps/random inputs match), the new modules and the
   original produced **byte-identical** output for `_exportJson`, `_exportCsv`,
   `_exportHtml` (full HTML template), `_exportTimeline`, and
   `_summarizeTimelineEvent` across all 6 event types + unknown. Constants
   deep-equal. ✅

4. **Existing unit suite** — `npx jest tests/unit/network-forensics.test.js`
   → **90/90 passed**. ✅

## Notes / caveats
- External consumers (`tests/unit/network-forensics.test.js`,
  `websocket/commands/forensic/network/network-forensics-commands.js`) require
  the barrel path `network-forensics/forensics`, which is preserved — no
  changes needed outside the work zone.
- The extracted exporter functions carry the original method-body indentation
  (2-space signature / 4-space body) since no dedent was applied; this is
  cosmetic and deliberate to guarantee template-literal fidelity.
- No git commits made. No files outside the work zone modified.

# Modularization: `monitoring/page-monitor.js`

**Agent:** js-dev@basset-hound-browser:modularize-page-monitor
**Date:** 2026-07-04
**Task:** Split `monitoring/page-monitor.js` (1497 lines) into modules each < 1200 lines, per
`docs/planning/MODULARIZATION-PLAN-2026-07-04.md` §3.4. Barrel export surface must stay identical.
**Method:** Move code, don't rewrite logic. Pure/cohesive method clusters extracted verbatim into a
new `monitoring/page-monitor/` subdirectory and mixed back onto `PageMonitor.prototype` via
`Object.assign`. `monitoring/page-monitor.js` is now a thin barrel re-exporting the implementation.

---

## Module map

| File | Lines | Contents |
|------|------:|----------|
| `monitoring/page-monitor.js` (barrel) | 15 | `module.exports = require('./page-monitor/monitor')` + doc header |
| `monitoring/page-monitor/constants.js` | 51 | `DETECTION_METHODS`, `CHANGE_TYPES`, `MONITOR_STATUS` |
| `monitoring/page-monitor/change-detectors.js` | 412 | `compareSnapshots`, `detectHashChanges`, `detectDOMChanges`, `detectTextChanges`, `detectAttributeChanges`, `detectStructureChanges`, `detectVisualChanges`, `deduplicateChanges`, `categorizeChanges`, `generateChangeSummary`, `calculateSignificance` (11 fns) |
| `monitoring/page-monitor/report-generators.js` | 233 | `exportChangeReport`, `generateCSVReport`, `generateHTMLReport`, `generateMarkdownReport` (4 fns) |
| `monitoring/page-monitor/monitor.js` | 869 | `PageMonitor` class (lifecycle: constructor, id gen, IPC listeners, start/stop/pause/resume/schedule, `captureSnapshot`, `checkForChanges`, `notifyChange`, `getPageChanges`, `comparePageVersions`, `getMonitoringSchedule`, `configureChangeDetection`, `getMonitoringStats`, `addMonitoringZone`, `removeMonitoringZone`, `listMonitoredPages`, `cleanup`) + `Object.assign(prototype, ...)` mixin + `module.exports` |

**Every new file is < 1200 lines** (largest: `monitor.js` at 869). Original was 1497.

### Design decision: prototype mixin
The 15 extracted detector/report functions are all invoked in the original via `this.<method>(...)`
(e.g. `compareSnapshots` calls `this.detectHashChanges`; `detectVisualChanges` uses
`this.mainWindow`/`this.pendingRequests`; `exportChangeReport` uses `this.monitors` etc.). To move
them **byte-for-byte** without rewriting call sites, they are kept as regular functions that use
`this`, exported as objects, and reattached with:

```js
Object.assign(PageMonitor.prototype, changeDetectors, reportGenerators);
```

`this` binds to the instance exactly as before. No method body was altered.

### Import placement
- `ipcMain` (electron) — used only by `setupIPCListeners` → stays in `monitor.js`.
- `fs`, `path` — used only by `exportChangeReport` → moved to `report-generators.js`.
- `DETECTION_METHODS`, `CHANGE_TYPES` — imported by `change-detectors.js`.
- `crypto` — was `require`d at the top of the original but **never used anywhere** in the file. Dropped
  (dead import; removal is behavior-neutral, not a logic change).

---

## Verification (lightweight per task; no smoke:mvp)

**1. Syntax — `node -c` on every new/changed file → all OK**
```
OK  monitoring/page-monitor.js
OK  monitoring/page-monitor/constants.js
OK  monitoring/page-monitor/change-detectors.js
OK  monitoring/page-monitor/report-generators.js
OK  monitoring/page-monitor/monitor.js
```

**2. Export keys UNCHANGED vs baseline**
```
baseline (pre-split): CHANGE_TYPES,DETECTION_METHODS,MONITOR_STATUS,PageMonitor
after split (barrel):  CHANGE_TYPES,DETECTION_METHODS,MONITOR_STATUS,PageMonitor   ← identical
```

**3. Prototype integrity + functional spot-check**
- All 15 mixed-in methods + sampled lifecycle methods present as functions on `PageMonitor.prototype`
  (`missing methods: NONE`).
- Pure methods produce correct output on a bare instance:
  `categorizeChanges`, `calculateSignificance` (0.16 for `{structure:[{},{}]}`), `generateCSVReport` — all pass.
- Requirer import shape intact: `const { PageMonitor, DETECTION_METHODS, CHANGE_TYPES, MONITOR_STATUS } = require('./monitoring/page-monitor')` resolves; `PageMonitor` is a class; `DETECTION_METHODS.HYBRID === 'hybrid'`.

**Requirers (unaffected, both use the barrel path):**
- `tests/unit/page-monitor.test.js`
- `websocket/commands/monitoring-commands.js`

**4. ESLint — no new errors/warnings introduced.**
Original content linted with the project config (`eslint:recommended`) already had **3 errors + 6 warnings**.
The split has **3 errors + 5 warnings** (one fewer — the removed dead `crypto` import).

| Rule | Original | After split | Delta |
|------|:-------:|:-----------:|:-----:|
| `no-case-declarations` (error) | 3 | 3 | 0 (carried over verbatim) |
| `no-unused-vars` (warning) | 6 | 5 | −1 (`crypto` dropped) |

The 3 `no-case-declarations` errors are **pre-existing debt** in the `case DETECTION_METHODS.HYBRID:`
block (original lines 539–541; now `change-detectors.js` lines 61–63 — bare `const` declarations in a
`case` without a block). They were moved byte-for-byte and are **not new**. Left untouched per the
"move code, don't rewrite logic" constraint; a follow-up could wrap that case in `{ }` (behavior-neutral)
to clear them.

---

## Summary
`monitoring/page-monitor.js` split into a 15-line barrel + 4 modules under `monitoring/page-monitor/`,
all < 1200 lines. Export surface byte-for-byte identical; both requirers unaffected; logic moved, not
rewritten. No commits made. No files outside the work zone were edited (this report excepted, per the
REPORT TO instruction).

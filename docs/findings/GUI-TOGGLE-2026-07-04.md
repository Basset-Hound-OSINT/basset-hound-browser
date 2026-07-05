---
title: GUI Visibility Toggle (Feature B) — Implementation & Verification
date: 2026-07-04
agent: js-dev@basset-hound-browser:gui-toggle
spec: docs/planning/GUI-AND-SIMPLE-CAPTURE-PLAN.md (Feature B)
status: complete, verified live on DISPLAY=:1
---

# GUI Visibility Toggle — Report

Implemented the opt-in GUI as a pure runtime visibility toggle per the plan
(Feature B). The full Chromium-style chrome already existed and was wired
(renderer/index.html, renderer.js, preload.js); it was only hidden by the headless
override. This change reveals it when GUI is explicitly requested AND a display is
present, while keeping HEADLESS the default. Two operator-reported CSS layout bugs in
that chrome were also fixed (webview fill + horizontal tabs).

## 1. Toggle logic (file:line)

- `src/main/main.js:619` — `getGuiOptions()` (added next to `getHeadlessOptions()`).
  Returns `{ enabled, hasDisplay, isGuiMode }` where
  `enabled = appConfig.gui?.enabled || argv.includes('--gui') || ['1','true'].includes(BASSET_GUI)`,
  `hasDisplay = headlessManager.detectHeadlessEnvironment().hasDisplay` (wrapped in
  try/catch → assumes no display on error), and `isGuiMode = enabled && hasDisplay`.
- `src/main/main.js:815-831` — in `createWindow()`: compute `guiOptions`/`isGuiMode`,
  warn if `enabled && !hasDisplay` (fallback to headless), set the single source of
  truth `windowConfig.show = isGuiMode` (main.js:821), and gate the headless override
  so it is SKIPPED in GUI mode: `if (isHeadlessMode && !isGuiMode) { getBrowserWindowConfig(...) }`
  (main.js:826) else log GUI-enabled (main.js:830).
- `src/main/main.js:1156` — offscreen rendering now gated with `&& !isGuiMode` so a
  visible window never renders offscreen.
- `config/cli.js:106-111` — new `gui` CLI arg (`--gui` → `gui.enabled`), also added to
  the `Headless` help category so it shows in `--help`.
- `package.json:11` — `"start:gui": "electron . --gui"` (no `build.files` change).
- `renderer/gui-logic.js` (NEW) — extracted DOM-free logic (UMD, mirrors
  update-manager.js): `resolveNavigationUrl`, `toolbarActionToCommand`
  (toolbar action → WS command frame; command names match the live API: `navigate`,
  `navigate_back`, `reload_page`), `connectionStateReducer`, `CONNECTION_STATES`,
  `DEFAULT_HOME`. Exports via `module.exports` (jest) and `globalThis.GuiLogic`
  (renderer).
- `renderer/renderer.js:6` — the single added import line:
  `import('./gui-logic.js').catch(() => {});` — a side-effect dynamic import that
  registers `globalThis.GuiLogic` in the renderer and is a safe no-op if unavailable.
  No other renderer/preload change (chrome reused verbatim).

Precedence summary: default = HEADLESS (hidden). `--gui`/`BASSET_GUI=1` + display →
visible, headless override + offscreen skipped. `--gui` + no display → warn + headless
fallback. `--gui` also overrides `--headless` when a display exists (GUI wins on show).

## 2. Verification (live)

Environment: non-Docker host, DISPLAY=:1 accessible (xdpyinfo OK), Xvfb NOT installed.
All runs used isolated WS ports + isolated user-data-dirs; all processes reaped; no
strays; no source files outside the work zone touched.

- **Headless unchanged (hidden):** launched the exact `start:headless` invocation on a
  distinct port (8791). Log shows `[Headless] BrowserWindow configured for headless
  mode` and NO `[GUI]` line; the created X window (via `xwininfo`) was
  `Map State: IsUnMapped` (hidden); WS server booted clean.
- **Smoke unchanged:** `npm run smoke:mvp` → **15/15 PASS** (the capture team's
  `forensic_capture` row is already in the harness; it self-boots a headless browser
  and drives the live API — my main.js change does not disturb it).
- **GUI visible on :1:** launched with `--gui` (and separately `BASSET_GUI=1`) on
  DISPLAY=:1. Log shows `[GUI] GUI mode enabled — showing browser window (headless
  visibility override skipped)`; the window is `Map State: IsViewable` (VISIBLE),
  1372x768, title "Google - Basset Hound" — i.e. the chrome loaded and the initial tab
  navigated via the existing `<webview>`. Drove it via CDP: address bar/toolbar/tabs
  and `<webview>` all functional. No CSP/module errors from the `gui-logic.js` import.
- **No-display fallback:** proved with the real `headlessManager`: with `DISPLAY`
  unset, `detectHeadlessEnvironment().hasDisplay === false`, so
  `isGuiMode = (enabled=true && hasDisplay=false) === false` and the warn branch fires
  → falls back to headless (no crash). (Xvfb absent confirms a real window genuinely
  cannot paint without a display, which is exactly why the fallback is correct.)
- **Unit test (merge gate):** `tests/unit/gui-logic.test.js` → **16/16 PASS**
  (URL resolution, toolbar→WS-frame mapping, connection-state reducer, dual export).
- `node -c` passes on all changed JS (main.js, cli.js, gui-logic.js, renderer.js,
  test); `package.json` valid JSON.

## 3. Layout fixes (renderer/index.html — coordinator-requested, same work zone)

Both were CSS-only; markup and JS reused. Verified live via CDP geometry + screenshot
of my confirmed window on :1.

### 3a. Webview did not fill the space between toolbar and status bar (dead space)
Classic flex/percentage-height chain break. Fixes:
- body already `display:flex; flex-direction:column; height:100vh` (reset gives margin:0).
- `.tab-bar`, `.toolbar`, `.status-bar` → `flex: 0 0 auto` (index.html:316, 28, 161).
- `.browser-content` (the middle region) → `flex: 1 1 auto; min-height: 0;` plus
  `display:flex; flex-direction:column` (index.html:110-117) — `min-height:0` is the key.
- `.webview-container` → `flex: 1 1 auto; min-height: 0` (index.html:454-455).
- active `<webview>` → absolute `inset:0` (top/left/right/bottom:0) + `display:flex`
  (index.html:461-469), preserving the absolute tab-stacking model.
- generic `webview` → `display:flex; flex:1 1 auto` (index.html:123).

CDP geometry (live): toolbarBottom=87 == browserContentTop=87 (no top gap);
browserContentBottom=745 == statusBarTop=745 (no bottom gap); webview-container
height=658 fills the entire middle region.

### 3b. Tabs stacked vertically instead of horizontally
Root cause: `#tabs-container` (where renderer.js:89 appends `.tab` elements) had no
CSS → defaulted to `display:block`, so the block-level flex tabs stacked vertically.
Fix:
- NEW `#tabs-container` rule (index.html:343-352): `display:flex; flex-direction:row;
  align-items:center; gap:2px; flex:1 1 auto; min-width:0; overflow-x:auto` — tabs lay
  out in one horizontal, scrollable row.
- `.tab` → `flex: 0 0 auto` (index.html:355) so tabs keep their 120–200px width and
  scroll horizontally instead of shrinking/wrapping.

CDP geometry with 3 tabs (live): `tabs-container` computed `display:flex`,
`flexDirection:row`; tab rects `[{x:8,y:4,w:200},{x:210,y:4,w:120},{x:332,y:4,w:120}]`
— all on the SAME row (y=4), increasing x. Screenshot confirmed three tabs side-by-side
with the active page filling the area down to the status bar.

## 4. Acceptance checklist
- [x] `--gui` and `BASSET_GUI=1` each make the window visible on a display host; absence keeps it hidden.
- [x] `npm run start:headless` unchanged (hidden; smoke 15/15).
- [x] `--gui` with no display warns and falls back to headless (no crash).
- [x] Address bar / back-forward-reload-home / tabs / `<webview>` work in the visible window; only the `gui-logic.js` import added to the renderer.
- [x] `start:gui` present; no `build.files` change.
- [x] `tests/unit/gui-logic.test.js` passes (16/16).
- [x] Webview fills toolbar→status-bar region; tabs lay out horizontally.
- [x] No touch to websocket/server.js, scripts/smoke-mvp.js, or capture files.

## 5. Notes
- **Temp/scratch:** the capture team's `scripts/clean-test-artifacts.js` wipes `tmp/*`
  (including `tmp/_scratch`) on their test runs, and it clobbered an in-flight GUI boot
  mid-run. For the visible-window verification I used a project-internal, gitignored,
  cleaner-safe dir (`test-user-data-gui/`, matched by `.gitignore` `test-user-data*/`,
  not in the cleaner's list) and removed it when done. Nothing left under
  `/home/devel/bhb-*` was created by this session; pre-existing `bhb-*` files belong to
  prior/other work and were left untouched.
- Files changed: `src/main/main.js`, `config/cli.js`, `package.json`,
  `renderer/index.html`, `renderer/renderer.js`; new `renderer/gui-logic.js`,
  `tests/unit/gui-logic.test.js`. No commits.

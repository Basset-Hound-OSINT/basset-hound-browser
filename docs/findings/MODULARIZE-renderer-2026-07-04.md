# MODULARIZE — `renderer/renderer.js` (2026-07-04)

Agent: `js-dev@basset-hound-browser:modularize-renderer`
Work zone: `renderer/renderer.js` + new `renderer/*.js` modules (+ minimal `renderer/index.html` script includes).

## Goal & result
Split `renderer/renderer.js` (1499→ was 1527 lines on disk) to **< 1200 lines** using the
namespace / `ctx`-passing approach mandated by `docs/planning/MODULARIZATION-PLAN-2026-07-04.md`
§6.3 (the whole file is ONE `DOMContentLoaded` closure — functions capture closure-scoped DOM
refs, so `require`-based extraction is impossible).

**`renderer/renderer.js`: 1527 → 587 lines** (−940). Gate cleared with wide margin.

## Modules created (cohesive groups, each `setup(ctx)` on a global, UMD like `gui-logic.js`)
| File | Lines | Global | Contents |
|---|---|---|---|
| `renderer/renderer-ipc.js` | 518 | `globalThis.RendererIPC` | Tab/session events + WS command handlers: navigate, get_url, execute, get_content, storage ops, wait-Cloudflare, click, fill, page-state, wait-element, scroll |
| `renderer/renderer-screenshots.js` | 411 | `globalThis.RendererScreenshots` | 5 `capturePage` handlers: viewport(basic+enhanced), full-page, element, area |
| `renderer/renderer-downloads.js` | 133 | `globalThis.RendererDownloads` | Download event wiring + status-bar indicator + toast (private `activeDownloads` map) |

### The `ctx` object (built in `renderer.js` `init()`)
`{ api, tabs, createTab, switchToTab, updateTab, getActiveWebview, getActiveTabId, resolveNavigationUrl, showLoading, escapeHtml, urlInput, sessionName }`.
Reassigned scalar `activeTabId` is read **live** via `getActiveTabId: () => activeTabId` (modules
only read it; `switchToTab`/`closeTab`, which write it, stay in the IIFE). The two `activeTabId`
reads inside the moved IPC code (`onTabSwitched`, `onNavigateWebview`'s emit) were swapped to
`getActiveTabId()`. All other moved code is verbatim.

### Load order (`index.html`)
`update-*.js` → **`renderer-ipc.js` → `renderer-screenshots.js` → `renderer-downloads.js`** →
`renderer.js`. The `Renderer*` globals register synchronously before `renderer.js`'s
`DOMContentLoaded` handler runs and calls `setup(ctx)` on each.

## PRESERVED verbatim (per CRITICAL note)
- The `init()` coherent-UA / evasion-script fetch (main IPC `getEvasionScript` → preload fallback).
- GUI-toggle / layout: no `index.html` CSS touched (only 3 `<script>` tags added). The
  `browser-content`/`webview`/`webview-container` flex-fill rules are untouched.
- `createTab`/`switchToTab`/`closeTab`/`updateTab`/`getActiveWebview`, navigation
  (`navigateTo`/`goBack`/`goForward`/`refresh`/`goHome`), UI helpers, `setupWebviewListeners`,
  `injectEvasionScript`, `pollWebSocketStatus` all remain in the IIFE unchanged.

## Verification
- **`node -c`**: PASS on all 4 files (renderer.js, renderer-ipc.js, renderer-screenshots.js, renderer-downloads.js).
- **Module load**: each `require()`s cleanly and exposes `setup` (side-effect-free at import).
- **`npm run smoke:mvp` (headless): 15/15 PASS** (baseline was also 15/15). The passing checks
  exercise the extracted handlers end-to-end: navigate, get_url, get_content, screenshot
  (20105 bytes), fill, click, local-storage round-trip — all now routed through the new modules.
- **GUI render** (`BASSET_GUI=1` on `DISPLAY=:1`, window captured by id via `import -window`):
  chrome renders correctly — **tabs horizontal** (tab + `+` + Default Session), full toolbar
  (logo, back/forward/reload/home, address bar, Go), **webview fills** the content area with the
  live page, status bar shows `WebSocket: Connected / Ready / Clients: 1 / <url>`. WS `navigate`
  (→ extracted `onNavigateWebview`) drove example.com→wikipedia; address bar + window title +
  status URL all updated; `screenshot_viewport` (→ extracted module) returned a real 1282×654 image.
  Screenshots: `scratchpad/win-02-example.png`, `win-03-wikipedia.png`.
- Process groups reaped after each GUI/smoke run; distinct OS-assigned WS ports; no stray electron.

## Notes / pre-existing (NOT regressions, outside work zone)
- `eslint` reports `no-undef` for `window`/`document`/`console` on the renderer files — this is a
  **pre-existing config gap**: base `.eslintrc.json` has `env: {node, es2021, jest}` with no
  `browser` env and no `renderer/**` override, so the untouched `renderer/update-manager.js` fails
  identically (14 errors). Fix would be a `renderer/**` browser-env override in `.eslintrc.json`
  (outside this work zone). `node -c` (the real syntactic gate) is clean.
- `reload_page` / `navigate_back` WS replies lack a `success` field in my ad-hoc driver's heuristic;
  their handling is in main/server (not the renderer's moved IPC), and pages did not break. The
  toolbar back/forward/reload button handlers (`goBack`/`goForward`/`refresh`) are unchanged.

No commits made.

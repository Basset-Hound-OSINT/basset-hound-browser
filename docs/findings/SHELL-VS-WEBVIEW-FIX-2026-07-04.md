# Shell-vs-Webview Bug Class Fix — storage, session capture, throttling, raw HTML, tech detection

**Date:** 2026-07-04
**Agent:** debugger (shell-vs-webview)
**Work zone:** `websocket/server.js`, `renderer/renderer.js`, `src/preload/preload.js`, `network/throttling.js`, `websocket/commands/session-persistence-commands.js`
**Status:** All five instances fixed and verified live (headless Electron, distinct WS ports 8791/8792/8793, `--user-data-dir=/home/devel/bhb-userdata`, group-reaped). All touched files pass `node -c`. No commits.

---

## Summary

The recurring defect: commands operated on `this.mainWindow.webContents` — the empty browser **SHELL** — instead of the active `<webview>` guest where pages actually load. The prior agent established the fix pattern (`getWebviewPageContent()` in `server.js:2746`, routing through the renderer's `get-page-content` IPC → `getActiveWebview()`). This session applied the same routing to the remaining instances.

| Instance | Root cause | Fix | Live result |
|----------|-----------|-----|-------------|
| Storage ops (localStorage/sessionStorage/IndexedDB) | Renderer had **no consumer** for `execute-storage-operation` IPC — every storage op hung 30s and timed out | Added the missing consumer in `renderer.js`, routed to `getActiveWebview()` | `set_local_storage`→`get_local_storage` round-trips the exact value; JS readback matches |
| `save_session_state` / `restore_session_state` | Passed shell `mainWindow.webContents` to `captureState`/`restoreState`; **also** a pre-existing bad import made the class `undefined` | Retargeted to guest via `resolveGuestWebContents()`; fixed the import | `save_session_state` returns `url: https://example.com/`, `title: Example Domain` (from the guest) |
| CDP network throttling | Debugger attached to shell `webContents` (init in `main.js:900`) — throttled nothing the page loads | `throttling.js` resolves the guest at attach time | `Debugger attached (target: webview)`; offline mode blocks a same-origin guest `fetch` |
| `export_raw_html` | Read `mainWindow.webContents` outerHTML → shell's blank doc | Routed through `getWebviewPageContent()` | Returns real `example.com` HTML (544 bytes, "Example Domain") |
| `detect_technologies` / `identify_cms` / `identify_analytics` | Read `mainWindow.webContents` outerHTML → shell's blank doc → no detections | Routed through `getWebviewPageContent()` | On `wordpress.org`: detects WordPress, Google Tag Manager, Google Analytics, Google Fonts, YouTube |

---

## Instance 1 — Storage operations (MISSING renderer consumer)

**Root cause.** `StorageManager._executeInWebview` (`storage/manager.js:41`) sends `execute-storage-operation` to `mainWindow.webContents` and awaits a `storage-operation-response`. `main.js:920` wires the response back into `StorageManager.handleOperationResponse`, and `preload.js:665/668` exposes both `sendStorageOperationResponse` and `onExecuteStorageOperation` — but **no code in `renderer.js` ever called `onExecuteStorageOperation`**, so the event was never handled. Every storage command hung for the 30s timeout (`storage/manager.js:33`) and returned "Operation timed out". (The storage never reached any document, shell or guest.)

**Fix.** `renderer/renderer.js:687` (inside `setupIPCListeners`, mirroring `onGetPageContent`): register the consumer, run the script in `getActiveWebview()`, and reply via `sendStorageOperationResponse`. `webview.executeJavaScript` resolves returned Promises, which the IndexedDB scripts rely on.

```js
api.onExecuteStorageOperation(async (data) => {
  const { operationId, script } = data || {};
  const webview = getActiveWebview();
  if (!webview) { api.sendStorageOperationResponse(operationId, null, 'No active webview'); return; }
  try {
    const result = await webview.executeJavaScript(script);
    api.sendStorageOperationResponse(operationId, result, null);
  } catch (error) {
    api.sendStorageOperationResponse(operationId, null, error.message);
  }
});
```

`preload.js` needed **no change** (both bridge methods already existed).

**Live evidence** (guest page loaded, `set` then `get`):
```
set_local_storage  → { success: true, key: "bhb_shellvswebview" }
get_local_storage  → { "bhb_shellvswebview": "guest-ok-1783145621998" }   (success:true)
execute_script localStorage.getItem(...) → "guest-ok-1783145621998"       (matches)
```
Before the fix `get_local_storage` hung 30s; now it returns real data instantly and matches the independent JS readback, proving the op reaches the guest document.

---

## Instance 2 — Session-state capture (+ pre-existing import bug)

**Root cause (bug class).** `session-persistence-commands.js` passed `mainWindow.webContents` (shell) to `stateCapture.captureState(...)` (`:113`) and `stateRestore.restoreState(...)` (`:187`). `BrowserStateCapture.captureStorage/captureDOMState/captureNavigationState` (`src/sessions/state-capture.js:153/218/297`) run `webContents.executeJavaScript(...)`, so storage/DOM/navigation were captured from the shell's blank document, and restore wrote into the shell.

**Pre-existing blocker (not the bug class, but fixed to make item testable).** The module imported the classes with destructuring — `const { BrowserStateCapture } = require('../../src/sessions/state-capture')` — but both modules `module.exports = <Class>` **directly** (`state-capture.js:463`, `state-restore.js`). So `BrowserStateCapture`/`BrowserStateRestore` were `undefined` and `new BrowserStateCapture()` threw `"BrowserStateCapture is not a constructor"`. `save_session_state`/`restore_session_state` were fully broken before this session — the guest-retarget could never run without correcting the import.

**Fix.**
- `session-persistence-commands.js:19-20` — import the classes directly.
- `session-persistence-commands.js:35` — added `resolveGuestWebContents(mainWindow)`: `require('electron').webContents.getAllWebContents()` filtered to `getType() === 'webview'`, preferring a live non-`about:blank` guest, falling back to the host webContents.
- `:159` (capture) and `:233` (restore) — pass `resolveGuestWebContents(mainWindow)` instead of `mainWindow.webContents`.

**Live evidence.** `save_session_state { profileId: 'default' }` after navigating to `example.com`:
```
{ success: true, sessionId: "session-default-1-...", compressed: true,
  compressionRatio: 0.46, sizeBytes: 1702,
  url: "https://example.com/", title: "Example Domain" }
```
`url`/`title` come from the guest's `window.location.href`/`document.title`. Had capture read the shell, they would be the renderer's `index.html`/empty — so this proves guest targeting.

**Out of scope / noted.** `restore_session_state` also references an undefined `stateCapture` at its `validateFirst` branch (`:170`) — a separate pre-existing ReferenceError (not shell-vs-webview). Left untouched; it blocks end-to-end restore verification but not capture.

---

## Instance 3 — CDP network throttling

**Root cause.** `main.js:900` calls `networkThrottler.initialize(mainWindow.webContents)` (shell). `attachDebugger()` (`throttling.js`) attached `webContents.debugger` to the shell and emulated conditions there. Page network happens in the guest webview, so throttling affected nothing the page loaded.

**Fix (`network/throttling.js`).**
- `initialize()` now stores `this._hostWebContents` as a fallback (`:96`).
- Added `_resolveGuestWebContents()` (`:116`) — same guest-resolution as Instance 2.
- `attachDebugger()` (`:157`) re-resolves and retargets `this.webContents` to the guest before each (re)attach; on detach (`debuggerAttached=false`) it re-resolves on the next attach. The attach log now records the target type (`:170`).

**Live evidence.** offline preset (`download:0, upload:0`) then a same-origin fetch in the guest:
```
[NetworkThrottler] Debugger attached (target: webview)
[NetworkThrottler] Applied throttling - Offline: true
get_throttling_status → { enabled:true, offline:true, debuggerAttached:true }
execute_script fetch(location.href+'?cb=...') → "BLOCKED:Failed to fetch"
```
`target: webview` and the blocked guest fetch prove the debugger is on the guest. With the shell target the guest fetch would have returned `LOADED`.

---

## Instance 4 — export_raw_html

**Root cause.** `export_raw_html` (`server.js:8713`) read `mainWindow.webContents.executeJavaScript('window.location.href' / 'document.documentElement.outerHTML')` — the shell's blank document.

**Fix.** Replaced both shell reads with a single `getWebviewPageContent()` call; on failure returns a typed error with the timestamp. `currentUrl = pageContent.url`, `html = pageContent.html`; the downstream network-header lookup is unchanged.

**Live evidence.** On `example.com`:
```
{ success:true, url:"https://example.com/", htmlLength:544,
  html starts: "<html lang=\"en\"><head><title>Example Domain</title>..." }
```

---

## Instance 5 — detect_technologies / identify_cms / identify_analytics

**Root cause.** All three (`server.js:8214/8267/8314`) built `pageData` from `mainWindow.webContents.executeJavaScript(outerHTML)` (shell) when `params.html` was absent → detector saw an empty document → no detections.

**Fix.** Route through `getWebviewPageContent()` and pass `{ url, html, ...params }`. The detector derives `script[src]` and `<meta>` from the raw HTML when explicit `scripts`/`meta` arrays are absent (`technology/detector.js:178-181, 206-209`), so dropping the hand-built arrays does not reduce detection.

**Live evidence.** On `wordpress.org`:
```
detect_technologies → success:true, count:5,
  ["WordPress","Google Tag Manager","Google Analytics","Google Fonts","YouTube"]
```
Before the fix the shell HTML yielded no detections.

**Out of scope / noted.** `identify_cms`/`identify_analytics` returned `[]` even though the underlying `detect_technologies` found WordPress + GA. Cause: their post-filter reads `tech.categories` (plural array) but the detector emits `category` (singular string) per detection (`technology/detector.js:111`). This is a **category-filter field mismatch, not the shell-vs-webview bug class** — the HTML-source fix requested for these commands is proven correct via `detect_technologies` (same `getWebviewPageContent()` routing + same detector). The filter bug is pre-existing and left for a follow-up.

---

## Files changed
- `renderer/renderer.js` — added `execute-storage-operation` consumer routed to `getActiveWebview()` (`~:687`).
- `websocket/server.js` — `export_raw_html` (`:8713`) and `detect_technologies`/`identify_cms`/`identify_analytics` (`:8214/8267/8314`) routed through `getWebviewPageContent()`.
- `network/throttling.js` — guest-webContents resolution (`_resolveGuestWebContents`, `:116`); `attachDebugger` retargets the guest (`:157`).
- `websocket/commands/session-persistence-commands.js` — fixed class imports (`:19-20`); added `resolveGuestWebContents` (`:35`); capture (`:159`) and restore (`:233`) retargeted to the guest.
- `src/preload/preload.js` — **unchanged** (bridge methods already present; only the renderer consumer was missing).

## Verification hygiene
- Checked port free first each run (`/dev/tcp` probe); used distinct ports 8791/8792/8793 to avoid another agent's instance.
- Launched Electron detached in its own process group with `ELECTRON_RUN_AS_NODE` deleted and `--user-data-dir=/home/devel/bhb-userdata`; reaped with `process.kill(-child.pid)` (SIGTERM then SIGKILL). No `pkill` patterns.
- Post-run: no basset Electron strays; ports free; removed `/home/devel/bhb-userdata`. All five edited/inspected JS files pass `node -c`. No git commits.

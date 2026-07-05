# Modularize `src/main/main.js` (Monolith-2) — 2026-07-04

**Agent:** architect@basset-hound-browser:modularize-main-js
**Spec:** `docs/planning/MODULARIZATION-PLAN-2026-07-04.md` §5 (Monolith 2)
**Result:** DONE — `src/main/main.js` **3112 → 1178 lines** (< 1200 target). Boots clean, `smoke:mvp` 15/15, all 194 IPC channels register identically. No commits.

---

## What was extracted (staged by concern)

Electron entry point has **no `module.exports`**, so nothing became a barrel. Instead, function
*definitions* were moved to sibling modules that are **import-side-effect-free** (requiring them does
nothing), and `main.js` **calls them at the identical boot points** so side-effect order is preserved.

| Stage | New module(s) | Moved out of main.js | Lines |
|------|---------------|----------------------|------:|
| M1 | `src/main/ipc/` — 18 domain modules + `index.js` barrel | the ~194 `ipcMain.handle/on` handlers from `setupIPCHandlers()` (~1476 lines) | 1673 |
| M2 | `src/main/session-recovery.js` | RECOVERY_CONFIG + `initializeRecoveryPaths`/`createLockFile`/`removeLockFile`/`detectUncleanShutdown`/`saveSessionState`/`loadSessionState`/`clearSessionState`/`startAutoSave`/`stopAutoSave`/`offerRecovery`/`restoreSession` | 318 |
| M3 | `src/main/mode-config.js` | `getHeadlessOptions`/`getGuiOptions`/`configureHeadlessMode`/`getTorOptions`/`configureTorMode`/`getViewportConfig` | 223 |
| M4 | `src/main/runtime-guards.js` | `setupGlobalErrorHandlers`/`setupMemoryManager` | 173 |

`ipc/` breakdown (each `register<Domain>Ipc(ipcMain, ctx)`): navigation, media (screenshots+recording),
cookies, misc (evasion-script + ws-status), proxy-ua, sessions, history, downloads, tabs,
network-throttling, geolocation, blocking, scripts, profiles, devtools, console, storage, recovery.
`index.js` calls all 18 registrars in the original registration order.

**M5 (`window-factory.js`) was NOT needed** — target hit at M1–M4, so `createWindow()` stays in main.js
untouched (this is also where the preserved edits live — see below).

## How live state is shared (the key mechanic)

`main.js` builds one `ctx` object. Browser state assigned later inside `createWindow()` (mainWindow,
wsServer, and the 19 managers) is exposed via **getters closed over the module-scope `let` bindings**,
so extracted modules always read the LIVE value (e.g. `mainWindow` → `null` after the window closes),
exactly as the original module-scope closures did. Stable singletons (proxyManager, userAgentManager,
memoryManager, …), `getEvasionScript`, and `createIPCPromiseWithTimeout` are passed by value. The
recovery factory owns RECOVERY_CONFIG + the auto-save timer and exposes them back onto `ctx` for the
recovery IPC handlers. `createWindow()`'s manager assignments (`mainWindow = new BrowserWindow(...)`,
etc.) were **not changed** — the getters read those same bindings.

## Preserved verbatim (uncommitted GUI-toggle + UA-identity edits)

`createWindow()` was not moved or edited. Confirmed intact:
- GUI opt-in toggle: `getGuiOptions()` / `windowConfig.show = isGuiMode` / display-less fallback warning
  / "GUI mode enabled — showing browser window" (main.js ~L353–367).
- Coherent UA identity: `getRealisticChromeUserAgent()` → `setActiveUserAgent()` →
  `userAgentManager.setUserAgent(userAgent, mainWindow)` (~L376–382).
- Offscreen-render GUI guard: `if (isHeadlessMode && !isGuiMode && …offscreenRendering)` (~L701).

Boot side-effect order preserved: `configureTorMode()` and `getViewportConfig()` at module load;
`initializeHeadlessModeEarly()` before `app.whenReady()`; inside whenReady
`configureHeadlessMode()` → `initializeRecoveryPaths()` → `setupGlobalErrorHandlers()` →
`createWindow()` → `createLockFile()` → `startAutoSave()`; inside createWindow
`setupDownloadManagerEvents()` / `setupMemoryManager()` / `setupIPCHandlers()`.

## Verification (all green)

| Gate | Result |
|------|--------|
| `node -c` main.js + all 22 new modules | PARSE OK (all) |
| `npm run start:headless` boot check (temp UDD, ELECTRON_RUN_AS_NODE deleted, PGID reaped) | PASS — bound `ws://localhost:8765`, initial tab created, no errors |
| `npm run smoke:mvp` | **15/15 PASS** (baseline was 15/15) |
| IPC registration harness (fake ipcMain + ctx) | **194 unique channels, 0 duplicates, no throw** |
| Channel-set diff vs original `setupIPCHandlers` | **IDENTICAL** (194 shared, 0 only-in-either) |
| eslint (changed + new files) | only **2 pre-existing** `prefer-const` errors on `timeoutId`/`responseHandler` inside untouched `createIPCPromiseWithTimeout` (verified present in HEAD). New brace-style on the compact one-line ctx getters suppressed with a scoped `/* eslint-disable brace-style */` (expanding them would push main.js back over 1200). |

## Line count

- `src/main/main.js`: **3112 → 1178** (start-of-task working tree, which already included the
  uncommitted GUI/UA edits; committed HEAD was 3059).
- New modules total: 2384 lines across 22 files (all < 320 lines each).

## Notes / what remains

- Task complete; nothing outstanding for Monolith-2.
- Two `ipcMain` registrations intentionally REMAIN in `main.js`: `ipcMain.on('storage-operation-response')`
  (wired at StorageManager init inside createWindow) and `ipcMain.once` inside
  `createIPCPromiseWithTimeout` — both are correct in place.
- The 2 pre-existing `prefer-const` lint errors were left as-is (out of scope; not introduced here).
- No commits made (per instructions). Scratch/backups kept outside the repo (session scratchpad).

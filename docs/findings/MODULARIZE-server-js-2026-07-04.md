# Modularization Execution Report — `websocket/server.js`

**Agent:** architect@basset-hound-browser:modularize-server-js
**Date:** 2026-07-04
**Spec:** `docs/planning/MODULARIZATION-PLAN-2026-07-04.md` §4 (Monolith 1)
**Status:** ✅ COMPLETE — server.js **12,096 → 1,110 lines** (< 1200 cap), all gates green.

---

## Result summary

| Metric | Before | After |
|---|---:|---:|
| `websocket/server.js` lines | 12,096 | **1,110** |
| `module.exports` | `WebSocketServer` | `WebSocketServer` (unchanged) |
| Unique commands registered | 904 | **904** |
| Total registrations (incl. dup last-writer-wins) | 934 | **934** |
| Registration order (byte-diff vs baseline) | — | **identical** |

**Final integration gates (all post-final-change):**
- `node -c websocket/server.js` → OK; every new module `node -c` → OK.
- require resolves, `module.exports.name === 'WebSocketServer'`, all key prototype methods present.
- `npm run start:headless` → binds `ws://127.0.0.1:8765` cleanly.
- `npm run smoke:mvp` → **15/15 passed**.
- `python3 mcp/verify_e2e.py` → **exit 0**.

> Note on the require gate: plain `node -e "require('./websocket/server.js')"` fails on **node 18** because a transitive `cheerio`→`undici` dep references a `File` global that only exists ≥ node 20. This is **pre-existing** (the original file fails identically). Gate was run with `globalThis.File = require('node:buffer').File;` shim; under real Electron boot the global exists, so `start:headless` is the authoritative resolution check.

---

## What was extracted

### S0 — shared module scope + support classes → `websocket/core/`
The linchpin: helpers that command closures reference were made importable first. `server.js` re-`require`s them at top, so all existing references keep resolving.

| New file | Lines | Contents |
|---|---:|---|
| `core/url-guards.js` | 229 | `isOnionUrl`, `isTorModeEnabled`, `checkOnionWithoutTor`, `_ssrfEnvFlag`, `_isForbiddenIPv4`, `_ipv6ToBytes`, `_isForbiddenIPv6`, `validateNavigationUrl` |
| `core/timing.js` | 168 | `IPC_DEFAULT_TIMEOUT`, `ADAPTIVE_TIMEOUT_CONFIG`, `calculateAdaptiveTimeout`, `ipcWithTimeout` |
| `core/retry.js` | 149 | `ERROR_RECOVERY_CONFIG`, `isRetryableError`, `isRetryableCommand`, `calculateRetryDelay`, `sleep`, `generateRecoverySuggestion` |
| `core/state-management.js` | 445 | `StateSnapshot`, `StateRollbackManager`, `StatefulCommandHandler` |

### Linchpin barrel — `core/handler-deps.js` (176)
Auto-generated barrel re-exporting **103** module-scope symbols (every top-of-file `require` **except** `./commands/*` register fns, plus the S0 helpers/classes). Every extracted command module + mixin destructures from it, so relocated code resolves module scope identically. Singletons stay the same instance (Node module cache).

### Handler clusters → `websocket/commands/core-*.js`
The 489 inline `this.commandHandlers.X = async …` handlers were peeled out of `setupCommandHandlers()` into `registerCore…(server)` modules, each replaced in-place by a `require()` + call. **`this` → `server`** was rewritten via **acorn AST** (only real `ThisExpression` nodes — never `this` inside template/page-injected strings), and relative `require()` paths were depth-adjusted (`websocket/` → `websocket/commands/`).

| File | Handlers | Range (first..last) | Lines |
|---|---:|---|---:|
| `commands/core-tor-commands.js` | 33 | `tor_start .. tor_get_proxy_config` | 596 |
| `commands/core-cmds-01.js` | 54 | `navigate .. close_tab` | 998 |
| `commands/core-cmds-02.js` | 56 | `switch_tab .. force_terminate_connection` | 1010 |
| `commands/core-cmds-03.js` | 8 | `new_tor_identity .. get_tor_mode` | 151 |
| `commands/core-cmds-04.js` | 56 | `set_proxy_chain .. mouse_drag` | 1001 |
| `commands/core-cmds-05.js` | 55 | `mouse_hover .. inspect_element` | 1008 |
| `commands/core-cmds-06.js` | 53 | `get_element_tree .. extract_images` | 995 |
| `commands/core-cmds-07.js` | 47 | `extract_scripts .. step_replay` | 1003 |
| `commands/core-cmds-08.js` | 67 | `skip_replay_action .. unload_plugin` | 994 |
| `commands/core-cmds-09.js` | 12 | `reload_plugin .. get_plugin_hooks` | 239 |
| `commands/core-cmds-10.js` | 23 | `add_monitor .. clear_all_monitors` | 38 |
| `commands/core-cmds-11.js` | 25 | `get_proxy_reputation .. get_rollback_versions` | 684 |

**tor special-case:** the 33 `tor_*` handlers shared a method-scope closure (`let advancedTorManager` / `getAdvancedTorManager`). That closure was moved *with* them into `core-tor-commands.js` (the **only** handler↔method-local coupling in the file), so the lazy-load behavior is preserved.

The ~35 pre-existing modular `register*Commands(this)` calls (image, screenshot, cookie, forensic, recording, v12-9-0, …) were **left untouched and in place**; extraction only relocated the inline handlers around them. Because every phase replaced a handler run *in situ* and preserved ascending order, the **27 duplicate-registered names** (e.g. `start_recording`, `add_block_rule`, `get_memory_stats`) keep exact last-writer-wins semantics — verified by a byte-identical registration-order diff after every step.

### S42 — core-class methods → prototype mixins in `websocket/core/`
Attached via `Object.assign(WebSocketServer.prototype, require('./core/<x>'))` just before `module.exports`. Methods keep `this` (they *are* prototype methods) so **no `this`-rewrite** was needed; they pull module scope from `handler-deps`.

| Mixin | Lines | Methods |
|---|---:|---|
| `core/transport.js` | 655 | port find/ensure, HTTP composite handler, non-SSL + WS server start, SSL load, `isSslEnabled`/`getProtocol`/`getConnectionUrl` |
| `core/dispatch.js` | 412 | `handleCommand`, `executeWith(out)Retry`, `_sendResponse`, `_standardizeErrorResponse`, `_getRecoveryHint`, `setupUpdateProgressNotifications`, auth (`validateToken`/`handleAuthenticate`/`setAuthToken`), `_initializePhase3Optimizations`, `_setupStateRollbackListeners`, `getWebviewPageContent` |
| `core/ratelimit.js` | 215 | rate-limit data init/check/status + concurrent-op tracking + `setRateLimitEnabled` |
| `core/heartbeat.js` | 178 | heartbeat start/stop, zombie-connection sweep, queue processor start/stop/`_processQueuedCommand` |
| `core/startup.js` | 120 | `start`, `broadcast`, `getStatus`, `close` |

`server.js` now retains: top requires + the S0/core `require`s, the `WebSocketServer` class (constructor + `setSessionManager`/`setTabManager` + thin `setupCommandHandlers()` = 47 `register…(this)` calls), the 5 `Object.assign` mixin lines, and `module.exports = WebSocketServer`.

---

## Method / safety notes

- **AST, not regex.** `this`→`server` used `acorn` `ThisExpression` node ranges, so `this` appearing inside 4 page-injected `(function(){…})` template strings was never touched.
- **Order proof.** A harness enumerates every registration (with a tolerant mock `this`) and writes the full order list; after **every** phase it was diffed byte-for-byte against the pre-split baseline (`904` unique / `934` total, order identical) — the gate that guards last-writer-wins.
- **All 22 new files < 1200 lines.** Largest: `transport.js` 655, `core-cmds-02.js` 1010.
- **eslint:** the new files carry **28 errors (26 `curly`)**, but these are **not new** — the original `server.js` had the identical 28 (verified via `eslint --no-ignore` on a backup). The SSRF guards' brace-less `if (…) return true;` lines were relocated verbatim (pure relocation, behavior-preserving). Not auto-fixed to keep the extraction a strict relocation; trivially `eslint --fix`-able later if desired.

## Deviations from the plan (cosmetic)
- Handler modules are named `core-cmds-NN.js` (sequential, budget-chunked ≈1000 lines each) + `core-tor-commands.js`, rather than one file per named domain. Order and the < 1200 cap are the load-bearing constraints; both hold. Each file's header comment records its first..last handler for traceability.
- Mixin file `core/ratelimit.js` (plan wrote `rate-limit.js`); `core/dispatch.js`/`startup.js` consolidate the plan's auth/queue/response groupings.

## Nothing outside the work zone was modified
Only `websocket/server.js`, new `websocket/core/*.js`, and new `websocket/commands/core-*.js` were written. No existing `websocket/commands/*` file was changed. No commits.

---
title: "Obscura Deep-Dive: obscura-cdp (Chrome DevTools Protocol Server)"
date: 2026-07-03
researcher: Claude (automated repo-research agent)
status: Complete
category: architecture / reverse-engineering
---

# obscura-cdp — Chrome DevTools Protocol implementation

> Source analyzed on disk at `/home/devel/tmp/obscura` (Apache-2.0, `h4ckf0r0day/obscura`).
> All file paths below are relative to the repo root unless noted.

## 1. Purpose and one-paragraph summary

`obscura-cdp` is the crate that lets Puppeteer, Playwright (`connectOverCDP`), `headless_chrome`,
`chromiumoxide`, and DOM-agent frameworks like browser-use drive Obscura *as if it were a remote
headless Chrome*. It implements a **compatibility subset** of the Chrome DevTools Protocol (CDP)
version 1.3 over WebSocket, plus the HTTP `/json/*` discovery endpoints Chrome exposes. It is
explicitly **not** a real browser: there is no layout, paint, or rendering engine, so whole families
of methods (`Page.captureScreenshot`, `Page.printToPDF`, real box geometry) are deliberately absent
or synthesized. The crate is a thin protocol/translation layer: it parses CDP JSON frames, routes
them by domain to per-domain handlers, calls down into `obscura-browser`/`obscura-js`/`obscura-dom`,
and emits the CDP event stream (`Network.requestWillBeSent`, `Page.frameNavigated`,
`Page.lifecycleEvent`, `Runtime.executionContextCreated`, …) that automation clients wait on.

Per the architecture overview (`docs/Architecture-overview.md:5-6`), it is described as the
"Chrome DevTools Protocol server. WebSocket, dispatch, domain handlers."

The crate is consumed only by `obscura-cli serve` (`crates/obscura-cli/src/main.rs:356` and
`:400`). Notably, the **MCP server does not use CDP at all** — `crates/obscura-mcp/Cargo.toml`
depends on `obscura-browser`/`obscura-dom`/`obscura-net` but *not* `obscura-cdp`, so the CDP surface
is exclusively for external automation clients, not Obscura's own agent tooling.

## 2. Module map (files and responsibilities)

| Path | Lines | Responsibility |
|---|---|---|
| `crates/obscura-cdp/src/lib.rs` | 11 | Crate root; re-exports the `start*` server entry points |
| `crates/obscura-cdp/src/server.rs` | 996 | TCP/WebSocket server, HTTP control plane, single-threaded CDP processor loop, navigation spawning, fetch-interception plumbing |
| `crates/obscura-cdp/src/dispatch.rs` | 567 | `CdpContext` (session/page state) + `dispatch()` method router, V8-lock gating, per-command watchdog, `sendMessageToTarget` unwrapping, binding-call draining |
| `crates/obscura-cdp/src/types.rs` | 74 | Wire types: `CdpRequest`, `CdpResponse`, `CdpError`, `CdpEvent` |
| `crates/obscura-cdp/src/util.rs` | 62 | `url_is_file_scheme()` — the `file://` security gate helper |
| `crates/obscura-cdp/src/cookie_params.rs` | 162 | CDP cookie param parsing shared by `Network.*` and `Storage.*` |
| `crates/obscura-cdp/src/domains/mod.rs` | 12 | Declares the 11 domain sub-modules |
| `crates/obscura-cdp/src/domains/target.rs` | 309 | `Target.*` |
| `crates/obscura-cdp/src/domains/browser.rs` | 36 | `Browser.*` |
| `crates/obscura-cdp/src/domains/page.rs` | 684 | `Page.*` + the shared `emit_navigation_events()` machine |
| `crates/obscura-cdp/src/domains/dom.rs` | 345 | `DOM.*` |
| `crates/obscura-cdp/src/domains/domsnapshot.rs` | 416 | `DOMSnapshot.captureSnapshot` (synthesized, layout-free) |
| `crates/obscura-cdp/src/domains/runtime.rs` | 530 | `Runtime.*` (evaluate, callFunctionOn, bindings, getProperties) |
| `crates/obscura-cdp/src/domains/network.rs` | 430 | `Network.*` (cookies, headers, blocked URLs, response bodies) |
| `crates/obscura-cdp/src/domains/fetch.rs` | 186 | `Fetch.*` interception (continue/fulfill/fail) + `FetchInterceptState` |
| `crates/obscura-cdp/src/domains/input.rs` | 220 | `Input.dispatchMouseEvent` / `dispatchKeyEvent` synthesized via JS |
| `crates/obscura-cdp/src/domains/storage.rs` | 38 | `Storage.{get,set,delete}Cookies` (default-context only) |
| `crates/obscura-cdp/src/domains/accessibility.rs` | 433 | `Accessibility.getFullAXTree` built from the DOM tree |
| `crates/obscura-cdp/src/domains/lp.rs` | 21 | Non-standard `LP.getMarkdown` domain |

Integration tests live under `crates/obscura-cdp/tests/`: `cdp_click_submit_parity.rs`,
`concurrent_navigations.rs`, `concurrent_navigations_with_fetch.rs`, `control_plane_unblocked.rs`.

Dependencies (`crates/obscura-cdp/Cargo.toml:6-20`): `obscura-dom`, `obscura-browser`, `obscura-js`,
`obscura-net`, `tokio`, `tokio-tungstenite`, `serde`/`serde_json`, `url`, `uuid`, `tracing`,
`thiserror`, `anyhow`, `futures-util`. There is no CDP codegen dependency — everything is hand-rolled
`serde_json::Value` shaping.

## 3. Wire protocol data structures

Defined in `src/types.rs`:

- `CdpRequest { id: u64, method: String, params: Value, session_id: Option<String> }`
  (`sessionId` renamed via serde; `params` defaults to `null`) — `types.rs:3-11`.
- `CdpResponse { id, result: Option<Value>, error: Option<CdpError>, session_id }` with
  `success()`/`error()` constructors — `types.rs:13-42`.
- `CdpError { code: i64, message: String }` — `types.rs:44-48`.
- `CdpEvent { method, params, session_id }` with `new()` (no session) and `with_session()`
  constructors — `types.rs:50-74`.

Errors are returned with JSON-RPC-style codes: `-32601` for unknown/failed methods
(`dispatch.rs:375`), `-32602` invalid params, `-32700` parse error
(`dispatch.rs:433,445`), `-32000` server/navigation error (`server.rs:721`, `page.rs`/`process_with_interception`).

## 4. The WebSocket server and HTTP control plane (`server.rs`)

### 4.1 Entry points

`lib.rs:8-11` re-exports a ladder of `start*` builders that all funnel into
`start_with_full_serve_options()` (`server.rs:110-232`), the "full serve" entry that threads
`port, host, proxy, stealth, user_agent, allow_file_access, storage_dir, allow_private_network`.
`obscura serve` calls it at `crates/obscura-cli/src/main.rs:356`.

### 4.2 Two-thread design (issue #62)

The server splits work across a dedicated OS thread and a tokio `LocalSet`:

- A **blocking `std::net::TcpListener`** runs on a named accept thread `obscura-cdp-accept`
  (`server.rs:157-175`). It peeks the first bytes of each connection (`accept_dispatch`,
  `server.rs:244-290`): `GET ` prefixes that hit `/json/version`, `/json/list` (or `/json`), or
  `/json/protocol` are served **synchronously with blocking I/O** (`handle_http_json_blocking`,
  `server.rs:293-334`); everything else is treated as a WebSocket upgrade and handed to the LocalSet
  through a **bounded** channel (`MAX_PENDING_WS_HANDOFFS = 128`, `server.rs:29`).
- The reason (documented at `server.rs:124-131`): the HTTP control plane must stay reachable even
  while a synchronous V8 `while(true)` pins the LocalSet thread. `tests/control_plane_unblocked.rs`
  is the regression guarding this (a 5s JS loop must not block `/json/version` for >3s).

`handle_http_json_blocking` fakes a Chrome identity: `Browser: "Chrome/145.0.0.0"`,
`Protocol-Version: "1.3"`, `webSocketDebuggerUrl: ws://127.0.0.1:{port}/devtools/browser`
(`server.rs:304-311`); `/json/list` advertises a single synthetic `page-1` target
(`server.rs:312-320`).

### 4.3 The single CDP processor task

Inside the LocalSet, one `cdp_processor` task (`server.rs:336-458`) owns the entire `CdpContext`
and processes all messages sequentially. It:

- Constructs the context via `CdpContext::new_full(...)` (`server.rs:347-354`).
- Wires an `intercept_tx`/`intercept_rx` channel for `Fetch` interception
  (`server.rs:355-357`).
- Subscribes to **SIGTERM and Ctrl-C** (`server.rs:375-395`) so `docker stop`/`kill` flush cookies:
  the single exit point calls `ctx.default_context.save_cookies()` (`server.rs:457`, issue #333).
- Maintains a **deferred message queue** (`VecDeque<ServerMessage>`, `server.rs:366-367`) that is
  drained before pulling new messages off the wire (`server.rs:402`).

Each connection gets a `handle_connection_ws` task (`server.rs:919-996`) that splits the WS stream,
registers a `reply_tx`, and forwards frames. Two client-facing performance tweaks: `set_nodelay(true)`
(Nagle off, ~90ms saved on `newPage`, ~30ms on `goto`, `server.rs:204-213`) and
`write_buffer_size = 0` on the tungstenite config (`server.rs:928-932`).

### 4.4 Fast-path bypass (`fast_path_response`, `server.rs:864-909`)

Before enqueuing a frame to the single processor, `handle_connection_ws` checks
`fast_path_response()`. A whitelist of cheap enable/no-op methods (`Network.enable`, `Page.enable`,
`Runtime.runIfWaitingForDebugger`, `Emulation.setDeviceMetricsOverride`, `Storage.enable`,
`Target.setAutoAttach`, `Browser.getVersion`, …) are answered **directly on the connection task**,
bypassing the serialized queue entirely (`server.rs:867-900`). The load-bearing case is documented at
`server.rs:891-899`: Puppeteer's first CDP call on connect is `Target.getBrowserContexts`; if a long
`Page.navigate` holds the single processor, that call would starve and trip `protocolTimeout`. The
fast path returns `{ "browserContextIds": ["default"] }` immediately. `Browser.close` is also
short-circuited on the connection task, but through a **separate branch** in `handle_connection_ws`
(`if text.contains("\"Browser.close\"")` → send success `{}` + `break`, `server.rs:967-975`) — it is
**not** a `fast_path_response` arm.

### 4.5 Navigation spawning and message deferral (`process_with_interception`, `server.rs:504-785`)

Navigation is special-cased. The processor decides a frame is a navigation with the brittle heuristic
`cdp_msg.text.contains("Page.navigate")` (`server.rs:435`) and routes it to
`process_with_interception`. That function:

1. Removes the target `Page` from `ctx.pages` and `suspend_js()`'es every other page
   (`server.rs:537-559`) to preserve the single-isolate invariant.
2. Spawns the actual navigation onto the LocalSet via `spawn_local`, acquiring the global V8 lock
   inside the task (`server.rs:579-597`).
3. While the nav task runs, a `select!` loop (`server.rs:622-737`) multiplexes: nav completion,
   intercepted requests (emit `Network.requestWillBeSent` + `Fetch.requestPaused`,
   `server.rs:637-687`), and *foreign* CDP messages. Foreign messages that only resolve a paused
   fetch (`Fetch.continueRequest`/`fulfillRequest`/`failRequest`) are handled inline; **all other
   foreign messages are pushed onto the deferred queue** (`server.rs:715-731`) because routing them
   through `dispatch` mid-nav could `suspend_js` a page whose isolate is still entered and abort the
   process. The queue is bounded at `MAX_DEFERRED_MESSAGES = 256` (`server.rs:19`); overflow returns
   `-32000 "Server busy: navigation in progress"` (`server.rs:716-727`).
4. After nav completes, the page is pushed back and `emit_navigation_events()` (in `page.rs`) drains
   the full event stream to the client (`server.rs:769-784`).

`process_cdp_message` (the non-nav path, `server.rs:787-835`) dispatches, then **emits pending events
before the command response** (`server.rs:810-818`) — see §7 for why ordering matters — and finally
checks for a JS-triggered navigation (`page.take_pending_navigation()`) to re-drive as a synthetic
`Page.navigate` (`server.rs:820-834`).

There is a hand-rolled `decode_base64()` (`server.rs:837-862`) used for `Fetch.fulfillRequest` bodies
— no base64 crate dependency.

## 5. The dispatcher and `CdpContext` (`dispatch.rs`)

### 5.1 `CdpContext` — the whole server's state (`dispatch.rs:12-48`)

```
pub struct CdpContext {
    pub pages: Vec<Page>,                       // all live pages
    pub sessions: HashMap<String, String>,      // session_id -> page_id
    pub pending_events: Vec<CdpEvent>,          // drained to the client after each dispatch
    pub default_context: Arc<BrowserContext>,   // the single browser context (id "default")
    page_counter: u32,
    pub preload_scripts: Vec<(String, String)>, // addScriptToEvaluateOnNewDocument + addBinding shims
    pub preload_counter: u32,
    pub isolated_worlds: Vec<String>,           // Page.createIsolatedWorld names to re-emit post-nav
    pub valid_context_ids: HashSet<i64>,        // execution contexts the server has advertised
    pub next_isolated_context_id: i64,          // monotonic counter (starts at 100)
    pub fetch_intercept: FetchInterceptState,
    pub intercept_tx: Option<UnboundedSender<InterceptedRequest>>,
}
```

Key behaviors:
- Constructor ladder `new` → `new_with_*` → `new_full` → `_new_inner` builds a single
  `BrowserContext::with_storage_and_network(...)` and pre-seeds `valid_context_ids` with `{1, 2}`
  (the default-frame contexts advertised by `Runtime.enable` and post-navigation re-emission,
  `dispatch.rs:127-129`).
- `create_page()` mints `page-{n}`, `navigate_blank()`s it, and pushes it (`dispatch.rs:156-163`).
- `get_session_page_mut()` (`dispatch.rs:185-206`) is the **single-isolate scheduler**: if the target
  page has no live JS, it `suspend_js()` on the first other page that does and `resume_js()` on the
  target. This is why the dispatcher must never let two pages' V8 work interleave.
- `next_isolated_context()` (`dispatch.rs:149-154`) hands out fresh, monotonically-increasing
  execution-context ids (issue #192) and registers them in `valid_context_ids`.

### 5.2 `dispatch()` control flow (`dispatch.rs:251-378`)

1. **`Target.sendMessageToTarget` unwrap** (`dispatch.rs:256-258`, impl `dispatch.rs:424-479`):
   `headless_chrome` and older Puppeteer wrap every call inside this envelope. Obscura parses the
   inner message, overrides its session, recurses (`Box::pin` to dodge the async-recursion limit),
   and re-emits the inner response as a legacy `Target.receivedMessageFromTarget` event.
2. **Global V8 lock gating** (`dispatch.rs:289-293`): unless the method is in `is_v8_free_method()`
   (`dispatch.rs:216-249`), the dispatcher holds `obscura_js::v8_lock::global().lock().await` across
   the *entire* handler. The rationale (issue #19) is documented at length at `dispatch.rs:260-288`:
   all per-page `JsRuntime`s share one OS thread; interleaving two isolates across an `.await` trips
   V8's `heap->isolate() == Isolate::TryGetCurrent()` invariant and `abort(3)`s the process. The lock
   converts the abort into latency; the `is_v8_free_method` allowlist (Target.*, Browser.*, most
   Page setup calls, Network cookie ops, Fetch resolutions, Storage.*) lets audited non-V8 methods
   skip the lock so Puppeteer's `newPage()` setup chain doesn't serialize behind a sibling page's nav.
3. **Per-command watchdog** (`dispatch.rs:304-314`): reads `OBSCURA_CDP_COMMAND_TIMEOUT_MS`
   (default 60_000; `0` disables) and arms `obscura_js::cdp_watchdog::arm(isolate_handle, budget)` so
   a runaway handler can't hold the V8 lock forever. If it fired, the isolate is terminated and the
   flag cleared before the next command (`dispatch.rs:356-367`).
4. **Domain routing** (`dispatch.rs:316-351`): splits `method` on `.`, matches the domain, and calls
   `domains::<domain>::handle(...)`. Unmapped-but-tolerated domains (`Emulation`, `Log`,
   `Performance`, `Security`, `CSS`, `ServiceWorker`, `Inspector`, `Debugger`, `Profiler`,
   `HeapProfiler`, `Overlay`, `Audits`) return `{}` unconditionally (`dispatch.rs:344-349`) — the
   comment notes Puppeteer's `FrameManager.initialize` calls `Audits.enable` on connect and refusing
   it breaks `puppeteer.connect()`. Anything else is `Err("Unknown domain: …")`.
5. **`drain_binding_calls()`** (`dispatch.rs:369`, impl `:386-422`): after every dispatch, drains each
   page's queue of `Runtime.addBinding` shim invocations (filled by `op_binding_called`) into
   `Runtime.bindingCalled` events with a hardcoded `executionContextId: 2`.

## 6. Complete domain / method enumeration

Below is the **exhaustive** method surface actually implemented, read directly from each handler's
`match` arms. "no-op `{}`" means the arm exists but returns an empty object; "unsupported error"
means it returns a descriptive `Err`.

### Target (`domains/target.rs:7-249`)
`setDiscoverTargets`, `getTargets`, `createTarget` (with `file://` gate), `attachToBrowserTarget`
(Playwright connect), `attachToTarget`, `closeTarget`, `setAutoAttach` (no-op), `detachFromTarget`
(no-op, issue #340), `activateTarget` (no-op), `getBrowserContexts`, `createBrowserContext`
(clears cookie jar, returns `"default"`), `disposeBrowserContext` (clears cookie jar),
`getTargetInfo`. Plus `sendMessageToTarget` handled in the dispatcher (`dispatch.rs:256`).

### Browser (`domains/browser.rs:3-36`)
`getVersion`, `close` (no-op `{}`), `getWindowForTarget` (fixed 1280×720), `setDownloadBehavior`
(no-op), `getWindowBounds`, `setWindowBounds` (no-op).

### Page (`domains/page.rs:280-522`)
`enable`, `navigate`, `reload`, `getFrameTree`, `createIsolatedWorld`, `setLifecycleEventsEnabled`
(no-op), `addScriptToEvaluateOnNewDocument`, `removeScriptToEvaluateOnNewDocument`,
`setInterceptFileChooserDialog` (no-op), `setDownloadBehavior` (no-op), `getLayoutMetrics`
(synthetic 1280×720 + `scrollHeight`), `getNavigationHistory`, `navigateToHistoryEntry`,
`resetNavigationHistory`, **`printToPDF` → unsupported error** (`page.rs:496-509`),
**`captureScreenshot`/`captureSnapshot` → unsupported error** (`page.rs:510-520`).

### DOM (`domains/dom.rs:34-247`)
`enable`, `getDocument`, `querySelector`, `querySelectorAll`, `getOuterHTML`, `describeNode`,
`resolveNode`, `setAttributeValue` (no-op), `removeNode` (no-op), `focus`, `getBoxModel`
(synthetic quad from `getBoundingClientRect`), `getContentQuads` (synthetic).

### DOMSnapshot (`domains/domsnapshot.rs:41-60`)
`enable`/`disable` (no-op), `captureSnapshot` (synthesized layout — see §8), everything else a
permissive no-op `{}`.

### Runtime (`domains/runtime.rs:48-357`)
`enable`, `evaluate` (with context-id validation + CDP `timeout`, default 30s), `callFunctionOn`,
`getProperties` (walks `__obscura_objects`, tags nodes `subtype:"node"` for Puppeteer's
ElementHandle path), `releaseObject`, `releaseObjectGroup`, `addBinding` (installs a JS shim →
`op_binding_called`), `removeBinding`, `runIfWaitingForDebugger` (no-op),
`getExceptionDetails` (returns null), `discardConsoleEntries` (no-op).

### Network (`domains/network.rs:27-141`)
`enable` (no-op), `disable` (clears stored response bodies), `setExtraHTTPHeaders`,
`setUserAgentOverride`, `getCookies`/`getAllCookies`, `setCookie`, `setCookies`, `deleteCookies`,
`clearBrowserCookies`, `setCacheDisabled` (no-op), `setRequestInterception` (no-op),
`setBlockedURLs`, `getResponseBody`.

### Fetch (`domains/fetch.rs:56-186`)
`enable` (arms interception with URL patterns), `disable`, `continueRequest`, `fulfillRequest`,
`failRequest`, **`getResponseBody` → returns empty `{ body:"", base64Encoded:false }`**
(`fetch.rs:181-183`, a stub).

### Input (`domains/input.rs:58-219`)
`dispatchMouseEvent` (synthesizes `mousedown`/`click`/`mouseup` MouseEvents + link/form/checkbox
handling via JS), `dispatchKeyEvent` (`keyDown`/`rawKeyDown`/`keyUp`/`char`, with text insertion,
Enter=submit-or-newline, Backspace), `dispatchTouchEvent` (no-op), `setIgnoreInputEvents` (no-op).

### Storage (`domains/storage.rs:7-38`)
`getCookies`, `setCookies`, `deleteCookies` (all against the **default context only**, ignoring
session), everything else a permissive no-op `{}`.

### Accessibility (`domains/accessibility.rs:26-45`)
`enable` (no-op), `getFullAXTree` (built from the DOM tree via `map_role`/`compute_name`/
`compute_properties`), everything else a permissive no-op `{}`.

### LP (`domains/lp.rs:6-21`) — non-standard Obscura extension
`getMarkdown` — runs the bundled `HTML_TO_MARKDOWN_JS` and returns `{ markdown }`. Not a real CDP
domain; a custom "language processing"/extraction namespace.

### Tolerated-but-unimplemented domains (`dispatch.rs:344-349`)
`Emulation`, `Log`, `Performance`, `Security`, `CSS`, `ServiceWorker`, `Inspector`, `Debugger`,
`Profiler`, `HeapProfiler`, `Overlay`, `Audits` — every method returns `{}`.

## 7. The navigation event machine (`page.rs::emit_navigation_events`, `page.rs:12-177`)

This is the single most compatibility-critical piece of the crate. Both the in-process `do_navigate`
path (`page.rs:215-278`) and the spawned `process_with_interception` path call it, so the ordering
fixes live in one place. It reproduces the *exact* Chromium event ordering and identifiers that
Puppeteer/Playwright key off:

- The main document's request id is aliased to the navigation `loaderId` so
  `requestId === loaderId && type === "Document"` lets `page.goto()` resolve to a `Response`
  (issue #189, `page.rs:29-39`). The body is aliased under `loader_id` so
  `Network.getResponseBody(loaderId)` resolves (issue #340, `page.rs:44-62`).
- `Network.requestWillBeSent` for the main document is emitted **before** `Page.frameNavigated`
  (issue #190, `page.rs:64-74`).
- Phase 1 stream (`page.rs:76-97`): `Page.lifecycleEvent(init)` → `Runtime.executionContextsCleared`
  → `Page.frameNavigated` (with the real `content-type` mime, `page.rs:51-56`) →
  `Runtime.executionContextCreated` (id `2`, default) → one `executionContextCreated` per registered
  isolated world (fresh monotonic id each time, issue #192) → `Page.lifecycleEvent(commit)`.
- If a default utility world was never registered, it synthesizes
  `"__puppeteer_utility_world__24.40.0"` (`page.rs:82-84`).
- Per-resource events (`page.rs:120-139`): `Network.requestWillBeSent` (non-main),
  `Network.responseReceived`, `Network.loadingFinished`.
- Phase 3 (`page.rs:141-152`): `DOMContentLoaded` → `domContentEventFired` → `load` →
  `loadEventFired` → conditional `networkIdle` → `frameStoppedLoading`.
- Finally a **browser-level** `Target.targetInfoChanged` (no sessionId) carrying the post-nav
  url/title, because strict clients (browser-use, Puppeteer/Playwright `page.url()`) only refresh
  cached TargetInfo on this event (`page.rs:154-176`).

Why event-before-response ordering matters is spelled out at `server.rs:804-809`: Playwright awaits
the command response and immediately reads state wired up by the side-effect events; if the response
lands first it errors with "Cannot read properties of undefined".

`parse_wait_until()` (`page.rs:181-213`) maps the client's `waitUntil` to `WaitUntil` and, critically,
**defaults to `DomContentLoaded`** (not `Load`) because Obscura batches its event emission at the end
of navigation, and defaulting to `Load` pushed JS-heavy sites (github, reddit) past client timeouts.

## 8. Layout-free synthesis (a defining design decision)

Because there is no layout/paint engine, the crate *fabricates* the geometry-shaped data that
DOM-agent clients need, rather than returning errors:

- `DOMSnapshot.captureSnapshot` (`domsnapshot.rs:116-278`) builds a full CDP snapshot — string
  interner (`domsnapshot.rs:64-84`), `parentIndex`/`nodeType`/`backendNodeId` arrays aligned 1:1 with
  an iterative pre-order DFS (`walk`, capped at `MAX_NODES = 20_000`, iterative to avoid stack
  overflow on deep chains — issue #341, `domsnapshot.rs:92-114`). Every node gets a synthetic
  **vertical-stack box** `[0, i*18, 1280, 18]` (`domsnapshot.rs:234-235`) and 10 plausible computed
  styles in the exact positional order browser-use reads them (`REQUIRED_STYLES`,
  `domsnapshot.rs:24-35`; `display:none` for `head/script/style/…`, `cursor:pointer` for interactive
  tags). `backendNodeId == nid` so it correlates with `DOM.getDocument`. The module header
  (`domsnapshot.rs:1-15`) is explicit that "clicking still falls back to JS `.click()` since the
  coordinates are synthetic."
- `DOM.getBoxModel`/`getContentQuads` derive a quad from `getBoundingClientRect()` and fall back to a
  fixed `[8,8,108,8,108,28,8,28]` box when JS can't produce one (`dom.rs:183-245`).
- `Page.getLayoutMetrics` returns a fixed 1280×720 viewport with content height from
  `document.documentElement.scrollHeight` (`page.rs:385-421`).
- `Accessibility.getFullAXTree` (`accessibility.rs:34-153`) is a genuine best-effort AX tree built by
  mapping tags/`role` attributes to ARIA roles (`map_role`, `accessibility.rs:156-270`) with computed
  name/value/properties — no coordinates needed, so this one is reasonably faithful.

## 9. Session and target model

- **One page per session.** Session ids are `"{targetId}-session"` (`target.rs:74,153,180`), the
  Playwright browser session is `"browser-session"` (`target.rs:128`), and the map is
  `sessions: session_id → page_id`. The dispatcher routes by `sessionId` on the incoming frame
  (`docs/Architecture-overview.md:82-86`).
- **One browser context.** `default_context` has id `"default"`; `createBrowserContext` /
  `disposeBrowserContext` do **not** create isolated contexts — they just clear the shared cookie jar
  and return/echo `"default"` (`target.rs:205-212`). So Playwright's `browser.newContext()` gives no
  real isolation.
- **Targets don't die on disconnect.** Closing the WebSocket detaches sessions but leaves pages
  running (`docs/Architecture-overview.md:86-87`); `handle_connection_ws` only aborts the send task
  (`server.rs:994`).
- Execution-context bookkeeping (`valid_context_ids`, `isolated_worlds`, `next_isolated_context_id`)
  exists specifically to make Playwright's utility-world locator path work across navigations
  (issues #51 and #192; `dispatch.rs:27-45`, `runtime.rs:364-387`, `page.rs:319-364`).

## 10. Puppeteer / Playwright / client compatibility surface

The crate is a museum of client-specific accommodations, each tied to a real issue number:

- **Playwright `connectOverCDP`**: `Target.attachToBrowserTarget` returns a `browser-session` +
  `attachedToTarget` event, without which the connect handshake hangs (`target.rs:124-149`).
- **Puppeteer `newPage()`**: the `is_v8_free_method` allowlist + `fast_path_response` keep the
  ~8-call setup chain unblocked; `Target.getBrowserContexts` fast-path avoids `protocolTimeout`
  (`server.rs:891-899`).
- **`headless_chrome` / old Puppeteer**: `Target.sendMessageToTarget` envelope unwrapping +
  `Target.receivedMessageFromTarget` event (`dispatch.rs:424-479`).
- **`chromiumoxide`**: every `TargetInfo` includes `canAccessOpener` or the client panics
  (`target.rs:230-244`, test `target.rs:293-308`).
- **puppeteer-extra `FrameManager.initialize`**: `Runtime.enable` succeeds with no attached session
  (`runtime.rs:55-88`, test `runtime.rs:522-529`); `Audits.enable` is tolerated (`dispatch.rs:341-349`).
- **browser-use**: `DOMSnapshot.captureSnapshot`, `Target.targetInfoChanged`, and `DOM.focus` so
  keystrokes land on `document.activeElement` (`docs/Connect-Puppeteer-or-Playwright.md:82`;
  `dom.rs:168-182`).
- **`page.$$()`/ElementHandle**: `Runtime.getProperties` allocates stable child object ids and tags
  DOM nodes with `subtype:"node"` (`runtime.rs:171-289`).

Documented "supported" list: `page.goto/reload/goBack/goForward`, `evaluate/evaluateHandle`,
`click/type/fill/focus`, `waitForSelector/waitForFunction/waitForNavigation`, cookies,
`setRequestInterception`, `exposeFunction`, `content/title/url`
(`docs/Connect-Puppeteer-or-Playwright.md:72-82`).

## 11. Security posture

- **`file://` gate (GHSA-q55h-vfv9-qcr5).** `util::url_is_file_scheme()` (`util.rs:13-19`) is
  case-insensitive and has a leading-whitespace syntactic fallback. It gates **both** `Page.navigate`
  (`page.rs:229-233`) **and** `Target.createTarget` (`target.rs:67-71`) — the comment at
  `util.rs:1-7` notes the incomplete-fix variant where `createTarget` had bypassed the page-domain
  check. Opt-in via `obscura serve --allow-file-access`.
- **Private-network gate**: `allow_private_network` threaded through the context (issue #33,
  `dispatch.rs:89-102`).
- **Resource caps**: bounded deferral queue (256), bounded WS handoff channel (128), DOMSnapshot node
  cap (20_000), per-command watchdog. All exist to keep one client/page from OOMing or wedging the
  process.
- **No auth / no TLS on the CDP port.** The server binds plain TCP; `start_with_full_options`
  defaults host to `127.0.0.1` (`server.rs:63`) and the `--allow-file-access` log warns not to expose
  the port to untrusted networks (`server.rs:143-145`). Anyone who can reach the port has full
  `Runtime.evaluate` control.

## 12. Limitations and coverage gaps (what the code does NOT do)

- **No rendering.** `Page.captureScreenshot`, `Page.captureSnapshot` (MHTML), `Page.printToPDF` all
  return descriptive errors, not images/PDF (`page.rs:496-520`). No pixel geometry anywhere.
- **`Fetch.getResponseBody` is a stub** returning empty (`fetch.rs:181-183`) — a client that fulfills
  from an intercepted response body will get nothing back.
- **`Page.disable` and `Runtime.disable` are NOT handled** in their domain `match` blocks (only
  `Page.enable`/`Runtime.enable` exist; see `page.rs:286-521` and `runtime.rs:54-356`), so those calls
  fall through to `Err("Unknown Page/Runtime method: disable")` — even though both appear in the
  `is_v8_free_method` allowlist (`dispatch.rs:226,234`), an internal inconsistency. `Network.disable`
  and `DOMSnapshot.disable` *are* handled.
- **No real multi-context isolation.** `createBrowserContext` just clears/echoes the single
  `"default"` context (`target.rs:205-212`).
- **Single shared V8 isolate.** No per-page isolation; a CPU-bound script on one page stalls all
  others. This is called out as a hard limitation in the docs
  (`docs/Connect-Puppeteer-or-Playwright.md:86-87`, `docs/Use-with-Playwright.md:96-97`).
- **Input events are synthetic.** Mouse coordinates use `document.elementFromPoint` but there is no
  layout, so clicks fall back to JS `.click()`/form-submit heuristics (`input.rs:65-138`); hover,
  drag, wheel, and touch (`dispatchTouchEvent` no-op, `input.rs:216`) are not meaningfully modeled.
- **Brittle string-sniffing routing.** Navigation detection is `text.contains("Page.navigate")`
  (`server.rs:435`) and fetch-resolution detection is `text.contains("Fetch.")` (`server.rs:444`) /
  `.contains("Fetch.continueRequest")` etc. (`server.rs:699-702`) on the *raw frame text* — a session
  or param string containing that substring could misroute.
- **No `Emulation`/`CSS`/`Debugger`/`Profiler`** behavior — all tolerated no-ops, so device metric
  overrides, media emulation, CSS coverage, breakpoints, and profiling silently do nothing.
- **No WebSocket/EventSource network events, no `Network.dataReceived`, no request-body capture**
  beyond the navigation resource set.
- **`Storage.*` ignores the session** and always targets the default context (`storage.rs:11,15,22,28`).

## 13. How it connects to the rest of Obscura

Cross-crate calls (all "downward", per the workspace convention in
`docs/Architecture-overview.md:106-110`):

- **`obscura-browser`**: `Page`, `BrowserContext`, `NetworkEvent`, `lifecycle::WaitUntil`,
  `HTML_TO_MARKDOWN_JS`. `CdpContext` owns a `Vec<Page>` and an `Arc<BrowserContext>`; navigation,
  eval, cookies, response bodies, blocked URLs, and history all delegate to `Page` methods
  (`navigate_with_wait`, `evaluate_for_cdp`, `call_function_on_for_cdp`, `with_dom`, `http_client`,
  `get_response_body`, `alias_response_body`, `suspend_js`/`resume_js`, `isolate_handle`).
- **`obscura-js`**: the global `v8_lock`, the `cdp_watchdog`, `ops::InterceptedRequest` /
  `InterceptResolution` (fetch interception channel), `runtime::RemoteObjectInfo` (RemoteObject
  shaping in `runtime.rs:389-413`), and `op_binding_called` (binding drain).
- **`obscura-dom`**: `DomTree`, `NodeData`, `NodeId`, `Node` — consumed directly by
  `DOM.getDocument`/`describeNode` (`dom.rs:250-299`), `DOMSnapshot` (`domsnapshot.rs:116-278`), and
  `Accessibility` (`accessibility.rs`).
- **`obscura-net`**: `CookieJar`, `CookieInfo` — the cookie plumbing for `Network.*`/`Storage.*`
  (`network.rs:5,21-25`, `cookie_params.rs:1`).
- **Upward consumers**: only `obscura-cli serve` and the crate's own tests. The MCP server bypasses
  CDP entirely.

The request-flow diagram in `docs/Architecture-overview.md:18-42` confirms the layering:
`server.rs` (accept/route) → `dispatch.rs` (router + v8_lock) → `domains/page.rs` →
`obscura-browser::page.rs::navigate_with_wait` → net/dom/js, with events flowing back out the same
WebSocket.

## 14. Testing

- Unit tests are colocated in each handler (`#[cfg(test)]` blocks) and cover the compatibility
  regressions by issue number (e.g. `runtime.rs:415-529` for #51 context-id validation,
  `page.rs:582-633` for #45/#53 unsupported-method errors, `target.rs:293-308` for #122
  `canAccessOpener`).
- Integration tests (`crates/obscura-cdp/tests/`): `control_plane_unblocked.rs` (issue #62 — HTTP
  stays responsive during a 5s JS loop), `concurrent_navigations.rs` and
  `concurrent_navigations_with_fetch.rs` (the issue #19 V8-abort scenarios), and
  `cdp_click_submit_parity.rs` (click→form-submit parity via real TCP).
- The extension recipe (`docs/Adding-a-CDP-method-or-Web-API.md:3-67`) documents the two-step
  "add a handler + register a dispatch arm" workflow, confirming the hand-rolled, per-method design.
</content>
</invoke>

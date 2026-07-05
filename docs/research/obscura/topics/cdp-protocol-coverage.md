---
title: "Obscura CDP Protocol Coverage: Implemented Domains, Methods, Events, and Gaps"
date: 2026-07-03
researcher: Claude (architecture research subagent)
status: Complete
category: protocol-coverage
---

# Obscura CDP Protocol Coverage

> Reverse-engineering notes on the `obscura-cdp` crate of the Apache-2.0 project **Obscura**
> (https://github.com/h4ckf0r0day/obscura), a layout-free headless browser that speaks the
> Chrome DevTools Protocol (CDP) over WebSocket so Puppeteer/Playwright/browser-use can drive it.
> Source read at commit `ca71ce3` (workspace version `0.1.0`).

## 1. Purpose and scope of this document

This is a precise catalog of **exactly which CDP domains and methods Obscura implements**, how each
is handled, which CDP **events** it emits, and — equally important — **what it does not do**. The
target audience is someone deciding whether an existing Puppeteer/Playwright/CDP automation will work
against Obscura, or comparing Obscura's protocol surface against a full Chromium.

The headline framing, stated by Obscura's own docs, is that Obscura **has no layout or paint engine**
(`docs/Use-with-Playwright.md:106-109`, `crates/obscura-cdp/src/domains/page.rs:496-520`). Everything
downstream of that — no screenshots, no PDF, synthetic box models, synthetic DOMSnapshot geometry — is
a consequence.

## 2. Crate layout — where CDP lives

All CDP code is in `crates/obscura-cdp`. Module tree (`crates/obscura-cdp/src/lib.rs:1-11`):

| File | Lines | Role |
| --- | --- | --- |
| `src/server.rs` | 996 | WebSocket + HTTP transport, connection loop, navigation multiplexing, fast-path |
| `src/dispatch.rs` | 567 | Method router (`domain.method` → handler), V8 lock, watchdog, `sendMessageToTarget` unwrap |
| `src/types.rs` | 74 | `CdpRequest` / `CdpResponse` / `CdpError` / `CdpEvent` wire types |
| `src/domains/mod.rs` | 12 | Declares the 12 implemented domain modules |
| `src/domains/target.rs` | 309 | `Target` domain |
| `src/domains/browser.rs` | 36 | `Browser` domain |
| `src/domains/page.rs` | 684 | `Page` domain + shared navigation event emitter |
| `src/domains/dom.rs` | 345 | `DOM` domain |
| `src/domains/domsnapshot.rs` | 416 | `DOMSnapshot.captureSnapshot` (synthesized) |
| `src/domains/runtime.rs` | 530 | `Runtime` domain |
| `src/domains/network.rs` | 430 | `Network` domain (cookies, headers, blocked URLs, response body) |
| `src/domains/fetch.rs` | 186 | `Fetch` interception domain |
| `src/domains/input.rs` | 220 | `Input` domain (mouse/key synthesis via JS) |
| `src/domains/storage.rs` | 38 | `Storage` domain (cookies only) |
| `src/domains/accessibility.rs` | 433 | `Accessibility.getFullAXTree` (from DOM tree) |
| `src/domains/lp.rs` | 21 | **Non-standard** `LP.getMarkdown` (Obscura extension) |
| `src/cookie_params.rs` | 162 | CDP cookie ↔ `CookieInfo` parsing |
| `src/util.rs` | 62 | `file://` scheme gate |

## 3. The dispatcher — domain routing

`dispatch()` splits the method on the first `.` and routes by domain
(`crates/obscura-cdp/src/dispatch.rs:316-351`):

```rust
let (domain, method) = match req.method.split_once('.') { ... };
let result = match domain {
    "Target" => domains::target::handle(method, &req.params, ctx).await,
    "Browser" => domains::browser::handle(method, &req.params).await,
    "Page" => domains::page::handle(method, &req.params, ctx, &req.session_id).await,
    "DOM" => domains::dom::handle(...).await,
    "DOMSnapshot" => domains::domsnapshot::handle(...).await,
    "Runtime" => domains::runtime::handle(...).await,
    "Network" => domains::network::handle(...).await,
    "Fetch" => domains::fetch::handle(...).await,
    "Input" => domains::input::handle(...).await,
    "Storage" => domains::storage::handle(...).await,
    "LP" => domains::lp::handle(...).await,
    "Accessibility" => domains::accessibility::handle(...).await,
    "Emulation" | "Log" | "Performance" | "Security" | "CSS"
    | "ServiceWorker" | "Inspector"
    | "Debugger" | "Profiler" | "HeapProfiler" | "Overlay"
    | "Audits" => { Ok(json!({})) }          // accepted but NO-OP
    _ => Err(format!("Unknown domain: {}", domain)),
};
```

Three tiers of domain support:

1. **Implemented** (12 real handlers): `Target, Browser, Page, DOM, DOMSnapshot, Runtime, Network,
   Fetch, Input, Storage, Accessibility` plus the proprietary `LP`.
2. **Accepted-but-stubbed** (12 domains): `Emulation, Log, Performance, Security, CSS, ServiceWorker,
   Inspector, Debugger, Profiler, HeapProfiler, Overlay, Audits` — **every** method in these domains
   returns `{}` regardless of arguments (`dispatch.rs:344-349`). The comment explains why they can't
   just error: "Puppeteer's FrameManager.initialize calls Audits.enable on connect — refusing it
   breaks puppeteer.connect() before any user code runs" (`dispatch.rs:341-343`).
3. **Unknown**: any other domain → JSON-RPC error `-32601 "Unknown domain: X"` (`dispatch.rs:350`).

Malformed method (no `.`) → `-32601 "Invalid method format"` (`dispatch.rs:318-325`). Error responses
use `-32601` for handler errors too (`dispatch.rs:375`), which is technically the "method not found"
code even for semantic errors.

### 3.1 `Target.sendMessageToTarget` legacy wrapping

Before any routing, `dispatch()` special-cases `Target.sendMessageToTarget`
(`dispatch.rs:256-258`, `424-479`): it unwraps the nested `message` JSON, recurses with the wrapper's
`sessionId`, and re-emits the inner response as a `Target.receivedMessageFromTarget` event. This is
for `headless_chrome` and older Puppeteer which correlate by event rather than by response id
(`dispatch.rs:465-476`).

## 4. Full method catalog by domain

### 4.1 Target (`domains/target.rs`)

| Method | Behaviour | Cite |
| --- | --- | --- |
| `setDiscoverTargets` | emits `targetCreated` for the browser + every page | `target.rs:9-41` |
| `getTargets` | returns page targets only | `target.rs:42-59` |
| `createTarget` | creates a `Page`, navigates, emits `targetCreated`+`attachedToTarget`; `file://` gated | `target.rs:60-123` |
| `attachToBrowserTarget` | returns `browser-session`, emits `attachedToTarget` | `target.rs:124-149` |
| `attachToTarget` | returns `{targetId}-session`, emits `attachedToTarget` | `target.rs:150-176` |
| `closeTarget` | emits `detachedFromTarget`+`targetDestroyed`, removes page | `target.rs:177-196` |
| `setAutoAttach` | no-op `{}` | `target.rs:197` |
| `detachFromTarget` | no-op `{}` | `target.rs:200` |
| `activateTarget` | no-op `{}` | `target.rs:201` |
| `getBrowserContexts` | returns `[default_context.id]` | `target.rs:202-204` |
| `createBrowserContext` | **clears the cookie jar**, returns existing default id | `target.rs:205-208` |
| `disposeBrowserContext` | **clears the cookie jar** | `target.rs:209-212` |
| `getTargetInfo` | page or browser TargetInfo; always includes `canAccessOpener` | `target.rs:213-246` |

**Gap:** `createBrowserContext` does **not** create an isolated context — it returns the single shared
default id and merely wipes cookies (`target.rs:205-208`). There is no true multi-context isolation.
Session ids are the fixed string pattern `"{targetId}-session"` (`target.rs:74`, `153`,
`docs/Architecture-overview.md:84`).

### 4.2 Browser (`domains/browser.rs`)

`getVersion` (reports **Chrome/145.0.0.0**, protocol **1.3**), `close`, `getWindowForTarget`
(fixed 1280×720), `getWindowBounds`, `setDownloadBehavior` (no-op), `setWindowBounds` (no-op)
(`browser.rs:4-34`). Unknown → error (`browser.rs:34`).

### 4.3 Page (`domains/page.rs`)

| Method | Behaviour | Cite |
| --- | --- | --- |
| `enable` | no-op `{}` | `page.rs:287` |
| `navigate` | full navigation + event stream; `file://` gated; POST via `__method`/`__body` | `page.rs:288-292`, `215-278` |
| `reload` | re-navigates current URL | `page.rs:293-301` |
| `getFrameTree` | single frame, **`childFrames: []` always** | `page.rs:302-318` |
| `createIsolatedWorld` | registers a utility world, emits `executionContextCreated` w/ fresh id | `page.rs:319-365` |
| `setLifecycleEventsEnabled` | no-op | `page.rs:366` |
| `addScriptToEvaluateOnNewDocument` | stores preload script, returns identifier | `page.rs:367-375` |
| `removeScriptToEvaluateOnNewDocument` | removes it | `page.rs:376-380` |
| `setInterceptFileChooserDialog` | no-op | `page.rs:381` |
| `setDownloadBehavior` | no-op | `page.rs:384` |
| `getLayoutMetrics` | **fixed 1280×720 viewport**, height from `scrollHeight` | `page.rs:385-421` |
| `getNavigationHistory` | synthesizes an entry if history empty | `page.rs:422-449` |
| `navigateToHistoryEntry` | back/forward navigation | `page.rs:450-488` |
| `resetNavigationHistory` | clears history | `page.rs:489-495` |
| `printToPDF` | **explicit descriptive error — unsupported** | `page.rs:496-509` |
| `captureScreenshot` / `captureSnapshot` | **explicit descriptive error — unsupported** | `page.rs:510-520` |

`printToPDF`/`captureScreenshot`/`captureSnapshot` deliberately return actionable errors rather than
the generic "Unknown Page method" so clients fail fast ("no layout or paint engine",
`page.rs:496-520`). Regression tests enforce this (`page.rs:582-633`).

**waitUntil semantics** (`page.rs:181-213`): default is **`DomContentLoaded`**, not Chrome's
`Load` — a deliberate deviation because Obscura batches its event emission at the end of navigation, so
defaulting to `Load` on JS-heavy sites pushed navigation past client timeouts (`page.rs:201-212`).
Accepted values map to `WaitUntil::{DomContentLoaded, Load, NetworkIdle2, NetworkIdle0}`.

### 4.4 DOM (`domains/dom.rs`)

| Method | Behaviour | Cite |
| --- | --- | --- |
| `enable` | no-op | `dom.rs:41` |
| `getDocument` | serializes the DOM tree to depth (default 2) | `dom.rs:42-49` |
| `querySelector` | returns `nodeId` (0 if not found) | `dom.rs:50-57` |
| `querySelectorAll` | returns `nodeIds` | `dom.rs:58-67` |
| `getOuterHTML` | serialized outer HTML | `dom.rs:68-77` |
| `describeNode` | node descriptor; resolves `objectId` via JS `_nid` | `dom.rs:78-102` |
| `resolveNode` | wraps a node as a JS RemoteObject (`subtype:"node"`) | `dom.rs:103-165` |
| `setAttributeValue` | **no-op `{}` — does not mutate** | `dom.rs:166` |
| `removeNode` | **no-op `{}` — does not mutate** | `dom.rs:167` |
| `focus` | JS `.focus()` → sets `document.activeElement` | `dom.rs:168-182` |
| `getBoxModel` | **synthetic quad** from `getBoundingClientRect()` (no layout) | `dom.rs:183-220` |
| `getContentQuads` | **synthetic quad** | `dom.rs:221-245` |

`resolve_node_id` honors `nodeId`, then `backendNodeId`, then `objectId` (`dom.rs:11-32`).
Node ids are the DOM tree index; `backendNodeId == nodeId` (`dom.rs:257`). Box model coordinates are
**not real geometry** — they come from `getBoundingClientRect`, which in a layout-free engine is itself
synthetic; a fallback box `[8,8,108,...]` is used when unavailable (`dom.rs:205-210`).

**Gaps:** no `DOM.getAttributes`, `setNodeValue`, `setOuterHTML`, `pushNodesByBackendIdsToFrontend`,
`getSearchResults`/`performSearch`, `scrollIntoViewIfNeeded`, `getNodeForLocation`, `requestNode`,
`getFlattenedDocument`. `setAttributeValue`/`removeNode` accept but do nothing (`dom.rs:166-167`).

### 4.5 DOMSnapshot (`domains/domsnapshot.rs`)

Only `captureSnapshot` is real; `enable`/`disable` no-op, and **all other methods
(including `getSnapshot`) are a permissive `{}` no-op**, not an error (`domsnapshot.rs:47-59`,
`406-415`). This domain exists specifically for **browser-use** and DOM-agent frameworks that build an
interactive-element index from `captureSnapshot` (`domsnapshot.rs:1-15`).

Because there is no layout engine, geometry is **synthesized**: every node gets a full-width 18px-tall
box in a vertical stack at `y = index*18` (`domsnapshot.rs:230-236`), plus 10 fixed computed styles in
the exact positional order browser-use reads (`REQUIRED_STYLES`, `domsnapshot.rs:24-35`, `213-229`).
`isClickable` is set from tag name / `onclick` (`domsnapshot.rs:198-206`). `backendNodeId` matches
`DOM.getDocument` (`domsnapshot.rs:189`). Capped at `MAX_NODES = 20_000` via an iterative walk to avoid
stack overflow (`domsnapshot.rs:37-39`, `92-114`).

### 4.6 Runtime (`domains/runtime.rs`)

| Method | Behaviour | Cite |
| --- | --- | --- |
| `enable` | emits `executionContextCreated` (id 1) if a page; succeeds w/o session | `runtime.rs:55-88` |
| `evaluate` | evaluates expr; validates `contextId`; `timeout` default 30s | `runtime.rs:89-134` |
| `callFunctionOn` | calls function on `objectId`; validates `executionContextId` | `runtime.rs:135-170` |
| `getProperties` | walks `__obscura_objects`, annotates nodes for ElementHandle | `runtime.rs:171-289` |
| `releaseObject` | releases stored object | `runtime.rs:290-297` |
| `releaseObjectGroup` | releases group | `runtime.rs:298-303` |
| `addBinding` | installs a JS shim → `op_binding_called` → `Runtime.bindingCalled` | `runtime.rs:304-341` |
| `removeBinding` | removes shim | `runtime.rs:342-352` |
| `runIfWaitingForDebugger` | no-op | `runtime.rs:353` |
| `getExceptionDetails` | **always `{exceptionDetails: null}`** | `runtime.rs:354` |
| `discardConsoleEntries` | no-op | `runtime.rs:355` |

`contextId` validation (`runtime.rs:364-387`): ids `1` and `2` are pre-seeded default-frame contexts
(`dispatch.rs:127-129`); `Page.createIsolatedWorld` claims monotonic ids from `100` up
(`dispatch.rs:143-154`). An unknown id yields Chrome's exact error string
`"Cannot find context with specified id: N"` (`runtime.rs:373-378`) — added to unblock Playwright's
utility-world locator path (issue #51).

`addBinding` / `exposeFunction`: the shim ToString-coerces its single argument and drops wrong-arity
calls to match Chromium's V8InspectorImpl (`runtime.rs:315-327`); it is re-installed on every
navigation via a preload script (`runtime.rs:328-338`). Calls are drained into `Runtime.bindingCalled`
events after every dispatch (`dispatch.rs:386-422`).

**Gaps:** no `Runtime.compileScript`/`runScript`, `queryObjects`, `globalLexicalScopeNames`,
`awaitPromise` as a standalone method, `getHeapUsage`, `setAsyncCallStackDepth`. **`getExceptionDetails`
is hardwired to null** (`runtime.rs:354`), so exception reporting is inert.

### 4.7 Network (`domains/network.rs`)

| Method | Behaviour | Cite |
| --- | --- | --- |
| `enable` | no-op | `network.rs:34` |
| `disable` | clears stored response bodies | `network.rs:35-44` |
| `setExtraHTTPHeaders` | sets headers on the HTTP client | `network.rs:45-57` |
| `setUserAgentOverride` | sets UA on the HTTP client | `network.rs:58-64` |
| `getCookies` / `getAllCookies` | returns jar cookies as CDP cookie objects | `network.rs:65-69` |
| `setCookie` | parses + stores; works without a session | `network.rs:70-75` |
| `setCookies` | bulk | `network.rs:76-82` |
| `deleteCookies` | filtered delete | `network.rs:83-92` |
| `clearBrowserCookies` | clears jar | `network.rs:93-96` |
| `setCacheDisabled` | no-op | `network.rs:97` |
| `setRequestInterception` | **no-op `{}` — interception is done via the Fetch domain** | `network.rs:98` |
| `setBlockedURLs` | stores block patterns on the page | `network.rs:99-119` |
| `getResponseBody` | returns stored body by `requestId` (or aliased loaderId) | `network.rs:120-139` |

Cookie jar resolution prefers the session page's jar, falling back to the default context so Puppeteer/
Playwright can set cookies before attaching (`network.rs:21-25`). Cookie JSON includes
`sameParty`, `sourceScheme`, `sourcePort`, `priority` for strict clients (`network.rs:406-430`).

**Key design note:** `Network.setRequestInterception` is a **no-op** — real interception is the modern
`Fetch` domain (`network.rs:98`, and Puppeteer's `page.setRequestInterception` maps to `Fetch.enable`).
**Gaps:** no `Network.emulateNetworkConditions`, `getResponseBodyForInterception`,
`takeResponseBodyForInterceptionAsStream`, `getRequestPostData`, `setCookies` partition keys,
`clearBrowserCache`, `setCacheDisabled` actual effect. No `loadingFailed`/`dataReceived`/`*ExtraInfo`
events (see §5).

### 4.8 Fetch (`domains/fetch.rs`)

`enable` (patterns, default `["*"]`), `disable`, `continueRequest`, `fulfillRequest`, `failRequest`
(`fetch.rs:62-180`). `getResponseBody` **returns an empty stub `{body:"", base64Encoded:false}`**
(`fetch.rs:181-183`). Resolution is via a `oneshot` channel to the paused request
(`FetchResolution` enum, `fetch.rs:16-31`). The server-side interception plumbing lives in
`server.rs::process_with_interception` / `handle_fetch_resolution` (`server.rs:460-502`, `504-785`),
which emits `Fetch.requestPaused` + a synthetic `Network.requestWillBeSent`.

**Gaps:** no `Fetch.continueWithAuth` (HTTP auth challenges), no `Fetch.continueResponse`,
no `Fetch.getResponseBody` (stub), no `Fetch.takeResponseBodyAsStream`. `continueRequest` reads
`url`/`method`/`postData` but drops header overrides (`headers: None`, `fetch.rs:117-123`).

### 4.9 Input (`domains/input.rs`)

`dispatchMouseEvent` and `dispatchKeyEvent` are the only real methods; `dispatchTouchEvent` and
`setIgnoreInputEvents` are no-ops (`input.rs:216-217`).

Since there is no renderer, input is **synthesized in JS**:
- `dispatchMouseEvent` handles only `mousePressed` and `mouseReleased`. `mousePressed` runs a large JS
  snippet that dispatches `mousedown`/`click`, then emulates default actions: link navigation,
  form submit, checkbox/radio toggle, and triple-click select-all (`input.rs:65-121`). It targets
  `document.elementFromPoint(x,y)` (`input.rs:76`).
- `dispatchKeyEvent` handles `keyDown`/`rawKeyDown`/`keyUp`/`char`; inserts text at the caret,
  handles Enter (submit vs textarea newline), and Backspace (`input.rs:139-215`).

**Gaps:** `mouseMoved`/`mouseWheel` mouse types are accepted but do nothing (only pressed/released are
matched, `input.rs:72-135`); no real `Input.insertText` method, no `Input.dispatchDragEvent`,
`Input.setInterceptDrags`, `Input.imeSetComposition`. Coordinates are only used to hit-test via
`elementFromPoint`; the actual box coordinates are synthetic.

### 4.10 Storage (`domains/storage.rs`)

Only cookies: `getCookies`, `setCookies`, `deleteCookies` (default-context jar). **Every other method
returns a permissive `{}` no-op** (`storage.rs:36`), so `Storage.enable`, `clearDataForOrigin`,
`getUsageAndQuota`, `getStorageKeyForFrame`, etc. all succeed silently without effect.

### 4.11 Accessibility (`domains/accessibility.rs`)

`enable` (no-op) and `getFullAXTree`, built by walking the DOM tree and mapping tags/roles to a
CDP `AXNode` array (`accessibility.rs:26-45`, `map_role` at `156-270`). Accessible name/value/props are
computed from `aria-label`, `aria-labelledby`, `alt`, `title`, `placeholder`, etc.
(`accessibility.rs:272-433`). Other methods → permissive `{}` (`accessibility.rs:43`).

**Gaps:** no `Accessibility.getPartialAXTree`, `getChildAXNodes`, `queryAXTree`, `getAXNodeAndAncestors`.
Roles are approximated from a static tag→role table, not the full ARIA computed-role algorithm.

### 4.12 LP — a non-standard Obscura-only domain (`domains/lp.rs`)

`LP.getMarkdown` runs `HTML_TO_MARKDOWN_JS` against the page and returns `{markdown: ...}`
(`lp.rs:12-19`). This is **not a Chrome CDP domain**; it is an Obscura extension for the
markdown-extraction feature. Unknown `LP.*` → error.

## 5. CDP events Obscura emits (and the ones it doesn't)

Events are queued into `ctx.pending_events` and flushed to the WS **before** each command response
(`server.rs:805-814`), matching Chromium ordering that Playwright depends on. The **complete** set of
emitted event methods (grepped across the crate):

| Event | Where | Cite |
| --- | --- | --- |
| `Target.targetCreated` | discover/create | `target.rs:10`, `88`, `docs` |
| `Target.attachedToTarget` | attach/create | `target.rs:105`, `132`, `158` |
| `Target.detachedFromTarget` | close | `target.rs:183` |
| `Target.targetDestroyed` | close | `target.rs:190` |
| `Target.targetInfoChanged` | post-navigation (url/title refresh) | `page.rs:163-176` |
| `Target.receivedMessageFromTarget` | legacy wrap | `dispatch.rs:469` |
| `Page.frameNavigated` | navigation | `page.rs:79` |
| `Page.lifecycleEvent` | init/commit/DOMContentLoaded/load/networkIdle | `page.rs:77,96,142,144,149` |
| `Page.domContentEventFired` | navigation | `page.rs:143` |
| `Page.loadEventFired` | navigation | `page.rs:145` |
| `Page.frameStoppedLoading` | navigation | `page.rs:151` |
| `Runtime.executionContextCreated` | enable / nav / isolated world | `page.rs:80,91,347`, `runtime.rs:65` |
| `Runtime.executionContextsCleared` | navigation | `page.rs:78` |
| `Runtime.bindingCalled` | binding drain | `dispatch.rs:407` |
| `Network.requestWillBeSent` | navigation / intercept | `page.rs:70,124`, `server.rs:640` |
| `Network.responseReceived` | navigation | `page.rs:130` |
| `Network.loadingFinished` | navigation | `page.rs:135` |
| `Fetch.requestPaused` | interception | `page.rs:103`, `server.rs:663` |

**Events NOT emitted (notable gaps) — verified absent by grep across `crates/`:**

- `Runtime.consoleAPICalled` and `Runtime.exceptionThrown` — **page `console.*` output and uncaught
  exceptions are never forwarded to CDP clients.** Puppeteer's `page.on('console')` /
  `page.on('pageerror')` will receive nothing.
- `Log.entryAdded` — the `Log` domain is entirely stubbed.
- `Network.loadingFailed`, `Network.dataReceived`, `Network.requestWillBeSentExtraInfo`,
  `Network.responseReceivedExtraInfo` — no failure or extra-info events; navigation always emits the
  success trio (`requestWillBeSent`→`responseReceived`→`loadingFinished`).
- `Page.javascriptDialogOpening` / no `Page.handleJavaScriptDialog` method — **`alert`/`confirm`/
  `prompt` dialogs are not surfaced or handleable via CDP.**
- `Page.frameAttached` / `Page.frameDetached` / `Page.windowOpen` — no sub-frame lifecycle.
- `Target.targetCrashed`, `Page.fileChooserOpened`, `Inspector.targetCrashed`.

## 6. Transport, HTTP control plane, and the fast path (`server.rs`)

Obscura serves both WebSocket CDP and the Chromium HTTP discovery endpoints on one port. A **dedicated
blocking accept thread** peeks the first bytes to split HTTP vs WebSocket (`server.rs:157-175`,
`244-290`) so the HTTP control plane stays responsive even while V8 blocks the tokio LocalSet
(issue #62, `server.rs:125-136`). HTTP endpoints served: `/json/version`, `/json` / `/json/list`,
`/json/protocol` (`server.rs:257-265`, `303-324`) — advertising `Browser: Chrome/145.0.0.0`,
`Protocol-Version: 1.3`, and `ws://.../devtools/browser`.

### 6.1 Fast-path (bypasses the dispatcher queue)

`fast_path_response` (`server.rs:864-909`) answers a fixed set of cheap connect-time methods
**directly on the WS read task**, before enqueueing to the single `cdp_processor`, so Puppeteer's
first-call `Target.getBrowserContexts` cannot starve behind a long navigation (`server.rs:891-899`).
Fast-pathed methods: `Network.enable`, `Network.setCacheDisabled`, `Network.setRequestInterception`,
`Page.enable`, `Page.setLifecycleEventsEnabled`, `Page.setInterceptFileChooserDialog`,
`Runtime.runIfWaitingForDebugger`, `Runtime.discardConsoleEntries`, `Performance.enable`, `Log.enable`,
`Security.enable`, `Emulation.setDeviceMetricsOverride`, `Emulation.setTouchEmulationEnabled`,
`CSS.enable`, `Accessibility.enable`, `ServiceWorker.enable`, `Inspector.enable`, `Debugger.enable`,
`Profiler.enable`, `HeapProfiler.enable`, `Overlay.enable`, `Storage.enable`, `Target.setAutoAttach`,
`Browser.getVersion`, `Browser.setDownloadBehavior`, `Browser.getWindowBounds`,
`Target.getBrowserContexts` (`server.rs:867-899`). `Browser.close` is intercepted even earlier and ends
the connection (`server.rs:967-975`).

## 7. Concurrency model and its protocol implications

Obscura runs **one V8 isolate per page**, not a single shared one: each `Page` owns its own
`JsRuntime` (`obscura-browser/src/page.rs:154`, `pub js: Option<ObscuraJsRuntime>`), which is dropped
and recreated on every navigation for realm isolation (`page.rs:261-277`). Every one of these per-page
isolates runs on a **single OS thread** (`current_thread` tokio + `LocalSet`), and V8 permits only one
isolate to be entered on a thread at a time (`v8_lock.rs:3-9`, `dispatch.rs:262-269`). CDP concurrency
correctness therefore hinges on a process-wide `tokio::sync::Mutex` V8 lock held around each dispatch
(`dispatch.rs:289-293`) — otherwise interleaving two pages' V8 work across an `.await` trips V8's
`heap->isolate() == Isolate::TryGetCurrent()` invariant and aborts the process via `V8_Fatal`
(issue #19, `dispatch.rs:260-288`, `v8_lock.rs:1-17`). That invariant can only trip because multiple
isolates coexist on the one thread; the lock is what makes each handler contiguous so V8 fully exits one
isolate before the next page is allowed in. To avoid over-serializing, `is_v8_free_method`
(`dispatch.rs:216-249`) lists audited methods that never touch V8 and may bypass the lock (most of
`Target.*`, `Browser.*`, cookie/header methods, `Page.enable`, etc.).

> **Doc-vs-code discrepancy.** Obscura's own `docs/Architecture-overview.md:44` (and
> `Use-with-Puppeteer.md:112`, `Use-with-Playwright.md:97`) state that "all pages in a process share one
> V8 isolate." The code contradicts this: `Page::js` is a per-page runtime (`page.rs:154`), `init_js`
> drops and rebuilds it per navigation (`page.rs:261-277`, whose comment notes the *old* code "reused
> the V8 isolate"), and both `v8_lock.rs:5` and `dispatch.rs:262-269` describe "one per Page … each
> owning its own V8 Isolate." The operational upshot the docs draw is nonetheless correct regardless of
> isolate count: a single global lock serializes all V8 work on the one thread (see below).

A per-command watchdog terminates a runaway isolate after `OBSCURA_CDP_COMMAND_TIMEOUT_MS` (default
60s) so one hung page can't wedge every session (`dispatch.rs:295-314`, `356-367`). `Page.navigate` is
routed through a spawn-and-defer path (`process_with_interception`, `server.rs:426-448`, `504-785`) so
the processor keeps multiplexing other CDP messages while navigation runs; foreign messages arriving
mid-navigation are **deferred** (bounded at `MAX_DEFERRED_MESSAGES = 256`, `server.rs:19`, `715-731`)
or, for Fetch resolutions, handled inline.

**Protocol consequence:** the per-page isolates give **no concurrency isolation** — because the
process-wide lock serializes all V8 work onto the one thread, a CPU-bound script on one page blocks
Runtime calls on all others (`docs/Use-with-Puppeteer.md:112`, `Use-with-Playwright.md:97`). This is an
explicitly documented non-feature.

## 8. Security gates in the protocol layer

`file://` navigation is blocked by default across every navigation entrypoint via the shared
`url_is_file_scheme` helper (`util.rs:13-19`): `Page.navigate` (`page.rs:229-233`) and
`Target.createTarget` (`target.rs:67-71`) both gate on `ctx.default_context.allow_file_access`,
enabled only with `obscura serve --allow-file-access` (references GHSA-q55h-vfv9-qcr5). The check is
case-insensitive and has a leading-whitespace fallback (`util.rs:13-19`, tests `util.rs:25-61`).

## 9. Coverage-gap summary vs full Chrome CDP

**Domains entirely absent / stubbed to `{}`** (accepted so clients connect, but inert): `Emulation`
(no viewport, device metrics, geolocation, timezone, locale, touch — all no-ops), `CSS` (no computed
styles), `Log`, `Performance`, `Security`, `ServiceWorker`, `Debugger`, `Profiler`, `HeapProfiler`,
`Overlay`, `Audits`, `Inspector` (`dispatch.rs:344-349`). Also **not routed at all** (→ "Unknown
domain" error): `Tracing`, `Cast`, `Media`, `WebAuthn`, `BackgroundService`, `IndexedDB`, `CacheStorage`,
`Database`, `DeviceOrientation`, `Animation`, `LayerTree`, `DOMDebugger`, `EventBreakpoints`,
`SystemInfo`, `PerformanceTimeline`, `HeadlessExperimental`, `Schema`, `Memory`.

**Capability gaps within implemented domains:**

- **No pixels:** `Page.captureScreenshot`, `Page.printToPDF`, `Page.captureSnapshot` return explicit
  unsupported errors (`page.rs:496-520`). No `HeadlessExperimental.beginFrame`.
- **No real geometry:** `DOM.getBoxModel`/`getContentQuads` and `DOMSnapshot` bounds are synthesized
  (`dom.rs:183-245`, `domsnapshot.rs:230-236`); `Page.getLayoutMetrics` is a fixed 1280×720
  (`page.rs:385-421`).
- **No sub-frames / OOPIF:** `getFrameTree` always returns `childFrames: []` (`page.rs:314`); no
  frame lifecycle events; iframe targets are not modeled.
- **No true browser-context isolation:** one shared cookie jar/context; `createBrowserContext` just
  wipes cookies (`target.rs:205-212`).
- **No console/exception/log forwarding** (§5) and `Runtime.getExceptionDetails` is null
  (`runtime.rs:354`).
- **No JS dialog handling** (`alert`/`confirm`/`prompt`).
- **Request interception is Fetch-only**, missing header overrides on continue, auth challenges,
  response continuation, and streamed bodies (`fetch.rs`, §4.8). `Network.setRequestInterception` is a
  no-op (`network.rs:98`).
- **No network conditions / throttling / cache control** effect.
- **Input** limited to press/release + key synthesis; no move/wheel/drag/IME (§4.9).
- **No `Storage`/`IndexedDB`/`CacheStorage` introspection** — Storage is cookies-only (`storage.rs`).

## 10. Documented Puppeteer / Playwright compatibility

Obscura's docs enumerate what works and what doesn't. Supported per
`docs/Connect-Puppeteer-or-Playwright.md:72-82`: `page.goto/reload/goBack/goForward`,
`evaluate/evaluateHandle`, `click/type/fill/focus`, `waitForSelector/waitForFunction/
waitForNavigation`, cookies, request interception (block/modify), `exposeFunction`,
`content/title/url`, plus `DOMSnapshot.captureSnapshot`, `Target.targetInfoChanged`, `DOM.focus` for
browser-use.

Explicitly not supported (`docs/Connect-Puppeteer-or-Playwright.md:84-89`,
`Use-with-Playwright.md:105-110`, `Use-with-Puppeteer.md:120-125`): `page.screenshot()`, `page.pdf()`,
`page.video()`/tracing, `page.emulate()` device emulation, service workers, per-page V8 isolation,
`BrowserContext` storage-state save/restore (use `--storage-dir`), and anti-bot bypass. Both clients
must use CDP connect (`puppeteer.connect` / `chromium.connectOverCDP`) — Playwright's native `connect`
protocol is not implemented (`Use-with-Playwright.md:18`).

Client requirement: Playwright's utility-world path drove the `Runtime` `contextId` validation and
per-isolated-world context id fixes (issues #51/#192, `runtime.rs:364-387`, `dispatch.rs:147-154`);
`headless_chrome`/older Puppeteer drove `Target.sendMessageToTarget` unwrapping
(`dispatch.rs:256-479`); browser-use drove `DOMSnapshot`/`Target.targetInfoChanged`/`DOM.focus`.

## 11. How the CDP layer connects to the rest of Obscura

`obscura-cdp` sits above `obscura-browser` (the `Page`/navigation/lifecycle types) and calls into
`obscura-js` (V8 via deno_core), `obscura-dom` (tree), and `obscura-net` (HTTP client, cookie jar)
(`Cargo.toml:7-20`, `docs/Architecture-overview.md:1-40`). `CdpContext` (`dispatch.rs:12-48`) owns the
pages, session→page map, pending events, preload scripts, isolated-world bookkeeping, and the fetch
interception state — it is the single mutable object every handler receives. The dispatcher/handlers
translate CDP semantics into calls on `obscura_browser::Page` (e.g. `navigate_with_wait`,
`evaluate_for_cdp`, `with_dom`), then re-serialize the results into CDP-shaped JSON. Adding a new method
is a two-step recipe (new handler fn + a `match` arm in `dispatch.rs`), documented at
`docs/Adding-a-CDP-method-or-Web-API.md:3-67`.

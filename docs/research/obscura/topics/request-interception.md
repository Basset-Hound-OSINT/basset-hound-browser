---
title: "Obscura Deep-Dive: Request Interception & Modification Pipeline"
date: 2026-07-03
researcher: Claude (automated repo-research agent)
status: Complete
category: architecture-research
---

# Obscura: Request Interception & Modification Pipeline

> Source of truth: `/home/devel/tmp/obscura` (Apache-2.0, https://github.com/h4ckf0r0day/obscura).
> Every claim below cites a file path plus a line/symbol. Where the code and the
> user-facing docs disagree, the code wins and the gap is called out.

## 1. Purpose & Scope

Obscura exposes request interception as a **Puppeteer/Playwright-compatible
capability driven over CDP** (`Fetch.enable` / `Fetch.continueRequest` /
`Fetch.fulfillRequest` / `Fetch.failRequest`) *and* as a **native Rust `Page`
API** (`enable_interception()`, `on_request`/`on_response`, `add_preload_script`)
for callers embedding the engine as a library.

The headline capabilities advertised in `docs/Intercept-and-modify-requests.md`
are: block by resource type, block by URL pattern, modify request headers,
return a fake response ("fulfill"), and a built-in tracker blocklist under
`--stealth` (`docs/Intercept-and-modify-requests.md:1`, `:120`).

The reality in the source is that interception is spread across **three layers
that are only partially connected**, and the single path that actually *pauses,
blocks, mocks, and rewrites* live requests only covers **JavaScript-initiated
`fetch()`/XHR**, not the top-level document navigation or its static
subresources. This document maps each layer and is explicit about the seams.

## 2. The three layers at a glance

| Layer | Crate / file | Mechanism | What it actually does |
|------|--------------|-----------|-----------------------|
| A. Native `RequestInterceptor` trait | `obscura-net/src/interceptor.rs`, consumed in `obscura-net/src/client.rs:429` | trait object stored on the HTTP client, checked before each navigation fetch | **Dead/vestigial** — the field is never assigned; always `None` |
| B. Passive callbacks + tracker blocklist | `obscura-net/src/client.rs` (`on_request`/`on_response`, `block_trackers`) + `obscura-net/src/blocklist.rs` | non-blocking observers; hostname blocklist | Observe requests/responses; drop tracker hosts when stealth is on |
| C. Active JS `fetch()`/XHR interception | `obscura-js/src/ops.rs` (`op_fetch_url`) ↔ `obscura-cdp/src/server.rs` + `obscura/src/page.rs` | oneshot-per-request over an mpsc channel | The **only** path that can block / fulfill / rewrite a live request |

The CDP `Fetch`/`Network` domain handlers (`obscura-cdp/src/domains/fetch.rs`,
`.../network.rs`) sit on top of layer C and translate Chrome-protocol messages
into layer-C resolutions.

## 3. Layer A — the native `RequestInterceptor` trait (vestigial)

`obscura-net/src/interceptor.rs` is the whole file — a four-variant action enum
and a one-method async trait:

```rust
// obscura-net/src/interceptor.rs:5
pub enum InterceptAction {
    Continue,
    Block,
    Fulfill(Response),
    ModifyHeaders(HashMap<String, String>),
}

#[async_trait::async_trait]
pub trait RequestInterceptor {
    async fn intercept(&self, request: &RequestInfo) -> InterceptAction;
}
```

It is consumed in the navigation fetch loop of `ObscuraHttpClient::fetch_with_method`:

```rust
// obscura-net/src/client.rs:429
if let Some(interceptor) = self.interceptor.read().await.as_ref() {
    match interceptor.intercept(&request_info).await {
        InterceptAction::Continue => {}
        InterceptAction::Block => return Err(ObscuraNetError::Blocked(current_url.to_string())),
        InterceptAction::Fulfill(response) => return Ok(response),
        InterceptAction::ModifyHeaders(headers) => {
            let mut extra = self.extra_headers.write().await;
            extra.extend(headers);
        }
    }
}
```

**Gap (verified):** the `interceptor` field
(`obscura-net/src/client.rs:264`) is initialized to `None`
(`obscura-net/src/client.rs:342`) and there is **no setter anywhere in the
workspace** — a repo-wide grep for assignments to `.interceptor` /
`set_interceptor` returns only the declaration, the init, and the read at line
429. So `InterceptAction`, `RequestInterceptor`, and its `Block`/`Fulfill`/
`ModifyHeaders` branches for document navigation are unreachable dead code. The
document-level "block/fulfill/modify-headers" capability the enum implies **does
not exist through any public API**. This is the most important finding: the type
that looks like the interception core is not wired to anything.

## 4. Layer B — passive callbacks and the tracker blocklist

### 4.1 Callback types

```rust
// obscura-net/src/client.rs:75
pub type RequestCallback  = Arc<dyn Fn(&RequestInfo) + Send + Sync>;
pub type ResponseCallback = Arc<dyn Fn(&RequestInfo, &Response) + Send + Sync>;
```

They live on the HTTP client as `on_request: RwLock<Vec<RequestCallback>>` and
`on_response: RwLock<Vec<ResponseCallback>>` (`obscura-net/src/client.rs:265`).

- **Navigation path** fires them in `fetch_with_method`: `on_request` before the
  request is sent (`obscura-net/src/client.rs:445`) and `on_response` after the
  body is read (`obscura-net/src/client.rs:591`).
- **JS `fetch()`/XHR path** fires the *same* vectors from inside `op_fetch_url`:
  `on_request` at `obscura-js/src/ops.rs:762` and `on_response` at
  `obscura-js/src/ops.rs:1008`. A code comment there notes these "previously
  fired only for navigation; this wires them for JS fetch()/XHR too"
  (`obscura-js/src/ops.rs:758`).

They are strictly observational — non-blocking, return nothing. The public
wrappers are `Page::on_request` / `Page::on_response`
(`obscura/src/page.rs:118`, `:125` → `obscura-browser/src/page.rs:1580`, `:1589`).
`RequestInfo` carries `url`, `method`, `headers`, and a `ResourceType`
(`Document | Script | Stylesheet | Image | Font | Xhr | Fetch | Other`,
`obscura-net/src/client.rs:63`). Note: JS-initiated requests are always tagged
`ResourceType::Fetch` (`obscura-js/src/ops.rs:770`, `:1016`); the code never
emits `Xhr`, confirmed by the doc's own caveat that `resource_type` "does not
yet split `Xhr` from `Fetch`" (`docs/Use-as-a-Rust-library.md`).

### 4.2 Tracker blocklist (`--stealth`)

`ObscuraHttpClient` has a `block_trackers: bool` flag
(`obscura-net/src/client.rs:269`). When set, navigation fetches short-circuit
blocked hosts to an empty `status: 0` response *before* the request goes out:

```rust
// obscura-net/src/client.rs:402
if self.block_trackers {
    if let Some(host) = url.host_str() {
        if crate::blocklist::is_blocked(host) {
            tracing::debug!("Blocked tracker: {}", url);
            return Ok(Response { status: 0, url: url.clone(), headers: HashMap::new(),
                                 body: Vec::new(), redirected_from: Vec::new() });
        }
    }
}
```

The flag is turned on only in stealth mode — `context.rs` sets
`client.block_trackers = true` when `stealth` (`obscura-browser/src/context.rs:106`),
matching the doc's "`--stealth` ships with a tracker blocklist"
(`docs/Intercept-and-modify-requests.md:120`).

The blocklist itself (`obscura-net/src/blocklist.rs`) is a `HashSet` compiled
once from an embedded `pgl_domains.txt` (`include_str!`,
`obscura-net/src/blocklist.rs:5`) of ~3,500+ domains
(`blocklist.rs:74` test asserts `> 3500`). `is_blocked` does exact-match plus a
parent-domain walk so `www.google-analytics.com` matches
`google-analytics.com` (`obscura-net/src/blocklist.rs:24`). `EXTRA_DOMAINS` is
an empty extension slot (`blocklist.rs:42`).

**Gap:** the tracker blocklist is checked **only on the navigation path**
(`client.rs:402`). `op_fetch_url` (JS `fetch()`/XHR) does **not** call
`blocklist::is_blocked`; it only honors the CDP `setBlockedURLs` glob list (see
§6.2). So a page's scripted analytics beacon is not stopped by the stealth
tracker blocklist unless its host also happens to be covered by an explicit
`Network.setBlockedURLs` pattern.

## 5. Layer C — active interception of JS `fetch()`/XHR (the real path)

This is the only mechanism that blocks/mocks/rewrites a *live* request. It is a
per-request handshake between the V8 op and whoever owns the receiver.

### 5.1 Data structures

```rust
// obscura-js/src/ops.rs:19
pub enum InterceptResolution {
    Continue { url: Option<String>, method: Option<String>,
               headers: Option<HashMap<String,String>>, body: Option<String> },
    Fulfill  { status: u16, headers: HashMap<String,String>, body: String },
    Fail     { reason: String },
}

// obscura-js/src/ops.rs:34
pub struct InterceptedRequest {
    pub request_id: String,
    pub url: String,
    pub method: String,
    pub headers: HashMap<String,String>,
    pub resource_type: String,
    pub resolver: tokio::sync::oneshot::Sender<InterceptResolution>,
}
```

The engine's global state (`ObscuraState`) holds the sender side and the enable
flag: `intercept_tx: Option<UnboundedSender<InterceptedRequest>>`,
`intercept_counter: u64`, `intercept_enabled: bool` (`obscura-js/src/ops.rs:66`).

### 5.2 The op that intercepts (`op_fetch_url`)

Every JS `fetch()`/XHR lowers to `op_fetch_url`. The interception decision:

1. **URL-block gate first.** Before anything, absolute-URL SSRF validation
   (`validate_fetch_url`, `ops.rs:610`), then the CDP `setBlockedURLs` glob list:
   any match returns a synthetic `{status:0, blocked:true}`
   (`obscura-js/src/ops.rs:626`).
2. **Arm interception** only when enabled, minting `intercept-{counter}` ids:

```rust
// obscura-js/src/ops.rs:648
let itx = if gs.intercept_enabled {
    gs.intercept_counter += 1;
    gs.intercept_tx.clone().map(|tx| (tx, format!("intercept-{}", gs.intercept_counter)))
} else { None };
```

3. **Send and block on the oneshot.** The op builds an `InterceptedRequest` with
   a fresh `oneshot`, sends it on the channel, and `.await`s the resolver
   (`obscura-js/src/ops.rs:664`–`709`):

```rust
if tx.send(intercepted).is_ok() {
    match resolve_rx.await {
        Ok(InterceptResolution::Fulfill { status, headers, body }) => return Ok(/* mocked JSON */),
        Ok(InterceptResolution::Fail { reason })                   => return Ok(/* {status:0,blocked:true,error} */),
        Ok(InterceptResolution::Continue { url, method, headers, body }) => { /* stash overrides */ }
        Err(_) => {}
    }
}
```

4. **Apply `Continue` overrides.** A URL rewrite is **re-validated through the
   SSRF/private-network gate** so a rewrite can't reach an internal address that
   the original couldn't (`obscura-js/src/ops.rs:718`). Method/headers/body
   overrides shadow the original (`ops.rs:734`).

`Fulfill` returns the mocked status/headers/body **without touching the
network** (`ops.rs:677`). `Fail` returns a blocked marker (`ops.rs:686`). Only
`Continue` proceeds to the real reqwest/stealth send.

### 5.3 The native `Page` API

`Page::enable_interception` wires a fresh unbounded channel and flips the flag,
returning the receiver to the caller:

```rust
// obscura-browser/src/page.rs:1567
pub fn enable_interception(&mut self)
    -> tokio::sync::mpsc::UnboundedReceiver<obscura_js::ops::InterceptedRequest> {
    let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<...>();
    self.set_intercept_tx(tx);   // pushes tx into ObscuraState if the runtime exists
    self.enable_intercept(true); // sets intercept_enabled on Page + runtime
    rx
}
```

`set_intercept_tx` / `enable_intercept` fan the settings into the live
`JsRuntime` if one exists (`obscura-browser/src/page.rs:1610`, `:1617`), and
`init_js` re-applies both when a runtime is (re)created — the comment at
`obscura-browser/src/page.rs:330` notes this is needed because
`enable_interception()` is often called before the first navigation, i.e. before
the runtime exists. The thin `obscura::Page` re-exports it verbatim
(`obscura/src/page.rs:108`).

The end-to-end test `crates/obscura/tests/interception.rs` exercises exactly this:
`page.enable_interception()`, a task that answers `Continue`
(`interception.rs:72`), and a second test that rewrites `/api` → `/modified` via
`Continue { url: Some(...) }` and asserts the body comes back `"REWRITTEN"`
(`interception.rs:112`). The passive `on_request`/`on_response` capture path is
asserted in the same file (`interception.rs:57`, `:64`).

## 6. CDP surface (Puppeteer/Playwright compatibility)

### 6.1 `Fetch` domain

`obscura-cdp/src/domains/fetch.rs` implements the Chrome `Fetch` domain. State
is `FetchInterceptState { enabled, patterns, paused: HashMap<String, PausedRequest>, request_counter }`
(`fetch.rs:33`).

- `Fetch.enable` records `urlPattern`s (defaulting to `["*"]`), flips
  `fetch_intercept.enabled`, and pushes the patterns onto the session page as
  `intercept_block_patterns`, wiring the intercept tx and calling
  `page.enable_intercept(true)` (`fetch.rs:63`–`91`).
- `Fetch.continueRequest` pulls the request's oneshot out of `paused` and sends
  `FetchResolution::Continue` with optional `url`/`method`/`postData` overrides
  (`fetch.rs:110`). **Note:** header overrides are dropped here — it always sends
  `headers: None` (`fetch.rs:120`).
- `Fetch.fulfillRequest` decodes `responseCode`/`responseHeaders`/`body` into
  `FetchResolution::Fulfill` (`fetch.rs:126`).
- `Fetch.failRequest` maps `errorReason` to `FetchResolution::Fail`
  (`fetch.rs:164`).
- `Fetch.getResponseBody` is a **stub** returning an empty body
  (`fetch.rs:181`).

Dispatch routes `"Fetch"` → `domains::fetch::handle`
(`obscura-cdp/src/dispatch.rs:336`).

### 6.2 `Network` domain

`obscura-cdp/src/domains/network.rs`:
- `Network.setRequestInterception` → **`Ok(json!({}))` no-op** (`network.rs:98`).
  Puppeteer's `page.setRequestInterception(true)` is accepted but does nothing on
  its own; the actual pausing comes from `Fetch.enable`.
- `Network.setBlockedURLs` stores glob patterns on the page as
  `blocked_url_patterns` (`network.rs:99`), which `op_fetch_url` and the browser
  page's `should_block_url` both consult.
- `Network.setExtraHTTPHeaders`, `setUserAgentOverride`, cookie CRUD, and
  `getResponseBody` (served from stored response bodies) round out the domain.
  `Network.getResponseBody` (unlike Fetch's) is real (`network.rs:120`).

### 6.3 The CDP server interception loop

`obscura-cdp/src/server.rs` owns the single `InterceptedRequest` channel for the
whole CDP session: `(itx, irx) = unbounded_channel(...)`, `ctx.intercept_tx = Some(itx)`
(`server.rs:355`). The receiver is drained only inside `process_with_interception`,
which is entered for `Page.navigate` messages (`server.rs:437`).

Inside that function's `tokio::select!` loop (`server.rs:622`):
- The navigation runs on a `spawn_local` task under a global V8 lock
  (`server.rs:579`, `obscura_js::v8_lock::global()`), because V8 allows only one
  entered Isolate per OS thread (extensive comments at `server.rs:546`, `:602`).
- When an `InterceptedRequest` arrives on `intercept_rx`, the server synthesizes
  **both** a `Network.requestWillBeSent` and a `Fetch.requestPaused` CDP event to
  the client, then stashes the resolver in `intercepted_paused`
  (`server.rs:638`–`685`).
- Client resolutions (`Fetch.continueRequest|fulfillRequest|failRequest`) are
  matched by `requestId` in `handle_fetch_resolution`, which fires the oneshot
  (`server.rs:460`, `:699`). Fulfill bodies are base64-decoded (`server.rs:480`).
- Any *other* CDP message that arrives mid-navigation is pushed to a `deferred`
  queue (cap `MAX_DEFERRED_MESSAGES = 256`, `server.rs:19`) and processed after
  the nav completes, to avoid re-entering V8 on another page and tripping
  `V8_Fatal` (`server.rs:688`–`718`).

### 6.4 Post-hoc `Fetch.requestPaused` for navigation subresources

Separately, after a navigation completes, `domains/page.rs` emits a
`Fetch.requestPaused` event for **each collected navigation `network_event`**
when `fetch_intercept.enabled` (`obscura-cdp/src/domains/page.rs:99`–`118`).

**Gap (important):** these navigation-level `requestPaused` events are emitted
*after the requests already happened* (they iterate `network_events`, which are
populated during the completed navigation) and their `request_id`s are **never
inserted into `intercepted_paused`** (that map is only populated by the live
`op_fetch_url` channel at `server.rs:685`). Consequently a client
`Fetch.continueRequest`/`fulfillRequest`/`failRequest` for a document or static
subresource finds no resolver in `handle_fetch_resolution` and **silently
no-ops**. Puppeteer/Playwright get request *visibility* for the main document
and its static assets, but **`abort()`/`respond()`/header-mods on those requests
do not take effect** — only JS-`fetch()`/XHR requests (which flow through the
live channel during navigation) are truly interceptable.

## 7. URL-pattern matching

Two independent but identical glob matchers exist:

- `obscura-js/src/ops.rs:1205` `glob_match` — used against `blocked_urls`
  (`setBlockedURLs`) in `op_fetch_url` (`ops.rs:627`).
- `obscura-browser/src/page.rs:1625` `url_matches_cdp_pattern` — used by
  `should_block_url` against `blocked_url_patterns` **and**
  `intercept_block_patterns` for the navigation path (`page.rs:238`–`252`).

Both split on `*`, require an anchored first segment unless the pattern starts
with `*`, and require the tail to reach end-of-string unless the pattern ends
with `*` (e.g. `*://*.gstatic.com/*.woff2` matches a woff2 but not a woff,
`page.rs:1657` tests). They are literal substring walks — no regex, no
`?` single-char wildcard, no query-aware matching. The two copies are duplicated
code, not shared.

## 8. Control flow: an intercepted navigation

```
Puppeteer                     obscura-cdp/server.rs               obscura-js/op_fetch_url
   |                                  |                                   |
   |-- Fetch.enable(patterns) ------->| domains/fetch::handle             |
   |                                  |  -> page.enable_intercept(true)   |
   |-- Page.navigate(url) ----------->| process_with_interception         |
   |                                  |  spawn_local(navigate) --V8 lock--|
   |                                  |                    (page scripts run)
   |                                  |                          JS fetch()/XHR
   |                                  |<----- InterceptedRequest ---------|  (awaits oneshot)
   |<-- Network.requestWillBeSent ----|                                   |
   |<-- Fetch.requestPaused ----------|  intercepted_paused.insert(id)    |
   |                                  |                                   |
   |-- Fetch.continueRequest/         |                                   |
   |   fulfillRequest/failRequest --->| handle_fetch_resolution           |
   |                                  |  -> oneshot.send(resolution) ---->|  (resumes; sends/mocks)
   |                                  |<------ nav_done -------------------|
   |<-- (deferred CDP msgs drained) --|                                   |
```

## 9. Notable design decisions

- **Interception is a per-request oneshot, not a callback.** The op parks on
  `resolve_rx.await` inside V8; the resolution arrives from a different task.
  This keeps the V8 op synchronous-looking while letting an external async
  consumer decide (`obscura-js/src/ops.rs:664`).
- **SSRF re-validation on rewrite and redirect.** A `Continue` URL rewrite and
  every 3xx hop are re-checked through `validate_fetch_url`
  (`ops.rs:718`, `:939`), and the navigation client uses a custom
  `SsrfGuardResolver` that rejects hostnames resolving to private IPs at DNS time
  (`obscura-net/src/client.rs:137`, `:147`). Interception cannot be used to
  bypass the SSRF policy. This directly references GHSA-8v6v-g4rh-jmcm in a
  comment (`ops.rs:846`).
- **Single global V8 lock around dispatch.** Because interception spawns a nav
  task while the parent keeps pumping CDP, the whole design is shaped by V8's
  one-Isolate-per-thread rule; the extensive comments (`server.rs:546`,
  `dispatch.rs:260`) treat this as the dominant constraint, converting potential
  aborts into latency.
- **Manual redirect following** in both the navigation client
  (`client.rs:557`, 20-hop cap) and `op_fetch_url` (`ops.rs:854`,
  `FETCH_REDIRECT_LIMIT`), with browser-correct 301/302/303 → GET downgrades
  (`client.rs:568`, `ops.rs:967`), specifically so the SSRF gate applies to every
  hop rather than trusting reqwest's auto-follow.
- **Stealth routing of scripted requests.** When the `stealth` feature is on,
  `op_fetch_url` re-routes the (possibly rewritten) request through the `wreq`
  client so its TLS fingerprint/client-hints match the navigation
  (`ops.rs:784`–`806`). Interception overrides are applied *before* this branch,
  so rewrites survive into stealth mode.

## 10. Limitations & coverage gaps

1. **No document-level interception.** The `RequestInterceptor`/`InterceptAction`
   trait (which alone models `Block`/`Fulfill`/`ModifyHeaders` for the main
   navigation) is never wired to a setter — dead code
   (`obscura-net/src/client.rs:264`, `:342`; no assignment exists). The active
   channel only fires from `op_fetch_url` (JS `fetch()`/XHR).
2. **Navigation/subresource `Fetch.requestPaused` is observe-only.** Those events
   are emitted post-hoc and their ids never enter `intercepted_paused`, so
   `continueRequest`/`fulfillRequest`/`failRequest` on them no-op
   (`domains/page.rs:99` vs. `server.rs:685`, `:471`). Puppeteer's
   canonical "block images/fonts by resourceType, abort()" recipe in
   `docs/Intercept-and-modify-requests.md:8` will therefore **not** block those
   static subresources — the doc oversells this.
3. **CDP header overrides on continue are dropped.** `Fetch.continueRequest`
   hard-codes `headers: None` (`domains/fetch.rs:120`), so the "modify headers"
   recipe (`docs/Intercept-and-modify-requests.md:52`) has no effect via the CDP
   path. Header rewriting works only through the **native** `InterceptResolution::Continue { headers: Some(...) }`
   (`ops.rs:696`, `:756`).
4. **`Fetch.getResponseBody` is a stub** (`domains/fetch.rs:181`) — response-stage
   interception / response bodies at the Fetch layer are unavailable
   (`Network.getResponseBody` works, but only for already-stored bodies).
5. **Tracker blocklist doesn't cover scripted requests.** `block_trackers` is
   navigation-only (`client.rs:402`); JS `fetch()` beacons to blocklisted hosts
   are not stopped unless separately globbed via `setBlockedURLs`.
6. **Interception is effectively navigation-scoped.** `intercept_rx` is drained
   only inside `process_with_interception`, entered for `Page.navigate`
   (`server.rs:437`). JS `fetch()` triggered *outside* an in-flight navigation
   (e.g. via a later `Runtime.evaluate`) sends an `InterceptedRequest` that no
   task is receiving, so its `resolve_rx.await` has no resolver to fire.
7. **`ResourceType` never distinguishes XHR from Fetch** for scripted requests
   (always `"Fetch"`, `ops.rs:672`), and resource-type-based blocking (the
   Puppeteer `resourceType()` recipe) has no server-side equivalent — matching is
   URL-glob only.
8. **Pattern matcher is a substring glob, duplicated twice**
   (`ops.rs:1205`, `page.rs:1625`) — no regex, no `?`, no query-string
   semantics; the two implementations can drift.
9. **No request body inspection on the CDP navigation path** and no
   `Fetch.continueWithAuth` / auth-challenge handling (absent from
   `domains/fetch.rs`).

## 11. How it connects to the rest of Obscura

- **`obscura-net`** owns the HTTP client (`ObscuraHttpClient`), the passive
  callback vectors, the SSRF guard, and the tracker blocklist — the navigation
  transport. The interceptor trait lives here but is unused.
- **`obscura-js`** (`op_fetch_url`) is where scripted `fetch()`/XHR is executed
  and where the *only* live interception handshake happens; it also fires the
  passive callbacks for scripted requests and threads the proxy through
  (`ops.rs:646`, #139).
- **`obscura-browser`** (`Page`) glues the two: it owns `intercept_enabled` /
  `intercept_tx` / `intercept_block_patterns` / `blocked_url_patterns`, exposes
  `enable_interception`/`on_request`/`on_response`/`add_preload_script`, and
  re-applies interception state whenever the JS runtime is (re)built
  (`page.rs:327`–`334`).
- **`obscura-cdp`** translates Chrome-protocol `Fetch`/`Network` messages into
  layer-C resolutions and manages the V8-safe navigation/interception select loop
  (`server.rs`, `domains/fetch.rs`, `domains/network.rs`).
- **`obscura`** is the thin public façade re-exporting `InterceptedRequest`,
  `InterceptResolution`, `RequestInfo`, `ResourceType`, `Response`, and the
  callback aliases (`obscura/src/lib.rs:31`) plus the `Page` methods
  (`obscura/src/page.rs`).

**Comparison note for Basset Hound:** Obscura's interception is Puppeteer-shaped
but shallower than it looks — reliable request *modification* (block/mock/rewrite)
exists only for JS-initiated `fetch()`/XHR through the native channel, while the
CDP-facing navigation/subresource interception is largely observational and drops
header overrides. Basset Hound's WebSocket-command model (request interception,
header modification, custom block rules) targets the full request surface,
whereas Obscura leans on its stealth tracker blocklist and per-request JS
interception rather than a general request-rewriting engine.

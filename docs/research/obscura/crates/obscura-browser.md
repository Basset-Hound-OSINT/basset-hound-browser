---
title: "Obscura Deep-Dive: obscura-browser (Page lifecycle, tab/context model, navigation orchestration)"
date: 2026-07-03
researcher: Claude (Basset Hound architecture research)
status: Complete
category: reverse-engineering / architecture-comparison
---

# obscura-browser

Reverse-engineering deep-dive of the `obscura-browser` crate in the Apache-2.0
headless browser **Obscura** (https://github.com/h4ckf0r0day/obscura). Source read
on disk at `/home/devel/tmp/obscura/crates/obscura-browser`. Every claim below cites
a specific file and line/symbol. Where behaviour is orchestrated by the layer above
(the CDP server), those files are cited too, since the "browser/page lifecycle
orchestration" story only makes sense across the `obscura-browser` <-> `obscura-cdp`
seam.

---

## 1. Purpose and place in the workspace

`obscura-browser` is the crate that owns the **`Page`** — the runtime object that ties
together a fetched document, its DOM, and its JavaScript realm, and drives it through a
navigation lifecycle. Per the workspace's own architecture doc it is described as the
"Page type, navigation, lifecycle events" layer
(`docs/Architecture-overview.md:6`).

It sits in the middle of the dependency stack. Its `Cargo.toml` depends on the three
"content" crates and nothing sideways:

- `obscura-dom` (DOM tree + HTML parse),
- `obscura-net` (HTTP client, cookie jar, robots cache),
- `obscura-js` (V8-via-`deno_core` runtime)

(`crates/obscura-browser/Cargo.toml:11-13`). It has **no** dependency on `obscura-cdp`
or `obscura-mcp` — the wiring goes the other way: `obscura-cdp`, `obscura-mcp`,
`obscura-cli`, and the embeddable `obscura` crate all depend on `obscura-browser`
(`crates/{obscura-cdp,obscura,obscura-cli,obscura-mcp}/Cargo.toml`). This enforces the
workspace convention "Cross-crate calls go through the layer above, not sideways"
(`docs/Architecture-overview.md:108`).

The crate is small: five source files totalling ~2,100 lines, of which `page.rs` is
1,737 (`crates/obscura-browser/src/`). The public surface is re-exported from `lib.rs`:
`Page`, `PageError`, `NetworkEvent`, `BrowserContext`, `LifecycleState`, `WaitUntil`,
plus a re-export of `obscura_js::HTML_TO_MARKDOWN_JS` and the interception channel types
`InterceptResolution` / `InterceptedRequest` (`crates/obscura-browser/src/lib.rs:1-12`).
The re-export of the interception types is deliberate so the embeddable `obscura` crate,
which depends on `obscura-browser` but not `obscura-js`, can surface them
(`crates/obscura-browser/src/lib.rs:10-12`).

### Module map

| File | Lines | Responsibility |
|------|------:|----------------|
| `src/lib.rs` | 12 | Module declarations + public re-exports |
| `src/lifecycle.rs` | 42 | `LifecycleState` and `WaitUntil` enums |
| `src/profiles.rs` | 103 | Static table of Chrome UA/platform profiles + selection policy |
| `src/context.rs` | 207 | `BrowserContext`: shared per-session state (cookies, HTTP client, UA, security gates) |
| `src/page.rs` | 1,737 | `Page`: the tab. Navigation, script execution, lifecycle, history, network capture, JS eval bridge |

---

## 2. Data structures

### 2.1 `Page` — the tab

Defined at `crates/obscura-browser/src/page.rs:149-184`. The load-bearing fields:

```rust
pub struct Page {
    pub id: String,
    pub frame_id: String,
    pub url: Option<Url>,
    pub dom: Option<DomTree>,
    pub js: Option<ObscuraJsRuntime>,
    pub lifecycle: LifecycleState,
    pub http_client: Arc<ObscuraHttpClient>,
    pub context: Arc<BrowserContext>,
    pub title: String,
    pub encoding: String,
    pub history: Vec<String>,
    pub history_index: usize,
    pub network_events: Vec<NetworkEvent>,
    response_bodies: HashMap<String, StoredResponseBody>,
    response_body_order: VecDeque<String>,
    network_event_counter: u32,
    pub intercept_enabled: bool,
    pub intercept_block_patterns: Vec<String>,
    pub blocked_url_patterns: Vec<String>,
    intercept_tx: Option<UnboundedSender<InterceptedRequest>>,
    preload_scripts: Vec<String>,
    #[cfg(feature = "stealth")]
    pub stealth_client: Option<Arc<StealthHttpClient>>,
}
```

Key observations:

- **`dom` and `js` are both `Option`, and they are mutually exclusive in practice.**
  Before the JS realm is initialised the DOM lives in `Page.dom`; once `init_js()` runs,
  the `DomTree` is **moved into** the runtime via `rt.set_dom(dom)`
  (`page.rs:336-338`), leaving `Page.dom = None`. `with_dom()` reflects this: it prefers
  the runtime's copy and only falls back to `self.dom` when there is no live JS
  (`page.rs:1222-1227`). So "the DOM" has two possible owners and the `Page` routes reads
  to whichever holds it.

- **`http_client` is cloned from the context** (`page.rs:188`), so every page in a
  session shares one `ObscuraHttpClient` (and therefore one cookie jar / connection pool).

- **`frame_id == id`.** The comment (`page.rs:189-194`) explains this is the Chromium
  convention "the main frame's frameId == the targetId", and that Playwright's frame
  manager looks up the main frame by targetId; any divergence makes `Page.getFrameTree`
  return an unmatchable frame and triggers "Frame has been detached".

- **There is exactly one frame per page.** There is no child-frame / iframe frame tree in
  this struct. `<iframe src>` elements are handled by a JS shim (`_loadIframeSrc`,
  `page.rs:1117-1120`) rather than by spawning a real sub-`Page`. See §8 (gaps).

### 2.2 `BrowserContext` — the shared session

Defined at `crates/obscura-browser/src/context.rs:6-33`. This is Obscura's analogue of a
Chromium `BrowserContext` (an incognito-profile-like container), but in practice there is
usually **one**. It owns:

- `cookie_jar: Arc<CookieJar>` and `http_client: Arc<ObscuraHttpClient>` (shared across all
  pages created from this context),
- identity fields `user_agent`, `platform`, `ua_platform`, `ua_platform_version`,
- `proxy_url`, `robots_cache`, `obey_robots`, `stealth`,
- three **security gates**: `allow_file_access` (`context.rs:18-25`), `storage_dir`, and
  `allow_private_network` (`context.rs:27-32`).

The two security gates are documented as covering *different* threat models:
`allow_file_access` guards CDP-driven navigation to `file://` (so a remote CDP client
"cannot point the browser at /etc/shadow even if Obscura is running as a privileged
user"), while `allow_private_network` is the broader SSRF gate for
localhost/RFC1918/link-local addresses (`context.rs:18-32`). Both default to `false`
(`context.rs:133,135`).

`BrowserContext::_new_inner` (`context.rs:75-137`) is the single real constructor behind a
fan of convenience wrappers (`new`, `with_storage`, `with_storage_full`,
`with_storage_and_network`, `with_full_options`, `with_options`, `with_proxy`). On
construction it:

1. Creates the cookie jar and, if `storage_dir` is set, **loads `cookies.json` from disk**
   (`context.rs:83-99`).
2. Builds the HTTP client with proxy + private-network options; enables tracker blocking
   when `stealth` (`context.rs:101-108`).
3. Selects a browser profile and resolves the effective UA (caller override else profile
   default), then **synchronously seeds the HTTP client's UA** via `try_write` so
   navigation requests pick it up before any async setup runs (`context.rs:109-119`).

`save_cookies()` (`context.rs:158-168`) is the write side — it persists `cookies.json` and
is documented as "Called during graceful shutdown." Note this crate **only** persists
cookies; the localStorage persistence mentioned in the architecture doc
(`docs/Architecture-overview.md:100`) lives elsewhere, not in `obscura-browser`.

### 2.3 `LifecycleState` and `WaitUntil`

`crates/obscura-browser/src/lifecycle.rs`. `LifecycleState` is a 6-variant enum:
`Idle, Loading, DomContentLoaded, Loaded, NetworkIdle, Failed` (`lifecycle.rs:1-9`), with
helpers `is_loading` / `is_loaded` / `is_network_idle` (`lifecycle.rs:11-23`). Note
`is_loaded()` treats both `Loaded` and `NetworkIdle` as loaded (`lifecycle.rs:16-18`).

`WaitUntil` (`lifecycle.rs:25-31`) is the client-requested completion level:
`Load, DomContentLoaded, NetworkIdle0, NetworkIdle2`. `from_str` (`lifecycle.rs:33-42`)
maps CDP/Puppeteer strings, and crucially the **default (unknown string) is `Load`**
(`lifecycle.rs:39`) — note it treats `"networkidle"`/`"networkIdle"` as `NetworkIdle0`
(`lifecycle.rs:37`).

### 2.4 `NetworkEvent` / `StoredResponseBody`

`NetworkEvent` (`page.rs:130-141`) is the per-request record Obscura keeps so it can
replay CDP `Network.*` events to a client after a navigation completes (it is a *record*,
not a live stream — see §5). `response_headers` is an `Arc<HashMap>` to avoid cloning
headers per consumer. `StoredResponseBody` (`page.rs:143-147`) is the captured body plus a
`base64_encoded` flag.

### 2.5 `BrowserProfile`

`crates/obscura-browser/src/profiles.rs:1-6`. A static table of **8** Chrome profiles
(`profiles.rs:8-57`) — Windows and macOS, Chrome 143–146. Each carries a UA string plus
the matching `navigator.platform` and UA-CH platform/version. `select_profile()`
(`profiles.rs:76-91`) defaults to **`PROFILES[0]` (a single stable Windows/Chrome 143
identity)**; `OBSCURA_PROFILE=<idx>` pins one and `OBSCURA_ROTATE_PROFILE=1` picks a random
one per context. The comment is explicit about *why rotation is opt-in*: "Cycling through
different browser identities from one address is itself a bot signal ... and the rotated
profile does not yet carry a matching TLS or timezone fingerprint" (`profiles.rs:68-75`).
`random_profile()` seeds off `SystemTime` nanoseconds rather than a real RNG
(`profiles.rs:59-66`).

---

## 3. The tab / context model (how many "tabs" exist and where they live)

**`obscura-browser` does not own a collection of tabs.** A `Page` is a standalone object;
there is no `Browser`/`Tabs`/`TargetManager` type inside this crate. The tab collection
lives one layer up, in `obscura-cdp`'s `CdpContext`:

```rust
pub struct CdpContext {
    pub pages: Vec<Page>,
    pub sessions: HashMap<String, String>, // session_id -> page_id
    ...
    pub default_context: Arc<BrowserContext>,
    page_counter: u32,
    ...
}
```

(`crates/obscura-cdp/src/dispatch.rs:12-48`). So:

- **Tabs = `CdpContext.pages: Vec<Page>`.** Created by `CdpContext::create_page()`
  (`dispatch.rs:156-163`), which mints `page-N`, constructs `Page::new(id,
  default_context.clone())`, calls `navigate_blank()`, and pushes it. Every page shares the
  **one** `default_context` (`dispatch.rs:159`) — Obscura effectively models a single
  browser context (the `isolated_worlds` comment even says "for now we only model a single
  page in CdpContext anyway", `dispatch.rs:25-26`, though `pages` is a real `Vec`).

- **Sessions → pages.** A CDP session id is `"{targetId}-session"` and
  `CdpContext.sessions` maps it to a `page_id`. Target creation
  (`crates/obscura-cdp/src/domains/target.rs:60-123`) makes the page, forms the session id
  `format!("{}-session", page_id)` (`target.rs:74`), navigates it, records the mapping
  (`target.rs:84`), and emits `Target.targetCreated` + `Target.attachedToTarget`
  (`target.rs:86-120`). This matches the architecture doc: session IDs are
  `"{targetId}-session"` and the dispatcher routes by `sessionId`
  (`docs/Architecture-overview.md:82-86`).

- **Routing.** `get_session_page` / `get_session_page_mut` resolve a `session_id ->
  page_id -> &Page` (`dispatch.rs:178-206`). This is the choke point that implements the
  single-isolate suspend/resume dance (see §4.2).

### The single-live-runtime rule

`get_session_page_mut` (`dispatch.rs:185-206`) enforces something subtle: **at most one
page holds a live `ObscuraJsRuntime` (V8 realm) at a time.** When a session's target page
has no live JS (`!target_has_js`), it walks the other pages, finds the first one with a
live runtime and calls `page.suspend_js()`, then `target.resume_js()`
(`dispatch.rs:191-203`). `suspend_js()` pulls the `DomTree` back out of the runtime into
`Page.dom` and drops the runtime (`page.rs:1509-1516`); `resume_js()` re-runs `init_js()`
(`page.rs:1518-1523`). So switching CDP focus between tabs tears down and rebuilds V8
realms. This is a direct consequence of the single-isolate design (§4).

---

## 4. The single-V8-isolate-per-process model

This is the defining architectural constraint and `obscura-browser` is written around it.

### 4.1 One isolate, one thread, a global lock

Each `Page` owns its own `ObscuraJsRuntime` (`page.rs:154`), and each runtime wraps its own
`deno_core::JsRuntime` / V8 isolate (`crates/obscura-js/src/runtime.rs:27-36`). But V8's
invariant is that only one isolate may be *entered* on a given OS thread at a time, and
Obscura runs **every** runtime on a **single** OS thread via a tokio `LocalSet` +
`spawn_local` (`crates/obscura-js/src/v8_lock.rs:1-17`). The moment two pages' V8-touching
futures interleave across an `.await`, V8 trips
`heap->isolate() == Isolate::TryGetCurrent()` and `abort(3)`s the whole process — no Rust
panic (`v8_lock.rs:6-11`; the same failure is described in `dispatch.rs:260-278`).

The fix is a process-wide async mutex `obscura_js::v8_lock::global()` — a
`tokio::sync::Mutex<()>` behind a `OnceLock` (`v8_lock.rs:19-27`). Any block that runs JS
must hold it. The CDP dispatcher acquires it around the *entire* dispatch of a command
unless the method is on an audited "V8-free" allowlist (`dispatch.rs:289-293`,
`is_v8_free_method` `dispatch.rs:216-249`). The architecture doc states this plainly: "All
pages in a process share one V8 isolate. The isolate is single-threaded by design"
(`docs/Architecture-overview.md:44-58`).

`obscura-browser` itself does **not** acquire this lock — it assumes the caller holds it.
Its synchronous eval methods (`evaluate`, `page.rs:1276`) call into
`ObscuraJsRuntime::evaluate` directly, and the crate's doc comments repeatedly reference
"the process-wide V8 lock" as something the dispatcher owns
(e.g. `page.rs:786-796`, `page.rs:1239-1245`). This is why the crate's async navigation
functions are safe to `.await` inside the lock: they hold the thread's V8 access for the
duration.

Because the `DomTree` is `RefCell`-based (`crates/obscura-dom/src/tree.rs:137-146`) and the
runtime state is `Rc<RefCell<..>>`, `Page` is `!Send` — which is exactly why the whole
system runs on a `LocalSet` (`docs/Architecture-overview.md:109`).

### 4.2 Why navigation is spawned-and-deferred

Holding the V8 lock across a whole handler serialises everything, so a multi-second
navigation would wedge every other session. The CDP server routes `Page.navigate`
specially: `server.rs` detects `is_navigation` (`crates/obscura-cdp/src/server.rs:435`) and
sends it through `process_with_interception` (`server.rs:438,504`), which **spawns the
navigation onto the `LocalSet`** in its own task holding the lock
(`server.rs:576-596`) and `select!`s on a `nav_done` channel (`server.rs:626-628`) so the
dispatcher can keep handling other CDP frames while the navigation runs. The architecture
doc summarises: "each `newPage` returns immediately while the actual navigation runs in a
spawned task" (`docs/Architecture-overview.md:55-57`).

### 4.3 Watchdogs: bounding synchronous V8

`tokio::time::timeout` cannot preempt synchronous V8 (a JS busy-loop pins the thread), so
`obscura-browser` leans on `obscura-js`'s termination watchdog. Every long-running phase in
`page.rs` is wrapped:

- **Whole script-execution phase**: `exec_wd = js.arm_watchdog(script_deadline_ms + 1000)`
  before running scripts, disarmed at the end (`page.rs:387-390`, `page.rs:758-762`). The
  comment explains inline scripts "run back-to-back with no await between them," so only a
  watchdog that terminates the isolate can interrupt a busy-loop hang
  (`page.rs:382-390`).
- **Post-script settle loop**: guarded by `settle_wd = js.arm_watchdog(750ms)` over a 500ms
  wall-clock deadline (`page.rs:725-756`). The long comment documents the exact bug this
  fixes: a steady stream of in-flight XHR kept the loop in its `Ok(Ok(()))` arm sleeping
  1ms without ever checking the clock, holding the V8 lock for tens of seconds
  (`page.rs:712-724`).
- **Network-idle wait**: `netidle_wd = js.arm_watchdog(5500ms)` over a 5s deadline
  (`page.rs:1159-1200`).
- **Whole navigation**: a hard `OBSCURA_NAV_TIMEOUT_MS` (default 30,000) tokio timeout wraps
  the entire `navigate_with_wait_post_inner`; on expiry the lifecycle goes `Failed` and a
  `NetworkError` is returned (`page.rs:792-811`).

Above `obscura-browser`, the dispatcher adds a **per-command** watchdog via
`page.isolate_handle()` → `cdp_watchdog::arm(...)` (`dispatch.rs:308-314`,
`page.rs:1243-1245`), and clears any resulting termination with
`page.cancel_v8_termination()` (`dispatch.rs:363-364`, `page.rs:1249-1253`). So a runaway
page can be force-terminated at the isolate level without killing the process.

---

## 5. Navigation control flow (the heart of the crate)

The public entry points form a small funnel:

```
navigate(url)                       page.rs:765-767
  └─ navigate_with_wait(url, Load)  page.rs:769-775
       └─ navigate_with_wait_post(url, wait, method, body)   page.rs:777-816   [timeout + history]
            └─ navigate_with_wait_post_inner(...)            page.rs:862-906   [JS-redirect chain]
                 └─ navigate_single(...)                     page.rs:908-1205  [one hop]
```

### 5.1 `navigate_with_wait_post` — the outer wrapper

`page.rs:777-816`. Two responsibilities: (1) impose the `OBSCURA_NAV_TIMEOUT_MS` hard
ceiling around the whole thing (`page.rs:792-811`), and (2) on success push the final URL
into history (`page.rs:812-814`).

### 5.2 `navigate_with_wait_post_inner` — the JS-redirect chain

`page.rs:862-906`. Loops up to `REDIRECT_LIMIT = 10` (`page.rs:872`). Each iteration runs
`navigate_single`, then checks `take_pending_navigation()` — a URL the page's JS queued via
`location.href =`, `location.replace`, form submit, etc. (the queue is set by `op` code in
`obscura-js`; `pending_navigation` is populated at `crates/obscura-js/src/ops.rs:1347` and
drained by `runtime.take_pending_navigation()` `runtime.rs:186-188`). If a next hop exists,
it becomes the current URL and the loop continues. Two guards:

- **Cross-scheme→file SOP gate** (`page.rs:876-889`): if the pending nav would step from a
  non-`file:` scheme into a `file:` URL, it is blocked. `cross_scheme_to_file`
  (`page.rs:77-87`) exists because "the existing realm survives the navigation and can read
  the new document's body" (`page.rs:74-76`) — so an http page could otherwise
  `location.href = "file://..."` and harvest a local file.
- **Redirect-storm cap** (`page.rs:894-900`): hitting the limit while the page still wants
  to chain returns `PageError::TooManyRedirects(10)` rather than a misleading `Ok(())`.

### 5.3 `navigate_single` — one navigation hop

`crates/obscura-browser/src/page.rs:908-1205`. This is the real orchestration. In order:

1. **Parse + reset** (`page.rs:915-919`): parse the URL (`InvalidUrl` on failure), set
   `lifecycle = Loading`, set `self.url`, and **clear `network_events`** (each hop starts a
   fresh network log).

2. **robots.txt** (`page.rs:921-947`): only if `context.obey_robots`. Fetches and caches
   `/robots.txt` via `robots_cache`, then blocks with a `NetworkError("Blocked by
   robots.txt...")` if disallowed. Note `obey_robots` defaults to `false`
   (`context.rs:130`), so this is off unless explicitly enabled.

3. **`about:` short-circuit** (`page.rs:949-965`): calls `navigate_blank()`, `init_js()`,
   then runs the preload scripts and returns early. The comment notes preloads must run on
   `about:blank` too because "puppeteer's `browser.newPage()` lands on about:blank and a
   follow-up `exposeFunction` is unusable otherwise" (`page.rs:952-955`).

4. **Fetch the main resource** (`page.rs:967-985`):
   - `data:` URIs are decoded locally, no network (`page.rs:967-977`; `decode_data_uri`
     `page.rs:28-39`).
   - `POST` goes through `http_client.post_form` (`page.rs:978-979`).
   - Everything else through `do_fetch` (`page.rs:981`), which prefers the stealth client
     when present (`do_fetch` `page.rs:254-260`).
   - On error, lifecycle → `Failed` and a `NetworkError` is returned (`page.rs:982-985`).

5. **Record the document response** (`page.rs:987-999`): stores the main resource as a
   `NetworkEvent` + body; binary content types are stored base64 so
   `Network.getResponseBody` returns intact bytes (`is_text_like_content_type`
   `page.rs:1705-1723`, issue #340). If the response was redirected, `self.url` is updated to
   the final URL (`page.rs:1001-1003`).

6. **Charset decode + parse** (`page.rs:1005-1012`): `decode_response_with_name` picks the
   encoding (HTTP `Content-Type` → `<meta charset>` sniff → UTF-8 fallback), stored in
   `self.encoding`; then `parse_html(&body_text)` builds the `DomTree`
   (`obscura_dom::parse_html`). Title is read via `query_selector("title")`
   (`page.rs:1014-1019`).

7. **Fetch stylesheets** (`page.rs:1021-1095`): collect `<link rel=stylesheet>` hrefs,
   resolve them, apply the `subresource_allowed` scheme gate (`page.rs:1049-1056`) and the
   interception block list (`page.rs:1057-1060`), then fetch with a **concurrency cap of 16**
   via `buffer_unordered(16)` (`page.rs:1082-1085`). CSS is decoded and each stylesheet
   recorded as a `Stylesheet` network event.

8. **Hand DOM to JS** (`page.rs:1097-1098`): `self.dom = Some(dom); self.init_js();`. From
   here the DOM lives inside the runtime.

9. **Inject CSS + iframe shim** (`page.rs:1100-1120`): combined CSS is exposed as
   `globalThis.__obscura_css` (escaped via `escape_for_js_template_literal`,
   `page.rs:110-128`, which the comment notes was hardened against U+2028/U+2029 template
   breakout, `page.rs:1106-1112`); then a shim calls `_loadIframeSrc` on each `<iframe
   src>` (`page.rs:1117-1120`).

10. **Execute scripts** (`page.rs:1128`): `self.execute_scripts().await` — see §6. Then
    `lifecycle = DomContentLoaded` (`page.rs:1130`). **If `wait_until ==
    DomContentLoaded`, return here** (`page.rs:1132-1134`).

11. **Load level** (`page.rs:1136-1144`): re-read `document.title` from the live realm (SPA
    frameworks often set it in script), then `lifecycle = Loaded`.

12. **Network-idle level** (`page.rs:1146-1202`): only for `NetworkIdle0`/`NetworkIdle2`.
    `threshold` is 0 or 2 in-flight requests (`page.rs:1150-1154`). Loops pumping the JS
    event loop (50ms slices) until `active_requests() <= threshold` for a sustained 500ms,
    or a 5s deadline (`page.rs:1166-1194`), watchdog-guarded, then `lifecycle =
    NetworkIdle`.

So the lifecycle string sequence a client sees —
`init → commit → domcontentloaded → load → networkidle2 → networkidle0`
(`docs/Architecture-overview.md:92-94`) — is *emitted* by the CDP layer (§7), but the
*state transitions that back it* happen in `navigate_single` at lines 917, 1130, 1144, 1201.

### 5.4 `navigate_blank` and history

`navigate_blank()` (`page.rs:1207-1213`) sets `about:blank`, an empty parsed DOM, and
`lifecycle = Loaded` with **no** JS runtime (`self.js = None`). History is a flat
`Vec<String>` + cursor. `push_history` (`page.rs:841-852`) truncates forward entries past
the cursor on a new navigation (matching Chrome's "navigating after goBack clobbers forward
history") and dedupes consecutive entries so `Page.reload` doesn't pile up.
`set_history_index` (`page.rs:856-860`) moves the cursor without navigating, used by
`Page.navigateToHistoryEntry`.

---

## 6. Script execution (`execute_scripts`)

`crates/obscura-browser/src/page.rs:366-763`. This is where Obscura decides *which* scripts
run and *in what order* — a from-scratch reimplementation of a slice of the HTML spec's
script model.

- **Discovery + classification** (`page.rs:402-466`): query all `<script>`, skip
  non-JS `type`s (only empty, `text/javascript`, `application/javascript`, `module` are
  kept, `page.rs:416-422`), then bucket into `regular`, `deferred`, `async_scripts`, and
  `module_scripts`.
- **Execution order** (`page.rs:468-474`): `regular → deferred → async` are chained into one
  `all_to_execute` list; modules are handled separately afterwards. (This is an
  approximation — `async` is simply run last rather than truly out-of-order.)
- **Parallel fetch of external `src`** (`page.rs:511-581`): builds fetch futures,
  `data:` scripts decoded inline (Instagram/Meta bootstrap depend on this, `page.rs:517-540`),
  bounded by `buffer_unordered(16)` (`page.rs:558-559`) and a `timeout_at(script_deadline)`
  (`page.rs:560-571`).
- **readyState + preloads** (`page.rs:583-602`): sets `__documentReadyState__ = 'loading'`,
  then runs the CDP `addScriptToEvaluateOnNewDocument` **preload sources before any page
  script** (`page.rs:590-602`) — the comment notes this is where Puppeteer's `exposeFunction`
  wrapper installs itself.
- **Serial execute with `__currentScriptNid`** (`page.rs:604-633`): each script runs guarded
  (`execute_script_guarded`), bracketed by setting/clearing `globalThis.__currentScriptNid`
  so `document.currentScript` works. A per-script deadline check breaks out early
  (`page.rs:605-611`).
- **ES modules with an adaptive budget** (`page.rs:635-698`): `module_budget_ms` is **3,000ms
  for an already-rendered page** (body has >50 descendant nodes) but the **full script
  deadline for an unmounted SPA shell** (`page.rs:641-662`). The comment explains: a rendered
  body means modules are enhancement, but "A page whose body is still an empty shell IS the
  SPA (issue #205)". Modules load via `js.load_module` / `js.load_inline_module`.
- **DCL/load events** (`page.rs:700-710`): drives readyState `interactive`, dispatches
  `DOMContentLoaded` on document+window, calls `window.onload`, then readyState `complete`
  and dispatches `load` — all inside one `execute_script` block.
- **Settle loop** (`page.rs:712-757`): the watchdog-guarded 500ms drain described in §4.3.

The header comment on the DCL path (`page.rs:1122-1127`) captures the design intent:
scripts run **regardless of `waitUntil`**, and "DCL means 'DOM parsed AND scripts
executed'" — an earlier version skipped scripts on the DCL path and silently dropped every
inline `<script>`.

---

## 7. How the CDP layer turns state into events

`obscura-browser` produces **state** (`lifecycle`, `network_events`, `title`, `url`); it
emits **no CDP events itself**. The translation happens in
`crates/obscura-cdp/src/domains/page.rs::emit_navigation_events` (`page.rs:12-177`), which
after `do_navigate` (`page.rs:215-...`) reads the page's `network_events` and lifecycle and
pushes the full CDP event storm in Chrome's exact ordering:

- `Page.lifecycleEvent{init}` → `Runtime.executionContextsCleared` → `Page.frameNavigated`
  → `Runtime.executionContextCreated` (id 2) → per-isolated-world contexts →
  `lifecycleEvent{commit}` (`domains/page.rs:76-97`).
- `Network.requestWillBeSent` for the main doc **before** `frameNavigated`
  (`domains/page.rs:64-74`, issue #190), then `responseReceived`/`loadingFinished` per
  recorded event (`domains/page.rs:120-139`).
- `lifecycleEvent{DOMContentLoaded, load}`, `domContentEventFired`, `loadEventFired`,
  conditionally `lifecycleEvent{networkIdle}`, `frameStoppedLoading`
  (`domains/page.rs:141-151`), and finally `Target.targetInfoChanged` so clients refresh the
  cached URL/title (`domains/page.rs:154-176`).

A load-bearing convention implemented here (not in `obscura-browser`): the main document's
CDP `requestId` is reported as the navigation's **`loaderId`** (Chrome's `requestId ==
loaderId` for `type == "Document"`, `domains/page.rs:26-39`). To make
`Network.getResponseBody(loaderId)` resolve, the CDP layer calls
`page.alias_response_body(internal_id, loader_id)` (`domains/page.rs:57-62`) — the alias
method itself lives in this crate (`page.rs:1483-1491`).

---

## 8. Interception, network capture, and callbacks

- **Response-body buffer** (`page.rs:1445-1499`): bounded LRU. Default 128 entries /
  2 MiB per entry (`response_body_entry_limit` `page.rs:1725-1730`,
  `response_body_byte_limit` `page.rs:1732-1737`), tunable via
  `OBSCURA_NETWORK_BODY_BUFFER_ENTRIES` / `_BYTES`. Bodies over the byte cap are dropped
  (`page.rs:1448-1450`). `get_response_body` falls back to the JS runtime's own
  fetch/XHR body store (`page.rs:1465-1474`).
- **URL-pattern blocking** (`should_block_url` `page.rs:238-252`; `url_matches_cdp_pattern`
  `page.rs:1625-1650`): a hand-rolled `*`-glob matcher (unit-tested at
  `page.rs:1656-1678`) covering both `blocked_url_patterns` and, when interception is on,
  `intercept_block_patterns`.
- **fetch()/XHR interception** (`page.rs:1562-1622`): `enable_interception` returns an
  `UnboundedReceiver<InterceptedRequest>` (`page.rs:1567-1575`); each item is resolved by the
  caller with `Continue`/`Fulfill`/`Fail`. The channel is threaded into the runtime by
  `init_js` (`page.rs:327-334`) so it survives navigation. `intercept_enabled` is
  re-applied to each new runtime because it may have been set before the first runtime
  existed (`page.rs:330-334`).
- **Passive callbacks** (`page.rs:1580-1593`): `on_request` / `on_response` push callbacks
  onto the shared HTTP client — "The main path for crawlers that need to capture API
  response payloads."

---

## 9. The JS-eval bridge (CDP `Runtime.*` surface)

`obscura-browser` exposes the eval surface the CDP `Runtime` domain needs, all delegating to
`ObscuraJsRuntime`:

- `evaluate(expr) -> serde_json::Value` (`page.rs:1276-1294`) — synchronous; when there is
  **no** live JS runtime it answers a tiny hardcoded set (`document.title`, `document.URL`,
  location href) from Rust fields (`page.rs:1286-1292`).
- `evaluate_with_timeout` (`page.rs:1258-1274`) — watchdog-bounded variant.
- `evaluate_for_cdp` / `call_function_on_for_cdp` (`page.rs:1296-1368`) — async, return a
  `RemoteObjectInfo` (the CDP RemoteObject shape); on no-runtime they synthesise a value
  from the sync `evaluate` (`page.rs:1317-1332`).
- Object lifetime: `release_object` (`page.rs:1377-1381`), `release_object_group`
  (`page.rs:1529-1533`).

`init_js` (`page.rs:261-343`) is the assembly point: it **drops any existing runtime** so
the realm starts clean on every navigation (the comment explains the security bug this
fixes: reusing the isolate leaked `window.onload`/custom props into the next document,
`page.rs:261-271`), builds a fresh runtime with the base URL + proxy, and injects
UA/platform/geolocation/cookie-jar/http-client/blocked-URLs/intercept state before calling
`run_page_init()` (`page.rs:340`).

---

## 10. Notable design decisions (summary)

1. **Fetch-parse-execute, not a real rendering engine.** Navigation is an HTTP fetch → HTML
   parse → script run pipeline; there is no layout, paint, or event loop beyond a bounded
   settle. "Screenshots"/layout are not this crate's concern.
2. **One live V8 realm per process, serialised by a global async mutex** (`v8_lock.rs`),
   with tabs beyond the focused one having their realm torn down (`suspend_js`) and rebuilt
   on demand (`resume_js`) (`dispatch.rs:191-203`).
3. **Everything is time-bounded by watchdogs** because tokio timeouts can't preempt
   synchronous V8 (`page.rs:387-390,725-726,1159-1162,792-796`).
4. **Security gates are opt-in and default-closed**: `file://` and private-network access
   both off by default (`context.rs:133,135`), plus the JS-driven cross-scheme→file SOP gate
   (`page.rs:876-889`) and the subresource scheme allowlist (`page.rs:95-103`).
5. **Fingerprint consistency over rotation**: a single stable profile by default, with a
   comment explaining that rotation without matching TLS/timezone is itself a bot signal
   (`profiles.rs:68-75`).
6. **State-not-events**: the crate records `NetworkEvent`s and lifecycle state; the CDP layer
   replays them as protocol events (`domains/page.rs:12-177`).

---

## 11. Limitations and coverage gaps (what the code does NOT do)

These matter as much as the features:

- **No real frame/iframe tree.** `Page` has one `frame_id == id` (`page.rs:189-194`). There
  is no child-`Page` per iframe; `<iframe src>` is handled by a JS shim `_loadIframeSrc`
  (`page.rs:1117-1120`), not by a nested navigation with its own realm/lifecycle. Cross-frame
  CDP semantics (per-frame execution contexts, `frameAttached` trees) are not modelled here.
- **No multi-context isolation in practice.** `BrowserContext` exists and `CdpContext.pages`
  is a `Vec`, but all pages share the one `default_context` (`dispatch.rs:159`) and the
  isolated-world bookkeeping comment admits "for now we only model a single page"
  (`dispatch.rs:25-26`). `Target.createBrowserContext` is on the V8-free no-op-ish list
  (`dispatch.rs:221`).
- **No true parallelism across tabs.** The global V8 lock means all JS work is serialised;
  concurrency is *interleaving* via spawned nav tasks, not parallelism
  (`v8_lock.rs:12-17`, `dispatch.rs:271-278`). The "properly concurrent fix" (one OS thread
  per isolate) is explicitly deferred (`v8_lock.rs:15-17`, issue #19).
- **Script ordering is approximate.** `async` scripts just run last (`page.rs:468-474`);
  there is no speculative parser, no document.write reentrancy, no script-inserted-script
  ordering guarantees beyond the three buckets.
- **localStorage persistence is not in this crate.** `BrowserContext` only loads/saves
  `cookies.json` (`context.rs:83-99,158-168`); the `localStorage/<origin>.json` persistence
  the architecture doc mentions (`docs/Architecture-overview.md:100`) is handled elsewhere.
- **Network events are per-hop and cleared each navigation** (`page.rs:919`) — there is no
  persistent cross-navigation network log inside `Page`.
- **`random_profile` is not cryptographically random** — it derives an index from
  `SystemTime` subsec-nanos (`profiles.rs:59-66`), fine for spreading load but not for
  unpredictability.
- **Robots enforcement is off by default** (`obey_robots: false`, `context.rs:130`) and only
  consults `/robots.txt` at the page path, not sub-resources (`page.rs:921-947`).
- **The crate assumes the caller holds the V8 lock.** Nothing in `obscura-browser` acquires
  `v8_lock::global()`; calling `Page::navigate` from a second thread/task without the lock is
  a foot-gun the crate does not defend against — the discipline lives entirely in the CDP
  dispatcher and the embeddable `obscura` wrapper.

---

## 12. How it connects to the rest of Obscura (dependency-flow recap)

```
obscura-cli / obscura-cdp / obscura-mcp / obscura (embeddable)
        │  construct BrowserContext, hold the V8 lock, own Vec<Page>
        ▼
obscura-browser::Page  ──────── navigate_single ────────┐
        │                                                │
        ├──► obscura-net   (ObscuraHttpClient.fetch, CookieJar, RobotsCache, StealthHttpClient)
        ├──► obscura-dom   (parse_html → DomTree, query_selector*)
        └──► obscura-js    (ObscuraJsRuntime: init_js, execute_scripts, watchdogs, v8_lock)
```

- **Downstream (what it calls):** `obscura-net` for all I/O
  (`context.rs:4`, `page.rs:254-260,979,981`), `obscura-dom` for parse + queries
  (`page.rs:4,1012-1019`), `obscura-js` for the realm, ops, watchdogs, and the shared V8 lock
  (`page.rs:5`, `page.rs:277-343`).
- **Upstream (who calls it):** `obscura-cdp` owns the tab collection and event emission
  (`dispatch.rs:12-48`, `domains/page.rs`), holding the V8 lock and per-command watchdog
  around each dispatch (`dispatch.rs:289-314`); `obscura-cli` and `obscura-mcp` call
  `navigate_with_wait` / `evaluate` directly for one-shot fetches and MCP tools
  (`crates/obscura-cli/src/main.rs:591,936`, `crates/obscura-mcp/src/lib.rs:695,957`); the
  embeddable `obscura` crate wraps `Page` in its own ergonomic API
  (`crates/obscura/src/browser.rs:52-61`, `crates/obscura/src/page.rs:3-4`).

The single navigation request flow, end to end, is exactly the one the architecture doc
draws (`docs/Architecture-overview.md:14-42`): CDP WebSocket frame → `server.rs` route by
session → `dispatch.rs` acquire V8 lock → `domains/page.rs` handler →
`obscura-browser/page.rs::navigate_with_wait` → net/dom/js — with `obscura-browser` sitting
at the pivot.

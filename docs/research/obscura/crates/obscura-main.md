---
title: "Obscura Deep-Dive: the `obscura` umbrella crate (embeddable Rust library API)"
date: 2026-07-03
researcher: Claude (Basset Hound architecture research)
status: Complete
category: reverse-engineering / rust-library-api
---

# The `obscura` umbrella crate — embeddable Rust library API

## 1. Purpose and role in the workspace

`crates/obscura` is **not** the engine. It is a thin, hand-written façade crate that
gives a Rust consumer a Puppeteer-shaped `Browser` / `Page` / `Element` / `CookieStore`
API over the real engine, *in-process*, with **no CDP round-trips and no separate
browser process**. The architecture overview lists it last of the eight workspace
crates and describes it exactly this way:

> `obscura           Embeddable Rust library API (Browser, Page, Element, CookieStore).`
> — `docs/Architecture-overview.md:11`

The four ways to drive the engine are enumerated in the library guide, and this crate
is explicitly the "embed the engine in a Rust service" path:

> - Embedding the engine in a Rust service: this crate.
> - Driving from Node/Python with existing Puppeteer/Playwright code: the CDP server.
> - Giving an AI agent browser tools: the MCP server.
> - One-off fetches and scraping from the shell: the CLI.
> — `docs/Use-as-a-Rust-library.md:137-142`

Structurally the crate is tiny — six source files totalling well under 400 lines — and
delegates essentially all real work to `obscura-browser` and `obscura-net`:

```
crates/obscura/Cargo.toml
crates/obscura/src/lib.rs        (32 lines — module wiring + re-exports)
crates/obscura/src/browser.rs    (Browser, BrowserBuilder)
crates/obscura/src/config.rs     (BrowserConfig, BrowserConfigBuilder)
crates/obscura/src/page.rs       (Page, Element)
crates/obscura/src/cookie.rs     (Cookie, CookieStore)
crates/obscura/src/error.rs      (Error enum)
crates/obscura/examples/basic.rs
crates/obscura/tests/interception.rs
crates/obscura/README.md
```
(directory listing verified on disk)

## 2. Cargo manifest, features, and the "git-only" constraint

`crates/obscura/Cargo.toml`:

```toml
[features]
default = ["api"]
api = ["obscura-browser", "obscura-net", "tokio"]

[dependencies]
obscura-browser = { path = "../obscura-browser", optional = true }
obscura-net     = { path = "../obscura-net", optional = true }
anyhow = "1"
tokio  = { version = "1", features = ["rt"], optional = true }
thiserror = "1"
serde_json = "1"
serde = { version = "1", features = ["derive"] }
url = "2"
```
— `crates/obscura/Cargo.toml:11-25`

Notable manifest facts:

- **`default = ["api"]`**, and `api` gates the three heavy deps
  (`obscura-browser`, `obscura-net`, `tokio`). With `--no-default-features` the crate
  compiles to essentially nothing usable — `Browser`/`Page` live behind those optional
  deps. This is the only feature; there is no separate "stealth" feature at *this*
  layer (stealth is a runtime bool, see §5).
- **`tokio` is pulled with only `features = ["rt"]`** (the current-thread runtime),
  not `rt-multi-thread` (`Cargo.toml:23`). The dev-dependency block *does* add
  `rt-multi-thread`, `macros`, `sync`, `time` for the tests
  (`crates/obscura/Cargo.toml:27-28`). The engine is `!Send` (it owns a V8 isolate), so
  a single-threaded runtime is the intended host.
- **`thiserror = "1"`** here, while the *workspace* pins `thiserror = "2"`
  (`Cargo.toml:41` at repo root). This crate deliberately does not use the workspace
  version — a minor inconsistency, harmless because the error enum only uses the v1/v2
  compatible derive surface.
- It depends on `obscura-browser` and `obscura-net` **but not** `obscura-js`,
  `obscura-dom`, `obscura-cdp`, or `obscura-mcp`. The interception channel types it needs
  from `obscura-js` are re-exported *through* `obscura-browser` precisely so this crate
  does not have to depend on `obscura-js` directly (see §4 and the comment at
  `crates/obscura-browser/src/lib.rs:9-12`).

The crate is **not published to crates.io**. Both the README and the library doc state
it must be a git dependency because building it compiles V8 (`deno_core`) from source:

> This crate is not published to crates.io, so depend on it via git. Building it
> compiles Obscura from source, including its embedded V8 (`deno_core`) …
> — `crates/obscura/README.md:9-11`; `docs/Use-as-a-Rust-library.md:1,12`

## 3. Public API surface (what `lib.rs` actually exports)

The entire public surface is 5 module declarations + 5 local re-exports + 6 foreign
re-exports:

```rust
mod browser;  mod config;  mod cookie;  mod error;  mod page;

pub use browser::Browser;
pub use config::BrowserConfig;
pub use cookie::{Cookie, CookieStore};
pub use error::Error;
pub use page::Page;

// Request/response interception types (issue #306).
pub use obscura_browser::{InterceptedRequest, InterceptResolution};
pub use obscura_net::{RequestCallback, RequestInfo, ResourceType, Response, ResponseCallback};
```
— `crates/obscura/src/lib.rs:18-32`

So a consumer's `use obscura::*` gives exactly:

| Symbol | Source | Kind |
|---|---|---|
| `Browser` | `src/browser.rs:14` | entry-point struct |
| `BrowserBuilder` | `src/browser.rs:70` | *(reachable via `Browser::builder()`, not separately re-exported)* |
| `BrowserConfig` / `BrowserConfigBuilder` | `src/config.rs:4,33` | config struct + builder |
| `Page` | `src/page.rs:19` | tab handle |
| `Element` | `src/page.rs:133` | *(reachable via `Page` methods, not separately re-exported at top level)* |
| `Cookie`, `CookieStore` | `src/cookie.rs:7,31` | cookie value + store |
| `Error` | `src/error.rs:4` | crate error enum |
| `InterceptedRequest`, `InterceptResolution` | re-exported from `obscura_browser` (originally `obscura_js::ops`) | interception |
| `RequestInfo`, `Response`, `ResourceType`, `RequestCallback`, `ResponseCallback` | re-exported from `obscura_net` | passive callbacks |

Note the two "reachable but not top-level re-exported" cases: `BrowserBuilder`
(`src/browser.rs:70`) and `Element` (`src/page.rs:133`) are `pub` in their modules but
their modules are private (`mod browser;`, `mod page;` — `lib.rs:18,22`), so the public
paths are `obscura::Browser` and `obscura::Page` only. `Element` is obtained by calling
`Page::query_selector` / `Page::wait_for_selector`; `BrowserBuilder` by calling
`Browser::builder()`. A consumer cannot name `obscura::Element` or `obscura::BrowserBuilder`
as a type path directly — a small but real ergonomic gap (you cannot write a function
that returns `obscura::Element`).

## 4. `Browser` — construction and delegation

`Browser` wraps two `Arc`s and nothing else:

```rust
pub struct Browser {
    context: Arc<BrowserContext>,
    cookie_jar: Arc<CookieJar>,
}
```
— `crates/obscura/src/browser.rs:14-17`

Construction paths:

- `Browser::new()` → `Self::build(BrowserConfig::default())` (`browser.rs:20-22`).
- `Browser::builder()` → `BrowserBuilder::default()` (`browser.rs:48-50`), a fluent
  builder exposing `.proxy(..)`, `.stealth(bool)`, `.user_agent(..)`, `.storage_dir(..)`,
  `.build()` (`browser.rs:74-93`).
- `Browser::build(config)` branches on `storage_dir`:

```rust
let context = if let Some(ref dir) = config.storage_dir {
    BrowserContext::with_storage_full("api".to_string(), config.proxy, config.stealth,
                                      config.user_agent, Some(dir.clone()))
} else {
    BrowserContext::with_full_options("api".to_string(), config.proxy, config.stealth,
                                      config.user_agent)
};
let context = Arc::new(context);
let cookie_jar = context.cookie_jar.clone();
```
— `crates/obscura/src/browser.rs:24-45`

The context id is hard-coded to `"api"` (`browser.rs:29,36`). Cookies are shared by
cloning the `Arc<CookieJar>` **out of** the `BrowserContext` (`browser.rs:43`), so the
`CookieStore` returned by `Browser::cookies()` and the jar used by every page and by the
HTTP client are the same object.

`new_page` allocates a monotonically-increasing page id from a process-global atomic and
constructs the inner engine page:

```rust
static NEXT_PAGE_ID: AtomicU64 = AtomicU64::new(1);
...
pub async fn new_page(&self) -> Result<Page, Error> {
    let id = NEXT_PAGE_ID.fetch_add(1, Ordering::Relaxed);
    let page = obscura_browser::Page::new(format!("page-{}", id), self.context.clone());
    Ok(Page { inner: page })
}
```
— `crates/obscura/src/browser.rs:12, 52-61`

Two things worth flagging:

1. `new_page` is declared `async` but **does not `.await` anything** — the body is
   entirely synchronous. It is async purely so the signature matches the ecosystem and
   is future-proof. `obscura_browser::Page::new` does not create a V8 runtime; the
   inner `Page.js` field is `None` until navigation (the inner struct's `js:
   Option<ObscuraJsRuntime>` — `crates/obscura-browser/src/page.rs:154`). So before the
   first `goto`, `evaluate` runs a tiny hard-coded fallback rather than real JS
   (`crates/obscura-browser/src/page.rs:1285-1292`).
2. The page id (`NEXT_PAGE_ID`) is a *process-global* atomic, not per-`Browser`, so page
   ids are unique across every `Browser` instance in the process.

### `BrowserContext` defaults chosen by the embed layer

The embed layer calls `with_full_options` / `with_storage_full`, both of which route to
`_new_inner(..., allow_private_network = false)`
(`crates/obscura-browser/src/context.rs:51-59, 143-150`). There is **no builder knob for
`allow_private_network`** — the fifth `BrowserContext` constructor
(`with_storage_and_network`, `context.rs:64-73`) that takes that flag is *not* used here.
Consequently the only way an embedding process can loosen the SSRF / private-network gate
is the process-wide `OBSCURA_ALLOW_PRIVATE_NETWORK` env var
(`crates/obscura-net/src/client.rs:82-92`), which is exactly what the crate's own
integration test sets (`crates/obscura/tests/interception.rs:48,113`). Likewise
`allow_file_access` is hard-defaulted to `false` (`context.rs:133`) and is unreachable
from this crate. This is a deliberate safe-by-default posture, but also a genuine
coverage gap: the embeddable API cannot opt into private-network or file access
programmatically.

## 5. `BrowserConfig` — the configuration surface

```rust
pub struct BrowserConfig {
    pub proxy: Option<String>,       // e.g. "socks5://127.0.0.1:1080"
    pub stealth: bool,               // fingerprint spoofing
    pub user_agent: Option<String>,
    pub storage_dir: Option<PathBuf>,// persistent cookie storage
}
```
— `crates/obscura/src/config.rs:4-13`; `Default` at `config.rs:15-24` (all `None`/`false`).

`BrowserConfig` has its **own** builder (`BrowserConfigBuilder`, `config.rs:33-61`) that
duplicates the four setters found on `BrowserBuilder`. Both builders exist and both are
functional; `BrowserBuilder::build` just calls `Browser::build(self.config)`
(`browser.rs:91-93`) while `BrowserConfigBuilder::build` returns the `BrowserConfig`
(`config.rs:58-60`). This is redundancy: a consumer can configure via either
`Browser::builder()...build()?` or `BrowserConfig::builder()...build()` then
`Browser::build(cfg)`.

The whole configurable surface is therefore **four knobs**: proxy, stealth,
user_agent, storage_dir. There is no viewport, no timeout default, no headless toggle
(always headless), no concurrency/pool config, no per-page config, and no way to pass
CLI-level flags such as `--allow-private-network`, `--allow-file-access`, or robots
obedience (`obey_robots` is hard-set to `false` at `context.rs:131`).

`stealth: true` is what swaps in the browser-fingerprinting TLS client; at the engine
layer that is `obscura-net/wreq_client.rs` presenting a consistent Chrome ClientHello and
enabling the tracker blocklist (`docs/Architecture-overview.md:104`; and
`client.block_trackers = true` when stealth in `context.rs:106-108`).

## 6. `Page` — the tab handle

```rust
pub struct Page { pub(crate) inner: InnerPage }   // InnerPage = obscura_browser::Page
```
— `crates/obscura/src/page.rs:19-21`

Every method is a thin adapter over `obscura_browser::Page`. The full method set:

| `obscura::Page` method | Delegates to | Notes |
|---|---|---|
| `goto(url).await` | `inner.navigate_with_wait(url, WaitUntil::Load)` | hard-codes `WaitUntil::Load`; maps err → `Error::Navigation` (`page.rs:25-30`) |
| `url()` | `inner.url_string()` | sync (`page.rs:33-35`) |
| `evaluate(js)` | `inner.evaluate(js)` | **synchronous**, returns `serde_json::Value` (`page.rs:38-40`) |
| `content()` | `evaluate("document.documentElement.outerHTML")` | returns `String`, `""` on non-string (`page.rs:43-46`) |
| `query_selector(css)` | `evaluate(querySelector→el._nid)` | returns `Option<Element>` (`page.rs:49-57`) |
| `wait_for_selector(css, Duration).await` | polls every 100 ms | `Error::Timeout` on expiry (`page.rs:60-85`) |
| `settle(max_ms).await` | `inner.settle(max_ms)` | pumps the JS event loop (`page.rs:92-94`) |
| `add_preload_script(js)` | `inner.add_preload_script` | CDP `addScriptToEvaluateOnNewDocument` (`page.rs:100-102`) |
| `enable_interception()` | `inner.enable_interception()` | returns `UnboundedReceiver<InterceptedRequest>` (`page.rs:108-112`) |
| `on_request(cb)` | `inner.on_request` | passive `RequestCallback` (`page.rs:118-120`) |
| `on_response(cb)` | `inner.on_response` | passive `ResponseCallback` (`page.rs:125-127`) |

Design notes and gaps at this layer:

- **`goto` always waits for `WaitUntil::Load`** (`page.rs:28`). The engine supports the
  full lifecycle ladder `init → commit → domcontentloaded → load → networkidle2 →
  networkidle0` (`docs/Architecture-overview.md:93`), but the embed API exposes none of
  it — you cannot ask `goto` to resolve at `domcontentloaded` or `networkidle0`, and
  there is no `wait_for_navigation`, no `waitForNetworkIdle`. `settle(max_ms)` is the
  only manual event-loop control offered.
- **`evaluate` is synchronous and swallows errors.** The inner `evaluate` returns
  `serde_json::Value::Null` on a JS exception (logged at `debug`)
  (`crates/obscura-browser/src/page.rs:1276-1293`). So the embed API can never surface a
  JS `throw` as a Rust `Err`; despite `Error::JsEval` existing in the enum
  (`error.rs:8-9`), **no code path in this crate ever constructs it** (verified: `JsEval`
  and `NoPage` are dead variants — see §8).
- **`evaluate` does not acquire the global V8 lock.** The CDP server serializes JS
  through `obscura_js::v8_lock::global()` (`docs/Architecture-overview.md:48-53`), but
  this crate never touches `v8_lock` (grep of `crates/obscura/**` for `v8_lock` returns
  nothing). Safety rests entirely on `evaluate(&mut self)` requiring exclusive access to
  one `Page`, and on the host running everything on a single thread. Because
  `obscura_browser::Page` owns a `!Send` V8 runtime, a `Page` cannot cross threads — but
  there is no compile-time guard stopping a consumer from constructing two `Page`s and
  interleaving `evaluate` calls from two tasks on a multi-thread runtime; that is
  out-of-contract and undefined at the engine level.
- **CSS-selector escaping is minimal.** `query_selector`/`wait_for_selector` build JS by
  string interpolation, escaping only `\` and `'`
  (`page.rs:50-54, 66-72`). A selector containing other JS-breaking characters would
  corrupt the generated expression.

### `Element` — DOM node handle (and a notable soundness footgun)

```rust
pub struct Element {
    node_id: u64,
    page: *const Page,   // raw pointer back to the owning Page
}
```
— `crates/obscura/src/page.rs:133-136`

`Element` stores a **raw `*const Page`** and, in every method, casts it to `*mut Page`
and dereferences it through `unsafe` to re-enter `evaluate`:

```rust
pub fn text(&self) -> String {
    let page = unsafe { &mut *(self.page as *mut Page) };
    let val = page.evaluate(&format!(
        "(function() {{ var el = globalThis._wrap && globalThis._wrap({}); \
         return el ? el.textContent : ''; }})()", self.node_id));
    val.as_str().unwrap_or("").to_string()
}
```
— `crates/obscura/src/page.rs:138-147`; `attribute` at `150-157`; `click` at `160-177`.

Implications:

- There is **no lifetime tying `Element` to its `Page`.** The `*const Page` is captured
  at `query_selector` time (`page.rs:56`, `74`). If the `Page` is moved or dropped while
  an `Element` still exists, the raw pointer dangles and the next `Element` method is
  **undefined behaviour**. This is a real soundness gap the type system does not
  prevent; the API is only safe by convention ("don't outlive the page").
- `Element` methods (`text`, `attribute`, `click`) are **synchronous** and take `&self`
  yet mutate the page through the raw pointer — they cannot follow with `settle`, so a
  `click()` that triggers async navigation/JS will not be awaited by the caller unless
  they manually `page.settle(...)` afterward.
- The element bridge depends on engine-internal JS conventions: `el._nid` (each DOM node
  carries an `_nid`) and `globalThis._wrap(nid)` to re-materialize a node handle
  (`page.rs:56, 143, 153, 164, 169`). These are private contracts of `obscura-js`'s
  `bootstrap.js`, not a stable API.
- `click()` scrolls into view then calls `.click()` and returns
  `Err(Error::ElementNotFound("click failed"))` if the wrapped node was falsy
  (`page.rs:160-177`).
- `attribute(name)` interpolates `name` into the JS **unescaped** (`page.rs:152-155`) —
  only the selector paths escape quotes, the attribute name does not.

## 7. Cookies — `Cookie` and `CookieStore`

The embed layer defines its own flat `Cookie` DTO (serde-serializable) rather than
re-exporting the engine's `CookieInfo`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cookie { pub name, value, domain, path: String,
                    pub secure, http_only: bool }
```
— `crates/obscura/src/cookie.rs:6-14`; convenience ctor `Cookie::new` at `16-28`.

`CookieStore` wraps `Arc<CookieJar>` (the same jar the browser/HTTP client use) and
offers:

```rust
set(set_cookie_str, url)        // parse url, jar.set_cookie(...)          cookie.rs:43-48
get_all() -> Vec<Cookie>        // jar.get_all_cookies() mapped 1:1         cookie.rs:51-63
get_for_url(url) -> Vec<Cookie> // jar.get_cookie_header(url), then split   cookie.rs:66-85
save_to_file(path)              // jar.save_to_file                         cookie.rs:88-90
load_from_file(path) -> usize   // jar.load_from_file (# loaded)            cookie.rs:93-95
```

Fidelity gap in `get_for_url`: it reconstructs `Cookie`s by splitting the `Cookie:`
request-header string on `"; "` and `"="` (`cookie.rs:69-84`). Because the header only
carries `name=value`, the returned cookies have **`path` forced to `"/"` and
`secure`/`http_only` forced to `false`**, and `domain` set to the URL host regardless of
the cookie's real domain (`cookie.rs:76-82`). `get_all()` preserves the real fields
(`cookie.rs:54-62`); `get_for_url()` does not. The doc's summary of the store
(`set/get_all/get_for_url/save_to_file/load_from_file`, `docs/Use-as-a-Rust-library.md:64`)
does not mention this lossiness.

Note the doc's example `store.set("session=abc123; Domain=...; HttpOnly")` shows a
one-argument call (`Use-as-a-Rust-library.md`), but the real signature is
`set(&self, set_cookie_str, url)` — two arguments (`cookie.rs:43`). The inline `///`
doc-comment example at `cookie.rs:42` is likewise one-argument and is out of date with
the signature directly beneath it.

## 8. Errors

```rust
#[derive(Error, Debug)]
pub enum Error {
    Navigation(String),   // "navigation error: {0}"
    JsEval(String),       // "JS evaluation error: {0}"
    Timeout(String),      // "timeout: {0}"
    ElementNotFound(String),
    NoPage,               // "no page session"
    Internal(#[from] anyhow::Error),
}
```
— `crates/obscura/src/error.rs:3-22`

Constructed variants (grep across `crates/obscura/src`):
- `Navigation` — `page.rs:29` (goto failure).
- `Timeout` — `page.rs:77` (wait_for_selector).
- `ElementNotFound` — `page.rs:175` (click failure).
- `Internal` — `cookie.rs:45,68,89,94` (URL parse + file IO, via `#[from] anyhow::Error`).

**Dead variants:** `JsEval` (`error.rs:8`) and `NoPage` (`error.rs:17`) are never
constructed anywhere in the crate — `evaluate` swallows JS errors to `Null` (§6) and
there is no "no page" state to report. They are API-surface cruft.

## 9. Interception & passive callbacks (the one non-trivial feature)

This is the crate's most substantial capability, added under issue #306
(`lib.rs:30`, `page.rs` doc-comments, `tests/interception.rs:2`). Two mechanisms:

**Passive callbacks** (`on_request`/`on_response`) fire for every request/response
including navigation and JS `fetch()`/XHR, non-blocking. Types come straight from
`obscura-net`:

```rust
pub type RequestCallback  = Arc<dyn Fn(&RequestInfo) + Send + Sync>;
pub type ResponseCallback = Arc<dyn Fn(&RequestInfo, &Response) + Send + Sync>;
```
— `crates/obscura-net/src/client.rs:75-76`

`RequestInfo { url, method, headers, resource_type }` and `Response { url, status,
headers, body: Vec<u8>, redirected_from }` are re-exported unchanged
(`client.rs:55-61, 17-24`), as is the `ResourceType` enum
(`Document|Script|Stylesheet|Image|Font|Xhr|Fetch|Other`, `client.rs:63-73`).

**Active interception** (`enable_interception()`) returns a Tokio
`UnboundedReceiver<InterceptedRequest>`; each request is resolved by sending an
`InterceptResolution` through the request's one-shot `resolver`:

```rust
pub struct InterceptedRequest {
    pub request_id, url, method: String,
    pub headers: HashMap<String,String>,
    pub resource_type: String,                                    // NB: String, not enum
    pub resolver: tokio::sync::oneshot::Sender<InterceptResolution>,
}
pub enum InterceptResolution {
    Continue { url, method, headers, body: Option<..> },  // pass / rewrite
    Fulfill  { status: u16, headers, body: String },      // mock
    Fail     { reason: String },                          // block
}
```
— `crates/obscura-js/src/ops.rs:18-41` (re-exported via `obscura-browser` at
`crates/obscura-browser/src/lib.rs:12`, then `obscura/src/lib.rs:31`).

Behavioural facts worth recording:

- Active interception covers **only JS-initiated `fetch()`/XHR**, not the top-level
  navigation request — the doc says so ("returns a channel of every JS `fetch()`/XHR
  request", `Use-as-a-Rust-library.md:93`), and the passive callbacks are the path for
  navigation.
- A `Continue { url: Some(new) }` **rewrite is re-checked against the SSRF /
  private-network gate**, so a rewrite cannot reach an internal address that would
  otherwise require `--allow-private-network`
  (`docs/Use-as-a-Rust-library.md:123`). The integration test exercises this rewrite
  path end-to-end (`tests/interception.rs:111-167`).
- **`resource_type` does not split `Xhr` from `Fetch`** — JS-initiated requests all
  report `Fetch` (`docs/Use-as-a-Rust-library.md:135`). Note the mismatch: the passive
  `ResourceType` enum *has* an `Xhr` variant (`client.rs:70`) but the interception path
  never emits it, and `InterceptedRequest.resource_type` is a bare `String`
  (`ops.rs:39`) rather than the typed enum.
- `add_preload_script` runs before the page's own `<script>` tags (CDP
  `Page.addScriptToEvaluateOnNewDocument` semantics) and must be called before `goto`
  (`page.rs:96-102`, `docs/Use-as-a-Rust-library.md:126-133`).

The crate's only integration test, `tests/interception.rs`, is a self-contained proof
of this feature: it spins a raw `TcpListener` echo server whose `/` returns
`<script>fetch('/api')</script>`, then asserts (a) `on_request` fires ≥1×, (b)
`on_response` captures the `/api` JSON body, and (c) a `Continue`-with-`url` rewrite of
`/api → /modified` takes effect (`tests/interception.rs:46-167`). It drives the loop by
looping `page.settle(500).await` up to 20× — illustrating that in the embed model **the
host is responsible for pumping the event loop**; nothing runs the loop for you between
calls.

## 10. Concurrency / threading model

- The engine owns a `!Send` V8 runtime per page (`Page.js: Option<ObscuraJsRuntime>`,
  `crates/obscura-browser/src/page.rs:154`), so `obscura::Page` is effectively pinned to
  one thread. The manifest's default `tokio` feature is the current-thread runtime
  (`Cargo.toml:23`).
- Unlike the CDP server, this crate does **no** `v8_lock` serialization and no
  `LocalSet`/spawn orchestration (the CDP path's `process_with_interception` model,
  `docs/Architecture-overview.md:55-57`, is absent here). Concurrency across pages is the
  host's problem.
- `Browser` holds only `Arc`s (`browser.rs:14-17`) and is cheap to clone-share, but the
  `Page`/`Element` it produces are single-threaded, `&mut`-driven objects.

## 11. How it connects to the rest of Obscura

```
        obscura  (this crate — façade)
          │  Browser::build
          ▼
   obscura-browser::BrowserContext ── owns ──► obscura-net::CookieJar / ObscuraHttpClient
          │  Page::new                                  (+ stealth wreq client, robots, blocklist)
          ▼
   obscura-browser::Page  ── evaluate / settle ──► obscura-js (V8 via deno_core, bootstrap.js + ops)
          │                                              │
          └── navigate_with_wait ──► obscura-net fetch ──┴── obscura-dom (DOM tree)
```

- **Downward:** `obscura` → `obscura-browser` (`Page`, `BrowserContext`, `WaitUntil`) →
  `obscura-net` (`CookieJar`, HTTP), `obscura-dom` (DOM), `obscura-js` (V8/ops). It
  never reaches into `obscura-dom`/`obscura-js` *directly*; DOM access is exclusively
  through `evaluate(js)`. The interception types physically live in `obscura-js::ops`
  but are laundered through `obscura-browser`'s re-export
  (`crates/obscura-browser/src/lib.rs:9-12`) so this crate avoids an `obscura-js` dep.
- **Sibling interfaces:** `obscura-cdp` (Puppeteer/Playwright), `obscura-mcp` (AI agent
  tools), and `obscura-cli` are *alternative* front-ends to the same
  `obscura-browser`/`obscura-net` core; this crate is the in-process Rust one. They do
  not depend on `obscura`; `obscura` does not depend on them
  (`docs/Architecture-overview.md:1-12`, and the `[workspace] members` /
  `workspace.dependencies` lists in root `Cargo.toml:3-27`).

## 12. Summary of limitations / coverage gaps

1. **Lifecycle control is one-shot.** `goto` hard-codes `WaitUntil::Load` (`page.rs:28`);
   no `domcontentloaded`/`networkidle` option, no `wait_for_navigation`. `settle(max_ms)`
   is the only event-loop control, and the host must call it manually.
2. **JS errors are invisible.** `evaluate` returns `Null` on a JS throw
   (`obscura-browser/src/page.rs:1280-1283`); `Error::JsEval` is never produced. Errors
   are logged at `debug` only.
3. **`Element` is `unsafe` and unbounded by lifetime** — a raw `*const Page`
   (`page.rs:135`) dereferenced through `unsafe` in every method; using an `Element`
   after its `Page` moves/drops is UB.
4. **No programmatic access to the security opt-ins.** `allow_private_network` /
   `allow_file_access` / robots obedience are all hard-`false`
   (`context.rs:131,133`, and the builder uses the non-network constructors,
   `browser.rs:26,34`). Only the process-wide `OBSCURA_ALLOW_PRIVATE_NETWORK` env var can
   loosen the SSRF gate.
5. **Thin config.** Four knobs only (proxy/stealth/user_agent/storage_dir); no viewport,
   timeouts, headless toggle, pooling, or per-page config.
6. **Cookie fidelity loss in `get_for_url`** — path/secure/http_only defaulted, domain
   set to URL host (`cookie.rs:76-82`).
7. **Interception scope** — JS `fetch()`/XHR only, no navigation interception; `Xhr` is
   folded into `Fetch`; `InterceptedRequest.resource_type` is a `String`, not the typed
   enum (`ops.rs:39`).
8. **Dead code / API cruft** — unused `Error::JsEval`, `Error::NoPage`; two parallel
   builders (`BrowserBuilder` vs `BrowserConfigBuilder`); `Element`/`BrowserBuilder`
   `pub` but not top-level re-exported.
9. **Doc drift** — `cookie.set` shown as a one-arg call in the guide/doc-comment
   (`docs/Use-as-a-Rust-library.md`, `cookie.rs:42`) vs the real two-arg signature
   (`cookie.rs:43`).
10. **Minimal JS-string escaping** in selector/attribute interpolation (`page.rs:50,152`)
    — only `\` and `'` in selectors; attribute name not escaped at all.
11. **git-only, V8-from-source** — not on crates.io; heavy first build
    (`README.md:9-11`).

## 13. Relevance to Basset Hound Browser

Basset Hound exposes its engine through a WebSocket command API (164 commands) plus an
MCP server — i.e. an out-of-process, message-oriented control plane. Obscura's `obscura`
crate is the opposite architectural bet: an **in-process, typed, `&mut`-driven Rust
façade** with *no* wire protocol, chosen for embedding the engine inside another Rust
service. The instructive contrasts for comparison work:

- Obscura ships four coordinated front-ends (library / CDP / MCP / CLI) over one shared
  core, and keeps the embeddable one deliberately minimal (four config knobs, one
  feature flag). Basset Hound centralises on the WebSocket surface.
- Obscura's embed API pushes event-loop pumping (`settle`) and error-visibility onto the
  host and swallows JS errors — a much thinner contract than a command API that returns
  structured results/errors per call.
- The `unsafe` raw-pointer `Element` and the hard-`false` security opt-ins are concrete
  design decisions Basset Hound can point to as either simplifications to emulate or
  hazards to avoid when defining its own in-process/SDK surface.

---
title: "Obscura Extensibility Model: CDP Methods, Web APIs, Ops, Preload Scripts"
date: 2026-07-03
researcher: Claude (Opus 4.8)
status: Complete
category: architecture-research
---

# Obscura Extensibility Model

> Reverse-engineering research on the Apache-2.0 headless browser **Obscura**
> (`/home/devel/tmp/obscura`), for comparison against Basset Hound Browser.
> Focus: how a contributor extends Obscura — adding a CDP method, adding a JS
> Web API (Rust op + bootstrap shim), preload scripts, and plugin patterns.

## 1. Purpose and scope

Obscura exposes **two first-class extension surfaces**, both compile-time:

1. **CDP methods** — the wire protocol a Puppeteer/Playwright client speaks to.
   New methods are added as Rust handlers under `crates/obscura-cdp/src/domains/`.
2. **JS Web APIs** — the browser globals page JavaScript sees (`document`,
   `crypto`, `fetch`, `WebSocket`, …). New APIs are a *Rust op* (in
   `crates/obscura-js/src/ops.rs`) plus a *JS shim* (in
   `crates/obscura-js/js/bootstrap.js`).

The canonical contributor guide is
`/home/devel/tmp/obscura/docs/Adding-a-CDP-method-or-Web-API.md` — two worked
recipes plus a "Tips" section. This document verifies those recipes against the
actual source, documents the machinery they rely on, and flags where the recipe
text is a simplification of the real control flow.

Two secondary surfaces round out extensibility:

3. **Preload scripts** — client-supplied JS injected before page scripts, via
   CDP `Page.addScriptToEvaluateOnNewDocument` and the `Runtime.addBinding`
   JS→Rust callback bridge.
4. **ES module loader** — `ObscuraModuleLoader` fetches dynamic `import()`
   graphs over HTTP.

There is **no runtime/dynamic plugin system** (see §9).

## 2. CDP method extensibility

### 2.1 Two-level dispatch

The recipe in `Adding-a-CDP-method-or-Web-API.md` says to register a new method
by adding a match arm to `dispatch.rs`:

```rust
"MyDomain.doThing" => domains::my_domain::do_thing(&req.params, ctx, &req.session_id).await,
```

**This is a simplification.** The real `dispatch()` does *not* match on the full
`Domain.method` string. It splits the method on the first `.` and routes by
**domain only** to a per-domain `handle()` fn
(`crates/obscura-cdp/src/dispatch.rs:316-351`):

```rust
let (domain, method) = match req.method.split_once('.') { ... };
let result = match domain {
    "Target" => domains::target::handle(method, &req.params, ctx).await,
    "Browser" => domains::browser::handle(method, &req.params).await,
    "Page" => domains::page::handle(method, &req.params, ctx, &req.session_id).await,
    "DOM" => domains::dom::handle(method, &req.params, ctx, &req.session_id).await,
    ...
    _ => Err(format!("Unknown domain: {}", domain)),
};
```

So there are actually **two extension cases**:

- **Adding a method to an existing domain** → add a `match method` arm inside
  that domain's `handle()`. Example, `crates/obscura-cdp/src/domains/browser.rs:4-35`:
  ```rust
  pub async fn handle(method: &str, _params: &Value) -> Result<Value, String> {
      match method {
          "getVersion" => Ok(json!({ ... })),
          "close" => Ok(json!({})),
          ...
          _ => Err(format!("Unknown Browser method: {}", method)),
      }
  }
  ```
- **Adding a whole new domain** → add a `"MyDomain" => domains::my_domain::handle(...)`
  arm to the `match domain` in `dispatch.rs`, **and** declare the module in
  `crates/obscura-cdp/src/domains/mod.rs` (a flat list of `pub mod` lines,
  `mod.rs:1-13`).

The recipe's single-file example works because it collapses both steps; a real
new method still ends up dispatched through the domain's `handle()`.

### 2.2 Handler signature and return contract

Handlers are `async fn` returning `Result<serde_json::Value, String>`. The
`Ok(value)` becomes a CDP success result; `Err(msg)` becomes a JSON-RPC error
with code `-32601` (`dispatch.rs:371-377`). Handler signatures vary by how much
state they need:

- `browser::handle(method, params)` — no context (stateless acks).
- `page::handle(method, params, ctx, session_id)`,
  `runtime::handle(...)`, `dom::handle(...)`, etc. — take `&mut CdpContext`
  and the optional `session_id` to resolve the target `Page`.

Request/response wire types are plain serde structs in
`crates/obscura-cdp/src/types.rs`: `CdpRequest {id, method, params, session_id}`
(`types.rs:3-11`), `CdpResponse` with `success`/`error` constructors
(`types.rs:24-42`), and `CdpEvent` for server→client pushes (`types.rs:50-73`).

### 2.3 `CdpContext` — the shared server state a handler mutates

`crates/obscura-cdp/src/dispatch.rs:12-48` defines `CdpContext`, the mutable
state every stateful handler receives. Fields most relevant to extension:

- `pages: Vec<Page>` + `sessions: HashMap<session_id, page_id>` — target routing
  (`get_session_page` / `get_session_page_mut`, `dispatch.rs:178-206`).
- `pending_events: Vec<CdpEvent>` — a handler emits an async CDP event by
  pushing here; the writer task forwards it.
- `preload_scripts: Vec<(String, String)>` — `(identifier, source)` pairs (§5).
- `isolated_worlds`, `valid_context_ids`, `next_isolated_context_id` —
  execution-context bookkeeping for `Page.createIsolatedWorld`
  (`dispatch.rs:27-45`, `next_isolated_context()` at `149-154`).
- `fetch_intercept`, `intercept_tx` — request interception plumbing.

### 2.4 The V8 lock allowlist — a required registration step for new methods

Every dispatch that can reach a `JsRuntime` is serialized behind a process-wide
`tokio::sync::Mutex` (`obscura_js::v8_lock::global()`) to prevent V8 fatal
aborts under concurrent work (`dispatch.rs:260-293`, with a long comment
explaining the `heap->isolate() == Isolate::TryGetCurrent()` invariant).

An **optimization allowlist**, `is_v8_free_method()` (`dispatch.rs:216-249`),
lists methods audited to never touch V8; those bypass the lock (and the
per-command watchdog). When adding a CDP method a contributor must decide:
if the new method demonstrably never reaches `JsRuntime::execute_script` or a
DOM op, add it to this `matches!(...)` list for concurrency; otherwise leave it
out and it serializes safely. The comment warns that `get_session_page_mut`
(which triggers `suspend_js`/`resume_js`) is deliberately **not** on the list.

### 2.5 Per-command watchdog

Non-v8-free methods are wrapped by a per-command V8 termination watchdog armed
from the page's isolate handle (`dispatch.rs:304-314`, tunable via
`OBSCURA_CDP_COMMAND_TIMEOUT_MS`, default 60 s). If a handler overruns, the
isolate is terminated and the termination flag cleared (`dispatch.rs:356-367`).
A new long-running handler inherits this bound for free.

### 2.6 Accepted-but-no-op domains

`dispatch.rs:344-349` returns `Ok(json!({}))` for a whole set of domains that
Obscura does not implement but must not reject, because Puppeteer/Playwright
send them during connection setup: `Emulation`, `Log`, `Performance`,
`Security`, `CSS`, `ServiceWorker`, `Inspector`, `Debugger`, `Profiler`,
`HeapProfiler`, `Overlay`, `Audits`. "Extending" any of these today means
turning a blanket `{}` ack into a real per-method handler.

Also note the `Target.sendMessageToTarget` unwrap-and-recurse path
(`dispatch.rs:256-258`, `424-479`) that older Puppeteer / `headless_chrome`
clients wrap every call in — a new method is reachable through it automatically.

## 3. JS Web API extensibility (Rust op + bootstrap shim)

### 3.1 The op — `#[op2]` in `ops.rs`

Ops are declared with deno_core's `#[op2]` attribute macros. The recipe's worked
example, `op_subtle_digest`, is real at `crates/obscura-js/src/ops.rs:1370-1384`:

```rust
#[op2]
#[buffer]
fn op_subtle_digest(#[string] algorithm: &str, #[buffer] data: &[u8]) -> Vec<u8> {
    use sha1::Digest as _;
    match algorithm.to_ascii_uppercase().as_str() {
        "SHA-1"   => sha1::Sha1::digest(data).to_vec(),
        "SHA-256" => sha2::Sha256::digest(data).to_vec(),
        ...
    }
}
```

Observed op flavors and marshaling attributes in the tree:

- `#[op2]` — normal sync op (`op_dom`, `op_subtle_digest`, `op_url_parse`).
- `#[op2(fast)]` — fast-path sync op with no allocation on the boundary
  (`op_console_msg` at `ops.rs:501`, `op_set_cookie` at `1327`,
  `op_navigate` at `1342`, `op_binding_called` at `1358`).
- `#[op2(async)]` — returns a `Future`; deno_core drives it on the event loop
  (`op_fetch_url` at `ops.rs:596-606`, `op_sleep` at `1350`).
- Argument/return markers: `#[string]`, `#[buffer]`, `#[number]`, plain
  `bool`/`u32`. Fallible ops return
  `Result<T, deno_error::JsErrorBox>` (`op_subtle_hmac` at `1404-1410`,
  `op_random_bytes` at `1612-1618`); the JS shim converts the error into the
  right `DOMException`.

**Panic-safety is mandatory.** `op_dom` is wrapped in `std::panic::catch_unwind`
because a panic would unwind through deno_core into V8's FFI frame and
`V8_Fatal` → `abort(3)` the whole process (`ops.rs:123-139`, and the invariant
is restated in `AGENTS.md:82-84`: "New ops must not unwind into V8"). Several
ops that call the `url` crate also `catch_unwind` (`op_url_parse` at
`ops.rs:1666`, `op_url_set` at `1731`).

### 3.2 Registering the op — `build_extension()`

Every op must be listed in the single `Extension` returned by `build_extension()`
(`ops.rs:1824-1853`):

```rust
pub fn build_extension() -> Extension {
    Extension {
        name: "obscura_dom",
        ops: std::borrow::Cow::Owned(vec![
            op_dom(),
            op_console_msg(),
            op_fetch_url(),
            ...
            op_subtle_digest(),
            ...
            op_url_encode_query(),
        ]),
        ..Default::default()
    }
}
```

All ops live in **one** extension named `"obscura_dom"`; there is no modular
multi-extension composition and no `esm`/`js` module field on the Extension —
the JS side is delivered entirely through the snapshot (§4).

### 3.3 The JS shim — `bootstrap.js`

The shim exposes the Web API surface and calls the op via `Deno.core.ops.op_*`.
The digest shim (recipe step 3) matches the real code — the file installs a
larger `crypto.subtle` object that funnels into the ops at
`bootstrap.js:6665-6932` (e.g. `op_subtle_digest` at `6770`, `op_subtle_hmac`
at `6828`, `op_subtle_aes_gcm` at `6915`, `op_random_bytes` at `6810`).

Three distinct shim patterns exist (the docs' "Worked examples in the tree"):

1. **Op + shim** — `crypto.subtle.digest` (op `op_subtle_digest` + shim).
2. **Pure JS, no op** — `DOMParser`
   (`bootstrap.js:4658-4665`), which parses into a detached `<html>` via the
   existing `innerHTML`/`op_dom` fragment path rather than a new op.
3. **Async event firing** — `WebSocket` (`bootstrap.js:7128-7165`),
   `EventSource` (`7107-7126`), `IntersectionObserver` (`4166`), all built on
   the `_makeListenerBox(self)` helper (`bootstrap.js:7083-7105`) that the docs
   explicitly recommend for events. `_makeListenerBox` installs
   `addEventListener`/`removeEventListener`/`dispatchEvent` backed by a `Map`.

The "Tips" guidance is enforced by the code: keep shims thin, route side effects
through ops, and — per `AGENTS.md:89-92` — **DOM mutations go through `op_dom`,
not new ops.** `op_dom` is a single stringly-dispatched op taking
`(cmd, arg1, arg2)` with ~60 sub-commands (`ops.rs:125`, dispatch table
`141-448`, JS wrapper `_dom` at `bootstrap.js:70`). This is a deliberate
narrow-boundary decision: DOM gets one multiplexed op; crypto gets one op per
primitive.

### 3.4 Adding a dependency

New crates go in `crates/obscura-js/Cargo.toml`. The WebCrypto work added
`sha1`, `sha2`, `hmac`, `aes`, `aes-gcm`, `cbc`, `ctr`, `pbkdf2`, `hkdf`,
`getrandom` (all pure-Rust RustCrypto, chosen to avoid CMake/OpenSSL — see the
inline comment at `Cargo.toml`). The `stealth` cargo feature gates the wreq
client path in ops (`op_fetch_url` `#[cfg(feature = "stealth")]` at
`ops.rs:784-806`).

## 4. Snapshot build: why bootstrap changes need a rebuild

`bootstrap.js` is **not** loaded at runtime as a file. `crates/obscura-js/build.rs`
bakes it into a V8 startup snapshot at compile time
(`build.rs:10-33`):

```rust
let bootstrap_js = include_str!("js/bootstrap.js");
let output = deno_core::snapshot::create_snapshot(CreateSnapshotOptions {
    skip_op_registration: true,
    extensions: vec![],
    with_runtime_cb: Some(Box::new(move |runtime| {
        runtime.execute_script("<obscura:bootstrap>", bootstrap_js.to_string())...
    })),
    ...
});
std::fs::write(&snapshot_path, &*output.output)...;
println!("cargo:rustc-env=OBSCURA_SNAPSHOT_PATH={}", snapshot_path.display());
```

`cargo:rerun-if-changed=js/bootstrap.js` (`build.rs:4`) means editing the shim
triggers a snapshot rebuild. `skip_op_registration: true` is significant: the
snapshot captures the JS heap but **not** the op bindings — the real ops are
attached at runtime when `JsRuntime::new` is given `build_extension()` alongside
the baked snapshot (`crates/obscura-js/src/runtime.rs:121-126`):

```rust
let mut runtime = JsRuntime::new(RuntimeOptions {
    extensions: vec![build_extension()],
    module_loader: Some(module_loader),
    startup_snapshot: Some(SNAPSHOT),
    ..Default::default()
});
```

`SNAPSHOT` is `include_bytes!(env!("OBSCURA_SNAPSHOT_PATH"))` (`runtime.rs:15`).

## 5. Preload scripts and the JS→Rust binding bridge

### 5.1 `Page.addScriptToEvaluateOnNewDocument`

Handled in `crates/obscura-cdp/src/domains/page.rs:367-379`: it increments
`ctx.preload_counter`, stores `(identifier, source)` in `ctx.preload_scripts`,
and returns the identifier. `removeScriptToEvaluateOnNewDocument` retains by id.

Preload sources are pushed onto each `Page` and executed **before** the page's
own scripts on every navigation. In `crates/obscura-browser/src/page.rs:590-602`:

```rust
// CDP Page.addScriptToEvaluateOnNewDocument contract: preload sources must
// run BEFORE any of the page's own scripts. This is also where puppeteer's
// exposeFunction wrapper installs itself ...
let preload_sources = self.preload_scripts.clone();
for source in &preload_sources {
    js.execute_script_guarded("<preload>", source.as_str())...;
}
```

The same injection is repeated for `about:blank` (`page.rs:952-963`) because
`browser.newPage()` lands there. Preloads are propagated to freshly created
pages via `page.set_preload_scripts(...)` in both the server accept path
(`crates/obscura-cdp/src/server.rs:566,585-588`) and the `page.rs` domain
navigation path (`domains/page.rs:235,242-245`).

### 5.2 `Runtime.addBinding` — exposeFunction bridge

`crates/obscura-cdp/src/domains/runtime.rs:304-341` implements the JS→Rust
callback path. It validates the binding name
(`c.is_alphanumeric() || c == '_' || c == '$'`, not starting with a digit),
then **synthesizes a preload script** that installs a global function forwarding
its single argument to the `op_binding_called` op:

```rust
let shim = format!(
    "globalThis['{name}'] = function (arg) {{
        if (arguments.length !== 1) return;
        try {{
            const payload = typeof arg === 'string' ? arg : String(arg);
            Deno.core.ops.op_binding_called('{name}', payload);
        }} catch (e) {{ }}
    }};", name = name);
let key = format!("__obscura_binding__{}", name);
ctx.preload_scripts.retain(|(k, _)| k != &key);
ctx.preload_scripts.push((key, shim.clone()));
```

`op_binding_called` (`ops.rs:1358-1362`) queues `(name, payload)` onto
`ObscuraState.pending_binding_calls`. After **every** dispatch,
`drain_binding_calls()` (`dispatch.rs:386-422`) pops the queue and emits one
`Runtime.bindingCalled` CDP event per entry (hardcoded `executionContextId: 2`).
This is the complete mechanism behind Puppeteer's `page.exposeFunction`.

### 5.3 Per-page config injection (an internal extension idiom)

Per-page settings are threaded as `globalThis.__obscura_*` globals set via tiny
`execute_script` calls, then consumed once by `__obscura_init()`. Setters in
`runtime.rs`: `set_user_agent` (`219-225`), `set_platform` (`227-238`),
`set_stealth` (`240-245`), `set_geolocation` (`259-267`); orchestrated by
`run_page_init()` (`249-254`) which calls `globalThis.__obscura_init()`. The
init fn lives at `bootstrap.js:7355-7404` and reads those globals to build
`document`, `screen`, `navigator.hardwareConcurrency`, etc. The internal global
names are pre-hidden as non-enumerable in `_preHideInternals()`
(`bootstrap.js:11-43`) so they don't leak to `Object.keys(window)` — relevant
to any new internal global a contributor adds.

## 6. ES module loader

`crates/obscura-js/src/module_loader.rs` implements deno_core's `ModuleLoader`
for dynamic `import()`. `resolve()` (`36-54`) joins against the page base URL;
`load()` (`56-114`) fetches the module source over HTTP using the shared cached
reqwest client (`crate::ops::cached_request_client`, keyed by proxy URL). Entry
points on the runtime: `load_module` / `load_inline_module`
(`runtime.rs:626-738`), both budget-bounded with `tokio::time::timeout`. This is
a data-fetching extension point, not an API-surface one — you cannot register a
synthetic module through it.

## 7. Testing extensions

The recipe's test harness is real. CDP tests construct a `CdpContext::new()` and
call `dispatch(&CdpRequest{...}, &mut ctx)` directly, asserting on the response
(pattern shown in `dispatch.rs:481-567` unit tests, e.g.
`audits_enable_returns_empty_success`). Integration tests live under
`crates/obscura-cdp/tests/` (`cdp_click_submit_parity.rs`,
`concurrent_navigations.rs`, etc.). Web-API smoke testing uses the CLI:
`./target/release/obscura fetch <url> --eval "<js>"` (recipe step 5), backed by
`ObscuraJsRuntime::evaluate_with_timeout` (`runtime.rs:889-913`).

## 8. Control flow: an extension end-to-end

```
CDP client frame
  → server.rs  (accept, route by sessionId)
  → dispatch.rs::dispatch
       split "Domain.method"; acquire v8_lock unless is_v8_free_method;
       arm per-command watchdog
  → domains::<domain>::handle(method, params, ctx, session_id)   [CDP EXT POINT]
       (may) → obscura-browser Page  → obscura-js ObscuraJsRuntime
                                          → execute_script / evaluate
                                          → bootstrap.js shim        [JS EXT POINT]
                                          → Deno.core.ops.op_*       [OP EXT POINT]
                                          → ops.rs op (reads SharedState / DOM)
  ← Result<Value,String> → CdpResponse
  ← drain_binding_calls → Runtime.bindingCalled events
```

## 9. Limitations and gaps (what the model does NOT do)

- **No dynamic/plugin loading.** There is no `libloading`/`dlopen`, no plugin
  registry, no runtime op registration. `create_snapshot` is called with
  `skip_op_registration: true` and the op set is a fixed vector in
  `build_extension()`. Both extension surfaces require **editing the source and
  recompiling**. (Grep across `crates/*/src` for `libloading|dlopen|plugin`
  finds only `navigator.plugins` in JS tests.)
- **The CDP recipe text is a simplification.** As shown in §2.1, `dispatch.rs`
  routes by domain, not by full method string; the literal recipe arm does not
  match the real match block. New contributors must know the two-level pattern.
- **`op_dom` is stringly-typed and silently lenient.** An unknown `cmd` returns
  `"null"` (`ops.rs:446`) with no error; a typo in a new DOM sub-command fails
  quietly.
- **Single-page modeling in `CdpContext`.** `preload_scripts`, `isolated_worlds`,
  and context-id state are stored globally, not per-page — the code comment says
  so explicitly: "for now we only model a single page in CdpContext"
  (`dispatch.rs:24-27`). Extensions that need true multi-page isolation of
  preloads/worlds are not supported.
- **Many Web APIs are stubs because there is no layout/render engine.**
  `Page.getLayoutMetrics` returns a fixed 1280×720 (`domains/page.rs:385-399`);
  `IntersectionObserver` "can't compute real intersection"
  (`bootstrap.js:4149-4166`); `WebSocket.send` drops data and no real socket is
  opened (`bootstrap.js:7154`); `EventSource` only fires `open`, never delivers
  messages (`7107-7126`); `CanvasRenderingContext2D`/`Path2D` are empty classes.
  Extending these to real behavior is out of scope for the op+shim recipe.
- **~12 CDP domains are blanket no-op acks** (`dispatch.rs:344-349`). Any real
  `Emulation`/`CSS`/`Debugger`/`Profiler` support is greenfield.
- **`addBinding` is single-argument, name-restricted** (`runtime.rs:304-341`):
  wrong arity is silently dropped; the payload is `String()`-coerced.
- **No TypeScript / no build step for the shim** beyond the snapshot; `bootstrap.js`
  is one 7,878-line hand-written file (`wc -l` on
  `crates/obscura-js/js/bootstrap.js`).
- **Ops share one `ObscuraState`** (`Rc<RefCell<ObscuraState>>`, `ops.rs:49-105`,
  `runtime.rs:128`). A new stateful op adds a field here; there is no per-op
  state isolation.

## 10. How this connects to the rest of Obscura

The extension surfaces sit at the two internal boundaries of the crate stack
(`docs/Architecture-overview.md`):

- **CDP methods** are the `obscura-cdp` layer (`server.rs` → `dispatch.rs` →
  `domains/`), the outward protocol face consumed by Puppeteer/Playwright and by
  `obscura-cli` (`fetch`/`serve`/`scrape`) and the `obscura` embeddable library.
- **Web APIs / ops** are the `obscura-js` layer (`bootstrap.js` + `ops.rs` +
  `runtime.rs`), the inward face page JavaScript runs against, backed by
  `obscura-dom` (tree) and `obscura-net` (HTTP/stealth/cookies).

The `obscura-mcp` (Model Context Protocol) server is a *separate* tool surface
and is **not** covered by these two recipes; it is not an extension point for
CDP methods or Web APIs. The workspace convention (`AGENTS.md`,
`Architecture-overview.md` "Workspace conventions") is one crate per layer with
calls going through the layer above, which is why a Web API extension touches
exactly `ops.rs` + `bootstrap.js` and a CDP extension touches exactly
`domains/` + `dispatch.rs`.

---

### Source index (primary files read)

| Concern | File |
|---|---|
| Contributor recipes | `docs/Adding-a-CDP-method-or-Web-API.md` |
| CDP dispatch / context / v8-lock / watchdog | `crates/obscura-cdp/src/dispatch.rs` |
| CDP wire types | `crates/obscura-cdp/src/types.rs` |
| Domain module list | `crates/obscura-cdp/src/domains/mod.rs` |
| Simplest domain handler | `crates/obscura-cdp/src/domains/browser.rs` |
| Preload / addScriptToEvaluateOnNewDocument | `crates/obscura-cdp/src/domains/page.rs` |
| addBinding / bindingCalled | `crates/obscura-cdp/src/domains/runtime.rs` |
| Rust ops + `build_extension()` | `crates/obscura-js/src/ops.rs` |
| Snapshot build | `crates/obscura-js/build.rs` |
| Runtime wiring (snapshot + extension) | `crates/obscura-js/src/runtime.rs` |
| JS shims + `_makeListenerBox` + `__obscura_init` | `crates/obscura-js/js/bootstrap.js` |
| ES module loader | `crates/obscura-js/src/module_loader.rs` |
| Preload injection at navigation | `crates/obscura-browser/src/page.rs` |
| Op/extension conventions | `AGENTS.md` |

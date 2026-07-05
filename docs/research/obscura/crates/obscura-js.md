---
title: "Obscura Deep-Dive: obscura-js (V8 runtime, Rust ops, DOM bridge, Web API shims)"
date: 2026-07-03
researcher: Claude (architecture research)
status: Complete
category: reverse-engineering / architecture-research
---

# obscura-js — the JavaScript runtime layer

> Scope of this doc: `crates/obscura-js` in the Apache-2.0 project **Obscura**
> (a headless, no-Chromium HTTP+DOM+JS browser controllable over CDP). All
> line/symbol citations are against the on-disk checkout at
> `/home/devel/tmp/obscura`. Sibling crates are cited where the bridge crosses a
> crate boundary. This is comparison research for Basset Hound Browser; nothing
> here is copied into that project.

## 1. Purpose and one-paragraph summary

`obscura-js` embeds Google V8 (through `deno_core` 0.350) and turns it into a
*browser-shaped* JavaScript environment without Chromium, Blink, or a layout
engine. It has three moving parts: (1) a ~7,900-line hand-written
`js/bootstrap.js` that defines every Web API surface (`document`, `window`,
`navigator`, the DOM class hierarchy, `fetch`/`XHR`, events, storage, WebCrypto,
observers, fingerprint spoofing); (2) a set of Rust "ops" in `src/ops.rs` that
are the *only* way JS can touch the outside world (the DOM arena, the network,
cookies, crypto, URL parsing); and (3) `src/runtime.rs`, the `ObscuraJsRuntime`
wrapper that owns one V8 isolate per page, drives CDP `Runtime.evaluate` /
`callFunctionOn`, converts V8 values to JSON, and enforces execution deadlines.
The DOM itself lives in a separate Rust crate (`obscura-dom`) as an arena; JS
never holds the tree — every `node.parentNode`, `node.tagName`, `appendChild`,
etc. is a round-trip into the single `op_dom` op. The whole environment is
frozen into a V8 startup **snapshot** at build time so each page boots in
milliseconds.

## 2. File map

| File | Lines | Role |
|------|-------|------|
| `src/lib.rs` | 13 | Module declarations + re-exports (`HTML_TO_MARKDOWN_JS`, `set_v8_flags`). |
| `src/runtime.rs` | 2,600 (≈half tests) | `ObscuraJsRuntime`: isolate lifecycle, CDP eval/callFunctionOn, RemoteObject shaping, watchdogs, ES-module loading, `v8_to_json`. |
| `src/ops.rs` | 1,853 | All Rust ops registered into V8; `ObscuraState` shared state; `build_extension()`. |
| `js/bootstrap.js` | 7,878 | The Web API shim layer (DOM classes, globals, events, fetch/XHR, crypto, fingerprints). |
| `src/module_loader.rs` | 115 | `ObscuraModuleLoader`: ES-module resolve + proxy-aware async fetch. |
| `src/v8_lock.rs` | 27 | Process-wide `tokio::sync::Mutex` serializing all V8 work. |
| `src/cdp_watchdog.rs` | 117 | One shared watchdog thread armed around every CDP command. |
| `src/v8_flags.rs` | 37 | One-shot `set_v8_flags` before the first isolate. |
| `src/markdown.rs` | 71 | `HTML_TO_MARKDOWN_JS` (pure-JS DOM→markdown walker). |
| `build.rs` | — | Builds the V8 snapshot by executing `bootstrap.js` at compile time. |

## 3. V8 integration and the build-time snapshot

The most important architectural decision in the crate is that **`bootstrap.js`
runs once, at compile time, and the resulting V8 heap is snapshotted.**

`build.rs` calls `deno_core::snapshot::create_snapshot(...)` with
`skip_op_registration: true`, `extensions: vec![]`, and a `with_runtime_cb` that
`execute_script("<obscura:bootstrap>", bootstrap_js)`. The output bytes are
written to `$OUT_DIR/OBSCURA_SNAPSHOT.bin`, and the path is exported as the
`OBSCURA_SNAPSHOT_PATH` cargo env var (`build.rs:24-46`). `runtime.rs:15` then
embeds it: `static SNAPSHOT: &[u8] = include_bytes!(env!("OBSCURA_SNAPSHOT_PATH"))`.

Consequences visible in the code:

- Every per-page `JsRuntime` is created with `startup_snapshot: Some(SNAPSHOT)`
  and the ops re-registered via `build_extension()` (`runtime.rs:121-126`). The
  classes/globals already exist in the snapshot; only the ops and per-page
  state are attached fresh.
- The "hide internal globals" list is computed **at snapshot-build time**
  (`bootstrap.js:7411-7413`, `__obscura_hide_list = Object.keys(globalThis).filter(...)`)
  and merely *applied* per page in `__obscura_init` (`bootstrap.js:7399-7402`),
  because recomputing it per navigation cost 5–40 ms on SPA-heavy pages.
- `bootstrap.js` must not throw during snapshot creation — `build.rs:21` calls
  `.expect("bootstrap.js should not fail during snapshot creation")`.

`v8_flags.rs` exposes `set_v8_flags(&str)` guarded by a `std::sync::Once`
(`v8_flags.rs:16-24`); it must run before the first isolate because V8 ignores
`set_flags_from_string` after platform init.

## 4. `ObscuraJsRuntime` (runtime.rs)

### 4.1 Structure

`ObscuraJsRuntime` (`runtime.rs:27-36`) holds:

- `runtime: JsRuntime` — the deno_core isolate.
- `state: Rc<RefCell<ObscuraState>>` — shared with the ops via `op_state`.
- `object_store: HashMap<String, String>` — CDP `objectId` → a JS retrieval
  expression like `globalThis.__obscura_objects['<oid>']`.
- `object_counter: u64` and `isolate_handle: IsolateHandle` (captured at
  construction so a watchdog can be armed from `&self`, `runtime.rs:34-36`).

Construction (`with_base_url_and_proxy`, `runtime.rs:115-146`) builds the runtime
with `build_extension()`, an `ObscuraModuleLoader`, and the snapshot, then
`put`s the state clone into `op_state` and runs `<obscura:init>` to create
`globalThis.__obscura_objects = {}`.

### 4.2 Per-page configuration is injected as globals via string interpolation

Per-page identity is not passed as structured data; it is written into the
isolate as globals by interpolating into small scripts:
`set_user_agent` (`runtime.rs:219-225`), `set_platform` (`:227-238`),
`set_stealth` (`:240-245`), `set_geolocation` (`:259-267`). The values are
escaped only for backslash/quote (e.g. `ua.replace('\\',"\\\\").replace('\'',"\\'")`,
`runtime.rs:220`). After all setters, `run_page_init()` (`:249-254`) calls
`globalThis.__obscura_init()`, which seeds the fingerprint RNG and instantiates
`document` from the current DOM.

### 4.3 CDP evaluation path

- `evaluate(expr)` (`:269-276`) wraps the expression (`wrap_expression`,
  `:985-1019`) in an IIFE `try { return (…); } catch { return null; }`, executes
  it, and converts via `v8_to_json`. `wrap_expression` strips trailing
  semicolons and inserts a newline before the closing paren specifically to
  survive Puppeteer/Playwright utility bundles that end with `})();` and
  `//# sourceURL=` comments (`:1001-1017`).
- `evaluate_for_cdp(expr, return_by_value, await_promise)` (`:278-399`) is the
  real `Runtime.evaluate` backend. For the await path it builds an async IIFE
  that stores the result into `globalThis.__obscura_objects['<oid>']`, sets a
  `__obscura_done_N` sentinel and `__obscura_await_meta`, then pumps the event
  loop via `resolve_promises_until(|rt| …sentinel…, 5000)` (`:345-355`).
  Rejections are surfaced as `Err("Promise rejected: …")` (`:368-374`).
- `call_function_on_for_cdp(...)` (`:401-549`) resolves `this` (`resolve_this`,
  `:1054-1076`: an `objectId` maps through `object_store`, a `node-<nid>` id
  maps through `globalThis._cache`, otherwise `globalThis`), builds arguments
  (`build_args`, `:1078-1102`, handling `value` / `objectId` /
  `unserializableValue`), and runs the declared function with `.call`.
- RemoteObject shaping: `meta_extract_js(varName)` (`:1021-1052`) is a JS snippet
  returning `{type, subtype, className, description}`; a DOM node is detected by
  `typeof v._nid === 'number'` and gets `subtype:'node'` and a synthetic
  `HTML…Element` class name. `object_store` object ids are the string
  `{"injectedScriptId":1,"id":N}` (`make_oid`, `:981-983`).
- `v8_to_json` (`:1104-1149`) handle-scopes the result, fast-paths
  undefined/null/bool/number/string, and otherwise calls the context's
  `JSON.stringify` and `serde_json::from_str`s the output.

### 4.4 Execution deadlines (V8 cannot be preempted by tokio)

Synchronous V8 pins the OS thread, so `tokio::time::timeout` cannot interrupt an
infinite loop or microtask storm. The crate solves this with **watchdog threads
that call `IsolateHandle::terminate_execution()`**:

- `spawn_watchdog(handle, budget)` / `WatchdogToken` (`:52-101`) spawn a thread
  that terminates the isolate after `budget`; `WatchdogToken::stop` returns
  whether it fired. `disarm_watchdog` then clears the termination flag via
  `cancel_terminate_execution` (`:842-849`).
- `run_event_loop_bounded(budget_ms)` (`:869-884`) races a tokio idle-timeout
  against a watchdog armed 500 ms past the budget; an idle timeout is the normal
  "settled" exit, and `"execution terminated"` is coerced to `Ok(())`.
- `evaluate_with_timeout` (`:889-913`) and `execute_script_with_timeout`
  (`:755-820`) apply the same pattern to `--eval` and large inline scripts
  (`execute_script_guarded` only guards scripts ≥ 10 KB, `:747-753`).

`cdp_watchdog.rs` is a *single, long-lived* watchdog thread the CDP dispatcher
arms/disarms around every command (`arm`/`disarm`, `cdp_watchdog.rs:88-117`) to
avoid the ~240 µs cost of spawning a thread per command; its correctness relies
on the process-wide V8 lock guaranteeing only one command's isolate runs at a
time (`cdp_watchdog.rs:10-12`).

### 4.5 ES module loading

`load_module(url, budget_ms)` (`:626-689`) fetches the module source via the
wired `http_client`, decodes it, and calls
`load_side_es_module_from_code` → `mod_evaluate` → `run_event_loop`, each stage
`tokio::time::timeout`-bounded by `budget_ms`. The comment records that an
earlier implementation registered an empty string and "loaded" every Vite/Next
bundle in 1 ms so SPAs never mounted (issue #205, `:631-633`).
`load_inline_module` (`:691-738`) is the same for inline `<script type=module>`.

## 5. The Rust↔JS bridge: ops (ops.rs)

All ops are registered in `build_extension()` under the extension name
`"obscura_dom"` (`ops.rs:1824-1852`). The full op set:

`op_dom`, `op_console_msg`, `op_fetch_url`, `op_get_cookies`, `op_set_cookie`,
`op_navigate`, `op_sleep`, `op_binding_called`, `op_subtle_digest`,
`op_subtle_hmac`, `op_subtle_aes_gcm`, `op_subtle_aes_cbc`, `op_subtle_aes_ctr`,
`op_subtle_pbkdf2`, `op_subtle_hkdf`, `op_random_bytes`, `op_url_parse`,
`op_url_set`, `op_url_resolve`, `op_encoding_for_label`, `op_text_decode`,
`op_url_encode_query`.

### 5.1 `op_dom` — the single DOM gateway

Every DOM operation funnels through one op:
`op_dom(cmd: String, arg1: String, arg2: String) -> String` (`ops.rs:123-139`).
Design points worth noting:

- **Stringly-typed.** Node ids are decimal strings (arena indices); results are
  a nid string, a JSON blob, or the literals `"null"`/`"true"`/`"false"`. E.g.
  `"query_selector"` returns the matched nid or `"-1"` (`:196-198`);
  `"child_nodes"` returns a JSON int array (`:243-247`). `set_attribute` packs
  `name\0value` into `arg2` (`:269-282`).
- **Only two argument slots.** This is a real constraint that produced a
  historical bug: `insertBefore` needs (parent, new, ref) but the op forwards
  only two args, so the arg order had to be reworked to `insert_before(new, ref)`
  with `dom.insert_before(ref, new)` (`:305-310`; regression test
  `insert_before_inserts_node_at_correct_position`, `runtime.rs:1499-1514`).
- **Anti-panic boundary.** `op_dom` wraps `op_dom_inner` in
  `std::panic::catch_unwind` and returns `"null"` on panic (`:132-138`) because a
  panic would unwind through deno_core into V8's FFI frame where `V8_Fatal`
  calls `abort(3)` and kills every CDP client.
- The `cmd` match (`:149-447`) covers document metadata, `getElementById`
  (with a live-tree re-validation + `query_selector` fallback because the id
  index is best-effort, `:179-195`), selector queries (document- and
  subtree-scoped), tree navigation, attributes, `inner_html`/`outer_html`,
  mutation (`append_child`/`remove_child`/`insert_before`/`set_inner_html` via
  `obscura_dom::parse_fragment`), node creation, and batched helpers
  (`node_index`, `compare_order`, `node_root`, `:426-445`) that exist to cut
  JS↔op round-trips for `Range`/`compareDocumentPosition`.

### 5.2 `op_fetch_url` — scripted `fetch()`/XHR

`op_fetch_url` (`ops.rs:596-1060`) is the async op behind `fetch`/XHR. It is a
security-sensitive path and does a lot:

- **SSRF guard** via `validate_fetch_url` (`:1261-1309`): only http/https/file
  schemes; rejects private/loopback IPs and `localhost`-family domains unless
  `obscura_net::env_allows_private_network()`. The reqwest client is also built
  with `redirect::Policy::none()` and an `SsrfGuardResolver` DNS resolver
  (`:571-586`).
- **Blocklist**: matches `blocked_urls` patterns / `glob_match` (`:626-636`,
  `glob_match` at `:1205-1230`) and returns `{"blocked":true}`.
- **Request interception**: if `intercept_enabled`, it emits an
  `InterceptedRequest` over a channel and awaits `InterceptResolution`
  (`Continue`/`Fulfill`/`Fail`, `:664-711`); a `Continue` URL rewrite is
  re-validated against the SSRF gate (`:718-733`).
- **CORS**: cross-origin `cors` requests get a preflight OPTIONS when
  non-simple (`:808-844`) and the response `Access-Control-Allow-Origin` is
  checked (`:983-1000`).
- **Manual redirect following** (`:846-973`): each hop is re-validated against
  the SSRF policy (GHSA-8v6v-g4rh-jmcm), capped at `FETCH_REDIRECT_LIMIT = 10`,
  with 301/302/303 downgrading to GET and dropping the body.
- **Cookies**: same-origin requests attach `jar.get_cookie_header`; `Set-Cookie`
  responses are stored back (`:861-913`).
- **Body handling**: returns both a UTF-8-lossy `body` and a `bodyBase64`
  (`:1006-1007, 1051-1059`), and buffers bodies (bounded ring buffer keyed by
  `fetch-N` request ids, env `OBSCURA_NETWORK_BODY_BUFFER_*`, `:1023-1047`) so
  CDP `Network.getResponseBody` can read them. Each fetched absolute URL is
  recorded in `fetched_urls` for `--dump assets` (`:637-640`).
- **Client caching**: `cached_request_client(proxy)` keeps one `reqwest::Client`
  per proxy in a process-wide `OnceLock<RwLock<HashMap>>` (`:529-552`) so the
  connection pool warms up; the proxy is threaded from the page's
  `ObscuraHttpClient.proxy_url()` (issue #139, `:642-646`).
- **Stealth**: under the `stealth` feature, the whole request is instead routed
  through `stealth_fetch_all` (`:1081-1203`) using the wreq `StealthHttpClient`
  so the TLS ClientHello and client hints match the navigation.

### 5.3 Other ops

- `op_console_msg` (`:501-509`) maps `console.*` levels to `tracing`.
- `op_get_cookies`/`op_set_cookie` (`:1311-1340`) back `document.cookie` through
  `obscura_net::CookieJar`, using `get_js_visible_cookies` (HttpOnly excluded).
- `op_navigate` (`:1342-1348`) sets `pending_navigation` — how `location.href=`
  and form submits signal a navigation back to `obscura-browser`.
- `op_sleep` (`:1350-1353`) is the async primitive behind `setTimeout`.
- `op_binding_called` (`:1358-1363`) queues `(name, payload)` for the CDP layer
  to drain as `Runtime.bindingCalled` (Puppeteer `page.exposeFunction`).
- **WebCrypto secret-key ops** (`:1370-1618`): real RustCrypto implementations of
  digest, HMAC, AES-GCM/CBC/CTR, PBKDF2, HKDF, and `op_random_bytes` (OS CSPRNG
  for `getRandomValues`/`randomUUID`). The header comment (`:1386-1395`) states
  only secret-key algorithms are here; public-key algorithms are rejected in the
  JS shim.
- **WHATWG URL ops** (`:1620-1790`): `op_url_parse`/`op_url_set`/`op_url_resolve`
  back the `URL` class and `a.href`; each wraps the `url` crate in
  `catch_unwind` because it can panic on pathological WPT inputs (`:1664-1677`).
- **Encoding ops** (`:1792-1822`): `op_encoding_for_label`/`op_text_decode`/
  `op_url_encode_query` delegate to `obscura_net` (encoding_rs) for `TextDecoder`
  and legacy-charset query encoding.

### 5.4 `ObscuraState` — the shared bag

`ObscuraState` (`ops.rs:49-105`) is the `Rc<RefCell<>>` carried in `op_state`.
It holds `dom: Option<DomTree>`, `url`, `encoding`, `title`, `blocked_urls`,
`cookie_jar`, `http_client`, (feature-gated) `stealth_client`,
`pending_navigation`, the intercept channel + counter + enabled flag,
`pending_binding_calls`, the `network_response_bodies` ring buffer, and
`fetched_urls`. The `runtime.rs` `set_*`/`take_*` accessors (`:148-217`) are how
`obscura-browser` wires the page's DOM, cookies, HTTP client, and interception
into the isolate.

## 6. bootstrap.js — the Web API surface

### 6.1 The DOM is a thin proxy over the Rust arena

`_dom` (`bootstrap.js:70`) is `(cmd,a1,a2) => Deno.core.ops.op_dom(cmd, String(a1??""), String(a2??""))`
and `_domParse` (`:231`) is the JSON-parsing variant. The class hierarchy —
`Node` (`:376`), `CharacterData` (`:632`), `Text` (`:662`), `Comment` (`:681`),
`Element` (`:939`), `Document` (`:2108`), `DocumentFragment` (`:2473`),
`DocumentType` (`:2511`) — stores nothing but a `_nid` (the arena `NodeId`
index, `:396`). **Every property is a live op call**, e.g.
`get nodeType() { return +_dom("node_type", this._nid); }` (`:397`),
`get parentNode() { return _wrap(+_dom("parent_node", this._nid)); }` (`:443`),
`appendChild` → `_dom("append_child", …)` (`:453-455`). There is no local DOM
mirror; the Rust `DomTree` is the single source of truth. This makes DOM code
correct-by-construction but chatty (one FFI hop per accessor).

**Wrapper identity/caching**: `_wrap(nid)` / `_wrapEl(nid)` (`:2576-2596`) memoise
wrappers in a module-level `_cache = new Map()` (`:2528`) so `el === el` holds.
`_elementClassFor` (`:2569-2575`) returns `HTMLFormElement`/`HTMLMediaElement`
subclasses; almost all other `HTMLxElement` globals are literally aliased to
plain `Element` (`:5036-5080`). **Gap**: `_cache` is never evicted, so if the
arena ever reuses a freed index, a stale wrapper could be returned.

### 6.2 Events

`Node` base `addEventListener`/`dispatchEvent` are **no-ops** (`:630`);
`Element` overrides them. The element model uses a global registry
`_eventRegistry` keyed by nid → `{type: [handlers]}` (`:225-228`,
`addEventListener` at `:1225-1230`). `Element.dispatchEvent` (`:1237-1264`):

1. fires the IDL `on<type>` property *and* a compiled inline content-attribute
   handler (`_resolveInlineHandler` compiles `getAttribute('onclick')` via
   `new Function`, `:1265-1278`),
2. runs the registered handlers in order (honoring
   `stopImmediatePropagation`),
3. then manually **bubbles** up the `parentNode` chain if `event.bubbles` and
   propagation isn't stopped.

There is **no capture phase, no `once`/`passive`/`capture` option handling, and
no shadow-DOM retargeting** — listeners are stored as bare function refs
(`addEventListener` ignores `opts`, `:1225`). Non-DOM `EventTarget`s (WebSocket,
EventSource, BroadcastChannel) get a simpler per-object listener map via
`_makeListenerBox(self)` (`:7083-7105`). Trust is tracked in a `WeakSet`
`_trustedEvents`; `__obscura_markTrusted(ev)` adds an event so `isTrusted`
returns true (`:4297-4298, 4322`).

`Element.click()` (`:1279-1298`) dispatches a bubbling cancelable `MouseEvent`
and, if not cancelled, falls through to `<a href>` navigation
(`location.assign`) or form submission.

### 6.3 Controlled-input (React/Vue) handling — the focus area

This is the subject of the two most recent fixes in the repo
(commit `08c1f0d`, "fix(cdp): fire onChange for React/Vue controlled inputs",
issue #324) and it is genuinely subtle. Two root causes had to be fixed
together:

**(1) The value-tracker bypass.** React/Preact/Vue install a "value tracker" by
redefining `value`/`checked` **on the element instance** to record the last
value they wrote. A plain `el.value = x` runs that instance wrapper, keeping the
tracker in sync, so the next `input`/`change` event looks unchanged and
`onChange` never fires. `__obscura_setFieldValue(el, field, value)`
(`bootstrap.js:4300-4319`) walks the **prototype** chain to find the property
descriptor with a setter and calls `desc.set.call(el, value)` — bypassing the
instance tracker, which is left stale, so the following `input` event reads as a
genuine user edit. The regression test
`set_field_value_bypasses_instance_value_wrapper` (`runtime.rs:1810-1841`)
asserts exactly this: after the helper, `el.value === 'native'` but the
tracker still reads `'wrapped'`.

**(2) Feature-detect surface.** React chooses the modern input-event path via
`('oninput' in document)`. Obscura originally exposed the GlobalEventHandlers
`on*` attributes only on `window`, so the check failed and React fell back to a
legacy change-detection path that ignores input events. The `on*` handlers are
now also present on `Document` and `Element.prototype` (test
`global_event_handlers_present_on_document_and_element`, `runtime.rs:1848-1868`,
asserts `('oninput' in document)`, `('onchange' in document)`, and
`('oninput' in Element.prototype)` are all true).

**How typing is driven**: the CDP `Input` domain
(`crates/obscura-cdp/src/domains/input.rs`) synthesizes keystrokes in JS by
reading `t.value`, computing the new string (respecting the selection range),
calling `globalThis.__obscura_setFieldValue(t, 'value', …)`, then dispatching
`__obscura_markTrusted(new Event('input', {bubbles:true}))` — and, on blur/enter,
a trusted `change` event (`input.rs:13-55`, `:100-106`). Mouse events go through
`__obscura_markTrusted(new MouseEvent(...))` against
`document.elementFromPoint(x,y)` or `__obscura_click_target` (`:76-133`).

Worth flagging for comparison work: the input `set value(v)` stores into a
global `_formValues[this._nid]` map rather than the `value` **attribute**
(`bootstrap.js:1481-1502`; getter reads `_formValues` first, `:1464`). So the
`value` *property* and `value` *attribute* diverge as in a real browser, but the
current value lives in a side map, not the DOM.

### 6.4 Fetch / XHR / navigation from JS

`globalThis.fetch` (`:3147`) and `XMLHttpRequest` (`:3244`) serialize the request
and call `op_fetch_url`, decoding `bodyBase64` for binary responses
(`_base64ToUint8Array`, `_bodyToUint8Array`, `:3023-3063`). `location` (`:2617`)
is a synthetic object; assigning `location.href` / `location.assign` routes into
`op_navigate`, surfaced to the browser via `take_pending_navigation`
(`runtime.rs:186-188`; test `test_location_href_assignment_updates_navigation_state`,
`runtime.rs:1555-1563`). Dynamically inserted `<script>` elements are handled in
`Node.appendChild` (`:457-523`): external/module scripts are queued into
`__dynScriptQueue` and executed serially by `__processDynScriptQueue` to avoid
concurrent `import()` calls tripping a deno_core `RefCell` panic; inline classic
scripts are `eval`'d immediately.

### 6.5 Fingerprint / stealth surface

`console` (`:288-295`) routes to `op_console_msg`; timers (`:307-336`) run on
`op_sleep` + microtasks. `navigator` (`:2831`) reports `webdriver:false` via a
prototype getter engineered so `getOwnPropertyDescriptor(navigator,'webdriver')`
is `undefined` (`:2943-2951`). `_getFp()` (`:154-223`) builds a per-page,
seed-stable fingerprint: platform-specific WebGL/ANGLE renderer pools, a canvas
data-URL, audio latency/sample-rate, battery, and screen resolution; the seed
`_fpSeed` is reset in `__obscura_init` (`:7356`). WebGL contexts themselves are
empty classes (`:2989-2990`); the 2D canvas (`_Canvas2D`, `:5755`) is a synthetic
implementation used for fingerprint spoofing, not real rasterization.

## 7. Concurrency and process safety

The concurrency model is spelled out in `v8_lock.rs:1-17`: **all pages share one
OS thread** (via `tokio::task::LocalSet` + `spawn_local`, because V8 isolates are
`!Send`), and each page has its own isolate. If two isolates' V8-touching futures
interleave across an `.await`, V8 trips its
`heap->isolate() == Isolate::TryGetCurrent()` invariant and `abort(3)`s the whole
process. The remedy is `v8_lock::global()` — a process-wide `tokio::sync::Mutex`
(`:22-27`) that the CDP dispatcher takes around every V8 block, converting a
would-be abort into latency. This lock is *also* what makes the single shared
`cdp_watchdog` slot correct (only one command's isolate can be armed at a time).
The doc comment notes the "proper" fix (one OS thread per isolate) is a larger
refactor tracked as issue-19 Option 2.

## 8. How obscura-js connects to the rest of Obscura

- **`obscura-dom`**: provides `DomTree`, `NodeId`, `NodeData`. `op_dom` is the
  only door into it; the whole workspace convention is "all DOM ops go through
  `op_dom` to keep the JS/Rust boundary narrow" (`docs/Architecture-overview.md:110`).
- **`obscura-net`**: `CookieJar`, `ObscuraHttpClient`, `StealthHttpClient`,
  `SsrfGuardResolver`, `is_forbidden_ip`, `label_name`/`decode_with_label`,
  tracker blocklist. Consumed directly by the ops.
- **`obscura-browser`**: `Page` owns an `Option<ObscuraJsRuntime>`
  (`crates/obscura-browser/src/page.rs:154`). `setup_runtime` wires UA/platform/
  stealth/geolocation/cookies/http-client/blocked-URLs/intercept, moves the DOM
  in, and calls `run_page_init()` (`page.rs:277-342`). It extracts and runs inline
  `<script>` tags in `execute_scripts` with a phase deadline and a hard
  isolate-terminating watchdog (`page.rs:366-464`), and drains
  `take_pending_navigation` to perform client-side navigations
  (`page.rs:875, 1596`).
- **`obscura-cdp`**: the dispatcher acquires `v8_lock`, arms the shared
  `cdp_watchdog`, and calls `Page::evaluate_for_cdp` / `callFunctionOn`; the
  `Input` domain drives typing/clicking via `__obscura_setFieldValue` /
  `__obscura_markTrusted`. `markdown.rs::HTML_TO_MARKDOWN_JS` backs the
  `LP.getMarkdown` CDP method and the CLI `--dump markdown`.

## 9. What obscura-js deliberately does NOT do (coverage gaps)

These are as important as the features for any comparison:

- **No layout or rendering engine.** `getComputedStyle` is faked
  (`bootstrap.js:3804`), `Document.elementFromPoint` is a stub that returns the
  deepest element by nid over synthetic bounding boxes or falls back to `<body>`
  (`:7316-7345`, comment at `:7304-7307`), and `Element.checkVisibility` always
  returns `true` (test `element_check_visibility_is_callable`,
  `runtime.rs:2439-2451`, comment: "Without a layout engine we can't compute it
  properly"). Playwright/Puppeteer actionability is *approximated*, not real.
- **Simplified event model.** No capture phase, `addEventListener` options
  (`once`/`capture`/`passive`) are ignored, bubbling is a manual `parentNode`
  walk, and there is no shadow-DOM event retargeting (`bootstrap.js:1225-1264`).
- **Shadow DOM is shallow.** `ShadowRoot` merely extends `DocumentFragment`
  (`:4025`); it is not a real encapsulation boundary.
- **Fake sockets/workers.** `WebSocket`/`EventSource` immediately transition to
  "open" and then drop `send()` — there is no real socket (`:7128-7165`,
  `send(){ /* drop; no real socket */ }`). `Worker` runs code paths in-process,
  not a real thread (`:6455`). `RTCPeerConnection`, media streams, speech synth
  are stubs (`:6261-6276`).
- **In-memory storage stubs.** `indexedDB` (`:6384`), `caches` (`:6399`), and
  `localStorage`/`sessionStorage` (`:4931-4932`) are memory-backed and not fully
  spec-complete.
- **WebCrypto is secret-key only.** RSA/ECDSA/ECDH and other public-key
  algorithms are rejected in the shim (`ops.rs:1386-1395`).
- **No CSS engine.** `matchMedia` returns `matches:false` (`:3781`,
  `MediaQueryList` at `:7178-7183`); media queries are not evaluated.
- **Stringly-typed, chatty DOM bridge.** Every DOM property access is an FFI
  round-trip through `op_dom` with `String` args and a `String`/JSON return
  (`bootstrap.js:70`, `ops.rs:125`). Batched helper ops
  (`node_index`/`compare_order`/`node_root`) were added specifically to reduce
  this cost, which signals it is a known hotspot.
- **Per-page config via string interpolation.** UA/platform/geo are injected by
  interpolating into scripts with only backslash/quote escaping
  (`runtime.rs:219-267`) — a narrow but real surface.
- **Non-evicting wrapper cache.** `_cache` (`bootstrap.js:2528`) never clears
  within an isolate; a fresh isolate per page is what actually bounds it.

## 10. Dependencies (Cargo.toml)

`deno_core = "0.350"` (also a build-dep for snapshotting), `obscura-dom`,
`obscura-net`, `tokio`, `serde`/`serde_json`, `url`, `reqwest`, `html5ever`,
`deno_error = "0.6"`, `base64`, and the RustCrypto stack for WebCrypto
(`sha1`, `sha2`, `hmac`, `aes`, `aes-gcm`, `cbc`, `ctr`, `pbkdf2`, `hkdf`) plus
`getrandom` for the CSPRNG. The `stealth` feature enables
`obscura-net/stealth` (wreq) so scripted requests carry the Chrome TLS
fingerprint (`Cargo.toml:6-11, 16-43`).

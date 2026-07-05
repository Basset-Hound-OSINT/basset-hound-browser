---
title: "Obscura Deep-Dive: obscura-mcp (Model Context Protocol server)"
date: 2026-07-03
researcher: Claude (architecture research subagent)
status: Complete
category: reverse-engineering / agent-integration
---

# obscura-mcp — Model Context Protocol server

## 1. Purpose

`obscura-mcp` turns the Obscura headless browser into a **Model Context Protocol (MCP) server** so MCP-capable agents (Claude Desktop, Claude Code, Cursor, etc.) can drive a live browser session by calling tools. It is a thin adapter: it implements the JSON-RPC 2.0 / MCP wire protocol, exposes a fixed catalog of `browser_*` tools, and maps each tool call onto the `obscura-browser` `Page` API (mostly by generating and running JavaScript in the page's V8 isolate).

Two transports ship in the same crate:

- **stdio** (default) — newline-delimited JSON on stdin/stdout, for clients that launch the binary as a subprocess. Entry point `obscura_mcp::run` in `crates/obscura-mcp/src/lib.rs:173`.
- **Streamable HTTP** — `POST /mcp` on a TCP listener, for remote/shared use. Entry point `obscura_mcp::http::run` in `crates/obscura-mcp/src/http.rs:64`.

The whole crate is ~2,231 lines across three files:

| File | Lines | Role |
|------|-------|------|
| `crates/obscura-mcp/src/lib.rs` | 1,771 | JSON-RPC dispatch, `BrowserState`, all 35 tool implementations, `tools/list` schema |
| `crates/obscura-mcp/src/http.rs` | 323 | Hand-rolled HTTP/1.1 transport, CORS/origin gating, body cap |
| `crates/obscura-mcp/tests/cors_preflight.rs` | 137 | Regression tests for CORS preflight (#175) and oversized body (DoS) |

Dependencies are minimal (`crates/obscura-mcp/Cargo.toml:10-19`): `obscura-browser`, `obscura-dom`, `obscura-net`, `tokio`, `url`, `serde`, `serde_json`, `anyhow`, `tracing`. Notably there is **no MCP SDK / rmcp / third-party JSON-RPC library** — the entire protocol is hand-implemented. A `stealth` feature (`Cargo.toml:8`) forwards to `obscura-browser/stealth` + `obscura-net/stealth`.

## 2. Where it sits in Obscura

Per `docs/Architecture-overview.md:1-12`, Obscura is an eight-crate workspace; `obscura-mcp` is described simply as "Model Context Protocol server." It is a **sibling** to `obscura-cdp` (the Chrome DevTools Protocol / WebSocket server): both are front-ends that ultimately drive `obscura-browser::Page`. The CLI (`obscura-cli`) is the single binary that hosts all front-ends and routes `obscura mcp` to this crate.

CLI wiring (`crates/obscura-cli/src/main.rs`):

- The `Mcp` subcommand is defined at `main.rs:169-184` with flags `--http`, `--host` (default `127.0.0.1`), `--port` (default `3000`), `--proxy`, `--user-agent`. Stealth is inherited from the **global** `--stealth` flag, not a per-subcommand flag.
- Dispatch at `main.rs:387-393`: `--http` → `obscura_mcp::http::run(...)`, otherwise `obscura_mcp::run(...)`.
- The process runs on a **single-threaded** tokio runtime: `#[tokio::main(flavor = "current_thread")]` at `main.rs:284`. This is mandatory because `Page` holds V8 handles and is `!Send` (see `http.rs:59-63` and the test rationale in `cors_preflight.rs:27-30`).

## 3. Protocol layer (JSON-RPC 2.0 / MCP)

### 3.1 Message types

`lib.rs:24-59` defines the wire types by hand:

- `RpcMessage` (`lib.rs:24-33`): `{ jsonrpc, id?, method, params }`. `id` is `Option<Value>`; absence marks a **notification**.
- `RpcResponse` (`lib.rs:35-43`) with `ok()`/`err()` constructors (`lib.rs:51-59`). Errors carry `{ code, message }` (`RpcError`, `lib.rs:45-49`).

### 3.2 Method router — `dispatch`

`dispatch` (`lib.rs:161-171`) is the shared method router used by **both** transports:

```rust
match method {
    "initialize"     => handle_initialize(id, params),
    "ping"           => RpcResponse::ok(id, json!({})),
    "tools/list"     => handle_tools_list(id),
    "tools/call"     => handle_tool_call(id, params, state).await,
    "resources/list" => RpcResponse::ok(id, json!({"resources": []})),
    "prompts/list"   => RpcResponse::ok(id, json!({"prompts": []})),
    _ => RpcResponse::err(id, -32601, format!("Unknown method: {method}")),
}
```

Coverage of the MCP surface is intentionally narrow:

- **`initialize`** (`lib.rs:214-226`) **ignores the client's requested `protocolVersion`** — it reads it into `_client_version` and discards it — and unconditionally replies `"protocolVersion": "2024-11-05"`, advertising only `capabilities.tools` (empty object) and `serverInfo { name: "obscura-mcp", version: CARGO_PKG_VERSION }`.
- **`resources/list`** and **`prompts/list`** return empty arrays. There are **no** MCP resources or prompts.
- There is **no** `resources/read`, `prompts/get`, `logging/*`, `completion/*`, `roots/*`, or `sampling/*` support, and the server **never sends server-initiated notifications** (no `notifications/tools/list_changed`, no `notifications/message`).

### 3.3 stdio transport — `run`

`run` (`lib.rs:173-212`) is a blocking read loop:

- Reads one line at a time (`read_line`, `lib.rs:184`); the transport is **newline-delimited JSON**, one message per line (`lib.rs:182`).
- Parse failures are **silently dropped** (`continue`, `lib.rs:194-197`) — no `-32700` error is returned to the client on stdio.
- Notifications (no `id`) get **no** response (`lib.rs:200-202`).
- Responses are serialized, a `\n` appended, written, and flushed (`lib.rs:207-210`).
- **stdio does not support JSON-RPC batching**: it deserializes a single `RpcMessage` per line (`lib.rs:194`); a top-level JSON array fails to parse and is dropped.

### 3.4 HTTP transport — `http::run` / `handle_connection`

`http.rs:64-79` binds a `TcpListener` and constructs **one** `BrowserState` (`http.rs:69`) that is shared, by `&mut`, across **every** accepted connection (`handle_connection(stream, &mut state, ...)`, `http.rs:75`). Connections are handled **sequentially on the current thread** (`http.rs:59-63`) because the state is `!Send`.

`handle_connection` (`http.rs:81-229`) is a **hand-written HTTP/1.1 parser** — no `hyper`/`axum`:

- Parses request line and headers by hand (`http.rs:90-135`), extracting `Content-Length`, `Origin`, `Accept: text/event-stream`, and `Connection: keep-alive`.
- Only the path `/mcp` is served; anything else → `404` (`http.rs:138-141`).
- **Method handling** (`http.rs:154-225`):
  - `OPTIONS` → `204 No Content` CORS preflight advertising `Access-Control-Allow-Methods: GET, POST, OPTIONS` and `Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key, mcp-protocol-version` (`http.rs:160-168`). The `mcp-protocol-version` / `Authorization` / `X-API-Key` entries exist to satisfy issue #175 (`cors_preflight.rs:1-5`).
  - `GET` with `Accept: text/event-stream` → an SSE response that **only emits `: ping` keep-alive comments every 15 s** (`http.rs:171-190`). It carries **no** JSON-RPC payloads — server→client streaming is a stub, not a working reverse channel.
  - `POST` → reads the body and runs `process_body` (`http.rs:192-219`). Missing `Content-Length` → `400`; body larger than `MAX_BODY_BYTES` → `413` **before** allocating (see §7).
  - anything else → `405` (`http.rs:221-224`).
- `process_body` (`http.rs:231-249`) **does support JSON-RPC batch arrays**: a top-level array is mapped element-wise through `process_one` (`http.rs:237-245`). This is a behavioral asymmetry vs. the stdio transport, which does not batch.
- `process_one` (`http.rs:251-257`) drops notifications (`id` absent → `None`) and otherwise calls the shared `dispatch`.

## 4. Session/state model — `BrowserState`

`BrowserState` (`lib.rs:61-78`) is the single mutable session object the whole server revolves around:

```rust
pub struct BrowserState {
    tabs: BTreeMap<String, Page>,      // keyed "tab-1", "tab-2", ... (stable order)
    active_tab: Option<String>,        // the tab every tool operates on
    tab_counter: u32,
    context: Arc<BrowserContext>,      // shared cookie jar / net stack
    user_agent: Option<String>,
    console_messages: Vec<String>,
    interactive_refs: HashMap<String, NodeId>,  // ref "e3" -> DOM node
}
```

Key design decisions:

- **Session-oriented, not URL-per-call.** The server "keeps a live browser session, so tools operate on the current page rather than taking a URL each call" (`docs/Use-the-MCP-server.md:44`). Agents navigate first, then read/act.
- **`BrowserContext::with_options("mcp", proxy, stealth)`** (`lib.rs:86`) creates a single shared browsing context (cookie jar, HTTP client, tracker blocklist). All tabs share this context (`Page::new(..., self.context.clone())`, `lib.rs:101,112`), so cookies are shared across tabs — and, on the HTTP transport, across **all connected clients** (§7).
- **Lazy tab creation.** `page_mut()` (`lib.rs:97-107`) auto-creates `tab-1` if none exists, so every legacy single-page tool works without an explicit `browser_tab_new`.
- **User-agent** is stored separately and applied per navigation via `page.http_client.set_user_agent(ua).await` (`lib.rs:696-701` in `tool_navigate`, and `lib.rs:1509-1513` in `tool_tab_new`) — it is **not** threaded through `BrowserContext::with_options` (which has no UA parameter, `crates/obscura-browser/src/context.rs:139-141`). `browser_back`/`browser_forward`/`browser_reload` re-navigate without re-applying the UA.

### 4.1 Single-live-isolate invariant (#258)

Because `rusty_v8` requires isolates be dropped in reverse creation order, only **one** tab's V8 isolate may be live at a time. `BrowserState` enforces this:

- `activate(tab_id)` (`lib.rs:125-134`): suspends (`suspend_js`) every other tab that `has_js()`, then `resume_js()` on the target. Explicitly mirrors the CDP server's `Dispatcher::get_session_page_mut` (`lib.rs:118-124`).
- `close_tab` (`lib.rs:139-144`) and `tool_close` (`lib.rs:934-946`) call `suspend_js` before removing so the map drop disposes no live isolate.

This is the single most load-bearing correctness constraint in the crate and is the reason the HTTP transport is single-threaded and sequential.

### 4.2 Element-ref system (the agent-ergonomics core)

Instead of forcing agents to author CSS selectors, tools accept a stable `ref` like `"e3"`:

- `rebuild_interactive_refs` (`lib.rs:1058-1087`): clears the table, then runs JS (`lib.rs:1062-1072`) that `querySelectorAll`s a fixed interactable set — `a[href], button, input:not([type=hidden]), select, textarea, [role=button|link|checkbox|tab|menuitem|option], [onclick], [tabindex]:not([tabindex="-1"])` — and stamps `data-obscura-ref="eN"` (DOM order) onto each. A second pass resolves each ref to a `NodeId` for validation (`lib.rs:1078-1085`).
- `ref_to_selector` (`lib.rs:151-158`) turns `"e3"` into the CSS selector `[data-obscura-ref="e3"]`, erroring if the ref is not registered.
- `resolve_target` (`lib.rs:668-676`) is the shared resolver: prefer `ref`, fall back to raw `selector`, else error "Missing 'ref' or 'selector'".
- The ref table is **aggressively invalidated** — cleared on navigate (`lib.rs:707`), click (`lib.rs:759`), scroll (`lib.rs:1419`), tab switch (`lib.rs:1542`), back/forward/reload, and form-submit — and rebuilt only by `browser_snapshot` (`lib.rs:714`) or `browser_interactive_elements` (`lib.rs:1014`). So an agent must re-snapshot after any DOM-changing action before its refs are valid again.

## 5. Tool catalog (35 tools)

`handle_tools_list` (`lib.rs:228-603`) returns a static array of **35** tool definitions with JSON-Schema `inputSchema`; `handle_tool_call` (`lib.rs:605-662`) has exactly 35 matching dispatch arms (`lib.rs:612-651`). Note the file-top comment at `lib.rs:1-4` says "32 tool definitions" and bumps `#![recursion_limit = "512"]` for the `json!` macro — the **comment is stale** (actual count is 35).

Tool results are always wrapped as MCP tool content: success → `{ content: [{ type: "text", text }] }`; a tool-level `Err` → the same shape plus `"isError": true` (`lib.rs:653-661`). Tool errors are therefore **not** JSON-RPC errors — they are successful responses with `isError`, per MCP tool semantics.

Every tool returns **plain text** (there are no `image`/`resource` content parts anywhere). Free-text page output is capped at `DEFAULT_TEXT_LIMIT = 4000` chars (`lib.rs:22`) via `truncate` (`lib.rs:681-688`), which appends `...(truncated, N more chars)`.

### 5.1 By category (with implementation citations)

**Navigation / lifecycle**
- `browser_navigate` (`lib.rs:690-709`): `navigate_with_wait` with `waitUntil ∈ {load, domcontentloaded, networkidle0}` (schema `lib.rs:238-243`; `WaitUntil::from_str`, `lib.rs:695`).
- `browser_back` / `browser_forward` (`lib.rs:1089-1127`): walk `page.history` / `history_index`; re-navigate at `DomContentLoaded` and then **restore** the stashed history so the back/forward navigation doesn't itself append history.
- `browser_reload` (`lib.rs:1129-1138`): refuses `about:blank`.
- `browser_close` (`lib.rs:934-946`): suspends every isolate, clears all tabs/refs/console.

**Read the page**
- `browser_snapshot` (`lib.rs:711-738`): `URL`, `Title`, then body text via the Rust-side `extract_text` DOM walker (`lib.rs:1567-1618`, which block-formats and skips `script/style/noscript`). Also rebuilds refs and appends a "N interactive element(s) registered" hint.
- `browser_markdown` (`lib.rs:953-960`): runs the shared `obscura_browser::HTML_TO_MARKDOWN_JS` converter (re-exported from `obscura-js`, `crates/obscura-browser/src/lib.rs:9`) — the same one behind `obscura fetch --dump markdown`.
- `browser_links` (`lib.rs:964-1006`): JS enumerates `a[href]`, dedupes, drops `#`/`javascript:`; optional `internal_only` filters by same-origin using `url::Url::origin`.
- `browser_interactive_elements` (`lib.rs:1012-1052`): lists refs with tag/type/role/name/label.
- `browser_detect_forms` (`lib.rs:1221-1278`): JS walks every `<form>`, emitting action/method and per-field metadata (name/type/value/checked/required/label via `<label for>`/aria/placeholder, `<select>` options, and the field's `data-obscura-ref` if present).
- `browser_get_attribute` (`lib.rs:1423-1442`): reads an attribute; falls back to `.value` when attribute is `value`.
- `browser_count` (`lib.rs:1444-1458`): `querySelectorAll(sel).length`, coercing V8's f64 to u64 (`lib.rs:1454-1456`).
- `browser_search` (`lib.rs:1625-1674`): substring search over `extract_text(body)` with context windows; carefully snaps byte offsets to `char_boundary` to avoid a CJK slice panic (#257, `lib.rs:1649-1652`).
- `browser_extract` (`lib.rs:1464-1503`): a mini-DSL — `schema` maps `field → selector`; suffix the field name with `[]` for an array, suffix the selector with `@attr` to read an attribute instead of text.

**Interact**
- `browser_click` (`lib.rs:740-762`), `browser_fill` (`lib.rs:764-788`), `browser_type` (`lib.rs:790-813`), `browser_press_key` (`lib.rs:815-839`), `browser_select_option` (`lib.rs:841-868`), `browser_scroll` (`lib.rs:1375-1421`), `browser_fill_form` (`lib.rs:1284-1370`, batches text/check/uncheck/select + optional submit-click).

**Wait / run JS**
- `browser_wait_for` (`lib.rs:882-909`) and `browser_wait_for_text` (`lib.rs:1190-1213`): poll with **exponential backoff 5→200 ms** (`lib.rs:892-907`, `1201-1211`), default 30 s timeout.
- `browser_evaluate` (`lib.rs:870-880`): runs an arbitrary JS expression via the synchronous `Page::evaluate` and stringifies the result.

**Diagnostics**
- `browser_network_requests` (`lib.rs:911-924`): formats `page.network_events` as `[status] method url (NB)`.
- `browser_console_messages` (`lib.rs:926-932`): returns `state.console_messages` — **see the gap in §8; this vector is never populated.**

**Cookies / storage**
- `browser_get_cookies` (`lib.rs:1140-1159`), `browser_set_cookie` (`lib.rs:1161-1183`), `browser_clear_cookies` (`lib.rs:1185-1188`): operate directly on `state.context.cookie_jar`.
- `browser_storage_state` (`lib.rs:1679-1705`) / `browser_set_storage_state` (`lib.rs:1707-1771`): export/import a Playwright-style `{cookies, origins:[{origin, localStorage, sessionStorage}]}` bundle. Storage is read/written via JS against **only the current page's origin** (`lib.rs:1691-1702`, `1730-1768`).

**Tabs**
- `browser_tab_new` (`lib.rs:1505-1520`), `browser_tab_list` (`lib.rs:1522-1533`), `browser_tab_switch` (`lib.rs:1535-1544`), `browser_tab_close` (`lib.rs:1546-1565`).

### 5.2 How tools map to browser actions

The dominant pattern is **generate JavaScript, run it in the page isolate, parse the JSON result**. `tool_click`, `tool_fill`, `tool_type`, `tool_select_option`, `tool_fill_form`, `tool_scroll`, `tool_get_attribute`, `tool_count`, `tool_extract`, `tool_links`, `tool_detect_forms`, `tool_interactive_elements`, `rebuild_interactive_refs`, and the storage tools all build a JS string (with `serde_json::to_string` for safe interpolation of selectors/values) and call `state.page_mut().evaluate(&js)`. Only a few tools use native Rust paths instead: `browser_snapshot`/`browser_search` walk the DOM via `page.with_dom` + `extract_text`; `browser_wait_for` polls `dom.query_selector`; the cookie tools hit `context.cookie_jar`; navigation uses `page.navigate_with_wait`.

The underlying `Page::evaluate` (`crates/obscura-browser/src/page.rs:1276-1295`) is **synchronous** and returns `Value::Null` on any JS error (errors are only `tracing::debug!`-logged, `page.rs:1281-1282`). Consequences: (1) `browser_evaluate` **cannot await a Promise** — the async `evaluate_for_cdp` path (`page.rs:1298+`) is not used here; (2) JS exceptions surface to the agent as `null`/empty rather than a real error message; (3) tools infer failure from sentinel strings like `"error:element not found"` (`lib.rs:754,783,808,864-865`).

## 6. Data structures

- `RpcMessage` / `RpcResponse` / `RpcError` (`lib.rs:24-49`) — hand-rolled JSON-RPC envelopes.
- `BrowserState` (`lib.rs:61-78`) — the session; see §4.
- Interactive-ref table `HashMap<String, NodeId>` (`lib.rs:77`) — ref→node.
- `NetworkEvent` fields consumed by `browser_network_requests` (`lib.rs:919-921`): `status`, `method`, `url`, `body_size` (defined in `obscura-browser`, `page.rs:169`).
- HTTP transport has no structs of its own beyond two consts: `MAX_BODY_BYTES = 16 MiB` (`http.rs:13`) and the `OBSCURA_MCP_ALLOWED_ORIGINS` env read (`http.rs:18-22`).

## 7. Security posture

Documented in `docs/Use-the-MCP-server.md:29-40`; implemented in `http.rs`:

- **No authentication.** "The HTTP transport has no built-in auth, so anyone who can reach the port can drive the browser" (`docs/Use-the-MCP-server.md:31`). The `Authorization`/`X-API-Key` headers are only *allowed through CORS preflight* (`http.rs:164`); nothing in the server ever validates them.
- **Origin allowlist.** `OBSCURA_MCP_ALLOWED_ORIGINS` (comma-separated) is read at `http.rs:18-22`; `origin_allowed` (`http.rs:29-42`) enforces it case-insensitively. **Unset ⇒ fully permissive** (returns `true` for any origin, `http.rs:30-31`) and CORS replies `Access-Control-Allow-Origin: *` (`cors_header`, `http.rs:49-57`). A **request with no `Origin` header is always allowed** (`http.rs:32-34`) — the check only constrains browser callers; native MCP clients bypass it entirely.
- **Body cap.** `MAX_BODY_BYTES = 16 MiB` (`http.rs:13`); an oversized `Content-Length` is rejected with `413` **before** `vec![0u8; len]` is allocated (`http.rs:204-207`), closing an unauthenticated OOM/DoS (regression-tested in `cors_preflight.rs:88-137`).
- **Default bind is loopback.** `--host` defaults to `127.0.0.1` (`main.rs:173-174`); binding `0.0.0.0` is an explicit opt-in.

**Shared-session caveat (not called out in docs):** the HTTP server builds **one** `BrowserState` (`http.rs:69`) shared across all connections. There is **no per-client isolation, no session IDs, and no `Mcp-Session-Id` handling** — every HTTP client drives the *same* tabs and the *same* cookie jar. Combined with "no auth," any reachable client can read another client's authenticated session state.

## 8. Limitations & coverage gaps

These are as important as the features for a comparison baseline:

1. **`browser_console_messages` is inert.** `state.console_messages` is declared (`lib.rs:71`), initialized empty (`lib.rs:88`), read (`lib.rs:926-932`), and cleared (`lib.rs:943`), but **nothing ever pushes into it** (verified: no `.push` on `console_messages` anywhere in the crate). The tool therefore *always* returns "No console messages." — the console-capture feature is effectively unimplemented.
2. **No screenshot / PDF / visual output.** There is no `browser_screenshot`, `browser_pdf`, or any image content part. Obscura has no layout engine, so pixel output isn't meaningful — and `browser_scroll` says so explicitly: "we don't have a real layout engine, so the `window.scrollY` value won't change but the event is what matters" (`lib.rs:1396-1397`). Scrolling only dispatches a synthetic `scroll` event to trigger infinite-scroll handlers.
3. **No true async JS.** `browser_evaluate` uses the synchronous `Page::evaluate`; it cannot await Promises and swallows exceptions as `null` (§5.2).
4. **No file upload, dialog handling, drag/hover, or `iframe`/frame targeting.** Interaction is limited to click/fill/type/press-key/select/scroll on the top document.
5. **stdio drops malformed input and cannot batch.** Parse errors are silently ignored with no `-32700` (`lib.rs:194-197`), and batch arrays are unsupported on stdio (only HTTP batches, §3.4).
6. **`initialize` ignores client protocol version** and pins `2024-11-05` (`lib.rs:215-217`); no version negotiation.
7. **No server-initiated messages.** The SSE `GET` handler only sends keep-alive comments (`http.rs:182-188`); there is no reverse channel for notifications, streaming tool progress, or `tools/list_changed`.
8. **No persistence across process restarts.** The `Mcp` subcommand exposes **no `--storage-dir`** (`main.rs:169-184`), unlike `serve`/`fetch`. Session state survives only in memory; the only durable path is the agent manually exporting/importing via `browser_storage_state` / `browser_set_storage_state`.
9. **No rate limiting or concurrency.** HTTP connections are handled strictly sequentially (`http.rs:59-63,72-78`); a slow tool call blocks all other clients.
10. **No MCP resources/prompts/roots/sampling.** Only `tools` is advertised; `resources/list` and `prompts/list` are hardcoded empty (`lib.rs:167-168`).

## 9. Agent-integration surface (summary)

- **Install (stdio):** `claude mcp add obscura /path/to/obscura mcp`, or a Claude Desktop `mcpServers` entry with `command`/`args: ["mcp"]` (`docs/Use-the-MCP-server.md:77-98`). Stealth via `args: ["mcp", "--stealth"]` (`docs/Use-the-MCP-server.md:100-111`).
- **Install (HTTP):** `obscura mcp --http --host 0.0.0.0 --port 3000`; endpoint `POST http://host:port/mcp` (`docs/Use-the-MCP-server.md:11-21`, `README.md:415-431`).
- **Workflow contract:** navigate → snapshot/interactive_elements (get refs) → click/fill by `ref` → wait_for(_text) → extract/markdown/search. Refs are the primary affordance; raw CSS selectors are the scripted-client fallback (`lib.rs:664-676`).
- **Token hygiene** is a deliberate design theme: 4 KB default text cap, `max_chars`/`limit` params, one-JSON-object-per-line output for `links`/`cookies`, and `browser_search` to locate content without dumping the page (`lib.rs:18-22, 681-688, 1622-1624`).

## 10. Comparison notes for Basset Hound

- Obscura's MCP is **stateful/session-centric** (live tabs, shared cookie jar) whereas a URL-per-call design would be stateless; Basset Hound's 164-command WebSocket API is closer to Obscura's *CDP* server than its MCP server.
- Obscura hand-rolls both JSON-RPC and HTTP (no framework, no MCP SDK) — small surface, but it means no session isolation and a stub SSE channel.
- The **`data-obscura-ref` element-ref pattern** (snapshot returns stable `eN` handles the model clicks by) is the notable agent-UX idea worth contrasting against Basset Hound's selector-based commands.
- Security is minimal-by-default (loopback + optional origin allowlist + body cap, no auth), and the HTTP transport's single shared session is a concrete multi-tenant hazard to avoid replicating.
</content>

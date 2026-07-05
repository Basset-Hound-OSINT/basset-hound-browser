---
title: "Obscura → Basset Hound: Adoption Recommendations"
date: 2026-07-03
researcher: Claude (architecture research agent)
status: Complete
category: adoption-recommendations
---

# Obscura → Basset Hound: Adoption Recommendations

## Purpose and how to read this

This is the payoff document of the Obscura research series. It maps concrete
mechanisms in the open-source Apache-2.0 Rust headless browser **Obscura**
(`/home/devel/tmp/obscura`, git `ca71ce3`) to specific decisions the **Basset
Hound Browser** (`/home/devel/basset-hound-browser`, Electron + WebSocket API,
v12.8.0) should make. Every recommendation is grounded in a named Obscura source
file and, where possible, a line or symbol. Each item carries a verdict:

- **ADOPT** — a pattern worth porting more or less directly.
- **ADAPT** — the idea is right, but the mechanism is Obscura-specific (Rust /
  single-V8-isolate) and must be reshaped for Electron/Chromium.
- **REJECT** — an Obscura design that is a *consequence of Obscura's
  constraints*, not a feature, and would be a regression for Basset Hound.

### The one architectural fact that frames everything

Obscura and Basset Hound are on opposite sides of a fundamental divide.

Obscura is a **from-scratch browser engine**: it has its own DOM
(`crates/obscura-dom/src/tree.rs`), its own JS runtime built on `deno_core`/V8
(`crates/obscura-js/src/runtime.rs`), its own HTTP stack
(`crates/obscura-net/src/client.rs`), and it re-implements the Chrome DevTools
Protocol on top of those (`crates/obscura-cdp/`). It has **no layout, paint, or
compositor engine at all** — `Page.captureScreenshot` and `Page.printToPDF`
return hard errors (`crates/obscura-cdp/src/domains/page.rs:496-520`):

```rust
// crates/obscura-cdp/src/domains/page.rs:510
"captureScreenshot" | "captureSnapshot" => {
    Err(format!(
        "Page.{method} is not supported by Obscura: no layout or paint engine. \
         For visual snapshots, drive a real headless Chromium for the \
         screenshot leg of your pipeline and use Obscura for the scraping leg."
    ))
}
```

Basset Hound is an **Electron app** (`package.json` `"main": "src/main/main.js"`),
i.e. it *embeds real Chromium* — real DOM, real V8-per-renderer, real compositor,
real screenshots. Its stated purpose is *forensic capture* (screenshots,
full-page capture, image metadata: `extraction/`, `screenshots/`,
`evidence/`), which is exactly the thing Obscura explicitly cannot do.

**Therefore the value of this study is almost entirely in Obscura's *peripheral*
engineering — network security, robustness bounding, cookie correctness,
fingerprint consistency, agent-facing ergonomics, and process topology — not in
its core engine.** Anywhere Obscura reinvents a browser primitive, Basset Hound
already has the real thing and should not copy the reinvention. The rest of this
document is organized around that line.

---

## Part 1 — ADOPT: patterns to port

### 1.1 DNS-resolution-time SSRF guard (highest priority)

**Obscura mechanism:** `crates/obscura-net/src/client.rs`.

Obscura centralizes an SSRF deny-set in one function, `is_forbidden_ip`
(`client.rs:101-128`), and enforces it in **two** places that "can never
disagree":

1. `validate_url` (`client.rs:172-221`) rejects literal forbidden hosts and the
   `localhost`/`127.0.0.1`/`::1` domain forms up front, and is re-run on **every
   redirect hop** (`client.rs:565`).
2. `SsrfGuardResolver` (`client.rs:137-170`) is installed as reqwest's DNS
   resolver (`client.rs:359`) and rejects the request if **any resolved address**
   is in the deny-set — closing the DNS-rebinding bypass that a host-string check
   alone cannot (`client.rs:130-136`).

The deny-set is unusually complete and each entry is regression-tested
(`client.rs:648-711`): loopback, RFC1918, link-local **including the
`169.254.169.254` cloud-metadata endpoint**, broadcast, documentation,
unspecified (`0.0.0.0`/`::`, which the OS routes to localhost), IPv6 unique-local
`fc00::/7`, and **IPv4-mapped/compatible IPv6 forms** (`::ffff:127.0.0.1`) that
would otherwise slip past the v6 arm (`client.rs:119-124`). There is a single
explicit escape hatch, `--allow-private-network` / `OBSCURA_ALLOW_PRIVATE_NETWORK`
(`client.rs:82-92`, `docs/Environment-variables.md:3-15`), off by default.

**Basset Hound gap:** Basset only validates *proxy* URLs
(`src/proxy/proxy-url-validator.js`) and *webhook* URLs
(`src/monitoring/webhook-url-validator.js`), and does so with **literal-host
regexes** (`proxy-url-validator.js:259-263`: `/^192\.168\./`, `/^10\./`, …).
There is no evidence of an SSRF gate on the **navigation targets** the browser
itself fetches, and a literal-regex check is DNS-rebind-bypassable. A browser
automation API that will `Navigate` to attacker-influenced URLs is a textbook
SSRF vector into the host's cloud-metadata endpoint and internal network.

**Recommendation (ADOPT):** Port `is_forbidden_ip`'s deny-set verbatim (it is the
most valuable 30 lines in the repo) and enforce it at DNS-resolution time for
*navigation and in-page subresource fetches*, not just proxy/webhook config.
Electron's `session.resolveProxy` / a custom `net` lookup or a
`will-navigate`/`onBeforeRequest` interceptor can host the check. Keep the
single documented opt-out, default-deny. Mirror Obscura's redirect re-validation:
re-check every 3xx `Location` (`client.rs:557-566`).

### 1.2 Per-command deadline enforced by a single shared watchdog

**Obscura mechanism:** `crates/obscura-js/src/cdp_watchdog.rs` +
`OBSCURA_CDP_COMMAND_TIMEOUT_MS` (`docs/Environment-variables.md:25-31`).

Because Obscura serializes all V8 work behind one process-wide lock, a runaway
page could wedge every other session. Obscura arms a single long-lived watchdog
thread around every CDP command (`cdp_watchdog.rs:88-102` `arm` /
`cdp_watchdog.rs:107-117` `disarm`) with a deadline; if the command overruns, the
watchdog terminates it (`cdp_watchdog.rs:57-63`). The key design note
(`cdp_watchdog.rs:1-12`) is that they deliberately use **one shared watchdog +
condvar**, not a thread-per-command, because thread spawn/join added ~240µs to
the hot path. Default 60s, `0` disables.

**Basset Hound gap:** `websocket/command-dispatcher.js` exposes
`async execute(command, params, options)` (`command-dispatcher.js:88`) with no
visible per-command timeout/deadline. A command handler that hangs (a stuck
`Navigate`, an infinite `Execute JavaScript`) has no server-side ceiling.

**Recommendation (ADAPT):** Basset does not have Obscura's single-isolate
constraint — Electron gives each `BrowserWindow`/`webContents` its own renderer
process — so you do **not** need the "one shared V8 terminate" mechanism. Adopt
the *contract*: every dispatched command runs under a configurable deadline
(`Promise.race` against a timeout), and on overrun the offending
`webContents`/session is torn down rather than left holding resources. Expose it
as one env/config knob with a sane default and a `0`-disables option, exactly as
Obscura does. This is a small change with large blast-radius protection.

### 1.3 One page must never crash or wedge the whole server (robustness invariants)

**Obscura mechanism:** several, called out as "do not remove" invariants in
`AGENTS.md:107-116` and `docs/Architecture-overview.md:59-61`:

- **Panic-safe ops:** `op_dom` wraps its body in `catch_unwind`
  (`crates/obscura-js/src/ops.rs:132-138`) so a DOM-op panic returns `null`
  instead of aborting the process; the release profile pins `panic = "unwind"`
  (root `Cargo.toml`) so `catch_unwind` actually works.
- **Bounded queues everywhere:** the interception deferral queue is capped at
  `MAX_DEFERRED_MESSAGES = 256` (`crates/obscura-cdp/src/server.rs:19`) and the
  WS-handoff channel at `MAX_PENDING_WS_HANDOFFS = 128`
  (`server.rs:29`), each with an explicit comment that an unbounded queue would
  OOM the process under a stalled backend. When the cap is hit, the server fails
  *loudly* — an error response to the client (`server.rs:715-731`) or a dropped
  connection (`server.rs:281-289`) — never a silent pile-up.
- **Cycle guards on tree mutation:** `append_child`/`insert_before` reject cyclic
  reparents (`AGENTS.md:98-102`), because a cyclic reparent once made
  `descendants()` loop forever, uninterruptible by the watchdog.

**Recommendation (ADOPT the discipline).** The specific bugs are Obscura's, but
the invariants generalize to any long-running automation server: (a) every
internal queue between the WS accept path and the executor must be **bounded and
fail loudly** — audit Basset's `websocket/connection-pool.js` and any
command/event buffers for unbounded growth under a stalled handler; (b) a handler
throwing must degrade to an error response, never crash the dispatcher; (c) treat
"one session cannot starve or OOM the others" as a written, tested invariant, the
way `AGENTS.md` does.

### 1.4 Control-plane / data-plane separation on the listener

**Obscura mechanism:** `crates/obscura-cdp/src/server.rs:126-175` +
`crates/obscura-cdp/tests/control_plane_unblocked.rs`.

Obscura's HTTP control endpoints (`/json/version`, `/json/list`,
`/json/protocol`) are served from a **dedicated OS accept thread with blocking
I/O** (`server.rs:157-175`, `handle_http_json_blocking` `server.rs:293-334`), so
they stay reachable even while V8 evaluation blocks the tokio `LocalSet`. Only
WebSocket upgrades are forwarded into the busy executor (`server.rs:281-289`).
The comment at `server.rs:126-131` frames it explicitly: the control plane must
remain reachable "even while V8 JS evaluation blocks the LocalSet thread." Nagle
is also disabled per-socket (`server.rs:204-213`) and the WS write buffer zeroed
(`server.rs:928-931`) to cut per-frame latency.

**Basset Hound relevance:** Basset already has `websocket/health-endpoint.js` and
`websocket/diagnostics-api.js`. The lesson is topological: **health/liveness and
introspection endpoints must not share the same execution path that a heavy
command can block.** If a page render or a synchronous handler stalls the event
loop, `/health` must still answer or an orchestrator will kill a container that is
merely busy.

**Recommendation (ADOPT the separation).** Verify that Basset's health/diagnostics
responses are produced independently of the command executor (a separate
lightweight HTTP path, or answered before any heavy work is scheduled). Node is
single-threaded, so the analog to Obscura's separate accept thread is to keep
health handlers off the same synchronous critical section as command execution —
or move heavy synchronous work into the renderer/util processes so the main
process's health path stays responsive.

### 1.5 Fast-path acknowledgement for cheap no-op commands

**Obscura mechanism:** `fast_path_response` (`server.rs:864-909`).

A large set of "enable/ack" CDP commands (`Network.enable`, `Page.enable`,
`Runtime.runIfWaitingForDebugger`, `Target.getBrowserContexts`, …) are answered
directly on the connection task with a canned response, **bypassing the serialized
executor queue** (`server.rs:867-899`). The comment at `server.rs:891-899` is
pointed: Puppeteer issues `Target.getBrowserContexts` as its *first* command on
connect, and if it queues behind a long navigation the client hits
`protocolTimeout`. Fast-pathing it removes a head-of-line-blocking failure mode.

**Recommendation (ADOPT).** Basset's `websocket/command-registry.js` /
`command-dispatcher.js` should classify trivially-cheap commands (capability
queries, no-op enables, status pings) and answer them without entering whatever
serialized/queued path the expensive commands use. This directly prevents client
timeouts caused by head-of-line blocking behind a slow capture.

### 1.6 RFC 6265-correct cookie jar with security-first defaults and durable persistence

**Obscura mechanism:** `crates/obscura-net/src/cookies.rs`.

This is the most carefully-written file in the repo and its choices are worth
copying wholesale:

- **Host-only by default:** a cookie with no `Domain` attribute is stored
  host-only and never sent to subdomains (`cookies.rs:551-568`
  `resolve_cookie_domain`, tested at `cookies.rs:924-937`).
- **Domain-attribute validation blocks cross-domain planting:** a `Domain` that
  does not domain-match the origin is ignored (the cookie falls back to
  host-only), which is exactly the fix for GHSA-f22c-8v6q-v6h6
  (`cookies.rs:107-113`, tests `cookies.rs:882-922`). Single-label public
  suffixes (`com`, `local`) are rejected.
- **Full attribute correctness:** `Secure` not sent over http, `HttpOnly` hidden
  from `document.cookie` (`get_js_visible_cookies` `cookies.rs:233-273`),
  `Max-Age=0` deletes, `SameSite` normalized case-insensitively
  (`cookies.rs:10-17`), expiry honored.
- **Atomic persistence:** `save_to_file` writes to a `NamedTempFile` then
  `persist()`-renames (`cookies.rs:457-461`) so a crash mid-write cannot corrupt
  the cookie store; `load_from_file` merges rather than clobbers
  (`cookies.rs:468-480`).
- **Flush on shutdown, including SIGTERM:** `cdp_processor` saves cookies at its
  single exit point (`server.rs:457`), and the shutdown future watches **both
  SIGINT and SIGTERM** so `docker stop` / `kill` also flush (`server.rs:375-395`,
  issue #333).

**Basset Hound relevance:** Basset has a `cookies/` directory and cookie
management commands. Electron's own cookie store handles wire correctness, but the
*persistence and cross-domain-safety posture* is the transferable part.

**Recommendation (ADOPT the posture):** (a) if Basset serializes cookies/profiles
to disk, use temp-file-plus-rename atomic writes; (b) flush persistent state on
**SIGTERM as well as SIGINT** so container stops don't lose captured session state
— this is a one-line-of-thinking fix with real forensic-integrity payoff; (c) if
Basset ever imports cookies from untrusted exports, apply the
`resolve_cookie_domain` domain-match validation to avoid cross-domain cookie
injection.

### 1.7 Fingerprint self-consistency as the organizing principle (not randomization)

**Obscura mechanism:** `crates/obscura-browser/src/profiles.rs`,
`crates/obscura-net/src/wreq_client.rs:20-33`, `docs/Configure-stealth-and-proxies.md:66-89`.

Obscura's entire stealth philosophy is *internal consistency across every layer a
site can cross-check*, and it is stated bluntly:

- A `BrowserProfile` bundles UA string, `navigator.platform`, `userAgentData`
  platform + version together as one unit (`profiles.rs:1-57`), and the docs add
  that Windows profiles report ANGLE Direct3D11 GPU renderers while macOS
  profiles report ANGLE Metal (`Configure-stealth-and-proxies.md:68`). The point
  is that these surfaces must *agree*.
- In stealth mode the `wreq` client's TLS ClientHello, ALPN, and cipher order are
  fixed to Chrome-145-on-Windows and the constants that `navigator` must report
  are pinned to match (`wreq_client.rs:24-33`: "otherwise the TLS/HTTP layer and
  the JS layer disagree and a site cross-checks the mismatch as a bot signal").
- Even the non-stealth HTTP path derives `sec-ch-ua` client hints from the UA
  string via Chromium's GREASE algorithm (`client.rs:280-314`) so the header layer
  agrees with `navigator.userAgentData`.
- **Rotation is opt-in, and the docs explain why:** "One IP cycling through
  different identities is itself a signal" (`Configure-stealth-and-proxies.md:70`,
  `profiles.rs:68-75`). Timezone (`OBSCURA_TIMEZONE`) and geolocation
  (`OBSCURA_GEOLOCATION`) are meant to be aligned to the exit IP's region
  (`Configure-stealth-and-proxies.md:77-89`).

**Basset Hound relevance:** Basset's `evasion/` (`fingerprint.js`,
`fingerprint-profile.js`, `behavioral-ai.js`) and MEMORY.md emphasize
*randomized* fingerprint spoofing and per-vector evasion effectiveness. Obscura's
lesson is a partial course-correction: **coherence across layers beats
randomization**, and rotating identity from a single IP can *hurt*.

**Recommendation (ADAPT / partial REJECT of pure randomization):** Model
fingerprints as whole coherent *personas* (UA + platform + userAgentData + GPU
renderer + TLS profile + timezone + geolocation), validated to agree, rather than
independently-randomized knobs. Make identity rotation an explicit, IP-aware
decision, not the default. Concretely, cross-check that Basset's
`fingerprint-profile.js` never emits a `navigator.platform` that disagrees with
its UA or its TLS fingerprint — that cross-layer mismatch is the single most
common self-inflicted bot signal, and it is the exact failure Obscura's design
exists to prevent.

### 1.8 Bundled tracker/analytics blocklist at the network layer

**Obscura mechanism:** `crates/obscura-net/src/blocklist.rs` + `pgl_domains.txt`.

A ~3,500-domain Peter Lowe blocklist is embedded at compile time
(`blocklist.rs:5` `include_str!`), parsed once into a `HashSet` behind a
`OnceLock` (`blocklist.rs:7-22`), and matched with a **suffix walk** so
`www.google-analytics.com` matches the `google-analytics.com` entry
(`is_blocked` `blocklist.rs:24-40`). It is applied before any request leaves the
process on both the default and stealth clients (`client.rs:402-414`,
`wreq_client.rs:79-90`), and blocked requests return a synthetic `status: 0`
empty response rather than an error, so page logic keeps working.

**Recommendation (ADOPT the shape).** Basset already has `blocking/filters.js` +
`blocking/manager.js`; the transferable details are: compile/load the list once
into a hash set, match by *suffix walk with a `.` boundary* (not substring — a
substring match would over-block), and return a benign empty response for blocked
subresources so the page doesn't error. Obscura's boundary-correct
`is_blocked`/`domain_matches` (`cookies.rs:570-591`) is a good reference for the
"suffix with dot boundary" comparison, which avoids `notgoogle-analytics.com`
false positives.

### 1.9 Agent-facing element-ref snapshot model for the MCP surface

**Obscura mechanism:** `crates/obscura-mcp/src/lib.rs`.

Obscura's MCP server gives AI agents a *ref-based* interaction model instead of
CSS selectors:

- `browser_snapshot` / `browser_interactive_elements` return every clickable /
  typeable element tagged with a stable ref id (`e3`), and the tool descriptions
  tell the agent to use refs "instead of guessing a CSS selector"
  (`lib.rs:385-386`).
- Refs are stored in `interactive_refs` (`lib.rs:61-77`), written into the DOM as
  `data-obscura-ref="eN"` so the ref resolves to a unique selector
  (`lib.rs:146-157`), and **invalidated on every navigation / tab switch**
  (`lib.rs:114`) so an agent can never act on a stale ref.
- Text output is capped at `DEFAULT_TEXT_LIMIT = 4000` chars unless the caller
  overrides (`lib.rs:18-22`) so a single tool call can't burn an agent's context
  window on a multi-KB page dump.
- A `browser_markdown` tool returns token-dense structured content as an
  alternative to raw text (`lib.rs:364-365`).

**Basset Hound relevance:** Basset integrates with Claude/palletai agents via MCP
(MEMORY.md), and its MCP server is flagged as needing a refactor with "164 tools."

**Recommendation (ADOPT for the agent surface):** (a) stable element *refs* that
resolve to unique selectors and auto-invalidate on navigation are far more robust
for agents than raw selectors — port the `data-*-ref` + snapshot pattern; (b) cap
text/HTML tool outputs by default with an override, to protect the agent's
context window; (c) offer a markdown/structured extraction tool as a token-dense
alternative to full HTML. A leaner, ergonomic tool surface (Obscura ships ~35
`browser_*` tools, `lib.rs:232-588`) is also a useful counter-model to Basset's
164-tool sprawl — fewer, higher-level, agent-shaped tools reduce misuse.

### 1.10 Typed request-interception resolution model

**Obscura mechanism:** `crates/obscura-net/src/interceptor.rs` +
`crates/obscura-cdp/src/server.rs:460-502`.

Interception is a single small typed enum, `InterceptAction`
(`interceptor.rs:5-10`): `Continue`, `Block`, `Fulfill(Response)`,
`ModifyHeaders(map)`, behind an async `RequestInterceptor` trait
(`interceptor.rs:12-15`). The CDP `Fetch` domain bridges this to the wire:
`Fetch.requestPaused` is emitted, and `handle_fetch_resolution`
(`server.rs:460-502`) maps `Fetch.continueRequest`/`fulfillRequest`/`failRequest`
back to a matching `InterceptResolution::{Continue, Fulfill, Fail}` via a per-
request `oneshot` channel keyed on `requestId` (`server.rs:471-495`). The public
library exposes the same three-way resolution and — critically — re-runs the SSRF
gate (`validate_fetch_url`) on any `Continue`-with-URL-rewrite (`AGENTS.md:74`).

**Recommendation (ADOPT the model).** Basset's request-interception commands
(`headers/`, `network/`, ad/tracker blocking) should converge on one small typed
resolution vocabulary — continue / block / fulfill / modify-headers — rather than
ad-hoc per-feature paths, and any interceptor that *rewrites* a URL must re-run
the SSRF gate from 1.1 on the rewritten target. Obscura's insistence on
re-validating rewritten URLs (`AGENTS.md:74`) is a subtle but important security
detail.

### 1.11 Env-var tunables with sane defaults and permissive truthy parsing

**Obscura mechanism:** `docs/Environment-variables.md`.

Every robustness bound and identity knob is a documented env var with a default
and, for booleans, a consistent truthy parser accepting `1|true|yes|on`
(`client.rs:82-92`). Examples: `OBSCURA_NAV_TIMEOUT_MS` (30s),
`OBSCURA_CDP_COMMAND_TIMEOUT_MS` (60s, `0` disables), `OBSCURA_FETCH_TIMEOUT_MS`
(30s), `OBSCURA_TIMEZONE`, `OBSCURA_GEOLOCATION`, `OBSCURA_PROFILE`,
`OBSCURA_MCP_ALLOWED_ORIGINS`.

**Recommendation (ADOPT the hygiene).** Surface Basset's timeouts and
identity/region settings as documented, defaulted, `0`-disable-able knobs with a
single shared truthy parser, and keep the "documented default + one escape hatch"
convention. This is cheap and pays off in ops.

### 1.12 MCP HTTP transport hardening: Origin allowlist + body cap

**Obscura mechanism:** `docs/Environment-variables.md:87-93`,
`docs/Run-in-production-at-scale.md:123-132`,
`crates/obscura-mcp/tests/cors_preflight.rs`.

The HTTP MCP transport binds `127.0.0.1` by default; `OBSCURA_MCP_ALLOWED_ORIGINS`
adds an `Origin` allowlist that `403`s a browser page whose Origin isn't listed
(while still allowing native no-Origin clients), and request bodies are capped at
16 MiB. The threat model is explicit: stop a cross-origin web page from driving a
loopback MCP port.

**Recommendation (ADOPT).** If Basset exposes MCP or its WebSocket API over HTTP,
default-bind loopback, add an `Origin` allowlist for browser-originating requests,
and cap request body size. DNS-rebinding a browser tab into a localhost automation
port is a real attack against local agent tooling.

---

## Part 2 — ADAPT: process topology worth mirroring, mechanism differs

### 2.1 Process-per-worker isolation for horizontal scale

**Obscura mechanism:** `crates/obscura-cli/src/main.rs:407-518`
(`run_multi_worker_serve`), `crates/obscura-cli/src/worker.rs`,
`docs/Run-in-production-at-scale.md:41-79`.

Obscura scales two ways, both process-based because a process is the isolation
boundary for its single V8 isolate:

- `serve --workers N` spawns N child `obscura serve` processes on adjacent ports
  and runs a TCP load balancer in front, round-robining new connections
  (`main.rs:421-518`); "sessions are sticky to a worker"
  (`Run-in-production.md:49`).
- `scrape` fans a URL list across `obscura-worker` subprocesses
  (`main.rs:384-385`, `worker.rs`), each a one-shot `current_thread` tokio runtime
  driving a single `Page` over stdin/stdout JSON (`worker.rs:43-63`). One crashed
  worker takes down one URL, not the batch.

**Basset Hound relevance:** Electron already gives you multi-process isolation
(one renderer per page/window) *for free*, so you do not need Obscura's subprocess
gymnastics to isolate a single JS isolate. But the **topology** — a thin
front/balancer, sticky sessions, and crash-isolation at a worker boundary — is the
right shape for scaling a capture fleet.

**Recommendation (ADAPT).** Lean on Electron's process model for per-page
isolation; adopt Obscura's *fleet* topology (sticky-session load balancing across
independent capture workers, crash isolation per worker) when Basset scales
horizontally. The concrete transferable idea is **sticky sessions** so a
multi-step forensic session stays pinned to one worker/renderer.

---

## Part 3 — REJECT: Obscura designs that would be regressions for Basset

### 3.1 Do NOT reimplement the browser engine (DOM / JS / CDP / HTTP)

Obscura's `obscura-dom`, `obscura-js`, and `obscura-cdp` crates exist only because
Obscura has no browser engine to embed. Basset embeds real Chromium via Electron;
re-deriving a DOM tree, a V8 binding layer, or a CDP re-implementation would throw
away Chromium's correctness for no gain. Obscura itself concedes the boundary:
where a native fast path hits a real spec edge case it falls back to JS
(`AGENTS.md:78-81`), and it still can't render.

### 3.2 Do NOT copy the single-shared-V8-isolate + global lock model

`docs/Architecture-overview.md:44-57` and the `obscura_js::v8_lock::global()`
`tokio::sync::Mutex` exist because *all pages in an Obscura process share one V8
isolate*, which is single-threaded by design. Nearly all of Obscura's hardest
complexity — the deferral queue, the "suspend_js every other page" dance
(`server.rs:546-559`), the whole `process_with_interception` state machine
(`server.rs:504-785`) with its multi-paragraph comments about V8's
`heap->isolate() == Isolate::TryGetCurrent()` abort invariant — is *bug-for-bug
mitigation of that single-isolate constraint*. Electron's per-renderer process
isolation makes this entire class of problem disappear. Copying the shared-isolate
serialization would be importing a self-inflicted wound.

### 3.3 Do NOT trade away the real renderer — screenshots are Basset's moat

As shown up front (`page.rs:496-520`), Obscura returns hard errors for
`Page.captureScreenshot` and `Page.printToPDF`: "no layout or paint engine … drive
a real headless Chromium for the screenshot leg." Basset's forensic-capture
mission *is* the screenshot/PDF/visual-evidence leg. This is the clearest place
where Basset is strictly ahead of Obscura, and it should stay there. Do not adopt
any Obscura pattern that presupposes a rendererless engine.

### 3.4 Do NOT copy the "no built-in auth" posture

`docs/Run-in-production-at-scale.md:113-121` states Obscura's CDP server "has no
built-in auth. Anyone who can reach the port can drive the browser," and punts
auth entirely to a reverse proxy or SSH. For a *forensic capture* API handling
potentially sensitive evidence, that is a gap to improve on, not replicate. Take
the *good* half — default-bind `127.0.0.1` and document the exposure — but add
real authentication on the WebSocket/MCP surface rather than assuming a trusted
network.

### 3.5 Do NOT copy the weak profile selection or the hand-rolled parsers

Minor, but worth flagging so they aren't cargo-culted:

- `random_profile()` selects via `SystemTime … subsec_nanos() % PROFILES.len()`
  (`profiles.rs:59-66`) — a nanosecond-modulo is a poor RNG and the pool is only 8
  profiles. Basset's evasion should use a proper RNG and a richer persona set (see
  1.7), not this.
- The hand-rolled base64 decoder (`server.rs:837-862`) and the hand-rolled HTTP
  date parser (`cookies.rs:504-534`) are pragmatic *in Rust* to avoid pulling
  dependencies into the CDP hot path. Node/Electron has these in stdlib and mature
  libraries; there is no reason to hand-roll them in Basset.
- Obscura bundles **no public suffix list** (`cookies.rs:543-550` explicitly notes
  `co.uk`/`github.io` multi-label suffixes are not rejected). If Basset adopts the
  cookie-domain validation (1.6), use a real PSL rather than Obscura's
  single-label-only approximation.

---

## Part 4 — Coverage gaps in Obscura (so you don't over-credit it)

For balance, several things Obscura does **not** do, which bound how much to copy:

- **No visual/rendering pipeline at all** — no screenshots, PDF, layout, or paint
  (`page.rs:496-520`). Its `DOMSnapshot` returns geometry-free placeholder layout
  arrays (`crates/obscura-cdp/src/domains/domsnapshot.rs:262-270`, empty
  `textBoxes`), so any Basset feature relying on real layout boxes has no analog.
- **Stealth is deliberately shallow.** `docs/Configure-stealth-and-proxies.md:29-34`
  states stealth does **not** handle Cloudflare interactive challenges, Datadome,
  Akamai bot-manager active challenges, CAPTCHAs, or IP rate limiting. Basset's
  `evasion/behavioral-ai.js` + honeypot detection are genuinely more ambitious;
  don't regress toward Obscura's "consistent-fingerprint-only" scope. The
  transferable idea from 1.7 is *consistency*, not Obscura's coverage.
- **No public suffix list**, single-label suffix rejection only (`cookies.rs:543-550`).
- **No built-in authentication** on either the CDP or MCP servers
  (`Run-in-production.md:113-121`).
- **Interception is coarse:** `InterceptAction` (`interceptor.rs:5-10`) has no
  response-body rewriting or streaming; `Fulfill` replaces the whole response.
- **Cookie `SameSite` is stored but not enforced** on cross-site request
  suppression — `get_cookie_header` (`cookies.rs:148-185`) filters on domain,
  path, secure, host-only, and expiry, but does not consult `same_site` to drop a
  cookie on a cross-site navigation. It's parsed and persisted, not acted on.

---

## Priority summary

| # | Recommendation | Verdict | Obscura anchor | Why it matters for Basset |
|---|---|---|---|---|
| 1.1 | DNS-time SSRF guard on navigation targets | ADOPT | `obscura-net/src/client.rs:101-170` | Closes an unguarded SSRF/metadata vector; Basset only guards proxy/webhook URLs by regex |
| 1.2 | Per-command deadline | ADAPT | `obscura-js/src/cdp_watchdog.rs` | Dispatcher has no timeout; one hung command can wedge resources |
| 1.3 | Bounded queues / panic-safe handlers | ADOPT | `obscura-cdp/src/server.rs:19-29`, `ops.rs:132` | One session must not OOM/crash the server |
| 1.4 | Control-plane / data-plane split | ADOPT | `server.rs:126-175` | Health must answer while a capture blocks |
| 1.5 | Fast-path cheap commands | ADOPT | `server.rs:864-909` | Prevents client protocolTimeout via head-of-line blocking |
| 1.6 | RFC6265 cookie posture + atomic + SIGTERM flush | ADOPT | `obscura-net/src/cookies.rs` | Forensic-integrity persistence; cross-domain safety |
| 1.7 | Fingerprint coherence over randomization | ADAPT | `browser/src/profiles.rs`, `wreq_client.rs:20-33` | Cross-layer mismatch is the #1 self-inflicted bot signal |
| 1.8 | Network-layer blocklist (suffix-walk) | ADOPT | `obscura-net/src/blocklist.rs` | Correct boundary matching, compiled once |
| 1.9 | Agent element-refs + output caps | ADOPT | `obscura-mcp/src/lib.rs:61-157` | Robust, context-safe agent surface; counters 164-tool sprawl |
| 1.10 | Typed interception resolution + re-validate rewrites | ADOPT | `interceptor.rs`, `server.rs:460-502` | One clean vocabulary; SSRF-safe URL rewrites |
| 1.11 | Documented env tunables | ADOPT | `docs/Environment-variables.md` | Ops hygiene |
| 1.12 | MCP Origin allowlist + body cap | ADOPT | `Environment-variables.md:87-93` | Blocks DNS-rebind into local agent port |
| 2.1 | Sticky-session worker fleet | ADAPT | `cli/src/main.rs:407-518` | Right scaling topology; Electron already isolates |
| 3.1 | Reimplement DOM/JS/CDP | REJECT | `obscura-dom`, `obscura-js` | Basset embeds real Chromium |
| 3.2 | Single-isolate + global V8 lock | REJECT | `Architecture-overview.md:44-57` | Electron isolates per renderer |
| 3.3 | Rendererless engine | REJECT | `page.rs:496-520` | Screenshots are Basset's core mission |
| 3.4 | No built-in auth | REJECT | `Run-in-production.md:113-121` | Forensic API needs real auth |
| 3.5 | Weak RNG / hand-rolled parsers / no PSL | REJECT | `profiles.rs:59-66`, `cookies.rs:504-550` | Use proper libs in Node |

---

## Connection to the rest of Obscura

These recommendations touch every Obscura crate: the SSRF guard, cookie jar,
blocklist, and stealth client live in `obscura-net`; the watchdog and panic-safety
in `obscura-js`; the control-plane split, bounded queues, fast-path, and
interception bridge in `obscura-cdp`; the fingerprint profiles in
`obscura-browser`; the agent ergonomics in `obscura-mcp`; and the worker topology
in `obscura-cli`. The unifying theme — stated in `AGENTS.md:107-116` and
`docs/Architecture-overview.md:59-61` — is that Obscura invests heavily in
*bounding blast radius* (one page can never hang, crash, or wedge a worker) and in
*cross-layer consistency* (TLS, headers, and JS surfaces must agree). Those two
themes, not Obscura's from-scratch engine, are the transferable core for Basset
Hound.

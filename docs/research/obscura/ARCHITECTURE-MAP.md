---
title: "Obscura Architecture Map — the 8-crate engine at a glance"
date: 2026-07-03
researcher: Claude (Basset Hound architecture research)
status: Complete
category: reverse-engineering / architecture-overview
summary: >
  Single navigable overview of the Obscura headless-browser workspace: the
  8-crate dependency graph, the request→render→extract data flow across crates,
  the CDP/MCP/CLI/library entry surfaces, the cross-cutting single-V8-isolate
  invariant, and an index linking each crate and topic to its deep-dive doc.
source: "/home/devel/tmp/obscura (Apache-2.0, github.com/h4ckf0r0day/obscura, git ca71ce3, workspace v0.1.0)"
related:
  - crates/obscura-dom.md
  - crates/obscura-net.md
  - crates/obscura-js.md
  - crates/obscura-browser.md
  - crates/obscura-cdp.md
  - crates/obscura-mcp.md
  - crates/obscura-cli.md
  - crates/obscura-main.md
  - topics/stealth-and-fingerprinting.md
  - topics/request-interception.md
  - topics/cdp-protocol-coverage.md
  - topics/extensibility-model.md
  - topics/production-deployment.md
  - topics/adoption-recommendations.md
---

# Obscura Architecture Map

This is the **map, not the territory** — a single navigable overview of how the
Obscura headless browser fits together, with pointers into the per-crate and
per-topic deep-dives that carry the source-cited detail. Read this first, then
jump to the deep-dive for whichever crate or concern you are working on.

Obscura is an **Apache-2.0, from-scratch, layout-free headless browser** written
in Rust (≈23k LOC across 8 workspace crates). It fetches HTML over its own HTTP
stack, parses it into its own arena DOM, runs page JavaScript in an embedded V8
isolate (via `deno_core`) against a hand-written Web-API shim, and exposes the
result through four front-ends: a **CDP** server (Puppeteer/Playwright), an
**MCP** server (AI agents), a **CLI**, and an **embeddable Rust library**. It has
**no layout, paint, or compositor** — `captureScreenshot`/`printToPDF` return
hard errors, and all geometry is synthesized. It is a scraping/extraction engine,
not a rendering browser.

---

## 1. The 8 crates

| # | Crate | One-line role | Deep-dive |
|---|-------|---------------|-----------|
| 1 | `obscura-dom` | Server-side DOM: `Vec<Option<Node>>` arena + `NodeId(u32)`, `html5ever` parse, Servo `selectors` matching, HTML serialize | [crates/obscura-dom.md](crates/obscura-dom.md) |
| 2 | `obscura-net` | HTTP stack: reqwest+rustls (default) / wreq+BoringSSL (stealth), hand-rolled `CookieJar`, SSRF guard, robots, tracker blocklist, charset decode | [crates/obscura-net.md](crates/obscura-net.md) |
| 3 | `obscura-js` | V8-via-`deno_core` runtime, `ops.rs` (the only Rust↔JS door), 7.9k-line `bootstrap.js` Web-API shim, build-time snapshot, `v8_lock` + watchdogs | [crates/obscura-js.md](crates/obscura-js.md) |
| 4 | `obscura-browser` | `Page` (the tab) + `BrowserContext` (the session): navigation lifecycle, script execution, network capture, JS-eval bridge | [crates/obscura-browser.md](crates/obscura-browser.md) |
| 5 | `obscura-cdp` | Chrome DevTools Protocol server over WebSocket + `/json` HTTP; dispatch, 12 domain handlers, navigation event machine | [crates/obscura-cdp.md](crates/obscura-cdp.md) |
| 6 | `obscura-mcp` | Model Context Protocol server (stdio + HTTP); 35 `browser_*` tools, `data-obscura-ref` element-ref system | [crates/obscura-mcp.md](crates/obscura-mcp.md) |
| 7 | `obscura-cli` | User-facing binary (`obscura`) + `obscura-worker`; `fetch`/`scrape`/`serve`/`mcp`, dump formatters, pre-isolate process setup | [crates/obscura-cli.md](crates/obscura-cli.md) |
| 8 | `obscura` | Embeddable Rust library API: `Browser`/`Page`/`Element`/`CookieStore`, in-process, no wire protocol | [crates/obscura-main.md](crates/obscura-main.md) |

---

## 2. Dependency graph

The workspace convention is **"cross-crate calls go through the layer above, not
sideways"** (`docs/Architecture-overview.md:108`). The result is a clean layered
DAG: two leaf "content" crates at the bottom, the JS runtime above them, the
`Page`/`BrowserContext` engine above that, and four interchangeable front-ends on
top — with the CLI as the binary that hosts them all.

```
  Layer 4        ┌──────────────────────────────────────────────────────────┐
  binary /       │                       obscura-cli                         │
  orchestration  │            bins: `obscura`, `obscura-worker`              │
                 └───────┬───────────────┬───────────────┬──────────────────┘
                         │               │               │  (depends on ALL engine crates)
  Layer 3               ▼               ▼               ▼
  front-ends       obscura-cdp     obscura-mcp        obscura
                  (CDP server)    (MCP server)    (embeddable lib)
                         │               │               │
                         └───────┬───────┴───────┬───────┘
  Layer 2                        ▼               ▼
  engine                       obscura-browser
                    Page · BrowserContext · lifecycle · navigation
                                 │
  Layer 1                        ▼
  runtime                     obscura-js
                    V8 / deno_core · ops · bootstrap.js · v8_lock
                                 │
  Layer 0                 ┌──────┴───────┐
  content             obscura-dom     obscura-net
                   DOM/HTML5/CSS    HTTP/cookies/TLS/SSRF
```

**Exact internal dependency edges** (from each crate's `Cargo.toml`; front-ends
also reach *past* `obscura-browser` where noted):

| Crate | Depends on (internal) | Notes |
|-------|-----------------------|-------|
| `obscura-dom` | *(none)* | Leaf. External: `html5ever`, `selectors`, `cssparser`. |
| `obscura-net` | *(none)* | Leaf. External: `reqwest`/`rustls`, `wreq`/BoringSSL (stealth feature), `encoding_rs`. |
| `obscura-js` | `obscura-dom`, `obscura-net` | Owns `deno_core`/V8; `op_dom` bridges to the DOM, ops bridge to the net stack. |
| `obscura-browser` | `obscura-dom`, `obscura-net`, `obscura-js` | The pivot crate. Re-exports the interception types so `obscura` needn't depend on `obscura-js`. |
| `obscura-cdp` | `obscura-browser`, `obscura-js`, `obscura-dom`, `obscura-net` | Reaches into `obscura-js` for `v8_lock`, `cdp_watchdog`, `InterceptedRequest`. |
| `obscura-mcp` | `obscura-browser`, `obscura-dom`, `obscura-net` | **Does NOT depend on `obscura-cdp` or `obscura-js`** — bypasses CDP entirely; markdown via re-export. |
| `obscura` (lib) | `obscura-browser`, `obscura-net` | Only two deps; interception types laundered through `obscura-browser`. |
| `obscura-cli` | all six engine crates | Hosts every front-end + owns pre-isolate process setup (timezone, V8 flags, SSRF mirror). |

Note the two "content" crates (`obscura-dom`, `obscura-net`) never depend on each
other, and nothing depends *sideways* on a front-end — the front-ends are
mutually independent alternatives over the one shared `obscura-browser` core.

---

## 3. Entry surfaces (the four ways to drive the engine)

All four surfaces ultimately construct a `BrowserContext` and drive
`obscura_browser::Page`. They differ in wire protocol, statefulness, and audience.

| Surface | Launch | Wire protocol | Audience | Deep-dive |
|---------|--------|---------------|----------|-----------|
| **CDP server** | `obscura serve` | WebSocket (CDP 1.3 subset) + `/json/*` HTTP discovery | Puppeteer, Playwright (`connectOverCDP`), `headless_chrome`, browser-use | [crates/obscura-cdp.md](crates/obscura-cdp.md), [topics/cdp-protocol-coverage.md](topics/cdp-protocol-coverage.md) |
| **MCP server** | `obscura mcp` (`--http` for HTTP) | JSON-RPC 2.0 / MCP over stdio or `POST /mcp` | Claude Desktop/Code, Cursor, MCP agents | [crates/obscura-mcp.md](crates/obscura-mcp.md) |
| **CLI** | `obscura fetch \| scrape \| serve \| mcp` | argv → stdout (html/text/markdown/links/assets/original/cookies) | shell users, batch pipelines | [crates/obscura-cli.md](crates/obscura-cli.md) |
| **Embeddable library** | `use obscura::Browser` (git dep) | none — in-process `&mut`-driven Rust API | Rust services embedding the engine | [crates/obscura-main.md](crates/obscura-main.md) |

Statefulness contrast worth noting: the **CDP** and **MCP** servers hold a *live
session* (tabs + shared cookie jar) and route by session/tab; the **CLI** `fetch`
and the **library** are one-shot / caller-pumped. The **MCP** server is
session-centric with an element-`ref` affordance (`data-obscura-ref="eN"`)
instead of raw CSS selectors — the standout agent-UX idea.

---

## 4. Data flow: request → render → extract

A single navigation, end to end, crossing every layer. This is the spine the
per-crate docs elaborate; here is the whole pipeline in one place.

```
 CLIENT (CDP frame / MCP tool call / CLI arg / library call)
    │
    ▼
 [obscura-cdp] server.rs  ── accept, route by sessionId, fast-path cheap methods
    │            dispatch.rs ── acquire GLOBAL V8 LOCK, arm per-command watchdog,
    │                           route "Domain.method" → domain handler
    ▼
 [obscura-browser] Page::navigate_with_wait → navigate_single   (one hop)
    │   1. parse URL, lifecycle=Loading, clear network log
    │   2. (opt) robots.txt gate
    │   3. FETCH main document ───────────────────────────────────┐
    │                                                             ▼
    │                                          [obscura-net] ObscuraHttpClient
    │                                          · SSRF guard (deny-set + DNS-rebind resolver)
    │                                          · manual redirect loop (20 hops, POST→GET)
    │                                          · CookieJar attach/store, Chrome header synth
    │                                          · stealth? → wreq/BoringSSL Chrome-145 ClientHello
    │   4. charset decode ◄──────────────────────────────────────┘
    │   5. PARSE ──────────────► [obscura-dom] parse_html → DomTree (arena)
    │   6. fetch <link> stylesheets (concurrency 16)
    │   7. hand DOM into JS ────► [obscura-js] rt.set_dom(dom); init_js()
    │   8. EXECUTE SCRIPTS ─────► [obscura-js] bootstrap.js Web APIs + ops:
    │                             · op_dom  (every DOM read/write, stringly-typed)
    │                             · op_fetch_url (fetch/XHR, own SSRF gate, interception)
    │                             · WebCrypto / URL / encoding ops
    │                             · watchdog-terminates runaway sync JS
    │   9. lifecycle → DomContentLoaded → Loaded → (NetworkIdle)
    ▼
 [obscura-cdp] domains/page.rs::emit_navigation_events
    │   replays recorded NetworkEvents + lifecycle as the exact Chromium
    │   event storm (requestWillBeSent → frameNavigated → executionContextCreated
    │   → lifecycleEvent → loadEventFired → targetInfoChanged)
    ▼
 EXTRACT (any surface):
    · DOM reads via op_dom / Page::evaluate
    · markdown via HTML_TO_MARKDOWN_JS (CLI --dump markdown, MCP browser_markdown, CDP LP.getMarkdown)
    · readable text via extract_text DOM walker (CLI --dump text, MCP browser_snapshot)
    · assets via static DOM selectors + page.fetched_urls() (CLI --dump assets)
    ▼
 CLIENT  (events + command response flow back out the same channel)
```

Key seam: **`obscura-browser` produces *state* (lifecycle, `NetworkEvent`s,
title, url); `obscura-cdp` turns that state into *events*.** The browser crate
emits no CDP events itself. See [crates/obscura-browser.md](crates/obscura-browser.md) §5,7
and [crates/obscura-cdp.md](crates/obscura-cdp.md) §7.

---

## 5. Cross-cutting invariants (true for every path)

These constraints shape the whole codebase and recur in every deep-dive:

- **One V8 isolate, one OS thread, one global lock.** Every page owns a `!Send`
  V8 isolate; all of them run on a single thread via a tokio `LocalSet`. A
  process-wide `tokio::sync::Mutex` (`obscura_js::v8_lock::global()`) serializes
  all V8 work — interleaving two isolates across an `.await` trips V8's invariant
  and `abort(3)`s the process. Concurrency is *interleaving*, never parallelism.
  The CLI/scrape path gets parallelism by spawning **OS processes** instead.
- **Only one page holds a live runtime at a time.** Switching focus between tabs
  `suspend_js()` (pull the DOM back out, drop the isolate) on the old and
  `resume_js()` on the new — in both the CDP dispatcher and the MCP `BrowserState`.
- **Watchdog threads, not tokio timeouts.** Synchronous V8 pins the thread, so a
  busy-loop is interrupted by a watchdog that calls
  `IsolateHandle::terminate_execution()`. `op_dom` and the URL ops wrap work in
  `catch_unwind` because a panic through the FFI frame would `V8_Fatal`/`abort`.
- **No layout / paint.** Screenshots, PDF, MHTML → hard errors. Box models,
  `DOMSnapshot` geometry, `getLayoutMetrics` are synthesized (fixed 1280×720,
  `[0, i*18, 1280, 18]` stacks). Clicks fall back to JS `.click()`.
- **Security gates default-closed & opt-in.** `allow_private_network` (SSRF /
  RFC1918 / cloud-metadata), `allow_file_access` (`file://`), and `obey_robots`
  are all `false` by default; the SSRF logic is duplicated in `obscura-net` and
  in the `obscura-js` fetch op so scripted fetch is gated too.
- **Stealth is two-tier and asymmetric.** The JS fingerprint shim tier
  (`bootstrap.js`) is **always on**; the network TLS/blocklist tier
  (`wreq`/BoringSSL Chrome-145) is **build-gated behind the `stealth` feature AND
  `--stealth`**. The default build's rustls ClientHello contradicts the JS "I am
  Chrome" claim — the headline cross-surface mismatch. See
  [topics/stealth-and-fingerprinting.md](topics/stealth-and-fingerprinting.md).
- **Narrow, auditable JS↔Rust boundary.** The entire DOM API funnels through one
  stringly-typed op (`op_dom(cmd, arg1, arg2) -> String`); all outside-world
  access is a fixed set of ops. Correct-by-construction but chatty.

---

## 6. Full deep-dive index

### Per-crate reverse-engineering docs
| Crate / concern | Doc |
|-----------------|-----|
| `obscura-dom` — arena DOM, html5ever sink, selector matching, serializer | [crates/obscura-dom.md](crates/obscura-dom.md) |
| `obscura-net` — dual HTTP clients, CookieJar, SSRF, TLS posture, proxy, encoding | [crates/obscura-net.md](crates/obscura-net.md) |
| `obscura-js` — V8/deno_core runtime, ops, bootstrap.js, snapshot, watchdogs | [crates/obscura-js.md](crates/obscura-js.md) |
| `obscura-browser` — Page/BrowserContext, navigation lifecycle, script exec | [crates/obscura-browser.md](crates/obscura-browser.md) |
| `obscura-cdp` — CDP server, dispatch, domains, navigation event machine | [crates/obscura-cdp.md](crates/obscura-cdp.md) |
| `obscura-mcp` — MCP server, transports, 35 tools, element-ref system | [crates/obscura-mcp.md](crates/obscura-mcp.md) |
| `obscura-cli` — fetch/scrape/serve/mcp, worker model, dump formatters | [crates/obscura-cli.md](crates/obscura-cli.md) |
| `obscura` — embeddable Rust library façade | [crates/obscura-main.md](crates/obscura-main.md) |

### Cross-cutting topic docs
| Topic | Doc |
|-------|-----|
| Stealth & anti-detection / fingerprinting (two tiers, ceiling) | [topics/stealth-and-fingerprinting.md](topics/stealth-and-fingerprinting.md) |
| Request interception & modification (the three partly-connected layers) | [topics/request-interception.md](topics/request-interception.md) |
| CDP protocol coverage (implemented domains/methods/events + gaps) | [topics/cdp-protocol-coverage.md](topics/cdp-protocol-coverage.md) |
| Extensibility model (adding CDP methods, Web APIs/ops, preload scripts) | [topics/extensibility-model.md](topics/extensibility-model.md) |
| Production deployment, concurrency & resource model (Docker, multi-worker) | [topics/production-deployment.md](topics/production-deployment.md) |
| Adoption recommendations for Basset Hound (ADOPT/ADAPT/REJECT) | [topics/adoption-recommendations.md](topics/adoption-recommendations.md) |

### Higher-level strategic docs
| Doc | Focus |
|-----|-------|
| [OBSCURA-EVALUATION.md](OBSCURA-EVALUATION.md) | Build-vs-adopt decision analysis (recommendation: continue custom build) |
| [OBSCURA-TECHNICAL-ANALYSIS.md](OBSCURA-TECHNICAL-ANALYSIS.md) | Whole-project technical analysis (stack, LOC, tests, Docker) |
| [OBSCURA-HEADLESS-ANALYSIS.md](OBSCURA-HEADLESS-ANALYSIS.md) | Headless-first architecture vs. Basset Hound's Electron hybrid |
| [OBSCURA-EVASION-ANALYSIS.md](OBSCURA-EVASION-ANALYSIS.md) | Evasion-capability comparison vs. Basset Hound's evasion framework |

---

## 7. How to navigate

- **New to Obscura?** Read §1–§5 above, then [OBSCURA-TECHNICAL-ANALYSIS.md](OBSCURA-TECHNICAL-ANALYSIS.md)
  for the whole-project framing.
- **Working on a specific crate?** Jump straight to its `crates/*.md`.
- **Comparing a capability** (stealth, interception, CDP coverage, deployment)?
  Use the `topics/*.md` doc — those cut *across* crates.
- **Deciding what to borrow?** [topics/adoption-recommendations.md](topics/adoption-recommendations.md)
  carries per-item ADOPT/ADAPT/REJECT verdicts grounded in source.
</content>
</invoke>

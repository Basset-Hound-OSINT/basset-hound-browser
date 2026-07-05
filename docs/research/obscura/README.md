# Obscura Research Corpus

Source-verified reverse-engineering of **Obscura** — an Apache-2.0, from-scratch,
layout-free headless browser written in Rust (≈23k LOC across 8 workspace crates,
`github.com/h4ckf0r0day/obscura`, git `ca71ce3`, v0.1.0). Obscura fetches HTML
over its own HTTP stack, parses it into its own arena DOM, runs page JavaScript in
an embedded V8 isolate (via `deno_core`), and exposes the result through CDP, MCP,
CLI, and embeddable-library front-ends. It has **no layout, paint, or compositor**.

This directory holds two kinds of research: **higher-level strategic docs**
(`OBSCURA-*.md`) that frame the build-vs-adopt decision and compare Obscura to
Basset Hound Browser, and **source-cited deep-dives** (`crates/`, `topics/`) where
every claim points at a specific file and line in the checked-out source.

## Start here

**→ [ARCHITECTURE-MAP.md](ARCHITECTURE-MAP.md)** — the single navigable overview:
the 8-crate dependency graph, the request→render→extract data flow, the four entry
surfaces, the cross-cutting single-V8-isolate invariant, and links into every
deep-dive. Read it first, then jump to whichever crate or topic you need.

## All documents

### Master map
| Doc | Description |
|-----|-------------|
| [ARCHITECTURE-MAP.md](ARCHITECTURE-MAP.md) | Master architecture overview: dependency graph, data flow, entry surfaces, invariants, and the full deep-dive index. |

### Strategic docs (decision & comparison)
| Doc | Description |
|-----|-------------|
| [OBSCURA-EVALUATION.md](OBSCURA-EVALUATION.md) | Build-vs-adopt decision analysis; recommendation is to continue the custom Basset Hound build. |
| [OBSCURA-TECHNICAL-ANALYSIS.md](OBSCURA-TECHNICAL-ANALYSIS.md) | Whole-project technical analysis: stack, LOC, test coverage, Docker, extensibility. |
| [OBSCURA-HEADLESS-ANALYSIS.md](OBSCURA-HEADLESS-ANALYSIS.md) | Obscura's headless-first architecture vs. Basset Hound's Electron/Chromium hybrid. |
| [OBSCURA-EVASION-ANALYSIS.md](OBSCURA-EVASION-ANALYSIS.md) | Evasion-capability comparison against Basset Hound's multi-layer evasion framework. |

### Per-crate deep-dives (`crates/`)
| Doc | Description |
|-----|-------------|
| [crates/obscura-dom.md](crates/obscura-dom.md) | Server-side DOM: `Vec<Option<Node>>` arena + `NodeId(u32)`, `html5ever` parse, Servo `selectors` matching, HTML serializer. |
| [crates/obscura-net.md](crates/obscura-net.md) | HTTP stack: reqwest+rustls (default) vs. wreq+BoringSSL (stealth), custom `CookieJar`, SSRF guard, proxy, robots, tracker blocklist, charset decode. |
| [crates/obscura-js.md](crates/obscura-js.md) | V8-via-`deno_core` runtime: `ops.rs` (the only Rust↔JS door), 7.9k-line `bootstrap.js` Web-API shim, build-time snapshot, `v8_lock` + watchdogs. |
| [crates/obscura-browser.md](crates/obscura-browser.md) | `Page` (tab) + `BrowserContext` (session): navigation lifecycle, script execution, network capture, JS-eval bridge — the engine pivot. |
| [crates/obscura-cdp.md](crates/obscura-cdp.md) | Chrome DevTools Protocol server (WebSocket + `/json` HTTP): dispatch, 12 domain handlers, the navigation event machine, client compat. |
| [crates/obscura-mcp.md](crates/obscura-mcp.md) | Model Context Protocol server (stdio + HTTP): 35 `browser_*` tools, the `data-obscura-ref` element-ref system, security posture. |
| [crates/obscura-cli.md](crates/obscura-cli.md) | User-facing binary (`obscura`) + `obscura-worker`: `fetch`/`scrape`/`serve`/`mcp`, dump formatters, pre-isolate process setup. |
| [crates/obscura-main.md](crates/obscura-main.md) | The embeddable `obscura` Rust library API: `Browser`/`Page`/`Element`/`CookieStore`, in-process, no wire protocol. |

### Cross-cutting topic deep-dives (`topics/`)
| Doc | Description |
|-----|-------------|
| [topics/stealth-and-fingerprinting.md](topics/stealth-and-fingerprinting.md) | Every stealth mechanism: the two-tier (network TLS + JS shim) model, what's gated, and the ceiling (no Cloudflare/Datadome/CAPTCHA). |
| [topics/request-interception.md](topics/request-interception.md) | The three partly-connected interception layers; only JS `fetch()`/XHR can be blocked/mocked/rewritten live. |
| [topics/cdp-protocol-coverage.md](topics/cdp-protocol-coverage.md) | Exhaustive catalog of implemented CDP domains, methods, and events — and the deliberate gaps. |
| [topics/extensibility-model.md](topics/extensibility-model.md) | How to extend Obscura: adding a CDP method, a Web API (Rust op + JS shim), and preload scripts; no runtime plugin system. |
| [topics/production-deployment.md](topics/production-deployment.md) | Production packaging & operation: distroless Docker image, multi-worker/serve concurrency, V8/heap tuning, reliability backstops. |
| [topics/adoption-recommendations.md](topics/adoption-recommendations.md) | The payoff doc: per-mechanism ADOPT/ADAPT/REJECT verdicts for Basset Hound, grounded in Obscura source. |

## Conventions

- **Deep-dives are source-cited.** Every non-obvious claim in `crates/` and
  `topics/` cites a `file:line` or symbol from the on-disk checkout.
- **The code wins.** Where Obscura's own docs and its source disagree, the
  deep-dives follow the source and flag the drift.
- **Frontmatter.** New docs carry YAML frontmatter (`title`, `date`, `researcher`,
  `status`, `category`); cross-reference siblings with relative Markdown links.

---
**Last updated:** July 3, 2026 · **Corpus:** 1 master map + 4 strategic + 8 per-crate + 6 topic deep-dives
</content>

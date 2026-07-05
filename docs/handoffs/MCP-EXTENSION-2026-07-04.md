---
title: Handoff — MCP Server Extension (extract_* family + get_cookies)
agent: dev (dev@basset-hound-browser:mcp-extend-extraction)
date: 2026-07-04
work_zone: mcp/ (server.py, README.md, verify_e2e.py)
status: BUILT + LIVE-VERIFIED (extract_links exact-match to live DOM; set_cookie→get_cookies{url} round-trip green; verify_e2e exit 0)
depends_on:
  - docs/handoffs/MCP-SERVER-2026-07-04.md   (the 13-tool base this extends)
  - docs/findings/BROKEN-COMMANDS-FIX-2026-07-04.md  (the fixes that made these 4 commands work)
scope_ref: docs/architecture/SCOPE.md (deterministic capture/control; NO models/agents/intelligence)
---

# MCP Extension Handoff — 4 newly-fixed commands as MCP tools

Extends the thin FastMCP pass-through (`mcp/server.py`) from **13 → 17 tools**,
adding the four commands that the debugger fixed + live-verified this session
(`docs/findings/BROKEN-COMMANDS-FIX-2026-07-04.md`):

- `extract_links`
- `extract_forms`
- `extract_images`
- `get_cookies` (URL-filtered — distinct from the existing `get_all_cookies`)

Same rules as the base server: each MCP tool maps **1:1** to a single WS command
forwarded over `ws://127.0.0.1:8765` (flat JSON `{command,id,...params}`,
id-correlated), typed input schema, and **scope-clean** — no models, no AI, no
agents, pure forwarding. All reasoning stays in the calling agent.

No repo code outside `mcp/` was modified (this handoff doc excepted). No git
commits. No dependencies added.

## Files changed (all under `mcp/`)

| File | Change |
| --- | --- |
| `mcp/server.py` | +4 `@mcp.tool()` functions (`get_cookies`, `extract_links`, `extract_forms`, `extract_images`); module docstring command list extended. Still imports/parses clean (`py_compile` OK); FastMCP registers 17 tools. |
| `mcp/README.md` | Tool table 13→17 rows (+4), header/counts updated, verification section notes the new coverage. |
| `mcp/verify_e2e.py` | Extended: navigate Wikipedia → `extract_links` cross-checked against live `document.links.length`; `set_cookie`→`get_cookies{url}` round-trip asserted. |

## Param / response shapes — derived from source, not docs

Shapes taken from the WS handler source (`websocket/server.js`) and the
managers it calls, **not** the stale schema catalog:

- **`extract_links`** — handler `websocket/server.js:8389`. Accepts optional
  `html`; base URL from `params.baseUrl || params.url`. When `html` is omitted it
  reads the active `<webview>` via `getWebviewPageContent()` (the fixed path — the
  old code read the empty browser shell). Delegates to
  `extraction/manager.js:extractLinks(html, baseUrl)` → returns
  `{ success, all[], count, data:{internal,external,mailto,tel,anchor,javascript,other}, errors, warnings }`.
  Each link object: `href, text, title, rel, target, download` (+ `email`/`phone`/`anchor` for those categories).
  → MCP tool exposes optional `base_url` (mapped to WS `baseUrl`) + optional `html`.
- **`extract_forms`** — handler `:8413`. Accepts optional `html` only (no baseUrl).
  Delegates to `extractForms(html)` → `{ success, data[], count, fieldCount, errors, warnings }`.
  → MCP tool exposes optional `html`.
- **`extract_images`** — handler `:8435`. Optional `html`; base URL from
  `params.baseUrl || params.url`. Delegates to `extractImages(html, baseUrl)` →
  `{ success, data[], count, errors, warnings }`; image object `src, alt, title, …`.
  → MCP tool exposes optional `base_url` (→ `baseUrl`) + optional `html`.
- **`get_cookies`** — handler `websocket/server.js:3158` (the session handler
  that the fix *restored* after the forensic module was overriding it). **Requires
  `url`** (`{success:false,error:'URL is required'}` otherwise). Delegates to
  `cookies/manager.js:getCookies(url)` (native Electron url filter + RFC 6265
  fallback) → `{ success, cookies[] }`. Returns only the cookies the browser would
  send to `url` — contrast with `get_all_cookies` (whole jar).
  → MCP tool exposes required `url`.

Only non-null params are sent on the wire (the base bridge already drops `None`),
so omitting `html`/`base_url` lets the browser default to the live page. No
camelCase surprises beyond `base_url → baseUrl`.

## Scope compliance (SCOPE.md hard blacklist)

- No models / LLM / embeddings / inference — new tools import nothing new; they
  call the same `_bridge.call()` as the other 13.
- No agent spawning / orchestration.
- No intelligence: tools forward the command and return the browser's raw
  response dict verbatim (internal `id` stripped). No filtering, classification,
  or enrichment — the calling agent interprets `all[]` / `data[]` / `cookies[]`.
- All four are in the **Proven-Working** set (fixed + verified live in the
  broken-commands findings), honoring the Step-4 "expose only proven commands"
  guardrail.

## Verification evidence

**Isolation.** At start, nothing was listening on `ws://127.0.0.1:8765` (checked
`ss -ltn`). To avoid any collision with the other agent's browser I launched a
**separate** headless Electron on **port 8782** (`BASSET_WS_PORT=8782` →
`config/env.js` `server.port`) with a throwaway `--user-data-dir=/home/devel/bhb-mcp-extend-userdata`,
`ELECTRON_RUN_AS_NODE` explicitly unset (`env -u`), detached in its own session
(`setsid`, own process group pgid 1877919). Reaped the **whole group** with
`kill -TERM -<pgid>` (then `-KILL`) — never a `pkill -f` pattern (the
`bhb-mcp-extend-userdata` string also matches the driving shell's own command
line, so a pattern-kill would have been unsafe; group-kill by pgid is not).
Post-run: `pgrep` shows **no electron strays**, port 8782 closed, temp files
under `/home/devel/bhb-mcp-extend*` removed.

**Method.** `mcp/verify_e2e.py` invokes every tool via `mcp.call_tool(name, args)`
— the full FastMCP dispatch path (pydantic arg validation → tool → WS bridge →
browser), not a raw socket. This proves the *typed MCP surface* works, not just
the WS command.

**Result (green, exit 0):**
```
navigate example.com  -> success:true, get_url=example.com, get_content len=544, "Example Domain" present
navigate iana.org     -> get_url=iana.org
get_all_cookies       -> success:true, count=4
navigate https://en.wikipedia.org/wiki/Web_scraping
extract_links         -> success:true, count=462, all_len=462, dom_links(document.links.length)=462, first_href="#bodyContent"
set_cookie bhb_mcp_verify (url=.../Web_scraping) -> success:true
get_cookies {url: .../Web_scraping}              -> success:true, count=8, found_test_cookie=true
GET_CONTENT_OK=True GET_URL(example)_OK=True GET_URL(iana)_OK=True COOKIES_OK=True EXTRACT_LINKS_OK=True GET_COOKIES_OK=True
EXIT_CODE=0
```

`extract_links.count` **equals the live DOM's own `document.links.length` (462
== 462)** and the first href is the real Wikipedia anchor `#bodyContent` —
proving the tool reads the actual `<webview>` DOM through the MCP dispatch, not
the empty shell. `get_cookies{url}` returned 8 URL-scoped cookies **including the
just-set `bhb_mcp_verify`**, proving the restored session handler (not the
forensic override) answers URL-filtered reads. These reproduce the debugger's
live evidence, now through the MCP layer.

Re-run any time:
```bash
# launch a browser on some WS port, then:
BASSET_WS_PORT=<port> python3 mcp/verify_e2e.py    # exits 0 on success
```

**Registration sanity:** importing `mcp/server.py` and calling
`mcp.list_tools()` returns **17** tools including `extract_forms`,
`extract_images`, `extract_links`, `get_cookies`.

## Known browser-side quirk (unchanged, not an adapter bug)

`navigate`'s returned `url` can lag by one navigation immediately after startup
(stale `navigation-complete` event — visible above: `navigate_2`/`navigate_3`
echoed the *previous* page's URL while `get_url` reported the correct current
page). The adapter faithfully returns whatever the browser sends; `get_url` /
`extract_*` after the page settles are authoritative. Same caveat documented in
the base handoff and the status matrix.

## Follow-ups (out of scope here)

- The remaining `extract_*` siblings (`extract_metadata`, `extract_scripts`,
  `extract_stylesheets`, `extract_structured_data`, `extract_all`) already route
  through the fixed `getWebviewPageContent()` in `server.js` and would be trivial
  one-liners to expose — deferred until each is independently proven live per the
  Step-4 guardrail.
- `detect_technologies` / `identify_cms` / `identify_analytics` / `export_raw_html`
  still read the browser shell (per the broken-commands findings) — do **not**
  expose as MCP tools until that shell-vs-webview bug is fixed.
- Consider wiring `verify_e2e.py` into a headless CI smoke test.

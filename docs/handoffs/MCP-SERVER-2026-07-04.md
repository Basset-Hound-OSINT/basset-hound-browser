---
title: Handoff — Thin MCP Server over Proven WS Commands
agent: architect (dev@basset-hound-browser:mcp-server)
date: 2026-07-04
work_zone: mcp/ (new)
status: BUILT + LIVE-VERIFIED (navigate + get_content + get_url + get_all_cookies round-trip green)
plan_ref: docs/planning/CLARIFIED-NEXT-STEPS.md Step 4; PROJECT-STATUS-MATRIX.md §5 mcp-server
scope_ref: docs/architecture/SCOPE.md (deterministic capture/control; NO models/agents/intelligence)
---

# MCP Server Handoff

Delivers Step 4 of the clarified plan: the browser's **agent-facing MCP surface
that did not previously exist** (matrix §5 mcp-server = "none"). A thin,
deterministic pass-through that exposes ONLY the proven-working WS commands as
MCP tools.

## Deliverables (all under `mcp/`)

| File | Purpose |
| --- | --- |
| `mcp/server.py` | FastMCP server: 13 tools + WS bridge to the browser. ~430 lines. |
| `mcp/README.md` | How an agent connects (stdio + SSE), tool table, config, verification. |
| `mcp/requirements.txt` | `fastmcp==2.1.2`, `websockets` (both already installed). |
| `mcp/verify_e2e.py` | Re-runnable end-to-end proof through the real MCP dispatch path. |

No repo code outside `mcp/` was modified. No git commits. No dependencies added
to `package.json`/`node_modules`.

## Design choice: Python FastMCP (not Node @modelcontextprotocol)

Chose **`mcp/server.py` with FastMCP 2.1.2**. Justification:

1. **Zero new dependency install / zero shared-file mutation.** `fastmcp==2.1.2`
   and `websockets 16.0` are already installed and importable. The Node MCP SDK
   (`@modelcontextprotocol/sdk`) is **absent** from `node_modules`; adding it
   would mutate the shared `package.json` + `node_modules` — outside my work
   zone and risky with concurrent agents editing browser code.
2. **Matches the documented convention.** The plan, `MEMORY.md`, and
   `SCOPE.md` all reference an `mcp/server.py` FastMCP server.
3. **Matches the proven reference pattern.** `docs/rag-app/app/mcp_server.py` is
   a working FastMCP server; `server.py` mirrors its hardened construction
   (tolerates the `description=`→`instructions=` constructor drift across
   fastmcp releases).

The adapter is language-agnostic in effect: it speaks MCP to the agent and flat
JSON over a WS socket to the browser — the browser stays pure Node.

## Architecture (thin pass-through)

```
LLM agent ──MCP(stdio/SSE)──▶ mcp/server.py ──WS {command,id,...}──▶ ws://127.0.0.1:8765
          ◀──tool JSON──────               ◀──{id,command,success,...}──
```

- Request: `{"command":"<name>","id":"<uuid>", ...params}` (only non-null params
  are sent, so browser-side defaults apply). Confirmed protocol:
  `websocket/server.js:1679` destructures `{command,id,...params}`;
  `command-dispatcher.js:156,178` passes the handler's return object back
  verbatim; the envelope is built at `server.js:~1735` as
  `{ id, command, ...response }`.
- Correlation: reply matched by top-level `id` (echoed verbatim on success and
  on plain `{success:false,error}` errors). **Edge case handled:** the browser's
  `ErrorFormatter` param-validation errors (missing `url`/`selector`/`value`)
  return `id: null`; the bridge also accepts an id-less frame whose `command`
  matches the in-flight command.
- Concurrency: a single WS connection with an `asyncio.Lock` → one command in
  flight at a time. This is the correct semantic (the browser drives one page)
  and makes correlation race-free. Reconnect-and-retry-once on a dropped socket.
- Failure mode: an unreachable browser yields
  `{"success":false,"mcp_bridge_error":true,"error":...,"hint":...}` rather than
  an exception, so the agent gets an actionable message.

## Tools (13 — 1:1 with proven-working commands)

Every tool maps to a command in the PROJECT-STATUS-MATRIX "Proven-Working"
column. The fictional ~46-tool catalog was **not** ported.

| Tool | Required | Optional | WS param mapping notes |
| --- | --- | --- | --- |
| `navigate` | `url` | `timeout` | — |
| `get_url` | — | — | — |
| `get_content` | — | — | HTML in `content` |
| `get_page_state` | — | — | raw renderer page-state |
| `execute_script` | `script` | — | result in `result` |
| `screenshot` | — | `format` | base64 under `data` (not flat) |
| `scroll` | — | `x`,`y`,`selector` | **uses x/y/selector**, not direction/pixels |
| `wait_for_element` | `selector` | `timeout` | — |
| `click` | `selector` | `humanize` | — |
| `fill` | `selector`,`value` | `humanize` | **param is `value`**, not `text` |
| `type_text` | `text` | `selector`,`min_delay`,`max_delay`,`clear_first`,`layout`,`mistake_rate` | camelCase WS keys (`minDelay`…) mapped internally |
| `set_cookie` | `name`,`value`,`url` | `domain`,`path`,`secure`,`http_only`,`same_site`,`expiration_date` | assembled into a `{cookie:{...}}` payload; manager requires `url`+`name` |
| `get_all_cookies` | — | `filter` | returns `cookies[]` + `count` |

Param/response shapes were derived from source, not docs: `websocket/server.js`
`setupCommandHandlers()` (navigate ~2764, click ~2883, fill ~2906, get_content
~2934, get_url ~3342, execute_script ~3100, wait_for_element ~3123,
get_page_state ~3083, scroll ~3144, get_all_cookies ~3182, set_cookie ~3192,
type_text ~6204) and `cookies/manager.js` (getAllCookies/setCookie).
Corrections vs. the stale `command-schemas.js` camelCase catalog: `fill` uses
`value`; `scroll` uses `x/y/selector`; `set_cookie` nests a `cookie` object.

## Scope compliance (SCOPE.md hard blacklist)

- No models / LLM / embeddings / inference — the adapter imports only `fastmcp`,
  `websockets`, and stdlib. No `anthropic`/`openai`/model SDKs.
- No agent spawning / orchestration / task queues.
- No intelligence: tools forward commands and return raw browser responses; no
  classification, enrichment, or decision-making. Pattern detection etc. remain
  the calling agent's job.
- Only proven commands are exposed (guardrail from Step 4 respected).

## How to connect

**stdio** (Claude Desktop / local):
```bash
python3 mcp/server.py
```
```json
{"mcpServers":{"basset-hound-browser":{
  "command":"python3","args":["/home/devel/basset-hound-browser/mcp/server.py"],
  "env":{"BASSET_WS_PORT":"8765"}}}}
```

**SSE/HTTP** (palletai / networked):
```bash
python3 mcp/server.py --transport sse --host 127.0.0.1 --port 8899
# endpoint: http://127.0.0.1:8899/sse
```

Config env vars: `BASSET_WS_URL` | `BASSET_WS_HOST`+`BASSET_WS_PORT` (browser),
`BASSET_MCP_TIMEOUT`, `BASSET_MCP_TRANSPORT`/`--transport`, `BASSET_MCP_HOST`,
`BASSET_MCP_PORT`. Port var matches `config/env.js` (`BASSET_WS_PORT` →
`server.port`).

## Verification evidence

**Isolation:** another agent held `ws://127.0.0.1:8765` (its own browser +
`--user-data-dir=/home/devel/bhb-userdata`). To avoid collision I launched a
**separate** headless browser on **port 8781** with
`--user-data-dir=/home/devel/bhb-mcp-userdata` in its own process group
(`setsid`), ran the check, and reaped the whole group (`strays_remaining=0`).
The port was set via `BASSET_WS_PORT=8781` (confirmed to flow through
`config/env.js` → `server.port` → `WebSocketServer`).

**Method:** `mcp/verify_e2e.py` invokes tools via `mcp.call_tool(name, args)` —
the full FastMCP path (pydantic validation → tool → WS bridge → browser).

**Result (green, exit 0):**
```
ws_up=1 after 1s
navigate_1 -> success:true, url=https://example.com/
get_url_1  -> success:true, url=https://example.com/
get_content_1 -> success:true, len=544, has "Example Domain": true
navigate_2 -> success:true   (to https://www.iana.org/)
get_url_2  -> success:true, url=https://www.iana.org/
get_all_cookies -> success:true, count=4
GET_CONTENT_OK=True GET_URL(example)_OK=True GET_URL(iana)_OK=True COOKIES_OK=True
reaping electron pgid=... ; strays_remaining=0
```

`navigate` + `get_content` round-trip through the MCP server is **proven**:
`get_content` returned the actual example.com HTML that `navigate` loaded, and a
second navigation (iana.org) is reflected by `get_url` — deterministic control
confirmed.

**Known browser-side quirk (not an adapter bug):** immediately after startup,
`navigate`'s returned `url` can lag by one navigation (a stale
`navigation-complete` event; the first raw run reported `google.com` while the
page was already example.com). The adapter faithfully returns whatever the
browser sends; `get_url`/`get_content` after settle are authoritative. Matches
the "developed-unproven / timing" caveats in the status matrix.

## Notes / follow-ups (out of this task's scope)

- Add `extract_*` and `get_cookies` MCP tools **only after** Step 1 proves them
  live (per the Step 4 guardrail). Trivial to add — one `@mcp.tool()` each once
  green.
- Consider a smoke test in CI that boots headless and runs `verify_e2e.py`.
- The `navigate.url` staleness is really a browser fix (navigation-complete
  correlation), tracked under core-commands, not the MCP layer.
- Temp verification artifacts lived under `/home/devel/bhb-mcp-*` and were
  removed after the run; the re-runnable check is `mcp/verify_e2e.py`.

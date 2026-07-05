# Basset Hound Browser — MCP Server

A **thin, deterministic pass-through** MCP (Model Context Protocol) server that
lets LLM agents (Claude, palletai, custom automation) drive the browser. Every
tool maps **1:1** to a single, proven-working WebSocket command and simply
forwards the call over the browser's WS API, correlating the reply by request
`id`.

> **Scope (hard boundary — `docs/architecture/SCOPE.md`):** this adapter has
> **no models, no AI/LLM/embeddings, no agent spawning, no orchestration, and
> makes no intelligence decisions.** It is a dumb wire between an MCP client and
> the browser's WebSocket control surface. All reasoning lives in the *external*
> agent that calls these tools.

## Architecture

```
  ┌──────────────┐   MCP (stdio / SSE)   ┌───────────────┐   WS {command,id,...}   ┌──────────────────┐
  │  LLM agent   │ ────────────────────▶ │  mcp/server.py │ ──────────────────────▶ │ Basset Hound WS  │
  │ (Claude/etc) │ ◀──────────────────── │  (FastMCP)     │ ◀────────────────────── │ ws://127.0.0.1:  │
  └──────────────┘   tool result (JSON)  └───────────────┘   {id,command,success..}│      8765         │
                                                                                    └──────────────────┘
```

- **Transport to the agent:** MCP over **stdio** (default) or **SSE/HTTP**.
- **Transport to the browser:** WebSocket, flat JSON. The server sends
  `{"command": "<name>", "id": "<uuid>", ...params}`; the browser replies with
  `{"id", "command", "success", ...fields}`. The bridge correlates by `id`.
- **Serialization:** one command in flight at a time (the browser drives a
  single page, so a navigate must finish before the next click). A lock makes
  id-correlation race-free.

## Tools (18 — proven-working commands only)

Only commands classified **Proven-Working** in
`docs/planning/PROJECT-STATUS-MATRIX.md` are exposed. The fictional ~46-tool
catalog in old docs is intentionally **not** implemented. The four
`extract_*` / `get_cookies` tools were fixed and live-verified in
`docs/findings/BROKEN-COMMANDS-FIX-2026-07-04.md`. Tool #18,
`forensic_capture`, is the one-call sealed-evidence bundle that is Basset's
deepest differentiator (`docs/planning/DIFFERENTIATION-VS-SELENIUM-2026-07-04.md`)
— previously exposed only over WS, now reachable by MCP agents.

| Tool | Required args | Optional args | Returns (key fields) |
| --- | --- | --- | --- |
| `navigate` | `url` | `timeout`=10000 | `url`, `tabId`, `timestamp` |
| `get_url` | — | — | `url` |
| `get_content` | — | — | `content` (HTML), `statusCode`, `headers` |
| `get_page_state` | — | — | forms / links / buttons (raw) |
| `execute_script` | `script` | — | `result` |
| `screenshot` | — | `format`=png | `data` (base64 data URL) |
| `scroll` | — | `x`, `y`, `selector` | scroll status |
| `wait_for_element` | `selector` | `timeout`=10000 | wait status |
| `click` | `selector` | `humanize`=true | click status |
| `fill` | `selector`, `value` | `humanize`=true | fill status |
| `type_text` | `text` | `selector`, `min_delay`=30, `max_delay`=150, `clear_first`=false, `layout`="en-US", `mistake_rate`=0.02 | type status |
| `set_cookie` | `name`, `value`, `url` | `domain`, `path`, `secure`, `http_only`, `same_site`, `expiration_date` | `success` |
| `get_all_cookies` | — | `filter` (object) | `cookies[]`, `count` |
| `get_cookies` | `url` | — | `cookies[]` (URL-filtered) |
| `extract_links` | — | `base_url`, `html` | `all[]`, `count`, `data` (internal/external/mailto/tel/anchor/javascript/other) |
| `extract_forms` | — | `html` | `data[]` (forms), `count`, `fieldCount` |
| `extract_images` | — | `base_url`, `html` | `data[]` (images), `count` |
| `forensic_capture` | `url` | `output_dir`, `settle_ms`=1500, `wait_for_selector`, `screenshot`=true, `network`=true, `storage`=true, `extras`=true, `warc`=false | `bundle_dir`, `final_url`, `status_code`, `captured_at`, `challenge_suspected`, `manifest` (`files[]`+`bundle_sha256`), `warnings` |

The four content tools read the active `<webview>` page when called with no
`html` argument (the normal flow: `navigate` first, then extract). `get_cookies`
returns only the cookies the browser would send to the given `url`, whereas
`get_all_cookies` returns the whole jar.

`forensic_capture` is a **server-side macro** that internally navigates and then
orchestrates the proven capture primitives in a fixed order (network-capture
starts *before* navigation to avoid an empty HAR), writing a manifested,
SHA-256-hashed evidence bundle to disk on the browser host. It returns only a
small index (`bundle_dir` + per-file manifest with a `bundle_sha256` tamper
seal); the heavy artifacts stay on disk. Its `output_dir` is confined by the
same `BASSET_ALLOWED_WRITE_DIRS` PathValidator gate the screenshot/cookie
managers use — a directory outside the allowed set (`<cwd>/captures|exports|data
|tmp|downloads`, the OS temp dir, or an entry in `BASSET_ALLOWED_WRITE_DIRS`) is
rejected before any file is created. Challenge/CAPTCHA pages are **detected and
flagged** (`challenge_suspected`), never bypassed. The adapter stays a pure
pass-through: all of this logic lives in the browser's WS command
(`websocket/commands/forensic-capture-command.js`), not the MCP layer.

Every tool returns the browser's response dict verbatim (the internal
correlation `id` is stripped). `success: true/false` is always present; on
failure `error` (and often `errorCode` / `recoveryHint`) is included. If the
browser is unreachable the tool returns
`{"success": false, "mcp_bridge_error": true, "error": ..., "hint": ...}`
instead of raising.

> **Note on `navigate`'s returned `url`:** immediately after browser startup the
> value can reflect a stale navigation-complete event (a browser-side timing
> quirk, see the status matrix). The navigation itself is reliable — confirm with
> `get_url` / `get_content` after the page settles.

## Requirements

```bash
pip install -r mcp/requirements.txt   # fastmcp==2.1.2, websockets
```

Both are already installed in the reference environment.

## Configuration (environment variables)

| Var | Default | Purpose |
| --- | --- | --- |
| `BASSET_WS_URL` | `ws://127.0.0.1:8765` | Full browser WS URL (overrides host/port) |
| `BASSET_WS_HOST` | `127.0.0.1` | Browser WS host |
| `BASSET_WS_PORT` | `8765` | Browser WS port (matches `config/env.js` mapping) |
| `BASSET_MCP_TIMEOUT` | `90` | Per-command reply timeout (seconds) |
| `BASSET_MCP_TRANSPORT` | `stdio` | `stdio` or `sse` |
| `BASSET_MCP_HOST` | `127.0.0.1` | Bind host for the `sse` transport |
| `BASSET_MCP_PORT` | `8899` | Bind port for the `sse` transport |

## Running

**Prerequisite:** a Basset Hound Browser must be running with its WS API up
(e.g. `npm run start:headless`, which listens on `ws://127.0.0.1:8765`).

### stdio (for Claude Desktop / local agents)

```bash
python3 mcp/server.py            # stdio transport (default)
```

Claude Desktop `claude_desktop_config.json` example:

```json
{
  "mcpServers": {
    "basset-hound-browser": {
      "command": "python3",
      "args": ["/home/devel/basset-hound-browser/mcp/server.py"],
      "env": { "BASSET_WS_PORT": "8765" }
    }
  }
}
```

### SSE / HTTP (for networked agents such as palletai)

```bash
python3 mcp/server.py --transport sse --host 127.0.0.1 --port 8899
# MCP SSE endpoint: http://127.0.0.1:8899/sse
```

A palletai (or any MCP) client points its SSE transport at
`http://<host>:8899/sse`.

## How an agent uses it

1. Start the browser (`npm run start:headless`).
2. Start this MCP server (stdio or sse) pointed at the browser's WS port.
3. The agent lists tools (18 above) and calls them, e.g. `navigate` then
   `extract_links` / `get_content`, reasoning over the raw captured data
   itself — or a single `forensic_capture` for a sealed evidence bundle. The
   browser never reasons — it only executes and reports.

## Verification

`mcp/verify_e2e.py` drives `navigate`, `get_url`, `get_content`,
`get_all_cookies`, `extract_links`, `set_cookie`→`get_cookies` (URL-filtered),
and `forensic_capture` through the real FastMCP dispatch path against a live
browser. The `forensic_capture` check asserts the returned `bundle_dir` exists
on disk and contains a `manifest.json` (with a non-empty `files[]` and a
`bundle_sha256` seal). It writes the bundle to a throwaway temp dir under the OS
temp dir (an allowed write location) and removes it afterward — override with
`BASSET_FC_OUTPUT_DIR` to keep a bundle for inspection.

```bash
npm run start:headless &                       # browser on ws://127.0.0.1:8765
BASSET_WS_PORT=8765 python3 mcp/verify_e2e.py   # exits 0 on success
```

See `docs/handoffs/MCP-SERVER-2026-07-04.md` for the initial isolated run and
`docs/handoffs/MCP-FORENSIC-CAPTURE-TOOL-2026-07-04.md` for the `forensic_capture`
tool addition (distinct port, own process group).

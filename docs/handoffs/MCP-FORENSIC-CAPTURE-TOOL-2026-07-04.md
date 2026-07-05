---
title: Handoff — MCP Tool #18 `forensic_capture` (sealed evidence bundle over MCP)
agent: dev (dev@basset-hound-browser:mcp-forensic-capture-tool)
date: 2026-07-04
work_zone: mcp/ (mcp/server.py, mcp/README.md, mcp/verify_e2e.py)
status: BUILT + LIVE-VERIFIED (forensic_capture round-trips through MCP; sealed bundle + manifest on disk; all prior checks still green; exit 0)
context_ref: docs/planning/DIFFERENTIATION-VS-SELENIUM-2026-07-04.md
source_ref: websocket/commands/forensic-capture-command.js
scope_ref: docs/architecture/SCOPE.md (deterministic capture/control; NO models/agents/intelligence)
---

# MCP `forensic_capture` Tool Handoff

## Why

The differentiation review found that `forensic_capture` — Basset's deepest
differentiator, a one-call sealed/hashed evidence bundle — was exposed only over
the WebSocket API, so LLM agents driving via MCP could not reach it. The MCP
adapter (`mcp/server.py`) exposed 17 thin pass-through tools; this adds it as
tool **#18**, keeping the exact thin-forwarding pattern (no new logic in the MCP
layer).

## What changed (all under `mcp/`)

| File | Change |
| --- | --- |
| `mcp/server.py` | Added `@mcp.tool() async def forensic_capture(...)` — a 1:1 forward to the WS `forensic_capture` command. `url` required; options flattened into typed params reassembled into the WS `options` object. |
| `mcp/README.md` | Header/table/connect text 17 → 18; new tool row; a paragraph explaining the macro, the `BASSET_ALLOWED_WRITE_DIRS` PathValidator gate, and detect-not-bypass; verification section updated. |
| `mcp/verify_e2e.py` | New round-trip #5: calls `forensic_capture` and asserts the returned `bundle_dir` exists on disk with a `manifest.json` (non-empty `files[]`, 64-hex `bundle_sha256`, and the on-disk manifest seal == the returned seal). Writes to a throwaway temp dir (auto-removed; `BASSET_FC_OUTPUT_DIR` keeps it). Timeout default bumped 60 → 120s (heaviest tool). |

No files outside `mcp/` were modified. No git commits. No deps added.

## Tool signature (derived from SOURCE, not docs)

Params and response shape were read from
`websocket/commands/forensic-capture-command.js`, not from any doc:

```python
forensic_capture(
    url: str,                              # required
    output_dir: Optional[str] = None,      # host dir; PathValidator-gated
    settle_ms: int = 1500,
    wait_for_selector: Optional[str] = None,
    screenshot: bool = True,
    network: bool = True,
    storage: bool = True,
    extras: bool = True,
    warc: bool = False,
)
```

- The WS command reads `params.url`, `params.output_dir`, and a `params.options`
  object with snake_case keys (`settle_ms`, `wait_for_selector`, `screenshot`,
  `network`, `storage`, `extras`, `warc`). The tool flattens these into typed MCP
  params (clean schema for the agent) and reassembles the `options` dict before
  forwarding. `output_dir=None` is dropped by the bridge so the browser-side
  default (`<BASSET_CAPTURE_DIR|cwd>/captures`) applies; a `null`
  `wait_for_selector` inside `options` is handled by the command (`|| null`).
- Success response forwarded verbatim: `success`, `bundle_dir`, `final_url`,
  `status_code`, `captured_at`, `challenge_suspected`, `manifest` (per-file
  `name`/`sha256`/`bytes`/`mime`/`source_command` + `bundle_sha256` tamper seal),
  `warnings`. Heavy bytes stay on the browser host's disk; only this small index
  crosses the wire.
- **Write confinement:** the command gates every write through `PathValidator`
  against `<cwd>/captures|exports|data|tmp|downloads`, the OS temp dir, and
  `BASSET_ALLOWED_WRITE_DIRS`. An `output_dir` outside that set is rejected before
  any file is created. Matching logic confirmed in `utils/path-validator.js`
  (`_isPathAllowed`: prefix match; no `..`).

## Scope compliance (SCOPE.md hard blacklist)

Pure pass-through: the tool imports nothing new, spawns nothing, and makes no
decisions — it forwards one WS command and returns the raw response. All macro
orchestration, hashing, and challenge **detection** (never bypass) live in the
browser's WS command, not the MCP layer. No models / LLM / embeddings / agents.

## Verification evidence (live, isolated)

**Isolation:** launched a **separate** headless browser on **port 8793** with a
throwaway `--user-data-dir` (in a gitignored scratch dir, not `tmp/*`), env with
`ELECTRON_RUN_AS_NODE` unset, in its own process group (`setsid`). Ran
`mcp/verify_e2e.py` via the real FastMCP dispatch path (`mcp.call_tool` →
pydantic validation → tool → WS bridge → browser), then reaped the whole process
group.

**Import/registration check:** `list_tools()` → `TOOL_COUNT=18`,
`forensic_capture` present, input schema `required=['url']` with the 8 optional
params. `python3 -m py_compile mcp/server.py mcp/verify_e2e.py` clean.

**Result (green, exit 0):**
```
ws_up=1 after 2s
navigate_1/get_url_1/get_content_1 -> success (Example Domain, len=544)
get_url_2 -> https://www.iana.org/        (second navigation tracked)
get_all_cookies -> success, count=4
extract_links -> success, count=462 == all_len=462 (dom window 462..462)
set_cookie -> get_cookies -> found_test_cookie=true
forensic_capture -> success:true
    bundle_dir = .../fc-bundles/capture_2026-07-04T20-59-08-618Z_0f115db0
    bundle_dir_exists=true, manifest_on_disk=true, manifest_file_count=13
    bundle_sha256=30d3cca0796b5b15dae9556e85cab074929c8e273bbe4f1fc35d6dce139a883e
    disk_seal_matches=true   (on-disk manifest.json seal == returned seal)
    final_url=https://example.com/, status_code=200, challenge_suspected=false, warnings=[]

GET_CONTENT_OK=True GET_URL(example)_OK=True GET_URL(iana)_OK=True
COOKIES_OK=True EXTRACT_LINKS_OK=True GET_COOKIES_OK=True FORENSIC_CAPTURE_OK=True
VERIFY_EXIT=0
reaping electron pgid=725122 ; strays_remaining=0
```

**On-disk bundle (13 artifacts + manifest), written by the browser and stat'd by
the verifier on the shared host:**
```
page.html  screenshot.png  network.har  network.json  cookies.json
storage.json  page_state.json  technologies.json  links.json  images.json
forms.json  metadata.json  chain_of_custody.json      (+ manifest.json)
```
`manifest.json`: `tool=forensic_capture`, `final_url=https://example.com/`,
`file_count=13`, matching `bundle_sha256`.

**All 6 pre-existing e2e checks still pass** alongside the new one — no
regression. Cleanup: throwaway user-data-dir + capture bundles removed;
`strays_remaining=0`; no `captures/` litter in the repo; `git status` shows only
the three `mcp/` files as my changes.

## How to re-run

```bash
npm run start:headless &                       # browser on ws://127.0.0.1:8765
BASSET_WS_PORT=8765 python3 mcp/verify_e2e.py   # exits 0; new forensic_capture check included
# keep a bundle for inspection: BASSET_FC_OUTPUT_DIR=/path/allowed python3 mcp/verify_e2e.py
```

## Notes / follow-ups (out of scope here)

- Screenshot produced real bytes in this run; on some headless/offscreen paints
  it may not — the command then writes a `screenshot_note.txt` + a warning, and
  the manifest stays valid. The tool surfaces `warnings` verbatim.
- `output_dir` is a **browser-host** path. For a remote MCP client the returned
  `bundle_dir` lives on the browser's machine; an artifact-retrieval tool (e.g.
  read-back over WS) could be a future addition but is not in this task's scope.

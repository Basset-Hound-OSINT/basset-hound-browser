# Final Consolidation — 2026-07-04

**Agent:** `dev@basset-hound-browser:final-consolidation`
**Status:** DONE — three closing items landed and verified. No git commits.
**Verification:** `start:headless` boots clean; `smoke:mvp` 14/14 GREEN; `mcp/verify_e2e.py` exit 0 on **2 consecutive runs** (flakiness fix confirmed). Changed JS passes `node -c`; changed Python passes `ast.parse`.

---

## Item 1 — ErrorFormatter `id:null` envelope override (FIXED)

**Problem:** `ErrorFormatter.validationError` injects `id: null`. The response envelope spread the
command response AFTER stamping `id`/`command`, so a formatter's `id: null` clobbered the real
request id — validation errors could not be client-correlated.

**Fix (at the envelope, so it covers every formatter — not per-formatter edits):**

- `websocket/server.js` — primary `_sendResponse` path (was ~line 1911): reordered from
  `{ id, command, ...response }` → **`{ ...response, id, command }`** so the real request id/command
  win over any formatter-injected `id:null`.
- `websocket/server.js` — the queue-processor `_processQueuedCommand` send path (was ~line 2583) had
  the identical envelope with the identical bug; applied the same reorder there for consistency. Both
  are the same "response-envelope" construction; documented inline.

`ErrorFormatter` itself was left unchanged (the envelope fix is the single correct chokepoint). The
error-formatter module was in the work zone but needed no edit given the envelope approach.

**Evidence:** all `smoke:mvp` and `verify_e2e.py` calls correlate replies strictly by id and passed;
if the id were still being nulled, id-correlation would hang/timeout. Replies now echo the real
`id` + `command` (visible in the verify output, e.g. `set_cookie` → `command: "set_cookie"`).

## Item 2 — `mcp/verify_e2e.py` extract_links flakiness (FIXED)

**Problem:** the `extract_links` check asserted `count == document.links.length` across two separate
calls, which flakes by ±1 on lazy-loading pages (Wikipedia).

**Fix:** switched to the **bounded-window** pattern already used by `scripts/smoke-mvp.js` — read the
live `document.links.length` **before AND after** extraction and require the returned `count` to fall
within `[min, max]` (exact when the DOM is quiescent), plus `count === all.length` for internal
consistency, with a `>100` floor fallback when the DOM probe is unavailable.

**Evidence:** ran `verify_e2e.py` twice back-to-back against a live headless browser (distinct port
8788) — **both exit 0**; extract_links reported `count=462`, `dom_before=462`, `dom_after=462`,
inside window. The old exact-equality assertion is gone.

## Item 3 — `docs/planning/PROJECT-STATUS-MATRIX.md` refreshed to TRUE final state

The matrix was stale (written before this session's fixes). Rewrote it to reflect the real end state,
kept honest and current, verified against source + live runs:

- **MCP server EXISTS** — `mcp/server.py`, FastMCP 2.1.2, **17 tools** (confirmed: 17 `@mcp.tool()`),
  live-verified via `verify_e2e.py`. Section 5 rewritten from "(none)" to proven-working.
- **extract_* / get_cookies / storage / session save+restore / HAR-WARC / tech-detection /
  forensic-hashing all WORKING** — proven live via `smoke:mvp` 14/14 + `mcp verify`. Confirmed
  registration/wiring in source: `getWebviewPageContent()` (server.js:2928) routes the 8 extract_*
  handlers + `export_raw_html` + `detect_technologies`/`identify_cms`/`identify_analytics`;
  `get_cookies` double-registration fixed (`get_cookies_network` preserved, server.js:10906);
  storage renderer consumer added (renderer.js:687); `getLogs()` added (network-analysis/manager.js:395)
  so HAR/WARC exporters work; `registerV12_9_0Commands()` now called (server.js:11835).
- **Security HARDENED** — loopback bind (`this.host = ... || '127.0.0.1'`, server.js:1097), SSRF guard
  (`validateNavigationUrl`, server.js:335, applied at navigate/navigate_tab/navigate_window),
  PathValidator wired into `screenshots/manager.js` + `cookies/manager.js`. Auth deliberately OFF.
- **78 dead files PRUNED** — `src/evasion/` now empty; evasion cleanly deferred to
  `docs/research/bot-detection/salvage/` (3 preserved fingerprinting refs). Section 3 rewritten as
  "DEFERRED BY DESIGN".
- **Recording subsystem is LIVE** — `recording/manager.js` + `registerRecordingCommands`
  (server.js:11745) preserved; `src/recording/video-{encoder,player,storage}.js` retained.

Also updated: executive summary, legend counts (Proven-Working ~35 → ~70), the "what is still NOT
done" honesty block (evasion ~0% deferred, collaboration API broken, live proxy routing unverified,
offscreen 0-frame, monolith server.js ~12,090 lines), and the cross-cutting truths (shell-vs-webview
bug class now largely fixed; registered-vs-written gap narrowed; security hardened; prune done).

---

## Files changed (work zone only)

| File | Change |
| --- | --- |
| `websocket/server.js` | Two response-envelope reorders (`{ ...response, id, command }`) — `_sendResponse` path + queue-processor path |
| `mcp/verify_e2e.py` | extract_links check → bounded-window (before/after DOM count), internal `count===all.length`, floor fallback |
| `docs/planning/PROJECT-STATUS-MATRIX.md` | Full refresh to the true final state (authoritative source of truth) |

`websocket/error-formatter.js` was in the work zone but intentionally left unchanged (envelope fix is
the correct single chokepoint).

## Verification log

- `node -c websocket/server.js` → OK; `node -c websocket/error-formatter.js` → OK.
- `python3 -c ast.parse mcp/verify_e2e.py` → OK.
- `npm run smoke:mvp` → **14/14 PASS** (isolated ephemeral WS port 46275, own process group, temp
  under `/home/devel/bhb-smoke-*`, reaped clean).
- `start:headless` boot (distinct WS port 8788, throwaway user-data-dir under `/home/devel/bhb-verify-*`,
  own process group) → booted clean, WS up.
- `mcp/verify_e2e.py` RUN 1 exit 0, RUN 2 exit 0 → **flakiness fix confirmed**.
- Post-run: no stray headless processes, no listener on 8788, `bhb-verify-*`/`bhb-smoke-*` temp dirs
  removed (only pre-existing scratch files remain). No git commits.

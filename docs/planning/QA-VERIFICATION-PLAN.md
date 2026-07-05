---
title: Basset Hound Browser — MVP Verification Plan
status: AUTHORITATIVE (QA)
date: 2026-07-04
author: qa-manager@basset-hound-browser:mvp-verification-plan
companions: PROJECT-STATUS-MATRIX.md, CLARIFIED-NEXT-STEPS.md
sources: docs/findings/BROKEN-COMMANDS-FIX-2026-07-04.md, docs/findings/SECURITY-AUDIT-CONTROL-SURFACE-2026-07-04.md
scope: docs/architecture/SCOPE.md — deterministic capture/control tool; NO internal agents, NO AI/ML models
goal: A short, honest smoke set that proves "the browser is stable and shippable" end-to-end — NOT an exhaustive test suite.
---

# MVP Verification Plan

**Operator ask:** a working, stable deployment with maximum features at minimum viability — and a *clear plan of what to verify*, not test-chasing.

**This document answers one question:** what is the smallest set of end-to-end checks that, if green, lets us call the browser stable and ship it? Everything here is a **smoke test** — one command, one observable, against a real page. No coverage targets, no counting green units.

**Non-negotiable evidence rule (inherited from the status matrix):** a check only counts if it round-trips **over the live WS API against a real DOM**. "Module unit test passes" and "handler is registered" do **not** count. Every PASS below must produce a captured log line, not an assertion in a mocked suite.

---

## 0. Preconditions (the substrate every check assumes)

| # | Precondition | How to confirm | Expected observable |
|---|---|---|---|
| P1 | Browser boots headless | `npm run start:headless` | `boot.log` shows init; WS listening on `ws://127.0.0.1:8765` within ~3s |
| P2 | WS API answers | connect + send `{"command":"status","id":"p2"}` | reply `{"id":"p2","success":true,...}` |
| P3 | Flat-JSON protocol | any command uses `{command, id, ...params}`; reply echoes `{id, command, success, ...}` | ids correlate 1:1 |

Protocol for all smoke tests below: connect a WS client to `ws://127.0.0.1:8765`, send flat JSON `{"command":"<name>","id":"<unique>", ...params}`, read the frame whose `id` matches. Auth is off by default (see security note at end).

---

## 1. The Minimum-Viable Feature Set

Three tiers. **Tier A + Tier B must be green to ship. Tier C is explicitly deferred** (currently known-broken; verify only *after* the structural fix, do not block MVP on it).

### Tier A — Proven-working core (the genuine foundation; already verified in the matrix — re-prove with one captured run each)

`navigate`, `get_url`, `get_content`, `get_page_state`, `execute_script`, `screenshot`, `scroll`, `wait_for_element`, `click`, `fill`, `type_text`, `set_cookie`, `get_all_cookies`.

### Tier B — Newly-fixed, still "developed-unproven" until an e2e run exists (this session's deltas)

- `extract_links`, `extract_forms`, `extract_images` (representatives of the 8-handler `extract_*` family routed through `getWebviewPageContent()`).
- `get_cookies { url }` — RFC-6265 URL filtering, after the forensic-override restore.
- **MCP server** (`mcp/server.py`) — thin FastMCP pass-through exposing the 13 Tier-A tools; proves the agent-facing surface.

### Tier C — Pending structural fix (NOT in MVP; listed so nobody re-verifies them as if they work)

`get_local_storage`/`set_local_storage` (+ session/IndexedDB storage), session `create/switch` isolation, `export_raw_html`, and tech-detection (`detect_technologies`/`identify_cms`/`identify_analytics`). All still read the shell `mainWindow.webContents` or a dead IPC bridge (confirmed on disk: server.js:8223/8285/8335/8735/8740; storage has no renderer consumer). They will return shell/empty data on live pages. **Do not smoke-test for PASS yet** — instead assert the *known-failure signature* (§5) so a future fix is detected.

---

## 2. Smoke Tests — one concrete check per item

Canonical pages (stable, cheap, self-validating):
- **`https://example.com/`** — tiny, known marker `Example Domain`, exactly one link (to iana.org). Content/URL/screenshot checks.
- **`https://en.wikipedia.org/wiki/Web_scraping`** — many links/images; `document.links.length` gives a live ground-truth to cross-check `extract_links`.
- **`https://www.wikipedia.org/`** — has a search input `input[name="search"]` for interaction (fill/type/click).

The **cross-check pattern** (from BROKEN-COMMANDS-FIX) is the strongest single proof and is reused throughout: run `execute_script` to read a DOM fact, then run the capture command and assert they **match**. This proves the command reads the real `<webview>` DOM, not the shell.

### Tier A

| # | Command | Input | Expected observable (PASS) |
|---|---|---|---|
| A1 | `navigate` | `{"command":"navigate","url":"https://example.com/","timeout":30000}` | `success:true`, reply `url` contains `example.com` |
| A2 | `get_url` | `{"command":"get_url"}` (after A1) | `success:true`, `url` === `https://example.com/` |
| A3 | `get_content` | `{"command":"get_content"}` (after A1) | `success:true`, `content` length > 500 **and** contains `Example Domain` |
| A4 | `get_page_state` | `{"command":"get_page_state"}` (after A1) | `success:true`, payload has `links`/`forms`/`buttons` arrays; `links` length ≥ 1 |
| A5 | `execute_script` | `{"command":"execute_script","script":"document.title"}` | `success:true`, `result` === `Example Domain` |
| A6 | `screenshot` | `{"command":"screenshot","format":"png"}` | `success:true`, payload under `data` is a PNG data URL (`data:image/png;base64,`), decoded bytes > 5 KB |
| A7 | `scroll` | navigate Wikipedia first; `{"command":"scroll","y":800}` | `success:true`; follow-up `execute_script:"window.scrollY"` returns ≈ 800 (> 0) |
| A8 | `wait_for_element` | on Wikipedia article; `{"command":"wait_for_element","selector":"#firstHeading","timeout":10000}` | `success:true` (element found before timeout) |
| A9 | `click` | on `https://www.wikipedia.org/`; `{"command":"click","selector":"input[name=search]","humanize":true}` | `success:true`; follow-up `execute_script:"document.activeElement.name"` === `search` |
| A10 | `fill` | same page; `{"command":"fill","selector":"input[name=search]","value":"web scraping","humanize":true}` | `success:true`; `execute_script:"document.querySelector('input[name=search]').value"` === `web scraping` |
| A11 | `type_text` | same page (clear first); `{"command":"type_text","selector":"input[name=search]","text":"osint","clearFirst":true}` | `success:true`; input value === `osint` |
| A12 | `set_cookie` | on example.com; `{"command":"set_cookie","cookie":{"name":"bhb_smoke","value":"1","url":"https://example.com/"}}` | `success:true` |
| A13 | `get_all_cookies` | `{"command":"get_all_cookies","filter":{}}` (after A12) | `success:true`, `cookies` array includes `bhb_smoke`, `count` ≥ 1 |

### Tier B

| # | Command | Input | Expected observable (PASS) |
|---|---|---|---|
| B1 | `extract_links` | navigate Wikipedia `Web_scraping`; read `execute_script:"document.links.length"` → **N**; then `{"command":"extract_links"}` | `success:true`, `count` === **N** (exact match), `all` length === **N**, sample hrefs are real page anchors (`/wiki/...`) — **not** empty |
| B2 | `extract_forms` | on `https://www.wikipedia.org/`; `{"command":"extract_forms"}` | `success:true`, returns ≥ 1 form whose inputs include the `search` field (non-empty) |
| B3 | `extract_images` | on Wikipedia article; `execute_script:"document.images.length"` → **M**; then `{"command":"extract_images"}` | `success:true`, `count` > 0 and consistent with **M** (equal, or explained by lazy-load) |
| B4 | `get_cookies { url }` | on Wikipedia; `set_cookie bhb_url_test`; then `{"command":"get_cookies","url":"https://en.wikipedia.org/wiki/Web_scraping"}` | `success:true`, `count` ≥ 1, returned names include `bhb_url_test` **and** are URL-scoped (no unrelated-domain cookies) |
| B5 | MCP adapter | `npm run start:headless` then `BASSET_WS_PORT=8765 python3 mcp/verify_e2e.py` | script prints `GET_CONTENT_OK=True GET_URL(example)_OK=True GET_URL(iana)_OK=True COOKIES_OK=True` and **exits 0** — proves MCP tools dispatch through FastMCP → WS → live browser |

**B5 detail:** `mcp/verify_e2e.py` already exists and drives `navigate` (example.com + iana.org), `get_url`, `get_content` (asserts `Example Domain` marker + content length), and `get_all_cookies` through the *real* `mcp.call_tool` path (pydantic arg validation → tool → WS bridge). This is the MVP smoke for the entire MCP layer. It exits `0` on success / `2` on failure — CI-ready as-is. (Gap: it does not yet cover the interaction tools `click`/`fill`/`type_text`/`screenshot`; see §4 recommendation to extend it.)

---

## 3. Onboarding Diagnostics / Self-Test — investigation & recommendation

**Investigated** (`grep` for `diagnostics`, `self-test`, `onboard`, `healthcheck`, `/api/diagnostics`). What exists on disk **today**:

| Surface | File | What it actually does | Is it a command smoke-test? |
|---|---|---|---|
| DiagnosticsAPI (v12.10.0) | `websocket/diagnostics-api.js` (769 L), wired `server.js:1153` | Serves `GET /api/help`, `/api/diagnostics` (health + version + **static** capability list), `/api/status`, `/api/schema`, `/api/version` | **No** — pure *documentation/introspection*. It reports what commands *exist*; it never *drives* one. |
| Health endpoints | `websocket/health-endpoint.js` (440 L), wired `server.js:1146` | `GET /health`, `/health/live`, `/health/ready`; K8s probes; per-command latency metrics via `recordCommand()`; **pluggable** `registerCheck(name, fn)` | **No** — only a `websocket` check (client count) is registered (`server.js:1146`). Liveness/readiness/memory/CPU only. |
| MCP e2e driver | `mcp/verify_e2e.py` | Drives real commands through MCP → WS → browser; exits 0/2 | **Yes** — but only the MCP-tool subset, and it is a standalone script, not an in-server endpoint. |

**Verdict:** the *scaffolding* for onboarding diagnostics is present and wired, but nothing exercises the actual command surface against a live page. `/api/diagnostics` gives false comfort — it says "these commands are available" while several of those commands are broken (Tier C).

**Recommendation (concrete, low-cost, kills throwaway scripts):**

1. **Add ONE pluggable self-test that reuses the existing HealthEndpoint registry.** The infrastructure already supports it: `HealthEndpointManager.registerCheck(name, asyncFn)` exists and is called at `server.js:1146`. Register a small set of **smoke checks** that internally dispatch the Tier-A/B commands against a fixed built-in page (or `about:blank` + injected DOM to avoid a network dependency), returning `{ok, message}` per command.
2. **Expose it as an opt-in, not on the always-on probe path.** A live navigation is too heavy for a K8s readiness probe. Surface it as either:
   - a new WS command `run_self_test` (returns a per-command PASS/FAIL matrix), and/or
   - `GET /api/diagnostics?selftest=1` that triggers the registered smoke checks and returns their results.
   Keep the default `/health` and `/api/diagnostics` cheap and static as they are now.
3. **Have that self-test cover exactly the §2 smoke set.** Then the smoke matrix has one canonical implementation living *inside the server*, callable on demand (onboarding, post-deploy, CI). No per-session throwaway driver lingers in the repo.
4. **Keep `mcp/verify_e2e.py` as the MCP-layer counterpart** (it proves the adapter, which an in-server self-test cannot reach). Extend it to the full tool set (see §4).

This is a small, in-scope addition (it only *calls existing proven commands* — no models, no intelligence), and it converts the current documentation-only `/api/diagnostics` into a real "is this browser actually working right now?" answer.

---

## 4. The ONE recommended way to run the whole MVP smoke set

**Today (works now, zero new code):**

```bash
# Terminal 1 — browser
npm run start:headless               # WS API on ws://127.0.0.1:8765

# Terminal 2 — MCP-layer smoke (proves the agent surface + core capture)
pip install -r mcp/requirements.txt  # fastmcp==2.1.2, websockets (already present in ref env)
BASSET_WS_PORT=8765 python3 mcp/verify_e2e.py   # prints *_OK=True flags, exits 0 / 2
```

`mcp/verify_e2e.py` is the closest thing to a single repeatable entry point and is CI-friendly (exit 0/2). Its **gap**: it covers `navigate`/`get_url`/`get_content`/`get_all_cookies` but not interaction (`click`/`fill`/`type_text`/`screenshot`/`scroll`/`wait_for_element`) nor the Tier-B `extract_*`/`get_cookies{url}` (those aren't MCP tools yet).

**Recommended target (one command, full coverage):** add a single WS-level smoke driver and an npm script so the whole §2 matrix runs from one entry, self-boots headless, prints a PASS/FAIL table, exits 0/2, and reaps the browser (own process group, `kill(-pid)` — the hygiene pattern already used in BROKEN-COMMANDS-FIX). Suggested:

```bash
npm run smoke:mvp        # boots headless, runs A1–A13 + B1–B4, reaps browser, exits 0/2
python3 mcp/verify_e2e.py  # (extended) runs the MCP-layer subset — B5
```

Prefer to make `smoke:mvp` a thin wrapper over the **in-server `run_self_test`** from §3 once that exists, so there is exactly **one** implementation of the smoke set (server-owned), invoked three ways: WS command, `/api/diagnostics?selftest=1`, and the npm script. That is the "repeatable, not ad-hoc, no lingering throwaway scripts" outcome the operator asked for.

---

## 5. Explicitly OUT of scope for MVP (do NOT verify)

Verifying these now is wasted effort — they are unwired, out-of-scope, or their advertised numbers are fabricated. Listed so QA does not chase them.

| Excluded | Why (evidence) | What to do instead |
|---|---|---|
| **~37 `src/evasion/*` modules** (canvas/WebGL/audio/font/webrtc "82–90% evasion") | Dead code: patch **no live browser API**; only a partial post-load navigator stub reaches the page. Effectiveness numbers are simulator/hardcoded, never validated against a live detector. Matrix §3. | Treat evasion as **0% / research track**. Do not claim any effectiveness. `docs/research/bot-detection/BOT-DETECTION-GAP-ANALYSIS.md`. |
| **Unregistered v12.9.0 handlers** (compression/forensics/export/collaboration/evidence WS commands) | Handler files written but `registerV12_9_0Commands`/`registerCollaborationCommands`/`registerEvidenceCommands` are **never called** — 0 refs in `server.js`. Unreachable over WS. Collaboration also has real logic bugs (12/85 failing). Matrix §4, §7. | Wire-or-defer decision (CLARIFIED-NEXT-STEPS Step 6), not a smoke test. Module-level green ≠ shippable. |
| **Tier C: storage / session-switch / `export_raw_html` / tech-detection** | Same shell-vs-webview / dead-IPC bug class, **unfixed** (storage has no renderer consumer; server.js:8223/8285/8335/8735/8740 read the shell; session switch is a no-op). Matrix §2, §8. | Assert the **known-failure signature** only (e.g. storage op times out ~30s; `export_raw_html` returns shell HTML lacking page markers) so a future fix is auto-detected. Do not expect PASS. |
| **Proxy-pool / proxy-intelligence / dark-web / Tor daemon-spawn** | Files missing (migrated to `basset-hound-networking`) or out-of-scope per SCOPE.md; Tor only connects to an existing daemon. Matrix §6. | Out of repo scope. Single-proxy set/clear/status is the only proxy surface, and even that is not MVP-critical. |
| **`export_format_har/warc`** | Registered but **broken** — call `networkAnalysisManager.getLogs()` which doesn't exist (real: `getRequests`). Guaranteed error. Matrix §4 / Step 7. | Fix the method name (1-liner) or disable the command; then it *could* enter smoke. Not MVP-blocking. |
| **"164 commands / 100% test pass / v12.8.0 PRODUCTION COMPLETE"** | Fabricated. Server registers ~888 handler keys; core integration suites self-skip; many suites fail to load under Node 18. Matrix Exec Summary. | Ignore these numbers entirely. This plan's ~18 smoke checks are the real bar. |

---

## 6. Definition of "stable / shippable" (MVP exit criteria)

Ship when **all of**:

1. **P1–P3** green (headless boots, WS answers, protocol correlates).
2. **A1–A13** each produce a captured live-run PASS log in-repo (not a mocked assertion).
3. **B1–B4** green with the **cross-check** matching (`extract_links.count === document.links.length`; `get_cookies{url}` returns the URL-scoped test cookie).
4. **B5** green: `mcp/verify_e2e.py` exits 0 against the live browser.
5. Tier-C items are **documented as known-broken** (not silently claimed working), with their failure signatures recorded.
6. Every doc/README number that contradicts this plan is corrected or archived (CLARIFIED-NEXT-STEPS Step 0).

That is the whole bar. ~18 live smoke checks + one MCP e2e exit-0. Anything beyond it is post-MVP.

---

## 7. Security note (do not conflate with functional smoke)

The smoke set runs with **auth off, bound to loopback** — fine for local QA. Before any **network-exposed** deployment, the C-1 finding (server binds `0.0.0.0` unauth by default, docker publishes it) must be resolved: default loopback bind + require token for non-loopback. See `SECURITY-AUDIT-CONTROL-SURFACE-2026-07-04.md`. This is a *deployment gate*, tracked separately from this functional MVP plan — but it is a hard gate for "shippable" in any multi-host context.

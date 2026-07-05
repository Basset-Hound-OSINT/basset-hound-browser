---
title: Basset Hound Browser — Project Status Matrix
status: AUTHORITATIVE
supersedes: "v12.8.0 PRODUCTION COMPLETE narrative (MEMORY.md and all completion/deployment reports); the pre-session draft of this same matrix"
date: 2026-07-04
method: Classified against source code + live headless boot + reproducible runs (`npm run smoke:mvp` 14/14, `python3 mcp/verify_e2e.py` exit 0) — NOT against status docs
scope: docs/architecture/SCOPE.md (deterministic capture/control tool; NO internal agents, NO AI/ML models, NO live bot-evasion)
---

# Project Status Matrix (Authoritative)

## CURRENT STATUS (end of 2026-07-04) — READ THIS FIRST

**Basset Hound is a working, verified, private forensic capture/control browser** (not a Chrome clone — see `DIFFERENTIATION-VS-SELENIUM-2026-07-04.md`). End-of-2026-07-04 state:
- **Boots + drives** headless AND with an opt-in GUI (`npm run start:headless` / `npm run start:gui`). Verified: **`npm run smoke:mvp` = 15/15**, **`python3 mcp/verify_e2e.py` = exit 0**.
- **Agent-drivable:** an **18-tool MCP server** (`mcp/server.py`, includes `forensic_capture`) over WS on `127.0.0.1:8765`.
- **Differentiators PROVEN live** (vs Selenium/ChromeDriver): built-in **Tor + proxy anonymity** (real IP → Tor/proxy exit; dead-port breaks connectivity = genuine routing, not a facade); **clean coherent stealth identity** (no `Electron`/`basset` tokens in the UA on JS or wire); one-call **`forensic_capture`** → SHA-256-hashed, chain-of-custody, 13-file evidence bundle.
- **Code health:** ALL 13 files that exceeded the 1,200-line cap are now modularized — `websocket/server.js` **12,096 → 1,110** (904 commands preserved byte-identical), `src/main/main.js` **3,112 → 1,178**, `renderer/renderer.js` 1,527 → 587, + proxy / extraction / config / technology / evasion / recording / monitoring / network-forensics.
- **Still NOT done (honest):** only **~70 of ~904 registered commands are PROVEN** — **Phase 1 (command-surface verification & repair)** is the next major effort (`PHASE-1-COMMAND-VERIFICATION-PLAN.md`, `NEXT-SESSION-PLAYBOOK.md`). Live bot-evasion deferred (~0%); collaboration API broken; HAR response bodies not yet captured.
- **All work UNCOMMITTED** (operator: no commits yet).

> ⚠️ The per-subsystem detail BELOW this section was written *mid-session* (before the modularization + anonymity/UA proofs). Where it says `server.js ~12,090` / `main.js ~3,059`, "17 tools", "smoke 14/14", or "live proxy routing not verified / offscreen 0 frames" — **THIS top block supersedes it** (those items are now done/proven).

---

> **This is the single source of truth for what actually works.** It was refreshed at the
> close of the 2026-07-04 consolidation session and now reflects the code as it stands
> AFTER that session's fixes (webview routing, storage bridge, session capture, HAR/WARC
> export, v12.9.0 registration, the thin MCP server, security hardening, and the 78-file
> prune). The earlier "v12.8.0 PRODUCTION COMPLETE / 100% tests / 85-90% evasion / 164
> commands" narrative remains inflated and is superseded here.

## Executive Summary — where the project ACTUALLY is

1. The browser **boots and drives headless** (`npm run start:headless`, WS API on `ws://127.0.0.1:8765`, flat JSON `{command,id,...params}`). The **proven-working core is now materially larger** than in the pre-session draft and is backed by two reproducible harnesses: `npm run smoke:mvp` (14/14 GREEN, self-boots an isolated headless browser) and `python3 mcp/verify_e2e.py` (exit 0, full FastMCP dispatch path). Navigate, get_url/content/page_state, execute_script, screenshot, scroll, wait, click, fill, type all drive a live `<webview>`.
2. **The "shell-vs-webview" bug class is fixed.** The recurring defect — handlers reading the empty browser *shell* (`mainWindow.webContents`) or a dead IPC bridge instead of the guest `<webview>` — was closed across `extract_*`, localStorage/sessionStorage/IndexedDB, session-state capture/restore, CDP network throttling, `export_raw_html`, and technology detection. These subsystems moved from **broken/unproven → proven-working**.
3. **A browser-facing MCP server now EXISTS and is verified.** `mcp/server.py` is a real FastMCP 2.1.2 server exposing **17 tools** over the proven WS command set, with a WS bridge, id-correlation, and reconnect-retry. It is live-verified end-to-end (`mcp/verify_e2e.py`). The prior "no MCP server on disk" finding is resolved. (The fictional ~46-tool catalog was deliberately NOT ported — 17 honest tools over proven commands.)
4. **The control surface is HARDENED** (local-agent model preserved, auth intentionally left OFF): default **loopback bind** (`127.0.0.1`, wired end-to-end from `main.js` through the constructor; `BASSET_WS_BIND` to opt into other interfaces; docker publishes `127.0.0.1:8765` by default), an **SSRF guard** on all navigate paths (blocks `file://`, loopback, RFC1918, link-local/`169.254.169.254`, IPv6 ULA/link-local, IPv4-mapped v6, with DNS-rebinding defense), and **PathValidator** wired into screenshot and cookie file I/O.
5. **Dead code was pruned honestly.** 78 files deleted, 3 preserved-by-move. The evasion framework is **cleanly deferred, not faked**: `src/evasion/` is now empty and the three worth-keeping fingerprinting references live under `docs/research/bot-detection/salvage/`. The **live recording subsystem was preserved** (it is required and command-registered — deleting it breaks boot).

**What is still NOT done / not proven** (kept honest): live **bot-evasion is deferred (~0%)** — no auto-injected canvas/WebGL/audio hooks reach a page; the **collaboration API is broken** (11+/85 failing, unwired); **live proxy routing** through the webview is architecturally plausible but not verified against a real proxy; **offscreen rendering yields 0 frames** (screenshots use a `mainWindowDirect` fallback); and `websocket/server.js` (~12,090 lines) + `src/main/main.js` (~3,059 lines) remain **monolithic** despite "modularized" doc claims.

**Bottom line:** a working, security-hardened, deterministic capture/control browser with a proven core, a thin verified MCP adapter, and a repaired forensic/export surface — with evasion explicitly deferred and a handful of subsystems still unproven or broken. This is a genuinely shippable "reliable headless capture/control over WS + MCP" product.

## Legend & counts

| Symbol | Column | Meaning | Approx. count |
| --- | --- | --- | --- |
| ✓ | Proven-Working | Verified against real DOM / live boot / smoke:mvp 14/14 / mcp verify / dedicated harness | ~70 |
| ? | Developed-but-Unproven | Code exists & reachable, but no reproducible end-to-end proof yet | ~22 |
| ○ | Planned-not-Built | Documented but no working code on disk (or deferred by design) | ~22 |
| ◐ | Started-Incomplete | Partial/stub/orphaned code, in-flight | ~12 |

Counts are approximate (some items straddle categories). The distribution shifted materially this session: **Proven-Working roughly doubled** as the shell-vs-webview fixes, the MCP server, and the v12.9.0 registration all landed and were verified.

---

## 1. browser-core-commands

| Proven-Working ✓ | Developed-but-Unproven ? | Planned-not-Built ○ | Started-Incomplete ◐ |
| --- | --- | --- | --- |
| `navigate` (IPC round-trip; SSRF-guarded) — smoke + mcp verify | Core Jest integration suites (self-skip in CI; need live Electron+Playwright; no captured green run) — but the behaviors they cover are now proven by smoke:mvp/mcp instead | (none) | (none for the core set) |
| `get_url` (live page URL; authoritative post-settle) — smoke + mcp | `screenshot` fidelity: works but image includes chrome via `mainWindow` fallback (`captureMethod:'mainWindowDirect'`); offscreen pipeline renders 0 frames | | |
| `get_content` (page HTML via `get-page-content` IPC) — smoke + mcp | | | |
| `get_page_state` (forms/links/buttons) | | | |
| `execute_script` (arbitrary JS in the `<webview>`) — smoke + mcp | | | |
| `screenshot` (webview capture + `mainWindowDirect` headless fallback; non-empty PNG) — smoke (13140 bytes) | | | |
| `scroll`, `wait_for_element` — smoke | | | |
| `click`, `fill`, `type_text` (humanized; value round-trips) — smoke (`fill` readback exact) | | | |

**Outdated claims:** "164 WebSocket Commands" (README/MEMORY) → server.js assigns ~880+ handler keys. "v12.8.0 100%/116-test green" → the Jest suites still self-skip; the honest reproducible proof is now `smoke:mvp` (14/14) + `mcp/verify_e2e.py` (exit 0). "12+ screenshot variants" → base `screenshot` proven and headless-caveated.

---

## 2. extraction-commands

| Proven-Working ✓ | Developed-but-Unproven ? | Planned-not-Built ○ | Started-Incomplete ◐ |
| --- | --- | --- | --- |
| `extract_links` — routed through `getWebviewPageContent()` (server.js:2928); **proven live**: `count` tracks `document.links.length` within the lazy-load window (smoke) and exact-matched 462/486 (mcp verify) | Parsing layer (manager.js regex + cheerio processors) — unit tests fail to load under Node 18 (`File is not defined`, cheerio/undici); Electron-only, so not independently green | `extract_text`, `extract_tables` — referenced in docs, **no handler registered** | `manager.js` orchestrator refactor — only `extractAll` delegates; per-command methods still inline regex |
| `extract_images` — webview-routed; **proven live** (mcp verify: 23 then 12 images) | `extract_metadata`, `extract_scripts`, `extract_stylesheets`, `extract_structured_data`, `extract_all` — registered & webview-routed (same fixed code path as the proven three), but not each independently asserted end-to-end | `export_page_metadata/open_graph/twitter_card` + `capture_computed_styles` — design-doc only | `extraction/processors/` — small stub set, not the full documented suite |
| `extract_forms` — webview-routed; shares the identical proven path; exposed as an MCP tool | | `20+ forensic extractors` / `extraction/forensic-extractors/` — directory does not exist | |
| `detect_technologies` — webview-routed + category-filter fixed; **proven live** (smoke: jQuery+Bootstrap on local page; 5 techs on wordpress.org) | | | |
| `identify_cms` / `identify_analytics` — webview-routed; category filter normalized singular→array (WordPress→`['WordPress']`) | | | |
| `export_raw_html` — webview-routed; **proven live** (smoke: 393 KB real Wikipedia HTML, real markers) | | | |
| `get-page-content` IPC path the fixes reuse (renderer.js:654) | | | |

**Outdated claims:** the API-REFERENCE `{data:{links,total}}` schema is wrong — `extract_links` returns categorized `{internal,external,mailto,...,all[],count}` with `count === all.length`. The prior "live-empty extraction bug" is FIXED (webview routing landed & proven). "manager is a full orchestrator" still partial.

---

## 3. evasion-framework — DEFERRED BY DESIGN (out of current scope)

| Proven-Working ✓ | Developed-but-Unproven ? | Planned-not-Built ○ | Started-Incomplete ◐ |
| --- | --- | --- | --- |
| Navigator-property stub IS injected (webdriver=undefined, plugins, languages, platform) — the ONLY evasion reaching a real page (renderer.js:34 → preload.js) — retained, not a product claim | (none — the isolated unit-tested modules were pruned) | Live document-start / isolated-world canvas/WebGL/audio hooks — **deferred**; salvage refs kept for a future effort | (none — dead cluster removed) |
| | | UA Client Hints spoofing, wire-level TLS/JA4 control, WebRTC IP policy, CAPTCHA handling — **all deferred** (see `docs/research/bot-detection/`) | |

**This section changed the most.** The ~37 dead `src/evasion/*` simulator/coherence/fingerprint modules (which patched **no live browser API**) were **pruned** — `src/evasion/` is now empty. The three worth salvaging were **moved with history** to `docs/research/bot-detection/salvage/` (`canvas-evasion.js`, `canvas-fingerprinting-v2.js`, `webgl-evasion.js`). Evasion effectiveness is **honestly ~0%** and evasion is **explicitly out of the current shippable scope**; the research corpus in `docs/research/bot-detection/` (gap analysis + 8 topic files) is the deferred plan.

**Outdated claims (fully retired):** "Canvas 82% / WebGL 90% verified", "28 modules all Complete", "85-90% across all detection services" — these described dead code against fake endpoints and are gone with the prune. See `docs/research/bot-detection/BOT-DETECTION-GAP-ANALYSIS.md`.

---

## 4. forensic-capture

| Proven-Working ✓ | Developed-but-Unproven ? | Planned-not-Built ○ | Started-Incomplete ◐ |
| --- | --- | --- | --- |
| ForensicAnalyzer core lib (src/v12-9-0/forensic-analyzer.js): SHA-256 hashing + tamper detection, timeline, chain-of-custody, JSON/CSV/HTML reports — pure/deterministic, hash byte-for-byte verified | NetworkAnalysisManager live capture (webRequest hooks, wired main.js) — real code; the isolated-Electron harness captured 34 live requests, but full live coverage still Electron-gated | Evidence packaging / sealing / RFC 3161 / court export (14-cmd API) — Phase 29 "REMOVED (out of scope)" | (none material) |
| **8 forensic WS commands now REGISTERED & reachable** — `registerV12_9_0Commands()` is called (server.js:11835); handler calling convention fixed; `verifyArtifactIntegrity` returns verified:true; report generation works | Evidence commands (evidence-commands.js) — `registerEvidenceCommands()` still not called; passive (client-supplied data) | | |
| `export_format_har` / `export_format_warc` — **FIXED**: `NetworkAnalysisManager.getLogs()` added (manager.js:395); harness-verified valid HAR 1.0 (34 entries) + WARC/1.0 (34 records, 11 KB) | interaction-recorder.js (~45 KB) — real code, wiring/test still rough | | |
| **Live recording subsystem PRESERVED & wired** — `RecordingManager` (recording/manager.js) + `registerRecordingCommands` (server.js:11745) live; `src/recording/video-{encoder,player,storage}.js` retained | | | |

**Outdated claims:** "14 evidence WS commands / 85 tests" — the *evidence-packaging* API is still Phase-29 removed, but the **v12.9.0 forensic/compression 14-command set is now registered and reachable** (was orphaned in the prior draft). "export_format_warc broken by getLogs bug" — **fixed** (getLogs implemented, HAR/WARC harness-green). The recording subsystem is **live**, not a deletable stub.

---

## 5. mcp-server — NOW EXISTS AND VERIFIED

| Proven-Working ✓ | Developed-but-Unproven ? | Planned-not-Built ○ | Started-Incomplete ◐ |
| --- | --- | --- | --- |
| **`mcp/server.py` — real FastMCP 2.1.2 server, 17 tools, live-verified** (`mcp/verify_e2e.py` exit 0 through the full `call_tool → pydantic → WS bridge → browser` path) | (none) | Broader `browser_*` tool coverage beyond the proven 17 — intentionally deferred until each underlying command is proven live | `docs/rag-app/app/mcp_server.py` — the unrelated RAG-docs FastMCP server; still on disk, out-of-scope, not the browser adapter |
| The 17 tools: `navigate, get_url, get_content, get_page_state, execute_script, screenshot, scroll, wait_for_element, click, fill, type_text, set_cookie, get_all_cookies, get_cookies, extract_links, extract_forms, extract_images` | | The fictional ~46-tool catalog — **deliberately not built**; 17 honest tools over proven commands instead | |
| WS bridge: single connection, `asyncio.Lock` (one command in flight), id-correlation with an id-less-frame edge case, reconnect-and-retry-once | | | |
| `mcp/requirements.txt` (`fastmcp==2.1.2`, `websockets`), `mcp/README.md` (17-tool table), `mcp/verify_e2e.py` | | | |

**Outdated claims (retired):** "no `mcp/server.py` on disk / agents cannot talk MCP" — **resolved**; the server exists, exposes 17 tools, and is verified. "MCP: 164 tools needs refactoring" (MEMORY) — there was never a 164-tool MCP; the honest server has 17. Point Claude Desktop / palletai at `python3 mcp/server.py` (env `BASSET_WS_HOST`/`BASSET_WS_PORT`).

---

## 6. proxy-tor-network

| Proven-Working ✓ | Developed-but-Unproven ? | Planned-not-Built ○ | Started-Incomplete ◐ |
| --- | --- | --- | --- |
| Single-proxy set/clear/status + validation on `defaultSession` (webview shares it); proxy-manager.test.js 75/76 | Proxy **actually routing** live webview traffic end-to-end — architecturally plausible, still not verified vs a real proxy | Proxy-pool subsystem (5 strategies, health, 26 cmds) — files MISSING; migrated to basset-hound-networking | (proxy-handler.js / residential-proxy-manager.js orphans were **pruned** this session) |
| Request/ad blocking (webRequest onBeforeRequest cancel); ad-blocker.test.js 28/28 (mocked) | Tor connect (proxy/tor.js) — connects to an existing external Tor daemon; does not spawn tor; tor-manager.test.js flaky | Proxy Intelligence cmds (register_proxy/get_best_proxy) — 0 registered | exit-node-cache.js orphan — **pruned** |
| Network-analysis request capture (webRequest hooks); network-analysis-manager.test.js 22/22 (mocked) | tor-advanced.js daemon spawn/NEWNYM/control-port — partly wired, no live evidence it launches+routes | Dark-web/Tor investigation cmds — out-of-scope per SCOPE.md | |
| Simple proxy-list rotation (sequential/random + interval timer) | Security/PII analysis of captured requests — code present, live quality unverified | Geo matching / adaptive switching / chaining — chaining stubbed | |
| Tor master-switch state machine (off/on/auto, onion detection); wired server.js | **CDP network throttling — now targets the `<webview>`** (throttling.js `_resolveGuestWebContents`); harness-proven (offline preset blocks a same-origin guest fetch). Live effect on arbitrary pages still Electron-gated | | |

**Outdated claims:** "Proxy Pool 890 LOC + 26 cmds, Production-Ready" — files missing. "Full chaining/geo/adaptive ✅" — chaining stubbed; only Tor ON/OFF/AUTO real. **Corrected this session:** network throttling no longer targets the shell (was the same shell-vs-webview bug class; now retargeted to the guest webview).

---

## 7. v12.9.0-features (compression, forensics, export; orchestration removed)

| Proven-Working ✓ | Developed-but-Unproven ? | Planned-not-Built ○ | Started-Incomplete ◐ |
| --- | --- | --- | --- |
| Adaptive compression engine (gzip/brotli/deflate, entropy selection) — 25/25 feature + 7/7 integration tests; **now REGISTERED & reachable** (5 commands wired via `registerV12_9_0Commands`); brotli 4000→32 bytes live | Collaboration API (SessionLockManager/EventStream/MessageQueue/ConflictDetector) — **still BROKEN**: 11+/85 fail (real logic bugs); not wired | Multi-Agent Orchestration (Feature 2) — REMOVED for scope violation; code deleted | (v12.9.0 wiring is no longer orphaned — this column emptied for compression/forensics) |
| Forensic analyzer — 25/25 pass; **now REGISTERED** (8 commands wired); SHA-256 determinism verified | Evasion handler (evasion-handler.js) — outside this subsystem's scope; evasion deferred | zstd compression — listed in docs, not implemented (gzip/brotli/deflate only) | |
| Export handler — export path repaired at the manager level (getLogs) so HAR/WARC exporters work | | | |

**Outdated claims:** "Feature 2 Orchestration PRODUCTION READY" — removed. "0 of 23 commands registered" (prior draft) — **corrected**: the 14 compression+forensic commands are now registered and reachable; only the collaboration set remains unwired and buggy. Real green module suites: compression(25)+forensics(25)=50; collaboration still ~73/85.

---

## 8. session-profile-cookie-storage

| Proven-Working ✓ | Developed-but-Unproven ? | Planned-not-Built ○ | Started-Incomplete ◐ |
| --- | --- | --- | --- |
| `set_cookie` / `set_cookies` (defaultSession) — smoke | Session management (create/switch/delete_session) — partitions created but switch is a **no-op** (renderer never swaps partition) | v12.7.0 `snapshot_session/restore_session/list_snapshots` (8 cmds) — 0 registered; different 6-cmd set exists | Session isolation renderer bridge — server emits `session-changed`, renderer has no listener |
| `get_all_cookies` — smoke (count 17) | Cookie jar system (create/switch/analyze jars) — registered; cookie-manager.test.js RED (jest infra); no e2e | 5-layer coherence + `validate_session/clone_session` — 0 registered | `src/sessions/` extra modules (recovery, sandbox, offline-queue) — scaffolding |
| **`get_cookies` URL-filtered — FIXED & proven** (was shadowed by a forensic double-registration; session handler now preserved and forensic variant exposed as `get_cookies_network`); smoke + mcp (count 8, includes just-set cookie) | Profile management (create/switch/delete_profile) — wired, Electron-only; tests RED | 70-90% session compression — not the current focus | |
| **`set_local_storage` → `get_local_storage` — FIXED & proven** (renderer consumer added at renderer.js:687; was a 30s hang); smoke round-trips exact value. sessionStorage/IndexedDB share the now-live bridge | Download management (`get_downloads`, will-download hook) — wired, unverified with a real download | | |
| **`save_session_state` → `restore_session_state` — FIXED & proven** (retargeted to guest webContents; bad import + `stateCapture` ReferenceError fixed); smoke round-trips (validateFirst path OK) | | | |
| Tab management (create/list/switch/close/active) — tab-manager.test.js 67/67 | | | |
| History CRUD (add/get/search/stats) — direct run correct, IPC chain wired | | | |

**Outdated claims:** "localStorage/IndexedDB fully functional" was previously FALSE (dead IPC bridge) — **now FIXED** (renderer consumer wired, round-trip proven). "get_cookies works" — **now genuinely proven** (double-registration shadow fixed). Session save/restore capture previously read the shell — **now retargeted to the guest webview and proven**.

---

## 9. headless-and-launch

| Proven-Working ✓ | Developed-but-Unproven ? | Planned-not-Built ○ | Started-Incomplete ◐ |
| --- | --- | --- | --- |
| **Headless launch** `npm run start:headless` — live boot, WS up in ~3s, boot.log confirms init | Offscreen-rendering frame pipeline — offscreenEnabled true but framesRendered stays 0; real screenshots use `mainWindowDirect`. Effectively non-functional | GUI-vs-headless mode selection (BASSET_MODE, windowFactory) — v13.0.0 target | Offscreen scaffolding — paint listener present but yields 0 frames |
| HeadlessManager wired into launch path (early init, offscreen config, cleanup) | Xvfb virtual-display path — not exercised (host has DISPLAY); matters only in Docker | Headless-first <2s startup / <50MB idle — not implemented | `get_headless_status` reports `headless:false` under `--headless` (early-init path skips arg parse) — misleading label, genuinely enabled |
| Headless status/control cmds (get_headless_status/render_stats/presets/apply_preset) — live round-trip | `set_frame_rate`/`reset_render_stats` — registered, depend on the 0-frame offscreen pipeline | Standalone web admin dashboard — no code | |
| Driving a real page headless (navigate/wait/screenshot → PNG via `mainWindowDirect`) — smoke | | | |
| **`smoke:mvp` self-boots headless on an isolated ephemeral WS port, reaps its process group, temp under `/home/devel/bhb-*`** — 14/14 GREEN, verified repeatably | | | |
| HeadlessManager unit suite 66/72 | | | |

**Outdated claims:** "Electron not headless-compatible / requires GUI" — FALSE, boots+drives headless (proven by smoke + mcp). "screenshot_viewport works via offscreen" — works via `mainWindowDirect`; offscreen renders 0 frames.

---

## Cross-cutting truths (apply everywhere)

- **Shell-vs-webview bug class — LARGELY FIXED.** The recurring defect (targeting `mainWindow.webContents` / a dead IPC bridge instead of the guest `<webview>`) was closed across `extract_*`, storage ops, session-state capture/restore, CDP network throttling, `export_raw_html`, and technology detection via a shared `getWebviewPageContent()` helper + a renderer storage consumer. This single fix pattern unlocked several subsystems at once. Remaining shell-targeted paths are the exception now, not the rule.
- **"Registered vs written" gap — narrowed.** The v12.9.0 compression+forensic commands (previously orphaned) are now **registered and reachable** (`registerV12_9_0Commands` is called). Still-orphaned: the collaboration API and evidence-packaging commands. "Tests pass" still ≠ "reachable" for those — verify registration before trusting a green module suite.
- **Security posture — HARDENED (local-agent model).** Default loopback bind, SSRF guard with DNS-rebinding defense on all navigate paths, PathValidator on file I/O. Auth is **deliberately OFF** to preserve the open local-agent flow; do not assume network-facing safety. New env knobs: `BASSET_WS_BIND`, `BASSET_WS_ALLOW_PRIVATE_NETWORK`, `BASSET_WS_ALLOW_FILE`, `BASSET_ALLOWED_WRITE_DIRS`, `WS_BIND`. Deferred hardening (documented, not done): `execute_script` sandbox (H-4), unauth `/metrics`|`/api/*` (M-1), dead command-authorizer (M-2), Origin check (M-3), constant-time token compare (L-1).
- **Dead code — PRUNED (78 files).** `src/evasion/` emptied; v12.9.0 export/evasion orphans, proxy orphans (proxy-handler, residential-proxy-manager, exit-node-cache), dead recording/session files, and mock MCP tests removed; companion tests removed. 3 fingerprinting refs preserved-by-move to `docs/research/bot-detection/salvage/`. Boot-safety gates all GREEN post-prune (start:headless, smoke:mvp 14/14, verify_e2e exit 0). The **live** recording subsystem (7 files + registered commands) was preserved.
- **Reproducible proof exists now.** Two harnesses replace the non-reproducible Jest counts: `npm run smoke:mvp` (14/14, self-contained) and `python3 mcp/verify_e2e.py` (exit 0, full MCP path). Prefer these over doc-quoted "100%" numbers.
- **Test-evidence caveat (still true).** Many Jest suites self-skip in CI or fail to load under Node 18 (cheerio/undici `File is not defined`), or are mock-only. Trust the two live harnesses and dedicated per-fix isolated-Electron runs over stale green counts.
- **Monolith reality (still true).** `websocket/server.js` ≈ 12,090 lines, `src/main/main.js` ≈ 3,059 lines. "Modularized" refactor claims remain aspirational.

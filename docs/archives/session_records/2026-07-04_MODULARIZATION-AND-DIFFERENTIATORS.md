# Session Record — Modularization & Differentiators (2026-07-04)

**Session:** `session-finish-verify` (orchestrated, work-zone-isolated agent teams)
**Scope:** finish the core — modularize the monoliths, prove the real differentiators, make the
docs honest, and set the next phase. **NO git commits** (operator policy — everything below is
UNCOMMITTED in the working tree).
**Authoritative status:** `docs/planning/PROJECT-STATUS-MATRIX.md` (refreshed this session).

---

## 0. Final authoritative verification (this convergence pass)

Run on the fully-settled tree (all modularization + fixes landed), with isolated/temp resources
and full process-group reaping — no strays, no leftover temp dirs.

| Gate | Command | Result |
|------|---------|--------|
| MVP smoke | `npm run smoke:mvp` | ✅ **15/15 PASS**, exit 0 |
| MCP end-to-end | `python3 mcp/verify_e2e.py` (vs live headless browser) | ✅ **exit 0**, all 7 tool checks pass through the real FastMCP dispatch path |

Smoke covers: navigate, get_url, get_content, screenshot, local-storage round-trip,
save/restore session state, fill, click, detect_technologies (jQuery+Bootstrap),
extract_links (count tracks live `document.links.length`, 462 in-window), URL-scoped cookies,
export_raw_html (real page HTML, 475KB), and `forensic_capture` (13-file bundle + `page.html`
SHA-256 determinism verified). MCP verify additionally proves `forensic_capture` through the MCP
adapter writes a sealed on-disk bundle whose `bundle_sha256` matches the manifest (13 files,
`disk_seal_matches: true`, `challenge_suspected: false`).

Hygiene: browser booted on distinct ports (smoke = OS-assigned ephemeral; MCP verify = 8791),
own process group, throwaway `--user-data-dir`, `ELECTRON_RUN_AS_NODE` deleted; reaped SIGTERM→
SIGKILL. Post-run: no stray Electron, ports free, all `/home/devel/bhb-mcpverify-*` /
`/tmp/bhb_fc_verify_*` temp removed.

---

## 1. Modularization — every code file >1200 lines split to <1200

The file-size mandate (no source file >1200 lines) was executed per
`docs/planning/MODULARIZATION-PLAN-2026-07-04.md` in boot-safety-gated parallel waves. **`smoke:mvp`
stayed 15/15 throughout**, and each split preserved behavior by strict relocation + a
barrel/`ctx`-passing pattern (never a rewrite).

| File | Before | After | Preservation proof |
|------|-------:|------:|--------------------|
| `websocket/server.js` | **12,096** | **1,110** | **904 unique commands** (934 total incl. last-writer-wins dups) — registration order **byte-identical** to baseline after every phase; `this`→`server` rewrite via acorn AST (never touched `this` inside page-injected template strings) |
| `src/main/main.js` | **3,112** | **1,178** | **194 IPC channels** register identically (0 dup, channel-set diff IDENTICAL); side-effect boot order preserved; live managers shared via getters over module-scope `let` bindings |
| `renderer/renderer.js` | **1,527** | **587** | one `DOMContentLoaded` IIFE → 3 `setup(ctx)` modules (IPC/screenshots/downloads); GUI verified rendering live on `DISPLAY=:1` |
| `proxy/*` (2 oversized files) | — | largest **952** | thin barrel + modules; `bin/tor` path depth re-adjusted |
| `extraction/manager.js` | **1,555** | barrel **12** + modules | class keeps one-line delegating wrappers; `this`→`self` in moved bodies |
| `config/schema.js` | **1,482** | per-section modules (largest **258**) | boot-critical shape preserved byte-for-byte |
| `evasion/fingerprint-profile.js` | **1,278** | barrel + 4 modules (largest **450**) | — |
| `image-metadata` extractor | — | largest **509** | — |
| `recording/interaction-recorder.js` | **1,727** | barrel + dir | 4 classes + codegen split |
| `network-forensics/forensics.js` | **1,270** | modules (<1200) | — |
| `monitoring/page-monitor.js` | **1,497** | modules (largest **869**) | ipcMain listener stays in `monitor.js` |

*(config/schema and technology/fingerprints families included; the one remaining >1200-line file in
the tree is `archives/test-artifacts-2026-06-20/...interaction-recorder.js` — a frozen archive
snapshot, not live source.)*

**server.js extraction shape:** S0 shared helpers → `websocket/core/` (url-guards, timing, retry,
state-management); a linchpin barrel `core/handler-deps.js` re-exporting 103 module-scope symbols so
relocated command closures resolve module scope identically (singletons stay same instance via Node
module cache); 489 inline handlers peeled into `commands/core-cmds-NN.js` + `core-tor-commands.js`
(tor kept its method-local closure); 5 prototype mixins via `Object.assign` (transport, dispatch,
ratelimit, heartbeat, startup). The ~47 pre-existing `register*Commands(this)` calls left in place.

---

## 2. Differentiators — proven live (this is why we are not a Selenium/Chrome clone)

Raw automation (navigate/click/fill/screenshot/execute-JS) is table stakes shared with
Selenium/Puppeteer/Playwright — all drive the same Chromium/Blink/V8. The differentiation is the
layers on top, and each was proven against real endpoints (no mocks):

**A. Built-in Tor + proxy anonymity — PROVEN.**
Real host IP `72.35.121.85` → `tor_enable{9050}` → ipify exit `192.42.116.94`, and
`check.torproject.org/api/ip` → `{"IsTor":true}` (independent confirmation traffic is on the Tor
network) → `tor_disable` → back to real IP. `set_proxy{socks5}` changes the exit IP; the **strongest
proof**: a **dead proxy port breaks connectivity** (empty/failed load) instead of leaking the real
IP — i.e. traffic genuinely routes *through* the proxy, not around it. A facade proxy would have
leaked. `session.defaultSession.setProxy` + `closeAllConnections()` + `resolveProxy()` verify the
rule took; the browsing `<webview>` has no `partition`, so it inherits `defaultSession` — that
linkage is the crux and it holds. Selenium/ChromeDriver ship no Tor and need an external wrapper to
change IP at all; the DOM shows no `cdc_*`/`__webdriver_`/`__selenium_` tells. **No `proxy/*` code
change was needed — routing was already correctly wired** (this was verification).
*(Honest limit: dynamic `tor_enable` does not add `.onion` resolution — needs `TOR_MODE=1` at
launch; clearnet-through-Tor works fine without it.)*

**B. UA-leak / coherent-identity fix — the #1 stealth-breaker, FIXED + PROVEN.**
Before: the browsed page advertised `Electron/39.8.10` + `basset-hound-browser/12.8.0` on both
`navigator.userAgent` (JS) and the wire, and `navigator.platform` disagreed with the UA OS — an
instant self-identification signal. Root cause: same shell-vs-webview class — UA was set on the
shell webContents, never the guest. Fix: a clean Chrome UA is propagated to the guest via
`session.defaultSession.setUserAgent` + `app.userAgentFallback` + retroactive per-guest
`setUserAgent`, and the injected `navigator.platform` is derived from that UA (memoized per UA).
After (live vs `httpbin.org/headers`, 10/10 assertions): JS UA === wire UA === clean
`Chrome/120…` (zero Electron/basset tokens), `platform` coherent (MacIntel⇔"Mac OS X"), and runtime
`set_user_agent` now reaches the guest (Chrome/123 update reflected on JS + wire). `smoke:mvp`
15/15; `user-agent-rotation.test.js` 26/26.

**C. One-call `forensic_capture` evidence bundle — now MCP tool #18 (18 tools total).**
A deterministic server-side macro: `start_network_capture` FIRST (fixes the empty-HAR trap) →
navigate → settle → get_url → export_raw_html → screenshot → cookies → storage (local/session/
IndexedDB) → page_state + detect_technologies + extract links/images/forms → in-memory HAR 1.0.
Emits a **13-file bundle** with a `manifest.json` (per-file SHA-256 + a `bundle_sha256` tamper
seal) + `chain_of_custody.json`, all writes through a PathValidator honoring
`BASSET_ALLOWED_WRITE_DIRS`. **Challenge DETECTION not bypass** (precise signals: 401/403/429/503,
`/sorry/` + `/cdn-cgi/challenge` redirects, interstitial phrases / widget markers; bare
`captcha`/`/sorry/` substrings deliberately excluded so real HTTP-200 Google SERPs don't
false-alarm — unit-tested 6/6). Proven on the operator's real example
(`google.com/search?q=department+of+state+news`): 13 files, 71 HAR entries, status 200,
`challenge_suspected:false`, hash determinism confirmed, PathValidator rejects out-of-allowlist
`output_dir`. A 19-line stdlib Python client drives it.

**D. Watch-automation-in-GUI + headless-screenshot-from-memory — both proven.**
GUI: real on-screen window on `DISPLAY=:1` (`[GUI] GUI mode enabled — showing browser window`),
navigate→type→click→fill→scroll all fired with 5 live-DOM read-backs + 3 screenshots. Headless:
`screenshot` returned a true 1361×660 PNG (16.7KB, 1080 distinct colors, 898,260 non-white pixels)
off `webContents.capturePage()` reading the offscreen compositor buffer — **a visible window is
never required** to reconstruct an image from memory.

---

## 3. Fixes that made the middle of the command surface actually work

Several registered commands were **silently broken** (worse than absent) and were fixed + live-proven
this session:

- **shell-vs-webview bug class (5 instances)** — storage ops (renderer had NO consumer for
  `execute-storage-operation` → 30s hang; added consumer routed to `getActiveWebview()`),
  `save/restore_session_state` (shell target + a broken class import made the class `undefined`),
  CDP network throttling (debugger attached to shell — throttled nothing), `export_raw_html`, and
  `detect_technologies`/`identify_cms`/`identify_analytics` — all retargeted to the guest webContents.
- **extract_* family + get_cookies** — extract_* read the empty shell doc (routed through
  `getWebviewPageContent()`); a lossy `ResponseTemplate.fill()` serializer dropped `id`/payload
  (now `serialize(..., null)` full-serializes); `get_cookies{url}` was silently overridden by a
  forensic network-capture handler ignoring `url` (session handler preserved + restored;
  forensic variant kept as `get_cookies_network`).
- **HAR/WARC export** — every `export_format_*` called `networkAnalysisManager.getLogs()` which
  **did not exist** (TypeError). Added an array-returning `getLogs()` alias over the same tracker;
  proven to emit valid HAR 1.0 (34 real entries, request+response each) + WARC.
- **v12.9.0 forensic + compression (14 commands)** — `registerV12_9_0Commands()` was never called,
  and the handlers used the wrong `(message, browserState)` signature. Wired the call + fixed 14
  handler signatures; SHA-256 determinism confirmed byte-for-byte (real hashing, not stub).
- **ErrorFormatter `id:null` envelope** — response envelope reordered to `{ ...response, id, command }`
  so validation errors stay client-correlatable (single chokepoint fix at both send paths).
- **MCP `verify_e2e.py` extract_links flakiness** — switched to the smoke harness's bounded-window
  (before/after DOM count) pattern; now green on consecutive runs.

## 4. Prune + security + docs

- **78 dead files pruned** (evasion simulators `src/evasion/*` = 33, unregistered handlers,
  v12.9.0 orphans, dead recording/session, mock MCP tests, companion evasion tests); 3
  fingerprinting refs PRESERVED to `docs/research/bot-detection/salvage/`. 0 restored (all
  boot-safety gates stayed green). Live recording subsystem + registered v12.9.0 code untouched.
- **Security hardened** — loopback bind, SSRF guard on navigate/navigate_tab/navigate_window,
  PathValidator wired into screenshots/cookies managers (audit: 1 critical + 4 high closed; auth
  deliberately OFF for the trusted-localhost control surface).
- **Docs** — `docs/planning/DIFFERENTIATION-VS-SELENIUM-2026-07-04.md` (authoritative strategy:
  "raw automation is table stakes; the layers are the moat"); folder INDEXes + findings/planning
  indexes filled out; `PROJECT-STATUS-MATRIX.md` refreshed to true end state (Proven-Working
  ~35→~70; MCP section rewritten from "(none)" to proven).

---

## 5. KEY DISCOVERY (drives the next phase)

**The server registers ~904 unique commands, but only ~70 are PROVEN working.** The large middle is
**unverified** — and this session showed several of those middle commands were silently broken until
fixed (extract_*, get_cookies, HAR/WARC, session save/restore, storage, throttling, v12.9.0,
export_raw_html, tech-detect). "Registered" ≠ "works." The true remaining risk is the un-audited gap
between 70 proven and 904 registered.

Known still-imperfect (noted, deferred): `identify_cms`/`identify_analytics` category-filter field
mismatch (`categories` vs `category`); `restore_session_state` `validateFirst` references an
undefined `stateCapture` (blocks e2e restore, not capture); `export_format_har` returns stats-only
(no `data`) without an `output_path`; WebGL null / `hardwareConcurrency` real in `--disable-gpu`
headless; evasion injects on `did-stop-loading` (after page scripts — "fires too late").

---

## 6. THE PLAN — next steps

- **Phase 1 — Command-surface verification & repair (top priority).** Inventory all 904 registered
  commands → auto-test each against a live browser → classify **works / broken / stub / dead** → fix
  the broken, delete/flag the dead → produce a true "all tools working" map. This turns the ~70-proven
  / 904-registered gap into a known quantity.
- **Phase 2 — Onboarding self-test.** A `run_self_test` command/harness a consumer can call once to
  confirm the browser + its working tool set are healthy.
- **Phase 3 — Wire-capture / evasion timing.** HAR response bodies; move evasion injection to run
  *before* page scripts (webview preload, not `did-stop-loading`); normalize passive fingerprint
  surfaces.
- **Phase 4 — palletai MCP integration.** Wire the 18-tool MCP adapter into palletai agents as the
  real consumer.
- **DEFERRED (explicit):** HAR response bodies, evasion inject-timing, MCP remote read-back;
  Collaboration API (still broken → fix + wire); dynamic `.onion` routing; `.onion` reachability proof.

---

## 7. Decisions, blockers, state

- **Decisions:** modularize by strict relocation + barrel/`ctx` (never rewrite); differentiation =
  anonymity + forensic capture + MCP, NOT raw automation; challenge = detect-not-bypass; evasion
  simulators pruned as dead (deferred research, not shipped).
- **Blockers (pre-existing, not regressions):** node18 `cheerio`→`undici` `require` quirk (references
  a `File` global that exists only ≥ node20 — a `globalThis.File` shim is used for the require-gate;
  real Electron boot has it, so `start:headless` is the authoritative resolution check). eslint
  `curly`/`prefer-const` debt (~28 in server.js, identical in the original — pure relocation, not new).
- **State:** everything UNCOMMITTED (operator policy — no commits). Line counts current on disk:
  server.js 1,110 · main.js 1,178 · renderer.js 587. MCP: 18 `@mcp.tool()`.

**Detail sources:** `docs/findings/*-2026-07-04.md` (MODULARIZE-server/main/renderer/proxy/
extraction-manager/config-schema/fingerprint-profile/image-metadata/interaction-recorder/
network-forensics/page-monitor, PRIVACY-ANONYMITY-VERIFICATION, UA-LEAK-COHERENT-IDENTITY-FIX,
FORENSIC-CAPTURE-COMMAND, FORENSIC-REGISTRATION, WATCH-AUTOMATION-SCREENSHOT, GUI-TOGGLE,
BROKEN-COMMANDS-FIX, EXPORT-HAR-FIX, SHELL-VS-WEBVIEW-FIX, PRUNE-EXECUTION, SECURITY-HARDENING,
SECURITY-AUDIT-CONTROL-SURFACE, FINAL-CONSOLIDATION) and
`docs/planning/DIFFERENTIATION-VS-SELENIUM-2026-07-04.md`.

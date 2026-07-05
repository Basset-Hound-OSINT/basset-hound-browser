---
title: "Bot-Detection Posture — Master Gap Analysis (Basset Hound Browser)"
date: 2026-07-03
researcher: "Bot-Detection Research (cross-surface synthesis, Claude Opus 4.8)"
status: Complete
category: bot-detection
surface: master-gap-analysis
kind: synthesis
sources:
  - tls-http2-fingerprinting.md
  - canvas-webgl-audio.md
  - navigator-device-apis.md
  - automation-cdp-electron-artifacts.md
  - behavioral-biometrics.md
  - cross-layer-coherence.md
  - network-ip-proxy-webrtc.md
  - challenge-captcha-systems.md
---

# Bot-Detection Posture — Master Gap Analysis

> **The operator's question:** *"What is preventing us from automating freely and
> getting blocked as a bot, and how do we fix it?"*
>
> **The one-line answer:** We are blocked because our identity is **incoherent by
> default and evasion is not actually wired into the pages we browse** — the real
> Linux/Electron/Chromium-142 host leaks through on the wire (TLS JA4), in the HTTP
> User-Agent (`Electron/39.2.7`), and in the raw browser surface (canvas/WebGL/audio/
> UA-Client-Hints), while every spoof we *do* ship fires **after** the detector has
> already read the truth. The elaborate evasion modules are imported only by tests.

---

## 1. Executive answer

### 1.1 The governing rule: weakest-signal-wins

A modern anti-bot stack (Cloudflare, DataDome, HUMAN/PerimeterX, Akamai) does **not**
average your signals. It takes the **maximum** confidence across all of them. Your
classification is decided by your **single worst tell**, not your best 163 spoofs.

That means:

- The "164 WebSocket commands" and "85–90% evasion effectiveness" numbers in our own
  docs are **false confidence** — every one of those percentages is a hardcoded
  constant or the output of a `Math.random()` simulator run against fake `.test`
  endpoints (verified in all 8 surface audits). None reflects a live detector.
- Perfect mouse physics does not matter if `event.isTrusted === false`.
- A flawless canvas hash does not matter if the page injected it **after** the
  detector already read the real one.
- A perfectly rotated Chrome-120 User-Agent does not matter if the TLS ClientHello on
  the same socket is unmistakably Chromium-142 — that mismatch blocks you **before a
  single line of page JS runs**.

**Corollary for prioritization:** fixes must be applied **in request-lifecycle order**
(wire → transport headers → document-start page surface → interaction). Fixing a later
stage while an earlier stage still leaks buys nothing, because the earlier signal
already lost the request.

### 1.2 Where each blocker fires in the request lifecycle

| Stage | When | Blocker present today | Detector reads |
|---|---|---|---|
| **0. TCP/TLS handshake** | before any HTTP | Real Chromium-142 JA4 + `X25519MLKEM768` PQ key share vs a UA claiming Chrome 118–131 | JA4-vs-UA mismatch |
| **1. First HTTP request** | before any JS | Guest `<webview>` UA is never overridden → `Electron/39.2.7` + `basset-hound-browser` in the UA header; UA-CH headers say Linux/Chromium | one-rule block |
| **2. Page load / document-start** | before page detector script | Nothing spoofed here — our injection waits for `did-stop-loading` | raw canvas/WebGL/audio, raw `navigator`, `userAgentData` = Linux |
| **3. First interaction** | on click/keypress | 100% of synthetic events are `isTrusted === false` | instant bot flag |
| **4. Side channels** | anytime | WebRTC STUN leaks the real public IP past the proxy; tz/locale not bound to exit IP | de-anonymization + geo mismatch |
| **5. Challenge** | on interstitial | No solve path; challenge HTML is silently returned as "page content" | capture corruption |

### 1.3 The 3–5 things MOST LIKELY blocking us TODAY (ranked)

Ranked by *(fires earliest × detector confidence × present-by-default × breadth of sites)*:

1. **Electron User-Agent leaks from the guest `<webview>`** *(automation-cdp)* —
   `setUserAgent` runs only on the shell `webContents` (`main.js:793`), not the guest
   `<webview>` that actually loads the target, and `navigator.userAgent` is never
   patched on that surface. Every request advertises `Electron/39.2.7` and the app name
   `basset-hound-browser`. This is a literal one-rule block on the **first HTTP request**,
   on **every site**, before any JS. **This is almost certainly our #1 blocker.**

2. **TLS JA4 vs User-Agent mismatch (and the whole TLS layer is inert)** *(tls-http2,
   cross-layer)* — Electron emits Chromium-142's real ClientHello, including the
   post-quantum `X25519MLKEM768` key share that a Chrome-120 UA physically cannot send.
   A JA4→UA lookup mismatches **before JS runs**. Our seven `tls-*.js` modules that
   "fix" this touch no socket — they are instantiated only from `tests/`. Fires on every
   HTTPS request that reaches a fingerprinting CDN.

3. **The real browser surface is unspoofed by default AND injected too late**
   *(canvas-webgl-audio, navigator-device-apis)* — the only auto-injected script is a
   navigator-only stub with **zero** canvas/WebGL/audio/font hooks, and it runs on
   `did-stop-loading` (`renderer/renderer.js:409`) **after** the page has already
   fingerprinted. Detectors read the genuine Linux/Electron canvas, WebGL renderer
   (Mesa, not the claimed NVIDIA D3D11), audio hash, and — the single highest-confidence
   2026 flag — `navigator.userAgentData` / `Sec-CH-UA` reporting `platform:"Linux"` and
   the Chromium brand while our UA header and `navigator.platform` claim Chrome-on-Win32.
   A self-contradiction on **every page**.

4. **Every synthetic interaction is `isTrusted === false`** *(behavioral-biometrics)* —
   all mouse/keyboard/scroll input is dispatched in page JS via `element.dispatchEvent`,
   never through Electron's trusted `webContents.sendInputEvent` or CDP `Input.*`.
   DataDome/HUMAN/Cloudflare read `event.isTrusted` in the capture phase and flag 100%
   of clicks and keystrokes. Blocks **any site that requires interaction** (including
   clicking a Turnstile checkbox), no matter how good the trajectory math is.

5. **WebRTC STUN leaks the real public IP straight past the proxy** *(network-ip-proxy-webrtc)* —
   no `webRTCIPHandlingPolicy` is set, `RTCPeerConnection` is unpatched, and the module
   that claims to fix this is dead code. A single STUN request from any page reveals the
   host's real public IP, de-anonymizing the session regardless of a working proxy.

**Runner-up (guaranteed block on one vendor family):** our own tracker block-list blocks
the PerimeterX `_px` sensor endpoint, so the PX sensor payload never posts — which PX
treats as a bot *by definition* = guaranteed hard block on every PX/HUMAN-protected site
*(challenge-captcha)*.

---

## 2. Prioritized remediation roadmap

Ordered by **blocking-impact ÷ effort**. Tags: **Quick-Win** (hours–1 day, high impact),
**Medium** (days, structural), **Hard** (week+, deep architectural).

> **Scope guardrail (hard boundary — `docs/architecture/SCOPE.md §0 BLACKLIST`):** every
> fix below keeps the browser a **deterministic, model-free capture/control tool**.
> Evasion logic, deterministic physics, and CAPTCHA *strategy* are in scope. **No internal
> AI agents, no LLM/inference/embeddings, no model SDKs** (`anthropic`/`openai`/etc.) in
> browser source. Where a CAPTCHA *solver* is needed, it is called as an **external**
> service through the existing WebSocket/HTTP API — never embedded as an in-process model.

| # | Fix | Impact | Effort | Surface doc | Module(s) to change |
|---|-----|--------|--------|-------------|---------------------|
| R1 | **Override the guest `<webview>` User-Agent** to a coherent Chrome-on-real-platform string; strip `Electron`/`basset-hound-browser`; patch `navigator.userAgent` on the guest surface too | Kills the #1 pre-JS one-rule block | **Quick-Win** | automation-cdp | `src/main/main.js` (webview `webContents`/`webPreferences`), `windows/manager.js`, `src/preload/preload.js` |
| R2 | **Un-block the PerimeterX `_px` sensor endpoint** in the tracker filter list so the sensor can POST | Turns a guaranteed PX/HUMAN hard-block into a possible pass | **Quick-Win** | challenge-captcha | request-interception / tracker block-list (`src/main` filters) |
| R3 | **Set `webRTCIPHandlingPolicy = disable_non_proxied_udp`** at the Chromium/session level; patch `RTCPeerConnection` in the injected script | Closes the real-IP STUN leak past the proxy | **Quick-Win** (policy) → Medium (full patch) | network-ip-proxy-webrtc | `src/main/main.js` (session/webContents), `src/preload/preload.js`, `src/evasion/webrtc-evasion.js` (wire the dead module) |
| R4 | **Stop returning challenge/interstitial HTML as captured content** — detect the "Just a moment…"/challenge signature and return a typed `challenge_detected` status instead of silently corrupting the capture | Ends silent data-corruption of forensic captures | **Quick-Win** | challenge-captcha | `websocket/server.js:2952-2959` |
| R5 | **Correct default-lie field values:** `navigator.webdriver` → `false` (not `undefined`/deleted); plugins → frozen 5-item PDF set, remove Native Client; keystroke `keyCode` → VK codes (65–90) not `charCodeAt`; cap `deviceMemory` ≤ 8 | Removes several deterministic tells that fire even under perfect timing | **Quick-Win** | navigator, automation-cdp, behavioral | `src/preload/preload.js`, `evasion/fingerprint.js`, `input/keyboard.js` |
| R6 | **Move evasion injection to document-start in an isolated world** via a real `<webview>` preload, replacing the `did-stop-loading` `executeJavaScript` path | **Highest-leverage structural fix** — makes *every* page-level spoof (R7, R8) actually run before the page's detectors | **Medium** | canvas-webgl-audio, navigator, automation-cdp | `renderer/renderer.js:409`, `src/preload/preload.js`, `src/main/main.js` (webview preload wiring) |
| R7 | **Wire the dead canvas/WebGL/audio/font modules into the injection path**, with session-stable (non-mutating) canvas noise, a WebGL vendor+renderer **pair** matched to the claimed platform, `OfflineAudioContext`+`DynamicsCompressor`+`getChannelData` hooks, and `measureText`/`document.fonts` overrides | Replaces the true Linux/Electron surface a detector currently reads | **Medium** | canvas-webgl-audio | `src/evasion/fingerprint.js` + the six audited `src/evasion/*` modules, consumed from `src/preload/preload.js` |
| R8 | **Inject UA Client Hints spoofing:** override `navigator.userAgentData.getHighEntropyValues()` and the `Sec-CH-UA` / `Sec-CH-UA-Platform` / `Sec-CH-UA-Mobile` request headers to match the claimed UA; brand list **must include `"Google Chrome"`** | Removes the single highest-confidence 2026 mismatch (Linux/Chromium leak) | **Medium** | navigator, automation-cdp | `src/preload/preload.js`, session header-modification in `src/main/main.js`, `src/evasion/vendor-detection-evasion.js` |
| R9 | **Route synthetic input through a trusted channel** — replace `element.dispatchEvent` with `webContents.sendInputEvent` (or CDP `Input.dispatchMouseEvent`/`dispatchKeyEvent`); feed the existing Fitts/minimum-jerk physics into that channel; emit `PointerEvent`s with pressure/`pointerType` | Makes `isTrusted === true` so the physics layer finally counts | **Medium** | behavioral-biometrics | `input/mouse.js`, `input/keyboard.js`, `evasion/behavioral-ai.js`, `evasion-commands.js`, `src/main/main.js` |
| R10 | **Bind timezone + Accept-Language + geolocation to the proxy exit IP** — derive tz/locale/geo from the exit IP and set them coherently (timezone emulation, `Accept-Language` header, geolocation spoofer) | Removes the geo-vs-timezone/language mismatch on every non-US proxy | **Medium** | cross-layer, network | `src/evasion/geolocation-spoofer.js`, `proxy/manager.js`, `src/main/main.js` |
| R11 | **Adopt the real Chromium version as the claimed identity** (Obscura fix): stop spoofing the UA down to Chrome 118–123/131 and instead advertise the browser's *actual* Chromium-142 identity across UA, UA-CH, and JS — so the unspoofable JA4 already matches, with no wire-level rewriting | Eliminates the JA4-vs-UA mismatch (blocker #2) cheaply, by making the truth coherent instead of faking the wire | **Medium** | tls-http2, cross-layer | `utils/user-agents.js`, `src/evasion/tls-fingerprinting.js` (as the source-of-truth version), `src/preload/preload.js` |
| R12 | **De-randomize deterministic surfaces** — remove per-request shuffling of TLS extensions/ciphers/pseudo-headers and per-call canvas mutation; real Chrome is byte-stable, so *variance itself is the bot signal* and JA4 normalizes the shuffle away | Stops us manufacturing an anomaly on stable surfaces | **Medium** (mostly deletion) | tls-http2, canvas, cross-layer | `src/evasion/tls-*.js`, canvas-noise code |
| R13 | **Fix the wrong hardcoded TLS constants** — pseudo-header order to `m,a,s,p` (not `a,m,s,p`), correct the JA4 `c`-hash (`02713d6af862`, not `e5627efa2ab1`), remove the fictional `0x0034`/`0x0033` PQC extension IDs, dedupe ciphers, drop fake GREASE `0x1200` | Makes the model factually correct (prereq for R14) | **Quick-Win** (but low value until R14) | tls-http2 | `src/evasion/tls-fingerprinting.js:86,118`, extension table |
| R14 | **Wire-level TLS/H2 fingerprint control** — for cases R11 cannot cover (e.g. must claim a *different* browser than the engine), front target traffic through a TLS-terminating proxy that rewrites the ClientHello (uTLS-style); and ensure Node side-channel clients (shodan/censys/maltego/tor/webhook over `https`/`http2`) never present an OpenSSL JA3 to a target/CDN | Real fix for the deepest layer when identity-alignment (R11) is insufficient | **Hard** | tls-http2, cross-layer, network | `src/proxy/*`, integration clients, `src/darkweb/tor-investigation.js` |
| R15 | **Replace temporal self-consistency with same-moment cross-signal coherence validation** — a pre-flight validator that checks JA4↔UA, CH-UA↔UA↔platform, tz↔IP, H2-SETTINGS↔browser *agree at one moment*, instead of "did one signal change since last request" | Catches incoherent identities before they hit the wire; encodes the Obscura lesson | **Medium–Hard** | cross-layer | `src/evasion/coherence-validators.js`, `session-coherence.js`, `coherence-manager.js` |
| R16 | **CAPTCHA solve/bypass path** — wire an **external** solver service (2captcha-style or operator-in-the-loop) through the WebSocket/HTTP API to fill the response token; harden the fingerprint at challenge time (depends on R6–R11) so managed challenges self-clear | Turns guaranteed time-outs into possible passes on interactive challenges | **Hard** | challenge-captcha | `websocket/server.js` (token-injection command), `src/cloudflare/detector.js` (retire dead Playwright `addInitScript`) |

**Recommended execution order (respecting weakest-signal-wins):**
Sprint 1 (Quick-Wins) → R1, R2, R3, R4, R5, R13.
Sprint 2 (unlock page-level evasion) → R6 first, then R7, R8, R9.
Sprint 3 (coherence) → R11, R10, R12, R15.
Sprint 4 (deep) → R14, R16.

> **Why R6 is the pivot:** every page-level fix (R7 canvas/WebGL/audio, R8 UA-CH, part of
> R3 WebRTC) is **cosmetic until R6 lands**, because they currently execute after the page
> has already fingerprinted. Do R6 before investing in R7/R8.

---

## 3. Coherence completeness (the Obscura identity-coherence lesson)

**Obscura's lesson:** a synthetic identity is only as believable as its *least coherent
pair of signals*. Detection is a **cross-signal correlation** problem, not a per-signal
one — you must pick **one** identity and make **every** layer agree with it at the **same
moment**, rather than randomizing each layer independently (which is exactly what produces
"impossible devices": a Win32 platform on a Linux GPU with 32 GB reported by a Chrome that
caps at 8).

Basset Hound's coherence layer checks the wrong thing: it validates **temporal
self-consistency** ("did signal X change between request N and N+1?"), never **same-moment
pairwise agreement**. So essentially every meaningful pair is unguarded.

| Cross-signal pair | Guarded today? | Reality |
|---|---|---|
| TLS **JA4 ↔ User-Agent** (the top 2026 signal) | ❌ Unguarded | Neither shaped on the wire nor validated; real Chromium-142 JA4 vs spoofed old-Chrome UA |
| **HTTP/2 SETTINGS / pseudo-header order / JA4H ↔ claimed browser** | ❌ Unguarded | Coordinator pushes hardcoded checkmark strings; unwired |
| **Sec-CH-UA / `userAgentData` ↔ UA ↔ `navigator.platform`** | ❌ Unguarded | Not injected at all; real Linux/Chromium leaks |
| **`platform` ↔ UA ↔ `deviceMemory` ↔ `hardwareConcurrency`** | ❌ Unguarded | Independent random draws → impossible devices (deviceMemory 16/32) |
| **WebGL vendor ↔ WebGL renderer ↔ platform** | ❌ Unguarded | Picked from independent random arrays → self-contradictory GPU |
| **Canvas / audio / font surface ↔ claimed platform** | ❌ Unguarded | Host Linux surface leaks vs claimed Win32 |
| **Timezone ↔ Accept-Language ↔ exit IP (geo)** | ❌ Unguarded | Default `America/New_York`, no IP linkage |
| **WebRTC IP ↔ proxy exit IP** | ❌ Unguarded | STUN leaks the real public IP |
| **`isTrusted` ↔ every interaction** | ❌ Broken | 100% synthetic → `false` |
| **JA3 ↔ previous JA3 (temporal)** | ⚠️ The *only* thing "validated" | And it's the **wrong invariant** — JA3 is deprecated, false-positives on real Chrome's post-110 extension shuffle, and misses the JA4-vs-UA mismatch entirely |

**Net:** 0 of the ~9 load-bearing same-moment pairs are validated; the one active check is
both temporal and wrong. R15 (a real pairwise validator) plus R11 (align the claimed
identity to the true engine) together encode the Obscura fix: **one coherent identity,
validated across signals at a single moment.**

---

## 4. Surface-doc index

All eight per-surface audits are source-verified against the current codebase. "Verify"
is the independent verifier's confidence in that audit's claims.

| # | Surface | Verify | Top leak (one line) | Doc |
|---|---------|--------|---------------------|-----|
| 1 | **TLS / HTTP-2 fingerprinting** | SOLID | Chromium-142 JA4 + PQ key share vs spoofed old-Chrome UA blocks pre-JS; whole TLS layer is test-only | [`tls-http2-fingerprinting.md`](./tls-http2-fingerprinting.md) |
| 2 | **Canvas / WebGL / Audio / Fonts** | SOLID | No canvas/WebGL/audio/font spoofing by default; the navigator stub fires post-load; real Linux surface leaks vs claimed Win32/NVIDIA | [`canvas-webgl-audio.md`](./canvas-webgl-audio.md) |
| 3 | **navigator.* & Device APIs** | SOLID | No UA-Client-Hints spoofing anywhere; `userAgentData` leaks Linux/Chromium — the highest-confidence 2026 mismatch | [`navigator-device-apis.md`](./navigator-device-apis.md) |
| 4 | **Automation / CDP / Electron artifacts** | MAJOR_ISSUES | Guest `<webview>` UA never overridden → `Electron/39.2.7` + app name in UA header on first request | [`automation-cdp-electron-artifacts.md`](./automation-cdp-electron-artifacts.md) |
| 5 | **Behavioral biometrics** | MINOR_ISSUES | Every injected event is `isTrusted === false` (page-JS `dispatchEvent`, never `sendInputEvent`/CDP) | [`behavioral-biometrics.md`](./behavioral-biometrics.md) |
| 6 | **Cross-layer coherence** | MINOR_ISSUES | JA4-vs-UA never shaped or validated; the coherence layer only checks temporal JA3 self-consistency | [`cross-layer-coherence.md`](./cross-layer-coherence.md) |
| 7 | **Network / IP / Proxy / WebRTC** | SOLID | WebRTC STUN exposes the real public IP past the proxy; evasion module is dead code | [`network-ip-proxy-webrtc.md`](./network-ip-proxy-webrtc.md) |
| 8 | **Challenge & CAPTCHA systems** | MINOR_ISSUES | No solve path; interstitial HTML silently returned as page content; PX sensor endpoint self-blocked | [`challenge-captcha-systems.md`](./challenge-captcha-systems.md) |

---

## 5. Reading the "effectiveness" numbers in this codebase

Every "82–95% effective" / "85–90% evasion" figure in the source and older docs is one of:
(a) a hardcoded constant returned by a module that patches no browser API, or (b) the
output of a `Math.random()` simulator scored against fake `.test` endpoints. Treat all of
them as **0% until validated against a live detector.** The fixes above are ordered so that
the earliest, highest-confidence, present-by-default leaks are closed first — because under
weakest-signal-wins, that is the only ordering that moves the block rate.

---

*Synthesis of 8 source-verified surface audits. Start here, then drill into the surface doc
for any fix you pick up. All remediation stays within `docs/architecture/SCOPE.md` — the
browser remains a deterministic, model-free capture/control tool.*

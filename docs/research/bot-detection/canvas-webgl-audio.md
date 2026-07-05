---
title: "Bot-Detection Surface Audit: Canvas / WebGL / AudioContext / Fonts"
date: 2026-07-03
researcher: Claude (bot-detection capability audit)
status: Complete
category: bot-detection
---

# Canvas / WebGL / AudioContext / Font Fingerprinting — Surface Audit

> Scope: how modern (2024–2026) bot-detection stacks fingerprint the canvas / WebGL /
> AudioContext / font surface, what Basset Hound Browser actually ships against it, and
> where the gaps are. Brutally honest: a wrong "we're covered" is worse than a flagged gap.

## TL;DR (the one-paragraph version)

Basset Hound's canvas/WebGL/audio/font evasion is, in practice, **not wired into the
pages it browses**. The only script auto-injected into a navigated page is a hardcoded
navigator stub (`src/preload/preload.js:896`) that spoofs `webdriver`, `plugins`,
`languages`, `platform`, and `window.chrome` — and contains **zero** canvas, WebGL, audio,
or font hooks. The richer `evasion/fingerprint.js` script (which *does* patch canvas/WebGL/
audio) is only handed out over IPC/WebSocket on request and is never injected on page load.
The six modules this audit was asked to review — `src/evasion/canvas-fingerprinting-v2.js`,
`canvas-evasion.js`, `webgl-evasion.js`, `webgl-detection-v2.js`, `audio-context-evasion.js`,
`font-enumeration-evasion.js` — are **dead code**: they patch no browser API and are never
instantiated anywhere in the production path. A real detector therefore reads the true,
unmodified canvas + WebGL + audio hashes of a Linux/Electron host while other layers claim
Win32 + NVIDIA — an instant, high-confidence block.

---

## (a) How detectors fingerprint this surface in 2026

### Canvas (2D)
Detectors (Cloudflare Turnstile/Bot Management, DataDome, HUMAN/PerimeterX, Akamai, plus the
open reference implementations fingerprint.js and CreepJS) draw a fixed test payload —
mixed-font text, emoji, gradients, `globalCompositeOperation` blends — then read it back with
`toDataURL()` / `getImageData()` and hash the pixels. The hash encodes GPU rasterizer +
driver + OS text renderer (ClearType vs CoreText vs FreeType) + anti-aliasing. Two things
matter far more than the raw hash:

1. **Stability.** A real device returns the *same* canvas hash on every read, every reload,
   for the life of the profile. CreepJS explicitly reports **"Canvas data unstable"** when a
   re-read produces a different hash — that instability *is* the anti-fingerprinting tell.
   Rendering the same scene twice must be bit-identical; if it isn't, noise injection is
   present ([CreepJS], [Scrapfly CreepJS]).
2. **Consistency with the claimed device.** Uniform, structured, or single-channel noise is
   detectable and often *reversible* (a constant XOR/offset can be normalized away). Detectors
   also cross-check the canvas against the claimed OS/GPU: a "Windows" UA whose text
   rasterization matches FreeType is a lie.

### WebGL
Two independent signals:
- **Reported strings / parameters.** `UNMASKED_VENDOR_WEBGL` (0x9245 = 37445) and
  `UNMASKED_RENDERER_WEBGL` (0x9246 = 37446) via `WEBGL_debug_renderer_info`, plus
  `getParameter` limits (MAX_TEXTURE_SIZE, precision formats, aliased ranges),
  `getSupportedExtensions()`, and shader precision. Modern Chrome on Windows returns ANGLE/D3D11
  strings like `ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 (0x00002484) Direct3D11 vs_5_0 ps_5_0, D3D11)`.
- **The rendered image.** Detectors draw a 3D scene and hash `readPixels()`. This is produced
  by the **real** GPU/rasterizer regardless of what strings you report. **Spoofing the strings
  while leaving the render real is a mismatch** a detector catches by comparing claimed GPU
  class to actual rendering characteristics ([BotBrowser WebGL], [ZenRows WebGL]).
- **Tamper detection.** `gl.getParameter.toString()` must return
  `"function getParameter() { [native code] }"`; monkey-patches that fail this, or Proxies that
  leak, are flagged.

### AudioContext
The canonical vector (fingerprint.js, used inside DataDome/HUMAN/Kasada suites) is **not**
`AnalyserNode` on a realtime context. It is: create an **`OfflineAudioContext`**, generate a
~10 kHz triangle/​sine wave with an `OscillatorNode`, route it through a **`DynamicsCompressorNode`**
(whose non-linear transform amplifies hardware-specific float differences), `startRendering()`,
then read the resulting `AudioBuffer` via `getChannelData()` and sum/hash it. Differences appear
at the 15th–16th decimal and are stable per machine — up to ~99.6% identifying accuracy
([fingerprint.com audio], [Sendwin audio], [DataDome audio]). Per-call random noise here is a
tell for the same reason as canvas: the value must be **stable per session**.

### Fonts
Detectors measure `measureText()` widths / element `offsetWidth` for a probe string across a
font list (comparing against generic fallbacks), and/or use `document.fonts.check()` and the
FontFaceSet API. The installed-font set must be consistent with the claimed OS — a "Win32"
navigator that only resolves DejaVu/Liberation (Linux) fonts is an OS lie CreepJS surfaces.

### The meta-signal: "lies"
CreepJS and the commercial stacks weight **internal contradictions** heavily: UA says macOS but
fonts/GPU say Windows; platform says Win32 but WebGL renderer is Mesa/llvmpipe; canvas hash
changes per read. High-entropy, self-contradictory, or unstable signals score as bot/anti-detect,
independent of any single hash value ([CreepJS], [DataDome CreepJS]).

---

## (b) What Basset Hound actually does — with citations

### The real injection path (what runs in a browsed page)
1. `<webview>` tags are created in `renderer/renderer.js:88-93` with
   `webpreferences='contextIsolation=no, nodeIntegration=no'` and **no `preload=` attribute**.
2. On the **`did-stop-loading`** event, `renderer/renderer.js:409` calls
   `injectEvasionScript(webview)` → `webview.executeJavaScript(evasionScript)`
   (`renderer/renderer.js:486-489`).
3. `evasionScript` is populated once at init from
   `window.evasionHelpers.getWebviewEvasionScript()` (`renderer/renderer.js:33-34`).
4. That function is defined in `src/preload/preload.js:894-965` and returns a **hardcoded
   string** that overrides only: `navigator.webdriver`, `navigator.plugins`,
   `navigator.languages` (hardcoded `['en-US','en']`), `navigator.platform` (hardcoded
   `'Win32'`), `permissions.query`, `window.chrome`, and deletes automation props. **It contains
   no canvas, WebGL, audio, or font code whatsoever.**

Consequences:
- **Timing.** Injection fires on `did-stop-loading` — *after* the page and all its inline/first-
  party scripts (including the detector's) have executed. There is no
  `addScriptToEvaluateOnNewDocument`, `session.setPreloads`, or document-start hook anywhere in
  the repo (grep for those returns nothing). The detector reads the surface before evasion runs.
- **Coverage.** Even discounting timing, the injected stub does nothing for this audit's surface.

### The "real" canvas/WebGL/audio script — present but not injected
`evasion/fingerprint.js` `getEvasionScript()` (`evasion/fingerprint.js:105`) *does* patch the
surface, but it is only returned via the IPC handler `get-evasion-script`
(`src/main/main.js:1473`) / WebSocket / `electronAPI.getEvasionScript()`. **No renderer code
injects it on navigation** — `windows/manager.js` imports it (line 9) but only uses
`getRandomViewport`/`getRealisticUserAgent` (lines 227-228). So by default it never runs in a page.
Even when it does run, its implementation is weak:

- **Canvas** (`evasion/fingerprint.js:284-313`): overrides `toDataURL`/`toBlob` and applies
  `imageData.data[i] ^= ${Math.floor(Math.random() * 5)}`. The random value is baked into the
  script string **once at generation time**, so it is a **constant** for the session; it XORs
  **only the red channel** (`data[i]`, every 4th byte) of every pixel. Range 0–4 means ~20% of
  sessions get `0` = **no-op** (canvas untouched). Worse, it `putImageData`s back into the live
  canvas as a **side effect of reading it**, so repeated `toDataURL()` calls flip `R^c` / back →
  **hash changes per call** → the exact "Canvas data unstable" lie CreepJS looks for.
  (The `getEvasionScriptWithConfig` variant, `evasion/fingerprint.js:431/613/628`, has the same
  single-channel constant XOR, and defaults to `Math.floor(Math.random()*5)` — also 0-capable.)
  Note `getCanvasNoise()` (line 98) and its `canvasNoise` local (line 112) are **dead** in the
  non-config path.
- **WebGL** (`evasion/fingerprint.js:255-280`): correctly targets the *unmasked* params
  37445/37446 (better than the v2 module). But `webglVendor` and `webglRenderer` are drawn from
  **two independent arrays with independent random indices** (`:110-111`,
  `WEBGL_VENDORS` `:70-74`, `WEBGL_RENDERERS` `:62-68`), so a session can report vendor
  `Google Inc. (AMD)` with an NVIDIA renderer (~2/3 of combinations mismatch). Only the strings
  are changed — **`readPixels()` / the actual WebGL render is untouched**, so the real GPU's
  rasterization leaks and contradicts the claimed string. The chosen renderer is also independent
  of the randomly chosen `navigator.platform` (`:106`, `:131`) and UA. Uses a `Proxy` on
  `getParameter` (toString mostly survives, but it is still a monkey-patch of a shared prototype).
- **Audio** (`evasion/fingerprint.js:317-329`): wraps only realtime
  `AudioContext.prototype.createAnalyser().getFloatFrequencyData` and adds
  `(Math.random()-0.5)*0.1` **per call** (unstable). The dominant vector —
  `OfflineAudioContext` + `OscillatorNode` + `DynamicsCompressorNode` → `startRendering` →
  `AudioBuffer.getChannelData` — is **never touched**. `webkitAudioContext` and
  `OfflineAudioContext` constructors are not patched.
- **Fonts** (`evasion/fingerprint.js:331-337`): declares a `commonFonts` array and **uses it for
  nothing**. No `measureText` / `offsetWidth` / `document.fonts` override. Font enumeration is
  fully unmitigated.

### The six audited `src/evasion/*` modules — dead / non-functional
Grep for instantiation across `src/`, `websocket/`, `evasion/` (excluding tests) finds **zero**
`new CanvasFingerprintingV2 / WebGLDetectionV2 / AudioContextEvasion / CanvasEvasion / WebGLEvasion
/ FontEnumerationEvasion`, and `createSpoofedContext` is only *defined*, never called. They are
listed in `src/evasion/preloader.js:36-63`, but that preloader only `require()`s them in the Node
main process to "warm V8 JIT" — it never runs them against a page. What each actually contains:

- `src/evasion/canvas-fingerprinting-v2.js`: `generateAdvancedFingerprint()` (`:335`) creates a
  **brand-new throwaway `<canvas>`**, draws decorative gradients/glyphs, and returns a data URL.
  It **does not override** `toDataURL`/`getImageData`/`getContext`, so it has no effect on a
  detector's own canvas. `sessionSeed = Math.random()` (`:24`); several device choices use raw
  `Math.random()` (`:36`, `:41-48`, `:63`) so they are not even stable. `getStatus()` reports a
  self-declared **"82-90%"** (`:396`) with no measurement behind it.
- `src/evasion/canvas-evasion.js`: `apply(canvas, context)` (`:264`) mutates a caller-supplied
  context; nothing in production calls it. Platform profiles use per-call `Math.random()`
  (`:134-137`, `:189`, `:207`) → unstable if it ever ran.
- `src/evasion/webgl-evasion.js`: `apply(context)` (`:181`) **returns a plain descriptor object**;
  it never installs a `getParameter` override on a real context. `selectRandomGPUProfile()`
  (`:90`) is random per instance and independent of every other surface. Renderer strings
  (`:23`, `:37`) use the dated `ANGLE (NVIDIA GeForce GTX 1080)` form — missing the modern
  `(vendor, … Direct3D11 vs_5_0 ps_5_0, D3D11)` suffix — a stale-format tell.
- `src/evasion/webgl-detection-v2.js`: has a genuine `createSpoofedContext()` (`:303`) that
  overrides `getParameter`/`getSupportedExtensions`/`getExtension`, **but it is never called**,
  and it only handles VENDOR/RENDERER (0x1F00/0x1F01 — the generic "WebGL"/"WebKit" strings),
  **not** the unmasked 37445/37446 that detectors actually read. `getShaderVersion()` returns
  ES 1.0 even for desktop WebGL2 (`:195`) and randomizes per-call for tablet (`:190`).
  Self-declares **"85-95%"** (`:407`).
- `src/evasion/audio-context-evasion.js`: every method **returns a descriptor object**; it never
  patches `OfflineAudioContext`/`AnalyserNode`/`AudioBuffer`. It reports impossible values —
  `frequencyBinCount: Math.round(256 * (1 + seed*0.1))` = 256–281 (`:82`), but `frequencyBinCount`
  is read-only and always a power of two — and uses per-call `Math.random()` for detune/envelope/
  compressor (`:109-114`, `:141-142`).
- `src/evasion/font-enumeration-evasion.js`: returns font *lists*; patches no measurement API.

---

## (c) Gaps, ranked by severity

| # | Severity | Gap | Evidence |
|---|----------|-----|----------|
| 1 | **CRITICAL** | No canvas/WebGL/audio/font spoofing is injected into browsed pages at all by default. The auto-injected script is a navigator-only stub; a detector reads the true, unmodified surface of a Linux/Electron host. | `src/preload/preload.js:896-965` (stub, no canvas/GL/audio); `renderer/renderer.js:33,489` |
| 2 | **CRITICAL** | Injection is post-load (`did-stop-loading`) with no document-start hook, so even the stub — and any richer script — runs *after* the detector has already fingerprinted. | `renderer/renderer.js:409`; no `addScriptToEvaluateOnNewDocument`/`setPreloads` in repo; `<webview>` has no `preload=` (`renderer/renderer.js:88-92`) |
| 3 | **HIGH** | The six audited `src/evasion/*` modules patch no browser API and are never instantiated in production (dead code); their "82–95%" effectiveness numbers are self-declared constants. | grep: zero `new *Evasion`/`createSpoofedContext` calls; `webgl-detection-v2.js:303,407`, `canvas-fingerprinting-v2.js:335,396`, `webgl-evasion.js:181`, `audio-context-evasion.js:82` |
| 4 | **HIGH** | Canvas noise (in the on-request `fingerprint.js` script) is a session-constant XOR on a single channel that can be a full no-op, and it mutates the canvas on read → per-call unstable hash = CreepJS "Canvas data unstable". | `evasion/fingerprint.js:284-313`, `:431/613/628` |
| 5 | **HIGH** | WebGL vendor and renderer are chosen from independent random arrays (self-contradictory GPU), and only the strings are spoofed while `readPixels()`/the real render leaks — a claimed-vs-rendered mismatch. Also inconsistent with the randomly chosen platform/UA. | `evasion/fingerprint.js:62-74,110-111,255-280`; `webgl-detection-v2.js` handles wrong params (0x1F00/1F01 not 37445/37446) at `:321-323` |
| 6 | **HIGH** | Audio: the dominant `OfflineAudioContext`+`DynamicsCompressor`+`getChannelData` vector is completely untouched; only realtime `createAnalyser` is wrapped, with per-call random noise (unstable). Fonts: no `measureText`/`document.fonts` override at all, so host (Linux) fonts leak and contradict the spoofed Win32 platform. | `evasion/fingerprint.js:317-329` (audio), `:331-337` (fonts, `commonFonts` unused) |

---

## (d) Concrete remediation recommendations

**Priority 0 — make evasion actually run, at the right time.**
1. Inject at **document-start**, before page scripts. For `<webview>` give it a dedicated
   `preload=` script whose top-level body installs the API hooks synchronously, or drive pages
   through the main process with
   `webContents.debugger` → `Page.addScriptToEvaluateOnNewDocument` (CDP) / `session.setPreloads`.
   Remove the `did-stop-loading` → `executeJavaScript` path (`renderer/renderer.js:409`); it is
   structurally too late.
2. Route the **real** fingerprint script into that document-start hook — consolidate on a single
   source of truth and delete the navigator-only stub in `src/preload/preload.js:896-965`, or
   merge the canvas/WebGL/audio/font hooks into it.

**Priority 1 — fix the canvas model.**
3. Replace the single-channel constant XOR with a **seeded, deterministic, per-profile** pixel
   perturbation keyed off a stable profile seed (not `Math.random()` at generation time), applied
   across all channels at ≤1–2 LSB, and computed **without writing back to the live canvas** (build
   a copy; never `putImageData` into the element being read). Guarantee identical output for
   identical input within a session so re-reads are bit-stable (kills "Canvas data unstable").
   Never allow a `0` no-op path.

**Priority 2 — fix WebGL.**
4. Pin **vendor+renderer as a matched pair** from a single device profile, consistent with
   `navigator.platform`, UA, and the audio/font OS. Use modern ANGLE/D3D11 string formats.
5. If you must alter the WebGL image, perturb `readPixels()` deterministically and identically to
   the string story, or better: leave the render native and only ship renderer strings that match
   the *actual* host GPU class (don't claim NVIDIA on a Mesa/llvmpipe host). Verify
   `getParameter.toString()` still reports native code after patching.

**Priority 3 — fix audio.**
6. Hook `OfflineAudioContext` (and `webkitOfflineAudioContext`) + `DynamicsCompressorNode` +
   `AudioBuffer.prototype.getChannelData` / `startRendering`, applying a **stable per-session**
   offset (not per-call random). Also patch `AudioContext`/`webkitAudioContext`. The output must be
   reproducible within the profile.

**Priority 4 — fonts + coherence.**
7. Actually override font enumeration: intercept `CanvasRenderingContext2D.measureText`,
   element `offsetWidth/offsetHeight` for measurement probes, and `document.fonts.check()`, exposing
   a font set that matches the claimed OS.
8. Add a **coherence gate** before any navigation: platform ↔ UA ↔ WebGL vendor/renderer ↔ font set
   ↔ timezone/languages must all agree; reject or regenerate contradictory profiles. This is what
   defeats CreepJS's "lies" scoring, which weights contradictions above any single hash.
9. Replace self-declared effectiveness strings with measured results from a harness that renders
   CreepJS / bot.sannysoft / browserleaks / a fingerprint.js probe and diffs hashes across reloads.

---

## The single most likely thing to get us blocked here

**By default the browser injects no canvas/WebGL/audio/font spoofing at all — only a navigator
stub, and even that fires after page load — so a detector reads the genuine canvas + WebGL image +
OfflineAudioContext hashes of a Linux/Electron host while other layers advertise Win32 + an NVIDIA
D3D11 renderer. That real-vs-claimed contradiction (plus, if the on-request script ever is injected,
a per-call-unstable canvas hash) is an instant, high-confidence bot classification.**

---

## Sources
- [CreepJS repo](https://github.com/abrahamjuliot/creepjs)
- [Scrapfly — Browser fingerprinting with CreepJS](https://scrapfly.io/blog/posts/browser-fingerprinting-with-creepjs) ([CreepJS])
- [DataDome — CreepJS](https://datadome.co/anti-detect-tools/creep-js/) ([DataDome CreepJS])
- [fingerprint.com — Audio fingerprinting](https://fingerprint.com/blog/audio-fingerprinting/) ([fingerprint.com audio])
- [Sendwin — AudioContext fingerprinting complete guide (2026)](https://blog.send.win/audio-context-fingerprinting-explained-complete-guide-2026/) ([Sendwin audio])
- [DataDome — Audio fingerprint](https://datadome.co/anti-detect-tools/audio-fingerprint/) ([DataDome audio])
- [BotBrowser — WebGL fingerprinting](https://botbrowser.io/en/blog/webgl-fingerprinting/) ([BotBrowser WebGL])
- [ZenRows — WebGL fingerprinting](https://www.zenrows.com/blog/webgl-fingerprinting) ([ZenRows WebGL])
- [Mozilla bug 1428034 — RFP for WebGL readPixels](https://bugzilla.mozilla.org/show_bug.cgi?id=1428034)

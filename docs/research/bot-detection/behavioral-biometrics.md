---
title: "Behavioral Biometrics Detection Surface — Audit of Basset Hound Browser"
date: 2026-07-03
researcher: "Bot-Detection Capability Research (Claude, Opus 4.8)"
status: Complete
category: bot-detection
surface: behavioral-biometrics
---

# Behavioral Biometrics — Detection Surface Audit

> Scope: mouse-path physics, keystroke dynamics (dwell/flight), scroll momentum,
> event cadence, and — most importantly — whether injected interaction events are
> **trusted** (`isTrusted === true`) or synthetic (`isTrusted === false`).
>
> Verdict up front: **Basset Hound synthesizes 100% of its mouse/keyboard/scroll
> input in page-context JavaScript via `element.dispatchEvent(new MouseEvent/…)`.
> Every such event is `isTrusted === false`.** This single fact defeats the entire
> behavioral-biometrics stack regardless of how good the mouse-curve math is. The
> elaborate physics engine (`evasion/behavioral-ai.js`) is not even wired into the
> real click/type/move commands — it is a JSON data generator with no injection
> sink. See [Gaps](#c-gaps-ranked-by-severity).

---

## (a) How detectors fingerprint this surface in 2026

Modern anti-bot vendors (DataDome, HUMAN/PerimeterX, Cloudflare Bot Management,
Akamai Bot Manager) collect a client-side behavioral telemetry stream via an
obfuscated JS SDK and score it server-side. The signals that matter here:

1. **Event trust (`event.isTrusted`)** — The cheapest and most decisive signal.
   Any event created by `new MouseEvent(...)` / `new KeyboardEvent(...)` and fired
   with `dispatchEvent()` has `isTrusted === false`. Only events originating from
   real user-agent input dispatch (hardware, OS-synthesized, `sendInputEvent`, or
   CDP `Input.*`) carry `isTrusted === true`. Detector SDKs attach listeners in the
   **capture phase** on `document`/`window` and record `isTrusted` on the very
   first `mousedown`/`pointerdown`/`keydown`/`click` that lands on a protected
   element. A single untrusted interaction on a challenge = automated verdict. This
   check cannot be spoofed from page JS — `isTrusted` is a read-only property on the
   native `Event` and cannot be overridden on trusted browsers.

2. **Mouse-path physics** — Trajectory curvature (Bézier / minimum-jerk vs linear),
   velocity profile (bell-shaped accel/decel), micro-tremor (8–12 Hz physiological
   noise), sub-pixel jitter, overshoot-and-correct near targets, and the *density
   and cadence* of `mousemove` samples. Real hardware produces a dense, irregularly
   timed stream (often coalesced — see `PointerEvent.getCoalescedEvents()`); most
   automation produces sparse, evenly spaced points, or no `mousemove` history at
   all before a click.

3. **Keystroke dynamics** — Dwell time (keydown→keyup for the *same* key) and flight
   time (keyup→next keydown), analysed as a *joint distribution* per digraph, plus
   rollover (overlapping key presses where key N+1 goes down before key N comes up).
   2025–2026 systems (Random-Forest/SVM classifiers on dwell/flight; commercial
   "keystroke cadence" products) also fingerprint the *injection signature*: setting
   `input.value` programmatically and then firing an `input` event, `keyCode`/`code`
   inconsistencies, and missing `beforeinput`/composition events.

4. **Scroll momentum & wheel semantics** — Real trackpad/wheel scrolling emits
   trusted `wheel` events with characteristic `deltaMode`, momentum tails, and
   `deltaY` quantisation; the resulting scroll is caused *by* the trusted event, not
   by a separate `window.scrollBy()` call.

5. **Event cadence / interaction-before-action** — Humans move, hover, hesitate,
   then act. Detectors flag "action with no antecedent behavior": a `click` with no
   preceding trusted `pointermove` stream, a form submitted with zero focus/blur/
   selection events, or perfectly periodic inter-event intervals.

6. **PointerEvents & pressure** — Chrome fires `pointerdown/move/up` (with
   `pressure`, `pointerType`, `tiltX/tiltY`, `width/height`, coalesced history)
   *alongside* mouse events. Absence of the pointer stream, or a pointer stream with
   `pressure === 0` on a "mouse" that also reports no buttons, is anomalous.

Sources consulted (2024–2026):
DataDome threat research on automated-browser detection and CDP-method detection;
Cloudflare/Kameleo/BrowserStack Playwright-bypass write-ups noting mouse/keystroke/
scroll telemetry and CDP `Runtime.enable` detection; arXiv 2312.10273 (mouse-
trajectory similarity), arXiv 2605.01247 (FP-Agent: fingerprinting AI browsing
agents), 2025 keystroke-dynamics bot-detection papers (dwell/flight/rollover
features), and the W3C Pointer Events L3 spec (`pressure`, `getCoalescedEvents`).
Where a claim rests on general knowledge rather than a fetched page it is stated as
such; the `isTrusted` mechanics are browser-standard behavior, not vendor-specific.

---

## (b) What Basset Hound currently does — with file citations

### The real injection path (what the WebSocket commands actually run)

The production interaction commands are wired in `websocket/server.js`:

- `mouse_move` → `mouse.getMouseMoveScript(x, y, …)` — `websocket/server.js:6289`
- `mouse_click` → `mouse.getMouseClickScript(x, y, …)` — `websocket/server.js:6328`
- `key_press` → `keyboard.getFullKeyPressScript(key, …)` — `websocket/server.js:6127`
- `type_text` → `keyboard.getTypeTextScript(text, …)` — `websocket/server.js:6214`

Each of these returns a **JavaScript source string** that is shipped to the page and
executed there:

`server.js` → `ipcWithTimeout(..., 'execute-in-webview', script)` (`server.js:6296`)
→ `ipcMain.handle('execute-in-webview', …)` (`src/main/main.js:1267`)
→ renderer `onExecuteInWebview` handler (`src/preload/preload.js:198–201`)
→ `webview.executeJavaScript(script)` in guest page context.

Inside those scripts, **every** interaction is a synthetic DOM event:

- `input/mouse.js:313–326` — `new MouseEvent('mousemove', …)` then
  `target.dispatchEvent(event)`.
- `input/mouse.js:403–449` — `mousedown` / `mouseup` / `click` / `dblclick` /
  `contextmenu` all via `target.dispatchEvent(...)`.
- `input/mouse.js:794–804` — scroll dispatches `new WheelEvent('wheel', …)` and then
  separately calls `window.scrollBy(...)` / `scrollableTarget.scrollBy(...)`.
- `input/keyboard.js:712–763` (`typeChar`) — `keydown` / `keypress` / `input` /
  `keyup` via `dispatchEvent`, with `target.value` mutated directly at
  `keyboard.js:741`.
- `evasion/humanize.js:212–231` (`getMouseMoveScript`),
  `humanize.js:308–354` (`getClickScript`), `humanize.js:362–416` (`getTypeScript`)
  — the same `dispatchEvent` pattern.

**Consequence:** every mouse, key, and wheel event Basset Hound injects has
`isTrusted === false`. There is no code path that produces a trusted event.

### There is no trusted-input channel anywhere

- `webContents.sendInputEvent(...)` — Electron's trusted OS-level input API — is
  **never called in production code**. The only occurrence in the whole tree is the
  Jest mock `tests/__mocks__/electron.js`. (Grep: zero non-test hits.)
- CDP `Input.dispatchMouseEvent` / `Input.dispatchKeyEvent` / `Input.insertText` —
  **never used**. The only matches are documentation files describing a *separate*
  "Obscura" tool (`docs/research/obscura/…`), not this codebase.
- The only CDP attach in the code is for **network throttling**, not input:
  `network/throttling.js:116` `this.webContents.debugger.attach('1.3')` then
  `Network.enable` / `Network.emulateNetworkConditions` (`throttling.js:121,174,200`).
- No `isTrusted` handling / patching exists (the single grep hit,
  `tests/__mocks__/electron.js:711 isTrustedAccessibilityClient`, is an unrelated
  macOS accessibility mock).

### The "advanced behavioral AI" is not connected to injection

`evasion/behavioral-ai.js` implements genuinely reasonable physics:
- Fitts's-law movement time — `behavioral-ai.js:186–193`
- Minimum-jerk trajectory (`10τ³−15τ⁴+6τ⁵`) — `behavioral-ai.js:203–223`
- 8–12 Hz physiological tremor — `behavioral-ai.js:231–248`
- Micro-corrections / overshoot — `behavioral-ai.js:257–320`
- Biometric typing (digraph speedup, hand-alternation, cognitive pauses, typo+
  backspace) — `behavioral-ai.js:499–642`

But its only consumer, `websocket/commands/evasion-commands.js`, **generates the
points and returns them as JSON to the WebSocket caller** — it never injects them:
- `evasion-commands.js:794–807` — builds `MouseMovementAI`, calls `generatePath()`,
  returns `path: path.points` to the client.
- `evasion-commands.js:862–865` — builds `TypingAI`, returns `generateTypingEvents()`.

Likewise `src/evasion/behavioral-simulator.js` (Bézier paths, jerkiness) is consumed
by `websocket/handlers/behavioral-simulator-handler.js`, which only returns
`pointsGenerated: result.path.length` (`behavioral-simulator-handler.js:106–130,
138–160`). **Nothing takes these trajectories and drives an actual event stream.**

So the real `mouse_click`/`mouse_move` path uses the *simpler* Bézier generator in
`input/mouse.js` (uniform-ish `stepDelay`, `getMouseMoveScript`), **not** the
Fitts/minimum-jerk/tremor engine. The sophisticated module is decorative.

### The timing/micro-timing modules are self-scoring, not defensive

- `src/evasion/behavioral-micro-timing.js` produces dwell/flight/pressure **numbers**
  from Box-Muller draws (`behavioral-micro-timing.js:98–241`), and its
  `analyzeTimingPatterns()` (`:275–344`) scores *its own generated data* — a
  self-grading loop with no relation to what a real detector sees. `pressure`
  (`:116–118`) is computed but never attached to any dispatched event (no
  PointerEvent is ever emitted). It is not imported by the real input path.
- `src/evasion/timing-randomization.js` is about *request* pacing
  (`getRequestDelay`, `_addThinkingTime`, `detectSuspiciousPattern` at
  `timing-randomization.js:35–68,103–106,209–242`) — network cadence, not
  input-event biometrics.
- `evasion/behavioral-ai-optimizer.js` is a CPU cache (Fitts lookup table, trajectory
  memoization) for the unused physics engine — no security relevance, and memoized
  trajectories would actually *reduce* variance if they were used.

### Coordinates only — the OS cursor never moves

Because injection is `document.elementFromPoint(x,y).dispatchEvent(...)`
(`input/mouse.js:325`, `:369`), the real pointer never moves. `document.hasFocus()`,
`:hover` state, native hit-testing, and any hardware-correlated pointer signal remain
inconsistent with the claimed coordinates.

---

## (c) Gaps ranked by severity

### 1. CRITICAL — 100% of injected events are `isTrusted === false`
Every `mousedown/mouseup/click/keydown/keyup/wheel` is created with
`new …Event()` + `dispatchEvent` (`input/mouse.js:403–449`,
`input/keyboard.js:712–763`, `evasion/humanize.js:308–416`). DataDome / HUMAN /
Cloudflare / Akamai read `event.isTrusted` in the capture phase; the first untrusted
interaction on a protected element is an instant bot verdict. **This one gap voids
every other behavioral effort in the repo.** Not spoofable from page JS.

### 2. CRITICAL — No trusted-input capability exists at all
There is no `sendInputEvent` and no CDP `Input.*` anywhere in production
(only `tests/__mocks__/electron.js`). Even a perfect trajectory has nowhere trusted
to be injected. Fixing Gap 1 requires *building* this channel, not tuning parameters.

### 3. HIGH — The physics engine is never used on the real input path
`evasion/behavioral-ai.js` (Fitts, minimum-jerk, tremor) and
`src/evasion/behavioral-simulator.js` are pure data generators returned over the wire
(`evasion-commands.js:805,865`; `behavioral-simulator-handler.js:129`). The actual
`mouse_move`/`mouse_click` commands use the simpler `input/mouse.js` Bézier with
near-uniform step delays. So even the *trajectory-realism* claim is not delivered
where it matters. A detector doing curvature/velocity analysis sees the mediocre path,
not the good one.

### 4. HIGH — Wrong `keyCode` on every letter keystroke
`input/keyboard.js:197` and the inline `typeChar` at `keyboard.js:715` set
`keyCode: char.charCodeAt(0)`. For lowercase letters this yields **97–122**; real
browsers report the virtual-key code **65–90** (uppercase) regardless of case. Typing
`a` emits `keyCode 97` where hardware emits `65`. This is a deterministic
`key`/`code`/`keyCode` inconsistency that a trivial check catches — independent of
`isTrusted`.

### 5. HIGH — No PointerEvents, no pressure, no coalesced history
The code emits only legacy `MouseEvent`. Chrome always fires
`pointerdown/pointermove/pointerup` with `pressure`, `pointerType`, `tilt`, and a
populated `getCoalescedEvents()`. Their total absence (a "mouse" that never produces
a pointer stream) is anomalous. The `pressure` value computed in
`behavioral-micro-timing.js:116–118` is never attached to anything.

### 6. MEDIUM — Programmatic value-set injection signature + weak timing model
`typeChar` mutates `target.value` directly then fires `input`
(`keyboard.js:741,746`) — a classic scripted-typing signature. Timing is independent
`Math.random()`/Box-Muller per key with no dwell↔flight correlation, no per-key dwell,
and no rollover (overlapping keydowns). `keypress`/`InputEvent` are emitted but with
`isTrusted=false`, so they add surface without adding trust. `contentEditable` typing
uses the deprecated `document.execCommand('insertText')` (`keyboard.js:737`).

### 7. MEDIUM — Scroll is a fake wheel + manual scroll, and clicks can have no cursor history
`input/mouse.js:794–811` dispatches an untrusted `WheelEvent` and *separately* calls
`window.scrollBy(...)` — real scrolling is caused *by* the trusted wheel event, not a
detached script call. `mouse_click` with `moveFirst=false` (`server.js:6331`,
`mouse.js:344`) fires `mousedown/click` with **no preceding `mousemove` stream** —
textbook "action with no antecedent behavior." Momentum decay is hardcoded
(`mouse.js:783`).

### 8. MEDIUM — CDP debugger attached (secondary, but compounding)
`network/throttling.js:116` attaches the Chrome debugger for throttling. CDP presence
is itself a detected signal (the well-documented `Runtime.enable`/CDP-method
detection). It is not the behavioral leak, but it is a second independent flag on the
same session.

### 9. LOW — Weak seeded RNG and self-referential scoring
`BehavioralProfile._createSeededRandom` uses `Math.sin(hash)*10000`
(`behavioral-ai.js:121–132`) — poor statistical quality; low impact only because the
output is never injected. `analyzeTimingPatterns()` grades the tool's own synthetic
data, giving false "LOW detection risk" reports (`behavioral-micro-timing.js:379–390`)
that do not reflect any external detector.

### 10. LOW — Generated-code syntax bug in mouse-move fallback
`input/mouse.js:232` interpolates `${steps || 'Math.max(10, Math.min(50,
Math.floor(distance / 10))'}` — the fallback string is missing a closing paren and
would throw if `steps` were ever falsy (masked today because `steps` defaults to 20).
Code-quality, not detection, but it shows the injected-script layer is under-tested.

---

## (d) Concrete remediation recommendations

**The only fix that matters first (Gaps 1–3): make events trusted.**

1. **Replace page-context `dispatchEvent` injection with Electron
   `webContents.sendInputEvent()`.** This is the correct, trusted channel in an
   Electron app: it produces `isTrusted === true` events, performs real hit-testing,
   moves the render cursor, and updates focus/`:hover`. Concretely:
   - Mouse: `sendInputEvent({type:'mouseMove', x, y, movementX, movementY})` for each
     trajectory sample; `{type:'mouseDown'/'mouseUp', x, y, button, clickCount}` for
     clicks; `{type:'mouseWheel', deltaX, deltaY, x, y}` for scroll.
   - Keyboard: `{type:'keyDown'}`, `{type:'char'}`, `{type:'keyUp'}` with correct
     `keyCode` strings.
   - Feed the **existing** `evasion/behavioral-ai.js` `generatePath().points`
     (Fitts + minimum-jerk + tremor) and `TypingAI.generateTypingEvents()` dwell/
     flight timings into this scheduler. The good physics finally reaches a trusted
     sink, and Gap 3 closes for free.
   - Note the constraint: `sendInputEvent` targets the top-level `webContents`;
     coordinates must be in window space. If a `<webview>`/`BrowserView` guest is
     used, send to the guest's `webContents` so coordinates map correctly.

2. **If OS-cursor movement or richer buttons are needed, drive CDP
   `Input.dispatchMouseEvent`/`Input.dispatchKeyEvent`/`Input.insertText`** — these
   also yield trusted events. But CDP attach is itself detectable (Gap 8), so in
   Electron prefer `sendInputEvent`. Whichever is chosen, delete the
   page-context `dispatchEvent` scripts in `input/mouse.js`, `input/keyboard.js`, and
   `evasion/humanize.js` for real interactions (keep them only for non-adversarial
   automation where trust is irrelevant, clearly labelled).

3. **Emit a real PointerEvent stream (Gap 5)** — once events are trusted via
   `sendInputEvent`, Chromium generates the corresponding `pointer*` events and
   coalesced history automatically; do not hand-roll `PointerEvent` in JS (it would be
   untrusted again). Ensure `pointerType:'mouse'` and non-zero pressure on
   button-down are what Chromium emits by default.

4. **Fix `keyCode` mapping (Gap 4)** — map characters to proper virtual-key codes
   (letters → 65–90 independent of shift/case; digits → 48–57; use a real VK table),
   and set `code` (`KeyA`), `key` (`a`/`A`), and `keyCode` consistently. This matters
   even after switching to `sendInputEvent`, which takes explicit key identifiers.

5. **Wire micro-timing into the scheduler and make it realistic (Gap 6)** — use
   `behavioral-micro-timing.js`/`behavioral-ai.js` dwell/flight to *schedule*
   `keyDown`→`keyUp` gaps; model dwell and flight as a *correlated joint* distribution
   per digraph, add occasional rollover (next `keyDown` before previous `keyUp`), and
   stop mutating `.value` directly (let the trusted `char` event populate the field).

6. **Scroll via trusted wheel only (Gap 7)** — send `mouseWheel` input events and let
   the page scroll as a result; remove the standalone `window.scrollBy`. Emit a
   `mouseMove` stream before every click (make `moveFirst` effectively mandatory for
   evasion contexts).

7. **Reduce CDP footprint (Gap 8)** — gate `network/throttling.js` debugger attach
   behind an explicit flag; do not attach on sessions that must evade behavioral
   detection, or implement throttling without CDP.

8. **Replace self-scoring with an external oracle (Gap 9)** — validate against
   recorded real-human sessions and/or a third-party detector sandbox
   (bot.sannysoft, CreepJS behavioral probes, a DataDome/Cloudflare test property),
   not `analyzeTimingPatterns()` on the tool's own output. Upgrade the seeded RNG to a
   proper PRNG (xorshift/PCG) if determinism is needed.

**Bottom line:** the mouse-curve and keystroke-timing math in this repo is decent, but
it is aimed at the wrong layer. Until interaction events carry `isTrusted === true` —
which in Electron means `webContents.sendInputEvent` (or CDP `Input.*`), never
`dispatchEvent` — behavioral biometrics is a guaranteed block, and the physics engine
is cosmetic.

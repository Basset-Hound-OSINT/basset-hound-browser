---
title: "Bot-Detection Surface Audit: navigator.* & Device APIs"
date: 2026-07-03
researcher: Bot-Detection Research (Claude Opus 4.8)
status: Complete
category: bot-detection
surface: navigator-device-apis
---

# navigator.* & Device APIs — Detection Surface Audit

## Scope

Everything a detector can read from `navigator` and the ancillary device APIs, and
whether those values agree with each other **and** with the transport layer (UA
string, UA Client Hints headers, Accept-Language, TLS/JA4):

`navigator.platform`, `navigator.vendor`, `navigator.userAgent`,
`navigator.hardwareConcurrency`, `navigator.deviceMemory`, `navigator.languages`,
`navigator.plugins` / `navigator.mimeTypes`, `navigator.userAgentData` (+
`getHighEntropyValues`), `navigator.maxTouchPoints`, `navigator.webdriver`, and the
optional device APIs (Battery, Sensors/Generic Sensor, Vibration, Notification,
Bluetooth, Geolocation, WebGL vendor/renderer).

---

## (a) How detectors fingerprint this surface in 2026

Modern anti-bot stacks (Cloudflare Bot Management, DataDome, HUMAN/PerimeterX,
Akamai, plus the open testers CreepJS, fingerprint.js, bot.sannysoft,
browserleaks) do **not** score each property in isolation. They score
**cross-agreement** across 5–6 layers. Randomizing each field independently makes
things *worse*, not better, because it manufactures impossible combinations.

The concrete 2026 checks:

1. **UA ⇄ UA Client Hints ⇄ navigator.* triangulation.** A request advertising
   `Chrome/120` in the `User-Agent` is expected to send `Sec-CH-UA`,
   `Sec-CH-UA-Mobile`, `Sec-CH-UA-Platform` on *every* navigation, and to expose a
   matching `navigator.userAgentData` with a `"Not A Brand"` decoy entry.
   `getHighEntropyValues(['platform','platformVersion','architecture','model',
   'fullVersionList','bitness'])` must agree with the UA and with `navigator.platform`.
   Missing hints, a missing decoy brand, or a `userAgentData.platform` of `Linux`
   under a `Windows` UA is an instant flag. (UA says `Windows NT 10.0` but
   `navigator.platform` returns `Linux x86_64` → strong bot signal.)

2. **`navigator.deviceMemory` value legality.** Chrome deliberately **caps
   `deviceMemory` at 8** and only ever emits the quantised set
   `{0.25, 0.5, 1, 2, 4, 8}`. Castle reported >16,000 genuine-looking Chrome events
   reporting `deviceMemory > 8`, essentially all automation. Values such as `3`,
   `6`, `16`, or `32` **cannot occur** in real Chrome and are a single-signal tell.

3. **`hardwareConcurrency` ⇄ deviceMemory ⇄ GPU coherence.** A high-end WebGL
   renderer (`RTX 3080`) with `hardwareConcurrency: 4` and `deviceMemory: 2` is an
   impossible machine. Detectors bucket these together.

4. **`navigator.plugins` / `mimeTypes` shape.** Since Chrome ~93 the plugin list is
   frozen to exactly **5 PDF pseudo-plugins** (`PDF Viewer`, `Chrome PDF Viewer`,
   `Chromium PDF Viewer`, `Microsoft Edge PDF Viewer`, `WebKit built-in PDF`), each
   backed by `application/pdf` + `application/x-google-chrome-pdf` mime types,
   cross-linked (`plugin[i].item(0).enabledPlugin === plugin[i]`). `Native Client`
   (`internal-nacl-plugin`) was **removed years ago**. Firefox/Safari expose an
   **empty** `PluginArray`. Detectors also verify the objects are genuine
   `Plugin`/`PluginArray` instances (`navigator.plugins instanceof PluginArray`,
   `Object.getPrototypeOf(navigator.plugins[0]) === Plugin.prototype`), not plain
   objects.

5. **Prototype / "lie" detection (CreepJS-class).** For every spoofable getter the
   detector compares `Object.getOwnPropertyDescriptor(...).get.toString()` against
   the native `"function get X() { [native code] }"`, checks the getter throws the
   same `TypeError` a native accessor would when called with the wrong receiver,
   checks `Function.prototype.toString` length, and probes for `Proxy` handler
   traps. A property redefined with `Object.defineProperty(navigator, 'x', {get})`
   on the instance (instead of the prototype) is itself detectable, and a `Proxy`
   around a native function leaks via `toString`.

6. **`navigator.webdriver` value.** Real Chrome returns `false`; automated Chrome
   returns `true`. Returning **`undefined`** (or `delete`-ing the prototype prop) is
   now anomalous in itself — genuine browsers have the property present-and-false.

7. **Optional-API presence consistency.** `navigator.getBattery` exists in
   Chromium but not Safari/Firefox; the Generic Sensor APIs
   (`Accelerometer`/`Gyroscope`/`Magnetometer`) exist only in Chromium and only
   fire on real hardware/secure contexts; `navigator.vibrate` is desktop-Chrome
   present but no-op; Web Bluetooth exists only on desktop/Android Chrome behind a
   user gesture. A desktop UA that answers "yes" to accelerometer/gyroscope, or a
   Safari UA that exposes `getBattery`, is incoherent. Detectors read **API
   presence and behaviour**, not values you return from a WebSocket.

8. **`maxTouchPoints` ⇄ form factor**, **`languages` ⇄ `Accept-Language` header**,
   **timezone ⇄ geolocation ⇄ IP**, and **screen ⇄ devicePixelRatio ⇄ UA** are all
   cross-checked.

Sources:
[Castle — deviceMemory deep dive](https://blog.castle.io/deep-dive-how-navigator-devicememory-can-be-used-for-fingerprinting-and-bot-detection/),
[Castle — Bot detection 101 (2025)](https://blog.castle.io/bot-detection-101-how-to-detect-bots-in-2025-2/),
[Wilico — UA vs UA-CH mismatch detection](https://wilico.co.jp/en/blog/browser-fingerprint-inconsistency-detection-consistency-check),
[sicuranext — Sec-Fetch & Client Hints](https://blog.sicuranext.com/sec-fetch-and-client-hints-a-powerful-tool-against-automation/),
[CreepJS lie detection (codeline.co)](https://www.codeline.co/thoughts/repo-review/2024/creepjs-fingerprinting-lie-detection),
[CreepJS Proxy detection issue #238](https://github.com/abrahamjuliot/creepjs/issues/238),
[MDN NavigatorUAData.getHighEntropyValues](https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData/getHighEntropyValues),
[krowdev — How websites detect bots in 2026](https://krowdev.com/article/bot-detection-2026/).

---

## (b) What Basset Hound actually does (with citations)

### The architecture reality: two thin injected scripts + a farm of unwired modules

There are **three** distinct bodies of "device API" code in the repo, and the two
that ship elaborate coherence logic are **never injected into a page**.

**1. The script that actually runs in browsing tabs** is the hardcoded string in
the preload:
`src/preload/preload.js:894` `evasionHelpers.getWebviewEvasionScript()`. The
renderer reads it once (`renderer/renderer.js:34`) and injects it into every
`<webview>` — but on the **`did-stop-loading`** event
(`renderer/renderer.js:409` → `injectEvasionScript` → `webview.executeJavaScript`
at `renderer/renderer.js:489`), i.e. **after the page and all its scripts have
already executed.** This script:
  - forces `navigator.platform` → **hardcoded `'Win32'`** (`preload.js:929`),
    regardless of the UA actually set;
  - sets `navigator.plugins` → 3 plain objects incl. the removed **`Native
    Client`** (`preload.js:909-920`);
  - sets `navigator.languages` → `['en-US','en']` (`preload.js:923`);
  - `navigator.webdriver` → `undefined` (`preload.js:900`);
  - `window.chrome = {runtime,loadTimes,csi,app}` (`preload.js:944`).
  - It sets **no** `hardwareConcurrency`, **no** `deviceMemory`, **no**
    `mimeTypes`, **no** `userAgentData`, **no** screen/WebGL/canvas/timezone.

**2. The "fuller" script** `getEvasionScript()` in `evasion/fingerprint.js:105`.
This is imported by `src/main/main.js:39` and `windows/manager.js:9`, and is
returned over IPC/WebSocket via `get-evasion-script` (`main.js:1472-1474`) and
`get-profile-evasion-script` (`main.js:2319`). Note `windows/manager.js` imports it
but **never calls it** — pooled windows only get `setUserAgent`
(`windows/manager.js:228,249`); the import is dead. This script *does* override
`hardwareConcurrency`, `deviceMemory`, `mimeTypes`, screen, WebGL, canvas, audio,
and timezone (`fingerprint.js:187-197, 246-329, 341-358`), but:
  - `deviceMemory` is drawn from **`[4, 8, 16, 32]`** (`fingerprint.js:195`) — `16`
    and `32` are **impossible in real Chrome** (cap is 8);
  - `hardwareConcurrency` from `[4,8,12,16]` (`fingerprint.js:189`), unrelated to
    deviceMemory/UA/platform;
  - `navigator.platform` is a fresh independent random draw from
    `['Win32','MacIntel','Linux x86_64']` (`fingerprint.js:31,106,130`), while the
    UA is a **separate** independent draw (`main.js:792` `getRealisticUserAgent()`
    → `fingerprint.js:21-28`). Nothing ties platform to UA;
  - `navigator.plugins` again hardcodes `Native Client` (`fingerprint.js:151`) and
    `mimeTypes` to `application/pdf` + non-standard `text/pdf`
    (`fingerprint.js:169-172`);
  - **no `navigator.userAgentData` / Client Hints spoofing at all**;
  - WebGL renderer/vendor are independent random draws (`fingerprint.js:110-111`),
    so an `ANGLE (NVIDIA…)` renderer can land under a `MacIntel` platform.

**3. The unwired module farm** in `src/evasion/`. These are the modules the task
named, and they are the most sophisticated code in the repo — and they are
**never injected into any page**. Grep confirms they are imported only by tests and
by one WebSocket handler:
  - `src/evasion/device-fingerprinter.js` + `device-fingerprint-database.js`
    (150–200 coherent profiles) are consumed only by
    `websocket/handlers/device-fingerprinter-handler.js`, whose commands
    (`apply_device_profile`, `randomize_device`) **return a fingerprint object over
    the socket** (`device-fingerprinter-handler.js:105-118`) and never touch the
    renderer. `applyFingerprint()` itself just builds and returns a plain object
    (`device-fingerprinter.js:88-119`).
  - `src/evasion/vendor-detection-evasion.js` is the **only** code in the tree that
    builds a `navigator.userAgentData` object with a `getHighEntropyValues` method
    and a `"; Not A Brand"` decoy (`vendor-detection-evasion.js:61-121, 241-268`) —
    and it is imported by nobody except tests (`grep` for `Sec-CH`/`userAgentData`
    in `src/main`, `windows/`, `renderer/`, `evasion/` returns only this file).
  - `plugin-enumeration-evasion.js` has `spoofNavigatorPlugins(navigator)` /
    `spoofNavigatorMimeTypes(navigator)` (`plugin-enumeration-evasion.js:351-393`)
    that *would* patch a navigator — but no injected code ever calls them; the
    renderer/preload use their own hardcoded lists instead.
  - `sensor-api-evasion.js`, `battery-api-evasion.js`, `vibration-api-evasion.js`,
    `notification-api-evasion.js`, `bluetooth-api-evasion.js`,
    `geolocation-spoofer.js` all follow an identical dead pattern: an `apply()` that
    **returns a JS object** of made-up readings with a self-graded
    `effectiveness: '85-90%'` string (e.g. `sensor-api-evasion.js:237-258`,
    `battery-api-evasion.js:237-258`, `bluetooth-api-evasion.js:295-336`,
    `geolocation-spoofer.js:271-323`). None of them define a getter on
    `navigator.getBattery`, `Accelerometer`, `navigator.vibrate`, `Notification`,
    `navigator.bluetooth`, or `navigator.geolocation`. They produce data that no
    web page can observe.

### Transport layer

- UA header: set via `setUserAgent` (`main.js:793`, `windows/manager.js:249`,
  `windows/pool.js:187`) from a fixed 6-string list (`fingerprint.js:21-28`).
- Client Hints: the default config **strips `Sec-Ch-Ua-Platform`**
  (`config/defaults.js:230`, applied at `main.js:806-807`) but leaves the
  Electron-default `Sec-CH-UA` and `Sec-CH-UA-Mobile` intact — an incoherent hint
  set, and those remaining hints still carry Electron's real bundled Chromium brand
  /version, not the spoofed `Chrome/120`.
- Geolocation is the one optional API with a real injection path
  (`geolocation/manager.js:476` `getFullSpoofScript()`, pushed via
  `inject-geolocation-script`, `main.js:2012`) — separate from
  `src/evasion/geolocation-spoofer.js`, which is unused.

---

## (c) Gaps, ranked by severity

### CRITICAL-1 — No UA Client Hints spoofing; UA-CH ⇄ UA ⇄ navigator all disagree
The browser is Electron/Chromium on Linux. On any UA-CH-aware endpoint it emits
`Sec-CH-UA` / `Sec-CH-UA-Mobile` reflecting the **real** Electron Chromium brand
and `navigator.userAgentData.getHighEntropyValues()` returns **`platform:"Linux"`**,
while the UA header claims `Chrome/120 on Windows` and `navigator.platform` claims
`Win32`. This is the single highest-confidence flag in the 2026 playbook. The only
code that could fix it (`vendor-detection-evasion.js`) is never injected. Config
even strips just `Sec-CH-UA-Platform` (`config/defaults.js:230`), which draws
attention rather than deflecting it.
*Evidence:* `grep Sec-CH/userAgentData` → only `vendor-detection-evasion.js`;
no `userAgentData` override in `preload.js` or `fingerprint.js`.

### CRITICAL-2 — Injection fires after the page's own scripts (`did-stop-loading`)
`renderer/renderer.js:409` injects the evasion script on `did-stop-loading`. Any
detector script bundled in the page has **already executed on load** and read the
raw `navigator.webdriver` (Electron), raw `navigator.platform` (`Linux x86_64`),
raw plugins, raw `userAgentData`, etc. There is no `document_start` / preload-world
override for the guest `<webview>`. Result: for on-load fingerprinting the entire
evasion layer is cosmetic. Should use a `world`-isolated preload injected at
document start, not `executeJavaScript` post-load.

### CRITICAL-3 — navigator.platform / UA / deviceMemory produce impossible devices
Independent random draws guarantee incoherence:
- `platform` (`fingerprint.js:106`) vs UA (`main.js:792`) are unlinked → e.g. Mac
  Safari UA + `Win32` + `window.chrome` + Chrome plugins.
- `deviceMemory` includes `16`/`32` (`fingerprint.js:195`) — values Chrome can
  never report (cap 8); a single read flags automation.
- The preload path hardcodes `platform:'Win32'` (`preload.js:929`) under whatever
  UA was randomly chosen, and injects Chromium-only `window.chrome` + Chrome PDF
  plugins even when the UA is Firefox or Safari.

### HIGH-4 — navigator.plugins/mimeTypes are stale, wrong-shaped, and not real objects
Both injected scripts ship the removed **`Native Client`** plugin
(`preload.js:915`, `fingerprint.js:151`) and a 3-item list; real Chrome ≥93 has a
frozen **5-item** PDF set, Firefox/Safari have **empty** arrays. The objects are
plain `{}` literals, so `navigator.plugins instanceof PluginArray`,
`plugins[0] instanceof Plugin`, and `mimeType.enabledPlugin === plugin`
cross-links all fail. `mimeTypes` uses non-standard `text/pdf`
(`fingerprint.js:171`) instead of `application/x-google-chrome-pdf`.

### HIGH-5 — Spoofed getters are trivially unmasked as "lies"
Overrides use instance-level `Object.defineProperty(navigator,'x',{get})`
(`preload.js`, `fingerprint.js` throughout) and a `Proxy` around the native
`WebGLRenderingContext.prototype.getParameter` (`fingerprint.js:255-280`). Against
CreepJS-class checks: the getter `.toString()` is not `[native code]`, the accessor
sits on the instance not the prototype, the getter doesn't reproduce native
`TypeError`-on-wrong-receiver behaviour, and the Proxy is detectable via
`toString`/handler probing. `navigator.webdriver → undefined`
(`preload.js:900`, `fingerprint.js:122`) is itself wrong (real value is `false`).

### HIGH-6 — Optional device APIs (Battery/Sensors/Vibration/Notification/Bluetooth) are pure dead code
The six `*-api-evasion.js` modules never patch the DOM; they return objects to
nobody (`sensor-api-evasion.js:237`, `battery-api-evasion.js:237`,
`vibration-api-evasion.js:202`, `notification-api-evasion.js:167`,
`bluetooth-api-evasion.js:295`). So the real API surface is whatever Electron
exposes: Chromium's `navigator.getBattery`, Generic Sensor constructors, and
`navigator.vibrate` are all **present** regardless of the spoofed OS/browser. A
Safari or iOS profile that still exposes `getBattery`/`Accelerometer` is
self-refuting. The self-reported `effectiveness: '75-90%'` strings are fiction.

### MEDIUM-7 — Coherent profile database exists but is disconnected
`device-fingerprint-database.js` builds internally-consistent profiles (matched
OS/browser/GPU/cores) but they only leave the process as WebSocket JSON
(`device-fingerprinter-handler.js:105`). The `deviceMemory 16/32` and unlinked
`platform`/UA problems above would largely vanish if the injected script were
generated *from one selected profile*. The plumbing to do this
(`getEvasionScriptWithConfig`, `fingerprint.js:420`) exists but the renderer uses
the hardcoded preload string instead.

### MEDIUM-8 — languages ⇄ Accept-Language, maxTouchPoints, and timezone not co-derived
`navigator.languages` is a random draw (`fingerprint.js:107,136`) independent of
the `Accept-Language: en-US,en;q=0.9` header (`main.js:801`); `maxTouchPoints` is
never set in either injected script (defaults to Electron's `0`, contradicting any
mobile UA); timezone offset override ignores DST and is unlinked from the spoofed
geolocation/IP.

---

## (d) Remediation (concrete, ordered)

1. **Inject at document-start in an isolated world, before page scripts.** Replace
   the `did-stop-loading` `executeJavaScript` (`renderer/renderer.js:409`) with a
   `<webview>` preload (or `webFrame`/`setWebContents` preload) that runs the
   overrides at `document_start`. Nothing spoofed matters until this lands.

2. **Drive everything from one coherent profile.** Select a single profile from
   `device-fingerprint-database.js`, then derive **UA, Sec-CH-UA(+Mobile+Platform),
   navigator.platform, vendor, hardwareConcurrency, deviceMemory, maxTouchPoints,
   languages, Accept-Language, screen, WebGL, timezone, and plugin set from that one
   object.** Wire `getEvasionScriptWithConfig(profile)` (`fingerprint.js:420`) into
   the real injection path and retire the hardcoded preload string.

3. **Implement UA Client Hints spoofing (fixes CRITICAL-1).** Actually inject the
   `navigator.userAgentData` from `vendor-detection-evasion.js:61` (with the
   `"Not A Brand"` decoy and a working `getHighEntropyValues`) **and** rewrite the
   outgoing `Sec-CH-UA*` headers via `onBeforeSendHeaders` to match the spoofed
   Chrome brand/version/platform. Stop selectively stripping `Sec-Ch-Ua-Platform`
   (`config/defaults.js:230`); send a *consistent* full set instead.

4. **Legalise the hardware values.** Clamp `deviceMemory` to `{0.25,0.5,1,2,4,8}`
   (`fingerprint.js:195`); pick `hardwareConcurrency` from the profile and keep
   `deviceMemory`/cores/GPU in the same performance tier.

5. **Fix plugins/mimeTypes.** For Chrome profiles ship the exact frozen 5-item PDF
   set with correct filenames and cross-linked `application/pdf` +
   `application/x-google-chrome-pdf`; for Firefox/Safari profiles expose an **empty**
   `PluginArray`. Construct genuine `Plugin`/`PluginArray`/`MimeType` objects (or at
   minimum fix the prototype chain). Remove `Native Client` and `text/pdf`.

6. **Defeat lie-detection.** Define overrides on the **prototype** where the native
   accessor lives, copy native `.toString()` (spoof `Function.prototype.toString`
   for the patched fns), preserve native `TypeError`-on-wrong-receiver semantics,
   and avoid raw `Proxy` on native functions. Set `navigator.webdriver → false`
   (present-and-false), not `undefined`.

7. **Actually wire — or delete — the optional-API modules.** Either inject
   Battery/Sensor/Vibration/Notification/Bluetooth overrides at document-start and,
   crucially, **remove** the APIs Chromium exposes but the *spoofed* browser
   wouldn't (e.g. delete `navigator.getBattery`/sensor constructors under a Safari
   profile), or delete the dead modules so they stop inflating the "164 command /
   85-90% effectiveness" claims. Presence/absence must match the profile.

8. **Co-derive the soft signals.** Tie `navigator.languages` to the
   `Accept-Language` header, set `maxTouchPoints` from the profile form factor, and
   derive the timezone (with DST) from the spoofed geolocation/exit IP.

### Bottom line
The device-API evasion is far weaker than the module inventory implies. The
sophisticated, coherent code (`device-fingerprint-database.js`,
`vendor-detection-evasion.js`, the six optional-API modules) is **not connected to
any page**; the code that *does* run is two hardcoded scripts with impossible
values (`deviceMemory:32`, `platform` unlinked from UA, `Native Client`), injected
**after** the page's own detectors have already read the raw Electron/Linux
identity. Against a 2026 cross-checking detector this profile reads as automation on
the first request.

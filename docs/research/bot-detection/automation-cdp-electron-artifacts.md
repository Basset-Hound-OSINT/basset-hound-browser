---
title: "Bot-Detection Audit — Automation / CDP / Electron Artifacts Surface"
date: 2026-07-03
researcher: Claude (bot-detection capability audit)
status: Complete
category: bot-detection
surface: automation-cdp-electron-artifacts
target_version: 12.8.0
---

# Automation / CDP / Electron Artifacts — Detection Surface Audit

> **Bottom line up front:** This is the surface the project's own docs treat as "handled"
> (webdriver override, `window.chrome`, permissions shim), but the implementation is
> **injected too late, in the wrong world, and skips the single most damning tell — the
> Electron User-Agent.** A modern detector (Cloudflare, DataDome, CreepJS) would flag the
> default page-loading path within the first HTTP request, before any evasion script runs.
> The one place that patches `navigator.webdriver` *correctly* (`=> false` via an init
> script) is dead Playwright code that is not wired into the Electron webview flow.

---

## (a) How detectors fingerprint this surface in 2026

Modern anti-bot stacks treat "is this an automated/instrumented browser" as a **multi-signal
consistency problem**, not a single flag. For the automation/CDP/Electron surface, the live
2024–2026 techniques are:

1. **`navigator.webdriver` shape, not just value.** The property is defined on
   `Navigator.prototype` and returns `false` in a genuine Chrome 89+. Detectors check three
   things: (a) is it `true` (raw automation), (b) is it **`undefined`/absent** (someone
   deleted it — a stealth-tool tell), and (c) does the property descriptor / prototype
   location match a real browser. Returning `undefined` or deleting it from the prototype is
   now *itself* a positive detection signal. Correct behavior is a present property returning
   `false`. (Sources below: ScrapingBee, Kameleo, Castle.)

2. **CDP `Runtime.enable` leak.** Puppeteer/Playwright enable the CDP `Runtime` domain, which
   changes how V8 serializes objects for the DevTools console. The classic probe creates an
   object with a getter (or reads `error.stack`) and observes a side effect that only happens
   when a CDP client is listening. DataDome (Antoine Vastel, June 2024) and Cloudflare ship
   this. *Note:* V8 changed object-preview behavior in late 2024, so the `.stack`-getter
   variant broke (Castle) — but the `console.debug`/serialization variants and the more
   general "is a CDP session attached" heuristics remain.

3. **`window.chrome` runtime shape.** Real Chrome exposes `window.chrome` with a specific
   `chrome.runtime` object (with `id`, `connect`, `sendMessage`, and a populated
   `PlatformOs`/`PlatformArch` enum) and *lazily*-defined `loadTimes`/`csi` that are actually
   deprecated. A hand-rolled `window.chrome = {...}` plain object is detectable by property
   descriptor (writable/enumerable), by missing/extra members, and by
   `Object.getOwnPropertyDescriptor` not matching a native accessor.

4. **Permissions API cross-check.** `navigator.permissions.query({name:'notifications'})`
   must agree with `Notification.permission`. Headless returns `denied`+`default`
   simultaneously (an impossible pair). Detectors also `Function.prototype.toString` the
   `query` function and expect `"function query() { [native code] }"`; a JS shim fails this.

5. **Electron-specific tells.** The default Electron **User-Agent contains `Electron/<ver>`
   and the app name**, and (with `nodeIntegration`) `window.process`, `require`, `module`,
   `global`, `process.versions.electron` leak. `navigator.userAgentData` /
   `Sec-CH-UA` client hints will *not* list a `"Google Chrome"` brand, exposing a
   Chromium-shell. Detectors cross-check `navigator.userAgent` ⟷ `navigator.userAgentData`
   ⟷ the `Sec-CH-UA` request header for consistency.

6. **Headless / instrumentation tells layered on top:** `HeadlessChrome` UA substring,
   missing `chrome.app`, zero-plugin `navigator.plugins`, `navigator.plugins` items that are
   not real `Plugin`/`PluginArray` instances, `window.outerWidth===0`, and — increasingly —
   **the toString of every overridden getter/function** (stealth patches leave non-native
   `toString` results and mismatched prototypes).

7. **`cdc_` variables** are a **ChromeDriver/Selenium** artifact (`$cdc_asdjflasutopfhvcZLmcfl_`
   on `document`). They are **not** an Electron/CDP tell — noted here only because the repo's
   scrubbing list targets exactly these legacy Selenium/Phantom globals while missing the
   Electron reality.

---

## (b) What Basset Hound currently does — with file citations

### What exists

| Signal | Where | What it does |
|---|---|---|
| `--disable-blink-features=AutomationControlled` | `src/main/main.js:758` | Correct switch to keep Chromium from setting `webdriver=true`. |
| `navigator.webdriver` override | `evasion/fingerprint.js:121,442`; `src/preload/preload.js:900` | Sets getter to `() => undefined` **and** `delete Object.getPrototypeOf(navigator).webdriver`. |
| `window.chrome` spoof | `evasion/fingerprint.js:211,532`; `src/preload/preload.js:944` | Assigns a plain object with `runtime`, `loadTimes`, `csi`, `app`. |
| Permissions `notifications` shim | `evasion/fingerprint.js:201,522`; `preload.js:935` | Returns `{state: Notification.permission}` for the notifications query. |
| Legacy automation globals | `evasion/fingerprint.js:362-368,683-689` | Deletes `_phantom`, `__nightmare`, `__webdriver_evaluate`, `__selenium_*`, etc. |
| iframe `contentWindow.webdriver` | `evasion/fingerprint.js:379,700` | Re-applies the `webdriver => undefined` patch inside iframes. |
| `nodeIntegration:false` + `contextIsolation:true` (shell) | `src/main/main.js:770-771` | Prevents Node globals in the shell renderer. |
| webview `contextIsolation=no, nodeIntegration=no` (guest) | `renderer/renderer.js:92` | `nodeIntegration=no` keeps `require`/`process` out of the page. |

### How and WHEN it is injected (this is the problem)

- The evasion string used for real page navigations is
  `window.evasionHelpers.getWebviewEvasionScript()` — the **weaker** inline script at
  `src/preload/preload.js:896-965` (no WebGL/canvas/UA handling), captured once in
  `renderer/renderer.js:34`.
- It is injected by `injectEvasionScript(webview)` at `renderer/renderer.js:486-495`, which
  calls `webview.executeJavaScript(evasionScript)` (main world).
- That function is called **only** from the `did-stop-loading` handler
  (`renderer/renderer.js:409`). `did-stop-loading` fires **after the page and all its scripts
  have finished executing.** Any detection script that read `navigator.webdriver`,
  `window.chrome`, `navigator.userAgent`, permissions, etc. on load has **already captured the
  real (un-patched) values.**
- Injection is into the **main world** via `executeJavaScript`, so every override is visible
  to the page and its `toString`/descriptor mismatches are inspectable.

### The richer script exists but is barely used

`evasion/fingerprint.js` `getEvasionScriptWithConfig()` (WebGL, canvas, audio, timezone,
plugins) is exposed only through IPC `get-evasion-script` / `get-profile-evasion-script`
(`src/main/main.js:1473, 2318`). Nothing in the actual webview navigation path calls it — the
renderer uses the preload's inline script instead. Even if it were used, it **never overrides
`navigator.userAgent` or `navigator.userAgentData`** (verified across the whole file).

### The one *correct* webdriver patch is dead code

`src/cloudflare/detector.js:227-257` uses `page.addInitScript(() => { ... webdriver => false ... })`.
`addInitScript` is the *right* primitive (runs before page scripts) and `=> false` is the
*right* value — but it operates on a **Playwright `page` object that does not exist in this
Electron architecture** (the comment at line 256 admits "This would be set via CDP if using
Playwright directly"). It is not wired to the webview flow and never runs for real navigations.

### The "advanced" evasion module is simulation theater

`src/v12-9-0/evasion-handler.js` ("Predictive Evasion Response Handler", dated 2026-07-03)
advertises `chrome_runtime_spoofing`, `webdriver_masking`, etc. (lines 121-149). In reality:
- Detection probability is seeded from `Math.random()` (`DetectionProbabilityScorer._initializeScores`, line 444).
- `AdaptiveResponseEngine._applyStrategy()` returns `{ success: Math.random() > 0.2 }`
  (line 832-838) — **it never touches a page, a webContents, or the DOM.**
- The strategy `config` objects (`setProperty:'chrome.runtime'`, `removeProperty:'webdriver'`)
  are never applied anywhere. This module produces metrics, not evasion.

### Name-vs-reality gaps in the "listed" modules

- **`src/evasion/fingerprint-validator.js`** validates the *shape of a profile JSON object*
  (required fields, `webdriver: typeof v === 'boolean'` at line 72). It performs **no runtime
  fingerprint validation** and does not verify the browser actually presents a consistent,
  non-automation fingerprint.
- **`src/evasion/multi-layer-coordinator.js`** coordinates **behavioral timing/noise**
  (`pause-injection`, `inject-more-pauses`, `increase-noise-injection`) — it does **not**
  coordinate automation/CDP/Electron artifact scrubbing despite the "multi-layer" name.
- **`src/evasion/preloader.js`** only `require()`s evasion modules to warm the V8 JIT
  (line 31-107); several names in its list (`disable-developer-tools`,
  `navigator-properties`, `webrtc-leak-prevention`) do not exist as files and fail silently
  into `failed[]`. It injects nothing into any page.

### CDP posture (nuance in our favor)

The only CDP debugger attach is `network/throttling.js:116` → `debugger.attach('1.3')` +
`Network.enable`, bound to **`mainWindow.webContents`** (the shell UI), initialized at
`src/main/main.js:900`. It is **not** attached to the guest `<webview>` that loads target
pages, and it enables the **Network** domain, not **Runtime**. So the page-visible
`Runtime.enable` console-serialization leak is **not** currently triggered on target pages —
a rare point where this architecture is *safer* than raw Puppeteer. (This flips to a risk if
DevTools is opened on the guest, or if throttling is ever pointed at the guest webContents.)

---

## (c) GAPS — ranked by severity (what a real detector catches)

### CRITICAL-1 — Default Electron User-Agent leaks on every real navigation (TOP LEAK)
The target page loads in a `<webview>` guest whose UA is **never overridden**.
`setUserAgent()` is called only on `mainWindow.webContents` (the shell, `src/main/main.js:793`)
and on partition sessions during profile switches (`profiles/manager.js:436`) — neither
affects the default guest. The guest therefore sends the **default Electron UA**, which with
`electron ^39.2.7` (`package.json:83`) and app name `basset-hound-browser`/`12.8.0`
(`package.json:2-3`) looks like
`...Chrome/138.0.0.0 Electron/39.2.7 Safari/537.36` and/or contains the app name. This appears
in **both** the HTTP `User-Agent` header (checked before a single line of JS runs) and
`navigator.userAgent` (never patched anywhere). `HeaderManager` sets Accept-Language/Encoding
but **not** User-Agent (`src/main/main.js:801-807`). A one-line detector rule
(`/Electron|basset-hound/i.test(ua)`) blocks this. **This is the thing most likely to get us
blocked.**

### CRITICAL-2 — Evasion runs after the page, in the main world
All artifact patches are applied at `did-stop-loading` (`renderer/renderer.js:409`) via
main-world `executeJavaScript`. Detection scripts read the *real* values on load; the patch
lands too late to change what they captured, and the override is fully inspectable
(`toString`, descriptors, prototype). Even the signals we "handle" (webdriver, window.chrome,
permissions) provide near-zero protection because of timing and world. Correct primitive is a
`preload`/init script on the webview that runs at document-start in an isolated context.

### HIGH-3 — `navigator.webdriver` set to `undefined` instead of `false`
`evasion/fingerprint.js:121-127` and `preload.js:900-906` use `get: () => undefined` **and
delete the prototype property**. Per 2024–2025 detector guidance (ScrapingBee, Kameleo,
Castle), a genuine Chrome 89+ has the property **present, returning `false`**; `undefined`/
absent is a stealth-tool signature. The only `=> false` implementation is dead Playwright code
(`src/cloudflare/detector.js:235`). Net effect: the "fix" is a fingerprint.

### HIGH-4 — `navigator.userAgentData` / Client Hints entirely unhandled
No override of `navigator.userAgentData` or the `Sec-CH-UA*` request headers exists anywhere
in the repo. In Electron the UA-CH brand list omits `"Google Chrome"` and can expose the
Electron/Chromium shell, and — combined with CRITICAL-1 — creates a `userAgent` ⟷
`userAgentData` ⟷ `Sec-CH-UA` **inconsistency** that modern detectors specifically diff.

### HIGH-5 — `window.chrome` and permissions shims are crude and detectable
`window.chrome` is a plain writable/enumerable object assignment
(`evasion/fingerprint.js:211`) missing the real `chrome.runtime` shape and shipping
deprecated `loadTimes`/`csi`; the permissions shim only covers `notifications`
(`fingerprint.js:201`) and its non-native `Function.prototype.toString` is trivially caught.
Because of CRITICAL-2 these are also applied late/in-world.

### MEDIUM-6 — Advertised evasion is non-functional; module names overpromise
`src/v12-9-0/evasion-handler.js` never applies any patch (`_applyStrategy` →
`Math.random() > 0.2`, line 835); `multi-layer-coordinator.js` and `fingerprint-validator.js`
do behavioral-timing and JSON-schema work respectively, not artifact scrubbing; `preloader.js`
lists non-existent modules that fail silently. A reviewer trusting MEMORY.md's "85–90%
evasion effectiveness" would ship believing this surface is covered when the live path is not.

*(Lower-risk / N-A, for completeness: CDP `Runtime.enable` console leak is currently N/A on
target pages — see "CDP posture" above; `cdc_` scrubbing is irrelevant since this is not a
ChromeDriver tool; Node/`process` leaks are mitigated by `nodeIntegration:false` config, not by
any scrubbing code, so a future `nodeIntegration:true` regression would silently reopen them.)*

---

## (d) Concrete remediation recommendations

**R1 — Override the guest UA + Client Hints (fixes CRITICAL-1 / HIGH-4).**
Set a realistic Chrome UA on the *session that backs the webview*, not just the shell:
`session.fromPartition(...).setUserAgent(realChromeUA)` and/or set the `useragent` attribute
on the `<webview>` at creation (`renderer/renderer.js:88-93`). Additionally override
`navigator.userAgent` **and** `navigator.userAgentData` (brands incl. `"Google Chrome"`,
`getHighEntropyValues`) in the init script, and rewrite `Sec-CH-UA*` headers in `HeaderManager`
so header ⟷ JS ⟷ UA-CH all agree. Remove `Electron`/app-name from every surface.

**R2 — Move injection to document-start in an isolated world (fixes CRITICAL-2).**
Attach a dedicated **preload script to the `<webview>`** (`webview.setAttribute('preload', ...)`)
or use `webContents.on('did-start-navigation')` + `executeJavaScriptInIsolatedWorld`, so
overrides exist **before** page scripts run. Stop injecting on `did-stop-loading`. Prefer an
isolated world so page code cannot enumerate/`toString` the patches.

**R3 — Fix the webdriver value (fixes HIGH-3).**
Replace every `get: () => undefined` + prototype-delete with a **present property returning
`false`**, defined once on `Navigator.prototype` with a native-looking descriptor. Delete the
`delete Object.getPrototypeOf(navigator).webdriver` lines
(`fingerprint.js:127,448`, `preload.js:906`). Reuse the already-correct pattern from
`src/cloudflare/detector.js:235`.

**R4 — Harden `window.chrome`, permissions, and native `toString` (fixes HIGH-5).**
Model `chrome.runtime` on a real Chrome (correct members, accessor descriptors), drop
deprecated `loadTimes`/`csi` unless the spoofed Chrome version still exposes them, extend the
permissions shim beyond `notifications`, and wrap all patched functions so
`Function.prototype.toString` returns native-looking output (a `toString` proxy). Consolidate
on a **single** injected script (retire the duplicated preload copy at `preload.js:896-965`).

**R5 — Delete or gate the theater (fixes MEDIUM-6).**
Either wire `src/v12-9-0/evasion-handler.js` to an actual injector or clearly mark it
non-functional; remove dead Playwright code in `src/cloudflare/detector.js` or port it to the
Electron path; prune non-existent module names from `preloader.js`. Update MEMORY.md so the
"85–90% effectiveness" claim reflects the real page-load path, not the unused
`getEvasionScriptWithConfig`.

**R6 — Add an adversarial regression harness.**
Point the browser at `bot.sannysoft.com`, CreepJS, and `browserleaks.com/javascript` in CI and
assert: UA has no `Electron`/app name; `navigator.webdriver === false` (present);
`userAgent`⟷`userAgentData`⟷`Sec-CH-UA` consistent; permissions/`Notification.permission`
consistent; overridden functions pass a native-`toString` check. This converts "we're covered"
claims into observed pass/fail.

---

## Sources (2024–2026)

- DataDome — *How New Headless Chrome & the CDP Signal Are Impacting Bot Detection* — https://datadome.co/threat-research/how-new-headless-chrome-the-cdp-signal-are-impacting-bot-detection/
- Castle — *Why a classic CDP bot detection signal suddenly stopped working* — https://blog.castle.io/why-a-classic-cdp-bot-detection-signal-suddenly-stopped-working-and-nobody-noticed/
- Rebrowser — *How to fix Runtime.Enable CDP detection* — https://rebrowser.net/blog/how-to-fix-runtime-enable-cdp-detection-of-puppeteer-playwright-and-other-automation-libraries
- Kameleo — *Bypass Runtime.enable* — https://kameleo.io/blog/bypass-runtime-enable-with-kameleos-undetectable-browser
- Octo Browser — *CDP leaks in Puppeteer* — https://blog.octobrowser.net/cdp-leaks-in-puppeteer-how-anti-fraud-systems-detect-automation-through-chrome-devtools-protocol
- ScrapingBee — *How to Bypass CreepJS and Spoof Browser Fingerprinting* — https://www.scrapingbee.com/blog/creepjs-browser-fingerprinting/
- Scrapfly — *Automation Detection Tool* — https://scrapfly.io/web-scraping-tools/automation-detector
- Send.win — *Headless Browser Detection Methods (2026)* — https://blog.send.win/headless-browser-detection-methods-browser-isolation-guide-2026/
</content>
</invoke>

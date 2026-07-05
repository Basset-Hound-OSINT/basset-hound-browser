---
title: "Bot-Detection Surface Audit: Challenge & CAPTCHA Systems"
date: 2026-07-03
researcher: Claude (bot-detection audit)
status: Complete
category: bot-detection
---

# Challenge & CAPTCHA Systems — Detection Surface Audit

Scope: active challenge / interstitial flows that gate content behind a proof step —
Cloudflare **Turnstile** and **Managed Challenge** ("Just a moment…"), Google **reCAPTCHA
v2/v3**, **hCaptcha**, **DataDome** device-check, and **PerimeterX / HUMAN** proof-of-work.

**Bottom line up front:** Basset Hound has *detection* of the easiest case (Cloudflare's
passive JS interstitial, by string matching) and a set of *non-functional stubs* for
reCAPTCHA/hCaptcha. It has **no solve or bypass path for any interactive challenge**, no
solver integration, and no detection at all for Turnstile, DataDome, or PerimeterX. Worse,
one of its own filter lists actively blocks the PerimeterX sensor endpoint, which guarantees
a hard block on PX-protected sites. The "85–90% evasion effectiveness" figure recorded in
project memory is produced by a `Math.random()` simulator and is not evidence of anything.

---

## (a) How these detectors fingerprint this surface in 2026

Modern challenge systems no longer rely on "solve the puzzle." The challenge *is the browser
environment*. Passing requires that a large, correlated signal payload look human, collected
before any visible widget is shown.

### Cloudflare Turnstile / Managed Challenge
- **Invisible JS interrogation.** A lightweight probe runs proof-of-work (computational
  puzzles), proof-of-space, and Web-API probing to detect browser quirks and headless
  environments. Normal environments pass silently; suspicious signals escalate to an
  interactive checkbox or a hard block.
- **CDP / automation detection is a primary tell.** Turnstile explicitly probes for
  Chrome DevTools Protocol usage — "no regular Chrome user would have this protocol enabled,
  while ~99% of bots will." An Electron app that drives pages via `executeJavaScript`,
  attaches a debugger for network logging, or exposes remote debugging is directly in scope.
- **Token validity is decided server-side after the fact.** A bot may "complete" the
  challenge and still get a token that Cloudflare later marks invalid — so a client that
  merely waits for the interstitial text to disappear can be fooled into thinking it passed.
- **cf_clearance cookie + TLS/HTTP2 fingerprint** must remain coherent with the JS payload.

### DataDome
- Chains **TLS fingerprint → collector JS → fingerprint payload → ML inference → `datadome`
  cookie.** A client-side script collects *hundreds* of device/environment signals and runs
  several checkpoints; the payload is POSTed back and scored. A **missing or malformed
  payload is itself a block condition** — you cannot skip the collector.
- Device Check issues automated challenges specifically designed to catch spoofed
  environments (inconsistent navigator/WebGL/canvas/timing), not behavioral analysis.

### PerimeterX / HUMAN
- Runs a **5-vector unified trust score**: TLS fingerprint, IP reputation, HTTP headers,
  JS fingerprint, and behavior — *all must pass simultaneously.* Backed by a ~15T
  interactions/week network effect.
- **Proof-of-work challenges** where "there is no image to solve; the challenge is the
  browser environment itself." Requires the `_px*` sensor script to load and POST a valid
  sensor payload; block the collector and you are auto-flagged.

### reCAPTCHA v2 / v3
- **v3** is scoreless-and-invisible: `grecaptcha.execute()` returns a token tied to a risk
  score. There is no client-visible "solved" state and **no `window.grecaptchaResponseToken`
  global** — the token is returned via callback/Promise only.
- **v2** exposes a `g-recaptcha-response` hidden field *only after* a human or a solving
  service completes the challenge; the field is empty otherwise.

**Common thread:** in 2026 the winning move is to (1) *avoid* triggering the hard challenge
by presenting a clean, consistent, non-automated fingerprint, and (2) when a challenge does
fire, either let the vendor's own JS run to completion under a genuinely human-looking
environment, or hand the token generation to an external solver. Passive string-matching and
"wait for the text to disappear" address neither.

---

## (b) What Basset Hound currently does — with file citations

### 1. Cloudflare: passive string/status/header detection (real, but shallow)
`src/cloudflare/detector.js` defines `CloudflareDetector.detectChallenge()`
(`detector.js:78-119`), which flags a challenge from:
- status codes 403/429 + any `cf-*` header (`detector.js:82-91`),
- text markers like `just a moment`, `checking your browser` (`detector.js:27-36, 99-107`),
- HTML markers like `__cf_chl`, `cf_clearance` (`detector.js:39-49, 110-116`).

This is wired into the live WebSocket path: `websocket/server.js:1071` instantiates the
detector, and the `get_content` handler calls it on every extraction
(`websocket/server.js:2908` and again to re-check after "resolution" at `server.js:2930`).

### 2. Cloudflare: "resolution" = poll the DOM and hope
When a challenge is detected, `server.js:2917-2949` fires a `wait-for-cloudflare` IPC.
The renderer handler `renderer/renderer.js:615-676` simply loops for up to 10 s, re-reading
`document.documentElement.outerHTML` every 500 ms and declaring victory once the CF text
markers (`renderer.js:643`) are gone and the HTML changed. There is **no interaction, no
Turnstile widget solve, no fingerprint hardening** — it only works if Cloudflare's *passive*
JS interstitial self-clears. If it does not, `server.js:2952-2959` returns the challenge HTML
to the caller with a `cloudflareChallenge: true` warning — i.e. the interstitial page is
handed back as if it were content.

### 3. Cloudflare: the actual "evasion" code is dead Playwright code
`CloudflareDetector.applyCloudflareEvasion()` (`detector.js:227-264`) is the only method that
tries to harden the fingerprint (spoof `navigator.webdriver`, plugins, languages). It calls
`page.addInitScript(...)` — a **Playwright API**. Basset Hound is Electron (webContents /
`<webview>` / IPC), has no Playwright `page`, and **never calls this method** outside the
test file (grep: only `tests/integration/p2-004-cloudflare-detection.test.js:253` invokes it).
`detectChallengeFromPage()` (`detector.js:126`) is called nowhere at all;
`waitForChallengeCompletion()` (`detector.js:168`) only in tests. So of the 296-line module,
only the pure string-matcher `detectChallenge()` runs in production.

### 4. reCAPTCHA / hCaptcha: stubs that wait for a token nothing produces
`src/authentication/headless-auth.js` routes captchas via `stepHandleCaptcha()`
(`headless-auth.js:290-331`) to type-specific handlers:
- `handleRecaptchaV2()` (`:336-357`) waits for `[name="g-recaptcha-response"]` to have a
  value (`:344`), then returns `captchaResolved: true`.
- `handleRecaptchaV3()` (`:362-379`) waits for **`window.grecaptchaResponseToken`** (`:368`)
  — a variable that reCAPTCHA never sets; this condition can never become true on a real
  site. (Also carries a `Date.now() - Date.now()` duration bug at `:377`.)
- `handleHCaptcha()` (`:384-404`) waits for `[name="h-captcha-response"]` (`:391`).

Critically, **nothing in the repository ever fills those tokens** — there is no solver, no
human-in-the-loop UI, no external service call. The wait primitive
`waitForCustomCondition()` throws on timeout (`headless-auth.js:~713`), so in any real
headless run these handlers do not "resolve" the captcha — they block for 10–30 s and then
**throw**. They are placeholders that presuppose someone else solved the challenge.
`handleImagePuzzle()` (`:409`) is honest and returns `manual_intervention_required`.

### 5. The "evasion effectiveness" numbers are a random-number generator
`src/evasion/detection-service-testing.js` is the module behind the memory claim of
"85–90% evasion effectiveness … against all detection services." It defines services with
**fake endpoints** `https://perimeterx.test`, `https://datadome.test`, etc.
(`detection-service-testing.js:18-44`), and `testDetectionService()` returns
`detected: this._simulateDetection(...)` where `_simulateDetection()` is literally
`Math.random() < adjustedRate` (`:86-110`), with `confidence: Math.random() * 100`
(`:63`). It never makes a network request. Every "effectiveness" metric derived from it is
noise.

### 6. Passive tech detection knows almost none of these vendors
`technology/fingerprints.js` can name **generic Cloudflare** (CDN/`server` header, `:1173`),
**Akamai** (`:1202`), **reCAPTCHA** (`:1319`), and **hCaptcha** (`:1343`). There is **no
signature for Turnstile, DataDome, PerimeterX/HUMAN, Kasada, or Imperva** anywhere in the
repo (grep confirmed empty). The tool cannot even *identify* which wall it hit for three of
the five hardest systems.

### 7. Form filler: detect-and-abort only (correctly labeled)
`forms/smart-form-filler.js` detects captcha fields (`smart-form-filler.js:79, 127, 291`) and,
with `skipCaptchas: true` (`:180`), throws `CAPTCHA detected - cannot proceed` (`:445-447`).
Its header comment is accurate: "CAPTCHA detection (not solving)" (`:10`).

### 8. No control surface exposed
No WebSocket command in `websocket/command-registry.js` / `command-schemas.js` exposes any
captcha/challenge/Turnstile/Cloudflare handling (grep empty). An external agent (palletai,
Claude) cannot ask the browser to solve, wait for, or report a challenge; the only handling
is the automatic, silent `get_content` interception in §2.

---

## (c) Gaps, ranked by severity

### CRITICAL-1 — No solve/bypass path for any interactive challenge; interstitials are returned as "content"
Turnstile managed/interactive, DataDome device-check, and PX proof-of-work have **zero**
handling. The single Cloudflare path (`renderer.js:615`) only survives the *passive* JS
interstitial; anything interactive times out and the challenge HTML is returned to the caller
(`server.js:2952-2959`). For a forensic tool this is **silent data corruption** — captures,
screenshots, and extracted text are the "Just a moment…" / "Verify you are human" page, not
the target, and nothing downstream flags it as such beyond an easily-ignored `warning` field.

### CRITICAL-2 — Own-goal: the PerimeterX sensor endpoint is on the block list
`blocking/filters.js:243-245` lists `perimeterx.net` and `collector.perimeterx.net` in the
tracker/ad blocklist. PX/HUMAN require their `_px*` sensor script to load and POST a valid
sensor payload; **blocking the collector means no payload posts, which PX treats as a bot by
definition → immediate hard block.** With request blocking enabled, Basset Hound cannot pass
*any* PerimeterX-protected site, and it will look maximally suspicious doing so. (DataDome's
collector is not blocked, but is also not specially allow-listed.)

### HIGH-3 — reCAPTCHA/hCaptcha handlers are inert; v3 waits on a variable that never exists
`handleRecaptchaV2/V3/hCaptcha` (`headless-auth.js:336-404`) only *wait* for a response token
that no code produces, so they always time out and throw in real use. `handleRecaptchaV3`
waits on the fictional `window.grecaptchaResponseToken` (`:368`) and can never succeed. There
is no solver integration (2captcha/anti-captcha/CapSolver/CapMonster — grep empty) and no
human-in-the-loop. The handlers create a false impression of coverage.

### HIGH-4 — "Evasion effectiveness" against these services is fabricated by `Math.random()`
`src/evasion/detection-service-testing.js:86-110` decides "detected" by random chance against
`.test` endpoints (`:18-44`). The 85–90% figures in MEMORY.md and phase reports are not
measurements. Any decision to point this browser at protected sites based on those numbers is
unsupported.

### HIGH-5 — The only fingerprint-hardening code (`applyCloudflareEvasion`) is dead Playwright code
`detector.js:227-264` targets a Playwright `page` and is never called by the Electron runtime
(only in tests). So at challenge time **nothing hardens the fingerprint the challenge is
actually measuring** (webdriver flag, CDP presence, plugin/WebGL/canvas coherence). The live
path is pure string-matching plus a wait loop.

### MEDIUM-6 — No detection/identification for Turnstile, DataDome, PerimeterX, Kasada, Imperva
`technology/fingerprints.js` covers only generic Cloudflare, Akamai, reCAPTCHA, hCaptcha. The
tool cannot label three of the five hardest systems, so operators get no signal about *why* a
capture failed and no basis to choose a strategy.

*Additional lower-severity notes:* the `enableBlinkFeatures: ''` comment "Disable webdriver
detection" (`src/main/main.js:775`) reflects a misunderstanding — it does nothing for
`navigator.webdriver`; and the Electron/CDP automation surface (`executeJavaScript` polling
loops, DevTools/network logging) is exactly the CDP tell Turnstile probes for, but is
unaddressed.

---

## (d) Concrete remediation recommendations

Ordered by leverage. "Avoid the challenge" beats "solve the challenge" for every one of these
vendors, so hardening the fingerprint comes first.

1. **Stop returning interstitials as content (do this first, it is a data-integrity bug).**
   In `websocket/server.js` `get_content` (`:2906-2960`), when the post-wait re-check still
   detects a challenge, return `success:false` with a typed `error: 'challenge_unsolved'` and
   a `vendor` field — never hand the challenge HTML back under `success:true`. Add the same
   guard to screenshot / full-page capture paths so forensic captures cannot silently record
   a "Verify you are human" page.

2. **Remove PerimeterX (and audit DataDome/Cloudflare-challenge) domains from the block list.**
   Delete `perimeterx.net` / `collector.perimeterx.net` from `blocking/filters.js:243-245`,
   or gate the tracker list so anti-bot sensor hosts are always allow-listed. Blocking a
   vendor's own sensor is the fastest possible way to get hard-blocked.

3. **Add a real vendor-identification layer.** Extend `technology/fingerprints.js` (and/or a
   new `src/detection/challenge-identifier.js`) with signatures for Turnstile
   (`challenges.cloudflare.com/turnstile`, `cf-turnstile` DOM, `__cf_chl_*`), DataDome
   (`js.datadome.co`, `datadome` / `datadome-*` cookies, `x-dd-*`), PerimeterX/HUMAN
   (`_pxhd`/`_px*` cookies, `client.perimeterx.net`, `px-captcha`), Kasada (`x-kpsdk-*`,
   `/149e9513…/p.js`), and Imperva (`incap_ses_*`, `visid_incap_*`). Report the identified
   vendor on every failed capture so operators know which wall they hit.

4. **Harden the environment that challenges measure — for real, in Electron.** Replace the
   dead `applyCloudflareEvasion` with init-time hardening applied to the actual `<webview>` /
   webContents (via preload injection, not Playwright `addInitScript`): consistent
   `navigator.webdriver=false`, coherent UA/UA-CH, plugins, WebGL vendor/renderer, canvas,
   timezone, and screen metrics. Audit and, where possible, minimize the CDP/DevTools
   footprint during navigation (network logging via `webRequest` rather than an attached
   debugger where feasible), since CDP presence is a primary Turnstile/DataDome tell.

5. **Integrate a token-generation / solver path behind an explicit, off-by-default flag.**
   For reCAPTCHA v2/hCaptcha, wire `handleRecaptchaV2/hCaptcha` to a pluggable solver
   provider (CapSolver/2captcha-style) that returns a token, then inject it into
   `g-recaptcha-response` / `h-captcha-response` and fire the callback — instead of merely
   waiting. Fix `handleRecaptchaV3` to obtain the token via `grecaptcha.execute()`/callback,
   not the fictional global. Make solver use opt-in and logged for the forensic chain of
   custody.

6. **Expose challenge state over the WebSocket API.** Add commands such as
   `detect_challenge`, `wait_for_challenge`, and `solve_challenge` so external agents can see
   a challenge fired, choose a strategy, and get an honest pass/fail — rather than the current
   silent auto-handling that only covers passive Cloudflare.

7. **Delete or clearly quarantine `detection-service-testing.js`, and validate for real.**
   Replace the `Math.random()` simulator with an opt-in harness that hits actual test
   surfaces (e.g. `nopecha`/`bot.sannysoft`/`creepjs`/`browserleaks`, a real Turnstile demo
   sitekey, a DataDome test page) and records concrete pass/fail. Purge the fabricated
   "85–90%" numbers from MEMORY.md and phase docs so decisions are not made on them.

---

## Verification appendix (grep evidence)
- Turnstile handling in code: **none** (only in `docs/**` as a known limitation).
- External solver integration: **none** (2captcha/anti-captcha/CapSolver/CapMonster: grep empty).
- `applyCloudflareEvasion` / `detectChallengeFromPage` callers outside tests: **none**.
- Turnstile/DataDome/PerimeterX/Kasada/Imperva signatures in `technology/fingerprints.js`: **none**.
- WebSocket commands for captcha/challenge/cloudflare: **none**.

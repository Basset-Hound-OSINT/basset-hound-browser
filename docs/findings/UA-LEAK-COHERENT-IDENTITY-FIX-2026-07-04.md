# UA Leak / Coherent-Identity Fix — Live Verification (2026-07-04)

**Agent:** security-lead (`ua-leak-coherent-identity`)
**Scope (edited):** `utils/user-agents.js`, `src/main/main.js`, `renderer/renderer.js`,
`evasion/fingerprint.js` (WORK_ZONE only). No commits.
**Fixes the #1 stealth-breaking leak** documented in
`docs/findings/PRIVACY-ANONYMITY-VERIFICATION-2026-07-04.md` §3–4: the browsed page advertised
`Electron/39.8.10` + `basset-hound-browser/12.8.0` in its User-Agent on BOTH `navigator.userAgent`
(JS) and the wire, and `navigator.platform` did not match the UA OS.

**Verdict:** ✅ **FIXED and PROVEN live.** The guest `<webview>` now presents a clean Chrome UA
(zero `Electron`/`basset` tokens) on BOTH the JS layer and the wire; `navigator.platform` is
coherent with the UA OS; and `set_user_agent` now routes to the guest. `npm run smoke:mvp` stays
**15/15**; `tests/unit/user-agent-rotation.test.js` stays **26/26**.

---

## 1. Root cause

The browsing surface is a renderer `<webview>` created **without a `partition`**
(`renderer/renderer.js:92`), so it uses `session.defaultSession`. The UA was only ever set on the
**shell** window's webContents:

- `src/main/main.js` (old ~837): `mainWindow.webContents.setUserAgent(getRealisticUserAgent())`
  — sets the SHELL UA, which pages never see.
- `utils/user-agents.js` `setUserAgent()` (old :281): `mainWindow.webContents.setUserAgent(ua)`
  — same shell-only bug; the WS `set_user_agent` command therefore never reached the guest.

The guest webContents kept Electron's default UA (`Electron/… basset-hound-browser/…`). Separately,
the injected evasion script hard-coded `navigator.platform` (`Win32` from the preload's
`getWebviewEvasionScript`, or a *random* platform from `evasion/fingerprint.js`), unrelated to the
UA — so platform and UA disagreed (the finding saw `Win32` with a `Linux x86_64` UA).

This is the same shell-vs-webview bug class as the earlier storage/screenshot fixes: control was
applied to the shell, not the guest that shares `session.defaultSession`.

---

## 2. Fix (file:line)

**A clean Chrome UA is propagated to the guest via three coherent layers, and the injected
`navigator.platform` is derived from that UA.**

### `evasion/fingerprint.js`
- `CHROME_USER_AGENTS` (new) + `getRealisticChromeUserAgent()` (`:111`) — Chrome/Chromium-only UA
  pool (one per OS family). Chosen because the rest of the spoof (`window.chrome`, the Chrome plugin
  list, ANGLE WebGL renderers) describes a Chromium browser; a Firefox/Safari UA would be incoherent.
- `getPlatformForUserAgent(ua)` (`:123`) — maps the UA OS → coherent `navigator.platform`
  (`Windows→Win32`, `Mac→MacIntel`, `Linux→Linux x86_64`, Android/iOS handled).
- Active-identity state + `setActiveUserAgent()`/`getActiveUserAgent()` (`:141`–). `getEvasionScript()`
  now derives `platform` from the active UA (`:179`) instead of a random pick, and **memoizes** the
  script per active UA (`:174`, `:474`) so the per-session fingerprint is stable and regenerates only
  when the UA changes.

### `utils/user-agents.js` — `setUserAgent(userAgent, mainWindow)`
Now applies the UA to the **guest**, not just the shell (all guarded so unit tests without a real
Electron session are a no-op):
- `session.defaultSession.setUserAgent(userAgent)` (`:295`) — guest webview inherits it (JS + wire).
- `app.userAgentFallback = userAgent` (`:298`) — new WebContents (fresh tabs) default to it.
- Iterates `webContents.getAllWebContents()` and sets the UA on any `getType()==='webview'` guest
  (`:305`–`311`) — session-level `setUserAgent` does **not** retroactively update an already-created
  WebContents, so this is what makes a **runtime** `set_user_agent` reach an already-open guest.
- `setActiveUserAgent(userAgent)` (`:324`) — keeps the injected `navigator.platform` coherent.

### `src/main/main.js`
- Import adds `getRealisticChromeUserAgent, setActiveUserAgent` (`:39`).
- Startup identity (`:843`–`845`): pick a Chrome UA, `setActiveUserAgent(ua)`, then route through
  `userAgentManager.setUserAgent(ua, mainWindow)` — the SAME path the WS command uses, so startup and
  runtime behave identically (session + fallback + shell + coherence in one call).

### `renderer/renderer.js`
- `init()` (`:41`) and `injectEvasionScript()` (`:516`–) now fetch the **coherent** evasion script
  from main via `window.electronAPI.getEvasionScript()` (which derives platform from the active UA),
  re-fetched per injection so a runtime UA change stays coherent; falls back to the preload's built-in
  script if the IPC path is unavailable.

The WS `set_user_agent` handler (`websocket/server.js:5780`) was already calling
`userAgentManager.setUserAgent(ua, mainWindow)`, so **requirement 3 is satisfied without touching the
WS server** — the manager now does the right thing.

---

## 3. Live proof (headless, isolated OS-assigned WS port, `ELECTRON_RUN_AS_NODE` deleted, throwaway
`--user-data-dir`, detached process group, reaped)

Driver navigated to `https://httpbin.org/headers` and read (a) `navigator.userAgent` +
`navigator.platform` via `execute_script`, and (b) the **wire** `User-Agent` echoed in httpbin's
response body. Then issued `set_user_agent` and re-navigated.

### BEFORE (from the privacy-verification finding, §3)
```
navigator.userAgent:  ...basset-hound-browser/12.8.0 ... Electron/39.8.10 ...   ❌ LEAK (JS)
httpbin wire UA:       (same Electron/basset UA)                                 ❌ LEAK (wire)
navigator.platform:   Win32   while UA said X11; Linux x86_64                    ❌ incoherent
set_user_agent:        set only the shell → guest UA unchanged                    ❌ no effect on guest
```

### AFTER (this run — all 10 assertions PASS)
Scenario A — default startup identity:
```
A JS   UA: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
A WIRE UA: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
A platform: MacIntel
  PASS  A: JS UA clean (no Electron/basset), is Chrome
  PASS  A: WIRE UA clean (no Electron/basset), is Chrome
  PASS  A: JS UA === WIRE UA
  PASS  A: platform coherent with UA (MacIntel ⇔ "Mac OS X")
```
Scenario B — runtime `set_user_agent` routes to the guest (set to a distinct Chrome/123 Mac UA):
```
set_user_agent -> { success: true }
B JS   UA: ...Chrome/123.0.0.0 Safari/537.36
B WIRE UA: ...Chrome/123.0.0.0 Safari/537.36
B platform: MacIntel
  PASS  B: JS UA reflects the new UA (guest updated)
  PASS  B: WIRE UA reflects the new UA (guest updated)
  PASS  B: WIRE UA clean
  PASS  B: platform coherent with new UA
```

**Coherence proof:** in both scenarios `navigator.platform` (`MacIntel`) matches the UA OS
(`Macintosh; Intel Mac OS X`), and JS UA === wire UA — one consistent identity across the JS layer,
the wire, and the platform field.

(Unit check of the derivation: `getPlatformForUserAgent` returns Win32/MacIntel/Linux x86_64 for
Windows/Mac/Linux UAs; the injected script advertises the derived platform; the script is memoized per
UA and regenerates on UA change; `getRealisticChromeUserAgent()` returned a clean `Chrome/` UA with no
Firefox/Electron/basset token across 30 draws.)

---

## 4. Regression / non-breakage

- `npm run smoke:mvp` → **15/15 PASS** (navigate, get_url, get_content, screenshot, storage
  round-trip, session save/restore, fill, click, detect_technologies, extract_links, cookies,
  export_raw_html, forensic_capture).
- `tests/unit/user-agent-rotation.test.js` → **26/26 PASS** (the guarded `require('electron')` in
  `setUserAgent` is a no-op under the test harness).
- `node -c` clean on all four edited files.

---

## 5. Notes / out of scope

- Injection **timing** (evasion fires on `did-stop-loading`, i.e. after page scripts) was flagged in
  the finding as a separate "fires too late" issue and is NOT part of this task's required fixes; it is
  left as-is. A detector sampling during initial load could still see un-patched values — deferred.
- Still-passive surfaces (WebGL `null`/`hardwareConcurrency` real in `--disable-gpu` headless) are
  unchanged; deferred per the finding.
- The preload's `getWebviewEvasionScript()` (hard-coded `Win32`) is now only a fallback — the renderer
  prefers the coherent main-process script. The preload was out of WORK_ZONE and left untouched.

_Driver: `.test-scratch-ua-verify/ua-verify.js` (gitignored; removed after the run). Process group
reaped; no strays; no commits._

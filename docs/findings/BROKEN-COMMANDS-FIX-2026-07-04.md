# Broken Commands Fix — extract_* family & get_cookies

**Date:** 2026-07-04
**Agent:** debugger (broken-commands)
**Work zone:** `websocket/server.js`, `cookies/manager.js`, `renderer/renderer.js`
**Status:** ✅ Both bugs fixed and verified live (2x each, headless Electron driving `ws://127.0.0.1:8765`).

---

## Summary

Two browser commands were broken. A prior agent had partially worked on both and was
interrupted. Investigation showed **the prior agent's diagnosis of both bugs was partly
wrong**, so their on-disk fixes did not actually make the commands work. The true root
causes were different from the task's stated hypotheses:

| Bug | Stated hypothesis | Actual root cause |
|-----|-------------------|-------------------|
| `extract_*` returns empty | Handlers read the browser shell instead of the `<webview>` | Correct — but the fix only works once a **second, latent bug** (a lossy response serializer) is also disabled. The prior agent had done both. |
| `get_cookies { url }` returns 0 | `cookies/manager.js` native `cookies.get({url})` returns empty | **Wrong.** `cookieManager.getCookies` was never called: the forensics module **overrides** `get_cookies` with a network-capture handler that ignores `url`. Native `cookies.get({url})` actually works. |

Both are now fixed. Final live evidence (Wikipedia "Web scraping"): `extract_links` returns
the exact live DOM link count, and `get_cookies { url }` returns the URL's session cookies
including a just-set test cookie.

---

## Bug 1 — extract_* family returned empty on live pages

### Root cause (two layers)

1. **Wrong HTML source.** The `extract_metadata / extract_links / extract_forms /
   extract_images / extract_scripts / extract_stylesheets / extract_structured_data /
   extract_all` handlers (`websocket/server.js` ~8380–8570) read page HTML via
   `this.mainWindow.webContents.executeJavaScript("document.documentElement.outerHTML")`.
   `mainWindow.webContents` is the **browser chrome/shell**, whose document has no page
   content (and no `<a href>` tags) — so extraction always saw an empty document. Real
   pages load in the `<webview>` guest. The reference command `get_content`
   (`server.js` ~2926) instead uses the `get-page-content` IPC, which the renderer answers
   from `getActiveWebview()` (`renderer/renderer.js` ~654, `onGetPageContent`).

2. **Lossy response serializer (latent, would have hidden the fix).** Every command
   response is sent via `_sendResponse` (`server.js` ~1928) with `templateName`
   `'success'`/`'error'` (`server.js:1734`). `OptimizedResponseSerializer.serialize` fills
   a registered template via `ResponseTemplate.fill()`
   (`websocket/response-serializer.js:33`), which copies only the **template's own keys**
   (`success`, `data`, `timestamp`) and **drops** `id`, `command`, `links`, `count`, etc.
   `warmupTemplates()` registers those templates (`response-serializer.js:319`,
   `getSerializer` at :369), so the path is active. Result: clients get a reply with no
   `id` and no payload — the command "hangs"/returns empty even after fix #1.

### Fix (all in `websocket/server.js`, prior agent's changes — verified correct)

- Added helper `getWebviewPageContent()` (`server.js` ~2746) mirroring `get_content`'s
  `ipcWithTimeout(..., 'get-page-content', 'page-content-response', ...)`, normalizing
  `content`→`html`.
- Routed the 8 `extract_*` content handlers through `getWebviewPageContent()` instead of
  `mainWindow.webContents.executeJavaScript(outerHTML)` (`server.js` ~8387–8570).
- `_sendResponse` now calls `this.responseSerializer.serialize(responseData, null)`
  (`server.js:1944`) — forces full/direct serialization, preserving all fields.
  `templateName` is intentionally ignored.

`renderer/renderer.js` navigation changes by the prior agent (webview `loadURL()`-based
`onNavigateWebview`, removal of the stray `did-navigate` completion emit, and the
`onGetWebviewUrl` fallback) were kept and verified — they make `navigate` correlate to the
load it started so the correct page is present before extraction.

### Not changed (out of scope, but note)
`detect_technologies` (8223), `identify_cms` (8285), `identify_analytics` (8335),
`export_device_ids` (8939), `modify_element` (9061), and `export_raw_html` (8735/8740) still
read `mainWindow.webContents`. Of these, **`export_raw_html` and the three tech-detection
commands have the same shell-vs-webview latent bug** and will return shell HTML on live
pages. They are a different command family (device fingerprinting / tech detection / raw
export) and outside the stated `extract_*` scope, so they were left untouched. Recommend a
follow-up to route them through `getWebviewPageContent()` too.

---

## Bug 2 — get_cookies { url } returned 0 despite cookies existing

### Root cause: command override, not the cookie jar

`get_cookies` is registered **twice**:

- `websocket/server.js:3158` — the correct handler: `this.cookieManager.getCookies(url)` →
  `cookies/manager.js` (Electron session jar, filtered by URL).
- `websocket/commands/forensic/network/network-forensics-commands.js:639` — a forensic
  handler: `collector.getCookies(params.filter || {})`, reading a **network-capture
  collector** (not the session jar) and keyed on `params.filter`, **ignoring `params.url`**.

`registerNetworkForensicsCommands` runs at `server.js:10695`, **after**
`setupCommandHandlers` (which defines 3158), so the forensic handler **won** at runtime.
Instrumentation confirmed `cookieManager.getCookies` was **never called**; the forensic
handler returned `{ cookies: [], count: 0 }` because no `filter` was passed and its store
was empty. This means the prior agent's `cookies/manager.js` fallback fix was **dead code**
for this path — and its premise ("native `cookies.get({url})` returns empty in this build")
is **false**: native URL filtering works here (verified — the fallback branch never fired).

### Fix (`websocket/server.js` ~10693–10707)

Preserve the core session-based `get_cookies` before the forensic registration and restore
it after, exposing the forensic variant under a non-conflicting name:

```js
const _sessionGetCookies = this.commandHandlers.get_cookies;
registerNetworkForensicsCommands(this.commandHandlers);
if (_sessionGetCookies && this.commandHandlers.get_cookies !== _sessionGetCookies) {
  this.commandHandlers.get_cookies_network = this.commandHandlers.get_cookies; // forensic variant kept
  this.commandHandlers.get_cookies = _sessionGetCookies;                        // restore session read
}
```

### `cookies/manager.js` (kept, comment corrected)
The prior agent's RFC 6265 fallback matcher (`getCookies` + `cookieMatchesUrl`) is correct
and retained as **defensive depth** (only runs if native `get({url})` returns empty, which
does not happen on this build). The misleading comment claiming the native filter is broken
"in this build" was corrected to describe it as a defensive fallback for versions where it
is unreliable.

---

## Live-page evidence (headless Electron, `ws://127.0.0.1:8765`, flat JSON)

Driver: navigate `https://en.wikipedia.org/wiki/Web_scraping`, then cross-check
`execute_script document.links.length` vs `extract_links`, and a `set_cookie` →
`get_cookies { url }` round-trip. Ran 2x clean after the fix.

**Pass final1**
- `navigate` → `url: https://en.wikipedia.org/wiki/Web_scraping`
- `execute_script document.links.length` → **486**
- `extract_links` → `success: true, count: 486, allLen: 486`, hrefs `["#bodyContent", "/wiki/Main_Page", "/wiki/Wikipedia:Contents"]` (matches DOM exactly)
- `extract_images` → `success: true, count: 23`
- `set_cookie {url: .../Web_scraping, name: bhb_test_final1}` → `success: true`
- `get_all_cookies` → total 17, includes test cookie
- `get_cookies { url: .../Web_scraping }` → **count 8, foundTest: true**, names include `bhb_test_final1` + 7 real Wikipedia cookies (WMF-*, GeoIP, enwikimwuser-sessionId)
- `get_cookies { url: https://httpbin.org/anything/page }` (host+path matcher) → `foundHost: true, count 1`

**Pass final2** (independent launch)
- `domLinks 462` == `extract_links.count 462` (success true)
- `extract_images.count 12`
- `get_cookies` url-filtered → count 8, `foundTest: true`; host/path → `foundHost: true`

Link counts differ run-to-run (462 vs 486) only because Wikipedia lazy-loads a variable
number of anchors; in **every** run `extract_links.count` equals the live
`document.links.length`, proving extraction now reads the real `<webview>` DOM.

Process hygiene: each run spawned Electron detached (own process group) and reaped it with
`process.kill(-pid)`; post-run `ps` showed no basset Electron strays; temp files under
`/home/devel/bhb-*` created by this session were removed.

---

## Files changed
- `websocket/server.js` — `getWebviewPageContent()` helper; 8 `extract_*` handlers routed to it; `_sendResponse` serializes full object (`serialize(..., null)`); `get_cookies` override restored after forensic registration. *(extract_* routing and serializer change were the prior agent's; the get_cookies override restore is new in this session.)*
- `cookies/manager.js` — defensive RFC 6265 URL fallback (prior agent's) retained; misleading comment corrected. *(This file turned out not to be the actual get_cookies bug.)*
- `renderer/renderer.js` — `loadURL()`-based `onNavigateWebview`, removed stray completion emit, `onGetWebviewUrl` fallback (prior agent's) — kept and verified.

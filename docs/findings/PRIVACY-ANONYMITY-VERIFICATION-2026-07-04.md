# Privacy / Anonymity Layer — Live Verification (2026-07-04)

**Agent:** security-lead (`privacy-anonymity-verify`)
**Question:** Can this browser browse + capture **anonymously** (Tor/proxy) with fingerprint
control — i.e. is it genuinely *not* a Chrome/Selenium clone — or what's broken?
**Method:** Booted headless (`ELECTRON_RUN_AS_NODE` deleted, isolated OS-assigned WS port,
throwaway `--user-data-dir`, detached process group, reaped on exit). Drove the **live WS
API** (flat JSON) against **real** endpoints. No mocks, no simulations.

**Verdict:** ✅ **The IP-anonymity layer WORKS and is the real differentiator.** Tor and proxy
routing genuinely change the network-observable exit IP, verified end-to-end against
`check.torproject.org` (`IsTor:true`). ⚠️ **Fingerprint/identity control is only partial and
is undermined by one glaring leak: the browsed page advertises an `Electron` +
`basset-hound-browser` User-Agent.** No `proxy/*` code change was required — routing is
correctly wired. The #1 remaining gap is the UA leak (outside this agent's edit zone).

---

## 1. Evidence (all values are live, this run)

Environment: a Tor daemon is already listening on `127.0.0.1:9050` (SOCKS). Direct control
`curl` baseline before touching the browser: real IP `72.35.121.85`; Tor `curl` exit
`80.67.167.81` / `IsTor:true`. So the network substrate is known-good; the test is whether
**the browser** actually uses it.

| # | Step (via WS) | Result | Interpretation |
|---|---|---|---|
| 1 | `navigate` ipify (direct) | `{"ip":"72.35.121.85"}` | **Real exit IP** (matches host) |
| 2 | `tor_enable {socksPort:9050}` | `success`, `proxyRules: socks5://127.0.0.1:9050`, `daemonStatus: reachable` | Routing turned on |
| 2 | `get_tor_routing_status` (after) | `currentProxyRules: "SOCKS5 127.0.0.1:9050"` | **Electron `session.resolveProxy()` confirms the proxy is actually applied** |
| 2 | `navigate` ipify (Tor) | `{"ip":"192.42.116.94"}` | **Exit IP changed ≠ real** |
| 2 | `navigate` check.torproject.org/api/ip | `{"IsTor":true,"IP":"109.70.100.8"}` | **Independent confirmation: traffic is on the Tor network** |
| 2b | `tor_disable` → `navigate` ipify | `{"ip":"72.35.121.85"}` | **Back to real IP** — toggle works both ways |
| 3 | `set_proxy {socks5 127.0.0.1:9050}` → ipify | `{"ip":"147.90.235.227"}` | **`set_proxy` routes session traffic; exit IP changed ≠ real** |
| 3b | `set_proxy {socks5 127.0.0.1:9}` (dead port) → ipify | **empty body / load fails** | **Strongest proof: a bogus proxy BREAKS connectivity → traffic genuinely goes *through* the proxy, not around it.** A "facade" proxy would have leaked the real IP here. |
| 4 | fingerprint probe (`execute_script`) | see §3 | Partial control; UA leak |

(Tor returns different IPs for ipify vs torproject.org because Tor builds a separate circuit
per destination — expected, not a bug. Raw capture: scratchpad `privacy-results.json`.)

### Why this is not a Selenium/ChromeDriver clone
- Anonymity is **built in and driver-controllable at runtime** (`tor_enable`, `set_proxy`,
  `tor_disable`) applied to `session.defaultSession` and inherited by the browsing
  `<webview>`. A stock Selenium/ChromeDriver rig has **no** Tor integration and requires an
  external proxy wrapper to change IP at all.
- The DOM shows **no `cdc_*` properties and no `__webdriver_/__selenium_` props** — the exact
  automation tells that ChromeDriver *injects and* sites fingerprint. That absence is real and
  meaningful.

---

## 2. Mechanism review (proxy/* — this agent's zone)

The routing path is **correctly wired** — no fix needed:

- `set_proxy` / `tor_enable` → `ProxyManager.setProxy()` (`proxy/manager.js:211`) →
  `session.defaultSession.setProxy({proxyRules})` **and** `closeAllConnections()` (so pooled
  keep-alive sockets don't keep using the old route — important for a clean switch), then
  `resolveProxy()` verifies the rule took.
- The browsing surface is a renderer `<webview>` created **without a `partition` attribute**
  (`renderer/renderer.js:92`), so it uses `session.defaultSession` — the same session the
  proxy is applied to. That is why the IP actually changes. This linkage is the crux and it
  holds.
- `tor_enable` (`ProxyManager.enableTorRouting`, `proxy/manager.js:846`) just sets a
  `socks5://host:port` proxy; it does **not** require the embedded daemon — it will route
  through whatever is on 9050. The embedded-Tor bootstrap (`utils/tor-auto-setup.js`,
  binaries present at `bin/tor/tor/tor`) is only needed when no external Tor is running.

**Honest limitation (documented in code, confirmed): dynamic `tor_enable` does NOT give
`.onion` support.** Electron's `--host-resolver-rules` can't be changed post-startup, so
`.onion` name resolution needs `TOR_MODE=1`/`--tor-mode` at launch. Clearnet-through-Tor
anonymity (the case proven above) works fine without it. `.onion` reachability was not
exercised in this run and remains unproven for the dynamic path.

---

## 3. Fingerprint / identity control — partial, one serious leak

Probe run on a live page after load:

```
webdriver:            undefined          ✅ (no automation flag)
cdc_* props:          []                 ✅ (no ChromeDriver tells)
selenium props:       []                 ✅
navigator.plugins:    3 spoofed entries  ✅ (evasion applied: Chrome PDF Plugin/Viewer, Native Client)
navigator.languages:  ["en-US","en"]     ✅ spoofed
navigator.platform:   "Win32"            ⚠️ spoofed, but see UA below
hardwareConcurrency:  16                 ⚠️ real host value, not normalized
WebGL vendor/renderer: null / null       ⚠️ no GPU renderer presented (headless --disable-gpu)
User-Agent:           ...basset-hound-browser/12.8.0 ... Electron/39.8.10 ...   ❌ LEAK
```

`httpbin.org/headers` (what the *server* sees) confirms the same UA on the wire, plus
`Accept-Language: en-US`.

**What's genuinely controlled vs a naked Selenium session:** webdriver flag hidden, no
`cdc_`/selenium DOM props, plugins/languages/platform spoofed. The evasion script *is* being
injected and *is* taking effect (the exact spoofed plugin list and `platform=Win32` prove it).

**What's broken / weak:**
1. **❌ UA leak (critical):** the browsing `<webview>` presents the default Electron UA
   containing `Electron/39.8.10` **and** `basset-hound-browser/12.8.0`. No real Chrome carries
   those tokens — this is an instant, unambiguous automation/self-identification signal at both
   JS and HTTP layers. It defeats the stealth story on its own.
2. **⚠️ Identity incoherence:** `navigator.platform = "Win32"` while the UA says
   `X11; Linux x86_64`. The spoof and the real UA disagree — itself a detection heuristic.
3. **⚠️ Injection timing:** evasion is injected on the `<webview>` **`did-stop-loading`**
   event (`renderer/renderer.js:428`) — i.e. **after** page scripts have already run. My probe
   reads post-load so it sees the patched values, but a detector that samples during initial
   load sees the un-patched ones. (This matches the known "fires too late" finding.)
4. **⚠️ WebGL null / `hardwareConcurrency` real:** headless presents no WebGL renderer and the
   true core count — passive fingerprinting surface, not normalized.

---

## 4. The #1 fix to close the gap

**Strip the `Electron` / `basset-hound-browser` tokens from the User-Agent that the browsed
page presents** (and align it with the spoofed `platform`).

Root cause: `set_user_agent` calls `mainWindow.webContents.setUserAgent()`
(`utils/user-agents.js:281`) — that sets the UA of the **shell window**, not the `<webview>`
guest, and each `webContents` has its own UA. So even calling `set_user_agent` does **not**
change the browsed page's UA; the webview keeps Electron's default.

Fix (small, but **outside this agent's `proxy/*` edit zone** — owner of
`main.js`/`renderer/`/`user-agents.js` should apply):
- Set a realistic UA at the **session** level: `session.defaultSession.setUserAgent(ua)` in
  `main.js` (applies to the webview because it shares `defaultSession`), **or** set the
  `useragent` attribute / `webview.setUserAgent(ua)` when the webview is created in
  `renderer/renderer.js`. `evasion/fingerprint.js:getRealisticUserAgent()` already produces a
  clean Chrome UA — it simply never reaches the guest.
- While there, make `navigator.platform` agree with the UA, and move evasion injection to run
  **before** page scripts (webview `preload`, not `did-stop-loading`).

Secondary (deferred): `.onion` reachability for the dynamic Tor path, WebGL renderer spoof in
headless, `hardwareConcurrency` normalization.

---

## 5. Bottom line

- **Anonymity (IP) layer: PROVEN.** Real `72.35.121.85` → Tor exit (`IsTor:true`) → back to
  real, and `set_proxy` changes the exit IP; a dead proxy breaks connectivity (no leak). This
  is a genuine capability Selenium/ChromeDriver do not ship. `proxy/*` is correctly wired — **no
  code change made** (this was verification).
- **Fingerprint layer: PARTIAL and self-defeating** because the page announces itself as
  Electron/basset-hound in its UA. Until that one leak is fixed, the browser is *anonymous at
  the network layer but trivially identifiable at the application layer*.
- **One-line answer to "are we just a Chrome clone?":** No — we're an Electron browser with
  working built-in Tor/proxy anonymity that Chrome/Selenium lack; but right now we *tell every
  site we're Electron*, so the stealth claim is not yet true. Fix the UA and the gap closes.

_Artifacts: `scratchpad/privacy-drive.js` (driver), `scratchpad/privacy-results.json` (raw
capture). Process group reaped; no strays; no commits._

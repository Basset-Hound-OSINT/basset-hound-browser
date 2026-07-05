---
title: "Bot-Detection Surface Audit: Network / IP / Proxy / WebRTC"
date: 2026-07-03
researcher: Claude (bot-detection research, authorized forensic-tool audit)
status: Complete
category: bot-detection
---

# Network / IP / Proxy / WebRTC Detection Surface

> Scope: how modern anti-bot systems fingerprint the *network layer* (IP reputation /
> ASN, proxy & VPN detection, WebRTC STUN leak, DNS leak, timezone/geo-vs-IP coherence),
> what Basset Hound Browser actually implements against it, and where the gaps are.
>
> **Bottom line up front:** This surface is the one that "dominates everything else," and
> it is the weakest surface in the codebase. The proxy transport layer is solid, but the
> **WebRTC IP leak is completely open** — the module that claims to close it is dead code,
> and no Chromium-level policy is set. A single STUN request from any page exposes the real
> public IP straight past the proxy. Timezone/locale are also not bound to the exit IP, so
> even the proxy that *is* applied is betrayed by a coherence mismatch.

---

## (a) How detectors fingerprint this surface in 2026

Modern anti-bot vendors (Cloudflare Bot Management, DataDome, HUMAN/PerimeterX, Akamai
Bot Manager) treat the network layer as a set of **cross-checked, independently-sourced
signals**. The core idea is *coherence*: any single spoofed value is cheap, but making a
dozen independently-derived values all agree is expensive. The network checks are:

1. **IP reputation & ASN classification.** The connecting IP is looked up against ASN
   databases and threat feeds. Datacenter ASNs are flagged on sight — AWS (AS16509),
   GCP (AS15169), Azure (AS8075), DigitalOcean, OVH, Hetzner. Residential/ISP ASNs and
   mobile-carrier ASNs (CGNAT ranges) score far better. Through 2025-2026 Cloudflare
   tightened ASN-level scoring to the point that *residential* proxy success rates dropped
   sharply while *mobile* carrier IPs held, because mobile CGNAT pools are shared by real
   humans and can't be cheaply blocklisted.

2. **Proxy / VPN detection.** Beyond ASN, detectors look for: open proxy ports, known
   proxy/VPN IP lists, MTU/TTL anomalies, TCP timestamp skew, and the mismatch between a
   "residential" IP and datacenter-grade latency/jitter. A residential IP fronting a
   datacenter backhaul still smells like a proxy.

3. **WebRTC STUN/ICE leak.** JavaScript creates an `RTCPeerConnection`, adds a STUN
   server, and reads the ICE candidates. This is *out-of-band of the HTTP proxy*: WebRTC
   uses its own UDP sockets bound to the host's real network interfaces. Candidates reveal:
   - `typ srflx` (server-reflexive): the **real public IP** as seen by the STUN server —
     which is the host's true egress, *not* the HTTP/SOCKS proxy's IP.
   - `typ host`: the **real local/LAN IP** (since Chrome 74, host candidates are normally
     mDNS-obfuscated to a random `<uuid>.local`, but antidetect browsers that get this
     wrong stand out).
   - IPv6 host candidates: the real global IPv6 if the host has native v6.
   The killer check: *if the HTTP layer says "US residential proxy" but WebRTC srflx says
   a Pakistani datacenter IP, the session is flagged instantly.* WebRTC is specifically
   used as ground-truth to unmask proxies.

4. **DNS leak.** The resolver that actually answers the page's DNS (or `dns-prefetch`,
   or WebRTC's own resolution) is geolocated. A US proxy whose DNS resolves via the host's
   ISP resolver in another country is a leak. `webrtc` mDNS resolution and `dns-prefetch`
   are common leak vectors even when page traffic is proxied.

5. **Timezone / geo / locale vs IP coherence.** The single most reliable cheap check. The
   detector runs a coherence test across: **IP-geolocated country ⇄ JS timezone
   (`Intl.DateTimeFormat().resolvedOptions().timeZone` + `Date.getTimezoneOffset`) ⇄
   `Accept-Language` / `navigator.languages` ⇄ `navigator.geolocation` ⇄ WebRTC candidate
   region ⇄ DNS resolver region.** A US exit IP with `America/New_York` timezone,
   `en-US` language, and a New York geolocation is coherent. A US exit IP with a random
   `Asia/Tokyo` timezone and `en-US` language is an automation tell. Because these values
   come from independent APIs, they must all be **derived from the same exit IP** to agree.

6. **ICE behavioural tells.** Relay-only candidates when a direct path should exist,
   missing mDNS host candidates, abnormal ICE candidate ordering, or an `RTCPeerConnection`
   whose methods are monkey-patched (detectable via `toString()` / prototype checks).

**Key takeaway for this tool:** proxy type (residential/mobile) fixes signal #1 only.
Signals #3 (WebRTC) and #5 (coherence) will unmask a perfectly good proxy, and they are
exactly the two signals Basset Hound does not close.

---

## (b) What Basset Hound currently does — with file citations

### Proxy transport (this part is genuinely OK)

- **`proxy/manager.js`** supports HTTP / HTTPS / SOCKS4 / SOCKS5 / Tor
  (`PROXY_TYPES`, `proxy/manager.js:21-29`). `setProxy()` builds proxy rules
  (`getProxyRules`, `proxy/manager.js:180-205`) and applies them to the Chromium session
  via `session.defaultSession.setProxy({ proxyRules, proxyBypassRules })`
  (`proxy/manager.js:228-231`), then closes existing connections
  (`proxy/manager.js:236-237`) and verifies with `resolveProxy()` (`proxy/manager.js:242-244`).
- **The proxy actually applies to browsing.** The page loads inside a `<webview>` created
  with no `partition` attribute (`renderer/renderer.js:88-93`), so the webview shares
  `session.defaultSession` — the same session the proxy is set on. (Good: a partitioned
  webview would have silently bypassed the proxy.)
- **SOCKS5 DNS** is proxy-side by design; the code deliberately avoids `socks5h://` and
  relies on Chromium routing SOCKS5 hostname resolution through the proxy
  (`proxy/manager.js:193-199` and comment). Reasonable.
- **Rotation / list / failover** exist: `setProxyList` (`proxy/manager.js:353`),
  `rotateProxy` (`proxy/manager.js:457`), failover on error (`proxy/manager.js:627-647`).
- **Tor mode is the one path that actually hardens DNS/leaks.** `configureTorMode()`
  sets `--proxy-server=socks5://…` (`src/main/main.js:717`), forces all DNS through the
  proxy with `--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE <host>`
  (`src/main/main.js:722`), and disables prefetch with `--dns-prefetch-disable`
  (`src/main/main.js:727`). This is correct and effective — **but only in Tor mode.**

### WebRTC "evasion" (claims coverage; delivers nothing at runtime)

- **`src/evasion/webrtc-evasion.js`** exposes `mdnsObfuscation`, `localIPFiltering`,
  `candidateTypeFiltering`, `relayCandidatePreference`, `applyCombinedTechniques`, and
  advertises "75-85%" effectiveness (`src/evasion/webrtc-evasion.js:262, 313-320`).
  **It is dead code.** Grep shows it is imported only by
  `tests/evasion/advanced-evasion.test.js:8` and named in an integration test config —
  **never by `main.js`, the preload, the websocket server, or any renderer path.**
- Even if it were wired in, it cannot work as written: every method takes an array of
  candidate **strings** in `context.candidates` and returns a filtered array
  (`src/evasion/webrtc-evasion.js:191-230`). It never touches `RTCPeerConnection`, never
  registers an `icecandidate` handler, and nothing in the codebase feeds it live
  candidates. `relayCandidatePreference` claims "Ensures all traffic routes through TURN
  relay" (`:184`) but there is no TURN server anywhere — it just reorders strings.
  `connectionStateManagement` returns a hard-coded fake state object (`:144-158`) attached
  to nothing.
- **No Chromium-level WebRTC policy is set anywhere.** Grep for
  `setWebRTCIPHandlingPolicy` and `force-webrtc-ip-handling-policy` across the repo
  returns **zero hits**. Chromium therefore runs `webRTCIPHandlingPolicy = default`, which
  binds WebRTC to the real default-route interface and leaks the real public IP via STUN.
- **The injected page scripts contain no WebRTC handling.** The auto-injected preload
  evasion script (`src/preload/preload.js:894-965`, wired at `renderer/renderer.js:33-34,
  486-490`) overrides `navigator.webdriver`, `plugins`, `languages`, `platform`,
  `permissions.query`, and `window.chrome` — **but not `RTCPeerConnection`.** The richer
  fingerprint script `getEvasionScript()` in `evasion/fingerprint.js` also has **zero**
  WebRTC code (grep for `webrtc|RTCPeerConnection|iceServers` in that file is empty).

### `evasion/ip-redaction.js` (name over-promises)

- `IPRedactionManager.redactWebRTC` / `redactCandidate` / `redactFingerprint`
  (`evasion/ip-redaction.js:73-126`) mask IPv4/IPv6 inside a **fingerprint object that
  Basset Hound has already captured**. This is *output sanitisation of the tool's own
  forensic records* — it runs after the data is collected and does nothing to the outbound
  WebRTC stack the target site sees.
- It is used **only** in `tests/unit/ip-redaction.test.js` and a docs example
  (`docs/SECURITY-INTEGRATION-EXAMPLE.js:16, 61, 228`). Grep for production usage returns
  nothing. Despite the module name, it provides **zero** WebRTC-leak prevention against a
  detector.

### Timezone / geo / locale coherence (not bound to the exit IP)

- **Timezone is randomised independently of the proxy.** `getEvasionScript()` picks
  `timezone = TIMEZONES[random]` (`evasion/fingerprint.js:108`) and overrides
  `Date.prototype.getTimezoneOffset` (`:341-343`) and
  `Intl.DateTimeFormat().resolvedOptions().timeZone` (`:347-357`) to that random value.
  There is no linkage to the proxy exit IP's country — so an exit IP in one country will
  frequently report a timezone from another. Classic coherence-mismatch tell.
- **The default browsing path doesn't spoof timezone at all.** The webview auto-injects
  only the preload script (`renderer/renderer.js:33-34`), which has no timezone override,
  so unless an agent explicitly injects `getEvasionScript()`, the page reports the *host
  machine's* real timezone — also unrelated to the proxy.
- **`Accept-Language` is a static default** `en-US,en;q=0.9` (`src/main/main.js:801`),
  regardless of proxy country.
- **`src/evasion/geolocation-spoofer.js`** has city presets carrying timezone+country
  (`:26-35`) and a `timezoneAwareSpoofing` mode (`:155-171`), but it is command-driven,
  not auto-applied, and not derived from the exit IP. `navigator.geolocation`, timezone,
  `Accept-Language`, and proxy country are four independently-set knobs with no single
  source of truth tying them to the exit IP.
- **`src/evasion/coherence-validators.js`** validates geolocation *travel speed* and
  *country change* across a session's history (`:108-190`), but does **not** check
  timezone-vs-IP or Accept-Language-vs-IP, and it is a *validator* (it grades data) rather
  than an *enforcer* that sets values from the exit IP.

### IP reputation / ASN (a scoring engine with no data source)

- **`src/proxy/provider-detector.js`** and **`src/proxy/proxy-intelligence.js`** can
  classify residential / datacenter / mobile / VPN and score ASN reputation
  (`provider-detector.js:148-160, 241-266`) — but purely from signals **passed in**
  (`additionalSignals.whoisData`, `additionalSignals.asn`). Grep for any HTTP/DNS/whois
  client in `provider-detector.js` returns nothing: **there is no live lookup.** Nothing in
  the runtime path collects the current exit IP's real ASN, so the classifier is never fed
  and the tool never actually verifies whether its own exit IP is a flagged datacenter ASN.
- **No mobile transport type.** `PROXY_TYPES` (`proxy/manager.js:21-29`) has no `mobile`;
  "mobile" appears only as a partner *feature label*
  (`src/proxy/partner-integration-manager.js:54`). The tool can point at a mobile proxy's
  host:port, but it does nothing to prefer/verify mobile ASNs — which the 2026 research
  says are now the highest-value exit type.

---

## (c) Gaps, ranked by severity (what a real detector would catch)

### 1. CRITICAL — WebRTC public-IP leak is completely open
No `setWebRTCIPHandlingPolicy` / `--force-webrtc-ip-handling-policy` anywhere; no
`RTCPeerConnection` patch in preload or `getEvasionScript()`; the one module that claims to
handle it (`src/evasion/webrtc-evasion.js`) is unwired dead code that only filters strings.
**Consequence:** any page that instantiates `RTCPeerConnection` with a public STUN server
reads a `typ srflx` candidate containing the host's **real public egress IP**, bypassing
whatever HTTP/SOCKS proxy is set. This is the exact "US proxy but WebRTC says the real IP"
check every major vendor runs. *This is the single most likely thing to get the tool blocked.*

### 2. CRITICAL/HIGH — Timezone, locale, and geo are not bound to the exit IP
`evasion/fingerprint.js:108` randomises timezone with no relation to the proxy country;
`Accept-Language` is hard-coded `en-US` (`main.js:801`); geolocation is a separate manual
knob. Even when the proxy IP is clean, the IP⇄timezone⇄language coherence check fails.
Worse, the default browsing path injects no timezone spoof at all, leaking the host's real
timezone.

### 3. HIGH — No live IP reputation / ASN self-verification
`provider-detector.js` / `proxy-intelligence.js` are scoring engines with no data source
wired (`provider-detector.js:148-160`, no network client). The tool cannot tell at runtime
whether its current exit IP is a flagged datacenter ASN (AWS/GCP/Azure/OVH). Combined with
no mobile transport type, it can't lean into the 2026 "mobile IPs slip through" reality.

### 4. HIGH — IPv6 WebRTC / traffic leak unhandled
No IPv6 candidate suppression and no `--disable-ipv6`. On a dual-stack host with an
IPv4-only proxy, WebRTC IPv6 host candidates and native IPv6 traffic egress directly,
exposing the real IPv6 /64. This defeats the proxy independently of the srflx leak.

### 5. MEDIUM — DNS-leak hardening exists only in Tor mode
`--host-resolver-rules` + `--dns-prefetch-disable` are set only under `configureTorMode()`
(`main.js:722-727`). On the ordinary runtime proxy path they are absent: SOCKS5/HTTP
proxy-side DNS covers most page lookups, but `dns-prefetch` is left enabled and WebRTC's
own resolution is uncontrolled, leaving residual DNS-region leaks.

### 6. MEDIUM — `ip-redaction.js` is mislabeled and unwired
The module name promises WebRTC-leak prevention; it only masks IPs in the tool's *already
captured* forensic output (`ip-redaction.js:73-126`), and is used only in tests/docs. It
contributes nothing to outbound leak prevention and creates a false sense of coverage in
status docs.

---

## (d) Concrete remediation recommendations

**Fix #1 (closes the top leak) — force WebRTC through the proxy at the Chromium level.**
Add, before `app.whenReady()` (alongside the other switches near `src/main/main.js:758`):
```js
app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp');
```
and/or, per session/webContents once available:
```js
mainWindow.webContents.session.setWebRTCIPHandlingPolicy?.('disable_non_proxied_udp');
// (Electron exposes it on webContents in current versions:)
webContents.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');
```
`disable_non_proxied_udp` makes WebRTC use only the proxied path, so `srflx` reflects the
proxy — not the host. This one change removes the flagship unmasking vector. Delete or
rewire `src/evasion/webrtc-evasion.js` so status docs stop claiming coverage it doesn't have.

**Fix #2 — belt-and-suspenders `RTCPeerConnection` shim in the injected script.** In the
preload evasion script (`src/preload/preload.js:894`) *and* `getEvasionScript()`, wrap
`RTCPeerConnection` so `.createDataChannel`/`.createOffer` still work but ICE candidates
with `typ host`/`typ srflx` carrying non-proxy IPs are dropped or rewritten — implemented
with a native-looking `toString()` to survive prototype/tamper checks. (Prefer Fix #1 as
primary; a badly-done JS shim is itself a tell.)

**Fix #3 — derive timezone / locale / geolocation from the exit IP, from one source.**
On every `setProxy`/rotation, geolocate the exit IP (offline MaxMind GeoLite2 ASN+City DB
shipped with the tool is enough and avoids a network tell) and set, atomically:
`Intl`/`Date` timezone, `navigator.languages` + `Accept-Language`, and
`navigator.geolocation` all from that one geolocation. Replace the random pick at
`evasion/fingerprint.js:108` with the exit-IP-derived timezone, and stop hard-coding
`en-US` at `main.js:801`.

**Fix #4 — wire real ASN/reputation into the proxy path.** Feed `provider-detector.js`
from the same offline MaxMind ASN DB at `setProxy` time; refuse or warn on datacenter ASNs
(AS16509/AS15169/AS8075/OVH/Hetzner…). Add a first-class `mobile` proxy type and prefer
mobile/residential ASNs for high-friction targets.

**Fix #5 — extend DNS/IPv6 hardening beyond Tor mode.** Apply `--dns-prefetch-disable`
generally, and add `--disable-ipv6` (or IPv6 ICE suppression) whenever the active proxy is
IPv4-only, so IPv6 can't egress around the proxy.

**Fix #6 — add a self-test command.** A `network-leak-selftest` WebSocket command that
loads a browserleaks-style STUN probe through the current proxy and asserts srflx == proxy
IP, timezone country == IP country, and no IPv6 candidate. This turns "we're covered" from
an assumption into a measured, CI-gated fact.

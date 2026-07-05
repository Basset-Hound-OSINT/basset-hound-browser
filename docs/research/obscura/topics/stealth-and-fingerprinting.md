---
title: "Obscura Deep-Dive: Stealth & Anti-Detection / Fingerprinting"
date: 2026-07-03
researcher: Claude (Basset Hound repo-research agent)
status: Complete
category: reverse-engineering / stealth-and-fingerprinting
---

# Obscura: Stealth & Fingerprinting

Reverse-engineering notes on every stealth / anti-detection mechanism in the
Apache-2.0 headless browser **Obscura** (`/home/devel/tmp/obscura`, git
`ca71ce3`). Scope: TLS fingerprint posture, tracker/ad blocking, user-agent
handling, HTTP header ordering, and the JS-layer fingerprint shims — plus a
precise accounting of what Obscura *does not* do.

---

## 0. TL;DR

Obscura's stealth story is deliberately modest and split across **two tiers**
that are gated behind a single opt-in Cargo feature, `stealth`:

1. **Network tier (TLS + headers + tracker blocking).** Only present when the
   binary is compiled `--features stealth` *and* `--stealth` is passed at
   runtime. It swaps the default `reqwest`/`rustls` HTTP client for a
   [`wreq`](https://crates.io/crates/wreq) client that emulates Chrome 145's
   BoringSSL ClientHello, ALPN, cipher order, and HTTP/2 header order, and it
   turns on a ~3,520-domain tracker blocklist. Source:
   `crates/obscura-net/src/wreq_client.rs`.
2. **JS tier (fingerprint surface).** A large hand-written shim layer in
   `crates/obscura-js/js/bootstrap.js` (7,878 lines) that fakes `navigator`,
   `navigator.webdriver`, `userAgentData`/client hints, WebGL renderer strings,
   a software canvas rasterizer with per-session noise, WebAudio, Battery,
   plugins, geolocation, `window.chrome`, etc. **This tier is always on** —
   it is not gated behind `--stealth`; the browser runtime has no "real" DOM to
   fall back to, so these shims *are* the browser.

The project is honest about its ceiling. `docs/Configure-stealth-and-proxies.md`
lines 29-34 explicitly disclaim Cloudflare interactive challenges, Datadome,
Akamai bot manager active challenges, CAPTCHAs, and IP-rate-limiting.

The single most important structural gap: **without the `stealth` feature the
HTTP client is plain `reqwest` over `rustls`, whose ClientHello/JA3/JA4 does not
resemble Chrome at all** (`Cargo.toml:39`), while the JS layer *still* claims to
be Chrome. That TLS-vs-JS contradiction is exactly the kind of cross-surface
mismatch modern bot managers key on, and it is the default build/run posture.

---

## 1. Feature gating: how stealth is turned on

`stealth` is an opt-in Cargo feature that fans out across the whole workspace:

- `crates/obscura-net/Cargo.toml:8` — `stealth = ["wreq", "wreq-util"]`
- `crates/obscura-js/Cargo.toml:11` — `stealth = ["obscura-net/stealth"]`
- `crates/obscura-browser/Cargo.toml:8` — `stealth = ["obscura-net/stealth", "obscura-js/stealth"]`
- `crates/obscura-mcp/Cargo.toml:8` and `crates/obscura-cli/Cargo.toml:16` — fan the feature down.

The wreq crates are **pinned to exact pre-release versions** because their API
churns between rc builds; `crates/obscura-net/Cargo.toml:31` pins
`wreq-util = "=3.0.0-rc.12"` and lines 35-40 pin `wreq = "=6.0.0-rc.29"`. Note a
platform quirk: the `prefix-symbols` BoringSSL feature is only enabled on Linux
/ Android (`Cargo.toml:34-40`), because it produces link errors elsewhere
(issue #39).

`docs/Configure-stealth-and-proxies.md:18-22` confirms you must build with
`--features stealth` (release binaries ship it) and that `--stealth` is a global
CLI flag inherited by `fetch`, `serve`, `scrape`, and `mcp`.

Two independent enable points must both be true for network-tier stealth:
- **compile time** — the `stealth` feature (else `wreq_client.rs` is `#[cfg]`-ed
  out entirely; the whole file is wrapped in `#[cfg(feature = "stealth")]`).
- **run time** — `--stealth`, which sets `BrowserContext.stealth = true` and, at
  `crates/obscura-browser/src/context.rs:106-108`, flips `client.block_trackers`
  and later constructs a `StealthHttpClient`.

---

## 2. TLS fingerprint posture

### 2.1 Stealth path: wreq Chrome-145 emulation

`crates/obscura-net/src/wreq_client.rs:49-66` builds the stealth client:

```rust
let emulation_opts = wreq_util::Emulation::builder()
    .profile(wreq_util::Profile::Chrome145)
    .platform(wreq_util::Platform::Windows)
    .build();

let mut builder = wreq::Client::builder()
    .emulation(emulation_opts)
    .timeout(Duration::from_secs(30))
    .redirect(wreq::redirect::Policy::none());
```

Everything about the fingerprint — ClientHello, ALPN, cipher/extension order,
HTTP/2 SETTINGS and header order — is delegated to `wreq`'s `Chrome145` emulation
profile. Obscura writes **no** manual TLS/JA3 configuration of its own; a repo
grep for `ANGLE|Direct3D|Metal|JA3|ClientHello` finds nothing hand-rolled on the
Rust side. The profile is **hardcoded to Chrome 145 on Windows** and does not
vary with the `OBSCURA_PROFILE` pool (see §4.2 — this is an intentional
consistency choice, not a bug).

`docs/Configure-stealth-and-proxies.md:14` summarizes the wire posture: "Uses
the wreq HTTP client with browser-matching TLS fingerprints (ClientHello, ALPN,
cipher order)."

### 2.2 Non-stealth path: reqwest over rustls (the honest baseline)

The default client is `ObscuraHttpClient` in `crates/obscura-net/src/client.rs`.
Its builder (`client.rs:352-369`) is plain `reqwest::Client::builder()` with
`redirect(Policy::none())`, a 30s timeout, and a custom SSRF DNS resolver — **no
TLS emulation at all**. `Cargo.toml:39` pins reqwest to the `rustls-tls`
backend:

```toml
reqwest = { version = "0.12", features = ["gzip", "brotli", "deflate", "rustls-tls", "socks"], default-features = false }
```

Consequence: the default ClientHello is rustls's, which is trivially
distinguishable from Chrome's BoringSSL ClientHello. So a default `obscura fetch`
sends a rustls TLS fingerprint while the *JS layer it later runs* claims to be
Chrome — a self-contradiction on any site that checks both.

### 2.3 The webpki-roots nuance

`docs/Configure-stealth-and-proxies.md:16` frames "Bundles webpki roots instead
of relying on the system store" as a stealth behavior. In practice the
`rustls-tls` reqwest feature (`Cargo.toml:39`) bundles webpki roots for the
**non-stealth path too** — root-store bundling is a property of the rustls
backend, not something stealth adds. The doc's framing overstates the
distinction.

### 2.4 JS-initiated requests (`fetch()` / XHR) also get the Chrome fingerprint

A subtle but important detail: scripted `fetch()`/XHR inside a page go through
`op_fetch_url` in `crates/obscura-js/src/ops.rs`. In stealth mode those are
re-routed through the same `StealthHttpClient` so they carry the Chrome TLS
fingerprint + client hints instead of the rustls ClientHello `op_fetch_url`
would otherwise emit (`ops.rs:779-794`, calling `stealth_fetch_all` at
`ops.rs:1082`). The rationale is spelled out at
`wreq_client.rs:157-163`: some bot managers (the comment names the AWS WAF
challenge verify call) read a script-issued rustls ClientHello as non-browser
and reject it. Without the stealth feature, JS fetch keeps using the rustls
`op_fetch_url` path.

---

## 3. Tracker / ad blocking

### 3.1 The list

`crates/obscura-net/src/blocklist.rs:5` embeds a domain list at compile time:

```rust
const PGL_LIST: &str = include_str!("pgl_domains.txt");
```

`crates/obscura-net/src/pgl_domains.txt` is **3,520 lines** of bare domains
(one per line, `#` comments allowed). "PGL" = Peter Lowe's / pgl.yoyo.org
ad-and-tracking blocklist. It contains the usual analytics/ad endpoints:
`google-analytics.com`, `doubleclick.net`, `criteo.com`, `adnxs.com`,
`hotjar.com`, `mixpanel.com`, `fullstory.com`, etc. `EXTRA_DOMAINS`
(`blocklist.rs:42`) is an empty extension hook (`static EXTRA_DOMAINS: &[&str] = &[];`).

### 3.2 Matching semantics

`blocklist.rs:24-40` `is_blocked(host)`:

- exact host match against the `HashSet`, then
- **suffix walk** — strip one leading label at a time and re-test, so
  `www.google-analytics.com` and `ssl.google-analytics.com` both match
  `google-analytics.com` (tests at `blocklist.rs:54-58`).

This is a **domain-suffix denylist, not a URL/path filter and not a real
adblock-syntax engine** (no EasyList cosmetic rules, no regex, no
element hiding). It is a pure host check.

### 3.3 Where blocking is enforced — and where it is not

- **Stealth navigation** (`wreq_client.rs:79-90`) and **stealth JS fetch**
  (`wreq_client.rs:171-182`) both call `blocklist::is_blocked` and, on a hit,
  synthesize a fake `Response { status: 0, body: [] }` instead of dialing out.
- **Non-stealth navigation** only checks the blocklist when
  `self.block_trackers` is true (`client.rs:402-415`). And `block_trackers` is
  set **only** in stealth mode (`context.rs:106-108`). Its default is `false`
  (`client.rs:347`).

**Gap:** in the default (non-stealth) build/run, tracker blocking is entirely
off. Blocking and TLS emulation are coupled to the same `--stealth` switch;
there is no way to block trackers without also opting into wreq, or vice-versa.

### 3.4 Separate, user-driven request interception

Independent of the tracker list, the non-stealth client supports a
`RequestInterceptor` trait (`crates/obscura-net/src/interceptor.rs:5-13`) with
actions `Continue | Block | Fulfill(Response) | ModifyHeaders(map)`, wired in at
`client.rs:429-443`. This is the mechanism behind CDP `Network.setBlockedURLs` /
`Fetch` domain and the "Intercept and modify requests" doc — an explicit,
caller-programmed block/modify path, distinct from the built-in tracker denylist.

---

## 4. User-Agent handling & browser profiles

### 4.1 The profile pool

`crates/obscura-browser/src/profiles.rs:8-57` defines a **static pool of 8
`BrowserProfile`s**: 4 Windows + 4 macOS, Chrome 143-146. Each profile ties four
surfaces together so they cannot disagree:

```rust
pub struct BrowserProfile {
    pub user_agent: &'static str,
    pub platform: &'static str,          // navigator.platform, e.g. "Win32" / "MacIntel"
    pub ua_platform: &'static str,       // userAgentData.platform, "Windows" / "macOS"
    pub ua_platform_version: &'static str,
}
```

There are **no Linux and no mobile profiles** in the pool, and every entry is
recent-Chrome desktop only.

### 4.2 Selection & rotation policy

`profiles.rs:76-91` `select_profile()`:

- default → `PROFILES[0]` (a **single stable identity**),
- `OBSCURA_PROFILE=<idx>` → pin one profile by index,
- `OBSCURA_ROTATE_PROFILE=1` → `random_profile()` per browser context.

The design comment (`profiles.rs:68-75`) states the reasoning explicitly:
rotation is **opt-in** because one IP cycling through identities is itself a bot
signal, and a rotated profile "does not yet carry a matching TLS or timezone
fingerprint." `random_profile()` (`profiles.rs:59-66`) seeds off
`SystemTime::now().subsec_nanos() % len` — a weak, non-cryptographic picker, but
adequate for this purpose.

### 4.3 The stealth override — profiles are bypassed on the wire in stealth mode

This is the key consistency subtlety. In **stealth** mode, the JS navigator
identity is *not* taken from the selected profile; it is pinned to fixed
constants that match the wreq Chrome-145/Windows emulation
(`crates/obscura-browser/src/page.rs:285-293`):

```rust
if self.stealth_client.is_some() {
    rt.set_stealth(true);
    rt.set_user_agent(obscura_net::STEALTH_USER_AGENT);
    rt.set_platform(
        obscura_net::STEALTH_NAVIGATOR_PLATFORM, // "Win32"
        obscura_net::STEALTH_UA_PLATFORM,        // "Windows"
        obscura_net::STEALTH_UA_PLATFORM_VERSION,// "15.0.0"
    );
}
```

The constants live at `wreq_client.rs:21-33`: UA = Chrome 145 Windows,
`Win32` / `Windows` / `15.0.0`. The comment at `wreq_client.rs:24-27` is the
governing principle: "navigator has to report the same identity, otherwise the
TLS/HTTP layer and the JS layer disagree and a site cross-checks the mismatch as
a bot signal." So **`OBSCURA_PROFILE` / `OBSCURA_ROTATE_PROFILE` affect the
non-stealth navigator identity but are effectively overridden by the fixed
Chrome-145 identity when stealth is active.** The 8-profile pool is really a
non-stealth feature.

### 4.4 Non-stealth UA default & client hints

Non-stealth default UA (`client.rs:338-340`) is a **Linux** Chrome 145 string
(`X11; Linux x86_64`), while the profile pool default (`PROFILES[0]`) is a
**Windows** string — the context constructor overrides the client UA from the
profile at `context.rs:110-119`, so navigation actually uses the Windows profile
UA. `chrome_client_hints()` (`client.rs:280-314`) then **derives** `sec-ch-ua`
and `sec-ch-ua-platform` from that UA using Chromium's per-major-version GREASE
algorithm (the brand permutation table at `client.rs:287-300`), so the HTTP
client hints agree with `navigator.userAgentData` rather than shipping a fixed
token. The JS side re-implements the identical GREASE algorithm at
`bootstrap.js:2808-2829` (`_uaBrands()`), citing
`components/embedder_support/user_agent_utils.cc`.

---

## 5. HTTP header construction & ordering

### 5.1 Stealth: delegated to wreq

The `StealthHttpClient` request builders (`wreq_client.rs:94-104`,
`164-201`) add only `Cookie` and any caller `extra_headers`; **the full Chrome
header set and its ordering come from wreq's emulation**, which is the entire
point of using it.

### 5.2 Non-stealth: hand-built Chrome-order HeaderMap, with a caveat

`client.rs:451-481` builds a `HeaderMap` in Chrome's top-level-navigation order:
`sec-ch-ua`, `sec-ch-ua-mobile: ?0`, `sec-ch-ua-platform`,
`upgrade-insecure-requests: 1`, `User-Agent`, `Accept`
(`text/html,...avif,webp,apng,...`), `sec-fetch-site: none`,
`sec-fetch-mode: navigate`, `sec-fetch-user: ?1`, `sec-fetch-dest: document`,
`accept-language: en-US,en;q=0.9`.

The code's **own comment admits the ordering is imperfect**
(`client.rs:452-454`): "reqwest appends accept-encoding/host after these, so
accept-encoding lands after accept-language rather than before it." More broadly,
`reqwest` sends HTTPS over HTTP/2 (via ALPN), where header casing/ordering and
HPACK are governed by `reqwest`/`h2`, not by this `HeaderMap` insertion order —
so the carefully chosen order is not guaranteed to reach the wire as Chrome would
emit it. This is precisely why the stealth path exists.

### 5.3 Hardcoded Accept-Language regardless of locale/timezone

`accept-language` is a static `en-US,en;q=0.9` (`client.rs:478-481`) and
`navigator.language` is `"en-US"` (`bootstrap.js:2834`). Setting
`OBSCURA_TIMEZONE=Asia/Tokyo` therefore yields a Tokyo clock with an `en-US`
Accept-Language and `en-US` navigator language — a mild but real cross-surface
inconsistency the code does not reconcile.

---

## 6. JS-layer fingerprint surface (`bootstrap.js`)

`crates/obscura-js/js/bootstrap.js` is the runtime's DOM/BOM. Because Obscura is
not a real browser engine, these shims are the fingerprint surface. **They run
regardless of `--stealth`** — a few values tighten under stealth (see §6.7).

### 6.1 Seeded per-session fingerprint (`_fpRand` / `_fpNoise` / `_getFp`)

All randomized fingerprint values derive from a single session seed `_fpSeed`.
It is `0` at snapshot-build time (`bootstrap.js:103`) and re-seeded per page in
`__obscura_init` (`bootstrap.js:7356`):

```js
_fpSeed = Date.now() ^ (Math.random() * 0xFFFFFFFF >>> 0);
_fpCache = null;
```

`_getFp()` (`bootstrap.js:155-223`) lazily computes and caches a per-session
`{ gpu, gpuVendor, audioBaseLatency, audioSampleRate, comp*, batteryLevel,
batteryCharging, screen, canvasFingerprint }` bundle. Because it is reseeded on
every navigation, the fingerprint is **stable within a page load but changes
between navigations** — itself potentially detectable if a site correlates
across page loads.

### 6.2 WebGL renderer spoofing (matches the profile's OS)

`_getFp()` selects a GPU string from an OS-conditioned pool
(`bootstrap.js:160-203`): macOS → Apple/Intel "ANGLE Metal Renderer" strings;
Linux → Mesa "OpenGL 4.6" strings; else (Windows) → "Direct3D11 ... D3D11"
strings. The WebGL context shim returns these via
`WEBGL_debug_renderer_info` (`bootstrap.js:5982-5987`): `UNMASKED_VENDOR_WEBGL`
(0x9245) → `gpuVendor`, `UNMASKED_RENDERER_WEBGL` (0x9246) → `gpu`. This is the
"Windows profiles report ANGLE Direct3D11, macOS report ANGLE Metal" behavior
promised in `docs/Configure-stealth-and-proxies.md:68`.

**Major gap — WebGL is a hollow stub, not a renderer.** The `webgl`/`webgl2`
context object (`bootstrap.js:5971-6016`) is a bag of no-op methods:
`drawArrays()`, `clear()`, `texImage2D()`, `linkProgram()` etc. all do nothing,
`getParameter` returns constants, and `readPixels` fills the buffer with
`Math.random()` bytes (`bootstrap.js:6011`). So any WebGL *rendering*
fingerprint (draw → `readPixels`/`toDataURL` → hash, the standard technique)
produces **non-deterministic garbage that changes every call** and cannot match
a real GPU. The renderer *strings* are convincing; the actual pixel output is
not, and its per-call randomness is a tell.

### 6.3 Canvas fingerprinting — software rasterizer + per-session noise

There is no GPU canvas; `_Canvas2D` (`bootstrap.js:5755-…`) is a pure-JS
software rasterizer over a `Uint8ClampedArray`. Two anti-fingerprint mechanisms:

- The backing buffer is pre-filled with per-session, per-pixel noise via
  `_fpNoise` (`bootstrap.js:5761-5766`), so `getImageData` (`bootstrap.js:5866`)
  reads back subtly perturbed pixels.
- `toDataURL` (`bootstrap.js:6020-6026`) PNG-encodes the noisy buffer if the
  canvas was drawn to, else returns a static per-session `canvasFingerprint`
  data URL from `_getFp()`.

**Gap:** text rendering is a crude ~6px fixed-width bitmap approximation
(`fillText`/`measureText` at `bootstrap.js:~5850-5864` advance a fixed
`6 * scale` px per char), nothing like real Chrome font rasterization. A site
that compares a canvas-rendered string against known-Chrome hashes will not get
a Chrome-shaped result — the noise defends against *stable* fingerprinting but
the underlying glyphs are wrong.

### 6.4 `navigator` object & `navigator.webdriver`

`globalThis.navigator` (`bootstrap.js:2831-2941`) is a hand-built object:
`userAgent`/`platform` proxy to the Rust-injected `__obscura_ua` /
`__obscura_platform` globals; `vendor: "Google Inc."`, `productSub: "20030107"`,
a realistic PDF-viewer `plugins`/`mimeTypes` set (`bootstrap.js:2842-2856`),
`connection` (NetworkInformation), `mediaDevices.enumerateDevices` returning
plausible default audio/video devices, and a `permissions.query` that returns
`prompt` (not `granted`) for camera/microphone/geolocation/notifications — the
comment at `bootstrap.js:2895-2896` notes returning `granted` there is a bot
tell.

`navigator.webdriver` is handled carefully (`bootstrap.js:2943-2953`): a
`false`-returning getter is placed on a thin prototype derived from
`Navigator.prototype`, so `Object.getOwnPropertyDescriptor(navigator,
'webdriver')` returns `undefined` (matching real Chrome, where the prop lives on
the prototype) while `navigator instanceof Navigator` still holds.

`window.chrome` is faked (`bootstrap.js:2955-…`) with `app`, `runtime` (whose
`connect`/`sendMessage` throw the exact "Receiving end does not exist" error),
`csi()`, and `loadTimes()`.

### 6.5 Client hints (`userAgentData`)

`userAgentData` (`bootstrap.js:2857-2877`) exposes `brands` and
`getHighEntropyValues` computed from the shared GREASE algorithm and the injected
platform globals — `architecture: "x86"`, `bitness: "64"`, platform/version from
`__obscura_ua_platform*`. Fully consistent with the HTTP-layer `sec-ch-ua`
derivation (§4.4).

### 6.6 Audio, Battery, geolocation, screen, timezone

- **WebAudio:** `_getFp()` fixes `audioBaseLatency`, `audioSampleRate`
  (44100/48000), and DynamicsCompressor `threshold/knee/ratio`
  (`bootstrap.js:212-216`) — a per-session-stable audio fingerprint.
- **Battery:** `navigator.getBattery()` (`bootstrap.js:2901`) returns seeded
  `level`/`charging`.
- **Geolocation:** `navigator.geolocation` (`bootstrap.js:2905-2935`) reports
  `__obscura_geo_lat/lon` (default `50.1109, 8.6821` — Frankfurt) plus small
  jitter. Set via `OBSCURA_GEOLOCATION="lat,lon"` (`page.rs:12-17, 315-316`;
  `runtime.rs:256-263`).
- **Screen/hardware:** `screen` dims from an 8-entry pool, `devicePixelRatio`,
  `innerWidth/Height` derived in `__obscura_init` (`bootstrap.js:7366-7372`).
- **Timezone:** *not* a JS shim — driven by the OS/process `TZ`. The CLI pins
  `TZ` before any V8/ICU read (`crates/obscura-cli/src/main.rs:288-300`),
  defaulting to `Europe/Berlin`, overridable via `OBSCURA_TIMEZONE`. This makes
  `Date.getTimezoneOffset`, `Date.toString`, and `Intl.DateTimeFormat` agree
  because they all read the same process zone.

### 6.7 What stealth changes at the JS tier

Very little; the shims are always on. The only `__obscura_stealth`-gated
difference found is in `__obscura_init` (`bootstrap.js:7374-7377`): under stealth
`hardwareConcurrency` is drawn from `[4,6,8,12,16]` (vs `[2,4,6,8,12,16]`) and
`deviceMemory` from `[4,8]` (vs `[0.25,0.5,1,2,4,8]`) — i.e. stealth avoids
low-end values that are more bot-associated. Beyond this, stealth's effect is at
the network tier and the fixed Chrome-145 navigator identity (§4.3).

---

## 7. Cross-surface consistency: the central design idea

The recurring theme, stated in-code, is that **agreement across surfaces matters
more than any single surface being perfect**:

- `wreq_client.rs:24-27` — navigator identity must match the wreq TLS/UA identity.
- `profiles.rs:1-6, 68-75` — one struct binds UA, `navigator.platform`,
  `userAgentData.platform`, and platform version; rotation is off by default
  because a rotated identity lacks matching TLS/timezone.
- `client.rs:276-314` + `bootstrap.js:2808-2829` — the same GREASE client-hint
  algorithm on both the HTTP and JS sides.
- WebGL renderer pool keyed on `__obscura_ua_platform` (`bootstrap.js:157-159`)
  so a Windows identity reports a Direct3D GPU, macOS reports Metal.
- `main.rs:288-300` timezone pinning so `Date` and `Intl` agree; docs
  (`Configure-stealth-and-proxies.md:83-89`) urge aligning timezone + geolocation
  + proxy region manually.

The alignment is **manual and the operator's responsibility**. Nothing derives
timezone/geolocation/Accept-Language from the proxy exit IP automatically.

---

## 8. What Obscura deliberately does NOT do (coverage gaps)

Per `docs/Configure-stealth-and-proxies.md:29-34` and confirmed in code:

1. **No anti-bot challenge solving.** No Cloudflare interactive, Datadome/Akamai
   active challenges, or CAPTCHA handling anywhere in the tree.
2. **No TLS emulation without the `stealth` feature.** Default is rustls, which
   does not look like Chrome (`Cargo.toml:39`, `client.rs:352-369`). This is the
   default posture and it contradicts the always-on Chrome JS identity.
3. **Tracker blocking is coupled to `--stealth`.** Off by default; `block_trackers`
   is only set in stealth (`context.rs:106-108`, `client.rs:347`). No way to get
   blocking without wreq, and vice-versa.
4. **Blocklist is host-suffix only.** No path/URL rules, no adblock filter
   syntax, no cosmetic/element hiding (`blocklist.rs:24-40`). `EXTRA_DOMAINS` is
   empty (`blocklist.rs:42`); the list is a static compile-time snapshot with no
   update mechanism.
5. **WebGL is a hollow stub.** Renderer strings match, but rendering is no-op and
   `readPixels` returns `Math.random()` bytes (`bootstrap.js:6011`) — WebGL
   render-hash fingerprints are non-reproducible garbage.
6. **Canvas glyphs are a ~6px bitmap approximation** — noise defends against
   stable canvas fingerprints but the rendered text is not Chrome-shaped
   (`bootstrap.js:~5850-5864`).
7. **No Linux/mobile browser profiles**, Chrome-only, 143-146
   (`profiles.rs:8-57`). Stealth pins Chrome-145/Windows regardless of the pool
   (§4.3).
8. **No automatic locale/geo/timezone coherence with the proxy.**
   Accept-Language and `navigator.language` are hardcoded `en-US`
   (`client.rs:478-481`, `bootstrap.js:2834`); timezone/geo are separate manual
   env vars.
9. **No IP reputation / proxy-rotation intelligence.** Proxy is a single
   `--proxy` string threaded through `wreq::Proxy::all` / `reqwest::Proxy::all`
   (`wreq_client.rs:60-64`, `client.rs:362-366`); rotation, health-checking, and
   residential-vs-datacenter logic are out of scope.
10. **Per-navigation reseed of `_fpSeed`** (`bootstrap.js:7356`) means the JS
    fingerprint is not stable across page loads within a session — a site
    correlating fingerprints across navigations sees them shift.
11. **No behavioral evasion** — no synthetic mouse curves, timing jitter on
    input, or human-like interaction modeling in the stealth surface.

---

## 9. How it connects to the rest of Obscura

- **`obscura-net`** owns both HTTP clients and the blocklist; `lib.rs:7-25`
  conditionally re-exports the stealth surface (`StealthHttpClient`,
  `STEALTH_*` constants) only under the feature.
- **`obscura-browser`** (`context.rs`, `page.rs`, `profiles.rs`) is the glue: it
  picks a profile, constructs the right HTTP client, and injects identity into
  the JS runtime per navigation (`page.rs:277-324`).
- **`obscura-js`** hosts `bootstrap.js` (the fingerprint surface) and
  `op_fetch_url` (which re-routes scripted requests through the stealth client);
  `runtime.rs:227-263` exposes `set_platform` / `set_geolocation` /
  `set_stealth` that stamp the `__obscura_*` globals bootstrap.js reads.
- **`obscura-cli`** parses `--stealth` / `--proxy` / `--user-agent`, pins `TZ`
  (`main.rs:288-300`), and fans the feature to `obscura-mcp` and
  `obscura-browser`.

---

## 10. Dependencies (stealth-relevant)

| Purpose | Crate | Where |
|---|---|---|
| Chrome TLS/HTTP emulation | `wreq` `=6.0.0-rc.29`, `wreq-util` `=3.0.0-rc.12` (pinned) | `obscura-net/Cargo.toml:31-40` |
| Default HTTP + rustls TLS + SOCKS | `reqwest 0.12` (`rustls-tls`, `socks`, gzip/brotli/deflate) | `Cargo.toml:39` |
| Tracker blocklist data | `pgl_domains.txt` (3,520 domains, compiled in) | `obscura-net/src/blocklist.rs:5` |
| JS fingerprint surface | hand-written `bootstrap.js` on a deno_core/V8 runtime | `obscura-js/js/bootstrap.js` |

---

## 11. One-paragraph assessment for Basset Hound comparison

Obscura's stealth is a **two-tier, opt-in, consistency-first** design: a
`wreq`-based Chrome-145 TLS/header emulator plus a domain-suffix tracker denylist
(both gated behind one `--stealth` switch), layered over an always-on but
approximate JS fingerprint surface (`navigator`, client hints, WebGL renderer
strings, a noisy software canvas, audio/battery/geo). Its strongest ideas are the
tightly-bound profile struct, the shared GREASE client-hint algorithm on both
HTTP and JS sides, and the pinned-identity-in-stealth choice that keeps TLS and
JS from contradicting each other. Its weakest points are structural: the default
build has no TLS emulation yet still claims Chrome in JS; WebGL/canvas rendering
is stubbed so render-based fingerprints are wrong or non-deterministic; the
blocklist is static and host-only; and locale/timezone/geo coherence with the
proxy is left entirely to the operator. It explicitly does not attempt active
anti-bot challenge solving.

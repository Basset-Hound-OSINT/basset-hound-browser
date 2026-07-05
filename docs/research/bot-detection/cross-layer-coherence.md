---
title: "Cross-Layer Coherence — Bot-Detection Surface Audit"
date: 2026-07-03
researcher: Claude (bot-detection research subagent)
status: Complete
category: bot-detection
surface: cross-layer-coherence
---

# Cross-Layer Coherence — Detection Surface Audit

> **Bottom line up front.** Basset Hound ships four modules whose names promise
> "cross-layer coherence" (`session-coherence.js`, `coherence-manager.js`,
> `coherence-validators.js`, `fingerprint-validator.js`). In reality they
> implement **temporal / cross-request self-consistency** ("did this one signal
> change between request N and N+1?"), **not** cross-signal coherence ("does the
> TLS fingerprint agree with the User-Agent, does the timezone agree with the
> IP?"). The single thing a 2026 detector correlates hardest — TLS JA4 vs the
> claimed browser — is neither shaped on the wire nor validated anywhere. The
> framework is also an **offline scoring library fed caller-supplied data**; it
> never observes the real handshake, real client hints, real peer IP, or real
> JS-reported timezone. Naming badly oversells capability here.

---

## (a) How detectors fingerprint this surface in 2026

Modern anti-bot stacks (Cloudflare, DataDome, HUMAN/PerimeterX, Akamai) no
longer score signals in isolation. The whole game is **identity coherence**:
every layer of the connection must tell the same story about *who* the client
claims to be. A perfect individual fingerprint on an incoherent stack is itself
the tell. This is the "Obscura lesson."

Detection fires **layer by layer, earliest-first**, and any layer can block
before the next one runs:

1. **TCP/IP stack** (TTL, window size → JA4T / p0f-style OS inference).
2. **TLS ClientHello** → **JA4/JA4+** (superseded JA3). JA4 sorts extensions
   and cipher suites *before* hashing, defeating Chrome's per-connection
   extension shuffling (shipped Chrome 110, Jan 2023) that made **JA3
   non-deterministic and useless for browser ID**. By 2026 Cloudflare, Akamai,
   AWS WAF and VirusTotal use JA4 as a **primary** signal — often called "the
   single most important signal" because it is computed before a single byte of
   JS runs.
3. **HTTP/2 / HTTP/3 fingerprint** — SETTINGS frame values & order, WINDOW_UPDATE,
   pseudo-header order (`:method :authority :scheme :path`), priority tree
   (Akamai h2 fingerprint / JA4H). Must match the browser the TLS layer claimed.
4. **HTTP header coherence** — header count/order/casing, and crucially
   **Client Hints**: `Sec-CH-UA`, `Sec-CH-UA-Platform`, `Sec-CH-UA-Mobile`,
   `Sec-CH-UA-Platform-Version` must agree with the `User-Agent` and with each
   other.
5. **JS/DOM fingerprint** — `navigator.webdriver`, canvas/WebGL/audio hashes,
   font list, `navigator.platform`, `navigator.vendor`, screen metrics,
   `Intl.DateTimeFormat().resolvedOptions().timeZone`, `navigator.languages`.
6. **IP reputation / ASN / geo** — datacenter vs residential, and **geo of the
   exit IP vs the JS timezone vs Accept-Language**.
7. **Behavioral** — pointer/keystroke dynamics, timing distributions.

The **cross-layer checks that actually block** (per 2026 vendor guidance):

| Pair correlated | Example instant-fail |
|---|---|
| **JA4 (TLS) ↔ User-Agent** | UA says "Chrome 131 / Windows" but the ClientHello JA4 isn't Windows-Chrome-131 → block. TLS cannot lie about the real client. |
| **HTTP/2 fp ↔ UA** | TLS looks like Chrome but h2 SETTINGS/pseudo-header order looks like Go/`aioquic`/OkHttp. |
| **Sec-CH-UA-Platform ↔ User-Agent** | `Sec-CH-UA-Platform: "Windows"` with a `Macintosh` UA → DataDome calls this out explicitly as an instant fail. |
| **navigator.platform ↔ UA / Client Hints** | JS `navigator.platform = "Win32"` while headers say macOS. |
| **navigator.vendor ↔ UA** | Chrome UA must carry `vendor = "Google Inc."`; Firefox = `""`. |
| **Timezone (JS) ↔ IP geo** | Residential proxy in Frankfurt, but `Intl` timezone `America/New_York` → geo/timezone mismatch. |
| **Accept-Language / navigator.languages ↔ IP geo** | `en-US` first while exiting a German/Japanese IP. |
| **WebGL renderer/vendor ↔ platform** | `Apple GPU` renderer on a claimed Windows box. |
| **maxTouchPoints ↔ platform/mobile flag** | `Sec-CH-UA-Mobile: ?1` but `maxTouchPoints: 0`. |

A single mismatch is a data point; several accumulate into a block. The scoring
target is *consistency across vectors*, not any one vector.

**Sources:**
[krowdev — Bot detection 2026 (JA4 & HTTP/2)](https://krowdev.com/article/bot-detection-2026/),
[TorchProxies — Cloudflare vs DataDome vs HUMAN 2026](https://torchproxies.com/cloudflare-vs-datadome-vs-human-security-what-each-bot-system-actually-checks-2026/),
[wilico — JA3/JA4 detection](https://wilico.co.jp/en/blog/tls-fingerprint-ja3-ja4-detection),
[Cloudflare — JA3/JA4 fingerprint docs](https://developers.cloudflare.com/bots/additional-configurations/ja3-ja4-fingerprint/),
[TrueGuard — JA4 & JA4T](https://trueguard.io/knowledgebase/what-is-ja4-and-ja4t-fingerprints),
[arXiv 2602.09606 — Detecting bad bots via TLS](https://arxiv.org/html/2602.09606v1),
[ScrapeBadger — Bypassing DataDome 2026](https://scrapebadger.com/blog/how-to-bypass-datadome-anti-bot-protection-a-complete-2026-guide).

---

## (b) What Basset Hound currently does — with file citations

### B1. The "coherence" framework validates *self-stability over time*, not cross-signal agreement

`src/evasion/session-coherence.js` and `src/evasion/coherence-validators.js`
both describe themselves as *"5-layer cross-request consistency"*. Reading the
code, **every** check compares a signal to its **own previous value in the same
session**:

- Temporal: fingerprint components must not drift >2% between requests
  (`session-coherence.js:246-307`, component list `:258`).
- Behavioral: typing/mouse speed must stay within deviation of the session mean
  (`:312-392`).
- Network: User-Agent "changed mid-session", request timing regularity
  (`:397-466`, UA-change check `:405-418`).
- Device: OS / browser-vendor / screen "changed mid-session"
  (`:471-543`).
- Timeline: time-travel, interaction-rate (`:548-598`).

In `coherence-validators.js` the `MasterCoherenceValidator` "5 layers" are the
same pattern — each validator stores history and flags a **delta from the prior
sample**:

- `IPNetworkValidator` — IP changed too fast / too many hops / impossible travel
  speed (`:33-190`). It checks IP-vs-*previous-IP*, **never IP-geo vs timezone
  or vs Accept-Language**.
- `TLSHTTPValidator.validateTLSConsistency` — flags only if **`ja3` differs from
  the previous `ja3`** (`:222-289`). It consumes `tlsData.ja3` — **JA3, not
  JA4** — and never compares the fingerprint to the claimed browser/UA.
- `TLSHTTPValidator.validateHTTPHeaders` — flags UA / Accept-Language /
  Accept-Encoding that **differ from the previous request** (`:296-359`). No
  Client-Hints handling, no UA↔platform check.
- `DeviceFingerprintValidator` — canvas/webgl/audio/etc. changed vs prior
  (`:383-432`).
- `BehavioralPatternValidator`, `SessionIdentityValidator` — deviation / cookie
  persistence (`:480-733`).

**Net:** the framework answers *"is this session internally stable frame to
frame?"* It does **not** answer *"do the layers agree with each other right
now?"* — which is the actual cross-layer-coherence surface.

### B2. It is an offline scoring library fed caller-supplied data — not wired to the wire

The only production consumers are two WebSocket command files:
`websocket/commands/coherence-check.js:14-34` and
`websocket/commands/coherence-validation-commands.js:18-30`. They accept
`params.interactionData.requestData` (`coherence-validation-commands.js:114,149`;
`coherence-manager.js:106-110`) and pass it straight into the validators.

Nothing captures real signals: there is **no** `getPeerCertificate`,
`socket.remoteAddress`, real ClientHello parse, real Client-Hints read, or real
`Intl…resolvedOptions()` read feeding these validators. The caller supplies the
`ja3`, `ip`, `headers`, and `device` objects, so the validator can only ever
"detect" a mismatch the operator already handed it. It is a report generator,
not an enforcement gate on outgoing requests.

### B3. The one module that claims real cross-layer coherence is theater and unwired

`src/evasion/multi-layer-coordinator.js` advertises strategies named
`ja4-profile-matching`, `http2-settings-coherence`, `locale-timezone-coherence`
(`:51-109`) and a `_validateCrossLayerCoherence()` method. That method
(`:403-428`) **pushes hardcoded `'✓ …'` strings** ("✓ TLS profile consistent
with claimed User-Agent", etc.) and **never compares anything** — `violations`
is always empty so the score is always 100. Worse, this coordinator is **not
instantiated anywhere in production** — the only reference is an archived
exploration test (`tests/archives/exploration-tests/…`).

### B4. JA4 "profiles" exist but never touch the wire

`src/evasion/tls-fingerprinting.js` builds JA4 profile objects
(`getJA4Fingerprint()` `:263`, profiles `:32-260`) and a `TLSCoherenceValidator`,
but these are **descriptive metadata**. The three TLS modules
(`tls-cipher-rotation.js`, `tls-version-evasion.js`, `tls-extension-ordering.js`)
contain **no** `tls.connect` / `createSecureContext` / `setCiphers` / socket
calls. Because Basset Hound is Electron, the **actual** ClientHello on the wire
is Chromium's real handshake; a JS object describing a JA4 string does not change
the bytes sent. So the emitted JA4 is real-Electron-JA4, and nothing checks it
against the spoofed UA.

### B5. `fingerprint-validator.js` does minimal cross-field checks and only *warns*

`src/evasion/fingerprint-validator.js` is schema validation for profile JSON.
Its only two cross-field checks:
- aspect ratio sanity (`:124-130`);
- language↔timezone (`:133-138`, heuristic `_validateLanguageTimezone`
  `:343-371`). This heuristic is extremely permissive (`'en'` is allowed in
  `America/Europe/Asia/Australia/Africa` — i.e. everywhere, `:346`) **and on
  failure it only `logger.warn`s (`:136`)** — `valid` stays `true`. An
  incoherent profile passes validation.

It does **not** cross-check `userAgent`↔`platform`, `userAgent`↔`vendor`
(Chrome must be "Google Inc."), `platform`↔`maxTouchPoints`,
`platformVersion`↔`Sec-CH-UA-Platform-Version`, or `language`↔`languages[0]`.

### B6. A real (but shallow, unwired) cross-signal check exists elsewhere

`evasion/fingerprint-profile.js` (root `evasion/`, **not** among the audited
`src/evasion` modules) has a `validate()` (`:593-632`) that does genuine
cross-signal checks: UA-substring-vs-platformType (`:596-606`) and one
WebGL-vendor-vs-Windows case (`:609-611`). It is substring-shallow (only checks
the UA string *contains* "windows"/"mac"/"linux") and is **not referenced by any
production module** — only by tests. It has no JA4, no Client Hints, no
timezone/IP.

### B7. No timezone-vs-IP or locale-vs-IP enforcement anywhere

`geolocation/manager.js` hardcodes a default timezone `America/New_York`
(`:21-22`) and only changes it from an explicit `options.timezone`
(`:160-162`). A grep for any link between the proxy/exit-IP and the
timezone/locale returns **nothing**. So rotating to a proxy in another country
leaves the JS timezone and Accept-Language pointing at New York.
`src/detection/fingerprint-analyzer.js` *lists* the right bot signatures
("timezone mismatch with IP geolocation" `:90`, "language mismatch with region"
`:95`) but it is a **passive target-analysis** module that trusts a
caller-supplied `mismatchWithRegion` boolean (`:277,284`) and never computes
geo-vs-timezone itself.

---

## (c) Gaps, ranked by severity — what a real detector would catch

### CRITICAL-1 — Real TLS JA4 vs claimed User-Agent is neither shaped nor checked
The single highest-weight 2026 signal. Electron emits Chromium's real JA4; the
UA is spoofed independently; nothing reconciles them and nothing validates them.
A detector computes JA4 before JS runs and blocks on the mismatch. Basset Hound
has no wire-level TLS control (no `tls.connect`/proxy rewrite in
`src/evasion/tls-*.js`) and the "coherence" layer only checks **JA3-vs-previous-JA3**
(`coherence-validators.js:222-289`). **This is the top leak.**

### CRITICAL-2 — Coherence is temporal-only; zero cross-signal correlation
The entire framework checks *"did signal X change since last request"* and never
*"does signal X agree with signal Y."* No JA4↔UA, no Sec-CH-UA↔UA, no
platform↔UA, no timezone↔IP, no language↔IP. The named capability
("cross-layer coherence") does not exist in the audited modules
(`session-coherence.js`, `coherence-validators.js`, `coherence-manager.js`).

### CRITICAL-3 — Timezone / Accept-Language not tied to the exit IP
Default `America/New_York` (`geolocation/manager.js:21`) with **no** proxy-IP
linkage (grep: none). With residential-proxy rotation this produces a textbook
geo-vs-timezone and Accept-Language-vs-geo mismatch on every non-US exit — a
primary DataDome/Cloudflare correlation.

### HIGH-1 — Uses deprecated JA3 and treats it as a stability invariant
`TLSHTTPValidator` keys on `tlsData.ja3` (`:230-289`). JA3 has been
non-deterministic for Chromium since Chrome 110 (extension shuffling), so this
check is (a) the wrong algorithm for 2026 and (b) **actively wrong** — it would
flag real Chrome/Electron traffic as a "JA3 changed mid-session" violation while
missing the JA4↔UA mismatch that matters.

### HIGH-2 — No HTTP/2 / HTTP/3 fingerprint coherence
No SETTINGS values/order, pseudo-header order, priority, or JA4H check against
the claimed browser. `multi-layer-coordinator.js:403-428` fakes this with
hardcoded `'✓'` strings and is unwired.

### HIGH-3 — No Client Hints coherence
`Sec-CH-UA*` values are emitted as static strings from `headers/profiles.js`
(`:79-283`) but nothing validates `Sec-CH-UA-Platform` ↔ UA ↔
`navigator.platform` ↔ `navigator.vendor` ↔ `maxTouchPoints`. If UA and header
profile are ever selected independently, this is an instant fail with no guard.

### MEDIUM-1 — `fingerprint-validator` cross-checks are permissive and non-blocking
Language/timezone heuristic allows almost everything and only `logger.warn`s
(`fingerprint-validator.js:133-138,343-371`); no UA↔platform↔vendor validation.
Incoherent profiles pass.

### MEDIUM-2 — The genuine cross-signal validator is shallow and dead code
`evasion/fingerprint-profile.js:593-632` does substring UA↔platform only and is
unreferenced by production.

---

## (d) Remediation recommendations (concrete)

1. **Own the TLS handshake or stop claiming JA4 coherence.** A JS "JA4 profile"
   in `tls-fingerprinting.js` is cosmetic under Electron. To make JA4↔UA cohere
   you must route egress through a client that lets you shape the ClientHello —
   e.g. a local `utls`/`curl-impersonate`/BoringSSL-cipher-pinned proxy that
   impersonates the *exact* Chrome build named in the UA — and then derive the
   UA/Client-Hints **from the same profile** so they cannot diverge. Until then,
   document that TLS coherence is unimplemented rather than "STRICT."

2. **Build a real synchronic coherence validator.** Add a
   `CrossLayerCoherenceValidator` that takes one *snapshot* (TLS-JA4, h2-fp,
   headers+Client-Hints, JS navigator, timezone, exit-IP-geo) and asserts pairwise
   agreement per the table in section (a). Return hard violations, not drift
   scores. Wire it as a pre-flight gate, not an after-the-fact WebSocket report.

3. **Switch JA3→JA4 and stop treating the fingerprint as a session invariant.**
   Replace the `ja3` equality check with a JA4↔expected-browser lookup; drop the
   "JA3 changed mid-session" rule (it false-positives on real Chrome).

4. **Bind timezone + Accept-Language + geolocation to the proxy exit IP.** On
   proxy selection, resolve exit-IP → country/timezone (MaxMind/IP2Location) and
   set `geolocation/manager.js` timezone/offset, `navigator.languages`, and the
   `Accept-Language` header from that, atomically. Fail closed if unknown.

5. **Add HTTP/2 fingerprint coherence** (SETTINGS/order/pseudo-header/priority
   matched to the claimed Chrome build) and validate it against the TLS profile.

6. **Make `fingerprint-validator` cross-checks blocking and complete:** UA↔platform,
   UA↔vendor (Chrome⇒"Google Inc."), platform↔maxTouchPoints,
   Sec-CH-UA-Platform↔platform, platformVersion↔Sec-CH-UA-Platform-Version,
   language↔languages[0]. Return `valid:false` on failure; delete the
   warn-only path (`:136`) and the "everywhere" language table (`:346`).

7. **Rename honestly.** The current modules are *session self-consistency*
   monitors. Keep them (drift detection has value) but stop labeling them
   "cross-layer coherence," and delete or gate the theater in
   `multi-layer-coordinator._validateCrossLayerCoherence()`.

---

*Audit scope: `src/evasion/session-coherence.js`, `coherence-manager.js`,
`coherence-validators.js`, `fingerprint-validator.js`, plus adjacent modules
(`multi-layer-coordinator.js`, `tls-fingerprinting.js`, `headers/profiles.js`,
`geolocation/manager.js`, `evasion/fingerprint-profile.js`,
`src/detection/fingerprint-analyzer.js`) and their production wiring. Web
research current as of July 2026.*

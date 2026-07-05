---
title: "TLS / HTTP-2 Fingerprinting — Detection Surface Audit (Basset Hound Browser)"
date: 2026-07-03
researcher: "Bot-Detection Research (automated audit)"
status: Complete
category: bot-detection
surface: tls-http2-fingerprinting
---

# TLS / HTTP/2 Fingerprinting — Detection Surface Audit

## TL;DR (read this first)

Basset Hound ships **seven modules whose filenames promise TLS/HTTP-2 fingerprint control**
(`tls-fingerprinting.js`, `tls-cipher-rotation.js`, `tls-extension-ordering.js`,
`tls-version-evasion.js`, `http2-header-ordering.js`, `http2-priority-manipulation.js`,
`network-obfuscation.js`). **None of them touch the wire.** They are pure in-memory
JavaScript models that build cipher arrays, extension lists, and "coherence scores" and are
imported **only by test files** — `grep` finds zero production call sites (see §B.1).

The actual bytes a target server sees are produced by **Chromium's BoringSSL stack inside
Electron 39.8.10 (Chromium ≈142)**, which these JS modules cannot alter. That is simultaneously
the tool's biggest asset (a real Chromium ClientHello is genuinely Chrome-like) and the source
of its single most dangerous leak: **the real TLS/H2 fingerprint is Chromium-142's, while the
spoofed User-Agent pool claims Chrome 118–123 and the TLS "profiles" claim Chrome 131.** A JA4↔UA
coherence check — the exact check this repo's own validator rates at "98.6% detection rate"
(`tls-fingerprinting.js:500`) — fires on the first request.

---

## (A) How detectors fingerprint this surface in 2026

Modern anti-bot stacks (Cloudflare Bot Management, Akamai Bot Manager, DataDome, HUMAN/PerimeterX,
Kasada, F5/Shape, Imperva) treat the connection as a **layered, protocol-aware fingerprint** taken
*before a single line of page JavaScript runs*. The relevant layers for this surface:

### 1. TLS ClientHello — JA3 (legacy) and JA4 (current standard)
- **JA3** (2017): MD5 over `TLSVersion,Ciphers,Extensions,EllipticCurves,ECPointFormats` in wire
  order. Broken by Chrome 110 (Feb 2023), which **randomizes extension order** per-connection, so
  a fixed JA3 no longer identifies Chrome.
- **JA4** (Salesforce, 2023; the 2026 standard, adopted by Cloudflare, Akamai, AWS WAF, VirusTotal):
  format `t13d1516h2_<cipherhash>_<extensionhash>`. It **sorts ciphers and extensions before
  hashing**, defeating GREASE/permutation noise, and folds in TLS version, SNI presence, cipher
  count, extension count, ALPN, and signature algorithms. It is deliberately resilient to the exact
  randomization these modules try to add.
- **JA4T / JA4L / JA4+ suite**: adds TCP-layer (window size, options, MSS), TLS latency, and
  destination-correlation signals. A Node/OpenSSL TCP+TLS stack differs from Chromium's here.
- **Key detector logic**: the observed JA4 is looked up in a database of *known browser JA4s*, and
  cross-checked against the claimed User-Agent and TLS-version. Three failure modes get flagged:
  (a) JA4 belongs to a scripting stack (Go/Python/Node-OpenSSL) not a browser; (b) JA4 is a valid
  browser but a **different version/build than the UA claims**; (c) JA4 changes mid-session when a
  real browser's would be stable.

### 2. Post-quantum key share as a version oracle
Chrome enabled **X25519MLKEM768** (hybrid PQC key share) by default around Chrome 131 (earlier as
X25519Kyber768Draft00 in 124–130). Its presence/absence and the exact group ID are a precise
**version fingerprint**. A ClientHello advertising MLKEM768 cannot credibly claim to be Chrome 120;
one *without* it cannot credibly claim Chrome 142.

### 3. HTTP/2 fingerprint (Akamai passive H2 fingerprint)
Format `S[...]|WU|P[...]|PS` (Akamai whitepaper, widely deployed):
- **S** — SETTINGS frame parameters as `ID:Value` pairs **in transmission order**
  (`HEADER_TABLE_SIZE`, `ENABLE_PUSH`, `MAX_CONCURRENT_STREAMS`, `INITIAL_WINDOW_SIZE`,
  `MAX_FRAME_SIZE`, `MAX_HEADER_LIST_SIZE`).
- **WU** — the connection-level WINDOW_UPDATE increment.
- **P** — PRIORITY frames / stream dependency tree (weights, exclusivity) sent at connection open.
- **PS** — pseudo-header order as letters. **Real Chrome/Chromium is deterministically `m,a,s,p`**
  (`:method`, `:authority`, `:scheme`, `:path`). Firefox differs; Safari differs. This is fixed
  per-engine and non-random.
- **Header order & casing**: HTTP/2 lowercases header names, but the *order* of regular headers is
  a stable per-browser signature. Any variation across requests from a "single browser" is itself
  the tell.

### 4. Cross-layer coherence
The decisive 2026 technique is not any single hash but **agreement across layers**: JA4 (TLS) ⇄
Akamai H2 ⇄ header order ⇄ client-hints ⇄ UA ⇄ TCP. Headless Chrome/Playwright largely *pass* the
raw JA4/H2 checks because they share Chromium's real network stack; they get caught on coherence,
IP reputation, and JS/behavioral layers. A tool that fakes the JS/header layer but leaves a
mismatched TLS layer is caught **earlier and more cheaply** than one that does nothing.

Sources: Cloudflare JA3/JA4 docs & "JA4 signals" blog; Salesforce JA4 spec; Akamai
"Passive Fingerprinting of HTTP/2 Clients" whitepaper; Scrapfly JA3/JA4 & HTTP/2 fingerprint tools;
BrowserLeaks /http2; trueguard.io JA4/JA4T; arXiv 2602.09606 ("When Handshakes Tell the Truth").

---

## (B) What Basset Hound actually does — with file citations

### B.1 The headline finding: none of it is wired to the network

Every module named in this audit is instantiated **only from `tests/`**. Production `grep`
(excluding `src/evasion/` definitions and `tests/`) returns **nothing**:

```
require(...tls-fingerprinting|tls-cipher-rotation|tls-extension-ordering|
        tls-version-evasion|http2-header-ordering|http2-priority-manipulation|
        network-obfuscation)
  → only tests/evasion/*.test.js
```

The real network path (`src/main/main.js`) drives Chromium directly:
`new BrowserWindow(...)` (`main.js:789`), `webContents.setUserAgent(userAgent)` (`main.js:793`),
`webContents.loadURL` navigation, and `proxyManager.setProxy` (`main.js:1488`). The TLS handshake
and HTTP/2 frames are emitted by **Chromium's BoringSSL / net stack**, which no JS module in
`src/evasion/` can reach. There is **no** uTLS-equivalent, no curl-impersonate, no BoringSSL cipher
patch, no TLS-terminating proxy, and no native binding anywhere in the tree (grep for
`utls|curl_cffi|impersonate|boringssl|--cipher-suites` finds only a Tor `snowflake` config line and
example clients).

**Consequence:** the modules cannot change JA3, JA4, the Akamai H2 fingerprint, SETTINGS order,
PRIORITY frames, or pseudo-header order that a server observes. Whatever the modules compute is
never serialized onto a socket.

### B.2 `tls-fingerprinting.js` — a static report generator with wrong constants
- Hardcoded JA4 strings, never computed from a real ClientHello, e.g.
  `tlsFingerprint: 't13d1516h2_8daaf6152771_e5627efa2ab1'` (`tls-fingerprinting.js:86`, `:166`).
  The `a` and `b` segments match public Chrome values, but the `c` (extension/sig-alg) segment
  `e5627efa2ab1` is **not** Chrome's real value (`02713d6af862`). It is decorative.
- The `chrome131-windows` cipher list (`:42–58`) is **not a real Chrome ClientHello**: it invents a
  GREASE value `0x1200 // GREASE_1a` (real GREASE is `0x0a0a,0x1a1a,…,0xfafa`), lists **duplicate
  ciphers "for GREASE"** (`:53–55`), and mixes legacy RSA-CBC suites in an order Chrome does not use.
- `validateHTTP2Coherence()` (`:286`) and `TLSCoherenceValidator.validateCoherence()` (`:512`)
  compute scores by comparing the model's **own hardcoded fields to each other** (e.g.
  `cipherCount === ciphers.length`, `:322`). This is self-referential and always ~100; it says
  nothing about the bytes on the wire.
- The validator *itself documents the exact leaks it cannot fix*:
  `JA4_to_UserAgent_mismatch … detectionRate: '98.6%'` (`:500–505`) and
  `TLS_to_HTTP2_mismatch … '95%'` (`:476–480`) — flagged in prose, mitigated nowhere.

### B.3 `tls-cipher-rotation.js` — rotates a list that is never sent
- Builds per-profile cipher arrays and "rotates" them across sessions
  (`getCipherSuite()` `:119`, `_orderCiphersRealistically()` `:192`). Chromium's cipher order is
  **fixed and not configurable from JS**, so rotation is inert. Worse as a *design*: a browser's
  cipher order is stable; rotating it would be anomalous if it were real.
- The Chrome cipher set (`:36–52`) omits Chrome's real leading GREASE and the TLS-1.3 →
  ECDHE ordering Chromium actually emits.

### B.4 `tls-extension-ordering.js` — randomizes what JA4 already normalizes away
- `getExtensionOrder('realistic'|'aggressive')` shuffles extension order (`_reorderRealistic()`
  `:114`). JA4 **sorts extensions before hashing**, so this shuffling is a no-op against the current
  standard even if it reached the wire (it does not). The extension table (`:33–49`) contains
  fictional entries: `0x0034 post_quantum_key_share` and `0x0033 key_share (post_quantum)` are not
  the real code points (PQC rides inside the standard `key_share`/`supported_groups`).
- `_loadSystemCACerts`/cert-chain logic lives in the sibling module and is stubbed (see B.6).

### B.5 `http2-header-ordering.js` & `http2-priority-manipulation.js` — model-only, and factually wrong
- **Wrong pseudo-header order for Chrome.** Profile `chrome131-windows` declares
  `pseudo: [':authority', ':method', ':scheme', ':path']` (`http2-header-ordering.js:35`, `:82`).
  Real Chromium sends **`:method, :authority, :scheme, :path`**. The model encodes the wrong Akamai
  `PS` segment — so even if it were wired in, it would *manufacture* a mismatch.
- **Randomization is the wrong strategy.** `_reorderRegularHeaders` shuffles 20% (`:170`),
  `aggressive` 40% (`:193`), and `_reorderPseudoHeaders` mutates pseudo order 10% of the time
  (`:146`). Real browsers are **deterministic** here; variance across requests is itself a
  high-confidence bot signal. This module, if activated, would *reduce* stealth.
- `http2-priority-manipulation.js` fabricates per-stream weights/dependencies with `Math.random`
  (`_calculatePriority` `:75`, `setStreamPriority` `:47`). Chromium's HTTP/2 does not use classic
  RFC 7540 priority trees anymore (it moved to the RFC 9218 / Extensible Priorities `priority`
  header / and a single fixed dependency pattern); the model's random weighted tree matches no
  current browser. Nothing feeds these values into Chromium's framer regardless.

### B.6 `tls-version-evasion.js` — "certificate validation evasion" is stubbed
- `selectTLSVersion` picks 1.2/1.3 by regex on the domain name (`:35–50`) — never applied to any
  socket. `_validateChain` (`:165`), `_validateSignature` (`:179`), `_hashPublicKey` (`:250`) and
  `_loadSystemCACerts` (`:259`) all `return true`/`''`/`[]` with `// Simplified: assume valid`.
  The module's advertised "MITM detection / pinning bypass / chain validation" is not implemented.

### B.7 `network-obfuscation.js` — simulated, not real
- `_performDNSLookup` (`:51`) returns a **randomly generated fake IP** (`_generateIPAddress` `:64`)
  and a random TTL; it performs no resolution. `getEphemeralPort` (`:95`) and `getPoolSize` (`:82`)
  return numbers that are never bound to a socket. DNS/port/pool behavior on the wire is entirely
  Chromium's.

### B.8 What genuinely protects this surface (the asset)
Because navigation goes through Chromium (`main.js:789`, `:793`), **for in-page (webContents)
traffic the JA3/JA4 and Akamai H2 fingerprint are a real Chromium fingerprint** and will match a
current Chrome build — the strongest thing the tool has, and it exists *despite* these modules, not
because of them. The liability is coherence (see Gaps 1–2) and the Node-stack side channels
(Gap 4).

---

## (C) Gaps ranked by severity

### GAP 1 — CRITICAL: Real TLS/H2 fingerprint is unspoofable *and* mismatched to the claimed UA
The wire fingerprint is Chromium 142's (Electron 39.8.10). The UA rotation pool advertises
**Chrome 118–123** (`utils/user-agents.js:29–33`; version histogram: 17×120, 7×121, 7×119, 5×122,
1×123, 1×118) and the TLS "profiles" hardcode **Chrome 131**. Three disagreeing version claims,
plus a real ClientHello neither of them matches. A JA4↔UA lookup (Cloudflare/Akamai standard;
this repo rates it 98.6%, `tls-fingerprinting.js:500`) flags it on request #1.
*Evidence:* `main.js:793`, `utils/user-agents.js:29`, `tls-fingerprinting.js:34,86`.

### GAP 2 — CRITICAL: Post-quantum key share betrays the exact Chromium version
Chromium 142 emits **X25519MLKEM768** in `key_share`/`supported_groups` by default. A UA claiming
Chrome 120 (the pool's modal value) *must not* carry MLKEM768; the real handshake does. Conversely
the modules assert PQC support for "chrome131" while the UA pool predates it. This is a single-bit,
non-spoofable version oracle that no module addresses.
*Evidence:* real stack Chromium 142; UA pool `Chrome/120` `utils/user-agents.js:29`; PQC claims
`tls-fingerprinting.js:79,84`.

### GAP 3 — HIGH: The entire TLS/H2 evasion layer is inert (test-only), so any config knob is a no-op
Operators toggling `profile`, cipher rotation, extension ordering, or header ordering get a false
sense of control: the code paths never reach a socket (`grep`: importers are only
`tests/evasion/*`). "We're covered" here is worse than an admitted gap.
*Evidence:* §B.1 grep; production call sites: none.

### GAP 4 — HIGH: Node/OpenSSL side channels leak a non-browser TLS fingerprint
Several components fetch over Node's `https`/`http`/`http2` — `residential-proxy-manager.js:9-10`,
`integrations/{shodan,censys,maltego}-client.js`, `darkweb/tor-investigation.js:18`,
`features/webhooks.js`, `sessions/session-connection-pool.js`. Any of these that touch a
target/CDN present an **OpenSSL JA3/JA4** (classic "requests/Node" fingerprint), which conflicts
with the Chrome UA. Proxy health-checks in particular can egress from the same IP as navigation.
*Evidence:* `src/proxy/residential-proxy-manager.js:9`, `src/darkweb/tor-investigation.js:18`.

### GAP 5 — MEDIUM: Where the models *do* encode browser behavior, the constants are wrong
Chrome pseudo-header order is mis-encoded as `a,m,s,p` instead of `m,a,s,p`
(`http2-header-ordering.js:35`); fabricated GREASE `0x1200` and duplicate ciphers
(`tls-fingerprinting.js:53`); fictional PQC extension code points
(`tls-extension-ordering.js:48`); JA4 `c`-hash wrong (`tls-fingerprinting.js:86`). If any of this
were ever activated it would *create* anomalies. It also means the "coherence scores" reported to
operators are meaningless.
*Evidence:* citations above.

### GAP 6 — MEDIUM: "Realistic variation" is the wrong model for a deterministic surface
Header/extension/cipher/priority randomization (`http2-header-ordering.js:170,193`;
`tls-extension-ordering.js:133–155`; `tls-cipher-rotation.js:209`;
`http2-priority-manipulation.js:75`) assumes variance = human. On the TLS/H2 surface real browsers
are **byte-stable**; per-request variance is itself the detection signal. The design philosophy is
inverted for this layer.
*Evidence:* citations above; contrast with Akamai H2 determinism (§A.3).

---

## (D) Remediation recommendations (concrete)

**Priority 0 — stop the version-skew leak (fixes Gaps 1, 2 cheaply).**
- Pin the spoofed User-Agent (and UA-CH `Sec-CH-UA` brand/version/full-version-list) to the
  **actual bundled Chromium major version** of Electron 39.8.10 (Chromium 142). Derive it at runtime
  from `process.versions.chrome` rather than a hand-maintained list. Delete/replace the stale
  `Chrome/118–123` pool in `utils/user-agents.js` and the `chrome131` labels in the evasion
  profiles. This single change removes the highest-confidence flag with zero networking work.
- Keep the browser current so its real JA4 stays in detectors' "known-good recent Chrome" set;
  do **not** downgrade the UA below the real engine.

**Priority 1 — make the real fingerprint the product; delete the theater.**
- Treat the genuine Chromium ClientHello/H2 as the asset. **Remove or clearly quarantine** the
  seven inert modules (or relabel them `*-model.js` and exclude from any "evasion enabled" surface)
  so operators cannot mistake them for live controls. Update MEMORY.md / docs that claim
  "JA3/JA4 evasion" and "85–90% evasion effectiveness" — the TLS/H2 portion of that claim is
  unsubstantiated.

**Priority 2 — close the Node/OpenSSL side channels (Gap 4).**
- Route *all* target-facing traffic through the Chromium session (webContents / `net` module /
  `session.fetch`), never Node `https`. Audit `residential-proxy-manager`, integration clients, and
  webhook callers; ensure proxy health-checks and any scraping helpers either use Chromium or exit
  via a distinct IP that is never correlated with navigation.

**Priority 3 — if true TLS/H2 spoofing is actually required (only when navigation must impersonate a
*different* browser than the bundled engine).**
- Front outbound traffic with a **real impersonating TLS stack**, not JS models: a
  uTLS / utls-based Go proxy, `curl-impersonate`/`curl_cffi`, `tls-client`, or BoringSSL built with
  the target's cipher/extension/ALPS profile. Chromium already exposes ALPS/PQC; matching a
  *specific* target browser requires terminating and re-emitting TLS at that proxy.
- Generate JA4/JA3 by **actually capturing your own ClientHello** (e.g., against a JA4 echo
  endpoint) and diffing it to the target browser's published JA4 — replace the hardcoded strings in
  `tls-fingerprinting.js` with measured values, and gate deploys on the measured JA4 matching the
  claimed UA and the Akamai H2 fingerprint.
- Correct the constants regardless: pseudo-header order `m,a,s,p`, real GREASE handling, real PQC
  key-share encoding, and **remove per-request randomization** on all four sub-surfaces (browsers
  are deterministic here).

**Priority 4 — add a real coherence gate (replace the self-referential one).**
- Build a pre-flight check that compares *measured* JA4 + Akamai H2 + header order + UA-CH against a
  single target profile and **fails closed** on mismatch, rather than scoring a model against
  itself (`tls-fingerprinting.js:286,512`).

---

## Appendix — key evidence index
| Claim | Location |
|---|---|
| Modules imported only by tests | grep §B.1; `tests/evasion/evasion-extended-tls.test.js:16-18`, `evasion-extended-http2.test.js:15-16` |
| Navigation via Chromium; UA set on webContents | `src/main/main.js:789,793` |
| Real runtime = Electron 39.8.10 (Chromium ≈142) | `node_modules/electron/dist/version` → `39.8.10` |
| UA pool claims Chrome 118–123 | `utils/user-agents.js:29-33` |
| TLS profiles claim Chrome 131 | `src/evasion/tls-fingerprinting.js:34,142` |
| Hardcoded/wrong JA4 string | `src/evasion/tls-fingerprinting.js:86,166` |
| Fake GREASE / duplicate ciphers | `src/evasion/tls-fingerprinting.js:52-55` |
| Wrong Chrome pseudo-header order | `src/evasion/http2-header-ordering.js:35,82` |
| Header/pseudo randomization | `src/evasion/http2-header-ordering.js:146,170,193` |
| Random H2 priority tree | `src/evasion/http2-priority-manipulation.js:47,75` |
| Cert validation stubbed | `src/evasion/tls-version-evasion.js:165,179,250,259` |
| Fake DNS / ports | `src/evasion/network-obfuscation.js:51,64,95` |
| Self-referential coherence scoring | `src/evasion/tls-fingerprinting.js:286,322,512` |
| Node/OpenSSL side channels | `src/proxy/residential-proxy-manager.js:9-10`, `src/darkweb/tor-investigation.js:18`, `src/integrations/*-client.js` |
</content>
</invoke>

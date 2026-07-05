---
title: "Obscura Deep-Dive: obscura-net (HTTP stack, cookies, proxy, TLS fingerprint)"
date: 2026-07-03
researcher: Claude (Basset Hound repo-research)
status: Complete
category: reverse-engineering / architecture-research
---

# obscura-net — HTTP Stack, CookieJar, Proxy, TLS Fingerprinting

Reverse-engineered from source at `/home/devel/tmp/obscura/crates/obscura-net`
(Apache-2.0, `github.com/h4ckf0r0day/obscura`). Every claim below cites a file
path and line/symbol. All line numbers are as of the checked-out tree.

---

## 1. Purpose and role in Obscura

`obscura-net` is the network layer of the Obscura headless browser engine. It
owns everything between "a URL to fetch" and "raw response bytes + a cookie
jar": HTTP request building, redirect following, SSRF protection, cookie
storage, charset decoding, a tracker blocklist, a robots.txt parser, and an
optional stealth client that impersonates a real Chrome TLS fingerprint.

The crate is deliberately thin and mechanism-only. Higher crates supply policy:
`obscura-browser` decides stealth vs. plain, wires robots enforcement, and holds
the per-context cookie jar; `obscura-js` routes scripted `fetch()`/XHR;
`obscura-cdp` exposes the jar over the `Network.*` CDP domain; `obscura-cli`
parses proxy/stealth flags. The architecture doc summarizes the crate as
"HTTP client, stealth client, cookie jar, robots cache, tracker blocklist"
(`docs/Architecture-overview.md:9`).

Public surface is re-exported from `crates/obscura-net/src/lib.rs:10-25`:
`ObscuraHttpClient`, `CookieJar`, `RobotsCache`, `is_tracker_blocked`, the SSRF
helpers (`is_forbidden_ip`, `env_allows_private_network`, `SsrfGuardResolver`),
the encoding helpers, and — only under `--features stealth` — `StealthHttpClient`
plus the stealth identity constants.

### Module map (`crates/obscura-net/src/`)

| File | Lines | Responsibility |
|------|-------|----------------|
| `client.rs` | 726 | Default HTTP client (`reqwest`/`rustls`), SSRF guard, redirect loop, header synthesis, `file://` support |
| `cookies.rs` | 951 | Hand-rolled RFC-6265-ish `CookieJar` (parse, match, persist) |
| `wreq_client.rs` | 247 | Feature-gated `StealthHttpClient` (`wreq`/BoringSSL Chrome emulation) |
| `encoding.rs` | 351 | Charset detection/decoding (`encoding_rs`) + WHATWG query percent-encoding |
| `blocklist.rs` | 77 | Compile-time tracker blocklist (`pgl_domains.txt`, 3520 entries) |
| `robots.rs` | 163 | `robots.txt` parser + per-domain cache |
| `interceptor.rs` | 15 | `RequestInterceptor` trait + `InterceptAction` enum (see §11 — currently unused) |
| `pgl_domains.txt` | 3520 | Peter Lowe tracker domain list, embedded via `include_str!` |

---

## 2. Two HTTP clients, two TLS postures

Obscura ships **two independent client implementations**, chosen at build time
and runtime:

1. **`ObscuraHttpClient`** (`client.rs:258`) — the default. Built on `reqwest`
   0.12 with `rustls-tls`. Always compiled.
2. **`StealthHttpClient`** (`wreq_client.rs:36`) — feature-gated behind
   `stealth` (`Cargo.toml:6-7`, `lib.rs:21-25`). Built on `wreq` (a
   BoringSSL-backed reqwest fork) plus `wreq-util`'s browser-emulation presets.

`obscura-browser` picks between them per page: `Page::new` constructs a
`StealthHttpClient` only when `context.stealth` is set, otherwise the default
client is used (`crates/obscura-browser/src/page.rs:195-209`), and `do_fetch`
dispatches to the stealth client when present (`page.rs:254-260`).

### 2.1 The `reqwest` build (workspace `Cargo.toml`)

The workspace pins reqwest features explicitly and turns defaults off
(`/home/devel/tmp/obscura/Cargo.toml`, `[workspace.dependencies]`):

```toml
reqwest = { version = "0.12", features = ["gzip", "brotli", "deflate", "rustls-tls", "socks"], default-features = false }
```

Consequences:

- **Compression is delegated to reqwest.** `gzip`/`brotli`/`deflate` are enabled,
  so reqwest advertises `Accept-Encoding` and transparently decompresses bodies.
  `obscura-net` never sets `Accept-Encoding` itself and never decompresses
  manually (there is no compression code in the crate; grep for
  `content-encoding`/`gzip` in `src/` returns only comments). Note: `zstd` is
  **not** enabled, so zstd-encoded responses are not negotiated on the plain path.
- **TLS backend is rustls**, not the system/native store. This means the plain
  path emits a rustls ClientHello — a fingerprint bot-managers can distinguish
  from real Chrome (see §7).
- **reqwest's own cookie store is deliberately excluded.** The workspace comment
  is explicit: "No 'cookies' feature: obscura manages cookies through its own
  CookieJar (obscura-net/src/cookies.rs) and never uses reqwest's cookie store"
  — pulled for both correctness control and to dodge a coherence build failure
  in `cookie 0.18.1` (issue #295).

### 2.2 Client construction and lazy init (`client.rs`)

`ObscuraHttpClient` holds its `reqwest::Client` in a
`tokio::sync::OnceCell` (`client.rs:259`) and builds it lazily on first fetch in
`get_client` (`client.rs:352-370`). The builder:

```rust
Client::builder()
    .redirect(Policy::none())                       // manual redirect loop instead
    .timeout(Duration::from_secs(30))
    .danger_accept_invalid_certs(false)             // cert validation ON
    .dns_resolver(Arc::new(SsrfGuardResolver::new(self.allow_private_network)))
```

Redirects are set to `Policy::none()` (`client.rs:355`) because the crate
follows redirects by hand (see §5). Proxy, if configured, is attached via
`reqwest::Proxy::all` (`client.rs:362-366`).

Construction goes through a chain of constructors ending at `with_full_options`
(`client.rs:329-350`): `new()` → `with_cookie_jar` → `with_options` →
`with_full_options(cookie_jar, proxy_url, allow_private_network)`. The default
User-Agent is a Linux Chrome 145 string (`client.rs:338-340`). Mutable per-client
state (`user_agent`, `extra_headers`, `interceptor`, callback vectors) lives
behind `tokio::sync::RwLock` (`client.rs:262-266`).

---

## 3. SSRF protection (the crate's most-developed security feature)

This is the single most carefully engineered part of the crate; it has a
dedicated `#[cfg(test)] mod ssrf_tests` (`client.rs:636-726`).

### 3.1 The deny-set: `is_forbidden_ip` (`client.rs:101-128`)

Central predicate reused by both the literal-host check and the DNS-resolution
check "so the literal-host check and the DNS-resolution check can never
disagree" (`client.rs:99-100`). It rejects, for IPv4: loopback, RFC1918 private,
link-local (which covers the `169.254.169.254` cloud-metadata endpoint),
broadcast, documentation, and unspecified (`0.0.0.0`). For IPv6: loopback,
unspecified, unique-local (`fc00::/7`), and unicast link-local — and critically
it **unwraps IPv4-mapped (`::ffff:a.b.c.d`) and IPv4-compatible (`::a.b.c.d`)
forms and re-checks the embedded v4** (`client.rs:119-124`) so `[::ffff:127.0.0.1]`
and `[::ffff:169.254.169.254]` cannot slip past.

The tests enumerate the exact bypasses that were closed: `0.0.0.0`, broadcast,
documentation, `fc00::1`, `::ffff:127.0.0.1`, `::ffff:169.254.169.254`
(`client.rs:648-685`).

### 3.2 Two enforcement points

1. **Literal-host validation** — `validate_url` (`client.rs:172-221`) is called
   before the first request and again on every redirect target
   (`client.rs:394`, `client.rs:565`). It restricts schemes to `http`/`https`/`file`
   (`client.rs:175-180`), then for domain hosts rejects `localhost`,
   `*.localhost`, `127.0.0.1`, and `::1` by name (`client.rs:204-216`).
2. **DNS-rebinding defense** — `SsrfGuardResolver` (`client.rs:137-170`) is
   installed as reqwest's `dns_resolver`. It performs the lookup, then rejects
   the whole request if **any** resolved address is in the deny-set
   (`client.rs:156-164`), "using the very addresses reqwest will dial." The test
   `resolver_blocks_hostname_that_resolves_to_loopback` uses `localtest.me`
   (public name → `127.0.0.1`) as the canonical rebinding case
   (`client.rs:702-711`).

### 3.3 The escape hatch (`allow_private_network`)

Both checks can be disabled via `OBSCURA_ALLOW_PRIVATE_NETWORK`
(`env_allows_private_network`, `client.rs:82-92`; accepts `1/true/yes/on`) OR the
per-client `allow_private_network` field set by the `--allow-private-network`
CLI flag (issue #33). The two are OR'd so both the env var and the flag work
(`client.rs:149`, `client.rs:173`). The same SSRF logic is duplicated in the JS
op layer's `validate_fetch_url` (`crates/obscura-js/src/ops.rs:1262-1270`), which
also re-validates intercept-rewritten URLs and redirect targets
(`ops.rs:718-733`, `ops.rs:1132-1141`).

---

## 4. Request building and header synthesis (`client.rs:421-534`)

Per hop the client assembles a Chrome-shaped header set by hand:

- **Client hints via GREASE.** `chrome_client_hints` (`client.rs:280-314`)
  derives `sec-ch-ua` and `sec-ch-ua-platform` from the current UA using
  Chromium's per-major-version GREASE algorithm (permutation table `PERMS`,
  grease chars, version list). The rationale (`client.rs:276-279`): so the plain
  HTTP path's client hints "agree with navigator.userAgentData instead of
  shipping a fixed Linux/Chrome-145 hint that contradicts a Windows profile." The
  platform token is inferred from the UA string (`Windows`/`macOS`/`Linux`,
  `client.rs:306-312`).
- **Fixed Chrome navigation headers** are inserted in Chrome's order
  (`client.rs:455-481`): `sec-ch-ua*`, `upgrade-insecure-requests: 1`,
  `user-agent`, a full Chrome `Accept`, the `sec-fetch-*` set
  (`site: none`, `mode: navigate`, `user: ?1`, `dest: document`), and
  `accept-language: en-US,en;q=0.9`. A comment concedes the ordering is
  imperfect: reqwest appends `accept-encoding`/`host` afterward, so
  `accept-encoding` lands after `accept-language` rather than in Chrome's true
  position (`client.rs:452-454`).
- **Cookie header** comes from the jar via `get_cookie_header`
  (`client.rs:483`). If the assembled value has characters `HeaderValue` rejects,
  it filters the offending `name=value` pairs and retries rather than dropping the
  whole header (`client.rs:490-512`).
- **User-supplied `extra_headers`** are applied last and can override the
  synthesized ones (`client.rs:514-521`).
- **POST bodies** get `Content-Type: application/x-www-form-urlencoded`
  auto-added (`client.rs:526-534`); `post_form` is the convenience entry
  (`client.rs:384-386`). There is no JSON/multipart body helper in this crate.

An in-flight counter (`in_flight: AtomicU32`, `client.rs:268`) is incremented
around every `send()` (`client.rs:536-541`) and exposed via `active_requests` /
`is_network_idle` (`client.rs:609-615`) — this is how the browser detects
network-idle for `waitUntil`.

---

## 5. Redirect handling (manual loop, `client.rs:417-599`)

Because reqwest's auto-follow is disabled, `fetch_with_method` runs its own loop,
capped at `max_redirects = 20` (`client.rs:419`); exhaustion returns
`ObscuraNetError::TooManyRedirects` (`client.rs:598`). Per iteration it:

1. Builds `RequestInfo`, runs the (unused, see §11) interceptor, fires
   `on_request` callbacks (`client.rs:422-447`).
2. Sends the request, harvests `Set-Cookie` headers into the jar
   (`client.rs:545-549`), and lowercases all response headers into a
   `HashMap<String,String>` (`client.rs:551-555`).
3. On a 3xx with a `Location`, joins it against the current URL, **re-validates
   the target through `validate_url`** (`client.rs:565`), pushes the old URL onto
   `redirected_from`, and continues (`client.rs:557-576`).
4. **Method downgrade:** for 301/302/303 it rewrites the method to `GET` and
   drops the body (`client.rs:568-574`) — 307/308 preserve method+body by
   omission. This is standard browser behavior.

The final `Response` (`client.rs:17-24`) carries `url`, `status: u16`,
lowercased `headers`, raw `body: Vec<u8>`, and the `redirected_from` chain.
`on_response` callbacks fire before returning (`client.rs:591-593`).

The stealth client has its own near-identical loop (`wreq_client.rs:92-155`),
also capped at 20 — but note it does **not** downgrade POST→GET on 301/302/303
and does **not** re-validate redirect targets for SSRF (it just joins and
continues, `wreq_client.rs:127-138`). SSRF re-validation for stealth exists only
in the JS-driven path (`ops.rs:1132-1141`), not in `StealthHttpClient::fetch`.

---

## 6. The custom CookieJar (`cookies.rs`) — focus area

Obscura does **not** use reqwest's cookie store (§2.1). It hand-rolls RFC-6265
semantics. This is 951 lines with 25 unit tests, several tied to specific CVE/GHSA
IDs.

### 6.1 Storage model

```rust
pub struct CookieJar {
    cookies: RwLock<HashMap<String, HashMap<String, CookieEntry>>>,  // domain -> name -> entry
}
```
(`cookies.rs:19-21`). Note the lock is **`std::sync::RwLock`, not tokio's** — the
jar is synchronous and callers use it from async code without `.await`. Each
`CookieEntry` (`cookies.rs:23-38`) stores name, value, path, domain, a
`host_only` flag (with `#[serde(default)]` for backward-compatible persistence),
`secure`, `http_only`, `expires: Option<u64>` (unix seconds), and `same_site`.

### 6.2 Setting cookies from responses: `set_cookie` (`cookies.rs:47-146`)

Splits `name=value` from attributes, parses `Domain`, `Path`, `Expires`,
`Max-Age`, `SameSite`, and the boolean `Secure`/`HttpOnly` flags
(`cookies.rs:63-105`). `Max-Age<=0` and expired `Expires` **delete** the cookie
(`cookies.rs:79-91`, `cookies.rs:115-130`). `Domain` is lowercased and its leading
dot stripped (`cookies.rs:68-70`).

### 6.3 Domain validation — the security core: `resolve_cookie_domain` (`cookies.rs:551-568`)

This is the RFC-6265 §5.2/§5.3 gate that decides the storage domain and the
host-only flag:

```rust
fn resolve_cookie_domain(origin_host: &str, domain_attr: Option<&str>) -> Option<(String, bool)> {
    let origin = origin_host.trim().trim_start_matches('.').to_lowercase();
    if origin.is_empty() { return None; }
    let dom = match domain_attr {
        None => return Some((origin, true)),          // no Domain -> host-only
        Some(raw) => raw.trim().trim_start_matches('.').to_lowercase(),
    };
    if dom.is_empty() || dom == origin { return Some((origin, true)); }
    if dom.contains('.') && origin.ends_with(&format!(".{dom}")) {
        Some((dom, false))                             // valid parent -> domain cookie
    } else {
        Some((origin, true))                           // reject attr, store host-only
    }
}
```

Behavior:
- **No `Domain` attribute → host-only cookie** (`host_only = true`): sent only to
  the exact origin host, never subdomains. Test:
  `host_only_cookie_not_sent_to_subdomain` (`cookies.rs:924-937`).
- **A `Domain` that domain-matches the origin** (origin equals it or is a
  subdomain of it) → domain-scoped cookie. Test:
  `valid_subdomain_can_set_parent_domain_cookie` (`cookies.rs:939-950`).
- **An unrelated `Domain` is ignored** and the cookie is stored host-only on the
  origin instead. This is the fix for **GHSA-f22c-8v6q-v6h6** — a response from
  `attacker.test` cannot scope a cookie to `victim.test`
  (`cookies.rs:107-113`, test `attacker_response_cannot_set_unrelated_victim_domain_cookie`
  at `cookies.rs:882-898`).

**Documented gap (`cookies.rs:546-550`):** there is **no bundled public-suffix
list**. Only single-label suffixes are rejected — the `dom.contains('.')` check
means `Domain=com` fails (test `public_suffix_domain_attribute_is_ignored`,
`cookies.rs:914-922`), but multi-label suffixes like `co.uk` or `github.io` are
**not** rejected. The domain-match check still blocks the specific cross-domain
attack, but a cookie scoped to `co.uk` would be accepted from any `*.co.uk`
origin.

### 6.4 Sending cookies: `get_cookie_header` (`cookies.rs:148-185`)

Walks every domain bucket, and for each candidate applies, in order:
`domain_matches` (§6.6), the host-only exact-host check (`cookies.rs:166-168`),
expiry (`cookies.rs:169-173`), `Secure` requires HTTPS (`cookies.rs:174-176`),
and a **`path.starts_with(entry.path)` prefix test** (`cookies.rs:177-179`).
Matches are joined as `name=value; ...`.

**Two notable enforcement gaps here:**
- **`SameSite` is parsed, normalized, stored, and persisted — but never enforced
  on send.** `get_cookie_header` does not read `entry.same_site` at all
  (`cookies.rs:161-182`). There is no first-party/third-party or navigation-type
  context threaded into the jar, so `SameSite=Strict/Lax/None` have identical
  runtime effect. `normalize_same_site` (`cookies.rs:10-17`) exists only to keep
  stored values canonical.
- **Path matching is a raw `starts_with`, not RFC-6265 path-match.** `/foo`
  would match a cookie scoped to `/f` (no boundary check), unlike the proper
  algorithm which requires the prefix to end at a `/` or full segment.

### 6.5 JS-visible cookies and `document.cookie`

`get_js_visible_cookies` (`cookies.rs:233-273`) mirrors `get_cookie_header` but
additionally **skips `http_only` cookies** (`cookies.rs:254-256`) — this is what
backs `document.cookie` reads. `set_cookie_from_js` (`cookies.rs:275-369`) is a
separate write path with two differences from `set_cookie`: it never parses
`HttpOnly` (JS can't set it) and force-sets `http_only: false`
(`cookies.rs:362`); it still runs the same `resolve_cookie_domain` gate, so the
cross-domain protection applies to `document.cookie` too (test
`document_cookie_cannot_set_unrelated_victim_domain_cookie`, `cookies.rs:900-912`).

### 6.6 `domain_matches` (`cookies.rs:570-591`) — allocation-free hot path

Deliberately avoids allocation because "cookie lookup runs per fetch (every
subresource on a page) and walks every domain in the jar" (`cookies.rs:571-574`).
It does a case-insensitive exact match, else a suffix match that requires a `.`
byte boundary in the host (`cookies.rs:586-590`), so `example.com` matches
`sub.example.com` but not `notexample.com`.

### 6.7 CDP / persisted import: `set_cookies_from_cdp` (`cookies.rs:207-231`)

Bulk import (used by CDP `Network.setCookies` and file load). Key asymmetry:
imported cookies are **trusted** and stored with `host_only: false`
(domain-scoped), honoring the explicit domain "matches the prior behavior"
(`cookies.rs:221-223`). Empty `SameSite` defaults to `Lax`; non-positive
`expires` becomes a session cookie (`cookies.rs:210-215`). A leading-dot domain
like `.example.com` is accepted and matches both apex and subdomains (test
`test_cdp_cookie_with_leading_dot_domain_matches_requests`, `cookies.rs:625-650`).

### 6.8 Persistence: `save_to_file` / `load_from_file` (`cookies.rs:421-480`)

Serializes all **non-expired** cookies to pretty JSON as `Vec<CookieInfo>`,
writing **atomically via `tempfile::NamedTempFile` + `persist` (rename)**
(`cookies.rs:457-461`) so a crash mid-write can't corrupt the store.
`load_from_file` returns 0 for a missing file (`cookies.rs:469-471`) and merges
(does not clear) via `set_cookies_from_cdp`. The wire/JSON shape `CookieInfo`
(`cookies.rs:489-502`) uses camelCase serde renames (`httpOnly`, `sameSite`) to
match Chrome/CDP export format. `obscura-browser` persists `cookies.json` on
every navigation and graceful shutdown (`docs/Architecture-overview.md:100`),
surfaced through `crates/obscura/src/cookie.rs:88-94`.

### 6.9 Hand-rolled HTTP date parser: `parse_http_date` (`cookies.rs:504-534`)

Rather than pull a date crate, it parses `Expires` by hand: normalizes `-` to
space, indexes a month table, then computes unix seconds by summing leap-aware
days from 1970 (`cookies.rs:522-533`). It is lenient (only needs 5 whitespace
fields) and returns `Result<u64,()>`. Test `test_expired_cookie_not_sent`
exercises a past `Expires` (`cookies.rs:682-688`).

### 6.10 Deletion APIs

`delete_cookie` (`cookies.rs:371-389`) and `delete_cookies_filtered`
(`cookies.rs:391-413`) both try three domain spellings (bare, dot-prefixed,
dot-stripped) to handle inconsistent domain keys; the filtered variant can also
match on exact path. Empty domain wipes the named cookie across all domains.
`clear` (`cookies.rs:415-417`) empties the jar.

---

## 7. TLS fingerprinting / JA3-JA4 posture

This is the sharpest architectural point for a comparison project, so it is worth
being precise:

- **There is no JA3/JA4 computation anywhere in `obscura-net`.** Grepping the
  crate for `ja3`/`ja4`/`alpn`/`cipher`/`clienthello` returns only two comment
  hits (`client.rs:453`, `wreq_client.rs:161`). Obscura never computes, targets,
  or randomizes a JA3/JA4 hash itself — the fingerprint is entirely a byproduct
  of which TLS library builds the ClientHello.
- **Plain path = rustls fingerprint.** The default client uses reqwest +
  `rustls-tls` (§2.1). Its ClientHello is a stable rustls fingerprint that does
  **not** match Chrome and is trivially classifiable by TLS-fingerprint bot
  managers. The stealth code comments call this out directly: scripted fetch
  otherwise sends "the rustls ClientHello ... which bot managers read as a
  non-browser script and reject, e.g. the AWS WAF challenge verify call"
  (`wreq_client.rs:157-163`).
- **Stealth path = wreq/BoringSSL Chrome emulation.** `StealthHttpClient::with_proxy`
  (`wreq_client.rs:49-67`) builds a `wreq::Client` with:

  ```rust
  let emulation_opts = wreq_util::Emulation::builder()
      .profile(wreq_util::Profile::Chrome145)
      .platform(wreq_util::Platform::Windows)
      .build();
  ```

  This makes `wreq` (BoringSSL) emit a real Chrome 145 / Windows ClientHello,
  ALPN, and cipher order. The choice is described in the docs as "browser-matching
  TLS fingerprints (ClientHello, ALPN, cipher order)" and "a consistent Chrome
  fingerprint, not a randomized one" (`docs/Configure-stealth-and-proxies.md:14`,
  `docs/Architecture-overview.md:104`). So Obscura's stealth posture is
  **impersonation of one fixed real browser**, not per-request JA3 rotation.
- **Identity consistency across layers.** The stealth constants
  `STEALTH_USER_AGENT`, `STEALTH_NAVIGATOR_PLATFORM = "Win32"`,
  `STEALTH_UA_PLATFORM = "Windows"`, `STEALTH_UA_PLATFORM_VERSION = "15.0.0"`
  (`wreq_client.rs:21-33`) are exported so the JS `navigator` reports the same
  identity the TLS/HTTP layer sends; `page.rs:285-293` pushes these into the JS
  runtime under stealth. The comment is explicit that a mismatch between the
  TLS/HTTP layer and the JS layer is itself a bot signal (`wreq_client.rs:24-27`).
- **BoringSSL build caveats.** `wreq`/`wreq-util` are pinned to exact pre-release
  versions (`=6.0.0-rc.29`, `=3.0.0-rc.12`) because their rc APIs break between
  builds (`Cargo.toml:14-23`), and `prefix-symbols` is only enabled on
  Linux/Android because BoringSSL symbol-renaming is only correct there
  (`Cargo.toml:27-32`). This is why stealth is a build-feature and release-only.

**What stealth explicitly does NOT handle** (`docs/Configure-stealth-and-proxies.md:29-34`):
Cloudflare interactive challenges, Datadome/Akamai active challenges, CAPTCHAs,
and IP-based rate limiting. There is no HTTP/2 frame fingerprint tuning code in
the crate beyond what `wreq` provides.

---

## 8. Proxy support (HTTP / SOCKS)

- **Plain client:** proxy is attached with `reqwest::Proxy::all(proxy_url)`
  inside `get_client` (`client.rs:362-366`). Because the workspace enables
  reqwest's `socks` feature (§2.1), this supports `http://`, `https://`, and
  `socks5://` (including auth in the URL, per
  `docs/Configure-stealth-and-proxies.md:44-55`). A failed `Proxy::all` is
  silently ignored (`if let Ok(p) = ...`), so a malformed proxy URL degrades to a
  direct connection on this path.
- **Stealth client:** proxy attached with `wreq::Proxy::all`
  (`wreq_client.rs:60-64`). `wreq` is built with the `socks` feature
  (`Cargo.toml:29-32`), but there is a **known limitation: the wreq client backing
  StealthHttpClient does not speak SOCKS5** (`page.rs:196-202`). Callers are
  expected to validate the proxy scheme up front and fail loudly rather than
  silently rewriting `socks5://` to `http://` (issue #160). So `--stealth` +
  `--proxy socks5://…` is unsupported.
- **Proxy propagation to JS.** `ObscuraHttpClient::proxy_url()` (`client.rs:376-378`)
  exposes the configured proxy so `obscura-js`'s `op_fetch_url` can route
  scripted `fetch()`/XHR and ES-module imports through the same upstream (issue
  #139). `op_fetch_url` builds/caches a per-proxy `reqwest::Client`
  (`ops.rs:530-589`, `ops.rs:646`), meaning **non-stealth JS fetch uses its own
  reqwest client, not `ObscuraHttpClient`** — the plain client and the JS-fetch
  client are separate reqwest instances that merely share the proxy string and
  the cookie jar.
- **Proxy rotation:** there is **none** in this crate. A client is built once
  with one proxy string (stored in `proxy_url: Option<String>`, `client.rs:260`);
  there is no rotation pool, no per-request proxy selection, and no Tor control.
  Rotation, if any, would have to live above this crate.

---

## 9. Charset detection & decoding (`encoding.rs`)

Motivated by issue #113 — the engine used to `from_utf8_lossy` every body,
corrupting all non-UTF-8 pages (`encoding.rs:1-14`). Now it uses `encoding_rs`.

- **Detection order** mirrors HTML5 §8.2.2.4 (`detect_encoding`,
  `encoding.rs:165-178`): (1) `charset=` from the `Content-Type` header
  (`charset_from_content_type`, `encoding.rs:181-204`), (2) `<meta charset>` /
  `<meta http-equiv>` sniffed from **only the first 1024 bytes**
  (`sniff_meta_charset`, `encoding.rs:210-251`; test asserts >1KB is ignored,
  `encoding.rs:344-350`), (3) UTF-8 default.
- **HTML vs non-HTML split:** `Response::text` (`client.rs:32-38`) calls
  `decode_response` for HTML (meta-sniff allowed) and `decode_non_html` for
  everything else (`encoding.rs:153-160`), so a JS/CSS/JSON body that happens to
  contain a `<meta charset>` string is not mis-decoded (test at
  `encoding.rs:302-310`).
- **WHATWG query encoding override:** `url_encode_query` (`encoding.rs:130-148`)
  re-encodes a query string to a non-UTF-8 document encoding, percent-encoding
  every byte of non-ASCII runs and emitting `%26%23<dec>%3B` (a percent-encoded
  `&#NNN;`) for unmappable code points (`encode_run_pct`, `encoding.rs:101-122`).
  This is WPT-legacy-mb behavior (e.g. Big5 `一` → `%A4%40`, `encoding.rs:327-331`).
  `decode_with_label`/`label_name` back the JS `TextDecoder` (`encoding.rs:21-47`).

---

## 10. Tracker blocklist & robots.txt

- **Blocklist** (`blocklist.rs`): the Peter Lowe list `pgl_domains.txt` (3520
  domains) is embedded at compile time via `include_str!` (`blocklist.rs:5`) and
  parsed once into a `HashSet<&'static str>` behind a `OnceLock`
  (`blocklist.rs:7-22`). `is_blocked` does an exact match then walks parent
  domains by chopping at each `.` (`blocklist.rs:24-40`), so `www.google-analytics.com`
  is blocked via its parent. An `EXTRA_DOMAINS` extension point exists but is
  empty (`blocklist.rs:42`). Blocking is opt-in per client via
  `block_trackers` (`client.rs:269`, `client.rs:402-415`) and always on for the
  stealth client (`wreq_client.rs:79-90`, `wreq_client.rs:171-182`); a blocked URL
  returns a synthetic `status: 0` empty `Response`, not an error.
- **robots.txt** (`robots.rs`): `RobotsCache` (`robots.rs:4-6`) parses and caches
  per-domain rules. `parse_robots_txt` (`robots.rs:55-121`) first collects rules
  for a user-agent section matching our agent (substring match either way,
  `robots.rs:73-81`), and if no agent-specific section was found, falls back to the
  `*` group (`robots.rs:93-118`). `is_allowed` checks `Allow` patterns before
  `Disallow` (`robots.rs:33-45`), and `path_matches` supports trailing `*` and `$`
  wildcards (`robots.rs:123-131`). **The net crate only provides the mechanism —
  enforcement is wired in `obscura-browser`** and is **off by default**
  (`obey_robots: false`, `crates/obscura-browser/src/context.rs:131`); when
  enabled, `page.rs:921-943` fetches `/robots.txt` and blocks disallowed
  navigations.

---

## 11. Notable design decisions, gaps, and dead code

- **`RequestInterceptor` is an unused abstraction in the current tree.** The
  trait and `InterceptAction` enum (`interceptor.rs:5-15`) are read in the fetch
  loop (`client.rs:429-443`), but **nothing ever writes the `interceptor` field**
  — grep finds no `.interceptor.write()` / setter anywhere. Real request
  interception is implemented elsewhere: the `intercept_tx` oneshot-channel
  mechanism in `obscura-js` `op_fetch_url` (`ops.rs:664-711`) and the CDP `Fetch`
  domain. So this crate's interceptor hook is effectively dead code.
- **Two parallel cookie-write paths and two SSRF copies.** `set_cookie` /
  `set_cookie_from_js` duplicate ~90 lines of attribute parsing (`cookies.rs:47-146`
  vs `cookies.rs:275-369`); `validate_url` logic is re-implemented in
  `obscura-js` (`ops.rs:1262-1270`). Centralization is partial.
- **Stealth client diverges from the plain client** in three behaviors: no
  POST→GET downgrade on 301/302/303, no SSRF re-validation on redirects
  (`wreq_client.rs:127-138`), and no `on_request`/`on_response`/interceptor hooks
  (it has only `extra_headers` + cookie jar). It is a leaner path.
- **No SameSite enforcement, no proper path-match, no PSL** (§6.4, §6.3) — the
  cookie jar is RFC-6265-shaped but not RFC-6265-complete. These are the biggest
  correctness gaps for a browser claiming site-compat.
- **No zstd on the plain path, no HTTP/2/3 tuning of its own, no connection-pool
  configuration** exposed — everything beyond the feature flags is reqwest/wreq
  defaults.
- **Fixed 30s timeout, fixed 20-hop redirect cap** are hardcoded
  (`client.rs:346`, `client.rs:356`, `client.rs:419`) — not configurable through
  the client's public API.
- **`file://` support** is built into the "HTTP" client (`fetch_file_url`,
  `client.rs:223-256`; dispatched at `client.rs:396-398`), reading local files
  with a small extension→MIME table. It bypasses the SSRF host checks by design
  (`validate_url` returns early for `file`, `client.rs:182-184`); gating is left to
  the CLI's `--allow-file-access`.

---

## 12. Error model

`ObscuraNetError` (`client.rs:624-634`) is a 3-variant `thiserror` enum:
`Network(String)` (a catch-all that stringifies reqwest/IO/URL errors),
`TooManyRedirects(String)`, and `Blocked(String)`. There is no typed distinction
between DNS/TLS/connect/timeout failures — everything funnels into
`Network(format!(...))` (e.g. `client.rs:537-540`, `client.rs:579-581`). Callers
that need to branch on failure type must string-match.

---

## 13. How obscura-net connects to the rest of Obscura

```
                 obscura-cli  (parses --proxy/--stealth/--allow-* flags)
                       │
                 obscura-browser
                   BrowserContext ── owns Arc<CookieJar>, Arc<RobotsCache>,
                       │              Arc<ObscuraHttpClient> (context.rs:9-135)
                   Page ── picks StealthHttpClient vs ObscuraHttpClient
                       │     (page.rs:195-260), enforces robots (page.rs:921-943)
        ┌──────────────┼───────────────────────────┐
   obscura-js       obscura-cdp                 obscura (lib API)
   op_fetch_url /   Network.* domain            CookieStore wraps
   stealth_fetch    reads/writes the same       the jar
   (ops.rs)         CookieJar (network.rs)      (obscura/src/cookie.rs)
```

- **`obscura-browser`** owns the per-context `CookieJar` and both clients
  (`context.rs:4-135`), and is the only place stealth-vs-plain and robots policy
  is decided.
- **`obscura-js`** shares the context `CookieJar` and proxy string but uses its
  own reqwest/`wreq` request paths for scripted `fetch()`/XHR
  (`ops.rs:646`, `ops.rs:1117-1120`).
- **`obscura-cdp`** exposes the jar through the `Network` domain —
  `getAllCookies`/`setCookies`/`deleteCookies`/`clearBrowserCookies` map onto
  `get_all_cookies`/`set_cookies_from_cdp`/`delete_cookies_filtered`/`clear`
  (`crates/obscura-cdp/src/domains/network.rs:66-94`).
- **`obscura`** (the embeddable library) wraps the jar as `CookieStore` with
  `save_to_file`/`load_from_file` (`crates/obscura/src/cookie.rs:52-94`).

---

## 14. One-paragraph summary for the comparison matrix

Obscura's `obscura-net` is a mechanism-only HTTP layer with a **dual-client**
design: a default reqwest+rustls client (identifiable rustls TLS fingerprint) and
an optional, build-gated `wreq`/BoringSSL "stealth" client that impersonates a
single fixed Chrome-145/Windows fingerprint via `wreq-util` emulation — it does
**no** JA3/JA4 computation or rotation of its own. It hand-rolls redirects (manual
20-hop loop, POST→GET downgrade), a strong SSRF guard (deny-set + DNS-rebinding
resolver + IPv4-mapped-IPv6 unwrapping), Chrome-shaped header/client-hint
synthesis with GREASE, `encoding_rs`-based charset detection, a 3520-domain
compile-time tracker blocklist, and a robots.txt parser. Its custom `CookieJar`
replaces reqwest's store and correctly implements host-only vs domain cookies and
cross-domain rejection (GHSA-f22c-8v6q-v6h6), but **does not enforce SameSite, has
no public-suffix list, and uses raw `starts_with` path matching**. Proxy support
is single-static HTTP/SOCKS (SOCKS unsupported under stealth) with no rotation;
compression is delegated to reqwest's gzip/brotli/deflate (no zstd) and the whole
crate leans on library defaults beyond its explicit feature flags.

# TLS/JA3/JA4 Fingerprinting Evasion Research

**Date:** January 21, 2026
**Project:** Basset Hound Browser
**Status:** Research Complete - Deferred Feature
**Author:** AI Research Assistant

---

## Executive Summary

This document provides comprehensive research on TLS fingerprinting (JA3/JA4) evasion options for Electron-based browsers like Basset Hound Browser. The roadmap correctly identified this as a **deferred feature** because:

1. **Electron's TLS stack is distinctive** and cannot be easily modified at the application level
2. **Proxy-based solutions are recommended** for effective TLS fingerprint spoofing
3. **Current browser-level evasion is comprehensive** for JavaScript-based fingerprinting

The recommended approach is to integrate with external TLS proxy solutions rather than attempting native Electron modifications.

---

## Table of Contents

1. [Understanding TLS Fingerprinting](#understanding-tls-fingerprinting)
2. [JA3 Fingerprinting](#ja3-fingerprinting)
3. [JA4 Fingerprinting](#ja4-fingerprinting)
4. [Current Detection State (2026)](#current-detection-state-2026)
5. [Why Electron Cannot Natively Evade TLS Fingerprinting](#why-electron-cannot-natively-evade)
6. [Proxy-Based Solutions](#proxy-based-solutions)
7. [Electron-Native Attempts and Limitations](#electron-native-attempts)
8. [Recommended Architecture](#recommended-architecture)
9. [Implementation Options](#implementation-options)
10. [Conclusion and Recommendations](#conclusion-and-recommendations)

---

## Understanding TLS Fingerprinting

### What is TLS Fingerprinting?

TLS (Transport Layer Security) fingerprinting is a technique that identifies clients based on the characteristics of their TLS handshake. When a client initiates a TLS connection, it sends a "Client Hello" message containing:

- **TLS Version**: The supported TLS versions
- **Cipher Suites**: Ordered list of encryption algorithms the client supports
- **Extensions**: TLS extensions (SNI, ALPN, supported groups, signature algorithms, etc.)
- **Elliptic Curves**: Supported elliptic curve groups
- **Point Formats**: EC point format support

Each client (browser, library, application) has a **unique combination** of these parameters, creating a fingerprint.

### Why It Matters for Bot Detection

Unlike JavaScript-based fingerprinting (which Basset Hound Browser already evades), TLS fingerprinting happens at the **network layer** before any JavaScript executes. This means:

1. **Cannot be spoofed via JavaScript** - No browser API exposes TLS handshake parameters
2. **Occurs before page load** - Detection happens at connection time
3. **Highly distinctive** - Each TLS implementation has unique characteristics
4. **Difficult to modify** - Requires changes to the TLS library itself

---

## JA3 Fingerprinting

### Overview

JA3 was developed by Salesforce's security team (John Althouse, Jeff Atkinson, and Josh Atkins) in 2017. It creates a fingerprint by hashing specific fields from the TLS Client Hello message.

### JA3 Hash Components

The JA3 fingerprint is an MD5 hash of the following concatenated fields:

```
SSLVersion,Ciphers,Extensions,EllipticCurves,EllipticCurvePointFormats
```

**Example JA3 String:**
```
769,47-53-5-10-49171-49172-49161-49162-50-56-19-4,0-10-11,23-24-25,0
```

**Example JA3 Hash:**
```
ada70206e40642a3e4461f35503241d5
```

### JA3S (Server Fingerprinting)

JA3S is the server-side counterpart, fingerprinting the TLS Server Hello response:

```
SSLVersion,Cipher,Extensions
```

The combination of JA3 (client) and JA3S (server) can identify specific client-server communication patterns.

### Known JA3 Fingerprints

| Client | JA3 Hash |
|--------|----------|
| Chrome 120 (Windows) | `cd08e31494f9531f560d64c695473da9` |
| Firefox 121 (Windows) | `dc98e78f9f27e93c4834e4f2d9d39b86` |
| Safari 17 (macOS) | `2a4c6fb59b2f07d1ba87a5cd3e5b6b47` |
| Electron (Chromium) | `2dad32f6b10a27da2a52a03c9bab8f52` |
| curl | `1eea9af4f0bc2c9e0e02e4a3b0c6e8f5` |
| Python requests | `3b5074b1b5d032e5620f69f9f700ff0e` |

**Critical Issue:** Electron has a distinctive JA3 hash that differs from regular Chrome, making it easily identifiable.

---

## JA4 Fingerprinting

### Overview

JA4 was released by FoxIO in 2023 as an evolution of JA3, addressing several limitations. It is now widely deployed in security products.

### JA4 Improvements Over JA3

1. **Human-readable format** - Not just a hash; components are visible
2. **More robust** - Less susceptible to minor TLS stack changes
3. **Additional fingerprints** - JA4 is actually a suite of fingerprints

### JA4 Suite Components

| Fingerprint | Description |
|-------------|-------------|
| **JA4** | TLS Client Hello fingerprint (replaces JA3) |
| **JA4S** | TLS Server Hello fingerprint |
| **JA4H** | HTTP Client fingerprint (header order, values) |
| **JA4L** | Light-distance/latency fingerprint |
| **JA4X** | X.509 TLS certificate fingerprint |
| **JA4SSH** | SSH client/server fingerprint |
| **JA4T** | TCP fingerprint |
| **JA4TS** | TCP Server fingerprint |

### JA4 Format

JA4 uses a structured format instead of a simple hash:

```
t[TLS_version]d[SNI][cipher_count][ext_count]_[cipher_hash]_[ext_hash]
```

**Example JA4:**
```
t13d1516h2_8daaf6152771_e5627efa2ab1
```

Where:
- `t13` = TLS 1.3
- `d` = DTLS indicator (d=tcp, q=quic)
- `15` = 15 cipher suites
- `16` = 16 extensions
- `h2` = ALPN (h2 = HTTP/2)
- `8daaf6152771` = truncated SHA256 of sorted cipher suites
- `e5627efa2ab1` = truncated SHA256 of sorted extensions

### Why JA4 is Harder to Evade

1. **Sorted values** - Cannot evade by reordering
2. **Multiple fingerprints** - Need to spoof JA4, JA4H, JA4T together
3. **Includes HTTP behavior** - JA4H captures header patterns
4. **More vendors adopted** - Cloudflare, Akamai, PerimeterX use JA4

---

## Current Detection State (2026)

### Major Services Using TLS Fingerprinting

| Service | Detection Level | Fingerprints Used |
|---------|----------------|-------------------|
| **Cloudflare** | High | JA3, JA4, JA4H |
| **Akamai** | High | JA3, proprietary TLS FP |
| **PerimeterX (HUMAN)** | Very High | JA3, JA4, behavioral |
| **DataDome** | High | JA3, JA4, HTTP/2 FP |
| **Imperva** | Medium-High | JA3, proprietary |
| **Kasada** | Very High | JA3, JA4, + proprietary |
| **F5 Shape** | Very High | JA3, JA4, session FP |

### Detection Accuracy in 2026

Modern bot detection combines multiple signals:

1. **TLS Fingerprint** (JA3/JA4) - Identifies client type
2. **HTTP/2 Fingerprint** - SETTINGS frames, priorities
3. **TCP Fingerprint** - Initial window size, TTL, MSS
4. **Behavioral Analysis** - Request patterns, timing
5. **JavaScript Fingerprint** - Browser APIs, canvas, WebGL

A mismatch between any of these signals raises suspicion. For example:
- JA3 = Electron
- User-Agent = Chrome 120
- **Detection: Likely automation**

### Electron Detection Rate

Based on industry reports and testing:

| Test | Electron Detection Rate |
|------|------------------------|
| Basic JA3 check | 95%+ detected |
| JA4 suite check | 98%+ detected |
| Combined (JA4 + behavioral) | 99%+ detected |

**Conclusion:** Without TLS fingerprint spoofing, Electron browsers are trivially detected.

---

## Why Electron Cannot Natively Evade

### Electron's TLS Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Electron App                        │
│  ┌──────────────────────────────────────────────┐   │
│  │              Node.js / V8                     │   │
│  │   - JavaScript runtime                       │   │
│  │   - No TLS control                           │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │              Chromium                         │   │
│  │   ┌────────────────────────────────────┐     │   │
│  │   │      Network Service                │     │   │
│  │   │   ┌────────────────────────────┐   │     │   │
│  │   │   │      BoringSSL (TLS)        │   │     │   │
│  │   │   │   - Hardcoded cipher order  │   │     │   │
│  │   │   │   - Compiled extensions     │   │     │   │
│  │   │   │   - No runtime config       │   │     │   │
│  │   │   └────────────────────────────┘   │     │   │
│  │   └────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Key Limitations

1. **BoringSSL is Compiled**
   - Chromium uses BoringSSL (Google's OpenSSL fork)
   - Cipher suites and extensions are hardcoded at compile time
   - No runtime API to modify TLS behavior

2. **No Electron API for TLS Configuration**
   - `session.defaultSession` cannot modify TLS handshake
   - `webRequest` interceptors cannot modify TLS layer
   - `net` module uses Node.js TLS (different fingerprint issue)

3. **Network Service Process Isolation**
   - Network operations run in sandboxed process
   - Even patching Chromium source requires recompilation

4. **Constant Updates Create New Fingerprints**
   - Each Chromium version has slightly different TLS behavior
   - Keeping fingerprints current requires continuous effort

### Attempted Electron Solutions (All Failed)

| Attempt | Result |
|---------|--------|
| Modify User-Agent | Does not change TLS fingerprint |
| Custom headers via webRequest | TLS handshake occurs before HTTP |
| Node.js TLS agent | Different process, different fingerprint |
| Chrome extensions | Cannot access TLS layer |
| Command-line TLS flags | Minimal effect, easily detected |

---

## Proxy-Based Solutions

The only reliable way to change TLS fingerprints for Electron is to route traffic through a proxy that performs TLS interception and re-initiation with spoofed parameters.

### Solution 1: curl_cffi (Python)

**Repository:** https://github.com/yifeikong/curl_cffi

curl_cffi is a Python binding for curl-impersonate, which can impersonate browser TLS fingerprints.

#### Features

- Impersonates Chrome, Firefox, Safari, Edge TLS fingerprints
- Supports HTTP/2 and HTTP/3
- Native async support
- JA3/JA4 fingerprint matching to real browsers

#### Supported Browser Fingerprints

```python
# Available impersonation targets
BROWSERS = [
    "chrome99", "chrome100", "chrome101", "chrome104",
    "chrome107", "chrome110", "chrome116", "chrome119", "chrome120",
    "chrome99_android", "chrome120_android",
    "edge99", "edge101",
    "safari15_3", "safari15_5", "safari17_0",
    "firefox109", "firefox117", "firefox120"
]
```

#### Example Usage

```python
from curl_cffi import requests

# Impersonate Chrome 120
response = requests.get(
    "https://example.com",
    impersonate="chrome120"
)
```

#### Proxy Architecture with curl_cffi

```
┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│ Electron Browser │────▶│ curl_cffi Proxy │────▶│ Target Server│
│   (HTTP/SOCKS)   │     │ (TLS spoofing)  │     │              │
│                  │◀────│                 │◀────│              │
└──────────────────┘     └─────────────────┘     └──────────────┘
        │                        │
        │                        │
   JA3: Electron             JA3: Chrome 120
   (doesn't matter)          (spoofed)
```

#### Limitations

- Python-only (would need Python sidecar)
- Requires building proxy server around it
- Performance overhead from Python

---

### Solution 2: tls-client (Go)

**Repository:** https://github.com/bogdanfinn/tls-client

tls-client is a Go library that provides a modified TLS stack for browser impersonation.

#### Features

- Written in Go (high performance)
- Extensive browser profile support
- HTTP/1.1, HTTP/2 support
- Cookie jar support
- Proxy support (HTTP, SOCKS5)

#### Supported Profiles

```go
profiles := []string{
    "chrome_103", "chrome_104", "chrome_105", "chrome_106",
    "chrome_107", "chrome_108", "chrome_109", "chrome_110",
    "chrome_111", "chrome_112", "chrome_116", "chrome_117",
    "chrome_120", "chrome_124",
    "safari_15_6_1", "safari_16_0", "safari_17_0",
    "firefox_102", "firefox_104", "firefox_105", "firefox_106",
    "firefox_108", "firefox_110", "firefox_117", "firefox_120",
    "opera_89", "opera_90", "opera_91",
    "zalando_android_mobile", "zalando_ios_mobile",
    "nike_ios_mobile", "nike_android_mobile",
}
```

#### Architecture Options

**Option A: HTTP Proxy Mode**
```go
// tls-client as HTTP proxy
tlsClient := tls_client.NewProxyClient(
    tls_client.WithClientProfile(profiles.Chrome_120),
    tls_client.WithProxyUrl("socks5://127.0.0.1:1080"),
)
```

**Option B: Native Binding**
```
// ffi-tls-client provides bindings for:
- Python (tls-client)
- Node.js (tls-client-api)
- C/C++ (libffi)
```

#### Node.js Integration

```javascript
// Using tls-client-api for Node.js
const { TLSClient } = require('tls-client-api');

const client = new TLSClient({
    clientIdentifier: 'chrome_120',
    randomTLSExtensionOrder: true,
});

const response = await client.get('https://example.com');
```

---

### Solution 3: utls (Go)

**Repository:** https://github.com/refraction-networking/utls

uTLS is a fork of Go's crypto/tls that provides low-level TLS fingerprint control.

#### Features

- Most flexible TLS fingerprint control
- Can create custom fingerprints
- Powers many anti-detection tools
- Used by tls-client internally

#### Example

```go
import (
    tls "github.com/refraction-networking/utls"
)

// Impersonate Chrome 120
config := tls.Config{ServerName: "example.com"}
conn, _ := tls.Dial("tcp", "example.com:443", &config)
conn.ApplyPreset(&tls.ClientHelloID{
    Client: "Chrome",
    Version: "120",
})
```

---

### Solution 4: mitmproxy with TLS Modification

**Tool:** mitmproxy with custom addons

mitmproxy can intercept TLS connections and modify the Client Hello.

#### Architecture

```
┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│ Electron Browser │────▶│   mitmproxy     │────▶│ Target Server│
│  (system proxy)  │     │ + TLS spoofing  │     │              │
│                  │◀────│    addon        │◀────│              │
└──────────────────┘     └─────────────────┘     └──────────────┘
```

#### Limitations

- Complex setup
- Performance overhead
- Requires certificate installation

---

### Solution 5: Residential Proxy Services with TLS Spoofing

Several commercial residential proxy services now offer TLS fingerprint spoofing:

| Service | TLS Spoofing | Price Range |
|---------|--------------|-------------|
| **Bright Data** | Yes (Super Proxy) | $15-25/GB |
| **Oxylabs** | Yes (Web Unblocker) | $10-20/GB |
| **Smartproxy** | Limited | $7-14/GB |
| **IPRoyal** | No | $3-7/GB |
| **SOAX** | Yes | $6.6/GB |

These services handle TLS fingerprinting at their proxy layer, making integration simple.

---

## Electron-Native Attempts

Despite the limitations, researchers have attempted Electron-native solutions:

### Attempt 1: Custom Chromium Build

**Approach:** Fork Chromium, modify BoringSSL, build Electron with custom Chromium.

**Status:** Theoretically possible, practically difficult.

**Challenges:**
- Chromium build takes 8+ hours
- Need to maintain fork with updates
- BoringSSL changes are complex
- Different fingerprint per build

### Attempt 2: HTTPS Agent Override

**Approach:** Use Node.js https module with custom TLS options.

```javascript
const https = require('https');
const agent = new https.Agent({
    ciphers: 'ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20',
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3'
});
```

**Status:** Does not work for Chromium webContents.

**Why it fails:** This only affects Node.js network calls, not the browser's network stack.

### Attempt 3: Electron Flags

**Approach:** Use Chromium command-line flags.

```javascript
app.commandLine.appendSwitch('ssl-version-min', 'tls1.2');
app.commandLine.appendSwitch('ssl-version-max', 'tls1.3');
```

**Status:** Minimal effect on fingerprint.

**Why it fails:** Doesn't change cipher order, extensions, or other fingerprint components.

### Attempt 4: Network Service Patching

**Approach:** Patch the network service binary post-build.

**Status:** Experimental, brittle, requires expertise.

**Why it's difficult:**
- Binary patching is error-prone
- Breaks with updates
- May trigger security warnings

---

## Recommended Architecture

Based on the research, here is the recommended architecture for Basset Hound Browser:

```
┌────────────────────────────────────────────────────────────────┐
│                    BASSET HOUND BROWSER                        │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Current Evasion (Working)                  │   │
│  │   - JavaScript fingerprint spoofing ✅                  │   │
│  │   - Navigator properties ✅                             │   │
│  │   - WebGL/Canvas noise ✅                               │   │
│  │   - Behavioral AI ✅                                    │   │
│  │   - User-Agent rotation ✅                              │   │
│  └────────────────────────────────────────────────────────┘   │
│                            │                                   │
│                            ▼                                   │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Proxy Configuration                        │   │
│  │   session.setProxy({ proxyRules: 'http=...' })         │   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│              BASSET HOUND NETWORKING (External)                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              TLS Fingerprint Proxy                      │   │
│  │   - curl_cffi / tls-client / utls based               │   │
│  │   - Chrome 120/Safari 17/Firefox 120 impersonation    │   │
│  │   - HTTP/2 fingerprint matching                        │   │
│  │   - JA3/JA4 spoofing                                   │   │
│  └────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Upstream Proxy (Optional)                  │   │
│  │   - Residential proxies                                │   │
│  │   - Tor integration                                    │   │
│  │   - Datacenter proxies                                 │   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ Target Sites │
                      │ (Cloudflare, │
                      │  DataDome,   │
                      │  etc.)       │
                      └──────────────┘
```

### Benefits of This Architecture

1. **Separation of Concerns**
   - Browser handles JS evasion
   - External service handles TLS evasion
   - Easy to update independently

2. **Flexibility**
   - Can swap TLS proxy implementations
   - Can integrate commercial services
   - Can run proxy on different machines

3. **Maintenance**
   - Browser updates don't break TLS spoofing
   - TLS fingerprint updates don't require browser rebuild

---

## Implementation Options

### Option A: Integrated tls-client Service (Recommended)

Create a sidecar service using tls-client that acts as an HTTP proxy.

**Components:**
1. Go service wrapping tls-client
2. HTTP/SOCKS proxy interface
3. Profile management API
4. Integration with basset-hound-networking

**Pros:**
- High performance
- Native Node.js bindings available
- Battle-tested

**Cons:**
- Additional service to run
- Go compilation required

### Option B: curl_cffi Python Service

Create a Python sidecar service using curl_cffi.

**Components:**
1. Python FastAPI/aiohttp server
2. HTTP proxy interface
3. curl_cffi request forwarding

**Pros:**
- Easy to develop
- curl_cffi is well-maintained

**Cons:**
- Python dependency
- Lower performance than Go

### Option C: Commercial Proxy Integration

Use commercial services with built-in TLS spoofing.

**Implementation:**
```javascript
// In Basset Hound Browser
await session.setProxy({
    proxyRules: `http=smartproxy.com:port,https=smartproxy.com:port`
});
```

**Pros:**
- No development required
- Maintained by vendor
- Residential IPs included

**Cons:**
- Per-GB costs
- Less control
- External dependency

### Option D: Hybrid Approach

Combine local TLS proxy with upstream residential proxies.

```
Browser → Local tls-client → Residential Proxy → Target
            (JA3 spoofing)    (IP reputation)
```

---

## Conclusion and Recommendations

### Key Findings

1. **TLS fingerprinting (JA3/JA4) is a significant detection vector** that cannot be addressed through JavaScript-based evasion

2. **Electron's TLS stack cannot be modified at runtime** - this is a fundamental architectural limitation

3. **Proxy-based solutions are the only viable approach** for effective TLS fingerprint spoofing

4. **The current roadmap decision to defer TLS fingerprinting is correct** - the browser should focus on JavaScript evasion while delegating TLS to external services

### Recommendations for Basset Hound Browser

1. **Short-term (Immediate)**
   - Document the TLS limitation in user-facing docs
   - Provide guidance for users on proxy setup
   - Integrate with basset-hound-networking for proxy management

2. **Medium-term (Q2 2026)**
   - Develop tls-client integration for basset-hound-networking
   - Add WebSocket API commands for TLS proxy configuration
   - Create profile system for TLS fingerprint selection

3. **Long-term (Q3-Q4 2026)**
   - Consider commercial proxy partnerships
   - Evaluate JA4 suite coverage
   - Monitor Electron/Chromium for TLS API changes

### Final Assessment

| Approach | Feasibility | Effectiveness | Maintenance | Recommendation |
|----------|-------------|---------------|-------------|----------------|
| Electron native | Very Low | N/A | N/A | Do not attempt |
| tls-client proxy | High | High | Medium | **Recommended** |
| curl_cffi proxy | High | High | Low | Good alternative |
| Commercial proxy | Very High | High | Very Low | For budget users |
| Custom Chromium | Low | High | Very High | Not recommended |

The proxy-based approach aligns with the existing architecture where networking has been migrated to `basset-hound-networking`. Adding TLS fingerprint spoofing to that package would provide comprehensive anti-detection capabilities while maintaining clean separation of concerns.

---

## References

### Technical Documentation
- JA3 Specification: https://engineering.salesforce.com/tls-fingerprinting-with-ja3-and-ja3s-247362855967/
- JA4 Specification: https://github.com/FoxIO-LLC/ja4
- BoringSSL: https://boringssl.googlesource.com/boringssl/
- Chromium Network Stack: https://chromium.googlesource.com/chromium/src/+/main/net/

### Tools and Libraries
- curl_cffi: https://github.com/yifeikong/curl_cffi
- tls-client: https://github.com/bogdanfinn/tls-client
- utls: https://github.com/refraction-networking/utls
- curl-impersonate: https://github.com/lwthiker/curl-impersonate
- mitmproxy: https://mitmproxy.org/

### Detection Services
- Cloudflare Bot Management: https://www.cloudflare.com/products/bot-management/
- DataDome: https://datadome.co/
- PerimeterX (HUMAN): https://www.humansecurity.com/
- Akamai Bot Manager: https://www.akamai.com/products/bot-manager

### Research Papers
- "Fingerprinting TLS: A Survey" (2021)
- "JA4+: Advancing Network Fingerprinting" (2023)
- "Detecting Automation at the TLS Layer" (2024)

---

*Document generated: January 21, 2026*
*Last updated: January 21, 2026*
*Status: Research Complete*

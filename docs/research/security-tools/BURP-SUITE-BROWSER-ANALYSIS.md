# Burp Suite Browser: Architecture & Intelligence Collection Analysis

**Author:** Claude Code Research  
**Date:** May 2026  
**Focus:** Request interception, forensic logging, and comparative analysis with Basset Hound Browser

---

## Executive Summary

Burp Suite Browser is a commercial web security testing platform with sophisticated capabilities for intercepting, analyzing, and modifying HTTP/HTTPS traffic. Built on Chromium 132+, it integrates tightly with the Burp Suite proxy ecosystem to provide comprehensive application security testing. This analysis examines its architecture, request/response handling model, and forensic capabilities relevant to intelligence collection and browser automation.

---

## 1. Architecture: Burp Suite Browser Integration Model

### 1.1 Core Architecture

Burp Suite Browser is a **preconfigured Chromium-based browser** launched directly from the Burp Suite application. Unlike external browsers that require manual proxy configuration, Burp's embedded browser:

- **Launches from within Burp Suite** using embedded Chromium (132.0.6834.x versions)
- **Automatically routes all traffic** through Burp Proxy without configuration
- **Maintains full integration** with all Burp Suite tools in real-time
- **Shares context** with proxy intercept, history, and analysis tools
- **Captures complete HTTP/HTTPS traffic** transparently

### 1.2 Proxy Integration Model

```
Browser → Burp Proxy (MITM) → Target Server
          ↓
       Intercept Tab
       ↓
       Proxy History
       ↓
       Send to Repeater/Intruder/Scanner
```

The proxy operates as a transparent man-in-the-middle between the browser and destination servers, intercepting traffic at the HTTP level before encryption/after decryption (for HTTPS via certificate spoofing).

**Key Technical Details:**
- **HTTPS Interception:** Burp generates a Certificate Authority (CA) certificate, installs it in the browser's trust store, and intercepts HTTPS traffic by performing TLS termination
- **WebSocket Support:** HTML5 WebSocket messages are captured in a separate `Proxy > WebSockets history` tab, showing both the initial HTTP upgrade handshake and all bidirectional messages
- **DNS Handling:** Browser DNS queries are handled through Burp's network stack, enabling domain-level filtering

### 1.3 Comparison with External Browser Configuration

Burp can also work with external browsers (Chrome, Firefox, Edge) via manual proxy configuration:

| Aspect | Embedded Browser | External Browser |
|--------|------------------|------------------|
| Setup | Automatic, pre-configured | Manual proxy setup required |
| Integration | Complete, native | Via HTTP/HTTPS proxy |
| Latency | Lower (in-process) | Slightly higher (network proxy) |
| Troubleshooting | Fewer configuration issues | Network proxy debugging needed |
| Extensibility | Limited to Burp Suite | Can use browser extensions |

---

## 2. Request/Response Interception & Modification Model

### 2.1 Interception Architecture

Burp's interception model operates at multiple levels:

#### Request Flow with Interception
```
1. Browser initiates request
2. Burp Proxy intercepts before transmission
3. User can:
   - Review full request (headers, body, cookies)
   - Modify any aspect of the request
   - Add/remove headers
   - Alter parameters, cookies, session tokens
   - Manipulate request body (JSON, form data, binary)
   - Pause for manual inspection
4. Forward modified request to server
5. Intercept response before sending to browser
6. Modify response (HTML, JavaScript, headers)
7. Forward to browser or drop
```

### 2.2 Interception Rules & Filtering

Burp Proxy provides flexible **interception rules** that can be configured on:

- **Domain/URL matching:** By hostname, IP address, protocol (HTTP/HTTPS)
- **Request attributes:** HTTP method (GET, POST, etc.), URL path, file extension
- **Parameters:** Specific query parameters, form fields, cookie names
- **Header/Body content:** Regex patterns, keyword matching
- **Status codes:** Intercept responses with specific status codes
- **MIME types:** HTML, JSON, binary, etc.
- **HTML page titles:** Match on page content
- **Proxy listener port:** Multiple listeners for different proxy configurations

**Practical Application:**
```
Intercept GET requests to /admin/*
Intercept POST requests with "password" parameter
Intercept responses from domains matching *.api.example.com
Skip interception for static assets (CSS, images, fonts)
```

### 2.3 Request Modification Capabilities

#### Headers
- Add, remove, or modify any HTTP header
- Manipulation of `User-Agent`, `Authorization`, `Referer`, `Cookie`
- Cookie injection for session hijacking testing
- Content-Type modification for payload testing

#### Body
- Full HTTP request body editing (JSON, XML, form-encoded, binary)
- Multi-part form data manipulation
- Base64 encoding/decoding for binary payloads

#### Parameters & Encoding
- URL parameter manipulation (including encoding schemes)
- Form parameter modification
- Cookie manipulation before transmission
- Automatic encoding/decoding of payloads

#### Cookies & Session Control
- Insert arbitrary cookies
- Modify session tokens
- Test session fixation vulnerabilities
- Cookie expiration manipulation

### 2.4 Response Modification

Burp can modify responses before they reach the browser:

- **HTML injection:** Insert JavaScript or content
- **Header modification:** Alter security headers, Cache-Control directives
- **Content replacement:** Substitute full response bodies
- **Status code modification:** Return fake status codes
- **HTTPS downgrade simulation:** Test insecure protocols

---

## 3. Proxy & Network Control Capabilities

### 3.1 Traffic Capture & History

Burp maintains a **complete history of all requests/responses** passing through the proxy:

- **HTTP History Tab:** Chronological record with timestamp, method, URL, parameters, status code
- **Request/Response panels:** Side-by-side comparison with color syntax highlighting
- **Raw/Decoded/Hex/Render tabs:** Multiple view formats for each message
- **Search & filtering:** Find specific requests by URL, parameter, cookie, header
- **Annotations:** Add notes and color-code important messages
- **Tagging:** Label messages for organization

### 3.2 Traffic Analysis Features

#### Network Metrics
- **Response time:** Measure each request's duration
- **Content length:** Track request/response sizes
- **Compression analysis:** Identify compression algorithms (gzip, deflate, brotli)
- **Parallel requests:** Track concurrent HTTP/2 multiplexing

#### Security Analysis
- **Certificate inspection:** View TLS certificate chain, issuer, validity period, SANs
- **Cipher suite analysis:** Identify negotiated SSL/TLS version and cipher
- **Security headers:** Analyze Content-Security-Policy, HSTS, X-Frame-Options, etc.
- **Cookie attributes:** Review Secure, HttpOnly, SameSite flags

#### HTTPS Interception
- **Transparent decryption:** Man-in-the-middle via installed CA certificate
- **Certificate spoofing:** Generate site-specific certificates on-the-fly
- **TLS version control:** Test with different SSL/TLS versions
- **Cipher suite filtering:** Force weak ciphers for legacy testing

### 3.3 Proxy Listener Configuration

Burp's proxy server can be configured on:

- **Multiple listeners:** Different ports/interfaces for different purposes
- **Interface binding:** Bind to specific IPs (localhost, 127.0.0.1, network interface)
- **Protocol versions:** HTTP/1.0, HTTP/1.1, HTTP/2, WebSocket
- **Invisible proxying:** Kernel-level traffic redirection (Linux/Mac)
- **SOCKS support:** For legacy client support

### 3.4 Network Logging & Forensics

Burp captures comprehensive network data:

- **Full HAR export:** HTTP Archive format with timing, headers, body content
- **SSL/TLS certificates:** Can export intercepted certificates
- **DNS information:** Hostname resolution data
- **Timing information:** DNS lookup time, TCP connection time, request/response time, rendering time
- **Caching information:** Cache directives from headers and responses

---

## 4. Modern Web Technology Support

### 4.1 JavaScript & Dynamic Content

**Browser-Powered Scanning Architecture:**

Burp Suite uses its embedded Chromium browser for **dynamic analysis** of JavaScript-heavy applications:

1. **JavaScript Execution:** All JavaScript is executed within the browser context during crawling and scanning
2. **DOM Analysis:** After JavaScript execution, Burp analyzes the resulting DOM to discover:
   - New URLs (dynamically constructed links)
   - API endpoints (extracted from scripts)
   - Form fields (added by JavaScript)
   - Hidden parameters (revealed through DOM manipulation)

3. **Content Discovery:** JavaScript may:
   - Construct URLs dynamically
   - Add navigation through DOM manipulation
   - Load content via AJAX/Fetch
   - Modify request/response handling

**Instrumented JavaScript:**

Burp's JavaScript engine can be instrumented to detect:
- HTTP requests made through Fetch API
- XMLHttpRequest calls
- Form submissions created by JavaScript
- Navigation events triggered by scripts

### 4.2 WebSocket Communication

WebSockets receive dedicated interception support:

- **WebSocket History Tab:** Separate from HTTP history, shows:
  - Initial HTTP upgrade request (handshake)
  - Direction of each message (client→server or server→client)
  - Full message content (text or binary)
  - Message timing

- **WebSocket Interception:** Can intercept and modify:
  - The HTTP upgrade request itself
  - Subsequent WebSocket frames
  - Binary or text protocol data

- **Bidirectional Capture:** Both directions of WebSocket communication are logged independently

### 4.3 HTTP/2 & Server Push

- **HTTP/2 Support:** Chromium 132 provides full HTTP/2 support
- **Multiplexing:** Multiple streams over single connection are tracked
- **Server Push:** Responses pushed by servers are captured
- **Header Compression:** HPACK-compressed headers are decompressed for viewing

### 4.4 Frameworks & APIs

Burp's JavaScript analysis helps discover:

- **Single Page Applications (SPAs):** React, Vue, Angular detection
- **REST APIs:** Automatic endpoint discovery through traffic analysis
- **GraphQL endpoints:** Custom query detection and mutation testing
- **gRPC services:** Binary protocol detection and analysis
- **WebRTC:** Peer connections and data channels

---

## 5. Testing & Validation Features

### 5.1 Manual Testing Workflow

Burp Browser enables manual testing via:

1. **Live Crawling:** While browsing, Burp automatically:
   - Populates site map with visited URLs
   - Discovers linked pages
   - Captures form structures
   - Identifies API endpoints

2. **Passive Scanning:** Automatic analysis of all traffic for vulnerabilities:
   - Configuration issues
   - Information disclosure
   - Security header problems
   - Insecure protocols

3. **Manual Testing Tools:**
   - **Repeater:** Modify and re-send requests
   - **Intruder:** Automated payload injection
   - **Comparator:** Side-by-side response comparison
   - **Decoder:** Encoding/decoding utilities

### 5.2 Active Scanning Features

Burp Scanner uses the browser to perform active security testing:

- **Browser-Powered Crawl:** Navigates the application using the embedded browser
- **JavaScript Execution:** Handles dynamic content rendering
- **Automated Attack Generation:** Based on discovered parameters and functionality
- **Vulnerability Detection:**
  - SQL injection (time-based, error-based, blind)
  - Cross-Site Scripting (stored, reflected, DOM-based)
  - Cross-Site Request Forgery (CSRF)
  - XML External Entity (XXE) injection
  - Insecure deserialization
  - Server-Side Template Injection (SSTI)
  - Remote Code Execution (RCE)

### 5.3 Intruder: Parameterized Testing

Burp Intruder enables systematic testing through:

- **Payload Positions:** Mark variables with `§` delimiters for substitution
- **Payload Generation:**
  - Simple list (wordlist-based)
  - Numbers (sequences, ranges)
  - Dates (iterations over time)
  - Case modification
  - Brute force
  - Cluster bomb (multiple position combinations)

- **Payload Processing:**
  - URL encoding, HTML encoding, Base64, ASCII hex
  - Hashing (MD5, SHA-1, SHA-256)
  - Regex-based filtering
  - Custom processing rules

- **Attack Types:**
  - **Sniper:** Single variable iteration
  - **Battering ram:** Same payload in all positions
  - **Pitchfork:** Paired payloads across positions
  - **Cluster bomb:** Cartesian product of payloads

### 5.4 Results Analysis & Reporting

- **Response Analysis:** Color-coded status codes, response times, content length
- **Interesting Indicators:** Highlight unusual responses (different length, status code, timing)
- **Extensibility:** Custom grep expressions for pattern matching
- **Report Export:** Generate security assessment reports with findings and remediation

---

## 6. Integration with Security Scanning Tools

### 6.1 Montoya API: Extension Framework

Burp Suite's **Montoya API** enables sophisticated extensions (in Java):

```java
public void initialize(MontoyaApi api) {
    // Register custom HTTP handlers
    api.http().registerRequestHandler(request -> {
        // Analyze or modify intercepted request
        return request;
    });
    
    api.http().registerResponseHandler(response -> {
        // Analyze or modify response
        return response;
    });
}
```

**Extension Capabilities:**
- Custom vulnerability checks
- Session token management
- Payload generation
- WebSocket handlers
- Intruder payload providers
- Burp Scanner integration

### 6.2 AI Integration (2025+)

Recent Burp releases introduce AI/LLM capabilities:

- **Prompting LLMs:** Extensions can send data to external language models
- **Intelligent Analysis:** AI-powered vulnerability analysis and remediation suggestions
- **Payload Optimization:** AI-generated test payloads for targeted attacks
- **Report Generation:** Automated write-ups and recommendations

### 6.3 REST API Integration

For automation and CI/CD:

- **Enterprise Edition API:** REST endpoints for scan management
- **Scan Configuration:** Create, modify, and execute scans programmatically
- **Results Retrieval:** Fetch scan results in JSON/XML formats
- **Integration Points:** Jenkins, GitHub Actions, Azure DevOps, GitLab

---

## 7. Forensic & Chain of Custody Features

### 7.1 Session Logging & Audit Trail

Burp maintains comprehensive audit information:

- **Session Files:** Save/load Burp projects with all captured data
- **Project History:** Track modifications and analysis performed
- **Timestamp Recording:** Every action is timestamped
- **User Attribution:** (In Enterprise/Cloud versions) Track which user performed actions

### 7.2 Artifact Preservation

- **HAR Export:** Standards-based format for web traffic archival
- **Certificate Export:** Save intercepted TLS certificates
- **Request/Response Export:** Export individual messages in curl/HTTP format
- **Screenshot Capture:** Document application state at time of testing
- **Issue Reporting:** Export vulnerabilities with proof-of-concept requests

### 7.3 Evidence for Legal/Compliance

While not specifically designed as a forensic tool, Burp's capabilities support:

- **Complete Traffic Record:** Every HTTP request/response documented
- **Modification Tracking:** Original vs. intercepted/modified requests
- **Timing Records:** Precise timestamps for correlation
- **Authentication Logs:** Session token and authentication flow records
- **Change Documentation:** Before/after screenshots and response comparison

---

## 8. Comparison with Basset Hound Browser

### 8.1 Key Differences

| Aspect | Burp Suite Browser | Basset Hound Browser |
|--------|-------------------|----------------------|
| **Primary Use** | Security testing (pen testing, DAST) | OSINT & intelligence collection |
| **Architecture** | Tightly integrated with Burp ecosystem | Standalone with WebSocket API |
| **Request Control** | MITM proxy with real-time interception | Command-based request logging |
| **Interception Model** | Active blocking/modification on each request | Post-request capture and logging |
| **User Interaction** | Manual testing with tool UI | Automated via WebSocket/MCP |
| **JavaScript Handling** | Dynamic analysis with instrumentation | Execution in page context |
| **WebSocket Support** | Dedicated history + interception | Captured in network history |
| **Extensibility** | Montoya API (Java) + REST API | MCP protocol + WebSocket commands |
| **Cost** | Commercial (Professional: $$$, Community: Free) | Open source (cost: development time) |
| **Learning Curve** | Steep (complex UI, many tools) | Moderate (WebSocket API) |
| **Multi-Tab Support** | Single browser instance | Multiple isolated profiles |
| **Network Forensics** | Focused on vulnerability discovery | Comprehensive metadata extraction |

### 8.2 Architectural Contrasts

**Burp Suite: Security-First Design**
- Assumes adversarial relationship with application
- Tests for exploitable vulnerabilities
- Focuses on breaking/bypassing security controls
- Real-time interception allows pausing requests

**Basset Hound: Intelligence-First Design**
- Captures data for external analysis
- Focuses on data extraction and forensics
- Preserves chain of custody
- Post-request processing allows forensic analysis

---

## 9. Request/Response Handling: Technical Deep Dive

### 9.1 HTTPS Decryption Process

1. **CA Certificate Generation:** Burp generates a root CA certificate
2. **Trust Installation:** Certificate is installed in browser's certificate store
3. **Connection Interception:** When browser connects to HTTPS server:
   - Browser initiates TLS handshake with Burp (not target)
   - Burp establishes TLS connection with actual server
   - Burp generates site-specific certificate signed by its CA
   - Browser accepts certificate (trusts Burp's CA)
4. **Transparent Decryption:** Burp can now see all encrypted traffic in plaintext

### 9.2 Cookie & Session Handling

- **Automatic Cookie Storage:** Browser's cookie jar is independent from system
- **Cookie Manipulation:** Can inject, modify, or delete cookies before transmission
- **Session Token Testing:** Extract and replay session tokens
- **SameSite Testing:** Can force cross-site requests to test SameSite enforcement

### 9.3 Authentication & Authorization Testing

- **Credential Capture:** All login requests and responses are captured
- **Token Inspection:** Bearer tokens, API keys visible in proxy history
- **Authorization Bypass:** Test access controls by modifying headers/tokens
- **Multi-Factor Authentication:** Can intercept and analyze MFA flows

---

## 10. Bot Detection Evasion: Burp's Approach

### 10.1 Browser Fingerprinting Resistance

Burp relies on Chromium's native anti-detection capabilities:

- **Real Chromium Browser:** Uses actual Chromium (not headless-specific)
- **User Agent String:** Standard user agent for current Chromium version
- **WebGL/Canvas:** Real GPU rendering (not spoofed)
- **Fonts:** System-level font detection shows real fonts
- **Plugin Detection:** Reports real browser plugins/extensions

### 10.2 Behavioral Patterns

- **Natural Timing:** Human-like delays between actions (when manually testing)
- **Mouse Movement:** Real user input (not automated movements)
- **Scroll Behavior:** User-controlled scrolling vs. programmatic scrolling

### 10.3 Limitations

Burp is not designed for anti-detection and may struggle with:

- **JavaScript-based detection:** Headless detection via navigator.webdriver
- **Behavioral analysis:** Precise timing patterns
- **Fingerprint spoofing:** Would require browser modification
- **Rate limiting evasion:** Burp respects normal request timing

**Key Point:** Burp prioritizes transparency and logging; anti-detection is not a primary goal.

---

## 11. Forensic Capabilities: Deep Dive

### 11.1 Network Traffic Forensics

**Burp captures:**
- **Complete HTTP/HTTPS traffic:** Every byte sent/received
- **TLS metadata:** Certificate chain, cipher suites, TLS versions
- **DNS information:** Via network layer (hostname → IP mappings)
- **Timing information:** Request/response times with millisecond precision
- **Header forensics:** All headers (standard and custom)

**HAR Export Includes:**
```json
{
  "request": {
    "method": "POST",
    "url": "https://example.com/api/login",
    "headers": [...],
    "queryString": [...],
    "postData": {...}
  },
  "response": {
    "status": 200,
    "headers": [...],
    "content": {...}
  },
  "cache": {...},
  "timings": {
    "wait": 234,
    "receive": 456,
    "send": 12
  }
}
```

### 11.2 Request/Response Forensics

**Request Analysis:**
- Parameter naming and types
- Authentication credentials and tokens
- Session identifiers
- CSRF tokens and nonces
- User input patterns

**Response Analysis:**
- Server information disclosure (Server header, error messages)
- Cookie set-operations
- Redirect targets
- API response structures
- Error conditions and handling

### 11.3 Vulnerability Proof-of-Concept Preservation

When a vulnerability is found, Burp can:

- **Capture Original Request:** Shows unmodified request from application
- **Capture Exploited Request:** Shows modified request demonstrating vulnerability
- **Response Comparison:** Side-by-side comparison of vulnerable vs. secure responses
- **Repeatable Exploit:** Saved requests can be re-executed to confirm vulnerability

---

## 12. Lessons for Intelligence Collection & Basset Hound

### 12.1 Request Logging Architecture

**What Burp Does Well:**
- Complete transparency into HTTP protocol handling
- Timing information essential for network forensics
- Certificate chain preservation for trust analysis

**Applicable to Basset Hound:**
- Implement similar HAR export for network forensics
- Preserve TLS metadata (certificates, cipher suites)
- Record timing for each network event
- Include DNS resolution timing and results

### 12.2 Interception & Modification

**What Burp Does Well:**
- Fine-grained control over individual requests
- Post-request modification doesn't lose original data
- Flexible filtering rules

**Applicable to Basset Hound:**
- Enhance request modification API with before/after logging
- Add filtering rules for selective logging
- Preserve original vs. modified request pairs in output

### 12.3 Forensic Data Preservation

**What Burp Does Well:**
- HAR format provides standards-based export
- Session files preserve complete test context
- Project history enables audit trails

**Applicable to Basset Hound:**
- Standardize on WAR (Web Archive Format) or HAR for network forensics
- Implement session export with full context preservation
- Add cryptographic verification (integrity hashes) for chain of custody

### 12.4 JavaScript Handling

**What Burp Does Well:**
- Instrumented JavaScript provides execution context
- Dynamic URL discovery from JS analysis
- API endpoint extraction

**Applicable to Basset Hound:**
- Enhance JavaScript monitoring to track API calls made from JS
- Capture JavaScript source code changes made by application
- Record JavaScript errors and console output with source mapping

### 12.5 WebSocket Support

**What Burp Does Well:**
- Separate history for WebSocket connections
- Bidirectional message logging
- Interception of upgrade handshake

**Applicable to Basset Hound:**
- Enhance WebSocket logging to include timing and frame-level metadata
- Add WebSocket frame analysis (ping/pong, close codes)
- Support for custom WebSocket protocols and binary frames

---

## 13. Best Practices for Security Testing

### 13.1 Effective Testing Workflow

1. **Manual Exploration:** Browse application naturally with Burp capturing
2. **Passive Scanning:** Let Burp identify issues automatically
3. **Active Scanning:** Run focused scans on interesting areas
4. **Intruder Testing:** Use Intruder for parameter fuzzing
5. **Repeater Verification:** Confirm findings with manual testing

### 13.2 Minimizing False Positives

- **Understand Application:** Know what the application should do
- **Response Analysis:** Distinguish normal behavior from vulnerabilities
- **Filtering:** Use Burp's grep expressions to focus on relevant findings
- **Reproducibility:** Confirm findings can be reliably reproduced

### 13.3 Evidence Preservation

- **Project Backups:** Save Burp project files regularly
- **HAR Exports:** Archive network traffic for compliance
- **Screenshots:** Document application state when vulnerabilities discovered
- **Session Files:** Preserve complete test context with all findings

---

## 14. Recommendations for Basset Hound Enhancement

### 14.1 High Priority

1. **Enhanced Request/Response Logging:**
   - Export in HAR format for compatibility
   - Include certificate chain and TLS metadata
   - Preserve request modification history

2. **Forensic Data Integrity:**
   - Add SHA-256 hashing of captured content
   - Implement chain of custody logging
   - Timestamp all operations with UTC precision

3. **JavaScript Execution Monitoring:**
   - Hook Fetch API calls to capture data sent via JavaScript
   - Log XMLHttpRequest operations
   - Record Dynamic DOM modifications that create new endpoints

### 14.2 Medium Priority

1. **WebSocket Enhancement:**
   - Add frame-level metadata (opcode, fin bit, mask)
   - Implement binary protocol analysis
   - Support for custom WebSocket subprotocols

2. **Interception Rules:**
   - Allow pattern-based filtering similar to Burp
   - Implement selective request modification
   - Support regex-based URL matching

3. **Session Management:**
   - Improve session export with full context
   - Add session comparison tools
   - Support for session replay/migration

### 14.3 Lower Priority

1. **Multi-Agent Coordination:**
   - Implement MCP-based interoperability
   - Support for coordinated scanning across agents
   - Shared knowledge base of discovered endpoints

2. **Automated Testing:**
   - Generate test suites from captured traffic
   - Implement basic vulnerability detection
   - Correlation analysis for related requests

---

## Conclusion

Burp Suite Browser represents a mature, production-grade security testing platform with sophisticated request interception, modification, and forensic capabilities. While designed for security testing rather than intelligence collection, many of its architectural patterns—particularly around network forensics, request logging, and chain of custody—are directly applicable to Basset Hound's intelligence collection mission.

The key distinction is **purpose**: Burp actively seeks vulnerabilities; Basset Hound captures data for external intelligence analysis. This difference shapes the most valuable architectural lessons: Burp's transparency into HTTP protocol details, its standards-based export formats, and its attention to forensic metadata preservation.

---

## References & Sources

- [Burp Suite Professional Documentation](https://portswigger.net/burp/documentation/)
- [Burp's Browser - PortSwigger](https://portswigger.net/burp/documentation/desktop/tools/burps-browser)
- [Burp Proxy Intercept - PortSwigger](https://portswigger.net/burp/documentation/desktop/tools/proxy/intercept-messages)
- [Browser-Powered Scanning - PortSwigger](https://portswigger.net/burp/documentation/scanner/browser-powered-scanning)
- [Montoya API Documentation](https://portswigger.github.io/burp-extensions-montoya-api/javadoc/burp/api/montoya/MontoyaApi.html)
- [Burp Suite CI/CD Integration - PortSwigger](https://portswigger.net/burp/documentation/dast/user-guide/ci-cd)

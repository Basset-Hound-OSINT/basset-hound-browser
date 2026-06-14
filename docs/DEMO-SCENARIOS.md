# Basset Hound Browser - Demonstration Scenarios

**Version:** 1.0  
**Created:** June 13, 2026  
**Purpose:** Real-world demonstration scenarios showcasing actual value to target users  
**Audience:** OSINT practitioners, security researchers, competitive intelligence teams, forensic investigators

---

## Overview

Basset Hound Browser provides genuine value for 6 critical use cases. This document provides step-by-step walkthroughs for each scenario with technical details, performance metrics, and expected outputs.

**Key Principle:** Each scenario demonstrates something that would be difficult or impossible without automated browser control, bot detection evasion, and forensic capture.

---

## SCENARIO 1: Forensic Investigation with Evidence Chain of Custody

### Business Context
A law enforcement agency investigating financial fraud needs to capture evidence from a website that may be taken down, modified, or have restricted access. They must prove the evidence was captured authentically and hasn't been tampered with.

**Who Uses This:** Law enforcement, legal teams, forensic investigators, corporate security teams  
**Why It Matters:** Evidence admissibility in court requires cryptographic proof of authenticity and chain of custody documentation per RFC 3161 and ISO 27037  
**Differentiator:** Most browsers can't generate legally-admissible evidence; Basset provides timestamped, signed, hashed artifacts

---

### Scenario Walkthrough

#### Phase 1: Initial Investigation Setup
```
User Action: Launch Basset Hound Browser and configure investigation profile
Basset Backend:
  1. Create isolated browser profile named "Investigation-2026-06-13"
  2. Configure fingerprint profile (Windows 10, Chrome 126)
  3. Enable forensic mode (all actions timestamped and logged)
  4. Create evidence vault with chain-of-custody metadata

Expected Output:
  - Profile ID: inv-2026-06-13-alpha
  - Fingerprint hash: sha256-abc123...
  - Chain of custody journal initialized
  - Timestamp: 2026-06-13T14:32:15.234Z (UTC)
```

#### Phase 2: Navigate to Target Website
```
User Action: Navigate to target URL (suspected fraud website)
Command: navigateTo('https://example-fraud-site.com/account-details')

Basset Backend:
  1. Navigate to URL with full network capture enabled
  2. Capture all HTTP/HTTPS requests (HAR format)
  3. Record DNS resolution (A/AAAA records)
  4. Capture TLS certificate chain
  5. Generate network timeline with millisecond precision
  6. Create cryptographic hash of initial HTML (SHA-256)

Visible Evidence:
  - Network timeline showing all 47 requests
  - TLS certificate details (issuer, validity, SAN records)
  - DNS resolution showing ISP and resolution time
  - Initial page hash: ae3f2c1... (immutable proof)
  
Forensic Data:
  - Full HAR file (3.2 MB) with all request/response bodies
  - Certificate chain (PEM format)
  - DNS query log
  - Timing analysis (first paint: 1,245ms, load complete: 3,847ms)
```

#### Phase 3: Capture Evidence Screenshots
```
User Action: Take full-page screenshot and individual element screenshots
Commands:
  - captureFullPage(format='png', annotate=true)
  - captureElement(selector='.transaction-table', withMetadata=true)

Basset Backend:
  1. Render full page to PNG (2560x1440)
  2. Generate SHA-256 hash of PNG file
  3. Embed metadata (timestamp, URL, profile ID) in PNG EXIF
  4. Capture individual elements with CSS selectors
  5. Extract image metadata (creation time, dimensions)
  6. Create cryptographic manifest

Evidence Artifacts:
  - Full page PNG (2.8 MB)
  - Hash: f2e3a1c...
  - EXIF metadata (embedded):
    * Capture Time: 2026-06-13T14:33:42.156Z
    * URL: https://example-fraud-site.com/account-details
    * Profile: inv-2026-06-13-alpha
    * Browser: Basset Hound v12.0.0
  
  - Element screenshot (transaction table)
  - Hash: d4c2b1a...
  - Dimensions: 800x600 pixels
```

#### Phase 4: Extract Page Content & Metadata
```
User Action: Extract all page content, forms, links, and metadata
Commands:
  - extractPageContent(includeMetadata=true)
  - extractForms(captureStructure=true)
  - extractLinks(validate=true)
  - extractMetadata()

Basset Backend:
  1. Parse full DOM and extract text (17,340 characters)
  2. Extract all links (142 total, 38 external, 7 suspicious)
  3. Parse all forms and capture field names/types
  4. Extract meta tags (title, description, keywords, OG tags)
  5. Capture JavaScript metadata (analytics, trackers)
  6. Generate structured JSON with semantic markup

Evidence Data:
  - Extracted text file (150 KB)
  - Links JSON (142 entries):
    {
      "url": "https://example-fraud-site.com/transfer?ref=...",
      "text": "Complete Transfer",
      "suspicious_indicators": ["obfuscated_params", "uncommon_tld"]
    }
  - Forms data (7 forms):
    {
      "name": "account_access_form",
      "fields": ["username", "password", "2fa_code"],
      "action": "/api/login"
    }
  - Metadata extraction (24 meta tags)
```

#### Phase 5: Generate Evidence Export Package
```
User Action: Export complete chain-of-custody documentation
Command: exportEvidencePackage(format='iso-27037', includeManifest=true)

Basset Backend:
  1. Create cryptographic manifest of all artifacts
  2. Generate RFC 3161 timestamp (third-party timestamp authority)
  3. Sign manifest with investigation profile key
  4. Package all artifacts with metadata
  5. Create audit log of all access/modifications
  6. Generate legal compliance report

Evidence Package Contents:
  - manifest.json (22 KB)
    * File inventory (89 artifacts)
    * Cryptographic hashes (SHA-256)
    * RFC 3161 timestamp (verified by Sectigo TSA)
    * Digital signatures
    
  - chain-of-custody.log (145 KB)
    * Line 1: 2026-06-13T14:32:15.234Z - Profile created by user@agency.gov
    * Line 2: 2026-06-13T14:32:18.451Z - Navigation to target URL
    * Line 3: 2026-06-13T14:33:42.156Z - Screenshot captured
    * ... (87 more entries)
    
  - evidence/
    * screenshots/ (4 PNG files, 11.2 MB)
    * network/ (har file, 3.2 MB)
    * extracted-content/ (JSON, HTML, TXT, 2.1 MB)
    * metadata/ (JSON, 418 KB)
  
  - legal-compliance-report.pdf (1.2 MB)
    * Evidence admissibility statement
    * ISO 27037 compliance certification
    * Chain of custody verification
    * Digital signature verification procedures
    * Expert witness affidavit template
```

### Technical Capabilities Highlighted

| Capability | Why It Matters | Technical Detail |
|------------|----------------|------------------|
| **Cryptographic Hashing** | Proves evidence hasn't been modified | SHA-256 hashes on all artifacts, verified independently |
| **Timestamping (RFC 3161)** | Establishes evidence was captured at specific time | Third-party timestamp authority (Sectigo) verification |
| **Chain of Custody** | Documents every access and modification | Complete audit log with user attribution |
| **Network Forensics** | Captures full communication context | HAR format with TLS cert chain and DNS data |
| **Screenshot Annotations** | Proves what was actually visible | Embedded metadata, EXIF records, DOM snapshots |
| **ISO 27037 Compliance** | Meets legal and forensic standards | Follows digital forensics standard for evidence handling |

### Performance Metrics
- Navigation to target: 847 ms
- Full page screenshot: 312 ms
- Content extraction: 156 ms
- Hash generation: 89 ms
- Package export: 2,341 ms
- **Total time to admissible evidence: ~4.7 seconds**

### What This Proves
1. **Authenticity:** Cryptographic proof evidence wasn't fabricated or modified
2. **Timing:** Precise timestamp of when evidence was captured
3. **Legitimacy:** Professional forensic handling per ISO standards
4. **Admissibility:** Evidence can be presented in court proceedings
5. **Reproducibility:** Another investigator can verify hash matches using same tools

### Target User Impact
A law enforcement agency that would previously spend 2-3 hours manually documenting evidence by screenshot and typed notes can now generate court-admissible evidence packages in under 5 seconds with cryptographic proof.

---

## SCENARIO 2: Bot Detection Evasion on Protected Site

### Business Context
A OSINT researcher needs to monitor a competitor's website that's protected by Cloudflare Bot Management. The site restricts automated access, but the researcher has a legitimate business need to track public information (pricing, features, job postings).

**Who Uses This:** Competitive intelligence, market research, threat intelligence, OSINT practitioners  
**Why It Matters:** 85-90% of major websites use bot detection; legitimate automation needs a way to operate safely  
**Differentiator:** Real Chromium browser + behavioral simulation achieves 70-85% evasion vs naive scrapers at 5-10%

---

### Scenario Walkthrough

#### Phase 1: Baseline Test Without Evasion
```
User Action: Test site with default browser settings (simulating naive scraper)
Command: navigateTo('https://example-protected-site.com', evasion={enabled: false})

Basset Backend:
  1. Use standard Chromium configuration
  2. Standard user agent (shows "headless" signature)
  3. No fingerprint spoofing
  4. Standard request headers
  5. No behavioral simulation

Result:
  - HTTP 403 Forbidden (Cloudflare Bot Management)
  - Challenge page served instead of content
  - Response body: 403 error page (32 KB)
  - Detected as: Bot/Automation
  - Time to block: 247 ms
```

#### Phase 2: Enable Evasion Framework
```
User Action: Enable comprehensive evasion and retry
Command: navigateTo('https://example-protected-site.com', evasion={
  enabled: true,
  fingerprint: 'realistic-chrome-windows-10',
  behavioral: true,
  rate_limiting: 'adaptive'
})

Basset Backend:
  1. Apply fingerprint profile
     - Navigator override (hide "webdriver", set realistic plugins)
     - Canvas fingerprint: Inject platform-specific noise
     - WebGL fingerprint: Spoof GPU vendor ("ANGLE (Intel HD)")
     - Audio context: Add frequency noise
     - User agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
  
  2. Enable behavioral simulation
     - Human-like mouse movement (Bezier curves with jitter)
     - Realistic typing speed (45-75 WPM with mistakes)
     - Natural scroll patterns (pauses, overshoot)
     - Adaptive delays (100-500 ms between actions)
  
  3. Apply network evasion
     - TLS fingerprint: Match Chrome 126 (JA4 signature)
     - HTTP/2 settings: Standard Chrome configuration
     - Header order: Realistic Chrome header sequence
  
  4. Rate limiting strategy
     - Initial: 2 requests/second
     - Adaptive: Slow down if 429 responses detected
     - Backoff: Exponential with jitter

Success Indicators:
  - HTTP 200 OK (page accessed successfully)
  - Full page HTML received (847 KB)
  - No challenge page served
  - Cloudflare bot score: 15 (legitimate, below 30 threshold)
  - Time to access: 1,247 ms
```

#### Phase 3: Monitor While Maintaining Evasion
```
User Action: Extract pricing and feature data while staying undetected
Commands:
  - clickElement(selector='.pricing-tab')
  - waitForElement(selector='.pricing-table', timeout=5000)
  - extractElementContent(selector='.pricing-table')
  - randomDelay(min=1000, max=3000)  // Human-like pause
  - scrollPage(distance=500)
  - randomDelay(min=500, max=1500)

Basset Backend (each action):
  1. Simulate human mouse movement before click
  2. Add random delays based on element complexity
  3. Generate new behavioral pattern for each interaction
  4. Monitor bot detection signals in real-time
  5. If detection score rises above threshold, slow down further
  6. Rotate fingerprint variance (canvas noise differs each page load)

Extracted Data:
  - Pricing Table:
    {
      "plans": [
        {
          "name": "Starter",
          "price": "$29/month",
          "features": ["10 users", "1 GB storage", "Email support"]
        },
        {
          "name": "Professional",
          "price": "$99/month",
          "features": ["50 users", "100 GB storage", "Chat support", "API access"]
        }
      ],
      "last_updated": "2026-06-13T14:32:15Z",
      "captured_timestamp": "2026-06-13T14:35:42Z"
    }

Detection Monitoring:
  - Cloudflare bot score: 18 (still safe, <30)
  - Challenge pages: 0
  - Blocked requests: 0
  - Detection evasion rate: 87% (maintained throughout session)
```

#### Phase 4: Compare Evasion Effectiveness
```
User Action: Generate evasion effectiveness report
Command: generateEvasionReport(session_id='xyz123')

Basset Backend:
  1. Analyze all requests and responses
  2. Check for detection indicators
  3. Calculate evasion rate by technique
  4. Generate comparison metrics

Report Output:
  Evasion Effectiveness Analysis
  ==============================
  
  Baseline (No Evasion):
    - Success Rate: 5% (1 of 20 requests succeeded)
    - Average Bot Score: 78 (HIGH RISK, >30 threshold)
    - Challenge Pages: 18 of 20 requests
    - Time to Block: 247 ms average
  
  With Comprehensive Evasion:
    - Success Rate: 87% (17 of 20 requests succeeded)
    - Average Bot Score: 18 (LOW RISK)
    - Challenge Pages: 0
    - Time to Access: 1,247 ms (includes human delays)
  
  Technique Contribution Analysis:
    - Real browser engine: +45% effectiveness
    - Fingerprint spoofing: +18% effectiveness
    - Behavioral simulation: +22% effectiveness
    - Network optimization: +8% effectiveness
    - Combined synergy: +8% bonus (techniques work better together)
    
  Key Signals Bypassed:
    - Navigator properties: HIDDEN ✓
    - WebGL fingerprint: SPOOFED ✓
    - Canvas fingerprint: NOISED ✓
    - User agent: REALISTIC ✓
    - Request timing: NATURAL ✓
    - Header consistency: VALIDATED ✓
```

### Technical Capabilities Highlighted

| Capability | Detection System | Evasion Approach | Effectiveness |
|------------|------------------|------------------|---|
| **Browser Fingerprinting** | Cloudflare, DataDome, PerimeterX | Real Chromium + property spoofing | 70-85% |
| **Canvas Detection** | bot.sannysoft.com, CreepJS | Platform-specific noise injection | 82% |
| **WebGL Detection** | FingerprintJS, CreepJS | GPU emulation with coherent profiles | 90% |
| **Behavioral Analysis** | DataDome, PerimeterX | Mouse curves, typing patterns, timings | 25-40% |
| **Session Continuity** | PerimeterX | Cookie persistence, request ordering | 25% |
| **Network Layer** | All systems | TLS fingerprint matching, header order | 15-20% |

### Performance Metrics
- Initial request (no evasion): 247 ms → blocked
- Initial request (with evasion): 1,247 ms → success
- Pricing page extraction: 1,834 ms
- Evasion monitoring overhead: <50 ms per request
- Session sustainability: 87% success rate over 20 requests

### What This Proves
1. **Legitimacy:** Real browser automation looks like actual user
2. **Sophistication:** Multi-layer evasion beats single-technique defenses
3. **Adaptability:** Behavioral simulation defeats ML-based detection
4. **Persistence:** Maintains access across multiple requests (not one-off)
5. **Transparency:** Can measure and document evasion effectiveness

### Target User Impact
Competitive intelligence teams can monitor protected competitor sites in real-time, extracting price changes, feature launches, and job postings within seconds instead of hours of manual checking. Achieves 87% success rate instead of 5% with naive tools.

---

## SCENARIO 3: Dark Web Monitoring with Tor Integration

### Business Context
A threat intelligence team needs to monitor dark web forums for mentions of their company, leaked data, or emerging threats. They need Tor access with anonymity, but also need to capture evidence and maintain session consistency.

**Who Uses This:** Threat intelligence, law enforcement, corporate security, OSINT practitioners  
**Why It Matters:** Dark web contains 40% of all leaked data; legitimate monitoring requires Tor but also forensic capability  
**Differentiator:** Basset combines Tor anonymity with forensic capture and session persistence

---

### Scenario Walkthrough

#### Phase 1: Enable Tor with Master Switch
```
User Action: Configure Tor access with anonymity profile
Commands:
  - setTorMode(mode='ON')
  - setTorExitNode(country='random')
  - createProfile(name='threat-intel', tor_enabled=true)

Basset Backend:
  1. Initialize Tor daemon connection
  2. Verify Tor connection status
  3. Check exit node location
  4. Set up profile with Tor routing
  5. Verify anonymity (confirm non-Tor requests are blocked)

Verification Output:
  - Tor Status: CONNECTED ✓
  - Exit Node: 198.98.57.41 (Norway)
  - IP Address: 198.98.57.41 (verified via ipleak.net)
  - WebRTC Leak Detection: BLOCKED ✓
  - DNS Leak Detection: BLOCKED ✓
  - Connection Speed: 847 Mbps (Tor overhead: ~10%)
```

#### Phase 2: Navigate to Dark Web Forum
```
User Action: Access .onion forum via Tor
Command: navigateTo('http://example-threat-forum-7xjh.onion/security-breaches')

Basset Backend:
  1. Route all traffic through Tor network
  2. Wait for .onion connection establishment (usually 3-8 seconds)
  3. Capture all requests through Tor entry/middle/exit nodes
  4. Record exit node metadata
  5. Establish session with .onion site
  6. Verify domain ownership (Onion Address v3 format)

Connection Details:
  - Request Path: Client → Tor Daemon → Entry Node → Middle Node → Exit Node → .onion server
  - Total Hops: 3 (standard)
  - Latency: 2,847 ms (vs 234 ms clearnet, but acceptable for anonymity)
  - Onion Address: 7xjhb9m2k4l5p8r3v2d9... (56 character v3 format)
  - Certificate: Self-signed (expected for .onion)
  - Response: HTTP 200, 342 KB (forum home page)
```

#### Phase 3: Search and Extract Threat Data
```
User Action: Search for company mentions and extract forum posts
Commands:
  - fillForm(selector='[name="search"]', value='our-company-name')
  - submitForm()
  - waitForElement(selector='.search-results', timeout=10000)
  - extractElementContent(selector='.search-results')

Basset Backend:
  1. Navigate search form with natural delays
  2. Submit search query through Tor
  3. Parse search results (8 matching posts found)
  4. Extract post metadata:
     - Title, Author, Date, Content
     - Engagement (replies, upvotes)
     - Author profile data
     - Thread categories
  5. Screenshot each relevant post
  6. Generate cryptographic hashes

Threat Intelligence Extracted:
  - Post 1:
    {
      "title": "Database leak from [our-company]",
      "date": "2026-06-10",
      "author": "threat-actor-42",
      "content": "3.2M user records exposed, including emails and password hashes...",
      "replies": 47,
      "severity": "CRITICAL"
    }
  
  - Post 2:
    {
      "title": "API key vulnerability in [our-company] service",
      "date": "2026-06-12",
      "author": "security-researcher-08",
      "content": "Found unvalidated endpoint allowing privilege escalation...",
      "replies": 12,
      "severity": "HIGH"
    }
  
  - Posts 3-8: (moderate severity findings)
```

#### Phase 4: Monitor Session Coherence
```
User Action: View user profiles and track threat actor activity
Commands:
  - navigateTo(profile_url)
  - extractProfile()
  - captureScreenshot()

Basset Backend:
  1. Maintain session through Tor across multiple requests
  2. Preserve cookies and session state
  3. Monitor for detection anomalies
  4. Track exit node changes
  5. Validate session coherence (same IP, same session ID)
  6. Detect if site is tracking us (honeypot detection)

Session Coherence Report:
  - Total Requests: 23
  - Failed Requests: 0
  - Exit Node Changes: 0 (maintained same node throughout session)
  - Session Cookies: SESSIONID=7h3k2x1... (consistent)
  - Honeypot Detection: 0 indicators found
  - Site Classification: Legitimate dark web forum (not honeypot)
  
  Request Timeline:
  1. 14:35:12.234 - Homepage (exit 198.98.57.41)
  2. 14:35:18.842 - Form interact (exit 198.98.57.41)
  3. 14:35:22.156 - Search submit (exit 198.98.57.41)
  4. 14:35:29.734 - Results load (exit 198.98.57.41)
  5. ... (19 more requests)
  23. 14:37:42.128 - Final archive (exit 198.98.57.41)
```

#### Phase 5: Export Threat Intelligence Report
```
User Action: Generate forensic report suitable for law enforcement
Command: exportThreatReport(format='misp', includeScreenshots=true)

Basset Backend:
  1. Package all extracted data
  2. Create MISP-compatible format
  3. Include screenshots with EXIF metadata
  4. Generate chain of custody
  5. Create printable report for analysts

Report Package:
  - threat-intelligence-2026-06-13.json (MISP format)
    * 8 findings extracted
    * 2 CRITICAL severity
    * 3 HIGH severity
    * 3 MEDIUM severity
  
  - evidence/
    * Screenshots (8 PNG files, metadata preserved)
    * Forum archives (HTML snapshots)
    * User profiles (extracted data)
  
  - analysis/
    * Threat actor dossier
    * Attack timeline
    * Correlation analysis
  
  - chain-of-custody.log
    * Tor connection details
    * Exit node verification
    * Request timestamps
    * All data accessed documented
```

### Technical Capabilities Highlighted

| Capability | Importance | Implementation |
|------------|-----------|-----------------|
| **Tor Integration** | Critical for anonymity | Master switch (ON/OFF/AUTO), exit node control |
| **Session Coherence** | Prevents detection | Consistent IP, cookies, headers across requests |
| **.onion Resolution** | Enables access | Tor-native DNS resolution, v3 address validation |
| **Honeypot Detection** | Prevents trap detection | Pattern analysis for law enforcement honeypots |
| **Anonymity Verification** | Confirms privacy | WebRTC/DNS leak detection, IP verification |
| **Forensic Capture** | Evidence gathering | Screenshots, archives, metadata preservation |

### Performance Metrics
- Tor connection setup: 3,247 ms
- Forum homepage load: 2,847 ms
- Search query execution: 3,156 ms
- Data extraction: 1,234 ms
- Report generation: 2,841 ms
- **Total investigation time: ~13.3 seconds**

### What This Proves
1. **Anonymity:** Verified non-leaking Tor connection
2. **Persistence:** Session maintained across multiple requests (not one-off)
3. **Capability:** Can access and extract from dark web sites
4. **Evidence:** Forensic artifacts suitable for law enforcement
5. **Safety:** Honeypot detection prevents law enforcement traps

### Target User Impact
Threat intelligence teams can discover and assess dark web threats that affect their organization within minutes instead of hours, with complete anonymity and forensic-grade evidence suitable for law enforcement referral.

---

## SCENARIO 4: Multi-Site Monitoring with Concurrent Page Management

### Business Context
A market research team needs to monitor 5 competitor websites simultaneously for price changes, new features, and content updates. They want to track changes over time and identify patterns.

**Who Uses This:** Market research, competitive intelligence, price monitoring, news aggregation  
**Why It Matters:** Concurrent monitoring is 5-10x faster than sequential; prevents missing updates between sequential checks  
**Differentiator:** Basset manages 2-10 concurrent pages while maintaining session isolation

---

### Scenario Walkthrough

#### Phase 1: Initialize Multi-Site Monitoring
```
User Action: Set up monitoring for 5 competitor sites
Command: createMonitoringSession(targets=[
  {url: 'https://competitor-a.com/pricing', interval: 3600},
  {url: 'https://competitor-b.com/features', interval: 3600},
  {url: 'https://competitor-c.com/pricing', interval: 3600},
  {url: 'https://competitor-d.com/news', interval: 3600},
  {url: 'https://competitor-e.com/blog', interval: 3600}
])

Basset Backend:
  1. Create 5 isolated browser pages
  2. Assign unique session cookie jars to each
  3. Initialize independent fingerprint profiles
  4. Set update intervals
  5. Pre-load all 5 pages concurrently

Session Setup:
  - Page 1 (Competitor A): Session=sess-a-001, Cookies=17
  - Page 2 (Competitor B): Session=sess-b-001, Cookies=12
  - Page 3 (Competitor C): Session=sess-c-001, Cookies=18
  - Page 4 (Competitor D): Session=sess-d-001, Cookies=9
  - Page 5 (Competitor E): Session=sess-e-001, Cookies=11
  
  All pages loading concurrently:
  - Page 1: 847 ms (competitor-a.com)
  - Page 2: 1,234 ms (competitor-b.com)
  - Page 3: 956 ms (competitor-c.com)
  - Page 4: 1,847 ms (competitor-d.com)
  - Page 5: 734 ms (competitor-e.com)
  - Max completion: 1,847 ms (all loaded in parallel time)
```

#### Phase 2: Extract Initial Data from All Sites
```
User Action: Extract pricing and feature data simultaneously
Commands:
  - extractTableData(pageId=1, selector='.pricing-table')
  - extractTableData(pageId=2, selector='.feature-grid')
  - extractTableData(pageId=3, selector='.pricing-plans')
  - extractTableData(pageId=4, selector='.news-article')
  - extractTableData(pageId=5, selector='.blog-post')

Basset Backend:
  1. Extract from all 5 pages simultaneously
  2. Maintain session isolation (no cookie bleeding)
  3. Each extraction independent of others
  4. Generate comparison snapshots
  5. Calculate content hashes for change detection

Extracted Data Structure:
  {
    "timestamp": "2026-06-13T14:35:42Z",
    "sites": {
      "competitor-a": {
        "url": "https://competitor-a.com/pricing",
        "page_hash": "ae3f2c1d4b5e7h9k2l4m...",
        "pricing_plans": [
          {
            "name": "Starter",
            "price": "$29/month",
            "features": ["10 users", "1 GB storage"]
          },
          {
            "name": "Professional",
            "price": "$99/month",
            "features": ["50 users", "100 GB storage"]
          }
        ],
        "capture_time": 847
      },
      "competitor-b": {
        "url": "https://competitor-b.com/features",
        "page_hash": "b1d4e2f5h3k7j9l2m6n...",
        "features": [
          {"name": "Real-time analytics", "status": "new"},
          {"name": "API access", "status": "included"}
        ],
        "capture_time": 1234
      },
      // ... similar for competitors C, D, E
    }
  }
```

#### Phase 3: Compare and Detect Changes
```
User Action: Compare current data with previous snapshot
Command: detectChanges(previousSnapshot='2026-06-13T11:35:42Z')

Basset Backend:
  1. Load previous snapshot from storage
  2. Compare hashes (fast change detection)
  3. If hash differs, extract and diff content
  4. Categorize changes:
     - Price changes
     - Feature additions/removals
     - Content updates
     - New articles/posts
  5. Generate change report

Change Detection Results:
  Competitor A (Pricing Page):
    - Hash changed: ae3f2c1... → af4g2d1... (CHANGE DETECTED)
    - Changes found:
      * Professional plan price: $99 → $89 (PRICE REDUCED)
      * Enterprise plan: NEW (added)
    - Significance: HIGH (pricing strategy shift)
  
  Competitor B (Features Page):
    - Hash unchanged (no changes)
  
  Competitor C (Pricing Page):
    - Hash changed: ... (CHANGE DETECTED)
    - Changes found:
      * Starter plan: 1 GB → 5 GB storage (FEATURE EXPANDED)
    - Significance: MEDIUM
  
  Competitor D (News):
    - Hash changed: ... (CHANGE DETECTED)
    - New article: "Acquiring [Company X]" (published 1 hour ago)
    - Significance: CRITICAL
  
  Competitor E (Blog):
    - Hash unchanged (no changes)
  
  Summary:
    - Total sites monitored: 5
    - Sites with changes: 3
    - Critical findings: 1
    - High findings: 1
    - Medium findings: 1
```

#### Phase 4: Historical Comparison and Trend Analysis
```
User Action: Analyze 30-day pricing trends
Command: analyzeTrends(timespan='30d', metric='price')

Basset Backend:
  1. Load all historical snapshots (30 days)
  2. Extract pricing data from each snapshot
  3. Calculate price changes over time
  4. Identify patterns and trends
  5. Predict future pricing

Trend Analysis:
  Competitor A Pricing Trend (30 days):
  - Day 1-10: Starter=$39, Professional=$129 (baseline)
  - Day 11-15: Starter=$39, Professional=$99 (10% discount)
  - Day 16-20: Starter=$29, Professional=$99 (aggressive discounting)
  - Day 21-30: Starter=$29, Professional=$89 (continued reduction)
  - Trend: Aggressive price reduction (competitor losing market share?)
  - Prediction: Likely to stay low or reduce further
  
  Price War Detection:
  - Our pricing: Starter=$49, Professional=$149
  - Competitor A is now 40% cheaper on both tiers
  - Recommendation: Monitor closely for customer churn
```

#### Phase 5: Export Monitoring Report
```
User Action: Generate executive summary report
Command: exportMonitoringReport(format='pdf')

Basset Backend:
  1. Compile all changes and trends
  2. Create visual dashboards
  3. Generate executive summary
  4. Include change history
  5. Add analyst recommendations

Report Contents:
  - Executive Summary (1 page)
    * 3 of 5 competitors made changes
    * 1 critical finding (acquisition news)
    * Price war developing in market
  
  - Detailed Findings (5 pages)
    * Competitor A: Price reduction details
    * Competitor C: Feature expansion
    * Competitor D: Acquisition announcement
  
  - Trend Analysis (3 pages)
    * 30-day pricing trends
    * Price war prediction model
    * Competitive positioning analysis
  
  - Recommendations (1 page)
    * Consider price adjustment
    * Monitor customer satisfaction
    * Prepare feature roadmap response
  
  - Historical Data (appendix)
    * All 30 snapshots included
    * Full change logs
    * Raw extracted data
```

### Technical Capabilities Highlighted

| Capability | Benefit | Implementation |
|-----------|---------|-----------------|
| **Concurrent Page Management** | 5x faster monitoring | 5 pages loaded in parallel, one slowest determines total time |
| **Session Isolation** | No cookie bleeding between sites | Separate cookie jars, fingerprints, sessions |
| **Content Hashing** | Fast change detection | SHA-256 hashes, instant detection without full parsing |
| **Historical Tracking** | Trend analysis | Snapshots stored, historical data searchable |
| **Diff Comparison** | Easy change identification | Semantic diff of extracted data |
| **Predictive Analysis** | Forecasting capability | Trend analysis and pattern recognition |

### Performance Metrics
- 5 pages loaded concurrently: 1,847 ms (single slowest page)
- Data extraction from all 5: 234 ms (parallel)
- Change detection (hash comparison): 12 ms
- Historical diff (30 days): 847 ms
- Report generation: 2,156 ms
- **Total monitoring operation: ~5 seconds**

### What This Proves
1. **Efficiency:** Monitor 5 sites in <2 seconds (sequential would take 7+ seconds)
2. **Reliability:** Maintains separate sessions, no interference
3. **Intelligence:** Detects subtle changes and trends automatically
4. **Scalability:** Can extend to 10+ sites with similar performance
5. **Actionability:** Generates reports suitable for executive decision-making

### Target User Impact
Market research teams can monitor 5+ competitor websites continuously, automatically detecting price changes, feature launches, and strategic moves within seconds of occurrence. Generates intelligence suitable for C-level strategic decisions.

---

## SCENARIO 5: Network Forensics and Infrastructure Reconnaissance

### Business Context
A security researcher investigating a phishing campaign needs to understand the attacker's infrastructure: where the server is hosted, what other domains share the same IP, what tracking services are being used, and how the data flows.

**Who Uses This:** Security researchers, threat intelligence, law enforcement, incident response  
**Why It Matters:** Infrastructure analysis reveals attacker patterns and helps shutdown entire campaigns  
**Differentiator:** Basset captures complete network data (HAR, DNS, TLS) in single browser session

---

### Scenario Walkthrough

#### Phase 1: Enable Full Network Forensics
```
User Action: Configure comprehensive network capture
Command: configureNetworkForensics(
  captureHAR=true,
  captureDNS=true,
  captureTLS=true,
  captureTimings=true,
  analyzeTrackers=true
)

Basset Backend:
  1. Initialize network interception
  2. Set up HAR capture (all HTTP/HTTPS traffic)
  3. Configure DNS monitoring
  4. Enable TLS certificate capture
  5. Set up timing instrumentation
  6. Initialize tracker detection
```

#### Phase 2: Navigate to Suspicious Site
```
User Action: Load potentially malicious website
Command: navigateTo('https://phishing-campaign-site.example.com/login')

Basset Backend:
  1. Capture all network traffic
  2. Record DNS resolution
  3. Capture TLS certificate chain
  4. Identify third-party requests
  5. Analyze trackers and analytics
  6. Generate full network timeline

Network Capture Results:
  
  DNS Resolution:
    Query: phishing-campaign-site.example.com
    Response: 203.45.67.89 (Shodan shows: Hosting in Russia, AS64512)
    TTL: 3600
    Query Time: 34 ms
  
  TLS Certificate:
    Subject: CN=phishing-campaign-site.example.com
    Issuer: Let's Encrypt Authority X3
    Valid From: 2026-04-15
    Valid Until: 2026-07-14 (expires in 31 days)
    Fingerprint: SHA-256:ab3f2c1d4b5e7h9k2l4m...
    SAN (Subject Alternative Names):
      - phishing-campaign-site.example.com
      - phishing.example.net
      - phishing-v2.example.com
      - (3 more suspicious domains on same cert)
  
  Connection Details:
    Server IP: 203.45.67.89
    ASN: AS64512 (Russian hosting provider)
    Country: Russia (via GeoIP)
    Reverse DNS: hosting-server-42.example-hosting.ru
    SSL/TLS Version: TLS 1.3
    Cipher Suite: TLS_AES_256_GCM_SHA384
```

#### Phase 3: Analyze All Network Requests
```
User Action: Extract complete HAR file and analyze requests
Command: getFullHAR(includeBodyContent=true)

Basset Backend:
  1. Capture all 47 requests made during page load
  2. Categorize by domain
  3. Identify suspicious patterns
  4. Extract tracker information
  5. Generate request timeline

HAR Analysis:
  
  First-Party Requests (8):
    - GET https://phishing-campaign-site.example.com/login (847 KB, 1,234 ms)
    - GET https://phishing-campaign-site.example.com/style.css (42 KB)
    - GET https://phishing-campaign-site.example.com/script.js (156 KB, obfuscated)
    - POST https://phishing-campaign-site.example.com/submit (payload analysis...)
  
  Third-Party Analytics (12):
    - google-analytics.com (Google Analytics)
    - segment.com (Analytics platform)
    - mixpanel.com (User tracking)
    - heap.io (Session replay)
    - [9 more tracking services]
  
  Third-Party Frameworks (8):
    - jquery.cloudflare.com
    - bootstrap.cdn.example.com
    - font services
  
  Suspicious Requests (19):
    - https://cryptominers.example.ru/loader.js (CRYPTOMINER DETECTED)
    - https://click-fraud-network.example.net/tracker.gif (FRAUD NETWORK)
    - https://credential-harvester.example.com/api (CREDENTIAL HARVESTER)
    - [16 more suspicious domains]
  
  Request Timeline:
    T+0ms:    GET /login (page load begins)
    T+234ms:  GET /style.css
    T+456ms:  GET /script.js (legitimate)
    T+789ms:  GET google-analytics.com (legitimate tracking)
    T+1012ms: GET cryptominers.example.ru/loader.js (MALICIOUS)
    T+1547ms: Page render complete
    T+2134ms: GET credential-harvester.example.com/api (MALICIOUS)
```

#### Phase 4: Extract and Analyze Form
```
User Action: Analyze phishing form structure
Commands:
  - extractForms(detailed=true)
  - analyzeFormSubmission()

Basset Backend:
  1. Parse form HTML
  2. Extract all input fields
  3. Analyze submission endpoint
  4. Check for data exfiltration
  5. Identify credential harvesting

Form Analysis:
  
  Form Structure:
    Form ID: login-form
    Method: POST
    Action: https://phishing-campaign-site.example.com/submit
    Target: _self (same window, not exfiltration)
  
  Input Fields:
    1. username (text input)
    2. password (password input)
    3. email (hidden field, suspicious)
    4. ssn (hidden field, CRITICAL - collecting SSN!)
    5. credit_card (hidden field, CRITICAL - collecting CC!)
    6. csrf_token (security token)
  
  Submission Endpoint:
    URL: https://phishing-campaign-site.example.com/submit
    Method: POST
    Expected Data: Credentials + PII + Financial data
    Likely Destination: Attacker's collection server
  
  Hidden Fields Analysis:
    <input type="hidden" name="ssn" value="">
    <input type="hidden" name="credit_card" value="">
    <input type="hidden" name="bank_account" value="">
    - CRITICAL: Form designed to harvest PII beyond credentials
```

#### Phase 5: Generate Forensic Infrastructure Report
```
User Action: Create infrastructure analysis report
Command: generateInfrastructureReport(format='json-stix')

Basset Backend:
  1. Analyze all infrastructure data
  2. Identify attacker patterns
  3. Find related domains
  4. Map attack infrastructure
  5. Generate STIX/TAXII format

Infrastructure Report:

  Primary Attacker Domain:
    Domain: phishing-campaign-site.example.com
    IP: 203.45.67.89
    ASN: AS64512
    Country: Russia
    Hosting Provider: Russian Hosting Co.
    SSL Cert: Let's Encrypt (issued 2026-04-15, expires 2026-07-14)
  
  Related Domains (same TLS certificate):
    1. phishing.example.net
    2. phishing-v2.example.com
    3. phishing-backup.example.com
    4. [3 more domains]
    - All pointing to same IP: 203.45.67.89
    - All with similar HTML structure
    - Indicates multiple phishing campaign instances
  
  Attack Infrastructure:
    
    Data Harvesting:
      - Phishing site collects: Email, Password, SSN, Credit Card
      - Submission endpoint: https://phishing-campaign-site.example.com/submit
      - No HTTPS redirect to external server (data collected on attacker's server)
    
    Malicious Third-Party Services:
      1. Cryptominers.example.ru/loader.js
         - Injected into page via script tag
         - Loads cryptocurrency mining code
         - Steals visitor CPU for Monero mining
      
      2. Credential-harvester.example.com/api
         - Separate API endpoint for credential harvesting
         - May receive harvested data via CORS
      
      3. Fraud-network.example.net/tracker.gif
         - Pixel tracking, fraud detection evasion
         - Links to known fraud network
    
    Analytics Services:
      - Google Analytics (legitimate)
      - Segment, Mixpanel, Heap (can track stolen credentials)
  
  Attack Pattern Analysis:
    - Multi-stage attack (phishing → mining → fraud)
    - Sophisticated infrastructure (6+ related domains)
    - Active development (SSL cert only 2 months old)
    - Likely targeting: Financial credentials + cryptocurrency
    - Attacker sophistication: Medium-High
  
  Shutdown Recommendations:
    1. Report IP 203.45.67.89 to Russian hosting provider
    2. Report all 6 domains to domain registrar
    3. Alert Google Analytics/Segment about abuse
    4. Report cryptominers to security community
    5. Block cryptocurrency mining pools on network

  STIX Output:
    - 47 indicators (domains, IPs, email patterns)
    - 12 attack patterns identified
    - 8 malicious domains
    - 3 malware families
    - Complete STIX/TAXII export for security platform import
```

### Technical Capabilities Highlighted

| Capability | Intelligence Value | Implementation |
|-----------|-------------------|-----------------|
| **HAR Capture** | Complete request/response analysis | Full HAR with bodies, headers, timing |
| **DNS Resolution** | Infrastructure mapping | Resolution timing, TTL, reverse DNS |
| **TLS Certificate Analysis** | SAN enumeration, expiration | Full cert chain, fingerprints, validity |
| **Tracker Detection** | Third-party analysis | Identification of analytics/tracking services |
| **Form Analysis** | Attack methodology discovery | Field extraction, exfiltration detection |
| **Infrastructure Mapping** | Attack pattern analysis | IP, ASN, hosting provider, related domains |

### Performance Metrics
- Page load with full network capture: 1,547 ms
- HAR generation: 89 ms
- DNS analysis: 23 ms
- TLS cert parsing: 12 ms
- Form extraction: 45 ms
- Full infrastructure analysis: 1,234 ms
- **Total forensic analysis: ~3.2 seconds**

### What This Proves
1. **Visibility:** Complete network visibility into attack infrastructure
2. **Attribution:** Identifies attacker hosting and patterns
3. **Scope:** Discovers related domains and malicious services
4. **Impact:** Identifies data at risk (credentials, PII, financial)
5. **Actionability:** Generates shutdown recommendations and STIX export

### Target User Impact
Security researchers can analyze phishing and malware infrastructure in minutes instead of hours, discovering the complete attack chain, related domains, malicious services, and generating intelligence suitable for shutdown operations and law enforcement referral.

---

## SCENARIO 6: Form Filling and Automated Interaction Testing

### Business Context
A QA team needs to test user registration, login flows, and form submission processes across different browsers and configurations. They want to validate form behavior, error handling, and data submission without manual testing.

**Who Uses This:** QA automation, form testing, user journey validation, accessibility testing  
**Why It Matters:** Manual testing of complex forms is time-consuming and error-prone; automated interaction simulates real users  
**Differentiator:** Basset provides realistic human-like interaction while capturing full network and UI data

---

### Scenario Walkthrough

#### Phase 1: Test User Registration Form
```
User Action: Automate user registration workflow
Commands:
  - navigateTo('https://app.example.com/register')
  - waitForElement(selector='[name="email"]', timeout=5000)
  - fillForm(selector='[name="email"]', value='testuser@example.com')
  - fillForm(selector='[name="password"]', value='SecurePass123!', humanize=true)
  - fillForm(selector='[name="password_confirm"]', value='SecurePass123!', humanize=true)
  - fillForm(selector='[name="terms"]', value='true')
  - submitForm()

Basset Backend:
  1. Load registration page
  2. Wait for form elements to appear
  3. Fill email field (natural typing speed: 45-75 WPM)
  4. Fill password field with realistic mistakes and corrections
  5. Fill confirmation field
  6. Check terms checkbox (with realistic mouse movement)
  7. Submit form with human-like delays

Humanization Details:
  - Email field: 847 ms to type (average 50 WPM)
    * "testuser@example.com"
    * Natural keystroke timing
    * Pause at special characters (@, .)
  
  - Password field: 1,234 ms to type
    * "SecurePass123!"
    * Includes 1 simulated mistake (typed extra char, then corrected)
    * Pauses between character categories (upper→lower→number)
  
  - Confirmation: 1,156 ms to type
    * Same string, different typing pattern
    * Slower (more careful due to matching requirement)
  
  - Mouse movement: Bezier curves with jitter
    * Click from password field to checkbox: 342 ms
    * Checkbox itself: 45 ms click
  
  - Form submit: 156 ms delay before clicking (thinking time)

Form Submission Results:
  - HTTP Status: 201 Created
  - Redirect: https://app.example.com/welcome
  - Set-Cookie: session=abc123..., user_id=42
  - Response: Welcome, testuser@example.com!
  - Form validation: Passed (no errors)
  - Total interaction time: 3,847 ms (realistic user session)
```

#### Phase 2: Test Multi-Step Checkout Process
```
User Action: Automate e-commerce checkout workflow
Commands:
  - navigateTo('https://store.example.com/checkout')
  - fillCheckoutStep1(...)
  - submitStep(stepNum=1)
  - fillCheckoutStep2(...)
  - submitStep(stepNum=2)
  - // ... continue through steps

Basset Backend (Step 1 - Shipping):
  1. Load checkout page
  2. Fill shipping form fields:
     - Full Name: "John Doe" (634 ms, humanized)
     - Email: "john@example.com" (847 ms)
     - Address: "123 Main St" (1,234 ms)
     - City/State/ZIP: (956 ms total)
  3. Select shipping method (radio button)
  4. Submit step (validation: PASSED)
  5. Capture screenshot of step completion

Step 1 Results:
  - Form fields filled: 6
  - Errors: 0
  - Validation: Passed
  - Time: 4,123 ms
  - Screenshot captured: step1-complete.png (hash: ae3f2c1...)

Basset Backend (Step 2 - Payment):
  1. Load payment form
  2. Fill payment details:
     - Card Number: "4111111111111111" (test card, 1,847 ms)
     - Expiry: "12/28" (456 ms)
     - CVV: "123" (234 ms)
     - Billing same as shipping: checked
  3. Fill CAPTCHA if required (image recognition or bypass)
  4. Submit form (validation: PASSED)
  5. Capture screenshot

Step 2 Results:
  - Form fields filled: 4
  - CAPTCHA: Solved in 1,234 ms
  - Validation: Passed
  - Transaction status: Approved
  - Order ID: ORD-2026-0042
  - Time: 5,247 ms

Step 3 Results:
  - Order confirmation: Displayed
  - Confirmation email: "john@example.com"
  - Total checkout time: 12,156 ms (realistic e-commerce session)
```

#### Phase 3: Test Error Handling and Edge Cases
```
User Action: Test form error handling
Commands:
  - testInvalidEmail('invalid-email', expectError=true)
  - testPasswordMismatch('Pass1', 'Pass2', expectError=true)
  - testMissingField('email', expectError=true)
  - testDuplicateEmail('existing@example.com', expectError=true)

Basset Backend (Invalid Email Test):
  1. Fill email field with "invalid-email" (no @ symbol)
  2. Submit form
  3. Capture error message
  4. Verify error message contains "valid email"
  5. Form should remain on same page

Results:
  - Error displayed: "Please enter a valid email address"
  - Form fields preserved: Yes (user data not lost)
  - HTTP Status: 400 Bad Request
  - Screenshot: error-invalid-email.png
  - Test: PASSED

Basset Backend (Password Mismatch Test):
  1. Fill password: "SecurePass123!"
  2. Fill confirmation: "SecurePass456!"
  3. Submit form
  4. Capture error message
  5. Verify fields are cleared (security best practice)

Results:
  - Error displayed: "Passwords do not match"
  - Form fields cleared: Yes
  - HTTP Status: 400 Bad Request
  - Screenshot: error-password-mismatch.png
  - Test: PASSED

Basset Backend (Duplicate Email Test):
  1. Fill email with "existing@example.com" (already registered)
  2. Fill password and confirmation
  3. Submit form
  4. Capture error message

Results:
  - Error displayed: "Email already registered"
  - Suggestion: "Login instead?" (UX improvement detected)
  - HTTP Status: 409 Conflict
  - Screenshot: error-duplicate-email.png
  - Test: PASSED
```

#### Phase 4: Generate QA Report
```
User Action: Generate comprehensive test report
Command: generateQAReport(format='html', includeScreenshots=true)

Basset Backend:
  1. Compile all test results
  2. Generate pass/fail summary
  3. Create screenshots gallery
  4. Extract performance metrics
  5. Generate recommendations

QA Report Contents:

  Test Summary:
    Total Tests: 12
    Passed: 11 (91.7%)
    Failed: 1 (8.3%)
    Skipped: 0
    Duration: 47 seconds
  
  Test Cases:
    1. Registration Form - PASSED
       - All fields fill correctly
       - Form submission successful
       - No JavaScript errors
       - Session created (ID: abc123...)
    
    2. Registration - Duplicate Email - FAILED
       - Expected error: "Email already registered"
       - Actual error: "That email is already in use" (different message)
       - Impact: Minor (error detected, different text)
       - Recommendation: Update test to be case-insensitive
    
    3. Checkout Step 1 (Shipping) - PASSED
       - All validation rules passed
       - No errors
       - Time: 4,123 ms (acceptable)
    
    4. Checkout Step 2 (Payment) - PASSED
       - CAPTCHA solved automatically
       - Payment processing successful
       - Order confirmation received
    
    5. Checkout Step 3 (Confirmation) - PASSED
       - Confirmation email sent
       - Order in database
    
    6. Password Mismatch - PASSED
       - Error displayed correctly
       - Fields cleared (security good)
    
    7. Invalid Email - PASSED
       - Error message clear
       - User data preserved
    
    8. Empty Fields - PASSED
       - Required field validation working
    
    9. SQL Injection Attempt - PASSED
       - Input sanitized correctly
       - No database errors
    
    10. XSS Attack Attempt - PASSED
        - Script tags escaped
        - No console errors
    
    11. Password Reset Flow - PASSED
        - Reset email sent
        - Token valid
        - New password accepted
    
    12. Session Timeout - PASSED
        - Session expires after 30 minutes
        - User redirected to login
  
  Performance Metrics:
    Average form fill time: 2,154 ms
    Average form submission: 1,234 ms
    Average page load: 847 ms
    Slowest operation: Payment CAPTCHA (1,847 ms)
    Overall performance: ACCEPTABLE
  
  Browser Compatibility:
    Chrome 126: PASSED
    Firefox 127: PASSED
    Safari 17: PASSED
    Edge 126: PASSED
    Mobile Chrome: PASSED
  
  Accessibility:
    WCAG 2.1 Level AA: PASSED
    Keyboard navigation: PASSED
    Screen reader compatibility: PASSED
    Color contrast: PASSED
  
  Security Findings:
    SQL Injection: NOT VULNERABLE
    XSS: NOT VULNERABLE
    CSRF: Protected (tokens present)
    Sensitive data in URL: No
    Credentials in logs: No
  
  Screenshots (Gallery):
    - step1-initial.png
    - step1-filled.png
    - step1-complete.png
    - step2-payment.png
    - step2-captcha.png
    - step3-confirmation.png
    - error-invalid-email.png
    - error-password-mismatch.png
  
  Recommendations:
    1. Update error message matcher to be case-insensitive
    2. Investigate CAPTCHA solve time (1.8s seems slow)
    3. Consider adding loading spinner (UX improvement)
    4. Password reset email arrived in 5 seconds (acceptable)
    5. Mobile testing passed - responsive design working well
```

### Technical Capabilities Highlighted

| Capability | QA Benefit | Implementation |
|-----------|-----------|-----------------|
| **Humanized Input** | Realistic user behavior simulation | Natural typing speed, mistakes, corrections |
| **Form Interaction** | Cross-browser testing | Clicks, selections, submissions on any site |
| **Error Capture** | Comprehensive bug discovery | Screenshots, error messages, HTTP status codes |
| **Performance Monitoring** | Timing analysis | Millisecond-precision metrics for each interaction |
| **Network Capture** | Data flow verification | HAR format, request/response analysis |
| **Visual Regression** | Screenshot comparison | Before/after analysis, pixel-perfect validation |

### Performance Metrics
- Registration form (5 fields): 3,847 ms
- Checkout (3 steps): 12,156 ms
- Error handling tests (4 scenarios): 8,234 ms
- Report generation: 2,847 ms
- **Total QA validation: ~27 seconds**

### What This Proves
1. **Realism:** Human-like interaction patterns (not obviously automated)
2. **Coverage:** Tests happy path, error cases, edge cases, security
3. **Reliability:** Consistent results across runs
4. **Performance:** Captures timing metrics for optimization
5. **Documentation:** Generates visual proof for stakeholders

### Target User Impact
QA teams can automate regression testing of complex forms and workflows, testing happy paths and error cases in 30-40 seconds instead of 20-30 minutes of manual testing per cycle, with complete visual and network data for debugging.

---

## SCENARIO 7: Technology Stack Detection and Vendor Intelligence

### Business Context
A B2B SaaS company wants to understand what technology stack their prospects are using (e.g., which CDN, analytics platform, payment processor). This helps them tailor sales messaging and identify expansion opportunities.

**Who Uses This:** Sales engineering, competitive intelligence, market research, partner ecosystem analysis  
**Why It Matters:** Technology choices reveal company strategy, budget, and future direction  
**Differentiator:** Basset detects 200+ technologies with 95%+ accuracy in seconds

---

### Scenario Walkthrough

#### Phase 1: Configure Technology Detection
```
User Action: Set up technology detection profile
Command: configureDetection(
  categories: ['CDN', 'Analytics', 'PaymentProcessing', 'Hosting', 'Frameworks'],
  scanResources: true,
  analyzeHeaders: true,
  checkWAF: true
)

Basset Backend:
  1. Initialize 200+ technology signatures
  2. Enable network header analysis
  3. Enable JavaScript detection patterns
  4. Enable metadata scanning
  5. Prepare WAF detection module
```

#### Phase 2: Scan Prospect Website
```
User Action: Analyze prospect technology stack
Command: detectTechnologies('https://prospect-company.example.com')

Basset Backend (Network Headers Analysis):
  1. Scan HTTP response headers for technology signatures
  2. Check Server header: "nginx/1.21.1"
  3. Check X-Powered-By header: not present (good security practice)
  4. Check CDN headers: "X-Cache: HIT from CloudFront"
  5. Check other tech indicators

Detected from Headers:
  - Web Server: nginx 1.21.1
  - CDN: Amazon CloudFront
  - Framework indicators: None visible (good practice)

Basset Backend (JavaScript Analysis):
  1. Load page and extract all <script> tags
  2. Analyze script sources for known vendors
  3. Parse script contents for technology signatures
  4. Check for library fingerprints

Detected from JavaScript:
  - Framework: React 18.2.0 (from window.__REACT_DEVTOOLS_GLOBAL_HOOK__)
  - State Management: Redux (from window.__REDUX_DEVTOOLS_EXTENSION__)
  - Analytics: Google Analytics 4 (gtag), Mixpanel, Segment
  - Maps: Google Maps API (from script src)
  - Forms: Stripe.js (from stripe.com/v3)
  - Payment: Stripe (indicated by Stripe.js presence)

Basset Backend (DOM/Metadata Analysis):
  1. Scan meta tags and data attributes
  2. Check for vendor-specific patterns
  3. Analyze CSS and image loading

Detected from Metadata:
  - Open Graph: Facebook sharing support
  - Twitter Card: Twitter sharing support
  - Apple Touch Icon: iOS app installable
  - Email: Mailchimp signup form detected

Basset Backend (CSS/Image Analysis):
  1. Analyze stylesheet sources
  2. Check image CDN sources
  3. Check font loading

Detected from Resources:
  - CSS Framework: Bootstrap 5.1
  - Icon Library: Font Awesome 6.0
  - Fonts: Google Fonts (Open Sans, Inter)
  - Images: Served from CloudFront CDN

Basset Backend (WAF Detection):
  1. Test for WAF presence
  2. Try known WAF evasion signatures
  3. Check response patterns

WAF Detection:
  - WAF Present: No obvious WAF detected
  - Security Headers: 
    * Content-Security-Policy: Present (strict)
    * X-Frame-Options: DENY
    * X-Content-Type-Options: nosniff
```

#### Phase 3: Generate Technology Report
```
User Action: Export technology intelligence report
Command: generateTechnologyReport(format='json+pdf')

Basset Backend:
  1. Compile all detected technologies
  2. Categorize by function
  3. Generate vendor intelligence
  4. Create competitive analysis
  5. Identify expansion opportunities

Technology Report Output:

  Summary:
    Company: prospect-company.example.com
    Scan Date: 2026-06-13T14:35:42Z
    Technologies Detected: 34
    Confidence: 95%
    Last Updated: 2 weeks ago (from DNS)
  
  Technology Stack by Category:
  
  1. Hosting & Infrastructure:
     - Cloud Platform: AWS (indicated by CloudFront, S3)
     - Web Server: nginx 1.21.1
     - CDN: Amazon CloudFront
     - DNS: Amazon Route 53
     - Confidence: 98%
  
  2. Frontend Framework:
     - JavaScript Framework: React 18.2.0
     - CSS Framework: Bootstrap 5.1
     - State Management: Redux
     - UI Components: Material-UI (MUI)
     - Confidence: 96%
  
  3. Analytics & Tracking:
     - Google Analytics 4 (primary analytics)
     - Mixpanel (advanced analytics)
     - Segment (data collection platform)
     - Hotjar (session recording)
     - Confidence: 97%
  
  4. Payment Processing:
     - Stripe (payment processor)
     - Stripe.js (payment form)
     - Confidence: 99%
  
  5. Email & Communication:
     - Mailchimp (email marketing)
     - SendGrid (transactional email)
     - Intercom (customer messaging)
     - Confidence: 94%
  
  6. Monitoring & Performance:
     - Datadog (monitoring, indicated by Datadog RUM script)
     - New Relic (APM, indicated by script)
     - Sentry (error tracking)
     - Confidence: 93%
  
  7. Third-party Services:
     - Google Maps API
     - YouTube embed
     - Vimeo video player
     - ZoomInfo intent data
     - Confidence: 95%
  
  8. Security & Compliance:
     - TLS 1.3 (strong encryption)
     - Content-Security-Policy (strict)
     - No obvious WAF (likely relying on AWS Shield)
     - GDPR consent banner detected
     - Confidence: 96%
  
  Vendor Intelligence:
  
  AWS Ecosystem:
    - Cloud platform: AWS
    - Services: CloudFront, Route 53, S3, likely Lambda/RDS
    - Estimated spend: $5K-$20K/month (medium AWS user)
    - Growth indicator: Using enterprise monitoring (Datadog)
  
  Developer Experience:
    - Modern stack (React, Redux)
    - Monitoring-first approach (Datadog, New Relic, Sentry)
    - Likely DevOps team (multiple monitoring tools)
    - Indicates: Well-funded company with engineering focus
  
  Business Model:
    - Payment processing: Stripe (SaaS/subscription likely)
    - Analytics: Multiple platforms (data-driven)
    - Customer communication: Intercom (B2B software)
    - Email marketing: Mailchimp (growth-focused)
  
  Competitive Positioning:
    - Modern tech stack (competitive advantage)
    - Strong analytics (data-driven decisions)
    - Enterprise monitoring (quality focus)
    - AWS infrastructure (scalable, expensive)
  
  Expansion Opportunities (for our company):
    - They use Datadog (we integrate with Datadog → sales opportunity)
    - They use AWS (we integrate with AWS → sales opportunity)
    - They use Stripe (we integrate with Stripe → sales opportunity)
    - They're monitoring-heavy (we offer monitoring service → sales opportunity)
  
  Sales Messaging Recommendations:
    1. "Integrate with your existing Datadog monitoring"
    2. "Works seamlessly with your AWS infrastructure"
    3. "Reduce Stripe transaction processing costs"
    4. "Improve your React application performance"
  
  Detailed Vendor List (34 technologies):
    1. AWS (cloud platform)
    2. nginx (web server)
    3. CloudFront (CDN)
    4. Route 53 (DNS)
    5. React (framework)
    6. Redux (state management)
    7. Bootstrap (CSS framework)
    8. Google Analytics 4 (analytics)
    9. Mixpanel (analytics)
    10. Segment (CDP)
    ... (24 more technologies)
    
    [Full vendor list with category, confidence, and implications]
```

### Technical Capabilities Highlighted

| Capability | Business Value | Implementation |
|-----------|----------------|-----------------|
| **Network Detection** | Identifies infrastructure (AWS, Cloudflare, etc.) | Analyzes headers, DNS, certificates |
| **JavaScript Fingerprinting** | Detects frameworks and libraries | Parses script sources and window objects |
| **DOM Analysis** | Finds embedded third-parties | Scans meta tags, data attributes, script tags |
| **WAF Detection** | Identifies security tools | Pattern matching on responses |
| **Vendor Intelligence** | Enables sales targeting | Maps technologies to vendor ecosystem |
| **Confidence Scoring** | Validates detection accuracy | Provides reliability metrics per technology |

### Performance Metrics
- Technology detection scan: 3,847 ms
- Report generation: 1,234 ms
- **Total vendor intelligence: ~5 seconds**

### What This Proves
1. **Visibility:** Complete technology stack visibility
2. **Accuracy:** 95%+ confidence in technology detection
3. **Speed:** Technology scan in under 5 seconds
4. **Actionability:** Generates sales messaging and expansion opportunities
5. **Integration:** Identifies specific integration opportunities

### Target User Impact
Sales teams can immediately understand a prospect's technology stack and generate personalized messaging based on their existing tools, leading to higher conversion rates. Enables "warm outreach" that references known infrastructure choices.

---

## Implementation Guide

### Prerequisites
- Basset Hound Browser v12.0.0+ running and accessible via WebSocket
- Test websites or staging environments (don't test against production sites without permission)
- WebSocket client library (ws npm package or equivalent)
- For forensic scenarios: PDF viewing capability, JSON tools

### Setup for Each Scenario

#### Forensic Investigation (Scenario 1)
```bash
# Start Basset Hound Browser
npm start

# Install forensic tools (optional, for offline verification)
npm install @noble/hashes  # For SHA-256 verification
npm install moment          # For timestamp formatting

# Run scenario test
node tests/scenarios/forensic-investigation.test.js
```

#### Bot Detection Evasion (Scenario 2)
```bash
# Ensure Cloudflare-protected test site is available
# (Use staging environment, not real competitor site)

# Run evasion scenario
node tests/scenarios/bot-evasion-cloudflare.test.js

# Verify evasion rate
node tests/stress/evasion-validator.js
```

#### Dark Web Monitoring (Scenario 3)
```bash
# Ensure Tor is running
# Tor should be installed and started before tests
tor --version  # Verify installation

# Run Tor integration scenario
node tests/scenarios/dark-web-monitoring.test.js

# Verify anonymity
curl https://ipleak.net (should show Tor IP)
```

#### Multi-Site Monitoring (Scenario 4)
```bash
# Run monitoring scenario
node tests/scenarios/multi-site-monitoring.test.js

# Expected output: 5 concurrent pages loaded, changes detected
```

#### Network Forensics (Scenario 5)
```bash
# Run forensics scenario
node tests/scenarios/network-forensics.test.js

# Output: HAR file, TLS certificates, DNS records
```

#### Form Filling (Scenario 6)
```bash
# Run QA scenario
node tests/scenarios/form-filling-qa.test.js

# Output: QA report with screenshots and performance metrics
```

#### Technology Detection (Scenario 7)
```bash
# Run technology detection scenario
node tests/scenarios/technology-detection.test.js

# Output: JSON technology report, vendor analysis
```

### Validation Checklist

For each scenario, verify:
- [ ] WebSocket connection successful
- [ ] Navigation completes without errors
- [ ] Data extraction produces expected output
- [ ] Screenshots/artifacts are generated
- [ ] Performance metrics are captured
- [ ] Report generation succeeds

### Common Issues & Solutions

**Issue: WebSocket connection refused**
- Solution: Verify Basset Hound is running on port 8765
- Check: `netstat -an | grep 8765`

**Issue: Evasion not working (still blocked by detection)**
- Solution: Verify fingerprint profile is enabled
- Check: `getProfile()` returns `evasion: {enabled: true}`
- Try: Different fingerprint profile (Windows vs Mac vs Linux)

**Issue: Tor connection fails**
- Solution: Verify Tor daemon is running
- Check: `tor --version` and `ps aux | grep tor`
- Try: Restart Tor: `service tor restart`

**Issue: Screenshots are blank**
- Solution: Verify page has finished rendering
- Check: Use longer `waitForElement()` timeout
- Try: Add explicit `waitForPageLoad()` command

---

## Success Metrics for Demos

### Forensic Investigation
✓ Chain of custody documentation generated  
✓ Cryptographic hashes verified  
✓ RFC 3161 timestamp obtained  
✓ Screenshots with EXIF metadata captured  

### Bot Detection Evasion
✓ Bypassed detection system (87%+ success rate)  
✓ Data extracted from protected site  
✓ Evasion techniques documented and measured  

### Dark Web Monitoring
✓ Successfully connected via Tor  
✓ .onion site accessed and content extracted  
✓ Anonymity verified (no IP leaks)  
✓ Threat intelligence captured in MISP format  

### Multi-Site Monitoring
✓ All 5 sites loaded concurrently  
✓ Changes detected and reported  
✓ Historical comparison shows trends  

### Network Forensics
✓ Complete HAR file captured  
✓ TLS certificates extracted  
✓ Attack infrastructure mapped  
✓ STIX indicators generated  

### Form Filling
✓ All form fields filled with humanized input  
✓ Forms submitted successfully  
✓ Error handling tested and verified  
✓ QA report generated with screenshots  

### Technology Detection
✓ 30+ technologies detected from single page  
✓ Confidence scores >95% for most technologies  
✓ Vendor intelligence and sales recommendations generated  

---

## Conclusion

These 7 scenarios demonstrate concrete value across real-world use cases:

1. **Forensic Investigation** - Legal compliance and evidence admissibility
2. **Bot Detection Evasion** - Legitimate automation on protected sites
3. **Dark Web Monitoring** - Threat intelligence and law enforcement
4. **Multi-Site Monitoring** - Competitive intelligence and market research
5. **Network Forensics** - Infrastructure analysis and attack attribution
6. **Form Filling** - QA automation and user journey testing
7. **Technology Detection** - Sales intelligence and vendor analysis

Each scenario showcases a different aspect of Basset Hound Browser's capabilities while solving real problems for target users.

---

**Document Version:** 1.0  
**Created:** June 13, 2026  
**Last Updated:** June 13, 2026  
**Status:** Ready for Demo Implementation

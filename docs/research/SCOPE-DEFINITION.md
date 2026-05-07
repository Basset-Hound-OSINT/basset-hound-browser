# Basset Hound Browser - Scope Definition & Positioning

**Purpose:** Define what Basset Hound is, what it's not, and how it differs from related tools

**Date:** May 7, 2026

---

## TL;DR

**Basset Hound is NOT:** A security testing tool like Burp Suite  
**Basset Hound IS:** An OSINT/forensics/automation browser for intelligent data collection

Think: Intelligence analyst's browser, not penetration tester's proxy

---

## Mission Statement

**Basset Hound Browser** is an open-source browser designed for **intelligent evidence collection, OSINT research, and automated data gathering** with forensic-grade preservation, granular control, and integration with AI analysis systems.

### Core Values
- **Forensic Integrity:** Evidence preservation with chain of custody
- **Transparency:** Open-source for security researchers and enterprises
- **Granularity:** 164+ WebSocket commands for precise control
- **Integration:** Designed for agent-centric analysis systems
- **Anonymity:** Tor/proxy support for anonymous investigation

---

## What Basset Hound INCLUDES

### 1. Intelligence Collection
- Website analysis and technology fingerprinting (Wappalyzer-style)
- Data extraction and screenshots with OCR
- Session recording with forensic metadata
- Multi-session parallel operation
- Evidence gathering for investigations

### 2. Browser Automation
- 164+ WebSocket commands for precise control
- JavaScript injection and execution
- Form filling and navigation
- Request/response capture
- Network monitoring

### 3. Anonymity & Evasion
- Tor integration (ON/OFF/AUTO modes)
- Proxy support (HTTP/HTTPS/SOCKS)
- Browser fingerprinting spoofing
- Behavioral pattern realism
- Device profile rotation

### 4. Forensic Capabilities
- Screenshot capture with OCR extraction
- Session recording to WebM
- Metadata extraction (EXIF, PDF, Office docs)
- Network request logging
- Change detection (perceptual hashing)
- Chain of custody documentation

### 5. Data Export & Preservation
- HAR format export (HTTP Archive)
- Forensic report generation
- Evidence cataloging
- Timeline analysis
- Digital signature verification

### Example OSINT Workflow
```
1. Initialize session with anonymity (Tor enabled)
2. Navigate to target website
3. Detect technologies running on site (Wappalyzer-equivalent)
4. Extract metadata from documents/pages
5. Monitor network requests and APIs
6. Capture screenshots and record session
7. Export forensic report with chain of custody
8. Generate timeline of findings
```

---

## What Basset Hound EXCLUDES

### ❌ Security Testing (Burp Suite's Domain)
- Vulnerability scanning
- Exploit payload generation
- Fuzzing and parameter discovery
- Security issue prioritization
- Proof-of-concept exploit development

### ❌ Advanced Penetration Testing
- SQL injection testing
- XSS payload injection
- CSRF attack generation
- Authentication bypass testing
- Session hijacking testing

### ❌ Infrastructure/Network Scanning
- Port scanning (use nmap)
- DNS enumeration (use dig/nslookup)
- Network mapping (use nessus/zmap)
- Vulnerability exploitation (use metasploit)

### ❌ Analysis Tools (Out of Scope)
- Vulnerability analysis
- Risk assessment
- Threat modeling
- CVSS scoring
- Compliance checking

### Example Workflow Basset Hound Doesn't Support
```
❌ NOT: Find SQL injection, craft payload, exploit database
✅ INSTEAD: Capture the SQL injection indicators in network traffic,
           document them in forensic report for analysis elsewhere
```

---

## Comparison Matrix: Basset Hound vs Related Tools

| Aspect | Basset Hound | Burp Suite | nstBrowser | OctoBrowser |
|--------|--------------|-----------|-----------|------------|
| **Mission** | Intelligence collection | Security testing | Evasion/multi-account | OSINT browser |
| **Primary Users** | OSINT analysts, forensic investigators | Security testers, penetration testers | Marketers, ad verification | OSINT researchers |
| **Main Capability** | Forensic data capture | Vulnerability discovery | Bot evasion | Anonymous browsing |
| **Technology Detection** | ✅ YES (planned) | Limited | Limited | Limited |
| **Vulnerability Scanning** | ❌ NO | ✅ YES | ❌ NO | ❌ NO |
| **Exploit Development** | ❌ NO | ✅ YES | ❌ NO | ❌ NO |
| **Multi-Session Parallel** | ✅ YES | Limited | ✅ YES | Limited |
| **Forensic Preservation** | ✅ YES | Basic | Limited | Limited |
| **Tor/Proxy Integration** | ✅ YES | Limited | ✅ YES | ✅ YES |
| **API Granularity** | ✅ 164+ commands | Medium | Medium | Medium |
| **Open Source** | ✅ YES | ❌ Proprietary | ❌ SaaS only | ❌ Proprietary |
| **AI Agent Integration** | ✅ YES | Limited | Limited | Limited |
| **Evidence Chain of Custody** | ✅ YES | No | No | No |

---

## Scope by Capability Category

### INCLUDED: Website Analysis
- ✅ Technology detection (frameworks, CMS, servers, CDN)
- ✅ Metadata extraction (headers, certificates, EXIF)
- ✅ Form discovery and structure analysis
- ✅ API endpoint identification
- ✅ Change detection over time
- ✅ Screenshots with OCR

### EXCLUDED: Website Exploitation
- ❌ Vulnerability testing
- ❌ Payload injection
- ❌ Exploit development
- ❌ Authentication bypass

---

### INCLUDED: Network Monitoring
- ✅ HTTP request/response logging
- ✅ Network waterfall diagrams
- ✅ DNS resolution tracking
- ✅ TLS certificate capture
- ✅ Cookie extraction and analysis
- ✅ Third-party tracker detection

### EXCLUDED: Network Scanning
- ❌ Port scanning
- ❌ Service enumeration
- ❌ Vulnerability identification
- ❌ Network mapping

---

### INCLUDED: Anonymity & Evasion
- ✅ Browser fingerprinting spoofing
- ✅ Tor integration
- ✅ Proxy support (HTTP/HTTPS/SOCKS)
- ✅ Behavioral pattern realism
- ✅ Device profile rotation
- ✅ Header/cookie manipulation

### EXCLUDED: Advanced Evasion
- ❌ WAF bypassing payload development
- ❌ IDS evasion techniques
- ❌ Deep packet inspection bypass
- ❌ Network-level evasion

---

### INCLUDED: Data Collection
- ✅ Screenshots and recordings
- ✅ HTML/DOM capture
- ✅ Document metadata extraction
- ✅ Session recording
- ✅ Performance metrics
- ✅ Content analysis

### EXCLUDED: Data Analysis
- ❌ Sentiment analysis
- ❌ Image recognition
- ❌ Natural language processing
- ❌ Threat intelligence analysis
- ❌ Machine learning classification

---

## Real-World Scenarios

### Scenario 1: Corporate Third-Party Risk Assessment

**Task:** Evaluate security posture of vendor website

**Basset Hound Approach:**
1. Visit vendor website anonymously (Tor)
2. Detect technologies in use (old/vulnerable versions?)
3. Screenshot and record evidence
4. Extract metadata from downloadable documents
5. Monitor for security issues (certificate warnings, unsecured content)
6. Generate forensic report with timeline
7. Export for compliance documentation

**Result:** Evidence-preserved report for risk assessment team

**What Basset Hound Does NOT Do:** Exploit detected vulnerabilities, generate security fixes, suggest mitigations

---

### Scenario 2: Competitive Intelligence

**Task:** Monitor competitor website changes

**Basset Hound Approach:**
1. Periodic automated visits to competitor site
2. Screenshot captures at each visit
3. Detect technology changes (new frameworks, upgraded platforms)
4. Compare site structure using perceptual hashing
5. Build timeline of changes
6. Track infrastructure modifications (DNS, CDN, hosting)
7. Export findings in timeline format

**Result:** Competitive intelligence timeline for business intelligence team

**What Basset Hound Does NOT Do:** Analyze competitor strategy, forecast business impact, provide strategic recommendations (those are analyst jobs)

---

### Scenario 3: Digital Forensics Investigation

**Task:** Preserve evidence of malicious website for legal proceedings

**Basset Hound Approach:**
1. Access site with chain of custody documentation
2. Record full session (video)
3. Capture screenshots at key points
4. Extract metadata (server info, certificates, dates)
5. Log all network requests
6. Generate forensic report with timestamps
7. Create evidence package with SHA-256 hashes
8. Enable legal-grade documentation

**Result:** Evidence package admissible in legal proceedings

**What Basset Hound Does NOT Do:** Determine if laws were broken, recommend prosecutions, analyze intent (those are legal/law enforcement jobs)

---

### Scenario 4: OSINT Research

**Task:** Investigate target organization infrastructure

**Basset Hound Approach:**
1. Gather public information anonymously
2. Detect technologies in use (APIs, frameworks, hosting)
3. Extract DNS/certificate information
4. Identify subdomains and infrastructure
5. Monitor for security indicators
6. Build timeline of infrastructure changes
7. Export findings in structured format
8. Send to analysis agents for pattern detection

**Result:** Structured intelligence data for analysis

**What Basset Hound Does NOT Do:** Determine threat level, recommend security actions (those are analyst/security team jobs)

---

## Use Cases By User Type

### Corporate Security Teams
**Uses:**
- Third-party risk assessment
- Vendor security evaluation
- Compliance evidence collection
- Breach investigation support

**Does NOT:**
- Perform penetration testing
- Issue security certifications
- Recommend security controls

### Digital Forensics/e-Discovery Firms
**Uses:**
- Evidence preservation (websites, communications)
- Chain of custody documentation
- Timeline construction
- Legal-grade reporting

**Does NOT:**
- Analyze evidence
- Determine legal liability
- Recommend prosecutions

### Threat Intelligence Analysts
**Uses:**
- OSINT investigation
- Infrastructure reconnaissance
- Threat data collection
- Timeline building

**Does NOT:**
- Predict threats
- Assess impact
- Recommend countermeasures

### Security Researchers
**Uses:**
- Website analysis
- Technology detection
- Evasion technique development
- Performance benchmarking

**Does NOT:**
- Vulnerability exploitation
- Proof-of-concept code generation

---

## Why NOT Build a Burp Suite Clone?

### Market Reasons
1. **Burp Suite dominates** - Massive market share, established ecosystem
2. **Different user base** - Pen testers vs. analysts/investigators
3. **Different workflows** - Vulnerability testing vs. evidence collection
4. **Licensing complexity** - Security tools have legal/regulatory requirements

### Technical Reasons
1. **Different priorities** - Forensics vs. exploitation
2. **Different data models** - Evidence vs. vulnerability reports
3. **Different integrations** - AI agents vs. security scanners
4. **Different performance metrics** - Evidence quality vs. exploit success rate

### Strategic Reasons
1. **Own adjacent market** - OSINT/forensics is underserved
2. **Differentiate clearly** - Complements rather than competes
3. **Build community** - Researchers prefer open-source for OSINT
4. **Enable AI** - Designed for intelligent agent integration

**The thesis:** Do one thing (evidence collection) better than anyone else, rather than trying to do everything security-related.

---

## Future Integration (Not Cannibalization)

Basset Hound and Burp Suite could be **complementary**:

```
Burp Suite finds vulnerability → Basset Hound gathers evidence
Basset Hound collects intelligence → Burp Suite tests security
```

**Example Workflow:**
1. Burp Suite identifies XSS vulnerability in form
2. Basset Hound captures how vulnerability manifests in real-world usage
3. Basset Hound records evidence of impact
4. Report combined: vulnerability + real-world evidence

---

## Scope Summary Table

| Category | Included | Excluded |
|----------|----------|----------|
| **Website Analysis** | Tech detection, metadata, structure | Vulnerability testing |
| **Network Monitoring** | Request logging, DNS, TLS tracking | Port scanning, service enumeration |
| **Anonymity** | Tor, proxy, fingerprint spoofing | WAF/IDS evasion payloads |
| **Data Collection** | Screenshots, recordings, metadata | Analysis/intelligence processing |
| **Automation** | Browser control, form filling, navigation | Exploit payload generation |
| **Evidence** | Preservation, chain of custody, reporting | Legal analysis, liability determination |

---

## Guiding Question for Scope Decisions

**When deciding if a feature belongs in Basset Hound, ask:**

> "Does this help collect evidence better, or does it analyze evidence?"
> 
> **Collect → Include**  
> **Analyze → Exclude (let external agents do it)**

---

**Document Status:** Approved scope definition  
**Applies to:** v11.3.0 and future versions  
**Owner:** Product/Architecture team

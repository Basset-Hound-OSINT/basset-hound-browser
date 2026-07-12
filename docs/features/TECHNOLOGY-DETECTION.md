# Technology Detection Guide

**Version**: 12.2.0  
**Last Updated**: June 1, 2026  
**Status**: Production Ready  
**Estimated Read Time**: 35 minutes

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [Detection Engines](#detection-engines)
5. [API Reference](#api-reference)
6. [Integration Examples](#integration-examples)
7. [Accuracy & Limitations](#accuracy--limitations)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Technology Detection?

Technology Detection identifies the software, libraries, frameworks, and services running on websites. It provides:

- **Framework Detection**: React, Vue, Angular, Svelte, etc.
- **CMS Identification**: WordPress, Drupal, Shopify, custom platforms
- **Library Detection**: jQuery, Lodash, Bootstrap, charting libraries
- **Server Stack**: Node.js, Python, Java, PHP versions
- **Services**: Analytics (Google Analytics, Mixpanel), payment processors, CDNs
- **Security**: SSL/TLS certificates, security headers, CSP policies
- **Version Information**: Exact version numbers when available
- **CVE Detection**: Known vulnerabilities in detected technologies

### Typical Use Cases

1. **Competitive Intelligence**: Understand competitor tech stacks
2. **Security Assessment**: Identify vulnerable versions
3. **Market Analysis**: Track technology adoption trends
4. **Due Diligence**: Evaluate tech stack during M&A
5. **Supply Chain Risk**: Monitor third-party dependencies
6. **Compliance**: Verify technology compliance requirements

---

## Quick Start

### Basic Technology Detection

```javascript
// WebSocket API
{
  "id": "req-1",
  "command": "detect_technologies",
  "url": "https://example.com"
}
```

**Response**:
```json
{
  "success": true,
  "url": "https://example.com",
  "timestamp": "2026-06-01T12:00:00Z",
  "technologies": {
    "frameworks": [
      {
        "name": "React",
        "version": "18.2.0",
        "category": "frontend-framework",
        "detected_via": ["script_tag", "package_json"],
        "confidence": 0.98
      }
    ],
    "cms": [
      {
        "name": "WordPress",
        "version": "6.3.1",
        "category": "cms",
        "detected_via": ["meta_generator", "readme"],
        "confidence": 0.99
      }
    ],
    "libraries": [
      {
        "name": "jQuery",
        "version": "3.6.0",
        "category": "library",
        "detected_via": ["script_tag"],
        "confidence": 0.95
      }
    ],
    "services": [
      {
        "name": "Google Analytics",
        "category": "analytics",
        "detected_via": ["script_tag"],
        "confidence": 0.99
      }
    ],
    "security": {
      "protocol": "TLS 1.3",
      "certificate": {
        "issuer": "Let's Encrypt",
        "expires": "2026-12-15"
      },
      "headers": {
        "strict-transport-security": "max-age=31536000",
        "x-content-type-options": "nosniff"
      }
    }
  }
}
```

### Check for Vulnerabilities

```javascript
{
  "id": "req-2",
  "command": "identify_cms",
  "url": "https://example.com",
  "includeVulnerabilities": true
}
```

**Response**:
```json
{
  "success": true,
  "cms": {
    "name": "WordPress",
    "version": "5.9.0",
    "vulnerabilities": [
      {
        "cve": "CVE-2024-1234",
        "severity": "high",
        "description": "Unauthorized file upload in plugin X",
        "fixedIn": "5.9.3"
      },
      {
        "cve": "CVE-2024-1235",
        "severity": "medium",
        "description": "XSS vulnerability in comments",
        "fixedIn": "5.9.2"
      }
    ]
  }
}
```

### Identify Analytics Setup

```javascript
{
  "id": "req-3",
  "command": "identify_analytics",
  "url": "https://example.com"
}
```

**Response**:
```json
{
  "success": true,
  "analytics": [
    {
      "name": "Google Analytics 4",
      "property": "G-ABC123XYZ",
      "type": "web-analytics",
      "version": "ga4"
    },
    {
      "name": "Mixpanel",
      "token": "...",
      "type": "product-analytics"
    },
    {
      "name": "Facebook Pixel",
      "type": "marketing-analytics"
    }
  ]
}
```

---

## Core Concepts

### Detection Methods

Technology detection uses multiple methods to identify software:

#### 1. HTTP Headers Analysis
- `Server` header (often disabled)
- `X-Powered-By` header
- `X-AspNet-Version` header
- Custom headers

#### 2. HTML Meta Tags
- `<meta name="generator">` (indicates CMS/framework)
- Meta tags with technology info
- Comments in HTML

#### 3. JavaScript Object Analysis
- Global JavaScript objects (e.g., `React`, `_`, `jQuery`)
- Script tag attributes (e.g., `data-react-version`)
- Error messages revealing libraries

#### 4. Script Tag Analysis
- Script source URLs
- Library CDN patterns
- Version numbers in URLs

#### 5. Resource URL Patterns
- CSS/JS file paths reveal technology
- Webpack chunks indicate React/Vue
- Framework-specific resource naming

#### 6. File Analysis
- `robots.txt` patterns
- `sitemap.xml` structure
- `package.json` presence (Node.js)
- `Gemfile`, `requirements.txt` (Ruby/Python)

#### 7. HTTP Status Patterns
- Default error pages
- Framework-specific error formats
- Default directory listings

#### 8. External Signature Database
- Fingerprints for 2,000+ technologies
- Community-contributed signatures
- Regular updates

### Confidence Levels

Each detection has a confidence score (0-1):

```
1.0   = 100% certain (package.json, exact version in code)
0.95  = 99% certain (clear header, well-known meta tag)
0.85  = High confidence (multiple detection vectors)
0.75  = Moderate confidence (one clear detection method)
0.60  = Lower confidence (could be another library)
< 0.60 = Not reported (too unreliable)
```

**Best Practice**: Only trust detections with confidence ≥ 0.85

### Technology Categories

Detected technologies are categorized:

```
Frontend Frameworks:
├─ React, Vue, Angular, Svelte, Next.js, Nuxt, Gatsby

Backend Frameworks:
├─ Express.js, Django, Flask, Laravel, Rails, Spring

CMS Platforms:
├─ WordPress, Drupal, Joomla, Shopify, Wix, Squarespace

Programming Languages:
├─ JavaScript, Python, Java, PHP, Ruby, C#, Go

Servers & Hosting:
├─ Node.js, Apache, Nginx, Tomcat, IIS

Databases:
├─ MySQL, PostgreSQL, MongoDB, Redis, DynamoDB

CDN & Caching:
├─ Cloudflare, AWS CloudFront, Akamai, Fastly

Analytics & Marketing:
├─ Google Analytics, Mixpanel, Segment, Facebook Pixel

Payment Processing:
├─ Stripe, PayPal, Square, Shopify Payments

Hosting Platforms:
├─ AWS, Google Cloud, Azure, Heroku, Digital Ocean
```

---

## Detection Engines

### Engine 1: Framework Detection

Detects JavaScript frameworks and their versions.

**Technologies**:
- React (with version detection)
- Vue.js (with version detection)
- Angular (with version detection)
- Svelte
- Next.js
- Gatsby
- Nuxt
- Ember.js

**Detection Methods**:
1. Global variable analysis (`window.React`, `window.Vue`)
2. Script tag signatures
3. HTML class/attribute patterns (e.g., `ng-app` for Angular)
4. Error message analysis
5. Build artifact detection (Webpack chunks)

**Example**:
```javascript
{
  "command": "detect_technologies",
  "url": "https://example.com",
  "focus": "frontend"
}
```

### Engine 2: CMS Detection

Identifies content management systems and versions.

**Technologies**:
- WordPress
- Drupal
- Joomla
- Shopify
- Magento
- Typo3
- Prestashop

**Detection Methods**:
1. Meta generator tags
2. Cookie analysis (`wordpress_logged_in`)
3. Default file detection (`wp-content`, `wp-includes`)
4. HTML class patterns
5. HTTP header analysis

**Example**:
```javascript
{
  "command": "identify_cms",
  "url": "https://example.com",
  "includeVulnerabilities": true
}
```

### Engine 3: Library Detection

Identifies JavaScript libraries and their versions.

**Libraries**:
- jQuery
- Lodash
- Moment.js
- D3.js
- Three.js
- Handlebars
- Bootstrap
- Material-UI

**Detection Methods**:
1. Global variable detection
2. Script tag analysis
3. Built-in function fingerprinting
4. Error message patterns
5. DOM element class analysis

### Engine 4: Server & Backend Detection

Identifies server software and backend frameworks.

**Servers**:
- Apache
- Nginx
- Microsoft IIS
- Node.js / Express
- Java / Tomcat
- Python / Gunicorn

**Detection Methods**:
1. Server header analysis
2. HTTP header patterns
3. Response time characteristics
4. Error page fingerprints
5. SSL certificate analysis

### Engine 5: Service Detection

Identifies third-party services and integrations.

**Services**:
- Analytics (Google Analytics, Mixpanel, Amplitude, Segment)
- Payment Processing (Stripe, PayPal, Square)
- Marketing (Facebook Pixel, Twitter Pixel)
- CDN (Cloudflare, Akamai, CloudFront)
- Email (Mailchimp, SendGrid)

**Detection Methods**:
1. Script tag URLs
2. Pixel tracking
3. API endpoint patterns
4. Cookie analysis
5. Network request analysis

### Engine 6: Security Analysis

Analyzes security headers and certificates.

**Analyzed**:
- SSL/TLS version
- Certificate issuer and expiration
- Security headers:
  - Strict-Transport-Security (HSTS)
  - Content-Security-Policy (CSP)
  - X-Content-Type-Options
  - X-Frame-Options
  - Referrer-Policy

**Example**:
```json
{
  "security": {
    "protocol": "TLS 1.3",
    "certificate": {
      "issuer": "Let's Encrypt",
      "subject": "example.com",
      "issued": "2025-06-01",
      "expires": "2026-06-01",
      "algorithms": "RSA 2048"
    },
    "headers": {
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "content-security-policy": "default-src 'self'",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY"
    }
  }
}
```

### Engine 7: Vulnerability Detection

Cross-references detected technologies with vulnerability databases.

**Vulnerabilities Detected**:
- Known CVEs in detected versions
- End-of-life versions
- Known exploits available
- Security patches available

**Example**:
```json
{
  "vulnerabilities": [
    {
      "cve": "CVE-2024-1234",
      "severity": "critical",
      "description": "Remote Code Execution in WordPress plugin",
      "detectedTechnology": "WordPress 5.9.0",
      "fixedIn": "5.9.3",
      "cvssScore": 9.8,
      "exploitAvailable": true
    }
  ]
}
```

---

## API Reference

### detect_technologies

Detect all technologies used on a website.

**Command**: `detect_technologies`

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| url | string | Yes | - | Website URL to scan |
| focus | string | No | all | Focus detection: all, frontend, backend, services |
| includeVulnerabilities | boolean | No | false | Check for known vulnerabilities |
| includeCertificate | boolean | No | true | Include SSL certificate details |
| timeout | number | No | 30000 | Request timeout (ms) |

**Example**:
```javascript
{
  "id": "req-1",
  "command": "detect_technologies",
  "url": "https://github.com",
  "includeVulnerabilities": true
}
```

**Success Response**:
```json
{
  "success": true,
  "url": "https://github.com",
  "timestamp": "2026-06-01T12:00:00Z",
  "technologies": {
    "frameworks": [...],
    "cms": [...],
    "libraries": [...],
    "servers": [...],
    "services": [...],
    "security": {...},
    "vulnerabilities": [...]
  },
  "summary": {
    "totalDetected": 23,
    "categories": {
      "frontend": 5,
      "libraries": 8,
      "services": 7,
      "security": 3
    }
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Failed to fetch URL",
  "details": {
    "statusCode": 404,
    "reason": "URL not found"
  }
}
```

---

### identify_cms

Identify CMS platform and version with vulnerability check.

**Command**: `identify_cms`

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| url | string | Yes | - | Website URL |
| includeVulnerabilities | boolean | No | true | Check for CVEs |
| includePlugins | boolean | No | false | Detect installed plugins (slow) |
| versionGuessing | boolean | No | false | Attempt version number guessing |

**Example**:
```javascript
{
  "id": "req-2",
  "command": "identify_cms",
  "url": "https://example.com",
  "includeVulnerabilities": true,
  "includePlugins": true
}
```

**Response**:
```json
{
  "success": true,
  "cms": {
    "name": "WordPress",
    "version": "6.3.1",
    "confidence": 0.99,
    "detectionMethods": ["meta_generator", "wp_content_detection"],
    "plugins": [
      {
        "name": "Yoast SEO",
        "version": "21.0",
        "vulnerabilities": []
      },
      {
        "name": "WooCommerce",
        "version": "7.8.0",
        "vulnerabilities": [
          {
            "cve": "CVE-2024-1234",
            "severity": "medium",
            "description": "...",
            "fixedIn": "7.8.2"
          }
        ]
      }
    ],
    "vulnerabilities": [
      {
        "cve": "CVE-2024-5678",
        "severity": "high",
        "description": "Authentication bypass",
        "fixedIn": "6.3.2"
      }
    ],
    "recommendations": [
      "Update WordPress to 6.3.2 or later",
      "Update WooCommerce plugin to 7.8.2 or later"
    ]
  }
}
```

---

### identify_analytics

Identify analytics and tracking services.

**Command**: `identify_analytics`

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| url | string | Yes | - | Website URL |
| includeMarketingPixels | boolean | No | true | Include marketing pixels (FB, Google, etc) |
| includeProductAnalytics | boolean | No | true | Include product analytics (Mixpanel, etc) |

**Example**:
```javascript
{
  "command": "identify_analytics",
  "url": "https://example.com"
}
```

**Response**:
```json
{
  "success": true,
  "analytics": {
    "webAnalytics": [
      {
        "name": "Google Analytics 4",
        "version": "ga4",
        "propertyId": "G-ABC123XYZ",
        "confidence": 0.99
      }
    ],
    "productAnalytics": [
      {
        "name": "Mixpanel",
        "token": "abc123...",
        "confidence": 0.95
      }
    ],
    "marketingPixels": [
      {
        "name": "Facebook Pixel",
        "pixelId": "123456789",
        "confidence": 0.99
      },
      {
        "name": "LinkedIn Insight Tag",
        "confidence": 0.85
      }
    ],
    "adNetworks": [
      {
        "name": "Google Ads (Conversion Tracking)",
        "conversionId": "abc-123",
        "confidence": 0.95
      }
    ]
  }
}
```

---

## Integration Examples

### Python SDK Example

```python
from basset_hound import TechnologyDetection

detector = TechnologyDetection(
    api_url="ws://localhost:8765"
)

# Detect all technologies
result = await detector.detect_technologies(
    url="https://competitor.com",
    includeVulnerabilities=True
)

print(f"Detected {len(result.technologies.frameworks)} frameworks")
print(f"Found {len(result.technologies.vulnerabilities)} vulnerabilities")

# Identify CMS
cms = await detector.identify_cms(
    url="https://competitor.com",
    includePlugins=True
)

if cms:
    print(f"CMS: {cms.name} {cms.version}")
    for vuln in cms.vulnerabilities:
        print(f"  - {vuln.cve}: {vuln.description}")

# Check analytics
analytics = await detector.identify_analytics(
    url="https://competitor.com"
)

for service in analytics.webAnalytics:
    print(f"Analytics: {service.name} ({service.propertyId})")
```

---

### JavaScript SDK Example

```javascript
import { TechnologyDetection } from 'basset-hound-sdk';

const detector = new TechnologyDetection({
  apiUrl: 'ws://localhost:8765'
});

// Detect technologies
const result = await detector.detectTechnologies({
  url: 'https://example.com',
  includeVulnerabilities: true
});

console.log('Frameworks:', result.technologies.frameworks);
console.log('Vulnerabilities:', result.technologies.vulnerabilities);

// Identify CMS
const cms = await detector.identifyCMS({
  url: 'https://example.com',
  includePlugins: true
});

if (cms) {
  console.log(`${cms.name} ${cms.version}`);
  cms.vulnerabilities.forEach(vuln => {
    console.log(`  - ${vuln.cve}: ${vuln.description}`);
  });
}

// Get analytics setup
const analytics = await detector.identifyAnalytics({
  url: 'https://example.com'
});

analytics.webAnalytics.forEach(service => {
  console.log(`Analytics: ${service.name}`);
});
```

---

## Accuracy & Limitations

### Accuracy by Technology Type

| Category | Accuracy | Confidence |
|----------|----------|-----------|
| CMS (WordPress, Drupal) | 95-99% | Very High |
| Analytics Services | 98-99% | Very High |
| Frontend Frameworks | 85-95% | High |
| Libraries | 80-90% | High |
| Server Software | 70-85% | Medium-High |
| Custom Backends | 40-60% | Medium |
| Third-party Services | 90-98% | High |

### Known Limitations

1. **Hidden Technologies**
   - Technologies may be intentionally hidden
   - Can't detect non-web technologies
   - May miss custom/proprietary frameworks

2. **Version Detection**
   - Exact versions sometimes impossible to determine
   - May only detect major version
   - Custom forks may show incorrect versions

3. **Single Page Apps (SPAs)**
   - May miss backend technologies
   - Version detection depends on source maps
   - Dynamic content harder to analyze

4. **Obscured Technologies**
   - Minified/obfuscated code harder to analyze
   - Build process can hide identifiers
   - Custom naming makes detection harder

5. **Rate Limiting**
   - Some sites block automated requests
   - Require proxy rotation or delays
   - Authentication may be required

### Improving Detection Accuracy

1. **Use Multiple URLs**
   - Scan multiple pages (home, about, API docs)
   - Different pages may reveal different technologies

2. **Enable Plugin Detection** (if available)
   - Takes longer but finds more details
   - Good for WordPress sites

3. **Check Security Headers**
   - May reveal technology through error messages
   - Certificate information is reliable

4. **Monitor for Changes**
   - Re-scan periodically to catch updates
   - Compare detection results over time

---

## Troubleshooting

### Detection Returns Empty Results

**Symptoms**: `technologies` object is empty or minimal

**Causes & Solutions**:

1. **URL Unreachable**
   - Verify URL is accessible
   - Check for authentication requirements
   - Try with different user agent

2. **Website Uses Heavy JavaScript Rendering**
   - Detection may miss client-rendered content
   - Enable JavaScript execution in scanner
   - Increase timeout value

3. **Technologies Intentionally Hidden**
   - Some sites obfuscate technology identifiers
   - May need to analyze network requests
   - Check for custom headers or cookies

---

### CVE Detection Not Working

**Symptoms**: `includeVulnerabilities: true` returns empty vulnerability list

**Causes & Solutions**:

1. **Technology Version Not Detected**
   - Try `identify_cms` instead of `detect_technologies`
   - Enable `versionGuessing` option
   - Use `identify_plugins` to get detailed versions

2. **Vulnerability Database Not Updated**
   - Check if CVE database is current
   - May need to update local signatures
   - Try official vulnerability databases

3. **False Negatives**
   - Site may have patched but keeps old version strings
   - Check security headers for patch evidence

---

### High False Positive Rate

**Symptoms**: Detecting technologies that aren't actually present

**Solutions**:

1. **Filter by Confidence**
   - Only trust detections with confidence ≥ 0.9
   - Discard lower confidence results

2. **Use Multiple Detection Methods**
   - Verify with network request analysis
   - Check source code comments
   - Look for multiple detection vectors

3. **Cross-Reference with Known Patterns**
   - Compare against known technology fingerprints
   - Verify against company documentation

---

## Best Practices

1. **Security Monitoring**:
   - Scan for vulnerabilities in production
   - Monitor dependencies regularly
   - Set up alerts for new CVEs

2. **Competitive Analysis**:
   - Scan competitors monthly
   - Track technology adoption trends
   - Identify early adopters of new frameworks

3. **Due Diligence**:
   - Get technology baseline before acquisition
   - Monitor for tech debt accumulation
   - Track modernization efforts

4. **Integration**:
   - Integrate with vulnerability management systems
   - Automate scanning for critical technologies
   - Create reports for security/architecture teams

---

## Related Documentation

- [API Reference](/docs/API-REFERENCE.md) - Complete WebSocket API
- [Competitor Monitoring](/docs/features/COMPETITOR-MONITORING.md) - Monitor tech changes
- Security Operations - Security best practices
- [Python SDK Guide](/docs/integration/PYTHON-SDK-GUIDE.md) - SDK integration

---

**Document Version**: 12.2.0  
**Last Updated**: June 1, 2026

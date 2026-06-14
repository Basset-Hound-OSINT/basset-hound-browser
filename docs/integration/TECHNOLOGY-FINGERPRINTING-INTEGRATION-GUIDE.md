# Technology Fingerprinting - Integration Guide

**Version:** v12.0.0  
**Last Updated:** June 13, 2026  
**Status:** Production Ready  
**Technologies Detected:** 80+

## Feature Overview

Technology Fingerprinting detects web technologies used by websites through pattern analysis. The system identifies JavaScript frameworks, CMS platforms, analytics tools, CDNs, and 20+ other technology categories using HTML patterns, HTTP headers, JavaScript objects, and network signatures.

**Capabilities:**
- 80+ technologies across 24 categories
- HTML/CSS/JS pattern detection
- HTTP header analysis
- Cookie and meta tag patterns
- JavaScript object detection
- Real-time detection during page load
- Wappalyzer-compatible pattern database

## Quick Start

### Minimal Example - Node.js

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  // Detect technologies on a webpage
  const detectMsg = {
    command: 'detect_technologies',
    params: {
      sessionId: 'tech_detect_001',
      url: 'https://example.com',
      html: '<html>...</html>',
      headers: {
        'Server': 'Apache/2.4.41',
        'X-Powered-By': 'Express.js'
      }
    }
  };
  
  ws.send(JSON.stringify(detectMsg));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log('Detected technologies:', response.data.technologies);
});
```

### Python Example

```python
import json
import asyncio
import websockets

async def detect_technologies():
    uri = "ws://localhost:8765"
    
    async with websockets.connect(uri) as websocket:
        # Detect from page content
        detect_msg = {
            "command": "detect_technologies",
            "params": {
                "sessionId": "tech_detect_001",
                "url": "https://example.com",
                "html": "<html>...</html>",
                "headers": {
                    "Server": "nginx/1.21.0",
                    "X-Powered-By": "Laravel"
                }
            }
        }
        
        await websocket.send(json.dumps(detect_msg))
        response = json.loads(await websocket.recv())
        
        for tech in response['data']['technologies']:
            print(f"- {tech['name']} ({tech['category']})")
            print(f"  Version: {tech.get('version', 'unknown')}")
            print(f"  Confidence: {tech['confidence']}%")

asyncio.run(detect_technologies())
```

## Supported Technologies

### Technology Categories

| Category | Count | Examples |
|----------|-------|----------|
| JavaScript Frameworks | 15+ | React, Vue, Angular, Svelte, Next.js |
| Frontend Frameworks | 10+ | Bootstrap, Tailwind, Material Design |
| CMS | 8+ | WordPress, Drupal, Joomla, Magento |
| E-commerce | 6+ | Shopify, WooCommerce, BigCommerce |
| Web Servers | 5+ | Apache, Nginx, IIS, Node.js |
| Analytics | 8+ | Google Analytics, Mixpanel, Segment |
| CDN | 5+ | Cloudflare, Akamai, AWS CloudFront |
| Security | 4+ | WAF, SSL/TLS, security headers |
| Payment | 5+ | Stripe, PayPal, Square |
| Maps | 3+ | Google Maps, Mapbox, Leaflet |
| Video Players | 4+ | YouTube, Vimeo, JW Player |
| Fonts | 3+ | Google Fonts, TypeKit, Fonts.com |
| Social | 4+ | Facebook, Twitter, LinkedIn |
| Authentication | 3+ | Auth0, Okta, Firebase |
| Plus 11 more categories... | | |

### Partial Technology List

- **Frameworks:** React, Vue.js, Angular, Svelte, Next.js, Nuxt.js, Gatsby, Ember.js
- **CMS:** WordPress, Drupal, Joomla, Magento, Shopify, Ghost, Contentful
- **Analytics:** Google Analytics, Mixpanel, Segment, Kissmetrics, Heap
- **CDN:** Cloudflare, Akamai, AWS CloudFront, Fastly, KeyCDN
- **Payment:** Stripe, PayPal, Square, 2Checkout
- **Maps:** Google Maps, Mapbox, Leaflet, OpenStreetMap
- **Video:** YouTube, Vimeo, JW Player, Wistia
- **Auth:** Auth0, Okta, Firebase, Amazon Cognito
- **Servers:** Apache, Nginx, IIS, LiteSpeed, Node.js
- **Languages:** PHP, Python, Node.js, Ruby, Java, ASP.NET

## WebSocket Commands

### Command Overview

| Command | Purpose |
|---------|---------|
| `detect_technologies` | Detect technologies from page data |
| `get_technology_categories` | List all technology categories |
| `get_technology_fingerprint` | Get details for one technology |
| `search_technologies` | Search technologies by keyword |

## Command Details

### detect_technologies

Detect technologies from page content and headers.

**Parameters:**
```json
{
  "sessionId": "tech_detect_001",
  "url": "https://example.com",
  "html": "<html>...</html>",
  "headers": {
    "Server": "Apache/2.4.41",
    "X-Powered-By": "Express.js"
  },
  "cookies": ["analytics_token=...", "session_id=..."],
  "scripts": ["https://cdn.jsdelivr.net/npm/react@18/...", "https://example.com/app.js"],
  "metadata": {
    "caseNumber": "CASE-001",
    "purpose": "Technology assessment"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "timestamp": "2026-06-13T14:23:45Z",
    "technologies": [
      {
        "name": "React",
        "version": "18.2.0",
        "category": "JavaScript Frameworks",
        "confidence": 95,
        "detection": "HTML attribute data-reactroot, script source contains react",
        "website": "https://reactjs.org"
      },
      {
        "name": "Webpack",
        "version": "5.75.0",
        "category": "Build Tools",
        "confidence": 87,
        "detection": "JavaScript global __webpack_require__",
        "website": "https://webpack.js.org"
      },
      {
        "name": "Google Analytics",
        "version": null,
        "category": "Analytics",
        "confidence": 92,
        "detection": "Script source ga.js, gtag function",
        "website": "https://analytics.google.com"
      },
      {
        "name": "Cloudflare",
        "version": null,
        "category": "CDN",
        "confidence": 78,
        "detection": "HTTP header Server: cloudflare, CF-RAY header",
        "website": "https://cloudflare.com"
      }
    ],
    "categoryBreakdown": {
      "JavaScript Frameworks": 2,
      "Build Tools": 1,
      "Analytics": 1,
      "CDN": 1
    },
    "totalDetected": 4,
    "analysisTime": 234
  }
}
```

**Parameters Table:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | Yes | Session identifier |
| url | string | No | URL being analyzed |
| html | string | No | HTML content (required for detection) |
| headers | object | No | HTTP response headers |
| cookies | array | No | Cookies from domain |
| scripts | array | No | Script sources loaded |
| metadata | object | No | Custom metadata |

**Error Codes:**

| Error | Cause |
|-------|-------|
| "sessionId is required" | Missing session ID |
| "html is required" | No HTML content provided |
| "Failed to analyze content" | Parsing error |

**Latency:** 100-500ms

---

### get_technology_categories

Get list of all technology categories.

**Parameters:** (none)

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "name": "JavaScript Frameworks",
        "count": 15,
        "examples": ["React", "Vue", "Angular"]
      },
      {
        "name": "Frontend Frameworks",
        "count": 10,
        "examples": ["Bootstrap", "Tailwind"]
      },
      {
        "name": "CMS",
        "count": 8,
        "examples": ["WordPress", "Drupal"]
      }
    ],
    "totalCategories": 24,
    "totalTechnologies": 80
  }
}
```

**Latency:** 1-10ms

---

### get_technology_fingerprint

Get detailed information about a technology.

**Parameters:**
```json
{
  "technology": "react"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "React",
    "key": "react",
    "category": "JavaScript Frameworks",
    "website": "https://reactjs.org",
    "description": "A JavaScript library for building user interfaces",
    "patterns": {
      "html": [
        "data-reactroot",
        "data-reactid",
        "id=(['\"])(?:root|app|__next)(['\"])"
      ],
      "scripts": [
        "react(?:\\.production)?(?:\\.min)?\\.js",
        "react-dom(?:\\.production)?(?:\\.min)?\\.js"
      ],
      "js": [
        "React\\.createElement",
        "ReactDOM\\.render",
        "_reactRootContainer"
      ],
      "meta": [],
      "headers": [],
      "cookies": []
    },
    "knownVersions": ["16.x", "17.x", "18.x"],
    "detectionDifficulty": "EASY",
    "commonPairs": [
      "Webpack",
      "Babel",
      "Redux"
    ]
  }
}
```

**Latency:** 1-5ms

---

### search_technologies

Search technologies by keyword or category.

**Parameters:**
```json
{
  "query": "react",
  "searchIn": "name|description|category"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "react",
    "results": [
      {
        "name": "React",
        "category": "JavaScript Frameworks",
        "website": "https://reactjs.org"
      },
      {
        "name": "Next.js",
        "category": "JavaScript Frameworks",
        "website": "https://nextjs.org",
        "note": "React-based framework"
      }
    ],
    "resultCount": 2
  }
}
```

**Latency:** 5-20ms

---

## Technology Detection Methods

### 1. HTML Pattern Detection

Detects tech through HTML attributes and structure:
```html
<!-- React -->
<div id="root" data-reactroot></div>
<div id="app" data-reactid="0"></div>

<!-- Vue.js -->
<div id="app" data-v-abc123></div>

<!-- jQuery -->
<script src="jquery-1.11.0.min.js"></script>
```

### 2. HTTP Header Analysis

Examines response headers:
```
Server: Apache/2.4.41 (Ubuntu)
X-Powered-By: Express.js
X-AspNet-Version: 4.0.30319
CF-Ray: 7a1234a5b6c7d8e9-LAX (Cloudflare)
```

### 3. JavaScript Object Detection

Checks for known global objects:
```javascript
window.React // React detection
window.Vue // Vue.js detection
window.__webpack_require__ // Webpack detection
window.ga // Google Analytics detection
```

### 4. Cookie Analysis

Identifies tech from cookie names/values:
```javascript
// Google Analytics
_ga, _gat, _gid

// Mixpanel
mp_lib, mixpanel

// HubSpot
hubspotutk, __hstc
```

### 5. Meta Tag Patterns

Looks at meta tags and viewport settings:
```html
<meta name="generator" content="WordPress 6.0">
<meta name="apple-mobile-web-app-capable" content="yes">
```

## Use Cases

### Use Case 1: Identify Website Tech Stack

Determine all technologies used on a target website.

```javascript
async function identifyTechStack(url) {
  const response = await fetch(url);
  const html = await response.text();
  const headers = {
    'Server': response.headers.get('Server'),
    'X-Powered-By': response.headers.get('X-Powered-By')
  };
  
  const detectMsg = {
    command: 'detect_technologies',
    params: {
      sessionId: `tech_${Date.now()}`,
      url: url,
      html: html,
      headers: headers
    }
  };
  
  const result = await sendWebSocketCommand(detectMsg);
  
  // Organize by category
  const stack = {};
  for (const tech of result.data.technologies) {
    if (!stack[tech.category]) {
      stack[tech.category] = [];
    }
    stack[tech.category].push({
      name: tech.name,
      version: tech.version,
      confidence: tech.confidence
    });
  }
  
  return stack;
}

// Usage
const stack = await identifyTechStack('https://example.com');
console.log('Tech Stack:', JSON.stringify(stack, null, 2));
```

### Use Case 2: Assess Security Posture

Identify outdated or vulnerable technologies.

```javascript
async function assessSecurityPosture(url) {
  const detectionResult = await fetch(url)
    .then(r => r.text())
    .then(html => {
      return sendWebSocketCommand({
        command: 'detect_technologies',
        params: {
          sessionId: `security_${Date.now()}`,
          url: url,
          html: html
        }
      });
    });
  
  const risks = [];
  
  for (const tech of detectionResult.data.technologies) {
    // Check for known vulnerabilities
    if (tech.version && isOutdated(tech.name, tech.version)) {
      risks.push({
        technology: tech.name,
        version: tech.version,
        risk: 'OUTDATED',
        recommendation: `Update to latest version`
      });
    }
    
    // Check for insecure technologies
    if (isKnownVulnerable(tech.name)) {
      risks.push({
        technology: tech.name,
        risk: 'KNOWN_VULNERABLE',
        recommendation: `Replace with secure alternative`
      });
    }
  }
  
  return {
    url: url,
    totalTechnologies: detectionResult.data.technologies.length,
    riskCount: risks.length,
    risks: risks
  };
}
```

### Use Case 3: Compare Competitor Tech Stacks

Analyze multiple websites for technology differences.

```javascript
async function compareCompetitors(urls) {
  const stacks = {};
  
  for (const url of urls) {
    const html = await fetch(url).then(r => r.text());
    const result = await sendWebSocketCommand({
      command: 'detect_technologies',
      params: {
        sessionId: `competitor_${url}`,
        url: url,
        html: html
      }
    });
    
    stacks[url] = result.data.technologies;
  }
  
  // Find common technologies
  const allTechs = new Set();
  for (const techs of Object.values(stacks)) {
    techs.forEach(t => allTechs.add(t.name));
  }
  
  // Build comparison matrix
  const comparison = {};
  for (const tech of allTechs) {
    comparison[tech] = {};
    for (const [url, techs] of Object.entries(stacks)) {
      comparison[tech][url] = techs.some(t => t.name === tech) ? '✓' : '✗';
    }
  }
  
  return comparison;
}

// Usage
const matrix = await compareCompetitors([
  'https://competitor1.com',
  'https://competitor2.com',
  'https://competitor3.com'
]);

console.table(matrix);
```

### Use Case 4: Track Technology Trends

Monitor technology adoption over time.

```javascript
async function trackTechnologyTrend(url, interval = 86400000) {
  const history = [];
  
  const collectSnapshot = async () => {
    const html = await fetch(url).then(r => r.text());
    const result = await sendWebSocketCommand({
      command: 'detect_technologies',
      params: {
        sessionId: `trend_${Date.now()}`,
        url: url,
        html: html
      }
    });
    
    history.push({
      timestamp: new Date().toISOString(),
      technologies: result.data.technologies.map(t => ({
        name: t.name,
        version: t.version
      }))
    });
    
    // Analyze trend
    if (history.length >= 2) {
      const prev = history[history.length - 2].technologies;
      const curr = history[history.length - 1].technologies;
      
      const added = curr.filter(c => !prev.some(p => p.name === c.name));
      const removed = prev.filter(p => !curr.some(c => c.name === p.name));
      
      console.log(`Added: ${added.map(a => a.name).join(', ')}`);
      console.log(`Removed: ${removed.map(r => r.name).join(', ')}`);
    }
  };
  
  // Collect initial snapshot
  await collectSnapshot();
  
  // Schedule periodic collection
  setInterval(collectSnapshot, interval);
}
```

## Troubleshooting

### Low Confidence Detections

**Problem:** Some technologies detected with <80% confidence

**Explanation:** Pattern matching has uncertainty

**Solution:**
- Use multiple detection sources (html + headers + cookies)
- Cross-reference with domain whois/historical data
- Manual verification for critical findings

### Missing Technologies

**Problem:** Known technology not detected

**Reasons:**
1. Technology not in database (80+ covers most common)
2. Site using custom build (obfuscated, minified)
3. Lazy-loaded technology (only loads on user action)

**Solutions:**
- Update pattern database
- Manual inspection of source code
- Check network requests during interaction

### False Positives

**Problem:** Detecting technology that isn't actually used

**Causes:**
- Library included but not used
- Demo/example code in comments
- Third-party code snippets

**Solutions:**
- Verify with JavaScript inspection (check for actual usage)
- Look for version detection
- Check network tab for actual requests

## Performance Tips

1. **Batch Analysis**:
   - Analyze multiple pages in parallel
   - Reduces total time for multiple sites

2. **Cache Results**:
   - Cache for same URL (expires after 24 hours)
   - Reduces duplicate processing

3. **Selective Detection**:
   - Only analyze critical sections if page is large
   - Focus on head/key JS includes first

4. **Incremental Updates**:
   - For tracking trends, only compare with previous
   - Store deltas rather than full snapshots

## Related Documentation

- [Technology Fingerprinting - API Reference](../api/TECHNOLOGY-FINGERPRINTING-API-REFERENCE.md)
- [Technology Fingerprinting - Architecture](../technical/TECHNOLOGY-FINGERPRINTING-ARCHITECTURE.md)
- [Technology Fingerprinting - User Guide](../guides/TECHNOLOGY-FINGERPRINTING-USER-GUIDE.md)

# Technology Fingerprinting - API Reference

**Version:** v12.0.0  
**Last Updated:** June 13, 2026  
**API Endpoint:** `ws://localhost:8765`  
**Technologies:** 80+ across 24 categories

## Command Reference

### 1. detect_technologies

Detect technologies from page content and headers.

**Command Name:** `detect_technologies`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string | Yes | Session identifier |
| url | string | No | URL being analyzed |
| html | string | No | HTML content (required for detection) |
| headers | object | No | HTTP response headers |
| cookies | array | No | Cookies from domain |
| scripts | array | No | Script sources loaded |
| metadata | object | No | Custom metadata |

**Request:**
```json
{
  "command": "detect_technologies",
  "params": {
    "sessionId": "tech_detect_001",
    "url": "https://example.com",
    "html": "<html>...</html>",
    "headers": {
      "Server": "Apache/2.4.41",
      "X-Powered-By": "Express.js"
    },
    "cookies": ["analytics_token=...", "session=..."],
    "scripts": [
      "https://cdn.jsdelivr.net/npm/react@18/...",
      "https://example.com/app.js"
    ],
    "metadata": {
      "caseNumber": "CASE-001"
    }
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

**Latency:** 100-500ms

**Error Codes:**

| Error | Cause |
|-------|-------|
| "sessionId is required" | Missing session ID |
| "html is required" | No HTML content provided |
| "Failed to analyze content" | Parsing error |

---

### 2. get_technology_categories

Get list of all technology categories and counts.

**Command Name:** `get_technology_categories`

**Parameters:** (none)

**Request:**
```json
{
  "command": "get_technology_categories",
  "params": {}
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "name": "JavaScript Frameworks",
        "count": 15,
        "examples": ["React", "Vue", "Angular", "Svelte"]
      },
      {
        "name": "Frontend Frameworks",
        "count": 10,
        "examples": ["Bootstrap", "Tailwind", "Material Design"]
      },
      {
        "name": "CMS",
        "count": 8,
        "examples": ["WordPress", "Drupal", "Joomla"]
      },
      {
        "name": "E-commerce",
        "count": 6,
        "examples": ["Shopify", "WooCommerce", "BigCommerce"]
      },
      {
        "name": "Web Servers",
        "count": 5,
        "examples": ["Apache", "Nginx", "IIS"]
      },
      {
        "name": "Analytics",
        "count": 8,
        "examples": ["Google Analytics", "Mixpanel", "Segment"]
      },
      {
        "name": "CDN",
        "count": 5,
        "examples": ["Cloudflare", "Akamai", "AWS CloudFront"]
      },
      {
        "name": "Security",
        "count": 4,
        "examples": ["WAF", "Security Headers"]
      },
      {
        "name": "Payment",
        "count": 5,
        "examples": ["Stripe", "PayPal", "Square"]
      },
      {
        "name": "Maps",
        "count": 3,
        "examples": ["Google Maps", "Mapbox", "Leaflet"]
      }
    ],
    "totalCategories": 24,
    "totalTechnologies": 80
  }
}
```

**Latency:** 1-10ms

---

### 3. get_technology_fingerprint

Get detailed information about a specific technology.

**Command Name:** `get_technology_fingerprint`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| technology | string | Yes | Technology key (lowercase) |

**Request:**
```json
{
  "command": "get_technology_fingerprint",
  "params": {
    "technology": "react"
  }
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
        "react-dom(?:\\.production)?(?:\\.min)?\\.js",
        "unpkg\\.com\\/react",
        "cdnjs\\.cloudflare\\.com\\/ajax\\/libs\\/react"
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

**Error Codes:**

| Error | Cause |
|-------|-------|
| "technology is required" | Missing technology parameter |
| "Technology not found" | Unknown technology key |

---

### 4. search_technologies

Search technologies by keyword or in specific fields.

**Command Name:** `search_technologies`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Search keyword |
| searchIn | string | No | Fields to search (name, description, category) |

**Request:**
```json
{
  "command": "search_technologies",
  "params": {
    "query": "react",
    "searchIn": "name"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "react",
    "searchIn": "name",
    "results": [
      {
        "name": "React",
        "category": "JavaScript Frameworks",
        "website": "https://reactjs.org",
        "key": "react"
      },
      {
        "name": "Next.js",
        "category": "JavaScript Frameworks",
        "website": "https://nextjs.org",
        "key": "nextjs",
        "note": "React-based framework"
      }
    ],
    "resultCount": 2
  }
}
```

**Latency:** 5-20ms

---

## Technology Categories

### Complete List (24 Categories)

1. **JavaScript Frameworks** (15+)
   - React, Vue.js, Angular, Svelte, Next.js, Nuxt.js, Gatsby, Ember.js

2. **Frontend Frameworks** (10+)
   - Bootstrap, Tailwind CSS, Material Design, Foundation

3. **Content Management Systems** (8+)
   - WordPress, Drupal, Joomla, Magento, Ghost, Contentful

4. **E-commerce** (6+)
   - Shopify, WooCommerce, BigCommerce, Magento, PrestaShop

5. **Web Servers** (5+)
   - Apache, Nginx, IIS, LiteSpeed, Node.js

6. **Analytics** (8+)
   - Google Analytics, Mixpanel, Segment, Kissmetrics, Heap

7. **CDN** (5+)
   - Cloudflare, Akamai, AWS CloudFront, Fastly, KeyCDN

8. **Security** (4+)
   - Web Application Firewall, SSL/TLS, Security Headers

9. **Payment Processors** (5+)
   - Stripe, PayPal, Square, 2Checkout, Authorize.net

10. **Maps** (3+)
    - Google Maps, Mapbox, Leaflet

11. **Video Players** (4+)
    - YouTube, Vimeo, JW Player, Wistia

12. **Fonts** (3+)
    - Google Fonts, TypeKit, Fonts.com

13. **Social** (4+)
    - Facebook SDK, Twitter, LinkedIn, Instagram

14. **Authentication** (3+)
    - Auth0, Okta, Firebase Auth, Amazon Cognito

15. **Build Tools** (5+)
    - Webpack, Babel, Gulp, Grunt, Parcel

16. **Programming Languages** (3+)
    - PHP, Python, Node.js

17. **Databases** (3+)
    - MongoDB, MySQL, PostgreSQL

18. **Message Queues** (2+)
    - RabbitMQ, Apache Kafka

19. **Search Engines** (2+)
    - Elasticsearch, Algolia

20. **Widgets** (3+)
    - Zendesk, Intercom, HubSpot

21. **JavaScript Libraries** (10+)
    - jQuery, Lodash, D3.js, Chart.js

22. **CSS Frameworks** (5+)
    - Bootstrap, Tailwind, Foundation

23. **Tag Managers** (2+)
    - Google Tag Manager, Tealium

24. **Caching** (3+)
    - Redis, Memcached, Varnish

---

## Detection Methods

### Pattern Types

| Type | Example | Confidence |
|------|---------|-----------|
| HTML | `data-reactroot`, `id="app"` | High (90-95%) |
| Headers | `Server: Apache/2.4.41` | Medium-High (70-85%) |
| Scripts | `script src="react.js"` | High (85-95%) |
| JS Objects | `window.React` | Very High (95%+) |
| Cookies | `_ga` (Google Analytics) | Medium (60-80%) |
| Meta Tags | `generator` content | Medium (70-85%) |

### Confidence Levels

- 95-100%: Very confident (multiple patterns)
- 85-95%: High confidence (strong pattern match)
- 70-85%: Medium confidence (single pattern or header)
- 50-70%: Low confidence (weak indication)
- <50%: Very low (possible false positive)

---

## Error Handling

```json
{
  "success": false,
  "error": "error message describing issue"
}
```

---

## Performance

| Command | Latency | Notes |
|---------|---------|-------|
| detect_technologies | 100-500ms | Depends on HTML size |
| get_technology_categories | 1-10ms | Static data |
| get_technology_fingerprint | 1-5ms | Single lookup |
| search_technologies | 5-20ms | Pattern matching |

---

## Related Documentation

- [Technology Fingerprinting - Integration Guide](../integration/TECHNOLOGY-FINGERPRINTING-INTEGRATION-GUIDE.md)
- [Technology Fingerprinting - User Guide](../guides/TECHNOLOGY-FINGERPRINTING-USER-GUIDE.md)

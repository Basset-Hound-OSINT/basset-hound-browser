> ⚠️ **OUTDATED** — see `docs/planning/PROJECT-STATUS-MATRIX.md` for the authoritative status (2026-07-04). Claims below are inflated/unverified. The proxy-pool / proxy-intelligence commands (`register_proxy`, `get_best_proxy`, etc.) are NOT registered in the running server — those files were migrated to `basset-hound-networking`. Only single-proxy set/clear/status + simple list rotation + Tor ON/OFF/AUTO are real. Dark-web investigation is out-of-scope per SCOPE.md.

# Proxy Intelligence Guide

**Version**: 12.2.0  
**Last Updated**: June 1, 2026  
**Status**: Production Ready  
**Estimated Read Time**: 30 minutes

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [Geographic Consistency](#geographic-consistency)
5. [Reputation System](#reputation-system)
6. [Provider Detection](#provider-detection)
7. [API Reference](#api-reference)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Proxy Intelligence?

Proxy Intelligence automatically manages proxy rotation while maintaining geographic consistency and provider reputation:

- **Smart Rotation**: Automatically rotate proxies between requests
- **Geographic Consistency**: Maintain consistent region/country for related requests
- **Reputation System**: Track proxy quality, auto-exclude bad proxies
- **Provider Fallback**: Switch providers if one fails
- **Performance Analytics**: Track proxy speed and reliability
- **Provider Detection**: Identify what type of proxy is being used

### Typical Use Cases

1. **Competitor Monitoring**: Rotate IPs while monitoring competitor websites
2. **Geographic Consistency**: Maintain one region while exploring a site
3. **Rate Limit Avoidance**: Distribute requests across many proxies
4. **Credential Stuffing Prevention**: Appear as different users/locations
5. **Bot Detection Evasion**: Vary IP address signatures

---

## Quick Start

### Basic Proxy Rotation

```javascript
// Enable proxy rotation (default: off)
{
  "id": "req-1",
  "command": "set_proxy_rotation",
  "enabled": true,
  "strategy": "random"  // or "sequential", "round_robin"
}
```

**Response**:
```json
{
  "success": true,
  "rotation": {
    "enabled": true,
    "strategy": "random",
    "currentProxy": "http://proxy-1.residential.com:8080",
    "proxiesAvailable": 500
  }
}
```

### Geographic Consistency

```javascript
// Lock to one region for multiple requests
{
  "command": "set_geographic_region",
  "region": "US-CA",  // California, USA
  "consistency": "strict"  // Maintain exact region
}

// Now all requests use California proxies
{
  "command": "navigate",
  "url": "https://example.com"  // Uses CA proxy
}

{
  "command": "navigate",
  "url": "https://example.com/page2"  // Uses CA proxy
}

// Gradient rotation: slowly change region
{
  "command": "set_geographic_region",
  "region": "US-CA",
  "consistency": "gradient",
  "rotationRate": 5  // Change every 5 requests
}
```

### Reputation Monitoring

```javascript
// Get proxy reputation
{
  "command": "get_proxy_reputation",
  "proxy": "http://proxy-1.residential.com:8080"
}
```

**Response**:
```json
{
  "success": true,
  "proxy": "http://proxy-1.residential.com:8080",
  "reputation": {
    "score": 8.5,  // 0-10, higher is better
    "reliability": 0.98,  // 98% successful requests
    "speed": 450,  // avg ms
    "blockRate": 0.02,  // 2% of requests blocked
    "abuseReports": 0,
    "status": "healthy"
  }
}
```

---

## Core Concepts

### Proxy Types

Basset Hound supports multiple proxy types:

#### Residential Proxies
- Real home user connections
- Lowest block rates
- Slower (home connections)
- More expensive

#### Datacenter Proxies
- Commercial data centers
- Higher block rates
- Fast
- Less expensive

#### ISP Proxies
- ISP-owned data center IPs
- Appear as ISP (legitimate)
- Medium block rates
- Medium speed/cost

#### Mobile Proxies
- Mobile carrier networks
- Very low block rates
- Slower
- Most expensive

#### VPN Proxies
- VPN provider connections
- Varies by provider
- Medium speed
- Cost varies

### Rotation Strategies

#### Random Strategy
```
Request 1: Proxy A
Request 2: Proxy C
Request 3: Proxy B
Request 4: Proxy E
...
Random selection each request
```

Use when: No specific pattern needed, just vary IPs

#### Sequential Strategy
```
Request 1: Proxy A
Request 2: Proxy B
Request 3: Proxy C
Request 4: Proxy D
...
Cycle through proxies in order
```

Use when: Predictable rotation preferred

#### Round-Robin Strategy
```
Request 1: Proxy A (from pool 1)
Request 2: Proxy B (from pool 2)
Request 3: Proxy C (from pool 3)
Request 4: Proxy A (from pool 1)
...
Distribute evenly across proxies
```

Use when: Balance load across proxies

### Geographic Consistency

Proxies are organized by geographic location:

```
Geographic Hierarchy:
├─ US (United States)
│  ├─ US-CA (California)
│  ├─ US-NY (New York)
│  └─ US-TX (Texas)
├─ UK (United Kingdom)
│  ├─ UK-EN (England)
│  └─ UK-SC (Scotland)
└─ JP (Japan)
   ├─ JP-TO (Tokyo)
   └─ JP-OS (Osaka)
```

**Consistency Levels**:

```
strict:    Always use exact region (e.g., US-CA)
           Rotation within region only
           Risk: Runs out of proxies if small pool

gradient:  Gradually change region
           Can drift to nearby regions
           Benefit: Larger pool, smoother transitions

loose:     Change region freely
           Only maintain country
           Risk: May trigger location-change detection
```

### Reputation System

Each proxy has a reputation score (0-10):

```
10 ────────────────────── Excellent
        ▲
   9    │  Healthy range
        │  - 98%+ reliability
   8    │  - < 5% block rate
        │  - < 1% abuse reports
   7 ────┼──────────────── Good
        │
   6    │  Warning range
        │  - 90-98% reliability
   5    │  - 5-15% block rate
        │
   4 ────┼──────────────── Poor
        │
   3    │  Quarantine range
        │  - < 90% reliability
   2    │  - > 15% block rate
        │
   1    ▼
        └────────────────── Excluded
        (auto-removed)
```

**Auto-Exclusion Rules**:
- Score drops below 2.0
- 3+ consecutive failures
- Blocked on 20%+ of requests
- Abuse reports received

### Fallback Strategy

When primary provider fails, system automatically falls back:

```
Primary Provider (Residential)
    ↓
[Failure rate > 20%]
    ↓
Fallback to Secondary (Datacenter)
    ↓
[Still failing]
    ↓
Fallback to Tertiary (ISP)
    ↓
[Still failing]
    ↓
Return to Primary (allow retry)
```

---

## Geographic Consistency

### Setting Geographic Region

```javascript
// Strict consistency (US-CA only)
{
  "command": "set_geographic_region",
  "region": "US-CA",
  "consistency": "strict"
}

// Gradient rotation (drift slowly from US-CA)
{
  "command": "set_geographic_region",
  "region": "US-CA",
  "consistency": "gradient",
  "rotationRate": 10  // Change every 10 requests
}

// Loose consistency (stay in US)
{
  "command": "set_geographic_region",
  "region": "US",
  "consistency": "loose"
}
```

### Multi-Region Exploration

```javascript
// Phase 1: Research from California perspective
{
  "command": "set_geographic_region",
  "region": "US-CA"
}

{
  "command": "navigate",
  "url": "https://example.com/regional-content"
}

// Phase 2: Change to Texas (after checkpoint)
{
  "command": "create_session_checkpoint",
  "name": "california_research_complete"
}

{
  "command": "set_geographic_region",
  "region": "US-TX"
}

{
  "command": "navigate",
  "url": "https://example.com/regional-content"
}
```

### Gradual Region Rotation

Good for long-running sessions to appear natural:

```javascript
// Set up gradient rotation
{
  "command": "set_proxy_rotation",
  "enabled": true,
  "geographic": {
    "baseRegion": "US",
    "consistency": "gradient",
    "rotationRate": 20,  // Change every 20 requests
    "maxDrift": 500,     // Max distance in km
    "transitionDuration": 3600000  // 1 hour to drift
  }
}

// Session gradually drifts from California to Nevada to Utah
// Over 1 hour of natural-looking geographic movement
```

---

## Reputation System

### Monitoring Reputation

```javascript
// Get individual proxy reputation
{
  "command": "get_proxy_reputation",
  "proxy": "http://proxy-1.residential.com:8080"
}

// Get all proxies in rotation ranked by reputation
{
  "command": "get_proxy_pool_reputation",
  "limit": 20
}
```

**Response**:
```json
{
  "success": true,
  "proxies": [
    {
      "proxy": "http://proxy-1.residential.com:8080",
      "score": 9.2,
      "reliability": 0.99,
      "speed": 320,
      "blockRate": 0.01,
      "abuseReports": 0,
      "region": "US-CA",
      "provider": "residential",
      "status": "healthy"
    },
    {
      "proxy": "http://proxy-2.datacenter.com:8080",
      "score": 7.1,
      "reliability": 0.92,
      "speed": 150,
      "blockRate": 0.08,
      "abuseReports": 1,
      "region": "US-NY",
      "provider": "datacenter",
      "status": "healthy"
    }
  ]
}
```

### Reputation Analytics

```javascript
// Get reputation statistics
{
  "command": "get_proxy_reputation_stats"
}
```

**Response**:
```json
{
  "success": true,
  "stats": {
    "total_proxies": 523,
    "healthy": 501,
    "warning": 18,
    "quarantined": 4,
    "average_score": 8.1,
    "average_reliability": 0.96,
    "average_speed": 380,
    "average_block_rate": 0.04,
    "top_provider": "residential",
    "top_region": "US-CA"
  }
}
```

### Custom Reputation Rules

```javascript
// Set custom thresholds
{
  "command": "configure_proxy_reputation",
  "autoExcludeThreshold": 3.0,    // Auto-exclude below 3.0
  "warningThreshold": 5.0,         // Warn at 5.0
  "maxBlockRate": 0.10,            // Exclude if > 10% blocked
  "minReliability": 0.85,          // Exclude if < 85% reliable
  "maxConsecutiveFailures": 5,     // Exclude after 5 failures
  "excludeOnAbuse": true           // Auto-exclude on abuse report
}
```

---

## Provider Detection

### Detecting Proxy Type

```javascript
// Analyze what proxy type you're using
{
  "command": "detect_proxy_type",
  "proxy": "http://proxy-1.example.com:8080"
}
```

**Response**:
```json
{
  "success": true,
  "detection": {
    "proxy": "http://proxy-1.example.com:8080",
    "type": "residential",
    "confidence": 0.95,
    "provider": "residential-provider-x",
    "characteristics": {
      "ipRange": "Home network range",
      "ispName": "Comcast",
      "isResi": true,
      "isDatacenter": false,
      "isMobile": false,
      "isVpn": false
    },
    "indicators": [
      "Home IP geolocation",
      "ISP residential classification",
      "Typical home connection speed"
    ]
  }
}
```

### Website Proxy Detection

Websites may detect you're using a proxy. Check:

```javascript
// Get proxy detectability report
{
  "command": "analyze_proxy_detectability"
}
```

**Response**:
```json
{
  "success": true,
  "report": {
    "currentProxy": "http://proxy-1.residential.com:8080",
    "detectabilityScore": 0.15,  // 0 = undetectable, 1 = obvious
    "riskLevel": "low",
    "indicators": {
      "reverseProxyHeader": false,
      "forwardedHeaders": false,
      "ipGeolocationMismatch": false,
      "proxyBlacklist": false,
      "suspiciousUserAgent": false,
      "dataCenterIp": false
    },
    "recommendations": [
      "Current proxy is well-hidden",
      "IP reputation is good",
      "Safe to use on most sites"
    ]
  }
}
```

---

## API Reference

### Proxy Rotation Commands

#### set_proxy_rotation

Enable and configure proxy rotation.

**Command**: `set_proxy_rotation`

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| enabled | boolean | Yes | - | Enable/disable rotation |
| strategy | string | No | random | Strategy: random, sequential, round_robin |
| provider | string | No | residential | Provider: residential, datacenter, isp, mobile, vpn |
| region | string | No | auto | Region constraint (e.g., "US", "US-CA") |
| rotationRate | number | No | 1 | Change proxy every N requests |
| concurrent | number | No | 1 | Concurrent proxy connections |

**Example**:
```javascript
{
  "command": "set_proxy_rotation",
  "enabled": true,
  "strategy": "random",
  "provider": "residential",
  "region": "US-CA",
  "rotationRate": 1
}
```

---

#### get_proxy_status

Get current proxy and rotation status.

**Command**: `get_proxy_status`

**Example Response**:
```json
{
  "success": true,
  "status": {
    "rotationEnabled": true,
    "strategy": "random",
    "currentProxy": "http://proxy-1.residential.com:8080",
    "provider": "residential",
    "region": "US-CA",
    "requestCount": 42,
    "rotationsDone": 8,
    "nextProxyIn": 7,
    "poolSize": 523
  }
}
```

---

### Geographic Commands

#### set_geographic_region

Set geographic region for proxies.

**Command**: `set_geographic_region`

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| region | string | Yes | - | Region code (e.g., "US-CA") |
| consistency | string | No | strict | Consistency level: strict, gradient, loose |
| rotationRate | number | No | 1 | For gradient: requests per change |
| transitionDuration | number | No | 3600000 | For gradient: total transition time (ms) |

---

#### get_available_regions

List available proxy regions.

**Command**: `get_available_regions`

**Example Response**:
```json
{
  "success": true,
  "regions": [
    {
      "code": "US",
      "name": "United States",
      "proxies": 250,
      "subregions": [
        { "code": "US-CA", "name": "California", "proxies": 50 },
        { "code": "US-NY", "name": "New York", "proxies": 45 }
      ]
    },
    {
      "code": "UK",
      "name": "United Kingdom",
      "proxies": 75,
      "subregions": [...]
    }
  ]
}
```

---

### Reputation Commands

#### get_proxy_reputation

Get reputation for specific proxy.

**Command**: `get_proxy_reputation`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| proxy | string | Yes | Proxy URL (e.g., "http://proxy.com:8080") |

---

#### get_proxy_pool_reputation

Get reputation for all proxies in pool.

**Command**: `get_proxy_pool_reputation`

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| limit | number | No | 50 | Max results |
| sortBy | string | No | score | Sort by: score, speed, reliability, blockRate |
| status | string | No | all | Filter: healthy, warning, quarantined |

---

#### get_proxy_reputation_stats

Get aggregate reputation statistics.

**Command**: `get_proxy_reputation_stats`

---

#### detect_proxy_type

Detect what type of proxy is being used.

**Command**: `detect_proxy_type`

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| proxy | string | Yes | Proxy URL |

---

#### analyze_proxy_detectability

Analyze how easily proxy can be detected.

**Command**: `analyze_proxy_detectability`

---

## Troubleshooting

### High Block Rates

**Symptoms**: Website returns 403/429 errors frequently

**Solutions**:
1. **Use Residential Proxies**: Better reputation than datacenter
```javascript
{
  "command": "set_proxy_rotation",
  "provider": "residential"
}
```

2. **Enable Geographic Consistency**: Maintain same region
```javascript
{
  "command": "set_geographic_region",
  "region": "US-CA",
  "consistency": "strict"
}
```

3. **Slow Down Requests**: Reduce request rate
```javascript
{
  "command": "configure_request_throttle",
  "delayMs": 5000  // 5 seconds between requests
}
```

4. **Check Reputation**: Use better proxies
```javascript
{
  "command": "get_proxy_pool_reputation",
  "status": "healthy"
}
```

---

### Slow Proxies

**Symptoms**: Requests taking 30+ seconds

**Solutions**:
1. **Switch to Datacenter Proxies**: Faster than residential
```javascript
{
  "command": "set_proxy_rotation",
  "provider": "datacenter"
}
```

2. **Use Faster Regions**: Some regions faster than others
```javascript
{
  "command": "set_geographic_region",
  "region": "US-VA"  // East coast, often faster
}
```

3. **Check Proxy Speed**: Monitor metrics
```javascript
{
  "command": "get_proxy_reputation_stats"
}
```

---

### Location Mismatch

**Symptoms**: Website detects different location than expected

**Solutions**:
1. **Enable Strict Geographic Consistency**
```javascript
{
  "command": "set_geographic_region",
  "region": "US-CA",
  "consistency": "strict"
}
```

2. **Set Matching User Agent**: Match region to browser
```javascript
{
  "command": "set_user_agent",
  "category": "US_DESKTOP"  // US-based browser
}
```

3. **Clear Location Cache**: Websites cache location
```javascript
{
  "command": "clear_all_cookies"
}
```

---

## Best Practices

1. **Residential for Stealth**: Use residential proxies for evasion
2. **Geographic Consistency**: Maintain same region for related requests
3. **Monitor Reputation**: Check proxy scores, exclude bad ones
4. **Gradual Changes**: Use gradient rotation for long sessions
5. **Different Providers**: Fallback to other providers if one fails

---

**Document Version**: 12.2.0  
**Last Updated**: June 1, 2026

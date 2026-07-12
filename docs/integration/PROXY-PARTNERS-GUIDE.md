# Proxy Partners Integration Guide

Complete guide to proxy vendor partnerships for Basset Hound Browser.

## Table of Contents

1. [Overview](#overview)
2. [Supported Partners](#supported-partners)
3. [Setup Instructions](#setup-instructions)
4. [Authentication](#authentication)
5. [Partner-Specific Features](#partner-specific-features)
6. [Selection & Optimization](#selection--optimization)
7. [Failover & Recovery](#failover--recovery)
8. [Pricing](#pricing)

## Overview

Basset Hound Browser supports 8+ proxy vendor partnerships, enabling:

- Multi-vendor proxy rotation
- Intelligent partner selection
- Automatic failover
- Cost optimization
- Performance monitoring
- Session management

### Key Concepts

**Partner**: A proxy vendor (Oxylabs, Bright Data, etc.)
**Proxy Type**: Category of proxies (residential, ISP, datacenter, mobile)
**Region**: Geographic location (US, EU, APAC, etc.)
**Session**: Sticky session for maintaining IP consistency
**Failover**: Automatic switch to backup partner on primary failure

## Supported Partners

### 1. Oxylabs

**Tiers**: Residential, ISP, Datacenter
**Regions**: US, EU, APAC, LATAM
**Key Feature**: Per-request IP rotation

#### Setup

```javascript
// Register credentials
await registerPartner({
  partnerId: 'oxylabs',
  credentials: {
    apiKey: 'your-api-key'
  },
  authType: 'api_key'
});
```

#### Pricing

- **Residential**: $12.50/GB, $0.0015/request
- **ISP**: $15.00/GB, $0.002/request
- **Datacenter**: $1.50/GB, $0.0005/request

#### Features

- Automatic IP rotation per request
- Geolocation targeting
- Country-specific proxies
- Session management

### 2. Bright Data (Luminati)

**Tiers**: Residential, ISP, Mobile, Datacenter
**Regions**: US, EU, APAC, LATAM, MENA
**Key Feature**: Multiple proxy types with sticky sessions

#### Setup

```javascript
// Register credentials
await registerPartner({
  partnerId: 'brightdata',
  credentials: {
    apiKey: 'your-api-key'
  },
  authType: 'api_key'
});

// Configure sticky session
await setStickySession('session123', 3600); // 1 hour
```

#### Pricing

- **Residential**: $15.00/GB, $0.002/request
- **ISP**: $18.00/GB, $0.0025/request
- **Mobile**: $20.00/GB, $0.003/request
- **Datacenter**: $2.00/GB, $0.0008/request

#### Features

- Sticky sessions (per-request or per-session)
- ASN filtering (block/allow specific ISPs)
- Residential + ISP + Mobile options
- Session stickiness

### 3. Zyte (Crawlera)

**Tiers**: Smart, Rotating, ISP
**Regions**: US, EU, APAC
**Key Feature**: Browser rendering & JavaScript execution

#### Setup

```javascript
// Register credentials
await registerPartner({
  partnerId: 'zyte',
  credentials: {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret'
  },
  authType: 'oauth2'
});

// Configure rendering
await configureRendering('session123', {
  executeJavaScript: true,
  renderJs: true,
  adblockEnabled: true
});
```

#### Pricing

- **SmartProxy**: $0.0008/request
- **Rotating**: $0.0005/request
- **ISP**: $0.0012/request
- **Rendering**: +$0.0015/request

#### Features

- JavaScript execution
- Browser rendering
- Anti-bot detection bypass
- Custom headers

### 4. Apify

**Tiers**: Datacenter, Residential
**Regions**: US, EU
**Key Feature**: Browser pools for parallel browsing

#### Setup

```javascript
// Create browser pool
const pool = await createBrowserPool({
  name: 'scraping-pool',
  maxBrowsers: 10
});

// Get browser from pool
const browser = await getBrowserFromPool(pool.poolId);
```

#### Pricing

- **Datacenter**: $2.50/GB, $0.0003/request
- **Residential**: $10.00/GB, $0.0012/request
- **Rendering**: +$0.005/request

#### Features

- Browser pools
- Session stickiness
- Custom headers
- Parallel browsing

### 5. Luminati (IPRoyal)

**Tiers**: Residential
**Regions**: US, EU, APAC
**Key Feature**: Traffic shaping & rate limiting

#### Setup

```javascript
// Create zone
const zone = await createZone({
  name: 'my-zone',
  type: 'residential',
  bandwidth: 'unlimited'
});

// Set traffic shaping
await setTrafficShapingRule('session123', {
  maxRps: 100,        // Max requests per second
  maxBandwidth: 1000  // KB/s
});
```

#### Pricing

- **Residential**: $12.50/GB, $0.0018/request

#### Features

- Traffic shaping
- Rate limiting
- Zone management
- Current IP tracking

### 6. SmartProxy

**Tiers**: Residential, Rotating
**Regions**: US, EU
**Key Feature**: Affordable rotating proxies

#### Pricing

- **Residential**: $5.00-8.00/GB
- **Rotating**: $0.0012/request

### 7. Geonode

**Tiers**: Residential, Datacenter
**Regions**: US, EU, APAC
**Key Feature**: Geo-targeting

#### Pricing

- **Residential**: $8.00/GB
- **Datacenter**: $0.80/GB

### 8. Rainforest API

**Tiers**: Structured Data
**Regions**: US
**Key Feature**: API-based structured extraction

#### Pricing

- **Structured Data**: $0.0025/request

## Setup Instructions

### 1. Enable Partner

```bash
# WebSocket command
POST /proxy-partner-commands
{
  "command": "configure_partner",
  "params": {
    "partnerId": "oxylabs",
    "credentials": {
      "apiKey": "your-api-key"
    },
    "authType": "api_key"
  }
}
```

### 2. Test Connection

```bash
POST /proxy-partner-commands
{
  "command": "test_partner_proxy",
  "params": {
    "partnerId": "oxylabs",
    "country": "US"
  }
}
```

### 3. Configure Failover

```bash
POST /proxy-partner-commands
{
  "command": "failover_policy",
  "params": {
    "partnerId": "oxylabs",
    "failoverPartnerIds": ["brightdata", "zyte"]
  }
}
```

### 4. Set Optimization Mode

```bash
POST /proxy-partner-commands
{
  "command": "cost_optimization_mode",
  "params": {
    "mode": "balanced"  // cheapest, balanced, fastest
  }
}
```

## Authentication

### Supported Auth Types

#### API Key
- Used by: Oxylabs, Bright Data, Apify
- Storage: 15-minute token cache
- Rotation: Manual credential rotation supported

```javascript
registerCredentials('oxylabs', {
  apiKey: 'your-key'
}, 'api_key');
```

#### OAuth2
- Used by: Zyte
- Flow: Client ID + Secret exchange
- Expiration: Configurable per partner

```javascript
registerCredentials('zyte', {
  clientId: 'id',
  clientSecret: 'secret'
}, 'oauth2');
```

#### Basic Auth
- Used by: Generic partners
- Format: username:password base64 encoding
- Special Headers: Supported

```javascript
registerCredentials('partner', {
  username: 'user',
  password: 'pass',
  specialHeaders: {
    'X-Custom': 'value'
  }
}, 'basic_auth');
```

#### IP Whitelist
- Used by: Partners with IP-based auth
- Format: Client IP verification
- Note: Partner must have your IP whitelisted

```javascript
registerCredentials('partner', {
  clientIp: '192.168.1.1'
}, 'ip_whitelist');
```

### Token Management

```javascript
// Get credential status
const status = getCredentialsStatus('oxylabs');

// Rotate credentials
rotateCredentials('oxylabs', {
  apiKey: 'new-api-key'
});

// Clear token cache
clearTokenCache('oxylabs');
```

## Partner-Specific Features

### Oxylabs: Geolocation

```javascript
const proxy = await getProxy({
  partnerId: 'oxylabs',
  country: 'US',
  proxyType: 'residential'
});
```

### Bright Data: Sticky Sessions

```javascript
// Create sticky session
const proxy = await getProxy({
  partnerId: 'brightdata',
  sessionId: 'my-session',
  sticky: true
});

// All requests from this session use same IP
```

### Bright Data: ASN Filtering

```javascript
// Block specific ISPs
await setAsnFilter('session123', 'block', [
  'AS123',  // ISP 1
  'AS456'   // ISP 2
]);

// Or allow only specific ISPs
await setAsnFilter('session123', 'allow', [
  'AS789'
]);
```

### Zyte: JavaScript Execution

```javascript
await configureRendering('session123', {
  executeJavaScript: true,
  renderJs: true
});

await executeJavaScript('session123', `
  return document.querySelector('h1').textContent;
`);
```

### Apify: Browser Pools

```javascript
// Create pool
const pool = await createBrowserPool({
  maxBrowsers: 10,
  browserType: 'chromium'
});

// Get browser from pool
const browser = await getBrowserFromPool(pool.poolId);

// Use browser...

// Release browser
await releaseBrowser(pool.poolId, browser.browserId);
```

### Luminati: Traffic Shaping

```javascript
// Set rate limit: 100 requests/second
await setTrafficShapingRule('session123', {
  maxRps: 100
});

// Set bandwidth limit: 1MB/s
await setTrafficShapingRule('session123', {
  maxBandwidth: 1000  // KB/s
});
```

## Selection & Optimization

### Automatic Selection

```bash
POST /proxy-partner-commands
{
  "command": "select_best_partner",
  "params": {
    "region": "US",
    "proxyType": "residential",
    "preference": "balanced"
  }
}
```

### Selection Criteria

1. **Region Availability** (25% weight)
   - Does partner support target region?

2. **Cost Optimization** (20% weight)
   - Lowest cost per request

3. **Performance** (30% weight)
   - Lowest latency

4. **Reliability** (15% weight)
   - Highest success rate

5. **Concurrency** (10% weight)
   - Available capacity

### Preferences

```javascript
// Cheapest option
selectPartner({ preference: 'cost' });

// Fastest option
selectPartner({ preference: 'performance' });

// Balanced (default)
selectPartner({ preference: 'balanced' });
```

### Caching

- Selection decisions cached for 5 minutes
- Cache keyed by region + proxy type + preference
- Manual cache clear available

```javascript
// Clear selection cache
resetPartnerCache();
```

### Region Recommendations

```bash
POST /proxy-partner-commands
{
  "command": "get_recommendations",
  "params": {
    "region": "US"
  }
}

Response: [
  {
    rank: 1,
    partnerId: "oxylabs",
    successRate: 0.98,
    avgLatency: 50,
    costPerRequest: 0.0015,
    score: 0.85
  },
  ...
]
```

## Failover & Recovery

### Automatic Failover

When primary partner fails:

1. Detect failure (timeout, connection error)
2. Switch to first backup in chain
3. Retry request with backup
4. Log failure + metrics
5. Open circuit breaker if threshold exceeded

```javascript
// Execute with automatic failover
const result = await executeWithFailover('oxylabs', requestFn);

if (result.failoverUsed) {
  console.log(`Failover to: ${result.failoverPartnerId}`);
}
```

### Configure Failover Chain

```bash
POST /proxy-partner-commands
{
  "command": "failover_policy",
  "params": {
    "partnerId": "oxylabs",
    "failoverPartnerIds": [
      "brightdata",  // 1st backup
      "zyte",        // 2nd backup
      "apify"        // 3rd backup
    ]
  }
}
```

### Circuit Breaker

**Triggers**:
- 30% failure rate OR
- 5 consecutive failures

**Duration**: 60 seconds, then attempt recovery

**Recovery**: Health check performed periodically

```javascript
// Get circuit breaker status
const status = getRecoveryStatus('oxylabs');
// {
//   circuitBreakerOpen: true,
//   timeUntilRecovery: 45000,  // ms
//   recoveryAttempts: 1
// }

// Manual recovery
enablePartner('oxylabs');
```

### Failure Tracking

```javascript
// Get failure statistics
const stats = getPartnerFailureStatus('oxylabs');
// {
//   totalRequests: 1000,
//   failedRequests: 50,
//   failureRate: 0.05,
//   consecutiveFailures: 0
// }

// Reset tracking
resetPartnerTracking('oxylabs');
```

## Pricing

### Cost Analysis

View current pricing:

```bash
POST /proxy-partner-commands
{
  "command": "get_partner_pricing"
}
```

### Cost Optimization

**Cheapest Setup**:
- Oxylabs Datacenter: $0.0005/request
- Geonode Datacenter: $0.001/request

**Balanced Setup**:
- Oxylabs Residential: $0.0015/request
- Bright Data Residential: $0.002/request

**Premium Setup**:
- Bright Data Mobile: $0.003/request
- Zyte Browser Rendering: +$0.0015/request

### Cost Per Request

```javascript
const metrics = getPartnerMetrics('oxylabs');
// {
//   totalRequests: 10000,
//   totalCost: 15.00,
//   costPerRequest: 0.0015
// }
```

### Budget Optimization

```bash
POST /proxy-partner-commands
{
  "command": "cost_optimization_mode",
  "params": {
    "mode": "cheapest"  // Minimize cost
  }
}
```

## Monitoring & Reporting

### Partner Performance Report

```bash
POST /proxy-partner-commands
{
  "command": "partner_performance_report"
}

Response: {
  summary: {
    totalPartners: 8,
    enabledPartners: 5,
    healthyPartners: 5,
    metrics: {
      totalRequests: 50000,
      totalSuccessful: 49500,
      avgSuccessRate: 0.99,
      totalCost: 75.00
    }
  },
  selectionStats: {
    totalSelections: 500,
    partnerStats: [...]
  },
  failoverStats: {
    circuitBreakerOpen: 0,
    degradedPartners: 0,
    healthyPartners: 5
  }
}
```

### Health Checks

```bash
POST /proxy-partner-commands
{
  "command": "get_partner_status",
  "params": {
    "partnerId": "oxylabs"
  }
}

Response: {
  health: {
    status: "healthy",
    lastChecked: 1622548800000,
    responseTime: 45
  },
  metrics: {
    successRate: 0.98,
    avgLatency: 52,
    totalCost: 45.00
  }
}
```

## Troubleshooting

### Partner Not Responding

1. Check health status: `get_partner_status`
2. Verify credentials: `getCredentialsStatus`
3. Test connection: `test_partner_proxy`
4. Check rate limits: `getRateLimitStatus`

### High Failure Rate

1. Check partner health: `getAllHealthStatuses`
2. Review metrics: `getPartnerMetrics`
3. Check circuit breaker: `getRecoveryStatus`
4. Reset tracking: `resetPartnerTracking`

### Failover Not Working

1. Verify failover chain: `getFailoverChain`
2. Check backup partner health: `getPartnerStatus`
3. Review failure threshold: Config file
4. Check circuit breaker: `getFailoverStats`

## Best Practices

1. **Multi-Partner Setup**: Configure 3+ partners with failover
2. **Regional Selection**: Match partner regions to targets
3. **Cost Optimization**: Use cost-effective partners for simple requests
4. **Monitoring**: Review metrics weekly
5. **Credentials**: Rotate credentials monthly
6. **Failover**: Test failover behavior periodically
7. **Caching**: Clear cache when adding/removing partners
8. **Rate Limiting**: Configure per-partner limits

## API Reference

See [PROXY-PARTNERS-API.md](PROXY-PARTNERS-GUIDE.md) for complete API reference.

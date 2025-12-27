# Content Blocking Module Documentation

The Blocking module provides comprehensive ad and tracker blocking capabilities with EasyList format support, built-in filter categories, custom rules, and detailed statistics.

## Overview

The Blocking module consists of two main components:

- **BlockingManager** (`blocking/manager.js`): High-level API for content blocking, filter management, and statistics
- **Filters** (`blocking/filters.js`): Built-in filter lists, EasyList parser, and pattern utilities

## Features

- Built-in ad, tracker, social widget, and cryptominer blocking
- EasyList format filter list support (load from URL or local file)
- Custom blocking rules with wildcard patterns
- Domain whitelisting
- Per-category enable/disable
- Detailed blocking statistics
- Configuration export/import

---

## API Reference

### BlockingManager

#### Constructor

```javascript
const { BlockingManager } = require('./blocking/manager');

const blockingManager = new BlockingManager({
  dataPath: '/path/to/blocking-data'  // Storage directory
});
```

#### Core Methods

##### enableBlocking()

Enable content blocking with current configuration.

```javascript
const result = blockingManager.enableBlocking();

// Result:
// {
//   success: true,
//   blockPatterns: 1500,
//   allowPatterns: 50,
//   whitelistedDomains: 5,
//   enabledCategories: ['ads', 'trackers', 'cryptominers']
// }
```

##### disableBlocking()

Disable content blocking.

```javascript
const result = blockingManager.disableBlocking();

// Result:
// { success: true }
```

##### getStats()

Get current blocking statistics.

```javascript
const result = blockingManager.getStats();

// Result:
// {
//   success: true,
//   enabled: true,
//   sessionDurationSeconds: 3600,
//   totalRequests: 15000,
//   blockedRequests: 2500,
//   blockedPercentage: '16.67',
//   whitelistedRequests: 150,
//   blockedByCategory: {
//     ads: 1500,
//     trackers: 800,
//     social: 50,
//     cryptominers: 10,
//     custom: 40,
//     filterList: 100
//   },
//   activeBlockPatterns: 1500,
//   activeAllowPatterns: 50,
//   whitelistedDomains: 5,
//   customRules: 10,
//   loadedFilterLists: 2
// }
```

##### clearStats()

Reset blocking statistics.

```javascript
const result = blockingManager.clearStats();

// Result:
// {
//   success: true,
//   previousStats: { ... }
// }
```

#### Custom Rules

##### addBlockRule(pattern, options)

Add a custom blocking rule.

```javascript
const result = blockingManager.addBlockRule('*://ads.example.com/*', {
  description: 'Block example.com ads',
  enabled: true
});

// Result:
// {
//   success: true,
//   rule: {
//     id: 'custom_1703123456789_abc123',
//     pattern: '*://ads.example.com/*',
//     description: 'Block example.com ads',
//     enabled: true,
//     createdAt: '2024-12-21T10:30:00.000Z'
//   },
//   totalCustomRules: 11
// }
```

##### removeBlockRule(pattern)

Remove a custom blocking rule.

```javascript
const result = blockingManager.removeBlockRule('*://ads.example.com/*');

// Result:
// {
//   success: true,
//   totalCustomRules: 10
// }
```

##### getBlockRules()

Get all blocking rules and categories.

```javascript
const result = blockingManager.getBlockRules();

// Result:
// {
//   success: true,
//   builtinCategories: {
//     ads: { name: 'Advertisements', description: '...', patternCount: 200, enabled: true },
//     trackers: { name: 'Trackers', description: '...', patternCount: 280, enabled: true },
//     social: { name: 'Social Media Widgets', description: '...', patternCount: 80, enabled: false },
//     cryptominers: { name: 'Cryptocurrency Miners', description: '...', patternCount: 260, enabled: true }
//   },
//   enabledCategories: ['ads', 'trackers', 'cryptominers'],
//   customRules: [...],
//   loadedFilterLists: [...],
//   totalActivePatterns: 1500
// }
```

#### Categories

##### setCategory(category, enabled)

Enable or disable a built-in filter category.

```javascript
// Enable social widget blocking
const result = blockingManager.setCategory('social', true);

// Result:
// {
//   success: true,
//   category: 'social',
//   enabled: true,
//   enabledCategories: ['ads', 'trackers', 'cryptominers', 'social']
// }
```

##### getCategories()

Get available categories and their status.

```javascript
const result = blockingManager.getCategories();

// Result:
// {
//   success: true,
//   categories: {
//     ads: { name: 'Advertisements', description: '...', patternCount: 200, enabled: true },
//     ...
//   },
//   enabledCategories: ['ads', 'trackers', 'cryptominers']
// }
```

#### Filter Lists

##### loadFilterList(url)

Load a filter list from a URL (EasyList format).

```javascript
const result = await blockingManager.loadFilterList('https://easylist.to/easylist/easylist.txt');

// Result:
// {
//   success: true,
//   title: 'EasyList',
//   version: '202312210000',
//   homepage: 'https://easylist.to/',
//   blockPatterns: 45000,
//   allowPatterns: 5000,
//   elementHideRules: 30000,
//   errors: 10
// }
```

##### loadLocalFilterList(filePath)

Load a filter list from a local file.

```javascript
const result = await blockingManager.loadLocalFilterList('/path/to/custom-filters.txt');
```

##### clearFilterList(source)

Remove a loaded filter list.

```javascript
const result = blockingManager.clearFilterList('https://easylist.to/easylist/easylist.txt');

// Result:
// {
//   success: true,
//   source: 'https://easylist.to/easylist/easylist.txt',
//   removedPatterns: 50000
// }
```

##### clearAllFilterLists()

Remove all loaded filter lists.

```javascript
const result = blockingManager.clearAllFilterLists();

// Result:
// {
//   success: true,
//   clearedLists: 3
// }
```

##### getKnownFilterListUrls()

Get predefined filter list URLs.

```javascript
const result = blockingManager.getKnownFilterListUrls();

// Result:
// {
//   success: true,
//   filterLists: [
//     { name: 'easylist', url: 'https://easylist.to/easylist/easylist.txt' },
//     { name: 'easyprivacy', url: 'https://easylist.to/easylist/easyprivacy.txt' },
//     { name: 'easylistCookie', url: 'https://easylist-downloads.adblockplus.org/easylist-cookie.txt' },
//     { name: 'fanboySocial', url: 'https://easylist.to/easylist/fanboy-social.txt' },
//     ...
//   ]
// }
```

#### Whitelist

##### whitelistDomain(domain)

Add a domain to the whitelist.

```javascript
const result = blockingManager.whitelistDomain('example.com');

// Result:
// {
//   success: true,
//   domain: 'example.com',
//   totalWhitelisted: 6
// }
```

##### removeWhitelist(domain)

Remove a domain from the whitelist.

```javascript
const result = blockingManager.removeWhitelist('example.com');

// Result:
// {
//   success: true,
//   domain: 'example.com',
//   totalWhitelisted: 5
// }
```

##### getWhitelist()

Get all whitelisted domains.

```javascript
const result = blockingManager.getWhitelist();

// Result:
// {
//   success: true,
//   domains: ['example.com', 'trusted-site.org', ...],
//   count: 5
// }
```

#### Configuration

##### exportConfig()

Export blocking configuration.

```javascript
const result = blockingManager.exportConfig();

// Result:
// {
//   success: true,
//   config: {
//     enabledCategories: ['ads', 'trackers', 'cryptominers'],
//     customRules: [...],
//     whitelistedDomains: ['example.com', ...],
//     loadedFilterListUrls: ['https://easylist.to/easylist/easylist.txt', ...]
//   }
// }
```

##### importConfig(config)

Import blocking configuration.

```javascript
const result = await blockingManager.importConfig({
  enabledCategories: ['ads', 'trackers'],
  customRules: [...],
  whitelistedDomains: ['trusted.com'],
  loadedFilterListUrls: ['https://easylist.to/easylist/easylist.txt']
});

// Result:
// {
//   success: true,
//   enabledCategories: ['ads', 'trackers'],
//   customRules: 5,
//   whitelistedDomains: 1,
//   loadedFilterLists: 1
// }
```

##### cleanup()

Release resources and disable blocking.

```javascript
blockingManager.cleanup();
```

---

### Filters Module

#### Built-in Filter Categories

```javascript
const { BUILTIN_FILTERS, getFilterListInfo, getBuiltinPatterns } = require('./blocking/filters');

// Get info about all categories
const info = getFilterListInfo();
// Returns: { ads: {...}, trackers: {...}, social: {...}, cryptominers: {...} }

// Get patterns for specific categories
const patterns = getBuiltinPatterns(['ads', 'trackers']);
// Returns: { blockPatterns: [...], allowPatterns: [] }
```

#### EasyList Parser

```javascript
const { parseEasyList } = require('./blocking/filters');

const content = fs.readFileSync('easylist.txt', 'utf-8');
const parsed = parseEasyList(content);

// Returns:
// {
//   title: 'EasyList',
//   homepage: 'https://easylist.to/',
//   version: '202312210000',
//   lastModified: '21 Dec 2024 00:00 UTC',
//   blockPatterns: [...],
//   allowPatterns: [...],
//   elementHideRules: [...],
//   errors: [...]
// }
```

#### Known EasyList URLs

```javascript
const { EASYLIST_URLS } = require('./blocking/filters');

// Available lists:
// - easylist: Main EasyList
// - easyprivacy: EasyPrivacy (trackers)
// - easylistCookie: Cookie consent popups
// - fanboySocial: Social media widgets
// - fanboyAnnoyance: Annoyances
// - antiadblock: Anti-adblock countermeasures
// - uBlockAnnoyances: uBlock Origin annoyances
// - peterlowe: Peter Lowe's blocklist
```

---

## WebSocket Command Examples

### Enable Blocking

```json
{
  "command": "blocking.enable"
}
```

### Disable Blocking

```json
{
  "command": "blocking.disable"
}
```

### Get Statistics

```json
{
  "command": "blocking.stats"
}
```

### Clear Statistics

```json
{
  "command": "blocking.clearStats"
}
```

### Add Custom Rule

```json
{
  "command": "blocking.addRule",
  "params": {
    "pattern": "*://ads.example.com/*",
    "description": "Block example.com ads"
  }
}
```

### Remove Custom Rule

```json
{
  "command": "blocking.removeRule",
  "params": {
    "pattern": "*://ads.example.com/*"
  }
}
```

### Get All Rules

```json
{
  "command": "blocking.getRules"
}
```

### Enable Category

```json
{
  "command": "blocking.setCategory",
  "params": {
    "category": "social",
    "enabled": true
  }
}
```

### Get Categories

```json
{
  "command": "blocking.getCategories"
}
```

### Load Filter List

```json
{
  "command": "blocking.loadFilterList",
  "params": {
    "url": "easylist"
  }
}
```

### Load Local Filter List

```json
{
  "command": "blocking.loadLocalFilterList",
  "params": {
    "filePath": "/path/to/filters.txt"
  }
}
```

### Clear Filter List

```json
{
  "command": "blocking.clearFilterList",
  "params": {
    "source": "https://easylist.to/easylist/easylist.txt"
  }
}
```

### Get Known Filter Lists

```json
{
  "command": "blocking.getKnownFilterLists"
}
```

### Whitelist Domain

```json
{
  "command": "blocking.whitelistDomain",
  "params": {
    "domain": "example.com"
  }
}
```

### Remove from Whitelist

```json
{
  "command": "blocking.removeWhitelist",
  "params": {
    "domain": "example.com"
  }
}
```

### Get Whitelist

```json
{
  "command": "blocking.getWhitelist"
}
```

### Export Configuration

```json
{
  "command": "blocking.exportConfig"
}
```

### Import Configuration

```json
{
  "command": "blocking.importConfig",
  "params": {
    "config": {
      "enabledCategories": ["ads", "trackers"],
      "customRules": [],
      "whitelistedDomains": []
    }
  }
}
```

---

## Code Examples

### Basic Usage

```javascript
const { BlockingManager } = require('./blocking/manager');

// Initialize
const blockingManager = new BlockingManager({
  dataPath: './blocking-data'
});

// Enable blocking
blockingManager.enableBlocking();

// Add custom rules
blockingManager.addBlockRule('*://annoying-popups.com/*');
blockingManager.addBlockRule('*://*/popup*.js');

// Whitelist trusted site
blockingManager.whitelistDomain('trusted-site.com');

// Check stats
const stats = blockingManager.getStats();
console.log(`Blocked ${stats.blockedRequests} of ${stats.totalRequests} requests`);
```

### Loading EasyList

```javascript
// Load main EasyList
await blockingManager.loadFilterList('easylist');

// Load EasyPrivacy for tracker blocking
await blockingManager.loadFilterList('easyprivacy');

// Load from custom URL
await blockingManager.loadFilterList('https://example.com/custom-filters.txt');

// Load local file
await blockingManager.loadLocalFilterList('./my-filters.txt');
```

### Category Management

```javascript
// Get current categories
const categories = blockingManager.getCategories();
console.log('Enabled:', categories.enabledCategories);

// Enable social widget blocking
blockingManager.setCategory('social', true);

// Disable tracker blocking temporarily
blockingManager.setCategory('trackers', false);

// Re-enable
blockingManager.setCategory('trackers', true);
```

### Configuration Backup

```javascript
// Export configuration
const config = blockingManager.exportConfig();
fs.writeFileSync('blocking-config.json', JSON.stringify(config.config, null, 2));

// Import configuration
const savedConfig = JSON.parse(fs.readFileSync('blocking-config.json', 'utf-8'));
await blockingManager.importConfig(savedConfig);
```

---

## Configuration Options

### Built-in Categories

| Category | Description | Default |
|----------|-------------|---------|
| `ads` | Advertising networks and ad servers | Enabled |
| `trackers` | Analytics and tracking services | Enabled |
| `social` | Social media widgets and sharing buttons | Disabled |
| `cryptominers` | Browser-based cryptocurrency miners | Enabled |

### Pattern Syntax

Custom rules support wildcard patterns:

| Pattern | Matches |
|---------|---------|
| `*` | Any characters |
| `*://` | Any protocol (http, https) |
| `*://example.com/*` | All requests to example.com |
| `*://*/ads/*` | Any URL with /ads/ path |
| `*://ads.*.com/*` | Subdomains like ads.example.com |

### EasyList Syntax Support

The parser supports common EasyList syntax:

| Syntax | Description |
|--------|-------------|
| `||example.com^` | Domain anchor (blocks example.com and subdomains) |
| `|https://` | Start anchor |
| `^` | Separator (end of domain, path separator, etc.) |
| `@@` | Exception rule (allow) |
| `##` | Element hiding selector |
| `$option` | Rule options (type, domain, etc.) |

---

## Statistics Breakdown

### blockedByCategory

| Category | Description |
|----------|-------------|
| `ads` | Requests blocked by ad filter patterns |
| `trackers` | Requests blocked by tracker patterns |
| `social` | Requests blocked by social widget patterns |
| `cryptominers` | Requests blocked by cryptominer patterns |
| `custom` | Requests blocked by custom rules |
| `filterList` | Requests blocked by loaded filter lists |

### Request Flow

1. Request URL is received
2. Check if domain is whitelisted (skip if yes)
3. Check allow patterns (exception rules)
4. Check block patterns from:
   - Built-in categories
   - Custom rules
   - Loaded filter lists
5. Block or allow based on match
6. Update statistics

---

## Blocked Domain Lists

### Ad Networks (Sample)

- googleads.g.doubleclick.net
- pagead2.googlesyndication.com
- adservice.google.com
- aax.amazon-adsystem.com
- ads.facebook.com
- adnxs.com
- criteo.com
- taboola.com
- outbrain.com

### Trackers (Sample)

- google-analytics.com
- connect.facebook.net
- clarity.ms
- hotjar.com
- mixpanel.com
- segment.io
- amplitude.com
- fullstory.com

### Cryptominers (Sample)

- coinhive.com
- coin-hive.com
- cryptoloot.pro
- jsecoin.com
- webminepool.com

See `blocking/filters.js` for complete lists.

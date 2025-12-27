# Content Blocking

The Basset Hound Browser includes a comprehensive content blocking system for blocking ads, trackers, social media widgets, and cryptocurrency miners.

## Features

- **Built-in Filter Lists**: Pre-configured lists for common ad networks, trackers, social widgets, and crypto miners
- **EasyList Support**: Load and parse EasyList format filter lists from URLs or local files
- **Custom Rules**: Add your own blocking patterns
- **Domain Whitelist**: Bypass blocking for specific domains
- **Statistics**: Track blocked requests with detailed category breakdown
- **Categories**: Enable/disable different blocking categories independently

## Built-in Categories

### Advertisements (`ads`)
Blocks common advertising networks including:
- Google Ads (googleads, doubleclick, googlesyndication)
- Amazon Ads
- Facebook Ads
- Twitter/X Ads
- Microsoft/Bing Ads
- Generic ad networks (criteo, taboola, outbrain, etc.)

### Trackers (`trackers`)
Blocks analytics and tracking services including:
- Google Analytics
- Facebook Pixel
- Microsoft Clarity
- Hotjar
- Mixpanel, Segment, Amplitude
- Fullstory, Mouseflow, CrazyEgg
- And many more

### Social Media Widgets (`social`)
Blocks social sharing buttons and embedded content:
- Twitter/X widgets
- Facebook widgets and plugins
- LinkedIn widgets
- Pinterest widgets
- Disqus comments
- AddThis, ShareThis

### Cryptocurrency Miners (`cryptominers`)
Blocks browser-based cryptocurrency mining scripts:
- Coinhive and derivatives
- CryptoLoot
- JSEcoin
- And many other mining scripts

## WebSocket API

### Enable/Disable Blocking

```javascript
// Enable blocking
{ "command": "enable_blocking" }

// Disable blocking
{ "command": "disable_blocking" }
```

### Custom Rules

```javascript
// Add a block rule
{
  "command": "add_block_rule",
  "pattern": "*://example.com/ads/*",
  "description": "Block example.com ads"
}

// Remove a block rule
{
  "command": "remove_block_rule",
  "pattern": "*://example.com/ads/*"
}

// Get all block rules
{ "command": "get_block_rules" }
```

### Filter Lists

```javascript
// Load filter list from URL (EasyList format)
{
  "command": "load_filter_list",
  "url": "https://easylist.to/easylist/easylist.txt"
}

// Or use a known filter list name
{
  "command": "load_filter_list",
  "url": "easylist"  // Will resolve to the actual URL
}
```

**Known Filter Lists:**
- `easylist` - Main EasyList
- `easyprivacy` - EasyPrivacy (trackers)
- `easylistCookie` - Cookie notices
- `fanboySocial` - Social media blocking
- `fanboyAnnoyance` - Annoyances
- `antiadblock` - Anti-adblock circumvention
- `peterlowe` - Peter Lowe's ad server list

### Statistics

```javascript
// Get blocking statistics
{ "command": "get_blocking_stats" }

// Response includes:
{
  "success": true,
  "enabled": true,
  "sessionDurationSeconds": 3600,
  "totalRequests": 1000,
  "blockedRequests": 150,
  "blockedPercentage": "15.00",
  "blockedByCategory": {
    "ads": 100,
    "trackers": 40,
    "social": 5,
    "cryptominers": 0,
    "custom": 5,
    "filterList": 0
  },
  "whitelistedRequests": 10,
  "activeBlockPatterns": 500,
  "whitelistedDomains": 2
}

// Clear statistics
{ "command": "clear_blocking_stats" }
```

### Whitelist

```javascript
// Whitelist a domain
{
  "command": "whitelist_domain",
  "domain": "example.com"
}

// Remove from whitelist
{
  "command": "remove_whitelist",
  "domain": "example.com"
}

// Get whitelist
{ "command": "get_whitelist" }
```

### Categories

```javascript
// Enable/disable a category
{
  "command": "set_blocking_category",
  "category": "social",
  "enabled": true
}

// Get available categories
{ "command": "get_blocking_categories" }
```

## JavaScript API (Preload)

The blocking API is exposed via `window.electronAPI`:

```javascript
// Enable/disable blocking
await window.electronAPI.enableBlocking();
await window.electronAPI.disableBlocking();

// Custom rules
await window.electronAPI.addBlockRule('*://ads.example.com/*', {
  description: 'Block example ads'
});
await window.electronAPI.removeBlockRule('*://ads.example.com/*');
await window.electronAPI.getBlockRules();

// Filter lists
await window.electronAPI.loadFilterList('https://easylist.to/easylist/easylist.txt');
await window.electronAPI.loadLocalFilterList('/path/to/filters.txt');
await window.electronAPI.getKnownFilterLists();

// Statistics
const stats = await window.electronAPI.getBlockingStats();
await window.electronAPI.clearBlockingStats();

// Whitelist
await window.electronAPI.whitelistDomain('example.com');
await window.electronAPI.removeWhitelist('example.com');
await window.electronAPI.getWhitelist();

// Categories
await window.electronAPI.setBlockingCategory('social', true);
await window.electronAPI.getBlockingCategories();
```

## Pattern Syntax

Block patterns use a simple wildcard syntax:

- `*` matches any sequence of characters
- Patterns are matched against the full URL

**Examples:**

```
*://ads.example.com/*           # Block all URLs on ads.example.com
*://example.com/ads/*           # Block /ads/ path on example.com
*://*.doubleclick.net/*         # Block all doubleclick subdomains
*://*/advertisement/*           # Block /advertisement/ path on any domain
```

## EasyList Format Support

The blocking manager supports basic EasyList format parsing:

- Standard blocking rules
- Exception rules (starting with `@@`)
- Domain anchors (`||`)
- Element hiding rules (stored but not applied - for future use)

**Limitations:**
- Advanced filter options (`$domain`, `$third-party`, etc.) are partially supported
- Element hiding is parsed but not currently applied
- Some complex patterns may not be fully compatible

## Best Practices

1. **Start with built-in categories**: Enable `ads`, `trackers`, and `cryptominers` for comprehensive protection without breaking sites.

2. **Be careful with social blocking**: The `social` category can break social login and sharing features. Consider using it only when needed.

3. **Use whitelists sparingly**: If a site breaks, whitelist only that specific domain rather than disabling all blocking.

4. **Monitor statistics**: Check `get_blocking_stats` periodically to see blocking effectiveness.

5. **Load EasyList for comprehensive blocking**: The built-in lists cover common domains, but EasyList provides more comprehensive coverage.

## Example: Full Setup

```javascript
// WebSocket example for comprehensive ad/tracker blocking

// 1. Enable blocking
ws.send(JSON.stringify({ id: 1, command: 'enable_blocking' }));

// 2. Load EasyList for comprehensive ad blocking
ws.send(JSON.stringify({
  id: 2,
  command: 'load_filter_list',
  url: 'easylist'
}));

// 3. Load EasyPrivacy for tracker blocking
ws.send(JSON.stringify({
  id: 3,
  command: 'load_filter_list',
  url: 'easyprivacy'
}));

// 4. Whitelist a specific site if needed
ws.send(JSON.stringify({
  id: 4,
  command: 'whitelist_domain',
  domain: 'trusted-site.com'
}));

// 5. Check statistics
ws.send(JSON.stringify({ id: 5, command: 'get_blocking_stats' }));
```

## Troubleshooting

### Site Not Loading Correctly
1. Try whitelisting the domain: `whitelist_domain`
2. Check if social widgets are needed: Enable `social` category
3. Review blocked requests in statistics

### Too Many Requests Blocked
1. Review custom rules for overly broad patterns
2. Consider using more specific patterns
3. Check if filter lists have conflicts

### Performance Issues
1. Limit the number of loaded filter lists
2. Use built-in categories instead of full EasyList if sufficient
3. Clear statistics periodically with `clear_blocking_stats`

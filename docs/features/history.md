# History Module Documentation

The History module provides comprehensive browsing history tracking with automatic navigation recording, visit duration calculation, and powerful query capabilities.

## Overview

The History module consists of two main components:

- **HistoryManager** (`history/manager.js`): High-level API for history operations, event tracking, and lifecycle management
- **HistoryStorage** (`history/storage.js`): Persistent storage layer with JSON file storage and efficient indexing

## Features

- Automatic navigation tracking with visit duration calculation
- URL and title search capabilities
- Time-range based queries
- Session and tab filtering
- Most visited URLs analytics
- Export/Import in JSON and CSV formats
- Configurable maximum entries limit
- Event callbacks for history changes

---

## API Reference

### HistoryManager

#### Constructor

```javascript
const { HistoryManager } = require('./history/manager');

const historyManager = new HistoryManager({
  dataPath: '/path/to/history-data',  // Storage directory
  maxEntries: 10000,                   // Maximum history entries (default: 10000)
  autoTrack: true,                     // Enable automatic tracking (default: true)
  onEntryAdded: (entry) => {},         // Callback when entry is added
  onEntryDeleted: (id) => {},          // Callback when entry is deleted
  onHistoryCleared: () => {}           // Callback when history is cleared
});
```

#### Methods

##### addEntry(url, title, referrer, options)

Add a new history entry manually.

```javascript
const result = historyManager.addEntry(
  'https://example.com',
  'Example Page',
  'https://google.com',
  {
    tabId: 'tab-123',
    sessionId: 'session-456',
    transitionType: 'link',  // 'link', 'typed', 'reload', etc.
    favicon: 'https://example.com/favicon.ico'
  }
);

// Result:
// {
//   success: true,
//   entry: {
//     id: '1703123456789-abc123def',
//     url: 'https://example.com',
//     title: 'Example Page',
//     visitTime: '2024-12-21T10:30:00.000Z',
//     visitDuration: null,
//     referrer: 'https://google.com',
//     favicon: 'https://example.com/favicon.ico',
//     tabId: 'tab-123',
//     sessionId: 'session-456',
//     transitionType: 'link'
//   }
// }
```

##### getHistory(options)

Retrieve history with filters and pagination.

```javascript
const result = historyManager.getHistory({
  limit: 100,           // Number of entries to return
  offset: 0,            // Pagination offset
  startTime: Date.now() - 86400000,  // Start time (24 hours ago)
  endTime: Date.now(),  // End time
  search: 'example',    // Search in URL and title
  sessionId: 'session-456',  // Filter by session
  tabId: 'tab-123'      // Filter by tab
});

// Result:
// {
//   success: true,
//   total: 150,
//   limit: 100,
//   offset: 0,
//   entries: [...]
// }
```

##### searchHistory(query, options)

Search history by URL or title.

```javascript
const result = historyManager.searchHistory('github', { limit: 50 });

// Result:
// {
//   success: true,
//   query: 'github',
//   total: 25,
//   entries: [...]
// }
```

##### getEntry(id)

Get a specific entry by ID.

```javascript
const result = historyManager.getEntry('1703123456789-abc123def');

// Result:
// {
//   success: true,
//   entry: { ... }
// }
```

##### deleteEntry(id)

Delete a specific entry.

```javascript
const result = historyManager.deleteEntry('1703123456789-abc123def');

// Result:
// {
//   success: true,
//   id: '1703123456789-abc123def'
// }
```

##### deleteRange(startTime, endTime)

Delete entries within a time range.

```javascript
const result = historyManager.deleteRange(
  Date.now() - 3600000,  // 1 hour ago
  Date.now()
);

// Result:
// {
//   success: true,
//   deletedCount: 15
// }
```

##### clearHistory()

Clear all history entries.

```javascript
const result = historyManager.clearHistory();

// Result:
// {
//   success: true,
//   deletedCount: 1500
// }
```

##### getVisitCount(url)

Get the number of times a URL has been visited.

```javascript
const result = historyManager.getVisitCount('https://example.com');

// Result:
// {
//   success: true,
//   url: 'https://example.com',
//   visitCount: 42
// }
```

##### getMostVisited(limit)

Get the most visited URLs.

```javascript
const result = historyManager.getMostVisited(10);

// Result:
// {
//   success: true,
//   total: 10,
//   entries: [
//     { url: 'https://example.com', count: 42, lastVisit: '2024-12-21T10:30:00.000Z' },
//     ...
//   ]
// }
```

##### exportHistory(format)

Export history in JSON or CSV format.

```javascript
// Export as JSON
const jsonResult = historyManager.exportHistory('json');
// Result:
// {
//   success: true,
//   format: 'json',
//   mimeType: 'application/json',
//   data: { version: '1.0', exportedAt: '...', totalEntries: 1500, entries: [...] }
// }

// Export as CSV
const csvResult = historyManager.exportHistory('csv');
// Result:
// {
//   success: true,
//   format: 'csv',
//   mimeType: 'text/csv',
//   data: 'id,url,title,visitTime,visitDuration,referrer\n...'
// }
```

##### importHistory(data, options)

Import history from JSON data.

```javascript
const result = historyManager.importHistory(
  { entries: [...] },
  { overwrite: false }  // Set to true to replace existing history
);

// Result:
// {
//   success: true,
//   importedCount: 150
// }
```

##### getStats()

Get history statistics.

```javascript
const result = historyManager.getStats();

// Result:
// {
//   success: true,
//   stats: {
//     totalEntries: 1500,
//     uniqueUrls: 750,
//     activePages: 3
//   }
// }
```

##### updateEntryTitle(entryId, title)

Update the title of an existing entry.

```javascript
const result = historyManager.updateEntryTitle('1703123456789-abc123def', 'New Title');
```

#### Event Handlers

##### onNavigationStart(details)

Handle navigation start events for automatic tracking.

```javascript
historyManager.onNavigationStart({
  url: 'https://example.com',
  tabId: 'tab-123',
  referrer: 'https://google.com',
  transitionType: 'link'
});
```

##### onPageLoadComplete(details)

Handle page load complete events to update title and favicon.

```javascript
historyManager.onPageLoadComplete({
  tabId: 'tab-123',
  title: 'Example Page',
  favicon: 'https://example.com/favicon.ico'
});
```

##### onTabClosed(tabId)

Handle tab close events to finalize visit duration.

```javascript
historyManager.onTabClosed('tab-123');
```

##### cleanup()

Clean up resources and save pending data.

```javascript
historyManager.cleanup();
```

---

### HistoryStorage

Low-level storage class with indexing for efficient queries.

#### Constructor

```javascript
const HistoryStorage = require('./history/storage');

const storage = new HistoryStorage('/path/to/history-data');
```

#### Methods

| Method | Description |
|--------|-------------|
| `addEntry(entry)` | Add an entry to storage |
| `getEntry(id)` | Get entry by ID |
| `getEntriesByUrl(url)` | Get all entries for a URL |
| `getEntriesByTimeRange(start, end)` | Get entries in time range |
| `getAllEntries(options)` | Get all entries with pagination |
| `search(query, options)` | Search by URL or title |
| `deleteEntry(id)` | Delete entry by ID |
| `deleteRange(start, end)` | Delete entries in time range |
| `clear()` | Clear all entries |
| `getVisitCount(url)` | Get visit count for URL |
| `getMostVisited(limit)` | Get most visited URLs |
| `getCount()` | Get total entry count |
| `getUniqueUrlCount()` | Get unique URL count |
| `exportAsJSON()` | Export as JSON object |
| `exportAsCSV()` | Export as CSV string |
| `import(entries, options)` | Import entries |
| `save(force)` | Save to disk (debounced) |
| `cleanup()` | Save and cleanup |

---

## WebSocket Command Examples

### Get History

```json
{
  "command": "history.get",
  "params": {
    "limit": 100,
    "offset": 0,
    "search": "github",
    "startTime": 1703116800000,
    "endTime": 1703203200000
  }
}
```

### Search History

```json
{
  "command": "history.search",
  "params": {
    "query": "documentation",
    "limit": 50
  }
}
```

### Add Entry

```json
{
  "command": "history.add",
  "params": {
    "url": "https://example.com",
    "title": "Example Page",
    "referrer": "https://google.com"
  }
}
```

### Delete Entry

```json
{
  "command": "history.delete",
  "params": {
    "id": "1703123456789-abc123def"
  }
}
```

### Delete Range

```json
{
  "command": "history.deleteRange",
  "params": {
    "startTime": 1703116800000,
    "endTime": 1703203200000
  }
}
```

### Clear History

```json
{
  "command": "history.clear"
}
```

### Get Statistics

```json
{
  "command": "history.stats"
}
```

### Get Most Visited

```json
{
  "command": "history.mostVisited",
  "params": {
    "limit": 10
  }
}
```

### Get Visit Count

```json
{
  "command": "history.visitCount",
  "params": {
    "url": "https://example.com"
  }
}
```

### Export History

```json
{
  "command": "history.export",
  "params": {
    "format": "json"
  }
}
```

### Import History

```json
{
  "command": "history.import",
  "params": {
    "data": {
      "entries": [...]
    },
    "overwrite": false
  }
}
```

---

## Code Examples

### Basic Usage

```javascript
const { HistoryManager } = require('./history/manager');

// Initialize
const historyManager = new HistoryManager({
  dataPath: './history-data',
  maxEntries: 5000
});

// Add entry
historyManager.addEntry(
  'https://example.com',
  'Example Page',
  null,
  { tabId: 'tab-1' }
);

// Search
const results = historyManager.searchHistory('example');
console.log(`Found ${results.total} results`);

// Get most visited
const mostVisited = historyManager.getMostVisited(5);
mostVisited.entries.forEach(entry => {
  console.log(`${entry.url}: ${entry.count} visits`);
});

// Export
const exported = historyManager.exportHistory('json');
fs.writeFileSync('history-backup.json', JSON.stringify(exported.data));
```

### Automatic Tracking Integration

```javascript
// Integration with browser navigation events
webview.addEventListener('did-start-navigation', (event) => {
  historyManager.onNavigationStart({
    url: event.url,
    tabId: tabId,
    referrer: event.referrer,
    transitionType: event.isMainFrame ? 'link' : 'subframe'
  });
});

webview.addEventListener('did-finish-load', () => {
  historyManager.onPageLoadComplete({
    tabId: tabId,
    title: webview.getTitle(),
    favicon: null
  });
});

// Handle tab close
function closeTab(tabId) {
  historyManager.onTabClosed(tabId);
  // ... close tab logic
}
```

### Query and Analysis

```javascript
// Get history for the last 24 hours
const recentHistory = historyManager.getHistory({
  startTime: Date.now() - 86400000,
  endTime: Date.now(),
  limit: 500
});

// Filter by session
const sessionHistory = historyManager.getHistory({
  sessionId: 'my-session-id'
});

// Get statistics
const stats = historyManager.getStats();
console.log(`Total entries: ${stats.stats.totalEntries}`);
console.log(`Unique URLs: ${stats.stats.uniqueUrls}`);
```

---

## Configuration Options

### HistoryManager Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dataPath` | string | `./history-data` | Storage directory path |
| `maxEntries` | number | `10000` | Maximum number of entries to keep |
| `autoTrack` | boolean | `true` | Enable automatic navigation tracking |
| `onEntryAdded` | function | `null` | Callback when entry is added |
| `onEntryDeleted` | function | `null` | Callback when entry is deleted |
| `onHistoryCleared` | function | `null` | Callback when history is cleared |

### HistoryEntry Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique entry identifier |
| `url` | string | Page URL |
| `title` | string | Page title |
| `visitTime` | string | ISO timestamp of visit |
| `visitDuration` | number | Duration in milliseconds (null if still active) |
| `referrer` | string | Referrer URL |
| `favicon` | string | Favicon URL |
| `tabId` | string | Tab identifier |
| `sessionId` | string | Session identifier |
| `transitionType` | string | Navigation type (link, typed, reload, etc.) |

### URLs Automatically Skipped

The following URL patterns are automatically excluded from history:

- `about:*`
- `chrome:*`
- `chrome-extension:*`
- `file://*`
- `data:*`
- `javascript:*`
- `blob:*`

---

## Storage Format

### history.json

```json
{
  "version": "1.0",
  "lastModified": "2024-12-21T10:30:00.000Z",
  "entries": [
    {
      "id": "1703123456789-abc123def",
      "url": "https://example.com",
      "title": "Example Page",
      "visitTime": "2024-12-21T10:30:00.000Z",
      "visitDuration": 45000,
      "referrer": "https://google.com",
      "favicon": null,
      "tabId": "tab-123",
      "sessionId": "session-456",
      "transitionType": "link"
    }
  ]
}
```

### Indexing

The storage maintains two indexes for efficient queries:

1. **URL Index**: Maps normalized URLs to entry IDs for fast URL-based lookups
2. **Timestamp Index**: Sorted array of timestamps and IDs for time-range queries

Data is automatically saved with debouncing (1 second delay) to prevent excessive disk writes.

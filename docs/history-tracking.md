# History Tracking System

The Basset Hound Browser includes a comprehensive history tracking system that automatically records page navigations and provides powerful query capabilities.

## Architecture

The history tracking system consists of three main components:

1. **HistoryStorage** (`/history/storage.js`) - Persistent JSON file storage with indexing
2. **HistoryManager** (`/history/manager.js`) - High-level API for history operations
3. **IPC/WebSocket Integration** - External access via Electron IPC and WebSocket

## Features

- Automatic tracking of all page navigations
- Visit duration calculation
- URL and title indexing for fast queries
- Time-based filtering
- Full-text search
- Visit count statistics
- Most visited URLs tracking
- Import/Export in JSON and CSV formats

## HistoryEntry Structure

Each history entry contains the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier for the entry |
| `url` | string | The page URL |
| `title` | string | Page title (may be empty initially, updated on page load) |
| `visitTime` | string | ISO 8601 timestamp of when the page was visited |
| `visitDuration` | number | Time spent on page in milliseconds (calculated when navigating away) |
| `referrer` | string | URL of the referring page |
| `favicon` | string | Favicon URL (if available) |
| `tabId` | string | ID of the tab where navigation occurred |
| `sessionId` | string | Session ID (if using sessions) |
| `transitionType` | string | Navigation type: 'link', 'typed', 'reload', etc. |

## API Reference

### Renderer Process (via electronAPI)

#### Get History
```javascript
// Get history with options
const result = await electronAPI.getHistory({
  limit: 100,        // Maximum entries to return
  offset: 0,         // Skip first N entries
  startTime: Date,   // Filter by start time
  endTime: Date,     // Filter by end time
  search: 'query'    // Search in URL/title
});
// Returns: { success: true, total: N, entries: [...] }
```

#### Search History
```javascript
const result = await electronAPI.searchHistory('google', 50);
// Returns: { success: true, query: 'google', total: N, entries: [...] }
```

#### Get Specific Entry
```javascript
const result = await electronAPI.getHistoryEntry('entry-id');
// Returns: { success: true, entry: {...} }
```

#### Delete Entry
```javascript
const result = await electronAPI.deleteHistoryEntry('entry-id');
// Returns: { success: true, id: 'entry-id' }
```

#### Delete Time Range
```javascript
const result = await electronAPI.deleteHistoryRange(
  new Date('2024-01-01'),
  new Date('2024-01-31')
);
// Returns: { success: true, deletedCount: N }
```

#### Clear All History
```javascript
const result = await electronAPI.clearHistory();
// Returns: { success: true, deletedCount: N }
```

#### Get Visit Count
```javascript
const result = await electronAPI.getVisitCount('https://example.com');
// Returns: { success: true, url: 'https://...', visitCount: N }
```

#### Get Most Visited
```javascript
const result = await electronAPI.getMostVisited(10);
// Returns: { success: true, total: N, entries: [{ url, count, lastVisit }] }
```

#### Export History
```javascript
// Export as JSON
const jsonResult = await electronAPI.exportHistory('json');
// Returns: { success: true, format: 'json', mimeType: '...', data: {...} }

// Export as CSV
const csvResult = await electronAPI.exportHistory('csv');
// Returns: { success: true, format: 'csv', mimeType: '...', data: 'csv-string' }
```

#### Import History
```javascript
const result = await electronAPI.importHistory(historyData, { overwrite: false });
// Returns: { success: true, importedCount: N }
```

#### Get Statistics
```javascript
const result = await electronAPI.getHistoryStats();
// Returns: { success: true, stats: { totalEntries, uniqueUrls, activePages } }
```

#### Manual Entry (for custom tracking)
```javascript
// Add entry manually
electronAPI.addToHistory({
  url: 'https://example.com',
  title: 'Example Page',
  referrer: 'https://google.com',
  tabId: 'tab-123',
  transitionType: 'link'
});

// Notify page load complete (updates title)
electronAPI.notifyPageLoadComplete({
  tabId: 'tab-123',
  title: 'Updated Page Title',
  favicon: 'https://example.com/favicon.ico'
});
```

#### Event Listeners
```javascript
// Listen for new history entries
electronAPI.onHistoryEntryAdded((entry) => {
  console.log('New history entry:', entry);
});

// Listen for history cleared
electronAPI.onHistoryCleared(() => {
  console.log('History was cleared');
});
```

### WebSocket API

Connect to the browser's WebSocket server (default port 8765) and send JSON commands:

#### get_history
```json
{
  "command": "get_history",
  "id": "unique-request-id",
  "limit": 100,
  "offset": 0,
  "startTime": "2024-01-01T00:00:00Z",
  "endTime": "2024-12-31T23:59:59Z",
  "search": "query"
}
```

#### search_history
```json
{
  "command": "search_history",
  "id": "unique-request-id",
  "query": "search term",
  "limit": 50
}
```

#### get_history_entry
```json
{
  "command": "get_history_entry",
  "id": "unique-request-id",
  "id": "entry-id"
}
```

#### delete_history_entry
```json
{
  "command": "delete_history_entry",
  "id": "unique-request-id",
  "id": "entry-id"
}
```

#### delete_history_range
```json
{
  "command": "delete_history_range",
  "id": "unique-request-id",
  "startTime": "2024-01-01T00:00:00Z",
  "endTime": "2024-01-31T23:59:59Z"
}
```

#### clear_history
```json
{
  "command": "clear_history",
  "id": "unique-request-id"
}
```

#### get_visit_count
```json
{
  "command": "get_visit_count",
  "id": "unique-request-id",
  "url": "https://example.com"
}
```

#### get_most_visited
```json
{
  "command": "get_most_visited",
  "id": "unique-request-id",
  "limit": 10
}
```

#### export_history
```json
{
  "command": "export_history",
  "id": "unique-request-id",
  "format": "json"
}
```

#### import_history
```json
{
  "command": "import_history",
  "id": "unique-request-id",
  "data": { "entries": [...] },
  "overwrite": false
}
```

#### get_history_stats
```json
{
  "command": "get_history_stats",
  "id": "unique-request-id"
}
```

## Storage

History data is stored in the user's application data directory:

- **Location**: `{userData}/history/history.json`
- **Format**: JSON with version information and entry array
- **Indexing**: In-memory indexes for URL and timestamp are rebuilt on load
- **Auto-save**: Changes are debounced and saved automatically (1 second delay)

### Storage Structure

```json
{
  "version": "1.0",
  "lastModified": "2024-01-15T12:00:00Z",
  "entries": [
    {
      "id": "1705320000000-abc123",
      "url": "https://example.com",
      "title": "Example Page",
      "visitTime": "2024-01-15T12:00:00Z",
      "visitDuration": 30000,
      "referrer": "https://google.com",
      "tabId": "tab-1",
      "transitionType": "link"
    }
  ]
}
```

## Automatic Tracking

The history manager automatically tracks navigations when:

1. **Navigation starts**: A new entry is created with URL and timestamp
2. **Page loads**: Title and favicon are updated
3. **Tab navigates away or closes**: Visit duration is calculated and saved

### Skipped URLs

The following URL patterns are automatically skipped:

- `about:*` (browser internal pages)
- `chrome:*` (Chrome internal pages)
- `chrome-extension:*` (Extension pages)
- `file://` (Local files)
- `data:` (Data URLs)
- `javascript:` (JavaScript URLs)
- `blob:` (Blob URLs)

## Configuration

### Max Entries Limit

By default, the history manager keeps the most recent 10,000 entries. When this limit is exceeded, the oldest entries are automatically removed.

```javascript
// Configure in main.js when initializing
historyManager = new HistoryManager({
  dataPath: historyDataPath,
  maxEntries: 10000  // Default
});
```

## Best Practices

1. **Use time ranges**: When querying large histories, use `startTime` and `endTime` filters
2. **Limit results**: Always specify a `limit` to avoid loading too many entries
3. **Export regularly**: For backup purposes, export history periodically
4. **Clear old entries**: Use `deleteHistoryRange` to remove old entries and save storage

## Troubleshooting

### History not saving
- Check write permissions to the application data directory
- Verify the history data path is accessible

### Slow queries
- Use more specific search terms
- Limit results with the `limit` parameter
- Use time-based filtering to narrow results

### Missing titles
- Titles are updated when pages finish loading
- Very fast navigations may not capture titles

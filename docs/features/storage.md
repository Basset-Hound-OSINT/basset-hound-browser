# Storage Manager API Documentation

The Storage Manager provides comprehensive local storage management for the Basset Hound Browser, enabling manipulation of localStorage, sessionStorage, and IndexedDB across different origins with full export/import capabilities.

## Overview

The `StorageManager` class (`storage/manager.js`) provides:

- **localStorage Management**: Read, write, and clear localStorage for any origin
- **sessionStorage Management**: Read, write, and clear sessionStorage for any origin
- **IndexedDB Access**: List, read, and delete IndexedDB databases and their contents
- **Export/Import**: Full storage backup and restore functionality
- **Storage Statistics**: Usage metrics and quota information

## Architecture

The StorageManager executes JavaScript in the webview context to access storage APIs. It uses a pending operations system with timeouts to handle asynchronous operations safely.

```
┌─────────────────┐     IPC     ┌──────────────────┐
│  StorageManager │ ─────────▶ │     Renderer     │
│   (Main Process)│            │    (Webview)     │
│                 │ ◀───────── │                  │
└─────────────────┘   Results  └──────────────────┘
```

## API Reference

### Constructor

```javascript
const StorageManager = require('./storage/manager');
const storageManager = new StorageManager(mainWindow);
```

**Parameters:**
- `mainWindow` - Electron BrowserWindow instance

---

## LocalStorage Methods

### getLocalStorage(origin)

Get all localStorage items for a specific origin.

**Parameters:**
- `origin` (string) - The origin URL (e.g., 'https://example.com')

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  data: { key1: 'value1', key2: 'value2' },
  count: 2
}
```

**WebSocket Command:**
```json
{
  "command": "storage:getLocalStorage",
  "params": {
    "origin": "https://example.com"
  }
}
```

**Example:**
```javascript
const result = await storageManager.getLocalStorage('https://example.com');
if (result.success) {
  console.log(`Found ${result.count} items:`, result.data);
}
```

---

### setLocalStorageItem(origin, key, value)

Set a localStorage item for a specific origin.

**Parameters:**
- `origin` (string) - The origin URL
- `key` (string) - Storage key
- `value` (string|any) - Value to store (non-strings are JSON stringified)

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  key: 'myKey'
}
```

**WebSocket Command:**
```json
{
  "command": "storage:setLocalStorageItem",
  "params": {
    "origin": "https://example.com",
    "key": "userPrefs",
    "value": "{\"theme\":\"dark\",\"language\":\"en\"}"
  }
}
```

**Example:**
```javascript
// Store a string
await storageManager.setLocalStorageItem('https://example.com', 'token', 'abc123');

// Store an object (automatically JSON stringified)
await storageManager.setLocalStorageItem('https://example.com', 'settings', {
  theme: 'dark',
  notifications: true
});
```

---

### removeLocalStorageItem(origin, key)

Remove a localStorage item for a specific origin.

**Parameters:**
- `origin` (string) - The origin URL
- `key` (string) - Storage key to remove

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  key: 'myKey',
  existed: true
}
```

**WebSocket Command:**
```json
{
  "command": "storage:removeLocalStorageItem",
  "params": {
    "origin": "https://example.com",
    "key": "userPrefs"
  }
}
```

---

### clearLocalStorage(origin)

Clear all localStorage for a specific origin.

**Parameters:**
- `origin` (string) - The origin URL

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  clearedCount: 5
}
```

**WebSocket Command:**
```json
{
  "command": "storage:clearLocalStorage",
  "params": {
    "origin": "https://example.com"
  }
}
```

---

## SessionStorage Methods

### getSessionStorage(origin)

Get all sessionStorage items for a specific origin.

**Parameters:**
- `origin` (string) - The origin URL

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  data: { sessionKey: 'sessionValue' },
  count: 1
}
```

**WebSocket Command:**
```json
{
  "command": "storage:getSessionStorage",
  "params": {
    "origin": "https://example.com"
  }
}
```

---

### setSessionStorageItem(origin, key, value)

Set a sessionStorage item for a specific origin.

**Parameters:**
- `origin` (string) - The origin URL
- `key` (string) - Storage key
- `value` (string|any) - Value to store

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  key: 'mySessionKey'
}
```

**WebSocket Command:**
```json
{
  "command": "storage:setSessionStorageItem",
  "params": {
    "origin": "https://example.com",
    "key": "sessionToken",
    "value": "temp-session-123"
  }
}
```

---

### removeSessionStorageItem(origin, key)

Remove a sessionStorage item for a specific origin.

**Parameters:**
- `origin` (string) - The origin URL
- `key` (string) - Storage key to remove

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  key: 'mySessionKey',
  existed: true
}
```

---

### clearSessionStorage(origin)

Clear all sessionStorage for a specific origin.

**Parameters:**
- `origin` (string) - The origin URL

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  clearedCount: 3
}
```

---

## IndexedDB Methods

### getIndexedDBDatabases(origin)

Get a list of IndexedDB databases for a specific origin.

**Parameters:**
- `origin` (string) - The origin URL

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  databases: [
    { name: 'myDatabase', version: 1 },
    { name: 'cacheDB', version: 2 }
  ],
  count: 2
}
```

**WebSocket Command:**
```json
{
  "command": "storage:getIndexedDBDatabases",
  "params": {
    "origin": "https://example.com"
  }
}
```

---

### getIndexedDBContents(origin, name)

Get the full contents of an IndexedDB database including all object stores and their data.

**Parameters:**
- `origin` (string) - The origin URL
- `name` (string) - Database name

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  database: {
    name: 'myDatabase',
    version: 1,
    objectStores: {
      users: {
        keyPath: 'id',
        autoIncrement: true,
        indexes: ['email', 'name'],
        data: [
          { id: 1, name: 'John', email: 'john@example.com' }
        ],
        count: 1
      }
    }
  }
}
```

**WebSocket Command:**
```json
{
  "command": "storage:getIndexedDBContents",
  "params": {
    "origin": "https://example.com",
    "name": "myDatabase"
  }
}
```

---

### deleteIndexedDBDatabase(origin, name)

Delete an IndexedDB database for a specific origin.

**Parameters:**
- `origin` (string) - The origin URL
- `name` (string) - Database name to delete

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  deletedDatabase: 'myDatabase'
}
```

**WebSocket Command:**
```json
{
  "command": "storage:deleteIndexedDBDatabase",
  "params": {
    "origin": "https://example.com",
    "name": "myDatabase"
  }
}
```

**Note:** If the database has open connections, the deletion may be blocked. Close all connections first.

---

## Export/Import Methods

### exportStorage(origin, types)

Export storage data for a specific origin.

**Parameters:**
- `origin` (string) - The origin URL
- `types` (string[], optional) - Types to export: `['localStorage', 'sessionStorage', 'indexedDB']`
  - Default: all types

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  export: {
    origin: 'https://example.com',
    exportedAt: '2024-01-15T10:30:00.000Z',
    version: '1.0',
    data: {
      localStorage: { key1: 'value1' },
      sessionStorage: { sessionKey: 'sessionValue' },
      indexedDB: {
        myDatabase: {
          name: 'myDatabase',
          version: 1,
          objectStores: { /* ... */ }
        }
      }
    }
  }
}
```

**WebSocket Command:**
```json
{
  "command": "storage:exportStorage",
  "params": {
    "origin": "https://example.com",
    "types": ["localStorage", "sessionStorage"]
  }
}
```

---

### importStorage(origin, data)

Import storage data for a specific origin.

**Parameters:**
- `origin` (string) - The origin URL
- `data` (Object) - Storage data to import (from exportStorage)

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  results: {
    localStorage: {
      imported: 5,
      total: 5,
      errors: []
    },
    sessionStorage: {
      imported: 2,
      total: 2,
      errors: []
    },
    indexedDB: {
      myDatabase: {
        success: true,
        stores: {
          users: { imported: 10, total: 10 }
        }
      }
    }
  }
}
```

**WebSocket Command:**
```json
{
  "command": "storage:importStorage",
  "params": {
    "origin": "https://example.com",
    "data": {
      "localStorage": { "key1": "value1" },
      "sessionStorage": { "sessionKey": "sessionValue" }
    }
  }
}
```

---

### exportStorageToFile(filepath, origin, types)

Export storage data directly to a file.

**Parameters:**
- `filepath` (string) - Path to save the export file
- `origin` (string) - The origin URL
- `types` (string[], optional) - Types to export

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  filepath: '/path/to/export.json',
  origin: 'https://example.com',
  exportedTypes: ['localStorage', 'sessionStorage', 'indexedDB'],
  size: 4096
}
```

**WebSocket Command:**
```json
{
  "command": "storage:exportStorageToFile",
  "params": {
    "filepath": "/home/user/storage-backup.json",
    "origin": "https://example.com"
  }
}
```

---

### importStorageFromFile(filepath, origin)

Import storage data from a file.

**Parameters:**
- `filepath` (string) - Path to the import file
- `origin` (string, optional) - Target origin (overrides file origin if provided)

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  results: { /* import results */ },
  filepath: '/path/to/export.json',
  origin: 'https://example.com',
  fileVersion: '1.0',
  originalExportDate: '2024-01-15T10:30:00.000Z'
}
```

**WebSocket Command:**
```json
{
  "command": "storage:importStorageFromFile",
  "params": {
    "filepath": "/home/user/storage-backup.json",
    "origin": "https://different-domain.com"
  }
}
```

---

## Utility Methods

### getStorageStats(origin)

Get storage usage statistics for an origin.

**Parameters:**
- `origin` (string) - The origin URL

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  stats: {
    localStorage: {
      count: 10,
      estimatedSize: 2048
    },
    sessionStorage: {
      count: 3,
      estimatedSize: 512
    },
    indexedDB: {
      databases: 2,
      databaseNames: ['db1', 'db2']
    },
    quota: {
      usage: 1048576,
      quota: 104857600,
      usagePercentage: '1.00%'
    }
  }
}
```

**WebSocket Command:**
```json
{
  "command": "storage:getStorageStats",
  "params": {
    "origin": "https://example.com"
  }
}
```

---

### clearAllStorage(origin, types)

Clear all storage for an origin.

**Parameters:**
- `origin` (string) - The origin URL
- `types` (string[], optional) - Types to clear
  - Default: `['localStorage', 'sessionStorage', 'indexedDB']`

**Returns:** `Promise<Object>`
```javascript
{
  success: true,
  results: {
    localStorage: { success: true, clearedCount: 5 },
    sessionStorage: { success: true, clearedCount: 2 },
    indexedDB: {
      db1: { success: true, deletedDatabase: 'db1' },
      db2: { success: true, deletedDatabase: 'db2' }
    }
  }
}
```

**WebSocket Command:**
```json
{
  "command": "storage:clearAllStorage",
  "params": {
    "origin": "https://example.com",
    "types": ["localStorage"]
  }
}
```

---

### cleanup()

Cleanup pending operations. Should be called when shutting down.

```javascript
storageManager.cleanup();
```

---

## Error Handling

All methods return an object with a `success` property. On failure:

```javascript
{
  success: false,
  error: 'Error message describing the failure'
}
```

Common error scenarios:
- **"Origin is required"** - Missing origin parameter
- **"Key is required"** - Missing key for item operations
- **"Operation timed out"** - Script execution exceeded 30-second timeout
- **"Database deletion blocked"** - IndexedDB has open connections

---

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| Operation Timeout | 30000ms | Maximum time for storage operations |

---

## Complete WebSocket Command Reference

| Command | Description |
|---------|-------------|
| `storage:getLocalStorage` | Get all localStorage items |
| `storage:setLocalStorageItem` | Set a localStorage item |
| `storage:removeLocalStorageItem` | Remove a localStorage item |
| `storage:clearLocalStorage` | Clear all localStorage |
| `storage:getSessionStorage` | Get all sessionStorage items |
| `storage:setSessionStorageItem` | Set a sessionStorage item |
| `storage:removeSessionStorageItem` | Remove a sessionStorage item |
| `storage:clearSessionStorage` | Clear all sessionStorage |
| `storage:getIndexedDBDatabases` | List IndexedDB databases |
| `storage:getIndexedDBContents` | Get database contents |
| `storage:deleteIndexedDBDatabase` | Delete a database |
| `storage:exportStorage` | Export storage data |
| `storage:importStorage` | Import storage data |
| `storage:exportStorageToFile` | Export to file |
| `storage:importStorageFromFile` | Import from file |
| `storage:getStorageStats` | Get storage statistics |
| `storage:clearAllStorage` | Clear all storage types |

---

## Usage Examples

### Backup and Restore User Session

```javascript
// Export all storage for a site
const backup = await storageManager.exportStorage('https://webapp.example.com');
fs.writeFileSync('session-backup.json', JSON.stringify(backup.export, null, 2));

// Later, restore the session
const data = JSON.parse(fs.readFileSync('session-backup.json'));
await storageManager.importStorage('https://webapp.example.com', data);
```

### Migrate Storage Between Origins

```javascript
// Export from source
const exported = await storageManager.exportStorage('https://old-domain.com');

// Import to destination
await storageManager.importStorage('https://new-domain.com', exported.export);
```

### Monitor Storage Usage

```javascript
const stats = await storageManager.getStorageStats('https://example.com');
if (stats.success) {
  const { quota } = stats.stats;
  console.log(`Storage usage: ${quota.usagePercentage} of quota`);
}
```

### Inspect IndexedDB Contents

```javascript
// List all databases
const dbs = await storageManager.getIndexedDBDatabases('https://example.com');

// Get contents of each database
for (const db of dbs.databases) {
  const contents = await storageManager.getIndexedDBContents('https://example.com', db.name);
  console.log(`Database ${db.name}:`, contents.database);
}
```

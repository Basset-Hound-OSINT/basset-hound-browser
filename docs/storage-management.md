# Storage Management

The Basset Hound Browser provides comprehensive storage management capabilities for localStorage, sessionStorage, and IndexedDB. This enables full control over web storage for automation, testing, and OSINT tasks.

## Overview

The Storage Manager allows you to:
- Read, write, and clear localStorage data
- Read, write, and clear sessionStorage data
- List and delete IndexedDB databases
- Export all storage data to JSON or files
- Import storage data from JSON or files
- Get storage statistics and usage information

## Architecture

```
+------------------+     +-------------------+     +------------------+
|   WebSocket API  | --> | StorageManager    | --> | Webview Context  |
|   (External)     |     | (Main Process)    |     | (Page Scripts)   |
+------------------+     +-------------------+     +------------------+
         |                       |                        ^
         |                       v                        |
         |               +-------------------+            |
         +-------------> |   IPC Handlers    | ---------->+
                         |   (Main Process)  |
                         +-------------------+
```

## API Reference

### LocalStorage Methods

#### Get All localStorage
Retrieves all localStorage items for a specific origin.

**WebSocket Command:**
```json
{
  "command": "get_local_storage",
  "origin": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key1": "value1",
    "key2": "value2"
  },
  "count": 2
}
```

#### Set localStorage Item
Sets a single localStorage item.

**WebSocket Command:**
```json
{
  "command": "set_local_storage",
  "origin": "https://example.com",
  "key": "myKey",
  "value": "myValue"
}
```

**Response:**
```json
{
  "success": true,
  "key": "myKey"
}
```

#### Clear localStorage
Clears all localStorage for an origin.

**WebSocket Command:**
```json
{
  "command": "clear_local_storage",
  "origin": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "clearedCount": 5
}
```

### SessionStorage Methods

#### Get All sessionStorage
Retrieves all sessionStorage items for a specific origin.

**WebSocket Command:**
```json
{
  "command": "get_session_storage",
  "origin": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionKey1": "sessionValue1"
  },
  "count": 1
}
```

#### Set sessionStorage Item
Sets a single sessionStorage item.

**WebSocket Command:**
```json
{
  "command": "set_session_storage",
  "origin": "https://example.com",
  "key": "sessionKey",
  "value": "sessionValue"
}
```

#### Clear sessionStorage
Clears all sessionStorage for an origin.

**WebSocket Command:**
```json
{
  "command": "clear_session_storage",
  "origin": "https://example.com"
}
```

### IndexedDB Methods

#### List IndexedDB Databases
Lists all IndexedDB databases for an origin.

**WebSocket Command:**
```json
{
  "command": "get_indexeddb",
  "origin": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "databases": [
    { "name": "myDatabase", "version": 1 },
    { "name": "anotherDB", "version": 2 }
  ],
  "count": 2
}
```

#### Delete IndexedDB Database
Deletes a specific IndexedDB database.

**WebSocket Command:**
```json
{
  "command": "delete_indexeddb",
  "origin": "https://example.com",
  "name": "myDatabase"
}
```

**Response:**
```json
{
  "success": true,
  "deletedDatabase": "myDatabase"
}
```

### Export/Import Methods

#### Export Storage
Exports all storage data for an origin.

**WebSocket Command:**
```json
{
  "command": "export_storage",
  "origin": "https://example.com",
  "types": ["localStorage", "sessionStorage", "indexedDB"]
}
```

**Response:**
```json
{
  "success": true,
  "export": {
    "origin": "https://example.com",
    "exportedAt": "2024-01-15T10:30:00.000Z",
    "version": "1.0",
    "data": {
      "localStorage": { "key1": "value1" },
      "sessionStorage": { "sessKey": "sessValue" },
      "indexedDB": {
        "myDatabase": {
          "name": "myDatabase",
          "version": 1,
          "objectStores": {}
        }
      }
    }
  }
}
```

#### Export Storage to File
Exports storage data directly to a file.

**WebSocket Command:**
```json
{
  "command": "export_storage",
  "origin": "https://example.com",
  "filepath": "/path/to/storage-export.json",
  "types": ["localStorage", "sessionStorage"]
}
```

**Response:**
```json
{
  "success": true,
  "filepath": "/path/to/storage-export.json",
  "origin": "https://example.com",
  "exportedTypes": ["localStorage", "sessionStorage"],
  "size": 1234
}
```

#### Import Storage
Imports storage data from a JSON object.

**WebSocket Command:**
```json
{
  "command": "import_storage",
  "origin": "https://example.com",
  "data": {
    "localStorage": { "key1": "value1" },
    "sessionStorage": { "sessKey": "sessValue" }
  }
}
```

**Response:**
```json
{
  "success": true,
  "results": {
    "localStorage": { "imported": 1, "total": 1, "errors": [] },
    "sessionStorage": { "imported": 1, "total": 1, "errors": [] }
  }
}
```

#### Import Storage from File
Imports storage data from a file.

**WebSocket Command:**
```json
{
  "command": "import_storage",
  "filepath": "/path/to/storage-export.json",
  "origin": "https://example.com"
}
```

### Utility Methods

#### Get Storage Statistics
Gets storage usage statistics for an origin.

**WebSocket Command:**
```json
{
  "command": "get_storage_stats",
  "origin": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "localStorage": {
      "count": 5,
      "estimatedSize": 1024
    },
    "sessionStorage": {
      "count": 2,
      "estimatedSize": 256
    },
    "indexedDB": {
      "databases": 1,
      "databaseNames": ["myDB"]
    },
    "quota": {
      "usage": 10240,
      "quota": 1073741824,
      "usagePercentage": "0.00%"
    }
  }
}
```

#### Clear All Storage
Clears all storage types for an origin.

**WebSocket Command:**
```json
{
  "command": "clear_all_storage",
  "origin": "https://example.com",
  "types": ["localStorage", "sessionStorage", "indexedDB"]
}
```

**Response:**
```json
{
  "success": true,
  "results": {
    "localStorage": { "success": true, "clearedCount": 5 },
    "sessionStorage": { "success": true, "clearedCount": 2 },
    "indexedDB": {
      "myDB": { "success": true, "deletedDatabase": "myDB" }
    }
  }
}
```

## JavaScript API (Preload)

The storage API is exposed through the `electronAPI` object:

```javascript
// LocalStorage
await electronAPI.getLocalStorage('https://example.com');
await electronAPI.setLocalStorageItem('https://example.com', 'key', 'value');
await electronAPI.removeLocalStorageItem('https://example.com', 'key');
await electronAPI.clearLocalStorage('https://example.com');

// SessionStorage
await electronAPI.getSessionStorage('https://example.com');
await electronAPI.setSessionStorageItem('https://example.com', 'key', 'value');
await electronAPI.removeSessionStorageItem('https://example.com', 'key');
await electronAPI.clearSessionStorage('https://example.com');

// IndexedDB
await electronAPI.getIndexedDBDatabases('https://example.com');
await electronAPI.deleteIndexedDBDatabase('https://example.com', 'dbName');

// Export/Import
await electronAPI.exportStorage('https://example.com', ['localStorage', 'sessionStorage']);
await electronAPI.importStorage('https://example.com', data);
await electronAPI.exportStorageToFile('/path/to/file.json', 'https://example.com');
await electronAPI.importStorageFromFile('/path/to/file.json', 'https://example.com');

// Statistics
await electronAPI.getStorageStats('https://example.com');
await electronAPI.clearAllStorage('https://example.com', ['localStorage', 'sessionStorage']);
```

## Use Cases

### 1. Session Persistence Testing
Export and restore user sessions for testing:

```javascript
// Export current session storage
const sessionData = await ws.send({
  command: 'export_storage',
  origin: 'https://app.example.com',
  types: ['localStorage', 'sessionStorage']
});

// Later, restore the session
await ws.send({
  command: 'import_storage',
  origin: 'https://app.example.com',
  data: sessionData.export.data
});
```

### 2. Authentication Token Management
Manage auth tokens for automated testing:

```javascript
// Set authentication token
await ws.send({
  command: 'set_local_storage',
  origin: 'https://api.example.com',
  key: 'authToken',
  value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
});
```

### 3. Clear Site Data
Reset browser state for fresh tests:

```javascript
// Clear all storage for a site
await ws.send({
  command: 'clear_all_storage',
  origin: 'https://example.com',
  types: ['localStorage', 'sessionStorage', 'indexedDB']
});
```

### 4. OSINT Data Collection
Collect stored data from investigated sites:

```javascript
// Export all storage to file
await ws.send({
  command: 'export_storage',
  origin: 'https://target-site.com',
  filepath: '/evidence/storage-data.json'
});
```

### 5. Cross-Session Data Migration
Move storage between browser profiles:

```javascript
// Export from one profile
const data = await ws.send({
  command: 'export_storage',
  origin: 'https://example.com'
});

// Import to another profile (after switching)
await ws.send({
  command: 'import_storage',
  origin: 'https://example.com',
  data: data.export
});
```

## Security Considerations

1. **Origin Validation**: The storage manager validates origin parameters to prevent cross-origin access issues.

2. **Data Escaping**: All keys and values are properly escaped to prevent injection attacks.

3. **File Operations**: Export/import file operations validate paths and ensure proper permissions.

4. **Timeout Protection**: Storage operations have a 30-second timeout to prevent hanging.

## Troubleshooting

### Common Issues

1. **"Origin is required" error**
   - Ensure you're passing a valid origin URL (e.g., `https://example.com`)

2. **"Storage manager not available" error**
   - The storage manager may not be initialized. Check the browser console for errors.

3. **IndexedDB operations fail**
   - Some browsers don't support `indexedDB.databases()`. A warning will be returned in this case.

4. **Import fails with "Database deletion blocked"**
   - Close all connections to the database before deleting/reimporting.

### Debugging

Enable verbose logging by checking the browser console for `[StorageManager]` prefixed messages.

## Version History

- **1.0.0** - Initial release with localStorage, sessionStorage, and IndexedDB support

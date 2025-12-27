# Tab Management

The Basset Hound Browser includes a comprehensive tab management system that allows you to create, switch, close, and manage multiple browser tabs. This document covers the Tab class, TabManager API, WebSocket commands, IPC handlers, and UI integration.

## Overview

The tab management system consists of:

1. **Tab Class** (`tabs/manager.js`) - Represents individual browser tabs with state and navigation history
2. **TabManager Class** (`tabs/manager.js`) - Manages multiple tabs, handles tab lifecycle and events
3. **IPC Handlers** (`main.js`) - Electron IPC handlers for tab operations
4. **WebSocket Commands** (`websocket/server.js`) - External API for tab control via WebSocket
5. **Preload API** (`preload.js`) - Secure bridge exposing tab methods to the renderer
6. **Renderer UI** (`renderer/renderer.js`, `renderer/index.html`) - Tab bar UI with interactive controls

## Tab Class

The `Tab` class represents an individual browser tab with the following properties:

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique tab identifier (auto-generated) |
| `url` | string | Current URL of the tab |
| `title` | string | Tab title |
| `sessionId` | string | Session this tab belongs to |
| `webContents` | Object | Electron webContents reference |
| `active` | boolean | Whether this tab is currently active |
| `createdAt` | string | ISO timestamp of tab creation |
| `lastAccessed` | string | ISO timestamp of last access |
| `loading` | boolean | Whether the tab is currently loading |
| `favicon` | string | URL of the tab's favicon |
| `canGoBack` | boolean | Whether navigation back is possible |
| `canGoForward` | boolean | Whether navigation forward is possible |
| `zoomLevel` | number | Current zoom level (1.0 = 100%) |
| `muted` | boolean | Whether audio is muted |
| `pinned` | boolean | Whether the tab is pinned |

### Methods

```javascript
// Get serializable representation
tab.toJSON()

// Update tab properties
tab.update({ title: 'New Title', loading: false })

// Navigation history
tab.addToHistory('https://example.com')
tab.goBack()   // Returns previous URL or null
tab.goForward() // Returns next URL or null
```

## TabManager Class

The `TabManager` extends `EventEmitter` and provides methods for managing multiple tabs.

### Constructor Options

```javascript
const tabManager = new TabManager({
  homePage: 'https://www.google.com',  // Default home page URL
  maxTabs: 50,                          // Maximum number of tabs allowed

  // Legacy event callbacks (use events instead)
  onTabCreated: (tab) => {},
  onTabClosed: (data) => {},
  onTabSwitched: (data) => {},
  onTabUpdated: (data) => {}
});
```

### Methods

#### Core Tab Operations

| Method | Parameters | Description |
|--------|------------|-------------|
| `createTab(options)` | `{ url?, title?, sessionId?, webContents?, active? }` | Create a new tab |
| `closeTab(tabId)` | `tabId: string` | Close a tab by ID |
| `switchTab(tabId)` | `tabId: string` | Switch to a tab by ID |
| `getTab(tabId)` | `tabId: string` | Get tab info by ID |
| `getTabInfo(tabId)` | `tabId: string` | Get tab info by ID (alias) |
| `getAllTabs(options?)` | `{ sessionId? }` | Get array of all tabs |
| `listTabs(options?)` | `{ sessionId? }` | Get tabs with metadata |
| `getActiveTab()` | - | Get the currently active tab |

#### Navigation

| Method | Parameters | Description |
|--------|------------|-------------|
| `navigateTab(tabId, url)` | `tabId: string, url: string` | Navigate a tab to URL |
| `goBack(tabId?)` | `tabId?: string` | Go back in history |
| `goForward(tabId?)` | `tabId?: string` | Go forward in history |
| `reloadTab(tabId?)` | `tabId?: string` | Reload a tab |

#### Tab State

| Method | Parameters | Description |
|--------|------------|-------------|
| `updateTab(tabId, updates)` | `tabId: string, updates: Object` | Update tab properties |
| `pinTab(tabId, pinned)` | `tabId: string, pinned: boolean` | Pin/unpin a tab |
| `muteTab(tabId, muted)` | `tabId: string, muted: boolean` | Mute/unmute a tab |
| `setZoom(tabId, zoomLevel)` | `tabId: string, zoomLevel: number` | Set zoom level |

#### Tab Navigation

| Method | Parameters | Description |
|--------|------------|-------------|
| `nextTab()` | - | Switch to next tab |
| `previousTab()` | - | Switch to previous tab |
| `switchToTabIndex(index)` | `index: number` | Switch to tab at index (1-based) |
| `moveTab(tabId, newIndex)` | `tabId: string, newIndex: number` | Move tab to new position |

#### Batch Operations

| Method | Parameters | Description |
|--------|------------|-------------|
| `duplicateTab(tabId)` | `tabId: string` | Duplicate a tab |
| `closeOtherTabs(tabId)` | `tabId: string` | Close all tabs except one |
| `closeTabsToRight(tabId)` | `tabId: string` | Close tabs to the right |

#### Persistence

| Method | Parameters | Description |
|--------|------------|-------------|
| `serialize()` | - | Get serializable tabs state |
| `restore(data)` | `data: Object` | Restore tabs from serialized data |
| `cleanup()` | - | Close all tabs and cleanup |

### Events

The TabManager emits the following events:

```javascript
tabManager.on('tab-created', (tab) => {
  console.log('Tab created:', tab.id);
});

tabManager.on('tab-closed', ({ tabId, newActiveTabId }) => {
  console.log('Tab closed:', tabId);
});

tabManager.on('tab-switched', ({ tabId, previousTabId }) => {
  console.log('Switched to tab:', tabId);
});

tabManager.on('tab-updated', ({ tabId, updates, tab }) => {
  console.log('Tab updated:', tabId, updates);
});
```

## WebSocket API

Control tabs remotely via WebSocket commands. Connect to `ws://localhost:8765`.

### Commands

#### create_tab / new_tab

Create a new tab.

```json
{
  "command": "create_tab",
  "url": "https://example.com",
  "title": "Example",
  "sessionId": "default",
  "active": true
}
```

Response:
```json
{
  "success": true,
  "tab": {
    "id": "tab-1234567890-abc123def",
    "url": "https://example.com",
    "title": "Example",
    "isActive": true
  }
}
```

#### close_tab

Close a tab by ID.

```json
{
  "command": "close_tab",
  "tabId": "tab-1234567890-abc123def"
}
```

#### switch_tab

Switch to a tab by ID or index.

```json
{
  "command": "switch_tab",
  "tabId": "tab-1234567890-abc123def"
}
```

Or by index:
```json
{
  "command": "switch_tab",
  "index": 2
}
```

#### get_tabs / list_tabs

Get all tabs.

```json
{
  "command": "get_tabs"
}
```

Response:
```json
{
  "success": true,
  "activeTabId": "tab-1234567890-abc123def",
  "count": 3,
  "tabs": [...]
}
```

#### get_active_tab

Get the currently active tab.

```json
{
  "command": "get_active_tab"
}
```

#### tab_navigate / navigate_tab

Navigate a specific tab to a URL.

```json
{
  "command": "tab_navigate",
  "tabId": "tab-1234567890-abc123def",
  "url": "https://example.com"
}
```

#### Additional Commands

| Command | Parameters | Description |
|---------|------------|-------------|
| `reload_tab` | `tabId?` | Reload a tab |
| `tab_back` | `tabId?` | Go back in history |
| `tab_forward` | `tabId?` | Go forward in history |
| `duplicate_tab` | `tabId` | Duplicate a tab |
| `pin_tab` | `tabId, pinned` | Pin/unpin a tab |
| `mute_tab` | `tabId, muted` | Mute/unmute a tab |
| `set_tab_zoom` | `tabId?, zoomLevel` | Set zoom level |
| `move_tab` | `tabId, newIndex` | Move tab position |
| `close_other_tabs` | `tabId` | Close other tabs |
| `next_tab` | - | Switch to next tab |
| `previous_tab` | - | Switch to previous tab |
| `get_tab_info` | `tabId?` | Get specific tab info |

## IPC Handlers (Electron)

Available IPC handlers for tab operations from the renderer process:

```javascript
// From renderer via preload.js
await window.electronAPI.newTab({ url: 'https://example.com' });
await window.electronAPI.closeTab('tab-id');
await window.electronAPI.switchTab('tab-id');
await window.electronAPI.listTabs();
await window.electronAPI.getActiveTab();
await window.electronAPI.navigateTab('tab-id', 'https://example.com');
await window.electronAPI.reloadTab('tab-id');
await window.electronAPI.tabBack('tab-id');
await window.electronAPI.tabForward('tab-id');
await window.electronAPI.duplicateTab('tab-id');
await window.electronAPI.pinTab('tab-id', true);
await window.electronAPI.muteTab('tab-id', true);
await window.electronAPI.setTabZoom('tab-id', 1.5);
await window.electronAPI.moveTab('tab-id', 0);
await window.electronAPI.nextTab();
await window.electronAPI.previousTab();

// One-way update
window.electronAPI.updateTab('tab-id', { title: 'New Title' });
```

## Renderer Event Listeners

Listen for tab events from the main process:

```javascript
window.electronAPI.onTabCreated((tab) => {
  console.log('New tab:', tab);
});

window.electronAPI.onTabClosed(({ closedTabId, activeTabId }) => {
  console.log('Tab closed:', closedTabId);
});

window.electronAPI.onTabSwitched(({ tabId, previousTabId }) => {
  console.log('Switched to:', tabId);
});

window.electronAPI.onTabUpdated(({ tabId, updates, tab }) => {
  console.log('Tab updated:', tabId);
});

window.electronAPI.onTabNavigate(({ tabId, url }) => {
  console.log('Tab navigating to:', url);
});

window.electronAPI.onTabReload(({ tabId }) => {
  console.log('Tab reloading:', tabId);
});
```

## UI Integration

### Tab Bar

The tab bar is located at the top of the browser window and includes:

- Tab buttons showing favicon, title, and close button
- New tab button (+)
- Session indicator

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close current tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+1-8` | Switch to tab 1-8 |
| `Ctrl+9` | Switch to last tab |

### Tab Bar Styling

Tabs use the following CSS classes:

- `.tab` - Base tab styling
- `.tab.active` - Active tab styling
- `.tab.pinned` - Pinned tab (smaller, no close button)
- `.tab-favicon` - Tab favicon image
- `.tab-title` - Tab title text
- `.tab-close` - Close button
- `.tab-loading` - Loading spinner

## Example Usage

### Creating and Managing Tabs Programmatically

```javascript
// In main process
const { TabManager } = require('./tabs/manager');

const tabManager = new TabManager({
  homePage: 'https://www.google.com',
  maxTabs: 20
});

// Listen for events
tabManager.on('tab-created', (tab) => {
  console.log('Created:', tab.id);
});

// Create tabs
const result1 = tabManager.createTab({ url: 'https://github.com' });
const result2 = tabManager.createTab({ url: 'https://google.com', active: false });

// Switch tabs
tabManager.switchTab(result1.tab.id);

// Get all tabs
const tabs = tabManager.getAllTabs();
console.log(`${tabs.length} tabs open`);

// Close a tab
tabManager.closeTab(result2.tab.id);
```

### WebSocket Client Example (Python)

```python
import websocket
import json

ws = websocket.create_connection("ws://localhost:8765")

# Create a new tab
ws.send(json.dumps({
    "id": "1",
    "command": "create_tab",
    "url": "https://example.com"
}))
response = json.loads(ws.recv())
tab_id = response["tab"]["id"]

# Navigate the tab
ws.send(json.dumps({
    "id": "2",
    "command": "tab_navigate",
    "tabId": tab_id,
    "url": "https://github.com"
}))

# Get all tabs
ws.send(json.dumps({
    "id": "3",
    "command": "get_tabs"
}))
tabs = json.loads(ws.recv())
print(f"Open tabs: {tabs['count']}")

# Close the tab
ws.send(json.dumps({
    "id": "4",
    "command": "close_tab",
    "tabId": tab_id
}))

ws.close()
```

### WebSocket Client Example (JavaScript/Node.js)

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  // Create a new tab
  ws.send(JSON.stringify({
    id: '1',
    command: 'create_tab',
    url: 'https://example.com'
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log('Response:', response);

  if (response.command === 'create_tab' && response.success) {
    // Navigate the new tab
    ws.send(JSON.stringify({
      id: '2',
      command: 'tab_navigate',
      tabId: response.tab.id,
      url: 'https://github.com'
    }));
  }
});
```

## Error Handling

All tab operations return objects with a `success` boolean:

```javascript
const result = tabManager.createTab({ url: 'https://example.com' });

if (result.success) {
  console.log('Tab created:', result.tab);
} else {
  console.error('Error:', result.error);
}
```

Common errors:

- `"Tab not found"` - The specified tab ID does not exist
- `"Maximum number of tabs (N) reached"` - Cannot create more tabs
- `"Cannot close pinned tab. Unpin first."` - Tab must be unpinned before closing
- `"Tab manager not available"` - TabManager not initialized
- `"No active tab"` - No tab is currently active

## Best Practices

1. **Always check return values** - Tab operations can fail
2. **Use events for updates** - Subscribe to `tab-updated` for real-time changes
3. **Handle max tabs** - Check if creating tabs is possible before attempting
4. **Clean up** - Call `cleanup()` when shutting down
5. **Use session isolation** - Use different `sessionId` values for isolated browsing contexts

# Tab Management API

The Tab Management module provides comprehensive multi-tab browser functionality for the Basset Hound Browser. It supports tab creation, switching, closing, navigation history, and various tab operations.

## Overview

The Tab Management system enables:
- Creating and managing multiple browser tabs
- Tab switching and navigation
- Per-tab navigation history with back/forward
- Tab pinning and muting
- Zoom level control
- Tab ordering and movement
- Tab serialization for persistence
- Event-driven architecture

## Module Location

```
basset-hound-browser/tabs/manager.js
```

---

## Tab Class

The `Tab` class represents an individual browser tab with its state and navigation history.

### Constructor

```javascript
const { Tab } = require('./tabs/manager');

const tab = new Tab({
  id: 'custom-tab-id',           // Optional: auto-generated if not provided
  url: 'https://example.com',    // Optional: default 'about:blank'
  title: 'Example Page',         // Optional: default 'New Tab'
  sessionId: 'default',          // Optional: default 'default'
  webContents: webContents,      // Optional: Electron webContents reference
  active: true                   // Optional: default false
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique tab identifier (auto-generated) |
| `url` | string | Current URL |
| `title` | string | Tab title |
| `sessionId` | string | Session this tab belongs to |
| `webContents` | Object/null | Electron webContents reference |
| `active` | boolean | Whether currently active |
| `createdAt` | string | ISO timestamp of creation |
| `lastAccessed` | string | ISO timestamp of last access |
| `loading` | boolean | Whether tab is loading |
| `favicon` | string/null | Favicon URL |
| `canGoBack` | boolean | Can navigate back |
| `canGoForward` | boolean | Can navigate forward |
| `history` | Array | Navigation history URLs |
| `historyIndex` | number | Current position in history |
| `zoomLevel` | number | Zoom level (1.0 = 100%) |
| `muted` | boolean | Audio muted |
| `pinned` | boolean | Tab is pinned |

### Methods

#### toJSON()

Get a serializable representation of the tab.

```javascript
const data = tab.toJSON();
```

**Returns:**
```javascript
{
  id: 'tab-123',
  url: 'https://example.com',
  title: 'Example',
  sessionId: 'default',
  active: true,
  createdAt: '2025-01-15T10:30:00Z',
  lastAccessed: '2025-01-15T10:35:00Z',
  loading: false,
  favicon: 'https://example.com/favicon.ico',
  canGoBack: true,
  canGoForward: false,
  zoomLevel: 1.0,
  muted: false,
  pinned: false
}
```

#### update(updates)

Update tab properties.

```javascript
tab.update({
  url: 'https://new-url.com',
  title: 'New Title',
  loading: false,
  favicon: 'https://new-url.com/favicon.ico'
});
```

**Allowed fields:**
- `url`, `title`, `loading`, `favicon`
- `canGoBack`, `canGoForward`
- `zoomLevel`, `muted`, `pinned`
- `active`, `webContents`

#### addToHistory(url)

Add URL to navigation history.

```javascript
tab.addToHistory('https://example.com/page2');
```

**Behavior:**
- Truncates forward history if navigating from middle
- Updates `canGoBack` and `canGoForward`
- Limits history to 100 entries

#### goBack()

Navigate back in history.

```javascript
const previousUrl = tab.goBack();
// Returns: 'https://example.com' or null if cannot go back
```

#### goForward()

Navigate forward in history.

```javascript
const nextUrl = tab.goForward();
// Returns: 'https://example.com/page2' or null if cannot go forward
```

---

## TabManager Class

The `TabManager` class extends `EventEmitter` and manages multiple tabs.

### Constructor

```javascript
const { TabManager } = require('./tabs/manager');

const tabManager = new TabManager({
  homePage: 'https://www.google.com',  // Default home page
  maxTabs: 50,                          // Maximum tabs allowed (default: 50)

  // Legacy event callbacks (prefer events instead)
  onTabCreated: (tab) => {},
  onTabClosed: (data) => {},
  onTabSwitched: (data) => {},
  onTabUpdated: (data) => {}
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `tabs` | Map | Map of tabId to Tab instance |
| `activeTabId` | string/null | Currently active tab ID |
| `tabOrder` | Array | Tab IDs in display order |
| `maxTabs` | number | Maximum allowed tabs |
| `homePage` | string | Default home page URL |

---

## Tab Creation and Deletion

### createTab(options)

Create a new tab.

```javascript
const result = tabManager.createTab({
  url: 'https://example.com',
  title: 'Example Page',
  sessionId: 'default',
  webContents: null,
  active: true    // Make this the active tab
});
```

**Parameters:**
- `url` (string, optional) - Initial URL (default: homePage)
- `title` (string, optional) - Tab title (default: 'New Tab')
- `sessionId` (string, optional) - Session identifier (default: 'default')
- `webContents` (Object, optional) - Electron webContents
- `active` (boolean, optional) - Activate immediately (default: true)

**Returns:**
```javascript
{
  success: true,
  tab: {
    id: 'tab-1703123456789-abc123def',
    url: 'https://example.com',
    title: 'Example Page',
    isActive: true,
    index: 0,
    ...
  }
}
// On max tabs reached:
{ success: false, error: 'Maximum number of tabs (50) reached' }
```

**Events emitted:** `tab-created`

### closeTab(tabId)

Close a tab by ID.

```javascript
const result = tabManager.closeTab('tab-id');
```

**Returns:**
```javascript
{
  success: true,
  closedTabId: 'tab-id',
  activeTabId: 'new-active-tab-id'  // Adjacent tab becomes active
}
// On pinned tab:
{ success: false, error: 'Cannot close pinned tab. Unpin first.' }
```

**Behavior:**
- Cannot close pinned tabs (must unpin first)
- Switches to adjacent tab when closing active tab
- Updates `tabOrder` array

**Events emitted:** `tab-closed`

### duplicateTab(tabId)

Duplicate an existing tab.

```javascript
const result = tabManager.duplicateTab('tab-id');
```

**Returns:**
```javascript
{
  success: true,
  tab: {...}  // New duplicated tab
}
```

**Note:** Duplicated tab is created inactive

---

## Tab Switching

### switchTab(tabId)

Switch to a specific tab.

```javascript
const result = tabManager.switchTab('tab-id');
```

**Returns:**
```javascript
{
  success: true,
  tab: {...},
  previousTabId: 'old-tab-id'
}
```

**Actions:**
- Updates `lastAccessed` timestamp
- Sets `active` property on tabs
- Updates `activeTabId`

**Events emitted:** `tab-switched`

### nextTab()

Switch to the next tab (wraps around).

```javascript
const result = tabManager.nextTab();
```

### previousTab()

Switch to the previous tab (wraps around).

```javascript
const result = tabManager.previousTab();
```

### switchToTabIndex(index)

Switch to tab at specific index.

```javascript
// Switch to first tab (1-based index for keyboard shortcuts)
tabManager.switchToTabIndex(1);

// Switch to last tab (0 = last)
tabManager.switchToTabIndex(0);
```

**Parameters:**
- `index` (number) - Tab index (1-based, 0 = last tab)

---

## Tab Information

### getTab(tabId) / getTabInfo(tabId)

Get information about a specific tab.

```javascript
const tabInfo = tabManager.getTab('tab-id');
```

**Returns:**
```javascript
{
  id: 'tab-id',
  url: 'https://example.com',
  title: 'Example',
  sessionId: 'default',
  createdAt: '2025-01-15T10:30:00Z',
  lastAccessed: '2025-01-15T10:35:00Z',
  loading: false,
  favicon: 'https://example.com/favicon.ico',
  canGoBack: true,
  canGoForward: false,
  zoomLevel: 1.0,
  muted: false,
  pinned: false,
  isActive: true,
  index: 0
}
// Or null if not found
```

### getActiveTab()

Get the currently active tab.

```javascript
const activeTab = tabManager.getActiveTab();
```

**Returns:** Tab info object or `null`

### listTabs(options)

List all tabs with metadata.

```javascript
const result = tabManager.listTabs();

// Filter by session
const result = tabManager.listTabs({ sessionId: 'custom-session' });
```

**Returns:**
```javascript
{
  success: true,
  activeTabId: 'tab-123',
  count: 3,
  tabs: [...]
}
```

### getAllTabs(options)

Get array of all tab info objects.

```javascript
const tabs = tabManager.getAllTabs();
```

**Returns:** Array of tab info objects

---

## Tab Updates

### updateTab(tabId, updates)

Update tab properties.

```javascript
const result = tabManager.updateTab('tab-id', {
  url: 'https://new-url.com',
  title: 'New Title',
  loading: false,
  favicon: 'https://new-url.com/favicon.ico'
});
```

**Allowed updates:**
- `url`, `title`, `loading`, `favicon`
- `canGoBack`, `canGoForward`
- `zoomLevel`, `muted`, `pinned`

**Behavior:**
- URL changes are added to navigation history
- Updates `canGoBack`/`canGoForward` automatically

**Events emitted:** `tab-updated`

---

## Navigation

### navigateTab(tabId, url)

Navigate a tab to a URL.

```javascript
const result = tabManager.navigateTab('tab-id', 'https://example.com');
```

**URL Normalization:**
- Adds `https://` if protocol missing and URL contains `.`
- Converts to Google search if no `.` and contains spaces
- Preserves `about:` URLs

**Returns:**
```javascript
{
  success: true,
  tabId: 'tab-id',
  url: 'https://example.com'
}
```

### goBack(tabId)

Go back in tab history.

```javascript
const result = tabManager.goBack('tab-id');
// Or use active tab:
const result = tabManager.goBack();
```

**Returns:**
```javascript
{
  success: true,
  tabId: 'tab-id',
  url: 'https://previous-page.com',
  canGoBack: true,
  canGoForward: true
}
// Or:
{ success: false, error: 'Cannot go back' }
```

### goForward(tabId)

Go forward in tab history.

```javascript
const result = tabManager.goForward('tab-id');
```

### reloadTab(tabId)

Reload a tab.

```javascript
const result = tabManager.reloadTab('tab-id');
```

**Returns:**
```javascript
{
  success: true,
  tabId: 'tab-id',
  url: 'https://example.com'
}
```

---

## Tab Properties

### pinTab(tabId, pinned)

Pin or unpin a tab.

```javascript
// Pin a tab
tabManager.pinTab('tab-id', true);

// Unpin a tab
tabManager.pinTab('tab-id', false);
```

**Behavior:**
- Pinned tabs are moved to the beginning of the tab bar
- Pinned tabs cannot be closed

### muteTab(tabId, muted)

Mute or unmute tab audio.

```javascript
tabManager.muteTab('tab-id', true);
```

### setZoom(tabId, zoomLevel)

Set zoom level for a tab.

```javascript
tabManager.setZoom('tab-id', 1.5); // 150% zoom
```

**Parameters:**
- `zoomLevel` (number) - Zoom level (clamped to 0.25 - 5.0)

---

## Tab Organization

### moveTab(tabId, newIndex)

Move a tab to a new position.

```javascript
const result = tabManager.moveTab('tab-id', 0); // Move to first position
```

**Returns:**
```javascript
{
  success: true,
  tabId: 'tab-id',
  oldIndex: 2,
  newIndex: 0
}
```

### closeOtherTabs(tabId)

Close all tabs except the specified one.

```javascript
const result = tabManager.closeOtherTabs('tab-id');
```

**Returns:**
```javascript
{
  success: true,
  closedCount: 5,
  remainingTabs: 1
}
```

**Note:** Does not close pinned tabs

### closeTabsToRight(tabId)

Close all tabs to the right of the specified tab.

```javascript
const result = tabManager.closeTabsToRight('tab-id');
```

---

## Persistence

### serialize()

Serialize tabs for persistence.

```javascript
const data = tabManager.serialize();
```

**Returns:**
```javascript
{
  activeTabId: 'tab-123',
  tabs: [
    {
      id: 'tab-123',
      url: 'https://example.com',
      title: 'Example',
      sessionId: 'default',
      pinned: false,
      muted: false,
      zoomLevel: 1.0
    },
    ...
  ]
}
```

### restore(data)

Restore tabs from serialized data.

```javascript
const result = tabManager.restore(serializedData);
```

**Returns:**
```javascript
{
  success: true,
  restoredCount: 5
}
```

### cleanup()

Close all tabs and cleanup resources.

```javascript
tabManager.cleanup();
```

---

## Events

The TabManager extends `EventEmitter` and emits the following events:

### tab-created

```javascript
tabManager.on('tab-created', (tab) => {
  console.log('Tab created:', tab.id, tab.url);
});
```

**Payload:** Tab info object

### tab-closed

```javascript
tabManager.on('tab-closed', ({ tabId, newActiveTabId }) => {
  console.log('Tab closed:', tabId);
  console.log('New active tab:', newActiveTabId);
});
```

### tab-switched

```javascript
tabManager.on('tab-switched', ({ tabId, previousTabId }) => {
  console.log('Switched from', previousTabId, 'to', tabId);
});
```

### tab-updated

```javascript
tabManager.on('tab-updated', ({ tabId, updates, tab }) => {
  console.log('Tab updated:', tabId);
  console.log('Changes:', updates);
});
```

---

## WebSocket Commands

### create_tab / new_tab

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

### close_tab

Close a tab.

```json
{
  "command": "close_tab",
  "tabId": "tab-123"
}
```

### switch_tab

Switch to a tab by ID or index.

```json
{
  "command": "switch_tab",
  "tabId": "tab-123"
}
```

Or by index:

```json
{
  "command": "switch_tab",
  "index": 2
}
```

### get_tabs / list_tabs

Get all tabs.

```json
{
  "command": "get_tabs"
}
```

### get_active_tab

Get the active tab.

```json
{
  "command": "get_active_tab"
}
```

### tab_navigate / navigate_tab

Navigate a tab to URL.

```json
{
  "command": "tab_navigate",
  "tabId": "tab-123",
  "url": "https://example.com"
}
```

### reload_tab

Reload a tab.

```json
{
  "command": "reload_tab",
  "tabId": "tab-123"
}
```

### tab_back

Go back in history.

```json
{
  "command": "tab_back",
  "tabId": "tab-123"
}
```

### tab_forward

Go forward in history.

```json
{
  "command": "tab_forward",
  "tabId": "tab-123"
}
```

### duplicate_tab

Duplicate a tab.

```json
{
  "command": "duplicate_tab",
  "tabId": "tab-123"
}
```

### pin_tab

Pin/unpin a tab.

```json
{
  "command": "pin_tab",
  "tabId": "tab-123",
  "pinned": true
}
```

### mute_tab

Mute/unmute a tab.

```json
{
  "command": "mute_tab",
  "tabId": "tab-123",
  "muted": true
}
```

### set_tab_zoom

Set zoom level.

```json
{
  "command": "set_tab_zoom",
  "tabId": "tab-123",
  "zoomLevel": 1.5
}
```

### move_tab

Move tab to new position.

```json
{
  "command": "move_tab",
  "tabId": "tab-123",
  "newIndex": 0
}
```

### close_other_tabs

Close all other tabs.

```json
{
  "command": "close_other_tabs",
  "tabId": "tab-123"
}
```

### next_tab / previous_tab

Switch to next/previous tab.

```json
{
  "command": "next_tab"
}
```

### get_tab_info

Get info for specific tab.

```json
{
  "command": "get_tab_info",
  "tabId": "tab-123"
}
```

---

## Code Examples

### Basic Tab Management

```javascript
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
const { tab: tab1 } = tabManager.createTab({ url: 'https://github.com' });
const { tab: tab2 } = tabManager.createTab({ url: 'https://google.com', active: false });

// Switch between tabs
tabManager.switchTab(tab2.id);

// Navigate
tabManager.navigateTab(tab1.id, 'https://github.com/explore');

// Close a tab
tabManager.closeTab(tab2.id);
```

### WebSocket Client (Python)

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

### WebSocket Client (Node.js)

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
});
```

### Session-Based Tab Isolation

```javascript
// Create tabs in different sessions
const { tab: workTab } = tabManager.createTab({
  url: 'https://work.example.com',
  sessionId: 'work'
});

const { tab: personalTab } = tabManager.createTab({
  url: 'https://personal.example.com',
  sessionId: 'personal'
});

// List only work session tabs
const workTabs = tabManager.getAllTabs({ sessionId: 'work' });
```

### Tab Persistence

```javascript
// Save tabs before closing
const state = tabManager.serialize();
fs.writeFileSync('tabs.json', JSON.stringify(state));

// Restore tabs on startup
const savedState = JSON.parse(fs.readFileSync('tabs.json', 'utf8'));
tabManager.restore(savedState);
```

---

## Configuration

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `homePage` | string | 'https://www.google.com' | Default new tab URL |
| `maxTabs` | number | 50 | Maximum tabs allowed |
| `onTabCreated` | function | no-op | Legacy callback for tab created |
| `onTabClosed` | function | no-op | Legacy callback for tab closed |
| `onTabSwitched` | function | no-op | Legacy callback for tab switched |
| `onTabUpdated` | function | no-op | Legacy callback for tab updated |

---

## Error Handling

All methods return objects with a `success` boolean:

```javascript
const result = tabManager.closeTab('invalid-id');

if (!result.success) {
  console.error('Error:', result.error);
}
```

Common errors:
- `"Tab not found"` - Tab ID doesn't exist
- `"Maximum number of tabs (N) reached"` - Cannot create more tabs
- `"Cannot close pinned tab. Unpin first."` - Tab must be unpinned
- `"Cannot go back"` / `"Cannot go forward"` - No history available
- `"No tabs available"` - No tabs exist for navigation
- `"Invalid tab index"` - Index out of range
- `"Invalid restore data"` - Malformed persistence data

---

## Best Practices

1. **Always check return values** - Tab operations can fail

2. **Use events for UI updates** - Subscribe to events for real-time changes

3. **Handle max tabs** - Check tab count before creating

4. **Use session isolation** - Different `sessionId` values for isolated contexts

5. **Clean up on shutdown** - Call `cleanup()` or `serialize()` before exit

6. **Pin important tabs** - Pinned tabs prevent accidental closure

7. **Normalize URLs** - Use `navigateTab()` for automatic URL normalization

# Automation Module Documentation

The Automation module provides powerful script execution capabilities for browser automation, including script storage, execution with helper functions, scheduling, and lifecycle management.

## Overview

The Automation module consists of three main components:

- **ScriptRunner** (`automation/runner.js`): Script execution engine with helper functions and browser context injection
- **ScriptManager** (`automation/scripts.js`): High-level script management, triggering, and lifecycle
- **ScriptStorage** (`automation/storage.js`): Persistent script storage with indexing

## Features

- Create, update, delete, and execute automation scripts
- Rich helper function library for DOM interaction
- Three trigger modes: manual, on-page-load, on-URL-match
- Script execution history tracking
- Export/Import scripts
- Persistent storage with indexing
- URL pattern matching for automatic execution

---

## API Reference

### ScriptManager

#### Constructor

```javascript
const { ScriptManager } = require('./automation/scripts');

const scriptManager = new ScriptManager({
  storagePath: '/path/to/scripts',     // Storage directory
  mainWindow: electronBrowserWindow     // Main Electron window
});
```

#### Script CRUD Operations

##### createScript(name, script, options)

Create a new automation script.

```javascript
const result = await scriptManager.createScript(
  'Login Automation',
  `
    await fill('#username', 'myuser');
    await fill('#password', 'mypass');
    await click('#login-button');
    return { loggedIn: true };
  `,
  {
    description: 'Automatically logs into the website',
    trigger: 'on-url-match',           // 'manual', 'on-load', 'on-url-match'
    urlPattern: '*://example.com/login*',
    enabled: true
  }
);

// Result:
// {
//   success: true,
//   script: {
//     id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
//     name: 'Login Automation',
//     description: 'Automatically logs into the website',
//     script: '...',
//     trigger: 'on-url-match',
//     urlPattern: '*://example.com/login*',
//     enabled: true,
//     createdAt: '2024-12-21T10:30:00.000Z',
//     updatedAt: '2024-12-21T10:30:00.000Z'
//   }
// }
```

##### updateScript(id, updates)

Update an existing script.

```javascript
const result = await scriptManager.updateScript('a1b2c3d4-e5f6-7890-abcd-ef1234567890', {
  name: 'Updated Login Script',
  script: 'await click("#new-login");',
  enabled: false
});

// Result:
// {
//   success: true,
//   script: { ... }
// }
```

##### deleteScript(id)

Delete a script.

```javascript
const result = await scriptManager.deleteScript('a1b2c3d4-e5f6-7890-abcd-ef1234567890');

// Result:
// {
//   success: true,
//   deletedId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
// }
```

##### getScript(id)

Get a script by ID.

```javascript
const result = scriptManager.getScript('a1b2c3d4-e5f6-7890-abcd-ef1234567890');

// Result:
// {
//   success: true,
//   script: { ... }
// }
```

##### listScripts(options)

List all scripts with optional filtering.

```javascript
const result = scriptManager.listScripts({
  trigger: 'on-url-match',    // Filter by trigger type
  enabled: true,              // Filter by enabled status
  sortBy: 'name',             // 'name', 'createdAt', 'updatedAt'
  sortOrder: 'asc'            // 'asc' or 'desc'
});

// Result:
// {
//   success: true,
//   scripts: [...],
//   count: 15
// }
```

#### Script Execution

##### runScript(id, context)

Execute a script manually.

```javascript
const result = await scriptManager.runScript('a1b2c3d4-e5f6-7890-abcd-ef1234567890', {
  customData: 'value'
});

// Result:
// {
//   success: true,
//   result: { loggedIn: true },
//   duration: 1250,
//   error: null
// }
```

##### enableScript(id) / disableScript(id)

Enable or disable a script for automatic execution.

```javascript
await scriptManager.enableScript('script-id');
await scriptManager.disableScript('script-id');
```

##### onPageNavigate(url)

Trigger automatic script execution for URL.

```javascript
// Called automatically on navigation, runs matching scripts
await scriptManager.onPageNavigate('https://example.com/login');
```

##### getOnLoadScripts()

Get scripts configured to run on page load.

```javascript
const scripts = scriptManager.getOnLoadScripts();
```

##### getMatchingScripts(url)

Get scripts that match a URL pattern.

```javascript
const scripts = scriptManager.getMatchingScripts('https://example.com/login');
```

#### Import/Export

##### exportScripts()

Export all scripts.

```javascript
const result = scriptManager.exportScripts();

// Result:
// {
//   success: true,
//   data: {
//     version: '1.0',
//     exportedAt: '2024-12-21T10:30:00.000Z',
//     scripts: [...]
//   }
// }
```

##### importScripts(data, overwrite)

Import scripts from exported data.

```javascript
const result = await scriptManager.importScripts(exportedData, false);

// Result:
// {
//   success: true,
//   imported: 10,
//   updated: 2,
//   skipped: 3,
//   total: 15
// }
```

---

### ScriptRunner

#### Helper Functions

Scripts have access to these helper functions:

##### DOM Selection

```javascript
// Wait for element to appear (with timeout)
const element = await waitForElement('#selector', 10000);

// Check if element exists
const exists = exists('#selector');

// Get all matching elements
const elements = queryAll('.items');
```

##### Interaction

```javascript
// Click element
await click('#button');

// Fill input field
await fill('#input', 'text value');

// Select dropdown option
await select('#dropdown', 'option-value');

// Check/uncheck checkbox
await setChecked('#checkbox', true);

// Submit form
await submit('#form');

// Focus element
await focus('#input');

// Blur element
await blur('#input');
```

##### Content Extraction

```javascript
// Get text content
const text = await getText('#element');

// Get attribute value
const href = await getAttribute('a', 'href');

// Get input value
const value = await getValue('#input');

// Get computed style
const color = await getStyle('#element', 'color');

// Get bounding rectangle
const bounds = await getBounds('#element');
```

##### Navigation & Page Info

```javascript
// Get current URL
const url = getUrl();

// Get page title
const title = getTitle();

// Scroll to element or position
await scrollTo('#element');
await scrollTo({ x: 0, y: 500 });
```

##### Visibility

```javascript
// Check if element is visible
const visible = await isVisible('#element');
```

##### Events

```javascript
// Dispatch custom event
await dispatchEvent('#element', 'click', { bubbles: true });

// Simulate key press
await pressKey('#input', 'Enter', { ctrlKey: true });
```

##### Timing

```javascript
// Wait for specified time
await wait(1000);  // 1 second
```

##### Storage

```javascript
// Store data for later use
store('myKey', { data: 'value' });

// Retrieve stored data
const data = retrieve('myKey');
```

##### Logging

```javascript
// Log message (captured in script output)
log('Step completed:', data);
```

##### Context

```javascript
// Get execution context
const context = getContext();
// { url: '...', trigger: 'manual' }
```

---

### ScriptStorage

#### Constructor

```javascript
const ScriptStorage = require('./automation/storage');

const storage = new ScriptStorage('/path/to/scripts');
```

#### Methods

| Method | Description |
|--------|-------------|
| `save(scriptData)` | Save a script to disk |
| `load(id)` | Load a script by ID |
| `loadAll()` | Load all scripts |
| `saveAll(scripts)` | Save all scripts |
| `delete(id)` | Delete a script |
| `exists(id)` | Check if script exists |
| `clearAll()` | Clear all scripts |
| `getStats()` | Get storage statistics |

---

## WebSocket Command Examples

### Create Script

```json
{
  "command": "automation.createScript",
  "params": {
    "name": "Form Filler",
    "script": "await fill('#email', 'test@example.com');",
    "description": "Fills form fields automatically",
    "trigger": "on-url-match",
    "urlPattern": "*://example.com/form*",
    "enabled": true
  }
}
```

### Update Script

```json
{
  "command": "automation.updateScript",
  "params": {
    "id": "script-uuid",
    "name": "Updated Form Filler",
    "enabled": false
  }
}
```

### Delete Script

```json
{
  "command": "automation.deleteScript",
  "params": {
    "id": "script-uuid"
  }
}
```

### Get Script

```json
{
  "command": "automation.getScript",
  "params": {
    "id": "script-uuid"
  }
}
```

### List Scripts

```json
{
  "command": "automation.listScripts",
  "params": {
    "trigger": "manual",
    "enabled": true,
    "sortBy": "name",
    "sortOrder": "asc"
  }
}
```

### Run Script

```json
{
  "command": "automation.runScript",
  "params": {
    "id": "script-uuid",
    "context": {
      "customData": "value"
    }
  }
}
```

### Enable/Disable Script

```json
{
  "command": "automation.enableScript",
  "params": {
    "id": "script-uuid"
  }
}
```

```json
{
  "command": "automation.disableScript",
  "params": {
    "id": "script-uuid"
  }
}
```

### Export Scripts

```json
{
  "command": "automation.exportScripts"
}
```

### Import Scripts

```json
{
  "command": "automation.importScripts",
  "params": {
    "data": {
      "version": "1.0",
      "scripts": [...]
    },
    "overwrite": false
  }
}
```

### Get Execution History

```json
{
  "command": "automation.getHistory",
  "params": {
    "scriptId": "script-uuid",
    "success": true,
    "limit": 50
  }
}
```

### Clear Execution History

```json
{
  "command": "automation.clearHistory"
}
```

### Get Available Helpers

```json
{
  "command": "automation.getAvailableHelpers"
}
```

---

## Code Examples

### Basic Automation Script

```javascript
// Script to extract data from a page
const items = queryAll('.product-item');
const products = [];

for (const item of items) {
  const name = await getText('.product-name');
  const price = await getText('.product-price');
  products.push({ name, price });
}

return { products, count: products.length };
```

### Login Automation

```javascript
// Wait for login form
await waitForElement('#login-form', 5000);

// Fill credentials
await fill('#username', 'myuser');
await fill('#password', 'mypassword');

// Click login
await click('#login-button');

// Wait for redirect
await wait(2000);

// Verify login success
const loggedIn = exists('.user-profile');
log('Login result:', loggedIn);

return { success: loggedIn, url: getUrl() };
```

### Form Filling with Validation

```javascript
// Get context data
const ctx = getContext();
const userData = ctx.userData || {};

// Fill form fields
await fill('#first-name', userData.firstName || 'John');
await fill('#last-name', userData.lastName || 'Doe');
await fill('#email', userData.email || 'john@example.com');

// Select country
await select('#country', 'US');

// Accept terms
await setChecked('#terms', true);

// Validate form
const submitEnabled = !(await getAttribute('#submit', 'disabled'));

if (submitEnabled) {
  await submit('#registration-form');
  return { submitted: true };
}

return { submitted: false, reason: 'Submit button disabled' };
```

### Data Extraction

```javascript
// Wait for content to load
await waitForElement('.data-table', 10000);

// Extract table data
const rows = queryAll('.data-table tbody tr');
const data = [];

for (let i = 0; i < rows.length; i++) {
  const cells = queryAll(`.data-table tbody tr:nth-child(${i + 1}) td`);
  const row = {};

  row.id = await getText(`.data-table tbody tr:nth-child(${i + 1}) td:nth-child(1)`);
  row.name = await getText(`.data-table tbody tr:nth-child(${i + 1}) td:nth-child(2)`);
  row.value = await getText(`.data-table tbody tr:nth-child(${i + 1}) td:nth-child(3)`);

  data.push(row);
}

// Store for later use
store('extractedData', data);

return { rowCount: data.length, data };
```

### Multi-Page Navigation

```javascript
// Navigate through pagination
let allItems = [];
let page = 1;
const maxPages = 5;

while (page <= maxPages) {
  log(`Processing page ${page}`);

  // Wait for items
  await waitForElement('.item-list', 5000);

  // Extract items
  const items = queryAll('.item-list .item');
  for (let i = 0; i < items.length; i++) {
    const title = await getText(`.item-list .item:nth-child(${i + 1}) .title`);
    allItems.push(title);
  }

  // Check for next page
  const hasNext = exists('.pagination .next:not(.disabled)');
  if (!hasNext) break;

  // Go to next page
  await click('.pagination .next');
  await wait(1500);
  page++;
}

return { totalItems: allItems.length, items: allItems };
```

---

## Configuration Options

### Trigger Types

| Type | Description |
|------|-------------|
| `manual` | Only executed when explicitly triggered |
| `on-load` | Executed on every page load |
| `on-url-match` | Executed when URL matches pattern |

### URL Pattern Syntax

| Pattern | Matches |
|---------|---------|
| `*` | Any characters |
| `*://example.com/*` | All pages on example.com |
| `*://*/login*` | Any login page |
| `/regex/flags` | Regular expression pattern |

### Script Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique identifier (UUID) |
| `name` | string | Script name |
| `description` | string | Script description |
| `script` | string | JavaScript code to execute |
| `trigger` | string | Trigger type |
| `urlPattern` | string | URL pattern for on-url-match |
| `enabled` | boolean | Whether script is active for auto-run |
| `createdAt` | string | ISO timestamp |
| `updatedAt` | string | ISO timestamp |

### Execution Context

Scripts receive context with:

| Property | Description |
|----------|-------------|
| `url` | Current page URL (if available) |
| `trigger` | What triggered execution (manual, on-load, on-url-match) |
| `...custom` | Any custom data passed via runScript |

### Execution Limits

- Script timeout: 60 seconds
- Maximum history size: 100 entries per runner instance

---

## Storage Format

### Script File (uuid.json)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Login Script",
  "description": "Automatic login",
  "script": "await fill('#user', 'test');",
  "trigger": "on-url-match",
  "urlPattern": "*://example.com/login*",
  "enabled": true,
  "createdAt": "2024-12-21T10:30:00.000Z",
  "updatedAt": "2024-12-21T10:30:00.000Z"
}
```

### Index File (scripts-index.json)

```json
{
  "scripts": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "b2c3d4e5-f6a7-8901-bcde-f12345678901"
  ],
  "updatedAt": "2024-12-21T10:30:00.000Z"
}
```

---

## Error Handling

### Script Errors

```javascript
// Scripts can throw errors which are captured
try {
  await waitForElement('#nonexistent', 1000);
} catch (error) {
  log('Element not found, using fallback');
  // Handle gracefully
}

// Or let error propagate
if (!exists('#required')) {
  throw new Error('Required element not found');
}
```

### Execution Result

```json
{
  "success": false,
  "error": "Element not found: #required",
  "stack": "Error: Element not found...",
  "logs": [
    { "time": "2024-12-21T10:30:00.000Z", "args": ["Starting script..."] }
  ],
  "duration": 1250
}
```

---

## Best Practices

1. **Use waitForElement**: Always wait for elements before interacting
2. **Add timeouts**: Use reasonable timeouts for waitForElement
3. **Handle errors**: Use try/catch for graceful error handling
4. **Log progress**: Use log() to track script execution
5. **Store intermediate data**: Use store/retrieve for multi-step workflows
6. **Test incrementally**: Build and test scripts in small pieces
7. **Use descriptive names**: Name scripts and add descriptions
8. **Set appropriate triggers**: Use on-url-match for site-specific scripts

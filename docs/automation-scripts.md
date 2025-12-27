# Automation Scripts

This document describes the page automation script support system for the Basset Hound Browser.

## Overview

The automation scripts feature allows you to:
- Create and save JavaScript automation scripts
- Run scripts manually or automatically based on triggers
- Execute scripts on page load or when URLs match patterns
- Use built-in helper functions for common automation tasks

## Architecture

The system consists of three main components:

1. **ScriptManager** (`automation/scripts.js`) - Manages script CRUD operations and coordinates execution
2. **ScriptStorage** (`automation/storage.js`) - Handles persistence of scripts to disk
3. **ScriptRunner** (`automation/runner.js`) - Executes scripts in the browser context with helper functions

## Script Structure

Each automation script has the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique identifier (UUID) |
| `name` | string | Script name |
| `description` | string | Optional description |
| `script` | string | JavaScript code to execute |
| `trigger` | string | When to run: `manual`, `on-load`, `on-url-match` |
| `urlPattern` | string | URL pattern for `on-url-match` trigger |
| `enabled` | boolean | Whether auto-run is enabled |
| `createdAt` | string | ISO timestamp of creation |
| `updatedAt` | string | ISO timestamp of last update |

## Trigger Types

### Manual (`manual`)
Script only runs when explicitly invoked via `run_script` command.

### On Page Load (`on-load`)
Script runs automatically on every page load when enabled.

### On URL Match (`on-url-match`)
Script runs when the navigated URL matches the specified pattern. Patterns support:
- Glob patterns: `*` matches any characters, `?` matches single character
- Regular expressions: Wrap in slashes like `/pattern/flags`

**Examples:**
- `*google.com*` - Matches any URL containing "google.com"
- `https://example.com/*` - Matches any page on example.com
- `/^https:\/\/.*\.github\.com\//i` - Regex matching GitHub subdomains

## API Reference

### WebSocket Commands

All commands are sent via WebSocket with JSON payload:

```json
{
  "command": "command_name",
  "id": "request-id",
  "param1": "value1"
}
```

#### create_script
Create a new automation script.

**Parameters:**
- `name` (required): Script name
- `script` (required): JavaScript code
- `options`: Object with optional fields:
  - `description`: Script description
  - `trigger`: Trigger type (`manual`, `on-load`, `on-url-match`)
  - `urlPattern`: URL pattern for matching
  - `enabled`: Whether auto-run is enabled

**Response:**
```json
{
  "success": true,
  "script": { /* script object */ }
}
```

#### update_script
Update an existing script.

**Parameters:**
- `id` (required): Script ID
- `updates`: Object with fields to update

#### delete_script
Delete a script.

**Parameters:**
- `id` (required): Script ID

#### get_script
Get script details.

**Parameters:**
- `id` (required): Script ID

#### list_scripts
List all scripts.

**Parameters:**
- `trigger`: Filter by trigger type
- `enabled`: Filter by enabled status
- `sortBy`: Sort field (`name`, `createdAt`, `updatedAt`)
- `sortOrder`: Sort direction (`asc`, `desc`)

#### run_script
Execute a script manually.

**Parameters:**
- `id` (required): Script ID
- `context`: Optional context object passed to script

#### enable_script
Enable auto-run for a script.

**Parameters:**
- `id` (required): Script ID

#### disable_script
Disable auto-run for a script.

**Parameters:**
- `id` (required): Script ID

#### export_scripts
Export all scripts as JSON.

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "1.0",
    "exportedAt": "ISO-timestamp",
    "scripts": [ /* array of scripts */ ]
  }
}
```

#### import_scripts
Import scripts from JSON data.

**Parameters:**
- `data` (required): Exported scripts data
- `overwrite`: Whether to overwrite existing scripts with same ID

#### get_script_context
Get available helper functions and context.

#### get_script_history
Get script execution history.

**Parameters:**
- `scriptId`: Filter by script ID
- `success`: Filter by success status
- `limit`: Maximum entries to return

### Renderer API (preload.js)

Scripts can also be managed from the renderer process:

```javascript
// Create a script
await electronAPI.createScript('My Script', 'console.log("Hello");', {
  trigger: 'manual',
  description: 'A simple test script'
});

// List all scripts
const result = await electronAPI.listScripts();
console.log(result.scripts);

// Run a script
await electronAPI.runScript('script-id', { customData: 'value' });

// Export scripts
const exported = await electronAPI.exportScripts();

// Import scripts
await electronAPI.importScripts(exported.data, false);
```

## Helper Functions

Scripts have access to these helper functions:

### DOM Interaction

#### waitForElement(selector, timeout?)
Wait for an element to appear in the DOM.
- `selector`: CSS selector
- `timeout`: Timeout in milliseconds (default: 10000)
- Returns: Promise resolving to the element

#### click(selector)
Click an element.
- `selector`: CSS selector
- Returns: Promise with result object

#### fill(selector, value)
Fill an input field.
- `selector`: CSS selector
- `value`: Value to fill
- Returns: Promise with result object

#### getText(selector)
Get text content of an element.
- `selector`: CSS selector
- Returns: Promise resolving to text content

#### getAttribute(selector, attribute)
Get an attribute value from an element.
- `selector`: CSS selector
- `attribute`: Attribute name
- Returns: Promise resolving to attribute value

#### exists(selector)
Check if an element exists.
- `selector`: CSS selector
- Returns: boolean

#### queryAll(selector)
Get all elements matching selector.
- `selector`: CSS selector
- Returns: Array of elements

### Form Interaction

#### getValue(selector)
Get value of an input element.
- `selector`: CSS selector
- Returns: Promise resolving to value

#### select(selector, value)
Select an option in a dropdown.
- `selector`: CSS selector for select element
- `value`: Value to select

#### setChecked(selector, checked?)
Check or uncheck a checkbox.
- `selector`: CSS selector
- `checked`: Whether to check (default: true)

#### submit(selector)
Submit a form.
- `selector`: CSS selector for form or submit button

### Navigation & Page Info

#### getUrl()
Get current page URL.
- Returns: string

#### getTitle()
Get page title.
- Returns: string

#### scrollTo(target)
Scroll to element or position.
- `target`: CSS selector or `{x, y}` object

### Keyboard & Events

#### pressKey(selector, key, options?)
Simulate keyboard input.
- `selector`: CSS selector
- `key`: Key to press
- `options`: KeyboardEvent options

#### dispatchEvent(selector, eventType, eventInit?)
Dispatch a custom event.
- `selector`: CSS selector
- `eventType`: Event type
- `eventInit`: Event initialization options

### Utility Functions

#### wait(ms)
Wait for specified time.
- `ms`: Milliseconds to wait

#### focus(selector)
Focus an element.
- `selector`: CSS selector

#### blur(selector)
Unfocus an element.
- `selector`: CSS selector

#### isVisible(selector)
Check if element is visible.
- `selector`: CSS selector
- Returns: boolean

#### getBounds(selector)
Get element bounding rectangle.
- `selector`: CSS selector
- Returns: DOMRect

#### getStyle(selector, property)
Get computed style value.
- `selector`: CSS selector
- `property`: CSS property name
- Returns: string

### Storage

#### store(key, value)
Store data in session storage.
- `key`: Storage key
- `value`: Value to store

#### retrieve(key)
Retrieve data from session storage.
- `key`: Storage key
- Returns: Stored value or null

### Logging

#### log(...args)
Log messages (captured in script output).

#### getContext()
Get execution context object.
- Returns: Object with URL, trigger info, etc.

#### screenshot()
Request a screenshot (returns indicator object).

## Example Scripts

### Auto-fill Login Form

```javascript
// Wait for login form to load
await waitForElement('#login-form');

// Fill credentials
await fill('#username', 'myuser');
await fill('#password', 'mypassword');

// Submit form
await click('#login-button');

log('Login form submitted');
```

### Extract Page Data

```javascript
// Wait for content to load
await waitForElement('.article-content');

// Get article data
const title = await getText('h1.title');
const content = await getText('.article-content');
const author = await getText('.author-name');

// Return extracted data
return {
  title,
  content,
  author,
  url: getUrl(),
  extractedAt: new Date().toISOString()
};
```

### Auto-Accept Cookies

```javascript
// Check for cookie consent dialogs
const cookieSelectors = [
  '#cookie-accept',
  '.cookie-consent-accept',
  '[data-action="accept-cookies"]',
  '.accept-cookies-button'
];

for (const selector of cookieSelectors) {
  if (exists(selector)) {
    await click(selector);
    log(`Clicked cookie accept button: ${selector}`);
    break;
  }
}
```

### Wait for Dynamic Content

```javascript
// Wait for loading spinner to disappear
await waitForElement('.loading-spinner', 1000)
  .catch(() => null); // Ignore if already gone

// Wait for actual content
await waitForElement('.content-loaded');

// Now interact with loaded content
const items = queryAll('.item');
log(`Found ${items.length} items`);
```

## Storage

Scripts are stored in the `automation/saved/` directory as individual JSON files. The directory structure is:

```
automation/
  saved/
    scripts-index.json    # Index file listing all script IDs
    <script-id>.json      # Individual script files
```

## Error Handling

Script execution errors are captured and returned in the response:

```json
{
  "success": false,
  "error": "Error message",
  "stack": "Error stack trace"
}
```

Script execution has a 60-second timeout. If a script exceeds this, it will be terminated with a timeout error.

## Best Practices

1. **Use descriptive names**: Make script names clear and meaningful
2. **Add descriptions**: Document what each script does
3. **Handle errors gracefully**: Use try/catch in scripts
4. **Avoid infinite loops**: Be careful with while loops
5. **Use appropriate triggers**: Only use `on-load` when necessary
6. **Test URL patterns**: Verify patterns match expected URLs
7. **Log important actions**: Use `log()` for debugging
8. **Return meaningful data**: Return results for tracking

## Limitations

- Scripts run in the page context (not Node.js)
- 60-second execution timeout
- Cannot access local filesystem directly
- Cross-origin restrictions apply
- Some sites may detect automation

# DOM Snapshot Extraction (v12.8.0)

## Overview

Complete DOM Snapshot Extraction is a comprehensive data extraction feature that provides 7 new WebSocket commands for exporting complete DOM state including tree structure, computed styles, form states, text content, attributes, event listeners, and mutation history.

## Feature Summary

| Command | Purpose | Use Case |
|---------|---------|----------|
| `export_dom_tree` | Full DOM tree structure with all properties | Page analysis, structure verification |
| `export_dom_computed_styles` | Computed CSS styles for all elements | Visual layout analysis, styling verification |
| `export_dom_form_state` | All form fields and their current values | Form analysis, data extraction |
| `export_dom_text_content` | Text content with structural information | Text mining, content extraction |
| `export_dom_attributes` | All HTML attributes for elements | Metadata extraction, data attributes |
| `export_dom_event_listeners` | Registered JavaScript event handlers | Interactivity analysis, security audit |
| `export_dom_mutations` | History of DOM changes | Page interaction analysis, debugging |

## Implementation Details

### Architecture

```
WebSocket Server
    ├── dom-snapshot-commands.js (Command handlers)
    └── dom-snapshot.js (Core extraction logic)
        ├── generateDOMTreeScript()
        ├── generateComputedStylesScript()
        ├── generateFormStateScript()
        ├── generateTextContentScript()
        ├── generateAttributesScript()
        ├── generateEventListenersScript()
        ├── generateMutationTrackerScript()
        └── ...
```

### Key Files

- **Core Module**: `/src/extraction/dom-snapshot.js` (407 lines)
  - `DOMSnapshotManager` class with 9 generation methods
  - Generates browser-executable JavaScript for each extraction type
  - Handles parameter validation and defaults

- **WebSocket Commands**: `/websocket/commands/dom-snapshot-commands.js` (359 lines)
  - `registerDOMSnapshotCommands()` - Registration function
  - 7 async command handlers
  - Error handling and logging

- **Unit Tests**: `/tests/unit/dom-snapshot-commands.test.js` (43 tests, 100% pass)
  - Script generation validation
  - Parameter handling
  - Edge cases and safety checks

- **Handler Tests**: `/tests/unit/dom-snapshot-handlers.test.js` (26 tests, 100% pass)
  - Command registration
  - Handler execution
  - Error scenarios
  - Parameter validation

## Command Reference

### 1. export_dom_tree

Extracts the complete DOM tree structure with all properties for every element.

**Parameters:**
- `maxDepth` (number, default: 50) - Maximum tree depth to traverse
- `includeText` (boolean, default: true) - Include text node content
- `includeComments` (boolean, default: false) - Include HTML comments

**Response:**
```javascript
{
  success: true,
  timestamp: "2026-06-20T12:00:00.000Z",
  url: "https://example.com",
  documentTitle: "Page Title",
  bodyClasses: "dark-mode",
  tree: {
    type: "element",
    tagName: "html",
    id: null,
    className: "",
    attributes: {...},
    styles: {
      display: "block",
      visibility: "visible",
      // ... key CSS properties
    },
    rect: {x, y, width, height, top, left, bottom, right},
    isVisible: true,
    children: [...]
  }
}
```

**Example Usage:**
```javascript
ws.send(JSON.stringify({
  command: 'export_dom_tree',
  params: {
    maxDepth: 30,
    includeText: true
  }
}));
```

### 2. export_dom_computed_styles

Extracts computed CSS styles for all elements matching a selector.

**Parameters:**
- `selector` (string, default: "*") - CSS selector for elements
- `limit` (number, default: 5000) - Maximum elements to process

**Response:**
```javascript
{
  success: true,
  timestamp: "2026-06-20T12:00:00.000Z",
  selector: "*",
  totalElements: 250,
  processedCount: 250,
  styles: [
    {
      selector: "body > div.container",
      tagName: "div",
      id: null,
      className: "container",
      computedStyles: {
        display: "flex",
        visibility: "visible",
        position: "relative",
        width: "1200px",
        // ... key CSS properties
      },
      rect: {x, y, width, height},
      isVisible: true
    },
    // ... more elements
  ]
}
```

**Example Usage:**
```javascript
// Get styles for all buttons
ws.send(JSON.stringify({
  command: 'export_dom_computed_styles',
  params: {
    selector: 'button',
    limit: 100
  }
}));
```

### 3. export_dom_form_state

Extracts all form elements and their current state.

**Parameters:**
- None (applies to all forms on page)

**Response:**
```javascript
{
  success: true,
  timestamp: "2026-06-20T12:00:00.000Z",
  formsCount: 2,
  forms: [
    {
      id: "login-form",
      name: "loginForm",
      method: "POST",
      action: "/login",
      enctype: "application/x-www-form-urlencoded",
      fields: [
        {
          type: "input",
          name: "email",
          id: "email-field",
          inputType: "text",
          label: "Email Address",
          value: "user@example.com",
          checked: null,
          disabled: false,
          required: true,
          readonly: false
        },
        {
          type: "input",
          name: "password",
          id: "password-field",
          inputType: "password",
          label: "Password",
          value: null, // Not captured for security
          checked: null,
          disabled: false,
          required: true,
          readonly: false
        },
        {
          type: "input",
          name: "remember",
          inputType: "checkbox",
          label: null,
          value: null,
          checked: false,
          disabled: false,
          required: false
        },
        {
          type: "select",
          name: "country",
          options: [
            {value: "us", text: "United States", selected: true},
            {value: "ca", text: "Canada", selected: false}
          ],
          value: "us"
        }
      ]
    }
  ]
}
```

**Security Notes:**
- Password fields (`type="password"`) do not capture values
- File input fields (`type="file"`) do not capture values
- Other sensitive fields should be handled appropriately

### 4. export_dom_text_content

Extracts all text content with structural information.

**Parameters:**
- `includeWhitespace` (boolean, default: false) - Include whitespace-only text nodes

**Response:**
```javascript
{
  success: true,
  timestamp: "2026-06-20T12:00:00.000Z",
  totalTextElements: 342,
  textElements: [
    {
      text: "Welcome to our website",
      tagName: "h1",
      id: "main-title",
      className: "header-title",
      selector: "#main-title",
      xPath: "/html[1]/body[1]/div[1]/h1[1]",
      rect: {
        x: 0,
        y: 50,
        width: 400,
        height: 40
      }
    },
    {
      text: "This is the main content paragraph.",
      tagName: "p",
      className: "intro",
      selector: ".intro",
      xPath: "/html[1]/body[1]/div[1]/p[1]",
      rect: {x: 0, y: 100, width: 600, height: 60}
    }
  ]
}
```

**Performance:**
- Capped at 10,000 text elements to prevent memory issues
- Text truncated to 1000 characters max per element
- Filters out invisible elements

### 5. export_dom_attributes

Extracts all HTML attributes for elements.

**Parameters:**
- `selector` (string, default: "*") - CSS selector for elements
- `limit` (number, default: 5000) - Maximum elements to process

**Response:**
```javascript
{
  success: true,
  timestamp: "2026-06-20T12:00:00.000Z",
  selector: "*",
  totalElements: 1250,
  processedCount: 1250,
  attributes: [
    {
      tagName: "a",
      id: "nav-link-1",
      className: "nav-link active",
      attributes: {
        href: "/about",
        title: "About Us",
        "data-section": "about",
        "data-analytics": "nav_click",
        rel: "noopener noreferrer"
      }
    },
    {
      tagName: "img",
      id: "logo",
      className: "logo",
      attributes: {
        src: "/images/logo.png",
        alt: "Company Logo",
        width: "200",
        height: "50",
        loading: "lazy"
      }
    }
  ]
}
```

### 6. export_dom_event_listeners

Discovers and reports registered event listeners.

**Parameters:**
- None

**Response:**
```javascript
{
  success: true,
  timestamp: "2026-06-20T12:00:00.000Z",
  elementsWithListeners: 12,
  note: "Browser security restrictions limit listener discovery to attributes and properties",
  listeners: [
    {
      tagName: "button",
      id: "submit-btn",
      className: "btn btn-primary",
      events: [
        {
          event: "click",
          type: "attribute",
          handler: "submitForm(this)"
        }
      ]
    },
    {
      tagName: "input",
      id: "search-input",
      className: null,
      events: [
        {event: "input", type: "attribute", handler: "updateSearch(this.value)"},
        {event: "focus", type: "property"}
      ]
    }
  ]
}
```

**Limitations:**
- Browser security restrictions prevent direct access to all event listeners
- Only detects:
  - HTML attribute handlers (`onclick`, `onchange`, etc.)
  - Property-based handlers (`element.onclick`, etc.)
  - Does NOT detect listeners added via `addEventListener()`

### 7. export_dom_mutations

Tracks and retrieves DOM changes since tracking was initialized.

**Parameters:**
- `action` (string, default: "get") - "init", "get", or "stop"
  - `init` - Initialize mutation tracking
  - `get` - Retrieve accumulated mutations
  - `stop` - Stop tracking and report final count

**Response (init):**
```javascript
{
  success: true,
  timestamp: "2026-06-20T12:00:00.000Z",
  action: "init",
  message: "Mutation tracker initialized"
}
```

**Response (get):**
```javascript
{
  success: true,
  timestamp: "2026-06-20T12:00:00.000Z",
  action: "get",
  mutationCount: 15,
  mutations: [
    {
      type: "childList",
      targetTagName: "div",
      targetId: "container",
      targetClassName: "content",
      timestamp: "2026-06-20T12:00:00.100Z",
      addedNodes: 3,
      removedNodes: 0,
      attributeName: null,
      oldValue: null
    },
    {
      type: "attributes",
      targetTagName: "button",
      targetId: "submit",
      targetClassName: null,
      timestamp: "2026-06-20T12:00:00.150Z",
      addedNodes: 0,
      removedNodes: 0,
      attributeName: "disabled",
      oldValue: null
    }
  ]
}
```

**Mutation Tracking Workflow:**

```javascript
// Step 1: Initialize tracking
ws.send(JSON.stringify({
  command: 'export_dom_mutations',
  params: {action: 'init'}
}));

// Step 2: Let user interact with page
// ... (perform actions that change the DOM)

// Step 3: Retrieve mutations
ws.send(JSON.stringify({
  command: 'export_dom_mutations',
  params: {action: 'get'}
}));

// Step 4: Stop tracking
ws.send(JSON.stringify({
  command: 'export_dom_mutations',
  params: {action: 'stop'}
}));
```

## Usage Patterns

### Pattern 1: Complete Page Analysis

Extract everything about a page:

```javascript
async function analyzePage() {
  const results = {
    tree: await sendCommand('export_dom_tree'),
    styles: await sendCommand('export_dom_computed_styles'),
    forms: await sendCommand('export_dom_form_state'),
    text: await sendCommand('export_dom_text_content'),
    attributes: await sendCommand('export_dom_attributes'),
    listeners: await sendCommand('export_dom_event_listeners')
  };
  return results;
}
```

### Pattern 2: Form State Tracking

Capture form state before and after interaction:

```javascript
async function trackFormChanges() {
  // Get initial state
  const initialState = await sendCommand('export_dom_form_state');
  
  // User interacts...
  // ...
  
  // Get final state
  const finalState = await sendCommand('export_dom_form_state');
  
  // Compare and analyze changes
  return {initial: initialState, final: finalState};
}
```

### Pattern 3: DOM Change Monitoring

Monitor DOM modifications during page interaction:

```javascript
async function monitorDOMChanges() {
  // Initialize tracking
  await sendCommand('export_dom_mutations', {action: 'init'});
  
  // Wait for interactions or delay
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Get mutations
  const mutations = await sendCommand('export_dom_mutations', {action: 'get'});
  
  // Stop tracking
  await sendCommand('export_dom_mutations', {action: 'stop'});
  
  return mutations;
}
```

### Pattern 4: Targeted Element Analysis

Analyze specific elements:

```javascript
async function analyzeButtons() {
  const styles = await sendCommand('export_dom_computed_styles', {
    selector: 'button',
    limit: 100
  });
  
  const attributes = await sendCommand('export_dom_attributes', {
    selector: 'button'
  });
  
  const listeners = await sendCommand('export_dom_event_listeners');
  const buttonListeners = listeners.listeners.filter(l => l.tagName === 'button');
  
  return {styles, attributes, listeners: buttonListeners};
}
```

## Performance Characteristics

### Extraction Latency

| Command | Typical Latency | Max Elements | Notes |
|---------|-----------------|--------------|-------|
| `export_dom_tree` | 100-500ms | 50 depth | Scales with depth/size |
| `export_dom_computed_styles` | 200-800ms | 5,000 | Network + JS execution |
| `export_dom_form_state` | 50-200ms | All forms | Usually <20 forms |
| `export_dom_text_content` | 150-600ms | 10,000 | Text walking overhead |
| `export_dom_attributes` | 200-700ms | 5,000 | Network + JS execution |
| `export_dom_event_listeners` | 100-400ms | 5,000 | Property inspection |
| `export_dom_mutations` | <10ms | 1,000 | In-memory retrieval |

### Memory Usage

- Tree extraction: ~10-50MB (depends on tree size)
- Styles extraction: ~5-20MB
- Form state: <1MB (usually)
- Text content: ~20-100MB (worst case with 10k elements)
- Attributes: ~10-40MB
- Event listeners: ~5-15MB
- Mutations: ~0.5-5MB (max 1000 mutations)

### Optimization Tips

1. **Use selectors to limit scope**: Instead of `*`, use `input`, `button`, etc.
2. **Set appropriate limits**: Cap processing to only needed elements
3. **Monitor tree depth**: Reduce maxDepth for large documents
4. **Batch mutations**: Don't call frequently; wait for action completion
5. **Clear old data**: Use mutation `stop` to limit history size

## Integration with Existing Commands

DOM Snapshot commands complement existing extraction capabilities:

- `get_content` - Gets raw HTML; DOM Snapshot provides structured analysis
- `get_text` - Gets all text; `export_dom_text_content` adds positioning
- `screenshot_*` - Visual captures; DOM Snapshot provides interaction data
- `export_raw_html` - Serialized HTML; DOM Snapshot provides computed properties

## Error Handling

All commands return consistent error responses:

```javascript
{
  success: false,
  error: "Descriptive error message",
  timestamp: "2026-06-20T12:00:00.000Z"
}
```

Common error scenarios:

- **"Window or webContents not available"** - Electron window not ready
- **"Extraction failed"** - JavaScript execution failed in browser
- **"Timeout"** - Command took too long (adjust parameters)
- **"Memory exceeded"** - Too many elements selected (reduce limit)

## Security Considerations

1. **Password fields excluded** - Never captured for security
2. **File inputs excluded** - Path disclosure prevention
3. **Sensitive attributes** - Consider with data:* attributes
4. **XPath generation** - Reveals page structure
5. **Text content** - May contain personal information
6. **Event handlers** - May reveal application logic

## Testing

The implementation includes 69 unit tests:

### Unit Tests (43 tests)
- Script generation validation
- Parameter handling
- Edge cases
- Data safety
- Performance tuning

### Handler Tests (26 tests)
- Command registration
- Parameter validation
- Error handling
- Mock browser execution
- Consistent responses

### Run Tests
```bash
npm test -- tests/unit/dom-snapshot-commands.test.js
npm test -- tests/unit/dom-snapshot-handlers.test.js
```

## Related Documentation

- [WebSocket API Reference](./API-REFERENCE.md) - All WebSocket commands
- [Extraction Overview](architecture/SCOPE.md#extraction) - Data extraction capabilities
- [Browser Automation](./API-REFERENCE.md#navigation) - Navigation and interaction

## Version History

- **v12.8.0** (2026-06-20) - Initial release
  - 7 new WebSocket commands
  - 407 lines core extraction logic
  - 359 lines command handlers
  - 69 comprehensive tests
  - Complete API documentation

## Future Enhancements

Potential improvements in future versions:

- [ ] CSS shadow DOM extraction
- [ ] Event listener enumeration (overcoming browser security)
- [ ] Performance metrics per element
- [ ] Diff-based mutation reporting
- [ ] Streaming responses for large extractions
- [ ] Compression for text content
- [ ] XPath alternative (CSS selectors)
- [ ] Accessibility tree extraction
- [ ] Cached extraction (compare to previous state)

---

**Status**: Production Ready (v12.8.0)
**Test Coverage**: 100% (69/69 tests passing)
**Lines of Code**: 766 (core + handlers)

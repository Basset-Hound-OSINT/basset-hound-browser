# DOM Inspector

The DOM Inspector module provides comprehensive DOM inspection, element analysis, and CSS selector generation capabilities for the Basset Hound Browser. This is essential for web automation and OSINT tasks.

## Overview

The DOM Inspector consists of three main components:

1. **DOMInspector** (`inspector/manager.js`) - Main inspector class that coordinates DOM analysis
2. **SelectorGenerator** (`inspector/selector-generator.js`) - Generates optimal CSS selectors and XPath
3. **ElementHighlighter** (`inspector/highlighter.js`) - Visual highlighting of DOM elements

## Installation

The DOM Inspector is automatically loaded with the browser. No additional installation is required.

## WebSocket Commands

### inspect_element

Get detailed information about an element.

```json
{
  "command": "inspect_element",
  "selector": "#myElement"
}
```

**Response:**
```json
{
  "success": true,
  "element": {
    "tagName": "DIV",
    "id": "myElement",
    "classes": ["container", "main"],
    "attributes": { "data-testid": "main-container" },
    "textContent": "Content here...",
    "rect": { "top": 100, "left": 50, "width": 800, "height": 600 },
    "isVisible": true,
    "childCount": 5,
    "path": [...]
  }
}
```

### get_element_tree

Get the DOM subtree starting from an element.

```json
{
  "command": "get_element_tree",
  "selector": "body",
  "depth": 3
}
```

**Parameters:**
- `selector` (required): CSS selector for the root element
- `depth` (optional): Maximum depth to traverse (default: 3)

### get_element_styles

Get computed and inline styles for an element.

```json
{
  "command": "get_element_styles",
  "selector": "#myElement"
}
```

**Response:**
```json
{
  "success": true,
  "computed": {
    "display": "flex",
    "color": "rgb(0, 0, 0)",
    "font-size": "16px"
  },
  "inline": {
    "margin-top": "10px"
  }
}
```

### get_element_attributes

Get all attributes for an element, categorized by type.

```json
{
  "command": "get_element_attributes",
  "selector": "#myElement"
}
```

**Response:**
```json
{
  "success": true,
  "standard": { "id": "myElement", "class": "container" },
  "data": { "data-testid": "main", "data-value": "42" },
  "aria": { "aria-label": "Main content" },
  "events": { "onclick": "[event handler]" },
  "properties": { "value": "input value", "checked": true }
}
```

### generate_selector

Generate multiple CSS selector variants for an element.

```json
{
  "command": "generate_selector",
  "selector": "#myElement"
}
```

**Response:**
```json
{
  "success": true,
  "selectors": {
    "optimal": "#myElement",
    "id": "#myElement",
    "class": "div.container.main",
    "xpath": "//div[@id=\"myElement\"]",
    "nthChild": "body > div:nth-child(2) > div:nth-child(1)",
    "full": "#myElement"
  },
  "optimalUnique": true
}
```

### highlight_element

Add visual highlight to an element.

```json
{
  "command": "highlight_element",
  "selector": "#myElement",
  "color": "red"
}
```

**Parameters:**
- `selector` (required): CSS selector
- `color` (optional): Highlight color (name or hex)

**Available colors:** red, green, blue, yellow, orange, purple, cyan, magenta

### remove_highlight

Remove all visual highlights.

```json
{
  "command": "remove_highlight"
}
```

### find_elements

Search for elements by various criteria.

```json
{
  "command": "find_elements",
  "selector": "button",
  "text": "Submit",
  "visibleOnly": true,
  "limit": 50
}
```

**Parameters:**
- `selector` (optional): CSS selector
- `tagName` (optional): HTML tag name
- `text` (optional): Text content to search for
- `attribute` (optional): Attribute name to search
- `attributeValue` (optional): Attribute value to match
- `xpath` (optional): XPath expression
- `visibleOnly` (optional): Only return visible elements
- `limit` (optional): Maximum results (default: 100)
- `exact` (optional): Exact text match instead of contains

### get_element_parent

Get the parent element.

```json
{
  "command": "get_element_parent",
  "selector": "#childElement"
}
```

### get_element_children

Get all child elements.

```json
{
  "command": "get_element_children",
  "selector": "#parentElement"
}
```

### get_element_siblings

Get sibling elements (elements with the same parent).

```json
{
  "command": "get_element_siblings",
  "selector": "#element"
}
```

## Renderer API

The preload script exposes DOM Inspector methods through `window.electronAPI`:

```javascript
// Inspect element
const result = await electronAPI.inspectElement('#myElement');

// Get DOM tree
const tree = await electronAPI.getElementTree('body', 3);

// Get styles
const styles = await electronAPI.getElementStyles('#myElement');

// Get attributes
const attrs = await electronAPI.getElementAttributes('#myElement');

// Generate selector
const selectors = await electronAPI.generateSelector('#myElement');

// Highlight element
await electronAPI.highlightElement('#myElement', 'orange');

// Remove highlights
await electronAPI.removeHighlight();

// Find elements
const elements = await electronAPI.findElements({
  tagName: 'button',
  visibleOnly: true
});

// Get parent/children/siblings
const parent = await electronAPI.getElementParent('#child');
const children = await electronAPI.getElementChildren('#parent');
const siblings = await electronAPI.getElementSiblings('#element');

// Get interactive elements
const interactive = await electronAPI.getInteractiveElements('body');

// Get form data
const formData = await electronAPI.getFormData('#myForm');
```

## Selector Generation

The SelectorGenerator creates optimal CSS selectors using the following priority:

1. **ID-based** (`#elementId`) - Most reliable if available
2. **Data attributes** (`[data-testid="value"]`) - Common in modern apps
3. **Class-based** (`tag.class1.class2`) - When classes are specific
4. **Attribute-based** (`[name="value"]`) - For form elements
5. **Full path** (`parent > child:nth-child(n)`) - Fallback for complex cases

### Selector Types Generated

- `optimal` - Best single selector for the element
- `id` - ID-based selector (if element has ID)
- `class` - Class-based selector
- `xpath` - XPath expression
- `nthChild` - Position-based CSS selector
- `full` - Complete path from nearest ancestor with ID

## Element Highlighting

The highlighter provides visual feedback during inspection:

```javascript
// Highlight with default orange color
await electronAPI.highlightElement('#element');

// Highlight with custom color
await electronAPI.highlightElement('#element', 'blue');

// Highlight multiple elements
await electronAPI.highlightMultiple(['#el1', '#el2', '.buttons']);

// Configure highlight style
await electronAPI.setHighlightStyle({
  backgroundColor: 'rgba(0, 255, 0, 0.3)',
  borderColor: '#00ff00',
  borderWidth: 3,
  opacity: 0.5
});
```

### Highlight Features

- Overlay appears above the element without affecting layout
- Shows element info tooltip (tag, id, class)
- Automatically follows scroll position
- Different colors for multiple highlights
- Pulsing animation option for attention

## Use Cases

### Web Scraping

```javascript
// Find all product cards
const products = await electronAPI.findElements({
  selector: '.product-card',
  visibleOnly: true
});

// Generate reliable selector for automation
const selectors = await electronAPI.generateSelector('.product-card:first-child');
console.log(selectors.optimal);
```

### Form Automation

```javascript
// Get form structure
const form = await electronAPI.getFormData('#loginForm');
console.log(form.fields);

// Find input fields
const inputs = await electronAPI.findElements({
  tagName: 'input',
  attribute: 'type',
  attributeValue: 'text'
});
```

### Page Analysis

```javascript
// Get interactive elements
const interactive = await electronAPI.getInteractiveElements('body');
console.log(`Found ${interactive.count} interactive elements`);

// Inspect specific element
const details = await electronAPI.inspectElement('#submitButton');
console.log(details.element.rect);
```

### Debugging

```javascript
// Highlight element under investigation
await electronAPI.highlightElement('#suspiciousElement', 'red');

// Explore DOM tree
const tree = await electronAPI.getElementTree('#container', 5);
console.log(JSON.stringify(tree, null, 2));

// Check element visibility
const info = await electronAPI.inspectElement('#hiddenElement');
console.log(`Visible: ${info.element.isVisible}`);
```

## Best Practices

1. **Use specific selectors** - Prefer IDs and data attributes over complex CSS paths
2. **Validate selectors** - The generate_selector command includes uniqueness validation
3. **Limit search scope** - Use container selectors to narrow down element searches
4. **Handle dynamic content** - Wait for elements before inspecting them
5. **Clean up highlights** - Remove highlights when done to avoid visual clutter

## Error Handling

All commands return a `success` field:

```javascript
const result = await electronAPI.inspectElement('#nonexistent');
if (!result.success) {
  console.error(result.error); // "Element not found"
}
```

Common errors:
- `Element not found` - Selector doesn't match any element
- `Selector is required` - Missing required selector parameter
- `No parent element` - Element is the document root
- `Form not found` - Selector doesn't match a form element

## Performance Considerations

- DOM tree traversal depth affects performance; use appropriate depth limits
- Large find_elements results are limited to 100 by default
- Highlights are lightweight overlays that don't affect page performance
- Selector generation caches computed paths for efficiency

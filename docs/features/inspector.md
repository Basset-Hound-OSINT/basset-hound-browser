# DOM Inspector Module Documentation

The DOM Inspector module provides comprehensive DOM inspection capabilities including element analysis, selector generation, element highlighting, and DOM tree traversal.

## Overview

The Inspector module consists of three main components:

- **DOMInspector** (`inspector/manager.js`): Main API for element inspection and analysis
- **ElementHighlighter** (`inspector/highlighter.js`): Visual highlighting of DOM elements
- **SelectorGenerator** (`inspector/selector-generator.js`): CSS selector and XPath generation

## Features

- Get detailed element information (attributes, styles, position)
- Generate optimal CSS selectors and XPath
- Visual element highlighting with customizable styles
- DOM tree traversal (parent, children, siblings)
- Interactive element search
- Form data extraction
- Computed style inspection

---

## API Reference

### DOMInspector

#### Constructor

```javascript
const { DOMInspector } = require('./inspector/manager');

const inspector = new DOMInspector(mainWindow);
```

#### Element Information

##### getElement(selector)

Get detailed information about an element.

Returns JavaScript code to execute in browser context.

```javascript
const script = inspector.getElement('#my-element');
// Execute in webview to get:
// {
//   success: true,
//   element: {
//     tagName: 'DIV',
//     id: 'my-element',
//     classes: ['container', 'active'],
//     attributes: { 'data-id': '123', 'role': 'main' },
//     textContent: 'Hello World...',
//     innerText: 'Hello World...',
//     innerHTML: '<span>Hello World</span>...',
//     outerHTML: '<div id="my-element">...</div>',
//     rect: {
//       top: 100, left: 50, bottom: 200, right: 350,
//       width: 300, height: 100, x: 50, y: 100
//     },
//     isVisible: true,
//     childCount: 5,
//     path: [
//       { tagName: 'DIV', id: 'container', classes: [], index: 0 },
//       { tagName: 'DIV', id: 'my-element', classes: ['container', 'active'], index: 0 }
//     ]
//   }
// }
```

##### getElementTree(selector, depth)

Get DOM subtree starting from an element.

```javascript
const script = inspector.getElementTree('#container', 3);
// Execute to get:
// {
//   success: true,
//   tree: {
//     tagName: 'DIV',
//     id: 'container',
//     classes: ['main'],
//     attributes: { 'role': 'main' },
//     text: null,
//     rect: { width: 800, height: 600, top: 0, left: 0 },
//     children: [
//       {
//         tagName: 'HEADER',
//         id: null,
//         classes: ['header'],
//         children: [...],
//         hasMoreChildren: 10  // if depth limit reached
//       },
//       ...
//     ]
//   },
//   depth: 3
// }
```

##### getElementStyles(selector)

Get computed and inline styles for an element.

```javascript
const script = inspector.getElementStyles('#styled-element');
// Execute to get:
// {
//   success: true,
//   computed: {
//     'display': 'flex',
//     'visibility': 'visible',
//     'width': '300px',
//     'height': '100px',
//     'background-color': 'rgb(255, 255, 255)',
//     'color': 'rgb(0, 0, 0)',
//     'font-size': '16px',
//     ...
//   },
//   inline: {
//     'margin': '10px',
//     'padding': '5px'
//   },
//   element: {
//     tagName: 'DIV',
//     id: 'styled-element'
//   }
// }
```

##### getElementAttributes(selector)

Get all attributes categorized by type.

```javascript
const script = inspector.getElementAttributes('#my-input');
// Execute to get:
// {
//   success: true,
//   standard: {
//     'id': 'my-input',
//     'type': 'text',
//     'name': 'username',
//     'placeholder': 'Enter username'
//   },
//   data: {
//     'data-testid': 'username-input',
//     'data-validation': 'required'
//   },
//   aria: {
//     'aria-label': 'Username',
//     'aria-required': 'true'
//   },
//   events: {
//     'onclick': '[event handler]'
//   },
//   properties: {
//     'value': 'current value',
//     'disabled': false
//   },
//   element: {
//     tagName: 'INPUT',
//     id: 'my-input'
//   }
// }
```

#### Selector Generation

##### getGenerateSelectorScript(selector)

Generate multiple selector variants for an element.

```javascript
const script = inspector.getGenerateSelectorScript('#target');
// Execute to get:
// {
//   success: true,
//   selectors: {
//     optimal: '#target',
//     id: '#target',
//     class: 'div.container.active',
//     xpath: '//div[@id="target"]',
//     nthChild: 'body > div:nth-child(2) > div:nth-child(1)',
//     full: '#container > div.target:nth-child(1)',
//     optimalUnique: true
//   },
//   path: [...]
// }
```

##### generateSelector(elementPath)

Generate selectors from element path (server-side).

```javascript
const selectors = inspector.generateSelector([
  { tagName: 'DIV', id: 'container', classes: [], index: 0 },
  { tagName: 'BUTTON', id: null, classes: ['submit'], index: 2 }
]);

// Returns:
// {
//   optimal: '#container > button.submit:nth-child(3)',
//   id: null,
//   class: 'button.submit',
//   nthChild: 'div:nth-child(1) > button:nth-child(3)',
//   xpath: '//div[@id="container"]/button[3]',
//   full: '#container > button.submit:nth-child(3)'
// }
```

#### Element Highlighting

##### highlightElement(selector, color)

Highlight a single element visually.

```javascript
const script = inspector.highlightElement('#target', 'red');
// Execute to highlight element with red overlay
```

##### highlightMultiple(selectors)

Highlight multiple elements with different colors.

```javascript
const script = inspector.highlightMultiple([
  '#header',
  '.sidebar',
  '#footer'
]);
// Each selector gets a different color
```

##### removeHighlight()

Remove all highlights.

```javascript
const script = inspector.removeHighlight();
```

##### setHighlightStyle(options)

Configure highlight appearance.

```javascript
inspector.setHighlightStyle({
  backgroundColor: 'rgba(0, 255, 0, 0.3)',
  borderColor: '#00ff00',
  borderWidth: 3,
  opacity: 0.5
});
```

#### Element Search

##### findElements(query)

Find elements by various criteria.

```javascript
// By CSS selector
const script = inspector.findElements({
  selector: '.item-class',
  limit: 50,
  visibleOnly: true
});

// By tag name
const script = inspector.findElements({
  tagName: 'button',
  limit: 20
});

// By text content
const script = inspector.findElements({
  text: 'Click here',
  exact: false,  // partial match
  limit: 10
});

// By attribute
const script = inspector.findElements({
  attribute: 'data-testid',
  attributeValue: 'submit-btn'
});

// By XPath
const script = inspector.findElements({
  xpath: '//div[@class="container"]//button',
  limit: 10
});

// Execute to get:
// {
//   success: true,
//   count: 15,
//   total: 15,
//   elements: [
//     {
//       index: 0,
//       tagName: 'BUTTON',
//       id: 'submit',
//       classes: ['btn', 'primary'],
//       text: 'Submit',
//       rect: { width: 100, height: 40, top: 200, left: 300 }
//     },
//     ...
//   ]
// }
```

#### DOM Traversal

##### getParent(selector)

Get parent element information.

```javascript
const script = inspector.getParent('#child-element');
// Execute to get:
// {
//   success: true,
//   parent: {
//     tagName: 'DIV',
//     id: 'parent-container',
//     classes: ['wrapper'],
//     attributes: { ... },
//     childCount: 5,
//     rect: { width: 800, height: 600, top: 0, left: 0 }
//   }
// }
```

##### getChildren(selector)

Get all child elements.

```javascript
const script = inspector.getChildren('#container');
// Execute to get:
// {
//   success: true,
//   count: 5,
//   children: [
//     {
//       index: 0,
//       tagName: 'DIV',
//       id: 'header',
//       classes: ['section'],
//       text: 'Header content...',
//       childCount: 3,
//       rect: { ... }
//     },
//     ...
//   ]
// }
```

##### getSiblings(selector)

Get sibling elements.

```javascript
const script = inspector.getSiblings('#middle-element');
// Execute to get:
// {
//   success: true,
//   elementIndex: 2,
//   count: 4,
//   siblings: [...],
//   previous: { ... },  // Previous sibling
//   next: { ... }       // Next sibling
// }
```

#### Interactive Elements

##### getInteractiveElements(selector)

Find all interactive elements (links, buttons, inputs, etc.).

```javascript
const script = inspector.getInteractiveElements('#container');
// Execute to get:
// {
//   success: true,
//   count: 25,
//   elements: [
//     {
//       tagName: 'A',
//       type: null,
//       id: 'home-link',
//       name: null,
//       classes: ['nav-link'],
//       text: 'Home',
//       href: 'https://example.com/',
//       isVisible: true,
//       isDisabled: false,
//       rect: { ... }
//     },
//     {
//       tagName: 'INPUT',
//       type: 'text',
//       id: 'search',
//       name: 'query',
//       classes: ['search-input'],
//       text: 'Search...',
//       href: null,
//       isVisible: true,
//       isDisabled: false,
//       rect: { ... }
//     },
//     ...
//   ]
// }
```

##### getFormData(selector)

Extract form data and field information.

```javascript
const script = inspector.getFormData('#registration-form');
// Execute to get:
// {
//   success: true,
//   action: 'https://example.com/register',
//   method: 'post',
//   data: {
//     'username': 'john_doe',
//     'email': 'john@example.com',
//     'interests': ['sports', 'music']
//   },
//   fields: [
//     {
//       tagName: 'INPUT',
//       type: 'text',
//       name: 'username',
//       id: 'username',
//       value: 'john_doe',
//       checked: null,
//       required: true,
//       disabled: false,
//       placeholder: 'Enter username'
//     },
//     ...
//   ]
// }
```

---

### ElementHighlighter

#### Constructor

```javascript
const { ElementHighlighter } = require('./inspector/highlighter');

const highlighter = new ElementHighlighter();
```

#### Methods

##### highlight(selector, color)

Highlight single element with optional color.

```javascript
const script = highlighter.highlight('#element', 'blue');
```

##### highlightMultiple(selectors)

Highlight multiple elements with auto-assigned colors.

```javascript
const script = highlighter.highlightMultiple(['#a', '#b', '#c']);
```

##### highlightPulse(selector, duration)

Highlight with pulsing animation.

```javascript
const script = highlighter.highlightPulse('#element', 3000);
// Pulses for 3 seconds then auto-removes
```

##### highlightWithInfo(selector)

Highlight with info tooltip showing element details.

```javascript
const script = highlighter.highlightWithInfo('#element');
// Shows overlay with size, position, display info
```

##### clear()

Remove all highlights.

```javascript
const script = highlighter.clear();
```

##### setStyle(options)

Configure default highlight style.

```javascript
const result = highlighter.setStyle({
  backgroundColor: 'rgba(255, 0, 0, 0.3)',
  border: '3px dashed #ff0000',
  borderColor: '#ff0000',
  borderWidth: 3,
  opacity: 0.5
});
```

#### Available Colors

Named colors: `red`, `green`, `blue`, `yellow`, `orange`, `purple`, `cyan`, `magenta`

Or use hex colors: `#ff0000`, `#00ff00`, etc.

---

### SelectorGenerator

#### Constructor

```javascript
const { SelectorGenerator } = require('./inspector/selector-generator');

const generator = new SelectorGenerator();
```

#### Methods

##### fromElement(elementInfo)

Generate selectors from element information.

```javascript
const selectors = generator.fromElement({
  tagName: 'BUTTON',
  id: 'submit-btn',
  classes: ['primary', 'large'],
  attributes: { 'data-testid': 'submit' },
  path: [...]
});

// Returns:
// {
//   optimal: '#submit-btn',
//   id: '#submit-btn',
//   class: 'button.primary.large',
//   attributes: 'button[data-testid="submit"]',
//   nthChild: '...',
//   xpath: '//button[@id="submit-btn"]',
//   full: '#submit-btn'
// }
```

##### generateId(id)

Generate ID-based selector.

```javascript
const selector = generator.generateId('my-element');
// Returns: '#my-element'
```

##### generateClass(classes, tagName)

Generate class-based selector.

```javascript
const selector = generator.generateClass(['btn', 'primary'], 'button');
// Returns: 'button.btn.primary'
```

##### generateXPath(path)

Generate XPath from element path.

```javascript
const xpath = generator.generateXPath([
  { tagName: 'DIV', id: 'container', index: 0 },
  { tagName: 'BUTTON', id: null, index: 2 }
]);
// Returns: '//div[@id="container"]/button[3]'
```

##### generateNthChild(path)

Generate nth-child based selector.

```javascript
const selector = generator.generateNthChild([
  { tagName: 'DIV', index: 0 },
  { tagName: 'BUTTON', index: 2 }
]);
// Returns: 'div:nth-child(1) > button:nth-child(3)'
```

##### validate(selector)

Get script to validate selector in browser.

```javascript
const script = generator.validate('#my-selector');
// Execute to get:
// {
//   valid: true,
//   count: 1,
//   unique: true
// }
```

##### generateCompact(elementInfo)

Generate compact selector for logging.

```javascript
const compact = generator.generateCompact({
  tagName: 'DIV',
  id: 'main',
  classes: ['container']
});
// Returns: 'div#main'
```

#### Preferred Attributes

The generator prioritizes these attributes for selector generation:

1. `id`
2. `data-testid`
3. `data-test`
4. `data-cy`
5. `data-automation-id`
6. `name`
7. `aria-label`
8. `role`
9. `type`
10. `placeholder`
11. `title`
12. `alt`

---

## WebSocket Command Examples

### Get Element Info

```json
{
  "command": "inspector.getElement",
  "params": {
    "selector": "#my-element"
  }
}
```

### Get Element Tree

```json
{
  "command": "inspector.getTree",
  "params": {
    "selector": "#container",
    "depth": 3
  }
}
```

### Get Element Styles

```json
{
  "command": "inspector.getStyles",
  "params": {
    "selector": "#styled-element"
  }
}
```

### Get Element Attributes

```json
{
  "command": "inspector.getAttributes",
  "params": {
    "selector": "#my-input"
  }
}
```

### Generate Selector

```json
{
  "command": "inspector.generateSelector",
  "params": {
    "selector": "#target-element"
  }
}
```

### Highlight Element

```json
{
  "command": "inspector.highlight",
  "params": {
    "selector": "#element",
    "color": "red"
  }
}
```

### Highlight Multiple

```json
{
  "command": "inspector.highlightMultiple",
  "params": {
    "selectors": ["#header", ".sidebar", "#footer"]
  }
}
```

### Remove Highlight

```json
{
  "command": "inspector.clearHighlight"
}
```

### Find Elements

```json
{
  "command": "inspector.find",
  "params": {
    "selector": ".item",
    "visibleOnly": true,
    "limit": 50
  }
}
```

```json
{
  "command": "inspector.find",
  "params": {
    "text": "Submit",
    "exact": false,
    "limit": 10
  }
}
```

```json
{
  "command": "inspector.find",
  "params": {
    "attribute": "data-testid",
    "attributeValue": "submit-btn"
  }
}
```

```json
{
  "command": "inspector.find",
  "params": {
    "xpath": "//button[@type='submit']"
  }
}
```

### Get Parent

```json
{
  "command": "inspector.getParent",
  "params": {
    "selector": "#child"
  }
}
```

### Get Children

```json
{
  "command": "inspector.getChildren",
  "params": {
    "selector": "#container"
  }
}
```

### Get Siblings

```json
{
  "command": "inspector.getSiblings",
  "params": {
    "selector": "#middle"
  }
}
```

### Get Interactive Elements

```json
{
  "command": "inspector.getInteractive",
  "params": {
    "selector": "body"
  }
}
```

### Get Form Data

```json
{
  "command": "inspector.getFormData",
  "params": {
    "selector": "#my-form"
  }
}
```

### Set Highlight Style

```json
{
  "command": "inspector.setHighlightStyle",
  "params": {
    "backgroundColor": "rgba(0, 255, 0, 0.3)",
    "borderColor": "#00ff00",
    "borderWidth": 3
  }
}
```

---

## Code Examples

### Element Inspection

```javascript
const { DOMInspector } = require('./inspector/manager');

const inspector = new DOMInspector(mainWindow);

// Get element info
const elementScript = inspector.getElement('#search-input');
const elementInfo = await executeInWebview(elementScript);

console.log(`Element: ${elementInfo.element.tagName}`);
console.log(`Visible: ${elementInfo.element.isVisible}`);
console.log(`Size: ${elementInfo.element.rect.width}x${elementInfo.element.rect.height}`);
```

### Selector Generation

```javascript
// Generate selectors for an element
const selectorScript = inspector.getGenerateSelectorScript('#target');
const selectors = await executeInWebview(selectorScript);

console.log(`Optimal: ${selectors.selectors.optimal}`);
console.log(`XPath: ${selectors.selectors.xpath}`);
console.log(`Is Unique: ${selectors.selectors.optimalUnique}`);
```

### Visual Highlighting

```javascript
// Highlight with info box
const highlightScript = inspector.highlighter.highlightWithInfo('#element');
await executeInWebview(highlightScript);

// Highlight multiple elements
const multiScript = inspector.highlightMultiple([
  'header',
  'nav',
  'main',
  'footer'
]);
await executeInWebview(multiScript);

// Clear all highlights
const clearScript = inspector.removeHighlight();
await executeInWebview(clearScript);
```

### DOM Traversal

```javascript
// Get parent chain
let current = '#deep-element';
const parents = [];

while (true) {
  const parentScript = inspector.getParent(current);
  const result = await executeInWebview(parentScript);

  if (!result.success) break;

  parents.push(result.parent);
  current = result.parent.id
    ? `#${result.parent.id}`
    : `${result.parent.tagName.toLowerCase()}`;
}

console.log('Parent chain:', parents.map(p => p.tagName).join(' > '));
```

### Finding Interactive Elements

```javascript
// Find all buttons
const buttonScript = inspector.findElements({
  tagName: 'button',
  visibleOnly: true
});
const buttons = await executeInWebview(buttonScript);

console.log(`Found ${buttons.count} visible buttons`);

// Highlight all of them
const selectors = buttons.elements.map((b, i) =>
  b.id ? `#${b.id}` : `button:nth-of-type(${i + 1})`
);
const highlightScript = inspector.highlightMultiple(selectors);
await executeInWebview(highlightScript);
```

### Form Analysis

```javascript
// Analyze a form
const formScript = inspector.getFormData('#registration');
const formData = await executeInWebview(formScript);

console.log(`Form action: ${formData.action}`);
console.log(`Form method: ${formData.method}`);
console.log('Current values:', formData.data);
console.log('Required fields:', formData.fields.filter(f => f.required));
```

---

## Configuration Options

### Highlight Styles

| Property | Type | Description |
|----------|------|-------------|
| `backgroundColor` | string | RGBA background color |
| `border` | string | Full border specification |
| `borderColor` | string | Border color |
| `borderWidth` | number | Border width in pixels |
| `opacity` | number | Background opacity (0-1) |

### Find Query Options

| Option | Type | Description |
|--------|------|-------------|
| `selector` | string | CSS selector |
| `tagName` | string | HTML tag name |
| `text` | string | Text content to match |
| `exact` | boolean | Exact text match (default: false) |
| `attribute` | string | Attribute name |
| `attributeValue` | string | Attribute value |
| `xpath` | string | XPath expression |
| `visibleOnly` | boolean | Only visible elements |
| `limit` | number | Max results (default: 100) |

### Element Path Node

| Property | Type | Description |
|----------|------|-------------|
| `tagName` | string | Element tag name |
| `id` | string | Element ID (or null) |
| `classes` | array | Array of class names |
| `index` | number | Index among same-tag siblings |

---

## Important CSS Properties Inspected

The `getElementStyles` method returns these commonly-needed properties:

- **Layout**: display, visibility, position, top, left, right, bottom
- **Sizing**: width, height, min-width, max-width, min-height, max-height
- **Spacing**: margin-*, padding-*
- **Border**: border, border-width, border-style, border-color, border-radius
- **Background**: background, background-color, background-image
- **Typography**: color, font-family, font-size, font-weight, line-height, text-align
- **Stacking**: z-index, overflow
- **Interactivity**: cursor, pointer-events
- **Flexbox**: flex, flex-direction, justify-content, align-items
- **Grid**: grid-template-columns, grid-template-rows, gap
- **Effects**: transform, transition, animation

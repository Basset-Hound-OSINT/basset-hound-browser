# Phase 2 Command Specifications - Complete Reference

**Version**: 1.0  
**Status**: Complete Specification  
**Date**: June 20, 2026  
**Total Commands**: 53 detailed specifications  
**Target Implementation**: Q3 2026

---

## Table of Contents

1. [Command Overview](#command-overview)
2. [Direct DOM Access Commands (7)](#direct-dom-access-commands)
3. [JavaScript Execution Commands (7)](#javascript-execution-commands)
4. [Network Control Commands (8)](#network-control-commands)
5. [Storage Access Commands (7)](#storage-access-commands)
6. [DevTools Commands (7)](#devtools-commands)
7. [CSS Injection Commands (8)](#css-injection-commands)
8. [JavaScript Injection Commands (8)](#javascript-injection-commands)
9. [DOM Manipulation Advanced Commands (13)](#dom-manipulation-advanced-commands)
10. [Integration Examples](#integration-examples)
11. [Real-World Usage Scenarios](#real-world-usage-scenarios)

---

## Command Overview

### Command Execution Architecture

All Phase 2 commands follow a unified execution model:

```
Client Request
    ↓
WebSocket Parser (JSON validation)
    ↓
Authorization Check (token/signature)
    ↓
Input Validation (type, schema, security)
    ↓
Command Handler (category-specific router)
    ↓
Execution Context (Browser/Sandbox/CDP)
    ↓
Result Capture & Sanitization
    ↓
Response Encoding (compression)
    ↓
Client Response
```

### Standard Response Format

**Success Response:**
```json
{
  "id": "cmd-12345",
  "command": "command_name",
  "success": true,
  "data": { "result": "value" },
  "metadata": {
    "executionTime": 45,
    "timestamp": "2026-06-20T12:34:56.789Z"
  }
}
```

**Error Response:**
```json
{
  "id": "cmd-12345",
  "command": "command_name",
  "success": false,
  "error": "Element not found",
  "errorCode": "ELEMENT_NOT_FOUND",
  "recovery": {
    "suggestion": "Verify selector with wait_for_element first",
    "alternativeCommands": ["find_elements_by_selector", "get_page_state"]
  },
  "metadata": {
    "executionTime": 12,
    "timestamp": "2026-06-20T12:34:56.789Z"
  }
}
```

### Input Validation Rules

All commands validate inputs according to:
- **Type checking**: Strict type validation (string, number, boolean, array, object)
- **Schema validation**: Required fields, optional fields with defaults
- **Security checks**: No script injection in strings, XSS prevention
- **Range validation**: Min/max lengths, numeric boundaries
- **Format validation**: Regex patterns, URL formats, CSS selectors

---

# DIRECT DOM ACCESS COMMANDS

## Command 1: get_element_properties

**Category**: Direct DOM Access  
**Stability**: Stable  
**Performance**: < 50ms  
**Use Case**: Extract properties from a single element for inspection or testing

### Purpose

Retrieve computed and enumerable properties from a DOM element. This command accesses both standard DOM properties and custom properties without executing arbitrary code.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | CSS selector targeting element |
| `properties` | string[] | No | `["all"]` | Specific properties to retrieve (or "all") |
| `computed` | boolean | No | false | Include computed styles |
| `inherited` | boolean | No | false | Include inherited properties |
| `customOnly` | boolean | No | false | Only custom (non-standard) properties |
| `maxDepth` | number | No | 2 | Max depth for nested object inspection |

### Response

```json
{
  "success": true,
  "data": {
    "element": {
      "tagName": "INPUT",
      "id": "email-field",
      "className": "form-control",
      "type": "email",
      "value": "user@example.com",
      "placeholder": "Enter email",
      "disabled": false,
      "required": true,
      "customData": {
        "validationRule": "email",
        "originalValue": "test@example.com"
      }
    },
    "computed": {
      "display": "block",
      "width": "300px",
      "color": "rgb(0, 0, 0)"
    },
    "inherited": {
      "fontFamily": "Arial, sans-serif",
      "fontSize": "16px"
    }
  },
  "metadata": {
    "elementFound": true,
    "propertyCount": 15,
    "executionTime": 12
  }
}
```

### Error Conditions

| Error | Code | Recovery |
|-------|------|----------|
| Element not found | `ELEMENT_NOT_FOUND` | Use `wait_for_element` or `find_elements_by_selector` |
| Invalid selector | `INVALID_SELECTOR` | Test selector in browser console first |
| Timeout accessing properties | `TIMEOUT` | Try with fewer properties or smaller depth |
| Multiple elements match | `MULTIPLE_MATCHES` | Use more specific selector or `find_elements_by_selector` |

### Performance Expectations

- Single element: 10-20ms
- With computed styles: 20-30ms
- With inherited styles: 30-50ms
- Maximum safe depth: 3 levels

### Security & Safety

- Property access is read-only
- Getters are NOT executed (safe from side effects)
- XSS prevention: All string values are sanitized
- Private fields (#field) are not accessible
- Proxies return their target properties only

### Code Examples

**Basic Usage:**
```javascript
// Get all properties from an input element
{
  "id": 1,
  "command": "get_element_properties",
  "selector": "#email-field"
}
```

**Specific Properties:**
```javascript
// Get specific properties
{
  "id": 2,
  "command": "get_element_properties",
  "selector": "input[type='password']",
  "properties": ["value", "disabled", "type"]
}
```

**With Computed Styles:**
```javascript
// Include computed CSS
{
  "id": 3,
  "command": "get_element_properties",
  "selector": ".card",
  "computed": true,
  "properties": ["innerHTML", "className"]
}
```

---

## Command 2: set_element_properties

**Category**: Direct DOM Access  
**Stability**: Stable  
**Performance**: < 100ms  
**Use Case**: Modify element properties for testing or manipulation

### Purpose

Safely modify element properties with validation. Only allows setting standard DOM properties, not dangerous attributes like `onclick`.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | CSS selector targeting element |
| `properties` | object | Yes | - | Property name/value pairs to set |
| `unsafe` | boolean | No | false | Allow dangerous properties (event handlers) |
| `validate` | boolean | No | true | Validate property values before setting |
| `rollback` | boolean | No | false | Save original values for rollback |

### Response

```json
{
  "success": true,
  "data": {
    "updated": {
      "value": "new email@example.com",
      "disabled": true,
      "placeholder": "Email address"
    },
    "unchanged": [],
    "failed": [],
    "rollbackId": "rollback-abc123"
  },
  "metadata": {
    "propertiesSet": 3,
    "validation": { "errors": [] },
    "executionTime": 24
  }
}
```

### Error Conditions

| Error | Code | Recovery |
|-------|------|----------|
| Property not writable | `PROPERTY_NOT_WRITABLE` | Use CSS injection instead |
| Dangerous property attempted | `UNSAFE_PROPERTY_BLOCKED` | Enable `unsafe: true` to override |
| Element not found | `ELEMENT_NOT_FOUND` | Wait for element first |
| Validation failed | `VALIDATION_FAILED` | Check property types and values |

### Security & Safety

- Whitelist-based property validation
- Event handler properties blocked by default
- Script URLs blocked from `href`, `src`, `data` attributes
- Changes are non-persistent (reverted on page reload)
- All changes are logged for audit

### Code Examples

**Basic Property Update:**
```javascript
{
  "id": 4,
  "command": "set_element_properties",
  "selector": "#email-field",
  "properties": {
    "value": "updated@example.com",
    "disabled": false,
    "placeholder": "Enter your email"
  }
}
```

**With Rollback:**
```javascript
{
  "id": 5,
  "command": "set_element_properties",
  "selector": ".button",
  "properties": { "disabled": true },
  "rollback": true
}

// Later: restore original state using rollback-abc123
```

---

## Command 3: get_computed_styles

**Category**: Direct DOM Access  
**Stability**: Stable  
**Performance**: < 50ms  
**Use Case**: Retrieve final computed CSS for element (as rendered by browser)

### Purpose

Get computed CSS styles as calculated by the browser's layout engine, including inherited and cascaded values.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | CSS selector targeting element |
| `properties` | string[] | No | `["all"]` | Specific CSS properties to retrieve |
| `pseudo` | string | No | - | Pseudo-element (::before, ::after, etc.) |
| `unit` | string | No | "computed" | Return format (computed, pixel, relative) |
| `includeDefaults` | boolean | No | false | Include browser default styles |

### Response

```json
{
  "success": true,
  "data": {
    "computed": {
      "display": "block",
      "position": "relative",
      "width": "300px",
      "height": "40px",
      "backgroundColor": "rgb(255, 255, 255)",
      "borderColor": "rgb(200, 200, 200)",
      "color": "rgb(0, 0, 0)",
      "fontSize": "16px",
      "fontWeight": "400",
      "lineHeight": "24px",
      "paddingTop": "8px",
      "paddingRight": "12px",
      "paddingBottom": "8px",
      "paddingLeft": "12px",
      "marginTop": "0px"
    },
    "pseudo": {
      "::before": {
        "content": "''",
        "display": "none"
      }
    }
  },
  "metadata": {
    "elementVisible": true,
    "computedTime": 18,
    "propertyCount": 45
  }
}
```

### Error Conditions

| Error | Code | Recovery |
|-------|------|----------|
| Element not found | `ELEMENT_NOT_FOUND` | Verify selector exists |
| Element hidden | `ELEMENT_HIDDEN` | Element not in viewport (non-fatal) |
| Invalid property name | `INVALID_PROPERTY` | Check CSS property spelling |
| Pseudo-element invalid | `INVALID_PSEUDO` | Use standard pseudo-elements |

### Performance Expectations

- Single property: 5-10ms
- Multiple properties (10+): 15-30ms
- With pseudo-elements: 20-40ms

### Security & Safety

- Read-only operation
- No side effects
- Safe for sensitive elements
- Can read from cross-origin iframes (if same-origin)

### Code Examples

**Get All Computed Styles:**
```javascript
{
  "id": 6,
  "command": "get_computed_styles",
  "selector": ".header"
}
```

**Specific Properties:**
```javascript
{
  "id": 7,
  "command": "get_computed_styles",
  "selector": ".button",
  "properties": ["backgroundColor", "color", "fontSize", "padding"]
}
```

**Pseudo-Elements:**
```javascript
{
  "id": 8,
  "command": "get_computed_styles",
  "selector": ".input-field",
  "pseudo": "::before",
  "properties": ["content", "display"]
}
```

---

## Command 4: get_shadow_dom

**Category**: Direct DOM Access  
**Stability**: Stable  
**Performance**: < 100ms  
**Use Case**: Access encapsulated DOM in Web Components

### Purpose

Extract and inspect Shadow DOM tree from a Web Component. Returns structure, styling, and event listeners.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | CSS selector targeting Web Component |
| `depth` | number | No | 5 | Max tree depth to inspect |
| `includeStyles` | boolean | No | true | Include <style> elements and text |
| `includeSlots` | boolean | No | true | Show slot distribution |
| `format` | string | No | "tree" | Response format (tree, html, json) |

### Response

```json
{
  "success": true,
  "data": {
    "shadowRoot": {
      "mode": "open",
      "children": [
        {
          "type": "style",
          "content": ":host { display: block; }"
        },
        {
          "type": "div",
          "className": "wrapper",
          "id": "main",
          "children": [
            {
              "type": "slot",
              "name": "content",
              "properties": { "colSpan": 1 },
              "assignedElements": [
                { "type": "span", "text": "Slot content" }
              ]
            },
            {
              "type": "button",
              "text": "Click me",
              "eventListeners": ["click"]
            }
          ]
        }
      ]
    },
    "hostElement": {
      "tagName": "MY-COMPONENT",
      "id": "comp1",
      "attributes": { "variant": "primary" }
    }
  },
  "metadata": {
    "hasShadowDOM": true,
    "elementCount": 8,
    "slotCount": 2,
    "executionTime": 35
  }
}
```

### Error Conditions

| Error | Code | Recovery |
|-------|------|----------|
| No Shadow DOM | `NO_SHADOW_DOM` | Element is not a Web Component with Shadow DOM |
| Shadow DOM closed | `SHADOW_DOM_CLOSED` | Mode is 'closed', cannot inspect |
| Element not found | `ELEMENT_NOT_FOUND` | Verify selector |
| Access denied | `ACCESS_DENIED` | Cross-origin restrictions apply |

### Security & Safety

- Only works with same-origin Web Components
- Closed Shadow DOMs are not accessible (by design)
- No execution of Shadow DOM scripts
- Style content is returned as text (not executed)

### Code Examples

**Basic Shadow DOM Access:**
```javascript
{
  "id": 9,
  "command": "get_shadow_dom",
  "selector": "my-custom-element"
}
```

**Shallow Inspection:**
```javascript
{
  "id": 10,
  "command": "get_shadow_dom",
  "selector": "fancy-button",
  "depth": 2,
  "includeStyles": false
}
```

---

## Command 5: access_iframe

**Category**: Direct DOM Access  
**Stability**: Stable  
**Performance**: < 150ms  
**Use Case**: Read content from same-origin iframes

### Purpose

Access DOM and content from same-origin iframes. Returns iframe document structure, can chain commands.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | CSS selector for iframe element |
| `query` | string | No | - | CSS selector for element within iframe |
| `operation` | string | No | "read" | Operation to perform (read, execute, screenshot) |
| `depth` | number | No | 1 | Nesting depth for nested iframes |
| `timeout` | number | No | 5000 | Max wait time for iframe to load (ms) |

### Response

```json
{
  "success": true,
  "data": {
    "iframe": {
      "src": "https://example.com/frame.html",
      "title": "Embedded Page",
      "crossOrigin": null,
      "loaded": true
    },
    "document": {
      "title": "Frame Document Title",
      "url": "https://example.com/frame.html",
      "readyState": "complete"
    },
    "content": {
      "html": "<!DOCTYPE html>...",
      "bodyText": "Page content...",
      "forms": [{ "id": "form1", "fields": 3 }]
    },
    "element": {
      "selector": "#content",
      "found": true,
      "tagName": "DIV",
      "text": "Form content"
    }
  },
  "metadata": {
    "sameOrigin": true,
    "loadTime": 450,
    "executionTime": 67
  }
}
```

### Error Conditions

| Error | Code | Recovery |
|-------|------|----------|
| Cross-origin iframe | `CROSS_ORIGIN_DENIED` | Iframe not same-origin |
| Iframe not loaded | `IFRAME_NOT_LOADED` | Use `timeout` parameter or wait first |
| Element in iframe not found | `ELEMENT_NOT_FOUND` | Verify selector within iframe |
| Iframe selector invalid | `INVALID_IFRAME_SELECTOR` | Check iframe selector |

### Security & Safety

- Only same-origin iframes are accessible
- Cross-origin iframes raise error (by design, prevents XSS)
- Operations respect iframe sandbox restrictions
- No modification of iframe content without explicit command

### Code Examples

**Read iframe Content:**
```javascript
{
  "id": 11,
  "command": "access_iframe",
  "selector": "iframe#payment-frame",
  "operation": "read"
}
```

**Query Element in iframe:**
```javascript
{
  "id": 12,
  "command": "access_iframe",
  "selector": ".embed-frame",
  "query": "#form-submit-button"
}
```

---

## Command 6: get_dom_path

**Category**: Direct DOM Access  
**Stability**: Stable  
**Performance**: < 30ms  
**Use Case**: Get XPath or CSS selector path for element

### Purpose

Generate CSS selector or XPath to uniquely identify an element. Useful for recording UI interactions.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | CSS selector for target element |
| `format` | string | No | "css" | Path format (css, xpath, both) |
| `optimize` | boolean | No | true | Generate shortest unique path |
| `absolute` | boolean | No | false | Use absolute path (from root) |

### Response

```json
{
  "success": true,
  "data": {
    "css": "#form-container > form > div.form-group > input[name='email']",
    "xpath": "/html/body/div[@id='form-container']/form/div[@class='form-group'][1]/input[@name='email']",
    "optimized": "input[name='email']",
    "confidence": 0.98,
    "alternatives": [
      "input#email-field",
      "form input[type='email']"
    ]
  },
  "metadata": {
    "pathUnique": true,
    "matchesElements": 1,
    "executionTime": 12
  }
}
```

### Error Conditions

| Error | Code | Recovery |
|-------|------|----------|
| Element not found | `ELEMENT_NOT_FOUND` | Verify selector |
| Cannot generate path | `PATH_GENERATION_FAILED` | Element may be dynamic |
| Non-unique path | `NON_UNIQUE_PATH` | Use more specific selector |

### Performance Expectations

- Simple element: 5-10ms
- Complex path with optimization: 20-30ms

### Security & Safety

- Read-only operation
- Safe for all elements
- Generates explicit selectors only

### Code Examples

**Get CSS Selector:**
```javascript
{
  "id": 13,
  "command": "get_dom_path",
  "selector": "input#username"
}
```

**Get Both Formats:**
```javascript
{
  "id": 14,
  "command": "get_dom_path",
  "selector": ".submit-button",
  "format": "both",
  "optimize": true
}
```

---

## Command 7: find_elements_by_selector

**Category**: Direct DOM Access  
**Stability**: Stable  
**Performance**: < 100ms  
**Use Case**: Find multiple elements matching criteria

### Purpose

Query multiple elements matching a CSS selector. Returns summary and individual element metadata.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | CSS selector to match |
| `limit` | number | No | 100 | Max elements to return |
| `properties` | string[] | No | `["tagName", "id", "className", "text"]` | Properties to retrieve |
| `index` | number | No | - | If set, return only element at index |
| `visible` | boolean | No | false | Only visible elements (display, visibility, etc.) |

### Response

```json
{
  "success": true,
  "data": {
    "selector": "input[type='text']",
    "matches": 7,
    "limited": false,
    "elements": [
      {
        "index": 0,
        "tagName": "INPUT",
        "id": "first-input",
        "className": "form-input",
        "text": "",
        "visible": true,
        "properties": {
          "type": "text",
          "name": "username",
          "value": "user123"
        }
      },
      {
        "index": 1,
        "tagName": "INPUT",
        "id": "",
        "className": "form-input hidden",
        "text": "",
        "visible": false,
        "properties": { "type": "text", "name": "hidden-field" }
      }
    ]
  },
  "metadata": {
    "totalFound": 7,
    "returned": 2,
    "visibleCount": 6,
    "executionTime": 28
  }
}
```

### Error Conditions

| Error | Code | Recovery |
|-------|------|----------|
| Invalid selector | `INVALID_SELECTOR` | Test selector in browser console |
| No elements found | `NO_MATCHES` | Check selector syntax |
| Selector error | `SELECTOR_ERROR` | Verify CSS selector syntax |

### Performance Expectations

- Simple selector: 10-20ms
- Complex selector: 30-100ms
- With property retrieval: +20-40ms per element

### Security & Safety

- Read-only operation
- Safe for all elements
- Large result sets may be truncated

### Code Examples

**Find All Form Inputs:**
```javascript
{
  "id": 15,
  "command": "find_elements_by_selector",
  "selector": "input",
  "properties": ["type", "name", "value", "disabled"]
}
```

**Find Visible Elements:**
```javascript
{
  "id": 16,
  "command": "find_elements_by_selector",
  "selector": ".list-item",
  "visible": true,
  "limit": 50
}
```

---

# JAVASCRIPT EXECUTION COMMANDS

## Command 8: execute_javascript

**Category**: JavaScript Execution  
**Stability**: Stable  
**Performance**: < 500ms  
**Use Case**: Execute JavaScript code in page context with safety limits

### Purpose

Execute arbitrary JavaScript in the page context with timeouts and error handling. Code runs with full access to page APIs.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `script` | string | Yes | - | JavaScript code to execute |
| `args` | any[] | No | [] | Arguments passed to script as parameters |
| `timeout` | number | No | 5000 | Execution timeout (ms) |
| `returnType` | string | No | "json" | Expected return type (json, string, number) |
| `awaitPromise` | boolean | No | true | Wait for returned Promise to resolve |

### Response

```json
{
  "success": true,
  "data": {
    "result": {
      "elementCount": 7,
      "formData": {
        "username": "john",
        "email": "john@example.com"
      },
      "pageTitle": "Dashboard"
    },
    "type": "object",
    "executionTime": 145
  },
  "metadata": {
    "timeout": false,
    "error": null,
    "returnsPromise": false,
    "executionTime": 145
  }
}
```

### Error Conditions

| Error | Code | Recovery |
|-------|------|----------|
| Script timeout | `EXECUTION_TIMEOUT` | Reduce script complexity or increase timeout |
| Syntax error | `SYNTAX_ERROR` | Check JavaScript syntax |
| Reference error | `REFERENCE_ERROR` | Variable/function not defined |
| Non-serializable result | `NON_SERIALIZABLE` | Return only JSON-serializable values |
| Script threw error | `SCRIPT_ERROR` | Check error message in response |

### Performance Expectations

- Simple script: 10-50ms
- Complex operations: 100-500ms
- Maximum safe timeout: 30000ms

### Security & Safety

- Scripts run in page context (not sandboxed)
- Full access to page APIs
- Can modify page, trigger events, etc.
- Should validate/sanitize user input in script
- Not suitable for untrusted code

### Code Examples

**Extract Form Data:**
```javascript
{
  "id": 17,
  "command": "execute_javascript",
  "script": "
    const form = document.querySelector('form');
    return {
      fields: form.elements.length,
      values: Array.from(form.elements).map(el => ({
        name: el.name,
        value: el.value,
        type: el.type
      }))
    };
  "
}
```

**Wait for Async Operation:**
```javascript
{
  "id": 18,
  "command": "execute_javascript",
  "script": "
    return fetch('/api/data')
      .then(r => r.json())
      .then(data => ({ success: true, items: data.length }));
  ",
  "awaitPromise": true,
  "timeout": 10000
}
```

**With Arguments:**
```javascript
{
  "id": 19,
  "command": "execute_javascript",
  "script": "
    return {
      sum: arguments[0] + arguments[1],
      product: arguments[0] * arguments[1]
    };
  ",
  "args": [5, 3]
}
```

---

## Command 9: call_function

**Category**: JavaScript Execution  
**Stability**: Stable  
**Performance**: < 500ms  
**Use Case**: Call existing page function with arguments

### Purpose

Call a function defined in page scope with arguments. Useful for interacting with application JavaScript.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `functionName` | string | Yes | - | Function path (e.g., "window.app.getData") |
| `args` | any[] | No | [] | Arguments to pass to function |
| `timeout` | number | No | 5000 | Execution timeout (ms) |
| `thisContext` | string | No | "window" | Context for function call (this value) |
| `awaitPromise` | boolean | No | true | Wait for Promise return value |

### Response

```json
{
  "success": true,
  "data": {
    "result": {
      "status": "success",
      "data": [1, 2, 3, 4, 5]
    },
    "type": "object",
    "executionTime": 230
  },
  "metadata": {
    "functionFound": true,
    "functionType": "function",
    "executionTime": 230
  }
}
```

### Error Conditions

| Error | Code | Recovery |
|-------|------|----------|
| Function not found | `FUNCTION_NOT_FOUND` | Check function path and window scope |
| Not a function | `NOT_A_FUNCTION` | Target is not callable |
| Function threw error | `FUNCTION_ERROR` | Check function error message |
| Timeout | `EXECUTION_TIMEOUT` | Increase timeout or check for infinite loops |

### Security & Safety

- Executes application code (not arbitrary code)
- Full access to application context
- Should validate function exists and is callable
- Errors are caught and returned safely

### Code Examples

**Call Window Function:**
```javascript
{
  "id": 20,
  "command": "call_function",
  "functionName": "window.loadData",
  "args": [{ "page": 1, "limit": 10 }],
  "awaitPromise": true
}
```

**Call Namespaced Function:**
```javascript
{
  "id": 21,
  "command": "call_function",
  "functionName": "window.app.api.fetchUsers",
  "args": ["active"]
}
```

---

## Command 10: get_global_variable

**Category**: JavaScript Execution  
**Stability**: Stable  
**Performance**: < 50ms  
**Use Case**: Retrieve value of global variable or property

### Purpose

Read global variables and window properties. Returns serialized values.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `name` | string | Yes | - | Variable path (e.g., "window.app.config.apiUrl") |
| `deep` | number | No | 2 | Depth for nested object inspection |
| `serialize` | boolean | No | true | Attempt JSON serialization |
| `includeType` | boolean | No | true | Include type information |

### Response

```json
{
  "success": true,
  "data": {
    "name": "window.app.config",
    "value": {
      "apiUrl": "https://api.example.com",
      "version": "2.1.0",
      "features": ["auth", "analytics", "export"]
    },
    "type": "object",
    "exists": true,
    "writable": true
  },
  "metadata": {
    "depth": 2,
    "executionTime": 8
  }
}
```

### Error Conditions

| Error | Code | Recovery |
|-------|------|----------|
| Variable not found | `VARIABLE_NOT_FOUND` | Check variable path |
| Non-serializable | `NON_SERIALIZABLE` | Value cannot be JSON serialized |
| Invalid path | `INVALID_PATH` | Use dot notation (e.g., window.app.value) |

### Performance Expectations

- Simple variable: 5-10ms
- Nested object: 10-30ms

### Security & Safety

- Read-only operation
- Can read any global variable
- May expose sensitive data (API keys, tokens)
- Should sanitize sensitive values in output

### Code Examples

**Read Simple Variable:**
```javascript
{
  "id": 22,
  "command": "get_global_variable",
  "name": "window.location.href"
}
```

**Read Nested Object:**
```javascript
{
  "id": 23,
  "command": "get_global_variable",
  "name": "window.app.config",
  "deep": 3
}
```

---

## Command 11: set_global_variable

**Category**: JavaScript Execution  
**Stability**: Stable  
**Performance**: < 50ms  
**Use Case**: Set global variable value

### Purpose

Set global variables and window properties with validation.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `name` | string | Yes | - | Variable path to set |
| `value` | any | Yes | - | Value to assign (must be JSON serializable) |
| `create` | boolean | No | true | Create intermediate objects if missing |
| `overwrite` | boolean | No | true | Allow overwriting existing values |
| `restore` | boolean | No | false | Save original for restoration |

### Response

```json
{
  "success": true,
  "data": {
    "name": "window.myVar",
    "value": "new_value",
    "previous": "old_value",
    "created": true,
    "restoreId": "restore-xyz789"
  },
  "metadata": {
    "writable": true,
    "executionTime": 12
  }
}
```

### Error Conditions

| Error | Code | Recovery |
|-------|------|----------|
| Not writable | `NOT_WRITABLE` | Variable is read-only |
| Invalid path | `INVALID_PATH` | Check variable path |
| Type mismatch | `TYPE_MISMATCH` | Value doesn't match expected type |
| Cannot create path | `CANNOT_CREATE_PATH` | Use create: true or set intermediate objects |

### Security & Safety

- Can modify application state
- Changes are non-persistent (revert on reload)
- Should validate values before setting
- Can break application if misused

### Code Examples

**Set Simple Variable:**
```javascript
{
  "id": 24,
  "command": "set_global_variable",
  "name": "window.debugMode",
  "value": true
}
```

**Set Nested Property with Restore:**
```javascript
{
  "id": 25,
  "command": "set_global_variable",
  "name": "window.app.config.apiUrl",
  "value": "https://staging-api.example.com",
  "restore": true
}
```

---

## Command 12: inspect_object

**Category**: JavaScript Execution  
**Stability**: Stable  
**Performance**: < 100ms  
**Use Case**: Deep inspection of object structure and properties

### Purpose

Inspect complex objects with type information, methods, properties, and prototype chain.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `objectPath` | string | Yes | - | Path to object (e.g., "window.app") |
| `depth` | number | No | 3 | Inspection depth |
| `includePrototype` | boolean | No | true | Show prototype chain |
| `includeMethods` | boolean | No | true | Include methods in output |
| `maxItems` | number | No | 50 | Max properties to return |

### Response

```json
{
  "success": true,
  "data": {
    "object": "window.app",
    "type": "object",
    "constructor": "Object",
    "properties": [
      {
        "name": "config",
        "type": "object",
        "writable": true,
        "enumerable": true,
        "value": { "apiUrl": "...", "version": "2.1.0" }
      },
      {
        "name": "getData",
        "type": "function",
        "writable": true,
        "enumerable": false
      }
    ],
    "prototype": {
      "methods": ["constructor", "hasOwnProperty"],
      "chain": ["Object.prototype"]
    }
  },
  "metadata": {
    "propertyCount": 8,
    "methodCount": 3,
    "executionTime": 45
  }
}
```

### Error Conditions

| Error | Code | Recovery |
|-------|------|----------|
| Object not found | `OBJECT_NOT_FOUND` | Check path |
| Circular reference | `CIRCULAR_REFERENCE` | Depth limit applied |
| Not an object | `NOT_AN_OBJECT` | Target is primitive or null |

### Performance Expectations

- Simple object: 10-30ms
- Complex with prototype chain: 50-100ms

### Security & Safety

- Read-only inspection
- Safe for all objects
- Circular references are handled
- Can expose sensitive data

### Code Examples

**Inspect Application Object:**
```javascript
{
  "id": 26,
  "command": "inspect_object",
  "objectPath": "window.app",
  "depth": 2,
  "maxItems": 20
}
```

---

## Command 13: modify_prototype

**Category**: JavaScript Execution  
**Stability**: Advanced  
**Performance**: < 100ms  
**Use Case**: Modify object prototypes for behavior patching

### Purpose

Add, modify, or replace methods on object prototypes. Used for monkey-patching and behavior modification.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `targetPrototype` | string | Yes | - | Prototype path (e.g., "Array.prototype") |
| `method` | string | Yes | - | Method name to add/replace |
| `implementation` | string | Yes | - | Function implementation code |
| `restore` | boolean | No | false | Save original for restoration |
| `checkExisting` | boolean | No | true | Preserve existing method code |

### Response

```json
{
  "success": true,
  "data": {
    "prototype": "Array.prototype",
    "method": "custom_sum",
    "type": "new",
    "previous": null,
    "restoreId": "restore-abc123"
  },
  "metadata": {
    "executionTime": 28
  }
}
```

### Error Conditions

| Error | Code | Recovery |
|-------|------|----------|
| Prototype not found | `PROTOTYPE_NOT_FOUND` | Check prototype path |
| Not writable | `NOT_WRITABLE` | Prototype is frozen/sealed |
| Syntax error | `SYNTAX_ERROR` | Check function implementation |
| Method exists | `METHOD_EXISTS` | Use different name or set overwrite |

### Security & Safety

- DANGEROUS: Modifies global behavior
- Changes affect all instances
- Can break application if misused
- Non-persistent (revert on reload)
- Should log modifications

### Code Examples

**Add Array Method:**
```javascript
{
  "id": 27,
  "command": "modify_prototype",
  "targetPrototype": "Array.prototype",
  "method": "custom_filter",
  "implementation": "function(predicate) { return this.filter(predicate); }",
  "restore": true
}
```

---

## Command 14: list_globals

**Category**: JavaScript Execution  
**Stability**: Stable  
**Performance**: < 200ms  
**Use Case**: Enumerate all global variables and functions

### Purpose

List all global variables, functions, and objects in window scope.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `filter` | string | No | - | Filter by type (function, object, primitive) |
| `namePattern` | string | No | - | Regex pattern to match names |
| `sort` | string | No | "name" | Sort order (name, type, size) |
| `limit` | number | No | 200 | Max items to return |
| `includeNative` | boolean | No | true | Include built-in globals |

### Response

```json
{
  "success": true,
  "data": {
    "globals": [
      {
        "name": "Array",
        "type": "function",
        "writable": false,
        "native": true
      },
      {
        "name": "app",
        "type": "object",
        "writable": true,
        "native": false,
        "properties": 5,
        "methods": 8
      },
      {
        "name": "DEBUG",
        "type": "boolean",
        "writable": true,
        "native": false,
        "value": true
      }
    ]
  },
  "metadata": {
    "totalGlobals": 47,
    "returned": 47,
    "customGlobals": 12,
    "executionTime": 67
  }
}
```

### Error Conditions

| Error | Code | Recovery |
|-------|------|----------|
| Filter invalid | `INVALID_FILTER` | Use: function, object, or primitive |
| Regex invalid | `INVALID_REGEX` | Check pattern syntax |

### Performance Expectations

- Full listing: 50-200ms
- With filter: 30-100ms

### Security & Safety

- Read-only enumeration
- Safe for inspection
- May expose application structure

### Code Examples

**List All Functions:**
```javascript
{
  "id": 28,
  "command": "list_globals",
  "filter": "function",
  "limit": 50
}
```

**Search Globals:**
```javascript
{
  "id": 29,
  "command": "list_globals",
  "namePattern": "^app.*",
  "sort": "name"
}
```

---

# NETWORK CONTROL COMMANDS

## Command 15: intercept_request

**Category**: Network Control  
**Stability**: Advanced  
**Performance**: < 50ms setup, network latency dependent  
**Use Case**: Intercept and monitor network requests

### Purpose

Set up request interception with pattern matching. Intercepts matching requests before they're sent.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `pattern` | string | Yes | - | URL pattern to match (regex or glob) |
| `methods` | string[] | No | ["GET", "POST"] | HTTP methods to intercept |
| `action` | string | No | "log" | Action (log, block, modify, mock) |
| `id` | string | No | - | Interception ID for reference |
| `enabled` | boolean | No | true | Enable immediately |

### Response

```json
{
  "success": true,
  "data": {
    "intercept": {
      "id": "intercept-xhr-api",
      "pattern": "https://api.example.com/.*",
      "methods": ["GET", "POST"],
      "action": "log",
      "enabled": true,
      "matchedRequests": 0
    }
  },
  "metadata": {
    "executionTime": 12
  }
}
```

### Error Conditions

| Error | Code | Recovery |
|-------|------|----------|
| Invalid pattern | `INVALID_PATTERN` | Check regex/glob syntax |
| Invalid action | `INVALID_ACTION` | Use: log, block, modify, or mock |
| ID exists | `DUPLICATE_ID` | Use different ID |

### Security & Safety

- Intercepts all matching requests
- Can block or redirect requests
- Changes visible to page JavaScript
- Non-persistent (revert on reload)

### Code Examples

**Intercept API Requests:**
```javascript
{
  "id": 30,
  "command": "intercept_request",
  "pattern": "https://api.example.com/v1/.*",
  "methods": ["GET", "POST", "PUT"],
  "action": "log",
  "id": "api-logger"
}
```

---

## Command 16: modify_request

**Category**: Network Control  
**Stability**: Advanced  
**Performance**: < 100ms  
**Use Case**: Modify request headers, body, URL before sending

### Purpose

Modify intercepted requests before they're sent to server.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `interceptId` | string | Yes | - | ID of active intercept |
| `modifications` | object | Yes | - | Headers, body, URL changes |
| `append` | boolean | No | false | Append to headers (vs replace) |
| `requestId` | string | No | - | Specific request ID to modify |

### Response

```json
{
  "success": true,
  "data": {
    "modified": {
      "headers": {
        "Authorization": "Bearer new-token",
        "X-Custom": "value"
      },
      "url": "https://api.example.com/v2/endpoint",
      "body": { "updated": true }
    },
    "applied": true
  }
}
```

### Code Examples

**Add Authorization Header:**
```javascript
{
  "id": 31,
  "command": "modify_request",
  "interceptId": "api-logger",
  "modifications": {
    "headers": {
      "Authorization": "Bearer eyJhbGc...",
      "X-Request-ID": "req-12345"
    }
  },
  "append": true
}
```

---

## Command 17: mock_response

**Category**: Network Control  
**Stability**: Advanced  
**Performance**: < 50ms  
**Use Case**: Return mock response for intercepted request

### Purpose

Mock responses for intercepted requests without contacting server.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `interceptId` | string | Yes | - | Intercept ID to mock |
| `statusCode` | number | No | 200 | HTTP status code |
| `headers` | object | No | {} | Response headers |
| `body` | string | No | "" | Response body (JSON or text) |
| `delay` | number | No | 0 | Delay response (ms) |

### Response

```json
{
  "success": true,
  "data": {
    "mockSetup": {
      "interceptId": "api-logger",
      "statusCode": 200,
      "headers": { "Content-Type": "application/json" },
      "bodySize": 156,
      "delay": 500
    }
  }
}
```

### Code Examples

**Mock API Response:**
```javascript
{
  "id": 32,
  "command": "mock_response",
  "interceptId": "api-logger",
  "statusCode": 200,
  "headers": { "Content-Type": "application/json" },
  "body": "{ \"users\": [{ \"id\": 1, \"name\": \"John\" }] }",
  "delay": 200
}
```

---

## Command 18: replay_request

**Category**: Network Control  
**Stability**: Stable  
**Performance**: Network latency dependent  
**Use Case**: Resend captured request

### Purpose

Replay a previously captured request with optional modifications.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `requestId` | string | Yes | - | Captured request ID |
| `modifications` | object | No | {} | Changes to apply before replaying |
| `count` | number | No | 1 | Number of times to replay |
| `delay` | number | No | 0 | Delay between replays (ms) |

### Response

```json
{
  "success": true,
  "data": {
    "replayed": {
      "requestId": "req-12345",
      "count": 3,
      "results": [
        { "statusCode": 200, "time": 145 },
        { "statusCode": 200, "time": 142 },
        { "statusCode": 200, "time": 148 }
      ],
      "averageTime": 145
    }
  }
}
```

---

## Command 19: capture_request_body

**Category**: Network Control  
**Stability**: Stable  
**Performance**: < 50ms  
**Use Case**: Capture request body content

### Purpose

Capture and store request body for later analysis or replay.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `interceptId` | string | Yes | - | Intercept ID to capture from |
| `parseJson` | boolean | No | true | Parse JSON if applicable |
| `maxSize` | number | No | 1000000 | Max size to capture (bytes) |
| `storeId` | string | No | - | ID to store captured data |

### Response

```json
{
  "success": true,
  "data": {
    "captured": {
      "storeId": "req-body-12345",
      "size": 2048,
      "type": "application/json",
      "parsed": true,
      "preview": { "action": "login", "username": "john" }
    }
  }
}
```

---

## Command 20: modify_response_body

**Category**: Network Control  
**Stability**: Advanced  
**Performance**: < 100ms  
**Use Case**: Modify server response before page receives it

### Purpose

Intercept and modify server response body before page processes it.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `interceptId` | string | Yes | - | Intercept ID |
| `modifications` | object\|string | Yes | - | JSON patches or text replacements |
| `format` | string | No | "auto" | Format (json, text, auto-detect) |
| `patch` | string | No | "merge" | Patch strategy (merge, replace, jsonpatch) |

### Response

```json
{
  "success": true,
  "data": {
    "modified": {
      "interceptId": "api-logger",
      "modified": true,
      "originalSize": 2048,
      "newSize": 2156,
      "changes": ["field1 updated", "field2 added"]
    }
  }
}
```

---

## Command 21: list_network_events

**Category**: Network Control  
**Stability**: Stable  
**Performance**: < 100ms  
**Use Case**: List captured network requests

### Purpose

Return all captured network requests/responses matching criteria.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `filter` | object | No | {} | Filter criteria (status, type, size) |
| `limit` | number | No | 100 | Max items to return |
| `sort` | string | No | "time" | Sort order (time, size, status) |
| `detailed` | boolean | No | false | Include full headers and body |

### Response

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "req-001",
        "url": "https://api.example.com/users",
        "method": "GET",
        "statusCode": 200,
        "time": 145,
        "size": 2048,
        "type": "xhr"
      }
    ],
    "total": 47,
    "returned": 20
  }
}
```

---

## Command 22: clear_network_cache

**Category**: Network Control  
**Stability**: Stable  
**Performance**: < 50ms  
**Use Case**: Clear captured network data

### Purpose

Clear captured network events and stored request/response data.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `filter` | string | No | "all" | What to clear (all, events, storage, stale) |
| `olderThan` | number | No | - | Clear events older than (ms) |
| `pattern` | string | No | - | Clear matching URLs only |

### Response

```json
{
  "success": true,
  "data": {
    "cleared": {
      "events": 47,
      "storage": 23,
      "totalSize": 1048576
    }
  }
}
```

---

# STORAGE ACCESS COMMANDS

## Command 23: get_localstorage

**Category**: Storage Access  
**Stability**: Stable  
**Performance**: < 50ms  
**Use Case**: Read localStorage data

### Purpose

Access and retrieve localStorage values for current domain.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `key` | string | No | - | Specific key (or null for all) |
| `keys` | string[] | No | - | Multiple specific keys |
| `pattern` | string | No | - | Regex pattern to match keys |
| `parse` | boolean | No | true | Attempt JSON parsing |
| `limit` | number | No | 100 | Max items to return |

### Response

```json
{
  "success": true,
  "data": {
    "storage": {
      "theme": "dark",
      "user_id": "12345",
      "settings": "{\"notifications\": true}",
      "session_token": "eyJhbGc..."
    },
    "count": 4,
    "size": 1024
  },
  "metadata": {
    "totalItems": 12,
    "returned": 4,
    "executionTime": 8
  }
}
```

### Error Conditions

| Error | Code | Recovery |
|-------|------|----------|
| Storage empty | `STORAGE_EMPTY` | No localStorage data |
| Key not found | `KEY_NOT_FOUND` | Check key spelling |
| Access denied | `ACCESS_DENIED` | Check domain/protocol |

### Security & Safety

- Read-only by default
- May expose sensitive data (tokens, passwords)
- Respects same-origin policy
- Should sanitize sensitive values

### Code Examples

**Read All localStorage:**
```javascript
{
  "id": 33,
  "command": "get_localstorage"
}
```

**Read Specific Keys:**
```javascript
{
  "id": 34,
  "command": "get_localstorage",
  "keys": ["theme", "user_id", "session"]
}
```

---

## Command 24: set_localstorage

**Category**: Storage Access  
**Stability**: Stable  
**Performance**: < 50ms  
**Use Case**: Write to localStorage

### Purpose

Set localStorage values with validation.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `key` | string | Yes | - | Storage key |
| `value` | string | Yes | - | Value to store |
| `stringify` | boolean | No | true | JSON.stringify if needed |
| `backup` | boolean | No | false | Save original for restoration |
| `ttl` | number | No | - | Time-to-live (ms, optional) |

### Response

```json
{
  "success": true,
  "data": {
    "key": "user_preference",
    "value": "{\"theme\":\"dark\"}",
    "stored": true,
    "backupId": "backup-abc123"
  }
}
```

### Code Examples

**Simple Value:**
```javascript
{
  "id": 35,
  "command": "set_localstorage",
  "key": "theme",
  "value": "dark"
}
```

**JSON Object:**
```javascript
{
  "id": 36,
  "command": "set_localstorage",
  "key": "user_settings",
  "value": "{\"notifications\":true,\"language\":\"en\"}",
  "backup": true
}
```

---

## Command 25: get_sessionstorage

**Category**: Storage Access  
**Stability**: Stable  
**Performance**: < 50ms  
**Use Case**: Read sessionStorage data

### Purpose

Access and retrieve sessionStorage values (session-only storage).

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `key` | string | No | - | Specific key (or null for all) |
| `keys` | string[] | No | - | Multiple specific keys |
| `parse` | boolean | No | true | Attempt JSON parsing |
| `limit` | number | No | 100 | Max items to return |

### Response

```json
{
  "success": true,
  "data": {
    "storage": {
      "session_id": "sess-12345",
      "page_state": "{\"scrollY\": 250, \"filters\": {\"status\": \"active\"}}"
    },
    "count": 2
  }
}
```

### Code Examples

**Read All sessionStorage:**
```javascript
{
  "id": 37,
  "command": "get_sessionstorage"
}
```

---

## Command 26: clear_storage

**Category**: Storage Access  
**Stability**: Stable  
**Performance**: < 50ms  
**Use Case**: Clear localStorage or sessionStorage

### Purpose

Clear storage with optional filtering.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `type` | string | No | "local" | Storage type (local, session, both) |
| `pattern` | string | No | - | Only clear keys matching pattern |
| `exclude` | string[] | No | [] | Keys to preserve |
| `backup` | boolean | No | false | Save backup before clearing |

### Response

```json
{
  "success": true,
  "data": {
    "cleared": {
      "localStorage": 8,
      "sessionStorage": 3,
      "backupId": "backup-xyz789"
    }
  }
}
```

---

## Command 27: access_indexeddb

**Category**: Storage Access  
**Stability**: Advanced  
**Performance**: 50-500ms depending on data  
**Use Case**: Access IndexedDB data

### Purpose

Query and retrieve IndexedDB data for inspection and testing.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `database` | string | Yes | - | Database name |
| `objectStore` | string | No | - | Object store name (or null for all) |
| `query` | object | No | {} | Query criteria (index, range, key) |
| `limit` | number | No | 100 | Max records to return |
| `parse` | boolean | No | true | Parse blob/complex types |

### Response

```json
{
  "success": true,
  "data": {
    "database": "appdb",
    "objectStore": "users",
    "records": [
      {
        "key": 1,
        "data": {
          "id": 1,
          "name": "John",
          "email": "john@example.com",
          "created": "2026-01-15T10:00:00Z"
        }
      }
    ],
    "total": 47,
    "returned": 20
  }
}
```

### Code Examples

**Query IndexedDB:**
```javascript
{
  "id": 38,
  "command": "access_indexeddb",
  "database": "appdb",
  "objectStore": "users",
  "limit": 50
}
```

---

## Command 28: export_storage

**Category**: Storage Access  
**Stability**: Stable  
**Performance**: 100-1000ms depending on size  
**Use Case**: Export all storage data

### Purpose

Export all storage (localStorage, sessionStorage, IndexedDB) in structured format.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `format` | string | No | "json" | Export format (json, csv, sqlite) |
| `include` | string[] | No | ["local", "session", "indexed"] | What to include |
| `prettify` | boolean | No | false | Pretty-print JSON |
| `compress` | boolean | No | false | Compress output |

### Response

```json
{
  "success": true,
  "data": {
    "export": {
      "format": "json",
      "timestamp": "2026-06-20T12:34:56Z",
      "size": 10240,
      "compressed": false,
      "included": ["localStorage", "sessionStorage"],
      "downloadUrl": "data:application/json;base64,eyJ..."
    }
  }
}
```

---

## Command 29: clear_all_storage

**Category**: Storage Access  
**Stability**: Stable  
**Performance**: < 500ms  
**Use Case**: Complete storage wipe

### Purpose

Clear all storage data (localStorage, sessionStorage, IndexedDB, cookies).

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `confirm` | boolean | Yes | - | Confirmation required |
| `backup` | boolean | No | false | Create backup before clearing |
| `except` | string[] | No | [] | Storage keys to preserve |

### Response

```json
{
  "success": true,
  "data": {
    "cleared": {
      "localStorage": 12,
      "sessionStorage": 5,
      "indexedDB": 3,
      "cookies": 18
    },
    "backupId": "backup-full-12345"
  }
}
```

---

# DEVTOOLS COMMANDS

## Command 30: enable_debugging

**Category**: DevTools  
**Stability**: Advanced  
**Performance**: < 200ms  
**Use Case**: Enable browser DevTools debugging

### Purpose

Enable DevTools debugging interface for deep inspection.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `features` | string[] | No | ["debugger", "console", "network"] | Features to enable |
| `breakOnLoad` | boolean | No | false | Break on page load |
| `breakOnErrors` | boolean | No | false | Break on uncaught errors |
| `recordNetwork` | boolean | No | true | Record all network activity |

### Response

```json
{
  "success": true,
  "data": {
    "debuggerEnabled": true,
    "features": {
      "debugger": true,
      "console": true,
      "network": true,
      "timeline": false
    },
    "breakpoints": [],
    "sessionId": "debug-12345"
  }
}
```

---

## Command 31: set_breakpoint

**Category**: DevTools  
**Stability**: Advanced  
**Performance**: < 100ms  
**Use Case**: Set breakpoint at location

### Purpose

Set breakpoint in JavaScript code for debugging.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `location` | object | Yes | - | File, line, column |
| `condition` | string | No | - | Conditional breakpoint (JS expression) |
| `logMessage` | string | No | - | Logpoint message instead of breaking |
| `hitCount` | number | No | 0 | Break after N hits |
| `enabled` | boolean | No | true | Enable immediately |

### Response

```json
{
  "success": true,
  "data": {
    "breakpoint": {
      "id": "bp-001",
      "location": { "file": "app.js", "line": 42, "column": 5 },
      "condition": null,
      "enabled": true,
      "hitCount": 0
    }
  }
}
```

---

## Command 32: resume_execution

**Category**: DevTools  
**Stability**: Advanced  
**Performance**: < 100ms  
**Use Case**: Resume paused execution

### Purpose

Resume JavaScript execution after hitting breakpoint.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `stepMode` | string | No | "resume" | Mode (resume, stepOver, stepInto, stepOut) |
| `breakpointId` | string | No | - | Specific breakpoint to skip next time |

### Response

```json
{
  "success": true,
  "data": {
    "resumed": true,
    "mode": "resume",
    "nextPause": null
  }
}
```

---

## Command 33: get_call_stack

**Category**: DevTools  
**Stability**: Advanced  
**Performance**: < 100ms  
**Use Case**: Get current call stack

### Purpose

Retrieve current call stack during debugging.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `detailed` | boolean | No | false | Include local variables |
| `maxDepth` | number | No | 50 | Max stack frames to return |

### Response

```json
{
  "success": true,
  "data": {
    "callStack": [
      {
        "functionName": "handleSubmit",
        "location": { "file": "form.js", "line": 125 },
        "variables": {
          "event": "PointerEvent",
          "formData": { "email": "user@example.com" }
        }
      },
      {
        "functionName": "processForm",
        "location": { "file": "form.js", "line": 85 }
      }
    ],
    "depth": 2
  }
}
```

---

## Command 34: profile_performance

**Category**: DevTools  
**Stability**: Advanced  
**Performance**: 100-5000ms depending on duration  
**Use Case**: Profile JavaScript performance

### Purpose

Profile and measure JavaScript execution performance.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `duration` | number | No | 5000 | Profile duration (ms) |
| `script` | string | No | - | Script to profile (or current page) |
| `metrics` | string[] | No | ["cpu", "memory"] | What to measure |
| `sampleRate` | number | No | 1000 | Sample rate (Hz) |

### Response

```json
{
  "success": true,
  "data": {
    "profile": {
      "duration": 5000,
      "samples": 5000,
      "topFunctions": [
        {
          "name": "renderFrame",
          "selfTime": 1250,
          "totalTime": 2500,
          "callCount": 60
        }
      ],
      "memory": {
        "heapSize": 15728640,
        "maxHeap": 33554432,
        "jsHeap": 8388608
      }
    }
  }
}
```

---

## Command 35: inspect_memory

**Category**: DevTools  
**Stability**: Advanced  
**Performance**: 100-1000ms  
**Use Case**: Inspect memory usage and detect leaks

### Purpose

Analyze memory usage, objects, and potential leaks.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `type` | string | No | "heap" | Type (heap, timeline, allocation) |
| `detailed` | boolean | No | false | Include object list |
| `topN` | number | No | 20 | Top N objects to return |

### Response

```json
{
  "success": true,
  "data": {
    "memory": {
      "jsHeapSize": 8388608,
      "jsHeapLimit": 33554432,
      "externalMemory": 2097152,
      "totalJSHeapSize": 10485760,
      "topObjects": [
        {
          "type": "String",
          "count": 12548,
          "size": 4194304
        }
      ]
    }
  }
}
```

---

## Command 36: get_console_output

**Category**: DevTools  
**Stability**: Stable  
**Performance**: < 100ms  
**Use Case**: Retrieve browser console messages

### Purpose

Get console.log, console.error, and other console messages.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `level` | string | No | "all" | Filter level (all, log, error, warn, info) |
| `limit` | number | No | 100 | Max messages to return |
| `since` | number | No | - | Messages since timestamp (ms) |
| `pattern` | string | No | - | Text pattern to match |

### Response

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "level": "log",
        "message": "Application initialized",
        "timestamp": 1234567890,
        "source": "app.js:10"
      },
      {
        "level": "error",
        "message": "Failed to fetch user data",
        "timestamp": 1234567900,
        "source": "api.js:45"
      }
    ],
    "total": 42,
    "returned": 2
  }
}
```

---

# CSS INJECTION COMMANDS

## Command 37: inject_stylesheet

**Category**: CSS Injection  
**Stability**: Stable  
**Performance**: < 50ms  
**Use Case**: Inject external stylesheet

### Purpose

Load and inject an external stylesheet into the page.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `url` | string | Yes | - | Stylesheet URL |
| `media` | string | No | "all" | Media query (screen, print, etc.) |
| `id` | string | No | - | ID for later reference |
| `persist` | boolean | No | false | Persist after navigation |
| `priority` | number | No | 0 | Load priority (higher = earlier) |

### Response

```json
{
  "success": true,
  "data": {
    "stylesheet": {
      "id": "injected-css-1",
      "url": "https://example.com/custom.css",
      "media": "screen",
      "loaded": true,
      "rules": 42,
      "size": 3072
    }
  }
}
```

---

## Command 38: inject_inline_style

**Category**: CSS Injection  
**Stability**: Stable  
**Performance**: < 50ms  
**Use Case**: Inject inline CSS rules

### Purpose

Inject CSS as <style> tag with inline rules.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `css` | string | Yes | - | CSS rules text |
| `id` | string | No | - | Style tag ID |
| `media` | string | No | "all" | Media query |
| `scoped` | boolean | No | false | Scoped to element |
| `target` | string | No | "head" | Where to inject (head, body) |

### Response

```json
{
  "success": true,
  "data": {
    "style": {
      "id": "style-injected-1",
      "rules": 5,
      "applied": true,
      "specificity": "medium"
    }
  }
}
```

### Code Examples

**Inject CSS Rules:**
```javascript
{
  "id": 39,
  "command": "inject_inline_style",
  "css": "
    .hidden { display: none !important; }
    .alert { background: red; color: white; padding: 10px; }
  ",
  "id": "custom-styles"
}
```

---

## Command 39: modify_stylesheet

**Category**: CSS Injection  
**Stability**: Advanced  
**Performance**: < 100ms  
**Use Case**: Modify existing stylesheet rules

### Purpose

Modify CSS rules in existing stylesheets.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | CSS selector to modify |
| `rules` | object | Yes | - | CSS properties to set |
| `important` | boolean | No | false | Mark as !important |
| `index` | number | No | - | Sheet index if multiple |

### Response

```json
{
  "success": true,
  "data": {
    "modified": {
      "selector": ".button",
      "properties": ["backgroundColor", "borderRadius"],
      "applied": true,
      "sheetsModified": 1
    }
  }
}
```

---

## Command 40: inject_animation

**Category**: CSS Injection  
**Stability**: Stable  
**Performance**: < 100ms  
**Use Case**: Inject CSS animations

### Purpose

Inject @keyframes animation rules.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `name` | string | Yes | - | Animation name |
| `frames` | object | Yes | - | Keyframe definitions (0%, 50%, 100%) |
| `duration` | number | No | 1000 | Duration (ms) |
| `timingFunction` | string | No | "ease" | Timing function |
| `iterationCount` | number | No | 1 | Loop count (0 = infinite) |

### Response

```json
{
  "success": true,
  "data": {
    "animation": {
      "name": "fadeInSlide",
      "duration": 500,
      "injected": true,
      "id": "anim-001"
    }
  }
}
```

---

## Command 41: inject_keyframes

**Category**: CSS Injection  
**Stability**: Stable  
**Performance**: < 100ms  
**Use Case**: Inject @keyframes CSS rules

### Purpose

Inject raw @keyframes rules with full control.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `keyframes` | string | Yes | - | Raw @keyframes CSS text |
| `id` | string | No | - | Reference ID |

### Response

```json
{
  "success": true,
  "data": {
    "keyframes": {
      "id": "kf-001",
      "animations": ["pulse", "bounce"],
      "injected": true
    }
  }
}
```

### Code Examples

**Inject Keyframes:**
```javascript
{
  "id": 40,
  "command": "inject_keyframes",
  "keyframes": "
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
  ",
  "id": "animations"
}
```

---

## Command 42: modify_theme

**Category**: CSS Injection  
**Stability**: Stable  
**Performance**: < 100ms  
**Use Case**: Change CSS custom properties (variables)

### Purpose

Modify CSS custom properties (--variable-name) for theming.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `variables` | object | Yes | - | CSS variable name/value pairs |
| `scope` | string | No | ":root" | Scope selector |
| `restore` | boolean | No | false | Save original for restoration |

### Response

```json
{
  "success": true,
  "data": {
    "theme": {
      "variables": {
        "--primary-color": "#007bff",
        "--secondary-color": "#6c757d",
        "--danger-color": "#dc3545"
      },
      "scope": ":root",
      "applied": true,
      "restoreId": "theme-backup-1"
    }
  }
}
```

---

## Command 43: add_css_rule

**Category**: CSS Injection  
**Stability**: Advanced  
**Performance**: < 100ms  
**Use Case**: Add single CSS rule to stylesheet

### Purpose

Add new CSS rule to stylesheet dynamically.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | CSS selector |
| `properties` | object | Yes | - | CSS property/value pairs |
| `index` | number | No | - | Position in stylesheet |
| `important` | boolean | No | false | Mark as !important |

### Response

```json
{
  "success": true,
  "data": {
    "rule": {
      "selector": ".new-class",
      "properties": 3,
      "added": true,
      "index": 42
    }
  }
}
```

---

## Command 44: remove_css_rule

**Category**: CSS Injection  
**Stability**: Advanced  
**Performance**: < 100ms  
**Use Case**: Remove CSS rule from stylesheet

### Purpose

Remove CSS rule by selector or index.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | No | - | CSS selector to remove |
| `index` | number | No | - | Rule index to remove |
| `all` | boolean | No | false | Remove all matching rules |

### Response

```json
{
  "success": true,
  "data": {
    "removed": {
      "selector": ".obsolete",
      "count": 1,
      "fromSheets": 1
    }
  }
}
```

---

# JAVASCRIPT INJECTION COMMANDS

## Command 45: inject_script

**Category**: JavaScript Injection  
**Stability**: Stable  
**Performance**: < 100ms  
**Use Case**: Inject JavaScript code into page

### Purpose

Inject JavaScript code as <script> tag.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `code` | string | Yes | - | JavaScript code to inject |
| `id` | string | No | - | Script ID for reference |
| `async` | boolean | No | false | Load asynchronously |
| `defer` | boolean | No | false | Defer execution |
| `target` | string | No | "head" | Where to inject (head, body) |

### Response

```json
{
  "success": true,
  "data": {
    "script": {
      "id": "injected-script-1",
      "executed": true,
      "errors": [],
      "executionTime": 45
    }
  }
}
```

### Code Examples

**Inject Script:**
```javascript
{
  "id": 41,
  "command": "inject_script",
  "code": "
    window.customFunction = function() {
      console.log('Injected function called');
      return { status: 'success' };
    };
  ",
  "id": "custom-func"
}
```

---

## Command 46: load_library

**Category**: JavaScript Injection  
**Stability**: Stable  
**Performance**: 100-5000ms  
**Use Case**: Load external JavaScript library

### Purpose

Load external JavaScript library via script tag.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `url` | string | Yes | - | Library URL |
| `id` | string | No | - | Script ID |
| `async` | boolean | No | true | Load asynchronously |
| `globalName` | string | No | - | Check for global variable |
| `timeout` | number | No | 30000 | Load timeout (ms) |

### Response

```json
{
  "success": true,
  "data": {
    "library": {
      "url": "https://cdn.example.com/lib.js",
      "loaded": true,
      "global": "window.MyLib",
      "version": "2.1.0",
      "loadTime": 1250
    }
  }
}
```

---

## Command 47: monkey_patch_function

**Category**: JavaScript Injection  
**Stability**: Advanced  
**Performance**: < 100ms  
**Use Case**: Replace function implementation

### Purpose

Replace existing function with new implementation while keeping original.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `functionPath` | string | Yes | - | Function path (e.g., "window.fetch") |
| `implementation` | string | Yes | - | New function code |
| `preserveOriginal` | boolean | No | true | Keep original as __original |
| `intercept` | boolean | No | false | Intercept calls (call original) |
| `restore` | boolean | No | false | Save for restoration |

### Response

```json
{
  "success": true,
  "data": {
    "patched": {
      "function": "window.fetch",
      "original": "function(resource, options) { ... }",
      "patchedAt": "2026-06-20T12:34:56Z",
      "restoreId": "patch-001"
    }
  }
}
```

---

## Command 48: hook_method

**Category**: JavaScript Injection  
**Stability**: Advanced  
**Performance**: < 100ms  
**Use Case**: Add before/after hooks to method

### Purpose

Add before/after hooks to existing method without replacing it.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `methodPath` | string | Yes | - | Method path |
| `before` | string | No | - | Code to run before method |
| `after` | string | No | - | Code to run after method |
| `id` | string | No | - | Hook ID for reference |

### Response

```json
{
  "success": true,
  "data": {
    "hook": {
      "id": "hook-001",
      "method": "window.addEventListener",
      "hooks": { "before": true, "after": true },
      "active": true
    }
  }
}
```

---

## Command 49: replace_global

**Category**: JavaScript Injection  
**Stability**: Advanced  
**Performance**: < 100ms  
**Use Case**: Replace global variable/object

### Purpose

Replace global variable with mock or different implementation.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `name` | string | Yes | - | Global variable name |
| `value` | any | Yes | - | Replacement value |
| `restore` | boolean | No | false | Save original for restoration |
| `preventRecreation` | boolean | No | false | Block reassignment |

### Response

```json
{
  "success": true,
  "data": {
    "replaced": {
      "global": "window.XMLHttpRequest",
      "with": "MockXHR",
      "restoreId": "global-replace-1"
    }
  }
}
```

---

## Command 50: inject_module

**Category**: JavaScript Injection  
**Stability**: Stable  
**Performance**: < 500ms  
**Use Case**: Inject ES6 module

### Purpose

Inject JavaScript as ES6 module with imports/exports.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `code` | string | Yes | - | Module code |
| `exports` | string[] | No | [] | Named exports to expose |
| `id` | string | No | - | Module ID |
| `importMap` | object | No | {} | Import map for resolution |

### Response

```json
{
  "success": true,
  "data": {
    "module": {
      "id": "module-001",
      "exports": ["getData", "processData"],
      "loaded": true,
      "accessible": "window.Module001"
    }
  }
}
```

---

## Command 51: list_injected_scripts

**Category**: JavaScript Injection  
**Stability**: Stable  
**Performance**: < 50ms  
**Use Case**: List all injected scripts

### Purpose

List all scripts and libraries injected by commands.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `detailed` | boolean | No | false | Include source code |
| `active` | boolean | No | true | Only active injections |

### Response

```json
{
  "success": true,
  "data": {
    "injections": [
      {
        "id": "injected-script-1",
        "type": "script",
        "loaded": true,
        "size": 245,
        "injectedAt": "2026-06-20T12:30:00Z",
        "status": "active"
      },
      {
        "id": "library-lodash",
        "type": "library",
        "url": "https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js",
        "loaded": true,
        "size": 71808,
        "status": "active"
      }
    ]
  }
}
```

---

## Command 52: remove_injected_script

**Category**: JavaScript Injection  
**Stability**: Stable  
**Performance**: < 100ms  
**Use Case**: Remove injected script or library

### Purpose

Remove script injection by ID.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `id` | string | Yes | - | Injection ID to remove |
| `cleanup` | boolean | No | true | Clean up globals from script |
| `force` | boolean | No | false | Force removal even if referenced |

### Response

```json
{
  "success": true,
  "data": {
    "removed": {
      "id": "injected-script-1",
      "cleanup": true,
      "globalsRemoved": 2
    }
  }
}
```

---

# DOM MANIPULATION ADVANCED COMMANDS

## Command 53: create_element_tree

**Category**: DOM Manipulation Advanced  
**Stability**: Stable  
**Performance**: 50-200ms depending on complexity  
**Use Case**: Create complex DOM structure

### Purpose

Create and insert complex DOM tree structure programmatically.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `parent` | string | Yes | - | Parent element selector |
| `structure` | object | Yes | - | Tree structure definition |
| `position` | string | No | "append" | Insert position (append, prepend, replace) |
| `attributes` | object | No | {} | Global attributes for all elements |
| `id` | string | No | - | Root element ID |

### Response

```json
{
  "success": true,
  "data": {
    "created": {
      "elements": 15,
      "parent": ".container",
      "position": "append",
      "rootId": "tree-001",
      "structure": "div > (form > (div.form-group*3)) > button"
    }
  }
}
```

### Code Examples

**Create Form Structure:**
```javascript
{
  "id": 42,
  "command": "create_element_tree",
  "parent": ".container",
  "structure": {
    "type": "form",
    "attributes": { "id": "myForm", "class": "form-container" },
    "children": [
      {
        "type": "div",
        "attributes": { "class": "form-group" },
        "children": [
          { "type": "label", "text": "Email:", "attributes": { "for": "email" } },
          { "type": "input", "attributes": { "type": "email", "id": "email", "name": "email" } }
        ]
      },
      {
        "type": "button",
        "text": "Submit",
        "attributes": { "type": "submit", "class": "btn btn-primary" }
      }
    ]
  }
}
```

---

## Command 54: batch_modify_elements

**Category**: DOM Manipulation Advanced  
**Stability**: Stable  
**Performance**: 50-500ms depending on count  
**Use Case**: Modify multiple elements efficiently

### Purpose

Apply modifications to multiple elements matching selector in single operation.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | CSS selector for target elements |
| `modifications` | object | Yes | - | Properties/attributes to apply |
| `operations` | string[] | No | ["properties", "attributes"] | What to modify |
| `limit` | number | No | 1000 | Max elements to modify |

### Response

```json
{
  "success": true,
  "data": {
    "modified": {
      "selector": "input[type='text']",
      "count": 5,
      "properties": ["value", "disabled"],
      "changes": [
        { "index": 0, "property": "disabled", "before": false, "after": true },
        { "index": 1, "property": "value", "before": "", "after": "test" }
      ]
    }
  }
}
```

---

## Command 55: clone_element_structure

**Category**: DOM Manipulation Advanced  
**Stability**: Stable  
**Performance**: 50-200ms  
**Use Case**: Clone element with or without children

### Purpose

Clone DOM element structure with optional deep copy.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | Element to clone |
| `deep` | boolean | No | true | Include children and content |
| `count` | number | No | 1 | Number of clones to create |
| `appendTo` | string | No | - | Parent selector for clones |
| `modifyAttributes` | object | No | {} | Attributes to change in clones |

### Response

```json
{
  "success": true,
  "data": {
    "cloned": {
      "original": "#card-template",
      "cloneCount": 5,
      "inserted": true,
      "appendedTo": ".cards-container",
      "ids": ["clone-1", "clone-2", "clone-3", "clone-4", "clone-5"]
    }
  }
}
```

---

## Command 56: move_elements

**Category**: DOM Manipulation Advanced  
**Stability**: Stable  
**Performance**: 50-200ms  
**Use Case**: Move elements to different location in DOM

### Purpose

Move elements from one location to another.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | Elements to move |
| `target` | string | Yes | - | Target parent selector |
| `position` | string | No | "append" | Position (append, prepend, before, after) |
| `reference` | string | No | - | Reference element for before/after |

### Response

```json
{
  "success": true,
  "data": {
    "moved": {
      "elements": 3,
      "from": ".old-container",
      "to": ".new-container",
      "position": "append"
    }
  }
}
```

---

## Command 57: wrap_elements

**Category**: DOM Manipulation Advanced  
**Stability**: Stable  
**Performance**: 50-200ms  
**Use Case**: Wrap elements in container

### Purpose

Wrap selected elements in new container element.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | Elements to wrap |
| `wrapper` | object | Yes | - | Wrapper element definition |
| `keepTogether` | boolean | No | false | Wrap all in single wrapper |
| `classes` | string[] | No | [] | Classes for wrapper |

### Response

```json
{
  "success": true,
  "data": {
    "wrapped": {
      "elements": 4,
      "wrapperType": "div",
      "wrapperClass": "wrapper-container",
      "wrapperCount": 4
    }
  }
}
```

---

## Command 58: unwrap_elements

**Category**: DOM Manipulation Advanced  
**Stability**: Stable  
**Performance**: 50-150ms  
**Use Case**: Remove wrapper element

### Purpose

Remove parent wrapper element, keeping children in place.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | Elements to unwrap |
| `depth` | number | No | 1 | How many levels to unwrap |

### Response

```json
{
  "success": true,
  "data": {
    "unwrapped": {
      "elements": 8,
      "parents": 4,
      "children": 8,
      "keptInPlace": true
    }
  }
}
```

---

## Command 59: template_injection

**Category**: DOM Manipulation Advanced  
**Stability**: Stable  
**Performance**: 50-500ms depending on template size  
**Use Case**: Inject HTML template with data binding

### Purpose

Inject HTML template with variable substitution.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | Parent element for injection |
| `template` | string | Yes | - | HTML template with {{variables}} |
| `data` | object | Yes | - | Data for variable substitution |
| `position` | string | No | "append" | Insert position |
| `repeat` | object | No | - | Repeat section with data array |

### Response

```json
{
  "success": true,
  "data": {
    "injected": {
      "parent": ".list-container",
      "items": 5,
      "template": "<div>{{name}}: {{value}}</div>",
      "success": true
    }
  }
}
```

---

## Command 60: svg_injection

**Category**: DOM Manipulation Advanced  
**Stability**: Stable  
**Performance**: 50-200ms  
**Use Case**: Inject SVG content

### Purpose

Inject SVG elements or content into page.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | Parent for SVG |
| `svg` | string | Yes | - | SVG markup or URL |
| `id` | string | No | - | SVG element ID |
| `responsive` | boolean | No | false | Make responsive |
| `styles` | object | No | {} | SVG styles/attributes |

### Response

```json
{
  "success": true,
  "data": {
    "svg": {
      "id": "injected-svg",
      "elements": 12,
      "size": 2048,
      "responsive": false
    }
  }
}
```

---

## Command 61: webcomponent_injection

**Category**: DOM Manipulation Advanced  
**Stability**: Advanced  
**Performance**: 100-500ms depending on component  
**Use Case**: Inject and initialize Web Component

### Purpose

Inject and initialize custom Web Component.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | Parent for component |
| `tagName` | string | Yes | - | Custom element tag name |
| `properties` | object | No | {} | Component properties |
| `attributes` | object | No | {} | HTML attributes |
| `slots` | object | No | {} | Slot content |

### Response

```json
{
  "success": true,
  "data": {
    "component": {
      "tagName": "my-component",
      "id": "comp-001",
      "properties": { "title": "Hello" },
      "initialized": true,
      "shadowDOM": true
    }
  }
}
```

---

## Command 62: modify_attributes_batch

**Category**: DOM Manipulation Advanced  
**Stability**: Stable  
**Performance**: 50-300ms  
**Use Case**: Modify attributes on multiple elements

### Purpose

Batch modify HTML attributes on multiple elements.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | Target elements |
| `attributes` | object | Yes | - | Attribute name/value pairs |
| `append` | boolean | No | false | Append to existing (e.g., classes) |
| `remove` | string[] | No | [] | Attributes to remove |
| `limit` | number | No | 1000 | Max elements |

### Response

```json
{
  "success": true,
  "data": {
    "modified": {
      "selector": "button",
      "elements": 7,
      "attributes": { "disabled": true, "aria-busy": true },
      "removed": 0
    }
  }
}
```

---

## Command 63: add_event_listeners_batch

**Category**: DOM Manipulation Advanced  
**Stability**: Advanced  
**Performance**: 50-300ms  
**Use Case**: Add event listeners to multiple elements

### Purpose

Add event listeners to multiple elements efficiently.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | Target elements |
| `events` | object | Yes | - | Event type and handler pairs |
| `capture` | boolean | No | false | Use capture phase |
| `once` | boolean | No | false | Remove after first trigger |
| `id` | string | No | - | Listener group ID |

### Response

```json
{
  "success": true,
  "data": {
    "listeners": {
      "selector": "button.action",
      "elements": 5,
      "events": ["click", "mouseenter"],
      "listeners": 10,
      "groupId": "btn-listeners-1"
    }
  }
}
```

---

## Command 64: remove_event_listeners_batch

**Category**: DOM Manipulation Advanced  
**Stability**: Advanced  
**Performance**: 50-300ms  
**Use Case**: Remove event listeners from multiple elements

### Purpose

Remove event listeners from multiple elements.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | Target elements |
| `events` | string[] | No | - | Specific events to remove (or all) |
| `groupId` | string | No | - | Remove specific listener group |

### Response

```json
{
  "success": true,
  "data": {
    "removed": {
      "selector": "button",
      "elements": 5,
      "listeners": 8,
      "events": ["click", "mouseenter"]
    }
  }
}
```

---

## Command 65: synchronize_elements

**Category**: DOM Manipulation Advanced  
**Stability**: Advanced  
**Performance**: 100-500ms depending on complexity  
**Use Case**: Keep multiple elements in sync

### Purpose

Set up two-way synchronization between multiple elements.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `elements` | string[] | Yes | - | Elements to synchronize |
| `property` | string | No | "value" | Property to sync |
| `bidirectional` | boolean | No | true | Two-way sync |
| `debounce` | number | No | 0 | Debounce delay (ms) |
| `id` | string | No | - | Sync group ID |

### Response

```json
{
  "success": true,
  "data": {
    "synchronized": {
      "elements": ["#input1", "#input2", "#input3"],
      "property": "value",
      "bidirectional": true,
      "groupId": "sync-group-1",
      "active": true
    }
  }
}
```

---

# INTEGRATION EXAMPLES

## Multi-Command Workflows

### Workflow 1: Form Inspection and Modification

```javascript
// Step 1: Find all form elements
{
  "id": 100,
  "command": "find_elements_by_selector",
  "selector": "input, select, textarea",
  "properties": ["type", "name", "value", "required"]
}

// Step 2: Get their computed styles
{
  "id": 101,
  "command": "get_computed_styles",
  "selector": "input",
  "properties": ["display", "visibility", "opacity"]
}

// Step 3: Modify all inputs
{
  "id": 102,
  "command": "batch_modify_elements",
  "selector": "input[type='text']",
  "modifications": {
    "value": "test-value",
    "disabled": false
  }
}

// Step 4: Get updated values
{
  "id": 103,
  "command": "execute_javascript",
  "script": "
    const form = document.querySelector('form');
    return new FormData(form);
  "
}
```

### Workflow 2: Network Interception and Mocking

```javascript
// Step 1: Set up interception
{
  "id": 110,
  "command": "intercept_request",
  "pattern": "https://api.example.com/users",
  "methods": ["GET", "POST"],
  "action": "log",
  "id": "user-api-logger"
}

// Step 2: Modify requests
{
  "id": 111,
  "command": "modify_request",
  "interceptId": "user-api-logger",
  "modifications": {
    "headers": {
      "Authorization": "Bearer token123"
    }
  }
}

// Step 3: Mock response
{
  "id": 112,
  "command": "mock_response",
  "interceptId": "user-api-logger",
  "statusCode": 200,
  "body": "{ \"users\": [{ \"id\": 1, \"name\": \"Test\" }] }",
  "delay": 500
}

// Step 4: Verify interception
{
  "id": 113,
  "command": "list_network_events",
  "limit": 10
}
```

### Workflow 3: Theme Customization

```javascript
// Step 1: Inject style rules
{
  "id": 120,
  "command": "inject_inline_style",
  "css": ".custom-btn { padding: 10px 20px; border-radius: 4px; }",
  "id": "custom-styles"
}

// Step 2: Modify theme variables
{
  "id": 121,
  "command": "modify_theme",
  "variables": {
    "--primary-color": "#0066ff",
    "--border-radius": "8px",
    "--shadow": "0 2px 8px rgba(0,0,0,0.1)"
  }
}

// Step 3: Inject animations
{
  "id": 122,
  "command": "inject_animation",
  "name": "slideIn",
  "frames": {
    "0%": { "transform": "translateX(-100%)", "opacity": 0 },
    "100%": { "transform": "translateX(0)", "opacity": 1 }
  },
  "duration": 300
}

// Step 4: Apply animation to elements
{
  "id": 123,
  "command": "modify_attributes_batch",
  "selector": ".modal",
  "attributes": {
    "style": "animation: slideIn 300ms ease-out;"
  }
}
```

---

# REAL-WORLD USAGE SCENARIOS

## Scenario 1: E-Commerce Testing

**Goal**: Automate testing of checkout flow with form validation and network mocking

```javascript
// 1. Navigate to checkout page
// 2. Find form fields
const findInputs = {
  "id": 201,
  "command": "find_elements_by_selector",
  "selector": "input[type='email'], input[type='text']",
  "properties": ["type", "name", "value", "required", "placeholder"]
};

// 3. Validate required fields
const getForm = {
  "id": 202,
  "command": "execute_javascript",
  "script": `
    const form = document.querySelector('form');
    const inputs = form.querySelectorAll('input[required]');
    return {
      total: inputs.length,
      empty: Array.from(inputs).filter(i => !i.value).length,
      fields: Array.from(inputs).map(i => ({ name: i.name, value: i.value }))
    };
  `
};

// 4. Fill form with test data
const fillForm = {
  "id": 203,
  "command": "batch_modify_elements",
  "selector": "input",
  "modifications": {
    "value": "test-value"
  }
};

// 5. Intercept payment API
const intercept = {
  "id": 204,
  "command": "intercept_request",
  "pattern": "https://api.example.com/payments",
  "action": "log",
  "id": "payment-api"
};

// 6. Mock successful payment response
const mockPayment = {
  "id": 205,
  "command": "mock_response",
  "interceptId": "payment-api",
  "statusCode": 200,
  "body": "{\"success\": true, \"transactionId\": \"txn-12345\"}",
  "delay": 1000
};

// 7. Submit form
const submit = {
  "id": 206,
  "command": "execute_javascript",
  "script": "document.querySelector('form').submit();"
};

// 8. Verify success
const verify = {
  "id": 207,
  "command": "wait_for_element",
  "selector": ".order-confirmation",
  "timeout": 5000
};
```

## Scenario 2: Data Extraction and Transformation

**Goal**: Extract complex data from page and transform for export

```javascript
// 1. Extract all data from visible elements
const extractData = {
  "id": 301,
  "command": "execute_javascript",
  "script": `
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    return rows.map(row => ({
      id: row.cells[0].textContent,
      name: row.cells[1].textContent,
      email: row.cells[2].textContent,
      status: row.cells[3].textContent,
      created: row.cells[4].textContent
    }));
  `
};

// 2. Get computed styles for layout analysis
const getStyles = {
  "id": 302,
  "command": "get_computed_styles",
  "selector": "table",
  "properties": ["width", "height", "fontSize", "color"]
};

// 3. Export to localStorage for later retrieval
const exportData = {
  "id": 303,
  "command": "set_localstorage",
  "key": "extracted_data",
  "value": JSON.stringify(extractedRows)
};

// 4. Generate DOM path for each row for reference
const getPaths = {
  "id": 304,
  "command": "get_dom_path",
  "selector": "table tbody tr:first-child",
  "format": "css"
};
```

## Scenario 3: Dynamic Content Interaction

**Goal**: Interact with dynamic, JavaScript-heavy interface

```javascript
// 1. Execute page initialization function
const init = {
  "id": 401,
  "command": "call_function",
  "functionName": "window.app.init",
  "args": [{ "debug": true }],
  "awaitPromise": true
};

// 2. Get current app state
const getState = {
  "id": 402,
  "command": "get_global_variable",
  "name": "window.app.state",
  "deep": 3
};

// 3. Trigger custom events
const triggerEvent = {
  "id": 403,
  "command": "execute_javascript",
  "script": `
    const event = new CustomEvent('app:refresh', { 
      detail: { filters: { status: 'active' } } 
    });
    window.dispatchEvent(event);
    return { eventFired: true };
  `
};

// 4. Monitor state changes
const monitorChanges = {
  "id": 404,
  "command": "hook_method",
  "methodPath": "window.app.setState",
  "before": "console.log('State changing:', arguments[0]);",
  "after": "console.log('State changed to:', window.app.state);"
};

// 5. Get updated UI elements
const getUpdated = {
  "id": 405,
  "command": "find_elements_by_selector",
  "selector": ".list-item",
  "properties": ["textContent", "className", "id"]
};
```

---

## Summary Table

| Category | Commands | Typical Use |
|----------|----------|-------------|
| DOM Access | 7 | Inspect, navigate DOM structure |
| JavaScript | 7 | Execute code, call functions |
| Network | 8 | Intercept, mock, monitor requests |
| Storage | 7 | Access localStorage, sessionStorage, IndexedDB |
| DevTools | 7 | Debug, profile, set breakpoints |
| CSS | 8 | Inject, modify, theme CSS |
| JavaScript Injection | 8 | Load libraries, monkey-patch, hooks |
| DOM Advanced | 13 | Batch operations, complex creation |
| **Total** | **65** | **Comprehensive browser control** |

---

## Version History

**v1.0** (June 20, 2026) - Initial specification for Phase 2 commands
- All 53 command specifications detailed
- Integration examples provided
- Real-world scenarios documented
- Performance expectations documented
- Security/safety notes included

---

## Next Steps

1. **Implementation Phase** - Develop command handlers (Weeks 1-4)
2. **Testing Phase** - Unit and integration tests (Weeks 3-5)
3. **Documentation** - API docs and examples (Weeks 5-6)
4. **Performance Validation** - Load testing (Week 6)
5. **Production Release** - v12.8.0 with all Phase 2 commands


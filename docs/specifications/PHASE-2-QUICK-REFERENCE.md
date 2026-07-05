# Phase 2 Commands - Quick Reference Guide

**Date**: June 20, 2026  
**Format**: Cheat sheet for developers  
**Total Commands**: 65 documented (53 Phase 2 + reference to 12 existing)

---

## Command Categories Summary

| Category | Commands | Key Use Cases |
|----------|----------|---------------|
| **DOM Access** | 7 | Get/set element properties, find elements, access shadow DOM |
| **JavaScript** | 7 | Execute code, call functions, inspect/modify globals |
| **Network** | 8 | Intercept requests, mock responses, monitor traffic |
| **Storage** | 7 | Read/write localStorage, sessionStorage, IndexedDB |
| **DevTools** | 7 | Debugging, profiling, breakpoints, call stacks |
| **CSS** | 8 | Inject stylesheets, modify rules, theme changes |
| **JS Injection** | 8 | Load libraries, monkey-patch, hook methods |
| **DOM Advanced** | 13 | Batch operations, complex creation, element sync |

---

## DOM Access Commands (1-7)

```bash
# 1. Get properties from element
get_element_properties
  selector (required), properties, computed, inherited, maxDepth
  → Returns: element properties, computed styles, inherited values

# 2. Set properties on element
set_element_properties
  selector (required), properties (required), unsafe, validate, rollback
  → Returns: updated properties, rollback ID

# 3. Get computed CSS styles
get_computed_styles
  selector (required), properties, pseudo, unit, includeDefaults
  → Returns: browser-computed CSS for element

# 4. Access Shadow DOM
get_shadow_dom
  selector (required), depth, includeStyles, includeSlots, format
  → Returns: Shadow DOM tree, slots, styles

# 5. Access iframe content
access_iframe
  selector (required), query, operation, depth, timeout
  → Returns: iframe document, content, elements

# 6. Get element path
get_dom_path
  selector (required), format, optimize, absolute
  → Returns: CSS selector, XPath, alternatives

# 7. Find multiple elements
find_elements_by_selector
  selector (required), limit, properties, index, visible
  → Returns: all matching elements with properties
```

---

## JavaScript Execution Commands (8-14)

```bash
# 8. Execute JavaScript code
execute_javascript
  script (required), args, timeout, returnType, awaitPromise
  → Returns: script result, execution time

# 9. Call existing function
call_function
  functionName (required), args, timeout, thisContext, awaitPromise
  → Returns: function result

# 10. Get global variable
get_global_variable
  name (required), deep, serialize, includeType
  → Returns: variable value, type info

# 11. Set global variable
set_global_variable
  name (required), value (required), create, overwrite, restore
  → Returns: set value, previous value, restore ID

# 12. Inspect object
inspect_object
  objectPath (required), depth, includePrototype, includeMethods, maxItems
  → Returns: object structure, properties, prototype chain

# 13. Modify prototype
modify_prototype
  targetPrototype (required), method (required), implementation (required), restore, checkExisting
  → Returns: patched prototype, restore ID

# 14. List all globals
list_globals
  filter, namePattern, sort, limit, includeNative
  → Returns: all global variables and functions
```

---

## Network Control Commands (15-22)

```bash
# 15. Intercept requests
intercept_request
  pattern (required), methods, action, id, enabled
  → Returns: intercept ID, match count

# 16. Modify request
modify_request
  interceptId (required), modifications (required), append, requestId
  → Returns: applied modifications

# 17. Mock response
mock_response
  interceptId (required), statusCode, headers, body, delay
  → Returns: mock setup, applied

# 18. Replay request
replay_request
  requestId (required), modifications, count, delay
  → Returns: replay results, average time

# 19. Capture request body
capture_request_body
  interceptId (required), parseJson, maxSize, storeId
  → Returns: captured body, store ID

# 20. Modify response
modify_response_body
  interceptId (required), modifications (required), format, patch
  → Returns: applied changes

# 21. List network events
list_network_events
  filter, limit, sort, detailed
  → Returns: captured requests/responses

# 22. Clear network cache
clear_network_cache
  filter, olderThan, pattern
  → Returns: cleared count
```

---

## Storage Access Commands (23-29)

```bash
# 23. Read localStorage
get_localstorage
  key, keys, pattern, parse, limit
  → Returns: storage values

# 24. Write to localStorage
set_localstorage
  key (required), value (required), stringify, backup, ttl
  → Returns: stored value, backup ID

# 25. Read sessionStorage
get_sessionstorage
  key, keys, parse, limit
  → Returns: session storage values

# 26. Clear storage
clear_storage
  type, pattern, exclude, backup
  → Returns: cleared count, backup ID

# 27. Access IndexedDB
access_indexeddb
  database (required), objectStore, query, limit, parse
  → Returns: database records

# 28. Export storage
export_storage
  format, include, prettify, compress
  → Returns: download URL, export metadata

# 29. Clear all storage
clear_all_storage
  confirm (required), backup, except
  → Returns: cleared count, backup ID
```

---

## DevTools Commands (30-36)

```bash
# 30. Enable debugging
enable_debugging
  features, breakOnLoad, breakOnErrors, recordNetwork
  → Returns: debugger enabled, session ID

# 31. Set breakpoint
set_breakpoint
  location (required), condition, logMessage, hitCount, enabled
  → Returns: breakpoint ID

# 32. Resume execution
resume_execution
  stepMode, breakpointId
  → Returns: resumed, next pause info

# 33. Get call stack
get_call_stack
  detailed, maxDepth
  → Returns: call stack frames

# 34. Profile performance
profile_performance
  duration, script, metrics, sampleRate
  → Returns: profile data, top functions, memory

# 35. Inspect memory
inspect_memory
  type, detailed, topN
  → Returns: heap size, top objects

# 36. Get console output
get_console_output
  level, limit, since, pattern
  → Returns: console messages
```

---

## CSS Injection Commands (37-44)

```bash
# 37. Inject stylesheet
inject_stylesheet
  url (required), media, id, persist, priority
  → Returns: stylesheet ID, rule count

# 38. Inject inline CSS
inject_inline_style
  css (required), id, media, scoped, target
  → Returns: style ID, applied rules

# 39. Modify stylesheet
modify_stylesheet
  selector (required), rules (required), important, index
  → Returns: modified selector, sheets changed

# 40. Inject animation
inject_animation
  name (required), frames (required), duration, timingFunction, iterationCount
  → Returns: animation ID

# 41. Inject keyframes
inject_keyframes
  keyframes (required), id
  → Returns: keyframe animations list

# 42. Modify theme
modify_theme
  variables (required), scope, restore
  → Returns: applied variables, restore ID

# 43. Add CSS rule
add_css_rule
  selector (required), properties (required), index, important
  → Returns: rule added, index

# 44. Remove CSS rule
remove_css_rule
  selector, index, all
  → Returns: removed count
```

---

## JavaScript Injection Commands (45-52)

```bash
# 45. Inject script
inject_script
  code (required), id, async, defer, target
  → Returns: script ID, execution status

# 46. Load library
load_library
  url (required), id, async, globalName, timeout
  → Returns: library loaded, version

# 47. Monkey-patch function
monkey_patch_function
  functionPath (required), implementation (required), preserveOriginal, intercept, restore
  → Returns: patched function, restore ID

# 48. Hook method
hook_method
  methodPath (required), before, after, id
  → Returns: hook ID, active status

# 49. Replace global
replace_global
  name (required), value (required), restore, preventRecreation
  → Returns: replaced global, restore ID

# 50. Inject module
inject_module
  code (required), exports, id, importMap
  → Returns: module ID, accessible path

# 51. List injections
list_injected_scripts
  detailed, active
  → Returns: all injections with status

# 52. Remove injection
remove_injected_script
  id (required), cleanup, force
  → Returns: removed ID, cleanup status
```

---

## DOM Advanced Commands (53-65)

```bash
# 53. Create element tree
create_element_tree
  parent (required), structure (required), position, attributes, id
  → Returns: created elements count

# 54. Batch modify
batch_modify_elements
  selector (required), modifications (required), operations, limit
  → Returns: modified count, changes

# 55. Clone element
clone_element_structure
  selector (required), deep, count, appendTo, modifyAttributes
  → Returns: cloned count, clone IDs

# 56. Move elements
move_elements
  selector (required), target (required), position, reference
  → Returns: moved count

# 57. Wrap elements
wrap_elements
  selector (required), wrapper (required), keepTogether, classes
  → Returns: wrapped count

# 58. Unwrap elements
unwrap_elements
  selector (required), depth
  → Returns: unwrapped count

# 59. Template injection
template_injection
  selector (required), template (required), data (required), position, repeat
  → Returns: injected items

# 60. SVG injection
svg_injection
  selector (required), svg (required), id, responsive, styles
  → Returns: SVG elements

# 61. Web component
webcomponent_injection
  selector (required), tagName (required), properties, attributes, slots
  → Returns: component initialized

# 62. Modify attributes
modify_attributes_batch
  selector (required), attributes (required), append, remove, limit
  → Returns: modified count

# 63. Add event listeners
add_event_listeners_batch
  selector (required), events (required), capture, once, id
  → Returns: listeners added

# 64. Remove listeners
remove_event_listeners_batch
  selector (required), events, groupId
  → Returns: removed count

# 65. Synchronize elements
synchronize_elements
  elements (required), property, bidirectional, debounce, id
  → Returns: sync group ID, active
```

---

## Common Patterns

### Pattern: Safe Element Access
```javascript
// 1. Wait for element
await wait_for_element({ selector, timeout: 5000 });
// 2. Get properties
await get_element_properties({ selector });
// 3. Modify if needed
await set_element_properties({ selector, properties: {...} });
```

### Pattern: Batch Operations
```javascript
// Instead of loop, use batch
await batch_modify_elements({
  selector: '.item',
  modifications: { disabled: true }
});
```

### Pattern: API Interception
```javascript
// 1. Setup intercept
await intercept_request({ pattern: '/api/.*', action: 'log' });
// 2. Mock response
await mock_response({ interceptId: '...', body: '{}' });
// 3. Verify
await list_network_events({ limit: 10 });
```

### Pattern: Dynamic Content
```javascript
// 1. Get initial state
const initial = await find_elements_by_selector({ selector });
// 2. Hook into updates
await hook_method({ methodPath: 'window.update', after: 'notify()' });
// 3. Monitor changes
// Script monitors for changes
```

### Pattern: Theme Customization
```javascript
// 1. Inject styles
await inject_inline_style({ css: '.btn { ... }' });
// 2. Modify variables
await modify_theme({ variables: { '--color': '#fff' } });
// 3. Add animations
await inject_animation({ name: 'fade', frames: {...} });
```

---

## Error Codes Quick Map

| Code | Meaning | Retry? |
|------|---------|--------|
| `ELEMENT_NOT_FOUND` | Selector matched nothing | Yes (5x) |
| `INVALID_SELECTOR` | Selector syntax error | No |
| `EXECUTION_TIMEOUT` | Script exceeded timeout | Yes (2x) |
| `SYNTAX_ERROR` | Invalid JavaScript | No |
| `CROSS_ORIGIN_DENIED` | iframe access denied | No |
| `FUNCTION_NOT_FOUND` | Function doesn't exist | No |
| `UNSAFE_PROPERTY_BLOCKED` | Dangerous property attempt | No |
| `NETWORK_ERROR` | Network failure | Yes (3x) |
| `STORAGE_EMPTY` | No storage data | No |
| `QUOTA_EXCEEDED` | Memory/storage limit | No |

---

## Performance Quick Guide

| Operation | Time | Notes |
|-----------|------|-------|
| `get_element_properties` | 10-50ms | Single element |
| `find_elements_by_selector` | 10-100ms | Depends on selector complexity |
| `execute_javascript` | 10-500ms | Depends on script complexity |
| `intercept_request` | <50ms | Setup time only |
| `get_localstorage` | <50ms | Read operation |
| `inject_stylesheet` | <100ms | URL loading time separate |
| `batch_modify_elements` | 50-300ms | Depends on element count |
| `get_computed_styles` | 20-50ms | Single element |

---

## Timeout Guidelines

```
Fast operations (DOM queries):      1,000ms
Normal operations (execution):       5,000ms
Slow operations (network):          30,000ms
Very slow operations (complex):     60,000ms
```

---

## Security Checklist

- [ ] Validate all string inputs for injection
- [ ] Use whitelisted selectors only
- [ ] Never execute untrusted JavaScript
- [ ] Sanitize output (remove secrets)
- [ ] Check same-origin before iframe access
- [ ] Log sensitive operations
- [ ] Respect user consent (GDPR)
- [ ] Use restore IDs for critical changes

---

## Integration Checklist

For each command implementation:

- [ ] Input validation (type, range, security)
- [ ] Error handling (recoverable vs fatal)
- [ ] Logging and audit trail
- [ ] Performance metrics
- [ ] Resource cleanup
- [ ] Unit tests (>95% coverage)
- [ ] Integration tests
- [ ] Documentation with examples
- [ ] Cross-browser validation

---

## Useful Selector Patterns

```css
/* ID selector */
#button-id

/* Class selector */
.button-class

/* Attribute selectors */
input[type='text']
input[name='email']
[data-value='123']

/* Pseudo-selectors */
button:first-child
.item:nth-child(2)
input:checked
:not(.disabled)

/* Combinators */
.container > .child
.parent .descendant
.sibling + .adjacent
.prev ~ .general-sibling

/* Pseudo-elements */
::before, ::after
::first-letter, ::first-line

/* Avoid overly complex */
/* Bad: div.container > section:nth-child(2) > article.item:first-child */
/* Good: article.featured-item */
```

---

## Debugging Tips

1. **Selector not working?**
   - Test in browser console first
   - Use `find_elements_by_selector` to verify

2. **Script not executing?**
   - Check for syntax errors
   - Verify API availability
   - Check timeout is sufficient

3. **Network interception failing?**
   - Use URL glob patterns
   - Check request methods
   - Verify mock response format

4. **Performance issues?**
   - Use batch operations
   - Reduce selector complexity
   - Cache results when possible

5. **Memory leaks?**
   - Clean up injections
   - Remove event listeners
   - Clear network cache

---

## Reference Links

- **Full Specifications**: `PHASE-2-COMMAND-SPECIFICATIONS.md`
- **Advanced Guide**: `PHASE-2-ADVANCED-SPECIFICATIONS.md`
- **Implementation Roadmap**: `PHASE-2-IMPLEMENTATION-ROADMAP.md`
- **Architecture**: `PHASE-2-ARCHITECTURE-INDEX.md`

---

**Last Updated**: June 20, 2026  
**Status**: Phase 2 Complete Specification


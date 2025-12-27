# Basset Hound Browser - Input Simulation API

Advanced keyboard and mouse simulation with human-like behavior for bot detection evasion.

## Table of Contents

- [Overview](#overview)
- [Human-like Behavior](#human-like-behavior)
- [Keyboard Commands](#keyboard-commands)
  - [key_press](#key_press)
  - [key_combination](#key_combination)
  - [type_text](#type_text)
  - [estimate_typing](#estimate_typing)
  - [keyboard_layouts](#keyboard_layouts)
  - [special_keys](#special_keys)
- [Mouse Commands](#mouse-commands)
  - [mouse_move](#mouse_move)
  - [mouse_click](#mouse_click)
  - [mouse_double_click](#mouse_double_click)
  - [mouse_right_click](#mouse_right_click)
  - [mouse_drag](#mouse_drag)
  - [mouse_hover](#mouse_hover)
  - [mouse_scroll](#mouse_scroll)
  - [mouse_wheel](#mouse_wheel)
  - [click_at_element](#click_at_element)
  - [init_mouse_tracking](#init_mouse_tracking)
  - [get_mouse_position](#get_mouse_position)
- [Integration with Humanize Module](#integration-with-humanize-module)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Overview

The Input Simulation module provides WebSocket commands for simulating realistic user input. All commands are designed to evade bot detection by incorporating:

- Variable timing between keystrokes
- Natural mouse movement curves (Bezier curves)
- Occasional mistakes and corrections
- Momentum-based scrolling
- Random micro-movements during hover

## Human-like Behavior

All input commands support a `humanize` parameter (default: `true`) that enables human-like behavior:

- **Keyboard**: Variable delays, occasional typos with auto-correction, faster typing for common letter pairs
- **Mouse**: Curved movement paths, random overshoot correction, natural acceleration/deceleration

Set `humanize: false` for direct, immediate input when speed is more important than detection evasion.

---

## Keyboard Commands

### key_press

Press a single key with human-like timing.

**Request:**
```json
{
  "command": "key_press",
  "key": "Enter",
  "modifiers": { "shift": false, "ctrl": false, "alt": false, "meta": false },
  "repeat": 1,
  "layout": "en-US",
  "humanize": true
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| key | string | Yes | - | Key to press (character or special key name) |
| modifiers | object | No | {} | Modifier keys to hold during press |
| repeat | number | No | 1 | Number of times to press the key |
| layout | string | No | "en-US" | Keyboard layout for character mapping |
| humanize | boolean | No | true | Enable human-like delays |

**Special Keys:**
- Modifiers: `Shift`, `Control`, `Alt`, `Meta`
- Navigation: `Enter`, `Tab`, `Escape`, `Backspace`, `Delete`, `Space`
- Arrow keys: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
- Function keys: `F1` through `F12`
- Other: `Home`, `End`, `PageUp`, `PageDown`, `Insert`, `CapsLock`

**Response:**
```json
{
  "success": true,
  "key": "Enter",
  "type": "keypress"
}
```

---

### key_combination

Press a key combination (e.g., Ctrl+C, Ctrl+Shift+V).

**Request:**
```json
{
  "command": "key_combination",
  "keys": ["Control", "c"],
  "holdTime": 50,
  "humanize": true
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| keys | array | Yes | - | Array of keys to press together |
| holdTime | number | No | 50 | Time to hold keys down (ms) |
| humanize | boolean | No | true | Enable human-like delays |

**Common Combinations:**
- Copy: `["Control", "c"]` or `["Meta", "c"]` (Mac)
- Paste: `["Control", "v"]` or `["Meta", "v"]` (Mac)
- Select All: `["Control", "a"]`
- Undo: `["Control", "z"]`
- Find: `["Control", "f"]`

**Response:**
```json
{
  "success": true,
  "combination": "Control+c"
}
```

---

### type_text

Type text with realistic human-like timing, including occasional typos and corrections.

**Request:**
```json
{
  "command": "type_text",
  "text": "Hello, world!",
  "selector": "#input-field",
  "minDelay": 30,
  "maxDelay": 150,
  "mistakeRate": 0.02,
  "clearFirst": false,
  "layout": "en-US"
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| text | string | Yes | - | Text to type |
| selector | string | No | null | CSS selector to focus before typing |
| minDelay | number | No | 30 | Minimum delay between keystrokes (ms) |
| maxDelay | number | No | 150 | Maximum delay between keystrokes (ms) |
| mistakeRate | number | No | 0.02 | Probability of making a typo (0-1) |
| clearFirst | boolean | No | false | Clear existing content before typing |
| layout | string | No | "en-US" | Keyboard layout |

**Typing Behavior:**
- Faster typing for common letter pairs (th, he, in, er, etc.)
- Slower typing after punctuation and spaces
- Random thinking pauses (3% chance)
- Occasional typos followed by backspace correction

**Response:**
```json
{
  "success": true,
  "typed": 13,
  "text": "Hello, world!"
}
```

---

### estimate_typing

Estimate how long it will take to type text.

**Request:**
```json
{
  "command": "estimate_typing",
  "text": "Hello, world!",
  "baseDelay": 80
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| text | string | Yes | - | Text to estimate |
| baseDelay | number | No | 80 | Base delay between keystrokes (ms) |

**Response:**
```json
{
  "success": true,
  "duration": 1040,
  "text": "13 characters"
}
```

---

### keyboard_layouts

Get available keyboard layouts.

**Request:**
```json
{
  "command": "keyboard_layouts"
}
```

**Response:**
```json
{
  "success": true,
  "layouts": [
    { "code": "en-US", "name": "US English" },
    { "code": "en-GB", "name": "UK English" },
    { "code": "de-DE", "name": "German" },
    { "code": "fr-FR", "name": "French" },
    { "code": "es-ES", "name": "Spanish" }
  ]
}
```

---

### special_keys

Get list of all available special key names.

**Request:**
```json
{
  "command": "special_keys"
}
```

**Response:**
```json
{
  "success": true,
  "keys": [
    "Shift", "Control", "Alt", "Meta",
    "Enter", "Tab", "Escape", "Backspace", "Delete", "Space",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "Home", "End", "PageUp", "PageDown", "Insert",
    "F1", "F2", "F3", "F4", "F5", "F6",
    "F7", "F8", "F9", "F10", "F11", "F12",
    "CapsLock", "NumLock", "ScrollLock"
  ]
}
```

---

## Mouse Commands

### mouse_move

Move the mouse cursor to coordinates with natural curved movement.

**Request:**
```json
{
  "command": "mouse_move",
  "x": 500,
  "y": 300,
  "duration": null,
  "steps": 20,
  "curvature": 0.3,
  "humanize": true
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| x | number | Yes | - | Target X coordinate |
| y | number | Yes | - | Target Y coordinate |
| duration | number | No | auto | Movement duration (ms), auto-calculated if null |
| steps | number | No | 20 | Number of intermediate points |
| curvature | number | No | 0.3 | Curve intensity (0-1) |
| humanize | boolean | No | true | Enable natural movement with overshoot |

**Movement Features:**
- Bezier curve interpolation for smooth paths
- Random control point deviation for natural curves
- Optional overshoot with correction (15% chance when humanize=true)
- Slight jitter added to each point
- Eased acceleration (slow start and end)

**Response:**
```json
{
  "success": true,
  "x": 500,
  "y": 300,
  "moved": true,
  "pathLength": 24
}
```

---

### mouse_click

Click at specified coordinates.

**Request:**
```json
{
  "command": "mouse_click",
  "x": 500,
  "y": 300,
  "button": "left",
  "clickCount": 1,
  "moveFirst": true,
  "humanize": true
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| x | number | Yes | - | Click X coordinate |
| y | number | Yes | - | Click Y coordinate |
| button | string | No | "left" | Button: "left", "middle", "right" |
| clickCount | number | No | 1 | Number of clicks |
| moveFirst | boolean | No | true | Move to position before clicking |
| humanize | boolean | No | true | Enable human-like behavior |

**Click Behavior:**
- Dispatches mouseenter, mouseover, mousedown, mouseup, click events
- Random offset within 4px for natural variation
- Realistic timing between mousedown and mouseup (50-150ms)

**Response:**
```json
{
  "success": true,
  "x": 500,
  "y": 300,
  "button": 0,
  "clickCount": 1,
  "element": "BUTTON"
}
```

---

### mouse_double_click

Double-click at specified coordinates.

**Request:**
```json
{
  "command": "mouse_double_click",
  "x": 500,
  "y": 300,
  "humanize": true
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| x | number | Yes | - | Click X coordinate |
| y | number | Yes | - | Click Y coordinate |
| humanize | boolean | No | true | Enable human-like behavior |

**Response:**
```json
{
  "success": true,
  "x": 500,
  "y": 300,
  "clickCount": 2
}
```

---

### mouse_right_click

Right-click (context menu click) at specified coordinates.

**Request:**
```json
{
  "command": "mouse_right_click",
  "x": 500,
  "y": 300,
  "humanize": true
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| x | number | Yes | - | Click X coordinate |
| y | number | Yes | - | Click Y coordinate |
| humanize | boolean | No | true | Enable human-like behavior |

**Response:**
```json
{
  "success": true,
  "x": 500,
  "y": 300,
  "button": 2
}
```

---

### mouse_drag

Drag from one point to another.

**Request:**
```json
{
  "command": "mouse_drag",
  "startX": 100,
  "startY": 100,
  "endX": 400,
  "endY": 300,
  "steps": 25,
  "holdTime": 100,
  "humanize": true
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| startX | number | Yes | - | Start X coordinate |
| startY | number | Yes | - | Start Y coordinate |
| endX | number | Yes | - | End X coordinate |
| endY | number | Yes | - | End Y coordinate |
| steps | number | No | 25 | Number of intermediate points |
| holdTime | number | No | 100 | Time to hold before dragging (ms) |
| humanize | boolean | No | true | Enable human-like behavior |

**Drag Behavior:**
- Mousedown at start, mousemove through path, mouseup at end
- Dispatches drag/dragend/drop events for drag-and-drop support
- Slight curve during drag movement
- Variable speed during drag

**Response:**
```json
{
  "success": true,
  "start": { "x": 100, "y": 100 },
  "end": { "x": 400, "y": 300 }
}
```

---

### mouse_hover

Hover at a position with small natural movements.

**Request:**
```json
{
  "command": "mouse_hover",
  "x": 500,
  "y": 300,
  "duration": 500,
  "humanize": true
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| x | number | Yes | - | Hover X coordinate |
| y | number | Yes | - | Hover Y coordinate |
| duration | number | No | 500 | How long to hover (ms) |
| humanize | boolean | No | true | Enable human-like behavior |

**Hover Behavior:**
- Moves to position with natural curve
- Dispatches mouseenter and mouseover events
- Small jitter movements during hover (within 3px)

**Response:**
```json
{
  "success": true,
  "x": 500,
  "y": 300,
  "duration": 523,
  "element": "A"
}
```

---

### mouse_scroll

Scroll with momentum-based physics.

**Request:**
```json
{
  "command": "mouse_scroll",
  "x": null,
  "y": null,
  "deltaY": 300,
  "deltaX": 0,
  "momentum": true,
  "selector": null,
  "humanize": true
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| x | number | No | center | Scroll position X |
| y | number | No | center | Scroll position Y |
| deltaY | number | No | 300 | Vertical scroll amount (px) |
| deltaX | number | No | 0 | Horizontal scroll amount (px) |
| momentum | boolean | No | true | Enable momentum physics |
| selector | string | No | null | Scroll within specific element |
| humanize | boolean | No | true | Enable human-like behavior |

**Scroll Behavior:**
- Automatically finds scrollable parent element
- Momentum-based physics with decay (0.85-0.95)
- Random jitter for realistic variation
- Variable step timing

**Response:**
```json
{
  "success": true,
  "deltaY": 298,
  "deltaX": 0,
  "steps": 15
}
```

---

### mouse_wheel

Fire a wheel event directly (without momentum physics).

**Request:**
```json
{
  "command": "mouse_wheel",
  "x": null,
  "y": null,
  "deltaY": 100,
  "deltaX": 0,
  "deltaMode": 0
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| x | number | No | center | Event position X |
| y | number | No | center | Event position Y |
| deltaY | number | No | 100 | Vertical delta |
| deltaX | number | No | 0 | Horizontal delta |
| deltaMode | number | No | 0 | Delta mode (0=pixels, 1=lines, 2=pages) |

**Response:**
```json
{
  "success": true,
  "deltaY": 100,
  "deltaX": 0,
  "cancelled": false
}
```

---

### click_at_element

Click on an element identified by CSS selector.

**Request:**
```json
{
  "command": "click_at_element",
  "selector": "#submit-button",
  "button": "left",
  "clickCount": 1,
  "offsetX": 0.5,
  "offsetY": 0.5,
  "humanize": true
}
```

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| selector | string | Yes | - | CSS selector for target element |
| button | string | No | "left" | Button: "left", "middle", "right" |
| clickCount | number | No | 1 | Number of clicks |
| offsetX | number | No | 0.5 | Click position within element (0-1, left to right) |
| offsetY | number | No | 0.5 | Click position within element (0-1, top to bottom) |
| humanize | boolean | No | true | Enable human-like behavior |

**Response:**
```json
{
  "success": true,
  "x": 510,
  "y": 305,
  "selector": "#submit-button"
}
```

---

### init_mouse_tracking

Initialize mouse position tracking in the browser.

**Request:**
```json
{
  "command": "init_mouse_tracking"
}
```

**Response:**
```json
{
  "success": true,
  "position": { "x": 512, "y": 384 }
}
```

---

### get_mouse_position

Get the current tracked mouse position.

**Request:**
```json
{
  "command": "get_mouse_position"
}
```

**Response:**
```json
{
  "success": true,
  "x": 500,
  "y": 300,
  "tracked": true
}
```

---

## Integration with Humanize Module

The input simulation module integrates with the existing `evasion/humanize.js` module:

- Uses `humanDelay()` for realistic inter-action delays
- Uses `normalDelay()` for normally-distributed random timing
- Extends `generateMousePath()` with enhanced Bezier curve generation
- Complements `humanType()` with full keyboard event simulation

## Best Practices

### For Bot Detection Evasion

1. **Always use humanize=true** for interactions on monitored sites
2. **Add random delays** between actions (100-500ms)
3. **Move mouse before clicking** (moveFirst=true)
4. **Type at realistic speeds** (avoid minDelay < 30ms)
5. **Include occasional mistakes** (mistakeRate 0.01-0.05)

### For Performance

1. **Disable humanize** for bulk operations
2. **Reduce step count** for mouse movements
3. **Use mouse_wheel** instead of mouse_scroll for simple scrolling

### For Reliability

1. **Use selectors** instead of coordinates when possible
2. **Wait for elements** before interacting
3. **Initialize mouse tracking** before reading positions

---

## Examples

### Fill a Login Form

```javascript
// JavaScript client example
const ws = new WebSocket('ws://localhost:8765');

async function login(username, password) {
  // Type username
  await send({
    command: 'type_text',
    text: username,
    selector: '#username',
    mistakeRate: 0.01
  });

  // Tab to password field
  await send({ command: 'key_press', key: 'Tab' });

  // Type password
  await send({
    command: 'type_text',
    text: password,
    mistakeRate: 0.01
  });

  // Click submit
  await send({
    command: 'click_at_element',
    selector: '#submit'
  });
}
```

### Scroll Through a Page

```javascript
async function scrollPage() {
  // Scroll down 3 times with pauses
  for (let i = 0; i < 3; i++) {
    await send({
      command: 'mouse_scroll',
      deltaY: 400,
      momentum: true
    });

    // Wait like a human reading
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
  }
}
```

### Copy-Paste Text

```javascript
async function copyPaste() {
  // Select all
  await send({
    command: 'key_combination',
    keys: ['Control', 'a']
  });

  // Copy
  await send({
    command: 'key_combination',
    keys: ['Control', 'c']
  });

  // Click on target field
  await send({
    command: 'click_at_element',
    selector: '#target-field'
  });

  // Paste
  await send({
    command: 'key_combination',
    keys: ['Control', 'v']
  });
}
```

### Python Client Example

```python
import asyncio
import websockets
import json

async def interact():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Move mouse and click
        await ws.send(json.dumps({
            "command": "mouse_click",
            "x": 500,
            "y": 300,
            "humanize": True
        }))
        response = await ws.recv()
        print(json.loads(response))

        # Type text
        await ws.send(json.dumps({
            "command": "type_text",
            "text": "Hello from Python!",
            "selector": "#input"
        }))
        response = await ws.recv()
        print(json.loads(response))

asyncio.run(interact())
```

---

## Error Handling

All commands return a `success` field. On error:

```json
{
  "success": false,
  "error": "Element not found"
}
```

Common errors:
- `"Element not found"` - Selector did not match any element
- `"No input element focused"` - type_text requires a focused input
- `"X and Y coordinates are required"` - Missing required parameters
- `"No element at coordinates"` - Click position is outside any element

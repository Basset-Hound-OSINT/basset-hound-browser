# Basic Navigation

Essential WebSocket commands for navigating and interacting with web pages.

## Navigation Commands

### Navigate to URL

```python
import asyncio
import json
import websockets

async def navigate():
    async with websockets.connect("ws://localhost:8765") as ws:
        await ws.send(json.dumps({
            "id": "1",
            "command": "navigate",
            "url": "https://example.com"
        }))
        response = json.loads(await ws.recv())
        print(response)

asyncio.run(navigate())
```

### Get Current URL

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "get_url"
}))
response = json.loads(await ws.recv())
print(f"Current URL: {response['url']}")
```

### Go Back / Forward

```python
# Go back
await ws.send(json.dumps({
    "id": "1",
    "command": "back"
}))

# Go forward
await ws.send(json.dumps({
    "id": "2",
    "command": "forward"
}))

# Refresh
await ws.send(json.dumps({
    "id": "3",
    "command": "refresh"
}))
```

## Content Extraction

### Get Page Content

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "get_content"
}))
response = json.loads(await ws.recv())

# Available fields
print(f"Title: {response['content']['title']}")
print(f"URL: {response['content']['url']}")
print(f"Text: {response['content']['text']}")
print(f"HTML: {response['content']['html']}")
print(f"Metadata: {response['content']['metadata']}")
```

### Get Page State

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "get_page_state"
}))
response = json.loads(await ws.recv())

# Returns forms, buttons, links, input fields
print(f"Forms: {response['forms']}")
print(f"Buttons: {response['buttons']}")
print(f"Links: {response['links']}")
print(f"Inputs: {response['inputs']}")
```

## Interaction Commands

### Click an Element

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "click",
    "selector": "button.submit"
}))
```

### Fill a Form Field

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "fill",
    "selector": "input[name='email']",
    "value": "test@example.com"
}))
```

### Type Text (Character by Character)

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "type",
    "selector": "input.search",
    "value": "search query"
}))
```

### Scroll Page

```python
# Scroll by pixels
await ws.send(json.dumps({
    "id": "1",
    "command": "scroll",
    "x": 0,
    "y": 500
}))

# Or scroll to element
await ws.send(json.dumps({
    "id": "2",
    "command": "scroll",
    "selector": "button.load-more"
}))
```

### Hover Over Element

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "hover",
    "selector": "a.menu-item"
}))
```

## Wait Commands

### Wait for Element

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "wait_for_element",
    "selector": "div.content",
    "timeout": 10000  # milliseconds
}))
```

### Wait for Navigation

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "wait_for_navigation",
    "timeout": 5000
}))
```

### Wait for Function

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "wait_for_function",
    "script": "document.querySelectorAll('div.loaded').length > 0",
    "timeout": 5000
}))
```

## Selector Guide

### CSS Selectors

```python
# By class
await ws.send(json.dumps({
    "command": "click",
    "selector": "button.primary"
}))

# By ID
await ws.send(json.dumps({
    "command": "click",
    "selector": "#submit-button"
}))

# By attribute
await ws.send(json.dumps({
    "command": "click",
    "selector": "input[type='submit']"
}))

# By tag + class
await ws.send(json.dumps({
    "command": "click",
    "selector": "button.btn.btn-primary"
}))
```

### XPath Selectors

```python
# By text
await ws.send(json.dumps({
    "command": "click",
    "selector": "//button[contains(text(), 'Submit')]",
    "type": "xpath"
}))

# By multiple conditions
await ws.send(json.dumps({
    "command": "click",
    "selector": "//div[@class='panel']/button[1]",
    "type": "xpath"
}))
```

## Complete Workflow Example

```python
import asyncio
import json
import websockets

async def complete_workflow():
    async with websockets.connect("ws://localhost:8765") as ws:
        # 1. Navigate to website
        await ws.send(json.dumps({
            "id": "1",
            "command": "navigate",
            "url": "https://example.com"
        }))
        await ws.recv()
        await asyncio.sleep(2)
        
        # 2. Get page content
        await ws.send(json.dumps({
            "id": "2",
            "command": "get_content"
        }))
        content = json.loads(await ws.recv())
        print(f"Title: {content['content']['title']}")
        
        # 3. Fill search box
        await ws.send(json.dumps({
            "id": "3",
            "command": "fill",
            "selector": "input.search",
            "value": "test"
        }))
        await ws.recv()
        
        # 4. Click search button
        await ws.send(json.dumps({
            "id": "4",
            "command": "click",
            "selector": "button.search-btn"
        }))
        await ws.recv()
        
        # 5. Wait for results
        await ws.send(json.dumps({
            "id": "5",
            "command": "wait_for_element",
            "selector": "div.results",
            "timeout": 5000
        }))
        await ws.recv()
        
        # 6. Extract results
        await ws.send(json.dumps({
            "id": "6",
            "command": "get_content"
        }))
        results = json.loads(await ws.recv())
        print(f"Results HTML: {results['content']['html']}")

asyncio.run(complete_workflow())
```

## Next Steps

- **[Screenshots & Capture](SCREENSHOTS-AND-CAPTURE.md)** — Capture pages and elements
- **[Forensic Data Extraction](FORENSIC-EXTRACTION.md)** — Advanced extraction techniques
- **[Error Handling](ERROR-HANDLING.md)** — Common patterns and debugging
- **[Complete API Reference](../api/COMPLETE-REFERENCE.md)** — All navigation commands

## Related Resources

- **[Selector Generation](../api/COMPLETE-REFERENCE.md#selector-generation)** — Auto-generate CSS/XPath selectors
- **[Page State Analysis](../api/COMMAND-CATEGORIES.md#analysis)** — Extract forms, links, buttons
- **[Real-World Workflows](REAL-WORLD-WORKFLOWS.md)** — Complete examples

# Forensic Data Extraction

Advanced extraction for forensic analysis and evidence capture.

## HTML Capture

```python
import asyncio, json, websockets

async def html_capture():
    async with websockets.connect("ws://localhost:8765") as ws:
        await ws.send(json.dumps({
            "id": "1",
            "command": "navigate",
            "url": "https://example.com"
        }))
        await ws.recv()
        
        # Capture complete HTML
        await ws.send(json.dumps({
            "id": "2",
            "command": "capture_html"
        }))
        response = json.loads(await ws.recv())
        print(response['html'])

asyncio.run(html_capture())
```

## DOM Snapshot

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "capture_dom_snapshot"
}))
response = json.loads(await ws.recv())

# Returns complete DOM state including:
# - Element hierarchy
# - Computed styles
# - Attributes
# - Text content
```

## JavaScript Context

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "extract_javascript_context"
}))
response = json.loads(await ws.recv())

# Returns:
# - Global variables
# - Window properties
# - Registered event listeners
# - Loaded scripts
```

## Console Logs

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "get_console_logs"
}))
response = json.loads(await ws.recv())

# Returns all console output (log, error, warning, etc.)
for log in response['logs']:
    print(f"{log['level']}: {log['message']}")
```

## Export Data

```python
# Export as JSON
await ws.send(json.dumps({
    "id": "1",
    "command": "export_forensic_data",
    "format": "json"
}))

# Export as CSV
await ws.send(json.dumps({
    "id": "2",
    "command": "export_forensic_data",
    "format": "csv"
}))

# Export as HAR (HTTP Archive)
await ws.send(json.dumps({
    "id": "3",
    "command": "export_forensic_data",
    "format": "har"
}))
```

## Batch Extraction

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "batch_extract",
    "urls": [
        "https://example.com",
        "https://example.org"
    ]
}))
response = json.loads(await ws.recv())
# Returns data from all URLs
```

## Correlation Analysis

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "correlate_evidence",
    "data_sources": ["html", "console", "javascript"]
}))
response = json.loads(await ws.recv())
# Returns correlations between extracted data
```

## See Also

- **[Complete API Reference](../api/COMPLETE-REFERENCE.md#forensic-commands)** - All forensic commands
- **[Real-World Workflows](REAL-WORLD-WORKFLOWS.md)** - Complete examples
- **[Error Handling](ERROR-HANDLING.md)** - Common extraction patterns

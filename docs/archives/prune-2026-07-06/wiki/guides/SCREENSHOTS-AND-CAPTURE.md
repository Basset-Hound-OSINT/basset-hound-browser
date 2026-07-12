# Screenshots & Capture

Capture page screenshots and elements.

## Page Screenshots

```python
import asyncio, json, websockets, base64

async def screenshot():
    async with websockets.connect("ws://localhost:8765") as ws:
        await ws.send(json.dumps({
            "id": "1",
            "command": "navigate",
            "url": "https://example.com"
        }))
        await ws.recv()
        await asyncio.sleep(2)
        
        # Full page screenshot
        await ws.send(json.dumps({
            "id": "2",
            "command": "screenshot",
            "type": "fullPage"
        }))
        response = json.loads(await ws.recv())
        
        # Save screenshot
        img_data = response["data"].split(",")[1]
        with open("screenshot.png", "wb") as f:
            f.write(base64.b64decode(img_data))

asyncio.run(screenshot())
```

## Element Screenshots

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "screenshot",
    "type": "element",
    "selector": "div.header"
}))
response = json.loads(await ws.recv())
# Save as above
```

## Viewport Screenshots

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "screenshot",
    "type": "viewport"
}))
```

## Screenshot Options

- `type`: `viewport` (default), `fullPage`, `element`, `clip`
- `selector`: Element selector for element/clip type
- `quality`: 0-100 (default 80)
- `clip`: `{x, y, width, height}` for custom crop

## Related Commands

- [Forensic Data Extraction](FORENSIC-EXTRACTION.md) - Advanced capture options
- [Complete API Reference](../api/COMPLETE-REFERENCE.md#screenshots) - All screenshot commands

See **[Real-World Workflows](REAL-WORLD-WORKFLOWS.md)** for complete examples.

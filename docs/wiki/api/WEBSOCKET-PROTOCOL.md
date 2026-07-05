# WebSocket Protocol Details

Technical details about the WebSocket protocol used by Basset Hound Browser.

## Connection

**URL:** `ws://localhost:8765`  
**Default Port:** 8765  
**Secure WSS:** Requires TLS/SSL setup

## Request Format

All requests are JSON objects:

```json
{
  "id": "unique-id",
  "command": "command-name",
  "param1": "value1",
  "param2": "value2"
}
```

**Required fields:**
- `id` - Unique request identifier (string)
- `command` - Command to execute (string)

**Additional fields depend on the command.**

## Response Format

All responses are JSON objects:

```json
{
  "id": "unique-id",
  "success": true,
  "command": "command-name",
  "data": {}
}
```

**Common fields:**
- `id` - Matches request id
- `success` - boolean, true if succeeded
- `command` - Name of command executed
- `data` - Command-specific response data
- `error` - Error message (if success: false)
- `code` - Error code (if success: false)

## Message Ordering

- Request/response pairs use `id` to match
- Responses may arrive out of order
- Always match by `id` field

## Connection Lifecycle

1. **Connect** - Open WebSocket connection
2. **Send Commands** - Send JSON command objects
3. **Receive Responses** - Receive JSON response objects
4. **Disconnect** - Close WebSocket connection

## Timeout Behavior

- Default timeout: 30 seconds
- Command-specific timeouts can be set
- Timeout error: `{"success": false, "code": "TIMEOUT"}`

## Message Size Limits

- Maximum message size: 10 MB
- For large data: use compression or batch requests

## Compression

Responses may be gzip-compressed for large payloads.

## Authentication

**None by default** (development mode)

For production, configure authentication in deployment settings.

## Heartbeat / Keep-Alive

No built-in heartbeat. Connection stays open while active.

For long-lived connections, send periodic `ping` commands.

## Best Practices

1. **Match ID fields** - Always correlate response with request by ID
2. **Handle errors** - Check success field
3. **Use timeouts** - Prevent hanging connections
4. **Batch commands** - Send multiple commands, receive multiple responses
5. **Keep connections alive** - Send periodic pings if idle

## Code Example

```python
import asyncio
import json
import websockets

async def websocket_example():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Send command
        request = {
            "id": "1",
            "command": "navigate",
            "url": "https://example.com"
        }
        await ws.send(json.dumps(request))
        
        # Receive response
        response_text = await ws.recv()
        response = json.loads(response_text)
        
        # Check success
        if response.get("success"):
            print("Success!")
        else:
            print(f"Error: {response.get('error')}")

asyncio.run(websocket_example())
```

## See Also

- **[API Overview](OVERVIEW.md)** - API introduction
- **[Command Reference](COMPLETE-REFERENCE.md)** - All commands
- **[Error Codes](ERROR-CODES.md)** - All error responses

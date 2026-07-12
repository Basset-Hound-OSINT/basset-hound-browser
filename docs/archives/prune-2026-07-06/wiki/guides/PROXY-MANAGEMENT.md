# Proxy Management

Setup and rotate proxies for anonymity and scaling.

## Set Single Proxy

```python
import asyncio, json, websockets

async def set_proxy():
    async with websockets.connect("ws://localhost:8765") as ws:
        await ws.send(json.dumps({
            "id": "1",
            "command": "set_proxy",
            "host": "proxy.example.com",
            "port": 8080,
            "type": "http"
        }))
        response = json.loads(await ws.recv())
        print(response)

asyncio.run(set_proxy())
```

## Proxy Types Supported

- HTTP
- HTTPS
- SOCKS4
- SOCKS5

## Proxy with Authentication

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "set_proxy",
    "host": "proxy.example.com",
    "port": 1080,
    "type": "socks5",
    "auth": {
        "username": "user",
        "password": "pass"
    }
}))
```

## Proxy Rotation

```python
# Set multiple proxies
await ws.send(json.dumps({
    "id": "1",
    "command": "set_proxy_list",
    "proxies": [
        {"host": "proxy1.example.com", "port": 8080, "type": "http"},
        {"host": "proxy2.example.com", "port": 8080, "type": "http"},
        {"host": "proxy3.example.com", "port": 1080, "type": "socks5"}
    ]
}))

# Start auto-rotation every 5 minutes
await ws.send(json.dumps({
    "id": "2",
    "command": "start_proxy_rotation",
    "intervalMs": 300000,
    "mode": "random"  # or "sequential"
}))

# Stop rotation
await ws.send(json.dumps({
    "id": "3",
    "command": "stop_proxy_rotation"
}))
```

## Proxy Management Commands

- `set_proxy` - Set single proxy
- `clear_proxy` - Disable proxy
- `get_proxy_status` - Current proxy info
- `set_proxy_list` - Set multiple proxies
- `rotate_proxy` - Switch next proxy
- `test_proxy` - Test connection
- `get_proxy_stats` - Statistics

## See Also

- **[Bot Evasion Techniques](BOT-EVASION.md)** - Combine with fingerprinting
- **[Complete API Reference](../api/COMPLETE-REFERENCE.md#proxy)** - All proxy commands
- **[Real-World Workflows](REAL-WORLD-WORKFLOWS.md)** - Proxy rotation examples

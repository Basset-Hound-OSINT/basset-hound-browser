# Bot Evasion Techniques

Hide automation from bot detection systems.

## Fingerprint Spoofing

```python
import asyncio, json, websockets

async def spoof_fingerprint():
    async with websockets.connect("ws://localhost:8765") as ws:
        # The browser automatically applies fingerprint spoofing
        # No command needed - it's built-in
        
        # But you can randomize it
        await ws.send(json.dumps({
            "id": "1",
            "command": "randomize_fingerprint"
        }))
        response = json.loads(await ws.recv())
        print(response)

asyncio.run(spoof_fingerprint())
```

## User Agent Rotation

```python
# Set specific user agent
await ws.send(json.dumps({
    "id": "1",
    "command": "set_user_agent",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}))

# Or use category
await ws.send(json.dumps({
    "id": "2",
    "command": "set_user_agent",
    "category": "CHROME_WINDOWS"
}))

# Start auto-rotation
await ws.send(json.dumps({
    "id": "3",
    "command": "start_user_agent_rotation",
    "intervalMs": 600000,
    "mode": "random"
}))
```

## Behavioral Simulation

```python
# Add random delays between actions
import asyncio

await ws.send(json.dumps({"command": "click", "selector": "button"}))
await asyncio.sleep(2 + random.randint(0, 3))  # 2-5 seconds

# Natural mouse movement is automatic
# Realistic typing is automatic
# Random scrolling is automatic
```

## Proxy + Fingerprinting

```python
# Combine proxy rotation with fingerprint randomization
await ws.send(json.dumps({
    "id": "1",
    "command": "set_proxy",
    "host": "proxy.example.com",
    "port": 8080
}))

await ws.send(json.dumps({
    "id": "2",
    "command": "randomize_fingerprint"
}))

await ws.send(json.dumps({
    "id": "3",
    "command": "start_user_agent_rotation",
    "intervalMs": 300000
}))
```

## Tor Integration

```python
# Enable Tor
await ws.send(json.dumps({
    "id": "1",
    "command": "set_tor_mode",
    "mode": "ON"  # ON, OFF, AUTO
}))

# Rotate Tor circuit
await ws.send(json.dumps({
    "id": "2",
    "command": "rotate_tor_circuit"
}))

# Get Tor status
await ws.send(json.dumps({
    "id": "3",
    "command": "get_tor_status"
}))
```

## Best Practices

1. **Combine techniques**: Don't rely on one method alone
2. **Add delays**: Random waits between actions
3. **Rotate identities**: Change user agent, proxy, fingerprint
4. **Simulate behavior**: Include scrolling, hovering, typing pauses
5. **Monitor detection**: Check for 429, 403, or bot detection responses

## Detection Bypass Techniques

- Canvas fingerprint randomization (automatic)
- WebGL fingerprint randomization (automatic)
- Navigator property spoofing (automatic)
- Timezone randomization (automatic)
- Screen resolution spoofing (automatic)

## See Also

- **[Real-World Workflows](REAL-WORLD-WORKFLOWS.md)** - Complete evasion examples
- **[Complete API Reference](../api/COMPLETE-REFERENCE.md#evasion)** - All evasion commands
- **[Troubleshooting](../troubleshooting/BOT-DETECTION.md)** - Still being detected?

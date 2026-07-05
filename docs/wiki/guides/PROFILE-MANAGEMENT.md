# Profile & Session Management

Work with multiple browser profiles and sessions.

## Create Profile

```python
import asyncio, json, websockets

async def create_profile():
    async with websockets.connect("ws://localhost:8765") as ws:
        await ws.send(json.dumps({
            "id": "1",
            "command": "create_profile",
            "name": "profile-1"
        }))
        response = json.loads(await ws.recv())
        print(response)

asyncio.run(create_profile())
```

## Switch Profile

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "switch_profile",
    "name": "profile-1"
}))
```

## Save Session

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "save_session",
    "name": "session-1"
}))
```

## Restore Session

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "restore_session",
    "name": "session-1"
}))
```

## Profile Isolation

Each profile has:
- Separate cookies
- Separate local storage
- Separate cache
- Separate browsing history
- Unique fingerprint (optional)

## Multi-Profile Workflow

```python
async def multi_account():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Create two profiles
        for i in [1, 2]:
            await ws.send(json.dumps({
                "id": f"{i}",
                "command": "create_profile",
                "name": f"account-{i}"
            }))
            await ws.recv()
        
        # Login with profile 1
        await ws.send(json.dumps({
            "command": "switch_profile",
            "name": "account-1"
        }))
        await ws.recv()
        
        await ws.send(json.dumps({
            "command": "navigate",
            "url": "https://example.com/login"
        }))
        # ... login actions ...
        
        # Save session
        await ws.send(json.dumps({
            "command": "save_session",
            "name": "account-1-session"
        }))
        await ws.recv()
        
        # Switch to profile 2
        await ws.send(json.dumps({
            "command": "switch_profile",
            "name": "account-2"
        }))
        await ws.recv()
        
        # ... repeat login for profile 2 ...

asyncio.run(multi_account())
```

## See Also

- **[Complete API Reference](../api/COMPLETE-REFERENCE.md#profiles)** - All profile commands
- **[Real-World Workflows](REAL-WORLD-WORKFLOWS.md)** - Multi-account examples
- **[Bot Evasion](BOT-EVASION.md)** - Unique fingerprints per profile

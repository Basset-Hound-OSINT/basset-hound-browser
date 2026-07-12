# Bot Detection & Evasion

Still being detected? Troubleshooting guide.

## Common Detection Triggers

1. **Too fast** - Browsing at inhuman speed
2. **Too many requests** - Hitting rate limits
3. **Same fingerprint** - Repeated identical requests
4. **No randomization** - Consistent timing/behavior
5. **Missing headers** - WebDriver headers still visible

## Fixes

### Slow Down Your Requests

```python
import asyncio, random, time

async def human_pace():
    async with websockets.connect("ws://localhost:8765") as ws:
        for url in urls:
            # Navigate
            await ws.send(json.dumps({
                "command": "navigate",
                "url": url
            }))
            await ws.recv()
            
            # Wait 2-5 seconds (random)
            wait = random.uniform(2, 5)
            await asyncio.sleep(wait)
            
            # Do other actions
            # ... more waits ...
```

### Randomize Everything

```python
# Randomize delays
delay = random.uniform(0.5, 3.0)

# Change user agent
await ws.send(json.dumps({
    "command": "set_user_agent",
    "category": "CHROME_WINDOWS"  # Random category
}))

# Rotate proxy
await ws.send(json.dumps({
    "command": "rotate_proxy"
}))

# Randomize fingerprint
await ws.send(json.dumps({
    "command": "randomize_fingerprint"
}))
```

### Add Human-Like Behavior

```python
async def human_like_browsing():
    # Scroll before interaction
    await ws.send(json.dumps({
        "command": "scroll",
        "y": random.randint(100, 500)
    }))
    await ws.recv()
    await asyncio.sleep(random.uniform(0.5, 2))
    
    # Hover before clicking
    await ws.send(json.dumps({
        "command": "hover",
        "selector": "button"
    }))
    await ws.recv()
    await asyncio.sleep(random.uniform(0.2, 1))
    
    # Then click
    await ws.send(json.dumps({
        "command": "click",
        "selector": "button"
    }))
    await ws.recv()
```

### Use Proxy Rotation

```python
# Set multiple proxies
await ws.send(json.dumps({
    "command": "set_proxy_list",
    "proxies": [
        {"host": "proxy1.com", "port": 8080, "type": "http"},
        {"host": "proxy2.com", "port": 8080, "type": "http"},
        {"host": "proxy3.com", "port": 1080, "type": "socks5"}
    ]
}))

# Auto-rotate every 5 minutes
await ws.send(json.dumps({
    "command": "start_proxy_rotation",
    "intervalMs": 300000,
    "mode": "random"
}))
```

### Enable Tor

```python
# For maximum anonymity
await ws.send(json.dumps({
    "command": "set_tor_mode",
    "mode": "ON"
}))

# Rotate Tor circuit between requests
await ws.send(json.dumps({
    "command": "rotate_tor_circuit"
}))
```

## Detection Signals to Avoid

**Suspicious Patterns:**
- Exact same time between every action (add randomness)
- Same user agent every request (rotate)
- Same IP address (use proxy rotation)
- Requests to admin URLs (filter with robots.txt)
- Clicking hidden elements (only click visible)
- Form fills too fast (simulate typing speed)

**Headers to Check:**
- User-Agent (should be varied)
- Referer (should be set appropriately)
- Accept-Language (should vary)
- DNT (Don't Track) header (avoid if obvious)

## Debug Detection

Check response codes:

```python
# 429 = Rate limited
# 403 = Forbidden/blocked
# 401 = Unauthorized
# 503 = Service unavailable (captcha)

response = json.loads(await ws.recv())
if 'statusCode' in response:
    if response['statusCode'] == 429:
        print("Rate limited! Backing off...")
        await asyncio.sleep(60)
```

Check console for errors:

```python
await ws.send(json.dumps({
    "command": "get_console_logs"
}))
logs = json.loads(await ws.recv())
for log in logs['logs']:
    if 'bot' in log['message'].lower():
        print("Bot detection script found:", log)
```

## Real-World Checklist

- [ ] Using proxy rotation
- [ ] Adding random delays (2-5 seconds)
- [ ] Randomizing fingerprint regularly
- [ ] Rotating user agents
- [ ] Including mouse/scroll movements
- [ ] Simulating typing speed for forms
- [ ] Using Tor for sensitive operations
- [ ] Following robots.txt
- [ ] Respecting rate limits (X-RateLimit headers)
- [ ] Monitoring 429/403 responses

## If Still Blocked

1. **Try different proxy** - Your current IP may be blocked
2. **Try Tor** - Maximum anonymity
3. **Use multiple profiles** - Different fingerprints
4. **Wait and retry** - Temporary blocks fade
5. **Check target site** - May require actual browser (very rare)

## See Also

- **[Bot Evasion Guide](../guides/BOT-EVASION.md)** - Techniques
- **[Proxy Management](../guides/PROXY-MANAGEMENT.md)** - Setup proxies
- **[Real-World Workflows](../guides/REAL-WORLD-WORKFLOWS.md)** - Complete examples

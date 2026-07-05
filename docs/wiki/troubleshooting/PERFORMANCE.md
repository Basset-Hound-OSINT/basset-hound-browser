# Performance Issues

Troubleshoot slow responses and high resource usage.

## Slow Responses

**Symptom:** Commands take > 1 second to respond

**Causes & Solutions:**

1. **Browser overwhelmed**
   - Reduce concurrent connections
   - Add delays between commands
   - Close unused tabs

2. **Network latency**
   - Check network: `ping 127.0.0.1`
   - Use local connection (not remote)
   - Check proxy latency

3. **JavaScript heavy page**
   - Page has complex JavaScript
   - Wait for page to fully load before commands
   - Simplify or disable JavaScript

**Debug:**
```bash
time curl http://localhost:8765/api/diagnostics
```

Should respond in < 100ms.

## High Memory Usage

**Symptom:** Process uses > 2GB RAM

**Causes & Solutions:**

1. **Memory leak**
   - Restart browser periodically
   - Navigate to `about:blank` when idle
   - Clear session/cache

2. **Large pages**
   - Don't navigate to mega-heavy pages
   - Close tabs before heavy operations
   - Clear localStorage periodically

3. **Long-running sessions**
   - Restart browser every 1-2 hours
   - Don't keep browser running 24/7

**Check memory:**
```bash
ps aux | grep node
# Look at RSS column for memory usage
```

**Limit memory:**
```bash
export NODE_OPTIONS="--max-old-space-size=1024"
npm start:dev
```

## High CPU Usage

**Symptom:** Process uses > 80% CPU constantly

**Causes & Solutions:**

1. **Evasion overhead**
   - Disable unused evasion features
   - Check fingerprint randomization frequency

2. **Heavy JavaScript**
   - Page has expensive JavaScript
   - Use `execute_script` sparingly

3. **Loop in code**
   - Check for infinite loops
   - Add delays in tight loops

**Check CPU:**
```bash
top -p $(pgrep -f "npm start")
```

## Slow Page Loading

**Symptom:** `navigate` command slow to complete

**Causes & Solutions:**

1. **Slow website**
   - Increase timeout
   - Check website directly in browser

2. **Poor network**
   - Check your network speed
   - Try with proxy disabled
   - Use network throttling deliberately (not accidentally)

3. **Waiting for resources**
   - Use smaller timeout if available
   - Don't wait for images/ads if not needed
   - Use request blocking to skip ads

**Speed up loading:**
```python
# Block ads/images
await ws.send(json.dumps({
    "command": "apply_predefined_rules",
    "category": "ads"
}))

await ws.send(json.dumps({
    "command": "block_resource_type",
    "resourceType": "image"
}))

# Then navigate
await ws.send(json.dumps({
    "command": "navigate",
    "url": "https://example.com"
}))
```

## Batch Operations Slow

**Symptom:** Processing multiple URLs slowly

**Solutions:**

1. **Parallelize**
   ```python
   tasks = [navigate_and_extract(url) for url in urls]
   results = await asyncio.gather(*tasks)
   ```

2. **Batch requests**
   - Send 10 commands, receive 10 responses
   - Less overhead than back-and-forth

3. **Reuse connection**
   - Don't open new WebSocket for each command
   - Keep single connection open

## Testing Performance

Measure baseline:

```bash
# Health check latency
time curl http://localhost:8765/api/diagnostics

# Simple command latency
time python -c "
import asyncio, websockets, json
async def test():
    async with websockets.connect('ws://localhost:8765') as ws:
        await ws.send(json.dumps({'command': 'ping'}))
        await ws.recv()
asyncio.run(test())
"
```

Expected: < 100ms for health check, < 50ms for ping

## See Also

- **[Performance Tuning](../deployment/PERFORMANCE-TUNING.md)** - Optimization guide
- **[Connection Issues](CONNECTION-ISSUES.md)** - Network problems
- **[Monitoring](../deployment/MONITORING.md)** - Track metrics

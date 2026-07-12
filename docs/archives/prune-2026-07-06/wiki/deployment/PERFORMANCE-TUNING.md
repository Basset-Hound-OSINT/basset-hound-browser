# Performance Tuning

Optimize Basset Hound Browser for production load.

## Node.js Optimization

Set memory limits:
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm start:prod
```

## Request Batching

Send multiple commands, receive multiple responses:

```python
import asyncio, json, websockets

async def batch_commands():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Send batch
        for i in range(100):
            await ws.send(json.dumps({
                "id": str(i),
                "command": "navigate",
                "url": f"https://example.com/{i}"
            }))
        
        # Receive batch
        for i in range(100):
            response = json.loads(await ws.recv())
            process(response)
```

## Connection Pooling

Reuse WebSocket connections:

```python
class BrowserPool:
    def __init__(self, size=5):
        self.pool = []
        self.size = size
    
    async def initialize(self):
        for _ in range(self.size):
            ws = await websockets.connect("ws://localhost:8765")
            self.pool.append(ws)
    
    async def execute(self, command):
        ws = self.pool.pop()
        try:
            await ws.send(json.dumps(command))
            return json.loads(await ws.recv())
        finally:
            self.pool.append(ws)
```

## Response Compression

Enable compression for large responses (automatic for large payloads).

## Caching

Cache repeated operations:

```python
cache = {}

async def cached_navigate(ws, url):
    if url in cache:
        return cache[url]
    
    # Navigate and cache
    # ... code ...
    cache[url] = result
    return result
```

## Parallelization

Execute commands in parallel:

```python
async def parallel_operations():
    tasks = []
    for url in urls:
        tasks.append(navigate_and_extract(url))
    
    results = await asyncio.gather(*tasks)
```

## Load Testing

Use Apache Bench or similar:

```bash
ab -n 1000 -c 10 http://localhost:8765/api/diagnostics
```

## Profiling

Profile memory and CPU:

```bash
# CPU profiling
node --prof app.js
node --prof-process isolate-*.log > profile.txt

# Memory profiling
node --inspect app.js
# Then use Chrome DevTools
```

## Scaling

Horizontal scaling with multiple instances:

```bash
# Run multiple instances on different ports
PORT=8765 npm start:prod &
PORT=8766 npm start:prod &
PORT=8767 npm start:prod &

# Load balance with nginx
```

## See Also

- **[Monitoring](MONITORING.md)** - Track performance
- **[Pre-Deployment Checklist](PRE-DEPLOYMENT-CHECKLIST.md)** - Validation
- **[Rate Limiting](RATE-LIMITING-SECURITY.md)** - Handle limits

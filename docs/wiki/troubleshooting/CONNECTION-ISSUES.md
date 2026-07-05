# Connection Issues

Troubleshoot WebSocket and network problems.

## Connection Refused

**Error:** `ECONNREFUSED: Connection refused 127.0.0.1:8765`

**Cause:** Browser not running

**Solutions:**
1. Start browser: `npm start:dev`
2. Wait 5 seconds for startup
3. Verify: `curl http://localhost:8765/api/diagnostics`

**Still failing?**
- Check browser process: `ps aux | grep node`
- Check logs: `npm start:dev 2>&1 | head -20`
- Try different port: Modify `websocket/server.js`

## Port Already in Use

**Error:** `EADDRINUSE: Address already in use :::8765`

**Solutions:**
1. Find process: `lsof -i :8765`
2. Kill process: `kill -9 <PID>`
3. Or use different port in code

## Can't Resolve localhost

**Error:** `getaddrinfo ENOTFOUND localhost`

**Solutions:**
- Use `127.0.0.1` instead
- Check network connectivity
- Verify `/etc/hosts` has `127.0.0.1 localhost`

## Timeout Connecting

**Error:** `WebSocketTimeoutError` or connection hangs

**Solutions:**
1. Increase timeout: Browser startup may take time
2. Check firewall: Allow port 8765
3. Check browser logs: `npm start:dev`
4. Try direct connection: `telnet localhost 8765`

## Docker Connection Issues

**Issue:** Can't connect to Docker container

**Solutions:**
1. Check container running: `docker ps`
2. Check port mapping: `docker port <container>`
3. Use container IP: `docker inspect <container> | grep IPAddress`
4. Check logs: `docker logs <container>`

**Example:**
```bash
# Get container IP
CONTAINER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' <container>)

# Connect to IP
curl http://$CONTAINER_IP:8765/api/diagnostics
```

## Firewall Blocking

**Issue:** Connection works locally but not from other machines

**Solutions:**
1. Check firewall: `sudo ufw status`
2. Allow port: `sudo ufw allow 8765`
3. Check router: Ensure port forwarding if needed
4. Use VPN/proxy if on restricted network

## DNS Issues

**Error:** `getaddrinfo ENOTFOUND` with specific hostname

**Solutions:**
1. Use IP address instead
2. Check DNS: `nslookup yourdomain.com`
3. Wait for DNS propagation (can take hours)
4. Use alternate DNS: Google (8.8.8.8), Cloudflare (1.1.1.1)

## SSL/TLS Certificate Issues

**Error:** `CERTIFICATE_VERIFY_FAILED`

**Solutions for self-signed:**
```python
import ssl
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE
# Then use ssl_context in WebSocket connection
```

**For production:**
- Use valid certificate from trusted CA
- No need to disable verification

## Connection Drops

**Issue:** Connection closes unexpectedly

**Solutions:**
1. Send periodic pings: `{"command": "ping"}`
2. Implement reconnection logic
3. Check browser memory: May be running out of memory
4. Check network stability

**Reconnection Pattern:**
```python
async def reconnect_with_backoff(max_retries=5):
    for attempt in range(max_retries):
        try:
            return await websockets.connect("ws://localhost:8765")
        except:
            wait = min(2 ** attempt, 60)  # Exponential backoff
            await asyncio.sleep(wait)
    raise ConnectionError("Failed to connect after retries")
```

## Debugging Connection

Enable verbose logging:

```bash
DEBUG=basset-hound:* npm start:dev
```

Check connection status:

```bash
curl http://localhost:8765/api/diagnostics
```

View raw WebSocket messages:

```python
import asyncio
import websockets
import json

async def debug():
    async with websockets.connect("ws://localhost:8765") as ws:
        await ws.send(json.dumps({"command": "ping"}))
        response = await ws.recv()
        print("Response:", response)
```

## See Also

- **[FAQ](FAQ.md)** - General questions
- **[Performance Issues](PERFORMANCE.md)** - Slow responses
- **[Docker Issues](DOCKER-ISSUES.md)** - Container problems
- **[API Error Codes](../api/ERROR-CODES.md)** - Command errors

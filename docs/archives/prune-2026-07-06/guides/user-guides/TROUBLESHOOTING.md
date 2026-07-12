# Basset Hound Browser v11.1.0 - Troubleshooting Guide

**Version:** 11.1.0  
**Date:** May 6, 2026  
**Status:** Production Ready

---

## Quick Diagnosis

### Symptom 1: "Connection refused" when trying to use browser

**Diagnosis:**
```bash
# Check if browser is running
lsof -i :8765

# If nothing shows, browser isn't running
```

**Solutions:**
1. Start the browser:
   ```bash
   npm start
   ```

2. Wait 5-10 seconds for Electron to fully load

3. Check for errors in browser logs:
   ```bash
   cat ~/.basset-hound/logs/error.log
   ```

4. Verify Node.js version:
   ```bash
   node --version  # Must be 18.x or higher
   ```

5. Try Docker if local install fails:
   ```bash
   docker-compose up basset-hound-browser
   ```

---

### Symptom 2: "Timeout" errors in client

**Diagnosis:**
```bash
# Check if WebSocket is responding
python -c "
import socket
s = socket.socket()
s.connect(('localhost', 8765))
s.close()
print('WebSocket is accessible')
"
```

**Solutions:**
1. Increase timeout in client:
   ```python
   # Python client
   client = BassetHoundClient(timeout=60.0)  # 60 seconds instead of 30
   ```

   ```javascript
   // Node.js client
   const client = new BassetHoundClient("localhost", 8765, 60000);
   ```

2. Check network latency:
   ```bash
   ping localhost  # Should be <1ms
   ```

3. Monitor system resources:
   ```bash
   top  # Check CPU and memory
   ```

4. Add delays after navigation:
   ```python
   await browser.navigate(url)
   await asyncio.sleep(3)  # Wait for page to load
   ```

5. Check browser logs for JavaScript errors:
   ```bash
   grep "ERROR\|error" ~/.basset-hound/logs/*.log
   ```

---

### Symptom 3: MCP server not found when registering

**Diagnosis:**
```bash
# Check if FastMCP is installed
pip list | grep fastmcp

# Check if server file exists
ls -la browser_mcp/server.py

# Try running server directly
python -m browser_mcp.server
```

**Solutions:**
1. Install FastMCP:
   ```bash
   pip install -r browser_mcp/requirements.txt
   ```

2. Verify Python path:
   ```bash
   which python  # Should show Python 3.8+
   python --version
   ```

3. Check for import errors:
   ```bash
   python -c "import browser_mcp; print('OK')"
   ```

4. Register with full path:
   ```bash
   claude mcp add basset-hound -- python /full/path/to/browser_mcp/server.py
   ```

5. Check Claude Code configuration:
   ```bash
   cat ~/.claude/settings.json | grep basset
   ```

---

## Common Issues & Solutions

### Browser Startup Issues

#### "Xvfb not found" error

**Cause:** Running headless mode without virtual display

**Solution:**
```bash
# Install Xvfb
sudo apt-get install xvfb

# Start virtual display
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99

# Then start browser
npm start
```

**For Docker:**
```bash
docker-compose up basset-hound-browser
# Xvfb is already configured in Docker
```

#### "DISPLAY not set" error

**Cause:** Running in GUI mode without display server

**Solution:**
1. Check display variable:
   ```bash
   echo $DISPLAY
   ```

2. Set display if needed:
   ```bash
   export DISPLAY=:0  # For first local display
   ```

3. Or use Docker (auto-configures DISPLAY)

#### "Port 8765 already in use" error

**Cause:** Another process using the WebSocket port

**Solution:**
```bash
# Find process using port 8765
lsof -i :8765
ps aux | grep process_id

# Kill the process
kill -9 process_id

# Or use a different port
export BASSET_HOUND_PORT=9000
npm start
```

---

### Connection Issues

#### "WebSocket connection failed"

**Causes & Solutions:**

1. **Browser not running:**
   ```bash
   npm start
   ```

2. **Firewall blocking port:**
   ```bash
   sudo ufw allow 8765/tcp
   ```

3. **Wrong host/port:**
   ```python
   # Double-check your connection string
   client = BassetHoundClient(host="localhost", port=8765)
   ```

4. **Network issue:**
   ```bash
   ping localhost
   curl -v ws://localhost:8765
   ```

#### "Connection reset by peer"

**Cause:** Browser crashed or closed unexpectedly

**Solution:**
1. Check if browser is still running:
   ```bash
   lsof -i :8765
   ```

2. If not, restart:
   ```bash
   npm start
   ```

3. Check browser logs for crash:
   ```bash
   tail -100 ~/.basset-hound/logs/error.log
   ```

4. Implement reconnection logic in client:
   ```python
   for attempt in range(3):
       try:
           await client.connect()
           break
       except Exception as e:
           if attempt < 2:
               await asyncio.sleep(2 ** attempt)  # Exponential backoff
           else:
               raise
   ```

---

### Navigation Issues

#### "Page doesn't load" or "Blank page"

**Causes & Solutions:**

1. **JavaScript disabled:**
   ```bash
   # JavaScript is enabled by default, but check browser logs
   grep "javascript\|JavaScript" ~/.basset-hound/logs/*.log
   ```

2. **Content blocking (ads, trackers):**
   ```python
   # Disable ad blocking for testing
   # This would require MCP tool modification
   ```

3. **Network issue:**
   ```python
   # Check if page actually loads
   url = await browser.get_url()
   title = await browser.get_title()
   print(f"URL: {url}, Title: {title}")
   ```

4. **Timeout too short:**
   ```python
   await browser.navigate(url, wait_until="load")
   await asyncio.sleep(2)  # Extra wait for dynamic content
   ```

#### "403 Forbidden" or "401 Unauthorized"

**Cause:** Browser headers or fingerprint detected as bot

**Solution:**
1. Enable fingerprinting:
   ```python
   await client.send_command("create_fingerprint_profile", {
       "name": "chrome_linux",
       "platform": "Linux"
   })
   await client.send_command("apply_fingerprint", {"profile_name": "chrome_linux"})
   ```

2. Rotate user agent:
   ```python
   await client.set_user_agent("Mozilla/5.0 (X11; Linux x86_64)")
   ```

3. Use Tor:
   ```python
   await client.set_tor_mode("on")
   ```

4. Add delay between requests:
   ```python
   await asyncio.sleep(random.uniform(1, 3))
   ```

#### "Timeout during navigation"

**Solutions:**
1. Increase wait time:
   ```python
   response = await browser.navigate(url, wait_until="networkidle")
   ```

2. Add explicit wait:
   ```python
   await browser.navigate(url)
   await asyncio.sleep(3)  # Wait for all resources
   ```

3. Check network stability:
   ```bash
   ping -c 5 8.8.8.8  # Test internet connectivity
   ```

4. Check target website:
   ```bash
   curl -I https://example.com  # See if site responds
   ```

---

### Content Extraction Issues

#### "Extract returns empty data"

**Causes & Solutions:**

1. **Page hasn't loaded:**
   ```python
   await browser.navigate(url)
   await asyncio.sleep(2)  # Wait for load
   content = await browser.get_content()
   ```

2. **Dynamic content (JavaScript):**
   ```python
   # Execute JavaScript to extract dynamic content
   data = await browser.execute_script("""
   return {
       text: document.body.innerText,
       html: document.documentElement.outerHTML
   };
   """)
   ```

3. **Content behind authentication:**
   ```python
   # Login first
   await browser.fill("input[name='username']", "user")
   await browser.fill("input[name='password']", "pass")
   await browser.click("button[type='submit']")
   await asyncio.sleep(2)
   # Then extract
   content = await browser.get_content()
   ```

4. **Selector not found:**
   ```python
   # Use browser DevTools to find correct selector
   # F12 in browser window, inspect elements
   links = await browser.extract_links()  # Use high-level methods instead
   ```

#### "Extract returns incomplete data"

**Solutions:**
1. Check for content loading delay:
   ```python
   # Wait for specific element
   await browser.wait_for_element(".content-loaded", timeout=10000)
   ```

2. Check if it's JavaScript-heavy site:
   ```python
   # Execute script to access rendered DOM
   data = await browser.execute_script("""
   return document.querySelectorAll('[data-id]').map(e => ({
       id: e.dataset.id,
       text: e.innerText
   }));
   """)
   ```

3. Try different wait conditions:
   ```python
   await browser.navigate(url, wait_until="domcontentloaded")  # Faster but less complete
   await browser.navigate(url, wait_until="networkidle")  # Slower but complete
   ```

---

### Screenshot Issues

#### "Screenshot returns null or invalid"

**Causes & Solutions:**

1. **Heading not rendered:**
   ```python
   await browser.navigate(url)
   await asyncio.sleep(1)
   screenshot = await browser.screenshot()
   ```

2. **Invalid base64:**
   ```python
   import base64
   
   screenshot_b64 = await browser.screenshot()
   if screenshot_b64:
       try:
           screenshot_bytes = base64.b64decode(screenshot_b64)
           with open("screenshot.png", "wb") as f:
               f.write(screenshot_bytes)
       except Exception as e:
           print(f"Invalid screenshot: {e}")
   ```

3. **Display issue in headless mode:**
   ```bash
   # Ensure Xvfb is running
   ps aux | grep Xvfb
   # If not running, start it
   Xvfb :99 -screen 0 1920x1080x24 &
   ```

---

### JavaScript Execution Issues

#### "JavaScript execution fails"

**Causes & Solutions:**

1. **Syntax error in script:**
   ```python
   # Test script syntax first
   js_code = """
   return document.title;  // Make sure script is valid
   """
   try:
       result = await browser.execute_script(js_code)
   except Exception as e:
       print(f"Script error: {e}")
   ```

2. **Accessing window object issues:**
   ```javascript
   // WRONG: window.location.href
   // RIGHT: Just return data
   return {
       title: document.title,
       url: document.location.href,
       // window object is implicit context
   };
   ```

3. **Async code in script:**
   ```python
   # JavaScript in browser runs synchronously
   # For async, use multiple executions with delays
   await browser.execute_script("window.scrollTo(0, document.body.scrollHeight);")
   await asyncio.sleep(1)
   data = await browser.execute_script("return document.body.innerText;")
   ```

---

### Tor Integration Issues

#### "Tor not connecting"

**Cause:** Tor service not running or misconfigured

**Solution:**
```bash
# Check if Tor is installed
which tor

# Check if Tor is running
ps aux | grep tor | grep -v grep

# Start Tor if needed
tor  # Or with config: tor -c /etc/tor/torrc

# Then in browser
await browser.set_tor_mode("on")
```

#### "Tor mode doesn't work in Docker"

**Solution:**
```yaml
# docker-compose.yml - Add Tor service
tor:
  image: tor:latest
  ports:
    - "9050:9050"  # SOCKS5 port
  
basset-hound-browser:
  depends_on:
    - tor
  environment:
    - TOR_HOST=tor
    - TOR_PORT=9050
```

---

### MCP Server Issues

#### "MCP tools not discoverable"

**Diagnosis:**
```bash
# Check if server is running
python -m browser_mcp.server

# In another terminal, check tools
python -c "
import subprocess
result = subprocess.run(['python', '-m', 'browser_mcp.server', '--list'], capture_output=True)
print(result.stdout.decode())
"
```

**Solutions:**
1. Verify registration:
   ```bash
   claude mcp list
   # Should show: basset-hound with 166 tools
   ```

2. Check configuration:
   ```bash
   cat ~/.claude/settings.json | jq '.mcpServers'
   ```

3. Restart Claude Code:
   ```bash
   # Restart the IDE/editor with MCP support
   ```

4. Verify Python path:
   ```bash
   which python3
   python3 -m browser_mcp.server --version
   ```

#### "MCP server crashes"

**Debugging:**
```bash
# Run with verbose logging
LOGLEVEL=debug python -m browser_mcp.server

# Check for import errors
python -c "from browser_mcp import server; print('OK')"

# Check dependencies
pip list | grep -E "fastmcp|websockets"
```

---

### Docker Issues

#### "Docker compose won't start"

**Diagnosis:**
```bash
docker-compose config  # Check syntax
docker-compose up --build basset-hound-browser  # See full output
```

**Solutions:**
1. Check Docker is running:
   ```bash
   docker ps
   ```

2. Check Dockerfile:
   ```bash
   cat Dockerfile | head -20
   ```

3. View logs:
   ```bash
   docker logs basset-hound-browser
   ```

4. Rebuild image:
   ```bash
   docker-compose build --no-cache basset-hound-browser
   ```

#### "Can't connect to browser from another container"

**Cause:** Network configuration

**Solution:**
```bash
# Use service name instead of localhost
python client.py --host basset-hound-browser  # Use service name
# NOT: localhost or 127.0.0.1
```

---

## Performance Issues

### "Browser is slow" or "Commands take too long"

**Causes & Solutions:**

1. **System resource constraints:**
   ```bash
   free -h  # Check available memory
   top     # Monitor CPU usage
   ```

2. **Too many concurrent operations:**
   ```python
   # Limit to sequential operations
   for url in urls:
       await browser.navigate(url)
       await browser.get_content()
   ```

3. **Heavy page load:**
   ```python
   # Use faster wait condition
   await browser.navigate(url, wait_until="domcontentloaded")
   ```

### "Memory usage keeps growing"

**Cause:** Memory leak or unclosed resources

**Solutions:**
```python
# Always clean up after use
try:
    await browser.navigate(url)
    # ... do work ...
finally:
    await browser.disconnect()

# OR use context manager
async with BassetHoundClient() as browser:
    await browser.navigate(url)
    # Auto-cleanup when done
```

---

## Recovery Procedures

### Full Reset

```bash
# Stop browser
pkill -f "npm start"
pkill -f "node"

# Remove cache and data
rm -rf ~/.basset-hound/

# Reinstall
npm install

# Start fresh
npm start
```

### Docker Full Reset

```bash
# Stop containers
docker-compose down

# Remove volumes
docker volume rm basset_hound_data

# Remove images
docker rmi basset-hound-browser:11.1.0

# Rebuild and restart
docker-compose up --build basset-hound-browser
```

### Emergency Stop

```bash
# Kill hanging browser process
killall -9 node
killall -9 electron

# Clear ports
lsof -i :8765 | awk '{print $2}' | xargs kill -9
```

---

## Getting Help

### Collect Debug Information

```bash
# Create debug package
mkdir debug-info
cp ~/.basset-hound/logs/* debug-info/
cp ~/.basset-hound/error.log debug-info/
lsof -i :8765 > debug-info/ports.txt
ps aux | grep node > debug-info/processes.txt
npm version > debug-info/versions.txt
python --version >> debug-info/versions.txt

# Archive
tar -czf debug-info.tar.gz debug-info/
```

### Support Resources

- **GitHub Issues:** https://github.com/basset-hound/basset-hound-browser/issues
- **Documentation:** `/docs/` directory
- **API Reference:** `/docs/API-REFERENCE.md`
- **Integration Guide:** `/docs/integration-performance-recommendations.md`

---

**Version:** 11.1.0  
**Last Updated:** May 6, 2026  
**Status:** Production Ready

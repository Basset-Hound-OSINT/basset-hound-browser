# Basset Hound Browser v11.1.0 - Deployment Guide

**Version:** 11.1.0  
**Date:** May 6, 2026  
**Status:** Production Ready

---

## Overview

This guide provides step-by-step instructions for deploying Basset Hound Browser in various environments:
- **Development:** Local npm start with display
- **Production:** Docker containerized deployment
- **Headless:** Server deployment without display

---

## Prerequisites

### For All Deployments
- Node.js 18.x or higher
- npm 9.x or higher
- Git (for cloning repository)
- 2GB+ available disk space

### For Docker Deployment
- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ available RAM

### For Headless Deployment
- Xvfb (virtual display server)
- Or container orchestration platform (Kubernetes, Docker Swarm)

### Optional
- Tor Browser (for Tor integration)
- Python 3.8+ (for MCP server)

---

## Quick Start (5 minutes)

### 1. Clone Repository
```bash
git clone https://github.com/basset-hound/basset-hound-browser.git
cd basset-hound-browser
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Browser
```bash
npm start
```

### 4. Verify Running
```bash
# Check if WebSocket is listening
lsof -i :8765

# Expected output:
# node    12345 user    45u  IPv4  123456      0t0  TCP localhost:8765 (LISTEN)
```

### 5. Test Connection
```bash
# Use Python client
python integrations/python_client.py https://example.com

# Expected output:
# Connected to browser at ws://localhost:8765
# Title: Example Domain
# Found 1 links
```

---

## Development Deployment

### Local Development Setup

**1. Clone and Install**
```bash
git clone https://github.com/basset-hound/basset-hound-browser.git
cd basset-hound-browser
npm install
```

**2. Install Python Dependencies (Optional, for MCP)**
```bash
pip install -r browser_mcp/requirements.txt
```

**3. Start Browser**
```bash
npm start
```

**Output:**
```
Starting Basset Hound Browser...
Electron app initialized
WebSocket server listening on ws://localhost:8765
Press Ctrl+C to stop
```

**4. In another terminal, register MCP (Optional)**
```bash
python -m browser_mcp.server
```

**5. Test with Client**
```bash
# Test Python client
python integrations/python_client.py https://example.com

# Test Node.js client
node integrations/nodejs_client.js https://example.com

# Test OSINT workflow
python integrations/sample_osint_workflow.py https://example.com
```

### Development Tips

- Keep browser running in background terminal
- Use browser devtools: Press F12 in the Electron window
- Check logs: Look in `~/.basset-hound/logs/`
- Reload app: Press Ctrl+R in Electron window
- Clear cache: Delete `~/.basset-hound/cache/`

---

## Docker Deployment

### Docker Compose (Recommended)

**1. Ensure Docker is running**
```bash
docker --version
docker-compose --version
```

**2. Start Basset Hound**
```bash
# From repository root
docker-compose up basset-hound-browser

# Output:
# basset-hound-browser_1  | Starting Basset Hound Browser...
# basset-hound-browser_1  | WebSocket listening on 0.0.0.0:8765
```

**3. Verify Container**
```bash
# Check running containers
docker ps

# Should show: basset-hound-browser running
```

**4. Test Connection**
```bash
# From host machine
python integrations/python_client.py https://example.com

# Or from another container
docker exec -it basset-hound-mcp python -m browser_mcp.server
```

**5. Stop Container**
```bash
docker-compose down
```

### Docker Configuration

**docker-compose.yml** (already configured):

```yaml
version: '3.8'

services:
  basset-hound-browser:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8765:8765"  # WebSocket
    environment:
      - DISPLAY=:99
      - NODE_ENV=production
    volumes:
      - ./data:/app/data  # Persistent storage
    networks:
      - basset-hound-browser
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8765/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  basset-hound-browser:
    driver: bridge
```

### Docker Build

**Build custom image:**
```bash
docker build -t basset-hound-browser:11.1.0 .
```

**Run container:**
```bash
docker run -d \
  --name basset-hound \
  -p 8765:8765 \
  --network basset-hound-browser \
  -v $(pwd)/data:/app/data \
  basset-hound-browser:11.1.0
```

**Access from other containers:**
```bash
# Instead of localhost:8765, use: basset-hound-browser:8765
docker run -it \
  --network basset-hound-browser \
  my-client-image \
  python client.py --host basset-hound-browser
```

---

## Headless Deployment

### Xvfb Headless Setup

**1. Install Xvfb**
```bash
# Ubuntu/Debian
sudo apt-get install xvfb

# CentOS/RHEL
sudo yum install xorg-x11-server-Xvfb
```

**2. Start Virtual Display**
```bash
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99
```

**3. Start Browser**
```bash
npm start
```

**4. Keep Running**
```bash
# Use nohup or screen to keep running after logout
nohup npm start > browser.log 2>&1 &

# Or with screen
screen -S basset-hound -d -m npm start
```

**5. Monitor Logs**
```bash
tail -f browser.log
```

### Docker Headless (Recommended)

```bash
docker run -d \
  --name basset-hound-headless \
  -p 8765:8765 \
  -e DISPLAY=:99 \
  basset-hound-browser:11.1.0
```

---

## MCP Server Registration

### Option 1: Claude Code Registration

```bash
# Register with Claude Code
claude mcp add basset-hound -- python -m browser_mcp.server
```

### Option 2: Manual Configuration

Create `.claude/settings.json`:
```json
{
  "mcpServers": {
    "basset-hound": {
      "command": "python",
      "args": ["-m", "browser_mcp.server"],
      "cwd": "/path/to/basset-hound-browser"
    }
  }
}
```

### Option 3: Environment Variables

```bash
export BASSET_HOUND_HOST=localhost
export BASSET_HOUND_PORT=8765
python -m browser_mcp.server
```

---

## Port Configuration

### WebSocket Port (Default: 8765)

**Change port in code:**
```javascript
// src/main/main.js
const WS_PORT = 8765;  // Change this
```

**Or use environment variable:**
```bash
export BASSET_HOUND_PORT=9000
npm start
```

### Network Exposure

**For remote access (NOT recommended for security):**

```bash
# Listen on all interfaces
node websocket/server.js --host 0.0.0.0

# With authentication
node websocket/server.js --auth-token "secret-token"
```

**Docker port mapping:**
```yaml
ports:
  - "0.0.0.0:8765:8765"  # Expose to all interfaces (use with caution)
```

**Firewall configuration:**
```bash
# UFW (Ubuntu)
sudo ufw allow 8765/tcp

# firewalld (CentOS)
sudo firewall-cmd --add-port=8765/tcp --permanent
```

---

## Performance Tuning

### Memory Configuration

```bash
# Increase Node heap size
export NODE_OPTIONS="--max-old-space-size=2048"
npm start
```

### Electron Configuration

**Edit `src/main/main.js`:**
```javascript
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: true,
    offscreen: true,  // Enable for headless
    backgroundThrottling: false  // Disable throttling
  }
});
```

### WebSocket Optimization

**For high concurrency:**
```javascript
// websocket/server.js
const wss = new WebSocketServer({
  port: 8765,
  perMessageDeflate: false,  // Disable compression for speed
  maxBackpressure: 100 * 1024 * 1024  // 100MB buffer
});
```

---

## Health Checks

### Manual Health Check

```bash
# Test WebSocket connection
python -c "
import asyncio
from integrations.python_client import BassetHoundClient

async def test():
    client = BassetHoundClient()
    try:
        await client.connect()
        health = await client.ping()
        print(f'Health: {'OK' if health else 'FAIL'}')
        await client.disconnect()
    except Exception as e:
        print(f'Error: {e}')

asyncio.run(test())
"
```

### Docker Health Check

Already configured in `docker-compose.yml`:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8765/health || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### Kubernetes Health Check

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8765
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 8765
  initialDelaySeconds: 10
  periodSeconds: 5
```

---

## Logging

### Log Levels

```bash
# Debug logging
export LOG_LEVEL=debug
npm start

# Info logging (default)
export LOG_LEVEL=info
npm start

# Error only
export LOG_LEVEL=error
npm start
```

### Log Files

**Browser logs:**
```bash
tail -f ~/.basset-hound/logs/browser.log
```

**MCP server logs:**
```bash
python -m browser_mcp.server 2>&1 | tee mcp-server.log
```

**Docker logs:**
```bash
docker logs -f basset-hound-browser
```

---

## Security Configuration

### Firewall Rules

```bash
# Allow local only
iptables -A INPUT -p tcp --dport 8765 -s 127.0.0.1 -j ACCEPT
iptables -A INPUT -p tcp --dport 8765 -j DROP
```

### SSL/TLS (for remote access)

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365

# Start with HTTPS
export WSS_KEY=key.pem
export WSS_CERT=cert.pem
npm start
```

### Authentication

**Token-based (example):**
```bash
export AUTH_TOKEN="secret-token-here"
npm start
```

---

## Monitoring & Observability

### Prometheus Metrics

```javascript
// In websocket/server.js
const promClient = require('prom-client');

const websocketConnections = new promClient.Gauge({
  name: 'websocket_connections_active',
  help: 'Active WebSocket connections'
});
```

### Structured Logging

```javascript
// Using winston or pino
logger.info('WebSocket connection', {
  clientId: id,
  timestamp: new Date(),
  duration: elapsed
});
```

### Performance Monitoring

```bash
# Monitor resource usage
watch -n 1 'ps aux | grep node'

# Or with top
top -p $(pgrep -f "npm start")
```

---

## Backup & Recovery

### Data Backup

```bash
# Backup browser profiles
tar -czf basset-hound-backup.tar.gz ~/.basset-hound/

# Backup Docker volume
docker run --rm -v basset-hound_data:/data \
  -v $(pwd):/backup \
  ubuntu tar czf /backup/volume-backup.tar.gz -C / data
```

### Recovery

```bash
# Restore from backup
tar -xzf basset-hound-backup.tar.gz -C ~/

# OR restore Docker volume
docker run --rm -v basset-hound_data:/data \
  -v $(pwd):/backup \
  ubuntu tar xzf /backup/volume-backup.tar.gz -C /
```

---

## Troubleshooting

### Browser Won't Start

**Check display:**
```bash
echo $DISPLAY  # Should show :0 or :99
```

**Verify Node.js:**
```bash
node --version  # Should be 18.x+
```

**Check logs:**
```bash
cat ~/.basset-hound/logs/error.log
```

### WebSocket Connection Refused

**Verify port:**
```bash
lsof -i :8765
netstat -tlnp | grep 8765
```

**Check firewall:**
```bash
sudo firewall-cmd --list-ports
```

### MCP Server Not Starting

**Verify Python:**
```bash
python --version  # Should be 3.8+
```

**Check dependencies:**
```bash
pip list | grep fastmcp
```

**Install if missing:**
```bash
pip install -r browser_mcp/requirements.txt
```

---

## Cleanup

### Remove Development Installation

```bash
# Stop browser
npm stop  # or Ctrl+C

# Remove node modules
rm -rf node_modules
rm package-lock.json

# Remove cache
rm -rf ~/.basset-hound/
```

### Remove Docker Installation

```bash
# Stop container
docker-compose down

# Remove image
docker rmi basset-hound-browser:11.1.0

# Remove volume
docker volume rm basset-hound_data
```

---

## Support

**Documentation:**
- [API Reference](./API-REFERENCE.md)
- [Integration Guide](./integration-performance-recommendations.md)
- [Client Libraries](../integrations/README.md)

**Troubleshooting:**
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- GitHub Issues
- Project Documentation

---

**Version:** 11.1.0  
**Last Updated:** May 6, 2026  
**Status:** Production Ready

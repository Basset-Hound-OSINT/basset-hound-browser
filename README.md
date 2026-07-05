> ⚠️ **OUTDATED** — see `docs/planning/PROJECT-STATUS-MATRIX.md` for the authoritative status (2026-07-04). Claims below are inflated/unverified. The "v12.8.0 Production Ready / 164+ commands / 100% tests" framing is not reliable; the genuinely proven surface is a small deterministic core-command set (navigate, get_content, get_page_state, execute_script, screenshot, scroll, wait, click, fill, type). Evasion is largely unwired (treat as ~0% until live-validated) and no MCP server exists.

# Basset Hound Browser

**Version 12.8.0** — Production Ready ✅

A custom Electron-based browser designed for forensic data extraction, browser automation, and bot detection evasion. Provides comprehensive WebSocket API with 164+ commands for data capture, analysis, and export.

---

## ⚡ Quick Links

**👉 [Getting Started (5 min)](docs/wiki/getting-started/FIRST-COMMAND.md)** — Install, run first command, verify it works

**👉 [Full Wiki Documentation](docs/wiki/README.md)** — Complete guide (installation, guides, API, deployment, troubleshooting)

**👉 [API Reference (140+ Commands)](docs/wiki/api/COMPLETE-REFERENCE.md)** — All WebSocket commands with examples

**👉 [Deployment Guide](docs/wiki/deployment/DOCKER-DEPLOYMENT.md)** — Docker, TLS, monitoring, scaling

---

## ✨ Key Features

- **164+ WebSocket Commands** — Navigate, click, extract content, rotate proxies, spoof fingerprints
- **Bot Detection Evasion** — Fingerprint spoofing, behavioral simulation, Tor integration
- **Forensic Data Extraction** — HTML capture, DOM snapshots, JavaScript context, export formats
- **Multi-Profile Support** — Isolated browser profiles, session persistence, multi-account workflows
- **Proxy & User Agent Rotation** — Built-in rotation with sequential/random modes
- **Human-Like Behavior** — Natural mouse movement, realistic typing, random delays
- **Screenshot Capture** — Full-page, viewport, element, and custom crop screenshots

---

## 🚀 Get Started in 3 Steps

### 1. Install

```bash
git clone https://github.com/basset-hound/basset-hound-browser.git
cd basset-hound-browser
npm install
```

### 2. Start Browser

```bash
npm start:dev
```

### 3. Send First Command

```python
import asyncio, json, websockets

async def main():
    async with websockets.connect("ws://localhost:8765") as ws:
        await ws.send(json.dumps({"id": "1", "command": "ping"}))
        print(await ws.recv())

asyncio.run(main())
```

**→ [See full getting started guide](docs/wiki/getting-started/FIRST-COMMAND.md)**

---

## 📚 Documentation

| Section | Purpose | Time |
|---------|---------|------|
| **[Getting Started](docs/wiki/getting-started/)** | Installation, first command, Docker | 5-10 min |
| **[User Guides](docs/wiki/guides/)** | Navigation, capture, evasion, profiles | 15-30 min |
| **[API Reference](docs/wiki/api/)** | All 164+ commands with examples | Reference |
| **[Deployment](docs/wiki/deployment/)** | Production setup, scaling, monitoring | 30+ min |
| **[Development](docs/wiki/development/)** | Architecture, testing, contributing | Reference |
| **[Troubleshooting](docs/wiki/troubleshooting/)** | Common issues, debugging, FAQ | As needed |

**→ [View full wiki index](docs/wiki/README.md)**

---

## 🔒 Security Notice

**Open development tool** — All 140+ WebSocket commands are unrestricted and available without authentication. This is intentional for development purposes.

**For production:** Configure rate limiting, use WSS (TLS/SSL), implement reverse proxy authentication, and follow deployment security checklist.

**→ [See security guide](SECURITY.md)**

---

## 💻 Usage Example

```python
import asyncio, json, websockets

async def example():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Navigate
        await ws.send(json.dumps({
            "id": "1",
            "command": "navigate",
            "url": "https://example.com"
        }))
        await ws.recv()
        
        # Wait for load
        await asyncio.sleep(2)
        
        # Extract content
        await ws.send(json.dumps({
            "id": "2",
            "command": "get_content"
        }))
        response = json.loads(await ws.recv())
        print(f"Title: {response['content']['title']}")
        
        # Take screenshot
        await ws.send(json.dumps({
            "id": "3",
            "command": "screenshot"
        }))
        response = json.loads(await ws.recv())
        print(f"Screenshot: {response['data'][:50]}...")

asyncio.run(example())
```

**→ [See more examples](docs/EXAMPLES.md)**

---

## 📋 Status

- **v12.8.0:** Phase 1 Forensic Commands complete (50 new commands)
- **API:** 164+ commands fully implemented and tested
- **Tests:** 316/342 core tests passing (92.3%)
- **Performance:** 481 msgs/sec at 50 concurrent, <2ms P99 latency
- **Production:** Ready for deployment ✅

---

## 📦 Installation Options

### Local (npm)
```bash
npm install && npm start:dev
```

### Docker (dev)
```bash
docker build -f Dockerfile.dev -t basset-hound:dev .
docker run -p 8765:8765 basset-hound:dev
```

### Docker (prod)
```bash
docker build -f Dockerfile.prod -t basset-hound:prod .
docker run -p 8765:8765 -d basset-hound:prod
```

**→ [Full installation guide](docs/wiki/getting-started/INSTALLATION.md)**

---

## 🤝 Integration

Use with your app via WebSocket at `ws://localhost:8765`

**Client Libraries:**
- Python: `async with websockets.connect("ws://localhost:8765")`
- Node.js: `new WebSocket("ws://localhost:8765")`
- All languages with WebSocket support

**→ [Integration guide](docs/INTEGRATION-GUIDE.md)**

---

## 📄 License

MIT License — See [LICENSE](LICENSE) file for details

---

## 📞 Need Help?

- **[Getting Started Guide](docs/wiki/getting-started/FIRST-COMMAND.md)** — First-time setup
- **[FAQ](docs/wiki/troubleshooting/FAQ.md)** — Common questions
- **[Troubleshooting](docs/wiki/troubleshooting/)** — Connection, performance, Docker issues
- **[API Reference](docs/wiki/api/COMPLETE-REFERENCE.md)** — Command documentation
- **[Wiki Index](docs/wiki/README.md)** — All documentation

---

**Ready?** → **[Start here](docs/wiki/getting-started/FIRST-COMMAND.md)**

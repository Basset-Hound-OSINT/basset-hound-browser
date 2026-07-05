# Basset Hound Browser Python Client - Dependencies

## Runtime Dependencies

### Required
- **websocket-client** (>=1.0.0) - WebSocket client library for communicating with Basset Hound Browser
- **typing-extensions** (>=4.0.0; Python <3.10) - Type hints backport for older Python versions

### Optional
- **websockets** (>=10.0) - Async WebSocket support (install with `pip install basset-hound-client[async]`)

## Development Dependencies

Install with: `pip install basset-hound-client[dev]`

- **pytest** (>=7.0.0) - Testing framework
- **pytest-asyncio** (>=0.20.0) - Async test support
- **black** (>=23.0.0) - Code formatter
- **mypy** (>=1.0.0) - Static type checker
- **flake8** (>=4.0.0) - Code linter

## Installation

### Basic Installation
```bash
pip install basset-hound-client
```

### Development Installation
```bash
pip install -e ".[dev]"
```

### With Optional Async Support
```bash
pip install "basset-hound-client[async]"
```

### From Source
```bash
cd clients/python
pip install -e .
```

## Python Version Support

- Python 3.8
- Python 3.9
- Python 3.10
- Python 3.11
- Python 3.12

## System Requirements

- **Basset Hound Browser**: Running locally on default port 8765
  - Or accessible at configured host:port
  - WebSocket protocol support
  - Supports both `ws://` and `wss://` (SSL/TLS) connections

## Verification

To verify dependencies are installed correctly:

```python
import websocket
from basset_hound import BassetHoundClientWithForensics

print("All dependencies installed successfully!")
```

## Version Compatibility

| Client Version | API Version | Python Min | websocket-client Min |
|---|---|---|---|
| 1.2.0 | 12.1.0+ | 3.8 | 1.0.0 |
| 1.1.0 | 12.0.0+ | 3.8 | 1.0.0 |
| 1.0.0 | 12.0.0+ | 3.8 | 1.0.0 |

## Dependency Notes

### websocket-client
The primary dependency for WebSocket communication. Version 1.0.0 or later is required for:
- Proper message handling
- Connection management
- Error recovery

### typing-extensions
Only installed for Python <3.10. Provides backported type hints including:
- TypedDict
- Protocol
- Literal

Automatically skipped for Python 3.10+ where these are built-in.

## Troubleshooting

### Connection refused error
- Verify Basset Hound Browser is running on localhost:8765
- Check firewall/network settings
- Use `client.url` to verify connection string

### Import errors
```bash
# Reinstall dependencies
pip install --upgrade --force-reinstall basset-hound-client

# Or from source
cd clients/python
pip install -e .
```

### Type checking errors (mypy)
```bash
# Install full type stubs
pip install types-websocket
```

## License

MIT License - See LICENSE file in project root

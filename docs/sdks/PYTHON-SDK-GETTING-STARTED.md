# Basset Hound Browser Python SDK - Getting Started

**Version:** 1.1.0  
**Updated:** June 14, 2026  
**Requires:** Python 3.8+

## Overview

The Basset Hound Browser Python SDK provides a complete async/await interface for browser automation, forensic capture, and bot evasion. It wraps the WebSocket API with type hints, automatic connection pooling, and session persistence.

### Key Features

- **All 164 WebSocket Commands** - Complete coverage of navigation, interaction, extraction, screenshots, evasion, and forensics
- **Async/Await Throughout** - Native Python asyncio support for concurrent operations
- **Session Persistence** - Create checkpoints, branch sessions, and resume from saved states
- **Connection Pooling** - Manage multiple concurrent browser connections efficiently
- **Automatic Reconnection** - Built-in retry logic with exponential backoff
- **Type Hints** - Full IDE support and type checking
- **Streaming Support** - Handle large responses with async generators
- **Batch Operations** - Execute multiple commands atomically
- **Error Recovery** - Comprehensive error handling with detailed recovery information

## Installation

### From PyPI (Production)

```bash
pip install basset-hound-browser
```

### From Source (Development)

```bash
git clone https://github.com/yourorg/basset-hound-browser.git
cd basset-hound-browser
pip install -e ./sdks/python-sdk
```

### Dependencies

The SDK installs the following dependencies:
- `websockets>=11.0` - WebSocket client
- `aiohttp>=3.9` (optional) - For advanced HTTP integration
- `typing-extensions` (optional) - Backports for older Python versions

### Verify Installation

```python
import basset_hound
from basset_hound import BrowserClient

print(f"SDK Version: {basset_hound.__version__}")
```

## 5-Minute Quick Start

### 1. Basic Connection and Navigation

```python
import asyncio
from basset_hound import BrowserClient

async def main():
    # Connect to browser server
    async with BrowserClient('ws://localhost:8765') as client:
        # Navigate to a website
        await client.navigate('https://example.com')
        
        # Get the current URL
        url = await client.get_url()
        print(f"Current URL: {url}")
        
        # Take a screenshot
        screenshot = await client.screenshot()
        print(f"Screenshot captured: {screenshot['filename']}")

# Run the example
asyncio.run(main())
```

### 2. Extract Page Content

```python
async def extract_content():
    async with BrowserClient('ws://localhost:8765') as client:
        await client.navigate('https://example.com')
        
        # Get HTML content
        content = await client.get_content()
        print(f"HTML length: {len(content['html'])}")
        
        # Get plain text
        text = await client.get_text()
        print(f"Text preview: {text['text'][:200]}")
        
        # Extract all links
        links = await client.extract_links()
        print(f"Found {len(links['links'])} links")
        
        # Detect technologies on the page
        tech = await client.detect_technology()
        print(f"Technologies: {[t['name'] for t in tech['technologies']]}")

asyncio.run(extract_content())
```

### 3. Session Persistence with Checkpoints

```python
async def session_persistence():
    async with BrowserClient('ws://localhost:8765') as client:
        # Navigate and create a checkpoint
        await client.navigate('https://example.com')
        checkpoint = await client.create_checkpoint('initial_state')
        print(f"Checkpoint created: {checkpoint['id']}")
        
        # Do some interactions
        await client.click(selector='a')
        await client.wait(2000)
        
        # Rollback to checkpoint
        await client.rollback_to_checkpoint(checkpoint['id'])
        print("Rolled back to initial state")
        
        # Branch session for A/B testing
        branch = await client.branch_session('test_variant_b')
        print(f"Branch session ID: {branch['session_id']}")

asyncio.run(session_persistence())
```

### 4. Interactive DOM Manipulation

```python
async def interact_with_page():
    async with BrowserClient('ws://localhost:8765') as client:
        await client.navigate('https://example.com')
        
        # Fill form fields
        await client.fill(selector='input[name="email"]', text='user@example.com')
        await client.fill(selector='input[name="password"]', text='secret')
        
        # Click button
        await client.click(selector='button[type="submit"]')
        
        # Wait for navigation
        await client.wait_for_navigation(timeout=5000)
        
        # Scroll and interact
        await client.scroll(100, 200)
        await client.hover(selector='a.menu-item')
        
        # Type text character by character
        await client.type(selector='textarea', text='Some input text')

asyncio.run(interact_with_page())
```

## Configuration Guide

### Basic Configuration

```python
client = BrowserClient(
    ws_url='ws://localhost:8765',      # WebSocket server URL
    timeout=30.0,                       # Request timeout in seconds
    auto_reconnect=True,                # Auto-reconnect on disconnect
    reconnect_delay=1.0,                # Delay between reconnects (seconds)
    max_retries=3,                      # Max retries for failed commands
    log_level=logging.INFO              # Logging verbosity
)
```

### Advanced Configuration

```python
from basset_hound import BrowserClient, BrowserPool

# Connection pooling for concurrent requests
pool = BrowserPool(
    ws_urls=['ws://localhost:8765', 'ws://localhost:8766'],
    pool_size=5,           # Number of connections per server
    timeout=30.0,
    auto_reconnect=True
)

# Get a connection
async with pool.acquire() as client:
    await client.navigate('https://example.com')
```

## Common Patterns

### Pattern 1: Retry on Specific Errors

```python
async def navigate_with_retry(client, url, max_attempts=3):
    for attempt in range(max_attempts):
        try:
            await client.navigate(url)
            return
        except TimeoutError:
            if attempt < max_attempts - 1:
                await asyncio.sleep(2 ** attempt)
            else:
                raise
```

### Pattern 2: Batch Operations

```python
async def batch_operations():
    async with BrowserClient('ws://localhost:8765') as client:
        commands = [
            ('navigateUrl', {'url': 'https://example.com'}),
            ('screenshot', {}),
            ('getContent', {}),
            ('extractLinks', {})
        ]
        
        results = await client.batch_commands(commands)
        for i, result in enumerate(results):
            if result.success:
                print(f"Command {i} succeeded")
            else:
                print(f"Command {i} failed: {result.error}")

asyncio.run(batch_operations())
```

### Pattern 3: Streaming Large Responses

```python
async def stream_large_content():
    async with BrowserClient('ws://localhost:8765') as client:
        await client.navigate('https://example.com')
        
        # Stream page content
        async for chunk in client.stream_content(chunk_size=10000):
            print(f"Received chunk of {len(chunk)} bytes")
            process_chunk(chunk)  # Process incrementally

asyncio.run(stream_large_content())
```

## Learning Path

### Level 1: Basics (30 minutes)
1. Installation and setup
2. Basic navigation and URL retrieval
3. Screenshot capture
4. Simple content extraction

**Key methods:** `navigate()`, `get_url()`, `screenshot()`, `get_content()`

### Level 2: Interaction (1 hour)
1. Form filling and submission
2. Clicking elements
3. Text extraction
4. Waiting for elements and navigation

**Key methods:** `fill()`, `click()`, `type()`, `wait_for_navigation()`

### Level 3: Advanced Features (1-2 hours)
1. Session checkpoints and rollback
2. Session branching
3. Cookie and storage management
4. Batch operations

**Key methods:** `create_checkpoint()`, `branch_session()`, `set_cookies()`, `batch_commands()`

### Level 4: Expert (2+ hours)
1. Connection pooling
2. Streaming for large data
3. Custom evasion profiles
4. Network interception

**Key methods:** `BrowserPool`, `stream_content()`, `set_fingerprint_profile()`, `intercept_requests()`

## Troubleshooting

### Connection Issues

**Problem:** "Failed to connect to ws://localhost:8765"

**Solutions:**
1. Verify browser server is running: `docker ps`
2. Check network connectivity: `curl http://localhost:8765`
3. Increase timeout: `BrowserClient(..., timeout=60.0)`

### Timeout Errors

**Problem:** "Command navigateUrl timed out"

**Solutions:**
1. Increase timeout: `client = BrowserClient(timeout=60.0)`
2. Check browser server health: `await client.health_check()`
3. Reduce concurrent commands
4. Check network latency

### Memory Issues

**Problem:** Memory grows with long-running operations

**Solutions:**
1. Explicitly disconnect clients: `await client.disconnect()`
2. Use connection pooling instead of creating new clients
3. Clear checkpoints periodically: `await client.delete_checkpoint(checkpoint_id)`
4. Monitor with `get_session_info()`

## Next Steps

- **[API Reference](../archive/deprecated/PYTHON-SDK-API-REFERENCE.md)** - Complete method documentation
- **[Examples](../archive/deprecated/PYTHON-SDK-EXAMPLES.md)** - Detailed examples covering common use cases
- **[Architecture Guide](../architecture/core/PYTHON-SDK-ARCHITECTURE.md)** - Design patterns and internals

## License

See LICENSE file in the main repository.

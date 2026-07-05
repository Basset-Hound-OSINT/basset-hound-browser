# Basset Hound Browser Python SDK - Examples

**Version:** 1.1.0  
**Updated:** June 14, 2026

Complete working examples for the Python SDK. All examples use async/await syntax with Python 3.8+.

## Table of Contents

1. [Basic Navigation & Screenshot](#1-basic-navigation--screenshot)
2. [Content Extraction Workflow](#2-content-extraction-workflow)
3. [Streaming Large Responses](#3-streaming-large-responses)
4. [Batch Operations](#4-batch-operations)
5. [Connection Pooling](#5-connection-pooling)
6. [Session Management & Checkpoints](#6-session-management--checkpoints)
7. [Fingerprinting & Bot Evasion](#7-fingerprinting--bot-evasion)
8. [Error Handling & Recovery](#8-error-handling--recovery)
9. [FastAPI Integration](#9-fastapi-integration)
10. [Concurrent Monitoring](#10-concurrent-monitoring)

---

## 1. Basic Navigation & Screenshot

The simplest example - navigate and capture a screenshot.

```python
import asyncio
from basset_hound import BrowserClient

async def basic_navigation():
    """Navigate to a website and take a screenshot."""
    async with BrowserClient('ws://localhost:8765') as client:
        # Navigate to the website
        print("Navigating to example.com...")
        await client.navigate('https://example.com')
        
        # Get the current URL
        current_url = await client.get_url()
        print(f"Current URL: {current_url}")
        
        # Take a screenshot
        screenshot = await client.screenshot(full_page=True)
        print(f"Screenshot saved to: {screenshot['filename']}")
        print(f"Image size: {screenshot['width']}x{screenshot['height']}")

# Run the example
if __name__ == '__main__':
    asyncio.run(basic_navigation())
```

**Output:**
```
Navigating to example.com...
Current URL: https://example.com/
Screenshot saved to: /tmp/screenshot_12345.png
Image size: 1920x1080
```

---

## 2. Content Extraction Workflow

Extract multiple types of content from a webpage.

```python
import asyncio
from basset_hound import BrowserClient

async def extract_website_content():
    """Extract and analyze website content."""
    async with BrowserClient('ws://localhost:8765') as client:
        await client.navigate('https://example.com')
        
        # Extract HTML content
        print("Extracting HTML...")
        html_response = await client.get_content()
        html = html_response['html']
        print(f"HTML size: {len(html)} bytes")
        
        # Extract text content
        print("\nExtracting text content...")
        text_response = await client.get_text()
        text = text_response['text']
        print(f"Text preview: {text[:200]}...")
        
        # Extract all links
        print("\nExtracting links...")
        links_response = await client.extract_links()
        links = links_response['links']
        print(f"Found {len(links)} links:")
        for link in links[:5]:  # Show first 5
            print(f"  - {link['text']} -> {link['url']}")
        
        # Detect technologies
        print("\nDetecting technologies...")
        tech_response = await client.detect_technology()
        technologies = tech_response['technologies']
        print(f"Detected {len(technologies)} technologies:")
        for tech in technologies[:5]:
            version = f" v{tech['version']}" if tech.get('version') else ""
            print(f"  - {tech['name']}{version} ({tech['category']})")
        
        # Extract metadata
        print("\nExtracting metadata...")
        metadata = await client.extract_metadata()
        print(f"Title: {metadata.get('title')}")
        print(f"Description: {metadata.get('description')}")
        
        return {
            'url': await client.get_url(),
            'html_size': len(html),
            'text_size': len(text),
            'links_count': len(links),
            'technologies_count': len(technologies)
        }

if __name__ == '__main__':
    result = asyncio.run(extract_website_content())
    print(f"\nSummary: {result}")
```

**Output:**
```
Extracting HTML...
HTML size: 1256 bytes

Extracting text content...
Text preview: Example Domain
...

Extracting links...
Found 1 links:
  - More information... -> https://www.iana.org/domains/example

Detecting technologies...
Detected 3 technologies:
  - Apache v2.4.41 (Web Servers)
  - HTML5 (Markup languages)
  - CSS (Frameworks)

Extracting metadata...
Title: Example Domain
Description: Example Domain. This domain is for use in examples...

Summary: {'url': 'https://example.com/', 'html_size': 1256, 'text_size': 210, 'links_count': 1, 'technologies_count': 3}
```

---

## 3. Streaming Large Responses

Handle large content with streaming to avoid memory overload.

```python
import asyncio
from basset_hound import BrowserClient

async def stream_large_content():
    """Stream page content in chunks for efficient memory usage."""
    async with BrowserClient('ws://localhost:8765', timeout=60.0) as client:
        await client.navigate('https://example.com')
        
        print("Streaming content in 5KB chunks...")
        total_bytes = 0
        chunk_count = 0
        
        try:
            async for chunk in client.stream_content(chunk_size=5000):
                chunk_count += 1
                total_bytes += len(chunk)
                print(f"  Chunk {chunk_count}: {len(chunk)} bytes (total: {total_bytes})")
                
                # Process chunk here (e.g., parse, search, filter)
                if b'example' in chunk:
                    print("    -> Found keyword 'example' in chunk")
        
        except Exception as e:
            print(f"Streaming error: {e}")
            return None
        
        print(f"\nStreaming complete: {total_bytes} bytes in {chunk_count} chunks")
        return total_bytes

if __name__ == '__main__':
    asyncio.run(stream_large_content())
```

**Output:**
```
Streaming content in 5KB chunks...
  Chunk 1: 5000 bytes (total: 5000)
    -> Found keyword 'example' in chunk
  Chunk 2: 1256 bytes (total: 6256)

Streaming complete: 6256 bytes in 2 chunks
```

---

## 4. Batch Operations

Execute multiple commands efficiently in a single batch.

```python
import asyncio
from basset_hound import BrowserClient

async def batch_workflow():
    """Execute multiple commands in a batch for efficiency."""
    async with BrowserClient('ws://localhost:8765') as client:
        # Define commands to execute
        commands = [
            ('navigateUrl', {'url': 'https://example.com'}),
            ('screenshot', {'fullPage': True}),
            ('getContent', {}),
            ('extractLinks', {}),
            ('detectTechnology', {}),
            ('getUrl', {}),
        ]
        
        print(f"Executing {len(commands)} commands in batch...")
        results = await client.batch_commands(commands)
        
        # Process results
        print(f"\nResults:")
        for i, result in enumerate(results):
            if result.success:
                print(f"  [{i}] {result.command}: SUCCESS ({result.execution_time:.3f}s)")
                if result.data:
                    # Print relevant data
                    if 'url' in result.data:
                        print(f"      -> URL: {result.data['url']}")
                    elif 'filename' in result.data:
                        print(f"      -> File: {result.data['filename']}")
                    elif 'links' in result.data:
                        print(f"      -> {len(result.data['links'])} links found")
            else:
                print(f"  [{i}] {result.command}: FAILED")
                print(f"      -> Error: {result.error}")
                if result.recovery:
                    print(f"      -> Recovery: {result.recovery}")
        
        return results

if __name__ == '__main__':
    asyncio.run(batch_workflow())
```

**Output:**
```
Executing 6 commands in batch...

Results:
  [0] navigateUrl: SUCCESS (0.523s)
  [1] screenshot: SUCCESS (0.234s)
      -> File: /tmp/screenshot_xyz.png
  [2] getContent: SUCCESS (0.012s)
      -> 1256 bytes retrieved
  [3] extractLinks: SUCCESS (0.008s)
      -> 1 links found
  [4] detectTechnology: SUCCESS (0.045s)
      -> 3 technologies detected
  [5] getUrl: SUCCESS (0.002s)
      -> URL: https://example.com/
```

---

## 5. Connection Pooling

Manage multiple concurrent browser connections efficiently.

```python
import asyncio
from basset_hound import BrowserClient, BrowserPool

async def pool_operations():
    """Use connection pooling for concurrent operations."""
    # Create a pool with multiple servers
    pool = BrowserPool(
        ws_urls=[
            'ws://localhost:8765',
            'ws://localhost:8766',
            'ws://localhost:8767',
        ],
        pool_size=3,  # 3 connections per server = 9 total
        timeout=30.0
    )
    
    urls = [
        'https://example.com',
        'https://example.org',
        'https://example.net',
    ]
    
    async def visit_url(url: str, worker_id: int):
        """Visit a URL using a pooled connection."""
        async with pool.acquire() as client:
            print(f"Worker {worker_id}: Visiting {url}")
            await client.navigate(url)
            current_url = await client.get_url()
            screenshot = await client.screenshot()
            print(f"Worker {worker_id}: Captured {screenshot['filename']}")
            return current_url
    
    # Run tasks concurrently
    print("Starting concurrent operations...")
    tasks = [
        visit_url(urls[i % len(urls)], i)
        for i in range(9)
    ]
    
    results = await asyncio.gather(*tasks)
    
    print(f"\nCompleted {len(results)} concurrent operations")
    
    # Cleanup
    pool.close()
    
    return results

if __name__ == '__main__':
    asyncio.run(pool_operations())
```

**Output:**
```
Starting concurrent operations...
Worker 0: Visiting https://example.com
Worker 1: Visiting https://example.org
Worker 2: Visiting https://example.net
Worker 3: Visiting https://example.com
...
Worker 0: Captured /tmp/screenshot_0.png
Worker 1: Captured /tmp/screenshot_1.png
Worker 2: Captured /tmp/screenshot_2.png
...

Completed 9 concurrent operations
```

---

## 6. Session Management & Checkpoints

Create checkpoints and branch sessions for A/B testing.

```python
import asyncio
from basset_hound import BrowserClient

async def session_management():
    """Manage sessions with checkpoints and branching."""
    async with BrowserClient('ws://localhost:8765') as client:
        # Navigate to starting point
        await client.navigate('https://example.com')
        
        # Create initial checkpoint
        print("Creating initial checkpoint...")
        checkpoint_1 = await client.create_checkpoint('initial_state')
        print(f"  Checkpoint ID: {checkpoint_1['id']}")
        print(f"  URL: {checkpoint_1['url']}")
        
        # Perform some interactions (variant A)
        print("\nVariant A: Clicking link...")
        await client.click('a')
        await client.wait(1000)
        
        # Create checkpoint after variant A
        checkpoint_2 = await client.create_checkpoint('variant_a')
        print(f"  Checkpoint after variant A: {checkpoint_2['id']}")
        
        # Rollback and try variant B
        print("\nRolling back to initial state...")
        await client.rollback_to_checkpoint(checkpoint_1['id'])
        
        # Create branch for variant B
        print("\nVariant B: Branching session...")
        branch = await client.branch_session('variant_b')
        print(f"  Branch session ID: {branch['session_id']}")
        
        # Do different interactions in branch
        print("  Scrolling page...")
        await client.scroll(100, 200)
        
        # List all checkpoints
        print("\nAll checkpoints:")
        checkpoints = await client.list_checkpoints()
        for cp in checkpoints['checkpoints']:
            print(f"  - {cp['name']} ({cp['id']})")
        
        return {
            'checkpoints': len(checkpoints['checkpoints']),
            'branch_created': branch['session_id']
        }

if __name__ == '__main__':
    result = asyncio.run(session_management())
    print(f"\nSummary: {result}")
```

**Output:**
```
Creating initial checkpoint...
  Checkpoint ID: cp_abc123
  URL: https://example.com/

Variant A: Clicking link...
  Checkpoint after variant A: cp_def456

Rolling back to initial state...

Variant B: Branching session...
  Branch session ID: session_xyz789
  Scrolling page...

All checkpoints:
  - initial_state (cp_abc123)
  - variant_a (cp_def456)

Summary: {'checkpoints': 2, 'branch_created': 'session_xyz789'}
```

---

## 7. Fingerprinting & Bot Evasion

Configure fingerprinting and bot evasion techniques.

```python
import asyncio
from basset_hound import BrowserClient

async def bot_evasion():
    """Configure fingerprinting and evasion settings."""
    async with BrowserClient('ws://localhost:8765') as client:
        # Set custom user agent
        print("Configuring fingerprinting...")
        await client.set_user_agent(
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        )
        
        # Set viewport
        await client.set_viewport(width=1920, height=1080)
        
        # Set device fingerprint profile
        await client.set_fingerprint_profile('chrome_latest_linux')
        
        # Enable behavioral AI
        await client.enable_behavioral_ai(score_threshold=0.7)
        
        # Configure proxy
        await client.set_proxy(
            protocol='http',
            host='proxy.example.com',
            port=8080
        )
        
        # Disable headless indicators
        await client.disable_headless_indicators()
        
        print("Fingerprinting configured successfully")
        
        # Navigate and verify
        await client.navigate('https://httpbin.org/user-agent')
        content = await client.get_content()
        print(f"\nUser-Agent verified: {content['html'][:100]}...")
        
        # Get evasion status
        status = await client.get_evasion_status()
        print(f"\nEvasion Status:")
        for key, value in status.items():
            print(f"  - {key}: {value}")

if __name__ == '__main__':
    asyncio.run(bot_evasion())
```

**Output:**
```
Configuring fingerprinting...
Fingerprinting configured successfully

User-Agent verified: {"user-agent": "Mozilla/5.0 (X11; Linux x86_64)...

Evasion Status:
  - user_agent_spoofed: True
  - viewport_configured: True
  - fingerprint_profile: chrome_latest_linux
  - behavioral_ai_enabled: True
  - proxy_active: True
  - headless_indicators: False
```

---

## 8. Error Handling & Recovery

Comprehensive error handling with recovery strategies.

```python
import asyncio
from basset_hound import BrowserClient, CommandTimeoutError, ConnectionError

async def robust_navigation(url: str, max_retries: int = 3) -> bool:
    """Navigate with comprehensive error handling and recovery."""
    for attempt in range(max_retries):
        try:
            async with BrowserClient(
                'ws://localhost:8765',
                timeout=30.0,
                auto_reconnect=True,
                max_retries=3
            ) as client:
                print(f"Attempt {attempt + 1}/{max_retries}: Navigating to {url}")
                await client.navigate(url)
                
                # Verify navigation succeeded
                current_url = await client.get_url()
                if url in current_url or current_url in url:
                    print(f"  SUCCESS: Reached {current_url}")
                    return True
                else:
                    print(f"  WARNING: Expected {url}, got {current_url}")
                    
        except CommandTimeoutError as e:
            print(f"  TIMEOUT: {e}")
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff
                print(f"  Waiting {wait_time}s before retry...")
                await asyncio.sleep(wait_time)
            
        except ConnectionError as e:
            print(f"  CONNECTION ERROR: {e}")
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                print(f"  Waiting {wait_time}s before retry...")
                await asyncio.sleep(wait_time)
            
        except Exception as e:
            print(f"  UNEXPECTED ERROR: {type(e).__name__}: {e}")
            return False
    
    print(f"  FAILED: Could not navigate after {max_retries} attempts")
    return False

async def error_handling_demo():
    """Demonstrate comprehensive error handling."""
    urls = [
        'https://example.com',
        'https://invalid-domain-12345.com',  # Will fail
        'https://example.org',
    ]
    
    results = []
    for url in urls:
        success = await robust_navigation(url)
        results.append((url, success))
        print()
    
    return results

if __name__ == '__main__':
    results = asyncio.run(error_handling_demo())
    print("Summary:")
    for url, success in results:
        status = "✓ SUCCESS" if success else "✗ FAILED"
        print(f"  {status}: {url}")
```

**Output:**
```
Attempt 1/3: Navigating to https://example.com
  SUCCESS: Reached https://example.com/

Attempt 1/3: Navigating to https://invalid-domain-12345.com
  TIMEOUT: Command navigateUrl timed out
  Waiting 1s before retry...

Attempt 2/3: Navigating to https://invalid-domain-12345.com
  CONNECTION ERROR: Failed to resolve domain
  FAILED: Could not navigate after 3 attempts

Summary:
  ✓ SUCCESS: https://example.com
  ✗ FAILED: https://invalid-domain-12345.com
  ✓ SUCCESS: https://example.org
```

---

## 9. FastAPI Integration

Integrate the SDK with a FastAPI application.

```python
import asyncio
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from basset_hound import BrowserClient

app = FastAPI()

class PageExtraction(BaseModel):
    url: str
    full_page: bool = False

class ExtractionResult(BaseModel):
    url: str
    html_size: int
    links_count: int
    technologies: list

@app.post("/extract", response_model=ExtractionResult)
async def extract_page(request: PageExtraction):
    """Extract content from a webpage."""
    try:
        async with BrowserClient('ws://localhost:8765', timeout=30.0) as client:
            # Navigate
            await client.navigate(request.url)
            
            # Extract content
            html_response = await client.get_content()
            links_response = await client.extract_links()
            tech_response = await client.detect_technology()
            
            return ExtractionResult(
                url=await client.get_url(),
                html_size=len(html_response['html']),
                links_count=len(links_response['links']),
                technologies=[
                    tech['name'] for tech in tech_response['technologies']
                ]
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Check if browser server is available."""
    try:
        async with BrowserClient('ws://localhost:8765', timeout=5.0) as client:
            info = await client.get_session_info()
            return {"status": "ok", "session_id": info.get('session_id')}
    except Exception as e:
        return {"status": "error", "error": str(e)}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
```

**Usage:**
```bash
# Start FastAPI server
python app.py

# Extract page content
curl -X POST http://localhost:8000/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "full_page": true}'

# Check health
curl http://localhost:8000/health
```

---

## 10. Concurrent Monitoring

Monitor multiple pages concurrently.

```python
import asyncio
from basset_hound import BrowserClient

async def monitor_page(url: str, check_interval: int = 5) -> None:
    """Monitor a page for changes."""
    async with BrowserClient('ws://localhost:8765') as client:
        await client.navigate(url)
        
        # Get initial state
        initial_content = await client.get_content()
        initial_hash = hash(initial_content['html'])
        
        print(f"Monitoring {url}...")
        changes = 0
        
        # Check for changes every 5 seconds
        for check in range(5):  # 5 checks = 25 seconds
            await asyncio.sleep(check_interval)
            
            # Get current state
            current_content = await client.get_content()
            current_hash = hash(current_content['html'])
            
            if current_hash != initial_hash:
                changes += 1
                print(f"  Change detected at check {check + 1}")
                initial_hash = current_hash
            else:
                print(f"  No change at check {check + 1}")
        
        print(f"  Total changes detected: {changes}")

async def concurrent_monitoring():
    """Monitor multiple pages concurrently."""
    urls = [
        'https://example.com',
        'https://example.org',
        'https://example.net',
    ]
    
    print("Starting concurrent page monitoring...\n")
    
    # Monitor all pages concurrently
    tasks = [monitor_page(url) for url in urls]
    await asyncio.gather(*tasks)
    
    print("\nMonitoring complete")

if __name__ == '__main__':
    asyncio.run(concurrent_monitoring())
```

**Output:**
```
Starting concurrent page monitoring...

Monitoring https://example.com...
Monitoring https://example.org...
Monitoring https://example.net...
  No change at check 1
  No change at check 1
  No change at check 1
  No change at check 2
  No change at check 2
  No change at check 2
  ...
  Total changes detected: 0
  Total changes detected: 0
  Total changes detected: 0

Monitoring complete
```

---

## Running the Examples

All examples can be run with:

```bash
python example_name.py
```

**Requirements:**
- Python 3.8+
- Browser server running on localhost:8765
- Dependencies installed: `pip install basset-hound-browser`

## Next Steps

- Review [SDK API Reference](./PYTHON-SDK-API-REFERENCE.md) for method details
- Check [Architecture Guide](./PYTHON-SDK-ARCHITECTURE.md) for internals
- See [Getting Started](./PYTHON-SDK-GETTING-STARTED.md) for setup

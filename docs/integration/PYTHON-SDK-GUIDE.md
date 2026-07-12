# Python SDK Guide

**Version**: 12.2.0  
**Last Updated**: June 1, 2026  
**Status**: Production Ready  
**Estimated Read Time**: 45 minutes

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [API Wrappers](#api-wrappers)
5. [Advanced Patterns](#advanced-patterns)
6. [Error Handling](#error-handling)
7. [Examples](#examples)
8. [Troubleshooting](#troubleshooting)

---

## Installation

### Requirements

- Python 3.8+
- pip or pipenv
- Modern OS (Linux, macOS, Windows)

### Install via pip

```bash
pip install basset-hound-sdk
```

### Install from source

```bash
git clone https://github.com/basset-hound/python-sdk.git
cd python-sdk
pip install -e .
```

### Verify Installation

```bash
python -c "from basset_hound import Browser; print('SDK installed successfully')"
```

---

## Quick Start

### Basic Connection

```python
import asyncio
from basset_hound import Browser

async def main():
    # Create browser instance
    browser = Browser(
        api_url="ws://localhost:8765"
    )
    
    # Connect
    await browser.connect()
    
    # Navigate
    await browser.navigate(url="https://example.com")
    
    # Get content
    content = await browser.get_content()
    print(f"Page title: {content['title']}")
    
    # Close
    await browser.disconnect()

# Run
asyncio.run(main())
```

### With Context Manager

```python
import asyncio
from basset_hound import Browser

async def main():
    async with Browser("ws://localhost:8765") as browser:
        await browser.navigate(url="https://example.com")
        content = await browser.get_content()
        print(content)

asyncio.run(main())
```

### Using Callbacks

```python
import asyncio
from basset_hound import Browser

async def handle_log(log_entry):
    print(f"[{log_entry['level']}] {log_entry['message']}")

async def main():
    browser = Browser(
        api_url="ws://localhost:8765",
        onLog=handle_log
    )
    
    await browser.navigate(url="https://example.com")
    await browser.disconnect()

asyncio.run(main())
```

---

## Core Concepts

### Browser Instance

Main interface for interacting with Basset Hound.

```python
from basset_hound import Browser

browser = Browser(
    # Connection
    api_url="ws://localhost:8765",
    token="api-key-if-auth-enabled",
    timeout=30000,  # Request timeout in ms
    
    # Options
    userAgent="Mozilla/5.0...",
    viewport={"width": 1920, "height": 1080},
    timezone="America/New_York",
    locale="en-US",
    
    # Callbacks
    onLog=lambda msg: print(msg),
    onError=lambda err: print(err),
    onResponse=lambda res: None
)
```

### Connection Methods

#### Connect (Manual)

```python
browser = Browser("ws://localhost:8765")
await browser.connect()
# Do work
await browser.disconnect()
```

#### Async Context Manager (Recommended)

```python
async with Browser("ws://localhost:8765") as browser:
    await browser.navigate(url="https://example.com")
    # Automatically disconnects
```

### Request/Response Pattern

```python
# Request
response = await browser.navigate(url="https://example.com")

# Response structure
{
    "id": "req-123",
    "command": "navigate",
    "success": True,
    "data": {
        "url": "https://example.com",
        "title": "Example Domain"
    },
    "timing": {
        "duration": 2450,
        "latency": 45
    }
}
```

---

## API Wrappers

### Navigation Commands

#### navigate()

Navigate to a URL.

```python
# Simple navigation
await browser.navigate(url="https://example.com")

# With timeout
await browser.navigate(
    url="https://example.com",
    timeout=10000
)

# Wait for navigation to complete
await browser.navigate(
    url="https://example.com",
    waitFor="networkidle"
)
```

#### get_url()

Get current URL.

```python
url = await browser.get_url()
print(f"Current URL: {url}")
```

#### get_page_state()

Get page title, URL, and available elements.

```python
state = await browser.get_page_state()
print(f"Title: {state['title']}")
print(f"Forms: {len(state['forms'])}")
print(f"Links: {len(state['links'])}")
```

#### wait_for_element()

Wait for element to appear (useful after navigation).

```python
await browser.wait_for_element(
    selector=".product-list",
    timeout=10000
)

# Element appeared, now interact with it
content = await browser.get_content(selector=".product-list")
```

#### execute_script()

Execute JavaScript in page context.

```python
# Get data from JavaScript
result = await browser.execute_script(
    script="return document.querySelectorAll('a').length"
)
print(f"Number of links: {result}")

# With arguments
result = await browser.execute_script(
    script="return arguments[0].textContent",
    args=["#header"]
)

# Complex execution
result = await browser.execute_script(
    script="""
    return {
        title: document.title,
        links: document.querySelectorAll('a').length,
        images: document.querySelectorAll('img').length
    }
    """
)
```

### Interaction Commands

#### click()

Click an element.

```python
# Simple click
await browser.click(selector="button.submit")

# Humanized click (random delays)
await browser.click(
    selector="button.submit",
    humanize=True
)

# With coordinates
await browser.mouse_click(x=100, y=200, button="left")
```

#### fill()

Fill form field with text.

```python
# Fill single field
await browser.fill(
    selector="input[name='username']",
    text="myusername"
)

# Fill password (masked in logs)
await browser.fill(
    selector="input[type='password']",
    text="mypassword",
    humanize=True
)

# Fill multiple fields
fields = {
    "input[name='email']": "user@example.com",
    "input[name='password']": "password123",
    "textarea[name='comment']": "My comment"
}

for selector, text in fields.items():
    await browser.fill(selector=selector, text=text)
```

#### type_text()

Type text character by character (more human-like).

```python
# Type with human timing
await browser.type_text(
    text="Hello World",
    selector="input[name='search']",
    humanize=True
)
```

#### scroll()

Scroll page or to element.

```python
# Scroll down
await browser.scroll(x=0, y=500)

# Scroll to element
await browser.scroll(selector=".bottom-section")

# Scroll to specific coordinates
await browser.scroll(x=100, y=1000)
```

#### key_press()

Press keyboard key.

```python
# Press Enter
await browser.key_press(key="Enter")

# Press with modifiers
await browser.key_press(
    key="a",
    modifiers=["Control"]  # Ctrl+A
)

# Common keys
await browser.key_press(key="Tab")
await browser.key_press(key="Escape")
await browser.key_press(key="ArrowDown")
```

### Content Extraction

#### get_content()

Get HTML and text content.

```python
# Get full page content
content = await browser.get_content()
print(f"Title: {content['title']}")
print(f"HTML length: {len(content['html'])}")
print(f"Text: {content['text'][:500]}...")

# Get content for specific selector
content = await browser.get_content(
    selector=".article-body"
)
print(content['html'])
```

#### extract_links()

Extract all links from page.

```python
# Get all links
links = await browser.extract_links()
for link in links[:10]:
    print(f"{link['text']} -> {link['href']}")

# Filter external links
external_links = [l for l in links if l.get('external')]

# Get link count
print(f"Total links: {len(links)}")
```

#### extract_images()

Extract all images.

```python
# Get all images
images = await browser.extract_images()
for img in images[:5]:
    print(f"Image: {img['src']} ({img.get('width')}x{img.get('height')})")

# With lazy-loaded images
images = await browser.extract_images(
    includeLazy=True
)

# Filter by size
large_images = [
    img for img in images 
    if img.get('width', 0) > 500
]
```

#### extract_forms()

Extract form data.

```python
forms = await browser.extract_forms()
for form in forms:
    print(f"Form: {form['name']} -> {form['action']}")
    for field in form['fields']:
        print(f"  - {field['name']} ({field['type']})")
```

#### extract_metadata()

Extract metadata tags.

```python
metadata = await browser.extract_metadata()
print(f"Title: {metadata.get('title')}")
print(f"Description: {metadata.get('description')}")
print(f"Author: {metadata.get('author')}")
print(f"Open Graph: {metadata.get('og')}")
```

#### extract_all()

Extract all content at once.

```python
all_data = await browser.extract_all()
print(f"Links: {len(all_data['links'])}")
print(f"Images: {len(all_data['images'])}")
print(f"Forms: {len(all_data['forms'])}")
print(f"Metadata: {all_data['metadata']}")
```

### Screenshot Commands

#### screenshot()

Capture screenshot.

```python
# PNG screenshot
png_data = await browser.screenshot(format="png")
with open("page.png", "wb") as f:
    f.write(png_data)

# JPEG screenshot
jpeg_data = await browser.screenshot(format="jpeg")

# Viewport only
viewport = await browser.screenshot_viewport()

# Full page
full_page = await browser.screenshot_full_page()

# Specific element
element_shot = await browser.screenshot_element(
    selector=".hero-section"
)
```

### Cookie Management

#### get_cookies()

Get cookies.

```python
# Cookies for URL
cookies = await browser.get_cookies(url="https://example.com")
for cookie in cookies:
    print(f"{cookie['name']} = {cookie['value']}")

# All cookies
all_cookies = await browser.get_all_cookies()

# Cookies by domain
domain_cookies = await browser.get_cookies_for_domain(
    domain="example.com"
)
```

#### set_cookie()

Set cookie.

```python
await browser.set_cookie({
    "name": "user_id",
    "value": "12345",
    "domain": ".example.com",
    "path": "/",
    "expires": 1735689600  # Unix timestamp
})
```

#### clear_cookies()

Clear cookies.

```python
# Clear all
await browser.clear_all_cookies()

# Clear for domain
await browser.clear_all_cookies(domain="example.com")
```

---

## Advanced Patterns

### Retry Logic

```python
import asyncio
from basset_hound import BrowserError

async def navigate_with_retry(browser, url, max_retries=3):
    for attempt in range(max_retries):
        try:
            await browser.navigate(url=url, timeout=10000)
            return
        except BrowserError as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff
                print(f"Retry in {wait_time}s...")
                await asyncio.sleep(wait_time)
            else:
                raise

# Usage
async with Browser("ws://localhost:8765") as browser:
    await navigate_with_retry(browser, "https://example.com")
```

### Parallel Requests

```python
import asyncio
from basset_hound import Browser

async def fetch_url(browser, url):
    await browser.navigate(url=url)
    return await browser.get_content()

async def main():
    # Create separate sessions for parallel work
    urls = [
        "https://example1.com",
        "https://example2.com",
        "https://example3.com"
    ]
    
    results = []
    for url in urls:
        async with Browser("ws://localhost:8765") as browser:
            content = await fetch_url(browser, url)
            results.append(content)
    
    return results

# Run in parallel
results = asyncio.run(main())
```

### Session Checkpointing

```python
from basset_hound import Browser

async def main():
    async with Browser("ws://localhost:8765") as browser:
        # Navigate and authenticate
        await browser.navigate(url="https://example.com/login")
        await browser.fill(selector="input[name='username']", text="user")
        await browser.fill(selector="input[type='password']", text="pass")
        await browser.click(selector="button[type='submit']")
        
        # Create checkpoint after login
        checkpoint = await browser.create_checkpoint(
            name="authenticated",
            tags=["important"]
        )
        print(f"Checkpoint ID: {checkpoint['id']}")
        
        # Do some work
        await browser.navigate(url="https://example.com/dashboard")
        
        # If something fails, rollback
        try:
            await browser.navigate(url="https://example.com/api/data")
        except Exception as e:
            print(f"Error: {e}, rolling back...")
            await browser.rollback_to_checkpoint(
                checkpoint_id=checkpoint['id']
            )
```

### Batch Processing

```python
from basset_hound import Browser
import asyncio

async def process_url(browser, url):
    """Process single URL and return results"""
    await browser.navigate(url=url)
    await browser.wait_for_element(selector=".content", timeout=5000)
    
    content = await browser.get_content()
    links = await browser.extract_links()
    images = await browser.extract_images()
    
    return {
        "url": url,
        "title": content['title'],
        "links": len(links),
        "images": len(images)
    }

async def batch_process(urls, batch_size=3):
    """Process multiple URLs with concurrency limit"""
    results = []
    
    for i in range(0, len(urls), batch_size):
        batch = urls[i:i+batch_size]
        tasks = []
        
        for url in batch:
            async with Browser("ws://localhost:8765") as browser:
                tasks.append(process_url(browser, url))
        
        batch_results = await asyncio.gather(*tasks)
        results.extend(batch_results)
        
        print(f"Processed {i + len(batch)}/{len(urls)}")
    
    return results

# Usage
urls = ["https://example1.com", "https://example2.com", ...]
results = asyncio.run(batch_process(urls, batch_size=3))
```

### Data Pipeline

```python
from basset_hound import Browser
import json

async def extract_products(browser):
    """Extract product information from page"""
    products = []
    
    # Wait for product list to load
    await browser.wait_for_element(selector=".product-list")
    
    # Get all product elements
    product_html = await browser.execute_script(
        script="""
        return Array.from(document.querySelectorAll('.product'))
            .map(el => ({
                name: el.querySelector('.name')?.textContent,
                price: el.querySelector('.price')?.textContent,
                url: el.querySelector('a')?.href
            }))
        """
    )
    
    return product_html

async def main():
    async with Browser("ws://localhost:8765") as browser:
        # Extract products from multiple pages
        all_products = []
        
        for page in range(1, 4):
            await browser.navigate(
                url=f"https://example.com/products?page={page}"
            )
            products = await extract_products(browser)
            all_products.extend(products)
        
        # Save to file
        with open("products.json", "w") as f:
            json.dump(all_products, f, indent=2)
        
        print(f"Extracted {len(all_products)} products")

asyncio.run(main())
```

---

## Error Handling

### Exception Types

```python
from basset_hound import (
    BrowserError,           # Base error
    ConnectionError,        # WebSocket connection failed
    TimeoutError,          # Request timed out
    CommandError,          # Command execution failed
    ValidationError        # Input validation failed
)

async def main():
    async with Browser("ws://localhost:8765") as browser:
        try:
            await browser.navigate(url="https://example.com")
        except ConnectionError:
            print("Cannot connect to browser")
        except TimeoutError:
            print("Page load timeout")
        except CommandError as e:
            print(f"Command failed: {e}")
        except BrowserError as e:
            print(f"Unknown error: {e}")
```

### Retry with Exponential Backoff

```python
import asyncio
from basset_hound import BrowserError

async def execute_with_backoff(func, *args, max_retries=3, **kwargs):
    """Execute function with exponential backoff retry"""
    last_error = None
    
    for attempt in range(max_retries):
        try:
            return await func(*args, **kwargs)
        except BrowserError as e:
            last_error = e
            if attempt < max_retries - 1:
                delay = 2 ** attempt
                print(f"Attempt {attempt+1} failed, retrying in {delay}s...")
                await asyncio.sleep(delay)
            else:
                print(f"All {max_retries} attempts failed")
    
    raise last_error

# Usage
async with Browser("ws://localhost:8765") as browser:
    await execute_with_backoff(
        browser.navigate,
        url="https://unreliable-site.com"
    )
```

---

## Examples

### Complete OSINT Workflow

```python
import asyncio
from basset_hound import Browser
import json

async def gather_competitive_intelligence(competitor_url):
    """Gather detailed intelligence on competitor website"""
    
    async with Browser("ws://localhost:8765") as browser:
        # Navigate to competitor site
        await browser.navigate(url=competitor_url)
        await asyncio.sleep(2)  # Let page load
        
        # Extract basic information
        content = await browser.get_content()
        metadata = await browser.extract_metadata()
        links = await browser.extract_links()
        
        # Get technologies
        tech_result = await browser.execute_script(
            script="return window.__data || {}"
        )
        
        # Screenshots
        screenshot = await browser.screenshot()
        
        # Compile results
        intelligence = {
            "url": competitor_url,
            "title": content.get('title'),
            "description": metadata.get('description'),
            "links_count": len(links),
            "contact_links": [
                l for l in links 
                if 'contact' in l.get('text', '').lower()
            ],
            "social_links": [
                l for l in links 
                if any(x in l.get('href', '') for x in ['facebook', 'twitter', 'linkedin'])
            ]
        }
        
        return intelligence

# Run
result = asyncio.run(
    gather_competitive_intelligence("https://competitor.com")
)
print(json.dumps(result, indent=2))
```

---

## Troubleshooting

### Connection Refused

**Error**: `ConnectionError: Cannot connect to ws://localhost:8765`

**Solutions**:
1. Verify Basset Hound server is running
2. Check correct URL and port
3. Check firewall rules

### Timeout Errors

**Error**: `TimeoutError: Request timed out after 30000ms`

**Solutions**:
1. Increase timeout value
2. Check network connectivity
3. Verify target site is accessible
4. Use wait_for_element before extraction

### Element Not Found

**Error**: `CommandError: Element not found: .selector`

**Solutions**:
1. Verify selector is correct
2. Wait for element to load first
3. Check if element is inside iframe
4. Use more specific selector

---

## Related Documentation

- [API Reference](/docs/API-REFERENCE.md) - Complete command reference
- JavaScript SDK Guide
- palletai Integration

---

**Document Version**: 12.2.0  
**Last Updated**: June 1, 2026

# Basset Hound Browser - Python SDK Complete Guide

**Version**: 1.0.0
**Status**: Enterprise Ready
**Last Updated**: June 3, 2026
**Compatibility**: Python 3.8+

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Authentication](#authentication)
4. [Client Classes](#client-classes)
5. [Navigation API](#navigation-api)
6. [Content Extraction](#content-extraction)
7. [Screenshots](#screenshots)
8. [Interaction](#interaction)
9. [Storage](#storage)
10. [Sessions](#sessions)
11. [Advanced Features](#advanced-features)
12. [Error Handling](#error-handling)
13. [Examples](#examples)

---

## Installation

### Via pip

```bash
pip install basset-hound-browser
```

### From Source

```bash
git clone https://github.com/basset-hound/python-sdk.git
cd python-sdk
pip install -e .
```

### Requirements

```
aiohttp>=3.8.0
websockets>=10.0
pydantic>=1.9.0
python-dotenv>=0.20.0
```

---

## Quick Start

### 5-Minute Example

```python
import asyncio
from basset_hound import BassetHoundClient

async def main():
    # Create client
    client = BassetHoundClient(
        url='ws://localhost:8765',
        token='your-token'
    )

    # Connect
    async with client:
        # Navigate to page
        result = await client.navigate('https://example.com')
        print(f"Navigated to: {result['url']}")

        # Wait for page load
        await asyncio.sleep(3)

        # Take screenshot
        screenshot = await client.screenshot(format='png')
        print(f"Screenshot size: {screenshot['size']} bytes")

        # Extract links
        links = await client.extract_links()
        print(f"Found {len(links)} links")

        # Click element
        await client.click('a.link')

if __name__ == '__main__':
    asyncio.run(main())
```

---

## Authentication

### Bearer Token

```python
from basset_hound import BassetHoundClient

client = BassetHoundClient(
    url='ws://localhost:8765',
    token='your-bearer-token'
)
```

### API Key

```python
client = BassetHoundClient(
    url='ws://localhost:8765',
    api_key='your-api-key'
)
```

### Custom Headers

```python
client = BassetHoundClient(
    url='ws://localhost:8765',
    headers={
        'Authorization': 'Bearer your-token',
        'X-Custom-Header': 'value'
    }
)
```

---

## Client Classes

### BassetHoundClient

Main synchronous client class.

```python
from basset_hound import BassetHoundClient

client = BassetHoundClient(
    url='ws://localhost:8765',
    token='token',
    timeout=30,
    max_retries=3
)

# Connect
client.connect()

# Use client...

# Disconnect
client.disconnect()
```

### AsyncBassetHoundClient

Async client for concurrent operations.

```python
import asyncio
from basset_hound import AsyncBassetHoundClient

async def main():
    client = AsyncBassetHoundClient(
        url='ws://localhost:8765',
        token='token'
    )

    async with client:
        result = await client.navigate('https://example.com')
        print(result)

asyncio.run(main())
```

### HTTPClient

REST API client for HTTP operations.

```python
from basset_hound import HTTPClient

client = HTTPClient(
    base_url='http://localhost:8766/api/v1',
    token='token'
)

# Navigate
result = client.navigate('https://example.com')

# Get content
content = client.get_content()

# Take screenshot
screenshot = client.screenshot()
```

---

## Navigation API

### Navigate

```python
# Navigate to URL
result = await client.navigate('https://example.com')
print(result)
# Output: {'success': True, 'url': '...', 'title': '...'}

# With timeout
result = await client.navigate(
    'https://example.com',
    timeout=60000  # milliseconds
)

# Wait for specific state
result = await client.navigate(
    'https://example.com',
    wait_until='networkidle'  # 'load', 'domcontentloaded', 'networkidle'
)
```

### Get Current URL

```python
url = await client.get_url()
print(f"Current URL: {url['url']}")
```

### Get Page State

```python
state = await client.get_page_state()
print(f"Page ready: {state['dom_ready']}")
print(f"Load time: {state['page_load_time']}ms")
```

### Reload

```python
await client.reload_tab()
```

### Navigation History

```python
# Go back
await client.tab_back()

# Go forward
await client.tab_forward()
```

### Wait for Element

```python
# Wait for element to appear
element = await client.wait_for_element(
    selector='.content',
    timeout=10000,
    visible=True
)

print(f"Element found: {element}")
```

---

## Content Extraction

### Get Page Content

```python
# Get HTML
content = await client.get_content()
print(f"HTML size: {content['size']} bytes")
print(f"HTML: {content['html'][:100]}")

# With metadata
content = await client.get_content(include_metadata=True)
print(f"Title: {content['metadata']['title']}")
```

### Extract Links

```python
# Extract all links
links = await client.extract_links()
print(f"Found {len(links)} links")
for link in links[:5]:
    print(f"- {link['text']}: {link['href']}")

# With filters
links = await client.extract_links(
    include_internal=True,
    include_external=True
)
```

### Extract Images

```python
# Extract all images
images = await client.extract_images()
print(f"Found {len(images)} images")
for image in images[:3]:
    print(f"- {image['alt']}: {image['src']}")
    print(f"  Size: {image['width']}x{image['height']}")
```

### Extract Forms

```python
# Extract all forms
forms = await client.extract_forms()
print(f"Found {len(forms)} forms")
for form in forms:
    print(f"Form ID: {form['id']}")
    print(f"Action: {form['action']}")
    for field in form['fields']:
        print(f"  - {field['name']} ({field['type']})")
```

### Extract Metadata

```python
# Extract SEO metadata
metadata = await client.extract_metadata()
print(f"Title: {metadata['title']}")
print(f"Description: {metadata['description']}")
print(f"Keywords: {metadata['keywords']}")

# Social media
print(f"OG Image: {metadata['og_data']['image']}")
print(f"Twitter Card: {metadata['twitter_data']['card']}")
```

### Detect Technologies

```python
# Detect tech stack
techs = await client.detect_technologies()
print(f"Found {len(techs)} technologies")
for tech in techs:
    print(f"- {tech['name']} ({tech['category']})")
    print(f"  Version: {tech['version']}")
```

### Extract All Content

```python
# Extract everything at once
result = await client.extract_all(
    types=['text', 'links', 'images', 'forms', 'metadata']
)

print(f"Text: {result['text'][:100]}")
print(f"Links: {len(result['links'])}")
print(f"Images: {len(result['images'])}")
print(f"Forms: {len(result['forms'])}")
```

---

## Screenshots

### Basic Screenshot

```python
# Take screenshot
screenshot = await client.screenshot(format='png')
print(f"Size: {screenshot['size']} bytes")

# Save to file
with open('screenshot.png', 'wb') as f:
    import base64
    f.write(base64.b64decode(screenshot['screenshot']))
```

### Screenshot Types

```python
# Full page
screenshot = await client.screenshot_full_page()

# Viewport only
screenshot = await client.screenshot_viewport()

# Specific element
screenshot = await client.screenshot_element(selector='#main')

# Specific area
screenshot = await client.screenshot_area(
    x=100, y=100,
    width=800, height=600
)
```

### Screenshot Options

```python
# Different formats
png = await client.screenshot(format='png')      # Default
jpeg = await client.screenshot(format='jpeg', quality=85)
webp = await client.screenshot(format='webp')

# Full page vs viewport
full = await client.screenshot(full_page=True)
viewport = await client.screenshot(full_page=False)
```

### Annotate Screenshot

```python
# Add annotations
annotated = await client.annotate_screenshot(
    screenshot='base64-image',
    annotations=[
        {
            'type': 'box',
            'x': 100, 'y': 100,
            'width': 200, 'height': 200,
            'color': 'red',
            'label': 'Important'
        },
        {
            'type': 'arrow',
            'from_x': 100, 'from_y': 100,
            'to_x': 300, 'to_y': 300,
            'color': 'blue'
        }
    ]
)

print(f"Annotated: {annotated}")
```

---

## Interaction

### Click Element

```python
# Click by selector
result = await client.click('button.submit')
print(f"Clicked: {result['clicked']}")

# With options
result = await client.click(
    selector='button',
    button='left',  # 'left', 'right', 'middle'
    click_count=2   # Double click
)
```

### Fill Form Field

```python
# Fill field
result = await client.fill(
    selector='input[name="email"]',
    value='user@example.com'
)

# Without humanization
result = await client.fill(
    selector='input[name="password"]',
    value='secret',
    humanize=False
)
```

### Type Text

```python
# Type text
await client.type_text('Hello, World!')

# With delay between keys
await client.type_text(
    'Hello, World!',
    delay=100  # milliseconds between keys
)
```

### Keyboard Input

```python
# Press key
await client.key_press('Enter')
await client.key_press('Tab')
await client.key_press('Escape')

# Key combination
await client.key_combination(['Control', 'a'])  # Select all
await client.key_combination(['Control', 'c'])  # Copy
await client.key_combination(['Control', 'v'])  # Paste
```

### Mouse Actions

```python
# Mouse click
await client.mouse_click(x=500, y=300, button='left')

# Double click
await client.mouse_double_click(x=500, y=300)

# Right click
await client.mouse_right_click(x=500, y=300)

# Hover
await client.mouse_hover(selector='#menu')

# Move
await client.mouse_move(x=500, y=300)

# Drag
await client.mouse_drag(
    from_x=100, from_y=100,
    to_x=500, to_y=500
)

# Scroll
await client.mouse_scroll(selector='body', x=0, y=1000, smooth=True)
```

---

## Storage

### Cookies

```python
# Set cookie
await client.set_cookie(
    name='session_id',
    value='abc123',
    domain='.example.com',
    path='/',
    secure=True,
    http_only=True,
    same_site='Strict',
    expires_in=3600000  # 1 hour
)

# Get cookies
cookies = await client.get_cookies()
for cookie in cookies:
    print(f"{cookie['name']}={cookie['value']}")

# Get all cookies
all_cookies = await client.get_all_cookies()

# Delete cookie
await client.delete_cookie('session_id')

# Clear all cookies
await client.clear_all_cookies()

# Export cookies
filename = await client.export_cookies(format='json')
print(f"Exported to: {filename}")

# Import cookies
await client.import_cookies(path='cookies.json', merge=True)
```

### Local Storage

```python
# Set value
await client.set_local_storage('user_theme', 'dark')

# Get value
value = await client.get_local_storage('user_theme')
print(f"Theme: {value}")

# Clear
await client.clear_local_storage()
```

### Session Storage

```python
# Set value
await client.set_session_storage('temp_data', 'temporary')

# Get value
value = await client.get_session_storage('temp_data')

# Clear
await client.clear_session_storage()
```

### IndexedDB

```python
# Get data
data = await client.get_indexeddb(
    database='mydb',
    store='mystore'
)

# Delete database
await client.delete_indexeddb('mydb')
```

---

## Sessions

### Create Session

```python
# Create session
session = await client.create_session(
    name='research_session',
    isolated=True
)
print(f"Session ID: {session['session_id']}")
```

### List Sessions

```python
# List all sessions
sessions = await client.list_sessions()
for session in sessions:
    print(f"- {session['name']} ({session['session_id']})")
    print(f"  Tabs: {session['tab_count']}")
```

### Get Session Info

```python
# Get session details
info = await client.get_session_info('sess_abc123')
print(f"Created: {info['created']}")
print(f"Tabs: {info['tab_count']}")
```

### Switch Session

```python
# Switch to different session
await client.switch_session('sess_abc123')
```

### Delete Session

```python
# Delete session
await client.delete_session('sess_abc123')
```

### Checkpoints

```python
# Create checkpoint
checkpoint = await client.create_session_checkpoint('checkpoint_1')
print(f"Checkpoint ID: {checkpoint['checkpoint_id']}")

# List checkpoints
checkpoints = await client.list_checkpoints()

# Rollback to checkpoint
await client.rollback_to_checkpoint('ckpt_123')

# Delete checkpoint
await client.delete_checkpoint('ckpt_123')
```

---

## Advanced Features

### Proxy Management

```python
# Set proxy
await client.set_proxy(
    host='proxy.example.com',
    port=8080,
    type='http',  # 'http', 'socks4', 'socks5'
    auth={'username': 'user', 'password': 'pass'},
    bypass_rules=['localhost', '127.0.0.1']
)

# Get status
status = await client.get_proxy_status()
print(f"Proxy: {status['proxy']['host']}")
print(f"Exit IP: {status['exit_ip']}")

# Test proxy
result = await client.test_proxy(
    host='proxy.example.com',
    port=8080
)
print(f"Working: {result['working']}")

# Rotate proxy
await client.rotate_proxy()

# Start auto rotation
await client.start_proxy_rotation(
    proxies=[
        {'host': 'proxy1.com', 'port': 8080},
        {'host': 'proxy2.com', 'port': 8080}
    ],
    interval=300000  # 5 minutes
)

# Stop rotation
await client.stop_proxy_rotation()

# Clear proxy
await client.clear_proxy()
```

### User Agent Management

```python
# Set user agent
await client.set_user_agent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
)

# Get current
ua = await client.get_user_agent_status()
print(f"User Agent: {ua['user_agent']}")
print(f"Browser: {ua['browser']} {ua['version']}")

# Get random
random_ua = await client.get_random_user_agent(category='desktop')

# Start rotation
await client.start_user_agent_rotation(
    category='desktop',  # 'desktop', 'mobile', 'tablet'
    interval=300000
)

# Stop rotation
await client.stop_user_agent_rotation()
```

### Geolocation

```python
# Set location
await client.set_geolocation(
    latitude=40.7128,
    longitude=-74.0060,
    accuracy=100
)

# Set by city
await client.set_geolocation_city(
    city='New York',
    country='United States'
)

# Get status
status = await client.get_geolocation()

# Reset
await client.reset_geolocation()
```

### JavaScript Execution

```python
# Execute JavaScript
result = await client.execute_script(
    script='return document.title;'
)
print(f"Title: {result}")

# With arguments
result = await client.execute_script(
    script='return arguments[0] + arguments[1];',
    args=[5, 3]
)
print(f"Sum: {result}")  # 8

# Complex script
result = await client.execute_script(
    script='''
    return {
        title: document.title,
        url: window.location.href,
        links: Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.textContent,
            href: a.href
        }))
    };
    '''
)
print(result)
```

### Recording & Replay

```python
# Start recording
rec = await client.start_recording(
    name='my_recording',
    capture_screenshots=True,
    capture_network=True
)
print(f"Recording ID: {rec['recording_id']}")

# ... perform actions ...

# Stop recording
await client.stop_recording()

# Get recording status
status = await client.get_recording_status()

# List recordings
recordings = await client.list_recordings()

# Load and replay
await client.load_recording('rec_123')
await client.start_replay('rec_123', speed=1.0)
await asyncio.sleep(5)
await client.stop_replay()

# Export
filename = await client.export_recording('rec_123', format='json')
```

---

## Error Handling

### Try/Except Pattern

```python
from basset_hound import BassetHoundClient, BassetError

client = BassetHoundClient(url='ws://localhost:8765')

async with client:
    try:
        await client.navigate('https://invalid-url-!!!.com')
    except BassetError as e:
        print(f"Error: {e.message}")
        print(f"Code: {e.code}")
        print(f"Recovery: {e.recovery}")
```

### Error Classes

```python
from basset_hound.errors import (
    BassetError,
    NavigationError,
    ElementNotFoundError,
    TimeoutError,
    ProxyError,
    AuthenticationError
)

try:
    await client.click('.selector')
except ElementNotFoundError:
    print("Element not found - element may not exist")
except TimeoutError:
    print("Operation timed out")
except BassetError as e:
    print(f"Generic error: {e}")
```

### Retry Logic

```python
from basset_hound import retry, RetryConfig

@retry(RetryConfig(max_attempts=3, backoff='exponential'))
async def navigate_with_retry(client, url):
    return await client.navigate(url)

# Or manually
async def navigate_manual_retry(client, url, max_retries=3):
    for attempt in range(max_retries):
        try:
            return await client.navigate(url)
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(2 ** attempt)  # Exponential backoff
```

---

## Examples

### Example 1: Web Scraping

```python
import asyncio
from basset_hound import AsyncBassetHoundClient

async def scrape_website():
    client = AsyncBassetHoundClient(url='ws://localhost:8765', token='token')

    async with client:
        # Navigate
        await client.navigate('https://example.com')
        await asyncio.sleep(3)

        # Extract data
        metadata = await client.extract_metadata()
        links = await client.extract_links()
        images = await client.extract_images()

        # Save results
        result = {
            'title': metadata['title'],
            'description': metadata['description'],
            'links': [{'text': l['text'], 'href': l['href']} for l in links[:10]],
            'images': [{'src': i['src'], 'alt': i['alt']} for i in images[:5]]
        }

        import json
        with open('scraped.json', 'w') as f:
            json.dump(result, f, indent=2)

asyncio.run(scrape_website())
```

### Example 2: Automated Testing

```python
import asyncio
from basset_hound import AsyncBassetHoundClient

async def test_login_flow():
    client = AsyncBassetHoundClient(url='ws://localhost:8765')

    async with client:
        # Navigate to login page
        await client.navigate('https://example.com/login')
        assert await client.wait_for_element('#login-form')

        # Fill form
        await client.fill('input[name="email"]', 'test@example.com')
        await client.fill('input[name="password"]', 'password')

        # Submit
        await client.click('button[type="submit"]')
        await asyncio.sleep(2)

        # Verify
        url = await client.get_url()
        assert 'dashboard' in url['url'], "Should redirect to dashboard"

        print("✓ Login test passed")

asyncio.run(test_login_flow())
```

### Example 3: Screenshot Collection

```python
import asyncio
from basset_hound import AsyncBassetHoundClient
import base64

async def collect_screenshots():
    client = AsyncBassetHoundClient(url='ws://localhost:8765')
    urls = [
        'https://example.com',
        'https://example.com/about',
        'https://example.com/contact'
    ]

    async with client:
        for i, url in enumerate(urls):
            await client.navigate(url)
            await asyncio.sleep(3)

            screenshot = await client.screenshot()
            filename = f'screenshot_{i}.png'

            with open(filename, 'wb') as f:
                f.write(base64.b64decode(screenshot['screenshot']))

            print(f"✓ Saved {filename}")

asyncio.run(collect_screenshots())
```

---

## API Reference Summary

### Navigation
- `navigate(url, timeout, wait_until)`
- `get_url()`
- `get_page_state()`
- `reload_tab()`
- `tab_back()` / `tab_forward()`
- `wait_for_element(selector, timeout, visible)`

### Content
- `get_content(include_metadata)`
- `extract_links(include_internal, include_external)`
- `extract_images(include_data_url)`
- `extract_forms()`
- `extract_metadata()`
- `extract_all(types)`
- `detect_technologies()`

### Screenshots
- `screenshot(format, quality, full_page)`
- `screenshot_full_page()`
- `screenshot_viewport()`
- `screenshot_element(selector)`
- `screenshot_area(x, y, width, height)`
- `annotate_screenshot(screenshot, annotations)`

### Interaction
- `click(selector, button, click_count)`
- `fill(selector, value, humanize)`
- `type_text(text, delay)`
- `key_press(key)`
- `key_combination(keys)`
- `mouse_click(x, y, button)`
- `mouse_hover(selector)`
- `mouse_drag(from_x, from_y, to_x, to_y)`

### Storage
- `set_cookie()` / `get_cookies()` / `delete_cookie()` / `clear_all_cookies()`
- `set_local_storage()` / `get_local_storage()` / `clear_local_storage()`
- `set_session_storage()` / `get_session_storage()` / `clear_session_storage()`

### Sessions
- `create_session()` / `list_sessions()` / `delete_session()`
- `create_session_checkpoint()` / `rollback_to_checkpoint()`
- `export_session()` / `import_session()`

### Advanced
- `set_proxy()` / `get_proxy_status()` / `rotate_proxy()`
- `set_user_agent()` / `start_user_agent_rotation()`
- `set_geolocation()` / `reset_geolocation()`
- `execute_script(script, args)`
- `start_recording()` / `stop_recording()` / `start_replay()`


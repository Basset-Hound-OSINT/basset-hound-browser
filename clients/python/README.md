# Basset Hound Browser Python Client

A Python client library for controlling the Basset Hound Browser via WebSocket.

## Installation

```bash
pip install basset-hound-client
```

Or install from source:

```bash
cd clients/python
pip install -e .
```

## Quick Start

```python
from basset_hound import BassetHoundClient

# Connect to the browser
with BassetHoundClient() as client:
    # Navigate to a page
    client.navigate("https://example.com")

    # Get page info
    print(f"Title: {client.get_title()}")
    print(f"URL: {client.get_url()}")

    # Take a screenshot
    client.save_screenshot("screenshot.png")
```

## Configuration

```python
client = BassetHoundClient(
    host="localhost",           # WebSocket host
    port=8765,                  # WebSocket port
    connection_timeout=10.0,    # Connection timeout in seconds
    command_timeout=30.0,       # Default command timeout
    auto_reconnect=False        # Auto-reconnect on disconnect
)
```

## API Reference

### Navigation

```python
# Navigate to URL
client.navigate("https://example.com")
client.navigate("https://example.com", wait_until="networkidle")

# Navigation history
client.go_back()
client.go_forward()
client.reload()
client.reload(ignore_cache=True)

# Get page info
url = client.get_url()
title = client.get_title()
```

### Content Extraction

```python
# Extract page metadata
metadata = client.extract_metadata()

# Extract links
links = client.extract_links()
links = client.extract_links(include_external=False)

# Extract forms
forms = client.extract_forms()

# Extract images
images = client.extract_images()
images = client.extract_images(include_lazy=True)

# Extract scripts
scripts = client.extract_scripts()

# Extract structured data (JSON-LD, microdata)
structured = client.extract_structured_data()

# Extract everything at once
all_data = client.extract_all()
```

### Technology Detection

```python
# Detect technologies on current page
techs = client.detect_technologies()

# Get available categories
categories = client.get_technology_categories()

# Get info about a specific technology
info = client.get_technology_info("React")

# Search technologies
results = client.search_technologies("javascript framework")
```

### Network Analysis

```python
# Start capturing network traffic
client.start_network_capture()
client.start_network_capture(filter_types=["xhr", "fetch"])

# Navigate and capture requests
client.navigate("https://example.com")

# Get captured requests
requests = client.get_network_requests()
requests = client.get_network_requests(filter_type="xhr")
requests = client.get_network_requests(filter_domain="api.example.com")

# Get statistics
stats = client.get_network_statistics()

# Export captured data
har_data = client.export_network_capture(format="har")

# Stop and clear
client.stop_network_capture()
client.clear_network_capture()
```

### Screenshots

```python
# Take screenshot (returns base64)
screenshot = client.screenshot()
screenshot = client.screenshot(full_page=True)
screenshot = client.screenshot(format="jpeg", quality=90)

# Save to file
client.save_screenshot("page.png")
client.save_screenshot("page.png", full_page=True)
```

### Cookies

```python
# Get cookies
cookies = client.get_cookies()
cookies = client.get_cookies(url="https://example.com")

# Set cookie
client.set_cookie(
    name="session",
    value="abc123",
    domain="example.com",
    secure=True,
    http_only=True
)

# Delete cookies
client.delete_cookies()
client.delete_cookies(url="https://example.com")
client.delete_cookies(name="session")
```

### Tab Management

```python
# Get all tabs
tabs = client.get_tabs()

# Open new tab
client.new_tab()
client.new_tab(url="https://example.com")

# Switch tab
client.switch_tab(tab_id="tab-123")

# Close tab
client.close_tab()
client.close_tab(tab_id="tab-123")
```

### Input Simulation

```python
# Click element
client.click("#submit-button")

# Type text
client.type_text("#search-input", "search query")
client.type_text("#search-input", "search query", delay=100)

# Scroll
client.scroll(y=500)
client.scroll(x=100, y=200)
client.scroll(y=300, selector="#scrollable-div")
```

### JavaScript Execution

```python
# Execute script
result = client.execute_script("return document.title")
result = client.execute_script("document.querySelector('#btn').click()")
```

### Proxy Configuration

```python
# Set proxy
client.set_proxy(host="proxy.example.com", port=8080)
client.set_proxy(
    host="proxy.example.com",
    port=8080,
    protocol="socks5",
    username="user",
    password="pass"
)

# Clear proxy
client.clear_proxy()
```

### Fingerprint / Evasion

```python
# Set user agent
client.set_user_agent("Mozilla/5.0 ...")

# Set viewport
client.set_viewport(width=1920, height=1080)

# Get current fingerprint
fingerprint = client.get_fingerprint()

# Randomize fingerprint
client.randomize_fingerprint()
```

## Error Handling

```python
from basset_hound import (
    BassetHoundClient,
    ConnectionError,
    CommandError,
    TimeoutError
)

try:
    with BassetHoundClient() as client:
        client.navigate("https://example.com")
except ConnectionError as e:
    print(f"Failed to connect: {e}")
except CommandError as e:
    print(f"Command failed: {e}")
    print(f"Details: {e.details}")
except TimeoutError as e:
    print(f"Command timed out after {e.timeout}s")
```

## Custom Command Timeout

```python
# Set timeout for specific command
result = client.send_command(
    "navigate",
    {"url": "https://slow-site.com"},
    timeout=60.0
)
```

## License

MIT License

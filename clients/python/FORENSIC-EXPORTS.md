# Basset Hound Browser - Python Forensic Export Client

## Overview

The Basset Hound Browser Python client provides comprehensive forensic export and DOM manipulation capabilities for automated browser control, data extraction, and forensic analysis.

**Version**: 1.2.0  
**API Version**: 12.1.0+  
**Status**: Production Ready

## Key Features

### Forensic Exports
- **Raw HTML Export**: Capture complete HTML with response headers and metadata
- **Network Log Export**: Capture all HTTP requests/responses with timing and resource types
- **Device Fingerprints**: Export browser fingerprints, identifiers, and hardware info

### DOM Manipulation
- **Element Modification**: Set content, attributes, classes, and styles
- **Form Interaction**: Fill inputs and click elements with human-like timing
- **Element Waiting**: Wait for dynamic content with configurable timeouts

### Full Browser Control
- Navigation, screenshots, cookie management
- Network analysis, technology detection
- Proxy support, user agent rotation
- JavaScript execution

## Installation

### Basic Installation

```bash
pip install basset-hound-client
```

### From Source

```bash
cd clients/python
pip install -e .
```

### Development Installation

```bash
pip install -e ".[dev]"
```

## Quick Start

### Basic Usage

```python
from basset_hound import BassetHoundClientWithForensics

# Connect and export forensic data
with BassetHoundClientWithForensics() as client:
    # Navigate to target
    client.navigate("https://example.com")
    
    # Export raw HTML and headers
    html_data = client.export_raw_html()
    print(f"Status: {html_data['statusCode']}")
    print(f"HTML Size: {len(html_data['html'])} bytes")
    
    # Capture network traffic
    network = client.export_network_log()
    print(f"Requests: {len(network['requests'])}")
    
    # Get device fingerprints
    device = client.export_device_ids()
    print(f"User Agent: {device['userAgent']}")
```

### Form Interaction Example

```python
with BassetHoundClientWithForensics() as client:
    client.navigate("https://example.com/login")
    
    # Wait for form to load
    client.wait_for_selector('input[name="username"]', timeout=5000)
    
    # Fill form fields
    client.fill_input('input[name="username"]', 'john_doe')
    client.fill_input('input[name="password"]', 'secure_password')
    
    # Click submit
    client.click_element('button[type="submit"]')
    
    # Wait for redirect
    client.wait_for_selector('.dashboard', timeout=10000)
```

## Client Classes

### BassetHoundClient (Base)
Core browser automation client with navigation, screenshots, and basic interactions.

```python
with BassetHoundClient() as client:
    client.navigate("https://example.com")
    title = client.get_title()
    screenshot = client.screenshot(full_page=True)
```

### BassetHoundClientWithForensics
Adds forensic export methods: `export_raw_html()`, `export_network_log()`, `export_device_ids()`, plus DOM manipulation.

```python
with BassetHoundClientWithForensics() as client:
    client.navigate("https://example.com")
    html = client.export_raw_html()
    network = client.export_network_log()
```

### BassetHoundClientWithIngestion
Adds data ingestion capabilities for OSINT data detection and analysis.

```python
with BassetHoundClientWithIngestion() as client:
    client.navigate("https://example.com")
    detections = client.detect_data_types()
    client.ingest_all()
```

### BassetHoundClientFull
Complete client with all features: forensics, ingestion, and base browser control.

```python
with BassetHoundClientFull() as client:
    client.navigate("https://example.com")
    html = client.export_raw_html()
    network = client.export_network_log()
    detections = client.detect_data_types()
```

## Forensic Export Methods

### export_raw_html(url=None, timeout=None)

Export raw HTML and response headers from a page.

**Parameters:**
- `url` (str, optional): URL to navigate to before exporting
- `timeout` (float, optional): Command timeout in seconds

**Returns:**
```python
{
    'html': '<html>...</html>',           # Raw HTML content
    'headers': {...},                      # Response headers
    'statusCode': 200,                     # HTTP status code
    'mimeType': 'text/html',              # Content MIME type
    'url': 'https://example.com'          # Final URL
}
```

**Example:**
```python
result = client.export_raw_html()
html_content = result['html']
status = result['statusCode']
headers = result['headers']

# Or navigate to specific URL
result = client.export_raw_html(url='https://api.example.com/data')
```

### export_network_log(timeout=None)

Export all captured HTTP requests and responses.

**Parameters:**
- `timeout` (float, optional): Command timeout in seconds

**Returns:**
```python
{
    'requests': [
        {
            'url': 'https://example.com',
            'method': 'GET',
            'headers': {...},
            'statusCode': 200,
            'responseHeaders': {...},
            'responseTime': 250,           # Time in ms
            'resourceType': 'document'     # or xhr, fetch, stylesheet, etc.
        },
        ...
    ],
    'statistics': {
        'totalRequests': 42,
        'totalSize': 1024000,
        'totalTime': 2500
    }
}
```

**Example:**
```python
network = client.export_network_log()

# Analyze requests
for req in network['requests']:
    if req['statusCode'] >= 400:
        print(f"Failed: {req['method']} {req['url']} - {req['statusCode']}")

# Check specific resource types
xhr_requests = [r for r in network['requests'] if r['resourceType'] == 'xhr']
print(f"XHR requests: {len(xhr_requests)}")
```

### export_device_ids(timeout=None)

Export device fingerprints and identifiers.

**Parameters:**
- `timeout` (float, optional): Command timeout in seconds

**Returns:**
```python
{
    'userAgent': 'Mozilla/5.0 ...',
    'platform': 'Linux',
    'viewport': {
        'width': 1920,
        'height': 1080
    },
    'fingerprints': {
        'canvas': 'a1b2c3d4e5f6...',     # Canvas fingerprint hash
        'webgl': 'f6e5d4c3b2a1...',      # WebGL fingerprint hash
        'fonts': ['Arial', 'Verdana', ...],
        'plugins': [...]
    },
    'hardwareInfo': {
        'cores': 8,
        'memory': 16000,
        'deviceType': 'desktop'
    },
    'identifiers': [...]
}
```

**Example:**
```python
device = client.export_device_ids()

print(f"User Agent: {device['userAgent']}")
print(f"Viewport: {device['viewport']['width']}x{device['viewport']['height']}")
print(f"Canvas FP: {device['fingerprints']['canvas']}")

# Check device characteristics
if device['hardwareInfo']['cores'] > 4:
    print("Multi-core system detected")
```

## DOM Manipulation Methods

### modify_element(selector, action, value=None, timeout=None)

Modify DOM elements with various actions.

**Parameters:**
- `selector` (str): CSS selector for target element
- `action` (str): Action to perform:
  - `setContent`: Set innerHTML
  - `setText`: Set textContent
  - `setAttribute`: Set attribute
  - `removeAttribute`: Remove attribute
  - `addClass`: Add CSS class
  - `removeClass`: Remove CSS class
  - `toggleClass`: Toggle CSS class
  - `setStyle`: Set inline style
- `value` (str, optional): Parameter for the action
- `timeout` (float, optional): Command timeout in seconds

**Returns:**
```python
{
    'success': True,
    'elementTag': 'div',
    'previousValue': 'Old Content',
    'newValue': 'New Content'
}
```

**Example:**
```python
# Set element text
client.modify_element('#title', 'setText', 'New Title')

# Add CSS class
client.modify_element('.card', 'addClass', 'highlight')

# Set attribute
client.modify_element('img#logo', 'setAttribute', 'alt=Company Logo')

# Set inline style
client.modify_element('.box', 'setStyle', 'background-color:blue')

# Remove class
client.modify_element('.button', 'removeClass', 'disabled')
```

### click_element(selector, timeout=None)

Click an element on the page.

**Parameters:**
- `selector` (str): CSS selector for element to click
- `timeout` (float, optional): Command timeout in seconds

**Returns:**
```python
{
    'success': True,
    'elementTag': 'button',
    'elementText': 'Submit'
}
```

**Example:**
```python
# Click a button
client.click_element('button#submit')

# Click a link
client.click_element('a[href="/about"]')

# Click an element with class
client.click_element('.hamburger-menu')
```

### fill_input(selector, text, timeout=None, delay=50)

Fill an input field with text.

**Parameters:**
- `selector` (str): CSS selector for input element
- `text` (str): Text to fill
- `timeout` (float, optional): Command timeout in seconds
- `delay` (int): Delay between keystrokes in milliseconds (default: 50)

**Returns:**
```python
{
    'success': True,
    'elementTag': 'input',
    'inputValue': 'filled text',
    'textLength': 11
}
```

**Example:**
```python
# Fill username field
client.fill_input('input#username', 'john_doe')

# Fill email with slower typing (to avoid detection)
client.fill_input('input[name="email"]', 'user@example.com', delay=100)

# Fill search box
client.fill_input('.search-box', 'query text')
```

### wait_for_selector(selector, timeout=10000)

Wait for an element to appear in the DOM.

**Parameters:**
- `selector` (str): CSS selector for element to wait for
- `timeout` (int): Maximum wait time in milliseconds (default: 10000)

**Returns:**
```python
{
    'success': True,
    'elementTag': 'div',
    'waitTime': 1250
}
```

**Example:**
```python
# Wait for content to load (10 seconds)
client.wait_for_selector('.content', timeout=10000)

# Wait for modal with shorter timeout
client.wait_for_selector('.modal', timeout=3000)

# Wait for dynamically loaded table
client.wait_for_selector('table tbody tr', timeout=5000)

# Chain waits for multi-step loading
client.wait_for_selector('.spinner', timeout=2000)  # Wait for loader
client.wait_for_selector('.content', timeout=10000)  # Wait for content
```

## Error Handling

### Exception Types

```python
from basset_hound import (
    BassetHoundError,          # Base exception
    ConnectionError,           # Connection failed
    CommandError,              # Command execution failed
    TimeoutError,              # Command timeout
    AuthenticationError        # Authentication failed
)
```

### Error Handling Example

```python
from basset_hound import BassetHoundClientWithForensics, TimeoutError, CommandError

with BassetHoundClientWithForensics(
    host="localhost",
    port=8765,
    command_timeout=30.0
) as client:
    try:
        client.navigate("https://example.com")
        html = client.export_raw_html()
    
    except TimeoutError as e:
        print(f"Command timed out after {e.timeout}s")
        # Implement retry logic or fallback
    
    except CommandError as e:
        print(f"Command failed: {e.command}")
        print(f"Details: {e.details}")
        # Handle specific command failure
    
    except ConnectionError as e:
        print(f"Connection failed: {e}")
        # Implement connection recovery
```

## Advanced Usage

### Multiple Sessions

```python
from basset_hound import BassetHoundClientWithForensics

# Create multiple isolated browser sessions
session1 = BassetHoundClientWithForensics()
session1.connect()

session2 = BassetHoundClientWithForensics()
session2.connect()

try:
    # Use separate sessions concurrently
    session1.navigate("https://site1.com")
    session2.navigate("https://site2.com")
    
    data1 = session1.export_raw_html()
    data2 = session2.export_raw_html()
finally:
    session1.disconnect()
    session2.disconnect()
```

### Network Analysis Workflow

```python
from basset_hound import BassetHoundClientWithForensics
import json

with BassetHoundClientWithForensics() as client:
    client.navigate("https://example.com")
    
    # Capture network traffic
    network = client.export_network_log()
    
    # Analyze by resource type
    by_type = {}
    for req in network['requests']:
        rtype = req['resourceType']
        if rtype not in by_type:
            by_type[rtype] = []
        by_type[rtype].append(req)
    
    # Find slow requests
    slow_requests = [r for r in network['requests'] if r['responseTime'] > 1000]
    print(f"Slow requests (>1s): {len(slow_requests)}")
    
    # Check for failed requests
    failed = [r for r in network['requests'] if r['statusCode'] >= 400]
    print(f"Failed requests: {len(failed)}")
    
    # Export for analysis
    with open('network_analysis.json', 'w') as f:
        json.dump(network, f, indent=2)
```

### Forensic Analysis Workflow

```python
from basset_hound import BassetHoundClientFull
import json
from datetime import datetime

with BassetHoundClientFull() as client:
    # Create forensic report
    report = {
        'timestamp': datetime.now().isoformat(),
        'target': 'https://example.com',
        'data': {}
    }
    
    client.navigate(report['target'])
    
    # Collect all forensic data
    report['data']['html'] = client.export_raw_html()
    report['data']['network'] = client.export_network_log()
    report['data']['device'] = client.export_device_ids()
    report['data']['technologies'] = client.detect_technologies()
    report['data']['content'] = client.extract_all()
    
    # Save comprehensive report
    with open('forensic_report.json', 'w') as f:
        json.dump(report, f, indent=2)
```

## Configuration

### Connection Options

```python
client = BassetHoundClientWithForensics(
    host="localhost",           # WebSocket server host
    port=8765,                  # WebSocket server port
    connection_timeout=10.0,    # Connection timeout (seconds)
    command_timeout=30.0,       # Default command timeout (seconds)
    auto_reconnect=False        # Auto-reconnect on disconnect
)
```

### Per-Command Timeout

```python
# Override default timeout for specific command
html = client.export_raw_html(timeout=60.0)  # 60 second timeout
network = client.export_network_log(timeout=45.0)  # 45 second timeout
```

## Logging

### Enable Debug Logging

```python
import logging

# Configure logging to see all messages
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Now all client operations will be logged
with BassetHoundClientWithForensics() as client:
    client.navigate("https://example.com")
    result = client.export_raw_html()
```

### Custom Logger

```python
import logging
from basset_hound import BassetHoundClientWithForensics

# Create custom logger
logger = logging.getLogger('my_app.forensics')
logger.setLevel(logging.DEBUG)

handler = logging.FileHandler('forensics.log')
handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(handler)

# Use client
with BassetHoundClientWithForensics() as client:
    client.navigate("https://example.com")
    logger.info("Starting forensic export")
    html = client.export_raw_html()
    logger.info(f"Exported {len(html['html'])} bytes of HTML")
```

## Performance Tips

1. **Reuse Connections**: Keep client connected for multiple commands
   ```python
   with BassetHoundClientWithForensics() as client:
       client.navigate("https://site1.com")
       data1 = client.export_raw_html()
       
       client.navigate("https://site2.com")
       data2 = client.export_raw_html()
   ```

2. **Set Appropriate Timeouts**: Use reasonable timeouts to avoid hanging
   ```python
   client = BassetHoundClientWithForensics(command_timeout=30.0)
   ```

3. **Wait for Content**: Use `wait_for_selector()` before exporting dynamic pages
   ```python
   client.navigate("https://example.com")
   client.wait_for_selector('.main-content', timeout=5000)
   html = client.export_raw_html()
   ```

4. **Handle Large Exports**: Large HTML or network logs may take time
   ```python
   html = client.export_raw_html(timeout=60.0)
   ```

## Requirements

- **Python**: 3.8+
- **websocket-client**: >=1.0.0
- **Basset Hound Browser**: Running on localhost:8765 (default)

## See Also

- [API Reference](../docs/API-REFERENCE.md)
- [Examples](./examples.py)
- [WebSocket Protocol](../docs/API-REFERENCE.md#message-format)

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/basset-hound/browser/issues
- Documentation: https://github.com/basset-hound/browser/tree/main/clients/python

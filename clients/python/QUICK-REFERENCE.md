# Basset Hound Browser Python Client - Quick Reference

## Installation

```bash
pip install basset-hound-client
```

## Import

```python
from basset_hound import BassetHoundClientWithForensics
```

## Basic Usage

```python
with BassetHoundClientWithForensics() as client:
    client.navigate("https://example.com")
    # Use methods below
```

## Forensic Exports

### Export Raw HTML & Headers
```python
result = client.export_raw_html()
html = result['html']
headers = result['headers']
status = result['statusCode']
```

### Export Network Log
```python
network = client.export_network_log()
for request in network['requests']:
    print(f"{request['method']} {request['url']} - {request['statusCode']}")
```

### Export Device IDs & Fingerprints
```python
device = client.export_device_ids()
user_agent = device['userAgent']
canvas_fp = device['fingerprints']['canvas']
viewport = device['viewport']
```

## DOM Manipulation

### Click Element
```python
client.click_element('button#submit')
client.click_element('a[href="/about"]')
```

### Fill Input Field
```python
client.fill_input('input#username', 'john_doe')
client.fill_input('input#password', 'secret', delay=75)  # Slower typing
```

### Modify Element
```python
client.modify_element('#title', 'setText', 'New Title')
client.modify_element('.card', 'addClass', 'highlight')
client.modify_element('img', 'setAttribute', 'alt=Image')
client.modify_element('.box', 'setStyle', 'background-color:red')
```

### Wait for Element
```python
client.wait_for_selector('.content', timeout=5000)  # Wait 5 seconds
```

## Common Patterns

### Form Submission
```python
with BassetHoundClientWithForensics() as client:
    client.navigate("https://example.com/login")
    client.wait_for_selector('input[name="username"]')
    client.fill_input('input[name="username"]', 'user')
    client.fill_input('input[name="password"]', 'pass')
    client.click_element('button[type="submit"]')
    client.wait_for_selector('.dashboard')
```

### Network Analysis
```python
network = client.export_network_log()
xhr_requests = [r for r in network['requests'] if r['resourceType'] == 'xhr']
failed = [r for r in network['requests'] if r['statusCode'] >= 400]
slow = [r for r in network['requests'] if r['responseTime'] > 1000]
```

### Device Fingerprinting
```python
device = client.export_device_ids()
print(f"Browser: {device['userAgent']}")
print(f"Cores: {device['hardwareInfo']['cores']}")
print(f"Viewport: {device['viewport']['width']}x{device['viewport']['height']}")
print(f"Canvas: {device['fingerprints']['canvas']}")
```

## Error Handling

```python
from basset_hound import TimeoutError, CommandError, ConnectionError

try:
    result = client.export_raw_html()
except TimeoutError as e:
    print(f"Timeout after {e.timeout}s")
except CommandError as e:
    print(f"Command failed: {e}")
except ConnectionError as e:
    print(f"Connection failed: {e}")
```

## Configuration

```python
client = BassetHoundClientWithForensics(
    host="localhost",
    port=8765,
    connection_timeout=10.0,
    command_timeout=30.0
)
```

## Methods Summary

| Method | Purpose | Example |
|--------|---------|---------|
| `export_raw_html()` | Get HTML + headers | `html = client.export_raw_html()` |
| `export_network_log()` | Get HTTP requests | `network = client.export_network_log()` |
| `export_device_ids()` | Get fingerprints | `device = client.export_device_ids()` |
| `click_element(selector)` | Click element | `client.click_element('button')` |
| `fill_input(selector, text)` | Fill input | `client.fill_input('input', 'text')` |
| `modify_element(selector, action, value)` | Modify DOM | `client.modify_element('#id', 'setText', 'text')` |
| `wait_for_selector(selector, timeout)` | Wait for element | `client.wait_for_selector('.class', 5000)` |

## Modify Element Actions

- `setText` - Set text content
- `setContent` - Set HTML content
- `setAttribute` - Set attribute
- `removeAttribute` - Remove attribute
- `addClass` - Add CSS class
- `removeClass` - Remove CSS class
- `toggleClass` - Toggle CSS class
- `setStyle` - Set inline style

## Return Value Structures

### export_raw_html()
```python
{
    'html': '<html>...</html>',
    'headers': {'Content-Type': 'text/html', ...},
    'statusCode': 200,
    'mimeType': 'text/html',
    'url': 'https://example.com'
}
```

### export_network_log()
```python
{
    'requests': [
        {
            'url': 'https://...',
            'method': 'GET',
            'statusCode': 200,
            'resourceType': 'document',
            'responseTime': 250
        },
        ...
    ],
    'statistics': {'totalRequests': 42, ...}
}
```

### export_device_ids()
```python
{
    'userAgent': 'Mozilla/5.0 ...',
    'platform': 'Linux',
    'viewport': {'width': 1920, 'height': 1080},
    'fingerprints': {
        'canvas': 'hash...',
        'webgl': 'hash...'
    },
    'hardwareInfo': {'cores': 8, 'memory': 16000},
    'identifiers': ['id1', 'id2', ...]
}
```

## Client Classes

| Class | Features |
|-------|----------|
| `BassetHoundClient` | Base navigation & screenshots |
| `BassetHoundClientWithForensics` | + Forensic exports + DOM |
| `BassetHoundClientWithIngestion` | + Data ingestion |
| `BassetHoundClientFull` | All features |

## Logging

```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Now all operations will be logged
```

## Links

- **Documentation**: See `FORENSIC-EXPORTS.md`
- **Examples**: See `examples.py`
- **Tests**: See `test_forensic_exports.py`
- **Dependencies**: See `DEPENDENCIES.md`

## Version

- **Client**: 1.2.0
- **API**: 12.1.0+
- **Python**: 3.8+

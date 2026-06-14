# Basset Hound Browser Python SDK - API Reference

**Version:** 1.1.0  
**Updated:** June 14, 2026

## Table of Contents

1. [Core Classes](#core-classes)
2. [Navigation API](#navigation-api)
3. [Interaction API](#interaction-api)
4. [Content Extraction](#content-extraction)
5. [Screenshots](#screenshots)
6. [Cookies & Storage](#cookies--storage)
7. [Sessions](#sessions)
8. [Batch Operations](#batch-operations)
9. [Connection Pooling](#connection-pooling)
10. [Streaming](#streaming)
11. [Error Handling](#error-handling)
12. [Data Structures](#data-structures)

---

## Core Classes

### BrowserClient

Main client for Basset Hound Browser automation.

```python
class BrowserClient:
    def __init__(
        self,
        ws_url: str = "ws://localhost:8765",
        timeout: float = 30.0,
        auto_reconnect: bool = True,
        reconnect_delay: float = 1.0,
        max_retries: int = 3,
        log_level: int = logging.INFO
    ) -> None:
```

**Parameters:**
- `ws_url` (str): WebSocket server URL. Default: `ws://localhost:8765`
- `timeout` (float): Request timeout in seconds. Default: 30.0
- `auto_reconnect` (bool): Automatically reconnect on disconnect. Default: True
- `reconnect_delay` (float): Delay between reconnects in seconds. Default: 1.0
- `max_retries` (int): Maximum retries for failed commands. Default: 3
- `log_level` (int): Logging verbosity level. Default: logging.INFO

**Methods:**

#### `connect() -> bool`
Establish WebSocket connection to browser server.
- **Returns:** True if connection successful
- **Raises:** TimeoutError, ConnectionError

#### `disconnect() -> bool`
Close WebSocket connection.
- **Returns:** True if disconnected successfully

#### `async with BrowserClient(...) as client:`
Context manager for automatic connection and cleanup.

---

## Navigation API

### navigate(url: str, wait_until: str = 'load') -> CommandResponse
Navigate to a URL.

**Parameters:**
- `url` (str): Target URL
- `wait_until` (str): Wait condition: 'load', 'domcontentloaded', 'networkidle'. Default: 'load'

**Returns:** CommandResponse with navigation result

**Example:**
```python
await client.navigate('https://example.com', wait_until='networkidle')
```

---

### get_url() -> str
Get the current page URL.

**Returns:** Current URL string

**Example:**
```python
url = await client.get_url()
print(f"Current URL: {url}")
```

---

### back(wait_until: str = 'load') -> CommandResponse
Navigate back in browser history.

**Parameters:**
- `wait_until` (str): Wait condition. Default: 'load'

**Returns:** CommandResponse

---

### forward(wait_until: str = 'load') -> CommandResponse
Navigate forward in browser history.

**Parameters:**
- `wait_until` (str): Wait condition. Default: 'load'

**Returns:** CommandResponse

---

### refresh(hard: bool = False, wait_until: str = 'load') -> CommandResponse
Refresh the current page.

**Parameters:**
- `hard` (bool): Hard refresh (bypass cache). Default: False
- `wait_until` (str): Wait condition. Default: 'load'

**Returns:** CommandResponse

---

### goto(url: str, referer: Optional[str] = None) -> CommandResponse
Navigate to URL with optional referer.

**Parameters:**
- `url` (str): Target URL
- `referer` (Optional[str]): HTTP referer header

**Returns:** CommandResponse

---

## Interaction API

### click(selector: str, x: int = 0, y: int = 0) -> CommandResponse
Click an element.

**Parameters:**
- `selector` (str): CSS selector
- `x` (int): X offset from element. Default: 0
- `y` (int): Y offset from element. Default: 0

**Returns:** CommandResponse

**Example:**
```python
await client.click('button.submit')
await client.click('a.link', x=10, y=10)
```

---

### fill(selector: str, text: str) -> CommandResponse
Fill form field with text.

**Parameters:**
- `selector` (str): CSS selector
- `text` (str): Text to fill

**Returns:** CommandResponse

**Example:**
```python
await client.fill('input[name="email"]', 'user@example.com')
```

---

### type(selector: str, text: str, delay: int = 0) -> CommandResponse
Type text character by character.

**Parameters:**
- `selector` (str): CSS selector
- `text` (str): Text to type
- `delay` (int): Delay between characters in ms. Default: 0

**Returns:** CommandResponse

---

### scroll(x: int, y: int) -> CommandResponse
Scroll page to coordinates.

**Parameters:**
- `x` (int): X coordinate
- `y` (int): Y coordinate

**Returns:** CommandResponse

---

### hover(selector: str) -> CommandResponse
Hover over element.

**Parameters:**
- `selector` (str): CSS selector

**Returns:** CommandResponse

---

### select(selector: str, value: str) -> CommandResponse
Select dropdown option.

**Parameters:**
- `selector` (str): CSS selector
- `value` (str): Option value

**Returns:** CommandResponse

---

### wait(ms: int) -> CommandResponse
Wait for specified milliseconds.

**Parameters:**
- `ms` (int): Milliseconds to wait

**Returns:** CommandResponse

---

### wait_for_navigation(timeout: int = 30000) -> CommandResponse
Wait for page navigation to complete.

**Parameters:**
- `timeout` (int): Timeout in milliseconds. Default: 30000

**Returns:** CommandResponse

---

## Content Extraction

### get_content() -> Dict[str, Any]
Get complete page HTML content.

**Returns:** Dict with 'html' key containing HTML string

**Example:**
```python
content = await client.get_content()
html = content['html']
```

---

### get_text() -> Dict[str, Any]
Get page text content.

**Returns:** Dict with 'text' key

---

### extract_links() -> Dict[str, List[Dict]]
Extract all links from page.

**Returns:** Dict with 'links' key containing list of link objects
- `url` (str): Link href
- `text` (str): Link text
- `title` (str): Link title attribute

**Example:**
```python
result = await client.extract_links()
for link in result['links']:
    print(f"{link['text']} -> {link['url']}")
```

---

### extract_metadata() -> Dict[str, Any]
Extract page metadata (title, description, etc).

**Returns:** Dict with metadata fields

---

### detect_technology() -> Dict[str, List[Dict]]
Detect technologies used on page.

**Returns:** Dict with 'technologies' list
- `name` (str): Technology name
- `version` (Optional[str]): Detected version
- `category` (str): Technology category

**Example:**
```python
result = await client.detect_technology()
for tech in result['technologies']:
    print(f"{tech['name']} {tech.get('version', '')}")
```

---

### find_elements(selector: str) -> Dict[str, List[Dict]]
Find DOM elements matching selector.

**Parameters:**
- `selector` (str): CSS selector

**Returns:** Dict with 'elements' list containing element info

---

### get_element_text(selector: str) -> Dict[str, str]
Get text content of element.

**Parameters:**
- `selector` (str): CSS selector

**Returns:** Dict with 'text' key

---

## Screenshots

### screenshot(full_page: bool = False) -> Dict[str, Any]
Capture page screenshot.

**Parameters:**
- `full_page` (bool): Capture full page. Default: False

**Returns:** Dict with:
- `filename` (str): Screenshot file path
- `data` (str): Base64 encoded image (optional)
- `width` (int): Image width
- `height` (int): Image height

**Example:**
```python
screenshot = await client.screenshot()
print(f"Saved to {screenshot['filename']}")
```

---

### screenshot_element(selector: str) -> Dict[str, Any]
Capture element screenshot.

**Parameters:**
- `selector` (str): CSS selector

**Returns:** Screenshot dict

---

### capture_pdf(filename: Optional[str] = None) -> Dict[str, Any]
Capture page as PDF.

**Parameters:**
- `filename` (Optional[str]): Output filename

**Returns:** Dict with 'filename' key

---

## Cookies & Storage

### get_cookies() -> Dict[str, List[Dict]]
Get all cookies.

**Returns:** Dict with 'cookies' list

---

### set_cookies(cookies: List[Dict[str, Any]]) -> CommandResponse
Set cookies.

**Parameters:**
- `cookies` (List[Dict]): Cookie list with 'name', 'value', 'domain', 'path', 'expires', 'httpOnly', 'secure', 'sameSite'

**Returns:** CommandResponse

---

### delete_cookies(names: List[str]) -> CommandResponse
Delete cookies by name.

**Parameters:**
- `names` (List[str]): Cookie names to delete

**Returns:** CommandResponse

---

### clear_cookies() -> CommandResponse
Clear all cookies.

**Returns:** CommandResponse

---

### get_local_storage() -> Dict[str, Dict[str, str]]
Get all localStorage items.

**Returns:** Dict with 'storage' key

---

### set_local_storage(items: Dict[str, str]) -> CommandResponse
Set localStorage items.

**Parameters:**
- `items` (Dict[str, str]): Key-value pairs

**Returns:** CommandResponse

---

### clear_local_storage() -> CommandResponse
Clear all localStorage.

**Returns:** CommandResponse

---

### get_session_storage() -> Dict[str, Dict[str, str]]
Get all sessionStorage items.

**Returns:** Dict with 'storage' key

---

## Sessions

### create_checkpoint(name: str) -> SessionCheckpoint
Create session checkpoint.

**Parameters:**
- `name` (str): Checkpoint name

**Returns:** SessionCheckpoint with:
- `id` (str): Checkpoint ID
- `name` (str): Checkpoint name
- `timestamp` (int): Creation timestamp
- `url` (Optional[str]): Current URL
- `cookies` (Dict): Cookies at checkpoint
- `localStorage` (Dict): LocalStorage at checkpoint
- `sessionStorage` (Dict): SessionStorage at checkpoint

**Example:**
```python
checkpoint = await client.create_checkpoint('before_login')
print(f"Checkpoint: {checkpoint['id']}")
```

---

### rollback_to_checkpoint(checkpoint_id: str) -> CommandResponse
Rollback to checkpoint.

**Parameters:**
- `checkpoint_id` (str): Checkpoint ID

**Returns:** CommandResponse

---

### list_checkpoints() -> Dict[str, List[Dict]]
List all checkpoints.

**Returns:** Dict with 'checkpoints' list

---

### delete_checkpoint(checkpoint_id: str) -> CommandResponse
Delete checkpoint.

**Parameters:**
- `checkpoint_id` (str): Checkpoint ID

**Returns:** CommandResponse

---

### branch_session(branch_name: str) -> Dict[str, Any]
Create session branch for A/B testing.

**Parameters:**
- `branch_name` (str): Branch name

**Returns:** Dict with 'session_id' and 'branch_name'

---

### resume_session(session_id: str) -> CommandResponse
Resume a saved session.

**Parameters:**
- `session_id` (str): Session ID to resume

**Returns:** CommandResponse

---

### get_session_info() -> Dict[str, Any]
Get current session information.

**Returns:** Dict with session metadata

---

## Batch Operations

### batch_commands(commands: List[Tuple[str, Dict]]) -> List[CommandResponse]
Execute multiple commands atomically.

**Parameters:**
- `commands` (List[Tuple[str, Dict]]): List of (command_name, params) tuples

**Returns:** List of CommandResponse objects

**Example:**
```python
commands = [
    ('navigateUrl', {'url': 'https://example.com'}),
    ('screenshot', {}),
    ('getContent', {}),
]
results = await client.batch_commands(commands)
for result in results:
    if not result.success:
        print(f"Error: {result.error}")
```

---

## Connection Pooling

### BrowserPool

Manage multiple browser connections.

```python
class BrowserPool:
    def __init__(
        self,
        ws_urls: List[str],
        pool_size: int = 5,
        timeout: float = 30.0,
        auto_reconnect: bool = True
    ):
```

**Methods:**

#### `acquire() -> AsyncContextManager[BrowserClient]`
Get a connection from pool.

```python
async with pool.acquire() as client:
    await client.navigate('https://example.com')
```

#### `release(client: BrowserClient) -> None`
Return connection to pool.

#### `close() -> None`
Close all connections in pool.

---

## Streaming

### stream_content(chunk_size: int = 10000) -> AsyncGenerator[bytes, None]
Stream page content in chunks.

**Parameters:**
- `chunk_size` (int): Bytes per chunk. Default: 10000

**Yields:** Byte chunks

**Example:**
```python
async for chunk in client.stream_content(chunk_size=5000):
    print(f"Received {len(chunk)} bytes")
```

---

### stream_network_events() -> AsyncGenerator[Dict[str, Any], None]
Stream network events in real-time.

**Yields:** Network event dicts with:
- `type` (str): 'request' or 'response'
- `url` (str): Request URL
- `method` (str): HTTP method
- `status` (int): Response status (for responses)
- `headers` (Dict): Response headers (for responses)

**Example:**
```python
async for event in client.stream_network_events():
    print(f"{event['type']}: {event['url']}")
```

---

## Error Handling

### Exception Hierarchy

```
BrowserClientError (base)
├── BatchError
├── CommandTimeoutError
└── ConnectionError
```

### BrowserClientError
Base exception for all SDK errors.

### BatchError
Raised when batch operation fails.

**Attributes:**
- `message` (str): Error message
- `results` (List[CommandResponse]): Partial results before failure

**Example:**
```python
try:
    await client.batch_commands(commands)
except BatchError as e:
    print(f"Batch failed: {e.message}")
    for result in e.results:
        print(f"  - {result.command}: {result.error}")
```

### CommandTimeoutError
Raised when command times out.

### ConnectionError
Raised when connection fails or is lost.

---

## Data Structures

### CommandResponse

```python
@dataclass
class CommandResponse:
    id: str                           # Command ID
    command: str                      # Command name
    success: bool                     # Success flag
    data: Optional[Dict[str, Any]]   # Response data
    error: Optional[str]              # Error message if failed
    recovery: Optional[Dict[str, Any]] # Recovery suggestions
    execution_time: float             # Execution time in seconds
```

### SessionCheckpoint

```python
@dataclass
class SessionCheckpoint:
    id: str                           # Checkpoint ID
    name: str                         # Checkpoint name
    timestamp: int                    # Creation timestamp
    url: Optional[str]                # Current URL
    cookies: Dict[str, Any]           # Cookies
    localStorage: Dict[str, Any]      # LocalStorage
    sessionStorage: Dict[str, Any]    # SessionStorage
```

### CommandCategory

```python
class CommandCategory(Enum):
    NAVIGATION = "navigation"
    INTERACTION = "interaction"
    EXTRACTION = "extraction"
    SCREENSHOT = "screenshot"
    COOKIES = "cookies"
    SESSION = "session"
    EVASION = "evasion"
    MONITORING = "monitoring"
    FORENSICS = "forensics"
    EVIDENCE = "evidence"
```

---

## Summary

The Python SDK provides 80+ methods organized into 9 categories:
- **Navigation API** (6 methods): navigate, get_url, back, forward, refresh, goto
- **Interaction API** (8 methods): click, fill, type, scroll, hover, select, wait, wait_for_navigation
- **Content Extraction** (9 methods): get_content, get_text, extract_links, extract_metadata, detect_technology, find_elements, get_element_text
- **Screenshots** (3 methods): screenshot, screenshot_element, capture_pdf
- **Cookies & Storage** (7 methods): get/set/delete cookies, clear_cookies, get/set/clear local/session storage
- **Sessions** (6 methods): create/rollback/list/delete checkpoints, branch_session, resume_session
- **Batch Operations** (1 method): batch_commands
- **Connection Pooling** (BrowserPool): acquire, release, close
- **Streaming** (2 methods): stream_content, stream_network_events

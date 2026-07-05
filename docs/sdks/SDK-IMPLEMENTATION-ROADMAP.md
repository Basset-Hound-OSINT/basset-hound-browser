# Python SDK v1.1.0 - Implementation Roadmap

**Target Release:** v1.1.0 (Production Ready)  
**Effort:** 17.5-21.5 hours  
**Start Date:** June 13, 2026  
**Target Completion:** June 20, 2026  

---

## Phase 0: Consolidation (0.5 hours)

### Task 0.1: Version Consolidation
**Duration:** 30 minutes

```bash
# 1. Archive old version
mv /sdks/python-sdk/basset_hound.py /docs/archives/basset_hound_v1.0.0.py

# 2. Promote v12_2_0
cp /sdks/python-sdk/basset_hound_v12_2_0.py /sdks/python-sdk/basset_hound.py

# 3. Update version number in file
# Change from v2.0.0 to v1.1.0-alpha

# 4. Update test imports
# From: from basset_hound_v12_2_0 import ...
# To: from basset_hound import ...

# 5. Run existing tests
pytest tests/sdks/test_python_sdk.py -v
```

**Acceptance:**
- [ ] Old version archived
- [ ] New file in place with correct version
- [ ] Test imports updated
- [ ] All 18 existing tests still pass

---

## Phase 1: Type Hints & Stubs (2.5 hours)

### Task 1.1: Full Type Hints in `basset_hound.py` (1.5 hours)

**Approach:** Systematically type all methods

**Step 1: Response Types** (20 min)
```python
from typing import TypedDict, Generic, TypeVar

class NavigationData(TypedDict):
    url: str
    title: str
    timestamp: float
    
class ScreenshotData(TypedDict):
    image: bytes
    format: str
    size: int

T = TypeVar('T')

class Response(Generic[T]):
    """Generic response wrapper"""
    id: str
    command: str
    success: bool
    data: Optional[T]
    error: Optional[str]
```

**Step 2: Method Signatures** (1 hour)
- Navigate methods: 8 methods
- Interaction methods: 12 methods
- Extraction methods: 8 methods
- Screenshot methods: 4 methods
- Session methods: 8 methods
- Fingerprint methods: 12 methods
- Proxy/Evasion methods: 20+ methods

**Step 3: Protocol Definitions** (10 min)
```python
from typing import Protocol

class Streamable(Protocol):
    async def __aiter__(self): ...
    async def __anext__(self) -> bytes: ...
```

**Checklist:**
- [ ] All method signatures have return types
- [ ] All parameters have type annotations
- [ ] Optional parameters marked Optional[T]
- [ ] Union types for flexible parameters
- [ ] TypedDict for response structures
- [ ] Callable types for callbacks
- [ ] Generic types for Response<T>

### Task 1.2: Create `.pyi` Stub File (45 min)

**File:** `/sdks/python-sdk/basset_hound.pyi`

Structure:
```python
# Stubs for basset_hound
from typing import Optional, Dict, List, Any, AsyncIterator, TypeVar
from dataclasses import dataclass

T = TypeVar('T')

@dataclass
class Response(Generic[T]):
    id: str
    command: str
    success: bool
    data: Optional[T]
    error: Optional[str]
    recovery: Optional[Dict[str, Any]]

class BassetClient:
    url: str
    timeout: float
    auto_reconnect: bool
    
    def __init__(
        self,
        url: str = "ws://localhost:8765",
        timeout: float = 30.0,
        auto_reconnect: bool = True
    ) -> None: ...
    
    async def navigate(
        self,
        url: str,
        wait_time: Optional[int] = None
    ) -> Response[NavigationData]: ...
    
    # ... (stub signatures for all methods)
```

**Checklist:**
- [ ] All public methods included
- [ ] Type annotations complete
- [ ] Docstrings converted to stub format
- [ ] No implementation code
- [ ] Validates with `stubgen`

### Task 1.3: Add `py.typed` Marker (5 min)

**File:** `/sdks/python-sdk/py.typed`
```
# Marker file for PEP 561 type checking
# This file indicates the package has type hints
```

**Checklist:**
- [ ] File created
- [ ] Added to setup.py package_data
- [ ] Validates with mypy

### Task 1.4: Validation (10 min)

```bash
# Validate all type hints
mypy --strict /sdks/python-sdk/basset_hound.py --no-implicit-optional

# Verify stub file
stubgen -p basset_hound -o /sdks/python-sdk/

# Test IDE autocompletion
# Open in VS Code, verify autocomplete works
```

**Checklist:**
- [ ] mypy --strict passes
- [ ] No "error" or "warning" messages
- [ ] VS Code autocomplete working
- [ ] Type narrowing works correctly

---

## Phase 2: Test Suite Expansion (5-6 hours)

### Task 2.1: Infrastructure Setup (30 min)

#### Create `/tests/sdks/conftest.py`
```python
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from websockets import serve
import json

@pytest.fixture
def event_loop():
    """Provide event loop for async tests"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def mock_ws_server():
    """Provide mock WebSocket server for testing"""
    async def handler(websocket, path):
        async for message in websocket:
            data = json.loads(message)
            # Echo back responses
            response = {
                'id': data.get('id'),
                'command': data.get('command'),
                'success': True,
                'data': {'echo': True}
            }
            await websocket.send(json.dumps(response))
    
    async with serve(handler, "localhost", 0) as server:
        yield server

@pytest.fixture
async def client():
    """Provide client connected to mock server"""
    from basset_hound import BassetClient
    client = BassetClient('ws://localhost:8765')
    # Don't actually connect - use mocking
    yield client

@pytest.fixture
def sample_responses():
    """Load sample response fixtures"""
    return {
        'navigate': {'success': True, 'data': {'url': 'https://example.com'}},
        'screenshot': {'success': True, 'data': {'image': b'PNG_DATA', 'size': 1024}},
        # ... more fixtures
    }
```

#### Create `/tests/sdks/fixtures/sample-responses.json`
```json
{
  "navigate": {
    "id": "123",
    "command": "navigate",
    "success": true,
    "data": {
      "url": "https://example.com",
      "title": "Example Domain",
      "timestamp": 1623456789
    }
  },
  "screenshot": {
    "id": "124",
    "command": "screenshot",
    "success": true,
    "data": {
      "image": "base64_encoded_image_data_here",
      "format": "png",
      "size": 65536
    }
  }
}
```

**Checklist:**
- [ ] conftest.py created with fixtures
- [ ] Sample responses JSON created
- [ ] Mock WebSocket server functional
- [ ] Fixtures load correctly

### Task 2.2: Command Execution Tests (2 hours)

#### Test Categories

**Navigation Tests** (`test_navigation_commands`) - 6 tests
```python
@pytest.mark.asyncio
async def test_navigate_success(client):
    """Test successful navigation"""
    
@pytest.mark.asyncio
async def test_navigate_with_wait_time(client):
    """Test navigation with wait time"""
    
@pytest.mark.asyncio
async def test_navigate_invalid_url(client):
    """Test error handling for invalid URL"""

# ... 3 more navigation tests
```

**Interaction Tests** (`test_interaction_commands`) - 6 tests
```python
@pytest.mark.asyncio
async def test_click_element(client):
    """Test clicking element"""
    
@pytest.mark.asyncio
async def test_fill_form_field(client):
    """Test filling form field"""
    
@pytest.mark.asyncio
async def test_scroll_page(client):
    """Test scrolling page"""

# ... 3 more interaction tests
```

**Content Extraction Tests** (`test_extraction_commands`) - 6 tests
```python
@pytest.mark.asyncio
async def test_extract_metadata(client):
    """Test metadata extraction"""
    
@pytest.mark.asyncio
async def test_extract_links(client):
    """Test link extraction"""
    
@pytest.mark.asyncio
async def test_extract_all(client):
    """Test combined extraction"""

# ... 3 more extraction tests
```

**Session Management Tests** (`test_session_commands`) - 6 tests
**Fingerprinting Tests** (`test_fingerprint_commands`) - 6 tests

**Total: 30 new command execution tests**

**Checklist:**
- [ ] All 30 tests created
- [ ] Mock responses configured
- [ ] Tests parametrized where appropriate
- [ ] Coverage >90% for command execution paths

### Task 2.3: Error Handling Tests (1.5 hours)

**Connection Error Tests** - 4 tests
```python
@pytest.mark.asyncio
async def test_connection_timeout():
    """Test timeout during connection"""
    
@pytest.mark.asyncio
async def test_command_timeout():
    """Test timeout during command execution"""
    
@pytest.mark.asyncio
async def test_reconnection_on_disconnect():
    """Test automatic reconnection"""
    
@pytest.mark.asyncio
async def test_connection_refused():
    """Test connection refused error"""
```

**Command Error Tests** - 3 tests
```python
@pytest.mark.asyncio
async def test_invalid_command():
    """Test error on invalid command"""
    
@pytest.mark.asyncio
async def test_missing_parameters():
    """Test error on missing required parameters"""
    
@pytest.mark.asyncio
async def test_rate_limit_recovery():
    """Test recovery from rate limiting"""
```

**State Error Tests** - 3 tests
```python
@pytest.mark.asyncio
async def test_command_while_disconnected():
    """Test command sent while disconnected"""
    
@pytest.mark.asyncio
async def test_multiple_connects():
    """Test multiple connection attempts"""
    
@pytest.mark.asyncio
async def test_cleanup_on_disconnect():
    """Test cleanup after disconnect"""
```

**Total: 10 new error handling tests**

**Checklist:**
- [ ] All error scenarios covered
- [ ] Exception types correct
- [ ] Error messages helpful
- [ ] Recovery paths tested

### Task 2.4: Concurrency Tests (1.5 hours)

**Concurrent Operations Tests** - 4 tests
```python
@pytest.mark.asyncio
async def test_concurrent_commands_5():
    """Test 5 concurrent commands"""
    
@pytest.mark.asyncio
async def test_concurrent_commands_20():
    """Test 20 concurrent commands"""
    
@pytest.mark.asyncio
async def test_mixed_command_concurrency():
    """Test mix of different commands concurrently"""
    
@pytest.mark.asyncio
async def test_resource_cleanup_concurrency():
    """Test resource cleanup under concurrent load"""
```

**Batch Operation Tests** - 2 tests (preview of Phase 4)
```python
@pytest.mark.asyncio
async def test_batch_atomic():
    """Test atomic batch operation"""
    
@pytest.mark.asyncio
async def test_batch_parallel():
    """Test parallel batch execution"""
```

**Event Handling Tests** - 2 tests
```python
@pytest.mark.asyncio
async def test_multiple_event_listeners():
    """Test multiple event subscriptions"""
    
@pytest.mark.asyncio
async def test_event_ordering():
    """Test correct event ordering"""
```

**Total: 8 new concurrency tests**

**Checklist:**
- [ ] Concurrent tests pass 100 iterations
- [ ] Memory stable (no growth)
- [ ] No race conditions
- [ ] Event ordering correct

### Task 2.5: Integration Tests (1 hour)

**Full Workflow Tests** - 3 tests
```python
@pytest.mark.asyncio
@pytest.mark.integration
async def test_workflow_navigate_extract_screenshot():
    """Test complete workflow: navigate → extract → screenshot"""
    
@pytest.mark.asyncio
@pytest.mark.integration
async def test_workflow_session_checkpoint_rollback():
    """Test session → checkpoint → rollback workflow"""
    
@pytest.mark.asyncio
@pytest.mark.integration
async def test_workflow_fingerprint_navigate_verify():
    """Test fingerprint → navigate → verify workflow"""
```

**Real Server Tests** - 2 tests
```python
@pytest.mark.asyncio
@pytest.mark.slow
async def test_real_server_connection():
    """Test against real localhost server"""
    
@pytest.mark.asyncio
@pytest.mark.slow
async def test_real_server_persistence():
    """Test connection persistence (100+ commands)"""
```

**Total: 5 new integration tests**

**Checklist:**
- [ ] Integration tests pass
- [ ] Memory stable during 100+ commands
- [ ] Connection persists across commands
- [ ] No resource leaks

### Phase 2 Summary

**New Test Files:**
- [ ] `/tests/sdks/test_python_sdk_commands.py` - Command execution tests
- [ ] `/tests/sdks/test_python_sdk_errors.py` - Error handling tests
- [ ] `/tests/sdks/test_python_sdk_async.py` - Concurrency tests
- [ ] `/tests/sdks/test_python_sdk_integration.py` - Integration tests
- [ ] `/tests/sdks/conftest.py` - Shared fixtures
- [ ] `/tests/sdks/fixtures/sample-responses.json` - Test data

**Updated File:**
- [ ] `/tests/sdks/test_python_sdk.py` - Refactored, keep existing tests

**Total: 18 existing + 50 new = 68 tests, 90%+ coverage**

**Acceptance Criteria:**
- [ ] All 68 tests pass
- [ ] 90%+ code coverage
- [ ] Integration tests pass against real server
- [ ] Memory stable over 1000 commands
- [ ] Concurrent tests pass 100+ iterations
- [ ] Command execution <50ms average

---

## Phase 3: Streaming Support (3 hours)

### Task 3.1: Streaming Protocol (1 hour)

#### Modify `_send_command` to Support Streaming
```python
async def _send_command(
    self,
    command: str,
    stream: bool = False,
    chunk_size: int = 8192,
    **kwargs
) -> Union[Response, AsyncIterator[bytes]]:
    """Send command with optional streaming support"""
    
    if stream:
        return self._stream_command_internal(
            command,
            chunk_size=chunk_size,
            **kwargs
        )
    else:
        # Existing non-streaming logic
        return await self._send_command_normal(command, **kwargs)

async def _stream_command_internal(
    self,
    command: str,
    chunk_size: int,
    **kwargs
) -> AsyncIterator[bytes]:
    """Internal streaming command handler"""
    request_id = str(uuid.uuid4())
    message = {
        "id": request_id,
        "command": command,
        "stream": True,
        "chunkSize": chunk_size,
        **kwargs
    }
    
    # Send request
    await self.ws.send(json.dumps(message))
    
    # Stream responses
    buffer = b''
    while True:
        chunk_message = await asyncio.wait_for(
            self._get_stream_message(request_id),
            timeout=self.timeout
        )
        
        if chunk_message.get('complete'):
            if buffer:
                yield buffer
            break
        
        data = base64.b64decode(chunk_message.get('data', ''))
        buffer += data
        
        if len(buffer) >= chunk_size:
            yield buffer[:chunk_size]
            buffer = buffer[chunk_size:]
```

**Checklist:**
- [ ] Streaming flag handled in protocol
- [ ] Chunk size configurable
- [ ] AsyncIterator protocol implemented
- [ ] Base64 encoding/decoding working

### Task 3.2: Screenshot Streaming (1 hour)

```python
async def screenshot_stream(
    self,
    format: str = "png",
    chunk_size: int = 8192
) -> AsyncIterator[bytes]:
    """Stream large screenshot data.
    
    Args:
        format: Image format ('png', 'jpg', 'webp')
        chunk_size: Bytes per chunk
        
    Yields:
        Image data chunks
        
    Example:
        async for chunk in client.screenshot_stream():
            output_file.write(chunk)
    """
    async for chunk in self._stream_command_internal(
        "screenshot",
        chunk_size=chunk_size,
        format=format
    ):
        yield chunk

async def screenshot_full_page_stream(
    self,
    format: str = "png",
    chunk_size: int = 8192
) -> AsyncIterator[bytes]:
    """Stream full-page screenshot data"""
    async for chunk in self._stream_command_internal(
        "screenshot_full_page",
        chunk_size=chunk_size,
        format=format
    ):
        yield chunk

async def screenshot_element_stream(
    self,
    selector: str,
    format: str = "png",
    chunk_size: int = 8192
) -> AsyncIterator[bytes]:
    """Stream element screenshot data"""
    async for chunk in self._stream_command_internal(
        "screenshot_element",
        chunk_size=chunk_size,
        selector=selector,
        format=format
    ):
        yield chunk
```

**Tests:**
```python
@pytest.mark.asyncio
async def test_screenshot_streaming():
    """Test streaming screenshot data"""
    chunks = []
    async for chunk in client.screenshot_stream():
        chunks.append(chunk)
    
    # Verify data assembly
    full_data = b''.join(chunks)
    assert len(full_data) > 1000  # Verify received data

@pytest.mark.asyncio
async def test_screenshot_stream_memory_efficient():
    """Test memory efficiency of streaming"""
    import tracemalloc
    tracemalloc.start()
    
    async for chunk in client.screenshot_full_page_stream():
        pass  # Process chunks
    
    current, peak = tracemalloc.get_traced_memory()
    assert peak < 50_000_000  # Less than 50MB peak
```

**Checklist:**
- [ ] All screenshot stream methods implemented
- [ ] Memory efficiency verified
- [ ] Chunk reassembly correct
- [ ] Tests passing

### Task 3.3: Content Streaming (1 hour)

```python
async def extract_all_stream(
    self,
    chunk_size: int = 8192
) -> AsyncIterator[Dict[str, Any]]:
    """Stream extracted content by type.
    
    Yields JSON objects:
        {'type': 'metadata', 'data': {...}}
        {'type': 'links', 'data': [...]}
        {'type': 'images', 'data': [...]}
        ...
    """
    async for chunk in self._stream_command_internal(
        "extract_all",
        chunk_size=chunk_size
    ):
        # Parse JSON objects from chunks
        decoder = json.JSONDecoder()
        idx = 0
        while idx < len(chunk):
            try:
                obj, end = decoder.raw_decode(chunk.decode('utf-8'), idx)
                yield obj
                idx = end
            except json.JSONDecodeError:
                break

async def extract_images_stream(
    self,
    chunk_size: int = 8192
) -> AsyncIterator[Dict[str, Any]]:
    """Stream extracted images"""
    async for chunk in self._stream_command_internal(
        "extract_images",
        chunk_size=chunk_size
    ):
        yield chunk

async def monitor_stream(
    self,
    monitor_id: str,
    chunk_size: int = 8192
) -> AsyncIterator[Dict[str, Any]]:
    """Stream monitoring events"""
    async for chunk in self._stream_command_internal(
        f"monitor_stream",
        chunk_size=chunk_size,
        monitorId=monitor_id
    ):
        yield chunk
```

**Tests:**
```python
@pytest.mark.asyncio
async def test_extract_all_streaming():
    """Test streaming extraction results"""
    result_types = []
    async for result in client.extract_all_stream():
        result_types.append(result.get('type'))
    
    # Verify we got multiple types
    assert 'metadata' in result_types
    assert 'links' in result_types

@pytest.mark.asyncio
async def test_extract_images_streaming():
    """Test streaming image extraction"""
    count = 0
    async for image in client.extract_images_stream():
        count += 1
    
    assert count > 0
```

**Checklist:**
- [ ] Content streaming methods implemented
- [ ] JSON streaming working
- [ ] Yielding correct object types
- [ ] Tests passing

### Phase 3 Summary

**New Methods: 6**
- screenshot_stream
- screenshot_full_page_stream
- screenshot_element_stream
- extract_all_stream
- extract_images_stream
- monitor_stream

**New Tests: 8-10**
- Screenshot streaming tests
- Content streaming tests
- Memory efficiency tests
- Event streaming tests

**Acceptance Criteria:**
- [ ] All streaming methods work
- [ ] AsyncIterator protocol complete
- [ ] Memory usage < 50MB for 50MB+ payloads
- [ ] All tests passing
- [ ] Documentation complete

---

## Phase 4: Batch Operations (2 hours)

### Task 4.1: Core Batch Implementation (1 hour)

```python
class BatchError(Exception):
    """Batch operation error"""
    def __init__(self, message: str, failed_indices: List[int] = None):
        self.message = message
        self.failed_indices = failed_indices or []
        super().__init__(message)

async def batch(
    self,
    operations: List[Dict[str, Any]],
    atomic: bool = False,
    max_parallel: int = 10
) -> List[Response]:
    """Execute batch operations.
    
    Args:
        operations: List of {'command': str, 'params': dict}
        atomic: If True, all succeed or all fail
        max_parallel: Max concurrent operations
        
    Returns:
        List of Response objects in order
        
    Raises:
        BatchError: If atomic=True and any fails
    """
    if atomic:
        return await self._batch_atomic(operations)
    else:
        return await self._batch_parallel(operations, max_parallel)

async def _batch_atomic(
    self,
    operations: List[Dict[str, Any]]
) -> List[Response]:
    """Execute atomically - all succeed or all fail"""
    results = []
    try:
        results = await asyncio.gather(*[
            self._send_command(
                op['command'],
                **op.get('params', {})
            )
            for op in operations
        ])
        
        # Check for failures
        failed = [i for i, r in enumerate(results) if not r.success]
        if failed:
            raise BatchError(
                f"Batch failed: {len(failed)} operation(s)",
                failed
            )
        
        return results
    except Exception as e:
        raise BatchError(f"Batch execution failed: {e}")

async def _batch_parallel(
    self,
    operations: List[Dict[str, Any]],
    max_parallel: int
) -> List[Response]:
    """Execute with concurrency limit"""
    semaphore = asyncio.Semaphore(max_parallel)
    
    async def execute_with_limit(op):
        async with semaphore:
            try:
                return await self._send_command(
                    op['command'],
                    **op.get('params', {})
                )
            except Exception as e:
                return Response(
                    id=str(uuid.uuid4()),
                    command=op['command'],
                    success=False,
                    error=str(e)
                )
    
    return await asyncio.gather(*[
        execute_with_limit(op) for op in operations
    ])
```

**Checklist:**
- [ ] Core batch methods implemented
- [ ] Atomic mode working
- [ ] Parallel mode with limits working
- [ ] Error handling correct

### Task 4.2: Specialized Batch Methods (1 hour)

```python
async def batch_extract(
    self,
    extract_types: List[str]
) -> List[Response]:
    """Extract multiple content types in one batch"""
    ops = [
        {'command': f'extract_{t}', 'params': {}}
        for t in extract_types
    ]
    return await self.batch(ops)

async def batch_screenshots(
    self,
    selectors: List[str],
    format: str = "png"
) -> List[Response]:
    """Capture multiple element screenshots"""
    ops = [
        {'command': 'screenshot_element', 'params': {
            'selector': s, 'format': format
        }}
        for s in selectors
    ]
    return await self.batch(ops, max_parallel=5)

async def batch_workflow(
    self,
    steps: List[Dict[str, Any]]
) -> List[Response]:
    """Execute workflow with sequential steps"""
    results = []
    for step in steps:
        result = await self._send_command(
            step['command'],
            **step.get('params', {})
        )
        results.append(result)
        if not result.success and step.get('required', True):
            raise BatchError(f"Required step failed: {step['command']}")
    return results
```

**Tests:**
```python
@pytest.mark.asyncio
async def test_batch_operations():
    """Test basic batch execution"""
    ops = [
        {'command': 'navigate', 'params': {'url': 'https://example.com'}},
        {'command': 'screenshot', 'params': {}},
        {'command': 'extract_all', 'params': {}}
    ]
    results = await client.batch(ops)
    assert len(results) == 3
    assert all(r.success for r in results)

@pytest.mark.asyncio
async def test_batch_atomic():
    """Test atomic batch semantics"""
    ops = [
        {'command': 'navigate', 'params': {'url': 'https://example.com'}},
        {'command': 'invalid_command', 'params': {}},  # Will fail
    ]
    with pytest.raises(BatchError):
        await client.batch(ops, atomic=True)

@pytest.mark.asyncio
async def test_batch_extract():
    """Test batch extraction"""
    results = await client.batch_extract(
        ['metadata', 'links', 'forms']
    )
    assert len(results) == 3
```

**Checklist:**
- [ ] Specialized batch methods implemented
- [ ] All test scenarios covered
- [ ] Error handling correct
- [ ] Performance verified (50+ ops/sec)

### Phase 4 Summary

**New Methods: 5**
- batch (core)
- batch_extract
- batch_screenshots
- batch_workflow
- (plus 2 internal methods)

**New Tests: 8**
- Basic batch tests
- Atomic batch tests
- Parallel batch tests
- Specialized batch tests

**Acceptance Criteria:**
- [ ] All batch methods working
- [ ] Atomic semantics correct
- [ ] Parallel mode scalable
- [ ] Error handling complete
- [ ] 90%+ test coverage

---

## Phase 5: Connection Pooling (3 hours)

### Task 5.1: AsyncConnectionPool Implementation (2 hours)

**File:** `/sdks/python-sdk/connection_pool.py`

Structure:
1. AsyncConnectionPool class (300+ lines)
2. Pool initialization
3. Client management
4. Load balancing strategies
5. Health monitoring
6. Context manager support

**Key Components:**
- `__init__` - Initialize pool
- `initialize()` - Create connections
- `execute()` - Execute on pooled connection
- `batch_execute()` - Batch on pool
- `_get_client()` - Client selection
- `_health_check_loop()` - Health monitoring
- `shutdown()` - Cleanup
- `get_stats()` - Statistics

**Tests:**
```python
# /tests/sdks/test_connection_pool.py

@pytest.mark.asyncio
async def test_pool_initialization():
    """Test pool initialization"""
    async with AsyncConnectionPool(
        'ws://localhost:8765',
        pool_size=5
    ) as pool:
        assert len(pool.clients) == 5
        assert pool.available.qsize() == 5

@pytest.mark.asyncio
async def test_pool_execute():
    """Test command execution on pool"""
    async with AsyncConnectionPool(
        'ws://localhost:8765',
        pool_size=3
    ) as pool:
        response = await pool.execute('navigate', url='https://example.com')
        assert response.success

@pytest.mark.asyncio
async def test_pool_strategies():
    """Test different load balancing strategies"""
    for strategy in ['round_robin', 'least_busy', 'random']:
        async with AsyncConnectionPool(
            'ws://localhost:8765',
            pool_size=3,
            strategy=strategy
        ) as pool:
            response = await pool.execute('screenshot')
            assert response.success
```

**Checklist:**
- [ ] Pool class implemented
- [ ] All strategies working
- [ ] Health checks functional
- [ ] Tests passing (10+ tests)

### Task 5.2: Advanced Features (1 hour)

```python
# Failover support
async def execute_with_failover(
    self,
    command: str,
    max_retries: int = 3,
    **kwargs
) -> Response:
    """Execute with automatic failover"""
    for attempt in range(max_retries):
        try:
            return await self.execute(command, **kwargs)
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            logger.warning(f"Attempt {attempt + 1} failed, retrying...")
            await asyncio.sleep(2 ** attempt)

# Performance monitoring
async def get_stats(self) -> Dict[str, Any]:
    """Get pool statistics"""
    return {
        'pool_size': self.pool_size,
        'available': self.available.qsize(),
        'total_commands': self._total_commands,
        'total_errors': self._total_errors,
        'clients': [
            {
                'connected': c.is_connected(),
                'pending': len(c.pending_responses),
                'commands': c.stats.get('total_requests', 0)
            }
            for c in self.clients
        ]
    }
```

**Tests:**
```python
@pytest.mark.asyncio
async def test_pool_batch_execute():
    """Test batch execution on pool"""
    async with AsyncConnectionPool(
        'ws://localhost:8765',
        pool_size=5
    ) as pool:
        ops = [
            {'command': 'navigate', 'params': {'url': f'https://site{i}.com'}}
            for i in range(20)
        ]
        results = await pool.batch_execute(ops, parallel=10)
        assert len(results) == 20

@pytest.mark.asyncio
async def test_pool_health_check():
    """Test health monitoring"""
    async with AsyncConnectionPool(
        'ws://localhost:8765',
        pool_size=3
    ) as pool:
        await asyncio.sleep(35)  # Wait for health check
        stats = await pool.get_stats()
        assert stats['available'] >= 0

@pytest.mark.asyncio
async def test_pool_failover():
    """Test failover mechanism"""
    async with AsyncConnectionPool(
        'ws://localhost:8765',
        pool_size=3
    ) as pool:
        response = await pool.execute_with_failover(
            'navigate',
            url='https://example.com',
            max_retries=3
        )
        assert response.success
```

**Checklist:**
- [ ] Failover implemented
- [ ] Statistics tracking working
- [ ] All advanced features tested
- [ ] Performance verified (500+ ops/sec with pool)

### Phase 5 Summary

**New Files:**
- [ ] `/sdks/python-sdk/connection_pool.py` (400+ lines)

**New Tests:**
- [ ] `/tests/sdks/test_connection_pool.py` (300+ lines, 15+ tests)

**Key Metrics:**
- [ ] 500+ commands/sec throughput
- [ ] <5ms latency per command
- [ ] Graceful failover
- [ ] Zero memory leaks

**Acceptance Criteria:**
- [ ] All pool operations working
- [ ] All strategies functional
- [ ] Performance targets met
- [ ] 90%+ test coverage

---

## Phase 6: Documentation & Examples (2-3 hours)

### Task 6.1: Getting Started Guide (30 min)

**File:** `/docs/SDK-GETTING-STARTED.md`

Contents:
- Installation (pip, from source)
- 5-minute quick start
- Basic configuration
- Common patterns
- Next steps

### Task 6.2: API Reference (45 min)

**File:** `/docs/SDK-API-REFERENCE.md`

Auto-generated from docstrings:
- All method signatures
- Parameter descriptions
- Return types
- Error conditions
- Code examples for each method

### Task 6.3: Examples & Tutorials (45 min)

**File:** `/docs/SDK-EXAMPLES.md`

10+ working examples:
1. Basic navigation & screenshot
2. Content extraction workflow
3. Streaming large responses
4. Batch operations
5. Connection pooling
6. Session management
7. Fingerprinting & evasion
8. Error handling & recovery
9. FastAPI integration
10. Concurrent monitoring

### Task 6.4: Architecture & Design (45 min)

**File:** `/docs/SDK-ARCHITECTURE.md`

Topics:
- Connection lifecycle
- Command dispatch
- Response handling
- Error recovery
- Type system
- Streaming design
- Pool architecture
- Performance characteristics

### Task 6.5: Example Code Validation (30 min)

Ensure all examples:
- [ ] Execute without errors
- [ ] Have clear comments
- [ ] Show best practices
- [ ] Are complete and runnable

### Phase 6 Summary

**Documentation Deliverables:**
- [ ] `/docs/SDK-GETTING-STARTED.md`
- [ ] `/docs/SDK-API-REFERENCE.md`
- [ ] `/docs/SDK-EXAMPLES.md`
- [ ] `/docs/SDK-ARCHITECTURE.md`
- [ ] All examples tested and working

**Acceptance Criteria:**
- [ ] All documentation complete
- [ ] All examples verified
- [ ] IDE autocompletion working
- [ ] Type hints validated

---

## Phase 7: Integration & Validation (2 hours)

### Task 7.1: Final Testing

```bash
# Run all tests
pytest tests/sdks/test_python_sdk*.py -v --cov=sdks/python-sdk --cov-report=html

# Verify type hints
mypy --strict sdks/python-sdk/basset_hound.py

# Lint code
black --check sdks/python-sdk/
pylint sdks/python-sdk/basset_hound.py

# Test against real server (if available)
pytest tests/sdks/test_python_sdk_integration.py -v -m integration
```

**Acceptance:**
- [ ] All tests pass (68 tests)
- [ ] 90%+ coverage
- [ ] mypy --strict passes
- [ ] No linting errors
- [ ] Integration tests pass

### Task 7.2: Performance Validation

```bash
# Run performance tests
pytest tests/sdks/test_performance.py -v

# Verify:
# - <5ms command latency
# - 50+ commands/sec per client
# - 500+ commands/sec with pool
# - 0MB/hour memory growth
# - <100 open file descriptors
```

**Acceptance:**
- [ ] All performance targets met
- [ ] Memory stable
- [ ] No resource leaks

### Task 7.3: Release Preparation

```bash
# Update version
# basset_hound.py: v1.1.0
# setup.py: version="1.1.0"

# Create CHANGELOG entry
# Update README with new features

# Build package
python setup.py sdist bdist_wheel

# Verify package
twine check dist/*
```

**Acceptance:**
- [ ] Version updated
- [ ] CHANGELOG complete
- [ ] Package builds successfully

---

## Daily Checklist

### Day 1: Consolidation + Phase 1 (2.5 hours)
- [ ] Version consolidation (0.5h)
- [ ] Type hints (1.5h)
- [ ] Stubs & validation (0.5h)

### Day 2: Phase 2a + 2b (5-6 hours)
- [ ] Test infrastructure (0.5h)
- [ ] Command execution tests (2h)
- [ ] Error handling tests (1.5h)
- [ ] Concurrency tests (1.5h)

### Day 3: Phase 2c + Phase 3 (5 hours)
- [ ] Integration tests (1h)
- [ ] Phase 2 integration (1h)
- [ ] Streaming protocol (1h)
- [ ] Screenshot/content streaming (2h)

### Day 4: Phase 4 + Phase 5a (5 hours)
- [ ] Batch operations (2h)
- [ ] Connection pool implementation (3h)

### Day 5: Phase 5b + Phase 6 (3 hours)
- [ ] Advanced pool features (1h)
- [ ] Documentation (2h)

### Day 6: Phase 7 + Finalization (2 hours)
- [ ] Integration & validation (1.5h)
- [ ] Release preparation (0.5h)

**Total: 17.5 hours (fits 20-24 hour allocation)**

---

## Success Metrics

Upon completion, the Python SDK will:

1. **Type Safety:** Full mypy --strict validation ✓
2. **Test Coverage:** 90%+ (68 tests) ✓
3. **Performance:** 500+ ops/sec with pooling ✓
4. **Documentation:** Complete with 10+ examples ✓
5. **Enterprise Features:** Streaming, batching, pooling ✓
6. **Reliability:** 0% memory leaks, stable under load ✓

---

**Document Version:** 1.0  
**Date:** June 13, 2026  
**Target Release:** v1.1.0 (June 20, 2026)

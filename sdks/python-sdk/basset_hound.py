"""
Basset Hound Browser Python SDK
Full-featured async Python SDK for browser automation and forensic capture

Version: 1.1.0-alpha
Created: May 31, 2026
Requires: Python 3.8+

Installation:
    pip install basset-hound-browser

Usage:
    from basset_hound import BrowserClient

    async with BrowserClient('ws://localhost:8765') as client:
        await client.navigate('https://example.com')
        content = await client.get_content()

        # Session persistence (v12.2.0)
        checkpoint = await client.create_checkpoint('before-interaction')
        await client.rollback_to_checkpoint(checkpoint['id'])

Features:
- All 164 WebSocket commands
- Async/await throughout
- Session persistence with checkpoints
- Automatic reconnection
- Error recovery with retries
- Type hints for IDE support
- Batch command support
- Context manager support
"""

import asyncio
import json
import logging
import time
from typing import Optional, Dict, List, Any, AsyncContextManager, Tuple, Union, Coroutine, TypeVar, overload, AsyncGenerator
from dataclasses import dataclass, field
from enum import Enum
import websockets
import uuid

# Type variables for generic responses
T = TypeVar('T', bound=Dict[str, Any])

logger = logging.getLogger(__name__)


# Custom exceptions
class BrowserClientError(Exception):
    """Base exception for browser client"""
    pass


class BatchError(BrowserClientError):
    """Exception for batch operation failures"""

    def __init__(self, message: str, results: Optional[List['CommandResponse']] = None) -> None:
        self.message = message
        self.results = results or []
        super().__init__(message)


class CommandTimeoutError(BrowserClientError):
    """Exception for command timeout"""
    pass


class ConnectionError(BrowserClientError):
    """Exception for connection failures"""
    pass


class CommandCategory(Enum):
    """Command categories for grouping"""
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


@dataclass
class SessionCheckpoint:
    """Session checkpoint for persistence"""
    id: str
    name: str
    timestamp: int
    url: Optional[str] = None
    cookies: Dict[str, Any] = field(default_factory=dict)
    localStorage: Dict[str, Any] = field(default_factory=dict)
    sessionStorage: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'timestamp': self.timestamp,
            'url': self.url,
            'cookies': self.cookies,
            'localStorage': self.localStorage,
            'sessionStorage': self.sessionStorage
        }


@dataclass
class CommandResponse:
    """Standard command response"""
    id: str
    command: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    recovery: Optional[Dict[str, Any]] = None
    execution_time: float = 0.0

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CommandResponse':
        return cls(
            id=data.get('id', ''),
            command=data.get('command', ''),
            success=data.get('success', False),
            data=data.get('data'),
            error=data.get('error'),
            recovery=data.get('recovery'),
            execution_time=data.get('executionTime', 0.0)
        )


class BrowserClient:
    """
    Main client for Basset Hound Browser (v1.1.0-alpha)
    Provides complete async/await interface for browser automation and forensic capture
    """

    def __init__(
        self,
        ws_url: str = "ws://localhost:8765",
        timeout: float = 30.0,
        auto_reconnect: bool = True,
        reconnect_delay: float = 1.0,
        max_retries: int = 3,
        log_level: int = logging.INFO
    ) -> None:
        """
        Initialize browser client

        Args:
            ws_url: WebSocket URL
            timeout: Request timeout in seconds
            auto_reconnect: Auto-reconnect on disconnect
            reconnect_delay: Delay between reconnects
            max_retries: Max command retries
            log_level: Logging level
        """
        self.ws_url = ws_url
        self.timeout = timeout
        self.auto_reconnect = auto_reconnect
        self.reconnect_delay = reconnect_delay
        self.max_retries = max_retries
        self.ws: Optional[Any] = None  # websockets.WebSocketClientProtocol
        self.pending_responses: Dict[str, asyncio.Future[CommandResponse]] = {}
        self._task: Optional[asyncio.Task[None]] = None
        self._connected = False

        # Session management
        self.session_id: Optional[str] = None
        self.checkpoints: Dict[str, SessionCheckpoint] = {}
        self.current_checkpoint: Optional[str] = None

        # Configure logging
        logger.setLevel(log_level)

    async def __aenter__(self) -> 'BrowserClient':
        """Context manager entry"""
        await self.connect()
        return self

    async def __aexit__(
        self,
        exc_type: Optional[type],
        exc_val: Optional[Exception],
        exc_tb: Optional[Any]
    ) -> None:
        """Context manager exit"""
        await self.disconnect()

    async def connect(self) -> bool:
        """Establish WebSocket connection"""
        try:
            logger.info(f"Connecting to {self.ws_url}")
            self.ws = await asyncio.wait_for(
                websockets.connect(self.ws_url),
                timeout=self.timeout
            )
            self._task = asyncio.create_task(self._message_loop())
            self._connected = True
            logger.info("Connected to browser server")
            return True
        except asyncio.TimeoutError:
            logger.error(f"Connection timeout after {self.timeout}s")
            raise TimeoutError(f"Failed to connect to {self.ws_url}")
        except Exception as e:
            logger.error(f"Connection failed: {e}")
            raise

    async def disconnect(self) -> bool:
        """Close WebSocket connection"""
        self._connected = False

        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        if self.ws:
            await self.ws.close()
            logger.info("Disconnected from browser server")
            return True

        return False

    async def _message_loop(self) -> None:
        """Background task for receiving messages"""
        try:
            if self.ws is None:
                return
            async for message in self.ws:
                try:
                    data = json.loads(message)
                    response_id = data.get('id')

                    if response_id and response_id in self.pending_responses:
                        future = self.pending_responses.pop(response_id)
                        if not future.done():
                            future.set_result(CommandResponse.from_dict(data))
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON received: {message[:100]}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Message loop error: {e}")

    async def _send_command(
        self,
        command: str,
        retry_count: int = 0,
        **kwargs: Any
    ) -> CommandResponse:
        """Send command with automatic retry on failure"""
        if not self._connected or not self.ws:
            raise RuntimeError("Not connected. Call connect() first.")

        request_id = str(uuid.uuid4())
        start_time = time.time()

        message = {
            "id": request_id,
            "command": command,
            **kwargs
        }

        future: asyncio.Future[CommandResponse] = asyncio.Future()
        self.pending_responses[request_id] = future

        try:
            await asyncio.wait_for(
                self.ws.send(json.dumps(message)),
                timeout=self.timeout
            )

            response: CommandResponse = await asyncio.wait_for(future, timeout=self.timeout)
            response.execution_time = time.time() - start_time

            return response

        except asyncio.TimeoutError:
            self.pending_responses.pop(request_id, None)

            if retry_count < self.max_retries:
                logger.warning(f"Command {command} timed out, retrying...")
                await asyncio.sleep(self.reconnect_delay)
                return await self._send_command(command, retry_count + 1, **kwargs)

            raise TimeoutError(f"Command {command} timed out after {self.max_retries} retries")

        except Exception as e:
            self.pending_responses.pop(request_id, None)
            logger.error(f"Command {command} failed: {e}")
            raise

    # ==========================================
    # NAVIGATION COMMANDS
    # ==========================================

    async def navigate(self, url: str, wait_time: int = 0) -> CommandResponse:
        """Navigate to URL"""
        return await self._send_command("navigate", url=url, wait_time=wait_time)

    async def go_back(self) -> CommandResponse:
        """Go back in history"""
        return await self._send_command("go_back")

    async def go_forward(self) -> CommandResponse:
        """Go forward in history"""
        return await self._send_command("go_forward")

    async def refresh(self, hard: bool = False) -> CommandResponse:
        """Refresh page"""
        return await self._send_command("refresh", hard=hard)

    async def get_url(self) -> CommandResponse:
        """Get current URL"""
        return await self._send_command("get_url")

    async def get_title(self) -> CommandResponse:
        """Get page title"""
        return await self._send_command("get_title")

    # ==========================================
    # INTERACTION COMMANDS
    # ==========================================

    async def click(self, selector: str, humanize: bool = True) -> CommandResponse:
        """Click element"""
        return await self._send_command(
            "click",
            selector=selector,
            humanize=humanize
        )

    async def fill(
        self,
        selector: str,
        value: str,
        humanize: bool = True
    ) -> CommandResponse:
        """Fill form field"""
        return await self._send_command(
            "fill",
            selector=selector,
            value=value,
            humanize=humanize
        )

    async def type_text(
        self,
        text: str,
        selector: Optional[str] = None,
        humanize: bool = True
    ) -> CommandResponse:
        """Type text with human timing"""
        return await self._send_command(
            "type_text",
            text=text,
            selector=selector,
            humanize=humanize
        )

    async def scroll(
        self,
        x: Optional[int] = None,
        y: Optional[int] = None,
        selector: Optional[str] = None,
        humanize: bool = True
    ) -> CommandResponse:
        """Scroll page"""
        kwargs: Dict[str, Any] = {"humanize": humanize}
        if x is not None:
            kwargs["x"] = x
        if y is not None:
            kwargs["y"] = y
        if selector:
            kwargs["selector"] = selector

        return await self._send_command("scroll", **kwargs)

    async def hover(self, selector: str) -> CommandResponse:
        """Hover over element"""
        return await self._send_command("hover", selector=selector)

    async def wait_for_element(
        self,
        selector: str,
        timeout: int = 10000
    ) -> CommandResponse:
        """Wait for element"""
        return await self._send_command(
            "wait_for_element",
            selector=selector,
            timeout=timeout
        )

    async def execute_script(self, script: str) -> CommandResponse:
        """Execute JavaScript"""
        return await self._send_command("execute_script", script=script)

    # ==========================================
    # CONTENT EXTRACTION COMMANDS
    # ==========================================

    async def get_content(self) -> CommandResponse:
        """Get page content (HTML, text, links)"""
        return await self._send_command("get_content")

    async def get_page_state(self) -> CommandResponse:
        """Get page state (title, URL, forms)"""
        return await self._send_command("get_page_state")

    async def extract_links(self, include_external: bool = True) -> CommandResponse:
        """Extract all links"""
        return await self._send_command(
            "extract_links",
            include_external=include_external
        )

    async def extract_forms(self) -> CommandResponse:
        """Extract all forms"""
        return await self._send_command("extract_forms")

    async def extract_images(self, include_lazy: bool = True) -> CommandResponse:
        """Extract all images"""
        return await self._send_command(
            "extract_images",
            include_lazy=include_lazy
        )

    async def extract_metadata(self) -> CommandResponse:
        """Extract meta tags"""
        return await self._send_command("extract_metadata")

    async def extract_all(self) -> CommandResponse:
        """Extract all content"""
        return await self._send_command("extract_all")

    async def detect_technology(self) -> CommandResponse:
        """Detect technology stack"""
        return await self._send_command("detect_technology")

    # ==========================================
    # SCREENSHOT COMMANDS
    # ==========================================

    async def screenshot(
        self,
        format: str = "png",
        quality: int = 90
    ) -> CommandResponse:
        """Take screenshot"""
        return await self._send_command(
            "screenshot",
            format=format,
            quality=quality
        )

    async def screenshot_viewport(self, format: str = "png") -> CommandResponse:
        """Take viewport screenshot"""
        return await self._send_command("screenshot_viewport", format=format)

    async def screenshot_full_page(self, format: str = "png") -> CommandResponse:
        """Take full page screenshot"""
        return await self._send_command("screenshot_full_page", format=format)

    async def screenshot_element(
        self,
        selector: str,
        format: str = "png"
    ) -> CommandResponse:
        """Take element screenshot"""
        return await self._send_command(
            "screenshot_element",
            selector=selector,
            format=format
        )

    async def screenshot_forensic(
        self,
        include_hash: bool = True,
        include_signature: bool = True
    ) -> CommandResponse:
        """Take forensic screenshot with chain of custody"""
        return await self._send_command(
            "screenshot_forensic",
            include_hash=include_hash,
            include_signature=include_signature
        )

    # ==========================================
    # COOKIE & STORAGE COMMANDS
    # ==========================================

    async def get_cookies(self, url: Optional[str] = None) -> CommandResponse:
        """Get cookies"""
        return await self._send_command("get_cookies", url=url)

    async def set_cookie(
        self,
        name: str,
        value: str,
        **options: Any
    ) -> CommandResponse:
        """Set cookie"""
        return await self._send_command(
            "set_cookie",
            name=name,
            value=value,
            **options
        )

    async def delete_cookie(self, name: str) -> CommandResponse:
        """Delete cookie"""
        return await self._send_command("delete_cookie", name=name)

    async def get_local_storage(self) -> CommandResponse:
        """Get local storage"""
        return await self._send_command("get_local_storage")

    async def get_session_storage(self) -> CommandResponse:
        """Get session storage"""
        return await self._send_command("get_session_storage")

    # ==========================================
    # SESSION PERSISTENCE COMMANDS (v12.2.0)
    # ==========================================

    async def create_checkpoint(
        self,
        checkpoint_name: str,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create session checkpoint for persistence"""
        result = await self._send_command(
            "create_checkpoint",
            checkpoint_name=checkpoint_name,
            description=description
        )

        if result.success and result.data:
            checkpoint_id = result.data.get('checkpointId')
            if checkpoint_id is None:
                raise RuntimeError("Checkpoint ID not provided in response")

            checkpoint = SessionCheckpoint(
                id=checkpoint_id,
                name=checkpoint_name,
                timestamp=result.data.get('timestamp', int(time.time() * 1000))
            )
            self.checkpoints[checkpoint.id] = checkpoint
            self.current_checkpoint = checkpoint.id
            return result.data

        raise RuntimeError(f"Failed to create checkpoint: {result.error}")

    async def rollback_to_checkpoint(
        self,
        checkpoint_id: str
    ) -> Dict[str, Any]:
        """Rollback session to checkpoint"""
        if checkpoint_id not in self.checkpoints:
            raise ValueError(f"Checkpoint not found: {checkpoint_id}")

        result = await self._send_command(
            "rollback_to_checkpoint",
            checkpoint_id=checkpoint_id
        )

        if result.success and result.data is not None:
            self.current_checkpoint = checkpoint_id
            return result.data

        raise RuntimeError(f"Failed to rollback to checkpoint: {result.error}")

    async def list_checkpoints(self) -> List[Dict[str, Any]]:
        """List all checkpoints"""
        result = await self._send_command("list_checkpoints")

        if result.success and result.data is not None:
            checkpoints = result.data.get('checkpoints', [])
            return checkpoints if isinstance(checkpoints, list) else []

        raise RuntimeError(f"Failed to list checkpoints: {result.error}")

    async def delete_checkpoint(self, checkpoint_id: str) -> bool:
        """Delete checkpoint"""
        result = await self._send_command(
            "delete_checkpoint",
            checkpoint_id=checkpoint_id
        )

        if result.success:
            self.checkpoints.pop(checkpoint_id, None)
            if self.current_checkpoint == checkpoint_id:
                self.current_checkpoint = None
            return True

        raise RuntimeError(f"Failed to delete checkpoint: {result.error}")

    async def branch_session(
        self,
        checkpoint_id: str,
        branch_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Branch session for A/B testing"""
        result = await self._send_command(
            "branch_session",
            checkpoint_id=checkpoint_id,
            branch_name=branch_name
        )

        if result.success and result.data is not None:
            return result.data

        raise RuntimeError(f"Failed to branch session: {result.error}")

    async def resume_session(
        self,
        checkpoint_id: str,
        recovery_options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Resume session from checkpoint"""
        result = await self._send_command(
            "resume_session",
            checkpoint_id=checkpoint_id,
            recovery_options=recovery_options or {}
        )

        if result.success and result.data is not None:
            return result.data

        raise RuntimeError(f"Failed to resume session: {result.error}")

    # ==========================================
    # EVASION COMMANDS
    # ==========================================

    async def apply_fingerprint(
        self,
        profile_name: str,
        **options: Any
    ) -> CommandResponse:
        """Apply device fingerprint"""
        return await self._send_command(
            "apply_fingerprint",
            profile_name=profile_name,
            **options
        )

    async def rotate_user_agent(self) -> CommandResponse:
        """Rotate user agent"""
        return await self._send_command("rotate_user_agent")

    async def set_proxy(
        self,
        proxy_url: str,
        username: Optional[str] = None,
        password: Optional[str] = None
    ) -> CommandResponse:
        """Set proxy"""
        return await self._send_command(
            "set_proxy",
            proxy_url=proxy_url,
            username=username,
            password=password
        )

    async def enable_tor(self) -> CommandResponse:
        """Enable Tor"""
        return await self._send_command("enable_tor")

    async def disable_tor(self) -> CommandResponse:
        """Disable Tor"""
        return await self._send_command("disable_tor")

    # ==========================================
    # BATCH OPERATIONS
    # ==========================================

    async def batch_commands(
        self,
        commands: List[Dict[str, Any]]
    ) -> List[CommandResponse]:
        """Send multiple commands and get responses"""
        tasks = []
        for cmd in commands:
            command_name = cmd.pop('command')
            task = self._send_command(command_name, **cmd)
            tasks.append(task)

        return await asyncio.gather(*tasks)

    # ==========================================
    # MONITORING & ANALYTICS
    # ==========================================

    async def start_monitoring(
        self,
        threshold: int = 10
    ) -> CommandResponse:
        """Start page change monitoring"""
        return await self._send_command(
            "start_monitoring",
            threshold=threshold
        )

    async def stop_monitoring(self) -> CommandResponse:
        """Stop page change monitoring"""
        return await self._send_command("stop_monitoring")

    async def check_page_changes(self) -> CommandResponse:
        """Check for page changes"""
        return await self._send_command("check_page_changes")

    # ==========================================
    # STREAMING COMMANDS (Phase 3)
    # ==========================================

    async def screenshot_stream(
        self,
        format: str = "png",
        quality: int = 90,
        chunk_size: int = 8192
    ) -> AsyncGenerator[bytes, None]:
        """Stream large screenshot in chunks"""
        async for chunk in self._stream_command("screenshot_stream", format=format, quality=quality, chunk_size=chunk_size):
            yield chunk

    async def screenshot_full_page_stream(
        self,
        format: str = "png",
        chunk_size: int = 8192
    ) -> AsyncGenerator[bytes, None]:
        """Stream full-page screenshot in chunks"""
        async for chunk in self._stream_command("screenshot_full_page_stream", format=format, chunk_size=chunk_size):
            yield chunk

    async def screenshot_element_stream(
        self,
        selector: str,
        format: str = "png",
        chunk_size: int = 8192
    ) -> AsyncGenerator[bytes, None]:
        """Stream element screenshot in chunks"""
        async for chunk in self._stream_command("screenshot_element_stream", selector=selector, format=format, chunk_size=chunk_size):
            yield chunk

    async def extract_all_stream(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream extracted content by type"""
        async for chunk in self._generator_command("extract_all_stream"):
            yield chunk

    async def extract_images_stream(self, chunk_size: int = 10) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream extracted images"""
        async for chunk in self._generator_command("extract_images_stream", chunk_size=chunk_size):
            yield chunk

    async def monitor_stream(self, threshold: int = 10) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream monitoring events"""
        async for event in self._generator_command("monitor_stream", threshold=threshold):
            yield event

    async def _stream_command(self, command: str, **kwargs: Any) -> AsyncGenerator[bytes, None]:
        """Send a streaming command and yield chunks"""
        request_id = str(uuid.uuid4())

        message = {
            "id": request_id,
            "command": command,
            "stream": True,
            **kwargs
        }

        try:
            if self.ws is None:
                raise RuntimeError("Not connected")
            await self.ws.send(json.dumps(message))
            # Yield chunks from server
            async for data in self._collect_stream_chunks(request_id):
                yield data
        except Exception as e:
            logger.error(f"Streaming command {command} failed: {e}")
            raise

    async def _collect_stream_chunks(self, request_id: str) -> AsyncGenerator[bytes, None]:
        """Collect streaming chunks from server"""
        if self.ws is None:
            raise RuntimeError("Not connected")

        try:
            async for message in self.ws:
                try:
                    data = json.loads(message)
                    if data.get('id') == request_id:
                        if data.get('stream_chunk'):
                            chunk = data['stream_chunk']
                            yield chunk.encode() if isinstance(chunk, str) else chunk
                        if data.get('stream_complete'):
                            break
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON in stream: {message[:100]}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Stream collection error: {e}")

    async def _generator_command(self, command: str, **kwargs: Any) -> AsyncGenerator[Dict[str, Any], None]:
        """Send a generator command"""
        request_id = str(uuid.uuid4())

        message = {
            "id": request_id,
            "command": command,
            "generator": True,
            **kwargs
        }

        try:
            if self.ws is None:
                raise RuntimeError("Not connected")
            await self.ws.send(json.dumps(message))

            async for message_str in self.ws:
                try:
                    data = json.loads(message_str)
                    if data.get('id') == request_id:
                        if 'item' in data:
                            yield data['item']
                        if data.get('complete'):
                            break
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON in generator: {message_str[:100]}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Generator command {command} failed: {e}")

    # ==========================================
    # BATCH OPERATIONS (Phase 4)
    # ==========================================

    async def batch(
        self,
        commands: List[Dict[str, Any]],
        mode: str = "parallel",
        on_error: str = "continue"
    ) -> List[CommandResponse]:
        """
        Execute commands in batch mode

        Args:
            commands: List of command dicts with 'command' key and parameters
            mode: 'parallel' (concurrent) or 'atomic' (sequential with rollback)
            on_error: 'continue' (skip failures) or 'abort' (stop on first error)

        Returns:
            List of CommandResponse objects

        Raises:
            BatchError: If on_error='abort' and a command fails
        """
        if mode == "atomic":
            return await self._batch_atomic(commands, on_error)
        else:  # parallel
            return await self._batch_parallel(commands, on_error)

    async def _batch_parallel(
        self,
        commands: List[Dict[str, Any]],
        on_error: str
    ) -> List[CommandResponse]:
        """Execute commands in parallel"""
        tasks = []
        for cmd in commands:
            command_name = cmd.pop('command', None)
            if command_name:
                task = self._send_command(command_name, **cmd)
                tasks.append(task)

        if on_error == "abort":
            return await asyncio.gather(*tasks)
        else:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            return [r if isinstance(r, CommandResponse) else CommandResponse.from_dict({
                'id': 'error',
                'command': 'unknown',
                'success': False,
                'error': str(r)
            }) for r in results]

    async def _batch_atomic(
        self,
        commands: List[Dict[str, Any]],
        on_error: str
    ) -> List[CommandResponse]:
        """Execute commands sequentially with rollback support"""
        results = []
        checkpoint_id: Optional[str] = None

        try:
            # Create checkpoint for rollback
            checkpoint = await self.create_checkpoint("batch-atomic-checkpoint")
            checkpoint_id = checkpoint.get('checkpointId')

            # Execute commands sequentially
            for cmd in commands:
                command_name = cmd.pop('command', None)
                if command_name:
                    try:
                        response = await self._send_command(command_name, **cmd)
                        results.append(response)

                        if not response.success and on_error == "abort":
                            raise BatchError(f"Command {command_name} failed", results)
                    except Exception as e:
                        if on_error == "abort":
                            raise BatchError(f"Command {command_name} failed: {e}", results)
                        results.append(CommandResponse.from_dict({
                            'id': 'error',
                            'command': command_name,
                            'success': False,
                            'error': str(e)
                        }))

            return results

        except BatchError:
            # Rollback on failure
            if checkpoint_id:
                try:
                    await self.rollback_to_checkpoint(checkpoint_id)
                    logger.info(f"Batch rolled back to checkpoint: {checkpoint_id}")
                except Exception as e:
                    logger.error(f"Rollback failed: {e}")
            raise

        finally:
            # Clean up checkpoint
            if checkpoint_id:
                try:
                    await self.delete_checkpoint(checkpoint_id)
                except Exception:
                    pass

    async def batch_extract(
        self,
        extraction_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Batch extract multiple content types"""
        if extraction_types is None:
            extraction_types = ['content', 'links', 'images', 'forms']

        commands = []
        if 'content' in extraction_types:
            commands.append({'command': 'get_content'})
        if 'links' in extraction_types:
            commands.append({'command': 'extract_links'})
        if 'images' in extraction_types:
            commands.append({'command': 'extract_images'})
        if 'forms' in extraction_types:
            commands.append({'command': 'extract_forms'})

        results = await self.batch(commands, mode="parallel")

        return {
            'content': next((r.data for r in results if r.command == 'get_content'), None),
            'links': next((r.data for r in results if r.command == 'extract_links'), None),
            'images': next((r.data for r in results if r.command == 'extract_images'), None),
            'forms': next((r.data for r in results if r.command == 'extract_forms'), None),
            'all_success': all(r.success for r in results)
        }

    async def batch_screenshots(
        self,
        types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Batch take multiple types of screenshots"""
        if types is None:
            types = ['viewport', 'full_page']

        commands = []
        if 'viewport' in types:
            commands.append({'command': 'screenshot', 'format': 'png'})
        if 'full_page' in types:
            commands.append({'command': 'screenshot_full_page', 'format': 'png'})

        results = await self.batch(commands, mode="parallel")

        return {
            'viewport': next((r.data for r in results if r.command == 'screenshot'), None),
            'full_page': next((r.data for r in results if r.command == 'screenshot_full_page'), None),
            'all_success': all(r.success for r in results)
        }

    async def batch_workflow(
        self,
        workflow_steps: List[Dict[str, Any]]
    ) -> List[CommandResponse]:
        """Execute sequential workflow with step ordering"""
        return await self._batch_atomic(workflow_steps, on_error="abort")

    async def batch_with_recovery(
        self,
        commands: List[Dict[str, Any]],
        retry_count: int = 2
    ) -> List[CommandResponse]:
        """Execute batch with automatic retry on failure"""
        all_results: List[CommandResponse] = []

        for attempt in range(retry_count + 1):
            try:
                results = await self.batch(commands, mode="parallel", on_error="continue")
                failed = [i for i, r in enumerate(results) if not r.success]

                if not failed:
                    return results

                if attempt < retry_count:
                    logger.warning(f"Batch failed on attempt {attempt + 1}, retrying failed commands...")
                    # Retry failed commands
                    failed_commands = [commands[i] for i in failed]
                    await asyncio.sleep(1.0 * (attempt + 1))  # Exponential backoff
                else:
                    return results

            except Exception as e:
                logger.error(f"Batch with recovery failed: {e}")
                if attempt == retry_count:
                    raise

        return all_results

    # ==========================================
    # UTILITY METHODS
    # ==========================================

    def is_connected(self) -> bool:
        """Check if connected"""
        return self._connected and self.ws is not None

    async def health_check(self) -> bool:
        """Check server health"""
        try:
            result = await self._send_command("ping")
            return result.success
        except Exception:
            return False

    def get_session_info(self) -> Dict[str, Any]:
        """Get current session info"""
        return {
            'connected': self.is_connected(),
            'session_id': self.session_id,
            'current_checkpoint': self.current_checkpoint,
            'checkpoint_count': len(self.checkpoints)
        }


# Context manager for session persistence
class SessionContext:
    """Context manager for automatic checkpoint creation/rollback"""

    def __init__(self, client: BrowserClient, name: str) -> None:
        self.client = client
        self.name = name
        self.checkpoint_id: Optional[str] = None

    async def __aenter__(self) -> 'SessionContext':
        checkpoint = await self.client.create_checkpoint(self.name)
        self.checkpoint_id = checkpoint.get('checkpointId')
        return self

    async def __aexit__(
        self,
        exc_type: Optional[type],
        exc_val: Optional[Exception],
        exc_tb: Optional[Any]
    ) -> None:
        if exc_type and self.checkpoint_id:
            # Rollback on error
            await self.client.rollback_to_checkpoint(self.checkpoint_id)
            logger.warning(f"Session rolled back to checkpoint: {self.name}")


# Main entry point exports
__all__ = [
    'BrowserClient',
    'SessionCheckpoint',
    'CommandResponse',
    'SessionContext',
    'CommandCategory',
    'BrowserClientError',
    'BatchError',
    'CommandTimeoutError',
    'ConnectionError'
]

if __name__ == '__main__':
    # Example usage
    async def main() -> None:
        async with BrowserClient('ws://localhost:8765') as client:
            # Navigate
            response = await client.navigate('https://example.com')
            print(f"Navigation: {response.success}")

            # Create checkpoint
            checkpoint = await client.create_checkpoint('after-nav')
            print(f"Checkpoint created: {checkpoint['checkpointId']}")

            # Extract content
            content = await client.get_content()
            print(f"Content extracted: {content.success}")

            # Detect technology
            tech = await client.detect_technology()
            print(f"Technology detection: {tech.data}")

    asyncio.run(main())

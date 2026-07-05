"""
Basset Hound Browser - Python SDK Template
Version: 12.8.0
Protocol: WebSocket (JSON)

This is a template/stub for building Python clients. Extend this class with
your specific requirements.

Usage:
    from basset_client import BassetClient

    async with BassetClient(url='ws://localhost:8765') as client:
        screenshot = await client.screenshot()
        evidence = await client.capture_evidence(screenshot)
"""

import asyncio
import json
import logging
from typing import Any, Dict, Optional, List
from dataclasses import dataclass
from enum import Enum
import uuid
import time

try:
    import websockets
except ImportError:
    raise ImportError("websockets library required: pip install websockets")


# ============================================================================
# Data Models
# ============================================================================

class CommandStatus(Enum):
    """Command execution status."""
    PENDING = "pending"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class RateLimit:
    """Rate limit information."""
    limit: int
    remaining: int
    window: str
    reset_at: int
    retry_after: Optional[int] = None


@dataclass
class CommandResponse:
    """Generic command response."""
    id: str
    command: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    recovery: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


# ============================================================================
# Error Classes
# ============================================================================

class BassetError(Exception):
    """Base exception for Basset Hound errors."""
    pass


class ConnectionError(BassetError):
    """Connection failed or lost."""
    pass


class CommandError(BassetError):
    """Command execution failed."""

    def __init__(self, code: str, message: str, details: Optional[Dict] = None):
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(f"{code}: {message}")


class TimeoutError(BassetError):
    """Command execution timeout."""
    pass


class RateLimitError(BassetError):
    """Rate limit exceeded."""

    def __init__(self, rate_limit: RateLimit):
        self.rate_limit = rate_limit
        super().__init__(
            f"Rate limit exceeded: {rate_limit.remaining}/{rate_limit.limit} "
            f"remaining, retry in {rate_limit.retry_after}ms"
        )


class SizeExceededError(BassetError):
    """Request/response size exceeded."""
    pass


# ============================================================================
# Client Configuration
# ============================================================================

@dataclass
class ClientConfig:
    """Client configuration."""
    url: str = "ws://localhost:8765"
    timeout: int = 30000  # milliseconds
    max_retries: int = 3
    retry_delay: float = 1.0
    log_level: int = logging.INFO
    compression: str = "none"  # none, gzip, brotli
    auto_reconnect: bool = True
    token: Optional[str] = None


# ============================================================================
# Basset Hound Client
# ============================================================================

class BassetClient:
    """
    WebSocket client for Basset Hound Browser API.

    Example:
        async with BassetClient(url='ws://localhost:8765') as client:
            await client.navigate(url='https://example.com')
            screenshot = await client.screenshot()
    """

    def __init__(self, config: Optional[ClientConfig] = None, **kwargs):
        """
        Initialize client.

        Args:
            config: ClientConfig instance or None to use defaults
            **kwargs: Override config values (url, timeout, token, etc.)
        """
        self.config = config or ClientConfig()

        # Override with kwargs
        for key, value in kwargs.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)

        # Setup logging
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(self.config.log_level)

        # Connection state
        self.ws = None
        self.connected = False
        self._response_handlers = {}
        self._request_counter = 0
        self._rate_limit = None

    async def __aenter__(self):
        """Async context manager entry."""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.disconnect()

    async def connect(self):
        """Establish WebSocket connection."""
        try:
            # Build connection URL
            url = self.config.url
            if self.config.token:
                url += f"?token={self.config.token}"

            # Connect
            self.logger.info(f"Connecting to {url}...")
            self.ws = await websockets.connect(url)
            self.connected = True
            self.logger.info("Connected successfully")

            # Start message handler
            asyncio.create_task(self._handle_messages())

        except Exception as e:
            self.logger.error(f"Connection failed: {e}")
            raise ConnectionError(f"Failed to connect: {e}")

    async def disconnect(self):
        """Close WebSocket connection."""
        if self.ws:
            try:
                await self.ws.close()
                self.connected = False
                self.logger.info("Disconnected")
            except Exception as e:
                self.logger.warning(f"Error during disconnect: {e}")

    async def _handle_messages(self):
        """Handle incoming WebSocket messages."""
        try:
            async for message in self.ws:
                try:
                    response = json.loads(message)
                    request_id = response.get('id')

                    if request_id in self._response_handlers:
                        handler = self._response_handlers.pop(request_id)
                        handler.set_result(response)

                except json.JSONDecodeError:
                    self.logger.error(f"Invalid JSON received: {message}")

        except Exception as e:
            self.logger.error(f"Message handler error: {e}")
            self.connected = False

    def _get_request_id(self) -> str:
        """Generate unique request ID."""
        self._request_counter += 1
        return f"req-{int(time.time() * 1000)}-{self._request_counter}"

    async def execute(
        self,
        command: str,
        timeout: Optional[int] = None,
        **params
    ) -> CommandResponse:
        """
        Execute a command.

        Args:
            command: Command name
            timeout: Request timeout in milliseconds
            **params: Command parameters

        Returns:
            CommandResponse

        Raises:
            ConnectionError: Not connected
            TimeoutError: Command timeout
            CommandError: Command failed
            RateLimitError: Rate limit exceeded
        """
        if not self.connected:
            raise ConnectionError("Not connected to server")

        request_id = self._get_request_id()
        timeout_ms = timeout or self.config.timeout

        # Build request
        request = {
            "id": request_id,
            "command": command,
            "timeout": timeout_ms,
        }
        request.update(params)

        # Send request
        try:
            await self.ws.send(json.dumps(request))
        except Exception as e:
            raise ConnectionError(f"Failed to send command: {e}")

        # Wait for response
        try:
            future = asyncio.Future()
            self._response_handlers[request_id] = future
            response_data = await asyncio.wait_for(future, timeout=timeout_ms/1000)
        except asyncio.TimeoutError:
            self._response_handlers.pop(request_id, None)
            raise TimeoutError(f"Command '{command}' timeout after {timeout_ms}ms")
        except Exception as e:
            self._response_handlers.pop(request_id, None)
            raise BassetError(f"Error waiting for response: {e}")

        # Parse response
        response = CommandResponse(
            id=response_data.get('id'),
            command=response_data.get('command'),
            success=response_data.get('success', False),
            data=response_data.get('data'),
            error=response_data.get('error'),
            code=response_data.get('code'),
            details=response_data.get('details'),
            recovery=response_data.get('recovery'),
            metadata=response_data.get('metadata')
        )

        # Check for errors
        if not response.success:
            if response.code == 'RATE_LIMITED':
                self._rate_limit = RateLimit(**response.details)
                raise RateLimitError(self._rate_limit)
            elif response.code == 'SIZE_EXCEEDED':
                raise SizeExceededError(response.error)
            else:
                raise CommandError(response.code, response.error, response.details)

        return response

    async def rate_limit_status(self) -> Optional[RateLimit]:
        """Get current rate limit status."""
        try:
            response = await self.execute('get_rate_limit_status')
            if response.data:
                self._rate_limit = RateLimit(**response.data)
                return self._rate_limit
        except Exception as e:
            self.logger.warning(f"Failed to get rate limit status: {e}")
        return None

    # ========================================================================
    # Common Commands
    # ========================================================================

    async def navigate(self, url: str, wait_until: str = 'networkidle2') -> CommandResponse:
        """Navigate to URL."""
        return await self.execute('navigate', url=url, waitUntil=wait_until)

    async def screenshot(self, full_page: bool = False) -> CommandResponse:
        """Take screenshot."""
        return await self.execute(
            'screenshot_full_page' if full_page else 'screenshot',
            fullPage=full_page
        )

    async def screenshot_element(self, selector: str) -> CommandResponse:
        """Take screenshot of element."""
        return await self.execute('screenshot_element', selector=selector)

    async def click(self, selector: str) -> CommandResponse:
        """Click element."""
        return await self.execute('click', selector=selector)

    async def fill(self, selector: str, text: str) -> CommandResponse:
        """Fill input field."""
        return await self.execute('fill', selector=selector, text=text)

    async def type_text(self, text: str, delay: int = 100) -> CommandResponse:
        """Type text character by character."""
        return await self.execute('type', text=text, delay=delay)

    async def get_content(self, type: str = 'text') -> CommandResponse:
        """Get page content."""
        return await self.execute('get_content', type=type)

    async def get_url(self) -> CommandResponse:
        """Get current URL."""
        return await self.execute('get_url')

    async def get_title(self) -> CommandResponse:
        """Get page title."""
        return await self.execute('get_title')

    async def execute_script(self, script: str) -> CommandResponse:
        """Execute JavaScript."""
        return await self.execute('execute_script', script=script)

    async def wait_for_selector(self, selector: str, timeout: int = 30000) -> CommandResponse:
        """Wait for element to appear."""
        return await self.execute('wait_for_selector', selector=selector, timeout=timeout)

    # ========================================================================
    # Evidence Capture Commands
    # ========================================================================

    async def capture_screenshot_evidence(
        self,
        image_data: str,
        url: str,
        title: Optional[str] = None,
        full_page: bool = False
    ) -> CommandResponse:
        """Capture screenshot as evidence."""
        return await self.execute(
            'capture_screenshot_evidence',
            imageData=image_data,
            url=url,
            title=title,
            fullPage=full_page
        )

    async def capture_page_archive(
        self,
        content: str,
        format: str,
        url: str
    ) -> CommandResponse:
        """Capture page archive (MHTML, WARC, PDF)."""
        return await self.execute(
            'capture_page_archive_evidence',
            content=content,
            format=format,
            url=url
        )

    async def capture_har_evidence(
        self,
        har_data: Dict,
        url: str
    ) -> CommandResponse:
        """Capture network traffic as HAR."""
        return await self.execute(
            'capture_har_evidence',
            harData=har_data,
            url=url
        )

    async def capture_dom_evidence(
        self,
        dom_string: str,
        url: str,
        include_styles: bool = True
    ) -> CommandResponse:
        """Capture DOM snapshot."""
        return await self.execute(
            'capture_dom_evidence',
            domString=dom_string,
            url=url,
            includeStyles=include_styles
        )

    # ========================================================================
    # Network Forensics Commands
    # ========================================================================

    async def start_network_forensics(self, options: Optional[Dict] = None) -> CommandResponse:
        """Start network forensics capture."""
        return await self.execute('start_network_forensics_capture', **(options or {}))

    async def stop_network_forensics(self) -> CommandResponse:
        """Stop network forensics capture."""
        return await self.execute('stop_network_forensics_capture')

    async def get_network_forensics_status(self) -> CommandResponse:
        """Get network forensics status."""
        return await self.execute('get_network_forensics_status')

    # ========================================================================
    # Session Management Commands
    # ========================================================================

    async def create_profile(self, profile_name: str) -> CommandResponse:
        """Create new browser profile."""
        return await self.execute('create_profile', profileName=profile_name)

    async def list_profiles(self) -> CommandResponse:
        """List available profiles."""
        return await self.execute('list_profiles')

    async def get_cookies(self, domain: Optional[str] = None) -> CommandResponse:
        """Get cookies."""
        return await self.execute('get_cookies', domain=domain)

    async def clear_cookies(self) -> CommandResponse:
        """Clear all cookies."""
        return await self.execute('clear_all_cookies')

    # ========================================================================
    # Evasion Commands
    # ========================================================================

    async def set_user_agent(self, user_agent: str) -> CommandResponse:
        """Set user agent."""
        return await self.execute('set_user_agent', userAgent=user_agent)

    async def set_proxy(
        self,
        proxy_type: str,
        host: str,
        port: int,
        username: Optional[str] = None,
        password: Optional[str] = None
    ) -> CommandResponse:
        """Set proxy."""
        return await self.execute(
            'set_proxy',
            proxyType=proxy_type,
            host=host,
            port=port,
            username=username,
            password=password
        )

    async def set_geolocation(
        self,
        latitude: float,
        longitude: float,
        accuracy: float = 100.0
    ) -> CommandResponse:
        """Set geolocation."""
        return await self.execute(
            'set_geolocation',
            latitude=latitude,
            longitude=longitude,
            accuracy=accuracy
        )


# ============================================================================
# Main Example
# ============================================================================

async def main():
    """Example usage."""
    config = ClientConfig(
        url='ws://localhost:8765',
        timeout=30000,
        log_level=logging.INFO
    )

    try:
        async with BassetClient(config=config) as client:
            # Navigate
            print("Navigating...")
            await client.navigate(url='https://example.com')

            # Get title
            title_response = await client.get_title()
            print(f"Title: {title_response.data}")

            # Take screenshot
            print("Taking screenshot...")
            screenshot = await client.screenshot()
            print(f"Screenshot size: {len(screenshot.data['imageData'])}")

            # Capture evidence
            print("Capturing evidence...")
            evidence = await client.capture_screenshot_evidence(
                image_data=screenshot.data['imageData'],
                url='https://example.com'
            )
            print(f"Evidence ID: {evidence.data['evidenceId']}")

            # Check rate limits
            limits = await client.rate_limit_status()
            if limits:
                print(f"Rate limit: {limits.remaining}/{limits.limit}")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == '__main__':
    asyncio.run(main())

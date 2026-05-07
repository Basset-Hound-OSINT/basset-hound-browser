"""
Basset Hound Browser - Python Client Library
Version: 1.0.0
Protocol: WebSocket (JSON)
Default Host: localhost:8765

Usage:
    from python_client import BassetHoundClient

    async with BassetHoundClient() as browser:
        await browser.navigate("https://example.com")
        content = await browser.get_content()
        print(content['text'])
"""

import asyncio
import json
import logging
from typing import Any, Dict, Optional, List
from contextlib import asynccontextmanager

try:
    import websockets
except ImportError:
    raise ImportError("Please install websockets: pip install websockets")


logger = logging.getLogger(__name__)


class BassetHoundClientError(Exception):
    """Base exception for Basset Hound client errors."""
    pass


class BassetHoundConnectionError(BassetHoundClientError):
    """Raised when connection to browser fails."""
    pass


class BassetHoundTimeoutError(BassetHoundClientError):
    """Raised when command times out."""
    pass


class BassetHoundClient:
    """
    Python client for Basset Hound Browser MCP server.

    Provides async/await interface for browser automation via WebSocket.
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 8765,
        timeout: float = 30.0,
        auto_reconnect: bool = True
    ):
        """
        Initialize Basset Hound client.

        Args:
            host: WebSocket host (default: localhost)
            port: WebSocket port (default: 8765)
            timeout: Command timeout in seconds (default: 30)
            auto_reconnect: Auto-reconnect on connection loss (default: True)
        """
        self.host = host
        self.port = port
        self.timeout = timeout
        self.auto_reconnect = auto_reconnect
        self.ws = None
        self.command_id = 0
        self._connected = False

    @property
    def url(self) -> str:
        """Get WebSocket URL."""
        return f"ws://{self.host}:{self.port}"

    @property
    def is_connected(self) -> bool:
        """Check if connected to browser."""
        return self._connected

    async def connect(self):
        """Establish WebSocket connection to browser."""
        try:
            self.ws = await websockets.connect(self.url)
            self._connected = True
            logger.info(f"Connected to browser at {self.url}")
        except Exception as e:
            self._connected = False
            raise BassetHoundConnectionError(
                f"Failed to connect to {self.url}: {e}"
            ) from e

    async def disconnect(self):
        """Close WebSocket connection."""
        if self.ws:
            await self.ws.close()
            self._connected = False
            logger.info("Disconnected from browser")

    async def send_command(
        self,
        command: str,
        **params
    ) -> Dict[str, Any]:
        """
        Send command to browser and get response.

        Args:
            command: Command name
            **params: Command parameters

        Returns:
            Response dictionary with success and data

        Raises:
            BassetHoundConnectionError: If not connected
            BassetHoundTimeoutError: If command times out
        """
        if not self._connected:
            if self.auto_reconnect:
                await self.connect()
            else:
                raise BassetHoundConnectionError("Not connected to browser")

        self.command_id += 1
        request = {
            "id": str(self.command_id),
            "command": command,
            **params
        }

        try:
            await asyncio.wait_for(
                self.ws.send(json.dumps(request)),
                timeout=self.timeout
            )

            response_data = await asyncio.wait_for(
                self.ws.recv(),
                timeout=self.timeout
            )

            response = json.loads(response_data)
            return response

        except asyncio.TimeoutError:
            raise BassetHoundTimeoutError(
                f"Command '{command}' timed out after {self.timeout}s"
            )
        except Exception as e:
            self._connected = False
            raise BassetHoundClientError(f"Command failed: {e}") from e

    # Navigation Commands

    async def navigate(self, url: str, wait_until: str = "load") -> Dict[str, Any]:
        """Navigate to URL."""
        return await self.send_command("navigate", url=url, wait_until=wait_until)

    async def get_url(self) -> str:
        """Get current page URL."""
        response = await self.send_command("get_url")
        return response.get("data", {}).get("url", "")

    async def get_title(self) -> str:
        """Get current page title."""
        response = await self.send_command("get_title")
        return response.get("data", {}).get("title", "")

    async def go_back(self) -> Dict[str, Any]:
        """Navigate back in history."""
        return await self.send_command("go_back")

    async def go_forward(self) -> Dict[str, Any]:
        """Navigate forward in history."""
        return await self.send_command("go_forward")

    async def reload(self, force: bool = False) -> Dict[str, Any]:
        """Reload current page."""
        return await self.send_command("reload", force=force)

    # Interaction Commands

    async def click(self, selector: str) -> Dict[str, Any]:
        """Click element by CSS selector."""
        return await self.send_command("click", selector=selector)

    async def fill(self, selector: str, text: str) -> Dict[str, Any]:
        """Fill input field with text."""
        return await self.send_command("fill", selector=selector, text=text)

    async def type(self, selector: str, text: str) -> Dict[str, Any]:
        """Type text character by character."""
        return await self.send_command("type", selector=selector, text=text)

    async def scroll(self, x: int = 0, y: int = 500) -> Dict[str, Any]:
        """Scroll page."""
        return await self.send_command("scroll", x=x, y=y)

    async def wait_for_element(
        self,
        selector: str,
        timeout: int = 10000
    ) -> Dict[str, Any]:
        """Wait for element to appear."""
        return await self.send_command(
            "wait_for_element",
            selector=selector,
            timeout=timeout
        )

    # Content Extraction

    async def get_content(self) -> Dict[str, Any]:
        """Get page HTML and text."""
        response = await self.send_command("get_content")
        return response.get("data", {})

    async def get_page_state(self) -> Dict[str, Any]:
        """Get page state (forms, links, buttons, title)."""
        response = await self.send_command("get_page_state")
        return response.get("data", {})

    async def extract_links(self) -> List[Dict[str, str]]:
        """Extract all links from page."""
        response = await self.send_command("extract_links")
        return response.get("data", {}).get("links", [])

    async def extract_forms(self) -> List[Dict[str, Any]]:
        """Extract all forms from page."""
        response = await self.send_command("extract_forms")
        return response.get("data", {}).get("forms", [])

    # Screenshots

    async def screenshot(self) -> Optional[str]:
        """Take page screenshot as base64 PNG."""
        response = await self.send_command("screenshot")
        return response.get("data")

    # JavaScript Execution

    async def execute_script(self, script: str) -> Any:
        """Execute JavaScript in page context."""
        response = await self.send_command("execute_script", script=script)
        return response.get("data")

    # Cookie Management

    async def get_cookies(self, url: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get cookies."""
        params = {}
        if url:
            params["url"] = url
        response = await self.send_command("get_cookies", **params)
        return response.get("data", {}).get("cookies", [])

    async def set_cookies(self, cookies: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Set cookies."""
        return await self.send_command("set_cookies", cookies=cookies)

    async def clear_cookies(self) -> Dict[str, Any]:
        """Clear all cookies."""
        return await self.send_command("clear_cookies")

    # Proxy Management

    async def set_proxy(self, host: str, port: int, proxy_type: str = "http") -> Dict[str, Any]:
        """Set proxy."""
        return await self.send_command(
            "set_proxy",
            host=host,
            port=port,
            type=proxy_type
        )

    async def get_proxy_status(self) -> Dict[str, Any]:
        """Get current proxy status."""
        response = await self.send_command("get_proxy_status")
        return response.get("data", {})

    async def clear_proxy(self) -> Dict[str, Any]:
        """Clear proxy."""
        return await self.send_command("clear_proxy")

    # User Agent Management

    async def get_user_agent_status(self) -> Dict[str, Any]:
        """Get user agent status."""
        response = await self.send_command("get_user_agent_status")
        return response.get("data", {})

    async def set_user_agent(self, user_agent: str) -> Dict[str, Any]:
        """Set specific user agent."""
        return await self.send_command("set_user_agent", userAgent=user_agent)

    async def rotate_user_agent(self) -> Dict[str, Any]:
        """Rotate to next user agent."""
        return await self.send_command("rotate_user_agent")

    # Tor Integration

    async def get_tor_mode(self) -> str:
        """Get Tor mode (off/on/auto)."""
        response = await self.send_command("get_tor_mode")
        return response.get("data", {}).get("mode", "off")

    async def set_tor_mode(self, mode: str) -> Dict[str, Any]:
        """Set Tor mode (off/on/auto)."""
        return await self.send_command("set_tor_mode", mode=mode)

    async def tor_new_identity(self) -> Dict[str, Any]:
        """Request new Tor identity."""
        return await self.send_command("tor_new_identity")

    # Context Manager

    async def __aenter__(self):
        """Async context manager entry."""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.disconnect()

    # Health Check

    async def ping(self) -> bool:
        """Health check."""
        try:
            response = await self.send_command("ping")
            return response.get("success", False)
        except Exception:
            return False


# Convenience functions

async def quick_navigate(url: str, host: str = "localhost", port: int = 8765) -> str:
    """Quick helper to navigate and get content."""
    async with BassetHoundClient(host=host, port=port) as browser:
        await browser.navigate(url)
        await asyncio.sleep(2)  # Wait for page load
        content = await browser.get_content()
        return content.get("text", "")


async def quick_screenshot(url: str, host: str = "localhost", port: int = 8765) -> Optional[str]:
    """Quick helper to navigate and take screenshot."""
    async with BassetHoundClient(host=host, port=port) as browser:
        await browser.navigate(url)
        await asyncio.sleep(2)  # Wait for page load
        return await browser.screenshot()


if __name__ == "__main__":
    # Example usage
    import sys

    logging.basicConfig(level=logging.INFO)

    if len(sys.argv) > 1:
        url = sys.argv[1]

        async def main():
            async with BassetHoundClient() as browser:
                print(f"Navigating to {url}...")
                await browser.navigate(url)
                await asyncio.sleep(2)

                title = await browser.get_title()
                print(f"Title: {title}")

                links = await browser.extract_links()
                print(f"Found {len(links)} links")

        asyncio.run(main())
    else:
        print("Python Client Library for Basset Hound Browser")
        print("Usage: python python_client.py <url>")

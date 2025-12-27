"""
Basset Hound Browser WebSocket Client

Main client class for interacting with the Basset Hound Browser.
"""

import json
import threading
import time
import uuid
from typing import Any, Dict, List, Optional, Union
from concurrent.futures import Future, ThreadPoolExecutor

try:
    import websocket
except ImportError:
    raise ImportError("Please install websocket-client: pip install websocket-client")

from .exceptions import (
    BassetHoundError,
    ConnectionError,
    CommandError,
    TimeoutError
)


class BassetHoundClient:
    """
    WebSocket client for controlling Basset Hound Browser.

    Example:
        >>> client = BassetHoundClient()
        >>> client.connect()
        >>> client.navigate("https://example.com")
        >>> title = client.get_title()
        >>> client.disconnect()

    Or use as context manager:
        >>> with BassetHoundClient() as client:
        ...     client.navigate("https://example.com")
        ...     print(client.get_title())
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 8765,
        connection_timeout: float = 10.0,
        command_timeout: float = 30.0,
        auto_reconnect: bool = False
    ):
        """
        Initialize the Basset Hound client.

        Args:
            host: WebSocket server host (default: localhost)
            port: WebSocket server port (default: 8765)
            connection_timeout: Timeout for establishing connection in seconds
            command_timeout: Default timeout for commands in seconds
            auto_reconnect: Whether to automatically reconnect on disconnection
        """
        self.host = host
        self.port = port
        self.connection_timeout = connection_timeout
        self.command_timeout = command_timeout
        self.auto_reconnect = auto_reconnect

        self._ws: Optional[websocket.WebSocketApp] = None
        self._connected = False
        self._pending_responses: Dict[str, Future] = {}
        self._executor = ThreadPoolExecutor(max_workers=1)
        self._ws_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

    @property
    def url(self) -> str:
        """Get the WebSocket URL."""
        return f"ws://{self.host}:{self.port}"

    @property
    def is_connected(self) -> bool:
        """Check if client is connected."""
        return self._connected

    def connect(self) -> None:
        """
        Connect to the Basset Hound Browser WebSocket server.

        Raises:
            ConnectionError: If connection fails
        """
        if self._connected:
            return

        self._ws = websocket.WebSocketApp(
            self.url,
            on_open=self._on_open,
            on_message=self._on_message,
            on_error=self._on_error,
            on_close=self._on_close
        )

        # Run WebSocket in background thread
        self._ws_thread = threading.Thread(
            target=self._ws.run_forever,
            daemon=True
        )
        self._ws_thread.start()

        # Wait for connection
        start_time = time.time()
        while not self._connected:
            if time.time() - start_time > self.connection_timeout:
                self._ws.close()
                raise ConnectionError(
                    f"Connection timeout after {self.connection_timeout}s"
                )
            time.sleep(0.1)

    def disconnect(self) -> None:
        """Disconnect from the WebSocket server."""
        if self._ws:
            self._ws.close()
            self._connected = False

    def __enter__(self) -> "BassetHoundClient":
        """Context manager entry."""
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Context manager exit."""
        self.disconnect()

    def _on_open(self, ws) -> None:
        """Handle WebSocket connection opened."""
        self._connected = True

    def _on_message(self, ws, message: str) -> None:
        """Handle incoming WebSocket message."""
        try:
            data = json.loads(message)
            request_id = data.get("id")

            if request_id and request_id in self._pending_responses:
                future = self._pending_responses.pop(request_id)
                if data.get("success", True):
                    future.set_result(data)
                else:
                    future.set_exception(
                        CommandError(
                            data.get("error", "Unknown error"),
                            details=data
                        )
                    )
        except json.JSONDecodeError:
            pass

    def _on_error(self, ws, error) -> None:
        """Handle WebSocket error."""
        # Reject all pending requests
        with self._lock:
            for future in self._pending_responses.values():
                if not future.done():
                    future.set_exception(ConnectionError(str(error)))
            self._pending_responses.clear()

    def _on_close(self, ws, close_status_code, close_msg) -> None:
        """Handle WebSocket connection closed."""
        self._connected = False

        if self.auto_reconnect:
            time.sleep(1)
            try:
                self.connect()
            except ConnectionError:
                pass

    def send_command(
        self,
        command: str,
        params: Optional[Dict[str, Any]] = None,
        timeout: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Send a command to the browser and wait for response.

        Args:
            command: Command name
            params: Command parameters
            timeout: Command timeout (uses default if not specified)

        Returns:
            Response data from the browser

        Raises:
            ConnectionError: If not connected
            CommandError: If command fails
            TimeoutError: If command times out
        """
        if not self._connected:
            raise ConnectionError("Not connected to browser")

        timeout = timeout or self.command_timeout
        request_id = str(uuid.uuid4())

        message = {
            "id": request_id,
            "command": command,
            **(params or {})
        }

        future = Future()
        self._pending_responses[request_id] = future

        try:
            self._ws.send(json.dumps(message))
            result = future.result(timeout=timeout)
            return result
        except TimeoutError:
            self._pending_responses.pop(request_id, None)
            raise TimeoutError(
                f"Command '{command}' timed out after {timeout}s",
                timeout=timeout
            )

    # ==================== Navigation Commands ====================

    def navigate(self, url: str, wait_until: str = "load") -> Dict[str, Any]:
        """
        Navigate to a URL.

        Args:
            url: URL to navigate to
            wait_until: Wait condition ('load', 'domcontentloaded', 'networkidle')

        Returns:
            Navigation result
        """
        return self.send_command("navigate", {"url": url, "waitUntil": wait_until})

    def go_back(self) -> Dict[str, Any]:
        """Navigate back in history."""
        return self.send_command("go_back")

    def go_forward(self) -> Dict[str, Any]:
        """Navigate forward in history."""
        return self.send_command("go_forward")

    def reload(self, ignore_cache: bool = False) -> Dict[str, Any]:
        """
        Reload the current page.

        Args:
            ignore_cache: Whether to ignore cache
        """
        return self.send_command("reload", {"ignoreCache": ignore_cache})

    def get_url(self) -> str:
        """Get the current URL."""
        result = self.send_command("get_url")
        return result.get("url", "")

    def get_title(self) -> str:
        """Get the current page title."""
        result = self.send_command("get_title")
        return result.get("title", "")

    # ==================== Content Extraction ====================

    def extract_metadata(self) -> Dict[str, Any]:
        """Extract page metadata including Open Graph and Twitter Cards."""
        return self.send_command("extract_metadata")

    def extract_links(self, include_external: bool = True) -> Dict[str, Any]:
        """
        Extract all links from the page.

        Args:
            include_external: Whether to include external links
        """
        return self.send_command("extract_links", {"includeExternal": include_external})

    def extract_forms(self) -> Dict[str, Any]:
        """Extract all forms and their fields from the page."""
        return self.send_command("extract_forms")

    def extract_images(self, include_lazy: bool = True) -> Dict[str, Any]:
        """
        Extract all images from the page.

        Args:
            include_lazy: Whether to include lazy-loaded images
        """
        return self.send_command("extract_images", {"includeLazy": include_lazy})

    def extract_scripts(self) -> Dict[str, Any]:
        """Extract all scripts from the page."""
        return self.send_command("extract_scripts")

    def extract_structured_data(self) -> Dict[str, Any]:
        """Extract structured data (JSON-LD, microdata) from the page."""
        return self.send_command("extract_structured_data")

    def extract_all(self) -> Dict[str, Any]:
        """Extract all content types from the page."""
        return self.send_command("extract_all")

    # ==================== Technology Detection ====================

    def detect_technologies(self) -> Dict[str, Any]:
        """Detect technologies used on the current page."""
        return self.send_command("detect_technologies")

    def get_technology_categories(self) -> Dict[str, Any]:
        """Get available technology categories."""
        return self.send_command("get_technology_categories")

    def get_technology_info(self, name: str) -> Dict[str, Any]:
        """
        Get information about a specific technology.

        Args:
            name: Technology name
        """
        return self.send_command("get_technology_info", {"name": name})

    def search_technologies(self, query: str) -> Dict[str, Any]:
        """
        Search for technologies by name or category.

        Args:
            query: Search query
        """
        return self.send_command("search_technologies", {"query": query})

    # ==================== Network Analysis ====================

    def start_network_capture(self, filter_types: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Start capturing network traffic.

        Args:
            filter_types: Optional list of resource types to capture
        """
        params = {}
        if filter_types:
            params["filterTypes"] = filter_types
        return self.send_command("start_network_capture", params)

    def stop_network_capture(self) -> Dict[str, Any]:
        """Stop capturing network traffic."""
        return self.send_command("stop_network_capture")

    def get_network_requests(
        self,
        filter_type: Optional[str] = None,
        filter_domain: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get captured network requests.

        Args:
            filter_type: Filter by resource type
            filter_domain: Filter by domain
        """
        params = {}
        if filter_type:
            params["filterType"] = filter_type
        if filter_domain:
            params["filterDomain"] = filter_domain
        return self.send_command("get_network_requests", params)

    def get_network_statistics(self) -> Dict[str, Any]:
        """Get network traffic statistics."""
        return self.send_command("get_network_statistics")

    def export_network_capture(self, format: str = "har") -> Dict[str, Any]:
        """
        Export captured network data.

        Args:
            format: Export format ('har', 'json')
        """
        return self.send_command("export_network_capture", {"format": format})

    def clear_network_capture(self) -> Dict[str, Any]:
        """Clear all captured network data."""
        return self.send_command("clear_network_capture")

    # ==================== Screenshots ====================

    def screenshot(
        self,
        full_page: bool = False,
        format: str = "png",
        quality: int = 80
    ) -> Dict[str, Any]:
        """
        Take a screenshot.

        Args:
            full_page: Whether to capture the full page
            format: Image format ('png', 'jpeg')
            quality: JPEG quality (1-100)

        Returns:
            Screenshot data (base64 encoded)
        """
        return self.send_command("screenshot", {
            "fullPage": full_page,
            "format": format,
            "quality": quality
        })

    def save_screenshot(
        self,
        path: str,
        full_page: bool = False,
        format: str = "png"
    ) -> Dict[str, Any]:
        """
        Save a screenshot to file.

        Args:
            path: File path to save screenshot
            full_page: Whether to capture the full page
            format: Image format ('png', 'jpeg')
        """
        return self.send_command("save_screenshot", {
            "path": path,
            "fullPage": full_page,
            "format": format
        })

    # ==================== Cookies ====================

    def get_cookies(self, url: Optional[str] = None) -> Dict[str, Any]:
        """
        Get cookies.

        Args:
            url: Optional URL to filter cookies
        """
        params = {}
        if url:
            params["url"] = url
        return self.send_command("get_cookies", params)

    def set_cookie(
        self,
        name: str,
        value: str,
        domain: Optional[str] = None,
        path: str = "/",
        secure: bool = False,
        http_only: bool = False
    ) -> Dict[str, Any]:
        """
        Set a cookie.

        Args:
            name: Cookie name
            value: Cookie value
            domain: Cookie domain
            path: Cookie path
            secure: Secure flag
            http_only: HttpOnly flag
        """
        params = {
            "name": name,
            "value": value,
            "path": path,
            "secure": secure,
            "httpOnly": http_only
        }
        if domain:
            params["domain"] = domain
        return self.send_command("set_cookie", params)

    def delete_cookies(self, url: Optional[str] = None, name: Optional[str] = None) -> Dict[str, Any]:
        """
        Delete cookies.

        Args:
            url: URL to delete cookies for
            name: Specific cookie name to delete
        """
        params = {}
        if url:
            params["url"] = url
        if name:
            params["name"] = name
        return self.send_command("delete_cookies", params)

    # ==================== JavaScript Execution ====================

    def execute_script(self, script: str) -> Dict[str, Any]:
        """
        Execute JavaScript in the page context.

        Args:
            script: JavaScript code to execute

        Returns:
            Script execution result
        """
        return self.send_command("execute_script", {"script": script})

    # ==================== Tab Management ====================

    def get_tabs(self) -> Dict[str, Any]:
        """Get list of all tabs."""
        return self.send_command("get_tabs")

    def new_tab(self, url: Optional[str] = None) -> Dict[str, Any]:
        """
        Open a new tab.

        Args:
            url: Optional URL to open in new tab
        """
        params = {}
        if url:
            params["url"] = url
        return self.send_command("new_tab", params)

    def close_tab(self, tab_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Close a tab.

        Args:
            tab_id: Tab ID to close (closes current if not specified)
        """
        params = {}
        if tab_id:
            params["tabId"] = tab_id
        return self.send_command("close_tab", params)

    def switch_tab(self, tab_id: str) -> Dict[str, Any]:
        """
        Switch to a tab.

        Args:
            tab_id: Tab ID to switch to
        """
        return self.send_command("switch_tab", {"tabId": tab_id})

    # ==================== Input Simulation ====================

    def click(self, selector: str) -> Dict[str, Any]:
        """
        Click an element.

        Args:
            selector: CSS selector for element to click
        """
        return self.send_command("click", {"selector": selector})

    def type_text(self, selector: str, text: str, delay: int = 50) -> Dict[str, Any]:
        """
        Type text into an element.

        Args:
            selector: CSS selector for input element
            text: Text to type
            delay: Delay between keystrokes in ms
        """
        return self.send_command("type", {
            "selector": selector,
            "text": text,
            "delay": delay
        })

    def scroll(self, x: int = 0, y: int = 0, selector: Optional[str] = None) -> Dict[str, Any]:
        """
        Scroll the page or element.

        Args:
            x: Horizontal scroll amount
            y: Vertical scroll amount
            selector: Optional element to scroll
        """
        params = {"x": x, "y": y}
        if selector:
            params["selector"] = selector
        return self.send_command("scroll", params)

    # ==================== Proxy Management ====================

    def set_proxy(
        self,
        host: str,
        port: int,
        protocol: str = "http",
        username: Optional[str] = None,
        password: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Set proxy configuration.

        Args:
            host: Proxy host
            port: Proxy port
            protocol: Proxy protocol ('http', 'https', 'socks5')
            username: Proxy username
            password: Proxy password
        """
        params = {
            "host": host,
            "port": port,
            "protocol": protocol
        }
        if username:
            params["username"] = username
        if password:
            params["password"] = password
        return self.send_command("set_proxy", params)

    def clear_proxy(self) -> Dict[str, Any]:
        """Clear proxy configuration."""
        return self.send_command("clear_proxy")

    # ==================== Fingerprint / Evasion ====================

    def set_user_agent(self, user_agent: str) -> Dict[str, Any]:
        """
        Set the browser user agent.

        Args:
            user_agent: User agent string
        """
        return self.send_command("set_user_agent", {"userAgent": user_agent})

    def set_viewport(self, width: int, height: int) -> Dict[str, Any]:
        """
        Set viewport size.

        Args:
            width: Viewport width
            height: Viewport height
        """
        return self.send_command("set_viewport", {"width": width, "height": height})

    def get_fingerprint(self) -> Dict[str, Any]:
        """Get current browser fingerprint."""
        return self.send_command("get_fingerprint")

    def randomize_fingerprint(self) -> Dict[str, Any]:
        """Randomize browser fingerprint for evasion."""
        return self.send_command("randomize_fingerprint")

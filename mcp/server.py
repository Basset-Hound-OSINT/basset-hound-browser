#!/usr/bin/env python3
"""
Basset Hound Browser MCP Server

Phase 15: MCP Server for AI Agent Integration

This server exposes browser automation capabilities via the Model Context Protocol (MCP),
allowing AI agents (like those in palletai) to control the browser programmatically.

Based on FastMCP 2.0 specification and MCP 2025-11-25 standard.

Usage:
    # Start the MCP server
    python mcp/server.py

    # Or use with FastMCP CLI
    fastmcp run mcp/server.py

    # Configure in Claude Desktop or other MCP clients
    {
        "mcpServers": {
            "basset-hound-browser": {
                "command": "python",
                "args": ["mcp/server.py"],
                "cwd": "/path/to/basset-hound-browser"
            }
        }
    }
"""

import asyncio
import json
import base64
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager

try:
    from fastmcp import FastMCP, Context
    FASTMCP_AVAILABLE = True
except ImportError:
    FASTMCP_AVAILABLE = False
    print("Warning: FastMCP not installed. Install with: pip install fastmcp")

try:
    import websockets
    WEBSOCKETS_AVAILABLE = True
except ImportError:
    WEBSOCKETS_AVAILABLE = False
    print("Warning: websockets not installed. Install with: pip install websockets")


# Default WebSocket connection settings
DEFAULT_WS_HOST = "localhost"
DEFAULT_WS_PORT = 8765
DEFAULT_WS_TIMEOUT = 30


class BrowserConnection:
    """
    WebSocket connection to the Basset Hound Browser.

    Manages connection lifecycle and command execution.
    """

    def __init__(self, host: str = DEFAULT_WS_HOST, port: int = DEFAULT_WS_PORT):
        self.host = host
        self.port = port
        self.ws = None
        self.command_id = 0
        self._lock = asyncio.Lock()

    @property
    def url(self) -> str:
        return f"ws://{self.host}:{self.port}"

    async def connect(self) -> bool:
        """Establish WebSocket connection to the browser."""
        if not WEBSOCKETS_AVAILABLE:
            raise RuntimeError("websockets library not available")

        try:
            self.ws = await websockets.connect(self.url)
            return True
        except Exception as e:
            self.ws = None
            raise ConnectionError(f"Failed to connect to browser at {self.url}: {e}")

    async def disconnect(self):
        """Close the WebSocket connection."""
        if self.ws:
            await self.ws.close()
            self.ws = None

    async def send_command(self, command: str, **params) -> Dict[str, Any]:
        """
        Send a command to the browser and wait for response.

        Args:
            command: The WebSocket command name
            **params: Command parameters

        Returns:
            Response dictionary from the browser
        """
        async with self._lock:
            if not self.ws:
                await self.connect()

            self.command_id += 1
            message = {
                "id": str(self.command_id),
                "command": command,
                **params
            }

            await self.ws.send(json.dumps(message))

            # Wait for response
            response_raw = await asyncio.wait_for(
                self.ws.recv(),
                timeout=DEFAULT_WS_TIMEOUT
            )

            response = json.loads(response_raw)
            return response

    @asynccontextmanager
    async def session(self):
        """Context manager for connection lifecycle."""
        try:
            await self.connect()
            yield self
        finally:
            await self.disconnect()


# Global browser connection (singleton)
_browser: Optional[BrowserConnection] = None


def get_browser() -> BrowserConnection:
    """Get or create the browser connection singleton."""
    global _browser
    if _browser is None:
        _browser = BrowserConnection()
    return _browser


# Create FastMCP server
if FASTMCP_AVAILABLE:
    mcp = FastMCP(
        "Basset Hound Browser",
        version="1.0.0",
        description="Browser automation with anti-detection evasion for OSINT investigations"
    )
else:
    mcp = None


# ==================== Navigation Tools ====================

if mcp:
    @mcp.tool
    async def browser_navigate(url: str, wait_until: str = "load", timeout: int = 30000) -> Dict[str, Any]:
        """
        Navigate the browser to a URL.

        Args:
            url: The URL to navigate to
            wait_until: When to consider navigation complete ('load', 'domcontentloaded', 'networkidle')
            timeout: Navigation timeout in milliseconds

        Returns:
            Navigation result with success status and page info
        """
        browser = get_browser()
        return await browser.send_command("navigate", url=url, wait_until=wait_until, timeout=timeout)


    @mcp.tool
    async def browser_get_url() -> Dict[str, Any]:
        """
        Get the current page URL.

        Returns:
            Current URL of the active tab
        """
        browser = get_browser()
        return await browser.send_command("get_url")


    @mcp.tool
    async def browser_get_title() -> Dict[str, Any]:
        """
        Get the current page title.

        Returns:
            Title of the current page
        """
        browser = get_browser()
        return await browser.send_command("get_title")


    @mcp.tool
    async def browser_go_back() -> Dict[str, Any]:
        """Navigate back in browser history."""
        browser = get_browser()
        return await browser.send_command("go_back")


    @mcp.tool
    async def browser_go_forward() -> Dict[str, Any]:
        """Navigate forward in browser history."""
        browser = get_browser()
        return await browser.send_command("go_forward")


    @mcp.tool
    async def browser_reload(force: bool = False) -> Dict[str, Any]:
        """
        Reload the current page.

        Args:
            force: If True, bypass cache
        """
        browser = get_browser()
        return await browser.send_command("reload", force=force)


    # ==================== Interaction Tools ====================

    @mcp.tool
    async def browser_click(selector: str, button: str = "left", click_count: int = 1) -> Dict[str, Any]:
        """
        Click an element on the page.

        Uses human-like click behavior with natural mouse movement.

        Args:
            selector: CSS selector for the element to click
            button: Mouse button ('left', 'right', 'middle')
            click_count: Number of clicks (1 for single, 2 for double)

        Returns:
            Click result with success status
        """
        browser = get_browser()
        return await browser.send_command("click", selector=selector, button=button, click_count=click_count)


    @mcp.tool
    async def browser_fill(selector: str, text: str, clear_first: bool = True) -> Dict[str, Any]:
        """
        Fill a text input field with human-like typing simulation.

        Args:
            selector: CSS selector for the input element
            text: Text to type into the field
            clear_first: If True, clear existing content before typing

        Returns:
            Fill result with success status
        """
        browser = get_browser()
        return await browser.send_command("fill", selector=selector, text=text, clear_first=clear_first)


    @mcp.tool
    async def browser_type(selector: str, text: str, delay: int = 50) -> Dict[str, Any]:
        """
        Type text character by character with realistic delays.

        Args:
            selector: CSS selector for the input element
            text: Text to type
            delay: Delay between keystrokes in milliseconds

        Returns:
            Type result with success status
        """
        browser = get_browser()
        return await browser.send_command("type", selector=selector, text=text, delay=delay)


    @mcp.tool
    async def browser_select(selector: str, value: str) -> Dict[str, Any]:
        """
        Select an option from a dropdown.

        Args:
            selector: CSS selector for the select element
            value: Value of the option to select

        Returns:
            Select result with success status
        """
        browser = get_browser()
        return await browser.send_command("select", selector=selector, value=value)


    @mcp.tool
    async def browser_scroll(x: int = 0, y: int = 0, selector: Optional[str] = None) -> Dict[str, Any]:
        """
        Scroll the page or an element.

        Args:
            x: Horizontal scroll amount in pixels
            y: Vertical scroll amount in pixels
            selector: Optional CSS selector for element to scroll

        Returns:
            Scroll result with success status
        """
        browser = get_browser()
        params = {"x": x, "y": y}
        if selector:
            params["selector"] = selector
        return await browser.send_command("scroll", **params)


    @mcp.tool
    async def browser_hover(selector: str) -> Dict[str, Any]:
        """
        Hover over an element.

        Args:
            selector: CSS selector for the element to hover

        Returns:
            Hover result with success status
        """
        browser = get_browser()
        return await browser.send_command("hover", selector=selector)


    # ==================== Content Extraction Tools ====================

    @mcp.tool
    async def browser_get_content(selector: Optional[str] = None, content_type: str = "html") -> Dict[str, Any]:
        """
        Get page content.

        Args:
            selector: Optional CSS selector to get content from specific element
            content_type: Type of content ('html', 'text', 'outerHTML')

        Returns:
            Page content
        """
        browser = get_browser()
        params = {"content_type": content_type}
        if selector:
            params["selector"] = selector
        return await browser.send_command("get_content", **params)


    @mcp.tool
    async def browser_get_text(selector: str) -> Dict[str, Any]:
        """
        Get text content of an element.

        Args:
            selector: CSS selector for the element

        Returns:
            Text content of the element
        """
        browser = get_browser()
        return await browser.send_command("get_text", selector=selector)


    @mcp.tool
    async def browser_get_attribute(selector: str, attribute: str) -> Dict[str, Any]:
        """
        Get an attribute value from an element.

        Args:
            selector: CSS selector for the element
            attribute: Name of the attribute to get

        Returns:
            Attribute value
        """
        browser = get_browser()
        return await browser.send_command("get_attribute", selector=selector, attribute=attribute)


    @mcp.tool
    async def browser_get_page_state() -> Dict[str, Any]:
        """
        Get comprehensive page state including URL, title, forms, links, and more.

        Returns:
            Complete page state analysis
        """
        browser = get_browser()
        return await browser.send_command("get_page_state")


    @mcp.tool
    async def browser_extract_metadata() -> Dict[str, Any]:
        """
        Extract page metadata including Open Graph, Twitter cards, and meta tags.

        Returns:
            Page metadata
        """
        browser = get_browser()
        return await browser.send_command("extract_metadata")


    @mcp.tool
    async def browser_extract_links() -> Dict[str, Any]:
        """
        Extract all links from the page with categorization.

        Returns:
            Categorized links (internal, external, mailto, tel, etc.)
        """
        browser = get_browser()
        return await browser.send_command("extract_links")


    @mcp.tool
    async def browser_extract_forms() -> Dict[str, Any]:
        """
        Extract form information from the page.

        Returns:
            Form fields, inputs, and structure
        """
        browser = get_browser()
        return await browser.send_command("extract_forms")


    @mcp.tool
    async def browser_extract_images() -> Dict[str, Any]:
        """
        Extract image information from the page.

        Returns:
            Image URLs, alt text, and dimensions
        """
        browser = get_browser()
        return await browser.send_command("extract_images")


    # ==================== Screenshot Tools ====================

    @mcp.tool
    async def browser_screenshot(
        path: Optional[str] = None,
        full_page: bool = False,
        selector: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Take a screenshot of the page.

        Args:
            path: Optional file path to save screenshot
            full_page: If True, capture entire scrollable page
            selector: Optional CSS selector for element screenshot

        Returns:
            Screenshot as base64 string if no path provided
        """
        browser = get_browser()
        params = {"full_page": full_page}
        if path:
            params["path"] = path
        if selector:
            params["selector"] = selector
        return await browser.send_command("screenshot", **params)


    # ==================== Wait Tools ====================

    @mcp.tool
    async def browser_wait_for_element(
        selector: str,
        state: str = "visible",
        timeout: int = 30000
    ) -> Dict[str, Any]:
        """
        Wait for an element to reach a certain state.

        Args:
            selector: CSS selector for the element
            state: Desired state ('visible', 'hidden', 'attached', 'detached')
            timeout: Maximum wait time in milliseconds

        Returns:
            Wait result with success status
        """
        browser = get_browser()
        return await browser.send_command("wait_for_element", selector=selector, state=state, timeout=timeout)


    @mcp.tool
    async def browser_wait_for_navigation(timeout: int = 30000) -> Dict[str, Any]:
        """
        Wait for navigation to complete.

        Args:
            timeout: Maximum wait time in milliseconds

        Returns:
            Wait result with success status
        """
        browser = get_browser()
        return await browser.send_command("wait_for_navigation", timeout=timeout)


    # ==================== JavaScript Execution ====================

    @mcp.tool
    async def browser_execute_script(script: str) -> Dict[str, Any]:
        """
        Execute JavaScript in the page context.

        Args:
            script: JavaScript code to execute

        Returns:
            Script execution result
        """
        browser = get_browser()
        return await browser.send_command("execute_script", script=script)


    # ==================== Cookie Management ====================

    @mcp.tool
    async def browser_get_cookies(url: Optional[str] = None) -> Dict[str, Any]:
        """
        Get cookies from the browser.

        Args:
            url: Optional URL to filter cookies

        Returns:
            List of cookies
        """
        browser = get_browser()
        params = {}
        if url:
            params["url"] = url
        return await browser.send_command("get_cookies", **params)


    @mcp.tool
    async def browser_set_cookies(cookies: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Set cookies in the browser.

        Args:
            cookies: List of cookie objects with name, value, domain, etc.

        Returns:
            Set result with success status
        """
        browser = get_browser()
        return await browser.send_command("set_cookies", cookies=cookies)


    @mcp.tool
    async def browser_clear_cookies() -> Dict[str, Any]:
        """Clear all cookies from the browser."""
        browser = get_browser()
        return await browser.send_command("clear_cookies")


    # ==================== Profile Management ====================

    @mcp.tool
    async def browser_get_profiles() -> Dict[str, Any]:
        """
        Get list of available browser profiles.

        Returns:
            List of profile names and configurations
        """
        browser = get_browser()
        return await browser.send_command("get_profiles")


    @mcp.tool
    async def browser_switch_profile(profile_name: str) -> Dict[str, Any]:
        """
        Switch to a different browser profile.

        Each profile has isolated cookies, storage, and fingerprint configuration.

        Args:
            profile_name: Name of the profile to switch to

        Returns:
            Switch result with success status
        """
        browser = get_browser()
        return await browser.send_command("switch_profile", profile_name=profile_name)


    @mcp.tool
    async def browser_create_profile(
        profile_name: str,
        fingerprint_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a new browser profile.

        Args:
            profile_name: Name for the new profile
            fingerprint_config: Optional fingerprint configuration

        Returns:
            Create result with profile details
        """
        browser = get_browser()
        params = {"profile_name": profile_name}
        if fingerprint_config:
            params["fingerprint_config"] = fingerprint_config
        return await browser.send_command("create_profile", **params)


    # ==================== Proxy & Tor ====================

    @mcp.tool
    async def browser_set_proxy(
        proxy_url: str,
        proxy_type: str = "http"
    ) -> Dict[str, Any]:
        """
        Set proxy configuration.

        Args:
            proxy_url: Proxy URL (e.g., 'http://user:pass@host:port')
            proxy_type: Proxy type ('http', 'https', 'socks4', 'socks5')

        Returns:
            Proxy configuration result
        """
        browser = get_browser()
        return await browser.send_command("set_proxy", proxy_url=proxy_url, proxy_type=proxy_type)


    @mcp.tool
    async def browser_tor_new_identity() -> Dict[str, Any]:
        """
        Get a new Tor identity (new circuit/exit node).

        Returns:
            New identity result with new exit IP
        """
        browser = get_browser()
        return await browser.send_command("tor_rebuild_circuit")


    @mcp.tool
    async def browser_tor_set_exit_country(country_code: str) -> Dict[str, Any]:
        """
        Set preferred Tor exit node country.

        Args:
            country_code: Two-letter country code (e.g., 'US', 'DE', 'JP')

        Returns:
            Configuration result
        """
        browser = get_browser()
        return await browser.send_command("tor_set_exit_country", country_code=country_code)


    # ==================== Data Detection & Ingestion (Phase 13) ====================

    @mcp.tool
    async def browser_detect_data_types(
        types: Optional[List[str]] = None,
        confidence_threshold: float = 0.5
    ) -> Dict[str, Any]:
        """
        Detect OSINT-relevant data types on the current page.

        Detects emails, phone numbers, cryptocurrency addresses, social media handles,
        IP addresses, domains, and more.

        Args:
            types: Optional list of specific types to detect
            confidence_threshold: Minimum confidence score (0.0-1.0)

        Returns:
            Detected data with types, values, and confidence scores
        """
        browser = get_browser()
        params = {}
        if types:
            params["types"] = types
        if confidence_threshold:
            params["confidence_threshold"] = confidence_threshold
        return await browser.send_command("detect_data_types", **params)


    @mcp.tool
    async def browser_ingest_selected(item_ids: List[str]) -> Dict[str, Any]:
        """
        Ingest selected detected data items for OSINT storage.

        Args:
            item_ids: List of item IDs from detect_data_types results

        Returns:
            Ingestion result with orphan data
        """
        browser = get_browser()
        return await browser.send_command("ingest_selected", item_ids=item_ids)


    @mcp.tool
    async def browser_get_ingestion_stats() -> Dict[str, Any]:
        """
        Get statistics about detected and ingested data.

        Returns:
            Detection and ingestion statistics
        """
        browser = get_browser()
        return await browser.send_command("get_ingestion_stats")


    # ==================== Image Analysis (Phase 14) ====================

    @mcp.tool
    async def browser_extract_image_metadata(image_url: str) -> Dict[str, Any]:
        """
        Extract metadata from an image.

        Extracts EXIF, IPTC, XMP data including GPS coordinates, camera info, etc.

        Args:
            image_url: URL of the image to analyze

        Returns:
            Image metadata including EXIF, GPS, and OSINT-relevant data
        """
        browser = get_browser()
        return await browser.send_command("extract_image_metadata", imageUrl=image_url)


    @mcp.tool
    async def browser_extract_image_text(image_url: str, language: str = "eng") -> Dict[str, Any]:
        """
        Extract text from an image using OCR.

        Args:
            image_url: URL of the image
            language: OCR language code (default: 'eng')

        Returns:
            Extracted text with confidence and bounding boxes
        """
        browser = get_browser()
        return await browser.send_command("extract_image_text", imageUrl=image_url, language=language)


    @mcp.tool
    async def browser_get_page_images_with_metadata(limit: int = 20) -> Dict[str, Any]:
        """
        Get all images from the page with their metadata.

        Args:
            limit: Maximum number of images to process

        Returns:
            List of images with metadata and OSINT data
        """
        browser = get_browser()
        return await browser.send_command("extract_page_images", options={"extractMetadata": True, "limit": limit})


    # ==================== Technology Detection ====================

    @mcp.tool
    async def browser_detect_technologies() -> Dict[str, Any]:
        """
        Detect technologies used on the current page.

        Identifies frameworks, CMS, analytics, servers, and more.

        Returns:
            Detected technologies with confidence scores
        """
        browser = get_browser()
        return await browser.send_command("detect_technologies")


    # ==================== Network Analysis ====================

    @mcp.tool
    async def browser_start_network_capture() -> Dict[str, Any]:
        """
        Start capturing network traffic.

        Returns:
            Capture session ID
        """
        browser = get_browser()
        return await browser.send_command("start_network_capture")


    @mcp.tool
    async def browser_stop_network_capture() -> Dict[str, Any]:
        """
        Stop capturing network traffic.

        Returns:
            Capture summary with request count
        """
        browser = get_browser()
        return await browser.send_command("stop_network_capture")


    @mcp.tool
    async def browser_get_network_requests(
        domain: Optional[str] = None,
        content_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get captured network requests.

        Args:
            domain: Optional domain filter
            content_type: Optional content type filter

        Returns:
            List of network requests
        """
        browser = get_browser()
        params = {}
        if domain:
            params["domain"] = domain
        if content_type:
            params["content_type"] = content_type
        return await browser.send_command("get_network_requests", **params)


    # ==================== Sock Puppet Tools (Phase 16) ====================

    @mcp.tool
    async def browser_list_sock_puppets(
        limit: int = 100,
        offset: int = 0,
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        List all sock puppet identities from basset-hound.

        Args:
            limit: Maximum number of sock puppets to return
            offset: Offset for pagination
            search: Optional search query

        Returns:
            List of sock puppet entities
        """
        browser = get_browser()
        params = {"limit": limit, "offset": offset}
        if search:
            params["search"] = search
        return await browser.send_command("list_sock_puppets", **params)


    @mcp.tool
    async def browser_get_sock_puppet(sock_puppet_id: str) -> Dict[str, Any]:
        """
        Get details of a specific sock puppet identity.

        Args:
            sock_puppet_id: The basset-hound entity ID for the sock puppet

        Returns:
            Sock puppet entity data
        """
        browser = get_browser()
        return await browser.send_command("get_sock_puppet", sockPuppetId=sock_puppet_id)


    @mcp.tool
    async def browser_link_profile_to_sock_puppet(
        profile_id: str,
        sock_puppet_id: str
    ) -> Dict[str, Any]:
        """
        Link a browser profile to a sock puppet identity.

        This applies the sock puppet's fingerprint and proxy configuration to the profile.

        Args:
            profile_id: Browser profile ID
            sock_puppet_id: Basset-hound sock puppet entity ID

        Returns:
            Link result with profile and sock puppet info
        """
        browser = get_browser()
        return await browser.send_command(
            "link_profile_to_sock_puppet",
            profileId=profile_id,
            sockPuppetId=sock_puppet_id
        )


    @mcp.tool
    async def browser_create_profile_from_sock_puppet(sock_puppet_id: str) -> Dict[str, Any]:
        """
        Create a new browser profile from a sock puppet identity.

        Creates an isolated browser profile with fingerprint and proxy settings
        from the sock puppet entity.

        Args:
            sock_puppet_id: Basset-hound sock puppet entity ID

        Returns:
            Created profile with sock puppet link
        """
        browser = get_browser()
        return await browser.send_command(
            "create_profile_from_sock_puppet",
            sockPuppetId=sock_puppet_id
        )


    @mcp.tool
    async def browser_fill_form_with_sock_puppet(
        field_mapping: Dict[str, str],
        profile_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fill form fields using credentials from the linked sock puppet.

        Uses human-like typing simulation for form filling.

        Args:
            field_mapping: Map of CSS selectors to credential fields.
                Example: {"#email": "email", "#password": "password", "#username": "username"}
                Available fields: username, email, password, phone, first_name, last_name, etc.
            profile_id: Optional profile ID (uses active profile if not specified)

        Returns:
            Fill result with success status per field
        """
        browser = get_browser()
        params = {"fieldMapping": field_mapping}
        if profile_id:
            params["profileId"] = profile_id
        return await browser.send_command("fill_form_with_sock_puppet", **params)


    @mcp.tool
    async def browser_start_sock_puppet_session(
        profile_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Start an activity tracking session for a sock puppet profile.

        All browser activities will be logged and synced to basset-hound.

        Args:
            profile_id: Optional profile ID (uses active profile if not specified)
            metadata: Optional session metadata

        Returns:
            Session info with ID and start time
        """
        browser = get_browser()
        params = {}
        if profile_id:
            params["profileId"] = profile_id
        if metadata:
            params["metadata"] = metadata
        return await browser.send_command("start_sock_puppet_session", **params)


    @mcp.tool
    async def browser_end_sock_puppet_session(
        profile_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        End an activity tracking session and sync activities to basset-hound.

        Args:
            profile_id: Optional profile ID (uses active profile if not specified)

        Returns:
            Session summary with duration and activity count
        """
        browser = get_browser()
        params = {}
        if profile_id:
            params["profileId"] = profile_id
        return await browser.send_command("end_sock_puppet_session", **params)


    @mcp.tool
    async def browser_get_sock_puppet_activity_log(
        sock_puppet_id: str,
        limit: int = 100,
        activity_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get activity log for a sock puppet.

        Args:
            sock_puppet_id: Basset-hound sock puppet entity ID
            limit: Maximum activities to return
            activity_type: Optional filter by activity type (login, page_visit, form_fill, etc.)

        Returns:
            List of activities with timestamps and details
        """
        browser = get_browser()
        params = {"sockPuppetId": sock_puppet_id, "limit": limit}
        if activity_type:
            params["type"] = activity_type
        return await browser.send_command("get_sock_puppet_activity_log", **params)


    @mcp.tool
    async def browser_validate_sock_puppet_fingerprint(sock_puppet_id: str) -> Dict[str, Any]:
        """
        Validate fingerprint consistency for a sock puppet profile.

        Checks that User-Agent, platform, WebGL, and other fingerprint elements
        are internally consistent.

        Args:
            sock_puppet_id: Basset-hound sock puppet entity ID

        Returns:
            Validation result with any consistency issues found
        """
        browser = get_browser()
        return await browser.send_command(
            "validate_sock_puppet_fingerprint",
            sockPuppetId=sock_puppet_id
        )


    @mcp.tool
    async def browser_get_sock_puppet_stats() -> Dict[str, Any]:
        """
        Get statistics about sock puppet usage.

        Returns:
            Stats including linked profiles, active sessions, and activity counts
        """
        browser = get_browser()
        return await browser.send_command("get_sock_puppet_stats")


    # ==================== Fingerprint Profile Tools (Phase 17) ====================

    @mcp.tool
    async def browser_create_fingerprint_profile(
        platform: Optional[str] = None,
        timezone: Optional[str] = None,
        tier: Optional[str] = None,
        seed: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new internally consistent fingerprint profile.

        Creates a fingerprint where all elements (UA, platform, WebGL, screen, timezone)
        match each other realistically to avoid detection.

        Args:
            platform: Target platform ('windows', 'macos', 'linux')
            timezone: IANA timezone name (e.g., 'America/New_York')
            tier: Hardware tier ('low', 'medium', 'high', 'workstation')
            seed: Optional seed for reproducible profiles

        Returns:
            Created fingerprint profile with validation status
        """
        browser = get_browser()
        params = {}
        if platform:
            params["platform"] = platform
        if timezone:
            params["timezone"] = timezone
        if tier:
            params["tier"] = tier
        if seed:
            params["seed"] = seed
        return await browser.send_command("create_fingerprint_profile", **params)


    @mcp.tool
    async def browser_create_regional_fingerprint(
        region: str,
        profile_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a fingerprint profile optimized for a specific region.

        Args:
            region: Region code ('US', 'UK', 'EU', 'RU', 'JP', 'CN', 'AU')
            profile_id: Optional custom profile ID

        Returns:
            Created fingerprint profile for the region
        """
        browser = get_browser()
        params = {"region": region}
        if profile_id:
            params["id"] = profile_id
        return await browser.send_command("create_regional_fingerprint", **params)


    @mcp.tool
    async def browser_list_fingerprint_profiles() -> Dict[str, Any]:
        """
        List all fingerprint profiles.

        Returns:
            List of profiles with their configurations
        """
        browser = get_browser()
        return await browser.send_command("list_fingerprint_profiles")


    @mcp.tool
    async def browser_apply_fingerprint(profile_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Apply a fingerprint profile to the current page.

        Injects scripts to override navigator, screen, WebGL, and other fingerprinting vectors.

        Args:
            profile_id: Profile to apply (uses active if not specified)

        Returns:
            Application result with applied settings
        """
        browser = get_browser()
        params = {}
        if profile_id:
            params["profileId"] = profile_id
        return await browser.send_command("apply_fingerprint", **params)


    @mcp.tool
    async def browser_get_fingerprint_options() -> Dict[str, Any]:
        """
        Get available fingerprint options.

        Returns:
            Available platforms, timezones, and hardware tiers
        """
        browser = get_browser()
        return await browser.send_command("get_fingerprint_options")


    # ==================== Behavioral AI Tools (Phase 17) ====================

    @mcp.tool
    async def browser_create_behavioral_profile(
        session_id: Optional[str] = None,
        speed_multiplier: Optional[float] = None,
        accuracy_level: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Create a behavioral profile for human-like interactions.

        Each profile has consistent typing speed, mouse movement patterns, and fatigue simulation.

        Args:
            session_id: Optional session identifier
            speed_multiplier: Speed factor (0.5-1.5, default random)
            accuracy_level: Accuracy level (0.8-1.0, default random)

        Returns:
            Created behavioral profile configuration
        """
        browser = get_browser()
        params = {}
        if session_id:
            params["sessionId"] = session_id
        if speed_multiplier:
            params["speedMultiplier"] = speed_multiplier
        if accuracy_level:
            params["accuracyLevel"] = accuracy_level
        return await browser.send_command("create_behavioral_profile", **params)


    @mcp.tool
    async def browser_generate_mouse_path(
        start_x: int,
        start_y: int,
        end_x: int,
        end_y: int,
        session_id: Optional[str] = None,
        target_width: int = 20
    ) -> Dict[str, Any]:
        """
        Generate a human-like mouse movement path using Fitts's Law.

        Creates a path with minimum-jerk trajectory, physiological tremor,
        and optional overshoot/correction.

        Args:
            start_x: Starting X coordinate
            start_y: Starting Y coordinate
            end_x: Ending X coordinate
            end_y: Ending Y coordinate
            session_id: Behavioral session for consistent characteristics
            target_width: Width of target element (affects movement time)

        Returns:
            Path points with timing information
        """
        browser = get_browser()
        params = {
            "start": {"x": start_x, "y": start_y},
            "end": {"x": end_x, "y": end_y},
            "targetWidth": target_width
        }
        if session_id:
            params["sessionId"] = session_id
        return await browser.send_command("generate_mouse_path", **params)


    @mcp.tool
    async def browser_generate_typing_events(
        text: str,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate human-like typing events with biometric patterns.

        Simulates realistic inter-key intervals, hand alternation speed-ups,
        digraph patterns, and occasional typos with corrections.

        Args:
            text: Text to generate typing events for
            session_id: Behavioral session for consistent typing speed

        Returns:
            Typing events with keydown/keyup and timing
        """
        browser = get_browser()
        params = {"text": text}
        if session_id:
            params["sessionId"] = session_id
        return await browser.send_command("generate_typing_events", **params)


    @mcp.tool
    async def browser_check_honeypot(
        selector: str
    ) -> Dict[str, Any]:
        """
        Check if a form field is a honeypot trap.

        Detects hidden fields, suspicious names, and other honeypot indicators.

        Args:
            selector: CSS selector for the element to check

        Returns:
            Detection result with indicators and confidence
        """
        browser = get_browser()
        return await browser.send_command("check_honeypot_selector", selector=selector)


    @mcp.tool
    async def browser_get_rate_limit_delay(domain: str) -> Dict[str, Any]:
        """
        Get recommended delay before next request to a domain.

        Uses adaptive rate limiting with exponential backoff.

        Args:
            domain: Domain to get delay for

        Returns:
            Recommended delay in milliseconds with current state
        """
        browser = get_browser()
        return await browser.send_command("get_rate_limit_state", domain=domain)


    @mcp.tool
    async def browser_record_rate_limit(
        domain: str,
        retry_after: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Record a rate limit hit for adaptive throttling.

        Args:
            domain: Domain that rate limited
            retry_after: Optional Retry-After header value in seconds

        Returns:
            Updated delay recommendation
        """
        browser = get_browser()
        params = {"domain": domain}
        if retry_after:
            params["retryAfter"] = retry_after
        return await browser.send_command("record_rate_limit", **params)


    # ==================== Evidence Collection Tools (Phase 18) ====================

    @mcp.tool
    async def browser_create_evidence_package(
        name: str,
        description: Optional[str] = None,
        investigation_id: Optional[str] = None,
        case_number: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Create a new evidence package for collecting forensic evidence.

        Args:
            name: Package name
            description: Package description
            investigation_id: Associated investigation ID
            case_number: Legal case number
            tags: Optional tags for categorization

        Returns:
            Created package with ID
        """
        browser = get_browser()
        params = {"name": name}
        if description:
            params["description"] = description
        if investigation_id:
            params["investigationId"] = investigation_id
        if case_number:
            params["caseNumber"] = case_number
        if tags:
            params["tags"] = tags
        return await browser.send_command("create_evidence_package", **params)


    @mcp.tool
    async def browser_capture_screenshot_evidence(
        url: Optional[str] = None,
        title: Optional[str] = None,
        full_page: bool = False,
        annotations: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Capture a screenshot as court-ready evidence.

        Creates a SHA-256 hashed screenshot with chain of custody.

        Args:
            url: URL being captured (for metadata)
            title: Page title (for metadata)
            full_page: Capture entire scrollable page
            annotations: Optional annotations to add

        Returns:
            Evidence record with hash and custody chain
        """
        browser = get_browser()
        # First take the screenshot
        screenshot_result = await browser.send_command("screenshot", full_page=full_page)
        if not screenshot_result.get("success"):
            return screenshot_result

        # Then add as evidence
        params = {
            "imageData": screenshot_result.get("data"),
            "url": url,
            "title": title,
            "fullPage": full_page,
            "annotations": annotations or []
        }
        return await browser.send_command("capture_screenshot_evidence", **params)


    @mcp.tool
    async def browser_capture_page_archive_evidence(
        format: str = "mhtml",
        url: Optional[str] = None,
        title: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Capture page archive as evidence.

        Archives the page content with integrity hash.

        Args:
            format: Archive format ('mhtml', 'html', 'warc', 'pdf')
            url: URL being captured (for metadata)
            title: Page title (for metadata)

        Returns:
            Evidence record with hash and custody chain
        """
        browser = get_browser()
        params = {"format": format}
        if url:
            params["url"] = url
        if title:
            params["title"] = title
        return await browser.send_command("capture_page_archive_evidence", **params)


    @mcp.tool
    async def browser_capture_har_evidence(
        url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Capture network HAR as evidence.

        Captures HTTP Archive with request/response details.

        Args:
            url: URL being captured (for metadata)

        Returns:
            Evidence record with hash and custody chain
        """
        browser = get_browser()
        # Get HAR data
        har_result = await browser.send_command("export_har")
        if not har_result.get("success"):
            return har_result

        params = {
            "harData": har_result.get("har"),
            "url": url
        }
        return await browser.send_command("capture_har_evidence", **params)


    @mcp.tool
    async def browser_seal_evidence_package(
        package_id: Optional[str] = None,
        sealed_by: str = "investigator"
    ) -> Dict[str, Any]:
        """
        Seal an evidence package (no more modifications allowed).

        Creates a package-level hash for integrity verification.

        Args:
            package_id: Package to seal (uses active if not specified)
            sealed_by: Identity of person sealing the package

        Returns:
            Seal result with package hash
        """
        browser = get_browser()
        params = {"sealedBy": sealed_by}
        if package_id:
            params["packageId"] = package_id
        return await browser.send_command("seal_evidence_package", **params)


    @mcp.tool
    async def browser_verify_evidence_package(package_id: str) -> Dict[str, Any]:
        """
        Verify integrity of an evidence package.

        Checks all evidence hashes and package integrity.

        Args:
            package_id: Package to verify

        Returns:
            Verification result with any integrity issues
        """
        browser = get_browser()
        return await browser.send_command("verify_evidence_package", packageId=package_id)


    @mcp.tool
    async def browser_export_evidence_for_court(package_id: str) -> Dict[str, Any]:
        """
        Export evidence package in court-ready format.

        Includes certification statement, chain of custody, and verification.

        Args:
            package_id: Package to export

        Returns:
            Court-ready evidence export
        """
        browser = get_browser()
        return await browser.send_command("export_for_court", packageId=package_id)


    @mcp.tool
    async def browser_list_evidence_packages() -> Dict[str, Any]:
        """
        List all evidence packages.

        Returns:
            List of packages with summaries
        """
        browser = get_browser()
        return await browser.send_command("list_evidence_packages")


    @mcp.tool
    async def browser_get_evidence_stats() -> Dict[str, Any]:
        """
        Get evidence collection statistics.

        Returns:
            Stats including package counts and evidence totals
        """
        browser = get_browser()
        return await browser.send_command("get_evidence_stats")


    @mcp.tool
    async def browser_add_evidence_annotation(
        text: str,
        author: str,
        package_id: Optional[str] = None,
        evidence_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Add annotation to an evidence package.

        Args:
            text: Annotation text
            author: Annotation author
            package_id: Package to annotate (uses active if not specified)
            evidence_ids: Optional list of evidence IDs this annotation references

        Returns:
            Annotation result
        """
        browser = get_browser()
        params = {"text": text, "author": author}
        if package_id:
            params["packageId"] = package_id
        if evidence_ids:
            params["evidenceIds"] = evidence_ids
        return await browser.send_command("add_package_annotation", **params)


    # ==================== OSINT Agent Tools (Phase 12) ====================

    @mcp.tool
    async def browser_create_investigation(
        name: str,
        description: Optional[str] = None,
        case_number: Optional[str] = None,
        max_depth: int = 2,
        max_pages: int = 100,
        delay_ms: int = 1000,
        patterns: Optional[List[str]] = None,
        data_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Create a new OSINT investigation.

        An investigation tracks visited pages, extracted data, and evidence
        across multiple pages with configurable depth and patterns.

        Args:
            name: Investigation name
            description: Investigation description
            case_number: Associated case number
            max_depth: Maximum link-following depth (default 2)
            max_pages: Maximum pages to visit (default 100)
            delay_ms: Delay between requests in ms (default 1000)
            patterns: URL patterns to follow (regex)
            data_types: OSINT data types to extract

        Returns:
            Created investigation with ID and configuration
        """
        browser = get_browser()
        params = {
            "name": name,
            "maxDepth": max_depth,
            "maxPages": max_pages,
            "delayMs": delay_ms
        }
        if description:
            params["description"] = description
        if case_number:
            params["caseNumber"] = case_number
        if patterns:
            params["patterns"] = patterns
        if data_types:
            params["dataTypes"] = data_types
        return await browser.send_command("create_investigation", **params)


    @mcp.tool
    async def browser_extract_osint_data(
        types: Optional[List[str]] = None,
        add_to_investigation: bool = True
    ) -> Dict[str, Any]:
        """
        Extract OSINT data from the current page.

        Extracts emails, phones, crypto addresses, social handles, IPs, domains,
        and other OSINT-relevant data with context and confidence scores.

        Args:
            types: Specific data types to extract (default: all)
            add_to_investigation: Add findings to active investigation

        Returns:
            Extracted data with type, value, context, and confidence
        """
        browser = get_browser()
        params = {"addToInvestigation": add_to_investigation}
        if types:
            params["types"] = types
        return await browser.send_command("extract_osint_data", **params)


    @mcp.tool
    async def browser_investigate_page(
        capture_evidence: bool = True,
        extract_data: bool = True,
        follow_links: bool = False
    ) -> Dict[str, Any]:
        """
        Run full OSINT investigation on current page.

        Combines OSINT data extraction, evidence capture, and optional
        link queueing into a single operation.

        Args:
            capture_evidence: Capture screenshot evidence (default True)
            extract_data: Extract OSINT data (default True)
            follow_links: Queue links for further investigation (default False)

        Returns:
            Investigation results with data, evidence, and queued links
        """
        browser = get_browser()
        return await browser.send_command("investigate_page", **{
            "captureEvidence": capture_evidence,
            "extractData": extract_data,
            "followLinks": follow_links
        })


    @mcp.tool
    async def browser_investigate_links(
        patterns: Optional[List[str]] = None,
        max_links: int = 50,
        follow_external: bool = True
    ) -> Dict[str, Any]:
        """
        Queue links from current page for investigation.

        Extracts links matching patterns and adds them to the investigation queue.

        Args:
            patterns: URL patterns to match (regex)
            max_links: Maximum links to queue (default 50)
            follow_external: Follow external domain links (default True)

        Returns:
            Number of links queued and queue status
        """
        browser = get_browser()
        params = {"maxLinks": max_links, "followExternal": follow_external}
        if patterns:
            params["patterns"] = patterns
        return await browser.send_command("investigate_links", **params)


    @mcp.tool
    async def browser_get_next_investigation_url() -> Dict[str, Any]:
        """
        Get the next URL from the investigation queue.

        Returns the next URL to visit with its depth and source information.

        Returns:
            Next URL to investigate or indication queue is empty
        """
        browser = get_browser()
        return await browser.send_command("get_next_investigation_url")


    @mcp.tool
    async def browser_get_investigation_findings(
        investigation_id: Optional[str] = None,
        finding_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get findings from an investigation.

        Retrieves extracted OSINT data with optional filtering.

        Args:
            investigation_id: Investigation ID (uses active if not specified)
            finding_type: Filter by type (email, phone, crypto_btc, etc.)
            limit: Maximum findings to return (default 100)
            offset: Pagination offset (default 0)

        Returns:
            Findings with type, value, source, and provenance
        """
        browser = get_browser()
        params = {"limit": limit, "offset": offset}
        if investigation_id:
            params["id"] = investigation_id
        if finding_type:
            params["type"] = finding_type
        return await browser.send_command("get_investigation_findings", **params)


    @mcp.tool
    async def browser_get_findings_summary(
        investigation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get summary of investigation findings.

        Provides counts by type, source distribution, and sensitive data alerts.

        Args:
            investigation_id: Investigation ID (uses active if not specified)

        Returns:
            Summary with counts by type, top sources, and sensitive data info
        """
        browser = get_browser()
        params = {}
        if investigation_id:
            params["id"] = investigation_id
        return await browser.send_command("get_findings_summary", **params)


    @mcp.tool
    async def browser_prepare_for_basset_hound(
        investigation_id: Optional[str] = None,
        types: Optional[List[str]] = None,
        include_sensitive: bool = False
    ) -> Dict[str, Any]:
        """
        Prepare investigation findings for basset-hound ingestion.

        Converts findings to basset-hound orphan format for API ingestion.

        Args:
            investigation_id: Investigation ID (uses active if not specified)
            types: Filter by finding types
            include_sensitive: Include SSN/credit card data (default False)

        Returns:
            Orphans ready for basset-hound API with provenance
        """
        browser = get_browser()
        params = {"includeSensitive": include_sensitive}
        if investigation_id:
            params["id"] = investigation_id
        if types:
            params["types"] = types
        return await browser.send_command("prepare_for_basset_hound", **params)


    @mcp.tool
    async def browser_complete_investigation(
        investigation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Complete an investigation.

        Marks the investigation as complete and returns final statistics.

        Args:
            investigation_id: Investigation ID (uses active if not specified)

        Returns:
            Final investigation stats and completion timestamp
        """
        browser = get_browser()
        params = {}
        if investigation_id:
            params["id"] = investigation_id
        return await browser.send_command("complete_investigation", **params)


    @mcp.tool
    async def browser_export_investigation(
        investigation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Export complete investigation data.

        Exports all findings, evidence, visited URLs, and metadata.

        Args:
            investigation_id: Investigation ID (uses active if not specified)

        Returns:
            Complete investigation export
        """
        browser = get_browser()
        params = {}
        if investigation_id:
            params["id"] = investigation_id
        return await browser.send_command("export_investigation", **params)


    @mcp.tool
    async def browser_list_investigations() -> Dict[str, Any]:
        """
        List all investigations.

        Returns:
            List of investigations with status and statistics
        """
        browser = get_browser()
        return await browser.send_command("list_investigations")


    @mcp.tool
    async def browser_get_osint_data_types() -> Dict[str, Any]:
        """
        Get available OSINT data types for extraction.

        Returns:
            Available types with their basset-hound mappings
        """
        browser = get_browser()
        return await browser.send_command("get_osint_data_types")


# ==================== MCP Resources ====================

if mcp:
    @mcp.resource("browser://status")
    async def get_browser_status() -> str:
        """Get the current browser connection status."""
        browser = get_browser()
        try:
            if browser.ws and browser.ws.open:
                result = await browser.send_command("get_page_state")
                return json.dumps({
                    "connected": True,
                    "url": result.get("url"),
                    "title": result.get("title")
                }, indent=2)
        except Exception:
            pass

        return json.dumps({
            "connected": False,
            "url": None,
            "title": None
        }, indent=2)


    @mcp.resource("browser://current-page")
    async def get_current_page() -> str:
        """Get the current page content as text."""
        browser = get_browser()
        try:
            result = await browser.send_command("get_content", content_type="text")
            return result.get("content", "")
        except Exception as e:
            return f"Error: {e}"


# ==================== Main Entry Point ====================

def main():
    """Run the MCP server."""
    if not FASTMCP_AVAILABLE:
        print("Error: FastMCP is required. Install with: pip install fastmcp")
        print("Also install websockets: pip install websockets")
        return 1

    print("Starting Basset Hound Browser MCP Server...")
    print(f"Connecting to browser at ws://{DEFAULT_WS_HOST}:{DEFAULT_WS_PORT}")
    print("\nAvailable tools (88 total):")
    print("  Navigation: browser_navigate, browser_go_back, browser_go_forward, browser_reload")
    print("  Interaction: browser_click, browser_fill, browser_type, browser_select, browser_scroll")
    print("  Extraction: browser_get_content, browser_get_page_state, browser_extract_*")
    print("  Screenshots: browser_screenshot")
    print("  Cookies: browser_get_cookies, browser_set_cookies, browser_clear_cookies")
    print("  Profiles: browser_get_profiles, browser_switch_profile, browser_create_profile")
    print("  Proxy/Tor: browser_set_proxy, browser_tor_new_identity, browser_tor_set_exit_country")
    print("  Data Detection: browser_detect_data_types, browser_ingest_selected")
    print("  Image Analysis: browser_extract_image_metadata, browser_extract_image_text")
    print("  Network: browser_start_network_capture, browser_get_network_requests")
    print("  Tech Detection: browser_detect_technologies")
    print("  Sock Puppets: browser_list_sock_puppets, browser_fill_form_with_sock_puppet")
    print("  Sessions: browser_start_sock_puppet_session, browser_end_sock_puppet_session")
    print("  Fingerprints: browser_create_fingerprint_profile, browser_apply_fingerprint")
    print("  Behavioral AI: browser_generate_mouse_path, browser_generate_typing_events")
    print("  Evidence: browser_create_evidence_package, browser_capture_screenshot_evidence")
    print("  Court Export: browser_seal_evidence_package, browser_export_evidence_for_court")
    print("  OSINT: browser_create_investigation, browser_extract_osint_data, browser_investigate_page")
    print("  Investigation: browser_investigate_links, browser_get_investigation_findings")
    print()

    mcp.run()


if __name__ == "__main__":
    main()

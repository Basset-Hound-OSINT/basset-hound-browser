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
        description="Browser automation with anti-detection evasion and evidence collection"
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
    print("\nAvailable tools (61 total):")
    print("  Navigation: browser_navigate, browser_go_back, browser_go_forward, browser_reload")
    print("  Interaction: browser_click, browser_fill, browser_type, browser_select, browser_scroll, browser_hover")
    print("  Extraction: browser_get_content, browser_get_page_state, browser_extract_*")
    print("  Screenshots: browser_screenshot")
    print("  Wait: browser_wait_for_element, browser_wait_for_navigation")
    print("  JavaScript: browser_execute_script")
    print("  Cookies: browser_get_cookies, browser_set_cookies, browser_clear_cookies")
    print("  Profiles: browser_get_profiles, browser_switch_profile, browser_create_profile")
    print("  Proxy/Tor: browser_set_proxy, browser_tor_new_identity, browser_tor_set_exit_country")
    print("  Image Analysis: browser_extract_image_metadata, browser_extract_image_text")
    print("  Network: browser_start_network_capture, browser_get_network_requests")
    print("  Tech Detection: browser_detect_technologies")
    print("  Fingerprints: browser_create_fingerprint_profile, browser_apply_fingerprint")
    print("  Behavioral AI: browser_generate_mouse_path, browser_generate_typing_events")
    print("  Evidence: browser_create_evidence_package, browser_capture_screenshot_evidence")
    print("  Court Export: browser_seal_evidence_package, browser_export_evidence_for_court")
    print()

    mcp.run()


if __name__ == "__main__":
    main()

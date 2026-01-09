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


    @mcp.tool
    async def browser_screenshot_with_highlights(
        selectors: List[str],
        full_page: bool = False,
        highlight_color: str = "#FFFF00",
        highlight_opacity: float = 0.3,
        format: str = "png"
    ) -> Dict[str, Any]:
        """
        Capture screenshot with element highlights for forensic documentation.

        Highlights specified elements with colored overlays, useful for documenting
        specific UI elements or areas of interest in investigations.

        Args:
            selectors: List of CSS selectors to highlight
            full_page: If True, capture entire scrollable page
            highlight_color: Highlight color (default: yellow)
            highlight_opacity: Highlight opacity 0-1 (default: 0.3)
            format: Output format ('png', 'jpeg', 'webp')

        Returns:
            Screenshot with highlighted elements
        """
        browser = get_browser()
        return await browser.send_command(
            "capture_screenshot_with_highlights",
            selectors=selectors,
            options={
                "fullPage": full_page,
                "highlightColor": highlight_color,
                "highlightOpacity": highlight_opacity,
                "format": format
            }
        )


    @mcp.tool
    async def browser_screenshot_with_blur(
        blur_patterns: Optional[List[str]] = None,
        custom_selectors: Optional[List[str]] = None,
        full_page: bool = False,
        blur_intensity: int = 10,
        format: str = "png"
    ) -> Dict[str, Any]:
        """
        Capture screenshot with automatic PII blurring for privacy protection.

        Automatically detects and blurs sensitive information like emails, phone numbers,
        SSNs, credit cards, and IP addresses. Essential for sharing screenshots while
        protecting privacy.

        Args:
            blur_patterns: PII patterns to detect ('email', 'phone', 'ssn', 'creditCard', 'ipAddress')
            custom_selectors: Additional CSS selectors to blur
            full_page: If True, capture entire scrollable page
            blur_intensity: Blur strength 1-20 (default: 10)
            format: Output format ('png', 'jpeg', 'webp')

        Returns:
            Screenshot with sensitive data blurred
        """
        browser = get_browser()
        options = {
            "fullPage": full_page,
            "blurIntensity": blur_intensity,
            "format": format
        }
        if blur_patterns:
            options["blurPatterns"] = blur_patterns
        if custom_selectors:
            options["customSelectors"] = custom_selectors
        return await browser.send_command("capture_screenshot_with_blur", options=options)


    @mcp.tool
    async def browser_screenshot_diff(
        image_data1: str,
        image_data2: str,
        threshold: float = 0.1,
        highlight_color: str = "#FF0000"
    ) -> Dict[str, Any]:
        """
        Compare two screenshots and generate visual diff for change detection.

        Useful for regression testing, monitoring website changes, or forensic
        comparison of different page states.

        Args:
            image_data1: First screenshot base64 data
            image_data2: Second screenshot base64 data
            threshold: Difference sensitivity 0-1 (default: 0.1)
            highlight_color: Color for highlighting differences (default: red)

        Returns:
            Comparison result with diff image and difference percentage
        """
        browser = get_browser()
        return await browser.send_command(
            "capture_screenshot_diff",
            imageData1=image_data1,
            imageData2=image_data2,
            options={
                "threshold": threshold,
                "highlightColor": highlight_color
            }
        )


    @mcp.tool
    async def browser_screenshot_stitch(
        image_datas: List[str],
        direction: str = "vertical",
        gap: int = 0,
        format: str = "png"
    ) -> Dict[str, Any]:
        """
        Stitch multiple screenshots into a single image for comprehensive documentation.

        Combines multiple screenshots into one image, useful for creating
        comprehensive visual documentation or timelines.

        Args:
            image_datas: List of screenshot base64 data to stitch
            direction: Stitch direction ('vertical' or 'horizontal')
            gap: Gap between images in pixels (default: 0)
            format: Output format ('png', 'jpeg', 'webp')

        Returns:
            Stitched screenshot result
        """
        browser = get_browser()
        return await browser.send_command(
            "stitch_screenshots",
            imageDatas=image_datas,
            options={
                "direction": direction,
                "gap": gap,
                "format": format
            }
        )


    @mcp.tool
    async def browser_screenshot_ocr(
        image_data: str,
        language: str = "eng",
        overlay: bool = False,
        highlight_matches: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract text from screenshot using OCR for text analysis and search.

        Extracts all visible text from a screenshot with position coordinates,
        useful for automated text extraction from images in investigations.

        Args:
            image_data: Screenshot base64 data
            language: OCR language code (default: 'eng')
            overlay: If True, return image with text overlay annotations
            highlight_matches: Optional text pattern to highlight in results

        Returns:
            Extracted text with coordinates and confidence scores
        """
        browser = get_browser()
        return await browser.send_command(
            "extract_text_from_screenshot",
            imageData=image_data,
            options={
                "language": language,
                "overlay": overlay,
                "highlightMatches": highlight_matches
            }
        )


    @mcp.tool
    async def browser_screenshot_similarity(
        image_data1: str,
        image_data2: str,
        method: str = "perceptual"
    ) -> Dict[str, Any]:
        """
        Calculate similarity score between two screenshots for duplicate detection.

        Compares screenshots to determine if they show the same or similar content.
        Useful for duplicate detection or verifying screenshot consistency.

        Args:
            image_data1: First screenshot base64 data
            image_data2: Second screenshot base64 data
            method: Comparison method ('perceptual', 'pixel', 'structural')

        Returns:
            Similarity score 0-1 (0=different, 1=identical) and analysis
        """
        browser = get_browser()
        return await browser.send_command(
            "compare_screenshots_similarity",
            imageData1=image_data1,
            imageData2=image_data2,
            options={"method": method}
        )


    @mcp.tool
    async def browser_screenshot_element_context(
        selector: str,
        context_padding: int = 50,
        highlight_element: bool = True,
        format: str = "png"
    ) -> Dict[str, Any]:
        """
        Capture element with surrounding context for detailed documentation.

        Captures a specific element along with its surrounding context,
        useful for documenting UI elements in their natural context.

        Args:
            selector: CSS selector of target element
            context_padding: Context padding around element in pixels (default: 50)
            highlight_element: Highlight the target element (default: True)
            format: Output format ('png', 'jpeg', 'webp')

        Returns:
            Screenshot of element with context
        """
        browser = get_browser()
        return await browser.send_command(
            "capture_element_screenshot_with_context",
            selector=selector,
            options={
                "contextPadding": context_padding,
                "highlightElement": highlight_element,
                "format": format
            }
        )


    @mcp.tool
    async def browser_screenshot_forensic(
        full_page: bool = False,
        format: str = "png",
        quality: float = 1.0
    ) -> Dict[str, Any]:
        """
        Capture forensic-quality screenshot with enriched metadata.

        Captures screenshot in lossless quality with comprehensive metadata
        including hash, timestamp, URL, and page context for forensic documentation.

        Args:
            full_page: If True, capture entire scrollable page
            format: Output format (default: 'png' for lossless)
            quality: Quality 0-1 (default: 1.0 for maximum)

        Returns:
            Screenshot with enriched metadata and integrity hash
        """
        browser = get_browser()
        # First capture the screenshot
        if full_page:
            result = await browser.send_command("screenshot", full_page=True)
        else:
            result = await browser.send_command("screenshot")

        if not result.get("success"):
            return result

        # Enrich with metadata
        return await browser.send_command(
            "enrich_screenshot_metadata",
            imageData=result.get("data"),
            metadata={
                "captureMode": "forensic",
                "quality": quality,
                "format": format
            }
        )


    @mcp.tool
    async def browser_screenshot_configure_quality(
        preset: str
    ) -> Dict[str, Any]:
        """
        Configure screenshot quality preset for different use cases.

        Available presets:
        - 'forensic': Lossless PNG for legal/forensic documentation
        - 'web': Balanced WebP for web sharing
        - 'thumbnail': Compressed JPEG for previews
        - 'archival': Maximum compression PNG for long-term storage

        Args:
            preset: Quality preset name

        Returns:
            Configured quality settings
        """
        browser = get_browser()
        return await browser.send_command("configure_screenshot_quality", preset=preset)


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


    # ==========================================
    # Network Forensics Tools (Phase 19)
    # ==========================================

    @mcp.tool
    async def browser_start_network_forensics_capture(
        max_dns_queries: int = 10000,
        max_certificates: int = 1000,
        max_websocket_connections: int = 100,
        collected_by: str = "MCP Agent"
    ) -> Dict[str, Any]:
        """
        Start network forensics capture.

        Captures DNS queries, TLS certificates, WebSocket connections,
        HTTP headers, cookies, and performance metrics with chain of custody.

        Args:
            max_dns_queries: Maximum DNS queries to store
            max_certificates: Maximum certificates to store
            max_websocket_connections: Maximum WebSocket connections to store
            collected_by: Name of entity collecting forensics

        Returns:
            Capture status with session ID
        """
        browser = get_browser()
        return await browser.send_command(
            "start_network_forensics_capture",
            options={
                "maxDnsQueries": max_dns_queries,
                "maxCertificates": max_certificates,
                "maxWebSocketConnections": max_websocket_connections,
                "collectedBy": collected_by,
            }
        )

    @mcp.tool
    async def browser_stop_network_forensics_capture() -> Dict[str, Any]:
        """
        Stop network forensics capture.

        Returns:
            Capture summary including duration and items captured
        """
        browser = get_browser()
        return await browser.send_command("stop_network_forensics_capture")

    @mcp.tool
    async def browser_get_dns_queries(
        hostname: Optional[str] = None,
        query_type: Optional[str] = None,
        cached: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Get captured DNS queries.

        Args:
            hostname: Filter by hostname (partial match)
            query_type: Filter by query type (A, AAAA, CNAME, etc.)
            cached: Filter by cached status

        Returns:
            List of DNS queries with metadata
        """
        browser = get_browser()
        filter_params = {}
        if hostname:
            filter_params["hostname"] = hostname
        if query_type:
            filter_params["type"] = query_type
        if cached is not None:
            filter_params["cached"] = cached

        return await browser.send_command("get_dns_queries", filter=filter_params)

    @mcp.tool
    async def browser_analyze_dns_queries() -> Dict[str, Any]:
        """
        Analyze captured DNS queries.

        Returns:
            Analysis including query counts, cache hit rate, response times,
            query types distribution, and top domains
        """
        browser = get_browser()
        return await browser.send_command("analyze_dns_queries")

    @mcp.tool
    async def browser_get_tls_certificates(
        hostname: Optional[str] = None,
        valid: Optional[bool] = None,
        protocol: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get captured TLS certificates.

        Args:
            hostname: Filter by hostname (partial match)
            valid: Filter by validity status
            protocol: Filter by protocol (e.g., 'TLS 1.3')

        Returns:
            List of certificates with full chain and validation status
        """
        browser = get_browser()
        filter_params = {}
        if hostname:
            filter_params["hostname"] = hostname
        if valid is not None:
            filter_params["valid"] = valid
        if protocol:
            filter_params["protocol"] = protocol

        return await browser.send_command("get_tls_certificates", filter=filter_params)

    @mcp.tool
    async def browser_analyze_tls_certificates() -> Dict[str, Any]:
        """
        Analyze captured TLS certificates.

        Returns:
            Analysis including protocol distribution, cipher usage,
            OCSP stapling rate, and certificate issues
        """
        browser = get_browser()
        return await browser.send_command("analyze_tls_certificates")

    @mcp.tool
    async def browser_get_websocket_connections(
        url: Optional[str] = None,
        state: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get captured WebSocket connections.

        Args:
            url: Filter by URL (partial match)
            state: Filter by state (open, closed, connecting)

        Returns:
            List of WebSocket connections with message counts and statistics
        """
        browser = get_browser()
        filter_params = {}
        if url:
            filter_params["url"] = url
        if state:
            filter_params["state"] = state

        return await browser.send_command("get_websocket_connections", filter=filter_params)

    @mcp.tool
    async def browser_analyze_websocket_connections() -> Dict[str, Any]:
        """
        Analyze WebSocket connections.

        Returns:
            Analysis including connection counts, message statistics,
            bytes transferred, and duration metrics
        """
        browser = get_browser()
        return await browser.send_command("analyze_websocket_connections")

    @mcp.tool
    async def browser_get_http_headers(
        url: Optional[str] = None,
        method: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get captured HTTP headers.

        Args:
            url: Filter by URL (partial match)
            method: Filter by HTTP method (GET, POST, etc.)

        Returns:
            List of HTTP headers including security headers
        """
        browser = get_browser()
        filter_params = {}
        if url:
            filter_params["url"] = url
        if method:
            filter_params["method"] = method

        return await browser.send_command("get_http_headers", filter=filter_params)

    @mcp.tool
    async def browser_analyze_http_headers() -> Dict[str, Any]:
        """
        Analyze HTTP headers.

        Returns:
            Analysis including security header coverage, method distribution,
            status code distribution, and security issues
        """
        browser = get_browser()
        return await browser.send_command("analyze_http_headers")

    @mcp.tool
    async def browser_get_cookies_with_provenance(
        domain: Optional[str] = None,
        secure: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Get captured cookies with provenance tracking.

        Args:
            domain: Filter by domain (partial match)
            secure: Filter by secure flag

        Returns:
            List of cookies with provenance information (who set them, when, how)
        """
        browser = get_browser()
        filter_params = {}
        if domain:
            filter_params["domain"] = domain
        if secure is not None:
            filter_params["secure"] = secure

        return await browser.send_command("get_cookies", filter=filter_params)

    @mcp.tool
    async def browser_get_cookie_provenance(domain: str, name: str) -> Dict[str, Any]:
        """
        Get detailed provenance for a specific cookie.

        Args:
            domain: Cookie domain
            name: Cookie name

        Returns:
            Cookie provenance including origin, modifications, and history
        """
        browser = get_browser()
        return await browser.send_command("get_cookie_provenance", domain=domain, name=name)

    @mcp.tool
    async def browser_analyze_cookies() -> Dict[str, Any]:
        """
        Analyze captured cookies.

        Returns:
            Analysis including security flags, SameSite usage,
            domain distribution, and security issues
        """
        browser = get_browser()
        return await browser.send_command("analyze_cookies")

    @mcp.tool
    async def browser_export_forensic_report(
        format: str = "json",
        include_dns: bool = True,
        include_certificates: bool = True,
        include_websocket: bool = True,
        include_headers: bool = True,
        include_cookies: bool = True,
        include_analysis: bool = True
    ) -> Dict[str, Any]:
        """
        Export comprehensive network forensics report.

        Args:
            format: Export format ('json', 'csv', 'html', 'timeline')
            include_dns: Include DNS queries
            include_certificates: Include TLS certificates
            include_websocket: Include WebSocket connections
            include_headers: Include HTTP headers
            include_cookies: Include cookies
            include_analysis: Include analysis sections

        Returns:
            Forensic report with chain of custody and cryptographic hashes
        """
        browser = get_browser()
        return await browser.send_command(
            "export_forensic_report",
            format=format,
            options={
                "includeDns": include_dns,
                "includeCertificates": include_certificates,
                "includeWebSocket": include_websocket,
                "includeHeaders": include_headers,
                "includeCookies": include_cookies,
                "includeAnalysis": include_analysis,
            }
        )

    @mcp.tool
    async def browser_get_network_forensics_stats() -> Dict[str, Any]:
        """
        Get network forensics statistics.

        Returns:
            Statistics for all captured forensics data including counts
            and capture status
        """
        browser = get_browser()
        return await browser.send_command("get_network_forensics_stats")


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


    # ==========================================
    # INTERACTION RECORDING TOOLS (Phase 20)
    # ==========================================

    @mcp.tool
    async def browser_start_interaction_recording(
        name: Optional[str] = None,
        description: Optional[str] = None,
        start_url: Optional[str] = None,
        mask_sensitive_data: bool = True,
        record_mouse_movements: bool = True,
        record_scrolls: bool = True,
        record_keyboard: bool = True,
        auto_checkpoint_interval: int = 0
    ) -> Dict[str, Any]:
        """
        Start recording user interactions for forensic playback and test automation.

        Records all mouse movements, clicks, keyboard inputs, scrolls, and page
        navigation. Automatically masks sensitive data (passwords, emails, credit cards).
        Perfect for creating test automation scripts, forensic investigation, or
        user behavior analysis.

        Args:
            name: Recording name (optional)
            description: Recording description (optional)
            start_url: Starting URL (optional)
            mask_sensitive_data: Automatically mask passwords and sensitive fields (default: True)
            record_mouse_movements: Record mouse movements (default: True)
            record_scrolls: Record scroll events (default: True)
            record_keyboard: Record keyboard input (default: True)
            auto_checkpoint_interval: Auto-create checkpoints every N milliseconds (0=disabled)

        Returns:
            Recording session information with ID
        """
        browser = get_browser()
        return await browser.send_command(
            "start_interaction_recording",
            name=name,
            description=description,
            startUrl=start_url,
            maskSensitiveData=mask_sensitive_data,
            recordMouseMovements=record_mouse_movements,
            recordScrolls=record_scrolls,
            recordKeyboard=record_keyboard,
            autoCheckpointInterval=auto_checkpoint_interval
        )


    @mcp.tool
    async def browser_stop_interaction_recording() -> Dict[str, Any]:
        """
        Stop the current interaction recording session.

        Finalizes the recording, calculates duration and statistics, and generates
        a cryptographic hash for integrity verification. The recording can then be
        exported or replayed.

        Returns:
            Complete recording with all events, statistics, and hash
        """
        browser = get_browser()
        return await browser.send_command("stop_interaction_recording")


    @mcp.tool
    async def browser_export_recording_as_script(
        format: str = "puppeteer",
        include_header: bool = True,
        include_setup: bool = True,
        include_waits: bool = True
    ) -> Dict[str, Any]:
        """
        Export interaction recording as test automation script.

        Converts recorded interactions into executable test scripts for Selenium,
        Puppeteer, or Playwright. Automatically handles element selectors, timing,
        and masked sensitive data. Perfect for creating regression tests or
        automated workflows.

        Args:
            format: Script format ('selenium', 'puppeteer', 'playwright', 'json')
            include_header: Include documentation header (default: True)
            include_setup: Include browser setup/teardown code (default: True)
            include_waits: Include explicit wait commands (default: True)

        Returns:
            Generated script code and metadata
        """
        browser = get_browser()
        return await browser.send_command(
            "export_recording_as_script",
            format=format,
            includeHeader=include_header,
            includeSetup=include_setup,
            includeWaits=include_waits
        )


    @mcp.tool
    async def browser_get_interaction_timeline(
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        event_type: Optional[str] = None,
        offset: int = 0,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Get the timeline of recorded interactions with filtering and pagination.

        Retrieves all recorded events in chronological order, including mouse clicks,
        keyboard input, scrolls, and navigation. Supports filtering by time range and
        event type for forensic analysis.

        Args:
            start_time: Start time in milliseconds (relative to recording start)
            end_time: End time in milliseconds (relative to recording start)
            event_type: Filter by event type (e.g., 'mouse_click', 'input', 'navigation')
            offset: Pagination offset (default: 0)
            limit: Maximum events to return (default: 100)

        Returns:
            Timeline with events, checkpoints, and statistics
        """
        browser = get_browser()
        params = {"offset": offset, "limit": limit}
        if start_time is not None:
            params["startTime"] = start_time
        if end_time is not None:
            params["endTime"] = end_time
        if event_type:
            params["type"] = event_type
        return await browser.send_command("get_interaction_timeline", **params)


    @mcp.tool
    async def browser_create_recording_checkpoint(
        name: Optional[str] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a checkpoint in the current interaction recording.

        Checkpoints mark important moments in the recording timeline, making it easier
        to navigate and replay specific sections. Useful for marking test steps,
        investigation milestones, or replay points.

        Args:
            name: Checkpoint name (optional)
            description: Checkpoint description (optional)

        Returns:
            Created checkpoint with timestamp and event index
        """
        browser = get_browser()
        return await browser.send_command(
            "create_recording_checkpoint",
            name=name,
            description=description
        )


    @mcp.tool
    async def browser_annotate_recording(
        text: str,
        category: str = "note",
        relative_time: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Add an annotation to the interaction recording.

        Annotations add context and notes to the recording, useful for documenting
        findings during forensic investigation or explaining test scenarios. Can be
        added during recording or retrospectively.

        Args:
            text: Annotation text (required)
            category: Annotation category ('note', 'issue', 'highlight', etc.)
            relative_time: Time in ms for retrospective annotation (optional)

        Returns:
            Created annotation with ID and timestamp
        """
        browser = get_browser()
        return await browser.send_command(
            "annotate_recording",
            text=text,
            category=category,
            relativeTime=relative_time
        )


    @mcp.tool
    async def browser_get_recording_stats() -> Dict[str, Any]:
        """
        Get statistics for the current interaction recording.

        Returns comprehensive statistics including total events, events by type,
        clicks, key presses, scrolls, navigation count, masked events, and
        events per second.

        Returns:
            Recording statistics and metrics
        """
        browser = get_browser()
        return await browser.send_command("get_recording_stats")


    @mcp.tool
    async def browser_replay_recording(
        speed: float = 1.0,
        skip_mouse_movements: bool = True,
        skip_scrolls: bool = False,
        start_from: Optional[int] = None,
        end_at: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Replay interaction recording for verification.

        Replays recorded interactions to verify the recording quality or test
        the recorded workflow. Supports speed control and selective event replay.

        Args:
            speed: Playback speed multiplier (default: 1.0)
            skip_mouse_movements: Skip mouse movement events (default: True)
            skip_scrolls: Skip scroll events (default: False)
            start_from: Start from event index (optional)
            end_at: End at event index (optional)

        Returns:
            Replay sequence information
        """
        browser = get_browser()
        return await browser.send_command(
            "replay_recording",
            speed=speed,
            skipMouseMovements=skip_mouse_movements,
            skipScrolls=skip_scrolls,
            startFrom=start_from,
            endAt=end_at
        )


    @mcp.tool
    async def browser_list_interaction_recordings(
        offset: int = 0,
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        List all stored interaction recordings.

        Returns a list of all completed interaction recordings with basic metadata.
        Useful for browsing available recordings for replay or export.

        Args:
            offset: Pagination offset (default: 0)
            limit: Maximum recordings to return (default: 50)

        Returns:
            List of recordings with metadata
        """
        browser = get_browser()
        return await browser.send_command(
            "list_interaction_recordings",
            offset=offset,
            limit=limit
        )


    # ==========================================
    # PROXY POOL MANAGEMENT TOOLS (Phase 24)
    # ==========================================

    @mcp.tool
    async def browser_add_proxy_to_pool(
        host: str,
        port: int,
        proxy_type: str = "http",
        username: Optional[str] = None,
        password: Optional[str] = None,
        country: Optional[str] = None,
        region: Optional[str] = None,
        city: Optional[str] = None,
        tags: Optional[List[str]] = None,
        weight: int = 1,
        max_requests_per_minute: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Add a proxy to the intelligent proxy pool.

        The proxy pool automatically manages proxy health, rotation, and failover.
        Each proxy is monitored for availability, response time, and success rate.

        Args:
            host: Proxy hostname or IP address
            port: Proxy port number
            proxy_type: Type of proxy ('http', 'https', 'socks4', 'socks5')
            username: Optional authentication username
            password: Optional authentication password
            country: Optional country code (e.g., 'US', 'UK', 'DE')
            region: Optional region/state
            city: Optional city
            tags: Optional tags for categorization
            weight: Weight for weighted rotation strategy (default: 1)
            max_requests_per_minute: Optional rate limit per proxy

        Returns:
            Added proxy with generated ID and statistics
        """
        browser = get_browser()
        params = {
            "host": host,
            "port": port,
            "type": proxy_type
        }
        if username:
            params["username"] = username
        if password:
            params["password"] = password
        if country:
            params["country"] = country
        if region:
            params["region"] = region
        if city:
            params["city"] = city
        if tags:
            params["tags"] = tags
        if weight != 1:
            params["weight"] = weight
        if max_requests_per_minute:
            params["maxRequestsPerMinute"] = max_requests_per_minute

        return await browser.send_command("add_proxy_to_pool", **params)


    @mcp.tool
    async def browser_get_next_proxy(
        strategy: Optional[str] = None,
        country: Optional[str] = None,
        region: Optional[str] = None,
        city: Optional[str] = None,
        proxy_type: Optional[str] = None,
        tags: Optional[List[str]] = None,
        min_success_rate: Optional[float] = None,
        max_response_time: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get the next available proxy from the pool based on rotation strategy.

        Uses intelligent rotation strategies and filters to select the best proxy.
        Strategies: 'round-robin', 'random', 'least-used', 'fastest', 'weighted'.

        Args:
            strategy: Rotation strategy (optional, uses current strategy if not provided)
            country: Filter by country code
            region: Filter by region
            city: Filter by city
            proxy_type: Filter by proxy type
            tags: Filter by tags
            min_success_rate: Minimum success rate (0-1)
            max_response_time: Maximum average response time in ms

        Returns:
            Selected proxy with URL and statistics
        """
        browser = get_browser()
        params = {}
        if strategy:
            params["strategy"] = strategy
        if country:
            params["country"] = country
        if region:
            params["region"] = region
        if city:
            params["city"] = city
        if proxy_type:
            params["type"] = proxy_type
        if tags:
            params["tags"] = tags
        if min_success_rate is not None:
            params["minSuccessRate"] = min_success_rate
        if max_response_time is not None:
            params["maxResponseTime"] = max_response_time

        return await browser.send_command("get_next_proxy", **params)


    @mcp.tool
    async def browser_set_proxy_rotation_strategy(strategy: str) -> Dict[str, Any]:
        """
        Set the proxy rotation strategy for the pool.

        Available strategies:
        - 'round-robin': Cycles through proxies in order (fair distribution)
        - 'random': Selects random proxy (unpredictable pattern)
        - 'least-used': Selects proxy with fewest total requests (load balancing)
        - 'fastest': Selects proxy with lowest average response time (performance)
        - 'weighted': Selects based on weight values (custom priority)

        Args:
            strategy: Rotation strategy name

        Returns:
            Updated strategy configuration
        """
        browser = get_browser()
        return await browser.send_command("set_proxy_rotation_strategy", strategy=strategy)


    @mcp.tool
    async def browser_list_proxy_pool(
        include_blacklisted: bool = True,
        include_unhealthy: bool = True,
        country: Optional[str] = None,
        region: Optional[str] = None,
        proxy_type: Optional[str] = None,
        min_success_rate: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        List all proxies in the pool with their status and statistics.

        Returns comprehensive information about all proxies including health status,
        success rates, response times, and usage statistics.

        Args:
            include_blacklisted: Include blacklisted proxies (default: True)
            include_unhealthy: Include unhealthy proxies (default: True)
            country: Filter by country
            region: Filter by region
            proxy_type: Filter by proxy type
            min_success_rate: Minimum success rate filter

        Returns:
            List of proxies with detailed statistics
        """
        browser = get_browser()
        params = {
            "includeBlacklisted": include_blacklisted,
            "includeUnhealthy": include_unhealthy
        }
        if country:
            params["country"] = country
        if region:
            params["region"] = region
        if proxy_type:
            params["type"] = proxy_type
        if min_success_rate is not None:
            params["minSuccessRate"] = min_success_rate

        return await browser.send_command("list_proxy_pool", **params)


    @mcp.tool
    async def browser_test_proxy_health(proxy_id: str) -> Dict[str, Any]:
        """
        Test the health of a specific proxy.

        Performs an HTTP request through the proxy to verify connectivity,
        measures response time, and updates the proxy's health status.

        Args:
            proxy_id: Proxy identifier

        Returns:
            Health check result with success status and response time
        """
        browser = get_browser()
        return await browser.send_command("test_proxy_health", proxyId=proxy_id)


    @mcp.tool
    async def browser_test_all_proxies_health() -> Dict[str, Any]:
        """
        Test the health of all proxies in the pool.

        Performs health checks on all proxies in parallel to quickly assess
        pool status. Updates health metrics for all proxies.

        Returns:
            Summary of health check results with success/failure counts
        """
        browser = get_browser()
        return await browser.send_command("test_all_proxies_health")


    @mcp.tool
    async def browser_get_proxy_stats(proxy_id: str) -> Dict[str, Any]:
        """
        Get detailed statistics for a specific proxy.

        Returns comprehensive metrics including success/failure counts,
        response times, rate limiting status, and health information.

        Args:
            proxy_id: Proxy identifier

        Returns:
            Detailed proxy statistics and metrics
        """
        browser = get_browser()
        return await browser.send_command("get_proxy_stats", proxyId=proxy_id)


    @mcp.tool
    async def browser_get_proxy_pool_stats() -> Dict[str, Any]:
        """
        Get overall statistics for the proxy pool.

        Returns pool-wide metrics including total proxies, health distribution,
        rotation strategy, success rates, and average response times.

        Returns:
            Comprehensive pool statistics
        """
        browser = get_browser()
        return await browser.send_command("get_pool_stats")


    @mcp.tool
    async def browser_blacklist_proxy(
        proxy_id: str,
        duration_ms: int = 3600000,
        reason: str = "Manual blacklist via MCP"
    ) -> Dict[str, Any]:
        """
        Blacklist a proxy temporarily or permanently.

        Blacklisted proxies are excluded from rotation until the blacklist
        expires or the proxy is manually whitelisted.

        Args:
            proxy_id: Proxy identifier
            duration_ms: Blacklist duration in milliseconds (default: 1 hour)
            reason: Reason for blacklisting

        Returns:
            Updated proxy status
        """
        browser = get_browser()
        return await browser.send_command(
            "blacklist_proxy",
            proxyId=proxy_id,
            durationMs=duration_ms,
            reason=reason
        )


    @mcp.tool
    async def browser_whitelist_proxy(proxy_id: str) -> Dict[str, Any]:
        """
        Remove a proxy from the blacklist.

        Restores a blacklisted proxy to degraded status, allowing it to be
        used again after consecutive successful requests improve its status.

        Args:
            proxy_id: Proxy identifier

        Returns:
            Updated proxy status
        """
        browser = get_browser()
        return await browser.send_command("whitelist_proxy", proxyId=proxy_id)


    @mcp.tool
    async def browser_get_proxies_by_country(country: str) -> Dict[str, Any]:
        """
        Get all available proxies for a specific country.

        Useful for geo-targeting specific regions or accessing region-restricted
        content. Only returns proxies that are currently available (not blacklisted
        or unhealthy).

        Args:
            country: Two-letter country code (e.g., 'US', 'UK', 'DE', 'JP')

        Returns:
            List of available proxies in the specified country
        """
        browser = get_browser()
        return await browser.send_command("get_proxies_by_country", country=country)


    @mcp.tool
    async def browser_configure_proxy_health_check(
        enabled: Optional[bool] = None,
        interval: Optional[int] = None,
        url: Optional[str] = None,
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Configure automatic health check settings for proxy pool.

        Health checks run periodically to test proxy availability and
        update health metrics automatically.

        Args:
            enabled: Enable or disable health checking
            interval: Health check interval in milliseconds
            url: URL to use for health checks (default: https://www.google.com)
            timeout: Health check timeout in milliseconds

        Returns:
            Updated health check configuration
        """
        browser = get_browser()
        params = {}
        if enabled is not None:
            params["enabled"] = enabled
        if interval is not None:
            params["interval"] = interval
        if url is not None:
            params["url"] = url
        if timeout is not None:
            params["timeout"] = timeout

        return await browser.send_command("configure_health_check", **params)


    # ==================== Smart Form Filling (Phase 22) ====================

    @mcp.tool
    async def browser_analyze_forms() -> Dict[str, Any]:
        """
        Analyze all forms on the current page.

        Detects form fields, types, validation, honeypots, and CAPTCHAs.

        Returns:
            List of forms with field analysis
        """
        browser = get_browser()
        return await browser.send_command("analyze_forms")

    @mcp.tool
    async def browser_analyze_form(selector: str) -> Dict[str, Any]:
        """
        Analyze a specific form by selector.

        Args:
            selector: CSS selector for the form

        Returns:
            Form analysis with field details
        """
        browser = get_browser()
        return await browser.send_command("analyze_form", selector=selector)

    @mcp.tool
    async def browser_fill_form(
        selector: str,
        data: Dict[str, Any],
        submit: bool = False,
        validate: bool = True
    ) -> Dict[str, Any]:
        """
        Fill a form with provided data.

        Automatically detects and skips honeypots, handles CAPTCHAs,
        and validates fields.

        Args:
            selector: CSS selector for the form
            data: Field data mapping (field_name: value)
            submit: Whether to submit after filling
            validate: Whether to validate before submitting

        Returns:
            Fill results with statistics
        """
        browser = get_browser()
        return await browser.send_command(
            "fill_form",
            selector=selector,
            data=data,
            submit=submit,
            validate=validate
        )

    @mcp.tool
    async def browser_fill_form_smart(
        selector: str,
        profile: Optional[str] = None,
        submit: bool = False
    ) -> Dict[str, Any]:
        """
        Intelligently fill a form using generated data.

        Automatically generates appropriate values for detected field types.

        Args:
            selector: CSS selector for the form
            profile: Data profile to use (personal, business, testing)
            submit: Whether to submit after filling

        Returns:
            Fill results with generated data
        """
        browser = get_browser()
        params = {"selector": selector, "submit": submit}
        if profile:
            params["profile"] = profile
        return await browser.send_command("fill_form_smart", **params)

    @mcp.tool
    async def browser_detect_honeypots(selector: Optional[str] = None) -> Dict[str, Any]:
        """
        Detect honeypot fields on the page.

        Honeypots are hidden fields used to detect bots.

        Args:
            selector: Optional form selector to limit search

        Returns:
            List of detected honeypot fields
        """
        browser = get_browser()
        params = {}
        if selector:
            params["selector"] = selector
        return await browser.send_command("detect_honeypots", **params)

    @mcp.tool
    async def browser_detect_captchas(selector: Optional[str] = None) -> Dict[str, Any]:
        """
        Detect CAPTCHA challenges on the page.

        Args:
            selector: Optional form selector to limit search

        Returns:
            List of detected CAPTCHA challenges
        """
        browser = get_browser()
        params = {}
        if selector:
            params["selector"] = selector
        return await browser.send_command("detect_captchas", **params)

    @mcp.tool
    async def browser_get_form_filler_stats() -> Dict[str, Any]:
        """
        Get statistics for form filling operations.

        Returns:
            Form filling statistics and success rates
        """
        browser = get_browser()
        return await browser.send_command("get_form_filler_stats")

    @mcp.tool
    async def browser_configure_form_filler(
        respect_honeypots: Optional[bool] = None,
        skip_captchas: Optional[bool] = None,
        human_like_speed: Optional[bool] = None,
        max_retries: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Configure smart form filler behavior.

        Args:
            respect_honeypots: Whether to skip honeypot fields
            skip_captchas: Whether to skip CAPTCHA fields
            human_like_speed: Use human-like typing speed
            max_retries: Maximum retry attempts

        Returns:
            Updated configuration
        """
        browser = get_browser()
        params = {}
        if respect_honeypots is not None:
            params["respectHoneypots"] = respect_honeypots
        if skip_captchas is not None:
            params["skipCaptchas"] = skip_captchas
        if human_like_speed is not None:
            params["humanLikeSpeed"] = human_like_speed
        if max_retries is not None:
            params["maxRetries"] = max_retries
        return await browser.send_command("configure_form_filler", **params)


    # ==================== Profile Templates (Phase 23) ====================

    @mcp.tool
    async def browser_list_profile_templates(
        category: Optional[str] = None,
        risk_level: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        List available browser profile templates.

        Templates include: osint_investigator, stealth_mode, web_scraper,
        social_media_monitor, ecommerce_shopper, news_reader, etc.

        Args:
            category: Filter by category (OSINT, TESTING, SCRAPING, etc.)
            risk_level: Filter by risk level (LOW, MEDIUM, HIGH, PARANOID)
            tags: Filter by tags

        Returns:
            List of profile templates
        """
        browser = get_browser()
        params = {}
        if category:
            params["category"] = category
        if risk_level:
            params["riskLevel"] = risk_level
        if tags:
            params["tags"] = tags
        return await browser.send_command("list_profile_templates", **params)

    @mcp.tool
    async def browser_get_profile_template(template_id: str) -> Dict[str, Any]:
        """
        Get details of a specific profile template.

        Args:
            template_id: Template ID (e.g., 'osint_investigator')

        Returns:
            Complete template configuration
        """
        browser = get_browser()
        return await browser.send_command("get_profile_template", id=template_id)

    @mcp.tool
    async def browser_search_profile_templates(query: str) -> Dict[str, Any]:
        """
        Search profile templates by name, description, or tags.

        Args:
            query: Search query string

        Returns:
            Matching templates
        """
        browser = get_browser()
        return await browser.send_command("search_profile_templates", query=query)

    @mcp.tool
    async def browser_generate_profile_from_template(
        template_id: str,
        customizations: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate a browser profile from a template.

        Creates a complete profile with fingerprint, behavioral patterns,
        browser settings, network configuration, and activity patterns.

        Args:
            template_id: Template to use
            customizations: Optional customizations to apply

        Returns:
            Generated profile configuration
        """
        browser = get_browser()
        params = {"templateId": template_id}
        if customizations:
            params["customizations"] = customizations
        return await browser.send_command("generate_profile_from_template", **params)

    @mcp.tool
    async def browser_create_profile_template(
        name: str,
        description: Optional[str] = None,
        category: Optional[str] = None,
        risk_level: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a custom profile template.

        Args:
            name: Template name
            description: Template description
            category: Template category
            risk_level: Risk level (LOW, MEDIUM, HIGH, PARANOID)
            config: Template configuration

        Returns:
            Created template
        """
        browser = get_browser()
        params = {"name": name}
        if description:
            params["description"] = description
        if category:
            params["category"] = category
        if risk_level:
            params["riskLevel"] = risk_level
        if config:
            params.update(config)
        return await browser.send_command("create_profile_template", **params)

    @mcp.tool
    async def browser_clone_profile_template(
        template_id: str,
        modifications: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Clone an existing template with modifications.

        Args:
            template_id: Template to clone
            modifications: Changes to apply

        Returns:
            Cloned template
        """
        browser = get_browser()
        params = {"id": template_id}
        if modifications:
            params["modifications"] = modifications
        return await browser.send_command("clone_profile_template", **params)

    @mcp.tool
    async def browser_get_template_categories() -> Dict[str, Any]:
        """
        Get all available template categories.

        Returns:
            List of template categories
        """
        browser = get_browser()
        return await browser.send_command("get_template_categories")

    @mcp.tool
    async def browser_get_template_risk_levels() -> Dict[str, Any]:
        """
        Get all available risk levels.

        Returns:
            List of risk levels
        """
        browser = get_browser()
        return await browser.send_command("get_template_risk_levels")

    @mcp.tool
    async def browser_get_profile_template_stats() -> Dict[str, Any]:
        """
        Get statistics about profile templates.

        Returns:
            Template statistics and usage counts
        """
        browser = get_browser()
        return await browser.send_command("get_profile_template_stats")


    # ==================== Advanced Cookie Management (Phase 27) ====================

    @mcp.tool
    async def browser_create_cookie_jar(
        name: str,
        isolated: bool = True,
        sync_enabled: bool = True,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a new cookie jar (profile).

        Cookie jars provide isolated environments for managing cookies across
        different contexts (investigations, accounts, testing environments).

        Args:
            name: Jar name
            isolated: Whether jar is isolated from others
            sync_enabled: Enable synchronization capabilities
            metadata: Optional metadata for the jar

        Returns:
            Created jar information
        """
        browser = get_browser()
        params = {"name": name, "isolated": isolated, "syncEnabled": sync_enabled}
        if metadata:
            params["metadata"] = metadata
        return await browser.send_command("create_cookie_jar", **params)

    @mcp.tool
    async def browser_list_cookie_jars() -> Dict[str, Any]:
        """
        List all cookie jars with statistics.

        Returns:
            List of jars with cookie counts and status
        """
        browser = get_browser()
        return await browser.send_command("list_cookie_jars")

    @mcp.tool
    async def browser_switch_cookie_jar(
        name: str,
        save_current: bool = True,
        load_target: bool = True
    ) -> Dict[str, Any]:
        """
        Switch to a different cookie jar.

        Automatically saves current cookies and loads target jar cookies.

        Args:
            name: Jar name to switch to
            save_current: Save current cookies before switching
            load_target: Load target jar cookies after switching

        Returns:
            Switch result with cookie counts
        """
        browser = get_browser()
        return await browser.send_command(
            "switch_cookie_jar",
            name=name,
            saveCurrent=save_current,
            loadTarget=load_target
        )

    @mcp.tool
    async def browser_sync_cookie_jars(
        source: str,
        target: str,
        mode: str = "merge"
    ) -> Dict[str, Any]:
        """
        Synchronize cookies between jars.

        Args:
            source: Source jar name
            target: Target jar name
            mode: Sync mode (merge, replace, update)

        Returns:
            Sync statistics (added, updated, skipped)
        """
        browser = get_browser()
        return await browser.send_command(
            "sync_cookie_jars",
            source=source,
            target=target,
            mode=mode
        )

    @mcp.tool
    async def browser_analyze_all_cookies(include_details: bool = True) -> Dict[str, Any]:
        """
        Analyze all cookies for security issues.

        Performs comprehensive security analysis including:
        - Missing Secure, HttpOnly, SameSite flags
        - Long expiration times for sensitive cookies
        - Cookie classification (auth, analytics, etc.)
        - Overall security scoring

        Args:
            include_details: Include detailed analysis for each cookie

        Returns:
            Security analysis with summary and individual cookie details
        """
        browser = get_browser()
        return await browser.send_command(
            "analyze_all_cookies",
            includeDetails=include_details
        )

    @mcp.tool
    async def browser_find_insecure_cookies() -> Dict[str, Any]:
        """
        Find cookies with security issues.

        Returns:
            List of insecure cookies with issues and recommendations
        """
        browser = get_browser()
        return await browser.send_command("find_insecure_cookies")

    @mcp.tool
    async def browser_export_cookies(
        format: str = "json",
        jar: Optional[str] = None,
        include_metadata: bool = False
    ) -> Dict[str, Any]:
        """
        Export cookies in various formats.

        Supported formats:
        - json: Structured JSON with metadata
        - netscape: curl-compatible format
        - csv: Spreadsheet format
        - curl: cURL command format

        Args:
            format: Export format (json, netscape, csv, curl)
            jar: Optional jar name to export from
            include_metadata: Include metadata in export

        Returns:
            Exported cookie data
        """
        browser = get_browser()
        params = {"format": format, "includeMetadata": include_metadata}
        if jar:
            params["jar"] = jar
        return await browser.send_command("export_cookies", **params)

    @mcp.tool
    async def browser_import_cookies(
        data: str,
        format: str = "json",
        jar: Optional[str] = None,
        mode: str = "merge"
    ) -> Dict[str, Any]:
        """
        Import cookies from various formats.

        Args:
            data: Cookie data to import
            format: Data format (json, netscape, csv)
            jar: Optional jar to import into
            mode: Import mode (merge, replace)

        Returns:
            Import statistics (imported, failed counts)
        """
        browser = get_browser()
        params = {"data": data, "format": format, "mode": mode}
        if jar:
            params["jar"] = jar
        return await browser.send_command("import_cookies", **params)

    @mcp.tool
    async def browser_get_cookie_history(
        action: Optional[str] = None,
        domain: Optional[str] = None,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Get cookie change history.

        Provides audit trail of all cookie operations.

        Args:
            action: Filter by action (created, modified, deleted)
            domain: Filter by domain
            limit: Maximum entries to return

        Returns:
            History entries with timestamps and details
        """
        browser = get_browser()
        params = {"limit": limit}
        if action:
            params["action"] = action
        if domain:
            params["domain"] = domain
        return await browser.send_command("get_cookie_history", **params)

    @mcp.tool
    async def browser_get_cookies_by_classification(classification: str) -> Dict[str, Any]:
        """
        Get cookies by classification type.

        Classifications:
        - authentication: Session, auth tokens
        - analytics: Tracking, analytics
        - advertising: Ad tracking
        - preferences: User preferences
        - security: CSRF tokens
        - functional: Other functional cookies

        Args:
            classification: Cookie classification type

        Returns:
            Filtered cookie list
        """
        browser = get_browser()
        return await browser.send_command(
            "get_cookies_by_classification",
            classification=classification
        )

    @mcp.tool
    async def browser_get_cookie_manager_stats() -> Dict[str, Any]:
        """
        Get cookie manager statistics.

        Returns:
            Statistics including jar counts, operations performed, etc.
        """
        browser = get_browser()
        return await browser.send_command("get_cookie_manager_stats")


    # ==================== Page Monitoring & Change Detection ====================

    @mcp.tool
    async def browser_start_monitoring_page(
        methods: Optional[List[str]] = None,
        interval: int = 60000,
        zones: Optional[List[Dict[str, Any]]] = None,
        threshold: float = 0.1,
        notify_on_change: bool = True,
        capture_screenshots: bool = True
    ) -> Dict[str, Any]:
        """
        Start monitoring a page for changes.

        Monitors the current page for changes using multiple detection methods
        including DOM diffing, screenshot comparison, and content hashing. Can
        monitor the entire page or specific zones (elements).

        Args:
            methods: Detection methods to use (dom_diff, screenshot_diff, content_hash, hybrid)
            interval: Check interval in milliseconds (default: 60000 = 1 minute)
            zones: Specific elements to monitor (array of {selector, name} objects)
            threshold: Change sensitivity 0-1, lower is more sensitive (default: 0.1)
            notify_on_change: Send notifications when changes detected (default: True)
            capture_screenshots: Capture visual snapshots for comparison (default: True)

        Returns:
            Monitor ID and initial snapshot
        """
        browser = get_browser()
        config = {
            "interval": interval,
            "threshold": threshold,
            "notifyOnChange": notify_on_change,
            "captureScreenshots": capture_screenshots
        }
        if methods:
            config["methods"] = methods
        if zones:
            config["zones"] = zones

        return await browser.send_command("start_monitoring_page", config=config)


    @mcp.tool
    async def browser_stop_monitoring_page(monitor_id: str) -> Dict[str, Any]:
        """
        Stop monitoring a page.

        Stops the monitoring schedule and returns final statistics including
        total checks performed, changes detected, and detection rate.

        Args:
            monitor_id: Monitor ID returned from start_monitoring_page

        Returns:
            Final monitor state and statistics
        """
        browser = get_browser()
        return await browser.send_command("stop_monitoring_page", monitorId=monitor_id)


    @mcp.tool
    async def browser_pause_monitoring_page(monitor_id: str) -> Dict[str, Any]:
        """
        Pause page monitoring temporarily.

        Pauses the monitoring schedule but keeps the monitor state intact.
        Use browser_resume_monitoring_page to continue monitoring.

        Args:
            monitor_id: Monitor ID to pause

        Returns:
            Updated monitor state
        """
        browser = get_browser()
        return await browser.send_command("pause_monitoring_page", monitorId=monitor_id)


    @mcp.tool
    async def browser_resume_monitoring_page(monitor_id: str) -> Dict[str, Any]:
        """
        Resume paused page monitoring.

        Resumes a paused monitor and restarts the monitoring schedule.

        Args:
            monitor_id: Monitor ID to resume

        Returns:
            Updated monitor state
        """
        browser = get_browser()
        return await browser.send_command("resume_monitoring_page", monitorId=monitor_id)


    @mcp.tool
    async def browser_check_page_changes_now(monitor_id: str) -> Dict[str, Any]:
        """
        Check for page changes immediately.

        Performs an immediate change check outside the regular schedule.
        Useful for on-demand monitoring or testing.

        Args:
            monitor_id: Monitor ID to check

        Returns:
            Check result with changes if any detected
        """
        browser = get_browser()
        return await browser.send_command("check_page_changes_now", monitorId=monitor_id)


    @mcp.tool
    async def browser_get_page_changes(
        monitor_id: str,
        limit: int = 50,
        offset: int = 0,
        change_type: Optional[str] = None,
        since: Optional[str] = None,
        until: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get detected page changes from monitor history.

        Retrieves the change history for a monitor with filtering and pagination.
        Changes include details about what changed, when, and significance.

        Args:
            monitor_id: Monitor ID
            limit: Maximum changes to return (default: 50)
            offset: Offset for pagination (default: 0)
            change_type: Filter by change type (content, structure, style, etc.)
            since: Filter changes since ISO timestamp
            until: Filter changes until ISO timestamp

        Returns:
            Changes array with pagination metadata
        """
        browser = get_browser()
        options = {"limit": limit, "offset": offset}
        if change_type:
            options["type"] = change_type
        if since:
            options["since"] = since
        if until:
            options["until"] = until

        return await browser.send_command("get_page_changes", monitorId=monitor_id, options=options)


    @mcp.tool
    async def browser_compare_page_versions(
        monitor_id: str,
        version1_id: str,
        version2_id: str
    ) -> Dict[str, Any]:
        """
        Compare two page versions from monitoring history.

        Performs detailed comparison between two snapshots to identify
        specific changes including DOM modifications, content updates,
        and visual differences.

        Args:
            monitor_id: Monitor ID
            version1_id: First version/snapshot ID
            version2_id: Second version/snapshot ID

        Returns:
            Detailed comparison with changes categorized by type
        """
        browser = get_browser()
        return await browser.send_command(
            "compare_page_versions",
            monitorId=monitor_id,
            version1Id=version1_id,
            version2Id=version2_id
        )


    @mcp.tool
    async def browser_get_monitoring_schedule(monitor_id: str) -> Dict[str, Any]:
        """
        Get monitoring schedule information.

        Returns schedule details including interval, next check time,
        and monitoring status.

        Args:
            monitor_id: Monitor ID

        Returns:
            Schedule information and status
        """
        browser = get_browser()
        return await browser.send_command("get_monitoring_schedule", monitorId=monitor_id)


    @mcp.tool
    async def browser_configure_monitoring(
        monitor_id: str,
        methods: Optional[List[str]] = None,
        threshold: Optional[float] = None,
        interval: Optional[int] = None,
        notify_on_change: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Configure change detection settings for a monitor.

        Updates monitoring configuration including detection methods,
        sensitivity, interval, and notification settings.

        Args:
            monitor_id: Monitor ID to configure
            methods: Detection methods to use
            threshold: Change sensitivity (0-1)
            interval: Check interval in milliseconds
            notify_on_change: Enable/disable change notifications

        Returns:
            Updated monitor configuration
        """
        browser = get_browser()
        config = {}
        if methods is not None:
            config["methods"] = methods
        if threshold is not None:
            config["threshold"] = threshold
        if interval is not None:
            config["interval"] = interval
        if notify_on_change is not None:
            config["notifyOnChange"] = notify_on_change

        return await browser.send_command(
            "configure_change_detection",
            monitorId=monitor_id,
            config=config
        )


    @mcp.tool
    async def browser_export_monitoring_report(
        monitor_id: str,
        format: str = "json",
        include_snapshots: bool = False,
        include_screenshots: bool = False,
        file_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Export change detection report.

        Generates a comprehensive report of monitoring activity including
        all detected changes, statistics, and optionally snapshots and
        screenshots. Supports multiple export formats.

        Args:
            monitor_id: Monitor ID
            format: Report format (json, csv, html, markdown)
            include_snapshots: Include full page snapshots in report
            include_screenshots: Include screenshot data in report
            file_path: Optional file path to save report

        Returns:
            Report data or file path if saved
        """
        browser = get_browser()
        options = {
            "format": format,
            "includeSnapshots": include_snapshots,
            "includeScreenshots": include_screenshots
        }
        if file_path:
            options["filePath"] = file_path

        return await browser.send_command(
            "export_change_report",
            monitorId=monitor_id,
            options=options
        )


    @mcp.tool
    async def browser_get_monitoring_stats(monitor_id: str) -> Dict[str, Any]:
        """
        Get detailed monitoring statistics and analytics.

        Returns comprehensive statistics including total checks, changes detected,
        detection rate, average check duration, changes by type, and uptime.

        Args:
            monitor_id: Monitor ID

        Returns:
            Detailed statistics and analytics
        """
        browser = get_browser()
        return await browser.send_command("get_monitoring_stats", monitorId=monitor_id)


    @mcp.tool
    async def browser_add_monitoring_zone(
        monitor_id: str,
        selector: str,
        name: Optional[str] = None,
        methods: Optional[List[str]] = None,
        threshold: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Add a monitoring zone for specific element tracking.

        Creates a zone to monitor a specific element or section of the page
        with optional custom detection methods and sensitivity. Useful for
        tracking changes in specific areas like price displays or news feeds.

        Args:
            monitor_id: Monitor ID
            selector: CSS selector for the zone element
            name: Optional zone name (defaults to selector)
            methods: Detection methods for this zone
            threshold: Sensitivity threshold for this zone

        Returns:
            Zone details and total zones count
        """
        browser = get_browser()
        zone = {"selector": selector}
        if name:
            zone["name"] = name
        if methods:
            zone["methods"] = methods
        if threshold is not None:
            zone["threshold"] = threshold

        return await browser.send_command(
            "add_monitoring_zone",
            monitorId=monitor_id,
            zone=zone
        )


    @mcp.tool
    async def browser_list_monitored_pages() -> Dict[str, Any]:
        """
        List all active page monitors.

        Returns a list of all monitors including their status, URL,
        configuration, and basic statistics.

        Returns:
            List of monitors with status and counts
        """
        browser = get_browser()
        return await browser.send_command("list_monitored_pages")


# ==================== Main Entry Point ====================

def main():
    """Run the MCP server."""
    if not FASTMCP_AVAILABLE:
        print("Error: FastMCP is required. Install with: pip install fastmcp")
        print("Also install websockets: pip install websockets")
        return 1

    print("Starting Basset Hound Browser MCP Server...")
    print(f"Connecting to browser at ws://{DEFAULT_WS_HOST}:{DEFAULT_WS_PORT}")
    print("\nAvailable tools (141+ total):")
    print("  Navigation: browser_navigate, browser_go_back, browser_go_forward, browser_reload")
    print("  Interaction: browser_click, browser_fill, browser_type, browser_select, browser_scroll, browser_hover")
    print("  Extraction: browser_get_content, browser_get_page_state, browser_extract_*")
    print("  Screenshots (9): browser_screenshot, browser_screenshot_with_highlights,")
    print("                   browser_screenshot_with_blur, browser_screenshot_diff,")
    print("                   browser_screenshot_stitch, browser_screenshot_ocr,")
    print("                   browser_screenshot_similarity, browser_screenshot_element_context,")
    print("                   browser_screenshot_forensic, browser_screenshot_configure_quality")
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
    print("  Network Forensics (16): browser_start_network_forensics_capture, browser_get_dns_queries,")
    print("                          browser_get_tls_certificates, browser_get_websocket_connections,")
    print("                          browser_get_http_headers, browser_get_cookies_with_provenance,")
    print("                          browser_export_forensic_report, and analyze tools")
    print("  Smart Forms (8): browser_analyze_forms, browser_fill_form, browser_fill_form_smart,")
    print("                   browser_detect_honeypots, browser_detect_captchas,")
    print("                   browser_get_form_filler_stats, browser_configure_form_filler")
    print("  Profile Templates (9): browser_list_profile_templates, browser_get_profile_template,")
    print("                         browser_search_profile_templates, browser_generate_profile_from_template,")
    print("                         browser_create_profile_template, browser_clone_profile_template,")
    print("                         browser_get_template_categories, browser_get_template_risk_levels")
    print("  Cookie Management (11): browser_create_cookie_jar, browser_list_cookie_jars,")
    print("                          browser_switch_cookie_jar, browser_sync_cookie_jars,")
    print("                          browser_analyze_all_cookies, browser_find_insecure_cookies,")
    print("                          browser_export_cookies, browser_import_cookies,")
    print("                          browser_get_cookie_history, browser_get_cookies_by_classification")
    print("  Proxy Pool (13): browser_add_proxy_to_pool, browser_get_next_proxy,")
    print("                   browser_set_proxy_rotation_strategy, browser_list_proxy_pool,")
    print("                   browser_test_proxy_health, browser_get_proxy_stats,")
    print("                   browser_blacklist_proxy, browser_whitelist_proxy,")
    print("                   browser_get_proxies_by_country, browser_configure_proxy_health_check")
    print("  Page Monitoring (12): browser_start_monitoring_page, browser_stop_monitoring_page,")
    print("                        browser_pause_monitoring_page, browser_resume_monitoring_page,")
    print("                        browser_check_page_changes_now, browser_get_page_changes,")
    print("                        browser_compare_page_versions, browser_get_monitoring_schedule,")
    print("                        browser_configure_monitoring, browser_export_monitoring_report,")
    print("                        browser_get_monitoring_stats, browser_add_monitoring_zone,")
    print("                        browser_list_monitored_pages")
    print()

    mcp.run()


if __name__ == "__main__":
    main()

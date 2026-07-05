"""
Basset Hound Browser Python Client

A Python client library for controlling the Basset Hound Browser via WebSocket.
Supports forensic exports, network capture, device fingerprinting, and DOM manipulation.
"""

import logging
from typing import Any, Dict, Optional
from .client import BassetHoundClient
from .ingestion import IngestionMixin
from .html_sanitizer import HTMLSanitizer, sanitize_html_export
from .exceptions import (
    BassetHoundError,
    ConnectionError,
    CommandError,
    TimeoutError,
    AuthenticationError
)

# Configure logging
logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())


class ForensicExportMixin:
    """
    Mixin providing forensic export capabilities for Basset Hound Browser.

    Includes methods for exporting HTML with headers, network logs, and device identifiers.
    """

    def export_raw_html(self, url: Optional[str] = None, timeout: Optional[float] = None) -> Dict[str, Any]:
        """
        Export raw HTML and response headers from a page.

        Retrieves the current page's HTML content along with all HTTP response headers,
        useful for forensic analysis and content verification.

        Args:
            url: Optional URL to navigate to before exporting (if not already loaded)
            timeout: Command timeout in seconds (uses default if not specified)

        Returns:
            Dictionary containing:
                - html: Raw HTML content
                - headers: Response headers
                - statusCode: HTTP status code
                - mimeType: Content MIME type
                - url: Final page URL

        Raises:
            ConnectionError: If not connected to browser
            CommandError: If HTML export fails
            TimeoutError: If command exceeds timeout

        Example:
            >>> client = BassetHoundClient()
            >>> client.navigate("https://example.com")
            >>> result = client.export_raw_html()
            >>> html = result['html']
            >>> headers = result['headers']
        """
        logger.debug(f"Exporting raw HTML for URL: {url or 'current page'}")

        params = {}
        if url:
            params['url'] = url

        try:
            response = self.send_command('export_raw_html', params, timeout=timeout)
            logger.debug(f"Successfully exported HTML: {len(response.get('html', ''))} bytes")
            return response
        except (ConnectionError, CommandError, TimeoutError) as e:
            logger.error(f"Failed to export raw HTML: {str(e)}")
            raise

    def export_raw_html_sanitized(
        self,
        url: Optional[str] = None,
        timeout: Optional[float] = None,
        remove_style_tags: bool = False,
        remove_meta_tags: bool = False
    ) -> Dict[str, Any]:
        """
        Export and sanitize raw HTML from a page, removing sensitive form fields.

        Retrieves the current page's HTML, then sanitizes it to remove:
        - Password fields and other sensitive input types
        - User input values
        - Event handlers and scripts
        - Dangerous HTML attributes

        Args:
            url: Optional URL to navigate to before exporting (if not already loaded)
            timeout: Command timeout in seconds (uses default if not specified)
            remove_style_tags: Whether to remove <style> tags
            remove_meta_tags: Whether to remove <meta> tags (some can leak privacy data)

        Returns:
            Dictionary containing:
                - html: Sanitized HTML content (sensitive fields removed)
                - headers: Original response headers
                - statusCode: HTTP status code
                - mimeType: Content MIME type
                - url: Final page URL
                - sanitization: Dictionary with:
                    - removed_fields: List of removed form fields
                    - fields_count: Number of sensitive fields removed
                    - size_reduction: Size reduction statistics

        Raises:
            ConnectionError: If not connected to browser
            CommandError: If HTML export fails
            TimeoutError: If command exceeds timeout

        Example:
            >>> client = BassetHoundClientWithForensics()
            >>> client.navigate("https://example.com/login")
            >>> result = client.export_raw_html_sanitized()
            >>> safe_html = result['html']
            >>> removed = result['sanitization']['removed_fields']
        """
        logger.debug(f"Exporting and sanitizing HTML for URL: {url or 'current page'}")

        try:
            # Get raw HTML
            raw_response = self.export_raw_html(url=url, timeout=timeout)

            # Sanitize the HTML
            sanitizer = HTMLSanitizer(
                remove_style_tags=remove_style_tags,
                remove_meta_tags=remove_meta_tags
            )
            sanitization_result = sanitizer.sanitize_html(raw_response.get('html', ''))

            # Combine original response with sanitization data
            response = {
                **raw_response,
                'html': sanitization_result['html'],
                'sanitization': {
                    'removed_fields': sanitization_result['removed_fields'],
                    'fields_count': sanitization_result['fields_removed'],
                    'size_reduction': sanitization_result['sanitization_report'],
                }
            }

            logger.debug(
                f"Successfully sanitized HTML: "
                f"{sanitization_result['fields_removed']} sensitive fields removed"
            )
            return response

        except (ConnectionError, CommandError, TimeoutError) as e:
            logger.error(f"Failed to export and sanitize HTML: {str(e)}")
            raise

    def export_network_log(self, timeout: Optional[float] = None) -> Dict[str, Any]:
        """
        Export all captured HTTP requests and responses from the current session.

        Returns network traffic captured since session start or last clear,
        including request/response headers, body data, timing, and resource types.

        Args:
            timeout: Command timeout in seconds (uses default if not specified)

        Returns:
            Dictionary containing:
                - requests: List of captured HTTP requests with:
                    - url: Request URL
                    - method: HTTP method
                    - headers: Request headers
                    - statusCode: Response status
                    - responseHeaders: Response headers
                    - responseTime: Time taken in ms
                    - resourceType: Resource type (document, xhr, fetch, etc.)
                - statistics: Network statistics

        Raises:
            ConnectionError: If not connected to browser
            CommandError: If network log export fails
            TimeoutError: If command exceeds timeout

        Example:
            >>> client = BassetHoundClient()
            >>> client.navigate("https://example.com")
            >>> logs = client.export_network_log()
            >>> for request in logs['requests']:
            ...     print(f"{request['method']} {request['url']}")
        """
        logger.debug("Exporting network log")

        try:
            response = self.send_command('export_network_log', timeout=timeout)
            num_requests = len(response.get('requests', []))
            logger.debug(f"Exported network log with {num_requests} requests")
            return response
        except (ConnectionError, CommandError, TimeoutError) as e:
            logger.error(f"Failed to export network log: {str(e)}")
            raise

    def export_device_ids(self, timeout: Optional[float] = None) -> Dict[str, Any]:
        """
        Export device fingerprints, IDs, and browser identifiers.

        Retrieves browser fingerprinting data including Canvas fingerprint, WebGL data,
        hardware identifiers, and other device-level identifiers useful for forensic analysis.

        Args:
            timeout: Command timeout in seconds (uses default if not specified)

        Returns:
            Dictionary containing:
                - userAgent: Browser user agent string
                - platform: Operating system platform
                - viewport: Screen/viewport dimensions
                - fingerprints: Dictionary containing:
                    - canvas: Canvas fingerprint hash
                    - webgl: WebGL fingerprint hash
                    - fonts: Available fonts list
                    - plugins: Browser plugins
                - hardwareInfo: Hardware information
                - identifiers: List of unique device identifiers

        Raises:
            ConnectionError: If not connected to browser
            CommandError: If device ID export fails
            TimeoutError: If command exceeds timeout

        Example:
            >>> client = BassetHoundClient()
            >>> ids = client.export_device_ids()
            >>> print(f"Canvas fingerprint: {ids['fingerprints']['canvas']}")
            >>> print(f"User Agent: {ids['userAgent']}")
        """
        logger.debug("Exporting device IDs and fingerprints")

        try:
            response = self.send_command('export_device_ids', timeout=timeout)
            logger.debug(f"Exported device IDs: {len(response.get('identifiers', []))} identifiers found")
            return response
        except (ConnectionError, CommandError, TimeoutError) as e:
            logger.error(f"Failed to export device IDs: {str(e)}")
            raise

    # ==================== DOM Manipulation ====================

    def modify_element(
        self,
        selector: str,
        action: str,
        value: Optional[str] = None,
        timeout: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Modify a DOM element's content or attributes.

        Performs various DOM manipulations such as setting text content,
        changing attributes, adding/removing classes, or executing element-specific actions.

        Args:
            selector: CSS selector for the target element
            action: Action to perform. Supported actions:
                - 'setContent': Set innerHTML
                - 'setText': Set textContent
                - 'setAttribute': Set an attribute (value should be 'attrName=attrValue')
                - 'removeAttribute': Remove an attribute (value is attribute name)
                - 'addClass': Add a CSS class (value is class name)
                - 'removeClass': Remove a CSS class (value is class name)
                - 'toggleClass': Toggle a CSS class (value is class name)
                - 'setStyle': Set inline style (value is 'property:value')
            value: Value or parameter for the action
            timeout: Command timeout in seconds (uses default if not specified)

        Returns:
            Dictionary containing:
                - success: Whether modification succeeded
                - elementTag: Tag name of modified element
                - previousValue: Previous value/content (if applicable)
                - newValue: New value/content (if applicable)

        Raises:
            ConnectionError: If not connected to browser
            CommandError: If element modification fails
            TimeoutError: If command exceeds timeout

        Example:
            >>> client = BassetHoundClient()
            >>> # Set element text
            >>> client.modify_element('#title', 'setText', 'New Title')
            >>> # Add a CSS class
            >>> client.modify_element('.card', 'addClass', 'highlight')
            >>> # Set an attribute
            >>> client.modify_element('img', 'setAttribute', 'alt=My Image')
        """
        logger.debug(f"Modifying element {selector} with action {action}")

        params = {
            'selector': selector,
            'action': action
        }
        if value is not None:
            params['value'] = value

        try:
            response = self.send_command('modify_element', params, timeout=timeout)
            logger.debug(f"Successfully modified element: {selector}")
            return response
        except (ConnectionError, CommandError, TimeoutError) as e:
            logger.error(f"Failed to modify element {selector}: {str(e)}")
            raise

    def click_element(self, selector: str, timeout: Optional[float] = None) -> Dict[str, Any]:
        """
        Click an element on the page.

        Simulates a user click on the specified element, including mouse movement
        and timing to appear human-like.

        Args:
            selector: CSS selector for the element to click
            timeout: Command timeout in seconds (uses default if not specified)

        Returns:
            Dictionary containing:
                - success: Whether click succeeded
                - elementTag: Tag name of clicked element
                - elementText: Text content of clicked element (if applicable)

        Raises:
            ConnectionError: If not connected to browser
            CommandError: If element click fails
            TimeoutError: If command exceeds timeout

        Example:
            >>> client = BassetHoundClient()
            >>> client.click_element('button#submit')
            >>> client.click_element('a[href="/about"]')
        """
        logger.debug(f"Clicking element: {selector}")

        try:
            response = self.send_command('click', {'selector': selector}, timeout=timeout)
            logger.debug(f"Successfully clicked element: {selector}")
            return response
        except (ConnectionError, CommandError, TimeoutError) as e:
            logger.error(f"Failed to click element {selector}: {str(e)}")
            raise

    def fill_input(
        self,
        selector: str,
        text: str,
        timeout: Optional[float] = None,
        delay: int = 50
    ) -> Dict[str, Any]:
        """
        Fill an input field with text.

        Types text into an input element with human-like timing and character-by-character
        delays to avoid detection by bot mitigation systems.

        Args:
            selector: CSS selector for the input element
            text: Text to fill into the input
            timeout: Command timeout in seconds (uses default if not specified)
            delay: Delay between keystrokes in milliseconds (default: 50ms)

        Returns:
            Dictionary containing:
                - success: Whether fill succeeded
                - elementTag: Tag name of the input element
                - inputValue: Current value in the input field
                - textLength: Length of text entered

        Raises:
            ConnectionError: If not connected to browser
            CommandError: If input fill fails
            TimeoutError: If command exceeds timeout

        Example:
            >>> client = BassetHoundClient()
            >>> client.fill_input('input#username', 'john_doe')
            >>> client.fill_input('input[name="email"]', 'user@example.com', delay=75)
        """
        logger.debug(f"Filling input {selector} with {len(text)} characters")

        try:
            response = self.send_command('type_text', {
                'selector': selector,
                'text': text,
                'delay': delay
            }, timeout=timeout)
            logger.debug(f"Successfully filled input: {selector}")
            return response
        except (ConnectionError, CommandError, TimeoutError) as e:
            logger.error(f"Failed to fill input {selector}: {str(e)}")
            raise

    def wait_for_selector(
        self,
        selector: str,
        timeout: float = 10000
    ) -> Dict[str, Any]:
        """
        Wait for an element to appear in the DOM.

        Polls the DOM until the specified element appears or timeout is reached.
        Useful for waiting for dynamic content to load before interacting with it.

        Args:
            selector: CSS selector for the element to wait for
            timeout: Maximum time to wait in milliseconds (default: 10000ms = 10 seconds)

        Returns:
            Dictionary containing:
                - success: Whether element was found
                - elementTag: Tag name of found element (if found)
                - waitTime: Time taken to find element in ms

        Raises:
            ConnectionError: If not connected to browser
            CommandError: If wait fails or element not found
            TimeoutError: If element not found within timeout

        Example:
            >>> client = BassetHoundClient()
            >>> client.navigate("https://example.com")
            >>> # Wait for dynamic content to load
            >>> client.wait_for_selector('.content', timeout=5000)
            >>> content = client.get_content()
        """
        logger.debug(f"Waiting for selector {selector} (timeout: {timeout}ms)")

        try:
            response = self.send_command('wait_for_element', {
                'selector': selector,
                'timeout': timeout
            }, timeout=timeout / 1000.0)  # Convert to seconds for send_command timeout
            logger.debug(f"Element found: {selector}")
            return response
        except (ConnectionError, CommandError, TimeoutError) as e:
            logger.error(f"Failed to wait for selector {selector}: {str(e)}")
            raise


class BassetHoundClientWithForensics(BassetHoundClient, ForensicExportMixin):
    """
    Client with forensic export capabilities.

    Combines base browser control with forensic data extraction methods
    for analyzing page content, network traffic, and device fingerprints.

    Example:
        >>> with BassetHoundClientWithForensics() as client:
        ...     client.navigate("https://example.com")
        ...     html_data = client.export_raw_html()
        ...     network = client.export_network_log()
        ...     ids = client.export_device_ids()
        ...     client.fill_input('input#search', 'query')
        ...     client.click_element('button#submit')
    """
    pass


class BassetHoundClientWithIngestion(BassetHoundClient, IngestionMixin):
    """
    Full-featured client with data ingestion support.

    Combines the base client with ingestion functionality for OSINT
    data detection and extraction.

    Example:
        >>> with BassetHoundClientWithIngestion() as client:
        ...     client.navigate("https://example.com")
        ...     detections = client.detect_data_types()
        ...     client.ingest_all()
    """
    pass


class BassetHoundClientFull(BassetHoundClient, ForensicExportMixin, IngestionMixin):
    """
    Complete client with all features: forensic exports and data ingestion.

    Provides the full suite of capabilities including forensic data extraction,
    data ingestion, and all base browser automation features.

    Example:
        >>> with BassetHoundClientFull() as client:
        ...     client.navigate("https://example.com")
        ...     # Forensic exports
        ...     html = client.export_raw_html()
        ...     network = client.export_network_log()
        ...     # Data ingestion
        ...     detections = client.detect_data_types()
        ...     client.ingest_all()
    """
    pass


__version__ = "1.3.0"
__all__ = [
    "BassetHoundClient",
    "BassetHoundClientWithForensics",
    "BassetHoundClientWithIngestion",
    "BassetHoundClientFull",
    "ForensicExportMixin",
    "IngestionMixin",
    "BassetHoundError",
    "ConnectionError",
    "CommandError",
    "TimeoutError",
    "AuthenticationError",
    "HTMLSanitizer",
    "sanitize_html_export"
]

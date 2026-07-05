"""
Basset Hound Browser Python Client - Comprehensive Examples

This module demonstrates all features of the forensic export client library,
including HTML export, network log capture, device fingerprinting, and DOM manipulation.
"""

import logging
import json
from basset_hound import (
    BassetHoundClient,
    BassetHoundClientWithForensics,
    BassetHoundClientFull,
    CommandError,
    TimeoutError,
    ConnectionError
)

# Configure logging to see debug messages
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def example_basic_navigation():
    """Example: Basic navigation and page inspection."""
    print("\n=== Example 1: Basic Navigation ===")

    with BassetHoundClient() as client:
        # Navigate to a website
        result = client.navigate("https://example.com")
        print(f"Navigation result: {result}")

        # Get current URL
        url = client.get_url()
        print(f"Current URL: {url}")

        # Get page title
        title = client.get_title()
        print(f"Page title: {title}")

        # Extract page metadata
        metadata = client.extract_metadata()
        print(f"Metadata: {json.dumps(metadata, indent=2)}")


def example_forensic_html_export():
    """Example: Export raw HTML and response headers for forensic analysis."""
    print("\n=== Example 2: Forensic HTML Export ===")

    with BassetHoundClientWithForensics() as client:
        # Navigate to target page
        client.navigate("https://example.com")

        # Export raw HTML with headers
        try:
            html_export = client.export_raw_html()

            print(f"HTTP Status: {html_export.get('statusCode')}")
            print(f"Content Type: {html_export.get('mimeType')}")
            print(f"Final URL: {html_export.get('url')}")

            # Access response headers
            headers = html_export.get('headers', {})
            print(f"Response Headers:")
            for key, value in list(headers.items())[:5]:  # Show first 5 headers
                print(f"  {key}: {value}")

            # Access HTML content
            html = html_export.get('html', '')
            print(f"HTML Content Length: {len(html)} bytes")
            print(f"HTML Preview: {html[:200]}...")

        except TimeoutError as e:
            logger.error(f"Export timed out: {e}")
        except CommandError as e:
            logger.error(f"Export failed: {e}")


def example_network_capture():
    """Example: Capture and export HTTP network traffic."""
    print("\n=== Example 3: Network Traffic Capture ===")

    with BassetHoundClientWithForensics() as client:
        # Navigate to page (this will capture network traffic automatically)
        client.navigate("https://example.com")

        # Give page time to load all resources
        import time
        time.sleep(2)

        # Export network log
        try:
            network_log = client.export_network_log()

            requests = network_log.get('requests', [])
            print(f"Total requests captured: {len(requests)}")

            # Analyze requests by type
            request_types = {}
            for req in requests:
                resource_type = req.get('resourceType', 'unknown')
                request_types[resource_type] = request_types.get(resource_type, 0) + 1

            print("\nRequests by type:")
            for req_type, count in sorted(request_types.items()):
                print(f"  {req_type}: {count}")

            # Show details of first few requests
            print("\nFirst 3 requests:")
            for i, req in enumerate(requests[:3], 1):
                print(f"\n  Request {i}:")
                print(f"    Method: {req.get('method')}")
                print(f"    URL: {req.get('url')}")
                print(f"    Status: {req.get('statusCode')}")
                print(f"    Type: {req.get('resourceType')}")
                print(f"    Response Time: {req.get('responseTime')}ms")

            # Network statistics
            stats = network_log.get('statistics', {})
            print(f"\nNetwork Statistics:")
            for key, value in stats.items():
                print(f"  {key}: {value}")

        except TimeoutError as e:
            logger.error(f"Network export timed out: {e}")
        except CommandError as e:
            logger.error(f"Network export failed: {e}")


def example_device_fingerprints():
    """Example: Export device fingerprints and identifiers."""
    print("\n=== Example 4: Device Fingerprints & IDs ===")

    with BassetHoundClientWithForensics() as client:
        # Navigate first to initialize browser context
        client.navigate("https://example.com")

        # Export device IDs and fingerprints
        try:
            device_data = client.export_device_ids()

            print(f"User Agent: {device_data.get('userAgent')}")
            print(f"Platform: {device_data.get('platform')}")

            # Viewport information
            viewport = device_data.get('viewport', {})
            if viewport:
                print(f"Viewport: {viewport.get('width')}x{viewport.get('height')}")

            # Browser fingerprints
            fingerprints = device_data.get('fingerprints', {})
            print(f"\nFingerprints:")
            print(f"  Canvas: {fingerprints.get('canvas', 'N/A')[:16]}...")
            print(f"  WebGL: {fingerprints.get('webgl', 'N/A')[:16]}...")

            # Hardware info
            hardware = device_data.get('hardwareInfo', {})
            if hardware:
                print(f"\nHardware Info:")
                for key, value in hardware.items():
                    print(f"  {key}: {value}")

            # Device identifiers
            identifiers = device_data.get('identifiers', [])
            print(f"\nDevice Identifiers ({len(identifiers)} total):")
            for ident in identifiers[:3]:
                print(f"  - {ident}")

        except TimeoutError as e:
            logger.error(f"Device export timed out: {e}")
        except CommandError as e:
            logger.error(f"Device export failed: {e}")


def example_dom_manipulation():
    """Example: Modify DOM elements."""
    print("\n=== Example 5: DOM Manipulation ===")

    with BassetHoundClientWithForensics() as client:
        # Navigate to a page with forms
        client.navigate("https://example.com/form")

        try:
            # Modify element content
            result = client.modify_element('#title', 'setText', 'New Title')
            print(f"Modified title: {result}")

            # Add CSS class to element
            result = client.modify_element('.button', 'addClass', 'active')
            print(f"Added class: {result}")

            # Set element attribute
            result = client.modify_element('img#logo', 'setAttribute', 'alt=Company Logo')
            print(f"Set attribute: {result}")

            # Set inline style
            result = client.modify_element('.card', 'setStyle', 'background-color:blue')
            print(f"Set style: {result}")

        except CommandError as e:
            logger.error(f"DOM modification failed: {e}")


def example_form_interaction():
    """Example: Interact with forms - fill and click."""
    print("\n=== Example 6: Form Interaction ===")

    with BassetHoundClientWithForensics() as client:
        # Navigate to a login page
        client.navigate("https://example.com/login")

        try:
            # Wait for form to load
            client.wait_for_selector('input[name="username"]', timeout=5000)

            # Fill username field
            result = client.fill_input('input[name="username"]', 'john_doe')
            print(f"Filled username: {result}")

            # Fill password field
            result = client.fill_input('input[name="password"]', 'secure_password')
            print(f"Filled password: {result}")

            # Click submit button
            result = client.click_element('button[type="submit"]')
            print(f"Clicked submit: {result}")

            # Wait for page to load after submit
            client.wait_for_selector('.dashboard', timeout=10000)

            # Verify we're logged in by checking page content
            title = client.get_title()
            print(f"Page after login: {title}")

        except TimeoutError as e:
            logger.error(f"Form interaction timed out: {e}")
        except CommandError as e:
            logger.error(f"Form interaction failed: {e}")


def example_element_waits():
    """Example: Wait for elements to appear (dynamic content)."""
    print("\n=== Example 7: Waiting for Elements ===")

    with BassetHoundClientWithForensics() as client:
        # Navigate to a page with lazy-loaded content
        client.navigate("https://example.com/products")

        try:
            # Wait for product list to load (with default 10 second timeout)
            result = client.wait_for_selector('.product-list', timeout=5000)
            print(f"Product list appeared: {result}")

            # Wait for images to load
            result = client.wait_for_selector('img.product-image', timeout=3000)
            print(f"Product images loaded: {result}")

            # Now safe to interact with loaded elements
            product_count = client.execute_script(
                "return document.querySelectorAll('.product').length"
            )
            print(f"Product count: {product_count}")

        except TimeoutError as e:
            logger.error(f"Element wait timed out: {e}")
        except CommandError as e:
            logger.error(f"Element wait failed: {e}")


def example_error_handling():
    """Example: Proper error handling."""
    print("\n=== Example 8: Error Handling ===")

    try:
        with BassetHoundClientWithForensics(
            host="localhost",
            port=8765,
            command_timeout=5.0  # Short timeout to demonstrate error handling
        ) as client:
            # This will fail if server is not running
            client.navigate("https://example.com")

    except ConnectionError as e:
        logger.error(f"Failed to connect to browser: {e}")

    except TimeoutError as e:
        logger.error(f"Command timed out after {e.timeout} seconds: {e}")

    except CommandError as e:
        logger.error(f"Command failed: {e.command} - {e}")
        if e.details:
            logger.error(f"Error details: {e.details}")

    except Exception as e:
        logger.error(f"Unexpected error: {type(e).__name__} - {e}")


def example_full_workflow():
    """Example: Complete forensic analysis workflow."""
    print("\n=== Example 9: Complete Forensic Analysis Workflow ===")

    with BassetHoundClientFull() as client:
        target_url = "https://example.com"
        logger.info(f"Starting forensic analysis of {target_url}")

        try:
            # Step 1: Navigate to target
            logger.info("Step 1: Navigating to target...")
            client.navigate(target_url)

            # Step 2: Export HTML and headers
            logger.info("Step 2: Exporting raw HTML...")
            html_data = client.export_raw_html()
            logger.info(f"  - Status: {html_data.get('statusCode')}")
            logger.info(f"  - Size: {len(html_data.get('html', ''))} bytes")

            # Step 3: Capture network traffic
            logger.info("Step 3: Capturing network traffic...")
            import time
            time.sleep(2)  # Let resources load
            network_data = client.export_network_log()
            logger.info(f"  - Requests: {len(network_data.get('requests', []))}")

            # Step 4: Export device fingerprints
            logger.info("Step 4: Exporting device fingerprints...")
            device_data = client.export_device_ids()
            logger.info(f"  - User Agent: {device_data.get('userAgent')[:50]}...")
            logger.info(f"  - Identifiers: {len(device_data.get('identifiers', []))}")

            # Step 5: Detect technologies
            logger.info("Step 5: Detecting technologies...")
            tech_data = client.detect_technologies()
            logger.info(f"  - Technologies found: {len(tech_data.get('technologies', []))}")

            # Step 6: Extract content
            logger.info("Step 6: Extracting page content...")
            content = client.extract_all()
            logger.info(f"  - Links: {len(content.get('links', []))}")
            logger.info(f"  - Images: {len(content.get('images', []))}")
            logger.info(f"  - Forms: {len(content.get('forms', []))}")

            # Step 7: Perform data ingestion (if available)
            try:
                logger.info("Step 7: Performing data ingestion...")
                detections = client.detect_data_types()
                logger.info(f"  - Data types detected: {len(detections.get('types', []))}")
            except AttributeError:
                logger.info("  - Data ingestion not available in this client variant")

            logger.info("Forensic analysis complete!")

        except (ConnectionError, CommandError, TimeoutError) as e:
            logger.error(f"Forensic analysis failed: {e}")


def example_context_manager():
    """Example: Using client as context manager."""
    print("\n=== Example 10: Context Manager Usage ===")

    # Automatic connection and disconnection
    with BassetHoundClientWithForensics() as client:
        logger.info("Connected to browser")

        try:
            client.navigate("https://example.com")
            logger.info("Navigation successful")

            result = client.export_raw_html()
            logger.info(f"Export successful: {len(result.get('html', ''))} bytes")

        except Exception as e:
            logger.error(f"Error during operation: {e}")

    logger.info("Automatically disconnected from browser")


def main():
    """Run all examples."""
    examples = [
        ("Basic Navigation", example_basic_navigation),
        ("Forensic HTML Export", example_forensic_html_export),
        ("Network Capture", example_network_capture),
        ("Device Fingerprints", example_device_fingerprints),
        ("DOM Manipulation", example_dom_manipulation),
        ("Form Interaction", example_form_interaction),
        ("Element Waits", example_element_waits),
        ("Error Handling", example_error_handling),
        ("Complete Workflow", example_full_workflow),
        ("Context Manager", example_context_manager),
    ]

    print("=" * 60)
    print("Basset Hound Browser Python Client Examples")
    print("=" * 60)

    for name, example_func in examples:
        try:
            example_func()
        except Exception as e:
            logger.error(f"Example '{name}' failed: {e}", exc_info=True)
        print()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Basset Hound Browser - Python Web Scraping Example

This example demonstrates basic web scraping:
1. Navigate to a website
2. Extract all content (text, links, forms)
3. Save results to JSON file

Prerequisites:
    pip install websocket-client

Usage:
    python3 03-python-web-scraping.py https://example.com output.json
"""

import websocket
import json
import sys
import time
from pathlib import Path

class BassetClient:
    """Simple Basset Hound Browser client."""

    def __init__(self, host='localhost', port=8765):
        self.url = f'ws://{host}:{port}'
        self.ws = None
        self.request_id = 0

    def connect(self):
        """Connect to server."""
        try:
            self.ws = websocket.WebSocket()
            self.ws.connect(self.url)
            print(f"Connected to {self.url}")
            return True
        except Exception as e:
            print(f"Failed to connect: {e}")
            return False

    def close(self):
        """Close connection."""
        if self.ws:
            self.ws.close()

    def send_command(self, command, **params):
        """Send command and return response."""
        self.request_id += 1
        request = {
            'id': self.request_id,
            'command': command,
            **params
        }
        self.ws.send(json.dumps(request))
        response = json.loads(self.ws.recv())
        return response

    def navigate(self, url):
        """Navigate to URL."""
        print(f"\nNavigating to {url}...")
        response = self.send_command('navigate', url=url)
        if response.get('success'):
            print(f"Navigation successful")
            return True
        else:
            print(f"Navigation failed: {response.get('error')}")
            return False

    def extract_all(self):
        """Extract all content from page."""
        print("\nExtracting all content...")
        response = self.send_command('extract_all')
        if response.get('success'):
            print(f"Extraction successful")
            return response.get('data', {})
        else:
            print(f"Extraction failed: {response.get('error')}")
            return None

    def get_page_state(self):
        """Get page state."""
        print("\nGetting page state...")
        response = self.send_command('get_page_state')
        if response.get('success'):
            print(f"Page state retrieved")
            return response.get('data', {})
        else:
            print(f"Failed to get page state: {response.get('error')}")
            return None

    def screenshot(self):
        """Take screenshot."""
        print("\nTaking screenshot...")
        response = self.send_command('screenshot', format='png')
        if response.get('success'):
            print(f"Screenshot successful")
            return response.get('data', {})
        else:
            print(f"Screenshot failed: {response.get('error')}")
            return None


def main():
    """Run web scraping example."""
    if len(sys.argv) < 2:
        print("Usage: python3 03-python-web-scraping.py <url> [output_file]")
        print("Example: python3 03-python-web-scraping.py https://example.com scrape.json")
        sys.exit(1)

    target_url = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'scrape.json'

    print("=" * 70)
    print("Basset Hound Browser - Web Scraping Example")
    print("=" * 70)

    # Create client
    client = BassetClient()

    try:
        # Connect
        if not client.connect():
            sys.exit(1)

        # Navigate
        if not client.navigate(target_url):
            sys.exit(1)

        # Wait for page to load
        print("\nWaiting 2 seconds for page to load...")
        time.sleep(2)

        # Get page state
        page_state = client.get_page_state()

        # Extract all content
        extracted = client.extract_all()

        # Take screenshot
        screenshot = client.screenshot()

        # Prepare results
        results = {
            'url': target_url,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'page_state': page_state,
            'extracted_content': extracted,
            'screenshot': None
        }

        # Save screenshot to separate file
        if screenshot and screenshot.get('image'):
            screenshot_file = output_file.replace('.json', '_screenshot.png')
            image_data = screenshot['image']

            # Decode base64 and save
            import base64
            image_bytes = base64.b64decode(image_data)
            with open(screenshot_file, 'wb') as f:
                f.write(image_bytes)
            print(f"Screenshot saved to {screenshot_file}")
            results['screenshot'] = screenshot_file

        # Save results to JSON
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\nResults saved to {output_file}")

        # Print summary
        print("\n" + "=" * 70)
        print("Scraping Summary")
        print("=" * 70)
        if page_state:
            print(f"Page Title: {page_state.get('title', 'N/A')}")
            print(f"Page URL: {page_state.get('url', 'N/A')}")

        if extracted:
            print(f"\nExtracted Content:")
            print(f"  Links: {len(extracted.get('links', []))}")
            print(f"  Forms: {len(extracted.get('forms', []))}")
            print(f"  Images: {len(extracted.get('images', []))}")
            print(f"  Scripts: {len(extracted.get('scripts', []))}")
            print(f"  Stylesheets: {len(extracted.get('stylesheets', []))}")

            # Show first few links
            links = extracted.get('links', [])[:3]
            if links:
                print(f"\nFirst {len(links)} Links:")
                for link in links:
                    print(f"  - {link.get('text', 'N/A')}: {link.get('href', 'N/A')}")

        print("=" * 70)
        print("Example Completed Successfully!")
        print("=" * 70)

    except KeyboardInterrupt:
        print("\nInterrupted by user")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()


if __name__ == '__main__':
    main()

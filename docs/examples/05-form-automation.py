#!/usr/bin/env python3
"""
Basset Hound Browser - Form Automation Example

This example demonstrates form automation:
1. Navigate to a form page
2. Fill out form fields
3. Submit the form
4. Verify submission

Prerequisites:
    pip install websocket-client

Usage:
    python3 05-form-automation.py
"""

import websocket
import json
import sys
import time

class FormAutomationExample:
    """Example of form automation with Basset Hound Browser."""

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
        """Navigate to a URL."""
        print(f"\nNavigating to {url}...")
        response = self.send_command('navigate', url=url)
        success = response.get('success', False)
        if success:
            print("Navigation successful")
        else:
            print(f"Navigation failed: {response.get('error')}")
        return success

    def wait_for_element(self, selector, timeout=5000):
        """Wait for element to appear on page."""
        print(f"Waiting for element: {selector}")
        response = self.send_command(
            'wait_for_element',
            selector=selector,
            timeout=timeout
        )
        success = response.get('success', False)
        if success:
            print(f"Element found")
        else:
            print(f"Element not found: {response.get('error')}")
        return success

    def fill_field(self, selector, value, humanize=True):
        """Fill a form field with text."""
        print(f"Filling field: {selector} = '{value}'")
        response = self.send_command(
            'fill',
            selector=selector,
            value=value,
            humanize=humanize
        )
        success = response.get('success', False)
        if success:
            print("Field filled")
        else:
            print(f"Failed to fill field: {response.get('error')}")
        return success

    def click_button(self, selector, humanize=True):
        """Click a button or element."""
        print(f"Clicking element: {selector}")
        response = self.send_command(
            'click',
            selector=selector,
            humanize=humanize
        )
        success = response.get('success', False)
        if success:
            print("Click successful")
        else:
            print(f"Click failed: {response.get('error')}")
        return success

    def get_page_state(self):
        """Get current page state."""
        print("Getting page state...")
        response = self.send_command('get_page_state')
        if response.get('success'):
            return response.get('data', {})
        else:
            print(f"Failed to get page state: {response.get('error')}")
            return None

    def extract_forms(self):
        """Extract all forms from page."""
        print("Extracting forms...")
        response = self.send_command('extract_forms')
        if response.get('success'):
            return response.get('data', {}).get('forms', [])
        else:
            print(f"Failed to extract forms: {response.get('error')}")
            return []

    def screenshot(self):
        """Take a screenshot."""
        print("Taking screenshot...")
        response = self.send_command('screenshot', format='png')
        if response.get('success'):
            return response.get('data', {})
        else:
            print(f"Screenshot failed: {response.get('error')}")
            return None


def example_1_simple_form():
    """Example 1: Simple login form."""
    print("\n" + "=" * 70)
    print("EXAMPLE 1: Simple Form Fill & Submit")
    print("=" * 70)

    client = FormAutomationExample()

    try:
        if not client.connect():
            return

        # Use httpbin.org for testing (includes forms)
        form_url = "https://httpbin.org/forms/post"

        # Navigate to form
        if not client.navigate(form_url):
            return

        # Wait for page to load
        print("\nWaiting for page to load...")
        time.sleep(2)

        # Get page state
        page_state = client.get_page_state()
        if page_state:
            print(f"Page title: {page_state.get('title', 'N/A')}")

        # Get page content to see what forms are available
        print("\nExtracting available forms...")
        forms = client.extract_forms()
        print(f"Found {len(forms)} form(s)")
        for i, form in enumerate(forms):
            print(f"  Form {i+1}: {form.get('action', 'N/A')}")
            fields = form.get('fields', [])
            print(f"    Fields: {len(fields)}")
            for field in fields[:3]:  # Show first 3 fields
                print(f"      - {field.get('name', 'N/A')} ({field.get('type', 'N/A')})")

        # Note: Actual form filling depends on the specific form structure
        # This is a demonstration of the API

        print("\n✓ Form extraction complete")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()


def example_2_multi_step_form():
    """Example 2: Multi-step form automation."""
    print("\n" + "=" * 70)
    print("EXAMPLE 2: Multi-Step Form with Verification")
    print("=" * 70)

    client = FormAutomationExample()

    try:
        if not client.connect():
            return

        print("\nDemo: Multi-step form automation workflow")
        print("(This is a pseudocode example)")
        print("""
Steps:
  1. Navigate to form page
     client.navigate('https://example.com/form')

  2. Wait for form to load
     client.wait_for_element('#form-container')

  3. Fill first field
     client.fill_field('#email', 'user@example.com')

  4. Fill password field
     client.fill_field('#password', 'SecurePassword123')

  5. Fill textarea
     client.fill_field('#message', 'Multi-line\\nmessage here')

  6. Select dropdown (if applicable)
     client.click_button('#dropdown-option-2')

  7. Check checkbox
     client.click_button('#terms-checkbox')

  8. Click submit button
     client.click_button('#submit-button')

  9. Wait for success message
     client.wait_for_element('.success-message', timeout=10000)

  10. Verify page changed
      new_state = client.get_page_state()
      print(new_state['title'])
        """)

        print("\n✓ Multi-step form example demonstration complete")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()


def example_3_form_with_humanization():
    """Example 3: Form filling with humanization."""
    print("\n" + "=" * 70)
    print("EXAMPLE 3: Form Filling with Human-like Behavior")
    print("=" * 70)

    print("""
To make your automation look more human-like, use the humanize parameter:

  # Slow, human-like typing
  client.fill_field('#email', 'user@example.com', humanize=True)

  # Slow, human-like clicking
  client.click_button('#submit', humanize=True)

  # Wait between actions to simulate user thinking
  time.sleep(0.5)

  # Add random mouse movements (simulates browsing)
  client.send_command('mouse_move', x=100, y=100, humanize=True)

Benefits:
  - Evades bot detection
  - More realistic automation
  - Helps pass CAPTCHA challenges
  - Better for web scraping (less likely to be blocked)

Parameters:
  humanize=True    : Add random delays and movements
  humanize=False   : Execute as fast as possible (default for non-interaction)
    """)

    print("✓ Humanization example demonstration complete")


def main():
    """Run all examples."""
    print("=" * 70)
    print("Basset Hound Browser - Form Automation Examples")
    print("=" * 70)

    example_1_simple_form()
    example_2_multi_step_form()
    example_3_form_with_humanization()

    print("\n" + "=" * 70)
    print("All Examples Complete!")
    print("=" * 70)
    print("""
Next Steps:
  1. Check out the other examples (01-hello-world, 02-nodejs-hello-world)
  2. Read USER-ACCESS-GUIDE.md for more details
  3. See API-QUICK-REFERENCE.md for command list
  4. Review API-REFERENCE.md for detailed documentation
    """)


if __name__ == '__main__':
    main()

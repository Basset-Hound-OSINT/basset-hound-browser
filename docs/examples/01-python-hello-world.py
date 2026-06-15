#!/usr/bin/env python3
"""
Basset Hound Browser - Python Hello World Example

This is the simplest example to test connectivity and basic commands.

Prerequisites:
    pip install websocket-client

Usage:
    python3 01-python-hello-world.py
"""

import websocket
import json
import sys

def connect_to_server(host='localhost', port=8765):
    """Connect to Basset Hound Browser WebSocket server."""
    url = f'ws://{host}:{port}'
    try:
        ws = websocket.WebSocket()
        ws.connect(url)
        print(f"Connected to {url}")
        return ws
    except Exception as e:
        print(f"Failed to connect to {url}: {e}")
        sys.exit(1)

def send_command(ws, command_id, command_name, **params):
    """Send a command to the server."""
    request = {
        'id': command_id,
        'command': command_name,
        **params
    }
    print(f"\nSending command: {command_name}")
    print(f"Request: {json.dumps(request)}")
    ws.send(json.dumps(request))

def receive_response(ws):
    """Receive and parse response from server."""
    raw_data = ws.recv()
    response = json.loads(raw_data)
    return response

def main():
    """Run hello world example."""
    print("=" * 60)
    print("Basset Hound Browser - Python Hello World Example")
    print("=" * 60)

    # Step 1: Connect
    ws = connect_to_server()

    try:
        # Step 2: Test connection with ping
        print("\n1. Testing connection...")
        send_command(ws, 1, 'ping')
        response = receive_response(ws)
        print(f"Response: {json.dumps(response, indent=2)}")

        if not response.get('success'):
            print("Ping failed!")
            return

        print("Ping successful!")

        # Step 3: Get server status
        print("\n2. Getting server status...")
        send_command(ws, 2, 'status')
        response = receive_response(ws)
        print(f"Response: {json.dumps(response, indent=2)}")

        # Step 4: Navigate to a website
        print("\n3. Navigating to example.com...")
        send_command(ws, 3, 'navigate', url='https://example.com')
        response = receive_response(ws)
        print(f"Response: {json.dumps(response, indent=2)}")

        if not response.get('success'):
            print("Navigation failed!")
            return

        print("Navigation successful!")

        # Step 5: Wait a moment for page to load
        print("\n4. Waiting 2 seconds for page to load...")
        import time
        time.sleep(2)

        # Step 6: Get page URL
        print("\n5. Getting current page URL...")
        send_command(ws, 5, 'get_url')
        response = receive_response(ws)
        print(f"Response: {json.dumps(response, indent=2)}")

        # Step 7: Get page state
        print("\n6. Getting page state...")
        send_command(ws, 6, 'get_page_state')
        response = receive_response(ws)
        print(f"Response: {json.dumps(response, indent=2)}")

        # Step 8: Extract links
        print("\n7. Extracting links from page...")
        send_command(ws, 7, 'extract_links')
        response = receive_response(ws)
        if response.get('success'):
            links = response.get('data', {}).get('links', [])
            print(f"Found {len(links)} links:")
            for link in links[:5]:  # Show first 5
                print(f"  - {link.get('text', 'N/A')}: {link.get('href', 'N/A')}")
        else:
            print(f"Error: {response.get('error')}")

        print("\n" + "=" * 60)
        print("Hello World Example Completed Successfully!")
        print("=" * 60)

    except KeyboardInterrupt:
        print("\nInterrupted by user")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Step 9: Close connection
        print("\nClosing connection...")
        ws.close()

if __name__ == '__main__':
    main()

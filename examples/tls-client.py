#!/usr/bin/env python3
"""
TLS/WSS WebSocket Client for Basset Hound Browser

Demonstrates secure WebSocket (WSS) connections with self-signed and
production certificates.

Requirements:
    pip install websocket-client

Usage:
    python tls-client.py [environment] [command]

Examples:
    python tls-client.py dev ping              # Self-signed cert
    python tls-client.py prod navigate URL     # Production cert
    python tls-client.py dev interactive       # Interactive mode

Environments:
    dev   - localhost with self-signed cert (certificate validation disabled)
    prod  - browser.example.com with valid cert (certificate validation enabled)
    custom - Configure via environment variables (TLS_URL, TLS_INSECURE, etc.)
"""

import sys
import json
import ssl
import socket
import os
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any

try:
    import websocket
except ImportError:
    print("Error: websocket-client not installed")
    print("Install with: pip install websocket-client")
    sys.exit(1)


# Configuration presets
ENVIRONMENTS = {
    'dev': {
        'url': 'wss://localhost:8765',
        'ssl_verify': False,
        'description': 'Development (self-signed cert)',
        'cert_path': './certs/localhost.crt',
        'key_path': './certs/localhost.key',
        'ca_path': None,
    },
    'prod': {
        'url': 'wss://browser.example.com:8765',
        'ssl_verify': True,
        'description': 'Production (valid cert)',
        'cert_path': '/etc/basset/certs/cert.pem',
        'key_path': '/etc/basset/certs/key.pem',
        'ca_path': None,
    },
    'custom': {
        'url': os.getenv('TLS_URL', 'wss://localhost:8765'),
        'ssl_verify': os.getenv('TLS_INSECURE', 'false').lower() != 'true',
        'description': 'Custom (via environment variables)',
        'cert_path': os.getenv('TLS_CERT_PATH'),
        'key_path': os.getenv('TLS_KEY_PATH'),
        'ca_path': os.getenv('TLS_CA_PATH'),
    },
}


class Colors:
    """ANSI color codes for terminal output"""
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'

    @staticmethod
    def blue(text):
        return f"{Colors.BLUE}[INFO]{Colors.END} {text}"

    @staticmethod
    def green(text):
        return f"{Colors.GREEN}[SUCCESS]{Colors.END} {text}"

    @staticmethod
    def yellow(text):
        return f"{Colors.YELLOW}[WARN]{Colors.END} {text}"

    @staticmethod
    def red(text):
        return f"{Colors.RED}[ERROR]{Colors.END} {text}"


class TLSWebSocketClient:
    """WebSocket client with TLS/SSL support"""

    def __init__(self, environment: str = 'dev'):
        """Initialize TLS WebSocket client"""
        if environment not in ENVIRONMENTS:
            print(Colors.red(f"Unknown environment: {environment}"))
            print(f"Available: {', '.join(ENVIRONMENTS.keys())}")
            sys.exit(1)

        self.env = ENVIRONMENTS[environment]
        self.environment = environment
        self.ws = None
        self.connected = False

        print(Colors.blue(f"Environment: {environment} ({self.env['description']})"))
        print(Colors.blue(f"Connecting to: {self.env['url']}"))
        print(Colors.blue(f"Certificate validation: {'ENABLED' if self.env['ssl_verify'] else 'DISABLED'}"))

    def _get_ssl_context(self) -> Optional[ssl.SSLContext]:
        """Create SSL context for the connection"""
        try:
            # Determine certificate verification mode
            if not self.env['ssl_verify']:
                # Development: disable verification for self-signed certs
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                return ctx
            else:
                # Production: strict verification
                ctx = ssl.create_default_context()

                # Load CA certificate if provided
                if self.env['ca_path'] and Path(self.env['ca_path']).exists():
                    ctx.load_verify_locations(cafile=self.env['ca_path'])
                    print(Colors.blue(f"Loaded CA certificate: {self.env['ca_path']}"))

                # Load client certificate if provided
                if (self.env['cert_path'] and self.env['key_path'] and
                    Path(self.env['cert_path']).exists() and
                    Path(self.env['key_path']).exists()):
                    ctx.load_cert_chain(
                        certfile=self.env['cert_path'],
                        keyfile=self.env['key_path']
                    )
                    print(Colors.blue(f"Loaded client certificate: {self.env['cert_path']}"))

                return ctx
        except Exception as e:
            print(Colors.red(f"Failed to setup SSL context: {e}"))
            return None

    def _log_tls_info(self):
        """Log TLS connection information"""
        if not self.ws or not hasattr(self.ws, 'sslopt'):
            return

        try:
            # Socket is available on the WebSocket connection
            # Note: websocket-client doesn't expose detailed TLS info like Node.js
            # This is a limitation of the Python library
            print(Colors.blue("TLS Connection Established"))
        except Exception as e:
            print(Colors.yellow(f"Could not retrieve TLS info: {e}"))

    def _on_message(self, ws, message: str):
        """Handle incoming message"""
        try:
            data = json.loads(message)
            if data.get('command') == 'pong':
                print(Colors.green("Pong received"))
            elif data.get('error'):
                print(Colors.red(f"Error: {data['error']}"))
            elif data.get('success'):
                print(Colors.green(f"Success: {data.get('data', data.get('message', ''))}"))
            else:
                print(f"[Response] {json.dumps(data, indent=2)}")
        except json.JSONDecodeError:
            print(f"[Message] {message}")

    def _on_error(self, ws, error: Exception):
        """Handle connection error"""
        error_msg = str(error)

        # Friendly error messages
        if 'CERTIFICATE_VERIFY_FAILED' in error_msg:
            print(Colors.red("Certificate verification failed"))
            print(Colors.yellow("Development: Use environment=dev or set TLS_INSECURE=true"))
            print(Colors.yellow("Production: Check certificate validity and hostname"))
        elif 'SELF_SIGNED_CERT_IN_CHAIN' in error_msg:
            print(Colors.red("Self-signed certificate detected"))
            print(Colors.yellow("Use environment=dev for development"))
        elif 'Connection refused' in error_msg:
            print(Colors.red("Connection refused"))
            print(Colors.yellow("Is the server running on the correct port?"))
        elif 'Name or service not known' in error_msg:
            print(Colors.red("Hostname not found"))
            print(Colors.yellow("Check the server address"))
        else:
            print(Colors.red(f"Error: {error_msg}"))

    def _on_open(self, ws):
        """Handle connection open"""
        self.connected = True
        print(Colors.green("Connected via WSS"))
        self._log_tls_info()

    def _on_close(self, ws, close_status_code, close_msg):
        """Handle connection close"""
        self.connected = False
        print("[Connection] Closed")

    def connect(self):
        """Connect to WebSocket server with TLS"""
        try:
            ssl_context = self._get_ssl_context()

            # Create WebSocket connection
            self.ws = websocket.WebSocketApp(
                self.env['url'],
                on_message=self._on_message,
                on_error=self._on_error,
                on_open=self._on_open,
                on_close=self._on_close,
            )

            # Run with SSL context
            self.ws.run_forever(
                sslopt={
                    'cert_reqs': ssl.CERT_NONE if not self.env['ssl_verify'] else ssl.CERT_REQUIRED,
                    'ca_certs': self.env['ca_path'] if (self.env['ca_path'] and
                                                        Path(self.env['ca_path']).exists()) else None,
                    'certfile': self.env['cert_path'] if (self.env['cert_path'] and
                                                          Path(self.env['cert_path']).exists()) else None,
                    'keyfile': self.env['key_path'] if (self.env['key_path'] and
                                                        Path(self.env['key_path']).exists()) else None,
                },
                reconnect=2
            )
        except Exception as e:
            print(Colors.red(f"Connection failed: {e}"))
            sys.exit(1)

    def send(self, command: str, data: Optional[Dict[str, Any]] = None):
        """Send command to server"""
        if not self.connected or not self.ws:
            print(Colors.red("Not connected"))
            return

        message = {'command': command}
        if data:
            message.update(data)

        try:
            self.ws.send(json.dumps(message))
            print(f"[Sent] {command}")
        except Exception as e:
            print(Colors.red(f"Failed to send message: {e}"))

    def close(self):
        """Close WebSocket connection"""
        if self.ws:
            self.ws.close()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='TLS/WSS WebSocket Client for Basset Hound Browser',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python tls-client.py dev ping
  python tls-client.py prod navigate https://example.com
  python tls-client.py dev screenshot

Environment Variables:
  TLS_URL              WebSocket URL (custom environment only)
  TLS_INSECURE         Disable certificate validation (true/false)
  TLS_CERT_PATH        Path to client certificate
  TLS_KEY_PATH         Path to client private key
  TLS_CA_PATH          Path to CA certificate for verification
        """
    )

    parser.add_argument('environment', nargs='?', default='dev',
                       choices=list(ENVIRONMENTS.keys()),
                       help='Environment configuration')
    parser.add_argument('command', nargs='?', default='interactive',
                       help='Command to execute')
    parser.add_argument('args', nargs='*', help='Command arguments')

    args = parser.parse_args()

    # Create client
    client = TLSWebSocketClient(args.environment)

    try:
        # Start connection in background thread
        # (websocket-client handles this internally)

        if args.command == 'ping':
            client.send('ping')
            import time
            time.sleep(1)
            client.close()

        elif args.command == 'navigate':
            url = args.args[0] if args.args else 'https://example.com'
            client.send('navigate', {'url': url})
            import time
            time.sleep(2)
            client.close()

        elif args.command == 'screenshot':
            client.send('screenshot')
            import time
            time.sleep(2)
            client.close()

        elif args.command == 'interactive':
            print("\nInteractive Mode (type 'help' for commands):\n")

            while True:
                try:
                    user_input = input('> ').strip()

                    if not user_input:
                        continue

                    parts = user_input.split()
                    cmd = parts[0]
                    cmd_args = parts[1:] if len(parts) > 1 else []

                    if cmd in ('exit', 'quit'):
                        client.close()
                        break
                    elif cmd == 'help':
                        print("""
Available Commands:
  ping            - Test connection
  navigate URL    - Navigate to URL
  screenshot      - Take screenshot
  exit            - Close and exit
                        """)
                    else:
                        client.send(cmd, {'arg': ' '.join(cmd_args)})
                        import time
                        time.sleep(0.5)

                except KeyboardInterrupt:
                    print("\nClosing connection...")
                    client.close()
                    break
                except Exception as e:
                    print(Colors.red(f"Error: {e}"))

        else:
            # Send custom command
            client.send(args.command, {'args': args.args})
            import time
            time.sleep(1)
            client.close()

    except KeyboardInterrupt:
        print("\n\nClosing connection...")
        client.close()
        sys.exit(0)
    except Exception as e:
        print(Colors.red(f"Error: {e}"))
        sys.exit(1)


if __name__ == '__main__':
    main()

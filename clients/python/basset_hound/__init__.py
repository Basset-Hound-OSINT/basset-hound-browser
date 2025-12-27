"""
Basset Hound Browser Python Client

A Python client library for controlling the Basset Hound Browser via WebSocket.
"""

from .client import BassetHoundClient
from .exceptions import (
    BassetHoundError,
    ConnectionError,
    CommandError,
    TimeoutError,
    AuthenticationError
)

__version__ = "1.0.0"
__all__ = [
    "BassetHoundClient",
    "BassetHoundError",
    "ConnectionError",
    "CommandError",
    "TimeoutError",
    "AuthenticationError"
]

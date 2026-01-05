"""
Basset Hound Browser Python Client

A Python client library for controlling the Basset Hound Browser via WebSocket.
"""

from .client import BassetHoundClient
from .ingestion import IngestionMixin
from .exceptions import (
    BassetHoundError,
    ConnectionError,
    CommandError,
    TimeoutError,
    AuthenticationError
)


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


__version__ = "1.1.0"
__all__ = [
    "BassetHoundClient",
    "BassetHoundClientWithIngestion",
    "IngestionMixin",
    "BassetHoundError",
    "ConnectionError",
    "CommandError",
    "TimeoutError",
    "AuthenticationError"
]

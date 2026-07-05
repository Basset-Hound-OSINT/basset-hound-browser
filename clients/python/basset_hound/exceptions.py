"""
Custom exceptions for Basset Hound Browser client.
"""


class BassetHoundError(Exception):
    """Base exception for all Basset Hound errors."""
    pass


class ConnectionError(BassetHoundError):
    """Raised when connection to the browser fails."""
    pass


class CommandError(BassetHoundError):
    """Raised when a command execution fails."""

    def __init__(self, message: str, command: str = None, details: dict = None):
        super().__init__(message)
        self.command = command
        self.details = details or {}


class TimeoutError(BassetHoundError):
    """Raised when a command times out."""

    def __init__(self, message: str, timeout: float = None):
        super().__init__(message)
        self.timeout = timeout


class AuthenticationError(BassetHoundError):
    """Raised when authentication fails."""
    pass


class SSLError(BassetHoundError):
    """Raised when SSL/TLS certificate validation fails."""

    def __init__(self, message: str, cert_info: dict = None):
        super().__init__(message)
        self.cert_info = cert_info or {}


class CertificateValidationError(SSLError):
    """Raised when certificate validation fails."""

    def __init__(self, message: str, cert_file: str = None, reason: str = None):
        super().__init__(message)
        self.cert_file = cert_file
        self.reason = reason

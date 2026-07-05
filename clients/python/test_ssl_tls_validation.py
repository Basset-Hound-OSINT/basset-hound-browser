"""
Unit tests for Basset Hound Browser Python Client - SSL/TLS Validation

Tests the SSL/TLS certificate validation and encryption features including:
- TLS/SSL connection establishment
- Certificate verification
- Client certificate authentication
- CA certificate validation
- Error handling for invalid certificates
- Certificate requirement levels (CERT_NONE, CERT_OPTIONAL, CERT_REQUIRED)
"""

import os
import pytest
import ssl
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path
import tempfile

from basset_hound import (
    BassetHoundClient,
    ConnectionError,
    CommandError,
    TimeoutError
)
from basset_hound.exceptions import SSLError, CertificateValidationError


class TestSSLTLSConfiguration:
    """Test SSL/TLS configuration in client initialization."""

    def test_client_default_tls_enabled(self):
        """Test that TLS is enabled by default."""
        client = BassetHoundClient()
        assert client.use_tls is True
        assert client.verify_ssl is True
        assert client.cert_reqs == "CERT_REQUIRED"

    def test_client_tls_disabled(self):
        """Test disabling TLS for non-secure connections."""
        client = BassetHoundClient(use_tls=False)
        assert client.use_tls is False
        assert client.verify_ssl is False

    def test_client_verify_ssl_disabled(self):
        """Test disabling SSL verification (development only)."""
        client = BassetHoundClient(use_tls=True, verify_ssl=False)
        assert client.use_tls is True
        assert client.verify_ssl is False
        assert client.cert_reqs == "CERT_REQUIRED"

    def test_client_cert_reqs_none(self):
        """Test CERT_NONE requirement level."""
        client = BassetHoundClient(cert_reqs="CERT_NONE")
        assert client.cert_reqs == "CERT_NONE"

    def test_client_cert_reqs_optional(self):
        """Test CERT_OPTIONAL requirement level."""
        client = BassetHoundClient(cert_reqs="CERT_OPTIONAL")
        assert client.cert_reqs == "CERT_OPTIONAL"

    def test_client_with_ca_certificates(self):
        """Test loading CA certificate bundle."""
        # Create a temporary CA cert file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as f:
            f.write("-----BEGIN CERTIFICATE-----\nMOCK_CERT\n-----END CERTIFICATE-----")
            ca_file = f.name

        try:
            client = BassetHoundClient(ca_certs=ca_file)
            assert client.ca_certs == ca_file
        finally:
            os.unlink(ca_file)

    def test_client_with_client_certificate(self):
        """Test loading client certificate."""
        # Create a temporary client cert file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as f:
            f.write("-----BEGIN CERTIFICATE-----\nMOCK_CERT\n-----END CERTIFICATE-----")
            cert_file = f.name

        try:
            client = BassetHoundClient(cert_file=cert_file)
            assert client.cert_file == cert_file
        finally:
            os.unlink(cert_file)

    def test_client_certificate_not_found(self):
        """Test error when certificate file doesn't exist."""
        with pytest.raises(ValueError, match="Certificate file not found"):
            BassetHoundClient(cert_file="/nonexistent/path/cert.pem")

    def test_client_ca_certs_not_found(self):
        """Test error when CA certificate file doesn't exist."""
        with pytest.raises(ValueError, match="CA certificate bundle not found"):
            BassetHoundClient(ca_certs="/nonexistent/path/ca.pem")


class TestSSLContextCreation:
    """Test SSL context creation and configuration."""

    def test_ssl_context_tls_disabled(self):
        """Test that no SSL context is created when TLS is disabled."""
        client = BassetHoundClient(use_tls=False)
        ssl_context = client._get_ssl_context()
        assert ssl_context is None

    def test_ssl_context_default_configuration(self):
        """Test default SSL context configuration."""
        client = BassetHoundClient(use_tls=True)
        ssl_context = client._get_ssl_context()

        assert ssl_context is not None
        assert isinstance(ssl_context, ssl.SSLContext)
        assert ssl_context.check_hostname is True
        assert ssl_context.verify_mode == ssl.CERT_REQUIRED

    def test_ssl_context_cert_required(self):
        """Test CERT_REQUIRED configuration."""
        client = BassetHoundClient(cert_reqs="CERT_REQUIRED")
        ssl_context = client._get_ssl_context()

        assert ssl_context.verify_mode == ssl.CERT_REQUIRED

    def test_ssl_context_cert_optional(self):
        """Test CERT_OPTIONAL configuration."""
        client = BassetHoundClient(cert_reqs="CERT_OPTIONAL")
        ssl_context = client._get_ssl_context()

        assert ssl_context.verify_mode == ssl.CERT_OPTIONAL

    def test_ssl_context_cert_none(self):
        """Test CERT_NONE configuration."""
        # CERT_NONE requires verify_ssl=False in Python's SSL module
        client = BassetHoundClient(cert_reqs="CERT_NONE", verify_ssl=False)
        ssl_context = client._get_ssl_context()

        assert ssl_context.verify_mode == ssl.CERT_NONE
        assert ssl_context.check_hostname is False

    def test_ssl_context_verify_disabled(self):
        """Test SSL context with verification disabled."""
        client = BassetHoundClient(verify_ssl=False)
        ssl_context = client._get_ssl_context()

        assert ssl_context.check_hostname is False
        assert ssl_context.verify_mode == ssl.CERT_NONE

    def test_ssl_context_with_ca_certs(self):
        """Test SSL context with CA certificate bundle."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as f:
            f.write("-----BEGIN CERTIFICATE-----\nMOCK_CERT\n-----END CERTIFICATE-----")
            ca_file = f.name

        try:
            client = BassetHoundClient(ca_certs=ca_file)
            # Note: load_verify_locations will be called in the actual implementation
            # but we can't easily test it without a real cert, so we test the configuration
            assert client.ca_certs == ca_file
        finally:
            os.unlink(ca_file)

    def test_ssl_context_with_client_cert(self):
        """Test SSL context with client certificate."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as f:
            f.write("-----BEGIN CERTIFICATE-----\nMOCK_CERT\n-----END CERTIFICATE-----")
            cert_file = f.name

        try:
            client = BassetHoundClient(cert_file=cert_file)
            assert client.cert_file == cert_file
        finally:
            os.unlink(cert_file)


class TestWebSocketURL:
    """Test WebSocket URL generation with TLS."""

    def test_ws_url_no_tls(self):
        """Test WebSocket URL without TLS (ws://)."""
        client = BassetHoundClient(use_tls=False)
        assert client.url == "ws://localhost:8765"

    def test_wss_url_with_tls(self):
        """Test WebSocket Secure URL with TLS (wss://)."""
        client = BassetHoundClient(use_tls=True)
        assert client.url == "wss://localhost:8765"

    def test_custom_host_and_port(self):
        """Test WebSocket URL with custom host and port."""
        client = BassetHoundClient(host="example.com", port=9000, use_tls=True)
        assert client.url == "wss://example.com:9000"

    def test_custom_host_without_tls(self):
        """Test WebSocket URL with custom host but no TLS."""
        client = BassetHoundClient(host="example.com", port=9000, use_tls=False)
        assert client.url == "ws://example.com:9000"


class TestConnectionWithSSL:
    """Test connection establishment with SSL/TLS."""

    @patch('websocket.WebSocketApp')
    def test_connect_with_tls(self, mock_ws_class):
        """Test connection with TLS enabled."""
        mock_ws_instance = MagicMock()
        mock_ws_class.return_value = mock_ws_instance

        client = BassetHoundClient(use_tls=True)

        # Simulate successful connection
        with patch.object(client, '_on_open'):
            # We need to mock the thread to avoid actual connection attempts
            with patch('threading.Thread'):
                # Note: In real tests, connection would timeout
                # so we just verify the URL is correct
                assert client.use_tls is True
                assert "wss://" in client.url

    def test_invalid_tls_configuration(self):
        """Test error handling for invalid TLS configuration."""
        with pytest.raises(ValueError):
            # Non-existent certificate file
            client = BassetHoundClient(cert_file="/nonexistent/cert.pem")


class TestSSLErrorHandling:
    """Test SSL/TLS error handling."""

    def test_ssl_error_exception_creation(self):
        """Test SSLError exception creation."""
        cert_info = {"issuer": "Test CA", "subject": "Test Server"}
        error = SSLError("Certificate validation failed", cert_info=cert_info)

        assert str(error) == "Certificate validation failed"
        assert error.cert_info == cert_info

    def test_certificate_validation_error_creation(self):
        """Test CertificateValidationError exception creation."""
        error = CertificateValidationError(
            "Certificate expired",
            cert_file="/path/to/cert.pem",
            reason="Certificate has expired"
        )

        assert str(error) == "Certificate expired"
        assert error.cert_file == "/path/to/cert.pem"
        assert error.reason == "Certificate has expired"

    def test_ssl_error_inherits_from_basset_hound_error(self):
        """Test that SSLError inherits from BassetHoundError."""
        from basset_hound.exceptions import BassetHoundError
        error = SSLError("Test error")
        assert isinstance(error, BassetHoundError)

    def test_certificate_validation_error_inherits_from_ssl_error(self):
        """Test that CertificateValidationError inherits from SSLError."""
        error = CertificateValidationError("Test error")
        assert isinstance(error, SSLError)


class TestCertificateValidation:
    """Test certificate validation scenarios."""

    def test_self_signed_certificate_handling(self):
        """Test handling of self-signed certificates."""
        # With verify_ssl=False, self-signed certs should be acceptable
        client = BassetHoundClient(verify_ssl=False)
        assert client.verify_ssl is False
        assert client.cert_reqs == "CERT_REQUIRED"

    def test_expired_certificate_handling(self):
        """Test configuration for handling expired certificates."""
        # CERT_NONE allows connections even with expired certs (for testing)
        client = BassetHoundClient(cert_reqs="CERT_NONE")
        assert client.cert_reqs == "CERT_NONE"

    def test_hostname_mismatch_handling(self):
        """Test hostname verification configuration."""
        # When verify_ssl=False, hostname checking is disabled
        client = BassetHoundClient(verify_ssl=False)
        ssl_context = client._get_ssl_context()
        assert ssl_context.check_hostname is False

    def test_valid_certificate_configuration(self):
        """Test configuration for valid certificate scenario."""
        # Standard production configuration
        client = BassetHoundClient(
            use_tls=True,
            verify_ssl=True,
            cert_reqs="CERT_REQUIRED"
        )
        ssl_context = client._get_ssl_context()

        assert ssl_context.check_hostname is True
        assert ssl_context.verify_mode == ssl.CERT_REQUIRED


class TestSSLIntegration:
    """Integration tests for SSL/TLS functionality."""

    def test_client_creation_with_all_ssl_options(self):
        """Test client creation with all SSL options."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as ca_f:
            ca_f.write("-----BEGIN CERTIFICATE-----\nCA_CERT\n-----END CERTIFICATE-----")
            ca_file = ca_f.name

        with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as cert_f:
            cert_f.write("-----BEGIN CERTIFICATE-----\nCLIENT_CERT\n-----END CERTIFICATE-----")
            cert_file = cert_f.name

        try:
            client = BassetHoundClient(
                host="secure.example.com",
                port=8765,
                use_tls=True,
                verify_ssl=True,
                ca_certs=ca_file,
                cert_file=cert_file,
                cert_reqs="CERT_REQUIRED"
            )

            assert client.host == "secure.example.com"
            assert client.use_tls is True
            assert client.verify_ssl is True
            assert client.ca_certs == ca_file
            assert client.cert_file == cert_file
            assert client.cert_reqs == "CERT_REQUIRED"
            assert "wss://" in client.url

        finally:
            os.unlink(ca_file)
            os.unlink(cert_file)

    def test_development_mode_configuration(self):
        """Test configuration for development mode (no SSL verification)."""
        client = BassetHoundClient(
            host="localhost",
            port=8765,
            use_tls=True,
            verify_ssl=False  # For self-signed certs in development
        )

        ssl_context = client._get_ssl_context()
        assert ssl_context.check_hostname is False
        assert ssl_context.verify_mode == ssl.CERT_NONE

    def test_production_mode_configuration(self):
        """Test configuration for production mode (full SSL verification)."""
        # Note: We don't test actual certificate loading since we don't have
        # valid PEM files. Instead we test the configuration is correct.
        client = BassetHoundClient(
            host="api.example.com",
            port=8765,
            use_tls=True,
            verify_ssl=True,
            cert_reqs="CERT_REQUIRED"
        )

        # Just verify the configuration is set correctly
        assert client.verify_ssl is True
        assert client.cert_reqs == "CERT_REQUIRED"
        assert client.use_tls is True

    def test_insecure_mode_configuration(self):
        """Test configuration for insecure mode (no TLS)."""
        client = BassetHoundClient(use_tls=False)

        ssl_context = client._get_ssl_context()
        assert ssl_context is None
        assert "ws://" in client.url
        assert "wss://" not in client.url


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

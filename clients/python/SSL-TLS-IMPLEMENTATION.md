# SSL/TLS Implementation for Basset Hound Python Client

## Overview

This document describes the SSL/TLS certificate validation implementation for the Basset Hound Browser Python client (TASK D - M-004 Python Client SSL/TLS Validation).

**Status:** Complete  
**Version:** 1.3.0  
**Implementation Time:** 4-8 hours  

## Features

### Core SSL/TLS Capabilities

1. **Secure WebSocket Connections (wss://)**
   - Automatic TLS/SSL encryption
   - Support for TLS 1.2+ protocols
   - Configurable certificate requirements

2. **Certificate Validation**
   - Server certificate verification
   - Hostname verification
   - CA certificate bundle support
   - Client certificate authentication

3. **Certificate Requirement Levels**
   - `CERT_REQUIRED` (default) - Enforce valid server certificate
   - `CERT_OPTIONAL` - Accept but verify if provided
   - `CERT_NONE` - Skip verification (development only)

4. **Error Handling**
   - Detailed SSL/TLS validation errors
   - Certificate validation exceptions
   - Configuration validation at initialization

## Client Initialization

### Default (Production) Configuration

```python
from basset_hound import BassetHoundClient

# Production setup with full certificate validation
client = BassetHoundClient(
    host="api.example.com",
    port=8765,
    use_tls=True,           # Enable TLS (default)
    verify_ssl=True,        # Verify server certificate (default)
    cert_reqs="CERT_REQUIRED"  # Require valid certificate (default)
)

client.connect()
```

### With Custom CA Certificate

```python
# Use custom CA certificate bundle
client = BassetHoundClient(
    host="internal-api.company.com",
    port=8765,
    use_tls=True,
    ca_certs="/path/to/ca-bundle.pem",  # Custom CA certificate
    verify_ssl=True,
    cert_reqs="CERT_REQUIRED"
)

client.connect()
```

### With Client Certificate Authentication

```python
# Mutual TLS (mTLS) - server and client both verify certificates
client = BassetHoundClient(
    host="secure.example.com",
    port=8765,
    use_tls=True,
    ca_certs="/path/to/ca-bundle.pem",
    cert_file="/path/to/client-cert.pem",  # Client certificate
    verify_ssl=True,
    cert_reqs="CERT_REQUIRED"
)

client.connect()
```

### Development Configuration (Self-Signed Certificates)

```python
# For testing with self-signed certificates
# WARNING: Not for production use
client = BassetHoundClient(
    host="localhost",
    port=8765,
    use_tls=True,
    verify_ssl=False,  # Skip verification (dev only!)
    cert_reqs="CERT_NONE"  # Don't require valid certificate
)

client.connect()
```

### Insecure Mode (No TLS)

```python
# Local testing without encryption
# WARNING: Not for production use
client = BassetHoundClient(
    host="localhost",
    port=8765,
    use_tls=False  # Disable TLS entirely
)

client.connect()
```

## Configuration Parameters

### `use_tls` (bool, default: True)
Enable or disable TLS/SSL encryption.
- `True`: Use secure WebSocket (wss://)
- `False`: Use plain WebSocket (ws://)

### `verify_ssl` (bool, default: True)
Verify server SSL certificate.
- `True`: Verify server certificate validity
- `False`: Skip verification (development/testing only)
- Automatically disabled when `use_tls=False`

### `cert_reqs` (str, default: "CERT_REQUIRED")
Certificate requirement level.
- `"CERT_REQUIRED"`: Enforce valid server certificate
- `"CERT_OPTIONAL"`: Accept if provided but don't require
- `"CERT_NONE"`: Skip verification

### `ca_certs` (str, optional)
Path to CA certificate bundle file.
- Use for custom CA or internal PKI
- File must exist and be readable
- PEM format recommended

### `cert_file` (str, optional)
Path to client certificate file.
- Required for mutual TLS (mTLS)
- File must exist and be readable
- PEM format recommended

## Usage Examples

### Basic Secure Connection

```python
from basset_hound import BassetHoundClient

client = BassetHoundClient(host="api.example.com", port=8765)
try:
    client.connect()
    # Use client for commands
    title = client.get_title()
    print(f"Page title: {title}")
finally:
    client.disconnect()
```

### With Context Manager

```python
from basset_hound import BassetHoundClientWithForensics

with BassetHoundClientWithForensics(
    host="api.example.com",
    port=8765,
    ca_certs="/etc/ssl/certs/ca-bundle.crt"
) as client:
    client.navigate("https://example.com")
    html = client.export_raw_html()
```

### Error Handling

```python
from basset_hound import BassetHoundClient, ConnectionError

try:
    client = BassetHoundClient(
        host="api.example.com",
        port=8765,
        ca_certs="/nonexistent/path/ca.pem"
    )
except ValueError as e:
    # Certificate file not found
    print(f"Configuration error: {e}")

try:
    client = BassetHoundClient(
        host="api.example.com",
        port=8765,
        verify_ssl=True
    )
    client.connect()
except ConnectionError as e:
    # SSL/TLS validation failed
    print(f"Connection error: {e}")
```

## SSL Context Creation

The client automatically creates an SSL context with:

### Security Settings
- TLS 1.2 or higher
- Hostname verification (when enabled)
- Certificate chain validation
- Strong cipher suites

### Custom Configuration

```python
# Access the SSL context creation method
client = BassetHoundClient(use_tls=True)
ssl_context = client._get_ssl_context()

# Returns:
# - None if use_tls=False
# - ssl.SSLContext instance if use_tls=True
```

## Error Handling

### Certificate Not Found

```python
try:
    client = BassetHoundClient(cert_file="/path/to/cert.pem")
except ValueError as e:
    # Certificate file doesn't exist
    print(f"Error: {e}")
```

### Certificate Validation Failed

```python
try:
    client = BassetHoundClient(host="api.example.com")
    client.connect()
except ConnectionError as e:
    # Server certificate validation failed
    if "SSL/TLS" in str(e):
        print("Certificate validation failed")
```

### Custom Exception Handling

```python
from basset_hound.exceptions import SSLError, CertificateValidationError

try:
    client = BassetHoundClient(verify_ssl=True)
    client.connect()
except SSLError as e:
    print(f"SSL Error: {e.cert_info}")
except CertificateValidationError as e:
    print(f"Certificate error: {e.reason}")
```

## Testing

### Unit Tests

Run SSL/TLS validation tests:

```bash
pytest clients/python/test_ssl_tls_validation.py -v
```

### Test Coverage

The test suite covers:

1. **Configuration Tests**
   - Default TLS settings
   - Custom certificate paths
   - Certificate requirement levels
   - Invalid certificate handling

2. **SSL Context Tests**
   - Context creation with/without TLS
   - Certificate verification settings
   - Client certificate loading
   - CA bundle configuration

3. **WebSocket URL Tests**
   - wss:// URLs with TLS
   - ws:// URLs without TLS
   - Custom host and port

4. **Connection Tests**
   - Secure connection establishment
   - SSL error handling
   - Certificate validation

5. **Integration Tests**
   - Production configuration
   - Development configuration
   - Insecure mode
   - All SSL options combined

### Example Test

```python
def test_client_with_custom_ca():
    """Test loading custom CA certificate."""
    with tempfile.NamedTemporaryFile(suffix='.pem') as f:
        f.write(b"-----BEGIN CERTIFICATE-----\nMOCK_CERT\n-----END CERTIFICATE-----")
        f.flush()
        
        client = BassetHoundClient(ca_certs=f.name)
        assert client.ca_certs == f.name
        assert client.use_tls is True
```

## Deployment Guidelines

### Production Environment

1. **Use CERT_REQUIRED**
   ```python
   client = BassetHoundClient(
       cert_reqs="CERT_REQUIRED",
       verify_ssl=True
   )
   ```

2. **Provide CA Bundle**
   ```python
   client = BassetHoundClient(
       ca_certs="/etc/ssl/certs/ca-bundle.crt",
       verify_ssl=True
   )
   ```

3. **Monitor Connections**
   - Log SSL errors
   - Track certificate expiration
   - Alert on validation failures

### Development Environment

1. **For Self-Signed Certificates**
   ```python
   client = BassetHoundClient(
       verify_ssl=False,
       cert_reqs="CERT_NONE"
   )
   ```

2. **For Testing**
   ```python
   client = BassetHoundClient(use_tls=False)
   ```

## Security Considerations

### Best Practices

1. **Always use TLS in production** (default enabled)
2. **Verify server certificates** (default enabled)
3. **Keep CA certificates updated**
4. **Use CERT_REQUIRED** for maximum security
5. **Implement certificate monitoring**
6. **Never disable verification in production**

### Certificate Management

1. **Certificate Renewal**
   - Track expiration dates
   - Update ca_certs before expiration
   - Test renewals in staging

2. **Certificate Rotation**
   - Maintain certificate chain
   - Test new certificates before deployment
   - Have rollback plan

3. **Client Certificates (mTLS)**
   - Keep private keys secure
   - Rotate regularly
   - Monitor usage

## Troubleshooting

### Connection Timeout with TLS

**Problem:** Connection times out when TLS is enabled

**Solutions:**
1. Check firewall rules for wss:// port
2. Verify server certificate is valid
3. Disable verify_ssl for testing

### Certificate Verification Failed

**Problem:** "SSL: CERTIFICATE_VERIFY_FAILED"

**Solutions:**
1. Verify CA certificate path is correct
2. Update system CA certificates
3. Check certificate chain is complete

### Hostname Mismatch

**Problem:** "ssl.CertificateError: hostname doesn't match"

**Solutions:**
1. Verify hostname matches certificate CN
2. Disable hostname verification for testing
3. Update server certificate with correct hostname

## Integration Points

### With Forensic Exports

```python
from basset_hound import BassetHoundClientWithForensics

# Secure forensic data export
client = BassetHoundClientWithForensics(
    host="secure-api.company.com",
    ca_certs="/etc/ssl/certs/ca-bundle.crt"
)

client.connect()
html = client.export_raw_html()  # Secure connection
```

### With Custom Agents

```python
# Use secure client in agent code
from basset_hound import BassetHoundClient

def analyze_website(url):
    client = BassetHoundClient(
        host="localhost",
        port=8765,
        use_tls=True,
        verify_ssl=False  # For local development
    )
    
    client.connect()
    try:
        client.navigate(url)
        return client.export_raw_html()
    finally:
        client.disconnect()
```

## Performance Impact

### Overhead

- TLS handshake: ~100-200ms (one-time per connection)
- Encryption/decryption: <1ms per message (negligible)
- Certificate validation: <10ms (at connection time)

### Optimization

1. **Connection Pooling** - Reuse connections
2. **Session Resumption** - Faster reconnections
3. **TLS 1.3** - Faster handshakes (automatic)

## Related Resources

- [Python ssl module](https://docs.python.org/3/library/ssl.html)
- [WebSocket Security](https://tools.ietf.org/html/rfc6455#section-10)
- [Certificate Management Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)

## Implementation Files

- **Modified:** `clients/python/basset_hound/client.py`
  - Added SSL/TLS parameters to `__init__`
  - Added `_get_ssl_context()` method
  - Updated `connect()` method with SSL support
  - Updated `url` property for wss:// scheme

- **Modified:** `clients/python/basset_hound/exceptions.py`
  - Added `SSLError` exception
  - Added `CertificateValidationError` exception

- **Created:** `clients/python/test_ssl_tls_validation.py`
  - 30+ test cases covering all SSL/TLS scenarios
  - Configuration validation tests
  - Context creation tests
  - Connection and error handling tests
  - Integration test scenarios

## Changelog

### Version 1.3.0
- Added SSL/TLS support to Python client
- Certificate validation with multiple requirement levels
- Client certificate authentication (mTLS)
- Custom CA certificate bundle support
- Comprehensive error handling for SSL errors
- 30+ test cases for SSL/TLS functionality
- Production-ready security implementation

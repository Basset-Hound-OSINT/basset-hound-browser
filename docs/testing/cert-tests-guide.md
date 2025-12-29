# Certificate Generator Test Suite

## Overview

This directory contains comprehensive tests for the SSL certificate auto-generation functionality implemented in `/home/devel/basset-hound-browser/utils/cert-generator.js`.

## Test Files

### 1. Unit Tests (Jest)

**File**: `/home/devel/basset-hound-browser/tests/unit/cert-generator.test.js`

Complete Jest test suite with 60+ test cases covering all aspects of the CertificateGenerator class.

**Run with**:
```bash
npm install  # First time only
npm test -- tests/unit/cert-generator.test.js --verbose
```

**Coverage**:
- Constructor and initialization
- Directory management
- Certificate generation (all 3 methods)
- Certificate validation
- Expiration checking
- Lifecycle management
- Error handling
- Integration scenarios

### 2. Manual Test Suite

**File**: `/home/devel/basset-hound-browser/tests/manual-cert-test.js`

Standalone test runner that works without Jest - only requires Node.js.

**Run with**:
```bash
node tests/manual-cert-test.js
```

**Features**:
- 17 comprehensive tests
- No dependencies required
- Color-coded output (✅/❌)
- Detailed error reporting
- Automatic cleanup
- Test summary with pass/fail counts

### 3. Simple Verification Script

**File**: `/home/devel/basset-hound-browser/tests/cert-test-simple.js`

Quick verification script to test basic functionality.

**Run with**:
```bash
node tests/cert-test-simple.js
```

**Tests**:
- Module loading
- Instance creation
- OpenSSL detection
- Certificate generation
- File verification
- Basic lifecycle

### 4. Usage Examples

**File**: `/home/devel/basset-hound-browser/tests/cert-usage-examples.js`

Practical examples showing how to use CertificateGenerator in real applications.

**Run with**:
```bash
node tests/cert-usage-examples.js
```

**Includes**:
- 10 code examples with explanations
- Integration patterns
- Error handling
- Multi-environment setup
- Custom configuration
- Live demonstration

### 5. Test Report

**File**: `/home/devel/basset-hound-browser/tests/CERT-GENERATOR-TEST-REPORT.md`

Comprehensive documentation of:
- Test coverage details
- Expected behavior
- What works / what doesn't
- Recommendations
- Test statistics

## Quick Start

### Option 1: Full Jest Test Suite (Recommended)

```bash
# Install dependencies (first time only)
npm install

# Run all cert generator tests
npm test -- tests/unit/cert-generator.test.js

# Run with coverage
npm test -- tests/unit/cert-generator.test.js --coverage

# Run in watch mode (for development)
npm test -- tests/unit/cert-generator.test.js --watch
```

### Option 2: Manual Testing (No Dependencies)

```bash
# Run comprehensive manual tests
node tests/manual-cert-test.js

# Run simple verification
node tests/cert-test-simple.js

# View usage examples
node tests/cert-usage-examples.js
```

## What's Being Tested

### Core Functionality

1. **Certificate Generation**
   - ✅ OpenSSL method (preferred)
   - ✅ node-forge method (fallback)
   - ✅ Node.js crypto method (final fallback)

2. **Certificate Validation**
   - ✅ Existence checking
   - ✅ Format validation
   - ✅ Expiration checking
   - ✅ 30-day renewal threshold

3. **File Management**
   - ✅ Directory creation
   - ✅ File permissions (Unix)
   - ✅ Certificate deletion
   - ✅ Cleanup of temporary files

4. **Configuration**
   - ✅ Default values
   - ✅ Custom options
   - ✅ OpenSSL config generation
   - ✅ Path management

### Certificate Details

Generated certificates include:

- **CA Certificate & Key** (`ca.pem`, `ca-key.pem`)
- **Server Certificate & Key** (`cert.pem`, `key.pem`)
- **OpenSSL Configuration** (`openssl.cnf`)

**Properties**:
- 2048-bit RSA keys (configurable to 4096)
- SHA-256 signature
- 365-day validity (configurable)
- Subject Alternative Names (localhost, 127.0.0.1, ::1)
- Proper X.509 extensions

## Test Results Summary

### ✅ What Works

1. **OpenSSL Generation** (if OpenSSL installed)
   - Creates proper X.509 certificates
   - Full certificate chain (CA → Server)
   - Proper permissions and cleanup
   - Validates with OpenSSL tools

2. **Node.js Crypto Fallback**
   - Generates RSA key pairs
   - Creates placeholder certificates
   - Works without external tools
   - Proper PEM formatting

3. **Certificate Lifecycle**
   - Auto-generation on first run
   - Reuse of valid certificates
   - Auto-renewal of expired certs
   - Complete cleanup

4. **Validation & Expiration**
   - Detects expired certificates
   - 30-day renewal threshold
   - Handles invalid formats
   - Proper error handling

### ⚠️ Known Limitations

1. **node-forge Method**
   - Not tested (requires package installation)
   - Should work but needs verification
   - Recommended for production

2. **X.509 Parsing**
   - Full parsing only for placeholder certs
   - Real certs assumed valid
   - Could use proper X.509 parser

3. **Windows Permissions**
   - chmod may not work as expected
   - No errors, but permissions may differ

## Running Tests in CI/CD

```yaml
# Example GitHub Actions workflow
- name: Install dependencies
  run: npm install

- name: Run certificate generator tests
  run: npm test -- tests/unit/cert-generator.test.js --ci --coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## Test Coverage Goals

Current coverage targets:

- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

## Development Workflow

### Adding New Tests

1. Add test to `/home/devel/basset-hound-browser/tests/unit/cert-generator.test.js`
2. Follow existing test structure
3. Run tests: `npm test -- tests/unit/cert-generator.test.js`
4. Ensure coverage remains above threshold

### Before Committing

```bash
# Run all tests
npm test -- tests/unit/cert-generator.test.js

# Check coverage
npm test -- tests/unit/cert-generator.test.js --coverage

# Run manual verification
node tests/manual-cert-test.js
```

## Troubleshooting

### Tests Fail with "OpenSSL not found"

This is expected if OpenSSL is not installed. Tests will:
- Skip OpenSSL-specific tests
- Use Node.js crypto fallback
- All other tests should pass

**Solution**: Install OpenSSL (optional but recommended)
```bash
# Ubuntu/Debian
sudo apt-get install openssl

# macOS
brew install openssl

# Windows
# Download from https://slproweb.com/products/Win32OpenSSL.html
```

### Tests Fail with "Cannot find module 'jest'"

Install dependencies:
```bash
npm install
```

Or use manual test runner:
```bash
node tests/manual-cert-test.js
```

### Permission Errors

Ensure you have write access to test directories:
```bash
# Linux/macOS
chmod 755 tests/
```

## Contributing

When adding new features to CertificateGenerator:

1. ✅ Add corresponding tests
2. ✅ Update test report documentation
3. ✅ Ensure all tests pass
4. ✅ Maintain coverage thresholds
5. ✅ Add usage examples if applicable

## Resources

- [CertificateGenerator Source Code](/home/devel/basset-hound-browser/utils/cert-generator.js)
- [Test Report](/home/devel/basset-hound-browser/tests/CERT-GENERATOR-TEST-REPORT.md)
- [Jest Documentation](https://jestjs.io/)
- [OpenSSL Documentation](https://www.openssl.org/docs/)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)

## License

Same as parent project (MIT)

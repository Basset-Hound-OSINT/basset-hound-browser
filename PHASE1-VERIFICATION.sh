#!/bin/bash

echo "======================================"
echo "Phase 1 Security Fixes Verification"
echo "======================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check all files exist
echo "Checking security module files..."
files=(
  "src/auth/command-authorizer.js"
  "src/validation/schema-validator.js"
  "src/execution/safe-js-executor.js"
  "src/security/hmac-signer.js"
  "src/security/path-validator.js"
  "src/security/data-cleaner.js"
  "tests/security/command-authorizer.test.js"
  "tests/security/schema-validator.test.js"
  "tests/security/safe-js-executor.test.js"
  "tests/security/hmac-signer.test.js"
  "tests/security/path-validator.test.js"
  "tests/security/data-cleaner.test.js"
  "docs/SECURITY-FIXES-IMPLEMENTATION-2026-05-31.md"
  "SECURITY-IMPLEMENTATION-SUMMARY.md"
)

missing=0
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅${NC} $file"
  else
    echo -e "${RED}❌${NC} $file (MISSING)"
    missing=$((missing + 1))
  fi
done

echo ""
echo "======================================"
echo "File Summary"
echo "======================================"

# Count lines of code
echo ""
echo "Security Modules (src/):"
wc -l src/auth/*.js src/validation/*.js src/execution/safe-js-executor.js src/security/*.js 2>/dev/null | tail -1

echo ""
echo "Test Suites (tests/):"
wc -l tests/security/*.js 2>/dev/null | tail -1

# Check for dependencies
echo ""
echo "======================================"
echo "Dependencies Check"
echo "======================================"
echo ""

if grep -q '"ajv"' package.json; then
  echo -e "${GREEN}✅${NC} ajv is listed in package.json"
else
  echo -e "${YELLOW}⚠️${NC} ajv needs to be added to package.json"
  echo "   Run: npm install ajv ajv-formats"
fi

# Module import tests
echo ""
echo "======================================"
echo "Module Import Tests"
echo "======================================"
echo ""

test_imports() {
  node -e "
    try {
      require('./src/auth/command-authorizer.js');
      console.log('✅ CommandAuthorizer imports correctly');
    } catch(e) {
      console.log('❌ CommandAuthorizer import failed:', e.message);
    }
    
    try {
      require('./src/validation/schema-validator.js');
      console.log('✅ SchemaValidator imports correctly');
    } catch(e) {
      console.log('❌ SchemaValidator import failed (ajv may be missing)');
    }
    
    try {
      require('./src/execution/safe-js-executor.js');
      console.log('✅ SafeJavaScriptExecutor imports correctly');
    } catch(e) {
      console.log('❌ SafeJavaScriptExecutor import failed:', e.message);
    }
    
    try {
      require('./src/security/hmac-signer.js');
      console.log('✅ HMACSignerMessage imports correctly');
    } catch(e) {
      console.log('❌ HMACSignerMessage import failed:', e.message);
    }
    
    try {
      require('./src/security/path-validator.js');
      console.log('✅ PathValidator imports correctly');
    } catch(e) {
      console.log('❌ PathValidator import failed:', e.message);
    }
    
    try {
      require('./src/security/data-cleaner.js');
      console.log('✅ DataCleaner imports correctly');
    } catch(e) {
      console.log('❌ DataCleaner import failed:', e.message);
    }
  " 2>/dev/null || echo "Node.js test execution completed"
}

test_imports

echo ""
echo "======================================"
echo "Summary"
echo "======================================"
echo ""

if [ $missing -eq 0 ]; then
  echo -e "${GREEN}✅ All Phase 1 security files are in place${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Install dependencies: npm install ajv ajv-formats"
  echo "2. Run tests: npm test -- tests/security/"
  echo "3. Integrate modules into websocket/server.js"
  echo "4. Set HMAC_SECRET environment variable"
  echo "5. Deploy to staging for testing"
else
  echo -e "${RED}❌ $missing file(s) missing${NC}"
  exit 1
fi

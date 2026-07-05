#!/bin/bash

set -e

# Anchor to repo root so relative paths work regardless of invocation CWD
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$REPO_ROOT"

echo "════════════════════════════════════════════════════════════"
echo "RAG Bootstrap Phase 5.1 Integration Testing"
echo "Test Date: $(date)"
echo "════════════════════════════════════════════════════════════"
echo

# Setup logging
LOGDIR="$REPO_ROOT/logs"
mkdir -p "$LOGDIR"
LOG_FILE="$LOGDIR/integration_test_$(date +%Y%m%d_%H%M%S).log"
RESULTS_FILE="$LOGDIR/Integration_Testing_Results_$(date +%Y%m%d).md"

# Redirect to log file and stdout
exec > >(tee -a "$LOG_FILE")
exec 2>&1

echo "=== Integration Test Log ===" | tee -a "$LOG_FILE"
echo "Log: $LOG_FILE"
echo

# Test 1: Check Ollama availability
echo "════════════════════════════════════════════════════════════"
echo "TEST 1: Ollama Availability Check"
echo "════════════════════════════════════════════════════════════"

OLLAMA_AVAILABLE=false
OLLAMA_MODELS=""

if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✓ Ollama is running on localhost:11434"
    OLLAMA_AVAILABLE=true

    # List available models
    echo
    echo "Available Ollama models:"
    OLLAMA_MODELS=$(curl -s http://localhost:11434/api/tags 2>/dev/null || echo '{"models":[]}')
    echo "$OLLAMA_MODELS" | python3 -m json.tool 2>/dev/null || echo "Could not parse models"

    # Check for required models
    LLM_MODEL="${LLM_MODEL:-llama3.2:3b}"
    if echo "$OLLAMA_MODELS" | grep -q "$LLM_MODEL"; then
        echo "✓ $LLM_MODEL found"
    else
        echo "✗ $LLM_MODEL NOT found"
    fi

    if echo "$OLLAMA_MODELS" | grep -q "nomic-embed-text"; then
        echo "✓ nomic-embed-text found"
    else
        echo "✗ nomic-embed-text NOT found"
    fi
else
    echo "✗ Ollama is NOT running on localhost:11434"
    echo "  Continuing with tests but LLM/embedding features will be mocked"
fi

echo

# Test 2: PostgreSQL availability check
echo "════════════════════════════════════════════════════════════"
echo "TEST 2: PostgreSQL Availability Check"
echo "════════════════════════════════════════════════════════════"

if command -v psql &> /dev/null; then
    echo "✓ psql client is available"

    # Try to connect to default postgres
    if psql -U postgres -h localhost -d postgres -c "SELECT version();" 2>/dev/null | head -1; then
        echo "✓ PostgreSQL is running and accessible"
    else
        echo "✗ Cannot connect to PostgreSQL at localhost"
        echo "  Docker containers not yet running - expected"
    fi
else
    echo "✗ psql client not found"
    echo "  Will check via docker-compose when containers start"
fi

echo

# Test 3: Docker status
echo "════════════════════════════════════════════════════════════"
echo "TEST 3: Docker Status"
echo "════════════════════════════════════════════════════════════"

if docker ps &> /dev/null; then
    echo "✓ Docker daemon is running"

    # Count running containers
    CONTAINER_COUNT=$(docker ps -q | wc -l)
    echo "  Currently running containers: $CONTAINER_COUNT"

    # List containers related to rag
    echo
    echo "RAG-related containers:"
    docker ps --filter="label=rag" -a 2>/dev/null || echo "  (No RAG containers yet)"
else
    echo "✗ Docker daemon is not accessible"
fi

echo

# Test 4: docker-compose file validation
echo "════════════════════════════════════════════════════════════"
echo "TEST 4: Docker Compose Configuration Validation"
echo "════════════════════════════════════════════════════════════"

if [ -f "docker-compose.multi-kb.yml" ]; then
    echo "✓ docker-compose.multi-kb.yml exists"

    # Validate YAML syntax
    python3 << 'EOFPYTHON'
import yaml
try:
    with open('docker-compose.multi-kb.yml', 'r') as f:
        config = yaml.safe_load(f)
    print("✓ YAML syntax is valid")
    print(f"  Services: {', '.join(config.get('services', {}).keys())}")
    print(f"  Networks: {', '.join(config.get('networks', {}).keys())}")
except Exception as e:
    print(f"✗ YAML validation failed: {e}")
EOFPYTHON
else
    echo "✗ docker-compose.multi-kb.yml not found"
fi

echo

# Test 5: Check environment setup
echo "════════════════════════════════════════════════════════════"
echo "TEST 5: Environment Configuration"
echo "════════════════════════════════════════════════════════════"

if [ -f ".env" ]; then
    echo "✓ .env file exists"
    echo "  Key settings:"
    grep -E "PROJECT_NAME|RAG_PORT|EMBEDDING_MODEL|LLM_MODEL|ROUTER_TYPE" .env | sed 's/^/    /'
else
    echo "✗ .env file not found"
fi

echo

# Test 6: Python dependencies
echo "════════════════════════════════════════════════════════════"
echo "TEST 6: Python Dependencies"
echo "════════════════════════════════════════════════════════════"

python3 << 'EOFPYTHON'
import sys
try:
    import fastapi
    print("✓ fastapi")
except ImportError:
    print("✗ fastapi")

try:
    import sqlalchemy
    print("✓ sqlalchemy")
except ImportError:
    print("✗ sqlalchemy")

try:
    import asyncpg
    print("✓ asyncpg")
except ImportError:
    print("✗ asyncpg")

try:
    import redis
    print("✓ redis")
except ImportError:
    print("✗ redis")

try:
    import httpx
    print("✓ httpx")
except ImportError:
    print("✗ httpx")

try:
    import yaml
    print("✓ yaml")
except ImportError:
    print("✗ yaml")

try:
    import pymupdf
    print("✓ pymupdf")
except ImportError:
    print("✗ pymupdf")
EOFPYTHON

echo

# Test 7: Application code structure
echo "════════════════════════════════════════════════════════════"
echo "TEST 7: Application Code Structure"
echo "════════════════════════════════════════════════════════════"

echo "Required application modules:"
for module in app/main.py app/kb.py app/router.py app/search_pipeline.py app/chat.py app/websocket_chat.py; do
    if [ -f "$module" ]; then
        SIZE=$(wc -l < "$module")
        echo "✓ $module ($SIZE lines)"
    else
        echo "✗ $module NOT FOUND"
    fi
done

echo

echo "════════════════════════════════════════════════════════════"
echo "Pre-deployment Checklist Summary"
echo "════════════════════════════════════════════════════════════"
echo

echo "Results saved to: $LOG_FILE"
echo "Test report will be generated at: $RESULTS_FILE"
echo

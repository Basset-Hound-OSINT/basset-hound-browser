# RAG Bootstrap Phase 5.1 - Infrastructure Diagnostics & Remediation

**Date**: 2026-05-06
**Status**: DIAGNOSTIC REPORT + SOLUTIONS

---

## Problem Summary

The RAG Bootstrap integration testing is blocked on three infrastructure issues:

1. **docker-compose version incompatibility** - Cannot deploy containers
2. **Ollama not available** - Cannot generate embeddings or LLM responses
3. **PostgreSQL not running** - Cannot test persistence

---

## Issue #1: Docker Compose Version Incompatibility

### Diagnosis

```
System Status:
  Docker Version: 29.1.3-0ubuntu3~22.04.2
  Docker API: v1.44+ (required by daemon)
  docker-compose Version: 1.29.2
  docker-compose API Support: v1.41 (too old)

Error When Running:
  $ docker-compose -f docker-compose.multi-kb.yml up -d

  docker.errors.DockerException: Error while fetching server API version:
  Not supported URL scheme http+docker

  Root Cause: APIClient trying to use deprecated URL scheme
```

### Root Cause Analysis

The docker-compose 1.29.2 from Ubuntu 22.04 LTS is old and has:
- Deprecated URL handling for docker socket
- API version too old (v1.41) for modern Docker daemon (v1.44+)
- Missing patches from newer releases

### Solutions

#### Solution A: Upgrade docker-compose to Latest 1.x (RECOMMENDED - Safest)

```bash
# Install from PyPI (latest 1.x)
pip install --user docker-compose --upgrade

# Verify
docker-compose --version

# Expected output:
# docker-compose version X.X.X, build xxxxxxx
```

**Pros**:
- Maintains 1.x API compatibility
- Fixes URL scheme issue
- Quick install

**Cons**:
- May still have some issues with very new Docker versions

#### Solution B: Use Docker Compose v2 Plugin (MODERN - Preferred Long-term)

If docker-compose v2 is available on your system:

```bash
# Check if v2 plugin is installed
which docker-compose  # Points to /usr/libexec/docker/cli-plugins/docker-compose

# Or use new syntax
docker compose --version  # (space instead of hyphen)
```

If not available, it can be installed separately (more complex).

#### Solution C: Manual Workaround (TEMPORARY - For Testing)

If neither upgrade works, manually start containers:

```bash
# Create data directories
mkdir -p data/postgres-primary data/postgres-atc data/postgres-research data/redis data/logs

# Start each service individually
docker network create rag-multi-kb-network

# Start PostgreSQL instances
docker run -d --name rag-postgres-primary \
  --network rag-multi-kb-network \
  -e POSTGRES_DB=ragdb_primary \
  -e POSTGRES_USER=raguser \
  -e POSTGRES_PASSWORD=ragpass \
  -v $(pwd)/data/postgres-primary:/var/lib/postgresql/data \
  pgvector/pgvector:pg16

# ... (repeat for atc and research)

# Start Redis
docker run -d --name rag-redis \
  --network rag-multi-kb-network \
  -v $(pwd)/data/redis:/data \
  redis:7-alpine

# ... (continue for api and nginx)
```

### Recommended Action

**Try Solution A first** (upgrade docker-compose):

```bash
#!/bin/bash
set -e

echo "Upgrading docker-compose..."
pip install --user docker-compose --upgrade

echo "Verifying installation..."
docker-compose --version

echo "Testing with docker-compose..."
cd /home/devel/exudeai/rag-bootstrap

# Validate file
docker-compose -f docker-compose.multi-kb.yml config > /dev/null && echo "✓ Config valid"

# Try starting init service
docker-compose -f docker-compose.multi-kb.yml up -d init

echo "✓ docker-compose working!"
```

---

## Issue #2: Ollama Not Available

### Diagnosis

```
System Status:
  Ollama Running: NO
  Ollama URL: http://localhost:11434
  Status: Connection refused

Required Models:
  llama3.1:70b - NOT AVAILABLE (~35GB)
  nomic-embed-text - NOT AVAILABLE (~150MB)
```

### Impact

- Cannot test LLM responses
- Cannot generate embeddings
- Cannot test chat endpoints with real responses
- Cannot test streaming

### Solution: Stand Up Ollama

#### Step 1: Install Ollama

```bash
# Download Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Or install from package manager
# Ubuntu/Debian:
sudo apt-get install ollama

# macOS (if applicable):
brew install ollama
```

#### Step 2: Start Ollama Service

```bash
# Option A: Run in foreground (for debugging)
ollama serve

# Option B: Run in background
nohup ollama serve > ollama.log 2>&1 &

# Option C: Use systemd (if installed as service)
systemctl start ollama
systemctl enable ollama
```

#### Step 3: Pull Required Models

```bash
# Pull fast embedding model (~150MB, takes 1-2 minutes)
ollama pull nomic-embed-text

# Verify
curl http://localhost:11434/api/tags | grep nomic-embed-text

# Pull large LLM model (~35GB, takes 30-60 minutes depending on internet)
ollama pull llama3.1:70b

# Monitor progress
ollama list  # Shows download status

# Verify
curl http://localhost:11434/api/tags | grep "llama3.1:70b"
```

#### Step 4: Verify Installation

```bash
# Health check
curl http://localhost:11434/api/tags
# Expected: { "models": [ { "name": "nomic-embed-text", ... }, ... ] }

# Test embedding generation
curl -X POST http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "prompt": "Hello, world!"
  }' | python3 -m json.tool | head -20

# Test LLM generation
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:70b",
    "prompt": "Why is RAG important?",
    "stream": false
  }' | python3 -m json.tool
```

### Troubleshooting Ollama

#### Issue: Ollama takes too long to download models

**Solution**: Download in background while continuing other tests

```bash
# Start Ollama in background
ollama serve > /tmp/ollama.log 2>&1 &
OLLAMA_PID=$!

# Start model downloads in background
(ollama pull nomic-embed-text; ollama pull llama3.1:70b) > /tmp/ollama_pull.log 2>&1 &

# Continue with other testing
# Check progress periodically:
tail -f /tmp/ollama_pull.log
```

#### Issue: Out of memory downloading llama3.1:70b

**Solution**: Use smaller model temporarily

```bash
# Use smaller models for testing
ollama pull llama3:7b  # Only ~4GB
ollama pull llama2:7b  # Only ~3.8GB

# Or use medium model
ollama pull neural-chat:7b  # Optimized, ~3.7GB
```

#### Issue: Ollama service won't start

**Solution**: Check system resources

```bash
# Check available disk space
df -h /  # Need ~100GB free for both models

# Check available memory
free -h  # Need 8GB+ RAM for llama3.1:70b

# Check Ollama logs
tail -f ollama.log

# Try starting with explicit bind
ollama serve --host 127.0.0.1:11434
```

---

## Issue #3: PostgreSQL Not Running

### Status

Blocked on Issue #1 (docker-compose), will resolve automatically once docker-compose works.

### Manual Verification Once Services Are Running

```bash
# Check PostgreSQL containers
docker ps | grep postgres

# Connect to primary database
docker exec -it rag-postgres-primary psql -U raguser -d ragdb_primary

# List databases
\l

# Exit
\q
```

---

## Complete Remediation Script

Save as `fix_infrastructure.sh`:

```bash
#!/bin/bash
set -e

echo "════════════════════════════════════════════════════════════════"
echo "RAG Bootstrap Infrastructure Remediation"
echo "════════════════════════════════════════════════════════════════"
echo

# Step 1: Fix docker-compose
echo "[1/4] Upgrading docker-compose..."
pip install --user docker-compose --upgrade
docker-compose --version

# Step 2: Verify docker-compose works
echo
echo "[2/4] Verifying docker-compose configuration..."
cd /home/devel/exudeai/rag-bootstrap
docker-compose -f docker-compose.multi-kb.yml config > /dev/null && \
  echo "✓ Configuration valid"

# Step 3: Set up Ollama
echo
echo "[3/4] Starting Ollama service..."

# Check if Ollama is available
if ! command -v ollama &> /dev/null; then
    echo "⚠ Ollama not installed. Installing..."
    curl -fsSL https://ollama.ai/install.sh | sh
fi

# Start Ollama service
if ! pgrep -x ollama > /dev/null; then
    echo "Starting Ollama daemon..."
    nohup ollama serve > /tmp/ollama.log 2>&1 &
    sleep 2  # Give it time to start
fi

# Pull models in background
echo "Pulling required models (this may take a while)..."
echo "  - nomic-embed-text: ~150MB"
echo "  - llama3.1:70b: ~35GB"
echo
echo "Starting downloads in background..."

# Non-blocking model pulls
(
    echo "Pulling nomic-embed-text..."
    ollama pull nomic-embed-text > /tmp/ollama_embed.log 2>&1
    echo "✓ nomic-embed-text downloaded"

    echo "Pulling llama3.1:70b (this will take 30-60 minutes)..."
    ollama pull llama3.1:70b > /tmp/ollama_llm.log 2>&1
    echo "✓ llama3.1:70b downloaded"
) &

PULL_PID=$!

# Step 4: Deploy stack
echo
echo "[4/4] Starting Docker Compose stack..."
echo "      (Ollama models downloading in background...)"
echo

# Create data directories
mkdir -p data/postgres-primary data/postgres-atc data/postgres-research \
         data/redis data/logs

# Start init service
docker-compose -f docker-compose.multi-kb.yml up -d init

# Wait for init to complete
echo "Waiting for init service..."
docker-compose -f docker-compose.multi-kb.yml logs init

# Start all services
docker-compose -f docker-compose.multi-kb.yml up -d

# Show status
echo
echo "════════════════════════════════════════════════════════════════"
echo "Deployment Status:"
echo "════════════════════════════════════════════════════════════════"
docker-compose -f docker-compose.multi-kb.yml ps

echo
echo "════════════════════════════════════════════════════════════════"
echo "Waiting for services to become healthy (2-3 minutes)..."
echo "════════════════════════════════════════════════════════════════"
echo

# Wait for health checks
RETRIES=30
INTERVAL=5
HEALTHY=0

for ((i = 1; i <= RETRIES; i++)); do
    echo -n "."

    # Check API health
    if curl -s http://localhost:8100/api/v2/health > /dev/null 2>&1; then
        HEALTHY=1
        break
    fi

    sleep $INTERVAL
done

echo
echo

if [ $HEALTHY -eq 1 ]; then
    echo "✓ All services healthy!"
    echo
    echo "Access points:"
    echo "  Web UI: http://localhost:8100"
    echo "  API v2: http://localhost:8100/api/v2"
    echo "  Health: curl http://localhost:8100/api/v2/health"
else
    echo "⚠ Services may still be starting. Checking logs..."
    docker-compose -f docker-compose.multi-kb.yml logs api | tail -20
fi

# Show Ollama status
echo
echo "════════════════════════════════════════════════════════════════"
echo "Ollama Model Download Status:"
echo "════════════════════════════════════════════════════════════════"
echo "(Still downloading in background, check progress with:)"
echo "  tail -f /tmp/ollama_embed.log"
echo "  tail -f /tmp/ollama_llm.log"
echo
echo "Or check completed models with:"
echo "  curl http://localhost:11434/api/tags | python3 -m json.tool"
echo

# Wait for background model pulls to complete
wait $PULL_PID
echo "✓ All Ollama models downloaded!"

echo
echo "════════════════════════════════════════════════════════════════"
echo "✓ Infrastructure remediation complete!"
echo "════════════════════════════════════════════════════════════════"
```

### Run the Script

```bash
cd /home/devel/exudeai/rag-bootstrap
chmod +x fix_infrastructure.sh
./fix_infrastructure.sh

# This will:
# 1. Upgrade docker-compose
# 2. Verify configuration
# 3. Start Ollama and download models (background)
# 4. Deploy all Docker services
# 5. Wait for health checks
# 6. Provide access URLs
```

---

## Validation Checklist

After running remediation, verify:

### ✓ docker-compose Working
```bash
docker-compose --version  # Should show v1.29.3+ or v2.x
cd /home/devel/exudeai/rag-bootstrap
docker-compose -f docker-compose.multi-kb.yml ps  # All containers RUNNING
```

### ✓ Ollama Running
```bash
curl http://localhost:11434/api/tags | python3 -m json.tool
# Should show nomic-embed-text and llama3.1:70b
```

### ✓ PostgreSQL Ready
```bash
docker exec -it rag-postgres-primary pg_isready -U raguser -d ragdb_primary
# Should output: accepting connections
```

### ✓ Redis Ready
```bash
docker exec -it rag-redis redis-cli ping
# Should output: PONG
```

### ✓ API Healthy
```bash
curl http://localhost:8100/api/v2/health
# Should return JSON with status: "healthy"
```

### ✓ Frontend Accessible
```bash
curl http://localhost:8100/ | head -20
# Should return HTML
```

---

## Estimated Timeline

| Task | Time | Notes |
|------|------|-------|
| Upgrade docker-compose | 5 min | Quick pip install |
| Fix docker-compose config | 5 min | Verification only |
| Install/start Ollama | 5 min | If already installed |
| Download nomic-embed-text | 2 min | ~150MB model |
| Deploy stack | 3 min | Initial startup |
| PostgreSQL healthcheck | 1 min | Database initialization |
| Download llama3.1:70b | 30-60 min | ~35GB model, background |
| Verify all services | 5 min | Final validation |
| **TOTAL** | **1-2 hours** | Including Ollama models |

---

## Next Steps After Infrastructure is Fixed

Once infrastructure is operational:

1. **Run Integration Tests** (`pytest tests/test_api_v3.py`)
2. **Test Document Ingestion** (upload PDF)
3. **Test Semantic Search** (query with embedding)
4. **Test Chat with RAG** (multi-turn conversation)
5. **Test WebSocket Streaming** (real-time token streaming)
6. **Generate Benchmarks** (measure performance)
7. **Document Results** (update Integration_Testing_Results_2026_05_06.md)

---

## Support

If issues persist after remediation:

1. Check logs:
   ```bash
   tail -f /tmp/ollama.log
   docker-compose logs api
   docker-compose logs postgres-primary
   ```

2. Check resources:
   ```bash
   docker stats
   free -h
   df -h /
   ```

3. Restart services:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

---

**Generated**: 2026-05-06
**For**: RAG Bootstrap Phase 5.1 Integration Testing
**Status**: Ready to execute

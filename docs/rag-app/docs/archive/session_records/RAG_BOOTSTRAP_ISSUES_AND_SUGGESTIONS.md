> **DISPOSITION — 2026-07-03 stabilization pass** (triage:
> `docs/findings/audits/2026-07-03_root_suggestions_triage_audit.md`; archived here as a
> point-in-time record, all items dispositioned):
>
> - #1 vector-dim mismatch → **done-in-this-pass** (deploy.sh `dim_guard` + API startup check vs `rag_meta` row; reset path)
> - #2 .env clobbered by deploy.sh → **done-in-this-pass** (generate_env merges append-only, never overwrites customized keys)
> - #3 sentence-transformers missing → **done-in-this-pass** (Ollama-only canonical default; st optional with actionable ImportError guard)
> - #4 port conflicts → **done-in-this-pass** (RAG_PORT_BASE=10000 band + port preflight with auto-increment)
> - #5 auto-generated .env confusion → **done-in-this-pass** (merge/append semantics; manual edits persist)
> - #6 sequential ingest throughput → **done-in-this-pass** (`ingestion.concurrent_files` semaphore, batch `/api/embed`, async directory ingest); parallel watcher workers → **deferred-to-roadmap**
> - #7 memory for very large corpora (streaming ingest batches) → **deferred-to-roadmap**
> - #8 network isolation docs → **done-in-this-pass** (README + docs/TROUBLESHOOTING.md §5)
> - #9 Ollama connectivity assumptions → **done-in-this-pass** (host-gateway extra_host; documented local/remote/bridge modes; `deploy.sh ollama-forwarder`)
> - #10 no Ollama health check → **done-in-this-pass** (`deploy.sh doctor` + start preflight: reachability, model pulled, disk)
> - #11 config.yaml→.env chain → **done-in-this-pass** (deploy.sh resolves `config/config.yaml`, echoes effective config)
> - #12 error messaging → **done-in-this-pass** (actionable st/dim/ingest-root guard messages)
> - #13 quickstart config examples → **deferred-to-roadmap** (canonical defaults now safe out-of-box)
> - #14 troubleshooting guide → **done-in-this-pass** (`docs/TROUBLESHOOTING.md`)
> - #15 performance tuning guide → **done-in-this-pass** (`docs/PERFORMANCE.md`)
> - A setup wizard → **deferred-to-roadmap**; B ingest progress endpoint → **done-in-this-pass** (`GET /api/ingest/status/{job_id}`)
> - C volume-size monitoring → partially done (doctor disk-space check); dashboarding → **deferred-to-roadmap**
> - D backup/restore → **deferred-to-roadmap**; E multi-embedding-model → **deferred-to-roadmap** (documented future stanza in config.yaml)
> - F rate-limiting/concurrency config → **done-in-this-pass** (`concurrent_files`, `retry_backoff`)
>
> No blacklisted items (the #9 "Kubernetes deployments" mention is contextual — no k8s work asked or planned).

# RAG Bootstrap Template - Issues & Suggestions
**Date:** July 3, 2026  
**Tested with:** Basset Hound Browser Documentation (2,000+ files)  
**Template Version:** v0.x (from /home/devel/exudeai/rag-bootstrap)

---

## Critical Issues Found

### 1. ❌ Vector Dimension Mismatch on Embedding Model Change
**Severity:** CRITICAL  
**Issue:** Database schema is created based on initial embedding model dimensions. If you later change the embedding model (e.g., from `all-minilm:l6-v2` with 384 dims to `nomic-embed-text` with 768 dims), ingestion fails with:
```
DataError: expected 384 dimensions, not 768
```

**Root Cause:**  
- PostgreSQL pgvector schema is created with fixed `VECTOR(384)` for all chunks
- Changing embedding model in .env doesn't trigger schema migration
- Deploy script doesn't check for dimension mismatch

**Current Workaround:**
```bash
cd rag-app
./deploy.sh stop
docker volume rm rag-bootstrap_postgres_data  # Destroy old DB
RAG_PORT=10100 EMBEDDING_DIMENSION=768 ./deploy.sh start --build
```

**Recommended Fix:**
- Add pre-flight check in deploy.sh to validate embedding dimensions match DB schema
- Create migration system for schema updates
- OR: Store embedding dimensions in a settings table and validate on startup
- Improve error messages to guide users to delete the volume

---

### 2. ❌ Environment Variables Not Properly Applied by deploy.sh
**Severity:** HIGH  
**Issue:** .env file is auto-generated from config.yaml and overwrites manual environment variable changes.

**Observed Behavior:**
1. Edit config.yaml to change port from 8100 to 10100
2. Run `./deploy.sh start`
3. Deploy.sh regenerates .env with old values (8100)
4. Port setting ignored

**Root Cause:**  
- deploy.sh has logic that generates .env from config.yaml on every startup
- Environment variables passed to deploy.sh are not preserved in .env

**Recommended Fix:**
```bash
# Option 1: Check if .env exists and is manually edited before regenerating
if [ ! -f .env ] || [ -z "$(grep 'MANUALLY_CONFIGURED' .env)" ]; then
    # Generate from config.yaml
else
    # Skip generation, respect manual .env
fi

# Option 2: Export environment variables in deploy.sh before docker-compose
export RAG_PORT=${RAG_PORT:-8100}
export EMBEDDING_BACKEND=${EMBEDDING_BACKEND:-sentence-transformers}
```

---

### 3. ❌ Missing Dependencies in Container Image
**Severity:** HIGH  
**Issue:** `sentence-transformers` Python package not included in Dockerfile, causing ingestion failures if EMBEDDING_BACKEND=sentence-transformers is used.

**Error:**
```
ImportError: No module named 'sentence_transformers'
```

**Root Cause:**
- Dockerfile doesn't have requirements.txt with embedding dependencies
- Template suggests using sentence-transformers but container isn't built with it

**Recommended Fix:**
```dockerfile
# Add to app/Dockerfile
RUN pip install sentence-transformers>=2.2.0 torch

# OR create app/requirements.txt:
ollama>=0.1.0
sentence-transformers>=2.2.0
torch>=2.0.0
```

---

### 4. ⚠️ Port Binding Issues & Conflicts
**Severity:** MEDIUM  
**Issue:** Port 8100 is commonly used (in this case, BluePlan was already running there).

**Recommended Fix:**
- Change default port to something less common (8765, 9500, 10100)
- Add warning in config.yaml: "Popular ports that may conflict: 8100, 8080, 3000, 5000"
- Provide port conflict detection:
```bash
if lsof -i :$RAG_PORT >/dev/null 2>&1; then
    echo "ERROR: Port $RAG_PORT already in use"
    exit 1
fi
```

---

### 5. ⚠️ Auto-Generated .env Comments
**Severity:** LOW  
**Issue:** .env file header says "Do not edit directly, modify config.yaml instead" but users often need quick environment tweaks.

**Impact:** Users edit .env, then deploy.sh overwrites their changes, causing confusion.

**Recommended Fix:**
- Add timestamp to .env showing when it was generated
- Add comment: "To prevent auto-regeneration, add SKIP_ENV_GENERATION=true"
- Create .env.local pattern that's loaded after auto-generated .env

---

## Performance & Scalability Issues

### 6. ⚠️ Ingestion Rate Limiting
**Severity:** MEDIUM (for large document sets)  
**Issue:** File watcher processes files sequentially, one at a time. With 2,000+ documents, ingestion takes hours.

**Current Behavior:**
- Watcher detects file → queues → ingests (with 3 retry attempts)
- If ingestion fails, 2-4 second delay before retry
- All retries happen serially (no parallelization)

**Optimization Suggestions:**
```python
# Instead of sequential:
for file in detected_files:
    ingest(file)  # Slow!

# Use async/concurrent ingestion:
async def ingest_batch(files, max_concurrent=5):
    semaphore = asyncio.Semaphore(max_concurrent)
    tasks = [ingest_file(f, semaphore) for f in files]
    return await asyncio.gather(*tasks)
```

---

### 7. ⚠️ Memory Usage for Large Document Sets
**Severity:** MEDIUM  
**Issue:** Loading 48,000+ chunks into memory for processing can cause OOM for large deployments.

**Recommendation:**
- Implement streaming ingestion (process documents in batches of 100)
- Add memory monitoring and garbage collection
- Document memory requirements in README

---

## Deployment & Configuration Issues

### 8. ⚠️ Network Isolation Not Well Documented
**Severity:** LOW  
**Issue:** Docker network is created but documentation doesn't explain why services aren't exposed.

**User Confusion Points:**
- "Why can't I access Postgres on port 5432?"
- "Why can't I connect Redis from outside?"

**Recommendation:**
- Add section: "Multi-Container Network Architecture"
- Explain: "Only the frontend is exposed to localhost via nginx. All services communicate internally."
- Provide examples of how to connect externally (e.g., using docker exec or network access)

---

### 9. ⚠️ Ollama Connectivity Assumptions
**Severity:** MEDIUM  
**Issue:** Config assumes Ollama runs at `http://host.docker.internal:11434` but this is Docker Desktop specific.

**Doesn't work on:**
- Docker on Linux (host.docker.internal doesn't exist)
- Remote Docker hosts
- Kubernetes deployments

**Recommended Fix:**
```bash
# Detect platform and set appropriate Ollama URL
if [ "$(uname)" = "Darwin" ]; then
    OLLAMA_URL="http://host.docker.internal:11434"  # macOS Docker Desktop
elif [ "$(uname)" = "Linux" ]; then
    OLLAMA_URL="http://host:11434"  # Linux with --add-host
else
    OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"  # Default
fi
```

---

### 10. ⚠️ No Health Check for Ollama Connectivity
**Severity:** MEDIUM  
**Issue:** RAG startup doesn't verify Ollama is reachable before starting.

**Impact:** Services start successfully but ingestion fails silently when Ollama is unavailable.

**Recommended Fix:**
```bash
# In deploy.sh startup checks:
check_ollama_health() {
    if ! curl -s "$OLLAMA_BASE_URL/api/tags" >/dev/null; then
        echo "ERROR: Ollama not responding at $OLLAMA_BASE_URL"
        exit 1
    fi
}
```

---

## Configuration & UX Issues

### 11. ⚠️ Config.yaml Changes Require Manual .env Regeneration
**Severity:** MEDIUM  
**Issue:** Users update config.yaml (port, embedding model) but .env isn't automatically regenerated until next deploy.sh run.

**Better Pattern:**
- Make deploy.sh auto-regenerate .env from config.yaml on every start (currently it does this but silently)
- OR: Read config.yaml directly in docker-compose.yml substitution

---

### 12. ⚠️ Limited Error Messaging for Ingestion Failures
**Severity:** LOW  
**Issue:** When ingestion fails, error messages don't suggest fixes.

```
ERROR: No module named 'sentence_transformers'
→ Should suggest: "Install sentence_transformers or use EMBEDDING_BACKEND=ollama"
```

---

## Documentation Gaps

### 13. Missing: Quickstart for Common Configurations
**Severity:** LOW  
**Suggestion:** Add pre-configured examples:
```yaml
# quickstart-ollama-only.yaml
# No sentence-transformers dependency, fast startup
embedding:
  backend: ollama
  model: nomic-embed-text
```

---

### 14. Missing: Troubleshooting Guide
**Suggested Contents:**
- "Port already in use" → How to change port and restart
- "Ingestion failing with dimension error" → How to reset database
- "Ollama connection refused" → How to verify Ollama is running
- "Documents not showing in search" → How to check database status

---

### 15. Missing: Performance Tuning Guide
**Suggested Contents:**
- Optimal chunk_size for different document types
- Recommended embedding models for speed vs accuracy
- How to monitor ingestion progress
- Scaling to 100,000+ documents

---

## Suggested Improvements (Future Versions)

### A. Automated Setup Wizard
```bash
./rag-setup.sh
# Prompts user for:
# - Port number (validates availability)
# - Embedding model (validates Ollama has it)
# - Document folder path
# - Creates optimized config.yaml
```

### B. Ingestion Progress Endpoint
```bash
GET /api/ingestion/status
# Returns:
{
  "status": "ingesting",
  "files_total": 2043,
  "files_processed": 127,
  "files_failed": 3,
  "estimated_minutes_remaining": 45,
  "current_file": "API-REFERENCE.md"
}
```

### C. Automatic Volume Size Monitoring
```
WARN: Estimated vector database size will be ~2.3GB
     Ensure you have sufficient disk space
```

### D. Built-in Backup/Restore
```bash
./deploy.sh backup  # Exports all ingested documents
./deploy.sh restore <backup.tar.gz>  # Reimports quickly
```

### E. Multi-Model Support
Allow ingestion with different embedding models in same database:
```yaml
embedding_models:
  - name: nomic-embed-text  # Primary
    fallback: all-minilm:l6-v2  # Secondary
```

### F. Rate Limiting Configuration
```yaml
ingestion:
  concurrent_files: 5  # Process 5 files in parallel
  chunk_processing_delay: 0.1  # seconds between chunks
  retry_backoff: exponential  # exponential or linear
```

---

## Summary of Recommended Changes

| Priority | Category | Action |
|----------|----------|--------|
| CRITICAL | Vector Dims | Auto-detect mismatch, guide users to reset DB |
| HIGH | Dependencies | Bundle sentence-transformers OR default to Ollama-only |
| HIGH | .env Handling | Respect existing .env, don't auto-regenerate if manually edited |
| MEDIUM | Validation | Pre-flight checks for ports, Ollama connectivity, disk space |
| MEDIUM | Performance | Add concurrent ingestion, batch processing |
| MEDIUM | Config | Fix config.yaml → docker-compose substitution chain |
| LOW | UX | Better error messages, quickstart examples |
| LOW | Docs | Add troubleshooting, performance tuning guides |

---

## Testing Checklist for Future Versions

- [ ] Port conflict detection works on all platforms
- [ ] Changing embedding model doesn't cause dimension errors
- [ ] Ollama unavailability is detected at startup
- [ ] Ingestion completes for 2,000+ document set
- [ ] All .env changes persist across deploy.sh invocations
- [ ] Error messages suggest fixes
- [ ] Works on Docker Desktop (macOS, Windows) AND native Docker (Linux)
- [ ] Works with custom Ollama paths/URLs

---

## Conclusion

The RAG Bootstrap template is feature-complete but needs polish around:
1. **Configuration management** (env variable handling)
2. **Error recovery** (dimension mismatches, dependency issues)
3. **Performance** (concurrent ingestion)
4. **Documentation** (troubleshooting, performance tuning)

Most issues are in the setup/initialization phase. Once running, the system is stable and effective.

---

**Tested Environment:**
- Docker: Latest (via docker-compose)
- Ollama: 0.1+ with nomic-embed-text, llama3.2:3b
- PostgreSQL: pgvector v16
- Test Documents: 2,000+ Markdown files, 30-50KB avg size
- Total Dataset: ~80MB uncompressed

**Timeline to Production Ready:**
- Fix critical issues (vector dims, .env handling): ~2 hours
- Add validation & error handling: ~4 hours  
- Improve documentation: ~3 hours
- Full test suite: ~8 hours
- **Total: ~2 days** to production-grade RAG Bootstrap template


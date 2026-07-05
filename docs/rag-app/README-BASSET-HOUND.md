# Basset Hound Browser - Documentation RAG Application

This is a local RAG (Retrieval-Augmented Generation) system configured to index and query the Basset Hound Browser documentation at `/docs` folder. It enables agents and developers to efficiently retrieve context from project documentation.

## Quick Start

### 1. Prerequisites
- Docker + Docker Compose installed
- Ollama running with embedding model: `ollama pull nomic-embed-text`
- LLM model: `ollama pull llama3.1:70b` (or equivalent)

### 2. Start the RAG Stack
```bash
cd /home/devel/basset-hound-browser/docs/rag-app
./deploy.sh start --build
```

The RAG web UI will be available at: **http://localhost:8100**

### 3. Verify Indexing
Once deployed, the system will:
1. Scan `/home/devel/basset-hound-browser/docs/` recursively
2. Process all `.md`, `.txt`, `.json`, `.yaml`, `.pdf`, and `.log` files
3. Create embeddings using `nomic-embed-text` (768-dim vectors)
4. Index documents in PostgreSQL + pgvector

### 4. Query via REST API
```bash
# Search query
curl -X POST http://localhost:8100/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "WebSocket API implementation", "mode": "hybrid", "top_k": 5}'

# RAG query (search + LLM generation)
curl -X POST http://localhost:8100/api/rag \
  -H "Content-Type: application/json" \
  -d '{"query": "How do we handle bot detection evasion?", "include_sources": true}'
```

## Configuration

**Config File:** `config/config.yaml`

Key settings:
- **Docs Path:** `/home/devel/basset-hound-browser/docs` (absolute path, recursively scanned)
- **Port:** 8100 (exposed to localhost)
- **Embedding Model:** `nomic-embed-text` (768 dimensions)
- **Chunk Size:** 256 tokens (technical documentation optimized)
- **Top K Results:** 5 documents per query
- **Min Similarity:** 0.7 (filters low-relevance results)

## Stopping the RAG Stack

```bash
./deploy.sh stop
```

To completely remove containers + volumes:
```bash
./deploy.sh down
```

## Agent Integration

When spawning agents that need documentation context:

```javascript
const docQuery = await agent(
  `Query the docs RAG at http://localhost:8100/api/search with: "${userQuestion}"`,
  {schema: SEARCH_RESULTS_SCHEMA}
);
```

## Document Structure

The RAG system indexes:
```
/docs/
├── roadmap/           (strategic planning)
├── scope/             (architectural boundaries)
├── research/          (deep technical analysis)
│   └── obscura/       (Obscura reverse-engineering findings)
├── wiki/              (project notes, deprecated in favor of above)
├── archives/          (historical records, session notes)
└── api-reference/     (API documentation)
```

## Troubleshooting

### Port already in use
Edit `config/config.yaml` line 32 and change port to 8101, 8102, etc.

### Ollama connection refused
Ensure Ollama is running and accessible:
```bash
curl http://localhost:11434/api/tags
```

### Memory issues during indexing
Reduce chunk_size in `config/config.yaml` from 256 to 150 tokens.

### Reingest documents after updates
Remove the database volume and redeploy:
```bash
./deploy.sh down  # Removes containers + volumes
./deploy.sh start --build
```

## Performance Notes

- **Indexing:** ~2-5 minutes for 100 documents (varies by size)
- **Search Latency:** 50-200ms per query (semantic + keyword hybrid)
- **Memory Footprint:** 2-4GB (depends on document volume)
- **Database Size:** ~500MB-1GB for typical project documentation

## Next Steps

1. Start the stack: `./deploy.sh start --build`
2. Visit http://localhost:8100 to explore indexed documentation
3. Use `/api/search` and `/api/rag` endpoints in agent workflows
4. Keep documentation in `/docs/` organized by topic

---

**Last Updated:** July 3, 2026  
**Status:** Ready for agent integration  
**Related:** `/docs/README.md` - Main documentation index

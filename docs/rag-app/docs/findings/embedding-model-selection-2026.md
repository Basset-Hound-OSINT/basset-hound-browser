# Embedding Model Selection for RAG Bootstrap (2026)

**Date**: 2026-01-30
**Decision**: Switch from sentence-transformers (all-MiniLM-L6-v2) to Ollama (nomic-embed-text v1.5)

## Context

The RAG bootstrap system needed to choose an embedding model for document retrieval. The original implementation used `all-MiniLM-L6-v2` via the sentence-transformers library running in-container. This required bundling PyTorch and sentence-transformers (~1GB+ of dependencies) and running embeddings in the API container.

Since the system already uses Ollama for LLM operations (llama3.1:70b), we investigated whether Ollama embeddings would be a better choice.

## Research Findings

### MTEB Leaderboard (2026)

Top embedding models by MTEB score:

| Rank | Model | MTEB Score | Retrieval Score | Dimensions | Size |
|------|-------|------------|-----------------|------------|------|
| 1 | qwen3-embedding:8b | 70.58 | N/A | Variable | Large |
| 2 | mxbai-embed-large | 64.68 | 54.39 | 1024 | 1.3 GB |
| 3 | nomic-embed-text | 62.39 | 49.01 | 768 | 548 MB |
| - | all-minilm:l6-v2 | ~53 | ~42-45 | 384 | 120 MB |

### Nomic-Embed-Text v1.5 Specifications

- **Context window**: 8,192 tokens (vs 512 for all-minilm)
- **Dimensions**: 768 (with Matryoshka support for 512/256)
- **Model size**: 548 MB
- **Inference speed**: Very Fast
- **Architecture**: Long-context BERT with multimodal alignment
- **Special feature**: Task-specific prefixes for optimization
  - `search_document:` for document chunks
  - `search_query:` for user queries
  - `classification:` for classification tasks
  - `clustering:` for clustering tasks

### Performance Comparison

**Query Type Performance**:
- Short queries: nomic-embed-text excels (57.5% vs mxbai 59.25%)
- Long queries: mxbai-embed-large better (82.5% for long questions)
- Overall retrieval: mxbai slightly ahead (59.25% vs 57.25%)

**Speed & Resource**:
- nomic-embed-text: 548 MB, "Very Fast" inference
- mxbai-embed-large: 1340 MB, "Fast" inference
- qwen3-embedding: Large model, requires significant resources

## Decision Rationale

**Selected: nomic-embed-text v1.5 via Ollama**

### Reasons:

1. **Purpose-built for RAG** - Specifically designed for retrieval tasks
2. **Architectural consistency** - Already using Ollama for LLM operations
3. **Container optimization** - No need to bundle PyTorch/sentence-transformers (~1GB saved)
4. **Long context** - 8,192 tokens handles large document chunks
5. **Fast inference** - Better user experience than larger models
6. **Good-enough performance** - 62.39 MTEB is excellent for most RAG use cases
7. **Task prefixes** - Supports optimization via search_document/search_query prefixes
8. **Matryoshka embeddings** - Can reduce dimensions if needed (768→512→256)

### Trade-offs:

- ❌ Slightly lower MTEB score than mxbai-embed-large (62.39 vs 64.68)
- ❌ Lower retrieval score than mxbai (49.01 vs 54.39)
- ✅ But 2.4x smaller (548 MB vs 1.3 GB)
- ✅ And faster inference

### Why Not Others?

**mxbai-embed-large**:
- Better accuracy (64.68 MTEB) but 2.4x larger (1.3 GB)
- Slower inference
- Overkill for most RAG use cases

**qwen3-embedding:8b**:
- Best-in-class MTEB (70.58) but very large
- Requires significant compute resources
- Overkill for bootstrap/template system

**all-minilm:l6-v2** (previous default):
- Much smaller (120 MB) but significantly worse performance (~53 MTEB)
- Only 512 token context window (vs 8,192 for nomic)
- Older model, not optimized for RAG

## Implementation

### Changes Made:

1. **config.yaml** - Updated defaults:
   ```yaml
   embedding:
     model: nomic-embed-text
     dimension: 768
     backend: ollama
   ```

2. **embeddings.py** - Added task prefix support:
   - Automatically adds `search_document:` for document chunks (ingestion)
   - Automatically adds `search_query:` for user queries (search)
   - Auto-detects nomic-embed-text and applies prefixes

3. **search.py** - Updated semantic search to use `task="search_query"`

4. **requirements.txt** - Made sentence-transformers optional:
   - Commented out by default
   - Can be enabled for users who want local embeddings

5. **README.md** - Added embedding model documentation:
   - Comparison table
   - Setup instructions (`ollama pull nomic-embed-text`)
   - Alternative model options

### Migration Path:

For existing deployments:

```bash
# Pull the new model
ollama pull nomic-embed-text

# Clean old data (embeddings are incompatible)
./deploy.sh clean

# Restart with new model
./deploy.sh start --build

# Re-ingest documents
./deploy.sh ingest
```

## Future Considerations

### When to Upgrade:

Consider upgrading to **qwen3-embedding:8b** if:
- You need state-of-the-art performance (70.58 MTEB)
- You have compute resources to spare
- Your RAG system is production-critical with high accuracy requirements

Consider using **mxbai-embed-large** if:
- You frequently have long-context queries
- You can tolerate slower inference
- You need maximum retrieval accuracy

### When to Downgrade:

Consider using **all-minilm:l6-v2** if:
- Extreme speed/resource constraints
- Running on very limited hardware
- Accuracy is less critical than throughput

## Sources

Research conducted on 2026-01-30:

- [13 Best Embedding Models in 2026](https://elephas.app/blog/best-embedding-models)
- [Best Open-Source Embedding Models Benchmarked and Ranked](https://supermemory.ai/blog/best-open-source-embedding-models-benchmarked-and-ranked/)
- [Best Ollama Embedding Models: A Guide for RAG Applications](https://www.arsturn.com/blog/picking-the-perfect-partner-a-guide-to-choosing-the-best-embedding-models-in-ollama)
- [nomic-ai/nomic-embed-text-v1.5 Hugging Face](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5)
- [Ollama nomic-embed-text Library](https://ollama.com/library/nomic-embed-text)
- [Top embedding models on the MTEB leaderboard](https://modal.com/blog/mteb-leaderboard-article)

## Conclusion

**nomic-embed-text v1.5** is the optimal choice for the RAG bootstrap system in 2026, balancing performance, speed, context length, and resource efficiency. It aligns with the system's Ollama-based architecture and provides excellent RAG performance without the overhead of larger models.

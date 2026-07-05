# RAG Bootstrap Production API Documentation

**Version**: 1.0.0
**Status**: Production-Ready
**Last Updated**: 2026-05-31
**Base URL**: `http://localhost:8100`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Core API Endpoints](#core-api-endpoints)
4. [Streaming API](#streaming-api)
5. [Document Management](#document-management)
6. [Search API](#search-api)
7. [System Status](#system-status)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)
10. [Code Examples](#code-examples)

---

## Overview

RAG Bootstrap provides a production-ready Retrieval-Augmented Generation (RAG) system combining semantic search with LLM-powered question answering. The API supports both traditional request-response patterns and real-time streaming responses.

### Key Features

- **Semantic Search**: Vector-based document retrieval with similarity scoring
- **Hybrid Search**: Combines semantic and keyword search with RRF ranking
- **LLM Integration**: Ollama-based generation with context injection
- **Real-time Streaming**: Server-Sent Events (SSE) for token-by-token responses
- **Auto-Ingest**: Automatic document processing with file monitoring
- **Multiple Document Types**: PDF, DOCX, TXT, MD support

### System Architecture

```
Client → Nginx (port 8100)
         ↓
    FastAPI Backend
         ↓
    ┌────────────────┐
    │ Search Engine  │
    │ • PostgreSQL   │
    │ • Embeddings   │
    └────────────────┘
         ↓
    ┌────────────────┐
    │ LLM (Ollama)   │
    │ • Generation   │
    │ • Streaming    │
    └────────────────┘
```

---

## Authentication

Currently, the API does **not require authentication**. All endpoints are publicly accessible when the service is running.

**Future Enhancement**: JWT-based authentication planned for multi-tenant deployments.

---

## Core API Endpoints

### 1. Ask Endpoint (Request-Response)

Generate an answer with optional RAG context.

**Endpoint**: `POST /api/ask`

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "question": "What is RAG?",
  "mode": "hybrid",
  "limit": 5,
  "system_prompt": "You are a helpful assistant.",
  "temperature": 0.3
}
```

**Request Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `question` | string | Required | The question to answer |
| `mode` | string | "hybrid" | Search mode: "semantic", "keyword", or "hybrid" |
| `limit` | integer | 5 | Number of context documents to retrieve |
| `system_prompt` | string | Optional | Custom system prompt (overrides default) |
| `temperature` | float | 0.3 | LLM temperature (0.0-1.0, lower = deterministic) |

**Response**:
```json
{
  "answer": "RAG (Retrieval-Augmented Generation) is a technique that combines...",
  "model": "llama3.1:70b",
  "sources": [
    {
      "document_filename": "rag_guide.pdf",
      "score": 0.95,
      "content": "RAG is a technique for augmenting language models with external knowledge..."
    }
  ],
  "context_chunks": 5,
  "search_mode": "hybrid",
  "generation_time_ms": 2500
}
```

**Status Codes**:
- `200 OK` - Successful response
- `400 Bad Request` - Invalid parameters
- `500 Internal Server Error` - Server error

**Example cURL**:
```bash
curl -X POST http://localhost:8100/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is RAG?",
    "mode": "hybrid",
    "limit": 5
  }'
```

---

### 2. Streaming Ask Endpoint

Stream LLM response tokens in real-time using Server-Sent Events.

**Endpoint**: `POST /api/ask/stream`

**Request Headers**:
```
Content-Type: application/json
Accept: text/event-stream
```

**Request Body**: Same as `/api/ask` endpoint

**Response Protocol**: Server-Sent Events (text/event-stream)

**Event Types**:

#### Event 1: Source Context
```json
data: {"type":"sources","sources":[{"document_filename":"guide.pdf","score":0.95}]}
```

#### Event 2: Token Stream (repeated)
```json
data: {"type":"token","token":"RAG","token_count":1,"model":"llama3.1:70b"}
data: {"type":"token","token":" is","token_count":2,"model":"llama3.1:70b"}
data: {"type":"token","token":" a","token_count":3,"model":"llama3.1:70b"}
```

#### Event 3: Completion
```json
data: {"type":"done","total_tokens":42,"response":"RAG is a technique for..."}
```

**Features**:
- First event includes search results (sources)
- Each token streamed individually with count
- Final event includes complete response
- Real-time token display in UI

**Example cURL**:
```bash
curl -N -H "Content-Type: application/json" \
  -d '{"question":"What is RAG?","mode":"hybrid"}' \
  http://localhost:8100/api/ask/stream
```

**Example JavaScript**:
```javascript
const response = await fetch('/api/ask/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'What is RAG?' })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const lines = decoder.decode(value).split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const event = JSON.parse(line.slice(6));
      console.log(event);
    }
  }
}
```

---

## Document Management

### 3. Upload Document

Ingest a single document into the knowledge base.

**Endpoint**: `POST /api/ingest/file`

**Request Headers**:
```
Content-Type: multipart/form-data
```

**Request Body**:
```
File: <binary PDF/DOCX/TXT/MD>
```

**Supported File Types**:
- `.pdf` - PDF documents (text-based)
- `.docx` - Microsoft Word documents
- `.txt` - Plain text files
- `.md` - Markdown files

**Response**:
```json
{
  "status": "success",
  "filename": "document.pdf",
  "chunks_created": 12,
  "tokens": 2845,
  "embedding_time_ms": 1200,
  "file_size_bytes": 456789
}
```

**Status Codes**:
- `200 OK` - File uploaded and processed
- `400 Bad Request` - Unsupported file type
- `413 Payload Too Large` - File exceeds size limit
- `500 Internal Server Error` - Processing error

**Example cURL**:
```bash
curl -X POST http://localhost:8100/api/ingest/file \
  -F "file=@document.pdf"
```

### 4. Ingest Directory

Process all documents in a specified directory.

**Endpoint**: `POST /api/ingest/directories`

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "directories": ["/data/docs", "/home/user/research"]
}
```

**Response**:
```json
{
  "status": "success",
  "directories_processed": 2,
  "total_files": 15,
  "successful": 14,
  "failed": 1,
  "total_chunks": 180,
  "processing_time_ms": 8500
}
```

**Status Codes**:
- `200 OK` - Batch processing complete
- `400 Bad Request` - Invalid directory path
- `500 Internal Server Error` - Processing error

---

## Search API

### 5. Semantic Search

Vector-based document search using embeddings.

**Endpoint**: `POST /api/search`

**Request Body**:
```json
{
  "query": "How does RAG improve LLM accuracy?",
  "limit": 10,
  "search_mode": "semantic"
}
```

**Response**:
```json
{
  "results": [
    {
      "document_filename": "rag_fundamentals.pdf",
      "score": 0.92,
      "content": "RAG improves LLM accuracy by providing access to external knowledge...",
      "chunk_id": "doc_123_chunk_5"
    },
    {
      "document_filename": "implementation_guide.md",
      "score": 0.88,
      "content": "By retrieving relevant documents before generation, RAG ensures...",
      "chunk_id": "doc_456_chunk_12"
    }
  ],
  "search_time_ms": 150,
  "total_chunks": 2
}
```

**Search Modes**:
- `semantic` - Vector similarity (default)
- `keyword` - Full-text search
- `hybrid` - Combined with RRF ranking

**Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | Required | Search query |
| `limit` | integer | 5 | Max results to return |
| `search_mode` | string | "semantic" | Search algorithm |
| `min_score` | float | 0.7 | Minimum similarity threshold |

---

## System Status

### 6. Health Check

Verify system health and component status.

**Endpoint**: `GET /api/health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-31T14:32:00Z",
  "services": {
    "database": "connected",
    "ollama": "connected",
    "embeddings": "ready"
  },
  "version": "1.0.0"
}
```

**Status Codes**:
- `200 OK` - System healthy
- `503 Service Unavailable` - System degraded

### 7. Watcher Status

Check auto-ingest file watcher status.

**Endpoint**: `GET /api/watcher/status`

**Response**:
```json
{
  "status": "running",
  "watch_dir": "/data/docs",
  "queue_size": 0,
  "processing_count": 0,
  "total_queued": 127,
  "total_processed": 127,
  "total_failed": 0,
  "total_archived": 127
}
```

**Fields**:

| Field | Description |
|-------|-------------|
| `status` | Watcher state: "running", "stopped", "error" |
| `watch_dir` | Directory being monitored |
| `queue_size` | Files waiting to be processed |
| `processing_count` | Files currently being ingested |
| `total_queued` | Total files queued since start |
| `total_processed` | Successfully ingested files |
| `total_failed` | Failed ingestion attempts |
| `total_archived` | Archived files (moved to archive/) |

### 8. Knowledge Base Statistics

Get knowledge base size and content metrics.

**Endpoint**: `GET /api/stats`

**Response**:
```json
{
  "total_chunks": 4250,
  "total_documents": 42,
  "total_tokens": 892345,
  "avg_chunk_size": 210,
  "indexing_status": "complete",
  "last_update": "2026-05-31T14:30:00Z"
}
```

---

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "detail": "Error message describing what went wrong",
  "error_code": "INVALID_REQUEST",
  "timestamp": "2026-05-31T14:32:00Z"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Malformed request or missing parameters |
| `NOT_FOUND` | 404 | Resource not found |
| `FILE_TOO_LARGE` | 413 | Uploaded file exceeds size limit |
| `UNSUPPORTED_FORMAT` | 400 | File type not supported |
| `PROCESSING_ERROR` | 500 | Error during document processing |
| `DATABASE_ERROR` | 500 | Database connection error |
| `OLLAMA_ERROR` | 503 | Ollama service unavailable |
| `EMBEDDING_ERROR` | 500 | Embedding generation failed |

### Retry Strategy

- **Transient Errors** (5xx): Implement exponential backoff (2s, 4s, 8s)
- **Client Errors** (4xx): Don't retry, fix the request
- **Max Retries**: 3 attempts with 30-second timeout

---

## Rate Limiting

**Current Status**: No rate limiting (suitable for single-user/internal deployments)

**Future Enhancement**: Token bucket rate limiting planned for multi-user deployments
- Limit: 100 requests/minute per API key
- Burst: 200 requests/minute (temporary)

---

## Code Examples

### Python - Streaming Response

```python
import requests
import json

url = "http://localhost:8100/api/ask/stream"
payload = {
    "question": "What is RAG?",
    "mode": "hybrid",
    "limit": 5
}

response = requests.post(url, json=payload, stream=True)

for line in response.iter_lines():
    if line.startswith(b'data: '):
        event = json.loads(line[6:])
        if event['type'] == 'token':
            print(event['token'], end='', flush=True)
        elif event['type'] == 'done':
            print(f"\n\nTotal tokens: {event['total_tokens']}")
        elif event['type'] == 'sources':
            print(f"Sources: {len(event['sources'])} documents")
```

### JavaScript - Frontend Integration

```javascript
class RAGClient {
  constructor(baseUrl = 'http://localhost:8100') {
    this.baseUrl = baseUrl;
  }

  async askStream(question, onToken, onDone, onError) {
    try {
      const response = await fetch(`${this.baseUrl}/api/ask/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          mode: 'hybrid',
          limit: 5
        })
      });

      if (!response.ok) throw new Error('Request failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });

        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'token') onToken(event.token);
            if (event.type === 'done') onDone(event);
          }
        }

        if (done) break;
      }
    } catch (error) {
      onError(error);
    }
  }

  async ask(question) {
    const response = await fetch(`${this.baseUrl}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, mode: 'hybrid' })
    });
    return response.json();
  }
}

// Usage
const client = new RAGClient();
let fullText = '';

client.askStream(
  'What is RAG?',
  (token) => { fullText += token; console.log(token); },
  (event) => { console.log(`Complete: ${event.total_tokens} tokens`); },
  (error) => { console.error('Error:', error); }
);
```

### cURL - Common Operations

```bash
# Ask a question (streaming)
curl -N -H "Content-Type: application/json" \
  -d '{"question":"How does RAG work?","mode":"hybrid"}' \
  http://localhost:8100/api/ask/stream

# Search documents
curl -X POST http://localhost:8100/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query":"RAG implementation",
    "limit":10,
    "search_mode":"hybrid"
  }'

# Upload a document
curl -X POST http://localhost:8100/api/ingest/file \
  -F "file=@myfile.pdf"

# Check system health
curl http://localhost:8100/api/health

# Get watcher status
curl http://localhost:8100/api/watcher/status

# Get KB statistics
curl http://localhost:8100/api/stats
```

---

## Deployment Notes

### Environment Configuration

Key environment variables in `.env`:

```bash
# LLM Configuration
OLLAMA_BASE_URL=http://ollama:11434
LLM_MODEL=llama3.1:70b          # Or distilled 3B for Phase 4E
LLM_TEMPERATURE=0.3

# Embedding Configuration
EMBEDDING_MODEL=all-MiniLM-L6-v2
EMBEDDING_BACKEND=sentence-transformers

# RAG Settings
RAG_TOP_K=5
RAG_MIN_SIMILARITY=0.7

# Database
POSTGRES_DB=ragdb
POSTGRES_USER=raguser
POSTGRES_PASSWORD=ragpass
```

### Docker Deployment

```bash
cd /home/devel/exudeai/rag-bootstrap
docker compose up -d
```

Check logs:
```bash
docker compose logs -f api
```

Stop services:
```bash
docker compose down
```

### Performance Characteristics

- **Streaming Latency**: 10-100ms per token
- **Search Time**: 100-300ms for 5 results
- **Ingestion**: 50-200ms per chunk
- **Memory**: 4GB minimum (embeddings + DB)

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2026-05-31 | Production release with streaming and auto-ingest |
| 0.9.0 | 2026-05-07 | Phase A: Streaming and watcher features |
| 0.8.0 | 2026-01-28 | Phase 1: Core RAG functionality |

---

## Support & Feedback

For issues or questions:
1. Check RAG logs: `docker compose logs api`
2. Review integration test results: `./tests/test-streaming-and-watcher.sh test` (run from repo root)
3. Verify health endpoint: `GET /api/health`
4. Check watcher status: `GET /api/watcher/status`

---

## Appendix: WebSocket Chat Endpoint (Legacy)

The system also includes a legacy WebSocket endpoint for real-time chat:

**Endpoint**: `ws://localhost:8100/ws/chat`

**Message Format**:
```json
{
  "type": "question",
  "content": "What is RAG?",
  "mode": "hybrid"
}
```

**Note**: SSE streaming (`/api/ask/stream`) is recommended for new integrations.

---

**End of Document**

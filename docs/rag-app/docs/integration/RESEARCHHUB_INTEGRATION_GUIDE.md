# ResearchHub Integration Guide

**Version**: 1.0
**Date**: 2026-05-06
**Status**: Integration Ready
**Audience**: Backend Engineers, Integration Specialists

---

## Overview

This guide explains how to integrate RAG Bootstrap with ResearchHub, enabling ResearchHub to leverage RAG capabilities for:

- **Document Search**: Semantic and hybrid search across research documents
- **Question Answering**: RAG-augmented responses to research questions
- **Chat Interface**: Multi-turn conversations with document context
- **Knowledge Base Management**: Organize research documents into knowledge bases

---

## Integration Architecture

### Deployment Model

```
ResearchHub                    RAG Bootstrap
┌──────────────────┐          ┌──────────────────┐
│ Frontend UI      │          │ API Server       │
│ (React)          │          │ (FastAPI)        │
└────────┬─────────┘          └────────┬─────────┘
         │                             │
         │ HTTP/WebSocket             │
         │ (REST + SSE)              │
         │                             │
┌────────▼────────────────────────────▼─────────┐
│         Integration Layer (Proxy)              │
│  - Authentication                              │
│  - Request/Response Transformation             │
│  - Rate Limiting                               │
│  - Logging & Monitoring                        │
└─────────────────────────────────────────────────┘
         │                             │
         │ Private Network (VPC)      │
         │                             │
┌────────▼─────────────────────────────┐
│  PostgreSQL + Redis + Ollama         │
│  (Shared or Dedicated)               │
└──────────────────────────────────────┘
```

### Integration Points

1. **REST API Integration**: Synchronous request-response
2. **WebSocket Integration**: Real-time chat and streaming
3. **Document Ingestion**: Bulk upload and indexing
4. **Knowledge Base Management**: Multi-tenant KB isolation

---

## REST API Integration

### Setup & Configuration

#### 1. Environment Configuration
```python
# researchhub/config.py - Add RAG configuration

class RAGConfig:
    # RAG Bootstrap endpoint
    RAG_BASE_URL = os.getenv("RAG_BASE_URL", "http://rag-bootstrap-api:8000")

    # API credentials (if needed)
    RAG_API_KEY = os.getenv("RAG_API_KEY", None)

    # Timeouts
    RAG_TIMEOUT = 30  # seconds
    RAG_MAX_RETRIES = 3

    # Rate limiting
    RAG_RATE_LIMIT = "100/minute"  # per user

    # Caching
    RAG_CACHE_TTL = 3600  # seconds

# Usage in .env
RAG_BASE_URL=http://localhost:8000
RAG_API_KEY=your-secret-key-if-needed
```

#### 2. Client Library
```python
# researchhub/services/rag_client.py

import httpx
from typing import List, Dict, Optional
from tenacity import retry, stop_after_attempt, wait_exponential

class RAGBootstrapClient:
    def __init__(self, base_url: str, api_key: Optional[str] = None, timeout: int = 30):
        self.base_url = base_url
        self.api_key = api_key
        self.timeout = timeout
        self.client = httpx.AsyncClient(
            base_url=base_url,
            timeout=timeout,
            headers={"Authorization": f"Bearer {api_key}"} if api_key else {}
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    async def health_check(self) -> bool:
        """Check RAG Bootstrap health"""
        try:
            response = await self.client.get("/api/v2/health")
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False

    async def search(
        self,
        query: str,
        kb_name: str,
        mode: str = "hybrid",
        top_k: int = 5
    ) -> List[Dict]:
        """Search knowledge base"""
        response = await self.client.post("/api/v2/search", json={
            "query": query,
            "kb_name": kb_name,
            "mode": mode,
            "top_k": top_k
        })
        response.raise_for_status()
        return response.json()["results"]

    async def chat(
        self,
        session_id: str,
        message: str,
        kb_name: str,
        stream: bool = False
    ):
        """Send chat message to RAG"""
        endpoint = "/api/v2/chat/stream" if stream else "/api/v2/chat"

        if stream:
            # Stream response
            async with self.client.stream(
                "POST",
                endpoint,
                json={
                    "session_id": session_id,
                    "message": message,
                    "kb_name": kb_name
                }
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    yield line
        else:
            # Single response
            response = await self.client.post(endpoint, json={
                "session_id": session_id,
                "message": message,
                "kb_name": kb_name
            })
            response.raise_for_status()
            return response.json()

    async def ingest_document(
        self,
        file_path: str,
        kb_name: str,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """Upload document to knowledge base"""
        with open(file_path, "rb") as f:
            files = {"file": f}
            data = {"kb_name": kb_name}
            if metadata:
                data["metadata"] = json.dumps(metadata)

            response = await self.client.post(
                "/api/v2/ingest",
                files=files,
                data=data
            )
            response.raise_for_status()
            return response.json()

    async def list_kbs(self) -> List[Dict]:
        """List all knowledge bases"""
        response = await self.client.get("/api/v2/kbs")
        response.raise_for_status()
        return response.json()

    async def create_kb(
        self,
        name: str,
        description: str,
        search_mode: str = "hybrid"
    ) -> Dict:
        """Create new knowledge base"""
        response = await self.client.post("/api/v2/kbs", json={
            "name": name,
            "description": description,
            "search_mode": search_mode
        })
        response.raise_for_status()
        return response.json()

    async def close(self):
        """Close client"""
        await self.client.aclose()

# Singleton instance
rag_client: Optional[RAGBootstrapClient] = None

def get_rag_client() -> RAGBootstrapClient:
    global rag_client
    if not rag_client:
        from researchhub.config import RAGConfig
        rag_client = RAGBootstrapClient(
            base_url=RAGConfig.RAG_BASE_URL,
            api_key=RAGConfig.RAG_API_KEY,
            timeout=RAGConfig.RAG_TIMEOUT
        )
    return rag_client
```

### API Endpoint Integration Examples

#### Example 1: Search API
```python
# researchhub/api/routes/search.py

from fastapi import APIRouter, Depends, HTTPException
from researchhub.services.rag_client import get_rag_client
from researchhub.models import SearchRequest, SearchResponse

router = APIRouter(prefix="/api/v1/search", tags=["search"])

@router.post("/", response_model=SearchResponse)
async def search(
    request: SearchRequest,
    rag_client = Depends(get_rag_client)
):
    """
    Search research documents using RAG Bootstrap

    Args:
        query: Search query
        kb_name: Knowledge base name (e.g., "research", "papers")
        mode: Search mode - "semantic", "keyword", or "hybrid"
        top_k: Number of results to return
    """
    try:
        # Call RAG Bootstrap
        results = await rag_client.search(
            query=request.query,
            kb_name=request.kb_name,
            mode=request.mode,
            top_k=request.top_k
        )

        return SearchResponse(
            query=request.query,
            results=results,
            count=len(results)
        )

    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

#### Example 2: Chat API
```python
# researchhub/api/routes/chat.py

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from researchhub.services.rag_client import get_rag_client
from researchhub.models import ChatRequest

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])

@router.post("/send")
async def send_message(
    request: ChatRequest,
    rag_client = Depends(get_rag_client)
):
    """Send message to RAG chat"""
    try:
        response = await rag_client.chat(
            session_id=request.session_id,
            message=request.message,
            kb_name=request.kb_name,
            stream=False
        )
        return response

    except Exception as e:
        logger.error(f"Chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stream")
async def stream_message(
    request: ChatRequest,
    rag_client = Depends(get_rag_client)
):
    """Stream chat response tokens"""
    async def generate():
        try:
            async for token in rag_client.chat(
                session_id=request.session_id,
                message=request.message,
                kb_name=request.kb_name,
                stream=True
            ):
                yield f"data: {token}\n\n"
        except Exception as e:
            logger.error(f"Stream failed: {e}")
            yield f"data: {{'error': '{str(e)}'}}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )
```

#### Example 3: Document Ingestion
```python
# researchhub/api/routes/documents.py

from fastapi import APIRouter, UploadFile, File, Depends

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    kb_name: str = "default",
    rag_client = Depends(get_rag_client)
):
    """Upload document to RAG knowledge base"""
    try:
        # Save temporary file
        temp_path = f"/tmp/{file.filename}"
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)

        # Ingest into RAG
        result = await rag_client.ingest_document(
            file_path=temp_path,
            kb_name=kb_name,
            metadata={
                "source": "ResearchHub",
                "uploaded_by": current_user.id,
                "timestamp": datetime.now().isoformat()
            }
        )

        return {
            "status": "success",
            "document_id": result.get("document_id"),
            "chunks": result.get("chunks_created")
        }

    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Cleanup temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)
```

---

## WebSocket Integration

### Real-time Chat with RAG

```python
# researchhub/websocket/rag_chat.py

from fastapi import WebSocket, WebSocketDisconnect
from researchhub.services.rag_client import get_rag_client

class RAGChatManager:
    def __init__(self):
        self.active_sessions: Dict[str, WebSocket] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        """Connect new chat session"""
        await websocket.accept()
        self.active_sessions[session_id] = websocket
        logger.info(f"Chat session {session_id} connected")

    async def disconnect(self, session_id: str):
        """Disconnect chat session"""
        del self.active_sessions[session_id]
        logger.info(f"Chat session {session_id} disconnected")

    async def handle_message(
        self,
        session_id: str,
        websocket: WebSocket,
        message: dict
    ):
        """Handle incoming chat message"""
        rag_client = get_rag_client()

        try:
            # Extract message info
            user_message = message.get("text")
            kb_name = message.get("kb_name", "default")

            # Send acknowledgment
            await websocket.send_json({
                "type": "ack",
                "session_id": session_id
            })

            # Stream response from RAG
            async for token in rag_client.chat(
                session_id=session_id,
                message=user_message,
                kb_name=kb_name,
                stream=True
            ):
                # Send token to client
                await websocket.send_json({
                    "type": "token",
                    "text": token
                })

            # Send completion
            await websocket.send_json({
                "type": "done"
            })

        except Exception as e:
            logger.error(f"Message handling failed: {e}")
            await websocket.send_json({
                "type": "error",
                "text": str(e)
            })

# WebSocket endpoint
rag_chat_manager = RAGChatManager()

@app.websocket("/ws/chat/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for RAG chat"""
    await rag_chat_manager.connect(session_id, websocket)

    try:
        while True:
            message = await websocket.receive_json()
            await rag_chat_manager.handle_message(session_id, websocket, message)

    except WebSocketDisconnect:
        await rag_chat_manager.disconnect(session_id)

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await rag_chat_manager.disconnect(session_id)
```

### Frontend Integration Example (React)
```javascript
// researchhub/frontend/hooks/useRAGChat.ts

import { useCallback, useState, useRef } from 'react';

export function useRAGChat(sessionId: string, kbName: string = 'default') {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socketRef.current = new WebSocket(
      `${protocol}//${window.location.host}/ws/chat/${sessionId}`
    );

    socketRef.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'token':
          // Append token to last message
          setMessages(prev => {
            const last = prev[prev.length - 1];
            return [
              ...prev.slice(0, -1),
              { ...last, text: last.text + msg.text }
            ];
          });
          break;
        case 'done':
          setIsLoading(false);
          break;
        case 'error':
          setIsLoading(false);
          console.error('Chat error:', msg.text);
          break;
      }
    };
  }, [sessionId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!socketRef.current) return;

    setIsLoading(true);

    // Add user message
    setMessages(prev => [...prev, { role: 'user', text }]);

    // Add assistant message placeholder
    setMessages(prev => [...prev, { role: 'assistant', text: '' }]);

    // Send to RAG
    socketRef.current.send(JSON.stringify({
      text,
      kb_name: kbName
    }));
  }, [kbName]);

  return {
    messages,
    isLoading,
    connect,
    sendMessage,
    disconnect: () => socketRef.current?.close()
  };
}

// Usage in component
function ChatWindow() {
  const { messages, isLoading, sendMessage } = useRAGChat('user-123');

  return (
    <div className="chat-window">
      {messages.map((msg, i) => (
        <div key={i} className={`message ${msg.role}`}>
          {msg.text}
        </div>
      ))}
      {isLoading && <div className="typing">●●●</div>}
      <input
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            sendMessage(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
        placeholder="Ask a question..."
      />
    </div>
  );
}
```

---

## Knowledge Base Management

### Multi-KB Setup for ResearchHub

```python
# scripts/setup_researchhub_kbs.py

import asyncio
from researchhub.services.rag_client import RAGBootstrapClient

async def setup_kbs():
    """Initialize knowledge bases for ResearchHub"""

    client = RAGBootstrapClient(base_url="http://localhost:8000")

    kbs = [
        {
            "name": "papers",
            "description": "Research papers and publications",
            "search_mode": "hybrid"
        },
        {
            "name": "documentation",
            "description": "Technical documentation",
            "search_mode": "hybrid"
        },
        {
            "name": "datasets",
            "description": "Dataset descriptions and metadata",
            "search_mode": "semantic"
        },
        {
            "name": "conferences",
            "description": "Conference proceedings",
            "search_mode": "hybrid"
        },
    ]

    for kb_config in kbs:
        try:
            result = await client.create_kb(
                name=kb_config["name"],
                description=kb_config["description"],
                search_mode=kb_config["search_mode"]
            )
            print(f"✓ Created KB: {kb_config['name']}")
        except Exception as e:
            print(f"✗ Failed to create {kb_config['name']}: {e}")

    await client.close()

if __name__ == "__main__":
    asyncio.run(setup_kbs())
```

### Multi-Tenancy Isolation

```python
# researchhub/services/rag_multitenant.py

from typing import Dict, Optional

class RAGMultiTenantManager:
    """Manage RAG knowledge bases per ResearchHub organization"""

    def __init__(self, rag_client):
        self.rag = rag_client
        self._kb_cache: Dict[str, str] = {}

    def get_kb_name(self, org_id: str, kb_type: str = "default") -> str:
        """Get knowledge base name for organization"""
        # Format: org_<org_id>_<type>
        return f"org_{org_id}_{kb_type}"

    async def ensure_kb_exists(self, org_id: str, kb_type: str = "default") -> str:
        """Ensure KB exists for organization, create if needed"""
        kb_name = self.get_kb_name(org_id, kb_type)

        # Check cache
        if kb_name in self._kb_cache:
            return kb_name

        # Check if exists
        kbs = await self.rag.list_kbs()
        if any(kb["name"] == kb_name for kb in kbs):
            self._kb_cache[kb_name] = kb_name
            return kb_name

        # Create if not exists
        await self.rag.create_kb(
            name=kb_name,
            description=f"Knowledge base for org {org_id}",
            search_mode="hybrid"
        )

        self._kb_cache[kb_name] = kb_name
        return kb_name

    async def search_org(
        self,
        org_id: str,
        query: str,
        kb_type: str = "default",
        top_k: int = 5
    ):
        """Search organization's knowledge base"""
        kb_name = await self.ensure_kb_exists(org_id, kb_type)

        return await self.rag.search(
            query=query,
            kb_name=kb_name,
            top_k=top_k
        )

    async def ingest_org_document(
        self,
        org_id: str,
        file_path: str,
        kb_type: str = "default",
        metadata: Optional[Dict] = None
    ):
        """Ingest document into organization's KB"""
        kb_name = await self.ensure_kb_exists(org_id, kb_type)

        if metadata is None:
            metadata = {}

        metadata["org_id"] = org_id

        return await self.rag.ingest_document(
            file_path=file_path,
            kb_name=kb_name,
            metadata=metadata
        )

# Usage in ResearchHub routes
@router.post("/search")
async def search_org_docs(
    org_id: str,
    query: str,
    current_user = Depends(get_current_user)
):
    """Search org documents"""
    # Verify user belongs to org
    if not user_has_access(current_user, org_id):
        raise HTTPException(status_code=403)

    rag = get_rag_client()
    multitenant = RAGMultiTenantManager(rag)

    results = await multitenant.search_org(
        org_id=org_id,
        query=query
    )

    return {"results": results}
```

---

## Testing & Validation

### Integration Tests
```python
# tests/test_rag_integration.py

import pytest
from researchhub.services.rag_client import RAGBootstrapClient

@pytest.fixture
async def rag_client():
    client = RAGBootstrapClient(base_url="http://localhost:8000")
    yield client
    await client.close()

@pytest.mark.asyncio
async def test_health_check(rag_client):
    """Test RAG Bootstrap health check"""
    is_healthy = await rag_client.health_check()
    assert is_healthy, "RAG Bootstrap is not healthy"

@pytest.mark.asyncio
async def test_search(rag_client):
    """Test search functionality"""
    results = await rag_client.search(
        query="machine learning",
        kb_name="test",
        top_k=5
    )
    assert isinstance(results, list), "Search should return list"

@pytest.mark.asyncio
async def test_chat(rag_client):
    """Test chat functionality"""
    response = await rag_client.chat(
        session_id="test-123",
        message="What is RAG?",
        kb_name="test",
        stream=False
    )
    assert "response" in response or "text" in response, "Chat should return response"

@pytest.mark.asyncio
async def test_kb_creation(rag_client):
    """Test knowledge base creation"""
    result = await rag_client.create_kb(
        name="test-kb",
        description="Test KB"
    )
    assert "name" in result, "Should return created KB"

    # Cleanup
    # await rag_client.delete_kb("test-kb")

@pytest.mark.asyncio
async def test_document_ingestion(rag_client, tmp_path):
    """Test document ingestion"""
    # Create test file
    test_file = tmp_path / "test.txt"
    test_file.write_text("Sample research document content")

    result = await rag_client.ingest_document(
        file_path=str(test_file),
        kb_name="test"
    )

    assert result.get("success") or "document_id" in result, "Ingestion should succeed"
```

### Performance Testing
```python
# tests/test_rag_performance.py

import time
import asyncio
from statistics import mean, stdev

@pytest.mark.asyncio
async def test_search_latency(rag_client):
    """Measure search latency"""
    queries = [
        "machine learning",
        "neural networks",
        "deep learning",
        "data science",
        "AI"
    ]

    latencies = []

    for query in queries:
        start = time.time()
        await rag_client.search(query=query, kb_name="test")
        latencies.append((time.time() - start) * 1000)  # ms

    avg_latency = mean(latencies)
    max_latency = max(latencies)

    print(f"Search latency: avg={avg_latency:.1f}ms, max={max_latency:.1f}ms")
    assert avg_latency < 100, "Search should be < 100ms on average"

@pytest.mark.asyncio
async def test_concurrent_searches(rag_client):
    """Test concurrent search performance"""
    num_concurrent = 10

    async def search_task():
        return await rag_client.search(
            query="test query",
            kb_name="test"
        )

    start = time.time()
    await asyncio.gather(*[search_task() for _ in range(num_concurrent)])
    duration = time.time() - start

    throughput = num_concurrent / duration
    print(f"Concurrent searches: {throughput:.1f} req/sec")
    assert throughput > 10, "Should handle 10+ concurrent searches/sec"
```

---

## Monitoring & Debugging

### Health Monitoring
```python
# researchhub/services/rag_monitor.py

class RAGHealthMonitor:
    def __init__(self, rag_client, check_interval: int = 60):
        self.rag = rag_client
        self.check_interval = check_interval
        self.is_healthy = False
        self.last_check = None

    async def start(self):
        """Start health monitoring"""
        while True:
            try:
                self.is_healthy = await self.rag.health_check()
                self.last_check = datetime.now()

                if self.is_healthy:
                    logger.info("RAG Bootstrap: OK")
                else:
                    logger.warning("RAG Bootstrap: Unhealthy")

            except Exception as e:
                logger.error(f"RAG health check failed: {e}")
                self.is_healthy = False

            await asyncio.sleep(self.check_interval)

    def get_status(self) -> dict:
        return {
            "healthy": self.is_healthy,
            "last_check": self.last_check,
            "uptime": "up" if self.is_healthy else "down"
        }

# Start monitoring on app startup
monitor = RAGHealthMonitor(get_rag_client())
asyncio.create_task(monitor.start())
```

### Request/Response Logging
```python
# researchhub/middleware/rag_logging.py

class RAGLoggingMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, request, call_next):
        # Log RAG requests
        if "/rag/" in request.url.path:
            start = time.time()

            response = await call_next(request)

            duration = time.time() - start

            logger.info(f"RAG Request",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": duration * 1000,
                }
            )

            return response

        return await call_next(request)

app.add_middleware(RAGLoggingMiddleware)
```

---

## Deployment & Operations

### Docker Compose Setup for ResearchHub + RAG
```yaml
# docker-compose.researchhub.yml

version: '3.8'

services:
  researchhub-api:
    build: ./researchhub
    ports:
      - "8000:8000"
    environment:
      RAG_BASE_URL: http://rag-api:8000
      DATABASE_URL: postgresql://user:pass@postgres:5432/researchhub
    depends_on:
      - postgres
      - rag-api
    networks:
      - shared

  rag-api:
    build: ../rag-bootstrap/app
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_DB: ragdb
      POSTGRES_USER: raguser
      POSTGRES_PASSWORD: ragpass
      REDIS_URL: redis://redis:6379/0
      OLLAMA_BASE_URL: http://host.docker.internal:11434
    depends_on:
      - postgres
      - redis
    networks:
      - shared

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: ragdb
      POSTGRES_USER: raguser
      POSTGRES_PASSWORD: ragpass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - shared

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    networks:
      - shared

volumes:
  postgres_data:
  redis_data:

networks:
  shared:
    driver: bridge
```

---

## Troubleshooting

### Common Issues & Solutions

#### Issue: Connection Refused
```bash
# Check RAG Bootstrap is running
curl http://localhost:8000/api/v2/health

# If failed, check docker logs
docker logs rag-bootstrap-api

# Verify network connectivity
docker network inspect rag-bootstrap
```

#### Issue: Slow Search Responses
```bash
# Check RAG response time
curl -X POST http://localhost:8000/api/v2/search \
  -H "Content-Type: application/json" \
  -d '{"query":"test","kb_name":"test"}' \
  -w "@curl-format.txt"

# Check cache hit rate
curl http://localhost:8000/cache-stats | jq .embedding.hit_rate

# Restart redis if cache corrupted
docker-compose restart redis
```

#### Issue: WebSocket Disconnections
```bash
# Check timeout settings
grep -i "timeout" /path/to/rag-config.yaml

# Increase if needed
timeout: 600  # 10 minutes

# Check logs for connection errors
docker logs rag-bootstrap-frontend | grep -i error
```

---

## Summary

RAG Bootstrap provides a comprehensive integration interface for ResearchHub:

✅ **REST APIs** for all major operations
✅ **WebSocket support** for real-time chat
✅ **Multi-tenancy** for organization isolation
✅ **Document ingestion** for knowledge base building
✅ **Flexible search modes** for different use cases

**Integration effort**: 2-3 days for full implementation
**Maintenance**: Minimal (health checks, monitoring)
**Support**: Refer to RAG Bootstrap docs for detailed API reference

---

**Document Version**: 1.0
**Last Updated**: 2026-05-06
**Next Review**: 2026-06-06

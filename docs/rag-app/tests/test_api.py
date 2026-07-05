"""Integration tests for FastAPI endpoints.

These tests require a running PostgreSQL (with pgvector) and Redis instance.
They are marked with @pytest.mark.integration and will be skipped if the
database is unavailable.
"""

from __future__ import annotations

import pytest

pytestmark = [pytest.mark.integration, pytest.mark.asyncio]


def _skip_if_no_db():
    """Helper to check if DB infrastructure is available."""
    try:
        import asyncpg  # noqa: F401
    except ImportError:
        pytest.skip("asyncpg not installed")


class TestHealthEndpoint:
    async def test_health_returns_status(self, async_client):
        _skip_if_no_db()
        resp = await async_client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "database" in data
        assert "redis" in data
        assert "embedding_service" in data


class TestIngestEndpoint:
    async def test_ingest_file_upload(self, async_client, tmp_files):
        _skip_if_no_db()
        txt_path = tmp_files["txt"]
        with open(txt_path, "rb") as f:
            resp = await async_client.post(
                "/api/ingest/file",
                files={"file": ("sample.txt", f, "text/plain")},
            )
        assert resp.status_code == 201
        data = resp.json()
        assert data["filename"] == "sample.txt"
        assert data["chunk_count"] >= 1


class TestDocumentsEndpoints:
    async def test_list_documents(self, async_client):
        _skip_if_no_db()
        resp = await async_client.get("/api/documents")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_get_document_not_found(self, async_client):
        _skip_if_no_db()
        resp = await async_client.get("/api/documents/999999")
        assert resp.status_code == 404

    async def test_delete_document_not_found(self, async_client):
        _skip_if_no_db()
        resp = await async_client.delete("/api/documents/999999")
        assert resp.status_code == 404


class TestSearchEndpoint:
    async def test_search_semantic(self, async_client):
        _skip_if_no_db()
        resp = await async_client.post(
            "/api/search",
            json={"query": "test query", "mode": "semantic", "limit": 5},
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_search_keyword(self, async_client):
        _skip_if_no_db()
        resp = await async_client.post(
            "/api/search",
            json={"query": "test query", "mode": "keyword", "limit": 5},
        )
        assert resp.status_code == 200

    async def test_search_hybrid(self, async_client):
        _skip_if_no_db()
        resp = await async_client.post(
            "/api/search",
            json={"query": "test query", "mode": "hybrid", "limit": 5},
        )
        assert resp.status_code == 200

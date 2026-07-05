"""Shared fixtures for the RAG Bootstrap test suite."""

from __future__ import annotations

import json
import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio

# ---------------------------------------------------------------------------
# Environment overrides - must happen BEFORE any app imports
# ---------------------------------------------------------------------------
os.environ.setdefault("POSTGRES_DB", "test_ragdb")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

EMBEDDING_DIM = 384


def _fake_vector(seed: float = 0.1) -> list[float]:
    """Return a deterministic vector of the correct dimension."""
    return [seed] * EMBEDDING_DIM


@pytest.fixture()
def mock_embedding_service():
    """EmbeddingService that returns fixed vectors without loading any model."""
    svc = MagicMock()
    svc.embed_text = AsyncMock(return_value=_fake_vector())
    svc.embed_batch = AsyncMock(
        side_effect=lambda texts: [_fake_vector(0.1 + i * 0.01) for i in range(len(texts))]
    )
    svc.health_check = AsyncMock(return_value=True)
    svc.backend = "sentence-transformers"
    svc.model_name = "all-MiniLM-L6-v2"
    return svc


@pytest.fixture()
def mock_redis():
    """Async Redis mock with get/set/ping."""
    r = AsyncMock()
    r.get = AsyncMock(return_value=None)
    r.set = AsyncMock(return_value=True)
    r.ping = AsyncMock(return_value=True)
    return r


@pytest.fixture()
def tmp_files(tmp_path: Path) -> dict[str, Path]:
    """Create temporary sample files for ingestion tests."""
    md = tmp_path / "sample.md"
    md.write_text("# Title\n\nSome markdown content with **bold** text.\n", encoding="utf-8")

    txt = tmp_path / "sample.txt"
    txt.write_text("Plain text content for testing.\n", encoding="utf-8")

    json_file = tmp_path / "sample.json"
    json_file.write_text(json.dumps({"key": "value", "nested": {"a": 1}}), encoding="utf-8")

    yaml_file = tmp_path / "sample.yaml"
    yaml_file.write_text("title: test\nitems:\n  - one\n  - two\n", encoding="utf-8")

    return {
        "md": md,
        "txt": txt,
        "json": json_file,
        "yaml": yaml_file,
        "dir": tmp_path,
    }


# ---------------------------------------------------------------------------
# FastAPI test client (integration - needs real DB)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture()
async def async_client():
    """httpx AsyncClient wired to the FastAPI app.

    Marked for integration use because the app lifespan connects to
    PostgreSQL and Redis.  Import is deferred so unit tests that never
    request this fixture don't trigger database connections.
    """
    try:
        from app.main import app
        from httpx import ASGITransport, AsyncClient

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            yield client
    except Exception:
        pytest.skip("Could not create async test client (DB/Redis unavailable)")

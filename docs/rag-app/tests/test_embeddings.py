"""Tests for app.embeddings.EmbeddingService."""

from __future__ import annotations

import hashlib
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.embeddings import EmbeddingService

DIM = 384


def _vec(val: float = 0.1) -> list[float]:
    return [val] * DIM


@pytest.mark.unit
class TestEmbeddingServiceLocal:
    """Tests with mocked sentence-transformers backend."""

    def _make_service(self, redis=None):
        svc = EmbeddingService(
            backend="sentence-transformers",
            model_name="test-model",
            redis_client=redis,
        )
        # Mock the local model so it never loads the real one
        mock_model = MagicMock()
        mock_model.encode.return_value = MagicMock(tolist=lambda: _vec())
        svc._local_model = mock_model
        return svc

    async def test_embed_text_returns_vector(self):
        svc = self._make_service()
        result = await svc.embed_text("hello")
        assert len(result) == DIM
        assert isinstance(result[0], float)

    async def test_embed_text_calls_local_model(self):
        svc = self._make_service()
        await svc.embed_text("hello")
        svc._local_model.encode.assert_called_once()

    async def test_embed_batch_returns_correct_count(self):
        import numpy as np

        svc = self._make_service()
        svc._local_model.encode.return_value = np.array([_vec(), _vec(0.2), _vec(0.3)])
        results = await svc.embed_batch(["a", "b", "c"])
        assert len(results) == 3

    async def test_health_check_returns_true(self):
        svc = self._make_service()
        assert await svc.health_check() is True


@pytest.mark.unit
class TestEmbeddingServiceCache:
    """Tests for Redis caching behavior."""

    async def test_cache_miss_calls_model(self):
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.set = AsyncMock()

        svc = EmbeddingService(backend="sentence-transformers", model_name="m", redis_client=redis)
        mock_model = MagicMock()
        mock_model.encode.return_value = MagicMock(tolist=lambda: _vec())
        svc._local_model = mock_model

        result = await svc.embed_text("test")
        assert len(result) == DIM
        mock_model.encode.assert_called_once()
        redis.set.assert_called_once()

    async def test_cache_hit_skips_model(self):
        cached_vec = _vec(0.5)
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=json.dumps(cached_vec))
        redis.set = AsyncMock()

        svc = EmbeddingService(backend="sentence-transformers", model_name="m", redis_client=redis)
        mock_model = MagicMock()
        svc._local_model = mock_model

        result = await svc.embed_text("test")
        assert result == cached_vec
        mock_model.encode.assert_not_called()
        redis.set.assert_not_called()

    async def test_embed_batch_caches_uncached(self):
        redis = AsyncMock()
        # First text cached, second not
        redis.get = AsyncMock(side_effect=[json.dumps(_vec(0.9)), None])
        redis.set = AsyncMock()

        svc = EmbeddingService(backend="sentence-transformers", model_name="m", redis_client=redis)
        mock_model = MagicMock()
        mock_model.encode.return_value = MagicMock(
            __iter__=lambda self: iter([MagicMock(tolist=lambda: _vec(0.2))])
        )
        svc._local_model = mock_model

        results = await svc.embed_batch(["cached", "uncached"])
        assert len(results) == 2
        assert results[0] == _vec(0.9)  # from cache
        redis.set.assert_called_once()  # only the uncached one

    async def test_cache_key_is_sha256(self):
        key = EmbeddingService._cache_key("hello")
        expected_hash = hashlib.sha256(b"hello").hexdigest()
        assert key == f"emb:{expected_hash}"


@pytest.mark.unit
class TestEmbeddingServiceOllama:
    """Tests for Ollama backend with mocked httpx."""

    async def test_ollama_makes_correct_http_call(self):
        svc = EmbeddingService(
            backend="ollama",
            model_name="nomic-embed",
            ollama_base_url="http://fake:11434",
        )

        mock_response = MagicMock()
        mock_response.json.return_value = {"embedding": _vec(0.7)}
        mock_response.raise_for_status = MagicMock()

        with patch("app.embeddings.httpx.AsyncClient") as MockClient:
            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_response)
            mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
            mock_client_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client_instance

            result = await svc.embed_text("test prompt")

            mock_client_instance.post.assert_called_once_with(
                "http://fake:11434/api/embeddings",
                json={"model": "nomic-embed", "prompt": "test prompt"},
            )
            assert result == _vec(0.7)

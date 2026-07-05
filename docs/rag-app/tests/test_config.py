"""Tests for app.config.Settings."""

from __future__ import annotations

import pytest


@pytest.mark.unit
class TestSettings:
    def _make_settings(self, **overrides):
        """Create a fresh Settings instance with optional overrides.

        _env_file=None keeps the test hermetic: assert code defaults from
        app/config.py, not whatever the local .env happens to contain.
        """
        from app.config import Settings

        return Settings(_env_file=None, **overrides)

    def test_default_values(self):
        s = self._make_settings()
        assert s.EMBEDDING_MODEL == "nomic-embed-text"
        assert s.EMBEDDING_DIMENSION == 768
        assert s.CHUNK_SIZE == 512
        assert s.CHUNK_OVERLAP == 50
        assert s.EMBEDDING_BACKEND == "ollama"
        assert s.PROJECT_NAME == "rag-bootstrap"
        assert s.LLM_MODEL == "llama3.2:3b"
        assert s.POSTGRES_PORT == 5432
        assert s.OLLAMA_BASE_URL == "http://localhost:11434"

    def test_database_url_construction(self):
        s = self._make_settings(
            POSTGRES_USER="u",
            POSTGRES_PASSWORD="p",
            POSTGRES_HOST="h",
            POSTGRES_PORT=1234,
            POSTGRES_DB="d",
        )
        assert s.DATABASE_URL == "postgresql+asyncpg://u:p@h:1234/d"

    def test_env_var_override(self, monkeypatch):
        monkeypatch.setenv("EMBEDDING_MODEL", "custom-model")
        monkeypatch.setenv("CHUNK_SIZE", "1024")
        s = self._make_settings()
        assert s.EMBEDDING_MODEL == "custom-model"
        assert s.CHUNK_SIZE == 1024

    def test_redis_url_default(self):
        s = self._make_settings()
        assert "redis://" in s.REDIS_URL

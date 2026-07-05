import os
from pathlib import Path

from pydantic_settings import BaseSettings

# Package root (rag-bootstrap/), so env-file resolution never depends on CWD.
PACKAGE_ROOT = Path(__file__).resolve().parent.parent

# .env location: RAG_ENV_FILE override wins (empty treated as unset),
# else <package root>/.env.
ENV_FILE = os.getenv("RAG_ENV_FILE") or str(PACKAGE_ROOT / ".env")


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    # PostgreSQL
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "ragdb"
    POSTGRES_USER: str = "raguser"
    POSTGRES_PASSWORD: str = "ragpass"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Embedding (canonical triple: nomic-embed-text / 768 / ollama)
    EMBEDDING_MODEL: str = "nomic-embed-text"
    EMBEDDING_DIMENSION: int = 768

    # Chunking
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 50

    # Embedding backend: "ollama" (default) or "sentence-transformers"
    EMBEDDING_BACKEND: str = "ollama"

    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # LLM (for generation/Q&A — served via Ollama)
    LLM_MODEL: str = "llama3.2:3b"
    LLM_TEMPERATURE: float = 0.3
    LLM_TIMEOUT: int = 300

    # RAG retrieval
    RAG_TOP_K: int = 5
    RAG_MIN_SIMILARITY: float = 0.7

    # Project
    PROJECT_NAME: str = "rag-bootstrap"

    # Auto-ingest filesystem watcher — DEFAULT OFF (opt-in convenience).
    # Fleet lesson (2026-07-04 incident): every template-derived stack's watcher
    # consumes one inotify instance; with 5+ stacks on a host the per-user
    # fs.inotify.max_user_instances cap (128) gets exhausted and a stack fails
    # at startup. Explicit ingest (deploy.sh ingest / POST /api/ingest) is the
    # primary flow; enable the watcher (WATCHER_ENABLED=true) only on
    # single-instance hosts that want drop-a-file auto-ingest.
    WATCHER_ENABLED: bool = False

    # Docker/Deployment settings (optional, can come from environment)
    RAG_PORT: int = 10000
    RAG_NETWORK_NAME: str = "rag-network"
    ROUTER_TYPE: str = "broadcast"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    model_config = {"env_file": ENV_FILE, "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()

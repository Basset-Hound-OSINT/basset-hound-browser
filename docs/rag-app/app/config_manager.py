"""Configuration Management for Multi-KB RAG System

Supports:
- YAML-based configuration
- Environment variable overrides
- Hot-reloadable configuration
- Configuration validation
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any
from urllib.parse import quote

import yaml

logger = logging.getLogger(__name__)

# Package root (rag-bootstrap/), so config resolution never depends on CWD.
PACKAGE_ROOT = Path(__file__).resolve().parent.parent


def default_config_path() -> Path:
    """Resolve the default config.yaml location (CWD-independent).

    Resolution order:
    1. ``RAG_CONFIG_FILE`` environment variable (explicit override)
    2. ``<package root>/config/config.yaml`` (canonical template location)
    3. ``<package root>/config.yaml`` (legacy fallback, if present)

    Returns:
        Path to the config file to load (may not exist; loader warns).
    """
    if override := os.getenv("RAG_CONFIG_FILE"):
        return Path(override)

    canonical = PACKAGE_ROOT / "config" / "config.yaml"
    if canonical.exists():
        return canonical

    legacy = PACKAGE_ROOT / "config.yaml"
    if legacy.exists():
        return legacy

    # Neither exists: report the canonical location in downstream warnings.
    return canonical


class Config:
    """RAG Bootstrap configuration."""

    def __init__(self, data: dict[str, Any] | None = None):
        """Initialize configuration.

        Args:
            data: Config dict (from YAML or dict)
        """
        self.data = data or {}

    @classmethod
    def from_file(cls, path: str | Path) -> Config:
        """Load configuration from YAML file.

        Args:
            path: Path to config.yaml

        Returns:
            Config instance
        """
        path = Path(path)
        if not path.exists():
            logger.warning("Config file not found: %s", path)
            return cls({})

        try:
            with open(path) as f:
                data = yaml.safe_load(f) or {}
            logger.info("Loaded config from %s", path)
            return cls(data)
        except Exception as e:
            logger.exception("Failed to load config from %s: %s", path, e)
            return cls({})

    @classmethod
    def from_env(cls) -> Config:
        """Load configuration from environment variables.

        Supported vars:
        - RAG_MODE: mode (chat, single-rag, multi-rag)
        - RAG_ROUTER: router type (broadcast, static, llm, hybrid)
        - RAG_EMBEDDING_MODEL: embedding model name
        - RAG_LLM_MODEL: LLM model name

        Returns:
            Config instance with env vars
        """
        data = {}

        # Mode
        if mode := os.getenv("RAG_MODE"):
            data["mode"] = mode

        # Routers
        if router := os.getenv("RAG_ROUTER"):
            data["router"] = {"type": router}

        # Embedding
        if model := os.getenv("RAG_EMBEDDING_MODEL"):
            data.setdefault("embedding", {})["model"] = model

        # LLM
        if model := os.getenv("RAG_LLM_MODEL"):
            data.setdefault("llm", {})["model"] = model

        logger.info("Loaded config from environment variables")
        return cls(data)

    def get(self, key: str, default: Any = None) -> Any:
        """Get config value by key.

        Args:
            key: Dot-separated key (e.g., "knowledge_bases.atc.type")
            default: Default if not found

        Returns:
            Config value or default
        """
        parts = key.split(".")
        value = self.data

        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
                if value is None:
                    return default
            else:
                return default

        return value if value is not None else default

    def get_mode(self) -> str:
        """Get RAG mode (chat, single-rag, multi-rag)."""
        return self.get("mode", "single-rag")

    def get_knowledge_bases(self) -> dict[str, dict]:
        """Get knowledge base configurations.

        Returns:
            Dict mapping KB name → config dict
        """
        return self.get("knowledge_bases", {})

    def get_kb_defaults(self) -> dict:
        """Get shared connection defaults for postgres KBs (``kb_defaults``).

        Returns:
            The ``kb_defaults`` stanza (host/port/user/password_env/...), or {}.
        """
        return self.get("kb_defaults", {})

    def get_kb_connection(self, name: str) -> dict[str, str]:
        """Resolve one knowledge base's connection info to ``{"dsn": str}``.

        Frozen interface consumed by the KB registry (multi-KB activation
        plan section 3). Resolution order per field:

        1. ``<ENV_PREFIX>_*`` environment variables, when the KB declares
           ``env_prefix`` (escape hatch for external/exceptional KBs):
           ``_DSN`` (whole-DSN override), ``_HOST``, ``_PORT``, ``_NAME``
           (database), ``_USER``, ``_PASSWORD``, ``_DRIVER``.
        2. The KB entry's own fields: ``dsn``/``database_url`` (whole DSN),
           else ``database`` (required) plus optional
           host/port/user/password/driver overrides.
        3. The ``kb_defaults`` stanza (password via the env var named by
           ``password_env``, else an inline ``password``).

        Args:
            name: KB name as configured under ``knowledge_bases``.

        Returns:
            ``{"dsn": "<driver>://user:pass@host:port/database"}`` with
            user/password URL-quoted. Driver defaults to
            ``postgresql+asyncpg`` (the registry builds async engines).

        Raises:
            KeyError: ``name`` is not a configured knowledge base.
            ValueError: no database name or no password can be resolved.
        """
        kbs = self.get_knowledge_bases()
        if name not in kbs:
            configured = ", ".join(sorted(kbs)) or "<none>"
            raise KeyError(
                f"Unknown knowledge base '{name}' (configured: {configured})"
            )
        kb = kbs[name] or {}
        defaults = self.get_kb_defaults()
        prefix = kb.get("env_prefix")

        def env(suffix: str) -> str | None:
            if not prefix:
                return None
            value = os.getenv(f"{prefix}_{suffix}", "").strip()
            return value or None

        # Whole-DSN escape hatches take precedence over field assembly.
        dsn = env("DSN") or kb.get("dsn") or kb.get("database_url")
        if dsn:
            return {"dsn": str(dsn)}

        def resolve(field: str, suffix: str, fallback: Any) -> Any:
            value = env(suffix)
            if value is not None:
                return value
            if kb.get(field) is not None:
                return kb[field]
            if defaults.get(field) is not None:
                return defaults[field]
            return fallback

        database = env("NAME") or kb.get("database")
        if not database:
            hint = f" or {prefix}_NAME in the environment" if prefix else ""
            raise ValueError(
                f"KB '{name}' has no database name: set 'database:' in its "
                f"knowledge_bases entry{hint}"
            )

        host = resolve("host", "HOST", "postgres")
        port = resolve("port", "PORT", 5432)
        user = resolve("user", "USER", "raguser")
        driver = resolve("driver", "DRIVER", "postgresql+asyncpg")

        password = env("PASSWORD")
        if password is None and kb.get("password") is not None:
            password = kb["password"]
        if password is None:
            password_env = kb.get("password_env") or defaults.get("password_env")
            if password_env:
                password = os.getenv(password_env)
        if password is None and defaults.get("password") is not None:
            password = defaults["password"]
        if password is None:
            password_env = kb.get("password_env") or defaults.get("password_env")
            hint = (
                f"export {password_env}"
                if password_env
                else "set kb_defaults.password_env (preferred) or an inline password"
            )
            raise ValueError(
                f"KB '{name}' has no resolvable password: {hint}"
            )

        dsn = (
            f"{driver}://{quote(str(user), safe='')}:"
            f"{quote(str(password), safe='')}@{host}:{port}/{database}"
        )
        return {"dsn": dsn}

    def get_router_config(self) -> dict:
        """Get router configuration."""
        return self.get("router", {"type": "broadcast"})

    def get_embedding_config(self) -> dict:
        """Get embedding configuration."""
        return self.get("embedding", {})

    def get_llm_config(self) -> dict:
        """Get LLM configuration."""
        return self.get("llm", {})

    def validate(self) -> tuple[bool, list[str]]:
        """Validate configuration.

        Returns:
            (is_valid, error_messages)
        """
        errors = []

        # Check mode
        mode = self.get_mode()
        if mode not in ["chat", "single-rag", "multi-rag"]:
            errors.append(f"Invalid mode: {mode}")

        # Check router type
        router_config = self.get_router_config()
        router_type = router_config.get("type", "broadcast")
        if router_type not in ["broadcast", "static", "llm", "hybrid"]:
            errors.append(f"Invalid router type: {router_type}")

        # Check knowledge bases
        kbs = self.get_knowledge_bases()
        for name, kb_config in kbs.items():
            if "type" not in kb_config:
                errors.append(f"KB '{name}' missing type")

        return len(errors) == 0, errors

    def to_dict(self) -> dict:
        """Export configuration as dict.

        Returns:
            Config dictionary
        """
        return self.data.copy()

    def __repr__(self) -> str:
        return f"Config(mode={self.get_mode()}, kbs={len(self.get_knowledge_bases())})"


class ConfigManager:
    """Manages application configuration with hot-reload."""

    def __init__(self, config_path: str | Path | None = None):
        """Initialize config manager.

        Args:
            config_path: Path to config.yaml (defaults to $RAG_CONFIG_FILE,
                else <package root>/config/config.yaml — CWD-independent)
        """
        self.config_path = Path(config_path) if config_path else default_config_path()
        self._config = None
        self._load_config()

    def _load_config(self) -> None:
        """Load configuration from file and environment."""
        # Load from file
        file_config = Config.from_file(self.config_path)

        # Load from env and merge
        env_config = Config.from_env()
        merged = {**file_config.to_dict(), **env_config.to_dict()}

        self._config = Config(merged)

        # Validate
        is_valid, errors = self._config.validate()
        if not is_valid:
            logger.warning("Config validation failed: %s", errors)
        else:
            logger.info("Config loaded and validated: %s", self._config)

    def get_config(self) -> Config:
        """Get current configuration.

        Returns:
            Config instance
        """
        return self._config

    def get_knowledge_bases(self) -> dict[str, dict]:
        """Delegate to the loaded Config (see Config.get_knowledge_bases)."""
        return self._config.get_knowledge_bases()

    def get_kb_connection(self, name: str) -> dict[str, str]:
        """Delegate to the loaded Config (see Config.get_kb_connection)."""
        return self._config.get_kb_connection(name)

    def reload(self) -> None:
        """Reload configuration from disk and environment."""
        logger.info("Reloading configuration...")
        self._load_config()

    def watch_and_reload(self) -> None:
        """Watch config file for changes and reload.

        Note: Requires watchdog library. Falls back to poll-based reload.
        """
        try:
            from watchdog.events import FileSystemEventHandler
            from watchdog.observers import Observer

            class ConfigFileHandler(FileSystemEventHandler):
                def __init__(self, manager: ConfigManager):
                    self.manager = manager

                def on_modified(self, event):
                    if event.src_path.endswith("config.yaml"):
                        logger.info("Config file changed; reloading...")
                        self.manager.reload()

            observer = Observer()
            observer.schedule(
                ConfigFileHandler(self),
                path=str(self.config_path.parent),
                recursive=False,
            )
            observer.start()
            logger.info("Config file watcher started")
        except ImportError:
            logger.warning("watchdog not installed; config auto-reload disabled")


# ============================================================================
# Example Configuration
# ============================================================================

EXAMPLE_CONFIG = """
# RAG Bootstrap Configuration

# Mode: chat, single-rag, multi-rag
mode: multi-rag

# Knowledge Bases
knowledge_bases:
  primary:
    type: postgres
    database_url: postgresql://user:pass@postgres/ragdb

  atc:
    type: postgres
    database_url: postgresql://user:pass@postgres-atc/atcdb

  lightweight:
    type: keyword-only
    database_url: sqlite:///./kb.db

# Router Configuration
router:
  type: static  # broadcast, static, llm, hybrid
  static:
    rules:
      - pattern: "LAHSO|landing|approach"
        kb: atc
        confidence: 0.95
      - pattern: "neural|transformer|attention"
        kb: primary
        confidence: 0.9
      - pattern: ".*"
        kb: primary
        confidence: 0.5

# Embedding Configuration
embedding:
  enabled: true
  model: nomic-embed-text
  backend: ollama  # ollama or sentence-transformers
  dimensions: 768
  fallback_to_keyword: true

# LLM Configuration
llm:
  model: llama3.2:3b
  temperature: 0.3
  max_tokens: 500
  timeout: 300

# Chat Configuration
chat:
  max_history_messages: 50
  max_history_tokens: 4000
  use_rag_by_default: true
"""

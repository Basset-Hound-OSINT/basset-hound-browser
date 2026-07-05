"""Knowledge Base Registry

Manages lifecycle of multiple named knowledge bases.
Supports creation, retrieval, and deletion of KB instances.

Multi-KB activation (2026-07-04 plan): when a KB config carries a ``dsn``,
the registry builds a DEDICATED async engine for that KB (one postgres
instance, one logical database per KB: ``ragdb_<kb>``), creates the missing
database + schema at startup, and enforces the per-KB embedding-dimension
guard (the cross-KB cosine merge is only sound in a single embedding space).
"""

from __future__ import annotations

import logging
import os
import re
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .kb import KnowledgeBase

logger = logging.getLogger(__name__)

# Per-KB engine pool sizing (activation plan R3): 13 KBs x (2+3) + the v1
# pool must stay comfortably under postgres max_connections=200. Do NOT
# raise to the blueprint's 5/5 — that sizing was written for 3 KBs.
KB_ENGINE_POOL_SIZE = 2
KB_ENGINE_MAX_OVERFLOW = 3

# Defensive identifier check for CREATE DATABASE (names come from config).
_DB_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def default_kb_database(name: str) -> str:
    """Default logical database name for a KB (plan naming grammar).

    ``primary`` shares the v1 database (same corpus as /api/search); every
    other KB gets ``ragdb_<kb_with_underscores>``.
    """
    from .config import settings

    if name == "primary":
        return settings.POSTGRES_DB
    return "ragdb_" + name.replace("-", "_")


def resolve_kb_connection(
    name: str,
    kb_config: dict[str, Any] | None = None,
    kb_defaults: dict[str, Any] | None = None,
) -> dict[str, str]:
    """Resolve a KB's connection info to ``{"dsn": str}``.

    Resolution order (activation plan section 3):
    1. ``<ENV_PREFIX>_HOST/PORT/NAME/USER/PASSWORD`` env vars when the KB
       declares ``env_prefix`` (escape hatch for external/exceptional KBs),
    2. per-KB entry fields (``database``, optional host/port/user overrides,
       or a full ``dsn``/``database_url``),
    3. ``kb_defaults`` (shared single-instance defaults; password via the
       env var named by ``password_env``),
    4. the app's single-corpus ``POSTGRES_*`` settings.

    Fallback used when ConfigManager does not expose ``get_kb_connection``
    (that method lives in another work zone; the lifespan prefers it when
    present).
    """
    from sqlalchemy.engine.url import URL

    from .config import settings

    kb_config = kb_config or {}
    kb_defaults = kb_defaults or {}

    # Full DSN short-circuits (also accepts the legacy database_url key).
    dsn = kb_config.get("dsn") or kb_config.get("database_url")
    if dsn:
        if dsn.startswith("postgresql://"):
            dsn = "postgresql+asyncpg://" + dsn[len("postgresql://"):]
        return {"dsn": dsn}

    def _field(key: str, fallback: Any) -> Any:
        if key in kb_config:
            return kb_config[key]
        if key in kb_defaults:
            return kb_defaults[key]
        return fallback

    host = _field("host", settings.POSTGRES_HOST)
    port = int(_field("port", settings.POSTGRES_PORT))
    user = _field("user", settings.POSTGRES_USER)
    database = kb_config.get("database", default_kb_database(name))

    password_env = _field("password_env", None)
    password = os.environ.get(password_env, "") if password_env else ""
    if not password:
        password = os.environ.get("POSTGRES_PASSWORD", settings.POSTGRES_PASSWORD)

    # env_prefix override wins over everything (plan resolution order #1).
    prefix = kb_config.get("env_prefix")
    if prefix:
        host = os.environ.get(f"{prefix}_HOST", host)
        port = int(os.environ.get(f"{prefix}_PORT", str(port)))
        database = os.environ.get(f"{prefix}_NAME", database)
        user = os.environ.get(f"{prefix}_USER", user)
        password = os.environ.get(f"{prefix}_PASSWORD", password)

    url = URL.create(
        drivername="postgresql+asyncpg",
        username=user,
        password=password or None,
        host=host,
        port=port,
        database=database,
    )
    return {"dsn": url.render_as_string(hide_password=False)}


class KnowledgeRegistry:
    """Registry for managing multiple knowledge bases.

    Example:
        registry = KnowledgeRegistry()

        # Create KBs
        atc_kb = await registry.create(
            name="atc",
            kb_type="postgres",
            config={"host": "postgres-atc", "port": 5433, ...}
        )

        # Retrieve KB
        kb = await registry.get("atc")

        # List all KBs
        names = await registry.list()

        # Delete KB
        await registry.delete("atc")
    """

    def __init__(self):
        """Initialize empty registry."""
        self._kbs: dict[str, KnowledgeBase] = {}
        self._configs: dict[str, dict[str, Any]] = {}
        self._backends = {
            "postgres": self._create_postgres_kb,
            "keyword-only": self._create_keyword_only_kb,
        }

    async def create(
        self,
        name: str,
        kb_type: str,
        config: dict[str, Any] | None = None,
    ) -> KnowledgeBase:
        """Create and register a new knowledge base.

        Args:
            name: Unique KB name (e.g., "atc", "primary", "research")
            kb_type: Type of KB ("postgres", "keyword-only")
            config: Configuration dict (backend-specific)

        Returns:
            The created KnowledgeBase instance

        Raises:
            ValueError: If KB name already exists or type unknown
        """
        if name in self._kbs:
            raise ValueError(f"KB '{name}' already exists")

        if kb_type not in self._backends:
            raise ValueError(f"Unknown KB type: {kb_type}")

        config = config or {}
        creator = self._backends[kb_type]
        kb = await creator(name, config)

        self._kbs[name] = kb
        self._configs[name] = {"type": kb_type, **config}

        logger.info("Created KB '%s' (type=%s)", name, kb_type)
        return kb

    async def get(self, name: str) -> KnowledgeBase:
        """Retrieve a registered knowledge base.

        Args:
            name: KB name

        Returns:
            The KnowledgeBase instance

        Raises:
            KeyError: If KB not found
        """
        if name not in self._kbs:
            raise KeyError(f"KB '{name}' not found")
        return self._kbs[name]

    async def list(self) -> list[str]:
        """List all registered KB names.

        Returns:
            List of KB names
        """
        return list(self._kbs.keys())

    async def list_with_config(self) -> dict[str, dict]:
        """List all KBs with their configuration.

        Returns:
            Dict mapping KB name → config
        """
        return self._configs.copy()

    async def delete(self, name: str) -> None:
        """Delete a knowledge base.

        Args:
            name: KB name

        Raises:
            KeyError: If KB not found
        """
        if name not in self._kbs:
            raise KeyError(f"KB '{name}' not found")

        kb = self._kbs[name]

        # Never dispose the shared v1 engine (activation plan section 4):
        # PostgresKB.shutdown() disposes its engine, and a KB created without
        # a dsn falls back to app.database.engine — disposing that would kill
        # /api/search for the whole process.
        from .database import engine as shared_engine

        if getattr(kb, "engine", None) is shared_engine:
            logger.info(
                "KB '%s' uses the shared v1 engine; skipping engine dispose on delete",
                name,
            )
        else:
            await kb.shutdown()

        del self._kbs[name]
        del self._configs[name]

        logger.info("Deleted KB '%s'", name)

    async def shutdown_all(self) -> None:
        """Shut down all knowledge bases."""
        for name in list(self._kbs.keys()):
            try:
                await self.delete(name)
            except Exception as e:
                logger.exception("Error shutting down KB '%s': %s", name, e)

    # -- Backend-specific creators ---

    async def _create_postgres_kb(self, name: str, config: dict[str, Any]) -> KnowledgeBase:
        """Create a PostgreSQL KB.

        When ``config`` carries a ``dsn``, this KB gets a DEDICATED async
        engine (pool_size=2, max_overflow=3 — plan R3), its logical database
        is created if missing, schema + pgvector extension are initialized,
        and the per-KB embedding-dimension guard runs (hard-fail on mismatch).
        Without a dsn it falls back to the shared v1 engine/session (preserves
        current single-corpus behavior and existing tests).
        """
        from .postgres_kb import PostgresKB

        dsn = config.get("dsn")
        if dsn:
            from sqlalchemy.ext.asyncio import (
                AsyncSession,
                async_sessionmaker,
                create_async_engine,
            )

            await self._ensure_database(name, dsn)
            kb_engine = create_async_engine(
                dsn,
                echo=False,
                pool_size=KB_ENGINE_POOL_SIZE,
                max_overflow=KB_ENGINE_MAX_OVERFLOW,
            )
            session_maker = async_sessionmaker(
                kb_engine, class_=AsyncSession, expire_on_commit=False
            )
        else:
            from .database import async_session, engine

            kb_engine = config.get("engine", engine)
            session_maker = config.get("async_session_maker", async_session)

        kb = PostgresKB(
            name=name,
            engine=kb_engine,
            async_session_maker=session_maker,
            embedding_service=config.get("embedding_service"),
        )
        try:
            await kb.initialize()
            if dsn:
                # Per-KB dim guard: cross-KB cosine merge is only sound when
                # every KB was indexed in the SAME embedding space.
                await self._check_kb_dimension(name, session_maker)
        except Exception:
            if dsn:
                await kb_engine.dispose()
            raise
        return kb

    async def _ensure_database(self, name: str, dsn: str) -> None:
        """Create the KB's logical database on the shared instance if missing.

        Connects to a maintenance database (``postgres``, falling back to the
        app's default database) with AUTOCOMMIT (CREATE DATABASE cannot run in
        a transaction) and issues ``CREATE DATABASE`` only when absent, so
        adding KB #14+ never requires wiping volumes.
        """
        from sqlalchemy import text
        from sqlalchemy.engine.url import make_url
        from sqlalchemy.ext.asyncio import create_async_engine
        from sqlalchemy.pool import NullPool

        from .config import settings

        url = make_url(dsn)
        db_name = url.database
        if not db_name:
            raise ValueError(f"KB '{name}': dsn has no database name")
        if not _DB_NAME_RE.match(db_name):
            raise ValueError(
                f"KB '{name}': invalid database name {db_name!r} "
                "(expected [A-Za-z_][A-Za-z0-9_]*)"
            )

        admin_candidates = []
        for candidate in ("postgres", settings.POSTGRES_DB):
            if candidate and candidate not in admin_candidates:
                admin_candidates.append(candidate)

        last_error: Exception | None = None
        for admin_db in admin_candidates:
            admin_engine = create_async_engine(
                url.set(database=admin_db),
                echo=False,
                isolation_level="AUTOCOMMIT",
                poolclass=NullPool,
            )
            try:
                async with admin_engine.connect() as conn:
                    exists = await conn.scalar(
                        text("SELECT 1 FROM pg_database WHERE datname = :db"),
                        {"db": db_name},
                    )
                    if not exists:
                        await conn.execute(text(f'CREATE DATABASE "{db_name}"'))
                        logger.info("KB '%s': created database '%s'", name, db_name)
                return
            except Exception as e:  # try the next maintenance DB
                last_error = e
                logger.warning(
                    "KB '%s': could not provision database '%s' via maintenance "
                    "db '%s': %s",
                    name,
                    db_name,
                    admin_db,
                    e,
                )
            finally:
                await admin_engine.dispose()

        raise RuntimeError(
            f"KB '{name}': failed to ensure database '{db_name}' exists "
            f"(tried maintenance databases {admin_candidates}): {last_error}"
        )

    async def _check_kb_dimension(self, name: str, session_maker) -> None:
        """Per-KB embedding-dimension guard (mirror of the v1 startup guard).

        Reads the KB's ``rag_meta`` row; hard-fails on dimension mismatch with
        an actionable error naming the KB. A fresh (never-ingested) KB has no
        meta row and passes. A model change at the same dimension only warns.
        """
        from .config import settings
        from .database import get_meta

        async with session_maker() as session:
            meta = await get_meta(session)
        if meta is None:
            return  # No ingest has run yet — nothing to conflict with.
        if meta.dimension != settings.EMBEDDING_DIMENSION:
            raise RuntimeError(
                f"KB '{name}': embedding dimension mismatch — its database was "
                f"indexed with dimension={meta.dimension} (model "
                f"'{meta.embedding_model}') but the current config requests "
                f"EMBEDDING_DIMENSION={settings.EMBEDDING_DIMENSION} (model "
                f"'{settings.EMBEDDING_MODEL}'). Cross-KB merging requires one "
                f"embedding space: re-index KB '{name}' with the configured "
                f"model, or restore the original EMBEDDING_DIMENSION/"
                f"EMBEDDING_MODEL. Refusing to start."
            )
        if meta.embedding_model != settings.EMBEDDING_MODEL:
            logger.warning(
                "KB '%s': embedding model changed ('%s' indexed vs '%s' "
                "configured) at the same dimension (%d): similarity scores "
                "will be unreliable until re-index.",
                name,
                meta.embedding_model,
                settings.EMBEDDING_MODEL,
                meta.dimension,
            )

    async def _create_keyword_only_kb(self, name: str, config: dict[str, Any]) -> KnowledgeBase:
        """Create a Keyword-Only KB."""
        from .keyword_only_kb import KeywordOnlyKB

        database_url = config.get("database_url", "sqlite:///:memory:")
        kb = KeywordOnlyKB(name=name, database_url=database_url)
        await kb.initialize()
        return kb

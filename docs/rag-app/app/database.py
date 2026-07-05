import datetime
from collections.abc import AsyncGenerator

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
    select,
    text,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from .config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_size=20, max_overflow=10)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    filepath: Mapped[str] = mapped_column(String(1024), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    chunks: Mapped[list["Chunk"]] = relationship(
        "Chunk", back_populates="document", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Document(id={self.id}, filename='{self.filename}')>"


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(Vector(settings.EMBEDDING_DIMENSION))
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    document: Mapped["Document"] = relationship("Document", back_populates="chunks")

    def __repr__(self) -> str:
        return f"<Chunk(id={self.id}, document_id={self.document_id}, index={self.chunk_index})>"


# Fixed primary key of the single RagMeta row (single-row table semantics).
META_ROW_ID = 1


class RagMeta(Base):
    """Single-row provenance/meta table (DB meta contract).

    Written at first ingest via :func:`upsert_meta`; read by the API layer
    (``/api/status``, ``/health/index``, dim-mismatch startup guard) via
    :func:`get_meta`.
    """

    __tablename__ = "rag_meta"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=META_ROW_ID)
    embedding_model: Mapped[str] = mapped_column(String(255), nullable=False)
    dimension: Mapped[int] = mapped_column(Integer, nullable=False)
    project_name: Mapped[str] = mapped_column(String(255), nullable=False)
    docs_root: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    indexed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    indexed_commit_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)

    def __repr__(self) -> str:
        return (
            f"<RagMeta(model='{self.embedding_model}', dim={self.dimension}, "
            f"project='{self.project_name}', indexed_at={self.indexed_at})>"
        )


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


async def init_db() -> None:
    """Create the pgvector extension and all tables."""
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)


# =============================================================================
# Meta helpers (DB meta contract — consumed by app.main / app.ingestion)
# =============================================================================


async def get_meta(session: AsyncSession) -> RagMeta | None:
    """Return the single meta row, or ``None`` if no ingest has run yet."""
    return await session.get(RagMeta, META_ROW_ID)


async def upsert_meta(
    session: AsyncSession,
    *,
    embedding_model: str | None = None,
    dimension: int | None = None,
    project_name: str | None = None,
    docs_root: str | None = None,
    indexed_at: datetime.datetime | None = None,
    indexed_commit_sha: str | None = None,
    commit: bool = True,
) -> RagMeta:
    """Create or refresh the single meta row (idempotent upsert).

    ``embedding_model``/``dimension``/``project_name`` default to the current
    settings and ``indexed_at`` to now; ``docs_root``/``indexed_commit_sha``
    are only overwritten when explicitly provided, so an ingest pass that does
    not know them preserves the previously stored values. Pass
    ``commit=False`` to join a caller-managed transaction.
    """
    values: dict[str, object] = {
        "id": META_ROW_ID,
        "embedding_model": embedding_model or settings.EMBEDDING_MODEL,
        "dimension": dimension or settings.EMBEDDING_DIMENSION,
        "project_name": project_name or settings.PROJECT_NAME,
        "docs_root": docs_root,
        "indexed_at": indexed_at or datetime.datetime.now(datetime.timezone.utc),
        "indexed_commit_sha": indexed_commit_sha,
    }
    update_values = {k: v for k, v in values.items() if k != "id"}
    if docs_root is None:
        del update_values["docs_root"]
    if indexed_commit_sha is None:
        del update_values["indexed_commit_sha"]

    stmt = (
        pg_insert(RagMeta)
        .values(**values)
        .on_conflict_do_update(index_elements=[RagMeta.id], set_=update_values)
    )
    await session.execute(stmt)
    if commit:
        await session.commit()

    meta = await session.get(RagMeta, META_ROW_ID)
    if meta is None:  # pragma: no cover — row guaranteed by the upsert above
        raise RuntimeError("rag_meta row missing immediately after upsert")
    return meta


# =============================================================================
# Dedup helpers (content_hash is unique — see Document.content_hash)
# =============================================================================


async def insert_document_dedup(
    session: AsyncSession,
    *,
    filename: str,
    filepath: str,
    file_type: str,
    content_hash: str,
    file_size: int = 0,
    content: str | None = None,
    chunk_count: int = 0,
) -> Document | None:
    """Insert a Document, silently skipping duplicates by ``content_hash``.

    Uses ``INSERT ... ON CONFLICT (content_hash) DO NOTHING`` so re-ingesting
    identical content never raises ``IntegrityError`` (and never poisons the
    session with a pending rollback). Returns the newly inserted ``Document``,
    or ``None`` when a document with the same hash already exists — use
    :func:`get_document_by_hash` to fetch the existing row in that case.

    Does NOT commit; the caller owns the transaction (chunks are typically
    added before committing).
    """
    stmt = (
        pg_insert(Document)
        .values(
            filename=filename,
            filepath=filepath,
            file_type=file_type,
            content_hash=content_hash,
            file_size=file_size,
            content=content,
            chunk_count=chunk_count,
        )
        .on_conflict_do_nothing(index_elements=[Document.content_hash])
        .returning(Document.id)
    )
    result = await session.execute(stmt)
    doc_id = result.scalar_one_or_none()
    if doc_id is None:
        return None
    return await session.get(Document, doc_id)


async def get_document_by_hash(session: AsyncSession, content_hash: str) -> Document | None:
    """Return the Document with the given ``content_hash``, or ``None``."""
    result = await session.execute(
        select(Document).where(Document.content_hash == content_hash)
    )
    return result.scalar_one_or_none()

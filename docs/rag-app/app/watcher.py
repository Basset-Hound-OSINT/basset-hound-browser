"""Auto-ingest Watcher - Monitors documents directory for new files.

This module implements inotify-based file watching for automatic document ingestion.
When new files are detected in /data/docs/, they are automatically processed through
the ingestion pipeline.

Features:
- Inotify-based file monitoring (efficient, no polling)
- Automatic retry on failure with exponential backoff
- Progress tracking via WebSocket events
- OPT-IN file archival after successful ingestion (WATCHER_ARCHIVE_MODE:
  "off" default — source files are never touched; "copy" — copy into archive/;
  "move" — legacy relocate into archive/). Archiving refuses read-only mounts.
- Supported formats: PDF, DOCX, TXT, MD (from extractors)
- Queue management: processes files sequentially or in batches
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

try:
    import inotify_simple

    HAS_INOTIFY = True
except ImportError:
    HAS_INOTIFY = False
    logging.warning("inotify_simple not available - file watcher will use polling fallback")

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from .embeddings import EmbeddingService

logger = logging.getLogger(__name__)


class IngestQueue:
    """Manages a queue of files to be ingested."""

    def __init__(self, max_workers: int = 1):
        """Initialize ingestion queue.

        Args:
            max_workers: Number of concurrent ingest tasks (default: 1 for sequential)
        """
        self.queue: asyncio.Queue = asyncio.Queue()
        self.processing: set[str] = set()
        self.max_workers = max_workers
        self.stats = {
            "total_queued": 0,
            "total_processed": 0,
            "total_failed": 0,
            "total_archived": 0,
        }

    async def add(self, filepath: str | Path) -> None:
        """Add file to ingestion queue.

        Args:
            filepath: Path to file to ingest
        """
        filepath = Path(filepath)
        if str(filepath) not in self.processing:
            await self.queue.put(str(filepath))
            self.stats["total_queued"] += 1
            logger.info("Queued for ingestion: %s", filepath.name)

    async def get(self) -> str | None:
        """Get next file from queue.

        Returns:
            File path or None if queue empty
        """
        try:
            return self.queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    def mark_processing(self, filepath: str) -> None:
        """Mark file as currently being processed."""
        self.processing.add(filepath)

    def mark_completed(self, filepath: str) -> None:
        """Mark file as completed processing."""
        self.processing.discard(filepath)
        self.stats["total_processed"] += 1

    def mark_failed(self, filepath: str) -> None:
        """Mark file as failed processing."""
        self.processing.discard(filepath)
        self.stats["total_failed"] += 1

    @property
    def is_empty(self) -> bool:
        """Check if queue is empty and nothing is processing."""
        return self.queue.empty() and len(self.processing) == 0

    @property
    def queue_size(self) -> int:
        """Get number of items in queue."""
        return self.queue.qsize()


class DocumentWatcher:
    """Monitors document directory and triggers ingestion on file changes."""

    SUPPORTED_FORMATS = {".pdf", ".docx", ".txt", ".md"}
    DEFAULT_WATCH_DIR = Path("/data/docs")
    ARCHIVE_DIR = Path("/data/docs/archive")
    ARCHIVE_MODES = ("off", "copy", "move")
    MAX_RETRIES = 3
    RETRY_DELAY = 2  # seconds, exponential backoff
    POLL_INTERVAL = 5  # seconds (polling fallback)

    def __init__(
        self,
        watch_dir: str | Path | None = None,
        on_progress: Callable[[dict], None] | None = None,
        archive_mode: str | None = None,
    ):
        """Initialize document watcher.

        Args:
            watch_dir: Directory to watch (default: $WATCHER_WATCH_DIR or /data/docs)
            on_progress: Callback for progress events
            archive_mode: "off" (default — never touch source files), "copy"
                (copy into archive/ after ingest), or "move" (legacy relocate).
                Defaults to $WATCHER_ARCHIVE_MODE, else "off" (opt-in).
        """
        self.watch_dir = Path(
            watch_dir or os.getenv("WATCHER_WATCH_DIR") or self.DEFAULT_WATCH_DIR
        )
        self.archive_dir = Path(self.ARCHIVE_DIR)
        self.on_progress = on_progress
        self.queue = IngestQueue(max_workers=1)
        self.running = False
        self.inotify = None
        self.watched_fd = None

        # Archiving is OPT-IN: default "off" so the watcher never moves (or
        # copies) source files unless explicitly enabled.
        mode = (archive_mode or os.getenv("WATCHER_ARCHIVE_MODE") or "off").strip().lower()
        if mode not in self.ARCHIVE_MODES:
            logger.warning(
                "Invalid archive mode %r (expected one of %s); archiving disabled",
                mode,
                self.ARCHIVE_MODES,
            )
            mode = "off"
        self.archive_mode = mode

        # Retry/polling knobs (compose passes these through the environment).
        self.max_retries = int(os.getenv("WATCHER_MAX_RETRIES", str(self.MAX_RETRIES)))
        self.retry_delay = int(os.getenv("WATCHER_RETRY_DELAY", str(self.RETRY_DELAY)))
        self.poll_interval = int(os.getenv("WATCHER_POLL_INTERVAL", str(self.POLL_INTERVAL)))

        logger.info(
            "DocumentWatcher initialized for: %s (archive_mode=%s)",
            self.watch_dir,
            self.archive_mode,
        )

    @property
    def archive_enabled(self) -> bool:
        """True when post-ingest archiving is explicitly enabled."""
        return self.archive_mode != "off"

    async def start(
        self,
        ingest_func: Callable,
        session: AsyncSession | None = None,
        embed: EmbeddingService | None = None,
    ) -> None:
        """Start watching for file changes.

        Args:
            ingest_func: Async function to call for ingestion
            session: Database session
            embed: Embedding service
        """
        self.running = True
        self.ingest_func = ingest_func
        self.session = session
        self.embed = embed

        # Ensure directories exist. The archive dir is only needed (and only
        # creatable) when archiving is enabled — on a read-only mount mkdir
        # would fail, so skip it entirely in the default "off" mode.
        try:
            self.watch_dir.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            logger.warning("Cannot create watch dir %s (read-only mount?): %s", self.watch_dir, e)
        if self.archive_enabled:
            try:
                self.archive_dir.mkdir(parents=True, exist_ok=True)
            except OSError as e:
                logger.warning(
                    "Cannot create archive dir %s (read-only mount?); archiving disabled: %s",
                    self.archive_dir,
                    e,
                )
                self.archive_mode = "off"

        self._emit_event(
            {
                "type": "watcher_started",
                "watch_dir": str(self.watch_dir),
                "timestamp": datetime.now().isoformat(),
            }
        )

        # Start watcher loop. CRASH-PROOF CONTRACT: this method never raises —
        # any failure (inotify instance exhaustion, permissions, bad watch dir,
        # anything) logs a loud actionable WARNING and returns, leaving the API
        # serving normally with the watcher dead. Real incident (2026-07-04):
        # fs.inotify.max_user_instances exhaustion on a multi-stack host must
        # not take the API down with it.
        try:
            if HAS_INOTIFY:
                try:
                    await self._start_inotify_watcher()
                except OSError as e:
                    logger.warning(
                        "WATCHER: cannot create inotify watcher (%s). This usually means "
                        "the per-user inotify instance limit is exhausted — check "
                        "`cat /proc/sys/fs/inotify/max_user_instances` and how many "
                        "stacks/watchers this host runs (each enabled watcher consumes "
                        "one instance). Falling back to polling. Consider "
                        "WATCHER_ENABLED=false (explicit ingest is the primary flow) "
                        "or raising fs.inotify.max_user_instances.",
                        e,
                    )
                    await self._start_polling_watcher()
                except Exception as e:
                    logger.warning("inotify watcher failed, falling back to polling: %s", e)
                    await self._start_polling_watcher()
            else:
                await self._start_polling_watcher()
        except Exception:
            self.running = False
            logger.exception(
                "WATCHER FAILED and is now DISABLED — the API continues serving; "
                "auto-ingest is OFF. Use explicit ingest (deploy.sh ingest / "
                "POST /api/ingest) or fix the cause above and restart."
            )

    async def stop(self) -> None:
        """Stop watching for file changes."""
        self.running = False
        if self.inotify:
            try:
                self.inotify.close()
            except Exception:
                pass

        self._emit_event(
            {
                "type": "watcher_stopped",
                "timestamp": datetime.now().isoformat(),
            }
        )

        logger.info("DocumentWatcher stopped")

    async def _start_inotify_watcher(self) -> None:
        """Start inotify-based file watcher (Linux-specific).

        INotify() creation raises OSError (EMFILE) when the per-user
        fs.inotify.max_user_instances cap is exhausted — the caller (start())
        turns that into a loud warning + polling fallback.
        """
        self.inotify = inotify_simple.INotify()
        self.watched_fd = self.inotify.add_watch(
            str(self.watch_dir),
            inotify_simple.flags.CLOSE_WRITE | inotify_simple.flags.MOVED_TO,
        )

        logger.info("Started inotify watcher for: %s", self.watch_dir)

        while self.running:
            try:
                # STARTUP-WEDGE FIX (2026-07-04): inotify.read(timeout=1000) is a
                # BLOCKING syscall with no await between loop iterations. Run
                # directly on the event loop it starves it permanently — uvicorn
                # never finishes startup ("logs just stop after 'Started inotify
                # watcher'", nginx 502s). Push the blocking read to a worker
                # thread so the loop stays free.
                events = await asyncio.to_thread(self.inotify.read, 1000)
                for event in events:
                    if event.name:
                        await self._handle_file_event(event.name)
            except Exception as e:
                if not self.running:
                    break  # closed during shutdown — expected
                logger.exception("inotify error: %s", e)
                break

    async def _start_polling_watcher(self) -> None:
        """Start polling-based file watcher (fallback)."""
        seen_files: set[str] = set()
        poll_interval = self.poll_interval  # seconds

        logger.info(
            "Started polling watcher for: %s (interval: %ds)", self.watch_dir, poll_interval
        )

        while self.running:
            try:
                # Get current files
                current_files = {
                    f.name
                    for f in self.watch_dir.glob("*")
                    if f.is_file() and f.suffix.lower() in self.SUPPORTED_FORMATS
                }

                # Detect new files
                new_files = current_files - seen_files
                for filename in new_files:
                    await self._handle_file_event(filename)

                seen_files = current_files
                await asyncio.sleep(poll_interval)

            except Exception as e:
                logger.exception("Polling watcher error: %s", e)
                await asyncio.sleep(poll_interval)

    async def _handle_file_event(self, filename: str) -> None:
        """Handle file creation/modification event.

        Args:
            filename: Name of file that changed
        """
        filepath = self.watch_dir / filename
        if not filepath.exists():
            return

        # Only process supported formats
        if filepath.suffix.lower() not in self.SUPPORTED_FORMATS:
            logger.debug("Skipping unsupported file: %s", filename)
            return

        # Skip archive directory
        if "archive" in filename.lower():
            return

        logger.info("Detected new document: %s", filename)
        await self.queue.add(filepath)

        # Process queue
        await self._process_queue()

    async def _process_queue(self) -> None:
        """Process queued files for ingestion."""
        while not self.queue.is_empty and self.running:
            filepath_str = await self.queue.get()
            if not filepath_str:
                break

            filepath = Path(filepath_str)
            self.queue.mark_processing(filepath_str)

            self._emit_event(
                {
                    "type": "ingest_started",
                    "filename": filepath.name,
                    "filepath": str(filepath),
                    "timestamp": datetime.now().isoformat(),
                }
            )

            success = await self._ingest_with_retry(filepath)

            if success:
                self.queue.mark_completed(filepath_str)
                if self.archive_enabled:
                    await self._archive_file(filepath)
            else:
                self.queue.mark_failed(filepath_str)

    async def _ingest_with_retry(self, filepath: Path, attempt: int = 1) -> bool:
        """Ingest a file with exponential backoff retry.

        Args:
            filepath: Path to file to ingest
            attempt: Current attempt number

        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(
                "Ingesting file (attempt %d/%d): %s", attempt, self.max_retries, filepath.name
            )

            # Call the ingestion function
            if self.ingest_func:
                result = await self.ingest_func(filepath, self.session, self.embed)
                logger.info("Successfully ingested: %s", filepath.name)

                self._emit_event(
                    {
                        "type": "ingest_completed",
                        "filename": filepath.name,
                        "filepath": str(filepath),
                        "status": "success",
                        "timestamp": datetime.now().isoformat(),
                    }
                )

                return True

        except Exception as e:
            logger.error(
                "Ingestion error (attempt %d/%d): %s - %s",
                attempt,
                self.max_retries,
                filepath.name,
                e,
            )

            self._emit_event(
                {
                    "type": "ingest_error",
                    "filename": filepath.name,
                    "filepath": str(filepath),
                    "error": str(e),
                    "attempt": attempt,
                    "timestamp": datetime.now().isoformat(),
                }
            )

            # Retry with exponential backoff
            if attempt < self.max_retries:
                delay = self.retry_delay * (2 ** (attempt - 1))
                logger.info("Retrying in %d seconds...", delay)
                await asyncio.sleep(delay)
                return await self._ingest_with_retry(filepath, attempt + 1)

        return False

    async def _archive_file(self, filepath: Path) -> None:
        """Archive a processed file (OPT-IN; see ``archive_mode``).

        "copy" copies into the archive dir (source untouched); "move" is the
        legacy relocate. Refuses politely — warn, no raise — when the source
        or archive location sits on a read-only mount.

        Args:
            filepath: Path to file to archive
        """
        if not self.archive_enabled:
            return

        # Refuse on read-only mounts instead of failing mid-shutil:
        # "move" must delete the source (needs a writable source dir);
        # both modes need a writable archive dir.
        if self.archive_mode == "move" and not os.access(filepath.parent, os.W_OK):
            logger.warning(
                "Refusing to archive %s: source dir %s is not writable (read-only mount?)",
                filepath.name,
                filepath.parent,
            )
            return
        try:
            self.archive_dir.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            logger.warning(
                "Refusing to archive %s: cannot create archive dir %s: %s",
                filepath.name,
                self.archive_dir,
                e,
            )
            return
        if not os.access(self.archive_dir, os.W_OK):
            logger.warning(
                "Refusing to archive %s: archive dir %s is not writable (read-only mount?)",
                filepath.name,
                self.archive_dir,
            )
            return

        try:
            archive_path = self.archive_dir / f"{datetime.now().isoformat()}_{filepath.name}"
            if self.archive_mode == "copy":
                shutil.copy2(str(filepath), str(archive_path))
            else:  # "move" (legacy)
                shutil.move(str(filepath), str(archive_path))
            self.queue.stats["total_archived"] += 1

            logger.info(
                "Archived file (%s): %s -> %s", self.archive_mode, filepath.name, archive_path.name
            )

            self._emit_event(
                {
                    "type": "file_archived",
                    "filename": filepath.name,
                    "archived_as": archive_path.name,
                    "archive_mode": self.archive_mode,
                    "timestamp": datetime.now().isoformat(),
                }
            )

        except Exception as e:
            logger.error("Failed to archive file: %s - %s", filepath.name, e)

    def _emit_event(self, event: dict) -> None:
        """Emit progress event via callback or logging.

        Args:
            event: Event dictionary
        """
        if self.on_progress:
            try:
                self.on_progress(event)
            except Exception as e:
                logger.exception("Error in progress callback: %s", e)
        else:
            # Log if no callback
            logger.debug("Watcher event: %s", json.dumps(event, indent=2))

    def get_stats(self) -> dict:
        """Get watcher statistics.

        Returns:
            Dictionary with queue and processing stats
        """
        return {
            "running": self.running,
            "watch_dir": str(self.watch_dir),
            "archive_mode": self.archive_mode,
            "queue_size": self.queue.queue_size,
            "processing_count": len(self.queue.processing),
            **self.queue.stats,
        }


async def run_watcher(
    watch_dir: str | Path | None = None,
    ingest_func: Callable | None = None,
    session: AsyncSession | None = None,
    embed: EmbeddingService | None = None,
    on_progress: Callable[[dict], None] | None = None,
    archive_mode: str | None = None,
) -> DocumentWatcher:
    """Convenience function to create and start a watcher.

    Args:
        watch_dir: Directory to watch
        ingest_func: Ingestion function
        session: Database session
        embed: Embedding service
        on_progress: Progress callback
        archive_mode: "off" (default), "copy", or "move" — see DocumentWatcher

    Returns:
        DocumentWatcher instance (already started)
    """
    watcher = DocumentWatcher(
        watch_dir=watch_dir, on_progress=on_progress, archive_mode=archive_mode
    )
    await watcher.start(ingest_func=ingest_func, session=session, embed=embed)
    return watcher

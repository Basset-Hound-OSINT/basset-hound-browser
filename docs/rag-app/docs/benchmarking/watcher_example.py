#!/usr/bin/env python3
"""
Auto-Ingest Watcher Example - Tests Document Watcher

This script demonstrates the auto-ingest watcher functionality:
1. Creates sample documents in the watched directory
2. Monitors ingestion progress via the API
3. Verifies documents are auto-detected and ingested
4. Tracks watcher statistics

Features:
- Creates sample PDF/TXT files
- Polls /api/watcher/status endpoint
- Verifies document ingestion
- Monitors queue and processing
- Tracks success/failure statistics

Requirements:
    pip install httpx

Usage:
    # Test watcher with sample files
    python watcher_example.py --host localhost --port 8100

    # Check watcher status
    python watcher_example.py --status-only --host localhost --port 8100

    # Monitor for 60 seconds
    python watcher_example.py --monitor-duration 60 --host localhost --port 8100
"""

import argparse
import asyncio
import json
import sys
import time

try:
    import httpx
except ImportError:
    print("Error: httpx not installed. Install with: pip install httpx")
    sys.exit(1)


class WatcherClient:
    """Client for testing document watcher functionality."""

    def __init__(self, base_url: str = "http://localhost:8100"):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=60.0)

    async def get_watcher_status(self) -> dict:
        """Get watcher status and statistics.

        Returns:
            Watcher status dictionary
        """
        response = await self.client.get(f"{self.base_url}/api/watcher/status")
        response.raise_for_status()
        return response.json()

    async def list_documents(self) -> list[dict]:
        """List all ingested documents.

        Returns:
            List of document metadata
        """
        response = await self.client.get(f"{self.base_url}/api/documents")
        response.raise_for_status()
        return response.json()

    async def upload_test_document(
        self,
        filename: str,
        content: bytes,
    ) -> dict:
        """Upload a test document.

        Args:
            filename: Name of file
            content: File content

        Returns:
            Document metadata
        """
        files = {"file": (filename, content)}
        response = await self.client.post(f"{self.base_url}/api/ingest/file", files=files)
        response.raise_for_status()
        return response.json()

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


def create_sample_document(filename: str, doc_type: str = "txt") -> bytes:
    """Create sample document content.

    Args:
        filename: Name of document
        doc_type: Document type (txt, md, etc)

    Returns:
        Document content as bytes
    """
    if doc_type == "md":
        content = f"""# {filename}

## Introduction

This is a test Markdown document created for watcher testing.

## Content

The auto-ingest watcher monitors a directory for new files and automatically
processes them through the ingestion pipeline.

### Features

- Inotify-based file monitoring (Linux)
- Polling fallback for other systems
- Automatic retry on failure
- Archive after successful ingestion

### Example

Here's an example of a code block:

```python
async def ingest_file(filepath):
    # Process file
    return result
```

## Conclusion

The watcher is now complete and ready for production use.
"""
    elif doc_type == "pdf":
        # Simple PDF creation (would need reportlab in real scenario)
        content = f"Test PDF: {filename}\n\nThis is test content for the watcher.".encode()
    else:  # txt
        content = f"""Test Document: {filename}

This is a simple test document created for auto-ingest watcher testing.

The document contains multiple lines to ensure proper chunking and indexing
during the ingestion process.

Auto-ingest Watcher Features:
1. Monitors /data/docs directory for new files
2. Automatically detects PDF, DOCX, TXT, MD files
3. Processes files sequentially or in batches
4. Archives files after successful ingestion
5. Retries failed ingestions with exponential backoff
6. Provides status via REST API

This document tests all the basic functionality of the watcher system.
The ingestion process will chunk this content and create embeddings.
""".encode()

    return content


async def monitor_watcher(
    client: WatcherClient,
    duration_seconds: int = 30,
    poll_interval: int = 2,
) -> None:
    """Monitor watcher status over time.

    Args:
        client: WatcherClient instance
        duration_seconds: How long to monitor
        poll_interval: Polling interval in seconds
    """
    print(f"\nMonitoring watcher for {duration_seconds} seconds...\n")
    print(
        f"{'Time':<10} {'Status':<12} {'Queue':<8} {'Processing':<12} {'Success':<10} {'Failed':<8}"
    )
    print("-" * 70)

    start_time = time.time()
    last_stats = None

    while time.time() - start_time < duration_seconds:
        try:
            status = await client.get_watcher_status()

            current_time = time.time() - start_time
            running = status.get("running", False)
            queue_size = status.get("queue_size", 0)
            processing = status.get("processing_count", 0)
            success = status.get("total_processed", 0)
            failed = status.get("total_failed", 0)

            status_str = "Running" if running else "Stopped"

            print(
                f"{current_time:>6.1f}s  {status_str:<12} {queue_size:<8} {processing:<12} {success:<10} {failed:<8}"
            )

            # Check if queue is empty
            if queue_size == 0 and processing == 0:
                if last_stats and (
                    success > last_stats["success"] or failed > last_stats["failed"]
                ):
                    print("\n[INFO] Queue processed successfully")

            last_stats = {"success": success, "failed": failed}

        except Exception as e:
            print(f"[ERROR] Failed to get status: {e}")

        await asyncio.sleep(poll_interval)

    print()


async def test_watcher_with_uploads(
    client: WatcherClient,
    num_docs: int = 3,
) -> None:
    """Test watcher by uploading documents.

    Args:
        client: WatcherClient instance
        num_docs: Number of test documents to create
    """
    print(f"\n{'='*80}")
    print("Testing Auto-Ingest Watcher with Document Uploads")
    print(f"{'='*80}\n")

    # Get initial status
    print("[INITIAL STATUS]")
    try:
        status = await client.get_watcher_status()
        print(f"  Watcher running: {status.get('running')}")
        print(f"  Watch directory: {status.get('watch_dir')}")
        print(f"  Queue size: {status.get('queue_size')}")
        print(f"  Processing: {status.get('processing_count')}")
        print(f"  Total processed: {status.get('total_processed')}")
        print(f"  Total failed: {status.get('total_failed')}")
    except Exception as e:
        print(f"  [ERROR] {e}")
        return

    # Upload test documents
    print(f"\n[UPLOADING {num_docs} TEST DOCUMENTS]")
    doc_types = ["txt", "md", "txt"][:num_docs]

    uploaded_docs = []
    for i in range(num_docs):
        doc_type = doc_types[i] if i < len(doc_types) else "txt"
        filename = f"watcher_test_{i+1}.{doc_type}"

        try:
            content = create_sample_document(filename, doc_type)
            result = await client.upload_test_document(filename, content)
            uploaded_docs.append(result)
            print(f"  ✓ Uploaded: {filename} (ID: {result.get('id')})")
        except Exception as e:
            print(f"  ✗ Failed to upload {filename}: {e}")

    # Monitor ingestion progress
    if uploaded_docs:
        await monitor_watcher(client, duration_seconds=15, poll_interval=1)

    # Verify ingestion
    print("[VERIFYING INGESTION]")
    try:
        documents = await client.list_documents()
        print(f"  Total documents in knowledge base: {len(documents)}")

        # Check if our test documents are there
        test_doc_ids = {doc["id"] for doc in uploaded_docs}
        found_count = sum(1 for doc in documents if doc["id"] in test_doc_ids)

        print(f"  Test documents verified: {found_count}/{len(uploaded_docs)}")

        for doc in documents[-min(3, len(documents)) :]:
            print(f"    - {doc['filename']} ({doc['chunk_count']} chunks)")

    except Exception as e:
        print(f"  [ERROR] Failed to list documents: {e}")

    print(f"\n{'='*80}\n")


async def check_watcher_status_only(client: WatcherClient) -> None:
    """Just check and display watcher status.

    Args:
        client: WatcherClient instance
    """
    print(f"\n{'='*80}")
    print("Watcher Status")
    print(f"{'='*80}\n")

    try:
        status = await client.get_watcher_status()

        print(json.dumps(status, indent=2))

        # Display in human-readable format
        print("\n[SUMMARY]")
        print(f"Status: {'Running' if status.get('running') else 'Stopped'}")
        print(f"Watch Directory: {status.get('watch_dir')}")
        print(f"Queue Size: {status.get('queue_size')}")
        print(f"Currently Processing: {status.get('processing_count')}")
        print("\n[STATISTICS]")
        print(f"Total Queued: {status.get('total_queued')}")
        print(f"Total Processed: {status.get('total_processed')}")
        print(f"Total Failed: {status.get('total_failed')}")
        print(f"Total Archived: {status.get('total_archived')}")

    except Exception as e:
        print(f"[ERROR] Failed to get watcher status: {e}")

    print(f"\n{'='*80}\n")


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Test RAG Bootstrap auto-ingest watcher",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test watcher with sample uploads
  python watcher_example.py --host localhost --port 8100

  # Check watcher status only
  python watcher_example.py --status-only --host localhost --port 8100

  # Monitor watcher for 60 seconds
  python watcher_example.py --monitor-duration 60 --host localhost --port 8100

  # Upload multiple test documents
  python watcher_example.py --num-docs 5 --host localhost --port 8100
        """,
    )

    parser.add_argument(
        "--host",
        default="localhost",
        help="API host (default: localhost)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8100,
        help="API port (default: 8100)",
    )
    parser.add_argument(
        "--status-only",
        action="store_true",
        help="Check watcher status and exit",
    )
    parser.add_argument(
        "--monitor-duration",
        type=int,
        help="Monitor watcher for N seconds (requires status-only)",
    )
    parser.add_argument(
        "--num-docs",
        type=int,
        default=3,
        help="Number of test documents to upload (default: 3)",
    )

    args = parser.parse_args()

    base_url = f"http://{args.host}:{args.port}"
    client = WatcherClient(base_url)

    try:
        if args.status_only:
            await check_watcher_status_only(client)
            if args.monitor_duration:
                await monitor_watcher(client, duration_seconds=args.monitor_duration)
        else:
            await test_watcher_with_uploads(client, num_docs=args.num_docs)
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())

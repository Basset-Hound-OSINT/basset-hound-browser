#!/usr/bin/env python3
"""
Streaming Client Example - Tests RAG Bootstrap Streaming Endpoints

This script demonstrates both SSE (Server-Sent Events) streaming endpoints:
1. /api/ask/stream - Direct RAG question answering with streaming
2. /api/v3/chat/{session_id}/stream - Chat session-based streaming with RAG

Features:
- Tracks time-to-first-token latency
- Measures total response latency
- Counts tokens streamed
- Displays sources and metadata
- Handles errors gracefully

Requirements:
    pip install httpx

Usage:
    # Test /api/ask/stream endpoint
    python streaming_client_example.py --endpoint /api/ask/stream

    # Test /api/v3/chat endpoint (create session first)
    python streaming_client_example.py --endpoint /api/v3/chat --create-session

    # Custom host/port
    python streaming_client_example.py --host localhost --port 8100 --endpoint /api/ask/stream
"""

import argparse
import asyncio
import json
import sys
from collections.abc import AsyncGenerator

try:
    import httpx
except ImportError:
    print("Error: httpx not installed. Install with: pip install httpx")
    sys.exit(1)


class StreamingClient:
    """Client for testing RAG Bootstrap streaming endpoints."""

    def __init__(self, base_url: str = "http://localhost:8100"):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=300.0)

    async def create_chat_session(self) -> str:
        """Create a new chat session.

        Returns:
            Session ID
        """
        response = await self.client.post(f"{self.base_url}/api/v3/chat/session")
        response.raise_for_status()
        data = response.json()
        return data["session_id"]

    async def stream_ask_question(
        self,
        question: str,
        mode: str = "hybrid",
        limit: int = 5,
    ) -> AsyncGenerator[dict, None]:
        """Stream response from /api/ask/stream endpoint.

        Args:
            question: Question to ask
            mode: Search mode (semantic, keyword, hybrid)
            limit: Number of sources to retrieve

        Yields:
            Parsed event dictionaries
        """
        payload = {
            "question": question,
            "mode": mode,
            "limit": limit,
        }

        async with self.client.stream(
            "POST",
            f"{self.base_url}/api/ask/stream",
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    try:
                        event_data = json.loads(line[6:])
                        yield event_data
                    except json.JSONDecodeError:
                        continue

    async def stream_chat_message(
        self,
        session_id: str,
        message: str,
        use_rag: bool = True,
        mode: str = "hybrid",
    ) -> AsyncGenerator[dict, None]:
        """Stream response from /api/v3/chat/{session_id}/stream endpoint.

        Args:
            session_id: Chat session ID
            message: Message to send
            use_rag: Whether to use RAG context
            mode: Search mode (semantic, keyword, hybrid)

        Yields:
            Parsed event dictionaries
        """
        payload = {
            "message": message,
            "use_rag": use_rag,
            "mode": mode,
        }

        async with self.client.stream(
            "POST",
            f"{self.base_url}/api/v3/chat/{session_id}/stream",
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    try:
                        event_data = json.loads(line[6:])
                        yield event_data
                    except json.JSONDecodeError:
                        continue

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


async def test_ask_stream(
    client: StreamingClient,
    question: str = "What is the purpose of air traffic control?",
) -> None:
    """Test /api/ask/stream endpoint.

    Args:
        client: StreamingClient instance
        question: Question to ask
    """
    print(f"\n{'='*80}")
    print("Testing: /api/ask/stream")
    print(f"{'='*80}")
    print(f"Question: {question}\n")

    metrics = {
        "start_time": None,
        "first_token_time": None,
        "token_count": 0,
        "total_latency": None,
        "sources_count": 0,
        "response": "",
    }

    try:
        async for event in client.stream_ask_question(question):
            event_type = event.get("type")

            if event_type == "start":
                metrics["start_time"] = event.get("timestamp")
                print("[START] Request initialized")

            elif event_type == "sources":
                sources = event.get("sources", [])
                metrics["sources_count"] = len(sources)
                search_latency = event.get("search_latency_ms", 0)
                print(
                    f"\n[SOURCES] Found {len(sources)} sources (search latency: {search_latency}ms)"
                )
                for i, source in enumerate(sources, 1):
                    print(
                        f"  {i}. {source.get('document_filename')} (score: {source.get('score'):.2f})"
                    )
                    print(f"     {source.get('content', '')[:100]}...")

            elif event_type == "token":
                token = event.get("token", "")
                token_count = event.get("token_count", 0)
                latency = event.get("cumulative_latency_ms", 0)

                if token:
                    metrics["token_count"] = token_count
                    if metrics["first_token_time"] is None:
                        metrics["first_token_time"] = latency
                        print(f"\n[STREAMING] Time to first token: {latency:.2f}ms")
                        print("[OUTPUT] ", end="", flush=True)

                    sys.stdout.write(token)
                    sys.stdout.flush()
                    metrics["response"] += token

            elif event_type == "done":
                total_latency = event.get("total_latency_ms", 0)
                first_token_latency = event.get("first_token_latency_ms", 0)
                total_tokens = event.get("total_tokens", 0)

                metrics["total_latency"] = total_latency

                print("\n\n[COMPLETE]")
                print(f"  Total tokens: {total_tokens}")
                print(f"  First token latency: {first_token_latency:.2f}ms")
                print(f"  Total latency: {total_latency:.2f}ms")
                print(f"  Sources used: {metrics['sources_count']}")
                print(f"  Tokens/second: {total_tokens / (total_latency / 1000):.1f}")

            elif event_type == "error":
                error_msg = event.get("message")
                print(f"\n[ERROR] {error_msg}")

    except Exception as e:
        print(f"\n[EXCEPTION] {type(e).__name__}: {e}")

    print(f"{'='*80}\n")


async def test_chat_stream(
    client: StreamingClient,
    message: str = "What is air traffic control?",
) -> None:
    """Test /api/v3/chat/{session_id}/stream endpoint.

    Args:
        client: StreamingClient instance
        message: Message to send
    """
    print(f"\n{'='*80}")
    print("Testing: /api/v3/chat/{session_id}/stream")
    print(f"{'='*80}")

    # Create session
    try:
        session_id = await client.create_chat_session()
        print(f"Created session: {session_id}\n")
    except Exception as e:
        print(f"Failed to create session: {e}")
        return

    print(f"Message: {message}\n")

    metrics = {
        "start_time": None,
        "first_token_time": None,
        "token_count": 0,
        "total_latency": None,
        "sources_count": 0,
        "response": "",
    }

    try:
        async for event in client.stream_chat_message(session_id, message):
            event_type = event.get("type")

            if event_type == "start":
                metrics["start_time"] = event.get("timestamp")
                print("[START] Request initialized")

            elif event_type == "sources":
                sources = event.get("sources", [])
                metrics["sources_count"] = len(sources)
                search_latency = event.get("search_latency_ms", 0)
                print(
                    f"\n[SOURCES] Found {len(sources)} sources (search latency: {search_latency}ms)"
                )
                for i, source in enumerate(sources, 1):
                    print(
                        f"  {i}. {source.get('document_filename')} (score: {source.get('score'):.2f})"
                    )

            elif event_type == "token":
                token = event.get("token", "")
                token_count = event.get("token_count", 0)
                latency = event.get("cumulative_latency_ms", 0)

                if token:
                    metrics["token_count"] = token_count
                    if metrics["first_token_time"] is None:
                        metrics["first_token_time"] = latency
                        print(f"\n[STREAMING] Time to first token: {latency:.2f}ms")
                        print("[OUTPUT] ", end="", flush=True)

                    sys.stdout.write(token)
                    sys.stdout.flush()
                    metrics["response"] += token

            elif event_type == "done":
                total_latency = event.get("total_latency_ms", 0)
                first_token_latency = event.get("first_token_latency_ms", 0)
                total_tokens = event.get("total_tokens", 0)

                metrics["total_latency"] = total_latency

                print("\n\n[COMPLETE]")
                print(f"  Total tokens: {total_tokens}")
                print(f"  First token latency: {first_token_latency:.2f}ms")
                print(f"  Total latency: {total_latency:.2f}ms")
                print(f"  Sources used: {metrics['sources_count']}")
                print(f"  Tokens/second: {total_tokens / (total_latency / 1000):.1f}")

            elif event_type == "error":
                error_msg = event.get("message")
                print(f"\n[ERROR] {error_msg}")

    except Exception as e:
        print(f"\n[EXCEPTION] {type(e).__name__}: {e}")

    print(f"{'='*80}\n")


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Test RAG Bootstrap streaming endpoints",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test /api/ask/stream
  python streaming_client_example.py --endpoint /api/ask/stream

  # Test /api/v3/chat with session
  python streaming_client_example.py --endpoint /api/v3/chat --create-session

  # Custom host
  python streaming_client_example.py --host localhost --port 8100 --endpoint /api/ask/stream

  # Custom question
  python streaming_client_example.py --endpoint /api/ask/stream --question "What is cloud computing?"
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
        "--endpoint",
        default="/api/ask/stream",
        choices=["/api/ask/stream", "/api/v3/chat"],
        help="Endpoint to test (default: /api/ask/stream)",
    )
    parser.add_argument(
        "--question",
        default="What is the purpose of air traffic control?",
        help="Question to ask (default: 'What is the purpose of air traffic control?')",
    )
    parser.add_argument(
        "--mode",
        default="hybrid",
        choices=["semantic", "keyword", "hybrid"],
        help="Search mode (default: hybrid)",
    )
    parser.add_argument(
        "--no-rag",
        action="store_true",
        help="Disable RAG (for /api/v3/chat endpoint)",
    )

    args = parser.parse_args()

    base_url = f"http://{args.host}:{args.port}"
    client = StreamingClient(base_url)

    try:
        if args.endpoint == "/api/ask/stream":
            await test_ask_stream(
                client,
                question=args.question,
            )
        elif args.endpoint == "/api/v3/chat":
            await test_chat_stream(
                client,
                message=args.question,
            )
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())

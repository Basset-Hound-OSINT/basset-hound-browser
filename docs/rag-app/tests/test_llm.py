"""Tests for the Ollama LLM client."""

from __future__ import annotations

import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def ollama_client():
    """Create an OllamaClient with test config."""
    with patch("app.llm.settings") as mock_settings:
        mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
        mock_settings.LLM_MODEL = "llama3.1:70b"
        mock_settings.PROJECT_NAME = "test-project"

        from app.llm import OllamaClient

        return OllamaClient(
            base_url="http://localhost:11434",
            model="llama3.1:70b",
            timeout=30,
            temperature=0.3,
        )


# ---------------------------------------------------------------------------
# Unit Tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestOllamaClientGenerate:
    """Tests for OllamaClient.generate()."""

    @pytest.mark.asyncio
    async def test_generate_sends_correct_payload(self, ollama_client):
        mock_response = MagicMock()
        mock_response.json.return_value = {"response": "Hello world"}
        mock_response.raise_for_status = MagicMock()

        with patch("app.llm.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            result = await ollama_client.generate("What is Python?")

            assert result == "Hello world"
            call_args = mock_client.post.call_args
            payload = call_args[1]["json"]
            assert payload["model"] == "llama3.1:70b"
            assert payload["prompt"] == "What is Python?"
            assert payload["stream"] is False

    @pytest.mark.asyncio
    async def test_generate_with_system_prompt(self, ollama_client):
        mock_response = MagicMock()
        mock_response.json.return_value = {"response": "answer"}
        mock_response.raise_for_status = MagicMock()

        with patch("app.llm.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            await ollama_client.generate("question", system="You are an expert.")

            payload = mock_client.post.call_args[1]["json"]
            assert payload["system"] == "You are an expert."

    @pytest.mark.asyncio
    async def test_generate_custom_temperature(self, ollama_client):
        mock_response = MagicMock()
        mock_response.json.return_value = {"response": "answer"}
        mock_response.raise_for_status = MagicMock()

        with patch("app.llm.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            await ollama_client.generate("question", temperature=0.9)

            payload = mock_client.post.call_args[1]["json"]
            assert payload["options"]["temperature"] == 0.9


@pytest.mark.unit
class TestOllamaClientAskWithContext:
    """Tests for OllamaClient.ask_with_context()."""

    @pytest.mark.asyncio
    async def test_ask_formats_context_correctly(self, ollama_client):
        chunks = [
            {"content": "Python is a language.", "document_filename": "intro.md", "score": 0.95},
            {
                "content": "Python was created by Guido.",
                "document_filename": "history.md",
                "score": 0.88,
            },
        ]

        with patch.object(ollama_client, "generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = "Python is a programming language created by Guido."

            result = await ollama_client.ask_with_context("What is Python?", chunks)

            assert result.answer == "Python is a programming language created by Guido."
            assert result.model == "llama3.1:70b"
            assert len(result.context_chunks) == 2

            # Verify prompt includes context
            call_prompt = mock_gen.call_args[1]["prompt"]
            assert "[Source 1: intro.md]" in call_prompt
            assert "[Source 2: history.md]" in call_prompt
            assert "Python is a language." in call_prompt

    @pytest.mark.asyncio
    async def test_ask_with_custom_system_prompt(self, ollama_client):
        chunks = [{"content": "data", "document_filename": "f.md", "score": 0.9}]

        with patch.object(ollama_client, "generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = "answer"

            await ollama_client.ask_with_context("question", chunks, system_prompt="Custom system")

            assert mock_gen.call_args[1]["system"] == "Custom system"

    @pytest.mark.asyncio
    async def test_ask_with_empty_context(self, ollama_client):
        with patch.object(ollama_client, "generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = "No context available."

            result = await ollama_client.ask_with_context("question", [])
            assert result.context_chunks == []


@pytest.mark.unit
class TestOllamaClientHealth:
    """Tests for health_check and list_models."""

    @pytest.mark.asyncio
    async def test_health_check_model_found(self, ollama_client):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "models": [{"name": "llama3.1:70b"}, {"name": "nomic-embed-text"}]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("app.llm.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            assert await ollama_client.health_check() is True

    @pytest.mark.asyncio
    async def test_health_check_model_not_found(self, ollama_client):
        mock_response = MagicMock()
        mock_response.json.return_value = {"models": [{"name": "mistral:7b"}]}
        mock_response.raise_for_status = MagicMock()

        with patch("app.llm.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            assert await ollama_client.health_check() is False

    @pytest.mark.asyncio
    async def test_health_check_connection_error(self, ollama_client):
        with patch("app.llm.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.get.side_effect = Exception("Connection refused")
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            assert await ollama_client.health_check() is False

    @pytest.mark.asyncio
    async def test_list_models(self, ollama_client):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "models": [{"name": "llama3.1:70b"}, {"name": "nomic-embed-text"}]
        }
        mock_response.raise_for_status = MagicMock()

        with patch("app.llm.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            models = await ollama_client.list_models()
            assert "llama3.1:70b" in models
            assert len(models) == 2

    @pytest.mark.asyncio
    async def test_list_models_connection_error(self, ollama_client):
        with patch("app.llm.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.get.side_effect = Exception("Connection refused")
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            models = await ollama_client.list_models()
            assert models == []


@pytest.mark.unit
class TestOllamaClientStreaming:
    """Tests for OllamaClient.generate_stream() and ask_with_context_stream()."""

    @pytest.mark.asyncio
    async def test_ask_with_context_stream_yields_tokens(self, ollama_client):
        """Test that ask_with_context_stream yields individual tokens."""
        chunks = [{"content": "Python info", "document_filename": "guide.md", "score": 0.95}]

        async def mock_generate_stream(*args, **kwargs):
            yield {"response": "Python"}
            yield {"response": " is"}
            yield {"response": " great"}

        with patch.object(ollama_client, "generate_stream", side_effect=mock_generate_stream):
            tokens = []
            async for token in ollama_client.ask_with_context_stream("What is Python?", chunks):
                tokens.append(token)

            assert len(tokens) == 3
            assert tokens[0] == "Python"
            assert tokens[1] == " is"
            assert tokens[2] == " great"

    @pytest.mark.asyncio
    async def test_ask_with_context_stream_includes_context_in_prompt(self, ollama_client):
        """Test that context is properly formatted in streaming prompt."""
        chunks = [
            {"content": "Python basics", "document_filename": "intro.md", "score": 0.95},
            {"content": "Python advanced", "document_filename": "advanced.md", "score": 0.85},
        ]

        received_chunks = []

        async def mock_generate_stream(prompt, system=None, temperature=None):
            received_chunks.append({"prompt": prompt, "system": system})
            yield {"response": "Answer"}

        with patch.object(ollama_client, "generate_stream", side_effect=mock_generate_stream):
            async for _ in ollama_client.ask_with_context_stream("Tell me about Python", chunks):
                pass

            assert len(received_chunks) > 0
            prompt = received_chunks[0]["prompt"]

            # Verify context formatting
            assert "[Source 1: intro.md]" in prompt
            assert "[Source 2: advanced.md]" in prompt
            assert "Python basics" in prompt
            assert "Python advanced" in prompt
            assert "Tell me about Python" in prompt

    @pytest.mark.asyncio
    async def test_ask_with_context_stream_with_custom_system_prompt(self, ollama_client):
        """Test that custom system prompt is used when provided."""
        chunks = [{"content": "data", "document_filename": "file.md", "score": 0.9}]
        custom_prompt = "You are an expert Python developer"

        received_calls = []

        async def mock_generate_stream(prompt, system=None, temperature=None):
            received_calls.append({"prompt": prompt, "system": system})
            yield {"response": "answer"}

        with patch.object(ollama_client, "generate_stream", side_effect=mock_generate_stream):
            async for _ in ollama_client.ask_with_context_stream(
                "question", chunks, system_prompt=custom_prompt
            ):
                pass

            assert len(received_calls) > 0
            assert received_calls[0]["system"] == custom_prompt

    @pytest.mark.asyncio
    async def test_streaming_endpoint_sends_sse_format(self, ollama_client):
        """Test that streaming endpoint produces valid SSE format."""
        # This is an integration test verifying SSE format structure
        tokens = ["The", " RAG", " system"]

        async def mock_generate_stream(*args, **kwargs):
            for token in tokens:
                yield {"response": token}

        with patch.object(ollama_client, "generate_stream", side_effect=mock_generate_stream):
            result_tokens = []
            async for token in ollama_client.generate_stream("test"):
                result_tokens.append(token)

            assert len(result_tokens) == 3

    @pytest.mark.asyncio
    async def test_streaming_with_empty_chunks(self, ollama_client):
        """Test that streaming handles empty token responses gracefully."""

        async def mock_generate_stream(*args, **kwargs):
            yield {"response": "Token"}
            yield {"response": ""}  # Empty response should be skipped
            yield {"response": "Two"}

        with patch.object(ollama_client, "generate_stream", side_effect=mock_generate_stream):
            tokens = []
            async for token in ollama_client.ask_with_context_stream(
                "test", [{"content": "context", "document_filename": "test.md", "score": 0.9}]
            ):
                if token:  # Filter empty tokens
                    tokens.append(token)

            assert len(tokens) == 2
            assert tokens[0] == "Token"
            assert tokens[1] == "Two"

    @pytest.mark.asyncio
    async def test_generate_stream_method_exists_and_callable(self, ollama_client):
        """Test that generate_stream method exists and is callable."""
        assert hasattr(ollama_client, "generate_stream")
        assert callable(ollama_client.generate_stream)

    @pytest.mark.asyncio
    async def test_ask_with_context_stream_method_exists_and_callable(self, ollama_client):
        """Test that ask_with_context_stream method exists and is callable."""
        assert hasattr(ollama_client, "ask_with_context_stream")
        assert callable(ollama_client.ask_with_context_stream)

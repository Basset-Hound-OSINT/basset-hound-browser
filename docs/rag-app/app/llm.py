"""Ollama LLM client for RAG-augmented generation."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from .config import settings

logger = logging.getLogger(__name__)


@dataclass
class LLMResponse:
    """Response from LLM generation."""

    answer: str
    model: str
    context_chunks: list[dict]
    done: bool = True


class OllamaClient:
    """Async client for Ollama LLM API."""

    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout: int = 300,
        temperature: float = 0.3,
    ):
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.model = model or settings.LLM_MODEL
        self.timeout = timeout
        self.temperature = temperature

    async def generate(
        self,
        prompt: str,
        system: str | None = None,
        temperature: float | None = None,
    ) -> str:
        """Generate a response from the LLM."""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature if temperature is not None else self.temperature,
            },
        }
        if system:
            payload["system"] = system

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base_url}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "")

    async def generate_stream(
        self,
        prompt: str,
        system: str | None = None,
        temperature: float | None = None,
    ):
        """Stream a response from the LLM, yielding tokens as they arrive.

        Yields:
            dict: Each Ollama response chunk with 'response' field containing tokens
        """
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": True,
            "options": {
                "temperature": temperature if temperature is not None else self.temperature,
            },
        }
        if system:
            payload["system"] = system

        async with httpx.AsyncClient(timeout=self.timeout) as client, client.stream(
            "POST",
            f"{self.base_url}/api/generate",
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line:
                    import json as json_module

                    try:
                        yield json_module.loads(line)
                    except json_module.JSONDecodeError:
                        continue

    async def ask_with_context(
        self,
        question: str,
        context_chunks: list[dict],
        system_prompt: str | None = None,
    ) -> LLMResponse:
        """Answer a question using retrieved RAG context chunks.

        Args:
            question: The user's question.
            context_chunks: List of dicts with 'content', 'document_filename', 'score' keys.
            system_prompt: Optional system prompt override.
        """
        # Format context for injection
        context_parts = []
        for i, chunk in enumerate(context_chunks, 1):
            source = chunk.get("document_filename", "unknown")
            content = chunk.get("content", "")
            context_parts.append(f"[Source {i}: {source}]\n{content}")

        context_str = "\n\n---\n\n".join(context_parts)

        default_system = (
            f"You are a knowledgeable assistant for the project '{settings.PROJECT_NAME}'. "
            "Answer questions accurately using ONLY the provided context. "
            "If the context does not contain enough information to answer, say so clearly. "
            "Cite sources by their source number when possible."
        )

        user_prompt = f"""## Retrieved Context

{context_str}

---

## Question

{question}"""

        answer = await self.generate(
            prompt=user_prompt,
            system=system_prompt or default_system,
        )

        return LLMResponse(
            answer=answer,
            model=self.model,
            context_chunks=context_chunks,
        )

    async def ask_with_context_stream(
        self,
        question: str,
        context_chunks: list[dict],
        system_prompt: str | None = None,
    ):
        """Stream an answer using retrieved RAG context chunks.

        Args:
            question: The user's question.
            context_chunks: List of dicts with 'content', 'document_filename', 'score' keys.
            system_prompt: Optional system prompt override.

        Yields:
            str: Tokens as they are generated
        """
        # Format context for injection
        context_parts = []
        for i, chunk in enumerate(context_chunks, 1):
            source = chunk.get("document_filename", "unknown")
            content = chunk.get("content", "")
            context_parts.append(f"[Source {i}: {source}]\n{content}")

        context_str = "\n\n---\n\n".join(context_parts)

        default_system = (
            f"You are a knowledgeable assistant for the project '{settings.PROJECT_NAME}'. "
            "Answer questions accurately using ONLY the provided context. "
            "If the context does not contain enough information to answer, say so clearly. "
            "Cite sources by their source number when possible."
        )

        user_prompt = f"""## Retrieved Context

{context_str}

---

## Question

{question}"""

        # Stream tokens from the LLM
        async for chunk in self.generate_stream(
            prompt=user_prompt,
            system=system_prompt or default_system,
        ):
            token = chunk.get("response", "")
            if token:
                yield token

    async def health_check(self) -> bool:
        """Check if Ollama server is reachable and model exists."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                resp.raise_for_status()
                models = resp.json().get("models", [])
                model_names = [m.get("name", "") for m in models]
                # Check if our model (or a variant) is available
                return any(self.model in name or name in self.model for name in model_names)
        except Exception:
            return False

    async def list_models(self) -> list[str]:
        """List available models on the Ollama server."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                resp.raise_for_status()
                models = resp.json().get("models", [])
                return [m.get("name", "") for m in models]
        except Exception:
            return []

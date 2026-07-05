"""Chat Mode — Conversation with Optional RAG Augmentation

Enables:
- Pure conversation (no RAG)
- RAG-augmented conversation (dynamic KB selection)
- Conversation history management
- Context compaction for long conversations
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .llm import OllamaClient
    from .search_pipeline import SearchPipeline

logger = logging.getLogger(__name__)


@dataclass
class ChatMessage:
    """Single message in conversation."""

    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    sources: list[str] = field(default_factory=list)  # KB sources used (if RAG)


class ConversationHistory:
    """Manages conversation history with compaction."""

    def __init__(self, max_messages: int = 50, max_tokens: int = 4000):
        """Initialize conversation history.

        Args:
            max_messages: Max messages to keep (older ones compacted)
            max_tokens: Max tokens before compaction triggered
        """
        self.messages: list[ChatMessage] = []
        self.max_messages = max_messages
        self.max_tokens = max_tokens
        self._compaction_summary = None

    def add_message(self, role: str, content: str, sources: list[str] | None = None) -> None:
        """Add message to history.

        Args:
            role: "user" or "assistant"
            content: Message text
            sources: Optional KB sources used
        """
        msg = ChatMessage(role=role, content=content, sources=sources or [])
        self.messages.append(msg)

        # Trigger compaction if needed
        if len(self.messages) > self.max_messages:
            self._maybe_compact()

    def get_context(self, num_recent: int = 10) -> list[dict]:
        """Get recent messages for LLM context.

        Args:
            num_recent: Number of recent messages to include

        Returns:
            List of dicts with role and content
        """
        messages = []

        # Add compaction summary if exists
        if self._compaction_summary:
            messages.append(
                {
                    "role": "system",
                    "content": f"[Conversation Summary]\n{self._compaction_summary}",
                }
            )

        # Add recent messages
        recent = self.messages[-num_recent:]
        for msg in recent:
            messages.append(
                {
                    "role": msg.role,
                    "content": msg.content,
                }
            )

        return messages

    def _maybe_compact(self) -> None:
        """Compact old messages into summary if needed."""
        if len(self.messages) <= self.max_messages:
            return

        logger.info("Compacting conversation history (size=%d)", len(self.messages))

        # Keep recent messages
        keep_count = self.max_messages // 2
        recent = self.messages[-keep_count:]

        # Summarize old messages
        old = self.messages[:-keep_count]
        summary_lines = [
            f"[Earlier in conversation: {len(old)} messages]",
            "Topics discussed:",
        ]

        # Extract main topics from old messages
        for msg in old:
            if msg.role == "user" and len(msg.content) > 0:
                summary_lines.append(f"- {msg.content[:100]}")

        self._compaction_summary = "\n".join(summary_lines)
        self.messages = recent

        logger.info("Compaction complete (retained=%d, summarized=%d)", keep_count, len(old))

    def clear(self) -> None:
        """Clear conversation history."""
        self.messages = []
        self._compaction_summary = None


class ChatSession:
    """Single chat session with optional RAG."""

    def __init__(
        self,
        session_id: str,
        llm_client: OllamaClient,
        search_pipeline: SearchPipeline | None = None,
        use_rag: bool = False,
    ):
        """Initialize chat session.

        Args:
            session_id: Unique session ID
            llm_client: Ollama or other LLM client
            search_pipeline: Search pipeline (required if use_rag=True)
            use_rag: Whether to augment responses with RAG
        """
        self.session_id = session_id
        self.llm_client = llm_client
        self.search_pipeline = search_pipeline
        self.use_rag = use_rag
        self.history = ConversationHistory()

    async def send_message(
        self,
        user_message: str,
        max_tokens: int = 500,
        temperature: float = 0.7,
    ) -> str:
        """Send message and get response.

        Args:
            user_message: User input
            max_tokens: Max response tokens
            temperature: Response temperature

        Returns:
            Assistant response
        """
        # Add user message to history
        self.history.add_message("user", user_message)

        # Optionally retrieve RAG context
        rag_context = ""
        sources = []
        if self.use_rag and self.search_pipeline:
            rag_results = await self.search_pipeline.search(user_message, limit=5)
            if rag_results:
                sources = [r.document_filename for r in rag_results]
                rag_context = self._format_rag_context(rag_results)

        # Build prompt with history and optional RAG
        prompt = self._build_prompt(user_message, rag_context)

        # Generate response
        try:
            response = await self.llm_client.generate(
                prompt,
                max_tokens=max_tokens,
                temperature=temperature,
            )

            # Add assistant response to history
            self.history.add_message("assistant", response, sources=sources)

            return response
        except Exception:
            logger.exception("Chat generation failed")
            raise

    def _build_prompt(self, user_message: str, rag_context: str) -> str:
        """Build prompt with conversation history and optional RAG.

        Args:
            user_message: Current user message
            rag_context: Optional RAG context

        Returns:
            Formatted prompt for LLM
        """
        lines = []

        # System prompt
        lines.append("You are a helpful assistant. Provide clear, accurate responses.")
        if self.use_rag and rag_context:
            lines.append("Use the provided context to answer questions.")

        # Conversation history
        context = self.history.get_context(num_recent=10)
        for msg in context:
            if msg["role"] == "system":
                lines.append(f"\n{msg['content']}")
            else:
                role = "User" if msg["role"] == "user" else "Assistant"
                lines.append(f"\n{role}: {msg['content']}")

        # RAG context
        if rag_context:
            lines.append(f"\n[Context from Knowledge Base]\n{rag_context}")

        # Current user message
        lines.append(f"\nUser: {user_message}")
        lines.append("\nAssistant:")

        return "\n".join(lines)

    @staticmethod
    def _format_rag_context(results) -> str:
        """Format RAG results into context string.

        Args:
            results: List of SearchResult

        Returns:
            Formatted context string
        """
        lines = []
        for i, result in enumerate(results, 1):
            lines.append(f"{i}. {result.document_filename} (chunk {result.chunk_index})")
            lines.append(f"   {result.content[:200]}...")
            lines.append("")

        return "\n".join(lines)

    def get_messages(self, limit: int = 50) -> list[dict]:
        """Get message history.

        Args:
            limit: Max messages to return

        Returns:
            List of messages
        """
        recent = self.history.messages[-limit:]
        return [
            {
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat(),
                "sources": msg.sources,
            }
            for msg in recent
        ]

    def clear_history(self) -> None:
        """Clear conversation history."""
        self.history.clear()
        logger.info("Cleared history for session %s", self.session_id)


class ChatSessionManager:
    """Manages multiple chat sessions."""

    def __init__(self):
        """Initialize session manager."""
        self.sessions: dict[str, ChatSession] = {}

    def create_session(
        self,
        session_id: str,
        llm_client: OllamaClient,
        search_pipeline: SearchPipeline | None = None,
        use_rag: bool = False,
    ) -> ChatSession:
        """Create new chat session.

        Args:
            session_id: Unique ID for session
            llm_client: LLM client
            search_pipeline: Search pipeline (if using RAG)
            use_rag: Enable RAG augmentation

        Returns:
            ChatSession instance
        """
        if session_id in self.sessions:
            logger.warning("Session %s already exists", session_id)
            return self.sessions[session_id]

        session = ChatSession(session_id, llm_client, search_pipeline, use_rag)
        self.sessions[session_id] = session
        logger.info("Created chat session %s (use_rag=%s)", session_id, use_rag)

        return session

    def get_session(self, session_id: str) -> ChatSession | None:
        """Get existing session.

        Args:
            session_id: Session ID

        Returns:
            ChatSession or None if not found
        """
        return self.sessions.get(session_id)

    def delete_session(self, session_id: str) -> None:
        """Delete session.

        Args:
            session_id: Session ID
        """
        if session_id in self.sessions:
            del self.sessions[session_id]
            logger.info("Deleted chat session %s", session_id)

    def list_sessions(self) -> list[str]:
        """List all active session IDs.

        Returns:
            List of session IDs
        """
        return list(self.sessions.keys())

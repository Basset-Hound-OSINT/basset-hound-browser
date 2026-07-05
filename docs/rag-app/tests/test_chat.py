"""Tests for Chat Module

Tests:
- Conversation history management
- Chat session with/without RAG
- Context compaction
- Session manager
"""

from unittest.mock import AsyncMock

import pytest
from app.chat import (
    ChatMessage,
    ChatSession,
    ChatSessionManager,
    ConversationHistory,
)


class TestChatMessage:
    """Test ChatMessage model."""

    def test_chat_message_creation(self):
        """Should create message with role and content."""
        msg = ChatMessage(role="user", content="Hello")

        assert msg.role == "user"
        assert msg.content == "Hello"
        assert msg.timestamp is not None
        assert msg.sources == []

    def test_chat_message_with_sources(self):
        """Should track sources."""
        msg = ChatMessage(
            role="assistant",
            content="Response",
            sources=["atc.pdf", "procedures.txt"],
        )

        assert len(msg.sources) == 2


class TestConversationHistory:
    """Test ConversationHistory."""

    @pytest.fixture
    def history(self):
        """Create test history."""
        return ConversationHistory(max_messages=10)

    def test_add_message(self, history):
        """Should add messages."""
        history.add_message("user", "Hello")
        history.add_message("assistant", "Hi there")

        assert len(history.messages) == 2
        assert history.messages[0].role == "user"
        assert history.messages[1].role == "assistant"

    def test_get_context(self, history):
        """Should format context for LLM."""
        history.add_message("user", "Question 1")
        history.add_message("assistant", "Answer 1")

        context = history.get_context()
        assert len(context) == 2
        assert context[0]["role"] == "user"
        assert "Question 1" in context[0]["content"]

    def test_get_recent_messages(self, history):
        """Should get only recent messages."""
        for i in range(20):
            history.add_message("user", f"Question {i}")

        # With max_messages=10, should compact
        context = history.get_context(num_recent=5)

        # Should have compaction summary + 5 recent
        assert len(context) <= 6

    def test_compaction(self, history):
        """Should compact when exceeding max messages."""
        # Add 15 messages (exceeds max=10)
        for i in range(15):
            history.add_message("user", f"Msg {i}")

        # Should trigger compaction
        assert len(history.messages) <= 10
        assert history._compaction_summary is not None

    def test_clear_history(self, history):
        """Should clear all messages."""
        history.add_message("user", "Message")
        history.clear()

        assert len(history.messages) == 0


class TestChatSession:
    """Test ChatSession."""

    @pytest.fixture
    async def session(self):
        """Create test chat session."""
        llm_client = AsyncMock()
        llm_client.generate = AsyncMock(return_value="Test response")

        session = ChatSession(
            session_id="test-session",
            llm_client=llm_client,
            use_rag=False,
        )
        return session

    @pytest.mark.asyncio
    async def test_send_message(self, session):
        """Should send message and get response."""
        response = await session.send_message("Hello")

        assert response == "Test response"
        assert len(session.history.messages) == 2
        assert session.history.messages[0].role == "user"
        assert session.history.messages[1].role == "assistant"

    @pytest.mark.asyncio
    async def test_send_message_with_rag(self):
        """Should include RAG context if enabled."""
        llm_client = AsyncMock()
        llm_client.generate = AsyncMock(return_value="RAG-augmented response")

        # Mock search pipeline
        search_pipeline = AsyncMock()

        class MockResult:
            document_filename = "test.pdf"
            chunk_index = 0
            content = "Test content from RAG"

        search_pipeline.search = AsyncMock(return_value=[MockResult()])

        session = ChatSession(
            session_id="test-rag",
            llm_client=llm_client,
            search_pipeline=search_pipeline,
            use_rag=True,
        )

        response = await session.send_message("Query")

        # Should have called search pipeline
        search_pipeline.search.assert_called_once()
        assert response == "RAG-augmented response"

    @pytest.mark.asyncio
    async def test_get_messages(self, session):
        """Should retrieve message history."""
        await session.send_message("Question 1")
        await session.send_message("Question 2")

        messages = session.get_messages()

        assert len(messages) >= 2
        assert messages[0]["role"] == "user"

    @pytest.mark.asyncio
    async def test_clear_history(self, session):
        """Should clear history."""
        await session.send_message("Message")
        session.clear_history()

        messages = session.get_messages()
        assert len(messages) == 0


class TestChatSessionManager:
    """Test ChatSessionManager."""

    @pytest.fixture
    def manager(self):
        """Create test manager."""
        return ChatSessionManager()

    def test_create_session(self, manager):
        """Should create new session."""
        llm_client = AsyncMock()

        session = manager.create_session(
            "session-1",
            llm_client,
            use_rag=False,
        )

        assert session.session_id == "session-1"
        assert "session-1" in manager.sessions

    def test_get_session(self, manager):
        """Should retrieve session."""
        llm_client = AsyncMock()
        manager.create_session("session-1", llm_client)

        retrieved = manager.get_session("session-1")
        assert retrieved is not None
        assert retrieved.session_id == "session-1"

    def test_get_nonexistent_session(self, manager):
        """Should return None for missing session."""
        retrieved = manager.get_session("nonexistent")
        assert retrieved is None

    def test_delete_session(self, manager):
        """Should delete session."""
        llm_client = AsyncMock()
        manager.create_session("to-delete", llm_client)

        manager.delete_session("to-delete")

        assert manager.get_session("to-delete") is None

    def test_list_sessions(self, manager):
        """Should list all sessions."""
        llm_client = AsyncMock()

        manager.create_session("session-1", llm_client)
        manager.create_session("session-2", llm_client)

        sessions = manager.list_sessions()
        assert "session-1" in sessions
        assert "session-2" in sessions
        assert len(sessions) == 2

    def test_duplicate_session(self, manager):
        """Should not create duplicate session."""
        llm_client = AsyncMock()

        session1 = manager.create_session("same-id", llm_client)
        session2 = manager.create_session("same-id", llm_client)

        # Should return existing session
        assert session1 is session2


class TestChatPromptBuilding:
    """Test prompt building."""

    @pytest.fixture
    async def session(self):
        """Create test session."""
        llm_client = AsyncMock()
        llm_client.generate = AsyncMock(return_value="Response")
        return ChatSession("test", llm_client, use_rag=False)

    @pytest.mark.asyncio
    async def test_prompt_includes_history(self, session):
        """Prompt should include conversation history."""
        await session.send_message("First question")
        await session.send_message("Second question")

        # Mock the LLM to capture the prompt
        captured_prompt = None

        async def capture_generate(prompt, **kwargs):
            nonlocal captured_prompt
            captured_prompt = prompt
            return "Response"

        session.llm_client.generate = capture_generate

        await session.send_message("Third question")

        # Prompt should contain previous messages
        assert "First question" in captured_prompt
        assert "Second question" in captured_prompt

    @pytest.mark.asyncio
    async def test_prompt_includes_rag_context(self):
        """Prompt should include RAG context when enabled."""
        llm_client = AsyncMock()

        search_pipeline = AsyncMock()

        class MockResult:
            document_filename = "test.pdf"
            chunk_index = 0
            content = "Important information"

        search_pipeline.search = AsyncMock(return_value=[MockResult()])

        captured_prompt = None

        async def capture_generate(prompt, **kwargs):
            nonlocal captured_prompt
            captured_prompt = prompt
            return "Response"

        llm_client.generate = capture_generate

        session = ChatSession(
            "test",
            llm_client,
            search_pipeline,
            use_rag=True,
        )

        await session.send_message("Query")

        # Prompt should contain RAG context
        assert "Important information" in captured_prompt
        assert "[Context from Knowledge Base]" in captured_prompt

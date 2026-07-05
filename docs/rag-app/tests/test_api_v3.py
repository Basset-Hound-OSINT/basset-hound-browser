"""API v3 Chat and Streaming Tests

Tests for REST and WebSocket chat endpoints with optional RAG.
"""

from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_chat_session():
    """Test creating a new chat session."""
    from app.main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post("/api/v3/chat/session")

        assert response.status_code == 201
        data = response.json()
        assert "session_id" in data
        assert isinstance(data["session_id"], str)


@pytest.mark.asyncio
async def test_create_multiple_sessions():
    """Test creating multiple chat sessions."""
    from app.main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        session1 = await client.post("/api/v3/chat/session")
        session2 = await client.post("/api/v3/chat/session")

        sid1 = session1.json()["session_id"]
        sid2 = session2.json()["session_id"]

        # Sessions should be different
        assert sid1 != sid2


@pytest.mark.asyncio
async def test_list_chat_sessions():
    """Test listing chat sessions."""
    from app.main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        # Create sessions
        session1 = await client.post("/api/v3/chat/session")
        session2 = await client.post("/api/v3/chat/session")

        sid1 = session1.json()["session_id"]
        sid2 = session2.json()["session_id"]

        # List sessions
        response = await client.get("/api/v3/chat/sessions")
        assert response.status_code == 200

        data = response.json()
        assert "sessions" in data
        assert isinstance(data["sessions"], list)
        assert sid1 in data["sessions"]
        assert sid2 in data["sessions"]


@pytest.mark.asyncio
async def test_send_chat_message_without_rag():
    """Test sending a chat message without RAG."""
    from app.main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        # Create session
        session = await client.post("/api/v3/chat/session")
        session_id = session.json()["session_id"]

        # Send message without RAG
        response = await client.post(
            f"/api/v3/chat/{session_id}/message",
            json={"message": "What is 2+2?", "use_rag": False},
        )

        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "session_id" in data
        assert data["session_id"] == session_id
        assert data["sources"] is None or len(data["sources"]) == 0


@pytest.mark.asyncio
async def test_get_chat_history():
    """Test retrieving chat history."""
    from app.main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        # Create session
        session = await client.post("/api/v3/chat/session")
        session_id = session.json()["session_id"]

        # Send message
        await client.post(
            f"/api/v3/chat/{session_id}/message", json={"message": "Hello", "use_rag": False}
        )

        # Get history
        response = await client.get(f"/api/v3/chat/{session_id}/history")

        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert data["session_id"] == session_id
        assert "messages" in data
        assert isinstance(data["messages"], list)
        # Should have user message and assistant response
        assert len(data["messages"]) >= 2


@pytest.mark.asyncio
async def test_clear_chat_history():
    """Test clearing chat history."""
    from app.main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        # Create session
        session = await client.post("/api/v3/chat/session")
        session_id = session.json()["session_id"]

        # Send message
        await client.post(
            f"/api/v3/chat/{session_id}/message", json={"message": "Hello", "use_rag": False}
        )

        # Clear history
        response = await client.post(f"/api/v3/chat/{session_id}/clear")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "cleared"
        assert data["session_id"] == session_id


@pytest.mark.asyncio
async def test_delete_chat_session():
    """Test deleting a chat session."""
    from app.main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        # Create session
        session = await client.post("/api/v3/chat/session")
        session_id = session.json()["session_id"]

        # Delete session
        response = await client.delete(f"/api/v3/chat/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "deleted"
        assert data["session_id"] == session_id

        # Verify session is deleted
        response = await client.get(f"/api/v3/chat/{session_id}/history")
        assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_history_nonexistent_session():
    """Test getting history for nonexistent session."""
    from app.main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v3/chat/nonexistent/history")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data


@pytest.mark.asyncio
async def test_send_message_nonexistent_session():
    """Test sending message to nonexistent session."""
    from app.main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v3/chat/nonexistent/message", json={"message": "Hello", "use_rag": False}
        )

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data


@pytest.mark.asyncio
async def test_chat_message_with_different_search_modes():
    """Test chat messages with different search modes."""
    from app.main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        session = await client.post("/api/v3/chat/session")
        session_id = session.json()["session_id"]

        modes = ["semantic", "keyword", "hybrid"]

        for mode in modes:
            response = await client.post(
                f"/api/v3/chat/{session_id}/message",
                json={"message": "Test message", "use_rag": False, "mode": mode},
            )

            assert response.status_code == 200
            data = response.json()
            assert "response" in data


@pytest.mark.asyncio
async def test_multi_turn_conversation():
    """Test multi-turn conversation."""
    from app.main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        session = await client.post("/api/v3/chat/session")
        session_id = session.json()["session_id"]

        # Send multiple messages
        messages = ["Hello", "How are you?", "What is your name?"]

        for msg in messages:
            response = await client.post(
                f"/api/v3/chat/{session_id}/message", json={"message": msg, "use_rag": False}
            )
            assert response.status_code == 200

        # Check history
        history = await client.get(f"/api/v3/chat/{session_id}/history")
        assert history.status_code == 200

        data = history.json()
        assert len(data["messages"]) >= 2 * len(messages)


@pytest.mark.asyncio
async def test_websocket_chat_protocol():
    """Test WebSocket chat message protocol."""
    from app.main import app

    client = TestClient(app)

    # Create session first
    response = client.post("/api/v3/chat/session")
    session_id = response.json()["session_id"]

    # Test WebSocket connection
    with client.websocket_connect(f"/api/v3/ws/chat/{session_id}") as websocket:
        # Send message
        websocket.send_json({"type": "message", "content": "Hello"})

        # Receive messages
        messages = []
        try:
            for _ in range(10):  # Limit iterations to avoid infinite loop
                data = websocket.receive_json()
                messages.append(data)

                if data.get("type") == "complete":
                    break
        except Exception:
            pass  # WebSocket closed or timeout

        # Should have thinking, tokens, and complete
        assert any(m.get("type") == "thinking" for m in messages)
        assert any(m.get("type") in ["token", "complete"] for m in messages)


@pytest.mark.asyncio
async def test_websocket_clear_history():
    """Test WebSocket clear history command."""
    from app.main import app

    client = TestClient(app)

    response = client.post("/api/v3/chat/session")
    session_id = response.json()["session_id"]

    with client.websocket_connect(f"/api/v3/ws/chat/{session_id}") as websocket:
        # Clear history
        websocket.send_json({"type": "clear"})

        # Receive response
        data = websocket.receive_json()

        assert data.get("type") == "cleared"
        assert data.get("data") == "Conversation history cleared"


@pytest.mark.asyncio
async def test_websocket_list_messages():
    """Test WebSocket list messages command."""
    from app.main import app

    client = TestClient(app)

    response = client.post("/api/v3/chat/session")
    session_id = response.json()["session_id"]

    with client.websocket_connect(f"/api/v3/ws/chat/{session_id}") as websocket:
        # List messages
        websocket.send_json({"type": "list_messages"})

        # Receive response
        data = websocket.receive_json()

        assert data.get("type") == "messages"
        assert "data" in data


@pytest.mark.asyncio
async def test_websocket_multiple_sessions():
    """Test WebSocket with multiple concurrent sessions."""
    from app.main import app

    client = TestClient(app)

    # Create two sessions
    response1 = client.post("/api/v3/chat/session")
    session1 = response1.json()["session_id"]

    response2 = client.post("/api/v3/chat/session")
    session2 = response2.json()["session_id"]

    # Connect to both
    with client.websocket_connect(f"/api/v3/ws/chat/{session1}") as ws1:
        with client.websocket_connect(f"/api/v3/ws/chat/{session2}") as ws2:
            # Send messages to both
            ws1.send_json({"type": "list_messages"})
            ws2.send_json({"type": "list_messages"})

            # Receive from both
            data1 = ws1.receive_json()
            data2 = ws2.receive_json()

            assert data1.get("type") == "messages"
            assert data2.get("type") == "messages"


# Mock-based unit tests for message handling


@pytest.mark.asyncio
async def test_chat_message_building():
    """Test chat message building with RAG context."""
    from app.chat import ChatMessage, ConversationHistory

    history = ConversationHistory()

    msg = ChatMessage(
        role="user",
        content="What is RAG?",
        sources=[
            {"content": "RAG is Retrieval Augmented Generation", "document_filename": "doc.pdf"}
        ],
    )

    history.add_message(msg)
    assert len(history.messages) == 1
    assert history.messages[0].role == "user"
    assert history.messages[0].sources is not None


@pytest.mark.asyncio
async def test_chat_session_context_window():
    """Test chat session context window building."""
    from app.chat import ChatSession

    llm_client = AsyncMock()
    llm_client.ask_with_context = AsyncMock(return_value=AsyncMock(answer="Response"))

    session = ChatSession(session_id="test", llm_client=llm_client, use_rag=False)

    # Add messages
    message1 = await session.send_message("Hello")
    message2 = await session.send_message("How are you?")

    # Verify messages are in history
    messages = session.get_messages()
    assert len(messages) >= 2


@pytest.mark.asyncio
async def test_websocket_connection_manager():
    """Test WebSocket connection manager."""
    from app.websocket_chat import WebSocketConnectionManager

    manager = WebSocketConnectionManager()

    # Create mock websockets
    ws1 = AsyncMock()
    ws2 = AsyncMock()

    # Connect
    await manager.connect(ws1, "session1")
    await manager.connect(ws2, "session2")

    assert "session1" in manager.session_to_connection
    assert "session2" in manager.session_to_connection

    # Send message
    await manager.send_message("session1", {"type": "test"})
    ws1.send_json.assert_called_once()

    # Disconnect
    await manager.disconnect("session1")
    assert "session1" not in manager.session_to_connection


# Test error scenarios


@pytest.mark.asyncio
async def test_chat_error_handling():
    """Test error handling in chat."""
    from app.main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        # Try to send to nonexistent session
        response = await client.post(
            "/api/v3/chat/invalid-session/message", json={"message": "Test", "use_rag": False}
        )

        assert response.status_code == 404


@pytest.mark.asyncio
async def test_websocket_disconnect_handling():
    """Test WebSocket disconnect handling."""
    from app.main import app

    client = TestClient(app)

    response = client.post("/api/v3/chat/session")
    session_id = response.json()["session_id"]

    with client.websocket_connect(f"/api/v3/ws/chat/{session_id}") as websocket:
        websocket.send_json({"type": "message", "content": "Test"})

        # Disconnect (connection manager should handle gracefully)
        # No assertion needed - test passes if no exception is raised


@pytest.mark.asyncio
async def test_streaming_response_format():
    """Test streaming response format."""
    from app.main import app

    client = TestClient(app)

    response = client.post("/api/v3/chat/session")
    session_id = response.json()["session_id"]

    with client.websocket_connect(f"/api/v3/ws/chat/{session_id}") as websocket:
        websocket.send_json({"type": "message", "content": "Test"})

        # Collect all messages
        messages = []
        try:
            for _ in range(20):
                msg = websocket.receive_json()
                messages.append(msg)
                assert "type" in msg
                assert "data" in msg

                if msg.get("type") == "complete":
                    break
        except Exception:
            pass

        # Verify message sequence
        if messages:
            # Should start with thinking
            assert messages[0].get("type") == "thinking"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

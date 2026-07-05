"""Pattern-D tests for app/websocket_chat.py (WebSocket streaming chat).

Wave 62 D1: ≥8 tests for `WebSocketConnectionManager` and
`StreamingChatHandler`. Pure unit tests — no real WebSocket / network.

Module under test (253 LOC) exposes:
- WebSocketConnectionManager.connect / disconnect / send_message /
  broadcast_to_session / get_connection
- StreamingChatHandler.handle_chat_connection
- StreamingChatHandler._generate_streaming_response

Pattern-D: AsyncMock-based fakes for WebSocket and ChatSession. We do
NOT spin up FastAPI / Starlette — the unit under test only depends on
the WebSocket protocol surface (`accept`, `send_json`, `receive_text`)
and the ChatSession surface (`send_message`, `history`,
`clear_history`, `get_messages`).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import WebSocketDisconnect

from app.websocket_chat import (
    StreamingChatHandler,
    WebSocketConnectionManager,
)


# ---------------------------------------------------------------------------
# Fakes / fixtures
# ---------------------------------------------------------------------------


def _make_fake_ws() -> MagicMock:
    """Minimal WebSocket double — only the methods websocket_chat uses."""
    ws = MagicMock()
    ws.accept = AsyncMock(return_value=None)
    ws.send_json = AsyncMock(return_value=None)
    ws.receive_text = AsyncMock()
    return ws


@dataclass
class _FakeChatMessage:
    role: str = "assistant"
    content: str = "ok"
    sources: list[str] = field(default_factory=list)
    timestamp: datetime | None = field(default_factory=datetime.utcnow)


def _make_fake_session(
    response_text: str = "alpha beta gamma",
    sources: list[str] | None = None,
    messages: list[_FakeChatMessage] | None = None,
    send_raises: BaseException | None = None,
) -> MagicMock:
    """Minimal ChatSession double.

    Only the attributes/methods the handler reads:
    - send_message(...)  -> str
    - history.messages   -> list with .sources (last entry)
    - get_messages()     -> list[ChatMessage-like]
    - clear_history()    -> None
    """
    session = MagicMock()
    if send_raises is not None:
        session.send_message = AsyncMock(side_effect=send_raises)
    else:
        session.send_message = AsyncMock(return_value=response_text)

    # history with .messages[-1].sources
    history = SimpleNamespace(
        messages=[
            SimpleNamespace(sources=sources or ["doc1.pdf", "doc2.pdf"]),
        ]
    )
    session.history = history

    session.get_messages = MagicMock(
        return_value=messages
        or [
            _FakeChatMessage(role="user", content="hi"),
            _FakeChatMessage(role="assistant", content="hello"),
        ]
    )
    session.clear_history = MagicMock(return_value=None)
    return session


@pytest.fixture()
def manager() -> WebSocketConnectionManager:
    return WebSocketConnectionManager()


# ===========================================================================
# WebSocketConnectionManager (5 tests)
# ===========================================================================


@pytest.mark.asyncio
async def test_connect_accepts_and_registers(manager):
    """connect() must call ws.accept() and register both maps."""
    ws = _make_fake_ws()

    await manager.connect(ws, session_id="s1")

    ws.accept.assert_awaited_once()
    # one connection registered, mapped from session id
    assert "s1" in manager.session_to_connection
    conn_id = manager.session_to_connection["s1"]
    assert manager.active_connections[conn_id] is ws


@pytest.mark.asyncio
async def test_disconnect_clears_both_maps(manager):
    """disconnect() removes the session entry and the active connection."""
    ws = _make_fake_ws()
    await manager.connect(ws, "s1")

    await manager.disconnect("s1")

    assert "s1" not in manager.session_to_connection
    assert ws not in manager.active_connections.values()


@pytest.mark.asyncio
async def test_disconnect_unknown_session_is_safe(manager):
    """disconnect() on a session that was never connected is a no-op."""
    # No connection has been registered — must not raise.
    await manager.disconnect("never-existed")

    assert manager.active_connections == {}
    assert manager.session_to_connection == {}


@pytest.mark.asyncio
async def test_send_message_delivers_to_correct_socket(manager):
    """send_message routes the dict to the registered ws via send_json()."""
    ws = _make_fake_ws()
    await manager.connect(ws, "s1")

    payload = {"type": "token", "data": "hello"}
    await manager.send_message("s1", payload)

    ws.send_json.assert_awaited_once_with(payload)


@pytest.mark.asyncio
async def test_send_message_unknown_session_is_silent(manager):
    """send_message() to an unregistered session must not raise."""
    # No connection for s2 — manager should silently drop.
    await manager.send_message("s2", {"type": "x"})  # no exception expected


@pytest.mark.asyncio
async def test_send_message_swallows_send_json_exception(manager):
    """If ws.send_json raises, send_message logs and swallows (does not raise)."""
    ws = _make_fake_ws()
    ws.send_json = AsyncMock(side_effect=RuntimeError("socket dead"))
    await manager.connect(ws, "s1")

    # Must not raise out of the manager.
    await manager.send_message("s1", {"type": "token", "data": "x"})


@pytest.mark.asyncio
async def test_broadcast_to_session_delegates_to_send_message(manager):
    """broadcast_to_session is currently a thin wrapper around send_message."""
    ws = _make_fake_ws()
    await manager.connect(ws, "s1")

    await manager.broadcast_to_session("s1", {"type": "complete", "data": "ok"})

    ws.send_json.assert_awaited_once()
    sent = ws.send_json.await_args.args[0]
    assert sent["type"] == "complete"


@pytest.mark.asyncio
async def test_get_connection_returns_ws_or_none(manager):
    """get_connection returns the registered ws, or None for unknown sessions."""
    ws = _make_fake_ws()
    await manager.connect(ws, "s1")

    assert await manager.get_connection("s1") is ws
    assert await manager.get_connection("nope") is None


# ===========================================================================
# StreamingChatHandler._generate_streaming_response (2 tests)
# ===========================================================================


@pytest.mark.asyncio
async def test_generate_streaming_response_streams_tokens(manager):
    """_generate_streaming_response sends one 'token' msg per whitespace token
    and returns the accumulated text (stripped)."""
    ws = _make_fake_ws()
    await manager.connect(ws, "s1")

    session = _make_fake_session(response_text="alpha beta gamma")
    handler = StreamingChatHandler(session, manager)

    result = await handler._generate_streaming_response(session, "irrelevant", "s1")

    assert result == "alpha beta gamma"
    session.send_message.assert_awaited_once()
    # 3 tokens streamed
    token_sends = [
        c.args[0] for c in ws.send_json.await_args_list if c.args[0].get("type") == "token"
    ]
    assert len(token_sends) == 3
    assert [t["data"] for t in token_sends] == ["alpha ", "beta ", "gamma "]


@pytest.mark.asyncio
async def test_generate_streaming_response_empty_response(manager):
    """Empty LLM response yields zero token sends and empty string return."""
    ws = _make_fake_ws()
    await manager.connect(ws, "s1")

    session = _make_fake_session(response_text="")
    handler = StreamingChatHandler(session, manager)

    result = await handler._generate_streaming_response(session, "q", "s1")

    assert result == ""
    token_sends = [
        c.args[0] for c in ws.send_json.await_args_list if c.args[0].get("type") == "token"
    ]
    assert token_sends == []


# ===========================================================================
# StreamingChatHandler.handle_chat_connection (5 tests)
# ===========================================================================


def _queue_messages(ws: MagicMock, payloads: list[dict | str], then_disconnect: bool = True):
    """Wire ws.receive_text to yield each payload (JSON-encoded if dict),
    then raise WebSocketDisconnect (so the handler's main loop exits)."""

    serialized: list[str | BaseException] = []
    for p in payloads:
        serialized.append(p if isinstance(p, str) else json.dumps(p))
    if then_disconnect:
        serialized.append(WebSocketDisconnect())

    async def _receive():
        nxt = serialized.pop(0)
        if isinstance(nxt, BaseException):
            raise nxt
        return nxt

    ws.receive_text = AsyncMock(side_effect=_receive)


@pytest.mark.asyncio
async def test_handle_chat_connection_message_full_flow(manager):
    """A 'message' input drives: thinking -> token(s) -> complete; with sources."""
    ws = _make_fake_ws()
    session = _make_fake_session(
        response_text="hi there", sources=["a.pdf", "b.pdf"]
    )
    handler = StreamingChatHandler(session, manager)

    _queue_messages(ws, [{"type": "message", "content": "hello"}])

    await handler.handle_chat_connection(ws, "s1")

    types_sent = [
        c.args[0]["type"] for c in ws.send_json.await_args_list
    ]
    assert "thinking" in types_sent
    assert "token" in types_sent
    assert "complete" in types_sent

    complete = next(
        c.args[0] for c in ws.send_json.await_args_list if c.args[0]["type"] == "complete"
    )
    assert complete["data"]["content"] == "hi there"
    assert complete["data"]["sources"] == ["a.pdf", "b.pdf"]

    # session was disconnected after WebSocketDisconnect raised
    assert "s1" not in manager.session_to_connection


@pytest.mark.asyncio
async def test_handle_chat_connection_empty_content_skipped(manager):
    """Whitespace-only content -> NO thinking/complete sent (continue branch)."""
    ws = _make_fake_ws()
    session = _make_fake_session()
    handler = StreamingChatHandler(session, manager)

    _queue_messages(ws, [{"type": "message", "content": "   "}])

    await handler.handle_chat_connection(ws, "s1")

    types_sent = [c.args[0]["type"] for c in ws.send_json.await_args_list]
    assert "thinking" not in types_sent
    assert "complete" not in types_sent
    session.send_message.assert_not_awaited()


@pytest.mark.asyncio
async def test_handle_chat_connection_generation_error_sends_error_frame(manager):
    """session.send_message raising -> 'error' frame, NO 'complete' frame."""
    ws = _make_fake_ws()
    session = _make_fake_session(send_raises=RuntimeError("LLM down"))
    handler = StreamingChatHandler(session, manager)

    _queue_messages(ws, [{"type": "message", "content": "hello"}])

    await handler.handle_chat_connection(ws, "s1")

    types_sent = [c.args[0]["type"] for c in ws.send_json.await_args_list]
    assert "error" in types_sent
    assert "complete" not in types_sent
    error_frame = next(
        c.args[0] for c in ws.send_json.await_args_list if c.args[0]["type"] == "error"
    )
    assert "LLM down" in error_frame["data"]


@pytest.mark.asyncio
async def test_handle_chat_connection_clear_resets_history(manager):
    """'clear' type calls session.clear_history() and sends 'cleared'."""
    ws = _make_fake_ws()
    session = _make_fake_session()
    handler = StreamingChatHandler(session, manager)

    _queue_messages(ws, [{"type": "clear"}])

    await handler.handle_chat_connection(ws, "s1")

    session.clear_history.assert_called_once()
    types_sent = [c.args[0]["type"] for c in ws.send_json.await_args_list]
    assert "cleared" in types_sent


@pytest.mark.asyncio
async def test_handle_chat_connection_list_messages_returns_history(manager):
    """'list_messages' returns serialized session.get_messages() payload."""
    ws = _make_fake_ws()
    fake_msgs = [
        _FakeChatMessage(role="user", content="q1"),
        _FakeChatMessage(role="assistant", content="a1"),
    ]
    session = _make_fake_session(messages=fake_msgs)
    handler = StreamingChatHandler(session, manager)

    _queue_messages(ws, [{"type": "list_messages"}])

    await handler.handle_chat_connection(ws, "s1")

    messages_frame = next(
        c.args[0] for c in ws.send_json.await_args_list if c.args[0]["type"] == "messages"
    )
    assert isinstance(messages_frame["data"], list)
    roles = [m["role"] for m in messages_frame["data"]]
    assert roles == ["user", "assistant"]
    # timestamps were serialized via .isoformat()
    assert all(isinstance(m["timestamp"], str) for m in messages_frame["data"])


@pytest.mark.asyncio
async def test_handle_chat_connection_handles_disconnect_cleanly(manager):
    """If receive_text raises WebSocketDisconnect immediately, connect/disconnect
    bookkeeping still completes (no exception leaks)."""
    ws = _make_fake_ws()
    session = _make_fake_session()
    handler = StreamingChatHandler(session, manager)

    # No messages — first receive raises WebSocketDisconnect.
    _queue_messages(ws, [], then_disconnect=True)

    await handler.handle_chat_connection(ws, "s1")

    ws.accept.assert_awaited_once()
    assert "s1" not in manager.session_to_connection


@pytest.mark.asyncio
async def test_handle_chat_connection_unexpected_error_disconnects(manager):
    """Non-WebSocketDisconnect exception in main loop -> manager.disconnect()
    still runs (cleanup branch)."""
    ws = _make_fake_ws()
    session = _make_fake_session()
    handler = StreamingChatHandler(session, manager)

    async def _explode():
        raise RuntimeError("transport blew up")

    ws.receive_text = AsyncMock(side_effect=_explode)

    # Handler must not propagate — its except clause logs & disconnects.
    await handler.handle_chat_connection(ws, "s1")

    assert "s1" not in manager.session_to_connection


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

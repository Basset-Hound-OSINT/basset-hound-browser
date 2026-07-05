"""WebSocket Chat API — Streaming Responses

Implements real-time chat with streaming responses using:
- WebSocket protocol (persistent connection)
- Server-Sent Events fallback (polling)
- Response streaming (token-by-token)
- Connection management and cleanup
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import TYPE_CHECKING

from fastapi import WebSocket, WebSocketDisconnect

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class WebSocketConnectionManager:
    """Manages WebSocket connections for chat sessions."""

    def __init__(self):
        """Initialize connection manager."""
        self.active_connections: dict[str, WebSocket] = {}
        self.session_to_connection: dict[str, str] = {}

    async def connect(self, websocket: WebSocket, session_id: str) -> None:
        """Register new WebSocket connection.

        Args:
            websocket: WebSocket connection
            session_id: Associated chat session ID
        """
        await websocket.accept()

        connection_id = str(uuid.uuid4())
        self.active_connections[connection_id] = websocket
        self.session_to_connection[session_id] = connection_id

        logger.info("WebSocket connected: session=%s, connection=%s", session_id, connection_id)

    async def disconnect(self, session_id: str) -> None:
        """Unregister WebSocket connection.

        Args:
            session_id: Associated chat session ID
        """
        connection_id = self.session_to_connection.pop(session_id, None)
        if connection_id and connection_id in self.active_connections:
            del self.active_connections[connection_id]
            logger.info("WebSocket disconnected: session=%s", session_id)

    async def send_message(self, session_id: str, message: dict) -> None:
        """Send message to client.

        Args:
            session_id: Chat session ID
            message: Message dict
        """
        connection_id = self.session_to_connection.get(session_id)
        if connection_id and connection_id in self.active_connections:
            try:
                await self.active_connections[connection_id].send_json(message)
            except Exception as e:
                logger.exception("Failed to send message to %s: %s", session_id, e)

    async def broadcast_to_session(self, session_id: str, message: dict) -> None:
        """Broadcast message to all connections for a session.

        Args:
            session_id: Chat session ID
            message: Message dict
        """
        await self.send_message(session_id, message)

    async def get_connection(self, session_id: str) -> WebSocket | None:
        """Get WebSocket for session.

        Args:
            session_id: Chat session ID

        Returns:
            WebSocket or None if not connected
        """
        connection_id = self.session_to_connection.get(session_id)
        return self.active_connections.get(connection_id)


class StreamingChatHandler:
    """Handles streaming chat responses over WebSocket."""

    def __init__(
        self,
        chat_session,
        connection_manager: WebSocketConnectionManager,
    ):
        """Initialize chat handler.

        Args:
            chat_session: ChatSession instance
            connection_manager: WebSocketConnectionManager instance
        """
        self.chat_session = chat_session
        self.connection_manager = connection_manager

    async def handle_chat_connection(
        self,
        websocket: WebSocket,
        session_id: str,
    ) -> None:
        """Handle WebSocket chat connection.

        Protocol:
        Client → Server: {"type": "message", "content": "user input"}
        Server → Client: {"type": "thinking" | "token" | "complete", "data": ...}

        Args:
            websocket: WebSocket connection
            session_id: Chat session ID
        """
        await self.connection_manager.connect(websocket, session_id)

        try:
            while True:
                # Receive message from client
                data = await websocket.receive_text()
                message_data = json.loads(data)

                if message_data.get("type") == "message":
                    user_input = message_data.get("content", "").strip()
                    if not user_input:
                        continue

                    # Send thinking indicator
                    await self.connection_manager.send_message(
                        session_id,
                        {
                            "type": "thinking",
                            "data": "Processing...",
                        },
                    )

                    # Generate response with streaming
                    try:
                        response = await self._generate_streaming_response(
                            self.chat_session,
                            user_input,
                            session_id,
                        )

                        # Send completion
                        await self.connection_manager.send_message(
                            session_id,
                            {
                                "type": "complete",
                                "data": {
                                    "content": response,
                                    "sources": (
                                        self.chat_session.history.messages[-1].sources
                                        if self.chat_session.history.messages
                                        else []
                                    ),
                                },
                            },
                        )
                    except Exception as e:
                        logger.exception("Chat generation failed: %s", e)
                        await self.connection_manager.send_message(
                            session_id,
                            {
                                "type": "error",
                                "data": f"Generation failed: {str(e)}",
                            },
                        )

                elif message_data.get("type") == "clear":
                    # Clear history
                    self.chat_session.clear_history()
                    await self.connection_manager.send_message(
                        session_id,
                        {
                            "type": "cleared",
                            "data": "Conversation history cleared",
                        },
                    )

                elif message_data.get("type") == "list_messages":
                    # List messages
                    messages = self.chat_session.get_messages()
                    await self.connection_manager.send_message(
                        session_id,
                        {
                            "type": "messages",
                            "data": [
                                {
                                    "role": m.role,
                                    "content": m.content,
                                    "timestamp": m.timestamp.isoformat() if m.timestamp else None,
                                }
                                for m in messages
                            ],
                        },
                    )

        except WebSocketDisconnect:
            logger.info("Client disconnected: session=%s", session_id)
            await self.connection_manager.disconnect(session_id)
        except Exception as e:
            logger.exception("WebSocket error: %s", e)
            await self.connection_manager.disconnect(session_id)

    async def _generate_streaming_response(
        self,
        session,
        user_input: str,
        session_id: str,
        max_tokens: int = 500,
    ) -> str:
        """Generate response with token streaming.

        Args:
            session: ChatSession instance
            user_input: User message
            session_id: Session ID
            max_tokens: Max response tokens

        Returns:
            Complete response text
        """
        # For now, generate full response then stream tokens
        # In production, would use streaming LLM backend
        response = await session.send_message(user_input, max_tokens=max_tokens)

        # Stream tokens to client
        tokens = response.split()
        accumulated = ""
        for token in tokens:
            accumulated += token + " "
            await self.connection_manager.send_message(
                session_id,
                {
                    "type": "token",
                    "data": token + " ",
                },
            )

        return accumulated.strip()

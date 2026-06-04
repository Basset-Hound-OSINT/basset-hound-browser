import { useEffect, useState, useCallback } from 'react';
import { getWebSocketClient } from '../services/websocket-client';

/**
 * Hook to manage WebSocket connection
 */
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [wsClient] = useState(() => getWebSocketClient());

  useEffect(() => {
    // Check if already connected
    if (wsClient.isConnected) {
      setIsConnected(true);
      return;
    }

    // Connect
    wsClient.connect().catch((err) => {
      console.error('WebSocket connection error:', err);
      setError(err);
    });

    // Listen for connection events
    const unsubscribeConnected = wsClient.on('connected', () => {
      setIsConnected(true);
      setError(null);
    });

    const unsubscribeDisconnected = wsClient.on('disconnected', () => {
      setIsConnected(false);
    });

    const unsubscribeError = wsClient.on('error', (err) => {
      setError(err);
    });

    // Cleanup
    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
      unsubscribeError();
    };
  }, [wsClient]);

  const send = useCallback(
    async (command, params) => {
      return wsClient.send(command, params);
    },
    [wsClient]
  );

  const subscribe = useCallback(
    (command, handler) => {
      return wsClient.subscribe(command, handler);
    },
    [wsClient]
  );

  return {
    isConnected,
    error,
    send,
    subscribe,
    client: wsClient,
  };
}

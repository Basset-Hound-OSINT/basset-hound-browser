import { useState, useEffect } from 'react';
import '../styles/ConnectionStatus.css';

/**
 * Floating connection status indicator
 */
function ConnectionStatus({ isConnected }) {
  const [show, setShow] = useState(!isConnected);
  const [previousStatus, setPreviousStatus] = useState(isConnected);

  useEffect(() => {
    if (isConnected !== previousStatus) {
      setPreviousStatus(isConnected);
      if (!isConnected) {
        setShow(true);
      } else {
        // Show connected message briefly
        setShow(true);
        const timer = setTimeout(() => setShow(false), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [isConnected, previousStatus]);

  if (!show) {
    return null;
  }

  return (
    <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
      <div className="status-content">
        <div className="status-icon">
          {isConnected ? '✓' : '✕'}
        </div>
        <div className="status-text">
          {isConnected ? 'Connected to Basset Hound Server' : 'Disconnected - Attempting to reconnect...'}
        </div>
      </div>
    </div>
  );
}

export default ConnectionStatus;

import { useState, useEffect, useRef, useCallback } from 'react';

interface WebSocketClientProps {
  onMessage: (message: any) => void;
}

interface TestData {
  value: number;
  timestamp?: string;
}

const WebSocketClient: React.FC<WebSocketClientProps> = ({ onMessage }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [lastMessage, setLastMessage] = useState<TestData | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout>();

  // Memoize the message handler to prevent unnecessary reconnections
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      setLastMessage(data);
      onMessage(data);
      setMessageHistory(prev => [...prev.slice(-19), JSON.stringify(data)]);
    } catch (error) {
      setMessageHistory(prev => [...prev.slice(-19), event.data]);
      onMessage(event.data);
    }
  }, [onMessage]);

  // Memoize the WebSocket connection logic
  const connectWebSocket = useCallback(() => {
    try {
      if (ws.current?.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        return;
      }

      ws.current = new WebSocket('ws://127.0.0.1:8000');
      
      ws.current.onopen = () => {
        setIsConnected(true);
        console.log('Connected to WebSocket server');
        // Clear any pending reconnection timeouts
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
        }
      };

      ws.current.onmessage = handleMessage;

      ws.current.onclose = () => {
        setIsConnected(false);
        console.log('Disconnected from WebSocket server');
        // Only attempt to reconnect if we haven't been intentionally closed
        if (ws.current) {
          reconnectTimeout.current = setTimeout(connectWebSocket, 3000);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
      // Attempt to reconnect on error
      reconnectTimeout.current = setTimeout(connectWebSocket, 3000);
    }
  }, [handleMessage]);

  // Set up WebSocket connection
  useEffect(() => {
    connectWebSocket();

    // Cleanup function
    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        const socket = ws.current;
        // Remove all listeners before closing to prevent memory leaks
        socket.onopen = null;
        socket.onclose = null;
        socket.onmessage = null;
        socket.onerror = null;
        // Only close if it's open
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
        ws.current = null;
      }
    };
  }, [connectWebSocket]); // Only reconnect if the connection logic changes

  // Add manual reconnect function
  const handleManualReconnect = () => {
    if (ws.current) {
      ws.current.close();
    }
    connectWebSocket();
  };

  return (
    <div className="space-y-4">
      <div className={`p-3 rounded-lg ${isConnected ? 'bg-green-100' : 'bg-red-100'}`}>
        <div className="flex justify-between items-center">
          <span className="font-medium">
            Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          {!isConnected && (
            <button 
              onClick={handleManualReconnect}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              Reconnect
            </button>
          )}
        </div>
      </div>
      
      {lastMessage && (
        <div className="p-3 bg-gray-100 rounded-lg">
          <div className="font-medium mb-1">Last Message:</div>
          <pre className="text-sm overflow-x-auto">
            {JSON.stringify(lastMessage, null, 2)}
          </pre>
        </div>
      )}
      
      <div className="border rounded-lg">
        <div className="p-3 bg-gray-50 border-b">
          <span className="font-medium">Message History</span>
        </div>
        <div className="max-h-60 overflow-y-auto p-3">
          {messageHistory.map((msg, index) => (
            <div key={index} className="text-sm py-1 border-b last:border-0">
              {msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WebSocketClient;
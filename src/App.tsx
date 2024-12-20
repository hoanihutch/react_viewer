// App.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import TimeSeriesPlot from './components/TimeSeriesPlot';
import ViewerControls from './components/ViewerControls';
import Scene from './components/Scene';

// Message history utilities
const MAX_MESSAGE_LENGTH = 50;

const truncateMessage = (message: string): string => {
  try {
    const parsed = JSON.parse(message);
    const simplified = {
      field: parsed.field,
      type: parsed.type,
      timestamp: parsed.timestamp
    };
    return JSON.stringify(simplified);
  } catch {
    return message.length > MAX_MESSAGE_LENGTH 
      ? `${message.substring(0, MAX_MESSAGE_LENGTH)}...` 
      : message;
  }
};

const updateMessageHistory = (
  history: string[], 
  newMessage: string, 
  maxMessages: number = 5
): string[] => {
  const truncatedMessage = truncateMessage(newMessage);
  return [...history.slice(-(maxMessages - 1)), truncatedMessage];
};

interface SharedData {
  value: Record<string, number>;
  lastUpdate: Date | null;
  status: 'idle' | 'updating' | 'error';
}

interface WebSocketMessage {
  field: string;
  value: number;
  timestamp?: string;
  type?: string;
}

interface WebSocketState {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  messageHistory: string[];
}

interface TabProps {
  title: string;
  isActive: boolean;
  onClick: () => void;
}

const Tab: React.FC<TabProps> = ({ title, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 font-medium rounded-t-lg ${
      isActive 
        ? 'bg-white text-blue-600 border-t border-x border-gray-200' 
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`}
  >
    {title}
  </button>
);

function App() {

  const [sceneVisibility, setSceneVisibility] = useState<{[key: string]: boolean}>({
    wireframe: true,
    values: true
  });
  
  const [selectedValue, setSelectedValue] = useState<string>("");
  
  const [activeTab, setActiveTab] = useState<'websocket' | 'settings' | 'residual' | 'forces' | 'viewer'>('websocket');
  const [sharedData, setSharedData] = useState<SharedData>({
    value: {},
    lastUpdate: null,
    status: 'idle'
  });

  const [wsState, setWsState] = useState<WebSocketState>({
    isConnected: false,
    lastMessage: null,
    messageHistory: []
  });
  
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout>();

  const [backgroundSceneVisibility, setBackgroundSceneVisibility] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    const newVisibility: {[key: string]: boolean} = {};
    
    if (sharedData.value?.mesh) {
      newVisibility.wireframe = true;
      newVisibility.values = true;  // Add values visibility
    }
    
    if (sharedData.value?.geometry) {
      Object.keys(sharedData.value.geometry).forEach(key => {
        newVisibility[key] = true;
      });
    }

    if (sharedData.value?.value_on_mesh) {
      newVisibility.values = true;  // Ensure values visibility is set if value_on_mesh exists
    }

    setBackgroundSceneVisibility(newVisibility);
  }, [sharedData.value?.geometry, sharedData.value?.mesh, sharedData.value?.value_on_mesh]); 

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
  
      setWsState(prev => ({
        ...prev,
        lastMessage: data,
        messageHistory: updateMessageHistory(prev.messageHistory, event.data)
      }));
  
      setSharedData(prev => {
        if (data.type === 'append' && prev.value[data.field]) {
          const updatedValue = { ...prev.value[data.field] };
  
          Object.keys(data.value).forEach(key => {
            if (Array.isArray(data.value[key])) {
              updatedValue[key] = (updatedValue[key] || []).concat(data.value[key]);
            }
          });
  
          return {
            ...prev,
            value: {
              ...prev.value,
              [data.field]: updatedValue
            },
            lastUpdate: new Date(),
            status: 'updating'
          };
        }
  
        return {
          ...prev,
          value: {
            ...prev.value,
            [data.field]: {
              ...prev.value[data.field],
              ...data.value
            }
          },
          lastUpdate: new Date(),
          status: 'updating'
        };
      });
  
      setTimeout(() => {
        setSharedData(prev => ({
          ...prev,
          status: 'idle'
        }));
      }, 1000);
    } catch (error) {
      console.error('Error handling message:', error);
      setSharedData(prev => ({
        ...prev,
        status: 'error'
      }));
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    try {
      if (ws.current?.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        return;
      }

      ws.current = new WebSocket('ws://127.0.0.1:8000');
      
      ws.current.onopen = () => {
        setWsState(prev => ({ ...prev, isConnected: true }));
        console.log('Connected to WebSocket server');
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
        }
      };

      ws.current.onmessage = handleMessage;

      ws.current.onclose = () => {
        setWsState(prev => ({ ...prev, isConnected: false }));
        console.log('Disconnected from WebSocket server');
        if (ws.current) {
          reconnectTimeout.current = setTimeout(connectWebSocket, 3000);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsState(prev => ({ ...prev, isConnected: false }));
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setWsState(prev => ({ ...prev, isConnected: false }));
      reconnectTimeout.current = setTimeout(connectWebSocket, 3000);
    }
  }, [handleMessage]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        const socket = ws.current;
        socket.onopen = null;
        socket.onclose = null;
        socket.onmessage = null;
        socket.onerror = null;
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
        ws.current = null;
      }
    };
  }, [connectWebSocket]);

  const handleManualReconnect = () => {
    if (ws.current) {
      ws.current.close();
    }
    connectWebSocket();
  };

  //shared slider state
  const [startIndex, setStartIndex] = useState(0);
  const maxLength = Math.max(
    ...(sharedData.value.res ? Object.values(sharedData.value.res).map(arr => arr.length) : [0]),
    ...(sharedData.value.force ? Object.values(sharedData.value.force).map(arr => arr.length) : [0])
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'websocket':
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              WebSocket Connection
            </h2>
            <div className="space-y-4">
              <div className={`p-3 rounded-lg ${wsState.isConnected ? 'bg-green-100' : 'bg-red-100'}`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    Status: {wsState.isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                  </span>
                  {!wsState.isConnected && (
                    <button 
                      onClick={handleManualReconnect}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    >
                      Reconnect
                    </button>
                  )}
                </div>
              </div>
              
              {wsState.lastMessage && (
                <div className="p-3 bg-gray-100 rounded-lg">
                  <div className="font-medium mb-1">Last Message:</div>
                  <pre className="text-sm overflow-x-auto">
                    {JSON.stringify(wsState.lastMessage, null, 2)}
                  </pre>
                </div>
              )}
              
              <div className="border rounded-lg">
                <div className="p-3 bg-gray-50 border-b">
                  <span className="font-medium">Message History</span>
                </div>
                <div className="max-h-60 overflow-y-auto p-3">
                  {wsState.messageHistory.map((msg, index) => (
                    <div key={index} className="text-sm py-1 border-b last:border-0">
                      {msg}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Settings
            </h2>
            <div className="text-gray-600">
              Settings panel content goes here...
            </div>
          </div>
        );

      case 'residual':
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Residual
            </h2>
            <div className="text-gray-600">
              {sharedData.value && 'res' in sharedData.value ? (
                <TimeSeriesPlot 
                  key="residual-plot"
                  data={sharedData.value.res}
                  title="Residuals"
                  yAxisLabel="Residual"
                  startIndex={startIndex}
                  onStartIndexChange={setStartIndex}
                  maxLength={maxLength}
                />
              ) : (
                <div className="p-4 text-gray-500">No data available</div>
              )}
            </div>
          </div>
        );
      
      case 'forces':
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Forces
            </h2>
            <div className="text-gray-600">
              {sharedData.value && 'force' in sharedData.value ? (
                <TimeSeriesPlot 
                  key="forces-plot"
                  data={sharedData.value.force}
                  title="Forces"
                  yAxisLabel="Force"
                  startIndex={startIndex}
                  onStartIndexChange={setStartIndex}
                  maxLength={maxLength}
                />
              ) : (
                <div className="p-4 text-gray-500">No data available</div>
              )}
            </div>
          </div>
        );

        case 'viewer':
          return (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Viewer Controls
              </h2>
              <div className="text-gray-600">
                <ViewerControls 
                  mesh={sharedData.value.mesh}
                  geometry={sharedData.value.geometry}
                  value_on_mesh={sharedData.value.value_on_mesh}
                  visibility={sceneVisibility}
                  selectedValue={selectedValue}
                  onVisibilityChange={setSceneVisibility}
                  onSelectedValueChange={setSelectedValue}
                />
              </div>
            </div>
          );

      default:
        return null;
    }
  };

  return (
    <div className="w-full h-screen relative">
      {/* Scene Container - Full screen with pointer events */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [5, 5, 5], fov: 60 }}>
          <OrbitControls makeDefault />
          {sharedData.value && (
            <Scene
              mesh={sharedData.value.mesh}
              geometry={sharedData.value.geometry}
              valueOnMesh={sharedData.value.value_on_mesh}
              visibility={sceneVisibility}
              selectedValue={selectedValue}
            />
          )}
        </Canvas>
      </div>

      {/* Controls Container - Floating on top */}
      <div className="absolute inset-x-0 top-0 z-10 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Tabs */}
          <div className="flex space-x-2 mb-[-1px]">
            <Tab 
              title="WebSocket" 
              isActive={activeTab === 'websocket'} 
              onClick={() => setActiveTab('websocket')} 
            />
            <Tab 
              title="Settings" 
              isActive={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
            />
            <Tab 
              title="Residual" 
              isActive={activeTab === 'residual'} 
              onClick={() => setActiveTab('residual')} 
            />
            <Tab 
              title="Forces" 
              isActive={activeTab === 'forces'} 
              onClick={() => setActiveTab('forces')} 
            />
            <Tab 
              title="Viewer Controls" 
              isActive={activeTab === 'viewer'} 
              onClick={() => setActiveTab('viewer')} 
            />
          </div>

          {/* Tab Content */}
          <div className="border border-gray-200 rounded-lg rounded-tl-none bg-white/90 backdrop-blur-sm">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
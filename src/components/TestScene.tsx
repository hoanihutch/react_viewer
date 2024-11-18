import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useState, useEffect, useRef } from 'react'

interface TestData {
  type: string;
  data: {
    message: string;
    timestamp: number;
  };
}

const TestScene = () => {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<TestData | null>(null)
  const [messageHistory, setMessageHistory] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    // Create WebSocket connection
    wsRef.current = new WebSocket('ws://127.0.0.1:8000')
    
    wsRef.current.onopen = () => {
      setIsConnected(true)
      console.log('Connected to Julia server')
    }

    wsRef.current.onmessage = (event) => {
      try {
        // Handle both JSON and plain text messages
        try {
          const data = JSON.parse(event.data) as TestData
          setLastMessage(data)
          console.log('Received JSON:', data)
        } catch {
          // If not JSON, treat as plain text
          setMessageHistory(prev => [...prev, event.data])
          console.log('Received text:', event.data)
        }
      } catch (e) {
        console.error('Error handling message:', e)
      }
    }

    wsRef.current.onclose = () => {
      setIsConnected(false)
      console.log('Disconnected from Julia server')
    }

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, []) // Empty dependency array means this runs once on mount

  const sendTestMessage = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send('Test message from client')
    }
  }

  return (
    <div className="w-full h-screen">
      <div className="absolute top-0 left-0 p-4 z-10 bg-white/80 space-y-2">
        <div>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
        
        <button 
          onClick={sendTestMessage}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Send Test Message
        </button>

        {lastMessage && (
          <div className="text-sm">
            <div>JSON Message: {lastMessage.data.message}</div>
            <div>Time: {new Date(lastMessage.data.timestamp * 1000).toLocaleTimeString()}</div>
          </div>
        )}

        {messageHistory.length > 0 && (
          <div className="text-sm mt-2">
            <div>Text Messages:</div>
            <div className="max-h-32 overflow-y-auto">
              {messageHistory.map((msg, index) => (
                <div key={index} className="text-gray-600">
                  {msg}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Canvas 
  shadows
  camera={{ position: [-5, 5, 5] }}
>
        <OrbitControls />
        <ambientLight intensity={0.5} /> {/* Reduced intensity */}
        <directionalLight
          position={[-5, 5, 5]}
          castShadow
          intensity={1}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-radius={8} // Add shadow blur
          shadow-bias={-0.0001}
        />
        <mesh
          castShadow
          receiveShadow
          position={[0, 0, 0]}
          rotation={[0, Math.PI / 4, 0]} // Rotate 45 degrees for better view
        >
          <boxGeometry args={[2, 2, 2]} /> {/* Larger cube */}
          <meshStandardMaterial 
            color={isConnected ? "#00ff00" : "#ff0000"}
            metalness={0.1}
            roughness={0.8}
          />
        </mesh>
        <mesh 
          receiveShadow 
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[0, -10, 0]}
        >
          <planeGeometry args={[50, 50]} /> {/* Larger plane */}
          <meshStandardMaterial 
            color="#ffffff"
            metalness={0}
            roughness={1}
            opacity={0.5}
            transparent
          />
        </mesh>
      </Canvas>
    </div>
  )
}

export default TestScene
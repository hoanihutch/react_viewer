import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

interface Point extends Array<number> {
  0: number;
  1: number;
  [key: number]: number;
}

interface MeshData {
  dx: number;
  normal: [number, number, number];
  points: Point[];
}

type GeometryData = {
  [key: string]: [Point, Point][];
}

interface MeshValues {
  [key: string]: number[];
}

interface ViewerProps {
  mesh?: {
    [key: string]: MeshData;
  };
  geometry?: GeometryData;
  value_on_mesh?: MeshValues;
}

const COLORS = {
  north: '#0000ff',    // Blue
  south: '#ff0000',    // Red
  east: '#00ff00',     // Green
  west: '#ff00ff',     // Magenta
  cylinder: '#000000', // Black
  wireframe: '#000000',// Black
  default: '#808080'   // Gray
};

// Function to map value to color using a gradient
const getColorForValue = (value: number, min: number, max: number): { color: string; alpha: number } => {
  const normalized = (value - min) / (max - min);
  let r, g, b, alpha;

  if (normalized < 0.5) {
    const factor = normalized * 2;
    r = Math.floor(factor * 255);
    g = Math.floor(factor * 255);
    b = 255;
  } else {
    const factor = (normalized - 0.5) * 2;
    r = 255;
    g = Math.floor((1 - factor) * 255);
    b = Math.floor((1 - factor) * 255);
  }

  alpha = normalized < 0.25 || normalized > 0.75 ? 1.0 : 
          normalized < 0.5 ? (0.5 - normalized) * 4 :
          (normalized - 0.5) * 4;

  return {
    color: `rgb(${r}, ${g}, ${b})`,
    alpha
  };
};

const Legend: React.FC<{
  items: { name: string; color: string; visible: boolean; }[];
  onToggle: (name: string) => void;
  meshValues?: string[];
  selectedValue?: string;
  onValueSelect?: (value: string) => void;
  valueRange?: { min: number; max: number } | null;
}> = ({ items, onToggle, meshValues = [], selectedValue, onValueSelect, valueRange }) => (
  <div className="bg-white p-4 rounded shadow-lg h-full flex flex-col">
    <h3 className="text-lg font-bold mb-4">Legend</h3>
    
    {meshValues.length > 0 && (
      <div className="mb-4">
        <h4 className="font-semibold mb-2">Mesh Values</h4>
        <select 
          value={selectedValue} 
          onChange={(e) => onValueSelect?.(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="">None</option>
          {meshValues.map(value => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        
        {valueRange && selectedValue && (
          <div className="mt-2 text-sm">
            <div className="flex justify-between">
              <span>{valueRange.min.toFixed(2)}</span>
              <span>{valueRange.max.toFixed(2)}</span>
            </div>
            <div className="h-4 w-full rounded mt-1"
              style={{
                background: 'linear-gradient(to right, #0000ff, #ffffff, #ff0000)'
              }}
            />
          </div>
        )}
      </div>
    )}

    <div className="space-y-3">
      {items.map(({ name, color, visible }) => (
        <div key={name} className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={visible}
            onChange={() => onToggle(name)}
            className="w-4 h-4"
          />
          <div 
            className="w-4 h-4 border border-gray-300"
            style={{ backgroundColor: color }}
          />
          <span className="capitalize">{name}</span>
        </div>
      ))}
    </div>
  </div>
);

const Scene: React.FC<{
  mesh?: ViewerProps['mesh'];
  geometry?: ViewerProps['geometry'];
  valueOnMesh?: ViewerProps['value_on_mesh'];
  visibility: { [key: string]: boolean };
  selectedValue?: string;
}> = ({ mesh, geometry, valueOnMesh, visibility, selectedValue }) => {
  let valueRange = null;
  if (selectedValue && valueOnMesh?.[selectedValue]) {
    const values = valueOnMesh[selectedValue];
    valueRange = {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  return (
    <>
      <OrbitControls />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 10]} intensity={0.5} />
      {/* <gridHelper args={[20, 20]} /> */}
      {/* <axesHelper args={[5]} /> */}

      {/* Render mesh wireframes and colored faces */}
      {mesh && visibility.wireframe && Object.values(mesh).map((meshData, meshIndex) => (
        meshData.points.map((point, pointIndex) => {
          const key = `mesh-${meshIndex}-${pointIndex}`;
          const colorValue = selectedValue && valueOnMesh?.[selectedValue]?.[pointIndex];
          const color = colorValue !== undefined && valueRange
            ? getColorForValue(colorValue, valueRange.min, valueRange.max)
            : { color: '#ffffff', alpha: 0.5 };

          // Calculate corner points for the cell
          const halfDx = meshData.dx / 2;
          const corners = [
            [-halfDx, -halfDx], // Bottom-left
            [halfDx, -halfDx],  // Bottom-right
            [halfDx, halfDx],   // Top-right
            [-halfDx, halfDx],  // Top-left
          ];

          // Create line segments for all edges of the cell
          const linePositions = [];
          
          // Horizontal lines
          for (let i = 0; i < corners.length; i++) {
            const start = corners[i];
            const end = corners[(i + 1) % corners.length];
            linePositions.push(
              start[0], start[1], 0,
              end[0], end[1], 0
            );
          }

          return (
            <group key={key} position={[point[0], point[1], 0]}>
              {/* Wireframe */}
              <lineSegments>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    count={8} // 4 lines, 2 points each
                    array={new Float32Array(linePositions)}
                    itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial color={COLORS.wireframe} />
              </lineSegments>

              {/* Colored face */}
              {visibility.values && (
                <mesh position={[0, 0, -0.001]}>
                  <planeGeometry args={[meshData.dx, meshData.dx]} />
                  <meshBasicMaterial 
                    color={color.color}
                    transparent
                    opacity={color.alpha}
                  />
                </mesh>
              )}
            </group>
          );
        })
      ))}

      {/* Render geometry lines */}
      {geometry && Object.entries(geometry).map(([name, lines]) => (
        visibility[name] && lines.map((line, lineIndex) => {
          const [start, end] = line;
          return (
            <line key={`${name}-${lineIndex}`}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([
                    start[0], start[1], 0,
                    end[0], end[1], 0
                  ])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color={COLORS[name as keyof typeof COLORS] || COLORS.default} />
            </line>
          );
        })
      ))}
    </>
  );
};

const Viewer: React.FC<ViewerProps> = ({ mesh, geometry, value_on_mesh }) => {
  const [selectedValue, setSelectedValue] = useState<string>("");
  const [valueRange, setValueRange] = useState<{ min: number; max: number } | null>(null);
  const [visibility, setVisibility] = useState<{ [key: string]: boolean }>(() => {
    const initial: { [key: string]: boolean } = { 
      wireframe: true,
      values: true 
    };
    if (geometry) {
      Object.keys(geometry).forEach(key => {
        initial[key] = true;
      });
    }
    return initial;
  });

  const toggleVisibility = (name: string) => {
    setVisibility(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // Update value range when selected value changes
  React.useEffect(() => {
    if (selectedValue && value_on_mesh?.[selectedValue]) {
      const values = value_on_mesh[selectedValue];
      setValueRange({
        min: Math.min(...values),
        max: Math.max(...values)
      });
    } else {
      setValueRange(null);
    }
  }, [selectedValue, value_on_mesh]);

  const legendItems = [
    { name: 'wireframe', color: COLORS.wireframe, visible: visibility.wireframe },
    ...Object.keys(geometry || {}).map(name => ({
      name,
      color: COLORS[name as keyof typeof COLORS] || COLORS.default,
      visible: visibility[name]
    }))
  ];

  if (selectedValue) {
    legendItems.push({
      name: 'values',
      color: COLORS.default,
      visible: visibility.values
    });
  }

  return (
    <div className="flex w-full h-[calc(100vh-12rem)] gap-4">
      <div className="flex-1 relative bg-gray-100 rounded-lg overflow-hidden">
        <Canvas
          camera={{ position: [5, 5, 5], fov: 60 }}
        >
          <Scene
            mesh={mesh}
            geometry={geometry}
            valueOnMesh={value_on_mesh}
            visibility={visibility}
            selectedValue={selectedValue}
          />
        </Canvas>
      </div>
      <div className="w-64">
        <Legend 
          items={legendItems}
          onToggle={toggleVisibility}
          meshValues={Object.keys(value_on_mesh || {})}
          selectedValue={selectedValue}
          onValueSelect={setSelectedValue}
          valueRange={valueRange}
        />
      </div>
    </div>
  );
};

export default Viewer;
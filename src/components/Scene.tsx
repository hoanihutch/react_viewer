import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { COLORS } from './ViewerControls';

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
    [key: string]: {
      [meshKey: string]: number[];  // Values for each mesh's points
    }
  }

interface SceneProps {
  mesh?: {
    [key: string]: MeshData;
  };
  geometry?: GeometryData;
  valueOnMesh?: MeshValues;
  visibility: { [key: string]: boolean };
  selectedValue?: string;
}

const MeshCell: React.FC<{
    point: Point;
    dx: number;
    colorValue?: number;
    valueRange?: { min: number; max: number };
    showWireframe: boolean;
    showValues: boolean;
  }> = React.memo(({ point, dx, colorValue, valueRange, showWireframe, showValues }) => {

    const halfDx = useMemo(() => dx / 2, [dx]);
    
    const linePositions = useMemo(() => {
      const corners = [
        [-halfDx, -halfDx],
        [halfDx, -halfDx],
        [halfDx, halfDx],
        [-halfDx, halfDx],
      ];
      
      const positions = [];
      for (let i = 0; i < corners.length; i++) {
        const start = corners[i];
        const end = corners[(i + 1) % corners.length];
        positions.push(start[0], start[1], 0, end[0], end[1], 0);
      }
      return new Float32Array(positions);
    }, [halfDx]);
  
    const color = useMemo(() => {
      if (colorValue === undefined || !valueRange) {
        return { color: 'pink', alpha: 1.0 };
      }

      // Ensure the value is within the range
      const clampedValue = Math.max(valueRange.min, Math.min(valueRange.max, colorValue));
      const normalized = (clampedValue - valueRange.min) / (valueRange.max - valueRange.min);
      
      let r, g, b;
      if (normalized < 0.5) {
        const factor = normalized * 2;
        r = Math.floor(255 * factor);
        g = Math.floor(255 * factor);
        b = 255;
      } else {
        const factor = (normalized - 0.5) * 2;
        r = 255;
        g = Math.floor(255 * (1 - factor));
        b = Math.floor(255 * (1 - factor));
      }

      return {
        color: `rgb(${r}, ${g}, ${b})`,
        alpha: 0.7
      };
    }, [colorValue, valueRange]);
  
    return (
      <group position={[point[0], point[1], 0]}>
        {showValues && (
          <mesh position={[0, 0, -0.001]}>
            <planeGeometry args={[dx, dx]} />
            <meshBasicMaterial 
              color={color.color}
              transparent
              opacity={color.alpha}
              depthWrite={false}
            />
          </mesh>
        )}
        
        {showWireframe && (
          <lineSegments>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={8}
                array={linePositions}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color={COLORS.wireframe} />
          </lineSegments>
        )}
      </group>
    );
  });
  
const Scene: React.FC<SceneProps> = ({ 
  mesh, 
  geometry, 
  valueOnMesh, 
  visibility, 
  selectedValue 
}) => {
      // Log the full structures
//   console.log('Full mesh structure:', mesh);
//   console.log('Full valueOnMesh structure:', valueOnMesh);
//   console.log('Selected value:', selectedValue);

    const valueRange = useMemo(() => {
        if (!selectedValue || !valueOnMesh?.[selectedValue]) return undefined;
        
        // Collect all values across all meshes
        const allValues = Object.values(valueOnMesh[selectedValue]).flat();
        return {
          min: Math.min(...allValues),
          max: Math.max(...allValues)
        };
      }, [selectedValue, valueOnMesh]);

  const sceneRef = useRef<THREE.Group>(null);

  return (
    <group ref={sceneRef}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 10, 10]} intensity={0.5} />

      {mesh && Object.entries(mesh).map(([key, meshData], meshIndex) => (
        <group key={`mesh-${key}`}>
          {meshData.points.map((point, pointIndex) => {
            const colorValue = selectedValue && valueOnMesh?.[selectedValue]?.[key]?.[pointIndex];
            
            return (
              <MeshCell
                key={`cell-${key}-${pointIndex}`}
                point={point}
                dx={meshData.dx}
                colorValue={colorValue}
                valueRange={valueRange}
                showWireframe={visibility.wireframe}
                showValues={visibility.values && selectedValue !== undefined}
              />
            );
          })}
        </group>
      ))}

      {geometry && Object.entries(geometry).map(([name, lines]) => (
        visibility[name] && lines.map((line, lineIndex) => {
          const [start, end] = line;
          const positions = new Float32Array([
            start[0], start[1], 0,
            end[0], end[1], 0
          ]);

          return (
            <line key={`${name}-${lineIndex}`}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={positions}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color={COLORS[name as keyof typeof COLORS] || COLORS.default} />
            </line>
          );
        })
      ))}
    </group>
  );
};

export default Scene;
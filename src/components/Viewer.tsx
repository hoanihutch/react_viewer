import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

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
  north: 0x0000ff,    // Blue
  south: 0xff0000,    // Red
  east: 0x00ff00,     // Green
  west: 0xff00ff,     // Magenta
  cylinder: 0x000000, // Black
  wireframe: 0x000000,// Black
  default: 0x808080   // Gray
};

// Function to map value to color using a gradient
const getColorForValue = (value: number, min: number, max: number): { color: THREE.Color; alpha: number } => {
  const normalized = (value - min) / (max - min);
  let r, g, b, alpha;

  // Color mapping (blue -> white -> red)
  if (normalized < 0.5) {
    // Blue to white (0 -> 0.5)
    const factor = normalized * 2; // Scale to 0-1 range
    r = factor;
    g = factor;
    b = 1;
  } else {
    // White to red (0.5 -> 1)
    const factor = (normalized - 0.5) * 2; // Scale to 0-1 range
    r = 1;
    g = 1 - factor;
    b = 1 - factor;
  }

  // Alpha channel calculation
  // 0.5 -> 0.0 alpha
  // 0.25 and 0.75 -> 1.0 alpha
  if (normalized < 0.25) {
    // 0.0 -> 0.25: increase from 0.0 to 1.0
    // alpha = normalized * 4;
    alpha = 1.0
  } else if (normalized < 0.5) {
    // 0.25 -> 0.5: decrease from 1.0 to 0.0
    alpha = (0.5 - normalized) * 4;
  } else if (normalized < 0.75) {
    // 0.5 -> 0.75: increase from 0.0 to 1.0
    alpha = (normalized - 0.5) * 4;
  } else {
    // 0.75 -> 1.0: decrease from 1.0 to 0.0
    // alpha = (1 - normalized) * 4;
    alpha = 1.0
  }

  return {
    color: new THREE.Color(r, g, b),
    alpha: alpha
  };
};

const Legend: React.FC<{
  items: { name: string; color: number; visible: boolean; }[];
  onToggle: (name: string) => void;
  meshValues?: string[];
  selectedValue?: string;
  onValueSelect?: (value: string) => void;
  valueRange?: { min: number; max: number } | null;
}> = ({ items, onToggle, meshValues = [], selectedValue, onValueSelect, valueRange }) => {
  return (
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
                  background: 'linear-gradient(to right, #ff0000, #0000ff)'
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
              style={{ backgroundColor: `#${color.toString(16).padStart(6, '0')}` }}
            />
            <span className="capitalize">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Viewer: React.FC<ViewerProps> = ({ mesh = {}, geometry = {}, value_on_mesh = {} }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const wireframeRef = useRef<THREE.Line[]>([]);
  const coloredMeshRef = useRef<THREE.Mesh[]>([]);
  const objectsRef = useRef<{ [key: string]: THREE.Object3D[] }>({});

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
    setVisibility(prev => {
      const newVisibility = { ...prev, [name]: !prev[name] };
      if (name === 'wireframe') {
        wireframeRef.current.forEach(obj => {
          obj.visible = newVisibility[name];
        });
      } else if (name === 'values') {
        coloredMeshRef.current.forEach(obj => {
          obj.visible = newVisibility[name];
        });
      } else if (objectsRef.current[name]) {
        objectsRef.current[name].forEach(obj => {
          obj.visible = newVisibility[name];
        });
      }
      return newVisibility;
    });
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(5, 5, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    objectsRef.current = {};
    wireframeRef.current = [];
    coloredMeshRef.current = [];

    if (mesh && Object.keys(mesh).length > 0) {
      Object.values(mesh).forEach((meshData) => {
        const { dx, normal, points } = meshData;
        
        if (points && points.length > 0) {
          points.forEach((point) => {
            // Create wireframe
            const wireframeVertices = new Float32Array([
              -dx/2, -dx/2, 0,
               dx/2, -dx/2, 0,
               dx/2,  dx/2, 0,
              -dx/2,  dx/2, 0,
              -dx/2, -dx/2, 0
            ]);

            const wireframeGeometry = new THREE.BufferGeometry();
            wireframeGeometry.setAttribute('position', new THREE.BufferAttribute(wireframeVertices, 3));

            const wireframe = new THREE.Line(
              wireframeGeometry,
              new THREE.LineBasicMaterial({ 
                color: COLORS.wireframe,
                linewidth: 1
              })
            );

            // Create colored mesh
            const planeGeometry = new THREE.PlaneGeometry(dx, dx);
            const material = new THREE.MeshBasicMaterial({ 
              color: 0xffffff,
              transparent: true,
              opacity: 0.5,
              side: THREE.DoubleSide
            });
            
            const plane = new THREE.Mesh(planeGeometry, material);
            
            // Position both
            wireframe.position.set(point[0], point[1], 0);
            plane.position.set(point[0], point[1], -0.001); // Slightly behind wireframe
            
            if (normal[0] !== 0 || normal[1] !== 0 || normal[2] !== 1) {
              const normalVector = new THREE.Vector3(...normal);
              const up = new THREE.Vector3(0, 0, 1);
              const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normalVector.normalize());
              wireframe.quaternion.copy(quaternion);
              plane.quaternion.copy(quaternion);
            }

            scene.add(wireframe);
            scene.add(plane);
            wireframeRef.current.push(wireframe);
            coloredMeshRef.current.push(plane);
          });
        }
      });
    }

    if (geometry && Object.keys(geometry).length > 0) {
      Object.entries(geometry).forEach(([name, simplices]) => {
        objectsRef.current[name] = [];
        
        const positions: number[] = [];
        
        simplices.forEach(simplex => {
          const [start, end] = simplex;
          positions.push(start[0], start[1], 0);
          positions.push(end[0], end[1], 0);
        });

        if (positions.length > 0) {
          const lineGeometry = new THREE.BufferGeometry();
          lineGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3)
          );

          const color = COLORS[name as keyof typeof COLORS] || COLORS.default;
          const lineWidth = name === 'cylinder' ? 1 : 2;
          
          const line = new THREE.LineSegments(
            lineGeometry,
            new THREE.LineBasicMaterial({ 
              color: color,
              linewidth: lineWidth
            })
          );

          scene.add(line);
          objectsRef.current[name].push(line);
        }
      });
    }

    // Apply initial visibility
    Object.entries(visibility).forEach(([name, isVisible]) => {
      if (name === 'wireframe') {
        wireframeRef.current.forEach(obj => {
          obj.visible = isVisible;
        });
      } else if (name === 'values') {
        coloredMeshRef.current.forEach(obj => {
          obj.visible = isVisible;
        });
      } else if (objectsRef.current[name]) {
        objectsRef.current[name].forEach(obj => {
          obj.visible = isVisible;
        });
      }
    });

    const animate = () => {
      requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && cameraRef.current && sceneRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      
      cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && rendererRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      scene.clear();
    };
  }, [mesh, geometry]);

  // Update colors when selected value changes
  useEffect(() => {
    if (!selectedValue || !value_on_mesh[selectedValue]) {
      coloredMeshRef.current.forEach(mesh => {
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.opacity = 0;
      });
      setValueRange(null);
      return;
    }

    const values = value_on_mesh[selectedValue];
    const min = Math.min(...values);
    const max = Math.max(...values);
    setValueRange({ min, max });

    values.forEach((value, i) => {
      const mesh = coloredMeshRef.current[i];
      if (mesh) {
        const material = mesh.material as THREE.MeshBasicMaterial;
        const { color, alpha } = getColorForValue(value, min, max);
        material.color.set(color);
        material.opacity = alpha;
        material.needsUpdate = true;
      }
    });
  }, [selectedValue, value_on_mesh]);

  const legendItems = [
    { name: 'wireframe', color: COLORS.wireframe, visible: visibility.wireframe },
    ...Object.keys(geometry).map(name => ({
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
    <div className="flex w-full h-screen gap-4 p-4">
      <div ref={containerRef} className="flex-1 rounded-lg overflow-hidden" />
      <div className="w-64">
        <Legend 
          items={legendItems}
          onToggle={toggleVisibility}
          meshValues={Object.keys(value_on_mesh)}
          selectedValue={selectedValue}
          onValueSelect={setSelectedValue}
          valueRange={valueRange}
        />
      </div>
    </div>
  );
};

export default Viewer;
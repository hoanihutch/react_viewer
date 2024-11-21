import React from 'react';

export const COLORS = {
    north: '#0000ff',    // Blue
    south: '#ff0000',    // Red
    east: '#00ff00',     // Green
    west: '#ff00ff',     // Magenta
    cylinder: '#000000', // Black
    wireframe: '#000000',// Black
    default: '#808080',  // Gray
    values: '#4287f5'    // Light blue for value visualization
  };
  
  export interface ViewerControlsProps {
    mesh?: {
      [key: string]: {
        dx: number;
        normal: [number, number, number];
        points: Array<[number, number]>;
      };
    };
    geometry?: {
      [key: string]: Array<[[number, number], [number, number]]>;
    };
    value_on_mesh?: {
      [key: string]: number[];
    };
    visibility: { [key: string]: boolean };
    selectedValue: string;
    onVisibilityChange: (visibility: { [key: string]: boolean }) => void;
    onSelectedValueChange: (value: string) => void;
  }

interface LegendProps {
  items: { name: string; color: string; visible: boolean; }[];
  onToggle: (name: string) => void;
  meshValues?: string[];
  selectedValue?: string;
  onValueSelect?: (value: string) => void;
  valueRange?: { min: number; max: number } | null;
}

const Legend: React.FC<LegendProps> = ({ 
  items, 
  onToggle, 
  meshValues = [], 
  selectedValue, 
  onValueSelect, 
  valueRange 
}) => (
  <div className="bg-white/95 p-4 rounded shadow-lg">
    <h3 className="text-lg font-bold mb-4">Scene Controls</h3>
    
    {meshValues.length > 0 && (
      <div className="mb-4">
        <h4 className="font-semibold mb-2">Mesh Values</h4>
        <select 
          value={selectedValue} 
          onChange={(e) => onValueSelect?.(e.target.value)}
          className="w-full p-2 border rounded bg-white"
        >
          <option value="">None</option>
          {meshValues.map(value => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        
        {valueRange && selectedValue && (
          <div className="mt-2 text-sm">
            <div className="flex justify-between text-gray-700">
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
            id={`toggle-${name}`}
            checked={visible}
            onChange={() => onToggle(name)}
            className="w-4 h-4 cursor-pointer"
          />
          <div 
            className="w-4 h-4 border border-gray-300 rounded"
            style={{ backgroundColor: color }}
          />
          <label 
            htmlFor={`toggle-${name}`}
            className="capitalize cursor-pointer text-gray-700"
          >
            {name}
          </label>
        </div>
      ))}
    </div>
  </div>
);

const ViewerControls: React.FC<ViewerControlsProps> = ({
  mesh,
  geometry,
  value_on_mesh,
  visibility,
  selectedValue,
  onVisibilityChange,
  onSelectedValueChange,
}) => {
  const toggleVisibility = (name: string) => {
    onVisibilityChange({
      ...visibility,
      [name]: !visibility[name]
    });
  };

  // Calculate value range if a value is selected
  const valueRange = selectedValue && value_on_mesh?.[selectedValue] ? {
    min: Math.min(...value_on_mesh[selectedValue]),
    max: Math.max(...value_on_mesh[selectedValue])
  } : null;

  // Build legend items
  const legendItems = [
    { name: 'wireframe', color: COLORS.wireframe, visible: visibility.wireframe },
    ...(geometry ? Object.keys(geometry).map(name => ({
      name,
      color: COLORS[name as keyof typeof COLORS] || COLORS.default,
      visible: visibility[name] ?? false
    })) : [])
  ];

  // Add values control if a value is selected
  if (value_on_mesh && Object.keys(value_on_mesh).length > 0) {
    legendItems.push({
      name: 'values',
      color: COLORS.values,
      visible: visibility.values ?? false
    });
  }

  return (
    <Legend 
      items={legendItems}
      onToggle={toggleVisibility}
      meshValues={Object.keys(value_on_mesh || {})}
      selectedValue={selectedValue}
      onValueSelect={onSelectedValueChange}
      valueRange={valueRange}
    />
  );
};

export default ViewerControls;
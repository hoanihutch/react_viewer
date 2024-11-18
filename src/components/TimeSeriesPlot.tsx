import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface TimeSeriesPlotProps {
  data: {
    [key: string]: number[];
  };
  title?: string;
  yAxisLabel?: string;
  startIndex: number;
  onStartIndexChange: (index: number) => void;
  maxLength: number;
}

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#4f46e5'];

const formatScientific = (value: number): string => {
  if (value === null || isNaN(value)) return 'N/A';
  return value.toExponential(3);
};

const TimeSeriesPlot: React.FC<TimeSeriesPlotProps> = ({
  data,
  title = 'Time Series Plot',
  yAxisLabel = 'Value',
  startIndex,
  onStartIndexChange,
  maxLength,
}) => {
  // Local states for this instance
  const [scale, setScale] = useState<'linear' | 'log'>('linear');
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(new Set(Object.keys(data)));

  try {
    if (!data || typeof data !== 'object') {
      console.error('Invalid data format:', data);
      return <div>Error: Invalid data format</div>;
    }

    if (maxLength === 0) {
      return <div>No data to display</div>;
    }

    const transformedData = Array.from(
      { length: maxLength - startIndex }, 
      (_, i) => {
        const index = i + startIndex;
        const point: { [key: string]: any } = { index };
        Object.entries(data).forEach(([name, values]) => {
          if (visibleSeries.has(name)) {
            const value = values?.[index];
            point[name] = value !== undefined ? Number(value) : null;
          }
        });
        return point;
      }
    );

    const toggleSeries = (seriesName: string) => {
      const newVisibleSeries = new Set(visibleSeries);
      if (newVisibleSeries.has(seriesName)) {
        newVisibleSeries.delete(seriesName);
      } else {
        newVisibleSeries.add(seriesName);
      }
      setVisibleSeries(newVisibleSeries);
    };

    const tickInterval = Math.ceil((maxLength - startIndex) / 5);
    const roundedInterval = Math.pow(10, Math.floor(Math.log10(tickInterval)));
    const ticks = Array.from(
      { length: Math.ceil((maxLength - startIndex) / roundedInterval) + 1 },
      (_, i) => Math.floor(startIndex / roundedInterval) * roundedInterval + i * roundedInterval
    ).filter(tick => tick >= startIndex && tick <= maxLength);

    return (
      <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="flex items-center gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                className="form-radio text-blue-600"
                name={`scale-${title}`}
                value="linear"
                checked={scale === 'linear'}
                onChange={(e) => setScale(e.target.value as 'linear' | 'log')}
              />
              <span className="ml-2 text-sm text-gray-700">Linear</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                className="form-radio text-blue-600"
                name={`scale-${title}`}
                value="log"
                checked={scale === 'log'}
                onChange={(e) => setScale(e.target.value as 'linear' | 'log')}
              />
              <span className="ml-2 text-sm text-gray-700">Log</span>
            </label>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={transformedData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
              <XAxis 
                dataKey="index"
                className="text-sm"
                tick={{ fill: '#6b7280' }}
                label={{ 
                  value: 'Index',
                  position: 'insideBottom',
                  offset: -5,
                  className: 'text-sm fill-gray-500'
                }}
                ticks={ticks}
              />
              <YAxis
                scale={scale}
                domain={['auto', 'auto']}
                label={{ 
                  value: yAxisLabel,
                  angle: -90,
                  position: 'insideLeft',
                  className: 'text-sm fill-gray-500'
                }}
                className="text-sm"
                tick={{ fill: '#6b7280' }}
                allowDataOverflow
                tickFormatter={formatScientific}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontFamily: 'monospace'
                }}
                formatter={(value: number) => [formatScientific(value), 'Value']}
                labelFormatter={(index: number) => `Index: ${index}`}
              />
              <Legend 
                onClick={(e) => toggleSeries(e.dataKey)}
                formatter={(value, entry) => (
                  <span 
                    style={{ 
                      color: visibleSeries.has(value) ? '#000' : '#999',
                      cursor: 'pointer'
                    }}
                  >
                    {value}
                  </span>
                )}
              />
              {Object.keys(data).map((name, index) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  name={name}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  hide={!visibleSeries.has(name)}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 px-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Show from index:</span>
            <span>{startIndex}</span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, maxLength - 1)}
            value={startIndex}
            onChange={(e) => onStartIndexChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error rendering chart:', error);
    return <div>Error rendering chart. Error: {String(error)}</div>;
  }
};

export default TimeSeriesPlot;
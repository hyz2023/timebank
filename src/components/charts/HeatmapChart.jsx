import React from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, Cell } from 'recharts';

export const HeatmapChart = ({ data }) => {
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  
  const getColor = (value) => {
    if (value === 0) return '#374151';
    if (value <= 2) return '#10B981';
    if (value <= 5) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">🔥 活跃热力图</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart>
          <XAxis 
            type="number" 
            dataKey="hour" 
            domain={[0, 23]} 
            stroke="#9CA3AF"
            tick={{ fontSize: 10 }}
            label={{ value: '小时', position: 'insideBottom', offset: -5, fill: '#9CA3AF' }}
          />
          <YAxis 
            type="category" 
            dataKey="day" 
            domain={[0, 6]}
            stroke="#9CA3AF"
            tick={{ fontSize: 10 }}
            tickFormatter={(val) => dayNames[val]}
          />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
            labelStyle={{ color: '#F3F4F6' }}
            formatter={(value, name, props) => [`${value.payload.value} 次活动`, '活跃度']}
          />
          <Scatter data={data} fill="#8884d8">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.value)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-500"></div> 低 (1-2)
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-500"></div> 中 (3-5)
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500"></div> 高 (6+)
        </span>
      </div>
    </div>
  );
};

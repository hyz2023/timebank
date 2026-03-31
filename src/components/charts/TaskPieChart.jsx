import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#84CC16'];

export const TaskPieChart = ({ data }) => {
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const { name, value, percentage } = payload[0].payload;
      return (
        <div style={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', padding: '12px' }}>
          <p style={{ color: '#F3F4F6', margin: '0 0 4px 0', fontWeight: 'bold' }}>{name}</p>
          <p style={{ color: '#9CA3AF', margin: '0' }}>次数：{value} | 占比：{percentage}%</p>
        </div>
      );
    }
    return null;
  };

  // 按次数降序排序
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <h3 className="text-sm font-semibold text-white mb-2">📊 任务分布</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart 
          data={sortedData} 
          layout="vertical"
          margin={{ left: 0, right: 80, top: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis 
            type="category" 
            dataKey="name" 
            stroke="#F3F4F6"
            tick={{ fontSize: 10, fill: '#F3F4F6' }}
            width={90}
            tickMargin={4}
            interval={0}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* 底部图例显示次数和占比 */}
      <div className="mt-2 space-y-1">
        {sortedData.map((entry, index) => (
          <div key={index} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-gray-300 truncate max-w-[150px]">{entry.name}</span>
            </div>
            <span className="text-white font-medium">{entry.value}/{entry.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

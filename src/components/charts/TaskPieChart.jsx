import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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

  // 自定义渲染每个条形和标签
  const renderCustomBar = (props) => {
    const { x, y, width, height, index } = props;
    const entry = sortedData[index];
    if (!entry) return null;

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={COLORS[index % COLORS.length]}
          rx={4}
          ry={4}
        />
        <text
          x={x + width + 4}
          y={y + height / 2}
          dy=".35em"
          fill="#F3F4F6"
          fontSize="11"
          fontWeight="500"
          textAnchor="start"
        >
          {entry.value}/{entry.percentage}%
        </text>
      </g>
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <h3 className="text-sm font-semibold text-white mb-2">📊 任务分布</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart 
          data={sortedData} 
          layout="vertical"
          margin={{ left: 0, right: 75, top: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis 
            type="category" 
            dataKey="name" 
            stroke="#F3F4F6"
            tick={{ fontSize: 10, fill: '#F3F4F6' }}
            width={85}
            tickMargin={4}
            interval={0}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" barSize={16} shape={renderCustomBar} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

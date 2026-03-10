import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

export const TimeBarChart = ({ data }) => {
  const chartData = [
    { name: '14:00 前', value: data.before14, color: '#10B981' },
    { name: '14:00-19:00', value: data.before19, color: '#3B82F6' },
    { name: '19:00-21:00', value: data.before21, color: '#F59E0B' },
    { name: '21:00 后', value: data.after21, color: '#EF4444' }
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">⏰ 兑换时间分布</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
          <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
            labelStyle={{ color: '#F3F4F6' }}
          />
          <Legend />
          <Bar dataKey="value" fill="#8884d8">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 text-xs text-gray-400">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded bg-emerald-500"></div>
          <span>14:00 前 - 上午时段</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded bg-blue-500"></div>
          <span>14:00-19:00 - 下午时段</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded bg-amber-500"></div>
          <span>19:00-21:00 - 傍晚时段</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500"></div>
          <span>21:00 后 - 夜间时段 ⚠️</span>
        </div>
      </div>
    </div>
  );
};

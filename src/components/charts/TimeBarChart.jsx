import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

export const TimeBarChart = ({ data }) => {
  const chartData = [
    { name: '14:00 前', value: data.before14, color: '#10B981' },
    { name: '14:00-19:00', value: data.before19, color: '#3B82F6' },
    { name: '19:00-21:00', value: data.before21, color: '#F59E0B' },
    { name: '21:00 后', value: data.after21, color: '#EF4444' }
  ];

  // 计算 21:00 前兑换占比
  const before21Count = data.before14 + data.before19 + data.before21;
  const total = data.total || before21Count + data.after21;
  const before21Ratio = total > 0 ? Math.round((before21Count / total) * 100) : 0;

  // 定义健康状态
  const getHealthStatus = (ratio) => {
    if (ratio >= 80) return { label: '健康', color: 'text-emerald-400', bg: 'bg-emerald-500' };
    if (ratio >= 60) return { label: '注意', color: 'text-amber-400', bg: 'bg-amber-500' };
    return { label: '警示', color: 'text-red-400', bg: 'bg-red-500' };
  };

  const healthStatus = getHealthStatus(before21Ratio);

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white">⏰ 兑换时间分布</h3>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-xs text-gray-400">21:00 前占比</div>
            <div className={`text-xl font-bold ${healthStatus.color}`}>
              {before21Ratio}% <span className={`inline-block w-2.5 h-2.5 rounded-full ${healthStatus.bg} ml-1`}></span>
            </div>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={250}>
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

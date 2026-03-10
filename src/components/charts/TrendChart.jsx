import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export const TrendChart = ({ data }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">📈 每日积分趋势</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
          <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
            labelStyle={{ color: '#F3F4F6' }}
          />
          <Legend />
          <Line type="monotone" dataKey="points" stroke="#10B981" strokeWidth={2} name="积分" />
          <Line type="monotone" dataKey="tasks" stroke="#3B82F6" strokeWidth={2} name="任务数" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

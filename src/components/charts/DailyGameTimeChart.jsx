import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const DailyGameTimeChart = ({ data }) => {
  // data 格式：[{ date: '2026-04-01', minutes: 30 }, { date: '2026-04-02', minutes: 45 }]
  
  // 计算总游戏时间
  const totalMinutes = data.reduce((sum, item) => sum + item.minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  
  // 计算平均值
  const avgMinutes = data.length > 0 ? Math.round(totalMinutes / data.length) : 0;
  
  // 根据时间段设置颜色
  const getBarColor = (minutes) => {
    if (minutes === 0) return '#4B5563';      // 灰色 - 无数据
    if (minutes <= 30) return '#10B981';      // 绿色 - 30 分钟以内
    if (minutes <= 60) return '#3B82F6';      // 蓝色 - 30-60 分钟
    if (minutes <= 90) return '#F59E0B';      // 橙色 - 60-90 分钟
    return '#EF4444';                          // 红色 - 90 分钟以上
  };

  // 格式化日期显示
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
    return `${month}/${day} 周${weekday}`;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white">🎮 每日游戏时间</h3>
        <div className="flex gap-4 text-xs">
          <div className="text-right">
            <div className="text-gray-400">总计</div>
            <div className="text-lg font-bold text-blue-400">{totalHours} 小时</div>
          </div>
          <div className="text-right">
            <div className="text-gray-400">日均</div>
            <div className="text-lg font-bold text-emerald-400">{avgMinutes} 分钟</div>
          </div>
        </div>
      </div>
      
      {data.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          暂无兑换记录
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="date" 
              stroke="#9CA3AF" 
              tick={{ fontSize: 10 }}
              tickFormatter={formatDate}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="#9CA3AF" 
              tick={{ fontSize: 12 }}
              label={{ value: '分钟', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#F3F4F6' }}
              formatter={(value) => [`${value} 分钟`, '游戏时间']}
              labelFormatter={(label) => formatDate(label)}
            />
            <Bar dataKey="minutes" fill="#8884d8" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.minutes)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-500"></div>
          <span>≤30 分钟</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500"></div>
          <span>30-60 分钟</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-500"></div>
          <span>60-90 分钟</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500"></div>
          <span>&gt;90 分钟</span>
        </div>
      </div>
    </div>
  );
};

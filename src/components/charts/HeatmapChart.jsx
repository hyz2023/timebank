import React from 'react';

export const HeatmapChart = ({ data }) => {
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = Array.from({ length: 7 }, (_, i) => i);
  
  // 改进的颜色映射（更明显的颜色梯度）
  const getColor = (value) => {
    if (value === 0) return '#1F2937'; // 深灰色背景
    if (value === 1) return '#34D399'; // 浅绿
    if (value <= 3) return '#10B981'; // 绿色
    if (value <= 5) return '#F59E0B'; // 橙色
    return '#EF4444'; // 红色
  };

  // 获取某个格子中的数据
  const getValue = (day, hour) => {
    const item = data.find(d => d.day === day && d.hour === hour);
    return item ? item.value : 0;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">🔥 活跃热力图</h3>
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* 小时标题行 */}
          <div className="flex mb-2 ml-20">
            {hours.map(hour => (
              <div key={hour} className="flex-1 text-center text-xs text-gray-400">
                {hour}
              </div>
            ))}
          </div>
          
          {/* 热力图网格 */}
          {days.map(day => (
            <div key={day} className="flex items-center mb-1">
              {/* 星期标签 */}
              <div className="w-20 text-xs text-gray-400 flex-shrink-0 pr-2 text-right">
                {dayNames[day]}
              </div>
              
              {/* 小时格子 */}
              <div className="flex flex-1 gap-[2px]">
                {hours.map(hour => {
                  const value = getValue(day, hour);
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className="flex-1 aspect-square rounded-sm cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ 
                        backgroundColor: getColor(value),
                        minHeight: '12px'
                      }}
                      title={`${dayNames[day]} ${hour}:00 - ${value} 次活动`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 图例 */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-[#1F2937]"></div> 无活动
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-[#34D399]"></div> 1 次
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-[#10B981]"></div> 2-3 次
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-[#F59E0B]"></div> 4-5 次
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-[#EF4444]"></div> 6+ 次
        </span>
      </div>
      
      {/* 数据提示 */}
      {data.filter(d => d.value > 0).length === 0 && (
        <div className="text-center text-gray-500 text-sm mt-4">
          最近 7 天内没有活动数据，尝试切换到"最近 30 天"查看
        </div>
      )}
    </div>
  );
};

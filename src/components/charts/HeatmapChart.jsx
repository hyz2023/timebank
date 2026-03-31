import React from 'react';

export const HeatmapChart = ({ data, compact = false }) => {
  // 显示顺序：周一到周日
  const displayDays = [
    { day: 1, label: '一' },
    { day: 2, label: '二' },
    { day: 3, label: '三' },
    { day: 4, label: '四' },
    { day: 5, label: '五' },
    { day: 6, label: '六' },
    { day: 0, label: '日' }
  ];
  
  // 显示 6:00 - 23:00（完整活跃时间段）
  const startHour = 6;
  const endHour = 23;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => i + startHour);
  
  // 改进的颜色映射（更明显的颜色梯度）
  const getColor = (value) => {
    if (value === 0) return '#1F2937'; // 深灰色背景
    if (value === 1) return '#34D399'; // 浅绿
    if (value <= 3) return '#10B981'; // 绿色
    if (value <= 5) return '#F59E0B'; // 橙色
    return '#EF4444'; // 红色
  };

  // 获取某个格子中的数据
  const getValue = (actualDay, hour) => {
    const item = data.find(d => d.day === actualDay && d.hour === hour);
    return item ? item.value : 0;
  };

  // compact 模式下使用更小的尺寸
  const cellSize = compact ? 'w-4 h-4' : 'w-6 h-6';
  const cellTextSize = compact ? 'text-[6px]' : 'text-[7px]';
  const labelSize = compact ? 'text-[8px]' : 'text-[9px]';
  const timeWidth = compact ? 'w-6' : 'w-7';
  const timePadding = compact ? 'pr-1' : 'pr-1';
  const gapSize = 'gap-0.5';

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="min-w-max">
          {/* 星期标题行 - 横轴 */}
          <div className="flex mb-1">
            {/* 占位，宽度和时间标签一致 */}
            <div className={`${timeWidth} flex-shrink-0 ${timePadding}`}></div>
            {/* 星期标签 */}
            <div className={`flex ${gapSize}`}>
              {displayDays.map(({ day, label }) => (
                <div key={day} className={`${compact ? 'w-4' : 'w-6'} text-center ${labelSize} text-gray-400`}>
                  {label}
                </div>
              ))}
            </div>
          </div>
          
          {/* 热力图网格 - 纵轴是时间 */}
          {hours.map(hour => (
            <div key={hour} className="flex items-center mb-0.5">
              {/* 时间标签 - 纵轴 */}
              <div className={`${timeWidth} ${labelSize} text-gray-400 flex-shrink-0 ${timePadding} text-right`}>
                {hour}
              </div>
              
              {/* 星期格子 */}
              <div className={`flex ${gapSize}`}>
                {displayDays.map(({ day, label }) => {
                  const value = getValue(day, hour);
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className={`${cellSize} rounded-sm cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center`}
                      style={{ backgroundColor: getColor(value) }}
                      title={`${label} ${hour}:00 - ${value} 次活动`}
                    >
                      {value > 0 && (
                        <span className={`${cellTextSize} text-white font-bold drop-shadow`}>{value}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 图例 - compact 模式下隐藏 */}
      {!compact && (
        <div className="flex items-center justify-start gap-3 mt-2 text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded bg-[#1F2937]"></div> 0
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded bg-[#34D399]"></div> 1
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded bg-[#10B981]"></div> 2-3
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded bg-[#F59E0B]"></div> 4-5
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded bg-[#EF4444]"></div> 6+
          </span>
        </div>
      )}
    </div>
  );
};

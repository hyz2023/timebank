import { getTodayStr } from '../engine';

/**
 * 检查时间是否在 21:00 之前
 */
export const isBeforeCurfew = (timestamp) => {
  const date = new Date(timestamp);
  const hour = date.getHours();
  return hour < 21;
};

/**
 * 获取时间段标签（用于兑换时间分析）
 * 14:00 前、14:00-19:00、19:00-21:00、21:00 后
 */
export const getTimePeriod = (timestamp) => {
  const date = new Date(timestamp);
  const hour = date.getHours();
  
  if (hour < 14) return 'morning';      // 14:00 前
  if (hour < 19) return 'afternoon';    // 14:00-19:00
  if (hour < 21) return 'evening';      // 19:00-21:00
  return 'night';                        // 21:00 后
};

/**
 * 获取日期范围的时间戳
 */
export const getDateRange = (days) => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return { start: start.getTime(), end: end.getTime() };
};

/**
 * 格式化时间戳为日期字符串
 */
export const formatDate = (timestamp) => {
  return new Date(timestamp).toISOString().slice(0, 10);
};

/**
 * 格式化时间戳为小时
 */
export const formatHour = (timestamp) => {
  return new Date(timestamp).getHours();
};

/**
 * 格式化时间戳为星期几 (0-6, 0=周日)
 */
export const formatDayOfWeek = (timestamp) => {
  return new Date(timestamp).getDay();
};

/**
 * 过滤指定日期范围的 logs
 */
export const filterLogsByDateRange = (logs, startTimestamp, endTimestamp) => {
  return logs.filter(l => l.timestamp >= startTimestamp && l.timestamp <= endTimestamp);
};

/**
 * 计算每日趋势数据
 */
export const calculateDailyTrend = (logs, days) => {
  const { start, end } = getDateRange(days);
  const filteredLogs = filterLogsByDateRange(logs, start, end);
  
  // 按日期分组
  const dailyData = {};
  const dateKeys = [];
  
  // 初始化所有日期
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const dateStr = date.toISOString().slice(0, 10);
    dailyData[dateStr] = { date: dateStr, points: 0, tasks: 0, redeems: 0 };
    dateKeys.push(dateStr);
  }
  
  // 聚合数据
  filteredLogs.forEach(log => {
    const dateStr = formatDate(log.timestamp);
    if (dailyData[dateStr]) {
      if (log.type === 'EARN') {
        dailyData[dateStr].points += log.pointsChange;
        dailyData[dateStr].tasks += 1;
      } else if (log.type === 'REDEEM') {
        dailyData[dateStr].redeems += 1;
      }
    }
  });
  
  return dateKeys.map(key => dailyData[key]);
};

/**
 * 计算热力图数据（按小时和星期几）
 */
export const calculateHeatmapData = (logs, days) => {
  const { start, end } = getDateRange(days);
  const filteredLogs = filterLogsByDateRange(logs, start, end);
  
  // 初始化热力图数据 (7 天 x 24 小时)
  const heatmapData = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      heatmapData.push({ day, hour, value: 0 });
    }
  }
  
  // 聚合数据
  filteredLogs.forEach(log => {
    const day = formatDayOfWeek(log.timestamp);
    const hour = formatHour(log.timestamp);
    const index = day * 24 + hour;
    if (heatmapData[index]) {
      heatmapData[index].value += 1;
    }
  });
  
  return heatmapData;
};

/**
 * 计算任务分布数据（按任务次数统计）
 */
export const calculateTaskDistribution = (logs, days) => {
  const { start, end } = getDateRange(days);
  const filteredLogs = filterLogsByDateRange(logs, start, end);
  
  // 按任务分组（统计次数）
  const taskMap = {};
  let totalCount = 0;
  
  filteredLogs
    .filter(l => l.type === 'EARN' && l.taskId)
    .forEach(log => {
      if (!taskMap[log.taskName]) {
        taskMap[log.taskName] = 0;
      }
      taskMap[log.taskName] += 1;  // 统计次数而非积分
      totalCount += 1;
    });
  
  // 转换为数组并计算百分比
  return Object.entries(taskMap)
    .map(([name, value]) => ({
      name,
      value,
      percentage: totalCount > 0 ? ((value / totalCount) * 100).toFixed(1) : 0
    }))
    .sort((a, b) => b.value - a.value);
};

/**
 * 计算兑换时间分析数据（14:00、19:00、21:00 分割点）
 */
export const calculateRedeemTimeAnalysis = (logs, days) => {
  const { start, end } = getDateRange(days);
  const filteredLogs = filterLogsByDateRange(logs, start, end);
  
  const analysis = {
    before14: 0,      // 14:00 前
    before19: 0,      // 14:00-19:00
    before21: 0,      // 19:00-21:00
    after21: 0,       // 21:00 后
    total: 0
  };
  
  filteredLogs
    .filter(l => l.type === 'REDEEM')
    .forEach(log => {
      const period = getTimePeriod(log.timestamp);
      if (period === 'morning') analysis.before14 += 1;
      else if (period === 'afternoon') analysis.before19 += 1;
      else if (period === 'evening') analysis.before21 += 1;
      else analysis.after21 += 1;
      analysis.total += 1;
    });
  
  return analysis;
};

/**
 * 计算健康度评分（21:00 前后作为划分）
 */
export const calculateHealthScore = (logs, days) => {
  const { start, end } = getDateRange(days);
  const filteredLogs = filterLogsByDateRange(logs, start, end);
  
  if (filteredLogs.length === 0) {
    return { label: '无数据', color: 'gray', ratio: 0 };
  }
  
  const before21 = filteredLogs.filter(l => isBeforeCurfew(l.timestamp)).length;
  const ratio = before21 / filteredLogs.length;
  
  if (ratio >= 0.8) return { label: '健康', color: 'green', ratio: (ratio * 100).toFixed(0) };
  if (ratio >= 0.6) return { label: '注意', color: 'yellow', ratio: (ratio * 100).toFixed(0) };
  return { label: '警示', color: 'red', ratio: (ratio * 100).toFixed(0) };
};

/**
 * 计算核心指标
 */
export const calculateMetrics = (logs, days) => {
  const { start, end } = getDateRange(days);
  const currentLogs = filterLogsByDateRange(logs, start, end);
  
  // 计算上一周期
  const prevStart = start - (end - start + 1);
  const prevEnd = start - 1;
  const prevLogs = filterLogsByDateRange(logs, prevStart, prevEnd);
  
  // 当前周期数据
  const currentPoints = currentLogs
    .filter(l => l.type === 'EARN')
    .reduce((sum, l) => sum + l.pointsChange, 0);
  
  const currentTasks = currentLogs.filter(l => l.type === 'EARN').length;
  const currentRedeems = currentLogs.filter(l => l.type === 'REDEEM').length;
  
  // 上一周期数据
  const prevPoints = prevLogs
    .filter(l => l.type === 'EARN')
    .reduce((sum, l) => sum + l.pointsChange, 0);
  
  const prevTasks = prevLogs.filter(l => l.type === 'EARN').length;
  const prevRedeems = prevLogs.filter(l => l.type === 'REDEEM').length;
  
  // 计算变化百分比
  const calcChange = (current, prev) => {
    if (prev === 0) return { change: 100, trend: 'up' };
    const change = ((current - prev) / prev) * 100;
    return {
      change: Math.abs(change).toFixed(1),
      trend: change >= 0 ? 'up' : 'down'
    };
  };
  
  return {
    points: {
      value: currentPoints,
      ...calcChange(currentPoints, prevPoints)
    },
    tasks: {
      value: currentTasks,
      ...calcChange(currentTasks, prevTasks)
    },
    redeems: {
      value: currentRedeems,
      ...calcChange(currentRedeems, prevRedeems)
    }
  };
};

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
 * 获取日期范围的时间戳（本地时区）
 * @param {number|null} days - 天数，或 null（全部数据）
 * @param {Object} customRange - { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 */
export const getDateRange = (days, customRange = null) => {
  const now = new Date();
  
  // 获取本地日期的起始和结束
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = new Date();
  
  // 自定义日期区间模式
  if (customRange && customRange.startDate && customRange.endDate) {
    const s = customRange.startDate.split('-');
    const e = customRange.endDate.split('-');
    start.setFullYear(+s[0], +s[1]-1, +s[2]);
    start.setHours(0, 0, 0, 0);
    end.setFullYear(+e[0], +e[1]-1, +e[2]);
    end.setHours(23, 59, 59, 999);
    return { start: start.getTime(), end: end.getTime(), custom: true };
  }
  
  if (days === null || days === undefined) {
    // 全部数据：返回一个很早的日期
    start.setFullYear(2020, 0, 1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);
  }
  
  return { start: start.getTime(), end: end.getTime() };
};

/**
 * 格式化时间戳为日期字符串（本地时区）
 */
export const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
export const calculateDailyTrend = (logs, days, customRange = null) => {
  const { start, end, custom } = getDateRange(days, customRange);
  const filteredLogs = filterLogsByDateRange(logs, start, end);
  
  if (filteredLogs.length === 0) return [];
  
  const dailyData = {};
  const dateKeys = [];
  
  if (days === null || days === undefined) {
    // 全部数据：从第一条记录开始到今日
    const timestamps = filteredLogs.map(l => l.timestamp);
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    
    const startDate = new Date(minTimestamp);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(maxTimestamp);
    endDate.setHours(23, 59, 59, 999);
    
    // 生成从起始日期到结束日期的所有日期
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d.getTime());
      dailyData[dateStr] = { date: dateStr, points: 0, tasks: 0, redeems: 0 };
      dateKeys.push(dateStr);
    }
  } else {
    // 固定天数模式（现有逻辑）
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = formatDate(date.getTime());
      dailyData[dateStr] = { date: dateStr, points: 0, tasks: 0, redeems: 0 };
      dateKeys.push(dateStr);
    }
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
  
  // 在"全部数据"或自定义模式下裁剪两端空数据，固定天数模式保持完整
  if (days === null || days === undefined || custom) {
    let startIndex = 0;
    let endIndex = dateKeys.length - 1;
    
    // 找到第一个有数据的日期
    for (let i = 0; i < dateKeys.length; i++) {
      if (dailyData[dateKeys[i]].points > 0 || dailyData[dateKeys[i]].tasks > 0 || dailyData[dateKeys[i]].redeems > 0) {
        startIndex = i;
        break;
      }
    }
    
    // 找到最后一个有数据的日期
    for (let i = dateKeys.length - 1; i >= 0; i--) {
      if (dailyData[dateKeys[i]].points > 0 || dailyData[dateKeys[i]].tasks > 0 || dailyData[dateKeys[i]].redeems > 0) {
        endIndex = i;
        break;
      }
    }
    
    return dateKeys.slice(startIndex, endIndex + 1).map(key => dailyData[key]);
  }
  
  // 固定天数模式：返回完整日期范围（包括 0 值日期）
  return dateKeys.map(key => dailyData[key]);
};

/**
 * 计算热力图数据（按小时和星期几）
 */
export const calculateHeatmapData = (logs, days, type = null, customRange = null) => {
  const { start, end } = getDateRange(days, customRange);
  let filteredLogs = filterLogsByDateRange(logs, start, end);
  
  // 如果指定了类型，过滤 EARN 或 REDEEM
  if (type === 'EARN') {
    filteredLogs = filteredLogs.filter(l => l.type === 'EARN');
  } else if (type === 'REDEEM') {
    filteredLogs = filteredLogs.filter(l => l.type === 'REDEEM');
  }
  
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
export const calculateTaskDistribution = (logs, days, customRange = null) => {
  const { start, end } = getDateRange(days, customRange);
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
export const calculateRedeemTimeAnalysis = (logs, days, customRange = null) => {
  const { start, end } = getDateRange(days, customRange);
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
export const calculateHealthScore = (logs, days, customRange = null) => {
  const { start, end } = getDateRange(days, customRange);
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
 * 计算每日游戏时间（按兑换记录统计）
 */
export const calculateDailyGameTime = (logs, days, customRange = null) => {
  const { start, end, custom } = getDateRange(days, customRange);
  const filteredLogs = filterLogsByDateRange(logs, start, end);
  
  // 获取日期范围的所有日期
  const dailyData = {};
  const dateKeys = [];
  
  if (days === null || days === undefined) {
    // 全部数据：从第一条兑换记录开始到今日
    const redeemLogs = filteredLogs.filter(l => l.type === 'REDEEM');
    if (redeemLogs.length === 0) return [];
    
    const timestamps = redeemLogs.map(l => l.timestamp);
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    
    const startDate = new Date(minTimestamp);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(maxTimestamp);
    endDate.setHours(23, 59, 59, 999);
    
    // 生成从起始日期到结束日期的所有日期
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d.getTime());
      dailyData[dateStr] = { date: dateStr, minutes: 0 };
      dateKeys.push(dateStr);
    }
  } else {
    // 固定天数模式
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = formatDate(date.getTime());
      dailyData[dateStr] = { date: dateStr, minutes: 0 };
      dateKeys.push(dateStr);
    }
  }
  
  // 聚合兑换记录的游戏时间
  filteredLogs
    .filter(l => l.type === 'REDEEM' && l.minutes)
    .forEach(log => {
      const dateStr = formatDate(log.timestamp);
      if (dailyData[dateStr]) {
        dailyData[dateStr].minutes += log.minutes;
      }
    });
  
  // 在"全部数据"或自定义模式下裁剪两端空数据，固定天数模式保持完整
  if (days === null || days === undefined || custom) {
    let startIndex = 0;
    let endIndex = dateKeys.length - 1;
    
    // 找到第一个有数据的日期
    for (let i = 0; i < dateKeys.length; i++) {
      if (dailyData[dateKeys[i]].minutes > 0) {
        startIndex = i;
        break;
      }
    }
    
    // 找到最后一个有数据的日期
    for (let i = dateKeys.length - 1; i >= 0; i--) {
      if (dailyData[dateKeys[i]].minutes > 0) {
        endIndex = i;
        break;
      }
    }
    
    return dateKeys.slice(startIndex, endIndex + 1).map(key => dailyData[key]);
  }
  
  // 固定天数模式：返回完整日期范围（包括 0 值日期）
  return dateKeys.map(key => dailyData[key]);
};

/**
 * 计算核心指标
 */
export const calculateMetrics = (logs, days, customRange = null) => {
  const { start, end, custom } = getDateRange(days, customRange);
  const currentLogs = filterLogsByDateRange(logs, start, end);
  
  // 当前周期数据
  const currentPoints = currentLogs
    .filter(l => l.type === 'EARN')
    .reduce((sum, l) => sum + l.pointsChange, 0);
  
  const currentTasks = currentLogs.filter(l => l.type === 'EARN').length;
  const currentRedeems = currentLogs.filter(l => l.type === 'REDEEM').length;
  const currentRedeemMinutes = currentLogs
    .filter(l => l.type === 'REDEEM' && l.minutes)
    .reduce((sum, l) => sum + l.minutes, 0);
  
  // 全部数据或自定义模式：不计算对比
  if (days === null || days === undefined || custom) {
    return {
      points: { value: currentPoints, change: '-', trend: null },
      tasks: { value: currentTasks, change: '-', trend: null },
      redeems: { value: currentRedeems, change: '-', trend: null },
      redeemMinutes: { value: currentRedeemMinutes, change: '-', trend: null }
    };
  }
  
  // 固定天数模式：计算上一周期对比
  const prevStart = start - (end - start + 1);
  const prevEnd = start - 1;
  const prevLogs = filterLogsByDateRange(logs, prevStart, prevEnd);
  
  const prevPoints = prevLogs
    .filter(l => l.type === 'EARN')
    .reduce((sum, l) => sum + l.pointsChange, 0);
  
  const prevTasks = prevLogs.filter(l => l.type === 'EARN').length;
  const prevRedeems = prevLogs.filter(l => l.type === 'REDEEM').length;
  const prevRedeemMinutes = prevLogs
    .filter(l => l.type === 'REDEEM' && l.minutes)
    .reduce((sum, l) => sum + l.minutes, 0);
  
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
    },
    redeemMinutes: {
      value: currentRedeemMinutes,
      ...calcChange(currentRedeemMinutes, prevRedeemMinutes)
    }
  };
};

/**
 * 中国法定节假日数据表
 * 
 * 数据结构说明：
 * - holidays: 法定节假日日期（休息日，按周末规则）
 * - workdays: 调休工作日日期（按工作日规则）
 * 
 * 日期格式：YYYY-MM-DD
 */

// 2026年法定节假日（根据国务院办公厅通知）
const HOLIDAYS_2026 = {
  holidays: [
    // 元旦：2026-01-01 ~ 01-03
    '2026-01-01', '2026-01-02', '2026-01-03',
    // 春节：2026-02-15 ~ 02-23
    '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
    '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
    // 清明节：2026-04-04 ~ 04-06
    '2026-04-04', '2026-04-05', '2026-04-06',
    // 劳动节：2026-05-01 ~ 05-05
    '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
    // 端午节：2026-06-19 ~ 06-21
    '2026-06-19', '2026-06-20', '2026-06-21',
    // 中秋节：2026-09-25 ~ 09-27
    '2026-09-25', '2026-09-26', '2026-09-27',
    // 国庆节：2026-10-01 ~ 10-07
    '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07',
  ],
  workdays: [
    // 元旦调休
    '2026-01-04', // 周日上班
    // 春节调休
    '2026-02-14', // 周六上班
    '2026-02-28', // 周六上班
    // 劳动节调休
    '2026-05-09', // 周六上班
    // 中秋节调休
    '2026-09-20', // 周日上班
    // 国庆节调休
    '2026-10-10', // 周六上班
  ]
};

// 合并数据
const ALL_HOLIDAYS = new Set(HOLIDAYS_2026.holidays);
const ALL_WORKDAYS = new Set(HOLIDAYS_2026.workdays);

/**
 * 获取今天的日期字符串 (YYYY-MM-DD)
 */
const getTodayDateStr = () => {
  return new Date().toISOString().slice(0, 10);
};

/**
 * 检查今天是否为休息日（周末或法定节假日，但排除调休工作日）
 */
export const isRestDay = () => {
  const today = getTodayDateStr();
  const day = new Date().getDay();
  const isWeekend = day === 0 || day === 6;

  // 1. 如果今天是调休工作日，则按工作日处理
  if (ALL_WORKDAYS.has(today)) {
    return false;
  }

  // 2. 如果今天是法定节假日，则按休息日处理
  if (ALL_HOLIDAYS.has(today)) {
    return true;
  }

  // 3. 否则按周末判断
  return isWeekend;
};

/**
 * 获取今日类型描述
 */
export const getDayType = () => {
  const today = getTodayDateStr();
  
  if (ALL_WORKDAYS.has(today)) {
    return '调休工作日';
  }
  if (ALL_HOLIDAYS.has(today)) {
    return '法定节假日';
  }
  
  const day = new Date().getDay();
  if (day === 0 || day === 6) {
    return '周末';
  }
  return '工作日';
};

export default {
  isRestDay,
  getDayType,
  ALL_HOLIDAYS,
  ALL_WORKDAYS,
};
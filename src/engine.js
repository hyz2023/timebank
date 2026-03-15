// TimeBank 核心积分计算引擎

/**
 * 计算本次任务得分（含衰减和质量奖励）
 * 衰减规则：
 *   第 1-2 次/天：100% 收益
 *   第 3-4 次/天：75% 收益
 *   第 5+ 次/天：50% 收益
 */
export const calculatePoints = (task, isPerfect) => {
    const count = task.dailyCount + 1;
    let multiplier = 1.0;

    if (count >= 5) multiplier = 0.5;
    else if (count >= 3) multiplier = 0.75;

    let points = task.basePoints * multiplier;
    if (isPerfect) points += task.bonusPoints;

    return Math.floor(points);
};

/**
 * 获取当前次数对应的衰减率
 */
export const getDecayRate = (dailyCount) => {
    const nextCount = dailyCount + 1;
    if (nextCount >= 5) return 0.5;
    if (nextCount >= 3) return 0.75;
    return 1.0;
};

/**
 * 兑换档位配置
 */
export const EXCHANGE_TIERS = [
    { id: 'basic', name: '基础档', label: '短途飞行', cost: 10, baseMinutes: 15, bonusMinutes: 0, totalMinutes: 15, rate: 1.5, icon: '🛩️' },
    { id: 'advanced', name: '进阶档', label: '国内航线', cost: 20, baseMinutes: 30, bonusMinutes: 2, totalMinutes: 32, rate: 1.6, icon: '✈️' },
    { id: 'premium', name: '高级档', label: '国际航线', cost: 30, baseMinutes: 45, bonusMinutes: 4, totalMinutes: 49, rate: 1.63, icon: '🚀' },
    { id: 'intercontinental', name: '洲际档', label: '洲际航线', cost: 40, baseMinutes: 60, bonusMinutes: 8, totalMinutes: 68, rate: 1.7, icon: '🌍' },
];

/**
 * 获取今日已兑换的总分钟数（不含赠送分钟）
 */
export const getTodayRedeemedMinutes = (logs) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    return logs
        .filter(l => l.type === 'REDEEM' && l.timestamp >= todayStart)
        .reduce((sum, l) => sum + (l.baseMinutes || l.minutes || 0), 0);
};

/**
 * 2026 年法定节假日配置
 * 包含调休安排：workingDaysOff 为放假日期，weekendDaysWork 为调休上班的周末
 */
export const HOLIDAY_2026 = {
    // 放假日期（这些日期按节假日限额计算）
    workingDaysOff: [
        // 元旦
        '2026-01-02',
        // 春节
        '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
        '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
        // 清明节
        '2026-04-04', '2026-04-05', '2026-04-06',
        // 劳动节
        '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
        // 端午节
        '2026-06-19', '2026-06-20', '2026-06-21',
        // 中秋节
        '2026-09-25', '2026-09-26', '2026-09-27',
        // 国庆节
        '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
        '2026-10-05', '2026-10-06', '2026-10-07',
    ],
    // 调休上班的周末（这些日期按工作日限额计算）
    weekendDaysWork: [
        '2026-02-14', '2026-02-28', // 春节调休
        '2026-05-09',               // 劳动节调休
        '2026-09-20', '2026-10-10', // 国庆节调休
    ],
};

/**
 * 判断日期是否为法定节假日（享受节假日兑换限额）
 */
export const isHoliday = (date = new Date()) => {
    const dateStr = date.toISOString().slice(0, 10);
    const day = date.getDay();
    
    // 检查是否为调休上班的周末（即使是周六日，也要上班，算工作日）
    if (HOLIDAY_2026.weekendDaysWork.includes(dateStr)) {
        return false;
    }
    
    // 检查是否为放假日期（即使是工作日，也放假，算节假日）
    if (HOLIDAY_2026.workingDaysOff.includes(dateStr)) {
        return true;
    }
    
    // 默认：周六日算节假日
    return day === 0 || day === 6;
};

/**
 * 获取今日兑换限额
 * 工作日 60 分钟，法定节假日 90 分钟
 */
export const getDailyLimit = () => {
    return isHoliday() ? 90 : 60;
};

/**
 * 校验是否可以兑换
 */
export const canRedeem = (tier, balance, logs) => {
    if (balance < tier.cost) {
        return { ok: false, reason: '积分不足' };
    }

    const todayRedeemed = getTodayRedeemedMinutes(logs);
    const limit = getDailyLimit();

    // 检查基础时长是否超出限额（赠送时长不占额度）
    if (todayRedeemed + tier.baseMinutes > limit) {
        return { ok: false, reason: `今日额度已达上限 (${limit}分钟)` };
    }

    return { ok: true, reason: '' };
};

/**
 * 检查日期是否为今天
 */
export const isToday = (dateStr) => {
    const today = new Date().toISOString().slice(0, 10);
    return dateStr === today;
};

/**
 * 获取今天的日期字符串 (YYYY-MM-DD)
 */
export const getTodayStr = () => {
    return new Date().toISOString().slice(0, 10);
};

/**
 * 默认任务配置
 */
export const DEFAULT_TASKS = [
    { id: 't1', name: '练字', basePoints: 4, bonusPoints: 2, dailyCount: 0, lastUpdate: getTodayStr(), icon: '✍️', desc: '每页练字' },
    { id: 't2', name: '单词', basePoints: 4, bonusPoints: 2, dailyCount: 0, lastUpdate: getTodayStr(), icon: '📖', desc: '背诵单词' },
    { id: 't3', name: '口算', basePoints: 4, bonusPoints: 2, dailyCount: 0, lastUpdate: getTodayStr(), icon: '🔢', desc: '口算一页' },
    { id: 't4', name: '数学题', basePoints: 5, bonusPoints: 2, dailyCount: 0, lastUpdate: getTodayStr(), icon: '📐', desc: '数学练习题' },
];

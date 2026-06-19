import { create } from 'zustand';
import { calculatePoints, getDecayRate, getTodayStr, DEFAULT_TASKS, CATEGORIES, SORT_MODES } from './engine';

const API_BASE = '/api';

// 统一 fetch：携带 Cookie；遇 401 跳回登录页
const request = async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    if (res.status === 401) {
        // 会话失效：刷新页面，AuthGate 会重新要求登录
        window.location.reload();
        throw new Error('未授权');
    }
    return res;
};

const api = {
    getData: async () => {
        const res = await request('/data');
        return await res.json();
    },

    saveData: async (data) => {
        const res = await request('/data', { method: 'POST', body: JSON.stringify(data) });
        return await res.json();
    },

    earnPoints: async (taskId, isPerfect) => {
        const res = await request('/earn', { method: 'POST', body: JSON.stringify({ taskId, isPerfect }) });
        return await res.json();
    },

    redeemPoints: async (tier) => {
        const res = await request('/redeem', { method: 'POST', body: JSON.stringify({ tier }) });
        return await res.json();
    },

    clearExpiredTimers: async () => {
        const res = await request('/timers/clear', { method: 'POST' });
        return await res.json();
    },

    pauseTimer: async (timerId) => {
        const res = await request(`/timers/${timerId}`, { method: 'POST', body: JSON.stringify({ action: 'pause' }) });
        return await res.json();
    },

    resumeTimer: async (timerId) => {
        const res = await request(`/timers/${timerId}`, { method: 'POST', body: JSON.stringify({ action: 'resume' }) });
        return await res.json();
    },

    updateTask: async (taskId, updates) => {
        const res = await request(`/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(updates) });
        return await res.json();
    },

    addTask: async (task) => {
        const res = await request('/tasks', { method: 'POST', body: JSON.stringify(task) });
        return await res.json();
    },

    removeTask: async (taskId) => {
        const res = await request(`/tasks/${taskId}`, { method: 'DELETE' });
        return await res.json();
    },

    adjustBalance: async (amount) => {
        const res = await request('/balance', { method: 'POST', body: JSON.stringify({ amount }) });
        return await res.json();
    },
};

// 获取排序模式（从 localStorage 读取默认值）
const getInitialSortMode = () => {
    try {
        const saved = localStorage.getItem('timebank-sortMode');
        if (saved && SORT_MODES[saved]) return saved;
    } catch {}
    return 'category'; // 默认按分类排序
};

const useStore = create((set, get) => ({
    // === 用户数据 ===
    balance: 0,
    tasks: DEFAULT_TASKS,
    logs: [],
    timers: [],
    config: { dailyExchangeLimitWeekday: 360, dailyExchangeLimitHoliday: 360, notifyOnExpire: true },
    loading: true,
    error: null,

    // === 排序状态 ===
    sortMode: getInitialSortMode(),

    // === 设置排序模式 ===
    setSortMode: (mode) => {
        if (!SORT_MODES[mode]) return;
        localStorage.setItem('timebank-sortMode', mode);
        set({ sortMode: mode });
    },

    // === 获取排序后的任务列表 ===
    getSortedTasks: () => {
        const state = get();
        const tasks = [...state.tasks];
        const mode = state.sortMode;

        if (mode === 'category') {
            // 按分类分组，组内按基础分降序
            tasks.sort((a, b) => {
                const catA = CATEGORIES[a.category]?.order ?? 99;
                const catB = CATEGORIES[b.category]?.order ?? 99;
                if (catA !== catB) return catA - catB;
                return b.basePoints - a.basePoints;
            });
        } else if (mode === 'points') {
            // 按基础分降序
            tasks.sort((a, b) => b.basePoints - a.basePoints);
        } else if (mode === 'frequency') {
            // 按今日完成次数降序
            tasks.sort((a, b) => b.dailyCount - a.dailyCount);
        }

        return tasks;
    },

    // === 初始化：从服务端加载数据 ===
    loadData: async () => {
        try {
            set({ loading: true, error: null });
            const data = await api.getData();
            set({
                balance: data.balance || 0,
                tasks: data.tasks || DEFAULT_TASKS,
                logs: data.logs || [],
                timers: data.timers || [],
                config: data.config || get().config,
                loading: false,
            });
            console.log('[TimeBank] ✅ 数据加载成功');
        } catch (error) {
            console.error('[TimeBank] 数据加载失败:', error);
            set({ loading: false, error: error.message });
        }
    },

    // === 每日重置（服务端已自动执行）===
    checkDailyReset: async () => {
        // 服务端在 getData 时已自动检查并重置
        await get().loadData();
    },

    // === 赚取积分 ===
    earnPoints: async (taskId, isPerfect) => {
        try {
            const result = await api.earnPoints(taskId, isPerfect);
            if (result.success) {
                const state = get();
                const task = state.tasks.find((t) => t.id === taskId);
                if (!task) return 0;

                const log = {
                    id: `l_${Date.now()}`,
                    type: 'EARN',
                    taskId,
                    taskName: task.name,
                    pointsChange: result.points,
                    timestamp: Date.now(),
                    meta: {
                        quality: isPerfect ? 'perfect' : 'normal',
                        decayRate: getDecayRate(task.dailyCount),
                        dailyCount: result.dailyCount,
                    },
                };

                set((state) => ({
                    balance: result.newBalance,
                    tasks: state.tasks.map((t) =>
                        t.id === taskId
                            ? { ...t, dailyCount: result.dailyCount, lastUpdate: getTodayStr() }
                            : t
                    ),
                    logs: [log, ...state.logs],
                }));

                return result.points;
            }
        } catch (error) {
            console.error('[TimeBank] 赚取积分失败:', error);
        }
        return 0;
    },

    // === 兑换积分 ===
    redeemPoints: async (tier) => {
        try {
            const result = await api.redeemPoints(tier);
            if (result.success) {
                const log = {
                    id: `l_${Date.now()}`,
                    type: 'REDEEM',
                    taskId: null,
                    taskName: tier.label,
                    pointsChange: -tier.cost,
                    minutes: tier.totalMinutes,
                    baseMinutes: tier.baseMinutes,
                    timestamp: Date.now(),
                    meta: { tier: tier.id },
                };

                set((state) => ({
                    balance: result.newBalance,
                    logs: [log, ...state.logs],
                    timers: [result.timer, ...state.timers],
                }));

                return result.timer;
            }
        } catch (error) {
            console.error('[TimeBank] 兑换积分失败:', error);
        }
        return null;
    },

    // === 清除已过期定时器 ===
    clearExpiredTimers: async () => {
        try {
            await api.clearExpiredTimers();
            const now = Date.now();
            set((state) => ({
                // 暂停中的计时器 (endTime 为 null) 不算过期，保留
                timers: state.timers.filter((t) => t.paused || t.endTime > now),
            }));
        } catch (error) {
            console.error('[TimeBank] 清除定时器失败:', error);
        }
    },

    // === 暂停定时器 ===
    pauseTimer: async (timerId) => {
        try {
            const result = await api.pauseTimer(timerId);
            if (result.success) {
                set((state) => ({
                    timers: state.timers.map((t) =>
                        t.id === timerId ? result.timer : t
                    ),
                }));
            }
        } catch (error) {
            console.error('[TimeBank] 暂停定时器失败:', error);
        }
    },

    // === 继续定时器 ===
    resumeTimer: async (timerId) => {
        try {
            const result = await api.resumeTimer(timerId);
            if (result.success) {
                set((state) => ({
                    timers: state.timers.map((t) =>
                        t.id === timerId ? result.timer : t
                    ),
                }));
            }
        } catch (error) {
            console.error('[TimeBank] 继续定时器失败:', error);
        }
    },

    // === Admin: 更新任务配置 ===
    updateTask: async (taskId, updates) => {
        try {
            await api.updateTask(taskId, updates);
            set((state) => ({
                tasks: state.tasks.map((t) =>
                    t.id === taskId ? { ...t, ...updates } : t
                ),
            }));
        } catch (error) {
            console.error('[TimeBank] 更新任务失败:', error);
        }
    },

    // === Admin: 添加任务 ===
    addTask: async (task) => {
        try {
            const result = await api.addTask(task);
            if (result.success) {
                set((state) => ({
                    tasks: [...state.tasks, result.task],
                }));
            }
        } catch (error) {
            console.error('[TimeBank] 添加任务失败:', error);
        }
    },

    // === Admin: 删除任务 ===
    removeTask: async (taskId) => {
        try {
            await api.removeTask(taskId);
            set((state) => ({
                tasks: state.tasks.filter((t) => t.id !== taskId),
            }));
        } catch (error) {
            console.error('[TimeBank] 删除任务失败:', error);
        }
    },

    // === Admin: 手动调整余额 ===
    adjustBalance: async (amount) => {
        try {
            const result = await api.adjustBalance(amount);
            if (result.success) {
                const log = {
                    id: `l_${Date.now()}`,
                    type: amount >= 0 ? 'EARN' : 'REDEEM',
                    taskId: null,
                    taskName: '管理员调整',
                    pointsChange: amount,
                    timestamp: Date.now(),
                    meta: { admin: true },
                };

                set((state) => ({
                    balance: result.newBalance,
                    logs: [log, ...state.logs],
                }));
            }
        } catch (error) {
            console.error('[TimeBank] 调整余额失败:', error);
        }
    },

    // === 切换到站后台通知开关（持久化到 config）===
    setNotifyOnExpire: async (enabled) => {
        const state = get();
        const config = { ...state.config, notifyOnExpire: enabled };
        set({ config });
        try {
            await api.saveData({
                balance: state.balance,
                tasks: state.tasks,
                logs: state.logs,
                timers: state.timers,
                config,
            });
        } catch (error) {
            console.error('[TimeBank] 保存提醒开关失败:', error);
        }
    },

    // === 数据导出 ===
    exportData: () => {
        const state = get();
        return JSON.stringify({
            balance: state.balance,
            tasks: state.tasks,
            logs: state.logs,
            timers: state.timers,
            config: state.config,
            exportedAt: new Date().toISOString(),
        }, null, 2);
    },

    // === 数据导入 ===
    importData: async (jsonStr) => {
        try {
            const data = JSON.parse(jsonStr);
            await api.saveData(data);
            await get().loadData();
            return true;
        } catch {
            return false;
        }
    },
}));

export default useStore;

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { calculatePoints, getDecayRate, getTodayStr, DEFAULT_TASKS } from './engine';

const useStore = create(
    persist(
        (set, get) => ({
            // === 用户数据 ===
            balance: 0,
            tasks: DEFAULT_TASKS,
            logs: [],
            timers: [], // 活跃倒计时

            // === 配置 ===
            config: {
                dailyExchangeLimitWeekday: 60,
                dailyExchangeLimitWeekend: 120,
            },

            // === 每日重置 ===
            checkDailyReset: () => {
                const today = getTodayStr();
                set((state) => ({
                    tasks: state.tasks.map((task) =>
                        task.lastUpdate !== today
                            ? { ...task, dailyCount: 0, lastUpdate: today }
                            : task
                    ),
                }));
            },

            // === 赚取积分 ===
            earnPoints: (taskId, isPerfect) => {
                const state = get();
                const task = state.tasks.find((t) => t.id === taskId);
                if (!task) return 0;

                const points = calculatePoints(task, isPerfect);
                const decayRate = getDecayRate(task.dailyCount);
                const today = getTodayStr();

                const log = {
                    id: `l_${Date.now()}`,
                    type: 'EARN',
                    taskId,
                    taskName: task.name,
                    pointsChange: points,
                    timestamp: Date.now(),
                    meta: {
                        quality: isPerfect ? 'perfect' : 'normal',
                        decayRate,
                        dailyCount: task.dailyCount + 1,
                    },
                };

                set((state) => ({
                    balance: state.balance + points,
                    tasks: state.tasks.map((t) =>
                        t.id === taskId
                            ? { ...t, dailyCount: t.dailyCount + 1, lastUpdate: today }
                            : t
                    ),
                    logs: [log, ...state.logs],
                }));

                return points;
            },

            // === 兑换积分 ===
            redeemPoints: (tier) => {
                const log = {
                    id: `l_${Date.now()}`,
                    type: 'REDEEM',
                    taskId: null,
                    taskName: tier.label,
                    pointsChange: -tier.cost,
                    minutes: tier.totalMinutes,
                    timestamp: Date.now(),
                    meta: { tier: tier.id },
                };

                const timer = {
                    id: `timer_${Date.now()}`,
                    minutes: tier.totalMinutes,
                    startTime: Date.now(),
                    endTime: Date.now() + tier.totalMinutes * 60 * 1000,
                    label: tier.label,
                };

                set((state) => ({
                    balance: state.balance - tier.cost,
                    logs: [log, ...state.logs],
                    timers: [timer, ...state.timers],
                }));

                return timer;
            },

            // === 清除已过期定时器 ===
            clearExpiredTimers: () => {
                const now = Date.now();
                set((state) => ({
                    timers: state.timers.filter((t) => t.endTime > now),
                }));
            },

            // === Admin: 更新任务配置 ===
            updateTask: (taskId, updates) => {
                set((state) => ({
                    tasks: state.tasks.map((t) =>
                        t.id === taskId ? { ...t, ...updates } : t
                    ),
                }));
            },

            // === Admin: 添加任务 ===
            addTask: (task) => {
                set((state) => ({
                    tasks: [...state.tasks, { ...task, id: `t_${Date.now()}`, dailyCount: 0, lastUpdate: getTodayStr() }],
                }));
            },

            // === Admin: 删除任务 ===
            removeTask: (taskId) => {
                set((state) => ({
                    tasks: state.tasks.filter((t) => t.id !== taskId),
                }));
            },

            // === Admin: 手动调整余额 ===
            adjustBalance: (amount) => {
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
                    balance: Math.max(0, state.balance + amount),
                    logs: [log, ...state.logs],
                }));
            },

            // === 数据导出 ===
            exportData: () => {
                const state = get();
                return JSON.stringify({
                    balance: state.balance,
                    tasks: state.tasks,
                    logs: state.logs,
                    config: state.config,
                    exportedAt: new Date().toISOString(),
                }, null, 2);
            },

            // === 数据导入 ===
            importData: (jsonStr) => {
                try {
                    const data = JSON.parse(jsonStr);
                    set({
                        balance: data.balance ?? 0,
                        tasks: data.tasks ?? DEFAULT_TASKS,
                        logs: data.logs ?? [],
                        config: data.config ?? get().config,
                    });
                    return true;
                } catch {
                    return false;
                }
            },
        }),
        {
            name: 'timebank-storage',
        }
    )
);

export default useStore;

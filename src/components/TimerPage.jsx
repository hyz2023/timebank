import { useState, useEffect } from 'react';
import useStore from '../store';

export default function TimerPage() {
    const timers = useStore((s) => s.timers);
    const clearExpiredTimers = useStore((s) => s.clearExpiredTimers);
    const pauseTimer = useStore((s) => s.pauseTimer);
    const resumeTimer = useStore((s) => s.resumeTimer);
    const [now, setNow] = useState(Date.now());

    // 每秒更新
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const activeTimers = timers.filter((t) => t.endTime > now);
    const expiredTimers = timers.filter((t) => t.endTime <= now);

    // 按日期分组
    const grouped = {};
    timers.forEach((timer) => {
        const date = new Date(timer.startTime).toLocaleDateString('zh-CN', {
            month: 'long',
            day: 'numeric',
            weekday: 'short',
        });
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(timer);
    });

    const formatTime = (ms) => {
        if (ms <= 0) return '00:00';
        const totalSec = Math.floor(ms / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-lg">⏱️</span>
                    <h2 className="text-sky font-bold text-lg">飞行计时</h2>
                </div>
                {expiredTimers.length > 0 && (
                    <button
                        className="text-xs text-cloud-dark bg-navy-light px-3 py-1 rounded-full"
                        onClick={clearExpiredTimers}
                    >
                        清除已到站 ×{expiredTimers.length}
                    </button>
                )}
            </div>

            {timers.length === 0 ? (
                <div className="card-comic text-center py-10">
                    <div className="relative z-10">
                        <div className="text-4xl mb-3 opacity-40">✈️</div>
                        <p className="text-cloud-dark text-sm">暂无飞行计划</p>
                        <p className="text-cloud-dark text-xs mt-1">兑换游戏时间后，计时器会出现在这里</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {Object.entries(grouped).map(([date, dateTimers]) => (
                        <div key={date}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-sky/30 to-transparent" />
                                <span className="text-xs text-sky font-bold tracking-wider">{date}</span>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-sky/30 to-transparent" />
                            </div>
                            <div className="space-y-3">
                                {dateTimers.map((timer) => {
                        // 处理暂停状态
                        const isPaused = timer.paused === true;
                        const remaining = isPaused ? timer.remainingMs : (timer.endTime - now);
                        const isActive = remaining > 0;
                        const totalMs = timer.minutes * 60 * 1000;
                        const progress = isActive ? Math.max(0, 1 - remaining / totalMs) : 1;
                        const circumference = 2 * Math.PI * 54;

                        return (
                            <div
                                key={timer.id}
                                className={`card-comic ${!isActive ? 'border-red/30' : isPaused ? 'border-yellow/30' : 'animate-pulse-glow'}`}
                            >
                                <div className="relative z-10 flex items-center gap-4">
                                    {/* 环形进度条 */}
                                    <div className="relative w-24 h-24 shrink-0">
                                        <svg className="w-full h-full progress-ring" viewBox="0 0 120 120">
                                            {/* 背景圆 */}
                                            <circle
                                                cx="60" cy="60" r="54"
                                                fill="none"
                                                stroke="rgba(79,195,247,0.1)"
                                                strokeWidth="6"
                                            />
                                            {/* 进度圆 */}
                                            <circle
                                                cx="60" cy="60" r="54"
                                                fill="none"
                                                stroke={isActive ? (isPaused ? '#fbbf24' : '#4fc3f7') : '#ef5350'}
                                                strokeWidth="6"
                                                strokeLinecap="round"
                                                strokeDasharray={circumference}
                                                strokeDashoffset={circumference * (1 - progress)}
                                                style={{ transition: 'stroke-dashoffset 1s linear' }}
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className={`font-black text-lg ${isActive ? 'text-white' : 'text-red'}`}>
                                                {isActive ? formatTime(remaining) : '到站'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 信息 */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xl">{isActive ? (isPaused ? '⏸️' : '✈️') : '🛬'}</span>
                                            <span className="font-bold text-white">{timer.label}</span>
                                        </div>
                                        <p className="text-xs text-cloud-dark mb-1">
                                            总时长 {timer.minutes} 分钟
                                        </p>
                                        <p className="text-xs text-cloud-dark">
                                            {isPaused ? (
                                                <span className="text-yellow font-bold">⏸️ 已暂停</span>
                                            ) : isActive ? (
                                                <>起飞 {new Date(timer.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</>
                                            ) : (
                                                <span className="text-red font-bold">⚠️ 时间到！</span>
                                            )}
                                        </p>
                                    </div>

                                    {/* 控制按钮 */}
                                    <div className="flex flex-col gap-2 shrink-0">
                                        {isActive && !isPaused && (
                                            <button
                                                className="px-3 py-1.5 bg-yellow/20 hover:bg-yellow/30 text-yellow rounded-lg text-xs font-bold transition-colors"
                                                onClick={() => pauseTimer(timer.id)}
                                            >
                                                ⏸️ 暂停
                                            </button>
                                        )}
                                        {isActive && isPaused && (
                                            <button
                                                className="px-3 py-1.5 bg-green/20 hover:bg-green/30 text-green rounded-lg text-xs font-bold transition-colors"
                                                onClick={() => resumeTimer(timer.id)}
                                            >
                                                ▶️ 继续
                                            </button>
                                        )}
                                        {!isActive && (
                                            <div className="w-3 h-3 rounded-full bg-red" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

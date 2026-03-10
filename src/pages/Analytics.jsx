import { useState, useEffect } from 'react';
import useStore from '../store';

export default function Analytics() {
    const [showAdmin, setShowAdmin] = useState(false);
    const balance = useStore((s) => s.balance);
    const timers = useStore((s) => s.timers);
    const logs = useStore((s) => s.logs);

    // 统计数据
    const totalEarned = logs.filter(log => log.type === 'earn').reduce((sum, log) => sum + log.points, 0);
    const totalRedeemed = logs.filter(log => log.type === 'redeem').reduce((sum, log) => sum + log.points, 0);
    const activeTimerCount = timers.filter((t) => t.endTime > Date.now()).length;

    return (
        <div className="relative min-h-dvh pb-20">
            {/* ===== 天空背景装饰 ===== */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ maxWidth: 480, margin: '0 auto' }}>
                {/* 星星 */}
                <div className="animate-twinkle absolute top-8 left-[15%] text-xs opacity-40">✦</div>
                <div className="animate-twinkle absolute top-16 right-[20%] text-xs opacity-30" style={{ animationDelay: '1s' }}>✦</div>
                <div className="animate-twinkle absolute top-24 left-[60%] text-xs opacity-20" style={{ animationDelay: '2s' }}>✦</div>
                {/* 云朵 */}
                <div className="animate-cloud absolute top-20 -left-4 text-2xl opacity-10">☁️</div>
                <div className="animate-cloud-slow absolute top-40 right-0 text-3xl opacity-8">☁️</div>
            </div>

            {/* ===== 顶部导航栏 ===== */}
            <div className="sticky top-0 z-50 px-4 pt-3 pb-2" style={{ background: 'linear-gradient(180deg, rgba(13,27,42,0.98) 0%, rgba(13,27,42,0.8) 80%, transparent 100%)' }}>
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">📊</span>
                        <h1 className="comic-title text-sky text-xl tracking-wider">数据分析</h1>
                    </div>
                    <button
                        className="text-xl opacity-60 active:opacity-100 transition-opacity p-2"
                        onClick={() => setShowAdmin(true)}
                        aria-label="设置"
                    >
                        ⚙️
                    </button>
                </div>
            </div>

            {/* ===== 页面内容 ===== */}
            <div className="px-4 pb-4 space-y-4">
                {/* 当前余额卡片 */}
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                    <p className="text-cloud-dark text-xs tracking-widest mb-2">当前里程</p>
                    <div className="flex items-baseline gap-2">
                        <span className="comic-title text-4xl text-gold">{balance.toFixed(2)}</span>
                        <span className="text-gold-dark text-sm font-bold">pts</span>
                    </div>
                </div>

                {/* 统计概览 */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-2xl p-4 border border-emerald-500/20">
                        <p className="text-xs text-emerald-300 mb-1">累计获得</p>
                        <p className="comic-title text-2xl text-emerald-400">+{totalEarned.toFixed(2)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-rose-500/20 to-pink-500/10 rounded-2xl p-4 border border-rose-500/20">
                        <p className="text-xs text-rose-300 mb-1">累计消耗</p>
                        <p className="comic-title text-2xl text-rose-400">-{totalRedeemed.toFixed(2)}</p>
                    </div>
                </div>

                {/* 计时器状态 */}
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">⏱️</span>
                        <p className="text-cloud-dark text-sm">活跃计时器</p>
                    </div>
                    <p className="comic-title text-3xl text-sky">{activeTimerCount} 个进行中</p>
                </div>

                {/* 最近记录 */}
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">📋</span>
                        <p className="text-cloud-dark text-sm">最近记录</p>
                    </div>
                    {logs.length === 0 ? (
                        <p className="text-gray-500 text-sm">暂无记录</p>
                    ) : (
                        <div className="space-y-2">
                            {logs.slice(-5).reverse().map((log, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm">
                                    <span className={log.type === 'earn' ? 'text-emerald-400' : 'text-rose-400'}>
                                        {log.type === 'earn' ? '+' : '-'}{log.points} pts
                                    </span>
                                    <span className="text-gray-400 text-xs">{log.description}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

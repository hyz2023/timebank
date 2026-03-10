import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import useStore from './store';
import EarnPage from './components/EarnPage';
import RedeemPage from './components/RedeemPage';
import TimerPage from './components/TimerPage';
import LogsPage from './components/LogsPage';
import AdminPanel from './components/AdminPanel';
import PointsAnimation from './components/PointsAnimation';
import Analytics from './pages/Analytics';

const TABS = [
    { id: 'earn', label: '任务', icon: '🎯' },
    { id: 'redeem', label: '兑换', icon: '✈️' },
    { id: 'timer', label: '计时', icon: '⏱️' },
    { id: 'logs', label: '记录', icon: '📋' },
];

export default function App() {
    const [activeTab, setActiveTab] = useState('earn');
    const [showAdmin, setShowAdmin] = useState(false);
    const [pointsAnim, setPointsAnim] = useState(null);
    const balance = useStore((s) => s.balance);
    const checkDailyReset = useStore((s) => s.checkDailyReset);
    const timers = useStore((s) => s.timers);

    // 开屏日期重置检查
    useEffect(() => {
        checkDailyReset();
    }, [checkDailyReset]);

    // 活跃计时器数量
    const activeTimerCount = timers.filter((t) => t.endTime > Date.now()).length;

    // 单击设置按钮进 Admin
    const handleSettingsClick = () => {
        setShowAdmin(true);
    };

    // 积分动画触发
    const showPointsAnimation = (points, isPerfect) => {
        setPointsAnim({ points, isPerfect, key: Date.now() });
        setTimeout(() => setPointsAnim(null), 2000);
    };

    const renderPage = () => {
        switch (activeTab) {
            case 'earn':
                return <EarnPage onPointsEarned={showPointsAnimation} />;
            case 'redeem':
                return <RedeemPage />;
            case 'timer':
                return <TimerPage />;
            case 'logs':
                return <LogsPage />;
            default:
                return null;
        }
    };

    return (
        <Routes>
            <Route path="/" element={
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
                        <span className="text-2xl">✈️</span>
                        <h1 className="comic-title text-sky text-xl tracking-wider">TIMEBANK</h1>
                    </div>
                    <button
                        className="text-xl opacity-60 active:opacity-100 transition-opacity p-2"
                        onClick={handleSettingsClick}
                        aria-label="设置"
                    >
                        ⚙️
                    </button>
                </div>

                {/* ===== 积分余额展示 ===== */}
                <div className="flex items-center justify-center gap-3 py-3">
                    <div className="text-center">
                        <p className="text-cloud-dark text-xs tracking-widest mb-1">飞行里程</p>
                        <div className="flex items-baseline justify-center gap-1">
                            <span
                                key={balance}
                                className="comic-title text-5xl text-gold animate-count-up"
                                style={{ textShadow: '0 0 20px rgba(255,213,79,0.4), 2px 2px 0 rgba(0,0,0,0.3)' }}
                            >
                                {typeof balance === 'number' ? balance.toFixed(2) : balance}
                            </span>
                            <span className="text-gold-dark text-sm font-bold">pts</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== 页面内容 ===== */}
            <div className="px-4 pb-4">
                {renderPage()}
            </div>

            {/* ===== 底部 Tab 栏 ===== */}
            <nav className="tab-bar">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span className="tab-icon relative">
                            {tab.icon}
                            {tab.id === 'timer' && activeTimerCount > 0 && (
                                <span className="absolute -top-1 -right-2 bg-sunset text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                    {activeTimerCount}
                                </span>
                            )}
                        </span>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </nav>

            {/* ===== 积分获得动画 ===== */}
            {pointsAnim && (
                <PointsAnimation
                    key={pointsAnim.key}
                    points={pointsAnim.points}
                    isPerfect={pointsAnim.isPerfect}
                />
            )}

            {/* ===== Admin 面板 ===== */}
            {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
        </div>
            } />
            <Route path="/analytics" element={<Analytics />} />
        </Routes>
    );
}

import { useState } from 'react';
import useStore from '../store';
import { getDecayRate, CATEGORIES, SORT_MODES } from '../engine';

function TaskCard({ task, onClick, disabled = false }) {
    const nextRate = getDecayRate(task.dailyCount);
    const rateColor = nextRate === 1.0 ? 'text-green' : nextRate === 0.75 ? 'text-gold' : 'text-red';
    const ratePercent = Math.round(nextRate * 100);

    return (
        <button
            className={`card-comic w-full text-left ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
            onClick={() => onClick(task)}
            disabled={disabled}
        >
            <div className="relative z-10 flex items-center gap-3">
                {/* 图标 */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky/20 to-purple/10 flex items-center justify-center text-2xl shrink-0">
                    {task.icon}
                </div>

                {/* 任务信息 */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-base text-white">{task.name}</span>
                        <span className="text-xs text-cloud-dark">{task.desc}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                        <span className="text-cloud-dark">
                            基础 <span className="text-sky font-bold">{task.basePoints}</span>分
                        </span>
                        <span className="text-cloud-dark">
                            今日 <span className="text-gold font-bold">{task.dailyCount}</span>次
                        </span>
                    </div>
                </div>

                {/* 下一次收益率 */}
                <div className="text-right shrink-0">
                    <div className={`text-xs ${rateColor} font-bold`}>
                        Next
                    </div>
                    <div className={`text-lg font-black ${rateColor}`}>
                        {ratePercent}%
                    </div>
                </div>
            </div>
        </button>
    );
}

export default function EarnPage({ onPointsEarned }) {
    const getSortedTasks = useStore((s) => s.getSortedTasks);
    const sortMode = useStore((s) => s.sortMode);
    const setSortMode = useStore((s) => s.setSortMode);
    const earnPoints = useStore((s) => s.earnPoints);
    const [confirmTask, setConfirmTask] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const sortedTasks = getSortedTasks();

    const showSuccess = (message) => {
        setSuccessMsg(message);
        window.setTimeout(() => setSuccessMsg(''), 2200);
    };

    const handleComplete = async (taskId, isPerfect) => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const points = await earnPoints(taskId, isPerfect);
            if (points > 0) {
                setConfirmTask(null);
                if (onPointsEarned) onPointsEarned(points, isPerfect);
                showSuccess(`✅ 已添加 ${points} 分，请勿重复点击`);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleTaskClick = (task) => {
        if (submitting) return;
        setConfirmTask(task);
    };

    // 按分类模式渲染（带分组标题）
    const renderByCategory = () => {
        const groups = {};
        sortedTasks.forEach(task => {
            const cat = task.category || 'other';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(task);
        });

        const catOrder = Object.entries(CATEGORIES).sort((a, b) => a[1].order - b[1].order);

        return catOrder.map(([catKey, catInfo]) => {
            const groupTasks = groups[catKey];
            if (!groupTasks) return null;

            return (
                <div key={catKey} className="mb-4">
                    {/* 分类标题 */}
                    <div className="flex items-center gap-1.5 mb-2 px-1">
                        <span className="text-sm">{catInfo.icon}</span>
                        <span className="text-sm font-bold text-cloud-dark">{catInfo.label}</span>
                        <span className="text-xs text-cloud-dark/60">({groupTasks.length})</span>
                    </div>
                    <div className="space-y-3">
                        {groupTasks.map(task => (
                            <TaskCard key={task.id} task={task} onClick={handleTaskClick} disabled={submitting} />
                        ))}
                    </div>
                </div>
            );
        });
    };

    return (
        <div>
            {successMsg && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[320] rounded-full bg-green px-5 py-2.5 text-sm font-bold text-white shadow-lg">
                    {successMsg}
                </div>
            )}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🎯</span>
                    <h2 className="text-sky font-bold text-lg">今日任务</h2>
                </div>

                {/* 排序切换 */}
                <div className="flex gap-1 bg-navy-dark rounded-lg p-0.5">
                    {Object.entries(SORT_MODES).map(([key, mode]) => (
                        <button
                            key={key}
                            className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${
                                sortMode === key
                                    ? 'bg-sky/20 text-sky'
                                    : 'text-cloud-dark'
                            }`}
                            onClick={() => setSortMode(key)}
                        >
                            {mode.icon} {mode.label}
                        </button>
                    ))}
                </div>
            </div>

            {sortMode === 'category' ? renderByCategory() : (
                <div className="space-y-3">
                    {sortedTasks.map(task => (
                        <TaskCard key={task.id} task={task} onClick={handleTaskClick} disabled={submitting} />
                    ))}
                </div>
            )}

            {/* ===== 确认弹窗 ===== */}
            {confirmTask && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 overlay-enter"
                    onClick={() => !submitting && setConfirmTask(null)}
                >
                    <div
                        className="modal-enter mx-6 w-full max-w-sm rounded-2xl p-6"
                        style={{ background: 'linear-gradient(135deg, #16213e, #1a1a2e)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="text-center mb-5">
                            <div className="text-4xl mb-2">{confirmTask.icon}</div>
                            <h3 className="text-white text-xl font-bold mb-1">{confirmTask.name}</h3>
                            <p className="text-cloud-dark text-sm">
                                第 {confirmTask.dailyCount + 1} 次 · 收益率{' '}
                                <span className={getDecayRate(confirmTask.dailyCount) === 1.0 ? 'text-green' : 'text-gold'}>
                                    {Math.round(getDecayRate(confirmTask.dailyCount) * 100)}%
                                </span>
                            </p>
                        </div>

                        <div className="space-y-3">
                            {confirmTask.bonusPoints > 0 ? (
                                <>
                                    <button
                                        className="btn-secondary w-full flex items-center justify-center gap-2"
                                        onClick={() => handleComplete(confirmTask.id, false)}
                                        disabled={submitting}
                                    >
                                        <span>{submitting ? '⏳' : '👍'}</span>
                                        <span>{submitting ? '正在添加...' : 'Excellent'}</span>
                                        <span className="text-xs opacity-70">+{(confirmTask.basePoints * getDecayRate(confirmTask.dailyCount)).toFixed(2)}分</span>
                                    </button>

                                    <button
                                        className="btn-primary w-full flex items-center justify-center gap-2"
                                        onClick={() => handleComplete(confirmTask.id, true)}
                                        disabled={submitting}
                                    >
                                        <span>{submitting ? '⏳' : '⭐'}</span>
                                        <span>{submitting ? '正在添加...' : 'Perfect'}</span>
                                        <span className="text-xs opacity-90">+{((confirmTask.basePoints + confirmTask.bonusPoints) * getDecayRate(confirmTask.dailyCount)).toFixed(2)}分</span>
                                    </button>
                                </>
                            ) : (
                                <button
                                    className="btn-primary w-full flex items-center justify-center gap-2"
                                    onClick={() => handleComplete(confirmTask.id, false)}
                                    disabled={submitting}
                                >
                                    <span>{submitting ? '⏳' : '👍'}</span>
                                    <span>{submitting ? '正在添加...' : 'Excellent'}</span>
                                    <span className="text-xs opacity-70">+{(confirmTask.basePoints * getDecayRate(confirmTask.dailyCount)).toFixed(2)}分</span>
                                </button>
                            )}

                            <button
                                className="w-full text-center text-cloud-dark text-sm py-2 disabled:opacity-50"
                                onClick={() => !submitting && setConfirmTask(null)}
                                disabled={submitting}
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

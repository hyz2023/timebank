import { useState } from 'react';
import useStore from '../store';
import { getDecayRate } from '../engine';

export default function EarnPage({ onPointsEarned }) {
    const tasks = useStore((s) => s.tasks);
    const earnPoints = useStore((s) => s.earnPoints);
    const [confirmTask, setConfirmTask] = useState(null);

    const handleComplete = (taskId, isPerfect) => {
        const points = earnPoints(taskId, isPerfect);
        setConfirmTask(null);
        if (onPointsEarned) onPointsEarned(points, isPerfect);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🎯</span>
                <h2 className="text-sky font-bold text-lg">今日任务</h2>
            </div>

            {tasks.map((task) => {
                const nextRate = getDecayRate(task.dailyCount);
                const rateColor = nextRate === 1.0 ? 'text-green' : nextRate === 0.75 ? 'text-gold' : 'text-red';
                const ratePercent = Math.round(nextRate * 100);

                return (
                    <button
                        key={task.id}
                        className="card-comic w-full text-left"
                        onClick={() => setConfirmTask(task)}
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
            })}

            {/* ===== 确认弹窗 ===== */}
            {confirmTask && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 overlay-enter"
                    onClick={() => setConfirmTask(null)}
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
                                    >
                                        <span>👍</span>
                                        <span>Excellent</span>
                                        <span className="text-xs opacity-70">+{(confirmTask.basePoints * getDecayRate(confirmTask.dailyCount)).toFixed(2)}分</span>
                                    </button>

                                    <button
                                        className="btn-primary w-full flex items-center justify-center gap-2"
                                        onClick={() => handleComplete(confirmTask.id, true)}
                                    >
                                        <span>⭐</span>
                                        <span>Perfect</span>
                                        <span className="text-xs opacity-90">+{((confirmTask.basePoints + confirmTask.bonusPoints) * getDecayRate(confirmTask.dailyCount)).toFixed(2)}分</span>
                                    </button>
                                </>
                            ) : (
                                <button
                                    className="btn-primary w-full flex items-center justify-center gap-2"
                                    onClick={() => handleComplete(confirmTask.id, false)}
                                >
                                    <span>👍</span>
                                    <span>Excellent</span>
                                    <span className="text-xs opacity-70">+{(confirmTask.basePoints * getDecayRate(confirmTask.dailyCount)).toFixed(2)}分</span>
                                </button>
                            )}

                            <button
                                className="w-full text-center text-cloud-dark text-sm py-2"
                                onClick={() => setConfirmTask(null)}
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

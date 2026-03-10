import { useState } from 'react';
import useStore from '../store';
import { EXCHANGE_TIERS, canRedeem, getTodayRedeemedMinutes, getDailyLimit } from '../engine';

export default function RedeemPage() {
    const balance = useStore((s) => s.balance);
    const logs = useStore((s) => s.logs);
    const redeemPoints = useStore((s) => s.redeemPoints);
    const [confirmTier, setConfirmTier] = useState(null);

    const todayRedeemed = getTodayRedeemedMinutes(logs);
    const dailyLimit = getDailyLimit();
    const remaining = Math.max(0, dailyLimit - todayRedeemed);
    const isWeekend = [0, 6].includes(new Date().getDay());

    const handleRedeem = () => {
        if (!confirmTier) return;
        redeemPoints(confirmTier);
        setConfirmTier(null);
    };

    return (
        <div className="space-y-4">
            {/* 今日额度信息 */}
            <div className="card-comic">
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🛫</span>
                            <h2 className="text-sky font-bold">今日飞行额度</h2>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isWeekend ? 'bg-green/20 text-green' : 'bg-sky/20 text-sky'}`}>
                            {isWeekend ? '周末' : '工作日'}
                        </span>
                    </div>

                    {/* 进度条 */}
                    <div className="w-full h-3 bg-navy-dark rounded-full overflow-hidden mb-1.5">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${Math.min(100, (todayRedeemed / dailyLimit) * 100)}%`,
                                background: todayRedeemed >= dailyLimit
                                    ? 'linear-gradient(90deg, #ef5350, #e53935)'
                                    : 'linear-gradient(90deg, #4fc3f7, #81d4fa)',
                            }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-cloud-dark">
                        <span>已用 {todayRedeemed}分钟</span>
                        <span>剩余 <span className={remaining > 0 ? 'text-green font-bold' : 'text-red font-bold'}>{remaining}分钟</span> / {dailyLimit}分钟</span>
                    </div>
                </div>
            </div>

            {/* 兑换卡片 */}
            <div className="flex items-center gap-2 mt-2">
                <span className="text-lg">✈️</span>
                <h2 className="text-sky font-bold text-lg">航线兑换</h2>
            </div>

            {EXCHANGE_TIERS.map((tier) => {
                const check = canRedeem(tier, balance, logs);
                const disabled = !check.ok;

                return (
                    <button
                        key={tier.id}
                        className={`card-comic w-full text-left ${disabled ? 'card-disabled' : ''}`}
                        onClick={() => !disabled && setConfirmTier(tier)}
                        disabled={disabled}
                    >
                        <div className="relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0"
                                    style={{ background: tier.id === 'basic' ? 'linear-gradient(135deg, rgba(79,195,247,0.2), rgba(79,195,247,0.05))' : tier.id === 'advanced' ? 'linear-gradient(135deg, rgba(255,213,79,0.2), rgba(255,213,79,0.05))' : 'linear-gradient(135deg, rgba(255,107,53,0.2), rgba(255,107,53,0.05))' }}>
                                    {tier.icon}
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-bold text-white text-base">{tier.label}</span>
                                        <span className="text-xs text-cloud-dark">{tier.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-gold font-bold">{tier.cost} pts</span>
                                        <span className="text-cloud-dark">→</span>
                                        <span className="text-sky font-bold">{tier.totalMinutes}分钟</span>
                                        {tier.bonusMinutes > 0 && (
                                            <span className="text-green text-[10px] bg-green/10 px-1.5 py-0.5 rounded-full">
                                                +{tier.bonusMinutes}分钟
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="text-right shrink-0">
                                    {disabled ? (
                                        <span className="text-xs text-red">{check.reason}</span>
                                    ) : (
                                        <div className="text-sky text-sm font-bold">兑换 →</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </button>
                );
            })}

            {/* ===== 兑换确认弹窗 ===== */}
            {confirmTier && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 overlay-enter"
                    onClick={() => setConfirmTier(null)}
                >
                    <div
                        className="modal-enter mx-6 w-full max-w-sm rounded-2xl p-6"
                        style={{ background: 'linear-gradient(135deg, #16213e, #1a1a2e)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="text-center mb-5">
                            <div className="text-5xl mb-3">{confirmTier.icon}</div>
                            <h3 className="text-white text-xl font-bold mb-1">{confirmTier.label}</h3>
                            <p className="text-cloud-dark text-sm">确认兑换以下游戏时间？</p>
                        </div>

                        <div className="card-comic mb-5">
                            <div className="relative z-10 flex justify-around text-center">
                                <div>
                                    <p className="text-xs text-cloud-dark mb-1">消耗积分</p>
                                    <p className="text-gold font-black text-2xl">{confirmTier.cost}</p>
                                </div>
                                <div className="w-px bg-sky/20" />
                                <div>
                                    <p className="text-xs text-cloud-dark mb-1">获得时长</p>
                                    <p className="text-sky font-black text-2xl">{confirmTier.totalMinutes}<span className="text-sm">min</span></p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                className="btn-secondary flex-1"
                                onClick={() => setConfirmTier(null)}
                            >
                                取消
                            </button>
                            <button
                                className="btn-primary flex-1"
                                onClick={handleRedeem}
                            >
                                确认兑换 ✈️
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

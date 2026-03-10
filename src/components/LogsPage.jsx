import useStore from '../store';

export default function LogsPage() {
    const logs = useStore((s) => s.logs);

    // 按日期分组
    const grouped = {};
    logs.forEach((log) => {
        const date = new Date(log.timestamp).toLocaleDateString('zh-CN', {
            month: 'long',
            day: 'numeric',
            weekday: 'short',
        });
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(log);
    });

    const formatTime = (ts) => {
        return new Date(ts).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <h2 className="text-sky font-bold text-lg">飞行日志</h2>
                <span className="text-xs text-cloud-dark ml-auto">共 {logs.length} 条</span>
            </div>

            {logs.length === 0 ? (
                <div className="card-comic text-center py-10">
                    <div className="relative z-10">
                        <div className="text-4xl mb-3 opacity-40">📋</div>
                        <p className="text-cloud-dark text-sm">暂无飞行记录</p>
                        <p className="text-cloud-dark text-xs mt-1">完成任务或兑换后，记录会出现在这里</p>
                    </div>
                </div>
            ) : (
                Object.entries(grouped).map(([date, dateLogs]) => (
                    <div key={date}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-sky/30 to-transparent" />
                            <span className="text-xs text-sky font-bold tracking-wider">{date}</span>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-sky/30 to-transparent" />
                        </div>

                        <div className="space-y-2">
                            {dateLogs.map((log) => (
                                <div key={log.id} className="card-comic py-3 px-4">
                                    <div className="relative z-10 flex items-center gap-3">
                                        {/* 类型图标 */}
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 ${log.type === 'EARN'
                                                ? 'bg-green/15'
                                                : 'bg-sunset/15'
                                            }`}>
                                            {log.type === 'EARN' ? '📈' : '🎮'}
                                        </div>

                                        {/* 信息 */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-bold text-white truncate">{log.taskName}</span>
                                                {log.meta?.quality === 'perfect' && (
                                                    <span className="text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full">⭐完美</span>
                                                )}
                                                {log.meta?.admin && (
                                                    <span className="text-[10px] bg-purple/20 text-purple px-1.5 py-0.5 rounded-full">管理</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-cloud-dark">{formatTime(log.timestamp)}</span>
                                                {log.meta?.decayRate != null && log.meta.decayRate < 1 && (
                                                    <span className="text-[10px] text-gold">衰减 {Math.round(log.meta.decayRate * 100)}%</span>
                                                )}
                                                {log.minutes && (
                                                    <span className="text-[10px] text-sky">{log.minutes}分钟</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* 积分变化 */}
                                        <span className={`text-base font-black shrink-0 ${log.pointsChange >= 0 ? 'text-green' : 'text-sunset'
                                            }`}>
                                            {log.pointsChange >= 0 ? '+' : ''}{log.pointsChange}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

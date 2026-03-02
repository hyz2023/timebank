export default function PointsAnimation({ points, isPerfect }) {
    return (
        <div className="fixed inset-0 z-[300] pointer-events-none flex items-center justify-center">
            {/* 背景闪光 */}
            <div
                className="absolute inset-0 animate-points-fade"
                style={{
                    background: isPerfect
                        ? 'radial-gradient(circle, rgba(255,213,79,0.15) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(79,195,247,0.1) 0%, transparent 70%)',
                }}
            />

            {/* 飞机飞过 */}
            <div className="absolute top-1/3 left-0 animate-fly text-4xl">
                ✈️
            </div>

            {/* 积分数字 */}
            <div className="animate-points-earned text-center">
                <div
                    className="comic-title text-7xl mb-2"
                    style={{
                        color: isPerfect ? '#ffd54f' : '#4fc3f7',
                        textShadow: isPerfect
                            ? '0 0 30px rgba(255,213,79,0.6), 3px 3px 0 rgba(0,0,0,0.3)'
                            : '0 0 30px rgba(79,195,247,0.6), 3px 3px 0 rgba(0,0,0,0.3)',
                    }}
                >
                    +{points}
                </div>
                <div
                    className="text-lg font-bold"
                    style={{ color: isPerfect ? '#ffe082' : '#81d4fa' }}
                >
                    {isPerfect ? '⭐ PERFECT! ⭐' : '✈️ NICE FLIGHT!'}
                </div>
            </div>

            {/* 星星粒子 */}
            {isPerfect && (
                <>
                    <div className="absolute animate-twinkle text-2xl" style={{ top: '30%', left: '20%', animationDelay: '0s' }}>✦</div>
                    <div className="absolute animate-twinkle text-xl" style={{ top: '25%', right: '25%', animationDelay: '0.3s' }}>✦</div>
                    <div className="absolute animate-twinkle text-3xl" style={{ top: '40%', left: '30%', animationDelay: '0.6s' }}>✦</div>
                    <div className="absolute animate-twinkle text-lg" style={{ top: '35%', right: '15%', animationDelay: '0.9s' }}>✦</div>
                </>
            )}
        </div>
    );
}

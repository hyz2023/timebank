import { useState } from 'react';

export default function LoginPage({ onSuccess }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            if (res.ok) {
                onSuccess();
            } else if (res.status === 429) {
                setError('尝试过于频繁，请稍后再试');
            } else {
                setError('密码错误');
            }
        } catch {
            setError('网络错误，请重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh flex flex-col items-center justify-center px-6">
            <div className="text-5xl mb-4">✈️</div>
            <h1 className="comic-title text-sky text-2xl tracking-wider mb-6">TIMEBANK</h1>
            <form onSubmit={submit} className="w-full max-w-xs flex flex-col gap-3">
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    autoFocus
                    className="w-full rounded-xl px-4 py-3 bg-white/10 text-cloud text-center text-lg outline-none focus:ring-2 focus:ring-sky"
                />
                {error && <p className="text-red text-sm text-center">{error}</p>}
                <button type="submit" className="btn-primary w-full" disabled={loading || !password}>
                    {loading ? '登录中…' : '进入'}
                </button>
            </form>
        </div>
    );
}

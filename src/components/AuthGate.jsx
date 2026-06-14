import { useState, useEffect } from 'react';
import LoginPage from './LoginPage';

export default function AuthGate({ children }) {
    const [status, setStatus] = useState('checking'); // checking | authed | anon

    useEffect(() => {
        fetch('/api/session', { credentials: 'include' })
            .then((r) => setStatus(r.ok ? 'authed' : 'anon'))
            .catch(() => setStatus('anon'));
    }, []);

    if (status === 'checking') {
        return (
            <div className="min-h-dvh flex flex-col items-center justify-center">
                <div className="text-6xl mb-4 animate-bounce">✈️</div>
                <p className="text-cloud text-lg font-bold">正在加载…</p>
            </div>
        );
    }
    if (status === 'anon') {
        return <LoginPage onSuccess={() => setStatus('authed')} />;
    }
    return children;
}

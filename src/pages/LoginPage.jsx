import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from || '/';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    if (user) {
        return <Navigate to={from} replace />;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            await login(email, password);
            navigate(from, { replace: true });
        } catch (err) {
            const code = err?.code || '';
            if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
                setError('Correo o contraseña incorrectos');
            } else if (code === 'auth/too-many-requests') {
                setError('Demasiados intentos. Intenta más tarde.');
            } else {
                setError(err?.message || 'No se pudo iniciar sesión');
            }
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <img src="/guardian_logo.png" alt="Guardian" className="login-logo" />
                <h1 className="login-title">Guardian</h1>
                <p className="login-subtitle">Panel de comunidad</p>

                <form onSubmit={handleSubmit} className="login-form">
                    <label className="login-label">
                        Correo electrónico
                        <input
                            className="login-input"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            required
                        />
                    </label>
                    <label className="login-label">
                        Contraseña
                        <input
                            className="login-input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                        />
                    </label>
                    {error && <div className="login-error">{error}</div>}
                    <button type="submit" className="admin-btn-primary login-submit" disabled={busy}>
                        <LogIn size={18} />
                        {busy ? 'Entrando…' : 'Iniciar sesión'}
                    </button>
                </form>
            </div>
        </div>
    );
}

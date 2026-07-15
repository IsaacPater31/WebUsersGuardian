import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/features/auth/ui/AuthProvider';

export default function LoginPage() {
    const { user, login, loginWithGoogle } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from || '/';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [googleBusy, setGoogleBusy] = useState(false);
    const [error, setError] = useState('');

    if (user) {
        return <Navigate to={from} replace />;
    }

    async function handleGoogleLogin() {
        setError('');
        setGoogleBusy(true);
        try {
            const signedInUser = await loginWithGoogle();
            if (signedInUser) {
                navigate(from, { replace: true });
            }
        } catch (err) {
            const code = err?.code || '';
            if (code === 'auth/account-exists-with-different-credential') {
                setError('Ya existe una cuenta con este correo usando otro método de inicio de sesión.');
            } else if (code === 'auth/popup-blocked') {
                setError('El navegador bloqueó la ventana emergente. Permite ventanas emergentes e intenta de nuevo.');
            } else if (code === 'auth/unauthorized-domain') {
                setError(
                    'Este dominio no está autorizado en Firebase. Agrega web-users-guardian.vercel.app en Authentication → Settings → Authorized domains.',
                );
            } else {
                setError(err?.message || 'No se pudo iniciar sesión con Google');
            }
        } finally {
            setGoogleBusy(false);
        }
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

    const isBusy = busy || googleBusy;

    return (
        <div className="login-page">
            <div className="login-card">
                <img src="/guardian_logo.png" alt="Guardian" className="login-logo" />
                <h1 className="login-title">Guardian</h1>
                <p className="login-subtitle">Panel de comunidad</p>

                <button
                    type="button"
                    className="login-google-btn"
                    onClick={handleGoogleLogin}
                    disabled={isBusy}
                >
                    <img src="/google_icon.png" alt="" className="login-google-icon" />
                    {googleBusy ? 'Conectando…' : 'Continuar con Google'}
                </button>

                <div className="login-divider">o</div>

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
                    <button type="submit" className="admin-btn-primary login-submit" disabled={isBusy}>
                        <LogIn size={18} />
                        {busy ? 'Entrando…' : 'Iniciar sesión'}
                    </button>
                </form>
            </div>
        </div>
    );
}

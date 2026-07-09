import { useState } from 'react';
import { User, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { changeUserPassword, updateUserProfile } from '../services/profileService';

export default function ProfilePage() {
    const { user } = useAuth();
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [profileBusy, setProfileBusy] = useState(false);
    const [passBusy, setPassBusy] = useState(false);
    const [profileOk, setProfileOk] = useState('');
    const [profileErr, setProfileErr] = useState('');
    const [passOk, setPassOk] = useState('');
    const [passErr, setPassErr] = useState('');

    async function saveProfile(e) {
        e.preventDefault();
        setProfileErr('');
        setProfileOk('');
        setProfileBusy(true);
        try {
            await updateUserProfile({ displayName });
            setProfileOk('Perfil actualizado.');
        } catch (err) {
            setProfileErr(err?.message || 'Error al guardar');
        } finally {
            setProfileBusy(false);
        }
    }

    async function savePassword(e) {
        e.preventDefault();
        setPassErr('');
        setPassOk('');
        setPassBusy(true);
        try {
            await changeUserPassword({ currentPassword, newPassword });
            setPassOk('Contraseña actualizada.');
            setCurrentPassword('');
            setNewPassword('');
        } catch (err) {
            const code = err?.code || '';
            if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                setPassErr('Contraseña actual incorrecta');
            } else {
                setPassErr(err?.message || 'No se pudo cambiar la contraseña');
            }
        } finally {
            setPassBusy(false);
        }
    }

    return (
        <div className="profile-page">
            <section className="section section--dash" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="section-header">
                    <div className="section-header-left">
                        <div className="section-icon" style={{ background: 'rgba(0,122,255,0.1)' }}>
                            <User size={18} style={{ color: '#007AFF' }} />
                        </div>
                        <h2 className="section-title">Tu cuenta</h2>
                    </div>
                </div>
                <div className="section-body">
                    <p className="admin-muted" style={{ marginBottom: 'var(--space-3)' }}>
                        {user?.email}
                    </p>
                    <form onSubmit={saveProfile} className="admin-modal-form">
                        <label className="login-label">
                            Nombre para mostrar
                            <input
                                className="login-input"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                required
                            />
                        </label>
                        {profileErr && <div className="login-error">{profileErr}</div>}
                        {profileOk && <p className="admin-muted">{profileOk}</p>}
                        <button type="submit" className="admin-btn-primary" disabled={profileBusy}>
                            Guardar perfil
                        </button>
                    </form>
                </div>
            </section>

            <section className="section section--dash">
                <div className="section-header">
                    <div className="section-header-left">
                        <div className="section-icon" style={{ background: 'rgba(255,149,0,0.12)' }}>
                            <Lock size={18} style={{ color: '#FF9500' }} />
                        </div>
                        <h2 className="section-title">Cambiar contraseña</h2>
                    </div>
                </div>
                <div className="section-body">
                    <form onSubmit={savePassword} className="admin-modal-form">
                        <label className="login-label">
                            Contraseña actual
                            <input
                                className="login-input"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                            />
                        </label>
                        <label className="login-label">
                            Nueva contraseña
                            <input
                                className="login-input"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                minLength={6}
                                required
                            />
                        </label>
                        {passErr && <div className="login-error">{passErr}</div>}
                        {passOk && <p className="admin-muted">{passOk}</p>}
                        <button type="submit" className="admin-btn-primary" disabled={passBusy}>
                            Actualizar contraseña
                        </button>
                    </form>
                </div>
            </section>
        </div>
    );
}

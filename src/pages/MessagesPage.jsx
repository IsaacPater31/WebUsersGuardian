import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { MessageSquare, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchSentMessages, sendCommunityMessage } from '../services/messageService';

export default function MessagesPage() {
    const { user, manageableMemberships, canSendMessages, memberships } = useAuth();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [history, setHistory] = useState([]);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [ok, setOk] = useState('');

    const communities = manageableMemberships.map((m) => m.community);

    useEffect(() => {
        if (!user?.uid) return;
        fetchSentMessages(user.uid).then(setHistory).catch(() => setHistory([]));
    }, [user?.uid]);

    if (!canSendMessages) {
        return <Navigate to="/" replace />;
    }

    function toggleCommunity(id) {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setErr('');
        setOk('');
        setBusy(true);
        try {
            await sendCommunityMessage({
                title,
                body,
                communityIds: selectedIds,
                senderId: user.uid,
                senderName: user.displayName || user.email || 'Administrador',
                memberships,
            });
            setOk('Mensaje enviado a los miembros seleccionados.');
            setTitle('');
            setBody('');
            setSelectedIds([]);
            const updated = await fetchSentMessages(user.uid);
            setHistory(updated);
        } catch (ex) {
            setErr(ex?.message || 'No se pudo enviar');
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <section className="section section--dash" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="section-header">
                    <div className="section-header-left">
                        <div className="section-icon" style={{ background: 'rgba(0,122,255,0.1)' }}>
                            <Send size={18} style={{ color: '#007AFF' }} />
                        </div>
                        <div>
                            <h2 className="section-title">Nuevo mensaje</h2>
                            <p className="section-subtitle">
                                Broadcast a todos los miembros de las comunidades seleccionadas
                            </p>
                        </div>
                    </div>
                </div>
                <div className="section-body">
                    <form onSubmit={handleSubmit} className="admin-modal-form">
                        <label className="login-label">
                            Comunidades destino
                            <div className="message-community-picks">
                                {communities.map((c) => (
                                    <label key={c.id} className="message-community-pick">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(c.id)}
                                            onChange={() => toggleCommunity(c.id)}
                                        />
                                        {c.name}
                                    </label>
                                ))}
                            </div>
                        </label>
                        <label className="login-label">
                            Título
                            <input
                                className="login-input"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                            />
                        </label>
                        <label className="login-label">
                            Mensaje
                            <textarea
                                className="login-input admin-textarea"
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                rows={4}
                                required
                            />
                        </label>
                        {err && <div className="login-error">{err}</div>}
                        {ok && <p className="admin-muted">{ok}</p>}
                        <button type="submit" className="admin-btn-primary" disabled={busy}>
                            <Send size={16} /> Enviar mensaje
                        </button>
                    </form>
                </div>
            </section>

            <section className="section section--dash">
                <div className="section-header">
                    <div className="section-header-left">
                        <div className="section-icon" style={{ background: 'rgba(0,0,0,0.04)' }}>
                            <MessageSquare size={18} />
                        </div>
                        <h3 className="section-title">Historial enviado</h3>
                    </div>
                </div>
                <div className="section-body">
                    {history.length === 0 ? (
                        <p className="admin-muted">Aún no has enviado mensajes.</p>
                    ) : (
                        <ul className="message-history-list">
                            {history.map((m) => (
                                <li key={m.id} className="message-history-item">
                                    <strong>{m.title}</strong>
                                    <p>{m.body}</p>
                                    <span className="admin-muted">
                                        {m.communityIds?.length ?? 0} comunidad(es)
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>
        </>
    );
}

import { Link2 } from 'lucide-react';

/**
 * Invitation link section for community/entity managers.
 */
export default function CommunityInvitePanel({
    busy,
    inviteUrl,
    inviteErr,
    onGenerate,
}) {
    return (
        <section className="section section--dash" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="section-header">
                <div className="section-header-left">
                    <div className="section-icon" style={{ background: 'rgba(0,122,255,0.1)' }}>
                        <Link2 size={18} style={{ color: '#007AFF' }} />
                    </div>
                    <div>
                        <h3 className="section-title">Invitación</h3>
                        <p className="section-subtitle">Genera un enlace válido por 12 horas</p>
                    </div>
                </div>
            </div>
            <div className="section-body">
                <button type="button" className="admin-btn-primary" onClick={onGenerate} disabled={busy}>
                    <Link2 size={16} /> Generar y copiar enlace
                </button>
                {inviteUrl && <p className="admin-muted" style={{ marginTop: 8 }}>{inviteUrl}</p>}
                {inviteErr && <div className="login-error">{inviteErr}</div>}
            </div>
        </section>
    );
}

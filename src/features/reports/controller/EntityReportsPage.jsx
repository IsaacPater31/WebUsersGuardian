import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import { subscribeToCommunityAlerts } from '@/features/alerts/repository/alertRepository';
import { AlertStatus, getAlertColor, getAlertIcon, getAlertLabel, getTimeAgo } from '@/shared/config/alertTypes';
import { getSubtypeLabel } from '@/features/alerts/utils/alertSubtype';
import { filterAlertsByUser } from '@/features/alerts/utils/alertScope';
import AlertDetailModal from '@/features/alerts/ui/AlertDetailModal';

function ReportRow({ alert, onClick }) {
    const color = getAlertColor(alert.alertType, alert);
    const iconName = getAlertIcon(alert.alertType, alert);
    const Icon = LucideIcons[iconName] || LucideIcons.AlertTriangle;
    const sub = getSubtypeLabel(alert.alertType, alert.subtype, alert.customDetail, true);
    const isAttended = alert.alertStatus === AlertStatus.ATTENDED;
    const label = getAlertLabel(alert.alertType, alert);

    return (
        <div
            className="report-row"
            onClick={() => onClick(alert)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick(alert);
                }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Reporte ${label}`}
        >
            <div className="report-row-icon" style={{ background: `${color}15` }}>
                <Icon style={{ color, width: 18, height: 18 }} aria-hidden />
            </div>
            <div className="report-row-body">
                <div className="report-row-title">{label}</div>
                {sub && <div className="report-row-sub">{sub}</div>}
                <div className="report-row-meta">
                    {alert.isAnonymous ? 'Anónimo' : (alert.userName || alert.userEmail || 'Usuario')}
                    {' · '}
                    {getTimeAgo(alert.timestamp)}
                </div>
            </div>
            <span className="report-status-pill">
                {isAttended ? 'Atendido' : 'Pendiente'}
            </span>
        </div>
    );
}

/** Flat “my reports” view for entity members who are not officials. */
export default function EntityReportsPage() {
    const { id: entityId } = useParams();
    const { user, memberships, loading: authLoading } = useAuth();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);

    const membership = memberships.find((m) => m.communityId === entityId);
    const entity = membership?.community;

    useEffect(() => {
        if (!entityId || !user) return undefined;
        setLoading(true);
        const unsub = subscribeToCommunityAlerts(entityId, (data) => {
            const sorted = [...data].sort((a, b) => {
                const ta = a.timestamp?.toDate?.() ?? new Date(0);
                const tb = b.timestamp?.toDate?.() ?? new Date(0);
                return tb - ta;
            });
            setReports(filterAlertsByUser(sorted, user.uid));
            setLoading(false);
        });
        return unsub;
    }, [entityId, user]);

    if (authLoading || loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner" />
            </div>
        );
    }

    if (!entity) {
        return (
            <>
                <Link to="/reports" className="admin-back"><ArrowLeft size={18} /> Reportes</Link>
                <p className="admin-muted">Entidad no encontrada o sin acceso.</p>
            </>
        );
    }

    return (
        <>
            <Link to="/reports" className="admin-back" style={{ marginBottom: 'var(--space-4)' }}>
                <ArrowLeft size={18} /> Reportes
            </Link>

            <section className="section section--dash" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="section-header">
                    <div className="section-header-left">
                        <div className="section-icon" style={{ background: 'rgba(13, 27, 62, 0.1)' }}>
                            <Building2 size={18} style={{ color: '#0d1b3e' }} />
                        </div>
                        <div>
                            <h2 className="section-title">{entity.name}</h2>
                            <p className="section-subtitle">
                                Historial de reportes que has enviado
                            </p>
                        </div>
                    </div>
                </div>
                <div className="section-body">
                    {reports.length === 0 ? (
                        <p className="admin-muted admin-empty-inset">
                            Aún no has enviado reportes a esta entidad.
                        </p>
                    ) : (
                        <div className="report-list">
                            {reports.map((r) => (
                                <ReportRow
                                    key={r.id}
                                    alert={r}
                                    onClick={setSelected}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {selected && (
                <AlertDetailModal
                    alert={selected}
                    onClose={() => setSelected(null)}
                />
            )}
        </>
    );
}

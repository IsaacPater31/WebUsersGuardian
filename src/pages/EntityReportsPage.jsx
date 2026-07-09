import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getCommunityAlerts, updateAlertStatus } from '../services/alertService';
import { AlertStatus, getAlertColor, getAlertIcon, getAlertLabel } from '../config/alertTypes';
import { canViewEntityInbox } from '../utils/permissions';
import { getSubtypeLabel } from '../utils/alertSubtype';
import { filterAlertsByUser } from '../utils/alertScope';
import AlertDetailModal from '../components/AlertDetailModal';
import { getTimeAgo } from '../config/alertTypes';

const STATUS_OPTIONS = [
    { value: AlertStatus.PENDING, label: 'Pendiente' },
    { value: AlertStatus.ATTENDED, label: 'Atendido' },
];

function ReportRow({ alert, onClick, canManage, onStatusChange, busy }) {
    const color = getAlertColor(alert.alertType);
    const iconName = getAlertIcon(alert.alertType);
    const Icon = LucideIcons[iconName] || LucideIcons.AlertTriangle;
    const sub = getSubtypeLabel(alert.alertType, alert.subtype, alert.customDetail, true);

    return (
        <div className="report-row" onClick={() => onClick(alert)}>
            <div className="report-row-icon" style={{ background: `${color}15` }}>
                <Icon style={{ color, width: 18, height: 18 }} />
            </div>
            <div className="report-row-body">
                <div className="report-row-title">{getAlertLabel(alert.alertType)}</div>
                {sub && <div className="report-row-sub">{sub}</div>}
                <div className="report-row-meta">
                    {alert.isAnonymous ? 'Anónimo' : (alert.userName || alert.userEmail || 'Usuario')}
                    {' · '}
                    {getTimeAgo(alert.timestamp)}
                </div>
            </div>
            {canManage ? (
                <select
                    className="login-input admin-select-inline"
                    value={alert.alertStatus}
                    disabled={busy}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onStatusChange(alert.id, e.target.value)}
                >
                    {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
            ) : (
                <span className="report-status-pill">{alert.alertStatus === AlertStatus.ATTENDED ? 'Atendido' : 'Pendiente'}</span>
            )}
        </div>
    );
}

export default function EntityReportsPage() {
    const { id: entityId } = useParams();
    const { user, memberships, loading: authLoading } = useAuth();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [busy, setBusy] = useState(false);

    const membership = memberships.find((m) => m.communityId === entityId);
    const entity = membership?.community;
    const isOfficial = entity ? canViewEntityInbox(entity, membership.role) : false;

    const load = useCallback(async () => {
        if (!entityId || !user) return;
        setLoading(true);
        try {
            let data = await getCommunityAlerts(entityId);
            if (!isOfficial) {
                data = filterAlertsByUser(data, user.uid);
            }
            data.sort((a, b) => {
                const ta = a.timestamp?.toDate?.() ?? new Date(0);
                const tb = b.timestamp?.toDate?.() ?? new Date(0);
                return tb - ta;
            });
            setReports(data);
        } catch (e) {
            console.error(e);
            setReports([]);
        } finally {
            setLoading(false);
        }
    }, [entityId, user, isOfficial]);

    useEffect(() => {
        load();
    }, [load]);

    async function handleStatusChange(alertId, status) {
        setBusy(true);
        try {
            await updateAlertStatus(alertId, status);
            await load();
        } catch (e) {
            alert(e?.message || 'No se pudo actualizar');
        } finally {
            setBusy(false);
        }
    }

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
                                {isOfficial
                                    ? 'Bandeja de reportes recibidos'
                                    : 'Historial de reportes que has enviado'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="section-body">
                    {reports.length === 0 ? (
                        <p className="admin-muted admin-empty-inset">
                            {isOfficial ? 'No hay reportes en esta entidad.' : 'Aún no has enviado reportes a esta entidad.'}
                        </p>
                    ) : (
                        <div className="report-list">
                            {reports.map((r) => (
                                <ReportRow
                                    key={r.id}
                                    alert={r}
                                    onClick={setSelected}
                                    canManage={isOfficial}
                                    onStatusChange={handleStatusChange}
                                    busy={busy}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {isOfficial && (
                <p className="admin-muted">
                    <Link to={`/communities/${entityId}`}>Gestionar miembros y configuración →</Link>
                </p>
            )}

            {selected && (
                <AlertDetailModal alert={selected} onClose={() => setSelected(null)} />
            )}
        </>
    );
}

import { useEffect, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Eye, Forward, Flag, EyeOff, User, X, Users } from 'lucide-react';
import { getAlertColor, getAlertIcon, getAlertLabel, getTimeAgo } from '@/shared/config/alertTypes';
import { getCommunityNames } from '@/features/communities/repository/communityRepository';
import { getSubtypeLabel } from '@/features/alerts/utils/alertSubtype';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import { canMarkAlertAttended } from '@/shared/domain/permissions';
import { AlertStatus } from '@/shared/config/alertTypes';
import AttendAlertControls from '@/features/alerts/ui/AttendAlertControls';

export default function SelectedAlertPanel({ alert, onClose, onShowDetail }) {
    const { memberships } = useAuth();
    const [communityNames, setCommunityNames] = useState([]);
    const [localStatus, setLocalStatus] = useState(alert?.alertStatus ?? AlertStatus.PENDING);
    const main = getAlertLabel(alert.alertType, alert);
    const sub = getSubtypeLabel(alert.alertType, alert.subtype, alert.customDetail, true);
    const isAttended = localStatus === AlertStatus.ATTENDED;
    const canMark = canMarkAlertAttended(alert, memberships);

    useEffect(() => {
        let cancelled = false;
        let emptyTimeout;
        if (alert?.communityIds?.length > 0) {
            getCommunityNames(alert.communityIds).then((names) => {
                if (!cancelled) setCommunityNames(names);
            });
        } else {
            emptyTimeout = setTimeout(() => {
                if (!cancelled) setCommunityNames([]);
            }, 0);
        }
        return () => {
            cancelled = true;
            if (emptyTimeout) clearTimeout(emptyTimeout);
        };
    }, [alert?.communityIds]);

    useEffect(() => {
        setLocalStatus(alert?.alertStatus ?? AlertStatus.PENDING);
    }, [alert?.id, alert?.alertStatus]);

    const Icon = LucideIcons[getAlertIcon(alert.alertType, alert)] || LucideIcons.AlertTriangle;

    return (
        <div className="map-alert-panel" role="region" aria-label="Resumen de alerta seleccionada">
            <div className="map-alert-panel-header" style={{ background: getAlertColor(alert.alertType, alert) }}>
                <div className="map-alert-panel-header-icon" style={{ background: 'rgba(255,255,255,0.2)' }}>
                    <Icon aria-hidden />
                </div>
                <div className="map-alert-panel-header-info">
                    <div className="map-alert-panel-header-type" style={{ lineHeight: 1.2 }}>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{main}</div>
                        {sub ? (
                            <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.95, marginTop: 4 }}>
                                <span style={{ opacity: 0.85 }}>→ </span>
                                {sub}
                            </div>
                        ) : null}
                    </div>
                    <div className="map-alert-panel-header-time">{getTimeAgo(alert.timestamp)}</div>
                </div>
                <button type="button" className="map-alert-panel-close" onClick={onClose} aria-label="Cerrar panel">
                    <X aria-hidden />
                </button>
            </div>

            <div className="map-alert-panel-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    {alert.isAnonymous ? (
                        <>
                            <EyeOff style={{ width: 14, height: 14, color: 'var(--color-text-tertiary)' }} aria-hidden />
                            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Reporte anónimo</span>
                        </>
                    ) : (
                        <>
                            <User style={{ width: 14, height: 14, color: 'var(--color-text-tertiary)' }} aria-hidden />
                            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                {alert.userName || 'Usuario desconocido'}
                            </span>
                        </>
                    )}
                </div>

                <div
                    style={{
                        marginBottom: 12,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: `1px solid ${isAttended ? 'rgba(52,199,89,0.35)' : 'rgba(255,159,10,0.35)'}`,
                        background: isAttended ? 'rgba(52,199,89,0.08)' : 'rgba(255,159,10,0.08)',
                    }}
                >
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: isAttended ? '#1D7A3A' : '#B26A00',
                            marginBottom: 6,
                        }}
                    >
                        Estado operativo
                    </div>
                    <div
                        style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: isAttended ? '#1F7A3D' : '#B26A00',
                        }}
                    >
                        {isAttended ? 'Atendida' : 'No atendida'}
                    </div>
                </div>

                <AttendAlertControls
                    alertId={alert.id}
                    alertStatus={localStatus}
                    canMark={canMark}
                    compact
                    onStatusChange={setLocalStatus}
                />

                {alert.description && (
                    <p style={{ fontSize: 14, color: 'var(--color-text-primary)', marginBottom: 12, lineHeight: 1.5 }}>
                        {alert.description}
                    </p>
                )}

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span className="tag tag-views"><Eye aria-hidden /> {alert.viewedCount} vistas</span>
                    <span className="tag tag-forwards"><Forward aria-hidden /> {alert.forwardsCount} reenvios</span>
                    {alert.reportsCount > 0 && (
                        <span className="tag tag-reports"><Flag aria-hidden /> {alert.reportsCount} reportes</span>
                    )}
                </div>

                {communityNames.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                marginBottom: 8,
                                color: '#007AFF',
                                fontSize: 12,
                                fontWeight: 700,
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                            }}
                        >
                            <Users style={{ width: 13, height: 13 }} aria-hidden />
                            Comunidades ({communityNames.length})
                        </div>
                        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                            {communityNames.map(({ id, name }) => (
                                <span
                                    key={id}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        padding: '4px 10px',
                                        borderRadius: 999,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: '#007AFF',
                                        background: 'rgba(0,122,255,0.08)',
                                        border: '1px solid rgba(0,122,255,0.25)',
                                    }}
                                >
                                    <Users style={{ width: 10, height: 10 }} aria-hidden />
                                    {name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <button
                    type="button"
                    onClick={onShowDetail}
                    style={{
                        marginTop: 16,
                        width: '100%',
                        padding: '10px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-strong)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text-primary)',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-family)',
                    }}
                >
                    Ver detalle completo
                </button>
            </div>
        </div>
    );
}

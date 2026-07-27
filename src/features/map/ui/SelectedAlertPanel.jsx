import { useEffect, useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Eye, Forward, Flag, X } from 'lucide-react';
import { getTimeAgo, AlertStatus } from '@/shared/config/alertTypes';
import {
    getCommunityNames,
    getMemberAliasMap,
} from '@/features/communities/repository/communityRepository';
import { getSubtypeLabel } from '@/features/alerts/utils/alertSubtype';
import { resolveAlertTypePresentation } from '@/features/alerts/utils/alertTypePresentation';
import {
    alertContentLabels,
    enrichDestinationsWithMemberships,
} from '@/features/alerts/utils/alertDestinations';
import AlertKeyFacts from '@/features/alerts/ui/AlertKeyFacts';
import AlertReporterFacts from '@/features/alerts/ui/AlertReporterFacts';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import { canMarkAlertAttended } from '@/shared/domain/permissions';
import AttendAlertControls from '@/features/alerts/ui/AttendAlertControls';
import { resolveSenderLabelForAlert } from '@/shared/utils/memberDisplayLabel';

export default function SelectedAlertPanel({ alert, onClose, onShowDetail, senderLabel = null }) {
    const { memberships } = useAuth();
    const [destinations, setDestinations] = useState([]);
    const [aliasMaps, setAliasMaps] = useState({});
    const [localStatus, setLocalStatus] = useState(alert?.alertStatus ?? AlertStatus.PENDING);

    const { label: main, color, icon } = resolveAlertTypePresentation(alert);
    const sub = getSubtypeLabel(alert.alertType, alert.subtype, alert.customDetail, true);
    const isAttended = localStatus === AlertStatus.ATTENDED;
    const canMark = canMarkAlertAttended(alert, memberships);
    const labels = useMemo(() => alertContentLabels(destinations), [destinations]);

    useEffect(() => {
        let cancelled = false;
        let emptyTimeout;
        if (alert?.communityIds?.length > 0) {
            getCommunityNames(alert.communityIds).then((list) => {
                if (!cancelled) {
                    setDestinations(enrichDestinationsWithMemberships(list, memberships));
                }
            });
        } else {
            emptyTimeout = setTimeout(() => {
                if (!cancelled) setDestinations([]);
            }, 0);
        }
        return () => {
            cancelled = true;
            if (emptyTimeout) clearTimeout(emptyTimeout);
        };
    }, [alert?.communityIds, memberships]);

    useEffect(() => {
        const ids = (alert?.communityIds || []).filter(Boolean);
        if (!ids.length) {
            setAliasMaps({});
            return undefined;
        }
        let cancelled = false;
        Promise.all(ids.map(async (id) => [id, await getMemberAliasMap(id)]))
            .then((entries) => {
                if (!cancelled) setAliasMaps(Object.fromEntries(entries));
            })
            .catch((err) => {
                console.warn("[SelectedAlertPanel] alias maps", err);
                if (!cancelled) setAliasMaps({});
            });
        return () => { cancelled = true; };
    }, [alert?.communityIds]);

    useEffect(() => {
        setLocalStatus(alert?.alertStatus ?? AlertStatus.PENDING);
    }, [alert?.id, alert?.alertStatus]);

    const Icon = LucideIcons[icon] || LucideIcons.AlertTriangle;
    const resolvedSender = useMemo(() => {
        const fromProp = String(senderLabel ?? '').trim();
        if (fromProp) return fromProp;
        return resolveSenderLabelForAlert(alert, aliasMaps);
    }, [senderLabel, alert, aliasMaps]);
    const accountName = String(alert?.userName ?? '').trim() || null;

    return (
        <div className="map-alert-panel" role="region" aria-label="Resumen de alerta seleccionada">
            <div className="map-alert-panel-header" style={{ background: color }}>
                <div className="map-alert-panel-header-icon" style={{ background: 'rgba(255,255,255,0.2)' }}>
                    <Icon aria-hidden />
                </div>
                <div className="map-alert-panel-header-info">
                    <div
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            opacity: 0.85,
                            color: 'white',
                            marginBottom: 2,
                        }}
                    >
                        {labels.typeLabel}
                    </div>
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
                <AlertKeyFacts alert={alert} destinations={destinations} />

                <div style={{ marginBottom: 12 }}>
                    <AlertReporterFacts
                        compact
                        isAnonymous={alert.isAnonymous}
                        primaryLabel={resolvedSender}
                        accountName={accountName}
                    />
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

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span className="tag tag-views"><Eye aria-hidden /> {alert.viewedCount} vistas</span>
                    <span className="tag tag-forwards"><Forward aria-hidden /> {alert.forwardsCount} reenvios</span>
                    {alert.reportsCount > 0 && (
                        <span className="tag tag-reports"><Flag aria-hidden /> {alert.reportsCount} reportes</span>
                    )}
                </div>

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

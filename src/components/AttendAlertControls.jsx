import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { AlertStatus } from '../config/alertTypes';
import { updateAlertStatus } from '../services/alertService';

/**
 * One-way “Marcar como atendida” with confirm — parity with admin webapp.
 * Does not allow reverting to pending.
 */
export default function AttendAlertControls({
    alertId,
    alertStatus,
    canMark,
    compact = false,
    onStatusChange,
}) {
    const [localStatus, setLocalStatus] = useState(alertStatus ?? AlertStatus.PENDING);
    const [showConfirm, setShowConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        setLocalStatus(alertStatus ?? AlertStatus.PENDING);
        setShowConfirm(false);
        setBusy(false);
        setFeedback('');
    }, [alertId, alertStatus]);

    const isAttended = localStatus === AlertStatus.ATTENDED;
    if (!canMark || isAttended) {
        return feedback ? (
            <p
                role="status"
                style={{
                    margin: compact ? '8px 0 0' : '8px 0 0',
                    fontSize: 12,
                    fontWeight: 600,
                    color: feedback.includes('No se pudo') ? '#C62828' : '#1F7A3D',
                }}
            >
                {feedback}
            </p>
        ) : null;
    }

    async function handleConfirm() {
        if (!alertId || busy) return;
        setBusy(true);
        setFeedback('');
        try {
            await updateAlertStatus(alertId, AlertStatus.ATTENDED);
            setLocalStatus(AlertStatus.ATTENDED);
            setShowConfirm(false);
            setFeedback('Alerta marcada como atendida.');
            onStatusChange?.(AlertStatus.ATTENDED);
        } catch (error) {
            console.error('[AttendAlertControls] updateAlertStatus', error);
            setFeedback('No se pudo actualizar el estado. Intenta nuevamente.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div
            style={{
                marginTop: compact ? 0 : 10,
                ...(compact
                    ? {
                        marginBottom: 12,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid rgba(220, 38, 38, 0.22)',
                        background: 'rgba(255, 255, 255, 0.96)',
                    }
                    : {
                        paddingTop: 10,
                        borderTop: '1px solid rgba(255,159,10,0.26)',
                    }),
            }}
        >
            {!showConfirm ? (
                <button
                    type="button"
                    aria-label="Marcar alerta como atendida"
                    onClick={() => setShowConfirm(true)}
                    disabled={busy}
                    style={{
                        width: '100%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        border: '1px solid #DC2626',
                        background: 'linear-gradient(180deg, #EF4444 0%, #DC2626 100%)',
                        color: '#FFFFFF',
                        borderRadius: 10,
                        padding: '10px 12px',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: busy ? 'wait' : 'pointer',
                        boxShadow: '0 6px 14px rgba(220,38,38,0.24)',
                        fontFamily: 'var(--font-family)',
                        opacity: busy ? 0.7 : 1,
                    }}
                >
                    <CheckCircle2 style={{ width: 14, height: 14 }} aria-hidden />
                    Marcar como atendida
                </button>
            ) : (
                <div
                    role="group"
                    aria-label="Confirmar marcar como atendida"
                    style={{
                        padding: 10,
                        borderRadius: 8,
                        border: '1px solid rgba(220,38,38,0.3)',
                        background: 'rgba(254,226,226,0.45)',
                    }}
                >
                    <p style={{
                        margin: '0 0 8px',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#7F1D1D',
                        lineHeight: 1.35,
                    }}>
                        ¿Confirmas marcar esta alerta como atendida? Esta acción no se puede deshacer desde aquí.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            type="button"
                            onClick={() => setShowConfirm(false)}
                            disabled={busy}
                            style={{
                                flex: 1,
                                border: '1px solid rgba(0,0,0,0.14)',
                                background: '#fff',
                                color: '#4B5563',
                                borderRadius: 8,
                                padding: '7px 10px',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-family)',
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={busy}
                            aria-busy={busy}
                            style={{
                                flex: 1,
                                border: '1px solid rgba(22,163,74,0.55)',
                                background: 'rgba(34,197,94,0.2)',
                                color: '#166534',
                                borderRadius: 8,
                                padding: '7px 10px',
                                fontSize: 12,
                                fontWeight: 800,
                                cursor: busy ? 'wait' : 'pointer',
                                fontFamily: 'var(--font-family)',
                            }}
                        >
                            {busy ? 'Marcando…' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            )}
            {feedback ? (
                <p
                    role="status"
                    style={{
                        margin: '8px 0 0',
                        fontSize: 12,
                        fontWeight: 600,
                        color: feedback.includes('No se pudo') ? '#C62828' : '#1F7A3D',
                    }}
                >
                    {feedback}
                </p>
            ) : null}
        </div>
    );
}

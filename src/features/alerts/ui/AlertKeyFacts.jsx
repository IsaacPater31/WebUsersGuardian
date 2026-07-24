import { Building2, Users, MessageSquareText } from 'lucide-react';
import {
    resolveAlertMessage,
} from '@/features/alerts/utils/alertTypePresentation';
import {
    alertContentLabels,
    destinationKindLabel,
} from '@/features/alerts/utils/alertDestinations';

/**
 * Destinations + description — identical UI for comunidad and entidad.
 * Only the kind label changes (ETC: single component, copy from alertDestinations).
 */
export default function AlertKeyFacts({ alert, destinations = [] }) {
    const message = resolveAlertMessage(alert);
    const labels = alertContentLabels(destinations);

    return (
        <>
            <AlertDestinationList destinations={destinations} />

            <div
                style={{
                    marginBottom: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-secondary)',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--color-text-tertiary)',
                        marginBottom: 6,
                    }}
                >
                    <MessageSquareText style={{ width: 12, height: 12 }} aria-hidden />
                    {labels.messageLabel}
                </div>
                {message ? (
                    <p
                        style={{
                            fontSize: 14,
                            color: 'var(--color-text-primary)',
                            margin: 0,
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap',
                        }}
                    >
                        {message}
                    </p>
                ) : (
                    <p
                        style={{
                            fontSize: 13,
                            color: 'var(--color-text-tertiary)',
                            margin: 0,
                            fontStyle: 'italic',
                        }}
                    >
                        Sin descripción
                    </p>
                )}
            </div>
        </>
    );
}

/**
 * Community / entity chips — same look; badge text is Comunidad or Entidad.
 */
export function AlertDestinationList({ destinations = [] }) {
    if (!destinations.length) return null;

    const { destinationTitle } = alertContentLabels(destinations);
    const mixed = destinations.some((d) => d.isEntity)
        && destinations.some((d) => !d.isEntity);

    return (
        <div style={{ marginTop: 4, marginBottom: 12 }}>
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
                {destinationTitle} ({destinations.length})
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {destinations.map(({ id, name, isEntity }) => {
                    const KindIcon = isEntity ? Building2 : Users;
                    return (
                        <span
                            key={id}
                            title={destinationKindLabel(!!isEntity)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '5px 10px',
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 600,
                                color: '#007AFF',
                                background: 'rgba(0,122,255,0.08)',
                                border: '1px solid rgba(0,122,255,0.25)',
                            }}
                        >
                            <KindIcon style={{ width: 11, height: 11 }} aria-hidden />
                            <span>{name}</span>
                            {mixed ? (
                                <span
                                    style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        letterSpacing: '0.04em',
                                        textTransform: 'uppercase',
                                        opacity: 0.8,
                                    }}
                                >
                                    {destinationKindLabel(!!isEntity)}
                                </span>
                            ) : null}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}

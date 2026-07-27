import { User } from 'lucide-react';

/**
 * Bloque clínico de remitente: alias como etiqueta principal;
 * nombre de cuenta solo si aporta (distinto del alias).
 * Nunca muestra IDs / UIDs.
 *
 * @param {{
 *   isAnonymous?: boolean,
 *   primaryLabel?: string|null,
 *   accountName?: string|null,
 *   compact?: boolean,
 * }} props
 */
export default function AlertReporterFacts({
    isAnonymous = false,
    primaryLabel = null,
    accountName = null,
    compact = false,
}) {
    if (isAnonymous) {
        return (
            <div className={compact ? 'alert-reporter alert-reporter--compact' : 'alert-reporter'}>
                <div className="alert-reporter-label">
                    <User size={compact ? 12 : 13} aria-hidden />
                    Remitente
                </div>
                <div className="alert-reporter-primary alert-reporter-primary--anon">
                    Anónimo
                </div>
            </div>
        );
    }

    const primary = String(primaryLabel ?? '').trim();
    const account = String(accountName ?? '').trim();
    const showAccount =
        primary
        && account
        && account.toLowerCase() !== primary.toLowerCase();

    return (
        <div className={compact ? 'alert-reporter alert-reporter--compact' : 'alert-reporter'}>
            <div className="alert-reporter-label">
                <User size={compact ? 12 : 13} aria-hidden />
                Remitente
            </div>
            <div className="alert-reporter-primary">
                {primary || 'Sin identificar'}
            </div>
            {showAccount ? (
                <div className="alert-reporter-secondary">
                    Cuenta: {account}
                </div>
            ) : null}
        </div>
    );
}

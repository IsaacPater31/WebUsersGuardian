import { ViewScope } from '../utils/viewScope';

/**
 * Segmented control: Comunidades | Reportes
 */
export default function ViewScopeToggle({
    scope,
    onChange,
    show = true,
    className = '',
}) {
    if (!show) return null;

    return (
        <div
            className={`view-scope-toggle ${className}`.trim()}
            role="tablist"
            aria-label="Ámbito de alertas"
        >
            <button
                type="button"
                role="tab"
                aria-selected={scope === ViewScope.communities}
                className={`view-scope-toggle-btn${scope === ViewScope.communities ? ' is-active' : ''}`}
                onClick={() => onChange?.(ViewScope.communities)}
            >
                Comunidades
            </button>
            <button
                type="button"
                role="tab"
                aria-selected={scope === ViewScope.reports}
                className={`view-scope-toggle-btn${scope === ViewScope.reports ? ' is-active' : ''}`}
                onClick={() => onChange?.(ViewScope.reports)}
            >
                Reportes
            </button>
        </div>
    );
}

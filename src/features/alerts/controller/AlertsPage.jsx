import { useState, useEffect, useCallback, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { subscribeToAlertsFiltered } from '@/features/alerts/repository/alertRepository';
import { getAlertColor, getAlertLabel } from '@/shared/config/alertTypes';
import AlertCard from '@/features/alerts/ui/AlertCard';
import AlertDetailModal from '@/features/alerts/ui/AlertDetailModal';
import AlertFilterPanel, {
    EMPTY_FILTERS,
    countActiveFiltersCompat,
} from '@/features/alerts/ui/AlertFilters';
import ViewScopeToggle from '@/features/scope/ui/ViewScopeToggle';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import { useViewScope } from '@/features/scope/controller/useViewScope';
import { filterAlertsByCommunities } from '@/features/alerts/utils/alertScope';

const STATUS_LABELS = {
    pending: 'No atendidas',
    attended: 'Atendidas',
};

const DATE_LABELS = {
    today: 'Hoy',
    yesterday: 'Ayer',
    week: 'Esta semana',
    '7days': 'Últimos 7 días',
    month: 'Este mes',
    custom: 'Personalizado',
};

export default function AlertsPage() {
    const { loading: authLoading } = useAuth();
    const {
        scope,
        setScope,
        showToggle,
        scopeIds,
        typeOptions,
        isReportsScope,
        hasAnyScope,
        ready,
    } = useViewScope();

    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [showFilterPanel, setShowFilterPanel] = useState(false);

    useEffect(() => {
        setFilters((prev) => ({ ...prev, types: [] }));
        setSelectedAlert(null);
        setShowFilterPanel(false);
    }, [scope]);

    const typeLabelByKey = useMemo(() => {
        const map = new Map();
        for (const opt of typeOptions) {
            map.set(opt.key, opt);
        }
        return map;
    }, [typeOptions]);

    const subscribe = useCallback((activeFilters) => {
        setLoading(true);

        const unsub = subscribeToAlertsFiltered(activeFilters, (data) => {
            setAlerts(filterAlertsByCommunities(data, scopeIds));
            setLoading(false);
        });

        return unsub;
    }, [scopeIds]);

    useEffect(() => {
        const unsub = subscribe(filters);
        return unsub;
    }, [filters, subscribe]);

    const applyFilters = (newFilters) => {
        setFilters(newFilters);
    };

    const clearFilters = () => setFilters(EMPTY_FILTERS);

    const activeCount = countActiveFiltersCompat(filters);
    const hasFilters = activeCount > 0;

    const activeChips = [];

    if (filters.types.length > 0) {
        filters.types.forEach((type) => {
            const opt = typeLabelByKey.get(type);
            activeChips.push({
                key: `type-${type}`,
                label: opt?.label || getAlertLabel(type),
                color: opt?.color || getAlertColor(type),
                onRemove: () =>
                    setFilters((prev) => ({
                        ...prev,
                        types: prev.types.filter((t) => t !== type),
                    })),
            });
        });
    }

    if (filters.status !== 'all') {
        activeChips.push({
            key: 'status',
            label: STATUS_LABELS[filters.status],
            color: filters.status === 'attended' ? '#34C759' : '#FF9500',
            onRemove: () => setFilters((prev) => ({ ...prev, status: 'all' })),
        });
    }

    if (filters.dateRange !== 'all') {
        activeChips.push({
            key: 'date',
            label: DATE_LABELS[filters.dateRange] ?? 'Fecha',
            color: '#3F51B5',
            onRemove: () =>
                setFilters((prev) => ({
                    ...prev,
                    dateRange: 'all',
                    customStart: null,
                    customEnd: null,
                })),
        });
    }

    if (authLoading || !ready) {
        return (
            <div className="loading-container">
                <div className="loading-spinner" />
            </div>
        );
    }

    if (!hasAnyScope) {
        return (
            <div className="empty-state">
                <div className="empty-state-title">Sin datos</div>
                <div className="empty-state-desc">
                    Únete a una comunidad o a un reporte (entidad) desde la app móvil para ver alertas aquí.
                </div>
            </div>
        );
    }

    return (
        <>
            {showToggle && (
                <div className="view-scope-toggle-wrap">
                    <ViewScopeToggle scope={scope} onChange={setScope} show />
                </div>
            )}

            <div className="filter-toolbar">
                <button
                    id="alerts-filter-btn"
                    type="button"
                    className={`filter-toolbar-btn${hasFilters ? ' active' : ''}`}
                    onClick={() => setShowFilterPanel(true)}
                >
                    <LucideIcons.SlidersHorizontal style={{ width: 15, height: 15 }} />
                    Filtros
                    {hasFilters && (
                        <span className="filter-toolbar-badge">{activeCount}</span>
                    )}
                </button>

                {activeChips.map((chip) => (
                    <span
                        key={chip.key}
                        className="filter-active-chip"
                        style={{ borderColor: chip.color, color: chip.color, background: `${chip.color}15` }}
                    >
                        {chip.label}
                        <button
                            type="button"
                            onClick={chip.onRemove}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                color: 'inherit',
                            }}
                        >
                            <LucideIcons.X style={{ width: 11, height: 11 }} />
                        </button>
                    </span>
                ))}

                {hasFilters && (
                    <button type="button" className="filter-clear-all-btn" onClick={clearFilters}>
                        Limpiar todo
                    </button>
                )}

                {loading && alerts.length > 0 && (
                    <span className="filter-loading-indicator">
                        <span className="filter-loading-dot" />
                        Actualizando…
                    </span>
                )}
            </div>

            <div className="section">
                <div className="section-header">
                    <div className="section-header-left">
                        <div className="section-icon" style={{ background: 'rgba(255, 59, 48, 0.08)' }}>
                            <LucideIcons.AlertTriangle style={{ color: '#FF3B30' }} />
                        </div>
                        <h3 className="section-title">
                            {hasFilters
                                ? (isReportsScope ? 'Reportes filtrados' : 'Alertas filtradas')
                                : (isReportsScope ? 'Todos los reportes' : 'Todas las alertas')}
                        </h3>
                    </div>
                    <span
                        className="section-badge"
                        style={{ background: 'rgba(255, 59, 48, 0.1)', color: '#FF3B30' }}
                    >
                        {alerts.length}
                    </span>
                </div>

                <div className="section-body">
                    {loading && alerts.length === 0 ? (
                        <div className="loading-container" style={{ minHeight: 160 }}>
                            <div className="loading-spinner" />
                        </div>
                    ) : alerts.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <LucideIcons.CheckCircle />
                            </div>
                            <div className="empty-state-title">
                                {isReportsScope ? 'Sin reportes' : 'Sin alertas'}
                            </div>
                            <div className="empty-state-desc">
                                {hasFilters
                                    ? 'No hay resultados que coincidan con los filtros aplicados.'
                                    : (isReportsScope
                                        ? 'No hay reportes recientes en tus entidades.'
                                        : 'No hay alertas recientes.')}
                            </div>
                            {hasFilters && (
                                <button
                                    type="button"
                                    style={{
                                        marginTop: 12,
                                        padding: '8px 18px',
                                        borderRadius: 'var(--radius-full)',
                                        border: '1px solid var(--color-border)',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        fontSize: 'var(--font-size-sm)',
                                        color: 'var(--color-text-secondary)',
                                    }}
                                    onClick={clearFilters}
                                >
                                    Limpiar filtros
                                </button>
                            )}
                        </div>
                    ) : (
                        alerts.map((alert) => (
                            <AlertCard
                                key={alert.id}
                                alert={alert}
                                onClick={setSelectedAlert}
                            />
                        ))
                    )}
                </div>
            </div>

            {showFilterPanel && (
                <AlertFilterPanel
                    filters={filters}
                    onChange={applyFilters}
                    onClose={() => setShowFilterPanel(false)}
                    typeOptions={typeOptions}
                    typesSectionLabel={isReportsScope ? 'TIPO DE REPORTE' : 'TIPO DE ALERTA'}
                />
            )}

            {selectedAlert && (
                <AlertDetailModal
                    alert={selectedAlert}
                    onClose={() => setSelectedAlert(null)}
                />
            )}
        </>
    );
}

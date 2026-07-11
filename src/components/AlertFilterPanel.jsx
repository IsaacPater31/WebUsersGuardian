import { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { ACTIVE_ALERT_TYPES, getAlertColor, getAlertLabel } from '../config/alertTypes';
import { STATUS_OPTIONS, DATE_OPTIONS, DEFAULT_FILTERS, countActiveFilters } from '../config/filterOptions';

// Re-export for consumers that use EMPTY_FILTERS from this module
export { DEFAULT_FILTERS as EMPTY_FILTERS };

// Active type keys derived from config — no hardcoding
const DEFAULT_TYPE_OPTIONS = Object.entries(ACTIVE_ALERT_TYPES).map(([key, meta]) => ({
    key,
    label: meta.labelEs || meta.label || key,
    color: meta.color,
    icon: meta.icon,
}));

/** Signature-compatible wrapper so callers that pass the full filters object still work. */
export function countActiveFiltersCompat(filters) {
    return countActiveFilters(filters.types, filters.status, filters.dateRange);
}


// ─── Componente principal ────────────────────────────────────────────────────

export default function AlertFilterPanel({
    filters,
    onChange,
    onClose,
    typeOptions = null,
    typesSectionLabel = 'TIPO DE ALERTA',
}) {
    const [local, setLocal] = useState({ ...filters });
    const resolvedTypeOptions = Array.isArray(typeOptions)
        ? typeOptions
        : DEFAULT_TYPE_OPTIONS;

    useEffect(() => {
        setLocal({ ...filters });
    }, [filters]);

    const toggleType = (type) => {
        setLocal((prev) => ({
            ...prev,
            types: prev.types.includes(type)
                ? prev.types.filter((t) => t !== type)
                : [...prev.types, type],
        }));
    };

    const setStatus = (status) => setLocal((prev) => ({ ...prev, status }));

    const setDateRange = (dateRange) =>
        setLocal((prev) => ({
            ...prev,
            dateRange,
            ...(dateRange !== 'custom' ? { customStart: null, customEnd: null } : {}),
        }));

    const clearAll = () => setLocal({ ...DEFAULT_FILTERS });

    const apply = () => {
        onChange(local);
        onClose();
    };

    const activeCount = countActiveFiltersCompat(local);
    const hasFilters  = activeCount > 0;

    const fmtDate = (iso) => {
        if (!iso) return 'Seleccionar';
        const d = new Date(iso + 'T00:00:00');
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return (
        <div className="filter-panel-overlay" onClick={onClose}>
            <div className="filter-panel" onClick={(e) => e.stopPropagation()}>

                {/* ── Header ── */}
                <div className="filter-panel-header">
                    <div className="filter-panel-title">
                        <div className="filter-panel-icon">
                            <LucideIcons.SlidersHorizontal style={{ width: 14, height: 14, color: 'white' }} />
                        </div>
                        <span>Filtros</span>
                        {hasFilters && (
                            <span className="filter-active-badge">{activeCount}</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {hasFilters && (
                            <button className="filter-clear-btn" onClick={clearAll}>
                                Limpiar todo
                            </button>
                        )}
                        <button className="filter-close-btn" onClick={onClose}>
                            <LucideIcons.X style={{ width: 16, height: 16 }} />
                        </button>
                    </div>
                </div>

                <div className="filter-panel-divider" />

                {/* ── Scrollable content ── */}
                <div className="filter-panel-body">

                    {/* Tipos de alerta */}
                    <div className="filter-section">
                        <div className="filter-section-label">
                            <LucideIcons.Tag style={{ width: 12, height: 12 }} />
                            {typesSectionLabel}
                        </div>
                        {resolvedTypeOptions.length === 0 ? (
                            <p className="admin-muted" style={{ margin: 0, fontSize: 13 }}>
                                No hay tipos configurados en tus reportes.
                            </p>
                        ) : (
                            <div className="filter-type-grid">
                                {resolvedTypeOptions.map((opt) => {
                                    const isActive = local.types.includes(opt.key);
                                    const color = opt.color || getAlertColor(opt.key);
                                    const Icon = LucideIcons[opt.icon] || LucideIcons.AlertTriangle;
                                    return (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            className={`filter-type-chip${isActive ? ' active' : ''}`}
                                            style={isActive
                                                ? { borderColor: color, background: `${color}18`, color }
                                                : {}}
                                            onClick={() => toggleType(opt.key)}
                                        >
                                            <span
                                                className="filter-type-chip-dot"
                                                style={{ background: color }}
                                            >
                                                <Icon style={{ width: 9, height: 9, color: 'white' }} />
                                            </span>
                                            {opt.label || getAlertLabel(opt.key)}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="filter-panel-divider" />

                    {/* Estado de atención */}
                    <div className="filter-section">
                        <div className="filter-section-label">
                            <LucideIcons.CircleDot style={{ width: 12, height: 12 }} />
                            ESTADO DE ATENCIÓN
                        </div>
                        <div className="filter-status-pills">
                            {STATUS_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    className={`filter-status-pill${local.status === opt.value ? ' active' : ''}`}
                                    onClick={() => setStatus(opt.value)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="filter-panel-divider" />

                    {/* Período de tiempo */}
                    <div className="filter-section">
                        <div className="filter-section-label">
                            <LucideIcons.Calendar style={{ width: 12, height: 12 }} />
                            PERÍODO DE TIEMPO
                        </div>
                        <div className="filter-date-chips">
                            {DATE_OPTIONS.map((opt) => {
                                const isActive = local.dateRange === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        className={`filter-date-chip${isActive ? ' active' : ''}`}
                                        onClick={() => setDateRange(opt.value)}
                                    >
                                        {opt.value === 'custom' && (
                                            <LucideIcons.CalendarRange style={{ width: 11, height: 11 }} />
                                        )}
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Selectores de fecha personalizada */}
                        {local.dateRange === 'custom' && (
                            <div className="filter-custom-dates">
                                <div className="filter-date-field">
                                    <label>DESDE</label>
                                    <div className="filter-date-input-wrap">
                                        <LucideIcons.Calendar style={{ width: 12, height: 12, color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                                        <input
                                            type="date"
                                            value={local.customStart || ''}
                                            max={local.customEnd || new Date().toISOString().split('T')[0]}
                                            onChange={(e) =>
                                                setLocal((p) => ({ ...p, customStart: e.target.value }))
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="filter-date-field">
                                    <label>HASTA</label>
                                    <div className="filter-date-input-wrap">
                                        <LucideIcons.Calendar style={{ width: 12, height: 12, color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                                        <input
                                            type="date"
                                            value={local.customEnd || ''}
                                            min={local.customStart || ''}
                                            max={new Date().toISOString().split('T')[0]}
                                            onChange={(e) =>
                                                setLocal((p) => ({ ...p, customEnd: e.target.value }))
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer — Aplicar ── */}
                <div className="filter-panel-footer">
                    <button className="filter-apply-btn" onClick={apply}>
                        Aplicar filtros
                    </button>
                </div>
            </div>
        </div>
    );
}

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Users } from 'lucide-react';
import { subscribeToAlertsInDateRange } from '../services/alertService';
import { getAlertLabel } from '../config/alertTypes';
import { useAuth } from '../contexts/AuthContext';
import {
    aggregateByType,
    aggregateTopSenders,
    filterAlertsByCommunities,
} from '../utils/alertScope';

const PRESETS = [
    { days: 7, label: '7 días' },
    { days: 30, label: '30 días' },
    { days: 90, label: '90 días' },
];

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d;
}

export default function Dashboard() {
    const { normalCommunityIds, loading: authLoading } = useAuth();
    const [presetDays, setPresetDays] = useState(30);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [includeAnonymous, setIncludeAnonymous] = useState(true);

    const rangeStart = useMemo(() => daysAgo(presetDays), [presetDays]);
    const rangeEnd = useMemo(() => new Date(), []);

    useEffect(() => {
        if (authLoading) return;
        setLoading(true);
        const unsub = subscribeToAlertsInDateRange(rangeStart, rangeEnd, (data) => {
            setAlerts(filterAlertsByCommunities(data, normalCommunityIds));
            setLoading(false);
        }, 1500);
        return unsub;
    }, [rangeStart, rangeEnd, normalCommunityIds, authLoading]);

    const byType = useMemo(() => aggregateByType(alerts), [alerts]);
    const chartData = useMemo(
        () => byType.map((row) => ({ name: getAlertLabel(row.type), count: row.count })),
        [byType],
    );
    const topSenders = useMemo(
        () => aggregateTopSenders(alerts, includeAnonymous).slice(0, 15),
        [alerts, includeAnonymous],
    );

    if (authLoading || loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner" />
            </div>
        );
    }

    if (normalCommunityIds.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon"><BarChart3 /></div>
                <div className="empty-state-title">Sin datos</div>
                <div className="empty-state-desc">
                    Las estadísticas aparecen cuando perteneces a comunidades normales.
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="dash-period-card">
                <div className="dash-period-head">
                    <span className="dash-period-label">Periodo</span>
                    <div className="dash-preset-row">
                        {PRESETS.map((p) => (
                            <button
                                key={p.days}
                                type="button"
                                className={`dash-preset-btn${presetDays === p.days ? ' active' : ''}`}
                                onClick={() => setPresetDays(p.days)}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="stat-card-value" style={{ fontSize: 28 }}>{alerts.length}</div>
                <div className="stat-card-label">Alertas en el periodo</div>
            </div>

            <div className="stats-grid" style={{ marginTop: 'var(--space-4)' }}>
                <section className="section section--dash">
                    <div className="section-header">
                        <div className="section-header-left">
                            <div className="section-icon" style={{ background: 'rgba(99,102,241,0.1)' }}>
                                <BarChart3 size={18} style={{ color: '#6366F1' }} />
                            </div>
                            <h3 className="section-title">Por tipo de alerta</h3>
                        </div>
                    </div>
                    <div className="section-body" style={{ height: 280 }}>
                        {chartData.length === 0 ? (
                            <p className="admin-muted">Sin alertas en este periodo.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#6366F1" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </section>

                <section className="section section--dash">
                    <div className="section-header">
                        <div className="section-header-left">
                            <div className="section-icon" style={{ background: 'rgba(52,199,89,0.12)' }}>
                                <Users size={18} style={{ color: '#34C759' }} />
                            </div>
                            <h3 className="section-title">Quién genera alertas</h3>
                        </div>
                        <label className="stats-anon-toggle">
                            <input
                                type="checkbox"
                                checked={includeAnonymous}
                                onChange={(e) => setIncludeAnonymous(e.target.checked)}
                            />
                            Incluir anónimos
                        </label>
                    </div>
                    <div className="section-body section-body--table">
                        {topSenders.length === 0 ? (
                            <p className="admin-muted">Sin emisores en este periodo.</p>
                        ) : (
                            <div className="admin-table-scroll">
                                <table className="admin-table admin-table--users">
                                    <thead>
                                        <tr>
                                            <th>Emisor</th>
                                            <th>Alertas</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topSenders.map((row) => (
                                            <tr key={row.key}>
                                                <td>
                                                    {row.label}
                                                    {row.isAnonymous && (
                                                        <span className="anon-badge">Anónimo</span>
                                                    )}
                                                </td>
                                                <td>{row.count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </>
    );
}

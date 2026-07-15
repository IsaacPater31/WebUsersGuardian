import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronRight, FileText } from 'lucide-react';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import { canViewEntityInbox } from '@/shared/domain/permissions';
import CommunityIconDisplay from '@/features/communities/ui/CommunityIconDisplay';

export default function ReportsPage() {
    const { entityMemberships, loading: authLoading } = useAuth();

    const entities = useMemo(
        () =>
            entityMemberships.map((m) => ({
                ...m.community,
                myRole: m.role,
                isOfficial: canViewEntityInbox(m.community, m.role),
            })),
        [entityMemberships],
    );

    if (authLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner" />
            </div>
        );
    }

    if (entities.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon"><FileText /></div>
                <div className="empty-state-title">Sin entidades</div>
                <div className="empty-state-desc">
                    Las entidades de reporte se unen desde la app móvil. Aquí verás el historial de tus envíos
                    o la bandeja si eres oficial.
                </div>
            </div>
        );
    }

    return (
        <div className="communities-grid">
            {entities.map((e) => (
                <Link key={e.id} to={`/reports/${e.id}`} className="community-card community-card--link">
                    <div className="community-card-icon">
                        <CommunityIconDisplay
                            iconCodePoint={e.iconCodePoint}
                            iconColor={e.reportButtonColor || e.iconColor}
                            size={28}
                        />
                    </div>
                    <div className="community-card-body">
                        <div className="community-card-name">{e.name}</div>
                        <div className="community-card-meta">
                            <span className="community-role-pill">
                                <Building2 size={12} />
                                {e.isOfficial ? 'Oficial — bandeja completa' : 'Mis reportes enviados'}
                            </span>
                        </div>
                    </div>
                    <ChevronRight className="community-card-chevron" size={18} />
                </Link>
            ))}
        </div>
    );
}

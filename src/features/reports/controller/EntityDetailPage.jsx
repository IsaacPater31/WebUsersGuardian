import { useParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import { canViewEntityInbox } from '@/shared/domain/permissions';
import CommunityDetailPage from '@/features/communities/controller/CommunityDetailPage';
import EntityReportsPage from '@/features/reports/controller/EntityReportsPage';

/**
 * /reports/:id — officials get the full community-style entity detail
 * (Alertas + Miembros, edit, invitations). Other members keep the flat
 * "my reports" inbox.
 */
export default function EntityDetailPage() {
    const { id: entityId } = useParams();
    const { memberships, loading: authLoading } = useAuth();

    if (authLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner" />
            </div>
        );
    }

    const membership = memberships.find((m) => m.communityId === entityId);
    const isOfficial = membership?.community
        ? canViewEntityInbox(membership.community, membership.role)
        : false;

    if (isOfficial) {
        return <CommunityDetailPage />;
    }

    return <EntityReportsPage />;
}

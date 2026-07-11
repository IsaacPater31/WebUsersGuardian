import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canViewEntityInbox } from '../utils/permissions';
import CommunityDetailPage from './CommunityDetailPage';
import EntityReportsPage from './EntityReportsPage';

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

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Shield, ChevronRight } from 'lucide-react';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import { visibleUserCommunities } from '@/shared/domain/communityVisibility';
import { roleLabel } from '@/shared/domain/permissions';
import { subscribeCommunityMemberCount } from '@/features/communities/repository/communityRepository';
import CommunityIconDisplay from '@/features/communities/ui/CommunityIconDisplay';

export default function CommunitiesPage() {
    const { memberships, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [memberCounts, setMemberCounts] = useState({});

    const communities = useMemo(() => {
        const withMeta = memberships
            .filter((m) => m.community && !m.community.isEntity)
            .map((m) => ({
                ...m.community,
                myRole: m.role,
            }));
        return visibleUserCommunities(withMeta);
    }, [memberships]);

    useEffect(() => {
        if (!communities.length) {
            setMemberCounts({});
            return undefined;
        }
        const unsubs = communities.map((c) =>
            subscribeCommunityMemberCount(c.id, (count) => {
                setMemberCounts((prev) => ({ ...prev, [c.id]: count }));
            }),
        );
        return () => unsubs.forEach((unsub) => unsub());
    }, [communities]);

    if (authLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner" />
            </div>
        );
    }

    if (communities.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon"><Users /></div>
                <div className="empty-state-title">Sin comunidades</div>
                <div className="empty-state-desc">
                    Únete a una comunidad desde la app móvil con un enlace de invitación.
                </div>
            </div>
        );
    }

    return (
        <div className="communities-grid">
            {communities.map((c) => (
                <button
                    key={c.id}
                    type="button"
                    className="community-card"
                    onClick={() => navigate(`/communities/${c.id}`)}
                >
                    <div className="community-card-icon">
                        <CommunityIconDisplay
                            iconCodePoint={c.iconCodePoint}
                            iconColor={c.iconColor}
                            size={40}
                        />
                    </div>
                    <div className="community-card-body">
                        <div className="community-card-name">{c.name}</div>
                        {c.description && (
                            <div className="community-card-desc">{c.description}</div>
                        )}
                        <div className="community-card-meta">
                            <span>{memberCounts[c.id] ?? '—'} miembros</span>
                            <span className="community-role-pill">
                                {c.myRole === 'admin' ? <Shield size={12} /> : null}
                                {roleLabel(c.myRole, false)}
                            </span>
                        </div>
                    </div>
                    <ChevronRight className="community-card-chevron" size={18} />
                </button>
            ))}
        </div>
    );
}

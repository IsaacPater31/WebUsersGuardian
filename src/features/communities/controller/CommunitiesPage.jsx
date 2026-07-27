import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Shield, ChevronRight, Home, Calendar } from 'lucide-react';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import { visibleUserCommunities } from '@/shared/domain/communityVisibility';
import { roleLabel } from '@/shared/domain/permissions';
import {
    subscribeCommunityMemberCount,
    resolveCommunityAdminNames,
} from '@/features/communities/repository/communityRepository';
import {
    isDefaultHogarCommunity,
} from '@/shared/utils/communityAdmins';
import CommunityIconDisplay from '@/features/communities/ui/CommunityIconDisplay';
import CommunityAdminsMeta from '@/features/communities/ui/CommunityAdminsMeta';

function formatCreatedAt(raw) {
    if (!raw) return null;
    try {
        const date = raw?.toDate ? raw.toDate() : new Date(raw);
        if (Number.isNaN(date.getTime())) return null;
        return date.toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return null;
    }
}

export default function CommunitiesPage() {
    const { memberships, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [memberCounts, setMemberCounts] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    /** @type {[Record<string, string[]>, Function]} */
    const [adminNamesByCommunity, setAdminNamesByCommunity] = useState({});
    const [adminsReady, setAdminsReady] = useState(false);

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

    useEffect(() => {
        if (!communities.length) {
            setAdminNamesByCommunity({});
            setAdminsReady(true);
            return undefined;
        }
        let cancelled = false;
        setAdminsReady(false);
        resolveCommunityAdminNames(communities).then((map) => {
            if (!cancelled) {
                setAdminNamesByCommunity(map);
                setAdminsReady(true);
            }
        }).catch((err) => {
            console.warn('[CommunitiesPage] admin names', err);
            if (!cancelled) {
                setAdminNamesByCommunity({});
                setAdminsReady(true);
            }
        });
        return () => { cancelled = true; };
    }, [communities]);

    const filteredCommunities = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return communities;
        // Evita miss por race: no filtrar por admin hasta resolver nombres.
        if (!adminsReady) return communities;
        return communities.filter((c) => {
            const nameMatch = (c.name || '').toLowerCase().includes(q);
            const descMatch = (c.description || '').toLowerCase().includes(q);
            const admins = adminNamesByCommunity[c.id] || [];
            const adminMatch = admins.some((n) => n.toLowerCase().includes(q));
            return nameMatch || descMatch || adminMatch;
        });
    }, [communities, searchQuery, adminNamesByCommunity, adminsReady]);

    if (authLoading || (communities.length > 0 && !adminsReady)) {
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
        <>
            <div className="admin-module-search">
                <input
                    type="search"
                    className="admin-module-input"
                    placeholder="Buscar por nombre, descripción o administrador…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Buscar comunidades"
                />
            </div>

            {filteredCommunities.length === 0 ? (
                <p className="admin-muted">Ninguna comunidad coincide con la búsqueda.</p>
            ) : (
                <div className="communities-grid">
                    {filteredCommunities.map((c) => {
                        const isHogar = isDefaultHogarCommunity(c);
                        const adminNames = adminNamesByCommunity[c.id] || [];
                        const createdLabel = formatCreatedAt(c.createdAt);
                        const count = memberCounts[c.id];

                        return (
                            <button
                                key={c.id}
                                type="button"
                                className="community-card community-card--rich"
                                onClick={() => navigate(`/communities/${c.id}`)}
                            >
                                <div className="community-card-top">
                                    <div className="community-card-icon">
                                        <CommunityIconDisplay
                                            iconCodePoint={c.iconCodePoint}
                                            iconColor={c.iconColor}
                                            size={40}
                                        />
                                    </div>
                                    <div className="community-card-heading">
                                        <div className="community-card-badges">
                                            <span className={`community-type-pill${isHogar ? ' community-type-pill--hogar' : ''}`}>
                                                {isHogar ? <Home size={11} aria-hidden /> : <Users size={11} aria-hidden />}
                                                {isHogar ? 'Hogar' : 'Comunidad'}
                                            </span>
                                        </div>
                                        <div className="community-card-name">{c.name}</div>
                                    </div>
                                    <ChevronRight className="community-card-chevron" size={18} aria-hidden />
                                </div>

                                <div className="community-card-body">
                                    <CommunityAdminsMeta names={adminNames} />

                                    {c.description ? (
                                        <p className="community-card-desc">{c.description}</p>
                                    ) : null}

                                    <div className="community-card-meta">
                                        <span>
                                            {count == null ? '—' : count}{' '}
                                            {count === 1 ? 'miembro' : 'miembros'}
                                        </span>
                                        <span className="community-role-pill">
                                            {c.myRole === 'admin' ? <Shield size={12} aria-hidden /> : null}
                                            {roleLabel(c.myRole, false)}
                                        </span>
                                        {createdLabel ? (
                                            <span className="community-card-created">
                                                <Calendar size={12} aria-hidden />
                                                {createdLabel}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </>
    );
}

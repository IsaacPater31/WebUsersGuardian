import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Pencil,
    Users,
    AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import { subscribeCommunityMembers } from '@/features/communities/repository/communityRepository';
import {
    userAddCommunityMember,
    userRemoveMember,
    userUpdateMemberRole,
    userUpdateCommunity,
} from '@/features/communities/service/communityWriteService';
import { searchUsersByText } from '@/features/communities/repository/userSearchRepository';
import { generateInviteLink } from '@/features/communities/repository/inviteRepository';
import { subscribeToCommunityAlerts } from '@/features/alerts/repository/alertRepository';
import {
    canEditCommunity,
    canManageMembership,
    canViewEntityInbox,
    roleLabel,
} from '@/shared/domain/permissions';
import { isOfficialEntityCommunity } from '@/shared/domain/communityVisibility';
import { roleSelectOptions } from '@/shared/validators/roles';
import { AlertStatus } from '@/shared/config/alertTypes';
import CommunityIconDisplay from '@/features/communities/ui/CommunityIconDisplay';
import CommunityInvitePanel from '@/features/communities/ui/CommunityInvitePanel';
import CommunityAlertsPanel from '@/features/communities/ui/CommunityAlertsPanel';
import CommunityMembersPanel from '@/features/communities/ui/CommunityMembersPanel';
import CommunityEditModal from '@/features/communities/ui/CommunityEditModal';
import {
    DEFAULT_ICON_CODE_POINT,
    DEFAULT_ICON_COLOR,
} from '@/shared/config/communityIconCatalog';
import { normalizeEntityReportTypes } from '@/features/reports/utils/entityReportTypes';
import AlertDetailModal from '@/features/alerts/ui/AlertDetailModal';

/**
 * Community / entity detail controller — composes feature UI panels.
 */
export default function CommunityDetailPage() {
    const { id: communityId } = useParams();
    const { user, memberships, reloadMemberships } = useAuth();

    const membership = memberships.find((m) => m.communityId === communityId);
    const community = membership?.community;
    const isEntity = community ? isOfficialEntityCommunity(community) : false;
    const canManage = community ? canManageMembership(community, membership?.role) : false;
    const canEdit = community ? canEditCommunity(community, membership?.role) : false;
    const canViewInbox = community
        ? canViewEntityInbox(community, membership?.role)
        : false;
    const showAlertsTab = !isEntity || canViewInbox;
    const roles = roleSelectOptions(isEntity);

    const [members, setMembers] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [activeTab, setActiveTab] = useState('alerts');
    const [loading, setLoading] = useState(true);
    const [selectedAlert, setSelectedAlert] = useState(null);

    const [memberSearch, setMemberSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [searchErr, setSearchErr] = useState('');
    const searchDebounceRef = useRef(null);
    const [newRole, setNewRole] = useState('member');
    const [busy, setBusy] = useState(false);

    const [editOpen, setEditOpen] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [editErr, setEditErr] = useState('');
    const [inviteUrl, setInviteUrl] = useState('');
    const [inviteErr, setInviteErr] = useState('');

    useEffect(() => {
        if (!communityId) return undefined;
        setLoading(true);
        let membersReady = false;
        let alertsReady = false;
        const markReady = () => {
            if (membersReady && alertsReady) setLoading(false);
        };

        const unsubMembers = subscribeCommunityMembers(communityId, (memberList) => {
            setMembers(memberList);
            membersReady = true;
            markReady();
        });
        const unsubAlerts = subscribeToCommunityAlerts(communityId, (alertList) => {
            const sorted = [...alertList].sort((a, b) => {
                const ta = a.timestamp?.toDate?.() ?? new Date(0);
                const tb = b.timestamp?.toDate?.() ?? new Date(0);
                return tb - ta;
            });
            setAlerts(sorted);
            alertsReady = true;
            markReady();
        });

        return () => {
            unsubMembers();
            unsubAlerts();
        };
    }, [communityId]);

    useEffect(() => {
        if (!showAlertsTab && activeTab === 'alerts') {
            setActiveTab('members');
        }
    }, [showAlertsTab, activeTab]);

    useEffect(() => {
        if (!community) return;
        setEditForm({
            name: community.name || '',
            description: community.description || '',
            iconCodePoint: community.iconCodePoint ?? DEFAULT_ICON_CODE_POINT,
            iconColor: community.iconColor || DEFAULT_ICON_COLOR,
            reportButtonColor: community.reportButtonColor || '#0D1B3E',
            reportAlertTypes: normalizeEntityReportTypes(community.reportAlertTypes),
            allowForwardToEntities: community.allowForwardToEntities !== false,
        });
    }, [community]);

    useEffect(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        const q = memberSearch.trim();
        if (!canManage || q.length < 2) {
            setSearchResults([]);
            setSearching(false);
            setSearchErr('');
            return undefined;
        }
        setSearching(true);
        searchDebounceRef.current = setTimeout(async () => {
            try {
                const results = await searchUsersByText(q, { excludeCommunityId: communityId });
                setSearchResults(results);
                setSearchErr('');
            } catch (err) {
                setSearchResults([]);
                setSearchErr(err?.message || 'No se pudo buscar');
            } finally {
                setSearching(false);
            }
        }, 400);
        return () => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        };
    }, [memberSearch, communityId, canManage]);

    async function addMemberByUser(u) {
        if (!u?.id) return;
        setBusy(true);
        try {
            await userAddCommunityMember(communityId, u.id, newRole, memberships, {
                actorId: user?.uid,
                actorName: user?.displayName || user?.email || null,
            });
            setMemberSearch('');
            setSearchResults([]);
        } catch (err) {
            setSearchErr(err?.message || 'No se pudo agregar');
        } finally {
            setBusy(false);
        }
    }

    async function removeMemberRow(memberDocId) {
        if (!window.confirm('¿Quitar a esta persona de la comunidad?')) return;
        setBusy(true);
        try {
            await userRemoveMember(memberDocId, communityId, memberships, {
                actorId: user?.uid,
                actorName: user?.displayName || user?.email || null,
            });
        } catch (err) {
            alert(err?.message || 'Error');
        } finally {
            setBusy(false);
        }
    }

    async function changeRole(memberId, role) {
        setBusy(true);
        try {
            await userUpdateMemberRole(memberId, role, communityId, memberships, {
                actorId: user?.uid,
                actorName: user?.displayName || user?.email || null,
            });
            await reloadMemberships();
        } catch (err) {
            alert(err?.message || 'Error');
        } finally {
            setBusy(false);
        }
    }

    async function saveCommunity(e) {
        e.preventDefault();
        if (!editForm) return;
        setEditErr('');
        setBusy(true);
        try {
            await userUpdateCommunity(communityId, editForm, memberships);
            setEditOpen(false);
            await reloadMemberships();
        } catch (err) {
            setEditErr(err?.message || 'No se pudo guardar');
        } finally {
            setBusy(false);
        }
    }

    async function handleGenerateInvite() {
        setInviteErr('');
        setBusy(true);
        try {
            const url = await generateInviteLink(communityId);
            setInviteUrl(url);
            await navigator.clipboard.writeText(url);
        } catch (err) {
            setInviteErr(err?.message || 'No se pudo generar el enlace');
        } finally {
            setBusy(false);
        }
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner" />
            </div>
        );
    }

    if (!community) {
        return (
            <>
                <Link to={isEntity ? '/reports' : '/communities'} className="admin-back">
                    <ArrowLeft size={18} /> Volver
                </Link>
                <p className="admin-muted">Comunidad no encontrada o sin acceso.</p>
            </>
        );
    }

    const backTo = isEntity ? '/reports' : '/communities';

    return (
        <>
            <Link to={backTo} className="admin-back" style={{ marginBottom: 'var(--space-4)' }}>
                <ArrowLeft size={18} /> {isEntity ? 'Reportes' : 'Comunidades'}
            </Link>

            <section className="section section--dash" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="section-header">
                    <div className="section-header-left">
                        <div className="section-icon">
                            <CommunityIconDisplay
                                iconCodePoint={community.iconCodePoint}
                                iconColor={isEntity ? community.reportButtonColor : community.iconColor}
                                size={22}
                            />
                        </div>
                        <div>
                            <h2 className="section-title">{community.name}</h2>
                            <p className="section-subtitle">
                                Tu rol: {roleLabel(membership.role, isEntity)}
                                {community.description ? ` · ${community.description}` : ''}
                            </p>
                        </div>
                    </div>
                    {canEdit && (
                        <button type="button" className="admin-btn-ghost" onClick={() => setEditOpen(true)}>
                            <Pencil size={16} /> Editar
                        </button>
                    )}
                </div>
            </section>

            {canManage && (
                <CommunityInvitePanel
                    busy={busy}
                    inviteUrl={inviteUrl}
                    inviteErr={inviteErr}
                    onGenerate={handleGenerateInvite}
                />
            )}

            <div className="community-tabs">
                {showAlertsTab && (
                    <button
                        type="button"
                        className={`community-tab${activeTab === 'alerts' ? ' active' : ''}`}
                        onClick={() => setActiveTab('alerts')}
                    >
                        <AlertTriangle size={16} /> Alertas ({alerts.length})
                    </button>
                )}
                <button
                    type="button"
                    className={`community-tab${activeTab === 'members' ? ' active' : ''}`}
                    onClick={() => setActiveTab('members')}
                >
                    <Users size={16} /> Miembros ({members.length})
                </button>
            </div>

            {activeTab === 'alerts' && showAlertsTab && (
                <CommunityAlertsPanel
                    alerts={alerts}
                    isEntity={isEntity}
                    onSelectAlert={setSelectedAlert}
                />
            )}

            {activeTab === 'members' && (
                <CommunityMembersPanel
                    members={members}
                    roles={roles}
                    canManage={canManage}
                    isEntity={isEntity}
                    currentUserId={user?.uid}
                    busy={busy}
                    memberSearch={memberSearch}
                    onMemberSearchChange={setMemberSearch}
                    newRole={newRole}
                    onNewRoleChange={setNewRole}
                    searching={searching}
                    searchErr={searchErr}
                    searchResults={searchResults}
                    onAddMember={addMemberByUser}
                    onChangeRole={changeRole}
                    onRemoveMember={removeMemberRow}
                />
            )}

            {editOpen && (
                <CommunityEditModal
                    isEntity={isEntity}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    editErr={editErr}
                    busy={busy}
                    onSubmit={saveCommunity}
                    onClose={() => setEditOpen(false)}
                />
            )}

            {selectedAlert && (
                <AlertDetailModal
                    alert={selectedAlert}
                    onClose={() => setSelectedAlert(null)}
                    canMarkOverride={
                        canViewInbox
                            ? selectedAlert.alertStatus !== AlertStatus.ATTENDED
                            : null
                    }
                />
            )}
        </>
    );
}

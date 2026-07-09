import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Link2,
    Pencil,
    UserMinus,
    UserPlus,
    Users,
    AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getCommunityMembers } from '../services/communityService';
import {
    userAddCommunityMember,
    userRemoveMember,
    userUpdateMemberRole,
    userUpdateCommunity,
} from '../services/userCommunityService';
import { searchUsersByText } from '../services/userSearchService';
import { generateInviteLink } from '../services/inviteService';
import { getCommunityAlerts } from '../services/alertService';
import { canEditCommunity, canManageMembership, roleLabel } from '../utils/permissions';
import { isOfficialEntityCommunity } from '../utils/communityVisibility';
import CommunityIconDisplay from '../components/community/CommunityIconDisplay';
import CommunityIconPickerGrid from '../components/community/CommunityIconPickerGrid';
import EntityAlertTypesPicker from '../components/community/EntityAlertTypesPicker';
import {
    DEFAULT_ICON_CODE_POINT,
    DEFAULT_ICON_COLOR,
} from '../config/communityIconCatalog';
import AlertDetailModal from '../components/AlertDetailModal';
import AlertCard from '../components/AlertCard';

const BASE_ROLES = [
    { value: 'member', label: 'Miembro' },
    { value: 'admin', label: 'Administrador' },
];
const ENTITY_ROLES = [
    { value: 'member', label: 'Miembro' },
    { value: 'official', label: 'Oficial' },
];

export default function CommunityDetailPage() {
    const { id: communityId } = useParams();
    const { user, memberships, reloadMemberships } = useAuth();

    const membership = memberships.find((m) => m.communityId === communityId);
    const community = membership?.community;
    const isEntity = community ? isOfficialEntityCommunity(community) : false;
    const canManage = community ? canManageMembership(community, membership?.role) : false;
    const canEdit = community ? canEditCommunity(community, membership?.role) : false;
    const roles = isEntity ? ENTITY_ROLES : BASE_ROLES;

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

    const load = useCallback(async () => {
        if (!communityId) return;
        setLoading(true);
        try {
            const [memberList, alertList] = await Promise.all([
                getCommunityMembers(communityId),
                getCommunityAlerts(communityId),
            ]);
            setMembers(memberList);
            setAlerts(alertList);
        } catch (e) {
            console.error(e);
            setMembers([]);
            setAlerts([]);
        } finally {
            setLoading(false);
        }
    }, [communityId]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (isEntity && activeTab === 'alerts') {
            setActiveTab('members');
        }
    }, [isEntity, activeTab]);

    useEffect(() => {
        if (!community) return;
        setEditForm({
            name: community.name || '',
            description: community.description || '',
            iconCodePoint: community.iconCodePoint ?? DEFAULT_ICON_CODE_POINT,
            iconColor: community.iconColor || DEFAULT_ICON_COLOR,
            reportButtonColor: community.reportButtonColor || '#0D1B3E',
            reportAlertTypes: [...(community.reportAlertTypes || [])],
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
            await userAddCommunityMember(communityId, u.id, newRole, memberships);
            setMemberSearch('');
            setSearchResults([]);
            await load();
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
            await userRemoveMember(memberDocId, communityId, memberships);
            await load();
        } catch (err) {
            alert(err?.message || 'Error');
        } finally {
            setBusy(false);
        }
    }

    async function changeRole(memberId, role) {
        setBusy(true);
        try {
            await userUpdateMemberRole(memberId, role, communityId, memberships);
            await load();
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
            await load();
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
                <section className="section section--dash" style={{ marginBottom: 'var(--space-4)' }}>
                    <div className="section-header">
                        <div className="section-header-left">
                            <div className="section-icon" style={{ background: 'rgba(0,122,255,0.1)' }}>
                                <Link2 size={18} style={{ color: '#007AFF' }} />
                            </div>
                            <div>
                                <h3 className="section-title">Invitación</h3>
                                <p className="section-subtitle">Genera un enlace válido por 12 horas</p>
                            </div>
                        </div>
                    </div>
                    <div className="section-body">
                        <button type="button" className="admin-btn-primary" onClick={handleGenerateInvite} disabled={busy}>
                            <Link2 size={16} /> Generar y copiar enlace
                        </button>
                        {inviteUrl && <p className="admin-muted" style={{ marginTop: 8 }}>{inviteUrl}</p>}
                        {inviteErr && <div className="login-error">{inviteErr}</div>}
                    </div>
                </section>
            )}

            <div className="community-tabs">
                {!isEntity && (
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

            {activeTab === 'alerts' && !isEntity && (
                <section className="section section--dash">
                    <div className="section-body">
                        {alerts.length === 0 ? (
                            <p className="admin-muted admin-empty-inset">Sin alertas en esta comunidad.</p>
                        ) : (
                            alerts.map((a) => (
                                <AlertCard key={a.id} alert={a} onClick={setSelectedAlert} />
                            ))
                        )}
                    </div>
                </section>
            )}

            {activeTab === 'members' && (
                <>
                    {canManage && (
                        <section className="section section--dash" style={{ marginBottom: 'var(--space-4)' }}>
                            <div className="section-header">
                                <div className="section-header-left">
                                    <div className="section-icon" style={{ background: 'rgba(52,199,89,0.12)' }}>
                                        <UserPlus size={18} style={{ color: '#34C759' }} />
                                    </div>
                                    <h3 className="section-title">Agregar miembro</h3>
                                </div>
                            </div>
                            <div className="section-body">
                                <div className="admin-add-form admin-add-form--stacked">
                                    <input
                                        className="login-input"
                                        placeholder="Nombre, correo o UID"
                                        value={memberSearch}
                                        onChange={(e) => setMemberSearch(e.target.value)}
                                    />
                                    <select
                                        className="login-input admin-select"
                                        value={newRole}
                                        onChange={(e) => setNewRole(e.target.value)}
                                    >
                                        {roles.map((r) => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>
                                {searching && <p className="admin-muted">Buscando…</p>}
                                {searchErr && <div className="login-error">{searchErr}</div>}
                                {searchResults.length > 0 && (
                                    <ul className="member-search-results">
                                        {searchResults.map((u) => (
                                            <li key={u.id} className="member-search-result">
                                                <div className="member-search-result-info">
                                                    <strong>{u.displayName || 'Sin nombre'}</strong>
                                                    <span className="admin-muted">{u.email || '—'}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="admin-btn-primary"
                                                    disabled={busy}
                                                    onClick={() => addMemberByUser(u)}
                                                >
                                                    Añadir
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </section>
                    )}

                    <section className="section section--dash">
                        <div className="section-body section-body--table">
                            {members.length === 0 ? (
                                <p className="admin-muted admin-empty-inset">No hay miembros.</p>
                            ) : (
                                <div className="admin-table-scroll">
                                    <table className="admin-table admin-table--users admin-table-wide">
                                        <thead>
                                            <tr>
                                                <th>Nombre</th>
                                                <th>Correo</th>
                                                <th>Rol</th>
                                                {canManage && <th className="admin-th-actions" />}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {members.map((m) => (
                                                <tr key={m.id}>
                                                    <td>{m.displayName || '—'}</td>
                                                    <td className="admin-mono">{m.email || '—'}</td>
                                                    <td>
                                                        {canManage ? (
                                                            <select
                                                                className="login-input admin-select-inline"
                                                                value={
                                                                    isEntity && m.role === 'admin'
                                                                        ? 'official'
                                                                        : m.role
                                                                }
                                                                onChange={(e) => changeRole(m.id, e.target.value)}
                                                                disabled={busy}
                                                            >
                                                                {roles.map((r) => (
                                                                    <option key={r.value} value={r.value}>
                                                                        {r.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            roleLabel(
                                                                isEntity && m.role === 'admin' ? 'official' : m.role,
                                                                isEntity,
                                                            )
                                                        )}
                                                    </td>
                                                    {canManage && (
                                                        <td>
                                                            <button
                                                                type="button"
                                                                className="admin-icon-btn danger"
                                                                onClick={() => removeMemberRow(m.id)}
                                                                disabled={busy || m.userId === user?.uid}
                                                                title="Quitar"
                                                            >
                                                                <UserMinus size={18} />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </section>
                </>
            )}

            {editOpen && editForm && (
                <div className="admin-modal-overlay" role="dialog" onClick={() => setEditOpen(false)}>
                    <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
                        <h3 className="admin-modal-title">Editar {isEntity ? 'entidad' : 'comunidad'}</h3>
                        <form onSubmit={saveCommunity} className="admin-modal-form">
                            <label className="login-label">
                                Nombre
                                <input
                                    className="login-input"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                    required
                                />
                            </label>
                            <label className="login-label">
                                Descripción
                                <textarea
                                    className="login-input admin-textarea"
                                    value={editForm.description}
                                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                                />
                            </label>
                            <CommunityIconPickerGrid
                                selectedCodePoint={editForm.iconCodePoint}
                                selectedColor={editForm.iconColor}
                                onChange={({ iconCodePoint, iconColor }) =>
                                    setEditForm((f) => ({ ...f, iconCodePoint, iconColor }))
                                }
                            />
                            {isEntity && (
                                <>
                                    <label className="login-label">
                                        Color botón reportar
                                        <input
                                            type="color"
                                            value={editForm.reportButtonColor}
                                            onChange={(e) =>
                                                setEditForm((f) => ({
                                                    ...f,
                                                    reportButtonColor: e.target.value,
                                                }))
                                            }
                                        />
                                    </label>
                                    <EntityAlertTypesPicker
                                        selected={editForm.reportAlertTypes}
                                        onChange={(reportAlertTypes) =>
                                            setEditForm((f) => ({ ...f, reportAlertTypes }))
                                        }
                                    />
                                </>
                            )}
                            {!isEntity && (
                                <label className="login-label" style={{ flexDirection: 'row', gap: 8 }}>
                                    <input
                                        type="checkbox"
                                        checked={editForm.allowForwardToEntities}
                                        onChange={(e) =>
                                            setEditForm((f) => ({
                                                ...f,
                                                allowForwardToEntities: e.target.checked,
                                            }))
                                        }
                                    />
                                    Permitir reenvío a entidades
                                </label>
                            )}
                            {editErr && <div className="login-error">{editErr}</div>}
                            <div className="admin-modal-actions">
                                <button type="submit" className="admin-btn-primary" disabled={busy}>
                                    Guardar
                                </button>
                                <button
                                    type="button"
                                    className="admin-btn-ghost"
                                    onClick={() => setEditOpen(false)}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {selectedAlert && (
                <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
            )}
        </>
    );
}

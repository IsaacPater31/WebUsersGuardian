import { useEffect, useState } from 'react';
import { UserMinus, UserPlus } from 'lucide-react';
import { roleLabel } from '@/shared/domain/permissions';

function AliasCell({ member, canManage, busy, onUpdateAlias }) {
    const [value, setValue] = useState(member.alias || '');

    useEffect(() => {
        setValue(member.alias || '');
    }, [member.alias]);

    if (!canManage) {
        return member.alias || '—';
    }

    return (
        <input
            className="login-input admin-select-inline"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => {
                const trimmed = value.trim();
                if (trimmed !== String(member.alias || '').trim()) {
                    onUpdateAlias(member.id, trimmed);
                }
            }}
            disabled={busy}
            placeholder="Opcional"
            aria-label={`Alias de ${member.displayName || 'miembro'}`}
        />
    );
}

/**
 * Members tab: optional add-member search + members table.
 */
export default function CommunityMembersPanel({
    members,
    roles,
    canManage,
    isEntity,
    currentUserId,
    busy,
    memberSearch,
    onMemberSearchChange,
    newRole,
    onNewRoleChange,
    newAlias,
    onNewAliasChange,
    searching,
    searchErr,
    searchResults,
    onAddMember,
    onChangeRole,
    onUpdateAlias,
    onRemoveMember,
}) {
    return (
        <>
            {canManage && (
                <section className="section section--dash" style={{ marginBottom: 'var(--space-4)' }}>
                    <div className="section-header">
                        <div className="section-header-left">
                            <div className="section-icon" style={{ background: 'rgba(52,199,89,0.12)' }}>
                                <UserPlus size={18} style={{ color: 'var(--color-success)' }} />
                            </div>
                            <h3 className="section-title">Agregar miembro</h3>
                        </div>
                    </div>
                    <div className="section-body">
                        <div className="admin-add-form admin-add-form--stacked">
                            <input
                                className="login-input"
                                placeholder="Nombre o correo"
                                value={memberSearch}
                                onChange={(e) => onMemberSearchChange(e.target.value)}
                            />
                            <input
                                className="login-input"
                                placeholder="Alias (opcional)"
                                value={newAlias}
                                onChange={(e) => onNewAliasChange(e.target.value)}
                            />
                            <select
                                className="login-input admin-select"
                                value={newRole}
                                onChange={(e) => onNewRoleChange(e.target.value)}
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
                                            onClick={() => onAddMember(u)}
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
                                        <th>Alias</th>
                                        <th>Correo</th>
                                        <th>Rol</th>
                                        {canManage && <th className="admin-th-actions" />}
                                    </tr>
                                </thead>
                                <tbody>
                                    {members.map((m) => (
                                        <tr key={m.id}>
                                            <td>
                                                <div className="member-name-cell">
                                                    <span className="member-name-primary">
                                                        {m.alias
                                                            ? (m.alias)
                                                            : (m.profileName || m.displayName || '—')}
                                                    </span>
                                                    {m.alias && (m.profileName || '').trim()
                                                        && m.profileName.trim().toLowerCase() !== String(m.alias).trim().toLowerCase()
                                                        ? (
                                                            <span className="member-name-secondary">
                                                                Cuenta: {m.profileName}
                                                            </span>
                                                        )
                                                        : null}
                                                </div>
                                            </td>
                                            <td>
                                                <AliasCell
                                                    member={m}
                                                    canManage={canManage}
                                                    busy={busy}
                                                    onUpdateAlias={onUpdateAlias}
                                                />
                                            </td>
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
                                                        onChange={(e) => onChangeRole(m.id, e.target.value)}
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
                                                        onClick={() => onRemoveMember(m.id)}
                                                        disabled={busy || m.userId === currentUserId}
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
    );
}

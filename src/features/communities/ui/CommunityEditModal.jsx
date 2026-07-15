import CommunityIconPickerGrid from '@/features/communities/ui/CommunityIconPickerGrid';
import EntityAlertTypesPicker from '@/features/communities/ui/EntityAlertTypesPicker';

/**
 * Edit community / entity metadata modal.
 */
export default function CommunityEditModal({
    isEntity,
    editForm,
    setEditForm,
    editErr,
    busy,
    onSubmit,
    onClose,
}) {
    if (!editForm) return null;

    return (
        <div className="admin-modal-overlay" role="dialog" onClick={onClose}>
            <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
                <h3 className="admin-modal-title">Editar {isEntity ? 'entidad' : 'comunidad'}</h3>
                <form onSubmit={onSubmit} className="admin-modal-form">
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
                            onClick={onClose}
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/**
 * Destination (community vs entity) copy helpers — ETC for map panel + detail modal.
 */

export function destinationKindLabel(isEntity) {
    return isEntity ? 'Entidad' : 'Comunidad';
}

/**
 * @param {Array<{ isEntity?: boolean }>|null|undefined} destinations
 */
export function destinationSectionTitle(destinations) {
    const list = destinations ?? [];
    const entityCount = list.filter((d) => d.isEntity).length;
    const communityCount = list.length - entityCount;

    if (entityCount > 0 && communityCount === 0) {
        return entityCount === 1 ? 'Entidad' : 'Entidades';
    }
    if (communityCount > 0 && entityCount === 0) {
        return communityCount === 1 ? 'Comunidad' : 'Comunidades';
    }
    return 'Destinos';
}

/**
 * Content labels that adapt when the alert targets only entities (reportes).
 * @param {Array<{ isEntity?: boolean }>|null|undefined} destinations
 */
export function alertContentLabels(destinations) {
    const list = destinations ?? [];
    const allEntity = list.length > 0 && list.every((d) => d.isEntity);
    return {
        typeLabel: allEntity ? 'Tipo de reporte' : 'Tipo de alerta',
        messageLabel: 'Descripción',
        destinationTitle: destinationSectionTitle(list),
    };
}

/**
 * Prefer membership-loaded community meta when available (isEntity / name).
 */
export function enrichDestinationsWithMemberships(destinations, memberships = []) {
    const byId = new Map(
        (memberships ?? [])
            .filter((m) => m?.communityId)
            .map((m) => [m.communityId, m.community]),
    );
    return (destinations ?? []).map((d) => {
        const community = byId.get(d.id);
        if (!community) return d;
        return {
            ...d,
            name: community.name || d.name,
            isEntity: community.isEntity === true,
        };
    });
}

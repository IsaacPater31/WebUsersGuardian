/**
 * Admin/stats scope from the signed-in user's memberships.
 * Pure helpers — portable across dashboard and future menus (ETC).
 */

import { isOfficialEntityCommunity } from '@/shared/domain/communityVisibility';
import {
    buildStatsCommunityOptions,
    filterStatsOptionsByKind,
    reconcileSelectedCommunityIds,
} from '@/features/dashboard/utils/statsScope';

/** @typedef {'all' | 'communities' | 'entities'} StatsKindFilter */

export const ADMIN_SCOPE_STORAGE_KEY = 'guardian_usersweb_admin_scope';

/**
 * Flatten memberships → community-shaped rows for stats option builders.
 * @param {Array<{ communityId?: string, community?: object }>} memberships
 */
export function communitiesFromMemberships(memberships = []) {
    const byId = new Map();
    for (const m of memberships) {
        const id = m?.communityId || m?.community?.id;
        if (!id || !m.community || byId.has(id)) continue;
        byId.set(id, {
            id,
            name: m.community.name,
            isEntity: isOfficialEntityCommunity(m.community),
        });
    }
    return [...byId.values()];
}

/**
 * Full picker options (communities + entities the user belongs to).
 * @param {Array} memberships
 */
export function buildAdminScopeOptions(memberships = []) {
    return buildStatsCommunityOptions(communitiesFromMemberships(memberships));
}

/**
 * Which kind chips make sense for this membership set.
 * @param {ReturnType<typeof buildAdminScopeOptions>} options
 * @returns {StatsKindFilter[]}
 */
export function availableKindFilters(options = []) {
    const hasCommunity = options.some((o) => !o.isEntity);
    const hasEntity = options.some((o) => o.isEntity);
    if (hasCommunity && hasEntity) return ['all', 'communities', 'entities'];
    if (hasEntity) return ['entities'];
    if (hasCommunity) return ['communities'];
    return ['all'];
}

/**
 * @param {StatsKindFilter} kind
 * @param {StatsKindFilter[]} available
 */
export function resolveKindFilter(kind, available) {
    if (available.includes(kind)) return kind;
    return available[0] ?? 'all';
}

/**
 * @returns {{ kind: StatsKindFilter, selectedIds: string[]|null }|null}
 */
export function readStoredAdminScope() {
    try {
        const raw = sessionStorage.getItem(ADMIN_SCOPE_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const kind = parsed?.kind;
        if (kind !== 'all' && kind !== 'communities' && kind !== 'entities') return null;
        const selectedIds = parsed?.selectedIds;
        if (selectedIds != null && !Array.isArray(selectedIds)) return null;
        return {
            kind,
            selectedIds: selectedIds == null ? null : selectedIds.map(String),
        };
    } catch {
        return null;
    }
}

/**
 * @param {{ kind: StatsKindFilter, selectedIds: string[]|null }} value
 */
export function writeStoredAdminScope(value) {
    try {
        sessionStorage.setItem(
            ADMIN_SCOPE_STORAGE_KEY,
            JSON.stringify({
                kind: value.kind,
                selectedIds: value.selectedIds,
            }),
        );
    } catch {
        /* ignore quota / private mode */
    }
}

/**
 * Reconcile stored/in-memory selection against current membership options.
 * @param {{ kind: StatsKindFilter, selectedIds: string[]|null }} state
 * @param {ReturnType<typeof buildAdminScopeOptions>} allOptions
 */
export function reconcileAdminScopeState(state, allOptions) {
    const available = availableKindFilters(allOptions);
    const kind = resolveKindFilter(state?.kind ?? 'all', available);
    const visible = filterStatsOptionsByKind(allOptions, kind);
    const selectedIds = reconcileSelectedCommunityIds(state?.selectedIds ?? null, visible);
    return { kind, selectedIds, availableKinds: available, visibleOptions: visible };
}

export { filterStatsOptionsByKind, reconcileSelectedCommunityIds };

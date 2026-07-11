import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { normalCommunityIds as pickNormalIds } from '../utils/permissions';
import {
    ViewScope,
    VIEW_SCOPE_STORAGE_KEY,
    officialEntityIds,
    officialEntityMemberships,
    resolveInitialViewScope,
    typeOptionsForScope,
} from '../utils/viewScope';
import { isOfficialEntityCommunity } from '../utils/communityVisibility';

function readStoredScope() {
    try {
        return sessionStorage.getItem(VIEW_SCOPE_STORAGE_KEY);
    } catch {
        return null;
    }
}

/**
 * Shared Comunidades | Reportes scope for Map and Alerts.
 */
export function useViewScope() {
    const { memberships, normalCommunityIds, loading } = useAuth();

    const hasCommunities = normalCommunityIds.length > 0;
    const officialEntities = useMemo(
        () => officialEntityMemberships(memberships),
        [memberships],
    );
    const hasOfficialEntities = officialEntities.length > 0;
    const showToggle = hasCommunities && hasOfficialEntities;

    const [scope, setScopeState] = useState(ViewScope.communities);
    const [ready, setReady] = useState(false);

    // Resolve after memberships load so sessionStorage is honored (not wiped by empty auth).
    useEffect(() => {
        if (loading) {
            setReady(false);
            return;
        }

        setScopeState((prev) => {
            const stored = readStoredScope();
            // Prefer stored when both worlds exist; otherwise force the only available world.
            if (hasCommunities && hasOfficialEntities) {
                if (stored === ViewScope.communities || stored === ViewScope.reports) {
                    return stored;
                }
                // Keep in-memory choice if user toggled before storage write edge cases
                if (prev === ViewScope.communities || prev === ViewScope.reports) {
                    return prev;
                }
                return ViewScope.communities;
            }
            return resolveInitialViewScope({
                hasCommunities,
                hasOfficialEntities,
                stored: null,
            });
        });
        setReady(true);
    }, [loading, hasCommunities, hasOfficialEntities]);

    const setScope = useCallback((next) => {
        if (next !== ViewScope.communities && next !== ViewScope.reports) return;
        setScopeState(next);
        try {
            sessionStorage.setItem(VIEW_SCOPE_STORAGE_KEY, next);
        } catch {
            /* ignore */
        }
    }, []);

    const scopeIds = useMemo(() => {
        if (scope === ViewScope.reports) return officialEntityIds(memberships);
        return pickNormalIds(memberships);
    }, [scope, memberships]);

    const scopeCommunities = useMemo(() => {
        if (scope === ViewScope.reports) {
            return officialEntities
                .map((m) => ({
                    id: m.communityId,
                    name: m.community?.name || 'Reporte',
                }))
                .sort((a, b) => a.name.localeCompare(b.name, 'es'));
        }
        return memberships
            .filter((m) => m.community && !isOfficialEntityCommunity(m.community))
            .map((m) => ({ id: m.communityId, name: m.community.name || 'Comunidad' }))
            .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }, [scope, memberships, officialEntities]);

    const typeOptions = useMemo(
        () => typeOptionsForScope(scope, memberships),
        [scope, memberships],
    );

    const isReportsScope = scope === ViewScope.reports;
    const hasAnyScope = scopeIds.length > 0;

    return {
        scope,
        setScope,
        showToggle,
        scopeIds,
        scopeCommunities,
        typeOptions,
        isReportsScope,
        hasAnyScope,
        hasCommunities,
        hasOfficialEntities,
        ready,
        ViewScope,
    };
}

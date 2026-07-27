import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/ui/AuthProvider';
import {
    buildAdminScopeOptions,
    readStoredAdminScope,
    writeStoredAdminScope,
    reconcileAdminScopeState,
    filterStatsOptionsByKind,
    reconcileSelectedCommunityIds,
} from '@/features/scope/utils/membershipAdminScope';

/**
 * Membership-scoped admin filter for stats (and future menus).
 * Selection model matches DashFilterBar / map:
 * - selectedIds `null` → all visible for current kind
 * - `[]` → none
 * - `string[]` → subset
 */
export function useMembershipAdminScope() {
    const { memberships, loading } = useAuth();

    const allOptions = useMemo(
        () => buildAdminScopeOptions(memberships),
        [memberships],
    );

    const [kind, setKindState] = useState('all');
    const [selectedIds, setSelectedIdsState] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (loading) {
            setReady(false);
            return;
        }
        const stored = readStoredAdminScope();
        const next = reconcileAdminScopeState(
            stored ?? { kind: 'all', selectedIds: null },
            allOptions,
        );
        setKindState(next.kind);
        setSelectedIdsState(next.selectedIds);
        setReady(true);
    }, [loading, allOptions]);

    const availableKinds = useMemo(() => {
        const reconciled = reconcileAdminScopeState({ kind, selectedIds }, allOptions);
        return reconciled.availableKinds;
    }, [allOptions, kind, selectedIds]);

    const visibleOptions = useMemo(
        () => filterStatsOptionsByKind(allOptions, kind),
        [allOptions, kind],
    );

    const persist = useCallback((nextKind, nextIds) => {
        writeStoredAdminScope({ kind: nextKind, selectedIds: nextIds });
    }, []);

    const setKind = useCallback(
        (nextKind) => {
            const nextVisible = filterStatsOptionsByKind(allOptions, nextKind);
            const reconciled = reconcileSelectedCommunityIds(selectedIds, nextVisible);
            const safe = reconcileAdminScopeState(
                { kind: nextKind, selectedIds: reconciled },
                allOptions,
            );
            setKindState(safe.kind);
            setSelectedIdsState(safe.selectedIds);
            persist(safe.kind, safe.selectedIds);
        },
        [allOptions, selectedIds, persist],
    );

    const setSelectedIds = useCallback(
        (nextIds) => {
            const reconciled = reconcileSelectedCommunityIds(nextIds, visibleOptions);
            setSelectedIdsState(reconciled);
            persist(kind, reconciled);
        },
        [visibleOptions, kind, persist],
    );

    /** Effective community ids for queries/filters (never "platform all"). */
    const effectiveIds = useMemo(() => {
        if (selectedIds == null) return visibleOptions.map((o) => o.id);
        return selectedIds;
    }, [selectedIds, visibleOptions]);

    const hasScope = allOptions.length > 0;
    const showKindFilter = availableKinds.length > 1;

    return {
        ready: ready && !loading,
        loading,
        hasScope,
        allOptions,
        visibleOptions,
        availableKinds,
        showKindFilter,
        kind,
        setKind,
        selectedIds,
        setSelectedIds,
        effectiveIds,
    };
}

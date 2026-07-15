/**
 * Client-side scoping of alerts to the user's community memberships.
 */

export function alertBelongsToCommunities(alert, communityIds) {
    if (!communityIds?.length) return false;
    const allowed = new Set(communityIds);
    const ids = alert?.communityIds?.length
        ? alert.communityIds
        : alert?.communityId
          ? [alert.communityId]
          : [];
    return ids.some((id) => allowed.has(id));
}

export function filterAlertsByCommunities(alerts, communityIds) {
    return (alerts ?? []).filter((a) => alertBelongsToCommunities(a, communityIds));
}

export function filterAlertsByUser(alerts, userId) {
    if (!userId) return [];
    return (alerts ?? []).filter((a) => a.userId === userId);
}

/**
 * Aggregate top senders for stats table.
 * @param {Array} alerts
 * @param {boolean} includeAnonymous
 */
export function aggregateTopSenders(alerts, includeAnonymous = true) {
    const map = new Map();
    for (const a of alerts ?? []) {
        if (a.isAnonymous) {
            if (!includeAnonymous) continue;
            const key = '__anonymous__';
            map.set(key, {
                key,
                label: 'Anónimo',
                isAnonymous: true,
                count: (map.get(key)?.count ?? 0) + 1,
            });
            continue;
        }
        const key = a.userId || a.userEmail || a.userName || '__unknown__';
        const label = a.userName || a.userEmail || 'Usuario';
        const prev = map.get(key);
        map.set(key, {
            key,
            label,
            isAnonymous: false,
            count: (prev?.count ?? 0) + 1,
        });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
}

export function aggregateByType(alerts) {
    const map = new Map();
    for (const a of alerts ?? []) {
        const t = a.alertType || 'UNKNOWN';
        map.set(t, (map.get(t) ?? 0) + 1);
    }
    return [...map.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);
}

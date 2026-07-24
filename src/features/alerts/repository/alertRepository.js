/**
 * AlertRepository — Firestore I/O for alerts (Usersweb).
 * Parsing lives in alertMapper; client scope filters live in alerts/utils.
 *
 * Query strategy (no composite indexes):
 *   Server-side: timestamp range only.
 *   Client-side: alertType and alertStatus filtering.
 */
import {
    collection, query, where, orderBy,
    onSnapshot, Timestamp, limit,
    doc, updateDoc,
} from 'firebase/firestore';
import { db } from '@/shared/api/firebase';
import { Collections } from '@/shared/config/collections';
import {
    AlertFields,
    AlertStatus,
    QUERY_CONFIG,
    normalizeFilterTypes,
} from '@/shared/config/alertTypes';
import { resolveFilterDates } from '@/features/alerts/utils/dateRangeUtils';
import { fromDoc as parseAlert } from '@/features/alerts/mapper/alertMapper';

const alertsCol = () => collection(db, Collections.ALERTS);

function timestampConstraints(start, end) {
    const constraints = [];
    if (start) constraints.push(where(AlertFields.timestamp, '>=', Timestamp.fromDate(start)));
    if (end) constraints.push(where(AlertFields.timestamp, '<=', Timestamp.fromDate(end)));
    return constraints;
}

function firestoreTypeConstraints(canonicalTypes) {
    if (!canonicalTypes?.length) return [];
    const expandedTypes = new Set(canonicalTypes);
    if (expandedTypes.has('URGENCY')) expandedTypes.add('HEALTH');
    if (expandedTypes.has('HEALTH')) expandedTypes.add('URGENCY');
    const queryTypes = [...expandedTypes];
    if (queryTypes.length === 1) {
        return [where(AlertFields.alertType, '==', queryTypes[0])];
    }
    if (queryTypes.length <= 10) {
        return [where(AlertFields.alertType, 'in', queryTypes)];
    }
    return [];
}

function applyClientFilters(alerts, types, status) {
    let result = alerts;
    const canonicalTypes = normalizeFilterTypes(types);
    if (canonicalTypes.length > 0) {
        result = result.filter((a) => canonicalTypes.includes(a.alertType));
    }
    if (status !== 'all') {
        const target = status === AlertStatus.ATTENDED
            ? AlertStatus.ATTENDED
            : AlertStatus.PENDING;
        result = result.filter((a) =>
            status === AlertStatus.ATTENDED
                ? a.alertStatus === target
                : a.alertStatus !== AlertStatus.ATTENDED
        );
    }
    return result;
}

function alertTimeMs(alert) {
    const raw = alert?.timestamp;
    if (!raw) return 0;
    if (typeof raw.toDate === 'function') return raw.toDate().getTime();
    if (raw instanceof Date) return raw.getTime();
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

/** All alerts, newest first (map side panel list). */
export function sortAlertsNewestFirst(alerts) {
    return (alerts ?? [])
        .slice()
        .sort((a, b) => alertTimeMs(b) - alertTimeMs(a));
}

/** Pending alerts, newest first. */
export function sortPendingAlertsNewestFirst(alerts) {
    return (alerts ?? [])
        .filter((a) => a.alertStatus !== AlertStatus.ATTENDED)
        .slice()
        .sort((a, b) => alertTimeMs(b) - alertTimeMs(a));
}

function resolveLatestPendingAlertId(alerts) {
    return sortPendingAlertsNewestFirst(alerts)[0]?.id ?? null;
}

function subscribeAlertsFiltered(filters, callback, options = {}) {
    const { types = [], status = 'all' } = filters;
    const canonicalTypes = normalizeFilterTypes(types);
    const { start, end } = resolveFilterDates(filters);
    const fetchLimit = options.fetchLimit ?? QUERY_CONFIG.alertsFetchLimit;
    let unsub = () => {};
    let serverTypeFilterFailed = false;

    const buildQuery = (useServerTypeFilter) => {
        const constraints = [
            ...timestampConstraints(start, end),
            ...(useServerTypeFilter ? firestoreTypeConstraints(canonicalTypes) : []),
            orderBy(AlertFields.timestamp, 'desc'),
        ];
        if (!start && !end && !useServerTypeFilter) {
            constraints.push(limit(fetchLimit));
        }
        return query(alertsCol(), ...constraints);
    };

    const attach = (useServerTypeFilter) => {
        unsub();
        unsub = onSnapshot(
            buildQuery(useServerTypeFilter),
            (snapshot) => {
                let base = snapshot.docs.map(parseAlert);
                if (options.mapOnly) {
                    base = base.filter((a) => a.shareLocation && a.location);
                }
                const filtered = applyClientFilters(base, types, status);
                const latestContextAlertId = resolveLatestPendingAlertId(filtered);
                const changedIds = snapshot
                    .docChanges()
                    .filter((change) => change.type === 'added' || change.type === 'modified')
                    .map((change) => change.doc.id);

                callback(filtered, { latestContextAlertId, changedIds });
            },
            (error) => {
                if (useServerTypeFilter && canonicalTypes.length > 0 && !serverTypeFilterFailed) {
                    serverTypeFilterFailed = true;
                    console.warn(
                        '[alertRepository] Server alertType filter failed; using client-side type filter',
                        error.message
                    );
                    attach(false);
                    return;
                }
                console.error('[alertRepository] subscribeAlertsFiltered', error.message);
                callback([], { latestContextAlertId: null, changedIds: [] });
            }
        );
    };

    attach(canonicalTypes.length > 0);
    return () => unsub();
}

export function subscribeToMapAlertsFiltered(filters, callback) {
    return subscribeAlertsFiltered(filters, callback, {
        mapOnly: true,
        fetchLimit: QUERY_CONFIG.mapFetchLimit,
    });
}

export function subscribeToAlertsFiltered(filters, callback) {
    return subscribeAlertsFiltered(filters, callback, {
        mapOnly: false,
        fetchLimit: QUERY_CONFIG.alertsFetchLimit,
    });
}

export function subscribeToCommunityAlerts(communityId, callback) {
    const q = query(
        alertsCol(),
        where(AlertFields.communityIds, 'array-contains', communityId),
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const alerts = snapshot.docs
                .map(parseAlert)
                .sort((a, b) => alertTimeMs(b) - alertTimeMs(a))
                .slice(0, QUERY_CONFIG.communityAlertsLimit);
            callback(alerts);
        },
        (error) => {
            console.error('[alertRepository] subscribeToCommunityAlerts', error.message);
            callback([]);
        },
    );
}

export async function updateAlertStatus(alertId, status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized !== AlertStatus.ATTENDED && normalized !== 'attended') {
        throw new Error('Desde el panel web solo se puede marcar una alerta como atendida.');
    }
    if (!alertId) {
        throw new Error('Falta el id de la alerta');
    }
    const ref = doc(db, Collections.ALERTS, alertId);
    await updateDoc(ref, { [AlertFields.alertStatus]: AlertStatus.ATTENDED });
}

export function subscribeToAlertsInDateRange(start, end, callback, maxDocs = 2000) {
    const build = ({ withUpperBound }) => {
        const constraints = [
            where(AlertFields.timestamp, '>=', Timestamp.fromDate(start)),
            orderBy(AlertFields.timestamp, 'desc'),
            limit(maxDocs),
        ];
        if (withUpperBound) {
            constraints.splice(1, 0, where(AlertFields.timestamp, '<=', Timestamp.fromDate(end)));
        }
        return query(alertsCol(), ...constraints);
    };

    let unsub = () => {};
    let fallbackApplied = false;

    const attach = (withUpperBound) => {
        unsub();
        unsub = onSnapshot(
            build({ withUpperBound }),
            (snapshot) => {
                let alerts = snapshot.docs.map(parseAlert);
                if (!withUpperBound) {
                    alerts = alerts.filter((a) => alertTimeMs(a) <= end.getTime());
                }
                const latestContextAlertId = resolveLatestPendingAlertId(alerts);
                const changedIds = snapshot
                    .docChanges()
                    .filter((change) => change.type === 'added' || change.type === 'modified')
                    .map((change) => change.doc.id);
                callback(alerts, { latestContextAlertId, changedIds });
            },
            (error) => {
                if (withUpperBound && !fallbackApplied) {
                    fallbackApplied = true;
                    console.warn('[alertRepository] subscribeToAlertsInDateRange fallback:', error.message);
                    attach(false);
                    return;
                }
                console.error('[alertRepository] subscribeToAlertsInDateRange', error.message);
                callback([], { latestContextAlertId: null, changedIds: [] });
            }
        );
    };

    attach(true);
    return () => unsub();
}

export { parseAlert };

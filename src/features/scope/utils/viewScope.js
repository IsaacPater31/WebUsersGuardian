import { MemberFields } from '@/shared/config/firestoreFields';
import { isOfficialEntityCommunity } from '@/shared/domain/communityVisibility';
import { normalizeEntityReportTypes } from '@/features/reports/utils/entityReportTypes';
import { ACTIVE_ALERT_TYPES } from '@/shared/config/alertTypes';

/** Map / Alerts operational scope. */
export const ViewScope = Object.freeze({
    communities: 'communities',
    reports: 'reports',
});

export const VIEW_SCOPE_STORAGE_KEY = 'guardian_usersweb_view_scope';

/** Entities where the user is official (full inbox / map / alerts). */
export function officialEntityMemberships(memberships = []) {
    return memberships.filter(
        (m) =>
            m.community
            && isOfficialEntityCommunity(m.community)
            && m.role === MemberFields.roleOfficial,
    );
}

export function officialEntityIds(memberships = []) {
    return officialEntityMemberships(memberships).map((m) => m.communityId).filter(Boolean);
}

/**
 * Type chips for filter panels.
 * Communities → global ACTIVE_ALERT_TYPES.
 * Reports → union of custom types from official entities.
 */
export function typeOptionsForScope(scope, memberships = []) {
    if (scope === ViewScope.reports) {
        const byId = new Map();
        for (const m of officialEntityMemberships(memberships)) {
            for (const t of normalizeEntityReportTypes(m.community?.reportAlertTypes)) {
                if (!byId.has(t.id)) {
                    byId.set(t.id, {
                        key: t.id,
                        label: t.name,
                        color: t.color,
                        icon: 'AlertTriangle',
                    });
                }
            }
        }
        return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'));
    }

    return Object.entries(ACTIVE_ALERT_TYPES).map(([key, meta]) => ({
        key,
        label: meta.labelEs || meta.label || key,
        color: meta.color,
        icon: meta.icon,
    }));
}

export function resolveInitialViewScope({
    hasCommunities,
    hasOfficialEntities,
    stored = null,
}) {
    if (hasCommunities && hasOfficialEntities) {
        if (stored === ViewScope.communities || stored === ViewScope.reports) {
            return stored;
        }
        return ViewScope.communities;
    }
    if (hasOfficialEntities) return ViewScope.reports;
    return ViewScope.communities;
}

import { MemberFields } from '../config/firestoreFields';
import { isOfficialEntityCommunity } from './communityVisibility';

/** Roles that can manage membership (add, remove, promote, invite). */
export function canManageMembership(community, role) {
    if (!community || !role) return false;
    if (isOfficialEntityCommunity(community)) {
        return role === MemberFields.roleOfficial;
    }
    return role === MemberFields.roleAdmin;
}

/** Roles that can edit community metadata (name, icon, etc.). */
export function canEditCommunity(community, role) {
    return canManageMembership(community, role);
}

/** Roles that can review entity reports and change status. */
export function canReviewReports(community, role) {
    if (!community || !role) return false;
    if (isOfficialEntityCommunity(community)) {
        return role === MemberFields.roleOfficial;
    }
    return role === MemberFields.roleAdmin;
}

/** Roles that can send broadcast messages to a community. */
export function canSendMessages(community, role) {
    return canManageMembership(community, role);
}

/** Whether user can see the full entity report inbox (not just own). */
export function canViewEntityInbox(community, role) {
    return isOfficialEntityCommunity(community) && role === MemberFields.roleOfficial;
}

/** Normal communities for map/alerts/stats (exclude entities). */
export function normalCommunityIds(memberships) {
    return memberships
        .filter((m) => m.community && !isOfficialEntityCommunity(m.community))
        .map((m) => m.communityId);
}

/** Entity memberships for the Reportes section. */
export function entityMemberships(memberships) {
    return memberships.filter(
        (m) => m.community && isOfficialEntityCommunity(m.community),
    );
}

/** Communities where user has management role (admin or official). */
export function manageableMemberships(memberships) {
    return memberships.filter((m) => canManageMembership(m.community, m.role));
}

/**
 * Community admins may mark normal-community alerts as attended (one-way).
 * Entity officials may mark entity report alerts as attended.
 */
export function canMarkAlertAttended(alert, memberships) {
    if (!alert || !memberships?.length) return false;
    const ids = Array.isArray(alert.communityIds) && alert.communityIds.length > 0
        ? alert.communityIds
        : [alert.communityId].filter(Boolean);
    if (!ids.length) return false;

    return memberships.some((m) => {
        if (!ids.includes(m.communityId) || !m.community) return false;
        if (isOfficialEntityCommunity(m.community)) {
            return m.role === MemberFields.roleOfficial;
        }
        return m.role === MemberFields.roleAdmin;
    });
}

export function roleLabel(role, isEntity) {
    if (isEntity) {
        if (role === MemberFields.roleOfficial) return 'Oficial';
        return 'Miembro';
    }
    if (role === MemberFields.roleAdmin) return 'Administrador';
    return 'Miembro';
}

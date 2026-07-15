import { MemberFields } from '@/shared/config/firestoreFields';
import { roleLabel as permissionRoleLabel } from '@/shared/domain/permissions';

export const NON_ENTITY_ROLES = Object.freeze([
    MemberFields.roleMember,
    MemberFields.roleAdmin,
]);

export const ENTITY_ROLES = Object.freeze([
    MemberFields.roleMember,
    MemberFields.roleOfficial,
]);

export const NON_ENTITY_ROLE_SET = new Set(NON_ENTITY_ROLES);
export const ENTITY_ROLE_SET = new Set(ENTITY_ROLES);

/** Allowed role strings for a community/entity document. */
export function allowedRolesFor(communityOrIsEntity) {
    const isEntity = typeof communityOrIsEntity === 'boolean'
        ? communityOrIsEntity
        : Boolean(communityOrIsEntity?.isEntity);
    return isEntity ? ENTITY_ROLES : NON_ENTITY_ROLES;
}

export function isAllowedRole(communityOrIsEntity, role) {
    const allowed = allowedRolesFor(communityOrIsEntity);
    return allowed.includes(role);
}

/** Single display label for roles (same as permissions.roleLabel). */
export function roleLabel(role, isEntity) {
    return permissionRoleLabel(role, isEntity);
}

/** Select options for community detail UI (value + label). */
export function roleSelectOptions(isEntity) {
    return allowedRolesFor(isEntity).map((value) => ({
        value,
        label: permissionRoleLabel(value, isEntity),
    }));
}

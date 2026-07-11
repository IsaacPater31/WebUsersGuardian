/**
 * User-scoped community operations (admin / official roles).
 * Platform-level CRUD stays in webapp only.
 */
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    serverTimestamp,
    updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Collections } from '../config/collections';
import { CommunityFields, MemberFields } from '../config/firestoreFields';
import { canManageMembership } from '../utils/permissions';
import { isOfficialEntityCommunity } from '../utils/communityVisibility';
import { getCommunityMembers } from './communityService';
import { InboxKinds, notifyMembershipEvent } from './inboxNotifyService';

const membersCol = () => collection(db, Collections.COMMUNITY_MEMBERS);

const NON_ENTITY_ROLES = new Set([MemberFields.roleMember, MemberFields.roleAdmin]);
const ENTITY_ROLES = new Set([MemberFields.roleMember, MemberFields.roleOfficial]);

function normalizeRole(role) {
    return String(role || '').trim().toLowerCase() || MemberFields.roleMember;
}

async function assertCanManage(communityId, memberships) {
    const membership = memberships.find((m) => m.communityId === communityId);
    if (!membership?.community) {
        throw new Error('No perteneces a esta comunidad');
    }
    if (!canManageMembership(membership.community, membership.role)) {
        throw new Error('No tienes permiso para gestionar esta comunidad');
    }
    return membership;
}

async function getAllowedRoles(community) {
    return isOfficialEntityCommunity(community) ? ENTITY_ROLES : NON_ENTITY_ROLES;
}

export async function userUpdateCommunity(communityId, patch, memberships) {
    const membership = await assertCanManage(communityId, memberships);
    const ref = doc(db, Collections.COMMUNITIES, communityId);
    const data = {};
    if (patch.name != null) data[CommunityFields.name] = String(patch.name).trim();
    if (patch.description !== undefined) data[CommunityFields.description] = patch.description;
    if (patch.allowForwardToEntities != null) {
        data[CommunityFields.allowForwardToEntities] = Boolean(patch.allowForwardToEntities);
    }
    if (patch.iconCodePoint !== undefined) {
        data[CommunityFields.iconCodePoint] =
            patch.iconCodePoint == null ? null : Number(patch.iconCodePoint);
    }
    if (patch.iconColor !== undefined) data[CommunityFields.iconColor] = patch.iconColor;
    if (isOfficialEntityCommunity(membership.community)) {
        if (patch.reportButtonColor !== undefined) {
            data[CommunityFields.reportButtonColor] = patch.reportButtonColor;
        }
        if (patch.reportAlertTypes !== undefined) {
            data[CommunityFields.reportAlertTypes] = Array.isArray(patch.reportAlertTypes)
                ? patch.reportAlertTypes
                : [];
        }
    }
    await updateDoc(ref, data);
}

export async function userAddCommunityMember(communityId, userId, role, memberships, actor = {}) {
    const membership = await assertCanManage(communityId, memberships);
    const r = normalizeRole(role);
    const allowed = await getAllowedRoles(membership.community);
    if (!allowed.has(r)) {
        throw new Error('Rol inválido para esta comunidad');
    }
    await addDoc(membersCol(), {
        [MemberFields.communityId]: communityId,
        [MemberFields.userId]: userId,
        [MemberFields.role]: r,
        [MemberFields.joinedAt]: serverTimestamp(),
    });
    await notifyMembershipEvent({
        targetUserId: userId,
        kind: InboxKinds.memberAdded,
        communityId,
        communityName: membership.community?.name,
        actorId: actor.actorId ?? null,
        actorName: actor.actorName ?? null,
        role: r,
    });
}

export async function userRemoveMember(memberDocId, communityId, memberships, actor = {}) {
    const membership = await assertCanManage(communityId, memberships);
    const memberRef = doc(db, Collections.COMMUNITY_MEMBERS, memberDocId);
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) throw new Error('Miembro no encontrado');
    const targetUserId = memberSnap.data()[MemberFields.userId];
    // Notify BEFORE delete so membership-gated rules still allow the inbox write.
    if (targetUserId) {
        await notifyMembershipEvent({
            targetUserId,
            kind: InboxKinds.memberRemoved,
            communityId,
            communityName: membership.community?.name,
            actorId: actor.actorId ?? null,
            actorName: actor.actorName ?? null,
        });
    }
    await deleteDoc(memberRef);
}

export async function userUpdateMemberRole(memberDocId, role, communityId, memberships, actor = {}) {
    const membership = await assertCanManage(communityId, memberships);
    const r = normalizeRole(role);
    const allowed = await getAllowedRoles(membership.community);
    if (!allowed.has(r)) {
        throw new Error('Rol inválido para esta comunidad');
    }
    const memberRef = doc(db, Collections.COMMUNITY_MEMBERS, memberDocId);
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) throw new Error('Miembro no encontrado');
    const memberData = memberSnap.data() || {};
    const memberCommunityId = memberData[MemberFields.communityId];
    if (memberCommunityId !== communityId) {
        throw new Error('Miembro no pertenece a esta comunidad');
    }
    const previousRole = memberData[MemberFields.role];
    const targetUserId = memberData[MemberFields.userId];
    await updateDoc(memberRef, { [MemberFields.role]: r });
    if (targetUserId && previousRole !== r) {
        await notifyMembershipEvent({
            targetUserId,
            kind: InboxKinds.roleChanged,
            communityId,
            communityName: membership.community?.name,
            actorId: actor.actorId ?? null,
            actorName: actor.actorName ?? null,
            role: r,
            previousRole,
        });
    }
}

/**
 * Prevent removing/demoting the last admin/official.
 */
export async function countManagers(communityId, isEntity) {
    const members = await getCommunityMembers(communityId);
    const managerRole = isEntity ? MemberFields.roleOfficial : MemberFields.roleAdmin;
    return members.filter((m) => m.role === managerRole || (!isEntity && m.role === 'admin')).length;
}

export async function userLeaveCommunity(memberDocId, communityId, memberships) {
    const mine = memberships.find((m) => m.communityId === communityId);
    if (!mine) throw new Error('No perteneces a esta comunidad');
    const isEntity = isOfficialEntityCommunity(mine.community);
    const managerRole = isEntity ? MemberFields.roleOfficial : MemberFields.roleAdmin;
    if (mine.role === managerRole) {
        const managers = await countManagers(communityId, isEntity);
        if (managers <= 1) {
            throw new Error('Eres el único gestor. Promueve a otro miembro antes de salir.');
        }
    }
    await deleteDoc(doc(db, Collections.COMMUNITY_MEMBERS, memberDocId));
}

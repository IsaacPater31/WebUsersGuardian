/**
 * Loads community memberships for the authenticated user.
 */
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Collections } from '../config/collections';
import { MemberFields } from '../config/firestoreFields';

function parseCommunity(docSnap) {
    const d = docSnap.data() || {};
    return {
        id: docSnap.id,
        name: d.name || '',
        description: d.description ?? null,
        isEntity: d.is_entity ?? false,
        createdBy: d.created_by ?? null,
        allowForwardToEntities: d.allow_forward_to_entities ?? true,
        createdAt: d.created_at ?? null,
        iconCodePoint: d.icon_code_point ?? null,
        iconColor: d.icon_color ?? null,
        reportButtonColor: d.report_button_color ?? null,
        reportAlertTypes: Array.isArray(d.report_alert_types)
            ? d.report_alert_types.filter((t) => typeof t === 'string' && t)
            : [],
    };
}

function parseMembership(docSnap, community) {
    const d = docSnap.data() || {};
    return {
        id: docSnap.id,
        communityId: d[MemberFields.communityId] || d.community_id || community?.id || null,
        userId: d[MemberFields.userId] || d.user_id || null,
        role: d[MemberFields.role] || MemberFields.roleMember,
        joinedAt: d[MemberFields.joinedAt] || d.joined_at || null,
        community,
    };
}

/**
 * @param {string} userId
 * @returns {Promise<Array<{
 *   id: string, communityId: string, userId: string, role: string,
 *   joinedAt: any, community: object | null,
 * }>>}
 */
export async function fetchUserMemberships(userId) {
    if (!userId) return [];

    const q = query(
        collection(db, Collections.COMMUNITY_MEMBERS),
        where(MemberFields.userId, '==', userId),
    );
    const snap = await getDocs(q);
    if (snap.empty) return [];

    const communityIds = [
        ...new Set(
            snap.docs
                .map((d) => d.data()[MemberFields.communityId] || d.data().community_id)
                .filter(Boolean),
        ),
    ];

    const communityMap = new Map();
    await Promise.all(
        communityIds.map(async (cid) => {
            try {
                const cSnap = await getDoc(doc(db, Collections.COMMUNITIES, cid));
                if (cSnap.exists()) {
                    communityMap.set(cid, parseCommunity(cSnap));
                }
            } catch {
                /* community may have been deleted */
            }
        }),
    );

    return snap.docs
        .map((d) => {
            const cid = d.data()[MemberFields.communityId] || d.data().community_id;
            return parseMembership(d, communityMap.get(cid) ?? null);
        })
        .filter((m) => m.community != null);
}

/**
 * @param {Array} memberships
 * @param {string} communityId
 */
export function getMembershipForCommunity(memberships, communityId) {
    return memberships.find((m) => m.communityId === communityId) ?? null;
}

/**
 * @param {Array} memberships
 * @param {string} communityId
 */
export function getRoleInCommunity(memberships, communityId) {
    return getMembershipForCommunity(memberships, communityId)?.role ?? null;
}

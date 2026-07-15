/**
 * MembershipRepository — loads community_members for the authenticated user.
 */
import {
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    where,
} from 'firebase/firestore';
import { db } from '@/shared/api/firebase';
import { Collections } from '@/shared/config/collections';
import { MemberFields } from '@/shared/config/firestoreFields';
import { fromDoc as parseCommunity } from '@/features/communities/mapper/communityMapper';
import { fromDoc as parseMembership } from '@/features/memberships/mapper/membershipMapper';

/**
 * @param {import('firebase/firestore').QuerySnapshot} snap
 */
async function membershipsFromSnapshot(snap) {
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

export async function fetchUserMemberships(userId) {
    if (!userId) return [];

    const q = query(
        collection(db, Collections.COMMUNITY_MEMBERS),
        where(MemberFields.userId, '==', userId),
    );
    const snap = await getDocs(q);
    return membershipsFromSnapshot(snap);
}

export function subscribeUserMemberships(userId, callback) {
    if (!userId) {
        callback([]);
        return () => {};
    }

    const q = query(
        collection(db, Collections.COMMUNITY_MEMBERS),
        where(MemberFields.userId, '==', userId),
    );

    return onSnapshot(
        q,
        async (snap) => {
            try {
                callback(await membershipsFromSnapshot(snap));
            } catch (e) {
                console.error('[membershipRepository] subscribeUserMemberships', e);
                callback([]);
            }
        },
        (e) => {
            console.error('[membershipRepository] subscribeUserMemberships', e);
            callback([]);
        },
    );
}

export function getMembershipForCommunity(memberships, communityId) {
    return memberships.find((m) => m.communityId === communityId) ?? null;
}

export function getRoleInCommunity(memberships, communityId) {
    return getMembershipForCommunity(memberships, communityId)?.role ?? null;
}

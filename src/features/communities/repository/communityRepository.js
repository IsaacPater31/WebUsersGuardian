/**
 * CommunityRepository — Firestore reads for communities & members.
 */
import {
    collection, getDocs, query, where,
    onSnapshot, documentId,
} from 'firebase/firestore';
import { db } from '@/shared/api/firebase';
import { Collections } from '@/shared/config/collections';
import { MemberFields } from '@/shared/config/firestoreFields';
import { fromDoc as parseCommunity } from '@/features/communities/mapper/communityMapper';

let _nameCache = {};
let _cacheReady = false;

async function _warmCache() {
    if (_cacheReady) return;
    try {
        const snapshot = await getDocs(collection(db, Collections.COMMUNITIES));
        for (const docSnap of snapshot.docs) {
            _nameCache[docSnap.id] = docSnap.data().name || docSnap.id;
        }
        _cacheReady = true;
    } catch { /* Network unavailable — degrade gracefully */ }
}

export async function getCommunityName(id) {
    if (!id) return null;
    if (_nameCache[id]) return _nameCache[id];
    await _warmCache();
    return _nameCache[id] ?? 'Comunidad eliminada o inexistente';
}

export async function getCommunityNames(ids) {
    if (!ids || ids.length === 0) return [];
    await _warmCache();
    return ids.map((id) => ({
        id,
        name: _nameCache[id] ?? 'Comunidad desconocida',
    }));
}

function membersFromSnapshot(snapshot) {
    return snapshot.docs.map((memberDoc) => {
        const d = memberDoc.data();
        return {
            id: memberDoc.id,
            userId: d[MemberFields.userId] || d.user_id || d.userId || null,
            role: d[MemberFields.role] || d.role || MemberFields.roleMember,
            joinedAt: d[MemberFields.joinedAt] || d.joined_at || d.joinedAt || null,
            displayName: d.display_name || d.displayName || d.full_name || d.name || null,
            email: d.email || d.user_email || null,
        };
    });
}

async function enrichMembers(members) {
    const userIds = [...new Set(members.map((m) => m.userId).filter(Boolean))];
    if (userIds.length === 0) return members;

    const userMap = new Map();
    try {
        for (let i = 0; i < userIds.length; i += 10) {
            const batch = userIds.slice(i, i + 10);
            const snap = await getDocs(
                query(collection(db, Collections.USERS), where(documentId(), 'in', batch))
            );
            snap.forEach((d) => userMap.set(d.id, d.data()));
        }
    } catch { /* users collection may not be public */ }

    const alertUserMap = new Map();
    try {
        for (let i = 0; i < userIds.length; i += 10) {
            const batch = userIds.slice(i, i + 10);
            const snap = await getDocs(
                query(collection(db, Collections.ALERTS), where('userId', 'in', batch))
            );
            snap.forEach((d) => {
                const data = d.data();
                const uid = data.userId;
                if (!uid || alertUserMap.has(uid)) return;
                alertUserMap.set(uid, { userName: data.userName ?? null, userEmail: data.userEmail ?? null });
            });
        }
    } catch { /* ignore */ }

    return members.map((m) => {
        const u = m.userId ? userMap.get(m.userId) : null;
        const au = m.userId ? alertUserMap.get(m.userId) : null;
        return {
            ...m,
            displayName:
                m.displayName ||
                u?.display_name || u?.displayName || u?.full_name || u?.name ||
                au?.userName ||
                null,
            email:
                m.email ||
                u?.email ||
                au?.userEmail ||
                null,
        };
    });
}

export async function getCommunityMembers(communityId) {
    const q = query(
        collection(db, Collections.COMMUNITY_MEMBERS),
        where(MemberFields.communityId, '==', communityId)
    );
    const snapshot = await getDocs(q);
    return enrichMembers(membersFromSnapshot(snapshot));
}

export function subscribeCommunityMembers(communityId, callback) {
    const q = query(
        collection(db, Collections.COMMUNITY_MEMBERS),
        where(MemberFields.communityId, '==', communityId),
    );
    return onSnapshot(
        q,
        async (snapshot) => {
            try {
                callback(await enrichMembers(membersFromSnapshot(snapshot)));
            } catch (e) {
                console.error('[communityRepository] subscribeCommunityMembers', e);
                callback(membersFromSnapshot(snapshot));
            }
        },
        (e) => {
            console.error('[communityRepository] subscribeCommunityMembers', e);
            callback([]);
        },
    );
}

export function subscribeCommunityMemberCount(communityId, callback) {
    const q = query(
        collection(db, Collections.COMMUNITY_MEMBERS),
        where(MemberFields.communityId, '==', communityId),
    );
    return onSnapshot(
        q,
        (snapshot) => callback(snapshot.size),
        () => callback(0),
    );
}

export { parseCommunity };

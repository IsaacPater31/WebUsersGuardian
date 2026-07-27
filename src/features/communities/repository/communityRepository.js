/**
 * CommunityRepository — Firestore reads for communities & members.
 */
import {
    collection, getDocs, query, where,
    onSnapshot, documentId,
} from 'firebase/firestore';
import { db } from '@/shared/api/firebase';
import { Collections } from '@/shared/config/collections';
import { MemberFields, CommunityFields } from '@/shared/config/firestoreFields';
import { fromDoc as parseCommunity } from '@/features/communities/mapper/communityMapper';
import { resolveMemberDisplayLabel } from '@/shared/utils/memberDisplayLabel';
import { extractUserProfileFields } from '@/shared/utils/userDocParse';

/** @type {Record<string, { name: string, isEntity: boolean }>} */
let _metaCache = {};
let _cacheReady = false;

function readCommunityMeta(data, fallbackId) {
    const d = data || {};
    return {
        name: d[CommunityFields.name] ?? d.name ?? fallbackId,
        isEntity: !!(d[CommunityFields.isEntity] ?? d.is_entity ?? d.isEntity),
    };
}

function putMeta(id, data) {
    if (!id) return;
    _metaCache[id] = readCommunityMeta(data, id);
}

async function _warmCache() {
    if (_cacheReady) return;
    try {
        const snapshot = await getDocs(collection(db, Collections.COMMUNITIES));
        for (const docSnap of snapshot.docs) {
            putMeta(docSnap.id, docSnap.data());
        }
        _cacheReady = true;
    } catch { /* Network unavailable — degrade gracefully */ }
}

export async function getCommunityName(id) {
    if (!id) return null;
    if (_metaCache[id]?.name) return _metaCache[id].name;
    await _warmCache();
    return _metaCache[id]?.name ?? 'Comunidad eliminada o inexistente';
}

/**
 * @param {string[]} ids
 * @returns {Promise<Array<{ id: string, name: string, isEntity: boolean }>>}
 */
export async function getCommunityNames(ids) {
    if (!ids || ids.length === 0) return [];
    await _warmCache();
    return ids.map((id) => ({
        id,
        name: _metaCache[id]?.name ?? 'Comunidad desconocida',
        isEntity: _metaCache[id]?.isEntity ?? false,
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
            alias: d[MemberFields.alias] ?? d.alias ?? null,
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
        const profileName =
            u?.display_name || u?.displayName || u?.full_name || u?.name ||
            au?.userName ||
            null;
        return {
            ...m,
            alias: m.alias ?? null,
            profileName,
            displayName: resolveMemberDisplayLabel({
                alias: m.alias,
                displayName: profileName,
                fallback: null,
            }),
            email:
                m.email ||
                u?.email ||
                au?.userEmail ||
                null,
        };
    });
}

/**
 * @param {string} communityId
 * @returns {Promise<Record<string, string>>}
 */
export async function getMemberAliasMap(communityId) {
    const q = query(
        collection(db, Collections.COMMUNITY_MEMBERS),
        where(MemberFields.communityId, '==', communityId),
    );
    const snapshot = await getDocs(q);
    /** @type {Record<string, string>} */
    const map = {};
    for (const memberDoc of snapshot.docs) {
        const d = memberDoc.data();
        const userId = d[MemberFields.userId] || d.user_id;
        const alias = String(d[MemberFields.alias] ?? d.alias ?? '').trim();
        if (userId && alias) map[userId] = alias;
    }
    return map;
}

/**
 * Nombres de admin(s) / oficiales por comunidad.
 * Incluye role `admin` y, en entidades, `official`.
 * No depende de índice compuesto: si falla el filtro dual, lee miembros y filtra en cliente.
 *
 * @param {Array<{ id: string, name?: string|null, createdBy?: string|null, isEntity?: boolean }>} communities
 * @returns {Promise<Record<string, string[]>>} communityId → nombres
 */
export async function resolveCommunityAdminNames(communities) {
    const targets = (communities || []).filter((c) => c?.id);
    if (targets.length === 0) return {};

    /** @type {Record<string, string[]>} */
    const result = {};

    await Promise.all(targets.map(async (c) => {
        const names = [];
        try {
            const userIds = await listManagerUserIds(c);
            if (userIds.length === 0 && c.createdBy) {
                userIds.push(c.createdBy);
            }
            const nameById = await loadDisplayNames(userIds);
            for (const uid of userIds) {
                const n = nameById.get(uid);
                if (n) names.push(n);
            }
        } catch (err) {
            console.warn('[resolveCommunityAdminNames]', c.id, err);
        }
        result[c.id] = names;
    }));

    return result;
}

/**
 * @param {{ id: string, isEntity?: boolean }} community
 * @returns {Promise<string[]>}
 */
async function listManagerUserIds(community) {
    const managerRoles = new Set([
        MemberFields.roleAdmin,
        ...(community.isEntity ? [MemberFields.roleOfficial] : []),
    ]);

    // Prefer filtered query; fall back if composite index is missing.
    try {
        const snaps = await Promise.all(
            [...managerRoles].map((role) => getDocs(
                query(
                    collection(db, Collections.COMMUNITY_MEMBERS),
                    where(MemberFields.communityId, '==', community.id),
                    where(MemberFields.role, '==', role),
                ),
            )),
        );
        return [...new Set(
            snaps.flatMap((snap) => snap.docs.map((d) => {
                const data = d.data() || {};
                return data[MemberFields.userId] || data.user_id || null;
            }).filter(Boolean)),
        )];
    } catch {
        const snap = await getDocs(
            query(
                collection(db, Collections.COMMUNITY_MEMBERS),
                where(MemberFields.communityId, '==', community.id),
            ),
        );
        return [...new Set(
            snap.docs
                .map((d) => {
                    const data = d.data() || {};
                    const role = data[MemberFields.role] || data.role;
                    if (!managerRoles.has(role)) return null;
                    return data[MemberFields.userId] || data.user_id || null;
                })
                .filter(Boolean),
        )];
    }
}

/**
 * @param {string[]} userIds
 * @returns {Promise<Map<string, string>>}
 */
async function loadDisplayNames(userIds) {
    const map = new Map();
    if (!userIds.length) return map;
    try {
        for (let i = 0; i < userIds.length; i += 10) {
            const batch = userIds.slice(i, i + 10);
            const usersSnap = await getDocs(
                query(collection(db, Collections.USERS), where(documentId(), 'in', batch)),
            );
            const found = new Set();
            usersSnap.forEach((u) => {
                found.add(u.id);
                const { displayName, email } = extractUserProfileFields(u.data() || {});
                const label = (displayName || email || '').trim();
                if (label) map.set(u.id, label);
            });
            // UID sin perfil legible: no inventar IDs en UI
            for (const uid of batch) {
                if (!found.has(uid) && !map.has(uid)) {
                    /* leave unnamed */
                }
            }
        }
    } catch (err) {
        console.warn('[loadDisplayNames]', err);
    }
    return map;
}

export async function getCommunityMembers(communityId) {
    const q = query(
        collection(db, Collections.COMMUNITY_MEMBERS),
        where(MemberFields.communityId, '==', communityId)
    );
    const snapshot = await getDocs(q);
    return enrichMembers(membersFromSnapshot(snapshot));
}

/** Real-time subscription to all communities (Dashboard stats scope). */
export function subscribeToCommunities(callback) {
    return onSnapshot(
        collection(db, Collections.COMMUNITIES),
        (snapshot) => {
            const communities = snapshot.docs.map((docSnap) => {
                putMeta(docSnap.id, docSnap.data());
                return parseCommunity(docSnap);
            });
            _cacheReady = true;
            callback(communities);
        },
        (e) => {
            console.error('[communityRepository] subscribeToCommunities', e);
            callback([]);
        },
    );
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

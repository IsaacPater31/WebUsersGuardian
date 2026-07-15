/**
 * Search users to add as community members (scoped search, not global admin directory).
 */
import {
    collection,
    getDocs,
    limit,
    query,
    where,
} from 'firebase/firestore';
import { db, auth } from '@/shared/api/firebase';
import { Collections } from '@/shared/config/collections';
import { MemberFields } from '@/shared/config/firestoreFields';
import { extractUserProfileFields } from '@/shared/utils/userDocParse';

function parseUser(docSnap) {
    const d = docSnap.data() || {};
    const { displayName, email } = extractUserProfileFields(d);
    return { id: docSnap.id, displayName, email };
}

function matchesText(user, docId, qLower) {
    if (user.email?.toLowerCase().includes(qLower)) return true;
    if (user.displayName?.toLowerCase().includes(qLower)) return true;
    if (docId.toLowerCase().includes(qLower)) return true;
    return false;
}

/**
 * @param {string} text
 * @param {{ excludeCommunityId?: string }} [opts]
 */
export async function searchUsersByText(text, opts = {}) {
    const qLower = text.trim().toLowerCase();
    if (qLower.length < 2) return [];

    const currentUid = auth.currentUser?.uid;
    let existingIds = new Set();
    if (opts.excludeCommunityId) {
        const mq = query(
            collection(db, Collections.COMMUNITY_MEMBERS),
            where(MemberFields.communityId, '==', opts.excludeCommunityId),
        );
        const msnap = await getDocs(mq);
        existingIds = new Set(
            msnap.docs
                .map((d) => d.data()[MemberFields.userId] || d.data().user_id)
                .filter(Boolean),
        );
    }

    const results = [];
    const added = new Set();

    // Email prefix search
    try {
        const emailQ = query(
            collection(db, Collections.USERS),
            where('email', '>=', qLower),
            where('email', '<=', `${qLower}\uf8ff`),
            limit(10),
        );
        const snap = await getDocs(emailQ);
        for (const docSnap of snap.docs) {
            if (docSnap.id === currentUid || existingIds.has(docSnap.id) || added.has(docSnap.id)) continue;
            const user = parseUser(docSnap);
            if (matchesText(user, docSnap.id, qLower)) {
                results.push(user);
                added.add(docSnap.id);
            }
        }
    } catch {
        /* email index may be missing */
    }

    // Name scan fallback
    if (results.length < 10) {
        const snap = await getDocs(query(collection(db, Collections.USERS), limit(120)));
        for (const docSnap of snap.docs) {
            if (results.length >= 10) break;
            if (docSnap.id === currentUid || existingIds.has(docSnap.id) || added.has(docSnap.id)) continue;
            const user = parseUser(docSnap);
            if (matchesText(user, docSnap.id, qLower)) {
                results.push(user);
                added.add(docSnap.id);
            }
        }
    }

    return results;
}

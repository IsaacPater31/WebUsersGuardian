/**
 * Dashboard helpers: users created in a date range.
 * Kept free of admin directory community paging so Usersweb can build without
 * fetchCommunitiesPage (webapp-only admin module surface).
 */
import {
    collection,
    getDocs,
    query,
    where,
    limit,
    orderBy,
    Timestamp,
    onSnapshot,
} from 'firebase/firestore';
import { db } from '@/shared/api/firebase';
import { Collections } from '@/shared/config/collections';
import { UserFields } from '@/shared/config/firestoreFields';
import { extractUserProfileFields } from '@/shared/utils/userDocParse';

/** @param {import('firebase/firestore').DocumentSnapshot} docSnap */
function parseUserDoc(docSnap) {
    const d = docSnap.data() || {};
    const { displayName, email, createdAt, platformAdmin } = extractUserProfileFields(d);
    let createdAtMs = 0;
    let createdDisplay = '—';
    const ts = createdAt;
    if (ts?.toDate) {
        const dt = ts.toDate();
        createdAtMs = dt.getTime();
        createdDisplay = dt.toLocaleString('es-CO', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    }
    return {
        id: docSnap.id,
        email,
        displayName,
        createdDisplay,
        createdAtMs,
        platformAdmin,
    };
}

async function adminListUsers(limitCount = 40) {
    try {
        const q = query(
            collection(db, Collections.USERS),
            orderBy(UserFields.createdAt, 'desc'),
            limit(limitCount),
        );
        const snap = await getDocs(q);
        return snap.docs.map(parseUserDoc);
    } catch {
        const snap = await getDocs(collection(db, Collections.USERS));
        const list = snap.docs.map(parseUserDoc);
        list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        return list.slice(0, limitCount);
    }
}

async function adminListUsersInCreatedRange(startDate, endDate, limitCount = 120) {
    const start = Timestamp.fromDate(startDate);
    const end = Timestamp.fromDate(endDate);
    try {
        const q = query(
            collection(db, Collections.USERS),
            where(UserFields.createdAt, '>=', start),
            where(UserFields.createdAt, '<=', end),
            orderBy(UserFields.createdAt, 'desc'),
            limit(limitCount),
        );
        const snap = await getDocs(q);
        return snap.docs.map(parseUserDoc);
    } catch (e) {
        console.warn('[adminListUsersInCreatedRange] fallback:', e?.message);
        const batchLimit = Math.max(limitCount * 4, 200);
        const all = await adminListUsers(batchLimit);
        const t0 = startDate.getTime();
        const t1 = endDate.getTime();
        return all
            .filter((u) => u.createdAtMs > 0 && u.createdAtMs >= t0 && u.createdAtMs <= t1)
            .slice(0, limitCount);
    }
}

/**
 * Real-time subscription to users created within a date range (Dashboard).
 */
export function subscribeUsersInCreatedRange(startDate, endDate, callback, limitCount = 120) {
    const start = Timestamp.fromDate(startDate);
    const end = Timestamp.fromDate(endDate);
    const endMs = endDate.getTime();
    let unsub = () => {};
    let fallbackApplied = false;

    const attach = (withUpperBound) => {
        unsub();
        const constraints = [
            where(UserFields.createdAt, '>=', start),
            orderBy(UserFields.createdAt, 'desc'),
            limit(withUpperBound ? limitCount : Math.max(limitCount * 4, 200)),
        ];
        if (withUpperBound) {
            constraints.splice(1, 0, where(UserFields.createdAt, '<=', end));
        }

        unsub = onSnapshot(
            query(collection(db, Collections.USERS), ...constraints),
            (snap) => {
                let users = snap.docs.map(parseUserDoc);
                if (!withUpperBound) {
                    users = users.filter(
                        (u) =>
                            u.createdAtMs > 0 &&
                            u.createdAtMs >= startDate.getTime() &&
                            u.createdAtMs <= endMs,
                    );
                }
                callback(users.slice(0, limitCount));
            },
            async (error) => {
                if (withUpperBound && !fallbackApplied) {
                    fallbackApplied = true;
                    console.warn('[subscribeUsersInCreatedRange] fallback:', error?.message);
                    attach(false);
                    return;
                }
                console.error('[subscribeUsersInCreatedRange]', error?.message);
                try {
                    callback(await adminListUsersInCreatedRange(startDate, endDate, limitCount));
                } catch {
                    callback([]);
                }
            },
        );
    };

    attach(true);
    return () => unsub();
}

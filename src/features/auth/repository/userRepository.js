import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/shared/api/firebase';
import { Collections } from '@/shared/config/collections';
import { UserFields } from '@/shared/config/firestoreFields';

/** Ensures users/{uid} exists / is refreshed on login (merge). */
export async function ensureUserDoc(user) {
    if (!user) return;
    const ref = doc(db, Collections.USERS, user.uid);
    await setDoc(
        ref,
        {
            [UserFields.email]: user.email?.toLowerCase() ?? null,
            [UserFields.displayName]: user.displayName || user.email?.split('@')[0] || 'Usuario',
            [UserFields.name]: user.displayName || user.email?.split('@')[0] || 'Usuario',
            [UserFields.updatedAt]: serverTimestamp(),
        },
        { merge: true },
    );
}

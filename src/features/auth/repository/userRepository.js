import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/shared/api/firebase';
import { Collections } from '@/shared/config/collections';
import { UserFields } from '@/shared/config/firestoreFields';

export const ACCOUNT_SUSPENDED_CODE = 'account-suspended';
export const ACCOUNT_STATUS_UNAVAILABLE_CODE = 'account-status-unavailable';
export const ACCOUNT_SUSPENDED_MESSAGE =
    'Tu cuenta está suspendida. Contacta al administrador.';
export const ACCOUNT_STATUS_UNAVAILABLE_MESSAGE =
    'No se pudo verificar el estado de la cuenta. Intenta de nuevo.';

export function isUserDocSuspended(data) {
    return data?.[UserFields.suspended] === true;
}

function throwCoded(message, code) {
    const err = new Error(message);
    err.code = code;
    throw err;
}

function hasNonEmptyName(data) {
    if (!data) return false;
    for (const key of [UserFields.name, UserFields.displayName, UserFields.fullName]) {
        const v = data[key];
        if (typeof v === 'string' && v.trim()) return true;
    }
    return false;
}

/** @param {string} uid */
export async function isUserSuspended(uid) {
    if (!uid) return false;
    try {
        const snap = await getDoc(doc(db, Collections.USERS, uid));
        if (!snap.exists()) return false;
        return isUserDocSuspended(snap.data());
    } catch (e) {
        if (e?.code === ACCOUNT_SUSPENDED_CODE || e?.code === ACCOUNT_STATUS_UNAVAILABLE_CODE) {
            throw e;
        }
        throwCoded(ACCOUNT_STATUS_UNAVAILABLE_MESSAGE, ACCOUNT_STATUS_UNAVAILABLE_CODE);
    }
}

/**
 * Suscribe al doc de usuario; callback(true) si suspendida o si falla la lectura (fail-closed).
 * @param {string} uid
 * @param {(suspended: boolean) => void} onChange
 */
export function subscribeUserSuspended(uid, onChange) {
    if (!uid) {
        onChange(false);
        return () => {};
    }
    return onSnapshot(
        doc(db, Collections.USERS, uid),
        (snap) => {
            onChange(snap.exists() ? isUserDocSuspended(snap.data()) : false);
        },
        () => onChange(true),
    );
}

/**
 * Ensures users/{uid} exists / is refreshed on login (merge).
 * No modifica `suspended`. No pisa nombre si el perfil ya tiene uno (edición admin).
 */
export async function ensureUserDoc(user) {
    if (!user) return;
    const ref = doc(db, Collections.USERS, user.uid);
    const snap = await getDoc(ref);
    const fallbackName = user.displayName || user.email?.split('@')[0] || 'Usuario';
    const payload = {
        [UserFields.email]: user.email?.toLowerCase() ?? null,
        [UserFields.updatedAt]: serverTimestamp(),
    };
    if (!snap.exists() || !hasNonEmptyName(snap.data())) {
        payload[UserFields.displayName] = fallbackName;
        payload[UserFields.name] = fallbackName;
        payload[UserFields.fullName] = fallbackName;
    }
    if (!snap.exists()) {
        payload[UserFields.createdAt] = serverTimestamp();
    }
    await setDoc(ref, payload, { merge: true });
}

/**
 * Si la cuenta está suspendida o no se puede verificar, lanza error tipado.
 * @param {string} uid
 */
export async function assertUserNotSuspended(uid) {
    let suspended;
    try {
        suspended = await isUserSuspended(uid);
    } catch (e) {
        if (e?.code === ACCOUNT_STATUS_UNAVAILABLE_CODE) throw e;
        throwCoded(ACCOUNT_STATUS_UNAVAILABLE_MESSAGE, ACCOUNT_STATUS_UNAVAILABLE_CODE);
    }
    if (suspended) {
        throwCoded(ACCOUNT_SUSPENDED_MESSAGE, ACCOUNT_SUSPENDED_CODE);
    }
}

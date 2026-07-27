import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    GoogleAuthProvider,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
} from 'firebase/auth';
import { auth } from '@/shared/api/firebase';
import {
    ACCOUNT_SUSPENDED_CODE,
    ACCOUNT_STATUS_UNAVAILABLE_CODE,
    ACCOUNT_SUSPENDED_MESSAGE,
    assertUserNotSuspended,
    ensureUserDoc,
    subscribeUserSuspended,
} from '@/features/auth/repository/userRepository';
import { fetchUserMemberships, subscribeUserMemberships } from '@/features/memberships/repository/membershipRepository';
import {
    canManageMembership,
    entityMemberships,
    manageableMemberships,
    normalCommunityIds,
} from '@/shared/domain/permissions';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [memberships, setMemberships] = useState([]);
    const [authLoading, setAuthLoading] = useState(true);
    const [membershipsLoading, setMembershipsLoading] = useState(false);
    const [accountSuspended, setAccountSuspended] = useState(false);

    const logout = useCallback(async () => {
        await signOut(auth);
        setMemberships([]);
        setAccountSuspended(false);
    }, []);

    const rejectIfSuspended = useCallback(async (firebaseUser) => {
        if (!firebaseUser) return null;
        try {
            await assertUserNotSuspended(firebaseUser.uid);
            return firebaseUser;
        } catch (e) {
            await signOut(auth);
            throw e;
        }
    }, []);

    const reloadMemberships = useCallback(async (uid) => {
        const id = uid ?? user?.uid;
        if (!id) {
            setMemberships([]);
            return;
        }
        try {
            const data = await fetchUserMemberships(id);
            setMemberships(data);
        } catch (e) {
            console.error('[Auth] reloadMemberships', e);
        }
    }, [user?.uid]);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                setUser(null);
                setMemberships([]);
                setAccountSuspended(false);
                setAuthLoading(false);
                return;
            }
            try {
                await assertUserNotSuspended(firebaseUser.uid);
                setAccountSuspended(false);
                setUser(firebaseUser);
                try {
                    await ensureUserDoc(firebaseUser);
                } catch (e) {
                    console.warn('[Auth] ensureUserDoc', e);
                }
            } catch (e) {
                // Fail-closed: suspended OR status unavailable → no session.
                if (
                    e?.code === ACCOUNT_SUSPENDED_CODE
                    || e?.code === ACCOUNT_STATUS_UNAVAILABLE_CODE
                ) {
                    setAccountSuspended(e?.code === ACCOUNT_SUSPENDED_CODE);
                    setUser(null);
                    try {
                        await signOut(auth);
                    } catch {
                        /* ignore */
                    }
                } else {
                    console.warn('[Auth] session check', e);
                    setAccountSuspended(false);
                    setUser(null);
                    try {
                        await signOut(auth);
                    } catch {
                        /* ignore */
                    }
                }
            } finally {
                setAuthLoading(false);
            }
        });
        return unsub;
    }, []);

    useEffect(() => {
        if (!user?.uid) {
            setMemberships([]);
            setMembershipsLoading(false);
            return undefined;
        }
        setMembershipsLoading(true);
        const unsub = subscribeUserMemberships(user.uid, (data) => {
            setMemberships(data);
            setMembershipsLoading(false);
        });
        return unsub;
    }, [user?.uid]);

    useEffect(() => {
        if (!user?.uid) return undefined;
        const unsub = subscribeUserSuspended(user.uid, (suspended) => {
            if (!suspended) return;
            setAccountSuspended(true);
            logout();
        });
        return unsub;
    }, [user?.uid, logout]);

    const login = useCallback(async (email, password) => {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        return rejectIfSuspended(cred.user);
    }, [rejectIfSuspended]);

    const loginWithGoogle = useCallback(async () => {
        try {
            const cred = await signInWithPopup(auth, new GoogleAuthProvider());
            return rejectIfSuspended(cred.user);
        } catch (err) {
            if (err?.code === 'auth/popup-closed-by-user') {
                return null;
            }
            throw err;
        }
    }, [rejectIfSuspended]);

    const resetPassword = useCallback(async (email) => {
        await sendPasswordResetEmail(auth, email.trim());
    }, []);

    const reloadUser = useCallback(async () => {
        const current = auth.currentUser;
        if (!current) return null;
        await current.reload();
        setUser({ ...auth.currentUser });
        return auth.currentUser;
    }, []);

    const value = useMemo(() => {
        const normalIds = normalCommunityIds(memberships);
        const entities = entityMemberships(memberships);
        const manageable = manageableMemberships(memberships);
        const canSendMessages = manageable.length > 0;

        return {
            user,
            memberships,
            authLoading,
            membershipsLoading,
            loading: authLoading || membershipsLoading,
            accountSuspended,
            accountSuspendedMessage: ACCOUNT_SUSPENDED_MESSAGE,
            normalCommunityIds: normalIds,
            entityMemberships: entities,
            manageableMemberships: manageable,
            canSendMessages,
            login,
            loginWithGoogle,
            resetPassword,
            logout,
            reloadUser,
            reloadMemberships: () => reloadMemberships(user?.uid),
            getRole: (communityId) =>
                memberships.find((m) => m.communityId === communityId)?.role ?? null,
            canManage: (communityId) => {
                const m = memberships.find((x) => x.communityId === communityId);
                return m ? canManageMembership(m.community, m.role) : false;
            },
        };
    }, [
        user,
        memberships,
        authLoading,
        membershipsLoading,
        accountSuspended,
        login,
        loginWithGoogle,
        resetPassword,
        logout,
        reloadUser,
        reloadMemberships,
    ]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

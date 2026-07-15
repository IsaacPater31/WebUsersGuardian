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
import { ensureUserDoc } from '@/features/auth/repository/userRepository';
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
            setUser(firebaseUser);
            if (firebaseUser) {
                try {
                    await ensureUserDoc(firebaseUser);
                } catch (e) {
                    console.warn('[Auth] ensureUserDoc', e);
                }
            } else {
                setMemberships([]);
            }
            setAuthLoading(false);
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

    const login = useCallback(async (email, password) => {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        return cred.user;
    }, []);

    const loginWithGoogle = useCallback(async () => {
        try {
            const cred = await signInWithPopup(auth, new GoogleAuthProvider());
            return cred.user;
        } catch (err) {
            if (err?.code === 'auth/popup-closed-by-user') {
                return null;
            }
            throw err;
        }
    }, []);

    const resetPassword = useCallback(async (email) => {
        await sendPasswordResetEmail(auth, email.trim());
    }, []);

    const logout = useCallback(async () => {
        await signOut(auth);
        setMemberships([]);
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

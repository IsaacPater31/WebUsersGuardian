import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Collections } from '../config/collections';
import { UserFields } from '../config/firestoreFields';
import { fetchUserMemberships } from '../services/membershipService';
import {
    canManageMembership,
    entityMemberships,
    manageableMemberships,
    normalCommunityIds,
} from '../utils/permissions';

const AuthContext = createContext(null);

async function ensureUserDoc(user) {
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

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [memberships, setMemberships] = useState([]);
    const [authLoading, setAuthLoading] = useState(true);
    const [membershipsLoading, setMembershipsLoading] = useState(false);

    const reloadMemberships = useCallback(async (uid) => {
        if (!uid) {
            setMemberships([]);
            return;
        }
        setMembershipsLoading(true);
        try {
            const data = await fetchUserMemberships(uid);
            setMemberships(data);
        } catch (e) {
            console.error('[Auth] memberships', e);
            setMemberships([]);
        } finally {
            setMembershipsLoading(false);
        }
    }, []);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                try {
                    await ensureUserDoc(firebaseUser);
                } catch (e) {
                    console.warn('[Auth] ensureUserDoc', e);
                }
                await reloadMemberships(firebaseUser.uid);
            } else {
                setMemberships([]);
            }
            setAuthLoading(false);
        });
        return unsub;
    }, [reloadMemberships]);

    const login = useCallback(async (email, password) => {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        return cred.user;
    }, []);

    const logout = useCallback(async () => {
        await signOut(auth);
        setMemberships([]);
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
            logout,
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
        logout,
        reloadMemberships,
    ]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

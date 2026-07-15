/**
 * Invite link generation — same semantics as Guardian mobile.
 */
import { doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/shared/api/firebase';
import { Collections } from '@/shared/config/collections';
import { InviteFields } from '@/shared/config/firestoreFields';

const INVITE_BASE = 'guardian.app/join/';
const INVITE_HOURS = 12;

function generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

/**
 * @param {string} communityId
 * @returns {Promise<string>} Full invite URL
 */
export async function generateInviteLink(communityId) {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + INVITE_HOURS * 60 * 60 * 1000);
    await setDoc(doc(db, Collections.INVITES, token), {
        [InviteFields.communityId]: communityId,
        [InviteFields.expiresAt]: Timestamp.fromDate(expiresAt),
        created_at: serverTimestamp(),
    });
    return `${INVITE_BASE}${token}`;
}

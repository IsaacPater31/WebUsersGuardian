import { MemberFields } from '@/shared/config/firestoreFields';

/**
 * @param {import('firebase/firestore').DocumentSnapshot} docSnap
 * @param {object|null} community
 */
export function fromDoc(docSnap, community) {
    const d = docSnap.data() || {};
    return {
        id: docSnap.id,
        communityId: d[MemberFields.communityId] || d.community_id || community?.id || null,
        userId: d[MemberFields.userId] || d.user_id || null,
        role: d[MemberFields.role] || MemberFields.roleMember,
        joinedAt: d[MemberFields.joinedAt] || d.joined_at || null,
        community,
    };
}

import { MessageFields } from '@/shared/config/firestoreFields';

/**
 * Firestore community_messages doc → domain model.
 *
 * @param {import('firebase/firestore').DocumentSnapshot} docSnap
 */
export function fromDoc(docSnap) {
    const d = docSnap.data() || {};
    return {
        id: docSnap.id,
        communityIds: d[MessageFields.communityIds] || d.community_ids || [],
        senderId: d[MessageFields.senderId] || d.sender_id || null,
        senderName: d[MessageFields.senderName] || d.sender_name || null,
        title: d[MessageFields.title] || '',
        body: d[MessageFields.body] || '',
        createdAt: d[MessageFields.createdAt] || d.created_at || null,
    };
}

/** @deprecated Use fromDoc */
export const parseMessage = fromDoc;

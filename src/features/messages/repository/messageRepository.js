/**
 * MessageRepository — Firestore I/O for community_messages (+ member lookups for fan-out).
 */
import {
    addDoc,
    collection,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    where,
    writeBatch,
} from 'firebase/firestore';
import { db } from '@/shared/api/firebase';
import { Collections } from '@/shared/config/collections';
import { MemberFields, MessageFields } from '@/shared/config/firestoreFields';
import { InboxKinds, batchSetInboxDoc } from '@/shared/data/inbox/inboxNotifyRepository';
import { fromDoc as parseMessage } from '@/features/messages/mapper/messageMapper';

const messagesCol = () => collection(db, Collections.COMMUNITY_MESSAGES);

export async function getMemberUserIds(communityId) {
    const q = query(
        collection(db, Collections.COMMUNITY_MEMBERS),
        where(MemberFields.communityId, '==', communityId),
    );
    const snap = await getDocs(q);
    return snap.docs
        .map((d) => d.data()[MemberFields.userId] || d.data().user_id)
        .filter(Boolean);
}

/**
 * Persist canonical message + fan-out inbox docs.
 * Permission checks belong in MessageService (caller).
 */
export async function createMessageWithFanout({
    title,
    body,
    communityIds,
    senderId,
    senderName,
    communityNameById,
}) {
    const messageRef = await addDoc(messagesCol(), {
        [MessageFields.communityIds]: communityIds,
        [MessageFields.senderId]: senderId,
        [MessageFields.senderName]: senderName,
        [MessageFields.title]: title,
        [MessageFields.body]: body,
        [MessageFields.createdAt]: serverTimestamp(),
    });

    /** @type {Array<{ uid: string, communityId: string, communityName: string }>} */
    const fanout = [];
    for (const cid of communityIds) {
        const userIds = await getMemberUserIds(cid);
        const cname = communityNameById.get(cid) || 'Comunidad';
        for (const uid of userIds) {
            fanout.push({ uid, communityId: cid, communityName: cname });
        }
    }

    for (let i = 0; i < fanout.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = fanout.slice(i, i + 400);
        for (const entry of chunk) {
            const inboxDocId = `${messageRef.id}_${entry.communityId}`;
            batchSetInboxDoc(batch, entry.uid, inboxDocId, {
                kind: InboxKinds.communityMessage,
                message_id: messageRef.id,
                community_id: entry.communityId,
                community_name: entry.communityName,
                community_ids: [entry.communityId],
                title,
                body,
                sender_id: senderId,
                sender_name: senderName,
            });
        }
        await batch.commit();
    }

    return messageRef.id;
}

export function subscribeSentMessages(senderId, callback) {
    const q = query(
        messagesCol(),
        where(MessageFields.senderId, '==', senderId),
        orderBy(MessageFields.createdAt, 'desc'),
        limit(50),
    );
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(parseMessage));
    });
}

export async function getSentMessages(senderId) {
    const q = query(
        messagesCol(),
        where(MessageFields.senderId, '==', senderId),
        orderBy(MessageFields.createdAt, 'desc'),
        limit(50),
    );
    const snap = await getDocs(q);
    return snap.docs.map(parseMessage);
}

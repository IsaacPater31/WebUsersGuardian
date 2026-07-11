/**
 * Community broadcast messages — Firestore fan-out to member inboxes.
 * One inbox doc per (user, community) so multi-community recipients get
 * individual notifications. Android delivers via GuardianBackgroundService.
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
import { db } from '../firebase';
import { Collections } from '../config/collections';
import { MemberFields, MessageFields } from '../config/firestoreFields';
import { canSendMessages } from '../utils/permissions';
import { InboxKinds, batchSetInboxDoc } from './inboxNotifyService';

const messagesCol = () => collection(db, Collections.COMMUNITY_MESSAGES);

function parseMessage(docSnap) {
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

async function getMemberUserIds(communityId) {
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
 * @param {{ title: string, body: string, communityIds: string[], senderId: string, senderName: string, memberships: Array }} params
 */
export async function sendCommunityMessage({
    title,
    body,
    communityIds,
    senderId,
    senderName,
    memberships,
}) {
    const trimmedTitle = String(title || '').trim();
    const trimmedBody = String(body || '').trim();
    if (!trimmedTitle || !trimmedBody) {
        throw new Error('Título y mensaje son obligatorios');
    }
    if (!communityIds?.length) {
        throw new Error('Selecciona al menos una comunidad');
    }

    const communityNameById = new Map();
    for (const cid of communityIds) {
        const m = memberships.find((x) => x.communityId === cid);
        if (!m || !canSendMessages(m.community, m.role)) {
            throw new Error('No tienes permiso para enviar mensajes a una de las comunidades seleccionadas');
        }
        communityNameById.set(cid, (m.community?.name || 'Comunidad').trim() || 'Comunidad');
    }

    const messageRef = await addDoc(messagesCol(), {
        [MessageFields.communityIds]: communityIds,
        [MessageFields.senderId]: senderId,
        [MessageFields.senderName]: senderName,
        [MessageFields.title]: trimmedTitle,
        [MessageFields.body]: trimmedBody,
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
                title: trimmedTitle,
                body: trimmedBody,
                sender_id: senderId,
                sender_name: senderName,
            });
        }
        await batch.commit();
    }

    return messageRef.id;
}

/**
 * Sent history for the current user (canonical community_messages).
 */
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

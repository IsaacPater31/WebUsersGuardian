/**
 * Community broadcast messages — Firestore fan-out to member inboxes.
 * Android delivers notifications via GuardianBackgroundService (Firestore listener).
 */
import {
    addDoc,
    collection,
    doc,
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

    for (const cid of communityIds) {
        const m = memberships.find((x) => x.communityId === cid);
        if (!m || !canSendMessages(m.community, m.role)) {
            throw new Error('No tienes permiso para enviar mensajes a una de las comunidades seleccionadas');
        }
    }

    const messageRef = await addDoc(messagesCol(), {
        [MessageFields.communityIds]: communityIds,
        [MessageFields.senderId]: senderId,
        [MessageFields.senderName]: senderName,
        [MessageFields.title]: trimmedTitle,
        [MessageFields.body]: trimmedBody,
        [MessageFields.createdAt]: serverTimestamp(),
    });

    const recipientMap = new Map();
    for (const cid of communityIds) {
        const userIds = await getMemberUserIds(cid);
        for (const uid of userIds) {
            if (!recipientMap.has(uid)) recipientMap.set(uid, []);
            recipientMap.get(uid).push(cid);
        }
    }

    const entries = [...recipientMap.entries()];
    for (let i = 0; i < entries.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = entries.slice(i, i + 400);
        for (const [uid, cids] of chunk) {
            const inboxRef = doc(
                collection(db, Collections.USERS, uid, 'community_messages'),
                messageRef.id,
            );
            batch.set(inboxRef, {
                message_id: messageRef.id,
                community_ids: cids,
                title: trimmedTitle,
                body: trimmedBody,
                sender_id: senderId,
                sender_name: senderName,
                read: false,
                created_at: serverTimestamp(),
            });
        }
        await batch.commit();
    }

    return messageRef.id;
}

/**
 * Messages sent by the current user (admin/official history).
 */
export async function fetchSentMessages(senderId, max = 50) {
    const q = query(
        messagesCol(),
        where(MessageFields.senderId, '==', senderId),
        orderBy(MessageFields.createdAt, 'desc'),
        limit(max),
    );
    try {
        const snap = await getDocs(q);
        return snap.docs.map(parseMessage);
    } catch {
        const snap = await getDocs(query(messagesCol(), limit(200)));
        return snap.docs
            .map(parseMessage)
            .filter((m) => m.senderId === senderId)
            .sort((a, b) => {
                const ta = a.createdAt?.toMillis?.() ?? 0;
                const tb = b.createdAt?.toMillis?.() ?? 0;
                return tb - ta;
            })
            .slice(0, max);
    }
}

function sentMessagesQuery(senderId, max) {
    return query(
        messagesCol(),
        where(MessageFields.senderId, '==', senderId),
        orderBy(MessageFields.createdAt, 'desc'),
        limit(max),
    );
}

function parseSentMessagesSnapshot(snap, senderId, max) {
    return snap.docs
        .map(parseMessage)
        .filter((m) => m.senderId === senderId)
        .sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() ?? 0;
            const tb = b.createdAt?.toMillis?.() ?? 0;
            return tb - ta;
        })
        .slice(0, max);
}

/**
 * Real-time subscription to messages sent by the current user.
 * @param {string} senderId
 * @param {(messages: ReturnType<typeof parseMessage>[]) => void} callback
 * @param {number} [max=50]
 * @returns {() => void}
 */
export function subscribeSentMessages(senderId, callback, max = 50) {
    if (!senderId) {
        callback([]);
        return () => {};
    }

    let unsubFallback = () => {};
    let fallbackAttached = false;

    const unsubPrimary = onSnapshot(
        sentMessagesQuery(senderId, max),
        (snap) => callback(snap.docs.map(parseMessage)),
        () => {
            if (fallbackAttached) return;
            fallbackAttached = true;
            unsubFallback = onSnapshot(
                query(messagesCol(), limit(200)),
                (snap) => callback(parseSentMessagesSnapshot(snap, senderId, max)),
                (err) => {
                    console.error('[messageService] subscribeSentMessages', err);
                    callback([]);
                },
            );
        },
    );

    return () => {
        unsubPrimary();
        unsubFallback();
    };
}

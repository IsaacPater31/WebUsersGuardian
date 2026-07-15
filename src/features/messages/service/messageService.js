/**
 * MessageService — permission rules + orchestration for community broadcasts.
 * Persistence lives in messageRepository; parsing in messageMapper.
 */
import { canSendMessages } from '@/shared/domain/permissions';
import {
    createMessageWithFanout,
    subscribeSentMessages as repoSubscribeSentMessages,
    getSentMessages as repoGetSentMessages,
} from '@/features/messages/repository/messageRepository';

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

    return createMessageWithFanout({
        title: trimmedTitle,
        body: trimmedBody,
        communityIds,
        senderId,
        senderName,
        communityNameById,
    });
}

export function subscribeSentMessages(senderId, callback) {
    return repoSubscribeSentMessages(senderId, callback);
}

export async function getSentMessages(senderId) {
    return repoGetSentMessages(senderId);
}

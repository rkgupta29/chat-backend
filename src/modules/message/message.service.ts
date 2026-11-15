import { z } from 'zod';
import { AppError } from '../../utils/app-error';
import { chatService } from '../chat/chat.service';
import { messageRepository, type MessagePosition } from './message.repository';

const cursorSchema = z.object({
  s: z.number().int(),
  n: z.number().int().min(0).max(999_999_999),
  id: z.string().min(1).max(128),
});

const encodeCursor = (p: MessagePosition) =>
  Buffer.from(JSON.stringify({ s: p.seconds, n: p.nanoseconds, id: p.id })).toString('base64url');

function decodeCursor(raw: string): MessagePosition {
  try {
    const { s, n, id } = cursorSchema.parse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
    return { seconds: s, nanoseconds: n, id };
  } catch {
    throw AppError.badRequest('Invalid cursor', 'INVALID_CURSOR');
  }
}

async function requireMessage(chatId: string, messageId: string) {
  const message = await messageRepository.findById(chatId, messageId);
  if (!message) throw AppError.notFound('Message not found', 'MESSAGE_NOT_FOUND');
  return message;
}

export const messageService = {
  async send(chatId: string, senderId: string, text: string) {
    await chatService.assertMember(chatId, senderId);
    const message = await messageRepository.create(chatId, senderId, text);
    // The message is already stored; a failed bump only affects chat ordering.
    await chatService.touch(chatId).catch((err) => console.error('Failed to touch chat', err));
    return message;
  },

  async list(chatId: string, userId: string, limit: number, rawCursor?: string) {
    await chatService.assertMember(chatId, userId);
    const cursor = rawCursor ? decodeCursor(rawCursor) : undefined;
    const { messages, nextCursor } = await messageRepository.findPage(chatId, limit, cursor);
    return { messages, nextCursor: nextCursor ? encodeCursor(nextCursor) : null };
  },

  async markRead(chatId: string, messageId: string, userId: string) {
    await chatService.assertMember(chatId, userId);
    const message = await requireMessage(chatId, messageId);
    if (message.senderId === userId) {
      throw AppError.badRequest('Cannot mark your own message as read', 'CANNOT_READ_OWN_MESSAGE');
    }
    return messageRepository.createReadReceipt(chatId, messageId, userId);
  },

  async updateLastSeen(chatId: string, userId: string, messageId: string) {
    await chatService.assertMember(chatId, userId);
    const result = await messageRepository.advanceLastSeen(chatId, userId, messageId);
    if (!result) throw AppError.notFound('Message not found', 'MESSAGE_NOT_FOUND');
    return result;
  },
};

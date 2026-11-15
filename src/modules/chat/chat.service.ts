import { Prisma } from '@prisma/client';
import { AppError } from '../../utils/app-error';
import { userRepository } from '../user/user.repository';
import { chatRepository } from './chat.repository';

export function buildPairKey(a: string, b: string): string {
  const [first, second] = [a.toLowerCase(), b.toLowerCase()].sort();
  return `${first}:${second}`;
}

export const chatService = {
  async createOrGet(userAId: string, userBId: string): Promise<{ chatId: string; created: boolean }> {
    if (userAId.toLowerCase() === userBId.toLowerCase()) {
      throw AppError.badRequest('Cannot create a chat with yourself', 'SELF_CHAT');
    }

    const existingUsers = await userRepository.countByIds([userAId, userBId]);
    if (existingUsers !== 2) throw AppError.notFound('One or both users not found', 'USER_NOT_FOUND');

    const pairKey = buildPairKey(userAId, userBId);

    const existing = await chatRepository.findByPairKey(pairKey);
    if (existing) return { chatId: existing.id, created: false };

    try {
      const chat = await chatRepository.createWithMembers(pairKey, [userAId, userBId]);
      return { chatId: chat.id, created: true };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // A concurrent request created the chat first.
        if (err.code === 'P2002') {
          const winner = await chatRepository.findByPairKey(pairKey);
          if (winner) return { chatId: winner.id, created: false };
        }
        if (err.code === 'P2003') throw AppError.notFound('One or both users not found', 'USER_NOT_FOUND');
      }
      throw err;
    }
  },

  async assertMember(chatId: string, userId: string): Promise<void> {
    const chat = await chatRepository.findById(chatId);
    if (!chat) throw AppError.notFound('Chat not found', 'CHAT_NOT_FOUND');
    if (!(await chatRepository.isMember(chatId, userId))) {
      throw AppError.forbidden('User is not a member of this chat', 'NOT_A_MEMBER');
    }
  },

  touch: chatRepository.touch,
};

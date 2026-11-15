import { prisma } from '../../config/database';

export const chatRepository = {
  findByPairKey(pairKey: string) {
    return prisma.chat.findUnique({ where: { pairKey }, select: { id: true } });
  },

  createWithMembers(pairKey: string, userIds: [string, string]) {
    return prisma.chat.create({
      data: {
        pairKey,
        members: { create: userIds.map((userId) => ({ userId })) },
      },
      select: { id: true },
    });
  },

  findById(id: string) {
    return prisma.chat.findUnique({ where: { id }, select: { id: true } });
  },

  async isMember(chatId: string, userId: string) {
    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
      select: { id: true },
    });
    return membership !== null;
  },

  async touch(chatId: string) {
    await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
  },
};

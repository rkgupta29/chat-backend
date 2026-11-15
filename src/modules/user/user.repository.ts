import { prisma } from '../../config/database';

export const userRepository = {
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  async countByIds(ids: string[]) {
    return prisma.user.count({ where: { id: { in: ids } } });
  },

  async findChats(userId: string) {
    return prisma.chat.findMany({
      where: { members: { some: { userId } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        members: { select: { userId: true }, orderBy: { joinedAt: 'asc' } },
      },
    });
  },
};

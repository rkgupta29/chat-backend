import { AppError } from '../../utils/app-error';
import { userRepository } from './user.repository';

export const userService = {
  async listChats(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.notFound('User not found', 'USER_NOT_FOUND');

    const chats = await userRepository.findChats(userId);
    return chats.map((chat) => ({
      chatId: chat.id,
      memberIds: chat.members.map((m) => m.userId),
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    }));
  },
};

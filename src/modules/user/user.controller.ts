import type { Request, Response } from 'express';
import type { ListUserChatsParams } from './user.schema';
import { userService } from './user.service';

export const userController = {
  async listChats(req: Request, res: Response) {
    const { userId } = req.validated.params as ListUserChatsParams;
    const chats = await userService.listChats(userId);
    res.status(200).json({ chats });
  },
};

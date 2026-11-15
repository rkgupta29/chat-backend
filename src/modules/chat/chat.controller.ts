import type { Request, Response } from 'express';
import type { CreateChatBody } from './chat.schema';
import { chatService } from './chat.service';

export const chatController = {
  async createOrGet(req: Request, res: Response) {
    const { userAId, userBId } = req.validated.body as CreateChatBody;
    const { chatId, created } = await chatService.createOrGet(userAId, userBId);
    res.status(created ? 201 : 200).json({ chatId });
  },
};

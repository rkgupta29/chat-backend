import type { Request, Response } from 'express';
import type {
  GetMessagesParams,
  GetMessagesQuery,
  LastSeenBody,
  LastSeenParams,
  MarkReadBody,
  MarkReadParams,
  SendMessageBody,
  SendMessageParams,
} from './message.schema';
import { messageService } from './message.service';

export const messageController = {
  async send(req: Request, res: Response) {
    const { chatId } = req.validated.params as SendMessageParams;
    const { senderId, text } = req.validated.body as SendMessageBody;
    const message = await messageService.send(chatId, senderId, text);
    res.status(201).json({ message });
  },

  async list(req: Request, res: Response) {
    const { chatId } = req.validated.params as GetMessagesParams;
    const { userId, limit, cursor } = req.validated.query as GetMessagesQuery;
    res.status(200).json(await messageService.list(chatId, userId, limit, cursor));
  },

  async markRead(req: Request, res: Response) {
    const { chatId, messageId } = req.validated.params as MarkReadParams;
    const { userId } = req.validated.body as MarkReadBody;
    const { receipt, created } = await messageService.markRead(chatId, messageId, userId);
    res.status(created ? 201 : 200).json({ receipt });
  },

  async updateLastSeen(req: Request, res: Response) {
    const { chatId } = req.validated.params as LastSeenParams;
    const { userId, messageId } = req.validated.body as LastSeenBody;
    const { lastSeen, updated } = await messageService.updateLastSeen(chatId, userId, messageId);
    res.status(200).json({ lastSeen, updated });
  },
};

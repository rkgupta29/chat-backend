import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import { messageController } from './message.controller';
import { getMessagesSchema, lastSeenSchema, markReadSchema, sendMessageSchema } from './message.schema';

export const messageRoutes = Router();

messageRoutes.post('/chat/:chatId/message/send', validate(sendMessageSchema), asyncHandler(messageController.send));
messageRoutes.get('/chat/:chatId/messages', validate(getMessagesSchema), asyncHandler(messageController.list));
messageRoutes.post(
  '/chat/:chatId/message/:messageId/read',
  validate(markReadSchema),
  asyncHandler(messageController.markRead),
);
messageRoutes.post('/chat/:chatId/lastseen', validate(lastSeenSchema), asyncHandler(messageController.updateLastSeen));

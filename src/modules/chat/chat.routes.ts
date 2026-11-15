import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import { chatController } from './chat.controller';
import { createChatSchema } from './chat.schema';

export const chatRoutes = Router();

chatRoutes.post('/chat/create', validate(createChatSchema), asyncHandler(chatController.createOrGet));

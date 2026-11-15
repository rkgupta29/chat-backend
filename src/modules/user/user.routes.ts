import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import { userController } from './user.controller';
import { listUserChatsSchema } from './user.schema';

export const userRoutes = Router();

userRoutes.get(
  '/user/:userId/chats',
  validate(listUserChatsSchema),
  asyncHandler(userController.listChats),
);

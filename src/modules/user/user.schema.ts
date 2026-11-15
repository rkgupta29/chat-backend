import { z } from 'zod';

export const listUserChatsSchema = {
  params: z.object({ userId: z.uuid() }),
};
export type ListUserChatsParams = z.infer<typeof listUserChatsSchema.params>;

import { z } from 'zod';

export const createChatSchema = {
  body: z.object({ userAId: z.uuid(), userBId: z.uuid() }),
};
export type CreateChatBody = z.infer<typeof createChatSchema.body>;

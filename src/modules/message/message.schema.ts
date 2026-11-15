import { z } from 'zod';

export const MAX_MESSAGE_LENGTH = 4000;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

const firestoreId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, 'Invalid message id');

export const sendMessageSchema = {
  params: z.object({ chatId: z.uuid() }),
  body: z.object({
    senderId: z.uuid(),
    text: z
      .string()
      .trim()
      .min(1, 'Message text must not be empty')
      .max(MAX_MESSAGE_LENGTH, `Message text must be at most ${MAX_MESSAGE_LENGTH} characters`),
  }),
};
export type SendMessageParams = z.infer<typeof sendMessageSchema.params>;
export type SendMessageBody = z.infer<typeof sendMessageSchema.body>;

export const getMessagesSchema = {
  params: z.object({ chatId: z.uuid() }),
  query: z.object({
    userId: z.uuid(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .default(DEFAULT_PAGE_SIZE)
      .transform((n) => Math.min(n, MAX_PAGE_SIZE)),
    cursor: z.string().min(1).max(512).optional(),
  }),
};
export type GetMessagesParams = z.infer<typeof getMessagesSchema.params>;
export type GetMessagesQuery = z.infer<typeof getMessagesSchema.query>;

export const markReadSchema = {
  params: z.object({ chatId: z.uuid(), messageId: firestoreId }),
  body: z.object({ userId: z.uuid() }),
};
export type MarkReadParams = z.infer<typeof markReadSchema.params>;
export type MarkReadBody = z.infer<typeof markReadSchema.body>;

export const lastSeenSchema = {
  params: z.object({ chatId: z.uuid() }),
  body: z.object({ userId: z.uuid(), messageId: firestoreId }),
};
export type LastSeenParams = z.infer<typeof lastSeenSchema.params>;
export type LastSeenBody = z.infer<typeof lastSeenSchema.body>;

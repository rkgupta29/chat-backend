const uuid = { type: 'string', format: 'uuid' } as const;
const chatIdParam = { name: 'chatId', in: 'path', required: true, schema: uuid } as const;
const messageIdParam = { name: 'messageId', in: 'path', required: true, schema: { type: 'string' } } as const;

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});
const jsonBody = (schema: object) => ({ required: true, content: { 'application/json': { schema } } });
const jsonOk = (description: string, schema: object) => ({
  description,
  content: { 'application/json': { schema } },
});

const commonErrors = {
  '400': errorResponse('Validation error'),
  '500': errorResponse('Internal server error'),
};
const accessErrors = {
  '403': errorResponse('User is not a member of the chat'),
  '404': errorResponse('Chat (or referenced resource) not found'),
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Chat Backend API',
    version: '1.0.0',
    description:
      '1:1 chat API. **There is no authentication**: user IDs are supplied by the caller and trusted as-is. ' +
      'In production, derive the user identity from authenticated credentials, never from request-body IDs.',
  },
  paths: {
    '/chat/create': {
      post: {
        summary: 'Create or get the 1:1 chat between two users',
        requestBody: jsonBody({
          type: 'object',
          required: ['userAId', 'userBId'],
          properties: { userAId: uuid, userBId: uuid },
        }),
        responses: {
          '200': jsonOk('Existing chat returned', { $ref: '#/components/schemas/ChatId' }),
          '201': jsonOk('Chat created', { $ref: '#/components/schemas/ChatId' }),
          ...commonErrors,
          '404': errorResponse('A user does not exist'),
        },
      },
    },
    '/chat/{chatId}/message/send': {
      post: {
        summary: 'Send a message',
        parameters: [chatIdParam],
        requestBody: jsonBody({
          type: 'object',
          required: ['senderId', 'text'],
          properties: { senderId: uuid, text: { type: 'string', minLength: 1, maxLength: 4000 } },
        }),
        responses: {
          '201': jsonOk('Message created', {
            type: 'object',
            properties: { message: { $ref: '#/components/schemas/Message' } },
          }),
          ...commonErrors,
          ...accessErrors,
        },
      },
    },
    '/chat/{chatId}/messages': {
      get: {
        summary: 'List messages (cursor pagination, newest page first, chronological within a page)',
        parameters: [
          chatIdParam,
          { name: 'userId', in: 'query', required: true, schema: uuid },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
          {
            name: 'cursor',
            in: 'query',
            description: 'nextCursor from the previous response; fetches older messages',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': jsonOk('Messages', {
            type: 'object',
            properties: {
              messages: { type: 'array', items: { $ref: '#/components/schemas/Message' } },
              nextCursor: { type: 'string', nullable: true },
            },
          }),
          ...commonErrors,
          ...accessErrors,
        },
      },
    },
    '/chat/{chatId}/message/{messageId}/read': {
      post: {
        summary: 'Mark a message as read (idempotent)',
        parameters: [chatIdParam, messageIdParam],
        requestBody: jsonBody({ type: 'object', required: ['userId'], properties: { userId: uuid } }),
        responses: {
          '200': jsonOk('Receipt already existed', { $ref: '#/components/schemas/ReadReceiptResponse' }),
          '201': jsonOk('Receipt created', { $ref: '#/components/schemas/ReadReceiptResponse' }),
          ...commonErrors,
          ...accessErrors,
          '404': errorResponse('Chat or message not found'),
        },
      },
    },
    '/chat/{chatId}/lastseen': {
      post: {
        summary: 'Update last seen message (never moves backwards)',
        parameters: [chatIdParam],
        requestBody: jsonBody({
          type: 'object',
          required: ['userId', 'messageId'],
          properties: { userId: uuid, messageId: { type: 'string' } },
        }),
        responses: {
          '200': jsonOk('Current last-seen state; `updated` is false if the request would have moved it backwards', {
            type: 'object',
            properties: {
              lastSeen: {
                type: 'object',
                properties: { userId: uuid, messageId: { type: 'string' }, timestamp: { type: 'string', format: 'date-time' } },
              },
              updated: { type: 'boolean' },
            },
          }),
          ...commonErrors,
          ...accessErrors,
          '404': errorResponse('Chat or message not found'),
        },
      },
    },
    '/user/{userId}/chats': {
      get: {
        summary: "List a user's chats, most recently updated first",
        parameters: [{ name: 'userId', in: 'path', required: true, schema: uuid }],
        responses: {
          '200': jsonOk('Chats', {
            type: 'object',
            properties: {
              chats: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    chatId: uuid,
                    memberIds: { type: 'array', items: uuid },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          }),
          ...commonErrors,
          '404': errorResponse('User not found'),
        },
      },
    },
  },
  components: {
    schemas: {
      ChatId: { type: 'object', properties: { chatId: uuid } },
      Message: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          chatId: uuid,
          senderId: uuid,
          text: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          editedAt: { type: 'string', format: 'date-time', nullable: true },
          deletedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      ReadReceiptResponse: {
        type: 'object',
        properties: {
          receipt: {
            type: 'object',
            properties: { messageId: { type: 'string' }, userId: uuid, readAt: { type: 'string', format: 'date-time' } },
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} },
          },
        },
      },
    },
  },
};

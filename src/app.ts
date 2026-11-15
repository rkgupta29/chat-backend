import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { prisma } from './config/database';
import { openApiSpec } from './docs/openapi';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { chatRoutes } from './modules/chat/chat.routes';
import { messageRoutes } from './modules/message/message.routes';
import { userRoutes } from './modules/user/user.routes';
import { asyncHandler } from './utils/async-handler';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '32kb' }));

  app.get(
    '/health',
    asyncHandler(async (_req, res) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ status: 'ok' });
      } catch {
        res.status(503).json({ status: 'unavailable' });
      }
    }),
  );
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use(chatRoutes);
  app.use(messageRoutes);
  app.use(userRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();

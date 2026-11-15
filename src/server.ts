import { app } from './app';
import { prisma } from './config/database';
import { env } from './config/env';
import { getFirestore } from './config/firebase';

getFirestore();

const server = app.listen(env.PORT, () => {
  console.log(`Chat API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

const shutdown = () => {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

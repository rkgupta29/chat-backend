import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    FIREBASE_SERVICE_ACCOUNT_PATH: z.string().min(1).optional(),
    FIRESTORE_EMULATOR_HOST: z.string().min(1).optional(),
  })
  .refine((e) => e.FIRESTORE_EMULATOR_HOST || e.FIREBASE_SERVICE_ACCOUNT_PATH, {
    message: 'FIREBASE_SERVICE_ACCOUNT_PATH is required (unless FIRESTORE_EMULATOR_HOST is set)',
    path: ['FIREBASE_SERVICE_ACCOUNT_PATH'],
  });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

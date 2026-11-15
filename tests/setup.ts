import 'dotenv/config';

const testDb = process.env.TEST_DATABASE_URL;
if (!testDb) {
  throw new Error('TEST_DATABASE_URL must be set (a database whose tables may be truncated).');
}
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST must be set; run tests via `npm test` (Firestore emulator).');
}
process.env.DATABASE_URL = testDb;
process.env.NODE_ENV = 'test';

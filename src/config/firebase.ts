import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { env } from './env';

let firestore: Firestore | undefined;

export function getFirestore(): Firestore {
  if (firestore) return firestore;

  if (getApps().length === 0) {
    if (env.FIRESTORE_EMULATOR_HOST) {
      initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-chat' });
    } else {
      const serviceAccount = JSON.parse(
        readFileSync(env.FIREBASE_SERVICE_ACCOUNT_PATH as string, 'utf8'),
      );
      initializeApp({ credential: cert(serviceAccount) });
    }
  }

  firestore = getAdminFirestore();
  return firestore;
}

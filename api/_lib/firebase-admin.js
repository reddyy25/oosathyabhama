// Firebase Admin (server only). Uses a service-account key stored in an environment variable.
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { httpError } from './errors.js';

export function loadServiceAccount(env = process.env) {
  try {
    const json = env.FIREBASE_SERVICE_ACCOUNT_B64
      ? Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_B64.trim(), 'base64').toString('utf8')
      : env.FIREBASE_SERVICE_ACCOUNT;
    const sa = JSON.parse(json);
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    return sa;
  } catch {
    throw httpError(500, 'The Firebase service account in the server settings is not valid. Run "npm run add-service-account" again.');
  }
}

export function getAdmin(env = process.env) {
  if (!getApps().length) initializeApp({ credential: cert(loadServiceAccount(env)) });
  return { db: getFirestore(), FieldValue };
}

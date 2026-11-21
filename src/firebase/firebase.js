import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);
const app = initializeApp(firebaseConfigured ? config : { apiKey:'demo-placeholder', authDomain:'demo-placeholder.firebaseapp.com', projectId:'demo-placeholder', storageBucket:'demo-placeholder.appspot.com', appId:'demo-placeholder' });
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Fail fast (instead of spinning forever) if Storage is not set up or rules are not deployed.
storage.maxUploadRetryTime = 20000;
storage.maxOperationRetryTime = 20000;

// Analytics is optional and only starts in browsers that support it.
if (firebaseConfigured && config.measurementId) isSupported().then(ok => { if (ok) getAnalytics(app); }).catch(() => {});

// Accounts allowed into /admin without needing a custom claim (must match firestore.rules and storage.rules).
export const ADMIN_UIDS = ['Id3JlGikX3eMBz7lhjbeippEkPq1'];
export const isAdminUser = (user, claims) => Boolean(user) && (claims?.admin === true || ADMIN_UIDS.includes(user.uid));

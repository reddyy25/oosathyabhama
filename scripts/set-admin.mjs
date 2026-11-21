// Create the user first in Firebase Authentication, then run with that user's UID.
import {initializeApp,applicationDefault} from 'firebase-admin/app';import {getAuth} from 'firebase-admin/auth';
const uid=process.argv[2]||'Id3JlGikX3eMBz7lhjbeippEkPq1';const projectId=process.env.GCLOUD_PROJECT||process.env.FIREBASE_PROJECT_ID||'oosatyabhama-895e9';
if(!uid||!projectId)throw new Error('Usage: GCLOUD_PROJECT=your-project node scripts/set-admin.mjs FIREBASE_AUTH_UID');
initializeApp({credential:applicationDefault(),projectId});await getAuth().setCustomUserClaims(uid,{admin:true});console.log(`Admin claim assigned to UID ${uid}. Sign out and sign in again to refresh the token.`);

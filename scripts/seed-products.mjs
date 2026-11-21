// Run after `gcloud auth application-default login` with the target project selected.
import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {readFile} from 'node:fs/promises';
const projectId=process.env.GCLOUD_PROJECT||process.env.FIREBASE_PROJECT_ID||'oosatyabhama-895e9';
if(!projectId)throw new Error('Set GCLOUD_PROJECT to your Firebase project ID.');
initializeApp({credential:applicationDefault(),projectId});const db=getFirestore();
const products=JSON.parse(await readFile(new URL('../sample-products.json',import.meta.url),'utf8'));
for(const p of products){const {id,...data}=p;await db.doc(`products/${id}`).set({...data,createdAt:new Date(),updatedAt:new Date()},{merge:true});}
await db.doc('settings/store').set({storeName:'Oosatyabhama',contactNumber:'',whatsappNumber:'',storeEmail:'',shippingCharges:0,freeShippingThreshold:0},{merge:true});
console.log(`Seeded ${products.length} sample products and store settings.`);

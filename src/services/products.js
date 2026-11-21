import { collection, getDocs, getDoc, doc, query, where, orderBy, limit, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase';
export async function getProducts({category,flag,includeInactive=false}={}) {
  // Firestore rules are not filters: public queries must explicitly ask for active products only.
  const constraints=includeInactive?[]:[where('active','==',true)]; if(category && category!=='All') constraints.push(where('category','==',category)); if(flag==='new') constraints.push(where('isNewArrival','==',true)); if(flag==='best') constraints.push(where('isBestSeller','==',true));
  const snap=await getDocs(query(collection(db,'products'),...constraints)); return snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>includeInactive||p.active!==false);
}
export async function getProduct(id){const s=await getDoc(doc(db,'products',id));return s.exists()?{id:s.id,...s.data()}:null;}
export async function saveProduct(id,data){const ref=doc(db,'products',id);const exists=(await getDoc(ref)).exists();return setDoc(ref,{...data,...(exists?{}:{createdAt:serverTimestamp()}),updatedAt:serverTimestamp()},{merge:true});}
export const removeProduct=id=>deleteDoc(doc(db,'products',id));

export async function getStoreSettings(){const s=await getDoc(doc(db,'settings','store'));return s.exists()?s.data():{shippingCharges:0,freeShippingThreshold:0};}

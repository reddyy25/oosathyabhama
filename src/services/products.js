import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

const productCache = new Map();
const listCache = new Map();

export async function getProducts({ category, flag, includeInactive = false } = {}) {
  const cacheKey = `${category || 'All'}|${flag || 'none'}|${includeInactive}`;
  if (listCache.has(cacheKey)) {
    return listCache.get(cacheKey);
  }

  // Firestore rules are not filters: public queries must explicitly ask for active products only.
  const constraints = includeInactive ? [] : [where('active', '==', true)];
  if (category && category !== 'All') constraints.push(where('category', '==', category));
  if (flag === 'new') constraints.push(where('isNewArrival', '==', true));
  if (flag === 'best') constraints.push(where('isBestSeller', '==', true));

  const snap = await getDocs(query(collection(db, 'products'), ...constraints));
  const items = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => includeInactive || p.active !== false);

  items.forEach((p) => productCache.set(p.id, p));
  listCache.set(cacheKey, items);
  return items;
}

export async function getProduct(id) {
  if (!id) return null;
  if (productCache.has(id)) {
    return productCache.get(id);
  }

  const s = await getDoc(doc(db, 'products', id));
  const item = s.exists() ? { id: s.id, ...s.data() } : null;
  if (item) productCache.set(id, item);
  return item;
}

export async function saveProduct(id, data) {
  productCache.delete(id);
  listCache.clear();
  const ref = doc(db, 'products', id);
  const exists = (await getDoc(ref)).exists();
  return setDoc(
    ref,
    { ...data, ...(exists ? {} : { createdAt: serverTimestamp() }), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export const removeProduct = (id) => {
  productCache.delete(id);
  listCache.clear();
  return deleteDoc(doc(db, 'products', id));
};

export async function getStoreSettings() {
  const s = await getDoc(doc(db, 'settings', 'store'));
  return s.exists() ? s.data() : { shippingCharges: 0, freeShippingThreshold: 0 };
}

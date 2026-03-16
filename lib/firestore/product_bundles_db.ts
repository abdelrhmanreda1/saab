import { db } from '../firebase';
import { collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { ProductBundle } from './product_bundles';

const productBundlesCollection = collection(db, 'product_bundles');

export const createProductBundle = async (bundle: Omit<ProductBundle, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newBundle: Omit<ProductBundle, 'id'> = {
    ...bundle,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const docRef = await addDoc(productBundlesCollection, newBundle);
  return docRef.id;
};

export const getProductBundle = async (id: string): Promise<ProductBundle | null> => {
  const docRef = doc(db, 'product_bundles', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as ProductBundle;
  }
  return null;
};

export const getAllProductBundles = async (activeOnly?: boolean): Promise<ProductBundle[]> => {
  let q;
  if (activeOnly) {
    q = query(productBundlesCollection, where('isActive', '==', true), orderBy('createdAt', 'desc'));
  } else {
    q = query(productBundlesCollection, orderBy('createdAt', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductBundle));
};

export const getBundlesByProduct = async (productId: string): Promise<ProductBundle[]> => {
  // Note: Firestore doesn't support array-contains-any for nested fields easily
  // This would need a different data structure or client-side filtering
  const allBundles = await getAllProductBundles(true);
  return allBundles.filter(bundle => 
    bundle.products.some(p => p.productId === productId)
  );
};

export const updateProductBundle = async (id: string, updates: Partial<Omit<ProductBundle, 'id' | 'createdAt'>>): Promise<void> => {
  const docRef = doc(db, 'product_bundles', id);
  await updateDoc(docRef, { ...updates, updatedAt: Timestamp.now() });
};

export const deleteProductBundle = async (id: string): Promise<void> => {
  const docRef = doc(db, 'product_bundles', id);
  await deleteDoc(docRef);
};


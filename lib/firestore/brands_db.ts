import { db } from '../firebase';
import { collection, addDoc, getDoc, updateDoc, deleteDoc, doc, query, getDocs } from 'firebase/firestore';
import { Brand } from './brands';

const brandsCollectionRef = collection(db, 'brands');

export const addBrand = async (brand: Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newBrandRef = await addDoc(brandsCollectionRef, {
    ...brand,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newBrandRef.id;
};

export const getBrand = async (id: string): Promise<Brand | null> => {
  const brandDocRef = doc(db, 'brands', id);
  const brandDoc = await getDoc(brandDocRef);
  if (brandDoc.exists()) {
    return { id: brandDoc.id, ...brandDoc.data() } as Brand;
  }
  return null;
};

export const getAllBrands = async (): Promise<Brand[]> => {
  const q = query(brandsCollectionRef);
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand));
};

export const updateBrand = async (id: string, brand: Partial<Omit<Brand, 'id' | 'createdAt'>>): Promise<void> => {
  const brandDocRef = doc(db, 'brands', id);
  await updateDoc(brandDocRef, {
    ...brand,
    updatedAt: new Date(),
  });
};

export const deleteBrand = async (id: string): Promise<void> => {
  const brandDocRef = doc(db, 'brands', id);
  await deleteDoc(brandDocRef);
};

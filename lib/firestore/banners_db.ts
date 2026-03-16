import { db } from '../firebase';
import { collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { Banner } from './banners';

const bannersCollection = collection(db, 'banners');

export const addBanner = async (banner: Omit<Banner, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newBanner = {
    ...banner,
    deviceType: banner.deviceType || 'both',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const docRef = await addDoc(bannersCollection, newBanner);
  return docRef.id;
};

export const getBanner = async (id: string): Promise<Banner | null> => {
  const docRef = doc(db, 'banners', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Banner;
  }
  return null;
};

export const getAllBanners = async (): Promise<Banner[]> => {
  const q = query(bannersCollection, orderBy('order', 'asc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return { 
      id: doc.id, 
      ...data,
      deviceType: data.deviceType || 'both' // Default to 'both' for existing banners
    } as Banner;
  });
};

export const updateBanner = async (id: string, updates: Partial<Omit<Banner, 'id' | 'createdAt'>>): Promise<void> => {
  const docRef = doc(db, 'banners', id);
  await updateDoc(docRef, { ...updates, updatedAt: new Date() });
};

export const deleteBanner = async (id: string): Promise<void> => {
  const docRef = doc(db, 'banners', id);
  await deleteDoc(docRef);
};

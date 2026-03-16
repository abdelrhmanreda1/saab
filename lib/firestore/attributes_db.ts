import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Size, Color } from './attributes';

// --- Sizes ---
const SIZES_COLLECTION = 'sizes';

export const getSizes = async (): Promise<Size[]> => {
  try {
    const q = query(collection(db, SIZES_COLLECTION), orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Size));
  } catch {
    // Failed to fetch sizes
    return [];
  }
};

export const addSize = async (size: Size) => {
  try {
    await addDoc(collection(db, SIZES_COLLECTION), {
      ...size,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    // Failed to add size
    throw error;
  }
};

export const updateSize = async (id: string, size: Partial<Size>) => {
  try {
    const docRef = doc(db, SIZES_COLLECTION, id);
    await updateDoc(docRef, size);
  } catch (error) {
    // Failed to update size
    throw error;
  }
};

export const deleteSize = async (id: string) => {
  try {
    await deleteDoc(doc(db, SIZES_COLLECTION, id));
  } catch (error) {
    // Failed to delete size
    throw error;
  }
};

// --- Colors ---
const COLORS_COLLECTION = 'colors';

export const getColors = async (): Promise<Color[]> => {
  try {
    const q = query(collection(db, COLORS_COLLECTION), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Color));
  } catch {
    // Failed to fetch colors
    return [];
  }
};

export const addColor = async (color: Color) => {
  try {
    await addDoc(collection(db, COLORS_COLLECTION), {
      ...color,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    // Failed to add color
    throw error;
  }
};

export const updateColor = async (id: string, color: Partial<Color>) => {
  try {
    const docRef = doc(db, COLORS_COLLECTION, id);
    await updateDoc(docRef, color);
  } catch (error) {
    // Failed to update color
    throw error;
  }
};

export const deleteColor = async (id: string) => {
  try {
    await deleteDoc(doc(db, COLORS_COLLECTION, id));
  } catch (error) {
    // Failed to delete color
    throw error;
  }
};


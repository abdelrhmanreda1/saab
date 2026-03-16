import { db } from '../firebase';
import { collection, addDoc, getDoc, updateDoc, deleteDoc, doc, query, getDocs, orderBy, where } from 'firebase/firestore';
import { Supplier } from './suppliers';

const suppliersCollectionRef = collection(db, 'suppliers');

export const addSupplier = async (supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newSupplierRef = await addDoc(suppliersCollectionRef, {
    ...supplier,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newSupplierRef.id;
};

export const getSupplier = async (id: string): Promise<Supplier | null> => {
  const supplierDocRef = doc(db, 'suppliers', id);
  const supplierDoc = await getDoc(supplierDocRef);
  if (supplierDoc.exists()) {
    return { id: supplierDoc.id, ...supplierDoc.data() } as Supplier;
  }
  return null;
};

export const getAllSuppliers = async (activeOnly?: boolean): Promise<Supplier[]> => {
  let q = query(suppliersCollectionRef, orderBy('createdAt', 'desc'));
  if (activeOnly) {
    q = query(suppliersCollectionRef, where('isActive', '==', true), orderBy('createdAt', 'desc'));
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
};

export const updateSupplier = async (id: string, supplier: Partial<Omit<Supplier, 'id' | 'createdAt'>>): Promise<void> => {
  const supplierDocRef = doc(db, 'suppliers', id);
  await updateDoc(supplierDocRef, {
    ...supplier,
    updatedAt: new Date(),
  });
};

export const deleteSupplier = async (id: string): Promise<void> => {
  const supplierDocRef = doc(db, 'suppliers', id);
  await deleteDoc(supplierDocRef);
};


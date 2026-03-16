import { db } from '../firebase';
import { collection, addDoc, getDoc, updateDoc, deleteDoc, doc, query, getDocs, orderBy } from 'firebase/firestore';
import { ProductTemplate } from './products';

const templatesCollectionRef = collection(db, 'product_templates');

export const addProductTemplate = async (template: Omit<ProductTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const newTemplateRef = await addDoc(templatesCollectionRef, {
    ...template,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return newTemplateRef.id;
};

export const getProductTemplate = async (id: string): Promise<ProductTemplate | null> => {
  const templateDocRef = doc(db, 'product_templates', id);
  const templateDoc = await getDoc(templateDocRef);
  if (templateDoc.exists()) {
    return { id: templateDoc.id, ...templateDoc.data() } as ProductTemplate;
  }
  return null;
};

export const getAllProductTemplates = async (): Promise<ProductTemplate[]> => {
  const q = query(templatesCollectionRef, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductTemplate));
};

export const updateProductTemplate = async (id: string, template: Partial<Omit<ProductTemplate, 'id' | 'createdAt'>>): Promise<void> => {
  const templateDocRef = doc(db, 'product_templates', id);
  await updateDoc(templateDocRef, {
    ...template,
    updatedAt: new Date(),
  });
};

export const deleteProductTemplate = async (id: string): Promise<void> => {
  const templateDocRef = doc(db, 'product_templates', id);
  await deleteDoc(templateDocRef);
};


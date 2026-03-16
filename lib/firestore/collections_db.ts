import { db } from '../firebase';
import { collection, addDoc, getDoc, updateDoc, deleteDoc, doc, query, getDocs, Timestamp, deleteField } from 'firebase/firestore';
import { Collection } from './collections';

const collectionsCollectionRef = collection(db, 'collections');

export const addCollection = async (collection: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  // Filter out undefined, null, and empty string values
  const cleanCollection: Record<string, unknown> = {
    name: collection.name,
    slug: collection.slug,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  if (collection.description !== undefined && collection.description !== null && collection.description !== '') {
    cleanCollection.description = collection.description;
  }
  
  if (collection.imageUrl !== undefined && collection.imageUrl !== null && collection.imageUrl !== '') {
    cleanCollection.imageUrl = collection.imageUrl;
  }
  
  if (collection.parentCollection !== undefined && collection.parentCollection !== null && collection.parentCollection !== '') {
    cleanCollection.parentCollection = collection.parentCollection;
  }
  
  const newCollectionRef = await addDoc(collectionsCollectionRef, cleanCollection);
  return newCollectionRef.id;
};

export const getCollection = async (id: string): Promise<Collection | null> => {
  const collectionDocRef = doc(db, 'collections', id);
  const collectionDoc = await getDoc(collectionDocRef);
  if (collectionDoc.exists()) {
    return { id: collectionDoc.id, ...collectionDoc.data() } as Collection;
  }
  return null;
};

export const getAllCollections = async (): Promise<Collection[]> => {
  const q = query(collectionsCollectionRef);
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Collection));
};

export const updateCollection = async (id: string, collection: Partial<Omit<Collection, 'id' | 'createdAt'>>): Promise<void> => {
  // Filter out undefined, null, and empty string values
  const cleanCollection: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };
  
  if (collection.name !== undefined && collection.name !== null && collection.name !== '') {
    cleanCollection.name = collection.name;
  }
  
  if (collection.slug !== undefined && collection.slug !== null && collection.slug !== '') {
    cleanCollection.slug = collection.slug;
  }
  
  if (collection.description !== undefined && collection.description !== null && collection.description !== '') {
    cleanCollection.description = collection.description;
  } else if (collection.description === '') {
    // Explicitly set to empty string if provided
    cleanCollection.description = '';
  }
  
  if (collection.imageUrl !== undefined && collection.imageUrl !== null && collection.imageUrl !== '') {
    cleanCollection.imageUrl = collection.imageUrl;
  } else if (collection.imageUrl === '') {
    // Explicitly set to empty string if provided
    cleanCollection.imageUrl = '';
  }
  
  if (collection.parentCollection !== undefined && collection.parentCollection !== null && collection.parentCollection !== '') {
    cleanCollection.parentCollection = collection.parentCollection;
  } else if (collection.parentCollection === '' || collection.parentCollection === undefined) {
    // If explicitly set to empty or undefined, use deleteField() to remove the field
    cleanCollection.parentCollection = deleteField();
  }
  
  const collectionDocRef = doc(db, 'collections', id);
  await updateDoc(collectionDocRef, cleanCollection);
};

export const deleteCollection = async (id: string): Promise<void> => {
  const collectionDocRef = doc(db, 'collections', id);
  await deleteDoc(collectionDocRef);
};

// Get all child collections (recursive) for a given parent collection ID
export const getChildCollections = (parentId: string, allCollections: Collection[]): string[] => {
  const children: string[] = [];
  const directChildren = allCollections.filter(c => c.parentCollection === parentId);
  
  directChildren.forEach(child => {
    children.push(child.id);
    // Recursively get grandchildren
    const grandchildren = getChildCollections(child.id, allCollections);
    children.push(...grandchildren);
  });
  
  return children;
};


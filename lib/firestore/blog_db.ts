import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp,
  getDoc,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { BlogPost } from './blog';

const BLOG_COLLECTION = 'blog_posts';

export const getAllPosts = async (publishedOnly = false): Promise<BlogPost[]> => {
  let q;
  
  if (publishedOnly) {
    q = query(
      collection(db, BLOG_COLLECTION),
      where('isPublished', '==', true),
      orderBy('publishedAt', 'desc')
    );
  } else {
    q = query(collection(db, BLOG_COLLECTION), orderBy('createdAt', 'desc'));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as BlogPost));
};

export const getPostById = async (id: string): Promise<BlogPost | null> => {
  const docRef = doc(db, BLOG_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as BlogPost;
  } else {
    return null;
  }
};

export const getPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  const q = query(collection(db, BLOG_COLLECTION), where('slug', '==', slug), limit(1));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as BlogPost;
  }
  return null;
};

export const addPost = async (post: Omit<BlogPost, 'id'>) => {
  return await addDoc(collection(db, BLOG_COLLECTION), {
    ...post,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const updatePost = async (id: string, data: Partial<BlogPost>) => {
  const docRef = doc(db, BLOG_COLLECTION, id);
  return await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deletePost = async (id: string) => {
  const docRef = doc(db, BLOG_COLLECTION, id);
  return await deleteDoc(docRef);
};

export const getLatestPosts = async (count: number = 3): Promise<BlogPost[]> => {
  const q = query(
    collection(db, BLOG_COLLECTION),
    where('isPublished', '==', true),
    orderBy('publishedAt', 'desc'),
    limit(count)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BlogPost));
};

